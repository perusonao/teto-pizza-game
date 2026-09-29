# Large Catalog UX — LC-R5 Implementation & Verification Plan (R5-a 〜 R5-e, iPhone HV, R6 9-vs-12 Gate)

**docs / test-planning only.** production code 0 / save 0 / test 実装 0 / e2e 0 / runtime 0 変更。PR 作成なし。LC-R5 production 実装なし。
Human Verification: 対象外（Policy §2: docs-only）。本書は R5 各スライスの HV 計画（§8）を定めるだけで、動画・スクリーンショットは撮らない。

## 0. Fresh state と authority の実在確認

| 項目 | 値 |
|---|---|
| Audited `origin/main` | **`12725eb`**（PR #306 LC-R4 merge。fresh fetch 済み） |
| 作業 branch | `claude/lc-r5-implementation-verification-jo557t`（`origin/main` から作成、docs のみ） |
| PR #306 post-merge WebKit | 本書作成時点では未確認（本タスクの前提「待ち」）。**R5-a 着手ゲート（§1）に入れる** |
| テスト実行 | なし（docs-only。数値はすべて LC-R4 Result / 既存 e2e の記載値を引用） |

### 0.1 ⚠ 依頼文が挙げた authority のうち、repo 上に実在しないもの

`main`・全 remote branch（`origin/main` と本 branch のみ）・open PR 一覧（20 件）・Issue #269（コメント 0）を read-only で検索した結果:

| 依頼文の authority | 実在 | 根拠 |
|---|---|---|
| **LC-R5 Fresh Audit** | **無い** | `docs/reports/` に R5 audit なし。R4 audit と Result が「R5 Fresh Audit で決める」と**前方参照**しているだけ |
| **OD-R5-1〜12 Owner Authority** | **無い** | `git grep "OD-R5-"` は Dinner の別物 `OD-R5`（DM-3R、全 OWNED tray）にしかヒットしない。`PROJECT_HANDOFF.md` にも記録なし |
| #197 追加契約 | **部分的** | 実在するのは PR #197 のコード契約（`IngredientTray.goToPage`）と `PROJECT_HANDOFF.md` の OD-B1 / OD-2 / 「#197 in R4」。「追加契約」を集めた文書は無い |
| LC-R0〜R4、handPolicy / handSession / workingSet、Pantry / Tray / GameScreen、e2e / layout、Hint 5.0 privacy | **有る** | 各 §で引用 |

**本書の扱い:** 存在しない OD-R5-1〜12 の内容を推測で補って「Owner 決定済み」と書くことはしない。依頼文の箇条書き（search AND shelf、Escape、pin add/remove、inventory 0 拒否、page 0、`HAND_ENFORCEMENT_ENABLED=false` 維持 など）は **「依頼文要件 B-n」** として扱い、repo 上の既存 authority（OD-1 / OD-2 / OD-R2-x / OD-R4-x / OD-B1〜B5 / LC-OD-x）と矛盾しない範囲で計画に落とした。矛盾・未確定は §10 の Owner Decision 表に**明示**した。OD-R5-1〜12 が別の場所（Owner の手元メモ等）にあるなら、実装開始前に `PROJECT_HANDOFF.md` へ転記して本書と突き合わせること（§10 D0）。

## 1. R5 着手ゲート（全スライス共通）

1. #306 post-merge の Deploy / E2E WebKit が green（未 green なら R5-a に入らない）。
2. `main` が本書の audited SHA から動いていたら、§2 の「現状の事実」表の行番号 / 文言を再確認（fresh fetch）。
3. §10 D0（OD-R5-1〜12 の記録）と、各スライスの「着手前に必要な決定」が閉じている。
4. 各スライスは**別 branch・別 PR**（Owner go ごと）。WebKit は sandbox で走らないので、CI の WebKit Gate を毎スライスの merge 条件にする（R3 で cross-engine の絶対 px 比較が落ちた教訓: in-run 比較 + 広い範囲のみ）。
5. 全スライス共通の不変条件（§9 の回帰ゲートで常時 assert）:
   - `HAND_ENFORCEMENT_ENABLED === false`（`handPolicy.ts` の const）。R5 では反転しない。
   - capacity（9 / 12）の文字・数・UI を production に出さない。
   - save / `GameState` / Firebase / ranking に何も足さない（LC-OD-5 session-only）。
   - Dinner / guided / Lunch Rush の tray・dock・stage は R5 前後で同一。
   - counts なし（Phase 5 まで。OD-B / `familyCounts` 未使用）。
   - Hint 5.0 privacy contract 不変（OD-B5）。

## 2. 現状の事実（main `12725eb` で確認）

| 領域 | 事実 | 場所 |
|---|---|---|
| pantry entry 出現条件 | `isLargeCatalogEligible(state) && phase==="PREPARE" && makingStep!=="DOUGH" && dockReserve.pager` — **pager に依存**（OD-R4-3 が R5 で分離せよと指定） | `GameScreen.tsx:326-327` |
| `dockReserve.pager` | round のいずれかの step で `trayIngredientsFor(...).length > 6`（`MAX_INGREDIENT_PALETTE_SLOTS = 6`）。round 単位で固定 | `prepareDock.ts` |
| tray の pager 行 | `pantryEntry && (pageCount>1 \|\| reservePagerRow)` の分岐で、`pageCount<=1` なら pager は `aria-hidden` の placeholder、entry だけが残る**構造は既にある** | `IngredientTray.tsx:500-540` |
| tray の page | `IngredientTray` **ローカル** `useState(0)`。`goToPage` が「離れる page に選択があり、行き先 page に無い」場合のみ `onClearSelection` | `IngredientTray.tsx:163, 337-352` |
| tray の item 源 | `trayIngredientsFor(category, {owned, freeCook, recipe})`。**hand / working set を一切読まない**（未配線） | `prepareDock.ts` / `IngredientTray.tsx:159` |
| hand policy | `HAND_ENFORCEMENT_ENABLED = false`。`handCapacityFor` は enforcement OFF で `max(1, owned)` を返す → `selectWorkingSet` は inactive（= 今の tray） | `handPolicy.ts` |
| HandSession | pure。category 別 `readonly string[]`。`addToHand` は OWNED かつ category 一致のみ受理し、**在庫 0 も受理**（LC-OD-17 は「自動 source のみ 0 を除外」）。`removeFromHand` / `replaceHand` / `pruneHand` あり。**App / GameScreen のどこにも未配線** | `handSession.ts` |
| working set | placed > pinned > hint > favorite > recent > new > fill。自動 source は在庫 0 を skip。pinned が capacity を超えると `overflowIds` | `workingSet.ts` |
| `selectionAfterVisibleChange` | pure。`visibleBefore` に居て `visibleAfter` に居なければ null、それ以外は据え置き。**未配線**（R4 boundary test が import を禁止） | `handSession.ts` |
| query | `queryCatalog({shelves, text, only, sort, zeroStockLast})` は AND 合成済み。`matchesSearch` は NFKC / カタカナ→ひらがな / 長音・中黒・空白除去、name + reading。OWNED のみ返す | `catalogQuery.ts` / `catalogText.ts` |
| pantry | category 別・OWNED のみ・read-only。ShelfChips は represented shelves ≥ 2 で固定 slot。`activeShelf` はローカル state（閉じると unmount → reopen で「すべて」）。Escape は sheet の `onKeyDown` で常に close。sheet = `position: fixed; bottom: 0; max-width: 390px; height: min(70dvh, 100dvh − safe-top − 20px)`、header 固定、`.pantry-sheet__list` のみ scroll | `IngredientPantry.tsx` / `App.css:6256` |
| selection state | `selectedIngredientId` は **App.tsx の `useState`**（`App.tsx:224`）。pantry・pins とは別 state（OD-2） | |
| mutation gate | M1〜M50（**52/52 killed**、R4 時点）。次の空き番号は **M51** | `tools/large-catalog-ux/mutation-check.mjs` |
| e2e | `large-catalog-pantry-shell.spec.ts` / `large-catalog-pantry-shelves.spec.ts`（4 viewport: 390×844, 360×800, 390×664, 360×640）、`layout-contract.spec.ts`（7 profile: N390 / N360 / P390i / S390 / S360 / E390i / E360i）、`stage-size-stability.spec.ts`、`layout-invariants-lb.spec.ts`、`hand-capacity.measure.spec.ts`（9/12 計測ハーネス、`tools/large-catalog-ux/`） | |
| R4 実測（引用） | sheet 高: 590.8 / 560 / 464.8 / 448。chip slot 費用 54px。list 高（chip 無）: 489.8 / 459 / 363.8 / 347 | R4 Result |

