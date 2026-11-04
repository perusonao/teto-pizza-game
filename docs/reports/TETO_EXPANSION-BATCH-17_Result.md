# Expansion Batch 17 — Result Report（goulash-pizza + sour-cream）

Status: **実装・自動検証・Chromium E2E・HV 証跡（390×844 / 360×800）まで完了。Owner の承認と iPhone Safari 実機 HV の前は merge しない。共有 Preview・Production は更新していない。**
Issue #741 / branch `claude/batch-17-spec-investigation-8hfcsj` / 基準 `main` `d927878`（#740 merge 済み）。`PROJECT_HANDOFF.md` は変更していない。
事前調査（同 branch の前段、調査のみ）: DH4 gate / Hint 5.0 gate を使い捨てコピー（リポジトリ外）で 1 回検証し、gate の失敗 0 を確認してから実装に入った。

## 0. 暫定仕様・原典未確認（GAMEPLAY ASSUMPTION）

**原典（pizzadb.jp）には到達できず、未確認。** 根拠は 172 matrix の行 `goulash-pizza-pizzadb-p3`（比較表 p3、中継 2026-09-22、独立再取得なし）のみ: 牛肉 / 玉ねぎ / パプリカパウダー / サワークリーム、ソース欄「その他」（`BASE_SAUCE_UNSPECIFIED`、matrix は `BLOCKED_PRODUCT_DECISION` のまま、変更していない）。次はすべて **GAMEPLAY ASSUMPTION / CALIBRATION（原典の事実ではない。Owner が 2026-11-03 に暫定として確定）**:

- 個数（サワークリーム 1 / beef 3 / onion 3 / paprika-powder 2 ＝ 非ソース 8 ピース）、**チーズなし**（matrix に無い。vongole / fugazza がソースのみの前例）、焼成窓 58–78（汎用窓）、説明文・注文セリフ、サワークリームの色 `#f1ecdc`・emoji 🍦・dab の絵、Reference の座標。
- **全ての材料を焼成前に置く**（原典に投入タイミングの記載なし）。POST_BAKE は使わず、FINISH 段もない。スパイス・下ごしらえ・炙り・蒸し・後乗せの工程は追加していない。
- **B17 限定の例外 1 件**（一般則ではない）: ソース欄「その他」をサワークリーム（`sour-cream`、既存の PAINT）と読むこと。caponata・tsukimi・pesto-genovese・jerusalem-mixed-grill は出荷しておらず、その旨をテストで固定した。**Jaccard の例外は不要**（最近傍は 0.33、全体の 0.4 基準を変更していない）。

## 1. 内容

| 項目 | 内容 |
|---|---|
| レシピ | `goulash-pizza` グヤーシュピザ（evidence `goulash-pizza-pizzadb-p3`）。sour-cream 1（PAINT）→ beef 3 → onion 3 → paprika-powder 2（`requiredIngredients` の順は sauce → toppings）。`ladderCredit`: credited、`lunchRush:false`、key-free Hint（永続）、**CUT なし**、bake 58–78、`baseRewardPitz` 100。調理工程は DOUGH / SAUCE / TOPPING |
| 説明文 / 注文 | 「サワークリームのソースに、牛肉と玉ねぎとパプリカをのせた、ハンガリー風の一枚。」/ 「ハンガリーの煮込み風ピザ、食べてみたいな！」（投入の時機は書かない） |
| 新食材 | `sour-cream` サワークリーム。**sauce（spread）**・色 `#f1ecdc`（暫定）・emoji 🍦（暫定。**🥣 は tahini が使うため不使用**、G18: 他食材と重複なし）。専用 SVG `sour-cream-dab`（案 A: クリームのうず巻き＋ピーク。梅肉 `umeboshi-paste-dab` と同じ dab 文法、`IngredientGlyph` 側・`App.css` に 1.5em の共有ルール）。sauce は topping family を持たないため `ingredientTaxonomy.ts` は変更なし |
| ladder | 通常 **step 68 = sour-cream（key `goulash-pizza`）**、T4、星ゲートなし。1–67 は凍結。late の導出番号は +1（69–75）、`LATE_ENTITLEMENT_FLOORS` は**不変** |
| Reference | 8 点リング（RT-01）を `requiredIngredients` の順に連続割当（beef 3 → onion 3 → paprika-powder 2） |
| 触れていない | 既存レシピ、採点、保存形式（schema v2）、Production スイッチ、`lateCatalog.ts`、`ingredientTaxonomy.ts`、既存ソースの色・描画（fromage-blanc-sauce `#fffdf8` / umeboshi-paste `#b8405a` ほか、テストで固定）、`PROJECT_HANDOFF.md`、#738 / #739 / #740 |

