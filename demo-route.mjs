// تجربة سريعة بدون متصفح: node demo-route.mjs
import { OmNiCore, seedDemo, buildPickLayout, DEMO_PICK_LAYOUT, GuidanceSession } from './domain.mjs';
const c = seedDemo(new OmNiCore()); c.today = '2026-10-01'; buildPickLayout(c, JSON.parse(JSON.stringify(DEMO_PICK_LAYOUT)));
const put = (item, batch, loc, q) => { const po = c.createPO({ supplierCode: 'SUP-001', warehouseCode: 'WH-OCT6', actor: 'buyer', lines: [{ itemCode: item, orderedQty: q, unitCostQirsh: 1250 }] }); c.poAction(po.id, 'SUBMITTED', 'buyer'); c.poAction(po.id, 'APPROVED', 'manager'); const gr = c.createReceipt({ poId: po.id, locationKey: loc, actor: 'recv', lines: [{ poLineId: po.lines[0].id, receivedQty: q, rejectedQty: 0, batch, expiryDate: '2027-06-30' }] }); c.submitReceipt(gr.id, 'recv'); c.startInspection(gr.id, 'qc'); c.recordQC(gr.id, [{ lineId: gr.lines[0].id, qcPass: true }], 'qc'); c.postReceipt(gr.id, 'qc'); };
put('PARA-500', 'P1', 'WH-OCT6/R18-G-4', 20); put('AMOX-500', 'A1', 'WH-OCT6/R23-K-2', 20); put('AUGM-625', 'U1', 'WH-OCT6/R30-P-6', 20);
const so = c.createSO({ customerCode: 'CUST-001', warehouseCode: 'WH-OCT6', actor: 'sales', lines: [{ itemCode: 'PARA-500', orderedQty: 3 }, { itemCode: 'AMOX-500', orderedQty: 2 }, { itemCode: 'AUGM-625', orderedQty: 4 }] });
c.soAction(so.id, 'SUBMITTED', 'sales'); c.allocateSO(so.id, 'sales');
const s = new GuidanceSession(c, so.id); const say = (who, t) => console.log(`${who}: ${t}`);
let cur = s.speak(); say('🔊 النظام', cur.say);
say('🎤 العامل', 'عيد تاني'); say('🔊 النظام', s.hear('عيد تاني').say);
while (cur.type === 'PICK') { const st = cur.stop; c.confirmPick(so.id, st.picks.map(p => ({ allocationId: p.allocationId, scannedItemCode: p.itemCode, scannedBatch: p.batch })), 'picker'); say('📷 مسح', `${st.picks[0].itemCode} ✓`); cur = s.afterPick(st.locationKey); say('🔊 النظام', cur.say); }
