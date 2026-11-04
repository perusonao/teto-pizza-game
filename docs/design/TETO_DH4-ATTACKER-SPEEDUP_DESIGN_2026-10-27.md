# DH4「独立攻撃者」テストの高速化 — 原因調査と設計（docs-only）

Status: 調査と設計のみ。`src/**`・テスト・assertion・timeout・PR・merge・Monitor・GitHub 書き込みは無し。基準 `origin/main` = `f243c52`。
測定はリポジトリ外の使い捨てコピー（main を展開）で、`deductionProduction.gate.test.ts` の該当 1 テストを単独実行（Node の inspector で CPU profile）。サンドボックスの速度であり CI の絶対値ではない。**以下の「実験」は設計の裏付けで、実装案そのものではない。**

## 1. 遅い処理の内訳（main、1 テスト 95.5 秒の CPU）

状態数は約 3,500（ladder + 全所持 + 乱数順 40 シード×2）。各状態で `endgameAttack` が候補 x（最大 ~77）ごとに `observe` を呼び、1 回の `observe` は `guardedAnswerForParts` + `toppingClauseAllowedForParts`。

| 区分 | 包含時間 | 内容 |
|---|---|---|
| `endgameAttack` → `observe` | 87 / 95.5 秒 | 攻撃者側の自前コードは 4 秒程度。**時間のほぼ全部が製品側 guard の純関数** |
| `hypotheticalReserves`（H の計算） | 50.7 秒 | 1 回の observe で 3〜4 回、**全部同じ引数・同じ結果**（H は x に依存しない） |
| `partitionAllowsDh41` の内側ループ | 47.2 秒 | H の各要素ごとに `attributeAnswerForReserve` → `ownedCatalogIds` を**毎回**再検証（20.2 秒） |
| `ingredientKeyStep`（→ `recipeKeyStep` → `materialLadderStep`） | 19.2 秒 | 食材 1 つの key step を毎回 ladder の線形探索で再計算（結果は食材ごとに不変） |
| `byCatalogOrder` | 12.8 秒 | H を作るたびに Map 参照付き sort |
| `ingredientCategory` | 7.9 秒 | 上記の下請け |

計算量は「状態 × 候補 x × H × owned」。食材・レシピが増えると 2 乗〜3 乗で増える（PR-2 仮データで +25 秒＝91→117 秒）。

## 2. 改善案（検証内容・探索範囲・assertion は不変）

すべて**同じ入力に同じ出力を返す純関数の最適化**で、テストの assertion・状態集合・timeout には触れない。

| # | 案 | 実験での短縮（累積、main 単独実行） | 備考 |
|---|---|---|---|
| A | `ingredientKeyStep` を食材 id で表引き（カタログ・ladder 由来の定数表。`ingredientCategory` の索引と同じ「INGREDIENTS の長さが変わったら作り直す」方式） | 95.5 → 62.1 秒 | guard の結果は保持しない（カタログ由来の定数のみ） |
| B | `partitionAllowsDh41` で `ownedCatalogIds(prefix)` を**ループの外で 1 回**だけ検証し、検証済みリストを受ける内部関数へ渡す（`attributeAnswerForReserve` の公開 API は不変） | 62.1 → 39.9 秒（実験は WeakMap 版） | **実験の WeakMap は配列の同一性キーで可変配列に危険。実装は hoist 版にする**（コメント「call 間で保持しない」を守る） |
| C | `byCatalogOrder` を sort でなく「カタログ順の id 配列を Set でフィルタ」に（カタログ外 id は従来の sort にフォールバックし挙動同一） | 39.9 → 28.9 秒 | 長さ変更時の再構築を A と同様に持つ |
| D（未実験） | `guardedAnswerForParts` / `toppingClauseAllowedForParts` 内で H を**1 呼び出しにつき 1 回**だけ計算し内部関数へ渡す | 追加で 20〜30% 見込み（H 計算は 50 秒中 3〜4 重） | call 間キャッシュではなく引数渡し。公開関数のシグネチャは不変 |
| E（任意・未実験） | テスト側で攻撃入力が同値な状態を畳む（`owned: all` とその「最短接頭辞」は、guard も攻撃者も接頭辞までしか読まず、onset 絞り込み後の universe が同一） | 状態数の最大約半分 | **探索の等価類は保つが「状態数」は変わる**ため Owner が許容するか確認が要る。A〜D で足りるなら不要 |

