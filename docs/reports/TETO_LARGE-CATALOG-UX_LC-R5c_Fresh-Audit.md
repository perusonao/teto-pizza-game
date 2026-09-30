# Large Catalog UX — LC-R5-c Fresh Audit（App-level pins / direct pin edit / 選択中 presentation）

**監査・設計のみ。** production code / CSS / state / save / e2e の変更なし。PR 作成なし。R5-c は未実装。
追加したのは measurement-only tooling（`tools/large-catalog-ux/r5c-geometry.measure.spec.ts` + config）と、その出力 `docs/reports/data/TETO_LARGE-CATALOG-UX_LC-R5c_GEOMETRY.json` のみ（CI / `npm run test:e2e` には含まれない）。
Human Verification: 対象外（Policy §2: 見た目・操作の変更なし）。

## 0. Audited state

| 項目 | 値 |
|---|---|
| audited `origin/main` | **`b35739ad51380d621d994e46f9876a007630e360`**（PR #310 = LC-R5-b merge） |
| 監査 branch | `claude/lc-r5c-fresh-audit`（`origin/main` から新規） |
| 参照 authority | LC-R5 Fresh Audit `b584b7a` §21（OD-R5-1〜12 + §21.1 #197 追加契約）、Implementation Verification Plan `855e9fb`（§4 表示 / 休眠、§7 R5-c、§9 R5-e）、R5-b Result（main）、`PROJECT_HANDOFF.md` Large Catalog UX 節 |
| 方法 | コード静的読解（下記 §1）+ Chromium 実レイアウトの計測 harness（4 viewport × normal / keyboard 300・338・380px、候補 UI は DOM probe で試作して実測）。`tsc -b` clean。production 挙動には一切触れていない |
| 状態確認 | `HAND_ENFORCEMENT_ENABLED = false`（`handPolicy.ts`）。`handSession` / `workingSet` / `selectionAfterVisibleChange` に production importer なし。pins / hand / #197 wiring / 選択中 strip なし。save schema 変更なし |

---

## 1. Fresh 再監査（コード事実）

