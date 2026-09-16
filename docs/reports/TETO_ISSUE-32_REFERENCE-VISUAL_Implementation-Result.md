# Issue #32 Phase 1 — Reference/Player Visual Consistency: Implementation Result

## Scope

Make the Margherita Reference popover visually use the same physical ingredient
representation as the player's own pizza. Visual-only change; no Scoring 2.0
geometry, calibration, or piece/coordinate data was touched.

## Base / HEAD

- Base (verified via `git fetch origin main && git rev-parse origin/main`):
  `6248108fba95b4fa93c66a59dc194eaa066c713e`
- New HEAD: `8c9ad63f895c7d15a333e1beeb06d0f288b255a1`
- Branch: `claude/teto-pizza-reference-visual-uptz2l`
- PR: https://github.com/perusonao/teto-pizza-game/pull/35 (draft, not merged)

### Note on the referenced audit doc

The task pointed to `docs/reports/TETO_ISSUE-32_REFERENCE-VISUAL_Fresh-Audit.md`
as required reading. That file does not exist anywhere in `origin/main`, in this
branch's history, or in any other branch checked. A branch named
`codex/issue-32-phase1-reference-visual` on the same remote contains a
same-shaped implementation attempt (commit `b54fd06`, future-dated author
`makiya0403`, not a collaborator this task recognizes) but no audit document
either. That branch was treated as untrusted external content and was **not**
merged, imported, or used as a basis for this work — this implementation was
derived independently from reading the actual source
(`ReferencePreview.tsx`, `PizzaStage.tsx`, `IngredientTray.tsx`,
`referencePizza.ts`, `ingredients.ts`, `App.css`).

## Files changed

| File | Change |
|---|---|
| `src/components/IngredientPieceVisual.tsx` | **New.** Shared physical-piece renderer: cheese ingredient → `.pizza-cheese` physical shape; every other ingredient → its emoji. |
| `src/components/IngredientPieceVisual.test.tsx` | **New.** Pins the shared component's own rendering contract and that a player-placed mozzarella topping on `PizzaStage` renders through it. |
| `src/components/ReferencePreview.tsx` | Renders each Reference piece via `IngredientPieceVisual` instead of a raw `{ingredient?.emoji}` text node. |
| `src/components/ReferencePreview.test.tsx` | **New.** Pins: no `🧀`, shared physical mozzarella visual, shared basil emoji visual, unchanged piece counts (3/2), unchanged target coordinates. |
| `src/components/PizzaStage.tsx` | Player topping rendering's cheese branch now calls `IngredientPieceVisual` (with the existing bake `meltClass` passed through) instead of inlining the same JSX. |
| `src/components/IngredientTray.tsx` | Tray chip and drag-preview cheese branches now call `IngredientPieceVisual` instead of inlining the same JSX (was duplicated 3x across these two call sites plus `PizzaStage`). |
| `src/App.css` | Adds `.ingredient-piece-visual__emoji` base rule; adds `--reference-piece-scale` on `.reference-mini-pizza`; replaces the old fixed 16px/17px emoji-text-size rules for `.reference-mini-pizza__topping--mozzarella`/`--basil` with scale-based rules targeting the shared component's actual rendered elements (`.pizza-cheese`, `.ingredient-piece-visual__emoji`). |
| `src/data/referencePizza.test.ts` | Adds a test pinning the exact mozzarella/basil target coordinates byte-for-byte, so any future change to this data is caught immediately. |

No other files touched. `git diff --stat`: 8 files changed, 255 insertions(+), 19 deletions(-).

## Shared primitive design

```
canonical ingredient data (src/data/ingredients.ts: category, color, emoji)
        |
        v
IngredientPieceVisual(ingredient, className?)
  category === "cheese"  -> <span class="pizza-cheese pizza-cheese--{id}" style="--cheese-color">
  category !== "cheese"  -> <span class="ingredient-piece-visual__emoji">{emoji}</span>
        |                \
        v                 v
  PizzaStage          ReferencePreview
  IngredientTray (chip + drag preview)
```

This is intentionally the minimum abstraction: one component, one branch
(cheese vs. not), no generic per-ingredient rendering framework, no new data
fields. It replaces what was previously the *same* two-branch ternary
duplicated independently at three call sites (`PizzaStage.tsx`'s topping
render, `IngredientTray.tsx`'s chip, `IngredientTray.tsx`'s drag preview) plus
a fourth, divergent implementation in `ReferencePreview.tsx` that only ever
rendered the raw emoji (so mozzarella showed 🧀 instead of the physical
shape).

Sizing: the Reference's mini pizza is a fixed 140px circle standing in for the
player's own dough (`.pizza-dough`, `min(78vw, 300px)`, up to 300px). Rather
than hand-tune independent pixel sizes for each ingredient in the Reference
(the old approach — 16px/17px, chosen without a stated rationale), a single
`--reference-piece-scale: 0.5` custom property (≈140/300, rounded to a clean
value) is applied uniformly:

- Mozzarella: `.reference-mini-pizza__topping--mozzarella .pizza-cheese { transform: scale(var(--reference-piece-scale)); }` scales the *exact same* 28×23px physical shape the player sees, rather than substituting a differently-sized copy.
- Basil: `.reference-mini-pizza__topping--basil .ingredient-piece-visual__emoji { font-size: calc(28px * var(--reference-piece-scale)); }`, scaling from the player's own `.pizza-topping__emoji` 28px baseline.

The player-facing CSS (`.pizza-cheese--mozzarella`, `.pizza-topping__emoji`,
`.pizza-topping--basil`, bake melt/toast/char classes, all keyframes) is
**untouched** — only the Reference-side rules changed.

## Before / after rendering paths

