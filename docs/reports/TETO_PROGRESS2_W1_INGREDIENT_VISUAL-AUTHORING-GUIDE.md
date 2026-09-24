# Progression 2.0 W1 — Ingredient Visual Authoring Guide

Status: **GUIDE（docs/data only）** — production ingredient 追加・`src/**` 変更・image asset 生成は一切行っていない。
PR #220 / #221 の内容・READY/REVIEW 判定は変更していない（本書は両PRを読むだけ）。

Machine-readable checklist: `docs/reports/data/TETO_PROGRESS2_W1_INGREDIENT_VISUAL_AUTHORING_CHECKLIST.json`

## 0. 結論（先に読む）

1. **PR #221 の `AUTHORING_REQUIRED`（ING-01〜ING-06）は、本書 §5 の Human Approval checklist が
   全項目 PASS になるまで解消しない。** 「見た目が良さそう」は PASS 根拠にならない。PASS には
   実機（iOS + Android）上の Preview 描画 screenshot と承認者記録が必要（§4）。
2. **W1 の新 ingredient 集合が #220 最新HEAD と #221 最新HEAD で食い違っている**（§1.2）。
   本書は両方の和集合 **11種** を対象にし、どちらが正かは決めない（owner reconciliation 項目）。
3. **Preflight（機械的に判明する事実）で、3種は human review 以前に現行候補のままでは PASS 不可**:
   - `salt-cod` 🐟 = production `anchovy` と**同一 emoji**
   - `green-onion` 🌱 = production `rosemary` と**同一 emoji**
   - `fresh-tomato` 🍅 = production `cherry-tomato` と**同一 emoji**（#220 側の新 ingredient）

   これらは emoji 候補の差し替え、非emoji表現（future renderer 変更）、または owner による明示
   waiver のいずれかが必要。本書は選択肢を示すが決定しない。
4. **`color` は現行 renderer では scatter topping の見た目に使われない**（§2.1）。topping の visual
   authoring 対象は実質 `emoji` 1文字であり、`color` は metadata。PR #220 `assetPolicy.reason` の
   「non-cheese ingredient は data の color と emoji で描画」は color については不正確。

## 1. 監査基準 / 入力

| 入力 | 状態 / SHA |
|---|---|
| `main` | `dff233c042d2df6ee1c3a92f2d2419830aa05460`（#220/#221 の base と同一） |
| PR #220 | OPEN, head `e49dab96bd9b26dc0f520349cf09d1160c3519f5`（`docs/reports/data/TETO_PROGRESS2_CONTENT_READINESS_WAVES.json`） |
| PR #221 | OPEN, head `279b6b17188ed3572b27c1ba91b2c4983723ddc0`（`docs/reports/data/TETO_PROGRESS2_W1_INGREDIENT_AUTHORING_MATRIX.json`, `..._UNRESOLVED_EVIDENCE_LEDGER.json`） |
| 現行 renderer | `src/components/IngredientPieceVisual.tsx`, `src/App.css`, `src/logic/bakeVisual.ts`（main） |
| 現行 ingredients | `src/data/ingredients.ts`（main, 22件） |

### 1.1 PR #221 の AUTHORING_REQUIRED（本書が解消基準を与える対象）

| ledger | ingredient | #221 detail |
|---|---|---|
| ING-01 | `baked-beans` | Confirm emoji legibility and color after bake. |
| ING-02 | `capers` | No exact emoji; approve or replace generic green-circle representation. |
| ING-03 | `eggplant` | Approve whole-eggplant glyph as the abstraction for slices. |
| ING-04 | `green-onion` | Approve sprout fallback or choose a distinct glyph. |
| ING-05 | `salt-cod` | Approve generic fish glyph; specificity is textual. |
| ING-06 | `sauerkraut` | Approve leafy-green abstraction and cheese-background contrast. |

### 1.2 【要 owner reconciliation】#220 最新HEAD と #221 の W1 集合の不一致

#221 は「#220 の unordered first-10 candidate set を再監査」と記すが、#220 最新HEAD `e49dab9` の
`first10CandidateSet` / `waves[W1]` とは recipe が5件異なる。

| | #220 HEAD `e49dab9` の W1 | #221 HEAD `279b6b1` の W1 |
|---|---|---|
| 共通 (5) | parmigiana-pizza, pizza-portuguesa, puttanesca-pizza, pesto-tonno, melanzane-pizza | 同左 |
| 片側のみ (5) | new-haven-apizza, hawaiian, bambino, pesto-caprese, pesto-patate | aussie, bacalhau, full-english-pizza, polish-kielbasa, tsukimi-pizza |
| 新 ingredient | capers, **clam, corn, eggplant, fresh-tomato, pineapple, potato**（7） | **baked-beans**, capers, eggplant, **green-onion, salt-cod, sauerkraut**（6） |

