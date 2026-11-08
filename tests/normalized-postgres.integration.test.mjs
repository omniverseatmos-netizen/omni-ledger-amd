import test from 'node:test';
import assert from 'node:assert/strict';
import { PostgresPilotStore } from '../pilot-postgres.mjs';
import { emptyPilotState } from '../pilot-persistence.mjs';

const url = process.env.DATABASE_URL;
const enabled = process.env.ATMOS_POSTGRES_INTEGRATION === '1' && url;
const opts = { skip: enabled ? false : 'Set ATMOS_POSTGRES_INTEGRATION=1 and DATABASE_URL to run normalized PostgreSQL tests.' };

test('normalized projection writes users, recalls, dispositions, approvals, ledger, audit and idempotency atomically', opts, async () => {
  const tenantId = `normalized-${Date.now()}`;
  const store = new PostgresPilotStore({ connectionString: url, tenantId, normalized: true, initialState: emptyPilotState() });
  try {
    await store.transaction(state => {
      state.users.push({ id: 'u-maker', email: 'maker@example.test', displayName: 'Maker', tenantId, active: true, passwordHash: 'hash' });
      state.sessions.push({ tokenHash: 'session-1', userId: 'u-maker', tenantId, expiresAt: '2030-01-01T00:00:00.000Z' });
      state.idempotency.push({ key: 'create-000000000001', operation: 'create-disposition', requestHash: 'h1', response: { id: 'DSP-1' }, createdAt: '2026-10-20T00:00:00.000Z' });
      state.core = {
        dispositionRequests: [{ id: 'DSP-1', recallId: 'REC-1', disposition: 'HOLD', status: 'PENDING_APPROVAL', requestedBy: 'u-maker', requestedAt: '2026-10-20T00:00:00.000Z', approvals: [] }],
        audit: [{ id: 'AUD-1', eventType: 'RECALL_HELD', sourceId: 'REC-1', hash: 'ah1', prevHash: 'GENESIS', at: '2026-10-20T00:00:00.000Z', afterState: { id: 'REC-1', itemCode: 'ITEM-1', batch: 'B-1', warehouseCode: 'WH-1', status: 'ACTIVE' } }],
        ledger: [{ id: 'LED-1', seq: 1, type: 'STOCK_QUARANTINE', sourceId: 'REC-1', hash: 'lh1', prevHash: 'GENESIS', at: '2026-10-20T00:00:00.000Z' }],
      };
    });
    const pool = await store._pool();
    const counts = await pool.query(`SELECT
      (SELECT count(*) FROM pilot_users WHERE tenant_id = $1) AS users,
      (SELECT count(*) FROM pilot_sessions WHERE tenant_id = $1) AS sessions,
      (SELECT count(*) FROM pilot_recalls WHERE tenant_id = $1) AS recalls,
      (SELECT count(*) FROM pilot_dispositions WHERE tenant_id = $1) AS dispositions,
      (SELECT count(*) FROM pilot_ledger_events WHERE tenant_id = $1) AS ledger,
      (SELECT count(*) FROM pilot_audit_events WHERE tenant_id = $1) AS audit,
      (SELECT count(*) FROM pilot_idempotency_keys WHERE tenant_id = $1) AS idempotency`, [tenantId]);
    assert.deepEqual(counts.rows[0], { users: '1', sessions: '1', recalls: '1', dispositions: '1', ledger: '1', audit: '1', idempotency: '1' });
  } finally {
    const pool = await store._pool();
    for (const table of ['pilot_disposition_approvals', 'pilot_dispositions', 'pilot_recalls', 'pilot_sessions', 'pilot_users', 'pilot_ledger_events', 'pilot_audit_events', 'pilot_idempotency_keys']) await pool.query(`DELETE FROM ${table} WHERE tenant_id = $1`, [tenantId]);
    await pool.query('DELETE FROM pilot_state WHERE tenant_id = $1', [tenantId]);
    await store.close();
  }
});
