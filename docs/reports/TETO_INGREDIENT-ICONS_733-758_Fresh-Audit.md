# Ingredient Icons 2.0 — #733 / #758 Fresh Audit（beef / green-pepper / shiso-leaf）

- 状態: **調査・撮影・設計のみ（docs-only）。製品コード・SVG・CSS・JSON・テストは変更していない。実装は Owner 判断待ち。**
- Refs #733 #758 #417 #739 #738 #749 #748 #753

## 0. 結論（先に）

**前提の訂正:** 依頼文は「#733・#758 は open」としているが、Issue は追跡用に open のまま、**実装はすでに main に入っている**（#760 牛肉＝角切り＋断面／ピーマン＝輪切り×2、#761 大葉＝1.35em）。したがって本監査は「改善前後の比較」ではなく **「現行 main の再評価（採用後の検証）」** になる。

| 対象 | 現状評価 | 推奨改善 | 実装優先度 |
|---|---|---|---|
| beef（牛肉） | **PASS** | **E 現状維持**（観察項目: 焼成後の暗さ。必要なら B を iPhone HV 後に再検討） | **P3** |
| green-pepper（ピーマン） | **PASS** | **E 現状維持**（名称と形の不一致は別 Gate の負債） | **P3** |
| shiso-leaf（大葉） | **要改善（軽微）** — 3 食材で最も小さく、輪郭コントラストも最低 | **A（葉脈・輪郭の線を太く）＋D（輪郭を濃く）を候補。単純な B（さらに拡大）は非推奨** | **P2** |

- 判定は **Chromium（DSF 2）の実測のみ**。iPhone Safari 実機 HV の代わりではない（大葉は 2026-11-06 に Owner の iPhone HV が PASS 済みと Result にあるが、本監査は再確認していない）。
- 食材 SVG だけで足りる。**`PizzaStage.tsx` の変更は不要**。サイズを変える場合のみ `src/App.css`（HOT）が必要。

## 1. 監査日時・main SHA

- 監査日時: 2026-11-06 13:33 UTC（JST 22:33）
- 最新 main: `785d7956b42eac97e42dbd138818262a16c0a91c`（PR #759 Batch 18 の merge。`git fetch origin main` で再確認）
- 作業ブランチ: `claude/teto-ingredient-icons-audit-du85eg`（main と同一から開始。作業ツリーは clean、他ブランチ・他 worktree は未変更）
- 撮影環境: ローカル `npm run dev`（vite、port 5183、`TETO_TEST_HOOKS=1`）＋ Playwright Chromium、DSF 2。**共有 Preview・Production は使っていない。**

## 2. 確認した Issue・PR・設計資料

| 対象 | 状態（2026-11-06 時点・GitHub で確認） | 要点 |
|---|---|---|
| #733 | open（追跡） | Owner 決定 OD-1〜6（beef B 角切り、pepper R1 輪切り、visual ID 維持 など）。OD-A: 炒め済み牛肉色 B′ を採用 |
| #760 | **merged**（main に反映） | beef / green-pepper の SVG 差し替え＋B′（`BEEF_COOKED_COLORS` は main で `#8a4729 / #66361e / #7f4628 / #7f4628 / #34190e` を確認） |
| #758 | open（追跡） | 大葉 1.2em→1.35em。Owner 設計承認（2026-11-05）、iPhone HV PASS（Result 記載、2026-11-06） |
| #761 | **merged** | `.ingredient-glyph--shiso-leaf` 1.35em / margin −0.175em。PROVISIONAL コメントは除去済み |
| #765 | merged（HOLD/Draft の題で merge） | 390px 未満のトレイのチップ名 10px・余白 3px（#764 関連）。360 幅のトレイ撮影に影響 |
| #417 | open | 親 Epic |
| #739 | open | 梅肉・しらす。現行維持（OD-4）。大葉の隣接物として関係 |
| #738 | open（PR） | Steam S3。`PizzaStage.tsx`（+15 −2）・`GameScreen.tsx`・`App.tsx`・`main.tsx`・`Steam.css`。`IngredientGlyph.tsx` / `App.css` は触れない |
| #749 | open | Fry。eggplant の絵（`pieceVisual`）は別 Gate。F2 以降 HOLD |
| #753 | open（PR・docs-only） | Style Lock V2 §12 eggplant。**merge 後に Style Lock §10.2 / §11 の大葉・牛肉・ピーマン更新を docs-only で行う予定** |
| #748 / #759 | #759 merged、#748 open | `ingredients.ts` 等の claim は 2026-11-18 まで（#758・#753 の記述による。#748 本体のコメントは精読していない） |
| #756 / #757 / #762 / #763 | open draft | Steam Playable Lab。`src/preview/**`・`src/main.tsx`・`src/logic/steam/**` 中心。**#763 の変更ファイル（53 件）に `PizzaStage.tsx` / `IngredientGlyph.tsx` / `App.css` は含まれない（確認済み）。#756 / #757 / #762 のファイル一覧は個別には確認しておらず、題名と #763 の系統からの推定** |
| #468 | open（古い） | `App.css` の `.pizza-cheese--mozzarella` のみ（HOT 共有、glyph ルールとは別の箇所） |
| Batch 19 burrata 専用 SVG | **GitHub 上で Issue・PR・claim を確認できなかった**（issue/PR 検索で burrata の open 項目なし。`docs/` の burrata は過去の設計資料のみ） | 未起票または別リポジトリ・口頭計画の可能性。**依存判断は「未確認」** |

