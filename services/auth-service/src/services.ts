import { ApiKey, Tenant } from '@chronoflow/db';
import {
  AppError,
  NotFoundError,
  generateKeySecret,
  sha256Hex,
  type ApiKeyRecordResponse,
  type RotateApiKeyResponse,
  type ValidateApiKeyResponse,
} from '@chronoflow/shared';

export async function validateCredential(
  rawCredential: string | undefined,
): Promise<ValidateApiKeyResponse> {
  if (!rawCredential?.includes(':')) {
    return { valid: false, tenantId: null, tenantRateLimitPerMinute: null };
  }

  const [keyId, keySecret] = rawCredential.split(':', 2);
  if (!keyId?.trim() || !keySecret?.trim()) {
    return { valid: false, tenantId: null, tenantRateLimitPerMinute: null };
  }

  const apiKey = await ApiKey.findOne({
    where: { keyId, status: 'ACTIVE' },
  });

  if (!apiKey || apiKey.keySecretHash !== sha256Hex(keySecret)) {
    return { valid: false, tenantId: null, tenantRateLimitPerMinute: null };
  }

  const tenant = await Tenant.findByPk(apiKey.tenantId);
  return {
    valid: true,
    tenantId: apiKey.tenantId,
    tenantRateLimitPerMinute: tenant?.rateLimitPerMinute ?? 120,
  };
}

export async function listTenantKeys(tenantId: string): Promise<ApiKeyRecordResponse[]> {
  const keys = await ApiKey.findAll({
    where: { tenantId },
    order: [['createdAt', 'DESC']],
  });

  return keys.map((key) => ({
    keyId: key.keyId,
    status: key.status,
    createdAt: key.createdAt.toISOString(),
  }));
}

export async function revokeKey(tenantId: string, keyId: string): Promise<void> {
  const key = await ApiKey.findOne({ where: { tenantId, keyId } });
  if (!key) throw new NotFoundError('Api key not found');
  key.status = 'REVOKED';
  await key.save();
}

export async function rotateKey(
  tenantId: string,
  keyId: string,
): Promise<RotateApiKeyResponse> {
  const key = await ApiKey.findOne({ where: { tenantId, keyId } });
  if (!key) throw new NotFoundError('Api key not found');

  const newSecret = generateKeySecret();
  key.keySecretHash = sha256Hex(newSecret);
  key.status = 'ACTIVE';
  await key.save();

  return { keyId: key.keyId, newKeySecret: newSecret };
}

export function notFoundHandler(message: string): never {
  throw new AppError(404, 'NOT_FOUND', message);
}
