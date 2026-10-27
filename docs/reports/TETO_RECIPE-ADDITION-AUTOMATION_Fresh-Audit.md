# レシピ追加自動化 Fresh Audit — Result Report（調査・設計のみ）

基準 `main` = `c6a90e2`（#688）。ブランチ `claude/teto-pizza-recipe-automation-audit-90n0lh`。**製品コード・既存テスト・CI・Preview・Firebase は未変更。merge・Monitor 作成・Issue 作成は未実施。** 本書は docs-only（UI/UX/gameplay 変更なし → HV Policy の動画・スクリーンショットは対象外）。
目的: 今後 20〜100 レシピ以上を追加するときの開発工数と回帰リスクの削減。

> **測定していないもの（明記）**: Vitest 全体・Pinsa ON/OFF 全体は今回実行していない（所要時間は Batch 10 PR-1 Result の記録値を引用）。「削減量」は実測ではなく、過去 PR のファイル数・失敗内訳に基づく定性評価（S/M/L）。

## 0. 結論（先に）
1. **Phase 1（2026-10-07 の Recipe Expansion speed-up）で「件数 pin の派生化」「台帳 1 か所」「Batch Validator/manifest」は既に実装済み**。次に効くのは新規フレームワークではなく、**残っている手書き pin・長時間テストの自動スケーリング・Pinsa OFF の継続検証・golden の差分ノイズ**。
2. Batch 10 PR-1（47 ファイル、うちテスト 31）の初回全体実行の失敗 3 件は**すべて「手書き pin/timeout」**で、製品バグではない（lunchRush 並び pin、deductionGuard 旧件数 pin 174→173、researchAttempt.sim の 600 秒超過）。回帰リスクの大半は「正しい変更に追随し損ねる」型。
3. **Pinsa OFF は CI に入っていない**（`.github/workflows/*.yml` に `pinsa-off` / `TETO_PINSA_OFF` の記述なし。`ci.yml` は `npm test` のみ）。OFF の腐敗は #683 のように**事後に**発見されている。
4. 推奨する最初の小規模 PR: **R7「researchAttempt.sim の自動シャーディング」**（テストのみ、assertion 不変）。詳細 §7。
5. **A1/A2/A4/A6/A7 の原文はリポジトリ・Issue・PR から特定できなかった**（§6）。原文を頂ければ §5 の候補との対応表を追記する。

## 1. 確認した文書
`CLAUDE.md`、`docs/PROJECT_HANDOFF.md`（特に 2026-10-07 speed-up addendum）、`docs/decisions/TETO_SESSION-OPERATIONS_1.0.md`（+ PR #651 の §8 Efficient flow）、`TETO_HUMAN-VERIFICATION-POLICY.md`（参照のみ）、`TETO_EXPANSION-BATCH-10_PR1_Result.md` / `_OWNER-DECISIONS.md`、`src/logic/catalog/testSupport/{catalogDerived,recipeBatchValidator,recipeBatchManifest}.ts`、`src/data/catalogLedger.test.ts`、`src/data/pinsaGate.ts` / `.test.ts`、`vitest.config.ts`、`package.json`、`.github/workflows/`、`tools/validate_recipe_catalog.py` と `data/recipes/*.json`、DH4 関連テスト。

## 2. レシピ追加の工程分解（Batch 10 PR-1 実績ベース）
| # | 工程 | 触るもの | 性質 |
|---|---|---|---|
| P0 | Owner 決定記録・原典確認 | `docs/decisions/*` | 人手（判断） |
| P1 | データ表 | `ingredients` `recipes` `recipeSauceProfiles` `discoveryCatalog` `referencePizza` `recipeHintRoles` `orders` `ingredientTaxonomy` `toppingSizeClass` `discoveryLadder`（ほか `cookingProfiles` 系） | 人手（ゲームデザイン値: nameJa・個数・焼成窓・色・字形） |
| P2 | 台帳・manifest | `catalogLedger.test.ts`、`recipeBatchManifest.ts`（status `planned`→`landed`） | 半自動（意図的な手書き） |
| P3 | pin / golden 追随 | `hint5.ladders55.json`（+1,065 行/削除 0）、`hint5.alphaFamilyOnly.json`、`DH4-1_AUDIT.json`、`deductionGuard.gate`（旧 DH4-2A 件数）、`lunchRush.exclusion`、ladder 凍結 prefix（`discoveryLadder*.test`） | **機械化余地大** |
| P4 | バッチ個別テスト | `expansionBatchN.*.test`、`researchCohortLetter.batchN`、`persistence.batchN`、`materialEntitlement.*`（約 3〜5 files/batch、構造がほぼ同形） | **機械化余地大** |
| P5 | e2e | `e2e/expansion-batchN-*.spec.ts` + 既存 spec の副作用修正（B10: `new-sauces-b1`＝ladder 末尾仮定、`new-sauces-u1`＝トレイ頁送り） | 部分的 |
| P6 | 長時間 sim | `researchAttempt.sim.test.ts`（B10 で `it` の 600 秒超過→手動分割。ファイル全体 562 秒） | **機械化余地大** |
| P7 | Pinsa ON/OFF 検証 | `npm test` と `npm run test:pinsa-off` を手動で両方実行 | CI 未組込 |
| P8 | HV・スクショ・Result Report | 動画 2 本、スクショ 36 枚、Result 文書 | 半自動化可（tools/） |

