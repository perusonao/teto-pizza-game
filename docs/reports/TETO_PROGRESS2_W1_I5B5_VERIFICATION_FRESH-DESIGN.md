# Progression 2.0 W1 I5b-5: Verification Fresh Design（STOP GATE）

- 種別: Verification の Fresh Design だけ。docs のみ。`src/**`、`e2e/**`、CSS、runtime、`playwright.config.ts`、workflow は変更していない。PR も merge もしていない。
- 監査した main: `12a09de2c4da8ed7e92f1ff9f47dd7bdf824a6e5`（Merge PR #228、I5a）。`git fetch origin main` の直後に確認した。
- 並行作業: I5b-3 Production Integration は別セッションで進行中。その branch には書き込んでいない。25 recipe の値は、次の commit を `git show` で読んで使った。
  - I5b Fresh Audit `ca72af6`
  - I5b-1 `861798f`
  - I5b-2 `f8c826a`
  - 25-Recipe Economy Audit `2c8518c`
- 前提にした Fresh Audit:
  - I5b-4 UI/UX `0c3e01f`（本 design の検出対象を定めている）
  - 25-Recipe Economy `2c8518c`
  - Post-W1 Cooking Steps Phase 1 `0d7b489`
- 計測: scratch script（repo には入れていない）を Chromium 141.0.7390.37 と dev server で動かした。結果は §4.2 にある。
- machine-readable な matrix: `docs/reports/data/TETO_PROGRESS2_W1_I5B5_VERIFICATION_MATRIX.json`

---

## 1. 現在の Verification の構成（main `12a09de`）

| 層 | 実体 | どこで走るか | 規模と時間 | 見ているもの |
|---|---|---|---|---|
| **Vitest**（jsdom） | `vitest.config.ts`、`src/**/*.test.ts(x)` | CI の `ci.yml`（PR ごと） | 142 files / 2,912 tests（I5a 時点） | reducer、pure logic、data の不変条件、component の構造（DOM、class、aria）。**pixel のレイアウトは一切見ない** |
| **Chromium E2E** | `playwright.config.ts` の `iphone-390x844` / `iphone-360x800`（中身は `devices["Desktop Chrome"]` に viewport を指定したもの） | **local と manual だけ。CI では走らない**（config のコメントと `ci.yml`） | 14 spec、71 test × 2 project = 142。約 4.3 分（I5a） | 実ブラウザでの flow、scroll の有無、box が viewport に収まるか |
| **WebKit Gate** | `webkit-390x844` / `webkit-360x800`（`devices["Desktop Safari"]`）。`e2e-webkit.yml` の classify → 2 project × 2 shard → WebKit Gate | PR（classifier による条件付き）、main への push（Full）、`workflow_dispatch`、`webkit-full` label | 142 test。wall 約 4.5 分、runner 約 13.5 分（Phase 2A） | Chromium E2E と**同じ spec 全部**を WebKit で走らせる。shard の evidence で「全 test がちょうど1回走って pass した」ことを証明する |
| **classifier** | `scripts/ci/classify-webkit.mjs` | classify job | 数秒 | docs だけの変更（`docs/**`、runtime tree の外にある `*.md`）なら WebKit を skip する。それ以外と、判定できないときはすべて Full（fail-safe） |
| **mobile の扱い** | project 名は `iphone-*` だが、Desktop UA、`isMobile: false`、`hasTouch: false`、DPR 1 | — | — | 画面の幅と高さだけを真似ている。動的なツールバー、visual viewport と layout viewport の差、`svh` / `lvh` / `dvh` の差、touch の挙動は再現しない |
| **viewport** | project の 390×844 / 360×800。spec の中で `setViewportSize` を使っているのは、361×800、390×650（`making-ui-1screen` の Margherita guided だけ）、390×844 / 360×800 の強制 | — | — | 「端末の画面サイズ」だけを見ている。短い表示領域（ツールバーあり）は 390×650 の1本だけ |
| **screenshot / video / trace** | config の `use` は `baseURL` だけ。screenshot、video、trace はすべて off | CI は html report と json を upload する | — | 失敗したときに残るのは、エラー文と stack だけ。画像、DOM snapshot、座標は残らない |
| **safe-area** | `index.html` は `viewport-fit=cover`。`App.css` の 13 か所で `env(safe-area-inset-*)` を使っている | — | — | **E2E では常に 0**。inset を与えている test は1本もない |
| **Human Verification** | `TETO_HUMAN-VERIFICATION-POLICY.md`（390×844 の MP4 をユーザーへ直接渡す。screenshot は commit する）。録画には `scripts/record-*.mjs` などを都度使う | 人が回す | — | 実機の感触。ただし動画は desktop Chromium で撮るので、実機の safe-area とツールバーは映らない |

### 1.1 今の仕組みで検出できるもの

- nominal viewport（390×844 / 360×800）での page scroll、`.game-screen` の scroll、横方向のはみ出し。
- PREPARE の in-flow の内容と viewport 下端との間に 8px 以上の余白があること（`making-ui-1screen` の `MIN_SAFETY_MARGIN_PX`）。
- 工程タブが横に収まること（6 タブ、360 幅）。
- modal や popover が viewport に収まり、閉じられること。
- RESULT の primary CTA が最初の画面に入っていること。
- 390×650 の Margherita guided で、dough の縮小式が効くこと。
- WebKit のレイアウトとフォントで、同じ spec が通ること（Desktop Safari の範囲で）。

### 1.2 検出できないもの（blind spot）

