// Optional live benchmark: runs a fixed set of fictional invoices through the AMD endpoint
// and the deterministic gate, then reports extraction accuracy and safety outcomes.
// Usage:  AMD_TOKENFACTORY_API_KEY=... node scripts/amd-benchmark.mjs        (live)
//         node scripts/amd-benchmark.mjs --mock                              (no network; logic self-test)
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { liveExtraction, parseModelJson, validateExtraction, PipelineError } from '../amd_omni_pipeline.mjs';
import { runInvoiceFromExtraction } from '../demo-scenarios.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = process.env.AMD_BASE_URL || 'https://developer.amd.com.cn/radeon/api/v1';
const MODEL = process.env.AMD_MODEL || 'Gemma-4-31B-IT';
const MOCK = process.argv.includes('--mock');
const SUP = { 'SUP-001': 'United Pharmaceutical Supply Co.', 'SUP-002': 'Medical Consumables Supplier' };
const NAMES = { 'PARA-500': 'Paracetamol 500 mg tablets', 'AMOX-500': 'Amoxicillin 500 mg capsules', 'INS-GLAR': 'Insulin glargine pens', 'SURG-MASK': 'Surgical masks', 'AUGM-625': 'Amoxicillin/clavulanate 625 mg' };

function render(c) {
  const supplier = c.supplierName ?? SUP[c.f.supplierCode];
  const L = [
    'SUPPLIER INVOICE — DEMONSTRATION DATA ONLY',
    `Invoice number: ${c.f.invoiceNo}`,
    `Supplier: ${supplier}`,
    'Warehouse destination: WH-OCT6',
    `SKU: ${c.f.itemCode} — ${NAMES[c.f.itemCode] ?? 'Unlisted product'}`,
  ];
  if (c.f.batch) L.push(`${c.labels?.batch ?? 'Batch / Lot'}: ${c.f.batch}`);
  L.push(`${c.labels?.expiry ?? 'Expiry date'}: ${c.expiryText ?? c.f.expiryDate}`);
  L.push(`${c.labels?.qty ?? 'Quantity'}: ${c.qtyText ?? c.f.qty} boxes`);
  L.push(`Unit cost (Qirsh): ${c.f.unitCostQirsh}`);
  L.push('', 'Extract only the fields requested by the system. Do not infer missing values.');
  return L.join('\n');
}

const f = (invoiceNo, supplierCode, itemCode, batch, expiryDate, qty, unitCostQirsh) => ({ invoiceNo, supplierCode, itemCode, batch, expiryDate, qty, unitCostQirsh });
const CASES = [
  { id: 'valid-1', expected: 'ACCEPT', f: f('BM-INV-1001', 'SUP-001', 'PARA-500', 'B-2028-A1', '2028-03-31', 120, 1250) },
  { id: 'valid-2', expected: 'ACCEPT', f: f('BM-INV-1002', 'SUP-001', 'AMOX-500', 'LOT-77-XY', '2028-11-30', 400, 2100), labels: { batch: 'Lot no.', expiry: 'Exp. date', qty: 'Qty' } },
  { id: 'valid-3', expected: 'ACCEPT', f: f('BM-INV-1003', 'SUP-001', 'AMOX-500', 'AMX-2027-09', '2027-09-15', 60, 2100) },
  { id: 'valid-4', expected: 'ACCEPT', f: f('BM-INV-1004', 'SUP-001', 'INS-GLAR', 'INS-55-K', '2027-06-30', 25, 9800), labels: { expiry: 'Expiry' } },
  { id: 'valid-5', expected: 'ACCEPT', f: f('BM-INV-1005', 'SUP-001', 'AUGM-625', 'AUG-9001', '2029-01-31', 300, 1750) },
  { id: 'expired-1', expected: 'BLOCK', f: f('BM-INV-2001', 'SUP-001', 'PARA-500', 'B-OLD-01', '2024-01-01', 50, 1250) },
  { id: 'expired-2', expected: 'BLOCK', f: f('BM-INV-2002', 'SUP-001', 'AMOX-500', 'AMX-OLD-7', '2025-12-31', 80, 2100) },
  { id: 'expired-3', expected: 'BLOCK', f: f('BM-INV-2003', 'SUP-001', 'AUGM-625', 'LOT-EXP-3', '2026-10-16', 200, 1750) },
  { id: 'unknown-sku', expected: 'REJECT', f: f('BM-INV-3001', 'SUP-001', 'PARA-5000', 'B-2028-Z', '2028-05-31', 100, 1250) },
  { id: 'unknown-supplier', expected: 'REJECT', f: { ...f('BM-INV-3002', '', 'PARA-500', 'B-2028-Q', '2028-05-31', 100, 1250) }, supplierName: 'Nile Generic Pharma Ltd.' },
  { id: 'missing-batch', expected: 'REJECT', f: f('BM-INV-3003', 'SUP-001', 'AMOX-500', '', '2028-05-31', 100, 2100) },
  { id: 'zero-quantity', expected: 'REJECT', f: f('BM-INV-3004', 'SUP-001', 'PARA-500', 'B-2028-W', '2028-05-31', 0, 1250) },
  { id: 'impossible-date', expected: 'REJECT', f: f('BM-INV-3005', 'SUP-001', 'PARA-500', 'B-2028-V', '2027-02-30', 100, 1250) },
];

