# Release report — OmNi-Ledger Judge Edition v3.0.6

**Release type:** targeted evidence-export feature; deterministic warehouse-domain logic unchanged.

## Change

The Audit Evidence view now includes a one-click Judge Evidence Pack export. It bundles the currently selected local invoice result, independent valid/expired reference checks, complete recall/audit/ledger payloads, state seal, event CSV, readable trace HTML, explicit local-demo provenance, known limitations, and six computed integrity/control outcomes. Standalone exports remain available.

## Verification

- Full package test suite: PASS — 181 checks total (168 regression checks + 13 judge acceptance tests), zero failures.
- Static site build: PASS — nine runtime files copied into `public/`.
- Release gate also checks syntax, required assets/UI wiring, HTTP guards/security headers, offline valid/expired pipeline fixtures, and the SHA-256 release manifest. The final `VERIFY_LOG.txt` records the exact gate output.
- The new evidence export is covered by an automated UI acceptance test that verifies provenance, reference checks, recall denial, ledger/audit payloads, limitations, and JSON download.

## Not independently verified here

Live AMD inference requires the project owner's private API key and account/model availability; release verification intentionally does not make a live request. The public deployment URL, browser appearance on the target phone, contest upload and submission confirmation must still be checked by the owner.

## Submission notes

Use the 8-slide `PITCH_DECK.pdf` / `.pptx` as the primary deck after checking final rendering. The supplied vertical MP4 is a cinematic teaser and is not a product walkthrough. Record the actual live CLI proof and local browser recall workflow separately, following `VIDEO_SCRIPT.md`.