| ID | blind spot | 根拠 |
|---|---|---|
| **BS-1** | Chromium E2E が CI で走らない。CI の E2E は WebKit だけ | `playwright.config.ts` のコメントと `ci.yml` |
| **BS-2** | 短い表示領域（390×664 / 360×640）が、FREE（pager あり）、ヒントを開いた状態、Lunch Rush、BAKE の「取り出す！」、CUT、HOME のどれでも測られていない | 390×650 は Margherita guided の1本だけ |
| **BS-3** | safe-area が常に 0 | inset を与える仕組みがない |
| **BS-4** | `position: fixed` の CTA bar と、pager や chip との**重なり**を見ていない。`assertOneScreen` は fixed の子要素を除外している。FREE の `expectOneScreen` が見ているのは「bar の下端 ≤ viewport」と「`.game-screen` が scroll しないこと」だけ | §4.2 の実測: 390×664 に inset を入れた条件で、bar の上端は 560、`.game-screen` は 664/664（scroll なし）。今の assertion は PASS になる。一方、I5b-4 はこの条件で pager が bar に **−80px** 重なることを計測している |
| **BS-5** | Lunch Rush の PREPARE と BAKE の geometry（MissionHud の 41px が reserve に入っていない。I5b-4 が 8px のはみ出しを再現） | Lunch Rush の spec は flow と serve だけを見ている |
| **BS-6** | HOME Dex 0 で CTA が3行の円になる（高さ 87〜108px） | onboarding の spec は「scroll しない」ことしか見ていない |
| **BS-7** | Pizza Select の長い名前、EP1 の文言、W1 の答えの漏れ（C3 / C4） | assertion がない |
| **BS-8** | Desktop Safari は iOS Safari ではない。動的なツールバー、touch、Apple のフォントが無い | Phase 0 §3.2、PR-C |
| **BS-9** | 失敗したときに、原因を示す情報（box、inset、scroll の値、画像）が残らない | config |
| **BS-10** | viewport を強制する約 10 test が、2 project の両方で同じ条件のまま走る（検出力は増えず、時間だけかかる） | `dynamic-cooking-steps` A/B/C、`making-ui-1screen`（5 本）、`pizza-cutting-phase4b` C など |
| **BS-11** | 25 recipe はまだ main に無い。既存 e2e の「step 14 で3材料の通知」は、W1 の後は本番の流れで出なくなる | I5b Fresh Audit §13 |
| **BS-12** | Human Verification の動画は desktop Chromium で撮っている。実機の safe-area とツールバーを確かめられるのは、Owner が iPhone で見るときだけ | Policy §5 |

---

## 2. 既存の mobile target と「実表示領域」問題

- 390×844 / 360×800 は**端末の画面サイズ**で、そのまま authority viewport（Policy §3）として残す。全 spec の既定の project であることも変えない。
- I5b-4 の実測では、iPhone Safari でツールバーを出していると、`innerHeight` は約 664〜750 になる。nominal で通っていても、表示領域が短くなると次のものが壊れる。
  - BAKE の CTA
  - pager と下部 bar の重なり
  - Lunch Rush の HUD
- **本 design で、この問題を正式な Verification 対象にする。** 名前は「**Short Visual Viewport（SVV）Layout Contract**」とする。
  - nominal の2つ = 「機能が動くか」の基準。
  - SVV = 「狭くなっても操作できるか」の基準。
  - この2つを別の軸として持つ。

---

## 3. Viewport profile

### 3.1 profile の定義

| ID | viewport | inset（top / bottom） | 何を表すか | engine | 使う場所 |
|---|---|---|---|---|---|
| **N390** | 390×844 | 0 / 0 | authority の nominal（既存の project） | Chromium、WebKit | 全 spec（今のまま） |
| **N360** | 360×800 | 0 / 0 | secondary の nominal（既存の project） | Chromium、WebKit | 全 spec（今のまま） |
| **S390** | 390×664 | 0 / 0 | iPhone Safari でツールバーを出したとき（390 幅の最悪値） | Chromium、WebKit | Layout Contract spec だけ |
| **S360** | 360×640 | 0 / 0 | 360 幅で同じ条件（最小の表示領域） | Chromium、WebKit | Layout Contract spec だけ |
| **P390i** | 390×844 | 47 / 34 | ホーム画面に追加した PWA（standalone）。上下の inset が両方出る | Chromium だけ（§4） | Layout Contract spec だけ |
| **E390i** | 390×664 | 47 / 34 | **包絡条件**。I5b-4 の再現条件（BAKE と pager の不具合） | Chromium だけ | Layout Contract spec だけ |
| **E360i** | 360×640 | 47 / 34 | **包絡条件の最悪値**。有効な高さは 559px | Chromium だけ | Layout Contract spec だけ |

- 注意: 「短い表示領域」と「上下の inset」が同時に出る状態は、実際の Safari では起きにくい。ツールバーを出しているとき、Safari の縦画面では inset はほぼ 0 になる。したがって E390i と E360i は、**実際の状態ではなく、実際に起こりうる状態すべてを外側から包む保守的な条件**として扱う。
- 包絡条件で通れば、その内側にある状態はすべて通る。例: 390×750 に下 34（ツールバーを縮めたとき）、P390i。
- 390×750 / 360×720（ツールバーを縮めたとき）は、S と E の間に挟まれるので、専用の profile にはしない。
- 包絡条件を hard gate にするかどうかは OD-V-2 で決める。

### 3.2 全 E2E には足さない

- 4 profile（N390 / N360 / S390 / S360）をすべて project にすると、142 test が 284 test になり、WebKit の時間もほぼ倍になる。**やらない。**
- SVV の profile は、**1つの spec（Layout Contract）の中で `setViewportSize` を使って巡回する**。project は増やさない。

---

## 4. Safe-area の再現

### 4.1 方法の比較

| 方法 | env() の値 | production への影響 | engine | 評価 |
|---|---|---|---|---|
| a. Playwright の device descriptor（`iPhone 13` など） | 0（descriptor に inset の項目が無い） | なし | WebKit / Chromium | 使えない |
| b. test の側で CSS を注入する（I5b-4 の方法。header に +47、bar に +34 の padding を足す） | 0 のまま。代わりの padding を足す | なし | 両方 | 「env() を使っている全部の箇所」を再現できない。どの selector に足すかを test が知っている必要があり、production の CSS と食い違う。**補助としてのみ使う** |
| c. production に fake inset の hook を入れる（`--debug-inset` など） | hook による | **あり** | 両方 | **採用しない**（指示どおり。production に test の都合を入れない） |
| **d. CDP の `Emulation.setSafeAreaInsetsOverride`** | **本物の env() が値を返す** | なし | **Chromium だけ** | **採用** |

