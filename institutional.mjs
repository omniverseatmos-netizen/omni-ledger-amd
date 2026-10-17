// OmNi Institutional Ledger — v1.7 foundation
// Accounting-grade control layer kept separate from the operational WMS ledger.
// Integer money only (qirsh), double-entry journals, period close, maker/checker,
// idempotency, reversals, reconciliation, deterministic audit chain.
import { DomainError, sha256, canonical } from './domain.mjs';

const INT = Number.isSafeInteger;
const clone = x => x == null ? null : JSON.parse(JSON.stringify(x));
const MONTH = /^\d{4}-\d{2}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function deepFreeze(value, seen=new WeakSet()) {
  if (value && typeof value==='object' && !seen.has(value)) {
    seen.add(value); Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v, seen);
  }
  return value;
}
function safeAdd(a,b,label='القيمة') {
  if (!INT(a) || !INT(b)) throw new DomainError('NON_INTEGER', `${label}: قيمة غير صحيحة`);
  const x=a+b; if(!INT(x)) throw new DomainError('INTEGER_OVERFLOW', `${label}: تجاوز النطاق الآمن`); return x;
}
function safeSub(a,b,label='القيمة') { return safeAdd(a,-b,label); }
function safeMul(a,b,label='القيمة') {
  if (!INT(a) || !INT(b)) throw new DomainError('NON_INTEGER', `${label}: قيمة غير صحيحة`);
  const x=a*b; if(!INT(x)) throw new DomainError('INTEGER_OVERFLOW', `${label}: تجاوز النطاق الآمن`); return x;
}
function money(n, label='القيمة') {
  if (!INT(n) || n < 0) throw new DomainError('INVALID_MONEY', `${label}: لازم عدد صحيح ≥ 0 بالقروش`);
  return n;
}
function assertDate(d) {
  if (typeof d !== 'string' || !DATE.test(d)) throw new DomainError('INVALID_DATE', `التاريخ غير صحيح: ${d}`);
  const [y,m,day]=d.split('-').map(Number);
  const dt=new Date(Date.UTC(y,m-1,day));
  if(dt.getUTCFullYear()!==y || dt.getUTCMonth()!==m-1 || dt.getUTCDate()!==day) throw new DomainError('INVALID_DATE', `التاريخ غير موجود تقويميًا: ${d}`);
}
function periodOf(d) { assertDate(d); return d.slice(0,7); }
function assertActor(actor) { if (!actor || typeof actor !== 'string') throw new DomainError('ACTOR_REQUIRED', 'هوية المنفذ مطلوبة'); }

const ACCOUNT_TYPES = new Set(['ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE','CONTROL']);
const NORMAL = { ASSET:'DEBIT', EXPENSE:'DEBIT', LIABILITY:'CREDIT', EQUITY:'CREDIT', REVENUE:'CREDIT', CONTROL:'DEBIT' };

