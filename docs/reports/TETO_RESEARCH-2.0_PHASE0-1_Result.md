# Research 2.0 Phase 0 + Phase 1 — Stable Research Identity (D+ Cohort Letter) — Result

- Issue: #400. Base main: `d144f0890a881e766da23bb788743863dfccea87` (#398 TQ-1D, Production HV PASS).
- Scope: **Phase 0 (docs authority) + Phase 1 (Stable Research Identity) only.** Phase 2 (×ledger), Phase 3 (Board UI) and Phase 4 (FAILED behavior) are NOT started.
- Authority: [`docs/decisions/TETO_RESEARCH-2.0_OWNER-DECISIONS.md`](../decisions/TETO_RESEARCH-2.0_OWNER-DECISIONS.md).

## 1. Phase 0 (docs)
- New `docs/decisions/TETO_RESEARCH-2.0_OWNER-DECISIONS.md`: OD-R2-1..5, OD-R1-1..4, OD-R3-1..3, OD-C-1; the D+ Cohort Letter contract; the **catalog-local stability** contract (not a permanent ID; Fresh Gate re-audit before 53 / 172; no save mapping); INV-B1..B9 for Phases 2–4 (INV-B7 is the Phase 1 gate); the contradiction audit against Contract 2.1 / OD-RB-7 / OD-RB-14 / INV-D2 / INV-D6 / OD-P3-16 / §14 Non-Goals.
- `docs/decisions/TETO_ANTI-ORACLE-CONTRACT_2.1.md`: a sync note + the §3 / §7 label examples updated (OD-RB-14 kept; the label is now `？？？ピザ [letter]（unlock）`). **§6 (× is session-only) is unchanged and remains the current behavior until Phase 2.**
- `docs/PROJECT_HANDOFF.md`: addendum 5.
- Contradictions: none beyond the explicit supersessions listed in the decision doc §6.

## 2. Phase 1 (code)
- `src/logic/discovery/researchEntry.ts`: `researchLetter` (A..Z, AA, AB ...), `researchCohortLetters` (cohort = recipes whose last-acquired finite ingredient is the same, computed from ownership only, **discovered siblings kept**; ordered by the existing `opaqueHash(recipeId)` then id), `ResearchEntry.cohortLetter`, and the single label authority `researchEntryLabel(entry)`. The ①②③ marks and the index/count label are removed.
- `src/state/discoveryHint.ts`: `ResearchEntryView.label` and `researchAttemptContext().labelJa` both come from `researchEntryLabel` (no recomposition; the Notebook stores the same string as before, byte for byte — OD-RB-14).
- `src/components/ResearchLabel.tsx` (+ one CSS rule): presentation only. The label text is unchanged; each part (`？？？ピザ B` / `（たまねぎ）`) is unbreakable so a narrow card wraps between the parts instead of inside 「たまねぎ」. Used by PREPARE, the Hint sheet, RESULT and the Notebook header. No new text, attribute or id.
- **No** save / schema change, **no** reducer change, **no** new state; nothing is persisted.

## 3. Required cases
| Case | Result |
|---|---|
| step 12 | A = Aussie, B = Brazilian Calabresa, C = Pizza Portuguesa（all `（たまねぎ）`） |
| B discovered first | A → A, C → C; the earlier Notebook B line stays B and aliases no current entry |
| A discovered first | B → B, C → C |
| step 28 | A = Ratatouille Pizza, B = Pesto Vegetariana（`（ズッキーニ）`）；after A is discovered B stays B |
| reload re-derivation | byte-identical labels from the save alone (unit + E2E reload) |
| 26+ siblings | Z → AA → AB (synthetic 28-sibling catalog); letters unique |
| single cohort | letterless `？？？ピザ（チキン）` |
| new cohort later | existing labels unchanged |

**Observed consequence of OD-R2-3 (expected, not a defect):** Aussie as the *lone remaining* step-12 entry (the other two found) is labelled `？？？ピザ A（たまねぎ）`, not letterless — a discovered sibling keeps its slot. The TQ-1D E2E was updated accordingly.

