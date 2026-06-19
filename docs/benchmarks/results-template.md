# ChronoFlow Performance Results Template

## Environment
- Date:
- Commit SHA:
- Cluster / Machine:
- Services version tags:
- Test data profile:

## Test 1: Smoke Flow (`perf/k6/smoke-flow.js`)
- Command:
- VUs / Duration:
- Success rate:
- p50 / p95 / p99 latency:
- Notes:

## Test 2: Gateway Soak (`perf/k6/gateway-soak.js`)
- Command:
- Ramp users / Sustain users:
- Requests total:
- Error rate:
- p50 / p95 / p99 latency:
- Bottleneck observed:

## Chaos Test: Executor Kill Recovery (`chaos/executor_kill_recovery.py`)
- Command:
- Pod killed at timestamp:
- Recovery time to Ready:
- Retry backlog behavior:
- DLQ delta during event:
- Observed user impact:

## Summary
- Stable throughput ceiling:
- Recommended safe production limit:
- Key risks:
- Next tuning actions:
