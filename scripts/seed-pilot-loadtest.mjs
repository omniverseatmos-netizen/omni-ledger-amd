// Seeds a DISPOSABLE PostgreSQL tenant (T1) with synthetic data for load tests:
// 6 users (one per role + admin) and N recalled batches. Deletes existing T1 rows first.
//   DATABASE_URL=... BATCHES=100 node scripts/seed-pilot-loadtest.mjs
import { PostgresPilotStore } from '../pilot-postgres.mjs';
import { emptyPilotState } from '../pilot-persistence.mjs';
import { PilotService } from '../pilot-service.mjs';
import { RbacService } from '../pilot-rbac.mjs';
import { OmNiCore, seedDemo } from '../domain.mjs';
const url = process.env.DATABASE_URL; if (!url) throw new Error('DATABASE_URL required (disposable DB only).');
const N = Number(process.env.BATCHES || 100); const TENANT = 'T1'; const PASSWORD = process.env.SEED_PASSWORD || 'Correct-Horse-Battery-9';
const c = seedDemo(new OmNiCore({ now: () => new Date('2026-10-20T06:00:00.000Z') })); c.today = '2026-10-01';
const batches = [];
for (let i = 1; i <= N; i += 1) {
  const batch = `LT-${String(i).padStart(4, '0')}`;
  const po = c.createPO({ supplierCode: 'SUP-001', warehouseCode: 'WH-OCT6', actor: 'buyer', lines: [{ itemCode: 'PARA-500', orderedQty: 100, unitCostQirsh: 1250 }] });
  c.poAction(po.id, 'SUBMITTED', 'buyer'); c.poAction(po.id, 'APPROVED', 'manager');
  const gr = c.createReceipt({ poId: po.id, locationKey: 'WH-OCT6/A-01-01', actor: 'receiving_clerk', lines: [{ poLineId: po.lines[0].id, receivedQty: 100, batch, expiryDate: '2027-01-01' }] });
  c.submitReceipt(gr.id, 'receiving_clerk'); c.startInspection(gr.id, 'qc_officer'); c.recordQC(gr.id, [{ lineId: gr.lines[0].id, qcPass: true }], 'qc_officer'); c.postReceipt(gr.id, 'receiving_clerk');
  c.recallBatch({ itemCode: 'PARA-500', batch, warehouseCode: 'WH-OCT6', refNo: `LT-RECALL-${i}`, reason: 'load test synthetic recall', actor: 'quality_officer', approver: 'qa_manager' });
  batches.push(batch);
}
const store = new PostgresPilotStore({ connectionString: url, tenantId: TENANT, normalized: true, initialState: emptyPilotState() });
const pool = await store._pool();
for (const t of ['pilot_idempotency_keys', 'pilot_audit_events', 'pilot_ledger_events', 'pilot_disposition_approvals', 'pilot_dispositions', 'pilot_recalls', 'pilot_sessions', 'pilot_users', 'pilot_state']) await pool.query(`DELETE FROM ${t} WHERE tenant_id = $1`, [TENANT]);
const service = new PilotService({ store }); const rbac = new RbacService();
await service.bootstrap({ admin: { id: 'u-admin', email: 'admin@e2e.test', displayName: 'Admin', password: PASSWORD, roles: ['pilot_admin'] } });
await store.transaction(state => { for (const [id, role] of [['u-op', 'recall_operator'], ['u-quality', 'quality_officer'], ['u-qa', 'qa_manager'], ['u-ops', 'operations_manager'], ['u-audit', 'auditor']]) state.users.push(rbac.createUser({ id, email: `${id}@e2e.test`, displayName: id, password: PASSWORD, roles: [role] })); state.core = c.toJSON(); });
await store.close();
console.log(JSON.stringify({ tenant: TENANT, batches: batches.length, ledgerEvents: c.ledger.length, auditEvents: c.audit.length, list: batches.join(',') }));
