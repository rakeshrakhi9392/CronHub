# ChronoFlow Versioning Strategy

## Semantic Versioning
ChronoFlow follows `MAJOR.MINOR.PATCH`.

- **MAJOR**: incompatible API or contract changes
- **MINOR**: backward-compatible features
- **PATCH**: bug fixes, docs, internal improvements

## Tagging Convention
- Git tag format: `vX.Y.Z` (example: `v1.2.0`)
- Image tag format:
  - immutable: commit SHA (already used in release workflow)
  - mutable: `latest` for convenience in non-prod

## Release Cadence
- Planned: weekly or bi-weekly minor releases
- Hotfix: patch release as-needed with incident linkage

## Branch Rules
- `main` is always releasable.
- Production release requires:
  - CI green
  - manual workflow dispatch with target environment
  - changelog section prepared
