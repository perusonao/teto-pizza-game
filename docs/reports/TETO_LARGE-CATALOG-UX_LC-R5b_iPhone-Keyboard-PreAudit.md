# Large Catalog UX — LC-R5-b Pre-Implementation Audit (Search / Pantry 高さ / iPhone soft keyboard)

**docs-only / READ-ONLY audit。** production code・CSS・test/e2e・save・tooling の変更 0。PR 作成なし。R5-a branch / R5-a production 実装には触れていない。LC-R5-b は実装していない。
Human Verification: 対象外（Policy §2: docs-only）。本書は実機 HV の**手順**（§9）と**発見用ハーネス仕様**（§10）を定めるだけで、動画・スクリーンショットは撮らない。

## 0. Authority と fresh state

| 項目 | 値 |
|---|---|
| `origin/main`（fresh fetch）| `12725eb`（PR #306 = LC-R4 merge）。fetch 後も不変。R5 系の docs は main に無い |
| Authority: LC-R5 Fresh Audit / Owner Authority | branch `claude/lc-r5-fresh-audit-z4bga9` = `b584b7a0a8b98c1e507d0ce860bb7064dcabff82`（fetch で確認）。**§21（OD-R5-1〜12 + §21.1 #197 追加契約）を最優先**、§19 は推奨案の履歴 |
| Implementation Verification Plan | branch `claude/lc-r5-implementation-verification-jo557t` = `855e9fbece4711bf78935db975f9e289722e46f5`（rev2）。R5-b は §6、実機 HV は §11 |
| 本書 branch | `claude/lc-r5b-pre-audit-mbinf3`（main `12725eb` から、docs 1 ファイルのみ） |
| R5-a | remote に R5-a の実装 branch は見つからない（`ls-remote` の `lc-r5*` は上記 2 つのみ）。R5-a の状態は未確認 |
| 測定 | main `12725eb` の `git archive` を scratchpad に展開し、`npm ci` + Vite dev + Playwright Chromium（`/opt/pw-browsers/chromium`）で**現行 pantry を 4 viewport 実測**（§4）。repo 内のファイルは変更していない（測定 spec・config は scratchpad のみ、commit しない） |
| 実機 / WebKit | **未実行**。iOS keyboard・IME・standalone は Chromium で再現できない。§5 の keyboard 表示中の値は**すべて ESTIMATE** |

**ラベルの約束**: `MEASURED` = 上記 Chromium 実測。`ESTIMATE` = 算術・推定。**ESTIMATE は production CSS 値として確定しない**（OD-R5-5: 値は R5-b の 4 viewport 実測 + 実機 HV で決める）。

### 0.1 OD-R5-5 の解釈（本書の前提）

- 決定済み: sheet は**利用可能 viewport 上限へ向けて拡大**する方向 / 値は事前固定しない / R5-b が 4 viewport を実測し iPhone 実機 keyboard HV を行って**安全な最大高さを確定** / search は**必要時のみ** / 選択中 area は**pin 存在中のみ** / **collapsible strip 不採用**。
- Plan §6.2 の invariant: sheet 外形 bounds は **sheet 内の状態**（search 有無・text・0 件〜多数件・shelf・pin 数）で変わらない。変わってよいのは list の高さだけ（PR #304 stable-height 契約の継承）。
- **本書の読み（Owner 確認が望ましい、§11 Q1）**: 「in-sheet state で跳ねない」は sheet 内部の状態変化を指す。**iOS keyboard の開閉は sheet 外の端末状態**なので、keyboard 表示中に sheet を可視領域へ収めること自体は invariant の違反ではない。ただし「keyboard を閉じたら外形が open 直後と厳密に同一へ戻る」ことは合否条件（K-9）。

---

## 1. 現行 IngredientPantry の CSS / DOM（main `12725eb`）

`src/components/IngredientPantry.tsx`（145 行）/ `src/App.css` L6193〜（R3/R4）。

```
.pantry-sheet__backdrop  (fixed, inset 0, z-index 25, onClick=onClose)
└ section.pantry-sheet  role=dialog aria-modal=true aria-labelledby   (onClick stopPropagation, onKeyDown Escape → close)
   ├ .pantry-sheet__header   flex:none   h2「🧺 食材庫」 + button.pantry-sheet__close「閉じる」(min 44×44)
   ├ p.pantry-sheet__subtitle  flex:none  CATEGORY_LABEL
   ├ .pantry-sheet__shelves    flex:0 0 auto   ShelfChips（導出 shelf ≥ 2 の時のみ）
   └ .pantry-sheet__list       flex:1 1 auto; min-height:0; overflow-y:auto; overscroll-behavior-y:contain; role=region tabIndex=0
        ul.pantry-sheet__grid (3 列, gap 8) > li.pantry-tile（read-only。button ではない）
```

- sheet: `position: fixed; left:50%; translateX(-50%); bottom: 0; width:100%; max-width:390px; box-sizing:border-box; display:flex; column; gap:8px; padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); border-radius 20 20 0 0; overflow:hidden`。
- **高さ** `height: 70vh; height: min(70dvh, calc(100dvh - env(safe-area-inset-top, 0px) - 20px));`（70dvh は R3 の暫定値で、R3 note が「#304 ceiling へ上げるのは Human Feel の判断」と留保）。
- 入力欄なし。`<input>` は repo 全体で `SettingsOverlay` のプレイヤー名 1 箇所のみ（`font-size: 14px` = **iOS では focus 時 auto-zoom 対象**。R5-b の search は ≥16px 必須）。`type="search"` / `inputMode` / `enterKeyHint` の既存利用なし。
- open 時 focus は 閉じる（`closeRef.current?.focus()` in mount effect）。search へ auto-focus してはならない（keyboard が勝手に開く）。
- state: `activeShelf`（local）。close で unmount → shelf は reset（OD-R4-2）。R5-b の `searchText` も同じ local state（authority §4）。

