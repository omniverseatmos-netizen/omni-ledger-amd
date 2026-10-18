# Judge demo script (target: 110–125 seconds)

Use real execution for every claim. If a live model response is not available, state that clearly; never present an offline fixture as an AMD inference call.

## 0–8 s — Open with the control boundary

**On screen:** English Judge Edition overview.

**Voice-over:** “OmNi-Ledger separates AI-assisted invoice understanding from the authority to change stock. The model may propose; deterministic rules decide.”

## 8–25 s — Prove AMD/Gemma inference

**On screen:** a private terminal with the real `npm run amd:live` execution. Keep API keys, shell history containing secrets, account IDs, and private values off-screen. Show the endpoint host, returned model/request ID if available, extraction fields, and the deterministic decision.

**Voice-over:** “Gemma extracts structured supplier-invoice fields through an AMD-hosted endpoint. The key stays in the local process; the result is untrusted input until validation passes.”

## 25–42 s — Expired-batch hard block

**On screen:** run `npm run amd:expired` or the website's clearly labelled local negative-control fixture. Prefer the live CLI run when demonstrating the extraction step; the website fixture can then show the same core behavior independently.

**Voice-over:** “An expired batch is rejected by the domain control. It cannot become available stock simply because the extraction succeeded.”

## 42–78 s — Batch recall walkthrough

**On screen:** Recall Control. Show the recall reference and reason; run the scenario; point to the 70-box quarantine result, the previously recorded 30-box customer dispatch, and the `RECALLED_BATCH` hard block on a pre-allocated pick.

**Voice-over:** “When a recall is issued, remaining available stock in the selected warehouse is quarantined. The trace links the recorded supplier receipt, current warehouse status, and prior customer dispatch, while the next pick is blocked.”

## 78–100 s — Audit evidence

**On screen:** Batch Trace and Audit Evidence. Show the real trace, event hashes, and passing local chain/seal checks; export JSON/CSV if time permits.

**Voice-over:** “The decision leaves reviewable evidence. The hashes are tamper-evident integrity checks—not encryption or a legal signature.”

## 100–118 s — Founder and mission

**On screen:** pitch deck title/final slide.

**Voice-over:** “Built by a solo founder in Egypt through a phone-first, resource-constrained workflow, OmNi-Ledger focuses on transparent, accountable operations. The goal is to make AI-assisted supply-chain work safer to inspect—not to give a model unchecked authority.”

## Recording checklist

- Use fictional demonstration records only.
- Turn off shell history indicators and do not expose any secret, session cookie, or personal email.
- Verify the exact model name in the account's AMD catalog before recording.
- Show live endpoint details only if the request genuinely succeeded.
- When using a browser fixture, leave its `DEMO / NOT LIVE MODEL` label visible.
- Do not claim patient-level traceability, multi-warehouse full quarantine, regulatory approval, or production readiness.
