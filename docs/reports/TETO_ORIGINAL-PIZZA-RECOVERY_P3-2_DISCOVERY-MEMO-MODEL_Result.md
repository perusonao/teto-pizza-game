# Original Pizza Recovery P3-2 — Discovery Memo Pure Display Model (Result Report)

- **Base `origin/main` SHA:** `d7270303b0bb5837119ed00ae75f621ee10e57d0` (fresh fetch; unchanged since P1 merged, so no drift to audit).
- **Branch:** `claude/p3-2-discovery-memo-model` (from that SHA, plus a merge of the P3 audit docs branch so the matrix and Owner Authority sit beside the code). **No PR.**
- **Scope:** pure display model + tests + gates + tooling + docs. **Pure and UNWIRED.** No DexOverlay, App, RESULT, Trial Notebook, Builder, save, navigation, CSS or UI. P3-3 and later not started.
- **Authority:** `TETO_ORIGINAL-PIZZA-RECOVERY_P3-2_DISCOVERY-MEMO_Fresh-Audit.md` and its matrix `docs/reports/data/TETO_ORIGINAL-PIZZA-RECOVERY_P3-2_FACT-DISPLAY-MATRIX.json`; Owner decisions OD-P3-1..15, **D-1 = APPROVED, D-2 = APPROVED**.
- **Verification Policy:** not triggered (no UI / UX / gameplay change; the model has no production caller). P3-4 (Dex wiring) will trigger it.
- **Verdict:** **A. P3-2 PURE DISPLAY MODEL COMPLETE** (§9).

## 0. Owner decisions applied

| ID | Decision | Applied as |
|---|---|---|
| **D-1 = APPROVED** | Free text from Hint 2.0 / 4.0 is not copied into the Dex memo; it stays in the HintSheet history. It is never parsed or reinterpreted into a Dex fact. | The model has no input for any free-text line, and reads none: a `discoveryMemo.test.ts` test feeds a presentation carrying `grandfatheredSteps`, `deduction` lines, `next`, `pitzBalance`, `description` etc. and requires byte-identical output with none of their text. |
| **D-2 = APPROVED** | Exact ingredient names the player already legitimately owns from earlier hints may be shown as 「以前のヒント」. Only names already player-owned under the existing authority; nothing inferred from text. | Typed `legacyIngredient` rows built from `legacyKnownIngredientIds` only (validated ids, de-duplicated, never a name already shown as a fact). They complete no rung. |

## 1. What was added

| File | Role |
|---|---|
| `src/logic/discovery/discoveryMemo.ts` | the model (the only production file added; unimported) |
| `src/logic/discovery/discoveryMemo.test.ts` | 69 unit / fail-closed / limits / property-fuzz tests |
| `src/logic/discovery/discoveryMemo.probe.test.ts` | 13 regression probes through the REAL Hint 5.0 authority (all 25 recipes × every rung, 547-pair metamorphic, legacy, forged and hostile ledgers) |
| `src/logic/discovery/discoveryMemo.gate.test.ts` | 9 boundary / wiring / input-shape gates |
| `tools/discovery_memo_mutation.mjs` + `docs/reports/data/…P3-2_DISCOVERY-MEMO_Mutation.json` | 40-mutant harness (34 behaviour + 6 boundary) and its output |
| `tools/original_pizza_p3_2_fact_display_audit.mjs` (from the audit) | still runs and passes 14 / 14 against this branch |
| modified test: `hint5Production.gate.test.ts` | one explicit, type-only allowlist entry (§5) |

## 2. The model