## 3. 全体設計方針（R5-a〜e を貫く 6 原則）

1. **表示可否は「今の tray の見え方」ではなく「所持数」で決める。** pantry の出現は pager / hand / pin / stock のどれにも依存しない（OD-R4-3）。
2. **enforcement OFF の production では tray は 1 px も動かない。** hand → tray の配線は、enforcement を明示引数で受ける pure 関数に閉じ込め、`GameScreen` は常に「OFF」を渡す。テストだけが「ON」を渡せる（seam、§4.6）。
3. **pantry の状態（検索文字・shelf・scroll）は pantry ローカルで、閉じると消える**（OD-R2-3 / OD-R4-2）。GameState に上げない。
4. **pin は HandSession（App レベル・session-only）、選択は `selectedIngredientId`（App レベル）、pantry の一時状態は pantry ローカル — 3 つは別 state**（OD-2）。
5. **Eligibility は `isLargeCatalogEligible` のみ**（`freeCook` / `recipeFreeTray` 禁止、OD-B4）。全ハンドラは非 eligible で no-op。
6. **privacy**: pantry / pin / search は OWNED の行だけを見る。recipe・matcher・hint・near-miss・Dinner target を import しない。hint source は `NO_DISCLOSED_HINTS` のまま。

---

## 4. R5-a — Pantry availability を pager availability から分離

### 4.1 目的と範囲
`GameScreen.pantryAvailable` の `dockReserve.pager` 依存を外す。**production の見た目・寸法は R5-a 単体では変化 0**（§4.3 の等価性）。効果は「将来 enforcement で pager が消えても entry が残る」ことの先行保証。

### 4.2 設計

**(1) `pantryWorthwhile` — 新しい pure authority**（`src/logic/catalog/pantryAvailability.ts`、catalog 配下の pure module。`prepareDock.ts` は `data/` を既に import しているので依存方向は許容）

```
pantryWorthwhile({ steps, ownedIngredientIds, catalog? }) : boolean
  = steps のうち SAUCE/CHEESE/TOPPING の少なくとも 1 つで
    「その category の OWNED 数 > MAX_INGREDIENT_PALETTE_SLOTS (6)」
```
- 入力は **所持数のみ**。hand・pin・在庫・recipe・enforcement・page を読まない。
- round 単位（step の集合）で判定 → 現行 `pager` と同じ粒度なので step 間で entry が出たり消えたりしない。
- 「owned > 6」は **「1 page の tray に全部載らない」= 検索・shelf・pin の価値が出る最小条件**（依頼文要件 B-1: pantryWorthwhile authority）。閾値は §10 D-a1 で確認（既定: 6）。

**(2) `prepareDockReserve` に `utilityRow` を追加**（`pager` は残す）
```
PrepareDockReserve { sauceRows, otherRows, pager, readout, utilityRow }
utilityRow = pager || (eligible && pantryWorthwhile)
```
- `pager` の意味は「tray が 2 page 以上」のまま（page nav を出すか）。`utilityRow` は「pager 行の**場所**を確保するか」。
- `prepareDockReserve` は Dinner（`freeCook: recipeFreeTray`）からも呼ばれるため、**eligible 判定を引数で受ける**（`largeCatalogEligible: boolean`、既定 false）。非 eligible では `utilityRow === pager` を保証。
- CSS 変数 `--dock-pager` / class `prepare-dock--no-pager` は**値の意味を「utility 行あり/なし」に読み替えるだけ**で名前・CSS は変えない（R5-a は App.css を触らない方針。触る場合は append-only）。

**(3) `GameScreen`**
- `pantryAvailable = isLargeCatalogEligible(state) && phase==="PREPARE" && makingStep!=="DOUGH" && pantryWorthwhile(...)`（`dockReserve.pager` を外す）。
- `IngredientTray` へは `reservePagerRow={dockReserve.utilityRow}`。tray 側は既に「`pantryEntry` があり `pageCount<=1` なら pager を placeholder にして entry だけ出す」構造なので、**`IngredientTray.tsx` の変更は prop 名の意味づけ（コメント）のみ**にできる見込み。entry が無い（非 eligible）分岐の `reservePagerRow ? placeholder` は**従来の `pager` で駆動**（Dinner/guided/Lunch は完全に従来のまま）。

