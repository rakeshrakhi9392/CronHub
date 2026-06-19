export type ApiStatus =
  | 'OK'
  | 'NOT_FOUND'
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED';

export interface BaseApiResponse {
  status: ApiStatus | string;
  message: string;
  timestamp: string;
}

export interface TenantResponse {
  id: string;
  name: string;
  createdAt: string;
}

export interface CreateTenantRequest {
  name: string;
}

export interface CreateApiKeyResponse {
  keyId: string;
  keySecret: string;
}

export interface CreateJobRequest {
  tenantId: string;
  name: string;
  cronExpression: string;
  targetUrl: string;
}

export type JobStatus = 'ACTIVE' | 'PAUSED';

export interface JobResponse {
  id: number;
  name: string;
  cronExpression: string;
  targetUrl: string;
  status: JobStatus;
  createdAt: string;
}

export interface ValidateApiKeyResponse {
  valid: boolean;
  tenantId: string | null;
  tenantRateLimitPerMinute: number | null;
}

export interface ApiKeyRecordResponse {
  keyId: string;
  status: 'ACTIVE' | 'REVOKED';
  createdAt: string;
}

export interface RotateApiKeyResponse {
  keyId: string;
  newKeySecret: string;
}

export interface JobCreatedEvent {
  eventType: 'JOB_CREATED';
  jobId: number;
  tenantId: string;
  cronExpression: string;
  targetUrl: string;
}

export interface ExecuteEvent {
  eventType: 'JOB_EXECUTE' | 'JOB_EXECUTE_RETRY';
  executionId?: string;
  jobId: string;
  tenantId: string;
  targetUrl: string;
  triggeredAt: string;
  attempt?: number;
}

export interface DlqEvent {
  eventType: 'JOB_EXECUTE_DLQ';
  jobId: string;
  tenantId: string;
  targetUrl: string;
  triggeredAt: string;
  attempt: number;
  failedAt: string;
  reason: string;
}

export interface AuditEvent {
  eventType: 'GATEWAY_AUDIT';
  timestamp: string;
  requestId: string;
  tenantId: string;
  method: string;
  path: string;
  status: number;
  latencyMs: number;
}

export type ExecutionStatus = 'PENDING' | 'RETRY_PENDING' | 'SUCCESS' | 'DLQ';

export const KAFKA_TOPICS = {
  jobCreated: 'chronoflow.job.created.v1',
  jobExecute: 'chronoflow.job.execute.v1',
  jobDlq: 'chronoflow.job.dlq.v1',
  gatewayAudit: 'chronoflow.gateway.audit.v1',
} as const;

export const REDIS_KEYS = {
  schedulerJobs: 'chronoflow:scheduler:jobs',
  schedulerJobPrefix: 'chronoflow:scheduler:job:',
  rateLimitPrefix: 'chronoflow:gateway:ratelimit:tenant:',
} as const;

export const SERVICE_PORTS = {
  gateway: 8080,
  job: 8081,
  scheduler: 8082,
  executor: 8083,
  auth: 8084,
} as const;
