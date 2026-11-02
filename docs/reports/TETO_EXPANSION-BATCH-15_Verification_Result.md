# Expansion Batch 15（nigerian-suya）追加検証 Result — DH4 相当 scratch・類似度・Research ラベル（docs-only）

Status: **調査のみ。実装は保留（Owner 判断どおり）。** `src/`・`e2e/`・`data/`・ladder・保存仕様・`PROJECT_HANDOFF.md` は本リポジトリで未変更。PR 作成・merge・Production / 共有 Preview 更新・CI 再実行・Monitor 作成なし。
基準 `origin/main` = `cfbb083`（再 fetch、先行 2 レポート以外の差分なし）。前提文書: `TETO_EXPANSION-BATCH-15_Spec_Result.md`（以下「Spec」）。
UI/UX の実装ではないため HV 動画・スクリーンショットは対象外。

## 0. Owner 判断の反映

| Owner 判断 | 本書での扱い |
|---|---|
| 実装開始は保留 | 実装しない。検証は **repo 外の scratch コピー**（`/tmp/.../scratchpad/scratch`、`cfbb083` を clone）だけで行い、本 repo の作業ツリーは docs 1 ファイルの追加のみ |
| ソース = NO_SAUCE を第一候補（未確定） | scratch は NO_SAUCE（S0）で測定。確定とは扱わない（§6） |
| 非 credit 承認 / 全食材を焼成前に置く仮承認 | scratch もその仕様（`ladderCredit:false`、全て TOPPING、焼成前） |
| rendang のラベル変更は条件付き許容 | §5 で変更範囲を測定（rendang のみ） |
| Batch 10 HOLD は調査目的のみ解除 | scratch 検証に限る。実装 HOLD は解除されていない |
| `PROJECT_HANDOFF.md` 変更なし | 未編集 |

## 1. 再確認（main・重複・claim）

| 項目 | 結果 |
|---|---|
| main | `cfbb083` から動いていない |
| open PR | expansion 系 0 件。suya / nigerian を含む PR・branch なし |
| 新規 Issue | **#727（Cooking Sear Production ON）** が追加。claim コメントは 0 件（本確認時点）。#726（蒸す Phase 1）も claim 未投稿・計画のみ。B15 の Issue / claim はなし（本書は docs-only のため投稿せず） |
| 干渉 | B15 実装案が触るのは `recipes.ts` 系のデータとテストのみ。Sear（`PizzaStage` / `GameScreen` / `gameReducer` / `App` / `src/logic/sear`）・蒸す（clam / mussel）と重ならない。本書も新規 docs 1 ファイルのみ |

## 2. 原典へのアクセス

再試行した（`curl https://pizzadb.jp/` → 接続不可 `000`、前回 `WebFetch` は `ENOTFOUND`）。**到達不可のため原典は引き続き未確認。** 個数・焼成窓・投入タイミング・調味・ソースの実体はすべて未確認の仮定として扱う。取得するには pizzadb.jp をセッションのネットワーク許可に追加する必要がある（Owner 操作）。

## 3. scratch 検証の方法（本 repo は無変更）

- `cfbb083` を scratchpad に clone し `npm ci`。**データのみ**で suya を仮実装: `recipes.ts`（mozzarella 2 / beef 3 / green-pepper 1 / onion 2、bake 58–78、`ladderCredit:false`、`lunchRush:false`）、`recipeSauceProfiles.ts`（`null` = NO_SAUCE）、`discoveryCatalog.ts`（evidence id 対応）、`recipeHintRoles.ts`（`keyFree:true`）、`orders.ts`、`referencePizza.ts`（jamaican の 8 点リングを複製、配置は仮）。ladder・ingredients・保存・UI は無変更。
- 全 Vitest を 1 回実行（Pinsa ON、Chromium E2E / WebKit / 実機は未実施）。さらに、rendang と suya の「おしい」判定・Research ラベルを測る使い捨てテストを scratch にだけ置いた。
- **限界:** Pinsa OFF の全件、E2E、iPhone 実機は未実施。referencePizza の座標は仮。DH4 の「攻撃者モデル」系は既存 gate の結果のみで、suya 専用の新規攻撃シナリオは作っていない。

