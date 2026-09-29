# Ingredient Category Tabs 1.0 — Phase 2 (FREE Cooking Builder) Fresh Re-Audit

**docs only。production code / CSS / tests / e2e は変更していない。PR なし。実装なし。Phase 4 Ingredients branch には触れていない。**

## 1. Audited main SHA

**`cf1c57de51891d3b81c456e78e6926ccfe9229fc`**（PR #301「Phase 3: Shop shelf chips」merge。GitHub API の `main` 先頭と、ローカル `origin/main`・作業ツリーが一致）。

- 前回の Phase 3 (Shop) 監査時の main は `8d96307`。その後 **Shop 実装（#301）が入り、`ShelfChips.tsx` は production にある**（本監査はこの現物を読んだ）。
- 制約の開示: この session の shell（Bash）が classifier エラーで使えず、**ブラウザ計測・`npm test` は実行できていない**。SHA は GitHub API と `.git/refs`・`FETCH_HEAD` で確認。§11 の数値は「既存の committed 計測 ＋ CSS 定数からの算出」で、fresh な実機計測ではない（実装前に §12 の e2e で必ず取り直す）。
- 置き場所: repo に `docs/audit/` は無く、既存の監査は `docs/reports/` にあるため、そこに置いた。

## 2. Builder architecture（現物）

| 要素 | 現状 | 出典 |
|---|---|---|
| tray 本体 | `IngredientTray`。**GameScreen が `state.makingStep !== "DOUGH"` の間ずっと mount**（step を跨いで生存） | `GameScreen.tsx:768` |
| 表示リスト | `trayIngredientsFor(category, {owned, freeCook, recipe})` が **tray と dock 予約の単一の源** | `prepareDock.ts:30` |
| ページング | `MAX_INGREDIENT_PALETTE_SLOTS = 6`（3×2）。`page` は tray の local state。`activeCategory` 変更で `setPage(0)` | `IngredientTray.tsx:156,307` |
| 選択 | **App が所有**（`selectedIngredientId`）。tray は prop で受ける。tap で `PLACE_TOPPING` | `App.tsx:224,709` |
| 選択のリセット | 新 round・making step の変更（`App.tsx:287-318`）。**page 移動は tray の `goToPage` が `onClearSelection`（PR #197）** | `IngredientTray.tsx:331` |
| dock 予約 | `prepareDockReserve` が round 開始時に「最も高い step」の行数と pager 有無を決め、`min-height` を **round 全体で固定**（Issue #245） | `prepareDock.ts:64` |
| step タブ | `MakingStepTabs`（`role=tablist` / `role=tab` / `aria-selected`、tabpanel なし） | `MakingStepTabs.tsx:152,169` |

### 重要な発見 F-1: `freeCook` prop は Dinner でも true
`recipeFreeTray = state.freeCook || state.dinner !== null`（`GameScreen.tsx:306`）を tray の `freeCook` に渡している。**tray 内の `freeCook` だけを gate にすると、Dinner Mission（制限時間あり）にも chip が出る**。OD-CT-1 は「FREE Cooking のみ」なので、gate は別 prop が必要（§6）。

## 3. FREE vs recipe-specific tray

| | FREE Cooking | Dinner（参考） | Guided / Lunch Rush |
|---|---|---|---|
| tray の源 | 所持している全 ingredient（在庫 0 も disabled で残る） | 同左（recipe-free） | `recipe.requiredIngredients` ∩ 所持 |
| LOCKED / 未購入 | 出ない | 出ない | 出ない |
| topping 件数 | 所持数（1〜22） | 同左 | 実質 ≤6（curated）。7 以上は「defensive cap」コメントのみで、出荷レシピには無い |
| ページ | 22 で 4 ページ | 同左 | 1 ページ |
| chip の要否 | OD-CT-1: `> 6` のとき | **対象外**（要 Owner 確認、§14 OD-B4） | **出さない**（OD-CT-1） |

## 4. Candidate counts（決定的。未分類は推測しない）

