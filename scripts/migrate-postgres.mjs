import fs from 'node:fs/promises';
import pg from 'pg';

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required.');
const pool = new Pool({ connectionString, max: 2 });
const tenantScopedTables = ['pilot_users', 'pilot_sessions', 'pilot_recalls', 'pilot_dispositions', 'pilot_disposition_approvals', 'pilot_ledger_events', 'pilot_audit_events', 'pilot_idempotency_keys'];
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['atmos-schema-migration']);
  for (const file of ['schema/pilot-postgres.sql', 'schema/normalized-pilot.sql']) {
    await client.query(await fs.readFile(new URL(`../${file}`, import.meta.url), 'utf8'));
    console.log(`Applied ${file}`);
  }
  // Upgrade databases created by the earlier normalized schema only when their PK is id-only.
  // A fresh v3.2+ schema already has dependent FKs on the composite PK and is left untouched.
  for (const table of tenantScopedTables) {
    const key = await client.query(`SELECT array_agg(att.attname ORDER BY cols.ord) AS columns
      FROM pg_constraint con
      JOIN unnest(con.conkey) WITH ORDINALITY AS cols(attnum, ord) ON true
      JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = cols.attnum
      WHERE con.conrelid = $1::regclass AND con.contype = 'p'
      GROUP BY con.oid`, [table]);
    const rawColumns = key.rows[0]?.columns || [];
    const columns = Array.isArray(rawColumns)
      ? rawColumns
      : String(rawColumns).replace(/[{}\"]+/g, '').split(',').filter(Boolean);
    if (columns.join(',') !== 'tenant_id,id') {
      await client.query(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${table}_pkey`);
      await client.query(`ALTER TABLE ${table} ADD CONSTRAINT ${table}_pkey PRIMARY KEY (tenant_id, id)`);
    }
  }
  await client.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pilot_users_tenant_match') THEN
      ALTER TABLE pilot_users ADD CONSTRAINT pilot_users_tenant_match CHECK (tenant_id = tenant_id_record);
    END IF;
  END $$`);
  await client.query('COMMIT');
  console.log('Normalized tenant-scoped primary keys: verified');
} catch (error) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Migration rolled back:', error.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
