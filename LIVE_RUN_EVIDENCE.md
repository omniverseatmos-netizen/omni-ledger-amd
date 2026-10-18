# Live AMD endpoint run — evidence record

Four runs of `node amd_omni_pipeline.mjs --live` were executed by the project owner in Termux (Android): run 1 from the v3.0.2 package, run 2 from the v3.0.3 package using the team key issued through AMD Token Factory. Outputs are in `evidence/live-amd-run/` (verbose billing sub-fields trimmed; the API key is never printed by the CLI and is not stored in this package).

| | Run 1 valid | Run 1 expired | Run 2 valid | Run 2 expired |
|---|---|---|---|---|
| Mode | `LIVE_AMD_ENDPOINT` | same | same | same |
| Endpoint host | `developer.amd.com.cn` | same | same | same |
| Model reported | `self-dploy/Gemma-4-31B-IT` | same | same | same |
| Request ID | `da53ba69…2f54` | `a9ebbad3…7be90a7a04be23` | `8aabe63d0b8c4839abb7db62b5bea636` | `5497cd477e8b453ba492f5a6d7590012` |
| Decision | `ACCEPTED` | `BLOCKED` `EXPIRED_GOODS` | `ACCEPTED` | `BLOCKED` `EXPIRED_GOODS` |
| Ledger / audit / seal | valid / valid / verified | same | same | same |
| Assertion | `PASS` | `PASS` | `PASS` | `PASS` |

(Full request IDs for run 1: `da53ba69bed94db29c71e2a64fde9e54`, `a9ebbad32e8e4b62a57be90a7a04be23`.) Merkle root and state hash differ between the two valid runs because the state includes run-time values; both seals verified.

## Endpoint provenance (from AMD's own Token Factory page, as pasted by the owner)
- AMD Token Factory is described there as the model API catalog of AMD Radeon Cloud, offering free OpenAI-compatible endpoints "running on AMD GPUs".
- Its documented base URL is `https://developer.amd.com.cn/radeon/api/v1`, the host used by this CLI.
- `Gemma-4-31B-IT (experimental)` is listed in that catalog. The gateway reported the model id as `self-dploy/Gemma-4-31B-IT`, preserved verbatim here.
- The lablab event page FAQ says the event is hosted on notebooks.amd.com/tokenfactory and only the Token Factory API is needed.

## What this shows
- Extraction reached AMD Token Factory and returned structured fields for two fictional invoices, repeatedly.
- The output was treated as untrusted and passed through the deterministic policy gate, which accepted the valid batch and hard-blocked the expired one.

## What this does NOT show
- The response does not state the GPU model or software stack (ROCm, Instinct, etc.); do not claim a specific one.
- The outputs contain no timestamps and could not be re-run by the package builder (no key). They are the owner's captured output.
- The public judge web page does not call AMD; live extraction runs in the CLI. Show it in the video.
- AMD's terms: trial/development use, no SLA, prompts kept about 2 days, do not send sensitive personal, health or financial data — only fictional data is used here.
