# BBQチキン — Final Design Gate（#611、docs-only）

Status: **Final Design Gate の提出。BBQ の runtime は実装していない**（`src/**`・`e2e/**`・CSS・テスト・データ・golden は無変更）。merge・deploy・CI 再実行・Monitor 作成なし。
基準 `main` = `9761d03`（#673 merge 済み。食材 75 / レシピ 69 / 通常 ladder 56 + late 4）。前提資料: `TETO_BBQ-CHICKEN_CONDITIONAL-APPROVAL_2026-10-27.md`、`TETO_NEXT-RECIPES-AND-PROCESSES_PRIORITY-TABLE_2026-10-26.md`。
確認スクリプト: `tools/bbq-final-gate/check.ts`（`npx vite-node`、現行データの読み取りのみ。出力 `check-output.json`）、`tools/bbq-final-gate/render-sheet.mjs`（SVG 比較シート）。
**「判定」「推奨」は助言であり、実装の開始は Owner の明示的な指示を要する。**

## 0. Owner 決定（2026-10-27）

| 項目 | 決定 |
|---|---|
| D-1 | **案 A:** chicken 3、非ソース 8（焼成前 6 + 仕上げ 2） |
| D-4 | **案 a:** cilantro 専用 SVG（`cilantro-leaf`）を**同じ PR に含める** |
| D-6 | **案 a:** 8 ピース。リングに 8 個の新上限は設けない |
| Q2 | cilantro は**焼成後（FINISH）**。**原典未確認の暫定仕様**（ゲーム用。原典の事実としては記録しない） |
| Q1・Q3〜Q5 | 暫定仕様を**条件付きで許可** |
| 実施 | 設計値と既存データの整合性、8 ピースの Reference 配置と複数リング対応、SVG の視認性・区別の設計、原典未確認項目の明記、#578 claim の確認と（完了済みのみ）代理 release、Final Design Gate の提出。**BBQ の runtime 実装は開始しない** |

## 1. 確定した設計値（最終仕様案）

| 項目 | 値 | 根拠・備考 |
|---|---|---|
| レシピ id / 名称 | `bbq-chicken-pizza` /「BBQチキンピザ」 | #611 §1。matrix の evidence id は `bbq-chicken-pizzadb`（`shirasu-pizza` → `-pizzadb-p3` の命名前例） |
| 材料 | bbq-sauce 1（PAINT）/ mozzarella 2 / onion 1 / chicken 3 / **cilantro 2（POST_BAKE）** | D-1 = A。**cilantro 以外の 4 種は焼成前**（暫定） |
| 非ソースのピース | **8**（焼成前 6 + 仕上げ 2） | D-6 = a |
| 焼成窓 | 58–78 | U1〜U3 と同じ汎用値。matrix の生地は `unknown`（暫定） |
| 報酬・経済 | `baseRewardPitz: 100`、T4（パック 120 / 補充 60 Pitz）、星ゲートなし | #611 のコメントで確定した規則 |
| ラウンド | `lunchRush: false`、CUT なし | 同上 |
| 識別・ヒント | key-free（`recipeHintRoles`）、cohort の鍵 = cilantro、`ladderCredit: true` | 同上 |
| late step | **導出**（通常 ladder 56 + late 4 の次 = 現在 61）。`LATE_ENTITLEMENT_FLOORS` に `bbq-sauce: 61` / `cilantro: 61`（既存 57/58/59/59/60/60 は不変） | #621 の規則: 絶対番号に固定せず、既到達・既解禁は後退させない |
| `bbq-sauce` | カテゴリ sauce、PAINT、色駆動で専用 SVG なし。**色は暫定**（例 `#7a2f1c`、実機 HV で確定。既存のトマト `#d4452f`・豆板醤 `#8a2b1c` と明度差を実測して決める）。family 行なし | #611 §2 |
| `cilantro` | カテゴリ topping / scatter、family `herb`、サイズ `xs`（parsley・mint と同じ。`toppingSizeClass`）、`applicationPhase: POST_BAKE`、`pieceVisual: "cilantro-leaf"` | D-4 = a。§4 |
| 説明文 | 投入の時機を名指ししない（Anti-Oracle）。例「甘辛いソースのチキンに、香菜をそえた一枚。」（Owner 文言確認が要る） | #621 で技法名・Dex 説明・なぞかけは確定済み |

