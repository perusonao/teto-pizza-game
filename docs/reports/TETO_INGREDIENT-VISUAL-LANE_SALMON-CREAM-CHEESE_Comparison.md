# salmon / cream-cheese 専用 SVG — 現行表示との比較（Pilot D 事前調査）

Status: **docs-only。`src` / CSS / SVG 資産 / テストの変更なし。専用 SVG は本番コードに組み込んでいない。共有 Preview 更新なし。PR #584 に触れていない。**
Base: `main` `d70bd20`（2026-10-22）。親: [`TETO_INGREDIENT-VISUAL-LANE_Fresh-Audit.md`](./TETO_INGREDIENT-VISUAL-LANE_Fresh-Audit.md)、authority: [`TETO_INGREDIENT-ICON-2.0_STYLE-LOCK-V2.md`](../decisions/TETO_INGREDIENT-ICON-2.0_STYLE-LOCK-V2.md) §10。
画像: `docs/reports/screenshots/ingredient-visual-salmon-cream-cheese/`（`01`〜`05`）。

## 0. 結論

1. **専用 SVG 案（既存の参照 SVG `salmon.svg` / `cream-cheese.svg`）は、小サイズでも焼成後でも、現行より「何の食材か」が読める。** 現行の salmon は 🍣（握り寿司、下半分がマグロ色）、cream-cheese は他のチーズと色しか違わない白い円。
2. **ただし 1em のままだと現行より小さく見える。** RESULT で salmon は約 21×14px、cream-cheese は約 21×17px。**shiso / whitebait と同じ 1.2em の個別補正を入れると、現行と同程度の存在感**になる。補正の採否は Owner。
3. **デザインの変更は不要と判断する。** Style Lock 済みのデザインに手を入れず、サイズ補正（CSS 1 規則）だけで足りる。
4. **最小 PR は 4 ファイル**（`IngredientGlyph.tsx` / `.test.tsx`、`ingredients.ts`、`App.css`）で、**4 つとも #584 と重なる**。#584 が HOLD の間は実装しない。

## 1. 方法と限界

- **比較は静的ページの描画。** 実際の `src/App.css` を読み込み、実クラス（`.pizza-dough` / `.pizza-topping` / `.ingredient-piece-visual__emoji` / `.pizza-cheese` / `.pizza-cheese--glyph` / `.ingredient-glyph`）と、`bakeVisual.ts` の焼成フレーム表（brightness / saturate / sepia、チーズの melt scale、生地の 3 点補間色）を**そのまま写して**適用した。ゲーム本体の実行画面ではない。
- 「現行」= main の描画（salmon = 🍣 + 標準焼成カーブ、cream-cheese = `.pizza-cheese--cream-cheese` の汎用 20px 円）。「専用 SVG 案」= 参照 SVG をインラインで `.ingredient-glyph`（64×64）として同じラッパーに入れたもの。`src` は変更していない。
- クラス倍率は本番の B（salmon・cream-cheese とも l = ×1.15）。RESULT は ×0.75（#514）。
- 配置は例示（#584 の参照座標ではない）。構成は #584 の「いくらとサーモンのピザ」に合わせた: cream-cheese 2 / salmon 3 / shiso 1 / salmon-roe 2。salmon-roe の SVG は #584 のブランチから**読み取りのみ**で参照した（比較のため。リポジトリには取り込んでいない）。
- 絵文字は Noto Color Emoji（この環境）。**iPhone の Apple Color Emoji では「現行」の見え方が異なる。** Chromium のみで、WebKit・iPhone 実機は未確認。
- 数値は SVG の描画範囲（`getBBox` + 線幅）から算出。コントラストは生地色（焼成フィルタ前）との WCAG 比で**概算**。

## 2. 小サイズ（画像 `01-small-sizes.png`）

20 / 24 / 28 / 32 / 48px を、明背景・赤背景・生地色・グレースケールで比較。

| 観点 | salmon | cream-cheese |
|---|---|---|
| 現行 | 🍣。20px でも寿司と読める。ただし「サーモンの切り身」ではなく、下半分が赤（マグロ色）。グレースケールでも濃淡は出る | 汎用の白い円。**他の汎用円チーズ（grana-padano、catupiry、cashew-cheese、goat-cheese）と色以外で区別できない**。赤背景・グレースケールでは白い円 1 つ |
| 専用 SVG | 20px でも「橙の楕円 + 白い縞」で切り身と読める。赤背景でも輪郭が残る。グレースケールでも縞が残る | 20px でも「青灰の銀紙の角丸ブロック」と読める。**feta（白い角切り）・ricotta（粒のある山）と形・色の両方で違う** |
| 近傍との識別 | **salmon-roe（丸い粒の山）と形で区別できる**（20px でも粒の山 vs 縞のある楕円）。色は同じ橙系で、グレースケールでは濃淡がほぼ同じ → **形だけが手がかり** | feta / ricotta / mozzarella と区別できる。グレースケールでも feta（輪郭の細い白い立方体）と形が違う |