| 対象 | 事実（main `b35739a`） | R5-c への含意 |
|---|---|---|
| `IngredientPantry` | `GameScreen` の `{pantryVisible && …}` で open 中のみ mount。local state = `activeShelf`、search（`value` / `applied` / `composing`）、`fieldFocused`。tile は read-only の `<li class="pantry-tile">`。props は `category / ownedIngredientIds / inventory / onClose` のみ | pin を local に持てない（close で消える）。tile を `<button aria-pressed>` 化する必要。pin は props で受け取り `onHandChange` で返す |
| search / IME | `showSearch = owned rows of category > 6`（production では topping 22 のみ。sauce 3 / cheese 4 は無し）。`applied` は composition 中に動かない。plain Enter は blur → list focus。Escape は field 内でも close（OD-R5-8） | **keyboard が出るのは TOPPING step だけ**（現 catalog）。62 catalog（sauce 10 / cheese 10）では 3 category とも出る |
| Mode C | `usePantryViewportFit`: field focus **または** vv が layout より ≥120px 小さい間 `pantry-sheet--fit`。高さ = `min(ceiling, vvH − safe-top − 8)`、bottom = vv bottom。keyboard 中も `padding-bottom: 12px + safe-area-bottom` は残る（R5-b risk 6） | keyboard 表示中の状態は `.pantry-sheet--fit` として **既に DOM 上で観測可能** → D 案の切替 signal に再利用できる（新しい viewport 監視は不要） |
| current geometry | sheet = ceiling（`100dvh − safe-top − 20`）。子 = header 44 / subtitle 17 / search 44 / chips 46 / list（flex 1）。gap 8、padding 12/12(+safe-bottom)。tile 71.2、row pitch 79.2、3 列 | §2 に実測 |
| `ShelfChips` | owned rows が ≥2 shelves のときのみ。`role=group` の `aria-pressed` toggle。text 非依存 | 「選択中」を chip 化する案（E3）は filter 意味論になる（§4） |
| result list | 唯一の縦 scroller。text / shelf 変更で `scrollTop = 0`。0 件文言は中立 | pin toggle で scrollTop を動かしてはならない |
| R2 `HandSession` | `Record<sauce|cheese|topping, string[]>`。`addToHand`（owned ∧ category のみ受理、順序保持、**在庫 0 も受理**、上限なし）/ `removeFromHand` / `replaceHand` / `pruneHand` / `sanitizeHandSession`。`resolveHand` は非 eligible で `null` | 在庫 0 の新規 pin 拒否（OD-R5-6）は **pantry（UI 層）guard**。pure 層は変更不要 |
| `workingSet` | owned ≤ capacity なら `active:false` で全 owned を catalog 順。`handCapacityFor` は enforcement OFF で owned 数を返す ⇒ **常に inactive** | enforcement OFF では「手元（自動）」cue は全 tile 該当 = 無意味。R5-c の cue は **pinned / 非 pinned の 2 状態**で足りる |
| `selectedIngredientId` / #197 | `App` 所有。roundKey 変更で null、making step 変更で SAUCE なら primary sauce / 他 null。`IngredientTray.goToPage` が page-level clear（#197）。pantry は selection に触れない | R5-c の pin 操作は tray の visible set を変えない（§6） |
| `GameScreen` / `App` | `GameScreen` は `screen === "GAME"` の間だけ mount。`pantryOpen` は GameScreen local。Full Game Reset は reload | pins は **App** に置く必要（OD-R5-9）。reset は reload なので自動的に空 |
| FREE eligibility | `isLargeCatalogEligible` = `roundKind === "FREE_COOK" && dinner === null`。`pantryAvailable = eligible ∧ PREPARE ∧ step≠DOUGH ∧ pantryWorthwhile` | Dinner / guided / Lunch Rush では pantry 自体が出ない ⇒ pin UI も到達不能 |
| inventory | `remainingStock` を pantry が表示（`×n` / `∞`）。0 は `--zero` | 在庫 0 tile は `aria-disabled` + 可視文言（色だけに頼らない） |
| ownership の変化 | session 内では purchase による追加のみ（`nextOwnedIngredientIds`）。縮小は Full Reset（= reload）だけ | prune は防御的（render 時の derive で十分、effect 不要） |
| save / persistence | `persistence.ts` は progression のみ。cooking-round state は保存されない | pins を save / localStorage に書かない（boundary test で固定） |

---

## 2. Geometry（Chromium 実測、topping step、22 topping 所持、search + chips 表示）

Keyboard は R5-b と同じ simulated `visualViewport`（Chromium は iOS keyboard を描けない）。K = 338 は R5-b Discovery の実機値（714→376）、300 / 380 は感度。**実機値ではない**ことに注意（§9 risk）。全データ: `docs/reports/data/TETO_LARGE-CATALOG-UX_LC-R5c_GEOMETRY.json`。

### 2.1 Normal（keyboard なし）

| viewport | sheet y / h | header | subtitle | search | chips | list | tile / pitch | 完全表示行 | safe margin（sheet top） |
|---|---|---|---|---|---|---|---|---|---|
| 390×844 | 20 / 824 | 44 | 17 | 44 | 46 | 617 | 71.2 / 79.2 | 7 | 20 |
| 360×800 | 20 / 780 | 44 | 17 | 44 | 46 | 573 | 71.2 / 79.2 | 7 | 20 |
| 390×664 | 20 / 644 | 44 | 17 | 44 | 46 | 437 | 71.2 / 79.2 | 5 | 20 |
| 360×640 | 20 / 620 | 44 | 17 | 44 | 46 | 413 | 71.2 / 79.2 | 5 | 20 |

固定 chrome = padding 24 + header 44 + subtitle 17 + search 44 + chips 46 + gap 8×4 = **207px**（safe-area 0 の場合）。page scroll なし（全 case）。

### 2.2 Keyboard（field focus、Mode C fit）— list の可視高 / 完全表示行