## 4. DH4 相当の結果

全 11,064 テスト: **11,026 passed / 23 failed / 13 skipped**。失敗 23 件は 16 ファイルに集中し、**同じ 16 ファイルは pristine main で 355/355 pass**（suya の追加が原因）。

### 4.1 推理体験・privacy に関わる gate はすべて pass（緩和なし）

`deductionGuard.gate`（16）/ `deductionGuard.*`（audit・speedup・timing・futureCategory 含む）/ `deductionProduction.gate`（17、OD-DH4-2-9「他は到達不能」を含む）/ `hint5Production.gate`（16）/ `hint5Taxonomy.gate`（12）/ `hint5Ladder.keyFree`（14）/ `hint5Ladder.migration` / `hint5Ladder.effectiveCostZero` / `hintFactMigration`（21）/ `selectableHint`（73 + 38）/ `researchBoard(.gate)` / `branchingPool`（29 + 4）/ `nearMiss`（38 + 16 + 14 + 4）/ `freeCook.*` / `hintTarget`（59）/ `deductionHint`（27 + 52）。

→ **月見型の gate 抵触（`other` 家族）は起きない**（suya の 4 食材は meat / vegetable / vegetable / cheese）。key-free の α sub-row 候補 gate も違反なし。**既存の privacy assertion を緩める必要はなかった。**

### 4.2 失敗 23 件の内訳

| 種別 | 件数 | 内容 | 実装 PR での扱い |
|---|---|---|---|
| **機械的な件数・一覧 pin**（想定どおり） | 13 | `catalogLedger`（recipes 85→86）、`lateCatalog.bbq` の件数（85→86）、`recipes.test`（2、一覧）、`lunchRush.exclusion`（opt-out 一覧）、`progression.test`（一覧）、`discoveryProgressionModel` / `wave2` / `researchLabels.batch8a`（非 credit 一覧）、`cookingProfiles`（3: CUT 非適格一覧・step 一覧・id 集合）、`hint5Ladder.baseCompat`（key-free 母集団 60→61） | B12–B14 と同じ手順で再導出 |
| **golden**（生成物） | 2 | `hint5.ladders55.json` / `hint5.alphaFamilyOnly.json`。scratch で `-u` して差分確認: **+203 行・削除 0 行（挿入のみ）**。既存エントリは byte 同一 | 再生成して差分確認 |
| **manifest / validator** | 5 | `recipeBatch.validator`（B10〜B13 の `followedBy` 末尾一覧に suya が増える） | `recipeBatchManifest.ts` に `B15_BATCH` と各 `followedBy` を追記 |
| **承認例外**（B14 の moussaka と同形） | 2 | `discoveryCatalog.test`（Phase-2 SHIPPED_KEEP との一致検査）、`matcher.test`（blocked 行は自動発見しない検査）。suya の Phase-2 行は `BLOCKED_PRODUCT_DECISION` のため例外配列への追加が要る | **Owner 承認の例外として追加**（暫定仕様の明記つき） |
| **実質的な契約変更** | 1 | `researchCohortLetter.batch10.test`: 「rendang-pizza at 68: expected true to be false」＝ B10 の「rendang は文字なし」不変条件 | §5 の条件付き許容に基づき、`acceptedLetterShifts: { "rendang-pizza": "-->B" }` を明示して更新（B12 の veggie-supreme と同形） |

## 5. Research 表示（ラベル変更の前後）

測定: 本番の `researchCohortLetters` / `researchEntryLabel`、beef 取得直後（ladder step 58 到達）の状態。