出典: `src/data/ingredients.ts`（production 29）、`src/data/ingredientTaxonomy.ts`（topping 22 行）、`data/recipes/ingredient_master_catalog.json`（62）。`shelf` は `ingredientShelf.ts` の authority（sauce / cheese は category、topping は family）。

### 4.1 Current production catalog（29）／ current FREE owned maximum

**FREE owned の最大は 29**（Shop 行の最大 26 ＝ sauce 2 / cheese 3 / topping 21、＋ Starter 3: tomato-sauce, mozzarella, basil。`STARTER_INGREDIENT_IDS`）。**新規 save の FREE は sauce 1 / cheese 1 / topping 1（basil）**。

| step の category | 最大候補 | ページ | chip（`>6` gate） |
|---|---:|---:|---|
| sauce | 3 | 1 | なし |
| cheese | 4 | 1 | なし |
| **topping** | **22** | **4** | **あり得る（7 件目の所持から）** |

topping 22 の family 内訳（**22/22 が分類済み**、`auditShelfAuthority().ok`）:

| family（chip 名） | 件数 | 構成 |
|---|---:|---|
| meat 肉 | 4 | sausage, pepperoni, bacon, ham |
| seafood 魚介 | 3 | anchovy, tuna, clam |
| vegetable 野菜・きのこ | **8** | mushroom, cherry-tomato, onion, black-olive, corn, eggplant, fresh-tomato, potato |
| fruit 果物 | 1 | pineapple |
| herb ハーブ・香味 | 4 | basil, oregano, rosemary, garlic |
| spice スパイス・薬味 | 1 | capers |
| other その他 | 1 | egg |
| 合計 | 22 | |

- **vegetable 8 は 6 を超える**ので、chip で絞っても 2 ページ残る（filter 変更時の page reset が必須）。
- fruit / spice / other は **1 件の chip**。所持済みの 1 件を絞るだけで情報は増えないが、chip 行の幅・タップ先は 1 つ増える。

### 4.2 62 catalog（全所持と仮定した上限。production 未 wire）

62 = sauce 10 / cheese 10 / topping 42。

| 区分 | 件数 | 内訳 |
|---|---:|---|
| topping・**分類済み**（production taxonomy に行がある） | **19** | meat 4（sausage, pepperoni, bacon, ham）/ seafood 2（anchovy, tuna）/ vegetable 7（mushroom, cherry-tomato, onion, black-olive, corn, eggplant, potato）/ fruit 1（pineapple）/ herb 4（basil, oregano, rosemary, garlic）/ spice **0** / other 1（egg） |
| topping・**未分類（推測しない）** | **23** | zucchini, bell-pepper, prosciutto-crudo, arugula, spicy-salami, shrimp, parsley, artichoke, breadcrumb, nduja, porcini, truffle, speck, walnut, wurstel, french-fries, chicken, cilantro, steak, nori, strawberry, powdered-sugar, fig |
| 62 に無い production の topping | 3 | clam, capers, fresh-tomato（62 の 19 + 3 = 22 ✓） |

- 未分類 23 = `ingredientShelf.test.ts` の「62 catalog」gate（P1 Result の 23 件）と一致。**どの family にも入れていない**。`ingredientShelf()` は `null`（fail-closed）、chip は無く「すべて」でのみ到達できる。
- 62 では **topping の 55%（23/42）が chip から到達不能**。`auditShelfAuthority().ok === false`。**62 を出荷する前に HCG（#293 / #296）で分類が必要**。それまで chip 付き tray は成立しない（「すべて」に大半が残る）。
- 62 の sauce 10 / cheese 10 は `> 6` で pager が要るが、**sauce / cheese の shelf は category 1 つだけ**なので chip は無意味（sauce step に「ソース」chip 1 つ）。**chip は topping step 限定にする必要がある**（§6）。

## 5. Chip visibility gate（OD-CT-1）

