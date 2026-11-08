# Judge demo script — 110–125 seconds (v3.5.5 + Levenshtein walkthrough)

Every displayed record is fictional. The browser workspace runs the deterministic demo locally and does not call AMD. The live AMD/Gemma CLI is a separate optional path; show it only if a genuine, authorized run succeeds, with secrets kept off-screen.

## 0–8 s — State the boundary
**On screen:** AtMoS overview.
**Say:** “AtMoS lets AI help read operational documents, but model output never gets authority to change inventory. Deterministic rules decide.”

## 8–28 s — Make the algorithm visible
**On screen:** Open **Levenshtein match lab**. Type `Amoxcillin 500mg`; point to the top suggestion `Amoxicillin 500mg`, distance 1, and the highlighted bottom-right cell in the matrix.
**Say:** “The pitch names Levenshtein; here you can inspect the actual edit-distance calculation. It proposes a candidate only. Similarity is not identity: no automatic drug selection, and no stock write. A person verifies strength, form, batch and expiry before the control gate.”

## 28–48 s — Show an irreversible-risk boundary
**On screen:** Invoice intake → expired fixture → Run deterministic gate.
**Say:** “Even if a name looks close, the deterministic gate checks the operational facts. This expired batch is blocked with `EXPIRED_GOODS`; it cannot become available stock.”

## 48–80 s — Recall and containment
**On screen:** Recall Control → Execute recall walkthrough → show quarantine and blocked pick.
**Say:** “The scenario records 30 previously dispatched boxes, quarantines 70 remaining boxes in the selected warehouse, and blocks the next pick with `RECALLED_BATCH`. These quantities are fictional demo records.”

## 80–100 s — Evidence
**On screen:** Batch Trace → Audit Evidence.
**Say:** “The event chain and state seal are inspectable. Hashes provide tamper-evident checks; they are not encryption or a legal signature. Traceability ends at recorded warehouse dispatch—not at an individual patient.”

## 100–120 s — Honest close and ask
**On screen:** final pitch slide.
**Say:** “This is a tested technical-evaluation prototype, not production-certified software. Our next step is one approved, measured pilot with a design partner: baseline first, shadow mode, then a decision based on evidence. What is the smallest workflow you would validate first?”

## Guardrails
- Levenshtein suggestions use fictional labels; no clinical or product identity decision is made.
- Do not claim production readiness, regulatory approval, patient-level or GS1 serial tracking, live AMD inference during the local demo, or production capacity.
- If showing synthetic workload figures, state they are deterministic synthetic fixture results, not production measurements, customer data, or SLOs.
- Never expose API keys, cookies, private emails, or shell history.
