# Final submission gate — OmNi-Ledger

## Recommended submission package

- **Project:** OmNi-Ledger: Deterministic Supply-Chain Control with Gemma on AMD
- **Primary slides:** `PITCH_DECK.pdf` or `PITCH_DECK.pptx` (8 slides).
- **Cover:** `SUBMISSION_COVER.png`.
- **Repository/site:** publish the exact contents of this release, then verify both URLs in a private browser.
- **Video:** record a new 100–115 second real product walkthrough using `VIDEO_SCRIPT.md`. The supplied `Forged_on_a_Smartphone.mp4` is only a cinematic teaser.
- **Technical evidence:** `LIVE_RUN_EVIDENCE.md` and `evidence/live-amd-run/` (owner-captured; not rerun by this package builder).

## Do not submit without correcting

The separate Notebook-generated `OmNi-Ledger_Architecture.pdf` should not be the main presentation in its current form. It includes “Regulatory Instant Recall & 360° Traceability,” which conflicts with the stated prototype scope (batch-level tracing only through recorded warehouse dispatch), and a final slide with `GitHub Repo [Link Placeholder]`. It also describes future roadmap concepts that are not implemented. If retained as optional background, label it as a conceptual architecture/roadmap, correct those phrases, and replace the placeholder first.

## Product story to repeat consistently

**AI reads. Deterministic rules decide. Evidence makes the outcome reviewable.**

1. Real live CLI request to AMD Token Factory: valid fictional invoice → `ACCEPTED`.
2. Real live CLI request to AMD Token Factory: expired fictional invoice → `BLOCKED / EXPIRED_GOODS`.
3. Browser UI local scenario: recall, 70 remaining boxes quarantined, 30 prior boxes dispatched to a recorded customer, and a new pick blocked with `RECALLED_BATCH`. Clearly say the browser scenario is local and not a live model request.
4. Audit evidence: show chain/seal verification and exports; state that hashes are tamper-evident integrity checks, not encryption or legal signatures.

## Final checklist

- [ ] `npm test` and `npm run verify:release` pass from a fresh extraction.
- [ ] No `.env`, API key, private account data, or shell history is included in the public repository/video.
- [ ] GitHub repository is public and contains this exact release.
- [ ] GitHub Actions verification and Pages deployment both pass.
- [ ] Private-window browser check passes on phone and desktop.
- [ ] One-click Judge Evidence Pack opens as valid JSON, includes explicit local-demo provenance, both invoice reference checks, recall denial, hash checks, CSV and readable HTML.
- [ ] Individual audit JSON, CSV, and HTML downloads open and contain readable report data.
- [ ] Video shows actual UI and actual live CLI outputs, with no misleading splices.
- [ ] Primary 8-slide deck and cover image are uploaded.
- [ ] Track, tags, eligibility and deadline confirmed in the live official submission form.
- [ ] Submission confirmation saved; every link re-opened and checked.

No checklist or test suite can guarantee a winning result. The goal is a technically credible, easy-to-verify, honest submission.
