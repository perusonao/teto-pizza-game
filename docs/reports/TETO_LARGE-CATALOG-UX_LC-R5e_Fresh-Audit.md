# Large Catalog UX — LC-R5-e Fresh Audit（Activation Readiness Review）

Docs / measurement tooling only. **production code 変更なし・PR なし・`HAND_ENFORCEMENT_ENABLED` は `false` のまま・capacity 9 / 12 は決めない・R6 には進まない。**

R5-e は新機能ではなく、R6 で初めて hand enforcement / production pin UI / capacity feedback / real-device Human Feel / 9 vs 12 決定へ進む前の、R5-a〜R5-d foundation 全体の最終防御監査である。current code を authority とし、過去レポートと食い違う箇所は **Finding** として根拠（file:line）付きで記す。

---

## 1. Audited main SHA

| 項目 | 値 |
|---|---|
| audited main | **`eb6c32d719b5db14c1551d64507cc8dfd94557a7`**（fresh fetch 済み。known main と一致、main は進んでいない） |
| branch | `claude/lc-r5-e-fresh-audit-ay8yrj`（docs / tooling のみ） |
| post-merge CI（GitHub Actions、本監査で再確認） | Deploy to GitHub Pages **#226 success** / E2E WebKit **#365 success**（いずれも `eb6c32d`） |
| flag | `src/logic/catalog/handPolicy.ts:14` `HAND_ENFORCEMENT_ENABLED = false` |
| capacity | `handPolicy.ts:32` `DEFAULT_HAND_CAPACITY_CANDIDATE = 12`（design candidate。9 vs 12 未決） |
| baseline test（本監査で実行） | `src/logic/catalog/**` + `App.handTray` + `App.handTray.off` + `App.handPins` + `IngredientPantry.pins` + `App.freeCookTrayPaging`: **191 passed / 0 failed** |
| mutation baseline（本監査で再実行） | `mutation-check.mjs` M1〜M114（118 mutants）: **117 KILLED / 1 NOT_APPLICABLE（M10b、stale）/ 0 SURVIVED**（§12.1） |
| 追加 tooling（CI 外） | `tools/large-catalog-ux/r5e-activation-mutants.mjs`（activation-boundary 候補 mutant E1〜E11、§12） |

---

## 2. Architecture state（current code から再読）

| 要素 | current code の事実（根拠） | activation への意味 |
|---|---|---|
| Ingredient Shelf authority | `ingredientShelf` = membership、`catalogSource.runtimeCatalog()` が `shelf` を copy、`catalogQuery` = owned / shelf / search engine、`ShelfChips` = presentation | 変更なし。hand は shelf を読まない（M25） |
| `pantryAvailability` | `isPantryWorthwhile` = round の step category のいずれかで OWNED > 6（ownership fact のみ）。`resolveUtilityRow = pager ∨ (eligible ∧ worthwhile)` | flag ON で pager が減っても entry / utility row は消えない（OD-R5-10）。**flag と無関係** |
| `IngredientPantry` | active category の OWNED 行のみ。`handEditing` false ⇒ read-only `<li>`、true ⇒ `<button aria-pressed>` + 📌 + 「ざいこなし」 + 「選択中」strip + 「おまかせに戻す」（`IngredientPantry.tsx:258-348`） | flag ON で**そのまま露出**（§3） |
| `pinEdit` | Model D 直接編集。OWNED ∧ category、新規 zero-stock 拒否、既存 pin は常に解除可、read 時 prune、`fits` による Model C 拒否 `rejected-capacity`（`pinEdit.ts:33-54`） | outcome は pantry で**捨てられる**（`.session` のみ使用、`IngredientPantry.tsx:276,289,338`）→ Finding F-3 |
| `HandSession` | App-level `useState`、session-only、round / step / HOME / FREE restart / Dinner で reset しない、reload で空（`App.tsx:233-237`）。save / storage に書く箇所なし（grep + M97） | lifecycle は R5-c のまま |
| `workingSet` | `placed > pinned > hint > favorite > recent > new > fill`。owned ≤ capacity で inactive（today's tray）。placed は capacity 超でも保持（OD-R5d-2）。`overflowIds` は production 未使用 | Model C 下で overflow は到達不能（§5.3） |
| `handSession.resolveHand` | eligible 以外 `null`。**hint = `NO_DISCLOSED_HINTS` 固定**（`handSession.ts:100`）。favorites / recent は production で常に空 | activation 時の実効 source = **placed / pinned / new / fill の 4 つのみ** |
| `handTray` | `resolveTrayHandIds` 第 1 文が flag guard（`handTray.ts:38`）。active hand のみ catalog 順 id、それ以外 `null`。`handTrayTransition` = 実変更 ⇒ page 0、選択は新 page 0 にある時のみ保持。`pinFitsHand` = Model C | flag ON で初めて non-null になる唯一の経路 |
| `App` | `trayHandInput`（`App.tsx:346-365`、stock = round 開始時 `remainingStock`、placed = sauce + topping id）、render-phase の `trayHandTrack`（key = `roundKey|activeCategory`）で #197 を評価（`App.tsx:366-377`） | §6 |
| `GameScreen` | `pantryAvailable = eligible ∧ PREPARE ∧ step≠DOUGH ∧ pantryWorthwhile`（`GameScreen.tsx:342`）、`handEditing={HAND_ENFORCEMENT_ENABLED}`（`:893`）、`handIds={trayHand?.ids ?? null}`（`:830`） | pin UI の露出条件は **hand の active/inactive と無関係**（F-1） |
| `IngredientTray` / paging | `handIds` 非 null で list 差し替え（`IngredientTray.tsx:160`）、handKey 変化で render-phase `setPage(0)`（`:176-181`）、`goToPage` の #197 は既存のまま（`:356-372`） | §6 |
| inventory | `remainingStock` は inventory のみ（placement で減らない）。消費は `CONFIRM_BAKE` の `consumePizzaInventory`（`state/inventory.ts:136`） | hand の stock 入力は round 内で不変 |
| `selectedIngredientId` | App `useState`。round key / step 変化で reset、`handleTapPizza` は membership を再確認しない（`App.tsx:766-775`） | hidden selection の防御は「clear 規則」のみ（§6.4） |

### 2.1 Data fact（current `src/data/ingredients.ts`）