### 4.3 「pager が消えても entry が残る」ケースの具体化
production（enforcement OFF）では実現しない（等価性: `eligible ⇒ pantryWorthwhile ⇔ legacy pager`）。将来 ON になったときの実ケース:
| # | ケース | 旧 gate | 新 gate |
|---|---|---|---|
| E1 | owned 20 / 在庫 0 が 14 → active hand は自動 source が在庫 0 を skip するので **hand 6 以下** → tray pager 不要 | entry 消滅（**禁止**, OD-R4-3） | entry 残る |
| E2 | capacity 候補が将来 ≤ 6 に変わった | 同上 | 残る |
| E3 | pin だけで hand 構成が変わり page 数が 1 になった | 同上 | 残る |
| E4 | owned 7 の category を持つ round（pager true）で、別 step の owned が 3 | 変化なし | 変化なし |

### 4.4 stage / dock Δ0 の証明方法
- **等価性テスト（pure）**: owned 集合を網羅（category 別 0〜22 個、境界 6/7）× freeCook × enforcement(false) で `pantryWorthwhile === legacyPager`（eligible の時）を全件 assert。→ production で dock 高さが変わり得ないことの**機械的証明**。
- **golden 表**: 非 eligible（guided / Lunch Rush / Dinner）の `prepareDockReserve` 出力を R4 実装の出力と deep-equal（`utilityRow` は `pager` と一致）。
- **e2e（R3 と同じ in-run 比較）**: 同一 run 内で entry あり/なしの stage 直径・dock 高さ差 ≤ 0.5px（R3 の「1.5px sanity bound」は据え置き）。4 viewport × FREE。R3 の `hand22.page1` 基準 JSON は流用（絶対 px は Chromium のみの sanity、判定は in-run）。
- **layout contract**: `layout-contract.spec.ts` の 7 profile の stage 下限表（FREE / LUNCH / DINNER / GUIDED）が無変更で green。

### 4.5 Isolation（Dinner / guided / Lunch Rush）
- `GameScreen.pantryShell.test.tsx` の既存 Dinner isolation を拡張: 3 mode それぞれで **entry ゼロ・`utilityRow===pager`・dock 変数不変**。
- FREE でも `state.dinner !== null` / `roundKind !== "FREE_COOK"` / 空 Dex の初期 ORDER で entry ゼロ。
- source-level: `pantryWorthwhile` は eligible ガードの内側でしか `utilityRow` に効かない（下記 M53）。

### 4.6 enforcement seam（R5-a で導入し R5-c/d が使う）
`handCapacityFor` / `resolveHand` は module const を直接読むため、テストが「ON のとき」を作れない。pure 層に **`enforced?: boolean`（既定 `HAND_ENFORCEMENT_ENABLED`）** を追加し、`GameScreen` / `App` は**引数を渡さない**（= const のまま）。source-level gate: production 経路が `enforced` を `true` で渡していないこと・const が `false` であること。**const 自体は反転しない。**

### 4.7 source-level mutation 候補（R5-a、M51〜）
| ID | mutant | 期待 |
|---|---|---|
| M51 | `pantryAvailable` を `dockReserve.pager` に戻す | e2e/unit（E1 を再現する seam テスト）で kill |
| M52 | `pantryWorthwhile` を hand 長 / page 数から算出 | 等価性 + E1 テストで kill |
| M53 | `utilityRow` の eligible ガードを外す（Dinner に行が付く） | isolation golden で kill |
| M54 | 閾値 `> 6` を `>= 6`（境界 off-by-one） | 境界 6/7 テストで kill |
| M55 | worthwhile が在庫 0 を除外して数える | E1 テストで kill |
| M56 | worthwhile が pin 数に依存 | pin ありなし比較で kill |
| M57 | `pager` を `utilityRow` から導出（1 page なのに page nav 表示） | tray unit で kill |
| M58 | 非 eligible の `reservePagerRow` を `utilityRow` に変更 | golden で kill |
| M59 | `pantryWorthwhile` が `data/recipes` / discovery を import | boundary test（import allowlist）で kill |

---

## 5. R5-b — Search + sheet layout

### 5.1 設計

**検索 UI**（`IngredientPantry.tsx`）
- 位置: header と subtitle の直下、shelf chip slot の**上**、**非 scroll の固定 slot**（R4 と同じ規律: sheet 外形・header・閉じる・chip slot は固定、scroll するのは list のみ）。
- 部品: `<input type="search">` + クリアボタン（44px）。`role="search"` の wrapper。`aria-label="材料をさがす"`、`autocomplete="off"` / `autocapitalize="off"` / `autocorrect="off"` / `spellcheck={false}` / `enterKeyHint="search"`。**font-size 16px 以上**（iOS の focus 時 auto-zoom 防止）。
- **表示条件**: アクティブ category の OWNED 数 **> 6**（= `pantryWorthwhile` と同じ閾値。round 単位で entry が出ても、小さい category の sheet には検索欄を出さない）。閾値は §10 D-b1 で確認（既定: 6）。
- 検索対象は OWNED 行の `nameJa` / `readingJa` のみ（`matchesSearch` 既存）。LOCKED / 未購入の名前・シルエット・`???`・「あと N 件」は出さない。

**合成: name search AND shelf**
`queryCatalog(catalog, ownership, usage, { shelves: [shelf]?, text })` に一本化（既に AND）。`allItems`（chip 導出用）は **text を渡さない**版のまま → **検索しても shelf chip が増減しない**（chip は「この category の OWNED が持つ shelf」で固定、R4 契約維持）。検索 0 件の shelf は空リストになり得るので empty 文言を分岐:
- 検索文字あり + 0 件 → 「見つかりません」（**件数・未所持ヒント・「他 category に有ります」を出さない**）
- 検索文字なし + 0 件 → 従来の「まだこのカテゴリの材料を持っていません」

**reopen 時 reset**: text も shelf も pantry ローカル state（閉じると unmount）。GameState / localStorage / URL に出さない（OD-R4-2 の拡張）。

**Escape 契約**（既定案。§10 D-b2）
- sheet の `onKeyDown` Escape = **常に close**（R3/R4 契約を維持、chip 上の Escape も同様）。
- ただし **IME 変換中（`event.nativeEvent.isComposing` または `keyCode === 229`）の Escape は無視**（変換キャンセルを close と誤認しない）。
- close 後は **entry にフォーカスを戻す**（既存 `wasPantryVisibleRef` の挙動を維持）。
- 「1 回目で検索文字クリア、2 回目で close」は採らない（R4 契約が変わり e2e 差分が増えるため）。クリアは × ボタン。

**list scrollTop reset**: text 変更・shelf 変更の**両方**で `listRef.current.scrollTop = 0`。sheet / page / chip slot / 検索 slot は動かさない。

### 5.2 sheet 高さ候補
検索 slot（入力 44px + 上下 padding/gap ≈ 52〜54px）を足すと、R4 実測の list 高から更に引かれる。

