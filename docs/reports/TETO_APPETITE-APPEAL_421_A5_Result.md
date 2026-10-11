# Issue #421 — Mozzarella melt Pilot: A5 (milky-white melt) on top of A4

- Base: PR #468 head `0ee9759` (A4). Owner iPhone Safari HV of A4: the baked mozzarella "looks like a fried egg" and "like separate round lumps". Target: milky-white, irregularly melted mozzarella like a real margherita.
- Scope (Owner): less yellow centre / milky-white gradient, weaker bright outer ring and a natural sauce boundary, gentle per-piece asymmetry, small irregular restrained browning, raw still distinct from baked, no abrupt change while baking. Sauce texture -> Issue #475, dough / crust -> Issue #474 (not touched). PRs #471 / #475 / #476 / #477 are not touched.

## Why A4 read as a fried egg / separate lumps (from the A4 images and the code)
1. The body core was cream-yellow (252,243,214) and the cheese filter adds brightness / sepia on top: a bright yellow centre inside a pale ring = yolk and white.
2. A bright cream halo and five equally strong lobes drew a ring round every body, and a hard drop shadow under it made each piece sit *on* the pizza as its own lump.
3. The browning was orange and large, like freckles on the yolk.

## What A5 changes (`src/logic/bakeVisual.ts`, `.pizza-cheese--mozzarella` in `src/App.css`)
- **Milky ivory body, no yellow centre:** body stops (240,235,223) -> (237,231,216) -> (234,226,208) -> (230,220,200), the outer stops no more yellow than the core (pinned by a test); gloss halved and whiter.
- **Weaker ring, natural boundary:** halo and lobes in the same milky colour at 0.5 / 0.6 / 0.5 alpha (A4: 0.8 / 0.95 / 0.78); the edge stays translucent so the sauce shows through at the rim; the sauce-coloured bleed is quieter (0.12).
- **The lump no longer sits on the pizza:** its drop shadow fades with `melt` (0.3 -> 0.09, new `--bake-cheese-drop`, raw keeps 0.3) and the under-pool shadow is weaker (0.22 -> 0.12).
- **Gentler, more individual asymmetry (A4's hash is kept; no `Math.random`):** outline jitter widened (+-13 / +-10 points), each of the five spread lobes gets its own strength (x0.4-1.0, `--bake-cheese-lobe-1..5`), a per-piece `--bake-cheese-spread` (x0.6-1.1 of the lobe offsets) and a mild `--bake-cheese-aspect` (x0.95-1.05 width).
- **Small, quiet, irregular browning:** blotches 0.72x the A4 size, pale golden-tan (190,146,90) instead of orange, strength 1.6x toast (A4: 2x) with the per-piece strength 0.45-1.3. Overbaked blotches are still dark brown (190 -> 124,68,28; unchanged).
- Raw and the melt ramp are unchanged: at melt 0 / toast 0 every new layer is transparent and the raw colours / outline are the raw ones (pinned by tests), and `melt` / `toast` / `char` are still the existing continuous scalars, so nothing switches abruptly.

## Constraints check
- Unchanged: placement coordinates, push-out distance, ingredient counts, scoring, save format, economy, 3 s bake, CUT judgement, recipe judgement, UI structure. Changed non-test source files: `src/logic/bakeVisual.ts`, `src/App.css` (the mozzarella rule only); `PizzaStage.tsx` is untouched in A5.
- No SVG filter, no clip-path, no pseudo-element, no extra DOM, no `mix-blend-mode`, no CSS math inside a colour; gradients / box-shadow / border-radius / transform only.
- Size / overlap: the lobe offsets are scaled by at most 1.1 and every lobe is at most 0.6 strong (A4: 0.78 - 0.95), so the spread reach is about 8.3 px (A4 about 7.8 px, the old B about 12 px). The only growth is the +-5% aspect: the widest piece is about 37.5 px at melt 1 (A4 35.7 px, +5%). The images show no fusion of pieces and no new covering of the basil (the right cheese's soft halo touching a basil leaf is as in A3 / A4).
- Cost: the same layer count as A4 (about 11 shadows per piece, the same gradients); not measured on a device.

## Images (390x844 and 360x800; the needle position of each stage matches A4 within about 2 points)
`docs/reports/screenshots/finished-pizza-appeal-421/`: `compare-a4-a5-closeup-*.png` (raw / melting / baked / deep / overbaked, A4 | A5), `compare-a4-a5-cut-result-*.png` (CUT and RESULT, A4 | A5), `zoom-a4-a5-baked-deep-390x844.png` (the two lower pieces: A4 | A5 try 2 | final A5).
- A5: milky ivory instead of a yellow centre, a soft translucent rim instead of a bright ring, the pieces differ in outline / spread / blotches, small pale browning, CUT / RESULT carry the same pieces.
- Iteration notes: try 1 had a blown-out white core and a pink inner ring; try 2 still blew out the core. The final tones are slightly darker (the cheese filter adds brightness) and the edge more opaque.

## Verification
- `tsc -b` clean; oxlint no findings on touched files; full Vitest 381 files / 7018 passed / 1 skipped.
- Unit tests updated / added: raw is the raw look; the melted body is milky (red - blue 8..30, darker than the raw core, outer stops not yellower); per-piece lobes / spread / aspect differ and stay within bounds (200 keys); the drop shadow fades with melt and raw keeps 0.3; A4's determinism / three-different-pieces tests still pass.
- Chromium e2e at 390x844 and 360x800 (the mozzarella spec incl. the three-distinct-outlines assertion, finished-pizza-visual-2.0, pizza-cutting-phase4b, cut-skip-failed-bake, result-1screen-2.0, cut-regions-427, bake-one-way): 59 passed, 1 skipped (as before).
- WebKit: see the PR (required CI of the pushed head). WebKit screenshots are still not viewable from this environment (artifact blob host is blocked by the proxy).

## Remaining visual issues / not verified
- The pieces are still soft ellipses with lobes: a real melt has more truly irregular, sometimes torn patches; going further risks the fusion of the old B.
- The rim is a pale pink where the translucent milky edge sits over the red sauce (natural for cheese on tomato, but a thin rim is still visible); the sauce under the cheese is not browned (Issue #475).
- The overbaked blotches are small and faint on the greyish overbaked body (the cheese filter, pre-existing).
- Real iPhone Safari (Owner HV of A5), older in-app WebViews and device paint cost are not verified.
