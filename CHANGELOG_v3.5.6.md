# AtMoS v3.5.6 — 2026-11-08

## Added
- Batch recall now quarantines all currently available on-hand stock for the recalled item/batch across configured warehouses, consistent with the global recall guard.
- Recall movements use each source/destination warehouse in the ledger; the recall result reports total held quantity, per-warehouse quantities, and movement warehouse attribution.
- Release and disposal process the stock movements in each affected warehouse, while older v3.5.5 recall records without per-movement warehouse codes remain supported.
- Regression scenarios cover stock in two warehouses, warehouse-specific quarantine balances, ledger/location consistency, blocked transfer after recall, recall release/disposal, and an older recall record.

## Boundaries
- Allocated or already-picked quantities are not silently rewritten; the existing recall-impact workflow continues to require human action.
- This is locally tested prototype behavior, not an EDA integration, approved partner procedure, field pilot, or production validation.
