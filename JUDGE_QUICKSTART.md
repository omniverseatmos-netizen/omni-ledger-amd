# Judge quickstart — AtMoS v3.5.5 + Levenshtein

## Start the local judge workspace
From the project root, run `npm ci` (Node.js 20+) then `npm run serve`, and open `http://127.0.0.1:4173`. The browser demo is deterministic, uses fictional records, and does not call AMD on page load.

## Demo sequence
1. **Levenshtein match lab:** enter `Amoxcillin 500mg`. Inspect the suggested `Amoxicillin 500mg` at distance 1 and the dynamic-programming matrix. It is a suggestion only; no stock or ledger write happens.
2. **Invoice intake:** choose `Expired batch — should be blocked`, click **Run deterministic gate**, confirm `EXPIRED_GOODS`.
3. **Recall control:** run **Execute recall walkthrough**, confirm the synthetic 70-box quarantine and the `RECALLED_BATCH` pick block.
4. **Batch trace:** inspect supplier receipt and previously recorded dispatch. Scope ends at recorded warehouse dispatch.
5. **Audit evidence:** confirm the three integrity checks and export the Judge Evidence Pack. Hashes are not encryption or a legal signature.

## Run the focused algorithm tests
`node --test tests/levenshtein.test.mjs`

## Boundaries
All demo records are fictional. The matching screen uses a tiny synthetic candidate list and has no automatic accept threshold; similarity does not establish medication identity. This is a technical-evaluation prototype, not production-certified software. It does not provide patient-level/individual GS1 traceability. The browser demo is not a live AMD/Gemma call. Never put API keys into browser code.

The deployment bundle is produced from `public/` after `npm run build:site`; internal documents, fixtures, and keys are not part of that public site bundle.
