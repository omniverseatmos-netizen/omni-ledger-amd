# Release report — OmNi-Ledger Judge Edition 3.0.1

## Delivered surface

- English judge-facing single-page application with six views: Overview, Invoice Intake, Recall Control, Batch Trace, Audit Evidence, and Architecture.
- The deterministic warehouse domain core and its existing recall/date guards remain unchanged in this usability patch.
- Audit Evidence now visibly exposes all three documented export formats: JSON, CSV, and readable HTML.
- Automated UI tests verify all three actions are visible, invoke the real delegated handlers, inspect the generated download payloads, and confirm valid JSON, CSV, and HTML output.
- On narrow screens, evidence export controls may wrap onto additional rows instead of overflowing the header.
- Secure-by-default AMD-hosted inference CLI, offline valid/expired fixtures, GitHub Actions workflows, static-site build, SHA-256 manifest and inventory remain included.
- English submission copy, pitch deck (PPTX + PDF), cover artwork, demo script and publishing checklist remain included.

## Automated verification

The release gate runs eight original regression suites (175 checks) plus twelve Judge Edition Node tests, for 187 individual tests/checks in total; it also syntax-checks ES modules, builds the static Pages site, checks local HTTP asset/security behavior, validates the release manifest, and runs the valid/expired offline inference fixtures.

The offline fixture pipeline reports `OFFLINE_FIXTURE_NOT_LIVE` and does not claim to contact AMD. The live CLI requires the user's private account credential and a currently available model name.

## Fix in 3.0.1

The HTML trace-report generator and action handler existed in 3.0.0, but Audit Evidence did not render a button bound to `download-html`. The export is now reachable from the UI and covered by a smoke test.

## Verification boundaries

- Live AMD/Gemma inference was not run because the environment does not contain the user's private AMD credential or account-specific model entitlement.
- No Pages deployment was published from this environment. The repository includes a GitHub Actions workflow to deploy after upload to the target repository.
- A full visual browser review remains incomplete: headless Chromium timed out in this environment. DOM-level UI tests and the local HTTP security/asset smoke passed. Open the page at mobile and desktop sizes before final submission.
- No patient-level/downstream sub-pharmacy/individual GS1 traceability, production multi-user test, external timestamp authority, legal digital signature, regulator validation, or professional penetration test is claimed.

## Release decision

The local 3.0.1 package passes the automated release gate and is ready for human visual review. Do not describe it as deployed or live AMD-verified until those separate steps have genuinely completed.


> **Correction (added in 3.0.3):** the "175 checks / 187 total" figures above were miscounted. Re-counting the suite output gives 168 checks across the eight regression suites plus 12 Judge Edition tests = 180 in total, all passing.