| 案 | 内容 | 得失 |
|---|---|---|
| **H-A（推奨・既定）** | sheet 外形は R3/R4 のまま（`min(70dvh, …)`）。検索 slot を固定追加。list は更に −54px | 最小変更。360×640 の list 高（R4 chip 有: 293）→ 約 **239px** = 行高換算で約 2.7 行（要実測） |
| H-B | 検索を出す時だけ `min(80dvh, …)` | list は確保できるが、sheet 外形が「検索の有無」で変わる = PR #304 stable-height 契約違反（category 間で外形が変わる）。**不可** |
| H-C | 検索 focus 中のみ visualViewport に合わせて sheet を縮める（キーボード用） | iOS でのみ必要になる可能性。実機 HV の結果で採否（§5.4）。採用しても「キーボード無し時の外形」は H-A と同一 |

判定基準（H-A の合否、4 viewport）: ① sheet 外形が「検索の有無 / shelf 選択 / 検索結果 0 件」で ±0.5px 以内同一、② header・閉じる・検索・chip slot の bounds が list の内容量で不変、③ list 高 ≥ **2 タイル行分**（360×640 で下限。下回れば H-A 不合格 → Owner に案を戻す）、④ 閉じる / × / chip が 44px 以上、⑤ body / page scroll 0。

### 5.3 4 viewport 測定方法（新規 `e2e/large-catalog-pantry-search.spec.ts` を実装フェーズで追加）
R4 spec と同型（4 viewport = 390×844 / 360×800 / 390×664 / 360×640、幅ごとに project 分岐、in-run 比較のみ）:
1. FREE・topping 22 所持・topping step で pantry を開く。
2. 検索 slot / chip slot / list の `getBoundingClientRect` を記録。検索なし↔文字あり↔0 件で sheet / header / 検索 slot が同一。
3. `ベーコン` / `べーこん` / `ﾍﾞｰｺﾝ` / `べこん` が同じ行集合（normalization 契約）。
4. text + shelf の AND（肉 × 「ベ」など）と、text 変更で shelf chip 行が不変。
5. 変更ごとに list `scrollTop === 0`。
6. stage / dock は検索操作の前後で不変（Δ ≤ 0.5px）。
7. body / documentElement の `scrollTop`・`scrollHeight − clientHeight` が 0。
8. Escape で close、entry にフォーカス、再 open で text 空・shelf「すべて」。
9. 記録値（list 高 / 費用）を Result Report の表にする（R4 Result と同形式）。
- Chromium では **キーボードを再現できない**。`visualViewport` 高さを縮めるエミュレーション（viewport を縮める）は「レイアウト破綻の早期検知」用に限定し、**キーボード周りの合否は実機 HV のみが authority**（§8）。

### 5.4 iOS keyboard の設計上の論点（実機 HV で確認）
- iOS Safari は keyboard 表示で layout viewport を縮めず visual viewport だけ縮める。`position: fixed; bottom: 0` の sheet は keyboard の**下に潜る**。検索入力は sheet の**上部**にあるので入力自体は見えるはずだが、list 下部が隠れる・sheet が上へずれる・body が scroll される可能性がある。
- 対策候補（実装は R5-b 内。実機で不要と分かれば入れない）: `visualViewport` の `resize` を購読し、`--pantry-vv-h`（= `visualViewport.height`）で sheet の `max-height` を `min(既定, vv.height − 12px)` に制限。**keyboard が閉じたら既定値へ復帰**（復帰漏れが最大のリスク → HV 項目 K-9）。
- body scroll ロック: focus 時の自動 scroll で `window.scrollY` が動かないこと。動くなら `scrollTo(0,0)` 相当ではなく、原因側（fixed 位置・font-size）を直す。
- 日本語 IME: 変換中の未確定文字（`compositionupdate`）でも絞り込みを更新するか、確定（`compositionend`）まで待つか → 既定は **入力ごとに更新**（`onChange` は composition 中も発火する。matchesSearch は未確定のひらがなでも部分一致で妥当）。実機で違和感があれば §10 D-b3。

### 5.5 source-level mutation 候補（M60〜）
| ID | mutant |
|---|---|
| M60 | text と shelf を OR で結合 |
| M61 | `matchesSearch` を外し生の `includes` に変更（全角/カナ不一致） |
| M62 | 検索を `catalog` 全体（LOCKED 含む）に対して行う |
| M63 | text を reopen で保持（unmount しない / 外部 state に上げる） |
| M64 | text 変更で `scrollTop` を戻さない |
| M65 | shelf chip 導出に text を渡す（検索で chip が消える） |
| M66 | Escape が composing 中も close |
| M67 | 検索欄を常に / 永久に非表示（表示条件の両端） |
| M68 | 0 件文言に「未所持」「N 件」を入れる（privacy） |
| M69 | 検索 slot を scroll 内に入れる（固定 slot 破り） |
| M70 | text を `GameState` / localStorage に保存 |
| M71 | 入力 font-size を 16px 未満に（CSS を読む source-level assertion） |

---

## 6. R5-c — Direct pin editing

### 6.1 前提の整理（重要）
`HAND_ENFORCEMENT_ENABLED=false` の間、`resolveHand` は inactive で **tray は全 OWNED を出す**。したがって **R5 production では pin は tray に何の効果も持たない**。pin の効果（hand 構成 → tray）は seam（§4.6）を使うテストと、将来の enforcement 反転時にのみ現れる。この「効果の無い pin UI を production に出すか」は §10 D-c3（**着手前に決めるべき Owner Decision**）。

### 6.2 設計

**App-level HandSession**
- `App.tsx` に `const [handSession, setHandSession] = useState<HandSession>(emptyHandSession)`（`selectedIngredientId` と同じ階層）。GameScreen には `handSession` と `onTogglePin(id)` / `onRemovePin(id)` だけを渡す。**save / GameState / reducer に触れない。**
- 寿命（§10 D-c2、既定案）: app セッション中は round をまたいで保持し、`pruneHand`（所持外を除去）を所持変更時に適用、**full game reset で `emptyHandSession()`**。→ pin は「自分の定番」として次の FREE round でも残る。代案は「round 開始ごとに空」。
- ハンドラは**先頭で `isLargeCatalogEligible(state)` を検査し、非 eligible なら何もしない**（Dinner 中に state を触らない）。

**add / remove**
- UI: pantry タイルを toggle button 化（`aria-pressed`、accessible name「〇〇を選択中にする / 選択中から外す」、44px 以上）。行全体タップ。
- add: `addToHand(session, [id], { category: activeCategory, catalog, ownership })`。remove: `removeFromHand`。**pantry のアクティブ category に対してのみ**操作（cross-category 無し: OD-R4-1）。他 category の pin は不変。

