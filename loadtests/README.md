# Distributed k6 / PostgreSQL test

This is a controlled, non-production test. Start PostgreSQL and the API with the normalized projection enabled, seed a short-lived OIDC-issued token, then run at least three API replicas behind the internal service name:

```bash
mkdir -p results deploy/secrets
a=$(openssl rand -base64 32); printf '%s' "$a" > deploy/secrets/postgres_password.txt
set -a; . deploy/.env.example; set +a
# Replace secrets and DATABASE_URL before running.
docker compose -f deploy/compose.postgres.yml up -d --build --scale pilot-api=3 postgres pilot-api
# k6 is intentionally opt-in and must use a disposable database.
docker compose -f deploy/compose.postgres.yml --profile loadtest run --rm \
  -e BASE_URL=http://pilot-api:4180 -e PILOT_TOKEN="$PILOT_TOKEN" \
  -e RECALL_BATCHES="$RECALL_BATCHES" run /scripts/distributed-recall.js
```

Acceptance gates: HTTP error rate below 1%, p95 below 500 ms, p99 below 1 s, business success above 99%, and no unexpected tenant-crossing rows. During the run collect `pg_stat_activity`, lock waits, transactions per second, CPU, memory, IOPS, and connection-pool saturation from PostgreSQL/host monitoring. k6 alone cannot prove database CPU/IOPS or replica lag.

Run a baseline, a ramp, a steady-state hold, and a recovery period. Archive `results/k6-distributed-summary.json`, the exact environment variables excluding secrets, PostgreSQL metrics, git/package hash, and the schema parity result. Do not run this against production or real patient/customer data.
