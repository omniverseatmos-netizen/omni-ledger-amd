import { OmNiCore, seedDemo } from './domain.mjs';

export const DEMO_TODAY = '2026-10-17';
export const DEMO_BATCH = 'BATCH-RECALL-01';

export function createDemoCore(today = DEMO_TODAY) {
  const core = seedDemo(new OmNiCore());
  core.today = today;
  return core;
}

function postReceipt(core, { itemCode, batch, expiryDate, qty, unitCostQirsh = 1250, supplierCode = 'SUP-001', warehouseCode = 'WH-OCT6', locationKey = 'WH-OCT6/A-01-01', actor = 'receiving_clerk', qcPass = true }) {
  const po = core.createPO({ supplierCode, warehouseCode, actor: 'procurement_buyer', lines: [{ itemCode, orderedQty: qty, unitCostQirsh }] });
  core.poAction(po.id, 'SUBMITTED', 'procurement_buyer');
  core.poAction(po.id, 'APPROVED', 'warehouse_manager');
  const gr = core.createReceipt({ poId: po.id, locationKey, actor, lines: [{ poLineId: po.lines[0].id, receivedQty: qty, rejectedQty: 0, batch, expiryDate }] });
  core.submitReceipt(gr.id, actor);
  core.startInspection(gr.id, 'qc_officer');
  core.recordQC(gr.id, [{ lineId: gr.lines[0].id, qcPass }], 'qc_officer');
  core.postReceipt(gr.id, 'qc_officer');
  return { po, gr };
}

function buildTraceModel(core, trace) {
  return {
    itemCode: trace.itemCode,
    itemName: ({ 'PARA-500': 'Paracetamol 500 mg tablets', 'AMOX-500': 'Amoxicillin 500 mg capsules', 'AMOX-1000': 'Amoxicillin 1000 mg tablets', 'AUGM-625': 'Amoxicillin/clavulanate 625 mg', 'AUGM-1000': 'Amoxicillin/clavulanate 1000 mg' })[trace.itemCode] ?? trace.itemCode,
    batch: trace.batch,
    expiryDate: trace.expiryDate,
    recall: trace.recall,
    supplier: trace.receipts.map(r => ({ ...r, supplierName: ({ 'SUP-001': 'United Pharmaceutical Supply Co.', 'SUP-002': 'Medical Consumables Supplier' })[r.supplierCode] ?? r.supplierCode })),
    shipments: trace.shipments.map(s => ({ ...s, customerName: ({ 'CUST-001': 'Al-Shifa Pharmacy · 6th of October', 'CUST-002': 'Al-Nasr Pharmacy · Sheikh Zayed' })[s.customerCode] ?? s.customerCode })),
    onHand: trace.onHand.map(x => ({ ...x, locationName: x.locationKey ? core.locations.get(x.locationKey)?.code ?? x.locationKey : 'Warehouse balance' })),
    totals: trace.totals,
    integrity: trace.integrity,
    limitations: [
      'Traceability ends at recorded warehouse dispatch; downstream patient or sub-pharmacy tracking is not implemented.',
      'Customer-return workflows are not modeled in this version.',
      'Traceability is batch-level; individual GS1 serial numbers are not tracked.',
    ],
  };
}

export function runInvoiceScenario(scenario = 'valid', { today = DEMO_TODAY } = {}) {
  const valid = scenario !== 'expired';
  const invoice = valid
    ? { itemCode: 'PARA-500', batch: 'BATCH-2027-OK', expiryDate: '2027-12-31', qty: 100, unitCostQirsh: 1250, invoiceNo: 'SUP-INV-24018' }
    : { itemCode: 'PARA-500', batch: 'BATCH-EXP-99', expiryDate: '2024-01-01', qty: 50, unitCostQirsh: 1250, invoiceNo: 'SUP-INV-23902' };
  return runInvoiceFromExtraction(invoice, { today });
}

