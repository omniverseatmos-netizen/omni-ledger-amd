# Changelog — OmNi-Ledger Judge Edition 3.0.3

## Corrections
- **Test count corrected.** Earlier reports said 175 regression checks / 187 total. Re-counting the actual suite output gives 168 (eight suites: 83+19+14+9+4+18+9+12) plus 12 judge-edition tests = **180**, all passing. `build-manifest.mjs`, the manifest and the submission copy now use 180; earlier reports carry a correction note.

## Added
- `LIVE_RUN_EVIDENCE.md` and `evidence/live-amd-run/` — the owner's captured live CLI runs (valid → ACCEPTED, expired → BLOCKED EXPIRED_GOODS), with an explicit list of what they do and do not prove.
- `VIDEO_SCRIPT.md` — timed shot list, hidden-key Termux setup, compact live-output commands.
- Rewritten `SUBMISSION_COPY.md` (copy-ready, claims limited to what the package supports) and a submission-day order in `PUBLISHING_CHECKLIST.md`.
- `SCOPE_AND_LIMITATIONS.md` updated: live run recorded; accelerator/stack not confirmed by the response.

## Unchanged
- Warehouse core, UI and deck from 3.0.2.
