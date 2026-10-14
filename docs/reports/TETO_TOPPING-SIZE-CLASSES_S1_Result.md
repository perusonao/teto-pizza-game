# Topping Size Classes 1.0 — S1 Result (Issue #479)

Slice S1 only: pure data. Base: `main` `2db1a52`.

## Added
- `src/data/toppingSizeClass.ts` — `ToppingSizeClass` (`xs|s|m|l|xl`), the 58-id class table, `toppingSizeClass(id)` (unknown / sauce / inherited-key ids fall back to `m`), and two **provisional** multiplier candidate sets (A `0.6/0.8/1/1.25/1.5`, B `0.7/0.85/1/1.15/1.3`). There is deliberately no single "the" scale constant (Owner Decision 5).
- `src/data/toppingSizeClass.test.ts` — coverage of every scatter ingredient, no stray entries, all five classes used, Owner-approved boundary ids, fallback, and per-set monotonic / positive / medium = 1 checks.

## Not changed
No component, stylesheet, PizzaStage, CUT, Canvas cheese, scoring, save, recipe or economy file imports or changes. Nothing reads the new module yet, so every ingredient is drawn at its current size. No UI change, so the Human Verification video / screenshots do not apply (CLAUDE.md applies them to UI / gameplay changes).

## Distribution (58 scatter ids)
xs 7 / s 11 / m 20 / l 15 / xl 5. pineapple = m; basil = xl, egg = l, bacon = l, black-olive = s (Owner-approved provisional). Not pinned as counts in the test, so adding ingredients does not need a count edit — only a table row.

## Interaction with open PRs
- #492 (Batch 7a) adds scatter ingredients `mint`, `lamb`, `sweet-potato`. The coverage test is strict by design, so once both are on `main` the test fails until three rows are added (suggested, for Owner confirmation: mint `xs` (herb), lamb `m`, sweet-potato `m`). Whichever PR lands second adds them.
- #417 / #487 / #491 / #494 / #468 / #478: no shared file.

## Open for S2+ (Owner-gated, not started)
Cheese base sizes vs. class multipliers (Decision 4); A/B comparison on representative pizzas; Canvas mozzarella `sizePx`; CUT `TOPPING_REACH`; apparent-size correction for geometric emoji.
