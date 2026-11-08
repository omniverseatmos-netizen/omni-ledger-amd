// End-to-end HTTP test: Recall -> Disposition request -> dual approval -> separate execution,
// against a REAL PostgreSQL (normalized repository). It starts pilot-server.mjs as a child process
// and talks to it only over HTTP. Seeding (core + users) uses the same service layer, because the
// pilot API intentionally has no HTTP route that creates stock or users.
//
// Usage (disposable database ONLY — it deletes tenant T1 rows):
//   DATABASE_URL=postgres://... node scripts/e2e-http-postgres.mjs
// Label any result honestly: "local, single machine, synthetic data", not "staging".
import { spawn } from 'node:child_process';
import { PostgresPilotStore } from '../pilot-postgres.mjs';
import { emptyPilotState } from '../pilot-persistence.mjs';
import { PilotService } from '../pilot-service.mjs';
import { RbacService } from '../pilot-rbac.mjs';
import { OmNiCore, seedDemo } from '../domain.mjs';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required (use a disposable database).');
const PORT = Number(process.env.E2E_PORT || 4191);
const BASE = `http://127.0.0.1:${PORT}`;
const TENANT = 'T1';
const PASSWORD = 'Correct-Horse-Battery-9';
const results = [];
let failures = 0;
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); if (!ok) failures += 1; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`); };

const NOW = '2026-10-20T06:00:00.000Z';
function coreWithRecall() {
  const c = seedDemo(new OmNiCore({ now: () => new Date(NOW) }));
  c.today = '2026-10-01';
  const po = c.createPO({ supplierCode: 'SUP-001', warehouseCode: 'WH-OCT6', actor: 'buyer', lines: [{ itemCode: 'PARA-500', orderedQty: 1000, unitCostQirsh: 1250 }] });
  c.poAction(po.id, 'SUBMITTED', 'buyer'); c.poAction(po.id, 'APPROVED', 'manager');
  const gr = c.createReceipt({ poId: po.id, locationKey: 'WH-OCT6/A-01-01', actor: 'receiving_clerk', lines: [{ poLineId: po.lines[0].id, receivedQty: 1000, batch: 'E2E-1', expiryDate: '2027-01-01' }] });
  c.submitReceipt(gr.id, 'receiving_clerk'); c.startInspection(gr.id, 'qc_officer'); c.recordQC(gr.id, [{ lineId: gr.lines[0].id, qcPass: true }], 'qc_officer'); c.postReceipt(gr.id, 'receiving_clerk');
  c.recallBatch({ itemCode: 'PARA-500', batch: 'E2E-1', warehouseCode: 'WH-OCT6', refNo: 'E2E-RECALL', reason: 'E2E synthetic recall', actor: 'quality_officer', approver: 'qa_manager' });
  return c;
}

const tables = ['pilot_idempotency_keys', 'pilot_audit_events', 'pilot_ledger_events', 'pilot_disposition_approvals', 'pilot_dispositions', 'pilot_recalls', 'pilot_sessions', 'pilot_users', 'pilot_state'];
async function seed() {
  const store = new PostgresPilotStore({ connectionString: url, tenantId: TENANT, normalized: true, initialState: emptyPilotState() });
  const pool = await store._pool();
  for (const t of tables) await pool.query(`DELETE FROM ${t} WHERE tenant_id = $1`, [TENANT]);
  const service = new PilotService({ store });
  const rbac = new RbacService();
  await service.bootstrap({ admin: { id: 'u-admin', email: 'admin@e2e.test', displayName: 'Admin', password: PASSWORD, roles: ['pilot_admin'] } });
  await store.transaction(state => {
    for (const [id, role] of [['u-op', 'recall_operator'], ['u-quality', 'quality_officer'], ['u-qa', 'qa_manager'], ['u-ops', 'operations_manager'], ['u-audit', 'auditor']]) {
      state.users.push(rbac.createUser({ id, email: `${id}@e2e.test`, displayName: id, password: PASSWORD, roles: [role] }));
    }
    state.core = coreWithRecall().toJSON();
  });
  await store.close();
}

let server;
function startServer() {
  server = spawn(process.execPath, ['pilot-server.mjs'], { env: { ...process.env, PERSISTENCE: 'postgres', NORMALIZED_REPOSITORY: '1', PILOT_PORT: String(PORT), PILOT_TENANT_ID: TENANT, NODE_ENV: 'development' }, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stderr.on('data', d => process.stderr.write(`[server] ${d}`));
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const poll = async () => { try { const r = await fetch(`${BASE}/healthz`); if (r.ok) return resolve(); } catch {} if (Date.now() - t0 > 15000) return reject(new Error('server did not start')); setTimeout(poll, 150); };
    poll();
  });
}
const stopServer = () => new Promise(resolve => { if (!server) return resolve(); server.once('close', resolve); server.kill('SIGTERM'); });

async function call(method, path, { token, key, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (key) headers['Idempotency-Key'] = key;
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
const login = async id => { const r = await call('POST', '/v1/auth/login', { body: { email: `${id}@e2e.test`, password: PASSWORD } }); return r.json?.token; };

try {
  await seed();
  await startServer();
  check('server /healthz', (await call('GET', '/healthz')).status === 200);

  const tokens = {};
  for (const id of ['u-op', 'u-quality', 'u-qa', 'u-ops', 'u-audit']) tokens[id] = await login(id);
  check('five role users can log in over HTTP', Object.values(tokens).every(Boolean));
  check('wrong password is rejected (401)', (await call('POST', '/v1/auth/login', { body: { email: 'u-op@e2e.test', password: 'Wrong-Password-123' } })).status === 401);
  check('unauthenticated dashboard is rejected (401)', (await call('GET', '/v1/dispositions/dashboard')).status === 401);

  const payload = { itemCode: 'PARA-500', batch: 'E2E-1', warehouseCode: 'WH-OCT6', disposition: 'RETURN_TO_VENDOR', refNo: 'RTV-E2E-001', reason: 'E2E recalled batch return' };
  const dash0 = await call('GET', '/v1/dispositions/dashboard', { token: tokens['u-audit'] });
  const heldBefore = (dash0.json?.quarantine || []).reduce((s, r) => s + (r.heldUnits ?? r.held ?? r.qty ?? 0), 0);
  check('auditor can read dashboard; quarantine shows recalled stock', dash0.status === 200 && heldBefore > 0, `held units before = ${heldBefore}`);

  check('auditor cannot create a disposition (403)', (await call('POST', '/v1/dispositions', { token: tokens['u-audit'], key: 'k-audit-create-0001', body: payload })).status === 403);
  check('creating without Idempotency-Key is rejected (400)', (await call('POST', '/v1/dispositions', { token: tokens['u-op'], body: payload })).status === 400);

  const created = await call('POST', '/v1/dispositions', { token: tokens['u-op'], key: 'k-create-0000000001', body: payload });
  check('recall_operator creates RETURN_TO_VENDOR request (201, PENDING_APPROVAL)', created.status === 201 && created.json?.status === 'PENDING_APPROVAL', `id=${created.json?.id} status=${created.json?.status}`);
  const id = created.json?.id;

  const replay = await call('POST', '/v1/dispositions', { token: tokens['u-op'], key: 'k-create-0000000001', body: payload });
  check('same Idempotency-Key + same payload returns the SAME request (no duplicate)', replay.json?.id === id, `status=${replay.status}`);
  const conflict = await call('POST', '/v1/dispositions', { token: tokens['u-op'], key: 'k-create-0000000001', body: { ...payload, refNo: 'RTV-OTHER' } });
  check('same key + different payload is rejected (409 IDEMPOTENCY_CONFLICT)', conflict.status === 409, `status=${conflict.status} ${conflict.json?.code || conflict.json?.error || ''}`);

  const early = await call('POST', `/v1/dispositions/${id}/execute`, { token: tokens['u-ops'], key: 'k-exec-early-000001' });
  check('execution BEFORE both approvals is blocked (409 DISPOSITION_NOT_APPROVED)', early.status === 409 && early.json?.error === 'DISPOSITION_NOT_APPROVED', `status=${early.status} ${early.json?.code || ''}`);
  const selfApprove = await call('POST', `/v1/dispositions/${id}/approve`, { token: tokens['u-op'], key: 'k-self-approve-0001', body: { decision: 'APPROVE' } });
  check('requester cannot approve (403)', selfApprove.status === 403, `status=${selfApprove.status}`);

  const q1 = await call('POST', `/v1/dispositions/${id}/approve`, { token: tokens['u-quality'], key: 'k-quality-0000000001', body: { decision: 'APPROVE', note: 'e2e' } });
  check('quality_officer approval accepted (200)', q1.status === 200, `status=${q1.status} state=${q1.json?.status}`);
  const q2 = await call('POST', `/v1/dispositions/${id}/approve`, { token: tokens['u-quality'], key: 'k-quality-0000000002', body: { decision: 'APPROVE', note: 'again' } });
  check('same approval role cannot be used twice (409 APPROVAL_ROLE_ALREADY_USED)', q2.status === 409 && q2.json?.error === 'APPROVAL_ROLE_ALREADY_USED', `status=${q2.status} ${q2.json?.code || ''}`);
  const stillEarly = await call('POST', `/v1/dispositions/${id}/execute`, { token: tokens['u-ops'], key: 'k-exec-early-000002' });
  check('execution after ONE approval is still blocked (409)', stillEarly.status === 409, `status=${stillEarly.status}`);
  const q3 = await call('POST', `/v1/dispositions/${id}/approve`, { token: tokens['u-qa'], key: 'k-qa-000000000001', body: { decision: 'APPROVE', note: 'e2e' } });
  check('qa_manager approval accepted; request becomes APPROVED', q3.status === 200 && q3.json?.status === 'APPROVED', `status=${q3.json?.status}`);
  check('quality_officer cannot execute (403)', (await call('POST', `/v1/dispositions/${id}/execute`, { token: tokens['u-quality'], key: 'k-exec-wrong-role-01' })).status === 403);

  const exec1 = await call('POST', `/v1/dispositions/${id}/execute`, { token: tokens['u-ops'], key: 'k-exec-0000000001' });
  check('operations_manager executes (200, EXECUTED)', exec1.status === 200 && exec1.json?.status === 'EXECUTED', `status=${exec1.json?.status}`);
  const exec2 = await call('POST', `/v1/dispositions/${id}/execute`, { token: tokens['u-ops'], key: 'k-exec-0000000001' });
  check('replaying execute with the same key does NOT execute twice', exec2.status === 200 && exec2.json?.status === 'EXECUTED');
  const exec3 = await call('POST', `/v1/dispositions/${id}/execute`, { token: tokens['u-ops'], key: 'k-exec-0000000002' });
  check('second execute with a NEW key is rejected (409, already executed)', exec3.status === 409, `status=${exec3.status} ${exec3.json?.code || ''}`);

  const dash1 = await call('GET', '/v1/dispositions/dashboard', { token: tokens['u-audit'] });
  const heldAfter = (dash1.json?.quarantine || []).reduce((s, r) => s + (r.heldUnits ?? r.held ?? r.qty ?? 0), 0);
  check('dashboard shows EXECUTED and quarantine fell', dash1.json?.requests?.some(r => r.id === id && r.status === 'EXECUTED') && heldAfter < heldBefore, `held ${heldBefore} -> ${heldAfter}`);

  // Restart the API process: state must come back from PostgreSQL.
  const versionBefore = dash1.json?.version;
  await stopServer(); await startServer();
  const tokenAfter = await login('u-audit');
  const dash2 = await call('GET', '/v1/dispositions/dashboard', { token: tokenAfter });
  check('after API restart, EXECUTED state and version are recovered from PostgreSQL', dash2.json?.requests?.some(r => r.id === id && r.status === 'EXECUTED') && dash2.json?.version >= versionBefore, `version ${versionBefore} -> ${dash2.json?.version}`);

  // Direct database verification (independent of the API).
  const verifyStore = new PostgresPilotStore({ connectionString: url, tenantId: TENANT, normalized: true, initialState: emptyPilotState() });
  const state = await verifyStore.read();
  const core = OmNiCore.fromJSON(state.core, { verify: true });
  check('core rebuilt from PostgreSQL passes ledger integrity', core.verifyLedgerIntegrity().ok === true);
  check('core rebuilt from PostgreSQL passes audit-chain integrity', core.verifyAuditIntegrity().ok === true);
  const pool = await verifyStore._pool();
  const count = async t => Number((await pool.query(`SELECT count(*)::int n FROM ${t} WHERE tenant_id = $1`, [TENANT])).rows[0].n);
  const n = { dispositions: await count('pilot_dispositions'), approvals: await count('pilot_disposition_approvals'), ledger: await count('pilot_ledger_events'), audit: await count('pilot_audit_events'), idem: await count('pilot_idempotency_keys') };
  check('normalized tables hold the request, 2 approvals, ledger/audit rows and idempotency keys', n.dispositions === 1 && n.approvals === 2 && n.ledger > 0 && n.audit > 0 && n.idem === 4, JSON.stringify(n));
  await verifyStore.close();
} catch (error) {
  failures += 1; console.error('E2E aborted:', error);
} finally {
  await stopServer();
  // leave the disposable database clean so other integration tests that use tenant T1 are unaffected
  try { const s = new PostgresPilotStore({ connectionString: url, tenantId: TENANT, normalized: true, initialState: emptyPilotState() }); const pool = await s._pool(); for (const t of tables) await pool.query(`DELETE FROM ${t} WHERE tenant_id = $1`, [TENANT]); await s.close(); } catch (error) { console.error('cleanup failed:', error.message); }
}
console.log(JSON.stringify({ label: 'local single-machine run on synthetic data (not staging)', checks: results.length, passed: results.filter(r => r.ok).length, failed: failures }, null, 2));
process.exit(failures ? 1 : 0);
