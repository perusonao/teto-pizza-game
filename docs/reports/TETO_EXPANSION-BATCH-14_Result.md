# Expansion Batch 14 — Result Report（moussaka-style-pizza + cinnamon）

Status: **実装・自動検証は完了。Owner の承認と iPhone Safari 実機 HV の前は merge しない。共有 Preview は Owner 承認のもと HEAD `4b0df7c` を公開済み（§6）。Production は更新していない。** PR #723（Ready for review）。基準 `main` `ebbe119`（#721 merge 済み）。作業ブランチ `claude/batch-14-implementation-j2jzyr`。Issue は無し（Owner 指示の Batch）。

## 0. 暫定仕様・原典未確認（GAMEPLAY ASSUMPTION）

**原典（pizzadb.jp）には到達しておらず、未確認。** 根拠は 172 matrix の行 `moussaka-style-pizza-pizzadb-p13`（材料 cinnamon / eggplant / feta / lamb、ソース欄「ホワイトソース」）のみ。次はすべて **GAMEPLAY ASSUMPTION / CALIBRATION（原典ではない）**:

- 個数（feta 2 / eggplant 2 / lamb 2 / cinnamon 2 = 非ソース 8 ピース = 8 スロットのリング）、焼成窓 58–78（汎用の Free Cooking 窓）、名称・説明文、`cinnamon` の色（`#b9733a`）・字形。
- **cinnamon を焼成の前に加えるか後に加えるかは原典未確認。** TOPPING 工程（焼成前）に置いた。matrix の「薄い生地」は再現していない。
- 白ソース: matrix の「ホワイトソース」は canonicalizer が曖昧のまま残している（関連 id は `fromage-blanc-sauce` のみ）。**Owner 判断（このレシピ 1 件限り）として、既存の `fromage-blanc-sauce`（PAINT）を充当。NO_SAUCE の例外ではない。** Phase 2 の matrix の行は `BLOCKED_PRODUCT_DECISION`（UNRESOLVED_INGREDIENT）のまま変えていない。

## 1. 内容

| 項目 | 内容 |
|---|---|
| レシピ | `moussaka-style-pizza` ムサカ風ピザ（`moussaka-style-pizza-pizzadb-p13`）。fromage-blanc-sauce 1（PAINT）/ **feta 2 / eggplant 2 / lamb 2 / cinnamon 2**。`ladderCredit` あり（credited）、`lunchRush:false`、key-free Hint（永続）、**CUT なし**（CUT 許可リストは不変）、bake 58–78 |
| 新食材 | `cinnamon` シナモン。**topping（scatter）**・family `spice`・size class `s`・色 `#b9733a`・専用 SVG `cinnamon-powder-pile`（粉末の山。`paprika-powder-pile` と同じ文法で、より薄く平たい。**描画は `4b0df7c` で描き直し済み → §9**）。🍪 は表示されないテキスト代替のみ（他の食材と重複しない） |
| ladder | 通常 **step 66 = cinnamon（key `moussaka-style-pizza`）**、T4・星ゲートなし・k=2（在庫 20、120 / 補充 60）。1–65 は凍結。late は導出で +1（67–73）、`LATE_ENTITLEMENT_FLOORS` は**不変** |
| Reference | 8 点リング（RT-01）を `requiredIngredients` の順（feta → eggplant → lamb → cinnamon）に連続割当 |
| 触れていない | 採点・経済・保存形式（schema v2）・Production スイッチ・`lateCatalog.ts`。共有 Preview の公開は §6（コードの変更ではなく、Owner 承認のもとでの公開） |

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

各結果の**実行 HEAD**を明記する。`4b0df7c` は、`fa84675`（下の Vitest・E2E の実行時点）から **`IngredientGlyph.tsx`（cinnamon の描き直し、§9）と `e2e/batch14-moussaka.spec.ts` の 1 行（計測順）だけ**を変えたコミット列の先頭（文書・画像を除く）。

