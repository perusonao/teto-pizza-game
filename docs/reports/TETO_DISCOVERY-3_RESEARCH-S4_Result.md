# Discovery 3.0 Research Recipe — S4 RESULT + Notebook + Post-discovery (Result)

Refs #346. Base: `main` `51e14ae14ad08f1fb67059268c53690a3cc1d856` (S1 #347, S2 #348, S3 #349 merged).

## What S4 does

Completes the Research Recipe loop: Research Target -> trial -> ORIGINAL RESULT -> Trial Notebook / Hint -> retry on
the same target -> exact match -> formal DISCOVERED -> state-aware next action.

- **Research ORIGINAL RESULT** (only with a valid Research Target): heading `🧪 オリジナルピザ`, a context line
  `🔎 研究中 ？？？ピザ ①`, lead `まだ新しいレシピは見つかっていません` — one string for ORDINARY / AMBIGUOUS /
  INCOMPLETE_MATCH (DOM byte-identical, pinned). The near/far line is never rendered with a target. No right/wrong,
  ✓/✕, counts, distance, near/far. Buttons: `もう一度試す` / `📓 試作ノート` / `💡 ヒントを見る`, plus the existing
  `レシピを選んで作る`. **Without a Research Target the ORIGINAL card is exactly as before** (copy, near-miss line,
  buttons) — the S0 wording pass stays out of scope.
- **Retry**: `もう一度試す` = `RETRY_SAME_RECIPE`; `researchTargetId` already rides `ProgressionCarry` (S3), so the same
  target is kept, session-only, never saved. HOME's plain `START_FREE_COOK` still clears it. Pinned by reducer tests.
- **Trial Notebook**: opened from the Research RESULT (sheet owned by `GameScreen`, the existing read-only reader; the
  Trial Notebook importer allow-list is **unchanged**). A single `いまの研究対象：🔎 ？？？ピザ` band at the top of the
  sheet; rows are untouched (no target / recipe field per row). Back label `結果にもどる`. Session-only as before.
- **Hint**: the RESULT `ヒント` is the existing retry + `SHOW_HINT`; the S3 Research Target -> Hint path serves it. No new
  authority; attempts add no knowledge (test: facts byte-identical before/after an attempt; only a bought rung changes them).
- **Promotion**: unchanged derivation. Exact match -> `NEW_DISCOVERY` -> the entry leaves the Research section and the
  formal Dex card appears; target A + exact B discovers B (matcher independence); knowledge complete alone never discovers.
- **Post-discovery CTA (OD-RX-4)**: new pure `src/logic/discovery/postDiscoveryPrimary.ts`. Priority: a researchable
  entry remains -> `🔎 次のピザを研究する` (one entry: starts it; 2+: opens the Dex's anonymous Research cards);
  else a NEW Shop material (`newShopMaterialCount`) -> `🛒 新しい食材を見る`; else `📖 図鑑を見る`. It replaces the
  Dex link on the NEW_DISCOVERY registration row. Fixed labels; no count / remaining / completion wording.
- **Old aggregate card「まだ発見できるピザがあるよ」** (Owner-decision slot, OD-RX-1 replaces D-2 for Research Entries):
  now shown only while an aggregated DISCOVERABLE unknown is **not** a Research Entry. Production data: every
  DISCOVERABLE recipe is a registered entry, so the card no longer appears there. It can only disappear — the
  aggregated slots already read as plain unknowns, so no slot, count or existence of an unregistered recipe is newly
  exposed. The single-candidate per-slot 🎨 card (with its Dex `ヒントを見る`) is **unchanged**; that overlap with the
  single Research card is left for an Owner call (it is the Dex's only Hint pin entrance).
- **F-1 (`レシピを選んで作る` name/destination)**: audited, left as is — it goes to Pizza Select, which matches its name.
- **Sticky Hint audit**: `selectHintTarget` honours the Research Target first; the purchased-Hint sticky preference only
  applies with no target. No responsibility clash, so S4 does not touch it.

## Files

`src/logic/discovery/postDiscoveryPrimary.ts` (+test), `src/state/discoveryHint.ts` (`researchableEntryIds`),
`src/components/ResultPanel.tsx`, `TrialNotebookSheet.tsx`, `trialNotebookCopy.ts`, `DexOverlay.tsx`,
`src/screens/GameScreen.tsx`, `src/App.tsx`, `src/App.css`; tests `gameReducer.researchLoop.test.ts`,
`ResultPanel.research.test.tsx` (new), updated aggregate-card pins (`DexOverlay.hint/discovery`, `App.dexHint`,
`discoveryHint.pool.production26`), `trialRecord.gate.test.ts` (one hoisted notebook read; allow-lists unchanged);
E2E `discovery-research-result.spec.ts` (new), `discovery3-pool2-production`, `discovery-dex-aggregated` updated.

## Persistence / privacy

No save schema bump, no new persistent field; Research Target and Notebook session-only; Hint knowledge = existing
`discoveryHintFacts`; entries derived from ownership. Reload test: facts kept, entry re-derived, target not restored.
No boundary guard was relaxed (the one `trialRecord.gate` pin edit reflects hoisting the single read-only notebook
relay in `GameScreen`; the allowed-file lists are identical). New attributes (`data-research-context`,
`data-trial-research`) carry no identity.

## Tests

vitest 5783 passed / 1 skipped (311 files; +31), `tsc -b` clean, `oxlint` no new warnings. Chromium 390×844 + 360×800
E2E: new spec 2/2; regression set (research-dex/target, dex-hint, hint5-ladder, no27, notebook-n1, oracle-neutralization,
near-miss-result, free-cooking-phase3-2, discovery-ladder, onboarding, duplicate-notice, ip1, hint-sheet, pool2,
dex-aggregated) 84 passed / 18 skipped by design. WebKit left to CI.

## Human Verification

390×844 / 360×800 E2E assert no horizontal overflow, CTAs inside the viewport, no oracle wording and no hidden identity
at each state. Screenshots: `docs/reports/screenshots/discovery-3-research-s4-result/`. No MP4 (static/E2E covers it).