#220 HEAD では #221 側のみの5件はすべて `wave: W4`, `runtimeContractDependencies: ["SAUCELESS_RECIPE_CONTRACT"]`
（sauce none）。#220 の commit `d315211` / `e49dab9`（runtime-contract 依存の W4 移動）以前の
W1 を #221 が参照した可能性が高いが、本書はどちらも変更しない。

→ **本書は和集合 11 種すべてに authoring 基準を用意する。** 各行に `source`（`PR220_W1` /
`PR221_W1` / 両方）を記録する。どの集合を W1 とするかは owner 決定。

## 2. 現行 renderer の事実（visual authoring の前提）

### 2.1 描画経路

- `IngredientPieceVisual`: `category === "cheese"` → CSS physical piece（`.pizza-cheese--<id>`、`--cheese-color` 使用）。
  **それ以外はすべて `ingredient.emoji` のテキスト1文字**（`.ingredient-piece-visual__emoji`）。
- `ingredient.color` の使用箇所: cheese の `--cheese-color`、sauce の heatmap / Reference の sauce 色。
  **scatter topping の `color` は描画に使われない。** 11候補はすべて `topping/scatter` なので、
  見た目を決めるのは emoji と OS の emoji font だけ。
- 専用 bitmap は不要（#220/#221 と一致）。本書も image asset を作らない。

### 2.2 サイズ（CSS 実値、main）

| context | piece 実寸 | 備考 |
|---|---|---|
| PizzaStage 配置済み piece | emoji `font-size: 28px`（`--piece-scale` 1） | per-ingredient scale field は schema に**存在しない** |
| dough（通常） | `min(78vw, 300px)` → 390: **300px** / 360: **281px** | piece/直径 = 9.3% / 10.0% |
| dough（compact） | `min(76vw, 290px, 100dvh − 439px)` → 390×844: **290px** / 360×800: **274px** | 9.7% / 10.2% |
| dough（RESULT） | `min(58vw, 196px)` → 両viewport **196px** | piece が相対的に最も大きく見え overlap が増える |
| tray chip | emoji 26px + 名前 11px（chip min-height 64px） | タップ対象 |
| drag preview | emoji 30px（48×48 box） | |
| reference popover / player reference | 28 × 0.5 = **14px** | |
| reference thumbnail | 28 × 0.34 = **9.5px** | |
| mini reference thumb | 28 × 0.26 = **7.3px** | 最小。識別性の下限テスト |
| PizzaThumbnail（Pizza Select） | 28 × {0.4, 0.68, 0.34} × 1.7 = 19 / 32 / 16px | |

→ **推奨サイズ**: 11候補すべて現行 default（28px）を使う。W1 のために per-ingredient size field を
追加しない（`src/**` 変更・schema 変更になるため範囲外）。実物の大きさ差（ケッパーは小さい等）は
「抽象化として許容するか」を checklist で人が判定する。

### 2.3 焼成（`toppingVisualFrame`, `src/logic/bakeVisual.ts`）

| heat | 通常 topping（brightness / saturate / sepia） | `bakeRoastResistant: true`（herb） |
|---|---|---|
| 0〜0.8（raw / 焼成前） | 1 / 1 / 0 | 1 / 1 / 0 |
| 1.0（target 付近） | 0.97 / 1.04 / 0.08 | 1 / 1 / 0 |
| 1.6 | 0.90 / 0.92 / 0.14 | 0.96 / 1.02 / 0.03 |
| 2.0（最大 overbake） | **0.78 / 0.80 / 0.20** | 0.90 / 1.00 / 0.06 |

emoji の形は変わらず、filter の暗化・セピア化のみ。**暗い glyph（🍆 等）ほど overbake で背景に沈む。**
cheese は同時に melt/toast/char で色と大きさが変わる（mozzarella が黄〜茶に寄る）ため、
「mozzarella と混同しない」は raw と baked の両方で確認する必要がある。

### 2.4 背景色

| 背景 | 値 |
|---|---|
| tomato-sauce heatmap | `#c73b2e`（`SAUCE_TOMATO_HEX`、濃度で alpha 変化） |
| pesto | `#6b8e3d` |
| olive-oil | `#e9d9a0`（gloss layer） |
| dough | `#f3d9a4` → `#e2b876` gradient（焼成で変化） |
| mozzarella piece | `#fffdf5` → `#e6d8ae`（28×23px 不定形） |
| parmigiano piece | `#fff6d8` → `#e7d182`（細長 sliver） |

### 2.5 現行 22 ingredients の emoji 使用状況（衝突判定用）