## 3. ピザ上・焼成・CUT・RESULT（画像 `02`〜`05`）

寸法の算出（描画範囲 = glyph の箱 × 比率。箱 = 28px × クラス倍率 1.15 × RESULT 係数）:

| 場面 | 箱 | salmon の描画範囲（専用 SVG・1em） | cream-cheese の描画範囲（1em） | 現行 |
|---|---|---|---|---|
| トレイ（26px） | 26px | 約 23×15px | 約 22×19px | 🍣 は箱いっぱい、円は 20px 固定 |
| PREPARE / BAKE / CUT | 32.2px | 約 28×18px | 約 27×23px | 🍣 約 32px、円 約 23px（20×1.15） |
| RESULT（×0.75） | 24.2px | 約 21×14px | 約 21×17px | 🍣 約 24px、円 約 17px |
| 1.2em 補正を入れた場合 | +20% | RESULT で約 25×16px | RESULT で約 25×21px | — |

- **cream-cheese の専用 SVG は現行の円より大きい**（円は 17〜23px、SVG は 20〜27px）。補正なしでも見劣りしない。
- **salmon は 🍣 より一回り小さい**（高さ 14〜18px）。RESULT の 14px は薄い。1.2em で RESULT 約 16px になり、🍣 と同程度。
- 画像 `05-size-correction.png`: 補正なし / 1.2em / 現行を、PREPARE 相当（生地 290px）と RESULT（生地 196px・×0.75）で並べた。**1.2em の方が、隣の salmon-roe・shiso との大きさの釣り合いが取れる**（補正なしの salmon は roe より小さく見える）。

### 焼成（画像 `02`、`04`）

| 焼成 | 現行 | 専用 SVG |
|---|---|---|
| 焼成前 | 🍣・白い円・緑の葉・橙の粒 | 切り身・銀紙ブロック・緑の葉・橙の粒。**4 食材が形で読み分けられる** |
| ちょうど | 白い円は生地の橙に対して明るく目立つ | cream-cheese の塗りは生地に対して約 3.0:1。輪郭は約 1.8:1。**サーモンの塗りは約 1.3:1、輪郭は約 2.8:1**（橙 on 橙。salmon-roe と同じ傾向で、**輪郭と縞が識別の手がかり**） |
| 焼き過ぎ | 白い円は灰色の円に。🍣 はくすむが寿司と読める | cream-cheese は暗い灰色のブロック（塗り約 11.9:1 だが、元の青灰が見えにくくなる）。salmon は桃色の切り身がくすむが、白い縞は残り形は読める。**salmon の暗い輪郭は焦げた生地に対して約 1.4:1 で弱い**（塗りと縞が代わりに効く） |

- 焼成フィルタ（標準カーブ）は SVG の色にも同様に掛かる（`filter` はラッパー全体）。専用 SVG 用の焼成表現は要らない。
- cream-cheese はチーズ用の `cheeseVisualFrame`（melt scale 最大 1.16）がラッパーに掛かるため、焼成で約 16% 大きくなる。画像のちょうど焼きはこの拡大を含む。

### RESULT（画像 `04-result-196px.png`）

- RESULT の生地（196px）で、4 食材とも**判読できる**。salmon（補正なし）は最小で、salmon-roe・shiso とほぼ同じ大きさ。
- 現行は白い円が RESULT で最も目立つ（円 = 食材ではなく「白い何か」）。専用 SVG ではブロックの形が見え、ピザの具材として読める。

## 4. 参照 SVG のデザイン所見（変更はしない。Owner 判断が必要なものは明記）

| # | 所見 | 影響 | 対応 |
|---|---|---|---|
| D1 | `cream-cheese.svg` の最後の `<path>` は `stroke-width="0"`（描画されない残骸） | 見た目なし。実装時にそのまま JSX 化すると不要な要素が残る | **Style Lock 済みデザインの見た目は変えないため、実装時に無描画の要素だけ省くか、そのまま移植するかを Owner に確認**（既定: 見た目が同一なので省いてよいか Owner に諮る） |
| D2 | 2 つとも共通仕様（64×64、`id` / gradient / `<defs>` なし、接地影、線幅 2.4 前後）を満たす | 問題なし | — |
| D3 | salmon の塗り（桃橙）は焼けた生地（橙）に対して低コントラスト。salmon-roe（橙）も同様 | 識別を形と輪郭に頼る。salmon ↔ roe はグレースケールで濃淡が近い | **色は変えない**（Style Lock の「sausage の暗さは現状維持」と同じ扱い）。HV で形の識別を判定 |
| D4 | cream-cheese の青灰は焼き過ぎで暗い灰色に寄り、焦げた生地に埋もれやすい | 焼き過ぎ時の識別が弱まる | 輪郭（約 2.2:1）が残る。補正は不要と判断、HV で確認 |
| D5 | 参照 SVG の箱いっぱいに描かれず、描画範囲は箱の 56〜88% | 1em では絵文字・チーズ円より小さい | 1.2em の個別補正（本書の推奨）。shiso / whitebait / salmon-roe と同方式 |