既存資料: `docs/reports/TETO_ISSUE-733_ICONS_Result.md`、`TETO_ISSUE-758_SHISO-1-35EM_Result.md`、`TETO_ISSUE-739_ICONS_Result.md`、`docs/decisions/TETO_INGREDIENT-ICON-2.0_STYLE-LOCK-V2.md`、`docs/design/candidates/ingredient-icons-2.0-733-739/`。

## 3. 現在の描画方式（コードを読んだ結果）

| 項目 | beef | green-pepper | shiso（大葉） |
|---|---|---|---|
| 食材 ID / `pieceVisual` | `beef` / `beef-slices`（`ingredients.ts:1050`） | `green-pepper` / `green-pepper-strips`（`:703`） | `shiso` / `shiso-leaf`（`:985`） |
| SVG の所在 | `IngredientGlyph.tsx` `BeefSlices`（rect 3 組×3 層＝9 rect、64×64） | 同 `GreenPepperStrips`（`lobedRing` で計算した 2 つのリング、`evenodd`） | 同 `ShisoLeaf`（鋸歯の葉＋葉脈 9 本、64×64） |
| 表示サイズ規則（`App.css`） | `.ingredient-glyph--beef-slices` **1.2em** / margin −0.1em（`:876`） | **1.45em** / −0.225em（`:8357`、Pilot E） | **1.35em** / −0.175em（`:851`、#758）。共通 1.2em 群の後に個別ルール |
| 占有ボックス | 1em を維持（負マージン） | 同 | 同 |
| トレイ | `.ingredient-chip__emoji` font 26px（`:1641`）。glyph はその em 倍 | 同 | 同 |
| ピザ上 | `.ingredient-piece-visual__emoji` font = 28px × scale 系（`:800`）。実測: beef/pepper 28px、shiso 19.6px（xs 相当） | 同 | 同 |
| 焼成時 | 外側ラッパーの inline `filter`（`toppingVisualFrame` の連続曲線）。結果画面で font 0.75 倍（実測 21 / 14.7px） | 同。接地影の楕円はピザ上では非表示（`:8380`） | 同 |
| 接地影 | SVG 内の楕円（ピザ上でも表示） | ピザ上では CSS で非表示 | SVG 内の楕円 |
| 回転 | `stablePieceRotation`（決定的、`--piece-rotation`）。本監査では角度を実測していない | 同 | 同 |
| 重なり | 個別の衝突回避なし。後に置いた方が上 | 同 | 同 |
| フォールバック | `emoji` は「必須だが表示されない」文字フォールバック（`ingredients.ts` のコメント）。SVG 未定義時のみ使われる | 同（🌶️ はテキスト用のみ） | 同 |
| サイズ class（`toppingSizeClass.ts`） | `m` | `m` | `xs`。**描画には未使用**（S1 は純データ。参照は preview のみ） |
| 炒め（Prep、Preview/DEV・本番 OFF） | `CookingPrep.css` が rect の `nth-of-type` を色変えする | — | — |

