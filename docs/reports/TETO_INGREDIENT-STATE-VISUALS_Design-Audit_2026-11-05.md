# Ingredient State Visuals — Design Audit (docs-only, 2026-11-05)

Status: **DESIGN ONLY / NO RUNTIME APPROVAL**. Parent #417; related #438, #623, #733, #739, #748 (Batch 18), #738/#747 (Steam), #749/#750 (Fry), #746 (DRIZZLE).
Audited main: `c69cb2b4260fe6586e5ca758d3a0418e0488661e` (PR #750 merged). The source snippets below were verified on this commit. This document introduces no runtime, data, persistence or Production change.

## 0. Owner objective / decision boundary

The objective is **not simply replacing emojis with SVGs**. Each ingredient should have distinct:
1. **Tray Visual**: the ingredient in the tray, Shop and collection surfaces, ideally whole or package/cut ingredient as itself.
2. **Raw Piece Visual**: what is put on a pizza immediately after placement.
3. **Baked Piece Visual**: the pizza piece after baking; preferably continuous visual change **during** baking.
4. **Fried Visual**: a specifically applicable ingredient after an optional fry operation (starting with eggplant).

All are **presentation only**; no ingredient identity changes, recipe changes, score, save schema, stock, ladder, Research, Dex/unlock or Pitz changes. A post-bake placement is never baked retroactively. Keep existing CheesePool / pieceVisual facilities and avoid a second independent renderer. Avoid editing Batch 18's claimed files or Steam's active HOT files. No Production enable or shared Preview update is authorized by this audit.

## 1. Current source map — confirmed

| Source (main) | Observed responsibility | Design implication |
|---|---|---|
| `src/data/ingredients.ts` | `Ingredient.pieceVisual?: DedicatedIngredientVisual`; shared visual identifier; `emoji` retained as fallback. No distinct tray/raw/baked/fried fields. Eggplant, bacon, pepperoni and mushroom have **no** `pieceVisual` yet. | Any future catalog mapping must be coordinated with Batch 18's `ingredients.ts` claim. Do not change ids. |
| `src/components/IngredientGlyph.tsx` | `pieceVisual` -> one dedicated inline SVG (`VISUAL_VIEWBOX`, mostly 64); otherwise emoji. Same glyph participates in tray, piece and related views. | Extend the existing visual vocabulary; avoid a new unrelated SVG rendering framework. |
| `src/components/IngredientPieceVisual.tsx` | One shared physical-piece renderer; cheese without `pieceVisual` keeps `.pizza-cheese` CSS, cheese with one uses the SVG in its CSS wrapper; other toppings use `IngredientGlyph`. Accepts `style` and `className`. | Best rendering seam for context-sensitive **piece** appearance, while preserving older call sites. |
| `src/components/PizzaStage.tsx` | Continuous `computeBakeHeat`, `cheeseVisualFrame`, `toppingVisualFrame`; uses `IngredientPieceVisual` for ordinary pieces; optionally `CheesePoolCanvas` for mozzarella; uses `preparedPieceVisual` / `searedPieceVisual`. | Add visual context/heat at this already centralized location only after Steam merge / HOT gate; avoid scoring-state boundaries. |
| `src/logic/bakeVisual.ts` | `computeBakeHeat` continuous 0..2; roast and melt styling separated from `classifyBake` scoring judgement. | Reuse heat to interpolate gradual changes; never snap the art at score boundaries. |
| `src/components/CheesePoolCanvas.tsx`, `src/logic/cheesePoolBake.ts`, `src/preview/cheeseRenderMode.ts` | Existing mozzarella-specific melt/render pool with M1 fallback. `CHEESE_CANVAS_DEFAULT_ON = true` on the audited main; devices can opt back to CSS M1. | **Reference implementation**, not a mandate to canvas-render every food. Preserve pool reach, clipping and fallback. |
| `src/state/pieceBakeClass.ts`, `src/components/PostBakePiece.tsx` | Pre/post toppings partitioned. Post-bake pieces render in the sibling `.pizza-post-layer` without oven filter; `PostBakePiece` deliberately passes no bake style. | Keep post-bake fresh regardless of final oven heat; any future visual resolver must receive a post-bake guard. |
| `src/data/fryIngredients.ts`, `src/logic/fry/friedLook.ts`, `src/logic/fry/fryOffer.ts` | Fry F1 already merged, with eggplant-only target gated by presence of `pieceVisual`, CSS-var fried look and **no reducer/UI wiring**. | Eggplant art unblocks the target guard, but **does not authorize F2/F3**. Its look must later compose with bake and other preparation effects. |
| `src/App.css` | Topping sizing/filters, cheese CSS, SVG glyph scale overrides, post-bake visual layering. | HOT; prefer isolated or append-only CSS after conflict recheck. |

### Important baseline details

- The icon-progress draft on branch `claude/ingredient-icons-svg-ojwgap` reports **97 ingredients / 35 SVG / 62 not yet SVG**, divided 15 sauce / 14 cheese / 68 topping. This is a snapshot, not the authoritative visual-state count.
- Existing artwork for #623 salmon/cream-cheese, #733 beef/green-pepper and #739 umeboshi-paste/whitebait is present in audited main; those Issues remain OPEN and their **iPhone HV is not thereby PASS**. Avoid reimplementation.
- The current `pieceVisual` name is a single drawing in all contexts: a dedicated icon *alone* is not a distinct cooked shape.
- Current per-topping bake tint/filter already changes continuously; proposed new work adds **ingredient-specific silhouette/material evolution** without disrupting that tint.
- A fryer illustration cannot be inferred from the current frying CSS vars alone; `friedPieceVisual` is a pure non-wired F1 helper. Do not claim that fried art or a fryer screen currently exists in gameplay.

## 2. Proposed presentation contract (not approved implementation)

**Prefer a non-persisted visual resolver over extra gameplay state**:

```ts
// Illustrative interface only — NOT code to apply unchanged.
type VisualContext = "tray" | "raw-piece" | "baking-piece" | "baked-piece" | "fried-piece" | "post-bake-piece";
type VisualFrame = {
  visual: DedicatedIngredientVisual | undefined;
  // Optional transitional overlay or paint params; no ingredient identity.
  blend?: number; // 0..1, driven by continuous bake heat
  className?: string;
  cssVars?: Record<string, string>;
};
resolveIngredientVisual(ingredient, context, { bakeHeat, fryAmount }): VisualFrame;
```

- Use `IngredientGlyph` for Tray/Shop/Inventory/Dex surfaces, with a **tray/whole-food appearance** when available. Existing call sites without explicit context must retain their established fallback.
- Use `IngredientPieceVisual` as the **only piece renderer**; pass a presentation-only context from `PizzaStage` and preserve existing `.pizza-cheese` and SVG fallbacks.
- For raw/baked shape differences, prefer related SVG groups and a heat-driven overlay/crossfade or SVG path/CSS variables. Keep clipping, piece rotation, 390x844 rendering and CUT footprints consistent. No hard visual switch at `classifyBake` thresholds.
- Do not route a post-bake `PostBakePiece` through oven heat: its `stage: "post"` must override a cooked visual even at RESULT.
- The **fried** state is an optional prepared treatment, not another baked-stage synonym. Its tint/sheen must compose with bake tint **without replacing the single effective CSS `filter` by accident**. Define precedence/composition at the rendering seam and test with sear/prep/Steam; no reducer or state change here.
- Do not add shape metadata to persisted `PlacedTopping` or new serialized save fields. Store only transient drawing parameters in the view layer or read existing transient preparation flags when separately approved.
- Use the existing mozzarella CheesePool rendering for mozzarella only; preserve Canvas fallback and cut reach calculations. A separate Canvas per topping type is **not** the starting architecture.

## 3. Pilot proposal (3 items; requires visual HV before broad rollout)

| Pilot | Tray Visual | Raw Piece | Baking / Baked Piece | Fried | Reason |
|---|---|---|---|---|---|
| **eggplant** (priority 1) | whole purple aubergine | sliced rounds with dark skin / pale center | browned/shrunk sliced round, gradual spots | optional oil sheen / golden or overdark version, using F1 variables once wired | Fry #749's *exact* prerequisite; currently lacks `pieceVisual` |
| **bacon** (priority 2) | long fatty bacon slice | shorter strips | curled, shrunk, browned edges/fat | not in Fry Phase 1 | Test a distinct meat silhouette, not just a color tint |
| **mushroom** (priority 3) | whole cap mushroom | thin cross-section slice | smaller/darker roasted slice | not in Fry Phase 1 | Test whole-to-cut-to-shrunk vegetable/fungus, independent of Fry |

Visual candidates, sizes and styling are **proposals**; do not treat them as an Owner-approved Style Lock revision. Include mozzarella as the **existing control**, pepperoni (slice -> round -> cupped/oily edge) as the next pilot/wave, and salami as a distinct comparison asset; the separate independent pepperoni / salami / bacon SVG concept work may proceed docs/asset-only without touching claimed code.

Comparison sheet: show each pilot in tray / raw / mid-bake / just baked / overbaked / where applicable fried, at ~20/24/28/32/48px, on dough and darkened crust, including grayscale and nearby similar ingredients. Include 390x844 and 360x800 viewport mockups; check one-screen layout. Show a control with prior icon so changes are not conflated with scaling.

## 4. Safe rollout (requires further gates)

1. **D0 audit and asset proposal (NOW, docs-only):** validate this map against main; choose SVG variants/continuity; produce 3 pilot comparison sheets and a file-level change matrix. No catalog or Stage edit.
2. **D1 asset-only:** draw/compare eggplant whole + sliced + browned + fried states and bacon/mushroom shapes (plus pepperoni/salami concepts); isolate reference assets, never replace existing Style Lock material without approval.
3. **D2 integration after conflict clearance:** after #748 claim release or coordination, add only approved visual mapping to `ingredients.ts`; after #738 merge, adapt `PizzaStage.tsx` / `IngredientPieceVisual.tsx` / `IngredientGlyph.tsx` with display-only parameters. Maintain backward compatibility for the other 94 ingredients.
4. **D3 targeted verification:** focused rendering/unit tests, bake heat continuity, zero changed recipe/save/scoring snapshots, FINISH post-bake regression, Steam/prep/sear appearance compositing, Canvas mozzarella fallback, CUT/half pieces, Shop/tray/RESULT and 390x844 + 360x800 E2E/screenshot.
5. **D4 Owner iPhone Safari HV:** compare A/B materials at actual size; video + before/after screenshots per `TETO_HUMAN-VERIFICATION-POLICY.md`, with Owner verdict before enabling wider rollout.
6. **D5 batches for 62 remaining:** prioritize Fry dependency -> high-confusion meat/vegetable -> sauce and cheese icons -> remaining cohorts. Recount the 97 snapshot on every batch, preserve unconverted fallbacks, and do not start Pilot B cheese (grana-padano/parmigiano/gorgonzola) until #438 Owner HV is recorded.

## 5. Parallel session / conflict matrix (2026-11-05)

| Parallel work | Claimed/touched files | Decision |
|---|---|---|
| **Batch 18 #748** | Claim through 2026-11-18 includes `src/data/ingredients.ts`, recipe/ladder/taxonomy/size files and B18 docs. B18 implementation is on a branch but stopped before PR due to a measured existing BBQ Research-label change. | **HOLD catalog edits**, do not overwrite B18 branch. D0 and isolated reference art are safe. |
| **Steam #738** | Open PR, HEAD `85b4a07`. Touches `PizzaStage.tsx`, `GameScreen.tsx`, `App.tsx`, `main.tsx` and Steam modules; iPhone HV pending. | **HOLD Stage integration until Steam is merged** and rebased; design-only is safe. |
| **Steam runbook #747** | docs-only, one dedicated file; not a deployed Preview. | Independent; use it for H1–H14 iPhone testing. |
| **Fry #749/#750** | F1 in main, F2+ not approved; eggplant lacks a dedicated drawing. | Design eggplant visually now; no reducer/F2/Production change. |
| **DRIZZLE #746** | Open; `main.tsx` and isolated Preview/DEV lab. | No overlap with this design document. |
| **Icons #417/#438** | Pilot A in main, #438 HV result outstanding; draft inventory is on another branch and no PR. | Do not overwrite or prematurely promote Pilot B; D0 is a separate file. |
| **Other visuals #623/#733/#739** | Main contains relevant art; iPhone HV records outstanding. | Reuse, review and verify only; no duplicate implementation. |

No claim is made on HOT files by this docs-only audit. Before any future runtime change, read live claims and the Owner Gate report, search open/closed Issues and PRs for overlapping scope, and post a narrow implementation claim.

## 6. Acceptance and HOLD summary

- **This audit's completion:** one docs-only report; explicit source/constraint map and 3-pilot proposal; no CI/HV claims (docs-only).
- **Safe immediately:** screenshots/reference sheets; visual experiments without touching catalog/Stage; independent pepperoni/salami/bacon icon proposals; ingredient inventory refresh after upstream changes.
- **HOLD:** changing `ingredients.ts` while #748 claim remains; changing `PizzaStage.tsx` before #738 merge; replacing baked filters globally; F2+ or Fry/Steam Production ON; shared Preview replacement; Pilot B cheese before #438 HV.
- **Owner decisions still required:** preferred visual variant per pilot, per-state art approval, exact eggplant art integration gate, Steam A/B and merge, Batch 18 BBQ Research-label shift/step exceptions, Pilot A HV/Pilot B gate.

Source authority: `CLAUDE.md`, `docs/PROJECT_HANDOFF.md`, `docs/decisions/TETO_SESSION-OPERATIONS_1.0.md`, `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`, and linked active Issues/PRs. This document must not supersede their Owner Decisions.
