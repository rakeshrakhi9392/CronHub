import { SERVICE_PORTS } from './types.js';

export interface AppConfig {
  serviceName: string;
  port: number;
  databaseUrl: string;
  redisUrl: string;
  kafkaBrokers: string[];
  otlpEndpoint: string;
  authServiceBaseUrl: string;
  jobServiceBaseUrl: string;
  schedulerServiceBaseUrl: string;
  executorServiceBaseUrl: string;
  rateLimitMaxRequests: number;
  rateLimitWindowSeconds: number;
  schedulerPollIntervalMs: number;
  executorMaxAttempts: number;
  executorRetryBackoffMs: number;
  executorConnectTimeoutMs: number;
  executorReadTimeoutMs: number;
  executorRetryPollIntervalMs: number;
}

function envInt(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function envStr(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

function databaseUrlFromEnv(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const jdbc = process.env.SPRING_DATASOURCE_URL;
  if (jdbc) {
    const user = process.env.SPRING_DATASOURCE_USERNAME ?? 'chronoflow';
    const pass = process.env.SPRING_DATASOURCE_PASSWORD ?? 'chronoflow';
    const normalized = jdbc.replace(/^jdbc:/, '');
    const url = new URL(normalized);
    url.username = user;
    url.password = pass;
    return url.toString();
  }

  return 'postgresql://chronoflow:chronoflow@localhost:5432/chronoflow';
}

function redisUrlFromEnv(): string {
  if (process.env.REDIS_URL) return process.env.REDIS_URL;
  const host = process.env.SPRING_DATA_REDIS_HOST ?? 'localhost';
  const port = process.env.SPRING_DATA_REDIS_PORT ?? '6379';
  return `redis://${host}:${port}`;
}

function kafkaBrokersFromEnv(): string[] {
  const brokers =
    process.env.KAFKA_BROKERS ??
    process.env.SPRING_KAFKA_BOOTSTRAP_SERVERS ??
    'localhost:9092';
  return brokers.split(',');
}

function otlpEndpointFromEnv(): string {
  return (
    process.env.OTLP_ENDPOINT ??
    process.env.MANAGEMENT_OTLP_TRACING_ENDPOINT ??
    'http://localhost:4318/v1/traces'
  );
}

export function loadConfig(serviceName: string, port: number): AppConfig {
  const resolvedPort = envInt('PORT', envInt('SERVER_PORT', port));

  return {
    serviceName,
    port: resolvedPort,
    databaseUrl: databaseUrlFromEnv(),
    redisUrl: redisUrlFromEnv(),
    kafkaBrokers: kafkaBrokersFromEnv(),
    otlpEndpoint: otlpEndpointFromEnv(),
    authServiceBaseUrl: envStr(
      'AUTH_SERVICE_BASE_URL',
      envStr('APP_SECURITY_AUTH_SERVICE_BASE_URL', `http://localhost:${SERVICE_PORTS.auth}`),
    ),
    jobServiceBaseUrl: envStr('JOB_SERVICE_BASE_URL', `http://localhost:${SERVICE_PORTS.job}`),
    schedulerServiceBaseUrl: envStr(
      'SCHEDULER_SERVICE_BASE_URL',
      `http://localhost:${SERVICE_PORTS.scheduler}`,
    ),
    executorServiceBaseUrl: envStr(
      'EXECUTOR_SERVICE_BASE_URL',
      `http://localhost:${SERVICE_PORTS.executor}`,
    ),
    rateLimitMaxRequests: envInt('RATE_LIMIT_MAX_REQUESTS', 120),
    rateLimitWindowSeconds: envInt('RATE_LIMIT_WINDOW_SECONDS', 60),
    schedulerPollIntervalMs: envInt('SCHEDULER_POLL_INTERVAL_MS', 1000),
    executorMaxAttempts: envInt('EXECUTOR_MAX_ATTEMPTS', 5),
    executorRetryBackoffMs: envInt('EXECUTOR_RETRY_BACKOFF_MS', 5000),
    executorConnectTimeoutMs: envInt('EXECUTOR_CONNECT_TIMEOUT_MS', 2000),
    executorReadTimeoutMs: envInt('EXECUTOR_READ_TIMEOUT_MS', 4000),
    executorRetryPollIntervalMs: envInt('EXECUTOR_RETRY_POLL_INTERVAL_MS', 1000),
  };
}
