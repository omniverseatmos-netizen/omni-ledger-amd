# Optional live benchmark (`npm run amd:benchmark`)

Runs 13 fictional invoices (5 valid, 3 expired, 5 invalid) through the live AMD Token Factory endpoint and the deterministic gate, then writes `evidence/live-amd-benchmark/live-<timestamp>.json`.

## Run it (about 1–2 minutes, after the video and the draft submission are done)
```bash
read -rs -p "AMD key (hidden): " AMD_TOKENFACTORY_API_KEY; export AMD_TOKENFACTORY_API_KEY; echo
export AMD_BASE_URL="https://developer.amd.com.cn/radeon/api/v1"
npm run amd:benchmark
```
`node scripts/amd-benchmark.mjs --mock` is an offline logic self-test (no network, labelled `MOCK_SELF_TEST_NOT_LIVE`); it is not evidence.

## What it measures
- Per-field exact match of the model's extraction against the invoice text.
- How many valid invoices are accepted, expired ones blocked (`EXPIRED_GOODS`), and invalid ones rejected before any stock is posted.
- **Unsafe accepts**: any invoice accepted that should not have been. The script exits with code 2 if there is one.

## How to use the result honestly
- Report the numbers exactly as printed, including any misses. A model extraction error that still passes the schema (for example a wrong but valid-looking number) cannot be caught by the gate; the report will show it.
- Add a sentence to the submission text only if you actually ran it, using the real numbers and the file name of the result.
- 13 fictional invoices is a small smoke test, not a statistical accuracy claim.
- The shared team key is rate-limited (about 30 requests/minute); the script waits between requests and retries 429 responses.
