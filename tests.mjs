import { OmNiCore, seedDemo, sha256, canonical, DomainError, buildPickLayout, DEMO_PICK_LAYOUT, intentOf, GuidanceSession, resolveVoiceQuery, resolveScanCode, operationalSnapshot } from './domain.mjs';
import crypto from 'node:crypto';
let pass = 0, fail = 0; const failed = [];
const t = (name, fn) => { try { fn(); pass++; console.log('✓', name); } catch (e) { fail++; failed.push(name); console.log('✗', name, '→', e.message); } };
const eq = (a, b, m = '') => { if (a !== b) throw new Error(`${m} expected ${b} got ${a}`); };
const throwsCode = (fn, code) => { try { fn(); } catch (e) { if (e.code !== code) throw new Error(`expected ${code} got ${e.code}`); return; } throw new Error(`expected throw ${code}`); };

function fresh() { const c = seedDemo(new OmNiCore()); c.today = '2026-10-01'; return c; }
function receive(c, item, batch, expiry, qty, { rej = 0, loc = 'WH-OCT6/A-01-01', qc = true } = {}) {
  const po = c.createPO({ supplierCode: 'SUP-001', warehouseCode: 'WH-OCT6', actor: 'buyer', lines: [{ itemCode: item, orderedQty: qty, unitCostQirsh: 1250 }] });
  c.poAction(po.id, 'SUBMITTED', 'buyer'); c.poAction(po.id, 'APPROVED', 'manager');
  const gr = c.createReceipt({ poId: po.id, locationKey: loc, actor: 'recv', lines: [{ poLineId: po.lines[0].id, receivedQty: qty, rejectedQty: rej, batch, expiryDate: expiry }] });
  c.submitReceipt(gr.id, 'recv'); c.startInspection(gr.id, 'qc');
  c.recordQC(gr.id, [{ lineId: gr.lines[0].id, qcPass: qc }], 'qc'); c.postReceipt(gr.id, 'qc'); return gr;
}
function sell(c, item, qty) { const so = c.createSO({ customerCode: 'CUST-001', warehouseCode: 'WH-OCT6', actor: 'sales', lines: [{ itemCode: item, orderedQty: qty }] }); c.soAction(so.id, 'SUBMITTED', 'sales'); c.allocateSO(so.id, 'sales'); return so; }

