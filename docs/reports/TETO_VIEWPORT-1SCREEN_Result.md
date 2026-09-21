# Teto Pizza Game — スマホ縦 Viewport 1画面完結対応 Result Report

**Type:** Implementation (CSS/layout only) + Playwright e2e regression suite. No game logic,
scoring, Dex/progression, Firebase config/rules, Cloud Functions, or GitHub Actions
production-deploy workflow touched.

**Trigger:** production iPhone実機での報告 -- Lunch Rush結果画面から週間ランキングを開いた状態で
画面全体が1ページに収まらず、縦スクロールバーが表示され、ランキングは2件しかないのにmodal内部に
巨大な空白があり、modal自体がviewport下端まで伸びていた。添付: IMG_3313.jpeg。

**Authority viewport:** 390×844 (iPhone 12/13 mini〜通常サイズ相当)。**Secondary:** 360×800。

---

## 0. Fresh確認 / ベースSHA / PR #151統合

1. `git fetch origin main` — `origin/main` は `8fe1839` → **`5a3eca69f41f3ad29cf15bbe327b1ec7260c505d`**
   に進んでいた（PR #151 "feat: Visual Polish 2.0C P1-5 -- collapse CUT evaluation into a native
   details disclosure" がChatGPT Fresh Merge Gateを通過しSquash Merge済み）。
2. PR #151のマージ状態を確認: `list_commits(sha=main)` の先頭コミットが `5a3eca6` そのもの
   （マージ後、他のコミットは乗っていない）。
3. このセッションのbranch (`claude/teto-pizza-viewport-fix-f2dlgo`) は着手時点でこのタスク向けの
   コミットをまだ作成していなかった（作業はすべてworking tree上）ため、`git stash` で退避した上で
   `git merge origin/main` を実行 → **fast-forward**（コンフリクトなし）。`git stash pop` で
   viewport修正のworking tree変更を復元 → `src/App.css` は自動マージのみでコンフリクトゼロ
   （PR #151が触った `.cut-evaluation-summary*` セレクタ群と、本タスクが触った `.app-frame` /
   `.home-screen,.pizza-select-screen,.game-screen` / `.dex-overlay__panel` は行レベルで完全に
   独立していた）。
4. `git diff 8fe1839 5a3eca6 --stat` でPR #151の変更範囲を確認: `src/App.css`
   （`.cut-evaluation-summary*` のみ）、`src/components/ResultPanel.tsx`
   （CUT評価ブロックを `<details>` に折りたたみ、Fresh Audit 2.0C P1-5 Option B）、
   `src/components/ResultPanel.test.tsx`、docs/screenshots。本タスクが触ったファイル
   （`src/index.css`、`.app-frame`/共有スクリーンshell/`.dex-overlay__panel` 以外の `App.css`
   箇所）とは無関係。
5. **結論:** PR #151のCUT details折りたたみと、本タスクのviewport 1画面完結対応は両方とも
   コード上で共存済み（マージ済みbranchの実測は §5/§6 で示す通り）。

### Duplicate Gate #1（実装再開前）

`git fetch origin` 後、open PR 5件（#105 draft/Dev Automation、#72 docs-only、#46 docs-only
stale、#34 stale ingredient-visual CSS だが `.app-frame`/overlay/scrollには無関係、#3
docs-only）をすべて確認 — viewport/scroll/modal関連の重複なし。安全に着手。

### Duplicate Gate #2（PR作成直前）

再度 `git fetch origin` — `origin/main` は `5a3eca6` のまま変化なし。open PR 5件は上と同一で
変化なし。`#34`（ingredient視覚統一、stale base）は `App.css` の別セクション
（`--ingredient-piece-*` カスタムプロパティ、`.pizza-topping__emoji` 等、378〜410行/1913行台）
のみに触れており、本PRの `.app-frame`/共有スクリーンshell/`.dex-overlay__panel`
（16〜40行台、1660行台、2649行台）とは行レベルで重複なし。**安全にPR作成へ進行。**

