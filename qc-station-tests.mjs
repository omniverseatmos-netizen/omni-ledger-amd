import { OmNiCore, seedDemo, DomainError } from './domain.mjs';
import { StepLog, QCStation, installQCGate, qcState, measure, StationError } from './qc-station.mjs';
import fs from 'node:fs';
let pass = 0, fail = 0; const t = (n, fn) => { try { fn(); pass++; console.log('✓', n); } catch (e) { fail++; console.log('✗', n, '→', e.message); } };
const eq = (a, b, m = '') => { if (a !== b) throw new Error(`${m} expected ${b} got ${a}`); };
const code = (fn, c) => { try { fn(); } catch (e) { if (e.code !== c) throw new Error(`expected ${c} got ${e.code}: ${e.message}`); return; } throw new Error(`expected throw ${c}`); };

let T = Date.parse('2026-10-02T08:00:00Z'); const now = () => new Date(T), tick = (s) => { T += s * 1000; };
function world() {
  const core = seedDemo(new OmNiCore({ now })); core.today = '2026-10-02';
  for (const [item, b] of [['AMOX-500', 'B1'], ['PARA-500', 'P1']]) {
    const po = core.createPO({ supplierCode: 'SUP-001', warehouseCode: 'WH-OCT6', actor: 'buyer', lines: [{ itemCode: item, orderedQty: 500, unitCostQirsh: 1000 }] });
    core.poAction(po.id, 'SUBMITTED', 'buyer'); core.poAction(po.id, 'APPROVED', 'manager');
    const gr = core.createReceipt({ poId: po.id, locationKey: 'WH-OCT6/A-01-01', actor: 'recv', lines: [{ poLineId: po.lines[0].id, receivedQty: 500, batch: b, expiryDate: '2028-01-01' }] });
    core.submitReceipt(gr.id, 'recv'); core.startInspection(gr.id, 'qc0'); core.recordQC(gr.id, gr.lines.map(l => ({ lineId: l.id, qcPass: true })), 'qc0'); core.postReceipt(gr.id, 'qc0');
  }
  const log = new StepLog({ now }); return { core, log, st: new QCStation(core, log) };
}
function order(core, qtyA = 5, qtyP = 3) {
  const so = core.createSO({ customerCode: 'CUST-001', warehouseCode: 'WH-OCT6', actor: 'sales', lines: [{ itemCode: 'AMOX-500', orderedQty: qtyA }, { itemCode: 'PARA-500', orderedQty: qtyP }] });
  core.soAction(so.id, 'SUBMITTED', 'sales'); core.allocateSO(so.id, 'sales'); return so;
}
const pickAll = (core, so, who = 'p1', gap = 20) => { for (const a of so.allocations) { tick(gap); core.confirmPick(so.id, [{ allocationId: a.id, scannedItemCode: a.itemCode, scannedBatch: a.batch }], who); } };
const good = (a) => ({ allocationId: a.id, scannedItemCode: a.itemCode, scannedBatch: a.batch, countedQty: a.qty });

