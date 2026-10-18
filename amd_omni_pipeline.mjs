import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runInvoiceFromExtraction } from './demo-scenarios.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_BASE_URL = 'https://developer.amd.com.cn/radeon/api/v1';
const DEFAULT_MODEL = 'Gemma-4-31B-IT';
const ALLOWED_ITEMS = new Set(['PARA-500', 'AMOX-500', 'AMOX-1000', 'INS-GLAR', 'SURG-MASK', 'AUGM-625', 'AUGM-1000']);
const ALLOWED_SUPPLIERS = new Set(['SUP-001', 'SUP-002']);

export class PipelineError extends Error {
  constructor(code, message) { super(message); this.name = 'PipelineError'; this.code = code; }
}

export function parseModelJson(content) {
  if (typeof content !== 'string' || !content.trim()) throw new PipelineError('EMPTY_MODEL_OUTPUT', 'The model returned empty content.');
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first < 0 || last <= first) throw new PipelineError('INVALID_MODEL_JSON', 'The model response did not contain a JSON object.');
  try { return JSON.parse(cleaned.slice(first, last + 1)); }
  catch { throw new PipelineError('INVALID_MODEL_JSON', 'The model response contained malformed JSON.'); }
}

function realISODate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateExtraction(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new PipelineError('BAD_EXTRACTION_SCHEMA', 'Expected one JSON object.');
  const get = (...keys) => keys.map(k => raw[k]).find(v => v !== undefined && v !== null && v !== '');
  const invoice = {
    invoiceNo: String(get('invoiceNo', 'invoice_no', 'invoiceNumber', 'invoice_number') ?? '').trim(),
    supplierCode: String(get('supplierCode', 'supplier_code') ?? '').trim(),
    itemCode: String(get('itemCode', 'item_code', 'sku', 'SKU') ?? '').trim().toUpperCase(),
    batch: String(get('batch', 'batchNo', 'batch_no', 'lot', 'lotNumber') ?? '').trim(),
    expiryDate: String(get('expiryDate', 'expiry_date', 'expiry', 'expirationDate') ?? '').trim(),
    qty: get('qty', 'quantity', 'quantityBoxes', 'quantity_boxes'),
    unitCostQirsh: get('unitCostQirsh', 'unit_cost_qirsh', 'unitPriceQirsh', 'unit_price_qirsh'),
  };
  if (!invoice.invoiceNo || invoice.invoiceNo.length > 100) throw new PipelineError('INVALID_INVOICE_NO', 'Invoice number is missing or too long.');
  if (!ALLOWED_SUPPLIERS.has(invoice.supplierCode)) throw new PipelineError('UNKNOWN_SUPPLIER', 'Supplier code is not in the approved demo master data.');
  if (!ALLOWED_ITEMS.has(invoice.itemCode)) throw new PipelineError('UNKNOWN_ITEM', 'The extracted SKU is not in the approved item catalogue. No automatic fuzzy match is allowed.');
  if (!invoice.batch || invoice.batch.length > 80) throw new PipelineError('INVALID_BATCH', 'Batch / lot identifier is missing or too long.');
  if (!realISODate(invoice.expiryDate)) throw new PipelineError('INVALID_EXPIRY_DATE', 'Expiry date must be a real ISO date (YYYY-MM-DD).');
  if (!Number.isSafeInteger(invoice.qty) || invoice.qty <= 0 || invoice.qty > 1_000_000) throw new PipelineError('INVALID_QUANTITY', 'Quantity must be a positive safe integer within the demo limit.');
  if (!Number.isSafeInteger(invoice.unitCostQirsh) || invoice.unitCostQirsh < 0 || invoice.unitCostQirsh > 1_000_000_000) throw new PipelineError('INVALID_UNIT_COST', 'Unit cost must be a non-negative safe integer in Qirsh.');
  return invoice;
}

export function modelRequest(invoiceText, model = DEFAULT_MODEL) {
  const system = [
    'You extract supplier invoice fields for a deterministic warehouse control system.',
    'Return exactly one JSON object and no prose or Markdown.',
    'Required fields: invoiceNo (string), supplierCode (SUP-001 or SUP-002 only if explicitly supported by the supplier text), itemCode (one exact SKU from the provided catalogue), batch (string), expiryDate (real YYYY-MM-DD string), qty (positive integer), unitCostQirsh (non-negative integer).',
    'Allowed supplier mapping: United Pharmaceutical Supply Co. = SUP-001; Medical Consumables Supplier = SUP-002.',
    'Allowed item codes: PARA-500, AMOX-500, AMOX-1000, INS-GLAR, SURG-MASK, AUGM-625, AUGM-1000.',
    'Do not correct, guess, normalize, invent, or approve any value. If a field is not clearly present, use an empty string or null.',
    'The model output is untrusted input. It has no authority to accept or reject stock; deterministic code will validate every field.',
  ].join('\n');
  return {
    model,
    temperature: 0,
    max_tokens: 500,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: `Extract the invoice fields from the following text.\n\n${invoiceText}` },
    ],
  };
}