## 2. 影響（Owner が見るべき点）

- **件数**: recipes 88（Pinsa gate 開）/ 87、credited 78、ingredients 97、toppings 68（不変）、**sauce 14 → 15**、ladder steps 75、第 4 章 51（Pinsa 開）/ 50。Lunch Rush のプール 25 は不変（opt-out は 54 件）。
- **step 68 は 2 系統同時（Owner 承認済み）**: goulash と、late の tarako-cream-pizza（`LATE_ENTITLEMENT_FLOORS` の cod-roe / fresh-cream-sauce / nori = 68）が同じ発見数で makeable になる（B14 の step 66、B16 の step 67 と同型）。`persistence.batch17.test.ts` で「発見数 67 では sour-cream 未解禁、68 で sour-cream・cod-roe・fresh-cream-sauce・nori が同時に解禁、以前の解禁は何も取り上げない」を固定。
- **ショップの消費量**: beef（k=3）、onion、paprika-powder（k=2）は goulash が既存の最大個数を超えないため、**在庫（k）は 1 つも変わらない**（`materialShop.test` で確認。新行は sour-cream k=1・在庫 10・120 / 補充 60 のみ）。
- **Research**: 新 step 68 の唯一の新材料が sour-cream → 単独 cohort・**文字なし**: `？？？ピザ（サワークリーム）`。**全 ladder prefix と 40 通りのランダム購入順で、既存レシピの文字は 1 つも変わらない**（`acceptedLetterShifts` なし）。rendang / suya の牛肉 cohort（A / B）は不変。
- **Hint 5.0**: `hint5.ladders55.json` は **+202 行・削除 0（挿入のみ）**、`hint5.alphaFamilyOnly.json` は **+1 行（`"goulash-pizza": 396`）・削除 0**。key-free 母集団 61 → 62（**sauce のみ 9 → 10**。チーズなしのレシピは sauce のみ分類）。
- **DH4 audit の差分の精査**: `docs/reports/data/TETO_DISCOVERY-HINT-4_DH4-1_AUDIT.json` は **1 行のみ**（`catalogComparisonCandidates.category` 14 → 15 = sauce の件数。B16 の 13 → 14 と同じ性質）。ほかのキー・数値は不変。
- **保存互換**: schema v2 のまま、新 id の追加のみ（`persistence.batch17.test.ts`）。rendang の Dex エントリは byte 同一。第 4 章を全達成済みの保存は未達成に戻る（導出表示、データは消えない）。

## 3. 既存テストの追従（既存 assertion を無条件に緩めていない）

事前の scratch 計測（62 件・35 ファイル、うち gate 系 0）のとおり、**件数・一覧・golden・manifest・承認例外・B15 / B16 自身の pin の追従のみ**。privacy / DH4 / Hint 5.0 / Research / matcher の**識別系 gate は 1 件も修正していない**（`deductionGuard.*` / `deductionProduction.gate` / `hint5Production.gate` / `hint5Taxonomy.gate` は無修正で pass）。

