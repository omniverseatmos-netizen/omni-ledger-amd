# Submission publishing checklist

## Before upload

- [ ] `npm test` passes from a fresh extraction of this package.
- [ ] `npm run verify:release` passes.
- [ ] `npm run amd:live` is run from the account's private local shell with a valid key and exact available model name; keep the key off recordings.
- [ ] `npm run amd:expired` produces the expected `EXPIRED_GOODS` hard block from the live extraction fixture, or the demo explicitly distinguishes a local negative control from the live model request.
- [ ] The Recall Control scenario reports 70 boxes quarantined, 30 boxes previously dispatched, and a `RECALLED_BATCH` block for the scripted open order (fictional sample quantities).
- [ ] The one-click Judge Evidence Pack downloads and contains local-only provenance, current invoice result, recall/audit data, CSV, readable HTML, and integrity-check results.
- [ ] Individual audit JSON, event CSV, and readable HTML exports still download and open correctly.
- [ ] The contest submission cover image `SUBMISSION_COVER.png` and `PITCH_DECK.pptx` / `PITCH_DECK.pdf` are uploaded.
- [ ] The 15-page Notebook architecture PDF is not used as the primary deck unless its overclaims and final link placeholder are corrected.
- [ ] The final video contains the actual UI and genuine live CLI proof; the cinematic teaser alone is insufficient.
- [ ] Open the page at mobile and desktop sizes; check overflow, navigation, focus visibility, and console errors.

## Publish

1. Create a new public repository or deliberately replace the prior repository's contents after backing it up. Do not upload a ZIP containing `.env` or secrets.
2. Upload the **contents** of this folder to the repository root (`index.html`, `app.mjs`, `domain.mjs`, `styles.css`, `.github/`, `assets/`, and source/tests/docs).
3. Set the repository default branch to `main`; the included Pages workflow builds a minimal `public/` site and deploys it. Under repository Settings → Pages, select **GitHub Actions** if prompted.
4. Wait for both **OmNi-Ledger verification** and **Deploy English Judge Edition** GitHub Actions workflows to complete successfully.
5. Open the exact deployed Pages URL in a private browser window and test Overview → Invoice Intake → Recall Control → Batch Trace → Audit Evidence.
6. Verify JSON/CSV/HTML report downloads.
7. Set the exact repository URL and live demo URL in the submission only after the deployed files are confirmed.
8. Upload the cover image and pitch deck; submit the final video URL.
9. Save the final commit SHA, CI result, live inference response ID if present, and a copy of the submission confirmation.

## Do not claim without current proof

- Live AMD/Gemma use in a run where only fixture mode was used.
- A specific model deployment/accelerator unless confirmed by the response/account.
- 100% safety, zero hallucinations, production readiness, regulatory approval, patient-level traceability, or guaranteed prize eligibility/winning.

## Submission-day order (deadline 18 Oct 2026, 1:00 PM EEST — aim to finish by 11:30)
- [x] Live valid + expired runs captured (see `LIVE_RUN_EVIDENCE.md`).
- [ ] Unzip v3.0.7, run `npm ci`, `npm test` and `npm run verify:release` once more.
- [ ] Push the package contents to the public repository; confirm both GitHub Actions workflows are green.
- [ ] Open the Pages URL in a private window; test all six pages, the one-click evidence pack, and the three individual exports; test the Menu button on the phone.
- [ ] Record, play back and upload the video (unlisted); test the link logged out.
- [ ] Fill the form from `SUBMISSION_COPY.md`; attach cover, deck and video; save the confirmation.
- [ ] Re-open the submission after sending and confirm every link opens.