| category | 全 ingredient 数 | capacity 12 で active になる owned 数 | capacity 9 で active になる owned 数 |
|---|---:|---:|---:|
| sauce | 3 | **到達不能** | **到達不能** |
| cheese | 4 | **到達不能** | **到達不能** |
| topping | 22 | ≥ 13 | ≥ 10 |

→ **Finding F-0**: current catalog では hand enforcement が tray を変えるのは **TOPPING step だけ**。SAUCE / CHEESE step では flag ON でも `resolveTrayHandIds` は常に `null`（inactive）。

### 2.2 Owner Authority との差異

| # | Owner Authority / 過去文書 | current code | 判定 |
|---|---|---|---|
| D-1 | EP3 Stock Gate: 在庫 0 の owned ingredient は tray に「×0 disabled で残り、never hidden」（`IngredientTray.tsx:65-66` の doc comment） | hand active 時、pin / placed でない在庫 0 topping は tray から消える（`workingSet.ts:84-90`、LC-OD-17） | **LC-OD-17（Owner 決定済み）が hand mode で上書き**。矛盾ではないが tray の doc comment は R6 で更新要。pantry には残る（×0、新規 pin 不可）。R6 HV 観察項目 |
| D-2 | OD-R5d-3「accepted pin is always visible」 | Model C は **hand active 時のみ**意味を持つ。inactive（sauce / cheese / topping ≤ capacity）では `pinFitsHand` が常に true（`handTray.ts:60`）、pin は受理されるが tray に効果なし | Finding F-1（§4.2） |
| D-3 | OD-R5-7「strip に数字を出さない」 | 現 strip は数字なし（M96） | R6 の capacity-full feedback copy と衝突しうる → OD-R5e-3 |
| D-4 | R5-d Result「14 snapshots / 131 KB main vs branch byte-identical DOM」 | repo 内に snapshot artifact / committed test としては存在しない（PR #314 comment も 0 件）。committed な OFF 証跡は `IngredientPantry.pins.test.tsx:56`（pantry DOM byte 同一）と `App.handTray.off.test.tsx`（4 page tray） | Owner 提示の authority として記録。R6 で **committed gate 化**を提案（§10） |

---

## 3. Activation diff inventory（`HAND_ENFORCEMENT_ENABLED = true` にした瞬間）

flag を読む production site は 3 つだけ: `handPolicy.handCapacityFor`（`:22`）、`handTray.resolveTrayHandIds`（`:38`）、`GameScreen` の `handEditing`（`:893`）。

| # | 面 | 露出条件 | 変化 | 状態 |
|---|---|---|---|---|
| A1 | pantry pin controls | pantryAvailable（FREE ∧ PREPARE ∧ SAUCE/CHEESE/TOPPING ∧ いずれかの category で owned > 6） | tile = toggle button、`aria-pressed`、📌 badge、非 pin の在庫 0 tile に「ざいこなし」 + `aria-disabled` | 実装済み・dormant |
| A2 | selected strip（方式 D） | pin ≥ 1 | 「📌 選択中」+ per-pin 「〇〇を外す」 + 「おまかせに戻す」。keyboard fit（`pantry-sheet--fit`）中は CSS で hide（`App.css:6511`） | 実装済み |
| A3 | **inactive category の pin UI** | SAUCE / CHEESE step（常に）、topping owned ≤ capacity | pin できるが tray は一切変わらない（no-op pin） | **Finding F-1** |
| A4 | working hand | TOPPING ∧ owned topping > capacity | tray = capacity 件、catalog 順 | 実装済み |
| A5 | tray membership | 同上 | placed → pinned → new（直近購入、starter 除外）→ fill（catalog 順・在庫あり）。在庫 0 の非 pin topping は tray から消える（D-1） | 実装済み |
| A6 | tray paging | 同上 | 12 → 2 page（6+6）、9 → 2 page（6+3）。pager label は「1 / 2」（今日 22 owned なら「1 / 4」）。stage / dock geometry は不変（§8） | 実装済み |
| A7 | #197 transitions | pin / unpin / おまかせに戻す が membership を変えた時 | page 0 + 新 page 0 にない selection を clear。**pantry（modal）の下で起き、閉じた時に初めて見える** | 実装済み・F-4（HV） |
| A8 | capacity rejection path | hand が満杯で hand 外の tile を tap | **何も起きない**（`rejected-capacity` は捨てられ、視覚 / SR feedback なし） | **Finding F-3 = activation blocker** |
| A9 | reset-to-auto | 「おまかせに戻す」 | active category の pin 全消去 → hand 再計算 → 変化があれば page 0 / #197 | 実装済み。確認 UI なし（1 tap で全消去、undo なし） |
| A10 | debug 表示 | — | pantry / tray / handTray / pinEdit に debug / TODO / count 表示なし（grep） | OK |
| A11 | Dinner / guided / Lunch Rush | — | 変化なし（FREE gate、pantry 非表示） | OK（§7） |

**未完成 UI の露出**: flag を単に true にすると A3（no-op pin）と A8（silent rejection）がそのまま production に出る。debug 表示の露出はない。

---

## 4. Privacy audit

### 4.1 import / 入力境界（current code）

- `src/logic/catalog/*.ts`（非 test）の外部 import は `data/ingredients`・`data/ingredientShelf`・`data/ingredientSearchAliases`・`state/roundKind`・`state/discoveryHint`（**type-only**、`hintDisclosure.ts:14`）のみ。recipes / matcher / discovery / Hint 5.0 表 / Original Pizza Recovery / techniques / Dinner target を import しない（boundary test + M1 / M2 / M7 / M16 / M17 / M58c / M59）。
- `handTray` の入力は round gate・category・catalog descriptor・ownership（owned ids + stock）・pins・placed・starter ids・capacity のみ（`handTray.ts:22-33`）。recipe / target / matcher distance / candidate count は型にも存在しない。
- pantry は `queryCatalog` の OWNED 行のみ。LOCKED / 未購入に行・名前・シルエット・`???` なし（M13 / M34）。数字は stock の `×N` のみ（件数・候補数なし、M48 / M96）。

### 4.2 hand auto-fill source 別

