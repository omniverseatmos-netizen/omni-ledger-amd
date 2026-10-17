// OmNi v2.2 — اختبارات إغلاق الثغرات اللي ظهرت في تجربة الموبايل (2 أكتوبر 2026)
import { OmNiCore, seedDemo, operationalSnapshot } from './domain.mjs';
import { StepLog, QCStation, installQCGate, measure, createFullSeal, verifyFullSeal } from './qc-station.mjs';
let pass = 0, fail = 0; const t = (n, fn) => { try { fn(); pass++; console.log('✓', n); } catch (e) { fail++; console.log('✗', n, '→', e.message); } };
const eq = (a, b, m = '') => { if (a !== b) throw new Error(`${m} expected ${b} got ${a}`); };
const code = (fn, c) => { try { fn(); } catch (e) { if (e.code !== c) throw new Error(`expected ${c} got ${e.code}: ${e.message}`); return; } throw new Error(`expected throw ${c}`); };
let T = Date.parse('2026-10-02T08:00:00Z'); const now = () => new Date(T), tick = (s) => { T += s * 1000; };

function world(stock = 80) {
  const core = seedDemo(new OmNiCore({ now })); core.today = '2026-10-02';
  const po = core.createPO({ supplierCode: 'SUP-001', warehouseCode: 'WH-OCT6', actor: 'buyer', lines: [{ itemCode: 'AMOX-500', orderedQty: stock, unitCostQirsh: 1000 }] });
  core.poAction(po.id, 'SUBMITTED', 'buyer'); core.poAction(po.id, 'APPROVED', 'manager');
  const gr = core.createReceipt({ poId: po.id, locationKey: 'WH-OCT6/A-01-01', actor: 'recv', lines: [{ poLineId: po.lines[0].id, receivedQty: stock, batch: 'B1', expiryDate: '2028-01-01' }] });
  core.submitReceipt(gr.id, 'recv'); core.startInspection(gr.id, 'qc0'); core.recordQC(gr.id, gr.lines.map(l => ({ lineId: l.id, qcPass: true })), 'qc0'); core.postReceipt(gr.id, 'qc0');
  const log = new StepLog({ now }); return { core, log, st: new QCStation(core, log) };
}
function order(core, qty) {
  const so = core.createSO({ customerCode: 'CUST-001', warehouseCode: 'WH-OCT6', actor: 'sales', lines: [{ itemCode: 'AMOX-500', orderedQty: qty }] });
  core.soAction(so.id, 'SUBMITTED', 'sales'); core.allocateSO(so.id, 'sales'); return so;
}
const pickAll = (core, so, who = 'p1') => { for (const a of so.allocations) { tick(20); core.confirmPick(so.id, [{ allocationId: a.id, scannedItemCode: a.itemCode, scannedBatch: a.batch }], who); } };
const good = (a) => ({ allocationId: a.id, scannedItemCode: a.itemCode, scannedBatch: a.batch, countedQty: a.qty });

// ── النقص (حالة SO-000002: مطلوب 100 ومتاح 80 اتشحن بصمت) ──
t('أوردر 100 والمتاح 80: التخصيص 80 والنقص 20 متسجّل', () => { const { core } = world(); const so = order(core, 100); eq(so.lines[0].allocatedQty, 80); eq(so.lines[0].shortage, 20); });
t('التغليف بيترفض بـSHORTAGE_UNACKNOWLEDGED من غير إقرار (كان بيعدّي بصمت)', () => { const { core } = world(); const so = order(core, 100); pickAll(core, so); code(() => core.packSO(so.id, 'k'), 'SHORTAGE_UNACKNOWLEDGED'); eq(core.sos.get(so.id).status, 'PICKING'); });
t('الإقرار محتاج اسم وسبب', () => { const { core } = world(); const so = order(core, 100); code(() => core.acknowledgeShortage(so.id, '', 'عميل وافق'), 'ACTOR_REQUIRED'); code(() => core.acknowledgeShortage(so.id, 'sup', ' ا'), 'REASON_REQUIRED'); });
t('بعد الإقرار التغليف والصرف يعدّوا، والإقرار في سجل التدقيق بالتفاصيل', () => {
  const { core } = world(); const so = order(core, 100); pickAll(core, so);
  core.acknowledgeShortage(so.id, 'sup', 'العميل وافق على 80 والباقي لاحقًا'); core.packSO(so.id, 'k'); core.dispatchSO(so.id, 'd');
  const ev = core.audit.find(e => e.eventType === 'SO_SHORTAGE_ACKNOWLEDGED'); eq(!!ev, true); eq(ev.afterState.shortages[0].short, 20); eq(ev.actorId, 'sup'); eq(core.verifyAuditIntegrity().ok, true);
});
t('أوردر مفيهوش نقص: الإقرار مرفوض (NO_SHORTAGE) والتغليف عادي', () => { const { core } = world(); const so = order(core, 50); code(() => core.acknowledgeShortage(so.id, 'sup', 'سبب'), 'NO_SHORTAGE'); pickAll(core, so); core.packSO(so.id, 'k'); });
t('الإقرار بيفضل بعد حفظ واستيراد الحالة', () => { const { core } = world(); const so = order(core, 100); core.acknowledgeShortage(so.id, 'sup', 'سبب واضح'); const c2 = OmNiCore.fromJSON(JSON.parse(JSON.stringify(core.toJSON())), { now }); eq(c2.sos.get(so.id).shortageAck.reason, 'سبب واضح'); });
t('لقطة العامل بتعرض حاجز النقص لحد الإقرار', () => { const { core } = world(); const so = order(core, 100); eq(operationalSnapshot(core, so.id).blockers.some(b => b.code === 'SHORTAGE_UNACKNOWLEDGED'), true); core.acknowledgeShortage(so.id, 'sup', 'سبب واضح'); eq(operationalSnapshot(core, so.id).blockers.some(b => b.code === 'SHORTAGE_UNACKNOWLEDGED'), false); });
t('الإقرار بعد الصرف مرفوض', () => { const { core } = world(); const so = order(core, 100); pickAll(core, so); core.acknowledgeShortage(so.id, 'sup', 'سبب واضح'); core.packSO(so.id, 'k'); core.dispatchSO(so.id, 'd'); code(() => core.acknowledgeShortage(so.id, 'sup', 'سبب تاني'), 'INVALID_STATE'); });

