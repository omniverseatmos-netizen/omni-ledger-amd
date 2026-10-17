// OmNi Institutional Assurance — v1.8
// Controlled extensions: period-close gates, batch-cost resolution, replay/invariants,
// reconciliation approval, deterministic audit package and safe dispatch bridge.
import { DomainError, sha256, canonical } from './domain.mjs';
import { InstitutionalLedger } from './institutional.mjs';

const INT = Number.isSafeInteger;
const clone = x => x == null ? null : JSON.parse(JSON.stringify(x));
const assertActor = actor => { if(!actor || typeof actor!=='string') throw new DomainError('ACTOR_REQUIRED','هوية المنفذ مطلوبة'); };
const assertDate = d => { if(typeof d!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new DomainError('INVALID_DATE',`التاريخ غير صحيح: ${d}`); };
const periodOf = d => { assertDate(d); return d.slice(0,7); };
const safeAdd=(a,b,label='القيمة')=>{if(!INT(a)||!INT(b))throw new DomainError('NON_INTEGER',`${label}: قيمة غير صحيحة`);const x=a+b;if(!INT(x))throw new DomainError('INTEGER_OVERFLOW',`${label}: تجاوز النطاق الآمن`);return x;};
const safeMul=(a,b,label='القيمة')=>{if(!INT(a)||!INT(b))throw new DomainError('NON_INTEGER',`${label}: قيمة غير صحيحة`);const x=a*b;if(!INT(x))throw new DomainError('INTEGER_OVERFLOW',`${label}: تجاوز النطاق الآمن`);return x;};

export function resolveBatchCost(wms,{itemCode,batch}={}) {
  if(!wms || !itemCode || !batch) throw new DomainError('COST_INPUT_REQUIRED','itemCode وbatch مطلوبان لتحديد التكلفة');
  const rows=[];
  for(const e of wms.ledger||[]) {
    if(e.type!=='STOCK_RECEIPT' || e.itemCode!==itemCode || e.batch!==batch) continue;
    if(!INT(e.unitCostQirsh)||e.unitCostQirsh<0) throw new DomainError('COST_UNRESOLVED',`استلام غير مكتمل التكلفة للـBatch ${itemCode}/${batch}`);
    if(!INT(e.qty)||e.qty<=0) throw new DomainError('COST_EVIDENCE_INVALID',`كمية استلام غير صالحة للـBatch ${itemCode}/${batch}`);
    rows.push({unitCostQirsh:e.unitCostQirsh,sourceId:e.sourceId,timestamp:e.timestamp,qty:e.qty});
  }
  if(!rows.length) throw new DomainError('COST_UNRESOLVED',`لا توجد تكلفة موثقة للـBatch ${itemCode}/${batch}`);
  const costs=[...new Set(rows.map(x=>x.unitCostQirsh))];
  if(costs.length!==1) throw new DomainError('COST_AMBIGUOUS',`أكثر من تكلفة موثقة للـBatch ${itemCode}/${batch}`);
  return {policy:'BATCH_ACTUAL_COST',itemCode,batch,unitCostQirsh:costs[0],evidence:rows};
}

export function resolveDispatchCost(wms,soId) {
  const so=wms.sos.get(soId); if(!so) throw new DomainError('NOT_FOUND',`SO غير موجود: ${soId}`);
  if(so.status!=='DISPATCHED') throw new DomainError('WMS_NOT_DISPATCHED','الأوردر لازم يكون DISPATCHED');
  const lines=[]; let total=0;
  for(const e of wms.ledger||[]) {
    if(e.type!=='STOCK_ISSUE'||e.sourceId!==soId) continue;
    const c=resolveBatchCost(wms,{itemCode:e.itemCode,batch:e.batch});
    const qty=-e.qty; if(!INT(qty)||qty<=0) throw new DomainError('INVALID_ISSUE_QTY','كمية الصرف غير صالحة');
    const value=safeMul(qty,c.unitCostQirsh,'Dispatch valuation'); total=safeAdd(total,value,'Dispatch valuation total');
    lines.push({itemCode:e.itemCode,batch:e.batch,qty,unitCostQirsh:c.unitCostQirsh,valueQirsh:value,evidence:c.evidence.map(x=>x.sourceId)});
  }
  if(!lines.length) throw new DomainError('NO_ISSUE_LINES','لا توجد حركات صرف قابلة للتقييم');
  return {policy:'BATCH_ACTUAL_COST',soId,totalQirsh:total,lines};
}

export function bridgeDispatchToAccountingV18(wms,acct,soId,{actor,date,inventoryAccount='1100',cogsAccount='5100'}={}) {
  assertActor(actor); assertDate(date);
  const valuation=resolveDispatchCost(wms,soId);
  return acct.postJournal({date,description:`WMS Dispatch ${soId} — Batch Actual Cost`,sourceType:'SalesOrder',sourceId:soId,actor,externalRef:`WMS-SO:${soId}:COGS:BATCH_ACTUAL`,lines:[{accountCode:cogsAccount,debit:valuation.totalQirsh,memo:'COGS / batch actual cost'},{accountCode:inventoryAccount,credit:valuation.totalQirsh,memo:'Inventory issued'}]});
}

export function reconcileAndApprove(ledger,{id,date,actor,checker,source,expected,actual,unit='QTY',reference=null}={}) {
  assertActor(actor); assertActor(checker); if(actor===checker) throw new DomainError('SEGREGATION_OF_DUTIES','Maker وChecker مختلفان مطلوبان');
  const rec=ledger.reconcile({id,date,actor,source,expected,actual,unit,reference});
  if(rec.status==='VARIANCE') throw new DomainError('RECONCILIATION_VARIANCE',`لا يمكن اعتماد مطابقة فيها فرق: ${rec.variance}`);
  const row=ledger.reconciliations.find(x=>x.id===rec.id);
  const next={...row,status:'APPROVED',approvedBy:checker,approvedAt:new Date().toISOString()};
  const idx=ledger.reconciliations.findIndex(x=>x.id===rec.id); ledger.reconciliations[idx]=Object.freeze(next);
  ledger._audit('RECONCILIATION_APPROVED',checker,'Reconciliation',rec.id,row,next);
  return clone(next);
}

export function periodCloseGate(ledger,period,{checker,requireReconciliations=true}={}) {
  assertActor(checker);
  const p=ledger.periods.get(period); if(!p) throw new DomainError('PERIOD_NOT_OPEN','الفترة غير موجودة');
  if(p.status!=='OPEN') throw new DomainError('PERIOD_CLOSED',`الفترة ليست مفتوحة: ${period}`);
  const pending=ledger.journals.filter(j=>j.period===period&&j.status!=='POSTED');
  const recs=ledger.reconciliations.filter(r=>r.date.startsWith(period));
  const [yy,mm]=period.split('-').map(Number); const lastDay=new Date(Date.UTC(yy,mm,0)).getUTCDate();
  const periodEnd=`${period}-${String(lastDay).padStart(2,'0')}`;
  const unresolved=recs.filter(r=>r.status!=='APPROVED');
  const balance=ledger.trialBalance({from:`${period}-01`,to:periodEnd});
  const debit=balance.reduce((s,x)=>safeAdd(s,x.debit,'Trial Balance debit'),0), credit=balance.reduce((s,x)=>safeAdd(s,x.credit,'Trial Balance credit'),0);
  const checks={pendingJournals:pending.length,unresolvedReconciliations:unresolved.length,approvedReconciliations:recs.filter(r=>r.status==='APPROVED').length,trialBalanceBalanced:debit===credit,hasReconciliations:recs.length>0};
  if(pending.length) throw new DomainError('CLOSE_BLOCKED_PENDING_JOURNALS',`يوجد ${pending.length} قيد غير مرحّل`);
  if(unresolved.length) throw new DomainError('CLOSE_BLOCKED_RECONCILIATIONS',`يوجد ${unresolved.length} مطابقة غير محسومة`);
  if(requireReconciliations && recs.filter(r=>r.status==='APPROVED').length===0) throw new DomainError('CLOSE_BLOCKED_NO_APPROVED_RECONCILIATION','الإقفال يحتاج على الأقل مطابقة معتمدة واحدة');
  if(debit!==credit) throw new DomainError('CLOSE_BLOCKED_TRIAL_BALANCE','Trial Balance غير متوازن');
  return {period,eligible:true,checks,totals:{debit,credit}};
}

export function closePeriodControlled(ledger,period,{maker,checker,requireReconciliations=true}={}) {
  assertActor(maker); assertActor(checker); if(maker===checker) throw new DomainError('SEGREGATION_OF_DUTIES','Maker وChecker مختلفان مطلوبان');
  const gate=periodCloseGate(ledger,period,{checker,requireReconciliations});
  const result=ledger.closePeriod(period,maker,checker);
  ledger._audit('PERIOD_CLOSE_CONTROL_PASSED',checker,'Period',period,{eligible:false},{eligible:true,checks:gate.checks});
  return {period:result,gate};
}

export function computeAccountBalances(ledger,{postedOnly=true}={}) {
  const out={};
  for(const j of ledger.journals){ if(postedOnly&&j.status!=='POSTED') continue; for(const l of j.lines){ const x=out[l.accountCode]||{accountCode:l.accountCode,debit:0,credit:0,net:0}; x.debit+=l.debit; x.credit+=l.credit; x.net=x.debit-x.credit; out[l.accountCode]=x; } }
  return Object.values(out).sort((a,b)=>a.accountCode.localeCompare(b.accountCode));
}

export function verifyInvariants(ledger) {
  const errors=[];
  const ids=new Set();
  for(const j of ledger.journals){
    if(ids.has(j.id)) errors.push(`DUPLICATE_JOURNAL:${j.id}`); ids.add(j.id);
    if(j.totalDebit!==j.totalCredit) errors.push(`UNBALANCED:${j.id}`);
    const d=j.lines.reduce((s,l)=>s+l.debit,0), c=j.lines.reduce((s,l)=>s+l.credit,0);
    if(d!==j.totalDebit||c!==j.totalCredit) errors.push(`TOTAL_MISMATCH:${j.id}`);
    if(j.status==='POSTED'&&!ledger.periods.get(j.period)) errors.push(`POSTED_WITHOUT_PERIOD:${j.id}`);
  }
  for(const [k,j] of ledger.idempotency) if(!ledger.journals.some(x=>x.id===j.id)) errors.push(`IDEMPOTENCY_DANGLING:${k}`);
  const audit=ledger.verifyIntegrity(); if(!audit.ok) errors.push(`AUDIT:${audit.reason}:${audit.at}`);
  const tb=ledger.trialBalance(); if(tb.reduce((s,x)=>s+x.debit,0)!==tb.reduce((s,x)=>s+x.credit,0)) errors.push('TRIAL_BALANCE_UNBALANCED');
  return {ok:errors.length===0,errors,checks:{journals:ledger.journals.length,accounts:ledger.accounts.size,auditEntries:ledger.audit.length}};
}

export function createAuditPackage(ledger,{from=null,to=null}={}) {
  const journals=ledger.journals.filter(j=>(!from||j.date>=from)&&(!to||j.date<=to)).map(clone);
  const reconciliations=ledger.reconciliations.filter(r=>(!from||r.date>=from)&&(!to||r.date<=to)).map(clone);
  const pkg={schema:'OmNi.InstitutionalAuditPackage',version:1,companyId:ledger.companyId,tenantId:ledger.tenantId,range:{from,to},generatedAt:new Date().toISOString(),accounts:[...ledger.accounts.values()].map(clone),periods:[...ledger.periods.values()].map(clone),journals,reconciliations,trialBalance:ledger.trialBalance({from,to}),integrity:ledger.verifyIntegrity(),invariants:verifyInvariants(ledger)};
  pkg.packageHash=sha256(canonical(pkg));
  return pkg;
}

export function validateAuditPackage(pkg) {
  if(!pkg||pkg.schema!=='OmNi.InstitutionalAuditPackage'||pkg.version!==1) return {ok:false,reason:'BAD_PACKAGE_SCHEMA'};
  const {packageHash,...body}=pkg; return {ok:sha256(canonical(body))===packageHash,reason:sha256(canonical(body))===packageHash?'OK':'PACKAGE_HASH_MISMATCH'};
}

export function safeAdjustmentFromVariance(wms,acct,{date,actor,checker,itemCode,batch,warehouseCode,locationKey,qtyDelta,reason,reference=null,inventoryAccount='1100',adjustmentAccount='5200'}={}) {
  assertActor(actor); assertActor(checker); if(actor===checker) throw new DomainError('SEGREGATION_OF_DUTIES','Maker وChecker مختلفان مطلوبان');
  if(!INT(qtyDelta)||qtyDelta===0) throw new DomainError('INVALID_ADJUSTMENT_QTY','qtyDelta لازم عدد صحيح غير صفر');
  if(!reason) throw new DomainError('REASON_REQUIRED','سبب التسوية مطلوب');
  const rec=acct.reconcile({date,actor,source:'INVENTORY_ADJUSTMENT',expected:0,actual:qtyDelta,unit:'QTY',reference});
  if(rec.status!=='VARIANCE') throw new DomainError('ADJUSTMENT_NOT_VARIANCE','التسوية تحتاج فرقًا موثقًا');
  const cost=resolveBatchCost(wms,{itemCode,batch});
  const value=safeMul(Math.abs(qtyDelta),cost.unitCostQirsh,'Adjustment valuation');
  const debit=qtyDelta>0?value:0, credit=qtyDelta<0?value:0;
  const debitAdj=qtyDelta<0?value:0, creditAdj=qtyDelta>0?value:0;
  const j=acct.postJournal({date,description:`Inventory adjustment ${itemCode}/${batch}: ${reason}`,sourceType:'InventoryAdjustment',sourceId:rec.id,actor,externalRef:`INV-ADJ:${rec.id}`,lines:[{accountCode:inventoryAccount,debit,credit,memo:'Inventory adjustment'},{accountCode:adjustmentAccount,debit:debitAdj,credit:creditAdj,memo:reason}],autoApprove:false});
  acct.approveJournal(j.journal.id,checker);
  return {reconciliation:rec,journal:acct.journals.find(x=>x.id===j.journal.id),valuation:{policy:cost.policy,unitCostQirsh:cost.unitCostQirsh,valueQirsh:value},quantity:{itemCode,batch,warehouseCode,locationKey,qtyDelta}};
}
