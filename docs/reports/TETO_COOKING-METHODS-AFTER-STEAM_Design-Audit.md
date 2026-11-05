# Steam の次の調理法 — Fresh Audit / Design（docs-only）

作成: 2026-11-04 / 基準 `main` = `0016222`（#743 Batch 17）/ ブランチ `claude/teto-next-cooking-method-cgnsh4`
性質: **調査と設計のみ。** `src/**`・`e2e/**`・CSS・データ・テストは変更していない。PR・Issue・claim の作成、merge、共有 Preview 更新、Production ON は行っていない。新規ファイルは本書のみ（既存の研究書には 1 行の後続ポインタを追記）。HOT file（`PROJECT_HANDOFF.md` 等）は触れていない。
HV: docs-only のため対象外（`TETO_HUMAN-VERIFICATION-POLICY.md` §2）。
「推奨」は助言であり Owner Decision ではない。**Owner 承認前に実装しない。** 数値は【実測】【推論】【未確認】を区別する。

親資料（重複させない）: `TETO_COOKING-METHODS-NEXT_Research.md`（蒸す／揚げる／煮込むの一次比較）、`TETO_COOKING-STEAM_PHASE1_Plan.md` ほか Steam 一式、`TETO_COOKING-PROCESS-EXPANSION_Fresh-Audit.md`、`TETO_RECIPE_172_MECHANIC-MATRIX.md`。本書はそれらの**後**の判断（「Steam の次」）に絞る。

---

## 0. 結論（先に）

1. **推奨: 「揚げる」。** 2 段構え。
   - **Phase 1（本書で詳細設計）**: 食材単位・任意・transient の「揚げる」体験。操作は「具を油へ**下にドラッグ→放す→泡を見て→上にドラッグで引き上げ**」。手掛かりは**泡の大きさと勢い**（色ではない）。本番 OFF・Preview/DEV 限定。
   - **Phase 2（別の Owner Gate）**: 揚げ生地 `FRY_COOK` で **`pizza-fritta`（READY・新食材 0）** を遊べるようにする。
2. **正直な数字:** 172 レシピの原典記述が「調理法」を**要求する**のは、揚げ 1（`pizza-fritta`）と炒め 3（`yakiniku`／`lomo-saltado`／`kimchi`）だけ。**茹でる・煮込む・蒸すを要求する行は 0**。つまり「新しい調理法で未実装レシピがたくさん解放される」状況はそもそも存在しない。解放に直結するのは**食材・ソース**（Batch 系）で、調理法は「既存レシピの遊び」を増やすもの。揚げるは「未実装で唯一、新食材なしで遊べるようになる調理法レシピ」を持つ点で一歩勝る。
3. **ただし Phase 1 単体では未実装レシピは増えない。** 増えるのは「既存レシピの体験」（絵のある食材で 3 レシピ、ナスの絵が整えば 9 レシピ）。`pizza-fritta` が増えるのは Phase 2。ここは Owner が最初に理解しておくべき点（§8 O-2）。
4. **次点は「炒め Production ON ＋ yakiniku-pizza」**（新しい調理法ではなく既存法の接続。新食材 2、PREP_STEP を識別軸にする設計が要る）。調理法の新規性を求めないなら最も「遊べるレシピ」に近い（§3.3）。

---

## 1. 現状（STEP 1）

### 1.1 調査範囲
| 区分 | 読んだもの | できなかったこと |
|---|---|---|
| 規則 | `CLAUDE.md`、`PROJECT_HANDOFF.md`（先頭 250 行＋startup checklist の所在）、`SESSION-OPERATIONS_1.0`（全文）、`HUMAN-VERIFICATION-POLICY`（冒頭〜§3） | HANDOFF 全 1146 行（古い現況は信用せず main のコードを正とした） |
| 既存研究 | `COOKING-METHODS-NEXT_Research`（全文）、`COOKING-STEAM_PHASE1_Plan`（S1 まで）、`COOKING-EXPANSION_FRESH-AUDIT-AND-PLAN`（前半）、`COOKING-PROCESS-EXPANSION_Fresh-Audit`（前半）、`RECIPE_172_MECHANIC-MATRIX`（§3〜4） | Steam S3 Design／Result、炙り Result の詳細 |
| コード（読み取り） | `prepIngredients.ts`・`searIngredients.ts`・`steamIngredients.ts`・各 `*ExperienceGate.ts`、`recipes.ts`／`ingredients.ts` の機械走査 | アプリ実行・テスト実行・実機操作（**未実施**。`node_modules` なし） |
| 172 マトリクス | `GAME-DESIGN-CANDIDATE_MATRIX.json` 全 172 行（`cookingProfile`／`prep`／`requiredCapabilities`／語の走査） | pizzadb.jp 原典ページ（**原典未確認**）。出荷済みとの対応は id 一致の概算で、別名の取りこぼしがありうる |
| GitHub | open PR 全件、open Issue 上位 40 件、#738・#748 本文 | コメント全文 |