| source | production での入力 | player-authorized か |
|---|---|---|
| placed | 今 pizza に置いた sauce / topping id | ✅ 自分の操作 |
| pinned | pantry での自分の pin | ✅ |
| hint | **常に空**（`NO_DISCLOSED_HINTS`、`handSession.ts:100`）。`disclosedHintsFromSheetView` は production caller 0 | ✅（未配線）。未購入 Hint fact 参照なし（M110） |
| favorite | 常に空（writer なし） | ✅ |
| recent | 常に空（writer なし） | ✅ |
| new | `ownedIngredientIds` の新しい順（starter 除外、cap 20） | ✅ ownership は inventory / pantry で既に公開。現行 ownership は Shop 購入のみ（`materialEntitlement.ts` が EP4 grant を置換）。legacy save の EP4 grant 順序は recipe unlock（dex 由来）に従うが、所持集合自体は既に可視 → 新情報なし（P-1、非 blocking） |
| fill | OWNED ∧ 在庫あり、catalog 順 | ✅ |

### 4.3 項目別判定

| 項目 | 判定 |
|---|---|
| undiscovered recipe requirement / name / id | 推論・表示なし（hand に recipe 入力なし） |
| hidden matcher target / distance | なし（matcher import なし、M2） |
| unpurchased Hint 5.0 fact | なし（hint tier 空、M110 / M3 / M17） |
| Original Pizza Recovery internal target | なし（import なし、入力なし） |
| candidate recipe count | なし（数字 UI なし） |
| hidden Technique answer | なし（techniques import なし） |
| capacity-full / rejection feedback（R6 新規） | 現在 UI なし。R6 で追加する copy は「材料の件数 / 手元の空き」以外を語らないこと（recipe / hint 由来の理由を出さない）を R6-a の gate にする |

**Privacy verdict: PASS**（activation で新たに露出する情報は player の ownership / stock / 自分の pin / 自分の placement のみ）。
R6 注意: hint tier を配線する場合は別 Fresh Audit（Hint 5.0 ladder view 対応、`hintDisclosure.ts:11` の未監査注記）必須。R6 scope に含めない。

---

## 5. Pin / Capacity audit（OD-R5d-2 / OD-R5d-3、capacity 9 と 12 の両方）

### 5.1 規則の検証（pure + App、current tests）

| 規則 | 9 | 12 | 根拠 |
|---|---|---|---|
| placed protection（capacity 超でも保持） | ✅ | ✅ | `handTray.test.ts:116,125`（9×12 parametrize）、App `:252`（12 のみ）、M106 |
| accepted pin always visible | ✅ | ✅ | property test 300 ops（`handTray.test.ts:160`）、App fuzz（12 のみ）、M107 |
| overflow pin rejected | ✅ | ✅ | `handTray.test.ts:134`、App `:238`（12 のみ） |
| unpin always possible | ✅ | ✅ | `pinEdit.ts:43-45`（fits を見ない）、M85 / M88 |
| existing zero-stock pin removable | ✅ | ✅ | `IngredientPantry.pins.test.tsx:94`、M88 |
| new zero-stock pin rejected | ✅ | ✅ | M83、`handTray.test.ts:183` |
| invalid / stale pin sanitation | ✅ | ✅ | read 時 prune（`pinsInCategory`）+ write 時 re-filter + `selectWorkingSet` の `inCategory`（M87） |

**Gap G-1**: App-level（real App / reducer / tray / pantry）は capacity **12 のみ**。App 経路で 9（6+3 page、page 2 が 1 行）の検証がない。

### 5.2 Finding F-1（inactive category の pin UI = no-op pin）

`handEditing` は flag だけで決まり、hand の active 状態を見ない。pantry は「round のいずれかの category で owned > 6」で出るため、**SAUCE（3 種）/ CHEESE（4 種）step でも pin UI が出る**が、これらの hand は構造上 active にならない（§2.1）。topping でも owned ≤ capacity なら同様。pin は受理され strip に出るが、tray は何も変わらない。
- 12 の場合: topping 7〜12 owned の player は pantry を開けるが pin が無効。
- 9 の場合: topping 7〜9 owned で同様（無効域が狭い）。
- 副作用: inactive 時に pin を capacity 件まで積むと、後で topping を買って hand が active になった瞬間 `new` / `fill` の枠が 0 になり、**新しく買った topping が tray に出ない**（pantry からは届く）。

→ **OD-R5e-1**（§18）。推奨: 「pin UI は active category の hand が active の時だけ」（mutant E11 で現 test が current spec を固定しているかを確認、§12）。

### 5.3 Overflow の到達可能性

Model C（pin 時に fit を検査）+ tray-only placement（placed ⊆ 現 hand）+ 同一 round 内で ownership / stock / capacity 不変（PREPARE 中は Shop / Dex に入れない: `GameScreen.tsx:967,976` は RESULT overlay 内のみ）+ topping の取り外し / undo なし（`RESET_PIZZA` は DOUGH へ戻り key 変化）⇒ `overflowIds` は production で到達不能。inactive 中の pin は ≤ owned ≤ capacity なので active 化しても溢れない。

### 5.4 R6 で必要な production feedback（R5-e では実装しない）

| 状況 | 現状 | R6 で必要 |
|---|---|---|
| capacity full（`rejected-capacity`） | 無反応 | 視覚 feedback + SR announce（**activation blocker**） |
| placed item を pin | 受理・slot 消費なし・見た目差なし | 「配置ずみ」表示の要否（R5-d carry、非 blocking） |
| inventory 0（新規 pin 不可） | 「ざいこなし」+ `aria-disabled` | 文言 HV のみ |
| inventory 0 の既存 pin | tray に ×0 disabled で残る | 文言 / HV |
| reset to auto | 1 tap で全消去、確認なし | HV 観察（誤 tap 率）。確認 dialog は追加しない方向を推奨 |
| inactive category の pin | no-op | OD-R5e-1 |
| pin 編集後の page 0 / selection clear | pantry の下で発生 | HV 観察（F-4）。toast 等は OD 次第 |

---

## 6. #197 Final Audit（activation 時の実コード経路）

### 6.1 経路

pantry tile tap → `togglePin(..., pinFits)` → `onHandSessionChange`（App `setHandSession`）→ 次 render で `resolveTrayHandIds` → `trayHandTrack` と比較（`App.tsx:369-377`）→ 同一 key で ids が変われば `handTrayTransition` → `setSelectedIngredientId`（render-phase）；同 render で tray が handKey 変化を見て `setPage(0)`（`IngredientTray.tsx:176-181`）。

