import { runInvoiceScenario, runRecallScenario, explainDomainCode, DEMO_BATCH } from './demo-scenarios.mjs';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const root = $('#main-content');
const toastRegion = $('#toast-region');
const viewNames = { overview: 'Overview', intake: 'Invoice intake', recall: 'Recall control', trace: 'Batch trace', evidence: 'Audit evidence', architecture: 'Architecture' };
let currentView = 'overview';
let selectedInvoiceScenario = 'expired';
let invoiceState = runInvoiceScenario('expired');
let recallState = runRecallScenario();
let lastToast = null;

const icons = {
  arrow: '<path d="M4 12h15M13 5l7 7-7 7"/>',
  arrowUp: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  shield: '<path d="M12 3 20 6v5c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-3Z"/><path d="m8.5 12.5 2.2 2.2 4.8-5"/>',
  package: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.7 8-4.7M12 12.2V21"/>',
  alert: '<path d="M12 3 21 19H3L12 3Z"/><path d="M12 9v4.5M12 17h.01"/>',
  check: '<path d="m5 12 4.2 4.2L19 6.8"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
  file: '<path d="M7 3.5h7l4 4V20a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z"/><path d="M14 3.5V8h4M8 12h7M8 16h7"/>',
  download: '<path d="M12 3v11M7 10l5 5 5-5M4 20h16"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/>',
  pharmacy: '<path d="M4 21V7l8-4 8 4v14M2 21h20M9 21v-6h6v6M9 10h6M12 7v6"/>',
  truck: '<path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="19" r="2"/><circle cx="18" cy="19" r="2"/>',
  database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/>',
  fingerprint: '<path d="M12 11a2 2 0 0 0-2 2c0 2-.3 4-.9 6M14 13c0 3.3-.4 5.9-1.2 8M8.3 16.2C8 18.1 7.5 20 7 21M17 15c-.1 2.3-.4 4.3-1 6M5 13a7 7 0 0 1 14 0M3 10a9 9 0 0 1 18 0M7 8a5 5 0 0 1 10 0"/>',
  link: '<circle cx="8" cy="12" r="4"/><circle cx="16" cy="12" r="4"/><path d="M10.5 12h3"/>',
  network: '<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="19" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="m10.8 7.2-4.5 9.5M13.2 7.2l4.5 9.5M7.5 19h9"/>',
  terminal: '<path d="m4 6 6 6-6 6M12 18h8"/>',
  eye: '<path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
};
function icon(name, extra = '') { return `<svg viewBox="0 0 24 24" aria-hidden="true" ${extra}>${icons[name] ?? icons.layers}</svg>`; }
function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function dateLabel(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return esc(value);
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}
function dateTimeLabel(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return esc(value);
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo' }).format(d) + ' (Cairo time)';
}
function pill(text, variant = '') { return `<span class="state-pill ${variant}">${esc(text)}</span>`; }
function metric(label, value, note, iconName, accent = '') {
  return `<article class="kpi-card" style="--accent:${accent || 'var(--teal)'}"><div class="kpi-label"><span class="kpi-icon">${icon(iconName)}</span><span>${esc(label)}</span></div><div class="kpi-value">${esc(value)}</div><div class="kpi-note">${esc(note)}</div></article>`;
}
function sectionHeading(title, note, action = '') {
  return `<div class="section-heading"><div><h2>${esc(title)}</h2><p>${esc(note)}</p></div>${action}</div>`;
}
function panel(title, subtitle, body, options = {}) {
  return `<section class="panel ${options.className ?? ''}"><header class="panel-header"><div class="panel-heading"><h2>${esc(title)}</h2>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>${options.right ?? ''}</header><div class="panel-body">${body}</div></section>`;
}
function controlDescription(code) {
  const known = {
    PO_APPROVED: 'Purchase order approved under separated duties',
    GR_POSTED: 'Goods receipt posted after quality inspection',
    STOCK_RECEIPT: 'Accepted stock added to the ledger',
    STOCK_ISSUE: 'Inventory issued to a recorded customer order',
    RECALL_HELD: 'Recall activated and available stock quarantined',
    PICK_BLOCKED: 'Picking attempt rejected by the recalled-batch guard',
    SO_DISPATCHED: 'Order dispatched and traceable to a customer record',
    SO_ALLOCATED: 'Eligible stock allocated using FEFO order',
    SO_PICKING: 'Picking started for an allocated order',
    SO_PACKED: 'Order packed after guarded picking',
  };
  return known[code] ?? String(code ?? '').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}
