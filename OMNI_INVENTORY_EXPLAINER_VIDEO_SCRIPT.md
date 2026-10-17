# OmNi-Ledger — Explainer and Demo Video Script

> **Format:** English voice-over and on-screen text for AMD / lablab / Gemma judges.
>
> **Recommended length:** 2 minutes 30 seconds to 3 minutes.
>
> **Visual rule:** every claim should be shown by a screen, a test result, a log line, or a repository file.

---

## Scene 0 — Cold open: the risk

**Duration:** 0:00–0:12

**Visual:** close-up of a procurement invoice. Highlight three fields: item, batch, expiry date. One expiry date is in the past. Then cut to a warehouse screen showing a blocked operation.

**Voice-over:**

> In a pharmaceutical warehouse, a small document error can become a real operational risk: an expired batch, a look-alike medicine, an over-received quantity, or an approval made by the wrong person.
>
> OmNi-Ledger is designed to make those decisions visible, deterministic, and auditable.

**On-screen text:**

```text
Critical inventory decisions need more than a prediction.
They need a decision boundary.
```

---

## Scene 1 — The product in one sentence

**Duration:** 0:12–0:25

**Visual:** animated flow diagram:

```text
Invoice text → Gemma on AMD → Structured JSON → OmNi policy gate → Ledger evidence
```

**Voice-over:**

> OmNi-Ledger uses Gemma 4 31B IT through an AMD-hosted inference endpoint to extract structured invoice data. But the model does not directly change inventory. Its output enters a deterministic OmNi core that checks whether the operation is allowed.

**On-screen text:**

```text
AI assists with extraction.
Deterministic rules control the operation.
```

---

## Scene 2 — Founder and mission

**Duration:** 0:25–0:42

**Visual:** show a simple timeline: Research → Architecture → Experiments → Tests → Prototype. Do not show private personal data. Show the public repository and phone-first development context only if comfortable.

**Voice-over:**

> OmNi-Ledger was created by a solo founder as a public-interest engineering project. Over approximately ten months, it was researched, designed, tested, and implemented through a highly resource-constrained, phone-first workflow.
>
> The goal was not to maximize transactions. The goal was to make critical operational decisions more transparent, more deterministic, and easier to audit.

**On-screen text:**

```text
One founder.
Approximately ten months.
A public-interest engineering mission.
```

**Production note:**

Do not say “the strongest project ever made,” “better than most projects,” or “guaranteed to win.” Let the evidence create the impression.

---

## Scene 3 — AMD and Gemma evidence

**Duration:** 0:42–1:00

**Visual:** show the terminal running:

```bash
node amd_omni_pipeline.mjs
```

Show only the safe portions of the output:

```text
Base URL: https://developer.amd.com.cn/...
Target Model: Gemma-4-31B-IT
status=200
latencyMs=...
requestId=...
```

Blur or crop all authorization headers and secrets.

**Voice-over:**

> The live pipeline sends the invoice text to the event-configured AMD endpoint. Gemma returns structured fields such as the item code, batch, quantity, unit price, and expiry date.
>
> The request evidence is shown without exposing credentials. The public repository keeps the token outside the codebase.

**On-screen text:**

```text
Credentials stay outside the repository.
Evidence stays reproducible and redacted.
```

---

## Scene 4 — The expired invoice is blocked

**Duration:** 1:00–1:22

**Visual:** show the extracted JSON:

```json
{
  "itemCode": "PARA-500",
  "batch": "BATCH-EXP-99",
  "qty": 50,
  "unitPrice": 1250,
  "expiryDate": "2024-01-01"
}
```

Then show the OmNi result:

```text
HARD BLOCK
EXPIRED_GOODS
```

**Voice-over:**

> The model has extracted the fields. Now the model stops being the decision-maker. OmNi checks the expiry date against the operational date and blocks the receipt before it can become inventory.

**On-screen text:**

```text
Extraction: AI-assisted
Decision: deterministic
Result: HARD BLOCK
```

---

## Scene 5 — The valid invoice is accepted

**Duration:** 1:22–1:42

**Visual:** show a second JSON object with a future expiry date. Then show purchase order approval, receiving, quality control, posting, and the new balance.

**Voice-over:**

> The second invoice contains a valid batch and a future expiry date. It passes the purchase-order relationship, receiving, quality control, authorization, and posting gates.
>
> The accepted operation becomes a ledger event — not an invisible database mutation.

**On-screen text:**

```text
VALID INVOICE
QC PASSED
LEDGER EVENT CREATED
```

---

## Scene 6 — Integrity evidence

**Duration:** 1:42–1:58

**Visual:** zoom into:

```text
Event Hash:  ...
Previous Hash: ...
Merkle Root:  ...
State Hash:   ...
```

Then open the English HTML proof report and the CSV file.

**Voice-over:**

> Each event participates in a SHA-256 audit chain. The state seal provides Merkle-root integrity evidence. These are tamper-evident records — not legal signatures and not a claim of encryption.
>
> The result can be exported as an HTML proof report or as CSV events for review.

**On-screen text:**

```text
Auditable evidence, not a black-box score.
```

---

## Scene 7 — English judge experience

**Duration:** 1:58–2:15

