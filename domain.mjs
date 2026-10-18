// ═══════════════════════════════════════════════════════════════════════
// OmNi Inventory Core — v1.3 (جلسة التوجيه الصوتي + تخطيط الأرفف الفعلي + مسار السحب + Recall)  |  domain layer: pure, no DOM, no I/O
// فوق v1.0: أعداد صحيحة فقط • SHA-256 + canonical JSON • سلسلة تدقيق مشفرة •
// حارس رصيد سالب مركزي • حجز مفهوم في التسويات • تحويل وحدات عند الاستلام •
// مسح (صنف + تشغيلة) • فصل صلاحيات على أمر الشراء • ختم نزاهة (Merkle) •
// الساعة لا تُستورد من الملف • الاستيراد يرفض الدفتر المتلاعَب فيه.
// v1.2: مسار سحب بلا رجوع للخلف + جدولة بلا تزاحم • ربط الصندوق بالأوردر • سحب تشغيلة (Recall) بفصل صلاحيات
//       + تقرير تتبع أمامي/خلفي • بحث كتالوج/أوردرات بمرشّحين (مش تخمين) للطبقة الصوتية.
// القاعدة الأم: الرصيد مش حقل يتعدّل — الـLedger هو مصدر الحقيقة.
// ═══════════════════════════════════════════════════════════════════════

export class DomainError extends Error {
  constructor(code, message) { super(message); this.name = 'DomainError'; this.code = code; }
}

// ── SHA-256 (JS نقي، متزامن، بيشتغل في المتصفح وNode بدون async) ─────────
const K = new Uint32Array([
  0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
  0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
  0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
  0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
  0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
  0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
  0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
  0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2,
]);
export function sha256(str) {
  const msg = new TextEncoder().encode(str);
  const l = msg.length, padded = new Uint8Array(((l + 9 + 63) >> 6) << 6);
  padded.set(msg); padded[l] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 8, Math.floor((l * 8) / 0x100000000)); dv.setUint32(padded.length - 4, (l * 8) >>> 0);
  const H = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
  const w = new Uint32Array(64);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i-15], 7) ^ rotr(w[i-15], 18) ^ (w[i-15] >>> 3);
      const s1 = rotr(w[i-2], 17) ^ rotr(w[i-2], 19) ^ (w[i-2] >>> 10);
      w[i] = (w[i-16] + s0 + w[i-7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25), ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22), mj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + mj) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  return [...H].map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
}

// ── canonical JSON: مفاتيح مرتبة، أعداد صحيحة فقط (أي كسر = خطأ) ────────
export function canonical(v) {
  if (v === null) return 'null';
  switch (typeof v) {
    case 'number': if (!Number.isSafeInteger(v)) throw new DomainError('NON_INTEGER', `رقم غير صحيح في سجل مشفّر: ${v}`); return String(v);
    case 'string': case 'boolean': return JSON.stringify(v);
    case 'object':
      if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
      return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
    default: throw new DomainError('NON_CANONICAL', `نوع غير مدعوم: ${typeof v}`);
  }
}
export function merkleRoot(hashes) {
  if (hashes.length === 0) return sha256('EMPTY');
  let level = hashes.slice();
  while (level.length > 1) { const next = []; for (let i = 0; i < level.length; i += 2) next.push(sha256(level[i] + (level[i + 1] ?? level[i]))); level = next; }
  return level[0];
}

// ── تطبيع نص عربي/إنجليزي للبحث (تشكيل/همزات/ياء/تاء مربوطة/أرقام هندية) ──
export function normText(s) {
  return String(s ?? '').toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/ملغ|مليغرام|ميليغرام/g, 'مجم').replace(/مليجرام|ميليجرام/g, 'مجم')
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[^a-z0-9\u0621-\u064A\s]/g, ' ')
    .replace(/([0-9])([a-z\u0621-\u064A])/g, '$1 $2').replace(/([a-z\u0621-\u064A])([0-9])/g, '$1 $2')
    .replace(/\s+/g, ' ').trim();
}
// تخطيط ابن سينا الفعلي (كما وصفه أحمد): المستوى 1 = أعلى رف، 2–5 = منطقة الصدر/اليد، 6–7 = الركبة، 8 = ملامس للأرض
const LEVEL_AR = { 1: 'الرف الأعلى، مد إيدك لفوق', 2: 'مستوى الصدر', 3: 'مستوى الصدر', 4: 'مستوى الصدر', 5: 'مستوى الصدر', 6: 'مستوى الركبة', 7: 'مستوى الركبة', 8: 'الرف الأرضي' };
const levelSay = (lv, withNo) => { const w = LEVEL_AR[lv] || `المستوى ${lv}`; return withNo && lv >= 2 && lv <= 7 ? `${w}، الخانة ${lv}` : w; };

// ── State machines — أي انتقال مش موجود هنا = BLOCKED ───────────────────
const PO_FLOW = { DRAFT: ['SUBMITTED', 'CANCELLED'], SUBMITTED: ['APPROVED', 'CANCELLED'], APPROVED: ['CANCELLED', 'CLOSED'], PARTIALLY_RECEIVED: ['CANCELLED', 'CLOSED'], RECEIVED: ['CLOSED'], CLOSED: [], CANCELLED: [] };
const GR_FLOW = { DRAFT: ['SUBMITTED'], SUBMITTED: ['INSPECTING'], INSPECTING: ['ACCEPTED', 'PARTIALLY_ACCEPTED', 'REJECTED'], ACCEPTED: ['POSTED'], PARTIALLY_ACCEPTED: ['POSTED'], REJECTED: ['POSTED'], POSTED: ['PUT_AWAY'], PUT_AWAY: ['COMPLETED'], COMPLETED: [] };
const SO_FLOW = { DRAFT: ['SUBMITTED', 'CANCELLED'], SUBMITTED: ['ALLOCATED', 'CANCELLED'], ALLOCATED: ['PICKING', 'CANCELLED'], PICKING: ['PACKED', 'CANCELLED'], PACKED: ['DISPATCHED'], DISPATCHED: [], CANCELLED: [] };
function assertTransition(flow, from, to, label) {
  if (!flow[from] || !flow[from].includes(to)) throw new DomainError('INVALID_TRANSITION', `انتقال ممنوع في ${label}: ${from} → ${to}`);
}