| ケース | 期待 | current code | test |
|---|---|---|---|
| actual membership change → page 0 | ✅ | `handTrayTransition.changed` + tray render reset | pure `:74`、App `:148`、M100 |
| selected が新 page 0 に存在 → retain | ✅ | `trayPageIds(after, 0).includes` | pure `:84`、App `:173`、M99 / M105 |
| 不存在 → clear | ✅ | 同上 | App `:148`、fuzz I1 |
| priority-only reorder → hand change ではない | ✅ | catalog 順正規化 + `sameIds` | pure `:58`、App `:190`、M98 / M109 |
| placement → 変化なし | ✅ | placed ⊆ hand、catalog 順 | App `:207` |
| 別 category → 不要な reset なし | ✅ | pins は category 別、key = `roundKey|activeCategory`、step 変化は既存 reset が担当 | pure `:110`、E2（§12） |
| hidden selected ingredient → placement 不能 | ✅（clear 規則による） | `handleTapPizza` は membership 再確認なし | App fuzz I1（36 ops） |
| pantry open / search / shelf / close | 何も clear しない | pantry は selection を持たない | App `:222`、M104 |

### 6.2 pin → undo（現仕様の記録、変更しない）

pin で hand が変わり selection が clear された後、同じ tile を再 tap（unpin）して hand が元に戻っても、**selection は自動復元されない**（per-edit 評価、`handTrayTransition` は履歴を持たない）。R5-d carry のとおり **R6 Human Feel 観察項目**として記録（HV-11）。R5-e では変更しない。

### 6.3 Latent edge（現在到達不能）

- **null → active の同一 key 遷移**: 同じ step 中に hand が inactive → active になると、App は track を新規作成するだけで transition を評価せず（`App.tsx:371-376`）、tray も `prevHandKey === null` で page を戻さない（`IngredientTray.tsx:180`）。発生には PREPARE 中の ownership 増加が必要だが、PREPARE 中は Shop / Dex に入れない（§5.3）ため **到達不能**。将来 in-round 購入を入れる場合の hardening 項目（H-5）。
- **active → null**: 同様に到達不能。起きても list は superset になるだけ。

### 6.4 防御の深さ

`handleTapPizza` / `handlePhysicalDrop` は選択が可視 page にあるかを再確認しない。現在は clear 規則（hand transition + `goToPage`）と「tray からしか選べない」ことで保証。**非 blocking**。R6-a で「placement 時に selected ∈ 現 tray list を assert する invariant test」の追加を推奨（H-4）。

---

## 7. Inventory / Round lifecycle audit

| シナリオ | current code | 判定 / test |
|---|---|---|
| stock 1 → 0 | 消費は `CONFIRM_BAKE`。round 内の hand stock 入力は round 開始値（`App.tsx:355-358`）→ round 内で hand 不変 | ✅ pure `:194`。**App-level の active hand + 次 round で在庫 0 topping が tray から消える検証なし（G-2）** |
| existing zero-stock pin | hand に残る（slot 消費）、tray に ×0 disabled | ✅ pure `:183`、E7 |
| next FREE round | 新 roundKey → selection null、track 再作成（transition なし）、pins 維持 | ✅ `App.handPins.test.tsx:150`（R5-c、hand 非 active） |
| round end（BAKE 以降） | `trayCategory = null` → `trayHandIds = null`（PREPARE 限定） | ✅ E4 |
| HOME | pins 維持、pantry は unmount | ✅ `App.handPins.test.tsx:150,204` |
| FREE restart | 同上 | ✅ |
| Dinner round-trip | Dinner 中は pantry なし・hand null・22 topping paged tray。戻ると pins 維持 | ✅ `App.handPins.test.tsx:204`、`App.handTray.test.tsx:350` |
| reload | pins 空（useState）。save に書かない | ✅ `App.handPins.test.tsx:150`、M97 |
| save schema | `persistence.ts` / GameState に hand / pin なし（grep） | ✅ |
| guided / Lunch Rush への漏れ | `isLargeCatalogEligible` + pantry gate | ✅ pure `:207`（App-level は Dinner のみ → G-3） |

---

## 8. Mobile geometry audit

### 8.1 Tray（`HAND-CAPACITY-COMPARISON.json`、Chromium emulation）

| viewport | dough ⌀（9 / 12 / 今日 22） | dock | page 2 chips（9 / 12） | scroll |
|---|---|---:|---|---|
| 390×844 | 290 / 290 / 290 | 174 | 3 / 6 | なし |
| 360×800 | 273.6 / 273.6 / 273.6 | 174 | 3 / 6 | なし |
| 390×664 | 269.1 / 269.1 / 269.1 | 162 | 3 / 6 | なし |
| 360×640 | 245.1 / 245.1 / 245.1 | 162 | 3 / 6 | なし |

→ **9 と 12 で stage / dock geometry は完全に同一**（dock は per-round 予約、どちらも 2 page）。9 vs 12 の差は geometry ではなく「hand の幅（findability）」と page 2 の密度（1 行 vs 2 行）だけ。「tray の圧迫感」「pizza stage visibility」を数値で区別する指標は存在しない → 主観 HV で扱う。

### 8.2 Pantry（`LC-R5c_GEOMETRY.json`、K = 300 / 338 / 380 simulated）

| viewport | normal list（strip なし / 44px strip） | K=338 list（strip なし / あり） | K=380 |
|---|---|---|---|
| 390×844 | 617px 7 行 / 565px 7 行 | 291 3 行 / 239 3 行 | 249 3 行 |
| 360×800 | 573 7 / 521 6 | 247 3 / 195 2 | 205 2 |
| 390×664 | 437 5 / 385 4 | 111 1 / **59 0** | **69 0** |
| 360×640 | 413 5 / 361 4 | **87 1**（15.8px spare）/ **35 0** | **45 0** |

- Owner Authority（OD-R5c-2/3）: normal = strip、keyboard = strip auto-hide、tile badge / `aria-pressed` 残す。current code は `pantry-sheet--fit` で strip を CSS hide（M95）→ **authority と一致**。
- **Finding F-5（pre-existing、R5-b 由来）**: K=380（予測変換バー付き等の大きい keyboard）では 390×664 / 360×640 で strip なしでも list 0 行。strip とは無関係だが、keyboard-open pantry の実機 HV で必ず確認（HV-8）。
- 数値はすべて simulated。実機での keyboard 高さは R5-b real-iPhone HV（PASS、Preview `7bf1486`）で確認済みの範囲のみ。