| id | cat / placement | 描画 | emoji |
|---|---|---|---|
| tomato-sauce | sauce / spread | heatmap | 🍅 |
| olive-oil | sauce / spread | heatmap | 🫒（Emoji 13.0 = 現行 production の最新 emoji version） |
| pesto | sauce / spread | heatmap | 🌿 |
| mozzarella / gorgonzola / parmigiano / fontina | cheese / scatter | CSS piece | 🧀（pizza 上は非表示） |
| basil | topping | emoji | 🌿 |
| garlic | topping | emoji | 🧄 |
| oregano | topping | emoji | 🍃 |
| cherry-tomato | topping | emoji | 🍅 |
| egg | topping | emoji | 🥚 |
| mushroom | topping | emoji | 🍄 |
| onion | topping | emoji | 🧅 |
| sausage | topping | emoji | 🌭 |
| pepperoni | topping | emoji | 🔴 |
| anchovy | topping | emoji | 🐟 |
| tuna | topping | emoji | 🐠 |
| rosemary | topping | emoji | 🌱 |
| bacon | topping | emoji | 🥓 |
| ham | topping | emoji | 🍖 |
| black-olive | topping | emoji | ⚫ |

## 3. Authoring rules（新 ingredient の emoji 候補に適用）

既存 production の前例から導いた規則。前例に無い判断は owner decision として明記する。

- **R1 一意性**: scatter topping の emoji は、他の emoji 描画 scatter topping と重複してはならない。
  前例: 現行15 topping は全て一意。category をまたぐ共有（spread sauce ↔ scatter topping:
  🍅 tomato-sauce/cherry-tomato、🌿 pesto/basil）は前例ありで許容。
  → **違反: salt-cod 🐟(anchovy), green-onion 🌱(rosemary), fresh-tomato 🍅(cherry-tomato)。**
  例外は owner の明示 waiver（ingredient id 単位で記録）のみ。
- **R2 意味保存**: 別の食材を表す glyph で代用しない（例: 🐡=ふぐ、🦪=牡蠣、🥒=きゅうり、🍥=なると）。
  同一食材の「丸ごと glyph で切片を表す」抽象化（🍆, 🍍, 🌽, 🥔）は前例（🧅 onion, 🍄 mushroom）と
  同種として human 判定対象にする。
- **R3 幾何 glyph**: 🔴 pepperoni / ⚫ black-olive の前例あり。追加する場合は既存幾何 glyph と
  **色覚多様性下でも区別できる**こと（🟢 と 🔴 は赤緑色覚で近づく）。
- **R4 emoji version baseline**: 現行 production の最高は 🫒 Emoji 13.0。これを超える emoji
  （例: 🫘 Emoji 14.0）は baseline 引き上げとして owner 承認が必要。
- **R5 sauce/cheese 上で消えない**: 当該 recipe の実際の base（sauce 色 or dough/oil）と cheese piece の上で、
  raw と overbake(heat 2.0) の両方で glyph の輪郭が読めること。
- **R6 mozzarella 等と混同しない**: 白〜淡黄の glyph / 非emoji fallback は cheese piece と混同しやすい。
  特に `salt-cod`（`#d8c9aa`）/ `sauerkraut`（`#d8d59a`）の color 値を将来 CSS piece の塗りに
  そのまま使うと mozzarella/parmigiano と同系色になる（→ 使うなら輪郭・縞など形状差が必須）。
- **R7 非emoji fallback は future renderer 変更**: CSS physical piece（cheese 方式）を topping に
  広げるには `IngredientPieceVisual` と CSS の変更が要る。W1 slice C（#221 change map の likelyFiles は
  `ingredients.ts` + tests のみ）の範囲を超えるので、選ぶ場合は owner が別 slice として承認する。

## 4. Human Approval の手順と PASS 条件

### 4.1 必須 PASS 条件（ユーザー指定・全 ingredient 共通）

| code | 条件 | 判定方法（最低限） |
|---|---|---|
| C1 | raw 状態で識別可能 | 対象 recipe の BAKE 前 PizzaStage で、名前を見ずに何の食材か判別できる／同 recipe の他 piece と区別できる |
| C2 | baked 後も識別可能 | bake target 付近（heat≈1.0）と overbake（heat≈2.0）の RESULT で C1 が維持される |
| C3 | mozzarella 等と混同しない | raw/baked の mozzarella・parmigiano 等 cheese piece、および同 recipe の淡色 piece と取り違えない |
| C4 | background/sauce 上で消えない | 当該 recipe の base（tomato/pesto/olive-oil/無sauceの dough）上と cheese piece 上で輪郭が読める。色覚エミュレーション（deuteranopia / protanopia）でも同様 |
| C5 | タップ対象として認識可能 | tray chip（26px + 名前）で、同 recipe tray 内の他 chip と区別でき、「これを置く」と分かる。drag preview（30px）で掴んでいる物が分かる |
| C6 | OS差で意味が変わらない | iOS と Android（Google Noto）の実機で同じ食材として読める。未サポート（□/tofu・分解表示）が無い |

### 4.2 判定ルール（「良さそう」で READY にしないための規則）