| 種別 | 対応 |
|---|---|
| 件数 ledger | `catalogLedger`・`lateCatalog.bbq`・`catalogShelf`・`largeCatalogFixtures`（recipes / credited / ingredients / sauce / ladder / 第 4 章） |
| ladder / late の導出 | `expansionBatch11.s1` / `12b` / `13` / `14` / `16` / `lateCatalog.late4` / `materialEntitlement.batch6` / `lateFloor` / `materialShop`（step 数 67→68、late の導出番号 +1、sour-cream 行）、`discoveryLadder` / `discoveryLadder.appendOnly`（凍結範囲 1–65 → 1–67、規則が導出するのは最新 step 68 のみ） |
| 一覧 pin | `recipes.test`・`lunchRush.exclusion`（opt-out 53→54）・`progression.test`・`researchLabels.batch8a`・`discoveryProgressionModel`・`DiscoveryProgressionInspector`（step 68 を multi-recipe に追加）・`cookingProfiles`（CUT 非適格一覧と step matrix `["DOUGH","SAUCE","TOPPING"]`）・`referencePizza.test`（sauce 集合に sour-cream） |
| Hint 5.0 / DH4 | `hint5Ladder.baseCompat`（key-free 母集団 61→62、sauce のみ 9→10）・golden 2 件・DH4 audit（`category` の 1 行） |
| manifest / validator | `B17_BATCH` を追加（`afterRecipeId: "ume-shiso-pizza"`、key `sour-cream`、`acceptedLetterShifts` なし）。B10–B16 の `followedBy` に goulash を追記。B17 の整合テストを新規追加 |
| 承認例外（**goulash のみ**） | `discoveryCatalog.test`（`BATCH17_PHASE2_BLOCKED_OWNER_APPROVED`）・`matcher.test`（`ownerApproved.add("goulash-pizza-pizzadb-p3")`）。他の BASE_SAUCE_UNSPECIFIED 行は引き続き「出荷されていない」を検査 |
| B15 / B16 自身の pin | 「goulash は出荷されていない」の HOLD 一覧から goulash だけを外した（他の HOLD は維持）。B16 の entitlement テストは step 68 に sour-cream が加わる形に追従 |
| アイコン | `IngredientGlyph.test`（専用ビジュアル一覧に `sour-cream-dab`、B17 専用の describe を追加: 64×64・id / gradient / defs なし・🍦 が DOM に出ない・他の sauce と描画が異なる・fromage-blanc と異なる） |

### 新規テスト
`expansionBatch17.test.ts`（28: 構成・sauce は PAINT で NO_SAUCE ではない・チーズなし・credited・key-free・CUT なし・**全て焼成前 / FINISH 段なし**・同一 / 部分 / 上位集合なし・**0.4 以上の近傍は 0 件**（最近傍は rendang / suya の 0.33）・既存ソースの色と描画が不変・白系ソースは色では識別できないことの明示・emoji の一意と 🥣 不使用・step 68 と late floor 不変・matrix 行の blocker 不変・発見・ORIGINAL の各変種・rendang の pizza は奪われない・Research の文字不変）、`persistence.batch17.test.ts`（7）、`IngredientGlyph.test` の B17 describe（5）、`e2e/b17.spec.ts`。

## 4. 差別化・見分けやすさ

- 識別集合（sauce を含む）で、完全一致・部分集合・上位集合は **0**（late catalog を含む全 recipe）。**0.4 以上の近傍は 0 件**（B15 / B16 のような個別例外は不要）。
- **白系ソースは色では識別できない**: sour-cream `#f1ecdc` と fromage-blanc-sauce `#fffdf8` の ΔE は約 8（基準 20 に届かない。どの白でも届かない）。識別は **専用の dab の形** と文字ラベルで行う（Owner 決定の案 A）。既存ソースの色・描画は変更していない。
- **塗った見た目の実測**（§10.4、Chromium の同一手順・同一の塗りで比較、CIE76。素の生地＝生地中央の円との差）: サワークリーム **15.3**、フロマージュブラン 20.2、トマト 44.1、梅肉 43.5。つまり**塗りの範囲は見えるが淡い**（フロマージュブランより一段淡い）。サワークリームとフロマージュブランの**塗り同士の差は 5.4**（サワークリームのほうがわずかに灰がかって暗い）で、**塗った生地だけでは 2 つの白ソースは見分けにくい**。色は暫定（実機 HV で確定）。
- 白いクリーム系ソースはショップ上で 3 つになる（fromage-blanc-sauce / fresh-cream-sauce（late・ピンク `#efb9b4`・🧈）/ sour-cream）。fresh-cream-sauce は色と絵文字が別。

## 5. 検証（実行 HEAD と結果）

