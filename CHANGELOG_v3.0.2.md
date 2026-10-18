# Changelog — OmNi-Ledger Judge Edition 3.0.2

## Pitch deck layout fixes (PITCH_DECK.pptx / PITCH_DECK.pdf)

- Root cause: the deck used the Aptos font, which is missing on phones and in many PDF/LibreOffice renderers. The fallback font is wider, so text overflowed fixed-size boxes.
- Switched all deck text to Arial (metric-compatible with Liberation Sans), so PowerPoint, PDF and phone renders match.
- Cover: "PROPOSED TRACK · REINVENT COMMERCE" badge widened and centered so the label no longer crosses the border.
- Slide 2 (Problem): design-question panel enlarged; the two-line heading no longer overlaps the supporting sentence.
- Slide PDF regenerated from the rebuilt PPTX via LibreOffice and visually checked page by page.

- Slide 3 (Approach): "Core invariant" label and statement are now vertically centered in their panel; the same middle anchoring is applied to the single-line banners on slides 4 and 6.

## Navigation clarity (judge UI)
- Every sidebar icon now has a tooltip and accessible name that says where it goes (e.g. "Recall control — recall walkthrough and hard block").
- On small screens the icon-only rail gets a **Menu** button; tapping it expands the rail to show page names, with a dimmed backdrop. Choosing a page or tapping the backdrop closes it.

## Unchanged
- Warehouse core, UI, tests and release gate are unchanged from 3.0.1.
- Live AMD/Gemma inference and public deployment still require the owner's account access and were NOT run here.
