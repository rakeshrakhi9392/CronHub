import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "2m", target: Number(__ENV.RAMP_USERS || 20) },
    { duration: "5m", target: Number(__ENV.SUSTAIN_USERS || 20) },
    { duration: "2m", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.03"],
    http_req_duration: ["p(95)<1000", "p(99)<1500"],
  },
};

const gateway = __ENV.GATEWAY_URL || "http://localhost:8080";
const tenantId = __ENV.TENANT_ID;
const apiKey = __ENV.API_KEY;

if (!tenantId || !apiKey) {
  throw new Error("TENANT_ID and API_KEY env vars are required");
}

export default function () {
  const res = http.get(`${gateway}/api/v1/jobs?tenantId=${tenantId}`, {
    headers: { "X-API-Key": apiKey },
  });

  check(res, {
    "gateway returns 200": (r) => r.status === 200,
  });

  sleep(0.3);
}
