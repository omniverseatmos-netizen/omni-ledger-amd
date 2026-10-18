# Release report — OmNi-Ledger Judge Edition 3.0.2

Base: 3.0.1 (verified byte-identical to the delivered ZIP, SHA-256 9697c30b…cdcb02).

## Changes
- Pitch deck text/layout fixes (font portability, cover badge, slide 2 overlap, slide 3 banner centering). See CHANGELOG_v3.0.2.md.
- Sidebar navigation clarity: icon tooltips/labels plus an expandable Menu on small screens.
- Version bump, regenerated PITCH_DECK.pdf, INVENTORY.tsv and RELEASE_MANIFEST.json.

## Verified in this environment (Node 22, Linux)
- `npm test`: PASS (all suites; 12/12 judge acceptance tests)
- `npm run verify:release`: PASS (32/32 modules, static build, HTTP safety smoke, 70-file manifest)
- Headless Chromium (Playwright, 390px and 1280px): Menu button shows only on small screens, expands to show page names, closes after choosing a page; icon titles present.
- Deck rendered PPTX -> PDF with LibreOffice and inspected visually, all 8 slides.

## NOT verified
- Live Gemma/AMD inference (needs your private key and model name).
- A real phone browser (headless Chromium only), and the deployed public URL.
- Rendering in PowerPoint itself (LibreOffice used).
