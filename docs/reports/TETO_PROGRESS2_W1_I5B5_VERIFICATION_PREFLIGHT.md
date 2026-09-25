# Progression 2.0 W1 I5b-5: Verification Preflight（STOP GATE）

- 種別: I5b-5 Verification の**実装前の Preflight**。docs だけ。I5b-5 の実装ではない。
  - 変更していないもの: `src/**`、`e2e/**`、CSS、runtime、`playwright.config.ts`、workflow、production code。
  - PR の作成も merge もしていない。
- 監査した main: `12a09de2c4da8ed7e92f1ff9f47dd7bdf824a6e5`（Merge PR #228、I5a）。
  - 作業の開始時に `git fetch origin --prune` を実行し、`origin/main` がこの SHA であることを確かめた。
- Verification Fresh Design: `d4f96d0227830d387ea8813995bd8954eb1d1ce0`（branch `claude/i5b5-verification-design-mch6ne`。main には未 merge）
  - 本 Preflight の planning authority は、この Design と Owner Decisions OD-V-1〜7（§0）。
- I5b-3: `5204a26`（branch `claude/teto-pizza-w1-i4a-j46ph0`。main には未 merge）
- I5b-4: **未完成**。したがって、geometry の閾値、selector の最終値、E360i の dough の下限は、ここでは確定しない（§13）。
- GitHub の実状態（fetch 直後）:
  - I5b-3 / I5b-4 / I5b-5 の PR はまだ無い。
  - CI の classifier に関係する open PR として、#219（Dev CI Phase 2B: non-browser files の WebKit skip）がある（§9.4）。
- machine-readable な implementation matrix: `docs/reports/data/TETO_PROGRESS2_W1_I5B5_PREFLIGHT_MATRIX.json`

---

## 0. Owner Decisions（planning authority）

| ID | 決定 | 本 Preflight での扱い |
|---|---|---|
| OD-V-1 | Chromium Layout Contract job を CI に追加する | §9: `e2e-webkit.yml` に `layout-chromium` と `Layout Contract Gate` を足す |
| OD-V-2 | E profile の CTA と重なりの invariant は hard gate。dough の大きさは advisory | L-A/B/C/E/F/G は `expect.soft` から最後に fail させる。L-N は evidence に記録するだけで、fail させない |
| OD-V-3 | Human Verification は実 iPhone 1 台。360 幅は automation で担保する | 360 幅は N360/S360/E360i（Chromium）と N360/S360（WebKit）で担保する |
| OD-V-4 | dough 直径の下限は、I5b-4 の後に E360i で実測するまで保留 | L-N は値の記録だけ。閾値の欄は `null` のままにする（§13） |
| OD-V-5 | ホーム画面に追加した状態は、普段その状態で遊ぶ場合だけ Human の対象 | automation の P390i は常に走らせる。Human は条件つき |
| OD-V-6 | viewport を強制する重複 test は、1 project に整理する | §10: 8 test に project guard を入れる |
| OD-V-7 | OD-VIS-1 を I5b で実装した場合だけ、sausage を Visual Gate に入れる | §12: 条件つきの行として置く |

---

## 1. 現在の Playwright 構造（main `12a09de`。実物で確認した）

| 対象 | 実体 | Preflight で分かったこと |
|---|---|---|
| `playwright.config.ts` | `testDir: ./e2e`、`fullyParallel`、`retries: 0`、reporter `list`。`use` は `baseURL` だけ。project は `iphone-390x844` / `iphone-360x800`（Desktop Chrome）と `webkit-390x844` / `webkit-360x800`（Desktop Safari）。`webServer` は vite の 5183 番 | screenshot / trace / video はすべて off。`testMatch` と `testIgnore` は既定値のまま |
| spec | 14 本、71 test。project あたり 71 件、Chromium の 2 project で合計 142 件 | 各 spec が、`assertOneScreen` / `expectNoHorizontalOverflow` / `expectFullyVisible` などの helper を**自分の中で**定義している（共有の module は無い） |
| `e2e/gestures.ts` | 共有 helper は `gestures.ts` だけ（674 行）。`bakeToTarget`（`page.clock` を使う）、`completeDoughStep`、`paintSauceRing`、`tapDoughPercent`、`cutThreeLines`、`start*` の seed 群、`startLunchRushMission` | `bakeToTarget` は「焼く」を押す → pause → 針を合わせる → 「取り出す！」を押す、までを1つにまとめている。BAKE の途中で止めて測る入口が無い（§6） |
| `e2e/harness/` | rt01 の reference harness（`section=shipped` は `RECIPES` を全件描く） | I5b-3 で 25 件になる（§11） |
| viewport を強制する test | `setViewportSize` を使うのは 8 test（§10） | Chromium と WebKit の両方で、同じ条件のまま 2 回ずつ走っている |
| 名前に「360x800」と付いているが強制していない test | `finished-pizza-visual` D、`result-1screen` B、`timing-transparency` B、`lunch-rush-result-ranking` の 360 ブロック | project の viewport で走るので、重複ではない（両方の幅で意味がある）。名前が誤解を招くだけ。整理は I5b-5 の範囲外（任意） |
| `ci.yml` | PR ごとに `build` job を1つ: `test-webkit-ci.sh`、lint、`npm test`、build | Chromium の E2E は走らない |
| `e2e-webkit.yml` | `classify` → `webkit`（2 project × 2 shard の静的 matrix）→ `WebKit Gate`（`always()`） | shard ごとに evidence（`--list` と json）を artifact にし、Gate で「全件がちょうど1回走って pass した」ことと「両方の project が同じ test を list に出した」ことを検証する |
| classifier | `scripts/ci/classify-webkit.mjs`（`docs/**`、runtime tree の外にある `*.md` だけなら skip。それ以外は Full。fail-safe）。ラッパーは `classify-webkit-pr.sh`（label `webkit-full`、前の head の evidence の再利用） | 出力は `webkit_required` / `reason` / `tested_base` |
| shard evidence | `scripts/ci/webkit-shard-evidence.mjs`。test の key は `file › title path`（project に依存しない）。`status=skipped` かつ `expectedStatus=skipped` の test は「intentionally skipped」として通す（self-test あり） | **OD-V-6 の project guard（`test.skip(cond)`）は、今の verifier のままで通る。** 両方の project が同じ list を出すという条件も満たす |
| artifacts | shard evidence（14 日）と `playwright-report/`（html、14 日） | `test-results/`（失敗したときの添付）は upload していない |
| Chromium の version | Playwright 1.56.1 / Chromium 141.0.7390.37（`/opt/pw-browsers/chromium-1194`） | Design の CDP 実測と同じ build |

### 1.1 実測: Chromium の全 E2E を I5b-3（`5204a26`）で走らせた結果

