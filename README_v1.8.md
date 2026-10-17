# OmNi Inventory Core v1.8 — Institutional Assurance

v1.8 keeps the v1.6 WMS and v1.7 Institutional Ledger intact and adds controlled assurance mechanisms.

## Test suite
```bash
node tests.mjs | tail -1
node institutional-tests.mjs | tail -1
node institutional-assurance-tests.mjs | tail -1
```
Expected:
- WMS: `82 نجح / 0 فشل`
- Institutional foundation: `9 نجح / 0 فشل`
- Institutional assurance: `9 نجح / 0 فشل`

## Demo
```bash
node institutional-demo-v1.8.mjs
```

## v1.8 additions
1. Batch Actual Cost resolution with hard blocking on missing/ambiguous cost.
2. Controlled period-close gate.
3. Approved reconciliation workflow.
4. Invariant verification.
5. Tamper-evident audit package with self-validation hash.
6. Safe adjustment-accounting foundation.

## Architecture boundary
WMS operational truth remains separate from institutional financial truth. Bridges are deterministic and evidence-based.

## Physical warehouse HOLD
Columns, rack positions, dimensions, aisle widths, conveyor geometry, and measured distances remain unverified until field measurement. Current layout data must not be presented as measured reality.
