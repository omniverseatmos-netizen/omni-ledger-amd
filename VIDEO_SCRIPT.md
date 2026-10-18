# Demo video script — 100 to 115 seconds — actual product demo required (phone screen recording)

## Before you press record (2 minutes)
1. Fresh Termux session. Do not paste the key where it is visible:
   ```bash
   cd ~/OmNi-Ledger_Judge_Edition   # use the freshly extracted v3.0.6 folder
   export HISTFILE=/dev/null
   read -rs -p "AMD key (hidden): " AMD_TOKENFACTORY_API_KEY; export AMD_TOKENFACTORY_API_KEY; echo
   export AMD_BASE_URL="https://developer.amd.com.cn/radeon/api/v1"
   clear
   ```
2. Make the terminal text large; use landscape if you can. Turn on Do Not Disturb (no notifications on screen).
3. Start the site in a second Termux session: `npm run serve`, and open it in the browser at 127.0.0.1:4173. (Or use the deployed GitHub Pages URL if it is already live.)
4. Compact live-output command (keeps the proof on one screen; the full JSON stays in `evidence/`):
   ```bash
   node amd_omni_pipeline.mjs --live --scenario valid   | grep -E '"(mode|endpointHost|model|requestId|decision|assertion|code)"'
   node amd_omni_pipeline.mjs --live --scenario expired | grep -E '"(mode|endpointHost|model|requestId|decision|assertion|code)"'
   ```

## Shots and voice-over (English)
| Time | On screen | Voice-over |
|---|---|---|
| 0:00–0:10 | Deck slide 2 ("An alert is not a control") | "In pharmaceutical supply chains, an alert is not a control. A wrong batch or an expired one must be stopped before it becomes stock." |
| 0:10–0:22 | Deck slide 3 ("AI reads. Rules decide. Evidence proves.") | "OmNi-Ledger lets AI read the invoice, but deterministic rules decide, and every decision leaves evidence. The model never writes inventory balances." |
| 0:22–0:42 | Termux: valid command. Pause 2 s on `LIVE_AMD_ENDPOINT`, host, model, request ID, `ACCEPTED`, `PASS` | "This is a live request to AMD Token Factory. Gemma extracts the fields. The core validates them and accepts the batch." |
| 0:42–0:58 | Termux: expired command. Pause on `BLOCKED` and `EXPIRED_GOODS` | "Now an expired invoice. The extraction succeeds, but the deterministic core hard-blocks it. The model cannot override that." |
| 0:58–1:25 | Browser → Recall control → run walkthrough → point to 70 boxes quarantined, 30 boxes dispatched, `RECALLED_BATCH` block | "A recall quarantines the remaining 70 boxes, traces the earlier 30-box dispatch to a recorded customer, and blocks the next pick." |
| 1:25–1:40 | Audit evidence page: integrity checks, tap Download judge evidence pack, then point to the local-demo provenance | "The judge evidence pack bundles the invoice decision, recall path, event evidence, CSV and readable HTML in one file, and explicitly labels this browser run as local—not live AMD. Ledger, audit chain and state seal are verifiable. These are integrity checks, not encryption or a legal signature." |
| 1:40–1:52 | Slide 7 ("Strong claims have explicit boundaries") | "It is a prototype with fictional data, batch-level tracing, built by a solo developer on a phone. We state what it does not claim." |

## Required proof shots (do not replace with cinematic B-roll)
- The current English judge UI must be visible for the Recall Control, Batch Trace and Audit Evidence steps.
- The live AMD CLI must show `LIVE_AMD_ENDPOINT`, endpoint host, returned model ID, request ID, valid `ACCEPTED`, and expired `BLOCKED / EXPIRED_GOODS`. Hide credentials and unrelated private data.
- If a live call fails, do not splice in an older successful run as if it happened during this recording. Explain the failure or re-record after a genuine successful run.
- The supplied `Forged_on_a_Smartphone.mp4` is a mood/brand teaser, not a substitute for these proof shots.

## Rules for the recording
- Use the team key from AMD Token Factory. Never open the Token Factory page on camera while the key is visible.
- Say "live" only over the Termux shots. Say "local demo scenario" over browser shots.
- Never show the key, history, account pages or notifications.
- If a live run fails on camera, show the error and say so; do not substitute the fixture.
- After export: play the whole video once on the phone, check the audio, then upload as **unlisted** and test the link while logged out.
