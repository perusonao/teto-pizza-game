# 5 タスク並行作業 Result（2026-10-30、docs-only）

基準 main: `51c24bda1bc5bbf23f8e086a6fac402b73981a36`（#701。再取得で最新 main と一致を確認）。コード・Preview・Production・workflow の変更なし。

## A. 本番デプロイ（READ-ONLY）
- `Deploy to GitHub Pages`（run 41043822091、#479）: **success**（10:51:35Z → 10:52:58Z、head = 51c24bd）。
- `Firebase Production Deploy` は手動 dispatch のみ（最終 2026-09-21）。#701 では走らない設計で正常。
- `E2E WebKit` run 41043822065: classify / layout-chromium / Layout Contract Gate は success。**WebKit 6 シャードは取得時点で in_progress（未完了）**。結論は未確定。
- 本番 URL の実フェッチ（サーモン・クリームチーズ SVG の公開確認）は、この環境のプロキシが github.io を 403 で遮断したため**未確認**。回避はしていない。Owner の iPhone 画像で描画は確認済み（#703 本文）。
- 再実行・変更なし。

## B. PR #702
- docs-only 1 ファイル、`mergeable_state: clean`、チェックは全て success/skipped（WebKit Gate・Layout Contract Gate 含む）、Codex 完了・指摘なし、review thread 0。
- 方針 8 項目はすべて文書に反映済み。既存の HV Policy / Session Operations を上書きしない旨も明記。
- 指摘（提案のみ）: ① 現行 HV Policy は 390×844 を主 viewport とし動画を MP4 で直接提出と定める。#702 の「360×800 も原則」は追加要件になるため、Policy 本体を改訂するまでは「推奨」と読むことを明記すると安全。② 「Claude Code Cloud で WebKit」は実機 WebKitGTK/Playwright WebKit であり iPhone Safari ではない点が既に書かれているが、Result Report のテンプレに「WebKit = Playwright WebKit」と書く欄を足すとよい。③ HV Policy の DoD への参照リンクを 1 行追加。いずれも merge を妨げない。**merge していない。**

## C. #703 クリームチーズ（比較のみ）
- 保存先: `docs/reports/screenshots/pilot-d2-cream-cheese/`
  - `cream-cheese_C0-C1-C3_dark-and-white-cheeses.png`（暗い背景・トマト・トレイ・グレースケール × 20/24/28/29px、feta / ricotta / mozzarella 並置）
  - `cream-cheese_phone-width.png`（390px 幅表示）
  - `compare_cream-cheese_20-24-28-result.png`（既存。通常/焼き過ぎ/トレイ/グレースケール。調査ブランチ `claude/teto-ingredient-visual-audit-a401jy` から再利用）
  - 候補 SVG と sheet.html（再生成用）
- 所見（画像に基づく私の判定。Owner の判定ではない）: C1 は 20px でも上半分が温かい白、下半分が銀として読め、feta（角切り）・ricotta（山）・mozzarella（丸）と輪郭で区別できる。暗い背景では C0 の青銀が沈むのに対し C1 の白い上面が残る。C3 は缶感は消えるがトレイのクリーム背景で地との差が小さい。推奨は従来どおり C1。
- 未実施: 実ゲーム画面（ピザ上のドラッグ・焼き過ぎ実描画）での撮影。本番コードを変えない制約のため、SVG 単体の比較に留めている。
- **形・色の変更は Style Lock §1c により Owner 承認が必要。実装していない。**

## D. #527 frango-catupiry / spanish-chorizo-pizza — **前提が古い（既に実装済み）**
main `51c24bd` で確認:
- 両レシピとも `src/data/recipes.ts` に存在（Batch 8a、No.58-60 の一部）。NO_SAUCE（`recipeSauceProfiles` = null）、`lunchRush:false`、CUT なし、key-free、bake 56-76、orders / discoveryCatalog / recipeHintRoles にも登録済み。
- chorizo = 既存 `sausage`、新規材料 0。chorizo は `ladderCredit:false`、frango は #561 で `ladderCredit` が true に変更済み（credited 化）。
- #527 本文の D1〜D6 のうち、実装範囲は Batch 8a/8b（shirasu + shiso/whitebait、No.61）で消化済み。8c は #627 に置換（PROJECT_HANDOFF 参照）。
- 結論: **追加実装は不要。** #527 の本文は 57→59 計画のままで古い。Issue の整理（クローズまたは更新）は Owner 判断。不明点: 原典 pizzadb.jp の食材一致（D4）はこの環境から確認不可のまま。

## E. #578 新ソース 4 種 — **データ実装は既に完了**
- `fromage-blanc-sauce`: flammkuchen（#634、通常 ladder step 55）。
- `miso-sauce`: eggplant-dengaku-pizza（#669、late catalog、+ white-sesame 後乗せ）。
- `yuzu-kosho`: yuzu-shrimp-pizza（#662、late catalog、+ shiso 後乗せ）。
- `tahini`: eggplant-tahini-pizza（#673、late catalog、+ pomegranate 後乗せ）。色は #665 / #673 で Owner 決定済み。
- 4 種とも既存 PAINT のみで、`RecipeSauceProfile.ingredientId` の union に追加済み、`LATE_ENTITLEMENT_FLOORS` に 58-60 の下限あり。独立 PR で入っており、推奨順（Flammkuchen→味噌→柚子胡椒→タヒニ）とは順序が異なる（柚子胡椒が先）が問題は報告されていない。
- 残: 原典（pizzadb.jp）未確認の暫定仕様（個数・焼成窓・色・タイミング）の確定は Owner HV 次第。本番で late catalog が ON かは本調査では未確認（`lateCatalogEnabled()` の本番値を要確認）。
- 結論: 設計調査の対象は実装済み。新規実装は不要。#578 の残タスク（原典確認、Issue 整理）は Owner 判断。

## 競合・claim
- #578: U3 claim（session `01Dzqcs…`、#673）は 2026-11-02 まで有効（代理 release 対象外）。他の B-1/U1/U2 は release 済み。今回これらのファイルは触れていない。
- #703: 新規 claim なし。#468 は HOLD 維持。
