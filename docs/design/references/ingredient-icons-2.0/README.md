# Ingredient Icon 2.0 — adopted reference SVGs (Issue #417)

Authority: [`docs/decisions/TETO_INGREDIENT-ICON-2.0_STYLE-LOCK-V2.md`](../../../decisions/TETO_INGREDIENT-ICON-2.0_STYLE-LOCK-V2.md)

This directory holds only the **Owner-adopted** icons: 27 SVGs (25 from Style Lock §1 / §1b, plus `shiso` and `whitebait` added by Batch 8b; `salmon-roe` is in PR #584 and is not here) (`<ingredient id>.svg`, 64×64, transparent background) plus
`style-lock-v2-comparison-sheet.png`. `clam` is intentionally absent (the existing 32×32 `clam-valve` is kept).

Not here, and not adopted: everything under
[`../../candidates/ingredient-icons-2.0-remaining/`](../../candidates/ingredient-icons-2.0-remaining/) — in particular its
`svg-not-adopted/` folder (rejected alternatives) — is comparison history only.

Ingredient Visual V1 (PR #690, Style Lock §1e) added `pickles.svg`, `wurstel.svg` and `paprika-powder.svg` (the art of `pickle-slices` / `wurstel-links` / `paprika-powder-pile`; Owner image HV PASS on 390x844, 2026-10-28).

These files are design references; nothing in `src/` reads them yet.
