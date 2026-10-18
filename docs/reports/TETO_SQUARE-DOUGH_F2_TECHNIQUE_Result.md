# Square Dough F2 — 天板焼き Technique / Dex / 解放条件 / 旧save互換 / Anti-Oracle (Issue #538 / Epic #532)

Scope: F2 only. The ○□ switch (F3), the DOUGH-step wiring / O-7 confirm (F3), RESULT neutral shape line (F4) and any grandma recipe (E, #521) are **not** implemented. The round pizza, `PizzaStage`, #540, #527 and the shared Preview are untouched.

## Changes
| File | Change |
|---|---|
| `src/data/techniques.ts` | `TechniqueId` gains `"tray-bake"` (internal id, display 天板焼き). Owner copy as fixed constants `TRAY_BAKE_RIDDLE_JA` / `TRAY_BAKE_DESCRIPTION_JA`; `descriptionJa?` added to the definition. The OD-TQ-5/6 riddle exception is technique-scoped and constant (Owner decision C, 2026-10-18). |
| `logic/techniques/detection.ts` | `detectTechniquesUsed` reads the OBSERVED `pan` axis (`"tray"`); `requiredTechniquesOf` reads the target's `identityDimensions.pan`. Matcher and discovery modules unchanged (INV-TQ-NB test green). |
| `logic/techniques/dexView.ts`, `components/DexOverlay.tsx` | A DISCOVERED technique carries its description; the Dex shows it. RIDDLE state is unchanged (「？？？」+ riddle only). |
| `registration.ts`, `runtime.ts` | Type-only: the signature view may carry `dimensions`. |
| Gates | `testSupport/technique.allowlists.ts` adds the named `PAN_REQUIRING_RECIPE_IDS` (empty until E). `deductionProduction.gate` (INV-TQ-4) and `hint5Production.gate` (G7 clause 1) now assert the technique-requiring set equals `NO_SAUCE ∪ PAN_REQUIRING_RECIPE_IDS` both ways; G7 clause 2 / multi-sauce allowlist stays for E. |
| Tests | new `trayBake.test.ts`, `components/TrayBakeDex.test.tsx`; registry assertions in `techniques.test.ts` and tray cases in `persistence.discoveredTechniques.test.ts`. |

## Behaviour / compatibility
* **Inert in production**: no catalog target sets `pan`, so `techniqueAffordanceStep("tray-bake")` is `null` (INV-TQ-4), Dex shows nothing, RESULT cannot reveal it. Existing 57 recipes: no code on their discovery / scoring / render path changed.
* **U1 derived**: the affordance step comes from `techniqueAffordanceStep`; tests change `materialStep` and the opening step moves (14 → 20 for a synthetic garlic step). `ladderCredit:false` recipes are not counted. Step 14 for grandma is **not hard-coded**; re-verify at E.
* **Identity**: round + the pan recipe's ingredients → ORIGINAL; tray + same → NEW_DISCOVERY; other recipes' ingredients on the tray → ORIGINAL; `shape` stays UNAVAILABLE.
* **Save**: `discoveredTechniqueIds` gains only an id. No schema / top-level key change. Old save → new build, new save → old build (unknown well-formed id kept by the union / forward-compat path) tested.
* **Anti-Oracle**: while no recipe requires the pan, no Dex view, component, screen, CSS or Changelog source contains 天板 / `tray-bake` / the copy; the copy lives only in `data/techniques.ts`; hint / deduction / Research-row modules never read the pan axis. Dex RIDDLE DOM never carries the name, id or description.

## Final Gate
| Check | Result |
|---|---|
| `tsc -b` | pass |
| `npm run build` | pass |
| `oxlint` | existing warnings only |
| Vitest | 441 files / 8404 tests passed (2 skipped, pre-existing) |
| `deductionProduction.gate`, `hint5Production.gate`, `techniques.architecture` | pass (changed only via the named allowlist) |
| Playwright / WebKit | not run locally (no visible production change); WebKit runs in CI |
| Human Verification | **not required**: Dex card text is unreachable in production until E (policy §2, same as F1). F3 (switch) needs the 390×844 video + screenshots. |

## Owner items still open
* RESULT neutral shape line wording (F4). * Design Lock §8 items. * Re-derive the affordance step (expected 14) when E lands. * Pan-axis states in the DH4 sweep seeds: no pan-requiring recipe exists yet, so the sweep is source-level (hint modules pan-blind); E must add real pan states.
