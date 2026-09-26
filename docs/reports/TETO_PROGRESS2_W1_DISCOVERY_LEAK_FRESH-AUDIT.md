# Progression 2.0 W1: 25 recipe Discovery Information Leak Fresh Audit

- 種別: **AUDIT ONLY**（docs のみ）。`src/**`、`e2e/**`、CSS、runtime、save schema、data、economy、scoring、CUT、Lunch Rush、CI / workflow は変更していない。PR の作成と merge はしていない。production の実装はしていない。
- 作業 branch: `claude/discovery-2-leak-audit-k3lewn`（`origin/main` `12a09de` から）。I5b-3 / I5b-4 の branch には書き込んでいない。
- 監査の対象にした runtime: **I5b-4 HEAD `fbfd738`**（I5b-3 `5204a26` を含む）。repo の外の scratch worktree（detached）で probe、unit、E2E を実行した。probe 用の script は commit していない。
- 付属データ:
  - `docs/reports/data/TETO_PROGRESS2_W1_DISCOVERY_LEAK_MATRIX.json` … 25 recipe × 画面ごとの漏れ、state 派生、件数、LK-8 の reducer / browser の記録。**runtime authority ではない。**
  - `docs/reports/screenshots/progression2-w1-discovery-leak-audit/` … LK-8 のブラウザ再現の 3 枚（BLOCKER の証拠として必要な分だけ。390×844、Chromium）。

---

## 0. 基準（fresh fetch の結果）

`git fetch origin` の直後（2026-09-25）に確認した。

| 対象 | SHA / 状態 |
|---|---|
| `origin/main` | `12a09de2c4da8ed7e92f1ff9f47dd7bdf824a6e5`（Merge PR #228、I5a）。既知の値と同じ |
| current branch / HEAD | `claude/discovery-2-leak-audit-k3lewn` = `12a09de`。working tree は clean |
| I5b-3 | `5204a269a813bd4951720737ab9799949bca0f0f`（`origin/claude/teto-pizza-w1-i4a-j46ph0` の 1 つ前） |
| I5b-4 | `fbfd738f4ca3e07a59d4bc489f7ab4a6af1b15bd`（`origin/claude/teto-pizza-w1-i4a-j46ph0` の HEAD）。**open PR なし** |
| Discovery / Recipe Dex 2.0 Fresh Design | `a8ef4d9ea954f0c72a4e71936bf2ef66c28774de`（`origin/claude/discovery-recipe-dex-fresh-design-2pp4xn`） |
| 前回 Integration Gate | `05415f6`（`origin/claude/w1-discovery-integration-gate-jovdyc`） |
| I5b-5 Preflight | `b5c7b77`（`origin/claude/i5b-5-verification-preflight-plndos`） |
| open PR | #3、#34、#46、#72、#105（draft）、#204、#205、#208、#209、#211、#213、#214、#217、#218、#219、#220、#221。**I5b-3 / I5b-4 / Design / Gate / Preflight の PR はない** |

I5b-4（`5204a26..fbfd738`）が変えたのは HOME の CTA の並び、Pizza Select のカード名の font（`--name-chars`）、tests、Result doc だけ。**discovery の判定、reducer、order、Shop、Dex には触れていない。** なので漏れの状態は I5b-3 と同じで、本監査は I5b-4 HEAD を最新の runtime として測った。

---

## 1. 結論

1. **25 件すべてで、未発見の recipe について何かしら答えが漏れる（25 / 25）。** そのうち **19 件が BLOCKER**（未発見のまま名前・完成見本・材料の答えを見せ、guided round をそのまま作らせて発見させる）。1 件（margherita）が HIGH、5 件（fugazza、salsiccia、pepperoni、breakfast-pizza、meat-lovers）が MEDIUM。
2. **LK-8 はブラウザで最後まで再現した。** Lunch Rush の RESULT →「フリープレイへ」→ GAME の ORDER に「メランザーネピザ」（未発見）の注文 →「🍕 フリープレイ」→ 見本つきの guided round → 作って焼いて切る →「✨ メランザーネピザを発見しました！」→ HOME「👑 レシピ 5/25」。Free Cooking を一度も通らずに発見できた（Chromium 390×844、`fbfd738`）。reducer では 25 ladder の NEW になる 18 件すべてで同じ連鎖が発見まで通った。**証拠レベル: browser-reproduced。**
3. 前回 Gate の件数は最新 runtime でもそのまま成り立つ: Pizza Select の NEW カード 18 / 24 key recipe、Shop の「これを買うと」16 行、Dex 0 の LOCKED カードの名前 23 枚。**Dex と HOME は、どの state でも未発見の名前を出さない（0 件）。**
4. **新しい finding が 7 件**ある（§6）。重いのは次の 3 つ:
   - Pizza Select の LOCKED カードの解放 hint（「フガッサを1枚完成させると解禁」）が、**mysteryLock で ？？？ にしている fugazza の名前を別のカード（salsiccia）から出している**。
   - `isRecipeAvailable` は在庫を見ないので、**在庫 0 の recipe でも NEW カードと LK-8 の注文が出る**（名前と見本は漏れるが、作れないので発見はできない）。
   - guided round の tray は**その recipe の必要材料だけを出す**（Issue #159）。見本 popover は「モッツァレラ2個とナス3個とバジル2個」と個数まで出す。guided に入った時点で L3 の答えが完全に出る。
5. **state 派生（DISCOVERED / DISCOVERABLE / KNOWN_BUT_MISSING_MATERIAL / UNKNOWN）は Gate の定義のままで作れる。** 新規 save の ladder を歩くと DISCOVERABLE ≤ 1、KBMM ≤ 1、matcher signature の重複は 0 で、Gate と同じ。ただし **legacy save では成り立たない**: Dex 15 の旧 save で eggplant / corn / pineapple を買うと DISCOVERABLE は 6。「≤ 1」を UI の前提にしてはいけない。
6. **判定: READY**（Discovery の実装計画を決めるための監査資料として足りている）。production の実装を始めてよい、という意味ではない。LK-8 と `SELECT_RECIPE` の迂回は UI だけでは塞げないので、reducer の契約（§5.3）を計画に入れる必要がある。

---

## 2. 方法