推奨する gate（全て真のときだけ表示）:
1. tray が **FREE Cooking の round**（`state.freeCook && state.dinner === null`。Dinner を含めるかは OD-B4）
2. `activeCategory === "topping"`
3. `trayIngredientsFor("topping", …).length > MAX_INGREDIENT_PALETTE_SLOTS`（**在庫 0 の disabled も候補に数える**。tray に見える件数と一致させる）
4. 表示する chip は `shelvesPresent(その候補)`。「すべて」＋所持 family のみ（件数なし、OD-CT-6）

- 「recipe-specific tray には分類 chip を出さない」は、gate 1 が prop で明示されるため構造的に守れる。**tray 内で `recipe` の有無や `freeCook` prop から推測してはいけない**（F-1）。
- 所持は round 中に変わらない（購入は round 外）ので、**候補数・chip の有無は round 開始時に確定**する。dock 予約と同じ源（`trayIngredientsFor`）から計算すれば、round 途中で chip が出入りして stage が動くことはない。
- sauce / cheese step は常に chip なし（現物で ≤4。62 でも shelf が 1 つ）。

## 6. FREE だけに限定する安全な gate

- `IngredientTray` に新 prop（例 `shelfChips?: boolean`、既定 `false`）。**GameScreen が `state.freeCook && state.dinner === null` を渡す**。tray 側は prop が真のときだけ §5-2,3 を評価する。
- 同じ真偽と件数から `prepareDockReserve` に `chipRow: boolean` を渡し、`.prepare-dock` の `min-height` に **round 全体で**行を予約する（DM-3R-0 と同じ流儀。step ごとに増減させると stage が跳ねる＝ LC-S1 違反）。
- 単一の判定関数を pure に切り出し（例 `builderShelfChipsVisible({freeCook, dinner, category, candidates})`）、tray と dock 予約が **同じ関数**を呼ぶ。テストで「両者が食い違えない」を固定する。

## 7. PR #197 conflict analysis（**衝突あり → OWNER DECISION REQUIRED**）

**PR #197（merged）の契約**: 「選択中の chip を隠す page 移動は selection を clear する。見えない選択が残ると、次の pizza tap が見えない材料を置き、有限在庫を消費／FREE の pizza 内容を変える」（`IngredientTray.tsx:46-50, 338-345`、`App.freeCookTrayPaging.test.tsx`）。

**OD-CT-5**: 「shelf filter は display-only で、selection を clear しない」。

**衝突の構造**: Builder では tap-to-place の `selectedIngredientId` が生きているため、chip で選択中の材料を隠すと、**#197 が塞いだ「見えない選択」状態がそのまま再現する**。しかも `App.handleTapPizza` は表示を見ずに `PLACE_TOPPING` する（在庫を消費し、FREE の match 結果を変える）。Shop には selection が無いので OD-CT-5 は Shop では無矛盾だった（Shop 監査 §10 の予告どおり）。**どちらも勝手には変更していない。**

| 案 | 内容 | #197 | OD-CT-5 | 影響 |
|---|---|---|---|---|
| **D1** 文言どおり | 選択を保持。filter で隠れても選択は生きる | **違反**（invisible selection を再導入。#197 の 3 テストを filter 向けに緩めるか例外化が必要） | 適合 | 最小実装だが P2 バグ再発。**非推奨** |
| **D2** clear（推奨） | filter 変更で選択中の chip が隠れる場合だけ `onClearSelection`。#197 と同じ条件式を filter にも適用。**OD-CT-5 を「filter は所持・在庫・pizza・スコア等 domain state を変えない（選択という一時的 UI 状態は #197 に従う）」と読み替える 1 行の Owner 明確化が必要** | 適合（契約を拡張） | 文言は緩和（domain は不変） | 実装最小・追加 UI なし。選択し直し 1 タップの負担。dock 高さ影響なし |
| **D3** 保持＋常時可視 | 選択を保持し、選択中の材料を filter 外でも見せる（chip 行に「選択中: ○○」ピン、または tray に pinned chip） | 適合（見えている） | 適合 | **新 UI が要る。§11 のとおり行を足すと stage floor を割る**。ピンの置き場所・幅・a11y を別途設計 |
| **D4** 隠さない | 選択中の family の chip 以外を押せなくする／確認を挟む | 適合 | 適合 | 操作性が悪い。**非推奨** |
| **D5** 和集合 | filter 結果に選択中の材料を混ぜる | 適合 | 適合 | family 意味が壊れ、ページ・6 スロット固定を乱す。**非推奨** |

