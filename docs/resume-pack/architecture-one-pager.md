# ChronoFlow Architecture One-Pager

## Problem
ChronoFlow provides cron-based job scheduling as a platform service with multi-tenant isolation, reliable execution, and observability.

## Core Design
- **Gateway** (Node.js/Express): API key auth, tenant-aware rate limiting, audit stream
- **Job service** (Node.js/Express + Sequelize): tenant/job APIs + Kafka event emission
- **Auth service** (Node.js/Express): key validation and lifecycle operations (list/revoke/rotate)
- **Scheduler service** (Node.js): Redis schedule index + due-event publishing via Kafka
- **Executor service** (Node.js): webhook delivery, retries, DLQ, idempotency records
- **Mobile admin** (Expo React Native): operator console replacing static HTML demo
- **Infra**: Kafka + Redis + PostgreSQL + OTel + Jaeger + Prometheus + Grafana

## Reliability Patterns
- Execution idempotency via `executionId` and persisted execution records
- Exponential backoff retries with durable retry state
- DLQ publishing for terminal failures
- Sequelize models aligned with original Flyway schema

## Security and Platform Controls
- Non-root/read-only containers and dropped capabilities
- Namespace network policies with gateway ingress exception
- Kubernetes probes, resource limits, and HPA scaling

## Deployment Model
- Docker Compose for local full-stack runtime
- Kubernetes manifests (`k8s/base`) for baseline deployment
- Helm chart (`helm/chronoflow`) for environment-specific releases
- GitHub Actions CI/CD: TypeScript build + GHCR image publish