function actorLabel(actor) {
  return ({ procurement_buyer: 'Procurement buyer', warehouse_manager: 'Warehouse manager', receiving_clerk: 'Receiving clerk', qc_officer: 'Quality officer', sales_clerk: 'Sales clerk', warehouse_operator: 'Warehouse operator', picker: 'Picker', packing_operator: 'Packing operator', dispatch_operator: 'Dispatch operator', quality_officer: 'Quality officer', qa_manager: 'QA manager' })[actor] ?? actor ?? 'System';
}
function renderActivity(events, limit = 5) {
  if (!events?.length) return '<div class="empty-state">No events available for this scenario.</div>';
  return `<div class="activity-list">${events.slice(0, limit).map(e => {
    const danger = /BLOCK|RECALL|EXPIRED|TAMPER/i.test(e.eventType ?? '');
    const sym = danger ? 'alert' : (e.eventType === 'STOCK_ISSUE' ? 'truck' : 'check');
    return `<div class="activity-row"><span class="activity-icon ${danger ? 'danger' : ''}">${icon(sym)}</span><div><b>${esc(controlDescription(e.eventType))}</b><p>${esc(e.entityType ?? 'AuditEvent')} · ${esc(e.entityId ?? '—')} · ${esc(actorLabel(e.actor))}</p></div><span class="activity-time">${esc(dateTimeLabel(e.timestamp))}</span></div>`;
  }).join('')}</div>`;
}
function flowNodes() {
  return `<div class="architecture-flow"><div class="flow-node"><span class="flow-number">01 / PERCEIVE</span><strong>Invoice understanding</strong><small>Gemma extraction through the secured AMD inference CLI</small></div><div class="flow-node"><span class="flow-number">02 / VALIDATE</span><strong>Deterministic policy gate</strong><small>Schema, item, batch, expiry, quantity and authority checks</small></div><div class="flow-node"><span class="flow-number">03 / CONTROL</span><strong>Warehouse state machine</strong><small>Receiving, QC, allocation, picking, packing and dispatch</small></div><div class="flow-node"><span class="flow-number">04 / PROVE</span><strong>Audit evidence</strong><small>SHA-256 event chain, state hash and Merkle-root seal</small></div></div>`;
}
function latestEvents(limit = 8) { return recallState.eventRows.slice(0, limit); }
function renderOverview() {
  const trace = recallState.traceModel;
  const integrityOk = recallState.integrity.ledger.ok && recallState.integrity.audit.ok && recallState.integrity.seal.ok;
  return `
    <section class="hero-panel" aria-labelledby="hero-title">
      <div class="hero-copy">
        <div class="hero-kicker"><span class="live-dot"></span> JUDGE EDITION · DEMONSTRATION WORKSPACE</div>
        <h1 id="hero-title">AI can propose.<br><span class="accent">Rules control.</span></h1>
        <p>OmNi-Ledger turns invoice understanding into governed supply-chain action. A deterministic warehouse core—not the language model—decides what can enter, move, or leave inventory, while each material event remains reviewable.</p>
        <div class="hero-actions"><button class="btn" data-view="recall">Run the recall walkthrough ${icon('arrow')}</button><button class="btn btn-secondary" data-view="intake">Test invoice controls</button></div>
        <div class="hero-trustline"><span>${icon('shield')} Deterministic controls</span><span>${icon('fingerprint')} Verifiable evidence</span><span>${icon('lock')} No API key in the browser</span></div>
      </div>
    </section>

    ${sectionHeading('Recall scenario · current evidence', 'Fictional demonstration records, computed from the warehouse core', `<span class="state-pill ${integrityOk ? 'ok' : 'blocked'}">${integrityOk ? 'INTEGRITY VERIFIED' : 'INTEGRITY CHECK FAILED'}</span>`)}
    <div class="kpi-grid">
      ${metric('Quarantined on hand', `${trace.totals.onHandBaseUnits} boxes`, `Batch ${trace.batch} · selected warehouse`, 'package', 'var(--rose)')}
      ${metric('Previously dispatched', `${trace.totals.shippedBaseUnits} boxes`, `${trace.shipments.length} recorded customer dispatch`, 'truck', 'var(--blue)')}
      ${metric('Post-recall pick attempt', recallState.pickBlock.blocked ? 'HARD BLOCK' : 'NOT BLOCKED', recallState.pickBlock.code ?? 'No control code', 'shield', 'var(--rose)')}
      ${metric('Integrity checks', integrityOk ? '3 / 3' : 'CHECK', 'Ledger · audit chain · state seal', 'fingerprint', 'var(--teal)')}
    </div>

    <div class="layout-grid" style="margin-top:14px">
      ${panel('Control activity', 'Real events from the local recall walkthrough', `<div class="activity-list">${renderActivity(latestEvents(6), 6)}</div>`, { right: '<span class="code-label">LOCAL CORE</span>' })}
      ${panel('Operational signal', 'One scenario, two outcomes', `
        <div class="decision-card is-blocked"><div class="decision-head"><span class="decision-symbol">${icon('alert')}</span><div><h3 class="decision-title">Recalled batch blocked</h3><p class="decision-subtitle">${esc(recallState.pickBlock.code)} · no pick confirmation was committed</p></div></div></div>
        <div style="height:10px"></div>
        <div class="decision-card is-accepted"><div class="decision-head"><span class="decision-symbol">${icon('check')}</span><div><h3 class="decision-title">Earlier dispatch remains traceable</h3><p class="decision-subtitle">${esc(trace.totals.shippedBaseUnits)} boxes linked to ${esc(trace.shipments[0]?.customerName ?? 'a recorded customer')}</p></div></div></div>
        <hr class="note-divider">
        <div class="subtle-label" style="margin-bottom:9px">DEMONSTRATION GUARDRAILS</div>
        <div class="badge-row"><span class="tech-badge"><span class="mini-dot"></span>Expiry hard block</span><span class="tech-badge"><span class="mini-dot"></span>Segregation of duties</span><span class="tech-badge"><span class="mini-dot"></span>Batch recall</span><span class="tech-badge"><span class="mini-dot"></span>Hash-chain evidence</span></div>
      `)}
    </div>

    ${sectionHeading('The control path', 'The model is kept outside the final decision boundary')}
    ${panel('From document to verifiable action', 'Each stage has a distinct responsibility', flowNodes())}
    <div class="info-banner" style="margin-top:14px"><span class="banner-icon">${icon('lock')}</span><div><strong>Evidence boundary</strong><p>This browser workspace runs deterministic sample scenarios. The live AMD-hosted Gemma request is available through <code>amd_omni_pipeline.mjs</code>; the API key remains in the local shell and is never sent to this public UI.</p></div></div>
  `;
}