scratch の worktree（repo の外）で、`iphone-390x844` と `iphone-360x800` を走らせた。file は変更していない。

- 142 test、2 worker、**267 秒**。expected 130、**unexpected 12**、flaky 0、skipped 0。
- 失敗は **4 spec の 6 test × 2 project**。どれも production の不具合ではなく、**I5b-3 の authority に合わない古い assertion**。§11 で扱う。

---

## 2. Layout Contract spec の配置

| file | 役割 | 新規 / 変更 |
|---|---|---|
| `e2e/layout-contract.spec.ts` | LC-0〜LC-5（6 test）。flow を進め、各状態で profile を巡回する | 新規 |
| `e2e/support/layoutProfiles.ts` | 7 profile の定義、`applyProfile`、CDP の safe-area helper、engine ごとの profile の集合 | 新規 |
| `e2e/support/layoutMeasure.ts` | slot の selector map、1 回の `page.evaluate` による geometry の計測、`elementFromPoint` の probe | 新規 |
| `e2e/support/layoutInvariants.ts` | L-A〜L-O の判定（純粋関数。入力は計測値、出力は `{id, pass, expected, actual, deltaPx}`） | 新規 |
| `e2e/support/layoutEvidence.ts` | evidence JSON の蓄積と attach、注記つき screenshot の overlay | 新規 |
| `e2e/support/seeds.ts` | W1 の seed save（Dex 4 / 12 / 19 / 23、migration D、Lunch Rush が解放済みのもの）。JSON は Result Report にも写す | 新規 |
| `e2e/support/projectGuard.ts` | OD-V-6 の `runOnlyOnWidth(testInfo, 390 \| 360)` | 新規 |
| `e2e/gestures.ts` | `bakeToTarget` を2つの関数（`enterBakePaused`、`landNeedleAndTakeOut`）に分けて組み直す。`bakeToTarget` の外から見た挙動は変えない | 変更（e2e） |
| `scripts/ci/layout-summary.mjs` | evidence JSON の FAIL 行を集めて `$GITHUB_STEP_SUMMARY` に表を書く（`--self-test` あり） | 新規 |
| `scripts/ci/layout-gate.sh` | `Layout Contract Gate` の判定（`webkit-gate.sh` と同じ形。`webkit-shard-evidence.mjs verify` を再利用する） | 新規 |
| `scripts/ci/test-webkit-ci.sh` | layout gate と summary の真理値表を追加する（`ci.yml` の既存の step で走る） | 変更 |

- `e2e/support/*.ts` は、Playwright の既定の `testMatch`（`*.spec.ts` / `*.test.ts`）に当たらないので、test として数えられない。
- `gestures.ts` は e2e の直下に置いたままにする。移すと、既存の 14 spec の import を全部書き換えることになる。
- 各 spec が自分の中で持っている `assertOneScreen` などは、**I5b-5 では移さない**。LC の helper は新しい module に置き、既存の spec の検出力を変えない。

### 2.1 project の構成（`playwright.config.ts`、I5b-5 実装で変更する）

| project | engine | 既定の viewport | `testMatch` / `testIgnore` | LC の profile |
|---|---|---|---|---|
| `iphone-390x844` | Chromium | 390×844 | `testIgnore: /layout-contract\.spec\.ts$/` | —（重ねない） |
| `iphone-360x800` | Chromium | 360×800 | 同上 | — |
| **`layout-chromium`**（新規） | Chromium（Desktop Chrome） | 390×844 | `testMatch: /layout-contract\.spec\.ts$/` | **7 つ全部**: N390 / N360 / S390 / S360 / P390i / E390i / E360i |
| `webkit-390x844` | WebKit | 390×844 | 全 spec（今のまま） | **N390 / S390**（自分の幅だけ） |
| `webkit-360x800` | WebKit | 360×800 | 全 spec（今のまま） | **N360 / S360**（自分の幅だけ） |

- Design §11.2 の案3（「LC は `webkit-390x844` でだけ走らせ、`webkit-360x800` では `test.skip`」）は採らない。代わりに **WebKit の各 project が、自分の幅の N と S だけを巡回する**。理由は次のとおり。
  - skip が 0 件になる。
  - 両方の project が同じ test を list に出す（Gate の条件を満たす）。
  - 時間が 2 つの project に分かれる。
  - 全体で巡回する profile の集合は、Design（WebKit では N390 / N360 / S390 / S360）と変わらない。
- profile の集合は `testInfo.project.name` と `browserName` から決める（`profilesFor(testInfo)`）。どの project でもない名前が来たら throw して fail させる（知らない project で黙って 0 件になるのを防ぐ）。
- config の既定の `trace` と `screenshot` は §8 のとおり。

---

## 3. LC-0〜LC-5 を今の Playwright 構造に mapping する

凡例: `C7` = Chromium の 7 profile、`W2` = WebKit で自分の幅の N と S。

| test | 始めるときの状態 | 使う既存資産 | 巡回する状態（→ は flow の進行） | profile | hard（P0） | P1 / advisory | 1 test の見積もり |
|---|---|---|---|---|---|---|---|
| **LC-0 harness self-check** | 空の app（`/`）。seed なし | なし | (a) 各 profile を適用するたびに、`innerWidth` / `innerHeight` / `visualViewport.height` が profile と一致すること。(b) Chromium では probe が 47/34 を返し、N / S に戻すと 0/0 を返すこと。(c) WebKit では、inset 付きの profile が1つも選ばれておらず、probe が 0/0 を返すこと | C7 / W2 | 全部 fail 扱い（skip しない） | — | 5〜10 秒 |
| **LC-1 FREE** | seed「W1 Dex 23、topping 22 種を所持」（tray が 4 ページ）。**S360 で mount**（W では S の幅） | `completeDoughStep`、`paintSauceRing`、`tapDoughPercent`、新しい `enterBakePaused` | DOUGH → SAUCE → CHEESE → TOPPING p1 → ヒントを開く → p2 → 最後のページ → 焼く（入った直後、pause 中）→ Guide が消えた後（virtual +7.3 秒）→ 取り出す → RESULT | C7 / W2 | L-A, L-B, L-C, L-D, L-E, L-F | L-I, L-J, L-K, L-M, L-N | 40〜60 秒 |
| **LC-2 guided high-piece** | seed「W1 Dex 12。Portuguesa を発見済み。ham / egg / onion / black-olive を所持」。**N390 で mount し、状態ごとに縮める** | Pizza Select → このピザを作る、`bakeToTarget` 相当、`cutThreeLines` | TOPPING（10 個を置いた後）→ BAKE（直後だけ）→ CUT → RESULT | C7 / W2 | L-A, L-D, L-E, L-F（直後）, L-B | L-J, L-K, L-N | 40〜60 秒 |
| **LC-3 Lunch Rush** | seed「Lunch Rush が解放済み。注文される recipe の材料を所持」。S360 で mount | `startLunchRushMission`、`bakeToTarget` 相当 | PREPARE（TOPPING）→ BAKE（直後 + fade 後）→ CUT → serve → mission RESULT | C7 / W2 | L-A, L-B, L-C, L-E, L-F, **L-G** | L-J, L-K | 50〜70 秒 |
| **LC-4 HOME** | 各 profile で mount し直す（`page.goto`。軽い） | 既存の Dex 0 の seed（`localStorage.clear()`） | Dex 0 → seed を差し替え（`addInitScript` + reload）→ Dex 1 | C7 / W2 | L-A, L-D | **L-H**, L-I, L-M, **L-O** | 20〜30 秒 |
| **LC-5 Pizza Select + Shop** | seed「W1 Dex 23」。N390 で mount | Pizza Select の grid、Shop overlay | 長い名前のカード（ニューヘイブンアピッツァ）→ 詳細 sheet の CTA → Shop を開き、最後の行まで中で scroll → 最後の行の購入ボタン | C7 / W2 | L-A（sheet の CTA、Shop の最後の行）, L-D | **L-L**, L-I, L-M | 20〜30 秒 |