### 2.1 Runtime probe（scratch、commit していない）

`fbfd738` の scratch worktree で、vitest + jsdom から**本物の** component と reducer を動かした。

- render した component: `PizzaSelectScreen`、`ShopOverlay`、`DexOverlay`、`HomeScreen`。
- 呼んだ関数: `gameReducer`（`createInitialGameState`、`PLAY_AGAIN`、`SELECT_RECIPE`、`BEGIN_PREPARE`〜`REGISTER_TO_DEX`、`RETRY_SAME_RECIPE`）、`pickMissionOrder`、`recipeCardState`、`recipesUnlockedByIngredient`、`resolveShopEntitlement`、`loadSave`、`evaluateDiscovery`、`buildHintLine`、`buildTetoOrderLine`。
- DOM の走査: `textContent`（`display:none` の subtree も含む）と、`aria-label` / `title` / `alt` / `placeholder` / `value` / `data-*` の属性。材料名と recipe 名がぶつかる箇所（`ペパロニ`、`ジェノベーゼソース`、description の「ナポリ生まれ」）は、材料名の node を外してから数えた（§6 の注記）。
- 注文の候補: `Math.random` を 60 通りに固定して、`PLAY_AGAIN` と初期 state が選ぶ recipe をすべて集めた。
- 見た state: 新規 ladder の Dex 0〜25 について「A: 入荷した直後で未購入」と「B: 購入して在庫 10」の 50 件。legacy の 9 件（fresh save、Dex 1、Dex 15 legacy、Dex 15 legacy で 3 材料を購入済み、Dex 23、Dex 24、在庫 0、入荷済みで未所持、所持しているが未発見）。legacy は `loadSave` →`resolveShopEntitlement` という App と同じ読み込み経路を通した。★ はすべて 3。

### 2.2 Browser（Playwright Chromium 390×844、scratch spec）

`fbfd738` の `vite dev` を立ち上げ、localStorage に Dex 4 の save（margherita / bismarck / breakfast-pizza / funghi を発見済み、eggplant を所持して在庫 10）を入れた。`?missionDuration=3` で Lunch Rush を 3 秒にした。

1. **LK-8:** ランチラッシュ → スタート → 時間切れの RESULT →「フリープレイへ」→ ORDER → 「フリープレイ」→ 見本の popover → 本物の gesture で生地・ソース・チーズ・具・焼き・カット → RESULT → HOME。
2. **LK-8b:** HOME → フリークッキング → 何もせずに ホーム → ランチラッシュ → intro の「閉じる」→ GAME。
3. Pizza Select と Dex の DOM dump。

### 2.3 Leak の分類と severity

| 分類 | 意味 |
|---|---|
| L1 NAME | 未発見の recipe の名前 |
| L2 IMAGE | 完成見本 / 完成 pizza の thumbnail |
| L3 INGREDIENT ANSWER | 必要な材料の組み合わせ（個数を含む） |
| L4 ORDER ANSWER | 注文として名前と見本を出し、そのまま作らせる |
| L5 UNLOCK ANSWER | 「この材料を買うと ○○」 |
| L6 NAVIGATION BYPASS | Free Cooking を通らずに、未発見の recipe の guided round に入れる |
| L7 INDIRECT | hint、注記、aria、hidden DOM などから実質的に分かる |

| severity | 基準 |
|---|---|
| BLOCKER | 答えを見せたうえで、そのまま発見まで進める（L4 / L6 が成立する） |
| HIGH | 名前と答え（L2 / L3 / L5）を見せるが、それだけでは発見にならない |
| MEDIUM | 名前だけ（L1）や、間接的に recipe を特定できるもの |
| LOW | 見えている文言の重複（aria）、名前を含まない注記、UI から届かない code 上の経路 |

「発見した瞬間より後」に名前を出すのは漏れに数えない（RESULT の banner、Dex の発見済みカード、Lunch Rush の注文）。内部の JS object にあるだけのものも数えない。

---

## 3. 25 recipe matrix（要約）

全部の列は JSON の `recipes[]`。`●` = 漏れあり、`—` = なし。ladder は 25 ladder の step（margherita は 0）。「最初の迂回」は、新規 ladder で迂回が最初に起きる state。

| # | recipe | step | PS 名前 | PS 見本 | PS 迂回 | Shop L5 | FREE / LR→FREE | hint | aria | 最大 | 最初の迂回 |
|---|---|---:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---|---|
| 1 | margherita | 0 | ● | ● | — | — | code のみ | ● | ● | HIGH | —（Dex 0 は Free Cooking に送る） |
| 2 | marinara | 14 | ● | ● | ● | ● | ● | ● | ● | BLOCKER | Dex 14 B |
| 3 | quattro-formaggi | 24 | ● | ● | ● | — | ● | ● | ● | BLOCKER | Dex 24 B |
| 4 | genovese | 18 | ● | ● | ● | ● | ● | ● | ● | BLOCKER | Dex 18 B |
| 5 | bismarck | 1 | ● | ● | ● | — | ● | ● | ● | BLOCKER | legacy Dex 23（新規 ladder では EP1 で LOCKED） |
| 6 | funghi | 3 | ● | ● | ● | ● | ● | ● | ● | BLOCKER | Dex 3 B |
| 7 | fugazza | 13 | —（？？？） | — | — | — | — | ● | — | MEDIUM | —（salsiccia の hint が名前を出す、F-09） |
| 8 | salsiccia | 7 | ● | — | — | — | — | ● | ● | MEDIUM | — |
| 9 | pepperoni | 6 | ● | — | — | — | — | ● | ● | MEDIUM | — |
| 10 | napoletana | 15 | ● | ● | ● | ● | ● | ● | ● | BLOCKER | Dex 15 B |
| 11 | tonno-e-cipolla | 16 | ● | ● | ● | ● | ● | ● | ● | BLOCKER | Dex 16 B |
| 12 | pizza-bianca | 22 | ● | ● | ● | ● | ● | ● | ● | BLOCKER | Dex 22 B |
| 13 | breakfast-pizza | 2 | ● | — | — | — | — | ● | ● | MEDIUM | — |
| 14 | capricciosa | 11 | ● | ● | ● | — | ● | ● | ● | BLOCKER | Dex 11 B |
| 15 | meat-lovers | 8 | ● | — | — | — | — | — | ● | MEDIUM | — |
| 16 | melanzane-pizza | 4 | ● | ● | ● | ● | ● | ● | ● | BLOCKER | Dex 4 B（**browser で再現**） |
| 17 | parmigiana-pizza | 5 | ● | ● | ● | ● | ● | ● | ● | BLOCKER | Dex 5 B |
| 18 | bambino | 9 | ● | ● | ● | ● | ● | ● | ● | BLOCKER | Dex 9 B |
| 19 | hawaiian | 10 | ● | ● | ● | ● | ● | ● | ● | BLOCKER | Dex 10 B |
| 20 | pizza-portuguesa | 12 | ● | ● | ● | ● | ● | ● | ● | BLOCKER | Dex 12 B |
| 21 | pesto-tonno | 17 | ● | ● | ● | ● | ● | ● | ● | BLOCKER | Dex 17 B |
| 22 | new-haven-apizza | 19 | ● | ● | ● | ● | ● | ● | ● | BLOCKER | Dex 19 B |
| 23 | pesto-caprese | 20 | ● | ● | ● | ● | ● | ● | ● | BLOCKER | Dex 20 B |
| 24 | pesto-patate | 21 | ● | ● | ● | ● | ● | ● | ● | BLOCKER | Dex 21 B |
| 25 | puttanesca-pizza | 23 | ● | ● | ● | ● | ● | ● | ● | BLOCKER | Dex 23 B |