## 3. 依存関係（レシピ追加で連鎖するもの）
- **食材** → taxonomy family → `toppingSizeClass` / shelf / 検索 alias → トレイ頁数（sauce が 10 種で 2 頁になり既存 e2e が壊れた）。
- **食材** → **ladder step**（REC-04 規則が導出。凍結 prefix は append-only）→ late 材料の互換 floor（`LATE_ENTITLEMENT_FLOORS`）→ Shop offer → 経済 pin。
- **レシピ** → sauce profile（union + PAINT）/ Reference（リング数）/ Hint role（key-free 等）/ discovery catalog（capabilities）/ orders / 章・No. / Lunch Rush プール。
- **レシピ集合全体** → **Research cohort 文字**（最終材料＝cohort key。既存の文字が動かないことの検証が必要）→ DH4 の公開カタログ（仮説空間）→ deductionGuard の旧件数・golden・attacker テスト時間。
- **ladder 位置** ↔ **Pinsa/late**：通常 step が +N すると late の導出 step が +N、floor は固定（B10 §2）。Pinsa は ON/OFF でレシピ総数・章サイズ・chapter が変わる（台帳が `pinsa ? 74 : 73`）。

## 4. レシピ定義から自動生成/自動導出できるもの
| 対象 | 現状 | 判定 |
|---|---|---|
| 総数（recipes/credited/ingredients/ladder/章/Lunch Rush） | **派生済み**（`catalogDerived.ts`）。台帳 1 か所のみ手書き | 完了。台帳は「意図の明示」なので自動化しない |
| 表間整合（id 一意・材料存在・CUT↔profile↔capability・追加 tail・append-only ladder・cohort 同一性） | **Validator 済み**（`planned`/`landed` 両対応） | 完了（拡張余地: 下記 R5） |
| バッチ個別の契約テスト（材料 family・ladder 形・組成の一意性・cohort 文字の全 prefix×ランダム順での不変・save 往復・未知 id 保持） | B10 で 3 files を手書き | **manifest 駆動の汎用テストに生成可（R1）** |
| golden（ladders55 等） | `toMatchFileSnapshot` で `-u` 再生成。レビュー負担は巨大な単一 JSON の diff | **レシピ単位ファイルに分割すれば「既存は byte 同一」が git 上で自明（R4）** |
| 旧 DH4-2A 件数 pin（173） | 手書き literal。内訳コメントを人が書く | **golden JSON 化（pin は維持、緩和ではない）（R3）** |
| 長時間 sim の `it` 分割 | 手動 | **RECIPES から自動スライス（R7）** |
| 管理マスター（`data/recipes/*.json` + `validate_recipe_catalog.py`） | CI 未接続の docs/data ツール | バッチ入力 spec の元になり得る（R5） |
| 原典・色・字形・個数・焼成窓・Owner 判断 | — | **自動化不可**（暫定値は Owner 確認が必要） |