function renderInvoice() {
  const r = invoiceState;
  const accepted = r.decision === 'ACCEPTED';
  const invoice = r.invoice;
  const chosen = selectedInvoiceScenario;
  const decisionDetails = accepted
    ? `<div class="decision-card is-accepted"><div class="decision-head"><span class="decision-symbol">${icon('check')}</span><div><h3 class="decision-title">Receipt accepted by the deterministic gate</h3><p class="decision-subtitle">${esc(r.receipt?.receiptId ?? 'Goods receipt')} · quality control completed · stock posted</p></div></div><hr class="note-divider"><div class="stack-list"><div class="stack-row"><strong>Available balance</strong><p><span class="mono">${esc(r.balance)}</span> boxes in WH-OCT6</p></div><div class="stack-row"><strong>Control result</strong><p>Receipt posted after the QC decision passed.</p></div></div></div>`
    : `<div class="decision-card is-blocked"><div class="decision-head"><span class="decision-symbol">${icon('alert')}</span><div><h3 class="decision-title">HARD BLOCK · ${esc(r.blockCode ?? 'POLICY_REJECTION')}</h3><p class="decision-subtitle">${esc(r.blockMessage ?? explainDomainCode(r.blockCode))}</p></div></div><hr class="note-divider"><div class="stack-list"><div class="stack-row"><strong>Available balance</strong><p><span class="mono">${esc(r.balance)}</span> boxes · no accepted stock added</p></div><div class="stack-row"><strong>Control principle</strong><p>Failure is visible; the model cannot override the warehouse rule.</p></div></div></div>`;
  return `
    <div class="view-header"><div><div class="eyebrow"><span class="line"></span> AI-ASSISTED INTAKE</div><h1 class="page-title">Invoice intake &amp; policy gate</h1><p class="page-description">Inspect a structured invoice scenario, then run the real warehouse receiving state machine. The public browser uses labelled fixtures; live AMD/Gemma extraction is executed separately through the secure CLI.</p></div><div class="header-actions"><button class="btn btn-secondary" data-action="copy-live-command">${icon('terminal')} Copy live CLI setup</button></div></div>
    <div class="layout-grid">
      ${panel('Invoice sample', 'Choose a controlled test fixture', `
        <div class="field"><label for="invoice-scenario-select">Scenario</label><select id="invoice-scenario-select" class="control"><option value="expired" ${chosen === 'expired' ? 'selected' : ''}>Expired batch — should be blocked</option><option value="valid" ${chosen === 'valid' ? 'selected' : ''}>Valid batch — should be accepted</option></select><small>Fictional input data. Changing the fixture does not contact an external model.</small></div>
        <div class="field"><span class="field-label">Input document excerpt</span><div class="hash-value" style="color:#b6cadd;white-space:pre-wrap">${esc(chosen === 'valid' ? 'SUPPLIER INVOICE\nInvoice: SUP-INV-24018\nSKU: PARA-500\nBatch: BATCH-2027-OK\nExpiry: 2027-12-31\nQuantity: 100 boxes\nUnit cost: 1250 Qirsh' : 'SUPPLIER INVOICE\nInvoice: SUP-INV-23902\nSKU: PARA-500\nBatch: BATCH-EXP-99\nExpiry: 2024-01-01\nQuantity: 50 boxes\nUnit cost: 1250 Qirsh')}</div></div>
        <div class="badge-row"><span class="tech-badge"><span class="mini-dot"></span>Fixture input</span><span class="tech-badge">No browser API call</span><span class="tech-badge">Integer quantities</span></div>
        <div class="form-actions"><button class="btn btn-block" data-action="run-invoice">Run deterministic gate ${icon('arrow')}</button></div>
      `)}
      <div class="stack-list" style="gap:14px">
        ${panel('Decision result', 'Decision made by the warehouse core', decisionDetails)}
        ${panel('Structured fields', 'The fields passed into the deterministic receiving flow', `<div class="stack-list"><div class="stack-row"><strong>Invoice</strong><p class="mono">${esc(invoice.invoiceNo)}</p></div><div class="stack-row"><strong>Item / SKU</strong><p>${esc(invoice.itemCode)} · Paracetamol 500 mg tablets</p></div><div class="stack-row"><strong>Batch / lot</strong><p class="mono">${esc(invoice.batch)}</p></div><div class="stack-row"><strong>Expiry date</strong><p>${esc(invoice.expiryDate)} ${invoice.expiryDate < r.core.today ? pill('EXPIRED', 'blocked') : pill('IN DATE', 'ok')}</p></div><div class="stack-row"><strong>Quantity</strong><p>${esc(invoice.qty)} boxes</p></div><div class="stack-row"><strong>Unit cost</strong><p>${esc(invoice.unitCostQirsh)} Qirsh</p></div></div>`)}
      </div>
    </div>
    ${sectionHeading('Inference integration', 'Live inference is intentionally not exposed to client-side JavaScript')}
    <div class="layout-grid">
      ${panel('Run Gemma on AMD', 'Secure command-line inference path', `
        <p class="scope-note">Set the API key in your terminal environment. The script submits invoice text to the configured AMD Radeon Cloud OpenAI-compatible endpoint, validates the JSON fields, and passes them to the same deterministic core.</p>
        <div class="command-box"><code>node amd_omni_pipeline.mjs --live --scenario valid</code><button class="btn btn-secondary btn-small" data-action="copy-live-command">${icon('copy')} Copy setup</button></div>
        <div style="height:11px"></div><div class="command-box"><code>node amd_omni_pipeline.mjs --live --scenario expired</code><button class="btn btn-secondary btn-small" data-action="copy-expired-command">${icon('copy')} Copy test</button></div>
      `)}
      ${panel('Evidence from this run', 'Locally generated from the deterministic fixture', `
        <div class="metric-strip" style="grid-template-columns:repeat(2,minmax(0,1fr))"><div class="metric-tile"><span>Ledger chain</span><strong style="font-size:15px;color:${r.integrity.ledger.ok ? 'var(--green)' : 'var(--rose)'}">${r.integrity.ledger.ok ? 'VALID' : 'FAILED'}</strong><small>${r.core.ledger.length} ledger rows</small></div><div class="metric-tile"><span>Audit chain</span><strong style="font-size:15px;color:${r.integrity.audit.ok ? 'var(--green)' : 'var(--rose)'}">${r.integrity.audit.ok ? 'VALID' : 'FAILED'}</strong><small>${r.core.audit.length} audit events</small></div></div>
        <div class="hash-label"><span>Merkle root</span><span class="code-label">SHA-256 TREE</span></div><div class="hash-value">${esc(r.seal.merkleRoot)}</div>
        <div class="form-actions"><button class="btn btn-secondary btn-small" data-action="download-invoice-report">${icon('download')} Export proof JSON</button></div>
      `)}
    </div>
  `;
}