## 2. 既存データとの整合性（現行 main に対する確認）

`tools/bbq-final-gate/check.ts` の結果（`check-output.json`）:

| 確認項目 | 結果 |
|---|---|
| `chicken` / `onion` / `mozzarella` の存在 | **存在**。解禁: chicken = 通常 step 25、onion = step 12、mozzarella = スターター |
| `bbq-sauce` / `cilantro` | 未存在（新規。想定どおり） |
| 識別の衝突 | **なし**。chicken + onion + mozzarella をすべて含む既存レシピは 0 件（chicken を含むのは pesto-pollo 3 と frango-catupiry 3 のみ）。新材料 2 種が集合を一意にする |
| カタログ件数（BBQ 追加後の見込み） | レシピ 69 → 70、食材 75 → 77（sauce +1、topping +1）、ladder 60 → 61（late 4 → 5） |
| late ladder の並び | ikura → yuzu-kosho → miso + sesame → tahini + pomegranate → **bbq-sauce + cilantro（新）**。key recipe = `bbq-chicken-pizza` |
| herb family の既存メンバー | basil（xl）、garlic（s）、oregano・rosemary・parsley・mint・shiso・green-onion（xs）。cilantro は xs の herb として並ぶ（family が 8 → 9 メンバー。単独メンバー検証（Hint 5.0）への影響なし） |
| 触る箇所の雛形（#673 のタヒニ + ザクロ） | 非テストの `src` は 6 ファイル: `lateCatalog.ts`、`recipeSauceProfiles.ts`（union に `bbq-sauce`）、`recipeHintRoles.ts`、`referencePizza.ts`、`techniqueAllowlists.ts`、`recipeBatchManifest.ts`、加えて cilantro 用に `IngredientGlyph.tsx`・`ingredients.ts`（型）。テスト・golden・e2e は約 18 ファイル |
| DH4 の件数 pin（`deductionGuard.gate`） | 材料・レシピの追加で動く（U1〜U3 は 165 → 132 など）。**原因分解（bbq-sauce のみ / cilantro のみ / 両方 / 両方 + レシピ）をしてから更新**し、privacy assertion・hardened guard は緩和しない（OD-B9-15） |
| 既存の「sauce 3 種前提」 | U1〜U3 で更新済み（`RecipeSauceProfile.ingredientId` の union 拡張のみ） |

**未確認（実装時に確認）:** `ladderReachability.starGate` の slack（1）が late の 5 番目で保たれること、`bbq-sauce` の色と他ソースの識別（ΔE）、cohort 文字の導出（Research）、Hint 5.0 golden の追記のみ。

## 3. 8 ピースの Reference 配置と複数リング

| 確認 | 結果 |
|---|---|
| `getReferenceSlots(8)` | RT-01 の**固定 8 点リング**（`PIECE_RING_POSITIONS`）と**一致**。隣接最小距離 **20**（見やすさ目標 18.2 以上） |
| 7 ピース | 最小距離 20（同じ） |
| **9 ピース以上** | **複数リングを生成**（`getReferenceSlots(9)` は 9 点、最小距離 21.4）。**8 は仕様上の上限ではなく、リングの形が変わる境目**。#621 の「総数 8 超の拡張はスコープ外」は、BBQ が 8 以内なので触れない |
| 新しい上限 | **設けない**（Owner 決定）。BBQ の PR は上限の定数・規則・「8 が上限」と読めるコメントを追加しない（既存のピンサのコメントにある「≤ the 8-slot ring」は説明であって規則。再掲しない） |

