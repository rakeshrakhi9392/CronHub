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
import { disconnectKafka } from './kafka.js';

const config = loadConfig('chrono-job-service', SERVICE_PORTS.job);
process.env.SERVICE_NAME = config.serviceName;

async function main() {
  await initTracing(config.serviceName, config.otlpEndpoint);
  await getSequelize(config.databaseUrl);

  const app = express();
  app.use(express.json());

  registerHealthRoutes(app, 'chrono-job-service is up');
  app.use('/api/v1', createRouter(config.kafkaBrokers));
  app.use(errorHandler);

  const server = app.listen(config.port, () => {
    console.log(`chrono-job-service listening on :${config.port}`);
  });

  const shutdown = async () => {
    server.close();
    await disconnectKafka();
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
