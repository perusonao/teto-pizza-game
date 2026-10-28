# B11 S1（通常3レシピ）実装前準備 — 着手条件の確認（docs-only）

Status: **準備の記録のみ。** `src/**`・`e2e/**`・CSS・テスト・golden・データ・workflow は変更していない。S1 の実装・PR 作成・push・merge・共有 Preview 更新・GitHub への書き込み（claim・コメント）・Monitor 作成はしていない。
基準 `origin/main` = **`bc0a782`**（#689、2026-10-28 09:40 JST、テストのみ）。#679 の base は `47268e3`。
**「推奨」は助言であり Owner Decision ではない。原典（pizzadb.jp）には到達していない。**
関連: `TETO_B11` の設計 Gate 結果（本セッションの Result Report）、`TETO_EXPANSION-BATCH-10_PR1_OWNER-DECISIONS.md`。

## 0. 追記: Owner 判断（2026-10-28、準備文書の確定）

- 本書を docs-only として commit・push してよい。製品コード・テスト・CSS は変更しない。PR 作成・merge・共有 Preview 更新・Monitor 作成はしない。
- **実装順序（確定）: #679 → Line C → 食材描画 V1 → B11 S1。**（以降の §2・§3・§7 の「Line C は不明」「S1 と PR-2 の前後は Owner 判断」は、この確定で置き換える）
- **Line C = `wasabi-beef-pizza` と `mentaiko-cream-pizza` の2レシピ追加**（旧 PR-2 の late 4件のうち2件）。`bulgogi-pizza` と `yakiniku-pizza` は **HOLD**。
- B11 S1 は boscaiola・porcini-pizza・pescatore の3レシピ。**原典未確認の暫定仕様で進めることを条件付き承認**（B10 と同じ運用: PR・Result・コードに「暫定仕様・原典未確認」「GAMEPLAY ASSUMPTION」を明記し、原典を根拠にしない）。これで §2 の原典確認（B3）は着手のブロッカーではなくなる。原典の確認は引き続き未完了として記録する。
- **S1 の実装は先行タスク（#679・Line C・V1）の merge 後。** ラダー番号・late floors・件数 pin・golden は、その時点の最新 main から再導出する（本書の数値、特に late 導出番号 68 は #679 のみを前提とした見込みで、Line C が late step を2つ足すと変わる）。
- **隔離 Artifact の作成・公開は S1 の HV 用途に限り事前承認済み。** 共有 Preview と Production は変更しない（§7 B6 は解消）。
- **正式実装は通常の Git リポジトリで検証する。** §6.1 の Pinsa OFF baseline の失敗2件（`lcHandPreview.gate` の `.git` 不在、`gameReducer.deductionHint` の 5000ms timeout）は、隔離コピーの環境依存と負荷起因として記録する。正式な検証ではこれらを再測定し、通らない場合は原因を調べる（timeout の緩和で隠さない）。

## 1. Owner 決定（2026-10-28、条件付き承認）

| # | 決定 |
|---|---|
| 1 | boscaiola を credited key、porcini-pizza を `ladderCredit:false`（REC-04 の同点処理が recipe id 昇順のため、porcini の step の key は boscaiola になる。試作で `discoveryLadder.test` が通ることを確認済み） |
| 2 | pescatore は tomato-sauce のみの単一ソース（olive-oil を省く = GAMEPLAY ASSUMPTION） |
| 3 | pescatore の7素材を維持し、Hint 価格キャップの例外追加（veggie-supreme に続く2件目）を認める |
| 4 | mussel と porcini は専用 SVG を同梱する |
| 5 | sfincione は HOLD 維持 |
| 6 | pizza-zucchine-menta は S1 から分離し、別途 Owner 判断を待つ |
| 7 | 通常3レシピに専用公開ゲートは設けない。通常の CI・Codex・実機 HV は必須 |

## 2. 着手条件の確認結果