**推奨は D2**（理由: 契約の目的が同じ／追加 UI なし／stage 影響なし／既に検証済みの #197 テストを拡張するだけ）。ただし **OD-CT-5 の文言変更を伴うため Owner 判断**とする。D3 は「選択を失わせたくない」が優先される場合の代替案（コスト高）。

## 8. Selection preservation design（案ごと）

共通:
- filter 状態は **tray の local state**（`ShelfFilter`、既定 `"all"`）。App / reducer / save には出さない。
- **リセット点**: `activeCategory` 変更（既存の `setPage(0)` と同じ effect）、round 変更、`resetToken` / `makingStepToken`。tray は step を跨いで mount されるため、**明示リセットが無いと前 step の filter が残る**。
- filter 変更時は必ず `setPage(0)` と、進行中の physical-drag session の `clearSession()`（page 変更 effect と同じ扱い）。
- filter 変更は `feedback` 等の他状態に触れない。`goToPage` の「選択が現ページに居て次ページに居ない」判定は、**filter 後のリスト**（`visibleItems`）を対象にする。
- 選択は App が所有するので、保持案（D1/D3）は tray から何もしなければ保たれる。「filter 外でも保持できるか」→ **技術的には可能**（selection は filter に依存しない）。問題は可視性だけ（§7）。

D2 の実装: `changeFilter(next)` 内で `selectedIngredientId` が現リストにあり、かつ `next` のリストに無い場合に `onClearSelection?.()`（`goToPage` と同形）。

## 9. #272 Large Catalog UX との関係（**衝突あり → OWNER DECISION REQUIRED**）

- #272: OPEN・`mergeable_state: clean`・base `e21fbc2`（main から大きく遅れている）・75 files。中身は **pure・unwired**（`src/logic/catalog/*`、production は import しない）。**production に影響はまだ無い**。
- ただし **Owner Authority（Owner Decision Gate §17、2026-09-27 承認）が既にある**: **LC-OD-1 = 案 A「手元（working set）＋食材庫 bottom sheet」を設計方針として承認**。案 B「トレイ内に family タブ行を追加」は **「stage が約 32px 縮み、DM-3R-2 の mode 別 stage floor を割る」ため不採用候補として明記**。適用範囲は **Free Cooking と Dinner**、発動は「所持数が手元容量を超えたときだけ」。容量は 9 / 12 未決（LC-OD-4）。family 棚は **食材庫 sheet 内の横チップ 1 行**（LC-OD-2）。
- **つまり OD-CT-1（Builder tray に chip）は、Owner が承認済みの LC-OD-1 の「案 B」に近い**。両方は成立しない:
  - 「手元 ≤12」が入ると、FREE の tray は 22 topping でも **最大 12（2 ページ）**。OD-CT-1 の `> 6` は 7〜12 で誤発火し、「chip が絞る対象」が手元か所持全体かが曖昧になる。
  - family 検索の本来の置き場は **食材庫（LC-3）**。tray chip は LC-2 が入ると不要（または二重）になる。
- 順序の事情: LC-2 は LC-1（#272）と LC-1b の後。#272 は未 merge で stale。Builder chip を今入れると、LC-2 で **捨てるか作り替える**可能性が高い。

## 10. catalogQuery との semantic overlap

