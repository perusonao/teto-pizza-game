# Original Pizza Recovery P3-3 — Trial Notebook + ORIGINAL RESULT Wiring Fresh Audit (design only)

- **Audited `origin/main` SHA:** `d7270303b0bb5837119ed00ae75f621ee10e57d0` (fresh fetch; unchanged since P1 merged, so there is no drift to audit).
- **Branch:** `claude/original-pizza-discovery-p3-audit` (docs + read-only tooling / probes). **No `src/` change, no PR, no implementation.**
- **Scope:** how to connect the P3-1 Trial Notebook model to the FREE ORIGINAL RESULT: what is recorded, when (exactly once), what the RESULT shows, session lifecycle, privacy, geometry, accessibility, slices. P3-4 (Dex) and every wiring are not started.
- **Companion files**
  - `tools/original-pizza-p3/lifecycle.probe.test.ts` + `vitest.lifecycle-probe.config.ts` — drives the real reducer on current main and reads the source; evidence in `docs/reports/data/TETO_ORIGINAL-PIZZA-RECOVERY_P3-3_LifecycleProbe.json`. Run: `npx vitest run -c tools/original-pizza-p3/vitest.lifecycle-probe.config.ts` (9 / 9 pass).
  - `tools/original-pizza-p3/result-geometry.measure.spec.ts` + `playwright.result-geometry.config.ts` — real Chromium, plays Free Cooking to three ORIGINAL results, measures 7 profiles and injects stand-in DOM for the notice and the entry CTA; output `docs/reports/data/TETO_ORIGINAL-PIZZA-RECOVERY_P3-3_ResultGeometry.json`. Manual, not CI.
- **Verification Policy:** not triggered (audit only). P3-3b / P3-3c change visible RESULT UI and will trigger it.
- **Verdict:** **B. OWNER DECISION REQUIRED** (§18). One decision blocks the eligibility rule (OD-P3-16); the rest have recommended defaults.

## 0. Summary