**Visual:** open:

```text
https://omniverseatmos-netizen.github.io/omni-ledger-amd/index-en.html
```

Click:

```text
Run the full deterministic demo
Download HTML proof report
Download event CSV
```

**Voice-over:**

> The English judge demo makes the workflow easy to inspect. It shows the hard block, the accepted operation, the event hash, the Merkle root, and downloadable evidence.
>
> The original Arabic operational console remains available for the Ibn Sina and Egypt-oriented warehouse context.

**On-screen text:**

```text
English judge demo
Arabic operational console
Same deterministic core
```

---

## Scene 8 — Feature tour

**Duration:** 2:15–2:42

**Visual:** quick cuts, one feature per 2–3 seconds:

1. FEFO allocation.
2. LASA mismatch block.
3. Segregation of duties.
4. Quality-control gate.
5. Recall and traceability.
6. Tote-bound picking.
7. Voice guidance that cannot change inventory.
8. Institutional accounting layer.
9. Shadow Mode report.
10. State export and import validation.

**Voice-over:**

> The same core extends beyond a single invoice. It supports first-expiry-first-out allocation, look-alike and sound-alike protection, separation of duties, quality-control gates, recall and traceability, tote-bound picking, read-only voice guidance, accounting controls, Shadow Mode reporting, and tamper detection during state import.
>
> Each feature is designed around the same boundary: suggestions may be assisted, but inventory-changing actions remain explicit and controlled.

**On-screen text:**

```text
FEFO · LASA · QC · Recall · Picking · Accounting · Audit
```

---

## Scene 9 — Tests and reproducibility

**Duration:** 2:42–2:55

**Visual:** show GitHub Actions green, then terminal:

```bash
npm test
```

Show:

```text
167 passed / 0 failed
```

**Voice-over:**

> This is a tested prototype rather than a production ERP. The public repository includes 167 automated tests across warehouse operations, quality control, recall, accounting controls, integrity, reporting, and state bundles. GitHub Actions reruns the checks on the public repository.

**On-screen text:**

```text
Public repository
167 automated tests
GitHub Actions: passing
```

---

## Scene 10 — Closing message and roadmap

**Duration:** 2:55–3:15

**Visual:** return to the architecture diagram, then show the roadmap as three columns:

```text
Now: tested prototype
Next: barcode + measured warehouse maps + connectors
Later: multi-warehouse governance and accountable analytics
```

**Voice-over:**

> OmNi-Ledger is not trying to make a language model the authority over a warehouse. It is trying to place useful AI inside a system that knows where AI should stop.
>
> Gemma reads the document. Deterministic rules decide whether the operation is valid. Human roles authorize sensitive actions. Integrity evidence records what happened.
>
> The next phase connects the same principles to barcode devices, measured warehouse maps, approved ERP connectors, multi-warehouse operations, and governance dashboards.

**Final on-screen text:**

```text
AI may assist.
Policy must decide.
People must authorize.
Evidence must remain.

OmNi-Ledger
```

---

## 11. Optional 60-second compressed version

If the submission portal requires a short video, use this edit:

- 0:00–0:07: problem and title.
- 0:07–0:16: Gemma on AMD architecture.
- 0:16–0:28: expired invoice extraction and `HARD BLOCK`.
- 0:28–0:40: valid invoice accepted through QC and posting.
- 0:40–0:48: Event Hash and Merkle Root.
- 0:48–0:55: English judge page and exports.
- 0:55–1:00: founder mission and final principle.

**60-second closing voice-over:**

> Built by one founder over approximately ten months as a public-interest engineering effort, OmNi-Ledger combines Gemma on AMD with deterministic warehouse controls. AI extracts the document; explicit rules block expired or inconsistent stock; human roles authorize sensitive actions; and every accepted event leaves verifiable integrity evidence. The goal is accountable operations, not black-box automation.

---

## 12. Product walkthrough script for a live judge

Use this order when a judge wants to click through the application:

1. Open the English judge demo.
2. Click **Run the full deterministic demo**.
3. Point to the `HARD BLOCK` result.
4. Point to the accepted valid invoice.
5. Point to the Event Hash, Previous Hash, Merkle Root, and State Hash.
6. Download the English HTML proof report.
7. Download the English CSV.
8. Open the GitHub repository.
9. Open the README and show the clean-clone commands.
10. Open GitHub Actions and show the green run.
11. Explain that the Arabic console preserves the original Egypt / Ibn Sina operational context.
12. Return to the terminal and show the separate AMD/Gemma live pipeline with credentials hidden.

### One-sentence answer if asked “What is novel here?”

> The novelty is not merely using an LLM to read an invoice; it is designing the LLM as a bounded extraction layer whose output must pass deterministic policy, human authorization, quality, recall, and integrity gates before it can affect a warehouse record.

### One-sentence answer if asked “What is the business value?”

> OmNi-Ledger aims to reduce preventable receiving and dispatch errors while making every exception explainable, reviewable, and traceable.

### One-sentence answer if asked “Is it production-ready?”

> It is a tested prototype with a production-oriented control philosophy; production deployment still requires authentication, durable multi-user storage, measured facility integration, device integration, compliance review, and operational validation.