### 4.2 実測（scratch、Chromium 141.0.7390.37）

最小の HTML で、`padding: env(safe-area-inset-top) / env(safe-area-inset-bottom)` を読んだ結果:

| 条件 | 結果 |
|---|---|
| 既定 | `0px / 0px` |
| CDP override（47 / 34） | **`47px / 34px`** |

実際のアプリ（Free Cooking の PREPARE、所持材料 19 種）:

| profile | header（上〜下） | `.prepare-bake-bar`（上〜下） | `.game-screen` sh / ch | 横方向の scroll |
|---|---|---|---|---|
| 390×844 | 0–56 | 774–844 | 844 / 844 | 0 |
| 390×844 + inset | **0–103**（+47） | **740**–844（+34） | 844 / 844 | 0 |
| 390×664 | 0–56 | 594–664 | 664 / 664 | 0 |
| 390×664 + inset | 0–103 | **560**–664 | **664 / 664** | 0 |
| 360×640 | 0–56 | 570–640 | 640 / 640 | 0 |
| 360×640 + inset | 0–103 | **536**–640 | **640 / 640** | 0 |

- bar の上端（560 / 536）は、I5b-4 が CSS を注入して得た値と一致する。**production の `env()` を使っている全箇所が、hook なしでそのまま反応する。**
- 同じ条件で `.game-screen` は scroll していない。I5b-4 が計測した pager の重なり（−80px）は、今の assertion では見えない（BS-4 の証拠）。

### 4.3 制約（明記）

1. **CDP は Chromium だけ。** WebKit（Playwright の WebKit、Linux）には、inset を与える API が無い。WebKit の SVV は inset 0 で測る（S390 / S360）。
2. CDP のこのメソッドは experimental。Chromium や Playwright の更新で消えたり、名前が変わったりするおそれがある。
   - そのため、Layout Contract spec の先頭に**自己検査**を置く。inset を与えた後で probe 要素の `env()` を読み、47 / 34 になっていなければ **fail** させる（skip にはしない）。
   - これで、inset が黙って 0 に戻り、テストが素通りする状態を防ぐ。
3. inset の値（47 / 34）は iPhone 14/15 系の縦画面の代表値。Dynamic Island の機種は 59 / 34。
   - 包絡条件としては 47 で足りる（I5b-4 と同じ値）。59 にするかどうかは OD-V-2 の中で決める。
4. 実機の Safari は、inset のほかに**動的なツールバー**（スクロールで高さが変わる）を持つ。ツールバーの伸び縮みは、「resize の巡回」（§8.2）で近似する。実物で確かめるのは Human だけ（§13）。
5. 左右の inset（横画面）は対象外。ゲームは縦画面が前提。

---

## 5. Layout invariant（geometry assertion）

### 5.1 共通の定義

- `vh` = `window.innerHeight`、`vw` = `window.innerWidth`。
- `sat` / `sab` = **実測した** inset。test の側で probe 要素を1つ作り、`env(safe-area-inset-*)` の computed 値を読む（test の DOM 注入。production の hook ではない）。
- `box(x)` = `getBoundingClientRect()`。許容誤差は `TOL = 1px`（既存の spec と同じ）。
- 対象の要素は、**slot** という名前で集める。slot は header、tabs、order-card、stage、dough、tray、chips[]、pager、ctaBar、primaryCta、hud。selector は実装時に I5b-4 後の DOM に合わせる。

### 5.2 Invariant

| ID | 条件（すべて `TOL` 込み） | 対象の画面 | 優先度 |
|---|---|---|---|
| **L-A** | `primaryCta.bottom ≤ vh − sab`、`primaryCta.top ≥ header.bottom`、かつ `elementFromPoint(primaryCta の中心)` が CTA 自身か、その子孫であること（押せること） | Cooking の全工程、RESULT、HOME | P0 |
| **L-B** | pager が出ているとき（1ページだけで場所だけ確保しているときも）: `pager.bottom + 8 ≤ ctaBar.top` | FREE / guided / Lunch Rush の PREPARE | P0 |
| **L-C** | 見えている `chip` がすべて `chip.bottom ≤ min(pager.top, ctaBar.top)`。さらに、各 chip と pager のボタンの中心を `elementFromPoint` で調べ、自分自身が返ること（bar のグラデーションや吹き出しの下に潜っていない） | PREPARE の全カテゴリと全ページ | P0 |
| **L-D** | `document.documentElement.scrollWidth ≤ vw`、かつ `.app-frame` の中で見えている要素がすべて `right ≤ vw` | 全画面 | P0 |
| **L-E** | Cooking（PREPARE / BAKE / CUT）: `scrollingElement.scrollHeight ≤ vh`、`.game-screen` の `sh ≤ ch`。さらに `window.scrollBy(0, 200)` の後も `scrollY === 0`。CTA の祖先に、scroll できる要素（`overflow-y: auto/scroll` かつ `sh > ch`）が無いこと | Cooking の全工程 | P0 |
| **L-F** | BAKE: 「取り出す！」が L-A を満たすこと。**BAKE に入った直後と、Guide がフェードし終わった後（約 7.2 秒）の2回**確かめる。文言や caption が変わると高さが変わるため | FREE / guided / Lunch Rush の BAKE | P0 |
| **L-G** | Lunch Rush: HUD があっても L-A / L-B / L-E / L-F を満たす。さらに `hud.bottom ≤ tabs.top`（HUD と工程タブが重ならない） | Lunch Rush の PREPARE / BAKE / CUT | P0 |
| **L-H** | HOME: 各 CTA のラベルの行数が 2 以下。行数は、ラベルの text に `Range` を張り、`getClientRects()` の top の異なる値を数える。さらに `height ≤ 64` かつ `width / height ≥ 1.6`（円や縦長の pill にならない） | HOME の Dex 0 / Dex 1+ | P1（WebKit 必須） |
| L-I | inset の中に操作要素を置かない: header の中の最初の操作要素の `top ≥ sat`、下部 bar の中の操作要素の `bottom ≤ vh − sab` | HOME、Cooking、overlay | P1 |
| L-J | 工程タブ: 全タブが `right ≤ vw`、ラベルが省略記号にならない（`scrollWidth ≤ clientWidth`）。**工程が変わってもタブの `top` が変わらない**（±1px。I5b-4 の F-3b） | Cooking の全工程 | P1 |
| L-K | 骨格の順番: `header.bottom ≤ tabs.top`、`tabs.bottom ≤ orderCard.top`、`orderCard.bottom ≤ stage.top`、`stage.bottom ≤ tray.top`、`tray.bottom ≤ pager.top`、`pager.bottom + 8 ≤ ctaBar.top`。L-B と L-C を一般化したもので、吹き出しがタブに重なる問題（I5b-4 の 390×664-inset）も捕まえる | Cooking | P1 |
| L-L | Pizza Select と RESULT の recipe 名: 行数 ≤ 2、名前の box がカードからはみ出さない | Pizza Select、RESULT、Dex | P1（WebKit 必須） |
| L-M | Tap target: primary CTA、chip、pager のボタンが 44×44 以上 | Cooking、HOME | P1 |
| L-N | dough の直径 ≥ floor（advisory。floor の値は OD-V-4） | Cooking の全工程、最悪の profile | advisory |
| L-O | 画面の状態が変わっても骨格が動かない: HOME で Dex 0 と Dex 1 の CTA の行数（2+1）と primaryCta の `top` が同じ（±1px） | HOME | P1 |