- **巡回の単位:** 1つの状態で、profile を順に `applyProfile` → 2 rAF 待つ → 計測 → 判定する。判定は `expect.soft` で積み、flow の最後に `expect(testInfo.errors).toHaveLength(0)` 相当で閉じる（Design §5.3）。
  - 巡回の終わりに、**次の flow の操作に使う profile** に戻す。LC-1 と LC-3 は S360 に、LC-2 は N390 に戻す。
  - 各 flow の操作（tap、drag）は、戻した profile の座標で行う。巡回中に操作はしない。
- **BAKE で巡回するときは時間を止める:**
  - `page.clock.pauseAt` で virtual time を止めたまま、全 profile を巡回する（resize では virtual time が進まない）。
  - Lunch Rush の mission timer も同じ clock で止まる。巡回で mission が時間切れになることは無い。
  - 「Guide が消えた後」は `page.clock.runFor(GUIDE_FADE_END_S * 1000 + 100)` で作る。針は往復するので、その後の着地は**向きを考慮して**計算する（`landNeedleAndTakeOut`）。
- **LC-2 は I5b-3 が main に入った後に Portuguesa で書く。** Design にある「I5b-3 より前は Capricciosa で代用」は、I5b-5 が I5b-3 の後に来る順番なので使わない。
- **1 test あたりの evidence の件数:** 状態の数 × profile の数。
  - Chromium では LC-1 が約 10 状態 × 7 = 70 件、全体で約 200 件。
  - WebKit では 1 project あたり約 60 件。

---

## 4. Safe-area と profile の helper

### 4.1 CDP の safe-area helper（`e2e/support/layoutProfiles.ts`）

```ts
// 形だけ示す（実装は I5b-5）
async function setSafeArea(cdp: CDPSession, inset: { top: number; bottom: number } | null) {
  await cdp.send("Emulation.setSafeAreaInsetsOverride", {
    insets: inset ? { top: inset.top, bottom: inset.bottom, left: 0, right: 0 } : {},
  });
}
```

- CDP session は `page.context().newCDPSession(page)` で、test ごとに 1 回だけ作る。
- WebKit では作らない。作ろうとした時点で throw させる（`browserName !== "chromium"` の場合）。

**本 Preflight の scratch での実測**（Playwright 1.56.1、Chromium 141.0.7390.37。`viewport-fit=cover` の最小の HTML。repo には入れていない）:

| 操作 | probe の `env(top)/env(bottom)` | innerHeight |
|---|---|---|
| 既定 | 0px / 0px | 844 |
| override（47/34） | **47px / 34px** | 844 |
| `setViewportSize(360×640)` の後 | **47px / 34px（残る）** | 640 |
| 別の document へ navigate した後 | **47px / 34px（残る）** | 640 |
| `insets: {}` で解除 | 0px / 0px | 640 |

分かったこと:
- **override は resize をまたいでも、navigation をまたいでも残る（session に対してかかる）。** したがって helper は、N / S の profile に切り替えるたびに、**必ず `{}` で解除する**。解除しないと inset が N / S に漏れる。
- LC-0 の (b)「N / S に戻すと 0/0」はこの漏れを検出するための check。
- 解除には空の object を渡す。`null` ではない。

### 4.2 LC-0 の自己検査（Design §4.3-2 の具体化）

- probe: test の側で `<div data-lc-probe style="position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)">` を `document.body` に 1 つ注入する。production の hook ではない。
  - app の document に注入する。`viewport-fit=cover` の meta が効いている document で読むため。
  - 計測するたびに、無ければ作り直す（React の再描画で消える場合に備える）。
- LC-0 は独立した test として置く。**さらに**、`applyProfile` の中でも毎回同じ検査をする（期待した inset と、実際に効いた inset が 1px を超えてずれたら `throw`）。LC-0 だけが通り、途中で inset が効かなくなるケースも止めるため。
- API が消えた、名前が変わったなど（CDP が `Method not found` を返す場合）は、**fail させる**。skip、`test.fail`、CSS の注入への自動 fallback は、どれもしない。
  - fallback（CSS の注入、Design §4.1-b）を採るかどうかは、そのときの Owner の判断にする。

### 4.3 profile を切り替える helper

```ts
type Profile = { id: "N390"|"N360"|"S390"|"S360"|"P390i"|"E390i"|"E360i"; width: number; height: number;
                 inset: { top: number; bottom: number } | null; engines: ("chromium"|"webkit")[] };
async function applyProfile(page, cdp | null, p: Profile): Promise<AppliedProfile>
```

順番:
1. `page.setViewportSize({ width, height })`
2. `setSafeArea(cdp, p.inset)`（Chromium だけ。inset が `null` なら解除する）
3. `requestAnimationFrame` を 2 回待つ（layout と ResizeObserver に反映させるため）
4. probe で `innerWidth` / `innerHeight` / `visualViewport` と inset を読み、profile と照合する（ずれたら throw）
5. `AppliedProfile`（実際に効いた値）を返し、evidence に入れる

- `PROFILES` は Design の表（`d4f96d0` §3.1）をそのまま const にする: N390 390×844、N360 360×800、S390 390×664、S360 360×640、P390i 390×844 + 47/34、E390i 390×664 + 47/34、E360i 360×640 + 47/34。
- inset は 47 に固定（Design OD-V-2 の推奨。59 は採らない）。
- `profilesFor(testInfo)` の返り値:
  - `layout-chromium` → 7 つ
  - `webkit-390x844` → [N390, S390]
  - `webkit-360x800` → [N360, S360]
  - それ以外 → throw

