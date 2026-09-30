# Large Catalog UX — LC-R5-d Fresh Audit（hand → Builder tray の dormant wiring / #197 page-level transition）

Docs / measurement tooling only. **production code 変更なし・PR なし・`HAND_ENFORCEMENT_ENABLED` は `false` のまま。** R5-e / R6 には進まない。

## 0. Audited state

| 項目 | 値 |
|---|---|
| audited main | **`e14f33ef196cc4eb8c9080974cddd5dc67ba6459`**（fresh fetch 済み。known main と一致、main は進んでいない） |
| branch | `claude/lc-r5d-fresh-audit-2wa5cy` |
| 既知の完了 | PR #310（R5-b）/ #311（Original Pizza Recovery P2）/ #312（R5-c）MERGED |
| flag | `src/logic/catalog/handPolicy.ts`: `HAND_ENFORCEMENT_ENABLED = false` |
| 参照 authority | LC-R5 Fresh Audit `b584b7a` §7 / §8 / §21（OD-R5-1〜12、§21.1 #197）、LC-R5 Implementation & Verification Plan（IVP）`855e9fb` §7.3 / §8 / §12 / §14、LC-R5-c Fresh Audit + Result（main）、LC-R2 Result（main）、`PROJECT_HANDOFF.md` Large Catalog UX 節 |
| baseline test（main、本監査で実行） | `src/logic/catalog/**` + `App.handPins` + `IngredientPantry.pins` + `App.freeCookTrayPaging`: **16 files / 143 passed** |
| probe（本監査で追加、CI 外） | `tools/large-catalog-ux/r5d-hand-probe.test.ts`（`npx vitest run --config tools/large-catalog-ux/vitest.r5d-probe.config.ts`）→ `docs/reports/data/TETO_LARGE-CATALOG-UX_LC-R5d_PROBE.json` |

current code を authority とし、過去文書と食い違う箇所は §5 / §6 に **Finding** として明記した。

---

## 1. R2 / current HandSession architecture（コード事実）

| 要素 | 現 main の事実 | R5-d への意味 |
|---|---|---|
| `workingSet.selectWorkingSet` | 優先順 `placed > pinned > hint > favorite > recent > new > fill`。**owned(category) ≤ capacity なら inactive**（全 owned を catalog 順、在庫 0 含む＝今日の tray）。active 時: placed / pinned は在庫 0 でも採用、自動 source は在庫 0 を skip、重複は上位 source を保持。`overflowIds` = capacity に入らなかった **placed / pinned** | **`items` は source 順**（catalog 順ではない）→ Finding F-1 |
| `handPolicy` | `HAND_CAPACITY_CANDIDATES = [9, 12]`、`HAND_ENFORCEMENT_ENABLED = false`、`handCapacityFor(owned, cand)` = flag off なら `max(1, owned)`（常に inactive） | 9 / 12 両方を引数で扱える。12 は候補（OD-R5-1、R6 で確定） |
| `handSession` | `HandSession = Record<sauce|cheese|topping, string[]>`、`addToHand` / `removeFromHand` / `replaceHand` / `pruneHand` / `sanitizeHandSession`。`resolveHand(input)` = 非 eligible で `null`、eligible なら `selectWorkingSet`（**hint は `NO_DISCLOSED_HINTS` 固定**）。`handVisibleIds` = `items` の id（source 順）。`selectionAfterVisibleChange` = **hand-level**（§21.1 で page-level に置換が決定済み）。`recentlyAcquiredIds` = `ownedIngredientIds` の逆順から starter 除外 | **production caller ゼロ**（`resolveHand` / `selectWorkingSet` / `recentlyAcquiredIds` / `selectionAfterVisibleChange` / `handVisibleIds` は test からのみ呼ばれる） |
| `usageSignals` | favorites / recent / newlyOwned（session-only）。production で書く箇所なし | favorite / recent は production で常に空 |
| `freeEligibility` | `isLargeCatalogEligible = roundKind === "FREE_COOK" && dinner === null` | FREE-only gate はそのまま流用 |
| capacity 9 / 12 | `selectWorkingSet` は任意の正整数、test は 9 / 12 を parametrize 済み | R5-d でも capacity を引数のまま保つ |

## 2. R5-c pin architecture（コード事実）

- `App.tsx:230` `useState<HandSession>(emptyHandSession)`。**App-level・session-only**、round / step / HOME / FREE 再開 / Dinner で reset しない。reload で空。GameState・save に無い（boundary test + M97）。
- 唯一の writer: `GameScreen` → `IngredientPantry` の `onPinSessionChange`（updater 形 `(prev) => next`）。`handEditing={HAND_ENFORCEMENT_ENABLED}`（false）で production DOM は R5-b と byte 同一。
- `pinEdit.togglePin`: OWNED ∧ active category のみ、**在庫 0 は新規 pin 不可**（`rejected-no-stock`、同一 session object を返す）、既存 pin は在庫 0 でも解除可、読み取り時 prune（`pinsInCategory`）、`clearPins` = active category のみ。**pin 数の上限なし**（22 全部 pin 可、probe `togglePin.all`: pins 22 / hand 12 / overflow 10）。
- pantry の stock 入力 = `remainingStock(ingredient, inventory)`（**round 開始時の inventory**。placement で減らない）。

