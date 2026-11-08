# Implemented scope and limitations

## Demonstrated in the packaged domain core

- Purchase-order and receiving state transitions, QC-gated posting and integer quantities.
- Item/batch checks, expiry controls and FEFO allocation.
- Scan-verified picking, guarded packing and dispatch.
- Recall reference/reason requirements, separation of duties, inventory-wide quarantine of available recalled-batch stock with warehouse-specific movements, and guarded recalled-batch operations.
- Forward trace from recorded receipt to outbound customer sales-order records and current on-hand balances by location/status.
- Ledger/audit chain checks, state hashing, Merkle-root seals, and report exports.
- Strict post-extraction schema checks and live-AMD CLI transport support.

## Known boundaries

- Available stock for a recalled item/batch is quarantined across all warehouses in the local core, with each ledger movement attributed to its actual warehouse. Allocated or already-picked units require explicit human follow-up; this prototype policy still needs partner review and operational acceptance testing before production use.
- Batch tracing terminates at recorded dispatch. Patient, sub-pharmacy and individual serialized-pack tracking are not implemented.
- Customer returns are not modeled in this version.
- No external identity provider, distributed locking, multi-user backend, independent key management, trusted timestamping, signed attestations, or regulated operational validation is included.
- The public demo uses fictional fixtures and runs locally in the browser; it does not contact AMD.
- A live inference request requires a valid credential and a model available to that account. The owner ran the CLI live against AMD Token Factory (the documented AMD Radeon Cloud endpoint) for both scenarios, more than once; the captured outputs are in `LIVE_RUN_EVIDENCE.md` and `evidence/live-amd-run/`. They were not independently re-run in the build environment, and the endpoint response does not identify the accelerator or software stack.

The product must be presented as a prototype for technical evaluation—not as a production-certified, regulator-approved, patient-level traceability platform.
- The mandatory batch/expiry hard block at receiving applies to pharmaceutical-category items. General-category items in the demo master data (for example `SURG-MASK`) are not expiry-gated.
