# #360 S2 — Hint sheet archive wording (Result)

- Base: `63426a0b1fc2a9b7b39478b5e4f2de719cb15e0d` (S1 merge). Authority: `TETO_360_HINT5-KNOWLEDGE-DUPLICATION_Fresh-Audit.md` OD-360-1..6.
- Scope: presentation copy only (`HINT5_COPY` in `src/components/HintSheet.tsx`). No reducer / persistence / save / ladder / price / Contract 2.1 change. S3 not touched.

## Fresh UI finding

- **Archive** (Hint 5.0 sheet, `.hint-sheet__legacy`): listed every stored `ing:` name not yet on the board under 「以前のヒント／前のヒント方式でわかっていたこと」, which wrongly asserted a Hint-system origin for RESULT ○ names. Now 「これまでにわかったこと／すでにわかっていたこと（そのまま残してあるよ）」 (OD-360-2, source-neutral).
- **Board duplication**: `hint5Presentation` already drops from the archive every name a completed name rung shows on the board (`legacyKnownIngredientIds` vs `onBoard`), and `HintSheet` drops archive lines equal to the STRUCTURE line. The remaining overlap (Research / Dex card ↔ a completed `キートッピング：…` row) is across surfaces and the board row is the player's purchase / completion record; hiding it would lose that history (STOP condition), so it is left as is. Net: no further board change was warranted.
- The flag-OFF Hint 3.0/4.0 sheet keeps 「以前のヒント／前のヒント方式で買ったメモ」: those are genuinely bought legacy lines (accurate), out of scope.

## Tests

`HintSheet.hint5.test.tsx` new block (RESULT ○ stored fact, Hint-bought fact, unlock-derived `h5:key` only, legacy KEY vs key-free, wording, fresh-save-identical offer/price); `App.hint5Ladder.test.tsx` updated. Full suite 6033 passed.

## Human Verification Videos

390×844, seeded save (meat-lovers, `ing:` facts only = persisted RESULT ○), before/after screenshots in `docs/reports/screenshots/360-s2-hint-archive-wording/`. Video `360-s2-hint-archive-wording-390x844.mp4` (H.264, 9.4 s, 175 KB) delivered directly, not committed: sheet open → archive wording → ask SAUCE (0 Pitz, balance 300 unchanged, ladder advances to ヒント2) . No horizontal overflow; price/order unchanged.

Video Verification: PASS