## 2. R4 で確定した geometry（R4 Result / 本書 MEASURED で再確認）

| 要素 | 値 | 由来 |
|---|---|---|
| sheet 上 padding / 下 padding | 12 / 12 + safe-area-bottom | CSS |
| header | 44（閉じる min-height）| MEASURED |
| subtitle | 17 | MEASURED |
| gap | 8（sheet の `gap`）| CSS |
| ShelfChips slot | 46（+ 8 gap = 54）| MEASURED（chips y=342.2, h=46）|
| tile 高 | 71.19（行ピッチ 79.19 = 71.19 + 8）| MEASURED |
| list 高 = S − 155（chips あり）/ S − 101（chips なし、topping 以外）| 算術（155 = 12+44+8+17+8+46+8+12）| MEASURED と一致（下表）|

Plan/audit の「78px 行」「chip slot 54」は概算で、**実測ピッチは 79.19**。以降の行数は 79.19 で計算（ESTIMATE）。

## 3. InventoryOverlay stable-height 契約（PR #304）

- `.inventory-overlay__panel { height: calc(100dvh - env(safe-area-inset-top, 0px) - 20px) }`（= Dex 系 shell の `max-height` と同値 = **#304 ceiling**）。summary / ShelfChips は pin、`.inventory-overlay__list` のみ `overflow-y:auto; overscroll-behavior-y: contain`。絞り込みで 1 件でも外形は不変。
- pantry は**別実装**（`InventoryOverlay` は read-only 型で流用しない — R3 の判断）。契約だけ継承: 外形 one height / header pin / list のみ scroll / body 不動。
- OD-R5-5 の「上限へ拡大」= pantry を inventory と同じ ceiling（`100dvh − safe-top − 20px`）へ寄せる方向。**ただし keyboard は inventory に存在しない要素**（inventory に入力欄はない）で、ここが新規リスク。

## 4. 現行 sheet の実測（MEASURED — Chromium、FREE・topping step・22 topping 所持・在庫 9、chips あり）

| viewport | sheet y / h | header h | subtitle | chips slot | list y / h | list scrollH | tile 数 | stage Ø（開く前 / 開いた後）| dock | 備考 |
|---|---|---|---|---|---|---|---|---|---|---|
| 390×844 | 253.2 / **590.8** | 44 | 17 | 46 | 396.2 / **435.8** | 628 | 22 | 290 / 290 | 174 | body scroll 0 |
| 360×800 | 240 / **560** | 44 | 17 | 46 | 383 / **405** | 628 | 22 | 273.6 / 273.6 | 174 | 〃 |
| 390×664 | 199.2 / **464.8** | 44 | 17 | 46 | 342.2 / **309.8** | 628 | 22 | 269.1 / 269.1 | 162 | 〃 |
| 360×640 | 192 / **448** | 44 | 17 | 46 | 335 / **293** | 628 | 22 | 245.1 / 245.1 | 162 | 〃 |

- sheet 高 = 70 dvh そのもの（`min(70dvh, 100dvh−20)` の 70dvh 側が効く）。open 直後の focus = `pantry-sheet__close`、stage / dock は不変（R3 の契約どおり）、`documentElement.scrollHeight − innerHeight = 0`。
- **PageDown（list にフォーカス）**: list の scrollTop 0 → 192 / 223 / 271 / 256 と動き、**body scroll 0**（native の keyboard scroll は list 内に閉じる）。
- **Escape（list にフォーカス）**: sheet close、focus は `pantry-entry` に戻る。

### 4.1 search / selected strip 候補の費用（ESTIMATE、production 値ではない）

| 候補 | 費用 | 根拠 |
|---|---|---|
| search 行（field 44px + 8 gap）| **≈ 52** | 44px tap 目標の下限。`font-size ≥ 16px` で 44 に収まる想定。field を subtitle 行に同居（L2）すれば ≈ −25 |
| selected strip（tile 44 + 8 gap）| **≈ 52**（pin ≥ 1 の間だけ。R5 production では休眠）| Plan §9.1 / audit §10.3 の 52 を踏襲 |
| chips | 54（既存、topping のみ現実的に ≥ 2 shelf）| MEASURED |

sauce（3）/ cheese（4）は owned ≤ 6 で search 非表示、chips も 1 shelf 以下で非表示 → **費用 0**。最悪ケースは topping（chips + search + strip）。

## 5. 4 viewport 予算表（ESTIMATE）

前提: `list = S − 89(上部 chrome) − 12(下 padding) − Σ(chips 54, search 52, strip 52)`。行数 = (list + 8) / 79.19。safe-area-bottom は emulation で 0 のため実機ではさらに ≈ 34 減る（ホームインジケータ機、ESTIMATE）。

### 5.1 keyboard なし

| viewport | 現行 sheet 70dvh: list（行数）| L1（`100dvh−20`）: list（行数）| L1 かつ standalone safe-top≈59（ESTIMATE）|
|---|---|---|---|
| 390×844 | chips 435.8（5.6）/ +search 383.8（4.9）/ +strip 331.8（4.3）| 669（8.5）/ 617（7.9）/ 565（7.2）| 610 / 558 / 506（6.5）|
| 360×800 | 405（5.2）/ 353（4.6）/ 301（3.9）| 625（8.0）/ 573（7.3）/ 521（6.7）| 566 / 514 / 462（5.9）|
| 390×664 | 309.8（4.0）/ 257.8（3.4）/ 205.8（2.7）| 489（6.3）/ 437（5.6）/ 385（5.0）| 430 / 378 / 326（4.2）|
| 360×640 | 293（3.8）/ 241（3.1）/ 189（2.5）| 465（6.0）/ 413（5.3）/ 361（4.7）| 406 / 354 / 302（3.9）|

（各セルは 順に「chips のみ / + search / + search + strip」。chips のみの現行列は MEASURED、他は ESTIMATE。）