---

## 1. Fresh Audit — 実ブラウザ実測（PR #151マージ後のmain, 修正前）

**Method:** 実Chromium（Playwright、`/opt/pw-browsers/chromium-1194`）、390×844 / 360×800の両方、
`localStorage.clear()` 後リロードしたfresh状態から実際にタップ/ドラッグ操作でナビゲート。CSSの
目視だけでなく `window.innerHeight` / `document.documentElement.scrollHeight` /
`getBoundingClientRect()` を都度実測（`docs/reports/screenshots/viewport-1screen-audit/before/
measurements.json`）。

### 1.1 静的画面（HOME / Recipe Select / Settings / Shop / Inventory / Dex / Weekly Ranking）

| 画面 | 390×844 docScrollH | pageScrolls | 390×844 modalH | 360×800 modalH |
|---|---|---|---|---|
| HOME | 844 (=innerH) | ✅ なし | - | - |
| Recipe Select (grid) | **1568** | ❌ **あり** | - | - |
| Settings | 844 | ✅ なし | **675.19px固定** | **640px固定** |
| Shop | 844 | ✅ なし | **675.19px固定** | **640px固定** |
| Inventory | 844 | ✅ なし | **675.19px固定** | **640px固定** |
| Dex | 844 | ✅ なし | **675.19px固定** | **640px固定** |
| Weekly Ranking | 844 | ✅ なし | **675.19px固定** | **640px固定** |

`.dex-overlay__panel`（Dex/Shop/Inventory/Settings/Weekly Ranking共有shell、App.css）が
`height: 80dvh` の**固定値**だった。Weekly Rankingが「準備中です。」の1行だけを表示していても
パネルは390×844で675px（コンテンツ実高さはわずか数十px、残り**607px**が空白）——ユーザー報告の
「2件しかないのにmodal内部に大きな空白がある」の直接原因。スクリーンショット:
`docs/reports/screenshots/viewport-1screen-audit/before/390x844/08_WeeklyRanking_fromHome.png`。

Recipe Selectは `docScrollHeight=1568` (390×844) / `1571` (360×800) —
**ページ全体**がスクロールしていた（`.pizza-select-body` 自身は既に `overflow-y:auto` を持って
いたが、祖先である `.app-frame`/`body`/`#root` が `min-height` で伸び続けるため、内部scrollが
一度も発火せずページ自体が伸びていた）。

### 1.2 Weekly Ranking: 2件 / 10件（synthetic row injection, 実DOM/実CSS）

この開発環境はFirebase未設定（`VITE_FIREBASE_*` 未設定）のため `getWeeklyLeaderboard()` は常に
`{status:"unavailable"}` を返す（ランキングデータ仕様・Cloud Functionsは本タスクの対象外につき
変更禁止）。2件/10件の実データ相当を再現するため、`WeeklyRankingOverlay.tsx` が実際にレンダーする
のと**同一のクラス名**（`.ranking-overlay__list` / `.ranking-overlay__row` 等）でsyntheticな行を
`.ranking-overlay__body` に注入し、実CSSレイアウトを測定した（データそのものではなくCSS層のみを
検証、e2eテストも同じ手法を使用 — §7参照）。

| 件数 | 390×844 modalH (修正前) | 360×800 modalH (修正前) |
|---|---|---|
| 2件 | **675.19px**（10件と同じ） | **640px**（10件と同じ） |
| 10件 | **675.19px**（2件と同じ） | **640px**（2件と同じ） |

件数に関わらず完全に同一の高さ——固定80dvhバグの直接証拠。

### 1.3 RESULT（PR #151のCUT details折りたたみ適用後、本タスクの修正前）