スマホ制約: トレイのチップは高さ 64px、幅 118px（390）/108px（360）、アイコンの基準 26px。ピーマンの glyph（37.7px）は基準を超えるが、チップ内に収まっている（撮影で確認）。

## 4. スクリーンショット一覧（保存先）

`docs/reports/screenshots/ingredient-icons-733-758-audit/`（すべて **現行 main の実画面**。提案モックは作っていない）

| パス | 内容 |
|---|---|
| `sheets/zoom-stages-iphone-{390x844,360x800}.png` | **比較シート**: 3 食材 × （トレイ／配置 1／配置 4／焼成後 RESULT）の拡大（実測の幅つき） |
| `sheets/discrimination-iphone-{390x844,360x800}.png` | 識別シート: 緑系 8 種・茶系 8 種（カラー＋グレースケール）、重ね置き、8 種混在 |
| `capture/{beef,pepper,shiso}-{1-tray,2-placed1,3-placed4,4-baked}-*.png` | 各食材の 4 段階（全画面） |
| `capture/*-pizza-*.png`、`*-tray-chip-*.png` | ピザ部分・トレイチップのみの切り出し（DSF 2） |
| `capture/{greens,browns,mix,overlap}-*.png` | 緑系／茶系の並び、混在、重ね置き（トレイ・配置・焼成・グレースケール） |
| `capture/*.json` | 各 glyph の実測（箱 w/h、font、em 比、位置） |
| `measurements-contrast.json` | ピクセル由来のコントラスト・見かけの大きさ（**推定**） |
| `raw733/`、`raw758/` | 既存 E2E（`issue-733-icons.spec.ts` 4 件・`issue-758-shiso.spec.ts` 6 件、**無変更で実行・全 pass**）の出力 |
| `capture-script/` | 本監査の撮影スクリプト（`.txt`、リポジトリのテストには含めない） |

撮影条件: 390×844 / 360×800。ゲーム状態は既存の入口だけで作った（図鑑の「研究する」→生地→チーズ→具材。セーブはテスト同様 localStorage の初期投入）。DEV 専用機能の追加・製品コード変更なし。
撮影できなかったもの: **炒め済み（Prep）の牛肉**（Preview/DEV 限定・本番 OFF の別経路。今回の対象外とした）、iPhone Safari、WebKit、DPR1 の撮影（DSF 2 のみ）。
注記: 配置直後の画像は着地アニメーション中（半透明）のものがあるため、本監査では 1.5 秒待った画像を使っている。

## 5. 比較シート（要約）

下表の画像は上記 `sheets/` を参照。問題箇所は拡大して確認した。

| 項目 | beef | green-pepper | shiso-leaf |
|---|---|---|---|
| トレイでの視認性 | ◎ 赤い断面と濃い縁。形が明瞭 | ◎ 2 つの輪＋白い内壁。最も大きい | ○ 葉脈が読める。文字ラベルと併せて明瞭 |
| ピザ上（焼成前） | ◎ | ◎ | ○ 小さい（26.5px） |
| 完成後（RESULT） | ○ 暗い赤茶の 3 塊。縁が濃い | ○ 輪郭は残るが中身はやや黄緑 | **△ 19.8px。葉脈は細く、遠目では「緑の小さな点」に近い** |
| 輪郭の分かりやすさ | ◎（縁/背景 8.3:1） | ○（縁/背景 5.0:1） | **△（縁/背景 3.1:1）** |
| 背景とのコントラスト（面） | ○ 2.8:1 | △ 1.8:1 | **△ 1.6:1** |
| 食材らしさ | ○ 角切り肉＋断面で「肉」。牛と断定はしにくい（ラベル依存） | ○ 輪切りでピーマン。#733 の「さやいんげん」問題は解消 | ○ 鋸歯と葉脈で大葉。バジルとの差は形で判別 |
| 他食材との識別 | ◎ ベーコン（帯）・ハム（骨付き絵）・ソーセージ/サラミ（円）と形が別。グレースケールでも別 | ◎ ズッキーニ（細長）・青ねぎ（小さな輪）・ハラペーニョ（緑の四角）と別 | ○ バジル/パセリ/ハーブ絵文字とは形で別だが、最小で最も淡い |
| サイズの適切さ | ○（1.2em。ピーマンより小さい） | ◎ | **△ 3 つの中で最小** |
| 重なった場合 | ○ 暗い縁が残り、下のピーマン/大葉を隠す | ○ 他に隠されても輪の形は残る | △ 牛肉に半分隠れると小さくて読みにくい |

