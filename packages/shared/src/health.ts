import type { Express, Request, Response } from 'express';
import { baseApiResponse, nowIso } from './errors.js';
import { metricsContentType, metricsHandler } from './metrics.js';

export function registerHealthRoutes(app: Express, serviceMessage: string): void {
  app.get('/api/v1/health', (_req: Request, res: Response) => {
    res.json(baseApiResponse('OK', serviceMessage));
  });

  app.get('/actuator/health', (_req: Request, res: Response) => {
    res.json({ status: 'UP', groups: ['liveness', 'readiness'], timestamp: nowIso() });
  });

  app.get('/actuator/info', (_req: Request, res: Response) => {
    res.json({});
  });

  app.get('/actuator/prometheus', async (_req: Request, res: Response) => {
    const serviceName = process.env.SERVICE_NAME ?? 'chronoflow';
    res.set('Content-Type', metricsContentType(serviceName));
    res.send(await metricsHandler(serviceName));
  });
}
