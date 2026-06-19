import { ApiKey, JobDefinition, Tenant } from '@chronoflow/db';
import {
  BadRequestError,
  NotFoundError,
  generateKeyId,
  generateKeySecret,
  sha256Hex,
  validateCronExpression,
  type CreateApiKeyResponse,
  type CreateJobRequest,
  type JobResponse,
  type TenantResponse,
} from '@chronoflow/shared';
import { publishJobCreated } from './kafka.js';

export async function createTenant(name: string): Promise<TenantResponse> {
  const trimmed = name.trim();
  if (!trimmed) throw new BadRequestError('name is required');

  const existing = await Tenant.findOne({ where: { name: trimmed } });
  if (existing) throw new BadRequestError('Tenant with same name already exists');

  const tenant = await Tenant.create({
    name: trimmed,
    createdAt: new Date(),
    rateLimitPerMinute: 120,
  });

  return {
    id: tenant.id,
    name: tenant.name,
    createdAt: tenant.createdAt.toISOString(),
  };
}

export async function createApiKey(tenantId: string): Promise<CreateApiKeyResponse> {
  const tenant = await Tenant.findByPk(tenantId);
  if (!tenant) throw new NotFoundError(`Tenant not found: ${tenantId}`);

  const keyId = generateKeyId();
  const keySecret = generateKeySecret();

  await ApiKey.create({
    tenantId: tenant.id,
    keyId,
    keySecretHash: sha256Hex(keySecret),
    status: 'ACTIVE',
    createdAt: new Date(),
  });

  return { keyId, keySecret };
}

export async function createJob(
  request: CreateJobRequest,
  kafkaBrokers: string[],
): Promise<JobResponse> {
  const tenant = await Tenant.findByPk(request.tenantId);
  if (!tenant) throw new NotFoundError(`Tenant not found: ${request.tenantId}`);

  try {
    validateCronExpression(request.cronExpression);
  } catch {
    throw new BadRequestError(`Invalid cron expression: ${request.cronExpression}`);
  }

  const now = new Date();
  const job = await JobDefinition.create({
    tenantId: tenant.id,
    name: request.name.trim(),
    cronExpression: request.cronExpression.trim(),
    targetUrl: request.targetUrl.trim(),
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
  });

  await publishJobCreated(kafkaBrokers, {
    eventType: 'JOB_CREATED',
    jobId: job.id,
    tenantId: tenant.id,
    cronExpression: job.cronExpression,
    targetUrl: job.targetUrl,
  });

  return mapJob(job);
}

export async function listJobs(tenantId: string): Promise<JobResponse[]> {
  const tenant = await Tenant.findByPk(tenantId);
  if (!tenant) throw new NotFoundError(`Tenant not found: ${tenantId}`);

  const jobs = await JobDefinition.findAll({
    where: { tenantId },
    order: [['createdAt', 'DESC']],
  });

  return jobs.map(mapJob);
}

function mapJob(job: JobDefinition): JobResponse {
  return {
    id: job.id,
    name: job.name,
    cronExpression: job.cronExpression,
    targetUrl: job.targetUrl,
    status: job.status,
    createdAt: job.createdAt.toISOString(),
  };
}