// ── القياس: شحنات من غير فحص / جزئية ──
t('القياس بيعدّ الشحنات من غير فحص معتمد والجزئية المُقرّة وغير المُقرّة', () => {
  const { core, log, st } = world(200);
  const a = order(core, 20); pickAll(core, a); core.packSO(a.id, 'k'); core.dispatchSO(a.id, 'd');            // من غير فحص
  const b = order(core, 20); pickAll(core, b); st.startQC(b.id, 'q1'); st.scanLine(b.id, 'q1', good(b.allocations[0])); st.approveQC(b.id, 'q1'); core.packSO(b.id, 'k'); core.dispatchSO(b.id, 'd'); // بفحص
  const s = measure(core, log).shipments; eq(s.dispatched, 2); eq(s.withoutApprovedQC, 1); eq(s.partial, 0);
  const c = order(core, 500); pickAll(core, c); core.acknowledgeShortage(c.id, 'sup', 'متفق عليه'); core.packSO(c.id, 'k'); core.dispatchSO(c.id, 'd');
  const s2 = measure(core, log).shipments; eq(s2.partial, 1); eq(s2.partialUnacknowledged, 0); eq(s2.withoutApprovedQC, 2);
});

// ── الختم الكامل: دفتر المخزن + سجل الفحص ──
function sealed() {
  const { core, log, st } = world(200); const so = order(core, 10); pickAll(core, so); st.startQC(so.id, 'q1'); st.scanLine(so.id, 'q1', good(so.allocations[0])); st.approveQC(so.id, 'q1');
  return { core, log, st, so, seal: createFullSeal(core, log) };
}
t('الختم الكامل بيحمل رأس سجل الفحص ويتحقق سليم', () => { const { core, log, seal } = sealed(); eq(seal.version, 2); eq(seal.qc.entries, 3); const r = verifyFullSeal(core, log, seal); eq(r.ok, true); eq(r.qc.entries, 3); });
t('أحداث فحص جديدة بعد الختم مش بتكسره', () => { const { core, log, st, seal } = sealed(); const so2 = order(core, 5); pickAll(core, so2); st.startQC(so2.id, 'q1'); eq(verifyFullSeal(core, log, seal).ok, true); });
t('قص سجل الفحص بعد الختم بيتكشف', () => { const { core, log, seal } = sealed(); const cut = StepLog.fromJSON(JSON.parse(JSON.stringify(log.toJSON())), { now }); cut.events.pop(); cut._head = cut.events.at(-1).hash; const r = verifyFullSeal(core, cut, seal); eq(r.ok, false); eq(r.reason, 'QC_LOG_SHORTER_THAN_SEAL'); });
t('سجل فحص جديد فاضي بدل الأصلي بيتكشف (مسح السجل)', () => { const { core, seal } = sealed(); const r = verifyFullSeal(core, new StepLog({ now }), seal); eq(r.ok, false); eq(r.reason, 'QC_LOG_SHORTER_THAN_SEAL'); });
t('تعديل حدث في السجل بيتكشف (سلسلة مكسورة)', () => { const { core, log, seal } = sealed(); const j = JSON.parse(JSON.stringify(log.toJSON())); j.events[1].actor = 'someone-else'; code(() => StepLog.fromJSON(j, { now }), 'QC_LOG_TAMPERED'); const bad = new StepLog({ now }); bad.events = j.events; bad._head = j.head; const r = verifyFullSeal(core, bad, seal); eq(r.ok, false); eq(r.reason, 'QC_LOG_BROKEN'); });
t('سجل مُعاد بناؤه بنفس الطول لكن بأحداث مختلفة بيتكشف (HEAD)', () => { const { core, seal } = sealed(); const other = new StepLog({ now }); other.record('QC_STARTED', 'SO-X', 'q9', { round: 1 }); other.record('QC_LINE_OK', 'SO-X', 'q9', { allocationId: 'a' }); other.record('QC_APPROVED', 'SO-X', 'q9', { lines: 1, diffsFound: 0, durationMs: 1 }); const r = verifyFullSeal(core, other, seal); eq(r.ok, false); eq(r.reason, 'QC_HEAD_MISMATCH'); });
t('ختم النواة القديم (v1 بدون qc) لسه بيتحقق، ومعلَّم إنه مش شامل الجودة', () => { const { core, log } = sealed(); const old = core.createSeal(); const r = verifyFullSeal(core, log, old); eq(r.ok, true); eq(r.qc, 'NOT_COVERED'); });
t('تعديل في دفتر المخزن بيتكشف برضه من الختم الكامل', () => { const { core, log, seal } = sealed(); core.ledger[0] = { ...core.ledger[0], qty: core.ledger[0].qty + 1 }; const r = verifyFullSeal(core, log, seal); eq(r.ok, false); eq(r.part, 'LEDGER'); });
t('مينفعش نختم سجل فحص مكسور', () => { const { core, log } = sealed(); log.events[0] = { ...log.events[0], actor: 'x' }; code(() => createFullSeal(core, log), 'QC_LOG_TAMPERED'); });
console.log(`\n${pass} نجح / ${fail} فشل`); if (fail) process.exit(1);
