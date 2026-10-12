# Issue #421 — Mozzarella melt Pilot: A4 (natural variation) on top of A3

- Base: PR #468 head `2b50a88` (A3). Owner iPhone HV of A3: colour and outline improved, but next to a real margherita the cheese reads as three identical round discs.
- Scope (Owner): subtle outline irregularity, three pieces that do not look identical, natural variation of the browning (position / size / strength), a partial blend into the sauce, and never covering the basil or a neighbour. Minimal diff on A3; the old B (cheeses fusing together) is not reintroduced.

## A3 visual problems (from the A3 images and the code)
1. All pieces share one CSS rule, one outline, one blotch pattern, one edge: three copies of one disc.
2. The feathered edge is the same all the way round, so the cheese/sauce boundary is a uniform soft ring.
3. The four blotches have the same size and strength everywhere.

## What A4 changes
- **A deterministic per-piece variation** (`cheeseMeltJitter` in `src/logic/bakeVisual.ts`): an FNV-1a hash of the piece's own `ingredientId:x:y` (the key `stablePieceRotation` already hashes) feeds a small xorshift32. No `Math.random`: the same piece gets the same values on every render, in BAKE, CUT and RESULT.
- Resolved in TypeScript into finished values, so the stylesheet only reads `var(--bake-cheese-*, <A3 / raw fallback>)`:
  - `--bake-cheese-radius`: the outline (A3 radii, shifted by up to +-9 / +-7 percentage points x `melt`, clamped 24-70%);
  - `--bake-cheese-body-at`: where the feathered body's centre sits (46%/44% +-13), so the edge is thinner on one side and blends into the sauce unevenly;
  - `--bake-cheese-sp1..4-at / -r / spot-1..4 / spot-soft-1..4`: each of the four browning blotches moves (+-12 / +-10 points), changes size (x0.6-1.45) and strength (x0.45-1.4); at toast 0 they are invisible;
  - `--bake-cheese-bleed` + `--bake-cheese-bleed-off`: a faint tomato-orange stain just outside one side of the edge (alpha 0.38 x melt, offset up to 3 px), the partial blend into the sauce.
- `App.css`: only the `.pizza-cheese--mozzarella` rule (border-radius, blotch gradients read per-piece vars, one extra shadow layer). `PizzaStage.tsx`: the piece's key is passed to `cheeseMeltCssVars`.
- Without a key `cheeseMeltCssVars` draws exactly A3. The raw cheese is untouched: at melt 0 / toast 0 the outline is the raw outline and every new layer is transparent (pinned by tests).

## Constraints check
- Only heat-derived `melt` / `toast` / `char` (existing scalars) plus the placement key. Game state, 3 s bake, scoring, economy, save, CUT judgement and recipe judgement are untouched (changed non-test source files: `bakeVisual.ts`, `PizzaStage.tsx`, `App.css`; the UI structure is unchanged).
- No SVG filter, no clip-path, no pseudo-element, no extra DOM, no `mix-blend-mode`, no CSS math inside a colour (unit test: every value is a finished rgba() or a plain length / percentage).
- Reach / overlap: the cream lobes and the scale are exactly A3's (max reach about 8 px). The new halo reaches 5 px (A3) and the bleed at most 3 + 4 + 0.5 = 7.5 px, so the spread is bounded by A3's, and the images show no new overlap of the basil or of a neighbouring piece (the right cheese's soft halo touching the basil leaf is as in A3). The old B reached about 12 px, which is why it fused the pieces.
- Cost: no new layer count except one shadow per piece (about 11 shadows in total, A3 had 10). Not measured on a device.

## Images (390x844 and 360x800; needle positions of each stage match A3 within 1 point)
`docs/reports/screenshots/finished-pizza-appeal-421/`: `compare-a3-a4-closeup-*.png` (raw / melting / baked / deep / overbaked, A3 | A4), `compare-a3-a4-cut-result-*.png` (CUT and RESULT, A3 | A4), `zoom-a3-a4-baked-deep-390x844.png` (zoom on the two lower pieces: A3 | first A4 attempt | final A4; the first attempt was too close to A3).
- A4: the three pieces differ in outline, in where the blotches sit and how strong they are, and in how the edge blends; CUT / RESULT keep the same pieces (the key is the placement, not the frame).

## Verification
- `tsc -b` clean; oxlint no findings on touched files; full Vitest 381 files / 7017 passed / 1 skipped.
- New unit tests: deterministic jitter (same key, same values; range [-1, 1]); three keys give three different outlines / blotch centres / body centres; no key gives A3's values; raw is the raw outline with invisible blotches / bleed / halo; the ranges cannot run away (200 keys); a PizzaStage test with three mozzarella pieces (different values, identical again after a fresh render).
- Chromium e2e at 390x844 and 360x800: the new spec (now also asserts three distinct outlines at the baked stage) + finished-pizza-visual-2.0, pizza-cutting-phase4b, cut-skip-failed-bake, result-1screen-2.0, cut-regions-427, bake-one-way: 59 passed, 1 skipped (as before).
- WebKit: see the PR (CI of the pushed head). WebKit screenshots are not viewable from this environment (artifact blob host blocked); WebKit is assertions only.

## Remaining visual issues / not verified
- The pieces still share one overall shape family (a soft ellipse plus lobes); a real margherita has more truly irregular melts. Going further (different spread per piece) risks the fusing of B and was not done.
- Browning is still blotches, not a gradient from the edge inwards; the sauce under the cheese is not browned (outside Pilot scope).
- Real iPhone Safari (Owner HV of A4), older in-app WebViews and device paint cost are not verified.
