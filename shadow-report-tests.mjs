import { OmNiCore, seedDemo } from './domain.mjs';
import { StepLog, QCStation, createFullSeal } from './qc-station.mjs';
import { buildShadowReport, eventsCsv, esc } from './shadow-report.mjs';
let pass = 0, fail = 0; const t = (n, fn) => { try { fn(); pass++; console.log('✓', n); } catch (e) { fail++; console.log('✗', n, '→', e.message); } };
const has = (s, x) => { if (!s.includes(x)) throw new Error('missing: ' + x); }; const no = (s, x) => { if (s.includes(x)) throw new Error('unexpected: ' + x); };
let T = Date.parse('2026-10-02T08:00:00Z'); const now = () => new Date(T), tick = (s) => { T += s * 1000; };
function world(actor = 'p1') {
  const core = seedDemo(new OmNiCore({ now })); core.today = '2026-10-02';
  const po = core.createPO({ supplierCode: 'SUP-001', warehouseCode: 'WH-OCT6', actor: 'buyer', lines: [{ itemCode: 'AMOX-500', orderedQty: 100, unitCostQirsh: 1000 }] });
  core.poAction(po.id, 'SUBMITTED', 'buyer'); core.poAction(po.id, 'APPROVED', 'manager');
  const gr = core.createReceipt({ poId: po.id, locationKey: 'WH-OCT6/A-01-01', actor: 'recv', lines: [{ poLineId: po.lines[0].id, receivedQty: 100, batch: 'B1', expiryDate: '2028-01-01' }] });
  core.submitReceipt(gr.id, 'recv'); core.startInspection(gr.id, 'q'); core.recordQC(gr.id, gr.lines.map(l => ({ lineId: l.id, qcPass: true })), 'q'); core.postReceipt(gr.id, 'q');
  const log = new StepLog({ now, bind: core.audit[0]?.hash || 'GENESIS' }); const st = new QCStation(core, log);
  const so = core.createSO({ customerCode: 'CUST-001', warehouseCode: 'WH-OCT6', actor: 's', lines: [{ itemCode: 'AMOX-500', orderedQty: 10 }] });
  core.soAction(so.id, 'SUBMITTED', 's'); core.allocateSO(so.id, 's');
  for (const a of so.allocations) { tick(20); core.confirmPick(so.id, [{ allocationId: a.id, scannedItemCode: a.itemCode, scannedBatch: a.batch }], actor); }
  tick(5); st.startQC(so.id, 'checker'); for (const a of so.allocations) { tick(5); st.scanLine(so.id, 'checker', { allocationId: a.id, scannedItemCode: a.itemCode, scannedBatch: a.batch, countedQty: a.qty }); } tick(5); st.approveQC(so.id, 'checker');
  return { core, log };
}
t('بيانات تجريبية: بانر أحمر صريح "مش أداء حقيقي"', () => { const { core, log } = world(); const r = buildShadowReport(core, log, { now }); has(r.html, 'بيانات تجريبية'); has(r.html, 'مش أداء حقيقي'); });
t('عينة صغيرة: مفيش خطوط/ساعة ولا معدلات للفحص، بتظهر "عينة غير كافية"', () => { const { core, log } = world(); const r = buildShadowReport(core, log, { now }); has(r.html, 'عينة غير كافية'); no(r.html, 'MEASURED'); });
t('سلامة السجلات ظاهرة وفحص الشحنات من غير فحص معتمد = 0', () => { const { core, log } = world(); const r = buildShadowReport(core, log, { now }); if (!r.chainOk) throw new Error('chain'); has(r.html, '✓ سليم'); });
t('Shadow: بيظهر مرجع الإذن كـ"مُدخل يدويًا، غير مُتحقَّق منه"، ومن غيره تحذير', () => { const { core, log } = world(); has(buildShadowReport(core, log, { source: 'SHADOW', permitRef: 'إذن-123', now }).html, 'غير مُتحقَّق منه'); has(buildShadowReport(core, log, { source: 'SHADOW', now }).html, 'مرجع الإذن غير مذكور'); no(buildShadowReport(core, log, { source: 'SHADOW', permitRef: 'x', now }).html, 'مش أداء حقيقي'); });
t('الختم المرفق بيظهر برؤوسه، ومن غيره تحذير', () => { const { core, log } = world(); const seal = createFullSeal(core, log); has(buildShadowReport(core, log, { seal, now }).html, seal.merkleRoot); has(buildShadowReport(core, log, { now }).html, 'مفيش ختم مرفق'); });
t('XSS: اسم محضّر وسبب وردية فيها HTML بيتهرّب', () => { const { core, log } = world('<img src=x onerror=alert(1)>'); const r = buildShadowReport(core, log, { shiftLabel: '<script>1</script>', now }); no(r.html, '<img src=x'); no(r.html, '<script>1'); has(r.html, '&lt;img'); });
t('عينة ≥ الحد: المعدلات بتظهر (minSample=1)', () => { const { core, log } = world(); const r = buildShadowReport(core, log, { now, minSample: 1 }); no(r.html, 'عينة غير كافية'); });
t('سجل مكسور: التقرير يقول مش يُعتمد عليه', () => { const { core, log } = world(); log.events[0] = Object.freeze({ ...log.events[0], actor: 'evil' }); const r = buildShadowReport(core, log, { now }); if (r.chainOk) throw new Error('should fail'); has(r.html, 'مش يُعتمد عليه'); });
t('CSV: فيه أحداث الفحص والسحب، ومحمي من حقن المعادلات', () => { const { core, log } = world('=cmd|x'); const c = eventsCsv(core, log); has(c, 'QC_APPROVED'); has(c, 'PICK_CONFIRMED'); has(c, "\"'=cmd|x\""); });
t('source غلط بيترفض', () => { const { core, log } = world(); let ok = false; try { buildShadowReport(core, log, { source: 'X' }); } catch (e) { ok = true; } if (!ok) throw new Error('no throw'); });
const blockOnce = (core, actor) => { const so = core.createSO({ customerCode: 'CUST-001', warehouseCode: 'WH-OCT6', actor: 's', lines: [{ itemCode: 'AMOX-500', orderedQty: 5 }] }); core.soAction(so.id, 'SUBMITTED', 's'); core.allocateSO(so.id, 's'); try { core.confirmPick(so.id, [{ allocationId: so.allocations[0].id, scannedItemCode: 'AMOX-500', scannedBatch: 'ZZ' }], actor); } catch (e) { } };
t('المعدل ما يظهرش تحت حد العينة (أخطاء/ألف مسح = —)', () => { const { core, log } = world(); blockOnce(core, 'p1'); const r = buildShadowReport(core, log, { now }); const m = r.measure.pickers.p1; if (!(m.blocks >= 1) || m.status === 'MEASURED') throw new Error('setup'); has(r.html, '<td>—</td><td><span class="w">عينة غير كافية'); no(r.html, '<td>' + m.blocksPer1000Scans + '</td><td><span'); });
t('CSV: سبب الـBLOCK ظاهر في عمود التفاصيل', () => { const { core, log } = world(); blockOnce(core, 'p2'); const c = eventsCsv(core, log); has(c, 'PICK_BLOCKED'); has(c, 'BATCH_MISMATCH'); });
console.log(`\n${pass} نجح · ${fail} فشل`); process.exit(fail ? 1 : 0);
