# Release report — OmNi-Ledger Judge Edition v3.0.8

## Change

This is a maintenance update on top of v3.0.7. The standalone `SUBMISSION_COVER.png` had the final letters of `PROPOSED TRACK / REINVENT COMMERCE` cross the right border. The badge was widened by 50 source pixels and the original rendered text was horizontally centered inside it. The proposed track and wording were not changed.

The edit is localized to the badge region (approximately x=91–597, y=855–922 in the 1920×1080 image); pixels outside that area are unchanged. The 16:9 and 3:2 photo-only artwork, application UI, pitch-deck PPTX, and pitch-deck PDF were not changed for this correction.

## Verification

- Package, lockfile, manifest generator, and evidence export version are synchronized at v3.0.8.
- The manifest builder now applies its documented hash exclusions consistently, including generated `TEST_LOG.txt`.
- `SUBMISSION_COVER.png` remains 1920×1080 RGB; exact text string and proposed-track wording verified.
- Automated tests: 181 passed, 0 failed; JavaScript syntax checks: 32/32; release gate, static build, CSP, HTTP safety smoke, and 90-file manifest: PASS.
- npm audit: 0 vulnerabilities; the package has no third-party npm dependencies.
- Detailed test and release-gate transcripts are recorded in `TEST_LOG.txt` and `VERIFY_LOG.txt`.
- The public site was not changed by this local package correction.

## Publication boundary

v3.0.8 has not been pushed to GitHub or deployed. The verified public baseline remains v3.0.6 until the repository owner publishes this package and confirms successful CI and Pages deployment. This release does not claim fresh live AMD inference.