| 条件 | 結果 | 状態 |
|---|---|---|
| **原典の材料構成の確認** | `pizzadb.jp` は名前解決できず（`ENOTFOUND`、HTTPS も 403）。リポジトリ内にも原典ページの取得記録は無い（matrix の比較表標本のみ）。 | **未達**。セッションのネットワーク許可、または Owner の中継が要る |
| PR #679 の統合状況 | open・未 merge。head `8bffd55`（main `47268e3` を統合済み）。Codex 指摘なし。CI は 10/28 00:56Z から実行中（build・WebKit・layout が in_progress）。Owner の実機 HV は未実施。late step **66**、`LATE_ENTITLEMENT_FLOORS` **66/66** | **未 merge（ブロッカー）** |
| 食材描画 V1 | 実装未着手。#679 の merge 後に最新 main から開始する予定（#611 のコメント）。順序は「#679 → V1 → PR-2」。V1 は `IngredientGlyph.tsx`・`App.css`・`ingredients.ts`（union と3食材）・`IngredientGlyph.test.tsx` を触る | **未着手（S1 と同一ファイル）** |
| **Line C** | PR・Issue・ブランチ名・docs のいずれにも見つからない（Issue/PR 検索0件）。**何を指すか未確認** | **Owner に確認が要る** |
| PR-2（late 4件） | 設計 Gate のみ。PR なし。#679 と V1 の後 | 未着手 |
| 有効な claim | #611: #679 担当（`01E7…`、期限 11/03、`lateCatalog.ts`・`referencePizza.ts`・`recipeSauceProfiles.ts`・`recipeHintRoles.ts`・`ingredients.ts`・`IngredientGlyph.tsx`・`App.css`・hint5 golden 2・DH4 監査 JSON）。#578 U3 の claim は期限 11/02 まで残存。V1 は着手時に投稿予定 | S1 の claim は未投稿（着手時に投稿） |
| 重複 PR | S1 と同じレシピ・食材を扱う open PR は無し | OK |
| 実装済みレシピとの重複 | 材料集合の完全一致なし（設計 Gate で74件+#679+PR-2 を機械検査） | OK |

## 3. ファイル重なり（claim 調整の材料）

S1 の見込みファイル（試作 + B10 PR-1 の実績から）:
`src/data/{recipes,ingredients,ingredientTaxonomy,toppingSizeClass,discoveryLadder,discoveryCatalog,orders,recipeHintRoles,recipeSauceProfiles,referencePizza}.ts`、`src/components/IngredientGlyph.tsx`（+ test）、`src/App.css`、`src/logic/discovery/__golden__/hint5.{ladders55,alphaFamilyOnly}.json`、`docs/reports/data/TETO_DISCOVERY-HINT-4_DH4-1_AUDIT.json`、件数 pin 系の test 約20ファイル、`e2e/`（新規 spec）、`docs/reports/screenshots/<task>/`。

| 相手 | 重なるファイル | 調整 |
|---|---|---|
| **#679** | `ingredients.ts`、`referencePizza.ts`、`recipeSauceProfiles.ts`、`recipeHintRoles.ts`、`IngredientGlyph.tsx`、`App.css`、hint5 golden 2、DH4 監査 JSON、件数 pin | **#679 が先。** S1 は #679 merge 後の main から開始する |
| **V1** | `IngredientGlyph.tsx`、`App.css`、`ingredients.ts`、`IngredientGlyph.test.tsx` | 順序は Owner 判断。V1 が先なら S1 は V1 の挿入位置（`hot-dog-slices` の直後）を避け、union・`VISUAL_VIEWBOX`・JSX 連鎖は末尾に足す。S1 が先なら V1 が rebase |
| **PR-2** | 上記すべて + `lateCatalog.ts`・floors | PR-2 は元々 #679 → V1 の後。S1 と PR-2 の前後は Owner 判断（推奨: S1 → PR-2。PR-2 は末尾追記の規約が S1 と衝突するため、S1 の後に取り込む） |
| #540（Draft・HOLD） | `recipes.ts`・`recipeSauceProfiles.ts`・`referencePizza.ts`・hint5 golden | 先に merge されない。後から merge する側が追従 |
| #578 U3 の claim（期限 11/02） | `lateCatalog.ts` 系（S1 は触らない見込み） | S1 は `lateCatalog.ts` を触らないため直接の重なりなし |

## 4. 着手時の再導出手順（最新 main から）