| 検証 | 結果 | 備考 |
|---|---|---|
| 全 Vitest（Pinsa ON） | **11,381 件中 11,365 passed・1 failed → 修正後に解消**（13 skipped / 2 todo、610 files） | 失敗の 1 件は `hint5.alphaFamilyOnly.json` の golden（+1 行）で、更新後に当該 3 テスト（alphaReport / golden55 / DH4 audit）が pass。それ以外の変更はなし |
| 全 Vitest（Pinsa OFF、`TETO_PINSA_OFF=1`） | **11,372 件中 11,353 passed・5 failed → 単独実行で解消**（12 skipped / 2 todo、610 files） | 5 件はすべて 5 秒のテストタイムアウトで、E2E と並行して CPU を使っていた実行中の負荷が原因（`App.lk8Backstop` 2 / `HintSheet.hint5` 1 / `gameReducer.deductionHint` 1 / `gameReducer.dinner` 1）。同 4 ファイルを単独で再実行すると **111/111 passed**。コードの変更はなし |
| `tsc -b` | エラーなし | |
| `oxlint` | exit 0（警告は変更前から存在するもののみ、新規 0） | |
| `npm run build` | 成功 | |
| Chromium E2E `e2e/b17.spec.ts`（390×844 / 360×800） | **各 2/2（計 4/4）passed** | Shop NEW（サワークリーム）→ 購入 → Research（漏えいなし、`？？？ピザ（サワークリーム）`）→ **サワークリームを塗る** → チーズ工程は選ばずに次へ → 牛肉 3・たまねぎ 3・パプリカパウダー 2 → 焼成 → NEW DISCOVERY → 図鑑（schema v2、横スクロールなし、console error なし）。もう 1 本: rendang 未発見で Research に牛肉の cohort 文字とサワークリーム（文字なし）が別々に出る。本環境は Playwright 既定の chromium の版が合わないため、一時 config（未コミット、削除済み）で `/opt/pw-browsers/chromium` を使用 |
| WebKit E2E / CI | **全 11 チェック success**（§7） | 失敗した job を 1 回だけ再実行（§7） |
| iPhone 実機 Safari | **未実施**（Owner の HV） | |

## 6. Visual HV 証跡

- **動画（390×844、mp4）**: ①通し約 33 秒 ②Research 一覧約 10 秒 — Owner へ直接提出済み（リポジトリには入れない）。
- **静止画**（`docs/reports/screenshots/b17/`、各 390×844 / 360×800、新規レシピのため before なし）: ショップ NEW（サワークリーム）、Research エントリ、ソーストレイ（サワークリーム chip）、塗った生地、チーズ工程（選ばずに次へ）、具材トレイ、盛り付け、NEW RECIPE、図鑑、Research（牛肉 cohort とサワークリーム）。
- 観察（Chromium の画像。実機で Owner が確認する点）:
  1. **塗ったサワークリームは淡い**（素の生地との差 ΔE 15.3。フロマージュブランは 20.2）。塗りのみの画面では範囲が分かるが、具材を載せた後（「盛り付け」の画面）は具材に隠れて塗りの範囲は読み取りにくい。色は暫定のまま Owner 決定で維持。**初版のこの項は ΔE 10〜12・「ほとんど見えない」と書いていたが、§10.4 の実測で訂正した。**
  2. ソーストレイのサワークリーム chip は、梅肉の chip より彩度が低く、小さく淡く見える（dab の輪郭は `#6b6a52`）。形で識別できるが、実機の明るさでの見え方は未確認。
  3. チーズ工程は Research の流れとして表示され、選ばずに「次へ」で進める（チーズなしのレシピの正規の作り方）。
  4. ショップの sour-cream 行・図鑑のタグで dab が表示され、🍦 は DOM に出ない（テストで固定）。

## 7. CI・Codex レビュー

PR #743（head `23e72e52d312c8419799234a8595198be5142f89`）。

| 項目 | 結果 |
|---|---|
| Codex レビュー | **完了・指摘 0 件**（自動レビュー、対象 `23e72e5`）。未解決スレッド 0 件 |
| 初回 CI（run 41688599134） | `classify` / `layout-chromium` / `Layout Contract Gate` / `build` / WebKit の 4 shard は success。**WebKit 390×844 の shard 1/3 と 2/3 が各 1 件失敗**し、集約の WebKit Gate も失敗 |
| 失敗 1 | shard 1/3: `e2e/batch14-moussaka.spec.ts:81`（既存の B14 spec）。`chipOnTrayOrPin`（`e2e/support/handPick.ts:13`）で、「前のページ」ボタンが有効と判定された直後に無効になり、5 分のテストタイムアウト。確認と操作の間の競合 |
| 失敗 2 | shard 2/3: `e2e/lunch-rush-r8-restore.spec.ts:147`（既存の Lunch Rush spec）。`page.reload()` 後の `.app-frame` 待ちが 30 秒のテスト上限に到達 |
| 切り分け | どちらも本 PR が触っていない spec で、goulash / sour-cream を使わず、WebKit 390×844 のみ（360×800 は成功）。ローカル Chromium では `batch14-moussaka.spec.ts` は両 viewport とも通過。ルールどおり**失敗した job を 1 回だけ再実行**（コードの変更なし） |
| 再実行後 | **全 11 チェック success**（build / classify / layout-chromium / WebKit 6 shard / WebKit Gate / Layout Contract Gate）。失敗は再現しなかった |

