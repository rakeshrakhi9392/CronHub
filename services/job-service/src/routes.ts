import express from 'express';
import { z } from 'zod';
import {
  createApiKey,
  createJob,
  createTenant,
  listJobs,
} from './services.js';

const createTenantSchema = z.object({
  name: z.string().min(1).max(120),
});

const createJobSchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(140),
  cronExpression: z.string().min(1).max(64),
  targetUrl: z.string().min(1).max(1000),
});

export function createRouter(kafkaBrokers: string[]) {
  const router = express.Router();

  router.post('/tenants', async (req, res, next) => {
    try {
      const body = createTenantSchema.parse(req.body);
      const tenant = await createTenant(body.name);
      res.status(201).json(tenant);
    } catch (err) {
      next(err);
    }
  });

  router.post('/tenants/:tenantId/api-keys', async (req, res, next) => {
    try {
      const result = await createApiKey(req.params.tenantId);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  });

  router.post('/jobs', async (req, res, next) => {
    try {
      const body = createJobSchema.parse(req.body);
      const job = await createJob(body, kafkaBrokers);
      res.status(201).json(job);
    } catch (err) {
      next(err);
    }
  });

  router.get('/jobs', async (req, res, next) => {
    try {
      const tenantId = z.string().uuid().parse(req.query.tenantId);
      const jobs = await listJobs(tenantId);
      res.json(jobs);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
