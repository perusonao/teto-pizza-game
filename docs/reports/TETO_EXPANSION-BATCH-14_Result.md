# Expansion Batch 14 — Result Report（moussaka-style-pizza + cinnamon）

Status: **実装・自動検証は完了。Owner の承認と iPhone Safari 実機 HV の前は merge しない。共有 Preview・Production は更新していない。** PR #723（Ready for review）。基準 `main` `ebbe119`（#721 merge 済み）。作業ブランチ `claude/batch-14-implementation-j2jzyr`。Issue は無し（Owner 指示の Batch）。

## 0. 暫定仕様・原典未確認（GAMEPLAY ASSUMPTION）

**原典（pizzadb.jp）には到達しておらず、未確認。** 根拠は 172 matrix の行 `moussaka-style-pizza-pizzadb-p13`（材料 cinnamon / eggplant / feta / lamb、ソース欄「ホワイトソース」）のみ。次はすべて **GAMEPLAY ASSUMPTION / CALIBRATION（原典ではない）**:

- 個数（feta 2 / eggplant 2 / lamb 2 / cinnamon 2 = 非ソース 8 ピース = 8 スロットのリング）、焼成窓 58–78（汎用の Free Cooking 窓）、名称・説明文、`cinnamon` の色（`#b9733a`）・字形。
- **cinnamon を焼成の前に加えるか後に加えるかは原典未確認。** TOPPING 工程（焼成前）に置いた。matrix の「薄い生地」は再現していない。
- 白ソース: matrix の「ホワイトソース」は canonicalizer が曖昧のまま残している（関連 id は `fromage-blanc-sauce` のみ）。**Owner 判断（このレシピ 1 件限り）として、既存の `fromage-blanc-sauce`（PAINT）を充当。NO_SAUCE の例外ではない。** Phase 2 の matrix の行は `BLOCKED_PRODUCT_DECISION`（UNRESOLVED_INGREDIENT）のまま変えていない。

## 1. 内容

| 項目 | 内容 |
|---|---|
| レシピ | `moussaka-style-pizza` ムサカ風ピザ（`moussaka-style-pizza-pizzadb-p13`）。fromage-blanc-sauce 1（PAINT）/ **feta 2 / eggplant 2 / lamb 2 / cinnamon 2**。`ladderCredit` あり（credited）、`lunchRush:false`、key-free Hint（永続）、**CUT なし**（CUT 許可リストは不変）、bake 58–78 |
| 新食材 | `cinnamon` シナモン。**topping（scatter）**・family `spice`・size class `s`・色 `#b9733a`・専用 SVG `cinnamon-powder-pile`（粉末の山。`paprika-powder-pile` と同じ文法で、より薄く平たい）。🍪 は表示されないテキスト代替のみ（他の食材と重複しない） |
| ladder | 通常 **step 66 = cinnamon（key `moussaka-style-pizza`）**、T4・星ゲートなし・k=2（在庫 20、120 / 補充 60）。1–65 は凍結。late は導出で +1（67–73）、`LATE_ENTITLEMENT_FLOORS` は**不変** |
| Reference | 8 点リング（RT-01）を `requiredIngredients` の順（feta → eggplant → lamb → cinnamon）に連続割当 |
| 触れていない | 採点・経済・保存形式（schema v2）・Production スイッチ・`lateCatalog.ts`・共有 Preview |

## 2. 影響（Owner が見るべき点）

