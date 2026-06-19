import express from 'express';
import {
  SERVICE_PORTS,
  errorHandler,
  loadConfig,
  registerHealthRoutes,
  initTracing,
  shutdownTracing,
} from '@chronoflow/shared';
import { SchedulerRuntime } from './scheduler.js';

const config = loadConfig('chrono-scheduler-service', SERVICE_PORTS.scheduler);
process.env.SERVICE_NAME = config.serviceName;

async function main() {
  await initTracing(config.serviceName, config.otlpEndpoint);
  const runtime = new SchedulerRuntime(
    config.kafkaBrokers,
    config.redisUrl,
    config.schedulerPollIntervalMs,
  );
  await runtime.start();

  const app = express();
  registerHealthRoutes(app, 'chrono-scheduler-service is up');
  app.use(errorHandler);

  const server = app.listen(config.port, () => {
    console.log(`chrono-scheduler-service listening on :${config.port}`);
  });

  const shutdown = async () => {
    server.close();
    await runtime.stop();
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
