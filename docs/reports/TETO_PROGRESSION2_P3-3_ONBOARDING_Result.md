# Progression 2.0 Phase 3-3: 0-recipe onboarding (Result)

Issue #198 (parent #182). Fresh Audit: `docs/reports/TETO_PROGRESSION2_P3-3_ONBOARDING_Fresh-Audit.md`.
Audited/base `main`: `3f4693156b62a8423cb6d1c225764128c10759fc` (PR #196, Phase 3-4 merge).
Branch: `claude/progression-phase-3-3-onboarding-3t54xu`.

## 1. What shipped

The Fresh Audit found the New Game Contract (Dex 0, starter-trio-only, Margherita makeable) and
the first-discovery flow (Free Cooking → Phase 3-1 matcher → `REGISTER_TO_DEX`) already correct
on `main` — nothing to reimplement there. Three real gaps were closed:

1. **Recipe Select pre-discovery gate.** Margherita (the only recipe unlocked at Dex 0) is no
   longer directly guided-selectable before the player's first-ever discovery. `recipeCardState`
   (`src/state/pizzaSelect.ts`) sets `preDiscoveryLocked: true` on its `"NEW"` card only while
   `discoveredRecipeIds(dex).length === 0`; `PizzaSelectScreen`'s detail CTA swaps to
   「🎨 フリークッキングで探す」 (routes to Free Cooking) instead of the guided 「このピザを作
   る！」 button, and the grid card drops its `NEW` badge in favor of a
   「🎨 フリークッキングで発見しよう」 hint line. `gameReducer.ts`'s `SELECT_RECIPE` case adds
   the same guard as a reducer-level backstop. Omitted (not `false`) once anything has ever been
   discovered, so an existing player's own NEW cards are byte-identical to before this phase.
2. **Lunch Rush lock.** `HomeScreen`'s ランチラッシュ button is `disabled` with a
   「🔒 まず1枚ピザを発見しよう」 reason line while `!hasAnyDiscovery`; `App.tsx`'s
   `handleStartLunchRush` no-ops the same way as a backstop. Unlocks automatically and
   permanently the instant `hasAnyDiscovery` becomes true.
3. **HOME primary CTA (design option C).** フリークッキング takes the primary CTA slot pre-
   first-discovery; 「ピザを作る」 is never removed, only demoted to secondary (a first draft
   removed it entirely — caught and fixed during implementation, see §4). The hero bubble reads
   「まずはフリークッキングで最初の1枚を見つけよう！」 in that state.

New, reusing existing systems (no separate discovery/hint stack):

4. **Pre-first-discovery hint escalation** (4 levels, `min(attempts, 3)`) in
   `src/data/hints.ts`, driven by a new transient `GameState.preDiscoveryFreeCookAttempts`
   counter (never persisted, carried through every "fresh round" path via `ProgressionCarry`,
   incremented in `CONFIRM_BAKE` whenever a free-cook round resolves to anything but `MATCHED`
   while the Dex is still empty). Reuses `buildHintLine`'s existing free-cook hint slot.
5. **OD-02 Pitz reward** (`src/logic/pitzReward.ts`): a ★1 floor (`PITZ_QUALITY_FLOOR = 20`) and
   a flat first-discovery bonus (`PITZ_FIRST_DISCOVERY_BONUS = 50`), both additive, shown in
   `ResultPanel`'s existing Pitz breakdown as a new 「初回発見ボーナス」 row. FREE-mode only
   (`pitzReward.ts`); Lunch Rush's own `calculateMissionReward` (`src/logic/economy.ts`) is
   untouched.

No save schema change. Every new field is transient, matching the existing
`lastPitzCredit`/`lastDiscovery` convention.

## 2. Changed files

```
docs/reports/TETO_PROGRESSION2_P3-3_ONBOARDING_Fresh-Audit.md   (new)
docs/reports/TETO_PROGRESSION2_P3-3_ONBOARDING_Result.md        (new, this file)
docs/reports/screenshots/progression2-p3-3-onboarding/          (new, 20 screenshots)
e2e/progression2-p3-3-onboarding.spec.ts                        (new)
src/App.css
src/App.tsx
src/App.fullGameReset.test.tsx
src/App.humanFeelFix3.test.tsx
src/App.playerReference.test.tsx
src/App.test.tsx
src/components/ResultPanel.tsx
src/components/ResultPanel.test.tsx
src/data/hints.ts
src/logic/pitzReward.ts
src/logic/pitzReward.test.ts
src/screens/HomeScreen.tsx
src/screens/PizzaSelectScreen.tsx
src/screens/PizzaSelectScreen.test.tsx
src/state/gameReducer.ts
src/state/gameReducer.completionGate.test.ts
src/state/gameReducer.cookingTiming.test.ts
src/state/gameReducer.cutStep.test.ts
src/state/gameReducer.discovery.test.ts
src/state/gameReducer.pitzReward.test.ts
src/state/gameReducer.stepTiming.test.ts
src/state/gameReducer.test.ts
src/state/pizzaSelect.ts
src/state/pizzaSelect.test.ts
e2e/gestures.ts
e2e/making-ui-1screen.spec.ts
e2e/viewport-1screen.spec.ts
```

PR #196 (Phase 3-4)'s own files are untouched (diff-verified).

## 3. Test-fixture fallout and its fix

Many pre-existing unit and E2E fixtures start from a literal fresh (empty-Dex) save purely as a
convenient "get to PREPARE/Lunch Rush" shortcut — not to test onboarding. The new gates correctly
change behavior there, which broke ~50 pre-existing tests across both suites. Two consistent
fixes were applied throughout, never changing what any of those tests actually assert:

- **Unrelated mechanics test** (timing, cutState reset, inventory carry-through, layout, Lunch
  Rush mechanics): seed the fixture's `dex` with one already-discovered recipe before dispatching
  `SELECT_RECIPE`/entering Lunch Rush — for E2E, a real-but-deeply-chain-gated id (`napoletana`,
  whose own unlock chain requires several other undiscovered recipes, so it never widens
  `availableRecipeIds` for anything else) seeded via `page.addInitScript`, added once to the
  shared `e2e/gestures.ts` helpers (`startFreshMargherita`, `startLunchRushMission`) so every
  caller across 6+ spec files is fixed in one place; three per-file duplicate helpers
  (`viewport-1screen.spec.ts`, `making-ui-1screen.spec.ts` ×2) got the same fix locally.
- **The gate itself**: new/rewritten tests assert the new `preDiscoveryLocked`/lock behavior
  directly (`pizzaSelect.test.ts`, `PizzaSelectScreen.test.tsx` tests 3b/4b,
  `App.fullGameReset.test.tsx`'s reset test, the new
  `e2e/progression2-p3-3-onboarding.spec.ts`).

## 4. A design fix caught during implementation

The first HOME draft made フリークッキング the *only* primary-row button pre-first-discovery,
which silently removed 「ピザを作る」 (Pizza Select) as a HOME entry point — a real regression
several pre-existing HOME→Pizza Select navigation tests caught immediately. Fixed to keep both
buttons always present (フリークッキング primary/leading, ピザを作る demoted to secondary
styling/position only) — see `src/screens/HomeScreen.tsx`'s own comment. No functional path is
ever removed by this phase; only visual priority changes.

## 5. Tests

| Check | Result |
|---|---|
| Full unit suite (`npx vitest run`) | **2414/2414** pass |
| `tsc -b` | clean |
| `oxlint` | clean (exit 0) |
| `npm run build` | OK (only the pre-existing chunk-size warning) |
| Full Chromium E2E, both viewports (`iphone-390x844`/`iphone-360x800`, 9 pre-existing spec files + the new one) | **114/114** pass |
| New `e2e/progression2-p3-3-onboarding.spec.ts` | 4 scenarios × 2 viewports, all pass: (A–E) fresh HOME → gate → hint escalation → first discovery → post-discovery unlock; existing-save back-compat; Full Game Reset; one-screen layout |
| WebKit E2E | Not runnable in this sandbox — no WebKit binary is installed and this environment's own setup explicitly disables `playwright install` (Chromium-only, matching every prior Progression 2.0 phase's own documented limitation). `.github/workflows/e2e-webkit.yml` is the authority; its own PR run is the actual evidence, see §9 |

