# B11 S1 — Result Report（boscaiola / porcini-pizza / pescatore + porcini / mussel）

Status: **実装完了・自動ゲート GREEN。Owner の実機 HV と最終承認の前は merge しない。** 基準 `main` `c9073146`（#691 merge 済み）。Refs #611。

## 0. 暫定仕様・原典未確認（GAMEPLAY ASSUMPTION）

**原典（pizzadb.jp）には到達しておらず、未確認。** 次はすべて **GAMEPLAY ASSUMPTION / CALIBRATION**（原典を根拠にしない）: 各レシピの個数・配置、焼成窓 58–78、名称、説明文、色、テキスト代替の emoji、SVG の形状、porcini-pizza の `ladderCredit:false`、**pescatore の olive-oil 省略**。根拠は 172 matrix の行（素材集合）と Owner 決定のみ。
同じ文言を `recipes.ts` / `ingredients.ts` / `referencePizza.ts` / `recipeSauceProfiles.ts` / 各テストのコメントに記した。

## 1. 変更の要点

| 領域 | 内容 |
|---|---|
| 食材 | `porcini`（vegetable、size m、専用 SVG `porcini-slice`）、`mussel`（seafood、size s、専用 SVG `mussel-shell`）。T4（初回 120 / 補充 60 Pitz）、星ゲートなし。emoji はテキスト代替のみ（🪵 / 🐚、G18 で一意） |
| レシピ | boscaiola（olive-oil PAINT_TEMPORARY / mozzarella 2 / porcini 3 / sausage 3、credited）、porcini-pizza（NO_SAUCE / mozzarella 3 / porcini 3 / garlic 1 / parsley 1、`ladderCredit:false`）、pescatore（tomato-sauce PAINT / mozzarella 2 / shrimp 2 / clam 1 / mussel 1 / garlic 1 / parsley 1、credited）。全て `lunchRush:false`・CUT なし・key-free・窓 58–78・報酬 100 |
| ladder | 通常 **step 62 = porcini（key boscaiola）、63 = mussel（key pescatore）**。凍結は step 61 まで |
| late | 導出番号 **64–70**（salmon-roe 64 / yuzu 65 / miso・sesame 66 / tahini・pomegranate 67 / bbq 68 / wasabi・soy 69 / tarako 70）。**`LATE_ENTITLEMENT_FLOORS` は不変**（13 行、`lateCatalog.ts` は未変更） |
| Reference | 3 件とも RT-01 の 8 点リング、parsley は `LIGHT_LEAF` |
| 触れていない | matrix（Phase-2 / 172）、`lateCatalog.ts`、採点、経済、保存形式（schema v2 のまま）、共有 Preview / Production、Cooking Prep、Monitor |

## 2. ladder 再導出（コードから）

- REC-04 の導出を `buildAppendOnlyLadder` で実行し、凍結 prefix を 61 に更新（`discoveryLadder.test` / `discoveryLadder.appendOnly.test` の `slice(0, 61)`）。導出結果は porcini → boscaiola、mussel → pescatore。**porcini-pizza は同じ step 62 を共有し、recipe id 昇順の同点処理で key は boscaiola のまま**（porcini-pizza は自分の step を持たない）。
- 凍結を 56 のままにすると porcini が B10 の step 57 より前に割り込むことを確認した（導出が「凍結の外」を並べ替えるため）。凍結を 61 に進めるのが既存の規約（B10 は 54 → 56）。
- late は +2 され、floors（固定）との関係は `materialEntitlement.lateFloor.test` に追加した新テストで固定: 保存が count 66 / 67 / 68 にいて late 素材が ledger に無い場合でも、floor が bbq / wasabi / tarako を付与し、床の 1 つ下では付与しない。

## 3. pescatore の olive-oil 省略 — Owner 判断（選択肢 A、2026-10-28）