## 3. Current tray / paging / selection architecture（コード事実）

| 要素 | 事実 |
|---|---|
| tray の item 源 | `IngredientTray` → `trayIngredientsFor(category, { ownedIngredientIds, freeCook: recipeFreeTray, recipe })`（FREE / Dinner = 全 owned、guided / Lunch Rush = recipe 必要材料 ∩ owned）。順序 = `INGREDIENTS` 宣言順 = catalog 順（`catalogIndex`） |
| page state | **`IngredientTray` の local `useState(0)`**。`currentPage = min(page, pageCount-1)` を render で clamp。1 page = `MAX_INGREDIENT_PALETTE_SLOTS = 6` |
| page reset | `useEffect(() => setPage(0), [activeCategory])`（**effect＝paint 後**。step 変更時に 1 commit だけ旧 page index が clamp 表示され得る既存挙動。OFF 同値のため変更しない） |
| #197（既存） | `goToPage` 内で、選択が tray 内にあり移動先 page に無ければ `onClearSelection()`（= App の `setSelectedIngredientId(null)`）を**同じ event 内で**呼ぶ |
| `selectedIngredientId` | App `useState`。writer: tray click / physical drag（`onSelectIngredient`）、`handlePhysicalDrop`、#197 clear、**render-phase の派生 reset**（`lastRoundKey` 変化 → null、`lastMakingStep` 変化 → SAUCE なら `findPrimarySauceId(recipe)`、他は null） |
| FREE の SAUCE 初期選択 | FREE は `recipe = FREE_COOK_RECIPE`（`requiredIngredients: []`）→ `findPrimarySauceId` = **null**。eligible round の各 step 開始時の選択は常に null |
| tray mount | `state.makingStep !== "DOUGH"` の間 mount。新 round は DOUGH 開始 → tray unmount → page state 消滅 |
| dock | `prepareDockReserve` は `trayIngredientsFor` の件数から rows（≤ 2 行）/ pager / utilityRow を round 開始時に確定 |
| 在庫変化の時点 | `CONFIRM_BAKE`（`consumePizzaInventory`）のみ減算。Shop（購入 / 補充）は HOME / Pizza Select / RESULT からのみ（Dinner 中は `openShop` 拒否）。**PREPARE 中に ownership / inventory は変わらない** |
| placed ids | `state.pizza.sauceIds` + `state.pizza.toppings[].ingredientId`（cheese も scatter で toppings に入る）。GameScreen に `usedIngredientIds(pizza)` が既にある |

**不変条件 I1（コードから導出）**: FREE eligible round の PREPARE では、`selectedIngredientId ∈ (現在 visible な tray page) ∪ {null}` が常に成り立つ（選択は visible chip の click / drag でのみ set、page 移動は #197 で clear、step / round 変更は App が reset、FREE の SAUCE 初期選択は null）。→ IVP G-d（「hand 変更の瞬間に選択が別 category / 不可視」）は **コード上到達不能**。R5-d で App レベル test に固定する（§16）。

---

## 4. Pin → Hand exact contract（R5-d で確定すべき domain behaviour）

`trayHand = FLAG && eligible && phase === "PREPARE" && makingStep ∈ {SAUCE, CHEESE, TOPPING} ? handTrayIds(resolveHand(...)) : null`

| # | 契約 | 現 code の状態 |
|---|---|---|
| H1 | category ごと: `session[activeCategory]` のみが入力。他 category の pin は無関係 | ○（`selectWorkingSet` が inCategory で filter。probe `isolation`） |
| H2 | 構成 = placed > pinned > (hint 無し) > (favorite 空) > (recent 空) > new > fill、capacity まで | ○（OD-R5-3） |
| H3 | OWNED only（未所持・別 category・garbage pin は読み時に無視。session は書き換えない＝derived prune） | ○ |
| H4 | 在庫: pin / placed は在庫 0 でも hand に残る（chip は EP3 で disabled）。自動 source は在庫 0 を skip | ○（probe `zeroStock`） |
| H5 | hand の stock 入力は **`remainingStock`（round 開始 inventory）**。`canPlaceIngredient`（pizza 上の個数込み）を hand 資格に使ってはならない（使うと placement ごとに hand が変わる） | 新規契約（mutation 対象） |
| H6 | **tray の表示順は catalog 順**（source 順ではない） | ✕ 未実装 → F-1 |
| H7 | placed は capacity を超えても evict しない | ✕ 現 code は evict → F-2 |
| H8 | capacity overflow（pins > cap − placed）の意味論 | 未決（§7、Owner） |
| H9 | inactive（owned ≤ cap）では pin は tray に影響しない（全 owned を catalog 順） | ○ |
| H10 | 非 eligible（Dinner / guided / Lunch Rush）、DOUGH、PREPARE 外 → `null` ＝既存 tray | ○（`resolveHand`）＋ App 側 gate が必要 |
| H11 | "new" = `recentlyAcquiredIds(state.ownedIngredientIds, STARTER_INGREDIENT_IDS)`（OD-R2-2）。favorite / recent は `[]`、hint は `NO_DISCLOSED_HINTS`（OD-R5-11） | 関数はあるが未配線 |
| H12 | hand は **derived**（state にしない）。pins のみが state（R5-c の App state） | 方針 |

