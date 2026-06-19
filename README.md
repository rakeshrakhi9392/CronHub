# CronHub

CronHub is a distributed job scheduler platform (Cron-as-a-Service) designed with industry-ready architecture.

## Tech Stack

- Node.js 22 + TypeScript + Express
- PostgreSQL (source of truth, Sequelize ORM; execution idempotency records)
- Redis (schedule index, gateway rate limits)
- Kafka (execution/event backbone)
- Expo React Native (mobile admin app)
- Docker Compose (local runtime)
- OpenTelemetry + Jaeger + Prometheus + Grafana (observability)
- Kubernetes + Helm (deployment)
- Python 3 (E2E + chaos scripts), k6 (load tests)

## Modules

- `packages/shared`: shared types, config, cron utilities, metrics, and tracing
- `packages/db`: Sequelize models and SQL init script
- `services/job-service`: tenant and job APIs, Kafka job-created events
- `services/auth-service`: dedicated API key validation and key lifecycle management
- `services/scheduler-service`: consumes job-created events, stores schedule index in Redis, publishes due execution events
- `services/executor-service`: consumes execute events, performs webhook calls, pushes retry/DLQ events
- `services/api-gateway`: central entrypoint with API key auth, Redis rate limiting, and service routing
- `apps/mobile`: Expo admin app for tenant, API key, and job management

Internal package, database, and Helm identifiers still use the legacy `chronoflow` / `chrono-*` names from the original scaffold (for example `@chronoflow/job-service`, database `chronoflow`, chart `helm/chronoflow`).

## Run Local Infrastructure

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

This starts Postgres, Redis, Kafka, Jaeger, OTel collector, Grafana, and Prometheus. Application services run on the host via npm.

## On-demand Web Demo with GitHub Codespaces

Use this when you want a public link only during interviews and shut it down afterwards.

### 1) Start a Codespace

- Open the repository on GitHub.
- Click `Code` -> `Codespaces` -> `Create codespace on main`.
- Wait for container setup to finish.

### 2) Boot full stack inside Codespace

```bash
python3 scripts/codespaces_start.py
psql postgresql://chronoflow:chronoflow@localhost:5432/chronoflow \
  -f packages/db/sql/init.sql
```

Then verify:

```bash
curl -s http://localhost:8080/actuator/health
python3 scripts/e2e.py
```

### 3) Create a public resume link

- In Codespaces, open the `Ports` tab.
- For port `8080`, set visibility to `Public`.
- Copy the forwarded URL (example: `https://<name>-8080.app.github.dev`).
- Use this as your demo/deployment link (for example `.../actuator/health`).

### 4) Optional public observability links

- Port `16686` (Jaeger)
- Port `3000` (Grafana)

You can temporarily set these to `Public` during demos, then set back to `Private`.

### 5) Shut down after interview

```bash
python3 scripts/codespaces_stop.py
```

Then stop or delete the Codespace in GitHub UI to avoid usage charges beyond free quota.

Observability UIs:

- Jaeger: `http://localhost:16686`
- Grafana: `http://localhost:3000` (admin/admin)
- Prometheus: `http://localhost:9090`

Provisioned observability assets:

- Grafana datasources: Prometheus + Jaeger (auto-configured)
- Grafana dashboard: `CronHub Overview`
- Prometheus alert rules: gateway 5xx ratio and executor 5xx ratio

## Build

Requires Node.js 22 (`nvm use` reads `.nvmrc`).

```bash
npm install
npm run build
```

Initialize PostgreSQL schema on a fresh database:

```bash
docker compose -f infra/docker/docker-compose.yml up -d postgres
psql postgresql://chronoflow:chronoflow@localhost:5432/chronoflow \
  -f packages/db/sql/init.sql
```

## Run Job Service

```bash
npm run dev:job
```

Health check (`/api/v1/health` and `/actuator/health` both work):

```bash
curl http://localhost:8081/api/v1/health
```

## Run Scheduler Service

```bash
npm run dev:scheduler
```

Health check (`/api/v1/health` and `/actuator/health` both work):

```bash
curl http://localhost:8082/api/v1/health
```

## Run Auth Service

```bash
npm run dev:auth
```

Health check (`/api/v1/health` and `/actuator/health` both work):

```bash
curl http://localhost:8084/actuator/health
```

## Run Executor Service

```bash
npm run dev:executor
```

Health check (`/api/v1/health` and `/actuator/health` both work):

