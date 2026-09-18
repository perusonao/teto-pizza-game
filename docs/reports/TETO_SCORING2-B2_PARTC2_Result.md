# Teto Pizza Game — Scoring 2.0 B2 PART C2 — Bismarck / Quattro Formaggi Implementation (7/7)

**Type:** Implementation of ChatGPT-reviewed-and-approved candidate geometry (proposed in §13 of
`docs/reports/TETO_SCORING2-B2_REFERENCE-COVERAGE_Result.md`) for the final two of seven
recipes, bringing `getReferencePizza` Reference coverage from 5/7 to **7/7**. This is a dedicated
slice report; the tracking report's own §14 carries the summary and status-matrix update.

- **Start HEAD:** `176adde93717918ea3fb3de0bad83476f780352e` (GitHub CI #129: success).
- **Repo / branch:** `perusonao/teto-pizza-game`, `claude/scoring-2-reference-coverage-b2-ytp9ay`
  (PR #57, draft, not merged).
- **End HEAD (this slice):** `3be9fc9e07775d3c4ef60df688d8c7ede60192ad`.
- **Coverage before this slice:** 5/7 (margherita, marinara, funghi, genovese, fugazza — PART C1
  Review Playthrough treated as PASS, per this slice's instructions).
- **Coverage after this slice:** **7/7 — every real recipe.**

---

## 1. Pre-implementation cross-reference (§13 candidate values vs. current code)

Per this slice's explicit process instruction, §13's candidate values were checked against
current `recipes.ts`/`recipeSauceProfiles.ts` before writing any implementation code, and the
design audit was skipped only because no contradiction was found:

| Recipe | §13 proposal | `recipes.ts` `requiredIngredients` | Match? |
|---|---|---|---|
| Bismarck | `tomato-sauce` + `mozzarella×3` + `egg×1` | `tomato-sauce×1, mozzarella×3, egg×1` | ✅ |
| Quattro Formaggi | `olive-oil` + 4× `{mozzarella, gorgonzola, parmigiano, fontina}×2` | `olive-oil×1, mozzarella×2, gorgonzola×2, parmigiano×2, fontina×2` | ✅ |

`recipeSauceProfiles.ts` already mapped bismarck → `tomato-sauce` and quattro-formaggi →
`olive-oil`, matching §13's sauce assumption. **No contradiction found** — implementation
proceeded directly, as instructed.

---

## 2. What was implemented

### 2.1 `src/data/referencePizza.ts`

```ts
export const BISMARCK_REFERENCE: ReferencePizza = {
  sauce: computeMechanicalSauceReference("bismarck"),
  pieceGroups: [
    {
      ingredientId: "mozzarella",
      positions: [
        { x: 31, y: 32 },
        { x: 70, y: 34 },
        { x: 48, y: 72 },
      ],
      interaction: { kind: "PLACE_TOPPING" },
      matching: { fullCreditRadius: 8, zeroCreditRadius: 22 },
    },
    {
      ingredientId: "egg",
      positions: [{ x: 50, y: 50 }],
      interaction: { kind: "PLACE_TOPPING" },
      matching: { fullCreditRadius: 14, zeroCreditRadius: 30 },
    },
  ],
};

export const QUATTRO_FORMAGGI_REFERENCE: ReferencePizza = {
  sauce: computeMechanicalSauceReference("quattro-formaggi"),
  pieceGroups: [
    { ingredientId: "mozzarella", positions: [{ x: 53, y: 33 }, { x: 47, y: 67 }], /* inner ring */ matching: { fullCreditRadius: 8, zeroCreditRadius: 22 }, interaction: { kind: "PLACE_TOPPING" } },
    { ingredientId: "gorgonzola", positions: [{ x: 33, y: 47 }, { x: 67, y: 53 }], /* inner ring */ matching: { fullCreditRadius: 8, zeroCreditRadius: 22 }, interaction: { kind: "PLACE_TOPPING" } },
    { ingredientId: "parmigiano", positions: [{ x: 72, y: 35 }, { x: 28, y: 65 }], /* outer ring */ matching: { fullCreditRadius: 8, zeroCreditRadius: 22 }, interaction: { kind: "PLACE_TOPPING" } },
    { ingredientId: "fontina", positions: [{ x: 35, y: 28 }, { x: 65, y: 72 }], /* outer ring */ matching: { fullCreditRadius: 8, zeroCreditRadius: 22 }, interaction: { kind: "PLACE_TOPPING" } },
  ],
};
```

(field order/comments abridged for this report; see the actual file for the literal source.)
Both are byte-identical to §13.1/§13.2's reviewed proposals. `getReferencePizza`'s internal
`Map<RecipeId, ReferencePizza>` now has all 7 entries; its doc comment was updated to say so.

### 2.2 The `ReferencePreview` bug — found and fixed in this slice

While preparing the Review Playthrough, the pre-existing integration test
`App.playerReference.test.tsx` ("tapping it opens the generic player reference popover, not
Margherita's") started failing once Bismarck got real Reference data: the popover it found had
`aria-label="マルゲリータの見本"` even though Bismarck was the open recipe.

**Root cause:** `src/components/ReferencePreview.tsx` (Issue #47 Slice B, already merged, not
part of this B2 effort originally) hardcoded:

- `aria-label="マルゲリータの見本"` and `<h2>マルゲリータ 見本</h2>`
- Caption text: `ソースをまんべんなく塗って、モッツァレラ3個とバジル2枚を見本に近く置こう。`
- CSS scaling selectors scoped to Margherita's own ingredients only:
  `.reference-mini-pizza__topping--mozzarella .pizza-cheese`,
  `.reference-mini-pizza__topping--basil .ingredient-piece-visual__emoji`

`referenceModeEnabled` (`App.tsx`) gates this popover on `getReferencePizza(recipe.id) !== null`
— **not** specifically on Margherita. Every recipe this B2 effort has covered since PART A
(marinara, funghi, genovese, fugazza) has technically been routed through this same hardcoded
popover already, but none of them happened to expose the bug visibly: their sauce-bar numbers
are still generic/correct, and their caption text being wrong was easy to miss without staring at
it. Bismarck is the first case with a `<h2>` title check in an existing test, and
quattro-formaggi is the first case where the CSS bug would have visibly mis-sized real pieces
(all 4 of its cheese groups are outside the old hardcoded `--mozzarella`/`--basil` selectors, so
they would have rendered as unscaled, oversized `.pizza-cheese`/emoji elements in the popover).

**Fix (display layer only, not scoring):**

- Added a required `recipeNameJa: string` prop to `ReferencePreviewProps`.
- Computed `pieceCaption` from `reference.pieceGroups` at render time (the same pattern already
  used by `PlayerReferencePreview.tsx`), instead of a hardcoded string.
- `aria-label={`${recipeNameJa}の見本`}`, `<h2>{recipeNameJa} 見本</h2>`.
- Generalized the two CSS selectors in `src/App.css` to the ingredient-agnostic pattern already
  used elsewhere (`.reference-mini-pizza__topping .pizza-cheese`,
  `.reference-mini-pizza__topping .ingredient-piece-visual__emoji`).
- `src/screens/GameScreen.tsx` now passes `recipeNameJa={state.recipe.nameJa}`.

This is judged in-scope: it is a UI text/CSS display bug, not a change to scoring weights,
coefficients, authority wiring, `gameReducer.ts`, `missionScoring.ts`, or Player Reference data
— all of which remain untouched. Leaving it unfixed would have made this slice's own required
Review Playthrough demonstrate visibly wrong/misleading Reference diagnostics, which is exactly
the kind of Shadow/legacy/Reference confusion this slice was asked to rule out.

---

## 3. Tests

See §14.2 of the tracking report for the full list of files touched. Summary:

- `referencePizza.test.ts`: per-recipe pins for all 7 `getReferencePizza` results, a 7/7
  coverage loop, an unknown-id-returns-null test, and exact-geometry/tolerance pins for both new
  fixtures (explicitly asserting egg's tolerance is 14/30, not 8/22).
- `scoringV2.test.ts`, `malformedInput.test.ts`, `ScoringV2ShadowPanel.test.tsx`: the
  "Reference-unavailable recipe" example switched from a real bismarck lookup (no longer
  unavailable) to a synthetic `{ ...MARGHERITA, id: "no-such-recipe" }`; `it.each` lists extended
  to cover bismarck/quattro-formaggi for availability, Golden Matrix, and permutation-invariance;
  a new regression test pins that genovese/fugazza (PART C1) are unaffected.
- `playerReference.test.ts`: coverage-matching test now loops all 7 real recipes;
  the Bismarck-specific "no Scoring 2.0 fixture" test was rewritten (false premise now) to prove
  `getPlayerReferencePizza` independence using a synthetic id instead.
- `ReferencePreview.test.tsx`, `App.playerReference.test.tsx`: updated for the new
  `recipeNameJa` prop; the latter is the regression pin for the bug fix (asserts Bismarck's
  dialog shows its own title and zero leftover "マルゲリータ" text).

**Full verification:**

| Check | Result |
|---|---|
| Full suite (`npm test`) | **1061 passed**, 54 files, 0 failed |
| Typecheck + build (`tsc -b && vite build`) | ✅ clean |
| Lint (`oxlint`) | ✅ 0 findings |
| CI (`build` check, PR #57 HEAD `3be9fc9e07775d3c4ef60df688d8c7ede60192ad`) | ✅ success |

---

## 4. Reachability confirmation (live, per recipe)

Both new recipes were driven end to end against a real build (byte-identical local rebuild of
this exact commit, `VITE_PREVIEW_MODE=1 VITE_PREVIEW_PR=57 VITE_PREVIEW_SHA=3be9fc9`, served
locally and driven with real headless-Chromium pointer gestures — the sandboxed environment
cannot reach `perusonao.github.io` directly, so this is the same verification pattern used for
every prior Preview-Gate report in this repo).

**Bismarck** — Reference popover opened before playing, confirming the bug fix live:

```
ビスマルク 見本閉じる🥚トマトソースをまんべんなく塗って、モッツァレラ3個とたまご1個を見本に近く置こう。
```

Dough → sauce (tomato-sauce) → mozzarella×3 at the approved coordinates → egg at (50,50) → bake:

```
Scoring 2.0 Shadow（開発用・phase-4a-2-shadow-3）
Total: 99 / 100
Sauce 99 / Pieces 100 / Recipe 100 / Bake 100
mozzarella 3/3 — 量100% 配置100% → 100
egg 1/1 — 量100% 配置100% → 100
```

**Quattro Formaggi** — dough → sauce (olive-oil) → all 4 cheese groups placed together in the
single CHEESE step (mozzarella/gorgonzola inner ring, parmigiano/fontina outer ring — all four
are `category: "cheese"` in `ingredients.ts`, so `gameReducer.ts`'s `PLACE_TOPPING` gating
requires them all in one step; quattro-formaggi has no topping-category requirement, so the
TOPPING step that follows is a no-op) → bake:

```
Scoring 2.0 Shadow（開発用・phase-4a-2-shadow-3）
Total: 99 / 100
Sauce 98 / Pieces 100 / Recipe 100 / Bake 100
mozzarella 2/2 — 100   gorgonzola 2/2 — 100
parmigiano 2/2 — 100   fontina 2/2 — 100
```

Both results show `available: true`, and the legacy ★ stars/number panel (`★★★★★ 100`,
具材/配置/焼き each 100) is a clearly separate section from the dev-only "🧪 Scoring 2.0 Shadow"
panel in both cases — confirming Shadow, legacy, and Scoring 2.0 are not confused or conflated.

---

## 5. Review Playthrough

- **Video:** `artifacts/review/TETO_SCORING2-B2_PARTC2_Review-Playthrough.mp4` — 390×844, H.264,
  ~45s, real pointer gestures throughout (dough stretch, hold-and-drag sauce paint, tray-select-
  then-tap piece placement, real BAKE gauge timing). Gitignored; delivered directly to the user.
- **What it shows, in order:**
  1. Pizza Select → Bismarck.
  2. Bismarck's Reference diagnostic popover opened *before* playing (live proof of the
     `ReferencePreview` bug fix — correct title/caption, no leftover Margherita text).
  3. Full Bismarck playthrough: dough → tomato-sauce → mozzarella×3 at the approved coordinates →
     egg at (50,50) → bake → RESULT with Scoring 2.0 Shadow `available:true`, `Total: 99/100`.
  4. Back to Pizza Select → Quattro Formaggi.
  5. Quattro Formaggi's own Reference diagnostic popover (distinct 4-group data, not shared with
     any other recipe).
  6. Full Quattro Formaggi playthrough: dough → olive-oil → all 4 cheese groups placed in the
     CHEESE step with a deliberate hold showing all 4 on the dough simultaneously (visual
     confirmation of the inner mozzarella/gorgonzola ring vs. outer parmigiano/fontina ring, and
     of the cross-group overlap already measured in §13.2) → bake → RESULT with Scoring 2.0
     Shadow `available:true`, `Total: 99/100`, all four groups individually shown scoring 100.
  7. Both RESULT screens hold long enough to show the legacy ★ panel and the "🧪 Scoring 2.0
     Shadow" panel as two visually separate sections.
- **No merge.** PR #57 remains open/draft throughout.

---

## 6. Constraints respected

Not touched at any point in this slice: scoring weights/coefficients, authority wiring,
`gameReducer.ts` scoring authority, `missionScoring.ts`, `playerReference.ts` (Player Reference
data), and no A1 official-scoring cutover was performed. The only production files changed are
`src/data/referencePizza.ts` (new Reference data), `src/components/ReferencePreview.tsx` +
`src/screens/GameScreen.tsx` + `src/App.css` (the display-layer bug fix described in §2.2), plus
their corresponding test files.

---

## 7. Verdict

**A. B2 COMPLETE — READY FOR HUMAN REVIEW.**

- **HEAD SHA:** `3be9fc9e07775d3c4ef60df688d8c7ede60192ad`
- **Coverage:** 7/7 confirmed (margherita, marinara, funghi, genovese, fugazza, bismarck,
  quattro-formaggi) — `getReferencePizza` returns non-null for every real recipe, each with
  ChatGPT-reviewed, non-fabricated geometry.
- **Tests / build / lint:** 1061/1061 passing (54 files), `tsc -b && vite build` clean, `oxlint`
  0 findings.
- **CI:** `build` check green on PR #57's HEAD commit.
- **Review Playthrough:** produced and delivered, covering both new recipes' full flow, Reference
  diagnostics, RESULT panels, and Shadow/legacy separation, as required.
- **PR #57:** left open/draft, not merged, per instructions.

**Remaining risks for the human reviewer:**

1. The piece-scoring model (`piecesComponent.ts`) averages all of a recipe's ingredient groups
   equally regardless of group count — this is a pre-existing limitation (surfaced in §13.4 of
   the tracking report, not introduced by this slice), and quattro-formaggi's 4 equally-weighted
   groups is the first real production case of it. No change was made to this model; it is
   flagged for future review, not fixed here.
   2. The `ReferencePreview` bug fixed in §2.2 was outside this slice's originally listed
   implementation steps — it is a necessary, minimal, display-only fix that was required to make
   the Review Playthrough demonstrate correct (non-misleading) output for the newly-covered
   recipes, and is called out explicitly here rather than folded in silently.