### 5.3 assertion の書き方（実装への指示）

- invariant は1つの helper（例: `e2e/support/layoutContract.ts`）に集める。spec ごとに書き直さない。
- 1つの状態につき、全 profile を `expect.soft` で調べてから fail させる。1つの失敗が、ほかの profile の結果を隠さないようにする。
- 失敗のメッセージは次の形にする: `L-B pager/CTA gap @E360i FREE TOPPING p2 hint=open: gap=-80px (need ≥ 8)`。invariant の ID、profile、状態、差分の px を入れる。

---

## 6. 検証が必要な画面の分類と、最小の matrix

### 6.1 分類

凡例:
- **N** = nominal の既存 spec（N390 / N360、Chromium と WebKit）
- **SVV** = Layout Contract の巡回（S390 / S360 / P390i / E390i / E360i）
- **W-SVV** = WebKit で S390 / S360 を巡回
- **Shot** = Human の screenshot
- **Vid** = Human の動画

| 画面 / 状態 | 主なリスク | invariant | N | SVV | W-SVV | Shot | Vid |
|---|---|---|---|---|---|---|---|
| HOME Dex 0 | CTA が円になる、位置がジャンプする（F-1） | L-A, L-D, L-H, L-O | ✓ | ✓ | ✓（L-H） | ✓ | A |
| HOME Dex 1+ | 骨格が変わる | L-A, L-H, L-O | ✓ | ✓ | ✓（L-H） | ✓ | A |
| Pizza Select（discovered / NEW / locked・unknown） | 文言、答えの漏れ（C3 / C4） | L-D, L-L、内容の assertion | ✓ | 詳細 sheet の CTA だけ | — | ✓（4状態） | A（一部） |
| Pizza Select（長い名前） | 3行になる、はみ出す | L-L | ✓ | — | ✓（N と S360） | ✓（390 / 360） | — |
| FREE PREPARE（DOUGH / SAUCE / CHEESE） | CTA | L-A, L-E, L-K | ✓ | ✓ | ✓ | — | — |
| FREE ingredient page 1 | pager と bar の重なり（F-4） | L-B, L-C, L-K, L-M | ✓ | **✓** | ✓ | ✓ | B |
| FREE ingredient page > 1（最後のページ、途中まで埋まったページ） | pager の場所がずれる | L-B, L-C | ✓ | **✓** | ✓ | ✓ | B |
| FREE hint expanded | order-card が 2 行になり +15px | L-B, L-C, L-K | — | **✓** | ✓ | ✓ | B |
| FREE BAKE | 「取り出す！」が画面の外に出る（F-3） | L-A, L-E, L-F, L-J | ✓ | **✓** | ✓ | ✓ | B / C |
| guided CUT | CUT の CTA、pizza 全体 | L-A, L-E, L-J | ✓ | **✓** | ✓ | ✓ | B |
| Lunch Rush PREPARE | HUD の分のはみ出し | L-G, L-B, L-C | ✓ | **✓** | ✓ | ✓ | C |
| Lunch Rush BAKE | HUD があると 8px はみ出す（I5b-4 で再現） | L-G, L-F | ✓ | **✓** | ✓ | ✓ | C |
| Lunch Rush CUT | 同上 | L-G | ✓ | ✓ | — | — | C |
| Lunch Rush RESULT | 4 つの CTA | L-A, L-D | ✓ | ✓ | — | — | C |
| Shop NEW / OWNED | 購入ボタン、閉じるボタン | L-A（overlay の CTA）、L-D、L-I | ✓ | ✓ | — | ✓ | A |
| Shop（multi-page / 最大 26 行） | 中の scroll、最後の行のボタンに届く | 中の scroll で最後の行の購入ボタンが L-A を満たす | ✓ | ✓ | — | ✓ | — |
| RESULT（FREE / guided） | CTA | L-A, L-D | ✓（既存） | ✓ | — | ✓ | B / C |

### 6.2 P0 regression を捕まえる最小の matrix（SVV）

Layout Contract spec は **6 test**。各 test は flow を**1回だけ**進め、各状態で profile を巡回する。