## 6. 視認性の実測結果

**実測 = DOM の `getBoundingClientRect` / computed style（DSF 2、390×844 と 360×800 で同一値）。推定 = スクリーンショットのピクセル解析（背景色との距離 >40 の範囲。接地影を含み、±1〜2px の誤差）。**

### 6.1 表示サイズ（実測、glyph の外接箱、CSS px）

| 場所 | font | beef | green-pepper | shiso |
|---|---:|---:|---:|---:|
| トレイ chip | 26px | 31.2（1.2em） | 37.7（1.45em） | 35.1（1.35em） |
| ピザ上（焼成前、steady） | 28px（shiso 19.6px） | 33.6 | 40.6 | **26.5** |
| 結果画面（焼成後） | 21px（shiso 14.7px） | 25.2 | 30.4 | **19.8** |

- 配置直後は着地アニメーションで箱が 32〜37px / 39〜45px 程度まで変動する（実測）。表は静止後の値。
- 大葉の em 比は実測 1.349〜1.35、ピーマン 1.449〜1.45、牛肉 1.199〜1.2（設定どおり）。

### 6.2 見かけの大きさとコントラスト（推定、4 個の平均）

| 食材 | 場面 | 見かけの幅×高さ（px） | 面のコントラスト | 縁のコントラスト |
|---|---|---|---:|---:|
| beef | 焼成前 | 29.6×29.0 | 4.1:1 | 10.3:1 |
| beef | 焼成後 | 23.5×23.6 | 2.8:1 | 8.3:1 |
| green-pepper | 焼成前 | 35.9×35.2 | 2.6:1 | 6.3:1 |
| green-pepper | 焼成後 | 28.4×28.9 | 1.8:1 | 5.0:1 |
| shiso | 焼成前 | 21.0×24.0 | 2.0:1 | 4.2:1 |
| shiso | 焼成後 | 17.0×18.5 | **1.6:1** | **3.1:1** |

コントラストは WCAG 相対輝度比（glyph の平均色 / 最暗 10% 色 と周囲 10px の中央値の背景色）。画像認識の閾値ではなく、**食材間の相対比較**として使う。

**訂正（2026-11-06、実装準備の再確認で判明）:** 上表の「焼成後」の縁コントラストは、4 個の平均に **白いチーズの上に載った 1 個**（背景が淡い色）を含んでいた。チーズ上の個体を除き、**焼き色の生地の上だけ**で見ると、縁のコントラストは beef 約 7.2:1、green-pepper 約 4.4:1、**shiso 約 2.6〜2.9:1**（`measurements-contrast.json` の `bg` 参照）。順位と結論（大葉が最弱）は変わらず、大葉は **3:1 を下回る**。

### 6.3 判定の根拠

- 結果画面の大葉は、見かけ約 17×18px・縁 3.1:1 で 3 食材中最小・最淡。葉脈（太さ 1.8/64 ≒ 0.5px）は 1x では実質見えない（2x の画像では見える）。**1x（DPR1）の実測は未実施**で、推定にとどまる。
- 牛肉は縁が濃く（8.3:1）、小さくても形が崩れない。ただし結果画面では 3 塊が暗い赤茶で、ほぼ縁の色に支配される。
- ピーマンは面のコントラストが低い（1.8:1）が、濃い縁（5.0:1）と中央の穴で形が保たれる。

## 7. 食材ごとの改善候補（A〜E）

方針: Owner 決定（OD-1〜6、#758 の 1.35em 承認）と矛盾しない案を優先。**今回はいずれも実装しない。**

### beef — 推奨 **E**（P3）

| 案 | 評価 |
|---|---|
| A 形状 | 不要。角切り＋断面は他の肉系と形が別で、小さくても崩れない |
| B サイズ | 結果画面 25.2px はピーマン 30.4px より小さい。1.2→1.35em は可能だが、`App.css`（HOT）変更と iPhone HV が必要。**iPhone で小さいと判断された場合の候補** |
| C 配置 | 不要（個別の重なり制御は共通ロジック変更になる） |
| D 色 | 焼成後に縁と皮が暗く見える懸念あり。ただし色の変更は OD-A（炒め済みの目標色）と別経路で、素の SVG の色は Owner が採用した設計。**変更しない** |
| E | 推奨。観察: 焼成後の暗さ、茶系との識別（今回の 8 種並びでは識別可） |