```bash
curl http://localhost:8083/api/v1/health
```

## Run API Gateway

```bash
npm run dev:gateway
```

Health check (`/api/v1/health` and `/actuator/health` both work):

```bash
curl http://localhost:8080/actuator/health
```

## Mobile Admin App

The Expo app replaces the old `/demo/index.html` flow. It can:

- create tenant
- create API key
- create job via gateway auth path
- list jobs via gateway

```bash
npm run dev:mobile
```

For physical devices, point at your LAN IP:

```bash
EXPO_PUBLIC_GATEWAY_URL=http://<your-lan-ip>:8080 \
EXPO_PUBLIC_JOB_SERVICE_URL=http://<your-lan-ip>:8081 \
npm run dev:mobile
```

## End-to-End Smoke Script

After all services are running locally, execute:

```bash
python3 scripts/e2e.py
```

This script creates a tenant, creates an API key, creates a job through the gateway, and lists jobs through the gateway to generate traces for Jaeger.

Optional env overrides: `GATEWAY_URL`, `JOB_SERVICE_URL`, `TENANT_NAME`, `JOB_NAME`, `CRON_EXPR`, `TARGET_URL`.

## How to Evaluate This Project

Use this quick checklist to evaluate CronHub in 10-15 minutes.

### 1) Start infrastructure

```bash
docker compose -f infra/docker/docker-compose.yml up -d
docker compose -f infra/docker/docker-compose.yml ps
```

Expected evidence:

- Postgres, Redis, Kafka, OTel collector, Jaeger, Grafana, Prometheus are up.

### 2) Build and initialize database

```bash
npm install
npm run build
psql postgresql://chronoflow:chronoflow@localhost:5432/chronoflow \
  -f packages/db/sql/init.sql
```

Expected evidence:

- All TypeScript workspaces compile without errors.
- Database schema is applied.

### 3) Start services (separate terminals)

```bash
npm run dev:job
npm run dev:auth
npm run dev:scheduler
npm run dev:executor
npm run dev:gateway
```

Expected evidence:

- Health endpoints return 200 for ports 8080-8084.

### 4) Run end-to-end flow

```bash
python3 scripts/e2e.py
```

Expected evidence:

- Tenant created
- API key created
- Job created via gateway
- Job list returned successfully

### 5) Verify observability

- Open Jaeger: `http://localhost:16686`
  - Search for `chrono-api-gateway` traces
- Open Grafana: `http://localhost:3000`
  - Dashboard: `CronHub Overview`
- Open Prometheus: `http://localhost:9090`
  - Confirm scrape targets for `chrono-*` jobs (services must be running on the host; Prometheus scrapes via Docker bridge)

Expected evidence:

- Trace spans across gateway and downstream service
- Throughput/5xx panels populated

### 6) Validate reliability behavior (Kubernetes only)

Requires a running Kubernetes deployment with the executor service installed. The script kills the executor pod and prints recovery checks — it does not auto-assert DLQ or retry metrics.

```bash
NAMESPACE=chronoflow python3 chaos/executor_kill_recovery.py
```

Expected evidence:

- Executor pod is deleted and a replacement pod becomes Running/Ready
- Manual follow-up: retry/DLQ metrics in Grafana/Prometheus look healthy

### 7) Validate deployment assets

```bash
kubectl kustomize k8s/base >/dev/null && echo "kustomize-ok"
helm template chronoflow helm/chronoflow >/dev/null && echo "helm-ok"
```

Expected evidence:

- Kubernetes baseline renders
- Helm chart renders cleanly

### Reviewer Evidence Checklist

- [ ] E2E script succeeds
- [ ] Gateway auth/rate-limit path exercised
- [ ] Jaeger trace visible
- [ ] Grafana metrics dashboard visible
- [ ] Chaos recovery script runs against a Kubernetes executor pod (optional; local Docker Compose only)
- [ ] k8s and Helm manifests render

## Kubernetes Baseline

Base manifests are available under `k8s/base` for:

- namespace, configmap, secret
- job-service, auth-service, scheduler-service, executor-service, api-gateway
- health probes, resource requests/limits, and HPAs
- network policies + non-root/read-only security context hardening

Apply with:

```bash
kubectl apply -k k8s/base
```

Notes:

- Update container image names/tags before applying in your cluster.
- These manifests assume external Kafka/Redis/Postgres services are reachable in-cluster as `kafka`, `redis`, and `postgres`.
- Ingress for `chronoflow.local` is configured via the Helm chart (`helm/chronoflow`).