| viewport | K=300 | **K=338** | K=380 | sheet（K=338）y→bottom / h |
|---|---|---|---|---|
| 390×844 | 329 / 4 | 291 / 3 | 249 / 3 | 8 → 506 / 498 |
| 360×800 | 285 / 3 | 247 / 3 | 205 / 2 | 8 → 462 / 454 |
| 390×664 | 149 / 1 | 111 / 1 | **69 / 0** | 8 → 326 / 318 |
| 360×640 | 125 / 1 | **87 / 1** | **45 / 0** | 8 → 302 / 294 |

### 2.3 Keyboard budget（hard requirement）

- **Hard floor**: 1 tile 完全表示 = list 可視高 ≥ **71.2px**。**実用基準**: ≥ 79.2px（1 row pitch。次行の頭が見えて scroll 可能と分かる）。
- 360×640 / K=338 の現状: 87px ⇒ **余裕 15.8px**（hard floor）/ 7.8px（実用基準）。390×664 / K=338: 111px ⇒ 余裕 39.8px。
- ⇒ **keyboard 表示中に独立した行を 1 本でも足す案（gap 8 + 高さ ≥ 8px）は、他の何かを外さない限り 360×640 で成立しない。** 44px strip（+8 gap = 52）は 390×664 でも 59px ⇒ 0 行で不成立。
- 回収可能な予算（keyboard 中のみ、候補）: subtitle 行 25px（17 + gap 8）、chips 行 54px、safe-area-bottom padding（ホームインジケータ機で最大 34px。360×640 級＝ホームボタン機では 0 なので **最小 viewport の解決にはならない**）。
- 既存の限界（R5-c と無関係、報告のみ）: K=380 では現状でも 390×664 / 360×640 が 0 行。R5-b の実機 HV は PASS 済みで、実機 keyboard がこれより低いことを示唆するが、日本語 keyboard + 予測変換バーの機種差は未測定（§9）。

---

## 3. 選択中 / pinned UI 案の実測比較（DOM probe による試作、実レイアウト）

list 可視高 px / 完全表示行。**太字 = hard floor 不成立**。

| 案 | 構成 | 390×844 normal | 360×640 normal | 390×664 K338 | **360×640 K338** | 360×640 K300 |
|---|---|---|---|---|---|---|
| 現状 | pin UI なし | 617 / 7 | 413 / 5 | 111 / 1 | 87 / 1 | 125 / 1 |
| **A** 固定 strip | 44px 行（pin ≥1 の間） | 565 / 7 | 361 / 4 | **59 / 0** | **35 / 0** | 73 / 1 |
| **B** compact summary | 32px 行 | 577 / 7 | 373 / 4 | 71 / 1※ | **47 / 0** | 85 / 1 |
| B′ | 24px 行 | 585 / 7 | 381 / 4 | 79 / 1 | **55 / 0** | 93 / 1 |
| **C** header 統合 | header 内 44×44 control、行追加 0（header 高 44 のまま） | 617 / 7 | 413 / 5 | 111 / 1 | 87 / 1 | 125 / 1 |
| **D** normal=A / keyboard=非表示 | normal は A、`--fit` 中は strip slot なし | 565 / 7 | 361 / 4 | 111 / 1 | 87 / 1 | 125 / 1 |
| D + subtitle 統合 | D に加え category 名を title へ（subtitle 行廃止） | 590 / 7 | 386 / 4 | 136 / 1 | 112 / 1 | 150 / 2 |
| E1 | 44px strip が subtitle 行を置換 | 590 / 7 | 386 / 4 | 84 / 1 | **60 / 0** | 98 / 1 |
| E2 | 32px compact が subtitle 行を置換 | 602 / 7 | 398 / 5 | 96 / 1 | 72 / 1※ | 110 / 1 |
| E3 | ShelfChips 行の先頭に「📌 選択中」chip（行追加 0） | 617 / 7 | 413 / 5 | 111 / 1 | 87 / 1 | 125 / 1 |
| K3 | keyboard 中 strip 44 を残し subtitle + chips を隠す | — | — | 138 / 1 | 114 / 1 | 152 / 2 |

※ 71–72px = hard floor ちょうど（余裕 ≤ 1px、実用基準 79.2 未満）⇒ 実用上 **不成立扱い**。

