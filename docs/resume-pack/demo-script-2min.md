# ChronoFlow Demo Script (2 Minutes)

## Goal
Show end-to-end reliability + observability in under 2 minutes.

## Prerequisites
- Infra stack running (`docker compose -f infra/docker/docker-compose.yml up -d`)
- Services running locally (job/auth/scheduler/executor/gateway)

## Script

### 0:00 - 0:20 (Architecture snapshot)
- Open `docs/resume-pack/architecture-one-pager.md`
- Explain service responsibilities in one sentence each.

### 0:20 - 0:50 (E2E flow)
- Run:
  - `python3 scripts/e2e.py`
- Highlight output:
  - tenant created
  - API key created
  - job created via gateway

### 0:50 - 1:20 (Observability)
- Open Jaeger (`http://localhost:16686`)
  - show trace from `chrono-api-gateway` to downstream service
- Open Grafana (`http://localhost:3000`)
  - show `ChronoFlow Overview` dashboard

### 1:20 - 1:45 (Reliability/chaos)
- Run:
  - `NAMESPACE=chronoflow python3 chaos/executor_kill_recovery.py`
- Explain that retries are persisted in DB and recover after pod restart.

### 1:45 - 2:00 (Production readiness close)
- Mention:
  - Flyway migrations
  - k8s probes/HPA/security context/network policies
  - CI/CD and Helm release workflow

## Q&A Pivots
- How retries are idempotent (`executionId`)
- How auth is decoupled (`chrono-auth-service`)
- How SLOs and alerts map to runbooks (`docs/operations/*`)
