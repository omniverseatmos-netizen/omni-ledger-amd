# OmNi Inventory Core v1.7 — Institutional Foundation

v1.7 adds an accounting-grade control layer while preserving v1.6 WMS behavior.

## Run tests
```bash
node tests.mjs | tail -1
node institutional-tests.mjs | tail -1
```

Expected:
- WMS: `82 نجح / 0 فشل`
- Institutional: `9 نجح / 0 فشل`

## Architecture
`WMS Operational Ledger` → operational truth for stock movement.

`Institutional Ledger` → financial truth for double-entry accounting and controls.

`Bridge` → deterministic, auditable translation between them.

## Important
This is a foundation, not a claim of ERP/accounting certification. Tax, multi-currency, costing policy, consolidation, external identity and statutory reporting remain future controlled modules.

Physical layout measurements are intentionally on HOLD until field verification.