**inventory 0 拒否（依頼文要件 B-c1 と R2 実装の食い違い）**
- 事実: R2 の `addToHand` は**在庫 0 を受理**する（「明示選択は 0 でも hand に残す、LC-OD-17 は自動 source のみ」）。依頼文は「inventory 0 拒否」。
- 提案（層で分ける。§10 D-c1 で確認）:
  - **UI/App 層で「新規 add」を在庫 0 のとき拒否**（タイルは disabled 相当・`aria-disabled` + 「ざいこなし」の可視テキスト。色だけに頼らない。zero-stock 行は既に一番下）。**remove は常に可能。**
  - **pure 層（`addToHand`）は変更しない**（R2 の pure 契約と既存テストを壊さない）。
  - すでに pin 済みの材料が調理で在庫 0 になった場合は **pin を残す**（`workingSet` の「placed/pinned は 0 でも保持」と整合）。
- 未所持 id・別 category の id は pure 層が拒否済み（`acceptable()`）。UI からは到達しないが、boundary/unit テストで再確認。

**pins + automatic fill**
- pin は `pinnedIds` として `selectWorkingSet` に渡る（placed > pinned > … > fill）。pin が capacity 以上のときは超過分が `overflowIds`。**R5 production では capacity UI を出さない**ので、pin 上限の提示・拒否は実装しない。seam テストで「pin が hand を満たしたら自動 fill が 0」「overflow を返す」ことだけ検証（挙動の契約化。上限の UX は enforcement 反転スライスで決める → §10 D-c4）。

**active-category**
- pin は category 別に保持（sauce / cheese / topping）。step が変わると pantry は別 category を表示、pin は各 category に残る。`resolveHand` は `category` 引数で 1 category ずつ。

**Dinner 等への非干渉**
- `resolveHand` は非 eligible で `null`（既存）。R5 でも `IngredientTray` は Dinner に hand を渡さない。ハンドラ no-op、`handSession` は Dinner 中に変化しない。Dinner の tray/dock/stage は golden 不変。

### 6.3 テスト計画
- pure/unit: 既存 `hand.test.ts` に加えて「UI 層ガード（在庫 0 add 拒否 / remove 可）」の App 層テスト、pin 済み材料の在庫 0 化で pin 保持。
- App/GameScreen unit: toggle で `handSession` が変わる、他 category 不変、ineligible で不変、round 跨ぎ（寿命 D-c2）、full reset で空。
- boundary: pantry / pin 経路が `RECIPES` / matcher / hint / `saveState` を import しない、`localStorage.setItem` を呼ばない。
- e2e: pantry で add → 「選択中」表示 → 閉じて開き直しても保持（session）→ remove。在庫 0 タイルは押せない。Dinner では entry 自体なし。

### 6.4 mutation 候補（M72〜）
M72 未所持 id を add / M73 別 category に add / M74 UI 層が在庫 0 を受理 / M75 remove が no-op / M76 pin を save・localStorage へ / M77 非 eligible でも handSession が変化 / M78 `pruneHand` を外す（所持外が残る） / M79 pin で tray の並びを変える（enforcement OFF なのに tray 変更）/ M80 `HAND_ENFORCEMENT_ENABLED` 反転 / M81 production 経路が `enforced: true` を渡す / M82 pin 後に `selectedIngredientId` を無条件 clear（OD-2 違反）。

---

## 7. R5-d — #197 page-level contract

### 7.1 契約（PR #197 の `goToPage` を hand 変更へ拡張）
| # | 契約 |
|---|---|
| P1 | **hand が変わり tray の visible 集合が変わったら、tray は page 0 に戻る**（旧 page が存在しなくなる / 別内容になるため） |
| P2 | 選択のクリア判定は **「現在の visible page」基準**: `visibleBefore` = 変更直前に**画面に見えていた page の ids**（≤6）、`visibleAfter` = 変更後の page 0 の ids。`selectionAfterVisibleChange(selected, before, after)` をそのまま使う |
| P3 | `selectedIngredientId` が `visibleBefore` に居て `visibleAfter` に居ない → clear。`visibleBefore` に居ない（別 page / 別 category）→ **据え置き**（既存 pure 契約） |
| P4 | **filter / search / shelf / pantry の open・close・pin toggle（enforcement OFF）では clear しない**（OD-2、OD-B1: tray の visible 集合が変わらないため） |
| P5 | **enforcement OFF では hand 変更が tray の visible 集合を変えない** ⇒ page reset も clear も発火しない（tray の DOM・page state 不変） |
| P6 | enforcement ON（seam テストのみ）: pin add/remove で visible 集合が変わるとき P1〜P3 が発火 |

### 7.2 実装場所
- **`IngredientTray` が page state を持つ**ので、page reset と clear は tray 内で行うのが最小（App は page を知らない）。tray に `handRevision`（hand 由来の visible ids の比較用トークン / もしくは items 自体）を受け、**「直前の visible ids」と比べて変わった時だけ** page 0 へ戻し、`selectionAfterVisibleChange` の結果が null なら `onClearSelection()`。effect 駆動の clear は 1 frame 遅れて「選択が残った tray」が見えるので、`makingStepToken` と同じ**render 中導出パターン**か同期ハンドラ内で行う。
- tray の item 源は R5 では変えない（`trayIngredientsFor` のまま）。**hand 由来の items を渡す配線自体を enforcement ON 用 seam の先に置く**ので、OFF では `revision` が変化しない → P5 が構造的に成立。
- R4 の boundary test（`selectionAfterVisibleChange` の import 禁止）は **R5-d で「tray 内のみ許可」に更新**。pantry からの import 禁止は維持。

### 7.3 テスト計画
- unit（tray）: page 1 で選択 → hand 変更（seam）→ page 0 + clear / 選択が page 0 に残るなら維持 / 別 category の選択は維持。
- 「現在の visible page」テスト: hand が 13 個 → page 1（7〜12 番目）を見ている最中に **page 1 の材料を選択中に hand 変更** → page 0 に戻ったとき、その材料が page 0 に無ければ clear、あれば維持。
- 非発火テスト: filter 変更 / 検索 / pantry open・close / pin toggle（OFF）で `onClearSelection` 呼び出し 0 回、tray DOM 不変、page 不変。
- e2e: FREE で page 2 の材料を選択 → pantry を開いて検索・shelf・閉じる → **選択と page が保持**。
- mutation（M83〜）: M83 filter/search で clear / M84 hand 変更で page を戻さない / M85 全 hand（visible page でなく）基準で clear 判定 / M86 OFF でも page reset / M87 別 category の選択を clear / M88 pantry open で clear / M89 clear せず選択が消えた page に残る。

---