| | `filterByShelf` / `shelvesPresent`（main） | `catalogQuery`（#272、未 merge） |
|---|---|---|
| family の源 | DH4-1 `ingredientTaxonomy`（import する） | **import 禁止**。family 表を注入（静的境界 test） |
| 機能 | 単一 shelf の filter、存在 shelf の列挙 | category / family / group / text / favorite / recent / sort、所持のみ返す、`familyCounts` |
| 件数 | なし（OD-CT-6） | `familyCounts` あり（Phase 5 まで保留の対象） |

意味は重なる（**「family で絞る」の 2 実装**）。ただし現時点で production が使うのは `ingredientShelf` だけで、**#272 が merge されても片方を呼ぶだけなら authority 重複にはならない**（family id は両方 DH4-1 由来）。重複が実害になるのは「Builder tray が `filterByShelf`、食材庫が `queryCatalog`」と別実装になったとき。→ 統合方針は Owner 判断（OD-B2）。

## 11. Mobile measurements（**算出値。fresh な実機計測ではない**）

根拠: `.shelf-chip` は `min-height: 44px`（Shop 用、`App.css:2779`）、`.shelf-chips` は `padding-bottom: 2px`・`gap: 8px`。dock: chip 行 64px・gap 6px・pager 行 34px（`App.css:4680-4700`）。既存の実測: **FREE の dock 最大時 stage 269 / 245 / 188 / 164（S390 / S360 / E390i / E360i）**、LC-S3 floor は FREE **262 / 238 / 182 / 158**、N390 / N360 は 290 / 274 の上限（`layout-contract.spec.ts:489-502`）。

| 案 | 追加高さ（算出） | S390 269→ | S360 245→ | E390i 188→ | E360i 164→ | floor 判定 |
|---|---:|---:|---:|---:|---:|---|
| ShelfChips をそのまま（44px＋2px＋6px 余白） | **≈ +52px** | ≈217 | ≈193 | ≈136 | ≈112 | **S / E は全て floor（262/238/182/158）割れ** |
| 32px に縮めた variant | ≈ +40px | ≈229 | ≈205 | ≈148 | ≈124 | **なお割れ** |
| pager 行（34px）と置換 | ±0 | 269 | 245 | 188 | 164 | 通るが **「すべて」の 22 topping（4 ページ）で pager が要る**ため置換不可。1 行に chip＋ページ矢印を同居させる再設計が必要（LC-2 の「棚バー」に相当） |

- N390 / N360 は上限キャップで余白がある可能性があるが未確認。**S / E で LC-S3 を割るため、追加行は現行の Layout Contract と両立しない**（floor 変更は Owner 判断）。
- chip 44px は tap target 基準（Shop 監査 §7）だが、tray の pager ボタンは 36×28 で既に F-1（P1・Owner 保留）。**tray 内の chip を 44px にできない場合の扱い**も Owner 判断。
- 幅: 現物の 7 family ＋「すべて」＝ 8 chip ≈ 660px（14px font、Shop 監査の実測式）。360 / 390 幅では 5〜6 個目で切れて横スクロール。tray は 3 列で **縦に 6 スロット固定＝横スクロール禁止の思想（Fix 2: スクロールとドラッグの競合を解消）**。chip 行の横スクロールは tray の grid とは別軸だが、GameScreen 全体の縦スクロール／横 swipe との競合を Human Feel で確認する必要がある。
- **実装前に必ず取り直す**: 390×844 / 360×800 / 390×664 / 360×640 の 4 profile × FREE TOPPING（22 所持、all / vegetable）、chip 行の実高・stage 径・page 横 overflow 0。

## 12. ShelfChips reuse / ingredientShelf SSOT / a11y