---

## 5. Geometry の計測と `elementFromPoint`

### 5.1 計測 helper（`measureLayout(page, stateLabel)`）

- 1 回の `page.evaluate` で全部を取る。往復を減らし、同じ時点の値にするため。
- slot の selector map は1か所に集める。現在の DOM で確認した候補は次の表のとおり。**最終値は I5b-4 の merge 後の DOM で確定する（§13）。**

| slot | 候補の selector（main `12a09de`） | 備考 |
|---|---|---|
| header | `.app-header` | |
| tabs | `.making-step-tabs` | 各タブは `.making-step-tabs > *` |
| orderCard | `.order-card` | ヒントは `.order-card__hint` |
| stage / dough | `.pizza-stage` / `[data-pizza-drop-target="true"]` | 既存の gestures と同じ |
| tray | `.ingredient-tray` | |
| chips[] | tray の中の、見えている `button`（`.ingredient-chip__name` の祖先） | I5b-4 で class が変わる可能性がある |
| pager | `.ingredient-page-nav`（`前のページ` / `次のページ`） | I5b-4 で「1 ページでも場所を確保する」要素が入る可能性がある |
| ctaBar | `.prepare-bake-bar` | fixed |
| primaryCta | 状態ごとに決める。PREPARE は `.cta-button--bake` / 次へ、BAKE は role button「取り出す！」、CUT は「切り終わる」、RESULT は `.cta-button--primary`、HOME は `.home-cta-row` の中 | 状態 → selector の表として持つ |
| hud | `.mission-hud` | Lunch Rush だけ |
| gameScreen | `.game-screen` | |

- 取る値: `innerWidth/innerHeight`、`visualViewport.{width,height,offsetTop}`、`devicePixelRatio`、probe の inset、各 slot の `getBoundingClientRect()`（存在しなければ `null`）、`scrollingElement` の `scrollHeight/clientHeight/scrollWidth`、`.game-screen` の `sh/ch`、`scrollY`。
- L-E の scroll 検査:
  - `window.scrollBy(0, 200)` を実行し、その後の `scrollY` を読んでから `scrollTo(0, 0)` で戻す。
  - あわせて、CTA の祖先に scroll できる要素（`overflow-y: auto|scroll` かつ `sh > ch`）が無いかを調べる。
- 行数（L-H / L-L）は、`Range.getClientRects()` の `top` を丸めた値の種類数で数える。既存の `progression2-discovery-ladder` の `nameLines` と同じ方法。

### 5.2 `elementFromPoint`（L-A / L-C の「押せること」）

- 対象: primaryCta、見えている chip の全部、pager の各ボタン。
- 方法: 各要素の中心の座標で `document.elementFromPoint(x, y)` を呼び、返った要素が**対象そのものか、その子孫**であれば PASS。
- 中心が viewport の外にあるときは、`elementFromPoint` が `null` を返す。この場合は L-A の「外に出た」失敗として記録する（`null` を PASS 扱いにしない）。
- evidence には、返った要素を短く記録する（`tag.class#id` の先頭 80 文字）。例: 「bar のグラデーションに当たった」を、あとで読めるようにするため。
- 注記用の overlay（§8）は、この検査の**後で**注入する。overlay 自身が当たらないようにするため。overlay は `pointer-events: none` にもする。

### 5.3 判定（`layoutInvariants.ts`）

- 入力は計測値だけにした純粋関数。I5b-5 の実装では、この module の小さな unit test を Vitest から走らせてもよい（e2e の module を `src` 側の test から import しないように、場所は実装時に決める）。
- 許容誤差 `TOL = 1px`（既存の spec と同じ）。
- **Design に書かれた定数だけを使う:** L-B の 8px、L-H の高さ ≤ 64 と縦横比 ≥ 1.6、L-M の 44px。
  - **現在の main の失敗値に合わせて変えない。** I5b-4 の実装後に、これらの定数で PASS することを確かめる。
  - 定数を変える必要が出た場合は、Owner の判断として記録する（§13）。
- L-N（dough の直径）は `floorPx: null`。計測値だけを evidence に記録し、判定は `advisory` とする。

---

## 6. Profile ごとの mapping（N / S / P / E）

| profile | viewport | inset | どの test / project で巡回するか | 意図 | gate |
|---|---|---|---|---|---|
| **N390** | 390×844 | — | LC-0〜5（`layout-chromium`、`webkit-390x844`）。既存の全 spec の既定（`iphone-390x844` / `webkit-390x844`） | 基準の機能 | hard |
| **N360** | 360×800 | — | LC-0〜5（`layout-chromium`、`webkit-360x800`）。既存の全 spec（`*-360x800`） | 基準の機能（360） | hard |
| **S390** | 390×664 | — | LC（`layout-chromium`、`webkit-390x844`） | ツールバーを出したときの 390 | hard（P0） |
| **S360** | 360×640 | — | LC（`layout-chromium`、`webkit-360x800`）。LC-1 と LC-3 の mount profile | 最小の表示領域 | hard（P0） |
| **P390i** | 390×844 | 47 / 34 | LC（`layout-chromium` だけ） | ホーム画面に追加した PWA | hard（P0） |
| **E390i** | 390×664 | 47 / 34 | LC（`layout-chromium` だけ） | 包絡条件（I5b-4 の再現条件） | CTA / 重なり = **hard**（OD-V-2）。dough = advisory |
| **E360i** | 360×640 | 47 / 34 | LC（`layout-chromium` だけ） | 包絡条件の最悪値（有効な高さ 559px） | CTA / 重なり = **hard**。dough = advisory。**下限は保留**（OD-V-4） |

- 「短い状態で mount する」（LC-1、LC-3）と「nominal から縮める」（LC-2）の両方を持つ。LC-4 は各 profile で mount し直す。
- P / E は WebKit では作れない。WebKit の LC-0 は、その集合が空であることを確かめる（§3）。

---

## 7. Layout evidence JSON

- 1 test につき1つの JSON（`layout-evidence.json`）。`testInfo.attach(name, { body, contentType: "application/json" })` で添付する。
  - 添付は html report と json reporter の `attachments[]` に載る。
  - CI の summary script は json reporter の結果から添付のパスを辿って読む。
- **pass した test でも残す**（Design §12。「与えた値ではなく、実際に効いた値」を後から比べられるように）。1 件あたり約 2KB。Chromium の LC 全体で約 200 件、400KB 前後の見積もり。
- 形（schema v1）:

```json
{
  "schema": "teto-layout-evidence/1",
  "test": "LC-1 FREE",
  "project": "layout-chromium",
  "engine": { "name": "chromium", "version": "141.0.7390.37" },
  "headSha": "<GITHUB_SHA or local git rev-parse>",
  "samples": [
    {
      "state": { "mode": "FREE", "phase": "PREPARE", "makingStep": "TOPPING", "trayPage": 2, "trayPages": 4, "hintOpen": true, "recipeId": null },
      "profile": { "id": "E360i", "width": 360, "height": 640, "insetMethod": "cdp", "insetRequested": { "top": 47, "bottom": 34 } },
      "applied": { "innerWidth": 360, "innerHeight": 640, "vv": { "width": 360, "height": 640, "offsetTop": 0 }, "dpr": 1, "sat": 47, "sab": 34 },
      "rects": { "header": { "top": 0, "bottom": 103, "left": 0, "right": 360 }, "pager": null, "ctaBar": {} },
      "scroll": { "docScrollHeight": 640, "docClientHeight": 640, "docScrollWidth": 360, "gsSh": 640, "gsCh": 640, "scrollYBefore": 0, "scrollYAfter": 0, "scrollableCtaAncestor": null },
      "hitTests": [{ "target": "primaryCta", "x": 180, "y": 600, "hit": "button.cta-button.cta-button--bake", "ok": true }],
      "results": [{ "id": "L-B", "priority": "P0", "pass": false, "expected": ">= 8", "actual": -80, "deltaPx": -88,
                    "message": "L-B pager/CTA gap @E360i FREE TOPPING p2 hint=open: gap=-80px (need >= 8)" }],
      "advisory": [{ "id": "L-N", "doughDiameterPx": 0, "floorPx": null }]
    }
  ],
  "summary": { "samples": 0, "p0Fail": 0, "p1Fail": 0, "advisoryRecorded": 0 }
}
```

- 上の数値は形を示すための例で、計測値ではない。
- 失敗のメッセージの形は Design §5.3 のとおり: `<ID> <内容> @<profile> <状態>: <差分>`。

---

## 8. 失敗したときの screenshot / trace / video

| 項目 | 設定 | 範囲 | 理由 |
|---|---|---|---|
| 注記つき screenshot | LC の helper が、soft の失敗が出た**その sample で**、slot の枠と ID を描く overlay（`pointer-events: none`、test の DOM 注入）を入れて `page.screenshot` を撮り、attach した後で overlay を外す | LC だけ。失敗した sample だけ | 「どの profile のどの状態で何が重なったか」を1枚で分かるようにする。failure の最後の1枚だけでは、巡回の途中の失敗が映らない |
| 通常の screenshot | config の `use.screenshot: "only-on-failure"` | 全 project | cost が小さい |
| trace | `use.trace: "retain-on-failure"` | **`layout-chromium` の project では必須。** WebKit の project にも入れるが、I5b-5 で WebKit の shard の時間を測り、+10% を超える場合は WebKit では `"off"` に戻す（判断の記録を Result Report に残す） | DOM snapshot から、後で box を調べられる |
| video | `"off"`（全 project） | — | trace の snapshot で足りる。Human の動画は Policy どおり別に撮る |

- `retries: 0` のままにする。retry で失敗を隠さない。
- CI の artifact には、`playwright-report/` に加えて **`test-results/`（trace、screenshot、evidence JSON）** を `if: always()` で upload する（14 日）。

---

## 9. CI の計画

### 9.1 Chromium の Layout Contract job（OD-V-1）

**置き場所:** `.github/workflows/e2e-webkit.yml` に job を 2 つ足す。

- 新しい workflow にしない理由:
  - `classify` job とその出力（docs だけの変更なら skip、fail-safe、label `webkit-full`、evidence の再利用）を**そのまま共有できる**。
  - trigger（PR、main への push、`workflow_dispatch`）と concurrency の方針も同じにできる。
- workflow の `name:` は変えない。check 名の変化を避けるため。新しい check 名は job の `name:` で決める。

```yaml
  layout-chromium:
    name: layout-chromium
    needs: classify
    if: ${{ !cancelled() && (needs.classify.result != 'success' || needs.classify.outputs.webkit_required != 'false') }}
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - checkout / setup-node 22 (cache npm) / npm ci
      - actions/cache ~/.cache/ms-playwright  key: playwright-chromium-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
      - npx playwright install --with-deps chromium
      - Browser installation proof (npx playwright --version; find ~/.cache/ms-playwright -maxdepth 1 -iname 'chromium-*')
      - npx playwright test --list --project=layout-chromium --reporter=json   (LIST_JSON)
      - npx playwright test --project=layout-chromium --reporter=list,html,json (RESULTS_JSON)
      - if: always()  node scripts/ci/webkit-shard-evidence.mjs collect --project layout-chromium --shard 1 --total 1 --attempt ${{ github.run_attempt }} ...
      - if: always()  node scripts/ci/layout-summary.mjs --results "$RESULTS_JSON" >> "$GITHUB_STEP_SUMMARY"
      - if: always()  upload layout-evidence-layout-chromium-shard1-attempt${{ github.run_attempt }}
      - if: always()  upload playwright-layout-report (playwright-report/ + test-results/)

  layout-gate:
    name: Layout Contract Gate
    needs: [classify, layout-chromium]
    if: ${{ always() }}
    steps: sparse checkout scripts/ci -> download layout-evidence-* -> bash scripts/ci/layout-gate.sh
           (REQUIRED_PROJECTS=layout-chromium, LAYOUT_RESULT=${{ needs.layout-chromium.result }})
```

- shard は 1 本（LC は 6 test、2 worker）。matrix にしない。
- `layout-gate.sh` の真理値表は `webkit-gate.sh` と同じ形:
  - docs だけの変更で skip → PASS
  - required で success + evidence が OK → PASS
  - failure / cancelled / skipped / evidence が無い → FAIL
  - classify が失敗 → fail-safe で required
- `test-webkit-ci.sh` にこの表の case を足す（`ci.yml` の既存の step で走る。`ci.yml` 自体は変更しない）。
- `webkit-shard-evidence.mjs` の verify は、required の project が1つでも成り立つ（project 間の比較は2つ目から）。「LC の 6 test が全部ちょうど1回走って pass した」ことを、そのまま証明できる。
- **required check にするかどうか:** job を足すのは I5b-5 の実装 PR。branch の ruleset に `Layout Contract Gate` を足すのは Owner の repo 設定の操作（§13 の入力）。

### 9.2 Actions summary

`layout-summary.mjs` が `$GITHUB_STEP_SUMMARY` に書くもの:

1. 1 行目: `Layout Contract: PASS|FAIL — samples N, P0 fail X, P1 fail Y, advisory Z`
2. FAIL がある場合は表: `| invariant | profile | test / state | expected | actual | Δpx | hit |`。先頭の 50 行まで出し、残りは件数だけ。
3. advisory の表: L-N の dough の直径を、profile ごとに最小値と最大値で出す（OD-V-4 の実測の材料になる）。
4. LC-0 の結果: 効いた inset、engine の version。

