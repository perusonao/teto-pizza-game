# Discovery Hint 5.0 — H5-3 Ladder UI + M3: Result

- **Issue:** #292.
- **Authority:** `docs/design/TETO_DISCOVERY-HINT-5_H5-0_FINAL-DESIGN.md`, rounds 1–5. **OD-H5-M3 = D**
  is recorded in §9.0.
- **Base:** `main` `86b48fd` (unchanged); H5-2 head `abce62a` (approved).

**Scope:** H5-3 only.
- The ladder sheet and M3, all behind the Hint 5.0 flag, which stays **OFF by default in every
  build**.
- **Not changed:**
  - production activation;
  - P4 / P4b / M2 (RESERVED_EMPTY_RUNG is kept exactly);
  - taxonomy families and 62 / 172;
  - TQ-1D, #275, #260 and PR #291 / #293 / #295.

## 1. Changes

| File | Change |
|---|---|
| `src/logic/discovery/hint5Ladder.ts` | **M3.** A rung is COMPLETED only by a Hint 5.0 record: `h5:sauce` / `h5:cheese` / `h5:key` / `h5:structure`, or `cls:<id>` for a sub-topping.<br>Legacy facts never complete a rung. They feed only the request-time `allKnown` check, which is internal and never presented.<br>New outcome `ALREADY_KNOWN`: 0 Pitz, only the completion record appended.<br>The presentation never reads `allKnown`. SUB_CLASS entries appear only after STRUCTURE is completed (a regression caught by G15 and fixed). The archive lists the player's own names minus what the board shows. |
| `src/state/discoveryHint.ts` | Applies `ALREADY_KNOWN` (completion record, Pitz unchanged, `hintOutcome = "HINT5_ALREADY_KNOWN"`) |
| `src/components/HintSheet.tsx` | `Hint5LadderBody`. It renders only when a `hint5` view is passed, i.e. only with the flag ON. With the flag OFF the sheet renders exactly as before. |
| `src/screens/GameScreen.tsx`, `src/App.tsx` | Pass `hint5SheetView(state)` and dispatch `PURCHASE_HINT5_RUNG` |
| `src/App.css` | A small `.hint-sheet__row--h5` / class-chip / next-card block. It reuses the U3-C sheet. |
| `src/logic/discovery/hint5Flag.ts` | Default `false`. A **DEV-only** opt-in, `localStorage["teto.dev.hint5Ladder"] = "1"`, used for E2E and HV. `import.meta.env.DEV` is false in production and Preview builds, so it is compiled out: the production bundle contains 0 references to the key. |
| Tests | Covered in §5 below. |

## 2. M3 = D: final behaviour

| Legacy knowledge of the requested rung | Before the request | At the request |
|---|---|---|
| **ALL** known (e.g. `ing:tomato-sauce` for the sauce rung; `meta:ingredient-total` or the legacy count line for STRUCTURE; `ing:<sub>` or the E3 `attr:family` safe mapping for a sub-topping) | Same as a fresh save: the same next rung, kind, **normal price** and purchasability, and no skip | **0 Pitz**. Only the completion record is appended. 「このヒントはもう知っていたよ！（Pitzは使っていないよ）」 is shown. |
| **PARTIAL** (parmigiana: `ing:mozzarella`, parmigiano unknown) | Same as fresh | **Normal price (10)**, and the whole rung is disclosed (モッツァレラ + パルミジャーノ) |
| **NONE** | Same as fresh | **Normal price** |

**Rules:**
- The balance is checked at the **normal** price before the known check. With less than the
  normal price the request is refused like any other, so a 0-Pitz completion can never be learnt
  without an affordable request.
- Existing facts are never deleted, converted or rewritten. Unknown / future ids are kept.
- Full Reset clears everything, as before.

## 3. FREE LEAK results

The same gates run at three levels: the pure layer, the rendered DOM and E2E.

| Gate | Result |
|---|---|
| G15: before STRUCTURE, every target's offer and board are identical given the same completed rungs | PASS (pure and DOM) |
| **M3 legacy sweep** (pure): each of the 24 targets × every fresh ladder prefix × legacy sets | **PASS**, > 500 comparisons, every one identical to a fresh save.<br>Legacy sets covered:<br>• no facts;<br>• each single Hint 3.0 fact;<br>• all Hint 3.0 facts + `meta:` / `attr:`;<br>• Economy 1.0 levels 1–4. |
| M3 legacy sweep (DOM): every target × 3 legacy sets | PASS: the rendered sheet is byte-identical to a fresh save apart from 「以前のヒント」 |
| L1 / L2 / L3 (parmigiana, hawaiian, capricciosa) | All gone before purchase. No 0 price, no 「知っていた」 and no rung skip before the request. |
| No SUB_CLASS before STRUCTURE | PASS (pure, DOM, E2E) |
| Recipe / ingredient / Technique identity | PASS in the view model (G6), the DOM (all 25 targets × every purchase state: text + every attribute) and E2E (`expectNoUndiscoveredIdentity`) |
| Last rung count / sub-topping count / later rung kinds before purchase | Never shown: E2E checks that no later 「ヒントN:」 is on screen before each purchase |

## 4. AC-1 and classification

- **AC-1 (pure):** every sub-topping of every unblocked target, as the last unclassified one, is
  ANSWERED with its family. This covers the case where the other sub-toppings are known through
  legacy names: they complete for 0 Pitz first, and the last one is still classified.
- **AC-1 (E2E, meat-lovers):**
  - サブトッピング① / ② / ③ each show 🥩 肉系;
  - ベーコン / ペパロニ / ソーセージ never appear;
  - the total spend is 50 (10 + 10 + 10 + 5 + 5 + 5 + 5).
