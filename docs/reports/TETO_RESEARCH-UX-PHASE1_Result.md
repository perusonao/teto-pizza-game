# Discovery 3.0 Research Flow UX Phase 1 (Result)

Base: main `c62db170df02e87bf78bf952a146f0cc872ee666` (after #389; Deploy #279 and post-merge WebKit #530 both success).
Scope (Owner-approved, O-1..O-4): P1-a PREPARE guidance, P1-b Hint sheet label, P1-c PREPARE 📓 試作ノート, P1-e Research RESULT copy, P1-f 2+ entry label.

## Production changes
- `src/components/researchUxCopy.ts` (new): the fixed copy (target/outcome independent; no count, recipe, ingredient or 「なし」 wording).
- `src/screens/GameScreen.tsx`: research card shows the guidance (valid at start: 「材料を足して試そう。焼くと使った材料の○×がわかるよ」; `researchTargetValidAtStart=false`: 「試作ノートを見て、次に試す材料を考えよう」) and a 「📓 試作ノート」 button in the card's right slot (no extra row). It opens the existing `TrialNotebookSheet` (UI-only `useState`, focus returns to the button, cooking input paused while open). The Hint sheet gets the public label.
- `src/components/HintSheet.tsx`: optional `researchLabelJa` -> one line 「🔎 研究中 ？？？ピザ ①」 (also passed to its embedded notebook).
- `src/components/ResultPanel.tsx`: Research ORIGINAL note = 「試作結果とノートを見て、次に試す材料を考えてみよう。」; targetless / normal FREE keep the Dex-match sentence.
- `src/logic/discovery/postDiscoveryPrimary.ts`: label only — 2+ researchable entries read 「🔎 次のピザを選んで研究する」; exactly one keeps 「🔎 次のピザを研究する」. kind / routing unchanged.
- `src/App.css`: `.order-card__notebook`, `.hint-sheet__research`.

State / schema: none (no reducer, persistence, save, matcher change; UI-local state only). Stock-blocked CTA, P1-d, ALREADY_DISCOVERED context deferred (Phase 2).

## Measurements (Chromium)
Research card height 75px at both viewports (budget 80); pizza `.pizza-dough` 290px @390×844 and 274px @360×800 = the width-driven size (not shrunk); notebook CTA ≥ 44px; guidance, 試作ノート, ヒント, 焼く！/次へ all inside the viewport; no horizontal overflow.

## HV evidence
Screenshots: `docs/reports/screenshots/research-ux-phase1/` (before-* from main `c62db17`, after-* from this branch, 390×844 and 360×800). Video (390×844, H.264) delivered directly, not committed.