- 発見前から発見済みの recipe はない（`discoveredAtStart` はすべて false）。
- Dex と HOME の列は 25 件すべて「—」なので表から省いた（JSON にはある）。
- 新規 ladder で NEW にならない 6 件（bismarck、breakfast-pizza、pepperoni、salsiccia、meat-lovers、fugazza）は、EP1 の chain と ★ でまだ閉じているだけ。★ の取り方が変われば NEW になり、BLOCKER の対象になる。bismarck は legacy の Dex 23 save で実際に NEW になった。**BLOCKER の潜在的な上限は 24 件**（margherita は Dex 0 で別扱いなので除く）。

---

## 4. 画面ごとの監査

### 4.1 Pizza Select（`src/state/pizzaSelect.ts`、`src/screens/PizzaSelectScreen.tsx`）

| 項目 | 実測（`fbfd738`） |
|---|---|
| recipe 名 | 未発見のうち **24 / 25** が、どこかの state で名前を出す。例外は fugazza（mysteryLock で ？？？）だけ。Dex 0 では LOCKED 23 枚 + margherita の NEW カード 1 枚 |
| thumbnail / 見本 | NEW カードは `PizzaThumbnail`（完成 pizza の具の配置）を出す。**20 件**（NEW 18 + bismarck（legacy）+ margherita（Dex 0 の `preDiscoveryLocked`）） |
| locked カード | 🔒 の silhouette で見本は出ない。名前は出る（mystery を除く） |
| NEW カード | badge「NEW」+ 名前 + 見本 + 「未挑戦」。詳細の CTA「🍕 このピザを作る！」が押せる |
| 章 | 位置で 7 / 8 / 8 / 2。章の見出しは recipe を示さない（漏れなし） |
| lock の文言 | `unlockHintFor` が「○○を1枚完成させると解禁」「あと★Nで解禁」を出す。**○○は未発見の recipe の名前**。Dex 0 で 13 件の名前が hint に出る。salsiccia の hint は「フガッサを1枚完成させると解禁」で、mysteryLock の意味がなくなる（F-09） |
| aria-label | `名前、状態`。見えている名前と同じ（AT だけの漏れはない）。詳細 panel、見本 button も同じ |
| title / alt / data-* | 名前は入っていない。`style="--name-chars:N"` は表示名の文字数だけ（mystery は 3） |
| hidden DOM | 詳細を開いている間、grid は `display:none` のまま mount されている。中身は見えている grid と同じ |
| click handler | LOCKED カードも詳細は開ける。CTA は `disabled`。NEW（`preDiscoveryLocked`）の CTA は Free Cooking へ行く |
| `SELECT_RECIPE` | Dex ≥ 1 なら、未発見でも available（EP1 解放 + 材料を**所持**）なら guided の PREPARE に入る。**19 件で発見まで通る**（reducer）。Dex 0 では no-op。LOCKED（材料を持っていない）は no-op |
| `BEGIN_PREPARE` | guard なし。FREE の ORDER state にある recipe をそのまま guided にする（LK-8 の入口） |

**UI で隠すだけでは足りない:** `SELECT_RECIPE` は Dex 0 だけを見ていて、`isDiscovered` を要求しない（`gameReducer.ts:1199`〜）。LK-8 は Pizza Select を通らない。

### 4.2 Shop（`src/components/ShopOverlay.tsx`）

| 項目 | 実測 |
|---|---|
| NEW 材料の行「これを買うと: 🍕 ○○」 | **16 行 / 16 recipe**（新規 ladder）: mushroom→フンギ、eggplant→メランザーネピザ、parmigiano→パルミジャーナピザ、corn→バンビーノ、pineapple→ハワイアンピザ、onion→ピッツァ・ポルトゲーザ、garlic→マリナーラ、anchovy→ナポリ、tuna→トンノ・エ・チポッラ、pesto→ペストトンノピザ、cherry-tomato→ジェノベーゼ、clam→ニューヘイブンアピッツァ、fresh-tomato→ペストカプレーゼピザ、potato→ペストパターテピザ、rosemary→ピッツァ・ビアンカ、capers→プッタネスカ |
| 2 材料の step | black-olive + oregano（capricciosa）と fontina + gorgonzola（quattro-formaggi）は、1 つだけ買っても完成しないので名前が出ない |
| legacy Dex 15 | eggplant の行が「メランザーネピザ、パルミジャーナピザ」の 2 件を出す。corn → バンビーノ、pineapple → ハワイアンピザ |
| 購入後「🍕 新しいピザが作れます！「○○」」 | 行と同じ helper なので、同じ 16 件 |
| ingredient の説明 | Shop には説明文がない（漏れなし） |
| 「あとN つ発見で新しい材料が入荷」 | 名前なし |
| aria / title / hidden | 名前なし。`data-ingredient-id` / `data-shop-state` は材料だけ |
| recipe の一覧 | Shop にはない |