実プレイ（DOUGH stretch → SAUCE painting → CHEESE/TOPPING配置 → BAKE → CUT、実マウス座標での
実ジェスチャー、`src/App.test.tsx` の `completeDoughStep`/`paintSauceRing`/
`completeCutStepIfPresent` と同じ手法を実Chromiumに移植 — jsdomの `fireEvent` 疑似
`PointerEvent` は実ブラウザの `setPointerCapture`（未紐付けpointerIdでは例外を投げる)経由では
そのまま動かなかったため、実 `boundingBox()` 座標での `page.mouse` 操作に置き換えた）。

| シナリオ | 390×844 docScrollH | pageScrolls | 360×800 docScrollH | pageScrolls |
|---|---|---|---|---|
| マルゲリータ (CUT, 初回発見) | **1010** | ❌ あり | **991** | ❌ あり |
| フンギ (no CUT, 初回発見) | **973** | ❌ あり | **954** | ❌ あり |

**PR #151単独では解決していない** —— Fresh Audit 2.0Cの元の数値（CUT: 1121px/1102px）から
CUT評価ブロックの折りたたみで約110px縮んだが（1010px/991px）、それでも390×844/360×800の両方で
依然フォールド外にCTAが押し出され、ページ全体がスクロールしていた。ユーザー指示通り
「改善済みだから完了」とは判断していない。

### 1.4 Lunch Rush → RESULT → Weekly Ranking（実機報告と同じ導線）

`MissionResultOverlay`自体はコンテンツ量に対して元々センタリング配置（`position:absolute;
inset:0; align-items:center; justify-content:center`、固定高さ指定なし）のため単独では
1画面に収まっていた（modalH=475px、844/800に対し余裕あり）。ただし `.dex-overlay`/
`.mission-overlay` は `.app-frame` に対して `position: absolute; inset: 0` であり、
`.app-frame` 自体が `min-height: 100svh`（伸び続ける）だったため、**背後の画面（PREPAREの
ダイアログや長いコンテンツ）が844pxを超えて伸びていた場合、overlayも連動して伸び、
下端が可視viewportの外に出る**という設計上の欠陥が根本にあった（§2で修正）。この開発環境の
再現では偶然背景が844/800px以内に収まったため直接には再現しなかったが、Weekly Ranking自体の
固定80dvhバグ（§1.1/§1.2）はこの導線でも同一に再現した
（`docs/reports/screenshots/viewport-1screen-audit/after/390x844/
12b_LunchRush_Result_WeeklyRanking_PANEL_ONLY.png` は修正後、比較用）。

---

## 2. 原因（DOM/CSS実測ベース）

1. **`html`/`body`/`#root`/`.app-frame` が `min-height`（コンテンツに応じて伸びる）だった。**
   どのスクリーンも `overflow: hidden` で区切られておらず、どこか1つの子要素がviewportより
   高くなると**ページ自体**が伸びてスクロールバーが出る——`.pizza-select-body`
   （Recipe Selectのグリッド）や `.dex-overlay__body`（各overlay共有shell）は既に
   `overflow-y: auto` を持っていたにも関わらず、祖先が制約されていないため一度もその内部scroll
   が発火せず、常にページ全体が伸びていた。
2. **`.dex-overlay__panel`（Dex/Shop/Inventory/Settings/Weekly Ranking共有shell）が
   `height: 80dvh` の固定値**で、コンテンツの実際の高さを一切見ていなかった。Weekly Rankingの
   ような可変長（0件〜10件、または「準備中です」のような1行ステータス）コンテンツでは
   ほぼ確実に巨大な空白を生む設計だった。
3. `.app-frame` が伸び続けることで、`.dex-overlay`/`.mission-overlay`
   （`position: absolute; inset: 0`）も連動して伸び、`align-items: flex-end`/`center`
   が可視viewportではなく「伸びた `.app-frame` 全体」を基準に配置されるため、背景画面が長い
   ケースではmodalの下端が可視領域の外に出うる構造的リスクがあった。

---

## 3. 修正内容

