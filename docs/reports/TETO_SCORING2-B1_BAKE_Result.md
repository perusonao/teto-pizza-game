# Scoring 2.0 B1 — Bake Similarity Component — Result

Closes Scoring 2.0 Authority blocker **B1** (`docs/reports/TETO_SCORING2_AUTHORITY_Fresh-Audit.md`
§9): Scoring 2.0 previously had no Bake component at all, for any recipe. This slice adds a real,
reviewed `BakeComponentV2` and wires it into `totalScore` — **Scoring 2.0 stays Shadow-only**;
this does not flip authority (that remains B1+B2 → A1 → A2 → A3, per the Fresh Audit's own
sequencing — B2, Reference coverage for the remaining 6 recipes, is untouched by this PR).

## 0. Scope and baseline

- **Audited/starting `main` SHA**: `142a18252db56d9ee4c236cc80062673d5e68c80` — matches the
  session's expected starting SHA exactly; `git rev-parse origin/main` confirmed no drift.
- Read before implementation: `docs/PROJECT_HANDOFF.md`, the Scoring 2.0 Authority Fresh Audit
  (`docs/reports/TETO_SCORING2_AUTHORITY_Fresh-Audit.md`), `docs/design/PIZZA_GAME_SSOT.md`,
  current `src/logic/scoringV2/**`, `src/logic/bake.ts`, `src/logic/scoring.ts` (legacy).

## 1. Bounded design check (per the task's explicit instruction: no broad recalibration)