| 検証 | 実行 HEAD | 結果 | 実行者・備考 |
|---|---|---|---|
| 全 Vitest（Pinsa ON） | `fa84675` | 576 files passed（+1 skipped）・**10,912 passed・0 failed**（13 skipped / 2 todo） | 本セッション。**描き直し後の SVG は含まない** |
| 全 Vitest（Pinsa OFF、`TETO_PINSA_OFF=1`） | `fa84675` | 576 files passed（+1 skipped）・**10,904 passed・0 failed**（12 skipped / 2 todo） | 本セッション。**`4b0df7c` では未再実行**（SVG のみの変更のため） |
| 全 Vitest（Pinsa ON） | `4b0df7c` | 10,912 passed・0 failed、`IngredientGlyph` 189/189 | **別セッションの報告（PR 本文）。本セッションでは未確認** |
| `tsc -b` / `oxlint` / `npm run build` | `fa84675`（`oxlint` は error 0、警告は変更前から存在するもののみ） | pass | 本セッション。`4b0df7c` の `build` は CI で success |
| Chromium E2E（`batch14-moussaka`） | `69bc9bc`（計測順の修正後。スクリーンショット・動画の取得も同じコードで実行し、画像は `aeaa8c2` でコミット。`aeaa8c2` はコードが `69bc9bc` と同一） | 390×844 / 360×800 とも 1/1 passed。近傍の `b11-s1` / `b12` / `batch12-supreme-norma` / `batch13-potato-mayo` も 390×844 で 7/7 passed | 本セッション。**`4b0df7c` での再確認は別セッションの報告（PR 本文）で、本セッションでは未確認** |

E2E の通し: Shop NEW → 購入 → Research（漏えいなし）→ 白ソースを塗る → フェタ → 具材 → 焼成 → NEW DISCOVERY → 図鑑。

### CI（GitHub Actions、各 11 チェック）

| HEAD | 結果 |
|---|---|
| `aeaa8c2` | 11/11 success（build、classify、layout-chromium、WebKit 6 shard（360×800 と 390×844 の各 shard 1〜3）、WebKit Gate、Layout Contract Gate） |
| `813838e`（docs-only） | 11/11 success |
| `4b0df7c` | **初回は 1 チェック（と、その集約の WebKit Gate）が失敗し、失敗ジョブの再実行 1 回で 11/11 success** |

**`4b0df7c` の初回失敗の記録（正確に）**: `webkit webkit-390x844 shard 2/3` が失敗した。内容は `e2e/expansion-batch8a.spec.ts:181`（frango-catupiry）の `locator.click` が WebKit で 300 秒（テスト timeout）を超過したこと。同じ shard の 225 件は成功（1 failed / 225 passed）。`WebKit Gate` はその集約として失敗。失敗ジョブを **1 回だけ**再実行（run `41369893037`）し、`shard 2/3` と `WebKit Gate` が成功した。**根本原因は特定していない。** この spec とその対象レシピは本 PR で変更しておらず、同じ spec は `aeaa8c2` と `813838e` の WebKit では通っていた。WebKit の E2E は毎回別のテストが間欠的に失敗する既知の問題（#394、#680）と同じ種類に見えるが、このテストについてそれを確定する証拠は取っていない。再発した場合は本 PR の問題として調査する。skip・無効化・timeout の変更はしていない。経緯は PR コメント <https://github.com/perusonao/teto-pizza-game/pull/723#issuecomment-6567030592> に残した。

### 実測（描き直し**前**の計測）

`docs/reports/screenshots/b14/measure-*.json`（Chromium、CSS px）。**cinnamon の描き直し（`4b0df7c`、§9）の前の実行（`aeaa8c2` 時点）の値。** 表示サイズを決める CSS は §9 の変更で変えていないため、chip とショップのアイコンの値は描き直し後も同じ。生地上の値は配置ジッターで実行ごとに動く（§9）。