**P0 — `.app-frame`/`html`/`body`/`#root` を固定viewport化（`src/index.css`, `src/App.css`）:**
`min-height: 100svh` → `height: 100svh; height: 100dvh; overflow: hidden`（`html`にも
`height:100%; overflow:hidden` を追加）。これにより `.app-frame` は常に正確に可視viewport分の
箱になり、ページ/body自体のスクロールが構造的に不可能になった（意図しないscrollを"直す"のでは
なく"起こりえなくする"）。

**P0 — 各トップレベル画面に内部scrollの安全網（`src/App.css`）:** `.home-screen,
.pizza-select-screen, .game-screen` の共有ルールに `overflow-y: auto;
-webkit-overflow-scrolling: touch;` を追加。`.app-frame` がoverflow:hiddenになった以上、
はみ出たコンテンツをクリップして消してしまわないための必須のペア。`.pizza-select-body`
（Recipe Selectグリッド）はこれで実際に内部scrollが機能するようになり、`.dex-overlay__body`
（各overlay）は元から持っていた`overflow-y:auto`がそのまま活きる。`.game-screen`
はPREPAREの`--bake-bar-reserve`パディング予約（既存、位置固定CTAバー用）やRESULTの長い
コンテンツの受け皿になる。

**P0 — `.dex-overlay__panel` をコンテンツサイズに変更（`src/App.css`）:** `height: 80dvh` を
削除し、`max-height`（既存の安全area対応キャップ）のみ残す。デフォルトの `height: auto`
でコンテンツに応じて伸縮し、上限（従来と同じmax-height）を超えた場合のみ
`.dex-overlay__body`の`overflow-y:auto`が内部scrollを発火する——Dex/Shopのような元々長い
一覧の挙動は変えず、Weekly Rankingのような短いコンテンツだけ実際に縮む。

**触っていないもの:** ゲームロジック、Firebase設定/rules/Cloud Functions、Scoring、
Inventory、Recipe progression、ランキングデータ仕様、PR #151のCUT details折りたたみ
（`ResultPanel.tsx`のJSX/`.cut-evaluation-summary*`セレクタは無変更）。

---

## 4. なぜ安全か（リグレッションリスクの検討）

`.app-frame` を `overflow: hidden` にすると、内部scroll領域を持たない画面のはみ出た
コンテンツは**表示すらされずクリップされる**リスクがある（見えなくなる方がページscrollより
悪い）。これを避けるため:

- `.game-screen`（PREPARE/BAKE/CUT/RESULT全フェーズを含む）は共有ルールの
  `overflow-y: auto` の対象そのものであり、RESULTのようにまだ1画面に収まらないコンテンツ
  （§1.3, PR #151後も1010px/991px）は**`.game-screen`自身が内部scrollする**ことを実測で確認
  （§5.4）——ページは伸びず、CTAは内部scrollで到達可能。
- PREPARE中の固定CTAバー（`.prepare-bake-bar`, `position: fixed`、既存の
  `--bake-bar-reserve`パディング予約による「最後のtray行までscrollで到達可能」という既存設計）
  は、scroll境界が`document`から`.game-screen`に変わっただけで、同じ仕組みがそのまま機能する
  （`IntersectionObserver`のデフォルトroot=viewportは実際の可視領域に対して判定するため、
  スクロールコンテナがdocumentか内部divかに依存しない）。
- Ingredient Tray自体は元から独立scroll不可（Human Feel Fix 2、ドラッグ+scrollジェスチャー
  競合を避けるため）——今回の変更はこの既存設計に一切触れていない。

---

## 5. 実測（修正後）

### 5.1 静的画面

