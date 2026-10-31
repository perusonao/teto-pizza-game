# Expansion Batch 12 — Result Report（supreme-pizza / pizza-alla-norma + ricotta-salata）

Status: **実装完了・自動ゲート結果は §6。Owner の承認（§8）と実機 HV の前は merge しない。共有 Preview・Production は更新していない。** 基準 `main` `c972756`。Issue #707。

## 0. 暫定仕様・原典未確認（GAMEPLAY ASSUMPTION）

**原典（pizzadb.jp）には到達しておらず、未確認。** 次はすべて GAMEPLAY ASSUMPTION / CALIBRATION: 各レシピの個数・配置（合計 8 ピース = 8 スロットのリング）、焼成窓 58–78、名称・説明文、`ricotta-salata` の色・字形・サイズ、`supreme-pizza` の `ladderCredit:false`。根拠は 172 matrix の行（素材集合）のみ。同じ文言を `recipes.ts` / `ingredients.ts` / `referencePizza.ts` / `recipeSauceProfiles.ts` と各テストのコメントに記した。

## 1. 選定（172 matrix から。柚子えび・ナスタヒニは #662 / #673 で出荷済みのため代替）

| # | レシピ | 構成（matrix の identity set） | 新食材 | credit |
|---|---|---|---|---|
| 1 | `supreme-pizza` スプリームピッツァ（`supreme-pizzadb`） | tomato-sauce / pepperoni 2 / sausage 2 / mushroom / onion / bell-pepper / black-olive | **なし** | 非 credit（`ladderCredit:false`、専用 step なし） |
| 2 | `pizza-alla-norma` ピッツァ・アッラ・ノルマ（`pizza-alla-norma-pizzadb-p9`） | tomato-sauce / eggplant 3 / ricotta-salata 3 / basil 2 | `ricotta-salata`（cheese、専用 SVG、1 種） | credited、通常 ladder step 64 |

**選定理由**
- Phase-2 の承認済み target（SHIPPED_KEEP）で未出荷のものは、どれも未実装の機構（生地種別・パン・ZONED・MULTI_SPREAD・包み・揚げ）を要する。新機構を要さない行は BLOCKED_PRODUCT_DECISION の 2 行（本 PR の対象）だけだった。
- 除外: 月見（Owner HOLD / DH4）、bulgogi・yakiniku（HOLD）、quattro-stagioni（四分割 ZONED）、pescatore 系・sfincione・burrata 系（2 本目の塗り層）、zucchine-menta・asparagi-limone（「生」の機序解釈が未決 = 原典確認待ち）、frutti-di-mare（pescatore と命名クラスタ、識別が難しい）、`unspecified_sauce_base` / 未解決トークンの行（原典確認待ち）。
- supreme-pizza は過去に見送られた（`recipes.ts` の Batch 1B-C の注記）。理由は catalog 構成が mozzarella を含む 7 種で 8 スロットに収まらないこと。PIZZA DB の構成は mozzarella を含まず 6 種（veggie-supreme と同数）なので当たらない。id は `supreme-pizza` とし、`supreme` 不在の pin は維持した。
- 名称: 原典名 スプリームピザ は既存の ベジースプリームピザ の部分文字列になり、「未発見レシピの名前が DOM に出ない」テストが衝突するため、`スプリームピッツァ` とした（暫定名）。

**Duplicate Gate（2026-10-30）**: 同 id・同材料集合の既存レシピなし（80 件と全比較）、open PR / Issue に重複なし。

## 2. 変更の要点

| 領域 | 内容 |
|---|---|
| 食材 | `ricotta-salata`（cheese、size l、T4 初回 120 / 補充 60 Pitz、星ゲートなし）。専用 SVG `ricotta-salata-shavings`（薄い巻いた削り片。ricotta の丸い山・feta の角切りと取り違えない形）。既存の cheese 同様、topping family 行は不要 |
| レシピ | 両方 `lunchRush:false`・CUT なし・key-free Hint・窓 58–78・報酬 100。tomato-sauce の PAINT（既存の 1 ソース工程） |
| ladder | 通常 **step 64 = ricotta-salata（key `pizza-alla-norma`）**。凍結は step 63 まで。late は導出で 65–71（+1）、`LATE_ENTITLEMENT_FLOORS` は不変（テストで固定） |
| Reference | 両方 RT-01 の 8 点リング、basil は `LIGHT_LEAF` |
| 触れていない | 採点・経済・保存形式（schema v2）・Production スイッチ・`lateCatalog.ts`・共有 Preview |

## 3. #561 slack・図鑑・解禁への影響