## 8. R5-e — Selected / pinned presentation と統合 Gate

### 8.1 pinned presentation（pantry 内）
- OD-2: pantry の picks は **filter / search / shelf で隠れない「選択中」領域**に固定表示。
- 設計: header 系の固定 slot の下に **1 行の横 scroll ストリップ**（pinned 材料のチップ、× で remove、各 44px）。pin 0 件のときは slot を出さない。高さ上限 1 行（pin が増えても高さは増えない、横 scroll）。
- 影響: pin 0→1 で list 高が約 54px 減る（sheet 外形は不変）。360×640 で list ≥ 2 行を割るなら **常時予約（pin 0 でも空 slot）** に切り替える → 4 viewport 実測で決める（§5.2 判定基準③を pin + 検索 + chip 全部載せの最悪ケースで再評価）。
- タイル自身の pinned 表現: **色だけに頼らない**（📌 アイコン + 「選択中」テキスト、`aria-pressed`）。
- **`selectedIngredientId`（tray の選択）を pantry に反映しない**（OD-2: 別 state。反映すると「pin」と「選択」が混同される）。tray 側の `ingredient-chip--selected` 表現は不変。
- capacity（9 / 12）・「あと N 個」・満杯表示は **production に出さない**。

### 8.2 統合 Gate（R5-a〜d 全部載せの合格条件）
| Gate | 内容 |
|---|---|
| enforcement | `HAND_ENFORCEMENT_ENABLED === false`（unit + source-level）。production build（`dist/`）に capacity 文言・hand active 経路の到達コードが無い（R4 と同じ dist 検査）|
| capacity UI | pantry / tray / live region の DOM 文字列に `9` / `12` / 「満杯」等が無い（数字は `×n` 在庫のみ）|
| privacy | §8.3 |
| accessibility | §8.4 |
| regression | §9 |
| mutation | §9.3（M1〜M50 ＋ R5 新規、全 killed）|
| Human Verification | §8.5 / §11 |

### 8.3 privacy 契約（Hint 5.0 を含む）
- pantry / 検索 / pin / tray 配線が import してよいのは `catalog/*`（pure）・`data/ingredients`・`data/ingredientShelf`・`state/inventory` のみ。`recipes` / `discovery/*`（matcher, hint5Ladder, hint5Flag）/ near-miss / mission / dinner target は **boundary test の allowlist 外**（既存 catalogBoundary の拡張）。
- hint source は `NO_DISCLOSED_HINTS` のまま（R5 では hint 由来 fill を配線しない）。pin 順・検索履歴・検索語は **どこにも保存・送信しない**（Firebase / ranking / analytics / save）。
- 検索 0 件の文言・live region・`aria-label` は「所持外」を示唆しない（「まだ持っていない材料」等の文は禁止）。**検索語が LOCKED 材料の名前と一致しても挙動は「0 件」と完全に同じ**（存在の側路を作らない）。
- 数字: 件数・shelf 別件数・「隠れている N 件」を出さない（counts は Phase 5、OD-CT-6 / OD-B）。
- Hint 5.0（OD-B5、H5 ladder sheet の k≥2 等）: R5 は hint sheet / ladder に触れない。既存 `discovery-hint5-ladder` / `discovery-hint-sheet` の e2e / unit が無変更で green。

### 8.4 accessibility
- 検索: `<label>`（visually hidden 可）または `aria-label`、`role="search"`、× ボタンは name 付き 44px。`type="search"` の iOS 標準 × と二重にならないよう `::-webkit-search-cancel-button` を隠す（実機で確認）。
- pin toggle: `aria-pressed`、name に材料名 + 状態。zero stock は `aria-disabled` + 可視「ざいこなし」。
- フォーカス: open → 閉じる（既存）。Tab 順 = 閉じる → 検索 → chip → pinned ストリップ → list → タイル。close → entry に戻る（既存契約を維持・e2e で pin/検索後も検証）。`aria-modal` の外側（ゲーム画面）は `cookingInputPaused` で不活性（既存）。
- 結果変化の通知: `aria-live="polite"` は「見つかりません」/ 空文言のみ（**数字を読み上げない**）。
- 44px 目標、chip 行は横 scroll のみ（R4 契約）、`prefers-reduced-motion` で新規アニメなし。

### 8.5 R5-e で追加する回帰 assert（統合）
`GameScreen.pantryShell.test.tsx` へ: 「全部載せ」シナリオ（検索 + shelf + pin + Escape + reopen）で、tray DOM / `selectedIngredientId` / stage / dock / GameState が不変。`pnpm build` 後の dist grep（hand・working set・capacity）。

---

## 9. 検証マトリクス（R5 全体）

### 9.1 自動テスト
| 層 | 対象 | 実行 |
|---|---|---|
| Vitest (unit) | `pantryAvailability`、`prepareDockReserve` golden、`IngredientPantry.*`（search / pin / strip）、App の pin ハンドラ、tray page/clear、boundary（import allowlist）| 全体（R4 時点 246 files / 4861 passed が baseline）|
| Playwright Chromium | 新規: pantry-search / pantry-pins / #197 page 契約 / availability。既存: pantry-shell, pantry-shelves, free-cooking-phase3-2, dinner-mission, stage-size-stability, layout-invariants-lb, layout-contract（7 profile）, inventory-modal-stable-bounds, discovery-hint-sheet, discovery-hint5-ladder, lunch-rush-*, making-ui-1screen, viewport-1screen | 390×844 / 360×800 project + 4 viewport spec |
| WebKit | CI の WebKit Gate（sandbox 不可）。**新規 e2e は in-run 比較のみ、Chromium 絶対 px を assert しない** | PR 上 |
| 型 / lint / build | `tsc -b`、`oxlint`、`vite build` | 毎スライス |

### 9.2 回帰ゲート（毎スライス必須）
Dinner（tray/dock/stage/Settlement）、guided、Lunch Rush、Hint 5.0（ladder sheet / near-miss / k≥2）、Inventory / Shop の shelf、save 互換（`save-forward-compat-3-4b`、`save-dinner-records-dm4-2` — **save 差分 0** を assert）、cut / bake の既存 e2e。

### 9.3 mutation gate
- `tools/large-catalog-ux/mutation-check.mjs` に **M51〜M89** を追加（§4.7 / 5.5 / 6.4 / 7.3）。全 killed が merge 条件（R4 の M50 のように、生き残った mutant は source-level assertion で殺す）。
- 既存 M1〜M50 は無変更で全 killed のまま（R4: 52/52）。M-番号は実装時に衝突しないよう再採番してよい（本書の番号は仮）。

---

## 10. Owner Decision の残り（実装開始時に迷うもの）

