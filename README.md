# ChronoFlow

ChronoFlow is a distributed job scheduler platform (Cron-as-a-Service) with production-oriented architecture.

## Tech Stack

**Application layer (RockED-aligned):**
- Node.js 22 + TypeScript
- Express.js (microservices)
- Sequelize (PostgreSQL ORM)
- Expo React Native (mobile admin app)

**Infrastructure (unchanged):**
- PostgreSQL (source of truth)
- Redis (schedule index, rate limits)
- Kafka (execution/event backbone)
- Docker Compose (local infra)
- Prometheus + Grafana + Jaeger (observability)
- Kubernetes + Helm (deployment)
- GitHub Actions + GHCR (CI/CD)

## Repository Layout

```
packages/
  shared/     # types, config, cron, metrics, tracing
  db/         # Sequelize models + SQL init script
services/
  job-service/        :8081  tenant + job APIs, Kafka producer
  auth-service/       :8084  internal API key validation
  scheduler-service/  :8082  Redis schedule index + due job publisher
  executor-service/   :8083  webhook delivery, retries, DLQ
  api-gateway/        :8080  auth, rate limit, audit, proxy
apps/
  mobile/             Expo admin app (replaces static HTML demo)
```

## Setup

Requires Node.js 22 (`nvm use` reads `.nvmrc`).

```bash
npm install
npm run build
```

Initialize PostgreSQL schema on a fresh database:

```bash
docker compose -f infra/docker/docker-compose.yml up -d postgres
psql postgresql://chronoflow:chronoflow@localhost:5432/chronoflow -f packages/db/sql/init.sql
```

## Run Local Infrastructure

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

This starts Postgres, Redis, Kafka, Jaeger, OTel collector, Grafana, and Prometheus. Application services run on the host via npm.

## Run All Node Services

In separate terminals (or use the Codespaces bootstrap script):

```bash
npm run dev:job
npm run dev:auth
npm run dev:scheduler
npm run dev:executor
npm run dev:gateway
```

Or boot everything in Codespaces:

```bash
python3 scripts/codespaces_start.py
```

Health checks:

```bash
curl http://localhost:8080/actuator/health   # gateway
curl http://localhost:8081/api/v1/health     # job-service
curl http://localhost:8082/api/v1/health     # scheduler-service
curl http://localhost:8083/api/v1/health     # executor-service
curl http://localhost:8084/actuator/health   # auth-service
```

## End-to-End Smoke Script

```bash
python3 scripts/e2e.py
```

Creates a tenant, API key, job through the gateway, and lists jobs. Python script is unchanged from the Java version.

## Expo Mobile Admin App

```bash
npm run dev:mobile
```

Set gateway URL for physical devices:

```bash
EXPO_PUBLIC_GATEWAY_URL=http://<your-lan-ip>:8080 \
EXPO_PUBLIC_JOB_SERVICE_URL=http://<your-lan-ip>:8081 \
npm run dev:mobile
```

Screens mirror the old `/demo/index.html` flow: create tenant, API key, job, and list jobs.

## On-demand Web Demo with GitHub Codespaces

```bash
python3 scripts/codespaces_start.py
curl -s http://localhost:8080/actuator/health
python3 scripts/e2e.py
```

Forward port `8080` as Public in the Codespaces Ports tab for interview demos.

Shut down:

```bash
python3 scripts/codespaces_stop.py
```

## Observability

- Jaeger: `http://localhost:16686`
- Grafana: `http://localhost:3000` (admin/admin)
- Prometheus: `http://localhost:9090`

Each Node service exposes `/actuator/prometheus` and exports traces to the OTel collector at `localhost:4318`.

## Docker Images (GHCR)

Build a service image from the repo root:

```bash
docker build -f infra/docker/Dockerfile.node-service \
  --build-arg SERVICE_PACKAGE=@chronoflow/job-service \
  --build-arg SERVICE_PATH=services/job-service \
  -t chrono-job-service .
```

GitHub Actions workflow `.github/workflows/release-deploy.yml` builds and pushes all five service images to GHCR on push to `main`.

## Kubernetes and Helm

Manifests under `k8s/base` and `helm/chronoflow` work with Node services. Environment variables support both Node names (`DATABASE_URL`, `KAFKA_BROKERS`, `REDIS_URL`) and legacy Spring names (`SPRING_DATASOURCE_URL`, etc.) for backward compatibility.

```bash
kubectl kustomize k8s/base
helm template chronoflow helm/chronoflow
```

## Performance and Chaos Testing

```bash
k6 run perf/k6/smoke-flow.js
NAMESPACE=chronoflow python3 chaos/executor_kill_recovery.py
```

## CI/CD

- `.github/workflows/ci.yml` — `npm ci`, `npm run build`, k8s/Helm validation
- `.github/workflows/release-deploy.yml` — Docker build/push to GHCR, optional Helm deploy

## Operations Docs

- SLO definitions: `docs/operations/slo.md`
- Incident/ops runbook: `docs/operations/runbook.md`
- Architecture one-pager: `docs/resume-pack/architecture-one-pager.md`
- Resume bullets: `docs/resume-pack/resume-bullets.md`