## Database Schema

Schema is managed via a SQL init script (ported from the original Flyway migrations).

- Init script: `packages/db/sql/init.sql`
- Sequelize models: `packages/db/src/models.ts`
- Local connection default: `postgresql://chronoflow:chronoflow@localhost:5432/chronoflow`

Typical local run:

```bash
psql postgresql://chronoflow:chronoflow@localhost:5432/chronoflow \
  -f packages/db/sql/init.sql
npm run dev:job
```

The executor service persists execution records for idempotency and scheduled retries with backoff.

## Helm Chart

A Helm chart is available at `helm/chronoflow`.

Render manifests:

```bash
helm template chronoflow helm/chronoflow
```

Install in namespace:

```bash
helm upgrade --install chronoflow helm/chronoflow --namespace chronoflow --create-namespace
```

Security defaults in Helm:

- Pod/container runs as non-root (`runAsNonRoot`, explicit UID/GID)
- `allowPrivilegeEscalation: false`
- `readOnlyRootFilesystem: true`
- dropped Linux capabilities (`ALL`)
- namespace ingress hardening via NetworkPolicy templates

## Performance and Chaos Testing

Load scripts:

- `perf/k6/smoke-flow.js` (full API smoke flow under load)
- `perf/k6/gateway-soak.js` (sustained gateway read traffic)

Examples:

```bash
k6 run perf/k6/smoke-flow.js
```

```bash
TENANT_ID=<tenant-id> API_KEY=<keyId:keySecret> k6 run perf/k6/gateway-soak.js
```

Chaos script (Kubernetes only):

- `chaos/executor_kill_recovery.py` (kills executor pod; manual recovery verification via kubectl/Grafana)

Benchmark results template:

- `docs/benchmarks/results-template.md`

## Test Stack

| Layer | Tool | Location | What it validates |
|---|---|---|---|
| CI build | GitHub Actions, `npm run build` | `.github/workflows/ci.yml` | TypeScript compiles across all workspaces |
| Manifest validation | `kubectl kustomize`, `helm template` | `.github/workflows/ci.yml` | Kubernetes and Helm configs render cleanly |
| E2E / integration | Python 3 (stdlib) | `scripts/e2e.py` | Tenant → API key → job create → list via gateway |
| Load / performance | k6 | `perf/k6/` | Throughput, latency thresholds under concurrent users |
| Chaos / resilience | Python 3 + `kubectl` | `chaos/executor_kill_recovery.py` | Executor pod kill on Kubernetes; manual recovery verification |
| Health checks | `curl` | service endpoints | Per-service liveness during manual verification |

## Operations Docs

- SLO definitions: `docs/operations/slo.md`
- Incident/ops runbook: `docs/operations/runbook.md`
- Incident review template: `docs/operations/incident-template.md`

## Resume Pack

- Architecture one-pager: `docs/resume-pack/architecture-one-pager.md`
- Resume bullet templates: `docs/resume-pack/resume-bullets.md`
- Demo script (2 minutes): `docs/resume-pack/demo-script-2min.md`

## Release Governance

- Versioning strategy: `docs/release/versioning-strategy.md`
- Changelog template: `docs/release/changelog-template.md`
- Release runbook: `docs/release/release-runbook.md`

## Final Readiness

- Production-readiness closeout checklist: `docs/final-readiness-checklist.md`

## CI/CD

GitHub Actions workflows are included:

- `.github/workflows/ci.yml`
  - Runs on PRs and pushes to `main`
  - Executes `npm ci` and `npm run build`
  - Validates k8s manifests with `kubectl kustomize`
  - Validates Helm chart with `helm template`

- `.github/workflows/release-deploy.yml`
  - On push to `main`: builds and pushes service images to GHCR via Docker
  - On manual dispatch: deploys Helm chart to Kubernetes

Build a service image locally:

```bash
docker build -f infra/docker/Dockerfile.node-service \
  --build-arg SERVICE_PACKAGE=@chronoflow/job-service \
  --build-arg SERVICE_PATH=services/job-service \
  -t chrono-job-service .
```

Required repo configuration:

- GitHub Packages permissions enabled for workflow token (`packages: write`)
- Repository secret: `KUBE_CONFIG_DATA` (base64 encoded kubeconfig) for deploy job

Recommended branch protection for `main`:

- Require pull request reviews
- Require status checks to pass (`CI / Build and Test`)
- Restrict direct pushes
