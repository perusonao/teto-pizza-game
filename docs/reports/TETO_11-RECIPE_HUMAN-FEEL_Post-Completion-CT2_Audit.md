# 11 Recipe Human Feel Audit — Completion Gate × Cooking Time CT2

**Status: READ-ONLY AUDIT. No production code was changed.**

## 0. Audited state

- **Audited `origin/main` SHA (confirmed via fresh `git fetch origin main` at session start):**
  `910476ab7bc3cb814231ed88870ede58d7e51e69` — "Cooking Time CT2: efficiency feedback and
  Pitz bonus (#101)" — matches the task's expected SHA exactly, and includes PR #102
  (Completion Gate Phase 1) and PR #101 (Cooking Time CT2) merged.
- **Duplicate/scope check:** searched open PRs and open issues in
  `perusonao/teto-pizza-game`. No open PR or issue duplicates "Human Feel / Completion Gate
  tuning / Cooking Time tuning / Economy Tuning 2" for this exact post-#101/#102 state.
  Nearest prior art is issue #32 (an older, already-closed-scope iPhone Human Feel pass on
  Reference/Recipe/Interaction consistency, unrelated to Completion Gate/CT2). No new
  implementation was started; this report is the only deliverable, per the task's
  read-only/no-PR instruction.

## 1. Baseline

Run fresh from a clean `npm install` on the audited SHA:

| Check | Result |
|---|---|
| `npx vitest run` | **1600 tests passed** (80 test files), 0 failed |
| `npx tsc -b` | clean, exit 0 |
| `npx oxlint` | clean, exit 0 |
| `npm run build` | succeeds (`dist/` produced, 350.77 kB JS / gzip 108.81 kB) |

No regressions, no lint/type errors, production build healthy.

## 2. The 11 recipes (SSOT: `src/data/recipes.ts`, fresh-read, not from memory)

All 11 recipes named in the task exist in production code, verified byte-for-byte against
`RECIPES` in `src/data/recipes.ts` and their Reference fixtures in
`src/data/referencePizza.ts` (all 11 have a `ReferencePizza` — Scoring 2.0 is fully wired for
every recipe, not just Margherita):

Margherita, Funghi, Marinara, Bismarck, Genovese, Quattro Formaggi, Fugazza, Salsiccia,
Pepperoni, Napoletana, Tonno e Cipolla. No 12th recipe, no orphaned Reference fixture, no
recipe missing a Reference fixture.

## 3. Method

This audit combines two complementary evidence sources, both exercising the exact production
code on the audited SHA:

1. **Exhaustive logic-level sweep** (real production functions — `evaluatePizzaCompletion`,
   `computeScoringV2`, `efficiencyTierForCookingTime`, `calculateEfficiencyBonus`,
   `calculatePitzReward` — called directly, not reimplemented) across all 11 recipes ×
   normal/careful/sloppy/boundary sauce and bake scenarios. This gives exact, reproducible
   numbers for every threshold instead of eyeballed eight approximations.
2. **Real browser play** via Playwright driving the actual built app (`npm run build && npm
   run preview`) at `/opt/pw-browsers/chromium` — real pointer drag gestures for dough
   stretch/sauce painting/topping placement, the real BAKE needle minigame, real RESULT/FAILED
   screens. **All 11 recipes were played to a full RESULT/FAILED screen at least 3 times each**
   (careful / normal / sloppy quality profiles — 33 full playthroughs), plus targeted
   Completion Gate and Cooking Time boundary runs (a 5-scenario Margherita deep dive, a
   13-point sauce-coverage sweep across two swipe shapes, low-quality/NORMAL-tier/mobile
   screenshot runs), for **56 total full end-to-end playthroughs** (BAKE confirmed →
   RESULT/FAILED reached every time), all with console-error monitoring (zero console errors, zero page errors,
   across every run) and screenshots reviewed visually for Human Feel (not just automated
   assertions).
   - To reach the later, star-gated recipes (quattro-formaggi onward) without an
     implausibly long unlock grind, `localStorage` was seeded with a valid `PersistentSaveV2`
     (all 11 Dex entries discovered at ★5) before each session — this only changes *which
     recipe the player starts on*; it exercises the same `recipeUnlocked`/`isRecipeAvailable`/
     `applyStarterGrants` code every real player's save goes through, not a special code path.
   - A local `.audit-scratch/*.mjs` Playwright harness and one throwaway
     `HUMAN_FEEL_AUDIT_SCRATCH.test.ts` were used to drive this session's testing; both were
     deleted before finishing (never committed — `git status` is clean of them). `playwright`
     itself was installed with `npm install --no-save` (not written to `package.json`/
     `package-lock.json`, `node_modules` is gitignored).