---

## 9. Accessibility audit（R6 activation 時）

| 項目 | current（flag ON 時） | 分類 |
|---|---|---|
| 44px targets | tile toggle / strip pin / おまかせに戻す / close / search = `min-height: 44px`（`App.css:6469,6536,6548`）、tray chip 64px 高 | OK |
| `aria-pressed` | tile toggle にあり | OK |
| pin / unpin accessible name | tile: 内容テキスト（glyph + 名前 + `×N` + 「ざいこなし」）、状態は `aria-pressed`。strip: 「〇〇を外す」 | 非 blocking polish（tile 名に stock が混ざる。「ピン」語彙なし）→ P-2 |
| inventory 0 disabled semantics | `aria-disabled`（focus 可能、読み上げ可）+ 可視「ざいこなし」 | OK |
| rejected-capacity feedback | **なし**（視覚・SR とも） | **Blocker**（F-3） |
| keyboard navigation | tile / strip は button、list は `tabIndex=0` region | OK |
| Escape | sheet で close（M38） | OK |
| focus return | close → 食材庫 entry（M35） | OK |
| search IME | composition 中は list 不変、`compositionend` 適用、229 Enter（M68〜M72） | OK（R5-b 実機 PASS） |
| SR announcement 候補 | tray には `aria-live="polite"`（`IngredientTray.tsx:638`）があるが pin / unpin / reject / reset / hand 変化は announce されない | R6-a: pin 結果（「〇〇を手元に追加」「手元がいっぱい」）の polite announce を推奨。hand 変化による selection clear の announce 要否は HV |
| tile tap during keyboard（OD-R5c-5） | 未決 | R6 実機 HV で決定 |

---

## 10. OFF equivalence status

### 10.1 Authority

- Owner / PR #314 review authority: **14 snapshots / 131 KB、main vs branch byte-identical DOM**（R5-d）。repo 内に artifact は無い（D-4）。
- committed evidence: `IngredientPantry.pins.test.tsx:56`（pantry DOM byte 同一、pins の有無に依らない）、`App.handTray.off.test.tsx:84`（FREE 22 topping = 4 page catalog 順、#197 既存、pin UI なし）、`handTray.off.test.ts`（shipped flag false、全 round / capacity で `null`、pin 拒否なし）、M28 / M84 / M89 / M90 / M91 / M101。
- 本監査時点で main は `eb6c32d` のまま → OFF = R5-d production behavior を維持。

### 10.2 activation-boundary regression gate（R6 前に固定する設計）

問題: flag は module 定数。ON 側 App test は `vi.mock` で **`HAND_ENFORCEMENT_ENABLED` と `handCapacityFor` の両方を差し替えている**（`App.handTray.test.tsx:17-21`）。つまり real `handCapacityFor` と flag の結合は **ON 状態で一度も実行されていない**（E1、§12）。また flip した瞬間に OFF test（`handTray.off.test.ts:10` "the shipped flag is false" 等）は赤になる。

提案（R6-a、test-only）:
1. **committed DOM snapshot gate**: 固定 seed（FREE 22 topping / FREE ≤ 12 topping / FREE 6 topping / Dinner / guided / Lunch Rush）× step（SAUCE / CHEESE / TOPPING page 1・2）× pantry 開閉の DOM を normalize して golden 化（R5-d の 14 snapshots を repo に移植）。
2. **ON-but-inactive ≡ OFF**: flag ON で hand が inactive な round（topping ≤ capacity、sauce / cheese、Dinner / guided / Lunch Rush）の **tray DOM が OFF golden と byte 同一**であることを assert。差分は pantry の pin UI のみ（OD-R5e-1 次第で 0）。
3. **ON-active の期待差分のみ**: FREE 22 topping の tray は `capacity` 件 catalog 順・2 page、それ以外（stage / dock / header / CTA）は OFF golden と同一。
4. flag の seam: 定数の直接 mock をやめ、`handPolicy` に test 専用 override（例: `withHandEnforcement(true, fn)` か、flag を読む関数 1 つに集約して `vi.mock` はその 1 関数のみ）を作り、**`handCapacityFor` を mock しない**。※ production code 変更を伴うため R6-a の範囲（R5-e では実装しない）。
5. flip 後も OFF 側を残す: 「shipped flag is false」test は「non-eligible / inactive は flag に依らず `null`」へ置換（削除しない）。

---

## 11. Test coverage inventory

| 層 | file | 件数（本監査実行分） | 主な対象 |
|---|---|---|---|
| pure | `logic/catalog/*.test.ts`（15 files） | 191 件（本表の App / component 分を含む合計） | working set / hand / pin / tray transition / eligibility / query / shelf / search / boundary |
| component | `IngredientPantry.pins/search/shelves`、`IngredientTray.*`、`pantrySearchIme`、`pantryViewportFit` | — | pin UI、方式 D、IME、fit |
| App（flag forced on） | `App.handTray.test.tsx`（10）、`App.handPins.test.tsx`（3） | — | #197、Model C、placed、fuzz I1、lifecycle、Dinner |
| App（real flag） | `App.handTray.off.test.tsx`（1）、`App.freeCookTrayPaging` | — | OFF 等価 |
| e2e（Chromium、CI WebKit） | large-catalog-pin-dormant / pantry-search / pantry-shell / pantry-shelves / stage-size-stability 他 | R5-d: 56 pass | dormant DOM、geometry |
| mutation | `mutation-check.mjs` M1〜M114 | 117 / 118 killed、M10b stale（E12 で代替 kill） | privacy / dormancy / #197 / Model C / FREE gate |