### 3.1 観点別比較

| 観点 | A 固定 strip | B compact summary | C header 統合 | D normal 詳細 / keyboard 非表示 | E3 ShelfChips 内 chip |
|---|---|---|---|---|---|
| normal viewport | ◎ 全 pin を 44px chip で一覧（390×844 で 7 行維持） | ○ 32px では 44px tap target 不可 → 表示専用か一覧不足 | △ 一覧は別操作（popover / 別 view） | ◎（= A） | △ filter を押すまで一覧されない |
| small viewport（normal） | ○ 360×640 で 5→4 行 | ○ 4 行 | ◎ 5 行 | ○ 4 行（subtitle 統合併用で 4 行 / 386px） | ◎ 5 行 |
| **keyboard（360×640）** | **✕ 0 行** | **✕ 0 行**（24px でも 0 行） | ◎ 1 行 / 87 | ◎ 1 行 / 87（subtitle 統合で 112） | ◎ 1 行 / 87 |
| pin の発見性 | ◎ 常時 | ○ | △ header の小さな control | ○ 通常時 ◎、keyboard 中は tile badge のみ | △ filter の 1 つに見える |
| pin 解除 | ◎ strip の ✕ / tile 再タップ | △（32px は 44px 未満。tile 再タップ依存） | △ 2 タップ以上 | ◎ 通常時 strip / 常時 tile 再タップ（keyboard 中も tile で可） | ○ filter → tile 再タップ |
| accessibility | ◎ `role=group` + 各「〇〇を外す」button | △ target 不足 | ○ 1 control + 展開先 | ◎（keyboard 中も tile の `aria-pressed` で状態・解除とも到達可） | △ filter と状態表示の二重意味 |
| #197 整合 | ◎ selection と別 state | ◎ | ◎ | ◎ | ◎ |
| 実装複雑度 | 小 | 小〜中 | 中（展開 UI） | 小〜中（`--fit` class で CSS 切替 1 つ） | 中（ShelfChips の意味拡張、chip 無し category 用の fallback 行が必要） |
| 62+ ingredients | ○ 横 scroll（pin 数上限は R6 の capacity まで無し） | △ 要約に数を出すと count 問題（OD-R5-7） | ○ | ○ | ✕ sauce / cheese は shelf 1 つで chip 行が無い → 行追加が必要 |
| 既存 authority との関係 | OD-R5-5「pin 存在中のみ」◎ | — | **OD-R5-5「collapsible 不採用」に抵触の恐れ**（一覧が畳まれた状態が既定） | OD-2「never hidden」/ OD-R5-5「collapsible 不採用」の**解釈確認が必要**（自動・一時的な keyboard 中のみの非表示で、ユーザー操作の collapse ではない） | **OD-2「pinned 選択中 area・never hidden」に抵触**（filter 意味論） |

### 3.2 結論（推奨、確定ではない）

- **A / B / E1 は hard requirement 不成立**（360×640 keyboard で 0 行）。A は 390×664 keyboard でも不成立。
- 成立するのは **C / D / E3**（と D の subtitle 統合版）。C は collapse 相当、E3 は filter 相当で、どちらも既存 Owner 決定と正面から衝突する。
- **推奨: D（normal = 44px 固定 strip / keyboard 表示中 = strip slot を出さず tile の 📌 badge + `aria-pressed` のみ）**。切替 signal は既存の `.pantry-sheet--fit`（Mode C）だけを使い、新しい viewport 監視を増やさない。
- **任意の追加 lever: subtitle 統合**（category 名を title 行へ移し subtitle 行 25px を常時回収）。keyboard 余裕が 15.8 → 40.8px になり、日本語 keyboard の機種差に対する保険になる。R5-b で HV 済みの header 見た目を変えるため Owner 判断（OD-R5c-4）。
- keyboard 中の strip 非表示で失う機能はない（状態は tile badge と `aria-pressed`、解除は tile 再タップ）。失うのは「search / shelf で隠れた pin の一覧」だけで、keyboard を閉じれば戻る。

---

## 4. R2 HandSession 再監査