→ keyboard なしなら、現行 70dvh でも最悪 2.5 行を確保でき、L1 なら 4 viewport すべて 4.6 行以上。**keyboard なしの予算は問題にならない**。効くのは keyboard。

### 5.2 keyboard 表示中（ESTIMATE — すべて）

前提（**仮説であり実機で確認する対象**）:
1. iOS Safari / standalone では keyboard は **layout viewport と `100dvh` を変えず**、`visualViewport.height` だけを縮める（keyboard 高 K ≈ 291〜340pt、日本語かな + 予測変換バーで大きめ。ESTIMATE）。
2. sheet は `bottom: 0`（layout viewport 基準）なので、**下 K px が keyboard の裏に隠れる**（sheet 上端から `S − K` だけが見える）。Safari が focus した field を見せるために visual viewport を pan する可能性は**このモデルに含めない**（=実機発見対象）。
3. 並びは header → subtitle → search → chips → list。

`list の可視高 = S − K − 89 − 52 − 54`（負なら search / chips まで欠ける）。K = 300 / 340 の 2 点:

| viewport | 現行 70dvh（K300 / K340）| L1（K300 / K340）| L1 + strip 表示（K300 / K340）| L1 かつ standalone safe-top≈59（K300 / K340）|
|---|---|---|---|---|
| 390×844 | 95.8（1.3 行）/ 55.8（0.8）| 329（4.3）/ 289（3.8）| 277 / 237 | 270（3.5）/ 230（3.0）|
| 360×800 | 65（0.9）/ 25（0.4）| 285（3.7）/ 245（3.2）| 233 / 193 | 226（3.0）/ 186（2.4）|
| 390×664 | **−30（chips 下部と list が見えない）** / **−70（search 欄も切れる）** | 149（2.0）/ 109（1.5）| 97 / **57（0.8）** | 90（1.2）/ 50（0.7）|
| 360×640 | **−47 / −87（search 欄が切れる）** | 125（1.7）/ 85（1.2）| 73 / **33（0.4）** | 66（0.9）/ 26（0.4）|

読み取り（ESTIMATE の範囲での判断材料。数値を authority にしない）:
- **現行 70dvh のままでは、390×664 / 360×640 で keyboard 表示中に結果行が見えない（search 欄自体が切れ得る）**。よって「拡大」は keyboard 対策の観点でも必要側に働く。
- **L1 でも 390×664 / 360×640 は K340・strip 表示・standalone safe-top の組で 1 行未満になり得る**。Plan §6.2 のガードレール「keyboard 表示中に search と ≥ 1 結果行が見える」は、静的な bottom-anchored sheet だけでは 4 viewport で満たせない可能性が高い。
- したがって **keyboard 対策（`visualViewport` 駆動 or 構造変更）の要否・方式が、実機発見なしでは決められない**（§7、§11）。
- 390×664 は **iPhone 14/15 級の Safari（toolbar 表示）の可視高に近く、390×844 は toolbar のない standalone / 全画面に近い**（仮説。実機の `innerHeight` / `visualViewport.height` で確認）。360×640 は小型端末級。これは「4 viewport は 2 つの端末状態の代理である」可能性を意味する。

---

## 6. 個別調査項目（1〜12 のうち §1〜§5 で扱わない項目）

### 6.4 dvh / svh / vh 使用箇所

- `src/index.css`: `html { height:100%; overflow:hidden }`、`body` / `#root`: `height: 100svh; height: 100dvh; overflow: hidden`（縦は固定、document はスクロールしない）。
- `App.css`: `.app-frame` `100svh → 100dvh`、dough `calc(100dvh − 430px / −439px)`、Dex shell `max-height: calc(100dvh − safe-top − 20px)`、Inventory `height: 同値`、HintSheet 45dvh（旧）/ U3 `calc(100dvh − 56px − safe-top)`、pantry `min(70dvh, 100dvh − safe-top − 20px)`。
- **`100vh` は fallback のみ**（`height: 70vh` → 直後に dvh で上書き、`max-height: calc(100vh − 56px)` など）。
- 含意: 全 modal が `dvh`（動的 toolbar 対応）で組まれており、**iOS keyboard では dvh が変わらない**ため既存 modal は keyboard に対する防御を一切持たない。既存で keyboard が出る面は SettingsOverlay の名前入力のみ（この面の keyboard 挙動は本 repo の docs に記録なし）。

### 6.5 `visualViewport` の既存利用

**なし**（`src/` 全体・`index.html` を grep: `visualViewport` 0 件、`innerHeight` 参照も production コードに 0 件）。`resize` listener の既存 pattern もないため、R5-b で導入するなら新規 hook（cleanup・`scroll`/`resize` 両 listener・rAF 合流・unmount 時の CSS 変数除去）が必要で、境界テスト・mutation の対象が増える。

### 6.6 safe-area 対応

- `index.html`: `viewport-fit=cover`（**あり**）。`apple-mobile-web-app-capable=yes` + `status-bar-style=black-translucent` → **standalone では status bar が content に被り、`env(safe-area-inset-top)` が非 0**（Dynamic Island 機で ≈ 47〜59pt。ESTIMATE）。`env(safe-area-inset-bottom)` は下部固定要素の padding に広く使用済み。
- pantry: 下は `padding-bottom: calc(12px + env(safe-area-inset-bottom))`、上は sheet 高の式の `safe-top + 20px`。**左右 `env(safe-area-inset-left/right)` は縦持ち固定（`manifest orientation: portrait`）のため未使用**（横持ち・iPad は監査外）。
- 含意: Safari タブでは safe-top = 0（status bar は content の外）、standalone では ≠ 0。**同じ CSS 式でも可視高が異なる**ので、安全上限の確認は両モードで必要（§8）。

### 6.7 body scroll lock

