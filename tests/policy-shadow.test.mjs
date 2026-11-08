import test from 'node:test';
import assert from 'node:assert/strict';
import { createPolicyShadow } from '../policy-shadow.mjs';
import { DomainError, OmNiCore, seedDemo } from '../domain.mjs';

test('off mode performs no expert evaluation', () => {
  const shadow = createPolicyShadow('off');
  const result = shadow.evaluate({ expiryDate: '2020-01-01', today: '2026-10-20' }, { status: 'ALLOW' });
  assert.equal(result.applied, false);
  assert.equal(shadow.report().evaluations, 0);
});

test('shadow mode records a mismatch but preserves legacy allow behavior', () => {
  const core = seedDemo(new OmNiCore({ policyExpertsMode: 'shadow', now: () => new Date('2026-10-20T08:00:00Z') }));
  core.today = '2026-10-20';
  const po = core.createPO({ supplierCode: 'SUP-001', warehouseCode: 'WH-OCT6', actor: 'buyer', lines: [{ itemCode: 'INS-GLAR', orderedQty: 2, unitCostQirsh: 100 }] });
  core.poAction(po.id, 'SUBMITTED', 'buyer'); core.poAction(po.id, 'APPROVED', 'manager');
  const gr = core.createReceipt({ poId: po.id, locationKey: 'WH-OCT6/COLD-01', actor: 'recv', lines: [{ poLineId: po.lines[0].id, receivedQty: 2, rejectedQty: 0, batch: 'C1', expiryDate: '2027-01-01', coldChain: true, temperatureRangeC: [2, 8], measuredTemperatureC: 12 }] });
  assert.equal(gr.status, 'DRAFT');
  assert.deepEqual(core.policyShadowReport(), { mode: 'shadow', evaluations: 1, mismatches: 1, blocks: 1, reviews: 0, lastMismatch: { legacyStatus: 'ALLOW', expertStatus: 'BLOCK', selectedExperts: ['fefo-expiry', 'cold-chain'] } });
});

test('enforce mode blocks a new expert violation before persistence', () => {
  const core = seedDemo(new OmNiCore({ policyExpertsMode: 'enforce' }));
  const po = core.createPO({ supplierCode: 'SUP-001', warehouseCode: 'WH-OCT6', actor: 'buyer', lines: [{ itemCode: 'INS-GLAR', orderedQty: 2, unitCostQirsh: 100 }] });
  core.poAction(po.id, 'SUBMITTED', 'buyer'); core.poAction(po.id, 'APPROVED', 'manager');
  assert.throws(() => core.createReceipt({ poId: po.id, locationKey: 'WH-OCT6/COLD-01', actor: 'recv', lines: [{ poLineId: po.lines[0].id, receivedQty: 2, rejectedQty: 0, batch: 'C1', expiryDate: '2027-01-01', coldChain: true, temperatureRangeC: [2, 8], measuredTemperatureC: 12 }] }), error => error instanceof DomainError && error.code === 'POLICY_EXPERT_BLOCK');
  assert.equal(core.receipts.size, 0);
});

test('shadow metadata is not serialized into the ledger state', () => {
  const normal = seedDemo(new OmNiCore({ now: () => new Date('2026-10-20T08:00:00Z') }));
  const shadow = seedDemo(new OmNiCore({ policyExpertsMode: 'shadow', now: () => new Date('2026-10-20T08:00:00Z') }));
  assert.deepEqual(shadow.toJSON(), normal.toJSON());
});

test('shadow evaluates allocation and pick without changing their legacy result', () => {
  const core = seedDemo(new OmNiCore({ policyExpertsMode: 'shadow', now: () => new Date('2026-10-20T08:00:00Z') }));
  core.today = '2026-10-20';
  const po = core.createPO({ supplierCode: 'SUP-001', warehouseCode: 'WH-OCT6', actor: 'buyer', lines: [{ itemCode: 'PARA-500', orderedQty: 5, unitCostQirsh: 100 }] });
  core.poAction(po.id, 'SUBMITTED', 'buyer'); core.poAction(po.id, 'APPROVED', 'manager');
  const gr = core.createReceipt({ poId: po.id, locationKey: 'WH-OCT6/A-01-01', actor: 'recv', lines: [{ poLineId: po.lines[0].id, receivedQty: 5, rejectedQty: 0, batch: 'B1', expiryDate: '2027-01-01' }] });
  core.submitReceipt(gr.id, 'recv'); core.startInspection(gr.id, 'qc'); core.recordQC(gr.id, [{ lineId: gr.lines[0].id, qcPass: true }], 'qc'); core.postReceipt(gr.id, 'qc');
  const so = core.createSO({ customerCode: 'CUST-001', warehouseCode: 'WH-OCT6', actor: 'sales', lines: [{ itemCode: 'PARA-500', orderedQty: 2 }] });
  core.soAction(so.id, 'SUBMITTED', 'sales'); core.allocateSO(so.id, 'sales');
  core.confirmPick(so.id, [{ allocationId: so.allocations[0].id, scannedItemCode: 'PARA-500', scannedBatch: 'B1' }], 'picker');
  assert.equal(so.allocations[0].picked, true);
  assert.equal(core.policyShadowReport().evaluations, 3);
  assert.equal(core.policyShadowReport().mismatches, 0);
});

test('enforce mode blocks an allocation that became expired before picking', () => {
  const core = seedDemo(new OmNiCore({ policyExpertsMode: 'enforce', now: () => new Date('2026-10-20T08:00:00Z') }));
  core.today = '2026-10-20';
  const po = core.createPO({ supplierCode: 'SUP-001', warehouseCode: 'WH-OCT6', actor: 'buyer', lines: [{ itemCode: 'PARA-500', orderedQty: 5, unitCostQirsh: 100 }] });
  core.poAction(po.id, 'SUBMITTED', 'buyer'); core.poAction(po.id, 'APPROVED', 'manager');
  const gr = core.createReceipt({ poId: po.id, locationKey: 'WH-OCT6/A-01-01', actor: 'recv', lines: [{ poLineId: po.lines[0].id, receivedQty: 5, rejectedQty: 0, batch: 'B1', expiryDate: '2027-01-01' }] });
  core.submitReceipt(gr.id, 'recv'); core.startInspection(gr.id, 'qc'); core.recordQC(gr.id, [{ lineId: gr.lines[0].id, qcPass: true }], 'qc'); core.postReceipt(gr.id, 'qc');
  const so = core.createSO({ customerCode: 'CUST-001', warehouseCode: 'WH-OCT6', actor: 'sales', lines: [{ itemCode: 'PARA-500', orderedQty: 2 }] });
  core.soAction(so.id, 'SUBMITTED', 'sales'); core.allocateSO(so.id, 'sales'); core.today = '2028-01-01';
  assert.throws(() => core.confirmPick(so.id, [{ allocationId: so.allocations[0].id, scannedItemCode: 'PARA-500', scannedBatch: 'B1' }], 'picker'), error => error instanceof DomainError && error.code === 'POLICY_EXPERT_BLOCK');
  assert.equal(so.allocations[0].picked, false);
});
