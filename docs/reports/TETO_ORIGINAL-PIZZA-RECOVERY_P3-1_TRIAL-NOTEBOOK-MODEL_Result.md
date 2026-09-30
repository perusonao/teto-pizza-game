# Original Pizza Recovery P3-1 — Trial Notebook Pure Model (Result Report)

- **Base `origin/main` SHA:** `d7270303b0bb5837119ed00ae75f621ee10e57d0` (fresh fetch; unchanged since P1 merged, so no drift to audit).
- **Branch:** `claude/p3-1-trial-notebook-model` (from that SHA). **No PR.**
- **Scope:** pure model + tests + gates + tooling + docs. **Pure and UNWIRED.** No UI, RESULT, Dex, Builder, reducer, save or persistence. P3-2 and later not started.
- **Authority:** Fresh Audit `docs/reports/TETO_ORIGINAL-PIZZA-RECOVERY_P3_DISCOVERY-ASSISTANCE_Fresh-Audit.md` (branch `claude/original-pizza-discovery-p3-audit`) and the Owner decisions OD-P3-1..12; identity = P1 Attempt Fingerprint (merged, `src/logic/discovery/attemptFingerprint.ts`).
- **Verification Policy:** not triggered (no UI / UX / gameplay change; the model has no production caller).
- **Verdict:** **B. OWNER DECISION REQUIRED** (§8). The model is complete and verified. The decisions gate P3-3 (wiring) only, and the model supports every answer, so none of them would change P3-1.

## 1. What was added

| File | Role |
|---|---|
| `src/logic/discovery/trialNotebook.ts` | the model (the only production file added) |
| `src/logic/discovery/trialNotebook.test.ts` | 69 unit / boundary / property tests |
| `src/logic/discovery/trialNotebook.gate.test.ts` | wiring, import and hidden-information gates |
| `tools/trial_notebook_mutation.mjs` + `docs/reports/data/…P3-1_TRIAL-NOTEBOOK_Mutation.json` | 30-mutant harness and its output |
| `tools/trial_notebook_measure.mjs` + `docs/reports/data/…P3-1_TRIAL-NOTEBOOK_Measurement.json` | real-data-shape measurement (not an authority) |
| modified tests: `attemptFingerprint.gate.test.ts`, `resultFeedback.gate.test.ts` | explicit allowlists, see §5 |

## 2. Model

API (all pure; the state is a plain JSON-shaped value, functions return a new state and never mutate the input):
`createTrialNotebook(limits?)`, `recordAttempt(nb, { fingerprint, feedback }, { evictedRetry? })` → `{ state, outcome }`, `lookupAttempt(nb, fingerprint)` (no recording), `notebookView(nb)`, `notebookSize(nb)`, `trialNotebookViolations(nb)` (invariant checker).

Two structures:

| | Identity index | Display history |
|---|---|---|
| Holds | `{ fp, number, retryCount }` | `{ fp, number, combination, feedback }` |
| Limit | 2 000 unique fingerprints | 50 unique attempts |
| Order | least recently active → most | most recently active first |
| Invariant | unique fingerprints and numbers | a subset of the identity index |

Entry content (OD-P3-4): fingerprint (and so version), stable `#n`, `retryCount`, the player's combination (`sauceBase` / `ingredientSet`, which is exactly the fingerprint's two lists), the P2 line as shown (`{ kind, textJa }` or `null`). The limits are injectable so tests can use tiny ones; the production values are the constants 50 / 2 000.

Rules implemented:

- **New fingerprint:** a NEW entry with the next number. A rejected input returns the very same state object.
- **Retry:** no new row; `retryCount + 1`; `#n` unchanged; the retry counts as the newest activity (moves the row to the top if it has one, makes the identity the last to be evicted). The row's feedback becomes the line shown for the retry.
- **51st unique:** the row with the oldest activity leaves the display; its identity stays.
- **2 001st unique:** the identity with the oldest activity is evicted, together with its row if it still has one.
- **Evicted combination tried again:** a first attempt with a fresh number. The counter only grows, so a stale `#n` is never returned and a false duplicate is impossible.
- **Fail closed:** a fingerprint that is not a canonical v1 string → `MALFORMED`; another version → `UNSUPPORTED_VERSION` (never coerced); a feedback that is not exactly `null` or `{ kind: /^[A-Z][A-Z0-9_]{0,31}$/, textJa: 1..200 chars }` (extra keys included) → `INVALID_FEEDBACK`. Nothing is stored for a rejected input.
- **Privacy by construction:** there is no field for a recipe, target, distance, collision, hint fact, technique or answer; feedback is copied as `{ kind, textJa }` and nothing else; the only import is `./attemptFingerprint`.