1. **There is a clean exactly-once commit point already: the `REGISTER_TO_DEX` transition `RESULT → DISCOVERED`.** It is reducer-only, guarded by `state.phase !== "RESULT"`, pure (so React StrictMode's double reducer call is harmless), and its free-cook ORIGINAL branch is the only place an "ORIGINAL attempt" is decided. Recording inside that branch (never in a render or an effect) gives exactly-once by construction. The probe confirms: a repeated `REGISTER_TO_DEX` or `CONFIRM_BAKE` returns the *same state reference*.
2. **The notebook belongs in `GameState`, carried by `ProgressionCarry`** (the same way `hintSession` and `discoveredTechniqueIds` are): all 16 fresh-round call sites already thread `carryOf(state)`, so HOME, FREE restart, guided, Lunch Rush and Dinner trips keep it, and a reload (`createInitialGameState`) empties it. The save writer lists fields explicitly (`persistProgress({...})`, no spread), so a new field is **not saved unless someone adds it there**: no save schema or persistence change is needed or allowed.
3. **What the RESULT shows must come from state written at the commit, not from a render-time lookup.** After the record, a lookup can no longer tell "new" from "duplicate". So the commit also stores a small display-only outcome (`NEW` / `DUPLICATE #n`), and `ResultPanel` reads that. Re-renders, StrictMode and the existing live P2 line cannot change it.
4. **The P2 line the player saw on first paint equals the line computed at the commit**, because `resultNearMiss` is a pure function of state and, on an ORIGINAL result, nothing it reads can change while the screen is up (the GAME header has HOME only; Shop / Dex are reachable from HOME only). So the record can store the commit-time line without freezing or changing P2's display. A test must pin this, and a gate must fail if a Shop / Dex entry ever appears on the RESULT.
5. **Eligibility is narrower than "every result".** Record: ordinary ORIGINAL (and AMBIGUOUS, screen-identical). Do not record: FAILED, NEW_DISCOVERY, ALREADY_DISCOVERED, guided, Lunch Rush, Dinner (all structurally outside the ORIGINAL branch). **INCOMPLETE_MATCH needs an Owner decision (OD-P3-16):** recording it without an outcome field (OD-P3-14) would file the most nearly correct combination as an ordinary failed try, and a "前にも同じ…" notice on it would sit next to a lead that says the fix is the sauce amount or the bake. Recommendation: do not record it in Phase 1.
6. **Geometry (real Chromium, 7 profiles):** the action bar is `position: fixed`, so nothing is ever hidden; content that does not fit scrolls above it. A duplicate notice costs **+45 px** (only on duplicates); an entry CTA costs **+0 to +50 px** (inline when there is no P2 text, wrapped otherwise). Notice alone keeps clearance ≥ 16 px at N390 / N360 / S390 / S360 except FAR / INCOMPLETE at S360 (−9 / −27 px: scrolls). Notice + CTA together reach −10 px at S390 and −35 to −59 px at S360. Three slices (data → notice → overlay + entry) keep each HV small.
7. **Blockers:** P3-1 is **not on `main`** (its own Review / Merge Gate + PR come first; P3-3 imports it). P3-2 is independent and stays unwired.

## 1. Audited main SHA

`d7270303b0bb5837119ed00ae75f621ee10e57d0` = P1 merge (PR #313). `git log d727030..origin/main` is empty. Nothing to reconcile.

## 2. P3-1 / P3-2 integration status (what P3-3 presupposes)

| Branch | Head | State | Needed by P3-3? |
|---|---|---|---|
| P1 Attempt Fingerprint | on `main` (`d727030`) | **merged**, post-merge Deploy / WebKit green | **yes** — the only identity authority |
| `claude/p3-1-trial-notebook-model` | `e1d66d1` | **not merged, no PR**; A. PURE MODEL COMPLETE (REVIVE, 50 / 2 000) | **yes — must be merged first** (its own Review / Merge Gate, single-scope PR) |
| `claude/p3-2-discovery-memo-model` | `9a50762` | **not merged, no PR**; A. PURE DISPLAY MODEL COMPLETE, unwired | **no**. P3-3 must not import it and must not produce any Dex fact; its own gate (`discoveryMemo.gate.test.ts`) already forbids any production importer |
| `claude/original-pizza-discovery-p3-audit` | `6354549` | docs / tooling only | authority text (Owner Authority OD-P3-1..15, D-1, D-2) |

`git merge-tree` shows P3-1 and P3-2 merge cleanly with each other. P3-3's authority set: P1 (fingerprint), P3-1 (model: `recordAttempt`, `lookupAttempt`, limits 50 / 2 000, REVIVE, fail-closed inputs), P2 (`resultNearMiss` + `originalResultCopy`, unchanged), and the Owner decisions. **Gates P3-3 will have to touch (with explicit allowlists, as P1 / P3-1 did):** `attemptFingerprint.gate.test.ts` (add the adapter as an importer), `trialNotebook.gate.test.ts` (importers), `resultFeedback.gate.test.ts` (P2 caller and the two name checks).

## 3. Current RESULT lifecycle (main, read from the code and the probe)

```
START_FREE_COOK / RETRY_SAME_RECIPE / SELECT_RECIPE ...  -> fresh round (buildOrderState(..., carryOf(state)))
  PREPARE -> START_BAKE -> BAKE
  App.handleConfirmBake: dispatch(CONFIRM_BAKE)        // RESULT: freeCook resolves (resolveFreeCookPizza), inventory consumed
                         dispatch(REGISTER_TO_DEX)     // same tick, batched; RESULT -> DISCOVERED
  GameScreen renders ResultPanel (isFreeResultScreen = RESULT | DISCOVERED), nearMiss = resultNearMiss(state) on every render
  HOME (handleGoHome) does not touch a DISCOVERED state; the next round comes from a new START_FREE_COOK / SELECT_RECIPE
```

- **CONFIRM_BAKE** (phase guard `BAKE`): FAILED stays at RESULT with `score: null`; an unmatched pizza gets `score: null`, `completion: PASS`; a matched one is scored as its recipe.
- **REGISTER_TO_DEX** (phase guard `RESULT`; Dinner returns early): `state.freeCook && !state.score` → FAILED completion returns unchanged; `resolveFreeCookPizza(...)`; only `resolution.kind === "ORIGINAL"` continues, to `DISCOVERED` with `lastDiscovery = resolution.outcome` (kinds `ORIGINAL | AMBIGUOUS | INCOMPLETE_MATCH`), plus technique bookkeeping. Everything matched (`NEW_DISCOVERY` / `ALREADY_DISCOVERED`) takes the scored path below it.
- **POST_BAKE recipes** (CUT): `REGISTER_TO_DEX` fires again from `handleConfirmMakingStep`, and is a no-op until the round really reaches RESULT. The free-cook sentinel has the default profile (no POST_BAKE), so it never matters for ORIGINAL.
- **Lunch Rush** registers through `MISSION_NEXT_ORDER`; **Dinner** never registers (`isDinnerRound` guard); **guided** rounds have `freeCook: false`.
- `ResultPanel`'s ORIGINAL card is the `!score` branch: lead (`originalResultKind`), used ingredients, bake badge, the P2 row (`nearMiss` line with `aria-live="polite"` + 「💡 ヒントを見る」), a note, the two action buttons in a fixed bottom bar.

## 4. The exactly-once recording point

**Commit point: inside `REGISTER_TO_DEX`, in the free-cook ORIGINAL branch, after `resolution.kind === "ORIGINAL"` and the PASS check** (i.e. exactly when the reducer decides "this is an ORIGINAL attempt that becomes the result the player sees").

| Hazard | Why it cannot double-record |
|---|---|
| RESULT re-render | recording is reducer-only; `ResultPanel` only reads |
| React StrictMode (dev double reducer call) | the transition is pure: the same input state yields the same output state; the probe shows `JSON`-identical results. No counters, clocks or randomness are added |
| repeated / stray `REGISTER_TO_DEX`, `CONFIRM_BAKE` | phase guards; the probe shows the *same state reference* comes back |
| HOME and back | `handleGoHome` dispatches nothing for DISCOVERED; GAME is re-entered only through a new round action |
| RESULT revisited after Dex / Shop | neither is reachable from the GAME screen (header = HOME only); opening them changes no reducer state relevant to the result |
| round retry / restart | a new round calls `buildOrderState`, which resets the display-only outcome; the notebook is carried |
| POST_BAKE double dispatch | the `RESULT` guard makes the first a no-op |

Adapter (proposed, not implemented): a thin module `src/state/trialRecord.ts` owns the only imports of `attemptFingerprint`, `trialNotebook` and `resultNearMiss` for this purpose and exposes one pure function called from that branch; the reducer imports only the adapter. It computes: `fingerprint = attemptFingerprintOfPizza(state.pizza)` (P1, through the matcher's own `signatureOfPizza`), `feedback = pick(resultNearMiss({ ...state, lastDiscovery: resolution.outcome }))` as `{ kind, textJa }` or `null`, then `recordAttempt`. New `GameState` fields: `trialNotebook` (carried) and `lastTrialAttempt` (display-only: `{ kind: "NEW" } | { kind: "DUPLICATE"; number: n }` or `null`, reset by `buildOrderState` like `lastDiscovery`).

## 5. Eligibility matrix

| Result kind | Reaches the ORIGINAL branch? (probe) | P2 line possible | Record? | Notice on a repeat? | Note |
|---|---|---|---|---|---|
| **ordinary ORIGINAL** | yes (`lastDiscovery: ORIGINAL`) | ADD_ONE / REMOVE_ONE / SAUCE_ONLY / CLOSE / FAR / key-unused, or none | **yes** | **yes** | the core case |
| **AMBIGUOUS** | yes by code; **unreachable in production** (0 identity collisions; probe) | none (outcome ≠ ORIGINAL) | **yes** (recommended) | yes | the screen is byte-identical to an ordinary original (OD-P2-1); the record cannot and need not differ |
| **INCOMPLETE_MATCH** | yes (`lastDiscovery: INCOMPLETE_MATCH`) | none | **Owner decision OD-P3-16; recommended: no** | n/a | see §0.5 |
| **NEW_DISCOVERY** | no (scored path) | none | no | no | the Dex holds it |
| **ALREADY_DISCOVERED (known pizza)** | no (scored path) | only a d = 1 line | no | no | not an exploration attempt; would flood the 50-row view |
| **FAILED** | no (REGISTER returns early, phase stays RESULT) | none | no | no | a raw / burnt bake says nothing about the combination |
| **guided** | no (`freeCook: false`) | none | no | no | structural |
| **Lunch Rush** | no (`MISSION_NEXT_ORDER`, never discovers) | none | no | no | structural |
| **Dinner** | no (`isDinnerRound` returns early) | none | no | no | structural |

The P3-1 model has no outcome field (OD-P3-14), so whatever is eligible must be **indistinguishable in the notebook**; that is why INCOMPLETE_MATCH is the one open case.

## 6. Feedback authority

- The notebook stores `{ kind, textJa }` of the line the player was shown, or `null`: never a `NearMiss` object (it carries `distance`, `sauceStep`, `keyUnused`), never the target, never a candidate. The adapter builds the pair explicitly from `ResultNearMissLine`; P3-1's input sanitiser (exact two keys, kind `^[A-Z][A-Z0-9_]*$`, text ≤ 200) rejects anything else and stores nothing, so a regression that passed the internal object would surface as a missing record, not a leak.
- **Commit-time line = first-paint line** (§0.4): same pure function, same state. **Not shown ⇒ not stored**: a FAILED / non-ORIGINAL result produces no line and is not recorded at all.
- No freezing of the display line is proposed; P2's behaviour is unchanged (OD-P3-18 asks the Owner to confirm this over freezing).
- P2's own copy (`NEAR_MISS_COPY`, the generic FAR line) is reused as data only; the notebook adds no copy of its own for lines.

## 7. Fingerprint authority

P1 is the only identity. The adapter calls `attemptFingerprintOfPizza(state.pizza)`, which goes through `signatureOfPizza(pizza)`, the same function the matcher resolution in `REGISTER_TO_DEX` uses, so matcher / fingerprint parity is structural (P1's 3 000-pair oracle test holds it). Nothing re-implements it. The P3-1 model accepts only canonical `fp1:` strings and rejects another version as `UNSUPPORTED_VERSION` (never coerced), so a future `fp2` needs a deliberate change in both places.

## 8. Duplicate notice semantics

| Situation | Model result | RESULT |
|---|---|---|
| first attempt | `NEW` | no notice |
| retry, row still in the 50-row display | `DUPLICATE #n` | 「📓 前にも同じ材料の組み合わせで作ったよ（試作#n）」 |
| retry, row left the display, identity kept | `DUPLICATE #n`, `revived: true` | the same notice with the same `#n` (OD-P3-13 = A) |
| retry, identity evicted (2 001st) | `NEW` with a new number | no notice (it is a first attempt again; never a false duplicate) |
| retry of a combination recorded earlier that now resolves to a known pizza | not an ORIGINAL | no notice (only the ORIGINAL card carries it) |

- **Never blocks.** A retry is always allowed; the notice is informational text.
- **`retryCount`:** not shown on the RESULT (copy stays exactly the Owner's example); the Notebook overlay (P3-3c) shows it as 「×n」 (recommended default, OD-P3-19).
- **Priority on the card:** the P2 line first (new information about *this* attempt), the notice second, then the CTAs.
- **Stability:** the notice reads `state.lastTrialAttempt`, written once at the commit; re-render, StrictMode, the P2 live recompute and Dex / Shop cannot change it.
- **Wording discipline:** 「同じ材料の組み合わせ」 only; never 「同じ結果」, 「意味がない」 or "won't work" (quantity, bake and sauce amount are not identity).

## 9. Session lifecycle

| Event | Notebook | Why |
|---|---|---|
| HOME and back | kept | no reducer change |
| FREE restart / 「もう一度じゆうに作る」 | kept | `START_FREE_COOK` / `RETRY_SAME_RECIPE` use `carryOf` |
| round end / next round | kept; `lastTrialAttempt` reset | `buildOrderState` resets display-only fields, carries `ProgressionCarry` |
| guided round trip | kept | `SELECT_RECIPE` → `startPreparingRecipe(..., carryOf)` |
| Lunch Rush round trip | kept | `nextMissionOrderState` → `buildOrderState(..., carryOf(state))` |
| Dinner round trip | kept | `dinnerFreeRound` → `buildOrderState(..., carryOf(state))` |
| browser reload / app restart / Full Game Reset (reload) | **gone** | `createInitialGameState` builds an empty notebook; the save never contains it |

All 16 fresh-round call sites thread a carry (probe); the compiler enforces the rest (`ProgressionCarry` and `carryOf` must both list the new field). The save writer is an explicit field list without a spread; P3-3 adds **no** field there and a gate pins `trialNotebook` out of `persistence.ts`, `persistProgress`'s argument and every `localStorage` / `sessionStorage` use.

## 10. Mode isolation

The record lives in the free-cook ORIGINAL branch only. Lunch Rush (`isMissionRound`), Dinner (`isDinnerRound`, rejected earlier) and guided rounds (`freeCook: false`) cannot reach it. Tests to add: a round of each kind leaves the notebook's reference unchanged; a source-scan gate over the mission / dinner surfaces (extending the existing one) finds no notebook reference; the ORIGINAL card is the only place a notice prop is rendered.

## 11. Privacy

Notebook state must never contain: recipe id / name / description, target id (`shipped:…`), distance, candidate(s), collision candidates, unpurchased Hint 5.0 facts, technique answers, hidden discovery facts. Structural reasons: the P3-1 model has no field for any of them; the adapter is the only input and passes fingerprint + `{ kind, textJa }`. **Serialisation gate (proposed):** after real reducer flows over every production recipe's ORIGINAL neighbours (far, near, key-unused, repeated, evicted), `JSON.stringify(state.trialNotebook)` and the notice props are scanned for all 25 recipe ids / names / description prefixes, `shipped:`-style target ids, `distance`, `sauceStep`, `keyUnused`, `candidate`, `collision`, `cls:` / `h5:` / `ing:` / `meta:`, technique ids; the ORIGINAL card's DOM also runs the existing `expectNoUndiscoveredIdentity` helper (e2e). Sensitive precedent checked: an INCOMPLETE_MATCH composition equals an undiscovered recipe's identity; storing it would add no recipe information (it is the player's own pizza), which is why OD-P3-16 is a product question, not a leak question.

## 12. RESULT geometry (real Chromium; `…ResultGeometry.json`)

Stand-ins use the app's own classes: the notice is a `result-near-miss__text` paragraph holding the Owner's example copy in its own `result-near-miss` row; the entry CTA is a `result-near-miss__cta` pill (36 px, the existing hint CTA) and a 44 px-min-height variant. The action bar is `position: fixed` and the panel reserves 130 px at its bottom, so **no control is ever covered**; "clearance" = distance between the last content and the bar's top (negative ⇒ that content is reached by scrolling the `game-screen`).

Baseline (ADD_ONE / FAR / INCOMPLETE): clearance N390 265 / 265 / 247 · N360 221 / 196 / 178 · S390 85 / 85 / 67 · S360 61 / 36 / 18 px. Existing hint CTA 36 px tall, near-miss row 36 px.

| Added to the ORIGINAL card | height added | N390 | N360 | S390 | S360 (ADD_ONE / FAR / INCOMPLETE) |
|---|---|---|---|---|---|
| duplicate notice (only on a duplicate) | **+45 px** | fits | fits | fits (40 / 40 / 22) | 16 / **−9** / **−27** |
| entry CTA, 36 px pill | +42 (wraps) / **+0** (no P2 text) | fits | fits | fits | 19 / −6 / 18 |
| entry CTA, 44 px pill | +50 (wraps) / **+8** (no P2 text) | fits | fits | fits (35 / 35 / 59) | 11 / −14 / 10 |
| notice + 44 px CTA | +95 / **+53** | fits | fits | **−10 / −10** / 14 | **−34 / −59 / −35** |

Safe-area profiles: E390i and E360i **already scroll at baseline** (`game-screen` 668 / 664, 693 / 640, 711 / 640 scroll extents; clearance 4 to −63 px), i.e. the ORIGINAL card is at its limit on short safe-area phones today, independent of P3. Horizontal overflow: none in any variant (`scrollWidth` ≤ viewport).

Reading: neither addition breaks the result (bar fixed, panel scrolls), but together they push the note below the fold at S390 / S360 and deepen the existing scroll on E390i / E360i. Hence the slicing in §16 and an HV on S360 / E360i for each UI slice. Entry-CTA placement options: **A** inline pill in the near-miss row (cheapest when there is no P2 text; wraps otherwise), **B** its own row under the note (about +54 px with the gap), **C** make the duplicate notice itself the entry (one row on duplicates; A on first attempts). Recommendation: **A**, measured above; revisit only if HV on S360 objects.

## 13. Accessibility

- **Notice:** a plain static `<p>` (present at mount, like the rest of the card), **not** a second live region (the P2 line already is `aria-live="polite"`; two live regions would double-announce). Reading order: lead, ingredients, bake, P2 line, notice, 「💡 ヒントを見る」, entry, then the fixed action bar.
- **Entry CTA:** a real `<button>`, accessible name 「試作ノートを開く」 (the 📓 emoji `aria-hidden`), **target ≥ 44 × 44** (the existing 36 px hint pill is a pre-existing exception; the new control should not add another). Focus order follows DOM order; visible `:focus-visible` like the other CTAs.
- **Overlay (P3-3c):** follow the HintSheet pattern already in the app: `role="dialog"` + `aria-modal="true"`, Escape from inside closes, 「閉じる」 button and backdrop tap, focus moves in on open and **returns to the opener**. Scroll ownership: the overlay body scrolls (like `hint-sheet__body`), the page behind does not; bottom padding honours `env(safe-area-inset-bottom)`. There is no router / history, so "back" is the close button (no hardware-back contract).
- **Announcement of a duplicate:** none extra (not a live update); it is content of a screen that just appeared.

## 14. Mutation / regression inventory

| Mutant | Killed today (on main + P3-1 branch)? | New test needed in P3-3 |
|---|---|---|
| record event deleted | no | reducer: ORIGINAL register adds exactly one entry |
| duplicate recorded as new | P3-1 model tests kill the model; not the wiring | reducer: same pizza twice → `DUPLICATE`, same `#n`, one identity |
| stable `#n` changed | P3-1 tests (model) | reducer: `#n` stable across retry / revive |
| `retryCount` not updated | P3-1 tests (model) | reducer: count increments through the real flow |
| feedback stored from the internal P2 result | P3-1 sanitiser rejects extra keys (the record would vanish) | adapter test: stored pair equals `resultNearMiss(state)` `{ kind, textJa }`; stored object has exactly two keys |
| RESULT re-render double-records | n/a (reducer-only) | render `ResultPanel` / `GameScreen` repeatedly: notebook reference unchanged |
| StrictMode double-records | n/a | call the reducer twice on the same state: equal output; one RTL flow under `<StrictMode>` |
| reload keeps the notebook | no | gate: `trialNotebook` absent from `persistence.ts`, `persistProgress` argument, storage calls; test: `loadSave → createInitialGameState` is empty |
| known pizza recorded | no | reducer: MATCHED (new and known) leave the notebook untouched |
| guided / Lunch Rush / Dinner recorded | partly (existing isolation scans don't know the notebook) | reducer tests per mode + extend the isolation source scan |
| hidden recipe id added | P3-1 gate (no such field) | serialisation scan over real flows (§11) |
| dependency on P3-2 Discovery Memo | `discoveryMemo.gate` (only on the P3-2 branch) | P3-3 gate: no P3-3 file mentions `discoveryMemo`; no Dex fact produced |
| FAILED / INCOMPLETE recorded (per OD-P3-16) | no | reducer tests for each |
| notice shown on a first attempt / on a non-ORIGINAL result | no | ResultPanel tests |
| notice changes on re-render | no | render twice + StrictMode: identical output |
| notebook field added to the save | no | the persistence gate above |

A focused hand-rolled mutation harness (as P1 / P3-1 / P3-2 did) should cover the adapter and the reducer branch.

## 15. Proposed implementation slices

| Slice | Content | UI / HV | Depends |
|---|---|---|---|
| **P3-1 merge** | Review / Merge Gate + PR for `claude/p3-1-trial-notebook-model` | none | — |
| **P3-3a — data wiring** | `trialRecord` adapter; `GameState.trialNotebook` (carried) and `lastTrialAttempt`; record in the ORIGINAL branch; gates and allowlists; lifecycle / mode / privacy / StrictMode tests; mutation | **no UI, no HV** | P3-1 merged, OD-P3-16 |
| **P3-3b — RESULT notice** | `ResultPanel` notice prop + one CSS rule; copy per the Owner; a11y and geometry checks | **HV** (RESULT copy / layout) | P3-3a |
| **P3-3c — Notebook overlay + RESULT entry** | overlay component (rows: `#n`, combination, feedback, ×retry), RESULT entry pill, focus / Escape | **HV** | P3-3b |
| P3-4 | Dex header entry (reuses the P3-3c overlay) and the Dex memo block | HV | P3-3c, P3-2 |

The Dex is **not** changed in P3-3: the overlay is built once in P3-3c, and P3-4 only adds its second entry point (OD-P3-11).

## 16. Required Owner Decisions

| ID | Decision | Options (recommendation in **bold**) | Blocking |
|---|---|---|---|
| **OD-P3-16** | Is INCOMPLETE_MATCH recorded? (and confirm AMBIGUOUS is recorded like an ordinary original) | **A. do not record INCOMPLETE_MATCH** (no outcome field to mark it; a duplicate notice would sit next to "check the sauce amount / bake") / B. record with `feedback: null` / C. record with its lead as the feedback (would store a non-P2 line, against OD-P3-14). AMBIGUOUS: **record** | **blocks P3-3a** |
| OD-P3-17 | Where the notebook lives | **`GameState` via `ProgressionCarry`** (exactly-once by the reducer guard) / App-level `useState` like the LC-R5-c pins (needs an effect on phase change, which can double-record under StrictMode) | confirm |
| OD-P3-18 | Feedback authority | **record the commit-time P2 line; leave P2's live display unchanged** (equal today, pinned by a test and a gate) / freeze the displayed line in state (changes P2) | confirm |
| OD-P3-19 | Notice content and order | **Owner's copy exactly, no `retryCount` on the RESULT (「×n」 only in the overlay); P2 line first, notice second** / show the count on the RESULT | confirm |
| OD-P3-20 | Slicing and entry placement | **P3-3a → P3-3b → P3-3c; entry as an inline 44 px pill (option A); Dex untouched until P3-4** / merge b + c / other placement | confirm |

## 17. Blockers

- **B1 — P3-1 is not on `main`.** P3-3 imports `trialNotebook`; it needs P3-1's own Review / Merge Gate and a single-scope PR first (P1 precedent). No other blocker: P1 is merged, P3-2 is independent.
- No design blocker: the commit point, lifecycle and isolation are all verified against current main.

## 18. Final verdict

**B. OWNER DECISION REQUIRED**

- **Blocking:** OD-P3-16 (INCOMPLETE_MATCH eligibility). Recommended answer: do not record it in Phase 1.
- **Confirmations with recommended defaults:** OD-P3-17..20.
- **Process prerequisite:** merge P3-1 first (B1).
- Nothing was implemented, no PR was created, P3-4 was not started, and the production source is unchanged.