Coverage gaps（activation 観点）:
- **G-1** App-level capacity 9 なし（12 固定）。
- **G-2** App-level active hand の round 跨ぎ（在庫 0 化、zero-stock pin の tray 表示、new tier）なし。
- **G-3** App-level guided / Lunch Rush + pins（Dinner のみ）。
- **G-4** capacity rejection の「無反応」を固定する test / feedback test なし（R6 で feedback と同時）。
- **G-5** pin → undo で selection 非復元の現仕様を固定する test なし。
- **G-6** ON-but-inactive ≡ OFF の tray DOM gate なし（§10.2-2）。
- **G-7** keyboard-open の strip 非表示は CSS 文字列 test（M95）+ simulated geometry のみ。forced-on e2e（R5-d carry G-c）なし。
- **G-8（= F-6、最重要）** App が #197 の clear を実行しなくても全 test が通る（E6 SURVIVED）。既存 assertion は可視 chip（`.ingredient-chip--selected`）のみで、非可視 selection の残存を観測しない。

---

## 12. Mutation gaps

### 12.1 既存 M1〜M114 の再実行（current main）

実行: `node tools/large-catalog-ux/mutation-check.mjs`（`eb6c32d` の clean worktree、source は各 run 後に復元）。

| 結果 | 件数 | 内容 |
|---|---:|---|
| KILLED | 117 | M1〜M114 の全 privacy / dormancy / eligibility / shelf / search / IME / fit / pin / #197 / Model C mutant |
| NOT_APPLICABLE | 1 | **M10b**「capacity off-by-one（item count）」: edit 文字列 `if (items.length < capacity) items.push` が R5-d の書き換え（`if (source === "placed" \|\| items.length < capacity) items.push`、`workingSet.ts:105`）で消え、**R5-d 以降この mutant は実行されていなかった**（Finding F-7） |
| SURVIVED | 0 | — |

F-7 の確認: 同等の mutant を現行の行に当てた **E12（`items.length <= capacity`）は KILLED**（§12.2）。つまり test は有効で、壊れていたのは mutant 定義だけ。R5-e-h で `mutation-check.mjs` の M10b を現行の行に更新し、runner が NOT_APPLICABLE を失敗扱いにしている（exit 1）ことを CI 外手順として明記する（H-8）。

### 12.2 activation-boundary 候補 mutant（`tools/large-catalog-ux/r5e-activation-mutants.mjs`）

実行: `node tools/large-catalog-ux/r5e-activation-mutants.mjs`（current main、suite = catalog + pantry / tray / App hand tests）。**9 / 12 killed**（E12 は baseline 後に追加）。

| id | mutant | 結果 | 判定 |
|---|---|---|---|
| E1 | `handCapacityFor` 内の flag 反転 | KILLED | pure `hand.test` が捕捉（ただし App ON test は `handCapacityFor` を mock しているので App 層では見えない → AB-3） |
| E2 | round / step key 変化を hand 変化として評価 | SURVIVED | **現データでは等価**: track が存在するのは active hand（topping のみ）の時だけで、TOPPING は最後の step。key 変化 = 新 round で selection は既存 reset が null にする。sauce / cheese が capacity を超える catalog になれば非等価 → H-3 |
| E3 | inactive hand でも tray を hand mode に | KILLED | — |
| E4 | PREPARE 以外でも tray hand を計算 | SURVIVED | **観測上等価**: BAKE 以降 tray は描画されず、placed / pins も変わらないので transition は起きない（無駄な計算のみ）。非 blocking |
| E5 | candidate 12 → 9 | KILLED | App test は 12 を固定している（G-1: 9 の App 経路は未検証、R6-d 後に parametrize 要） |
| **E6** | **App が transition の selection clear を捨てる（#197 無効化）** | **SURVIVED** | **真の test gap（Finding F-6）**。scratch probe（未 commit）で E6 適用時、page 2 で選択 → hand 外 topping を pin → 閉じる → pizza tap で **piece が 1 個置かれる**（非可視 selection による配置 = #197 bug）ことを確認。既存 test は `.ingredient-chip--selected`（可視 chip）しか見ないため、選択が page 0 に無ければ clear の有無に関係なく `null` になる。fuzz I1 も seed 上この経路を踏まない。production code は正しいが、activation の安全契約の中核を守る test が無い |
| E7 | 既存の在庫 0 pin を hand から落とす | KILLED | — |
| E8 | `new` tier を古い順に | KILLED | — |
| E9 | #197 retain を hand 全体で判定 | KILLED | — |
| E10 | Model C fail-open | KILLED | — |
| E12 | item-count off-by-one（M10b の現行版） | KILLED | F-7 参照 |
| E11 | pin UI を active hand の時だけに（OD-R5e-1 の推奨案） | KILLED | current spec（inactive でも pin UI）を test が固定している。OD-R5e-1 で推奨案を採るなら test も意図的に更新する |

**F-6 の hardening（test-only）**: App-level で「hand 変化で page 0 に無い selection が clear された後、pizza tap が何も置かない」ことを明示的に assert する test（上記 probe を正式化）+ fuzz I1 に「page 2 選択 → hand 外 pin」の決定的シナリオを追加 → E6 を kill。

### 12.3 要求リストとの対応

| 観点 | 既存 mutant | 追加確認 |
|---|---|---|
| eligibility inversion | M26 / M27 / M29 / M33 / M58c / M103 | — |
| flag inversion | M28 / M84 / M89〜M91 / M101 | E1（`handCapacityFor` 内） |
| capacity off-by-one | M10 / M10b（**stale**、F-7） | E12 KILLED、E5（candidate 12→9） |
| placed priority | M106 / M112 | — |
| pin rejection | M83 / M107 | E10 |
| catalog-order normalization | M8 / M98 | — |
| #197 page reset | M100 / M113 / M114 | — |
| selection retention / clear | M31 / M99 / M105 | E9 KILLED、**E6 SURVIVED（F-6）** |
| category isolation | M86 / M47 | E2 SURVIVED（現データで等価、H-3） |
| inventory0 | M11 / M83 / M88 / M102 | E7 |
| keyboard selected-strip visibility | M95（CSS 文字列） | 実 geometry は e2e / HV のみ（G-7） |

---

## 13. Activation blockers

### 13.1 Hardening required before R6（test-only、production code 変更なし）