- **不整合**: Phase-2 matrix の `pescatore-pizzadb-p11` は SHIPPED_KEEP の `EVIDENCE_READY_TARGET` で、items に olive-oil、capabilities に `MULTI_SPREAD_LAYER`、`spreadLayers: [tomato-sauce, olive-oil]` を持つ。実装は tomato-sauce のみ（olive-oil 省略、Owner 決定 2）。着手時に検出し、停止して Owner に報告した（選択肢 A / B / C）。
- **Owner 判断**: 選択肢 A（olive-oil 省略を維持し、matrix からの意図的な差異を Owner 承認例外とする）。
- **例外の範囲（最小）**: `discoveryCatalog.test` の「every target is identical to its Phase-2 SHIPPED_KEEP target」は維持し、**pescatore だけ**、次の 3 点の差異を許す: items から olive-oil を除く / capabilities が空 / `spreadLayers: null`。差異が「ちょうどこの 3 点」であることを同じテストで assert する（matrix 側に olive-oil と MULTI_SPREAD_LAYER が残っていることも assert）。他の item・dimension は matrix と比較され続ける。
- **matrix は変更していない。** boscaiola / porcini-pizza は matrix 上 `BLOCKED_PRODUCT_DECISION` で、B10 と同じ Owner 承認例外（`discoveryCatalog.test` と `matcher.test` の `ownerApproved`）に載せた。
- **影響（`pescatore.matcher.test.ts` で固定）**:
  - olive-oil を使わない pizza（承認した構成）は pescatore を一意に発見する。
  - matrix の構成（tomato-sauce + olive-oil）の pizza は **pescatore を発見しない**（どの recipe にも一致せず NO_MATCH）。設計 SSOT（matrix）と出荷の構成がずれたままになる。
  - 他の recipe への影響はない（同じ素材でも別の target に一致しない）。
- 理由: 単一ソースで通常の 1 ソース工程に収め、2 本目の塗り層（MULTI_SPREAD_LAYER）を使わない。

## 4. researchAttempt.sim 110 件の失敗 — 切り分けと根本原因

- **症状**: 全 walk が `completed` false。violations は 0、最後の stage は tarako-cream-pizza（最後のレシピ）を発見して終わっていた。
- **根本原因**: `researchAttemptSim.ts` の stage ループが **固定の `stageGuard < 80`**。1 stage = 1 レシピ（+ 最終の完了判定 1 回）なので、**レシピがちょうど 80 件になった今回、80 回で打ち切られ完了判定に到達しなかった**（B11 前は 77 件で通っていた）。ロジックや採点の回帰ではない。
- **修正**: ループ境界を `RECIPES.length + 20` に変更（カタログに連動）。assertion・walk・seed・salt（`stageGuard` の値）は変更なし。テストの無効化や期待値の変更はしていない。修正後、110 件を含む全件が通過。
- 同種の追加修正（いずれも assertion 不変・timeout 不変、#682 / #689 と同じ分割方式）:
  - `PizzaSelectScreen.test`: 「every ladder Dex」は 1 つの `it`（10 s の明示 timeout）が全 ladder 段で画面を描画していた。**カタログ成長で 10.3 s に達し失敗**したため、状態 × Dex 数ごとの `it` に分割（assertion は同一）。
  - `gameReducer.deductionHint.test`: 「technique ledger never changes…」は **未改変の main（`c9073146`）でも本環境で 6.8 s（既定 5 s）で失敗する既存の失敗**だった。target ごとの `it` に分割して解消（assertion 同一）。CI 環境で通っていたかは未確認。
- `researchAttempt.replayAudit` も同じ原因（sim と同じ関数）で、同じ修正で通過。

## 5. 件数・pin・golden・DH4

