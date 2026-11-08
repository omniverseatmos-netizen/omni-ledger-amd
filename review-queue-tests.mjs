import assert from 'node:assert/strict';
import { OmNiCore, seedDemo } from './domain.mjs';

const NOW = '2026-10-20T06:00:00.000Z';
function fresh() {
  const c = seedDemo(new OmNiCore({ now: () => new Date(NOW) }));
  c.today = '2026-10-01';
  return c;
}
function receiveQcFail(c) {
  const po = c.createPO({ supplierCode: 'SUP-001', warehouseCode: 'WH-OCT6', actor: 'buyer', lines: [{ itemCode: 'PARA-500', orderedQty: 10, unitCostQirsh: 1250 }] });
  c.poAction(po.id, 'SUBMITTED', 'buyer');
  c.poAction(po.id, 'APPROVED', 'manager');
  const gr = c.createReceipt({ poId: po.id, locationKey: 'WH-OCT6/A-01-01', actor: 'receiving_clerk', lines: [{ poLineId: po.lines[0].id, receivedQty: 10, batch: 'QC-BAD-1', expiryDate: '2027-01-01' }] });
  c.submitReceipt(gr.id, 'receiving_clerk');
  c.startInspection(gr.id, 'qc_officer');
  c.recordQC(gr.id, [{ lineId: gr.lines[0].id, qcPass: false, reason: 'Damaged packaging' }], 'qc_officer');
  return gr;
}
function receiveValid(c, batch, expiryDate, qty = 10) {
  const po = c.createPO({ supplierCode: 'SUP-001', warehouseCode: 'WH-OCT6', actor: 'buyer', lines: [{ itemCode: 'PARA-500', orderedQty: qty, unitCostQirsh: 1250 }] });
  c.poAction(po.id, 'SUBMITTED', 'buyer'); c.poAction(po.id, 'APPROVED', 'manager');
  const gr = c.createReceipt({ poId: po.id, locationKey: 'WH-OCT6/A-01-01', actor: 'receiving_clerk', lines: [{ poLineId: po.lines[0].id, receivedQty: qty, batch, expiryDate }] });
  c.submitReceipt(gr.id, 'receiving_clerk'); c.startInspection(gr.id, 'qc_officer'); c.recordQC(gr.id, [{ lineId: gr.lines[0].id, qcPass: true }], 'qc_officer'); c.postReceipt(gr.id, 'receiving_clerk'); return gr;
}
function expectCode(fn, code) {
  assert.throws(fn, error => error?.code === code, `expected ${code}`);
}

const c = fresh();
const gr = receiveQcFail(c);
const exc = c.exceptions.at(-1);
const review = c.reviewCases.at(-1);
assert.equal(exc.type, 'QC_FAIL');
assert.equal(review.type, 'QC_FAIL');
assert.equal(review.requiredRole, 'qa_manager');
assert.equal(review.state, 'OPEN');
assert.equal(review.dueAt, '2026-10-20T08:00:00.000Z');
assert.equal(c.listReviewCases()[0].id, review.id);

expectCode(() => c.claimReview(review.id, { actor: 'warehouse_manager', role: 'warehouse_manager' }), 'ROLE_NOT_ALLOWED');
c.claimReview(review.id, { actor: 'qa_1', role: 'qa_manager', now: NOW, leaseMinutes: 20 });
expectCode(() => c.claimReview(review.id, { actor: 'qa_2', role: 'qa_manager', now: NOW }), 'REVIEW_CLAIMED');
expectCode(() => c.resolveReview(review.id, { actor: 'qa_1', role: 'qa_manager', resolution: 'RTV', note: 'no' }), 'RESOLUTION_REQUIRED');
c.resolveReview(review.id, { actor: 'qa_1', role: 'qa_manager', resolution: 'RTV', note: 'Returned to vendor for inspection.', now: NOW });
assert.equal(review.state, 'RESOLVED');
assert.equal(exc.resolution, 'RTV');
assert.equal(c.audit.filter(x => x.eventType === 'REVIEW_OPENED').length, 1);
assert.equal(c.audit.filter(x => x.eventType === 'REVIEW_CLAIMED').length, 1);
assert.equal(c.audit.filter(x => x.eventType === 'REVIEW_RESOLVED').length, 1);

const overdueCore = fresh();
receiveQcFail(overdueCore);
const overdue = overdueCore.reviewCases.at(-1);
const escalated = overdueCore.escalateOverdueReviews({ now: '2026-10-20T08:01:00.000Z', actor: 'scheduler' });
assert.equal(escalated.length, 1);
assert.equal(overdue.state, 'ESCALATED');
assert.equal(overdueCore.listReviewCases({ now: '2026-10-20T08:01:00.000Z' })[0].overdue, true);

overdueCore.claimReview(overdue.id, { actor: 'qa_2', role: 'qa_manager', now: '2026-10-20T08:02:00.000Z' });
assert.equal(overdue.state, 'CLAIMED');