- JS の lock は**なし**。CSS のみ: `html, body, #root { overflow: hidden; height: 100dvh }`。sheet は `position: fixed`、list に `overscroll-behavior-y: contain`。
- 実測（§4）: pantry open・PageDown 後も `scrollHeight − innerHeight = 0`。
- iOS の注意（実機で確認する仮説）: `overflow: hidden` は**ユーザースクロールを止めるが、keyboard による visual viewport の pan（`visualViewport.offsetTop` / `pageTop`）は止めない**ことがある。close 後に offsetTop が残る（ページが上にずれたまま）不具合の報告が iOS には過去にあり、K-9/K-10 で検証する。候補対策（`blur` 時 `window.scrollTo(0,0)`、または `visualViewport` の `offsetTop` を 0 へ補正）は**実機で発生が確認された場合のみ**採用する。

### 6.8 focus return

- `GameScreen`: `wasPantryVisibleRef` + effect で `pantryVisible` が true→false の瞬間に `pantryEntryRef.current?.focus()`。step 変更・round 終了で `pantryAvailable` が false になり sheet が閉じる場合、entry も unmount 済みで no-op（安全）。
- 実測（§4）: Escape → focus = `pantry-entry`。
- R5-b への含意: (a) **search field に focus がある状態で unmount → keyboard が閉じ、その直後に `entry.focus()`**。iOS では `focus()` が既定で scrollIntoView 相当の pan を起こし得る（keyboard 閉鎖アニメーション中）ため、`focus({ preventScroll: true })` への変更が必要かは実機（K-8/K-9）で判断（現行コードの変更になるので R5-b の一部として要否を Result に記録）。(b) entry ボタンへの focus は keyboard を開かない（button）。
- **no focus trap**: sheet は `aria-modal` だが背景に `inert` / `aria-hidden` なし。Tab で背景へ抜け得る（R3 から。R5-b の新規リスクではないが、外付 keyboard の HV で観察）。

### 6.9 Escape 処理

- `IngredientPantry` の `<section onKeyDown>` に `Escape → stopPropagation + onClose`。**sheet 内のどの要素にフォーカスがあっても bubble して閉じる**ので、search field 内の Escape も現行実装のまま（OD-R5-8: 閉じる。`clear-first` 変種なし。IME 例外なし）で成立する。
- `IngredientTray` は `window` の `keydown` で Escape を drag abort に使う（無害）。`PizzaStage` の `onKeyDown` は Enter / Space のみでスコープは stage 要素（pantry は別ツリー）。
- **潜在問題（新規リスク）**: handler は section 上なので、**フォーカスが `body` にある時の Escape は届かない**。search 導入で `Enter → blur()` を実装すると focus が body に落ち、外付 keyboard（iPad / Bluetooth）で Escape も PageDown も効かなくなる。→ 契約案 §7 の「Enter で blur する時は focus を list（`tabIndex=0`）へ移す」。
- IME 中の Escape（`isComposing`）: Chromium は `keydown` を `isComposing=true` で発火。Safari / iOS は composition 中の keydown を `keyCode 229` で出す実装があり、**Escape がイベントとして届かない / 変換取消しに消費される可能性**がある（未検証・推定）。OD-R5-8 は挙動変更を求めないので、**実機で観察して Result に記録**（K-7）。「変換中 Esc で sheet が閉じてしまう」が体感上の問題なら Owner に戻す（勝手に例外を入れない）。

### 6.10 PageDown / list-only scroll

- list は `role="region" tabIndex=0`、native keyboard scroll が list 内で完結（MEASURED §4: 4 viewport で body 0）。R3 spec にも PageDown 相当の e2e あり。
- **search field にフォーカスがある間、PageDown は list を動かさない**（input の既定動作で caret 移動 / 何もしない）。→ 外付 keyboard 利用者が結果を送るには Tab で list へ移る必要がある。R5-b の契約案: field で `ArrowDown`（または Tab）で list にフォーカスを移せるかは Owner の a11y 判断だが、**最低限 Tab 順（閉じる → search → ✕ → chips → list）と、`Enter` 後の list への focus 移動**（§7）を契約にする。
- iOS 実機の PageDown 相当は「外付 keyboard の Space / PageDown」と「VoiceOver / Switch Control のスクロールジェスチャ」。K-5 で list のみが動くことを確認（keyboard 表示中は search field フォーカスのため touch drag が主）。

### 6.11 `queryCatalog` の name AND shelf 契約

- `queryCatalog(catalog, ownership, usage, { shelves, text })`: **owned のみ**（`ownedCatalog` が最初）→ `shelves`（`item.shelf !== null && has`）∧ `text`（`matchesSearch`）∧ only.* を **AND**。sort は catalog 順、`zeroStockLast` 既定 true。**shelf と text の union / OR の経路は存在しない**。
- pantry 側: `queryCatalog(...).filter(category)`（category は query 後に絞る。結果は同じ）。**R4 の chip 導出は `itemsFor()`（text なし・shelf なし）**で行っているので、R5-b は **`text` を `rows` の query にだけ渡し、`allItems` / `presentShelves` / `showChips` には渡さない**（渡すと入力中に chip が増減し固定 slot が reflow → M65）。
- **search 表示条件は「category の owned 行 > 6」を `allItems.length`（text・shelf 非依存）で判定**すること。text 依存にすると、0 件になった瞬間に field 自体が消えて focus を失い keyboard が閉じる（重大な UX 破壊）。この点を Plan §6.1 の契約に**追加すべき**（§11 提案）。
- `shelf === null` の行は 「すべて」 のみで一致し、shelf chip 選択時は text に一致しても出ない（仕様どおり）。production は未分類 0、62 catalog 設計では topping 23 件が未分類。
- `matchesSearch`: NFKC・lower・カタカナ→ひらがな・`ー` / 空白 / `・` 除去の **substring**。空 / 空白のみ / `ー` のみ（正規化で空）は**全件一致（no filter）**。`readingJa` は型にあるが production の全 29 件は未設定。

### 6.12 日本語 IME で問題になり得る event 処理