t('البوابة مقفولة افتراضيًا: التغليف القديم شغّال زي ما هو', () => { const { core } = world(); const so = order(core); pickAll(core, so); core.packSO(so.id, 'k'); eq(core.sos.get(so.id).status, 'PACKED'); });
t('الفحص قبل اكتمال السحب → PICK_INCOMPLETE', () => { const { core, st } = world(); const so = order(core); core.confirmPick(so.id, [{ allocationId: so.allocations[0].id, scannedItemCode: so.allocations[0].itemCode, scannedBatch: so.allocations[0].batch }], 'p1'); code(() => st.startQC(so.id, 'q1'), 'PICK_INCOMPLETE'); });
t('اللي سحب مينفعش يفحص (فصل الصلاحيات)', () => { const { core, st } = world(); const so = order(core); pickAll(core, so, 'p1'); code(() => st.startQC(so.id, 'p1'), 'SEGREGATION_OF_DUTIES'); });
t('لازم اسم مراقب', () => { const { core, st } = world(); const so = order(core); pickAll(core, so); code(() => st.startQC(so.id, ' '), 'ACTOR_REQUIRED'); });
t('مسار سليم: فحص → اعتماد → التغليف يعدّي بالبوابة', () => {
  const { core, st } = world(); installQCGate(core, st, (c, m) => new DomainError(c, m)); const so = order(core); pickAll(core, so);
  st.startQC(so.id, 'q1'); for (const a of so.allocations) eq(st.scanLine(so.id, 'q1', good(a)).ok, true); st.approveQC(so.id, 'q1');
  eq(st.state(so.id).state, 'APPROVED'); core.packSO(so.id, 'k'); eq(core.sos.get(so.id).status, 'PACKED');
});
t('البوابة شغّالة + مفيش فحص → QC_REQUIRED (DomainError من النواة)', () => { const { core, st } = world(); installQCGate(core, st, (c, m) => new DomainError(c, m)); const so = order(core); pickAll(core, so); try { core.packSO(so.id, 'k'); throw new Error('مرّ'); } catch (e) { eq(e instanceof DomainError, true); eq(e.code, 'QC_REQUIRED'); } eq(core.sos.get(so.id).status, 'PICKING'); });
t('فحص شغّال لسه ما اتعتمدش → التغليف ممنوع', () => { const { core, st } = world(); installQCGate(core, st, (c, m) => new DomainError(c, m)); const so = order(core); pickAll(core, so); st.startQC(so.id, 'q1'); code(() => core.packSO(so.id, 'k'), 'QC_REQUIRED'); });
t('صنف مختلف (LASA) عند الفحص → فرق مسجّل والاعتماد ممنوع', () => {
  const { core, st } = world(); const so = order(core); pickAll(core, so); st.startQC(so.id, 'q1');
  const a = so.allocations[0], r = st.scanLine(so.id, 'q1', { ...good(a), scannedItemCode: 'AMOX-1000' }); eq(r.ok, false); eq(r.diffs[0].kind, 'ITEM');
  st.scanLine(so.id, 'q1', good(so.allocations[1])); code(() => st.approveQC(so.id, 'q1'), 'QC_INCOMPLETE');
});
t('تشغيلة غلط + كمية ناقصة → الاتنين بيتسجلوا', () => { const { core, st } = world(); const so = order(core); pickAll(core, so); st.startQC(so.id, 'q1'); const r = st.scanLine(so.id, 'q1', { ...good(so.allocations[0]), scannedBatch: 'ZZ', countedQty: 4 }); eq(r.diffs.map(d => d.kind).join(), 'BATCH,QTY'); });
t('تصحيح الفرق بمسح تاني صح يفتح الاعتماد، والفرق يفضل دليل', () => {
  const { core, st } = world(); const so = order(core); pickAll(core, so); st.startQC(so.id, 'q1'); const a = so.allocations[0];
  st.scanLine(so.id, 'q1', { ...good(a), countedQty: 1 }); st.scanLine(so.id, 'q1', good(a)); st.scanLine(so.id, 'q1', good(so.allocations[1]));
  st.approveQC(so.id, 'q1'); eq(core.sos.get(so.id).status, 'PICKING'); eq(st.log.events.filter(e => e.type === 'QC_LINE_DIFF').length, 1);
});
t('اعتماد قبل فحص كل البنود → QC_INCOMPLETE', () => { const { core, st } = world(); const so = order(core); pickAll(core, so); st.startQC(so.id, 'q1'); st.scanLine(so.id, 'q1', good(so.allocations[0])); code(() => st.approveQC(so.id, 'q1'), 'QC_INCOMPLETE'); });
t('الرفض لازم سبب، وبعده التغليف ممنوع وإعادة الفحص جولة 2', () => {
  const { core, st } = world(); installQCGate(core, st, (c, m) => new DomainError(c, m)); const so = order(core); pickAll(core, so); st.startQC(so.id, 'q1');
  code(() => st.rejectQC(so.id, 'q1', ''), 'REASON_REQUIRED'); st.rejectQC(so.id, 'q1', 'علبة تالفة'); eq(st.state(so.id).state, 'REJECTED'); code(() => core.packSO(so.id, 'k'), 'QC_REQUIRED');
  st.startQC(so.id, 'q2'); eq(st.state(so.id).round, 2);
});
t('مراقب تاني مينفعش يمسك فحص شغّال ولا يمسح فيه', () => { const { core, st } = world(); const so = order(core); pickAll(core, so); st.startQC(so.id, 'q1'); code(() => st.startQC(so.id, 'q2'), 'QC_OWNED'); code(() => st.scanLine(so.id, 'q2', good(so.allocations[0])), 'QC_OWNED'); });
t('المسح قبل بدء الفحص ممنوع', () => { const { core, st } = world(); const so = order(core); pickAll(core, so); code(() => st.scanLine(so.id, 'q1', good(so.allocations[0])), 'QC_NOT_STARTED'); });
t('سجل الفحص: سلسلة سليمة، والتعديل يتكشف، والاستيراد المكسور يترفض', () => {
  const { core, st, log } = world(); const so = order(core); pickAll(core, so); st.startQC(so.id, 'q1'); for (const a of so.allocations) st.scanLine(so.id, 'q1', good(a)); st.approveQC(so.id, 'q1');
  eq(log.verify().ok, true); const j = JSON.parse(JSON.stringify(log.toJSON())); j.events[1].allocationId = 'X'; code(() => StepLog.fromJSON(j), 'QC_LOG_TAMPERED');
  const j2 = JSON.parse(JSON.stringify(log.toJSON())); j2.events.pop(); code(() => StepLog.fromJSON(j2), 'QC_LOG_TAMPERED'); eq(StepLog.fromJSON(JSON.parse(JSON.stringify(log.toJSON()))).verify().ok, true);
});
t('القياس: عينة صغيرة = INSUFFICIENT_SAMPLE ومفيش معدل مكتوب', () => {
  const { core, st, log } = world(); const so = order(core); pickAll(core, so); const m = measure(core, log); eq(m.pickers.p1.status, 'INSUFFICIENT_SAMPLE'); eq(m.pickers.p1.linesPerHour, null); eq(m.qcWait.medianMs, null);
});
t('القياس: خطوط/ساعة + أخطاء/1000 + انتظار الجودة بأرقام حسابية مضبوطة', () => {
  const { core, st, log } = world();
  for (let i = 0; i < 3; i++) { const so = order(core); pickAll(core, so, 'p1', 30); tick(120); st.startQC(so.id, 'q1'); tick(45); for (const a of so.allocations) st.scanLine(so.id, 'q1', good(a)); tick(15); st.approveQC(so.id, 'q1'); }
  const so4 = order(core); tick(5); try { core.confirmPick(so4.id, [{ allocationId: so4.allocations[0].id, scannedItemCode: 'WRONG', scannedBatch: 'B1' }], 'p1'); } catch (e) { eq(e.code, 'ITEM_MISMATCH'); }
  const m = measure(core, log, { minSample: 3 }), p = m.pickers.p1;
  eq(p.orders, 3); eq(p.lines, 6); eq(p.spanMs, 3 * 30000); eq(p.blocks, 1); eq(p.blocksPer1000Scans, Math.round(1000 / 7)); eq(p.status, 'MEASURED'); eq(p.linesPerHour, 240);
  eq(m.qcWait.n, 3); eq(m.qcWait.medianMs, 120000); eq(m.qcWait.p90Ms, 120000); const q = m.checkers.q1; eq(q.approvals, 3); eq(q.medianDurationMs, 60000); eq(q.diffsPer1000Lines, 0);
  eq(m.chain.qcLog.ok, true); eq(m.chain.coreAudit.ok, true);
});
t('القياس: فروق الفحص بتتحسب لكل 1000 بند', () => {
  const { core, st, log } = world(); const so = order(core); pickAll(core, so); st.startQC(so.id, 'q1'); st.scanLine(so.id, 'q1', { ...good(so.allocations[0]), countedQty: 1 }); st.scanLine(so.id, 'q1', good(so.allocations[0])); st.scanLine(so.id, 'q1', good(so.allocations[1]));
  const q = measure(core, log).checkers.q1; eq(q.linesChecked, 3); eq(q.diffs, 1); eq(q.diffsPer1000Lines, 333);
});
t('نسخة النواة داخل index.html مطابقة لـ domain.mjs (منع الانجراف)', () => {
  const d = fs.readFileSync('./domain.mjs', 'utf8'), h = fs.readFileSync('./index.html', 'utf8'), inl = h.match(/<script type="module">([\s\S]*?)<\/script>/)[1];
  const cls = (s) => { const i = s.indexOf('class OmNiCore {'), j = s.indexOf('\n}\n', i); return s.slice(i, j + 3).replace(/\s+/g, ''); };
  eq(cls(d) === cls(inl), true, 'النواة اتفرقت بين الملفين');
});
console.log(`\n${pass} نجح / ${fail} فشل`); if (fail) process.exit(1);