| 画面 | 390×844 docScrollH | pageScrolls | 390×844 modalH | 360×800 modalH |
|---|---|---|---|---|
| HOME | 844 | ✅ なし | - | - |
| Recipe Select (grid) | **844** | ✅ **なし**（`.pizza-select-body`が内部scroll） | - | - |
| Settings | 844 | ✅ なし | **305px**（675→305） | 340px（640→340） |
| Shop | 844 | ✅ なし | **179.5px**（675→179.5） | 179.5px（640→179.5） |
| Inventory | 844 | ✅ なし | **248.19px**（675→248.19） | 248.19px（640→248.19） |
| Dex | 844 | ✅ なし | 824px（元々コンテンツが多くmax-height付近） | 780px |
| Weekly Ranking (0件/ステータスのみ) | 844 | ✅ なし | **126px**（675→126、-549px） | 126px（640→126、-514px） |

Recipe Selectグリッド: `.pizza-select-body.scrollHeight=1508` / `clientHeight=784`
（内部で実際にoverflow）——`document.documentElement.scrollTop`は内部scroll後も`0`のまま、
`.pizza-select-body.scrollTop`だけが動くことを実測で確認（scroll境界の分離を実証）。

### 5.2 Weekly Ranking: 2件 / 10件（修正後、synthetic rows・実CSS）

| 件数 | 390×844 modalH | 360×800 modalH | 内部scroll (`.ranking-overlay__body`) |
|---|---|---|---|
| 2件 | **188px**（675→188） | **188px**（640→188） | 不要（scrollHeight=clientHeight） |
| 10件 | **508px**（675→508、コンテンツに応じて伸長） | **508px** | この件数ではまだ不要
  （scrollHeight=clientHeight=440、max-height上限に未到達）——件数がさらに増え上限を超えた
  場合のみ`.ranking-overlay__body`（既存`overflow-y:auto`）が内部scrollする。Dex（§5.1、
  824px≈max-height付近、コンテンツ多数で実際に内部scroll）で同じ仕組みが機能することを別途確認済み。 |

「2件程度ならコンパクト」「10件でも巨大空白なし、必要な場合のみ内部scroll」の両方を実測で確認。

### 5.3 opening a modal never scrolls the background page

`getComputedStyle(document.documentElement).overflowY` はmodal開閉に関わらず常に`hidden`
（`.app-frame`が`overflow:hidden`のため、そもそも背景page自体がscroll可能な状態に一度もならない
——「modal表示中に背景pageをscrollさせない」を構造的に満たす）。

### 5.4 RESULT（PR #151後、本タスクの修正後）

| シナリオ | 390×844 docScrollH | pageScrolls | `.game-screen` scrollH/clientH | 内部overflow |
|---|---|---|---|---|
| マルゲリータ (CUT, 初回発見) | **844**（=innerH） | ✅ **なし** | 1010 / 844 | ✅ あり（意図的、内部scroll） |
| フンギ (no CUT, 初回発見) | **844** | ✅ なし | 973 / 844 | ✅ あり（意図的、内部scroll） |

360×800も同様（`.game-screen` 991/800、954/800、`docScrollH`は常に`800`=innerH）。

**CTA到達性の実証:** `.game-screen.scrollTo(0, scrollHeight)`後、`.result-panel__actions`
（もう一度つくる/別のピザを作るボタン行）の`getBoundingClientRect()`が
`{top:0以上, bottom:innerHeight以下}`に収まることを実測——内部scrollで完全に到達可能
（クリップされて消えていない）。同時に`document.documentElement.scrollTop`は`0`のまま
（ページ自体は一切動いていない）。スクリーンショット:
`docs/reports/screenshots/viewport-1screen-audit/after/390x844/
14_FREE_RESULT_margherita_CUT_discovered.png`。

