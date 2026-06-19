import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: Number(__ENV.VUS || 5),
  duration: __ENV.DURATION || "1m",
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<800"],
  },
};

const jobService = __ENV.JOB_SERVICE_URL || "http://localhost:8081";
const gateway = __ENV.GATEWAY_URL || "http://localhost:8080";
const targetUrl = __ENV.TARGET_URL || "https://httpbin.org/post";

function createTenant() {
  const name = `tenant-k6-${Math.random().toString(36).slice(2, 8)}`;
  const res = http.post(
    `${jobService}/api/v1/tenants`,
    JSON.stringify({ name }),
    { headers: { "Content-Type": "application/json" } }
  );
  check(res, { "tenant created": (r) => r.status === 201 });
  return JSON.parse(res.body).id;
}

function createKey(tenantId) {
  const res = http.post(`${jobService}/api/v1/tenants/${tenantId}/api-keys`);
  check(res, { "api key created": (r) => r.status === 201 });
  const parsed = JSON.parse(res.body);
  return `${parsed.keyId}:${parsed.keySecret}`;
}

export default function () {
  const tenantId = createTenant();
  const credential = createKey(tenantId);

  const createJobRes = http.post(
    `${gateway}/api/v1/jobs`,
    JSON.stringify({
      tenantId,
      name: "k6-smoke-job",
      cronExpression: "*/2 * * * *",
      targetUrl,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": credential,
      },
    }
  );
  check(createJobRes, { "job created via gateway": (r) => r.status === 201 });

  const listRes = http.get(`${gateway}/api/v1/jobs?tenantId=${tenantId}`, {
    headers: { "X-API-Key": credential },
  });
  check(listRes, { "job list succeeded": (r) => r.status === 200 });

  sleep(1);
}