### 1.2 既存の調理法・工程・操作方式（main `0016222` ＋ open PR）
| 操作 | 対象 | 入力 | 手掛かり | 判定 | 本番 | 状態 |
|---|---|---|---|---|---|---|
| 生地のばし（DOUGH） | 生地 | 放射状ドラッグ（伸縮可） | 輪郭 | 採点なし | ON | main |
| ソース塗り（SAUCE） | ソース全般 | 長押し＋ドラッグ（field） | 塗り面 | 採点 52 点 | ON | main |
| 具のタップ配置／トレイドラッグ | 全 topping | タップ | — | Pieces 採点 | ON | main |
| マヨ絞り | mayo | 1 ストローク | 滴 | 1 ピース | ON | main（B13） |
| 炒める（Cooking Prep 1B） | **beef のみ** | タップ 1 回（取り出し時刻） | 色・つや・湯気 | early/best/overdone（見た目） | **OFF**（`PREP_EXPERIENCE_PRODUCTION=false`） | main |
| 焼き目をつける（Sear） | **sausage のみ** | 長押し→離す | 色・光・煙 | 名前 4 つのみ | **ON**（`SEAR_EXPERIENCE_PRODUCTION=true`、#730） | main |
| 蒸す（Steam） | **clam／mussel** | A: ふたタップ ／ B: 鍋ゆすり（タップ・矢印代替） | 殻が開く・湯気（出来事） | 見た目の名前のみ | **OFF** | S1/S2 main、**S3 = #738（open）**、HV 手順書 #747（draft） |
| 焼成（BAKE） | ピザ全体 | needle を 1 回タップ | ガイドは時間で薄れる | Scoring 2.0 | ON | main |
| 後乗せ（FINISH）／CUT | late topping／全体 | タップ／ストローク | — | 配置・分割 | ON（FINISH は late 5 レシピ） | main |
| DRIZZLE（液体の後がけ） | — | **未実装**。#579 は設計保留、**#746 = Gesture Lab（独立画面の実験・本番 OFF）が open** | — | — | — | open PR |

共通の流儀（炒め・炙り・蒸すで固定）: 新タブを足さない／TOPPING で**対象食材を選択中だけ**出る角のピル→ステージが一時的に調理画面（`inert` で背面を保護）／対象は「対象リストにある **かつ** 専用の絵（`pieceVisual`）がある」食材 id のみ（Anti-Oracle: レシピ・標的・モードを入力にしない）／transient 状態で採点・識別・保存・在庫・Dex に読まれない／Lunch Rush・Dinner 除外。炒め・炙り・蒸すは**コードを共有しない独立実装**（Owner 決定、Steam 計画 §0）。

### 1.3 172 マトリクスと実装済みレシピの照合【実測 + 概算】
- `cookingProfile.method`: bake 171／**fry 1**。`prep` を持つ行 3（すべて stir-fry 系）。`requiredCapabilities`: DOUGH_VARIANT 33／MULTI_SPREAD_LAYER 17／LATE_ADDITION 13／PAN_BAKE 8／ENCLOSE 5／DOUGH_SHAPE_TARGET 5／**PREP_STEP 3**／STEP_ORDER 2／ZONED 1／**FRY_COOK 1**／LAMINATE 1。
- 語の走査（fried/揚/フライ、boil/茹、simmer/stew/煮/カレー、steam/蒸、grill/roast/炙、stir/炒）: 揚げ 4 行（うち 1 が `pizza-fritta` の生地原文、他 3 は stir-fry／付け合わせ）、**茹で 0・蒸し 0・煮込み（調理法として）0**（`currywurst`／`curry-pizza-japan` は料理名）。
- 出荷済み: `recipes.ts` に id 80 件（Batch 17 まで）。マトリクス 172 行のうち id 一致で出荷済みと見えるもの 63、**未出荷は概算 109**（別名取りこぼしの可能性、late 専用レシピを含む）。Batch 18（#748）が `baingan-bharta`／`reina-pepiada` を取りに行く。
- 調理法を**要求する**未実装行:

