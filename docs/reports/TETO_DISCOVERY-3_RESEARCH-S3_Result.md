# Discovery 3.0 Research Recipe — S3 Research Target + Hint Integration (Result)

Refs #346. Base: `main` `a006833df22c5575670beba5b6079113d44a9239` (S1 #347, S2 #348 merged).

## What S3 does

Research Entry card → 「このピザを研究する」 → Free Cooking (research context) → Hint 5.0 on that entry.

- **Research Target** = `GameState.researchTargetId`, session-only. Carried through `ProgressionCarry`
  (survives a Free Cooking retry), cleared by a plain `START_FREE_COOK` (HOME / Dex pin). Set only by
  `START_FREE_COOK { researchTargetId }` and only while `isValidResearchTarget` (registered entry **and**
  DISCOVERABLE, i.e. cookable now). Never written to the save: **0 new save fields, no schema bump**.
- **Matcher independence**: the target is read by `selectHintTarget` / the research UI only. `CONFIRM_BAKE`,
  the matcher and `REGISTER_TO_DEX` never read it (pinned by `gameReducer.researchTarget.test.ts` C: A selected,
  B baked exactly → B discovered, results byte-identical with and without a target).
- **Hint target**: `HintTargetSource` gains `"research"`. `selectHintTarget` honours `researchTargetId` first
  (while DISCOVERABLE), including pool ≥ 2 — the player's own anonymous-card choice, so it leaks nothing about the
  pool. With no target every branch is unchanged (OPEN_POOL with 2+ still chooses nothing; a pin still never
  chooses). `resolveHintSession` / `isSessionTarget` read `state.researchTargetId`, so the existing Hint 5.0
  request/view path serves the entry unchanged.
- **Unlock fact vs Hint (OD-H5-M3 path)**: for a Research-Target request only, the derived S1 unlock fact is passed to
  `requestHint5Rung` as an extra request-time known `ing:<unlock>` id. The ledger is never written with it
  (merge = stored + `addFactIds`). Effect: a rung whose subjects are all unlock-known completes ALREADY_KNOWN / 0 Pitz
  (pesto-pollo: the chicken SUB_CLASS rung); partly known rungs charge normally and store only the unknown names.
  The pre-purchase view is identical with/without it (tested). Non-research requests are untouched.
- **Knowledge authority**: `discoveryHintFacts` only. No new store; attempts add nothing.
- **Class fact**: `researchEntryViews` (in `state/discoveryHint.ts`, the sanctioned Hint 5.0 importer) shows
  `△ <existing family label>` only for a stored `cls:` fact of this recipe, only after STRUCTURE (`h5:structure`),
  never for an ingredient already shown as exact; exact `ing:` facts (SAUCE/CHEESE/…) show as ✓. Existing
  `hint5ClassView`/taxonomy only.
- **STRUCTURE**: total shown only after `meta:ingredient-total`; no slot list, no remaining count.
- **Boundary guards unchanged**: `INGREDIENT_TOTAL_FACT_ID` stays a local constant in `researchEntry.ts`; Hint 5.0
  layer importers stay `{HintSheet, discoveryHint}` — the class/exact projection lives in `discoveryHint.ts`, so
  `researchEntry.ts` and `DexOverlay` import nothing guarded.
- **Cooking UI**: in a Free Cooking PREPARE with a valid target, the free-cook order card is replaced (same slot,
  same component, one extra line) by `🔎 研究中 ？？？ピザ ①` + `わかっていること：✓ …`. No hidden identity.
- **Old aggregate card** 「まだ発見できるピザがあるよ」: untouched.

## Files

`src/logic/discovery/hintTarget.ts`, `researchEntry.ts` (label helper), `src/state/discoveryHint.ts`,
`gameReducer.ts`, `src/components/DexOverlay.tsx`, `src/screens/GameScreen.tsx`, `src/App.tsx`; tests
`src/state/gameReducer.researchTarget.test.ts` (new), `src/components/DexOverlay.research.test.tsx`,
`e2e/discovery-research-target.spec.ts` (new).

## Tests

Full vitest 5752 passed / 1 skipped (308 files; +26), `tsc -b`, `oxlint`, `vite build` clean. Chromium E2E
(390×844 + 360×800): new spec 8/8; regression `discovery3-pool2-production`, `discovery-dex-hint`,
`discovery-dex-aggregated`, `discovery-research-dex`, `discovery-hint5-ladder` (390×844) green.

## Human Verification

390×844 / 360×800 Chromium E2E asserts, at each state, no horizontal overflow, the research context inside the
viewport, no hidden recipe identity in the DOM. Screenshots:
`docs/reports/screenshots/discovery-3-research-s3-target/`. No MP4 recorded (S2 precedent: Owner judgement) —
flagged in the PR for the Owner to decide.
