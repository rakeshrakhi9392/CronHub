import { Registry, collectDefaultMetrics } from 'prom-client';

const registries = new Map<string, Registry>();

export function getMetricsRegistry(serviceName: string): Registry {
  let registry = registries.get(serviceName);
  if (!registry) {
    registry = new Registry();
    registry.setDefaultLabels({ service: serviceName });
    collectDefaultMetrics({ register: registry });
    registries.set(serviceName, registry);
  }
  return registry;
}

export async function metricsHandler(serviceName: string): Promise<string> {
  return getMetricsRegistry(serviceName).metrics();
}

export function metricsContentType(serviceName: string): string {
  return getMetricsRegistry(serviceName).contentType;
}