## 5. DH4 検証・Pinsa ON/OFF の自動化範囲
**DH4**
- 自動化済み/可能: hardened ガードの leak=0 と privacy assertion は**カタログを走査する汎用形**（新レシピで自動的に対象が増える）。attacker テストは #688 で高速化済み。旧 DH4-2A 件数は「材料・レシピ追加で必ず動く関数値」で、意味的な安全性は hardened guard 側にある → golden JSON 化して差分レビューに寄せる（R3）。
- 自動化不可: 新たな leak が出たときの原因判断・Anti-Oracle Contract 2.1 の解釈・§15 再計算の方式選択（Owner/Opus 案件）。
- 重複: **#684**（preExistingPublic の全探索 pin）は同領域で open。R3 は #684 merge 後に着手（`deductionGuard.gate.test.ts` が衝突する）。

**Pinsa ON/OFF**
- 現状: `vitest.config.ts` の `pinsaRollback()` で OFF を全スイートに適用でき、`pinsaGate.test.ts` が literal を raw 読みで固定。**CI は ON のみ。**
- 自動化案（R2）: ① まず ON/OFF の所要時間と失敗集合の差を 1 回測る（S0）。② 全 OFF は倍時間のため、`src/data` `src/logic/catalog` `src/logic/discovery` `src/state` のカタログ感応テストに限定した path-filter 付き job、または nightly。**CI 追加は Owner 承認が必要**（SESSION-OPERATIONS: 既存 11 checks は不変）。③ 補助として Validator を ON/OFF 両 view で 1 テスト内評価（`lateCatalog.pinsa.test.ts` が既に同型）。
- 注意: Pinsa は late catalog 側のため、通常 ladder を伸ばす B 系バッチでは OFF 側の pin が壊れにくい（B10 は OFF で stale pin 2 件のみ）。**late 追加バッチ（#679 BBQ など）で OFF の価値が高い**。

## 6. 既存 A1/A2/A4/A6/A7 案の再評価
リポジトリ全文（docs/scripts/CLAUDE.md）、全 open/closed Issue の検索、open PR 一覧を調べたが、**「レシピ追加自動化」文脈の A1/A2/A4/A6/A7 は見つからなかった**。ヒットした同ラベルはすべて別件: PR #105「Dev Automation A1（Claude Issue worker）」、`DEV-CI_WEBKIT-CONDITIONAL_A1A2`（CI の WebKit 選別）、`LC-R5e` の A4/A6/A7（トレイ UI 状態表）、Scoring 2.0 A1/A2。推測で対応づけると誤評価になるため、**原文（ChatGPT 側の提案文か）を共有いただければ次の対応表に追記する**。
仮の暫定対応（内容の推測を含むため参考）: 既実装の Phase 1（catalogDerived/ledger/validator）に当たる案は「完了扱い」、manifest 駆動テスト生成は R1、Pinsa/DH4 は R2/R3 に相当する可能性が高い。

### 本書の候補（R-系。A-系との衝突回避のため別ラベル）
| ID | 内容 | 効果（1 バッチあたり） | 実装コスト | リスク | 優先 |
|---|---|---|---|---|---|
| **R7** | researchAttempt.sim を RECIPES から自動スライス（固定 N shard、seed/assertion 不変） | 手動分割・600 秒超過の再発を防止。レシピ 100+ で CI 時間も並列化 | S（1〜2 files） | 低（sim 合計 attempt 数が不変であることを確認） | **1** |
| **R1** | manifest 駆動の汎用バッチ契約テスト（P4 の 3〜5 files/batch を置換） | 手書きテスト 3〜5 files/batch → 0（manifest 行のみ）。回帰: 全 prefix×ランダム順の cohort 不変を全バッチに適用 | M | 中（既存バッチ個別テストは**削除せず並走**し、同等性確認後に別 PR で統合） | 2 |
| **R4** | `hint5.ladders55.json` をレシピ単位ファイルに分割（`toMatchFileSnapshot` をレシピごと） | レビュー対象が「新規ファイル N 個のみ」に。既存無変更が git で自明 | S〜M（1 回限りの大 diff） | 低（内容 byte 同一を機械確認） | 3 |
| **R3** | 旧 DH4-2A 件数 pin を golden JSON へ（値は維持） | P3 の手書き内訳コメント・再計算が不要に | S | 低〜中（#684 と衝突 → 後続） | 4 |
| **R2** | Pinsa OFF の継続検証（S0 測定 → 感応テスト限定 job/nightly） | OFF 腐敗の事後発見（#683）を防止 | S0=S、導入=M | 中（CI 変更＝Owner 承認、実行時間増） | 5（late 追加前に） |
| **R5** | 計画 spec（`data/recipes` 由来 or manifest `planned`）→ preflight 出力: 予測 ladder step・cohort 文字・章 No.・動く pin 一覧 | 監査/設計時間の短縮。ただし Validator が `planned` を既に検証 → 追加分は「予測レポート」のみ | M | 低（tools/ 追加のみ） | 6 |
| **R8** | バッチ e2e・HV 撮影（390×844 動画 + 360/390 スクショ）を manifest 駆動の撮影スクリプトに | P5/P8 の最大の手作業（B10: 動画 2・スクショ 36）を削減 | M | 低〜中（撮影は Playwright dev ツール。HV Policy の合否判断は人） | 7 |
| — | 製品データ表のコード生成（scaffold） | 表の定型編集のみ削減。値は人が決める | L | **高（製品コード生成）** | **見送り** |