- **件数**: recipes 84（Pinsa 有効なら 85）、credited 76、ingredients 95、toppings 68、ladder steps 73、第 4 章 47（Pinsa 有効なら 48）。Lunch Rush のプール 25 は不変（moussaka は opt-out）。
- **step 66 は 2 レシピ同時解禁（維持）**: cinnamon（ムサカ風ピザ）と、固定 late floor の `bbq-sauce`（=66）が同じ件数で重なり、**ムサカ風ピザと BBQチキンピザが同時に発見可能になる**。Inspector の 66 行で確認（「シナモン / ムサカ風ピザ / BBQチキンピザ」）。57–60 の late floor と同じ性質。`LATE_ENTITLEMENT_FLOORS` は変えていない。
- **Research**: cinnamon は step 66 の唯一の素材で、moussaka だけのコホート → ラベルは「？？？ピザ（シナモン）」（文字なし）。既存レシピのラベルは動かない。
- **Hint 5.0**: `hint5.ladders55.json` は**挿入のみ**（+251 / −0、既存エントリ不変）。`hint5.alphaFamilyOnly.json` は spice family が拡大するため既存 2 件の値が動く（`eggplant-dengaku-pizza` 71→94、`wasabi-beef-pizza` 531→666）。新規 `moussaka-style-pizza: 396`。DH4 audit（`TETO_DISCOVERY-HINT-4_DH4-1_AUDIT.json`）は category / group の番号シフトのみ（25 行ずつ。ヒントの内容・伏せる食材のフィールドは不変）。
- **保存互換**: schema v2 のまま、新 id の追加のみ（`persistence.batch14.test.ts`）。
- **既存の「承認例外」配列**: `discoveryCatalog.test.ts` と `matcher.test.ts` に moussaka の BLOCKED_PRODUCT_DECISION 例外（Owner 承認、この 1 件限り）を追加。

## 3. 初期 WIP（`5ed883b`）からの修正

初期コミットは「検証前」の WIP だった。次を直した。

| 修正 | 内容 |
|---|---|
| **実バグ（順序）** | `requiredIngredients` が cheese（feta）を toppings の後ろに置いていたため、**Rule W の予約食材（lamb）と、旧 Hint 2.0 の H4 が伏せる食材（feta）が不一致**（`selectableHint` / `hintFactMigration` が失敗）。`sauce, feta, eggplant, lamb, cinnamon` の順に修正し、Reference のリング割当も同順にした（他レシピの慣例どおり cheese → toppings）。Rule W 自体・テストの期待は変えていない |
| 型エラー | `expansionBatch14.test.ts` の `noSauceRecipeIds().includes`（TS2345）。assertion の内容は不変 |
| E2E spec | 具材トレイが改ページされるため、cinnamon チップを `chipOnTrayOrPin` で画面内に出してから寸法を計測（計測順のみ） |
| 件数 pin ほか | B13 と同じ手順で再導出: catalogLedger、ladder step（late +1）、CUT 非適格一覧、Lunch Rush opt-out 一覧、`materialShop`（cinnamon 行 + late +1）、`lateFloor`、progression の一覧（並び順を含む）、multi-recipe（step 66）、Hint 5.0 の件数・population、DH4 audit、golden |
| ladder の導出テスト | `discoveryLadder.test.ts` / `discoveryLadder.appendOnly.test.ts` の凍結範囲を step 1-63 → 1-65 に拡大。規則を丸ごと再適用すると、タイブレークで cinnamon が ricotta-salata より前に並ぶため（ladder は「追記のみ」で、本番データは不変）。導出されるのは最新の step 66 のみ |

### privacy assertion

**緩めていない。** `deductionGuard.gate.test.ts` で変わったのは、**旧 DH4-2A（legacy）がリークする件数の診断値のみ（225→211）**。これは B10〜B13 で毎回再計測してきた値で、syntheticな family が TOPPINGS の配列 index で切られること、仮説を引く公開カタログにレシピが増えることで動く。hardened guard の `toEqual([])` は全構成で変更なしに通過した。skip・timeout の延長・`-u` による失敗の黙殺は行っていない（スナップショットの更新は、差分が番号シフトと挿入のみであることを確認したうえで実施）。

## 4. 検証

