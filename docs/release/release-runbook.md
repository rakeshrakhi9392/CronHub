# Release Runbook

## Pre-release checks
1. Confirm CI is green on `main`:
   - Build/test
   - k8s manifest validation
2. Confirm open incident status:
   - no unresolved Sev-1/Sev-2 affecting release scope
3. Confirm Flyway migration compatibility:
   - startup validation in staging successful
4. Update changelog from template.

## Release steps
1. Create release tag:
   - `git tag vX.Y.Z`
   - `git push origin vX.Y.Z`
2. Trigger release/deploy workflow:
   - select environment + namespace
3. Verify image publication in GHCR:
   - all service images tagged with release SHA
4. Helm deployment:
   - verify revision in target namespace

## Post-release verification
1. Smoke checks:
   - gateway health
   - auth validation
   - create/list job flow
2. Observe telemetry for 15-30 minutes:
   - 5xx ratio
   - executor failure/DLQ trend
   - p95 latency
3. Mark release as successful in changelog/release notes.

## Rollback
1. Identify last stable release tag.
2. Re-run deploy workflow with previous image tags.
3. Verify rollback smoke checks.
4. Open incident review if rollback required.
