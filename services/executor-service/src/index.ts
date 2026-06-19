import express from 'express';
import { closeSequelize } from '@chronoflow/db';
import {
  SERVICE_PORTS,
  errorHandler,
  loadConfig,
  registerHealthRoutes,
  initTracing,
  shutdownTracing,
} from '@chronoflow/shared';
import { ExecutionService } from './executor.js';

const config = loadConfig('chrono-executor-service', SERVICE_PORTS.executor);
process.env.SERVICE_NAME = config.serviceName;

async function main() {
  await initTracing(config.serviceName, config.otlpEndpoint);
  const runtime = new ExecutionService(config, config.databaseUrl);
  await runtime.start();

  const app = express();
  registerHealthRoutes(app, 'chrono-executor-service is up');
  app.use(errorHandler);

  const server = app.listen(config.port, () => {
    console.log(`chrono-executor-service listening on :${config.port}`);
  });

  const shutdown = async () => {
    server.close();
    await runtime.stop();
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
