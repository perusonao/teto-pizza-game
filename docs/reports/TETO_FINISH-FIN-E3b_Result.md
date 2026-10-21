# FINISH FIN-E3b — Free Cooking / Research の仕上げ（FINISH）UI（#608 / #294 / #604、本番 OFF 維持）

base `main` `0e5b6f1`（FIN-E3a #607 merge 後）。Owner 指示 2026-10-21。FINISH の Free Cooking は **本番 OFF のまま**（`FREE_COOK_FINISH_PRODUCTION = false`）。
共有 Preview は PR #582 の復元状態のまま（更新しない）。#581（HOLD）・#478・#584 には触れない。E4・本番有効化・実機 HV は対象外。

## Duplicate Gate（2026-10-21）

- open PR 26 件を確認。E3b の対象ファイルと重なるものなし。E3b 専用 Issue は未存在のため **#608** を起票し、claim を記録。
- #478（Draft）は `GameScreen.tsx` / `IngredientTray.tsx` / `roundKind.ts` を触る。E3b は **`IngredientTray.tsx` と `roundKind.ts` を編集せず**、`GameScreen.tsx` は空トレイ文言の 1 か所（2 行）のみ。

## 変更（製品コード 3 ファイル・計 約 25 行）

| ファイル | 内容 |
|---|---|
| `src/logic/prepareDock.ts` | `finishTrayIngredients`: Free Cooking / Research は所持する全 scatter トッピング（カタログ順）。Guided は従来どおり後乗せ要件の食材のみ。`IngredientTray` は元からこの関数を呼ぶため、トレイ側の変更は不要 |
| `src/data/finishHint.ts` | `finishTrayEmptyText`: Guided（従来の失敗警告）と Free（「仕上げにのせられる具材がありません。「完成」で進もう」）の空トレイ文言 |
| `src/screens/GameScreen.tsx` | 空トレイ文言を `finishTrayEmptyText(state.recipe)` に差し替え（2 行） |

6 タブの表示・操作は E3a 以前から実装済みの `MakingStepTabs` / FIN-A〜C の画面をそのまま使う（新規コード不要）。本番 OFF は E3a のゲートのまま。

## 設計メモ

- トレイは Free で所持する全 scatter トッピング（Owner 決定）。**ファミリーフィルタは付けない**（FIN-B の仕様、dock の高さを変えない）。所持が多いと 6 件/ページのページャーで巡る。実機 HV で操作感を確認する項目として残す（下記）。
- Free の空トレイ文言は、Guided の「失敗」警告を使わない。FINISH は Free では任意で、何も置かずに「完成」できる。トレイの内容は後乗せ食材を特定しない（OD-TQ-16）。
- 識別は「完成」まで行われないため、FINISH 画面にはレシピ名・スコアが出ない（E3a のテストと、本 PR の画面・E2E テストで確認）。

## 検証

結果は PR 本文の Final Gate に記載。

- ユニット / 画面: `prepareDock.test.ts`（Free は全 scatter・Guided 不変・レシピ非依存）、`GameScreen.finish.test.tsx`（Free の FINISH 画面: 6 タブ・全トレイ・Free ヒント・レシピ名なし・空トレイ文言・バー）。
- E2E `e2e/free-finish-e3b.spec.ts`（`?freeFinish=on`、dev サーバ = DEV ビルド）: 6 タブがビューポート内、焼成 → 仕上げ → 完成、ピース配置と ↩、焼成失敗でスキップ、全所持トレイのページングとレイアウト（重なりなし・44px・ページスクロールなし）、ホーム離脱の確認ダイアログと次ラウンド、opt-in なし / 不正値（`1` / `off` / 重複）で Free が従来どおり（5 タブ・焼成後すぐ結果）。
- WebKit 390×844 / 360×800 はローカル環境で WebKit を取得できないため CI の結果を正とする（既存の運用どおり）。

## 実機 HV（未実施・別途 Owner 承認）

PR の品質確認後に、Preview での iPhone Safari 実機 HV を Owner 承認のうえ実施する。確認項目: 6 タブの収まり、トレイのページ送り、置く・戻す・完成、焼成失敗時のスキップ、所持が多い場合の操作感（ファミリーフィルタなしで足りるか）、ホーム離脱。