前回の「NEW 材料 16 件」は 25 recipe の runtime でも **16 件（CONFIRMED）**。

### 4.3 Dex（`src/components/DexOverlay.tsx`）

Dex 0 / 1 / 途中 / legacy Dex 15 / Dex 23 / Dex 24 / Dex 25 を含む 59 state のすべてで、未発見の枠は `🔒 ？？？ まだ見ぬピザ` だけだった。**名前、画像、材料、章、発見方法、lock の理由は 0 件。** aria / title / hidden にも名前はない。

- 発見済みの枠の説明文と材料の中に、未発見の recipe 名と同じ文字列が出ることはある（marinara の「ナポリ生まれ」、pesto-* の「ジェノベーゼソース」）。これは材料名や地名で、recipe を指していないので漏れには数えない（§6 の注記）。
- 前回 Audit の「Dex 0 で 23 LOCKED cards が名前を表示」は **Pizza Select の話**で、Dex overlay ではない。最新でも Pizza Select では 23 枚が名前を出す（§4.1）。

### 4.4 HOME（`src/screens/HomeScreen.tsx`）

CTA（2+1）、吹き出し（Dex 0 / それ以外 の 2 文）、「👑 レシピ n/25」、menu の sub 文言、footer のどれにも recipe 名はない。next unlock、NEW badge、次の recipe、おすすめは HOME にそもそも無い。**0 件。** I5b-4 の 2+1 は漏れに関係しない。

### 4.5 Result（`src/components/ResultPanel.tsx`、`GameScreen.tsx`）

| 項目 | 表示のタイミング | 判定 |
|---|---|---|
| 「NEW PIZZA! ✨ ○○を発見しました！」/「✨ ○○を発見しました！」 | `REGISTER_TO_DEX` / matcher の NEW_DISCOVERY の後 | 発見後なので OK |
| 「📖 ○○ができた！（発見済み）」 | 発見済みだけ | OK |
| 入荷 notice「🆕 新しい材料が入荷：○○」 | 発見の後 | 材料名だけ。recipe 名はない |
| ORIGINAL の near-miss「図鑑のピザまであと少し…！ソースや焼き加減を変えてみよう。」 | Free Cooking で材料の集合は一致したが Completion が足りないとき | 名前はないが「今の材料の組み合わせは図鑑のピザ」と分かる（L7、LOW、F-13） |
| 「もう一度つくる」 | guided の後 | `RETRY_SAME_RECIPE` は同じ recipe の guided をもう一度始める。**未発見のまま FAILED した guided round でも同じ**（F-14） |
| 「別のピザを作る」 | — | Pizza Select へ（§4.1 の漏れに入る） |
| 次の注文 / replay | FREE の RESULT に「次の注文」はない | Lunch Rush の RESULT の「フリープレイへ」が LK-8 の入口（§5） |
| Teto の RESULT / BAKE の台詞 | guided round の中 | 名前を出す。guided に入った時点（= 迂回）で既に漏れている |

### 4.6 FREE Cooking と注文（最重要）

| 項目 | 実測 |
|---|---|
| Free Cooking の round（`START_FREE_COOK`） | recipe なし。見本なし。tray は所持している材料全部（在庫 0 は disabled）。hint は材料名を出さない（Dex 0 の Level 1〜3 を除く） → **漏れなし** |
| 初期 state（`createInitialGameState`） | `preferFirst` で margherita の ORDER。Dex ≥ 1 では margherita は発見済みなので漏れない。Dex 0 では未発見の margherita だが、UI から GAME の ORDER には入れない（Lunch Rush が LOCKED）。**code-confirmed / UI-unreachable**（F-16） |
| `getNextOrder`（`orders.ts:206`〜） | available のうち**未発見を優先**。available は EP1 解放 + 材料所持で、在庫は見ない。候補が 0 件のときは ORDERS 全体に戻る |
| `nextOrderState` / `PLAY_AGAIN` | 新規 ladder の B（購入後）の 18 state すべてで、候補は**未発見の key recipe 1 件だけ**（確率 100%）。legacy Dex 15 + 3 材料購入では未発見 6 件から選ぶ |
| ORDER の画面 | ミトの注文（`order.lineJa`。名前 + 材料の一部。例「ナスがのったメランザーネピザが食べたいな！バジルの香りもお願いね！」）+ テトの台詞（名前）+「🍕 フリープレイ」 |
| guided の PREPARE | `order-card` に名前、hint、mini 見本（具の絵）、「見本」button（aria-label「○○の見本を拡大表示」）。popover は「トマトソースをまんべんなく塗って、モッツァレラ2個とナス3個とバジル2個を見本に近く置こう。」 |
| tray | guided では**その recipe の必要材料だけ**を出す（Issue #159）。ブラウザ実測: ソース［トマトソース］、チーズ［モッツァレラ］、具［バジル、ナス］ |
| hint | `RECIPE_HINTS` があるのは 6 件だけ。他は fallback `${材料名}をのせてみよう！` で、足りない材料の名前を出す |
| result への遷移 | `REGISTER_TO_DEX` が `registerScoreToDex(state.recipe.id)` で**選んだ recipe を発見として登録**する。matcher を通らない |

### 4.7 Lunch Rush → FREE

- Lunch Rush 自体の注文は `pickMissionOrder` で**発見済み ∩ available** に絞られている（59 state すべてで未発見 0 件）。
- 出るときに `exitMissionToFree`（`App.tsx:551`）が `EXIT_TO_FREE` + `PLAY_AGAIN` を呼ぶ。`PLAY_AGAIN` は FREE の `nextOrderState` なので、未発見を優先する。入口は 3 つ:
  1. RESULT overlay の「フリープレイへ」→ GAME にそのまま ORDER が出る（**LK-8、browser で再現**）。
  2. PLAYING 中に「ホーム」→ confirm → `exitMissionToFree` → ORDER が state に残る → 次に Lunch Rush の intro を「閉じる」と出る。
  3. FREE の PREPARE / BAKE から「ホーム」→ `PLAY_AGAIN` → ORDER が残る → intro の「閉じる」（`EXIT_TO_FREE` だけで `PLAY_AGAIN` しない）で出る（**LK-8b、browser で再現**。Free Cooking を開いてすぐ ホーム、だけで起きる）。
