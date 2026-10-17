// OmNi v2.1 — محطة مراقب الجودة + سجل خطوات مقاس
// القاعدة: مفيش منطق مخزني جديد هنا. الطبقة دي بتقرأ النواة (قراءة فقط) وبتسجّل أحداث الفحص في سجل متسلسل منفصل.
// حالة الفحص مش حقل بيتكتب — بتتشتق من السجل. والأرقام (قياس) بتتشتق من سجل تدقيق النواة + سجل الفحص، مش بتتكتب بإيد.
import { sha256, canonical, merkleRoot } from './domain.mjs';

export class StationError extends Error { constructor(code, message) { super(message); this.name = 'StationError'; this.code = code; } }
const E = (c, m) => new StationError(c, m);
const isInt = Number.isSafeInteger;

// ── سجل الخطوات: متسلسل SHA-256، أي تعديل/حذف بيتكشف ───────────────────
export class StepLog {
  constructor({ now = () => new Date(), bind = null } = {}) { this.events = []; this._head = 'GENESIS'; this._now = now; this.bind = bind; }
  record(type, soId, actor, extra = {}) {
    const body = { seq: this.events.length + 1, type, soId, actor, at: this._now().toISOString(), ...extra };
    const hash = sha256(this._head + canonical(body));
    const ev = Object.freeze({ ...body, prevHash: this._head, hash });
    this.events.push(ev); this._head = hash; return ev;
  }
  verify() {
    let prev = 'GENESIS';
    for (let i = 0; i < this.events.length; i++) {
      const { prevHash, hash, ...body } = this.events[i];
      if (prevHash !== prev) return { ok: false, at: i + 1, reason: 'PREV_MISMATCH' };
      if (sha256(prev + canonical(body)) !== hash) return { ok: false, at: i + 1, reason: 'HASH_MISMATCH' };
      prev = hash;
    }
    if (prev !== this._head) return { ok: false, at: this.events.length, reason: 'HEAD_MISMATCH' };
    return { ok: true, head: prev, n: this.events.length };
  }
  toJSON() { return { v: 1, bind: this.bind, head: this._head, events: this.events }; }
  static fromJSON(d, { now } = {}) {
    if (!d || d.v !== 1 || !Array.isArray(d.events)) throw E('BAD_LOG', 'ملف سجل الفحص غير مدعوم');
    const l = new StepLog({ now, bind: d.bind ?? null });
    l.events = d.events.map(e => Object.freeze({ ...e })); l._head = d.head || 'GENESIS';
    const v = l.verify(); if (!v.ok) throw E('QC_LOG_TAMPERED', `سجل الفحص مكسور عند ${v.at} (${v.reason})`);
    return l;
  }
}

// ── حالة الفحص لأوردر: مشتقة من السجل ──────────────────────────────────
export function qcState(log, soId) {
  const s = { state: 'NONE', owner: null, round: 0, startedAt: null, verdicts: {}, diffsThisRound: 0 };
  for (const e of log.events) {
    if (e.soId !== soId) continue;
    if (e.type === 'QC_STARTED') { s.state = 'IN_PROGRESS'; s.owner = e.actor; s.round++; s.startedAt = e.at; s.verdicts = {}; s.diffsThisRound = 0; }
    else if (e.type === 'QC_LINE_OK') s.verdicts[e.allocationId] = 'OK';
    else if (e.type === 'QC_LINE_DIFF') { s.verdicts[e.allocationId] = 'DIFF'; s.diffsThisRound++; }
    else if (e.type === 'QC_APPROVED') s.state = 'APPROVED';
    else if (e.type === 'QC_REJECTED') s.state = 'REJECTED';
  }
  return s;
}