- 全 Vitest: **Pinsa ON 576 files passed（+1 skipped）・10,912 passed・0 failed（13 skipped / 2 todo）／ Pinsa OFF（`TETO_PINSA_OFF=1`）576 files passed（+1 skipped）・10,904 passed・0 failed（12 skipped / 2 todo）**。`tsc -b` 0 error、oxlint error 0（警告は変更前から存在するもののみ）、`npm run build` 成功。
- Chromium E2E（`batch14-moussaka`）: 390×844 / 360×800 とも 1/1 passed（Shop NEW → 購入 → Research（漏えいなし）→ 白ソースを塗る → フェタ → 具材 → 焼成 → NEW DISCOVERY → 図鑑）。近傍の `b11-s1` / `b12` / `batch12-supreme-norma` / `batch13-potato-mayo` も 390×844 で 7/7 passed。
- **CI（HEAD `aeaa8c2`）: 11/11 success**（build、classify、layout-chromium、WebKit 6 shard（360×800 と 390×844 の各 shard 1〜3）、WebKit Gate、Layout Contract Gate）。
- 実測（Chromium、CSS px。`docs/reports/screenshots/b14/measure-*.json`）:

| 項目 | 390×844 | 360×800 |
|---|---:|---:|
| トレイ chip の cinnamon アイコン | 31.2 | 31.2 |
| ショップのアイコン | 16.8 | 16.8 |
| 生地上の feta（白ソースの上） | 34.8 | 35.5 |
| 生地上の cinnamon | 29.4 | 27.9 |

- **WebKit・iPhone Safari の実機は Owner の HV**（セッションは PASS を代行しない）。Codex レビューは §6 を参照。

## 5. Owner 判断事項・HV で見てほしい点

1. **cinnamon の見え方**: 粉末の山として、トレイの chip（20〜24px 相当の識別）と生地上で読めるか。`paprika-powder` など他の粉末との取り違え、白ソース・フェタ・ナス・ラムの上での視認性。色 `#b9733a` は **PROVISIONAL**（実機で再評価）。
2. **size class `s`** の妥当性（生地上で 28〜29px 前後）。
3. 名称「ムサカ風ピザ」と説明文（暫定）。
4. **白ソースの充当**（`fromage-blanc-sauce`、このレシピ 1 件限り）の維持。原典確認は未了。
5. **cinnamon を焼成前に置く仮定**（原典では焼成の前後が不明）。
6. **step 66 の 2 レシピ同時解禁**（ムサカ風 + BBQチキン）が意図どおりか。
7. **iPhone 実機 HV（Owner）**: §7 の確認項目。

## 6. PR・CI・レビュー

- PR: https://github.com/perusonao/teto-pizza-game/pull/723 （Draft を Owner 承認のもと 2026-11-01 に解除。**merge は未承認**）。
- **`main` の更新**: PR 作成後に `main` が `7f3aa63`（#722、cooking-prep の余白・はみ出し修正）へ進んだ。本 PR とはファイルが重ならず、`git merge-tree` で衝突なしを確認した。**`main` はこの PR に取り込んでいない**（HEAD を変えないため。必要なら merge 前に Owner の指示で取り込む）。
- Codex レビュー: PR 本文の更新後の状態は Result Report（チャット）を参照。

## 7. iPhone Safari HV 用の成果物と確認項目

**画像**（リポジトリ内、`docs/reports/screenshots/b14/`。390×844 と 360×800 の各 9 枚 + 実測 JSON）:

| ファイル（`-iphone-390x844` / `-iphone-360x800`） | 見るポイント |
|---|---|
| `b14-cinnamon-new-*` | ショップの NEW 表示（シナモンのアイコン 16.8px） |
| `b14-moussaka-style-pizza-new-recipe-*` | 新レシピの発見表示 |
| `b14-moussaka-style-pizza-research-entry-*` | Research の「？？？ピザ（シナモン）」（**未発見の情報が出ていない**） |
| `b14-moussaka-style-pizza-tray-sauce-*` / `sauce-painted-*` | 白ソース（フロマージュブラン）を塗る |
| `b14-moussaka-style-pizza-feta-on-sauce-*` | 白ソースの上のフェタ |
| `b14-moussaka-style-pizza-tray-topping-*` / `topped-*` | 具材トレイと、置き終わった生地（ナス・ラム・シナモン） |
| `b14-moussaka-style-pizza-dex-*` | 図鑑への登録 |

before/after: 新レシピ・新食材のため「before」は存在しない（追加前は該当の表示自体が無い）。