| レシピ | 変更前 | 変更後（suya あり） |
|---|---|---|
| rendang-pizza | `？？？ピザ（牛肉）` | `？？？ピザ B（牛肉）` |
| nigerian-suya-pizza | （存在しない） | `？？？ピザ A（牛肉）` |

- **既存レシピで文字が変わるのは rendang のみ**（全 ladder prefix で走査し、`rendang-pizza:-->B` の 1 件だけ。他の 77 件は不変）。A / B はレシピ id のハッシュ順で決まる（suya = A、rendang = B）。ラベルは保存されない導出値。
- 影響を受けるのは「beef を購入済みで rendang が**未発見**」のプレイヤーだけ。rendang を発見済みなら Research エントリ自体が出ない。**未発見のまま beef を持つプレイヤーは、`？？？ピザ（牛肉）` が `？？？ピザ B（牛肉）` に変わり、もう 1 つの `？？？ピザ A（牛肉）` が現れる**（B12 の veggie-supreme と同じ現象）。
- INV-B7（ラベルは解禁材料＋文字のみ）は維持される。suya は step 58 で makeable になる（beef 取得後）。

## 6. 類似度 0.60 の分析（rendang との関係）

### 6.1 仕組み上の安全性

- マッチャは **食材集合の完全一致＋ソース一致のみ**（superset / subset は「オリジナル」）。0.60 でも rendang と suya は**混同されない**。suya は rendang の部分集合でも上位集合でもない（NO_SAUCE 案の場合）。`curry-ketchup` を足す案は rendang の上位集合になり 0.80 で危険（Spec §3 のとおり除外）。
- 識別の衝突（`collidingIdentityKeys`）は発生しない。`freeCook` / `matcher` の既存テスト（上記 pass）で確認。

### 6.2 「おしい」（near-miss）への影響 — 実測

rendang と suya の 2 候補、食材 {mozzarella, beef, onion, green-pepper} の全部分集合 × ソース {なし, curry-ketchup, tomato-sauce} = 45 試作で、suya の有無による分類を比較した。

- **変わるのは 16/45 件、いずれも green-pepper を含む試作**（または suya そのもの）。例: `mozzarella+beef+green-pepper` は FAR(d4) → **CLOSE(d2)**、`mozzarella+beef+onion+green-pepper`（= suya）は CLOSE(d2) → **null（発見）**、同 + tomato-sauce は CLOSE → **SAUCE_ONLY/REMOVE(d1)**。**どれも「suya の方向に近づく」自然な変化**。
- **rendang 本来の体験は変わらない**: `mozzarella+beef+onion`（ソースなし）= SAUCE_ONLY/ADD(d1)、`…+tomato-sauce` = SAUCE_ONLY/CHANGE(d1)、`…+curry-ketchup` = 発見、`…+green-pepper+curry-ketchup` = REMOVE_ONE(d1) — いずれも前後で同一。d=1 の同点（ソースなしの `mozzarella+beef+onion`）は従来どおり rendang が優先される（hint の候補順）。
- **限界**: 2 候補だけの隔離測定。step 58 時点の全 discoverable 候補での再計算はしていない。ただし既存の `nearMiss*` / `ResultPanel.nearMiss` / `hintTarget` 系テスト（計 100 件超）は全て pass。

### 6.3 判定

0.60 は**既存のゲーム体験を損なわない**と判断する（誤発見なし、rendang の近似判定は不変、変化は suya への自然な誘導のみ）。Spec で懸念した「B12 の 0.4 未満 pin」は jamaican 専用の固定値で、suya 側は「完全一致・部分集合・上位集合が 0」へ pin 方針を変えるのが妥当（**既存テストの緩和ではなく新規 batch の基準**として Owner が承認する事項。§8-Q）。

## 7. NO_SAUCE・個数・焼成窓の根拠と未確定事項