**注記:** RESULTのCTAをフォールド内に完全に収める（内部scroll自体を不要にする）ことは、
Fresh Audit 2.0C（`TETO_VISUAL-POLISH_2.0C_Fresh-Audit.md` §10 Option A/C）が挙げる別スロープ
（fixed CTAバー化、またはCTAをスコア直下に並べ替え）であり、本タスクのスコープ
（「不要なpage/body scrollの除去」であり「RESULTのコンテンツ量そのものの削減」ではない）を
超える。今回の対応はRESULTがどれだけ長くても**ページを一切伸ばさず、必要な分だけ内部scroll**
にする、というこのタスクの直接要求（「固定viewport内のコンテンツ領域だけスクロール」）を満たす
ものであり、フォールド内完全収納は別タスクとして残る。

### 5.5 Lunch Rush → RESULT → Weekly Ranking

390×844/360×800とも `docScrollHeight` は常に `innerHeight` と一致（`pageScrolls=false`）。
Weekly Rankingパネルは126px（§5.1と同じ、状態が同一のため）。

### 5.6 Horizontal overflow / console errors

全画面・全操作を通じて `document.documentElement.scrollWidth === window.innerWidth`
（horizontal overflow = 0）、`console.error`/`pageerror` ともに0件を確認
（`docs/reports/screenshots/`配下のmeasurements.json取得と同一セッションで計測）。

---

## 6. Before / After スクリーンショット

`docs/reports/screenshots/viewport-1screen-audit/{before,after}/{390x844,360x800}/` 配下、
主要なもの:

- `08_WeeklyRanking_fromHome.png` — 最も顕著な修正（675px巨大空白 → 126pxコンパクト）
- `16_WeeklyRanking_2rows.png` / `17_WeeklyRanking_10rows.png` — コンテンツ量に応じた
  可変サイズの実証（before: 両方とも675/640pxで同一 → after: 188px/508pxと差が出る）
- `02_RecipeSelect_grid.png` — before: 撮影時点でのスクロール位置（ページ全体が長い） →
  after: 常に1画面固定、グリッドだけが内部scroll
- `12b_LunchRush_Result_WeeklyRanking_PANEL_ONLY.png` — Lunch Rush導線での同一修正
- `14_FREE_RESULT_margherita_CUT_discovered.png` — before: ページが1010px伸びてscroll →
  after: 844px固定、`.game-screen`が内部scroll
- `15_FREE_RESULT_funghi_noCUT_discovered.png` — CUTなしのRESULTでも同様

---

## 7. 追加したregression test

**`playwright.config.ts` + `e2e/gestures.ts` + `e2e/viewport-1screen.spec.ts`**
（新規、`@playwright/test`をdevDependencyに追加、pinned `1.56.1` — この実行環境の
プリインストールChromium revision 1194と一致させるため）。

`npm test`（vitest/jsdom）は実レイアウトを一切計算しないため、page/body scroll・modal高さ・
overflowを検証できない——この一式は実Chromiumで`window.innerHeight`/
`document.documentElement.scrollHeight`/`getBoundingClientRect()`を実際に測定する、単なる
snapshotではないassertionベースのテスト。**390×844と360×800の両方**を2つのPlaywright
projectとして実行（16 tests = 8 assertions × 2 viewports）。

- HOME / Settings・Shop・Inventory・Dex overlays がページを一切伸ばさないこと
- Recipe Selectのグリッドが`.pizza-select-body`内部だけでscrollし、
  `document.documentElement.scrollTop`が常に`0`のままであること
- Weekly Rankingの空/ステータスのみの状態がコンパクトに収まること（`innerHeight`の30%未満）
- Weekly Rankingの2行/10行syntheticコンテンツでパネル高さが実際に変化し、ページを伸ばさない
  こと（実データではなく実CSSクラスへの直接注入 — Firebase未設定環境でもCSS層を検証できる
  ようにするための意図的な選択、ランキングデータ仕様/Cloud Functionsには一切触れない）