- **#561 slack**: supreme-pizza は非 credit かつ step なし。alla-norma は credited + 専用 step（credited +1、step +1）なので slack は不変。`ladderReachability.starGate` 系は全体実行で通過（§6）。
- **図鑑**: 章 3 が 18 → 19（supreme-pizza、スロット 19）、章 4 が +1（alla-norma）。既存レシピの章・No. は不変（`CHAPTER_IDENTITY` 検査）。
- **解禁**: alla-norma は ricotta-salata を購入（step 64 = 63 件目の key を発見後）して初めて作れる。supreme-pizza は既存素材だけなので、bell-pepper（step 28）購入後から Research の対象。
- **保存互換**: schema v2 のまま・移行なし。新素材・新 Dex id を持つ保存は読み書きで保たれ、旧ビルドが知らない id は再保存でも残る（`persistence.batch12b.test.ts`）。既存の保存の late 素材の解禁は後退しない（floors 不変、`materialEntitlement.lateFloor.test.ts`）。

## 4. 既存への影響（Owner が見るべき点）

1. **Research ラベルのずれ 1 件（要 Owner 確認）**: supreme-pizza の解禁素材は bell-pepper（step 28）で、既に spanish-chorizo-pizza がいる単独コホート。2 人組になり、supreme-pizza = A、**spanish-chorizo-pizza は無印 → B**。Batch 8a の chilean / frango と同種。`B12_BATCH.acceptedLetterShifts = { "spanish-chorizo-pizza": "-->B" }` に明示し、他の既存レシピの文字は不変（`expansionBatch12b.test.ts` で全 prefix を検査）。alla-norma は単独コホート（文字なし）。
2. **Hint 価格キャップの例外が 3 件目**: supreme-pizza は 7 種の素材（tomato-sauce + 6）で、veggie-supreme-pizza・pescatore と同じ規則・同じ 5 つ目の事実のゼロ化になる（`selectableHint.test.ts` の `capBinds`）。規則は不変。
3. **DH4 の「単一候補」固定リストに pizza-alla-norma を追加**: melanzane / parmigiana と同じく、最小 prefix で H が 1 候補になる。fail-closed（existence・topping clause なし）は全メンバーで検証済み。ハードガードの漏えいは 0 のまま。legacy DH4-2A の件数が 199 → 211（privacy 検査は無改変で通過）。
4. **BLOCKED_PRODUCT_DECISION 行の採用（Owner 承認例外）**: 両 matrix 行は未出荷 catalog 候補との構成差（COMPOSITION_CONFLICT_CANDIDATE）で BLOCKED。B10 / B11 と同様、**PIZZA DB の構成を採用する承認例外**を `discoveryCatalog.test` / `matcher.test` に置いた（承認は Owner、PR は承認まで merge しない）。matrix は不変。`expansionBatch12b.test.ts` が target の items が matrix の identity set と一致することを固定する。catalog 候補 `alla-norma`（mozzarella / olive-oil 入り）は採用していない。
5. **テスト基盤の 1 件**: `discoveryHint.walk.test.ts` の固定 stage guard 80 を `RECIPES.length + 20` に（B11 S1 の researchAttemptSim と同じ根本原因: 1 stage = 1 レシピなので 80 件目で歩行が打ち切られ 2 件を取りこぼす）。assertion・timeout は不変。

## 5. 新規・更新テスト

- 新規: `expansionBatch12b.test.ts`（材料・レシピ構造・Reference・集合の一意性（部分集合 / 上位集合なし）・step 64・late +1・matrix との一致・**Free Cooking / Research の完走（Completion Gate PASS、Scoring 2.0 のソース量 / 被覆 > 0.95、UNIQUE_MATCH → NEW_DISCOVERY、余分 / 不足で発見しない）**・解禁と Research ラベル）、`persistence.batch12b.test.ts`（保存互換）、`e2e/batch12-supreme-norma.spec.ts`（390×844・360×800 の通し）、`IngredientGlyph.test.tsx` の Batch 12 契約。
- 更新（意味の変更なし、件数・導出番号・一覧のみ）: `catalogLedger`（82 / 74 / 93 / 71 / [6,12,19,45]、cheese 棚 14）・`recipes`・`cookingProfiles`・`lunchRush.exclusion`（opt-out 49）・`progression`・`recipeChapters`・`materialShop`（step 64 追加、late +1）・`materialEntitlement.batch6 / lateFloor`・`lateCatalog.bbq / late4`・`expansionBatch11.s1`・`discoveryProgressionModel`・`discoveryExpansion2.wave2`・`researchLabels.batch8a`・`researchCohortLetter`・`DexOverlay.researchIdentity`・`hint5Ladder.baseCompat`（key-free 56、sauce+cheese 28、sauce のみ 9）・`deduction*`。
- golden: `hint5.ladders55.json` は**挿入のみ**（既存エントリの削除・変更 0 行）、`hint5.alphaFamilyOnly.json` は +2 行（既存値は不変）、DH4-1 監査 JSON は category 件数 +1 のみ（生成物として再生成、手編集なし）。