| 項目 | 根拠 | 状態 |
|---|---|---|
| 食材 4 種 | 172 matrix 証跡（比較表 p5、中継 2026-09-22、独立再取得なし、corroboration 0） | 証跡あり（原典未確認） |
| ソース = NO_SAUCE | 食材欄にソース食材が無い。matrix は「その他」＝未指定。前例: jamaican（仮定と明記）、potato-mayo（Owner 例外）。**Owner は第一候補とするが未確定** | **仮定。確定には suya 単独の Owner 例外承認が要る** |
| 個数 mozzarella 2 / beef 3 / green-pepper 1 / onion 2 | 原典に個数なし。「非ソース 8 ピース = 8 スロット」の慣例（B12–B14）と、jamaican と同じ配分（2/3/1/2）を踏襲 | **GAMEPLAY CALIBRATION（根拠なし）**。Owner 判断: 主役の beef を 3 とする / green-pepper 1 は少ないが前例どおり、でよいか |
| 焼成窓 58–78 | 汎用の Free Cooking 窓（他の近年 batch と同じ。窓を汎用に揃えると median 由来の導出値が動かない — shirasu の前例） | **仮置き**。原典に焼成条件なし |
| 全食材を焼成前 | matrix は後乗せ・下ごしらえなしで導出。原典の投入タイミング記載なし | 仮承認済み（Owner） |
| スヤの調味 | 食材欄に無い | モデル化しない |
| 説明文 | 暫定（scratch の文面は実装案ではない） | 実装時に Owner 確認 |

## 8. 推奨

### **GO（条件付き）** — 次回の Owner 判断で実装へ進んでよい。

理由: ① DH4 / privacy / Hint 5.0 / Research の gate は**全て pass**、既存の assertion を緩める必要なし ② 識別衝突・誤発見なし ③ 類似度 0.60 の影響は suya への自然な誘導のみで rendang の体験は不変 ④ 既存ラベルの変更は rendang の 1 件に限定（B12 と同形の前例）⑤ golden は挿入のみ、保存互換は schema v2 のまま（新 id の追加のみ）⑥ 新食材・新 SVG・新 ladder step なし。

**GO の前提（実装前に Owner が確定するもの）**
1. ソースの最終決定（NO_SAUCE を suya 単独の Owner 例外として確定するか。確定しない場合は HOLD）。
2. rendang の `？？？ピザ B（牛肉）` への変更（`acceptedLetterShifts`）を正式承認。
3. `discoveryCatalog.test` / `matcher.test` に BLOCKED_PRODUCT_DECISION の承認例外を追加（暫定仕様・原典未確認の明記つき）。
4. 差別化 pin の方針（Jaccard 0.4 未満 → 完全一致・部分集合・上位集合 0）。
5. 個数（2/3/1/2）・焼成窓・説明文は暫定のまま実装し、Owner 実機 HV で確定。

**HOLD にすべき条件:** ソースを NO_SAUCE 以外にしたい（tomato-sauce 等 — Spec §3、DH4 を再測定する必要）、または rendang のラベル変更を許容しない場合。**別候補への変更は不要**（B16 の ume-shiso は suya と独立に進められる。caponata / tsukimi は HOLD 継続、pesto-genovese は名称調査待ちのまま触れていない）。

### 実装時の残作業（GO 後。本書では未実施）
Pinsa OFF の全件、`tsc -b` / `oxlint` / `vite build`、Chromium E2E（390×844 / 360×800）、CI 11/11（WebKit 含む）、`persistence.batch15.test.ts`、Visual HV（動画は Owner へ直接、スクリーンショットは `docs/reports/screenshots/b15/`）、実機 iPhone Safari（Spec §9）。

## 9. 実施しなかったこと

本 repo のコード・テスト・データ・docs（本書以外）・`PROJECT_HANDOFF.md` の変更、レシピ・ladder・保存仕様の変更、PR・Issue・claim の作成、merge、Production / 共有 Preview 更新、CI 再実行、Monitor 作成、pizzadb.jp の取得（到達不可のまま）、他セッション（Sear Production ON / 蒸す）のブランチ・ファイルの変更。scratch コピーは repo 外で、commit していない。