**BBQ の割り当て**（`requiredIngredients` の順 = mozzarella → onion → chicken → cilantro。後乗せも同じリングを連続で使う。ikura と同じ型）:

| スロット | 食材 | 位置（生地 %） |
|---|---|---|
| 1 | mozzarella | (50, 24) |
| 2 | mozzarella | (73, 36) |
| 3 | onion | (76, 63) |
| 4 | chicken | (58, 79) |
| 5 | chicken | (38, 79) |
| 6 | chicken | (22, 63) |
| 7 | **cilantro** | (25, 36) |
| 8 | **cilantro** | **(50, 52)**（生地の中央） |

- cilantro の 2 つは、他の食材のピースから 27.2 / 28.0 離れている（最も近い非 cilantro ピースまで）。重なりの心配はない。
- 8 番目（中央）が仕上げのピースになる。FINISH で中央に置く操作は、他の後乗せ（ikura の 8 点中 3 点など）と同じ。
- Reference のスロット割り当ては「ゲーム内の較正であって原典の権威ではない」（既存の定型句）。
- 画面上の混み具合（焼成前 6 ピース + 仕上げ 2 の見え方、タップ性、見切れ）は、**実装 PR の E2E（390×844 / 360×800）と実機 HV で確認**する。ikura の 8 ピース（後乗せ 3）と同条件。

## 4. cilantro の SVG（`cilantro-leaf`）の設計

候補: `docs/design/candidates/cilantro-bbq/cilantro-A.svg`（未採用の候補。Style Lock v2 の「採用済み」ディレクトリには入れない）。比較シート: `docs/reports/screenshots/bbq-cilantro-svg/cilantro-candidate-A-vs-existing.png`。

**仕様（Style Lock v2 の型に合わせる）:** 64×64 の viewBox、地面の影の楕円（opacity .15）、外形の線 `#245f2c`（太さ 2.2）、明るい黄緑の塗り `#9ad45f`、葉脈 `#2f7a2f`、細いハイライト。1em で描画し、`xs` クラス（×0.7）でも形が読める。決定性（乱数なし）、`id`/グラデーション属性なし（複数を同じ画面に置けるように）。

**形の設計:** 3 枚の**丸みのある扇形の小葉**（外縁が波打つ）を細い茎でまとめた 1 本の枝。区別の軸は「葉の外形」。

| 既存 | 見た目 | cilantro との区別 |
|---|---|---|
| shiso-leaf（SVG） | 1 枚の**鋭い鋸歯の楕円葉** | cilantro は**複数の丸い小葉**（鋸歯でなく波打ち） |
| green-onion（SVG） | 白緑の**輪** | 輪と葉で明確に違う |
| パセリ ☘️（emoji） | **三つ葉のクローバー**（3 つの丸い葉が 1 点で接する） | **最も近い**。cilantro は葉が扇形で枝に茎があり、色も明るい黄緑。クローバーの絵文字とは形が違うが、xs では「3 つの緑の丸」に見えうる |
| ミント 🍀 | 四つ葉 | 葉の数と形が違う |
| バジル 🌿 / オレガノ 🍃 / ローズマリー 🌱 | 細長い葉・渦・双葉 | 形が違う |
| ルッコラ（SVG、アプリ内） | 細長い切れ込みの葉 | cilantro は丸い |

**視認性の観察（比較シート、Chromium 描画）:**
- 48px・24px: 3 枚の小葉と茎が読める。パセリ ☘️・ミント 🍀 とは形が違って見える。
- ピザ上の xs（約 20px）: **焼き色の生地・トマトソース上は読める**。BBQ ソース（暫定の濃い茶 `#7a2f1c`）上では、明るい黄緑にしたので判読できる（暗い緑だと沈む）。
- **懸念:** 20px のパセリ ☘️ と**同じ「緑の塊」**に見えるおそれが残る。**区別は形だけに頼らず、名前表示（トレイ・RESULT・図鑑）と文脈（BBQ のレシピ）で補う**。将来パセリも SVG にする場合（#417 のパイロット）は、cilantro と並べて見分けを再確認する。
- 他の小さい SVG（shiso、green-onion、sesame）と同様、箱の余白で小さく見えるため `.ingredient-glyph--cilantro-leaf` を **1.2em の補正グループ**に加える（`App.css` の 1 セレクタ。要否は実測で確定）。