| # | 内容 | 根拠 | kill 対象 |
|---|---|---|---|
| **H-1** | App-level: hand 変化で page 0 に無い selection が clear された後、pizza tap が **何も置かない** ことを明示 assert（R5-e probe の正式化）。fuzz I1 に決定的シナリオ（page 2 選択 → hand 外 pin → 閉じる → tap）を追加 | F-6 / G-8 | **E6** |
| H-2 | App-level capacity 9 parametrize（`DEFAULT_HAND_CAPACITY_CANDIDATE` を 9 に差し替えた App 経路: 6+3 page、Model C、placed） | G-1 | E5（両候補で kill） |
| H-3 | pure: `handTrayTransition` は key 変化時に呼ばれないこと / App: step 変化で hand transition を評価しないことを、sauce / cheese が capacity 超の fixture catalog で固定 | E2 | E2 |
| H-4 | 選択 invariant: 「selected ≠ null ⇒ selected ∈ 現 tray page」を App test helper として全 hand test の各 step 後に assert | §6.4 | E6 / M99 / M105 |
| H-5 | null → active の同一 key 遷移（現在到達不能）を pure test で仕様化（将来 in-round 購入を入れる時の検出用） | §6.3 | — |
| H-6 | active hand の round 跨ぎ（stock 1→0 で tray から消える / zero-stock pin は ×0 で残る）、guided / Lunch Rush + pins の App test | G-2 / G-3 | — |
| H-7 | pin → undo で selection が戻らない現仕様を固定（R6 で変えるなら意図的に test を更新） | G-5 | — |

| H-8 | `mutation-check.mjs` の M10b を R5-d 後の行に更新（stale mutant、F-7） | F-7 | M10b |

H-1 は activation の安全契約（非可視 selection で置けない）を守る唯一の App 層 gate であり、R6 で flag を触る前に入れるべき。H-2〜H-7 は同じ test-only slice に同梱できる。

### 13.2 Activation blockers（production flag ON = R6-e の前に必須）

| # | blocker | 根拠 | 解消 slice |
|---|---|---|---|
| **AB-1** | capacity-full rejection が無反応（視覚・SR とも） | F-3、`IngredientPantry.tsx:338` | R6-a |
| **AB-2** | inactive category の no-op pin UI | F-1、`GameScreen.tsx:893` | OD-R5e-1 → R6-a |
| **AB-3** | ON 側 test が `handCapacityFor` を mock しており、real flag 結合が未検証 / OFF golden が repo に無い | §10.2、D-4、E1 | R6-a（test seam + golden） |
| **AB-4** | real-device Human Feel（9 vs 12、keyboard-open pantry、OD-R5c-5）未実施 | Policy、OD-R5d-3 | R6-b / R6-c |
| **AB-5** | capacity 未決定 | OD-R2-1 / OD-R5d-3 | R6-d（Owner） |
| **AB-6** | Preview で flag ON を出す手段がない（定数 = build 一括） | R5-d carry G-c | OD-R5e-4 → R6-a |

## 14. Non-blocking polish

- P-1 `new` tier の legacy EP4 grant 順序（§4.2）— 情報追加なし、記録のみ。
- P-2 tile accessible name に stock が混ざる / 「ピン」語彙なし。
- P-3 placed item への pin（「配置ずみ」表示）。
- P-4 `IngredientTray.tsx:65-66` の「never hidden」doc comment を hand mode（LC-OD-17）に合わせて更新（D-1）。
- P-5 「おまかせに戻す」は 1 tap 全消去（確認なし）— HV で誤 tap を観察。
- P-6 `overflowIds` は production 未使用・到達不能（§5.3）— dead field として残すか R6 で整理。
- P-7 pin 編集で起きた page 0 / selection clear が pantry の下で起き、閉じた後に気づく（F-4）— HV 次第で軽い cue。

## 15. R6 HV measurement plan

Policy（`docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`）に従い、390×844 video（ユーザーへ直接送付、repo に commit しない）+ before/after screenshot（`docs/reports/screenshots/<task-name>/`）を DoD とする。

### 15.1 数値化できる measurement（自動 / 半自動、Preview exact SHA）

| id | 指標 | 取り方 |
|---|---|---|
| M-1 | target 到達 tap 数（tray で目的 topping を選ぶまで: page 切替 + pantry 往復 + pin） | Playwright scripted task（固定 seed、10 targets）+ 実機 video の手数え |
| M-2 | page 切替回数 / pizza | tray の `goToPage` 回数（計測 build の console counter ではなく video 手数え、production code 不変） |
| M-3 | pin 操作回数 / pizza、rejected-capacity 発生回数 | 同上 |
| M-4 | 意図しない page reset 回数（pin 編集由来） | video |
| M-5 | selection loss 回数（hand 変化で clear → 再 tap） | video |
| M-6 | pantry 往復回数 / pizza | video |
| M-7 | dough ⌀ / dock 高 / game screen scroll 有無（4 viewport） | `hand-capacity.measure.spec.ts` 再実行（9 と 12 で同一のはず: 回帰検知） |
| M-8 | keyboard-open pantry の list 可視高 / 行数 | `r5c-geometry.measure.spec.ts` + 実機 screenshot（visualViewport 値を記録） |
| M-9 | 1 pizza の所要時間（PREPARE TOPPING step） | video timestamp |

### 15.2 主観 Human Feel（Owner 記入、5 段階 + 自由記述）

HV-1 欲しい材料の見つけやすさ / HV-2 page 切替の煩わしさ / HV-3 pin 操作の分かりやすさ / HV-4 tray の圧迫感 / HV-5 pizza stage の見え方 / HV-6 意図しない page reset の気になり度 / HV-7 selection loss の気になり度 / HV-8 keyboard-open pantry（360×640 相当端末があれば）/ HV-9 片手操作（親指到達: pager・食材庫 entry・strip）/ HV-10 capacity-full feedback の理解 / HV-11 pin → undo で selection が戻らないことの違和感 / HV-12 OD-R5c-5（keyboard 中の tile tap）/ HV-13 在庫 0 の非 pin topping が tray から消えること（D-1）。

## 16. 9 vs 12 comparison protocol