1. #679（と V1 を先にする場合は V1）の merge 後の `origin/main` を取得する。
2. **ラダー:** 通常 step 62–63 を追記する。凍結範囲は step 61（`discoveryLadder.test` の `slice(0, 61)`、`appendOnly` test も同様）。導出される順は `[porcini]`→boscaiola、`[mussel]`→pescatore（試作で一致）。
3. **late step の導出番号:** 通常 step が +2 されるため、#679 後の BBQ（66）は **68** になる。**floors（57/58/59/59/60/60/66/66）は固定定数のまま変えない**（floors は早く付与する向きにしか働かない）。`materialEntitlement.lateFloor.test` と Shop の期待 step を更新する。
4. **golden:** `hint5.ladders55.json`（挿入のみ・既存エントリ byte 同一を差分で確認）、`hint5.alphaFamilyOnly.json`（既存値が動く。設計 Gate の試作では ikura・dengaku）、DH4 監査 JSON を生成物として再生成する。
5. **件数 pin:** `catalogLedger`・`recipes`・`cookingProfiles`（CUT 非対象）・`lunchRush.exclusion`・`progression`・`discoveryProgressionModel`・`materialShop`・`recipeBatch.validator`・`hint5Ladder.baseCompat` ほか（§6 の一覧）。privacy 系 assertion は緩めない。
6. **Hint 価格キャップ:** `selectableHint.test` の例外リストに pescatore を追加（Owner 決定3）。
7. **許可リスト:** porcini-pizza は `RECIPE_SAUCE_PROFILES` の `null`（NO_SAUCE）で DH4 / Hint 5.0 の許可リストが導出される。`MULTI_SAUCE_RECIPE_IDS` は触らない（単一ソース）。
8. **matcher の Owner 承認例外**（`matcher.test` の `ownerApproved`）に `porcini-pizza-pizzadb-p13` と `boscaiola-pizzadb-p12` を追加する（matrix 行は BLOCKED_PRODUCT_DECISION のまま。B10 PR-1 と同じ手順）。
9. **Research:** `researchCohortLetter` 用の B11 テストを追加する。porcini の組（porcini-pizza=A、boscaiola=B）は新しい文字つきコホートになる（B10 のような「新コホート0」は成り立たない）。既存レシピの文字ドリフトは0であることを固定する。
10. **保存互換:** `persistence.batch11` 相当（旧セーブ・新ID入りセーブ・未知ID保持）。
11. **Pinsa ON / OFF** の両方で全 Vitest（OFF は CI で走らない）。
12. **HV:** 390×844 の動画を Owner に直接提出（repo に commit しない）。前後スクリーンショットは `docs/reports/screenshots/<task>/`。対象: ショップの NEW 行（porcini 30 回分、mussel 10 回分。初回 120 / 補充 60）、SVG の見え方（porcini と mushroom、mussel と clam の識別）、トレイ、ソース工程、完成・図鑑・研究ラベル。

## 5. 食材・レシピの暫定仕様（設計 Gate 結果の再掲、Owner 決定反映）

- porcini-pizza: NO_SAUCE / mozzarella 3、porcini 3、garlic 1、parsley 1（8）/ `ladderCredit:false`。
- boscaiola: olive-oil 1（PAINT_TEMPORARY）、mozzarella 2、porcini 3、sausage 3（8）/ step 62 の key。
- pescatore: tomato-sauce 1（PAINT）、mozzarella 2、shrimp 2、clam 1、mussel 1、garlic 1、parsley 1（8）/ step 63 の key。7種で、2件目のキャップ例外になる。
- 全て `lunchRush:false`、CUT なし、焼成窓 58–78、報酬100、key-free。
- mussel: topping・seafood・size `s`・専用 SVG `mussel-shell`。porcini: topping・vegetable・size `m`・専用 SVG `porcini-slice`。いずれも64×64・id/gradient なし・aria-hidden。emoji はテキスト代替（G18 を通る未使用の字形を選ぶ）。
- 既存食材の最大個数（パック数 k）を超えない構成にしてあり、既存食材のパック数は変わらない。
- **原典未確認の GAMEPLAY ASSUMPTION を PR・Result・コードに明記する**（個数・配置・焼成窓・olive-oil 省略・名称・SVG 形状）。

## 6. 試作の残存失敗と Pinsa OFF baseline（記録）

隔離コピー（scratchpad、repo 外）での測定。`origin/main` `47268e3` を基準にした試作で、現 main `bc0a782` との差は `researchAttempt.sim.test.ts` の分割（#689）のみ。

### 6.1 Pinsa OFF の baseline（設計 Gate 時点で不足していた分）
未改変 `47268e3` を `TETO_PINSA_OFF=1` で全 Vitest 実行: 538 files・**10,007 passed・2 failed**。
- `lcHandPreview.gate.test.ts`: 隔離コピーに `.git` が無いため（`git ls-files` が失敗）。環境起因。
- `gameReducer.deductionHint.test.ts`: 5000ms の timeout（負荷起因。試作の別の実行では通過）。
→ **OFF の実質的な baseline 失敗は0。** 設計 Gate 時の「OFF 固有の追加失敗3件」（`pinsaGate.test` の late 一覧2件と後乗せ affordance 1件）は、いずれも zucchine-menta（分離済み）由来で、S1 単独では出ない見込み（S1 単独の OFF 実行は未実施）。

