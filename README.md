# OmNi-Ledger — English Judge Edition

**Deterministic supply-chain control for AI-assisted pharmaceutical procurement.**

OmNi-Ledger demonstrates a split of responsibilities: Gemma may extract invoice fields through an AMD-hosted model endpoint, but deterministic application rules—not model confidence—decide whether a warehouse operation is allowed. The warehouse core supports controlled receiving, quality checks, FEFO allocation, scan-verified picking, batch recall, customer-level dispatch traceability, and hash-based audit evidence.

> **Prototype boundary:** This package is a technical-evaluation build with fictional demonstration records. It is not a production-certified pharmaceutical platform. Its traceability is batch-level through recorded warehouse dispatch; it does not provide patient-level, downstream sub-pharmacy, or individual GS1 serial tracking.

## What is included

- `index.html` / `index-en.html` — fully English, responsive judge workspace.
- `app.mjs`, `styles.css` — the interactive interface, with no frontend framework or remote font dependency.
- `domain.mjs` — the shared deterministic warehouse domain core.
- `demo-scenarios.mjs` — reproducible valid/expired invoice and batch-recall scenarios, powered by the real domain core.
- `amd_omni_pipeline.mjs` — server-side/CLI Gemma extraction workflow for the AMD Radeon Cloud OpenAI-compatible API. The API key never belongs in browser code.
- `fixtures/` — fictional invoice text and offline model-output fixtures. Fixture mode is explicitly labelled **not live**.
- Existing regression suites for the WMS, QC station, institutional ledger/assurance, closure controls, bundles, and shadow reports, plus nine judge-edition acceptance tests.
- `scripts/verify-release.mjs` — release syntax, asset, tests, and fixture-pipeline gate.
- `PITCH_DECK.pptx` / `PITCH_DECK.pdf`, `SUBMISSION_COVER.png`, `DEMO_SCRIPT.md`, `SUBMISSION_COPY.md` — judge/presentation materials.
- `assets/omni-ledger-cover.png` — original visual cover artwork for the project.
- One-click **Judge Evidence Pack** export combining current invoice evidence, full recall/audit payload, CSV and readable HTML exports, plus explicit local-demo provenance and integrity-check results.

## Quick start

Requirements: **Node.js 20 or newer**. No npm dependencies are required.

```bash
npm test
npm run verify:release
npm run serve
```

Open `http://127.0.0.1:4173`. The judge UI runs deterministic sample scenarios locally. It does not contact AMD on page load and does not place an API key into the browser.

## Demonstration flows

### 1. Expired invoice hard block

Open **Invoice intake**, select the expired-batch fixture, and run the deterministic gate. The domain core rejects the expired receipt with `EXPIRED_GOODS`; available stock remains zero for that item in that scenario. Select the valid fixture to see the successful QC-gated receipt path.

### 2. Batch recall and traceability

Open **Recall control** and run the scenario. It creates a fictional receipt for 100 boxes, records an earlier 30-box dispatch to a customer record, allocates a second order, issues a recall, quarantines the remaining 70 boxes in the selected warehouse, and attempts to pick the pre-allocated recalled batch. The domain rejects that attempt with `RECALLED_BATCH`. Open **Batch trace** to inspect the supplier receipt, current location/status, recorded dispatch, and chain-integrity result.

The UI labels the scope accurately: the tested trace is batch-level and ends at recorded warehouse dispatch. It does not track patients, downstream sub-pharmacies, or individual serialized packs.

### 3. Live Gemma extraction through AMD

The live pipeline is intentionally separate from public browser code. Configure the API key in a local terminal, using the base URL and exact model name displayed in your AMD/Radeon Cloud account:

```bash
export AMD_TOKENFACTORY_API_KEY="YOUR_REAL_KEY_IN_THIS_TERMINAL"
export AMD_BASE_URL="https://developer.amd.com.cn/radeon/api/v1"
export AMD_MODEL="Gemma-4-31B-IT"
npm run amd:live
```