- `Layout Contract Gate` の job も、`webkit-gate.sh` と同じ形の verdict の表を summary に書く。

### 9.3 時間の見積もり

| Gate | 今 | I5b-5 の後（見積もり） | 根拠 |
|---|---|---|---|
| Fast Gate（`ci.yml`） | 今のまま | + 数秒（`test-webkit-ci.sh` の case の追加、Vitest の追加分） | `ci.yml` は変更しない |
| **Layout Contract（Chromium）** | なし | **wall 約 3〜4 分**（npm ci 約 0.5〜1 分、Chromium の install と apt の deps 約 0.5〜1 分、LC の 6 test を 2 worker で約 1.5〜2 分）。`timeout-minutes: 10` | §3 の test ごとの見積もりを合計すると約 3〜5 分。2 worker で割ると約 1.5〜2.5 分 |
| critical path | WebKit の wall 約 4.5 分 | **ほぼ変わらない**（Layout は WebKit と並行して走る。3〜4 分 < 4.5 分） | 並行の job |
| WebKit（shard ごと） | 約 4.5 分 | **± 0 前後**: LC の 6 test（自分の幅の 2 profile）で project あたり約 +60〜90 秒、shard あたり約 +30〜45 秒。OD-V-6 で project あたり 4 test が skip になり、shard あたり約 −30〜60 秒 | §10 |
| local の Full Chromium | 267 秒（I5b-3 で実測、142 test、2 worker） | 約 5〜6 分（8 件の重複が消え、`layout-chromium` の 6 test が増える） | §1.1 |

- これらは見積もり。I5b-5 の Result Report で、実測の wall を記録する。

### 9.4 classifier との関係

- LC の job は classify の `webkit_required` をそのまま使う。docs だけの変更では、WebKit と Layout の両方が skip になり、両方の Gate が PASS になる。
- open PR **#219**（Dev CI Phase 2B: non-browser files の WebKit skip）が先に merge された場合、その skip の規則は Layout にも適用される。
  - 基本的には正しい（browser に届かない変更なら layout も変わらない）。
  - ただし、I5b-5 で `e2e/support/**` / `e2e/layout-contract.spec.ts` / `scripts/ci/layout-*` が「browser に届かない」と判定されないことを、#219 の規則に照らして確かめる。これらが変わったら Layout は走るべきだからである。
  - #219 が merge されていない場合は、今の classifier（docs だけなら skip）のままでよい。

---

## 10. WebKit との分担、重複した viewport test の整理（OD-V-6）

### 10.1 分担（Design §10 を今の構造へ）

| check | Chromium（`layout-chromium`） | WebKit（`webkit-*`） | 理由 |
|---|---|---|---|
| LC の N / S | ✓（7 profile の一部） | ✓（自分の幅の N と S） | engine による差（フォント、折り返し、`dvh`） |
| LC の P / E（inset） | ✓ | — | CDP は Chromium でしか使えない |
| L-H / L-L / L-J（行数、省略記号） | ✓ | **✓（必須）** | 日本語の折り返しはフォントの metric で決まる |
| L-F の S360（BAKE） | ✓ | ✓ | 吹き出しと caption の行数 |
| 既存の全 spec（N390 / N360） | local だけ（`iphone-*`）。CI には入れない | ✓ CI（今の WebKit Gate） | 機能の重複を CI で持たない |
| 新しい E2E（§12） | local | ✓ CI | 同上 |

### 10.2 重複した test の整理（8 test）

`e2e/support/projectGuard.ts`:

```ts
export function runOnlyOnWidth(testInfo: TestInfo, width: 390 | 360) {
  const m = /-(390|360)x\d+$/.exec(testInfo.project.name);
  if (!m) throw new Error(`OD-V-6 guard: unexpected project ${testInfo.project.name}`);
  test.skip(Number(m[1]) !== width, `OD-V-6: forces its own viewport; runs once per engine on the *-${width}x* project`);
}
```

| spec | test | 強制する viewport | 走らせる project |
|---|---|---|---|
| `dynamic-cooking-steps` | Scenario A: Marinara @390x844 | 390×844 | `*-390x844` |
| `dynamic-cooking-steps` | Scenario B: Margherita @390x844 | 390×844 | `*-390x844` |
| `dynamic-cooking-steps` | Scenario C: 360x800 Capricciosa | 360×800 | `*-360x800` |
| `making-ui-1screen` | `Margherita one-screen + nav fit @ 390x844`（VIEWPORTS の loop） | 390×844 | `*-390x844` |
| `making-ui-1screen` | `Margherita one-screen + nav fit @ 361x800`（同じ loop） | 361×800 | `*-360x800`（幅が近いほう） |
| `making-ui-1screen` | Salsiccia @ 360x800（Reference modal） | 360×800 | `*-360x800` |
| `making-ui-1screen` | 390x650: dough shrinks via the height term | 390×650 | `*-390x844` |
| `pizza-cutting-phase4b` | Scenario C: Capricciosa at 360x800 | 360×800 | `*-360x800` |

- 各 engine で、それぞれの test がちょうど1回走る。検出力は変わらない。
  - 8 test × 2 engine のうち、各 engine で片方の project が skip になる。WebKit では 1 project あたり 4 件減る。
- **P0 を隠さないこと:** これらの skip は「同じ engine の兄弟 project で、同じ viewport のまま走っている」ものだけ。
  - I5b-5 の Result Report には、engine ごとの「executed / intentionally skipped」の件数（shard evidence の summary の表）を載せる。
  - skip の件数が 8 から増えていないことを確かめる。
- 今の shard evidence の verify は、`skipped/skipped` を intentionally skipped として通す（self-test「intentional test.skip is allowed」）。**verifier の変更は要らない。**
- rt01 harness の 5 test も viewport にほぼ依存しない。ただし強制はしていないので、OD-V-6 の対象外とする（任意の候補として記録するだけ）。

---

## 11. 古くなった E2E（I5b-3 で判明）: I5b-5 で正式に更新する対象

**原則:** production を旧仕様に戻さない。I5b-3 の authority（25 recipe、24 step、step 14 = garlic）に合わせて spec を書き換える。`test.fail` と skip は使わない。

§1.1 の実測（I5b-3 `5204a26`、Chromium、2 project）で失敗した **6 test / 4 spec**:

