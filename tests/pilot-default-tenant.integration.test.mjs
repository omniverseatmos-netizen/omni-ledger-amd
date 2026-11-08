import test from 'node:test';
import assert from 'node:assert/strict';
import { PostgresPilotStore } from '../pilot-postgres.mjs';
import { emptyPilotState } from '../pilot-persistence.mjs';
import { PilotService } from '../pilot-service.mjs';

const url = process.env.DATABASE_URL;
const enabled = process.env.ATMOS_POSTGRES_INTEGRATION === '1' && url;
const opts = { skip: enabled ? false : 'Set ATMOS_POSTGRES_INTEGRATION=1 and DATABASE_URL to run.' };

// Regression: the server default tenant must match the RBAC default tenant (T1),
// otherwise normalized mode violates pilot_users_tenant_match on the first bootstrap.
test('normalized store bootstraps and logs in under the default tenant T1', opts, async () => {
  const tenantId = 'T1';
  const store = new PostgresPilotStore({ connectionString: url, tenantId, normalized: true, initialState: emptyPilotState() });
  const service = new PilotService({ store });
  try {
    const res = await service.bootstrap({ admin: { id: 'reg-u1', email: 'reg@x.test', displayName: 'Reg', password: 'Correct-Horse-Battery-9', roles: ['pilot_admin'] } });
    assert.equal(res.created, true);
    const login = await service.login({ email: 'reg@x.test', password: 'Correct-Horse-Battery-9' });
    assert.ok(login.token);
    const pool = await store._pool();
    const { rows } = await pool.query('SELECT count(*)::int AS n FROM pilot_users WHERE tenant_id = $1 AND id = $2', [tenantId, 'reg-u1']);
    assert.equal(rows[0].n, 1);
  } finally {
    const pool = await store._pool();
    for (const t of ['pilot_sessions', 'pilot_users']) await pool.query(`DELETE FROM ${t} WHERE tenant_id = $1`, [tenantId]);
    await pool.query('DELETE FROM pilot_state WHERE tenant_id = $1', [tenantId]);
    await store.close();
  }
});
