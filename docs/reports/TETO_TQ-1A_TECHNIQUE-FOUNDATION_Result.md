# TQ-1A — Cooking Technique pure model / detection / persistence: Result Report

Issue #262 · Owner Decisions OD-TQ-1 / 2 / 6 / 7 / 10改 / 15 / P1 (APPROVED) · base `main` `7bb0116` (PR #264)
Final Implementation Gate: `docs/design/TETO_COOKING-TECHNIQUES_1.0_FINAL-IMPLEMENTATION-GATE.md` §3.2
(on `claude/cooking-techniques-design-n0qfwj`).

## What changed

| File | Change |
|---|---|
| `src/data/techniques.ts` (new) | `TechniqueId = "no-sauce"`, `TECHNIQUES` (name and riddle are working copy; TQ-1D decides the final copy), `KNOWN_TECHNIQUE_IDS`, `isTechniqueId` |
| `src/logic/techniques/detection.ts` (new) | `detectTechniquesUsed(signature)`, `requiredTechniquesOf(target)` |
| `src/logic/techniques/registration.ts` (new) | `registerTechniqueDiscovery` (pure, exactly-once), `backfillTechniqueLedger` (INV-TQ-1), `knownTechniqueIds`, `techniqueAffordanceStep` / `isTechniqueAffordanceOpen` (the affordance is derived from the ladder; INV-TQ-4) |
| `src/logic/techniques/nearMissPrivacy.ts` (new) | OD-TQ-P1, pure: `sauceAxisAnswerCount`, `axisGuidanceAllowed` (k ≥ 2), `NEAR_MISS_PRIVACY_FALLBACK_JA` |
| `src/state/persistence.ts` | `PersistentSaveV2.discoveredTechniqueIds` (no schema bump). The same edit adds the sanitizer, the forward-compat extras, the `writeSave` union and cap, `ProgressionSnapshot.discoveredTechniqueIds?` (union, never lowered), and `MAX_TECHNIQUE_LEDGER_SIZE = 64`. |
| Existing tests | Three save-shape key-list pins now list the new key, and two `PersistentSaveV2` fixtures gained the field. In `App.hintSheet.test.tsx`, the "save changes only by the Pitz debit and the fact ledger" check now names the one other key a write may add: the technique ledger's empty default `[]`, filled into a save that predates it. There is no other change to existing tests. |

**Unwired:** no reducer, App, UI, CSS or E2E change, and nothing writes the ledger yet (TQ-1C). No recipe is added, including Aussie.

## Owner requirements → evidence

| Requirement | Evidence |
|---|---|
| TechniqueId / NO_SAUCE | registry test |
| Pure detection | Used: pieces and no sauce. Not used: a sauced pizza, an empty pizza, or sauce only. Required: the declared base is empty. No production recipe requires a technique yet. |
| Discovery registration | A recipe match always records its technique (INV-TQ-1). An original records it only when the affordance is open (INV-TQ-6). A failed pizza records nothing. Idempotent. Unknown ids are kept in place. The input is never mutated. |
| Unknown id preservation | A well-formed unknown id (`post-bake`) survives this build's write. A malformed one (`Post Bake`, `__proto__`, 100 chars) is dropped. Gameplay reads known ids only. |
| Corrupted save | 42, a string, an object, null or true → `[]`, and the rest of the save survives. A mixed array → `["no-sauce"]` (deduplicated). |
| Full Reset | `resetSave` clears the ledger, and a later write stays `[]`. |
| Exactly-once | Registration is idempotent. The persistence union means a stale or empty snapshot never removes a technique. Duplicates collapse. |
| Old build round-trip | v1 and older v2 saves read `[]`. A future top-level field survives this build's write — the same P3-4B mechanism that keeps this ledger alive in older builds. |
| **Architecture: the recipe matcher never reads techniques** | A source scan covers `discovery/**` (matcher, signature, freeCook, hint modules), `discoveryCatalog`, `recipes`, `completionGate` and `discoveryRegistration`: no technique import and no ledger name. Scoring, Pitz, stars and the Dex are scanned the same way (INV-TQ-3). |
| **INV-TQ-NB: Recipe Discovery works while a technique is undiscovered** | A synthetic no-sauce target (the Aussie shape) is a `NEW_DISCOVERY` with an empty ledger. For every production target plus the synthetic one, running registration under four different ledgers never changes the recipe outcome. |
| OD-TQ-P1 (pure) | Aussie at W1 step 12 (tomato only owned) → k = 1 → fallback. With a second sauce owned → k = 2 → the sauce line is allowed. The fallback line names no axis and no technique. |

Mutation check (done by hand, then reverted):

| Mutation | Tests that fail |
|---|---|
| Affordance gate ignored | 1 |
| Unknown ids not preserved on write | 2 |
| `matcher.ts` imports a technique module | the architecture test fails |

## Revert

Revert this PR alone. A ledger already written survives the revert, because older builds keep unknown top-level keys. Nothing writes it before TQ-1C.
