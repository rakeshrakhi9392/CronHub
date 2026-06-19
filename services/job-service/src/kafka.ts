import { Kafka, Producer } from 'kafkajs';
import { KAFKA_TOPICS, type JobCreatedEvent } from '@chronoflow/shared';

let producer: Producer | null = null;

export async function getKafkaProducer(brokers: string[]): Promise<Producer> {
  if (producer) return producer;
  const kafka = new Kafka({ clientId: 'chrono-job-service', brokers });
  producer = kafka.producer();
  await producer.connect();
  return producer;
}

export async function publishJobCreated(
  brokers: string[],
  event: JobCreatedEvent,
): Promise<void> {
  const p = await getKafkaProducer(brokers);
  await p.send({
    topic: KAFKA_TOPICS.jobCreated,
    messages: [{ key: String(event.jobId), value: JSON.stringify(event) }],
  });
}

export async function disconnectKafka(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
  }
}