- どれも Dex ≥ 1（Lunch Rush の解放）が条件。19 件（NEW 18 + bismarck）が対象。

### 4.8 Hints / EP1

| helper | 使っている UI | 漏れ |
|---|---|---|
| `unlockHintFor`（`pizzaSelect.ts:29`） | Pizza Select の LOCKED カード | 未発見の前提 recipe の名前（13 件）。chain は 25 ladder と合わない（誤誘導、Design LK-3）。fugazza の名前を salsiccia の hint が出す（F-09） |
| `recipesUnlockedByIngredient`（`progression.ts:106`） | Shop の行と購入後の文言 | L5、16 件 |
| `RECIPE_HINTS` / `buildHintLine` | guided の PREPARE、「ヒント」 | 材料名（L3）。guided に入れる 19 件で |
| `FREE_COOK_DISCOVERY_HINT_LEVELS` | Dex 0 の Free Cooking だけ | Level 3 で margherita の答え（LK-6）。Design が onboarding の例外として認めたもの。**漏れには数えない** |
| `nextMaterialHint` | Shop | 件数だけ。名前なし |

**EP1 の state は save にない（再確認）。** `PersistentSaveV2`（`persistence.ts:114`）の key は `schemaVersion`、`dex`、`pitzBalance`、`ownedIngredientIds`、`missionBest`、`inventory`、`starterGrantClaimedRecipeIds`、`unlockedForShopIngredientIds` だけ。EP1 の解放は毎回 `dex` から派生する。runtime の data（`unlockCondition` / `mysteryLock`）を消さなくても、UI から呼ばなければ漏れは止まる。

### 4.9 Persistence / legacy save

| save | 読み込み後の state（D / DA / KBMM / U） | 漏れの変化 |
|---|---|---|
| fresh save（Dex 0） | 0 / 1 / 0 / 24 | Pizza Select の名前 24、margherita の見本。Shop 0 |
| Dex 1（margherita のみ） | 1 / 0 / 1 / 23 | 名前 23。egg が NEW |
| Dex 15 legacy（旧 15 件、旧材料すべて所持） | 15 / 2 / 4 / 4 | load で eggplant / corn / pineapple が NEW（在庫 0）。**load した時点で** Shop が 4 件の名前（melanzane、parmigiana、bambino、hawaiian）を出し、Pizza Select が 2 件（pizza-portuguesa、pesto-tonno）を NEW にする。LK-8 の候補は 2 件 |
| Dex 15 legacy + 3 材料購入 | 15 / **6** / 0 / 4 | NEW カード 6 枚、LK-8 の候補 6 件 |
| Dex 23 | 23 / 1 / 0 / 1 | bismarck が NEW（新規 ladder では出ない形） |
| Dex 24 | 24 / 1 / 0 / 0 | quattro-formaggi が NEW + LK-8 |
| 在庫 0（Dex 4、eggplant 所持で在庫 0） | 4 / 0 / 1 / 20 | **melanzane は KBMM なのに NEW カードと LK-8 の注文が出る。** guided は FAILED（MISSING_REQUIRED_INGREDIENT eggplant）で発見にはならない（F-15） |
| 入荷済みで未所持（Dex 4 A） | 4 / 0 / 1 / 20 | Shop の eggplant 行が「メランザーネピザ」 |
| 所持しているが未発見（Dex 3 + 旧 save で 5 材料所持） | 3 / 5 / 0 / 17 | NEW カード 5 枚、LK-8 の候補 5 件 |

migration（`resolveShopEntitlement`）が**新しく**名前を出す場所を作ることはない。ただし、load した直後から Shop と Pizza Select の既存の漏れ（LK-5、LK-1）に乗る。load 時の notice は出ない（Gate と同じ）。

### 4.10 Accessibility / DOM

- aria-label で名前を持つのは Pizza Select のカード（24 件）、詳細 panel、guided の見本 button。**すべて見えている文字と同じで、AT だけの漏れは 0 件**。
- `title`、`alt`、`aria-describedby`、visually-hidden、`select` / `option` は、どの画面にも recipe 名がない（HOME の `alt` は「ミト / テト / ブルー」だけ）。
- `data-*` は材料の id と Shop の状態だけ。recipe の id は DOM にない。
- hidden DOM: Pizza Select の詳細を開いている間の grid（`display:none`）だけ。中身は見えている grid と同じ。
- `document.title` は固定。URL の query は `missionDuration` だけで、recipe を選べる query はない。rt01 の harness（全 recipe を描く）は production build に入らない（`vite.config.ts` は `index.html` だけ）。

---

## 5. LK-8（独立セクション）

### 5.1 状態

| 項目 | 内容 |
|---|---|
| current status | **CONFIRMED / OPEN**。Gate `05415f6` は code-confirmed（実機の再現なし）だった。本監査で **browser-reproduced**（end-to-end で発見まで）+ reducer で 18 / 18（+ legacy の bismarck）に上げた |
| 入口（UI から届く） | ① Lunch Rush RESULT の「フリープレイへ」② Lunch Rush の intro の「閉じる」（前に ORDER が残っているとき）③ Lunch Rush PLAYING 中の「ホーム」→ ②。②の前提は FREE の PREPARE / BAKE から「ホーム」でもよい |
| 入口（code だけ） | Dex 0 の初期 state（margherita の ORDER）+ `BEGIN_PREPARE`。Lunch Rush が LOCKED なので UI からは届かない |
| 必要な state | Dex ≥ 1（Lunch Rush の解放）かつ、未発見で「EP1 解放 + 必要な材料をすべて**所持**」の recipe が 1 件以上。在庫は条件に入らない（在庫 0 でも名前と見本は出る。発見はできない） |
| 例 | Dex 4（margherita、bismarck、breakfast-pizza、funghi）+ eggplant 所持 → メランザーネピザ |
| 名前は見えるか | **見える。** ミトとテトの 2 行（ORDER）、PREPARE の order-card、見本 popover の見出し、BAKE / RESULT の台詞 |
| 見本は見えるか | **見える。** mini 見本（常時）+ popover（個数つきの文章） |
| 材料は見えるか | **見える。** tray に必要材料だけが出る。hint が足りない材料を名前で言う。ミトの注文にも材料の一部 |
| 発見まで進めるか | **進める。** ブラウザで「✨ メランザーネピザを発見しました！」「👑 レシピ 5/25」、Pitz +100、次の材料（パルミジャーノ）の入荷 notice まで出た |
| reducer は止めるか | **止めない。** `PLAY_AGAIN` / `BEGIN_PREPARE` / `REGISTER_TO_DEX` のどこにも未発見の guard がない |
| UI だけで防げるか | **防げない。** 入口は RESULT overlay、intro の「閉じる」、HOME の 3 つにあり、ORDER の state は reducer が作る。どれか 1 か所の UI を変えても、残っている ORDER と `BEGIN_PREPARE` は通る |