export class QCStation {
  constructor(core, log) { this.core = core; this.log = log; }
  state(soId) { return qcState(this.log, soId); }
  _so(soId) { const so = this.core.sos.get(soId); if (!so) throw E('NOT_FOUND', `أوردر غير موجود: ${soId}`); return so; }
  pickersOf(soId) { return new Set(this.core.audit.filter(e => e.eventType === 'PICK_CONFIRMED' && e.sourceId === soId).map(e => e.actorId)); }
  _need(actor) { if (typeof actor !== 'string' || !actor.trim()) throw E('ACTOR_REQUIRED', 'لازم اسم المراقب (من غير اسم مفيش مساءلة)'); }

  startQC(soId, actor) {
    this._need(actor); const so = this._so(soId);
    if (so.status !== 'PICKING') throw E('INVALID_STATE', `الفحص بعد السحب وقبل التغليف بس (حالة الأوردر: ${so.status})`);
    const open = so.allocations.filter(a => !a.picked).length;
    if (open) throw E('PICK_INCOMPLETE', `فيه ${open} بند لسه متسحبش — الفحص بعد اكتمال السحب`);
    if (this.pickersOf(soId).has(actor)) throw E('SEGREGATION_OF_DUTIES', 'اللي سحب الأوردر مينفعش يفحصه — فصل الصلاحيات إجباري');
    const st = this.state(soId);
    if (st.state === 'APPROVED') throw E('QC_ALREADY_APPROVED', 'الأوردر ده اتفحص واتعتمد قبل كده');
    if (st.state === 'IN_PROGRESS') { if (st.owner === actor) return st; throw E('QC_OWNED', `الفحص ماسكه ${st.owner} — مينفعش مراقب تاني يكمّله من غير رفضه الأول`); }
    this.log.record('QC_STARTED', soId, actor, { round: st.round + 1 });
    return this.state(soId);
  }
  _active(soId, actor) {
    this._need(actor); const st = this.state(soId);
    if (st.state !== 'IN_PROGRESS') throw E('QC_NOT_STARTED', 'ابدأ الفحص الأول');
    if (st.owner !== actor) throw E('QC_OWNED', `الفحص ماسكه ${st.owner}`);
    return st;
  }
  // مراقب الجودة بيمسح اللي في الصندوق فعليًا: صنف + تشغيلة + عدد. أي فرق بيتسجّل كدليل، ومينفعش يتعدّى.
  scanLine(soId, actor, { allocationId, scannedItemCode, scannedBatch = null, countedQty }) {
    this._active(soId, actor); const so = this._so(soId);
    const a = so.allocations.find(x => x.id === allocationId); if (!a) throw E('BAD_ALLOCATION', `بند غير موجود: ${allocationId}`);
    if (!scannedItemCode) throw E('SCAN_ITEM_REQUIRED', 'لازم مسح الصنف مع التشغيلة');
    if (!isInt(countedQty) || countedQty < 0) throw E('INVALID_QTY', 'العدد لازم رقم صحيح ≥ 0');
    const diffs = [];
    if (scannedItemCode !== a.itemCode) diffs.push({ kind: 'ITEM', expected: a.itemCode, got: scannedItemCode });
    if ((scannedBatch || null) !== (a.batch || null)) diffs.push({ kind: 'BATCH', expected: a.batch, got: scannedBatch || null });
    if (countedQty !== a.qty) diffs.push({ kind: 'QTY', expected: a.qty, got: countedQty });
    if (!diffs.length) { this.log.record('QC_LINE_OK', soId, actor, { allocationId }); return { ok: true, diffs: [] }; }
    this.log.record('QC_LINE_DIFF', soId, actor, { allocationId, diffs });
    return { ok: false, diffs };
  }
  approveQC(soId, actor) {
    const st = this._active(soId, actor); const so = this._so(soId);
    const notDone = so.allocations.filter(a => st.verdicts[a.id] === undefined).length, diff = so.allocations.filter(a => st.verdicts[a.id] === 'DIFF').length;
    if (notDone || diff) throw E('QC_INCOMPLETE', `الاعتماد ممنوع: ${notDone} بند لسه ما اتفحصش و${diff} بند فيه فرق — صحّح الفرق أو ارفض الفحص`);
    const durationMs = Date.parse(this.log._now().toISOString()) - Date.parse(st.startedAt);
    this.log.record('QC_APPROVED', soId, actor, { lines: so.allocations.length, diffsFound: st.diffsThisRound, durationMs });
    return this.state(soId);
  }
  rejectQC(soId, actor, reason) {
    const st = this._active(soId, actor);
    if (typeof reason !== 'string' || reason.trim().length < 3) throw E('REASON_REQUIRED', 'سبب الرفض مطلوب (3 حروف على الأقل)');
    const durationMs = Date.parse(this.log._now().toISOString()) - Date.parse(st.startedAt);
    this.log.record('QC_REJECTED', soId, actor, { reason: reason.trim(), diffsFound: st.diffsThisRound, durationMs });
    return this.state(soId);
  }
}