```ts
discoveryMemoOf(input: {
  cardState: RecipeDiscoveryState,            // only "DISCOVERABLE" has a memo
  hint5Enabled: boolean,                      // HINT5_LADDER_ENABLED
  presentation: Pick<Hint5Presentation, "board" | "legacyKnownIngredientIds" | "completeText" | "onboarding"> | null,
}): DiscoveryMemo | null

DiscoveryMemo = { rows: DiscoveryMemoRow[]; completion: "IN_PROGRESS" | "COMPLETE"; hasKnownFact: boolean }
DiscoveryMemoRow =
  | { kind: "sauce" | "cheese" | "keyTopping"; status: "UNKNOWN" }
  | { kind: "sauce" | "cheese" | "keyTopping"; status: "KNOWN"; ingredientIds }
  | { kind: "cheese" | "keyTopping"; status: "NONE" }
  | { kind: "structure"; status: "UNKNOWN" } | { kind: "structure"; status: "KNOWN"; lineJa }
  | { kind: "subToppingFamily"; ordinal; family; symbol; labelJa; lineJa }
  | { kind: "legacyIngredient"; ingredientId }
  | { kind: "complete"; lineJa }
```

- **Privacy by structure.** The input type has three keys and the presentation `Pick` has four fields. There is no parameter for a recipe (object, id, name, description), matcher, P2 feedback, Trial Notebook, candidate set or count, elimination result, technique, catalogue fact, Pitz, price or next-rung offer. Both imports are `import type` (erased), so the module has **no runtime dependency at all**. It does not fetch and filter; it cannot obtain those things.
- **Copies, never reinterprets.** The structure and class lines and the complete line are the authority's own text, passed through unparsed. Family views are copied after checking the family is one of the seven; ids are checked against the ingredient-id grammar.
- **Eligibility.** `null` unless the card is DISCOVERABLE, the flag is exactly `true`, a presentation exists, and `onboarding` is exactly `false`. The memo is recomputed from the facts every time, so a card that leaves DISCOVERABLE shows nothing and, on return, the same ledger rebuilds the same memo. The ledger is never read or written here.
- **Row order** is fixed: sauce, cheese, keyTopping, structure, subToppingFamily (ordinal order), legacyIngredient, complete.
- **Fail closed.** A malformed row becomes `UNKNOWN` (never guessed); a sauce is never `NONE`; `NONE` only for an empty cheese / key rung that was bought; a family row needs a known structure row; a complete row needs every fixed row settled; over-long lists (32 ids per row, 32 families, 256 legacy names, 200 characters) are treated as malformed, not truncated; hostile property names and junk entries are skipped.
- **Never produced:** an unbought rung's content, a sub-topping id / name / initial, a slot or count for an unbought rung (no slot before STRUCTURE, and never an UNKNOWN sub-topping slot), a candidate list / count / elimination result, a next rung, a price, Pitz, a technique, "no sauce", a matcher distance, a recipe identity, a P2 or Trial Notebook fact.

## 3. Matrix → tests

The audit's 4 gates, 4 fixed rows, 13 fact rows and 14 invariants are all exercised:

| Matrix | Test |
|---|---|
| G1..G4 (card state, flag, target, onboarding) | `discoveryMemo.test.ts` gates (all four card states, flag off / non-boolean, null presentation, onboarding true / "false" / absent, non-object inputs); probe: onboarding and non-target |
| MX-PREFIX | probe: every recipe × every prefix, rows known exactly for bought rungs with the ladder's own ids, NONE only for bought empty cheese / key |
| MX-SUB | unit: no family before STRUCTURE even with a SUB_CLASS entry; ordinal order; malformed entries dropped; probe: count equals bought sub rungs, none before STRUCTURE; forged `cls:` records draw none |
| MX-COMPLETE | unit + probe: the complete row iff authority says so and all fixed rows settled |
| MX-LEGACY (D-2) | unit + probe: owned names are typed rows, complete nothing, leave the fixed rows UNKNOWN |
| MX-PROJECTION (D-1) | unit: free-text / offer / Pitz / recipe fields on the presentation change nothing; probe: Economy 1.0 + Hint 4.0 facts add no free text |
| MX-PRIVACY | probe: no unbought id or name, no sub-topping id, no recipe id / name / description, no ledger string, no offer, in any of the states |
| MX-FREELEAK | probe: nothing bought ⇒ byte-identical memo for all 25 recipes |
| MX-METAMORPHIC | probe: equal completed content ⇒ equal memo for every pair and prefix (≥ 500 pairs; the audit measured 547) |
| MX-ROBUST | unit + probe: hostile / future / malformed ledgers and boards never throw and add no fact row |
| MX-INPUT | gate: two type-only imports, no value import / require / dynamic import, forbidden tokens absent from the code, input and presentation shapes pinned |
| "state leaves / returns DISCOVERABLE", "same facts ⇒ same output", "no recipe / description dependence" | unit + probe, including random extra fields on the presentation |

