# Discovery 3.0 PR-3 — key-free Hint (OD-D3-19 Migration A + OD-D3-21) Result

Base: `main` `ae62bb6` (independent of PR-2; not stacked). Internal change; **no production-visible behaviour change** (no production recipe is key-free; none added), so no new Human Verification (S2 Gate §5).

## Change
- `KeyFreeHintRoles { keyFree: true }` and `HintRolesEntry` (union) in `src/data/recipeHintRoles.ts`. `RECIPE_HINT_ROLES` stays `Record<RecipeId, RecipeHintRoles>` (the 25 are unchanged and type-enforced); only an injected roles table can hold a key-free entry.
- `buildHint5Ladder`: a key-free recipe gets SAUCE (only if it has a sauce) -> CHEESE (only if it has a cheese) -> STRUCTURE -> one SUB_CLASS per topping in catalog order. No KEY_TOPPING, no empty / dummy / "none" rung, prices and fact formats unchanged. `hint5RolesValid` checks catalog + T-COV only (nothing authored).
- `hint5Presentation`: the STRUCTURE position is found by rung kind instead of the fixed index (identical for the 25).
- `requestHint5Rung` / `hint5Presentation`: optional trailing `roles` argument (default `RECIPE_HINT_ROLES`).

## Not changed
`hintKeyIngredientId`, near-miss authority, the 25 recipes' roles, prices (OD-D3-14), fact kinds / save schema, HintSheet, production recipes, flags. Rung absence is the accepted consequence (OD-D3-21).

## Tests
- `hint5Existing25.golden.test.ts`: ladder + presentation + request result at every purchase step (Dex-5, Dex-0 onboarding, 0 Pitz) for all 25 recipes, compared with `hint5Existing25.golden.json` **generated from `main` before this change**.
- `hint5KeyFree.test.ts`: full / no-cheese / no-sauce / no-sauce+no-cheese / no-topping fixtures; no empty or dummy rung; catalog-order SUB_CLASS; contiguous `ヒント1..n` labels; prices; STRUCTURE gating; stale refusal; fail-closed on unknown ingredient / missing roles; production data still key-ful.
- Existing Hint 5.0 suites (ladder, taxonomy gate, production gate, migration, reducer, HintSheet) pass unmodified.

## Verification
`tsc -b` + `vite build` OK; `oxlint` (no new warnings); `vitest run` 5470 passed, 1 skipped. WebKit / layout gates run in CI.