| # | spec : line | test | 実測した失敗 | 正式な更新 |
|---|---|---|---|---|
| S-1 | `progression2-p3-3-onboarding.spec.ts:46`（assertion は :54、:172） | A-E: fresh HOME … first discovery | `/0\/15/` が期待値。実際は「👑 レシピ 0/25」 | `/0\/25/`、`/1\/25/` にする。数値は `RECIPES.length` から導かず、authority の値 25 を固定で書く（authority の変更を検出するため） |
| S-2 | 同 `:153`（:208） | existing save: an already-discovered Dex is untouched | `/1\/15/` → 「1/25」 | `/1\/25/` |
| S-3 | 同 `:184`（:218 の `0/15` を含む） | reset returns a played save to true Dex 0 | `/1\/15/` → 「1/25」 | `/1\/25/`、`/0\/25/` |
| S-4 | `save-forward-compat-3-4b.spec.ts:30`（:43、:64） | a save carrying future recipe/ingredient data … | `/1\/15/` → 「1/25」 | `/1\/25/`。「future」の id（`brazilian-calabresa` / `calabresa`）は W1 の 25 件に入っていないので、そのまま future として使える |
| S-5 | `rt01-reference-capacity.spec.ts:42`（:45〜:50） | shipped recipes: every reference piece is drawn at its own position | `.rt01-case` の件数: 期待 15、実際 25 | 件数を 25、loop を 25 にする。**さらに、その後ろで隠れている assertion がある:** `total ≤ 8` は Parmigiana 9 / Portuguesa 10 / Puttanesca 9 で必ず失敗する。R-07 / RT-01c の authority どおり、上限を 10 にする。W1 の 3 件は、既存の 9/10 piece の最小間隔（`> 128 × 0.18`）も満たすことを確かめる（R-08） |
| S-6 | `progression2-discovery-ladder.spec.ts:188` | multi-material NEW MATERIAL notice (step 14, three cheeses) | 期待「フォンティーナ・ゴルゴンゾーラ・パルミジャーノ」。実際は「🆕 新しい材料が入荷：**にんにく**」 | **scenario を差し替える。** 3 材料の通知は、25 ladder では本番の流れで出ない。いちばん幅のある本番の case は step 24 の **フォンティーナ・ゴルゴンゾーラ**（2 材料）。seed を「quattro-formaggi と bismarck 以外の 23 件を発見済み + egg を所持」にし、Free Cooking の Bismarck を 24 件目の発見にする。期待値は、文言がこの2材料、`nameLines` が `[1, 1]`、CTA に重ならないこと、RESULT が 1 画面に収まること。test の名前も「step 24, two cheeses」に変える |

補足:
- **step 14 の単材料（にんにく）の通知**は、S-6 を差し替えても、別の test に置かなくてよい。単材料の通知は、new save の test（egg）ですでに見ている。
- **3 材料の layout** は、production の流れでは出ないが、component としては出せる。`src/components/ResultPanel.test.tsx` に「3 つの名前がそれぞれ別の run になる」という structure の test を足す（R-13）。
  - I5b-3 の時点では、2 材料（black-olive・oregano）の test しか無い。
  - jsdom は行を測れないので、ここで見るのは構造だけ。

**first failure に隠れた assertion のリスク:** 上の 6 test は最初の assertion で止まっているので、その後ろの assertion は実行されていない。静的に読んだ範囲で、25 件への変更に影響するものは S-5 の `≤ 8` だけだった。それ以外（onboarding のヒント文言、EP4 の migration の Shop の 5 行、Bismarck の発見の文言）は、ladder の step 1〜3 が 15 ladder と同じ（egg / bacon / mushroom）なので、変わらないと判断した。ただし、**確定させるのは、I5b-5 で spec を書き換えた後の実行結果**とする。

**I5b-3 で PASS した spec**（このままでよい）: 残りの 10 spec の 65 test（×2 = 130）。new save → Margherita → egg → Bismarck → bacon の flow も、step 1 と 2 が同じなので PASS した。

---

## 12. 新しい E2E の配置（確定案）

| ID | file | test | seed | 見る assertion | Design の対応 |
|---|---|---|---|---|---|
| **E-1** new materials | 新規 `e2e/progression2-w1-materials.spec.ts` | Dex 3 → 4 件目の発見（Free Cooking の Funghi）で eggplant が NEW（在庫 0）→ Shop で最初のパックを買う → OWNED → Free Cooking で **Melanzane** を発見（5 件目）→ 「レシピ 5/25」 | Dex 3（margherita、bismarck、breakfast-pizza。step 1〜3 の egg / bacon / mushroom を所持）。I5b-5 で seed を確定する | 通知の文言「なす」、Shop の `data-shop-state`、在庫、Pitz、発見の banner、Dex pill | R-05、R-06 |
| E-2 new materials | 同上 | Dex 23 の seed: 7 つの新材料（eggplant / corn / pineapple / clam / fresh-tomato / potato / capers）が Shop に出ていて、Inventory で「所持 N/29種」、tray のページに出る | Dex 23 + 7 材料を所持 | 各材料の行と chip があること、名前、横方向のはみ出しが無いこと | R-02、R-06、Visual Gate の screenshot の元 |
| **E-3** New Haven no-CUT | 新規 `e2e/progression2-w1-new-haven.spec.ts` | FREE（または guided。New Haven は発見済み）: olive-oil を塗る → parmigiano / clam / garlic → BAKE → 取り出す → **POST_BAKE を経ずに RESULT** | Dex 19 以上 + clam / garlic / parmigiano / olive-oil を所持 | 「カット」タブが一度も出ない、`切り終わる` が0件、RESULT に `.cut-evaluation-summary` が無い、Timing の詳細に CUT の行が無い | R-10 |
| E-4 New Haven no-CUT | 同上 | Lunch Rush で New Haven の注文 → CUT なしで serve される | Lunch Rush の pool が New Haven だけになる seed（発見済み ∩ 作れる） | serve される、mission RESULT に出る、overlay が残らない | R-10、R-12 |
| **E-5** migration D | 新規 `e2e/progression2-w1-migration.spec.ts` | Dex 15（旧 15 件を全部発見、旧 ladder の解放を持つ）の save を load → Shop に eggplant / corn / pineapple が NEW（在庫 0）、それ以外の在庫と Pitz が同じ、load 時の通知が無い → eggplant を買う → Melanzane を発見 → 16/25 | I5b Fresh Audit §11 のケース D | Shop の状態、在庫、Pitz、`unlockedForShopIngredientIds`、進捗のヒント | R-11（Fresh Audit §14 の Integration の「15 → 25 の migration」） |
| E-6 save round-trip | 既存 `e2e/save-forward-compat-3-4b.spec.ts` に 1 test を追加 | W1 の id（dex、owned、inventory、ledger）を持つ save が、実際の書き込みと reload をまたいで同じ内容のまま残る | ケース F 相当 | 既存の test と同じ形 | R-11 |
| **E-7** 25 recipe checks | 既存の spec の更新 | S-1〜S-6（§11） | — | — | R-02、R-07、R-13 |
| E-8 25 recipe checks | `e2e/layout-contract.spec.ts` の LC-5 | Pizza Select の 25 件、長い名前が 2 行以内、詳細の CTA | Dex 23 | L-L、L-A | R-14 |
| E-9 25 recipe checks | `e2e/rt01-reference-capacity.spec.ts`（S-5 で更新） | 本物の Parmigiana / Portuguesa / Puttanesca で、popover と mini 見本の piece が重ならない | harness | 最小間隔 | R-08 |

