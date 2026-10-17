# OmNi-Ledger — AMD / lablab / Gemma Submission Master Plan

> **Purpose of this document:** the complete, submission-ready blueprint for what to write, show, link, record, and verify before submitting OmNi-Ledger to the AMD Developer Hackathon on lablab.ai.

---

## 1. The central idea

OmNi-Ledger is an AI-assisted pharmaceutical supply-chain auditing prototype.

Gemma helps transform invoice and procurement text into structured fields. The final operational decision is not delegated to the language model. The extracted data is passed to a deterministic OmNi policy engine that validates the item, batch, expiry, quantity, authorization, quality status, recall status, and ledger integrity before allowing a warehouse movement.

The core story is:

```text
Invoice text
    ↓
Gemma 4 31B IT on an AMD-hosted inference endpoint
    ↓
Structured JSON extraction
    ↓
Deterministic OmNi policy gate
    ↓
Hard block or human-approved warehouse operation
    ↓
SHA-256 audit chain + Merkle-root state seal
```

The strongest differentiator is not simply that the project uses an AI model. It is that the AI model is deliberately placed inside a controlled workflow where deterministic rules, human authorization, and verifiable records remain responsible for the final decision.

---

## 2. The founder story — how to use it correctly

### The message

OmNi-Ledger was created by a solo founder as a public-interest engineering project. Over approximately ten months, the system was researched, designed, tested, and implemented through a highly resource-constrained, phone-first workflow, with sustained full-time effort dedicated to research, architecture, experimentation, and execution.

The purpose is not to maximize transactions or force users into a commercial platform. The purpose is to make critical operational decisions more transparent, more deterministic, and easier to audit — especially where expired stock, look-alike/sound-alike medicines, weak segregation of duties, incomplete quality checks, or silent data manipulation can create real harm.

### The approved English wording

> **Origin and mission**
> OmNi-Ledger was created by a solo founder as a public-interest engineering project focused on safer, more accountable supply-chain operations. Over approximately ten months, the project was researched, designed, tested, and implemented through a highly resource-constrained, phone-first workflow, with sustained full-time effort dedicated to research, architecture, experimentation, and execution.
>
> The goal is not to maximize transactions or lock users into a commercial platform. The goal is to make critical operational decisions more transparent, more deterministic, and easier to audit — especially in environments where expired stock, look-alike/sound-alike medicines, weak segregation of duties, and silent data manipulation can create real harm.

### What not to claim

Do not write that OmNi-Ledger is the strongest project ever submitted, better than a certain percentage of all projects, guaranteed to win, production-ready, a legal signature platform, or a complete replacement for a company or ERP system.

Do not describe SHA-256 as encryption. Use **hash**, **audit chain**, **integrity evidence**, or **tamper-evident record**.

Do not claim a Google prize is guaranteed. Use:

> The project uses Gemma on AMD infrastructure and is eligible for consideration for the relevant partner prize subject to the official rules and judging.

Do not call the model Gemini. The model family used for this submission is **Google Gemma**.

---

## 3. Exact submission copy

### Project title

```text
OmNi-Ledger: Deterministic Supply-Chain Auditor with Gemma on AMD
```

### Short description

```text
OmNi-Ledger uses Gemma 4 31B IT on AMD-hosted infrastructure to extract invoice data, then passes it through a deterministic, human-gated warehouse core that blocks expired or inconsistent stock and produces verifiable SHA-256 and Merkle-root audit evidence.
```

### Long description

```text
OmNi-Ledger is an AI-assisted supply-chain auditing prototype for pharmaceutical warehouse operations.

The system uses Gemma 4 31B IT through an AMD-hosted inference endpoint to extract structured fields from procurement and invoice text. The model does not directly modify inventory. Its output is passed to a deterministic OmNi policy engine that validates item identity, batch, expiry, quantity, authorization, segregation of duties, idempotency, quality control, recall status, and ledger integrity.

The result is a human-gated workflow that can hard-block expired goods, look-alike/sound-alike item mismatches, over-receiving, unauthorized approvals, incomplete quality checks, recalled batches, and silent inventory inconsistencies.

Every accepted operation is reflected in a SHA-256 audit chain and a verifiable Merkle-root state seal. The public repository includes automated tests covering warehouse operations, FEFO allocation, recall, QC, accounting controls, state bundles, audit integrity, shortage acknowledgement, and reporting. GitHub Actions runs the syntax checks and the complete deterministic test suite on every push.

OmNi-Ledger was created by a solo founder as a public-interest engineering project. Over approximately ten months, the system was researched, designed, tested, and implemented through a highly resource-constrained, phone-first workflow. The purpose is not to maximize commercial transactions, but to make critical operational decisions more transparent, deterministic, and auditable.

The project is presented as a tested prototype, not as a production ERP, regulated accounting system, or legal-signature platform. Its central principle is simple: AI may assist with extraction, but deterministic rules, human authorization, and verifiable records remain responsible for the final operational decision.
```

### Technology tags

Use only tags that are true for the final implementation:

```text
AMD Developer Cloud
AMD ROCm
Gemma
Google DeepMind
AI Agents
Node.js
JavaScript
Supply Chain
Pharmaceutical Operations
Auditability
```

### Suggested category / track wording

Primary story:

```text
Inventory, procurement, and pharmaceutical supply-chain workflow automation.
```

Secondary story, if the form permits:

```text
Healthcare supply-chain safety and accountable operations.
```

Do not choose the Evolus-specific track unless the required Evolus workspace, building blocks, API calls, and AMD-hosted vLLM configuration have actually been implemented and can be reviewed by the event team.

---

## 4. What the judge must see

The judge should be able to understand the project in this order:

