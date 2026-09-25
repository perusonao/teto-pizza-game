# Progression 2.0 W1 Integration I3 — Production Visual P1 onto main (Result)

- Task: W1 Integration **I3** (`docs/reports/TETO_PROGRESS2_W1_INTEGRATION_PREFLIGHT.md` on branch
  `claude/teto-w1-integration-preflight-9gp9cl`, §I3 / "P1 = CHERRY-PICK").
- Branch: `claude/teto-pizza-w1-i3-integration-r29v6g`
- Base (fresh `main` at start): `46513b17df17c7537432a36fdcb2957592c9dae4` (Merge PR #206, I0).
- Source: Production Visual P1 implementation `39ce35cc80b17574ed85e60c71f989acb1b41237`
  (FINAL PASS; Human PASS record `802b023` on `claude/w1-ingredient-visual-preview-mt4uxw`).

## 1. Fresh audit (latest main vs P1)

| Check | Result |
|---|---|
| `39ce35c` / `802b023` reachable from main | No (branch only) — confirmed at `46513b1` |
| RT-01 (`63d3acf`) on main | **No** — no RT-01 PR open or merged. The `PizzaThumbnail.tsx` P1×RT-01 conflict therefore does **not** arise in I3; it becomes RT-01's (I2's) job to keep both the RT-01 changes and the `IngredientGlyph` import/usage when it lands after this |
| main `src/` drift since P1's base `dff233c` | `src/state/persistence.ts` + its forward-compat test only (I0 / PR #206) — no overlap with P1's 11 files |
| Integration method | `git cherry-pick -x 39ce35c` only (preflight recommendation: not the whole branch). **Clean, no conflicts.** The preview app, the W1 Visual Gate evidence, and the `tools/p1_visual_regression` harness are **not** brought in |

Integrated slice (`39ce35c`, 11 files, +640 / −8): `IngredientGlyph.tsx` (+test), `ingredients.ts`
(optional `pieceVisual?: DedicatedIngredientVisual`, no row sets it), `App.css` (`.ingredient-glyph`
sizing, matches nothing yet), and the 8 render sites.

## 2. Required confirmations

| Item | Result |
|---|---|
| IngredientGlyph | No `pieceVisual` → bare emoji text node (same DOM as `{ingredient.emoji}`); with one → inline SVG (fresh-tomato B / capers cluster / clam B), selected by the declared visual, never by id |
| `ingredients.ts` optional `pieceVisual` | Optional type field only; `grep pieceVisual src/data/ingredients.ts` = the declaration only; 22 rows, none set it |
| 8 render sites | Piece (`IngredientPieceVisual`), tray chip + drag preview (`IngredientTray`), RESULT list (`ResultPanel`), Pizza Select thumbnail (`PizzaThumbnail`), Inventory, Shop, Dex. No other `src/**/*.tsx` renders `.emoji` (grep + the src-wide checker test) |
| Emoji fallback | `emoji` still required on `Ingredient`; unit test pins identical markup for all 22 ingredients at every site |
| Save schema | Unchanged — no diff under `src/state/**` / `src/logic/**`; save key/schema guard test passes |
| Current 22 ingredients' visual output | Unchanged — see §4 |
| New ingredients | **0** (7 W1 ingredients not registered) |

## 3. Tests (tested SHA = this branch's integration head, see PR)

| Check | Result |
|---|---|
| `tsc -b` | PASS |
| `oxlint` | PASS (0) |
| `vitest run` | **2484 / 2484** PASS (incl. `IngredientGlyph.test.tsx` 49/49) |
| `vite build` | PASS |
| Chromium e2e (`iphone-390x844` + `iphone-360x800`) | **116 / 116** PASS |
| WebKit Gate (CI, `e2e-webkit.yml`, 4 shards + gate) | recorded on the PR |

## 4. Visual regression (BEFORE = main `46513b1` build, AFTER = integration build)

P1's own pixel harness (`tools/p1_visual_regression/before-after.spec.ts` from `d323d36`, run
locally, not committed): seeded save owning all 22 ingredients, deterministic RNG, animations off.

| Viewport | Captures | Pixels changed > 2 | Exact changed pixels |
|---|---|---|---|
| 390×844 | 22 | **0** | 0 in every capture |
| 360×800 | 22 | **0** | `07-bake`: 3 (±1 gauge-edge renderer jitter, same as P1's own report); 0 elsewhere |

Before/after screenshots + pixel reports: `docs/reports/screenshots/w1-i3-production-visual-p1-integration/`.

## 5. Human Verification

The integrated change is a presentation-layer refactor that does not change appearance or
interaction for any current ingredient (policy §2 "内部refactorのみ"), and the identical code
already has Human Verification PASS (`802b023`). I3 therefore adds no new video; the evidence is
the pixel harness (§4) plus the committed before/after screenshots.

## 6. Out of scope (not touched)

P2, registering the 7 W1 ingredients, W1 recipes, Discovery Ladder, RT-01 / RT-01c, any new Owner
Decision.
