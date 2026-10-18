import test from 'node:test';
import assert from 'node:assert/strict';

const handlers = new Map();
const clickedDownloads = [];
const objectUrls = new Map();
const nativeCreateObjectURL = URL.createObjectURL.bind(URL);
URL.createObjectURL = blob => { const href = nativeCreateObjectURL(blob); objectUrls.set(href, blob); return href; };
const navs = ['overview','intake','recall','trace','evidence','architecture'].map(view => ({
  dataset: { view }, attrs: {}, classList: { toggle() {} },
  setAttribute(k,v) { this.attrs[k]=v; }, removeAttribute(k) { delete this.attrs[k]; },
}));
const root = { innerHTML: '', attrs: {}, setAttribute(k,v) { this.attrs[k]=v; }, focus() {} };
const breadcrumb = { textContent: '' };
const toast = { items: [], append(node) { this.items.push(node); } };
globalThis.window = { scrollTo() {}, isSecureContext: false };
globalThis.document = {
  body: { append() {} },
  querySelector(selector) {
    if (selector === '#main-content') return root;
    if (selector === '#breadcrumb-current') return breadcrumb;
    if (selector === '#toast-region') return toast;
    return null;
  },
  querySelectorAll(selector) { return selector === '.nav-item' ? navs : []; },
  addEventListener(type, callback) { handlers.set(type, callback); },
  createElement() { return { style: {}, remove() {}, setAttribute() {}, append() {}, click() { if (this.download) clickedDownloads.push({ name: this.download, href: this.href }); }, select() {} }; },
};

await import('../app.mjs');

function navigate(view) {
  handlers.get('click')({
    target: { closest(selector) { if (selector === '[data-action]') return null; if (selector === '[data-view]') return { dataset: { view } }; return null; } },
    preventDefault() {},
  });
}

test('all six judge views render meaningful, English, core-derived content', () => {
  assert.match(root.innerHTML, /AI can propose/i);
  assert.match(root.innerHTML, /70 boxes/i);
  assert.doesNotMatch(root.innerHTML, /[\u0600-\u06FF]/);
  navigate('intake');
  assert.match(root.innerHTML, /Invoice intake/i);
  assert.match(root.innerHTML, /EXPIRED_GOODS/i);
  assert.doesNotMatch(root.innerHTML, /[\u0600-\u06FF]/);
  navigate('recall');
  assert.match(root.innerHTML, /HARD BLOCK CONFIRMED/i);
  assert.match(root.innerHTML, /RECALLED_BATCH/i);
  assert.doesNotMatch(root.innerHTML, /[\u0600-\u06FF]/);
  navigate('trace');
  assert.match(root.innerHTML, /United Pharmaceutical Supply Co\./i);
  assert.match(root.innerHTML, /Al-Shifa Pharmacy/i);
  assert.match(root.innerHTML, /does not currently trace downstream/i);
  assert.doesNotMatch(root.innerHTML, /[\u0600-\u06FF]/);
  navigate('evidence');
  assert.match(root.innerHTML, /Merkle root/i);
  assert.match(root.innerHTML, /not encryption/i);
  assert.doesNotMatch(root.innerHTML, /[\u0600-\u06FF]/);
  navigate('architecture');
  assert.match(root.innerHTML, /Live AMD inference/i);
  assert.match(root.innerHTML, /fixture mode performs no network call|not evidence of live inference/i);
  assert.doesNotMatch(root.innerHTML, /[\u0600-\u06FF]/);
  assert.equal(breadcrumb.textContent, 'Architecture');
});

test('audit evidence exposes all promised report export formats', () => {
  navigate('evidence');
  assert.match(root.innerHTML, /data-action="download-evidence-pack"/);
  assert.match(root.innerHTML, /Download judge evidence pack/i);
  assert.match(root.innerHTML, /data-action="download-audit"/);
  assert.match(root.innerHTML, /data-action="download-csv"/);
  assert.match(root.innerHTML, /data-action="download-html"/);
  assert.match(root.innerHTML, /Export readable HTML report/i);
});

function invokeAction(action) {
  handlers.get('click')({
    target: { closest(selector) { return selector === '[data-action]' ? { dataset: { action } } : null; } },
    preventDefault() {},
  });
}

test('audit evidence export actions trigger valid JSON, CSV, and HTML downloads', async () => {
  navigate('evidence');
  const previousCount = clickedDownloads.length;
  invokeAction('download-audit');
  invokeAction('download-csv');
  invokeAction('download-html');
  const downloads = clickedDownloads.slice(previousCount);
  const findDownload = name => downloads.find(file => file.name === name);
  const audit = findDownload('omni-ledger-audit-evidence.json');
  const csv = findDownload('omni-ledger-audit-events.csv');
  const html = findDownload('omni-ledger-trace-report.html');
  assert.ok(audit, 'audit JSON download should be triggered');
  assert.ok(csv, 'event CSV download should be triggered');
  assert.ok(html, 'readable HTML download should be triggered');
  assert.match(JSON.parse(await objectUrls.get(audit.href).text()).reportType, /Audit Evidence/i);
  assert.match(await objectUrls.get(csv.href).text(), /^"event_type","entity_type"/);
  assert.match(await objectUrls.get(html.href).text(), /^<!doctype html>/i);
});


test('judge evidence pack export bundles provenance, invoice controls, recall evidence, and integrity checks', async () => {
  navigate('evidence');
  const previousCount = clickedDownloads.length;
  invokeAction('download-evidence-pack');
  const downloads = clickedDownloads.slice(previousCount);
  const packFile = downloads.find(file => file.name === 'omni-ledger-judge-evidence-pack.json');
  assert.ok(packFile, 'single evidence pack download should be triggered');
  const pack = JSON.parse(await objectUrls.get(packFile.href).text());
  assert.equal(pack.reportType, 'OmNi-Ledger Judge Evidence Pack');
  assert.match(pack.provenance.mode, /LOCAL_DETERMINISTIC_DEMO_NOT_LIVE/);
  assert.equal(pack.provenance.liveAmdInferenceIncluded, false);
  assert.equal(pack.invoiceReferenceChecks.validFixtureAccepted, true);
  assert.equal(pack.invoiceReferenceChecks.expiredFixtureBlocked, true);
  assert.equal(pack.recallEvidence.recallTrace.blockedOperation.code, 'RECALLED_BATCH');
  assert.equal(pack.integrityChecks.ledgerChainValid, true);
  assert.equal(pack.integrityChecks.auditChainValid, true);
  assert.equal(pack.integrityChecks.stateSealValid, true);
  assert.ok(Array.isArray(pack.recallEvidence.auditEvents));
  assert.ok(Array.isArray(pack.recallEvidence.ledger));
  assert.ok(pack.limitations.some(item => /fictional/i.test(item)));
});