R5-c authority との整合: 「inventory0 は新規 pin 不可 / 既存 inventory0 pin は解除可 / invalid pin は prune / session-only / save 無し」は H3・H4・H12 と**矛盾しない**。区別すべき点は「**pin eligibility（新規 pin 可否 = 在庫 > 0）**」と「**hand eligibility（既存 pin は在庫 0 でも hand 内）**」が別物であること（§11）。

## 5. Findings（current code vs 過去文書）

- **F-1（重要・R5-d 必須）: `selectWorkingSet.items` は source 順。** probe `placeInHand`: hand 内の自動 item を placed にすると **集合は同じ・source 順は変わる・catalog 順は不変**。`pinInside`（hand 内の自動 item を pin）も同様。`handVisibleIds` をそのまま tray に渡すと、**placement や無害な pin のたびに tray が並び替わり → page reset → 選択 clear** が起き、#197 と操作感を同時に壊す。R5 audit §8.3 の「tray は catalog 順（必須 test）」を R5-d の pure helper（`handTrayIds`）で実装すること。
- **F-2（domain・Owner 確認）: placed > capacity で placed が evict される。** probe `placedOverCap`: cap 9 に placed 10 → 9 件のみ、`anchovy` が `overflowIds`（cap 12 / placed 13 → `bacon`）。R5 audit §8.4・IVP §7.3 は「placed は全保持（`overflowIds` は pin のみ）」と書くが、**current code はそうなっていない**。ただし enforcement ON でも placement は visible tray からのみ行えるため、`placed(category) ⊆ hand` が常に成り立ち **placed > capacity は到達不能**（§6）。安全側の pure 修正（placed は capacity を超えても保持）を推奨、Owner 確認事項 OD-R5d-2。
- **F-3（test 前提）: `App.handPins.test.tsx` は flag を強制 ON にして「tray 不変」を証明している。** fixture の owned topping は 8 件（≤ 9 / 12 ＝ inactive）なので R5-d 配線後も通るが、**active hand の fixture（topping ≥ 13 所持）での再証明が必要**（旧 test の意味が「inactive では不変」に縮む）。boundary test の R5-c gate（IngredientTray は `resolveHand` を知らない、`setHandSession` 出現 2 回）は R5-d で**意図的に更新**が必要。
- **F-4: mutation 番号。** IVP は R5-d を M87〜M93 と予定したが、R5-c が M83〜M97 を使用済み。R5-d は **M98〜** を使う。

## 6. Placed ingredient protection

例（brief）: capacity 9、placed A B C、pins D〜K（8 件）。current code（probe `cap9.placed3.pins8`）:

```
hand = basil(placed) garlic(placed) oregano(placed) cherry-tomato egg mushroom onion sausage pepperoni(pinned ×6)
overflowIds = [anchovy, tuna]   ← 後から追加した pin 2 件が hand に入らない
```

- **placed は最優先で保持される**（placed > pinned は現 code で成立）。pins は選択順で先勝ち、後着 pin が overflow。
- cap 12 では pins 8 件全部 + fill 1 件（rosemary）。
- **placed count > capacity**: 現 code は placed も evict（F-2）。到達可能性: 配置は visible chip（= hand）からのみ → placed ⊆ hand → |placed| ≤ cap。pin 編集は placed を押し出せない（placed が最優先）。RESET_PIZZA は DOUGH に戻り tray を unmount。よって enforcement ON でも **到達不能**。それでも domain 関数は fail-safe にする（推奨: placed は capacity を超えて保持、超過分は pin のみ overflow）。
- **category 切替**: placed は `inCategory` で filter → 他 category の placed は無関係。
- **inventory 消費後**: 消費は CONFIRM_BAKE のみ（tray unmount 後）。次 round は placed 空から再計算。
- **pin 解除**: placed ∧ pinned の item を解除しても placed として hand に残る（tray 不変 → reset / clear なし）。R5 audit §8.4 は「placed tile の pin 操作 disabled（配置ずみ）」を提案（presentation = R5-e、Owner 未確認）。
- **auto-fill replacement**: placed は自動 source を押し出す側で、押し出される側にならない。

## 7. Capacity overflow alternatives（意味論のみ。UI は R6）