const roundTrip = OmNiCore.fromJSON(JSON.parse(JSON.stringify(c.toJSON())), { now: () => new Date(NOW) });
assert.equal(roundTrip.reviewCases.length, c.reviewCases.length);
assert.equal(roundTrip.reviewCases[0].state, 'RESOLVED');
assert.equal(roundTrip.stateHash(), c.stateHash());
assert.equal(roundTrip.verifyAuditIntegrity().ok, true);

const expiredCore = fresh();
const expiredPO = expiredCore.createPO({ supplierCode: 'SUP-001', warehouseCode: 'WH-OCT6', actor: 'buyer', lines: [{ itemCode: 'PARA-500', orderedQty: 5, unitCostQirsh: 1250 }] });
expiredCore.poAction(expiredPO.id, 'SUBMITTED', 'buyer');
expiredCore.poAction(expiredPO.id, 'APPROVED', 'manager');
expectCode(() => expiredCore.createReceipt({ poId: expiredPO.id, locationKey: 'WH-OCT6/A-01-01', actor: 'receiving_clerk', lines: [{ poLineId: expiredPO.lines[0].id, receivedQty: 5, batch: 'EXP-1', expiryDate: '2025-01-01' }] }), 'EXPIRED_GOODS');
const expiredReview = expiredCore.reviewCases.at(-1);
assert.equal(expiredReview.type, 'EXPIRED_GOODS');
assert.equal(expiredReview.requiredRole, 'receiving_supervisor');
expiredCore.claimReview(expiredReview.id, { actor: 'supervisor_demo', role: 'receiving_supervisor', now: NOW });
const ledgerBeforeClose = expiredCore.ledger.length;
expiredCore.resolveReview(expiredReview.id, { actor: 'supervisor_demo', role: 'receiving_supervisor', resolution: 'CONFIRMED_BLOCK', note: 'Expired stock remains rejected; no receipt was created.', now: NOW });
assert.equal(expiredCore.ledger.length, ledgerBeforeClose);
assert.equal(expiredReview.state, 'RESOLVED');

const actionCore = fresh();
const actionReceipt = receiveQcFail(actionCore);
actionCore.postReceipt(actionReceipt.id, 'qc_officer');
const rtvReview = actionCore.reviewCases.find(x => x.type === 'QC_FAIL');
assert.equal(actionCore.getQuarantineBalance('PARA-500'), 10);
actionCore.claimReview(rtvReview.id, { actor: 'qa_rtv', role: 'qa_manager', now: NOW });
actionCore.resolveReviewWithAction(rtvReview.id, { actor: 'qa_rtv', role: 'qa_manager', action: 'RETURN_TO_VENDOR', now: NOW });
assert.equal(rtvReview.state, 'RESOLVED');
assert.equal(rtvReview.resolution, 'RTV_POSTED');
assert.equal(actionCore.getQuarantineBalance('PARA-500'), 0);
assert.equal(actionCore.ledger.at(-1).type, 'RTV');
assert.equal(actionCore.verifyLedgerIntegrity().ok, true);

const dispositionCore = fresh();
receiveValid(dispositionCore, 'RCL-OLD', '2027-01-01', 10);
receiveValid(dispositionCore, 'SAFE-NEW', '2028-01-01', 10);
const so = dispositionCore.createSO({ customerCode: 'CUST-001', warehouseCode: 'WH-OCT6', actor: 'sales', lines: [{ itemCode: 'PARA-500', orderedQty: 5 }] });
dispositionCore.soAction(so.id, 'SUBMITTED', 'sales'); dispositionCore.allocateSO(so.id, 'sales');
assert.equal(so.allocations[0].batch, 'RCL-OLD');
const recall = dispositionCore.recallBatch({ itemCode: 'PARA-500', batch: 'RCL-OLD', warehouseCode: 'WH-OCT6', refNo: 'RECALL-DSP-1', reason: 'Disposition workflow test', actor: 'quality_officer', approver: 'qa_manager' });
assert.equal(recall.impact.openOrders.length, 1);
const dsp = dispositionCore.createDispositionRequest({ itemCode: 'PARA-500', batch: 'RCL-OLD', warehouseCode: 'WH-OCT6', disposition: 'REALLOCATE', refNo: 'DSP-1', reason: 'Replace recalled allocation', actor: 'recall_operator' });
dispositionCore.approveDisposition(dsp.id, { actor: 'quality_officer', role: 'quality_officer' });
dispositionCore.approveDisposition(dsp.id, { actor: 'qa_manager', role: 'qa_manager' });
assert.equal(dsp.status, 'APPROVED');
dispositionCore.executeDisposition(dsp.id, { actor: 'operations_manager', role: 'operations_manager' });
assert.equal(dsp.status, 'EXECUTED');
assert.equal(so.allocations[0].batch, 'SAFE-NEW');
assert.equal(dispositionCore.verifyLedgerIntegrity().ok, true);
const roundTripDsp = OmNiCore.fromJSON(JSON.parse(JSON.stringify(dispositionCore.toJSON())), { now: () => new Date(NOW) });
assert.equal(roundTripDsp.dispositionRequests.at(-1).status, 'EXECUTED');

console.log('✓ ReviewQueue contract: open → claim → resolve, SLA escalation, RBAC, and persistence');
