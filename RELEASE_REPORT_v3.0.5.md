# Release report — OmNi-Ledger Judge Edition v3.0.5

**Release type:** documentation and submission-readiness update on v3.0.4. No application/domain behavior changed.

## Verification performed in this environment

- `npm test`: PASS — 180 checks total (168 regression checks + 12 judge acceptance tests), zero failures.
- `npm run verify:release`: PASS.
- ES module syntax: 32/32.
- Static GitHub Pages build: PASS.
- HTTP safety smoke: PASS (8 public assets, security headers, method guard, dotfile guard, path traversal guard).
- Offline valid/expired fixtures: PASS; clearly labelled offline, not live inference.
- SHA-256 manifest: PASS — 81 manifested files at the v3.0.4 baseline; manifest rebuilt for v3.0.5 and final count is recorded in `VERIFY_LOG.txt`.

## Supplied evidence, not independently re-run here

The four AMD Token Factory runs in `LIVE_RUN_EVIDENCE.md` and `evidence/live-amd-run/` were captured by the project owner in Termux. This environment does not have the private account key, so live inference was not re-run. Do not expose the key in the repository or video.

## Submission-media review

- `PITCH_DECK.pdf` / `.pptx` is the compact 8-slide judge pitch deck and is the recommended primary deck after the owner confirms its final rendering.
- The separately supplied 15-page `OmNi-Ledger_Architecture.pdf` is a visually rich, image-based Notebook export, but it contains scope-risk phrases such as “Regulatory Instant Recall & 360° Traceability” and ends with a GitHub link placeholder. Do not submit it as the primary deck until corrected. Its text is rasterized, so correction requires editing the Notebook/source and regenerating the PDF, not a safe text patch.
- `Forged_on_a_Smartphone.mp4` is approximately 79.8 seconds, vertical 720×1280, and visually a cinematic teaser. It does not show the actual app workflow or the live CLI result. It may be used as supplemental branding only; record the required proof video from `VIDEO_SCRIPT.md`.

## Remaining release gates

1. Publish the exact v3.0.5 source contents to the public repository and confirm CI and Pages deployment succeed.
2. Open the exact deployed URL in a private browser; test all six views and JSON/CSV/HTML downloads at mobile and desktop sizes.
3. Record and replay a real product demo: live AMD CLI valid + expired run, then clearly labelled local UI recall/trace/audit walkthrough.
4. Confirm final video URL, repository URL, demo URL, cover and primary 8-slide deck in the submission form. Save the submission confirmation.
5. Confirm event rules and track selection on the official form; no document can guarantee eligibility or a prize.

**Status:** software package passes local automated verification; public deployment, current browser visual acceptance, final product demo video, and submission-form completion are not verified by this release report.