| 案 | 内容 | 予測可能性 | 不変条件 | 実装 / R6 UI | 備考 |
|---|---|---|---|---|---|
| **A** | pin 数 ≤ cap を超える pin 操作を拒否（placed は数えない） | 中 | placed があると pin が overflow し得る（📌 なのに tray に無い） | 小（`togglePin` に件数） | placed 込みで破綻 |
| **B** | pin は無制限に保持、hand は priority で決定（**= 現 code の暗黙挙動**） | 低 | 「📌 = tray にある」が成り立たない。overflow cue 必須 | 0（現状） / R6 で overflow 表示が要る | 後着 pin が黙って無効 |
| **C**（推奨候補） | 新規 pin は `|placed ∪ pins| < cap` のときだけ可（placed を保護し残り slot だけ pin 可）。R5 audit §8.2 / IVP §7.3 の「blocked add・eviction なし・中立メッセージ」 | **高** | 追加時に守れば、placement は hand 内からのみなので `placed ∪ pins ⊆ hand` が常に成立 → **全 pin が必ず tray に載る**、`overflowIds` は到達可能状態で常に空 | pure guard（`canAddPin`）+ pantry に placedIds / capacity を渡す。R6 で「手元がいっぱい」文言・n/cap | inactive hand（owned ≤ cap）では常に可 |
| D | 新規 pin が最古 pin を evict（FIFO） | 低 | 隠れた state 変化 | 小 | R5 audit が不採用 |

推奨: **C**（B の priority ロジックは防御として残す）。**Owner Decision なしで確定しない**（OD-R5d-3）。R5-d の tray 配線自体は B のままでも正しく動く（overflow pin は tray に出ないだけ）ので、C の guard は R5-d 内の独立した小 slice か R5-e に置ける。

## 8. #197 transition truth table

定義: `list` = 解決済み hand を **catalog 順**に並べた tray id 列、`page(list, p)` = 6 件単位。前提 I1（選択は現在 visible page 上か null）。**trigger の読み**は 2 通りあり、Owner 確認が要る（OD-R5d-1）:

- **R-α（推奨）**: `list` が変わったら（membership か順序）page 0 へ戻し、選択は `page(listAfter, 0)` に有れば keep、無ければ clear。§21.1 P3「hand 変更後 page 0」の逐語。
- **R-β**: 現在 page の id 列が変わったときだけ page 0 + 評価。他 page だけの変化は無視。

probe（`cap9/cap12.pinOutside`、`unpinShift`）と code 読解による表（ON = forced-on、active = owned > cap）:

| # | 状況 | list 変化 | R-α 結果 | R-β 結果 | 根拠 |
|---|---|---|---|---|---|
| T1 | enforcement OFF（production）で pin 編集 | なし（trayHand = null） | page / 選択 不変、clear 0 | 同 | P1 / P7。R5-c test 既存 |
| T2 | ON・非 eligible（Dinner / guided / Lunch Rush） | なし（null、pantry 自体無し） | 不変 | 同 | OD-1 |
| T3 | ON・inactive（owned ≤ cap）で pin 編集 | なし | 不変 | 同 | H9 |
| T4 | ON・active、hand 内の自動 item を pin | **なし**（catalog 順） | 不変 | 同 | probe `pinInside`（source 順だと変化＝F-1） |
| T5 | pin 拒否（在庫 0 / 未所持） | なし（同一 session） | 不変 | 同 | `togglePin` |
| T6 | page 0 表示中、hand 外 item を pin → 末尾の自動 item（page 1 上）が押し出される | あり（page 1 のみ） | page 0 のまま、page 0 上の選択 keep | 同 | probe rows `fromPage 0: changed false`（R-β）＝ R-α も同結果 |
| T7 | page 1 表示中・page 1 の X を選択、同上の pin | あり（page 1） | **page 0**、X は page 0 に無い → **clear** | 同 | probe rows `fromPage 1 → toPage 0, selectedAfter null` |
| T8 | 選択 X が whole hand には残るが new page 0 に無い | あり | **clear**（hand-level 実装を殺す case） | 同 | §21.1 P4 / P5 |
| T9 | 選択 X が変化後も page 0 に有る（例: basil） | あり | **keep** | 同 | probe `unpinShift` rows |
| T10 | 選択 X が page 0 上で、前方への挿入により page 1 へ押し出される | あり | clear | 同 | page-level 規則 |
| T11 | 選択 null で list 変化 | あり | page 0、選択 null | 同 | — |
| T12 | **page 1 表示中、変化が page 0 だけ**（多 pin 状態で unpin → fill が page 0 に再入） | あり（page 0 のみ） | **page 0 へ移動、page 1 上の選択は clear** | **不変**（page 1・選択 keep） | probe `cap9.unpinShift` rows `fromPage 1: changed false`。**R-α / R-β が分かれる唯一の型** |
| T13 | 選択が別 category | — | 到達不能（I1） | 同 | App test で固定（G-d） |
| T14 | placement（PLACE_TOPPING / APPLY_SAUCE / physical drop） | **なし**（catalog 順で membership 不変） | 不変 | 同 | probe `placeInHand`、H5 |
| T15 | step 変更（SAUCE→CHEESE→TOPPING） | category ごと別 list | 既存: App が選択を render-phase で reset（FREE は null）、tray の page は既存 effect で 0 | 同 | hand transition ではない |
| T16 | round 変更 / HOME / FREE 再開 | — | DOUGH で tray unmount → page 0 で再 mount、選択 null | 同 | 既存 |
| T17 | pantry open / close / shelf / search / scroll | なし | 不変 | 同 | §21.1 P1、R4/R5-c test 既存 |
| T18 | 1 回の pantry 表示中に pin → 同じ pin を解除 | 2 回変化（戻る） | 1 回目で page 0・選択 clear 済み。戻しても復元しない | 同 | per-edit 評価の帰結（§9 note、R6 HV で体感確認） |
| T19 | CONFIRM_BAKE（在庫減） | tray unmount 後 | 次 round で再計算 | 同 | §11 |