**151-state probe and 547-pair invariant are kept as stable regression tests** (`discoveryMemo.probe.test.ts`, which derives the expected content from the ladder, not from the memo). The audit tool also stays as an executable check of the matrix against the presentation itself.

## 4. Verification

| Check | Result |
|---|---|
| Focused | `discoveryMemo.test.ts` 69 · `.probe.test.ts` 13 · `.gate.test.ts` 9 = **91 passed** |
| Property / fuzz | 400 random boards (valid and junk) × random legacy lists, complete texts, card states and onboarding: never throws, deterministic, rows in order, allowed keys only, ids valid, family only with structure, never a sauce NONE, completion consistent; 200 random presentations with random extra fields ⇒ identical output |
| Privacy / invariant probes | 151 real states (every rung of every recipe), 547 metamorphic pairs, forged / legacy / hostile ledgers (see §3); the audit tool: 14 / 14 PASS |
| Mutation (`node tools/discovery_memo_mutation.mjs`) | **40 mutants: 39 killed, 1 equivalent, 0 survived, 0 invalid.** The equivalent (M25, an array accepted as a record) is unreachable because the next guard rejects it (reason recorded). The 6 boundary mutants (a recipe import, a read of `presentation.next`, a recipe-id input, a value import of the ladder, a Trial Notebook dependency, a candidate row kind) are all killed by the gate |
| Full Vitest | **269 files, 5 234 passed, 1 skipped, 0 failed** |
| `tsc -b` | clean |
| `oxlint` | only the 2 pre-existing warnings in `scoringV2.noSauceProfile.test.ts` |
| `npm run build` | passes |
| Production behaviour | unchanged: the only production source file in the diff is the new `discoveryMemo.ts`, which no production file references (gate) |

## 5. Gates

- **New `discoveryMemo.gate.test.ts`:** no production file imports or mentions the model (the Dex, App, RESULT, Builder, tray / pantry, persistence and reducer are scanned by name too); its code has exactly the two `import type` statements; no other import form; no recipe, matcher, P2, Trial Notebook, fingerprint, technique, purchase, economy, persistence, storage, clock, randomness or network token in its code (comments stripped); `DiscoveryMemoInput` is exactly `{ cardState, hint5Enabled, presentation }`; the accepted presentation is exactly four fields; the row kinds are exactly the typed rows.
- **Existing `hint5Production.gate.test.ts` (H5-3):** "the only production importers of the Hint 5.0 layer" now lists `discoveryMemo.ts` as the one additional allowlisted importer, and a second assertion requires that its only import of that layer is the single `import type { Hint5Presentation }` statement. A value import, or any other importer, still fails.

## 6. Not done (by scope)

No DexOverlay / App / RESULT / Trial Notebook / Builder wiring, no save or navigation change, no CSS or UI, no copy, no threading of the ledger, legacy ledger or discovered count into the Dex (P3-4), no P3-3. The IC-1 / IC-2 collision items stay separate.

## 7. Open points for P3-4 (not blocking)

UI sizing of a full memo (the audit's §10 estimate), whether to draw UNKNOWN rows for a card with no known fact (`hasKnownFact` is provided for that), and the F-1 / F-2 behaviours (the memo disappears while a card is not 🎨; after STRUCTURE the complete line vs a next rung tells the player whether a sub-topping exists, as the HintSheet already does).

## 8. Owner decisions

None open for P3-2. D-1 and D-2 are applied.

## 9. Verdict

**A. P3-2 PURE DISPLAY MODEL COMPLETE.** Focused tests, property / fuzz, privacy / invariant probes, mutation (40 mutants: 39 killed, 1 equivalent, 0 survived), full Vitest (269 files, 5 234 passed, 0 failed), `tsc -b`, lint and build are green; production behaviour is unchanged. No PR was created; P3-3 and every production wiring were not started.
