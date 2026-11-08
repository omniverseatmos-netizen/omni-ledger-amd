import { OmNiCore, seedDemo } from '../domain.mjs';

const NOW = '2026-10-20T06:00:00.000Z';
function coreWithStock(batch = 'PRESSURE-1') {
  const c = seedDemo(new OmNiCore({ now: () => new Date(NOW) }));
  c.today = '2026-10-01';
  const po = c.createPO({ supplierCode: 'SUP-001', warehouseCode: 'WH-OCT6', actor: 'buyer', lines: [{ itemCode: 'PARA-500', orderedQty: 1000, unitCostQirsh: 1250 }] });
  c.poAction(po.id, 'SUBMITTED', 'buyer'); c.poAction(po.id, 'APPROVED', 'manager');
  const gr = c.createReceipt({ poId: po.id, locationKey: 'WH-OCT6/A-01-01', actor: 'receiving_clerk', lines: [{ poLineId: po.lines[0].id, receivedQty: 1000, batch, expiryDate: '2027-01-01' }] });
  c.submitReceipt(gr.id, 'receiving_clerk'); c.startInspection(gr.id, 'qc_officer'); c.recordQC(gr.id, [{ lineId: gr.lines[0].id, qcPass: true }], 'qc_officer'); c.postReceipt(gr.id, 'receiving_clerk');
  return c;
}
const attempts = Number(process.env.ATMOS_STRESS_ATTEMPTS || 500);
const started = performance.now();
const contested = coreWithStock();
const recallResults = await Promise.all(Array.from({ length: attempts }, (_, i) => Promise.resolve().then(() => {
  try { contested.recallBatch({ itemCode: 'PARA-500', batch: 'PRESSURE-1', warehouseCode: 'WH-OCT6', refNo: `PRESS-${i}`, reason: 'Concurrent recall test', actor: `quality-${i}`, approver: `qa-${i}` }); return 'SUCCESS'; }
  catch (error) { return error.code || 'ERROR'; }
})));
const successes = recallResults.filter(x => x === 'SUCCESS').length;
const duplicateBlocks = recallResults.filter(x => x === 'ALREADY_RECALLED').length;
if (successes !== 1 || duplicateBlocks !== attempts - 1) throw new Error(`Recall contention invariant failed: success=${successes}, duplicate=${duplicateBlocks}, attempts=${attempts}`);

const independentStarted = performance.now();
const independent = await Promise.all(Array.from({ length: Math.max(10, Math.floor(attempts / 5)) }, (_, i) => Promise.resolve().then(() => {
  const c = coreWithStock(`ISOLATED-${i}`);
  c.recallBatch({ itemCode: 'PARA-500', batch: `ISOLATED-${i}`, warehouseCode: 'WH-OCT6', refNo: `ISO-${i}`, reason: 'Independent recall test', actor: 'quality_officer', approver: 'qa_manager' });
  return c.verifyLedgerIntegrity().ok && c.verifyAuditIntegrity().ok;
})));
if (!independent.every(Boolean)) throw new Error('Independent recall integrity invariant failed.');

const disposition = contested.createDispositionRequest({ itemCode: 'PARA-500', batch: 'PRESSURE-1', warehouseCode: 'WH-OCT6', disposition: 'HOLD', refNo: 'PRESS-DSP', reason: 'Concurrent approval test', actor: 'recall_operator' });
const approvalResults = await Promise.all([
  Promise.resolve().then(() => contested.approveDisposition(disposition.id, { actor: 'quality-approver', role: 'quality_officer' })),
  Promise.resolve().then(() => { try { contested.approveDisposition(disposition.id, { actor: 'quality-approver-2', role: 'quality_officer' }); return 'UNEXPECTED'; } catch (error) { return error.code; } }),
  Promise.resolve().then(() => contested.approveDisposition(disposition.id, { actor: 'qa-approver', role: 'qa_manager' })),
]);
if (approvalResults[1] !== 'APPROVAL_ROLE_ALREADY_USED' || disposition.status !== 'APPROVED') throw new Error(`Dual approval invariant failed: ${JSON.stringify(approvalResults)}`);

const elapsed = performance.now() - started;
const isolatedElapsed = performance.now() - independentStarted;
console.log(JSON.stringify({ attempts, contestedRecall: { successes, duplicateBlocks }, independentCores: independent.length, elapsedMs: Math.round(elapsed * 100) / 100, isolatedElapsedMs: Math.round(isolatedElapsed * 100) / 100, ledgerIntegrity: contested.verifyLedgerIntegrity().ok, auditIntegrity: contested.verifyAuditIntegrity().ok }, null, 2));