1. 各条件は `PASS` / `FAIL` / `NOT_TESTED` の3値。**`NOT_TESTED` は PASS ではない。**
2. 1 ingredient の承認 = C1〜C6 全て PASS かつ、その ingredient 固有チェック（§5）が全て PASS。
3. PASS には次の evidence が必須（どれか欠けたら PASS として記録しない）:
   - 承認者（human）、日付、端末名・OS version・browser
   - Preview URL と commit SHA（本物の renderer で描画したもの。文字列を別ツールで表示しただけの
     mock は evidence にならない）
   - screenshot（`docs/reports/screenshots/<task-name>/`、Human Verification Policy §6 準拠）:
     raw 390×844、overbake 390×844、raw 360×800、tray chip、reference 最小（7.3px）、色覚エミュレーション1枚
4. Linux CI / headless Chromium の screenshot は **C6 の evidence にならない**（OS の emoji font が
   iOS/Android と違い、Emoji 14 等は tofu になりうる）。
5. Preflight BLOCKER（§5 で `PRECHECK: BLOCKER`）がある ingredient は、BLOCKER が解消（候補差し替え・
   owner waiver 記録）されるまで checklist を開始しない。
6. 本書および JSON の `preflight` は**判定ではなく事前リスク**。#221 の `authoringStatus`（REVIEW）と
   ledger status（AUTHORING_REQUIRED）は、上記 evidence 付き PASS が揃った時点で、別PRで owner が更新する。

### 4.3 どこで確認するか（owner decision）

新 ingredient は tray が `recipe.requiredIngredients` のみ表示する（Issue #159）ため、ingredient row
だけ追加しても画面に出ない。承認には以下のいずれかが必要:

- **推奨**: slice C（ingredient row）と、その ingredient を使う slice D recipe を同じ実装PRの
  dedicated Preview に載せ、本 checklist PASS を merge gate にする。
- 代替: dev-only の ingredient gallery（future `src/**` 変更、別 slice）。

### 4.4 最小デバイス行列

| ID | 環境 | 必須 |
|---|---|---|
| D1 | iPhone 実機 Safari, 390×844 相当（authority） | 必須 |
| D2 | Android 実機 Chrome（Google Noto Color Emoji） | 必須 |
| D3 | 360×800（Android 実機 or DevTools） | 必須（レイアウト/密度のみ。emoji 形状の evidence は D1/D2） |
| D4 | Samsung 端末（Samsung emoji font） | 推奨。未実施なら `NOT_TESTED` として既知リスクに記録 |
| D5 | Windows 10 / 11 Chrome | Emoji 14 以上を使う ingredient（baked-beans 🫘）のみ必須 |

## 5. Ingredient 別 authoring sheet

凡例: 「OS 差」欄の glyph 説明は一般的な vendor 傾向であり、**実機 evidence ではない**（C6 は §4.4 の実機で判定）。
minCount は #221 の authoring 候補（未確定）。#220 側のみの recipe は minCount 未 authoring。

---

### 5.1 `capers` — ING-02 ／ source: PR220_W1 + PR221_W1

| 項目 | 内容 |
|---|---|
| canonical ID | `capers` |
| display name | ケッパー（#221 候補） |
| emoji 候補 | 🟢 U+1F7E2 LARGE GREEN CIRCLE（Emoji 12.0）— #221 候補 |
| fallback | emoji 代替なし（🫒 は olive-oil と olive 意味で不可、R2）。🟢 不採用時は小粒 CSS piece（オリーブ緑・暗輪郭）= future renderer 変更（R7） |
| category | topping / scatter |
| raw appearance | 平坦な緑の円 28px。実物（小さな緑の蕾）とは質感が異なる抽象表現 |
| baked appearance | heat 1.0 でほぼ不変、2.0 で暗いオリーブ緑（sepia 0.2）。`bakeRoastResistant` は false 想定（要判定） |
| 推奨サイズ | default 28px。実物より大きく ⚫ black-olive と同径になる点を抽象化として許容するか判定 |
| overlap 時の識別性 | puttanesca: anchovy🐟×3, black-olive⚫×2, capers🟢×2, garlic🧄×2 = 9 piece。⚫ と 🟢 は**同一シルエット**のため、重なると色（明度差）だけが手掛かり |
| sauce/cheese contrast | tomato `#c73b2e` 上: 色相は補色だが**赤緑色覚で沈むリスク**。cheese なし recipe |
| 390×844 | dough 300px に 9 piece + sauce。円同士の接触が起きやすい |
| 360×800 | dough 274–281px で密度 +約15%。⚫/🟢 の隣接確率が上がる |
| iOS emoji | 光沢のある緑の円（vendor 傾向） |
| Android / 他OS | Google: フラットな緑円 / Microsoft: 輪郭付きフラット / Samsung: グラデーション。意味（緑の丸）は共通だが「食材」の意味は持たない → 名前 label 依存 |
| PRECHECK | **RISK_MEDIUM** — R3（🔴 pepperoni と赤緑色覚で近い。同 recipe 共存時は再審査）、C4 on tomato |

固有チェック: [ ] deuteranopia/protanopia エミュレーションで 🟢 が tomato 上に見える ／ [ ] ⚫ と 🟢 が重なっても2種と分かる ／ [ ] 7.3px thumbnail で ⚫ と区別できる ／ [ ] 「信号・ステータス記号」に見えず食材として受け取れる（名前込み）