| test | 始めるときの profile | 巡回する状態 | 捕まえる P0 |
|---|---|---|---|
| **LC-1 FREE**（W1 の後で、具材 22 種を所持している save） | **S360**（短い状態で mount する） | TOPPING p1 → ヒントを開く → p2 → 最後のページ → BAKE（入った直後と、Guide が消えた後） | F-4、F-3 |
| **LC-2 guided high-piece**（Portuguesa。I5b-3 より前は Capricciosa で代用） | **N390**（nominal で mount し、縮めていく） | TOPPING → BAKE → CUT → RESULT | F-3、CUT |
| **LC-3 Lunch Rush** | S360 | PREPARE（TOPPING）→ BAKE（2回）→ CUT → serve → RESULT | BS-5 |
| **LC-4 HOME** | 各 profile で mount する（軽い） | Dex 0 → seed を差し替えて Dex 1 | F-1 |
| **LC-5 Pizza Select + Shop** | N390 | 長い名前のカード、詳細 sheet の CTA、Shop の最後の行 | P1 |
| **LC-0 harness の自己検査** | — | CDP inset の probe（47 / 34）。viewport を変えた後に `innerHeight` が合っていること | 素通りを防ぐ |

- 状態ごとに巡回する profile は、Chromium が 7 つ（N390 / N360 / S390 / S360 / P390i / E390i / E360i）、WebKit が 4 つ（N390 / N360 / S390 / S360）。
- 「短い状態で mount する」と「nominal から縮める」の両方を入れる。前者は mount したときの sizing の不具合を捕まえる。後者は、ツールバーが出たり引っ込んだりするときの resize への追従を捕まえる。

---

## 7. I5b-3（25 recipe）の後に必要な check

I5b-3 の実際の名前（関数名や export 名）は、merge 後の main に合わせる。値は I5b Fresh Audit と 25-Recipe Economy Audit のもの。

| ID | check | 層 | assertion |
|---|---|---|---|
| R-01 | RECIPES = 25 | Vitest | `RECIPES.length === 25`。id の集合 = 旧 15 + W1 10（完全一致） |
| R-02 | 入手可能な材料 = 29 | Vitest と E2E | Vitest: starter 3 + ladder 26 = 29、ingredient catalog も 29。E2E: HOME と Inventory が「所持 N/29種」、HOME と Dex が「レシピ N/25」 |
| R-03 | ladder = 24 step | Vitest | `DISCOVERY_LADDER` が `W1_25_DISCOVERY_LADDER` と一致する。2 材料の step は 11（black-olive + oregano）と 24（fontina + gorgonzola）だけ。Dex 25 では何も解放されない |
| R-04 | 進み方の順番が正確 | Vitest | 新規 save から key recipe を順に発見するシミュレーション。発見が n 回になったとき、ちょうど step n の材料が NEW になる（Economy Audit §3 の表と完全一致）。deadlock 0 |
| R-05 | new10 を発見できる | Vitest と E2E | Vitest: W1 の 10 件それぞれについて、その `requiredIngredients` を Free Cooking の matcher に渡すと、その recipe に解決する（他の recipe との衝突 0）。E2E: Melanzane（step 4 の key）を、実ブラウザの Free Cooking で発見する（1 本） |
| R-06 | new7 の Shop activation | Vitest と E2E | Vitest: eggplant / corn / pineapple / clam / fresh-tomato / potato / capers がそれぞれ、決められた step で NEW になる（4 / 9 / 10 / 19 / 20 / 21 / 23）。tier、価格、pack も一致する。E2E: Dex 4 で eggplant が NEW → 購入 → OWNED |
| R-07 | W1 の reference fixture | Vitest | RECIPES の全件に `REFERENCE_PIZZAS` がある。piece 数は 9 / 10 / 9（Parmigiana / Portuguesa / Puttanesca）、残りは 7。最小間隔と最大半径は I5b-2 の値。fixture どおりに置けば Pieces = 100 |
| R-08 | high-piece recipe | E2E と Human | rt01 harness を本物の recipe（Parmigiana、Portuguesa、Puttanesca）に差し替える。popover と mini 見本で piece が重ならない。LC-2 で Portuguesa を巡回する。動画 B |
| R-09 | CUT 9 件 | Vitest | `CUT_ELIGIBLE_RECIPE_IDS` は旧 15 + W1 9 = 24 件。new-haven-apizza は含まない。W1 の 9 件は 6 切れ |
| R-10 | New Haven は CUT なし | Vitest と E2E | Vitest: `postBakeSteps` が空、「取り出す！」の後の phase が RESULT。E2E（New Haven、FREE と Lunch Rush）: 「カット / 切る」のタブが一度も出ない。POST_BAKE を経ない。RESULT に CUT の要約が無い。Timing の詳細に CUT の行が無い |
| R-11 | save の roundtrip | Vitest と E2E | W1 の id（dex、owned、inventory、ledger）を持つ save を読み、書き戻すと byte 単位で同じになる。migration A〜G（I5b Fresh Audit §11）。未知の id を保持する。E2E: 既存の `save-forward-compat` を W1 の id で更新する |
| R-12 | Lunch Rush の候補 | Vitest | 出題候補 = 発見済み ∩ 作れるもの。未発見の recipe は出ない。在庫 0 でも所持していれば出る（既知の制約 F-16 を**そのまま pin する**。直さない）。New Haven の注文は CUT なしで serve される。注文のセリフは承認済みの文言 |
| R-13 | 3 材料の通知の置き換え | E2E と Vitest | `progression2-discovery-ladder` の「step 14 で 3 材料」を「step 11 / 24 で 2 材料」に置き換える。3 材料の layout は component test で守る |
| R-14 | Pizza Select の 25 件 | Vitest と E2E | 章の boundary（OD-PS-4 の決定どおり）、長い名前が 2 行以内（L-L） |
| R-15 | Economy の見え方 | Human | Economy Audit の推奨: step 4（eggplant）の場面で、Pitz と価格を1回見る（動画 A の延長、または screenshot） |

---

## 8. Visual Gate

### 8.1 screenshot で足りるか、video が必要か

