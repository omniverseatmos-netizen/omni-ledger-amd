import test from 'node:test';
import assert from 'node:assert/strict';
import { PostgresPilotStore } from '../pilot-postgres.mjs';

const url = process.env.DATABASE_URL;
const enabled = process.env.ATMOS_POSTGRES_INTEGRATION === '1' && url;
const opts = { skip: enabled ? false : 'Set ATMOS_POSTGRES_INTEGRATION=1 and DATABASE_URL to run against real PostgreSQL.' };

test('PostgreSQL store: 30 concurrent transactions lose no update (FOR UPDATE)', opts, async () => {
  const tenantId = `it-${Date.now()}`;
  const store = new PostgresPilotStore({ connectionString: url, tenantId, initialState: { meta: { version: 0 }, counter: 0 } });
  try {
    await Promise.all(Array.from({ length: 30 }, () => store.transaction(s => { s.counter += 1; })));
    const state = await store.read();
    assert.equal(state.counter, 30);
    assert.equal(state.meta.version, 30);
  } finally {
    const pool = await store._pool(); await pool.query('DELETE FROM pilot_state WHERE tenant_id = $1', [tenantId]); await store.close();
  }
});

test('PostgreSQL store: a throwing transaction rolls back completely', opts, async () => {
  const tenantId = `it-rb-${Date.now()}`;
  const store = new PostgresPilotStore({ connectionString: url, tenantId, initialState: { meta: { version: 0 }, counter: 0 } });
  try {
    await assert.rejects(store.transaction(s => { s.counter = 99; throw new Error('boom'); }), /boom/);
    const state = await store.read();
    assert.equal(state.counter, 0); assert.equal(state.meta.version, 0);
  } finally {
    const pool = await store._pool(); await pool.query('DELETE FROM pilot_state WHERE tenant_id = $1', [tenantId]); await store.close();
  }
});
