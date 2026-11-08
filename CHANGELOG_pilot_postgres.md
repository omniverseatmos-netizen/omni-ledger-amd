# Pilot PostgreSQL adapter (on top of v3.1.0)
- Added `pilot-postgres.mjs` (`PERSISTENCE=postgres`): snapshot in `pilot_state` JSONB, BEGIN + SET LOCAL lock/statement timeouts + SELECT ... FOR UPDATE + version bump + COMMIT, retry on 40001/40P01, lock timeout -> 409.
- `pg` is imported dynamically: file mode keeps zero dependencies. Docker image installs it via build arg `INSTALL_PG=1`.
- `login` verifies the scrypt hash outside the state lock.
- Schema: added `pilot_state`. `.gitignore`: added `.pilot/`.
- Tests: 3 unit tests (mock pool) + 2 integration tests (real PostgreSQL, run with `npm run test:postgres`).
- Verified: PostgreSQL 16, 30 concurrent transactions without lost update, full rollback on error, HTTP bootstrap/login persisted, 100 concurrent logins with zero lost updates.
- NOT verified: k6 distributed load, normalized tables, OIDC, backup/restore drill. No LICENSE file yet (owner decision).