---

### 5.2 `eggplant` — ING-03 ／ source: PR220_W1 + PR221_W1

| 項目 | 内容 |
|---|---|
| canonical ID | `eggplant` |
| display name | #221: 「ナス」／ `data/recipes/ingredient_master_catalog.json`: 「なす」— **表記不一致、owner 選択**（既存は たまねぎ/たまご/にんにく とひらがな系） |
| emoji 候補 | 🍆 U+1F346（Unicode 6.0、全OS対応） |
| fallback | support 上は不要。tone 理由で不採用なら輪切り CSS piece（紫の縁 + 淡色果肉）= future（R7） |
| category | topping / scatter |
| raw appearance | 丸ごと1本・紫・緑のヘタ。実物（輪切り・焼き/揚げ）とは形が違う抽象化 |
| baked appearance | 暗い紫がさらに暗化。heat 2.0 でほぼ黒紫 |
| 推奨サイズ | default 28px（斜めの細長シルエット） |
| overlap | parmigiana: eggplant×3, basil🌿×2, mozzarella×2, parmigiano×2 ／ melanzane: eggplant×3, basil×2, mozzarella×2。🌿 も斜めシルエット＋緑 → **小サイズで 🍆 のヘタと 🌿 が似る**恐れ |
| sauce/cheese contrast | **tomato `#c73b2e` 上で暗紫 × 暗赤 = 明度差が小さい（HIGH リスク）**。mozzarella 上は良好 |
| 390×844 / 360×800 | 3本が斜めに並ぶと重なりやすい。360 で接触増 |
| iOS emoji | 光沢のある濃紫 + 緑ヘタ |
| Android / 他OS | 各社とも紫のナスで意味は共通。※俗語的含意は OS 差ではなく tone の問題 → owner 判断項目 |
| PRECHECK | **RISK_HIGH** — C4（tomato 上）と C2（overbake で沈む） |

固有チェック: [ ] tomato sauce 最大濃度部分の上で overbake でも輪郭が読める ／ [ ] 9.5px / 7.3px で 🌿 basil と区別できる ／ [ ] 「丸ごと glyph = 輪切り」抽象化を承認（ING-03 本文） ／ [ ] tone（俗語的含意）を owner が許容

---

### 5.3 `clam` — ledger なし（#220 側のみ）／ source: PR220_W1

| 項目 | 内容 |
|---|---|
| canonical ID | `clam`（matrix token 「アサリ」 exact_alias） |
| display name | アサリ（候補。未 authoring） |
| emoji 候補 | 🐚 U+1F41A SPIRAL SHELL（6.0）— **「貝」一般の意味、巻貝の形**。🦪 OYSTER（Emoji 12.0）は別食材（牡蠣）で R2 違反 → 不可 |
| fallback | 正確な emoji なし。🐚 不採用なら殻付き/剥き身 CSS piece = future（R7） |
| category | topping / scatter |
| raw appearance | 🐚 は淡いクリーム〜ピンクの巻貝。実物（刻んだ剥き身、灰ベージュ）とは乖離 |
| baked appearance | 淡色がセピア寄りに暗化。dough も焼き色が付く |
| 推奨サイズ | default 28px |
| overlap | new-haven-apizza: clam, garlic🧄, olive-oil(spread), parmigiano(cheese)。**🧄（白）・parmigiano（淡黄 sliver）・🐚（淡色）がすべて淡色** |
| sauce/cheese contrast | olive-oil `#e9d9a0` / dough `#f3d9a4` 上に淡色 glyph → **明度差が最小クラス（HIGH）** |
| 390×844 / 360×800 | minCount 未 authoring。piece 数確定後に再評価 |
| iOS emoji | 淡いピンク〜ベージュの巻貝 |
| Android / 他OS | Google: 橙〜ピンク系の巻貝、Microsoft/Samsung も巻貝。「二枚貝」を描く vendor は無い想定 → 全OSで同程度に抽象的 |
| PRECHECK | **RISK_HIGH** — C3（parmigiano/garlic と混同）、C4（淡色 base）、R2 境界（巻貝 ≠ アサリ） |

固有チェック: [ ] olive-oil base の上で raw/overbake とも輪郭が読める ／ [ ] parmigiano sliver・🧄 と取り違えない ／ [ ] 巻貝 glyph を「アサリ」として許容するか owner 判断

---

### 5.4 `corn` — ledger なし（#220 側のみ）／ source: PR220_W1

