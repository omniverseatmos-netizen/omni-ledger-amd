# OmNi Institutional Assurance v1.8

v1.8 strengthens the institutional layer without changing the physical-layout assumptions.

## New controls
- Batch Actual Cost policy: cost is resolved only from documented WMS receipt evidence for the same item/batch.
- Conflicting or missing batch cost is blocked; no guessed valuation.
- Controlled period-close gate: no pending journals, no unresolved reconciliations, balanced trial balance, and at least one documented reconciliation by default.
- Reconciliation approval with Maker/Checker segregation.
- Invariant suite covering journal totals, idempotency references, periods, audit chain, and trial balance.
- Deterministic audit package with package hash and self-validation.
- Safe foundation for inventory adjustment accounting; quantity variance remains explicitly evidenced.

## Deliberate non-claims
- No tax/legal certification.
- No statutory financial reporting certification.
- No multi-currency/consolidation engine yet.
- No external identity provider yet.
- No physical geometry facts before field verification.
- No cost guessed from missing WMS evidence.

## Costing policy
`BATCH_ACTUAL_COST` is explicit and conservative. It is not FIFO, weighted average, or standard cost. A batch with multiple documented unit costs is blocked until a controlled costing policy resolves it.