paging 実装で契約は実装可能か: **可能**。page は tray local だが、R-α なら判定に現在 page を必要としない（`listBefore`・`listAfter`・`selectedIngredientId` のみで決まる、I1 による）。R-β は現在 page を知る必要があり、page を GameScreen / App へ lift するか、tray 内 effect から親 state を clear する（1 frame stale）必要が出る（§9）。

## 9. Transition timing analysis

PREPARE 中に `list` を変え得る入力（code 読解）: pins（pantry 編集）、placed（placement — catalog 順なら不変）、ownership / inventory（PREPARE 中は不変）、category（step 変更 — 既存 reset が担当）、round（unmount）。**実質 trigger は pin 編集のみ**。

| 案 | 方式 | determinism | #197 正しさ | stale state | testability | OFF 同値 | 9/12 | R6 複雑度 |
|---|---|---|---|---|---|---|---|---|
| **A2（推奨）** | pure `handTrayTransition(listBefore, listAfter, selected)` + **render-phase 派生**: App が `lastTrayKey`（list の signature）を持ち、変化時に選択を評価（App 既存の `lastRoundKey` / `lastMakingStep` と同じ idiom）。tray も hand mode のときだけ同じ signature で render-phase に `setPage(0)`（自 state のみ） | ◎ 同一 pure 関数・同一入力 | ◎ どの trigger でも漏れない（未知の list 変化も捕捉） | ◎ effect 無し → paint 前に確定、二重 clear は idempotent（null → null） | ◎ pure unit + App test | ◎ hand mode（trayHand 非 null）以外は現行コード経路のまま | ◎ capacity は引数 | 小: flag 反転のみ |
| A1 | 同じ pure 関数を **pin 編集 event handler**（App の wrapper）で適用、page reset は revision token | ◎ | ○ pin 以外の trigger は拾わない（現状は無いが将来漏れ得る） | ◎ event 内 batch | ◎ | ◎ | ◎ | 小 |
| B | 複数 `useEffect`（tray が list 変化を effect で検知 → setPage(0) + onClearSelection） | △ 順序依存 | △ paint 後に clear → 1 frame「不可視の選択」、step 変更時の App reset と二重実行 | ✕ | △ timing test が必要 | △ OFF の category effect と混線し易い | ○ | 中 |
| C | reducer 統合（handSession / page / selection を 1 reducer） | ◎ | ◎ | ◎ | ◎ | ✕ `selectedIngredientId` の全 writer（tray / drag / step reset / #197）を移す大改修で OFF 経路に触れる | ○ | 大 |
| D | page を App へ lift（controlled tray）+ A1 | ◎ | ◎（R-β も可能） | ◎ | ○ | △ tray API を全 mode で変える（uncontrolled fallback が要る） | ○ | 中 |

推奨: **A（pure deterministic transition）を A2（render-phase 派生）で適用**。前提は R-α。R-β を選ぶ場合は D（page lift）か tray 内評価が必要でコストが上がる。

順序（A2、1 回の pin 編集）: ① pantry click → App `setHandSession(next)` → ② App re-render: `trayHand` 再計算 → `lastTrayKey` 不一致 → `setLastTrayKey` + `setSelectedIngredientId(sel => onPage0 ? sel : null)`（render 中の自 state 更新、React が即 re-render）→ ③ tray render: signature 不一致 → `setPage(0)` → ④ 1 commit / 1 paint で「新 hand・page 0・評価済み選択」が同時に出る。pantry 表示中は `cookingInputPaused` で pizza 入力と drag が止まっているため、中間状態を操作できる経路も無い。

note: T18（編集→戻し）は per-edit 評価で選択が戻らない。pantry close 時の net diff 評価（T2 案）は §21.1「実際に変える瞬間」の逐語から外れ、tray を pantry 表示中に凍結する追加 state が要るため採らない。R6 HV で違和感が出たら再検討（Owner 事項ではなく R6 観察項目）。

## 10. Category isolation