### Design decisions the model makes (within the brief) — please confirm

1. **A retry is "newest activity"** for the display order and for eviction (not just a counter). Reason: it keeps what the player is actively trying visible and remembered, `#n` stays stable, and activity order reveals nothing but the player's own actions. The view always carries `#n`, because activity order and creation order differ.
2. **A retry replaces the row's feedback with the line shown for the retry** (the original line is not kept). Reason: the minimal shape the Owner listed; it is also what the player last saw. If the Owner wants the first line kept too, that is one more stored field.
3. **INCOMPLETE_MATCH vs ORIGINAL is not recorded.** OD-P3-4's list has no outcome field, so the model has none. A screen cannot tell the two apart in the Notebook. See OD-P3-14.

## 3. Test results

| Check | Result |
|---|---|
| Focused (`trialNotebook*`) | 2 files, **77 passed** (69 model tests + 8 gate tests) |
| Required cases | first attempt · exact duplicate · order difference · duplicate pieces / quantity · different sauce · different ingredient set · sauce-as-piece vs base · retryCount · stable `#n` · newest-first · 50 boundary · 51st insertion · display-evicted retry (both policies) · 2 000 boundary · 2 001st eviction · evicted retry is new · activity-based eviction · numbers never reused · fingerprint version · 12 malformed fingerprints · 13 invalid feedbacks · feedback stored exactly as shown (all 6 P2 lines + null) · no hidden recipe data · no matcher target / distance · no Hint / save dependency (gate) |
| Property / fuzz | (a) **60 seeds × 300 random operations × 2 policies** against an independent plain-list oracle, with random small limits and alphabets: outcome, identity order, retry counts, display order and feedback identical at every step, plus `trialNotebookViolations` empty and input untouched; (b) 400 random garbage inputs never throw, never change the state; (c) 400 real pizzas (shuffles and quantity noise) vs the fingerprint contract |
| Mutation (`node tools/trial_notebook_mutation.mjs`) | **30 mutants: 29 killed, 1 equivalent, 0 survived, 0 invalid** (T07, see below) |
| Full Vitest | **268 files, 5 220 passed, 1 skipped, 0 failed** |
| `tsc -b` | clean |
| `oxlint` | only the 2 pre-existing warnings in `scoringV2.noSauceProfile.test.ts` |
| `npm run build` | passes |
| Production behaviour | unchanged: the only production source file in the diff is the new, unimported `trialNotebook.ts`; the gate proves no production file references it |

