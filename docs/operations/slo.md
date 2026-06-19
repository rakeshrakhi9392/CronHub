# ChronoFlow SLOs

## Scope
These SLOs apply to the production deployment of ChronoFlow core paths:
- API gateway request handling
- scheduled execution dispatch
- webhook delivery reliability

## SLI Definitions

### 1) Gateway Availability (request success ratio)
- **SLI**: `1 - (5xx responses / total responses)` for `chrono-api-gateway`
- **Target SLO**: **99.9%** over rolling 30 days
- **Error budget**: 0.1% of requests

### 2) Job Execution Success Ratio
- **SLI**: `(successful executions) / (total executions triggered)`
- **Target SLO**: **99.5%** over rolling 30 days
- Includes retries before DLQ.

### 3) Execution Latency (dispatch-to-attempt)
- **SLI**: p95 latency from scheduled trigger timestamp to first executor attempt
- **Target SLO**: **p95 < 60s**
- Measured from event timestamps and executor metrics.

## Alerting Thresholds (fast detection)
- Gateway 5xx ratio > 5% for 5m -> warning
- Executor failure ratio > 5% for 5m -> warning
- (Recommended next) execution latency p95 > 60s for 10m -> warning

## Operational Notes
- SLO violations should trigger incident review and remediation plan.
- Monthly SLO review should include budget burn trend, top causes, and corrective actions.