| 項目 | 内容 |
|---|---|
| canonical ID | `corn` |
| display name | コーン（catalog） |
| emoji 候補 | 🌽 U+1F33D（6.0） |
| fallback | 不要見込み |
| category | topping / scatter |
| raw appearance | 黄色い穂＋緑の皮。実物（粒）とは異なる丸ごと抽象化 |
| baked appearance | 黄 → 黄金色。**mozzarella の焼き色（黄〜茶）と色域が近づく** |
| 推奨サイズ | default 28px |
| overlap | bambino: corn, ham🍖, mozzarella + tomato。🍖 とは形・色とも別 |
| sauce/cheese contrast | tomato 上は良好（黄 × 赤）。mozzarella 上は黄 × クリームで中程度、緑の皮が補助 |
| 390×844 / 360×800 | minCount 未 authoring |
| iOS / Android / 他OS | 全 vendor で黄色い穂。意味共通 |
| PRECHECK | **RISK_LOW** |

固有チェック: [ ] overbake の mozzarella（焼き色）と 🌽 が区別できる ／ [ ] 「穂 = コーン粒」抽象化を承認

---

### 5.5 `pineapple` — ledger なし（#220 側のみ）／ source: PR220_W1

| 項目 | 内容 |
|---|---|
| canonical ID | `pineapple` |
| display name | パイナップル（catalog） |
| emoji 候補 | 🍍 U+1F34D（6.0） |
| fallback | 不要見込み |
| category | topping / scatter |
| raw appearance | 丸ごと1個（黄の実 + 緑の冠）。実物（角切り）とは異なる抽象化 |
| baked appearance | 黄が暗化・セピア。冠の緑で識別は維持される見込み |
| 推奨サイズ | default 28px |
| overlap | hawaiian: ham🍖, pineapple, mozzarella + tomato。縦長シルエットで他と別 |
| sauce/cheese contrast | tomato 上良好、mozzarella 上中程度 |
| 390×844 / 360×800 | minCount 未 authoring |
| iOS / Android / 他OS | 全 vendor で丸ごとパイナップル。意味共通 |
| PRECHECK | **RISK_LOW** |

固有チェック: [ ] 🌽 corn と小サイズ（7.3px）で混同しない（両方とも黄＋緑） ／ [ ] 丸ごと抽象化を承認

---

### 5.6 `fresh-tomato` — ledger なし（#220 側のみ）／ source: PR220_W1

| 項目 | 内容 |
|---|---|
| canonical ID | `fresh-tomato`（matrix token 「トマト」 exact_alias） |
| display name | トマト（候補） |
| emoji 候補 | 🍅 は **cherry-tomato（scatter topping）と同一 → R1 違反** |
| fallback | (a) 輪切り CSS piece（赤い円 + 淡い種リング）= future（R7）／ (b) owner waiver で 🍅 共有 ／ (c) `fresh-tomato` を `cherry-tomato` と統合するかは **canonicalization / evidence 判断**で本書の範囲外（統合すると #220 の W1 新 ingredient 数が変わる） |
| category | topping / scatter |
| raw appearance | （🍅 の場合）丸ごと赤トマト。cherry-tomato と見分け不能 |
| baked appearance | 赤が暗化 |
| 推奨サイズ | default 28px |
| overlap | pesto-caprese: basil🌿, fresh-tomato, mozzarella + pesto |
| sauce/cheese contrast | **pesto `#6b8e3d` 上の赤 = 赤緑色覚で沈むリスク（HIGH）**。mozzarella 上は良好 |
| 390×844 / 360×800 | minCount 未 authoring |
| iOS / Android / 他OS | 🍅 は全 vendor で赤トマト |
| PRECHECK | **BLOCKER（R1）** + RISK_HIGH（C4 on pesto, 色覚） |

固有チェック: [ ] R1 解消方法を owner が選択し記録 ／ [ ] pesto 上の色覚エミュレーションで見える ／ [ ] cherry-tomato と別食材だと tray/inventory で分かる

---

### 5.7 `potato` — ledger なし（#220 側のみ）／ source: PR220_W1

| 項目 | 内容 |
|---|---|
| canonical ID | `potato` |
| display name | じゃがいも（catalog） |
| emoji 候補 | 🥔 U+1F954（Emoji 3.0） |
| fallback | 不要見込み（Emoji 3.0 は baseline 13.0 内） |
| category | topping / scatter |
| raw appearance | 丸ごと茶色の芋。実物（薄切り・淡黄）とは異なる抽象化 |
| baked appearance | 茶がさらに暗化（heat 2.0 で brightness 0.78） |
| 推奨サイズ | default 28px |
| overlap | pesto-patate: bacon🥓, potato, mozzarella + pesto。🥓 と茶系で近いが形は別 |
| sauce/cheese contrast | **pesto 上の茶 = 中〜低コントラスト、overbake でさらに低下（MEDIUM）** |
| 390×844 / 360×800 | minCount 未 authoring |
| iOS / Android / 他OS | 全 vendor で茶色い芋。意味共通 |
| PRECHECK | **RISK_MEDIUM** — C2/C4（pesto + overbake） |

固有チェック: [ ] pesto 上 overbake で輪郭が読める ／ [ ] 🍄 mushroom（別 recipe）と tray/inventory で混同しない ／ [ ] 丸ごと抽象化を承認

---

### 5.8 `baked-beans` — ING-01 ／ source: PR221_W1（#220 HEAD では W4）