| 対象 | 判定 | 理由 | 何を撮るか |
|---|---|---|---|
| sausage の見た目 | **screenshot** | 静止した形の識別の問題 | 並べた比較: tray / pizza（焼く前と後）/ thumbnail × pepperoni / bacon / ham。**OD-VIS-1 を I5b の範囲で実装した場合だけ**必要。実装しない場合は「既知: 🌭」と記録する |
| new7 の材料の見た目 | **screenshot** | 見分けられるかは静止画で判定できる。clam / capers / fresh-tomato は I5a で Visual Gate を通っているので、regression の確認だけ | 一覧: tray の chip、生の pizza、焼いた pizza、Shop の行、Inventory、RESULT |
| high-piece pizza | **video が必要**（B） | 混んだ pizza に置く感触（`findOpenSpot`）は動きの中でしか分からない | 見本と popover は screenshot でも撮る |
| 長い recipe 名 | **screenshot** | 静止した layout | Pizza Select、RESULT の見出し、Dex、注文の吹き出し × 390 / 360 |
| pager | **video が必要**（B） | ページを切り替える操作と、ヒントを開いたときに下の bar に隠れないことは、連続で見て初めて分かる | S360 と inset の screenshot でも補う |
| HOME | **screenshot** | Dex 0 と Dex 1 の比較は静止画で足りる | 発見の前後で骨格がジャンプしないことは、動画 A の中でも映る |
| Pizza Select | **screenshot** | 4 状態は静止画で足りる | — |
| BAKE | **video が必要**（B / C） | 時間の制約つきで「取り出す！」を押す動作。Guide のフェード | — |
| CUT | **video が必要**（B） | gesture | — |
| New Haven の CUT なし | **video が必要**（C） | 工程が「無いこと」は、流れとして見せないと確かめられない | RESULT は screenshot でも撮る |

---

## 9. Video scenario（最小本数: 3 本）

すべて 390×844、MP4 / H.264、30 秒〜2 分。repository には commit しない（Policy §6）。seed の save を使って、目的の場面まで早く進める（seed の JSON は Result Report に書く）。

| 動画 | save | 流れ | 確認すること |
|---|---|---|---|
| **A: 最初の進行** | 新規 save | HOME Dex 0 → Free Cooking で Margherita を発見 → NEW MATERIAL（egg）→ Shop で購入 → Free Cooking で Bismarck を発見 → HOME Dex 2（骨格が同じ） | HOME の CTA、発見の流れ、Shop、2 回目の発見 |
| **B: high-piece W1 と pager** | Dex 12 前後（ham / egg / onion / black-olive を所持） | Pizza Select（長い名前、NEW / LOCKED）→ Portuguesa（10 個）→ TOPPING で pager を切り替える → ヒントを開く → 焼く → BAKE で「取り出す！」→ CUT → RESULT | pager と bar、high-piece の配置、BAKE の CTA、CUT、RESULT |
| **C: New Haven と Lunch Rush** | Dex 19 以上（clam / garlic / parmigiano / olive-oil を所持、Lunch Rush が解放済み） | New Haven: olive-oil を塗る → clam → BAKE → **CUT なしで** RESULT → HOME → Lunch Rush 1 注文（HUD、BAKE の CTA）→ serve → Lunch Rush RESULT | CUT が無いこと、HUD があるときの CTA |

- 削った案:
  - Dex 15 の migration 動画: screenshot（Shop の NEW 3 件、25 枚のカード）と Vitest（R-11）で足りる。
  - short viewport の動画: 動画は 390×844 を基準にする（Policy）。短い表示領域は、geometry と Owner の iPhone（§13）で確かめる。
- 決まりの確認（Policy §8）: 各動画に ffprobe の codec / resolution / duration / size を付ける。`Video Verification: PASS` を記録する。

---

## 10. Chromium と WebKit の分担

原則: **同じ検証を複数の層で重ねない。** 各 check は、それを捕まえられる**一番安い層**に置く。engine の違いが意味を持つものだけを WebKit に置く。

| 層 | 置くもの | 置かないもの |
|---|---|---|
| **Vitest** | R-01〜R-07、R-09、R-11、R-12、R-13 の data 部分。ladder、fixture、CUT allowlist、save、Lunch Rush の pool、Pizza Select の状態の派生と文言（EP1 の文言が無いこと）、HOME の DOM の順番と class（2+1）、pager の場所を確保する要素があること | pixel、scroll、重なり |
| **Chromium** | Layout Contract（LC-0〜5）を **全 7 profile で巡回**する（inset は Chromium でしか出せない）。失敗の evidence をいちばん豊富に残す（trace） | 既存の全 spec を CI で重ねること（CI の WebKit Full と機能が重複する）。Full Chromium は local で、Result Report に記録する |
| **WebKit** | 既存の全 spec（N390 / N360。今の WebKit Gate）+ **Layout Contract を S390 / S360 で**（inset なし）。**WebKit でしか意味がない check** は次の表 | CDP の inset |
| **Human** | 実機の動的なツールバー、本物の safe-area、touch の感触、見た目の識別（new7、sausage）、BAKE の時間の感触 | 数値の assertion で済むもの |

**WebKit が必須のもの**（Chromium では代わりにならない）:

| check | 理由 |
|---|---|
| L-H（HOME のラベルの行数） | 日本語の折り返しは、フォントの metric と `word-break` の実装で決まる。Chromium では 2 行でも、WebKit では 3 行になることがある |
| L-L（recipe 名の行数） | 同上。12 文字の「ニューヘイブンアピッツァ」 |
| L-J（タブのラベルが省略記号にならない） | 同上（11px、`nowrap`） |
| L-F（BAKE の CTA）の S360 | 吹き出しと caption の折り返しの行数で、高さが変わる |
| `dvh` を使った dough の縮小式 | WebKit の `dvh` の解決（Desktop Safari の範囲で） |
| gesture の flow（既存） | pointer event の実装の差 |

---

## 11. CI の時間

### 11.1 Gate の役割

