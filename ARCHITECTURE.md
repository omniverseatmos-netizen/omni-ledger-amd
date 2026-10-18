# Architecture and trust boundaries

## Design rule

Probabilistic extraction and operational authority are separate. The model outputs a proposed field set; strict validation maps it to known master data and real date/quantity constraints; the deterministic WMS decides whether the transaction can be posted.

## Layers

1. **Perception — AMD/Gemma.** `amd_omni_pipeline.mjs` sends invoice text through an OpenAI-compatible AMD-hosted endpoint from the local Node process. The API key is read from the process environment and is not sent to the browser.
2. **Input validation.** `validateExtraction()` requires a JSON object; exact known item and supplier codes; a real ISO date; positive integer quantity; and non-negative integer unit cost. Unknown or ambiguous SKUs are rejected instead of fuzzy-matched.
3. **Domain gate.** `OmNiCore` owns purchase orders, goods receipts, QC transitions, inventory ledger movements, sales orders, FEFO allocation, scan-verified picks, batch recall, and guarded dispatch.
4. **Evidence.** Core event/ledger hashing, audit verification, state hashes and Merkle-root seals make changes detectable within the modeled ledger. These are not encrypted data, a digital signature, an external timestamp, or a guarantee against a compromised runtime.
5. **Presentation.** `app.mjs` renders a fully English operator/judge interface over the actual domain core using fictional scenarios. It does not call the AMD endpoint.

## State transitions

- Receiving cannot post accepted inventory before the quality-control workflow completes.
- Batch and item mismatches can be hard-blocked at pick time.
- Active recalls are checked by allocation/picking/packing/dispatch logic and stock transfer. The selected-warehouse recall move creates quarantine movements in the ledger.
- Recall creation requires a reference, reason, and separate initiating/approving actors.
- Inventory balances derive from ledger entries rather than a mutable balance field.

## Why a secured CLI

A static public site cannot safely store a provider API key. The AMD request therefore runs server-side in Node/CLI, where the key is read from the shell environment. The judge UI communicates that boundary openly instead of pretending that a local fixture is a live model call.
