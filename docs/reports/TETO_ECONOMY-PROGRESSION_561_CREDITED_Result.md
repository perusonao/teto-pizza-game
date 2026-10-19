# Issue #561 — frango-catupiry を credited 化（星ゲート波及の解消）

Base: `main` `c99bd8d`。Owner 指示により採用案 = **`frango-catupiry` の `ladderCredit` を false → true の 1 件のみ**。

## 変更
| 区分 | 内容 |
|---|---|
| Production | `src/data/recipes.ts`: `frango-catupiry` から `ladderCredit: false` を削除（コメント更新）。これだけ。ladder・材料・価格・星ゲート・報酬・UI・セーブ形式は無変更 |
| 宣言 | `recipeBatchManifest.ts`（frango: `ladderCredit: true` + `creditedWithoutStep: true`）、`catalogLedger.test.ts`（credited 55 → **56**） |
| 検証器 | `recipeBatchValidator.ts`: 「credited だが ladder ステップを持たない」を `creditedWithoutStep` で明示宣言させる（旧: credited = 必ず 1 ステップと仮定）。自己テスト追加 |
| ヒント経済シム | `hint5Economy.sim.test.ts`: step 44 に credited が 2 件並ぶため blind chain が全鍵レシピに延び、最後の発見（hinted）が frango になる。導出式を更新（件数の直書きなし） |
| 到達性 | `ladderReachability.starGate.test.ts`（下記） |
| 旧宣言の整合 | `discoveryProgressionModel.test.ts` / `discoveryExpansion2.wave2.test.ts` / `researchLabels.batch8a.test.ts`（non-credit は calabresa, aussie, chilean, chorizo の 4 件、credited 56） |

Lunch Rush（`lunchRush:false`）、CUT なし、key-free Hint、Research cohort（catupiry の A/B）は不変。

## 到達性（本番の `resolveShopEntitlement` 相当、全レシピ best 固定）
| best | 累計★ | credited 到達 | 閉塞ステップ | 到達不能 |
|---|---|---|---|---|
| ★1 | 58 | 54 / 56 | **なし**（旧 52, 53） | california, spinach-artichoke（星ゲート直接。意図どおり） |
| ★2 | 116 | 54 / 56 | **なし** | 同上 |
| ★3 | 180 | **56 / 56** | なし | なし |

step52（mint）・step53（lamb, sweet-potato）の閉塞は解消し、eggplant-ricotta / new-zealand-lamb は★1 でも作れる。累計★境界: 119 → 2 レシピ / 120 → spinach のみ / 130 → 全開。slack = 56 − 53 − 2（星ゲート credited）= **1**。

## 既存セーブ
- credited 数は Dex から毎回導出（保存値なし、星ゲートと同じ）。frango-catupiry **発見済みのセーブは +1 が遡及**、未発見は不変（`frangoCatupiryCredit.saveImpact.test.ts`）。
- 解禁は和集合で再ロックなし。+1 により 51→52 の端のセーブは step52 が開く（テストで確認）。セーブ schema・キーは無変更。

## ACCEPTED_* ratchet（緩和なし）
`ACCEPTED_COLLATERAL` `[eggplant-ricotta-pizza, new-zealand-lamb-pizza]` → `[]`、`ACCEPTED_BLOCKED_STEPS` `[52, 53]` → `[]`（改善分だけ縮小）。`ACCEPTED_DIRECTLY_GATED` は #420 の意図なので維持。

## 新しい星ゲートの WORSENING Gate
- 既存: baseline 超の到達不能レシピ／閉塞ステップは赤。
- 追加: **slack テスト**（credited − ステップ数 − 星ゲート credited ≥ `ACCEPTED_MIN_SLACK` = 1）。星ゲートやステップを足して slack を食うと、メッセージが「slack を戻す credited レシピ（frango と同様）／ゲート緩和／Owner 判断。`ACCEPTED_MIN_SLACK` を下げない」を示して赤になる。
- 検出器の自己テスト: slack 1 の合成母集団で 2 つ目のゲートが slack を使い切り、3 つ目で閉塞することを確認。

## 検証
typecheck+build（`tsc -b && vite build`）OK / lint 0 error / フル Vitest 467 files, 8812 tests pass / 関連 E2E（chromium: expansion-batch8a, discovery-dex-aggregated, home-research-entry-parity, research-stable-identity, discovery-research-rows, discovery3-pool2-production）32 pass。この環境は WebKit 未導入のため webkit プロジェクトはローカルで実行不可（CI の e2e-webkit で確認）。

## 残存リスク
- slack は 1 のみ。次の星ゲート付き credited ステップ／ゲートは追加の credited レシピが前提（WORSENING Gate が検出）。
- 星ゲート 2 レシピ（california / spinach-artichoke）は★1/★2 では引き続き作れない（#420 の意図、変更禁止事項）。
- ★1 中心の収入不足（#561 の P2）は未対応。

## Human Verification
UI・レイアウト・操作の変更なし（解禁タイミングのデータ導出のみ）。HV 動画・スクリーンショットは作成していない（共有 Preview も更新しない、Owner 指示）。Shop/Dex の解禁タイミングが変わるため、HV の要否は Owner 判断。