- hand・page・選択はすべて active category 単位。`session.sauce` の編集は TOPPING の `list` を変えない（probe `isolation: same true`）→ TOPPING の page / 選択に影響しない。
- pantry は active category のみ編集（`togglePin` / `clearPins`）→ 他 category の pin 編集は UI 上存在しない。
- step 変更で list が category ごとに入れ替わるのは既存の page reset / 選択 reset の担当（T15）。A2 の App 評価は step 変更時にも走るが、App が同じ render で選択を null にしているため結果は同じ（null）。
- SAUCE / CHEESE（production: 3 / 4 所持）は inactive（≤ 9）。62 catalog（各 10）では cap 9 なら active、12 なら inactive（R5 audit §9。9 vs 12 は R6）。

## 11. Inventory0 behavior

| 状況 | pin 可否（pantry, R5-c） | hand 資格（R5-d） | tray |
|---|---|---|---|
| 在庫 1 → pizza に 1 個配置 | 可（`remainingStock` = 1） | 変化なし（H5） | chip disabled（EP3 `canPlaceIngredient`）、membership 不変 |
| CONFIRM_BAKE で 1 → 0 | 新規 pin 不可 | 自動 source から外れる（次 round） | 次 round の hand に出ない（pantry で ×0 表示） |
| 既存 pin が 0 に | 解除可 | **hand に残る**（explicit choice） | disabled chip として slot を 1 つ占有（R6 UX 観察） |
| placed の在庫 0 | —（placed は同 round 内のみ） | hand に残る | disabled |
| 次 round / HOME → FREE 再開 | pins 保持 | 再計算（`remainingStock` 基準） | — |
| Dinner 往復で消費 | pins 保持・非 eligible 中は未使用 | FREE 復帰時に再計算 | — |

R5-c「既存 zero-stock pin は残して解除可」と「hand eligibility」の関係: **pin 資格 = 新規追加時の在庫 > 0**、**hand 資格 = pin であること（在庫不問）**。矛盾しない。capacity C 案では在庫 0 pin も slot を消費する（数え方は pin として）。inventory system 自体は変更しない。

## 12. Auto-fill authority / privacy

| source | 出所（current main） | R5-d 配線 | privacy |
|---|---|---|---|
| placed | `state.pizza`（GameScreen `usedIngredientIds` 同等） | App / GameScreen が渡す | player 自身の配置 |
| pinned | App `handSession` | 既存 | player 自身の選択 |
| hint | `resolveHand` が **`NO_DISCLOSED_HINTS` 固定**。`disclosedHintsFromSheetView` は production 未使用 | 配線しない（OD-R5-11） | 未購入 Hint・hidden requirement・target を読まない |
| favorite / recent | production writer なし → 空 | `emptyUsageSession()` ベース | — |
| new | `recentlyAcquiredIds(ownedIngredientIds, STARTER_INGREDIENT_IDS)`（acquisition 順、R2 で load 往復を test 済み） | `usage.newlyOwned` に入れる（OD-R2-2 承認済み） | ownership のみ。新しい推論なし |
| fill | catalog 順 ∩ OWNED ∩ 在庫 > 0 | 既存 | — |

`workingSet` / `handSession` は recipe・matcher・discovery・Hint 5 ladder・Original Pizza Recovery を import しない（boundary P-7 / LC-R2 既存）。R5-d で追加する `handTray` も同じ allow-list（`catalogTypes` / `handSession` / `workingSet` 型、`data/ingredients` の `MAX_INGREDIENT_PALETTE_SLOTS` のみ）に固定する。候補 recipe・matcher distance・near-miss・Recovery internal を参照しない。

## 13. FREE-only eligibility

`trayHand` を非 null にできる条件 = `HAND_ENFORCEMENT_ENABLED && isLargeCatalogEligible(state) && phase === "PREPARE" && makingStep ∈ {SAUCE, CHEESE, TOPPING}`。それ以外（Dinner・guided・Lunch Rush・ORDER 相の empty-Dex 初期 FREE_COOK・DOUGH）は `null` = 現行 `trayIngredientsFor`。`recipeFreeTray`（Dinner で true）や `freeCook` 単独を gate に使わない（OD-B4）。R5-d dormant wiring でもこれらの visible tray は不変（flag false では全 round で null）。

## 14. OFF equivalence plan

原則: **flag false では hand 関連の値が生成されず（`trayHand = null`）、tray は現行コード経路をそのまま通る**（hand を経由して「同じ結果」を作るのではない）。

