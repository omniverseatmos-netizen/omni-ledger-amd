# Judge quickstart

Use this path to verify the working product without relying on the presentation video.

## 1. Open the live English judge workspace

[Open the English judge workspace](https://omniverseatmos-netizen.github.io/omni-ledger-amd/index-en.html).

The browser demo is intentionally local and deterministic. It uses fictional records and does not call AMD from browser JavaScript.

## 2. Verify the deterministic controls

1. Open **Invoice intake**.
2. Keep **Expired batch — should be blocked** selected.
3. Click **Run deterministic gate** and verify `HARD BLOCK · EXPIRED_GOODS` and zero available stock.
4. Open **Recall control** and click **Execute recall walkthrough**.
5. Verify 70 boxes quarantined, 30 previously dispatched, and `HARD BLOCK CONFIRMED` with `RECALLED_BATCH`.
6. Open **Batch trace** and inspect the recorded `Al-Shifa Pharmacy · 6th of October` dispatch.
7. Open **Audit evidence** and verify the three `VALID` integrity checks, the Merkle root, and the downloadable Judge Evidence Pack.

## 3. Verify the AMD/Gemma path separately

The live model call is deliberately kept out of the browser. In a private terminal with an event-authorized AMD Token Factory key:

```bash
export AMD_TOKENFACTORY_API_KEY="YOUR_REAL_KEY_IN_THIS_TERMINAL"
export AMD_BASE_URL="https://developer.amd.com.cn/radeon/api/v1"
export AMD_MODEL="Gemma-4-31B-IT"
npm ci
npm run amd:live
npm run amd:expired
```

The valid scenario should report `ACCEPTED`; the expired scenario should report `BLOCKED` with `EXPIRED_GOODS`. Never commit or record the key. Fixture commands are offline checks only and are not live AMD evidence.

## What the demo does and does not claim

Gemma extracts invoice fields. Strict validation and deterministic warehouse rules decide whether stock may be received, allocated, picked, packed, dispatched, or quarantined. The prototype uses fictional data and provides batch-level traceability through recorded warehouse dispatch. It does not claim patient-level or GS1 serial tracking, regulatory certification, encryption, legal signatures, or production readiness.