| Gate | 中身 | いつ走るか | 時間（見積もり） | 変更 |
|---|---|---|---|---|
| **Fast Gate**（`ci.yml` の `build`） | CI script の test、lint、Vitest、build | PR ごと | 今と同じ + Vitest の追加分（R-*、数秒） | なし |
| **Layout Contract（Chromium）** — **新規、OD-V-1** | LC-0〜5 を 7 profile で。classify job の結果を使う（docs だけの変更なら skip） | PR（条件付き）、main への push | wall 約 2〜3 分（npm ci、cache した Chromium の install、6 test を 2 worker で約 1 分）。**WebKit と並行して走る**ので、critical path（WebKit 約 4.5 分）は延びない | 新しい job（workflow の変更。I5b-5 の実装 PR で行う） |
| **Full Chromium** | 既存の全 spec + LC、N390 / N360 | local（PR を出す前）。Result Report に件数と時間を書く | 約 4.5 分 | CI には入れない（機能は WebKit Full と重複する） |
| **Conditional WebKit**（今の WebKit Gate） | 既存の全 spec + LC を S390 / S360 で（`webkit-390x844` project だけで走らせ、`webkit-360x800` では意図した `test.skip` にする） | 今と同じ（classifier、push、dispatch、label） | shard ごとに LC で +約 30〜40 秒。BS-10 の重複をなくすと −約 60 秒。**差し引きはほぼ 0 か、短くなる** | spec の追加と、重複した test の project guard |
| **Human Gate** | 動画 A / B / C、screenshot、Owner の iPhone checklist | UI の PR ごとに1回（push ごとではない） | — | — |

### 11.2 時間を増やさないための工夫

1. **profile を project にしない。** 1 回の flow の中で `setViewportSize`（と CDP の inset）を切り替えて巡回する。flow を再生し直すのは 1 回だけ。
2. **viewport を強制する test を 1 project に絞る**（BS-10、OD-V-6）。例: `dynamic-cooking` C の 360×800 強制は、`*-360x800` project でだけ走らせる。
   - 残りの project では、意図した `test.skip` にする。
   - WebKit の shard evidence は `expectedStatus: skipped` を認めている（`webkit-shard-evidence.mjs` の self-test「intentional test.skip is allowed」）。両方の project の一覧は同じままなので、Gate の「両方の viewport が同じ test を一覧に出すこと」も満たす。
3. LC の WebKit 分は `webkit-390x844` でだけ走らせる。LC は幅 360 も自分で巡回するので、`webkit-360x800` で重ねない。
4. shard の数（2 × 2）は変えない。LC は 6 test しかないので、`fullyParallel` によって shard に分散する。

---

## 12. 失敗したときの evidence

「CI failed」だけで原因が分からない状態をなくす。

| evidence | どこで作るか | 残す条件 | 保存先 |
|---|---|---|---|
| **layout JSON**（下に中身） | layout helper が `testInfo.attach` で添付する | LC の全ての状態 × profile（1 件あたり約 2KB。LC 全体で 100KB 未満）。失敗したものには `FAIL` の印を付ける | html report、`test-results/` |
| **注記つき screenshot** | 失敗した状態で、test の側から slot の枠と名前を描く overlay を注入し（test の DOM 注入。production ではない）、`page.screenshot` を撮る | 失敗したときだけ | 同上 |
| 通常の screenshot | config の `screenshot: "only-on-failure"` | 失敗したときだけ（全 spec） | 同上 |
| **trace** | config の `trace: "retain-on-failure"` | 失敗したときだけ。DOM snapshot から box を後で調べられる | `test-results/`（CI では artifact として 14 日間） |
| video | `video: "off"`。trace の snapshot で足りる。WebKit での録画のコストを避ける | — | — |
| **job summary** | LC の job が layout JSON の FAIL を集め、`$GITHUB_STEP_SUMMARY` に表で書く（invariant、profile、状態、差分の px） | 失敗したとき | Actions の画面 |

**layout JSON の中身:**

- `profile`（ID、幅、高さ、inset を与えた方法: `cdp` / `none`）、engine と version
- `innerWidth` / `innerHeight`、`visualViewport` の width / height / offsetTop、`devicePixelRatio`
- 実測した `sat` / `sab`（probe で読んだ値。**与えた値ではなく、実際に効いた値**）
- 画面の状態: mode（FREE / guided / Lunch Rush）、phase、makingStep、tray のページ番号 / ページ数、ヒントを開いているか、recipe id
- slot の rect（header、tabs、orderCard、stage、dough、tray、chips[]、pager、ctaBar、primaryCta、hud）
- `scrollingElement` の scrollHeight / clientHeight / scrollWidth、`.game-screen` の sh / ch、`scrollY`（`scrollBy` の前と後）
- `elementFromPoint` の結果（CTA、chip、pager のボタンの中心で、何が返ったか）
- 各 invariant の判定: ID、期待値、実際の値、差分の px

config（`screenshot`、`trace`）と workflow（artifact、summary）の変更は、I5b-5 の実装 PR で行う（今回は変更しない）。

---

## 13. Human Verification の checklist（Owner の iPhone）

**Owner に 360 と 390 の両方を求める必要はない。** Owner が普段使っている iPhone 1 台で足りる。

- 360 幅は Android に多い幅。Automation（Chromium と WebKit の S360 / E360i）で守る。
- 実機でしか分からないもの（動的なツールバー、本物の safe-area、touch、フォント）は、1 台で確認できる。
- 記録すること: 端末の機種、iOS の version、Safari か、ホーム画面に追加したアプリか。

確認する状態: **Safari で開き、下のツールバーが出ている状態**（いちばん狭い状態）。ホーム画面に追加して遊んでいる場合は、その状態でも 1 回見る（OD-V-5）。

| # | 確認すること | ✓ |
|---|---|---|
| 1 | はじめて遊ぶ状態のホームで、ボタンが丸くならず、文字が 1〜2 行で読める | |
| 2 | 1 枚目のピザを見つけた後も、ホームのボタンの並び方がほとんど変わらない | |
| 3 | 材料のページを切り替えても、材料やページ切り替えのボタンが下のボタンに隠れない | |
| 4 | ヒントを押しても、材料や「焼く！」ボタンが隠れない | |
| 5 | 「焼く！」ボタンがスクロールせずに押せる | |
| 6 | 焼いている間、「取り出す！」がスクロールせずに見えて、すぐ押せる | |
| 7 | ランチラッシュでも、上の時計や注文の表示があるまま「焼く！」「取り出す！」が押せる | |
| 8 | 切る画面で、ピザ全体と下のボタンが見える | |
| 9 | ニューヘイブンは、焼いた後に「切る」が出ずに結果の画面になる | |
| 10 | ピザを選ぶ画面で、長い名前が途中で切れたり、カードからはみ出したりしない | |
| 11 | 新しい材料（なす、コーン、パイナップル、あさり、生のトマト、じゃがいも、ケッパー）が、お店・材料の一覧・ピザの上で見分けられる | |
| 12 | 画面のいちばん上（時計、ノッチ）といちばん下（ホームバー）に、ボタンや文字がかぶらない | |
| 13 | ピザを作っている間、画面全体が上下に動かない（引っぱっても、ずれたままにならない） | |
| 14 | （ソーセージの絵を直した場合だけ）ソーセージがホットドッグに見えない | |