export class InstitutionalLedger {
  constructor(opts={}) {
    this.companyId = opts.companyId || 'C1';
    this.tenantId = opts.tenantId || 'T1';
    this.accounts = new Map();
    this.periods = new Map();
    this.journals = [];
    this.reconciliations = [];
    this.audit = [];
    this.approvals = new Map();
    this.idempotency = new Map();
    this.counters = { JE:0, EVT:0, REC:0, REV:0 };
    this._auditHash = 'GENESIS';
  }
  _id(p) { return `${p}-${String(++this.counters[p]).padStart(6,'0')}`; }
  _audit(eventType, actor, sourceType, sourceId, beforeState, afterState, correlationId=sourceId) {
    const body={id:this._id('EVT'),eventType,timestamp:new Date().toISOString(),actorId:actor||'system',tenantId:this.tenantId,companyId:this.companyId,sourceType,sourceId,correlationId,beforeState:clone(beforeState),afterState:clone(afterState)};
    const hash=sha256(this._auditHash+canonical(body));
    this.audit.push(Object.freeze({...body,prevHash:this._auditHash,hash})); this._auditHash=hash;
  }
  addAccount({code,name,type,normalBalance=undefined,parentCode=null,active=true}) {
    if (!code || this.accounts.has(code)) throw new DomainError('DUPLICATE_ACCOUNT', `حساب موجود: ${code}`);
    if (!ACCOUNT_TYPES.has(type)) throw new DomainError('INVALID_ACCOUNT_TYPE', `نوع حساب غير معروف: ${type}`);
    const nb=normalBalance || NORMAL[type];
    if (nb!=='DEBIT' && nb!=='CREDIT') throw new DomainError('INVALID_NORMAL_BALANCE','الرصيد الطبيعي لازم DEBIT أو CREDIT');
    if (parentCode && !this.accounts.has(parentCode)) throw new DomainError('UNKNOWN_PARENT_ACCOUNT', `الحساب الأب غير موجود: ${parentCode}`);
    const a={code,name,type,normalBalance:nb,parentCode,active:!!active}; this.accounts.set(code,a); this._audit('ACCOUNT_CREATED',null,'Account',code,null,a); return clone(a);
  }
  deactivateAccount(code, actor) {
    const a=this._account(code); assertActor(actor); if (!a.active) return clone(a); a.active=false; this._audit('ACCOUNT_DEACTIVATED',actor,'Account',code,{active:true},{active:false}); return clone(a);
  }
  _account(code) { const a=this.accounts.get(code); if(!a) throw new DomainError('UNKNOWN_ACCOUNT',`حساب غير معروف: ${code}`); return a; }
  openPeriod(period, actor='system') {
    if(!MONTH.test(period)) throw new DomainError('INVALID_PERIOD',`الفترة غير صحيحة: ${period}`);
    const [py,pm]=period.split('-').map(Number); if(pm<1||pm>12) throw new DomainError('INVALID_PERIOD',`الشهر غير صحيح: ${period}`);
    const p=this.periods.get(period); if(p?.status==='OPEN') return clone(p); if(p?.status==='CLOSED') throw new DomainError('PERIOD_CLOSED',`الفترة مقفولة: ${period}`);
    const x={period,status:'OPEN',openedAt:new Date().toISOString(),openedBy:actor,closedAt:null,closedBy:null}; this.periods.set(period,x); this._audit('PERIOD_OPENED',actor,'Period',period,null,x); return clone(x);
  }
  closePeriod(period, actor, checker) {
    const p=this.periods.get(period); if(!p) throw new DomainError('PERIOD_NOT_OPEN','الفترة غير مفتوحة');
    if(p.status!=='OPEN') throw new DomainError('PERIOD_CLOSED',`الفترة ليست مفتوحة: ${period}`);
    assertActor(actor); assertActor(checker); if(actor===checker) throw new DomainError('SEGREGATION_OF_DUTIES','إغلاق الفترة يحتاج Checker مختلف عن Maker');
    const pending=this.journals.filter(j=>j.period===period&&j.status!=='POSTED');
    if(pending.length) throw new DomainError('CLOSE_BLOCKED_PENDING_JOURNALS',`يوجد ${pending.length} قيد غير مرحّل`);
    const recs=this.reconciliations.filter(r=>r.date.startsWith(period));
    const approved=recs.filter(r=>r.status==='APPROVED');
    if(!approved.length) throw new DomainError('CLOSE_BLOCKED_NO_APPROVED_RECONCILIATION','الإقفال يحتاج مطابقة معتمدة واحدة على الأقل');
    if(recs.some(r=>r.status==='VARIANCE'||(r.status!=='APPROVED'&&r.status!=='MATCHED'))) throw new DomainError('CLOSE_BLOCKED_RECONCILIATIONS','يوجد اختلاف أو مطابقة غير معتمدة');
    const balance=this.trialBalance({from:`${period}-01`,to:`${period}-${String(new Date(Date.UTC(Number(period.slice(0,4)),Number(period.slice(5,7)),0)).getUTCDate()).padStart(2,'0')}`});
    const debit=balance.reduce((s,x)=>safeAdd(s,x.debit,'Trial Balance debit'),0);
    const credit=balance.reduce((s,x)=>safeAdd(s,x.credit,'Trial Balance credit'),0);
    if(debit!==credit) throw new DomainError('CLOSE_BLOCKED_TRIAL_BALANCE','Trial Balance غير متوازن');
    const x={...p,status:'CLOSED',closedAt:new Date().toISOString(),closedBy:checker}; this.periods.set(period,x); this._audit('PERIOD_CLOSED',checker,'Period',period,p,x); return clone(x);
  }
  _ensureOpen(date) { const p=periodOf(date); const row=this.periods.get(p); if(!row || row.status!=='OPEN') throw new DomainError('PERIOD_NOT_OPEN',`الفترة ${p} ليست مفتوحة`); return p; }
  postJournal({date,description,sourceType,sourceId,actor,lines,externalRef=null,correlationId=null,autoApprove=false,reversalOf=null}) {
    assertActor(actor); assertDate(date); const period=this._ensureOpen(date);
    if(autoApprove) throw new DomainError('AUTO_APPROVE_DISABLED','الترحيل التلقائي غير مسموح في النواة المؤسسية؛ استخدم Checker مستقل');
    if(!description) throw new DomainError('DESCRIPTION_REQUIRED','وصف القيد مطلوب');
    if(!Array.isArray(lines)||lines.length<2) throw new DomainError('MIN_JOURNAL_LINES','القيد يحتاج بندين على الأقل');
    const fingerprint=canonical({date,description,sourceType:sourceType||null,sourceId:sourceId||null,correlationId:correlationId||sourceId||null,reversalOf:reversalOf||null,lines:(lines||[]).map(l=>({accountCode:l.accountCode,debit:l.debit||0,credit:l.credit||0,memo:l.memo||null,costCenter:l.costCenter||null}))});
    if(externalRef && this.idempotency.has(externalRef)) {
      const existing=this.idempotency.get(externalRef);
      const oldFingerprint=existing.fingerprint || canonical({date:existing.date,description:existing.description,sourceType:existing.sourceType,sourceId:existing.sourceId,correlationId:existing.correlationId||null,reversalOf:existing.reversalOf||null,lines:existing.lines.map(l=>({accountCode:l.accountCode,debit:l.debit,credit:l.credit,memo:l.memo||null,costCenter:l.costCenter||null}))});
      if(oldFingerprint!==fingerprint) throw new DomainError('IDEMPOTENCY_CONFLICT','externalRef مستخدم سابقًا بمحتوى مختلف');
      return {duplicate:true,journal:clone(existing)};
    }
    let debit=0,credit=0;
    const parsed=lines.map((l,i)=>{
      const a=this._account(l.accountCode); if(!a.active) throw new DomainError('ACCOUNT_INACTIVE',`الحساب غير نشط: ${a.code}`);
      const d=money(l.debit||0,`Debit البند ${i+1}`), c=money(l.credit||0,`Credit البند ${i+1}`);
      if((d===0)===(c===0)) throw new DomainError('INVALID_JOURNAL_LINE','كل بند لازم يكون Debit أو Credit فقط');
      debit=safeAdd(debit,d,`Debit البند ${i+1}`); credit=safeAdd(credit,c,`Credit البند ${i+1}`); return {lineNo:i+1,accountCode:a.code,debit:d,credit:c,memo:l.memo||null,costCenter:l.costCenter||null};
    });
    if(debit!==credit) throw new DomainError('UNBALANCED_JOURNAL',`القيد غير متوازن: Debit=${debit}, Credit=${credit}`);
    const id=this._id('JE');
    const j=deepFreeze({id,date,period,description,sourceType:sourceType||null,sourceId:sourceId||null,actorId:actor,correlationId:correlationId||sourceId||id,externalRef,lines:parsed,totalDebit:debit,totalCredit:credit,status:'PENDING_APPROVAL',createdAt:new Date().toISOString(),reversalOf:reversalOf||null,reversedBy:null,fingerprint});
    this.journals.push(j); if(externalRef) this.idempotency.set(externalRef,j);
    this._audit('JOURNAL_CREATED',actor,'Journal',id,null,{status:j.status,totalDebit:debit,totalCredit:credit,sourceType,sourceId},j.correlationId);
    return {duplicate:false,journal:clone(j)};
  }
  approveJournal(journalId, checker) {
    assertActor(checker); const idx=this.journals.findIndex(j=>j.id===journalId); if(idx<0) throw new DomainError('NOT_FOUND',`القيد غير موجود: ${journalId}`);
    const j=this.journals[idx]; if(j.status!=='PENDING_APPROVAL') throw new DomainError('INVALID_APPROVAL_STATE',`القيد حالته ${j.status}`); if(j.actorId===checker) throw new DomainError('SEGREGATION_OF_DUTIES','Maker وChecker لازم يكونوا مختلفين');
    const next=Object.freeze({...j,status:'POSTED',approvedBy:checker,approvedAt:new Date().toISOString()}); this.journals[idx]=next; this.approvals.set(journalId,{maker:j.actorId,checker,approvedAt:next.approvedAt});
    this._audit('JOURNAL_POSTED',checker,'Journal',journalId,{status:j.status},{status:'POSTED',approvedBy:checker},j.correlationId); return clone(next);
  }
  reverseJournal(journalId, {date,actor,checker,reason}) {
    assertActor(actor); assertActor(checker); if(actor===checker) throw new DomainError('SEGREGATION_OF_DUTIES','عكس القيد يحتاج Maker وChecker مختلفين');
    const original=this.journals.find(j=>j.id===journalId); if(!original) throw new DomainError('NOT_FOUND',`القيد غير موجود: ${journalId}`);
    if(original.status!=='POSTED') throw new DomainError('JOURNAL_NOT_POSTED','لا يمكن عكس قيد غير مرحّل');
    if(original.reversedBy) throw new DomainError('ALREADY_REVERSED','القيد اتعكس قبل كده');
    const r=this.postJournal({date,description:`REVERSAL: ${reason||'بدون سبب'}`,sourceType:'REVERSAL',sourceId:journalId,actor,correlationId:journalId,reversalOf:journalId,lines:original.lines.map(l=>({accountCode:l.accountCode,debit:l.credit,credit:l.debit,memo:`عكس ${journalId}`}))});
    const rid=r.journal.id; const idx=this.journals.findIndex(j=>j.id===journalId); this.journals[idx]=Object.freeze({...original,reversedBy:rid});
    this._audit('JOURNAL_REVERSED',actor,'Journal',journalId,{reversedBy:null},{reversedBy:rid,reason:reason||null});
    this.approveJournal(rid,checker);
    return clone(this.journals.find(j=>j.id===rid));
  }
  trialBalance({from=null,to=null}={}) {
    if(from) assertDate(from); if(to) assertDate(to); const out=new Map();
    for(const j of this.journals){ if(j.status!=='POSTED') continue; if(from && j.date<from) continue; if(to && j.date>to) continue; for(const l of j.lines){const x=out.get(l.accountCode)||{accountCode:l.accountCode,debit:0,credit:0};x.debit=safeAdd(x.debit,l.debit,'Trial Balance debit');x.credit=safeAdd(x.credit,l.credit,'Trial Balance credit');out.set(l.accountCode,x);} }
    return [...out.values()].map(x=>({...x,net:x.debit-x.credit})).sort((a,b)=>a.accountCode.localeCompare(b.accountCode));
  }
  reconcile({id=null,date,actor,source,expected,actual,unit='QTY',reference=null}) {
    assertActor(actor); assertDate(date); this._ensureOpen(date); if(!INT(expected)||!INT(actual)) throw new DomainError('INVALID_RECONCILIATION','المقارنة الرقمية لازم أعداد صحيحة');
    const rec=deepFreeze({id:id||this._id('REC'),date,actorId:actor,source,expected,actual,variance:safeSub(actual,expected,'Reconciliation variance'),unit,reference,status:actual===expected?'MATCHED':'VARIANCE',createdAt:new Date().toISOString()});
    this.reconciliations.push(Object.freeze(rec)); this._audit(rec.status==='MATCHED'?'RECONCILIATION_MATCHED':'RECONCILIATION_VARIANCE',actor,'Reconciliation',rec.id,null,rec); return clone(rec);
  }
  verifyIntegrity(){ let prev='GENESIS'; for(const e of this.audit){ if(e.prevHash!==prev)return{ok:false,at:e.id,reason:'PREV_HASH_MISMATCH'}; const {prevHash,hash,...p}=e; if(sha256(prev+canonical(p))!==hash)return{ok:false,at:e.id,reason:'HASH_MISMATCH'}; prev=hash;} return{ok:true,entries:this.audit.length,head:prev}; }
  controlSummary(){ const posted=this.journals.filter(j=>j.status==='POSTED'); const debit=posted.reduce((s,j)=>safeAdd(s,j.totalDebit,'Control total debit'),0), credit=posted.reduce((s,j)=>safeAdd(s,j.totalCredit,'Control total credit'),0); return {journals:this.journals.length,posted:posted.length,pending:this.journals.filter(j=>j.status==='PENDING_APPROVAL').length,balanced:debit===credit,totalDebit:debit,totalCredit:credit,openPeriods:[...this.periods.values()].filter(p=>p.status==='OPEN').map(p=>p.period),closedPeriods:[...this.periods.values()].filter(p=>p.status==='CLOSED').map(p=>p.period),audit:this.verifyIntegrity()}; }
  toJSON(){ return {v:1,companyId:this.companyId,tenantId:this.tenantId,accounts:[...this.accounts.values()],periods:[...this.periods.values()],journals:this.journals,reconciliations:this.reconciliations,audit:this.audit,approvals:[...this.approvals.entries()],idempotency:[...this.idempotency.entries()].map(([k,j])=>[k,j]),counters:this.counters,auditHash:this._auditHash}; }
  static fromJSON(d){
    if(d?.v!==1) throw new DomainError('BAD_VERSION',`Institutional Ledger version غير مدعومة: ${d?.v}`);
    const x=new InstitutionalLedger({companyId:d.companyId,tenantId:d.tenantId});
    for(const a of d.accounts)x.accounts.set(a.code,deepFreeze(clone(a)));
    for(const p of d.periods)x.periods.set(p.period,deepFreeze(clone(p)));
    x.journals=d.journals.map(j=>deepFreeze(clone(j)));
    x.reconciliations=d.reconciliations.map(r=>deepFreeze(clone(r)));
    x.audit=d.audit.map(e=>deepFreeze(clone(e)));
    x.approvals=new Map(d.approvals||[]); x.idempotency=new Map((d.idempotency||[]).map(([k,j])=>[k,deepFreeze(clone(j))]));
    x.counters={...x.counters,...d.counters}; x._auditHash=d.auditHash||'GENESIS';
    for(const j of x.journals) if(j.externalRef && !x.idempotency.has(j.externalRef)) x.idempotency.set(j.externalRef,j);
    const v=x.verifyIntegrity(); if(!v.ok||v.head!==x._auditHash) throw new DomainError('AUDIT_TAMPERED','سجل التدقيق المؤسسي مكسور أو مقصوص'); return x;
  }
}