| 行 | 状態 | 要求 | 新食材 | 備考 |
|---|---|---|---|---|
| `pizza-fritta` | READY | `FRY_COOK`（焼成の代わりに揚げ）。NOT_REPRESENTABLE | **0**（mozzarella／pork／ricotta／tomato-sauce は既存） | 構造的（L）。cook 軸が `FIXED_BY_FLOW` |
| `yakiniku-pizza` | READY | `PREP_STEP`（牛肉を炒める） | **2**（`yakiniku-sauce` sauce、`white-sesame`） | 炒めの Phase 1B（beef）が既にある |
| `pizza-de-lomo-saltado` | BLOCKED（ソース未特定） | `PREP_STEP`＋`LATE_ADDITION` | `french-fries` ほか | 揚げポテトを使う（揚げる Phase 2 の相乗り候補） |
| `kimchi-pizza` | BLOCKED（ソース未特定） | `PREP_STEP`（水切り／炒め） | `kimchi` ほか | |

---

## 2. 候補比較（STEP 2）

食材の「出荷済み利用レシピ数」は `recipes.ts` の `requiredIngredients` 機械走査【実測】。「専用の絵」は `pieceVisual` の有無【実測】。「自然さ」は一般的な調理知識による【推論】。

### 2.1 食材側の準備状況
| 食材 | 絵 | 出荷済みレシピ数 | 自然な調理法 |
|---|---|---|---|
| eggplant | ✕ | 9 | **揚げる**（parmigiana／alla-norma／melanzane／sichuan）。baba-ganoush は焼き |
| potato／sweet-potato | ✕ | 3 | 揚げる・茹でる・蒸す |
| shrimp | ○ | 2（pesto-gamberi、pescatore） | 炒める／揚げる（エビフライ寄り。レシピとの相性は弱い） |
| hot-dog | ○ | 1（pizza-overload） | 揚げる（アメリカンドッグ寄り、弱い） |
| bell-pepper＋green-pepper | ○ | 9（和集合） | 炒める／焼く |
| porcini | ○ | 2 | 炒める |
| fresh-tomato | ○ | 8 | 焼く（ロースト）＝炙りと同軸 |
| beef | ○ | 3（goulash、rendang、suya） | 煮込む（goulash／rendang）／炒める（suya） |
| onion／chicken／mushroom／bacon／egg 等 | ✕ | 多数 | 絵が先 |

### 2.2 比較表
◎良い／○／△／✕。難度は実装規模の相対目安（Sear Phase 1 を基準）。**楽しさ・テンポは設計上の見込みで実機評価ではない。**