**ShelfChips（`src/components/ShelfChips.tsx`）をそのまま reuse できるか: ロジックは可、見た目はそのままでは不可。**
- 可: props（`shelves` / `active` / `onChange` / `ariaLabel`）、`role="group"` ＋ `aria-pressed`、「すべて」先頭、件数なし、DOM に無い shelf は描画しない、row 内 scroll のみ（ページは動かさない）。Builder が消費側で `shelvesPresent(候補)` を渡せば **Shop と同じ契約**。
- 不可／要変更: `.shelf-chip` は **44px・14px・`padding: 0 12px`・`flex: 0 0 auto`** の Shop 寸法。§11 のとおり dock に置けない。**variant（class 修飾子）か dock 専用 CSS が要る**。`.shelf-chips` の `flex: 0 0 auto` は「overlay body が column flex」前提のコメント付きで、dock の flex 配置との相性を確認する。`scrollIntoView` 相当は row の `scrollLeft` のみで OK（現物どおり）。
- 変更するなら `ShelfChips` を presentational のまま保つ（Shop の test を壊さない）。

**`ingredientShelf` を SSOT にできるか: できる。**
- shelf = topping は DH4-1 family、sauce / cheese は category。1 ingredient 1 shelf、table 二重管理なし、未知 id は `null`（fail-closed）、production 29/29 分類済み。Hint 5.0 の family id と 1:1（`HINT_CLASS_DISPLAY` のキーと gate 済み）。
- Builder は topping step のみ使うので、実質 **`ATTRIBUTE_FAMILIES` の 7 shelf**。`filterByShelf` は `{id}` を取るので tray の `Ingredient` をそのまま渡せる。
- 62 では未分類 23 が `null`（§4.2）。**HCG 完了までは 62 で使えない**。

**a11y（MakingStepTabs との整合）**
- `MakingStepTabs` は `role="tablist"` / `role="tab"`（tabpanel なし、既存）。ShelfChips は `role="group"` ＋ `aria-pressed` で **意味が別**（step ナビ vs フィルタ）。**同じ画面に tablist と chip group が並んでも、ロール衝突・入れ子は無い**。
- 要件: group の `aria-label` は step タブ（「ピザづくりの工程」）と別の固有名（例「材料の分類」）。DOM 順は step タブ → stage → dock（chip → tray → pager）→ CTA で自然な tab 順。
- tray の既存 `aria-live="polite"`（sr-only）に「○○で絞り込みました」（件数なし）を流すのは可。
- hint sheet / global overlay 表示中は tray と同じく操作不能であること（既存の inert / `isGlobalOverlayOpen` 経路に chip が乗るか）をテストで固定。
- 44px 未満にする場合（§11）は F-1 と同じ扱いを明記する。

## 13. Hint 5（classification hint → matching shelf → ingredient inference）の UX

- 現物: FREE の PREPARE で hint は **ダイアログの HintSheet**（`aria-haspopup="dialog"`、閉じてから調理に戻る）。Hint 5.0 の分類は family id、**shelf id と 1:1**（`HINT_CLASS_DISPLAY` ⇔ `ATTRIBUTE_FAMILIES`）。
- 流れ: hint sheet で「肉系」→ 閉じる → topping step で chip「肉」→ 所持の肉 4 件だけが並ぶ → 選んで置く。**成立する**。ラベルの差（「肉系」/「肉」、`other` は「ちょっと変わった材料」/「その他」）は OD-CT-3 で決定済み（id 共有・文言は文脈別）。
- 成立しない・弱い場面: (a) 所持が 6 以下で chip が出ない（全部 1 ページに見えているので不要）、(b) 分類された family に所持が無く chip が無い（「所持に無い」ことは tray からも既に分かる）、(c) `other`（その他）が 1 件のみで絞りの意味が薄い。
- 同時に開ける hint sheet と chip を **同じ画面に見せる**設計は無い（sheet は modal）。hint から chip を自動選択する連携は **#272 の LC-4（H-C）の領域で、本 Phase の対象外**。
- 検証項目: chip の中身は「所持 × family」で、Hint の回答粒度より細かくならないこと（H-D）。

## 14. Privacy analysis

