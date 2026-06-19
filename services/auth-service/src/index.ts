import express from 'express';
import { getSequelize, closeSequelize } from '@chronoflow/db';
import {
  SERVICE_PORTS,
  errorHandler,
  loadConfig,
  registerHealthRoutes,
  initTracing,
  shutdownTracing,
} from '@chronoflow/shared';
import { createRouter } from './routes.js';

const config = loadConfig('chrono-auth-service', SERVICE_PORTS.auth);
process.env.SERVICE_NAME = config.serviceName;

async function main() {
  await initTracing(config.serviceName, config.otlpEndpoint);
  await getSequelize(config.databaseUrl);

  const app = express();
  app.use(express.json());

  registerHealthRoutes(app, 'chrono-auth-service is up');
  app.use(createRouter());
  app.use(errorHandler);

  const server = app.listen(config.port, () => {
    console.log(`chrono-auth-service listening on :${config.port}`);
  });

  const shutdown = async () => {
    server.close();
    await closeSequelize();
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
