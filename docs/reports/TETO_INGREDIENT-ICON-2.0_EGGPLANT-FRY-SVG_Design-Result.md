# Ingredient Icons 2.0 / Fry — eggplant（ナス）食材 SVG デザイン案 Result Report

Status: **A 案（輪切り）を正式採用（Owner 2026-11-05）。Style Lock V2 §12 に採用を記録済み（G1 完了）。Fry 専用 Pilot として扱う。** docs / assets のみ。runtime・`ingredients.ts`・`IngredientGlyph.tsx`・`PizzaStage.tsx`・CSS は一切変更していない。Fry F2〜F4 は実装していない。Production ON・共有 Preview 更新・merge はしていない。Owner の PASS はここでは推定しない。
Base: `main` `c69cb2b`（Fry F1 #750 merge 後）。Refs #417 / #749 / #751、Style Lock V2。

## 1. 事前確認（Duplicate / claim）

| 確認 | 結果 |
|---|---|
| Issue #749 | F0/F1 のみ承認、**F2 以降 HOLD**。eggplant は `pieceVisual` なしのため `canFryIngredient("eggplant") === false`（休眠）。絵の追加は別 Owner 判断 |
| #748（Batch 18）claim | `ingredients.ts` ほかを **2026-11-18 まで** claim。本作業は触れない（新規ファイルのみ） |
| #738（Steam S3、open） | `PizzaStage.tsx` を変更中。触れない |
| PR #751（Draft、Fry-only addendum） | 「eggplant の docs/assets のみの比較は先行してよい」と明記。既存の Tray/Raw/Baked 監査（`claude/ingredient-icons-svg-ojwgap`）は**再作成・上書きしない** |
| 重複 PR | open PR に eggplant の絵・比較を扱うものなし |
| 追加ファイルの重なり | 新規ディレクトリ 2 つと本書のみ。既存のどの docs も編集していない（既存 Ingredient Icons 設計書・参照 SVG の README は無変更） |

## 2. 設計方針（既存の方式を優先）

- **同一 SVG + CSS 変数**（既存監査の Owner 判断①）。第 2 の描画系・別 SVG の二重管理は作らない。`pizzaVisual` は追加しない（判断③）。
- Style Lock V2 §2: 64×64・透明背景・線幅 2.4・接地影・2 トーン・`id` / gradient / `<defs>` / `url(#` / 文字なし（**全 SVG を機械走査して 0 件**）。
- 4 状態:

| 状態 | 見た目 | 実現方法 |
|---|---|---|
| ① Tray | 生と同じ絵（既存方針: Tray = pieceVisual） | 変数なし（既定色） |
| ② Raw | 同上（ピザ上・焼成前） | 同上 |
| ③ Baked | 身が淡黄 → 琥珀 → 茶、皮が深くなり、わずかに縮む | 変数 + 既存 `bakeHeat`（0〜2） |
| ④ Fried | 身が黄金色、縁にこんがり輪、油のつや。放置で濃茶（over） | 変数 + 既存 F1 の amount |

- 部位は 7 つの `data-part`（skin / shine / flesh / crust / core / seed / sheen）。SVG 側の変更は属性付与のみ、色は `fill="…"` の既定値を持つので**変数なしでも単体で正しく描画**される。
- 検証: **CSS 変数方式の描画と、変数を解決した単体 SVG の描画は 3 案 × 6 状態 = 18 通りすべてでピクセル完全一致**（不一致 0）。

## 3. 3 案（形・色・揚げ色）

| 案 | 形 | 生の色 | 揚げ色 | 主な狙い |
|---|---|---|---|---|
| **A** | 輪切り 2 枚（丸） | 標準紫（カタログ色 `#62407b`）+ クリーム色の身 | 黄金〜橙 + こんがりの縁 + つや | ナスの断面として最も素直。皮の輪 + 身の中心 + 種 |
| B | 斜め切り 2 枚（楕円） | 藍紫 + **緑がかった**身 | 琥珀の素揚げ（皮は鮮やかな青紫のまま） | 素揚げの質感 |
| C | 乱切りの筒（紫の側面 + 断面） | 赤紫 + クリーム | こんがり茶 | 紫の面積が大きく、小サイズで紫に見える |

初回の C（縦半割り＋ヘタ）は皮が暗く細く洋梨に見えたため作り直した（上記の乱切りが現行 C）。

## 4. 比較画像と測定（Chromium、DPR 2〜3。iPhone 実機・WebKit は未実施）

画像: `docs/reports/screenshots/eggplant-fry-svg/`