t('SHA-256 يطابق نواة Node (متجهات + عربي + حدود الـpadding)', () => { for (const s of ['', 'abc', 'أومني', 'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(64), 'x'.repeat(1000)]) eq(sha256(s), crypto.createHash('sha256').update(s).digest('hex'), s.slice(0, 5)); });
t('canonical يرفض الكسور', () => throwsCode(() => canonical({ a: 1.5 }), 'NON_INTEGER'));
t('canonical ثابت بصرف النظر عن ترتيب المفاتيح', () => eq(canonical({ b: 1, a: 2 }), canonical({ a: 2, b: 1 })));
t('دورة كاملة: شراء → استلام → QC → ترحيل → صرف', () => {
  const c = fresh(); receive(c, 'PARA-500', 'B1', '2027-06-30', 100);
  eq(c.getBalance('PARA-500'), 100); const so = sell(c, 'PARA-500', 40);
  c.confirmPick(so.id, so.allocations.map(a => ({ allocationId: a.id, scannedItemCode: a.itemCode, scannedBatch: a.batch })), 'picker');
  c.packSO(so.id, 'packer'); c.dispatchSO(so.id, 'driver'); eq(c.getBalance('PARA-500'), 60); eq(c.verifyLedgerIntegrity().ok, true);
});
t('FEFO: الأقرب صلاحية بيتخصص الأول', () => {
  const c = fresh(); receive(c, 'PARA-500', 'LATE', '2028-01-01', 50); receive(c, 'PARA-500', 'EARLY', '2026-12-01', 50);
  const so = sell(c, 'PARA-500', 30); eq(so.allocations[0].batch, 'EARLY');
});
t('FEFO: التشغيلة المنتهية مش بتتخصص', () => {
  const c = fresh(); receive(c, 'PARA-500', 'OLD', '2026-10-15', 50); c.today = '2026-11-01';
  throwsCode(() => sell(c, 'PARA-500', 10), 'NO_STOCK');
});
t('BLOCK: مسح تشغيلة غلط', () => {
  const c = fresh(); receive(c, 'PARA-500', 'EARLY', '2026-12-01', 50); receive(c, 'PARA-500', 'LATE', '2028-01-01', 50);
  const so = sell(c, 'PARA-500', 10); const a = so.allocations[0];
  throwsCode(() => c.confirmPick(so.id, [{ allocationId: a.id, scannedItemCode: 'PARA-500', scannedBatch: 'LATE' }], 'p'), 'BATCH_MISMATCH');
  eq(c.exceptions.at(-1).type, 'BATCH_MISMATCH');
});
t('BLOCK: LASA — صنف غلط (أموكسيسيلين 500 بدل 1000)', () => {
  const c = fresh(); receive(c, 'AMOX-500', 'X1', '2027-05-01', 20); const so = sell(c, 'AMOX-500', 5); const a = so.allocations[0];
  throwsCode(() => c.confirmPick(so.id, [{ allocationId: a.id, scannedItemCode: 'AMOX-1000', scannedBatch: 'X1' }], 'p'), 'ITEM_MISMATCH');
});
t('BLOCK: مسح تشغيلة من غير صنف', () => {
  const c = fresh(); receive(c, 'PARA-500', 'B1', '2027-01-01', 20); const so = sell(c, 'PARA-500', 5);
  throwsCode(() => c.confirmPick(so.id, [{ allocationId: so.allocations[0].id, scannedBatch: 'B1' }], 'p'), 'SCAN_ITEM_REQUIRED');
});
t('BLOCK: صرف مزدوج لنفس التخصيص', () => {
  const c = fresh(); receive(c, 'PARA-500', 'B1', '2027-01-01', 20); const so = sell(c, 'PARA-500', 5); const s = [{ allocationId: so.allocations[0].id, scannedItemCode: 'PARA-500', scannedBatch: 'B1' }];
  c.confirmPick(so.id, s, 'p'); throwsCode(() => c.confirmPick(so.id, s, 'p'), 'ALREADY_PICKED');
});
t('BLOCK: استلام دواء منتهي الصلاحية', () => throwsCode(() => receive(fresh(), 'PARA-500', 'EXP', '2026-09-01', 10), 'EXPIRED_GOODS'));
t('BLOCK: دواء من غير تشغيلة/صلاحية', () => throwsCode(() => receive(fresh(), 'PARA-500', null, null, 10), 'PHARMA_BATCH_REQUIRED'));
t('BLOCK: استلام فوق الكمية المطلوبة', () => { const c = fresh(); const po = c.createPO({ supplierCode: 'SUP-001', warehouseCode: 'WH-OCT6', actor: 'a', lines: [{ itemCode: 'PARA-500', orderedQty: 10 }] }); c.poAction(po.id, 'SUBMITTED', 'a'); c.poAction(po.id, 'APPROVED', 'b'); throwsCode(() => c.createReceipt({ poId: po.id, locationKey: 'WH-OCT6/A-01-01', actor: 'r', lines: [{ poLineId: po.lines[0].id, receivedQty: 11, batch: 'B', expiryDate: '2027-01-01' }] }), 'OVER_RECEIVING'); });
t('فصل الصلاحيات: نفس الشخص ينشئ ويعتمد = BLOCK', () => { const c = fresh(); const po = c.createPO({ supplierCode: 'SUP-001', warehouseCode: 'WH-OCT6', actor: 'a', lines: [{ itemCode: 'PARA-500', orderedQty: 5 }] }); c.poAction(po.id, 'SUBMITTED', 'a'); throwsCode(() => c.poAction(po.id, 'APPROVED', 'a'), 'SEGREGATION_OF_DUTIES'); });
t('انتقال حالة غير مسموح = BLOCK', () => { const c = fresh(); const po = c.createPO({ supplierCode: 'SUP-001', warehouseCode: 'WH-OCT6', actor: 'a', lines: [{ itemCode: 'PARA-500', orderedQty: 5 }] }); throwsCode(() => c.poAction(po.id, 'CLOSED', 'b'), 'INVALID_TRANSITION'); });
t('كميات كسرية مرفوضة', () => { const c = fresh(); throwsCode(() => c.createPO({ supplierCode: 'SUP-001', warehouseCode: 'WH-OCT6', actor: 'a', lines: [{ itemCode: 'PARA-500', orderedQty: 2.5 }] }), 'INVALID_QTY'); });
t('تحويل وحدات: كرتونة = 24 علبة (أعداد صحيحة)', () => { const c = fresh(); eq(c.convertUOM(3, 'CARTON', 'BOX'), 72); });
t('QC فاشل → حجر، مش رصيد متاح', () => { const c = fresh(); receive(c, 'PARA-500', 'BAD', '2027-01-01', 30, { qc: false }); eq(c.getBalance('PARA-500'), 0); eq(c.getQuarantineBalance('PARA-500'), 30); });
t('QC: بند من غير قرار = BLOCK', () => { const c = fresh(); const po = c.createPO({ supplierCode: 'SUP-001', warehouseCode: 'WH-OCT6', actor: 'a', lines: [{ itemCode: 'PARA-500', orderedQty: 5 }] }); c.poAction(po.id, 'SUBMITTED', 'a'); c.poAction(po.id, 'APPROVED', 'b'); const gr = c.createReceipt({ poId: po.id, locationKey: 'WH-OCT6/A-01-01', actor: 'r', lines: [{ poLineId: po.lines[0].id, receivedQty: 5, batch: 'B', expiryDate: '2027-01-01' }] }); c.submitReceipt(gr.id, 'r'); c.startInspection(gr.id, 'q'); throwsCode(() => c.recordQC(gr.id, [], 'q'), 'QC_INCOMPLETE'); });
t('رصيد سالب مستحيل: تسوية أكبر من الرصيد', () => { const c = fresh(); receive(c, 'PARA-500', 'B1', '2027-01-01', 10); throwsCode(() => c.stockAdjustment({ itemCode: 'PARA-500', warehouseCode: 'WH-OCT6', locationKey: 'WH-OCT6/A-01-01', batch: 'B1', qtyDelta: -11, reason: 'جرد', actor: 'a', approver: 'b' }), 'INSUFFICIENT_STOCK'); });
t('تسوية بنفس الشخص (مُدخل = معتمد) = BLOCK', () => { const c = fresh(); receive(c, 'PARA-500', 'B1', '2027-01-01', 10); let code; try { c.stockAdjustment({ itemCode: 'PARA-500', warehouseCode: 'WH-OCT6', locationKey: 'WH-OCT6/A-01-01', batch: 'B1', qtyDelta: -1, reason: 'جرد', actor: 'a', approver: 'a' }); } catch (e) { code = e.code; } if (!code) throw new Error('لازم يترفض'); });
t('تلاعب: تعديل كمية قيد → الاستيراد يرفض', () => { const c = fresh(); receive(c, 'PARA-500', 'B1', '2027-01-01', 10); const j = JSON.parse(JSON.stringify(c.toJSON())); j.ledger[0].qty = 9999; throwsCode(() => OmNiCore.fromJSON(j), 'LEDGER_TAMPERED'); });
t('تلاعب: قص آخر قيد → الاستيراد يرفض', () => { const c = fresh(); receive(c, 'PARA-500', 'B1', '2027-01-01', 10); sell(c, 'PARA-500', 1); receive(c, 'PARA-500', 'B2', '2027-02-01', 5); const j = JSON.parse(JSON.stringify(c.toJSON())); j.ledger.pop(); throwsCode(() => OmNiCore.fromJSON(j), 'LEDGER_TRUNCATED'); });
t('تلاعب متقدم: إعادة حساب السلسلة كلها → الاستيراد ينجح لكن الختم يكشفه', () => {
  const c = fresh(); receive(c, 'PARA-500', 'B1', '2027-01-01', 10); const seal = c.createSeal();
  const j = JSON.parse(JSON.stringify(c.toJSON())); let prev = 'GENESIS';
  j.ledger = j.ledger.map((e, i) => { const { prevHash, hash, ...p } = e; if (i === 0) p.qty = 5; const h = sha256(prev + canonical(p)); const n = { ...p, prevHash: prev, hash: h }; prev = h; return n; }); j.lastHash = prev;
  const forged = OmNiCore.fromJSON(j); eq(forged.verifyLedgerIntegrity().ok, true, 'السلسلة المعاد حسابها سليمة شكليًا');
  eq(forged.verifySeal(seal).ok, false, 'الختم لازم يكشف');
});
t('الختم يمرّ على الدفتر الأصلي + بعد قيود جديدة', () => { const c = fresh(); receive(c, 'PARA-500', 'B1', '2027-01-01', 10); const seal = c.createSeal(); receive(c, 'PARA-500', 'B2', '2027-02-01', 5); eq(c.verifySeal(seal).ok, true); });
t('الساعة لا تُستورد من الملف', () => { const c = fresh(); const j = JSON.parse(JSON.stringify(c.toJSON())); j.today = '2020-01-01'; const d = OmNiCore.fromJSON(j, { now: () => new Date('2026-10-01T10:00:00Z') }); eq(d.today, '2026-10-01'); });
t('ملف v:10 القديم مرفوض', () => throwsCode(() => OmNiCore.fromJSON({ v: 10 }), 'BAD_VERSION'));
t('تحويل داخلي لا يغيّر الإجمالي', () => { const c = fresh(); receive(c, 'PARA-500', 'B1', '2027-01-01', 10); c.transfer({ itemCode: 'PARA-500', warehouseCode: 'WH-OCT6', fromLoc: 'WH-OCT6/A-01-01', toLoc: 'WH-OCT6/B-02-01', batch: 'B1', qty: 4, actor: 'a' }); eq(c.getBalance('PARA-500'), 10); });
t('Recall عالمي على مستوى التشغيلة يمنع تحويل الرصيد المتبقي في مخزن آخر', () => {
  const c = fresh();
  c.addWarehouse({ code: 'WH-REMOTE', name: 'Remote warehouse' });
  c.addLocation({ warehouseCode: 'WH-REMOTE', code: 'R-01' });
  c.addLocation({ warehouseCode: 'WH-REMOTE', code: 'R-02' });
  const po = c.createPO({ supplierCode: 'SUP-001', warehouseCode: 'WH-REMOTE', actor: 'buyer', lines: [{ itemCode: 'PARA-500', orderedQty: 20, unitCostQirsh: 1250 }] });
  c.poAction(po.id, 'SUBMITTED', 'buyer'); c.poAction(po.id, 'APPROVED', 'manager');
  const gr = c.createReceipt({ poId: po.id, locationKey: 'WH-REMOTE/R-01', actor: 'recv', lines: [{ poLineId: po.lines[0].id, receivedQty: 20, rejectedQty: 0, batch: 'SHARED-R', expiryDate: '2027-06-01' }] });
  c.submitReceipt(gr.id, 'recv'); c.startInspection(gr.id, 'qc'); c.recordQC(gr.id, [{ lineId: gr.lines[0].id, qcPass: true }], 'qc'); c.postReceipt(gr.id, 'qc');
  c.recallBatch({ itemCode: 'PARA-500', batch: 'SHARED-R', warehouseCode: 'WH-OCT6', refNo: 'RECALL-REMOTE-1', reason: 'Confirmed batch quality alert', actor: 'quality_officer', approver: 'qa_manager' });
  const before = c.ledger.length;
  throwsCode(() => c.transfer({ itemCode: 'PARA-500', warehouseCode: 'WH-REMOTE', fromLoc: 'WH-REMOTE/R-01', toLoc: 'WH-REMOTE/R-02', batch: 'SHARED-R', qty: 5, actor: 'operator' }), 'RECALLED_BATCH');
  eq(c.ledger.length, before, 'عملية التحويل المرفوضة لا تضيف قيودًا');
});
t('خصائص: 300 عملية عشوائية → الدفتر = مجموع الحركات، لا سالب، السلسلة سليمة، الاستيراد يعيد نفس البصمة', () => {
  let s = 12345; const rnd = n => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s % n; };
  const c = fresh(); const items = ['PARA-500', 'AMOX-500', 'AMOX-1000']; let b = 0, blocked = 0;
  for (let i = 0; i < 300; i++) {
    const it = items[rnd(3)]; try {
      if (rnd(3) === 0) receive(c, it, 'B' + (++b), `2027-0${1 + rnd(9)}-15`, 5 + rnd(50));
      else { const so = sell(c, it, 1 + rnd(20)); const sc = so.allocations.map(a => ({ allocationId: a.id, scannedItemCode: rnd(15) === 0 ? 'WRONG' : a.itemCode, scannedBatch: a.batch })); c.confirmPick(so.id, sc, 'p'); c.packSO(so.id, 'k'); c.dispatchSO(so.id, 'd'); }
    } catch (e) { if (!(e instanceof DomainError)) throw e; blocked++; }
  }
  for (const [k, v] of c.getBalances('WH-OCT6').map?.(x => [x.key, x.qty]) ?? []) if (v < 0) throw new Error('سالب ' + k);
  for (const it of items) { const sum = c.ledger.filter(e => e.itemCode === it && e.stockStatus === 'AVAILABLE').reduce((a, e) => a + e.qty, 0); eq(c.getBalance(it), sum, it); if (sum < 0) throw new Error('سالب'); }
  eq(c.verifyLedgerIntegrity().ok, true); eq(c.verifyAuditIntegrity().ok, true);
  const d = OmNiCore.fromJSON(JSON.parse(JSON.stringify(c.toJSON()))); eq(d.stateHash(), c.stateHash()); console.log(`   (ledger=${c.ledger.length} blocked=${blocked})`);
});

// ═════════════ v1.2 ═════════════
function sellMulti(c, lines, cust = 'CUST-001') { const so = c.createSO({ customerCode: cust, warehouseCode: 'WH-OCT6', actor: 'sales', lines }); c.soAction(so.id, 'SUBMITTED', 'sales'); c.allocateSO(so.id, 'sales'); return so; }
const scanAll = (c, so) => c.confirmPick(so.id, so.allocations.filter(a => !a.picked).map(a => ({ allocationId: a.id, scannedItemCode: a.itemCode, scannedBatch: a.batch })), 'picker');
const rcl = (c, item, batch, extra = {}) => c.recallBatch({ itemCode: item, batch, warehouseCode: 'WH-OCT6', refNo: 'EDA-2026-117', reason: 'شوائب — إشعار الهيئة', actor: 'qa', approver: 'qp', ...extra });

t('v1.2 مسار: ترتيب تصاعدي بـpickSeq بغض النظر عن ترتيب الأوردر + لا رجوع للخلف', () => {
  const c = fresh();
  receive(c, 'PARA-500', 'P1', '2027-06-01', 30, { loc: 'WH-OCT6/B-03-01' }); receive(c, 'AMOX-500', 'A1', '2027-06-01', 30, { loc: 'WH-OCT6/A-01-02' }); receive(c, 'AUGM-625', 'G1', '2027-06-01', 30, { loc: 'WH-OCT6/B-02-01' });
  const so = sellMulti(c, [{ itemCode: 'PARA-500', orderedQty: 3 }, { itemCode: 'AMOX-500', orderedQty: 2 }, { itemCode: 'AUGM-625', orderedQty: 1 }]);
  const r = c.planPickRoute(so.id); const seqs = r.stops.map(s => s.pickSeq);
  eq(JSON.stringify(seqs), JSON.stringify([11, 20, 30])); eq(r.mappedAll, true);
  if (!(r.planned.distanceUnits < r.naive.distanceUnits)) throw new Error('المسار المخطَّط مش أقصر من الترتيب العشوائي');
  eq(r.stops[0].step, 1);
});
t('v1.2 توجيه صوتي مكاني بالعربي (ممر/عمود/مستوى الصدر)', () => {
  const c = fresh(); receive(c, 'AMOX-500', 'A1', '2027-06-01', 30, { loc: 'WH-OCT6/A-01-02' }); const so = sellMulti(c, [{ itemCode: 'AMOX-500', orderedQty: 4 }]);
  const say = c.planPickRoute(so.id).stops[0].say; if (!say.includes('ممر 1') || !say.includes('العمود 2') || !say.includes('مستوى الصدر') || !say.includes('اسحب 4')) throw new Error(say);
});
t('v1.2 مسار: موقع من غير إحداثيات بيتحط في الآخر ومعلَّم (مش بيتخمّن)', () => {
  const c = fresh(); c.addLocation({ warehouseCode: 'WH-OCT6', code: 'X-99', zone: 'X' });
  receive(c, 'PARA-500', 'P1', '2027-06-01', 30, { loc: 'WH-OCT6/X-99' }); receive(c, 'AMOX-500', 'A1', '2027-06-01', 30, { loc: 'WH-OCT6/B-02-01' });
  const so = sellMulti(c, [{ itemCode: 'PARA-500', orderedQty: 1 }, { itemCode: 'AMOX-500', orderedQty: 1 }]); const r = c.planPickRoute(so.id);
  eq(r.mappedAll, false); eq(r.stops.at(-1).locationKey, 'WH-OCT6/X-99'); eq(r.stops.at(-1).mapped, false);
});
t('v1.2 مسار: بعد سحب بند، المسار بيعرض المتبقي بس', () => {
  const c = fresh(); receive(c, 'PARA-500', 'P1', '2027-06-01', 30, { loc: 'WH-OCT6/A-01-01' }); receive(c, 'AMOX-500', 'A1', '2027-06-01', 30, { loc: 'WH-OCT6/B-02-01' });
  const so = sellMulti(c, [{ itemCode: 'PARA-500', orderedQty: 1 }, { itemCode: 'AMOX-500', orderedQty: 1 }]);
  const a = so.allocations.find(x => x.itemCode === 'PARA-500'); c.confirmPick(so.id, [{ allocationId: a.id, scannedItemCode: 'PARA-500', scannedBatch: 'P1' }], 'p');
  eq(c.planPickRoute(so.id).stops.length, 1);
});
t('v1.2 إحداثيات غير صحيحة = BLOCK', () => { const c = fresh(); throwsCode(() => c.addLocation({ warehouseCode: 'WH-OCT6', code: 'Z', pickSeq: 1.5 }), 'INVALID_COORD'); });
t('v1.2 جدولة بلا تزاحم: محضّرين على نفس الممر في نفس اللحظة → التاني بيتأخر', () => {
  const c = fresh(); receive(c, 'AMOX-500', 'A1', '2027-06-01', 90, { loc: 'WH-OCT6/A-01-01' });
  const s1 = sellMulti(c, [{ itemCode: 'AMOX-500', orderedQty: 5 }]), s2 = sellMulti(c, [{ itemCode: 'AMOX-500', orderedQty: 5 }], 'CUST-002');
  const plan = c.scheduleRoutes([{ ...c.planPickRoute(s1.id), picker: 'ahmed' }, { ...c.planPickRoute(s2.id), picker: 'mahmoud' }]);
  eq(plan[0].startOffset, 0); eq(plan[1].startOffset, 1);
  const cells = plan.flatMap(p => p.timeline.filter(x => x.aisle !== null).map(x => `${x.t}|${x.aisle}`)); eq(new Set(cells).size, cells.length, 'تصادم');
});
t('v1.2 جدولة: مسارات في ممرات مختلفة تبدأ معًا (مفيش تأخير بلا داعي)', () => {
  const c = fresh(); receive(c, 'AMOX-500', 'A1', '2027-06-01', 90, { loc: 'WH-OCT6/A-01-01' }); receive(c, 'PARA-500', 'P1', '2027-06-01', 90, { loc: 'WH-OCT6/B-02-01' });
  const s1 = sellMulti(c, [{ itemCode: 'AMOX-500', orderedQty: 5 }]), s2 = sellMulti(c, [{ itemCode: 'PARA-500', orderedQty: 5 }], 'CUST-002');
  const plan = c.scheduleRoutes([c.planPickRoute(s1.id), c.planPickRoute(s2.id)]); eq(plan[1].startOffset, 0);
});
t('v1.2 الصندوق: ممنوع صندوق واحد لأوردرين شغّالين، ويتحرر بعد الصرف', () => {
  const c = fresh(); receive(c, 'PARA-500', 'P1', '2027-06-01', 90);
  const s1 = sellMulti(c, [{ itemCode: 'PARA-500', orderedQty: 5 }]), s2 = sellMulti(c, [{ itemCode: 'PARA-500', orderedQty: 5 }], 'CUST-002');
  c.bindTote(s1.id, 'TOTE-402', 'p1'); throwsCode(() => c.bindTote(s2.id, 'TOTE-402', 'p2'), 'TOTE_IN_USE'); throwsCode(() => c.bindTote(s1.id, 'TOTE-999', 'p1'), 'TOTE_ALREADY_BOUND');
  scanAll(c, s1); c.packSO(s1.id, 'k'); c.dispatchSO(s1.id, 'd'); c.bindTote(s2.id, 'TOTE-402', 'p2');
});
t('v1.2 requireTote: السحب من غير صندوق = BLOCK', () => {
  const c = seedDemo(new OmNiCore({ requireTote: true })); c.today = '2026-10-01'; receive(c, 'PARA-500', 'P1', '2027-06-01', 20); const so = sell(c, 'PARA-500', 2);
  throwsCode(() => scanAll(c, so), 'TOTE_REQUIRED'); c.bindTote(so.id, 'T1', 'p'); scanAll(c, so);
});
t('v1.2 بحث: "أوجمنتين" لوحدها → مرشّحين اتنين + لازم تأكيد (مش تخمين)', () => {
  const c = fresh(); const r = c.searchCatalog('أوجمنتين'); eq(r.candidates.length, 2); eq(r.needsConfirmation, true); eq(r.lasaSiblings.length, 1);
});
t('v1.2 بحث: "أوجمنتين 625" → صنف واحد بس بس بيحذّر من التشابه (LASA)', () => {
  const c = fresh(); const r = c.searchCatalog('اوجمنتين ٦٢٥'); eq(r.candidates[0].code, 'AUGM-625'); eq(r.candidates.length, 1); eq(r.needsConfirmation, false); eq(r.lasaSiblings[0], 'AUGM-1000');
});
t('v1.2 بحث: تطبيع همزات/تشكيل/أرقام هندية + إنجليزي', () => {
  const c = fresh(); eq(c.searchCatalog('أُموكسيسيلين ٥٠٠').candidates[0].code, 'AMOX-500'); eq(c.searchCatalog('Augmentin 1000').candidates[0].code, 'AUGM-1000'); eq(c.searchCatalog('xyz').candidates.length, 0);
});
t('v1.2 بحث أوردرات: برقم الأوردر أو اسم العميل', () => {
  const c = fresh(); receive(c, 'PARA-500', 'P1', '2027-06-01', 90); const s1 = sellMulti(c, [{ itemCode: 'PARA-500', orderedQty: 5 }]), s2 = sellMulti(c, [{ itemCode: 'PARA-500', orderedQty: 5 }], 'CUST-002');
  eq(c.findOrders('اوردر رقم 2').matches[0].soId, s2.id); const byName = c.findOrders('صيدلية الشفاء'); eq(byName.matches[0].soId, s1.id); eq(c.findOrders('الشفاء').needsConfirmation, false);
  eq(c.findOrders('صيدلية').needsConfirmation, true);
});
t('v1.2 Recall: لازم رقم إشعار + سبب + فصل صلاحيات', () => {
  const c = fresh(); receive(c, 'PARA-500', 'P1', '2027-06-01', 50);
  throwsCode(() => rcl(c, 'PARA-500', 'P1', { refNo: '' }), 'REF_REQUIRED'); throwsCode(() => rcl(c, 'PARA-500', 'P1', { reason: ' ' }), 'REASON_REQUIRED');
  throwsCode(() => rcl(c, 'PARA-500', 'P1', { approver: 'qa' }), 'SEGREGATION_OF_DUTIES'); throwsCode(() => rcl(c, 'PARA-500', 'NOPE'), 'UNKNOWN_BATCH');
});
t('v1.2 Recall: الرصيد يتحجر (AVAILABLE→QUARANTINE) والإجمالي ثابت والتخصيص الجديد يتجاهله', () => {
  const c = fresh(); receive(c, 'PARA-500', 'BAD', '2026-12-01', 50); receive(c, 'PARA-500', 'OK', '2028-01-01', 40);
  const total = c.getBalance('PARA-500') + c.getQuarantineBalance('PARA-500'); const out = rcl(c, 'PARA-500', 'BAD');
  eq(out.recall.heldQty, 50); eq(c.getBalance('PARA-500'), 40); eq(c.getQuarantineBalance('PARA-500'), 50); eq(c.getBalance('PARA-500') + c.getQuarantineBalance('PARA-500'), total);
  const so = sell(c, 'PARA-500', 10); eq(so.allocations[0].batch, 'OK'); eq(c.verifyLedgerIntegrity().ok, true);
  throwsCode(() => rcl(c, 'PARA-500', 'BAD'), 'ALREADY_RECALLED');
});
t('v1.2 Recall: أوردر مخصَّص قبل الـRecall → السحب والتغليف والصرف كلهم BLOCK', () => {
  const c = fresh(); receive(c, 'PARA-500', 'BAD', '2026-12-01', 50); const so = sell(c, 'PARA-500', 10); const a = so.allocations[0];
  const imp = rcl(c, 'PARA-500', 'BAD').impact; eq(imp.openOrders.length, 1); eq(imp.openOrders[0].soId, so.id);
  throwsCode(() => c.confirmPick(so.id, [{ allocationId: a.id, scannedItemCode: 'PARA-500', scannedBatch: 'BAD' }], 'p'), 'RECALLED_BATCH'); eq(c.exceptions.at(-1).type, 'RECALLED_BATCH');
  throwsCode(() => c.dispatchSO(so.id, 'd'), 'INVALID_TRANSITION');
});
t('v1.2 Recall: بعد السحب الفعلي وقبل الصرف: التغليف والصرف BLOCK', () => {
  const c = fresh(); receive(c, 'PARA-500', 'BAD', '2026-12-01', 50); const so = sell(c, 'PARA-500', 10); scanAll(c, so);
  const imp = rcl(c, 'PARA-500', 'BAD').impact; eq(imp.openOrders[0].pickedQty, 10);
  throwsCode(() => c.packSO(so.id, 'k'), 'RECALLED_BATCH');
});
t('v1.2 Recall: استلام/تسوية موجبة على تشغيلة عليها Recall = BLOCK', () => {
  const c = fresh(); receive(c, 'PARA-500', 'BAD', '2027-06-01', 50); rcl(c, 'PARA-500', 'BAD');
  throwsCode(() => receive(c, 'PARA-500', 'BAD', '2027-06-01', 10), 'RECALLED_BATCH');
  throwsCode(() => c.stockAdjustment({ itemCode: 'PARA-500', warehouseCode: 'WH-OCT6', locationKey: 'WH-OCT6/A-01-01', batch: 'BAD', qtyDelta: 5, reason: 'x', actor: 'a', approver: 'b' }), 'RECALLED_BATCH');
});
t('v1.2 Recall: تصرف (RTV) بفصل صلاحيات، ورفع الـRecall بيرجّع بس اللي اتحجر بسببه', () => {
  const c = fresh(); receive(c, 'PARA-500', 'MIX', '2027-06-01', 60, { rej: 0 });
  // دفعة من نفس التشغيلة اتحجرت قبل كده بسبب QC فاشل (مش من الـRecall)
  receive(c, 'PARA-500', 'MIX', '2027-06-01', 10, { qc: false }); const qBefore = c.getQuarantineBalance('PARA-500');
  rcl(c, 'PARA-500', 'MIX'); eq(c.getBalance('PARA-500'), 0);
  const rel = c.releaseRecall({ itemCode: 'PARA-500', batch: 'MIX', refNo: 'EDA-WD-9', reason: 'سحب الإشعار', actor: 'qa', approver: 'qp' });
  eq(rel.released, 60); eq(c.getBalance('PARA-500'), 60); eq(c.getQuarantineBalance('PARA-500'), qBefore);
  const c2 = fresh(); receive(c2, 'PARA-500', 'B2', '2027-06-01', 25); rcl(c2, 'PARA-500', 'B2');
  throwsCode(() => c2.disposeRecalled({ itemCode: 'PARA-500', batch: 'B2', disposition: 'RTV', refNo: 'R1', reason: 'x', actor: 'a', approver: 'a' }), 'SEGREGATION_OF_DUTIES');
  eq(c2.disposeRecalled({ itemCode: 'PARA-500', batch: 'B2', disposition: 'RTV', refNo: 'R1', reason: 'مرتجع للمورد', actor: 'a', approver: 'b' }).disposed, 25); eq(c2.getQuarantineBalance('PARA-500'), 0); eq(c2.verifyLedgerIntegrity().ok, true);
});
t('v1.2 تتبع أمامي: التشغيلة راحت لأنهي عملاء وبكام، والرصيد الحالي، ونزاهة الدفتر', () => {
  const c = fresh(); receive(c, 'PARA-500', 'T1', '2027-06-01', 100);
  const s1 = sell(c, 'PARA-500', 30), s2 = c.createSO({ customerCode: 'CUST-002', warehouseCode: 'WH-OCT6', actor: 's', lines: [{ itemCode: 'PARA-500', orderedQty: 20 }] });
  for (const s of [s1]) { scanAll(c, s); c.packSO(s.id, 'k'); c.dispatchSO(s.id, 'd'); }
  c.soAction(s2.id, 'SUBMITTED', 's'); c.allocateSO(s2.id, 's'); scanAll(c, s2); c.packSO(s2.id, 'k'); c.dispatchSO(s2.id, 'd');
  const tr = c.traceBatch('PARA-500', 'T1'); eq(tr.shipments.length, 2); eq(tr.totals.receivedBaseUnits, 100); eq(tr.totals.shippedBaseUnits, 50); eq(tr.totals.onHandBaseUnits, 50); eq(tr.integrity.ledgerOk, true);
  eq(tr.shipments.map(x => x.customerCode).sort().join(), 'CUST-001,CUST-002'); eq(tr.receipts[0].supplierCode, 'SUP-001');
  eq(c.traceOrder(s1.id).shippedBatches[0].batch, 'T1');
});
t('v1.2 Recall بعد الصرف: تقرير التتبع يوضّح الصيدليات المستلمة + الباقي في الحجر', () => {
  const c = fresh(); receive(c, 'PARA-500', 'R1', '2027-06-01', 100); const s1 = sell(c, 'PARA-500', 30); scanAll(c, s1); c.packSO(s1.id, 'k'); c.dispatchSO(s1.id, 'd');
  rcl(c, 'PARA-500', 'R1'); const tr = c.traceBatch('PARA-500', 'R1'); eq(tr.recall.status, 'ACTIVE'); eq(tr.shipments[0].qty, 30); eq(tr.onHand.filter(x => x.status === 'QUARANTINE').reduce((s, x) => s + x.qty, 0), 70);
  eq(c.traceOrder(s1.id).shippedBatches[0].recalled, true);
});
t('v1.2 الـRecall بيعدّي الحفظ/الاستيراد (مشتق من سجل التدقيق) ومحاولة حذفه من الملف تكسر الاستيراد أو تتكشف', () => {
  const c = fresh(); receive(c, 'PARA-500', 'BAD', '2027-06-01', 50); rcl(c, 'PARA-500', 'BAD');
  const d = OmNiCore.fromJSON(JSON.parse(JSON.stringify(c.toJSON()))); eq(d._isRecalled('PARA-500', 'BAD'), true); eq(d.stateHash(), c.stateHash());
  const j = JSON.parse(JSON.stringify(c.toJSON())); j.audit = j.audit.filter(e => !e.eventType.startsWith('RECALL_'));
  throwsCode(() => OmNiCore.fromJSON(j), 'AUDIT_TRUNCATED');
});
t('v1.2 ملف v:11 القديم لسه بيتقرأ (توافق رجعي)', () => {
  const c = fresh(); receive(c, 'PARA-500', 'B1', '2027-06-01', 10); const j = JSON.parse(JSON.stringify(c.toJSON())); j.v = 11; delete j.counters.RCL; const d = OmNiCore.fromJSON(j); eq(d.getBalance('PARA-500'), 10);
});
t('v1.2 خصائص: 200 عملية عشوائية مع Recall/Release — الدفتر = مجموع الحركات، لا رصيد سالب، الاستيراد يعيد نفس البصمة', () => {
  const c = fresh(); let seed = 7; const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  const items = ['PARA-500', 'AMOX-500', 'AUGM-625']; let n = 0;
  for (let i = 0; i < 200; i++) {
    try {
      const it = items[rnd(3)], k = rnd(5);
      if (k === 0) receive(c, it, 'B' + rnd(4), '2027-0' + (1 + rnd(8)) + '-15', 5 + rnd(30), { loc: 'WH-OCT6/' + ['A-01-01', 'A-01-02', 'B-02-01'][rnd(3)] });
      else if (k === 1) { const so = sell(c, it, 1 + rnd(8)); if (rnd(2)) { scanAll(c, so); c.packSO(so.id, 'k'); c.dispatchSO(so.id, 'd'); } }
      else if (k === 2) rcl(c, it, 'B' + rnd(4));
      else if (k === 3) c.releaseRecall({ itemCode: it, batch: 'B' + rnd(4), refNo: 'W', reason: 'w', actor: 'qa', approver: 'qp' });
      else c.searchCatalog('اوجمنتين');
      n++;
    } catch (e) { if (!(e instanceof DomainError)) throw e; }
  }
  let sum = 0; for (const e of c.ledger) sum += e.qty; let bsum = 0; for (const v of c.getBalances().constructor === Object ? Object.values(c.getBalances()) : []) { if (v < 0) throw new Error('سالب'); bsum += v; }
  eq(sum, bsum); eq(c.verifyLedgerIntegrity().ok, true); eq(c.verifyAuditIntegrity().ok, true);
  const d = OmNiCore.fromJSON(JSON.parse(JSON.stringify(c.toJSON()))); eq(d.stateHash(), c.stateHash()); console.log(`   (ops ok=${n} ledger=${c.ledger.length})`);
});

// ═══ v1.3 — تخطيط الأرفف الفعلي + جلسة التوجيه الصوتي ═══
function layoutCore() { const c = fresh(); buildPickLayout(c, JSON.parse(JSON.stringify(DEMO_PICK_LAYOUT))); return c; }
function multiSO(c, lines) { const so = c.createSO({ customerCode: 'CUST-001', warehouseCode: 'WH-OCT6', actor: 'sales', lines: lines.map(([itemCode, orderedQty]) => ({ itemCode, orderedQty })) }); c.soAction(so.id, 'SUBMITTED', 'sales'); c.allocateSO(so.id, 'sales'); return so; }
function stockedOrder(c) { receive(c, 'PARA-500', 'P1', '2027-06-30', 20, { loc: 'WH-OCT6/R18-G-4' }); receive(c, 'AMOX-500', 'A1', '2027-06-30', 20, { loc: 'WH-OCT6/R23-K-2' }); receive(c, 'AUGM-625', 'U1', '2027-06-30', 20, { loc: 'WH-OCT6/R30-P-6' }); return multiSO(c, [['PARA-500', 3], ['AMOX-500', 2], ['AUGM-625', 4]]); }
const racksOf = (r) => r.stops.map(s => s.rack);

t('v1.3 المستويات: 1=الأعلى، 2–5 صدر (برقم الخانة)، 6–7 ركبة، 8=أرضي', () => {
  const c = layoutCore(); const mk = (lv) => c.describeStop({ rack: 16, col: 'G', level: lv, locationKey: 'x', picks: [{ qty: 1, itemName: 'س' }] });
  eq(mk(1), 'رف 16، عمود G، الرف الأعلى، مد إيدك لفوق. اسحب 1 س'); eq(mk(4), 'رف 16، عمود G، مستوى الصدر، الخانة 4. اسحب 1 س');
  eq(mk(6), 'رف 16، عمود G، مستوى الركبة، الخانة 6. اسحب 1 س'); eq(mk(8), 'رف 16، عمود G، الرف الأرضي. اسحب 1 س');
});
t('v1.3 الصيغة القديمة (ممر/عمود) لسه شغالة للمواقع بدون رف', () => { const c = fresh(); eq(c.describeStop({ aisle: 1, bay: 1, level: 2, locationKey: 'x', picks: [{ qty: 4, itemName: 'أموكس' }] }), 'ممر 1، العمود 1، مستوى الصدر. اسحب 4 أموكس'); });
t('v1.4 تخطيط تجريبي: 22 رف × 5 أعمدة × 8 مستويات = 880 موقع، وترتيب المشي من الرف', () => {
  const c = fresh(); const before = c.locations.size; const r = buildPickLayout(c, JSON.parse(JSON.stringify(DEMO_PICK_LAYOUT)));
  eq(r.locations, 880); eq(c.locations.size - before, 880); eq(c.seqOfRack(15), 0); eq(c.seqOfRack(36), 100); eq(c.seqOfRack(26), 2100); throwsCode(() => c.seqOfRack(99), 'UNKNOWN_RACK');
});
t('v1.3 تحقق التخطيط: رف مكرر / walkOrder ناقص / رف سير مجهول / مستويات > 8', () => {
  const base = () => ({ warehouseCode: 'WH-OCT6', racks: [{ no: 1, cols: ['A'] }, { no: 2, cols: ['B'] }] });
  throwsCode(() => buildPickLayout(fresh(), { ...base(), racks: [{ no: 1, cols: ['A'] }, { no: 1, cols: ['B'] }] }), 'INVALID_LAYOUT');
  throwsCode(() => buildPickLayout(fresh(), { ...base(), walkOrder: [1] }), 'INVALID_LAYOUT');
  throwsCode(() => buildPickLayout(fresh(), { ...base(), beltAccessRacks: [9] }), 'INVALID_LAYOUT');
  throwsCode(() => buildPickLayout(fresh(), { ...base(), levels: 9 }), 'INVALID_LAYOUT');
  throwsCode(() => buildPickLayout(fresh(), { ...base(), racks: [{ no: 1, cols: ['A', 'A'] }] }), 'INVALID_LAYOUT');
});
t('v1.4 مسار تصاعدي من المدخل (حسب العمق): 18 ← 30 ← 23 وبعبارة رف/عمود/مستوى', () => {
  const c = layoutCore(); const so = stockedOrder(c); const r = c.planPickRoute(so.id);
  eq(racksOf(r).join(','), '18,30,23'); eq(r.stops[0].say, 'رف 18، عمود G، مستوى الصدر، الخانة 4. اسحب 3 باراسيتامول 500مجم أقراص'); eq(r.origin, 'QC_BELT');
});
t('v1.4 مسار تنازلي (من آخر الممر للمدخل): 23 ← 30 ← 18', () => { const c = layoutCore(); const so = stockedOrder(c); eq(racksOf(c.planPickRoute(so.id, { order: 'DESC' })).join(','), '23,30,18'); });
t('v1.3 البدء من موقع العامل: عند رف 23 يكمّل 23 وبعدين يرجع 18 ← 30 بعلامة "ارجع"', () => {
  const c = layoutCore(); const so = stockedOrder(c); const r = c.planPickRoute(so.id, { fromSeq: c.seqOfRack(23) });
  eq(racksOf(r).join(','), '23,18,30'); eq(r.origin, 'WORKER_POSITION'); eq(r.stops[1].wrapsLoop, true); eq(r.stops[1].say.startsWith('ارجع: '), true); eq(!!r.stops[0].wrapsLoop, false);
});
t('v1.4 مسافة البداية بتتحسب من موقع العامل مش من السير', () => {
  const c = layoutCore(); const so = stockedOrder(c); const a = c.planPickRoute(so.id), b = c.planPickRoute(so.id, { fromSeq: c.seqOfRack(23) });
  eq(a.planned.distanceUnits, a.stops[2].pickSeq); eq(b.planned.distanceUnits, Math.abs(b.stops[0].pickSeq - c.seqOfRack(23)) + (b.stops[0].pickSeq - b.stops[1].pickSeq) + (b.stops[2].pickSeq - b.stops[1].pickSeq));
});
t('v1.3 خيارات غلط بتترفض', () => { const c = layoutCore(); const so = stockedOrder(c); throwsCode(() => c.planPickRoute(so.id, { order: 'X' }), 'INVALID_OPTION'); throwsCode(() => c.planPickRoute(so.id, { fromSeq: 1.5 }), 'INVALID_OPTION'); });
t('v1.3 مخرج السير: أقرب نقطة بعد آخر صنف (آخر صنف رف 23 ← أقرب نقطة سير آخر الممر رف 25)', () => {
  const c = layoutCore(); const so = stockedOrder(c); const f = c.planPickRoute(so.id).finish;
  eq(f.say.includes('رف 25'), true); eq(f.say.includes('اكتمل الأوردر'), true); eq(f.dropLocationKey.startsWith('WH-OCT6/R25-'), true);
});
t('v1.3 مخرج السير بدون تخطيط سير: رسالة عامة بلا ادعاء مكان', () => {
  const c = fresh(); receive(c, 'PARA-500', 'B1', '2027-06-30', 20); const so = sell(c, 'PARA-500', 2); const f = c.planPickRoute(so.id).finish;
  eq(f.dropLocationKey, null); eq(f.say.includes('أقرب نقطة'), false); eq(f.say.includes('ضع الصندوق على السير'), true);
});
t('v1.3 "عيد تاني" بيرجّع نفس التوجيه حرفيًا، وبعد التقدّم يعيد الأخير مش الأول', () => {
  const c = layoutCore(); const so = stockedOrder(c); const s = new GuidanceSession(c, so.id); const first = s.speak().say;
  eq(s.hear('عيد تاني').say, first); eq(s.hear('كرر').say, first); eq(s.hear('فين').say, first);
  const st = s.current().stop; c.confirmPick(so.id, st.picks.map(p => ({ allocationId: p.allocationId, scannedItemCode: p.itemCode, scannedBatch: p.batch })), 'p');
  const second = s.afterPick(st.locationKey).say; eq(second !== first, true); eq(s.hear('قول تاني').say, second);
});
t('v1.3 "أنا عند رف 30" بيعيد التخطيط من هناك، ورف مش موجود بيرد بخطأ مفهوم', () => {
  const c = layoutCore(); const so = stockedOrder(c); const s = new GuidanceSession(c, so.id);
  const r = s.hear('انا عند رف 30'); eq(r.type, 'PICK'); eq(r.stop.rack, 30); const bad = s.hear('انا عند رف 99'); eq(bad.type, 'ERROR'); eq(bad.code, 'UNKNOWN_RACK');
});
t('v1.3 رحلة كاملة: 3 سحبات ثم FINISH مع مخرج السير، والتغليف بعدها مسموح', () => {
  const c = layoutCore(); const so = stockedOrder(c); const s = new GuidanceSession(c, so.id); let cur = s.speak(), n = 0;
  while (cur.type === 'PICK') { const st = cur.stop; c.confirmPick(so.id, st.picks.map(p => ({ allocationId: p.allocationId, scannedItemCode: p.itemCode, scannedBatch: p.batch })), 'p'); cur = s.afterPick(st.locationKey); n++; }
  eq(n, 3); eq(cur.type, 'FINISH'); eq(cur.say.includes('ضع الصندوق على السير'), true); eq(cur.say.includes('رف 25'), true); c.packSO(so.id, 'k'); eq(c.sos.get(so.id).status, 'PACKED');
});
t('v1.3 النية بس من كلام قصير: جملة طويلة أو عادية ما بتشغّلش حاجة', () => {
  eq(intentOf('ممكن حد يجيب لي علبة اوجمنتين من عند رف 20 وبعدين نمشي').intent, null); eq(intentOf('اوجمنتين').intent, null); eq(intentOf('').intent, null);
  eq(intentOf('عيد').intent, 'REPEAT'); eq(intentOf('أنا عند رف ٢٨').rack, 28);
  const c = layoutCore(); const s = new GuidanceSession(c, stockedOrder(c).id); eq(s.hear('كلام عادي في الممر'), null);
});
t('v1.3 البحث الصوتي: "اموكسي سيلين 500" (مفصولة) ← صنف واحد مؤكد، و"اوجمنتين" لسه بتطلب تأكيد', () => {
  const c = fresh(); const a = c.searchCatalog('اموكسي سيلين 500'); eq(a.candidates.length, 1); eq(a.candidates[0].code, 'AMOX-500'); eq(a.needsConfirmation, false);
  const b = c.searchCatalog('اوجمنتين'); eq(b.candidates.length, 2); eq(b.needsConfirmation, true);
});
t('v1.3 رف/عمود/السير بيتحفظوا في التصدير والاستيراد بنفس البصمة', () => {
  const c = layoutCore(); const d = OmNiCore.fromJSON(JSON.parse(JSON.stringify(c.toJSON())));
  eq(d.stateHash(), c.stateHash()); const L = d.locations.get('WH-OCT6/R26-P-3'); eq(L.rack, 26); eq(L.col, 'P'); eq(L.beltAccess, true); eq(d.verifyAuditIntegrity().ok, true);
});
t('v1.3 مواقع بدون رف ما اتغيّرتش (مفيش حقول زيادة في المواقع القديمة)', () => { const c = fresh(); const L = c.locations.get('WH-OCT6/A-01-01'); eq('rack' in L, false); eq('beltAccess' in L, false); });


t('v1.6 خريطة السير تحفظ نقاط الوصول الأربع: 15/25/26/36', () => {
  eq(DEMO_PICK_LAYOUT.beltAccessRacks.join(','), '15,25,26,36');
  const c = layoutCore(); for (const [rack,col] of [[15,'G'],[25,'G'],[26,'P'],[36,'P']]) eq(c.locations.get(`WH-OCT6/R${rack}-${col}-1`)?.beltAccess, true);
});
t('v1.6 الصوت يتصل بالنواة: اموكسي سيلين 500 → AMOX-500 ومكانه', () => {
  const c = layoutCore(); receive(c, 'AMOX-500', 'A1', '2027-06-30', 20, { loc: 'WH-OCT6/R23-K-2' });
  const r = resolveVoiceQuery(c, 'اموكسي سيلين 500'); eq(r.type, 'CATALOG_MATCH'); eq(r.item.code, 'AMOX-500'); eq(r.batch.batch, 'A1'); eq(r.say.includes('رف 23'), true);
});
t('v1.6 اللبس الصوتي لا يتخمّن: اوجمنتين → تأكيد', () => { const c=fresh(); const r=resolveVoiceQuery(c,'اوجمنتين'); eq(r.type,'CATALOG_CONFIRM'); eq(r.candidates.length,2); });
t('v1.6 استدعاء الأوردر صوتيًا يحتاج كلمة واضحة', () => { const c=fresh(); receive(c,'PARA-500','P1','2027-06-30',20); const so=sell(c,'PARA-500',2); const r=resolveVoiceQuery(c,`هات الأوردر ${so.id.split('-')[1]}`); eq(r.type,'ORDER_MATCH'); eq(r.match.soId,so.id); });
t('v1.6 أوامر الموقع القصيرة Intent ولا تغيّر الرصيد', () => { const c=layoutCore(); const before=c.stateHash(); const r=resolveVoiceQuery(c,'انا عند رف 23'); eq(r.type,'POSITION_INTENT'); eq(r.rack,23); eq(c.stateHash(),before); });
t('v1.6 الصوت لا يملك الإغلاق: المسح يظل شرط الانتقال', () => { const c=layoutCore(); const so=stockedOrder(c); const r=resolveVoiceQuery(c,'اموكسي سيلين 500'); eq(r.type,'CATALOG_MATCH'); eq(so.status,'ALLOCATED'); eq(so.allocations.some(a=>a.picked),false); });

t('v1.6 الصوت يفهم أرقام الرفوف الشائعة بدون تحويل الكلام إلى تنفيذ', () => { eq(intentOf('انا عند رف تلاتة وعشرين').rack, 23); eq(intentOf('انا عند رف ٢٣').rack, 23); });
t('v1.6 البحث الصوتي يظل Read/Guide فقط حتى مع تطابق الأوردر', () => { const c=fresh(); receive(c,'PARA-500','P1','2027-06-30',20); const so=sell(c,'PARA-500',2); const before=c.stateHash(); const r=resolveVoiceQuery(c,`هات الأوردر ${so.id.split('-')[1]}`); eq(r.type,'ORDER_MATCH'); eq(c.stateHash(),before); eq(c.sos.get(so.id).status,'ALLOCATED'); });
t('v1.6 كود GTIN معروف = Scan Match حتمي، والكود المجهول لا يتعمد التخمين', () => { const c=fresh(); const a=resolveScanCode(c,'06221000000011'); eq(a.type,'SCAN_MATCH'); eq(a.item.code,'AMOX-500'); eq(resolveScanCode(c,'999999999').type,'SCAN_UNKNOWN'); });
t('v1.6 حالة التشغيل تكشف TOTE_REQUIRED قبل السحب ولا تغيّر الدفتر', () => { const c=layoutCore(); const so=stockedOrder(c); const before=c.stateHash(); const o=operationalSnapshot(c,so.id); eq(o.status,'ALLOCATED'); eq(o.toteCode,null); eq(o.blockers[0].code,'TOTE_REQUIRED'); eq(c.stateHash(),before); });
t('v1.6 بعد ربط الصندوق تختفي TOTE_REQUIRED ويظهر أول توقف', () => { const c=layoutCore(); const so=stockedOrder(c); c.bindTote(so.id,'TOTE-V16','picker'); const o=operationalSnapshot(c,so.id); eq(o.toteCode,'TOTE-V16'); eq(o.blockers.some(x=>x.code==='TOTE_REQUIRED'),false); eq(o.next.rack,18); });

console.log(`\n${pass} نجح / ${fail} فشل`); if (fail) { console.log(failed.join('\n')); process.exit(1); }