- 上の 2 件は、WebKit の実行時間が長い shard（約 19 分）で起きた既存 spec のタイミング依存で、本 PR の変更とは無関係と判断した。ただし根本原因は特定していない（`chipOnTrayOrPin` の check-then-act は潜在的な競合）。本 PR では spec を変更していない。

## 8. Owner に必要な確認事項

1. **iPhone Safari 実機 HV** と merge 可否（HV の結果は Owner の言葉で記録する）。
2. 共有 Preview の更新（Owner 承認が前提。今回は更新していない）。
3. サワークリームの色（塗りは淡く、フロマージュブランとの差は 5.4）と dab の見え方は暫定。実機で確定。判断事項の一覧は §10.6。
4. step 68 で goulash と late の tarako-cream-pizza が同時に発見可能になること（承認済み）。
5. 原典確認: pizzadb.jp をセッションのネットワーク許可に追加して個別ページを確認するか（現状は未確認のまま）。
6. 先行の持ち越し: `lateCatalog.ts` のコメント（「Production は false」）と値（`true`）の食い違い、`PROJECT_HANDOFF.md` の B13–B16 の記述（今回も未変更）。

## 9. 実施しなかったこと

`PROJECT_HANDOFF.md`・`GameScreen.tsx`・`gameReducer.ts`・`ingredientTaxonomy.ts`・`lateCatalog.ts`・UI・保存仕様の変更、FINISH の制約・privacy gate・グローバルな Jaccard 基準の変更、既存レシピ・採点・既存ソースの色や描画の変更、他の HOLD recipe（caponata・tsukimi・pesto-genovese・jerusalem-mixed-grill）の追加、共有 Preview・Production の更新、merge、不要な CI 再実行、pizzadb.jp の取得（到達不可）、PR #738・Issue #739・PR #740 の変更。

## 10. Final Gate 準備（PR #743、HEAD `ef37a99e60beb26d6680d58d370c1fc958af478e`、2026-11-04）

実装・テスト・アプリのソースは `23e72e52` から変わらない（`ef37a99e` は本書の追記のみ）。以下は **merge・共有 Preview の更新・Production ON を行わずに** まとめた確認結果と手順。

### 10.1 Codex 再レビュー
- Codex の自動レビューは **`23e72e5` に対してのみ**（完了・指摘 0 件・未解決スレッド 0 件）。**最新 HEAD `ef37a99e` に対する再レビューは無い**（push では自動で走らない。docs のみの差分）。
- 再レビューが必要なら、Owner が PR に `@codex review` とコメントする（B16 は Owner 判断で依頼した。PR へのコメントは通知が飛ぶため、Owner の指示なしには投稿していない）。

### 10.2 iPhone Safari HV の対象ビルドと確認方法
- **対象**: PR #743 の HEAD `ef37a99e`（ソースは `23e72e52` と同一）。
- **現在の共有 Preview**（`perusonao/teto-pizza-game-preview`、読み取りのみ）: PR #724、commit `2000dba4fc5cedea844f943848e6de3239a79f91`、Built 2026-11-03T13:39:24Z（README の記載。他セッションが利用中の可能性がある）。**復旧用の SHA として記録済み。上書きしていない。**
- 共有 Preview は `Build & deploy a source PR/branch`（入力 `ref` / `pr_number`）で公開する。**更新ごとに Owner の明示承認が必要**（SESSION-OPERATIONS §5）。Preview の保存キー（`teto-pizza-preview-save-v1`）は全 Preview ビルドで共有されるため、Preview の保存は使い捨てとして扱う。**復旧**は同じ workflow を `ref=2000dba4fc5cedea844f943848e6de3239a79f91` / `pr_number=724` で再実行する。
- **課題**: このゲームの進行では、goulash に到達するには 67 件の credited 発見が要る。**B17 用の検証入口（`?hv=` の seed）は無い**（既存の `?hv=` は Hint 5.0 用のシナリオ）。専用の確認環境が無い状態で共有 Preview に載せても、実機で短い手順では試せない。
- **安全な確認方法（Owner が選ぶ。いずれも既存 Preview を勝手に上書きしない）**:
  1. **（推奨）実機 HV の免除**: B15 の前例（Safari 実機 HV は Owner 判断で免除）。根拠は、Chromium の画像・動画（390×844 / 360×800）、**CI の WebKit E2E（6 shard 全て success）**、Codex 指摘 0 件。HV の正式な PASS / 免除は Owner が決める（本セッションは代筆しない）。
  2. **B17 専用の検証入口を足してから共有 Preview に 1 回だけ公開**: `src/preview/hvSeeds.ts` に B17 用の seed（goulash 以外の全レシピ発見済み、step 67 までの食材を所持、Pitz 999 など）を追加する。Preview ビルドのみで有効で、Production のバンドルに出ないことは既存の `previewIsolation.gate.test` が検査する。**コードの追加なので Owner の承認が必要**（この PR に積むか別 PR にするかも Owner 判断）。続けて **Preview の更新にも別途 Owner の承認**が要る。公開後は HV を行い、`2000dba4` / #724 に復旧する。
  3. **PC のローカル開発サーバ**（`npm run dev -- --host` に iPhone を LAN 接続）: このクラウド環境からは使えない。Owner の PC が前提で、「PC を前提にしない」という標準ワークフローに反するため非推奨。