**現行 production コードに composition / `isComposing` / keyCode 229 の扱いは 0 件**（grep 済み）。R5-b で新規に決める必要がある論点:

| # | 論点 | 内容 | 推奨契約（ESTIMATE ではなく設計提案。値は実機で確認）|
|---|---|---|---|
| I-1 | React `onChange` は composition 中も発火 | 変換中の未確定文字（かな）が `input.value` に入り、そのまま filter される。名前が全て**かな / カタカナのみ**（production 29 件全部）なので、かな入力の途中経過は substring 一致として自然に絞り込める | 入力ごとに更新（Plan §6.1 のとおり）でよい。ちらつき（空→復帰）が体感で問題なら compositionend まで凍結を R5-b 内で調整（Owner 決定事項ではない）|
| I-2 | **漢字変換中は `input.value` が変換候補の漢字になる** | 例: 「たまねぎ」入力中に候補「玉ねぎ」を選択（未確定）→ `value = "玉ねぎ"` → **一致 0 件 → 「該当する材料がありません」がちらつく**。確定後も **kana-only の名前には永遠に一致しない**（`readingJa` 未設定のため） | (a) 変換中は直前の filter を保持（`compositionstart` 〜 `compositionend` の間は text を更新しない）。(b) 漢字で確定した場合に一致しないのは**仕様上の帰結**（名前が kana のみ）。Owner が「漢字でも探せてほしい」なら `readingJa` を持たせる別スライス。**K-4 の合格条件は「漢字に変換すると 0 件になる」ことを含めて事前に明記**（不具合と誤判定しない）→ §11 Q2 |
| I-3 | Enter で確定 vs Enter で検索 | Safari は変換確定の Enter で `compositionend` が先に発火し、続く `keydown` が `isComposing === false` かつ `keyCode 229` になる既知差（推定）| Enter に何か割り当てる（blur 等）場合は `event.nativeEvent.isComposing` **と** `keyCode === 229` の両方で確定 Enter を除外。割り当てなければ問題なし |
| I-4 | iOS で keyboard を閉じる手段 | iPhone の Safari は `input type=search` + `enterKeyHint="search"` で右下キーが「検索」になる。**手動で閉じる汎用ボタンは iPhone に無い**。list の touch scroll では閉じない（iOS Safari の既定）。背景タップは **sheet を閉じてしまう**（`backdrop onClick`）| `Enter`（確定 Enter を除く）→ `blur()` + focus を list へ、を契約案とする（K-9 で復帰確認）。✕ は text を消して focus を field に残す（authority）。背景タップで keyboard だけ閉じたい要望が出れば Owner 判断 |
| I-5 | 全角 / 半角・濁点・長音・スペース | NFKC で `ﾍﾞｰｺﾝ` → `ベーコン` → `べこん`。`ー` / `・` / 空白は無視。**全角スペースのみの入力は空扱い（全件）** | Plan §6.3-3 の同値テスト（`ベーコン` / `べーこん` / `ﾍﾞｰｺﾝ` / `べこん`）で足りる。Composition event 列の unit test（`compositionstart → input(かな) → input(漢字候補) → compositionend`）を追加 |
| I-6 | 予測変換・自動修正・大文字化 | iOS の QuickType / 自動修正が field 内の文字を書き換える | `autocomplete="off"`, `autocapitalize="off"`, `autocorrect="off"`, `spellcheck=false`（Plan §6.1）。`autocorrect` は非標準だが Safari で有効。予測候補バー自体は消せない（K 高の見積りに含める）|
| I-7 | 入力確定前の paste / 長文 | `maxLength ≈ 20` | 全角混在でも 20 code unit 以内、サロゲートペアは想定外 |

---

## 7. R5-b 実装契約案（迷わないための測定/検証契約。値は含まない）

**A. 高さ**
1. sheet 高は「利用可能 viewport 上限」へ向けた CSS の**式**として実装し、確定値（px / dvh）は R5-b の 4 viewport 実測 + 実機 HV の後に決める。**本書の ESTIMATE をそのまま CSS にしない**。
2. invariant（keyboard なしの状態）: sheet の `getBoundingClientRect()` が search 有無・text・0 件〜多数件・shelf 変更で ±0.5px 同一（Plan §6.3-2）。header / 閉じる の位置も同一。
3. list が唯一の縦 scroller。search 行・chips・strip は sheet 内の `flex:none`（scroll 領域の外）。

**B. keyboard 対策の候補**（**実機発見の結果で採否**。どれも未決）
| 案 | 概要 | 長所 | リスク |
|---|---|---|---|
| K-α 静的 | 上限拡大（L1）のみ。keyboard は覆い被さるに任せる | CSS のみ・JS なし・境界テスト増なし | 小 viewport で結果行が見えない可能性（§5.2 で 390×664 / 360×640 が 1 行未満になり得る）|
| K-β `visualViewport` 駆動 | search focus 中のみ `sheet max-height = min(既定, vv.height − 余白)` と `bottom` オフセット（`layoutH − vv.offsetTop − vv.height`）を CSS 変数で与え、blur で解除 | keyboard 上の可視領域に sheet を収められる | 新規 hook・resize/scroll の順序・blur 後の復帰遅延（keyboard アニメーション中の resize 連射）・standalone 差・invariant の解釈（§0.1）|
| K-γ 構造 | search を keyboard 上に必ず残る位置へ（上端固定 / sheet を top-anchored に） | JS 不要 | 現行の bottom sheet の見た目・stage との関係が変わる（Human Feel 判断）|
| K-δ meta | `interactive-widget=resizes-content` | JS 不要 | Safari 非対応の可能性が高く、対応しても**全画面の layout が縮み stage が壊れる**ため却下候補（要実機確認だが採る可能性は低い）|