どれかが NG のときは、その画面の screenshot（iPhone の画面収録でもよい）を添えて返してもらう。

---

## 14. I5b-5 PASS の定義（Final Merge Gate とは別）

**I5b-5 PASS** は、次の条件を**すべて**満たしたときだけとする。

| # | 条件 |
|---|---|
| P-1 | **exact HEAD を記録している**: 検証した commit SHA、その base の main の SHA、I5b-3 と I5b-4 が main に入った commit |
| P-2 | **Fast Gate が green**: Vitest（全件）、typecheck、lint、build |
| P-3 | **25 recipe の check が green**: §7 の R-01〜R-14 のうち、自動化するものがすべて green |
| P-4 | **Full Chromium が green**（N390 / N360。local。件数と時間を記録する） |
| P-5 | **Short viewport の geometry が green**: LC-0〜5 の P0 invariant（L-A〜L-G）が、Chromium の全 7 profile で 0 件の失敗。P1 の失敗は 0 件、または Owner が受け入れたもの。advisory（L-N）は値を記録する |
| P-6 | **WebKit Gate が green**: exact HEAD の Full WebKit（LC の S390 / S360 を含む）の run URL を記録する |
| P-7 | **screenshot の evidence がそろっている**: `docs/reports/screenshots/progression2-w1-i5b5/` に §8 の一覧 |
| P-8 | **必要な動画がそろっている**: A / B / C を直接渡し、それぞれ `Video Verification: PASS`（ffprobe の値つき） |
| P-9 | **Human PASS**: §13 の checklist がすべて ✓。✓ でない項目は、Owner が明示的に受け入れたものだけ |
| P-10 | P0 の finding が open のまま残っていない |

**無効化のルール:** P-6 から P-9 の後に `src/**` や CSS が1行でも変わった場合は、次をやり直す。

- P-2、P-5、P-6 は、必ずやり直す。
- 影響する動画と checklist の項目もやり直す。
- P-1 の SHA も更新する。

**Final Merge Gate（別に定義する。I5b-5 PASS はその前提条件の1つにすぎない）:**

- Owner が PR の作成と merge を許可していること
- merge する head で、`ci.yml` と WebKit Gate（と、採用されていれば Layout Contract）が green であること
- merge conflict が無いこと
- handoff が更新されていること
- Owner が merge を承認していること

---

## 15. Owner Decisions

| ID | 問い | 推奨 |
|---|---|---|
| **OD-V-1** | Chromium の Layout Contract job を CI に足すか（CDP の inset は Chromium でしか出せない。足さない場合、inset の検証は local だけになる） | **足す。** classifier の条件つきで、WebKit と並行して走らせる。required にする |
| **OD-V-2** | 包絡条件（E390i / E360i: 短い表示領域 + inset 47/34）を hard gate にするか | L-A / L-B / L-C / L-F / L-G（CTA と重なり）は **hard gate**。L-N（dough の大きさ）は advisory。inset の値は 47（59 は採らない） |
| OD-V-3 | Owner の実機確認は 1 台（390 系の iPhone）でよいか | **1 台でよい。** 360 は automation で守る |
| OD-V-4 | 最悪の profile での dough の直径の下限 | I5b-4b の実装後に E360i で実測してから決める（advisory として記録を始める） |
| OD-V-5 | ホーム画面に追加した状態（PWA）も Human で見るか | Owner が普段その状態で遊んでいる場合だけ。自動化では P390i で守る |
| OD-V-6 | viewport を強制する test を 1 project に絞るか（BS-10） | **絞る。** I5b-5 で e2e の hygiene として行う（検出力は変わらない） |
| OD-V-7 | sausage の見た目を I5b-5 の Visual Gate に入れるか | OD-VIS-1 を I5b の範囲で実装した場合だけ入れる。I6 に送るなら「既知」と記録する |

---

## 16. Blocker とリスク

| # | 内容 | 扱い |
|---|---|---|
| B-1 | **I5b-3 が main に入っていない。** R-* の check は、merge 後に走らせる | 順番: I5b-3 → I5b-4 → I5b-5 |
| B-2 | **I5b-4 の修正が main に入っていない。** 今の main で LC を走らせると、P0 の invariant が失敗する（I5b-4 が計測済み） | LC は I5b-4 の実装の後で green にする。`test.fail` や `skip` で隠さない |
| B-3 | WebKit は sandbox では起動できない（`/opt/pw-browsers` に Chromium しかない） | 既存の手順どおり、GitHub Actions の `workflow_dispatch` で Full WebKit を走らせる |
| R-1 | CDP の safe-area override は experimental（Chromium だけ） | LC-0 の自己検査で、使えなくなったら fail させる。代わりの手段は §4.1 の b（CSS の注入）。ただし補助としてだけ使う |
| R-2 | Desktop Safari は iOS Safari ではない（BS-8） | Human の checklist（§13）で補う。WebKit の `iPhone` descriptor（`isMobile` / `hasTouch`）へ移すことは、今の WebKit Gate の挙動を変えてしまうので、I5b-5 の範囲外（Future） |
| R-3 | 包絡条件が厳しすぎて、pizza が小さくなりすぎる | OD-V-2 と OD-V-4（L-N は advisory にする） |

---

STOP GATE: 設計はここで終わり。`src/**`、`e2e/**`、CSS、runtime、Playwright の config、workflow は変更していない。PR も merge もしていない。I5b-3 の branch には書き込んでいない。
