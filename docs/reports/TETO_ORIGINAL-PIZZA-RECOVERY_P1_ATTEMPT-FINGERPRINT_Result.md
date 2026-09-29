# Original Pizza Recovery P1 — Attempt Fingerprint Foundation (Result Report)

- **Audited / base `origin/main` SHA:** `21dc0a670e586f478661a6cf54671313b2a7cb5b` (fresh fetch; unchanged since the Fresh Audit)
- **Branch:** `claude/attempt-fingerprint-p1` (new, from latest `origin/main`; the audit branch `claude/pizza-recovery-discovery-audit-mvq4dn` @ `7c06e4818b1a3f555fb8ceceb865e177bc10ad6e` is the authority, not the base)
- **Scope:** pure logic + types + unit / property / mutation tests + docs. **Pure and unwired.** No PR.
- **Verification Policy:** not triggered (no UI/UX/gameplay change → no video / screenshots).
- **Verdict:** **A. P1 COMPLETE / READY FOR REVIEW** (§10)

## 1. Pre-implementation re-audit (latest main vs. the Fresh Audit)

`git diff 21dc0a6..origin/main` over `src/logic/discovery`, `gameReducer.ts`, `discoveryCatalog.ts`, `techniques.ts` was empty, and the code was re-read. Every claim the audit relied on holds:

| # | Item | Finding on latest main | Matches audit? |
|---|---|---|---|
| 1 | `RuntimeSignature` | `signatureOfPizza(pizza)` → `{ ingredientSet, sauceBase, ingredientCounts, dimensions }`; pure, total | ✅ |
| 2 | matcher identity | ingredient set equal **and** `sauceBase` equal (when the target declares it) **and** every OBSERVED dimension equal; `UNAVAILABLE` axes assume the default; capability-requiring targets never match | ✅ |
| 3 | sauceBase normalisation | `sortedUnique(sanitizeStringArray(pizza.sauceIds))`; non-string entries dropped | ✅ |
| 4 | ingredientSet canonicalisation | `sortedUnique([...sauceIds, ...sanitizeToppings(toppings).map(t => t.ingredientId)])`; default code-unit `.sort()` | ✅ |
| 5 | duplicates | collapsed (presence-only); counts live in `ingredientCounts` and are *not* identity | ✅ |
| 6 | no-sauce | `sauceBase = []`; the set simply has no sauce id | ✅ |
| 7 | Technique / Cooking Steps dimensions | all 11 dimensions are `FIXED_BY_FLOW` (9) or `UNAVAILABLE` (2: `zones`, `shape`); none `OBSERVED`; `RUNTIME_SUPPORTED_CAPABILITIES = []`; techniques are a separate ledger, not in the signature | ✅ |

No discrepancy → implementation proceeded.

## 2. Changed files (all new; nothing existing modified)

| File | Role |
|---|---|
| `src/logic/discovery/attemptFingerprint.ts` | the foundation (pure, unwired) |
| `src/logic/discovery/attemptFingerprint.test.ts` | 29 unit + property-style tests |
| `src/logic/discovery/attemptFingerprint.gate.test.ts` | 7 wiring / import / privacy gates |
| `tools/attempt_fingerprint_mutation.mjs` | hand-rolled mutation harness (no Stryker in the repo) |
| `docs/reports/data/TETO_ORIGINAL-PIZZA-RECOVERY_P1_ATTEMPT-FINGERPRINT_Mutation.json` | its output |
| `docs/reports/TETO_ORIGINAL-PIZZA-RECOVERY_P1_ATTEMPT-FINGERPRINT_Result.md` | this report |

(Full suite after the change: 250 files / 4 921 passed, 1 skipped.)

## 3. Exact fingerprint contract (version 1)

```
AttemptFingerprint := "fp1:" + JSON.stringify([ sauceBase, ingredientSet ])              // ext empty
                   |  "fp1:" + JSON.stringify([ sauceBase, ingredientSet, ext ])         // ext non-empty
sauceBase     := sorted, de-duplicated sauce ids                (RuntimeSignature.sauceBase)
ingredientSet := sorted, de-duplicated ids of every sauce+piece (RuntimeSignature.ingredientSet)
ext           := { <dimensionKey>: <value> } for every identity dimension whose status is OBSERVED
                 AND whose value is not the Phase-2 default; keys in IDENTITY_DIMENSION_KEYS order
```