**Bake formula.** The Fresh Audit's own §9 (B1) recommendation was to reuse `classifyBake`'s
thresholds "as the starting semantic shape" rather than invent a new one. Going one step
further: legacy `scorePizza()` (`src/logic/scoring.ts`) already has a *continuous* bake formula,
not just `classifyBake`'s 3-state categorical one — `distance = |bakeResult - center| - halfRange`
(distance from the nearest edge of `[bakeTarget.start, bakeTarget.end]`, 0 inside the zone),
`bakeScore = max(0, 100 - (distance / center) * 100)`. This is already exactly the "symmetric
nearest-edge / distance-to-ideal model" the task asks for (same shape penalizes raw and burnt
identically, since it uses `Math.abs` and one shared `center`/`halfRange`). `BakeComponentV2`
(`src/logic/scoringV2/bakeComponent.ts`) reuses this verbatim (re-expressed as a 0–1
`similarity` for architectural consistency with Sauce/Pieces/Recipe's own 0–1 sub-scores), rather
than inventing a new curve — zero new tuning parameters.

**Reference-independence.** Unlike Sauce/Pieces/Recipe, Bake needs no `ReferencePizza` fixture:
`Recipe.bakeTarget` is static per-recipe data already defined for all 7 recipes
(`src/data/recipes.ts`), not gated by Margherita-only Reference coverage. `computeScoringV2Shadow`
now computes `bake` unconditionally, ahead of (and independent from) the Reference-availability
gate — so Bake's diagnostic numbers are real for every recipe from this PR onward, even though
the *whole result*'s `available`/`totalScore` still requires Sauce/Pieces/Recipe's Reference gate
(P0-1, unchanged, pending B2). This is a scope/architecture finding, not new Reference-authoring
content — it uses only `recipe.bakeTarget` + `pizza.bakeResult`, both of which already existed.

**Bake weight decision.** Adding a fourth weight is a genuine calibration decision (the audit's own
words), so rather than inventing four fresh numbers:

- The existing, already-iPhone-calibrated Sauce:Pieces:Recipe ratio (**65:20:15**, from the Phase
  4A-2 Shadow Result/iPhone-Calibration reports) is kept **completely unchanged in its relative
  proportions** — only uniformly rescaled by ×0.8 to make room for a fourth weight:
  **52 : 16 : 12** (verified: 52/16 = 65/20 = 3.25; 52/12 = 65/15 = 4.333; 16/12 = 20/15 = 1.333).
- **Bake = 20**, the smaller of the two anchors the task named: legacy's own Bake weight is
  **30**/100 (its single heaviest), and the task's cited historical conceptual direction is
  **Recipe15/Sauce35/Pieces30/Bake20**. Adopting the historical split's Sauce/Pieces numbers
  verbatim would have meant retuning Sauce from 65%→35% and Pieces from 20%→30% of the total —
  exactly the "retune Recipe/Sauce/Pieces merely because further tuning is possible" the task
  says not to do. Taking only its Bake anchor (20, the more conservative of the two, since this
  new formula has no Human-Feel evidence of its own yet unlike the ratio it's weighed against)
  while rescaling the other three proportionally is the smallest defensible move: **one new
  number, zero re-litigated ones.**
- All four weights sum to 100. Ruleset version bumped `phase-4a-2-shadow-2` →
  `phase-4a-2-shadow-3` so a stored/logged Shadow result can never be misread against the
  pre-Bake formula.

## 2. Implementation

- **New**: `src/logic/scoringV2/bakeComponent.ts` — `scoreBakeComponentV2(bakeResult, bakeTarget)`.
  Fails closed (`available: false`) only if `bakeTarget` itself is malformed (new
  `isValidBakeTarget` in `boundary.ts`) — never happens for real authored recipes, but keeps the
  same fail-closed discipline as every other component. A non-finite/absent `bakeResult` reads as
  "not yet baked" (`score: 0`, mirroring legacy's own `bakeResult === null` branch), not an error.
- **Widened**: `src/logic/scoringV2/types.ts` — `BakeComponentV2` is now
  `BakeComponentV2Available | ScoringV2Unavailable` (was an unconditional `ScoringV2Unavailable`
  alias). `BakeComponentV2Available` exposes `bakeResult`, `bakeState` (`classifyBake`'s own
  raw/perfect/burnt), `distanceFromIdeal`, `similarity` (0–1), `score` (0–100).
- **Wired in**: `src/logic/scoringV2/index.ts` — `bake` computed unconditionally before the
  Reference-availability check; a third fail-closed guard added (mirroring the existing
  pieces/recipe ones) before `totalScore`; `totalScore` now includes `bake.score * 20`.
- **UI**: `src/components/ScoringV2ShadowPanel.tsx` — one small diagnostic row added (焼き加減 /
  目標との差 / 類似度), gated by the same `isUnavailable` pattern every other component's detail
  row already uses. Preview/dev-only, unchanged production dead-code-elimination (re-verified: a
  production `vite build`'s bundle greps clean for `"Scoring 2.0 Shadow"`).

## 3. Non-negotiable invariants preserved

- **Scoring 2.0 remains Shadow-only.** `gameReducer.ts`'s `CONFIRM_BAKE` case still calls
  `scorePizza()` for `state.score` — not touched by this PR. `ScoringV2ShadowPanel` is
  Preview-only, as before.
- **No Dough scoring, no Pitz Reward, no Save/Inventory changes** — none of those files were
  touched.
- **Sauce/Pieces/Recipe untouched in their own logic and *relative* calibration** — only a
  uniform rescale to make room for Bake; no per-component formula or sub-weight changed.

## 4. Focused tests (ideal / under / over / boundary / malformed)

New `describe("scoreBakeComponentV2 (B1)", …)` in `scoringV2.test.ts`:

- **Ideal**: any `bakeResult` inside `[start, end]` → score 100, similarity 1, distance 0, state
  `"perfect"`.
- **Under (raw)**: below the zone → score < 100, finite, state `"raw"`, positive distance.
- **Over (burnt)**: above the zone → score < 100, finite, state `"burnt"`, positive distance.
- **Symmetric degradation**: equal distance below `start` and above `end` score identically
  (pins the "symmetric nearest-edge model" requirement directly).
- **Monotonic degradation** on both sides as distance grows.
- **Boundary**: one tick below/above the zone reads `raw`/`burnt` respectively (classifyBake's own
  exclusive edges), still scoring > 90 (a near-miss should not feel punished harshly).
- **Malformed `bakeResult`**: `null`, `NaN`, `±Infinity`, a wrong-typed value, `undefined` — all
  read as "not yet baked" (score 0), never throw, never NaN.
- **Malformed `bakeTarget`**: zero-width, inverted (`start > end`), non-finite — all fail the
  component closed (`available: false`), never divide by zero.
- **Full-range sweep**: score stays finite and within `[0, 100]` across `bakeResult` from -200 to
  200.

Also added/updated:

- A Golden Matrix extension (`malformedInput.test.ts`): ideal-bake > raw/burnt > unbaked, at the
  full `computeScoringV2Shadow` level, on an otherwise-identical pizza.
- Two pre-existing tests updated to reflect Bake now being real everywhere (previously asserted
  `bake.available === false` unconditionally for every recipe, including Reference-unavailable
  ones — now real for all 7, per §1's Reference-independence finding).
- One pre-existing "great pizza" fixture (`malformedInput.test.ts`) given an ideal `bakeResult` —
  an otherwise-perfect but never-baked pizza is no longer "great" end-to-end once Bake is a real,
  weighted component, which is the intended effect of adding it, not a regression to paper over.

## 5. Verification

| Check | Result |
|---|---|
| Focused Bake tests | 13 new tests, all passing |
| Full Vitest suite | **995/995 passing** |
| `npx tsc -b` | clean |
| `npx oxlint` | clean |
| `npm run build` (production) | succeeds; Shadow panel still absent from `dist/assets/*.js` (grep-verified) |

## 6. PR / CI / Preview

- **Files changed**: `src/logic/scoringV2/bakeComponent.ts` (new), `src/logic/scoringV2/types.ts`,
  `src/logic/scoringV2/index.ts`, `src/logic/scoringV2/boundary.ts`,
  `src/logic/scoringV2/scoringV2.test.ts`, `src/logic/scoringV2/malformedInput.test.ts`,
  `src/components/ScoringV2ShadowPanel.tsx`.
- **PR**: [#58](https://github.com/perusonao/teto-pizza-game/pull/58) — `claude/scoring2-bake-component-383kgw` → `main`. **Not merged** (per task instruction).
- **PR HEAD SHA**: `3859f588116c97b9ee154594c24aa6d8fbb10ce5`
- **CI**: green (`build` check, run `35294812154`, conclusion `success`).
- **Preview deploy**: `perusonao/teto-pizza-game-preview`'s `deploy-from-source.yml` (run
  `35294850851`, success) + `pages.yml` (run `35294964097`, success), both against this exact
  source commit/PR — confirmed via the preview repo's own `README.md` (*Source ref:
  `claude/scoring2-bake-component-383kgw`*, *Source commit:
  `3859f588116c97b9ee154594c24aa6d8fbb10ce5`*, *Source PR: #58*).
- **Preview URL**: https://perusonao.github.io/teto-pizza-game-preview/
- **Preview badge**: `PREVIEW · PR#58 · 3859f58` (see §7 — confirmed present, but smoke-tested
  against a byte-identical local mirror rather than the public URL directly; see the blocker note
  below).

## 7. Preview smoke test — sandbox network blocker (transparency note)

This session's sandboxed egress policy denies outbound HTTPS to `perusonao.github.io` (and any
other general web host) — confirmed via the agent proxy's own status endpoint, which logs a
`connect_rejected` / "organization policy" denial for that host specifically, while GitHub's API
(`api.github.com`) and git operations remain reachable via their own allowed paths. This is a
sandbox limitation, not a Preview deployment failure: the deploy itself was independently
confirmed successful via the GitHub Actions API and the preview repo's own `README.md` content
(§6 above), both reachable through the allowed API path.

To still deliver a real Preview smoke test and Review Playthrough despite this, this session built
the exact same commit with the exact same preview-mode flags the real pipeline uses
(`VITE_PREVIEW_MODE=1 VITE_PREVIEW_PR=58 VITE_PREVIEW_SHA=3859f58`, `vite build
--base=/teto-pizza-game-preview/`, plus the same manifest/`noindex` post-processing
`deploy-from-source.yml` itself performs), served that output on `127.0.0.1` (inside the sandbox's
own allowed range), and drove a real Chromium session against it — byte-for-byte the same static
bundle now live at the Preview URL. The smoke test confirmed the on-screen badge reads exactly
`PREVIEW · PR#58 · 3859f58`.

**Blocker for a human reviewer**: this session cannot itself open
`https://perusonao.github.io/teto-pizza-game-preview/` to visually re-confirm the badge from the
public URL (only from the local mirror). The user/reviewer should do a final one-glance check of
the live Preview URL themselves; everything this session could verify about *what* is deployed
there (exact source SHA/PR, exact build flags) is independently confirmed via the GitHub API and
matches.

## 8. Review Playthrough (390×844, H.264 MP4)

**Path**: `artifacts/review/TETO_SCORING2-B1_BAKE_Review-Playthrough.mp4` (not committed —
`artifacts/` is gitignored; delivered directly to the user).

Three full Margherita rounds (retry-same-recipe between each), each showing:

1. Dough/sauce/mozzarella/basil made once, then the bake gauge confirmed at a different moment:
   - **Round 1 — under-baked (raw)**: legacy RESULT shows ★4/100→83, "焼き加減: 生焼け", legacy
     焼き bar 42. Scrolled-into-view Shadow panel: `Bake 42`, `焼き加減 raw`, `目標との差 40`,
     `類似度 42%`, Shadow `Total: 65/100`.
   - **Round 2 — intended/ideal bake**: legacy RESULT ★5/100, "焼き加減: いい焼き加減", legacy 焼き
     100. Shadow panel: `Bake 100`, `焼き加減 perfect`, `目標との差 0`, `類似度 100%`, Shadow
     `Total: 77/100`.
   - **Round 3 — over-baked (burnt)**: legacy RESULT ★4/100→95, "焼き加減: 焦げ", legacy 焼き 84.
     Shadow panel: `Bake 84`, `焼き加減 burnt`, `目標との差 11`, `類似度 84%`, Shadow
     `Total: 74/100`.
2. **Proof legacy player-facing authority is unchanged**: every round's legacy total/stars/bake
   label (top half of RESULT, `ResultPanel`) differs numerically from the Shadow panel's own total
   directly below it on the same screen (65 vs 83, 77 vs 100, 74 vs 95) — visible, side-by-side,
   same screen, same round. If Scoring 2.0 were secretly authoritative these would match; they
   don't, because `CONFIRM_BAKE` still only calls legacy `scorePizza()`.

Each RESULT screen is held long enough (legacy view first, then scrolled to the Shadow panel) to
read every value before moving on.

## 9. Confirmation Scoring 2.0 remains Shadow

- `gameReducer.ts`'s `CONFIRM_BAKE` case: unchanged, still `scorePizza(state.recipe, pizza)` →
  `state.score`.
- `ScoringV2ShadowPanel`: still gated on `import.meta.env.VITE_PREVIEW_MODE`, still renders `null`
  in production (re-verified by grep against this PR's own production `dist/` build).
- No Dex/Mission/Pitz/Save code path reads `scoringV2Shadow` — unchanged from before this PR
  (only `gameReducer.ts` and `GameScreen.tsx` touch it, both pre-existing wiring).

## 10. Blockers for Human Feel review

- **§7's sandbox network blocker** (cannot self-verify the public Preview URL from inside this
  session) — the one substantive blocker. Everything else (deploy correctness, badge content,
  gameplay behavior) was independently verified via the GitHub API and a byte-identical local
  mirror of the same build.
- No other blocker. B2 (Reference coverage for the remaining 6 recipes) remains a separate,
  already-tracked next step before A1 (authority adapter) — this PR does not attempt it, per its
  own scope guard.

## 11. Scope guard confirmation

Changed: `src/logic/scoringV2/{bakeComponent.ts (new), types.ts, index.ts, boundary.ts,
scoringV2.test.ts, malformedInput.test.ts}`, `src/components/ScoringV2ShadowPanel.tsx`, this
report, `docs/PROJECT_HANDOFF.md` (roadmap update only). Not changed: `gameReducer.ts` (authority
untouched), `scoring.ts`/`bake.ts` (legacy, read-only reused), Dough/Pitz/Save/Inventory/Dex/
Mission code, Recipe/Sauce/Pieces formulas or their relative weights, `referencePizza.ts` (no new
Reference fixtures — B2 remains separate).
