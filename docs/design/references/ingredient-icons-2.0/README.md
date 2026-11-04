# Ingredient Icon 2.0 — adopted reference SVGs (Issue #417)

Authority: [`docs/decisions/TETO_INGREDIENT-ICON-2.0_STYLE-LOCK-V2.md`](../../../decisions/TETO_INGREDIENT-ICON-2.0_STYLE-LOCK-V2.md)

This directory holds only the **Owner-adopted** icons: 30 SVGs (25 from Style Lock §1 / §1b, plus `shiso` and `whitebait` added by Batch 8b, plus `green-pepper` / `bell-pepper` / `pineapple` added by Pilot E; `salmon-roe` is in PR #584 and is not here) (`<ingredient id>.svg`, 64×64, transparent background) plus
`style-lock-v2-comparison-sheet.png`. `clam` is intentionally absent (the existing 32×32 `clam-valve` is kept).

Not here, and not adopted: everything under
[`../../candidates/ingredient-icons-2.0-remaining/`](../../candidates/ingredient-icons-2.0-remaining/) — in particular its
`svg-not-adopted/` folder (rejected alternatives) — is comparison history only.

Ingredient Visual V1 (PR #690, Style Lock §1e) added `pickles.svg`, `wurstel.svg` and `paprika-powder.svg` (the art of `pickle-slices` / `wurstel-links` / `paprika-powder-pile`; Owner image HV PASS on 390x844, 2026-10-28).

Pilot E (Issue #715, Style Lock §11) added `green-pepper.svg` (GP-A2 strips), `bell-pepper.svg` (BP-B2 quarter) and `pineapple.svg` (PA-A2 wedges), promoted from [`../../candidates/ingredient-icons-2.0-pilot-e0/svg/`](../../candidates/ingredient-icons-2.0-pilot-e0/svg/) byte-for-byte; `src/components/IngredientGlyph.tsx` draws them as `green-pepper-strips` / `bell-pepper-quarter` / `pineapple-wedges`. The sizes (1.45em / 1.65em / 1.45em, and the bell-pepper tray-chip rule) are PROVISIONAL until the Owner's iPhone HV.

These files are design references; the production art lives in `src/components/IngredientGlyph.tsx` (ported as-is).

Issue #739 (Owner P1, 2026-11): added `umeboshi-paste.svg` (the 梅肉 sauce: a plum-pink paste dab stamped with a plum blossom, instead of the 🍑 text fallback) and re-drew `whitebait.svg` (fish scale 1.3 → 1.5, outline `#4d4837` / 2.1 → `#2e2a1d` / 2.8). Both are PROVISIONAL until the 390×844 / 360×800 HV.

Eggplant (Style Lock §12, Owner adoption 2026-11-05, Fry-only Pilot): `eggplant.svg` (candidate A, two round slices) promoted byte-for-byte from [`../../candidates/ingredient-icons-2.0-eggplant-fry/svg/eggplant-a.svg`](../../candidates/ingredient-icons-2.0-eggplant-fry/svg/eggplant-a.svg). Design adoption only: **not implemented** (no `pieceVisual` yet; Fry G2 is gated). Baked / fried states are CSS variables on this same SVG (see `eggplant-a-states.css` in the candidates directory).