**テキスト代替の emoji（DOM には出ない）:** 他のどの食材・ファミリー記号とも重複しない必要がある（バッチごとのテスト）。葉の絵文字は全て使用済みで、候補は 🌼（Emoji 1.0、無難）、🍵 など。**iOS 16.4 以降限定の 🫛・🫚 は避ける**。ザクロの 🟥 の前例どおり、見た目には使わない。

**Owner 確認:** 候補 A の形（3 小葉の枝）でよいか。修正する場合の方向（葉の数・丸み・色）。最終確認は実機（390 / 360）の HV。

## 5. 原典未確認項目（暫定仕様。Result・PR・コードに明記）

**原則:** すべて「ゲーム用の暫定仕様（GAMEPLAY ASSUMPTION）」。原典（pizzadb.jp）には到達していない。原典の事実としては記録しない。

| # | 項目 | 現状の根拠 | 扱い |
|---|---|---|---|
| Q1 | 材料の最終一致（bbq-sauce / chicken / cilantro / mozzarella / onion） | matrix の `phase0b_sample_canonical`（比較表の標本）。個別ページ未確認 | **条件付き許可**（暫定） |
| **Q2** | **cilantro が焼成後** | matrix の `catalog_design_tag`（ゲーム側カタログの設計タグ。**原典の記述ではない**） | **Owner がゲーム用の暫定仕様として承認済み。原典の事実としては記録しない** |
| Q3 | 個数（mozzarella 2 / onion 1 / chicken 3 / cilantro 2） | #611 の具体案（ゲーム側の較正） | 条件付き許可（暫定） |
| Q4 | 生地・焼成窓（58–78） | matrix の dough は `unknown`。窓は汎用値 | 条件付き許可（暫定） |
| Q5 | チキンの下ごしらえ（事前加熱なし） | matrix は `LATE_ADDITION` のみ要。下ごしらえは未記録 | 条件付き許可（暫定） |

**記録ルール（実装時）:** コード内コメントの定型「GAMEPLAY ASSUMPTION（暫定仕様・原典未確認）: cilantro を焼成後にのせるのはゲーム用の暫定仕様で、原典の事実としては記録しない。根拠は 172 品 matrix の `catalog_design_tag` のみ。」を `lateCatalog.ts` のレシピ定義に置く。PR 本文・Result に未確認項目の表を載せる。説明文・Dex・RESULT・ヒントは投入の時機を名指ししない。数値と時機は 1 つのレシピ定義に集め、原典の共有があった場合に小さな PR で差し替えられるようにする。

**原典が後で確認され、仮定が崩れた場合:** cilantro が焼成前と分かれば `applicationPhase` と late 枠の扱い（ladder の late → 通常）を、焼成後でも「ソースの後乗せ」等と分かれば構成の再分類を、Owner と相談する（OD-B9-16 の考え方）。

## 6. 実装計画（**未着手**。Owner の指示後）

