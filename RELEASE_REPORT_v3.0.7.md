# Release report — OmNi-Ledger Judge Edition v3.0.7

**Release type:** maintenance update to packaging, static-page defense in depth, and release accuracy. Warehouse-domain behavior is unchanged.

## Changes

- Added `package-lock.json`; `npm ci` now succeeds. The package has no third-party npm dependencies.
- Added a restrictive meta Content Security Policy to both static entry pages and a release-gate assertion for the source and built English entry.
- Corrected release and submission wording so the verified public v3.0.6 baseline is not confused with this v3.0.7 package.
- Updated the eight-slide deck's engineering-honesty card. It now states that the public v3.0.6 baseline was verified, while a fresh owner-run live AMD request is still needed before recording.

## Verification

- Clean install: `npm ci` — PASS.
- Dependency audit: 0 vulnerabilities reported; no third-party dependency packages.
- Full package suite: **181 checks passed, zero failures** (168 regression checks + 13 judge acceptance tests).
- Release gate: PASS — 32/32 JavaScript modules syntax-checked, static site built, CSP checked, offline valid/expired fixtures passed, HTTP safety smoke passed, and SHA-256 manifest verified.
- Release manifest: 89 hashed files; inventory and file sizes verified.
- Browser: 390 CSS-pixel viewport, no horizontal overflow, evidence-export view loaded, no browser runtime/console errors.
- Pitch deck: 8 slides. The final PDF's seven unchanged slides are pixel-identical to v3.0.6; slide 7's stale deployment wording was corrected. PPTX text and slide count match the PDF.

## External state and remaining owner checks

- Public baseline confirmed at `70c0217d0283a0bdf06958a657b31fe74936bdb8`; repository and Pages were available, and CI verification, Pages build, and Pages deployment succeeded for that commit.
- **v3.0.7 has not been pushed or deployed.** The live URL still serves v3.0.6 until the owner commits this package and the Pages deployment completes.
- Live AMD inference was not run in this audit because it requires the owner's private event-account credential and model availability. Existing live-run records are owner-captured evidence, not a fresh v3.0.7 run.
- Contest-form submission, selected track, video upload, eligibility, and submission confirmation were not accessed or verified here.

This is a release-readiness check, not a professional penetration test, regulatory validation, or guarantee of contest outcome.
