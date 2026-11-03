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
- 生地に塗った見た目（半透明 0.85）は生地との差が ΔE 10〜12 で小さく、**塗った直後は「薄い白いソースが乗った」程度にしか見えない**（§6 の観察 ①）。色は暫定（実機 HV で確定）。
- 白いクリーム系ソースはショップ上で 3 つになる（fromage-blanc-sauce / fresh-cream-sauce（late・ピンク `#efb9b4`・🧈）/ sour-cream）。fresh-cream-sauce は色と絵文字が別。

## 5. 検証（実行 HEAD と結果）

| 検証 | 結果 | 備考 |
|---|---|---|
| 全 Vitest（Pinsa ON） | **11,381 件中 11,365 passed・1 failed → 修正後に解消**（13 skipped / 2 todo、610 files） | 失敗の 1 件は `hint5.alphaFamilyOnly.json` の golden（+1 行）で、更新後に当該 3 テスト（alphaReport / golden55 / DH4 audit）が pass。それ以外の変更はなし |
| 全 Vitest（Pinsa OFF、`TETO_PINSA_OFF=1`） | §7 に追記 | |
| `tsc -b` | エラーなし | |
| `oxlint` | exit 0（警告は変更前から存在するもののみ、新規 0） | |
| `npm run build` | 成功 | |
| Chromium E2E `e2e/b17.spec.ts`（390×844 / 360×800） | **各 2/2（計 4/4）passed** | Shop NEW（サワークリーム）→ 購入 → Research（漏えいなし、`？？？ピザ（サワークリーム）`）→ **サワークリームを塗る** → チーズ工程は選ばずに次へ → 牛肉 3・たまねぎ 3・パプリカパウダー 2 → 焼成 → NEW DISCOVERY → 図鑑（schema v2、横スクロールなし、console error なし）。もう 1 本: rendang 未発見で Research に牛肉の cohort 文字とサワークリーム（文字なし）が別々に出る。本環境は Playwright 既定の chromium の版が合わないため、一時 config（未コミット、削除済み）で `/opt/pw-browsers/chromium` を使用 |
| WebKit E2E / CI | PR の CI で確認（§7 に追記） | 不要な再実行はしない |
| iPhone 実機 Safari | **未実施**（Owner の HV） | |

## 6. Visual HV 証跡

- **動画（390×844、mp4）**: ①通し約 33 秒 ②Research 一覧約 10 秒 — Owner へ直接提出済み（リポジトリには入れない）。
- **静止画**（`docs/reports/screenshots/b17/`、各 390×844 / 360×800、新規レシピのため before なし）: ショップ NEW（サワークリーム）、Research エントリ、ソーストレイ（サワークリーム chip）、塗った生地、チーズ工程（選ばずに次へ）、具材トレイ、盛り付け、NEW RECIPE、図鑑、Research（牛肉 cohort とサワークリーム）。
- 観察（Chromium の画像。実機で Owner が確認する点）:
  1. **塗ったサワークリームは生地とほぼ同色で、盛り付けの画面では塗りの範囲がほとんど見えない**（ΔE 10〜12）。色は暫定のまま Owner 決定で維持。
  2. ソーストレイのサワークリーム chip は、梅肉の chip より彩度が低く、小さく淡く見える（dab の輪郭は `#6b6a52`）。形で識別できるが、実機の明るさでの見え方は未確認。
  3. チーズ工程は Research の流れとして表示され、選ばずに「次へ」で進める（チーズなしのレシピの正規の作り方）。
  4. ショップの sour-cream 行・図鑑のタグで dab が表示され、🍦 は DOM に出ない（テストで固定）。

## 7. CI・Codex レビュー

PR 作成後に追記する。

## 8. Owner に必要な確認事項

1. **iPhone Safari 実機 HV** と merge 可否（HV の結果は Owner の言葉で記録する）。
2. 共有 Preview の更新（Owner 承認が前提。今回は更新していない）。
3. サワークリームの色（生地との差が小さい件）と dab の見え方は暫定。実機で確定。
4. step 68 で goulash と late の tarako-cream-pizza が同時に発見可能になること（承認済み）。
5. 原典確認: pizzadb.jp をセッションのネットワーク許可に追加して個別ページを確認するか（現状は未確認のまま）。
6. 先行の持ち越し: `lateCatalog.ts` のコメント（「Production は false」）と値（`true`）の食い違い、`PROJECT_HANDOFF.md` の B13–B16 の記述（今回も未変更）。

## 9. 実施しなかったこと

`PROJECT_HANDOFF.md`・`GameScreen.tsx`・`gameReducer.ts`・`ingredientTaxonomy.ts`・`lateCatalog.ts`・UI・保存仕様の変更、FINISH の制約・privacy gate・グローバルな Jaccard 基準の変更、既存レシピ・採点・既存ソースの色や描画の変更、他の HOLD recipe（caponata・tsukimi・pesto-genovese・jerusalem-mixed-grill）の追加、共有 Preview・Production の更新、merge、不要な CI 再実行、pizzadb.jp の取得（到達不可）、PR #738・Issue #739・PR #740 の変更。