// ── حساب صحيح فقط ───────────────────────────────────────────────────────
const isInt = Number.isSafeInteger;
function assertQty(n, label) { if (!isInt(n) || n < 0) throw new DomainError('INVALID_QTY', `${label}: لازم عدد صحيح ≥ 0 (وصل: ${n})`); }
const int = (n) => { if (!isInt(n)) throw new DomainError('NON_INTEGER', `ناتج حساب مش عدد صحيح: ${n}`); return n; };
const clone = (x) => (x === undefined || x === null ? null : JSON.parse(JSON.stringify(x)));
const cairoDate = (d) => {
  // Do not depend on locale-specific ordering: en-CA may format as MM/DD/YYYY on some ICU builds.
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const fields = Object.fromEntries(parts.filter(p => ['year', 'month', 'day'].includes(p.type)).map(p => [p.type, p.value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
};

export class OmNiCore {
  constructor(opts = {}) {
    this.items = new Map(); this.suppliers = new Map(); this.customers = new Map();
    this.warehouses = new Map(); this.locations = new Map();
    this.uoms = new Map(); this.uomConversions = [];
    this.pos = new Map(); this.receipts = new Map(); this.sos = new Map();
    this.exceptions = []; this.ledger = []; this.audit = [];
    this.counters = { PO: 0, GR: 0, SO: 0, SLE: 0, EVT: 0, EXC: 0, TRF: 0, ADJ: 0, RCL: 0 };
    this.recalls = new Map();             // item|batch → سجل سحب التشغيلة
    this.packGate = null;                 // v2.1: خطّاف قبل التغليف (بيتركّب من محطة الجودة)
    this.requireTote = !!opts.requireTote;
    this._lastHash = 'GENESIS'; this._auditHash = 'GENESIS';
    this._now = opts.now || (() => new Date());
    this._todayOverride = null;           // للاختبارات فقط — مش بيتصدّر ولا بيتستورد
    this._bal = new Map();                // فهرس الأرصدة (مشتق من الـLedger)
    this._batchExp = new Map();           // item|batch → expiry (مشتق من الـLedger)
  }
  // تاريخ اليوم بتوقيت القاهرة (مش UTC، ومش من الملف المستورد)
  get today() { return this._todayOverride ?? cairoDate(this._now()); }
  set today(v) { this._todayOverride = v; }

  _id(p) { return `${p}-${String(++this.counters[p]).padStart(6, '0')}`; }
  _iso() { return this._now().toISOString(); }
  _bkey(item, wh, loc, batch, status) { return `${item}|${wh}|${loc || ''}|${batch || ''}|${status}`; }
  _bucket(item, wh, loc, batch, status) { return this._bal.get(this._bkey(item, wh, loc, batch, status)) || 0; }

  // سجل التدقيق: متسلسل بـSHA-256 ولقطات عميقة (مفيش مرجع حي بيتغيّر بعدين)
  _audit(eventType, actor, sourceType, sourceId, beforeState, afterState, correlationId) {
    const body = { id: this._id('EVT'), eventType, timestamp: this._iso(), actorId: actor || 'system', tenantId: 'T1', companyId: 'C1', sourceType, sourceId, correlationId: correlationId || sourceId, beforeState: clone(beforeState), afterState: clone(afterState) };
    const hash = sha256(this._auditHash + canonical(body));
    this.audit.push(Object.freeze({ ...body, prevHash: this._auditHash, hash })); this._auditHash = hash;
  }
  // القيد الواحد: مجمّد + SHA-256(prev + canonical) + حارس رصيد سالب مركزي
  _post(type, payload) {
    const k = this._bkey(payload.itemCode, payload.warehouseCode, payload.locationKey, payload.batch, payload.stockStatus);
    const nb = (this._bal.get(k) || 0) + payload.qty;
    if (!isInt(payload.qty)) throw new DomainError('NON_INTEGER', `كمية غير صحيحة في القيد: ${payload.qty}`);
    if (nb < 0) throw new DomainError('NEGATIVE_BALANCE', `ممنوع رصيد سالب: ${payload.itemCode} @${payload.locationKey || payload.warehouseCode} [${payload.stockStatus}] هيبقى ${nb}`);
    const full = { id: this._id('SLE'), type, ...payload, timestamp: this._iso() };
    const hash = sha256(this._lastHash + canonical(full));
    const entry = Object.freeze({ ...full, prevHash: this._lastHash, hash });
    this._lastHash = hash; this.ledger.push(entry); this._bal.set(k, nb); return entry;
  }
  _isPharma(itemCode) { return this.items.get(itemCode)?.category === 'PHARMA'; }

  // ── Master Data ────────────────────────────────────────────────────────
  addUOM(code, name) { if (this.uoms.has(code)) throw new DomainError('DUPLICATE', `UOM موجود: ${code}`); this.uoms.set(code, { code, name }); this._audit('MASTER_UOM', null, 'UOM', code, null, { code, name }); return this.uoms.get(code); }
  addUOMConversion({ fromUOM, toUOM, factor, effectiveFrom = '2026-01-01', effectiveTo = '9999-12-31' }) {
    if (!this.uoms.has(fromUOM) || !this.uoms.has(toUOM)) throw new DomainError('UNKNOWN_UOM', 'وحدة غير معروفة في التحويل');
    if (!isInt(factor) || factor <= 0) throw new DomainError('INVALID_QTY', 'معامل التحويل لازم عدد صحيح > 0');
    const c = { fromUOM, toUOM, factor, effectiveFrom, effectiveTo };
    this.uomConversions.push(c); this._audit('MASTER_UOM_CONV', null, 'UOMConversion', `${fromUOM}>${toUOM}`, null, c); return c;
  }
  convertUOM(qty, fromUOM, toUOM, atDate = this.today) {
    if (fromUOM === toUOM) return qty;
    const c = this.uomConversions.find(x => x.fromUOM === fromUOM && x.toUOM === toUOM && atDate >= x.effectiveFrom && atDate <= x.effectiveTo);
    if (!c) throw new DomainError('NO_CONVERSION', `مفيش تحويل ساري من ${fromUOM} لـ${toUOM} في ${atDate}`);
    return int(qty * c.factor);
  }
  _factorToBase(itemCode, uom, atDate = this.today) {
    const base = this.items.get(itemCode).baseUOM; if (uom === base) return 1;
    const c = this.uomConversions.find(x => x.fromUOM === uom && x.toUOM === base && atDate >= x.effectiveFrom && atDate <= x.effectiveTo);
    if (!c) throw new DomainError('NO_CONVERSION', `الصنف ${itemCode}: مفيش تحويل ساري من ${uom} لوحدة الأساس ${base}`);
    return c.factor;
  }
  addItem({ code, name, category = 'GENERAL', baseUOM = 'EA', lasaGroup = null, gtin = null, aliases = [] }) {
    if (this.items.has(code)) throw new DomainError('DUPLICATE', `صنف موجود: ${code}`);
    if (!this.uoms.has(baseUOM)) throw new DomainError('UNKNOWN_UOM', `UOM غير معروفة: ${baseUOM}`);
    if (gtin && [...this.items.values()].some(i => i.gtin === gtin)) throw new DomainError('DUPLICATE', `GTIN مكرر: ${gtin}`);
    const it = { code, name, category, baseUOM, lasaGroup, gtin, aliases: [...aliases] }; this.items.set(code, it);
    this._audit('MASTER_ITEM', null, 'Item', code, null, it); return it;
  }
  findItemByGtin(gtin) { return [...this.items.values()].find(i => i.gtin === gtin) || null; }
  addSupplier({ code, name }) { if (this.suppliers.has(code)) throw new DomainError('DUPLICATE', `مورد موجود: ${code}`); const s = { code, name }; this.suppliers.set(code, s); this._audit('MASTER_SUPPLIER', null, 'Supplier', code, null, s); return s; }
  addCustomer({ code, name }) { if (this.customers.has(code)) throw new DomainError('DUPLICATE', `عميل موجود: ${code}`); const c = { code, name }; this.customers.set(code, c); this._audit('MASTER_CUSTOMER', null, 'Customer', code, null, c); return c; }
  addWarehouse({ code, name }) { if (this.warehouses.has(code)) throw new DomainError('DUPLICATE', `مخزن موجود: ${code}`); const w = { code, name }; this.warehouses.set(code, w); this._audit('MASTER_WAREHOUSE', null, 'Warehouse', code, null, w); return w; }
  addLocation({ warehouseCode, code, zone = 'A', aisle = null, bay = null, level = null, pickSeq = null, rack = null, col = null, beltAccess = false }) {
    if (rack !== null && (!isInt(rack) || rack < 0)) throw new DomainError('INVALID_COORD', `رقم الرف لازم عدد صحيح ≥ 0 (وصل: ${rack})`);
    if (rack !== null && (typeof col !== 'string' || !col.trim() || col.length > 3)) throw new DomainError('INVALID_COORD', 'حرف العمود مطلوب مع رقم الرف');
    for (const [n, v] of [['aisle', aisle], ['bay', bay], ['level', level], ['pickSeq', pickSeq]]) if (v !== null && (!isInt(v) || v < 0)) throw new DomainError('INVALID_COORD', `إحداثية ${n} لازم عدد صحيح ≥ 0 (وصل: ${v})`);
    if (!this.warehouses.has(warehouseCode)) throw new DomainError('UNKNOWN_WH', `مخزن غير معروف: ${warehouseCode}`);
    const key = `${warehouseCode}/${code}`; if (this.locations.has(key)) throw new DomainError('DUPLICATE', `موقع موجود: ${key}`);
    const l = { warehouseCode, code, zone, key, aisle, bay, level, pickSeq, ...(rack !== null ? { rack, col: col.trim() } : {}), ...(beltAccess ? { beltAccess: true } : {}) }; this.locations.set(key, l); this._audit('MASTER_LOCATION', null, 'Location', key, null, l); return l;
  }
  _quarantineLoc(warehouseCode) { for (const l of this.locations.values()) if (l.warehouseCode === warehouseCode && l.zone === 'QUARANTINE') return l.key; return null; }

  // ── Purchase Order ─────────────────────────────────────────────────────
  // التكلفة بالقروش (عدد صحيح). unitCost القديم (جنيه) بيتحوّل مرة واحدة هنا وبشرط ≤ خانتين عشريتين.
  _qirsh(l) {
    if (l.unitCostQirsh !== undefined) { if (!isInt(l.unitCostQirsh) || l.unitCostQirsh < 0) throw new DomainError('INVALID_COST', 'unitCostQirsh لازم عدد صحيح ≥ 0'); return l.unitCostQirsh; }
    if (l.unitCost === undefined || l.unitCost === null) return 0;
    const q = Math.round(l.unitCost * 100);
    if (!Number.isFinite(l.unitCost) || l.unitCost < 0 || Math.abs(l.unitCost * 100 - q) > 1e-6) throw new DomainError('INVALID_COST', `سعر الوحدة لازم ≤ خانتين عشريتين: ${l.unitCost}`);
    return q;
  }
  createPO({ supplierCode, warehouseCode, actor, lines }) {
    if (!this.suppliers.has(supplierCode)) throw new DomainError('UNKNOWN_SUPPLIER', `مورد غير معروف: ${supplierCode}`);
    if (!this.warehouses.has(warehouseCode)) throw new DomainError('UNKNOWN_WH', `مخزن غير معروف: ${warehouseCode}`);
    if (!Array.isArray(lines) || lines.length === 0) throw new DomainError('EMPTY_PO', 'أمر الشراء لازم يحتوي بند واحد على الأقل');
    const parsed = lines.map((l, i) => {
      if (!this.items.has(l.itemCode)) throw new DomainError('UNKNOWN_ITEM', `صنف غير معروف: ${l.itemCode}`);
      assertQty(l.orderedQty, 'الكمية المطلوبة'); if (l.orderedQty <= 0) throw new DomainError('INVALID_QTY', 'الكمية المطلوبة لازم > 0');
      const tol = l.tolerancePct ?? 0; if (!isInt(tol) || tol < 0 || tol > 100) throw new DomainError('INVALID_QTY', 'نسبة التسامح لازم عدد صحيح بين 0 و100');
      const uom = l.uom || this.items.get(l.itemCode).baseUOM; this._factorToBase(l.itemCode, uom);
      return { lineNo: i + 1, itemCode: l.itemCode, uom, orderedQty: l.orderedQty, tolerancePct: tol, unitCostQirsh: this._qirsh(l), receivedPosted: 0 };
    });
    const po = { id: this._id('PO'), supplierCode, warehouseCode, status: 'DRAFT', createdBy: actor || null, approvedBy: null, createdAt: this._iso(), lines: [] };
    parsed.forEach(p => po.lines.push({ id: `${po.id}-L${p.lineNo}`, ...p }));
    this.pos.set(po.id, po);
    this._audit('PO_CREATED', actor, 'PurchaseOrder', po.id, null, { status: 'DRAFT', lines: po.lines.length });
    return po;
  }
  // اعتماد أمر الشراء: لازم شخص غير اللي أنشأه (فصل صلاحيات)
  poAction(poId, to, actor) {
    const po = this.pos.get(poId); if (!po) throw new DomainError('NOT_FOUND', `PO غير موجود: ${poId}`);
    assertTransition(PO_FLOW, po.status, to, 'PurchaseOrder');
    if (to === 'APPROVED') {
      if (!actor || !po.createdBy || actor === po.createdBy) throw new DomainError('SEGREGATION_OF_DUTIES', 'اللي بيعتمد أمر الشراء لازم يكون غير اللي أنشأه — فصل الصلاحيات إجباري');
      po.approvedBy = actor;
    }
    const before = po.status; po.status = to;
    this._audit(`PO_${to}`, actor, 'PurchaseOrder', po.id, { status: before }, { status: to });
    return po;
  }
  _maxReceivable(l) { return Math.floor((l.orderedQty * (100 + l.tolerancePct)) / 100); }
  getPORemaining(poId) {
    const po = this.pos.get(poId); if (!po) throw new DomainError('NOT_FOUND', `PO غير موجود: ${poId}`);
    return po.lines.map(l => ({ lineId: l.id, itemCode: l.itemCode, ordered: l.orderedQty, receivedPosted: l.receivedPosted, remaining: Math.max(0, l.orderedQty - l.receivedPosted), maxReceivable: this._maxReceivable(l) }));
  }

  // ── Goods Receipt (+ PHARMA batch/expiry إلزامي + حجر صحي) ─────────────
  _committedForLine(poLineId) {
    let sum = 0;
    for (const r of this.receipts.values()) {
      if (['DRAFT', 'SUBMITTED', 'INSPECTING', 'ACCEPTED', 'PARTIALLY_ACCEPTED', 'POSTED', 'PUT_AWAY', 'COMPLETED'].includes(r.status)) for (const l of r.lines) if (l.poLineId === poLineId) sum += l.receivedQty;
    }
    return sum;
  }
  // الصلاحية المعروفة لتشغيلة: من الدفتر أو من استلامات لسه ماتنشرتش
  _knownExpiry(itemCode, batch, excludeGrId = null) {
    const k = `${itemCode}|${batch}`; if (this._batchExp.has(k)) return this._batchExp.get(k);
    for (const r of this.receipts.values()) {
      if (r.id === excludeGrId || r.status === 'POSTED' || r.status === 'PUT_AWAY' || r.status === 'COMPLETED') continue;
      for (const l of r.lines) if (l.itemCode === itemCode && l.batch === batch && l.expiryDate) return l.expiryDate;
    }
    return null;
  }
  createReceipt({ poId, locationKey, actor, lines }) {
    const po = this.pos.get(poId); if (!po) throw new DomainError('NOT_FOUND', `PO غير موجود: ${poId}`);
    if (!['APPROVED', 'PARTIALLY_RECEIVED'].includes(po.status)) throw new DomainError('PO_NOT_OPEN', `أمر الشراء مش في حالة تسمح بالاستلام (الحالة: ${po.status})`);
    if (locationKey && !this.locations.has(locationKey)) throw new DomainError('UNKNOWN_LOC', `موقع غير معروف: ${locationKey}`);
    const gr = { id: this._id('GR'), poId, warehouseCode: po.warehouseCode, locationKey: locationKey || null, status: 'DRAFT', createdAt: this._iso(), lines: [] };
    const addedThisCall = {};
    for (const l of lines) {
      const poLine = po.lines.find(x => x.id === l.poLineId);
      if (!poLine) throw new DomainError('BAD_LINE', `بند غير موجود في الـPO: ${l.poLineId}`);
      assertQty(l.receivedQty, 'الكمية المستلمة'); assertQty(l.rejectedQty ?? 0, 'الكمية المرفوضة');
      const rejectedQty = l.rejectedQty ?? 0;
      if (rejectedQty > l.receivedQty) throw new DomainError('REJECT_GT_RECEIVED', `المرفوض (${rejectedQty}) أكبر من المستلم (${l.receivedQty})`);
      if (this._isPharma(poLine.itemCode)) {
        if (!l.batch || !l.expiryDate) throw new DomainError('PHARMA_BATCH_REQUIRED', `الصنف ${poLine.itemCode} دواء — التشغيلة وتاريخ الصلاحية إجباريين (اشتراط هيئة الدواء)`);
        if (l.expiryDate < this.today) throw new DomainError('EXPIRED_GOODS', `استلام بضاعة منتهية الصلاحية ممنوع — تشغيلة ${l.batch} صلاحيتها ${l.expiryDate} (النهارده ${this.today})`);
      }
      if (l.batch && this._isRecalled(poLine.itemCode, l.batch)) throw new DomainError('RECALLED_BATCH', `التشغيلة ${l.batch} للصنف ${poLine.itemCode} عليها سحب (Recall) — الاستلام ممنوع`);
      if (l.batch && l.expiryDate) {
        const known = this._knownExpiry(poLine.itemCode, l.batch) ?? addedThisCall[`${poLine.itemCode}|${l.batch}`];
        if (known && known !== l.expiryDate) throw new DomainError('BATCH_EXPIRY_CONFLICT', `التشغيلة ${l.batch} للصنف ${poLine.itemCode} معروفة بصلاحية ${known} — مينفعش تتسجل بـ${l.expiryDate}`);
        addedThisCall[`${poLine.itemCode}|${l.batch}`] = l.expiryDate;
      }
      const acceptedQty = l.receivedQty - rejectedQty;
      const maxReceivable = this._maxReceivable(poLine), committed = this._committedForLine(poLine.id) + (gr.lines.filter(x => x.poLineId === poLine.id).reduce((s, x) => s + x.receivedQty, 0));
      if (committed + l.receivedQty > maxReceivable) throw new DomainError('OVER_RECEIVING', `الاستلام يتجاوز الحد المسموح (${maxReceivable}) للصنف ${poLine.itemCode} — المرتكَم الحالي: ${committed}`);
      gr.lines.push({ id: `${gr.id}-L${gr.lines.length + 1}`, poLineId: poLine.id, itemCode: poLine.itemCode, uom: poLine.uom, uomFactorSnapshot: this._factorToBase(poLine.itemCode, poLine.uom), receivedQty: l.receivedQty, rejectedQty, acceptedQty, batch: l.batch || null, expiryDate: l.expiryDate || null, unitCostQirsh: poLine.unitCostQirsh, qcStatus: 'PENDING' });
    }
    this.receipts.set(gr.id, gr);
    this._audit('GR_CREATED', actor, 'GoodsReceipt', gr.id, null, { poId, lines: gr.lines.length }, poId);
    return gr;
  }
  _grAction(grId, to, actor, extra) {
    const gr = this.receipts.get(grId); if (!gr) throw new DomainError('NOT_FOUND', `GR غير موجود: ${grId}`);
    assertTransition(GR_FLOW, gr.status, to, 'GoodsReceipt');
    const before = gr.status; gr.status = to;
    this._audit(`GR_${to}`, actor, 'GoodsReceipt', gr.id, { status: before }, { status: to, ...extra }, gr.poId);
    return gr;
  }
  submitReceipt(id, actor) { return this._grAction(id, 'SUBMITTED', actor); }
  startInspection(id, actor) { return this._grAction(id, 'INSPECTING', actor); }
  recordQC(grId, decisions, actor) {
    const gr = this.receipts.get(grId); if (!gr) throw new DomainError('NOT_FOUND', `GR غير موجود: ${grId}`);
    if (gr.status !== 'INSPECTING') throw new DomainError('INVALID_TRANSITION', `QC لازم يحصل في حالة INSPECTING (الحالة: ${gr.status})`);
    // قرار لكل بند، مرة واحدة — بند من غير قرار مش بيختفي بصمت
    const seen = new Set();
    for (const d of decisions) {
      if (!gr.lines.some(x => x.id === d.lineId)) throw new DomainError('BAD_LINE', `بند غير موجود: ${d.lineId}`);
      if (seen.has(d.lineId)) throw new DomainError('QC_DUPLICATE', `قرار QC مكرر للبند ${d.lineId}`);
      seen.add(d.lineId);
    }
    for (const l of gr.lines) if (!seen.has(l.id)) throw new DomainError('QC_INCOMPLETE', `بند ${l.id} (${l.itemCode}) من غير قرار QC — لازم قرار لكل بند`);
    for (const d of decisions) {
      const line = gr.lines.find(x => x.id === d.lineId);
      line.qcStatus = d.qcPass ? 'PASS' : 'FAIL';
      if (!d.qcPass) {
        const exc = { id: this._id('EXC'), type: 'QC_FAIL', severity: 'HIGH', receiptId: gr.id, lineId: line.id, itemCode: line.itemCode, evidence: d.reason || 'غير محدد', detectedBy: actor || 'qc', detectedAt: this._iso(), resolution: null, resolvedBy: null, resolvedAt: null };
        this.exceptions.push(exc); this._audit('QC_EXCEPTION', actor, 'ReceivingException', exc.id, null, exc, gr.id);
      }
    }
    const pass = gr.lines.filter(l => l.qcStatus === 'PASS').length;
    const to = pass === gr.lines.length ? 'ACCEPTED' : pass === 0 ? 'REJECTED' : 'PARTIALLY_ACCEPTED';
    assertTransition(GR_FLOW, gr.status, to, 'GoodsReceipt');
    const before = gr.status; gr.status = to;
    this._audit(`GR_${to}`, actor, 'GoodsReceipt', gr.id, { status: before }, { status: to, pass, total: gr.lines.length }, gr.poId);
    return gr;
  }
  postReceipt(grId, actor) {
    const gr = this.receipts.get(grId); if (!gr) throw new DomainError('NOT_FOUND', `GR غير موجود: ${grId}`);
    if (!['ACCEPTED', 'PARTIALLY_ACCEPTED', 'REJECTED'].includes(gr.status)) throw new DomainError('QC_REQUIRED', `ممنوع POST قبل اكتمال QC (الحالة: ${gr.status})`);
    const po = this.pos.get(gr.poId);
    const quarLoc = this._quarantineLoc(gr.warehouseCode) || gr.locationKey;
    // فحوصات قبل أي كتابة في الدفتر (الترحيل ذري: يا كله يا ولا حاجة)
    const plan = [];
    for (const line of gr.lines) {
      const f = line.uomFactorSnapshot;
      const availBase = line.qcStatus === 'PASS' ? line.acceptedQty * f : 0;
      const quarBase = (line.rejectedQty + (line.qcStatus === 'FAIL' ? line.acceptedQty : 0)) * f;
      if (line.qcStatus === 'PENDING' || availBase + quarBase !== line.receivedQty * f) throw new DomainError('CONSERVATION', `بند ${line.id}: المتاح + الحجر ≠ المستلم — الترحيل مرفوض`);
      if (line.batch && line.expiryDate) { const k = `${line.itemCode}|${line.batch}`; const ex = this._batchExp.get(k); if (ex && ex !== line.expiryDate) throw new DomainError('BATCH_EXPIRY_CONFLICT', `التشغيلة ${line.batch} متسجلة بصلاحية ${ex}`); }
      plan.push({ line, availBase, quarBase });
    }
    let posted = 0, quarantined = 0;
    for (const { line, availBase, quarBase } of plan) {
      const common = { itemCode: line.itemCode, warehouseCode: gr.warehouseCode, batch: line.batch, expiryDate: line.expiryDate, uom: this.items.get(line.itemCode).baseUOM, uomFactorSnapshot: line.uomFactorSnapshot, unitCostQirsh: line.unitCostQirsh, sourceType: 'GoodsReceipt', sourceId: gr.id, correlationId: gr.poId };
      if (availBase > 0) { this._post('STOCK_RECEIPT', { ...common, locationKey: gr.locationKey, qty: availBase, valueQirsh: int(line.acceptedQty * line.unitCostQirsh), stockStatus: 'AVAILABLE' }); posted++; }
      if (quarBase > 0) { const qPo = quarBase / line.uomFactorSnapshot; this._post('STOCK_QUARANTINE', { ...common, locationKey: quarLoc, qty: quarBase, valueQirsh: int(qPo * line.unitCostQirsh), stockStatus: 'QUARANTINE' }); quarantined++; }
      if (line.batch && line.expiryDate) this._batchExp.set(`${line.itemCode}|${line.batch}`, line.expiryDate);
      po.lines.find(x => x.id === line.poLineId).receivedPosted += line.receivedQty;
    }
    if (['APPROVED', 'PARTIALLY_RECEIVED'].includes(po.status)) {
      const allDone = po.lines.every(l => l.receivedPosted >= l.orderedQty);
      const before = po.status; po.status = allDone ? 'RECEIVED' : 'PARTIALLY_RECEIVED';
      if (po.status !== before) this._audit(`PO_${po.status}`, actor, 'PurchaseOrder', po.id, { status: before }, { status: po.status }, po.id);
    }
    const before = gr.status; gr.status = 'POSTED';
    this._audit('GR_POSTED', actor, 'GoodsReceipt', gr.id, { status: before }, { status: 'POSTED', ledgerEntries: posted + quarantined, quarantined }, gr.poId);
    return gr;
  }
  putAway(grId, actor) { return this._grAction(grId, 'PUT_AWAY', actor); }
  completePutAway(grId, actor) { return this._grAction(grId, 'COMPLETED', actor); }

  // RTV: بيرجّع بس اللي اتحجر بسبب الاستلام ده (مش أي رصيد حجر لنفس الصنف/التشغيلة)
  returnToVendor(grId, actor) {
    const gr = this.receipts.get(grId); if (!gr) throw new DomainError('NOT_FOUND', `GR غير موجود: ${grId}`);
    if (!['POSTED', 'PUT_AWAY', 'COMPLETED'].includes(gr.status)) throw new DomainError('INVALID_TRANSITION', `RTV مسموح بعد POST بس (الحالة: ${gr.status})`);
    const mine = {};
    for (const e of this.ledger) {
      if (e.sourceId !== gr.id || (e.type !== 'STOCK_QUARANTINE' && e.type !== 'RTV')) continue;
      const k = this._bkey(e.itemCode, e.warehouseCode, e.locationKey, e.batch, 'QUARANTINE');
      if (!mine[k]) mine[k] = { e, qty: 0 };
      mine[k].qty += e.qty;
    }
    if (!this.ledger.some(e => e.type === 'STOCK_QUARANTINE' && e.sourceId === gr.id)) throw new DomainError('NO_QUARANTINE', 'مفيش رصيد حجر صحي مرتبط بالاستلام ده');
    let returned = 0;
    for (const { e: q, qty } of Object.values(mine)) {
      const take = Math.min(qty, this._bucket(q.itemCode, gr.warehouseCode, q.locationKey, q.batch, 'QUARANTINE'));
      if (take <= 0) continue;
      this._post('RTV', { itemCode: q.itemCode, warehouseCode: gr.warehouseCode, locationKey: q.locationKey, batch: q.batch, expiryDate: q.expiryDate, qty: -take, uom: q.uom, uomFactorSnapshot: 1, unitCostQirsh: q.unitCostQirsh, valueQirsh: null, stockStatus: 'QUARANTINE', sourceType: 'ReturnToVendor', sourceId: gr.id, correlationId: gr.poId });
      returned += take;
    }
    if (returned === 0) throw new DomainError('NO_QUARANTINE', 'رصيد الحجر الصحي للاستلام ده اتصفّر قبل كده');
    for (const exc of this.exceptions.filter(x => x.receiptId === grId && !x.resolution)) {
      exc.resolution = 'RTV'; exc.resolvedBy = actor || 'system'; exc.resolvedAt = this._iso();
      this._audit('EXCEPTION_RESOLVED', actor, 'ReceivingException', exc.id, null, { resolution: 'RTV' }, gr.id);
    }
    this._audit('RTV_POSTED', actor, 'GoodsReceipt', grId, null, { returnedQty: returned }, gr.poId);
    return { returnedQty: returned };
  }

  // ── Sales Order + FEFO Allocation + Scan-Verified Picking ──────────────
  createSO({ customerCode, warehouseCode, actor, lines }) {
    if (!this.customers.has(customerCode)) throw new DomainError('UNKNOWN_CUSTOMER', `عميل غير معروف: ${customerCode}`);
    if (!this.warehouses.has(warehouseCode)) throw new DomainError('UNKNOWN_WH', `مخزن غير معروف: ${warehouseCode}`);
    if (!Array.isArray(lines) || lines.length === 0) throw new DomainError('EMPTY_SO', 'أمر البيع لازم يحتوي بند واحد على الأقل');
    const so = { id: this._id('SO'), customerCode, warehouseCode, status: 'DRAFT', createdAt: this._iso(), lines: [], allocations: [] };
    lines.forEach((l, i) => {
      if (!this.items.has(l.itemCode)) throw new DomainError('UNKNOWN_ITEM', `صنف غير معروف: ${l.itemCode}`);
      assertQty(l.orderedQty, 'الكمية المطلوبة'); if (l.orderedQty <= 0) throw new DomainError('INVALID_QTY', 'الكمية المطلوبة لازم > 0');
      so.lines.push({ id: `${so.id}-L${i + 1}`, lineNo: i + 1, itemCode: l.itemCode, uom: this.items.get(l.itemCode).baseUOM, orderedQty: l.orderedQty, allocatedQty: 0, pickedQty: 0, shortage: 0 });
    });
    this.sos.set(so.id, so);
    this._audit('SO_CREATED', actor, 'SalesOrder', so.id, null, { status: 'DRAFT', lines: so.lines.length });
    return so;
  }
  soAction(soId, to, actor) {
    const so = this.sos.get(soId); if (!so) throw new DomainError('NOT_FOUND', `SO غير موجود: ${soId}`);
    assertTransition(SO_FLOW, so.status, to, 'SalesOrder');
    const before = so.status; so.status = to;
    this._audit(`SO_${to}`, actor, 'SalesOrder', so.id, { status: before }, { status: to });
    return so;
  }
  _reserved(itemCode, warehouseCode, excludeSoId = null) {
    const res = {};
    for (const so of this.sos.values()) {
      if (so.id === excludeSoId || so.warehouseCode !== warehouseCode) continue;
      if (!['ALLOCATED', 'PICKING', 'PACKED'].includes(so.status)) continue;
      for (const a of so.allocations) { if (a.itemCode !== itemCode) continue; const k = `${a.batch}|${a.locationKey}`; res[k] = (res[k] || 0) + a.qty; }
    }
    return res;
  }
  _batchBalance(itemCode, warehouseCode, locationKey, batch, status) { return this._bucket(itemCode, warehouseCode, locationKey, batch, status); }
  getAvailableBatches(itemCode, warehouseCode, excludeSoId = null) {
    const res = this._reserved(itemCode, warehouseCode, excludeSoId);
    const batches = {};
    for (const e of this.ledger) {
      if (e.itemCode !== itemCode || e.warehouseCode !== warehouseCode || e.stockStatus !== 'AVAILABLE') continue;
      const k = `${e.batch}|${e.locationKey}`;
      if (!batches[k]) batches[k] = { itemCode, batch: e.batch, expiryDate: e.expiryDate || '9999-12-31', locationKey: e.locationKey, qty: 0 };
      batches[k].qty += e.qty;
    }
    return Object.values(batches)
      .map(b => ({ ...b, qty: b.qty - (res[`${b.batch}|${b.locationKey}`] || 0) }))
      .filter(b => b.qty > 0 && b.expiryDate >= this.today && !this._isRecalled(itemCode, b.batch))
      .sort((a, b) => (a.expiryDate < b.expiryDate ? -1 : a.expiryDate > b.expiryDate ? 1 : 0));
  }
  allocateSO(soId, actor) {
    const so = this.sos.get(soId); if (!so) throw new DomainError('NOT_FOUND', `SO غير موجود: ${soId}`);
    assertTransition(SO_FLOW, so.status, 'ALLOCATED', 'SalesOrder');
    let totalAllocated = 0; const newAllocs = [];
    for (const line of so.lines) {
      let need = line.orderedQty;
      for (const b of this.getAvailableBatches(line.itemCode, so.warehouseCode, so.id)) {
        if (need <= 0) break;
        const already = newAllocs.filter(a => a.itemCode === line.itemCode && a.batch === b.batch && a.locationKey === b.locationKey).reduce((s, a) => s + a.qty, 0);
        const avail = b.qty - already; if (avail <= 0) continue;
        const take = Math.min(need, avail);
        newAllocs.push({ id: `${so.id}-A${newAllocs.length + 1}`, lineId: line.id, itemCode: line.itemCode, batch: b.batch, expiryDate: b.expiryDate, locationKey: b.locationKey, qty: take, picked: false });
        need -= take; totalAllocated += take;
      }
      line.allocatedQty = line.orderedQty - need; line.shortage = Math.max(0, need);
    }
    if (totalAllocated <= 0) throw new DomainError('NO_STOCK', 'مفيش رصيد متاح (غير منتهي وغير محجوز) لأي بند في الأوردر');
    so.allocations = newAllocs;
    const before = so.status; so.status = 'ALLOCATED';
    this._audit('SO_ALLOCATED', actor, 'SalesOrder', so.id, { status: before }, { status: 'ALLOCATED', totalAllocated, shortages: so.lines.filter(l => l.shortage > 0).length });
    return so;
  }
  // المسح: لازم (صنف + تشغيلة) يطابقوا التخصيص — الصنف الغلط (LASA) والتشغيلة الغلط الاتنين BLOCK. الدُفعة ذرّية.
  confirmPick(soId, scans, actor) {
    const so = this.sos.get(soId); if (!so) throw new DomainError('NOT_FOUND', `SO غير موجود: ${soId}`);
    if (so.status !== 'ALLOCATED' && so.status !== 'PICKING') throw new DomainError('INVALID_TRANSITION', `السحب مسموح في ALLOCATED/PICKING بس (الحالة: ${so.status})`);
    if (!Array.isArray(scans) || scans.length === 0) throw new DomainError('EMPTY_SCAN', 'لازم مسح واحد على الأقل');
    if (this.requireTote && !so.toteCode) throw new DomainError('TOTE_REQUIRED', 'لازم تربط صندوق بالأوردر قبل السحب (امسح باركود الصندوق)');
    const inBatch = new Set(), ok = [];
    for (const s of scans) {
      const a = so.allocations.find(x => x.id === s.allocationId);
      if (!a) throw new DomainError('BAD_ALLOCATION', `تخصيص غير موجود: ${s.allocationId}`);
      if (a.picked || inBatch.has(a.id)) throw new DomainError('ALREADY_PICKED', `التخصيص ${a.id} اتسحب قبل كده — منع صرف مزدوج`);
      if (!s.scannedItemCode) throw new DomainError('SCAN_ITEM_REQUIRED', 'لازم مسح الصنف (GTIN) مع التشغيلة — مسح التشغيلة لوحده مش كفاية');
      const block = (type, evidence, msg) => {
        const exc = { id: this._id('EXC'), type, severity: 'CRITICAL', receiptId: null, lineId: a.lineId, itemCode: a.itemCode, evidence, detectedBy: actor || 'picker', detectedAt: this._iso(), resolution: null, resolvedBy: null, resolvedAt: null };
        this.exceptions.push(exc); this._audit('PICK_BLOCKED', actor, 'SalesOrder', so.id, null, exc, so.id);
        throw new DomainError(type, msg);
      };
      if (this._isRecalled(a.itemCode, a.batch)) block('RECALLED_BATCH', `محاولة سحب تشغيلة ${a.batch} عليها Recall (${this.recalls.get(a.itemCode + '|' + a.batch).refNo})`, `ممنوع الصرف: التشغيلة ${a.batch} للصنف ${a.itemCode} عليها سحب (Recall) رقم ${this.recalls.get(a.itemCode + '|' + a.batch).refNo} — حوّل الأوردر لإعادة التخصيص`);
      if (s.scannedItemCode !== a.itemCode) block('ITEM_MISMATCH', `اتمسح صنف ${s.scannedItemCode} والمطلوب ${a.itemCode} (LASA)`, `ممنوع الصرف: اتمسح صنف ${s.scannedItemCode} والسيستم مخصّص ${a.itemCode} — خطر تشابه أدوية (LASA)`);
      if ((s.scannedBatch || null) !== (a.batch || null)) block('BATCH_MISMATCH', `اتمسح ${s.scannedBatch || 'فاضي'} والمطلوب ${a.batch} (FEFO)`, `ممنوع الصرف: اتمسحت تشغيلة ${s.scannedBatch || 'فاضية'} والسيستم مخصّص ${a.batch} صلاحية ${a.expiryDate} — قاعدة FEFO بتمنع الخطأ ده`);
      inBatch.add(a.id); ok.push(a);
    }
    for (const a of ok) {
      a.picked = true; const line = so.lines.find(l => l.id === a.lineId); line.pickedQty += a.qty;
      this._audit('PICK_CONFIRMED', actor, 'SalesOrder', so.id, null, { allocationId: a.id, batch: a.batch, qty: a.qty });
    }
    if (so.status === 'ALLOCATED') { const before = so.status; so.status = 'PICKING'; this._audit('SO_PICKING', actor, 'SalesOrder', so.id, { status: before }, { status: 'PICKING' }); }
    return so;
  }
  packSO(soId, actor) {
    const so = this.sos.get(soId); if (!so) throw new DomainError('NOT_FOUND', `SO غير موجود: ${soId}`);
    const unpicked = so.allocations.filter(a => !a.picked);
    if (unpicked.length > 0) throw new DomainError('PICK_INCOMPLETE', `فيه ${unpicked.length} تخصيص لسه متسحبش — ممنوع التغليف قبل اكتمال السحب`);
    for (const a of so.allocations) if (this._isRecalled(a.itemCode, a.batch)) throw new DomainError('RECALLED_BATCH', `التشغيلة ${a.batch} للصنف ${a.itemCode} عليها سحب (Recall) — ممنوع التغليف`);
    const shorts = so.lines.filter(l => l.shortage > 0);
    if (shorts.length && !so.shortageAck) throw new DomainError('SHORTAGE_UNACKNOWLEDGED', `الأوردر ناقص: ${shorts.map(l => `${l.itemCode} مطلوب ${l.orderedQty} والمتاح ${l.allocatedQty}`).join(' · ')} — لازم إقرار بالصرف الجزئي وسببه قبل التغليف`);
    if (this.packGate) this.packGate(so, actor); // v2.1: بوابة اختيارية (فحص الجودة) — null افتراضيًا ومش بتتحفظ مع الملف
    assertTransition(SO_FLOW, so.status, 'PACKED', 'SalesOrder');
    const before = so.status; so.status = 'PACKED';
    this._audit('SO_PACKED', actor, 'SalesOrder', so.id, { status: before }, { status: 'PACKED' });
    return so;
  }
  // v2.2: النقص في التخصيص ما يتشحنش بصمت — لازم إقرار باسم وسبب (بيتسجّل في سجل التدقيق)
  acknowledgeShortage(soId, actor, reason) {
    const so = this.sos.get(soId); if (!so) throw new DomainError('NOT_FOUND', `SO غير موجود: ${soId}`);
    if (!['ALLOCATED', 'PICKING'].includes(so.status)) throw new DomainError('INVALID_STATE', `الإقرار بالنقص قبل التغليف بس (حالة الأوردر: ${so.status})`);
    const shorts = so.lines.filter(l => l.shortage > 0); if (!shorts.length) throw new DomainError('NO_SHORTAGE', 'الأوردر مفيهوش نقص');
    if (typeof actor !== 'string' || !actor.trim()) throw new DomainError('ACTOR_REQUIRED', 'لازم اسم اللي بيقرّ بالنقص');
    if (typeof reason !== 'string' || reason.trim().length < 3) throw new DomainError('REASON_REQUIRED', 'سبب الصرف الجزئي مطلوب (3 حروف على الأقل)');
    so.shortageAck = { actor: actor.trim(), reason: reason.trim(), at: this._iso() };
    this._audit('SO_SHORTAGE_ACKNOWLEDGED', actor.trim(), 'SalesOrder', so.id, null, { reason: reason.trim(), shortages: shorts.map(l => ({ lineId: l.id, itemCode: l.itemCode, ordered: l.orderedQty, allocated: l.allocatedQty, short: l.shortage })) });
    return so;
  }
  dispatchSO(soId, actor) {
    const so = this.sos.get(soId); if (!so) throw new DomainError('NOT_FOUND', `SO غير موجود: ${soId}`);
    assertTransition(SO_FLOW, so.status, 'DISPATCHED', 'SalesOrder');
    for (const a of so.allocations) if (this._isRecalled(a.itemCode, a.batch)) throw new DomainError('RECALLED_BATCH', `التشغيلة ${a.batch} للصنف ${a.itemCode} عليها سحب (Recall) — الصرف ممنوع`);
    for (const a of so.allocations) if (a.expiryDate < this.today) throw new DomainError('EXPIRED_ALLOCATION', `التشغيلة ${a.batch} بقت منتهية (${a.expiryDate}) — الصرف ممنوع، أعد التخصيص`);
    // فحص ذرّي قبل أي كتابة: الرصيد الفعلي لازم يغطي كل التخصيصات
    const need = new Map();
    for (const a of so.allocations) { const k = this._bkey(a.itemCode, so.warehouseCode, a.locationKey, a.batch, 'AVAILABLE'); need.set(k, (need.get(k) || 0) + a.qty); }
    for (const [k, q] of need) if ((this._bal.get(k) || 0) < q) throw new DomainError('STOCK_SHORTAGE_AT_DISPATCH', `الرصيد الفعلي (${this._bal.get(k) || 0}) أقل من المخصّص (${q}) — الصرف ممنوع وأعد التخصيص`);
    for (const a of so.allocations) {
      this._post('STOCK_ISSUE', { itemCode: a.itemCode, warehouseCode: so.warehouseCode, locationKey: a.locationKey, batch: a.batch, expiryDate: a.expiryDate, qty: -a.qty, uom: this.items.get(a.itemCode).baseUOM, uomFactorSnapshot: 1, unitCostQirsh: null, valueQirsh: null, stockStatus: 'AVAILABLE', sourceType: 'SalesOrder', sourceId: so.id, correlationId: so.id });
    }
    const before = so.status; so.status = 'DISPATCHED';
    this._audit('SO_DISPATCHED', actor, 'SalesOrder', so.id, { status: before }, { status: 'DISPATCHED', issues: so.allocations.length });
    return so;
  }

  // ── Transfer بين المواقع + تسوية جرد بفصل صلاحيات ─────────────────────
  _registeredExpiry(itemCode, batch) { return batch ? (this._batchExp.get(`${itemCode}|${batch}`) ?? null) : null; }
  transfer({ itemCode, warehouseCode, fromLoc, toLoc, batch = null, qty, actor }) {
    if (!this.items.has(itemCode)) throw new DomainError('UNKNOWN_ITEM', `صنف غير معروف: ${itemCode}`);
    if (!this.locations.has(fromLoc) || !this.locations.has(toLoc)) throw new DomainError('UNKNOWN_LOC', 'موقع غير معروف في التحويل');
    if (fromLoc === toLoc) throw new DomainError('SAME_LOC', 'التحويل لنفس الموقع مرفوض');
    assertQty(qty, 'كمية التحويل'); if (qty <= 0) throw new DomainError('INVALID_QTY', 'كمية التحويل لازم > 0');
    if (this._isRecalled(itemCode, batch)) throw new DomainError('RECALLED_BATCH', `التشغيلة ${batch} للصنف ${itemCode} عليها Recall — ممنوع تحويلها بين المواقع`);
    const avail = this._bucket(itemCode, warehouseCode, fromLoc, batch, 'AVAILABLE') - (this._reserved(itemCode, warehouseCode)[`${batch}|${fromLoc}`] || 0);
    if (qty > avail) throw new DomainError('INSUFFICIENT_STOCK', `المتاح في ${fromLoc} للتشغيلة ${batch} هو ${avail} بس — المطلوب ${qty}`);
    const exp = this._registeredExpiry(itemCode, batch); const id = this._id('TRF');
    const base = { itemCode, warehouseCode, batch, expiryDate: exp, uom: this.items.get(itemCode).baseUOM, uomFactorSnapshot: 1, unitCostQirsh: null, valueQirsh: null, stockStatus: 'AVAILABLE', sourceType: 'Transfer', sourceId: id, correlationId: id };
    this._post('TRANSFER_OUT', { ...base, locationKey: fromLoc, qty: -qty });
    this._post('TRANSFER_IN', { ...base, locationKey: toLoc, qty });
    this._audit('TRANSFER', actor, 'Transfer', id, null, { itemCode, batch, qty, fromLoc, toLoc });
    return { id };
  }
  stockAdjustment({ itemCode, warehouseCode, locationKey, batch = null, qtyDelta, reason, actor, approver }) {
    if (!this.items.has(itemCode)) throw new DomainError('UNKNOWN_ITEM', `صنف غير معروف: ${itemCode}`);
    if (!isInt(qtyDelta) || qtyDelta === 0) throw new DomainError('INVALID_QTY', 'فرق التسوية لازم عدد صحيح ≠ 0');
    if (!reason || !String(reason).trim()) throw new DomainError('REASON_REQUIRED', 'التسوية بدون سبب موثّق ممنوعة — التدقيق مش بيقبل "كده"');
    if (!actor || !approver || actor === approver) throw new DomainError('SEGREGATION_OF_DUTIES', 'اللي بيسجّل التسوية لازم يكون غير اللي بيعتمدها — فصل الصلاحيات إجباري');
    if (this._isPharma(itemCode) && !batch) throw new DomainError('PHARMA_BATCH_REQUIRED', 'تسوية دواء لازم تحدد التشغيلة');
    if (batch && qtyDelta > 0 && this._isRecalled(itemCode, batch)) throw new DomainError('RECALLED_BATCH', `تسوية بالموجب على تشغيلة عليها Recall ممنوعة (${batch})`);
    const exp = this._registeredExpiry(itemCode, batch);
    if (batch && exp === null && this._isPharma(itemCode)) throw new DomainError('UNKNOWN_BATCH', `التشغيلة ${batch} مش متسجلة — مينفعش تتخلق بتسوية`);
    if (qtyDelta < 0) {
      const free = this._bucket(itemCode, warehouseCode, locationKey, batch, 'AVAILABLE') - (this._reserved(itemCode, warehouseCode)[`${batch}|${locationKey}`] || 0);
      if (-qtyDelta > free) throw new DomainError('INSUFFICIENT_STOCK', `التسوية بالسالب (${qtyDelta}) أكبر من الرصيد الحر (${free}) — جزء منه محجوز لأوردرات`);
    }
    const id = this._id('ADJ');
    this._post('STOCK_ADJUSTMENT', { itemCode, warehouseCode, locationKey, batch, expiryDate: exp, qty: qtyDelta, uom: this.items.get(itemCode).baseUOM, uomFactorSnapshot: 1, unitCostQirsh: null, valueQirsh: null, stockStatus: 'AVAILABLE', sourceType: 'Adjustment', sourceId: id, correlationId: id, reason, approvedBy: approver });
    this._audit('ADJUSTMENT', actor, 'Adjustment', id, null, { itemCode, batch, qtyDelta, reason, approver });
    return { id };
  }


  // ═══ v1.2 — الربط بين الصندوق والأوردر ═════════════════════════════════
  bindTote(soId, toteCode, actor) {
    const so = this.sos.get(soId); if (!so) throw new DomainError('NOT_FOUND', `SO غير موجود: ${soId}`);
    if (!['ALLOCATED', 'PICKING'].includes(so.status)) throw new DomainError('INVALID_TRANSITION', `ربط الصندوق في ALLOCATED/PICKING بس (الحالة: ${so.status})`);
    if (!toteCode || !String(toteCode).trim()) throw new DomainError('TOTE_REQUIRED', 'كود الصندوق مطلوب');
    if (so.toteCode && so.toteCode !== toteCode) throw new DomainError('TOTE_ALREADY_BOUND', `الأوردر ${so.id} مربوط بصندوق ${so.toteCode} بالفعل`);
    for (const o of this.sos.values()) if (o.id !== so.id && o.toteCode === toteCode && ['ALLOCATED', 'PICKING', 'PACKED'].includes(o.status)) throw new DomainError('TOTE_IN_USE', `الصندوق ${toteCode} مستخدم في أوردر شغّال (${o.id}) — خد صندوق فاضي`);
    so.toteCode = toteCode;
    this._audit('TOTE_BOUND', actor, 'SalesOrder', so.id, null, { toteCode });
    return so;
  }

  // ═══ v1.2 — مسار السحب: لفّة واحدة اتجاه واحد من سير الجودة (Zero-Backtracking) ═══
  // pickSeq = ترتيب المشي الفعلي في المخزن (بيتحدد من تخطيط المخزن الحقيقي). المسار = ترتيب تصاعدي بالـpickSeq.
  _distanceUnits(seqs, start = 0) { let pos = start, d = 0; for (const q of seqs) { d += Math.abs(q - pos); pos = q; } return d; }
  describeStop(stop) {
    const where = [];
    if (stop.rack !== null && stop.rack !== undefined) {
      where.push(`رف ${stop.rack}`);
      if (stop.col) where.push(`عمود ${stop.col}`);
      if (stop.level !== null && stop.level !== undefined) where.push(levelSay(stop.level, true));
    } else {
      if (stop.aisle !== null && stop.aisle !== undefined) where.push(`ممر ${stop.aisle}`);
      if (stop.bay !== null && stop.bay !== undefined) where.push(`العمود ${stop.bay}`);
      if (stop.level !== null && stop.level !== undefined) where.push(levelSay(stop.level, false));
    }
    if (where.length === 0) where.push(`الموقع ${stop.locationKey.split('/').pop()}`);
    const picks = stop.picks.map(p => `${p.qty} ${p.itemName}`).join(' و');
    return `${where.join('، ')}. اسحب ${picks}`;
  }
  // رقم ترتيب المشي (pickSeq) لأول موقع في رف معيّن — بيستخدمه العامل لما يقول "أنا عند رف 28"
  seqOfRack(rack, warehouseCode = null) {
    const seqs = [...this.locations.values()].filter(l => l.rack === rack && (!warehouseCode || l.warehouseCode === warehouseCode) && isInt(l.pickSeq)).map(l => l.pickSeq);
    if (!seqs.length) throw new DomainError('UNKNOWN_RACK', `رف ${rack} مش موجود في التخطيط`);
    return Math.min(...seqs);
  }
  // opts.fromSeq = موقع العامل الحالي (بدل سير الجودة) · opts.order = 'ASC' تصاعدي | 'DESC' تنازلي (يبدأ من الأبعد ويرجع ناحية السير: فاضي داخل، تقيل خارج)
  planPickRoute(soId, opts = {}) {
    const so = this.sos.get(soId); if (!so) throw new DomainError('NOT_FOUND', `SO غير موجود: ${soId}`);
    if (!['ALLOCATED', 'PICKING'].includes(so.status)) throw new DomainError('INVALID_TRANSITION', `تخطيط المسار في ALLOCATED/PICKING بس (الحالة: ${so.status})`);
    const fromSeq = opts.fromSeq ?? null, order = opts.order ?? 'ASC';
    if (fromSeq !== null && !isInt(fromSeq)) throw new DomainError('INVALID_OPTION', 'fromSeq لازم عدد صحيح');
    if (order !== 'ASC' && order !== 'DESC') throw new DomainError('INVALID_OPTION', "order لازم ASC أو DESC");
    const byLoc = new Map();
    for (const a of so.allocations) {
      if (a.picked) continue;
      if (!byLoc.has(a.locationKey)) { const L = this.locations.get(a.locationKey) || {}; byLoc.set(a.locationKey, { locationKey: a.locationKey, aisle: L.aisle ?? null, bay: L.bay ?? null, level: L.level ?? null, rack: L.rack ?? null, col: L.col ?? null, pickSeq: L.pickSeq ?? null, mapped: Number.isSafeInteger(L.pickSeq), picks: [] }); }
      byLoc.get(a.locationKey).picks.push({ allocationId: a.id, itemCode: a.itemCode, itemName: this.items.get(a.itemCode).name, batch: a.batch, expiryDate: a.expiryDate, qty: a.qty });
    }
    const raw = [...byLoc.values()], dir = order === 'ASC' ? 1 : -1;
    const mapped = raw.filter(x => x.mapped).sort((x, y) => dir * (x.pickSeq - y.pickSeq) || (x.locationKey < y.locationKey ? -1 : 1));
    const unmapped = raw.filter(x => !x.mapped).sort((x, y) => (x.locationKey < y.locationKey ? -1 : 1));
    let ahead = mapped, behind = [];
    if (fromSeq !== null) { ahead = mapped.filter(x => dir * (x.pickSeq - fromSeq) >= 0); behind = mapped.filter(x => dir * (x.pickSeq - fromSeq) < 0); behind.forEach(x => { x.wrapsLoop = true; }); }
    const stops = [...ahead, ...behind, ...unmapped];
    stops.forEach((st, i) => { st.step = i + 1; st.say = (st.wrapsLoop ? 'ارجع: ' : '') + this.describeStop(st); });
    const mappedAll = stops.every(x => x.mapped);
    const start = fromSeq ?? 0;
    const dist = (arr) => this._distanceUnits(arr.filter(x => x.mapped).map(x => x.pickSeq), start);
    return { soId, toteCode: so.toteCode || null, origin: fromSeq === null ? 'QC_BELT' : 'WORKER_POSITION', order, fromSeq, stops, mappedAll, finish: this._finishGuidance(so, stops.length ? stops.at(-1) : null, fromSeq), planned: { distanceUnits: dist(stops) }, naive: { distanceUnits: dist(raw) },
      note: 'الوحدات نموذجية (فرق ترتيب المشي pickSeq) مش أمتار — التوفير الفعلي لازم يتقاس ميدانيًا (Shadow Mode).' };
  }
  // آخر خطوة: بعد آخر صنف يوجّه العامل لأقرب نقطة على السير (الأماكن بتتحدد بـ beltAccess في التخطيط؛ لو مفيش، رسالة عامة)
  _finishGuidance(so, lastStop, fromSeq = null) {
    const drops = [...this.locations.values()].filter(l => l.warehouseCode === so.warehouseCode && l.beltAccess && isInt(l.pickSeq));
    const ref = lastStop && lastStop.mapped ? lastStop.pickSeq : fromSeq; // لو السحب خلص: آخر موقع العامل وقف عنده
    let drop = null;
    if (ref !== null && drops.length) drop = drops.slice().sort((a, b) => Math.abs(a.pickSeq - ref) - Math.abs(b.pickSeq - ref) || a.pickSeq - b.pickSeq)[0];
    const at = drop ? (drop.rack !== undefined ? `رف ${drop.rack}` : `الموقع ${drop.code}`) : null;
    return { dropLocationKey: drop ? drop.key : null, say: `اكتمل الأوردر. ${at ? `أقرب نقطة على السير عند ${at}؛ ` : ''}ضع الصندوق على السير لنقله لمراقب الجودة.` };
  }
  // جدولة عدة مساحب: كل نقطة = وحدة زمن واحدة؛ لو ممر مشغول في نفس الوحدة، المحضّر التاني بيتأخر في البداية (مش بيتغيّر ترتيبه)
  scheduleRoutes(routes) {
    const occ = new Set(), out = [];
    const aisleOf = (st) => (st.aisle === null || st.aisle === undefined ? null : st.aisle);
    for (const r of routes) {
      let off = 0;
      for (; off < 1000; off++) { if (!r.stops.some((st, i) => { const a = aisleOf(st); return a !== null && occ.has(`${off + i}|${a}`); })) break; }
      if (off >= 1000) throw new DomainError('SCHEDULE_FAILED', 'مفيش جدولة بلا تزاحم في الحد المسموح');
      const timeline = r.stops.map((st, i) => { const a = aisleOf(st); if (a !== null) occ.add(`${off + i}|${a}`); return { t: off + i, aisle: a, locationKey: st.locationKey }; });
      out.push({ soId: r.soId, picker: r.picker || null, startOffset: off, timeline });
    }
    return out;
  }

  // ═══ v1.2 — بحث بالكتالوج والأوردرات للطبقة الصوتية: مرشّحين فقط، التأكيد بالمسح ═══
  searchCatalog(text, limit = 5) {
    const q = normText(text); if (!q) return { query: q, candidates: [], needsConfirmation: true, lasaSiblings: [] };
    const qt = q.split(' ').filter(Boolean), qNums = qt.filter(t => /^[0-9]+$/.test(t));
    const cands = [];
    for (const it of this.items.values()) {
      const toks = new Set([it.name, it.code, ...(it.aliases || [])].map(normText).join(' ').split(' ').filter(Boolean));
      const qi = qt.slice(); for (let k = 0; k < qi.length - 1; k++) if (!/^[0-9]+$/.test(qi[k]) && !/^[0-9]+$/.test(qi[k + 1]) && !toks.has(qi[k]) && toks.has(qi[k] + qi[k + 1])) qi.splice(k, 2, qi[k] + qi[k + 1]);
      const hit = qi.filter(t => toks.has(t)).length; if (hit === 0) continue;
      let score = hit / qi.length; if (qNums.some(n => !toks.has(n))) score *= 0.3;
      if (score >= 0.34) cands.push({ code: it.code, name: it.name, lasaGroup: it.lasaGroup, score: Math.round(score * 100) / 100 });
    }
    cands.sort((a, b) => b.score - a.score || (a.code < b.code ? -1 : 1));
    const top = cands.slice(0, limit);
    const sib = top.length ? [...this.items.values()].filter(i => top[0].lasaGroup && i.lasaGroup === top[0].lasaGroup && i.code !== top[0].code).map(i => i.code) : [];
    return { query: q, candidates: top, lasaSiblings: sib, needsConfirmation: top.length !== 1 || top[0].score < 1 };
  }
  findOrders(text, statuses = ['ALLOCATED', 'PICKING']) {
    const q = normText(text); const qt = q.split(' ').filter(Boolean); const nums = qt.filter(t => /^[0-9]+$/.test(t)).map(Number);
    const out = [];
    for (const so of this.sos.values()) {
      if (!statuses.includes(so.status)) continue;
      const cust = this.customers.get(so.customerCode); const ctoks = new Set(normText(`${cust?.name || ''} ${so.customerCode}`).split(' ').filter(Boolean));
      const idNum = parseInt(so.id.split('-')[1], 10);
      const byNum = nums.includes(idNum); const hits = qt.filter(t => ctoks.has(t) && t.length > 2).length;
      if (byNum || hits > 0) out.push({ soId: so.id, customerCode: so.customerCode, customerName: cust?.name || null, status: so.status, matchedBy: byNum ? 'ORDER_NUMBER' : 'CUSTOMER_NAME', score: byNum ? 1 : Math.round((hits / Math.max(1, qt.length)) * 100) / 100 });
    }
    out.sort((a, b) => b.score - a.score || (a.soId < b.soId ? -1 : 1));
    return { query: q, matches: out, needsConfirmation: out.length !== 1 };
  }

  // ═══ v1.2 — سحب التشغيلة (Recall) — بفصل صلاحيات ورقم إشعار الهيئة ═════
  _isRecalled(itemCode, batch) { const r = batch ? this.recalls.get(`${itemCode}|${batch}`) : null; return !!r && (r.status === 'ACTIVE' || r.status === 'DISPOSED'); }
  _recallAudit(type, actor, r) { this._audit(type, actor, 'Recall', r.id, null, JSON.parse(JSON.stringify(r)), r.id); }
  _recallEntry(r, type, locationKey, qty, status) {
    return this._post(type, { itemCode: r.itemCode, warehouseCode: r.warehouseCode, locationKey, batch: r.batch, expiryDate: this._batchExp.get(`${r.itemCode}|${r.batch}`) ?? null, qty, uom: this.items.get(r.itemCode).baseUOM, uomFactorSnapshot: 1, unitCostQirsh: null, valueQirsh: null, stockStatus: status, sourceType: 'Recall', sourceId: r.id, correlationId: r.id, refNo: r.refNo });
  }
  _recallGuard({ refNo, reason, actor, approver }) {
    if (!refNo || !String(refNo).trim()) throw new DomainError('REF_REQUIRED', 'رقم إشعار هيئة الدواء/الشركة إلزامي لأي إجراء Recall');
    if (!reason || !String(reason).trim()) throw new DomainError('REASON_REQUIRED', 'السبب إلزامي');
    if (!actor || !approver || actor === approver) throw new DomainError('SEGREGATION_OF_DUTIES', 'اللي بينفّذ الـRecall لازم يكون غير اللي بيعتمده — فصل الصلاحيات إجباري');
  }
  recallBatch({ itemCode, batch, warehouseCode, refNo, reason, actor, approver }) {
    if (!this.items.has(itemCode)) throw new DomainError('UNKNOWN_ITEM', `صنف غير معروف: ${itemCode}`);
    if (!batch) throw new DomainError('PHARMA_BATCH_REQUIRED', 'رقم التشغيلة مطلوب');
    if (!this.warehouses.has(warehouseCode)) throw new DomainError('UNKNOWN_WH', `مخزن غير معروف: ${warehouseCode}`);
    this._recallGuard({ refNo, reason, actor, approver });
    const key = `${itemCode}|${batch}`;
    if (this.recalls.has(key) && this.recalls.get(key).status !== 'RELEASED') throw new DomainError('ALREADY_RECALLED', `التشغيلة ${batch} عليها Recall بالفعل`);
    if (!this._batchExp.has(key)) throw new DomainError('UNKNOWN_BATCH', `التشغيلة ${batch} للصنف ${itemCode} مش موجودة في الدفتر`);
    const moves = [];
    for (const [k, q] of this._bal) { const [it, wh, loc, b, st] = k.split('|'); if (it === itemCode && wh === warehouseCode && b === batch && st === 'AVAILABLE' && q > 0) moves.push({ fromLoc: loc || null, qty: q }); }
    const r = { id: this._id('RCL'), itemCode, batch, warehouseCode, refNo, reason, status: 'ACTIVE', createdBy: actor, approvedBy: approver, createdAt: this._iso(), heldQty: 0, moved: [] };
    for (const m of moves) {
      const quarLoc = this._quarantineLoc(warehouseCode) || m.fromLoc;
      this._recallEntry(r, 'RECALL_HOLD', m.fromLoc, -m.qty, 'AVAILABLE'); this._recallEntry(r, 'RECALL_HOLD', quarLoc, m.qty, 'QUARANTINE');
      r.moved.push({ fromLoc: m.fromLoc, quarLoc, qty: m.qty, remaining: m.qty }); r.heldQty += m.qty;
    }
    this.recalls.set(key, r); this._recallAudit('RECALL_HELD', actor, r);
    return { recall: JSON.parse(JSON.stringify(r)), impact: this.recallImpact(itemCode, batch) };
  }
  // الأوردرات اللي لسه ماخرجتش وفيها التشغيلة دي — لازم إجراء بشري (إعادة تخصيص / رجوع الصندوق للحجر)
  recallImpact(itemCode, batch) {
    const open = [];
    for (const so of this.sos.values()) {
      if (!['ALLOCATED', 'PICKING', 'PACKED'].includes(so.status)) continue;
      const hit = so.allocations.filter(a => a.itemCode === itemCode && a.batch === batch); if (!hit.length) continue;
      const pickedQty = hit.filter(a => a.picked).reduce((s, a) => s + a.qty, 0);
      open.push({ soId: so.id, customerCode: so.customerCode, status: so.status, allocatedQty: hit.reduce((s, a) => s + a.qty, 0), pickedQty, toteCode: so.toteCode || null, actionRequired: pickedQty > 0 ? 'ارجاع العلب المسحوبة للحجر الصحي وإعادة التخصيص' : 'إعادة التخصيص بتشغيلة سليمة' });
    }
    return { itemCode, batch, openOrders: open };
  }
  _recallOf(itemCode, batch) { const r = this.recalls.get(`${itemCode}|${batch}`); if (!r) throw new DomainError('NO_RECALL', `مفيش Recall على التشغيلة ${batch}`); return r; }
  disposeRecalled({ itemCode, batch, disposition, refNo, reason, actor, approver }) {
    this._recallGuard({ refNo, reason, actor, approver });
    if (!['RTV', 'DESTROY'].includes(disposition)) throw new DomainError('BAD_DISPOSITION', 'التصرف لازم RTV أو DESTROY');
    const r = this._recallOf(itemCode, batch); if (r.status !== 'ACTIVE') throw new DomainError('INVALID_TRANSITION', `التصرف في الـRecall ممكن وهو ACTIVE بس (الحالة: ${r.status})`);
    let disposed = 0;
    for (const m of r.moved) { const take = Math.min(m.remaining, this._bucket(itemCode, r.warehouseCode, m.quarLoc, batch, 'QUARANTINE')); if (take <= 0) continue; this._recallEntry(r, 'RECALL_DISPOSAL', m.quarLoc, -take, 'QUARANTINE'); m.remaining -= take; disposed += take; }
    if (disposed === 0) throw new DomainError('NO_QUARANTINE', 'مفيش رصيد حجر صحي مرتبط بالـRecall ده');
    r.status = 'DISPOSED'; r.disposition = disposition; r.disposedQty = disposed; r.disposeRef = refNo;
    this._recallAudit('RECALL_DISPOSED', actor, r); return { disposed, disposition };
  }
  releaseRecall({ itemCode, batch, refNo, reason, actor, approver }) {
    this._recallGuard({ refNo, reason, actor, approver });
    const r = this._recallOf(itemCode, batch); if (r.status !== 'ACTIVE') throw new DomainError('INVALID_TRANSITION', `رفع الـRecall ممكن وهو ACTIVE بس (الحالة: ${r.status})`);
    let back = 0;
    for (const m of r.moved) { const take = Math.min(m.remaining, this._bucket(itemCode, r.warehouseCode, m.quarLoc, batch, 'QUARANTINE')); if (take <= 0) continue; this._recallEntry(r, 'RECALL_RELEASE', m.quarLoc, -take, 'QUARANTINE'); this._recallEntry(r, 'RECALL_RELEASE', m.fromLoc, take, 'AVAILABLE'); m.remaining -= take; back += take; }
    r.status = 'RELEASED'; r.releasedQty = back; r.releaseRef = refNo; r.releaseReason = reason;
    this._recallAudit('RECALL_RELEASED', actor, r); return { released: back };
  }

  // ═══ v1.2 — تقرير التتبع (أمامي: التشغيلة راحت لمين • خلفي: الأوردر خد تشغيلات إيه) ═══
  traceBatch(itemCode, batch) {
    if (!this.items.has(itemCode)) throw new DomainError('UNKNOWN_ITEM', `صنف غير معروف: ${itemCode}`);
    const recv = new Map(), ship = new Map(); let other = 0;
    for (const e of this.ledger) {
      if (e.itemCode !== itemCode || e.batch !== batch) continue;
      if (e.sourceType === 'GoodsReceipt') { const r = recv.get(e.sourceId) || { receiptId: e.sourceId, poId: e.correlationId, supplierCode: this.pos.get(e.correlationId)?.supplierCode ?? null, firstPostedAt: e.timestamp, qty: 0 }; r.qty += e.qty; recv.set(e.sourceId, r); }
      else if (e.type === 'STOCK_ISSUE') { const so = this.sos.get(e.sourceId); const x = ship.get(e.sourceId) || { soId: e.sourceId, customerCode: so?.customerCode ?? null, customerName: this.customers.get(so?.customerCode)?.name ?? null, dispatchedAt: e.timestamp, qty: 0 }; x.qty += -e.qty; ship.set(e.sourceId, x); }
      else other++;
    }
    const onHand = [];
    for (const [k, q] of this._bal) { const [it, wh, loc, b, st] = k.split('|'); if (it === itemCode && b === batch && q !== 0) onHand.push({ warehouseCode: wh, locationKey: loc || null, status: st, qty: q }); }
    const received = [...recv.values()].reduce((s, x) => s + x.qty, 0), shipped = [...ship.values()].reduce((s, x) => s + x.qty, 0);
    const v = this.verifyLedgerIntegrity();
    return { itemCode, batch, expiryDate: this._batchExp.get(`${itemCode}|${batch}`) ?? null, generatedAt: this._iso(),
      recall: this.recalls.get(`${itemCode}|${batch}`) ? { id: this.recalls.get(`${itemCode}|${batch}`).id, status: this.recalls.get(`${itemCode}|${batch}`).status, refNo: this.recalls.get(`${itemCode}|${batch}`).refNo } : null,
      receipts: [...recv.values()], shipments: [...ship.values()], onHand, totals: { receivedBaseUnits: received, shippedBaseUnits: shipped, onHandBaseUnits: onHand.reduce((s, x) => s + x.qty, 0), otherMovements: other },
      integrity: { ledgerOk: v.ok, head: v.ok ? v.head : null },
      limitations: ['التتبع لحد خروج الأوردر من المخزن (DISPATCHED) — مفيش تتبع لحد المريض/الصيدلية الفرعية.', 'مرتجعات العملاء مش متمذجة في v1.2.', 'مفيش تتبع سيريال فردي (GS1 serial) — تتبع على مستوى التشغيلة.'] };
  }
  traceOrder(soId) {
    const so = this.sos.get(soId); if (!so) throw new DomainError('NOT_FOUND', `SO غير موجود: ${soId}`);
    const lines = new Map();
    for (const e of this.ledger) if (e.type === 'STOCK_ISSUE' && e.sourceId === soId) { const k = `${e.itemCode}|${e.batch}`; const x = lines.get(k) || { itemCode: e.itemCode, batch: e.batch, expiryDate: e.expiryDate, qty: 0, recalled: this._isRecalled(e.itemCode, e.batch) }; x.qty += -e.qty; lines.set(k, x); }
    return { soId, customerCode: so.customerCode, status: so.status, toteCode: so.toteCode || null, shippedBatches: [...lines.values()] };
  }

  // ── Derived reads ──────────────────────────────────────────────────────
  getBalance(itemCode, warehouseCode) { let q = 0; for (const e of this.ledger) if (e.itemCode === itemCode && e.stockStatus === 'AVAILABLE' && (!warehouseCode || e.warehouseCode === warehouseCode)) q += e.qty; return q; }
  getQuarantineBalance(itemCode, warehouseCode) { let q = 0; for (const e of this.ledger) if (e.itemCode === itemCode && e.stockStatus === 'QUARANTINE' && (!warehouseCode || e.warehouseCode === warehouseCode)) q += e.qty; return q; }
  _balancesOf(entries, warehouseCode) {
    const out = {};
    for (const e of entries) { if (warehouseCode && e.warehouseCode !== warehouseCode) continue; const k = `${e.itemCode}@${e.locationKey || e.warehouseCode}${e.batch ? '#' + e.batch : ''}[${e.stockStatus}]`; out[k] = (out[k] || 0) + e.qty; }
    return out;
  }
  getBalances(warehouseCode) { return this._balancesOf(this.ledger, warehouseCode); }
  getExpiringStock(withinDays = 90, warehouseCode = null) {
    const out = []; const limit = new Date(new Date(this.today + 'T00:00:00Z').getTime() + withinDays * 86400000).toISOString().slice(0, 10); const seen = {};
    for (const e of this.ledger) {
      if (!e.expiryDate || (warehouseCode && e.warehouseCode !== warehouseCode)) continue;
      const k = `${e.itemCode}|${e.batch}|${e.locationKey}|${e.stockStatus}`;
      if (!seen[k]) seen[k] = { itemCode: e.itemCode, batch: e.batch, expiryDate: e.expiryDate, locationKey: e.locationKey, warehouseCode: e.warehouseCode, stockStatus: e.stockStatus, qty: 0 };
      seen[k].qty += e.qty;
    }
    for (const b of Object.values(seen)) { if (b.qty <= 0) continue; if (b.expiryDate <= limit) out.push({ ...b, expired: b.expiryDate < this.today, daysLeft: Math.round((new Date(b.expiryDate) - new Date(this.today)) / 86400000) }); }
    return out.sort((a, b) => (a.expiryDate < b.expiryDate ? -1 : 1));
  }

  // ── النزاهة ────────────────────────────────────────────────────────────
  _verifyChain(list) {
    let prev = 'GENESIS';
    for (const e of list) {
      if (e.prevHash !== prev) return { ok: false, at: e.id, reason: 'PREV_HASH_MISMATCH' };
      const { prevHash, hash, ...payload } = e;
      let h; try { h = sha256(prev + canonical(payload)); } catch { return { ok: false, at: e.id, reason: 'NON_CANONICAL' }; }
      if (h !== hash) return { ok: false, at: e.id, reason: 'HASH_MISMATCH' };
      prev = hash;
    }
    return { ok: true, entries: list.length, head: prev };
  }
  verifyLedgerIntegrity() { return this._verifyChain(this.ledger); }
  verifyAuditIntegrity() { return this._verifyChain(this.audit); }
  stateHash(entries = this.ledger) { return sha256(canonical({ balances: this._balancesOf(entries), head: entries.length ? entries[entries.length - 1].hash : 'GENESIS', n: entries.length })); }
  // ختم نزاهة: لازم يتخزّن/يتطبع برّه الجهاز (بدونه، حد يعيد حساب السلسلة كلها ومحدش يعرف)
  createSeal() {
    const v = this.verifyLedgerIntegrity(); if (!v.ok) throw new DomainError('LEDGER_TAMPERED', `مينفعش نختم دفتر مكسور (عند ${v.at})`);
    return { version: 1, sealedAt: this._iso(), date: this.today, entries: this.ledger.length, head: this._lastHash, merkleRoot: merkleRoot(this.ledger.map(e => e.hash)), stateHash: this.stateHash() };
  }
  verifySeal(seal) {
    const n = seal.entries; if (this.ledger.length < n) return { ok: false, reason: 'LEDGER_SHORTER_THAN_SEAL' };
    const prefix = this.ledger.slice(0, n); const head = n ? prefix[n - 1].hash : 'GENESIS';
    if (head !== seal.head) return { ok: false, reason: 'HEAD_MISMATCH' };
    if (merkleRoot(prefix.map(e => e.hash)) !== seal.merkleRoot) return { ok: false, reason: 'MERKLE_MISMATCH' };
    if (this.stateHash(prefix) !== seal.stateHash) return { ok: false, reason: 'STATE_MISMATCH' };
    return { ok: true, entries: n };
  }

  // ── Persistence (الساعة مش بتتصدّر، والاستيراد بيرفض الدفتر المكسور) ──
  toJSON() {
    return { v: 12, items: [...this.items.values()], suppliers: [...this.suppliers.values()], customers: [...this.customers.values()], warehouses: [...this.warehouses.values()], locations: [...this.locations.values()], uoms: [...this.uoms.values()], uomConversions: this.uomConversions, pos: [...this.pos.values()], receipts: [...this.receipts.values()], sos: [...this.sos.values()], exceptions: this.exceptions, ledger: this.ledger, audit: this.audit, counters: this.counters, lastHash: this._lastHash, auditHash: this._auditHash };
  }
  static fromJSON(d, opts = {}) {
    if (d.v !== 11 && d.v !== 12) throw new DomainError('BAD_VERSION', `نسخة ملف غير مدعومة (${d.v}) — v1.2 بتقرا v:11 و v:12 بس (الدفاتر القديمة FNV مش بتتحوّل)`);
    const c = new OmNiCore(opts);
    for (const x of d.items) c.items.set(x.code, x); for (const x of d.suppliers) c.suppliers.set(x.code, x);
    for (const x of (d.customers || [])) c.customers.set(x.code, x);
    for (const x of d.warehouses) c.warehouses.set(x.code, x); for (const x of d.locations) c.locations.set(x.key, x);
    for (const x of d.uoms) c.uoms.set(x.code, x); c.uomConversions = d.uomConversions || [];
    for (const x of d.pos) c.pos.set(x.id, x); for (const x of d.receipts) c.receipts.set(x.id, x);
    for (const x of (d.sos || [])) c.sos.set(x.id, x);
    c.exceptions = d.exceptions || []; c.ledger = (d.ledger || []).map(e => Object.freeze({ ...e })); c.audit = (d.audit || []).map(e => Object.freeze({ ...e }));
    c.counters = { PO: 0, GR: 0, SO: 0, SLE: 0, EVT: 0, EXC: 0, TRF: 0, ADJ: 0, RCL: 0, ...d.counters };
    c._lastHash = d.lastHash || 'GENESIS'; c._auditHash = d.auditHash || 'GENESIS';
    if (opts.verify !== false) {
      const l = c.verifyLedgerIntegrity(); if (!l.ok) throw new DomainError('LEDGER_TAMPERED', `الدفتر المستورد مكسور عند ${l.at} (${l.reason})`);
      const a = c.verifyAuditIntegrity(); if (!a.ok) throw new DomainError('AUDIT_TAMPERED', `سجل التدقيق المستورد مكسور عند ${a.at} (${a.reason})`);
      if (l.head !== c._lastHash) throw new DomainError('LEDGER_TRUNCATED', 'رأس السلسلة المحفوظ ≠ آخر قيد — الدفتر اتقصّ');
      if (a.head !== c._auditHash) throw new DomainError('AUDIT_TRUNCATED', 'رأس سلسلة التدقيق المحفوظ ≠ آخر حدث — سجل التدقيق اتقصّ');
    }
    // سجل الـRecall مشتق من سجل التدقيق المشفّر (مش حقل مخزّن) — حذفه/تعديله بيكسر السلسلة
    for (const e of c.audit) if (e.eventType.startsWith('RECALL_') && e.afterState && e.afterState.itemCode) c.recalls.set(`${e.afterState.itemCode}|${e.afterState.batch}`, clone(e.afterState));
    for (const e of c.ledger) { // الفهارس مشتقة من الدفتر نفسه (مش مخزّنة، فمينفعش تتزوّر)
      const k = c._bkey(e.itemCode, e.warehouseCode, e.locationKey, e.batch, e.stockStatus); c._bal.set(k, (c._bal.get(k) || 0) + e.qty);
      if (e.batch && e.expiryDate && (e.type === 'STOCK_RECEIPT' || e.type === 'STOCK_QUARANTINE')) c._batchExp.set(`${e.itemCode}|${e.batch}`, e.expiryDate);
    }
    return c;
  }
}

// بيانات تجريبية واقعية: مخزن توزيع أدوية — 6 أكتوبر (GTIN تجريبي)
export function seedDemo(core) {
  core.addUOM('EA', 'قطعة'); core.addUOM('BOX', 'علبة'); core.addUOM('STRIP', 'شريط'); core.addUOM('CARTON', 'كرتونة');
  core.addUOMConversion({ fromUOM: 'CARTON', toUOM: 'BOX', factor: 24 });
  core.addUOMConversion({ fromUOM: 'BOX', toUOM: 'STRIP', factor: 10 });
  core.addItem({ code: 'AMOX-500', name: 'أموكسيسيلين 500مجم كبسول', category: 'PHARMA', baseUOM: 'BOX', lasaGroup: 'AMOX', gtin: '06221000000011', aliases: ['اموكس', 'amoxicillin'] });
  core.addItem({ code: 'AMOX-1000', name: 'أموكسيسيلين 1000مجم أقراص', category: 'PHARMA', baseUOM: 'BOX', lasaGroup: 'AMOX', gtin: '06221000000028', aliases: ['اموكس', 'amoxicillin'] });
  core.addItem({ code: 'PARA-500', name: 'باراسيتامول 500مجم أقراص', category: 'PHARMA', baseUOM: 'BOX', gtin: '06221000000035', aliases: ['paracetamol'] });
  core.addItem({ code: 'INS-GLAR', name: 'إنسولين جلارجين 100وحدة/مل', category: 'PHARMA', baseUOM: 'EA', gtin: '06221000000042' });
  core.addItem({ code: 'SURG-MASK', name: 'كمامة جراحية (50 قطعة)', category: 'GENERAL', baseUOM: 'BOX' });
  core.addItem({ code: 'AUGM-625', name: 'أوجمنتين 625مجم أقراص', category: 'PHARMA', baseUOM: 'BOX', lasaGroup: 'AUGM', gtin: '06221000000059', aliases: ['augmentin'] });
  core.addItem({ code: 'AUGM-1000', name: 'أوجمنتين 1000مجم أقراص', category: 'PHARMA', baseUOM: 'BOX', lasaGroup: 'AUGM', gtin: '06221000000066', aliases: ['augmentin'] });
  core.addSupplier({ code: 'SUP-001', name: 'الشركة المتحدة لتوريد الأدوية' });
  core.addSupplier({ code: 'SUP-002', name: 'مورد المستلزمات الطبية' });
  core.addCustomer({ code: 'CUST-001', name: 'صيدلية الشفاء — 6 أكتوبر' });
  core.addCustomer({ code: 'CUST-002', name: 'صيدلية النصر — الشيخ زايد' });
  core.addWarehouse({ code: 'WH-OCT6', name: 'مخزن 6 أكتوبر الرئيسي' });
  // تخطيط تجريبي: pickSeq = ترتيب المشي من سير الجودة (لفّة واحدة). التخطيط الحقيقي لازم يتتبّع الموقع الفعلي.
  core.addLocation({ warehouseCode: 'WH-OCT6', code: 'A-01-01', zone: 'A', aisle: 1, bay: 1, level: 2, pickSeq: 10 });
  core.addLocation({ warehouseCode: 'WH-OCT6', code: 'A-01-02', zone: 'A', aisle: 1, bay: 2, level: 2, pickSeq: 11 });
  core.addLocation({ warehouseCode: 'WH-OCT6', code: 'A-01-03', zone: 'A', aisle: 1, bay: 3, level: 1, pickSeq: 12 });
  core.addLocation({ warehouseCode: 'WH-OCT6', code: 'B-02-01', zone: 'B', aisle: 2, bay: 1, level: 8, pickSeq: 20 });
  core.addLocation({ warehouseCode: 'WH-OCT6', code: 'B-02-02', zone: 'B', aisle: 2, bay: 2, level: 2, pickSeq: 21 });
  core.addLocation({ warehouseCode: 'WH-OCT6', code: 'B-03-01', zone: 'B', aisle: 3, bay: 1, level: 2, pickSeq: 30 });
  core.addLocation({ warehouseCode: 'WH-OCT6', code: 'COLD-01', zone: 'COLD', aisle: 9, bay: 1, level: 1, pickSeq: 90 });
  core.addLocation({ warehouseCode: 'WH-OCT6', code: 'QUAR-01', zone: 'QUARANTINE' });
  return core;
}


// ═══ v1.3 — تخطيط أرفف التحضير الفعلي + جلسة التوجيه الصوتي (عيد تاني / أنا عند رف كذا / مخرج السير) ═══
// cfg.racks = [{ no, cols:['G','K',...], aisle }] · cfg.walkOrder = أرقام الرفوف بترتيب المشي · cfg.beltAccessRacks = رفوف عندها وصول للسير
export function buildPickLayout(core, cfg) {
  const { warehouseCode, zone = 'PICK', levels = 8, racks = [], walkOrder = null, beltAccessRacks = [] } = cfg || {};
  const bad = (m) => { throw new DomainError('INVALID_LAYOUT', m); };
  if (!warehouseCode) bad('warehouseCode مطلوب');
  if (!isInt(levels) || levels < 1 || levels > 8) bad('عدد المستويات 1–8');
  if (!racks.length) bad('لازم رف واحد على الأقل');
  const nos = racks.map(r => r.no);
  if (new Set(nos).size !== nos.length) bad('أرقام رفوف مكررة');
  const order = walkOrder || nos.slice().sort((a, b) => a - b);
  if (order.length !== nos.length || order.some(n => !nos.includes(n)) || new Set(order).size !== order.length) bad('walkOrder لازم يحتوي كل رف مرة واحدة بالظبط');
  for (const n of beltAccessRacks) if (!nos.includes(n)) bad(`رف السير ${n} مش في الرفوف`);
  for (const r of racks) { if (!isInt(r.no) || r.no < 0) bad(`رقم رف غلط: ${r.no}`); if (!Array.isArray(r.cols) || !r.cols.length || new Set(r.cols).size !== r.cols.length) bad(`أعمدة الرف ${r.no} غلط أو مكررة`); }
  let n = 0;
  for (const r of racks) {
    const wi = order.indexOf(r.no);
    r.cols.forEach((col, ci) => { for (let lv = 1; lv <= levels; lv++) { core.addLocation({ warehouseCode, code: `R${r.no}-${col}-${lv}`, zone, aisle: r.aisle ?? null, bay: ci + 1, level: lv, pickSeq: wi * 100 + ci * 10, rack: r.no, col, beltAccess: beltAccessRacks.includes(r.no) }); n++; } });
  }
  return { locations: n };
}
// تخطيط v1.6 نموذج هندسي مبني على الوصف الميداني الحالي؛ القياس الميداني الفعلي يظل شرطًا لاعتماد المسافات بالأمتار.
export const DEMO_PICK_LAYOUT = (() => {
  // v1.4 — من وصف أحمد: صف 15–25 قصاد صف 26–36 (15 قصاد 36، 25 قصاد 26). المدخل = ناحية 15/36 (الصناديق وبداية السير عند 15، ومكتب الجودة عند 15/36).
  // العمق = البعد عن المدخل: رف n في 15–25 عمقه n-15، ورف n في 26–36 عمقه 36-n. المشي من المدخل لآخر الممر (25/26) بترتيب العمق.
  // ⚠ حروف الأعمدة (G,K,L,H,N للصف الأول وP,Q,R,S,T للتاني) لسه افتراض لحد ما تتأكد.
  const A = ['G', 'K', 'L', 'H', 'N'], B = ['P', 'Q', 'R', 'S', 'T'], racks = [];
  for (let no = 15; no <= 25; no++) racks.push({ no, cols: A, aisle: no - 14 });
  for (let no = 26; no <= 36; no++) racks.push({ no, cols: B, aisle: 37 - no });
  const depth = (no) => (no <= 25 ? no - 15 : 36 - no);
  const walkOrder = racks.map(r => r.no).sort((a, b) => depth(a) - depth(b) || a - b);
  // السير: بيبدأ برا رف 15 (المدخل)، يلف حوالين آخر الممر (25/26) ويرجع برا 26→36 لمكتب الجودة. نقاط الوصول من جوه الممر: المدخل (15) وآخر الممر (25/26).
  return { assumed: true, warehouseCode: 'WH-OCT6', zone: 'PICK', levels: 8, racks, walkOrder, beltAccessRacks: [15, 25, 26, 36] };
})();

const REPEAT_PHRASES = ['عيد', 'عيد تاني', 'عيد تانيه', 'اعد', 'كرر', 'قول تاني', 'قول تانيه', 'مش سامع', 'فين'];
// أرقام صوتية محدودة ومتعمدة للعمليات الشائعة في المخزن. لو الصياغة مش مؤكدة، لا نخمن.
const AR_NUM = new Map(Object.entries({
  'صفر':0,'واحد':1,'واحدة':1,'اتنين':2,'اثنين':2,'تنين':2,'ثلاثة':3,'تلاتة':3,'اربعة':4,'أربعة':4,'خمسة':5,'ستة':6,'سبعة':7,'تمانية':8,'ثمانية':8,'تسعة':9,'عشرة':10,
  'حداشر':11,'أحداشر':11,'اتناشر':12,'اثناشر':12,'تلتاشر':13,'ثلتاشر':13,'اربعتاشر':14,'أربعتاشر':14,'خمستاشر':15,'ستاشر':16,'سبعتاشر':17,'تمنتاشر':18,'تمنتاشر':18,'تسعتاشر':19,'عشرين':20,
  'واحد وعشرين':21,'اتنين وعشرين':22,'اثنين وعشرين':22,'تلاتة وعشرين':23,'ثلاثة وعشرين':23,'اربعة وعشرين':24,'أربعة وعشرين':24,'خمسة وعشرين':25,'ستة وعشرين':26,'سبعة وعشرين':27,'تمانية وعشرين':28,'ثمانية وعشرين':28,'تسعة وعشرين':29,'تلاتين':30,'ثلاثين':30,'اربعين':40,'أربعين':40,'خمسين':50,'ستين':60,'سبعين':70,'تمانين':80,'ثمانين':80,'تسعين':90,'مية':100,'مئة':100,'مائه':100}).map(([k,v]) => [normText(k), v]));
const voiceNumber = (text) => {
  const q = normText(text); if (/^[0-9]+$/.test(q)) return Number(q);
  const exact = AR_NUM.get(q); if (exact !== undefined) return exact;
  const parts = q.split(' '); if (parts.length === 2) {
    const a = AR_NUM.get(parts[0]), b = AR_NUM.get(parts[1]);
    if (a !== undefined && b !== undefined && b === 10) return a * 10;
  }
  return null;
};
// نية واحدة من كلام قصير فقط (≤6 كلمات) عشان كلام عادي في الممر ما يشغّلش حاجة بالغلط. النية توجيه بس — مفيش حاجة بتتقفل بالصوت.
export function intentOf(text) {
  const q = normText(text); if (!q) return { intent: null };
  const toks = q.split(' '); if (toks.length > 6) return { intent: null };
  if (REPEAT_PHRASES.some(p => q === normText(p))) return { intent: 'REPEAT' };
  const m = q.match(/(?:^| )(?:انا )?(?:عند|في|جنب) (?:رف )?(.+)$/);
  if (m) { const rack = voiceNumber(m[1]); if (Number.isSafeInteger(rack)) return { intent: 'POSITION', rack }; }
  return { intent: null };
}
export function resolveScanCode(core, rawCode) {
  const q = String(rawCode ?? '').trim();
  if (!q) return { type: 'SCAN_EMPTY', say: 'امسح أو اكتب كود الصنف.' };
  const exact = [...core.items.values()].filter(i => i.code === q || i.gtin === q);
  if (exact.length === 1) return { type: 'SCAN_MATCH', item: exact[0], say: `تم التعرف على ${exact[0].name}. أكمل بالمسح الكامل للصنف والتشغيلة.` };
  if (exact.length > 1) return { type: 'SCAN_AMBIGUOUS', candidates: exact, say: 'الكود غير حاسم. استخدم باركود الصنف الصحيح.' };
  return { type: 'SCAN_UNKNOWN', say: 'الكود غير موجود في الكتالوج. لا يتم اعتماد الصرف بالصوت.' };
}
export function operationalSnapshot(core, soId) {
  const so = core.sos.get(soId); if (!so) throw new DomainError('NOT_FOUND', `SO غير موجود: ${soId}`);
  const picked = so.allocations.filter(a => a.picked).length, total = so.allocations.length;
  const route = ['ALLOCATED','PICKING'].includes(so.status) ? core.planPickRoute(so.id) : null;
  const next = route?.stops?.[0] || null;
  const blockers = [];
  if (!so.toteCode) blockers.push({ code: 'TOTE_REQUIRED', say: 'اربط الصندوق قبل بدء السحب.' });
  if (['ALLOCATED','PICKING'].includes(so.status) && so.lines.some(l => l.shortage > 0) && !so.shortageAck) blockers.push({ code: 'SHORTAGE_UNACKNOWLEDGED', say: 'الأوردر ناقص عن المطلوب. لازم إقرار بالصرف الجزئي وسببه قبل التغليف.' });
  if (so.status === 'ALLOCATED' && picked > 0) blockers.push({ code: 'STATE_SYNC', say: 'الأوردر بدأ سحبًا فعليًا؛ استخدم جلسة التوجيه الحالية.' });
  if (!next && ['ALLOCATED','PICKING'].includes(so.status)) blockers.push({ code: 'NO_REMAINING_PICK', say: 'لا توجد نقاط سحب متبقية.' });
  return { soId, status: so.status, toteCode: so.toteCode || null, picked, total, remaining: Math.max(0,total-picked), next: next ? { step: next.step, rack: next.rack, col: next.col, level: next.level, locationKey: next.locationKey, say: next.say } : null, finish: route?.finish || null, blockers };
}
// ═══ v1.6 — جسر الصوت ↔ النواة ═══
const ORDER_WORDS = ['اوردر', 'أوردر', 'طلب', 'طلبية', 'أمر بيع', 'امر بيع', 'sales order'];
const hasOrderCue = (text) => ORDER_WORDS.some(w => normText(text).includes(normText(w)));

export function resolveVoiceQuery(core, text, { statuses = ['ALLOCATED', 'PICKING'] } = {}) {
  const query = String(text ?? '').trim();
  const intent = intentOf(query);
  if (intent.intent === 'REPEAT') return { type: 'REPEAT_INTENT' };
  if (intent.intent === 'POSITION') return { type: 'POSITION_INTENT', rack: intent.rack };
  if (hasOrderCue(query)) {
    const r = core.findOrders(query, statuses);
    if (!r.matches.length) return { type: 'ORDER_NOT_FOUND', query: r.query, say: 'مفيش أوردر مطابق للطلب ده' };
    if (r.needsConfirmation) return { type: 'ORDER_CONFIRM', query: r.query, matches: r.matches, say: `لقيت ${r.matches.length} أوردر محتاج اختيار واضح` };
    const m = r.matches[0];
    return { type: 'ORDER_MATCH', query: r.query, match: m, say: `الأوردر ${m.soId} جاهز للتوجيه. الصوت لا يبدأ السحب لوحده.` };
  }
  const r = core.searchCatalog(query);
  if (!r.candidates.length) return { type: 'CATALOG_NOT_FOUND', query: r.query, say: 'مفيش تطابق مؤكد للاسم ده' };
  if (r.needsConfirmation) return { type: 'CATALOG_CONFIRM', query: r.query, candidates: r.candidates, lasaSiblings: r.lasaSiblings, say: `مش متأكد. اختار بالمسح: ${r.candidates.map(x => x.name).join('، ')}` };
  const c = r.candidates[0];
  const batches = core.getAvailableBatches(c.code, 'WH-OCT6');
  const b = batches[0] || null;
  const loc = b?.locationKey || null;
  const m = loc && /\/R(\d+)-([A-Za-z0-9]+)-(\d+)$/.exec(loc);
  const where = m ? `رف ${m[1]}، عمود ${m[2]}، المستوى ${m[3]}` : (loc ? `الموقع ${loc.split('/').pop()}` : '');
  return { type: 'CATALOG_MATCH', query: r.query, item: c, batch: b, say: b ? `${c.name}، ${where}، تشغيلة ${b.batch}، متاح ${b.qty}` : `${c.name}، مفيش رصيد متاح` };
}

export class GuidanceSession {
  constructor(core, soId, { order = 'ASC', warehouseCode = null, fromRack = null } = {}) {
    this.core = core; this.soId = soId; this.order = order; this.warehouseCode = warehouseCode || core.sos.get(soId)?.warehouseCode || null;
    this.fromSeq = fromRack === null ? null : core.seqOfRack(fromRack, this.warehouseCode); this.lastSaid = null;
  }
  current() {
    const r = this.core.planPickRoute(this.soId, { fromSeq: this.fromSeq, order: this.order });
    return r.stops.length ? { type: 'PICK', stop: r.stops[0], remainingStops: r.stops.length, say: r.stops[0].say } : { type: 'FINISH', finish: r.finish, remainingStops: 0, say: r.finish.say };
  }
  speak() { const c = this.current(); this.lastSaid = c.say; return c; }
  repeat() { return this.lastSaid ? { type: 'REPEAT', say: this.lastSaid } : this.speak(); }
  setPosition(rack) { this.fromSeq = this.core.seqOfRack(rack, this.warehouseCode); return this.speak(); }
  // بعد ما العامل يقفل السحب بالمسح (confirmPick): الموقع الحالي = آخر موقع اتسحب منه، والتوجيه التالي يبدأ منه
  afterPick(locationKey) { const L = this.core.locations.get(locationKey); if (L && isInt(L.pickSeq)) this.fromSeq = L.pickSeq; return this.speak(); }
  hear(text) {
    const it = intentOf(text);
    if (it.intent === 'REPEAT') return this.repeat();
    if (it.intent === 'POSITION') { try { return this.setPosition(it.rack); } catch (e) { if (e instanceof DomainError) return { type: 'ERROR', code: e.code, say: `رف ${it.rack} مش موجود عندي، قول رقم رف تاني` }; throw e; } }
    return null;
  }
}