| 項目 | 390×844 | 360×800 |
|---|---:|---:|
| トレイ chip の cinnamon アイコン | 31.2 | 31.2 |
| ショップのアイコン | 16.8 | 16.8 |
| 生地上の feta（白ソースの上） | 34.8 | 35.5 |
| 生地上の cinnamon（描き直し前） | 29.4 | 27.9 |

- **WebKit・iPhone Safari の実機は Owner の HV**（セッションは PASS を代行しない）。Codex レビューは §6 を参照。

## 5. Owner 判断事項・HV で見てほしい点

1. **cinnamon の見え方**: 粉末の山として、トレイの chip（20〜24px 相当の識別）と生地上で読めるか。`paprika-powder` など他の粉末との取り違え、白ソース・フェタ・ナス・ラムの上での視認性。色 `#b9733a` は **PROVISIONAL**（実機で再評価）。**描き直し後（§9）の絵で評価すること。**
2. **size class `s`** の妥当性（生地上で 28〜31px 前後。描き直し前の計測は 27.9〜29.4、描き直し後の 1 回の計測は 30.9 で、配置ジッターを含む）。
3. 名称「ムサカ風ピザ」と説明文（暫定）。
4. **白ソースの充当**（`fromage-blanc-sauce`、このレシピ 1 件限り）の維持。原典確認は未了。
5. **cinnamon を焼成前に置く仮定**（原典では焼成の前後が不明）。
6. **step 66 の 2 レシピ同時解禁**（ムサカ風 + BBQチキン）が意図どおりか。
7. **iPhone 実機 HV（Owner）**: §7 の確認項目。

## 6. PR・CI・レビュー・Preview

- PR: https://github.com/perusonao/teto-pizza-game/pull/723 （Draft を Owner 承認のもと 2026-11-01 に解除。**merge は未承認**）。
- **`main` の更新**: PR 作成後に `main` が `7f3aa63`（#722、cooking-prep の余白・はみ出し修正）へ進んだ。本 PR とはファイルが重ならず、`git merge-tree` で衝突なしを確認した。**`main` はこの PR に取り込んでいない**（必要なら merge 前に Owner の指示で取り込む）。
- **CI**: §4 の表を参照（`aeaa8c2` / `813838e` / `4b0df7c` のすべてが最終的に 11/11 success。`4b0df7c` は WebKit の 1 チェックが初回失敗し、1 回の再実行で成功）。
- **Codex レビュー**:

| HEAD | 起動 | 結果 |
|---|---|---|
| `aeaa8c2` | 自動（Draft を Ready に変更したとき） | 完了、指摘 0 件・未解決なし |
| `813838e`（docs-only） | なし（個別にはレビューされていない） | — |
| `4b0df7c` | 手動（Owner のアカウントによる PR コメント `@codex review`） | 完了、「大きな問題は見つからなかった」、指摘 0 件・未解決なし |

- **共有 Preview（Owner 承認のもと公開済み）**:
  - 公開した HEAD: **`4b0df7c`**。公開前は同 PR の `813838e`。
  - Build run **#202** 成功、Pages run **#199** 成功。
  - 公開物のバッジ: **「PR#723 · 4b0df7c」**。
  - **iPhone Safari での実表示は未確認**（Owner の HV）。
  - 復旧が必要な場合は、deploy workflow を ref `813838ede9093104abc2ab4468ae0cb158ddf11a` で再実行する。
  - **Production は更新していない。**

## 7. iPhone Safari HV 用の成果物と確認項目

**画像 A: Batch 14 本体**（リポジトリ内、`docs/reports/screenshots/b14/`。390×844 と 360×800 の各 9 枚 + 実測 JSON）。**これらは cinnamon の描き直し（§9）より前の取得（`aeaa8c2` 時点）で、cinnamon が写るもの（`b14-cinnamon-new-*`、`b14-moussaka-style-pizza-tray-topping-*`、`topped-*`）は旧い絵である。** 改善後の絵の証跡は「画像 B」を使うこと:

| ファイル（`-iphone-390x844` / `-iphone-360x800`） | 見るポイント |
|---|---|
| `b14-cinnamon-new-*` | ショップの NEW 表示（シナモンのアイコン 16.8px） |
| `b14-moussaka-style-pizza-new-recipe-*` | 新レシピの発見表示 |
| `b14-moussaka-style-pizza-research-entry-*` | Research の「？？？ピザ（シナモン）」（**未発見の情報が出ていない**） |
| `b14-moussaka-style-pizza-tray-sauce-*` / `sauce-painted-*` | 白ソース（フロマージュブラン）を塗る |
| `b14-moussaka-style-pizza-feta-on-sauce-*` | 白ソースの上のフェタ |
| `b14-moussaka-style-pizza-tray-topping-*` / `topped-*` | 具材トレイと、置き終わった生地（ナス・ラム・シナモン） |
| `b14-moussaka-style-pizza-dex-*` | 図鑑への登録 |

**画像 B: cinnamon 描き直しの証跡**（`docs/reports/screenshots/cinnamon-visual/`、`4b0df7c`）: `cinnamon-before-after-iphone-390x844.png`（実ゲーム画面の before / after）、`cinnamon-glyph-sheet-17-31-64-dough.png`（サイズ別・生地色の上、パプリカ参照つき）、`after-cinnamon-new-*` / `after-moussaka-style-pizza-topped-*`（390×844 / 360×800 の改善後）。

before/after: 新レシピ・新食材としての追加には「before」は存在しない（追加前は該当の表示自体が無い）。cinnamon の**描き直し**の before / after は画像 B にある。

**動画（旧）**: 390×844、Chromium、MP4（H.264）、約 740 KB（`b14-moussaka-390x844.mp4`）。**リポジトリには含めず**、Owner へ直接提出済み。**cinnamon の描き直し（§9）より前（`aeaa8c2` 時点）の撮影で、cinnamon は旧い絵。** ローカルの開発サーバーで撮影した（共有 Preview ではない）。描き直し後の絵を撮った動画が別に提出されたかは、この文書の作成時点では確認できていない（動画はリポジトリにコミットしない: Policy §6）。内容: ショップ NEW → 購入 → Research → 白ソース → フェタ → ナス・ラム・シナモン → 焼成 → NEW DISCOVERY → 図鑑。

**iPhone Safari 実機での確認項目**（Owner）:

- [ ] ショップで cinnamon が NEW として出る。アイコンが他の粉末（パプリカパウダーなど）と見分けられる。
- [ ] 研究で「？？？ピザ（シナモン）」と表示され、材料名・ヒントが漏れていない。
- [ ] 白ソースを塗る操作が自然で、塗った後のフェタが白の上で読める。
- [ ] 具材トレイ（改ページ）で cinnamon のチップを見つけられ、20〜24px 程度でも識別できる。
- [ ] ナス・ラム・シナモンを置いた生地が、粉末の山・ナス・ラムで混ざって見えない。
- [ ] 焼成から結果、NEW DISCOVERY、図鑑まで進む。横スクロールが出ない。
- [ ] 同じ step 66 で BBQチキンピザも発見可能になっていること（Dex / Research の表示）。
- [ ] **描き直し後（§9）の cinnamon が粉末らしく見える**（ショップ 16.8px / トレイ chip 31.2px / 生地上、17〜31px 相当でも茶色い塊に見えない）。パプリカパウダー（赤く背が高い）と取り違えない。
- [ ] **共有 Preview（バッジ「PR#723 · 4b0df7c」）を iPhone Safari で開き、実表示を確認する**（現時点では未確認）。
- [ ] 通常の別レシピ（マルゲリータなど）に影響がない。

## 8. 変更ファイル（要点）