| 画像 | 内容 |
|---|---|
| `01-candidates-overview.png` | 3 案 × 6 状態（96px） |
| `02-size-24-32-48.png` | 24 / 32 / 48px × 6 状態 ×（トレイ背景 / その状態の生地の上） |
| `03-on-pizza-actual.png` | **実ピザ上**: ステージ 290px、描画箱 28px × サイズ区分 m（×1.0）。なす 7 個 + ペパロニ 4 枚 + チーズ。焼成前 / 揚げ / 焼き適正 / 揚げ→焼き / 焦げ / 揚げ過ぎ |
| `04-tray-chip-and-neighbours.png` | トレイ chip（118×64、icon 枠 26px）、近い食材 11 種との並置（カラー + グレースケール） |
| `05-recommended-spec.png` | 推奨 A の 4 状態ボード、F1 変数だけで足りるかの検証、3×3 色表 |

測定値（64px 描画の平均色 CIE76 ΔE。`docs/design/candidates/ingredient-icons-2.0-eggplant-fry/metrics.json`）:

| 指標 | A | B | C |
|---|---:|---:|---:|
| 状態差 Raw ↔ Baked 適正 | 12.6 | 8.2 | 9.1 |
| 状態差 Baked 適正 ↔ Fried crisp | **14.2** | 14.7 | 10.0 |
| 状態差 Raw ↔ Fried crisp | 25.2 | 19.8 | 16.3 |
| 状態差 Fried crisp ↔ over | 32.5 | 28.3 | 20.4 |
| 生地との差（Raw / Baked 適正 / 焦げ） | 35.5 / 38.2 / **23.9** | 37.5 / 42.5 / 29.4 | 56.9 / 60.0 / 36.6 |
| 最近傍の食材（形の距離 / ΔE / 輝度差 ΔL）salami | 0.35 / 28 / 18 | 0.34 / 30 / 16 | 0.32 / **19 / 1** |
| 64 枠に対する占有（x 範囲） | 4.5–60.5 | 6.5–58.5 | 7.5–55 |

読み取り:
- **C は salami と色・明度がほぼ同じ**（グレースケールでΔL 1）で、Style Lock §1c が既に警戒する「salami の識別」を悪化させる。除外。
- **B は身が緑がかっており、ズッキーニ / きゅうり系に読める**恐れ（ラタトゥイユ系にズッキーニが既にある）。状態差は良いが、材料の識別が最優先のため次点。
- **A は最も 64 枠を使い、状態差も十分**で、他食材との識別（形・色・輝度）にも問題がない。
- 弱点（記録）: A の **焦げ Baked は生地との差が 23.9 と低め**（濃い生地の上で暗い皮の輪郭は残るが、身は埋もれる）。焦げは本来「失敗」側の見た目で許容するが、HV で確認する。

## 5. 推奨案: **A（輪切り）** と合格条件

選定理由: ①ナスの断面として最も素直に読める、②紫の皮の輪 + クリームの身がペパロニ（赤い丸）・salami・ピーマン・ピクルス・梅肉とどれも色で分かれる（ΔE 28 以上、うちペパロニ 54・ピーマン 52）、③4 状態の差が測定上も画像上も見える（特に Fried と Baked の分離 ΔE 14.2）、④余白が少なく補正倍率がほぼ不要（下記）。

**F1 だけでは足りない（重要）:** 現行 F1 の `friedPieceStyle` は `filter` 用の 4 変数（`--fry-bright/sat/sepia/sheen`）のみ。生のナスにその filter だけを掛けると**灰色がかった淡黄 / 灰色になり、「揚げた」に見えない**（`05` の左）。filter と部位色を両方当てると**二重に暗くなる**（`05` の右）。→ **部位色を主とし、F1 の `--fry-sheen` を sheen の不透明度に使い、`--fry-bright/sat/sepia` はナスでは使わない（または中立にする）**のが合格。F1 の関数は変更しない。この「ナスだけ filter を弱める」規則は既存監査 §5 の「個別ルック対象は基準 filter を弱める」と同じ。

### 実装可能な仕様（Owner 承認後・別 Gate。ここでは実装しない）

1. 描画: `pieceVisual` 案名 `eggplant-slices`（id と独立）、SVG は `svg/eggplant-a.svg` の子要素をそのまま JSX 化（既存 Pilot E と同じ手順）。**変更が要るファイルは `ingredients.ts`（+1 行）・`IngredientGlyph.tsx`・`App.css`/専用 CSS・テスト — #748 の claim 解除後（2026-11-18 失効または解除）に着手。**
2. 色の決め方（純関数・CSS 変数のみ返す）: 部位 flesh / skin / rim ごとに **3×3 キーフレーム**（行 = bake heat 0/1/2、列 = 揚げ位置 p = 未 / crisp / over）を 2 方向に線形補間。表は `05-recommended-spec.png` と `eggplant-a-states.css`。
   - p: over なら 2、それ以外は `golden = min(1, amount / (3500/8500))`（F1 の `friedGolden` と同値）。
   - 派生: line = skin×0.38、core = flesh と rim の 28% 混色、seed = flesh と `#2a1c08` の 42%、crust 不透明度 = min(1,p)×(over 1 / 他 0.9)、sheen = `--fry-sheen`×(1−0.45×min(1,heat/2))、縮み（SVG 内側のみ）= 1−0.05×min(heat,1)−0.05×max(0,min(heat,2)−1)。
   - 連続補間のみ（境界で跳ばない）。新しい rAF・タイマー・保存状態を作らない。