- `catalogLedger`: recipes 80（Pinsa OFF 79）/ credited 73 / ingredients 92 / toppings 66 / ladder 70 / chapters [6, 12, 18, 44（OFF 43）] / Lunch Rush pool 25（不変）。棚: vegetable 24、seafood 11。
- pin 更新の一覧（意味の変更なし、すべて件数・一覧・導出番号）: `recipes` / `cookingProfiles`（3 件を CUT 非対象、porcini-pizza は SAUCE 工程なし）/ `lunchRush.exclusion` / `progression` / `discoveryExpansion2.wave2` / `researchLabels.batch8a` / `materialShop`（porcini 62・mussel 63、late を +2）/ `materialEntitlement.batch6` / `lateCatalog.bbq`（80 / 92 / 70）/ `lateCatalog.late4`（69・70）/ `DiscoveryProgressionInspector`・`discoveryProgressionModel`（step 62 が boscaiola と porcini-pizza を同時に開く multi-recipe step になる）/ `hint5Ladder.baseCompat`（key-free 54: sauce+cheese 27、cheese-only 19）/ `IngredientGlyph`。
- **Hint 価格キャップ例外**: `selectableHint.test` の `capBinds` を `["veggie-supreme-pizza", "pescatore"]` に（Owner 決定 3、7 種の素材）。
- **golden**:
  - `hint5.ladders55.json`: **挿入のみ**（既存エントリの削除・変更 0 行、差分で確認）。
  - `hint5.alphaFamilyOnly.json`: **既存値が動く**（魚介 family の増加）: ikura-salmon-pizza 70 → 98、eggplant-dengaku-pizza 47 → 48、tarako-cream-pizza 427 → 471。新規: boscaiola 141 / porcini-pizza 230 / pescatore 525。bbq・wasabi は不変。生成物として再生成（手編集なし）。
  - `TETO_DISCOVERY-HINT-4_DH4-1_AUDIT.json`: 生成物として再生成（category / group / family の件数が増えるのみ）。
  - DH4 の privacy gate（hardened guard の leak 0）は全状態で通過。`deductionGuard.gate` の旧 DH4-2A 件数は 212 → 199（トッピングの配列 index で切る合成 family が再構成されるため。ハードガードは 0 のまま）。
- **Research**: porcini の組は新コホート（porcini-pizza = A、boscaiola = B）、pescatore は単一で文字なし。**既存レシピの文字ドリフト 0**（全 prefix と 40 通りのランダム購入順で固定: `researchCohortLetter.batch11.test`）。
- **NO_SAUCE**: porcini-pizza は `RECIPE_SAUCE_PROFILES` の `null` で、DH4 / Hint 5.0 の許可リストは `noSauceRecipeIds()` から導出される（手書きの追加なし）。`MULTI_SAUCE_RECIPE_IDS` は触っていない。
- **テスト基盤の追加**: Recipe Batch Validator は「同じ key 素材を 2 つの batch recipe が共有」を一律に拒否していた。**非 credit の recipe が credited な兄弟の step に乗る場合だけ許す**よう最小限に変更（credited 同士の重複は引き続き検出。専用テストあり）。

## 6. 検証結果（すべて本セッションで実行）

| ゲート | 結果 |
|---|---|
| `tsc -b` | エラー 0 |
| `oxlint` | エラー 0（警告は既存） |
| `npm run build` | 成功（chunk サイズの警告は既存） |
| Vitest 全体（Pinsa ON） | **10,482 件中 10,467 passed / 0 failed**（13 skipped） |
| Vitest 全体（`TETO_PINSA_OFF=1`） | **10,473 件中 10,459 passed / 0 failed**（12 skipped） |
| E2E `e2e/b11-s1.spec.ts`（Chromium、390×844 と 360×800 × 3 レシピ） | **6/6 passed**（Shop NEW → 購入 → Research ラベル（漏えいなし）→ 調理 → NEW DISCOVERY → Dex、横スクロールなし、console error 0） |
| WebKit E2E | **未実施**（CI の WebKit シャードに委ねる。本環境では未検証） |
| Safari / iPhone 実機 | **未実施**（Owner の HV） |

