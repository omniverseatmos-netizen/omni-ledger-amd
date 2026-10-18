import test from 'node:test';
import assert from 'node:assert/strict';
import { runInvoiceScenario, runInvoiceFromExtraction, runRecallScenario } from '../demo-scenarios.mjs';
import { executePipeline, parseModelJson, validateExtraction, PipelineError } from '../amd_omni_pipeline.mjs';

const valid = { invoiceNo: 'QA-VALID-01', supplierCode: 'SUP-001', itemCode: 'PARA-500', batch: 'QA-BATCH-VALID', expiryDate: '2027-12-31', qty: 12, unitCostQirsh: 1250 };

test('valid receiving scenario posts stock through the deterministic core', () => {
  const r = runInvoiceScenario('valid');
  assert.equal(r.decision, 'ACCEPTED');
  assert.equal(r.balance, 100);
  assert.equal(r.integrity.ledger.ok, true);
  assert.equal(r.integrity.audit.ok, true);
  assert.equal(r.integrity.seal.ok, true);
});

test('expired batch is hard-blocked without creating available stock', () => {
  const r = runInvoiceScenario('expired');
  assert.equal(r.decision, 'BLOCKED');
  assert.equal(r.blockCode, 'EXPIRED_GOODS');
  assert.equal(r.balance, 0);
  assert.equal(r.integrity.ledger.ok, true);
});

test('recall quarantines the remaining batch, traces prior dispatch, and blocks an open order pick', () => {
  const r = runRecallScenario();
  assert.equal(r.recall.status, 'ACTIVE');
  assert.equal(r.recall.heldQty, 70);
  assert.equal(r.trace.totals.receivedBaseUnits, 100);
  assert.equal(r.trace.totals.shippedBaseUnits, 30);
  assert.equal(r.trace.totals.onHandBaseUnits, 70);
  assert.equal(r.traceModel.shipments[0].customerName, 'Al-Shifa Pharmacy · 6th of October');
  assert.equal(r.pickBlock.blocked, true);
  assert.equal(r.pickBlock.code, 'RECALLED_BATCH');
  assert.equal(r.integrity.ledger.ok && r.integrity.audit.ok && r.integrity.seal.ok, true);
});

test('model JSON parser accepts a fenced object and rejects malformed output', () => {
  assert.deepEqual(parseModelJson('```json\n{"qty":2}\n```'), { qty: 2 });
  assert.throws(() => parseModelJson('The answer is probably 2'), { code: 'INVALID_MODEL_JSON' });
});

test('extraction schema accepts supported invoice fields but rejects fuzzy or unknown SKUs', () => {
  assert.deepEqual(validateExtraction(valid), valid);
  assert.throws(() => validateExtraction({ ...valid, itemCode: 'PARACETAMOL' }), { code: 'UNKNOWN_ITEM' });
  assert.throws(() => validateExtraction({ ...valid, supplierCode: undefined }), { code: 'UNKNOWN_SUPPLIER' });
  assert.throws(() => validateExtraction({ ...valid, qty: 1.5 }), { code: 'INVALID_QUANTITY' });
  assert.throws(() => validateExtraction({ ...valid, expiryDate: '2026-02-30' }), { code: 'INVALID_EXPIRY_DATE' });
});

test('downstream deterministic gate blocks expiry even after valid-shaped extraction', () => {
  const r = runInvoiceFromExtraction({ ...valid, batch: 'QA-BATCH-EXPIRED', expiryDate: '2024-01-01' });
  assert.equal(r.decision, 'BLOCKED');
  assert.equal(r.blockCode, 'EXPIRED_GOODS');
  assert.equal(r.balance, 0);
});

test('offline pipeline labels fixture mode clearly and does not claim a live request', async () => {
  const r = await executePipeline({ live: false, scenario: 'valid' });
  assert.equal(r.inference.mode, 'OFFLINE_FIXTURE_NOT_LIVE');
  assert.match(r.notice, /no network call/i);
  assert.equal(r.decision, 'ACCEPTED');
  assert.equal(r.assertion, 'PASS');
});

test('offline expired pipeline is a successful negative control case', async () => {
  const r = await executePipeline({ live: false, scenario: 'expired' });
  assert.equal(r.decision, 'BLOCKED');
  assert.equal(r.block.code, 'EXPIRED_GOODS');
  assert.equal(r.assertion, 'PASS');
});

test('live pipeline fails closed without credentials before making a network request', async () => {
  await assert.rejects(executePipeline({ live: true, scenario: 'valid', env: {} }), error => error instanceof PipelineError && error.code === 'MISSING_API_KEY');
});