- ローカルの WebKit は、この環境に入っていない（Chromium のみ）。WebKit の自動確認は CI の実行結果による。

### 10.3 390×844 / 360×800 の自動スクリーンショット（Chromium、`docs/reports/screenshots/b17/`）
全 20 枚 + 比較シート 2 枚を確認した。項目別の判定（**自動撮影の判定であり、実機 HV の判定ではない**）:

| 項目 | 判定 | 根拠 |
|---|---|---|
| ショップ NEW（サワークリーム行・dab・「NEW 入荷」・初回 120 Pitz） | PASS | `b17-sour-cream-new-*`。重なり・はみ出しなし |
| Research エントリ（`？？？ピザ（サワークリーム）`、漏えいなし） | PASS | `b17-goulash-pizza-research-entry-*`、E2E の漏えい検査 |
| ソーストレイ（サワークリーム chip） | PASS（要改善の余地あり） | dab は形で識別できる。梅肉の chip より淡く小さい（§10.4） |
| 塗った生地 | 要改善の余地あり | 範囲は見えるが淡い（§10.4）。色は Owner 決定の暫定 |
| チーズ工程（選ばずに次へ） | PASS | `b17-goulash-pizza-no-cheese-step-*`。チーズなしのレシピの正規の流れ |
| 具材トレイ・盛り付け（beef 3・onion 3・paprika 2） | PASS | 8 個が収まる。塗りは具材に隠れて読み取りにくい |
| NEW RECIPE（No.43、第 4 章 51/51、★3、+133 Pitz） | PASS | `b17-goulash-pizza-new-recipe-*` |
| 図鑑 / Research 一覧（牛肉の cohort とサワークリームが別々） | PASS | `b17-goulash-pizza-dex-*`、`b17-research-entries-*` |
| 横スクロール・console error | PASS | E2E で毎画面 assert（両 viewport） |

### 10.4 サワークリームの専用アイコン・塗布表現・既存白ソースとの識別性
追加撮影（`docs/reports/screenshots/b17/b17-sauce-compare-390x844.png` / `…-360x800.png`: 上段 = ソース chip、下段 = 同じ塗り（半径 25%・16 点）をした生地。フロマージュブラン / サワークリーム / トマト / 梅肉）。

| 観点 | 結果 | 判定 |
|---|---|---|
| chip の識別（既存の白ソース） | フロマージュブランは 🥛 のグラス、サワークリームは灰緑の輪郭のクリームの山（うず巻き＋ピーク）で、**形がまったく違う**。文字ラベルも別 | PASS |
| chip の大きさ・存在感 | dab は梅肉の dab・他の絵文字 chip に比べて**小さく淡い**（輪郭が薄い灰緑）。単独でも「白いクリーム」とは読めるが、実機の明るさでは弱い可能性 | 要改善（実機で判断） |
| 塗った色（素の生地中央との ΔE、390 / 360 とも同値） | サワークリーム 15.3 / フロマージュブラン 20.2 / トマト 44.1 / 梅肉 43.5 | 範囲は見えるが淡い |
| 塗った色の 2 つの白ソース同士 | **ΔE 5.4**（サワークリームのほうがわずかに灰がかって暗い）。塗った生地だけでは見分けにくい | 要判断 |
| 既存ソースの描画・色への影響 | 無し（既存の色・描画はテストで固定、画像でも同一） | PASS |

