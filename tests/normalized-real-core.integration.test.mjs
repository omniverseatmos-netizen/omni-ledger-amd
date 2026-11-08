import test from 'node:test';
import assert from 'node:assert/strict';
import { PostgresPilotStore } from '../pilot-postgres.mjs';
import { emptyPilotState } from '../pilot-persistence.mjs';
import { OmNiCore, seedDemo } from '../domain.mjs';

const url = process.env.DATABASE_URL;
const enabled = process.env.ATMOS_POSTGRES_INTEGRATION === '1' && url;
const opts = { skip: enabled ? false : 'Set ATMOS_POSTGRES_INTEGRATION=1 and DATABASE_URL to run.' };

// Regression: ledger/audit entries have no `seq`; the adapter used `event.seq || 0`, so the 2nd event violated
// UNIQUE (tenant_id, sequence_no). A REAL multi-event core must persist, round-trip and keep valid hash chains.
test('normalized store persists a real multi-event core and round-trips with valid hash chains', opts, async () => {
  const tenantId = 'T-REAL-CORE';
  const c = seedDemo(new OmNiCore({ now: () => new Date('2026-10-20T06:00:00.000Z') }));
  c.today = '2026-10-01';
  const po = c.createPO({ supplierCode: 'SUP-001', warehouseCode: 'WH-OCT6', actor: 'buyer', lines: [{ itemCode: 'PARA-500', orderedQty: 500, unitCostQirsh: 1250 }] });
  c.poAction(po.id, 'SUBMITTED', 'buyer'); c.poAction(po.id, 'APPROVED', 'manager');
  const gr = c.createReceipt({ poId: po.id, locationKey: 'WH-OCT6/A-01-01', actor: 'receiving_clerk', lines: [{ poLineId: po.lines[0].id, receivedQty: 500, batch: 'REAL-1', expiryDate: '2027-01-01' }] });
  c.submitReceipt(gr.id, 'receiving_clerk'); c.startInspection(gr.id, 'qc_officer'); c.recordQC(gr.id, [{ lineId: gr.lines[0].id, qcPass: true }], 'qc_officer'); c.postReceipt(gr.id, 'receiving_clerk');
  c.recallBatch({ itemCode: 'PARA-500', batch: 'REAL-1', warehouseCode: 'WH-OCT6', refNo: 'REAL-RECALL', reason: 'regression', actor: 'quality_officer', approver: 'qa_manager' });
  const store = new PostgresPilotStore({ connectionString: url, tenantId, normalized: true, initialState: emptyPilotState() });
  const pool = await store._pool();
  try {
    await store.transaction(state => { state.core = c.toJSON(); });
    const { rows: [ledger] } = await pool.query('SELECT count(*)::int n, count(DISTINCT sequence_no)::int d, min(sequence_no)::int lo, max(sequence_no)::int hi FROM pilot_ledger_events WHERE tenant_id = $1', [tenantId]);
    const { rows: [audit] } = await pool.query('SELECT count(*)::int n, count(DISTINCT sequence_no)::int d, min(sequence_no)::int lo, max(sequence_no)::int hi FROM pilot_audit_events WHERE tenant_id = $1', [tenantId]);
    assert.ok(ledger.n >= 2 && audit.n >= 2, 'expected several ledger and audit events');
    assert.equal(ledger.d, ledger.n); assert.equal(audit.d, audit.n);
    assert.equal(ledger.lo, 1); assert.equal(ledger.hi, ledger.n); assert.equal(audit.hi, audit.n);
    const back = OmNiCore.fromJSON((await store.read()).core, { verify: true });
    assert.equal(back.verifyLedgerIntegrity().ok, true); assert.equal(back.verifyAuditIntegrity().ok, true);
  } finally {
    for (const t of ['pilot_idempotency_keys', 'pilot_audit_events', 'pilot_ledger_events', 'pilot_disposition_approvals', 'pilot_dispositions', 'pilot_recalls', 'pilot_sessions', 'pilot_users', 'pilot_state']) await pool.query(`DELETE FROM ${t} WHERE tenant_id = $1`, [tenantId]);
    await store.close();
  }
});
