# Release report — OmNi-Ledger Judge Edition 3.0.3

Base: 3.0.2. Changes: test-count correction, live-run evidence, video script, submission copy, checklist.

## Verified in the build environment (Node 22, Linux)
- `npm test`: PASS — 168 regression checks (8 suites) + 12 judge tests = 180.
- `npm run verify:release`: PASS (module syntax, static build, HTTP safety smoke, SHA-256 manifest).

## Supplied by the owner, not re-run here
- Live AMD endpoint runs for the valid and expired scenarios (`LIVE_RUN_EVIDENCE.md`).
- Termux test and serve runs on the owner's phone.

## Not verified
- Accelerator/stack behind the endpoint; whether the endpoint counts as the hackathon's approved AMD infrastructure (confirm on the event page/Discord).
- Deployed GitHub repo/Pages URL, the final video, PowerPoint rendering, a real phone browser beyond the owner's runs.