| 候補 | 解放できる未実装レシピ | 新食材 | 実装難度 | iPhone 操作適性 | 既存システムへの影響 | 保存互換 | Steam／DRIZZLE／B18 との干渉 | 既存 Issue/PR 重複 |
|---|---|---|---|---|---|---|---|---|
| **A. 揚げる（食材単位・任意）** | **0**（体験が増えるのは既存 3 レシピ＝絵あり、ナス絵後に 9） | 0（ナス絵は食材ではなく描画） | 中（Steam 同等の独立実装） | ◎ 縦ドラッグ＋タップ代替。指の遮蔽は引き上げ時のみ | なし（transient） | 変更なし（schema v2） | **Steam #738 と HOT 3 ファイルで重なる → S2 は #738 merge 後**。DRIZZLE #746 は独立画面で重ならない。B18 は `ingredients.ts` を claim（〜11/18）→ ナス絵の PR は後 | 先行 Issue なし。研究書 §7.5 に次点として記載のみ |
| **B. 揚げ生地 `FRY_COOK`** | **1（pizza-fritta、READY）**＋ lomo-saltado（BLOCKED）に相乗り可 | 0 | **大**（BAKE を置き換え：cook 軸 OBSERVED 化、窓・採点・RESULT・Hint・DH4 に波及） | ○ | **大** | cook 軸は識別の再計算が必要（保存データ自体は不変にできる） | Steam とは独立。`gameReducer.ts` 等 HOT に広く触る | #577 Dough Kind の識別軸設計と隣接 |
| C. 茹でる | 0（原典 0 行） | 0 | 小〜中 | ○（タップ判定＝炒めと同型） | なし | 変更なし | 低 | なし |
| D. 煮込む | 0（原典 0 行） | 0 | 大（SAUCE との境界。beef は炒め対象と重複し、レシピ依存の選択は Anti-Oracle に抵触） | △ 円ドラッグ | SAUCE（採点 52 点）に波及しうる | — | 低 | なし |
| E. 炒め・炙りの食材追加（ピーマン等） | 0 | 0 | 小（対象リストへの追加） | ◎ | なし | 変更なし | **Owner が炙り Phase 2 を保留中**。炒めも本番 OFF | #696 に隣接 |
| F. 炒め Production ON ＋ yakiniku-pizza | **1（yakiniku、READY）** | **2** | 中（`prep` を識別軸にするなら DH4／Hint／Research に波及） | ◎ | 識別に入れるなら大、体験だけなら小 | 要設計 | **Session A（B18）のデータ領域と近い**（recipes／ingredients） | #696 |
| （参考）蒸す | 0 | 0 | — | — | — | — | 進行中（#738） | #726 |

### 2.3 なぜ揚げるか（推奨理由、順位付き）
1. **調理法で未実装レシピが増える唯一の経路**（`pizza-fritta`＋lomo-saltado の相乗り）。しかも新食材 0。他の候補は 0 行か、新食材が要る（F）。
2. **手掛かりが「色」でなく「泡の音・大きさ・勢い」**。炒め（色）・炙り（色＋長押し）・蒸す（殻が開く出来事）と体験が被らない。
3. **入力語彙が新しい**: 「下ドラッグで沈める→放す→待つ→上ドラッグで引き上げ」は、タップ（炒め）・長押し（炙り）・ゆすり／ふたタップ（蒸す）のどれとも違う。長押しを使わないので炙りと被らない。
4. **対象食材の拡張余地が最大**（ナス 9＋ポテト 3）。
- 弱点（隠さない）: Phase 1 の対象（shrimp／hot-dog）は**調理として不自然寄り**。ナスの絵（27 番目以降の専用 SVG、Icons Style Lock の Owner 判断）が整うまで「自然に効く 9 レシピ」は使えない。→ O-1 で Owner が選ぶ。

---

## 3. 推奨の設計（STEP 3）— 揚げる Phase 1

### 3.1 対象食材（Owner 選択 O-1）
- **案 X（推奨・絵待ちなし）:** `FRY_TARGET_INGREDIENT_IDS = ["shrimp", "hot-dog"]`（絵あり）。HV 用の**実験**であり、蒸すが 3 レシピで始めたのと同じ位置づけ。
- 案 Y: ナスの専用絵を先に作り `["eggplant"]`（9 レシピ）。絵は別 Gate（Style Lock／Icons、B18 の `ingredients.ts` claim 後）。
- 規則は炒め・炙り・蒸すと同じ: 対象リストにある **かつ** `pieceVisual` あり。**他 3 法の対象リストと交わらない**ことをテストで固定（beef／sausage／clam／mussel は不可）。
- 将来の追加（Phase 1b）: eggplant、potato（絵が整ってから。ここで初めて自然さが上がる）。

### 3.2 対象レシピ（Phase 1・案 X）
`pesto-gamberi`、`pescatore`（shrimp）、`pizza-overload`（hot-dog）の既存 3 レシピ。新レシピ・新食材なし。任意のため飛ばしても配置できる。Lunch Rush・Dinner は除外。
- **Phase 2:** `pizza-fritta`（揚げ生地）。§3.7。

### 3.3 プレイヤー操作
TOPPING で対象食材を選ぶ間だけ角のピル「🍤 揚げる」（新タブ・新行なし）→ ステージが一時的に油鍋の画面になる（背面 `inert`）。1 ラウンド 1 回。比較する 2 案（Steam と同じ進め方）:

| 案 | 操作 | 利点 | 懸念 |
|---|---|---|---|
| **A: 2 タップ** | 「あげる」をタップ→泡が変化→「引き上げる」をタップ | 簡単。疲れない。代替入力としても使う | 炒め（タップ時刻当て）と手触りが近い |
| **B: 縦ドラッグ** | 具を**下へドラッグ**して油に沈める→指を離すと沈んだまま→泡を見て、**上へドラッグ**で引き上げ | 能動的。新しい手触り。放して待てるので指で泡が隠れない | 縦ドラッグとページスクロールの競合（ステージは `touch-action:none`＋pointer capture の既存流儀で解決する前提）。疲労は未知 |

B には**必ず A 相当のタップ代替とキーボード（↓／↑）**を付ける。

### 3.4 手掛かり・成功／失敗条件
- **手掛かり（色以外が主）:** 泡の**大きさ**と**勢い**が時間で変わる（最初は大きく激しい→細かく穏やか→ほぼ静か）。ジュワ音の擬音テキスト（任意）。色の進行（生っぽい→きつね色→濃い）は従であり、**ゲージ・数値・残り時間は出さない**。
- **段階の名前（見た目のみ、採点に入れない）:** 生っぽい／カリッと／揚げすぎ。引き上げ時に 1 つ決まる。
- **失敗状態なし**（炙り・蒸すと同じ、Owner が炙りで暫定承認した方針を踏襲）。「揚げすぎ」はピースが濃い色になる**見た目だけ**で、スコア・Dex・Pitz・在庫は一切変えない。早く上げると「生っぽい」見た目。
- **数値は PROVISIONAL**（例: カリッと = 沈めてから 3.5〜6.5 秒、揚げすぎ ≥ 8.5 秒。HV で調整）。**時間は A/B 共通**で、HV の比較用に 3 段（短／標準／長）のスイッチを Preview 限定で用意（Steam の `cookSteamMs` に倣う）。
- テンポ予算: +6〜10 秒／1 回【見込み】。

### 3.5 画面構成（390×844／360×800、新規ファイル中心）
- 上: ミトの一言（1 行）。中: 油鍋（inline SVG＋CSS）、具の待機皿、泡（CSS アニメ）。下: 案 A のボタン 2 つ、または案 B の説明ラベル＋代替ボタン。
- 戻る／やめる（具は未調理のまま置ける）。確定は引き上げ時。置いたピースは**内側 `.ingredient-glyph` に CSS `filter` のみ**で見た目を変える（Steam が実証した、焼成 filter と共存する方法）。`IngredientGlyph.tsx` の SVG は変更しない。
- 縦余白 0px の PREPARE 画面を崩さない（ステージ内に収める）。`dynamic-cooking-steps`／`viewport-1screen` が無修正で通ること。

### 3.6 保存・在庫・採点・識別への影響
| 領域 | 影響 | 根拠／固定方法 |
|---|---|---|
| 状態 | transient `friedLook`（`RESET_PIZZA`で消去）。`pendingRound` journal に載せない | architecture test |
| 保存 | **変更なし**（schemaVersion 2、新キーなし）。`pendingRound` の許可リスト（`id/ingredientId/x/y/stage`）にフィールドを足さない | 既存 sanitizer 無修正 |
| 在庫 | 配置時の消費は従来どおり 1 回。揚げても追加消費・返却なし | 在庫テスト無修正 |
| 採点（Scoring 2.0／Pitz／BEST） | 読まない | architecture test（`logic/scoringV2/**`・`pitzReward.ts` から import 禁止） |
| 識別／Hint／Research／DH4／Dex | 読まない。入力は食材 id のみ | Anti-Oracle 契約 2.1 に抵触しない |
| 技法（Technique） | Phase 1 は**技法化しない**（INV-TQ に触れるため） | O-7 |
| 他の調理法 | 炒め・炙り・蒸すのファイルを変更しない・import しない | 相互参照禁止テスト |

