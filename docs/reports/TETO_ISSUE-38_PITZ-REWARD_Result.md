# Issue #38 E-P1/E-P2 — Score-based Pitz Reward Core + RESULT/Persistence — Result

Implementation of Issue #38's E-P1 ("Score-based reward core") + E-P2 ("RESULT + persistence"),
scoped as one 2-3 hour slice per the task's own instruction, now that the Fresh Audit's own gate
(`docs/reports/TETO_ISSUE-38_PITZ-REWARD_Fresh-Audit.md`, verdict **A. READY AFTER SCORING
AUTHORITY**) is satisfied: Scoring 2.0 A1 Authority Cutover is merged (PR #60, A2 Human Review
PASS), and A3 legacy retirement (A3a PR #62 + A3b PR #63) is merged into `main` — `scorePizza`/
`scorePlacement` no longer exist in the codebase in any form, re-confirmed by this session's own
fresh grep before implementation (§1 below).

## 0. SHAs

- **Start SHA**: `0576430757e9e9424936d25554ea9b24a7a5fd10` (`origin/main`, matches the task's
  expected SHA exactly — `git fetch origin && git rev-parse origin/main` confirmed before any
  change; this is A3b's own merge commit, PR #63). Working tree confirmed clean before and after.
- **Final SHA**: `cfd87e1a42f68072633a8cacef976a4a7df6e615` (branch
  `claude/pitz-reward-v1-mlef26`, single commit on top of the start SHA — no rebase/force-push
  used).
- **PR**: [#64](https://github.com/perusonao/teto-pizza-game/pull/64), opened against `main`,
  **left OPEN**, not merged, pending ChatGPT/Human Review.

## 1. Pre-implementation verification (task's own required checks)

Re-confirmed by fresh grep against the start SHA, not merely cited from prior reports:

```
$ grep -rn "function scorePizza\|export function scorePizza\|function scorePlacement" src/
(no output -- 0 matches)
$ grep -rln "scorePizza(\|scorePlacement(" src/ --include="*.ts" --include="*.tsx" | grep -v "\.test\."
(no output -- 0 production call sites)
```

`scorePizza`/`scorePlacement` are fully retired (A3b), confirming this task's own premise: "Fresh
Audit は古い main で作成されている… 現在は Authority 待ちは解除済み" is correct as stated. PR #62
(A3a) and PR #63 (A3b) are both merged into `main` (visible directly in `git log --oneline`
above the start SHA — A3b's own merge commit *is* the start SHA).

## 2. Reward formula

`src/logic/pitzReward.ts` (new, pure domain module):

```
qualityMultiplierForScore(total): total clamped to [0,100] (non-finite -> 0), then:
  90-100 -> x1.20   75-89 -> x1.00   60-74 -> x0.80   40-59 -> x0.50   0-39 -> x0.00
calculatePitzReward(baseRewardPitz, scoreTotal):
  safeBaseReward = baseRewardPitz if finite and > 0, else 0
  earnedPitz = max(0, Math.round(safeBaseReward * qualityMultiplierForScore(scoreTotal)))
applyPitzCredit(baseRewardPitz, scoreTotal, balanceBefore):
  balanceBefore clamped to >= 0 (non-finite/negative -> 0)
  balanceAfter = balanceBefore + earnedPitz
```

Bands are byte-for-byte `scoring.ts`'s existing `STAR_THRESHOLDS` (90/75/60/40/0), per the Fresh
Audit's own recommendation — the Pitz tier a player lands in always matches the star rating shown
on the same screen. Deliberately reads only an abstract `scoreTotal: number` — **never imports
`scoringV2/`** — so the reward module stays isolated from the authority boundary exactly as the
Fresh Audit's §1 required (grep-confirmed: `pitzReward.ts` has zero imports from
`../logic/scoringV2` or `../logic/scoring`).

`src/data/recipes.ts`: `Recipe` gained a `baseRewardPitz: number` field, set to `100` for all 7
recipes (margherita, marinara, quattro-formaggi, genovese, bismarck, funghi, fugazza) — no
difficulty differentiation in V1, per the Fresh Audit's explicit recommendation. Authored
data only; `RECIPES` is a source-code array, never part of the Save schema.

## 3. Mode contract

- **FREE**: `REGISTER_TO_DEX` (`src/state/gameReducer.ts`) now also applies the Pitz credit, in
  the same atomic transition that already registers Dex and advances `phase` to `DISCOVERED`.
  Extended, not duplicated — the exact recommendation of the Fresh Audit's §3 "Pattern A".
- **Lunch Rush**: completely unchanged. `calculateMissionReward`/`CLAIM_MISSION_REWARD`
  (`src/logic/economy.ts`) and `MISSION_NEXT_ORDER`'s own Dex-registration path are untouched —
  `git diff --stat origin/main -- src/logic/economy.ts` is empty. An explicit
  `state.isMissionRound` guard inside `REGISTER_TO_DEX` means even a stray dispatch against a
  Mission `RESULT` state cannot apply a per-pizza credit (reducer-level backstop, not just a UI
  convention — `ResultPanel`'s register button is already gated on `!isMissionActive`).

## 4. Exactly-once proof

`REGISTER_TO_DEX`'s pre-existing guard — `if (state.phase !== "RESULT" || !state.score) return
state;` — is unchanged and is what the Pitz credit now rides on. A second dispatch after the
first succeeds sees `phase === "DISCOVERED"` and is rejected before either Dex or Pitz is touched
again; `gameReducer.pitzReward.test.ts`'s `"REGISTER_TO_DEX credits Pitz exactly once, even if
dispatched twice"` asserts the second result is referentially `=== ` the first (a true structural
no-op, not merely "the amount happens to match"). Reload/retry cannot re-trigger a credit either:
`GameState` (including `phase`/`score`/`lastPitzCredit`) is never persisted, and
`RETRY_SAME_RECIPE`/`PLAY_AGAIN` both construct a fresh `PREPARE`/`ORDER` state with no leftover
`RESULT` to re-credit against (`buildOrderState` resets `lastPitzCredit` to `null` for every new
round) — both are covered by dedicated tests.

## 5. Persistence proof

No Save schema/version change. `pitzBalance` already persists via the existing `persistProgress`
path (`src/state/persistence.ts`, unchanged — `git diff --stat origin/main -- src/state/
persistence.ts` is empty). `lastPitzCredit` is transient only, exactly like `score`/
`scoringV2Result` — never serialized. `gameReducer.pitzReward.test.ts`'s persistence describe
block round-trips a FREE-credited `pitzBalance` through `persistProgress` → `loadSave` and
confirms `schemaVersion` stays `2`.

## 6. RESULT/DISCOVERED UX

RESULT itself (`ResultPanel.tsx`) is untouched — Scoring 2.0 remains the sole, uncrowded focus of
that screen, per the task's explicit instruction. The Pitz summary renders instead on the
DISCOVERED screen (reached only after the player presses RESULT's existing "レシピ図鑑に登録す
る", the same gesture that now also applies the credit), reading only the reducer-applied
`state.lastPitzCredit` snapshot — no recomputation in the display layer:

- 今回の獲得 `+N Pitz`
- 基本報酬 `100 Pitz`
- 出来栄え倍率 `x1.20` (etc.)
- 所持Pitz `before -> after`
- A 0-Pitz round shows an explicit one-line reason ("出来栄えが基準に届かず…") rather than a bare
  `+0 Pitz` with no context.

Currency is always "Pitz" — no 円/¥ anywhere in the new UI (confirmed by direct source read of
the new JSX/CSS). New CSS (`.pitz-credit-summary`, `App.css`) reuses the existing warm-rustic
color tokens (`#6b4226`/`#f5ecd8`/`#b8860b`) already used by `ResultPanel`/`discovered-banner`,
rather than introducing a new palette.

## 7. Tests

`npm test` (vitest): **1113/1113 passing, 57/57 files** (was 1101/56 pre-PR — net +12 new files'
worth: `src/logic/pitzReward.test.ts` [29 tests] + `src/state/gameReducer.pitzReward.test.ts`
[12 tests], minus 0 removed).

- **Reward core** (`pitzReward.test.ts`): all 9 requested boundary pairs (39->x0/0, 40->x0.5,
  59->x0.5, 60->x0.8, 74->x0.8, 75->x1.0, 89->x1.0, 90->x1.2, 100->x1.2), determinism, a pinned
  `.5`-boundary rounding case (65 base x 0.5 multiplier = 32.5 -> `Math.round` -> 33), and
  malformed-input safety (negative/NaN/Infinity base and score both clamp to the safe side).
- **FREE** (`gameReducer.pitzReward.test.ts`): high-quality (real Scoring-2.0-derived score, not
  hand-faked — a full `PREPARE -> BAKE -> RESULT` playthrough through the actual reducer),
  mid-quality, and a real 0-39-band low-quality round (0 Pitz, balance unchanged); double-dispatch
  exactly-once; an un-registered RESULT leaves `pitzBalance` unchanged; `RETRY_SAME_RECIPE`/
  `PLAY_AGAIN` reset `lastPitzCredit` to `null` while carrying the credited balance forward; a
  second round accumulates on top of the first's balance.
- **Lunch Rush isolation**: `MISSION_NEXT_ORDER` never sets `lastPitzCredit`/touches
  `pitzBalance`; a stray `REGISTER_TO_DEX` against a Mission `RESULT` is a no-op.
- **Persistence**: credited `pitzBalance` round-trips through `persistProgress`/`loadSave`
  unchanged; `schemaVersion` stays `2`; a rehydrated `createInitialGameState` carries the balance
  forward with no leftover round credit.
- **Dex BEST / Scoring**: no test in the existing 7-recipe/Golden-Matrix/malformed suites was
  touched (`git diff --stat origin/main -- src/logic/scoringV2/ src/data/referencePizza.ts` is
  empty beyond the one `recipes.ts` field addition) — only `src/state/progression.test.ts`'s
  test-only mock `Recipe` fixture needed a `baseRewardPitz: 100` literal to keep compiling.

`npx tsc -b` / `npm run build` / `npm run lint` (oxlint): all clean, exit 0.

## 8. Preview deployment

**Preview repo**: `perusonao/teto-pizza-game-preview`
**Preview URL**: https://perusonao.github.io/teto-pizza-game-preview/ · badge `PREVIEW · PR#64 ·
cfd87e1`

Triggered the existing manual pipeline (unchanged, no new workflow files):

1. `deploy-from-source.yml` (`workflow_dispatch`) with `ref=cfd87e1a42f68072633a8cacef976a4a7df6e615`,
   `pr_number=64` -> run [35336258532](https://github.com/perusonao/teto-pizza-game-preview/actions/runs/35336258532)
   (run #28), **success**. Built with `VITE_PREVIEW_MODE=1 VITE_PREVIEW_PR=64
   VITE_PREVIEW_SHA=cfd87e1` and `--base=/teto-pizza-game-preview/`, pushed to this repo's
   `site/` as commit `efff5c61411ccd721bed3d0053878f1da884e749`.
2. `pages.yml` (`workflow_dispatch`) -> run
   [35336325493](https://github.com/perusonao/teto-pizza-game-preview/actions/runs/35336325493)
   (run #29), **success**, `head_sha: 3fb5a4234d9abfe37eb6e747141ef068f9c63182`, publishing that
   exact build.

**Network caveat for this session** (same constraint as the PS1/PS2 Preview-Gate report):
this sandbox's egress policy blocks `perusonao.github.io` directly (`CONNECT tunnel failed,
403`). To still verify real behavior, this session rebuilt **the exact same commit with the exact
same build command** the workflow used (`VITE_PREVIEW_MODE=1 VITE_PREVIEW_PR=64
VITE_PREVIEW_SHA=cfd87e1 vite build --base=/teto-pizza-game-preview/`, plus the same
manifest/`noindex` post-processing) and served that output locally to drive the Review
Playthrough below — byte-for-byte the same static bundle now live at the Preview URL. This does
not replace the Human Feel gate; the user should still confirm on a real iPhone before merging.

## 9. Review Playthrough (390x844)

Delivered directly to the user (not committed — `artifacts/` is gitignored):
`artifacts/review/TETO_ISSUE-38_PITZ-REWARD_Review-Playthrough.mp4` (~33s, H.264/mp4, 390x844).

Driven with Playwright + Chromium against the locally-served preview-equivalent bundle (real UI
interactions only — dough radial-stretch drag, sauce-paint drag, ingredient tap-to-place, real
bake-gauge timing — no reducer/dev shortcuts), covering:

1. **A. FREE high-quality Margherita**: dough stretch -> sauce paint (drag gesture, not the
   one-shot tap) -> 3 mozzarella + 2 basil -> bake confirmed in the glowing perfect-zone moment ->
   RESULT shows Scoring 2.0 total **92/100**. Registering -> DISCOVERED shows: 今回の獲得
   **+120 Pitz** / 基本報酬 100 Pitz / 出来栄え倍率 **x1.20** / 所持Pitz **0 -> 120**.
2. **B. FREE lower-quality Margherita** (retry, same recipe): sauce/basil deliberately skipped,
   only 1 of 3 required mozzarella placed, pulled out immediately (raw bake) -> RESULT shows a
   real (not faked) Scoring 2.0 total of **14/100**. Registering -> DISCOVERED shows 今回の獲得
   **+0 Pitz** / 出来栄え倍率 **x0.00** / 所持Pitz **120 -> 120**, plus the one-line "出来栄えが
   基準に届かず、今回はPitzを獲得できませんでした" explanation — the reward difference between A
   and B is stark and self-explanatory.
3. **C. Lunch Rush**: entered from HOME, one round played through to `MissionServePanel`
   (recipe was randomly picked as マリナーラ) — its text (`★★★★★ / 93点 / SERVED (1) / 次の注
   文へ`) contains **no mention of "Pitz" anywhere**, confirming no per-pizza FREE reward leakage.
   The Mission's virtual clock was then fast-forwarded past its 180s duration
   (`context.clock.fastForward`, Playwright's virtual-time API — this is a test-harness time
   control, not a game feature) to reach `MissionResultOverlay` without a real 3-minute wait:
   its existing, **unchanged** end-of-run reward fired exactly as before A1/A3 —
   **+90 Pitz**, balance **120 -> 210** (120 carried over from Scenarios A/B's FREE credit,
   confirming the two reward paths compose additively with no double-counting or interference).

**No horizontal overflow** at any of the 9 recorded checkpoints (HOME, Pizza Select, PREPARE,
RESULT x2, DISCOVERED x2, Lunch Rush intro, Mission serve panel, Mission result):
`document.documentElement.scrollWidth === clientWidth === 390` at every one
(`overflow-report.json`, all `false`). Zero `console.error`/`pageerror` events across the entire
run.

## 10. Known balance concerns / non-blocking observations

- **V1 balance values are provisional**, exactly as the Fresh Audit and Issue #38 itself say —
  `100 Pitz` base x the five multiplier bands is a first pass, not a tuned economy. E-P3 (Human
  Feel) is the explicitly deferred next step for any rebalancing, per Issue #38's own slice plan.
- **Sauce quality materially drives the FREE reward now**, more than a first-time player might
  expect: Scenario A's 92/100 came from a real drag-painted sauce coverage, not the simpler
  one-shot tap (`APPLY_SAUCE`) — a player who only ever taps once for sauce (still a fully legal,
  supported interaction) will likely land in a lower quality band than one who paints it, since
  Sauce is Scoring 2.0's heaviest component (52/100). This is a pre-existing Scoring 2.0 property
  (unchanged by this PR) now made economically visible for the first time — worth watching in
  E-P3's real-device Human Feel pass specifically because Pitz reward size is the first time this
  difference has a concrete number attached to it, not just a star rating.
- **Recipe base reward is uniform (100) across all 7 recipes** — a harder recipe (e.g.
  quattro-formaggi's 4-group equal-weight Pieces averaging, already flagged as a live calibration
  question since A1) earns the same base reward as an easier one. Deliberately deferred per the
  Fresh Audit's explicit recommendation; a candidate follow-up once E-P3 has real playtesting
  evidence.
- **DISCOVERED's Pitz summary and the "NEW BEST!"/discovery banners can both render at once** for
  a first-time high-quality play — not visually crowded at 390x844 in this session's testing (see
  the Review Playthrough), but worth a specific look during E-P3's real-iPhone pass since it
  wasn't a scenario this audit deliberately isolated.

## 11. GitHub

- Commit `cfd87e1a42f68072633a8cacef976a4a7df6e615` on branch `claude/pitz-reward-v1-mlef26`,
  pushed to `origin`.
- PR [#64](https://github.com/perusonao/teto-pizza-game/pull/64) opened against `main`, CI
  (`build` check) green, `mergeable_state: clean`.
- **Left OPEN, not merged**, pending ChatGPT/Human Review per the task's explicit instruction.

## 12. Next step

**E-P3 — Human Feel / balance** (Issue #38's own next slice): real-device (iPhone, 390x844)
confirmation that low/mid/high-score reward differences read as meaningful progression feedback,
specific attention to the Sauce-quality-drives-reward interaction flagged in §10, and any
resulting multiplier/base-reward tuning — only once real playtesting evidence exists, not
speculatively in this slice.

## Final verdict

**A. READY FOR HUMAN REVIEW**

Reward core is a pure, deterministic, fully-tested domain module isolated from the Scoring 2.0
authority boundary; FREE crediting is exactly-once by construction (extends `REGISTER_TO_DEX`'s
existing atomic guard, does not add a new action or effect); Lunch Rush's existing per-run reward
is provably untouched and isolated; no Save schema/migration was needed or made; `npm test`
(1113/1113), `npx tsc -b`, `npm run build`, and `npm run lint` are all clean; the 390x844 Review
Playthrough demonstrates a real high-quality FREE credit (+120 Pitz), a real low-quality FREE
credit (+0 Pitz, explained), and Lunch Rush's unchanged end-of-run reward composing correctly
with no double-counting or leakage, with zero horizontal overflow and zero console errors across
every recorded checkpoint.
