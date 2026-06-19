import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { Kafka, Consumer, Producer } from 'kafkajs';
import {
  KAFKA_TOPICS,
  REDIS_KEYS,
  computeNextRun,
  type JobCreatedEvent,
} from '@chronoflow/shared';

export class ScheduleIndexService {
  constructor(private readonly redis: Redis) {}

  async upsertJob(
    jobId: number,
    tenantId: string,
    cronExpression: string,
    targetUrl: string,
  ): Promise<void> {
    const nextRun = computeNextRun(cronExpression);
    const metadata = {
      jobId: String(jobId),
      tenantId,
      cronExpression,
      targetUrl,
    };

    await this.redis.hset(this.metaKey(jobId), metadata);
    await this.redis.zadd(REDIS_KEYS.schedulerJobs, nextRun.getTime(), String(jobId));
    console.log(`Indexed jobId=${jobId} nextRun=${nextRun.toISOString()}`);
  }

  async getDueJobIds(now: Date): Promise<string[]> {
    return this.redis.zrangebyscore(REDIS_KEYS.schedulerJobs, 0, now.getTime());
  }

  async getJobMetadata(jobId: string): Promise<Record<string, string>> {
    return this.redis.hgetall(`${REDIS_KEYS.schedulerJobPrefix}${jobId}`);
  }

  async reschedule(jobId: string, cronExpression: string): Promise<void> {
    const nextRun = computeNextRun(cronExpression);
    await this.redis.zadd(REDIS_KEYS.schedulerJobs, nextRun.getTime(), jobId);
  }

  private metaKey(jobId: number | string): string {
    return `${REDIS_KEYS.schedulerJobPrefix}${jobId}`;
  }
}

export class SchedulerRuntime {
  private consumer: Consumer | null = null;
  private producer: Producer | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private readonly redis: Redis;
  private readonly index: ScheduleIndexService;

  constructor(
    private readonly brokers: string[],
    redisUrl: string,
    private readonly pollIntervalMs: number,
  ) {
    this.redis = new Redis(redisUrl);
    this.index = new ScheduleIndexService(this.redis);
  }

  async start(): Promise<void> {
    const kafka = new Kafka({ clientId: 'chrono-scheduler-service', brokers: this.brokers });
    this.consumer = kafka.consumer({ groupId: 'chrono-scheduler-service' });
    this.producer = kafka.producer();
    await this.consumer.connect();
    await this.producer.connect();

    await this.consumer.subscribe({ topic: KAFKA_TOPICS.jobCreated, fromBeginning: false });
    await this.consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;
        const event = JSON.parse(message.value.toString()) as JobCreatedEvent;
        if (event.eventType !== 'JOB_CREATED') return;
        await this.index.upsertJob(
          event.jobId,
          event.tenantId,
          event.cronExpression,
          event.targetUrl,
        );
      },
    });

    this.pollTimer = setInterval(() => {
      void this.publishDueJobs();
    }, this.pollIntervalMs);
  }

  private async publishDueJobs(): Promise<void> {
    if (!this.producer) return;
    const now = new Date();
    const dueJobIds = await this.index.getDueJobIds(now);
    if (!dueJobIds.length) return;

    for (const jobId of dueJobIds) {
      const metadata = await this.index.getJobMetadata(jobId);
      if (!Object.keys(metadata).length) continue;

      const payload = JSON.stringify({
        eventType: 'JOB_EXECUTE',
        executionId: randomUUID(),
        jobId,
        tenantId: metadata.tenantId,
        targetUrl: metadata.targetUrl,
        triggeredAt: now.toISOString(),
      });

      await this.producer.send({
        topic: KAFKA_TOPICS.jobExecute,
        messages: [{ key: jobId, value: payload }],
      });
      await this.index.reschedule(jobId, metadata.cronExpression);
      console.log(`Published ${KAFKA_TOPICS.jobExecute} for jobId=${jobId}`);
    }
  }

  async stop(): Promise<void> {
    if (this.pollTimer) clearInterval(this.pollTimer);
    await this.consumer?.disconnect();
    await this.producer?.disconnect();
    this.redis.disconnect();
  }
}