判定の凡例: **BLOCK** = 決まるまで該当スライスに着手不可 / **DEFAULT** = 推奨既定で着手可、Owner が異議を出さなければ確定。

| ID | 内容 | 対象 | 種別 | 推奨既定 |
|---|---|---|---|---|
| **D0** | **OD-R5-1〜12 と LC-R5 Fresh Audit の原本が repo に無い。** 依頼文の箇条書き（B-n）が OD-R5 そのものか、別に本文があるか | 全体 | **BLOCK（記録作業）** | 依頼文 = OD と確認のうえ `PROJECT_HANDOFF.md` へ転記 |
| D-c1 | **在庫 0 の pin**: 依頼文「inventory 0 拒否」vs R2 実装（0 も受理）。UI 層で新規 add のみ拒否し、pure 層・既 pin は不変、でよいか | R5-c | **BLOCK** | 層で分ける（§6.2） |
| D-c3 | **enforcement OFF の間、tray に効かない pin UI を production に出すか**（出すと「選んだのに何も起きない」）。案 X: pin UI を別 flag で production 非公開（Preview / DEV のみ有効、enforcement 反転と同時に公開）／案 Y: 効果なしで公開（ラベルで「お気に入り」等の別意味づけ）／案 Z: R5 は検索まで、pin は enforcement スライスへ | R5-c/e | **BLOCK** | 案 X（`hint5` の Preview 用 helper と同じ「production で compile out」パターン。実機 HV は Preview で行える）|
| D-c2 | pin の寿命: app セッション（round 跨ぎ、full reset で空）vs round ごとに空 | R5-c | DEFAULT | app セッション（LC-OD-5 session-only を満たす）|
| D-c4 | pin が capacity 以上のときの UX（拒否 / 古い pin を外す / 警告）— capacity UI を出さない R5 では実装しない。enforcement 反転スライスの課題として**明示的に先送り**してよいか | R5-c | DEFAULT（先送り）| 先送り |
| D-a1 | `pantryWorthwhile` 閾値 = 「1 category の OWNED > 6」（page 容量）でよいか。R2 の capacity 9/12 と独立 | R5-a | DEFAULT | > 6 |
| D-b1 | 検索欄の表示条件 = 同 > 6 でよいか（小 category には出さない）| R5-b | DEFAULT | > 6 |
| D-b2 | Escape = 常に close（IME 変換中のみ無視）。「1 回目は検索クリア」は採らない | R5-b | DEFAULT | 常に close |
| D-b3 | 日本語 IME の絞り込みタイミング（入力ごと vs 確定後）| R5-b | 実機 HV で確認 | 入力ごと |
| D-b4 | 検索結果の件数表示・読み上げは出さない（counts 規律）でよいか | R5-b/e | DEFAULT | 出さない |
| D-e1 | pinned ストリップ: pin 0 のとき slot を出さない vs 常時予約 | R5-e | 実測で決定 | 出さない（list ≥ 2 行を割れば常時予約）|
| D-e2 | `selectedIngredientId`（tray 選択）を pantry に反映しない（OD-2 の徹底）| R5-e | DEFAULT | 反映しない |
| (R6) | capacity 9 vs 12（OD-R2-1）。**R5 では決めない**（enforcement OFF のため）。§12 の基準を事前に Owner が承認する | R6 | 別 Gate | §12 |

**着手可否の整理:**
- **R5-a**: 決定待ち無し（D-a1 は既定で可）。**#306 の WebKit green 後に着手できる。**
- **R5-b**: D0 のみ。既定で着手可。
- **R5-c / R5-d / R5-e**: **D-c1・D-c3 が BLOCK。**

---

## 11. iPhone 実機 Human Verification 計画

CLAUDE.md / HV Policy に従い、動画（390×844、Owner へ直接提出、**repo に commit しない**）+ before/after スクリーンショット（`docs/reports/screenshots/<task-name>/` に commit）+ Result Report（Policy §10 形式）。Chromium / WebKit エミュレーションでは keyboard・IME・Safari のツールバー伸縮を再現できないため、**§11 の実機項目が合否の authority**。

### 11.1 端末・環境
| 区分 | 条件 |
|---|---|
| 主 | 390×844 級 iPhone（14/15/16 相当）、Safari（Chrome iOS ではない）、Preview デプロイ |
| 小型 | 375×667 / 375×812 級（SE / mini 相当）。Safari 可視高が 360×640 級になる状態（ツールバー表示）|
| 共通 | 日本語 IME（ひらがな / カタカナ / 全角半角）、ホーム画面追加でない通常 Safari、低電力モードは対象外 |
| 準備 | topping 22 所持・sauce/cheese 10 所持の save（Preview seed or 既存 DEV 手段）、Dex 空でない FREE |

### 11.2 チェックリスト（動画に含める）
| # | 項目 | 合格条件 |
|---|---|---|
| K-1 | FREE → topping step → 食材庫を開く | 開いても stage・dock が動かない |
| K-2 | 検索 focus | keyboard 表示。**入力欄・閉じる・shelf chip が keyboard の上で見える**。画面全体が上下にズレない |
| K-3 | 日本語入力（ひらがな→変換→確定、カタカナ、半角ｶﾅ）| 変換中/確定で list が想定どおり絞られ、変換候補で操作不能にならない |
| K-4 | list scroll（keyboard 表示中 / 閉じた後）| list のみ scroll、body / page は scroll しない（引っ張りバウンスで背景が動かない）|
| K-5 | shelf chip 変更（検索文字あり）| AND で絞られ、list は先頭へ、chip 行・検索欄は動かない |
| K-6 | pin add / remove（在庫あり / 在庫 0）| 選択中ストリップに反映、在庫 0 は押せない、remove 可（**D-c3 案 X なら Preview 限定で確認**）|
| K-7 | Escape / 閉じる / 背景タップ | 外付キーボードの Esc（あれば）と 閉じる で close。IME 変換中の Esc/「キャンセル」は close しない |
| K-8 | close 後 focus | entry ボタンに戻る（VoiceOver 不要、`:focus-visible` 相当の確認は Bluetooth keyboard 有りの場合のみ）|
| K-9 | **keyboard を閉じた後の layout 復帰** | sheet の高さ・位置・list が open 直後と同一。stage / dock に残骸（ズレ・空白）なし |
| K-10 | body scroll なし | focus / keyboard 開閉 / 回転なし で `window.scrollY` 相当のズレが起きない |
| K-11 | reopen | 検索文字空、shelf「すべて」、list 先頭 |
| K-12 | tray 選択との独立 | tray で材料選択 → 食材庫で検索・shelf → 閉じる → **選択・page が保持**（#197 P4）|
| K-13 | 小型 iPhone で K-2〜K-11 を再実施 | 特に list 高が 2 行未満にならない、閉じる/検索が押せる |
| K-14 | 誤タップ感 | 検索 ×・chip・タイルの隣接タップで誤爆しない（片手・親指）|
| K-15 | Dinner / Lunch Rush / guided を 1 周ずつ | 食材庫 entry が無い、tray/stage が従来どおり |