1. **claim:** #611 に `teto-claim` を投稿（files: `lateCatalog.ts`、`ingredients.ts`、`ingredientTaxonomy.ts`、`toppingSizeClass.ts`、`recipeSauceProfiles.ts`、`recipeHintRoles.ts`、`referencePizza.ts`、`orders.ts`、`IngredientGlyph.tsx`（+ test）、`App.css`、技法 allow-list、golden、件数 pin、e2e、Result、参照 SVG）。重なる claim: **#578 の U3（`01Dzqcs…`、期限 11/02）のみ残る**（B-1・U1・U2 は代理 release 済み）。open PR: **#540（Draft・HOLD）が `recipes.ts`・`recipeSauceProfiles.ts`・`referencePizza.ts`・`hint5.ladders55.json` を触る**（先に merge されない。後から着手する側が追従）。#674 は `persistence.ts` のみ。
2. データ: `lateCatalog.ts`（レシピ・注文・探索 target・材料 2・taxonomy 行（cilantro = herb）・size class（xs）・late step・floors）。通常 ladder・`recipes.ts` は変更しない（late catalog 経由）。
3. 描画: `CilantroLeaf` コンポーネント + viewBox + `DedicatedIngredientVisual` の型、`App.css` の補正セレクタ（要否は実測）、参照 SVG の採用（`docs/design/references/ingredient-icons-2.0/cilantro.svg`）。Style Lock v2 の追記は別の docs-only PR。
4. テスト: 新規 `lateCatalog.bbq.test.ts`（OFF の無痕跡、データ・表、identity の一意性、Shop T4、Research、実 reducer の Free Cooking の NEW_DISCOVERY / ORIGINAL（cilantro を焼成前・後乗せなし・材料欠落）、Guided 再プレイ、絵文字の一意性）、`materialEntitlement.lateFloor.test.ts` に floor 61、件数 pin と golden（追記のみ）、`techniqueAllowlists` への追記（privacy assertion は緩和しない）。**DH4 の件数 pin は原因分解してから更新。**
5. 検証: tsc、oxlint、vitest 全体、build、Chromium E2E 390×844 / 360×800（`e2e/new-bbq.spec.ts`）、WebKit は CI。HV: 動画 390×844（Owner へ直接）+ 前後スクリーンショット（390 / 360）。**実機 HV は Owner。**
6. 運用: PR タイトル・本文に「暫定仕様・原典未確認」「merge = 即公開」を明記。**Owner の実機 HV と最終承認まで merge しない。**

規模の見込み: #673 と同程度（50 ファイル前後、+1000 行）。

## 7. Gate チェック

| 項目 | 判定 | 備考 |
|---|---|---|
| 設計値の確定（§1） | **PASS（Owner 決定どおり）** | bbq-sauce の色・説明文は暫定（Owner 確認・実機 HV） |
| 既存データとの整合性（§2） | **PASS**（確認できた範囲） | 衝突なし。件数 pin・starGate slack・ΔE・cohort 文字は実装時に確認 |
| 8 ピースの Reference・複数リング（§3） | **PASS** | 固定リングと一致、最小距離 20、新上限なし |
| SVG の視認性・区別の設計（§4） | **条件付き PASS** | 候補 A の形は Owner 確認、パセリとの近さは名前表示で補う、実機 HV 必須 |
| 原典未確認項目の明記（§5） | **PASS** | Q2 は暫定仕様として承認済み。事実として記録しない |
| 依存関係・競合（§6） | **PASS** | #673 merge 済み。#578 claim は B-1・U1・U2 を代理 release、U3 は残す |
| 未決仕様 | **なし（SVG の形・説明文・ソース色の Owner 確認のみ）** | 上記は実装前の確認事項で、仕様の空白ではない |

**判定: Final Design Gate は提出可能。実装開始の GO は Owner の明示的な指示を待つ（BBQ の runtime は未着手）。**

## 8. Owner への質問

1. **実装開始の指示**（本 Gate の承認）。
2. SVG 候補 A（3 小葉の枝）の形でよいか。修正する場合の方向。
3. 説明文の文言（§1 の例でよいか）。
4. bbq-sauce の色（暫定 `#7a2f1c`）を実機 HV で確定する運用でよいか。
5. #578 の U3 claim（`01Dzqcs…`、11/02）: 元セッションの作業が終わったことを確認できたら release するか、期限まで待つか。