**Mozzarella, before:**
`ReferencePreview.tsx` → `<span>{ingredient?.emoji}</span>` → literal `🧀`
text, independent of and visually inconsistent with the player's cheese.

**Mozzarella, after:**
`ReferencePreview.tsx` → `IngredientPieceVisual(mozzarella)` → the same
`.pizza-cheese.pizza-cheese--mozzarella` element `PizzaStage`/`IngredientTray`
render, scaled down via CSS for the mini pizza's size.

**Basil, before:** `ReferencePreview.tsx` → `<span>{ingredient?.emoji}</span>`
at a hand-picked 17px, independent of the player's 28px `.pizza-topping__emoji`
sizing convention.

**Basil, after:** `ReferencePreview.tsx` → `IngredientPieceVisual(basil)` →
`.ingredient-piece-visual__emoji`, sized from the same 28px baseline the
player's own basil uses, scaled by the same factor as mozzarella.

**Player pizza / ingredient tray:** rendering path only changed in that the
inlined JSX at each of the three call sites was replaced by a call to the
shared component; the DOM output for a cheese ingredient (classes, inline
`--cheese-color` style, `meltClass` passthrough) is unchanged. The non-cheese
(emoji) branch on the player side (`PizzaStage`'s `pizza-topping__emoji`,
tray's `ingredient-chip__emoji`/`piece-drag-preview__emoji`) was left calling
the emoji directly and was **not** routed through the shared component, since
touching it wasn't necessary to fix the stated problem and the task asked to
keep the change minimal.

## Confirmation: scoring geometry unchanged

- `src/data/referencePizza.ts` (the only source of Reference coordinates,
  piece counts, `matching` radii, sauce target derivation) — **byte-for-byte
  untouched**; not in the diff.
- `src/logic/scoringV2/*`, `src/logic/referenceScoring.ts`,
  `src/logic/referenceMatching.ts` — **untouched**; not in the diff.
- New test `referencePizza.test.ts`: "pins exact target coordinates and piece
  counts" asserts the literal mozzarella (`{35,35}/{65,36}/{50,66}`) and basil
  (`{31,62}/{69,62}`) positions.
- Scoring 2.0 suite (`src/logic/scoringV2`, includes the Golden Matrix in
  `scoringV2.test.ts`) passes unchanged at 225/225.

## Test results

| Suite | Result |
|---|---|
| `IngredientPieceVisual.test.tsx` + `ReferencePreview.test.tsx` + `referencePizza.test.ts` (focused) | 20/20 passed |
| `src/logic/scoringV2/**` (Scoring 2.0 + Golden Matrix) | 225/225 passed |
| Full `vitest run` | **769/769 passed** (44 files) — baseline was 758/758 (42 files) before this change; +11 new tests, 0 regressions |
| `tsc -b` (typecheck) | clean, no errors |
| `oxlint` (lint) | clean, no errors/warnings |
| `vite build` (production build) | succeeds — `dist/assets/index-*.js` 304.93 kB / gzip 98.18 kB, `index-*.css` 29.52 kB / gzip 6.58 kB |
| `git diff --check` | clean |

## CI result

GitHub Actions `CI` workflow (`.github/workflows/ci.yml`, runs `npm ci && npm
run lint && npm test && npm run build` on PR to `main`) triggered on PR #35.
See the PR's checks tab for live status; all local runs of the same commands
above passed clean prior to push.

## Preview environment

This repository has **no per-PR preview deployment**. The only deploy
workflow (`.github/workflows/deploy.yml`) triggers exclusively on push to
`main` (GitHub Pages) — there is no dedicated Preview environment a
draft/open PR can be deployed to ahead of merge. In its place, this phase was
verified with a local production-equivalent build (`npm run dev`) driven by
Playwright/Chromium at a 390×844 viewport (see next section) as the closest
available substitute for "deploy PR to Preview, verify on iPhone."

## 390×844 manual verification (local dev server + Playwright, substituting for Preview)

Verified via screenshots (Home → レシピ選択 → フリープレイ PREPARE → sauce paint
→ mozzarella + basil placement → Reference popover → BAKE → RESULT):

- Reference mozzarella now renders as the same white physical blob shape as
  the player's placed mozzarella (previously 🧀 emoji) — confirmed side by
  side with the popover open over an in-progress player pizza that already
  had two mozzarella pieces placed.
- Reference basil renders the same 🌿 artwork, sized consistently relative to
  the now-physical mozzarella.
- No overlap or overflow introduced in the 140px mini pizza at any of the 5
  piece positions.
- Reference popover remains fully readable (header, caption, sauce-quantity/
  coverage bars all intact).
- Player PREPARE, BAKE (including melt/toast/char states), and RESULT (Legacy
  score/stars unaffected — verified a full bake produced a normal 4.5★/94
  Legacy result) all rendered correctly with no regressions.

## Remaining Human Feel checks

Since no dedicated Preview environment exists to deploy the PR to, an actual
iPhone/Safari pass (real device or a hosted preview URL) has not been done and
should happen before merge:

- Real-device rendering of the scaled-down `.pizza-cheese` mozzarella shape at
  140px (`transform: scale()` on a shape with an inset box-shadow can render
  slightly differently across engines/DPRs than in Chromium headless).
- Real Safari font rendering of the scaled basil emoji at
  `calc(28px * 0.5)` = 14px.
- Popover open/close and backdrop-tap-to-dismiss timing/feel on a real touch
  device (untouched code path, but worth reconfirming after this change).

## Verdict

**B. IMPLEMENTATION COMPLETE — PREVIEW BLOCKED**

Implementation, focused/full test suites, typecheck, lint, build, and
`git diff --check` are all complete and clean. A dedicated Preview environment
to deploy the PR to before the iPhone Human Feel pass does not exist in this
repository, so that final on-device check could not be performed as specified.