- API は R5-c に十分。**pure 層の変更は不要**（R2 テストを壊さない）。
- `addToHand` は上限なし・在庫 0 受理。R5-c の UI guard: ① 在庫 0 の **新規** pin 拒否（OD-R5-6、pantry 側）、② 容量超過ブロックは R6（capacity UI は production 非表示、OD-R5-7）。enforcement OFF の R5-c では **pin 数上限なし**（22 全部 pin も可）→ strip は横 scroll 前提。
- `pruneHand` / `sanitizeHandSession`: session 内で ownership は増えるだけなので、prune は **render 時の derive**（`acceptable()` 相当）で行い、App state を effect で書き換えない。
- 3-state cue（手元に固定 / 手元 / 印なし、audit §8.3）: enforcement OFF では `workingSet` が常に inactive で「手元」が全 tile に該当するため、**R5-c は pinned / 非 pinned の 2 状態**。3 状態は R6 で active になった時点で意味を持つ。
- placed 保護（placed は pin 解除不可・capacity 消費）: enforcement OFF では hand が inactive で placed の概念が表示に効かない。**R5-c では placed を pin 操作から除外しない**（pin は placed と独立に付け外し可能）。placed 保護 UI は R6（R5-d の placedIds 出所 = `state.pizza.sauceIds` + `state.pizza.toppings[].ingredientId` は確認済み）。

## 5. App-level lifecycle 案（OD-R5-9 準拠）

```
App
  const [handSession, setHandSession] = useState<HandSession>(emptyHandSession)   // save / storage に書かない
  roundKey 変更 / making step 変更 / setScreen("HOME") / START_FREE_COOK        → 触らない（保持）
  Full Game Reset                                                             → reload なので自動的に空
  GameScreen props: handSession, onHandChange(next)    // GameScreen は中継のみ、書き換えない
GameScreen
  eligible（isLargeCatalogEligible）かつ pantryVisible のときだけ pantry に渡す
  handEditing = HAND_ENFORCEMENT_ENABLED（IVP §4）または true（OD-R5c-1 の結論次第）
IngredientPantry
  pins = handSession[category] ∩ owned（derive）。tile tap → addToHand / removeFromHand → onHandChange
```

- 唯一の writer = pantry の tap handler（`onHandChange`）。`GameScreen` / `IngredientTray` は書かない。
- Dinner / guided / Lunch Rush: pantry が mount されないので書き込み経路なし。R5-c では tray が pin を読まない（R5-d 以降）ので読み込み経路もなし。隔離テスト: FREE で pin → HOME → Dinner round → tray DOM が pin 前と同一。
- テスト: round 終了 / HOME / FREE 再開を跨いで保持、App 再 mount（reload 相当）で空、非 eligible で state 不変、storage / persistence への書き込みゼロ（boundary）。

## 6. Pin direct-edit contract（Model D）

1. tile = `<button type="button" aria-pressed>`（`<li>` の中）。`click` で toggle（`pointerdown` にしない: list の touch scroll で toggle しない）。
2. 非 pinned + 在庫 > 0 → `addToHand(session, [id], ctx)`。非 pinned + 在庫 0 → 何もしない（`aria-disabled="true"` + 可視「ざいこなし」、色だけに頼らない）。pinned → `removeFromHand`（在庫 0 でも常に解除可）。
3. pin 順 = 付けた順（strip の並び）。list は catalog 順のまま（pin で並び替えない、scrollTop 不変）。
4. pin は shelf / search / close で消えない（OD-2）。search / shelf の状態は pin で変わらない。
5. pantry は `selectedIngredientId` を set / clear しない。placement は tray のみ。
6. 追加 UI: 「おまかせに戻す」（全 pin 解除 = `replaceHand(session, [], ctx)`）は strip 内。keyboard 中は出さない（D）。
7. keyboard 表示中の tile tap: iOS で field が blur するか（keyboard が閉じて Mode C が解除され、D では strip が同じ reflow で現れる）は **実機 HV 項目**。✕ と同じ `pointerdown` preventDefault で focus を保つ設計も可能だが、scroll / VoiceOver への影響が未検証のため本監査では決めない（§10 OD-R5c-5）。

