# FINISH FIN-E2 — late 軸・後乗せ技法・near-miss の識別実装（本番では不活性、#294 / TQ-2 #604）

base `main` `afb3b7c`（FIN-E1 #605 merge 後）。Owner は 2026-10-21 に D-1〜D-5 を承認。設計は `docs/design/TETO_FIN-E2_LATE-AXIS_DESIGN.md`。
本番レシピ・食材・ladder・UI・reducer・FINISH 工程・save・共有 Preview は無変更。FINISH は本番 OFF のまま（`finishD2Inert.test.ts` 無変更）。

## 変更

| ファイル | 内容 |
|---|---|
| `src/logic/discovery/signature.ts` | `late` 軸を OBSERVED に（raw の `stage === "post"` から `[["POST_BAKE", ids]]`、無ければ `[]`）。`LATE_ADDITION` を supported に。`sanitizeToppings` は `stage` を落とすため使わない |
| `src/data/techniques.ts` | `late-addition`（名称「後乗せ」、なぞかけ・説明は **PLACEHOLDER**、D-4）。要求するレシピが無い間は affordance が開かず Dex に出ない |
| `src/logic/techniques/detection.ts` | used = post ピースあり、required = target の `late` が非空 |
| `src/logic/discovery/nearMiss.ts` / `src/state/resultNearMiss.ts` | late の差を距離 +1、種別 `LATE_ONLY`（内部のみ）。legacy 経路でも汎用行（時機の語なし）。本番 RESULT の中立 1 行は無変更 |
| `src/logic/techniques/nearMissPrivacy.ts` | late 用の答え数（k ≥ 2） |
| `src/logic/discovery/attemptFingerprint.ts` | `late` を attempt 同一性から除外（D-3）。fp1 文字列は不変 |
| tests | `lateAxis.test.ts`（新規 25 件）、canary / gate の更新（下記） |

## Owner 判断の反映

- D-1 strict: 焼成後ピースを含む pizza は late 要件を持たない既存レシピに一致しない（テスト済み）。本番では post ピースを作れないため既存の識別結果は不変。
- D-2: 技法は usage + recipe で発見。affordance / 解禁条件は既存のまま（本番カタログで `late-addition` の affordance は `null`、gate に固定）。
- D-3: 焼成前後は同一 attempt。fingerprint・Notebook の entry / 件数 / retryCount / 直列化に late 情報なし。
- D-4: 仮文言（E4 前に Owner が正式決定）。D-5: near-miss は内部のみ、RESULT 不変。

## 追加検証（Owner 指定 1〜5）

1. **stage 欠落の旧データ**: stage なし / `"pre"` / 不正値（`"POST"`、数値、null 等）はすべて `late = []`。非 object・id 非 string・座標非有限の post 要素は無視。toppings が配列でなければ none。
2. **数量の責務分離**: post 1 / 2 / 5 個で識別（ingredientSet・base・late）は同一、個数は `ingredientCounts` と Completion Gate / Scoring が扱う。1/2 個でも Gate 通過（#215 OD-5）、pre のみは late 要件を満たさず FAILED。
3. **既存回帰**: 全本番 target で識別が E2 前と同一（旧軸に戻した signature と比較）、near-miss も同一、技法発見に `late-addition` が出ない。`sauceB1.singleSource.golden`（550 件）は `signature` ハッシュのみ変わる（late の status）ため、そのハッシュだけ旧 status に戻して比較し、state / scoring / completion / near / free / consume は無変更で一致。
4. **Notebook / Fingerprint**: 同じ組み合わせの前後 → 同一 fp、Notebook は 1 entry（retryCount 1）、`late|post|POST` を含まない。
5. **Hint 5.0 gate**: 変更なし（閾値・sweep とも）。1 行追加のみ（`late-addition` の affordance が `null`）。E4 の再監査条件は設計書 §8。

## 独立レビュー

ブロッカーなし。指摘 4 件のうち 2 件を反映: (1) 仮のなぞかけが「仕上げ／順番」と時機に触れていたため中立化、(2) known レシピで `LATE_ONLY` だけ無言になる非対称を解消（汎用行を返す、テスト追加）。(3) fingerprint 統合で最初の結果が残らないかは、Notebook の仕様 OD-P3-15b（retry は feedback を更新）で確認済み。(4) `lateAxisAnswerCount` は未配線の pure helper（`nearMissPrivacy.ts` の他関数と同じ扱い）として残す。

## 更新した canary / gate（意図的）

`signature.test`（OBSERVED 一覧・capability）、`attemptFingerprint.test` / `.gate.test`、`doughAxis.test`、`techniques*.test`（登録順）、`resultFeedback.gate`（near-miss が読む軸を `late` のみに限定、他の軸・`ingredientCounts` は禁止のまま）、`gameReducer.finish.test`（stage は late 軸だけが読む）、`deductionProduction.gate`（1 行追加）。

## 検証

- `tsc`: エラーなし / `npm run lint`: 既存警告のみ（変更ファイルに新規なし）/ `npm run build`: 成功。
- 全 Vitest: 494 files passed、9127 tests passed（2 skipped, 6 todo は既存）。
- Chromium（iphone-390x844）E2E: discovery-near-miss-result / notebook-n1 / oracle-neutralization / free-cooking-phase3-2 / finish-flow-find / original-result-duplicate-notice / research-result / tq-1d-no-sauce / dex-aggregated / finish-screen-fina — 計 43 件 PASS。WebKit shard は CI で実行。
- Human Verification: 可視変化なしの inert 変更のため動画・スクリーンショットは対象外（POLICY の適用対象外。E3 / E5 で必須）。
