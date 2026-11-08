# AtMoS — 3-Minute EIP Pitch Draft

## One-line message

**AtMoS helps pharmaceutical distributors prevent unsafe inventory decisions by separating AI-assisted data entry from deterministic stock authority, recall controls, and audit evidence.**

## Three-minute script

### 0:00–0:25 — The problem

“Pharmaceutical distribution depends on decisions that are small in the interface but serious in their consequences: accepting a batch, releasing stock, picking an order, or responding to a recall. In many workflows, information moves between invoices, spreadsheets, messages, and operational systems. When something goes wrong, teams need to know what happened, who decided, and whether the affected stock was actually contained.”

### 0:25–0:55 — The solution

“AtMoS is an operations control layer for pharmaceutical distribution. It can use AI-assisted intake to propose structured fields from an invoice or document, but the AI does not have authority to change stock. Deterministic rules validate the batch, expiry, quantity, state transition, role, and recall status before the ledger changes.”

### 0:55–1:25 — How it works

"In the judge workspace, you can inspect an OCR-like name match using Levenshtein edit distance and its dynamic-programming matrix. It ranks candidates only; it does not identify a medicine, select a SKU, or write stock. A human checks product strength, form, batch, and expiry before the deterministic gate acts. Recall controls then quarantine remaining stock, block a recalled pick, and leave reviewable evidence."

### 1:25–1:55 — Evidence today

“We have a deterministic domain core, normalized PostgreSQL work, tenant-isolation and backup-restore checks in CI, an opt-in policy shadow gate, and local OIDC protocol integration tests. We also created a deterministic synthetic workload for workshop rehearsal: 2,000 transactions and 102 injected scenarios were blocked in that fixture. These are synthetic workshop results, not production measurements, customer data, or capacity claims.”

### 1:55–2:25 — Who we serve and the Pilot

“Our first target customer is a mid-sized pharmaceutical distributor or pharmacy chain with one central warehouse, a quality function, and recurring receiving, expiry, recall, and picking workflows. We propose a focused six-to-eight-week Pilot at one site, using anonymized or approved data. We will measure investigation time, trace-evidence completeness, exception handling, user adoption, and the effect on manual rework.”

### 2:25–2:45 — Why now and why us

“The opportunity is not to replace the people responsible for quality and operations. It is to give them a clearer control boundary and better evidence. AtMoS is being built with a safety-first principle: AI may propose, but deterministic policy decides. That makes the system easier to inspect, test, and improve with real users.”

### 2:45–3:00 — The ask

“We are seeking support to run the first controlled Pilot: one data-source integration, secure staging, real identity integration, user testing, baseline measurement, and a documented scale decision. The outcome will be evidence for what works in the field, what must change, and whether AtMoS is ready to expand.”

## Arabic delivery note

يمكن شرح الفكرة بالعربية بهذه الجملة:

> «AtMoS لا يعطي الذكاء الاصطناعي سلطة تغيير المخزون؛ هو يساعد في إدخال البيانات، بينما النواة الحتمية تتحقق من التشغيلة والصلاحية والأدوار والاستدعاء، وتنتج دليلًا قابلًا للمراجعة.»

## Unified message rules

- **Problem:** unsafe or hard-to-audit inventory decisions.
- **Customer:** pharmaceutical distributor or pharmacy chain with a central warehouse and quality workflow.
- **Solution:** AI-assisted intake plus deterministic inventory authority.
- **Proof today:** tested prototype, synthetic deterministic fixture, CI database checks, local OIDC integration.
- **Next proof:** approved Pilot with anonymized/real operational data and measured baseline.
- **Ask:** fund validation and Pilot execution, not unbounded platform complexity.

## Claims to avoid

Do not say production-ready, regulator-approved, patient-level traceability, real customer network, zero latency, or 100% production safety. Use prototype, synthetic fixture, local integration test, and Pilot hypothesis where those are the accurate descriptions.