3. 合成点: 既存の `IngredientPieceVisual` の style 合成点（sear / prep と同じ位置）。ラッパー寸法・`--piece-rank-scale`・`data-topping-id`・CUT のクリップは不変。後乗せ（`PostBakePiece`）には付けない。
4. サイズ補正: 64 枠の占有が約 87%（ピーマン系は約 62% で 1.45em が必要だった）。**起点は補正なし（1em）〜1.05em**。size class は既存の `m`。トレイ chip は 26px 枠内に収まる（補正なしのため chip 専用規則は不要の見込み）。実機で確認。
5. 接地影: 他の Pilot と同様、ピザ上では楕円を CSS で隠す前例（Pilot E）がある。要否は HV で判断。
6. 不変条件: 食材 id・`emoji`（🍆、テキストのフォールバック）・`color`・保存（schema v2）・採点・在庫・Dex・Research・Hint・解禁順。Production OFF（`FRY_EXPERIENCE_PRODUCTION = false`）を維持。
7. F3 での追加依頼（任意）: `friedPieceStyle` に `--fry-golden` を 1 変数足せば CSS 側で p を直接使える（現状は amount から再計算する）。F1 を触る別 Gate の判断。

### 合格条件（HV / 実装 PR 用）

- [ ] 24px で「紫の輪 + 淡い身」が潰れず、ペパロニ・salami・ピーマン・ピクルスと取り違えない（本書の静止画では PASS、**実機は Owner**）
- [ ] 390×844 / 360×800 の実ピザ上で、Raw / Baked / Fried / Fried→Baked / Fried over が同一構図で区別できる（本書の `03` は 390 幅想定の合成、**実画面は未実施**）
- [ ] Fried crisp と Baked 適正の ΔE ≥ 12（本案 14.2 ✔）、Raw と Fried crisp の ΔE ≥ 20（25.2 ✔）
- [ ] 近い食材との ΔE ≥ 20 または形の距離 ≥ 0.30（A は最小でも salami の 28 / 0.35 ✔）
- [ ] 焦げ Baked の見え方（生地との差 23.9）が許容できる（Owner 判断）
- [ ] Tray / Shop / Dex / Research / Hint / Notebook / RESULT 一覧は焼成・揚げの変化を反映しない（常に生）
- [ ] 揚げ未実施の食材・他の食材の DOM と style がバイト同一（実装 PR のテスト）
- [ ] 二重に暗くならない（ナスでは F1 の bright/sat/sepia を使わない、のテスト）

## 6. 成果物

| パス | 内容 |
|---|---|
| `docs/design/candidates/ingredient-icons-2.0-eggplant-fry/svg/eggplant-{a,b,c}.svg` | 3 案の生の状態（単体で描画可能） |
| `.../svg/states/eggplant-a-{raw,baked-good,baked-burnt,fried-crisp,fried-over,fried-baked}.svg` | 推奨 A の 6 状態（変数を解決した単体 SVG） |
| `.../eggplant-a-states.css` | データ部位の CSS と 6 状態の変数（デザイン参照用、アプリは読まない） |
| `.../metrics.json` | 測定値 |
| `docs/reports/screenshots/eggplant-fry-svg/01〜05-*.png` | 比較画像 |

候補 SVG は**採用された参照 SVG ではない**（`docs/design/references/ingredient-icons-2.0/` には入れていない。Style Lock への追記は Owner の採用後の別 docs PR）。

## 7. 検証と限界（正直な記録）

- 画像・測定は Chromium（DPR 2〜3）の静止画。**WebKit・iPhone Safari 実機は未実施。** 実ピザの画面（ステージ背景・ソース・チーズの実描画）は近似の合成で、本物の画面ではない。
- F1 の `friedPieceStyle` / `fryResultOf`、`bakeVisual` の `toppingVisualFrame` / `doughVisualColors` は、数式を**ポートして**使った（リポジトリに `node_modules` が無いため、F1 自体は実行していない）。式は読んで 1:1 で移した。
- 色（`#…` 値）は **PROVISIONAL**。Owner の実機 HV 前の提案。
- Human Verification: docs / assets のみで見た目の実装変更が無いため、`TETO_HUMAN-VERIFICATION-POLICY` §2 の「docs-only は不要」に該当し**動画は作成していない**。比較画像（静止画）をリポジトリに残した。実装時には 390×844 の動画 + before/after が必須。
- 自動テストは実行していない（コード無変更）。