- **評価**: chip（選ぶ場面）では形と文字で識別できる。生地の上（塗った後）では 2 つの白ソースはほぼ同じに見えるが、これは Owner 決定の色（`#f1ecdc`）の帰結で、**レシピの識別は材料の集合で行われる**（ソースは別 id）ため、遊びの正しさには影響しない。見た目の改善は Owner が望む場合のみ（案: ① dab の輪郭を濃く・大きく（梅肉の dab と同等に）② 色をやや温かい方向へ。②は「色は暫定 `#f1ecdc`」の Owner 決定の変更になる）。
- 計測は Chromium の画面（sRGB・デバイス像）で、実機 Safari の色再現とは異なり得る。

### 10.5 Discovery step 68・レシピ完成・保存復帰の確認手順
**自動で確認済みのもの**（Chromium E2E + 単体テスト + CI の WebKit）と、**実機で行う手動手順**を分ける。

| 確認 | 自動（済） | 実機の手順（Owner） |
|---|---|---|
| step 68 の解禁 | `persistence.batch17.test`（67 件では sour-cream 未解禁、68 件で sour-cream・cod-roe・fresh-cream-sauce・nori が同時に解禁、何も取り上げない）、`expansionBatch17.test`（step 68・前提食材・late floor 不変） | ① 検証用の保存（goulash 以外すべて発見済み・step 67 までの食材所持）で開く ② ショップで「サワークリーム NEW 入荷」と、late の食材（たら子 / クリームソース / のり）の NEW を確認 ③ 購入して在庫 10 を確認 |
| Research の表示 | E2E（`？？？ピザ（サワークリーム）`、漏えいなし、牛肉の cohort A / B は不変） | 図鑑の Research 一覧に、サワークリームの未発見エントリが文字なしで出ること |
| レシピ完成 | E2E（生地 → ソースにサワークリームを塗る → チーズは選ばず次へ → 牛肉 3・玉ねぎ 3・パプリカ 2 → 焼成 → NEW DISCOVERY） | 同じ手順を iPhone で操作し、ソース工程でサワークリームを塗れること、チーズ工程が「選ばずに次へ」で進むこと、結果が「グヤーシュピザを発見」（★・Pitz）になること、「違うソース / 具材」では ORIGINAL になること |
| 保存復帰 | `persistence.batch17.test`（schema v2 のまま・新 id の往復・既存 Dex 不変・未知 id の保持）、E2E の schema v2 確認 | 発見後に**アプリを閉じて開き直し**、図鑑に No.43 が残る・ショップの在庫が保たれる。Preview の保存は使い捨て（共有キー）なので、検証後に消してよい |
| 既存への影響 | 全 Vitest・CI | トマト / フロマージュブラン / 梅肉のソース、ムサカ風 / 梅しそ / rendang の発見が従来どおりであること（任意） |

### 10.6 Owner 判断が残る事項（merge の前）
1. **iPhone Safari 実機 HV**: 実施するか、B15 の前例のとおり免除するか（§10.2 の 1 / 2 / 3）。実施する場合は B17 専用の検証入口の追加（コード、Owner 承認）と共有 Preview の更新（Owner 承認、復旧は `2000dba4` / #724）が要る。
2. **Codex の再レビュー**: 最新 HEAD に対して `@codex review` を依頼するか（docs のみの差分）。
3. **サワークリームの見た目**: ① chip の dab を大きく・輪郭を濃くするか ② 色（暫定 `#f1ecdc`）を変えるか ③ このまま実機 HV まで暫定維持するか。2 つの白ソースは塗った生地では見分けにくい（ΔE 5.4）。
4. **step 68 の同時解禁**（承認済み）が実機で自然に見えるか。
5. **原典の確認**: pizzadb.jp をネットワーク許可に追加して goulash の個別ページ（材料・ソース・投入のタイミング）を確認するか。確認できない間は GAMEPLAY ASSUMPTION のまま。
6. **先行の持ち越し**: `lateCatalog.ts` のコメントと値の食い違い、`PROJECT_HANDOFF.md` の B13–B16 の記述（今回も未変更）、WebKit の既存 spec 2 件（§7）の潜在的なタイミング依存。
7. 判定の記録: **HV の PASS / 免除・Final Gate・merge は Owner の判断**であり、本セッションは代筆しない。
