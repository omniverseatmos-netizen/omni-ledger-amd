import { InstitutionalLedger, defaultChartOfAccounts } from './institutional.mjs';
import { reconcileAndApprove, closePeriodControlled, createAuditPackage, validateAuditPackage } from './institutional_assurance.mjs';
const a=new InstitutionalLedger({companyId:'OMNI-DEMO',tenantId:'OMNI'}); defaultChartOfAccounts(a); a.openPeriod('2026-10','admin');
const r=a.postJournal({date:'2026-10-01',description:'استلام مخزون مؤسسي',sourceType:'GoodsReceipt',sourceId:'GR-DEMO-1',actor:'receiver',externalRef:'WMS-GR:GR-DEMO-1',lines:[{accountCode:'1100',debit:125000,memo:'Inventory'},{accountCode:'2200',credit:125000,memo:'GRNI'}]});
a.approveJournal(r.journal.id,'controller');
const rec=reconcileAndApprove(a,{date:'2026-10-01',actor:'warehouse-count',checker:'controller',source:'INVENTORY_COUNT',expected:100,actual:100,unit:'QTY',reference:'COUNT-DEMO-1'});
const close=closePeriodControlled(a,'2026-10',{maker:'finance-maker',checker:'controller'});
const pkg=createAuditPackage(a,{from:'2026-10-01',to:'2026-10-31'});
console.log(JSON.stringify({journal:a.journals.at(-1),reconciliation:rec,close,summary:a.controlSummary(),trialBalance:a.trialBalance(),auditPackage:{schema:pkg.schema,version:pkg.version,hash:pkg.packageHash,valid:validateAuditPackage(pkg).ok}},null,2));
