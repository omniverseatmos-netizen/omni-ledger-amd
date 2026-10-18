# Submission copy — OmNi-Ledger (copy-ready, v3.0.10)

Every claim below is backed by something in this package. Do not add claims that are not.

## Project title
**OmNi-Ledger: Deterministic Supply-Chain Control with Gemma on AMD**

## Track
**Reinvent Commerce** — frame this as a controlled inventory and procurement workflow for pharmaceutical merchants: supplier invoice → accepted stock → customer dispatch → recall response. The demo proves operational controls and traceability for recorded customer orders; it does not claim customer churn prediction or revenue optimisation. Confirm the track and eligibility in the official submission form.

## Short description (copy)
Gemma on AMD Token Factory reads supplier invoices; a deterministic warehouse core—not the model—decides what may enter, move or leave stock. In the demo recall, 70 boxes are quarantined, 30 earlier-dispatched boxes trace to a recorded customer, and the next pick is hard-blocked, with hash-chained evidence for every decision.

## Long description (copy)
**The problem.** In pharmaceutical distribution, a plausible-looking invoice extraction can still carry the wrong SKU, batch, expiry date or quantity. An alert is not a control: an expired or recalled batch must be stopped before it becomes available stock, and a recall must identify what remains and which recorded customer orders were affected.

**What we built.** OmNi-Ledger separates *reading* from *deciding*. Gemma extracts structured fields from invoice text through an AMD-hosted endpoint. That output is treated as untrusted input: it is validated against a strict schema and an approved item/supplier catalogue, then passed to a deterministic warehouse state machine. The model never writes inventory balances.

**Controls implemented in the core:** expiry hard block at receiving, QC-gated posting, integer quantities, FEFO allocation, scan-verified picking, separation of duties for recalls, selected-warehouse quarantine, recalled-batch guards, and a batch-level trace from recorded supplier receipt to recorded customer dispatch. Ledger movements and audit events are SHA-256 hash-chained, and a state hash with a Merkle-root seal can be verified. These are tamper-evident integrity checks — not encryption and not a legal signature.

**Live proof.** The live CLI was run several times against AMD Token Factory (AMD Radeon Cloud) using the team key issued for the event, on two fictional invoices (request IDs in `LIVE_RUN_EVIDENCE.md`): the valid invoice was ACCEPTED and the expired one was BLOCKED with `EXPIRED_GOODS` by the deterministic core, with ledger, audit chain and state seal verified. The gateway reported the model as `self-dploy/Gemma-4-31B-IT`; AMD's catalog lists Gemma-4-31B-IT (experimental) among its free endpoints running on AMD GPUs.

**Quality.** The v3.0.6 feature release adds a one-click judge evidence pack with explicit local-versus-live provenance and six computed acceptance/integrity checks, alongside the existing individual JSON/CSV/HTML exports. The v3.0.7 maintenance release adds a public-page CSP, a clean-install lockfile, and corrected verification wording. The v3.0.8 maintenance release repairs the standalone submission-cover badge without changing its wording or track. The current test count and release-manifest result are recorded in `RELEASE_REPORT_v3.0.8.md` and `VERIFY_LOG.txt`.

**Honest scope.** A technical-evaluation prototype with fictional data. Tracing is batch-level and ends at recorded warehouse dispatch; patient-level, sub-pharmacy and serial-level tracking, customer returns, multi-user concurrency and regulatory validation are not implemented. The public judge page runs deterministic local scenarios and does not call AMD; live extraction runs in the CLI shown in the demo video.

**Origin.** Built by a solo developer in Egypt through a phone-first workflow (Termux). The owner-provided evidence records successful live requests to AMD Token Factory; the public browser demo remains deterministic and offline.

## Technology tags
Select what you can support: **Token Factory**, **Gemma**, **Node.js**, **AI/ML**, **Supply Chain**. Tick *AMD Developer Cloud* only if you consider Token Factory part of it and the form offers no better match; do **not** tick ROCm / Instinct / MI300X, because the endpoint response does not confirm the stack.

## Links
- Public repository: `https://github.com/omniverseatmos-netizen/omni-ledger-amd` — confirm it is public and contains this package's contents (without any `.env` or key).
- Live demo URL: `https://omniverseatmos-netizen.github.io/omni-ledger-amd/index-en.html` — open it in a private browser window after deployment and test every page.
- Video: use a newly recorded, unlisted product walkthrough made from `VIDEO_SCRIPT.md`; the supplied `Forged_on_a_Smartphone.mp4` is a cinematic teaser and does not demonstrate the actual UI or live CLI.
- Cover image: `SUBMISSION_COVER.png`
- Pitch deck: `PITCH_DECK.pptx` (or `PITCH_DECK.pdf`)
- Evidence: `LIVE_RUN_EVIDENCE.md`, `evidence/live-amd-run/`

Do not submit old URLs that point to a different UI build or an unrelated repository.