export function defaultChartOfAccounts(ledger) {
  const accounts=[
    ['1100','Inventory Asset','ASSET'],['1110','Inventory Quarantine','ASSET'],['1200','Accounts Receivable','ASSET'],
    ['2100','Accounts Payable','LIABILITY'],['2200','GRNI / Receipt Clearing','LIABILITY'],
    ['3100','Owner Equity','EQUITY'],['4100','Sales Revenue','REVENUE'],['5100','Cost of Goods Sold','EXPENSE'],
    ['5200','Inventory Adjustments','EXPENSE'],['5300','Inventory Shrinkage / Variance','EXPENSE']
  ];
  for(const [code,name,type] of accounts) if(!ledger.accounts.has(code)) ledger.addAccount({code,name,type});
  return ledger;
}

// Deterministic bridge for a posted WMS receipt: Inventory / GRNI.
export function bridgeReceiptToAccounting(wms, acct, grId, {actor, date, inventoryAccount='1100', clearingAccount='2200'}={}) {
  const gr=wms.receipts.get(grId); if(!gr) throw new DomainError('NOT_FOUND',`GR غير موجود: ${grId}`); if(gr.status!=='POSTED') throw new DomainError('WMS_NOT_POSTED','الاستلام لازم يكون POSTED قبل الربط المحاسبي');
  let total=0; for(const e of wms.ledger) if(e.sourceId===grId && e.type==='STOCK_RECEIPT') total=safeAdd(total,e.valueQirsh||0,'Receipt bridge total');
  if(total<0||!INT(total)) throw new DomainError('INVALID_BRIDGE_VALUE','قيمة الاستلام غير صالحة');
  return acct.postJournal({date,description:`WMS Receipt ${grId}`,sourceType:'GoodsReceipt',sourceId:grId,actor,externalRef:`WMS-GR:${grId}`,lines:[{accountCode:inventoryAccount,debit:total,memo:'Inventory received'},{accountCode:clearingAccount,credit:total,memo:'GRNI'}]});
}

