# Changelog — OmNi-Ledger Judge Edition v3.0.10

- `SUBMISSION_COVER.png`: the "AMD DEVELOPER HACKATHON · ACT III" pill was wider than its text; it now has balanced padding. Only the pill region changed (columns 537–650, rows 228–292); every other pixel is identical to v3.0.9.
- Added optional `scripts/amd-benchmark.mjs` (`npm run amd:benchmark`) and `BENCHMARK.md`: a 13-invoice live smoke test reporting extraction field accuracy and unsafe accepts. Not part of `npm test`; it has an offline `--mock` self-test (13/13 as expected).
- `amd_omni_pipeline.mjs`: `liveExtraction` is now exported (no behavior change).
- `SUBMISSION_COPY.md`: short description now leads with the concrete recall numbers (70 quarantined, 30 traced, next pick blocked).
- `SCOPE_AND_LIMITATIONS.md`: documented that the expiry hard block applies to pharmaceutical-category items only (found while building the benchmark).
- No warehouse-domain, UI or deck changes. Tests unchanged: 168 + 13 = 181.