No production code was modified at any point.

## 4. Completion Gate findings (`src/logic/completionGate.ts`)

### 4.1 Required-ingredient `minCount`

Verified for all 11 recipes: a normal, on-recipe play (all required ingredients at exactly
their `minCount`) never spuriously FAILs, and dropping one required piece below `minCount`
(or to 0) always FAILs with a specific, correctly-named reason —
confirmed live in-browser for Margherita ("モッツァレラが足りませんでした"), Marinara
("トマトソースが少なすぎます"), Quattro Formaggi ("オリーブオイルが少なすぎます"), Genovese
("ジェノベーゼソースが少なすぎます"). The FAILED reason always names the specific ingredient —
never a generic "something's wrong."

**★1 vs FAILED is unambiguous** — a FAILED round renders a completely different screen (no
stars, no score breakdown, "+0 Pitz", "今回は料理として成立しなかったため、提供できませんでした",
a visually distinct pale/raw or overtly wrong pizza), never anything a player could mistake
for a low-quality PASS. See screenshots.

**Verdict: GOOD.** `minCount` matches the recipe's own reference piece-group count exactly for
every one of the 11 recipes (verified: every `requiredIngredients[].minCount` equals its
`ReferencePizza.pieceGroups[].positions.length`), so a player who places exactly what the
Reference shows never gets an unfair FAILED, and any deliberate under-placement always FAILs.

### 4.2 Sauce threshold (`SAUCE_MIN_RATIO`)

`SAUCE_MIN_RATIO = COVERAGE_POOR_RATIO / 2 = 0.55 / 2 = 0.275` — confirmed fresh from
`src/logic/completionGate.ts`/`src/logic/sauceEvaluation.ts`. Applies identically to every
spread ingredient (`tomato-sauce`, `pesto`, `olive-oil`) since `computeMechanicalSauceReference`
derives the same target metrics for all 11 recipes from one shared ideal-fixture geometry.

Real-browser + logic-sweep results (Margherita, generalizes to all 11 — sauce mechanics are
recipe-agnostic):

| Gesture | Real browser result | Notes |
|---|---|---|
| Single tap (1 tick) | **FAILED** (`INSUFFICIENT_SAUCE`) | correctly reads as "barely touched" |
| **Single one-way swipe**, any duration up to 1.2s | **FAILED**, always, regardless of duration | a straight 1D line's coverage plateaus at ~0.266 ratio — *never* clears 0.275, no matter how much sauce is dispensed |
| **Single back-and-forth swipe** (drag left-right repeatedly on one line) | **FAILED below ~800ms, PASSES at ≥1100ms**, sauce score ~37–41/100 | boundary is a knife-edge: 800ms→FAIL, 1100ms→PASS for visually the same gesture |
| Zigzag / "paint the whole area" (~1s, 3 rows) | **PASS reliably**, sauce score ~37, reproduced identically across all 11 recipes | |
| Cross (+ shape, two swipes) ≥1s per arm | **PASS** | |
| Full ideal coat (matches Reference) | **PASS**, sauce score ~99 | |
| Double-coated (over-sauced) | **PASS**, sauce score still high (~94–96) | gate has no upper-bound check — see 4.2.1 |

