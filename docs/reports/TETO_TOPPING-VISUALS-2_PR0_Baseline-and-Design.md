# Topping Visuals 2.0 — PR-0: 現状画像・比較基準・設計資料（docs-only、Issue #824）

状態: **Draft / HOLD・docs-only。実装なし。** merge・Production ON・共有 Preview 更新は未承認。PR-1 以降の実装は Owner の新しい承認が必要。
基準 main: `a5583622292ff6203b8c979f4c410389dbc05d15`（#851。作業開始時と提出時に `git fetch origin main` で確認、変化なし）。
根拠となる Owner 判断: [#824 2026-11-16 Pilot 順](https://github.com/perusonao/teto-pizza-game/issues/824#issuecomment-6919839572)、[#824 Owner Gate（PR-0 のみ承認）](https://github.com/perusonao/teto-pizza-game/issues/824#issuecomment-6933878548)（D1〜D6）。先行監査: [#824 READ-ONLY Fresh Audit](https://github.com/perusonao/teto-pizza-game/issues/824#issuecomment-6932921986)。

優先順位は Owner 判断どおり **Pilot 1 = parmigiano、Pilot 2 = cucumber**。egg / eggplant はバックログ（削除せず、Pilot より先行させない）。

## 0. 要約

1. **現状の「実画面」を 390×844 / 360×800 で 4 食材 × 3 状態（選択トレイ・配置直後・焼成後 RESULT）取得した**（§2）。Dex・図鑑・CUT・焼成中は未取得（§2.3）。
2. **cucumber がキウイに見える直接原因は絵文字の選択ミス**: `src/data/ingredients.ts` の cucumber は `emoji: "\u{1F95D}"` = **U+1F95D KIWIFRUIT（🥝）**。きゅうり（🥒 U+1F952）ではない。ピザ上もトレイ chip も同じ絵文字を使っているため、ピザ上だけ直しても chip は 🥝 のまま残る（§3.2、Owner 判断 Q1）。
3. **parmigiano は選択（トレイ chip）とピザ上が同一の CSS 板**（21×9 CSS px・-18° 回転）。ピザ上の実寸は 390×844 で約 21×9px、RESULT 縮小時はさらに小さい（§2.4）。
4. 先行監査の設計方向（`placedVisuals/**` に配置専用 SVG、`IngredientPieceVisual` に `surface` 境界）は**コード上で成立する**。ただし先行監査が挙げた呼び出し箇所に**漏れが 2 箇所**あった（トレイのドラッグプレビュー `IngredientTray.tsx:705`、`PostBakePiece.tsx:46`）。§4.3 で全 9 箇所を分類した。
5. 設計上の未決事項（Owner 判断が要る点）を §9 に決定表にまとめた。PR-1 着手の前提は **Q2（`surface` 既定値と呼び出し箇所の扱い）** と **Q3（Reference 見本のピース表現を揃えるか）**。

## 1. 開始前確認（実施結果）

| 項目 | 結果 |
|---|---|
| 最新 main SHA | `a5583622292ff6203b8c979f4c410389dbc05d15`（`git fetch origin main` で確認。提出直前にも再確認） |
| 読んだ資料 | `CLAUDE.md`、`docs/PROJECT_HANDOFF.md`（起動チェックリスト節）、`TETO_HUMAN-VERIFICATION-POLICY.md`、`TETO_SESSION-OPERATIONS_1.0.md`（§1 claim、§8 Efficient flow） |
| Issue | #824（本文・全 5 コメント）、#825（全 2 コメント）、#417（全コメント）、#749（全コメント） |
| 関連 PR | #782（eggplant 輪切り A 案の未配線 `EggplantGlyph`、open・mergeable clean・PROVISIONAL、変更 11 ファイルは新規のみ）、#738（steam S3。`PizzaStage.tsx`・`GameScreen.tsx`・`App.tsx`・`main.tsx` を変更）、#468（mozzarella melt Pilot。`App.css`・`PizzaStage.tsx`・`bakeVisual.ts`） |
| 既存 PR-0 / 同等作業 | open PR 40 件を確認（タイトル・ブランチ）。**#824 の PR-0 相当は無い**。remote ブランチにも `topping-visuals` / `placedVisuals` 系は無い（`visual` を含む古いブランチは別件の過去作業） |
| 作業ブランチ | `claude/teto-pizza-visual-pr0-o56f92`（本セッション専用。独立ブランチ、他者のブランチ・PR は未変更） |

## 2. A. 現状画像（before）

### 2.1 取得方法（provenance）

| 項目 | 内容 |
|---|---|
| 撮影対象のコード | main `a5583622292ff6203b8c979f4c410389dbc05d15` の `npm run dev`（`TETO_TEST_HOOKS=1`、ローカルポート 5183）。**共有 Preview・Production は使っていない** |
| ブラウザ | Playwright 同梱でない既存の Chromium（`/opt/pw-browsers/chromium`、headless）。**WebKit・実機 iPhone Safari は未使用** |
| viewport / 倍率 | 390×844（主）・360×800（副）、`deviceScaleFactor: 2`（画像は 780×1688 / 720×1600） |
| 操作 | 実ポインター入力で通常のゲーム操作（Free Cook: 生地 → ソース → チーズ → 具材 → 焼成 → RESULT）。使い捨てのセーブ（localStorage、ブラウザコンテキスト内のみ。リポジトリ・実機セーブには無関係）に対象食材 + mozzarella / basil / tomato-sauce を所持させて開始 |
| 焼成 | 「ジャスト」（`bakeToTarget` で窓 58〜78 内）。焼きすぎ・生焼けは未撮影 |
| 配置直後 | 最後のタップ直後にスクリーンショット。**最後の 1 ピースは着地アニメーション中（半透明に写る）** |
| 撮影スクリプト | リポジトリには commit していない（使い捨て。Playwright の公開 API と `e2e/gestures.ts` の既存ヘルパのみを使用） |

画像は `docs/reports/screenshots/topping-visuals-2/pr0-before/`（一覧は同ディレクトリの `INDEX.md`）。命名: `<食材ID>_<viewport>_<状態>.png`。

### 2.2 取得できた画像（実画面）

| 食材ID | 選択トレイ（390 / 360） | 配置直後（390 / 360） | 焼成後 RESULT（390 / 360） |
|---|---|---|---|
| parmigiano | ✅ / ✅（チーズ工程で mozzarella 選択中の chip 行に parmigiano を表示） | ✅ / ✅ | ✅ / ✅ |
| cucumber | ✅ / ✅（具材工程のトレイ） | ✅ / ✅ | ✅ / ✅ |
| egg（バックログ証跡） | ✅ / ✅ | ✅ / ✅ | ✅ / ✅（ビスマルクが発見されるため RESULT は NEW PIZZA 表示） |
| eggplant（バックログ証跡） | ✅ / ✅ | ✅ / ✅ | ✅ / ✅ |

合計 24 枚 + 比較ボード 2 枚（`board_<viewport>_crops-of-real-captures.png`）。**比較ボードは上の実画像の切り抜きを並べた派生物**で、別撮影ではない。

### 2.3 未取得（代替画像で埋めていない）

| 画面・状態 | 理由 |
|---|---|
| Dex（図鑑）カード / 図鑑のレシピサムネ（`PizzaThumbnail`） | 今回の撮影経路に含めず未取得。D2 で「変更しない」対象なので PR-1 では before/after で同一性を確認する（§6） |
| Reference 見本（mini reference / popover） | 同上。Free Cook には見本が無く、ガイドレシピでの撮影が別途必要 |
| 焼成中（needle 途中）・焼きすぎ・生焼け | 未撮影。焼成前後の状態差の評価には PR-1 で必要（§5.5） |
| CUT 画面 | 未撮影 |
| 実機 iPhone Safari・WebKit | 未実施。Owner の実機 HV が必要（本 PR-0 に HV は含まない） |
| 実レシピ上の画像（pizza-salad / peking-duck-pizza / asparagi 系 等） | 未撮影。今回は Free Cook の最小構成（mozzarella + 対象食材）。実レシピは PR-1 の HV で撮る |

### 2.4 計測（DOM、Chromium、`getBoundingClientRect` / computed style）

| 食材 | 配置直後（390×844 と 360×800 で同一） | RESULT（縮小時） |
|---|---|---|
| parmigiano | ラッパー 21×9px、内側 `.pizza-cheese--parmigiano` の回転後外接 19.3×12.8px、`filter` なし | **未計測**（RESULT の parmigiano 計測は撮影スクリプトの不具合で取得できなかった。画像のみ。cucumber の縮小比 0.75 から約 0.75 倍と推定されるが推定であり記録値ではない） |
| cucumber | ラッパー 29.7×29px、`font-size` 23.8px（size class `s`）、`filter: drop-shadow(0 2px 2px rgba(0,0,0,.3))` | 22.3×22px、`font-size` 17.85px、`filter: brightness(0.975) saturate(1.033) sepia(0.066) drop-shadow(...)`（焼成の連続曲線が絵文字ラッパーに掛かる） |
| 生地（`.pizza-stage`） | 390×596 / 360×552（配置時）、RESULT では 390×204 / 360×204 | — |

→ **ピザ上の 1 ピースは約 20〜30 CSS px**。設計目標はこの寸法で識別できること（§5・§6 の判定は 24 / 32 / 48px とグレースケールも併用）。

## 3. 現状の描画経路と原因

### 3.1 parmigiano（Pilot 1）

- `ingredients.ts:234`: `category: "cheese"`、`emoji: 🧀`、`color: #f6e6a8`、`placement: "scatter"`、`pieceVisual` なし。サイズ区分 `s`（`toppingSizeClass.ts:49`）。
- `IngredientPieceVisual` は cheese かつ `pieceVisual` なしの場合、`.pizza-cheese.pizza-cheese--parmigiano` の **CSS 板**を描く（`App.css:975`: 21×9px、`border-radius: 2px`、`rotate(-18deg)`、黄白のグラデーション、白い縁取りの box-shadow）。**トレイ chip・ドラッグプレビュー・ピザ上・RESULT・Reference・Dex サムネが全て同じ板**。
- 焼成は `cheeseVisualFrame` の `--bake-melt-scale` と `filter`（ラッパー）。部位の色変化は無い。
- 実画像（390×844 配置直後 / RESULT）: 板が mozzarella の溶けた塊の上に **「バターの角切り」のように 2 本載っている**。Owner の Batch 25 HV 観察「ブロック状で振りかけた見た目にならない」と一致。
- 既存の削り片系: `truffle-shavings`（黒）、`ricotta-salata-shavings`（白）が `pieceVisual` として実装済み。parmigiano はこの 2 つと**色・形で区別**が必要。
- レシピ参照: `recipes.ts` に 4 件 + `lateCatalog.ts` に 2 件 = 6 件（`ingredientId: "parmigiano"` の行数。staged カタログには無し）。

### 3.2 cucumber（Pilot 2）

- `ingredients.ts:1382`: `category: "topping"`、**`emoji: "\u{1F95D}"`（U+1F95D = KIWIFRUIT 🥝）**、`color: #7fae5a`、`placement: "scatter"`、`pieceVisual` なし。サイズ区分 `s`（`toppingSizeClass.ts:112`）。
- ピザ上の描画は `IngredientPieceVisual` の非チーズ分岐: `<span class="ingredient-piece-visual__emoji">` の中の **絵文字そのまま**。つまり **キウイの断面が置かれている**（実画像でも茶色い皮・白い芯・放射状の黒い種のキウイ断面）。Owner の観察「キウイの断面に見える」の原因は**絵の問題ではなくデータ上の絵文字の選択**。
- 実画像: ピザ上 29.7px（RESULT で 22.3px）の小さなキウイ。mozzarella（Canvas 溶けチーズ）の上でも茶色い皮の輪郭は見えるが、きゅうりと読めない。
- レシピ参照: `recipes.ts` の peking-duck-pizza、`lateCatalog.ts` の pizza-salad の 2 レシピ（どちらも cucumber `minCount: 2`、`applicationPhase` 指定なし = **焼成と一緒に焼かれる**）。
- **重要**: トレイ chip・Dex・RESULT の材料チップ（「🥝 きゅうり」）も同じ絵文字。ピザ上だけ置換しても**選択アイコンは 🥝 のまま**になる。Owner は「選択アイコンは変更しない」としているため、この不整合の扱いを **Q1** として提示する（`ingredients.ts` の 1 文字修正は #417 の責務・hot ファイルで本作業の範囲外）。

### 3.3 egg / eggplant（バックログ。証跡のみ）

- egg: 🥚（殻付き卵）がそのまま置かれ、黄身の部位が絵として存在しない。実画像ではオレンジ寄りの卵が 3 個。ビスマルクの「玉子 1 個の目玉焼き」とは別の絵。
- eggplant: 🍆 がそのまま置かれる。実画像で丸ごとのナスが 3 本。参照レシピは `recipes.ts` に 10 件 + `lateCatalog.ts` に 2 件 = **12 件**（先行監査の「10」は `recipes.ts` のみの集計）。
- 非チーズの焼成表現は `toppingVisualFrame` の `filter` のみ（部位ごとの色変化なし）。

## 4. B. 設計: 選択アイコンと配置後描画の分離

### 4.1 責務の分離（原則）

| 用途 | 責務 | アセット | 変更可否（本取り組み） |
|---|---|---|---|
| 選択アイコン（トレイ chip・ドラッグプレビュー・在庫・Dex カード・Shop・RESULT 材料チップ等） | 小サイズで識別できる記号的な絵（#417） | `IngredientGlyph`（`ingredient.pieceVisual` / `emoji`） | **変更しない**（Owner D1・D2） |
| ピザ上の配置物（PizzaStage・RESULT のピザ・必要に応じて Reference） | 切り方・配置・焼成前後・質感 | **新規** `src/components/placedVisuals/**` の自己完結 SVG | PR-1 以降で追加 |

両者は同じ食材 ID を参照してよいが、**アセット・責務・受け入れ基準を別管理**にする。

### 4.2 接続方針（`IngredientGlyph` と `IngredientPieceVisual`）

現状:

```
IngredientPieceVisual
 ├ cheese かつ pieceVisual なし → .pizza-cheese--<id>（CSS 形状）
 ├ cheese かつ pieceVisual あり → .pizza-cheese.pizza-cheese--<id>.pizza-cheese--glyph > <IngredientGlyph variant="placed">
 └ それ以外                  → .ingredient-piece-visual__emoji > <IngredientGlyph variant="placed">
IngredientGlyph(variant)       ← variant は SVG 専用食材の見た目切替用。pieceVisual なしは variant を見ずに絵文字を返す
```

提案（D1 承認方向。実装は PR-1 以降）:

1. `IngredientPieceVisual` に `surface?: "placed" | "selection"` を追加する。
2. **registry を id で引く**（`placedVisuals/registry.ts`: `Record<ingredientId, PlacedVisualComponent>`）。`Ingredient` 型や `ingredients.ts` は触らない。前例: `toppingSizeClass.ts`（id → 値）。`IngredientGlyph.tsx` の「id を読まない」方針とは異なる点を Owner が了承する必要がある（先行監査 D1(b)）。
3. `surface === "placed"` かつ registry に登録がある場合のみ、**既存のラッパー要素の内側**に placed SVG を描く:
   - cheese（parmigiano）: `.pizza-cheese.pizza-cheese--parmigiano.pizza-cheese--glyph` のラッパーを維持 → `cheeseStyle`（`--bake-melt-scale`・`filter`）が従来どおり効く。`PizzaStage.tsx` は変更不要。
   - 非 cheese（cucumber）: `.ingredient-piece-visual__emoji` のクラスを維持 → E2E `finished-pizza-visual-2.0.spec.ts` が使う `.pizza-topping--<id> .ingredient-piece-visual__emoji` の契約と、`toppingPieceStyle` の `filter` が従来どおり効く。
4. 登録の無い食材・`surface="selection"` の呼び出しは**現状と同一のコードパス**（回帰ゼロの保証をテストで固定、§6）。
5. 新 SVG は Style Lock V2 準拠: 64×64 viewBox、`1em`、`aria-hidden`、`id` / gradient / `url(#` なし（同一ページに多数置けるように）。

### 4.3 呼び出し箇所の分類（全 9 箇所）

`IngredientPieceVisual` を呼ぶ箇所を全て grep で洗い出した。先行監査の 3 箇所（トレイ chip・在庫・Dex サムネ）に **2 箇所の漏れ**（★）がある。

| # | 箇所 | 用途 | `surface` 案 | 備考 |
|---|---|---|---|---|
| 1 | `IngredientTray.tsx:529` | トレイ chip | **selection** | Owner D1: 選択アイコンは変更しない |
| 2 ★ | `IngredientTray.tsx:705` | トレイのドラッグプレビュー（指で持っている間） | **selection**（要確認・Q2） | 持ち上げ中の見た目。配置後と同じにするか選択と同じにするかは未決。先行監査に漏れ |
| 3 | `InventoryOverlay.tsx:92` | 食材庫（在庫一覧） | **selection** | |
| 4 | `PizzaThumbnail.tsx:67` | レシピカード / Dex サムネ | **selection** | Owner D2: Dex/選択サムネは変更しない（golden も不変） |
| 5 | `PizzaStage.tsx:1477` | ピザ上のトッピング（生地・焼成・CUT・RESULT） | **placed** | **PizzaStage.tsx は変更しない**（既定値 placed で足りる）ことが `surface` 既定値案の根拠 |
| 6 | `PizzaVisualPieces.tsx:73`（`renderPizzaVisualPieces`） | Reference mini / popover / PlayerReference の見本ピース | **未決（Q3）** | 見本は「ピザ上の配置」なので placed が自然だが、`PlayerReferencePreview.test.tsx`（L46 が 🥚 を期待）と `rt01ReferenceBaseline` golden が動く可能性。D2 は Dex/選択サムネのみを明示しており Reference は未指定 |
| 7 ★ | `PostBakePiece.tsx:46` | 焼成後に載せるピース（POST_BAKE 工程） | **placed**（要確認） | 先行監査に漏れ。POST_BAKE 食材に対象（parmigiano / cucumber）が含まれるレシピは未確認 |
| 8 | `ReferenceThumbnail.tsx` | 6 を経由 | 6 に従う | `renderPizzaVisualPieces` 経由 |
| 9 | `ReferencePreview.tsx` / `PlayerReferencePreview.tsx` | 6 を経由 | 6 に従う | 同上 |

**既定値の選択（Q2）**:
- 案 X（先行監査推奨）: **既定 = `placed`**。選択系の 4 箇所（1〜4）に `surface="selection"` を 1 行ずつ追加。`PizzaStage.tsx` 無変更。リスク: 将来の新しい呼び出し箇所が黙って placed になる。→ 対策: 呼び出し箇所を列挙する architecture テスト（新規 `surface` なしの選択系呼び出しを検出）。
- 案 Y: 既定 = `selection`（現状と同一）、placed 箇所（5〜7）に `surface="placed"` を渡す。安全側だが **`PizzaStage.tsx` の 1 行変更が必要** → hot ファイル・#738 / #468 と競合しうる・D5 の別 Gate が要る。
- **推奨: 案 X**。`PizzaStage.tsx` に触れず、既存の呼び出し契約を最大限保てる。

### 4.4 Pilot 1: parmigiano の削り片表現

目標: 「ブロック」ではなく**薄く不規則な削り片と粒が小さな山になっている**ことが 20〜30px で読めること。

| 項目 | 設計 |
|---|---|
| 1 ピースの意味 | 1 ピース = 削り片の小山（5〜8 片 + 2〜3 粒）。レシピ上は 1〜2 ピースなので、見た目の重みは 1 ピースが持つ。**操作（PLACE / SPRINKLE）の採否は #825 の範囲**で本設計は操作を変えない |
| 形 | 薄いカールした三日月・欠けた楕円・細かい粒を、重なりと回転をばらつかせて配置。直線的な矩形を使わない |
| 色 | 暖かい淡黄（既存の `color: #f6e6a8` 系）を基調。縁は少し濃い黄（`#e3cf7f` 周辺）、ハイライトは `#fff6d8`。**ricotta-salata（白）・truffle（黒）・mozzarella（白い塊）と区別**する |
| 外形 | 全体が 28px 四方のラッパー（`.pizza-cheese--glyph` が既存のサイズ変数で与える）に収まる。現行の 21×9 より面積が増えるため、**size class `s` の足跡が他食材と重ならないか**を PR-1 で確認 |
| 回転 | `.pizza-cheese--parmigiano` の `rotate(-18deg)` は App.css 側に残る。不規則な山には問題ないが、PR-1 で見た目を確認（App.css は変更しない方針） |
| 焼成前 | 淡黄で縁がシャープ、半透明の薄い削り片 |
| 焼成後（ジャスト） | 削り片の縁が金褐色にカールし、艶（ハイライトの不透明度増）。下のチーズに少し溶け込んだように見える |
| 焼きすぎ | 縁が濃茶でパリっとした色。色は **CSS 変数**（`--pv-edge` 等）でラッパー側の焼成値から導く案を検討（D5: `--bake-heat` の設計調査。`PizzaStage.tsx` 変更は別 Gate） |
| 焼成の仕組み | 第 1 段階は既存の `cheeseStyle`（`--bake-melt-scale` + `filter`）だけを使う。部位ごとの色変化は `--bake-heat` が要るため PR-1 の範囲外（Q5） |

### 4.5 Pilot 2: cucumber の輪切り表現

目標: **キウイと取り違えない**。キウイとの差（皮・果肉・芯・種）を明確にする。

| 要素 | キウイ（現状） | きゅうり（目標） |
|---|---|---|
| 皮 | 茶色の毛羽立った輪 | **濃い緑**の細い輪（ツヤ、薄い明るい点） |
| 果肉 | 鮮やかな黄緑 | **淡い緑白**（水っぽく半透明感）、外周に向かって緑が濃くなるグラデなし（`id`/gradient 禁止のため段階的な同心円で表現） |
| 芯 | 白い大きな芯 | 芯なし。中央に薄い 3 つの房（三角配置）があり、そこに種 |
| 種 | 黒く放射状に並ぶ | **小さな淡い種**（淡黄白）が房の中に点在。黒くしない |
| 形・厚み | 楕円寄り | 真円〜わずかに楕円の**薄い輪切り**（厚みは縁の細い影で表現） |

- 1 ピース = 輪切り 1 枚（または 2 枚の重なり）。複数を重ねる場合は 1 ピースの足跡内に収め、`size class s`（現状 約 29.7px / RESULT 22.3px）を超えない。
- 色: 皮 `#3f6b2f` 周辺、果肉 `#e4f1c8` 周辺、種 `#f4f8dc` 周辺、ハイライト白。**最終色は PR-1 で ΔE（CIE76）と 24 / 32 / 48px・グレースケールで確認**し、トマトソース・チーズの上での視認性を測る。
- **焼成の注意**: 現行の `toppingVisualFrame` は `sepia` を最大約 0.2、`saturate` を変える。**緑の輪が焼成で茶・オリーブ寄りになり「火の通ったきゅうり」に見える懸念**がある（実画像でも RESULT の cucumber は `sepia(0.066)` が乗っている）。選択肢: (a) `bakeRoastResistant: true` を cucumber に付ける（`ingredients.ts` の変更が必要・hot・Q4）、(b) placed SVG 側でフィルタを見込んだ色にする、(c) 現行のまま許容。**Q4 として Owner 判断**。
- 切り方・サイズの整理: 輪切り（スライス）を基本。レシピ別の切り方（細切り・角切り）は本作業の範囲外（`peking-duck-pizza` は北京ダックの薄切りと合わせた輪切り / `pizza-salad` はサラダ仕立ての輪切りが妥当。レシピ別の差は後続）。
- **選択アイコンは変更しない**（Q1 の扱いを除く）。

### 4.6 焼成前後の状態差（共通方針）

- 第 1 段階（PR-1）: ラッパーの既存 `filter`（cheese は `cheeseStyle`、他は `toppingPieceStyle`）のみに依存。**`PizzaStage.tsx` は変更しない**。
- 第 2 段階（別 Gate）: 部位ごとの色変化（縁だけ焦がす・黄身を保つ）には `--bake-heat` のような CSS 変数が必要。D5 により「設計の調査は承認、`PizzaStage.tsx` 変更は #738 の claim 確認と別 Gate が前提」。本書は設計の入口のみ（`toppingPieceStyle` に変数を 1 つ足す案。#738 が先に merge される想定を claim に明記する）。

### 4.7 既存レシピ・食材への影響

- **データ・ロジックは不変**: id・emoji・色・family・サイズ区分・`placement`・採点・保存・研究判定・解放条件は変更しない。変わるのはピザ上の描画のみ。
- 影響を受ける表示: parmigiano を含む 6 レシピ、cucumber を含む 2 レシピ（peking-duck-pizza / pizza-salad）の **ピザ上・RESULT のピザ**。それ以外の食材・レシピは registry 未登録のため不変。
- 選択系の表示（トレイ chip・ドラッグ・在庫・Dex）は不変（`surface="selection"`）。

### 4.8 Dex・golden の互換性

- **Dex / `PizzaThumbnail`**: D2 により変更しない。`surface="selection"` を渡すため DOM・見た目とも同一。
- **golden**: `src/logic/testSupport/rt01ReferenceBaseline.ts`（Reference の DOM 基準）と `src/data/__golden__/lateCatalog.offSurface.json` に影響しうるのは、**Reference 見本（#6）を placed に切り替える場合のみ**。切り替えなければ golden は不変。切り替える場合は golden 再基準化が必要になり、CLAUDE.md の「期待値を勝手に更新しない」に従い **別 Gate（Q3）**。
- 既存テストで「変わらないこと」を証明: `IngredientGlyph.test.tsx`（eggplant の 🍆 期待）・`ingredients.test.ts`・`fryIngredients` 系（`canFryIngredient("eggplant") === false`）を**無修正で通す**。

### 4.9 将来の玉子・ナス対応（バックログの設計メモ。実装なし）

**共通機構**（PR-1 の `surface` 継ぎ目と registry）をそのまま再利用する。

| 食材 | 方針（Owner D3 / D4 / D6） | 前提・注意 |
|---|---|---|
| egg | 1 ピース = **目玉焼き 1 個**（白身と黄身が一体。チーズ状の断片に見えない）。割る操作は #825。焼成: 白身は半透明 → 不透明な白＋縁に薄い焼き色、黄身は色を保つ | 部位ごとの色変化は `--bake-heat`（D5・別 Gate）。第 1 段階は filter のみで差が小さい |
| eggplant | **輪切り**。**#782 の `EggplantGlyph` を再利用**し第二の描画系を作らない | #782 は open・mergeable clean・PROVISIONAL・未配線・Owner 未承認。使用する場合 `Depends-on: #782` か Owner が merge を判断。#782 の state は `--eg-*` CSS 変数で raw / baked / fried を持つ。**`eggplant` に `pieceVisual` を付けない**（D6: `canFryIngredient` が `pieceVisual` の有無で決まるため #749 Fry が休眠から有効になる）。placed は registry（id 引き）で持つので `ingredients.ts` と Fry に触れない |

- 注意: eggplant の placed 表現を入れると、eggplant を使う 12 レシピのピザ上の見た目が一斉に変わる（本番に見える変更・HV 対象）。Fry（#749）の `friedLook` と placed の状態（baked / fried）の関係は #749 側の決定事項で、placed は「加熱済みナス片」の中立な見た目を第一案とする（混ぜない）。
- #749 Fry との境界: `src/logic/fry/**`・`fryIngredients*`・`fryExperienceGate`・`fryPreview*` を編集・import しない（F1 claim 範囲）。placedVisuals の識別子・コメントに "fry" を含めない（`fry.architecture.test.ts` の言及検査に触れないため）。

## 5. ファイル影響・claim マトリクス

### 5.1 PR-0（本 PR）

| 区分 | パス |
|---|---|
| 新規（docs） | `docs/reports/TETO_TOPPING-VISUALS-2_PR0_Baseline-and-Design.md`（本書） |
| 新規（画像） | `docs/reports/screenshots/topping-visuals-2/pr0-before/**`（PNG 26 枚 + `INDEX.md`） |
| 変更なし | `src/**`、`e2e/**`、`App.css`、`ingredients.ts`、`PizzaStage.tsx`、`PROJECT_HANDOFF.md`、CI、golden |

### 5.2 PR-1（parmigiano、未承認。予定ファイル）

| ファイル | 区分 | 種別 | 競合・claim |
|---|---|---|---|
| `src/components/placedVisuals/**`（SVG・registry・テスト） | 新規 | 追加のみ | なし（無 claim） |
| `src/components/IngredientPieceVisual.tsx`（+`.test.tsx`） | 既存 | 小変更 | 無 claim。**ただし**参照するテストが多い |
| `IngredientTray.tsx`（×2 箇所: 529・705）、`InventoryOverlay.tsx`、`PizzaThumbnail.tsx` | 既存 | 各 1 行 `surface="selection"` | 無 claim |
| `e2e/topping-visuals-*.spec.ts` | 新規 | 追加のみ | なし |
| `docs/reports/TETO_TOPPING-VISUALS-2_*`、`docs/reports/screenshots/topping-visuals-2/**` | 新規 | docs | なし |
| **触れない** | — | — | `ingredients.ts`・`recipes.ts`・`fryIngredients.ts`・`IngredientGlyph.tsx`・`App.css`・`PizzaStage.tsx`・`toppingSizeClass.ts`・`bakeVisual.ts`・採点・保存・研究判定・ladder |

cucumber（PR-2 相当）は同じ registry に追加（ただし Q1 / Q4 次第で `ingredients.ts` が絡む）。egg / eggplant は PR-3 以降（`PizzaStage.tsx`・#782 が絡む）。

### 5.3 claim・競合の確認（2026-11-17 時点、#824 / #825 / #417 / #749 の全コメントと open PR を確認）

**有効な claim（期限切れ・release 済みでないもの）と本 PR-0 の重なり: なし。** 既存 claim は変更・解除していない。

| claim | 範囲 | 期限 | PR-0 との重なり |
|---|---|---|---|
| #749 F1（`session_013m8Cb49gBq9AcNooPFsNsB`、6633217463） | `src/logic/fry/**`、`fryIngredients*`、`fryExperienceGate.ts`、`fryPreview*`、docs | 11-18 | なし |
| #749 FRY Lab（6691360461） | `src/components/fryLab/**`、`src/preview/fryLab*`、`src/main.tsx`、`e2e/fry-lab*`、docs | 11-20 | なし |
| #417 eggplant 未配線（6691362081） | `src/components/eggplantGlyph/**`、`TETO_ICONS-EGGPLANT-UNWIRED_*`、`screenshots/eggplant-unwired/**` | 11-20 | なし（**PR-3 で再利用時に要確認**） |
| #417 stagedGlyphs（6724929630）／T7 docs（6703658614） | `src/components/stagedGlyphs/**`／`TETO_ICON-AUDIT_T7_*` | 11-20 | なし |
| #417 squid（6774027138 / 6775059708） | `docs/design/candidates/.../squid-*.svg`、`TETO_SQUID-SVG-CANDIDATES_818_*` | 11-18 | なし |
| release 済み | #749 の #839 専用、#417 の herbGlyphs 配線系・walnut・dessert・#778 | — | — |

- `src/components/placedVisuals/**`・`IngredientPieceVisual.tsx`・`IngredientTray.tsx` を含む有効 claim は無い。
- 未実施（今回再スキャンしていないもの）: **#726（steam S3 = #738）・#780・#866・#867・#870・#848・#825 以外の Issue の claim、および PR 本文内の claim、`scripts/ops/owner-gate.mjs`（read-only token が必要）**。#738 が `PizzaStage.tsx` 等を変更中であることは PR のファイル一覧で確認済み。PR-1 着手前に再スキャンが必要。

## 6. C. テスト・HV 計画（PR-1 以降に適用）

### 6.1 自動テスト

| 目的 | テスト |
|---|---|
| 選択アイコンが変わらない | `IngredientGlyph.test.tsx`・`ingredients.test.ts`・`IngredientTray` 系を**無修正で通す**。`IngredientPieceVisual.test.tsx` に `surface="selection"` の出力が現行と同一（DOM 文字列比較）であるケースを追加。parmigiano / cucumber の chip の DOM が before と同一であること |
| ピザ上だけ変わる | `surface="placed"`（既定）で registry 登録食材は SVG、未登録は現状どおり。ラッパーのクラス（`pizza-cheese--parmigiano` / `ingredient-piece-visual__emoji`）が保たれること |
| SVG の健全性 | 各 SVG: `id` / `url(#` なし、`aria-hidden`、viewBox 64×64、非ゼロ bounds。"fry" を識別子・コメントに含まない |
| 判定・採点・保存に影響しない | `recipes.ts`・採点・reducer・persistence・研究判定のファイルに diff が無いこと（`git diff --stat` を PR に記載）。既存の全 Vitest が無修正で通る |
| size class 不変 | `toppingSizeClass` 系テストが無修正で通る |
| Fry・Steam 等の既存工程が不変 | `canFryIngredient("eggplant") === false` を含む fry / steam / sear / prep の既存テストが無修正で通る。architecture テスト（`fry.architecture`・`steam.architecture`）が通る |
| 呼び出し箇所の固定 | `IngredientPieceVisual` の呼び出し箇所を列挙する architecture テスト（`surface` を渡すべき選択系が漏れていないか） |
| 型・lint・build | `tsc -b`、`oxlint`、`npm run build`、全 Vitest |
| E2E（Chromium + WebKit、390×844 / 360×800） | 新規 `topping-visuals-*.spec.ts`: placed の `.pizza-topping--<id>` 内に SVG が出る、chip は不変、焼成後も SVG が残る。既存 `finished-pizza-visual-2.0.spec.ts` を無修正で通す。WebKit は #394 / #680 / #828 の間欠失敗があるためトレイのページ送りの check-then-act を避ける |

### 6.2 Human Verification（HV Policy 準拠。動画は repo に commit しない・Owner へ直接提出）

**配信**: PR 専用 Preview（#864 の `pr-<PR番号>-<sha7>` 方式）。**共有 Preview の更新・Production ON はしない**。実機 iPhone Safari は Owner の HV。AI 側の Chromium / WebKit は代用にしない。**Authority 390×844、Secondary 360×800**。MP4 / H.264、各状態 1〜3 秒保持。before/after の静止画は `docs/reports/screenshots/topping-visuals-2/`（before は本 PR-0 の画像）。

**シナリオ（食材ごと）**: 該当レシピ到達 → トレイで選択（**chip が before と同一**）→ 配置直後 → BAKE（未達・ジャスト・焼きすぎ）→ CUT → RESULT → Reference → Dex（サムネが before と同一）。

| 観点 | parmigiano（Pilot 1）の合格基準 | cucumber（Pilot 2）の合格基準 |
|---|---|---|
| ピザ上の見た目 | 板ではなく削り片・粉状の山に見える | キウイに見えず、きゅうりの輪切りと読める |
| 識別 | mozzarella・ricotta-salata・truffle と区別できる | 隣の食材（コーン・レタス・北京ダック・青ねぎ）と混同しない |
| 390×844 / 360×800 | 両方で視認できる（実寸 約 20〜30px） | 同左 |
| 焼成前後 | 縁が金褐色になる等、自然な違い。焼きすぎで破綻しない | 焼成で緑が茶・オリーブに転ばない（または許容範囲）。生と焼成後が同じ食材に見える |
| 数値（Owner が目視 + 数値） | 生↔ジャスト↔焼きすぎの平均色差（CIE76 ΔE）、24 / 32 / 48px とグレースケールでの識別 | 同左 |
| 選択アイコン | chip・ドラッグ・在庫・Dex が before と**同一**（cucumber は Q1 の判断に従う） | 同左 |
| 判定・採点・保存 | レシピ判定・採点・保存・研究が before と同一結果 | 同左 |

### 6.3 ロールバック

- **PR-0（本 PR）**: docs と画像のみ。`git revert` で完全に戻る。ランタイムへの影響なし。
- **PR-1 以降**: 新規ディレクトリ `placedVisuals/**` と `IngredientPieceVisual` の `surface` 追加（+選択系 4 箇所の 1 行）のみ。registry の登録を空にするか PR を revert すれば**現状と同一の描画に戻る**（データ・保存は変更していないので移行不要）。Production は PR 専用 Preview で HV 前に ON にしない。

## 7. D. バックログ整理（玉子・ナス）

| 食材 | 状態 | 次の判断 |
|---|---|---|
| 玉子 (egg) | バックログ（Pilot より後）。実画像で 🥚 が 3 個置かれる状態を確認（本書 §2.2）。D3 の概念は承認済み、実装は未承認 | `--bake-heat` の設計調査（D5）、`PizzaStage.tsx` の別 Gate（#738 の claim 確認が前提） |
| ナス (eggplant) | バックログ。🍆 の丸ごと配置を実画像で確認。D4: 輪切り、#782 を再利用。**D6: `pieceVisual` を付けない・#749 Fry を起動しない** | #782 の現在の状態（open・clean・PROVISIONAL）と統合権限の確認。#738 の merge 順、Fry の `friedLook`（`--fry-bright/sat/sepia`）が Style Lock §12.1 と食い違う件（#749 側の決定）を待つ |

玉子・ナスの実装を Pilot 1・2 より優先しない。

## 8. 先行監査との差分（訂正・追補）

- 呼び出し箇所の漏れ 2 件（§4.3）。
- eggplant の参照レシピは 12 件（`recipes.ts` 10 + `lateCatalog.ts` 2）。parmigiano は 6 件（4 + 2）、cucumber は 2 件。
- **cucumber の絵文字が 🥝**（先行監査では未確認・Pilot 2 は依頼外だった）。
- 実寸（§2.4）: parmigiano 21×9px、cucumber 29.7px（RESULT 22.3px）。

## 9. Owner 判断が必要な点（PR-1 実装の前提）

| ID | 論点 | 推奨 |
|---|---|---|
| Q1 | cucumber の**選択アイコン**（chip・Dex・RESULT チップ）も 🥝（キウイ）のまま。ピザ上だけ直しても選択側は不整合のまま残る。選択アイコンは変更しない方針（D1）との関係 | 例外として #417 側で `emoji` を 🥒（U+1F952）へ 1 文字修正する別 PR（`ingredients.ts` は hot・claim 確認・golden 影響を確認）。Pilot 2 の placed とは別 PR。または「選択は 🥝 のまま」で進める場合はその旨を記録 |
| Q2 | `surface` の既定値（案 X: 既定 placed / 案 Y: 既定 selection）とドラッグプレビュー（#705）の扱い | 案 X。ドラッグプレビューは selection |
| Q3 | Reference 見本（`renderPizzaVisualPieces` 経由）のピースも placed に揃えるか。揃えると golden・`PlayerReferencePreview.test.tsx` が動く | PR-1 では揃えない（selection）。揃える場合は別 Gate で golden 再基準化 |
| Q4 | cucumber の焼成での色転び対策: (a) `bakeRoastResistant` を付ける（`ingredients.ts`）／(b) 色を見込む／(c) 許容 | (b) を第一案に PR-1 で ΔE を測定し、足りなければ (a) を別判断 |
| Q5 | parmigiano の第 1 段階を「filter のみ」（`--bake-heat` なし）で進めるか | 進める。部位ごとの色変化は D5 の別 Gate |
| Q6 | PR-1 の claim の投稿（`placedVisuals/**` ほか、§5.2）。Session Operations §1 の claim は Owner / Member / Collaborator アカウントのコメントのみ有効 | PR-1 着手の承認後に投稿（PR-0 の claim は §5.3 の末尾の通り投稿済みのものを参照） |

## 10. 未実施・限界（正直な記録）

- 実機 iPhone Safari・WebKit の画像・動画は未取得。HV 動画は PR-0 の対象外（docs-only、HV Policy §2 の適用除外）。
- Dex / 図鑑 / Reference 見本 / CUT / 焼成中・焼きすぎ・実レシピ上の画像は未取得（§2.3）。
- parmigiano の RESULT 寸法は未計測（§2.4）。
- 食材の自然な見た目（削り片・きゅうり輪切り）の根拠は一般知識に基づく設計案で、**参照写真・Web 調査は未実施**。PR-1 で Owner が参照画像を承認する。
- 色・形の数値は**案**であり、実装・測定前の値。SVG は未作成。
- テスト・CI の結果は PR 本文に記載（docs-only のため一部ジョブはスキップされる）。
- #726 / #780 / #866 / #867 / #870 / #848 の claim と、PR 本文内の claim、Owner Gate スクリプトは再スキャンしていない（§5.3）。

## 11. 次の作業（PR-1 の見積り）

プロンプト往復回数の目安（Owner 判断が揃った場合）: **約 6〜8 往復**。内訳: Owner 判断（Q1〜Q6）と claim 承認 1、registry / `surface` / parmigiano SVG の実装 2、focused テスト・E2E 2、PR 専用 Preview・before/after・動画の準備 1〜2、Owner の実機 HV と指摘対応 1〜2。cucumber（PR-2 相当）は同じ継ぎ目を再利用するので約 4〜5 往復。