// تركيب البوابة: التغليف في النواة نفسها بيرفض من غير فحص معتمد. mkError بيبني DomainError بتاع النواة اللي شغّالة (نسخة الواجهة مختلفة الكلاس).
export function installQCGate(core, station, mkError = (c, m) => new StationError(c, m)) {
  core.packGate = (so) => { const st = station.state(so.id); if (st.state !== 'APPROVED') throw mkError('QC_REQUIRED', `ممنوع التغليف قبل فحص الجودة المعتمد (حالة الفحص: ${st.state})`); };
  return () => { core.packGate = null; };
}

// ── القياس: كله مشتق من السجلات ─────────────────────────────────────────
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
const p90 = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.max(0, Math.ceil(s.length * 0.9) - 1)]; };
const ms = (iso) => Date.parse(iso);

export function measure(core, log, { minSample = 30 } = {}) {
  const byOrder = new Map();
  for (const e of core.audit) { if (e.sourceType !== 'SalesOrder') continue; if (!byOrder.has(e.sourceId)) byOrder.set(e.sourceId, []); byOrder.get(e.sourceId).push(e); }
  const pickers = {}; const lastPickAt = new Map();
  const P = (a) => (pickers[a] ||= { orders: 0, lines: 0, blocks: 0, spanMs: 0 });
  for (const [soId, evs] of byOrder) {
    const picks = evs.filter(e => e.eventType === 'PICK_CONFIRMED'), blocks = evs.filter(e => e.eventType === 'PICK_BLOCKED');
    for (const b of blocks) P(b.actorId).blocks++;
    const by = new Map(); for (const p of picks) { if (!by.has(p.actorId)) by.set(p.actorId, []); by.get(p.actorId).push(ms(p.timestamp)); }
    for (const [actor, ts] of by) { const r = P(actor); r.orders++; r.lines += ts.length; r.spanMs += Math.max(...ts) - Math.min(...ts); }
    if (picks.length) lastPickAt.set(soId, Math.max(...picks.map(p => ms(p.timestamp))));
  }
  for (const r of Object.values(pickers)) {
    const scans = r.lines + r.blocks;
    r.blocksPer1000Scans = scans ? Math.round((r.blocks * 1000) / scans) : null;
    r.status = r.orders >= minSample ? 'MEASURED' : 'INSUFFICIENT_SAMPLE';
    r.linesPerHour = r.status === 'MEASURED' && r.spanMs > 0 ? Math.round((r.lines / (r.spanMs / 3.6e6)) * 10) / 10 : null;
  }
  const checkers = {}, C = (a) => (checkers[a] ||= { rounds: 0, linesChecked: 0, diffs: 0, approvals: 0, rejections: 0, durations: [] });
  const waits = [];
  for (const e of log.events) {
    if (e.type === 'QC_STARTED') { C(e.actor).rounds++; if (e.round === 1 && lastPickAt.has(e.soId)) waits.push(Math.max(0, ms(e.at) - lastPickAt.get(e.soId))) }
    else if (e.type === 'QC_LINE_OK') C(e.actor).linesChecked++;
    else if (e.type === 'QC_LINE_DIFF') { const c = C(e.actor); c.linesChecked++; c.diffs++; }
    else if (e.type === 'QC_APPROVED') { const c = C(e.actor); c.approvals++; c.durations.push(e.durationMs); }
    else if (e.type === 'QC_REJECTED') { const c = C(e.actor); c.rejections++; c.durations.push(e.durationMs); }
  }
  for (const c of Object.values(checkers)) {
    c.diffsPer1000Lines = c.linesChecked ? Math.round((c.diffs * 1000) / c.linesChecked) : null;
    c.medianDurationMs = median(c.durations); c.status = c.rounds >= minSample ? 'MEASURED' : 'INSUFFICIENT_SAMPLE'; delete c.durations;
  }
  // v2.2: الشحنات اللي خرجت من غير فحص معتمد أو بنقص — مشتقة من حالة الأوردرات وسجل الفحص (مش بتتكتب بإيد)
  const approvedSo = new Set(log.events.filter(e => e.type === 'QC_APPROVED').map(e => e.soId));
  const disp = [...core.sos.values()].filter(s => s.status === 'DISPATCHED');
  const shipments = { dispatched: disp.length, withoutApprovedQC: disp.filter(s => !approvedSo.has(s.id)).length, partial: disp.filter(s => s.lines.some(l => l.shortage > 0)).length, partialUnacknowledged: disp.filter(s => s.lines.some(l => l.shortage > 0) && !s.shortageAck).length };
  const enough = waits.length >= minSample;
  return {
    basis: 'derived-from-audit', minSample, chain: { qcLog: log.verify(), coreAudit: core.verifyAuditIntegrity() },
    pickers, checkers, shipments, qcWait: { n: waits.length, status: enough ? 'MEASURED' : 'INSUFFICIENT_SAMPLE', medianMs: enough ? median(waits) : null, p90Ms: enough ? p90(waits) : null },
    notes: ['مدة السحب = من أول مسح لآخر مسح للأوردر (مش من لحظة التكليف).', 'أي رقم حالته INSUFFICIENT_SAMPLE ما يتقالش في عرض.', 'بيانات الجهاز التجريبية مش قياس ميداني — القياس الحقيقي من وردية فعلية بإذن مكتوب.']
  };
}