T07 (eviction does not remove the evicted identity's display row) is equivalent: display and identity order agree on the displayed rows and the display is full whenever the identity index is full (display ≤ identity), so the evicted row is always the last display row and the same insertion already slices it off. The filter is kept as a defence for the subset invariant, which `trialNotebookViolations` checks at every fuzz step.

## 4. The 50 / 2 000 semantics (as the brief asked)

- **Separation:** two structures, two limits; the display is a window onto the most recently active identities, never a substitute for them.
- **Retry as newest activity:** yes, without touching `#n`, `retryCount`'s meaning or privacy (§2.1).
- **51st unique:** oldest detail row leaves the display, identity stays (tested at the real 50 boundary).
- **Retry of a display-evicted identity:** detected as a duplicate of the original `#n`; `lookupAttempt` returns `hasDetail: false`. What else happens is OD-P3-13 (§6).
- **2 001st unique:** oldest identity evicted; display stays consistent; retry of the evicted combination is NEW with a fresh number (tested at the real 2 000 boundary).

Measured real data shape (not an authority; `…Measurement.json`, catalogue of 3 sauces + 26 other ingredients, random combinations of 2–8 pieces): fingerprint mean 76 B / max 130 B; serialised state **20.9 KB at 50 attempts, 78 KB at 500, 268.7 KB at 2 000, 270.2 KB at 2 100 (capped)**; **0.025 ms per record** on average (54 ms for 2 100 records). Each record copies the two arrays, which is O(identities); at 2 000 that is far below anything a player can do per cook.

## 5. Gates touched (explicit allowlists, no blanket relaxation)

- `attemptFingerprint.gate.test.ts` (P1's own gate): "no production file imports it" now allows exactly `trialNotebook.ts` as the **one** importer, and the referencing set is pinned to its exact list (the model, its two test files, P1's test file). Wiring beyond that still fails.
- `resultFeedback.gate.test.ts` (P2's gate): the two name checks are split. A production file may mention `attemptFingerprint` only if it is the P1 module or `trialNotebook.ts`; `trialNotebook` may be mentioned only by `trialNotebook.ts` itself.
- New `trialNotebook.gate.test.ts`: no production file imports or mentions the model; its imports are exactly `./attemptFingerprint` (no data, state, hint, matcher, economy, persistence or save module; no dynamic import, storage, clock, randomness, network or DOM); the entry and stored types declare no recipe / target / distance / collision / hint / technique / candidate / answer field.

## 6. Design question audited: retrying an identity whose detail row left the display

**A. REVIVE** — the retry also puts a row back at the top. **B. NOTICE_ONLY** — the retry only reports the duplicate of `#n` and counts; no row.

Both are implemented behind `recordAttempt(…, { evictedRetry })` and both are fully tested. Neither reads anything hidden: a revived row is built only from the combination inside the fingerprint and the line the player was just shown; the old line is gone and is **not** reconstructed.

| | A. REVIVE | B. NOTICE_ONLY |
|---|---|---|
| Player expectation | "I just made it again, so it is at the top, `#3 ×2`." The 「📓 前にも… (試作#3)」 notice can be opened. | The notice names `#3`, but `#3` is not in the list: "where is it?" unless the screen explains it. |
| Consistency with an in-display retry | same (row to top, line updated) | differs: a shown row moves, a hidden one does not |
| Display churn | a player alternating over many old combinations pushes other rows out of view (their own actions) | the list changes only when something new is tried |
| Memory | unchanged (display ≤ 50) | unchanged |
| Number stability | `#n` kept | `#n` kept |
| Information | row shows the latest line (not the first) | nothing new shown |
| Model complexity | one rule: the display is the 50 most recently touched attempts | two tiers: touching an identity only shows it if it was already shown or is new |

Audit conclusion: A is the more natural model (one rule, consistent with in-display retries, the notice stays openable); B is the more conservative one (the list only ever shows rows that were created while visible). Not decided here. The default is `NOTICE_ONLY` only because it creates nothing; **P3-3 must pass the option explicitly** and should not rely on the default.

## 7. Not done (by scope)

No RESULT / Dex / Builder wiring, no entry points (OD-P3-11), no duplicate notice UI (OD-P3-10), no Dex 発見メモ (P3-2), no save or persistence (forbidden in Phase 1), no P1 or P2 logic change (only the two gate allowlists above), no collision work (IC-1 / IC-2 stay separate).

## 8. Owner decisions required (before P3-3; none blocks P3-1)

| ID | Decision | Options |
|---|---|---|
| **OD-P3-13** | Retry of an identity whose detail row left the display | **A REVIVE** (recommended: one rule, notice stays openable) / B NOTICE_ONLY |
| **OD-P3-14** | Does the Notebook record ORIGINAL vs INCOMPLETE_MATCH? | **no (today: OD-P3-4's list has no outcome field)** / yes: add a displayed-lead kind (「図鑑のピザまであと少し」 is already shown to the player) |
| **OD-P3-15** | Confirm the two model choices in §2: retry = newest activity; retry replaces the row's feedback with the latest line | **confirm** / change (e.g. keep the first line too) |

## 9. Verdict

**B. OWNER DECISION REQUIRED.** P3-1 is complete and green; OD-P3-13..15 are needed before P3-3 wiring. No PR was created; P3-2 and production wiring were not started.