「牛肉として認識できるか」: 形は肉らしいが「牛」の決め手はラベル。「小さく表示されても崩れないか」: 23.5px で崩れない。「焼成後に他の茶色い食材と区別できるか」: ベーコン・ハム・ソーセージ・サラミ・ペパロニ・豚肉と並べ、カラー／グレースケール両方で区別できた。

### green-pepper — 推奨 **E**（P3）

| 案 | 評価 |
|---|---|
| A 形状 | 不要（輪切り×2 で「さやいんげん」問題は解消済み） |
| B サイズ | 最大（1.45em）で十分。むしろトレイで基準 26px を超える点は #758 のチップ内収まり確認で問題なし |
| C | 不要 |
| D 色 | 結果画面で面が黄緑寄り（1.8:1）。縁があるため緑と判別できる。変更不要 |
| E | 推奨 |

「ピーマンらしい輪郭」: 4 つの膨らみ＋中空で保たれる。「焼成後も緑が識別」: 淡い緑だが識別できる。「小さいサイズで輪切り・細切りの形」: 28px 台でも輪が読める。**注意:** visual ID が `green-pepper-strips` のまま（OD-3）。名称と形の不一致は技術負債で、改名は #748 の claim 終了後（11/18 以降）に別 Gate。

### shiso-leaf — 推奨 **A＋D（候補）／B は非推奨**（P2）

| 案 | 評価 |
|---|---|
| A 形状・輪郭 | 葉脈と中央脈の線を太くする（1.8→2.4 程度）、鋸歯をやや深く。**小さく表示された時の「葉らしさ」を直接上げる。SVG 1 関数のみで済む** |
| B サイズ | 1.35em は Owner 承認済み。さらに拡大（1.5em）すると、しらすとの重なりが密集配置で 22〜23.5%（実測、1.35em 時）からさらに悪化する。**単純拡大は非推奨** |
| C 配置 | 共通ロジック変更になるため非推奨 |
| D 色 | 縁 `#245f2c` を濃くする、または面の明暗差を上げる。縁のコントラスト 3.1:1 を 4:1 以上へ |
| E | 現状維持も選べる（iPhone HV は PASS 済み）。ただし数値上は 3 食材で最弱 |

「ピザ上で小さすぎないか」: 焼成後 19.8px は他の緑食材（青ねぎ 17.6px、しらす 24.1px）と同程度で、極端に小さいわけではない。「葉の輪郭・葉脈が見えるか」: 輪郭は見える、葉脈は 1x では弱い（推定）。「他の緑食材と区別できるか」: バジル・パセリ・パクチー・青ねぎ・ズッキーニ・ピーマンと並べて形で区別できた。「単純な拡大で重なり・バランスが崩れないか」: 1.35em までは崩れない（実測、既存 Result と一致）。

### 候補の優先度

| 順 | 内容 | 優先度 |
|---|---|---|
| 1 | 大葉の線・縁の改善（A＋D、SVG のみ） | P2 |
| 2 | 牛肉の 1.35em 化（B） — iPhone HV で「小さい」と出た場合のみ | P3（条件付き） |
| 3 | ピーマン/牛肉の維持（E） | P3 |
| 4 | visual ID の改名（`green-pepper-strips` / `beef-slices`） | 別 Gate（#748 claim 終了後） |

## 8. 競合・claim 監査

