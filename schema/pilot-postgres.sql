-- AtMoS Pilot reference schema (PostgreSQL 15+)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE TABLE IF NOT EXISTS tenants (
  id text PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES tenants(id),
  email citext NOT NULL,
  display_name text NOT NULL,
  password_hash text,
  external_subject text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email),
  UNIQUE (tenant_id, external_subject)
);
CREATE TABLE IF NOT EXISTS roles (id text PRIMARY KEY, description text NOT NULL);
CREATE TABLE IF NOT EXISTS permissions (id text PRIMARY KEY, description text NOT NULL);
CREATE TABLE IF NOT EXISTS user_roles (tenant_id text NOT NULL REFERENCES tenants(id), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, role_id text NOT NULL REFERENCES roles(id), PRIMARY KEY (tenant_id, user_id, role_id));
CREATE TABLE IF NOT EXISTS role_permissions (role_id text NOT NULL REFERENCES roles(id) ON DELETE CASCADE, permission_id text NOT NULL REFERENCES permissions(id), PRIMARY KEY (role_id, permission_id));
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id text NOT NULL REFERENCES tenants(id), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS recalls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id text NOT NULL REFERENCES tenants(id), item_code text NOT NULL, batch text NOT NULL, warehouse_code text NOT NULL, status text NOT NULL, version bigint NOT NULL DEFAULT 0, data jsonb NOT NULL, UNIQUE (tenant_id, item_code, batch)
);
CREATE TABLE IF NOT EXISTS disposition_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id text NOT NULL REFERENCES tenants(id), recall_id uuid NOT NULL REFERENCES recalls(id), disposition text NOT NULL, status text NOT NULL,
  requested_by uuid NOT NULL REFERENCES users(id), approvals jsonb NOT NULL DEFAULT '[]', data jsonb NOT NULL, version bigint NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), executed_at timestamptz
);
CREATE TABLE IF NOT EXISTS idempotency_keys (
  tenant_id text NOT NULL REFERENCES tenants(id), key text NOT NULL, operation text NOT NULL, request_hash text NOT NULL, response jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (tenant_id, key, operation)
);
CREATE INDEX IF NOT EXISTS sessions_active_idx ON sessions (token_hash) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS disposition_queue_idx ON disposition_requests (tenant_id, status, created_at);

-- Canonical transaction for a disposition approval/execution:
-- BEGIN;
-- SELECT * FROM recalls WHERE tenant_id = $1 AND item_code = $2 AND batch = $3 FOR UPDATE;
-- SELECT * FROM disposition_requests WHERE tenant_id = $1 AND id = $2 FOR UPDATE;
-- INSERT INTO idempotency_keys (...) ON CONFLICT DO NOTHING;
-- Validate RBAC, version, and approval separation.
-- Apply ledger entries and update request in the same transaction.
-- COMMIT;
--
-- Never lock only the UI request: lock the recall row and all affected stock/allocation rows in a stable order.

-- Transitional snapshot store used by pilot-postgres.mjs (PERSISTENCE=postgres).
-- One row per tenant; every transaction locks the row with SELECT ... FOR UPDATE.
CREATE TABLE IF NOT EXISTS pilot_state (
  tenant_id text PRIMARY KEY,
  version bigint NOT NULL DEFAULT 0,
  state jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
