// OmNi v2.3 — حزمة الحالة: ملف واحد فيه الدفتر + سجل الفحص (+ الختم لو موجود)، وبيتنزّل فعلًا كملف.
// القاعدة: مفيش منطق مخزني هنا. التصدير بيجمّع، والاستيراد بيرفض أي حاجة مكسورة قبل ما يلمس الحالة الحالية.
import { OmNiCore, sha256, canonical } from './domain.mjs';
import { StepLog, verifyFullSeal } from './qc-station.mjs';

export class BundleError extends Error { constructor(code, message) { super(message); this.name = 'BundleError'; this.code = code; } }
const E = (c, m) => new BundleError(c, m);
export const BUNDLE_FORMAT = 'omni-state';
export const BUNDLE_VERSION = 1;

const bindKey = (core) => core.audit[0]?.hash || 'GENESIS';

export function exportBundle(core, log, { seal = null, now = () => new Date() } = {}) {
  const v = log.verify(); if (!v.ok) throw E('QC_LOG_TAMPERED', `مينفعش نصدّر سجل فحص مكسور (عند ${v.at}: ${v.reason})`);
  const body = { core: core.toJSON(), qcLog: log.toJSON(), seal: seal || null };
  return { format: BUNDLE_FORMAT, v: BUNDLE_VERSION, exportedAt: now().toISOString(), counts: { ledger: core.ledger.length, audit: core.audit.length, qc: log.events.length }, ...body, checksum: sha256(canonical(body)) };
}

export function bundleFileName(bundle) {
  const t = bundle.exportedAt.replace(/[-:]/g, '').replace('T', '-').slice(0, 13);
  return `omni-state-${t}.json`;
}

// الاستيراد: بيرجّع {core, log, report} أو بيرمي BundleError. مفيش أي أثر جانبي على الحالة الحالية.
export function importBundle(raw, { now } = {}) {
  let b; try { b = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (e) { throw E('NOT_JSON', 'الملف مش JSON سليم'); }
  if (!b || b.format !== BUNDLE_FORMAT) throw E('NOT_BUNDLE', 'الملف مش حزمة حالة OmNi (استخدم ملف نزل من «تصدير الحالة» v2.3)');
  if (b.v !== BUNDLE_VERSION) throw E('BAD_BUNDLE_VERSION', `نسخة الحزمة غير مدعومة (${b.v})`);
  if (!b.core || !b.qcLog) throw E('BUNDLE_INCOMPLETE', 'الحزمة ناقصة (الدفتر أو سجل الفحص مش موجود)');
  const sum = sha256(canonical({ core: b.core, qcLog: b.qcLog, seal: b.seal ?? null }));
  if (sum !== b.checksum) throw E('CHECKSUM_MISMATCH', 'الملف اتعدّل أو اتقطع (المجموع التحققي مش مطابق)');
  let core, log;
  try { core = OmNiCore.fromJSON(b.core, now ? { now } : {}); } catch (e) { throw E('LEDGER_REJECTED', 'الدفتر مرفوض: ' + e.message); }
  try { log = StepLog.fromJSON(b.qcLog, now ? { now } : {}); } catch (e) { throw E('QC_LOG_REJECTED', 'سجل الفحص مرفوض: ' + e.message); }
  if (log.bind !== bindKey(core)) throw E('BIND_MISMATCH', 'سجل الفحص مش تابع للدفتر ده');
  let sealRes = null;
  if (b.seal) { sealRes = verifyFullSeal(core, log, b.seal); if (!sealRes.ok) throw E('SEAL_FAIL', `الختم اللي جوّه الحزمة مش مطابق (${sealRes.part || ''} ${sealRes.reason})`); }
  return { core, log, seal: b.seal || null, report: { exportedAt: b.exportedAt, ledger: core.ledger.length, qc: log.events.length, sealChecked: !!b.seal, sealQc: sealRes && sealRes.qc } };
}
