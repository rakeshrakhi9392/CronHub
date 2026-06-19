#!/usr/bin/env python3

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request


def env(name: str, default: str) -> str:
    return os.environ.get(name, default)


JOB_SERVICE_URL = env("JOB_SERVICE_URL", "http://localhost:8081")
GATEWAY_URL = env("GATEWAY_URL", "http://localhost:8080")
TENANT_NAME = env("TENANT_NAME", f"demo-tenant-{int(time.time())}")
JOB_NAME = env("JOB_NAME", "demo-job")
CRON_EXPR = env("CRON_EXPR", "*/2 * * * *")
TARGET_URL = env("TARGET_URL", "https://httpbin.org/post")

CONNECT_TIMEOUT_SECONDS = 3
MAX_RETRIES = 2


def request_json(method: str, url: str, headers: dict[str, str] | None = None, payload: dict | None = None):
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    req_headers = {"Content-Type": "application/json"} if payload is not None else {}
    if headers:
        req_headers.update(headers)

    last_error = None
    for attempt in range(1, MAX_RETRIES + 1):
        req = urllib.request.Request(url=url, method=method, headers=req_headers, data=body)
        try:
            with urllib.request.urlopen(req, timeout=CONNECT_TIMEOUT_SECONDS) as resp:
                raw = resp.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, json.JSONDecodeError) as exc:
            last_error = exc
            if attempt < MAX_RETRIES:
                time.sleep(1)

    raise RuntimeError(f"Request failed after retries: {method} {url} ({last_error})")


def main() -> int:
    print("== ChronoFlow E2E ==")
    print(f"Job service: {JOB_SERVICE_URL}")
    print(f"Gateway:     {GATEWAY_URL}")
    print()

    print("1) Creating tenant in job-service...")
    tenant = request_json(
        "POST",
        f"{JOB_SERVICE_URL}/api/v1/tenants",
        payload={"name": TENANT_NAME},
    )
    tenant_id = tenant.get("id")
    if not tenant_id:
        print(f"Tenant create failed. Raw response: {tenant}")
        return 1
    print(f"Tenant ID: {tenant_id}")

    print("2) Creating API key in job-service...")
    key = request_json("POST", f"{JOB_SERVICE_URL}/api/v1/tenants/{tenant_id}/api-keys")
    key_id = key.get("keyId")
    key_secret = key.get("keySecret")
    if not key_id or not key_secret:
        print(f"API key create failed. Raw response: {key}")
        return 1
    api_credential = f"{key_id}:{key_secret}"
    print(f"API key created: {key_id}")

    print("3) Creating job via gateway (authenticated + rate limited path)...")
    job = request_json(
        "POST",
        f"{GATEWAY_URL}/api/v1/jobs",
        headers={"X-API-Key": api_credential},
        payload={
            "tenantId": tenant_id,
            "name": JOB_NAME,
            "cronExpression": CRON_EXPR,
            "targetUrl": TARGET_URL,
        },
    )
    job_id = job.get("id")
    if not job_id:
        print("Job create failed or timed out. Raw response:")
        print(json.dumps(job))
        return 1
    print(f"Job ID: {job_id}")

    print("4) Listing jobs via gateway...")
    query = urllib.parse.urlencode({"tenantId": tenant_id})
    jobs = request_json(
        "GET",
        f"{GATEWAY_URL}/api/v1/jobs?{query}",
        headers={"X-API-Key": api_credential},
    )
    if not isinstance(jobs, list):
        print(f"Unexpected list jobs response: {jobs}")
        return 1
    print(f"Jobs returned: {len(jobs)}")

    print()
    print("E2E done.")
    print("Trace verification:")
    print("- Open Jaeger: http://localhost:16686")
    print("- Search service: chrono-api-gateway")
    print("- You should see traces flowing into chrono-job-service")
    print()
    print("Useful exported value for manual calls:")
    print(f"X-API-Key: {api_credential}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
