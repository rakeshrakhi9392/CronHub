import express from 'express';
import {
  listTenantKeys,
  revokeKey,
  rotateKey,
  validateCredential,
} from './services.js';

export function createRouter() {
  const router = express.Router();

  router.get('/internal/v1/api-keys/validate', async (req, res, next) => {
    try {
      const credential = req.header('X-API-Key');
      const result = await validateCredential(credential);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  router.get('/internal/v1/tenants/:tenantId/api-keys', async (req, res, next) => {
    try {
      const keys = await listTenantKeys(req.params.tenantId);
      res.json(keys);
    } catch (err) {
      next(err);
    }
  });

  router.post('/internal/v1/tenants/:tenantId/api-keys/:keyId/revoke', async (req, res, next) => {
    try {
      await revokeKey(req.params.tenantId, req.params.keyId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  router.post('/internal/v1/tenants/:tenantId/api-keys/:keyId/rotate', async (req, res, next) => {
    try {
      const result = await rotateKey(req.params.tenantId, req.params.keyId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
