# Original Pizza Recovery P3-3a — Trial Notebook data / state wiring (Result)

- **Verdict: A. P3-3a DATA WIRING COMPLETE**
- **Base:** `origin/main` = `2e9d89d46ec5f134588b5112f00dc7aa319733cd` (P3-1 merge, PR #315); fetched fresh, no drift since the P3-3 Fresh Audit (nothing in `d727030..2e9d89d` touched the reducer, `App.tsx`, `GameScreen`, `ResultPanel` or `freeCook`).
- **Branch:** `claude/p3-3a-trial-notebook-data-wiring` (only `main` + this slice; **no P3-2**, no P3-3b/c, no P3-4). **No PR created.**
- **Authority:** P3-3 Fresh Audit (`claude/original-pizza-discovery-p3-audit` @ `7665eb2`), Owner decisions OD-P3-16..20.
- **Human Verification Policy:** not triggered. There is **no UI / UX / gameplay change**: no component, screen, CSS, copy or save format changed (evidence in §6).

## 1. What was implemented

| Piece | Where | Behaviour |
|---|---|---|
| Record adapter | `src/state/trialRecord.ts` (new, pure) | `recordTrialAttempt(input, outcome)`: fingerprint = P1 `attemptFingerprintOfPizza(pizza)`; feedback = `{ kind, textJa }` of the P2 line (`resultNearMiss`) or `null`; duplicate / `#n` / REVIVE / 50 + 2 000 = P3-1 `recordAttempt` only. Eligible outcomes: `ORIGINAL`, `AMBIGUOUS`; everything else returns the same references and `null`. A REJECTED model result stores nothing and reports nothing (fail closed). |
| State | `GameState.trialNotebook`, `GameState.lastTrialAttempt` (`gameReducer.ts`) | `trialNotebook` rides `ProgressionCarry` / `carryOf` (every fresh-round path keeps it: FREE, guided, Lunch Rush, Dinner); `createInitialGameState` builds an empty one (no parameter: nothing can hydrate it from a save). `lastTrialAttempt` is `{ kind: "NEW"; number } \| { kind: "DUPLICATE"; number } \| null` (no `retryCount`, OD-P3-19), set only by the commit and reset to `null` by `buildOrderState` like `lastDiscovery`. |
| Commit point | `REGISTER_TO_DEX`, free-cook ORIGINAL branch, after the `RESULT` phase guard, the PASS check and `resolution.kind === "ORIGINAL"` | The single call site of `recordTrialAttempt`. The `RESULT → DISCOVERED` transition is the exactly-once guard (OD-P3-17). No render, no effect, no App `useState`. |
| Save | `App.tsx` / `persistence.ts` **unchanged** | Session-only. The save writer's explicit field list does not include the notebook (a gate pins it). |

The RESULT render is **unchanged**: nothing reads `trialNotebook` or `lastTrialAttempt` in this slice (the P3-3b notice will read `lastTrialAttempt`, never re-look-up the notebook).

## 2. Authority checks

- **OD-P3-16:** INCOMPLETE_MATCH, NEW_DISCOVERY, known pizza, FAILED, guided, Lunch Rush, Dinner record nothing (reducer tests, one per mode, plus adapter-level checks that the notebook reference is unchanged); AMBIGUOUS has the same eligibility and dedupes against an ORIGINAL of the same combination (it is unreachable in production — 0 catalogue collisions — so it is tested at the adapter).
- **OD-P3-17:** `GameState` + `ProgressionCarry`; one commit point; exactly-once proven at reducer level (repeated `REGISTER_TO_DEX` returns the same state reference and the same notebook reference) and under React's own `useReducer` in `<StrictMode>` (which double-invokes reducers; a sanity test proves the double invocation happens).
- **OD-P3-18:** the stored feedback equals `resultNearMiss(state)` `{ kind, textJa }` exactly (two keys); `null` when P2 shows nothing; P2 is unchanged (`GameScreen` still calls `resultNearMiss(state)`; a gate pins it).
- **OD-P3-19 (state side):** `lastTrialAttempt` carries `kind` + stable `#n` only; `retryCount` lives only in the notebook (for the later overlay).
- **OD-P3-20:** only slice P3-3a; no notice, CTA, overlay, Dex entry or CSS.

## 3. Tests added (64) and gates changed

| File | Tests | Covers |
|---|---|---|
| `src/state/gameReducer.trialNotebook.test.ts` | 34 | requested cases 1–27 through real reducer actions (NEW, DUPLICATE, `retryCount` +1 per retry, stable `#n`, repeated REGISTER, stray actions, purity, P2 feedback stored exactly, eligibility per outcome and per mode, lifecycle for next FREE / PLAY_AGAIN / RETRY / guided / Lunch Rush / Dinner round trips, empty initial state, save contains no notebook, REVIVE through the wiring, identity eviction is a new attempt, record-result lifecycle, privacy scan over real flows with recipe ids / names / description prefixes) |
| `src/state/gameReducer.trialNotebook.react.test.tsx` | 7 | real `gameReducer` under `useReducer`, StrictMode **and** plain: exactly-once, re-renders and repeated REGISTER change nothing, RESULT → HOME (PLAY_AGAIN) → FREE adds no retry and the next identical round is one DUPLICATE (+1), two combinations are #2 / #1; harness sanity (StrictMode really double-invokes) |
| `src/state/trialRecord.test.ts` | 5 | fail closed (malformed / unsupported-version / non-string fingerprint via a mocked P1 → same notebook, `null`), P1 is given the exact pizza, eligibility predicate |
| `src/state/trialRecord.gate.test.ts` | 18 | adapter imports and authority (no re-implementation, no storage / clock / randomness / hint / P3-2), result type has no `retryCount` / hidden field, eligibility literal, **one** `recordTrialAttempt` call inside the free-cook ORIGINAL branch after the guards, notebook written in exactly one place, carried by `ProgressionCarry` / `carryOf`, empty initial state, save writer has no state spread, persistence / App / every storage user mention none, no production file mentions P3-2, no UI mentions the notebook, ResultPanel / GameScreen P2 path untouched |

Gate allowlists changed explicitly (as P1 / P3-1 did): `attemptFingerprint.gate.test.ts` (importers: `trialNotebook.ts` + `state/trialRecord.ts`; referencing set pinned), `trialNotebook.gate.test.ts` (mentioners and importers = exactly `trialRecord.ts` + `gameReducer.ts`; no UI / App / persistence / Dex / mission / P3-2 file may mention the notebook or the record result), `resultFeedback.gate.test.ts` (`resultNearMiss(` callers: `GameScreen` + `trialRecord`; fingerprint / notebook mentions allowlisted exactly).

## 4. Mutation (`node tools/trial_notebook_wiring_mutation.mjs`, data: `docs/reports/data/…P3-3a_TRIAL-NOTEBOOK-WIRING_Mutation.json`)

30 mutants: **29 killed, 1 equivalent (documented), 0 survived, 0 invalid.** Covers the requested targets: record call deleted (W01), duplicate reported as new (A05), `#n` changed (A06), `retryCount` leak (A13), internal P2 data stored (A07), REGISTER phase guard removed (W03), double record (W02), INCOMPLETE_MATCH / NEW_DISCOVERY / AMBIGUOUS eligibility (A01–A03), eligibility guard removed (A04), guided / Lunch Rush / Dinner recording (W08, W09), MATCHED recorded (W10), notebook not carried (W04), stale record result (W05, W06), wrong initial limits (W07), save persists the notebook (W11, W12), render path reads it (W13, W14), hidden data in feedback (A07–A09), same identity for every pizza (A10), fail-closed paths (A11, A12), P3-2 dependency (A14), clock / randomness (A15), feedback not the shown line (A16).

The equivalent mutant **W09** removes both Dinner guards of `REGISTER_TO_DEX`: a Dinner round has `freeCook = false`, so `REGISTER_TO_DEX` never reaches the free-cook ORIGINAL branch that records (it returns at `if (!state.score)`); the guards protect Dex / Pitz, not the notebook.

## 5. Verification (final tree)

- Focused: the four new files above (64 tests) + P3-1 model 68 + its gate + P1 gates + P2 gate: pass.
- Full Vitest: **272 files, 5 285 passed, 1 skipped, 0 failed** (base main: 268 files, 5 219 passed).
- `tsc -b` clean · `oxlint`: only the 2 pre-existing warnings · `npm run build` passes.
- Real Chromium layout contract (`npx playwright test --project=layout-chromium`): **12 / 12 passed** (RESULT / ORIGINAL included; CI runs the same plus WebKit).

## 6. Production behaviour is unchanged

- Production files changed: `src/state/gameReducer.ts` (+21 lines: two state fields, one carry field, reset, initial value, the commit) and the new `src/state/trialRecord.ts`. **No component, screen, CSS, data or persistence file changed** (`git diff origin/main -- src` lists only these two plus tests and test support).
- The player-visible RESULT, P2 line, Dex, Builder, HOME, Shop and save are byte-identical by construction; the layout contract and the 5 285-test suite (which includes every App-level flow) pass.

## 7. Not done (by scope)

RESULT duplicate notice (P3-3b), Notebook CTA and overlay (P3-3c), Dex header entry and Discovery Memo (P3-4 / P3-2), any persistence, `localStorage` or CSS. App-level (DOM) duplicate-notice tests belong to P3-3b, where there is something to render; in P3-3a the notebook is unobservable in the DOM by design, so the exactly-once evidence is reducer-level plus React `useReducer` (StrictMode and plain).

## 8. Next

P3-3b (RESULT duplicate notice: P2 line first, then 「📓 …（試作#n）」 from `state.lastTrialAttempt`, `DUPLICATE` only, Human Verification required). Requires an Owner go.