| 漏洩経路 | 判定 |
|---|---|
| chip の有無・順序 | 候補は**所持のみ**（`trayIngredientsFor`）。未所持 family は出ない。順序は固定 authority 順。隠れた情報なし |
| 件数 | 出さない（OD-CT-6）。aria にも出さない |
| LOCKED / 未購入 | tray が既に除外。filter は結果集合の部分集合なので **filter で増えない**（property test 化） |
| 62 の未分類 23 | shelf `null`。chip にも件名にも出ない（「すべて」のみ）。**推測分類しない** |
| hint との関係 | family 表示は DH4 の脅威モデルの前提そのもの（#272 Gate §3 LC-OD-2）で新規漏洩なし。ただし **Hint 5.0 は k≥2 に coarsen しない**（taxonomy コメント）ため、「hint の family に所持が 1 件のみ」のとき chip で 1 件に絞れる。**新しい情報経路ではない**（所持は自己情報）が、Hint 5.0 の privacy 契約を読み直して確認する（下記 OD-B5 の前提テスト） |
| DOM / DevTools | 隠れた shelf は DOM に無い（Shop と同じ。`hidden` / `display:none` 不可） |
| 永続化 | filter は local state のみ。save・reducer・inventory・scoring に出ない |

## 15. scoring / placement / inventory への影響

- **なし（設計上）**: filter は tray の表示リストを変えるだけ。`PLACE_TOPPING` / `canPlaceIngredient` / `remainingStock` / `consumePizzaInventory`（`CONFIRM_BAKE` で 1 回）/ FREE matcher は入力が同じ。
- 唯一の実質影響は **selection の扱い（§7）**。D1 は「見えない選択」で在庫消費と FREE の match を変える。D2 / D3 は変えない。
- 在庫 0 の候補は disabled で listed のまま（EP3 契約）。**filter が在庫 0 を隠す／出すのは表示のみ**。

## 16. Required tests（実装時）

**unit / component**
1. gate: FREE ∧ topping ∧ `>6` のときだけ chip。Guided / Lunch Rush / Dinner（OD-B4 の結論どおり）/ sauce / cheese / 候補 ≤6 で **DOM に chip が無い**（`queryByRole` null、text も無い）。
2. gate と dock 予約が同じ関数から出る（食い違い不能）。round 中に chip が出入りしない。
3. chip = 「すべて」＋所持 family のみ、authority 順、件数 text なし。
4. filter 変更で page が 0 に戻る。vegetable 8 で 2 ページ。`goToPage` の #197 判定が filter 後のリストで動く。
5. **選択契約（Owner 決定の案どおり）**: D2 なら「選択中を隠す filter で clear、隠さない filter では保持」。D3 なら「保持＋見える」。**#197 の既存 3 テスト（`App.freeCookTrayPaging`, `IngredientTray.physicalDragReset`, `FreeCook.ui`）は無変更で通る**。
6. filter 変更で physical-drag session が終了する。
7. step / round / `resetToken` / `makingStepToken` で filter が `all` に戻る。
8. `filterByShelf` の結果は常に owned の部分集合、LOCKED を含まない（property）。
9. a11y: group ＋ `aria-pressed`、固有 label、キーボード操作、`MakingStepTabs` の tablist と共存、hint sheet 表示中は不活性。
10. 62 fixture で未分類 23 が shelf `null`、chip に出ず「すべて」でのみ表示（**推測分類しない**）。
11. scoring / 在庫 / Dex: filter 操作前後で reducer state が同一（`selectedIngredientId` を除く）。

**layout / e2e（Chromium ＋ WebKit）**
12. FREE TOPPING（22 所持）で 390×844 / 360×800 / 390×664 / 360×640 の chip 行実高、stage 径、**LC-S1..S4 と STAGE_FLOOR**、page 横 overflow 0、pager と CTA の gap（L-B / L-K）。
13. filter 切替中も dock 高さ・stage 径が不変（LC-S1）。

## 17. Implementation plan（Owner 決定後。**今は実装しない**）

