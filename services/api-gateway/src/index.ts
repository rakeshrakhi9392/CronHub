import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import {
  SERVICE_PORTS,
  errorHandler,
  loadConfig,
  registerHealthRoutes,
  initTracing,
  shutdownTracing,
} from '@chronoflow/shared';
import {
  createAuditMiddleware,
  createAuthMiddleware,
  createRateLimitMiddleware,
  disconnectGateway,
  requestIdMiddleware,
} from './middleware.js';

const config = loadConfig('chrono-api-gateway', SERVICE_PORTS.gateway);
process.env.SERVICE_NAME = config.serviceName;

async function main() {
  await initTracing(config.serviceName, config.otlpEndpoint);
  const app = express();
  app.use(express.json());

  registerHealthRoutes(app, 'chrono-api-gateway is up');

  app.use(requestIdMiddleware);
  app.use(createAuthMiddleware(config));
  app.use(createRateLimitMiddleware(config));
  app.use(createAuditMiddleware(config));

  app.use(
    '/api/v1/tenants',
    createProxyMiddleware({
      target: config.jobServiceBaseUrl,
      changeOrigin: true,
    }),
  );

  app.use(
    '/api/v1/jobs',
    createProxyMiddleware({
      target: config.jobServiceBaseUrl,
      changeOrigin: true,
    }),
  );

  app.get('/api/v1/health', createProxyMiddleware({
    target: config.jobServiceBaseUrl,
    changeOrigin: true,
  }));

  app.use(
    ['/api/v1/scheduler', '/api/v1/scheduler-health'],
    createProxyMiddleware({
      target: config.schedulerServiceBaseUrl,
      changeOrigin: true,
    }),
  );

  app.use(
    ['/api/v1/executor', '/api/v1/executor-health'],
    createProxyMiddleware({
      target: config.executorServiceBaseUrl,
      changeOrigin: true,
    }),
  );

  app.get('/actuator/gateway', (_req, res) => {
    res.json({
      routes: [
        { id: 'job-service', target: config.jobServiceBaseUrl },
        { id: 'scheduler-service', target: config.schedulerServiceBaseUrl },
        { id: 'executor-service', target: config.executorServiceBaseUrl },
      ],
    });
  });

  app.use(errorHandler);

  const server = app.listen(config.port, () => {
    console.log(`chrono-api-gateway listening on :${config.port}`);
  });

  const shutdown = async () => {
    server.close();
    await disconnectGateway();
    await shutdownTracing();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