## 8. 固定済みの方針（Owner 指示 2026-11-05）と、残る実装 Gate

固定: ①A 案を採用候補とする ②**Fry 専用 Pilot**（既存の bake Pilot shrimp → bacon → pepperoni には入れない。#751 の持ち越し項目は「Fry 専用」で解決）③同一 SVG + CSS 変数を維持 ④揚げ色は部位色を優先し、ナスでは F1 の `--fry-bright/sat/sepia` を使わない（二重 filter 防止）⑤`--fry-golden` は F3 で**必要になった場合のみ**追加（F1 を触る別判断。現状は amount から再計算できるので必須ではない）⑥Phase 1 では Dex に技法を追加しない。

残る Gate（いずれも本書の範囲外・未着手）:

| Gate | 内容 | 待ち |
|---|---|---|
| G1（**完了**: Style Lock V2 §12、`references/.../eggplant.svg`） | Style Lock V2 への追記（A を参照 SVG として昇格、`eggplant-slices` 命名）と Owner 採用の記録 | Owner の採用。docs-only の別 PR（SL-8）。既存 Style Lock・既存 Ingredient Icons 設計書は本作業で編集していない |
| G2 | `ingredients.ts` に `pieceVisual` +1 行、`IngredientGlyph.tsx`、CSS、テスト（`W1_DEDICATED` 等） | #748 の claim 解除/失効（2026-11-18）と最新 main での重なり再確認。#738 の merge 後（`PizzaStage.tsx` の合成点） |
| G3 | F2（reducer）/ F3（UI・Preview/DEV 入口）/ F4（E2E・iPhone HV） | #749 で HOLD。Owner 承認 |
| G4 | 実機 HV（390×844 動画 + before/after、24px 識別、焦げの見え方） | Owner。PASS は Owner のみ |

## 9. 他の設計書との整合確認（2026-11-05、main `c69cb2b`、変更なし）

| 文書 | 整合 | 注意点 |
|---|---|---|
| Style Lock V2 §2 / §3 / §10.4 | 一致（64×64・規約・個別補正方式・後乗せ層は見た目を持たない）。§6 のテスト規約（dedicated 集合に追加）は G2 で守る | A は Lock の 26 種の外の追加対象（§10.2 / §11 と同じ扱い）。採用の記録は G1 |
| Bake Audit（`claude/ingredient-icons-svg-ojwgap`、ea0ca07） | 方式①〜⑤と一致（同一 SVG + CSS 変数、`pizzaVisual` 無し、サムネイルは生）。eggplant を bake Pilot に入れない扱いも矛盾しない | **名前の差:** 同監査は `data-bake` 属性 / `--bake-*` / `PieceBake.css` / 食材 id でなく visual 単位のレジストリ、本書は `data-part` / `--eg-*`。G2 で **一つに統一する**（本書は決めない。揚げ軸の追加は同監査の `[raw, good, burnt]` に「揚げ位置」の列を足す拡張として吸収可能）。同監査の 6b（合成テスト）は本書の「二重に暗くならない」と同じ目的 |
| PR #751（Fry addendum） | 「揚げは焼成と排他でなく `base + fried + 焼成熱`」と一致（Fried→Baked を測定済み）。F1 の関数を変更しない点も一致 | **未実施の項目（#751 §3 の概念シート要件のうち）:** 丸ごとのナス（Tray の「全体像」）、既存絵文字🍆との前後比較、20px・28px、焼成途中（mid-bake）、焼成前後の生地を 360×800 で。本書は Tray = Raw（輪切り）とし、輪切りが🍆より識別しにくくならないかは**未検証**（実機 HV で確認） |
| Issue #749 / F1 Result / Design Audit | 一致（F0/F1 のみ、`canFryIngredient` は絵が付くまで休眠、見た目の名前は 生っぽい / カリッと / 揚げすぎ = raw / crisp / over、Dex 技法なし、失敗状態なし） | `friedLook.ts` は「transform は配置が持つ」。本書の縮みは SVG の**内側** `<g>` だけで行うこと（ラッパーに掛けない） |
| Issue #417（Phase 7 Future Asset Rule） | 新材料の手順（family 確認 → 近縁との識別 → 64×64 → 32–48px → fallback）を本書の `04` と測定で実施済み | 🍆 は text fallback として残す（G18 に影響なし、`emoji` 不変） |
| #748 claim（〜2026-11-18） / #738 / #752 | 本作業のファイルと重なりなし（新規ファイルのみ）。#752 は e2e のみ | G2 は #748 失効後 |

---
_Generated by [Claude Code](https://claude.ai/code)_