| 項目 | 結果 |
|---|---|
| #733 / #758 の claim | #758 は 2026-11-06 に release 済み。#733 は複数の claim コメント（最新の期限 2026-11-08）があるが、**release コメントは確認できなかった**。PR #760 は merge 済みで、実質終了。新規着手前にコメントで release を確認 |
| #748（Batch 18） | `ingredients.ts` 等を 2026-11-18 まで claim（#758・#753 の記述）。**食材 SVG だけの改善なら重ならない** |
| #738 STEAM | `PizzaStage.tsx`（+15 −2）を変更。**食材 SVG の改善は `PizzaStage.tsx` を触らないので競合しない** |
| #749 FRY | eggplant の絵が前提（#753 G2 → #748 claim 終了・#738 merge 後）。今回の 3 食材とは独立 |
| #753 | Style Lock V2 を変更中。**3 食材の記述更新（大葉 §10.2 の 1.35em など）は #753 merge 後に docs-only** |
| #756 / #757 / #762 / #763 | Steam Lab（#763 のみファイル一覧を確認。他は推定）。`PizzaStage.tsx` / `IngredientGlyph.tsx` / `App.css` との重なりは確認できず |
| #468 | `App.css` の mozzarella のみ。サイズ変更（B）をする場合のみ HOT 重複（後勝ちで rebase） |
| Batch 19 burrata | **GitHub で Issue・PR・claim を確認できず**。burrata は `IngredientGlyph.tsx` への追加と `ingredients.ts`（#748 claim 中）を伴う見込み。同じ `IngredientGlyph.tsx` を編集するため、並行する場合は関数単位で分離され衝突は小さいが、**起票・claim の確認が必要** |
| `PizzaStage.tsx` を変更する他の PR/claim | #738 のみ（上記）。本件は不要 |
| 共通描画ロジックの変更 | **不要**（A・D は SVG の中身のみ） |
| CSS の変更 | A・D は不要。B（サイズ変更）のみ `src/App.css`（HOT）。beef の SVG の構造（rect の数・順）を変える場合は `src/components/CookingPrep.css` の `nth-of-type` と `beefDoneness` のテストも変更が必要 |

## 9. 推奨する実装順序（Owner 承認後）

1. **Owner 判断**（§10）。承認がなければ何もしない。
2. 大葉 A＋D: `IngredientGlyph.tsx` の `ShisoLeaf` と `IngredientGlyph.test.tsx` のみ。新しい claim（#758 の追跡に紐づけ）。CSS・サイズは変えない。before/after 画像と 390×844 の動画を HV ポリシーどおり用意。**#738・#748 の merge を待つ必要はない**。Batch 19 burrata とは同じファイルでも別関数で並行可（先に merge した側に後続が rebase）。
3. iPhone Safari 実機 HV（Owner）。PASS で確定、Style Lock V2 の記述更新は #753 merge 後に docs-only。
4. 牛肉の B は、実機で「小さい」と出た場合のみ別 Issue・別承認（`App.css` HOT、#468 と順序調整）。
5. visual ID の改名は #748 claim 終了（11/18）後に別 Gate。

## 10. Owner 判断事項

| # | 判断 | 推奨 |
|---|---|---|
| OD-1 | 大葉の線・縁の改善（A＋D）に進むか | 進めてよい（P2）。SVG のみ。不要なら E |
| OD-2 | 牛肉・ピーマンは現状維持（E）でよいか | 維持（P3） |
| OD-3 | 牛肉を 1.35em にする案を、iPhone HV の結果次第で起こすか | 結果次第（条件付き） |
| OD-4 | #733・#758 を open のまま追跡するか、Result への紐づけで close するか | Owner 判断（実装は merge 済み。残りは iPhone HV と Style Lock 更新） |
| OD-5 | Batch 19 burrata の起票先と claim | 要確認（GitHub で確認できず） |
| OD-6 | 炒め済み牛肉（Prep、Preview/DEV）の視認性を別途監査するか | 今回は未撮影。必要なら別タスク |

## 11. 環境メモ・未実施事項

- 撮影環境のブラウザ: プロジェクトの Playwright（1.56.1）が求める revision が環境に無かったため、環境にある Chromium へ向けるシム（symlink）を作業用ディレクトリに作った。リポジトリのファイル・設定は変更していない。環境側の `/opt/pw-browsers/.../headless_shell` に symlink を 1 つ追加している（この環境のみ）。
- 既存の E2E（`issue-733-icons`、`issue-758-shiso`）は**変更せず実行**して全 pass。CI の再実行はしていない。
- 未実施: iPhone Safari・WebKit、DPR1 の実測、20〜48px の拡大縮小比較シート（#758 の調査 `6878e74` に既存）、炒め済み牛肉、提案モック（今回は作らず）。
- PR 作成・merge・Production ON・共有 Preview 更新・既存ブランチへの push・他担当の claim 変更は行っていない。