**動画**: 390×844、Chromium、MP4（H.264）、約 740 KB。**リポジトリには含めず**、Owner へ直接提出済み（`b14-moussaka-390x844.mp4`）。共有 Preview は更新していない（ローカルの開発サーバーで撮影）。内容: ショップ NEW → 購入 → Research → 白ソース → フェタ → ナス・ラム・シナモン → 焼成 → NEW DISCOVERY → 図鑑。

**iPhone Safari 実機での確認項目**（Owner）:

- [ ] ショップで cinnamon が NEW として出る。アイコンが他の粉末（パプリカパウダーなど）と見分けられる。
- [ ] 研究で「？？？ピザ（シナモン）」と表示され、材料名・ヒントが漏れていない。
- [ ] 白ソースを塗る操作が自然で、塗った後のフェタが白の上で読める。
- [ ] 具材トレイ（改ページ）で cinnamon のチップを見つけられ、20〜24px 程度でも識別できる。
- [ ] ナス・ラム・シナモンを置いた生地が、粉末の山・ナス・ラムで混ざって見えない。
- [ ] 焼成から結果、NEW DISCOVERY、図鑑まで進む。横スクロールが出ない。
- [ ] 同じ step 66 で BBQチキンピザも発見可能になっていること（Dex / Research の表示）。
- [ ] 通常の別レシピ（マルゲリータなど）に影響がない。

## 8. 変更ファイル（要点）

`ingredients.ts`（cinnamon）/ `IngredientGlyph.tsx`（SVG）/ `App.css` / `toppingSizeClass.ts` / `ingredientTaxonomy.ts`（cinnamon = spice）/ `discoveryLadder.ts`（step 66）/ `recipes.ts` / `referencePizza.ts` / `orders.ts` / `discoveryCatalog.ts` / `recipeHintRoles.ts` / `recipeSauceProfiles.ts` ＋ 件数 pin・manifest・golden・DH4 audit・E2E の追従。新規テスト: `expansionBatch14.test.ts`、`persistence.batch14.test.ts`、`e2e/batch14-moussaka.spec.ts`（390×844 / 360×800 の通し）、`IngredientGlyph.test.tsx` の Batch 14 契約。

## 9. 視覚改善 addendum — cinnamon の描画品質（描画のみ）

視覚評価（HEAD `813838e`）: フェタ・ナス・ラム、390×844 / 360×800 のレイアウトは PASS。cinnamon のみ「茶色い小さな塊に見え、粉末らしさが弱い」。

- **変更は `IngredientGlyph.tsx` の `CinnamonPowderPile`（SVG）のみ。** 滑らかな輪郭つきのドームをやめ、(1) 不規則にギザついた粉の山の輪郭、(2) 中心の暗い粒＋左上寄りの明るい塊とハイライトによる中心/周辺の濃淡、(3) 暗・明・中間の細かな粒（固定座標、実行時の乱数なし）、(4) 輪郭の外にまばらな飛び散り粒、に描き直した。64×64 の viewBox・外形の大きさ・CSS（`App.css`）・id / gradient / defs なしの契約は不変。パプリカ（赤く背が高い）との区別は、色と低く広い輪郭で維持。
- **不変**: 他の食材の描画、レシピ、step 66、採点、保存形式、ヒント、経済、色の値（`ingredients.ts` の `#b9733a`、暫定）、原典未確認の暫定仕様。
- 比較画像（`docs/reports/screenshots/cinnamon-visual/`）: `cinnamon-before-after-iphone-390x844.png`（実ゲーム画面。ショップ 16.8px / トレイ chip 31.2px / 生地上 / 全画面の before・after）、`cinnamon-glyph-sheet-17-31-64-dough.png`（17 / 22 / 31 / 64 / 160px と生地色の上、パプリカ参照つき）、`after-*`（390×844 / 360×800 の after）。動画はコミットしない（Policy §6）。
- 生地上の実測幅（29.4 → 30.9 など）と feta の幅は実行ごとの配置ジッターで変動する（feta は無変更でも 28.6〜35.5 に動く）。表示サイズ（CSS）は変えていない。
