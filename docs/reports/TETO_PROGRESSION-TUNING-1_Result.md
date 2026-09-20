# Teto Pizza Game — Progression Tuning 1: Recipe Unlock Gate Result

## 0. Audited main SHA / duplicate PR gate

- **Audited main SHA:** `01d0176bf1ed84af9f41fa4f1bb03d527bebfc87` ("Economy Tuning 2: progression
  audit and deterministic simulation (#119)") — fetched fresh via `git fetch origin` at task
  start; this task's working branch (`claude/teto-progression-tuning-1-0wzz0f`) was created from
  and already contained this exact commit (`git merge-base --is-ancestor origin/main HEAD`
  confirmed true, no rebase/sync needed).
- **Duplicate PR gate #1 (before work):** listed every OPEN PR (`mcp__github__list_pull_requests`,
  state=open): #105 (draft, Dev Automation A1 — unrelated worker infra), #72 (docs: PR #68 status
  correction), #46 (Issue #33 Dough Shaping D0 audit), #34 (Issue #32 Phase 1 reference-visual),
  #3 (docs: Phase 2 infra report). **None overlap progression/unlock/`minTotalStars`/recipe
  progression tuning.** No duplicate — proceeded on a new branch.
- **Duplicate PR gate #2:** re-checked immediately before PR creation — see §14 below.

## 1. Current 15-recipe unlock table (fresh, read from `src/data/recipes.ts` at the audited SHA)

Real dependency order (from each recipe's own `unlockCondition.requiresRecipeId`, not `RECIPES`'
declaration order, which lists several recipes out of chain order):

| # | Recipe id | 表示名 | requiresRecipeId | minTotalStars (before) | mysteryLock | Recipes available at unlock | Δ vs prev gate |
|--:|---|---|---|--:|:--:|--:|--:|
| 1 | margherita | マルゲリータ | — (always unlocked) | — | — | 1 | — |
| 2 | funghi | フンギ | margherita | — | — | 2 | — |
| 3 | marinara | マリナーラ | funghi | — | — | 3 | — |
| 4 | bismarck | ビスマルク | marinara | — | — | 4 | — |
| 5 | genovese | ジェノベーゼ | bismarck | — | — | 5 | — |
| 6 | quattro-formaggi | クアトロ フォルマッジ | genovese | 8 | — | 6 | +8 |
| 7 | fugazza | フガッサ | quattro-formaggi | 12 | ✓ | 7 | +4 |
| 8 | salsiccia | サルシッチャ | fugazza | 16 | — | 8 | +4 |
| 9 | pepperoni | ペパロニ | salsiccia | 20 | — | 9 | +4 |
| 10 | napoletana | ナポリ | pepperoni | 24 | — | 10 | +4 |
| 11 | tonno-e-cipolla | トンノ・エ・チポッラ | napoletana | 28 | — | 11 | +4 |
| 12 | pizza-bianca | ピッツァ・ビアンカ | tonno-e-cipolla | 32 | — | 12 | +4 |
| 13 | breakfast-pizza | ブレックファストピザ | pizza-bianca | 36 | — | 13 | +4 |
| 14 | capricciosa | カプリチョーザ | breakfast-pizza | 40 | — | 14 | +4 |
| 15 | meat-lovers | ミートラヴァーズ | capricciosa | 44 | — | 15 | +4 |

**Code-verified semantics** (`src/state/progression.ts::recipeUnlocked`, `src/logic/mastery.ts`):

- `requiresRecipeId`: satisfied once `isDiscovered(dex, id)` is true — a Dex entry with
  `discovered: true`, set the instant a recipe is first PASSed at **any** quality (★1 floor
  counts, confirmed via `src/state/dex.ts::registerScoreToDex`, which sets `discovered: true`
  unconditionally on the first PASS regardless of `score.stars`). Confirms the task's own
  understanding exactly.
- `minTotalStars`: satisfied once `totalStars(dex) >= minTotalStars`, where `totalStars` is the
  **sum of Dex BEST stars across every discovered recipe** (`src/logic/mastery.ts`, unchanged) —
  not a per-recipe floor, not attempts, not Pitz. Also confirms the task's own understanding
  exactly.
- Both conditions, when both present, are AND'd (`recipeUnlocked`). Recipe unlock
  (`recipeUnlocked`) and ingredient ownership (`ingredientsOwned`) are a separate two-axis AND
  in `isRecipeAvailable` — unchanged by this task.

## 2. #119 Handoff reproduction (fresh, before any change)