- 新しい spec は、既存と同じく**全 project で走らせる**（Chromium の local、WebKit の CI）。viewport は強制しない（OD-V-6）。
- **25 recipe の Vitest（R-01〜R-12）の大部分は、I5b-3 がすでに入れている**:
  - `w1Activation.test.tsx`（25 の表、exact-set、New Haven の BAKE → RESULT、new7 の hidden → NEW → OWNED → refill、save の round-trip）
  - `App.w1Migration.test.tsx`（A〜G）
  - `w1Reachability.test.ts`（25/25、2,000 回）
  - `cookingProfiles.test.ts`（CUT は 24 件 + New Haven を除外）
  - `rt01ReferenceRegression.test.tsx`
  - I5b-5 の Vitest で足す残りは **R-13 の 3 材料の component test** だけ。R-14 の章の境界は OD-PS-4 の状態に合わせる。
  - I5b-5 の Result Report で、R-01〜R-14 と test file の対応表を、main の実物で確かめ直す。
- 25 件全部を E2E で1件ずつ作ることはしない。それは Vitest（reachability、exact-set）の役割で、E2E は key の3つの経路（Melanzane、New Haven、migration D）に絞る。

### 12.1 Visual Gate（OD-V-7）

- screenshot の保存先: `docs/reports/screenshots/progression2-w1-i5b5/`（Policy。before / after）。
- sausage の比較（tray、焼く前と後の pizza、thumbnail × pepperoni / bacon / ham）は、**OD-VIS-1 を I5b の範囲で実装した場合だけ**入れる。実装しない場合は、Result Report に「既知: 🌭（I6 へ送る）」と書く。

---

## 13. I5b-4 の完了後に必要な入力

| # | 入力 | 使う場所 | 誰が |
|---|---|---|---|
| IN-1 | I5b-3 と I5b-4 が入った main の exact SHA | P-1、全部の base | merge の後に fetch する |
| IN-2 | I5b-4 の後の DOM の slot selector（pager の場所を確保する要素、chip、ctaBar、HOME の CTA の構造 2+1、BAKE の caption） | §5.1 の selector map | I5b-4 の Result Report / diff |
| IN-3 | I5b-4 が 7 profile で実測した geometry（pager と bar の間隔、BAKE の CTA の下端、HUD と tabs） | Design の定数（8px、64px、1.6、44px）で PASS するかを確かめる。**閾値をこの値に合わせて動かすことはしない** | I5b-4 の Result Report |
| IN-4 | **E360i での dough の直径の実測** | OD-V-4 の下限を Owner が決める材料。決まるまで L-N は advisory の記録だけ | I5b-4 の後に LC を走らせ、summary の advisory の表を使う |
| IN-5 | OD-VIS-1 を I5b で実装したかどうか | sausage の Visual Gate の行（OD-V-7） | Owner / I5b-4 |
| IN-6 | Pizza Select の章の境界（OD-PS-4） | R-14、LC-5 | Owner |
| IN-7 | Owner の iPhone の機種、iOS の version、普段は Safari か、ホーム画面に追加したアプリか | Human の checklist（OD-V-3 / OD-V-5） | Owner |
| IN-8 | `Layout Contract Gate` を required check にする ruleset の変更 | Final Merge Gate | Owner（repo の設定） |
| IN-9 | PR #219 の状態（merge されたか、close されたか） | §9.4 | GitHub の fetch |
| IN-10 | seed の save の JSON（Dex 3 / 12 / 19 / 23、Lunch Rush が解放済みのもの、ケース D） | `e2e/support/seeds.ts` | I5b-5 の実装で、I5b-3 の ladder から作る |

---

## 14. Blocker とリスク

| # | 内容 | 本 Preflight への影響 | I5b-5 への影響 |
|---|---|---|---|
| B-1 | **I5b-3 が main に入っていない**（`5204a26` は branch だけにある） | なし | S-1〜S-6 と E-1〜E-9 は、I5b-3 の merge の後に書く |
| B-2 | **I5b-4 が完成していない** | なし（閾値と selector は確定させていない） | LC は I5b-4 の実装の後でないと green にならない。`test.fail` と skip で隠さない |
| B-3 | sandbox では WebKit を起動できない（`/opt/pw-browsers` には Chromium しかない） | なし | Full WebKit は GitHub Actions の `workflow_dispatch` で走らせる |
| R-1 | CDP の safe-area override は experimental | LC-0 と `applyProfile` の毎回の自己検査で fail させる | Playwright / Chromium を更新するときは LC-0 を先に確かめる |
| R-2 | CDP の override は、resize と navigation をまたいで**残る**（§4.1 で実測） | helper の手順に「N / S で必ず解除する」を入れた | 解除を忘れると N / S の結果が inset で汚れる。LC-0 (b) で検出する |
| R-3 | BAKE で巡回している間に針が動くと、結果が不安定になる | `page.clock` で止めてから巡回する手順にした | `gestures.ts` の分割が必要（`bakeToTarget` の外から見た挙動は変えない） |
| R-4 | WebKit の shard の時間が trace で増える | trace の範囲を条件つきにした | 実測で判断する（§8） |
| R-5 | 古い E2E の first failure の後ろに、まだ見えていない assertion がある | 静的に読んで S-5 を見つけた | 書き換えた後に Full Chromium と Full WebKit で確定させる |

- 本 Preflight の途中で、古い assertion を scratch の worktree（repo の外）で試しに書き換えて再実行しようとした。この操作は session の権限チェックで拒否され、実行していない。そのため、§11 の「隠れた assertion」は静的に読んで判断した。

---

## 15. 結論

- **Preflight: READY。** I5b-4 が完了し、I5b-3 と I5b-4 が main に入れば、§2〜§12 のとおり I5b-5 の実装にすぐ入れる。
  - LC-0〜5 の mapping、helper、CI、WebKit の分担、古い E2E の対象、新しい E2E の配置、evidence は、すべて今の Playwright と CI の構造の上で決めた。
- **I5b-5 の実装: まだ開始できない**（B-1、B-2。§13 の IN-1〜IN-4 が必要）。

STOP GATE: `src/**`、`e2e/**`、CSS、runtime、`playwright.config.ts`、workflow、production code は変更していない。PR の作成と merge はしていない。I5b-5 の実装はしていない。
