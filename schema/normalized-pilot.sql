-- AtMoS normalized projection, v3.2.
-- Every entity key is tenant-scoped. Keep pilot_state during dual-write migration.

CREATE TABLE IF NOT EXISTS pilot_users (
  tenant_id TEXT NOT NULL,
  id TEXT NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  tenant_id_record TEXT NOT NULL,
  password_hash TEXT,
  external_subject TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  data JSONB NOT NULL,
  PRIMARY KEY (tenant_id, id),
  CONSTRAINT pilot_users_tenant_match CHECK (tenant_id = tenant_id_record),
  UNIQUE (tenant_id, email),
  UNIQUE (tenant_id, external_subject)
);

CREATE TABLE IF NOT EXISTS pilot_sessions (
  tenant_id TEXT NOT NULL,
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  data JSONB NOT NULL,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, user_id) REFERENCES pilot_users(tenant_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pilot_recalls (
  tenant_id TEXT NOT NULL,
  id TEXT NOT NULL,
  item_code TEXT NOT NULL,
  batch TEXT NOT NULL,
  warehouse_code TEXT,
  status TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  data JSONB NOT NULL,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, item_code, batch)
);

CREATE TABLE IF NOT EXISTS pilot_dispositions (
  tenant_id TEXT NOT NULL,
  id TEXT NOT NULL,
  recall_id TEXT NOT NULL,
  disposition TEXT NOT NULL,
  status TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  executed_at TIMESTAMPTZ,
  data JSONB NOT NULL,
  PRIMARY KEY (tenant_id, id),
  FOREIGN KEY (tenant_id, recall_id) REFERENCES pilot_recalls(tenant_id, id),
  FOREIGN KEY (tenant_id, requested_by) REFERENCES pilot_users(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS pilot_disposition_approvals (
  tenant_id TEXT NOT NULL,
  id TEXT NOT NULL,
  disposition_id TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  role TEXT NOT NULL,
  decision TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  data JSONB NOT NULL,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, disposition_id, role),
  UNIQUE (tenant_id, disposition_id, actor_id),
  FOREIGN KEY (tenant_id, disposition_id) REFERENCES pilot_dispositions(tenant_id, id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id, actor_id) REFERENCES pilot_users(tenant_id, id)
);

CREATE TABLE IF NOT EXISTS pilot_ledger_events (
  tenant_id TEXT NOT NULL,
  id TEXT NOT NULL,
  sequence_no BIGINT NOT NULL,
  event_hash TEXT NOT NULL,
  previous_hash TEXT NOT NULL,
  event_type TEXT NOT NULL,
  source_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  data JSONB NOT NULL,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, sequence_no),
  UNIQUE (tenant_id, event_hash)
);

CREATE TABLE IF NOT EXISTS pilot_audit_events (
  tenant_id TEXT NOT NULL,
  id TEXT NOT NULL,
  sequence_no BIGINT NOT NULL,
  event_hash TEXT NOT NULL,
  previous_hash TEXT NOT NULL,
  event_type TEXT NOT NULL,
  source_id TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  data JSONB NOT NULL,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, sequence_no),
  UNIQUE (tenant_id, event_hash)
);

CREATE TABLE IF NOT EXISTS pilot_idempotency_keys (
  tenant_id TEXT NOT NULL,
  id TEXT NOT NULL,
  operation TEXT NOT NULL,
  key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  data JSONB NOT NULL,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, operation, key)
);

CREATE INDEX IF NOT EXISTS pilot_sessions_active_idx ON pilot_sessions (tenant_id, user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS pilot_recalls_status_idx ON pilot_recalls (tenant_id, status, batch);
CREATE INDEX IF NOT EXISTS pilot_dispositions_status_idx ON pilot_dispositions (tenant_id, status, created_at);
CREATE INDEX IF NOT EXISTS pilot_ledger_source_idx ON pilot_ledger_events (tenant_id, source_id);
CREATE INDEX IF NOT EXISTS pilot_audit_source_idx ON pilot_audit_events (tenant_id, source_id);
