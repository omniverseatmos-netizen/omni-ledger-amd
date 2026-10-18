# Changelog — Judge Edition 3.0.0

## Added

- A full English, responsive judge workspace designed around Overview, Invoice Intake, Recall Control, Batch Trace, Audit Evidence, and Architecture.
- Interactive scenarios powered by the actual OmNi domain module rather than UI-only fabricated outcomes.
- A batch-recall walkthrough that records a prior customer dispatch, quarantines remaining selected-warehouse stock, and verifies the attempted post-recall pick is blocked.
- JSON, CSV and readable HTML evidence exports.
- A secure CLI path for optional live AMD-hosted Gemma extraction; no model key is present in the browser.
- Strict extraction validation, offline/negative-control fixtures, nine judge-edition acceptance tests, a release verification script, and English judge materials.

## Correctness hardening

- Cairo-local ISO date output now uses `Intl.DateTimeFormat(...).formatToParts()` instead of assuming the runtime's `en-CA` display order is ISO.
- Transfer of a batch under active recall is rejected with `RECALLED_BATCH`; a regression test verifies that the rejected transfer writes no ledger rows.
- UI wording explicitly distinguishes offline fixtures from live AMD inference and states current traceability limits.

## Not claimed

No claim is made that a live AMD request was executed in this environment, that the newly built candidate has already been published to GitHub Pages, or that the prototype is production/regulatory certified.