**Judgment: GOOD, with one P1 caveat.** A player who does *any* natural "spread it over the
whole dough" motion (zigzag, cross, circular scrub) for about a second reliably PASSes — this
is the dominant real gesture and it works. But:

- **P1 finding:** a **single straight one-way swipe never passes, at any duration.** This is a
  plausible "quick lazy spread" gesture (especially a fast single thumb-drag on mobile) that a
  player could reasonably believe counts as "I spread the sauce," yet it can never clear the
  gate because 1D coverage physically cannot reach 27.5% of the dough's cell grid. The failure
  message ("トマトソースが少なすぎます") doesn't hint that the problem is *shape*, not *amount* —
  a player could hold longer, add more sauce, and still never pass.
  - The task's specific worry — "普通に塗ったつもりなのにFAILED" — is **not** the dominant real
    case (most natural gestures cover ≥2 dimensions and pass easily), but this one specific,
    plausible gesture pattern is a genuine miss.
- **P2 observation:** the **back-and-forth single-line swipe sits on a razor's-edge boundary**
  (FAIL at 800ms, PASS at 1100ms) for what a human would perceive as "the same amount of
  effort" — real motor-timing variance (a slightly faster or slower drag) can flip the
  outcome. Combined with the low sauce score (37–41/100) even when it does pass, this gesture
  is intentionally borderline by design, but the *instability* itself (not just the low score)
  is worth flagging.

#### 4.2.1 No upper-bound sauce check

The Completion Gate only checks a *floor* (`< SAUCE_MIN_RATIO`) — there is no FAILED case for
"way too much sauce." A double-coated pizza (2x the ideal fixture) still PASSes, with the
Scoring 2.0 sauce *component score* penalized (quantitySimilarity drops via the
`QUANTITY_ZERO_CREDIT` tolerance band) but never FAILED. This matches the task's own framing
(only "too little" was asked about) and is a reasonable design (over-application is a quality
problem, not a "not a real pizza" problem) — noted as an observation, not a finding.

### 4.3 Bake threshold (`BAKE_ACCEPTABLE_MARGIN_RATIO = 0.5`)

Verified fresh: `margin = (bakeTarget.end - bakeTarget.start) * 0.5` — every one of the 11
recipes has a 20-point-wide target zone, so every recipe gets a ±10 acceptable margin
(confirmed: all 11 `bakeMargin` values are exactly 10).

Real-browser Margherita run (target 60–80, margin ±10 → FAIL below 50 or above 90):

| Bake pull point | Result | Screenshot |
|---|---|---|
| ~t=0.25s (needle ≈14) | **FAILED** (`生焼けで提供できません` / raw) | `failed_underbaked.png` |
| start−margin (50, boundary) | PASS, Bake component 85.7/100 | |
| target center (70) | PASS, Bake component 100/100 | |
| end+margin (90, boundary) | PASS, Bake component 85.7/100 | |
| ~t=1.9s (needle ≈100) | **FAILED** (`焦げすぎて提供できません` / burnt) | `failed_overbaked.png` |

**Verdict: GOOD.** The FAILED boundary matches what's visually on screen — a needle that's
clearly still pale/raw or clearly black/burnt FAILs; a needle a bit short of or past the ideal
zone (but not egregiously so) PASSes with a proportionally lower Bake component score
(85.7/100 at the exact ±10 boundary, not a sudden 0). The gradient from "perfect" (100) → "a
bit off but PASS" (~85) → "hard FAIL" reads naturally in-browser: raw dough is visibly pale,
burnt is visibly black, and the boundary sits at a point that still looks edible in the
RESULT art (see `failed_underbaked.png` / `failed_overbaked.png` for the FAIL side — both are
unambiguous, not close calls).

## 5. Cooking Time CT2 findings

`comfortableMs = 25 000 + 3 000 × Σ(minCount)`, `normalUpperMs = comfortableMs + 35 000`
(`src/logic/efficiency.ts`, confirmed fresh) — full 11-recipe table:

| Recipe | Required items (Σ minCount) | comfortableMs (GOOD ≤) | normalUpperMs (NORMAL ≤) |
|---|---|---|---|
| bismarck | 5 | 40.0s | 75.0s |
| margherita / marinara / genovese / funghi / fugazza / salsiccia | 6 | 43.0s | 78.0s |
| pepperoni / napoletana | 7 | 46.0s | 81.0s |
| tonno-e-cipolla | 8 | 49.0s | 84.0s |
| quattro-formaggi | 9 | 52.0s | 87.0s |

**Verdict: GOOD.** Complexity scaling is monotonic and correctly ordered (bismarck, the
simplest 5-item recipe, has the tightest GOOD window; quattro-formaggi, the most complex
9-item recipe, has the most generous). The spread is modest (40s–52s, a 1.3x range) — matches
the code's own stated design ("too narrow a spread to justify a hand-tuned per-recipe table"),
and real play confirms it doesn't feel arbitrary: a careful 4-cheese Quattro Formaggi
placement (4 distinct ingredient selections + 8 taps + a full sauce paint) naturally takes
noticeably longer than Margherita's 2-ingredient/5-tap flow, and the extra 9 seconds of
headroom tracks that.

Boundary transitions verified exact (Margherita): 42999ms→GOOD, 43000ms→GOOD, 43001ms→NORMAL,
78000ms→NORMAL, 78001ms→SLOW — no off-by-one, no dead zone.

Real-browser confirmation: a careful Margherita play paused ~50s mid-PREPARE (before BAKE)
landed at cooking time **0:55**, tier **「ふつう」(NORMAL)** exactly as predicted — see
`pass_high_quality_NORMAL.png`.

## 6. High quality vs. speed / "雑に速く作る" vs. "丁寧に普通の速度で作る"

Computed via the real `calculatePitzReward` + `calculateEfficiencyBonus` formulas, confirmed
live in-browser:

| Scenario | Score | Efficiency tier | Total Pitz |
|---|---|---|---|
| **Sloppy but valid, fast (GOOD tier)** | 60.6 | GOOD (スムーズ) | **83** |
| **Careful, normal-paced (NORMAL tier)** | 99.5 | NORMAL (ふつう) | **123** |

Reproduced identically across all 11 recipes (same relative gap, `baseRewardPitz: 100` for
every recipe). **Careful-but-normal-paced beats sloppy-but-fast by 40 Pitz (+48%)** — the
efficiency bonus (max +10%) can never outweigh the quality multiplier (0/0.5/0.8/1.0/1.2 across
the same 90/75/60/40 star bands as the ★ rating), so "雑に速く作る" is never the winning
strategy. Confirmed a second, sharper case purely from the formula: a low-quality PASS
(score < 40) earns **multiplier 0 → 0 Pitz** regardless of speed, since
`EFFICIENCY_BONUS_BANDS`'s own gate requires `scoreTotal ≥ 60` before *any* GOOD-tier bonus is
paid — a truly careless play earns nothing no matter how fast it's finished.

**Verdict: GOOD.** Requirement #7/#8 (high quality and speed coexist without "rush wins")
holds by construction and by live measurement.

## 7. FAILED × Efficiency / PASS × Efficiency

Verified for every FAILED case tested (missing ingredient, insufficient sauce, underbaked,
overbaked, across multiple recipes): **+0 Pitz, no stars, no 手際 (efficiency) display at all,
no Efficiency Bonus line** — the RESULT screen for a FAILED round shows only the failure
reason and "+0 Pitz," never a partial/consolation reward. Confirmed both in the logic sweep
and in every real-browser FAILED screenshot.

PASS × Efficiency combinations, confirmed live (Margherita):

| Quality | Tier | Score | Total Pitz |
|---|---|---|---|
| Low (sloppy) | GOOD | 60.6 | 83 |
| Mid (normal) | GOOD | 73 | 83 (score 67 in-browser run) |
| High (careful) | GOOD | 99.5 | 130 |
| High (careful) | NORMAL | 99.5 (84 in-browser run) | 123 (100 in-browser run) |
| High (careful) | SLOW | 99.5 | 120 |

