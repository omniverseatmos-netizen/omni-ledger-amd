# OmNi-Ledger: Deterministic Supply-Chain Auditor with Gemma on AMD

> AI-assisted invoice and procurement intake using Gemma 4 31B IT on an AMD-hosted inference endpoint, feeding a deterministic, policy-gated warehouse ledger with auditable SHA-256 and Merkle-root integrity records.

## Problem

Pharmaceutical warehouse teams process invoices and procurement documents that may contain expired batches, quantity mismatches, invalid items, or inconsistent costs. OmNi extracts structured fields from an invoice, then submits them to a deterministic policy engine before an inventory movement is accepted.

## How it works

1. `amd_omni_pipeline.mjs` sends an invoice to an OpenAI-compatible AMD endpoint.
2. Gemma returns a small JSON extraction: item code, batch, quantity, unit price, and expiry date.
3. OmNi validates the extraction and applies deterministic checks for item identity, batch, expiry, quantity, authorization, and idempotency.
4. Invalid documents receive a hard block with an explainable domain error.
5. Valid documents create ledger events and a verifiable SHA-256 audit chain plus state seal.
6. The model never writes inventory balances directly; controlled operations remain human-gated.

## AMD and Gemma usage

The pipeline is configured for an OpenAI-compatible endpoint supplied by the AMD event environment. The default base URL is:

```text
https://developer.amd.com.cn/radeon/api/v1
```

The model name defaults to `Gemma-4-31B-IT` and can be overridden with `AMD_MODEL` when the event endpoint exposes a different exact identifier. The runtime records non-secret request metadata such as HTTP status, model, request ID when provided, and latency.

Do not infer hardware or prize eligibility from the model name alone. Keep the redacted terminal output or event-platform evidence that proves the request was served by the AMD environment.

## Requirements

- Node.js 18 or newer.
- An AMD event/API token supplied through an environment variable for the live pipeline.
- No API key is required to run the deterministic tests.

## Run from a clean clone

```bash
git clone https://github.com/omniverseatmos-netizen/omni-ledger-amd.git
cd omni-ledger-amd
npm test
npm run check
```

To run the live AMD/Gemma demo:

```bash
export AMD_TOKENFACTORY_API_KEY='your-token-from-the-event-environment'
node amd_omni_pipeline.mjs
```

Optional environment variables:

```bash
export AMD_BASE_URL='https://developer.amd.com.cn/radeon/api/v1'
export AMD_MODEL='Gemma-4-31B-IT'
export AMD_REQUEST_TIMEOUT_MS='90000'
export OMNI_TODAY='2026-10-17'
```

Never commit tokens, `.env` files, terminal captures containing authorization headers, or private account information.

## Test coverage

The repository contains deterministic tests for the warehouse core, FEFO, recall, LASA blocking, quality control, institutional ledger controls, idempotency, audit integrity, state bundles, closure gates, and shadow reports. Run the complete suite with:

```bash
npm test
```

## Safety and limitations

- The language model does not directly modify inventory balances.
- The deterministic OmNi core makes the final accept/block decision.
- Human review is required for uncertain or high-risk cases.
- SHA-256 and Merkle-root records are tamper-evident integrity mechanisms, not legal signatures.
- The current repository is a tested prototype, not a production ERP, regulated accounting system, or multi-user transactional backend.
- The live pipeline requires the event endpoint and network access; it is not an offline claim.
- Actual AMD service usage, model routing, and partner-prize eligibility must be demonstrated with event-platform evidence and remain subject to the official rules.

## Submission track

The closest primary story is inventory and procurement workflow automation. The project may also be presented as healthcare supply-chain safety when the demo emphasizes expiry, LASA, FEFO, quality control, and recall without making diagnosis or treatment claims.