## 7. #197 impact

- enforcement OFF ⇒ `handCapacityFor` = owned 数 ⇒ hand inactive ⇒ **tray の visible set は pin で一切変わらない** ⇒ §21.1 により clear 判定は発火しない。
- R5-c で wiring する #197 コードは **なし**（page-level helper と page 0 reset は R5-d）。R5-c が保証すべきは「pin 操作で `onClearSelection` が 0 回、tray DOM と page index が不変」だけ。
- テスト: tray page 2 の材料を選択 → pantry で pin add / remove / おまかせに戻す / search / shelf → close → 選択と page が保持（unit + e2e）。mutation: pin 操作で `onClearSelection` を呼ぶ / page を 0 に戻す。

## 8. Privacy / Accessibility

**Privacy**: pin 対象・strip・badge は OWNED ingredient のみ（`queryCatalog` の owned rows 由来）。recipe / matcher / hint5 / discovery / near-miss を import しない（boundary allow-list: pantry は `handSession` の操作のみ追加）。strip / summary / header に **数字を出さない**（「選択中 n」も出さない。OD-R5-7 は capacity UI を R6 まで非表示、pin 数単体も count surface として扱う）。pin 順・pin 集合はどこにも保存・送信しない。未発見 recipe・隠れた必要材料・Hint5 答え・候補 recipe を推測できる情報は増えない（pin は player 自身の選択の反映のみ）。

**Accessibility**: tile `aria-pressed` + accessible name に在庫（既存）。在庫 0 は `aria-disabled` + 可視文言。strip = `role="group" aria-label="選択中の材料"`、各項目は「〇〇を外す」button（44px）。D の keyboard 中非表示は CSS（`display:none`）で a11y tree からも外れる（状態は tile 側に残る）。focus 順: 閉じる → search → ✕ → chips → strip → list（strip 無し時は chips → list）。pin toggle 後も focus は tile に留まる。count を読み上げる live region は作らない。`prefers-reduced-motion` で新規 animation なし。

## 9. Risks

1. **simulated keyboard**: 数値は Chromium の simulated visual viewport。360×640 級実機（SE 系）+ 日本語 keyboard + 予測変換バーの実高は未測定。K=380 相当なら現状でも 0 行（R5-b 既存の限界）。
2. **D の reflow**: keyboard 解除時に sheet 高の復帰と strip 出現が同じ reflow で起きる。tile tap 直後の list 位置移動が誤タップを誘うか（実機 HV）。
3. **authority 解釈**: D の「keyboard 中のみ非表示」が OD-2「never hidden」/ OD-R5-5「collapsible 不採用」の範囲内か（Owner 判断）。
4. **production 露出**: IVP §4 は pin UI を production で休眠（`handEditing = HAND_ENFORCEMENT_ENABLED`）と読んだ。今回の依頼文は「視認性を導入」とあり、§21 逐語が production 非表示を明示するのは capacity UI のみ。**pin UI を production に出すと「pin しても tray が変わらない」inert UI になる。**
5. pin 数上限なし（enforcement OFF）: 22 pin の strip は横 scroll が長い。R6 の capacity で自然に上限。
6. safe-area-bottom padding が keyboard 中も残る（R5-b risk 6）。最小 viewport の予算には効かないが、ホームインジケータ機では 34px を無駄にしている。
7. WebKit は CI のみ。本監査の計測は Chromium のみ。

---

## 10. Owner Decisions required