### 3.7 Phase 2 のスケッチ — 揚げ生地 `FRY_COOK`（`pizza-fritta`）
**本書では設計の入口だけ。着手には別の Owner Gate が要る。** 影響が大きい: BAKE の置換（針のゲージ、`FREE_COOK_BAKE_TARGET` 窓、5 段階判定、Scoring 2.0 の Bake 成分）、識別 `cook` 軸の OBSERVED 化（`signature.ts`、matcher、Hint 5.0、DH4 sweep の再実行）、RESULT／Dex の「焼き」文言、`pizza-fritta` の Reference ピザと採点ターゲット、Lunch Rush 除外。Phase 1 の泡の描画・油鍋は流用できるが、**判定器（時刻判定）の再利用度は未確認**【未確認】。lomo-saltado（揚げポテト）は食材 `french-fries` とソース未特定が先。

---

## 4. 段階的実装計画（Production OFF 固定）

| スライス | 内容 | 主に触るファイル | 本番影響 | 前提 |
|---|---|---|---|---|
| F0 | Owner 決定（§6）→ Issue **1 件**作成＋claim（`SESSION-OPERATIONS` §1、期限 14 日以内）。重なり再確認（#738／#746／#748／#696） | docs／GitHub のみ | なし | Owner GO |
| F1 | 純粋層: `fryIngredients.ts`、`logic/fry/*`（共通結果型・A 状態機械・B 状態機械・`friedLook`・offer）、`fryExperienceGate.ts`（`FRY_EXPERIENCE_PRODUCTION = false`）、`preview/fryPreview.ts`、単体＋architecture テスト | **新規ファイルのみ** | なし（未配線、バンドルに入らない） | F0。#738 の merge は不要 |
| F2 | reducer `FRY_INGREDIENT`（任意・transient・ガード＝step／round 種別／在庫所有／フラグ）。`gameReducer.ts` へ**追加のみ** | `gameReducer.ts`（HOT） | フラグ OFF で状態不変 | **#738 merge 後**（HOT 重なり回避） |
| F3 | UI: `FryLayer.tsx`＋`Fry.css`（新規）、`GameScreen.tsx`／`PizzaStage.tsx`／`App.tsx` に追加のみ、Preview 入口 `?cookFry=on`・HV 入口 `?cookFryHv=1`（使い捨てメモリ保存）、A/B 切替 | 新規＋HOT 追加のみ | 本番バンドルに `cookFry*` 文字列なし（ゲートテスト） | F2 |
| F4 | E2E（390×844／360×800、WebKit CI）、HV 動画 1 本（390×844、Owner へ直接提出・commit しない）、前後スクリーンショットを `docs/reports/screenshots/cooking-fry-phase1/` に commit、Result Report | e2e、docs | Preview のみ | F3 |
| F5（別 Gate） | 案 Y の前提: ナスの専用絵 → 対象を eggplant へ拡張 | ingredients／icons | — | B18 の claim 失効後、Icons Gate |
| F6（別 Gate） | `FRY_COOK`／`pizza-fritta` の Design Gate（cook 軸・BAKE 置換・DH4） | docs | — | F4 の HV 結果 |

受け入れ条件（案）: フラグ OFF／対象外食材／Lunch Rush／Dinner で状態・DOM・スコア・在庫・Dex・保存が従来とバイト同一／揚げ結果が採点・識別・Hint・Research・Dex・Pitz・在庫に読まれない／炒め・炙り・蒸すのファイルに差分なし／タップ代替とキーボードで完了できる／タブ数・縦レイアウト不変／全 Vitest・tsc・oxlint・Chromium E2E・WebKit CI pass。
ロールバック: フラグを OFF のままにするだけ。畳む条件: HV で「炒めと同じに感じる」「ドラッグが疲れる」→ B を捨て A のみ。それでも新鮮味が無ければ打ち切り、F6（揚げ生地）の価値を再評価。

---

## 5. iPhone HV 項目（Owner、実機 Safari。WebKit CI は代替にならない）

