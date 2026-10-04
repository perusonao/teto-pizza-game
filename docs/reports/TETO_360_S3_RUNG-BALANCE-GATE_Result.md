# #360 S3 — effective-cost-0 rung balance gate (Result)

- Base: `191635522f524d60693689b1c66a5de0c142fa91` (main, S2 merged). Authority: `TETO_360_HINT5-KNOWLEDGE-DUPLICATION_Fresh-Audit.md` OD-360-3 + Owner Decisions OD-360-S3-1..3.
- Goal (one only): a **fully known** rung (effective cost 0) completes even when wallet < normal price. Partly known / unknown paid rungs are not made free.

## Fresh Audit (pre-implementation) -> minimal change

| Gate | Before | After |
|---|---|---|
| Reducer authority `requestHint5Rung` (`src/logic/discovery/hint5Ladder.ts`) | `balance < normal price` -> `INSUFFICIENT_PITZ` for every rung, before the already-known check | the price/balance check is skipped only when `own.allKnown[rung]` (never for a RESERVED empty rung, whose `allKnown` is false); order otherwise unchanged (target -> STALE -> complete -> price -> empty -> already known -> answer) |
| Knowledge authority (OD-360-S3-2) | `requestHint5RungFact`: stored facts + `derivedUnlockFactIds` | **unchanged**; no knowledge logic added to `hint5SheetView` / `hint5Presentation` / UI |
| UI gate (`HintSheet.tsx`, Hint 5.0 ladder branch only) | CTA `disabled={!next.affordable}` + `--short` class + permanent shortage note | CTA never disabled by balance; no `--short` class; shortage note shown **only after a refused tap on that rung** (local state keyed by rung index; ignored while latched) |
| `affordable` field in the presentation | `balance >= price` | **unchanged** (sims and other consumers untouched; only the ladder CTA stopped reading it as a disable gate) |
| Hint 3.0 SELECTABLE / TARGET / deduction purchase paths | own `affordable` gates | **untouched** (verified: their CTA lines are not in the diff) |

Duplicate Gate: no S3 issue/PR/branch existed; no prior effective-cost-0 gate in code.

### Presentation proposal (OD-360-S3-3), implemented minimally
- Pre-purchase: no new copy, price, order, badge or style difference by hidden knowledge (CTA stays 「たずねる N Pitz」 in the normal paid style; the old grey `--short` style would look disabled while tappable, so it is not used on the ladder CTA).
- After a refused tap: existing `shortNote`, now `role="status"`. The earlier 「このヒントはもう知っていたよ！」 line (and its live-region text) is hidden while the shortage note is shown, because it described the rung completed before and would read as if the refused rung were known.
- Accepted per OD-360-S3-1: a tap at low balance reveals whether the rung was effective-cost-0. Nothing more (no content, closure, role, count).

## Unchanged (verified by diff + tests)
Ladder order, normal prices, CHEESE closure, Contract 2.1, K=3, persistence / save / schema, provenance, recipe / ingredient data, #377, #378, HAND, Expansion Slice 1, SAUCE auto-skip / pre-mark, dynamic ladder. Onboarding-free path (`requestHint5RungFact` returns null) unchanged.

## Tests
- New `hint5Ladder.effectiveCostZero.test.ts`: fully-known SAUCE / CHEESE / KEY at wallet 0, balance just below price, non-finite balance; partially-known CHEESE and unknown rungs refused (no facts, no charge); sufficient balance unchanged; onboarding; legacy KEY (empty KEY never known; empty CHEESE not freed by stored name / total); key-free fixture; pre-purchase presentation identical for known vs unknown vs partial at every balance.
- `gameReducer.hint5.test.ts`: wallet-0 SAUCE+CHEESE complete (charge 0, ledger gets only completion records), unknown KEY refused with the same state object, partial refused, paid path unchanged.
- `gameReducer.researchTarget.test.ts`: unlock-derived fully known rung completes at wallet 0 (no `ing:` name written); without a Research Target the same request is refused.
- `App.hint5Ladder.test.tsx`: CTA tappable at low balance, note only after refusal, known -> 0 Pitz -> next rung, unknown refused with save untouched, known vs unknown CTA identical before any tap.
- Updated to the new contract: `hint5Ladder.migration.test.ts` (2 assertions), `e2e/hint5-preview.spec.ts` `hv=low-pitz` (passes, 390×844).
- Full suite: **336 files / 6058 passed, 1 skipped**. `tsc -b` + `vite build` OK. `oxlint`: only the 2 pre-existing warnings in `scoringV2.noSauceProfile.test.ts`.

## Human Verification (390×844)
Evidence type: seeded saves (wallet 0; facts `ing:tomato-sauce` on breakfast-pizza; `h5:sauce` + `ing:mozzarella` on parmigiana-pizza). Not real RESULT ○ operations. Screenshots (before = main `1916355`, after = this branch): `docs/reports/screenshots/360-s3-rung-balance-gate/`. No horizontal overflow in any state.
- Before: CTA disabled at wallet 0, shortage note always shown.
- After, known SAUCE: opened (CTA enabled, no note) -> tap -> 「もう知っていた」, balance 0 unchanged, ladder advances to ヒント2: チーズ -> tap (unknown) -> shortage note only, no completion, balance 0.
- After, partially known CHEESE: opened (enabled, no note) -> tap -> shortage note, still ヒント2, balance 0.

Video `360-s3-rung-balance-gate-390x844.mp4`: H.264, 390×844, 14.6 s, 244 KB; delivered directly, not committed. Video Verification: PASS

## Status
MERGED (PR #387, `78f4114` on `main`). #360 S1–S3 are all merged (#385 / #386 / #387).