| Gate | 対象 | 手段 |
|---|---|---|
| E1 source | `trayHand` の唯一の producer が `HAND_ENFORCEMENT_ENABLED &&` で始まる / tray の hand 分岐は `handIds != null` のときだけ / hand mode の render-phase reset も同条件 | boundary test（R5-c gate を更新） |
| E2 tray DOM golden | FREE（22 topping、page 1〜4）・Dinner・guided・Lunch Rush の tray DOM（chip 順・class・`aria-pressed`・disabled・page label・pager / entry row） | main `e14f33e` で記録した snapshot と byte 比較 |
| E3 interaction | page 2 で選択 → pantry open / search / shelf / close → 選択・page 保持、pizza tap で配置、page 移動で #197 clear | App test（production flag）で clear 回数・page・`selectedIngredientId` を記録比較 |
| E4 page | category 変更時の page reset が既存 effect のまま（render-phase 化しない） | unit |
| E5 pantry | production DOM が R5-b / R5-c と byte 同一（既存 test 継続） | 既存 |
| E6 geometry | stage Ø / dock / tray / pager 行 / pantry sheet・list 高、4 viewport + simulated keyboard（360×640: 87px・1 row） | 既存 e2e（stage-size-stability、large-catalog-*）を R5-c baseline で |
| E7 mode 隔離 | Dinner / guided / Lunch Rush で `trayHand === null`、pins があっても tray 不変 | App test（forced-on でも） |
| E8 save | save 文字列不変・`hand` / `pins` key 無し | 既存 M97 継続 |

補足: **forced-on でも dock / geometry は不変**であることを code から証明できる。hand が active になるのは owned > cap ≥ 9 のときだけで、そのとき hand 件数 = cap ≥ 9 > 6 → rows = 2・pager = true、これは today の owned > 6 と同じ。`prepareDockReserve` は変更不要（R6 で実測再確認）。

## 15. Geometry risks（R6 記録のみ。R5-d で再設計しない）

- R5-d は production UI 追加なし → R5-b / R5-c geometry を維持。
- R6 で visible hand: pager label が「1 / 4」→「1 / 2」に変わる（行高不変）。
- 360×640 + simulated keyboard: pantry list ≈ 87px・1 full row（R5-c 実測）。**固定 selected strip は不可**。方式 D（normal = strip / keyboard = strip 非表示 / tile の pin 状態は残す）を前提候補として保持。
- R6 追加表示（n/cap、3-state cue「手元に固定 / 手元 / 印なし」、「配置ずみ」、「手元がいっぱい」文言、「ざいこなし」）は tile 内 / strip 内に収める必要。1 row 予算を超える表示を keyboard 中に出さない。
- 9 vs 12: page 2 が 3 chip（9）か 6 chip（12）か。geometry は同一（R2 実測）、差は mis-tap / thumb（R6 Human Feel Gate）。

## 16. Test / mutation / e2e plan（R5-d 実装時）

Unit（pure、`handTray.test.ts`）: catalog 順（source 順で並べる mutation を殺す）、placement で list 不変、hand 内 pin で list 不変、T5〜T12 の各行を 9 / 12 で parametrize、whole-hand ∋ X だが page 0 ∌ X → clear、placed ≥ cap（F-2 修正を採る場合）、H5（stock 入力に pizza 個数を使わない）、H11 new tier、isolation。

App（forced-on、active fixture = topping ≥ 13 所持）: pin 編集で page 0・page-level 評価（keep / clear の両方）、pantry open / close / search / shelf で clear 0、placement で page / 選択不変、I1 fuzz（place / pin / unpin / clear / page 移動 / step 確定 / やり直す をランダム列で実行し、各 render 後に「選択 ∈ visible page ∪ {null}」）、Dinner / guided / Lunch Rush で tray 不変（pins あり）、HOME / FREE 再開 / Dinner 往復で pins から再計算、1 commit で選択と page が同時に確定（中間 DOM が観測されない）。OFF: E2〜E4。

Mutation（M98〜、`tools/large-catalog-ux/mutation-check.mjs`）: M98 tray を source 順で並べる / M99 whole-hand 基準で選択判定 / M100 hand 変化で page を戻さない / M101 flag false でも `trayHand` 生成 / M102 hand stock に `canPlaceIngredient` / M103 非 eligible で hand 生成 / M104 pantry open / close で clear / M105 他 category の pin で TOPPING list 変化 / M106 category effect を render-phase 化（OFF timing 変化）/ M107 hint を `NO_DISCLOSED_HINTS` 以外から供給 / M108 placed を evict（OD-R5d-2 採用時）/ M109 capacity guard が placed を数えない（OD-R5d-3 = C 採用時）/ M110 capacity を 12 に hard-code（9 parametrize で殺す）。

e2e: production — page 2 選択 → pantry 検索 / shelf → close → 選択と page 保持（既存 dormant spec 拡張）、4 viewport geometry 不変。forced-on（G-c の手段が決まった後、R5-e まで）— pin 変更 → page 0、stage / dock 不変。WebKit は CI。

## 17. Implementation slice proposal（Owner go 後。今回は着手しない）