export function runInvoiceFromExtraction(invoice, { today = DEMO_TODAY } = {}) {
  const core = createDemoCore(today);
  const lines = [
    'OmNi-Ledger · deterministic receiving scenario',
    `Invoice: ${invoice.invoiceNo ?? 'UNNUMBERED'}`,
    `Item: ${invoice.itemCode}`,
    `Batch: ${invoice.batch}`,
    `Expiry: ${invoice.expiryDate}`,
    `Quantity: ${invoice.qty} boxes`,
    '',
  ];
  let decision = 'ACCEPTED';
  let blockCode = null;
  let blockMessage = null;
  let receipt = null;
  try {
    const posted = postReceipt(core, { ...invoice, actor: 'receiving_clerk' });
    receipt = { poId: posted.po.id, receiptId: posted.gr.id, status: posted.gr.status };
    lines.push('DETERMINISTIC GATE: PASS');
    lines.push(`Goods receipt: ${posted.gr.id}`);
    lines.push(`Stock posted: ${core.getBalance(invoice.itemCode, 'WH-OCT6')} boxes`);
    lines.push('Decision: ACCEPTED');
  } catch (error) {
    decision = 'BLOCKED';
    blockCode = error?.code ?? 'DOMAIN_ERROR';
    blockMessage = explainDomainCode(blockCode);
    lines.push('DETERMINISTIC GATE: HARD BLOCK');
    lines.push(`Control code: ${blockCode}`);
    lines.push(`Reason: ${blockMessage}`);
    lines.push('Decision: BLOCKED — no accepted stock receipt was posted.');
  }
  const seal = core.createSeal();
  const integrity = { ledger: core.verifyLedgerIntegrity(), audit: core.verifyAuditIntegrity(), seal: core.verifySeal(seal) };
  lines.push('');
  lines.push(`Ledger integrity: ${integrity.ledger.ok ? 'VALID' : 'INVALID'}`);
  lines.push(`Audit integrity: ${integrity.audit.ok ? 'VALID' : 'INVALID'}`);
  lines.push(`State seal: ${integrity.seal.ok ? 'VALID' : 'INVALID'}`);
  lines.push(`Merkle root: ${seal.merkleRoot}`);
  return { scenario: decision === 'ACCEPTED' ? 'valid' : 'blocked', decision, blockCode, blockMessage, invoice, receipt, balance: core.getBalance(invoice.itemCode, 'WH-OCT6'), quarantineBalance: core.getQuarantineBalance(invoice.itemCode, 'WH-OCT6'), core, seal, integrity, lines, generatedAt: new Date().toISOString() };
}

