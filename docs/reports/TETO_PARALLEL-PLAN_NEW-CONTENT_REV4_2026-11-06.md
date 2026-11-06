# 並列開発計画 Rev 4 — Owner 方針の反映（docs-only＋未配線コンポーネント）

2026-11-06、main `ed159e9`（#753 merge 後）。無断 merge・Production ON・共有 Preview 更新・他セッションの claim 変更・カタログ編集・Batch 19 実装は**していません**。

## 0. Owner 方針（Rev 4 の前提）

1. 新工程の第一候補 = **DOUGH_VARIANT**（#577 G5〜G8 は HOLD、設計・検証のみ GO）。
2. 第二候補 = **late／後乗せ**（並行設計）。
3. **追加調理方法の計上は「通常プレイで使用可能」になった時点**。候補は STEAM と FRY。DOUGH_VARIANT は新工程として別管理。
4. Batch 20 = Honey・Walnut・Pesto Noci を優先調査。
5. **Jaccard 例外は原則認めない**。例外が要る候補は Owner 判断待ち。
6. ハーブ 4 種の既存 SVG を再利用、オレガノ 26px を改善、claim 対象ファイルに触れない。
7. #748 解放まではカタログ編集を開始しない。
8. #738 は新 HEAD `78de12a` 基準、旧 HEAD の検証を重複させない。
9. Batch 19 の実装 GO 最終条件を整理。

## 1. 各セッションの成果物（Rev 4）

| 枠 | 成果物 | 状態 |
|---|---|---|
| S2（#772）Batch 20 | `TETO_CONTENT-POOL_B20_HoneyWalnut_Result.md` | 原典・材料・重複・Research ラベル（実コードでの一時測定）まで完了 |
| S6（#773）第一候補 | `TETO_NEW-PROCESS_DOUGH-VARIANT_Design.md` | **訂正あり**（§2）。G5〜G8 の解除条件と検証計画 |
| S6（#773）第二候補 | `TETO_NEW-PROCESS_LATE_Design-Brief.md` | 並行設計の範囲と依存 |
| S3（#417）| `OreganoPileB2`（未配線）・比較画像・テスト、`TETO_HERB-GLYPHS_S3_Result.md` 追記 | 完了（B／B2 は Owner の実寸 HV で選択） |
| S4（#738） | `TETO_STEAM-738_H11_ReHV_Plan.md` §7 | 新 HEAD の Codex は指摘なし、CI 実行中。重複検証はしない |
| S1（カタログ） | — | **未開始**（#748 未解放） |
| S5（FRY F2） | — | HOLD（変化なし） |

## 2. 重要な訂正

- **DOUGH_VARIANT の「9 行」は 7 種類の生地に分かれる。3 値目（piadina）だけで解放されるのは 1 行（新食材 0・READY）**。価値は「N 値への一般化」。詳細は DOUGH-VARIANT 設計 §0。
- **hot-honey-pepperoni は「例外」ではなく集合規則で不可**（既存 `pepperoni` の上位集合）。B20 から除外。

## 3. #748 の release 状況

最新コメントは 6687040558（2026-11-06T14:21Z、解放依頼）のまま。**応答・`released` の投稿なし**。保有セッション（`session_013m8Cb66Bu5f1XXHC2xCiLL`）は IDLE。**カタログ編集は開始していない。** 追加コメントは投稿しない（重複回避）。

## 4. Batch 19 — 実装 GO の最終条件（すべて必須、順序つき）

| # | 条件 | 現状 | 誰が |
|---|---|---|---|
| 1 | #748 の claim が解放されている（保有セッションの `released`、または Owner の失効宣言） | **未** | 保有セッション／Owner |
| 2 | ハーブ配線 PR（`ingredients.ts` の `pieceVisual`＋`IngredientGlyph.tsx`＋`App.css`）が merge されている（Owner 方針: ハーブ統合前の B19 実装は禁止） | **未**（未配線 SVG は完成。B／B2 の選択は Owner HV） | S3（条件 1 の後）→ Owner |
| 3 | 最新 main・open PR・claim の再確認と、B19 用の新 claim（`ingredients.ts`・`recipes.ts` ほか） | 未 | S1 |
| 4 | Owner の明示 GO（Q3） | 未 | Owner |
| 5 | 決定済み事項（Prep Rev 5 の D1〜D9・Q1〜Q4、R2 決定）は再質問しない | 済 | — |
| 6 | 実装 PR の受入: AC-8（正準順 0・非正準は 1 件ずつ承認）・AC-8b・Jaccard 近傍 4 件の固定・step 凍結・HV | 実装時 | S1 |

未決のうち Batch 19 着手前に要るのは **#1・#2・#4**。それ以外（burrata-pizza の将来、非正準差分の承認運用、HV seed、WebKit 間欠の方針）は実装中に決めればよい。

## 5. 実装可能になった数（Rev 4 時点、正直な数）

| 区分 | 食材 | レシピ | 工程・調理方法 |
|---|---|---|---|
| **今すぐ実装可能** | **0** | **0** | **0** |
| 条件（§4 の #1・#2・#4）成立後に実装可能、仕様承認済み | 1（burrata） | 2（B19） | 0 |
| B19 merge＋B20 GO 後に実装可能、例外なし・工程なし | 2（honey・walnut） | 1（pesto-noci） | 0 |
| Owner の製品判断後 | ソース 1 程度 | teriyaki、nashville（ソース決定） | 0 |
| DOUGH_VARIANT の G5〜G8 解除後 | 0 | 1（piadina）、以降 1 値ごとに 1〜3 | 新工程 1（生地の種類、別管理） |
| 調理方法（通常プレイで使用可能になった時点で計上） | — | — | STEAM: #738 merge＋本番 ON の別承認／FRY: F2 以降＋本番 ON。**現在 0** |

## 6. 進捗

**追加食材数 0/8｜追加レシピ数 0/20｜追加調理方法数 0/2（通常プレイ基準）｜新工程（別管理）0｜実装中: #738（新 HEAD `78de12a`、Codex 指摘なし、CI 実行中、Owner 実機 HV 待ち）、#755 系 Draft｜HOLD: Batch 19（#774）、FRY F2、DOUGH_VARIANT 実装（G5〜G8）｜merge 済み（起点以降）: #753（docs、他セッション）**

## 7. 残るブロッカー

1. #748 の claim 未解放 → S1・ハーブ配線・B19・B20 のすべてが停止。
2. ハーブ配線 PR（#1 の後）と B／B2 の選択。
3. Batch 19 の Owner GO。
4. #738 の CI 完了・Owner 実機 HV・merge、その後 STEAM 本番 ON の別承認（調理方法の計上はここ）。
5. DOUGH_VARIANT の G5〜G8（D-P1 チップ設計、D-P4 保存互換、D-P3 工程、原典）。
6. 20 レシピは、例外を認めない方針の下では B19・B20・DOUGH_VARIANT の各値・Owner の製品判断の積み上げでしか届かない。

## 8. 最短 merge 順（更新）

1. #748 解放 → 2. ハーブ配線 PR（S3）→ 3. B19（S1、Owner GO）→ 4. walnut SVG（S3、未配線で先行可）→ 5. B20-A 食材 PR → 6. B20-A レシピ PR → 並行: #738（CI・HV・merge）→ STEAM 本番 ON の別承認／DOUGH_VARIANT の設計（V1〜V3）→ Owner の G5〜G8 判断 → piadina。
