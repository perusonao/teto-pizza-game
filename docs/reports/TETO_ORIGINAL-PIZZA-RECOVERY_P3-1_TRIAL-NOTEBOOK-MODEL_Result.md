# Original Pizza Recovery P3-1 — Trial Notebook Pure Model (Result Report)

- **Base `origin/main` SHA:** `d7270303b0bb5837119ed00ae75f621ee10e57d0` (fresh fetch; unchanged since P1 merged, so no drift to audit).
- **Branch:** `claude/p3-1-trial-notebook-model` (from that SHA). **No PR.**
- **Scope:** pure model + tests + gates + tooling + docs. **Pure and UNWIRED.** No UI, RESULT, Dex, Builder, reducer, save or persistence. P3-2 and later not started.
- **Authority:** Fresh Audit `docs/reports/TETO_ORIGINAL-PIZZA-RECOVERY_P3_DISCOVERY-ASSISTANCE_Fresh-Audit.md` (branch `claude/original-pizza-discovery-p3-audit`) and the Owner decisions OD-P3-1..12; identity = P1 Attempt Fingerprint (merged, `src/logic/discovery/attemptFingerprint.ts`).
- **Verification Policy:** not triggered (no UI / UX / gameplay change; the model has no production caller).
- **Verdict:** **A. P3-1 PURE MODEL COMPLETE** (§9). Owner decisions OD-P3-13 = A (REVIVE), OD-P3-14 and OD-P3-15a/b are decided and applied (§0). Revision 2; revision 1 (the first implementation, `30aa604`) asked for those decisions and is superseded by §0 where they differ.

## 0. Owner decisions applied (revision 2)

| ID | Decision | Applied as |
|---|---|---|
| **OD-P3-13 = A** | A retry of an identity whose detail row left the display history keeps the same stable `#n` and brings the row back to the newest position. Nothing hidden may be rebuilt: only the retained fingerprint identity, the combination the player used now, the feedback shown now, the retry count and the stable number are available. | `recordAttempt` always revives. **REVIVE is the only behaviour and the production authority.** |
| **OD-P3-14** | No internal outcome field (ORIGINAL / INCOMPLETE_MATCH ...). OD-P3-4 stays the authority. The Notebook is the player's own tries and what the player was shown, not a history of internal matcher judgements. | No such field; unchanged from revision 1. A gate pins the entry types free of hidden / internal concepts. |
| **OD-P3-15a** | A duplicate retry is the newest activity: a displayed row moves to the newest position; an identity outside the display is revived there (OD-P3-13). `#n` never changes. | As implemented. |
| **OD-P3-15b** | On a retry the row's feedback becomes the latest feedback actually shown. The first feedback is not kept and there is no feedback history in Phase 1. | As implemented (a test asserts no trace of the earlier line in the serialised state). |

**The NOTICE_ONLY alternative was removed, not kept.** Audit of whether a test-only / comparison copy is needed: the independent fuzz oracle (plain lists, sharing no code with the model) already expresses the revive semantics, so a second in-model policy would only be a test of an option nobody can select; keeping it would leave a production-facing switch whose wrong value silently breaks the Owner's decision (and `revived` could not mean the same thing). `EvictedRetryPolicy`, `RecordOptions` and the `evictedRetry` argument are gone; `recordAttempt(notebook, { fingerprint, feedback })` has one behaviour. The outcome's `hadDetail` / `hasDetail` pair became a single `revived` flag (true when this retry brought a row back). `lookupAttempt` still reports `hasDetail` (whether a row is currently shown), which a future "tried before" notice may use without recording.

A consequence worth knowing: with revive the display history is exactly the 50 most recently active identities, newest first. `trialNotebookViolations` now checks that as an invariant at every fuzz step.

---

## 1. What was added

| File | Role |
|---|---|
| `src/logic/discovery/trialNotebook.ts` | the model (the only production file added) |
| `src/logic/discovery/trialNotebook.test.ts` | 68 unit / boundary / property tests |
| `src/logic/discovery/trialNotebook.gate.test.ts` | wiring, import and hidden-information gates |
| `tools/trial_notebook_mutation.mjs` + `docs/reports/data/…P3-1_TRIAL-NOTEBOOK_Mutation.json` | 30-mutant harness and its output |
| `tools/trial_notebook_measure.mjs` + `docs/reports/data/…P3-1_TRIAL-NOTEBOOK_Measurement.json` | real-data-shape measurement (not an authority) |
| modified tests: `attemptFingerprint.gate.test.ts`, `resultFeedback.gate.test.ts` | explicit allowlists, see §5 |

## 2. Model

API (all pure; the state is a plain JSON-shaped value, functions return a new state and never mutate the input):
`createTrialNotebook(limits?)`, `recordAttempt(nb, { fingerprint, feedback })` → `{ state, outcome }`, `lookupAttempt(nb, fingerprint)` (no recording), `notebookView(nb)`, `notebookSize(nb)`, `trialNotebookViolations(nb)` (invariant checker).

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

### Model choices, now confirmed by the Owner

1. A retry is the newest activity (OD-P3-15a). 2. A retry replaces the row's feedback with the latest line shown; no feedback history (OD-P3-15b). 3. No internal outcome is recorded (OD-P3-14).

## 3. Test results