1. A real operational problem.
2. A visible AI contribution through Gemma on AMD.
3. A deterministic safety boundary after the model.
4. A rejected bad invoice.
5. An accepted good invoice.
6. Verifiable integrity evidence.
7. A public repository that runs from a clean clone.
8. A clear founder mission and future direction.

The project should never begin with a long personal biography. The product must earn attention first. The founder story then explains why the product exists and why its values are deliberate.

---

## 5. Demo route

### Live AMD / Gemma proof

Run the CLI pipeline in a controlled terminal environment:

```bash
export AMD_TOKENFACTORY_API_KEY='token-from-the-event-environment'
node amd_omni_pipeline.mjs
```

The recording must hide:

- API keys.
- Bearer tokens.
- Authorization headers.
- Private account identifiers.
- Private dashboard details.

The visible evidence should include, when available:

- Endpoint host without the secret.
- Model identifier.
- HTTP status.
- Request ID.
- Latency.
- Structured extraction result.
- Hard-block result for the expired invoice.
- Acceptance result for the valid invoice.

Do not fabricate AMD evidence. If the terminal output does not show a provider or accelerator identifier, describe the endpoint as **the AMD-hosted event endpoint configured for the project** rather than claiming a specific GPU model.

### English judge demo

Open:

```text
https://omniverseatmos-netizen.github.io/omni-ledger-amd/index-en.html
```

The English page demonstrates the deterministic downstream workflow and lets the judge download:

- An English HTML proof report.
- An English event CSV.

The Arabic operational console remains available at:

```text
https://omniverseatmos-netizen.github.io/omni-ledger-amd/
```

This preserves the original Ibn Sina / Egypt-oriented operational context while giving international judges a clear English entry point.

---

## 6. Feature map for the judge

### Procurement and receiving

The system models a purchase order from creation through submission and approval. Receiving validates the item, quantity, batch, expiry, warehouse, and purchase-order relationship before posting stock.

### FEFO allocation

First-Expiry-First-Out allocation prioritizes the batch that expires sooner while excluding expired or recalled stock.

### LASA protection

Look-alike/sound-alike mismatches are blocked when a scanned item does not match the deterministic allocation.

### Segregation of duties

The same actor cannot silently create and approve sensitive operations such as purchase orders, adjustments, recalls, or accounting entries.

### Quality control gate

A receipt can be inspected, rejected, partially accepted, or accepted. Packing is blocked until the quality gate is complete.

### Recall and traceability

A recalled batch is quarantined and prevented from receiving, picking, packing, or dispatching. Traceability reports show where the batch went and what remains.

### Tote and picking controls

A tote can be bound to an active order. Picking requires the correct item and batch, and the route planner provides warehouse guidance without giving voice commands authority to change inventory.

### Worker voice guidance

Voice features provide read-only search and guidance. Voice input does not independently close, pick, or dispatch inventory.

### Institutional accounting layer

The accounting layer is separate from the warehouse ledger. It checks balanced journals, maker-checker separation, reconciliation, idempotency, and controlled close gates.

### Shadow Mode reporting

Shadow reports clearly distinguish demo data from real shadow operations. Metrics remain derived from recorded events, with warnings when the sample is insufficient.

### Export and integrity

The system exports state bundles, HTML reports, and CSV events. The audit chain and state seal help detect tampering and preserve evidence of what happened.

---

## 7. Evidence checklist

Before submitting, verify every item:

- [ ] Public GitHub repository opens without authentication.
- [ ] `npm test` passes from a clean clone.
- [ ] `npm run check` passes.
- [ ] GitHub Actions is green on the latest commit.
- [ ] README contains setup and limitation notes.
- [ ] No token, secret, `.env`, private key, or authorization header is committed.
- [ ] English judge page loads from GitHub Pages.
- [ ] English HTML export downloads successfully.
- [ ] English CSV export downloads successfully.
- [ ] CLI demo has been run with the real event environment.
- [ ] AMD/Gemma evidence is preserved in a redacted terminal capture.
- [ ] The demo video shows the bad invoice being blocked and the valid invoice being accepted.
- [ ] The video shows the audit hash and Merkle root.
- [ ] The cover image is readable at small size.
- [ ] The pitch presentation contains the problem, architecture, evidence, value, and founder mission.
- [ ] The application URL points to the English judge demo.
- [ ] The repository URL points to the public GitHub repository.

---

## 8. Final positioning statement

Use this as the final written positioning:

> OmNi-Ledger is not an attempt to make a language model the authority over a warehouse. It is an attempt to place useful AI inside a system that knows where AI should stop. Gemma helps read the document. Deterministic rules decide whether the operation is valid. Human roles authorize sensitive actions. Cryptographic integrity evidence records what happened. The result is a practical, auditable bridge between modern AI assistance and accountable operations.

---

## 9. Future roadmap

### Near term

- Improve multilingual UI coverage while preserving the Arabic operational console.
- Add more English report templates and judge-facing evidence panels.
- Add a reproducible redacted AMD run log.
- Add schema validation and structured-output enforcement at the model boundary.
- Add additional CI checks for browser exports.

### Medium term

- Connect barcode scanners and warehouse devices.
- Replace demo warehouse coordinates with a measured facility map.
- Add role-based authentication and durable multi-user storage.
- Add signed releases and stronger deployment packaging.
- Integrate approved ERP, procurement, and accounting connectors.

### Long term

- Support multiple warehouses and organizations with strict tenant isolation.
- Add controlled analytics for shortage, expiry, recall, and picking efficiency.
- Provide governance dashboards for auditors and compliance teams.
- Expand beyond pharmaceuticals into food, laboratory, humanitarian, and critical-spares supply chains.

Every roadmap item must preserve the same principle: AI may assist, but policy, authorization, and evidence remain explicit.