### 5.2 関数の連鎖（`fbfd738`）

```
MissionResultOverlay「フリープレイへ」 (MissionResultOverlay.tsx:106 onExit)
  → App.exitMissionToFree (App.tsx:551): missionDispatch EXIT_TO_FREE + dispatch PLAY_AGAIN
  → gameReducer PLAY_AGAIN (gameReducer.ts:1184) → nextOrderState (:472)
      availableRecipeIds(dex, owned)  … EP1 + 所持。在庫は見ない (progression.ts:80)
  → getNextOrder (orders.ts:206): pool のうち未発見を優先
  → buildOrderState(order, carry, isMissionRound=false) → phase ORDER
  → GameScreen ORDER: mitoOrderLine(order.lineJa) + buildTetoOrderLine(recipe) + [🍕 フリープレイ]
  → onBeginPrepare → BEGIN_PREPARE (:593)（guard なし）→ guided PREPARE
      order-card（名前 + mini 見本）、ReferencePreview / PlayerReferencePreview、
      IngredientTray（recipe.requiredIngredients だけ）、buildHintLine（RECIPE_HINTS / fallback）
  → … CONFIRM_BAKE → (CUT) → RESULT
  → REGISTER_TO_DEX (:1062) → registerScoreToDex(dex, state.recipe.id, score) → wasNewDiscovery
     + resolveShopEntitlement（次の材料が入荷）

LK-8b: App.handleGoHome (FREE, PREPARE/BAKE) → PLAY_AGAIN → ORDER が残る
       → handleStartLunchRush → SHOW_INTRO → 「閉じる」 = missionDispatch EXIT_TO_FREE だけ
       → GameScreen が残った ORDER を出す
```

### 5.3 推奨する契約の境界（修正はしていない）

Gate の W1-a backstop（3 か所）を、今回の実測に合わせて具体化する。**UI ではなく reducer / order の層に置く。**

1. **FREE の注文 pool は「発見済み ∩ available」**（`pickMissionOrder` と同じ規則）。`nextOrderState`（初期 state を含む）と `getNextOrder` の「未発見を優先」をやめる。pool が空なら ORDERS 全体に戻さない（fail closed。Dex 0 は ORDER を作らない、または Free Cooking に送る）。
2. **非 Mission の guided round は発見済みの recipe だけ**: `BEGIN_PREPARE`（`isMissionRound === false`）、`SELECT_RECIPE`（Dex の件数に関係なく `isDiscovered` を要求）、`RETRY_SAME_RECIPE`（freeCook でないとき）。
3. **発見の登録は matcher だけ**: `REGISTER_TO_DEX` の `registerScoreToDex(state.recipe.id)` が `wasNewDiscovery` を作れるのは、1. と 2. が守られているとき「発見済みの recipe の BEST 更新」だけになる。これを unit で固定する（「guided round から `wasNewDiscovery` が true にならない」）。
4. 「available」と「DISCOVERABLE」を分ける: 在庫 0（KBMM）を NEW / 注文の候補にしない（F-15）。state 派生（§7）を 1 か所に置き、Pizza Select / Shop / 注文が同じ関数を読む。
5. test: Lunch Rush →「フリープレイへ」→ ORDER の recipe が発見済みであること（reducer の列と E2E の両方）。LK-8b（intro の「閉じる」）も。

---

## 6. Findings 一覧

**unique finding: 16 件**（F-01〜F-16）。recipe × 画面の漏れ（JSON の severity が NONE でない列）: **146 件**。

