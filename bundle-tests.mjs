// OmNi v2.3 — اختبارات حزمة الحالة (تصدير/استيراد)
import * as __dm from './domain.mjs'; globalThis.__d = __dm;
import { OmNiCore, seedDemo } from './domain.mjs';
import { StepLog, QCStation, createFullSeal } from './qc-station.mjs';
import { exportBundle, importBundle, bundleFileName } from './state-bundle.mjs';
let pass = 0, fail = 0; const t = (n, fn) => { try { fn(); pass++; console.log('✓', n); } catch (e) { fail++; console.log('✗', n, '→', e.message); } };
const eq = (a, b, m = '') => { if (a !== b) throw new Error(`${m} expected ${b} got ${a}`); };
const code = (fn, c) => { try { fn(); } catch (e) { if (e.code !== c) throw new Error(`expected ${c} got ${e.code}: ${e.message}`); return; } throw new Error(`expected throw ${c}`); };
let T = Date.parse('2026-10-02T08:00:00Z'); const now = () => new Date(T), tick = (s) => { T += s * 1000; };
function world() {
  const core = seedDemo(new OmNiCore({ now })); core.today = '2026-10-02';
  const po = core.createPO({ supplierCode: 'SUP-001', warehouseCode: 'WH-OCT6', actor: 'buyer', lines: [{ itemCode: 'AMOX-500', orderedQty: 100, unitCostQirsh: 1000 }] });
  core.poAction(po.id, 'SUBMITTED', 'buyer'); core.poAction(po.id, 'APPROVED', 'manager');
  const gr = core.createReceipt({ poId: po.id, locationKey: 'WH-OCT6/A-01-01', actor: 'recv', lines: [{ poLineId: po.lines[0].id, receivedQty: 100, batch: 'B1', expiryDate: '2028-01-01' }] });
  core.submitReceipt(gr.id, 'recv'); core.startInspection(gr.id, 'q'); core.recordQC(gr.id, gr.lines.map(l => ({ lineId: l.id, qcPass: true })), 'q'); core.postReceipt(gr.id, 'q');
  const log = new StepLog({ now, bind: core.audit[0]?.hash || 'GENESIS' }); const st = new QCStation(core, log);
  const so = core.createSO({ customerCode: 'CUST-001', warehouseCode: 'WH-OCT6', actor: 's', lines: [{ itemCode: 'AMOX-500', orderedQty: 10 }] });
  core.soAction(so.id, 'SUBMITTED', 's'); core.allocateSO(so.id, 's');
  for (const a of so.allocations) { tick(20); core.confirmPick(so.id, [{ allocationId: a.id, scannedItemCode: a.itemCode, scannedBatch: a.batch }], 'p'); }
  tick(5); st.startQC(so.id, 'checker'); for (const a of so.allocations) { tick(5); st.scanLine(so.id, 'checker', { allocationId: a.id, scannedItemCode: a.itemCode, scannedBatch: a.batch, countedQty: a.qty }); } tick(5); st.approveQC(so.id, 'checker');
  return { core, log };
}
t('التصدير بيطلع حزمة فيها الدفتر وسجل الفحص وعدّاد صح', () => { const { core, log } = world(); const b = exportBundle(core, log, { now }); eq(b.format, 'omni-state'); eq(b.counts.ledger, core.ledger.length); eq(b.counts.qc, log.events.length); if (!(log.events.length > 0)) throw new Error('qc empty'); });
t('اسم الملف فيه التاريخ والوقت', () => { const { core, log } = world(); const n = bundleFileName(exportBundle(core, log, { now })); if (!/^omni-state-\d{8}-\d{4}\.json$/.test(n)) throw new Error(n); });
t('دورة كاملة: تصدير ← JSON.stringify ← استيراد = نفس الحالة والسجل', () => { const { core, log } = world(); const b = exportBundle(core, log, { now }); const r = importBundle(JSON.stringify(b), { now }); eq(r.core.stateHash(), core.stateHash()); eq(r.log._head, log._head); eq(r.log.events.length, log.events.length); });
t('الختم الشامل جوّه الحزمة بيتحقق عند الاستيراد', () => { const { core, log } = world(); const seal = createFullSeal(core, log); const r = importBundle(JSON.stringify(exportBundle(core, log, { seal, now })), { now }); eq(r.report.sealChecked, true); });
t('ملف اتعدّل بإيد (كمية في الدفتر): CHECKSUM_MISMATCH', () => { const { core, log } = world(); const b = JSON.parse(JSON.stringify(exportBundle(core, log, { now }))); b.core.ledger[0].qty = 9999; code(() => importBundle(b, { now }), 'CHECKSUM_MISMATCH'); });
t('تعديل + إعادة حساب المجموع: الدفتر نفسه بيرفض (LEDGER_REJECTED)', () => { const { core, log } = world(); const b = JSON.parse(JSON.stringify(exportBundle(core, log, { now }))); b.core.ledger[0].qty = 9999; const { sha256, canonical } = globalThis.__d; b.checksum = sha256(canonical({ core: b.core, qcLog: b.qcLog, seal: b.seal ?? null })); code(() => importBundle(b, { now }), 'LEDGER_REJECTED'); });
t('سجل فحص مقصوص + مجموع معاد حسابه: QC_LOG_REJECTED أو فشل الختم', () => { const { core, log } = world(); const seal = createFullSeal(core, log); const b = JSON.parse(JSON.stringify(exportBundle(core, log, { seal, now }))); b.qcLog.events.pop(); const { sha256, canonical } = globalThis.__d; b.checksum = sha256(canonical({ core: b.core, qcLog: b.qcLog, seal: b.seal })); let c = null; try { importBundle(b, { now }); } catch (e) { c = e.code; } if (!['QC_LOG_REJECTED', 'SEAL_FAIL'].includes(c)) throw new Error('got ' + c); });
t('ملف مش حزمة / JSON بايظ / نسخة غريبة', () => { code(() => importBundle('{{', { now }), 'NOT_JSON'); code(() => importBundle({ a: 1 }, { now }), 'NOT_BUNDLE'); const { core, log } = world(); const b = exportBundle(core, log, { now }); b.v = 9; code(() => importBundle(b, { now }), 'BAD_BUNDLE_VERSION'); });
t('الاستيراد الفاشل مابيلمسش حاجة (مفيش أثر جانبي)', () => { const { core, log } = world(); const h = core.stateHash(); const b = exportBundle(core, log, { now }); b.checksum = 'x'; try { importBundle(b, { now }); } catch (e) { } eq(core.stateHash(), h); });
console.log(`\n${pass} نجح · ${fail} فشل`); process.exit(fail ? 1 : 0);