実験の合計: A+B+C で **95.5 → 28.9 秒（−70%）**。同じ変更で `deductionProduction.gate` と `deductionGuard.gate` の全 30 テストが通過（並列実行時: 独立攻撃者 30.4 秒、`deductionGuard.gate` の最重 3 本は 29.7 / 26.4 / 17.6 秒。基準は 112 / 90 / 87 / 52 秒）。関連 6 ファイル 68 件も通過。
PR-2 の仮データ（4 レシピ・7 食材）は基準で +28%（91.5→117.1）だったので、A〜C 後は **約 37 秒（timeout の 31%）**、D を足せばさらに下がる見込み。PR-1 の追加分も吸収できる。

## 3. 検証の維持（正しさの担保）

- 出力同一性: 変更前後で、`GATE_STATES` 全件について `guardedAnswerForParts` / `toppingClauseAllowedForParts` / `hypotheticalReserves` / `endgameAttack` の結果を**全件比較する一回限りの差分スクリプト**（テストには足さない）。さらに `byCatalogOrder` 新旧の同値を、カタログ内 id・重複・カタログ外 id で単体確認。
- 感度: guard の判定を意図的に壊した変異（既存の mutation 手順）で、テストが落ちること。
- 既存の privacy assertion・シード・状態集合・`SWEEP_TIMEOUT_MS` は触らない。
- 製品コード（`deductionGuard.ts` / `deductionHint.ts` / `recipeChapters.ts` の周辺）を触るので、DH4 の実装契約（OD-DH4-2、「call 間で結果を保持しない」）を守る点を PR 本文で明記し、変更は**純関数の内部最適化だけ**とする。実行時の挙動はバイト同一であるべきで、ヒント生成の経路にも効く（高速化は副作用として実機にも有益）。

## 4. #684 との干渉

#684（`d8335cf`、2 ファイル +139、テスト追加のみ）は `deductionProduction.gate.test.ts` の**末尾に describe を追加**し、設計 doc を足すだけ。本案は**製品コード側**の最適化で、そのテストファイルは変更しない。テキスト競合なし、順序依存なし。
ただし #684 の全探索テストも `hypotheticalReserves` / guard を大量に呼ぶため、本案の高速化の恩恵を受ける（追加 3 テストの実行時間は未計測）。#684 は pin の方式を変えるだけで速度には寄与しない。重複実装は無い。

## 5. 実装開始条件

1. Owner が案 A〜D（E は任意）の採用と、製品コード側の純関数最適化を許可する（DH4 の guard に触れるため）。
2. 実装は別 PR（PR-2 より前）。PR-2 の claim・`lateCatalog.ts` とは触るファイルが重ならない（`deductionGuard.ts` / `deductionHint.ts` / `recipeChapters.ts` 周辺）。HOT ファイルでない。
3. 着手前に claim を投稿（GitHub 書き込みは Owner の承認後）。#684 の merge は必須でないが、取り込めば全探索テストでも効果を確認できる。
4. 受け入れ: §3 の全件比較が一致、`deductionProduction.gate` / `deductionGuard.gate` / 関連 6 ファイルが通過、独立攻撃者テストが main 単独実行で 40 秒以内。timeout・retry・skip・assertion は変更しない。

## 6. 未確認

CI 上の実測（WebKit/Chromium ではなく Vitest のみだが runner 速度は未測定）、D・E の効果、PR-2 の実データでの再測定、全体 Vitest への影響、`deductionGuard.gate` の最重テスト（28.9 秒の実験時点）の内訳詳細。