- **A single-candidate family (breakfast-pizza):** egg, the only `other` member, shows as
  「✨ ちょっと変わった材料」. 「たまご」 never appears.
- **RESERVED_EMPTY_RUNG (marinara has no cheese):**
  - 「ヒント2: チーズ 10 Pitz」 is offered like any rung;
  - a tap changes nothing: no Pitz, no fact, no line;
  - nothing says 「チーズなし」, 「ソースなし」 or 「もう知っていた」.

  P4 / P4b are not pre-empted. **Note for H5-4:** the tap gives no feedback, so these 6 targets
  must not be enabled until P4 / P4b are decided.

## 5. Tests

| Suite | Result |
|---|---|
| Hint 5.0 pure (`hint5Ladder`, `.migration`, `hint5Production.gate`, `hint5Taxonomy.gate`) | PASS |
| Reducer (`gameReducer.hint5`, `.flagOff`, `.invalidTaxonomy`) + economy sim | PASS |
| Component `HintSheet.hint5.test.tsx` | 7 / 7 |
| App-level `App.hint5Ladder.test.tsx` | 6 / 6 |
| **Full Vitest** | **225 files · 4599 passed · 1 skipped** (pre-existing) |
| `tsc -b` / `vite build` | clean / OK |
| `oxlint` | 0 errors; the 2 pre-existing warnings (`scoringV2.noSauceProfile.test.ts`) |
| **E2E Chromium** (`iphone-390x844` + `iphone-360x800`): the new `discovery-hint5-ladder` + the existing `discovery-hint-sheet`, `discovery-hint-facts-save`, `discovery-dex-hint` | **22 passed**, 8 skipped. The skips are pre-existing: those specs run once per engine and force the other profiles internally. |
| E2E `layout-contract` (`layout-chromium`, 7 profiles) | 12 / 12 |

**The new E2E, on both viewports:**
- flag-OFF parity;
- the full ladder with AC-1;
- M3 ALL (legacy);
- PARTIAL / NONE (parmigiana);
- the single-candidate classification;
- RESERVED.

**Layout checks at every state:**
- no horizontal overflow;
- the sheet and CTA inside the viewport, and the CTA and 閉じる at least 44 px tall;
- no clipped title, row, chip, fact, CTA, wallet, outcome or guidance.

## 6. Human Verification

**Screenshots** (committed): `docs/reports/screenshots/hint-5-ladder/{390x844,360x800}-*.png`

| # | Shows |
|---|---|
| 00 | Flag OFF: the old sheet, unchanged |
| 01 | Initial offer |
| 02 | After STRUCTURE |
| 03 | Complete: the last sub-topping classified |
| 04 | Legacy save before the request |
| 05 | 「もう知っていた」 after the request |
| 06 | PARTIAL cheese rung |
| 07 | Single-candidate class |

**Videos** (delivered in the session, **not committed**):

| File | Viewport | Duration | Size | Codec |
|---|---|---:|---:|---|
| `hint5-h5-3-hv-390x844.mp4` | 390×844 | 74.3 s | 1,087,930 B | H.264 |
| `hint5-h5-3-hv-360x800.mp4` | 360×800 | 74.8 s | 960,482 B | H.264 |

**Scenarios in the video:**
- A: flag OFF;
- B: meat-lovers, the full ladder to the last classification;
- C: M3 ALL → 「もう知っていた」 at 0 Pitz, then NONE → 10;
- D: PARTIAL;
- E: single-candidate ✨;
- F: RESERVED (the tap does nothing).

States are held about 1.6 s each. **Video Verification: PASS.**
- ffprobe: H.264, 390×844 / 360×800, ~74 s.
- The files decode to the end.
- Frames at 3 / 22 / 36 / 72 s were checked: the ladder, 「サブトッピング② 🥩 肉系」, and
  「このヒントはもう知っていたよ！」 with 所持 200 Pitz unchanged.

**Measurements** (Chromium DEV, top / bottom / height in px):

| State | 390×844 | 360×800 |
|---|---|---|
| Initial | page scrollWidth 390; sheet 604–844; CTA 765–809 (44) | page scrollWidth 360; sheet 560–800; CTA 721–765 (44) |
| After STRUCTURE | sheet 426–844; CTA 765–809 (44) | sheet 382–800; CTA 721–765 (44) |
| Complete | sheet 365–844; no CTA | sheet 321–800; no CTA |
| Legacy, already known | sheet 558–844; CTA 765–809 (44) | sheet 514–800; CTA 721–765 (44) |

- 閉じる is 44 px tall in every state.
- The only element whose scrollWidth exceeds its width is the visually hidden `.sr-only` live
  region, which is 1 px wide by design. **No visible text is clipped.**

**Preview deployment is not applicable** at H5-3. The flag is compiled OFF in every built artifact,
Preview included, and the DEV opt-in exists only on a dev server. So the recordings were made on
the local DEV server. The Owner's iPhone Human Verification on a Preview belongs to H5-4, together
with the production enable decision.

## 7. Notes

- **Archive de-duplication.** Names and the total the ladder itself bought no longer repeat in
  「以前のヒント」 (found in the screenshots, fixed, and tested).
- **Dex-0 Margherita** keeps its existing free onboarding sheet.
- **Invalid taxonomy with the flag ON** falls back to the old sheet, but its purchases are refused.
  The production gates make this unreachable.

## 8. STOP items

| ID | Question | Needed by |
|---|---|---|
| OD-H5-P4 / P4b | Empty fixed rungs: the 6 targets to hold back | H5-4 |
| OD-H5-M2 | Enable 19 targets first, or all 25 | H5-4 |
| H5-4 itself | Production enablement: flag ON for the enabled targets, the Fresh Gate, a Preview, and the Owner's iPhone Human Verification | Owner go |
