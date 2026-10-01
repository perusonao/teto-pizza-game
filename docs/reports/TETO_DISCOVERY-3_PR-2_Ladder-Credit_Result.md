# Discovery 3.0 PR-2 — ladderCredit (OD-D3-17 O3) Result

Base: `main` `ae62bb6` (not stacked on any other PR). Internal change; **no production-visible behaviour change** (no production recipe sets `ladderCredit: false`), so no new Human Verification (S2 Gate §4 / §10).

## Change
- `Recipe.ladderCredit?: false` (absent = counts). Existing 25 recipes untouched.
- `countsTowardLadder(recipeId)` in `src/data/recipes.ts`: true unless the recipe sets `ladderCredit: false`; ids not in `RECIPES` count (old / unknown saves).
- `discoveredRecipeCount(dex, counts = () => true)`: optional predicate, default identical to before.
- The two ladder call sites pass `countsTowardLadder`: `resolveShopEntitlement` (extra optional `counts` param, default `countsTowardLadder`) and `ShopOverlay`.

## Not changed
`W1_25_DISCOVERY_LADDER` / `DISCOVERY_LADDER`, `validateLadderProgression`, save schema (count is derived from the Dex, never stored), entitlement union (no re-lock), Dex display counts, Hint `discoveredCount`, brazilian-calabresa (not added), any UI.

## Tests (`src/logic/ladderCredit.test.ts`)
existing-25 count parity at every prefix, duplicate / undiscovered / unknown-id entries; synthetic non-credit recipe not counted, step number and next-material hint unchanged; entitlement parity vs legacy at every count, ledger never shrinks; unknown-id save compatibility.

## Verification
`tsc -b` + `vite build` OK; `oxlint` (pre-existing warnings only); `vitest run` 5454 passed. WebKit / layout gates run in CI.
