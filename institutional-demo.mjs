import { InstitutionalLedger, defaultChartOfAccounts } from './institutional.mjs';
const a = new InstitutionalLedger({companyId:'C1',tenantId:'T1'});
defaultChartOfAccounts(a);
a.openPeriod('2026-10','admin');
const r = a.postJournal({
  date:'2026-10-01', description:'استلام مخزون تجريبي', sourceType:'GoodsReceipt', sourceId:'GR-000001', actor:'receiver', externalRef:'WMS-GR:GR-000001',
  lines:[{accountCode:'1100',debit:125000,memo:'Inventory'},{accountCode:'2200',credit:125000,memo:'GRNI'}]
});
a.approveJournal(r.journal.id,'controller');
console.log(JSON.stringify({journal:a.journals.at(-1),summary:a.controlSummary(),trialBalance:a.trialBalance()},null,2));