| ID | 分類 | severity | 画面 / 経路 | 影響 recipe | 証拠 | Cross-check |
|---|---|---|---|---:|---|---|
| F-01 | L4 + L6（+L1/L2/L3） | **BLOCKER** | LK-8: Lunch Rush RESULT「フリープレイへ」→ 未発見の ORDER → guided → 発見 | 19 | browser（melanzane）+ reducer 18/18 + legacy | CONFIRMED（証拠を code → browser に更新） |
| F-02 | L4 + L6 | **BLOCKER** | LK-8b: ORDER が残ったまま Lunch Rush の intro「閉じる」（FREE の PREPARE から ホーム でも作れる） | 19 | browser | CONFIRMED（同上） |
| F-03 | L1 + L2 + L6 | **BLOCKER** | LK-1 / LK-7: Pizza Select の NEW カード（名前 + 見本 + 「このピザを作る！」）、`SELECT_RECIPE` が Dex ≥ 1 で未発見を許す | 19（新規 ladder 18） | runtime probe、browser の DOM dump | CONFIRMED |
| F-04 | L3 | HIGH | LK-2: guided round の答え（見本 popover の個数、mini 見本、**tray が必要材料だけ**、hint、ミトの注文の材料） | 19 | browser（tray の実測）+ code | CONFIRMED + NEW（tray と popover の個数） |
| F-05 | L5 | HIGH | LK-5: Shop の NEW 行「これを買うと: 🍕 ○○」 | 16（行 16） | runtime probe | CONFIRMED |
| F-06 | L5 | HIGH | LK-5: 購入後「🍕 新しいピザが作れます！「○○」」 | 16 | runtime probe（rerender） | CONFIRMED |
| F-07 | L1 | MEDIUM | LK-3: Pizza Select の LOCKED カードの名前 | 23（Dex 0） | runtime probe | CONFIRMED |
| F-08 | L1 + L7 | MEDIUM | LK-3: `unlockHintFor` の「○○を1枚完成させると解禁」が未発見の recipe を名指し（25 ladder と矛盾） | 13 | runtime probe | CONFIRMED |
| F-09 | L1 + L7 | MEDIUM | salsiccia の hint「フガッサを1枚完成させると解禁」が、mysteryLock の fugazza の名前を出す | 1 | runtime probe | **NEW** |
| F-10 | L1 + L2 | MEDIUM | LK-4: Dex 0 の margherita カード（名前 + 見本）。CTA は Free Cooking へ行くので迂回はない | 1 | runtime probe | CONFIRMED |
| F-11 | L7 | LOW | aria-label が名前を持つ（カード、詳細、見本 button）。見えている文字と同じ | 24 | runtime probe、browser | **NEW**（分類の追加。AT だけの漏れは 0） |
| F-12 | L7 | LOW | 詳細を開いている間、grid が `display:none` で残る | F-07 と同じ | code | **NEW**（重複） |
| F-13 | L7 | LOW | Free Cooking の INCOMPLETE_MATCH の文言が、今の材料の組み合わせが図鑑のピザだと教える（名前なし） | —（recipe を特定しない） | code | **NEW** |
| F-14 | L6 | MEDIUM | `RETRY_SAME_RECIPE` が、未発見のまま FAILED した guided round を同じ recipe でやり直させる | 19（F-01/F-03 の後） | reducer probe | **NEW** |
| F-15 | L1 + L2 + L4 | MEDIUM | `isRecipeAvailable` が在庫を見ないので、在庫 0（KBMM）でも NEW カードと LK-8 の注文が出る。発見はできない | 状態依存（例: melanzane） | reducer probe（FAILED を確認） | **NEW** |
| F-16 | L4 | LOW | Dex 0 の初期 state が margherita の ORDER を持ち、`BEGIN_PREPARE` で発見まで通る。UI からは届かない | 1 | reducer probe | **NEW**（code-confirmed / UI-unreachable） |
| （除外） | — | — | LK-6: Dex 0 の Free Cooking hint Level 3 | 1 | — | 意図された例外。数えない |
| （注記） | — | — | 名前の衝突: 材料 `ペパロニ` = recipe 名、材料 `ジェノベーゼソース` ⊃ `ジェノベーゼ`、description の「ナポリ生まれ」 ⊃ `ナポリ` | — | — | recipe を指していないので漏れに数えない。Shop の購入後文言の probe で出た偽陽性（pepperoni、genovese）はこれで説明がつく |

---

## 7. State 派生（再検証）

Gate `05415f6` §3.1 の定義をそのまま使った（Design の「UNKNOWN」は UI では「LOCKED」）。入力は `dex`、`ownedIngredientIds`、`unlockedForShopIngredientIds`、`inventory` の 4 つだけ。

| 検証 | 結果（`fbfd738`） |
|---|---|
| 新規 ladder（Dex 0〜25 × A / B） | **DISCOVERABLE ≤ 1、KBMM ≤ 1**。A では次の key recipe が KBMM、B では DISCOVERABLE。Dex 25 は全部 DISCOVERED。Gate と同じ |
| matcher の signature の重複 | **0**。25 件すべてで、自分の材料の集合が `NEW_DISCOVERY` になる |
| legacy Dex 15 | DISCOVERABLE 2 / KBMM 4（Gate と同じ）。**3 材料を買うと DISCOVERABLE 6** |
| 所持しているが未発見（人工的な旧 save） | DISCOVERABLE 5 |
| 在庫 0 | KBMM（`isRecipeAvailable` の「available」とは食い違う。F-15） |
| save schema | 追加なし。4 入力は `PersistentSaveV2` に既にある |

→ **「DISCOVERABLE 最大 1」は新規 ladder だけの性質で、全体の不変条件ではない**（NEW の注記）。Pizza Select の prompt カードや HOME の文言は「DISCOVERABLE が複数」を扱える必要がある。

---

## 8. Answer Leak Count

### 8.1 画面ごと（unique recipe、/ 25）

| 画面 | 分類 | unique recipe | 補足 |
|---|---|---:|---|
| Pizza Select | NAME | **24** | Dex 0 の LOCKED 23 + margherita。fugazza だけ ？？？ |
| Pizza Select | IMAGE | **20** | NEW 18 + bismarck（legacy）+ margherita（Dex 0） |
| Pizza Select | BYPASS（`SELECT_RECIPE`） | **19** | NEW 18 + bismarck（legacy） |
| Pizza Select | lock hint で名前 | **13** | fugazza を含む（F-09） |
| Shop | UNLOCK ANSWER（行 / 購入後） | **16** | 行は 16。legacy でも増えない（同じ 16 件の中） |
| Shop | NAME（L5 の行以外） | 0 | |
| Dex | NAME / IMAGE / INGREDIENTS | 0 / 0 / 0 | |
| HOME | NAME | 0 | |
| Result | 発見前の NAME | 0 | near-miss の L7 が 1（recipe を特定しない） |
| FREE | ORDER ANSWER（UI から届く） | **19** | + code だけ 1（margherita、Dex 0） |
| FREE | BYPASS | **19** | |
| Lunch Rush → FREE | ORDER ANSWER + BYPASS | **19** | |
| Hint / EP1 | 何かしらの hint 漏れ | **24** | lock hint 13 ∪ guided hint 19 |
| Accessibility | aria-label に名前 | **24** | AT だけの漏れは 0 |
| Navigation bypass | 合計（SELECT_RECIPE ∪ LK-8） | **19** | |

### 8.2 合計

| 指標 | 値 |
|---|---:|
| recipe 数 | 25 |
| unique finding | 16（F-01〜F-16。LK-6 は除外） |
| recipe × 画面の漏れ | 146 |
| 影響を受ける unique recipe | **25** |
| 最大 severity の内訳 | BLOCKER 19 / HIGH 1 / MEDIUM 5 / LOW 0 |

---

## 9. Cross-check