## 5. 実装可能な最小 PR の範囲（#584 の扱いが決まった後）

**PR D: salmon + cream-cheese の専用 SVG（`salmon-fillet` / `cream-cheese-block`）**

| ファイル | 変更 | #584 と重なる |
|---|---|---|
| `src/data/ingredients.ts` | salmon・cream-cheese に `pieceVisual` を各 1 行 + 型 `DedicatedIngredientVisual` に 2 値 | **重なる**（#584 は食材 1 件を追加し型にも触れる） |
| `src/components/IngredientGlyph.tsx` | `VISUAL_VIEWBOX` に 2 行、visual コンポーネント 2 つ、分岐 2 行 | **重なる** |
| `src/components/IngredientGlyph.test.tsx` | 専用 visual 集合の期待値 + 描画テスト（Style Lock §6） | **重なる** |
| `src/App.css`（HOT） | 1.2em の個別クラス（採用する場合。shiso / whitebait のセレクタに追加）。#584 も同じセレクタに salmon-roe を足している | **重なる**（同一ルールの隣接変更） |
| `src/data/toppingSizeClass.ts` | **変更なし**（salmon = l、cream-cheese = l は既に表にある） | — |

- 変更しないもの: Save、scoring、economy、recipes、progression、Research authority、`.pizza-cheese*`（`pieceVisual` ありのラッパー内 SVG は §0-6 の方式）、Candidate C の既定値、mozzarella の Canvas / M1。
- 触れる食材の波及確認（コード調査）: 食材 ID を参照するテストは `cookingProfiles.test.ts` / `sauceB1.singleSource.golden.test.ts` / `materialShop.test.ts` 等にあるが、**描画ではなく ID のデータ参照**。🍣 の文字を直接検証するテストは `src/data/ingredients.ts` 自身のみ（他は docs の在庫 CSV）。ただし、実際の影響はテスト実行まで確定しない。
- 検証: focused unit（`IngredientGlyph.test.tsx` / `ingredients.test.ts`）+ typecheck / lint / build。UI 変更のため HV（390×844 動画 + before/after スクショ、360×800 も）。

### 受け入れ条件（追加。共通条件は Fresh Audit §7 を参照）

1. 20 / 24 / 28 / 48px で salmon ↔ salmon-roe、cream-cheese ↔ feta / ricotta / mozzarella が区別できる（赤背景・グレースケール含む）。
2. 焼成前・ちょうど・焼き過ぎ・RESULT のいずれでも 4 食材（#584 のピザの場合）が読み分けられる。
3. salmon の RESULT 上の描画高さが 16px 以上（補正を入れる場合）。入れない場合は Owner が許容を明示する。
4. 既存 SVG 9 種と未移行食材の表示が不変。cream-cheese の汎用円 CSS は他のチーズに影響しない。

### #584 との関係の整理

| 状況 | 取れる行動 |
|---|---|
| #584 が HOLD のまま | 本書と Style Lock の docs のみ。runtime の PR D は作らない |
| #584 が merge された | 最新 main から PR D を開始（上の 4 ファイルは #584 の変更を取り込んだ上で追記するだけ） |
| #584 が差し替え・close された | 同様に最新 main から。salmon-roe の扱いは別途 |
| Owner が PR D を #584 より先に出すと決めた | #584 側が後からコンフリクトを解消する（同一ファイルの隣接行の追記）。**この場合は #584 の作業ブランチの担当セッションと調整が必要**。本セッションはそのブランチに触れない |

## 6. Owner に確認したい点

1. **1.2em の個別補正を入れるか**（既定提案: 入れる）。
2. **D1（`cream-cheese.svg` の無描画パス）の扱い。**
3. #584 の扱い（PR D の着手時期）。
4. Pilot D の Issue を起票するか（Style Lock §10.3 に記載済み。実装 Issue は Owner が起票する運用）。

## 7. 画像一覧

| ファイル | 内容 |
|---|---|
| `01-small-sizes.png` | 20〜48px × 4 背景。現行 / 専用 SVG、近傍食材との識別 |
| `02-prepare-bake-290px.png` | 生地 290px（PREPARE / BAKE）、焼成前 / ちょうど / 焼き過ぎ × 現行 / 専用 SVG |
| `03-cut-358px.png` | CUT 相当（生地 358px）、ちょうど焼き |
| `04-result-196px.png` | RESULT（生地 196px・×0.75）、ちょうど / 焼き過ぎ |
| `05-size-correction.png` | 現行 / 補正なし / 1.2em 補正（290px と RESULT） |

> 画像は Chromium の静的ページの描画で、ゲーム実画面ではない。HV 動画は作っていない（docs-only の調査で、Policy の適用外）。