// ── v2.2: ختم النزاهة يشمل رأس سجل الفحص ─────────────────────────────────
// ختم النواة (دفتر المخزن) + بصمة سجل الفحص وقت الختم. أي قص أو تعديل في سجل الفحص بعد الختم بيتكشف.
export function createFullSeal(core, log) {
  const v = log.verify(); if (!v.ok) throw E('QC_LOG_TAMPERED', `مينفعش نختم سجل فحص مكسور (عند ${v.at}: ${v.reason})`);
  const base = core.createSeal();
  return { ...base, version: 2, qc: { entries: log.events.length, head: log._head, merkleRoot: merkleRoot(log.events.map(e => e.hash)) } };
}
export function verifyFullSeal(core, log, seal) {
  const c = core.verifySeal(seal); if (!c.ok) return { ok: false, part: 'LEDGER', reason: c.reason };
  if (!seal.qc) return { ok: true, entries: c.entries, qc: 'NOT_COVERED' };
  const v = log.verify(); if (!v.ok) return { ok: false, part: 'QC_LOG', reason: 'QC_LOG_BROKEN', at: v.at };
  const n = seal.qc.entries; if (log.events.length < n) return { ok: false, part: 'QC_LOG', reason: 'QC_LOG_SHORTER_THAN_SEAL', have: log.events.length, sealed: n };
  const prefix = log.events.slice(0, n); const head = n ? prefix[n - 1].hash : 'GENESIS';
  if (head !== seal.qc.head) return { ok: false, part: 'QC_LOG', reason: 'QC_HEAD_MISMATCH' };
  if (merkleRoot(prefix.map(e => e.hash)) !== seal.qc.merkleRoot) return { ok: false, part: 'QC_LOG', reason: 'QC_MERKLE_MISMATCH' };
  return { ok: true, entries: c.entries, qc: { ok: true, entries: n } };
}