### 11.3 提出物
動画 1 本（K-1〜K-12 を 390×844 で 1 本、各状態 1〜3 秒保持、Policy §4）+ 小型端末動画（K-13）+ 各 viewport の before/after スクリーンショット + Result Report（実測表: sheet / list 高、費用、keyboard 中の sheet bounds を含む）。実機が使えない場合は **「実機未確認」を Result に明記し、Owner 実機確認を merge 条件に残す**（H5-5 で採用した「Owner iPhone HV = PASS を Result に記録」方式）。

---

## 12. R6 — 9 vs 12 Human Feel Gate 計画

### 12.1 構造的な前提（既存コードからの事実）
- tray の **page 容量は 6 固定**（`MAX_INGREDIENT_PALETTE_SLOTS`）で、dock の予約高さは page 単位（`rowsFor` は ≤2 行）。よって **9 でも 12 でも stage / dock の幾何は同一**になるはず（検証項目として明示的に実測）。差が出るのは「何個が hand に載り、何個が pantry 送りか」と「page 数（9 → 6+3、12 → 6+6）」。
- category の owned が capacity 以下なら hand は inactive（= 全部 tray）。**sauce / cheese 各 10 個**: capacity 9 なら 1 個が pantry 送り（在庫 0 なら実質見えない）、capacity 12 なら全部 tray（pantry 不要）。
- 既存ハーネス `tools/large-catalog-ux/hand-capacity.measure.spec.ts` + `playwright.hand-capacity.config.ts`（LC-R2）を再利用・拡張する。

### 12.2 比較項目と測り方
| 項目 | シナリオ | 指標 | 手段 |
|---|---|---|---|
| A. sauce / cheese 10 材料 | 各 category 10 所持 | 9 で pantry に送られる材料の探し出し回数、pantry を開く回数/ピザ | HV タスク（指定ピザを作る）|
| B. topping 大量 | topping 22 / 30 所持 | 目的の材料までの操作数（page 送り + pantry）と所要時間 | HV タスク + 計測 |
| C. pager | page 数 2（9: 6+3 / 12: 6+6）| page 送り回数、page 2 の「3 個だけ」の違和感 | HV 評価（5 段階）|
| D. pantry を開く回数 | 標準タスク 3 種 | 回数/ピザ、pantry からの pin 追加回数 | 操作ログ（DEV のみ、保存しない）|
| E. 誤タップ | 標準タスク | 選び間違い → 取消の回数 | 動画の目視 + DEV カウンタ |
| F. 片手操作 | 390×844 / 375×667、右手親指 | 親指が届く範囲（画面下 ~55%）内で完結する操作の割合、届かない操作の有無 | HV 評価 |
| G. 360×640 | Safari 可視高最小 | 全操作が完結するか、list ≥ 2 行、閉じる/検索が押せるか | e2e + 実機 |
| H. stage 幾何 | 7 profile | 9 と 12 で dough 直径・dock 高さ差 ≤ 0.5px（構造的に同一のはず。差が出たら設計違反）| e2e（in-run）|

### 12.3 判定基準（事前に Owner が承認する。数値は提案）
1. **足切り（どちらかが下回れば失格）**: G（360×640 完結）・H（stage Δ ≤ 0.5px）・privacy / a11y 回帰なし。
2. **12 を採用する条件（すべて）**: A で sauce/cheese 10 の pantry 依存が 0 回（9 は ≥ 1 回）／B で 12 が 9 より操作数・時間が**悪化しない**（page 2 に 6 個出るため）／E の誤タップが 9 より増えない／F で page 2 の 6 個が親指圏に収まる。
3. **9 を採用する条件（いずれか）**: 12 で B の探索時間・E の誤タップが有意に悪化（目安: +20% 超）／「多すぎて選べない」の HV 主観評価が 12 で悪い／pin 運用が 9 で自然に回る（pantry を開く回数 ≤ 1/ピザ）。
4. **同点**: 12（`PROJECT_HANDOFF.md` の「12 is the design candidate」= OD-R2-1）を既定に。**final は Owner**（AI は推奨まで）。
5. 判定結果は enforcement 反転スライスの着手前ゲート。R5 では決めず、`handPolicy.ts` の候補も 9/12 のまま。

---

## 13. 実装順序と成果物（Owner go 後）

| スライス | 主な変更ファイル（予定）| 前提 | 完了条件 |
|---|---|---|---|
| R5-a | `pantryAvailability.ts`（新）、`prepareDock.ts`、`GameScreen.tsx`、（コメントのみ）`IngredientTray.tsx`、boundary / golden テスト | #306 WebKit green | Δ0 証明（§4.4）、M51〜M59 killed |
| R5-b | `IngredientPantry.tsx`、`App.css`（append-only）、search e2e | R5-a merge、D0 | 4 viewport 実測、実機 K-2〜K-11、M60〜M71 killed |
| R5-c | `App.tsx`、`GameScreen.tsx`、`IngredientPantry.tsx` | D-c1・D-c3 | §6.3、M72〜M82 |
| R5-d | `IngredientTray.tsx`、boundary 更新 | R5-c | §7.3、M83〜M89 |
| R5-e | presentation、統合 Gate、dist 検査 | R5-a〜d | §8.2 全 Gate、Result Report、HV |

各スライスの Result は `docs/reports/TETO_LARGE-CATALOG-UX_LC-R5{a..e}_*_Result.md`（R3/R4 と同形式）、`PROJECT_HANDOFF.md` の Large Catalog UX 節を docs で更新。PR は Owner の go があるまで作成しない。

## 14. FINAL VERDICT

**B. OWNER DECISION REQUIRED**

- コード側の audit は完了しており、R5-a〜e の実装・検証計画は具体化できた（**R5-a は今すぐ着手可能な設計まで確定**、#306 の WebKit green 待ちのみ）。
- ただし **(1) 依頼文が前提にした LC-R5 Fresh Audit と OD-R5-1〜12 の原本が repo に存在しない**（D0）、**(2) R5-c/e には実装開始時に迷う決定が 2 つ残っている**（D-c1: 在庫 0 pin と R2 実装の食い違い、D-c3: enforcement OFF で効果の無い pin UI を production に出すか）。この 2 点は Owner 回答があるまで R5-c に着手しない。