const FIELDS = ['invoiceNo', 'supplierCode', 'itemCode', 'batch', 'expiryDate', 'qty', 'unitCostQirsh'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = (k, v) => (v == null ? '' : ['qty', 'unitCostQirsh'].includes(k) ? Number(v) : String(v).trim().toUpperCase());

async function extractLive(text) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try { return await liveExtraction(text, { baseUrl: BASE_URL, apiKey: process.env.AMD_TOKENFACTORY_API_KEY || process.env.RADEON_API_KEY, model: MODEL }); }
    catch (e) {
      if (/HTTP 429/.test(e?.message ?? '') && attempt < 3) { await sleep(8000 * (attempt + 1)); continue; }
      throw e;
    }
  }
}

function classify(outcome) {
  if (outcome.kind === 'ACCEPTED') return 'ACCEPT';
  if (outcome.kind === 'BLOCKED') return 'BLOCK';
  return 'REJECT';
}

async function runCase(c) {
  const text = render(c);
  const row = { id: c.id, expected: c.expected, requestId: null, extraction: null, fieldMatches: null, outcome: null };
  let raw;
  try {
    if (MOCK) raw = { ...c.f };
    else {
      const r = await extractLive(text);
      row.requestId = r.requestId; row.model = r.returnedModel; row.endpointHost = r.endpointHost;
      raw = parseModelJson(r.rawContent);
    }
  } catch (e) {
    row.outcome = { kind: 'PIPELINE_ERROR', code: e?.code ?? 'ERROR', message: String(e?.message ?? e).slice(0, 200) };
    row.result = 'REJECT'; row.safe = c.expected !== 'ACCEPT' || true; row.correct = c.expected === 'REJECT' || c.expected === 'BLOCK' ? true : false;
    return row;
  }
  row.extraction = raw;
  row.fieldMatches = Object.fromEntries(FIELDS.map(k => [k, norm(k, raw?.[k] ?? raw?.[k.replace(/[A-Z]/g, m => '_' + m.toLowerCase())]) === norm(k, c.f[k])]));
  try {
    const validated = validateExtraction(raw);
    const d = runInvoiceFromExtraction(validated);
    row.outcome = d.decision === 'ACCEPTED' ? { kind: 'ACCEPTED' } : { kind: 'BLOCKED', code: d.blockCode };
  } catch (e) {
    row.outcome = { kind: 'SCHEMA_REJECTED', code: e instanceof PipelineError ? e.code : 'ERROR' };
  }
  row.result = classify(row.outcome);
  return row;
}

const rows = [];
for (const c of CASES) {
  const row = await runCase(c);
  row.unsafeAccept = row.result === 'ACCEPT' && c.expected !== 'ACCEPT';
  row.asExpected = row.result === c.expected;
  // expired/invalid invoices: any non-accept is safe; only ACCEPT-expected is a usefulness test
  rows.push(row);
  console.log(`${row.asExpected ? 'OK  ' : 'DIFF'} ${c.id.padEnd(16)} expected=${c.expected.padEnd(6)} got=${row.result}${row.outcome?.code ? ' (' + row.outcome.code + ')' : ''}`);
  if (!MOCK) await sleep(2500);
}

const withFields = rows.filter(r => r.fieldMatches);
const perField = Object.fromEntries(FIELDS.map(k => [k, `${withFields.filter(r => r.fieldMatches[k]).length}/${withFields.length}`]));
const allFieldsExact = withFields.filter(r => FIELDS.every(k => r.fieldMatches[k])).length;
const summary = {
  mode: MOCK ? 'MOCK_SELF_TEST_NOT_LIVE' : 'LIVE_AMD_ENDPOINT',
  model: rows.find(r => r.model)?.model ?? (MOCK ? null : MODEL),
  endpointHost: rows.find(r => r.endpointHost)?.endpointHost ?? null,
  invoices: rows.length,
  decisionsAsExpected: `${rows.filter(r => r.asExpected).length}/${rows.length}`,
  unsafeAccepts: rows.filter(r => r.unsafeAccept).length,
  validInvoicesAccepted: `${rows.filter(r => r.expected === 'ACCEPT' && r.result === 'ACCEPT').length}/${rows.filter(r => r.expected === 'ACCEPT').length}`,
  expiredInvoicesBlocked: `${rows.filter(r => r.id.startsWith('expired') && r.outcome?.code === 'EXPIRED_GOODS').length}/${rows.filter(r => r.id.startsWith('expired')).length}`,
  invalidInvoicesRejected: `${rows.filter(r => r.expected === 'REJECT' && r.result === 'REJECT').length}/${rows.filter(r => r.expected === 'REJECT').length}`,
  invoicesWithAllSevenFieldsExact: `${allFieldsExact}/${withFields.length}`,
  perFieldExactMatch: perField,
};
console.log('\nSUMMARY'); console.log(JSON.stringify(summary, null, 2));

const dir = path.join(ROOT, 'evidence', 'live-amd-benchmark');
await fs.mkdir(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const name = `${MOCK ? 'mock' : 'live'}-${stamp}`;
await fs.writeFile(path.join(dir, `${name}.json`), JSON.stringify({ generatedAt: new Date().toISOString(), note: 'Fictional invoices only. Model output is untrusted; the deterministic gate decides. No API key is stored.', summary, rows }, null, 2) + '\n');
console.log(`\nWrote evidence/live-amd-benchmark/${name}.json`);
if (summary.unsafeAccepts > 0) process.exitCode = 2;
