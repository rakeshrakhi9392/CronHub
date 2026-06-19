import axios from 'axios';
import { Kafka, Consumer, Producer } from 'kafkajs';
import { ExecutionRecord, getSequelize } from '@chronoflow/db';
import {
  KAFKA_TOPICS,
  type AppConfig,
  type ExecuteEvent,
} from '@chronoflow/shared';
import { Op } from 'sequelize';

export class ExecutionService {
  private consumer: Consumer | null = null;
  private producer: Producer | null = null;
  private retryTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly config: AppConfig,
    private readonly databaseUrl: string,
  ) {}

  async start(): Promise<void> {
    await getSequelize(this.databaseUrl);

    const kafka = new Kafka({ clientId: 'chrono-executor-service', brokers: this.config.kafkaBrokers });
    this.consumer = kafka.consumer({ groupId: 'chrono-executor-service' });
    this.producer = kafka.producer();
    await this.consumer.connect();
    await this.producer.connect();

    await this.consumer.subscribe({ topic: KAFKA_TOPICS.jobExecute, fromBeginning: false });
    await this.consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;
        const event = JSON.parse(message.value.toString()) as ExecuteEvent;
        await this.process(event);
      },
    });

    this.retryTimer = setInterval(() => {
      void this.processPendingRetries();
    }, this.config.executorRetryPollIntervalMs);
  }

  async process(event: ExecuteEvent): Promise<void> {
    const executionId =
      event.executionId && event.executionId.trim().length > 0
        ? event.executionId
        : `${event.jobId}:${event.triggeredAt}`;
    const currentAttempt = event.attempt ?? 1;

    let record = await ExecutionRecord.findByPk(executionId);
    if (!record) {
      record = ExecutionRecord.build({
        executionId,
        jobId: event.jobId,
        tenantId: event.tenantId,
        targetUrl: event.targetUrl,
        triggeredAt: new Date(event.triggeredAt),
        attempt: currentAttempt,
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    if (record.status === 'SUCCESS' || record.status === 'DLQ') {
      console.log(`Skipping duplicate execution event executionId=${executionId} status=${record.status}`);
      return;
    }

    record.attempt = currentAttempt;
    record.status = 'PENDING';
    record.updatedAt = new Date();
    const start = Date.now();

    try {
      const response = await axios.post(
        event.targetUrl,
        {
          jobId: event.jobId,
          tenantId: event.tenantId,
          triggeredAt: event.triggeredAt,
          attempt: currentAttempt,
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: this.config.executorReadTimeoutMs,
          validateStatus: () => true,
        },
      );

      const latencyMs = Date.now() - start;
      if (response.status >= 200 && response.status < 300) {
        record.status = 'SUCCESS';
        record.lastStatusCode = response.status;
        record.lastLatencyMs = latencyMs;
        record.lastError = null;
        record.nextAttemptAt = null;
        record.updatedAt = new Date();
        await record.save();
        console.log(
          `Webhook success jobId=${event.jobId} attempt=${currentAttempt} status=${response.status} latencyMs=${latencyMs}`,
        );
        return;
      }

      throw new Error(`Non-success status code: ${response.status}`);
    } catch (err) {
      await this.handleFailure(record, event, currentAttempt, err);
    }
  }

  private async handleFailure(
    record: ExecutionRecord,
    event: ExecuteEvent,
    currentAttempt: number,
    err: unknown,
  ): Promise<void> {
    const message = err instanceof Error ? err.message : String(err);
    record.lastError = message;
    record.updatedAt = new Date();

    if (currentAttempt >= this.config.executorMaxAttempts) {
      record.status = 'DLQ';
      record.nextAttemptAt = null;
      await record.save();
      await this.publishDlq(event, currentAttempt, message);
      console.error(`Moved to DLQ jobId=${event.jobId} attempt=${currentAttempt} error=${message}`);
      return;
    }

    const nextAttemptAt = new Date(
      Date.now() +
        this.config.executorRetryBackoffMs * 2 ** Math.max(0, currentAttempt - 1),
    );
    record.status = 'RETRY_PENDING';
    record.attempt = currentAttempt;
    record.nextAttemptAt = nextAttemptAt;
    await record.save();
    console.warn(
      `Scheduled retry jobId=${event.jobId} nextAttempt=${currentAttempt + 1} reason=${message}`,
    );
  }

  private async publishDlq(
    event: ExecuteEvent,
    attempt: number,
    reason: string,
  ): Promise<void> {
    if (!this.producer) return;
    const payload = JSON.stringify({
      eventType: 'JOB_EXECUTE_DLQ',
      jobId: event.jobId,
      tenantId: event.tenantId,
      targetUrl: event.targetUrl,
      triggeredAt: event.triggeredAt,
      attempt,
      failedAt: new Date().toISOString(),
      reason,
    });
    await this.producer.send({
      topic: KAFKA_TOPICS.jobDlq,
      messages: [{ key: event.jobId, value: payload }],
    });
  }

  private async processPendingRetries(): Promise<void> {
    const dueRecords = await ExecutionRecord.findAll({
      where: {
        status: 'RETRY_PENDING',
        nextAttemptAt: { [Op.lte]: new Date() },
      },
      order: [['nextAttemptAt', 'ASC']],
      limit: 100,
    });

    for (const record of dueRecords) {
      await this.process({
        eventType: 'JOB_EXECUTE_RETRY',
        executionId: record.executionId,
        jobId: record.jobId,
        tenantId: record.tenantId,
        targetUrl: record.targetUrl,
        triggeredAt: record.triggeredAt.toISOString(),
        attempt: record.attempt + 1,
      });
    }
  }

  async stop(): Promise<void> {
    if (this.retryTimer) clearInterval(this.retryTimer);
    await this.consumer?.disconnect();
    await this.producer?.disconnect();
  }
}