- E2E は環境の Playwright が要求するブラウザ版と入っているものが違うため、リポジトリに含めないローカル設定（`playwright.local.config.ts`、`.git/info/exclude`）で `/opt/pw-browsers/chromium-1243` を指定して実行した。リポジトリの設定は変更していない。
- 最初の E2E で porcini-pizza が落ちたのは、テストの前提違い（Research のラウンドは NO_SAUCE でも SAUCE 工程を表示する。ソースなしで「次へ」を押すのが作り方）。実装ではなくスペックを直した。

## 7. Human Verification（Owner 判定。`PASS` / `FAIL` はセッションが書かない）

スクリーンショット: `docs/reports/screenshots/b11-s1/`（39 枚。390×844 と 360×800 の 2 viewport）
- 新食材は main に存在しないので **before は無い**（新規）。既存の mushroom / clam / shrimp / sausage が動いていないことは、`IngredientGlyph.test` と比較シート `b11-svg-comparison-sheet.png`（dough / tomato / baked 3 背景 × 24px / 48px、porcini↔mushroom・mussel↔clam↔shrimp・sausage の並べ）で確認できる。
- `b11-{porcini,mussel}-new-*`（Shop NEW）、`b11-<recipe>-research-entry-*`、`-tray-sauce` / `-tray-topping` / `-sauce-painted` / `-no-sauce-step` / `-topped` / `-new-recipe`。

**Human Verification Videos**: 本セッションでは **動画（390×844 MP4）を作成していない**（`HV_VIDEO=1` で撮れる状態）。Policy §4〜§10 の動画 + `Video Verification` は未提出。

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| （未作成） | 390×844 | — | — | — |

Owner に見てほしい点（Prep §4 の項目）:
1. **porcini-pizza（NO_SAUCE）の淡色盤面で porcini が沈まないか**（390 では傘の茶色と軸が読めた。360×800 の実機で最初に確認）。
2. **mussel が 360×800 の tomato-sauce 上で小さく読みにくくないか**（暗色の殻と橙の身は識別できるが、size s で小さい。clam と隣り合う pescatore の盤面）。
3. porcini と mushroom（emoji のまま）、mussel と clam・shrimp の取り違え。
4. サイズ補正（1.3em、独立ルール）が既存の見た目を動かしていないか。
5. 研究ラベル（porcini-pizza A / boscaiola B / pescatore は文字なし）。

## 8. 準備資料（65bbb7e9）からの更新点

- #679・V1（#690）・Line C（#691）は merge 済みで、S1 は #691 の追記の後ろ（`nori-strips` の後）に追記した。
- Line C の recipe id は `tarako-cream-pizza`（discovery target のみ `mentaiko-cream-pizza-pizzadb-p4`）。late は 64–70（wasabi 69、tarako 70）。
- 準備資料の「olive-oil 省略で不整合が出たら停止」は実際に発生し、§3 のとおり Owner 判断（A）で解決した。
- 準備資料は main に無い（remote ブランチのみ）。必要なら別の docs-only PR で取り込む（本 PR には含めない）。

## 9. 残る事項・リスク

- WebKit CI と Safari / iPhone 実機は未検証。動画は未作成。
- 設計 SSOT（Phase-2 matrix）と pescatore の構成が意図的にずれている（§3）。将来 olive-oil の 2 ソース構成にする場合は MULTI_SPREAD_LAYER の実装と例外の撤去が要る。
- `researchAttemptSim` の stage guard は修正済みだが、同種の「カタログ成長で境界・timeout を超える」箇所は他にもありうる（今回の全体実行では他に無かった）。
- `gameReducer.deductionHint.test` は未改変 main でも本環境で timeout する既存の問題だった（分割で解消）。CI の実時間との差は未確認。
- merge = 即公開。Owner の実機 HV と最終承認まで merge しない。
