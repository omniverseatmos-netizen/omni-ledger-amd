# OmNi-Ledger: Deterministic Supply-Chain Auditor with Gemma on AMD

> AI-assisted invoice and procurement intake using Gemma 4 31B IT on AMD-hosted infrastructure, feeding a deterministic, policy-gated warehouse ledger with auditable SHA-256 and Merkle-root integrity records.

## Problem

Pharmaceutical warehouse teams process invoices and procurement documents that may contain expired batches, quantity mismatches, invalid items, or inconsistent costs. OmNi extracts structured fields from documents, then submits them to a deterministic policy engine before any inventory movement is accepted.

## How it works

1. Gemma extracts structured invoice fields.
2. The extraction result is validated against the OmNi schema.
3. OmNi applies deterministic checks for item identity, batch, expiry, quantity, cost, authorization, and idempotency.
4. Invalid documents receive a hard block with an explainable reason.
5. Valid documents create ledger events with SHA-256 and Merkle-root integrity records.
6. Human approval remains required for controlled operations.

## AMD and Gemma Usage

The inference workload runs through an AMD-hosted endpoint using ROCm-compatible infrastructure. The project records the model name, request metadata, structured output, and deterministic downstream decision without exposing API credentials.

Model:

- Google Gemma 4 31B IT

AMD technologies:

- AMD Developer Cloud or approved AMD-hosted endpoint
- AMD ROCm-compatible inference infrastructure

## Safety and limitations

- The language model does not directly modify inventory balances.
- The deterministic OmNi core makes the final accept/block decision.
- Human review is required for uncertain or high-risk cases.
- SHA-256 and Merkle-root records are tamper-evident integrity mechanisms, not legal signatures.
- The current prototype is not a production ERP or regulated accounting system.
- API keys must be supplied through environment variables and must never be committed.

## Run

```bash
npm install
npm test
node amd_omni_pipeline.mjs