function translateActionRequired(order) {
  return order.pickedQty > 0 ? 'Return picked units to quarantine, then reallocate.' : 'Reallocate to a non-recalled batch before picking.';
}
function renderRecall() {
  const r = recallState;
  const trace = r.traceModel;
  const held = r.recall.heldQty;
  const order = r.recallImpact.openOrders[0];
  return `
    <div class="view-header"><div><div class="eyebrow"><span class="line"></span> SAFETY-CRITICAL WORKFLOW</div><h1 class="page-title">Recall control</h1><p class="page-description">A recall must do more than raise an alert. It must change stock state, expose affected orders, block the next controlled action, and preserve the reason and reference in the event trail.</p></div><div class="header-actions"><span class="state-pill ok">LOCAL SCENARIO READY</span></div></div>
    <section class="recall-hero"><div><span class="state-pill blocked">ACTIVE RECALL · ${esc(r.recall.id)}</span><h2>A recall is a control event—not a notification.</h2><p>Selected warehouse: WH-OCT6. The example traces one batch from its recorded supplier receipt to a previous customer dispatch, quarantines the remaining available stock, and tries to pick a previously allocated open order.</p></div><span class="recall-alert-icon">${icon('alert')}</span></section>
    <div style="height:14px"></div>
    ${panel('Launch a recall scenario', 'Each run creates a fresh, fictional ledger state', `
      <form id="recall-form">
        <div class="split-two"><div class="field"><label for="recall-batch">Batch / lot identifier</label><input id="recall-batch" class="control" name="batch" value="${esc(r.batch)}" maxlength="80" required><small>Must be identical to the batch in the receipt ledger.</small></div><div class="field"><label for="recall-ref">Recall reference</label><input id="recall-ref" class="control" name="refNo" value="${esc(r.refNo)}" maxlength="80" required><small>A reference is mandatory for the modeled recall action.</small></div></div>
        <div class="field"><label for="recall-reason">Documented reason</label><textarea id="recall-reason" class="control" name="reason" maxlength="300" required>${esc(r.reason)}</textarea><small>Maker and checker are separate demo roles. No authority is inferred from model output.</small></div>
        <div class="form-actions"><button class="btn" type="submit">Execute recall walkthrough ${icon('arrow')}</button><button class="btn btn-secondary" type="button" data-view="trace">Inspect current trace</button></div>
      </form>
    `)}
    ${sectionHeading('Impact summary', 'Computed from the actual local core after recall')}
    <div class="metric-strip">
      <div class="metric-tile"><span>Units received</span><strong>${esc(trace.totals.receivedBaseUnits)}</strong><small>From recorded GR posts</small></div>
      <div class="metric-tile accent-amber"><span>Previously shipped</span><strong>${esc(trace.totals.shippedBaseUnits)}</strong><small>${trace.shipments.length} recorded dispatches</small></div>
      <div class="metric-tile accent-rose"><span>Units quarantined</span><strong>${esc(held)}</strong><small>Selected warehouse only</small></div>
      <div class="metric-tile accent-rose"><span>Post-recall pick</span><strong style="font-size:18px">${r.pickBlock.blocked ? 'BLOCKED' : 'CHECK'}</strong><small>${esc(r.pickBlock.code ?? 'No control code')}</small></div>
    </div>
    <div class="layout-grid" style="margin-top:14px">
      ${panel('Control decision', 'Recall rule outcome', `
        <div class="decision-card is-blocked"><div class="decision-head"><span class="decision-symbol">${icon('alert')}</span><div><h3 class="decision-title">${r.pickBlock.blocked ? 'HARD BLOCK CONFIRMED' : 'UNEXPECTED ALLOW'}</h3><p class="decision-subtitle">${esc(r.pickBlock.code ?? '—')} · attempted picking of ${esc(r.openOrder.id)}</p></div></div><hr class="note-divider"><p class="scope-note">${esc(r.pickBlock.message)}</p></div>
        <div style="height:12px"></div><div class="stack-list"><div class="stack-row"><strong>Recall ref</strong><p class="mono">${esc(r.recall.refNo)}</p></div><div class="stack-row"><strong>Initiated by</strong><p>Quality officer</p></div><div class="stack-row"><strong>Approved by</strong><p>QA manager</p></div><div class="stack-row"><strong>Reason</strong><p>${esc(r.recall.reason)}</p></div></div>
      `)}
      ${panel('Affected outbound order', 'An order allocated before the recall', order ? `
        <div class="shipment-card"><div class="shipment-main"><span class="pharmacy-icon">${icon('pharmacy')}</span><span><b>Al-Nasr Pharmacy · Sheikh Zayed</b><small>${esc(order.soId)} · status ${esc(order.status)}</small></span></div><div class="shipment-qty"><strong>${esc(order.allocatedQty)}</strong><small>boxes allocated</small></div></div>
        <div style="height:11px"></div><div class="warning-banner"><span>${icon('alert')}</span><div><strong>Human action required</strong><p>${esc(translateActionRequired(order))} The model does not automatically override or reassign this order.</p></div></div>
      ` : '<div class="empty-state">No open order matched this batch.</div>')}
    </div>
    ${sectionHeading('Event sequence', 'The audit trail records receipt, dispatch, recall, and the blocked pick')}
    ${panel('Latest control events', 'Most recent first', `<div class="timeline">${latestEvents(9).map(e => {
      const isBlock = /BLOCK|RECALL/.test(e.eventType ?? '');
      return `<div class="timeline-row"><div class="timeline-rail"><span class="timeline-mark ${isBlock ? 'alert' : ''}"></span></div><div class="timeline-content"><b>${esc(controlDescription(e.eventType))}</b><div class="timeline-meta"><span>${esc(e.eventType)}</span><span>${esc(e.entityType)} · ${esc(e.entityId)}</span><span>${esc(dateTimeLabel(e.timestamp))}</span></div><p>Actor: ${esc(actorLabel(e.actor))} · Integrity hash: <code>${esc(String(e.hash ?? '').slice(0, 22))}…</code></p></div></div>`;
    }).join('')}</div>`)}
    <div class="info-banner" style="margin-top:14px"><span class="banner-icon">${icon('eye')}</span><div><strong>Scope note</strong><p>This scenario traces batches to recorded warehouse dispatches and customer records. It does not represent patient-level, downstream sub-pharmacy, or individual serialized-unit tracking. The demonstration data is fictional and no real pharmacy is contacted.</p></div></div>
  `;
}

