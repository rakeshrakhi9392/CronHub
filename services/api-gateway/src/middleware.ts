import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { Redis } from 'ioredis';
import { Kafka, Producer } from 'kafkajs';
import {
  KAFKA_TOPICS,
  REDIS_KEYS,
  type AppConfig,
  type ValidateApiKeyResponse,
} from '@chronoflow/shared';

export const REQUEST_ID_HEADER = 'X-Request-Id';
export const TENANT_ID_ATTR = 'chronoflow.tenantId';
export const TENANT_LIMIT_ATTR = 'chronoflow.tenantLimit';

let redis: Redis | null = null;
let kafkaProducer: Producer | null = null;

export function getRedis(redisUrl: string): Redis {
  if (!redis) redis = new Redis(redisUrl);
  return redis;
}

async function getProducer(brokers: string[]): Promise<Producer> {
  if (!kafkaProducer) {
    const kafka = new Kafka({ clientId: 'chrono-api-gateway', brokers });
    kafkaProducer = kafka.producer();
    await kafkaProducer.connect();
  }
  return kafkaProducer;
}

function isPublicPath(path: string, method: string): boolean {
  if (path.startsWith('/actuator') || path.startsWith('/api/v1/health') || path.startsWith('/demo')) {
    return true;
  }
  if (method === 'POST' && path === '/api/v1/tenants') return true;
  if (method === 'POST' && /^\/api\/v1\/tenants\/[^/]+\/api-keys$/.test(path)) return true;
  return false;
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = req.header(REQUEST_ID_HEADER) ?? randomUUID();
  req.headers[REQUEST_ID_HEADER.toLowerCase()] = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  (req as Request & { requestId: string }).requestId = requestId;
  next();
}

export function createAuthMiddleware(config: AppConfig) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (isPublicPath(req.path, req.method)) {
      next();
      return;
    }

    const credential = req.header('X-API-Key');
    if (!credential?.trim()) {
      res.status(401).json({ status: 'UNAUTHORIZED', message: 'invalid api key' });
      return;
    }

    try {
      const response = await fetch(
        `${config.authServiceBaseUrl}/internal/v1/api-keys/validate`,
        { headers: { 'X-API-Key': credential } },
      );
      const result = (await response.json()) as ValidateApiKeyResponse;
      if (!result.valid || !result.tenantId) {
        res.status(401).json({ status: 'UNAUTHORIZED', message: 'invalid api key' });
        return;
      }

      (req as Request & Record<string, unknown>)[TENANT_ID_ATTR] = result.tenantId;
      (req as Request & Record<string, unknown>)[TENANT_LIMIT_ATTR] =
        result.tenantRateLimitPerMinute;
      req.headers['x-tenant-id'] = result.tenantId;
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function createRateLimitMiddleware(config: AppConfig) {
  const redisClient = getRedis(config.redisUrl);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.path.startsWith('/actuator') || req.path.startsWith('/api/v1/health')) {
      next();
      return;
    }

    const tenantId = (req as Request & Record<string, unknown>)[TENANT_ID_ATTR] as
      | string
      | undefined;
    const tenantLimit = (req as Request & Record<string, unknown>)[TENANT_LIMIT_ATTR] as
      | number
      | undefined;

    if (!tenantId) {
      next();
      return;
    }

    const epochWindow = Math.floor(Date.now() / 1000 / config.rateLimitWindowSeconds);
    const redisKey = `${REDIS_KEYS.rateLimitPrefix}${tenantId}:${epochWindow}`;
    const effectiveLimit =
      tenantLimit && tenantLimit > 0 ? tenantLimit : config.rateLimitMaxRequests;

    const count = await redisClient.incr(redisKey);
    if (count === 1) {
      await redisClient.expire(redisKey, config.rateLimitWindowSeconds);
    }

    res.setHeader('X-RateLimit-Limit', String(effectiveLimit));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(effectiveLimit - count, 0)));

    if (count > effectiveLimit) {
      res.status(429).json({ status: 'RATE_LIMITED', message: 'too many requests' });
      return;
    }

    next();
  };
}

export function createAuditMiddleware(config: AppConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const start = Date.now();

    res.on('finish', () => {
      void (async () => {
        try {
          const tenantId =
            ((req as Request & Record<string, unknown>)[TENANT_ID_ATTR] as string | undefined) ??
            'anonymous';
          const requestId =
            (req as Request & { requestId?: string }).requestId ?? 'n/a';
          const producer = await getProducer(config.kafkaBrokers);
          const payload = JSON.stringify({
            eventType: 'GATEWAY_AUDIT',
            timestamp: new Date().toISOString(),
            requestId,
            tenantId,
            method: req.method,
            path: req.path,
            status: res.statusCode,
            latencyMs: Date.now() - start,
          });
          await producer.send({
            topic: KAFKA_TOPICS.gatewayAudit,
            messages: [{ key: tenantId, value: payload }],
          });
        } catch (err) {
          console.warn('Failed to publish gateway audit log', err);
        }
      })();
    });

    next();
  };
}

export async function disconnectGateway(): Promise<void> {
  if (redis) {
    redis.disconnect();
    redis = null;
  }
  if (kafkaProducer) {
    await kafkaProducer.disconnect();
    kafkaProducer = null;
  }
}