`ingredients.ts`（cinnamon）/ `IngredientGlyph.tsx`（SVG）/ `App.css` / `toppingSizeClass.ts` / `ingredientTaxonomy.ts`（cinnamon = spice）/ `discoveryLadder.ts`（step 66）/ `recipes.ts` / `referencePizza.ts` / `orders.ts` / `discoveryCatalog.ts` / `recipeHintRoles.ts` / `recipeSauceProfiles.ts` ＋ 件数 pin・manifest・golden・DH4 audit・E2E の追従。新規テスト: `expansionBatch14.test.ts`、`persistence.batch14.test.ts`、`e2e/batch14-moussaka.spec.ts`（390×844 / 360×800 の通し）、`IngredientGlyph.test.tsx` の Batch 14 契約。

## 9. 視覚改善 addendum — cinnamon の描画品質（描画のみ）

視覚評価（HEAD `813838e`）: フェタ・ナス・ラム、390×844 / 360×800 のレイアウトは PASS。cinnamon のみ「茶色い小さな塊に見え、粉末らしさが弱い」。

- **変更は `IngredientGlyph.tsx` の `CinnamonPowderPile`（SVG）のみ。** 滑らかな輪郭つきのドームをやめ、(1) 不規則にギザついた粉の山の輪郭、(2) 中心の暗い粒＋左上寄りの明るい塊とハイライトによる中心/周辺の濃淡、(3) 暗・明・中間の細かな粒（固定座標、実行時の乱数なし）、(4) 輪郭の外にまばらな飛び散り粒、に描き直した。64×64 の viewBox・外形の大きさ・CSS（`App.css`）・id / gradient / defs なしの契約は不変。パプリカ（赤く背が高い）との区別は、色と低く広い輪郭で維持。
- **不変**: 他の食材の描画、レシピ、step 66、採点、保存形式、ヒント、経済、色の値（`ingredients.ts` の `#b9733a`、暫定）、原典未確認の暫定仕様。
- 比較画像（`docs/reports/screenshots/cinnamon-visual/`）: `cinnamon-before-after-iphone-390x844.png`（実ゲーム画面。ショップ 16.8px / トレイ chip 31.2px / 生地上 / 全画面の before・after）、`cinnamon-glyph-sheet-17-31-64-dough.png`（17 / 22 / 31 / 64 / 160px と生地色の上、パプリカ参照つき）、`after-*`（390×844 / 360×800 の after）。動画はコミットしない（Policy §6）。
- 生地上の実測幅（29.4 → 30.9 など）と feta の幅は実行ごとの配置ジッターで変動する（feta は無変更でも 28.6〜35.5 に動く）。表示サイズ（CSS）は変えていない。

## 10. Final Gate 記録（docs-only、HEAD `4194ead` の上に追記）

### 10.1 視覚 HV（Owner 確認）

- **cinnamon の視覚 HV は Owner 確認で PASS。** 対象は、公開 Preview の cinnamon 描き直し（`4b0df7c`、§9）。判定項目は、粉末らしさ、パプリカパウダーとの識別、具材との区別、レイアウト、操作フロー。
- **iPhone Safari 実機は未検証。** PASS とは記録しない。未確認の内容: WebKit での粒・輪郭の描画、17px 前後での実際の見え方、公開 URL を開いたときのバッジ表示、指でのトレイ操作。自動撮影（Chromium）の結果は実機 Safari の結果の代わりにならない。**実機 Safari の判定は Owner。**
- 本 PR の Status（冒頭）は変更していない。実機 Safari HV の前に merge するには、Owner の明示承認が要る。

### 10.2 公開ビルド `4b0df7c` の検証（自動、Chromium、DPR 3）

- **撮影対象**: Pages に公開された実ビルド（preview リポジトリ `site/`、`686f183`＝`4b0df7c`、バッジ「PREVIEW · PR#723 · 4b0df7c」）。**公開 URL（perusonao.github.io）には、撮影環境のプロキシ（403）で到達できなかった**ため、同じ成果物をローカルで配信して撮影した。公開 URL との違いは配信元（origin）のみ。公開 URL での実表示は未確認。
- **before**: `813838e` をローカルでビルドして撮影。after との差は cinnamon の描画だけ（同じ撮影スクリプト・同じ viewport・同じ DPR）。
- **対象 viewport**: 390×844 と 360×800。
- **画像**（`docs/reports/screenshots/cinnamon-visual-published/`）:

| ファイル | 内容 |
|---|---|
| `cinnamon-before-after-390-360.png` | before / after（ショップ行 16.8px、トレイ chip 31.2px、生地上）。両 viewport を 1 枚にまとめた比較 |
| `cinnamon-vs-paprika-after.png` | パプリカパウダーとの比較（ショップ行、トレイ chip、生地上） |
| `six-scenes-iphone-390x844.png` / `six-scenes-iphone-360x800.png` | ショップ、トレイ、生地上、焼成後の結果、図鑑、パプリカとの比較 |

- **判定（自動撮影の目視）**: 粉末らしさ PASS、パプリカとの識別 PASS（茶と赤、ぎざぎざで平たい形と滑らかで背の高い形）、具材（フェタ・ナス・ラム）との区別 PASS、レイアウト PASS（両 viewport で横スクロールなし、崩れなし）、操作フロー PASS（購入→研究→ソース→フェタ→具材→焼成→NEW DISCOVERY→図鑑を両 viewport で完走、console error なし）。比較用の生地上の配置は比較専用の状態（焼成していない）。
- **動画**（リポジトリには含めない。Policy §6 のとおり Owner へ直接提出）:

| Video | Viewport | Duration | Size | Codec | Verification |
|---|---|---:|---:|---|---|
| `teto-pr723-preview-4b0df7c-hv-390x844.mp4` | 390×844 | 23.8s | 610KB | H.264 | PASS |

  公開ビルドを Playwright Chromium で自動操作（DPR 1）。ホーム→研究→ソース→フェタ→具材→焼成→結果まで。ffprobe で codec / 解像度 / 長さを確認し、抜き出したフレームで流れを目視した。バッジ表示あり。**人間の操作ではない。** トレイのシナモン chip が長く映らないため、chip の拡大は画像で確認する。

Video Verification: PASS（自動撮影のもの。実機 Safari の確認ではない）

- **撮影環境の注記**: 結果画面の「Scoring 2.0 Debug」は Preview 専用の開発用表示で、本番ビルドには出ない。

### 10.3 CI（WebKit 初回 timeout と再実行成功の記録を維持）

- `4b0df7c`: 初回に `webkit-390x844 shard 2/3`（`e2e/expansion-batch8a.spec.ts:181`、WebKit の `locator.click` が 300 秒 timeout、同 shard の 225 件は成功）と、その集約の `WebKit Gate` が失敗。失敗ジョブを **1 回だけ再実行して 11/11 success**。**根本原因は未特定**（その spec・対象レシピは本 PR で未変更、`aeaa8c2` / `813838e` の WebKit では通っている。既知の WebKit 間欠失敗 #394 / #680 と同種に見えるが確定していない）。再発時は本 PR の問題として調査する。skip・無効化・timeout 延長はしていない。
- `4194ead`（docs-only）: `build` / `classify` / `WebKit Gate` / `Layout Contract Gate` が success、WebKit の各 shard と `layout-chromium` は docs-only の分類で skipped。全 shard を実行した最後のコード HEAD は `4b0df7c`。

### 10.4 Gate の状態（この commit の HEAD は §10 を追記した docs-only の commit）

- Codex: `4b0df7c` 指摘 0 件、未解決スレッド 0 件（docs-only の commit は個別にレビューされていない）。
- `main` は `7f3aa63`、本 PR とのファイル重複なし、`git merge-tree` で衝突なし。
- **merge は未承認。Production は更新していない。** merge は `main` への push で本番の GitHub Pages デプロイを自動実行する（フラグでの無効化なし）。Owner の判断事項: 実機 Safari 未検証での merge、暫定仕様（原典未確認）のまま公開すること、WebKit の間欠失敗（根本原因未特定）の許容。