| ID | 問い | 推奨 |
|---|---|---|
| **OD-R5c-1** | R5-c の pin UI（tile toggle / 📌 badge / 選択中 strip）を **production に表示するか**。(X) 休眠: `handEditing = HAND_ENFORCEMENT_ENABLED`、forced-on テストで検証、R6 で一斉に有効（IVP §4 の読み）/ (Y) 表示: pin は保存・表示されるが tray に効かない | **X（休眠）**。Y は「操作したのに効かない」UI を production に出す。反転は 1 箇所（IVP §4.5） |
| **OD-R5c-2** | 選択中 UI の方式: A / B / C / D / E | **D**（normal = 44px 固定 strip、keyboard 表示中 = strip 非表示・tile badge のみ）。A / B / E1 は hard requirement 不成立 |
| **OD-R5c-3** | D の keyboard 中非表示は OD-2「never hidden」/ OD-R5-5「collapsible 不採用」と両立すると認めるか（ユーザー操作の collapse ではなく、Mode C 中の自動・一時的な非表示。pin 状態は tile に常時表示） | **両立と認める**（認めない場合は C / E3 も同じ authority と衝突するため、subtitle + chips の keyboard 中非表示 K3 を検討 = DESIGN REVISIT） |
| **OD-R5c-4** | subtitle 行を廃止し category 名を title 行へ統合（常時 25px 回収、keyboard 余裕 15.8 → 40.8px） | **採用推奨**（任意。R5-b HV 済みの header 見た目が変わるので HV 対象） |
| **OD-R5c-5** | keyboard 表示中の tile tap: keyboard を閉じる（既定の blur）か、focus を field に保つ（連続 pin 可） | **実機 HV で決める**（既定は blur のまま実装、差し替えは 1 箇所） |

既決で再質問しない: Model D（OD-R5-2）、pins + deterministic fill（OD-R5-3）、active category（OD-R5-4）、在庫 0 新規 pin 不可（OD-R5-6）、capacity UI 非表示（OD-R5-7）、App-level session-only（OD-R5-9）、hint 連携なし（OD-R5-11）、`HAND_ENFORCEMENT_ENABLED=false`（OD-R5-12）、#197 §21.1、capacity 9 / 12 は R6。

## 11. Implementation slice proposal（Owner go 後）

| slice | 内容 | 変更予定 | 検証 |
|---|---|---|---|
| **R5-c1** state | App-level `HandSession` + `onHandChange`、GameScreen 中継、`handEditing` seam（OD-R5c-1 の値） | `App.tsx`、`GameScreen.tsx` | lifecycle unit（round / HOME / FREE 再開 / 再 mount で空）、Dinner 隔離、storage 書き込み 0、`HAND_ENFORCEMENT_ENABLED === false` |
| **R5-c2** tile toggle | tile の button 化、pin add / remove、在庫 0 guard、📌 badge + `aria-pressed`、#197 非発火 | `IngredientPantry.tsx`、`App.css` | unit + mutation（在庫 0 受理 / 未所持 add / pin で selection clear / scrollTop 変化 / storage 書き込み）、touch-scroll で toggle しない e2e |
| **R5-c3** 選択中 presentation | 方式 D（OD-R5c-2/3）、（OD-R5c-4 なら subtitle 統合）、おまかせに戻す | `IngredientPantry.tsx`、`App.css` | forced-on e2e 4 viewport × normal / keyboard（**360×640 K338 で ≥1 行、実用 ≥79.2px を assert**）、sheet 外形不変、数字なし DOM scan、HV（390×844 動画 + before/after screenshots、休眠なら forced-on build） |

各 slice で Vitest 全体、mutation gate（M83〜）、Chromium e2e（既存 pantry search / shell / shelves / dinner / lunch rush）を再実行。R5-d（tray の hand 消費 + page-level #197）と R6（enforcement）は範囲外。

---

## FINAL VERDICT

**B. OWNER DECISION REQUIRED**

- 360×640 keyboard の hard requirement（≥1 result row）を実測で確認した結果、従来想定の固定 strip（A）・compact summary（B、24px でも）・subtitle 置換（E1）は **0 行で不成立**。成立するのは C / D / E3 のみで、いずれも既存 Owner 決定（OD-2「never hidden」/ OD-R5-5「collapsible 不採用」）の解釈確認が要る。
- 推奨は **D**（+ 任意で subtitle 統合）。加えて、pin UI を R5-c の production に出すか（OD-R5c-1）が IVP §4 と今回の依頼文で読みが分かれるため Owner 確認が必要。
- OD-R5c-1〜3 が決まれば R5-c1〜c3 はそのまま着手可能（設計の作り直しは不要）。