**C. Search field**
`type="search"`（または `inputMode="search"`）/ `enterKeyHint="search"` / `autocomplete/autocapitalize/autocorrect="off"` / `spellcheck=false` / `maxLength≈20` / **`font-size ≥ 16px`**（iOS auto-zoom 防止。現行 repo の唯一の input は 14px で前例にならない）/ field と ✕ は 44px / `aria-label="材料を検索"`（例示なし）/ **auto-focus 禁止**（open 時の focus は 閉じる のまま）。
**表示条件は `allItems.length > 6`（text・shelf 非依存）**。text 0 件で field が消えない。

**D. Focus / Escape / Enter**
- Escape: 現行 `section onKeyDown` のまま field 内でも close（OD-R5-8）。IME 中の挙動は変更せず観察のみ。
- Enter（確定 Enter を除く）: `blur()` して **focus を list（`tabIndex=0`）へ**（body に落とさない）。keyboard が閉じ、Escape / PageDown が外付 keyboard で引き続き効く。
- close 後: entry へ focus（現行）。`preventScroll` の要否は実機で判断。

**E. #197（§21.1）との関係**
search 変更は pantry-only 操作で `selectedIngredientId` を**クリアしない**（R4 と同じ）。R5-b は tray の visible set を変えない（Builder は不変）。K-12（tray 選択の保持）で実機でも確認。

**F. Reset**
close で text と shelf を両方 reset（unmount）。text / shelf の変更で list `scrollTop = 0`。shelf 変更は text を消さない（AND）。

## 8. 通常 Safari と standalone（PWA）の差（監査）

| 項目 | Safari タブ | standalone（ホーム画面追加）| 影響 |
|---|---|---|---|
| `env(safe-area-inset-top)` | 0（status bar は content 外）| **≈ 47〜59pt**（`black-translucent`）| pantry の上限式 `100dvh − safe-top − 20px` は両方で正しく動くはずだが、**最大高さの安全余白は standalone のほうが小さい**。両モードで測る |
| `100dvh` | toolbar の出入りで変動（ただし body 非スクロールなので toolbar は動きにくい）| 端末画面全体（固定）| 390×664 は Safari タブ、390×844 は standalone に近い（仮説）|
| keyboard 表示時の bottom toolbar | 隠れる（見える領域が変わる）| toolbar なし | K を含めた可視領域の式が異なる（§5.2 は toolbar 変化を**含めていない**）|
| keyboard 表示時の visual viewport pan | Safari が focus field を見せるため pan する可能性 | 同様だが、standalone の web view では**close 後に位置が戻らない不具合の報告**が過去にある（推定・未検証）| K-9 / K-10 |
| 検索/戻るジェスチャ | 画面端スワイプで戻る | standalone は戻る UI が無い | close 手段は 閉じる / 背景 / Escape のみで完結（既存）|
| キャッシュ / Preview URL | Preview デプロイの URL でそのまま開ける | manifest `scope: /teto-pizza-game/`・`start_url` 配下の URL でなければ standalone にならない | **standalone HV は「manifest scope に入る URL からホーム画面へ追加」できる環境が必要**。Preview の URL 形式が scope 外なら standalone HV はできない（要確認）。manifest の `icons[].src` は相対（`icons/...`）で、`index.html` の `link rel=icon` は絶対（`/icons/...`）— **本 audit の範囲外**だが、standalone 検証でアイコンが出ない場合の原因候補として記録 |
| Chrome iOS / アプリ内 WebView | WKWebView 系で toolbar / keyboard の扱いが異なる | — | 監査外（Safari を authority とする）|

**結論**: standalone と Safari タブで**差が出る前提**で、HV を 2 モードで実施する（§9 の E-1 / E-2）。どちらか一方の合格で他方を保証しない。

## 9. iPhone 実機 Human Verification 手順（K-1〜K-15 を具体化）

実施は **R5-b 実装後**（製品 UI が入った build）と、**実装前の発見**（§10 のハーネス）の 2 段。本節は実装後の HV 手順。CLAUDE.md / HV Policy: 動画（390×844 級、Owner へ直接提出、**repo に commit しない**）+ before/after screenshots（`docs/reports/screenshots/<task-name>/` に commit）+ Result Report。

**環境**: 実機 iPhone（390×844 級 1 台 + 小型 1 台）/ iOS バージョンを記録 / **Safari**（Chrome iOS ではない）/ Preview デプロイ / 日本語 IME（ひらがな / カタカナ / 半角 ｶﾅ）/ 可能なら Bluetooth keyboard / 準備 save: topping 22 所持・sauce 10・cheese 10・在庫 ≥ 1（`×0` も 1 件）・FREE クッキング / モード E-1 = Safari タブ、E-2 = ホーム画面追加の standalone。