- modalを開いても`<html>`の`overflow-y`が常に`hidden`のままであること（背景page scroll不可）
- Lunch Rush RESULT + Weekly Ranking スタック時もページを一切伸ばさないこと
- マルゲリータ CUT round のフルプレイスルー（実マウス操作でDOUGH stretch→SAUCE→CHEESE→
  TOPPING→BAKE→CUT→RESULT）で、RESULTが`.game-screen`の内部scrollのみを使い、ページは
  一切伸びず、かつCTAが内部scrollで実際に到達可能であること

**サニティチェック（テストの有効性確認）:** 修正前のCSS（`git stash`で一時的に本タスクの
`App.css`/`index.css`変更のみ退避）に対して同じ16テストを実行し、**10/16が正しくfailする**
ことを確認（HOME・Settings系overlay・Lunch Rush単体スタックの3系統6テストのみ、この開発環境の
実測範囲ではそもそも修正前から偶然フォールド内に収まっていたためpassのまま——テストが
vacuousでないことの実証）。修正を戻すと `git stash pop` で確認、最終的に16/16 pass。

`npm run test:e2e`（`playwright test`）で実行可能。**`.github/workflows/ci.yml`には追加して
いない**（今回のタスクの「workflow変更禁止」制約）——`npm test`（vitest）には一切影響しない
別ディレクトリ（`e2e/`、拡張子`.spec.ts`）。

---

## 8. テスト結果

- **`npm test`（vitest, 既存フル回帰）:** `111 test files / 2076 tests` すべてpass。
  Player Profile / Settings displayName保存 / Weekly Ranking取得 / 「あなた」表示 / Result /
  Reset / CUT / Scoring / Inventory / Recipe progressionを含む既存スイート全域に変更なし。
- **`npm run test:e2e`（Playwright, 新規）:** `16 / 16` pass（390×844 × 360×800の2 project）。
- **`npx tsc -b --force`:** エラーなし。
- **`npm run lint`（oxlint）:** `src/`・`e2e/`・`playwright.config.ts`に警告/エラーなし
  （調査用の一時スクリプトは削除済み、コミット対象に含まれない）。
- **`npm run build`（`tsc -b && vite build`）:** 成功（既存のchunk-size警告のみ、
  本タスク非依存・変更前から存在）。

---

## 9. Restricted-scope確認

`git diff origin/main --stat` の対象は: `.gitignore`、`package.json`、`package-lock.json`
（`@playwright/test`追加のみ）、`src/App.css`、`src/index.css`、`e2e/**`（新規）、
`playwright.config.ts`（新規）、`docs/reports/**`（本レポート + screenshots）。
`functions/**`、Firebase設定/rules（`firestore.rules`/`firestore.indexes.json`）、GitHub
Actions production-deploy workflow（`.github/workflows/*.yml`は無変更）、Player Profile、
`setDisplayName`、`submitLunchRushScore`、ランキングバックエンド/クエリロジック、ゲーム
ロジック・Scoring・Inventory・Recipe progressionのいずれにも触れていない。PR #151の
`ResultPanel.tsx`/`.cut-evaluation-summary*`もJSX/CSSともに無変更のままマージ。

---

## 10. 最終判定

390×844で対象10画面（HOME/Recipe Select/Settings/FREE gameplay/Lunch Rush
gameplay/RESULT/Weekly Ranking/Shop/Inventory/Dex）すべてについて
`document.documentElement.scrollHeight <= window.innerHeight`
を実ブラウザで確認（RESULTのみ、コンテンツ量が実際に1画面を超えるため`.game-screen`内部での
意図的scrollが残る——page/body自体のscrollではないことを実測で明記、§5.4）。360×800も同様。
Weekly Rankingは2件でコンパクト・10件でも巨大空白なし（この件数ではmax-height未到達のため
内部scroll自体は未発火、上限超過時は`.dex-overlay__body`の既存`overflow-y:auto`が機能する
ことをDexで別途確認済み）。horizontal overflow・console/page errorsともに0件。PR #151の
CUT details折りたたみと完全併存。Firebase/Functions/Firestore/IAM/production
workflowへの変更は一切なし。