## 4. Privacy (INV-B7 — mandatory Phase 1 gate)
The label carries only the unlock ingredient (already the card's first known fact) and the cohort letter. Tested: no recipe name / id, No.xx, cohort size, hash value, count or circled number in the label, the Dex research section DOM / aria, the RESULT / PREPARE / Hint / Notebook DOM (`expectNoUndiscoveredIdentity` sweeps at both widths). An unregistrable sibling is never counted, so a lone entry never shows a letter because of a recipe it cannot see. Technique privacy, INV-D7 and OD-TQ1D-4 are untouched (the full TQ-1D E2E passes unchanged apart from the label strings).

## 5. Tests
- New unit: `researchCohortLetter.test.ts` (21: letters, grouping, stable sort, step 12 / 28, sibling discovery in every order, no slot reuse, reload re-derivation, Z/AA/AB, label format, INV-B7), `gameReducer.researchStableIdentity.test.ts` (3: PREPARE / RESULT / Notebook share one label; B discovered live → A / C unchanged and the stored B line aliases nothing), `DexOverlay.researchIdentity.test.tsx` (4: cards + DOM / aria scan).
- Existing assertions were **not weakened**: only the retired ①②③ expectations (and the bare 「？？？ピザ」 for a now-always-suffixed label) were intentionally moved to the new authority; every other assertion (privacy regexes, counts, ordering, routing, Hint, Notebook rows) is unchanged. One privacy regex that named `チキン` was split: the label may now contain the *unlock* ingredient (public), while recipe name / id / digits stay forbidden, and the test additionally pins the exact label.
- Full vitest: **352 files / 6293 passed / 1 skipped** (0 failed). `oxlint` (only the existing `noSauceProfile` warnings), `tsc -b`, `vite build`: clean.
- New E2E `e2e/research-stable-identity.spec.ts` (Chromium **390×844 and 360×800**, 4 tests × 2): Dex A / B / C, PREPARE / Hint / RESULT / Notebook all say B, label fits its card and no part breaks, reload, B discovered → A / C, step 28, single cohort, no ①②③. 8 / 8 pass.
- Existing Research E2E (discovery*, discovery3*, research*, hint5*, tq-1d, contract-2-1, expansion*, home-research, lc-hand-pin-ui, original-result): both widths, 200 tests, all pass after the intentional label updates (18 skips are the existing 390-only specs on the 360 project).

## 6. Mobile Human Verification (390×844 authority, 360×800 secondary)
- Screenshots (committed): `docs/reports/screenshots/research-2-0-stable-identity/{before,after}/` — Dex step 12 A/B/C (before: ①②③), PREPARE B, Hint B, RESULT B, Notebook B, Dex with B discovered (A / C), Dex step 28 A/B and after A. 360×800: `？？？ピザ B（たまねぎ）` wraps cleanly between `？？？ピザ B` and `（たまねぎ）` (before the `ResearchLabel` fix it broke inside 「たまねぎ」, caught by this HV).
- Video (NOT committed; delivered directly to the Owner in the session): `research-2.0-phase1-hv-390x844.mp4`, 390×844, H.264, 43.5 s, 888 KB. Covers step 12 Dex A/B/C → pick B → PREPARE → Hint → a trial → RESULT → Notebook → B discovered (A / C unchanged, reload-stable) → step 28 A/B → A discovered, B stays B.
- Video Verification: PASS (file exists, size > 0, ffprobe H.264 390×844, a frame at 20 s shows the RESULT with `研究中 ？？？ピザ B（たまねぎ）`).

## 7. Risks (carried)
- **Catalog-local only**: adding a recipe to an existing cohort (53 / 172) can change that cohort's letters. Re-audit at a Fresh Gate before those populations; no save mapping may be added.
- The letter order is the anonymous hash order, so `A = Aussie` at step 12 is stable lore for every player (same as the old ①).
- Phase 2–4 are approved only as direction; each needs its own Gate on the then-current main.