### 6.2 S1 のみの試作（zucchine-menta を除く、Pinsa ON）の残存失敗
全 Vitest: 540 files・10,023 passed・**36 failed（22 files）**。内訳は全て **ピン・golden・一覧の更新対象**で、意味的な破綻は見つかっていない（ただし1テスト内の後続 assertion は未確認）:

| 分類 | ファイル（失敗数） |
|---|---|
| 件数・一覧の pin | `catalogLedger`(2)、`cookingProfiles`(3)、`recipes`(2)、`lunchRush.exclusion`(1)、`discoveryExpansion2.wave2`(1)、`progression`(1)、`researchLabels.batch8a`(1)、`discoveryCatalog`(1)、`DiscoveryProgressionInspector`(2)、`discoveryProgressionModel`(2) |
| ラダー・floors・Shop | `discoveryLadder.appendOnly`(1)、`materialShop`(8)、`materialEntitlement.batch6`(1)、`materialEntitlement.lateFloor`(1)、`recipeBatch.validator`(1) |
| golden・Hint | `hint5Ladder.golden55`(1)、`hint5Ladder.alphaReport`(1)、`hint5Ladder.baseCompat`(2) |
| 価格キャップ | `selectableHint`(1) — pescatore（Owner 決定3で許容） |
| Research | `researchCohortLetter.batch11`(1) — porcini の組が新コホート（期待を更新） |
| 試作の都合 | `persistence.batch11`(1)（fixture に zucchine が残存）。`gameReducer.deductionHint`(1) は timeout（負荷起因） |

- 設計 Gate 時の全体試作（zucchine-menta 込み）は ON で44件、OFF で46件が失敗し、いずれも同種の pin だった。
- DH4 / Hint 5.0 の production gate・privacy sweep・技法テストは、NO_SAUCE の導出と許可リストの更新後に全て通過した。
- `hint5.ladders55.json` は挿入のみ（既存エントリ byte 同一）。`hint5.alphaFamilyOnly.json` は既存値が動く（魚介 family の増加）。
- 試作の golden には zucchine-menta の行が残っているため、S1 の実装時は S1 のみの構成から再生成する。
- 所要: ON 約13〜18分、OFF 約12〜15分（負荷で変動）。

## 7. 実装可能時期とブロッカー

| # | ブロッカー | 解消条件 | 担当 |
|---|---|---|---|
| B1 | **#679 が未 merge** | CI 完了、Owner の実機 HV と最終承認、merge | Owner / #679 担当 |
| B2 | **先行タスクの順序** | 確定: #679 → Line C → V1 → S1。それぞれの merge を待つ | 各担当 |
| B3 | **原典の材料構成が未確認**（2026-10-28: 暫定仕様での進行を条件付き承認済み。ブロッカーではない） | `pizzadb.jp` をセッションのネットワーク許可に追加する、または Owner が3ページ（p11 ペスカトーレ、p12 ボスカイオーラ、p13 ポルチーニ茸のピザ）の記載を中継する。未確認のまま進める場合は「暫定仕様・原典未確認」の運用（B10 と同じ）を Owner が明示する | Owner |
| B4 | ~~Line C が不明~~ → wasabi-beef + mentaiko-cream の2件と確定。S1 はその merge 後 | Line C の merge | Line C 担当 |
| B5 | claim の調整 | S1 着手時に #611 へ claim を投稿（本書 §3 のファイル一覧）。#578 U3 の claim は S1 と直接は重ならない | S1 担当 |
| B6 | HV 環境 | S1 の HV 用の隔離 Artifact は事前承認済み（共有 Preview・Production は変更しない） | 解消 |

**時期の見立て:** 日付は約束できない。**最短は「#679 の merge（B1）+ B3・B4 の回答」の翌営業単位**で、B2 を V1 先行にすると V1 の merge 分が加わる。S1 自体は B10 PR-1（85ファイル）より小さく、SVG 2点とピン更新が主で、実装・全テスト（ON/OFF 各約13〜18分）・E2E・HV 準備を含む。
複雑なラダー統合（#679 と PR-2 の late floors を含む再導出）は、着手時に Opus での検討を推奨する。通常の実装は Sonnet で足りる。

## 8. 触れていないもの

`src/**`、`e2e/**`、CSS、テスト、golden、データ、workflow、本番スイッチ、共有 Preview、Production、Firebase、Issue/PR へのコメント投稿・claim、PR 作成、push、merge。ローカルのブランチ `claude/teto-pizza-172-recipes-zrl94w` を `origin/main` に fast-forward しただけで、本書は未 commit。