### Required-test checklist (from the task)

| Required | Where covered |
|---|---|
| New game: Dex 0 | Fresh Audit §2; E2E scenario A; `pizzaSelect.test.ts` |
| Starter ownership: tomato sauce/mozzarella/basil | Fresh Audit §2 (pre-existing, unchanged) |
| Free Cooking: Margherita signature → NEW → Dex 1 | E2E scenario D; `gameReducer.freeCook.test.ts` (pre-existing, unchanged) |
| Repeat → KNOWN, no duplicate registration | Pre-existing coverage, unchanged (Phase 3-1/3-2) |
| ORIGINAL → retry possible | E2E scenario C (hint escalation attempts); pre-existing `gameReducer.freeCook.test.ts` |
| Lunch Rush: locked at Dex 0, unlocked at Dex 1 | E2E scenario A/E; `App.test.tsx` (seeded) |
| Recipe Select: cannot bypass first discovery | `pizzaSelect.test.ts`, `PizzaSelectScreen.test.tsx` 3b/4b, `gameReducer.ts` SELECT_RECIPE guard test, E2E scenario B |
| Existing save: Dex preserved | E2E "existing save" test; `App.humanFeelFix3.test.tsx`/`App.playerReference.test.tsx` (seeded, unaffected) |
| Reset: returns to true Dex 0 | E2E "reset" test; Fresh Audit §10 |
| 390×844 / 360×800 | Every E2E test above runs at both; screenshots/video at both |