| 項目 | 内容 |
|---|---|
| canonical ID | `baked-beans` |
| display name | ベイクドビーンズ（#221） |
| emoji 候補 | 🫘 U+1FAD8 BEANS（**Emoji 14.0** → R4 baseline 引き上げ、owner 承認要） |
| fallback | 🥫 CANNED FOOD（Emoji 5.0）は「缶詰」で R2 境界 → 非推奨。未サポート環境での tofu を避けるなら CSS piece = future（R7） |
| category | topping / scatter |
| raw appearance | 赤茶の豆（vendor により2粒〜山盛り）。実物（トマト煮の小豆大の豆）と色は近い |
| baked appearance | 赤茶が暗化・セピア |
| 推奨サイズ | default 28px |
| overlap | full-english: bacon🥓×2, sausage🌭×2, egg🥚×1, baked-beans×3, mozzarella×2。**🥓/🌭/🫘 が同じ赤茶系**、形で区別 |
| sauce/cheese contrast | sauce なし（dough + mozzarella）。mozzarella 上は良好、dough 上は中程度 |
| 390×844 / 360×800 | 計 10 piece（cheese 含む）。360 で赤茶系同士の接触が増える |
| iOS emoji | iOS 15.4 以降で表示（それ未満は未サポート）※要実機確認 |
| Android / 他OS | Android 12L/13 以降の Noto で表示。**Windows 10 は Emoji 14 非対応で □ になる可能性が高い**。Linux CI Chromium も font 次第で □ ※要実機確認 |
| PRECHECK | **RISK_MEDIUM** — R4 / C6（未サポート環境） |

固有チェック: [ ] D5（Windows）で □ にならない、またはサポート下限を owner が明記 ／ [ ] 🥓/🌭 と重なっても 🫘 と分かる ／ [ ] overbake で色・可読性が保たれる（ING-01 本文）

---

### 5.9 `green-onion` — ING-04 ／ source: PR221_W1（#220 HEAD では W4）

| 項目 | 内容 |
|---|---|
| canonical ID | `green-onion` |
| display name | 青ねぎ（#221） |
| emoji 候補 | 🌱 は **rosemary と同一 → R1 違反（BLOCKER）** |
| fallback | emoji 代替は全て R2 違反（🥒 きゅうり / 🥦 ブロッコリー / ☘️ / 🎋 等）。現実的な選択肢は (a) 小口切りの緑リング CSS piece = future（R7）、(b) owner waiver で 🌱 共有 |
| category | topping / scatter |
| raw appearance | （🌱 の場合）双葉の芽。実物（小口切りの緑の輪）と乖離 |
| baked appearance | `bakeRoastResistant: true` を推奨（basil/oregano/rosemary と同じ「緑の herb が茶色で識別不能になる」回避の前例）。要承認 |
| 推奨サイズ | default 28px（CSS piece の場合も同等の見かけサイズ） |
| overlap | tsukimi: egg🥚×1, bacon🥓×3, green-onion×2, mozzarella×2 |
| sauce/cheese contrast | sauce なし。緑 × 白 mozzarella は良好 |
| 390×844 / 360×800 | 計 8 piece。密度は低い |
| iOS / Android / 他OS | 🌱 は全 vendor で芽。意味は「芽」で「ねぎ」ではない |
| PRECHECK | **BLOCKER（R1）** |

固有チェック: [ ] R1 解消方法を owner が選択し記録（ING-04 本文の「choose a distinct glyph」） ／ [ ] 選んだ表現が rosemary/basil/oregano と tray・inventory で区別できる ／ [ ] `bakeRoastResistant` 採否を記録

---

### 5.10 `salt-cod` — ING-05 ／ source: PR221_W1（#220 HEAD では W4）

| 項目 | 内容 |
|---|---|
| canonical ID | `salt-cod` |
| display name | 塩だら（#221） |
| emoji 候補 | 🐟 は **anchovy と同一 → R1 違反（BLOCKER）**。🐠 は tuna 使用済み |
| fallback | emoji 代替は R2 違反（🐡 ふぐ / 🍥 なると / 🦈）。(a) ほぐし身 CSS piece = future（R7）— **ただし淡色 `#d8c9aa` 単色の塊は mozzarella と同系色（R6）で不可。縞・暗輪郭など形状差必須**、(b) owner waiver で 🐟 共有（ING-05「specificity is textual」をそのまま承認する形） |
| category | topping / scatter |
| raw appearance | （🐟 の場合）青い魚1尾。実物（白いほぐし身）と乖離 |
| baked appearance | 青が暗化 |
| 推奨サイズ | default 28px |
| overlap | bacalhau: mozzarella×2, salt-cod×3, onion🧅×2, black-olive⚫×2 |
| sauce/cheese contrast | sauce なし。🐟 なら mozzarella 上良好。**CSS 淡色 fallback の場合は mozzarella 上で消える/混同する（HIGH）** |
| 390×844 / 360×800 | 計 9 piece |
| iOS / Android / 他OS | 🐟 は全 vendor で青系の魚 |
| PRECHECK | **BLOCKER（R1）** + fallback 選択時 RISK_HIGH（C3） |

