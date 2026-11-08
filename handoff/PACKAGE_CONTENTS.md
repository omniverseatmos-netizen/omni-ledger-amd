# AtMoS Workshop Complete Package

This package is the authoritative handoff for the private AtMoS development track.

## Included

- Complete current AtMoS Pilot source tree.
- Stage 1 hardening: production secret fail-fast, pinned PostgreSQL dependency, safe 5xx responses.
- Stage 2 normalized PostgreSQL projection with dual-write migration.
- Schema files, migration command, Dockerfile, Compose deployment, load-test scaffolding, CI workflow, tests, fixtures, UI, CLI and documentation.
- Release manifest and inventory generated from the included source tree.
- Arabic comprehensive audit report in `handoff/ATMOS_COMPREHENSIVE_AUDIT_AR.md`.
- Current final status and CI evidence in `handoff/FINAL_HANDOFF_STATUS_AR.md`.

## Authoritative operation

The private repository is the source of truth:
https://github.com/omniverseatmos-netizen/omniverse-atmos

The competition repository `omni-ledger-amd` is separate and is not part of this development track.

## First run

```bash
npm ci
npm test
npm run verify:release
```

For PostgreSQL:

```bash
export DATABASE_URL="postgresql://..."
npm run db:migrate
NORMALIZED_REPOSITORY=1 npm run pilot:serve
```

The normalized projection is dual-write during migration. Do not remove `pilot_state` until parity, restore and tenant-isolation evidence are accepted.

## Deliberate exclusions

`node_modules/`, `.git/`, local state files, API keys, private credentials, and machine-specific temporary files are excluded. No live AMD key is included.
