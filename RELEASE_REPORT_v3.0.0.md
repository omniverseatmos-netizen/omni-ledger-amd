# Release report — OmNi-Ledger Judge Edition 3.0.0

## Delivered surface

- English judge-facing single-page application with six views: Overview, Invoice Intake, Recall Control, Batch Trace, Audit Evidence, and Architecture.
- Existing deterministic warehouse core retained as a shared module, with explicit date-format and recalled-transfer guards.
- Batch recall demo powered by actual domain methods, not UI-only hard-coded outcomes.
- Secure-by-default live inference CLI for an AMD-hosted OpenAI-compatible endpoint; no API key in browser assets.
- GitHub Actions verification and Pages deployment workflows, static site build, SHA-256 manifest and file inventory.
- English submission copy, pitch deck (PPTX + PDF), cover artwork and demonstration script.

## Automated verification

The release verification gate includes eight original regression suites and ten Judge Edition Node tests (185 individual tests/checks in total: 175 across the eight original regression suites plus ten Judge Edition tests), module syntax checks, static Pages build, local HTTP security/asset smoke, release-manifest hashing, and valid/expired offline pipeline fixtures.

The offline fixture pipeline explicitly reports `OFFLINE_FIXTURE_NOT_LIVE`; it does not claim to contact AMD. The live pipeline requires the user’s account credential and a currently available model name.

## Fixes in this candidate

- Cairo-local date creation uses `formatToParts()` to produce a stable `YYYY-MM-DD`, avoiding reliance on the locale's rendered order.
- Transfer attempts for recalled batches now throw `RECALLED_BATCH` before posting any transfer entry; a regression test checks that the ledger remains unchanged.
- UI and export language is English; scope notes state batch-level traceability and its known boundaries.
- Static server rejects methods other than GET/HEAD, blocks hidden files and source-only paths, and prevents path traversal.

## Verification not performed here

- **Live AMD/Gemma inference was not run** because this build environment does not contain the user's private AMD credential or account-specific model entitlement.
- **The new Pages deployment was not published** from this environment; the package includes a GitHub Actions workflow to build and deploy it after upload to the target repository.
- **Full visual end-to-end browser review remains a manual step.** The headless Chromium process timed out in this environment. All six view templates passed a DOM-level render smoke test, the local static HTTP server passed its safety/asset smoke, and the pitch deck was exported to PDF and visually checked.
- No patient-level/downstream sub-pharmacy/individual GS1 traceability, production multi-user test, external timestamp authority, legal digital signature, regulator validation, or professional penetration test is claimed.

## Release decision

The local package is ready for the user to inspect and publish as a new submission candidate after a real account-level AMD inference run, final browser test, and exact URL/commit confirmation. It must not be described as already deployed or as live AMD-verified until those steps are completed.


> **Correction (added in 3.0.3):** the 175/185 counts above were miscounted; see RELEASE_REPORT_v3.0.3.md for the verified totals.