| # | 手順 | 合格条件 / 記録 |
|---|---|---|
| H-0 | 各モードで開始前に `innerHeight`・`visualViewport.height`・`env(safe-area-inset-top/bottom)` を記録（§10 のプローブ or リモートインスペクタ）| 数値を Result の表へ |
| H-1 | FREE → topping step → 食材庫を開く（**Safari**）| sheet が safe-area を侵さない。stage / dock が動かない（Δ0）。上端・下端の余白を記録 |
| H-2 | Search 欄をタップ（focus）| 日本語 keyboard 表示。**search 欄・閉じる・chips が keyboard の上に見える**か。sheet の外形 / 位置の変化・ページ全体のズレ有無。keyboard の高さ K・keyboard 上の可視領域（`visualViewport.height`）・見える結果行数を記録 |
| H-3 | 日本語 keyboard 表示（QuickType / 予測変換バーの有無を記録）| K の実測値 |
| H-4 | **ひらがな入力**（例:「べ」「べー」「べーこ」…）| 入力ごとに絞り込み。変換中の空状態ちらつきの有無を記録 |
| H-5 | **漢字変換**（例:「たまねぎ」→ 候補「玉ねぎ」に切替→確定）| 変換中/確定後の挙動を記録。**確定後 0 件になるのは仕様上の帰結**（names は kana のみ、§6.12 I-2）。操作不能・クラッシュ・キーボードが固まる等は不合格 |
| H-6 | カタカナ / 半角 ｶﾅ（「ベーコン」「ﾍﾞｰｺﾝ」）| 同一行集合 |
| H-7 | **検索結果更新** | text 変更ごとに list は先頭へ、sheet 外形不変（keyboard 表示中は §0.1 の解釈で確認）、件数・候補・例示の表示なし |
| H-8 | **Shelf chip 変更**（search 文字あり）| AND。list 先頭へ。chips 行・search 欄が動かない。chip 選択で keyboard が閉じるか（記録）|
| H-9 | **list scroll**（keyboard 表示中 / 閉じた後）| list のみ scroll。**body / page は動かない**。scroll 中に keyboard が閉じるか（記録）|
| H-10 | **PageDown 相当**: 外付 keyboard で PageDown / Space（list フォーカス）、Enter 後の focus 位置、Tab 順（閉じる→search→✕→chips→list）。外付 keyboard が無ければ VoiceOver の「3 本指スクロール」で代替、または実施不可と明記 | list のみ scroll、body 不動。Enter 後に focus が list へ移り Escape / PageDown が効く |
| H-11 | **Escape / close 契約**: 閉じる / 背景タップ / 外付 keyboard の Escape（**field フォーカス中**も、**IME 変換中**も）| 閉じる・背景・Escape（field 内）で sheet が閉じる（OD-R5-8）。**変換中 Escape の挙動を観察記録**（変更しない）|
| H-12 | **keyboard dismiss**: 「検索」キー / Enter / 変換確定の Enter / 背景タップ / 他の操作 | 何が keyboard を閉じるか一覧化。確定 Enter で誤って blur・close しない。keyboard を閉じる手段が少なくとも 1 つ自然に存在する |
| H-13 | **sheet geometry 復帰**: keyboard を閉じた直後と 1 秒後に sheet の y / h / list を H-1 と比較 | open 直後と同一（±0.5px）。`visualViewport.offsetTop === 0`。残骸なし（K-9）|
| H-14 | **body がスクロールしていない**: focus / keyboard 開閉 / 入力中 / close 後に `window.scrollY`・`visualViewport.pageTop` | 常に 0（K-10）。stage / dock に上下ズレ・空白帯なし |
| H-15 | **pizza stage / dock が壊れていない**: sheet を閉じた後の stage Ø・dock 高・bake bar の位置・chips・pager 行 | 開く前と同一（4 viewport の実測値と比較）|
| H-16 | **close 後 entry へ focus return**: keyboard 表示中に close した場合と、keyboard を閉じてから close した場合の両方 | entry ボタンに focus。close 直後に画面が pan しない（`preventScroll` 要否を記録）|
| H-17 | reopen | text 空・shelf「すべて」・list 先頭・keyboard は出ない（auto-focus なし）|
| H-18 | tray 選択との独立（K-12）: page 2 で材料選択 → 食材庫で search / shelf → close | 選択・page 保持（#197 P1）|
| H-19 | 小型端末で H-1〜H-17 を再実施（K-13）| list が 2 行未満にならない・閉じる / search が押せる |
| H-20 | Dinner / Lunch Rush / guided を 1 周（K-15）| entry なし・tray / stage 従来どおり |
| H-21 | **E-2: standalone で H-1〜H-17 を再実施**（可能なら Safari とは別日に、アプリを再起動して）| Safari との差（safe-top・keyboard 上の可視領域・復帰）を表で比較 |

**提出物**: 動画（H-1〜H-18、390×844 級、各状態 1〜3 秒保持）+ 小型端末動画（H-19）+ standalone 動画（H-21）+ 4 viewport の before/after screenshots + Result（4 viewport 実測表: sheet 高 / list 高 / 費用、keyboard 表示中の可視領域、**確定した最大高さの式とその根拠**、Safari/standalone の差）。**実機が使えない場合は「実機未確認」と明記し、Owner 実機確認を merge 条件に残す**（H5-5 方式）。

## 10. 実装前の実機発見（Real-device Discovery）— ハーネス仕様

目的: R5-b の設計分岐（K-α / K-β / K-γ）と IME 契約（I-1〜I-4）を、**製品コードを書く前に**実機データで決める。所要は 1 端末・約 30 分を想定。**repo の production/test には入れない**（使い捨て静的 HTML。scratchpad か Owner 管理の任意のホスティング）。

ハーネスが再現するもの: 現行 pantry と同じ CSS（bottom-anchored fixed sheet、`min(70dvh, 100dvh − safe-top − 20px)` と、`100dvh − safe-top − 20px` の 2 切替）/ header + subtitle + search + chips（ダミー）+ list（22 tile）/ `viewport-fit=cover` + `apple-mobile-web-app-*` meta + manifest（standalone 検証用）。
ハーネスが常時表示するログ（画面上部の固定パネル or `console` を Web Inspector で回収）: `innerHeight` / `visualViewport.{height, offsetTop, pageTop, scale}` / `scrollY` / `env(safe-area-inset-*)`（CSS プローブ要素の高さ）/ sheet の `getBoundingClientRect()` / `document.activeElement` / composition・input・keydown（`key`, `keyCode`, `isComposing`）イベント列。