1. **前提（docs）**: OD-B1〜B5 の結論を ledger に固定。
2. `src/logic/builderShelfChips.ts`（pure）: gate、`visibleItems(candidates, filter)`。tray と dock 予約が共用。unit test。
3. `prepareDock.ts`: `chipRow` 予約（結論の方式に応じた高さ）。`GameScreen.tsx`: `shelfChips = state.freeCook && state.dinner === null` を tray と dock 予約へ。
4. `IngredientTray.tsx`: local filter state、reset 点、`changeFilter`（page 0 / drag session / 選択契約）、`ShelfChips` の dock variant を描画。
5. `App.css`: dock 用 chip variant（高さは Owner 決定後）。`STAGE_FLOOR` は **Owner 決定なしに変更しない**。
6. Human Verification（`docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`、CLAUDE.md 必須）: 390×844 動画（repo に commit しない）＋ before / after スクショ（`docs/reports/screenshots/ingredient-category-tabs-builder/`）。
7. Result Report。**Phase 4 Ingredients / #272 / Inventory には触れない**。

## 18. Owner Decisions required（OWNER DECISION REQUIRED）

| ID | 論点 | 選択肢 | 推奨 |
|---|---|---|---|
| **OD-B1** | **#197 と OD-CT-5 の衝突**（§7） | D1 保持のまま／**D2 filter でも #197 と同じく clear（OD-CT-5 を「domain state 不変」に読み替え）**／D3 保持＋常時可視の新 UI／D4・D5 | **D2**（D3 は「選択を失わせたくない」場合） |
| **OD-B2** | **#272 LC-OD-1（手元＋食材庫、tray 内 family 行は不採用）と OD-CT-1 の関係**（§9） | (a) **Builder tray chip は作らず、family 絞りは LC-2/3 の食材庫 sheet に一本化**（OD-CT-1 を LC-3 に移管）／(b) 暫定で tray chip を出し、LC-2 で置換（捨てる前提）／(c) 手元（≤12）の上に chip（LC-2 と統合設計） | **(a)**。tray 内の追加行は Layout Contract の stage floor を割る（§11）うえ、承認済み LC-OD-1 の案 B と同型 |
| **OD-B3** | **stage floor**（§11） | tray に行を足すなら、(a) `STAGE_FLOOR`（FREE 262/238/182/158）を下げる／(b) chip と pager を 1 行に統合（棚バー）／(c) chip を tray に置かない（OD-B2 (a)） | OD-B2 が (a) なら不要。(b) は再設計で別 Gate |
| **OD-B4** | **Dinner を対象に含めるか**（F-1）。OD-CT-1 は「FREE のみ」 | 含めない（`dinner === null` を gate、**推奨**）／含める（制限時間中の操作が増える。LC-OD-1b は Dinner も対象） | 含めない |
| **OD-B5** | Hint 5.0 で「family の所持が 1 件のみ」のとき chip で 1 件に絞れることの許容 | 許容（自己情報のみ）／Hint 5.0 の privacy 契約を再確認してから | 実装前に契約を読み直す（前提テスト化） |

低リスクの既定値（Owner 認識用）: chip の 44px 維持可否（F-1 と同様）、`other` chip の文言は OD-CT-3 のまま、62 は HCG まで chip 付き tray を出荷しない。

## 19. FINAL VERDICT

**B. OWNER DECISION REQUIRED**

- 技術的 blocker は無い（gate・shelf authority・selection 保持はすべて実装可能）。
- ただし **(1) #197 の selection contract と OD-CT-5 が Builder で正面衝突**（OD-B1）、**(2) Owner 承認済みの LC-OD-1 が tray 内 family 行を不採用としており OD-CT-1 と両立しない**（OD-B2）、**(3) 追加行は現行の stage floor（S / E 全 profile）を割る算出結果**（OD-B3）。この 3 点は私が決めてはいけない領域のため、実装は開始しない。
- 補足: Builder の gate を `tray.freeCook` にすると Dinner に漏れる（F-1）。実装するなら別 prop。62 catalog は未分類 23 件のため HCG まで chip 付き tray は成立しない。