1. **同一条件**: 同じ Preview exact SHA、capacity だけが異なる 2 build（R6-a で入れる Preview-only 切替。production は flag false のまま）。同一 save seed（topping 22 owned、在庫は固定: 3 種 0、他 5）、同一 pins（0 件で開始 → 手順中に同じ 3 件を pin）、同一 recipe task list。
2. **task list（例: 5 pizza）**: (a) 手元 page 1 にある topping だけ、(b) page 2 の topping、(c) hand 外の topping（pantry から pin 必須）、(d) 在庫 0 を含む意図、(e) 4 種以上の自由 pizza。
3. **順序効果の相殺**: 9→12 と 12→9 を別日に各 1 回（ABBA）。各 run の前に reload（pins 空）。
4. **端末**: 390×844 real iPhone（Safari + standalone）必須。可能なら小型端末（360×640 相当）で keyboard-open pantry のみ追加。
5. **記録**: M-1〜M-9 を表に、HV-1〜HV-13 を Owner が記入。video 2 本（9 / 12）を直接送付。
6. **判定材料の分離**: 数値（M-*）は差の有無のみを報告し、推奨はしない。**最終 capacity は R6-d で Owner が決める**（本監査・R6-c では決めない）。
7. 期待される差（事前仮説、決定ではない）: geometry は同一（§8.1）。9 は page 2 が 1 行で「見つからない → pantry」が増えやすく、12 は page 2 を見る頻度が増えやすい。

## 17. R6 slice plan

| slice | 内容 | production 変化 | HV |
|---|---|---|---|
| **R5-e-h** test / mutation hardening（R6 の前提） | §13.1 H-1〜H-8、E6 / E2 を kill、M10b 更新、M1〜M114 維持 | なし | 不要 |
| **R6-a** activation readiness（flag false のまま） | test seam（flag を 1 関数に集約、`handCapacityFor` を mock しない ON test）、OFF golden 14+ snapshots を commit、ON-inactive ≡ OFF gate、App-level capacity 9 parametrize（G-1）、G-2 / G-3 / G-5、H-4 invariant、capacity-full feedback + SR announce（AB-1）と OD-R5e-1 の presentation を **dormant で**実装、Preview-only flag 切替（OD-R5e-4）、mutation E-set の survivors を kill | なし（DOM byte 同一を gate で証明） | 不要（dormant） |
| **R6-b** Preview flag ON exact SHA HV | Preview build のみ flag ON（capacity 12 candidate）。390×844 video + screenshot、HV-1〜HV-13 の初回 | なし（production は false） | 必須 |
| **R6-c** 9 vs 12 real-device comparison | §16 protocol。2 Preview build | なし | 必須 |
| **R6-d** Owner capacity decision | docs のみ。`DEFAULT_HAND_CAPACITY_CANDIDATE` の確定値と test の parametrize 方針 | なし | — |
| **R6-e** production activation / final gate | 定数を確定値に、flag true。OFF golden は non-eligible / inactive の gate として残す。post-merge Deploy + WebKit、production exact SHA の HV | **あり** | 必須 |

R6-a を「test / presentation hardening（dormant）」と「Preview 切替」で 2 PR に分けるとより安全（R6-a1 test-only、R6-a2 dormant presentation + Preview switch）。

## 18. Owner Decisions（**CONFIRMED**, 2026-09-30）

| # | 決定 | 実装時期 |
|---|---|---|
| **OD-R5e-1** | pin UI は **hand が active な category でのみ** production 表示する。sauce / cheese、owned topping ≤ capacity（inactive）では効かない pin UI を出さない | R6-a（presentation、dormant）。現 test は current spec を固定しているので（E11 KILLED）、R6-a で意図的に更新する |
| **OD-R5e-2** | hand mode では unpinned かつ inventory = 0 の topping を tray から除外してよい。pantry には ×0 で残す。existing pinned inventory = 0 は tray に残し、unpin 可能 | 実装済み（R5-d）。R5-e-h H-6 で App-level に固定 |
| **OD-R5e-3** | capacity rejection UI に capacity の数字を出さない。例: 「手元がいっぱいです。使わない食材のピンを外してね」。capacity 9 / 12 は R6 Human Feel Gate まで未決定 | R6-a |
| **OD-R5e-4** | Preview-only activation mechanism を採用。production から Preview override を利用できない **fail-closed** 設計が必須。具体的な mechanism は R6-a で current build / deploy architecture を監査して決める | R6-a（R5-e-h では実装しない） |
| **OD-R5e-5** | R5-e-h → R6-a〜R6-e の順序を承認。ただし R5-e-h 完了後、current main から R6 slice 境界を再確認する | R5-e-h 完了後 |

## 19. Risks

| risk | 影響 | 緩和 |
|---|---|---|
| flip 時に `handCapacityFor` 等の real 結合が mock に隠れていた | ON で hand が active にならない / capacity 誤り | AB-3（R6-a の seam + real ON test） |
| no-op pin による混乱 | 「pin したのに何も変わらない」 | OD-R5e-1 |
| silent rejection | 「壊れている」と感じる | AB-1 |
| pin 編集由来の page 0 / selection clear が modal の下で起きる | 閉じた後の迷い | HV-6 / HV-7、P-7 |
| 在庫 0 topping の tray からの消失 | 「材料が消えた」 | OD-R5e-2、HV-13 |
| 小画面 + 大 keyboard で pantry list 0 行（pre-existing） | 検索結果が見えない | HV-8、R6 で必要なら別 slice |
| 9 vs 12 の主観差が小さく決めきれない | R6-d の遅延 | §16 の M-* を先に固定、ABBA |
| session-only pins が reload で消える | 期待とのずれ | 仕様（OD-R5-9）。HV で観察のみ |

## 20. Final readiness verdict

**C. HARDENING REQUIRED BEFORE R6**

理由:
- Foundation 自体は健全: privacy PASS（§4）、OFF = R5-d production behavior（§10）、dormancy guard は flag を読む 3 site すべてで有効、OD-R5d-1〜3 は current code と一致（§5 / §6）、9 / 12 で stage geometry 同一（§8）。
- しかし **#197 の App 層 clear（activation 時の安全契約の中核）を守る test が存在しない**（F-6: E6 SURVIVED、scratch probe で非可視 selection による配置を再現）。flag ON 系の作業（R6-b 以降）に入る前に test-only hardening H-1（+ H-2〜H-7）が必要。
- 並行して Owner Decision OD-R5e-1〜5（§18）が必要。production activation（R6-e）前の blocker は AB-1〜AB-6（§13.2）。

提案する次 slice（Owner go 待ち）: **LC-R5-e-h（test / mutation hardening only）** — H-1〜H-8 の test 追加と `r5e-activation-mutants.mjs` の E6 / E2 を kill、既存 M1〜M114 維持。production code・flag・capacity・save・UI は一切変更しない。その後 R6-a へ。

R6 implementation は開始しない。STOP.