優先度の根拠: 実績の失敗型（stale pin / timeout / OFF 腐敗）に直接効くものを先に。コード生成は本質的な工数（Owner 判断・暫定値）を減らさず回帰リスクを上げる。

## 7. 実装順序と推奨する最初の小規模 PR
順序: **R7 → R1（並走導入）→ R4 → R3（#684 merge 後）→ R2（S0 測定は R7 と並行可）→ R5/R8**。
各 PR は「テスト/tools のみ・製品コード不変・既存 assertion 不削除」。#679（BBQ、late 追加）と #684 が `catalogLedger` / `recipeBatchManifest` / `deductionGuard.gate` / golden を触っているため、R1/R3/R4 はそれらの merge 後に着手（hot file 衝突回避）。R7 は `researchAttempt.sim.test.ts` のみで衝突なし。

**最初の PR（R7）の仕様案**
- 変更: `researchAttempt.sim.test.ts` の walk 群を、`RECIPES`（stage）を固定サイズ（例 10 recipes/`it`）でスライスして `it` を自動生成する形へ。必要なら固定 4 shard の `researchAttempt.sim.shardN.test.ts`（共通 harness import）に分け、並列実行できるようにする。
- 受け入れ条件: ① 全 assertion 維持（削除/緩和なし）。② 同一 seed で attempt 合計が現状（832〜842、B10 Result §5）と一致。③ 最長 `it` が現状（約 100 秒）以下。④ Pinsa ON/OFF 両方で該当 files が pass。⑤ レシピを 1 件増やしても手動編集なしで `it` が増えることを一時追加で確認。
- 対象外: 閾値/timeout の変更、sim の方式変更（§15 再計算は Owner 判断）。
- 推奨モデル: Claude Sonnet で足りる。Opus は Contract 2.1 の解釈や、Phase-2 matrix 例外・ladder 規則の再判断が絡む場合のみ。

## 8. 既存 Issue/PR との重複確認
| 対象 | 関係 |
|---|---|
| #688（DH4 attacker 高速化、merged）/ #682（w1-reachability の分割、merged）/ #683（Pinsa OFF 一覧追随、merged） | 本書の根拠事例。再実装なし |
| #684（DH4 preExistingPublic 全探索 pin、open） | R3 と同領域 → R3 は #684 後 |
| #685（w1Reachability の局所メモ化、open Issue） | 長時間テスト対策だが対象が別（R7 と重複なし） |
| #679 / #611（BBQ late 追加、open）、#686（B10、merged）、#578 | 実装側の進行中。hot file 衝突に注意 |
| #105（Dev Automation A1、draft）、#651（Efficient flow、open docs） | 別機構（Issue worker／運用規約）。本書は不変更 |
| レシピ追加自動化を扱う既存 Issue/PR | **見つからず**（キーワード検索 0 件）。重複する新規 Issue は作成していない |

**Issue 起票の提案（未実施・Owner 承認待ち）**: 「Recipe Addition Automation（R7 起点）」の追跡 Issue を 1 件。起票するなら本書を参照し R7 のみを最初の deliverable とする。

## 9. Owner に残る判断
1. R7 から着手してよいか（テストのみ）。
2. R2（CI への Pinsa OFF 追加）を許可するか。許可する場合、path-filter job か nightly か（まず S0 測定を許可するか）。
3. A1/A2/A4/A6/A7 の原文の共有（対応表を追記するため）。
4. 追跡 Issue の起票可否。

merge・Preview 更新・Production は行っていない。Monitor は作成していない。
