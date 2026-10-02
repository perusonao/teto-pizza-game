# Research Target: no implicit sticky recipe with multiple Research Entries — Result (Issue #353)

Base: `47c574a` (production). Branch: `claude/research-target-sticky-recipe-at6bq2`. Owner Decision: Option B (+ 2026-10-02 addendum, see Issue #353).

## Change

- `needsResearchTargetChoice(state)` (`src/state/discoveryHint.ts`): registered Research Entries (ownership-derived, stock 0 still counts) `>= 2` and no valid Research Target.
- `resolveHintSession`: in that state the system picks nothing — not the legacy purchase sticky (HE-UI-4), not a revealed / bought session, not a lone candidate. Only the player's explicit Dex choice counts: a Dex card's Hint pin, or the session that pin made (`fromDex`). A Research Target (`START_FREE_COOK { researchTargetId }`) is untouched.
- `hintSheetView`: new `CHOOSE_RESEARCH` view (carries only its kind) → HintSheet shows 「🔎 研究するピザを選ぶ」 (fixed copy) → closes the sheet and opens the Dex's anonymous Research cards (`onOpenDex`, UI navigation only). The IP-1 notebook / pantry actions stay on this sheet (it replaces OPEN_POOL for these states).
- `START_FREE_COOK` with 2+ entries and no target drops the carried Hint session (a new HOME round is not the earlier round's choice). A retry keeps it.
- Every purchase / request path (`purchaseSelectableHintFact`, `requestDeductionHintFact`, `requestHint5RungFact`, `unlockNextHint`, `hint5SheetView`) already goes through `resolveHintSession`, so they return `null` in this state: no Pitz, no fact.

Not changed: save schema, `discoveryHintFacts` / `discoveryHintPurchases` format (bought facts are kept), Hint 5.0 ladder / taxonomy, matcher, Trial Notebook, ORIGINAL judgment, cross-recipe discovery, inventory consumption, Research Entry derivation, `selectHintTarget` / `hintTarget.ts`. No membership oracle added.

## Existing tests changed (intentional contract change)

The `legacy` / production-26 fixtures are 2+ registered-entry states, i.e. exactly the targeted case. Their assertions of the old behaviour (sticky / purchase re-targeting, `OPEN_POOL` sheet, a fresh pin picking nothing) were rewritten to the new contract; every other test is unchanged. E2E: `OPEN_POOL` copy / `data-hint-kind` assertions updated in 4 specs, `discovery-research-target` D gained a `CHOOSE_RESEARCH` assertion.

## Tests

- New `discoveryHint.researchChoice.test.tsx` (19): targetless + bought facts / levels / sessions, new HOME start drops a carried session, reload, stock 0 counts, every purchase / request path refused with Pitz / facts / purchases unchanged, explicit Dex selection (research start, pin), Entry = 1, Research Target present (purchase still works), Dex-0 Margherita, privacy DOM (no digits, recipe names / ids, oracle words).
- `App.dexHint.test.tsx`: HOME → レシピ発見 → ヒント → 選ぶ → Dex → 研究する → Hint (SELECTABLE).
- New E2E `e2e/discovery-research-choice.spec.ts` (390×844 / 360×800 Chromium): no overflow, CTA inside the viewport, no hidden identity, the same flow.
- Matcher / Notebook / ORIGINAL: existing suites unchanged and green (`gameReducer.researchTarget`, `researchLoop`, `ResultPanel.research`, notebook specs).

## Human Verification

Screenshots (`docs/reports/screenshots/research-target-no-implicit-sticky/`): `before-01-implicit-sticky-hint` (production code: the sheet shows the bought recipe's Hint with no choice made), `after-01-choose-sheet`, `after-02-dex-research-cards`, `after-03-chosen-hint`, at 390×844 and 360×800. No video (static flow; Owner: only if needed).
