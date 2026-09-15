# PIZZA_GAME Phase 4A-1B: Ingredient Palette Fixed Grid — Design Note

## Why

Physical iPhone Human Feel retest #1
(`docs/reports/PIZZA_GAME_Phase4A-1B_iPhone-HumanFeel-Fix_Result.md`) still
came back FAIL after the drag-threshold/iOS-callout fix. User read on the
cause: "チーズやトッピングが横スクロールするのが原因だと思う" (cheese/topping
horizontal scroll is likely the cause). This tracked — `IngredientTray`'s old
single-row, horizontally-scrolling layout put "scroll the tray" and "drag a
piece onto the pizza" on the exact same single-finger swipe gesture,
`touch-action: pan-x` notwithstanding, so every drag start was also a
candidate scroll the browser had to arbitrate.

Fix #2 (this change) replaces the scrolling tray with a fixed, non-scrolling
3-column x 2-row grid (`MAX_INGREDIENT_PALETTE_SLOTS = 6`, see
`src/data/ingredients.ts`), so there is no competing gesture left to
arbitrate at all. Scoped narrowly on purpose — see "What this explicitly did
not do" below — so the gesture-conflict fix's effect can be measured on its
own before anything else changes.

## What this explicitly did not do

- **No category subdivision.** Today's three categories (Sauce/Cheese/
  Topping) are unchanged. Splitting them further is a plausible future
  answer to "what if a category needs more than 6 ingredients some day",
  but adding it now would confound this round's Human Feel measurement —
  a retest that passes wouldn't tell us whether the grid fixed it, the
  narrower categories did, or both. It's tracked below as a follow-up
  instead.
- **No new ingredient-selection screen.** The Palette still lives inline in
  `IngredientTray.tsx`, unchanged in every way except the grid/scroll
  behavior and the 6-slot cap.
- **No change to which ingredients are owned.** `STARTER_INGREDIENT_IDS`
  (`src/data/ingredients.ts`) is untouched. Every category currently owns
  <=6 ingredients, so the 6-slot cap is a no-op today, not a product
  restriction being introduced by this change.

## Follow-up candidates (not implemented)

### 1. Category subdivision

If a category ever needs to hold more than 6 owned ingredients (the
`onion`-style progression-unlock path makes this plausible for Topping
first), the fixed-grid-with-cap approach stops being enough on its own —
truncating to "first 6 owned" would silently hide a purchased ingredient
from the Palette. The candidate split, finer than today's three tabs:

- Sauce
- Cheese
- Meat/Seafood
- Vegetable
- Herb
- Finish

Each still capped at <=6 via the same `MAX_INGREDIENT_PALETTE_SLOTS`, so no
category ever needs scrolling. This needs its own design pass (tab bar
layout at 6 tabs instead of 3, category assignment for every existing and
planned ingredient, whether tabs scroll horizontally themselves) — out of
scope here.

### 2. "Seat ingredients on the countertop" loadout

A further-future reframing: instead of the Palette showing "every owned
ingredient in this category, first 6", the player explicitly chooses up to
6 ingredients to bring to the countertop for the round (a loadout/prep
step), and the Palette just renders that fixed set. `MAX_INGREDIENT_PALETTE_SLOTS`
is written to be the same constant either feature would cap against, so
introducing this later would not need a second, competing cap.

## What did change (implementation summary)

- `src/data/ingredients.ts`: `MAX_INGREDIENT_PALETTE_SLOTS = 6`.
- `src/components/IngredientTray.tsx`: items sliced to the cap before
  rendering.
- `src/App.css`: `.ingredient-tray` is `display: grid; grid-template-columns:
  repeat(3, 1fr); grid-template-rows: repeat(2, 1fr);` — no `overflow-x`, no
  scroll container. `.ingredient-chip--physical`'s `touch-action` went from
  `pan-x` (reserved for the scroll this fix removes) to `none` (nothing left
  for iOS Safari to arbitrate before pointer events reach the drag
  handlers — the same setting `.pizza-dough--interactive` already uses for
  the sauce-paint gesture).