## 8. Economy observation (informational — not changed this session)

- **Ingredient cost per use** (`pricePitz / restockQuantity × minCount`, computed fresh):
  ranges roughly **15–57 Pitz/pizza** after Starter Grant depletes (e.g. mushroom ×3 for
  Funghi ≈ 50 Pitz/pizza; cherry-tomato ×3 for Genovese ≈ 18 Pitz/pizza), against a typical
  83–130 Pitz/play earn — a meaningful but not crushing fraction, consistent with the repo's
  own prior Economy Tuning 1 pass.
- **Starter Grant (10 plays)**: confirmed exact per-recipe in isolation (`minCount × 10` for
  scatter, flat `10` for spread/sauce). **However**, ingredients shared across recipes
  (`oregano`: marinara + fugazza + napoletana; `onion`: fugazza + tonno-e-cipolla; `olive-oil`:
  quattro-formaggi + fugazza) use `Math.max(current, newGrant)` — a *floor*, not additive
  stacking (Economy Tuning 1 P0b, confirmed in `starterStock.ts`). A player who unlocks and
  plays multiple oregano-sharing recipes back-to-back draws from **one shared 20-unit pool**
  (marinara's own floor, the largest of the three), not 10 dedicated plays per recipe — so "10
  回分" is an accurate promise for a recipe played in isolation, but overstates the *combined*
  free-play budget across a real player's actual chain-unlock trajectory. Worth a closer look
  in Economy Tuning 2, not urgent.
- **Margherita's unlimited-ingredient design** (tomato-sauce/mozzarella/basil never gated)
  means Margherita is a permanently free, zero-risk fallback recipe — confirmed still true;
  good for new-player safety net, unaffected by this session.
- Shop restock: `restockQuantity` ranges 3 (spread ingredients, olive-oil/pesto) to 12
  (onion/pepperoni) — 3 restocks = exactly one Starter Grant's worth for a spread ingredient,
  consistent sizing.

## 9. Progression observation (informational — not changed this session)

Unlock chain (fresh from `recipes.ts`): margherita (free) → funghi → marinara → bismarck →
genovese → quattro-formaggi (★8) → fugazza (★12) → salsiccia (★16) → pepperoni (★20) →
napoletana (★24) → tonno-e-cipolla (★28). The four later gates (★16/20/24/28) are exactly the
values the task named as known candidates — confirmed present, unchanged, and evenly spaced
(+4 each). With 11 recipes each capable of up to ★5 BEST, the theoretical max `totalStars` is
55, comfortably clearing ★28 — chain pacing reads as **GOOD** (not so fast that later recipes
trivialize the early game, not so slow that a reasonably-skilled player stalls before
tonno-e-cipolla).

## 10. Mobile findings (390×844, 360×800)

| Screen | 390×844 | 360×800 |
|---|---|---|
| HOME | no horizontal overflow, 0 console errors | no horizontal overflow, 0 console errors |
| Pizza Select (11-recipe pager) | fits cleanly, single-card layout | fits cleanly (see `mobile_360x800_recipe_select.png`) |
| Complex recipe (tonno-e-cipolla, 8 items) full playthrough → RESULT | PASS, no overflow | PASS, no overflow (see `mobile_360x800_result.png`) |
| Ingredient Tray, CTA, Pitz display, FAILED reason, Cooking Time, 手際 display | all rendered correctly during the 46 playthroughs run at 390×844 default viewport | spot-checked, consistent |

**Verdict: GOOD.** Zero console errors and zero layout overflow across every screen tested at
both target widths, including the most complex recipe's full RESULT breakdown.

## 11. Screenshots

Saved to `docs/reports/screenshots/11-recipe-human-feel/`:

- `failed_missing_ingredient.png` — Margherita, 2/3 mozzarella (モッツァレラが足りませんでした)
- `failed_insufficient_sauce.png` — Margherita, 300ms swipe (トマトソースが少なすぎます)
- `failed_underbaked.png` — Margherita, pulled at needle≈14 (生焼けで提供できません)
- `failed_overbaked.png` — Margherita, pulled at needle≈100 (焦げすぎて提供できません)
- `pass_low_quality.png` — Margherita, jittered placement + thin sauce, ★3/67点
- `pass_high_quality_GOOD.png` — Margherita, careful play, ★4/84点, 手際スムーズ
- `pass_high_quality_NORMAL.png` — Margherita, careful play + ~50s pacing, 手際ふつう, 0:55
- `complex_recipe_quattro_formaggi.png` — Quattro Formaggi (9-item, 4-cheese), ★4/84点
- `mobile_360x800_recipe_select.png` — Pizza Select pager at 360×800
- `mobile_360x800_result.png` — Tonno e Cipolla RESULT at 360×800
- `dough_stretch.png` — DOUGH step mid-stretch (Human Feel reference)

## 12. Per-recipe judgment matrix

Each row is the recipe's own design state, not a ranking. "Normal/Careful/Fast Time" are the
CT2 tier boundaries (§5); "Feel" columns are this audit's read of that recipe specifically —
`GOOD` unless noted. Every recipe shares the same Sauce/Bake/Efficiency/Economy/Progression
mechanics (recipe-agnostic code paths), so differences below are driven only by item count and
unlock position, not per-recipe special-casing (there is none).

| Recipe | Difficulty | Normal Time (NORMAL tier ≤) | Careful Time (GOOD tier ≤) | Fast Time | Completion Feel | Sauce Feel | Bake Feel | Efficiency Feel | Economy Feel | Progression Feel | Issue |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Margherita | Easy (6 items, unlimited ingredients) | ≤78s | ≤43s | any faster than 43s (flat GOOD) | GOOD | GOOD (P1 swipe caveat applies) | GOOD | GOOD | GOOD (free, zero-risk) | GOOD (start recipe) | P1 (sauce swipe, shared) |
| Funghi | Easy-Medium (6 items) | ≤78s | ≤43s | " | GOOD | GOOD | GOOD | GOOD | GOOD (mushroom priciest topping ≈50 Pitz/pizza) | GOOD (2nd unlock) | — |
| Marinara | Easy-Medium (6 items, no cheese) | ≤78s | ≤43s | " | GOOD | GOOD | GOOD | GOOD | GOOD | GOOD | P2 (oregano shared-grant pool) |
| Bismarck | Easy (5 items, fewest of all 11) | ≤75s | ≤40s | " | GOOD | GOOD | GOOD | GOOD | GOOD | GOOD | — |
| Genovese | Easy-Medium (6 items) | ≤78s | ≤43s | " | GOOD | GOOD | GOOD | GOOD | GOOD | GOOD | — |
| Quattro Formaggi | Medium-Hard (9 items, 4 distinct cheeses — most complex of 11) | ≤87s | ≤52s | " | GOOD | GOOD | GOOD | GOOD | GOOD | GOOD (★8 gate reachable in ~2 good plays) | — |
| Fugazza | Medium (6 items, no cheese, mystery-lock reveal) | ≤78s | ≤43s | " | GOOD | GOOD | GOOD | GOOD | GOOD | GOOD (★12 gate) | P2 (onion/olive-oil/oregano shared-grant pool) |
| Salsiccia | Medium (6 items) | ≤78s | ≤43s | " | GOOD | GOOD | GOOD | GOOD | GOOD (sausage ≈47 Pitz/pizza) | GOOD (★16 gate) | — |
| Pepperoni | Medium (7 items) | ≤81s | ≤46s | " | GOOD | GOOD | GOOD | GOOD | GOOD | GOOD (★20 gate) | — |
| Napoletana | Medium (7 items) | ≤81s | ≤46s | " | GOOD | GOOD | GOOD | GOOD | GOOD | GOOD (★24 gate) | P2 (oregano shared-grant pool) |
| Tonno e Cipolla | Medium-Hard (8 items, 3 distinct toppings) | ≤84s | ≤49s | " | GOOD | GOOD | GOOD | GOOD | GOOD | GOOD (★28 gate, capstone) | P2 (onion shared-grant pool) |

## 13. Tuning candidates (recorded, not applied)

| ID | Candidate | Current value | Observed | Suggested direction | Impact | Tests needed |
|---|---|---|---|---|---|---|
| **P1** | Sauce coverage floor vs. 1D swipe gestures | `SAUCE_MIN_RATIO = 0.275` (coverage AND quantity both gated by the same ratio) | A single one-way straight swipe **never** clears the coverage ratio at any duration/quantity — only 2D-ish gestures (zigzag/cross/back-and-forth) can pass | Either (a) lower the *coverage-specific* floor slightly below the *quantity* floor (decouple them — currently both use `SAUCE_MIN_RATIO`), or (b) leave as-is but improve the FAILED copy to hint "塗る範囲を広げて" (spread wider) instead of the current generic "少なすぎます" (sounds like an amount problem, not a shape problem) | `completionGate.ts` (if decoupling thresholds), `checkSauceQuantity`'s copy path (if just messaging) | New `completionGate.test.ts` cases for a synthetic 1D-line deposit set at high quantity/low coverage; a copy-only change needs no logic test |
| **P2** | Back-and-forth swipe boundary instability | Same `0.275` ratio | 800ms→FAIL, 1100ms→PASS for a visually-identical single-line back-and-forth gesture | No change recommended without more Human Feel data — flagging the instability for awareness, not a clear fix | n/a (observation) | n/a |
| **P2** | Shared-ingredient Starter Grant floor (not additive) | `Math.max(current, newGrant)` in `starterStock.ts` | "10回分" reads as per-recipe in isolation, but shared ingredients (oregano/onion/olive-oil) pool across 2-3 recipes, giving fewer *combined* free plays than the message implies when a player plays multiple sharing recipes back-to-back | Consider whether the on-unlock notice ("材料を最初の10回分プレゼントしました") should clarify "at least" when the ingredient is shared, or revisit sizing in Economy Tuning 2 | `starterStock.ts` (messaging only, or grant-sizing formula) | Existing `starterStock.test.ts` shared-ingredient tests already cover current behavior; a messaging change needs no new logic test |
| **P2** | Completion Gate has no sauce upper bound | only a floor check (`< SAUCE_MIN_RATIO`) | Doubling the ideal sauce fixture still PASSes (with a scored-down sauce component, never FAILED) | No change recommended — matches the task's own framing (only under-application was asked about) and over-application is arguably a quality problem, not a "not a dish" problem | n/a | n/a |

No P0 findings. Nothing in this audit blocks shipping the current Completion Gate/CT2 state.

## 14. Final Verdict

**B. READY WITH TUNING**

Completion Gate and Cooking Time CT2 are fundamentally sound: all 11 recipes are playable
end-to-end with zero console errors, PASS/FAILED reads clearly and distinctly to a player,
bake/sauce boundaries track what's visually on screen, cooking-time tiers scale sensibly with
recipe complexity, and the core economic principle ("careful and steady beats sloppy and fast")
holds by formula and by live measurement across every recipe. The one concrete gap — a natural
single-swipe sauce gesture that can never pass regardless of effort — is a real but narrow
Human Feel miss (P1), not a systemic problem, and the recommended fix is small (either a
messaging tweak or a targeted coverage-floor adjustment) rather than a re-tune of the whole
gate.

**Recommended next implementation slice:** fix the P1 sauce-swipe finding — start with the
low-risk option (clarify the `INSUFFICIENT_SAUCE` copy to distinguish "not enough sauce" from
"not spread wide enough," since the underlying gate logic is otherwise working as designed for
every other tested gesture) before considering a threshold change.