| 項目 | Design `a8ef4d9` | Gate `05415f6` | I5b-4 `fbfd738` の Result | I5b-5 Preflight `b5c7b77` | 本監査 | 分類 |
|---|---|---|---|---|---|---|
| LK-1 NEW カード（名前 + 見本） | あり | 18 / 24 | 変更なし（font だけ） | — | 18 / 24（+ legacy の bismarck） | CONFIRMED |
| LK-2 guided の答え | あり | あり | — | — | + tray が必要材料だけ、popover の個数 | CONFIRMED + NEW（F-04 の詳細） |
| LK-3 LOCKED の名前 / 解放 hint | あり | 23 枚 | 変更なし | — | 23 枚、hint 13 件 | CONFIRMED |
| LK-4 Dex 0 margherita | あり | あり | — | — | あり | CONFIRMED |
| LK-5 Shop | あり | 16 / 24 | Shop 未変更 | — | 16 | CONFIRMED |
| LK-6 Dex 0 hint Level 3 | 意図された例外 | — | — | — | 例外のまま | CONFIRMED（数えない） |
| LK-7 W1 の 10 件は `unlockCondition` なし | あり | 実現した | — | — | W1 10 件すべて BLOCKER | CONFIRMED |
| LK-8 FREE の注文が未発見を優先 | **記載なし** | code-confirmed、実機は未再現 | 未対応 | — | **browser で発見まで再現** | CONFIRMED（証拠レベルの gap は RESOLVED）。Design の記載漏れは残る |
| LK-8b intro の「閉じる」 | 記載なし | code-confirmed | — | — | browser で再現 | CONFIRMED |
| `SELECT_RECIPE` の迂回 | 「UI で塞ぐ」前提 | reducer の backstop が必要 | 未対応 | — | 19 件で発見まで通る | CONFIRMED |
| Dex overlay の漏れ | なし | なし | — | — | なし（59 state） | CONFIRMED |
| HOME の漏れ | — | なし | 2+1 は漏れに無関係 | — | なし | CONFIRMED |
| DISCOVERABLE ≤ 1 / KBMM ≤ 1 | — | 新規 ladder で成立 | — | — | 新規 ladder で成立。legacy は 6 まで | CONFIRMED（範囲の注記は NEW） |
| matcher の重複 0 | — | 0 | — | — | 0 | CONFIRMED |
| EP1 は save にない | — | ない | — | — | ない | CONFIRMED |
| F-09 fugazza の名前を hint が出す | — | — | — | — | あり | **NEW** |
| F-11〜F-16 | — | — | — | — | あり | **NEW** |
| Gate の「I5b-4 の branch なし」 | — | 当時は正しい | — | — | I5b-4 は `fbfd738` にある | **STALE** |
| Gate の行番号（5204a26） | — | — | — | — | `HomeScreen.tsx` / `PizzaSelectScreen.tsx` は I5b-4 でずれた。`gameReducer.ts` / `orders.ts` / `ShopOverlay.tsx` / `pizzaSelect.ts` は同じ行 | **STALE**（一部） |
| 古い E2E 6 test × 2 project | — | discovery-ladder の 1 件を予想 | — | S-1〜S-6 | 同じ 12 件が失敗、他は pass | CONFIRMED（新しい discovery の bug ではない） |
| RESOLVED の漏れ | — | — | — | — | **0 件**（I5b-4 は漏れを 1 件も閉じていない。W1-a / W1-b / W1-c は未実装） | — |

---

## 10. Tests

production code は変更していない。すべて `fbfd738` の scratch worktree（repo の外、detached）で実行した。

| 実行 | 結果 | 判断 |
|---|---|---|
| `npx vitest run`（全 unit） | **147 files / 3228 tests pass**（68.8s） | I5b-3 の 3224 から I5b-4 の tests が 4 件増えた分 |
| Playwright Chromium `iphone-390x844` + `iphone-360x800`（全 E2E） | **130 passed / 12 failed**（4.2m、2 worker） | 失敗は Preflight の S-1〜S-6 × 2 project と完全に同じ（`/0\/15/` と `/1\/15/` → 実際は 0/25・1/25、`.rt01-case` 15 → 25、step 14 の 3 チーズ → にんにく）。**stale expectation で、production の bug でも新しい discovery の bug でもない** |
| Runtime probe（scratch vitest、commit なし） | 59 state + LK-8 の reducer 連鎖 19 件 + 端のケース 6 件 | JSON の `stateInvariants`、`lk8` |
| Browser probe（scratch Playwright、commit なし） | 3 / 3 pass（LK-8、LK-8b、Pizza Select / Dex の dump） | §5、screenshot 3 枚 |

WebKit は実行していない（この監査は漏れの有無を見るもので、layout の差は対象外。漏れの経路は engine に依存しない reducer と DOM の文字列）。

---

## 11. Hard blockers

| 種類 | 内容 |
|---|---|
| 監査を止める blocker | **なし**。必要な state はすべて runtime で生成して測れた |
| Discovery 2.0 の実装で解くべき BLOCKER | F-01、F-02（LK-8 / LK-8b）、F-03（`SELECT_RECIPE` + NEW カード）。どれも UI だけでは閉じない（§5.3） |
| 計画に入れるべき HIGH | F-04（guided の答え。F-01〜F-03 を閉じれば、発見済みだけに届くので漏れではなくなる）、F-05 / F-06（Shop。`recipesUnlockedByIngredient` を UI から外す） |

## 12. 判定

**READY** — Discovery 2.0 の実装計画を決めるための監査資料として足りている。25 件すべての漏れ、LK-8 の実機での到達性と関数の連鎖、reducer に置くべき契約（§5.3）、state 派生の範囲（§7）が揃っている。

これは production の実装を始めてよいという意味ではない。実装の前に、Gate / Design の OD-DISC-1 / 3 / 5 / 9 の決定と、§5.3 を W1-a の範囲に入れるかどうかの決定が要る。

---

## 13. このレポートの範囲

- 追加したもの: 本ファイル、`docs/reports/data/TETO_PROGRESS2_W1_DISCOVERY_LEAK_MATRIX.json`、`docs/reports/screenshots/progression2-w1-discovery-leak-audit/`（3 枚）。
- 変更していないもの: `src/**`、`e2e/**`、CSS、runtime、save schema、data、economy、scoring、CUT、Lunch Rush、CI / workflow、I5b-3 / I5b-4 の branch。
- probe の script（vitest / Playwright）は scratch だけに置き、commit していない。