| Check | Result |
|---|---|
| Focused (`trialNotebook*`) | 2 files, **76 passed** (68 model tests + 8 gate tests) |
| Required cases | first attempt · exact duplicate · order difference · duplicate pieces / quantity · different sauce · different ingredient set · sauce-as-piece vs base · retryCount · stable `#n` · newest-first · 50 boundary · 51st insertion · display-evicted retry (revived, same `#n`, no earlier line kept) · 2 000 boundary · 2 001st eviction · evicted retry is new · activity-based eviction · numbers never reused · fingerprint version · 12 malformed fingerprints · 13 invalid feedbacks · feedback stored exactly as shown (all 6 P2 lines + null) · no hidden recipe data · no matcher target / distance · no Hint / save dependency (gate) |
| Property / fuzz | (a) **60 seeds × 300 random operations** against an independent plain-list oracle, with random small limits and alphabets: outcome, identity order, retry counts, display order and feedback identical at every step, plus `trialNotebookViolations` empty and input untouched; (b) 400 random garbage inputs never throw, never change the state; (c) 400 real pizzas (shuffles and quantity noise) vs the fingerprint contract |
| Mutation (`node tools/trial_notebook_mutation.mjs`) | **30 mutants: 29 killed, 1 equivalent, 0 survived, 0 invalid** (T07, see below) |
| Full Vitest | **268 files, 5 219 passed, 1 skipped, 0 failed** |
| `tsc -b` | clean |
| `oxlint` | only the 2 pre-existing warnings in `scoringV2.noSauceProfile.test.ts` |
| `npm run build` | passes |
| Production behaviour | unchanged: the only production source file in the diff is the new, unimported `trialNotebook.ts`; the gate proves no production file references it |

T07 (eviction does not remove the evicted identity's display row) is equivalent: display and identity order agree on the displayed rows and the display is full whenever the identity index is full (display ≤ identity), so the evicted row is always the last display row and the same insertion already slices it off. The filter is kept as a defence for the subset invariant, which `trialNotebookViolations` checks at every fuzz step.

## 4. The 50 / 2 000 semantics (as the brief asked)

- **Separation:** two structures, two limits; the display is a window onto the most recently active identities, never a substitute for them.
- **Retry as newest activity:** yes, without touching `#n`, `retryCount`'s meaning or privacy (§2.1).
- **51st unique:** oldest detail row leaves the display, identity stays (tested at the real 50 boundary).
- **Retry of a display-evicted identity:** detected as a duplicate of the original `#n` (`lookupAttempt` returns `hasDetail: false` before the retry) and **revived** at the top with the same `#n` (OD-P3-13 = A).
- **2 001st unique:** oldest identity evicted; display stays consistent; retry of the evicted combination is NEW with a fresh number (tested at the real 2 000 boundary).

Measured real data shape (not an authority; `…Measurement.json`, catalogue of 3 sauces + 26 other ingredients, random combinations of 2–8 pieces): fingerprint mean 76 B / max 130 B; serialised state **20.9 KB at 50 attempts, 78 KB at 500, 268.7 KB at 2 000, 270.2 KB at 2 100 (capped)**; **0.025 ms per record** on average (54 ms for 2 100 records). Each record copies the two arrays, which is O(identities); at 2 000 that is far below anything a player can do per cook.

## 5. Gates touched (explicit allowlists, no blanket relaxation)

- `attemptFingerprint.gate.test.ts` (P1's own gate): "no production file imports it" now allows exactly `trialNotebook.ts` as the **one** importer, and the referencing set is pinned to its exact list (the model, its two test files, P1's test file). Wiring beyond that still fails.
- `resultFeedback.gate.test.ts` (P2's gate): the two name checks are split. A production file may mention `attemptFingerprint` only if it is the P1 module or `trialNotebook.ts`; `trialNotebook` may be mentioned only by `trialNotebook.ts` itself.
- New `trialNotebook.gate.test.ts`: no production file imports or mentions the model; its imports are exactly `./attemptFingerprint` (no data, state, hint, matcher, economy, persistence or save module; no dynamic import, storage, clock, randomness, network or DOM); the entry and stored types declare no recipe / target / distance / collision / hint / technique / candidate / answer field.

## 6. Design question audited (resolved: OD-P3-13 = A)

The question was whether a retry of an identity whose detail row left the display should **revive** the row (A) or only report the duplicate (B). The audit compared them (revision 1) and the Owner chose A. For the record:

| | A. REVIVE (chosen) | B. NOTICE_ONLY (not chosen) |
|---|---|---|
| Player expectation | "I just made it again, so it is at the top, `#3 ×2`"; the 「📓 前にも… (試作#3)」 notice can be opened | the notice names `#3`, which is not in the list |
| Consistency with an in-display retry | same rule | differs |
| Memory | unchanged (display ≤ 50) | unchanged |
| Hidden information | none: the row is built from the fingerprint and the line shown now | none |
| Model complexity | one rule: the display is the 50 most recently active attempts | two tiers |

Revived rows hold the **latest** line only; the earlier one is gone and is not reconstructed (OD-P3-15b).

## 7. Not done (by scope)

No RESULT / Dex / Builder wiring, no entry points (OD-P3-11), no duplicate notice UI (OD-P3-10), no Dex 発見メモ (P3-2), no save or persistence (forbidden in Phase 1), no P1 or P2 logic change (only the two gate allowlists above), no collision work (IC-1 / IC-2 stay separate).

## 8. Owner decisions

OD-P3-13 (REVIVE), OD-P3-14 (no internal outcome) and OD-P3-15a/b (retry = newest activity; retry replaces the feedback) are **decided and applied** (§0). Nothing is open for P3-1. Still open for later slices: none raised here; OD-P3-1..12 are in the Fresh Audit's Owner Authority section.

## 9. Verdict

**A. P3-1 PURE MODEL COMPLETE.** Focused tests, property / fuzz, mutation (30 mutants: 29 killed, 1 equivalent, 0 survived), full Vitest (268 files, 5 219 passed, 0 failed), `tsc -b`, lint and build are green; production behaviour is unchanged (the model has no production caller). No PR was created; P3-3 and every production wiring were not started.