390×844 を主、360×800 を副。以下を動画で確認:
1. TOPPING で shrimp／hot-dog 選択時にだけピルが出て、他の食材・Lunch Rush・Dinner では出ない。
2. 鍋・待機皿・ボタンが 1 画面に収まり、背面（タブ・トレイ）を誤タップできない。ホームバーと干渉しない。
3. **案 B:** 下ドラッグ中に画面がスクロール・バウンスしない。指を離した後に泡が指で隠れず見える。上ドラッグの引き上げが親指で届く。連続操作で疲れない。タップ代替で同じ結果になる。
4. **案 A:** 2 タップの押し間違いが起きない（ボタン間隔）。
5. 泡の変化だけで「揚がり具合」が分かるか（色を見ずに）。生っぽい／カリッと／揚げすぎの見た目の差が 1 秒で分かるか。
6. 炒め・炙り・蒸すと「同じに感じない」か（Owner の主観判定）。
7. 置いたピースの見た目が焼成後も崩れない（蒸し filter と同様、焼成 filter と共存）。
8. 揚げずに配置しても従来どおり進める。揚げた後に Undo／やり直しで元に戻る。
9. 進行（スコア・星・Pitz・在庫）が揚げの有無で変わらない。
10. 時間 3 段（短／標準／長）のどれが「ちょうどいい」か。

---

## 6. Owner 判断事項

| ID | 論点 | 助言 |
|---|---|---|
| O-1 | Phase 1 の対象: 案 X（shrimp／hot-dog、絵あり・自然さ弱い）か案 Y（ナス絵を先に作る） | X で操作を検証し、絵が整い次第 eggplant へ拡張 |
| O-2 | **新調理法では未実装レシピは基本増えない**（要求行: 揚げ 1・炒め 3、茹で／煮込み／蒸し 0）。目的が「遊べるレシピ数」なら、調理法より食材・ソース（Batch 系）や **F（炒め ON ＋ yakiniku）** の優先度が高い。どちらを優先するか | 揚げる Phase 1 と F は並行可能（触る領域が違う）。ただし F は Session A のデータ領域に近いので、Owner が A に引き渡す |
| O-3 | 4 つ目の独立実装（prep／sear／steam／fry）か、reducer を「調理法の種類」に一般化するか | Steam 計画 U-4 のとおり、一般化は Opus での設計レビューが前提。Phase 1 は独立実装、F2 の前に判断 |
| O-4 | 着手のタイミング: 炒め（OFF）・蒸す（#738 HV 待ち）の実機 HV が未完了。F0／F1 を先に進めてよいか | F1 は新規ファイルのみなので並行可。F2 は #738 merge 後 |
| O-5 | 操作の比較: A／B 両方を実装して HV で選ぶか | 両方（Steam と同じ） |
| O-6 | `FRY_COOK`（揚げ生地）を将来やるか、やるなら `cook` 軸を識別に入れる前提でよいか | F4 の HV 後に判断（今は決めない） |
| O-7 | 名称・ミトの一言・技法として Dex に出すか | Phase 1 は技法化しない（INV-TQ） |
| O-8 | 原典（pizzadb.jp）で揚げ工程のあるレシピを追加確認するか | 現状マトリクス上は `pizza-fritta` のみ。必要なら別の原典確認が先 |

---

## 7. 次に実装できる最小タスク

**F1（純粋層、新規ファイルのみ・未配線・本番 OFF）。** 前提は Owner の GO（O-1／O-3／O-4）と F0（Issue 1 件＋claim）のみ。Session A（Batch 18：`recipes.ts`／`ingredients.ts`／`lateCatalog.ts` ほか）・Session B（Steam #738 の HOT 3 ファイル）の claim 範囲と**ファイルが 1 つも重ならない**。成果物は `fryIngredients`（対象規則＋他 3 法との非交差テスト）、泡の段階・名前の状態機械、A／B の入力モデル、`friedLook`（CSS 変数のみ）、フラグ、architecture test。見積もり規模は Steam S1 と同等【推論】。

## 8. 未確認事項
- 楽しさ・疲労・テンポ・縦ドラッグのスクロール競合は設計上の見込みで、実測していない。
- 「自然な使い先」は一般的な調理知識による推論で、原典の記述ではない。
- 出荷済み／未出荷の対応は id 一致の概算（別名・late 専用レシピの取りこぼしの可能性）。
- Steam S3 の Result・炙りの実機 HV 結果は本書では読んでいない。Session A／B の最新 claim は GitHub のコメント全文まで確認していない（#738・#748 本文のみ）。

## 9. 禁止事項の遵守
ゲーム本体ソース・テスト・データ変更なし／新規調理法の実装なし／Session A（#748 B18）・B（#738 Steam、#747）の PR・ブランチ・claim に触れていない／merge・共有 Preview 更新・Production ON なし／Issue・PR を作っていない（F0 で 1 件のみ、Owner GO 後）。
