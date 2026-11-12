# Ingredient Icons 2.0 / Fry — 4th visual state integration addendum (2026-11-05)

**Status:** docs-only **supplement**, no runtime approval. Target main: `c69cb2b4260fe6586e5ca758d3a0418e0488661e` (Fry F1 PR #750 merged).
**Prior design authority to reconcile with:** `docs/reports/TETO_INGREDIENT-ICON-2.0_PIECE-BAKE-LOOK_Design-Audit.md` on branch `claude/ingredient-icons-svg-ojwgap`, HEAD `ea0ca07c6481b494b16d1c3b1e8fe8f27b4a5e4a` (3-layer Tray/Raw/Baked proposal, base `0016222`). This addendum **does not replace** it or its proposed bake Pilot `shrimp -> bacon -> pepperoni`; it covers what changed once Fry F1 merged and extends the question to a **fourth, optional Fried Visual**.

Refs: #417 (Icons), #438 (Pilot A HV), #738/#747 (Steam), #748 (Batch 18), #749/#750 (Fry).

## 1. New main facts since the earlier bake audit

- PR #750 is **merged**, not pending. Fry F0/F1 are present as pure, currently non-wired modules. No fryer gameplay, UI, reducer action, new ingredient art, or production enablement has been authorized.
- `src/data/fryIngredients.ts`: `canFryIngredient(id)` accepts only target id `eggplant` **and** a declared `pieceVisual`. Eggplant remains an emoji-only row in `src/data/ingredients.ts`; thus the target is deliberately dormant.
- `src/logic/fry/friedLook.ts`: `friedPieceVisual(amount)` is a pure helper returning a class and CSS variables `--fry-bright`, `--fry-sat`, `--fry-sepia`, `--fry-sheen`. It is **not** proof that CSS or reducer/UI is wired. It does not own the placement transform and cannot introduce a second independent source of bake judgement.
- `src/components/PizzaStage.tsx` already computes continuous `bakeHeat`; `toppingPieceStyle` applies the shared roast tint; optional sear/prep styles compose at the `IngredientPieceVisual` seam. `src/components/PostBakePiece.tsx` deliberately avoids baked styling.
- `src/preview/cheeseRenderMode.ts` already has `CHEESE_CANVAS_DEFAULT_ON = true`, with M1 fallback. Existing mozzarella spread/melt is a **reference**, not a template requiring Canvas for every topping.
- The pending Batch 18 claim through **2026-11-18** includes `src/data/ingredients.ts`; #738 Steam's open PR includes `PizzaStage.tsx`. No source edit to those files is permitted here without cross-session coordination.

## 2. Reconcile the four visuals without a duplicate rendering engine

| State | Intended presentation | Reuse and constraint |
|---|---|---|
| **Tray Visual** | Whole eggplant shown in Tray/Shop/Inventory/Dex; icon remains recognizable at 20–48px. | `IngredientGlyph` and existing `pieceVisual` path. The earlier bake audit currently proposes using the same visual for Tray and pizza unless explicitly approved otherwise. |
| **Raw Piece Visual** | Eggplant slice placed on dough, pale center and purple skin. | Existing `IngredientPieceVisual` with an optional future pizza-specific variant. **Do not silently change** the earlier audit's `pizzaVisual`-only-if-needed decision; show the comparison first. |
| **Baked Piece Visual** | Same slice gradually shrinks/browns as baking progresses. | Use the earlier bake audit's `bakeHeat` / CSS-variable interpolation; do not add a timer, baked state to a save, score-based switching, or global roast override. |
| **Fried Visual** | Slice after optional Fry, golden oil sheen and crisp/overdark appearance, with variation coming from the existing `friedLook` value. | Consume F1 output **only once F2/F3 are separately approved**. Compose with oven heat at the shared piece-render seam, not a second SVG infrastructure. |

**Scope clarifier:** Fried is an *optional preparation treatment*, not a universal fourth bake level. A fried eggplant can subsequently be baked; therefore describe it as `base slice + transient fried treatment + optional bake heat` rather than mutually exclusive global modes. A post-bake piece must never receive oven-derived styling merely because a pizza's finished heat is available.

**Composition risk:** the current non-cheese piece has one inline `filter` from `toppingPieceStyle`; prep/sear already add styles and classes. The Fry helper currently returns CSS variables, not a replacement filter. Before any UI/reducer integration, design a single compositing rule for brightness/saturation/sepia/size/oil effect, with tests that verify no double-darkening and no override of placement scale, `data-topping-id`, half/CUT clip, or post-bake isolation.

## 3. Parallel pilots (proposal, not new Owner authorization)

The prior bake audit already proposes a 3-food *render-mechanic* Pilot: **shrimp -> bacon -> pepperoni**. Keep it as the existing candidate, subject to Owner review; it tests existing SVG, shrink, cupping and oil gloss without requiring new Fry wiring. **In parallel and ahead of Fry F2**, produce an **eggplant visual-only concept sheet**: whole, raw slice, mid-bake, baked, crisp-fried and over-fried. Include existing emoji before/after, 20/24/28/32/48px, pale and charred dough, grayscale, 390x844 / 360x800. A sample picture is **not** an approved SVG.

The eggplant concept sheet is a prerequisite to proposing its `pieceVisual` integration; do **not** turn the target rule true as an incidental effect while Batch 18 is active. The exact answer to whether eggplant replaces one of the 3 bake Pilot candidates is **Owner decision**, not something this addendum may silently choose. If eggplant is kept as a separate Fry-specific pilot, the first bake Pilot can remain the original low-risk shrimp.

## 4. Conflict / handoff update

| Workstream | Fresh status and file overlap | Gate |
|---|---|---|
| Batch 18 #748 | Work branch `claude/teto-pizza-game-content-9ctr2x`, HEAD `ce58363078aeeed7211780f3592b5de890d70e1c`; claim includes `ingredients.ts` until 11/18. Two recipes coded, stopped on existing BBQ Research-label shift; PR not opened. | No eggplant mapping or catalog edit until claim released or explicit coordination. Never discard the B18 safety stop. |
| Steam #738 | Open HEAD `85b4a0700ea0dce9f20823dcb44526e269a13cd9`; 11/11 checks success, Codex current HEAD clean and 0 unresolved threads; Owner iPhone HV needed. | No shared `PizzaStage.tsx` integration until Steam merge and fresh overlap check. Production OFF stays OFF. |
| Fry #749/#750 | **F1 merged** at main `c69cb2b`, F2–F4 HOLD. `FRY_EXPERIENCE_PRODUCTION = false`. | No reducer/UI wiring; eggplant art first, then separate Owner/F2 Gate. |
| Existing Icon bake audit | Branch `claude/ingredient-icons-svg-ojwgap`, HEAD `ea0ca07`; has 3-layer design already, no PR verified. | Keep its branch untouched. Merge/reconcile this addendum by a future owner/Claude Code review, not an automatic competing implementation. |
| Pilot B cheese | #438 remains without Owner HV PASS record. | Keep expansion HOLD. |
| DRIZZLE #746 | OPEN, Preview/DEV lab, unrelated to this new document. | No Production enable or Preview overwrite. |

## 5. Safe next actions and acceptance

1. Create **eggplant visual-only** concept/comparison without changing `ingredients.ts`, `PizzaStage.tsx`, `App.css`, Fry code, or shared Preview.
2. In the existing D-session, reconcile the three-layer bake audit with this **Fry addendum** and update its old #749/#750 status to **F1 merged**. Avoid copying the original bake audit into a second PR.
3. After Steam merge and Batch 18 clearance, propose a narrowly claimed runtime slice with `IngredientPieceVisual` as the integration seam, F1's `friedPieceVisual` as optional transient style, and zero authority/save/scoring changes.
4. Unit/visual gates must demonstrate: unchanged unprepared ingredients; mid-bake continuity without score-boundary reveal; Fried+Bake composition; unaffected after-bake layer, CUT and mozzarella Canvas/M1; and one-screen actual iPhone 390x844 / 360x800 HV. The Owner alone records PASS.
5. Do not begin Pilot B cheese or promote an experiment to Production without its existing Owner Gate.

No source file, CSS, deployment, production flag, merge, issue closure, or save data is modified by this addendum. The main design remains in the existing Claude Code branch; this is only a collision-safe cross-session delta.