The default model label matches the project context used to prepare this submission, but model names and account availability can change. **Confirm the exact model name in your AMD model catalog** and set `AMD_MODEL` accordingly. Do not hard-code a secret into `app.mjs`, HTML, a public repository, a screenshot, or a recorded terminal session.

Run the negative control against an expired-batch invoice:

```bash
npm run amd:expired
```

To test the deterministic pipeline without making a network request:

```bash
npm run amd:fixture
npm run amd:expired-fixture
```

Offline fixtures validate downstream handling only; they are **not evidence of a live AMD request**. The live run reports the endpoint host, returned model/request ID when available, extracted fields, deterministic outcome, and integrity summary—without printing the API key.

## Architecture

```text
Invoice text
    │
    ▼
Gemma extraction through AMD-hosted endpoint (secured CLI)
    │  untrusted structured output
    ▼
Strict schema/master-data validation
    │
    ▼
Deterministic WMS state machine
    ├── expiry / batch / quantity checks
    ├── quality-control and segregation-of-duties gates
    ├── FEFO allocation and scan-verified picking
    └── recall / quarantine / dispatch controls
    │
    ▼
Ledger and audit chains → state hash → Merkle-root seal
```

The AI does not receive direct authority to write the inventory ledger. Hashing is described as **tamper-evident integrity evidence**, not encryption and not a legal digital signature.

## Release verification

`npm run verify:release` checks JavaScript module syntax, essential assets and expected page wiring, runs the test suite, verifies the HTTP server’s basic security headers/asset paths, validates the SHA-256 release manifest, then runs both offline negative/positive pipeline fixtures. After any intentional source change, run `npm run build:site`, `npm run manifest:build`, then `npm run verify:release` again. The live AMD request is intentionally not run by release verification because it requires the user's private key and account-level model availability.

## Technical limits and cautions

- The public page runs the domain demonstration in the browser with fictional data. It does not make a live AMD inference request.
- Live AMD inference must be verified from the configured CLI environment immediately before recording the submission video.
- The batch recall path quarantines available stock in the selected warehouse, while recall-status guards prevent recalled-batch operations such as allocation/picking/packing/dispatch and now transfer. Multi-warehouse quarantine semantics deserve a dedicated inventory-wide recall policy before production use.
- Traceability stops at recorded dispatch to the customer record. There is no downstream patient/sub-pharmacy or GS1 serial tracking.
- Customer returns, production multi-user concurrency, identity-provider integration, external timestamping, legal digital signing, regulated validation, and real device/browser acceptance across a pharmacy site are outside this package's validated scope.
- This repo uses the core's original domain strings internally; the judge UI presents its own English labels and control-code explanations.

## Publishing

This folder is a **submission candidate**, not an assertion that the new files are already published. Create or update the intended public GitHub repository with these files, then enable Pages and open the exact Pages URL in a private browser window. Replace the public URLs in the submission form only after the deployment contains this build. The old public repository URL is not proof that this new local candidate is already deployed.

See `PUBLISHING_CHECKLIST.md`, `SUBMISSION_COPY.md`, `DEMO_SCRIPT.md`, and `RELEASE_REPORT_v3.0.6.md` before submitting. The recorded release includes a SHA-256 manifest and file inventory; run `npm run manifest:build` after intentional source changes, then rerun `npm run verify:release`.


## Submission media warning (v3.0.5 review retained for v3.0.6)

The separate 15-page `OmNi-Ledger_Architecture.pdf` generated from Notebook is a concept/architecture visual, not the primary judge pitch deck. Some captions (including “Regulatory Instant Recall & 360° Traceability”) overstate the implemented scope and the final slide still contains a GitHub link placeholder. Use `PITCH_DECK.pdf` / `PITCH_DECK.pptx` as the primary deck unless the architecture PDF is revised and fact-checked.

The supplied `Forged_on_a_Smartphone.mp4` is a cinematic teaser; it does not demonstrate the running judge UI or show the live CLI result. Do not use it as the sole required video presentation. Record a real screen demonstration using `VIDEO_SCRIPT.md`, keeping live AMD CLI shots distinct from local browser fixtures.