| D-# | 確認する問い | 分岐する判断 |
|---|---|---|
| D-1 | keyboard 表示で `innerHeight` / `100dvh` が変わるか（Safari タブ・standalone 各）| K-α が成立するか（変わらない前提が事実か）|
| D-2 | keyboard 高 K（日本語かな・ローマ字・予測変換 ON/OFF）と `visualViewport.height` | §5.2 の K 仮定（291〜340）の検証。ガードレールを満たす最小 viewport |
| D-3 | focus 時に Safari が visual viewport を pan するか（`offsetTop` / `pageTop`）。sheet の上部（header）が画面外へ出るか | K-β の必要性 / `bottom` オフセットの式 |
| D-4 | blur / keyboard 閉鎖後に `offsetTop` が 0 に戻るか（Safari タブ・**standalone**）| 復帰保証（K-9 / K-10）、`scrollTo(0,0)` 補正の要否 |
| D-5 | `font-size` 14px と 16px の field で focus 時 auto-zoom（`visualViewport.scale`）| 16px 契約の必要性の裏付け |
| D-6 | 日本語変換中の event 列: 漢字候補選択時に `input.value` が漢字になるか、`compositionend` / 最終 `input` / Enter `keydown`（`isComposing`, `keyCode 229`）の順序 | I-1〜I-3（凍結の要否・Enter の除外条件）|
| D-7 | 外付 keyboard（あれば）の Escape が変換中に `keydown` として届くか | OD-R5-8 の体感確認（変更しない）|
| D-8 | keyboard 表示中に tile 相当（`li` / `button`）をタップして keyboard が閉じるか、backdrop タップで何が起きるか | I-4（keyboard dismiss 手段）|
| D-9 | list をドラッグ scroll して keyboard が閉じるか / body が動くか | 契約 A-3 / H-9 |
| D-10 | keyboard 表示中に `visualViewport` の `resize` が何回・どの順で発火するか（keyboard アニメーション中の連射）| K-β を採る場合の rAF 合流・復帰遅延の設計 |

## 11. Owner に確認したい点 / 提案

| # | 内容 | 種別 |
|---|---|---|
| Q1 | §0.1 の読み: 「in-sheet state で外形が跳ねない」は sheet 内部の状態に限り、**keyboard 表示中の sheet 収まり調整（K-β 系）は invariant の違反ではない**。キーボードを閉じたら外形が元へ戻ることが条件。この読みで良いか | 解釈確認（K-α だけで足りれば不要）|
| Q2 | production の材料名は**すべて kana のみ**で `readingJa` が無いため、**漢字で確定した検索語（「玉ねぎ」「卵」等）は 0 件になる**。R5-b では現仕様（kana のみ一致）で良いか。漢字入力にも対応する場合は `readingJa` / 別名データの別スライスが必要 | 製品判断（**R5-b をブロックしない**。実機 HV の合格条件に事前明記するため確認）|
| Q3 | Plan §6.1 に追加提案: (a) search 表示条件は `allItems.length > 6`（text 非依存）、(b) Enter → blur + list へ focus、(c) auto-focus 禁止。いずれも authority と矛盾しない実装契約の補足 | Plan への補足提案（Owner の反対がなければ R5-b 契約に採用）|

いずれも R5-b の**着手を止める Owner Decision ではない**。着手を左右するのは §10 の発見結果。

## 12. Mutation 候補の追加（Plan M60〜M73 への追記案）

M74 search 表示条件が text / shelf 依存（0 件で field が消える）/ M75 text を chip 導出（`itemsFor()`）に渡す（M65 と同型、再掲）/ M76 open 時に search へ auto-focus / M77 field の `font-size < 16px`（M71 再掲）/ M78 確定 Enter（`isComposing` / keyCode 229）で blur / M79 Enter 後 focus が body に落ちる / M80 blur 後の `visualViewport` 補正が残る（K-β 採用時）/ M81 keyboard 復帰後に sheet の外形が変わる / M82 focus 中のみの sheet 高さ変更が blur で解除されない / M83 IME 変換中の text 更新で 0 件文言がちらつく（採用する場合の凍結が効かない）/ M84 Escape が search field 内で close しない（M66 再掲）。

## 13. 監査の限界

- **実機・WebKit・keyboard・IME は一切実行していない**。§5.2 と §6.7 / §6.9 / §6.12 / §8 の iOS 挙動記述は**推定**であり、§10 の発見で確定する。
- §5 の数値は 79.19 行ピッチ・chrome 89 / 12・search 52・strip 52・chips 54 の算術（ESTIMATE）。実装後の実測が正。safe-area-bottom（≈ 34）と standalone safe-top（≈ 47〜59）は端末差があり emulation では 0。
- §4 の MEASURED は Chromium（Desktop）の real layout。WebKit / 実機との差は §8 のとおり。
- R5-a の実装・PR の状態は確認できていない（R5-a は本書の前提としない。R5-b は authority 上 R5-a merge 後）。

---

## 14. FINAL VERDICT

**C. REAL-DEVICE DISCOVERY REQUIRED BEFORE IMPLEMENTATION**

理由:
1. 現行 70dvh の bottom-anchored sheet は、ESTIMATE の範囲で **390×664 / 360×640 の keyboard 表示中に結果行が見えず、search 欄すら切れ得る**（§5.2）。拡大（L1）でも小 viewport・keyboard 大・standalone の組で 1 行未満になり得る。keyboard 対策の**方式（K-α / K-β / K-γ）は実装の構造（新規 `visualViewport` hook の有無、sheet の anchoring）を決める**ため、実装後の HV で初めて分かる形にすると手戻りが大きい。
2. 決め手の事実（keyboard で `dvh` が変わるか / Safari が pan するか / 復帰するか / standalone 差 / 日本語変換中の event 列）はいずれも Chromium では再現できず、現行 repo にも既存の知見が無い（§6.5、§6.12）。
3. 日本語 IME 側は、名前が kana のみであることから**漢字変換で 0 件になる**という製品上の帰結（Q2）が HV の合格条件に影響する。

一方で、**Owner の未決事項は R5-b を止めるものではない**（OD-R5-5 が「実測 + 実機 HV で決める」を定義済み。Q1〜Q3 は確認・補足）。R5-b の残りの範囲（search 契約・name AND shelf・Escape・focus return・chip 独立・#197 非干渉）は現行コードと authority から十分に定まっており、§10 の発見（約 30 分・1 端末）が終われば **A（R5-b READY AFTER R5-a）へ移行できる**。

R5-b production 実装には進まず、ここで STOP する。