// Deterministic bridge for a WMS dispatched order. Requires a resolvable actual batch cost.
export function bridgeDispatchToAccounting(wms, acct, soId, {actor,date,inventoryAccount='1100',cogsAccount='5100'}={}) {
  const so=wms.sos.get(soId); if(!so) throw new DomainError('NOT_FOUND',`SO غير موجود: ${soId}`); if(so.status!=='DISPATCHED') throw new DomainError('WMS_NOT_DISPATCHED','الأوردر لازم يكون DISPATCHED قبل الربط المحاسبي');
  let total=0;
  for(const e of wms.ledger) if(e.sourceId===soId && e.type==='STOCK_ISSUE'){ const unit=e.unitCostQirsh; if(!INT(unit)||unit<0) throw new DomainError('COST_UNRESOLVED',`تكلفة الصرف غير محددة للبند ${e.itemCode}/${e.batch}`); if(!INT(-e.qty)||-e.qty<=0) throw new DomainError('INVALID_ISSUE_QTY','كمية الصرف غير صالحة'); total=safeAdd(total,safeMul(-e.qty,unit,'Dispatch bridge line'),'Dispatch bridge total'); }
  if(!INT(total)||total<0) throw new DomainError('INVALID_BRIDGE_VALUE','قيمة الصرف غير صالحة');
  return acct.postJournal({date,description:`WMS Dispatch ${soId}`,sourceType:'SalesOrder',sourceId:soId,actor,externalRef:`WMS-SO:${soId}:COGS`,lines:[{accountCode:cogsAccount,debit:total,memo:'COGS'},{accountCode:inventoryAccount,credit:total,memo:'Inventory issued'}]});
}