Reproduced via the existing `src/logic/economySimulation.ts` simulation harness (Economy Tuning
2's own deterministic, code-driven simulation — reused exactly as instructed, not re-derived).

**`STRUGGLING_HARD_CAP_PLAYER` (Dex BEST never exceeds ★3, for any recipe, ever):**

| Metric | Reproduced value | #119 report value | Match |
|---|--:|--:|:--:|
| `completed` | `false` | `false` | ✓ |
| `finalTotalStars` | **31** | 31 | ✓ |
| `shortageEvents.length` | **0** | 0 | ✓ |
| `finalPitzBalance` | 2,335 | 2,335 | ✓ |
| Blocked at | `pizza-bianca` (gate 32, at the OLD gates) | pizza-bianca (★32 gate) | ✓ |
| `totalBakes` | 92 | 92 | ✓ |

Byte-for-byte match with the #119 report — confirmed via `src/logic/economySimulation.test.ts`'s
existing pinned regression test (before this task's edits) and independently via a scratch
simulation dump. **The finding reproduces exactly.**

**Mathematical boundary re-confirmed from `src/data/recipes.ts` (before any change):**

| Check | Value | Confirms |
|---|--:|:--:|
| Recipes discovered before `meat-lovers` | 14 | — |
| 14 × ★3 (idealized ceiling) | 42 | — |
| `meat-lovers`'s old gate | 44 | 42 < 44 — **unreachable** |
| Recipes discovered before `capricciosa` | 13 | — |
| 13 × ★3 (idealized ceiling) | 39 | — |
| `capricciosa`'s old gate | 40 | 39 < 40 — **unreachable** |

Both re-derived directly from `RECIPES` data (not transcribed), matching the task's own stated
math exactly.

**Root cause identified (new finding, not in the #119 report):** the mismatch is not random —
it's a **structural, compounding drift**. From `quattro-formaggi` onward, `minTotalStars` steps by
a flat **+4** per recipe, but the maximum totalStars a permanently-★3-capped player can gain per
newly-discovered recipe is **+3** (one more discovered recipe × its own ★3 ceiling). Every gate
therefore demands 1 star more than the previous gate's own margin allowed, and this 1-star deficit
**compounds every step**:

| Recipe (before-count n) | Old gate | Idealized ★3 ceiling (3n) | Margin |
|---|--:|--:|--:|
| quattro-formaggi (n=5) | 8 | 15 | +7 |
| fugazza (n=6) | 12 | 18 | +6 |
| salsiccia (n=7) | 16 | 21 | +5 |
| pepperoni (n=8) | 20 | 24 | +4 |
| napoletana (n=9) | 24 | 27 | +3 |
| tonno-e-cipolla (n=10) | 28 | 30 | +2 |
| pizza-bianca (n=11) | 32 | 33 | +1 |
| breakfast-pizza (n=12) | 36 | 36 | **0** |
| capricciosa (n=13) | 40 | 39 | **−1** |
| meat-lovers (n=14) | 44 | 42 | **−2** |

The margin shrinks by exactly 1 every step — starting comfortably positive (+7) and going negative
by `capricciosa`. This single observation is what STEP 6's target design is built around (§5-6).

## 3. Four-profile simulation (before tuning, current/old gates)

All four profiles run via `simulateProgression` (`src/logic/economySimulation.ts`), reusing the
production Starter Grant / Pitz reward / Shop restock / inventory / progression formulas exactly.

| Profile | Completed? | Attempts | Bakes | FAILED | Final totalStars | Final Pitz | Shortage events | Blocked recipe | Required improvement |
|---|:--:|--:|--:|--:|--:|--:|--:|---|--:|
| GOOD | ✅ | 16 | 16 | 1 | 66 | 1,620 | 0 | — | — |
| NORMAL | ✅ | 19 | 19 | 2 | 47 | 1,360 | 0 | — | — |
| STRUGGLING (rare ★4) | ✅ | 80 | 80 | 16 | 48 | 3,025 | 0 | — | — |
| HARD-CAP (never > ★3) | ❌ | 92 | 92 | 23 | 31 | 2,335 | **0** | pizza-bianca (gate 32) | **+1 star** |

Unlock timing (totalStars at each unlock) for GOOD/NORMAL/STRUGGLING all matched the #119 report
exactly (byte-for-byte, via the determinism test). HARD-CAP's per-unlock trace:

```
margherita(0) funghi(2) marinara(3) bismarck(6) genovese(8) quattro-formaggi(11)
fugazza(12) salsiccia(16) pepperoni(20) napoletana(24) tonno-e-cipolla(28)
--- BLOCKED: pizza-bianca needs 32, plateaus at 31, zero Pitz/inventory shortage ---
```

**Diagnosis confirmed:** every profile with even occasional ★4+ results (GOOD/NORMAL/STRUGGLING)
comfortably clears every gate with healthy Pitz margin — this is purely a `minTotalStars`
pacing problem for the strict ★1〜★3 floor, never an Economy one (zero shortage events across all
four profiles, before or after tuning).

## 4. Design comparison — A / B / C

| Criterion | A. Adjust flat gate step | B. Relative gate (recipe-count-based) | C. Hybrid (requiresRecipeId + gentle totalStars, back-half only) |
|---|---|---|---|
| Player understandability | High — a single number per recipe, same as today | Medium — "★ per unlocked recipe" needs explaining, or hides behind an opaque number anyway | High — same shape as A, framed as a scoped fix |
| Implementation complexity | **Lowest** — edit existing static numbers, zero new code | Higher — needs a live formula (`f(recipeCount)`) computed at unlock-check time, in `recipeUnlocked`/`unlockHintFor`, replacing a static field with a derived one | Same as A once the concrete values are chosen — "gentle" has to resolve to actual numbers anyway |
| Save compatibility | **Full** — `unlockCondition` stays a static field, no save/schema touch | Full for saves (still just reads `totalStars`/`dex`), but the *meaning* of a saved totalStars relative to a gate changes if the formula ever changes independent of data | Full, same as A |
| GOOD pacing | Unchanged (already far ahead of every gate) | Unchanged | Unchanged |
| NORMAL pacing | Unchanged to slightly faster | Unchanged to slightly faster | Unchanged to slightly faster |
| STRUGGLING recoverability | Solid — verified below | Solid, but only if the formula happens to compute the same numbers as A | Solid — same as A |
| HARD-CAP behavior | **Fixed** (verified below, given the right step value) | Fixed *by construction*, but only if the formula's own per-step increment is chosen ≤3 — the same constraint A has to satisfy, just hidden behind a formula rather than stated as data | Fixed, same math as A |
| Future 53-recipe scalability | **High if the step stays ≤3 per recipe** — this is exactly a fixed-ratio (`gate ≈ 3×n`) relationship already, without needing a dynamic formula | High by design, but re-introduces the same "what's the right per-recipe increment" decision A already answers, just at runtime instead of authoring time | High, same as A, but requires re-deciding "how far into the back half" every future recipe batch |
| Cooking Steps/CUT-introduction resilience | High — `minTotalStars` is orthogonal to bake mechanics; unaffected by any future per-round scoring change as long as `totalStars` stays "sum of Dex BEST stars" | Same | Same |

**Selected: A, refined to be mathematically equivalent to B without runtime complexity.** A flat
`minTotalStars` step of **+3** (matching the ★3-hard-cap player's own per-recipe capacity ceiling,
with a deliberate +6 safety margin over the idealized ceiling — see §6) is *structurally* the same
guarantee Design B would compute dynamically (`gate ≈ 3 × recipesDiscoveredSoFar`), but authored
as plain static data exactly like every other recipe field — no new code path, no new save-shape
risk, easiest to reason about, and trivially scales to a future 53-recipe chain as long as later
batches keep any new numeric gate's own step ≤3 stars above the previous one. This is the
"minimal, most understandable" method the task itself asks to prefer.

## 5. Target progression (design rationale)

The root cause (§2) is a single number: the chain's own `minTotalStars` step outpaces (by exactly
+1 per gate) the maximum totalStars a permanently-★3-capped player can ever gain per newly
discovered recipe (+3). The fix is the mirror of that: cap the step itself at **+3**, so capacity
growth (+3/recipe) always keeps pace with gate growth (+3/recipe) — a margin that, once positive,
can never go negative again, by construction, for any future recipe appended to the chain under
the same rule.

Left **unchanged**: `quattro-formaggi` (8) and `fugazza` (12) — both already carry margins of +7
and +6 respectively (§2's table), so they were never part of the problem and touching them would
be a non-minimal, unnecessary change. Only `salsiccia` through `meat-lovers` (the 8 gates whose
margin was trending toward — and past — zero) are retuned, each by exactly −1 to −8 stars,
preserving the same starting point (`fugazza`'s 12) and just correcting the step size.

## 6. Before → After gates

| Recipe | Before (minTotalStars) | After (minTotalStars) | Δ | Margin vs idealized ★3-only ceiling (before → after) |
|---|--:|--:|--:|---|
| quattro-formaggi | 8 | 8 (unchanged) | 0 | +7 → +7 |
| fugazza | 12 | 12 (unchanged) | 0 | +6 → +6 |
| salsiccia | 16 | **15** | −1 | +5 → +6 |
| pepperoni | 20 | **18** | −2 | +4 → +6 |
| napoletana | 24 | **21** | −3 | +3 → +6 |
| tonno-e-cipolla | 28 | **24** | −4 | +2 → +6 |
| pizza-bianca | 32 | **27** | −5 | +1 → +6 |
| breakfast-pizza | 36 | **30** | −6 | 0 → +6 |
| capricciosa | 40 | **33** | −7 | −1 → +6 |
| meat-lovers | 44 | **36** | −8 | −2 → +6 |

Every changed value keeps a constant **+6-star margin** over the idealized "every discovered
recipe capped at exactly ★3" ceiling — enough real-world slack that the deterministic
`STRUGGLING_HARD_CAP_PLAYER` simulation (which underperforms the idealized ceiling in practice,
per §2/§7) still clears every gate. `requiresRecipeId`/chain order, `mysteryLock`, and every
non-`minTotalStars` field are **byte-for-byte unchanged** (`git diff` confirms only the 8
`minTotalStars` numbers above changed in `src/data/recipes.ts`).

## 7. Attempts / unlock timing comparison (before → after)

| Profile | Completed (before → after) | Total attempts (before → after) | Final totalStars (before → after) | Blocked recipe (before) |
|---|:--:|---|---|---|
| GOOD | ✅ → ✅ | 16 → 16 (unchanged) | 66 → 66 (unchanged) | — |
| NORMAL | ✅ → ✅ | 19 → 19 (unchanged) | 47 → 47 (unchanged) | — |
| STRUGGLING (rare ★4) | ✅ → ✅ | **80 → 34** | 48 → 39 | — |
| HARD-CAP (never > ★3) | ❌ → **✅** | 92 → 46 | **31 → 37 (now completes)** | pizza-bianca → **none** |

**Key result:** `STRUGGLING_HARD_CAP_PLAYER` now completes the full 15-recipe chain (previously
permanently blocked at `pizza-bianca`, one star short). It reaches `meat-lovers` at exactly
totalStars 36 (its new gate) after 44 attempts, with **zero Pitz/inventory shortage
(`shortageEvents.length === 0`)** and a healthy 1,420 Pitz surplus — confirming the fix is purely
a progression-pacing correction, with no side effect on the economy. GOOD/NORMAL are
**unaffected** (they were never gated tightly enough for the old step to matter to them).
STRUGGLING (which already completed before, via its two rare ★4 excursions) now needs
meaningfully less grinding (80 → 34 attempts) — a natural, welcome side effect of removing excess
steepness from gates that were never really about GOOD/NORMAL pacing to begin with.

New recipes still unlock one at a time, gated by real `totalStars` accumulation, at every skill
level tested — "★3だけで何も考えず全コンテンツを即解放" was explicitly avoided (HARD-CAP still
needs 44 real bake attempts, not zero).

## 8. Economy impact

**None.** `git diff main -- src/data/ingredients.ts src/state/starterStock.ts
src/logic/pitzReward.ts src/logic/efficiency.ts src/logic/economy.ts src/logic/completionGate.ts
src/logic/scoring.ts src/logic/scoringV2/` is empty. `shortageEvents.length === 0` for all four
profiles, both before and after this change — the tuning never touched anything that could create
or resolve an economy shortage; it only changed how many stars are required to pass a gate, never
how much Pitz/stock is needed to attempt a bake.

## 9. 53-recipe scalability

The chosen design (§4-6) is a flat `+3`-per-recipe step from the first numeric gate onward, which
is structurally equivalent to `gate ≈ 3 × (recipes discovered before this one) − margin`, i.e.
already proportional to chain position rather than a fixed absolute number that drifts out of
scale as the chain grows. **Rule for future recipe batches:** any new numeric `minTotalStars` gate
should keep its own step ≤3 stars above the immediately preceding numeric gate (matching a
permanently-★3-capped player's own maximum per-recipe capacity gain) — doing so guarantees the
same non-negative, non-compounding margin this task restored, for as long as the chain grows,
without needing a dynamic formula or a schema change. This was directly validated by re-running
the existing `economySimulation.ts` harness (§7) rather than reasoning about it only in the
abstract, per the task's own instruction to reuse #119's simulation for exactly this kind of
verification.

## 10. Cooking Steps / CUT introduction impact

None. `Recipe.unlockCondition.minTotalStars` reads only `totalStars(dex)`
(`src/logic/mastery.ts`), itself only a sum of Dex `bestStars` — entirely decoupled from *how* a
star rating is produced (current bake/placement/match scoring, or any future Cooking
Steps/CUT-aware scoring change). A future scoring mechanic change would need to re-verify the
`REPRESENTATIVE_TOTAL_FOR_STAR` bands the simulation itself uses (`src/logic/economySimulation.ts`,
already noted as reusable infrastructure, not something this task touched), but the unlock gates
themselves need no change purely from a new cooking mechanic being introduced.

## 11. Regression tests

All required checks (STEP 8) covered by the existing + updated `src/logic/economySimulation.ts`
harness and its test file `src/logic/economySimulation.test.ts`, plus `src/data/recipes.test.ts`:

1. **All 15 recipes unlock chain** — `describe("representative progression simulation (F, G)")`'s
   dependency-chain-order test, now run across all 4 profiles including HARD-CAP.
2. **requiresRecipeId dependency** — same test; unchanged (never touched by this task).
3. **GOOD progression** — pinned complete, unchanged timing.
4. **NORMAL progression** — pinned complete, unchanged timing.
5. **STRUGGLING progression** — pinned complete, now in 34 attempts (was 80).
6. **HARD-CAP ★3 progression** — **new pinned assertion:** `completed === true`,
   `finalTotalStars === 37`, reaches `pizza-bianca`/`capricciosa`/`meat-lovers` (all previously
   unreached).
7. **Economy shortage regression** — `shortageEvents.length === 0` re-asserted for HARD-CAP
   (was already 0, still 0 after the fix — confirms this is a pure progression change).
8. **Starter Grant regression** — Test D/E unchanged, still passing (no Starter Grant value
   touched).
9. **Save/load compatibility** — `Recipe.unlockCondition` stays the same shape
   (`{ requiresRecipeId?, minTotalStars? }`); `PersistentSaveV2`'s `dex`/`inventory`/
   `pitzBalance`/`ownedIngredientIds` fields are untouched by this task, so an existing save loads
   identically — only the *comparison* against a recipe's own gate number changed, never the save
   data's own shape or meaning.
10. **Reachability to Meat Lovers** — now reachable by all four profiles, HARD-CAP included
    (previously reachable only by GOOD/NORMAL/STRUGGLING).
11. **Before → after fixed-point regression:** the old finding (STRUGGLING_HARD_CAP plateaus at
    totalStars 31, blocked before pizza-bianca ★32) is preserved in the test file's own
    before/after comment (not re-asserted as a passing expectation, since it's no longer true —
    the new pinned value is `finalTotalStars === 37`, `completed === true`).
12. **Hardcoded gate assertions** in `src/data/recipes.test.ts` (`capricciosa`'s "at 40 totalStars"
    → 33, `meat-lovers`'s "at 44 totalStars" → 36) updated to match; no other file in the
    repository hardcoded any of the 8 changed gate numbers (confirmed via a full-repo grep before
    and after).

## 12. Browser verification (390×844, headless Chromium, dev server)

Seeded `localStorage` with a synthetic save (11 recipes discovered, `margherita`→
`tonno-e-cipolla`, Dex BEST stars distributed to sum to exactly 26 — one short of
`pizza-bianca`'s new 27-star gate) to directly exercise the exact gate this task changed.

| Screen / state | Result |
|---|---|
| HOME | 0 overflow (scrollWidth=clientWidth=390), 0 console errors |
| FREE → Recipe Select (paginated, 1/15 → 15/15 pager) | 0 overflow, 0 console errors |
| `pizza-bianca` card at totalStars=26 (LOCKED, gate=27) | Lock icon shown, real name shown (not mystery — `mysteryLock` unset), unlock hint reads **「あと★1で解禁」** — exactly matching the new gate's 1-star remaining distance |
| `pizza-bianca` card at totalStars=27 (crossing the gate) | Lock icon replaced by seedling icon + **NEW** badge, hint text replaced by **「未挑戦」** (not-yet-attempted) — confirming the unlock transition fires exactly at the new gate boundary |

Also re-verified at **360×800**: identical results (0 overflow, 0 console errors, same lock →
unlock transition at the same totalStars boundary).

Screenshots captured: HOME, Recipe Select (page 1), `pizza-bianca` LOCKED (page 12/15),
`pizza-bianca` unlocked (page 12/15), at both viewports.

## 13. Full verification

| Check | Result |
|---|---|
| `npm test` (pass 1) | **93 test files / 1,792 tests — all passed** |
| `npm test` (pass 2) | **93 test files / 1,792 tests — all passed** |
| `npx tsc -b` | clean, 0 errors |
| `npx oxlint` | clean, 0 warnings |
| `npm run build` | succeeds (`tsc -b && vite build`), no errors (pre-existing >500kB chunk-size
  advisory notice only, unrelated to this task's data-only change) |

No known flake was retried to hide a failure — both full-suite passes were clean on the first run.

## 14. Duplicate PR gate #2 (immediately before this PR)

Re-ran `mcp__github__list_pull_requests` (state=open) immediately before opening this PR: same 5
open PRs as gate #1 (#105/#72/#46/#34/#3), still none progression/unlock-scoped. Re-checked
`origin/main` via `git fetch origin main` — confirmed still at the same audited SHA
(`01d0176bf1ed84af9f41fa4f1bb03d527bebfc87`), no sync needed. No duplicate.

## 15. Remaining risks

- **The new +6-star margin is generous but not unlimited.** A future recipe batch that appends a
  numeric gate with a step >3 stars above the previous gate would reintroduce the same compounding
  drift this task fixed — §9's "keep the step ≤3" rule must be followed by any future recipe
  expansion task, and re-verified with this same simulation harness rather than assumed.
- **STRUGGLING's now-shorter playthrough (34 vs 80 attempts)** was not a stated goal but is a
  direct, unavoidable consequence of removing the excess steepness that was never really needed
  for GOOD/NORMAL pacing (§7) — flagged for awareness, not treated as a defect, since it directly
  serves this task's own "STRUGGLINGプレイヤーも合理的な努力で進める" goal.
- **No change was made to the 5 non-numeric gates** (`funghi` through `genovese`, pure
  `requiresRecipeId` with no `minTotalStars`) — they were never part of the ★3-hard-cap finding and
  are out of this task's minimal-change scope.
- **`STRUGGLING_HARD_CAP_PLAYER` remains an intentionally pessimistic edge case** (a literal "never
  once exceeds ★3, for any recipe, across the entire 15-recipe chain"), not a claim that most real
  STRUGGLING players behave this way — `STRUGGLING_PLAYER` (with rare ★4 excursions) is still the
  representative "★1〜★3中心" profile for normal balance judgment, exactly as #119 established.

## Final Verdict

**A. READY — PROGRESSION TUNED**

The Fresh Audit reproduced #119's handoff finding exactly (`STRUGGLING_HARD_CAP_PLAYER` plateaus
at totalStars 31, permanently blocked before `pizza-bianca`'s old ★32 gate, with zero Pitz/
inventory shortage) and identified its precise root cause: the chain's flat +4 `minTotalStars`
step outpaces a permanently-★3-capped player's own +3-per-recipe maximum capacity gain, by exactly
1 star every gate, compounding to a hard mathematical wall by `capricciosa`/`meat-lovers`.

The fix retunes exactly 8 `minTotalStars` values (`salsiccia` through `meat-lovers`) to a flat +3
step, leaving `quattro-formaggi`/`fugazza` and every `requiresRecipeId`-only gate byte-for-byte
unchanged — the minimal change that resolves the compounding drift. Verified via the reused
Economy Tuning 2 deterministic simulation harness: `STRUGGLING_HARD_CAP_PLAYER` now completes the
full 15-recipe chain (was permanently blocked), GOOD/NORMAL pacing is unaffected, STRUGGLING needs
meaningfully less grinding, and zero Pitz/inventory shortage is preserved throughout — confirming
this is a pure progression-pacing fix with no economy side effect. No ingredient price, restock
quantity, Starter Grant, Pitz reward, Completion Gate, scoring weight, star threshold, recipe
ingredient/count, Cooking Time, Lunch Rush scoring, Firebase ranking, save schema, or reference
pizza layout value was changed (all confirmed zero-diff). Full verification (2× full test suite,
`tsc`, `oxlint`, `build`) is clean, and browser verification at both 390×844 and 360×800 confirms
the unlock transition fires exactly at each new gate boundary with no overflow or console errors.