固有チェック: [ ] R1 解消方法を owner が選択し記録 ／ [ ] 選んだ表現が anchovy・tuna と tray/inventory/Dex で区別できる ／ [ ] fallback が mozzarella（raw・焼き色）と混同しない

---

### 5.11 `sauerkraut` — ING-06 ／ source: PR221_W1（#220 HEAD では W4）

| 項目 | 内容 |
|---|---|
| canonical ID | `sauerkraut` |
| display name | ザワークラウト（#221） |
| emoji 候補 | 🥬 U+1F96C LEAFY GREEN（Emoji 11.0） |
| fallback | 🥗（サラダ）は R2 違反。不採用なら淡黄の千切り CSS piece = future（R7）— ただし `#d8d59a` 単色は parmigiano/mozzarella と同系（R6） |
| category | topping / scatter |
| raw appearance | 鮮やかな緑の葉物（vendor によりチンゲン菜/レタス風）。実物（淡黄の発酵千切りキャベツ）と色が大きく違う |
| baked appearance | 緑がセピア寄りのオリーブ色へ。`bakeRoastResistant` は false 想定（要判定） |
| 推奨サイズ | default 28px |
| overlap | polish-kielbasa: mozzarella×2, sausage🌭×3, sauerkraut×3, onion🧅×2 |
| sauce/cheese contrast | sauce なし。緑 × 白 mozzarella 良好（ING-06 の cheese-background 条件は 🥬 なら満たしやすい） |
| 390×844 / 360×800 | 計 10 piece |
| iOS emoji | チンゲン菜風の緑 |
| Android / 他OS | Google: レタス/葉物、Samsung/Microsoft も葉物。「キャベツ」「レタス」「青菜」など読みが揺れる — **意味の揺れは全OS共通で、名前 label 依存** |
| PRECHECK | **RISK_MEDIUM** — R2 境界（葉物 ≠ 発酵キャベツ）、basil 等 herb との混同 |

固有チェック: [ ] 「葉物 glyph = ザワークラウト」抽象化を承認（ING-06 本文） ／ [ ] tray/inventory で 🌿/🍃/🌱 と区別できる ／ [ ] overbake で「焦げた herb」に見えない

## 6. Preflight サマリ（判定ではない）

| id | source | emoji 候補 | PRECHECK | 主因 |
|---|---|---|---|---|
| capers | #220 + #221 | 🟢 | RISK_MEDIUM | R3 色覚 / ⚫ と同形 |
| eggplant | #220 + #221 | 🍆 | RISK_HIGH | tomato 上の明度差・overbake |
| clam | #220 | 🐚 | RISK_HIGH | 淡色 base・淡色同居・巻貝抽象 |
| corn | #220 | 🌽 | RISK_LOW | — |
| pineapple | #220 | 🍍 | RISK_LOW | — |
| fresh-tomato | #220 | 🍅 | **BLOCKER** | R1（cherry-tomato） |
| potato | #220 | 🥔 | RISK_MEDIUM | pesto + overbake |
| baked-beans | #221 | 🫘 | RISK_MEDIUM | R4 Emoji 14.0 |
| green-onion | #221 | 🌱 | **BLOCKER** | R1（rosemary） |
| salt-cod | #221 | 🐟 | **BLOCKER** | R1（anchovy） |
| sauerkraut | #221 | 🥬 | RISK_MEDIUM | 意味の抽象度 |

RISK_LOW でも READY ではない。全件 §4.2 の evidence 付き PASS が必要。

## 7. Owner decision 一覧（本書は決めない）

| id | 決定事項 |
|---|---|
| VD-01 | W1 の正となる recipe / 新 ingredient 集合（#220 HEAD vs #221、§1.2） |
| VD-02 | R1 違反3種（fresh-tomato / green-onion / salt-cod）の解消方法: 差し替え・非emoji piece・waiver |
| VD-03 | 非emoji CSS piece を topping に導入するか（R7、`src/**` の別 slice） |
| VD-04 | emoji baseline を Emoji 14.0 に引き上げるか（baked-beans 🫘） |
| VD-05 | 承認用 Preview の形態（§4.3） |
| VD-06 | eggplant の表記（ナス / なす）、🍆 の tone 許容 |
| VD-07 | green-onion の `bakeRoastResistant` 採否 |

## 8. 変更範囲

- 追加: 本書、`docs/reports/data/TETO_PROGRESS2_W1_INGREDIENT_VISUAL_AUTHORING_CHECKLIST.json`
- 変更なし: `src/**`、PR #220 / #221 の branch とファイル、production ingredient/recipe data、image asset
- Human Verification video: 不要（docs-only、Policy §2「原則不要」）。本書の checklist は将来の
  実装 PR で Policy に沿った screenshot/video と併せて実行する。
