# MID_BAKE independent contract (Issue #795)

Status: unwired, Production OFF. The module has no UI, reducer, recipe-catalog, scoring, save,
inventory, Research, Hint, Preview, or shared-Preview integration.

## State model

`idle -> before-window -> window-open -> rebaking -> finished`

- The engine consumes the same normalized `0..1` bake progress represented by the BAKE gauge.
- The provisional addition window is `[0.65, 0.90)`. Its end is deliberately exclusive: at
  `0.90`, the pizza is already rebaking and no more ingredients can be added.
- A direct placement and T9's alternative operation both dispatch `ADD`; the input origin is
  retained only for audit/telemetry and cannot change eligibility or completion.
- Required counts are capped. Unknown, early, late, excess, and wrong-state inputs are no-ops.
- An `ADD` whose `now` is earlier than the last accepted clock (`lastAt`) or is not finite
  (`NaN`, `±Infinity`) is a complete no-op: the original state object is returned unchanged
  (additions, stage, progress and `lastAt` are untouched), for direct and alternative input alike.
  An `ADD` with `now === lastAt` is valid. Stale or non-finite `TICK`/`FINISH` are no-ops too.
- Completion records either `complete` or `missing-additions`; it does not award score or alter
  recipe identity.
- `CANCEL` returns to a fresh idle state with the same immutable plan.

## Cross-process boundary

Requirements can name an incoming state without importing another process. The initial
`pizza-de-lomo-saltado` contract can therefore require `french-fries: fried`; PREP/FRY remain the
authorities that produce that state. The MID_BAKE engine only validates the supplied value.

## Separate integration tasks

These require Owner decisions and edits outside this namespace, so they are intentionally not
part of this implementation:

1. Recipe-plan mapping for eel / natto / okra / sansho-pepper / lomo-saltado and the precise
   ingredient timing/count decisions.
2. BAKE UI placement, guide/window presentation, T9 alternative-control UI, and accessibility.
3. Game reducer, PizzaStage/GameScreen, inventory consumption, save/pending-round behavior,
   scoring, Research, Hint, and staged-catalog activation.
4. Preview/HV entry and any Production activation. `MID_BAKE_EXPERIENCE_PRODUCTION` stays false.

The expansion target (170 ingredients, 177 recipes, 27 methods) is upstream catalog scope; this
module deliberately adds no catalog rows and does not change those counts.