## 6. First-discovery flow (end to end, confirmed via video/screenshots)

HOME (Dex 0, フリークッキング primary) → フリークッキングで探す → DOUGH → SAUCE (level-0 hint)
→ tomato sauce + mozzarella, no basil → ORIGINAL (not a failure) → retry → level-1 hint
(「気になる色の材料が3つあるよ…」) → retry → level-2 → level-3 (near-explicit) → tomato sauce +
mozzarella + basil → BAKE → 「NEW PIZZA! ✨ マルゲリータを発見しました！」, ★3, 61点, +133 Pitz
(基本報酬100 Pitz ×0.80 + 初回発見ボーナス+50 Pitz + 手際ボーナス+3 Pitz = 133) → HOME (レシピ
1/15, ピザを作る primary again, ランチラッシュ enabled) → Pizza Select shows margherita
COMPLETED, guided-selectable → Lunch Rush opens normally.

## 7. Lunch Rush lock/unlock

Dex 0: ランチラッシュ button `disabled`, `aria-disabled`, 「🔒 まず1枚ピザを発見しよう」 line
shown; `handleStartLunchRush` no-ops even on a stray dispatch. Dex 1 (any discovery): button
enabled, mission intro opens normally, unaffected by anything else on this Dex 0→1 boundary
(confirmed via the full Lunch Rush E2E suite, all still green).

## 8. Existing-save compatibility

No migration needed or added (Fresh Audit §3) — every new field is transient. Confirmed:
`e2e/progression2-p3-3-onboarding.spec.ts`'s "existing save" test seeds a v1-schema save with one
real prior discovery and confirms Dex/Pitz/ownership all round-trip unchanged, the guided
Margherita CTA stays enabled, Lunch Rush stays unlocked, and no lock UI appears. The full unit
suite's own pre-existing `persistence.test.ts`/save-compatibility coverage is untouched and still
green.

## Human Verification Videos

| Video | Viewport | Duration | Size | Codec | Verification |
|---|---|---:|---:|---|---|
| `TETO_P3-3_Onboarding_HV_390x844.mp4` | 390×844 | 28.9 s | 728 KB | H.264, yuv420p, 25 fps | PASS |
| `TETO_P3-3_Onboarding_HV_360x800.mp4` | 360×800 | 28.9 s | 693 KB | H.264, yuv420p, 25 fps | PASS |

Download: both files were delivered directly in the session (not committed — `artifacts/`-style
video is never committed per `docs/PROJECT_HANDOFF.md`'s existing rule).

Video Verification: PASS. Both files exist, are non-empty, decode fully (`ffmpeg -f null`), and
record the full viewport at native size. Each state is held long enough to read (fresh HOME,
Pizza Select gate, DOUGH, hint level 1, ORIGINAL result, NEW discovery, Pitz breakdown, unlocked
HOME, Lunch Rush intro).

What each video shows, on a fresh save:

1. HOME with Dex 0: フリークッキングで探す as the primary CTA, ランチラッシュ disabled with its
   reason line, ピザを作る still present (secondary), hero bubble's onboarding copy.
2. Pizza Select: margherita visible but not guided-selectable (「フリークッキングで発見しよう」,
   no NEW badge); every other recipe LOCKED; its detail CTA is フリークッキングで探す, which
   opens Free Cooking directly.
3. Free Cooking DOUGH → SAUCE: the level-0 generic hint.
4. An ORIGINAL (non-matching) attempt — a normal finished result, not a failure card.
5. Level-1 hint after that attempt.
6. NEW PIZZA! banner, ★ and score, the Pitz breakdown (★1 floor + first-discovery +50 bonus +
   efficiency bonus all itemized).
7. HOME reverted to the pre-Phase-3-3 layout (Dex 1/15, ランチラッシュ enabled).
8. Lunch Rush's own Mission Intro overlay opening normally.

Screenshots are in `docs/reports/screenshots/progression2-p3-3-onboarding/` — 10 states ×
390×844/360×800 (`after-1`…`after-10`).

## 9. Remaining risks / follow-ups

- **WebKit** could not be run locally (§5) — the PR's own `e2e-webkit.yml` CI job is the
  authority; its result must be checked before merge.
- **ORIGINAL free-cook Pitz reward** is still 0, deliberately left unresolved per the Fresh
  Audit §11 scope guard (OD-01/OD-02 give no number for it) — recorded as an explicit follow-up,
  not silently dropped.
- Codex review requested at the exact PR head; see the PR itself for outcome/status once
  available.

## 10. Codex review status

See the PR thread for Codex's review at the exact PR head commit. Any P1/P2 findings are
addressed, re-verified (tests/build), and re-reviewed before this report is considered final for
merge purposes.
