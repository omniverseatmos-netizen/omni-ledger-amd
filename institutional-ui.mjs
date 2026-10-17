// OmNi v2.0 — جسر الواجهة ← الطبقة المحاسبية (بدون أي منطق محاسبي جديد: بيستدعي دوال v1.7–v1.9 كما هي)
import { InstitutionalLedger, defaultChartOfAccounts, bridgeReceiptToAccounting } from './institutional.mjs';
import { bridgeDispatchToAccountingV18, verifyInvariants, createAuditPackage, validateAuditPackage } from './institutional_assurance.mjs';
const fail = e => ({ ok: false, msg: `⛔ ${e.code || 'ERR'}: ${e.message}` });
const last = (map, status) => [...map.values()].filter(x => x.status === status).at(-1);
export function newBook(core) { const a = new InstitutionalLedger({ companyId: 'OMNI-UI', tenantId: 'OMNI' }); defaultChartOfAccounts(a); a.openPeriod(core.today.slice(0, 7), 'admin'); return a; }
function post(book, fn) {
  try { const r = fn(); const j = r.journal || r; if (r.duplicate) return { ok: true, msg: 'القيد ده اتسجل قبل كده (مفيش قيد تاني اتعمل)' };
    if (j.status !== 'POSTED') book.approveJournal(j.id, 'controller'); return { ok: true, msg: `✓ قيد ${j.id} اترحّل` };
  } catch (e) { return fail(e); }
}
export function bridgeLastReceipt(core, book) {
  const g = last(core.receipts, 'POSTED'); if (!g) return { ok: false, msg: 'مفيش استلام مرحّل لسه' };
  return post(book, () => bridgeReceiptToAccounting(core, book, g.id, { actor: 'wms-bridge', date: core.today }));
}
export function bridgeLastDispatch(core, book) {
  const s = last(core.sos, 'DISPATCHED'); if (!s) return { ok: false, msg: 'مفيش أوردر مصروف لسه' };
  return post(book, () => bridgeDispatchToAccountingV18(core, book, s.id, { actor: 'wms-bridge', date: core.today }));
}
export function bookReport(book) {
  const inv = verifyInvariants(book), pkg = createAuditPackage(book), val = validateAuditPackage(pkg);
  return { trialBalance: book.trialBalance(), invariants: inv, auditPackage: { hash: pkg.packageHash, valid: !!val.ok }, summary: book.controlSummary() };
}