Example: Margherita's composition → `fp1:[["tomato-sauce"],["basil","mozzarella","tomato-sauce"]]`.

API (all pure): `attemptFingerprintOfSignature`, `attemptFingerprintOfPizza` (via the matcher's own `signatureOfPizza`), `isSameAttempt`, `parseAttemptFingerprint` (strict, canonical-only), `attemptFingerprintVersion`, `isAttemptFingerprint`, `ATTEMPT_FINGERPRINT_VERSION`.

Properties: order independent · deterministic · injective (JSON, so no id can forge a delimiter) · versioned · serialisable · idempotent through parse/serialise · same matcher identity ⇒ same string · different identity ⇒ different string.

**Not identity, deliberately not added:** ingredient order, quantity, duplicate placement, topping placement, timing, bake value, sauce amount, CUT, Cooking Steps, dough shape.

## 4. Agreement with the matcher

The matcher is the SSOT and is used **as the test oracle**: for two pizzas A and B, a catalog target is built from A's signature and `matchDiscovery(signature(B), [target])` must be `UNIQUE_MATCH` **iff** `fp(A) === fp(B)`.

- Property test over **3 000 seeded random pairs** (half deliberately related through shuffles and duplicated pieces so > 1 000 equal pairs occur): fingerprint equality ⇔ matcher identity in every pair.
- Includes the matcher's *role* rule: the same ids as base vs. as a piece are different attempts (`tomato-sauce` as sauce ≠ as topping), verified against the matcher directly.
- Property: shuffling / duplicating pieces never changes the fingerprint; adding or removing an ingredient *kind* always does (1 000 cases).
- Property: every generated fingerprint parses back to an identical canonical string (1 000 cases).
- Axes that the matcher ignores (`FIXED_BY_FLOW`, `UNAVAILABLE`) are proven not to enter the fingerprint even when a hand-built signature gives them exotic values.

## 5. Future-extension policy

- **No future dimension is guessed.** The only extension is the *existing* signature contract: an axis that becomes `OBSERVED` is carried in `ext`, sparsely, only when non-default.
- **Backward compatibility:** an attempt made with default dimensions keeps the byte-identical `fp1:` string before and after a dimension ships, so a stored fingerprint stays valid and comparable. Tested with synthetic `OBSERVED` axes (`late`, `shape`, `dough`, `cook`).
- `ext` values are compared the way the matcher compares them (canonical JSON of the value).
- **Version rule:** adding a dimension is additive and stays `fp1`. Changing how `sauceBase` / `ingredientSet` are derived, or the encoding, requires `fp2:` and an explicit migration. `attemptFingerprintVersion` reports an unknown version's number so a future store can keep such entries untouched rather than drop them; `parseAttemptFingerprint` returns `null` for anything that is not a canonical v1 string.
- **Canary test:** if any axis becomes `OBSERVED`, a test fails on purpose so the contract is re-reviewed (the fingerprint would start carrying it automatically).

## 6. Attempt identity, not recipe identity

- The fingerprint says **"same ingredient combination"**, never "same result": two attempts sharing one string can still differ in quantity (Completion Gate), bake or sauce amount. Documented in the module header and asserted in tests.
- **Collisions are not resolved here.** A test builds two catalog targets with an identical identity (the Phase-0 collision shape): the matcher returns `AMBIGUOUS`, while the pizza's fingerprint remains one string computed without either target and containing neither id. The 5 groups / 10 recipes found in the 172 authority are untouched.

## 7. Privacy

- The input type is `RuntimeSignature` (or a `PizzaState` routed through `signatureOfPizza`); the function takes exactly one argument — no recipe, Dex, catalog, hint, near-miss or distance data can reach it.
- The gate test pins the module's imports to **exactly** `./signature` and a type-only `PizzaState` import; it fails on any import containing `data/recipes`, `discoveryCatalog`, `state/dex`, `nearMiss`, `hintTarget`, `hint5`, `persistence`, `economy` or `matcher`.
- Output holds only the player's own ingredient ids. Tests assert it contains no recipe id/name (a pizza whose composition *is* Margherita still yields nothing containing "margherita"), no undiscovered-recipe information, no nearest-recipe or distance information, no score.

## 8. Test / property / mutation results

| Check | Result |
|---|---|
| Fingerprint tests (unit + property + gates) | **36 / 36 pass** (29 + 7, 2 files) |
| Full suite | **250 files, 4 921 passed, 1 skipped** |
| `tsc -b` | clean |
| `oxlint` | no findings in the new files (the one warning printed is pre-existing in `scoringV2.noSauceProfile.test.ts`) |
| Mutation harness | **26 mutants: 22 killed, 4 EQUIVALENT, 0 survived, 0 invalid** — score 1.0 over non-equivalent mutants (22/22) |

Mutants cover: dropped sort / dedupe; omitted sauceBase / ingredientSet; version bump; UNAVAILABLE/FIXED leakage; default-valued or never-included extension; empty extension written; extension order; missing canonicalisation; inverted `isSameAttempt`; version-pattern and version-reader faults; every parser guard (canonical, sauce ⊆ set, payload length, unknown / default extension key, ext type, id type, round-trip).

**How the tests improved the code:** the first run caught a real bug — `parseAttemptFingerprint` accepted unsorted/duplicated ids because the round-trip check re-serialised without re-canonicalising. Fixed with an explicit canonical-form check before the round-trip (mutant M17 now kills its removal).

**The 4 equivalent mutants** (M16 prefix check, M20 payload length, M21 unknown ext key, M24 ext array) remove an early guard that is *redundant* with parse's final round-trip check (re-serialising the parts must reproduce the input), which rejects exactly the same inputs; they cannot change observable behaviour and are documented as such in the harness rather than silenced.

Reproduce: `node tools/attempt_fingerprint_mutation.mjs` (exit 1 if any non-equivalent mutant survives; the source is always restored).

## 9. Production wiring is 0

- Gate test: **no non-test file imports `attemptFingerprint`**; only its own test file references it.
- `git diff origin/main` = 6 **added** files, 0 modified, 0 deleted. No change to `matcher.ts`, `signature.ts`, `nearMiss.ts`, `resultNearMiss.ts`, `ResultPanel`, `GameScreen`, `gameReducer`, `persistence`, Hint 5.0, recipe data, CSS or the save schema.
- No UI, RESULT, Builder, duplicate warning, session-state or persistence wiring.
- The gate additionally asserts `signature.ts` still declares no supported capability and no OBSERVED dimension.

## 10. Conflicts, remaining risks, P2 readiness

- **LC-R5b:** no conflict. The change is 3 new files under `src/logic/discovery/`, one tool, and docs; it touches no Builder/pantry/shelf file, and no LC-R5b Issue/PR exists on main to overlap with. PR #309 (taxonomy) is not touched or read.
- **Remaining risks**
  1. **Sort order:** identity relies on JavaScript's default code-unit `.sort()`, same as the matcher. If the matcher ever changes its ordering rule, the fingerprint must follow (the property test against the matcher oracle would fail immediately).
  2. **Fingerprint lifetime:** the mapping fingerprint → outcome depends on the catalog and Dex; a stored fingerprint must only ever *inform*, never block (Owner Decision OD-ORP-12 in the Fresh Audit).
  3. **Store growth / persistence** is deliberately out of scope (P3/P5).
  4. **Equivalent mutants** rely on the round-trip check staying in `parse`; removing it would need the four early guards restored to be tested individually (M23 currently kills that removal).
- **P2 readiness:** P2 (RESULT feedback hardening) does **not** depend on this module and is unblocked by it only in the sense that the shared collision list is independent. **P3 (Trial Notebook, session-only)** is now unblocked technically (fingerprint available); it still needs the Owner Decisions OD-ORP-3/4 from the Fresh Audit before any wiring.

## 11. Verdict

**A. P1 COMPLETE / READY FOR REVIEW.** No PR has been created.