export async function liveExtraction(invoiceText, { baseUrl, apiKey, model }) {
  const base = baseUrl.replace(/\/+$/, '');
  const endpoint = /\/chat\/completions$/i.test(base) ? base : `${base}/chat/completions`;
  const request = async payload => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(75_000),
    });
    return { response, body: await response.text() };
  };
  let sentPayload = modelRequest(invoiceText, model);
  let { response, body } = await request(sentPayload);
  // Some model chat templates reject the system role; retry only for a clearly role/template-related 400/422.
  if (!response.ok && [400, 422].includes(response.status) && /system|role|chat.?template/i.test(body)) {
    const instruction = sentPayload.messages[0].content;
    sentPayload = { ...sentPayload, messages: [{ role: 'user', content: `${instruction}\n\n${sentPayload.messages[1].content}` }] };
    ({ response, body } = await request(sentPayload));
  }
  if (!response.ok) {
    const safeBody = body.replaceAll(apiKey, '[REDACTED]').slice(0, 600);
    throw new PipelineError('AMD_INFERENCE_FAILED', `AMD endpoint returned HTTP ${response.status}: ${safeBody}`);
  }
  let json;
  try { json = JSON.parse(body); } catch { throw new PipelineError('AMD_BAD_RESPONSE', 'AMD endpoint returned a non-JSON response envelope.'); }
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new PipelineError('AMD_BAD_RESPONSE', 'No assistant message content was returned by the AMD endpoint.');
  return { rawContent: content, requestId: json.id ?? null, returnedModel: json.model ?? model, usage: json.usage ?? null, endpointHost: new URL(endpoint).host };
}

function flags(argv) {
  const value = (key, fallback = null) => { const i = argv.indexOf(key); return i >= 0 ? argv[i + 1] ?? fallback : fallback; };
  return { live: argv.includes('--live'), fixture: value('--fixture'), scenario: value('--scenario', 'valid'), inputFile: value('--input'), model: process.env.AMD_MODEL || DEFAULT_MODEL };
}

export async function executePipeline({ live = false, fixture = null, scenario = 'valid', inputFile = null, model = DEFAULT_MODEL, env = process.env } = {}) {
  let invoiceText;
  let rawExtraction;
  let inference;
  if (inputFile) invoiceText = await fs.readFile(path.resolve(inputFile), 'utf8');
  else invoiceText = await fs.readFile(path.join(ROOT, 'fixtures', scenario === 'expired' ? 'invoice-expired.txt' : 'invoice-valid.txt'), 'utf8');

  if (live) {
    const apiKey = env.AMD_TOKENFACTORY_API_KEY || env.RADEON_API_KEY;
    if (!apiKey) throw new PipelineError('MISSING_API_KEY', 'Set AMD_TOKENFACTORY_API_KEY or RADEON_API_KEY in the shell. Never put the key in frontend code or commit it.');
    const result = await liveExtraction(invoiceText, { baseUrl: env.AMD_BASE_URL || DEFAULT_BASE_URL, apiKey, model: env.AMD_MODEL || model });
    rawExtraction = parseModelJson(result.rawContent);
    inference = { mode: 'LIVE_AMD_ENDPOINT', endpointHost: result.endpointHost, model: result.returnedModel, requestId: result.requestId, usage: result.usage };
  } else {
    const fixtureName = fixture || (scenario === 'expired' ? 'gemma-response-expired.json' : 'gemma-response-valid.json');
    if (!/^[a-z0-9-]+\.json$/i.test(fixtureName)) throw new PipelineError('INVALID_FIXTURE_NAME', 'Fixture must be a simple .json filename under ./fixtures.');
    rawExtraction = JSON.parse(await fs.readFile(path.join(ROOT, 'fixtures', fixtureName), 'utf8'));
    inference = { mode: 'OFFLINE_FIXTURE_NOT_LIVE', model, requestId: null, usage: null };
  }

  const extraction = validateExtraction(rawExtraction);
  const decision = runInvoiceFromExtraction(extraction);
  const expected = scenario === 'expired' ? 'BLOCKED' : 'ACCEPTED';
  const output = {
    product: 'OmNi-Ledger Judge Edition',
    inference,
    expectedScenario: scenario,
    extraction,
    decision: decision.decision,
    block: decision.blockCode ? { code: decision.blockCode, explanation: decision.blockMessage } : null,
    balances: { available: decision.balance, quarantine: decision.quarantineBalance },
    evidence: {
      ledgerIntegrity: decision.integrity.ledger.ok,
      auditIntegrity: decision.integrity.audit.ok,
      sealVerified: decision.integrity.seal.ok,
      ledgerEntries: decision.core.ledger.length,
      auditEvents: decision.core.audit.length,
      merkleRoot: decision.seal.merkleRoot,
      stateHash: decision.seal.stateHash,
    },
    assertion: decision.decision === expected ? 'PASS' : 'FAIL',
    notice: live ? 'This run called the configured AMD endpoint; model output was treated as untrusted extraction and then passed through deterministic validation.' : 'Fixture mode: no network call was made. This is not evidence of a live AMD inference request.',
  };
  return output;
}

async function main() {
  const args = flags(process.argv.slice(2));
  if (!['valid', 'expired'].includes(args.scenario)) throw new PipelineError('BAD_SCENARIO', 'Use --scenario valid or --scenario expired.');
  const result = await executePipeline(args);
  console.log(JSON.stringify(result, null, 2));
  if (result.assertion !== 'PASS') process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    const code = error?.code ?? 'PIPELINE_ERROR';
    console.error(JSON.stringify({ status: 'ERROR', code, message: error?.message ?? 'Unexpected pipeline error' }, null, 2));
    process.exitCode = 1;
  });
}