function renderTrace() {
  const trace = recallState.traceModel;
  const supplier = trace.supplier[0];
  const onHand = trace.onHand;
  const shipmentCards = trace.shipments.length ? trace.shipments.map(s => `
    <div class="shipment-card"><div class="shipment-main"><span class="pharmacy-icon">${icon('pharmacy')}</span><span><b>${esc(s.customerName)}</b><small>Sales order ${esc(s.soId)} · ${esc(dateTimeLabel(s.dispatchedAt))}</small></span></div><div class="shipment-qty"><strong>${esc(s.qty)}</strong><small>boxes dispatched</small></div></div>
  `).join('<div style="height:9px"></div>') : '<div class="empty-state">No customer dispatch recorded for this batch.</div>';
  return `
    <div class="view-header"><div><div class="eyebrow"><span class="line"></span> BIDIRECTIONAL BATCH TRACE</div><h1 class="page-title">Batch traceability</h1><p class="page-description">Trace backward to the recorded supplier receipt and forward to outbound customer dispatches, while showing current balances by warehouse location and stock status.</p></div><div class="header-actions"><button class="btn btn-secondary" data-action="download-trace">${icon('download')} Export trace report</button></div></div>
    <div class="panel" style="padding:18px;margin-bottom:14px"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:15px;flex-wrap:wrap"><div><div class="eyebrow">RECALLED BATCH</div><h2 style="margin:0 0 5px;font-size:22px">${esc(trace.itemName)}</h2><p style="margin:0;color:var(--muted);font-size:10px">SKU <code>${esc(trace.itemCode)}</code> · Batch <code>${esc(trace.batch)}</code> · Expiry ${esc(trace.expiryDate)}</p></div>${pill(trace.recall?.status === 'ACTIVE' ? 'ACTIVE RECALL' : 'NO ACTIVE RECALL', trace.recall?.status === 'ACTIVE' ? 'blocked' : 'warn')}</div></div>
    <div class="metric-strip">
      <div class="metric-tile"><span>Received (recorded)</span><strong>${esc(trace.totals.receivedBaseUnits)}</strong><small>Warehouse receipts</small></div>
      <div class="metric-tile accent-amber"><span>Dispatched (recorded)</span><strong>${esc(trace.totals.shippedBaseUnits)}</strong><small>Customer orders</small></div>
      <div class="metric-tile accent-rose"><span>Currently on hand</span><strong>${esc(trace.totals.onHandBaseUnits)}</strong><small>All statuses in core</small></div>
      <div class="metric-tile accent-teal"><span>Ledger integrity</span><strong style="font-size:17px">${trace.integrity.ledgerOk ? 'VALID' : 'FAILED'}</strong><small>Recorded chain checked</small></div>
    </div>
    <div class="layout-grid" style="margin-top:14px">
      ${panel('01 · Upstream origin', 'Supplier receipt evidence', supplier ? `
        <div class="origin-node"><span class="node-icon">${icon('package')}</span><span><b>${esc(supplier.supplierName)}</b><small>Supplier code ${esc(supplier.supplierCode)} · purchase order ${esc(supplier.poId)}</small></span></div>
        <div class="connector">RECEIVED INTO WAREHOUSE</div>
        <div class="origin-node"><span class="node-icon">${icon('database')}</span><span><b>Goods receipt ${esc(supplier.receiptId)}</b><small>${esc(dateTimeLabel(supplier.firstPostedAt))} · ${esc(supplier.qty)} boxes recorded</small></span></div>
      ` : '<div class="empty-state">No supplier receipt was found for the batch.</div>')}
      ${panel('02 · Current warehouse state', 'Balances derived from the ledger, not an editable stock field', onHand.length ? `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>Warehouse</th><th>Location</th><th>Status</th><th>Qty</th></tr></thead><tbody>${onHand.map(x => `<tr><td>${esc(x.warehouseCode)}</td><td><code>${esc(x.locationName)}</code></td><td>${pill(x.status, x.status === 'QUARANTINE' ? 'blocked' : 'ok')}</td><td><strong>${esc(x.qty)}</strong></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state">No on-hand balance remains for this batch.</div>')}
    </div>
    ${sectionHeading('03 · Downstream distribution', 'Customer identities and quantities are taken from recorded dispatch events')}
    <div class="panel"><div class="panel-header"><div class="panel-heading"><h2>Recorded destinations</h2><p>No extrapolation beyond the core’s dispatch records</p></div><span class="state-pill">${trace.shipments.length} DISPATCH RECORD(S)</span></div><div class="panel-body"><div class="stack-list">${shipmentCards}</div></div></div>
    <div class="info-banner" style="margin-top:14px"><span class="banner-icon">${icon('eye')}</span><div><strong>Traceability scope</strong><p>The implemented trace is batch-level and ends at recorded warehouse dispatches. It does not currently trace downstream sub-pharmacies, individual patients, or individual GS1 serial numbers; customer-return flows are outside this prototype’s implemented scope.</p></div></div>
  `;
}

function renderEvidence() {
  const r = recallState;
  const checks = [
    { label: 'Inventory ledger hash chain', ok: r.integrity.ledger.ok, detail: 'Each committed movement is linked to the prior ledger hash.' },
    { label: 'Audit event chain', ok: r.integrity.audit.ok, detail: 'Operational control events have a separately verified audit chain.' },
    { label: 'State seal verification', ok: r.integrity.seal.ok, detail: 'The current state hash matches the generated Merkle-root seal.' },
  ];
  return `
    <div class="view-header"><div><div class="eyebrow"><span class="line"></span> VERIFY, DO NOT ASSUME</div><h1 class="page-title">Audit evidence</h1><p class="page-description">Inspect the event hashes, verify the ledger and audit chain, and export the sample trace. Hashes provide tamper-evident integrity checks; they are not encryption or a legal digital signature.</p></div><div class="header-actions"><button class="btn" type="button" data-action="download-evidence-pack">${icon('download')} Download judge evidence pack</button><button class="btn btn-secondary" type="button" data-action="download-audit">${icon('download')} Audit JSON</button><button class="btn btn-secondary" type="button" data-action="download-csv">${icon('download')} Event CSV</button><button class="btn btn-secondary" type="button" data-action="download-html">${icon('download')} Export readable HTML report</button></div></div>
    <div class="kpi-grid">${checks.map(c => metric(c.label, c.ok ? 'VALID' : 'FAILED', c.detail, c.ok ? 'shield' : 'alert', c.ok ? 'var(--teal)' : 'var(--rose)')).join('')}</div>
    <div class="layout-grid" style="margin-top:14px">
      ${panel('State seal', 'Computed from the current local demo state', `
        <div class="hash-label"><span>Merkle root</span><span class="code-label">ROOT</span></div><div class="hash-value">${esc(r.seal.merkleRoot)}</div>
        <div class="hash-label"><span>State hash</span><span class="code-label">STATE</span></div><div class="hash-value">${esc(r.seal.stateHash)}</div>
        <div class="hash-label"><span>Ledger head</span><span class="code-label">HEAD</span></div><div class="hash-value">${esc(r.integrity.ledger.head ?? 'UNAVAILABLE')}</div>
        <hr class="note-divider"><div class="info-banner"><span class="banner-icon">${icon('lock')}</span><div><strong>What this proves</strong><p>The local checks confirm consistency of the generated demo ledger and state seal. They do not prove a legal signature, external timestamp authority, production isolation, or a live AMD request.</p></div></div>
      `)}
      ${panel('Audit record summary', 'Latest event rows from the actual core instance', `
        <div class="metric-strip" style="grid-template-columns:repeat(2,minmax(0,1fr))"><div class="metric-tile"><span>Ledger rows</span><strong>${r.core.ledger.length}</strong><small>Stock movements</small></div><div class="metric-tile"><span>Audit events</span><strong>${r.core.audit.length}</strong><small>State transitions and controls</small></div></div>
        <div style="height:14px"></div><div class="stack-list"><div class="stack-row"><strong>Recall event</strong><p class="mono">${esc(r.recall.id)} · ${esc(r.recall.refNo)}</p></div><div class="stack-row"><strong>Control denial</strong><p class="mono">${esc(r.pickBlock.code)}</p></div><div class="stack-row"><strong>Generated</strong><p>${esc(dateTimeLabel(r.generatedAt))}</p></div></div>
      `)}
    </div>
    ${sectionHeading('Event chain', 'Newest first · event hashes are shown as generated by the core')}
    <div class="panel"><div class="panel-header"><div class="panel-heading"><h2>Recent audit events</h2><p>Entity, actor, timestamp and hash reference</p></div><span class="state-pill ok">${r.integrity.audit.ok ? 'CHAIN VERIFIED' : 'CHAIN FAILED'}</span></div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Event</th><th>Entity</th><th>Actor</th><th>Timestamp</th><th>Hash</th></tr></thead><tbody>${r.core.audit.slice(-18).reverse().map(e => `<tr><td><strong>${esc(controlDescription(e.eventType))}</strong><div class="code-label">${esc(e.eventType)}</div></td><td>${esc(e.entityType)}<div class="code-label">${esc(e.entityId)}</div></td><td>${esc(actorLabel(e.actor))}</td><td>${esc(dateTimeLabel(e.timestamp))}</td><td><code title="${esc(e.hash)}">${esc(String(e.hash ?? '').slice(0, 15))}…</code></td></tr>`).join('')}</tbody></table></div></div>
  `;
}

function renderArchitecture() {
  return `
    <div class="view-header"><div><div class="eyebrow"><span class="line"></span> SYSTEM BOUNDARIES</div><h1 class="page-title">Architecture &amp; proof model</h1><p class="page-description">The design separates probabilistic document understanding from deterministic operational authority. Each layer has a bounded responsibility and a defined failure mode.</p></div></div>
    <div class="purpose-quote">“The model may extract and propose. <em>Deterministic rules decide what is allowed.</em> Human accountability and verifiable evidence remain in control.”</div>
    <div style="height:14px"></div>${panel('Four layers, explicit boundaries', 'No model result writes inventory directly', flowNodes())}
    ${sectionHeading('Architecture at a glance', 'The same warehouse core powers the browser demonstration and the CLI pipeline')}
    <div class="architecture-cards">
      <article class="arch-card"><span class="arch-icon">${icon('file')}</span><div><h3>01 · AI perception</h3><p>Gemma extracts a typed field set from invoice text through an OpenAI-compatible AMD Radeon Cloud endpoint. The key stays in the local shell—not public JavaScript.</p><div class="arch-meta">AMD ENDPOINT · CONFIGURABLE MODEL NAME</div></div></article>
      <article class="arch-card"><span class="arch-icon">${icon('shield')}</span><div><h3>02 · Deterministic gate</h3><p>Application code validates required fields, SKU identity, actual dates, integer quantity and cost, batch state, FEFO eligibility, segregation of duties, and guarded state transitions.</p><div class="arch-meta">FAIL CLOSED · EXPLICIT CONTROL CODES</div></div></article>
      <article class="arch-card"><span class="arch-icon">${icon('package')}</span><div><h3>03 · Warehouse state machine</h3><p>Receiving is gated by quality inspection. Allocation uses eligible stock. Picking checks item and batch. Packing and dispatch re-check recalled-batch restrictions.</p><div class="arch-meta">LEDGER IS SOURCE OF STOCK TRUTH</div></div></article>
      <article class="arch-card"><span class="arch-icon">${icon('fingerprint')}</span><div><h3>04 · Audit evidence</h3><p>Stock movement and control events are hash-chained; a state hash and Merkle-root seal can be verified. The design describes tamper evidence, not encryption or legal signing.</p><div class="arch-meta">SHA-256 · CANONICAL DATA · MERKLE ROOT</div></div></article>
    </div>
    ${sectionHeading('How to reproduce', 'Node.js 20+ · no third-party dependencies required')}
    <div class="layout-grid">
      ${panel('Local judge application', 'Run the UI and deterministic scenarios', `
        <div class="stack-list"><div class="stack-row"><strong>1. Verify</strong><p><code>npm test</code></p></div><div class="stack-row"><strong>2. Start the site</strong><p><code>npm run serve</code></p></div><div class="stack-row"><strong>3. Open</strong><p><code>http://127.0.0.1:4173</code></p></div></div>
        <div class="command-box"><code>npm run verify:release</code><button class="btn btn-secondary btn-small" data-action="copy-verify">${icon('copy')} Copy</button></div>
      `)}
      ${panel('Live AMD inference', 'Separate CLI execution; never paste a key into this page', `
        <p class="scope-note">In a private local terminal, configure your AMD/Radeon Cloud API key. The pipeline records the endpoint host and response ID when provided, but never prints the secret.</p>
        <div class="command-box"><code>export AMD_TOKENFACTORY_API_KEY="YOUR_KEY"</code><button class="btn btn-secondary btn-small" data-action="copy-live-command">${icon('copy')} Copy setup</button></div>
        <div style="height:9px"></div><div class="command-box"><code>npm run amd:live</code><button class="btn btn-secondary btn-small" data-action="copy-live-run">${icon('copy')} Copy run</button></div>
        <div style="height:9px"></div><div class="command-box"><code>npm run amd:fixture</code><button class="btn btn-secondary btn-small" data-action="copy-fixture">${icon('copy')} Copy fixture</button></div>
        <p class="tone-down" style="margin:10px 0 0">Fixture mode performs no network call and is not evidence of live inference. A real run requires a valid key and a model actually available to the account.</p>
      `)}
    </div>
    ${sectionHeading('Evidence status', 'What this package can and cannot claim')}
    ${panel('Claim discipline', 'Use the proof that matches the executed build', `
      <div class="stack-list">
        <div class="stack-row"><strong>Locally proven here</strong><p>Invoice accept/block behavior, batch recall, selected-warehouse quarantine, blocking a pre-allocated pick, customer-level dispatch tracing, hash-chain verification, and report export.</p></div>
        <div class="stack-row"><strong>Must be run with credentials</strong><p>Live Gemma extraction through the configured AMD endpoint, including the exact model name, HTTP response, request ID if returned, and the deterministic result downstream.</p></div>
        <div class="stack-row"><strong>Outside this prototype</strong><p>Patient-level tracing, sub-pharmacy trace, individual GS1 serialization, customer returns, live multi-user operations, regulated production deployment, and a legal digital signature.</p></div>
      </div>
    `)}
  `;
}

function setView(view, { focus = true } = {}) {
  if (!viewNames[view]) return;
  currentView = view;
  $$('.nav-item').forEach(btn => {
    const active = btn.dataset.view === view;
    btn.classList.toggle('is-active', active);
    if (active) btn.setAttribute('aria-current', 'page'); else btn.removeAttribute('aria-current');
  });
  $('#breadcrumb-current').textContent = viewNames[view];
  root.setAttribute('aria-busy', 'true');
  try {
    root.innerHTML = ({ overview: renderOverview, intake: renderInvoice, recall: renderRecall, trace: renderTrace, evidence: renderEvidence, architecture: renderArchitecture })[view]();
  } catch (error) {
    root.innerHTML = `<div class="danger-banner"><span>${icon('alert')}</span><div><strong>View render failed</strong><p>${esc(error.message)}</p></div></div>`;
    console.error('View render failed', error);
  }
  root.setAttribute('aria-busy', 'false');
  if (focus) root.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toast(message, type = 'success') {
  if (lastToast) { clearTimeout(lastToast.timer); lastToast.node.remove(); }
  const node = document.createElement('div');
  node.className = `toast ${type === 'error' ? 'error' : ''}`;
  node.innerHTML = `<span class="toast-mark" aria-hidden="true">${type === 'error' ? '!' : '✓'}</span><span>${esc(message)}</span>`;
  toastRegion.append(node);
  lastToast = { node, timer: setTimeout(() => { node.remove(); lastToast = null; }, 3600) };
}

async function copyText(text, success = 'Copied to clipboard') {
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) await navigator.clipboard.writeText(text);
    else {
      const box = document.createElement('textarea'); box.value = text; box.setAttribute('readonly', ''); box.style.position = 'fixed'; box.style.opacity = '0'; document.body.append(box); box.select();
      const ok = document.execCommand('copy'); box.remove(); if (!ok) throw new Error('Clipboard permission is not available.');
    }
    toast(success);
  } catch { toast('Copy failed. Select the command and copy it manually.', 'error'); }
}
function downloadBlob(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.style.display = 'none'; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function csvCell(value) { const s = String(value ?? ''); return `"${s.replaceAll('"', '""')}"`; }
function toCsv(rows) { return '\ufeff' + rows.map(row => row.map(csvCell).join(',')).join('\r\n'); }
function exportTracePayload() {
  const r = recallState;
  return {
    reportType: 'OmNi-Ledger Batch Trace — Demonstration Data', generatedAt: r.generatedAt,
    scope: 'Batch-level trace through recorded warehouse dispatch; no patient or downstream sub-pharmacy tracking.',
    itemCode: r.traceModel.itemCode, itemName: r.traceModel.itemName, batch: r.traceModel.batch, expiryDate: r.traceModel.expiryDate,
    recall: { id: r.recall.id, status: r.recall.status, refNo: r.recall.refNo, reason: r.recall.reason, warehouseCode: r.recall.warehouseCode, heldQty: r.recall.heldQty },
    supplierReceipts: r.traceModel.supplier, shipments: r.traceModel.shipments, onHand: r.traceModel.onHand, totals: r.traceModel.totals,
    blockedOperation: r.pickBlock, recallImpact: r.recallImpact,
    integrity: { ledger: r.integrity.ledger, audit: r.integrity.audit, seal: r.integrity.seal, merkleRoot: r.seal.merkleRoot, stateHash: r.seal.stateHash },
    caveats: r.traceModel.limitations,
  };
}
function exportAuditPayload() {
  const r = recallState;
  return { reportType: 'OmNi-Ledger Audit Evidence — Demonstration Data', generatedAt: r.generatedAt, disclaimer: 'Fictional local scenario. Hashes are tamper-evident integrity data, not encryption or a legal signature.', recallTrace: exportTracePayload(), ledger: r.core.ledger, auditEvents: r.core.audit, stateSeal: r.seal };
}
function exportAuditCsv() {
  const rows = [['event_type','entity_type','entity_id','actor','timestamp','event_hash'], ...recallState.core.audit.map(e => [e.eventType,e.entityType,e.entityId,e.actor,e.timestamp,e.hash])];
  return toCsv(rows);
}
function exportEvidencePack() {
  const validReference = runInvoiceScenario('valid');
  const expiredReference = runInvoiceScenario('expired');
  const auditPayload = exportAuditPayload();
  const tracePayload = exportTracePayload();
  const checks = {
    validFixtureAccepted: validReference.decision === 'ACCEPTED',
    expiredFixtureBlocked: expiredReference.decision === 'BLOCKED' && expiredReference.blockCode === 'EXPIRED_GOODS',
    recallPickBlocked: recallState.pickBlock.blocked === true && recallState.pickBlock.code === 'RECALLED_BATCH',
    ledgerChainValid: recallState.integrity.ledger.ok === true,
    auditChainValid: recallState.integrity.audit.ok === true,
    stateSealValid: recallState.integrity.seal.ok === true,
  };
  return {
    reportType: 'OmNi-Ledger Judge Evidence Pack',
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    software: { name: 'OmNi-Ledger Judge Edition', version: '3.0.10' },
    provenance: {
      mode: 'LOCAL_DETERMINISTIC_DEMO_NOT_LIVE_AMD',
      browserInference: 'NOT RUN',
      liveAmdInferenceIncluded: false,
      explanation: 'This pack is generated by the local browser demonstration. The browser does not call AMD or run Gemma; all scenario records are fictional.',
    },
    currentInvoiceEvidence: {
      selectedFixture: selectedInvoiceScenario,
      mode: 'LOCAL_DETERMINISTIC_FIXTURE_NOT_LIVE_MODEL',
      decision: invoiceState.decision,
      blockCode: invoiceState.blockCode ?? null,
      invoice: invoiceState.invoice,
      availableBalance: invoiceState.balance,
      quarantineBalance: invoiceState.quarantineBalance,
      lines: invoiceState.lines,
      integrity: { ledger: invoiceState.integrity.ledger.ok, audit: invoiceState.integrity.audit.ok, seal: invoiceState.integrity.seal.ok },
    },
    invoiceReferenceChecks: {
      validFixtureAccepted: checks.validFixtureAccepted,
      expiredFixtureBlocked: checks.expiredFixtureBlocked,
    },
    recallEvidence: auditPayload,
    integrityChecks: {
      ...checks,
      passCount: Object.values(checks).filter(Boolean).length,
      totalCount: Object.keys(checks).length,
      overall: Object.values(checks).every(Boolean) ? 'PASS' : 'REVIEW_REQUIRED',
    },
    embeddedExports: {
      auditEventsCsv: exportAuditCsv(),
      readableTraceHtml: toReadableHtmlReport(tracePayload),
    },
    limitations: [
      'All browser scenarios use fictional local demonstration data.',
      'This pack does not include a live AMD request; the browser UI does not contact the model endpoint.',
      'Traceability is batch-level through recorded warehouse dispatch; there is no patient-level, downstream sub-pharmacy, or individual GS1 serial tracking.',
      'Hash checks provide tamper-evident integrity data, not encryption, external attestation, or a legal digital signature.',
      'This is a technical-evaluation prototype, not a production-certified pharmaceutical platform; no external inventory is modified.',
    ],
  };
}
function toReadableHtmlReport(report) {
  const trace = report.recallTrace ?? report;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>OmNi-Ledger · Evidence Report</title><style>body{margin:40px auto;max-width:1050px;padding:0 24px;font:15px/1.7 system-ui;background:#f5f8fb;color:#1c2a3b}h1{font-size:30px}h2{margin-top:32px}p{color:#475b72}.stamp{display:inline-block;background:#dcfce7;color:#166534;border-radius:7px;padding:5px 9px;font-size:11px;font-weight:700}pre{white-space:pre-wrap;word-break:break-word;background:#e9eff5;border:1px solid #d4e0e9;border-radius:10px;padding:18px;font:12px/1.6 ui-monospace,monospace}table{width:100%;border-collapse:collapse;background:white}th,td{text-align:left;padding:10px;border-bottom:1px solid #e1e8ee;font-size:12px}</style></head><body><h1>OmNi-Ledger</h1><p>Batch Recall &amp; Traceability · Demonstration Evidence Report</p><span class="stamp">${esc(trace.recall?.status ?? 'LOCAL DEMO')}</span><h2>Trace summary</h2><pre>${esc(JSON.stringify(trace, null, 2))}</pre><h2>Evidence disclaimer</h2><p>This report reflects a fictional local test scenario using the packaged deterministic core. It does not prove a live AMD request, patient-level traceability, external attestation, or production deployment.</p><h2>Full report payload</h2><pre>${esc(JSON.stringify(report, null, 2))}</pre></body></html>`;
}
function runInvoice() {
  const select = $('#invoice-scenario-select');
  selectedInvoiceScenario = select?.value ?? selectedInvoiceScenario;
  invoiceState = runInvoiceScenario(selectedInvoiceScenario);
  setView('intake');
  toast(invoiceState.decision === 'ACCEPTED' ? 'Valid invoice accepted by the deterministic demo core.' : `Hard block confirmed: ${invoiceState.blockCode}.`);
}
function runRecall(formValues) {
  const batch = String(formValues.batch ?? '').trim();
  const refNo = String(formValues.refNo ?? '').trim();
  const reason = String(formValues.reason ?? '').trim();
  if (!batch || !refNo || !reason) { toast('Batch, recall reference, and reason are all required.', 'error'); return; }
  try {
    recallState = runRecallScenario({ batch, refNo, reason });
    setView('recall');
    toast(recallState.pickBlock.blocked && recallState.integrity.ledger.ok ? 'Recall executed. The post-recall pick was hard-blocked and the ledger verified.' : 'Scenario completed; inspect the displayed evidence.', recallState.pickBlock.blocked ? 'success' : 'error');
  } catch (error) { toast(`${error.code ?? 'RECALL_ERROR'}: ${error.message}`, 'error'); }
}
function setNavExpanded(open) {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar?.classList) return;
  sidebar.classList.toggle('is-expanded', open);
  document.querySelector('.app-shell')?.classList?.toggle('nav-open', open);
  const toggle = document.querySelector('.nav-toggle');
  toggle?.setAttribute?.('aria-expanded', String(open));
  toggle?.setAttribute?.('aria-label', open ? 'Hide page names' : 'Show page names');
}

function handleAction(action) {
  switch (action) {
    case 'toggle-nav': setNavExpanded(!document.querySelector('.sidebar')?.classList?.contains('is-expanded')); break;
    case 'close-nav': setNavExpanded(false); break;
    case 'run-invoice': runInvoice(); break;
    case 'copy-live-command': copyText('export AMD_TOKENFACTORY_API_KEY="PASTE_YOUR_KEY_IN_THIS_LOCAL_TERMINAL"\nnpm run amd:live', 'Secure live-inference setup copied. Keep the key in your local terminal.'); break;
    case 'copy-expired-command': copyText('npm run amd:expired', 'Expired-batch test command copied.'); break;
    case 'copy-live-run': copyText('npm run amd:live', 'Live inference command copied.'); break;
    case 'copy-fixture': copyText('npm run amd:fixture', 'Offline fixture command copied. This does not call AMD.'); break;
    case 'copy-verify': copyText('npm run verify:release', 'Release verification command copied.'); break;
    case 'download-trace': downloadBlob('omni-ledger-batch-trace.json', JSON.stringify(exportTracePayload(), null, 2), 'application/json;charset=utf-8'); toast('Batch trace JSON exported.'); break;
    case 'download-evidence-pack': { const pack = exportEvidencePack(); downloadBlob('omni-ledger-judge-evidence-pack.json', JSON.stringify(pack, null, 2), 'application/json;charset=utf-8'); toast(pack.integrityChecks.overall === 'PASS' ? 'Judge evidence pack exported with all six checks passing.' : 'Judge evidence pack exported; review the check results.'); break; }
    case 'download-audit': downloadBlob('omni-ledger-audit-evidence.json', JSON.stringify(exportAuditPayload(), null, 2), 'application/json;charset=utf-8'); toast('Audit evidence JSON exported.'); break;
    case 'download-invoice-report': downloadBlob('omni-ledger-invoice-gate-report.json', JSON.stringify({ mode: 'LOCAL_DETERMINISTIC_FIXTURE_NOT_LIVE_MODEL', decision: invoiceState.decision, blockCode: invoiceState.blockCode, invoice: invoiceState.invoice, availableBalance: invoiceState.balance, quarantineBalance: invoiceState.quarantineBalance, lines: invoiceState.lines, merkleRoot: invoiceState.seal.merkleRoot, integrity: { ledger: invoiceState.integrity.ledger.ok, audit: invoiceState.integrity.audit.ok, seal: invoiceState.integrity.seal.ok } }, null, 2), 'application/json;charset=utf-8'); toast('Invoice proof JSON exported.'); break;
    case 'download-csv': downloadBlob('omni-ledger-audit-events.csv', exportAuditCsv(), 'text/csv;charset=utf-8'); toast('Audit events CSV exported.'); break;
    case 'download-html': downloadBlob('omni-ledger-trace-report.html', toReadableHtmlReport(exportTracePayload()), 'text/html;charset=utf-8'); toast('Readable HTML trace report exported.'); break;
    default: break;
  }
}

document.addEventListener('click', event => {
  const actionEl = event.target.closest('[data-action]');
  if (actionEl) { event.preventDefault(); handleAction(actionEl.dataset.action); return; }
  const viewEl = event.target.closest('[data-view]');
  if (viewEl) { event.preventDefault(); setView(viewEl.dataset.view); setNavExpanded(false); }
});

document.addEventListener('change', event => {
  if (event.target.id !== 'invoice-scenario-select') return;
  selectedInvoiceScenario = event.target.value === 'valid' ? 'valid' : 'expired';
  invoiceState = runInvoiceScenario(selectedInvoiceScenario);
  setView('intake', { focus: false });
  toast(selectedInvoiceScenario === 'valid' ? 'Valid fixture loaded. Run the gate to repeat the decision.' : 'Expired-batch fixture loaded. Run the gate to repeat the hard block.');
});

document.addEventListener('submit', event => {
  if (event.target.id !== 'recall-form') return;
  event.preventDefault();
  const form = new FormData(event.target);
  runRecall({ batch: form.get('batch'), refNo: form.get('refNo'), reason: form.get('reason') });
});

setView('overview', { focus: false });
