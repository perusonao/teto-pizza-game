# Square Dough F3 — RESULT shared copy (Issue #538 / Epic #532)

Independent of F2 (#548): F3 touches `ResultPanel.tsx`, `GameScreen.tsx` and new files only; F2 touches techniques / Dex / gate tests. No overlap, no dependency.

## Copy (exact)
`材料だけでなく、生地の形や調理法も見直してみよう。` — `src/state/panShapeNotice.ts` (`PAN_SHAPE_NOTICE_JA`), the only source holding it (pinned by test).

## Behavior
* `panShapeNoticeJa(pizza)` is a pure function of the explicit `PizzaState.pan === "tray"` (F1). It never reads the matcher outcome, recipes, hints, Dex, technique ledger or a Research target, so ORIGINAL / AMBIGUOUS / INCOMPLETE_MATCH render **byte-identically** (differential test, incl. Research card).
* Rendered on the ORIGINAL card (Free Cooking) under the execution advice. MATCHED and failed-cook cards are untouched. Round pizzas: no text, DOM identical to before.
* Names no technique (「天板焼き」 is not shown; the technique stage and its timing are unchanged), recipe, ingredient, count or distance. Research G2 lead (`RESEARCH_ORIGINAL_LEAD_COPY`) and ○× rows unchanged.
* Inert in production: nothing sets `pan: "tray"` until the ○□ switch (F4) / Grandma (E).

## Verification
tsc -b clean; oxlint no new warnings; vitest (components/state/screens/logic/techniques/discovery) 266 files, 5297 passed. New: `ResultPanel.panShape.test.tsx`.

Human Verification: not required — the line cannot render in production (no way to set the tray pan yet), so there is no player-visible change; HV happens with F4/E.
