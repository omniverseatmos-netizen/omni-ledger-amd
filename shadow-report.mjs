// OmNi v2.4 — تقرير Shadow Mode: مستند قابل للطباعة/الإرسال، كل رقم فيه مشتق من سجل التدقيق وسجل الفحص (مفيش رقم بيتكتب بإيد).
// القاعدة: العينة الصغيرة بتظهر أعداد بس. والبيانات التجريبية بتتعلّم بوضوح إنها مش أداء.
import { measure } from './qc-station.mjs';

export const SOURCES = { DEMO: 'بيانات تجريبية', SHADOW: 'تشغيل ظل فعلي (Shadow Mode)' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtMs = (ms) => ms == null ? '—' : ms < 60000 ? Math.round(ms / 1000) + ' ث' : (Math.round(ms / 6000) / 10) + ' د';
const num = (v) => v == null ? '—' : v;

export function buildShadowReport(core, log, { source = 'DEMO', permitRef = '', shiftLabel = '', seal = null, now = () => new Date(), minSample = 30 } = {}) {
  if (!SOURCES[source]) throw new Error('BAD_SOURCE');
  const m = measure(core, log, { minSample });
  const demo = source === 'DEMO';
  const chainOk = m.chain.qcLog.ok && m.chain.coreAudit.ok;
  const pickRows = Object.entries(m.pickers).map(([a, r]) => `<tr><td>${esc(a)}</td><td>${r.orders}</td><td>${r.lines}</td><td>${r.blocks}</td><td>${r.status === 'MEASURED' ? num(r.blocksPer1000Scans) : '—'}</td><td>${r.status === 'MEASURED' ? num(r.linesPerHour) : '<span class="w">عينة غير كافية (' + r.orders + '/' + minSample + ' أوردر)</span>'}</td></tr>`).join('') || '<tr><td colspan="6">لا توجد بيانات سحب</td></tr>';
  const chkRows = Object.entries(m.checkers).map(([a, c]) => `<tr><td>${esc(a)}</td><td>${c.rounds}</td><td>${c.linesChecked}</td><td>${c.diffs}</td><td>${c.status === 'MEASURED' ? num(c.diffsPer1000Lines) : '<span class="w">عينة غير كافية (' + c.rounds + '/' + minSample + ')</span>'}</td><td>${c.status === 'MEASURED' ? fmtMs(c.medianDurationMs) : '—'}</td></tr>`).join('') || '<tr><td colspan="6">لا توجد بيانات فحص</td></tr>';
  const sh = m.shipments;
  const sealBlock = seal ? `<p class="m">ختم النزاهة: ${seal.entries} قيد دفتر · ${seal.qc ? seal.qc.entries + ' حدث فحص' : 'غير شامل الجودة'} · <bdi dir="ltr">${esc(seal.sealedAt)}</bdi><br>رأس الدفتر: <bdi dir="ltr">${esc(seal.head)}</bdi><br>جذر ميركل: <bdi dir="ltr">${esc(seal.merkleRoot)}</bdi></p>` : '<p class="w">⚠ مفيش ختم مرفق — التقرير مش قابل للتحقق من طرف تالت.</p>';
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>تقرير OmNi — ${esc(core.today)}</title><style>
body{font-family:system-ui,"Noto Naskh Arabic",Tahoma,sans-serif;max-width:820px;margin:16px auto;padding:0 12px;color:#111;line-height:1.7}
h1{font-size:20px;margin:0 0 4px}h2{font-size:16px;border-bottom:1px solid #999;padding-bottom:2px;margin-top:22px}
table{border-collapse:collapse;width:100%;font-size:13px}td,th{border:1px solid #bbb;padding:4px 6px;text-align:center}th{background:#eee}
.m{font-family:monospace;font-size:11px;word-break:break-all}.w{color:#9a5b00}.bad{color:#b00020;font-weight:700}.ok{color:#0a7a2f;font-weight:700}
.banner{border:2px solid ${demo ? '#b00020' : '#0a7a2f'};padding:8px;margin:10px 0;font-weight:700}.small{font-size:12px;color:#444}
@media print{body{margin:0}h2{break-after:avoid}}</style></head><body>
<h1>تقرير تشغيل OmNi Inventory Core</h1>
<div class="small">تاريخ النظام <bdi dir="ltr">${esc(core.today)}</bdi> · أُنشئ <bdi dir="ltr">${esc(now().toISOString())}</bdi>${shiftLabel ? ' · الوردية: ' + esc(shiftLabel) : ''}</div>
<div class="banner">${demo ? '⛔ بيانات تجريبية — الأرقام دي مش أداء حقيقي ولا تُستخدم لأي ادعاء توفير.' : '✓ مصدر البيانات: ' + esc(SOURCES.SHADOW) + (permitRef ? ' · مرجع الإذن (مُدخل يدويًا، غير مُتحقَّق منه): ' + esc(permitRef) : ' · ⚠ مرجع الإذن غير مذكور')}</div>
<h2>سلامة السجلات</h2>
<p>دفتر المخزون وسجل التدقيق: <span class="${m.chain.coreAudit.ok ? 'ok' : 'bad'}">${m.chain.coreAudit.ok ? '✓ سليم' : '✗ مكسور'}</span> · سجل الفحص: <span class="${m.chain.qcLog.ok ? 'ok' : 'bad'}">${m.chain.qcLog.ok ? '✓ سليم (' + m.chain.qcLog.n + ' حدث)' : '✗ مكسور'}</span> · ${core.ledger.length} قيد دفتر · ${core.audit.length} حدث تدقيق</p>
${chainOk ? '' : '<p class="bad">⛔ السجلات مش سليمة — التقرير ده مش يُعتمد عليه.</p>'}
${sealBlock}
<h2>الشحنات</h2>
<table><tr><th>اتصرف</th><th>من غير فحص جودة معتمد</th><th>جزئي (نقص)</th><th>جزئي من غير إقرار</th></tr><tr><td>${sh.dispatched}</td><td class="${sh.withoutApprovedQC ? 'bad' : ''}">${sh.withoutApprovedQC}</td><td>${sh.partial}</td><td class="${sh.partialUnacknowledged ? 'bad' : ''}">${sh.partialUnacknowledged}</td></tr></table>
<h2>المحضّرون</h2>
<table><tr><th>المحضّر</th><th>أوردرات</th><th>خطوط</th><th>أخطاء مسح</th><th>أخطاء/ألف مسح</th><th>خطوط/ساعة</th></tr>${pickRows}</table>
<h2>مراقبو الجودة</h2>
<table><tr><th>المراقب</th><th>جولات</th><th>خطوط اتفحصت</th><th>فروق</th><th>فروق/ألف خط</th><th>وسيط زمن الفحص</th></tr>${chkRows}</table>
<p>الانتظار بين آخر سحب وبدء الفحص: ${m.qcWait.status === 'MEASURED' ? 'وسيط ' + fmtMs(m.qcWait.medianMs) + ' · P90 ' + fmtMs(m.qcWait.p90Ms) + ' (n=' + m.qcWait.n + ')' : '<span class="w">عينة غير كافية (n=' + m.qcWait.n + ' من ' + minSample + ')</span>'}</p>
<h2>حدود التقرير (للأمانة)</h2>
<ul class="small"><li>الحد الأدنى للعينة ${minSample}؛ تحته بتظهر الأعداد بس من غير معدلات.</li><li>مفيش مقارنة قبل/بعد ولا نسبة توفير: ده يحتاج خط أساس مقاس من نفس الوردية بدون النظام.</li><li>الأسماء نص حر (مفيش هوية مُتحقَّق منها).</li><li>التقرير مشتق من السجلات، وأي رقم هنا ممكن يتعاد حسابه من ملف «تصدير الحالة».</li><li>النظام مش بديل لنظام الامتثال الوطني ولا بيدّعي توافقًا معه.</li></ul>
</body></html>`;
  return { html, measure: m, chainOk };
}

const cell = (v) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
export function eventsCsv(core, log) {
  const rows = [['source', 'timestamp', 'orderId', 'actor', 'event', 'detail']];
  for (const e of core.audit) if (e.sourceType === 'SalesOrder') rows.push(['audit', e.timestamp, e.sourceId, e.actorId, e.eventType, e.afterState?.type || e.reason || '']);
  for (const e of log.events) rows.push(['qc', e.at, e.soId, e.actor, e.type, e.reason || '']);
  rows.sort((a, b) => (a[0] === 'source' ? -1 : b[0] === 'source' ? 1 : String(a[1]).localeCompare(String(b[1]))));
  return '\uFEFF' + rows.map(r => r.map(cell).join(',')).join('\r\n');
}
