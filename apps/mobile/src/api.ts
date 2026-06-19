const JOB_SERVICE_URL =
  process.env.EXPO_PUBLIC_JOB_SERVICE_URL ?? 'http://localhost:8081';
const GATEWAY_URL = process.env.EXPO_PUBLIC_GATEWAY_URL ?? 'http://localhost:8080';

export interface TenantResponse {
  id: string;
  name: string;
  createdAt: string;
}

export interface CreateApiKeyResponse {
  keyId: string;
  keySecret: string;
}

export interface JobResponse {
  id: number;
  name: string;
  cronExpression: string;
  targetUrl: string;
  status: string;
  createdAt: string;
}

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function createTenant(name: string): Promise<TenantResponse> {
  const response = await fetch(`${JOB_SERVICE_URL}/api/v1/tenants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return parseJson(response);
}

export async function createApiKey(tenantId: string): Promise<CreateApiKeyResponse> {
  const response = await fetch(`${JOB_SERVICE_URL}/api/v1/tenants/${tenantId}/api-keys`, {
    method: 'POST',
  });
  return parseJson(response);
}

export async function createJob(
  apiKey: string,
  payload: {
    tenantId: string;
    name: string;
    cronExpression: string;
    targetUrl: string;
  },
): Promise<JobResponse> {
  const response = await fetch(`${GATEWAY_URL}/api/v1/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    },
    body: JSON.stringify(payload),
  });
  return parseJson(response);
}

export async function listJobs(apiKey: string, tenantId: string): Promise<JobResponse[]> {
  const response = await fetch(`${GATEWAY_URL}/api/v1/jobs?tenantId=${tenantId}`, {
    headers: { 'X-API-Key': apiKey },
  });
  return parseJson(response);
}
