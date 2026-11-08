import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

const url = process.env.DATABASE_URL;
const enabled = process.env.ATMOS_POSTGRES_INTEGRATION === '1' && url;
const opts = { skip: enabled ? false : 'Set ATMOS_POSTGRES_INTEGRATION=1 and DATABASE_URL to run tenant isolation tests.' };

test('normalized primary keys and foreign keys isolate identical IDs across tenants', opts, async () => {
  const pool = new pg.Pool({ connectionString: url, max: 2 });
  const a = `iso-a-${Date.now()}`; const b = `iso-b-${Date.now()}`; const id = 'same-user-id';
  try {
    await pool.query('INSERT INTO pilot_users (tenant_id,id,email,display_name,tenant_id_record,data) VALUES ($1,$2,$3,$4,$1,$5::jsonb),($6,$2,$7,$4,$6,$5::jsonb)', [a, id, `${a}@test`, 'Isolation', '{}', b, `${b}@test`]);
    await pool.query('INSERT INTO pilot_sessions (tenant_id,id,user_id,expires_at,data) VALUES ($1,$2,$3,now()+interval \'1 hour\',$4::jsonb),($5,$2,$3,now()+interval \'1 hour\',$4::jsonb)', [a, 'same-session', id, '{}', b]);
    const rows = await pool.query('SELECT tenant_id,email FROM pilot_users WHERE id=$1 ORDER BY tenant_id', [id]);
    assert.deepEqual(rows.rows.map(row => row.tenant_id), [a, b].sort());
    await assert.rejects(pool.query('INSERT INTO pilot_dispositions (tenant_id,id,recall_id,disposition,status,requested_by,created_at,data) VALUES ($1,$2,$3,\'HOLD\',\'PENDING\',$4,now(),\'{}\'::jsonb)', [a, 'd-cross', 'missing-recall', id]), /foreign key/i);
  } finally {
    await pool.query('DELETE FROM pilot_sessions WHERE tenant_id IN ($1,$2)', [a, b]);
    await pool.query('DELETE FROM pilot_users WHERE tenant_id IN ($1,$2)', [a, b]);
    await pool.end();
  }
});
