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
