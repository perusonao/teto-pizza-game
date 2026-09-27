# Discovery Hint 3.0 — H3-3 Runtime Wiring: Result (Issue #238)

> Status: **Implemented, PR OPEN for Owner review.** §1–§2.1 were recorded before any code was
> written (Step 0). §3–§22 record the implementation and its gate. No merge. H3-4 is not started.
> Dinner is untouched.

## 1. Audited main

This audit reflects `main` = `4e78f3d` (Merge PR #244, H3-2), fetched fresh at the start of the session.

- Dinner DM-3 PR #243 is still open, and nothing here touches it.
- That PR edits `App.tsx`, `GameScreen.tsx`, `HomeScreen.tsx` and `App.css`.
- It does not edit `gameReducer.ts`, `discoveryHint.ts`, `HintSheet.tsx`, `persistence.ts`, or any
  `src/logic/discovery/*` file.
- H3-3 therefore keeps its edits to the four shared files minimal. That means a few lines in
  `App.tsx`, one prop in `GameScreen.tsx`, and one small CSS block.

## 2. Integration Map (Step 0, before code)

| Area | Current authority on `main` |
|---|---|
| Hint entry points | Three entry points all dispatch `SHOW_HINT`:<br>- Free Cooking 「ヒント」 button → `SHOW_HINT` (App.tsx `onShowHint`)<br>- Dex 🎨 card → `handleDexShowHint` → free-cook round + `SHOW_HINT { pinnedRecipeId }`<br>- Result 「💡 ヒントを見る」 → `handleRetryWithHint` → `RETRY_SAME_RECIPE` + `SHOW_HINT` |
| Sheet | `HintSheet.tsx` renders `hintSheetView(state)` (`discoveryHint.ts`). `GameScreen.tsx:724` passes `onUnlock` → `PURCHASE_DISCOVERY_HINT { level }`. Visible only in a Free Cooking PREPARE (`isHintSheetVisible`). |
| Target | `resolveHintSession`:<br>- The target must be DISCOVERABLE.<br>- A Dex pin keeps its recipe.<br>- A session target is sticky once H1+ is revealed or bought.<br>- Otherwise the deterministic order picks the target (`selectHintTarget`).<br>- With no DISCOVERABLE target, the sheet shows SHOP_NEW / REFILL / COMPLETE. |
| Purchase (Economy 1.0) | `PURCHASE_DISCOVERY_HINT` → `unlockNextHint` → `purchaseDiscoveryHint`: 5/10/20/40 Pitz, `requestedLevel === purchased + 1`, raises `discoveryHintPurchases`. |
| Dex-0 onboarding | `isHintOnboardingFree(0, "margherita")` means a free reveal. It is session-only (`hintSession.revealedIndex`) and never persisted. Auto-escalation comes from `preDiscoveryFreeCookAttempts`. |
| Pitz | `GameState.pitzBalance` is persisted through `persistProgress` in App.tsx's progression effect. |
| Save / load | `loadSave` → `createInitialGameState(..., save.discoveryHintPurchases)`. The effect persists `discoveryHintPurchases`. **`discoveryHintFacts` exists in the save (H3-2), but GameState neither reads nor writes it yet.** |
| H3-1 / H3-2 | Pure and unwired, with no importer: `selectableHint.ts` (model, pricing, purchase, presentation) and `hintFactMigration.ts` (`selectableHintSavedState` → `purchasedFactIds`, `legacy`, `grandfatheredSteps`). |
| Timer | `isHintSheetVisible` feeds `isAnyCookingTimingPauseReasonActive`, so the timer pauses while the sheet is open and resumes when it closes. |
| Near-miss | `resultNearMiss` uses DISCOVERABLE candidates only and names no ingredient. It does not depend on hint state. |
| Dinner | `DINNER_BLOCKED_ACTIONS` contains `PURCHASE_DISCOVERY_HINT`. A Dinner round is never `freeCook`. |
| Full Reset | `resetSave()` removes the whole key (both ledgers). |

## 2.1 Plan (derived from the map)

**New action** `PURCHASE_SELECTABLE_HINT { preference, expectedPaidCount }`. The guards are:

- the sheet is open;
- the round is a Free Cooking PREPARE;
- a session target exists and is still DISCOVERABLE;
- the target is not the Dex-0 Margherita onboarding.

The action calls H3-1's `purchaseSelectableHint` with input from H3-2's `selectableHintSavedState`.

- **Success:** Pitz is debited exactly once. The target's `discoveryHintFacts` becomes the union of
  the stored list (unknown or future ids kept) and the new facts. `discoveryHintPurchases` is left
  untouched.
- **GUIDANCE_ONLY:** nothing progression-related changes. Only a transient, never-persisted UI flag
  `hintOutcome` is set, so the sheet can show generic guidance.
- **Any rejection** (stale, insufficient, invalid, not a target): `state` is returned unchanged.

**`PURCHASE_DISCOVERY_HINT` becomes onboarding-only.** It still handles the Dex-0 Margherita free
reveal. A paid Economy 1.0 level is no longer sold, so the legacy field can no longer advance at
runtime. The legacy field remains the read authority for `LegacyHintProgress` and
`grandfatheredSteps`.

**The sheet has two modes.**

- The onboarding keeps today's Hint 2.0 free flow unchanged.
- Every other target gets a `SELECTABLE` view, built from `selectableHintPresentation`, the H0 line
  and the grandfathered lines. It is a minimal UI: preference radios, price, CTA, wallet, revealed
  chips, a legacy section and a guidance line. Final polish is left to H3-4.

**Persistence:**

- `GameState.discoveryHintFacts` is hydrated from `loadSave`.
- It is carried through `ProgressionCarry`.
- `App.tsx` passes it to `persistProgress`, where it is union-merged (H3-2).
- schemaVersion stays 2.

**Session stickiness:** a target with Hint 3.0 facts is sticky, just like one with legacy levels, so
a reload keeps the bought target.

**Dinner:** the new action is added to `DINNER_BLOCKED_ACTIONS` as defense in depth. No Dinner file
changes.

## 3. Reducer authority

`PURCHASE_SELECTABLE_HINT { preference, expectedPaidCount }` is a new action. It is the only path that
buys a Selectable Hint fact.

- **Guards (reducer):** the sheet is open, the round is a Free Cooking PREPARE, and the round is
  not a guided, Lunch Rush or Dinner round. The action is also in `DINNER_BLOCKED_ACTIONS` as
  defense in depth.
- **Guards (state layer):** `purchaseSelectableHintFact` (`src/state/discoveryHint.ts`) checks that:
  - a session target exists and is still DISCOVERABLE (`isSessionTarget`);
  - the target is not the Dex-0 Margherita onboarding (`selectableContext` returns `null`).
- **Authority:** H3-1's `purchaseSelectableHint`. Its input comes from H3-2's
  `selectableHintSavedState`, which reads both ledgers (`purchasedFactIds`, `legacy`). The reducer
  does no pricing, fallback or legality work of its own.
- **Success:** a single patch sets:
  - `pitzBalance`: debited once, by the price H3-1 returned;
  - `discoveryHintFacts[target]`: the stored list (unknown or future ids kept verbatim) plus the
    one revealed fact.
  `discoveryHintPurchases` is never in the patch. A null-prototype copy of the ledger is used.
- **GUIDANCE_ONLY:** the patch is `{ hintOutcome: "GUIDANCE_ONLY" }` only. This is a transient
  session flag: not part of `ProgressionCarry`, never persisted, and reset by SHOW_HINT, CLOSE_HINT
  and a fresh round. A repeated request with the flag already set returns `state` (identity).
- **Rejections** (`NOT_A_TARGET`, `INVALID_PREFERENCES`, `STALE`, `INSUFFICIENT_PITZ`, no session,
  onboarding, wrong phase or round) return `state` unchanged (identity).
- **`PURCHASE_DISCOVERY_HINT`** now runs only while `isOnboardingHintSession` holds (Dex 0 +
  Margherita). Outside the onboarding it returns `state`. Economy 1.0 levels are therefore no longer
  sold, and the legacy field cannot advance at runtime.
- **Session stickiness:** `hasBoughtHints` makes a recipe the preferred target again after a reload
  when it has a legacy level or a non-empty fact list. This is HE-UI-4, extended to facts.

## 4. Persistence wiring

The fact ledger now goes through the real save path, end to end:

- `GameState.discoveryHintFacts` is hydrated in `App.tsx`'s load path:
  `createInitialGameState(..., save.discoveryHintPurchases, save.discoveryHintFacts)`.
- It is carried through `ProgressionCarry`: `buildOrderState`, `nextMissionOrderState`,
  `createInitialGameState`, `carryOf`, and every explicit copy in PLAY_AGAIN / SELECT_RECIPE /
  START_FREE_COOK / RETRY_SAME_RECIPE / MISSION_*. That is 7 carry copies plus the type.
- It is written by App's progression effect: `persistProgress({..., discoveryHintFacts})`, with
  `state.discoveryHintFacts` in the dependency list. H3-2's per-recipe union merge means a stale
  snapshot can never drop a fact.
- `schemaVersion` stays 2. `writeSave`'s forward-compatible extras and `KNOWN_SAVE_KEYS` are
  unchanged (H3-2).
- GUIDANCE_ONLY writes nothing: the saved JSON before and after the request is equal (matrix 12/13).
- Full Reset (`resetSave`) removes the whole key, so both ledgers go (matrix 29).

## 5. Legacy coexistence

- `discoveryHintPurchases` stays the read authority. It is hydrated, carried and persisted exactly
  as before, but no action writes it any more (mutation M2 is killed).
- `selectableHintSavedState` derives `legacy = { paidRungs, grantedFactIds }` and
  `grandfatheredSteps` from it on every read. This derived view is never copied into
  `discoveryHintFacts`.
- A legacy buyer:
  - sees the granted facts as revealed chips;
  - is never sold them again;
  - continues the price ladder from the paid rung.
  New purchases go to `discoveryHintFacts` only (matrix 15–18, 32).

## 6. Pricing

H3-1's `selectableHintNextPrice` / `selectableHintBatchPrice` sets every price: 5 / 10 / 20 / 40,
capped at the recipe's Hint 2.0 cost (35 / 75). The UI shows `presentation.nextPrice`, and the
reducer charges the price H3-1 returns for the same paid count.

| Case | Next price | Test |
|---|---|---|
| fresh | 5 | matrix 1 |
| 2nd / 3rd / 4th fact | 10 / 20 / 40 | matrix 6 (capricciosa) |
| legacy H1 | 10 | matrix 15 |
| legacy H2 | 20 | matrix 16 |
| legacy H3 | 40 | matrix 17 |
| legacy H4 (paid out) | nothing left: GUIDANCE_ONLY, 0 charged | matrix 18 |
| unknown / future / reserved ids stored | not counted (still 5) | matrix 21, 22b (mutation M4 killed) |
| grandfatheredSteps | not counted | matrix 20 (mutation M5 killed) |
| after reload | the next price is kept | matrix 4, App reload test |

The whole ladder is spent within each recipe's cap. Walk test: 24 paid stages, every stage ≤ its
cap; pizza-bianca spends 0.

## 7. Category preference (OD-H3-14)

- The sheet always offers the same three radios: ソース / チーズ / トッピング. ソース is selected
  by default.
- The CTA sends `(preference, paidCount)`.
- H3-1's `resolveHintPreferences` serves the preferred category when that category still has a
  fact. Otherwise it falls back sauce → cheese → topping, for one fact at the normal price
  (matrix 10, 11).
- The UI never disables a radio, marks a row as empty or complete, or shows a count. Every target
  shows the same three rows and the same three radios (matrix 34, HintSheet shape sweep).
- A row with nothing revealed shows 「？」 for every target alike.

## 8. GUIDANCE_ONLY (OD-H3-17)

A request with nothing left to sell answers:

- price 0: no Pitz, no fact, no legacy change, no save write;
- one line: 「このピザは、今わかっているヒントを手がかりに考えてみよう！」

There is no recipe special case:

- pizza-bianca (key + reserved only) behaves exactly like any exhausted target (funghi after its
  one fact) and like a synthetic future zero-fact recipe (matrix 12–14).
- Before the request, pizza-bianca's sheet looks like any other: price 5, same rows and radios
  (matrix 13b). No FREE LEAK.
- The line only appears after the request. That is INTERACTION INFERENCE, which is allowed.

Mutation M7 (GUIDANCE_ONLY costs 5) is killed.

## 9. Dex 0

- **Dex 0 + Margherita:** unchanged Hint 2.0 free onboarding (TARGET view, 「次のヒントを見る」).
  No Pitz, no ledger. The Selectable action is refused there (matrix 23; the existing onboarding
  tests are all still green).
- **Dex 0 + another DISCOVERABLE recipe** (a migrated save, pinned bismarck): the Selectable sheet,
  **paid** (5 Pitz), saved to `discoveryHintFacts`. The legacy action is refused there too
  (matrix 24). Mutation M8 (Dex 0 any recipe free) is killed.

## 10. Timer

No timer code changed. The purchase happens inside the open sheet, so the existing
`isHintSheetVisible` → cooking-timing pause still covers it. The migrated tests are
`App.cookingTimingBackground.test.tsx`, "Discovery Hint sheet pause":

- Free Cooking;
- Result 「ヒントを見る」 → buy two facts → close → bake: exactly 0:06 counted, with 30 s of sheet
  time excluded;
- insufficient Pitz.

Double or stale taps are stopped in two layers:

1. **The reducer** rejects any request whose `expectedPaidCount` no longer matches (matrix 8/9;
   mutation M10 is killed).
2. **The CTA itself** has an activation latch (`SELECTABLE_BUY_LATCH_MS` = 450 ms, in
   `HintSheet.tsx`). A real double-click or key repeat lands its second click *after* React has
   re-rendered the sheet with the new paid count, so that click carries a fresh count the reducer
   would accept. Codex review P1 on #247 found this.
   - While the latch is on, further activations are ignored and the CTA is `aria-disabled`.
   - It is a ref, so it takes effect synchronously. Focus stays on the CTA.
   - Tests: the App test (`user.dblClick` + click + Enter×2 buys exactly one fact, then re-arms) and
     a HintSheet unit test (fake timers). Removing the latch fails the App test. Dinner
never opens the sheet (`freeCook` is false). The action is Dinner-blocked in any case.

## 11. Near-miss

`resultNearMiss` has no change and no hint-state input:

- its input type does not include either ledger;
- it only returns the fixed `NEAR_MISS_COPY` lines.

The 25-ladder walk now asserts, at every Dex ≥ 1 stage, that:

- the line is one of the fixed copies;
- the result is identical with the fact ledger cleared.

## 12. grandfatheredSteps

- They reach the runtime view model as `HintSheetView.SELECTABLE.grandfatheredSteps`, taken
  verbatim from `selectableHintSavedState`.
- They render in a separate, provisional 「以前のヒント」 block. It is a legacy presentation, not a
  row, not a chip and not a radio. H3-4 TODO: the final presentation.
- They are never sold, priced, counted as a category, or added to Rule W:
  - matrix 19: preserved, including after a purchase and a reload;
  - matrix 20: not priced, not a fact;
  - App test: legacy H3 save → 「以前のヒント」 + 「材料は全部で4種類。チーズを使うみたい」 + 40 Pitz.

## 13. Privacy

The view carries only:

- H3-1's privacy-safe `SelectableHintPresentation`;
- the H0 line;
- the player's own grandfathered lines;
- the transient outcome.

It never carries the target id, the reserved ingredient, a remaining count or per-category
availability. The following checks cover it:

- **Matrix 33:** no 「じゃない / 使わない」 in any fresh selectable view.
- **Matrix 34:** identical presentation/view keys, rows, preferences, price and affordability for
  all 24 non-Margherita targets. No `remaining` / `reserved` / `purchasable` / recipe id in the view
  JSON.
- **Matrix 35:** Rule W. The reserved ingredient is never revealed for any recipe, however much is
  bought. Mutation M6 is killed.
- **HintSheet DOM sweep (24 recipes):**
  - no recipe name or id in text or attributes;
  - no ASCII word except `Pitz`;
  - the same DOM shape for every target.
- **E2E:** `expectNoUndiscoveredIdentity` at every sheet state (Free Cooking, Dex CTA, Result CTA).

## 14. Hostile / stale actions

Each case below returns `state` unchanged (identity), not merely an equal state:

- **Hostile preferences:** `"SAUCE"`, `"__proto__"`, `"constructor"`, `""`, `null`, `undefined`, a
  number, an array, `"dough"`.
- **Hostile paid counts:** `NaN`, `Infinity`, `0.5`, `"0"`, `null`.
- **Stale requests:** stale paid counts (1, 2, −1, 99, and a count from before the last purchase),
  and a request for a target the session has left.
- **Wrong context:** sheet closed, outside PREPARE, guided round, Lunch Rush, discovered target, no
  session, out-of-stock target, a Dinner run (matrix 9, 22, 38).

A hostile save ledger (a `__proto__` key, junk values) neither crashes nor counts (matrix 22b).
Pitz never goes negative for any balance in 0–74 (matrix 37).

## 15. Mutation tests

Each mutant was applied to production code, the hint test files were run against it, and the file
was restored (`git diff` was verified clean after each run).

| # | Mutant | Result | Detected by (e.g.) |
|---|---|---|---|
| M1 | charge twice (debit the price again) | **KILLED** (32 failed) | App purchase/save test, matrix 2+3 |
| M2 | advance the legacy field on a purchase | **KILLED** (23 failed) | matrix 2+3, 4 |
| M3 | sell the same fact twice (ignore the stored ledger) | **KILLED** (18 failed) | matrix 4, 5 |
| M4 | count unknown stored ids in the price | **KILLED** (2 failed) | matrix 21, 22b |
| M5 | count grandfatheredSteps as paid rungs | **KILLED** (3 failed) | matrix 17, 20 |
| M6 | reveal the reserved fact (Rule W off) | **KILLED** (10 failed) | matrix 12+13, 14, 35 |
| M7 | GUIDANCE_ONLY costs 5 | **KILLED** (10 failed) | state walk / capricciosa cap |
| M8 | Dex 0 any recipe free | **KILLED** (2 failed) | matrix 24, hintPurchase Dex-0 test |
| M9 | skip the persistence write (App) | **KILLED** (4 failed) | App purchase/save, App reload |
| M10 | a stale request charges (ignore `expectedPaidCount`) | **KILLED** (4 failed) | matrix 8, 9 |
| M11 | the CTA latch removed (a UI double-click buys twice) | **KILLED** | App double-click test |

### Test matrix → tests

- **Matrix 1–24, 29–38, 40:** `src/state/gameReducer.selectableHint.test.ts` (38 tests; the case
  numbers are in the test names).
- **25 Dex CTA:** `App.dexHint.test.tsx` and e2e `discovery-dex-hint.spec.ts`.
- **26 Result CTA:** `App.cookingTimingBackground.test.tsx` HE-4 and e2e
  `discovery-near-miss-result.spec.ts`.
- **27 Free Cooking Hint:** `App.hintSheet.test.tsx` (4 tests: purchase + save diff, reload,
  insufficient, legacy) and e2e `discovery-hint-sheet.spec.ts`.
- **28 timer:** §10.
- **30 / 31 old / new save load:** matrix 30/31 plus the App reload and legacy tests.
- **39 App navigation:** a purchase, a rejection or GUIDANCE_ONLY never changes the phase or closes
  the sheet (matrix 2+3; App insufficient test).

## 16. Regression

The following were migrated deliberately, not skipped:

- **Paid Economy 1.0 tests** — the reducer purchase/sheet tests, `discoveryHint.test.ts`, the
  25-ladder walk, and the App Free Cooking / Dex / Result tests. They now assert the same intents
  through the Selectable flow: one-step purchase, double tap, insufficient, reload, REFILL,
  stickiness, Dex pin, persistence.
- **The walk** still plays the whole ladder from a new save to Dex 25 through the real reducer,
  with Hint 3.0 purchases.
- **`discoveryHintEconomySim.ts`'s `"production"` mode** is renamed `"authority"`. From Dex 1 it
  pays levels through the Economy 1.0 pure authority (`purchaseDiscoveryHint`), because the reducer
  no longer sells them. Its parity with the simulated walk (HE-5, P0–P5 × ★4/★3/★1) is still
  asserted, and the Hint 3.0 runtime walk is `discoveryHint.walk.test.ts`. It is an analysis harness
  only.

Unchanged and green: Hint 2.0 onboarding, Discovery, Free Cooking, Shop, Inventory, Lunch Rush and
Dinner (merged-main DM-2 behavior; no Dinner file touched; nothing from #243 used).

- Full Vitest: **183 files, 3921 passed, 1 skipped**, 0 failed. This includes the latch tests added
  after the Codex review.
- `tsc -b`: 0 errors. `oxlint`: 0 warnings. `npm run build`: OK.

## 17. E2E (local Chromium)

- **Full suite**, projects `iphone-390x844` + `iphone-360x800` + `layout-chromium` (Layout
  Contract): **163 passed, 19 skipped** (width guards), 0 failed.
- **Hint specs**, re-run after the last UI change: **13 passed, 11 skipped**:
  - `discovery-hint-sheet`: the geometry contract on all 7 profiles for H0 / one fact / longest
    (legacy + all facts + guidance) / purchase CTA / insufficient / reload / empty states / Dex-0;
  - `discovery-dex-hint`;
  - `discovery-near-miss-result`;
  - `discovery-hint-facts-save` (storage E2E).

### Screenshots and minimal verification video

These are not the H3-4 Human Verification.

- **Screenshots** (390×844, committed): `docs/reports/screenshots/discovery-hint-3-h3-3-runtime-wiring/`.
  - `before-*`: `main` 4e78f3d, the Economy 1.0 sheet.
  - `after-*`: H3-3.
  - Each set has 7 states: open, first purchase, all bought, after reload, legacy H3 + insufficient,
    pizza-bianca open, pizza-bianca after the request.

The CLAUDE.md / policy DoD for UI changes asks for a video. This short run-through only checks the
H3-3 minimal wiring; the final UI and its Human Verification are H3-4's.

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| `TETO_H3-3_runtime-wiring_390x844.webm` | 390×844 | 18.1 s | 739 KB | PASS |

- **Download:** delivered directly in the session. It is not committed (`artifacts/` is gitignored).
- **Codec:** VP8 (WebM).
- **Validation:** ffprobe is unavailable in this sandbox, so the file was checked by loading it in
  Chromium. Metadata: 390×844, 18.08 s. A seek to the end is playable, and the size is > 0.

**Video Verification: PASS**

What to look at in the video:

1. Dex 11 Free Cooking → 「ヒント」: H0 line, three rows (only the free key オレガノ revealed), three
   preferences, 「ヒントを1つ解除 5 Pitz」, 所持 120 Pitz.
2. Choose トッピング → buy: a topping chip appears, the price becomes 10, the balance 115.
3. Three more purchases → a fourth request shows the guidance line. The balance stays 45.
4. Reload → re-open: the same chips, no charge.
5. A legacy H3 save with 25 Pitz: the sauce chip from the old H2, the 「以前のヒント」 block, a
   disabled 「ヒント 40 Pitz」 with the calm note.
6. pizza-bianca: looks like any sheet (5 Pitz) → request → guidance line, the balance unchanged.

## 18. CI / WebKit

PR #247. CI was green on head `bc7194a`, the code head this report describes (the Codex-review latch fix).
The GitHub Actions run IDs are `36299705940` (E2E) and `36299705948` (build):

| Check | Result |
|---|---|
| `classify` | success |
| `build` (lint + Vitest + build) | success |
| `layout-chromium` | success |
| `Layout Contract Gate` | success |
| `webkit webkit-390x844 shard 1/2` | success |
| `webkit webkit-390x844 shard 2/2` | success |
| `webkit webkit-360x800 shard 1/2` | success |
| `webkit webkit-360x800 shard 2/2` | success |
| `WebKit Gate` | success |

The first head, `d4d558d`, also finished CI with no failed suite.

Review: Codex found one P1, a UI double-click that bought twice. It was fixed in `bc7194a` (§10), and
the thread was replied to and resolved. No other review threads are open.

## 19. Changed files

| File | Change |
|---|---|
| `src/state/gameReducer.ts` | `discoveryHintFacts` / `hintOutcome` on GameState, ProgressionCarry + 7 carry copies, `createInitialGameState` param, `PURCHASE_SELECTABLE_HINT`, onboarding-only `PURCHASE_DISCOVERY_HINT`, outcome reset, Dinner block |
| `src/state/discoveryHint.ts` | SELECTABLE view, `purchaseSelectableHintFact`, `isOnboardingHintSession`, fact-aware stickiness |
| `src/App.tsx` | hydrate / persist `discoveryHintFacts`, dispatch handler (6 lines) |
| `src/screens/GameScreen.tsx` | one prop passed to `HintSheet` |
| `src/components/HintSheet.tsx` | minimal SELECTABLE body (rows, chips, 「以前のヒント」, radios, CTA, wallet, guidance) |
| `src/App.css` | one `.hint-sheet__*` block for the new elements |
| `src/state/gameReducer.selectableHint.test.ts` | **new**: the matrix |
| `src/components/HintSheet.test.tsx`, `src/App.hintSheet.test.tsx` | new Selectable UI / App tests |
| `src/state/{discoveryHint,discoveryHint.walk,gameReducer.hintPurchase,gameReducer.hintSheet,resultNearMiss}.test.ts`, `src/App.{dexHint,cookingTimingBackground}.test.tsx` | migrated to the Selectable flow |
| `src/logic/testSupport/discoveryHintEconomySim.ts`, `src/logic/discoveryHintEconomy.sim.test.ts` | `"authority"` transaction (Economy 1.0 pure authority) |
| `e2e/discovery-{hint-sheet,dex-hint,near-miss-result}.spec.ts` | migrated to the Selectable sheet |
| `docs/reports/screenshots/discovery-hint-3-h3-3-runtime-wiring/*` | before/after |
| this report | |

`selectableHint.ts`, `hintFactMigration.ts`, `persistence.ts`, `hintPurchase.ts`, `hintSteps.ts`,
`resultNearMiss.ts`, every Dinner file, and `HomeScreen.tsx` are **not** changed.

## 20. Scope

- **Done:** the H3-3 runtime wiring. That covers the reducer authority, the Pitz debit, the fact
  purchase, the persistence and legacy wiring, the category preference input, the runtime view
  model, and the minimal UI.
- **Not done (by instruction):**
  - H3-4: final UI polish, copy, Human Verification;
  - a batch purchase UI;
  - a near-miss redesign;
  - any Dinner change.
- **No merge, no auto-merge.** Issue #238 stays OPEN. No H3-3 sub-issue was created: the duplicate
  gate found none and the parent issue tracks the phases.

## 21. H3-4 TODO

1. Final sheet design:
   - chip styling;
   - the preference control (radios are functional placeholders);
   - the 「？」 placeholder;
   - spacing in the 45dvh body. With the longest legacy content, the 「以前のヒント」 lines and the
     guidance scroll within the body, and the guidance is scrolled into view.
2. Final copy:
   - CTA 「ヒントを1つ解除」;
   - the legend 「どれのヒントがほしい？」;
   - the guidance line (OD-H3-17 said UI copy comes later);
   - the paid-out price display. H3-1's `nextPrice` is 0 once the ladder cap is paid, and the CTA
     currently reads 「0 Pitz」 before the GUIDANCE_ONLY request.
3. The 「以前のヒント」 presentation of `grandfatheredSteps` (H3-2 §25 Owner decision).
4. Human Verification video + screenshots per the policy for the final UI.
5. Whether the Dex-0 Margherita onboarding should also move to the Selectable presentation (free,
   unpersisted). It keeps the Hint 2.0 flow in H3-3.

## 22. Residual risks

- **Paid-out 「0 Pitz」 CTA** (§21-2). No Pitz moves and the next press is GUIDANCE_ONLY, but the
  wording can confuse. The price itself is H3-1's approved authority.
- **Economy 1.0 is no longer sold.** A player mid-way through a legacy ladder continues on the
  Selectable ladder at the same rung (OD-H3-9 no-loss). The old sheet's step list is replaced by
  chips + 「以前のヒント」 for the lines that named no ingredient.
- **The Economy sim harness still models Economy 1.0 knowledge.** A Hint 3.0 economy walk across
  profiles was not added. The Hint 3.0 runtime walk covers one profile (ample Pitz). The Hint 3.0
  price parity rests on H3-1's ESC_PARITY cap.
- **WebKit only runs in CI.** Local Playwright WebKit is not available in this sandbox. See §18.