| Slice | 内容 | 変更予定 | 完了条件 |
|---|---|---|---|
| **R5-d-1** pure | `handTray.ts`: `handTrayIds`（catalog 順）、`trayPageIds`、`handTrayTransition`（R-α / page-level）。OD-R5d-2 次第で `selectWorkingSet` の placed fail-safe。`handPolicy` に dormant な capacity 候補定数（UI copy / layout に使わない） | `src/logic/catalog/*` のみ | unit、M98〜M100・M105・M108・M110 killed、boundary allow-list |
| **R5-d-2** dormant wiring | App: `trayHand` 派生（flag gate）+ render-phase 選択評価。GameScreen: relay。IngredientTray: optional `handIds`、hand mode のみ render-phase page reset。boundary（R5-c gate の意図的更新） | `App.tsx`、`GameScreen.tsx`、`IngredientTray.tsx`、boundary test | OFF 同値 E1〜E8、forced-on App test、I1 fuzz、M101〜M104・M106 killed、production tray byte 同一 |
| R5-d-3（OD-R5d-3 = C の場合） | `canAddPin`（placed ∪ pins < cap）、pantry に placedIds / capacity を渡す（dormant、文言なし） | `pinEdit.ts`、`IngredientPantry.tsx`、`GameScreen.tsx` | M109 killed、production DOM 不変 |
| R5-e | presentation（n/cap、3-state cue、配置ずみ、overflow 文言）・統合 Gate・G-c | — | IVP §9 |

HV: R5-d は production-visible 変更なし → Policy §2 により HV 動画対象外（R5-c と同じ扱い）。forced-on の見た目は R5-e / R6 の HV に含める。

## 18. Required Owner Decisions

| ID | 質問 | 推奨 | R5-d を止めるか |
|---|---|---|---|
| **OD-R5d-1** | #197 trigger の読み: **R-α**（tray の hand list が変わったら常に page 0 → page-level 評価）か **R-β**（現在 page の中身が変わった時だけ）か。差は T12（page 1 表示中に page 0 だけ変わる）のみ | **R-α**（§21.1 P3 の逐語、現在 page を知らずに判定でき A2 の純粋派生で実装可、tray API を変えない） | **はい**（transition 関数の定義そのもの） |
| **OD-R5d-2** | placed は capacity を超えても hand に保持するか（F-2: current code は evict、過去文書は保持） | **保持**（到達不能だが fail-safe。超過は pin のみ overflow） | いいえ（到達不能。R5-d-1 に含めるか否かだけ） |
| **OD-R5d-3** | capacity overflow 意味論: A / B / **C** / D | **C**（placed を保護し残り slot だけ pin 可、全 pin が必ず tray に載る） | いいえ（R5-d-2 は B のままでも正しい。R5-d-3 の前に必要） |

既決で再質問しない: OD-R5-1（12 は候補・R6 で確定）、OD-R5-2〜12、§21.1、OD-R5c-1〜5、OD-R2-2（new = acquisition 順）、HAND_ENFORCEMENT_ENABLED=false。

## 19. Risks / blockers

1. **F-1 を見落とした配線**（`handVisibleIds` を直接 tray へ）は placement ごとの page reset / 選択 clear を起こす。M98 と placement test で防ぐ。
2. render-phase 派生を App と tray の 2 箇所で行う → 同一 pure 関数・同一 signature を共有しないと食い違う（test + mutation で固定）。
3. R5-c の forced-on test は inactive fixture で「tray 不変」を証明している（F-3）。active fixture での再設計が必要。
4. forced-on e2e / HV の手段（IVP G-c）が未決（R5-e までに）。R5-d は unit / App test で足りる。
5. T18（編集→戻しで選択が戻らない）と「在庫 0 pin が slot を占有」は R6 HV の観察項目。
6. WebKit はこの container で未実行（R5-d 実装時は CI）。
7. blocker: なし（OD-R5d-1 の回答待ちのみ）。

## 20. R6 activation dependencies

`HAND_ENFORCEMENT_ENABLED = true` の前に: R5-d（tray 配線 + #197 page-level）・R5-e（presentation + 統合 Gate + G-c）完了、OD-R5d-1〜3 回答、**9 vs 12 を R6 real-device Human Feel Gate で確定（OD-R5-1）**、OD-R5c-5（keyboard 中の tile tap）実機判断、IVP §12.1 Gate（到達性・entry independence・#197・placed 保護・overflow・×0・順序安定・privacy・Dinner / guided / Lunch Rush 不変・iOS keyboard・WebKit green・HV 動画 + Owner Human Feel 承認・rollback = flag false で tray byte 同一）。R6 は flag 反転の 1 箇所で pin UI・capacity 表示・tray の hand 消費・page reset / #197 が同時に生きる設計（第 2 flag を作らない）。

---

**FINAL VERDICT: B. OWNER DECISION REQUIRED**

- 必須は **OD-R5d-1**（#197 trigger の読み R-α / R-β）のみ。R-α が承認されれば R5-d-1 / R5-d-2 は既存 authority と current code の範囲で実装可能（pure transition + render-phase 派生、OFF 同値は code 経路の非通過で担保）。
- OD-R5d-2（placed fail-safe）・OD-R5d-3（overflow = C）は R5-d の tray 配線を止めないが、R5-d-1 / R5-d-3 の範囲確定に必要。
- production 実装は開始していない。R5-e / R6 には進まない。
