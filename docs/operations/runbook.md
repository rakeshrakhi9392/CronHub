# ChronoFlow Runbook

## 1) Gateway 5xx spike
### Symptoms
- Alert `HighGateway5xxRate` fires
- Elevated 5xx in Grafana `ChronoFlow Overview`

### Checks
1. Check gateway pod health and restarts:
   - `kubectl get pods -n chronoflow -l app=chrono-api-gateway`
2. Check downstream service health:
   - `chrono-auth-service`, `chrono-job-service`
3. Inspect gateway logs for routing/auth errors.

### Mitigation
- Roll restart gateway deployment if config drift suspected.
- Scale gateway replicas up temporarily (or let HPA react).
- If auth endpoint degraded, fail traffic early with explicit 503 + incident comms.

---

## 2) DLQ spike / executor failures
### Symptoms
- Executor failure alert fires
- Increase in events on `chronoflow.job.dlq.v1`

### Checks
1. Executor pod health:
   - `kubectl get pods -n chronoflow -l app=chrono-executor-service`
2. Executor logs for common failure class:
   - network timeout, DNS, target 5xx, malformed payload
3. Database retry backlog:
   - inspect `execution_record` rows in `RETRY_PENDING` and `DLQ`.

### Mitigation
- If target system outage: reduce pressure by lowering retry poll interval or pausing job source.
- If executor regression: rollback image to previous known good tag.
- Re-drive DLQ after fix (manual replay tooling recommended).

---

## 3) Migration startup failure
### Symptoms
- Service fails on boot during Flyway migration

### Checks
1. Review migration error from service logs.
2. Verify schema history table state (`flyway_schema_history`).
3. Validate migration script ordering and checksum.

### Mitigation
- Fix migration script in new versioned migration (do not edit applied migration in place).
- For emergency rollback, deploy previous app image with known schema compatibility.

---

## 4) Kafka connectivity issues
### Symptoms
- Scheduler not dispatching
- Executor consumers lagging/no consumption

### Checks
1. Kafka broker health and container logs
2. App connection errors in scheduler/executor logs
3. Topic availability and partition assignment

### Mitigation
- Restart broker if single-node local setup is unstable.
- Restart consumer deployments to force rejoin.
- Verify bootstrap server config in ConfigMap/Helm values.