export function runRecallScenario({ batch = DEMO_BATCH, refNo = 'DEMO-RECALL-017', reason = 'Suspected quality defect — demonstration scenario', today = DEMO_TODAY } = {}) {
  const core = createDemoCore(today);
  const itemCode = 'PARA-500';
  const supplierReceipt = postReceipt(core, { itemCode, batch, expiryDate: '2027-06-30', qty: 100, unitCostQirsh: 1250 });

  const dispatchedOrder = core.createSO({ customerCode: 'CUST-001', warehouseCode: 'WH-OCT6', actor: 'sales_clerk', lines: [{ itemCode, orderedQty: 30 }] });
  core.soAction(dispatchedOrder.id, 'SUBMITTED', 'sales_clerk');
  core.allocateSO(dispatchedOrder.id, 'warehouse_operator');
  core.confirmPick(dispatchedOrder.id, dispatchedOrder.allocations.map(a => ({ allocationId: a.id, scannedItemCode: a.itemCode, scannedBatch: a.batch })), 'picker');
  core.packSO(dispatchedOrder.id, 'packing_operator');
  core.dispatchSO(dispatchedOrder.id, 'dispatch_operator');

  const openOrder = core.createSO({ customerCode: 'CUST-002', warehouseCode: 'WH-OCT6', actor: 'sales_clerk', lines: [{ itemCode, orderedQty: 20 }] });
  core.soAction(openOrder.id, 'SUBMITTED', 'sales_clerk');
  core.allocateSO(openOrder.id, 'warehouse_operator');

  const recall = core.recallBatch({ itemCode, batch, warehouseCode: 'WH-OCT6', refNo, reason, actor: 'quality_officer', approver: 'qa_manager' });
  let pickBlock = null;
  try {
    core.confirmPick(openOrder.id, openOrder.allocations.map(a => ({ allocationId: a.id, scannedItemCode: a.itemCode, scannedBatch: a.batch })), 'picker');
    pickBlock = { blocked: false, code: null, message: 'Unexpectedly allowed recalled allocation.' };
  } catch (error) {
    pickBlock = { blocked: true, code: error?.code ?? 'DOMAIN_ERROR', message: explainDomainCode(error?.code ?? 'DOMAIN_ERROR') };
  }

  const trace = core.traceBatch(itemCode, batch);
  const traceModel = buildTraceModel(core, trace);
  const recallImpact = { ...recall.impact, openOrders: recall.impact.openOrders.map(order => ({ ...order, actionRequired: order.pickedQty > 0 ? 'Return picked units to quarantine, then reallocate.' : 'Reallocate to a non-recalled batch before picking.' })) };
  const seal = core.createSeal();
  const integrity = { ledger: core.verifyLedgerIntegrity(), audit: core.verifyAuditIntegrity(), seal: core.verifySeal(seal) };
  const eventRows = core.audit.slice(-16).reverse().map(e => ({ eventType: e.eventType, entityType: e.entityType, entityId: e.entityId, actor: e.actor, timestamp: e.timestamp, hash: e.hash, prevHash: e.prevHash }));
  const lines = [
    'OmNi-Ledger · batch recall walkthrough',
    `Item: ${itemCode}`,
    `Batch: ${batch}`,
    `Recall reference: ${refNo}`,
    `Recall status: ${recall.recall.status}`,
    `Quarantined in selected warehouse: ${recall.recall.heldQty} boxes`,
    `Previously dispatched: ${trace.totals.shippedBaseUnits} boxes`,
    `Recorded customer destinations: ${traceModel.shipments.map(s => s.customerName).join(', ') || 'None'}`,
    `On hand: ${trace.totals.onHandBaseUnits} boxes`,
    `Post-recall picking: ${pickBlock.blocked ? 'HARD BLOCK' : 'UNEXPECTED ALLOW'}`,
    `Block code: ${pickBlock.code ?? 'NONE'}`,
    `Ledger integrity: ${integrity.ledger.ok ? 'VALID' : 'INVALID'}`,
    `Audit integrity: ${integrity.audit.ok ? 'VALID' : 'INVALID'}`,
    `Merkle root: ${seal.merkleRoot}`,
  ];
  return {
    core, itemCode, batch, refNo, reason, supplierReceipt, dispatchedOrder, openOrder, recall: recall.recall,
    recallImpact, pickBlock, trace, traceModel, seal, integrity, eventRows, lines,
    generatedAt: new Date().toISOString(),
  };
}

export function explainDomainCode(code) {
  const map = {
    EXPIRED_GOODS: 'The batch is expired. Receiving is rejected before stock can become available.',
    RECALLED_BATCH: 'The batch is under an active recall. The requested operation is blocked.',
    SEGREGATION_OF_DUTIES: 'The initiator and approver must be different people.',
    REF_REQUIRED: 'A recall reference is required.',
    REASON_REQUIRED: 'A documented reason is required.',
    UNKNOWN_BATCH: 'The specified batch is not present in the ledger.',
    NO_STOCK: 'No eligible, non-expired, unreserved stock is available.',
    BATCH_EXPIRY_CONFLICT: 'This batch already exists with a different expiry date.',
    ITEM_MISMATCH: 'The scanned item does not match the allocated item.',
    BATCH_MISMATCH: 'The scanned batch does not match the allocation.',
    INSUFFICIENT_STOCK: 'The location does not contain enough available stock for the transfer.',
    INVALID_TRANSITION: 'The requested state transition is not allowed.',
  };
  return map[code] ?? 'The deterministic policy engine rejected the operation. Review the control code and audit trail.';
}