## 6. 検証結果

| ゲート | 結果 |
|---|---|
| `tsc -b` | エラー 0 |
| `oxlint` | エラー 0（警告は既存） |
| `npm run build` | 成功（chunk サイズの警告は既存） |
| Vitest 全体（Pinsa ON） | **10,728 件中 10,713 passed / 0 failed**（13 skipped、2 todo） |
| Vitest 全体（`TETO_PINSA_OFF=1`） | **10,719 件中 10,705 passed / 0 failed**（12 skipped、2 todo） |
| E2E `e2e/batch12-supreme-norma.spec.ts`（Chromium、390×844 と 360×800 × 2 レシピ） | **4/4 passed**（Shop → Research ラベル（漏えいなし）→ 調理 → NEW DISCOVERY → Dex、横スクロールなし、console error 0） |
| WebKit E2E | 本環境では未実施（WebKit なし）。PR の CI の WebKit シャードで確認する |
| Safari / iPhone 実機 | **未実施**（Owner の HV） |

E2E は環境の Playwright が要求するブラウザ版と入っているものが違うため、リポジトリに含めないローカル設定（`playwright.local.config.ts`、`.git/info/exclude`）で `/opt/pw-browsers/chromium-1243` を指定して実行した。リポジトリの設定は変更していない。

## 7. Human Verification

スクリーンショット: `docs/reports/screenshots/b12/`（36 枚、390×844 と 360×800）。新食材は main に存在しないので **before は無い**（新規）。既存の ricotta / feta / mozzarella の見え方は変更していない（`IngredientGlyph.test.tsx` で SVG の相違を固定）。

**Human Verification Videos**（動画はリポジトリに含めず、セッション内で直接提出）

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| `b12-hv-supreme-pizza-390x844.mp4` | 390×844 | 30.6 s | 605,245 B | PASS |
| `b12-hv-pizza-alla-norma-390x844.mp4` | 390×844 | 33.0 s | 615,913 B | PASS |

Download: セッション内直接提出（`SendUserFile`）。codec H.264（yuv420p、25 fps、音声なし）、`e2e/batch12-supreme-norma.spec.ts` を `HV_VIDEO=1`（各状態 1〜3 秒保持）で録画し ffmpeg で WebM から MP4 に変換。
内容: HOME → Shop（supreme-pizza は NEW 行なし / alla-norma は ricotta-salata の NEW 行 → 購入）→ 図鑑の Research ラベル → 調理（SAUCE → CHEESE → TOPPING）→ 焼成 → RESULT（NEW PIZZA）。
Video Verification: PASS（ファイルが存在し size > 0、`ffmpeg -f null` で最後まで復号できる、390×844 の全画面が映る、対象操作が映る、等間隔 8 フレームで全工程を確認）。

### 7.1 セッションの目視所見（Owner の `PASS` ではない）

- 表示不良（はみ出し・重なり・切れ）: 見つからず。E2E の `noOverflow` も 390 / 360 で通過、console error 0。
- ricotta-salata: チーズ盤面で白い巻いた削り片として読める。トレイ chip でも潰れない。**ただし淡い生地・トマトの上で ricotta（丸い山）と同じ白系なので、実機で取り違えないか要確認**。
- supreme-pizza: 6 種のトッピングが 8 スロットに載り、パプリカ・きのこ・玉ねぎ・ペパロニ・ソーセージは区別できる。**中央スロットのブラックオリーブが小さく灰色で目立たない**（既存の食材・既存のリング配置で、今回の変更ではない）。
- 動画は Chromium の録画（WebKit ではない）。Safari / iPhone 実機は未確認。

## 8. 残る判断事項（Owner）

1. 両レシピの BLOCKED_PRODUCT_DECISION 行の採用（PIZZA DB 構成、catalog 候補 `alla-norma` / `supreme` は不採用）の承認。
2. spanish-chorizo-pizza の Research ラベルが無印 → B になること（§4-1）の承認。
3. Hint 価格キャップ例外の 3 件目（supreme-pizza、§4-2）の承認。
4. `ricotta-salata` の色・字形・サイズ、`supreme-pizza` の名称（スプリームピッツァ）・個数配分の最終確認（実機 HV）。
5. 共有 Preview の更新と main への merge（行っていない。Owner 承認待ち）。
