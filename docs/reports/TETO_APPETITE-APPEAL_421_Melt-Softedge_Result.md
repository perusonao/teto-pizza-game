# Issue #421 — Mozzarella melt Pilot: soft-edge visual improvement (Owner iPhone HV feedback)

- Base: PR #468 head `2d84416`. Owner iPhone HV: flow PASS; "after baking the mozzarella still looks like a white circle, the melt reads weak".
- Scope (Owner): (1) soften the hard outline of the melted body, (2) white -> cream by `meltIntensity`, (3) irregular spread as a comparison only, (4) browning emphasis on hold. Nothing else changed.

## Cause (read from code, confirmed in the images)
The melted body was the same opaque white-cream disc with the same silhouette as raw; only a same-coloured blurred halo (box-shadow lobes) was added outside it, so the eye still reads one hard white disc.

## What changed (adopted: A3)
`src/logic/bakeVisual.ts` `cheeseMeltCssVars` + `.pizza-cheese--mozzarella` in `src/App.css`; no new state, still `meltIntensity` only.
- The raw lump (the original gradient, same three colours) cross-fades out (`--bake-cheese-raw-*`, alpha `1 - melt`) while a creamier body with a feathered edge fades in (`--bake-cheese-body-*`, `closest-side` ellipse, last stops alpha 0.95 -> 0.7). The body is opaque by melt 0.625, so there is no see-through pink mid-melt.
- A cream halo (`--bake-cheese-halo`, 0 offset, 2px spread, 3px blur) sits right outside the feathered edge; without it the sauce showed through as a ring between body and spread (first try, kept in the notes below).
- The white bottom inset highlight fades almost fully (0.55 -> 0.05) so the rim is not a hard line.
- Raw is unchanged: at melt 0 every var resolves to the original colours (pinned by a test), and the stylesheet fallbacks are the original values, so tray / Reference / thumbnails / other cheeses draw exactly as before.
- Still only gradients, box-shadow, border-radius, transform with finished `rgba()` from TypeScript. No SVG filter, no clip-path, no pseudo-element, no extra DOM, no `calc()` inside a colour.

## Variants compared (current `2d84416` | A3 | B), 390x844 and 360x800
Images: `docs/reports/screenshots/finished-pizza-appeal-421/compare-melt-softedge-closeup-{390x844,360x800}.png` (needle positions per stage in `needle-positions-{current,softedge}-*.json`, matching within 0.3), and `compare-melt-softedge-cut-result-*.png` (current | A3).
- **A3 (adopted):** soft cream body, no hard white outline, same spread geometry as before.
- **B (A3 + irregular spread: larger radius variance, lobe offsets about 8 px, x1.18 / y0.92 scale):** reads more "spread", but the two lower cheeses merge into one blob and, at 360x800, the right cheese's spread reaches the basil. Not adopted; kept as a possible follow-up with a smaller spread.
- Discarded A (first try): the feathered edge let the red sauce show as a ring between body and spread (a bowl-rim look); mid-melt looked translucent pink. Both fixed in A3.

## Contract / mobile / cost / overlap
- Contract: heat / `meltIntensity` / `toastIntensity` / `charIntensity` only; game state, 3 s bake, scoring, economy, save and CUT untouched; CUT pieces carry the same look (same element, existing clip).
- Overlap: A3's reach is unchanged from the current build (the new halo reaches 5 px, inside the existing 7-8 px lobe reach); B reaches about 12 px, which is why it merges neighbours.
- Cost: one more gradient layer and one more shadow per mozzarella piece (about 10 shadows instead of 9). Not measured on a device.

## Verification (A3, this commit)
- `tsc -b` clean, oxlint no findings on touched files, full Vitest 381 files / 7014 passed / 1 skipped.
- New unit tests: raw heat equals the original gradient colours at full alpha and no body / halo; melted body is cream (not white), feathered, with a halo and a nearly gone inset rim; raw/body cross-fade is monotonic and never translucent.
- Chromium e2e at 390x844 and 360x800 (new spec + finished-pizza-visual-2.0, pizza-cutting-phase4b, cut-skip-failed-bake, result-1screen-2.0, cut-regions-427, bake-one-way): 59 passed, 1 skipped (as before).
- WebKit: see the PR (CI). WebKit screenshots are still not viewable from this environment (artifact blob host is blocked by the proxy), so WebKit is assertions only.
- Not verified: real iPhone Safari (Owner HV of the new build), older in-app WebViews.
