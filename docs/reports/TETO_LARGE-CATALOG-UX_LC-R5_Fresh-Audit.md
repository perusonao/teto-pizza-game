# Large Catalog UX — LC-R5 Fresh Audit (search / pantry picks / hand editing)

Docs / audit only. No production, CSS, e2e, save or tooling file was changed. PR #306 (LC-R4) and its branch were read, not touched; nothing was merged; no PR was created; LC-R5 is not implemented.
Human Verification: not applicable (no visible / interaction change; policy §2).

## 0. Audited state

| Item | Value |
|---|---|
| `origin/main` (fresh fetch) | `3b0da33b0ca4ebc1deaefcb357b4181511621863` (merge of PR #305 / LC-R3); unchanged by the fetch |
| PR #306 exact HEAD (read-only, `refs/pull/306/head`) | `ead02fb0ab82f6c6ca70f1c9c2bd98d1a16af35a` (LC-R4 shelf filtering; treated as **unmerged**, per the task) |
| Audit branch | `claude/lc-r5-fresh-audit-z4bga9` (= main + this file) |
| R4 runtime diff vs main (PR #306) | `IngredientPantry.tsx`, `App.css` (+9), tests, e2e, tools. **No** `GameScreen` / `IngredientTray` / `App` / state / save / `handSession` change |
| Method | Static reading of docs (Gate §3–§17, R0–R4 Results, R4 audit, PROJECT_HANDOFF, Hint 5.0 section) and code (`handSession`, `handPolicy`, `workingSet`, `catalogQuery`, `catalogText`, `hintDisclosure`, `IngredientTray`, `GameScreen`, `App`, `prepareDock`, `hint5Ladder`, `ingredientShelf`). `node_modules` is not installed in this sandbox, so **no test / build / e2e was run**; every number marked "est." is derived from the R2 / R3 / R4 measured values and must be re-measured in the R5 slice that uses it. |

Everything below assumes PR #306 lands as read. Where R5 depends on something R4 changes, it is stated explicitly.

---

## 1. Current architecture (main + PR #306)

```
GameScreen (per round; unmounted when the screen leaves GAME)
  pantryOpen (bool), pantryEntryRef
  pantryAvailable = isLargeCatalogEligible(state) && PREPARE && makingStep != DOUGH && dockReserve.pager
  cookingInputPaused = isGlobalOverlayOpen || pantryVisible
  <IngredientTray  pantryEntry=… reservePagerRow={dockReserve.pager}>   // owns `page`; source = trayIngredientsFor()
  {pantryVisible && <IngredientPantry category ownedIngredientIds inventory onClose>}   // mounted only while open
App
  selectedIngredientId (useState) -> GameScreen -> IngredientTray (set by tap / drop / step change / round change)
src/logic/catalog (pure)
  catalogSource (only importer of ingredientShelf) · catalogQuery({shelves,text,only,sort,zeroStockLast})
  catalogText (NFKC, kana fold, ー/space/・ removed; nameJa + optional readingJa; production has no readingJa)
  workingSet (placed > pinned > hint > favorite > recent > new > fill)   ·   handSession (per-category pins; add/remove/replace/prune; resolveHand; selectionAfterVisibleChange; recentlyAcquiredIds)
  handPolicy (CANDIDATES [9,12]; HAND_ENFORCEMENT_ENABLED=false)   ·   freeEligibility (FREE_COOK && dinner===null)
IngredientPantry (R4): local activeShelf; owned rows of the ACTIVE category via queryCatalog; ShelfChips only if >=2 shelves; read-only tiles
```

Facts that shape R5 (verified in code):

1. **Nothing but the R3/R4 pantry is wired.** `handSession`, `workingSet`, `handPolicy`, `selectionAfterVisibleChange` have no production importer (boundary test pins it). The tray still shows *every* owned ingredient of the step category, paged by 6 (`MAX_INGREDIENT_PALETTE_SLOTS`), 3 columns.
2. **The tray's #197 rule is page-level, not set-level.** `goToPage` clears `selectedIngredientId` if it is in the category list but not on the target page (`IngredientTray.tsx` ~338–350). The invariant is "the selection is always on the page that is on screen". `selectionAfterVisibleChange` (R2) is keyed on the **hand**, not the page (see §7 — a real gap).
3. **Making steps are forward-only and per-category.** `DOUGH → SAUCE → CHEESE → TOPPING → …`; `CONFIRM_MAKING_STEP` only advances; the reducer rejects a cheese placement outside the CHEESE step and a topping outside TOPPING (`gameReducer.ts` ~923–924). Within a round a category's tray is used only during its own step, and never revisited.
4. **`GameScreen` is unmounted when the screen leaves GAME** (`App.tsx`: `screen === "GAME"`). State that must survive across FREE rounds of one session cannot live in `GameScreen` or in `IngredientPantry`; it has to be in `App` (like `selectedIngredientId`) or a module-level session holder. Save persistence has no cooking-round state (`persistence.ts` = progression only).
5. **The pantry is unmounted on close** (`{pantryVisible && …}`), so any state local to it (shelf, and in R5 search / pending picks) dies on close. R4 OD-R4-2 confirmed this for the shelf.
6. **The Builder tray's chips for 0-stock owned items are listed but disabled** (`ingredient-chip--disabled`, EP3 Stock Gate); the pantry lists them last with `×0`.
7. **Production catalog:** 29 ingredients = sauce 3 / cheese 4 / topping 22 (22 classified; 0 unclassified). Recipes require at most **4** toppings (25 recipes: 0→1, 1→7, 2→12, 3→1, 4→4 in a static count of `recipes.ts`). The 62-ingredient catalog (10 / 10 / 42, 23 unclassified toppings) is a design target, **not activated**.
8. **Hint 5.0 is production-default ON in the H5-6 activation PR** (state per handoff: PR open at the time of the handoff; treat the flag as ON for the audit). The hint sheet is a separate modal (`hintSheetOpen`, also a FREE-Cooking PREPARE-only sheet); pantry and hint sheet never coexist (both are full-screen overlays that pause cooking inputs).

---

## 2. Problems R5 must solve (and the ones it must not create)

| # | Problem | Why it matters |
|---|---|---|
| P1 | With 22+ toppings the only way to find one is to page the 6-per-page tray | The R5 purpose: search + pick + hand. |
| P2 | R4's pantry is read-only, so the R3 entry is a dead end after R4 | R5 gives it a job. |
| P3 | Pins/picks cannot live in `IngredientPantry` (unmounted on close) or `GameScreen` (unmounted between rounds) | State ownership must be decided (§4). |
| P4 | The pantry entry is gated on `dockReserve.pager` (OD-R4-3 forbids keeping that) | §10. |
| P5 | The R2 selection helper is hand-level; the tray invariant is page-level | §7. |
| P6 | Search adds a text field to a sheet whose fixed height is already ≈ 11–16 % consumed by the R4 chip row | §11 layout budget; the smallest viewport would fall to ≈ 2 tile rows with search + a picks strip. |
| P7 | A text field on iOS opens the keyboard and shrinks the *visual* viewport, not `dvh` | A fixed sheet can end up under the keyboard (real-device check, §11). |
| P8 | The auto part of the hand (fill / recent / new / favourite) changes without a player action | Hand editing must stay predictable (§8). |
| P9 | Counts (result counts, hand counts, shelf counts) are a leak / Phase 5 surface | §12. |
| P10 | Capacity 9 vs 12 interacts with sauce/cheese counts in the 62 catalog | §9. |

---

## 3. UX proposal (recommendation)

Keep the R3/R4 sheet and add three things, in this vertical order inside the fixed-height sheet (all `flex: none` except the list):

```
header  (🧺 食材庫 · 閉じる)
subtitle (category)                         <- may be merged with the search row (L2)
[search field ✕]                            <- new; only when the category's owned rows > 6
[ShelfChips]                                <- R4 (>=2 shelves)
[選択中 strip: pinned tiles ×  · n/cap · クリア]   <- new; always visible while >=1 pick; fixed slot
list (only scroller): tiles — tap = toggle pick
[footer: 手元にセット / 閉じる]              <- only if the commit model is chosen (see OD-R5-2)
```

Recommended defaults (each becomes an Owner Decision in §17):

- **Search + chips + list stay per active category** (OD-R4-1 kept). Search is local sheet state; it resets on close (mirrors OD-R4-2).
- **Direct-edit hand model (Model D):** a tile tap toggles that ingredient in the category's **HandSession pins**; the 選択中 strip shows the pins. There is no second "pending" set. (Alternative Model P = pending picks + a commit button is evaluated in §6; it keeps OD-2's wording literally but needs a commit step and a discard rule.)
- **Tray consumes the hand only when `HAND_ENFORCEMENT_ENABLED` is true.** R5 lands the wiring + tests; the production flag flips in R6 (§16).
- **Entry decoupled from the pager** (§10): `pantryAvailable` is computed from ownership, and the entry keeps its place in the reserved utility row.
- **Capacity: 12** (§9), applied through `handCapacityFor`.
- **Hints do not enter the hand in R5** (`NO_DISCLOSED_HINTS` stays); no hint → pantry deep link in R5 (§12).
- **No new save field** (§13).

---

## 4. State ownership

| State | Owner | Lifetime | Save | Notes |
|---|---|---|---|---|
| `pantryOpen` | `GameScreen` | while GAME is mounted | no | unchanged |
| `activeShelf` | `IngredientPantry` local | one open | no | R4, OD-R4-2 |
| `searchText` (new) | `IngredientPantry` local | one open; reset on close | no | never lifted; never in `GameState` |
| **HandSession pins** (new wiring) | **`App`** (session holder, next to `selectedIngredientId`) → `GameScreen` → tray / pantry | current app session, across FREE rounds; lost on reload | **no** | `GameScreen` unmounts between rounds; the pantry unmounts on close. `sanitizeHandSession` guards any restore |
| pending picks (Model P only) | `IngredientPantry` local | one open | no | discarded on close unless committed |
| `selectedIngredientId` | `App` (unchanged) | round | no | separate from pins/picks (OD-2) |
| `usage` (favourite / recent) | none in R5 (`emptyUsageSession()` as in R3/R4) | — | no | do not introduce a usage store in R5 |
| placed ids | derived from `state.pizza` (the reducer) | round | — | read-only input to the hand; source field to be confirmed at R5-c |

Rule: **exactly one writer per state** — the pantry calls `onHandChange(nextSession)`, `App` owns the value; `GameScreen` never mutates it; `IngredientTray` only reads the resolved hand.

---

## 5. Component boundaries

| Unit | Responsibility | Must not |
|---|---|---|
| `catalogQuery` / `catalogText` | search + shelf + owned scope (already there) | know pins, hand, selection |
| `handSession` | pin operations, `resolveHand` | classify, search, read hints, touch stock |
| new pure `handTray` helper (R5-c) | hand → tray page items (catalog order), page-level visible set, selection-after-change on the page level | import UI |
| `IngredientPantry` | search box, chips, list, 選択中 strip, calls `onHandChange` | dispatch game actions, touch `selectedIngredientId`, read hint/recipe data, hold pins |
| `IngredientTray` | render the resolved hand / today's list; call the existing `onClearSelection` | know about the pantry or search |
| `GameScreen` | eligibility, `pantryAvailable`, open/close, passes the resolved hand and `onHandChange`, evaluates #197 after a hand change | own pins |
| `App` | owns pins (and `selectedIngredientId`) | know shelves / search |

Boundary tests: extend the R4 allow-list so `IngredientPantry.tsx` may additionally import `handSession` (operations) and `catalogText` only through `catalogQuery`; `IngredientTray.tsx` may import the new tray helper; `workingSet` / `hintDisclosure` stay unimported by production except through `resolveHand`.

---

## 6. Search contract

1. **Scope:** OWNED rows of the **active category** only (`queryCatalog` + the category filter R3/R4 already apply). No cross-category, recipe, attribute, ingredient-property or fuzzy search; no operators.
2. **Match:** `matchesSearch` (NFKC, katakana→hiragana, lower-case, `ー`/spaces/`・` ignored) on `nameJa` (+ `readingJa` when a production reading exists — there is none today). Substring match on the normalised text. Empty / whitespace-only = no text filter.
3. **AND semantics:** `shelves` ∧ `text` ∧ owned ∧ category. The chip row stays derived from the category's owned rows **independent of the text** (so chips never appear/disappear while typing and the fixed slot never reflows). Result may be empty; the empty text is neutral (「該当する材料がありません」) and identical whether the string matches an unowned ingredient or nothing.
4. **Order:** unchanged (`catalog` order, zero-stock last). No relevance ranking, no "did you mean", no suggestions / autocomplete / history / placeholder example that names an ingredient.
5. **Reset / clear:** ✕ (≥ 44px) clears the text and keeps focus in the field; closing the sheet resets text **and** shelf; changing the shelf does **not** clear the text (AND), it resets the list `scrollTop = 0` (R4); changing the text also resets `scrollTop = 0`. Escape keeps the R3 contract (closes the sheet from anywhere, including the field) — recommended for simplicity; a "first Escape clears" variant is an Owner Decision (OD-R5-8, low).
6. **IME:** filter on the committed `input` value; do not treat `isComposing` partials specially except that an in-progress romaji/kana composition must not throw or flash a wrong empty state (test with a composition event sequence).
7. **Availability:** show the search field only when the category's owned rows exceed one tray page (> 6). Below that the search costs 52px for nothing (sauce 3, cheese 4). Derived from the player's own rows (privacy-neutral).
8. **Announcements:** no result count anywhere (visual or `aria-live`); at most a fixed 「絞り込みました」 status without numbers (or none — consistent with R4's "no live announcement").
9. **`inputMode="search"`, `enterKeyHint="search"`, `autocomplete="off"`, `autocapitalize="off"`, `spellcheck=false`, `maxLength`** (≈ 20) — the text is never persisted, logged or dispatched.

## 7. #197 contract (Owner: not applied in R4; applies in R5 only when the Builder visible hand actually changes)

Definitions:

- **Visible set** = the ingredient ids on the tray page currently on screen (the tray's own definition; #197's `goToPage` rule). *Not* the whole hand and *not* the pantry list.
- **Builder visible hand change** = a change to what the tray shows: (a) a pin add / remove / clear that changes the resolved hand membership or order while enforcement is active; (b) the tray page index re-clamped by a shorter hand; (c) hand recomposition at round / step start (see below).

Rules:

1. **Pantry-only actions never clear the selection:** opening/closing, shelf change, search change, scroll, toggling a pick in the pantry when it does not change the resolved tray (enforcement off, or the hand is inactive because owned ≤ capacity). Same as R4; pinned by the existing tests.
2. **When the resolved tray page does change** (Model D: at the moment of the pin change; Model P: at commit), compute `selectedIngredientId`'s visibility on the page that will be shown afterwards. If it is not on that page → `onClearSelection()` (the existing callback). If it was never visible (e.g. another category) → leave it alone (same as `selectionAfterVisibleChange`).
3. **Page reset:** after a hand change the tray goes to page 0 (recommended — the alternative, preserving the index, silently moves items across pages). The selection survives only if it is on page 0 afterwards.
4. **Gap to fix in R5:** `selectionAfterVisibleChange(selected, handBefore, handAfter)` compares *hand* sets, but the tray invariant is *page* sets. R5 must add a page-level variant (`visibleBefore = current page ids`, `visibleAfter = page 0 of the new hand`) — or feed the existing function page arrays. Wiring the hand-level version unchanged would leave a selection on page 2 while page 1 is displayed (an invisible selection = the #197 bug).
5. **Placed / step-start:** the hand at a step start is recomposed from pins + auto sources; the App already clears/reset the selection on step and round change (`App.tsx` ~290, ~317), so no extra clear is needed there. Tested rather than assumed.
6. **Picks are not the selection** (OD-2): a pick is never cleared by filter/search/shelf; it is always visible in 選択中. `selectedIngredientId` is never set by the pantry in R5 (no "tap in pantry = select for placing"; placing stays a tray action).
7. **Test-mutation targets:** selection cleared on shelf/search change (must NOT); selection not cleared when it leaves page 0 (must); page-level vs hand-level confusion.

## 8. Pick contract and hand-editing contract

### 8.1 Pick model (decision OD-R5-2)

| | Model D — direct hand edit (recommended) | Model P — pending picks + commit |
|---|---|---|
| Tap on a tile | toggles a HandSession pin immediately | toggles a pending pick |
| 選択中 strip shows | the pins (the hand's explicit part) | the pending picks |
| Extra UI | none (a `クリア` for pins) | 「手元にセット」 commit + discard rule on close |
| States | 1 (`HandSession`) | 2 (pending + pins) — the OD-2 "pending set" |
| #197 timing | at each pin change (sheet is open; inputs paused, so only the selection clear matters) | at commit |
| Risk | accidental tap changes the hand (undoable by a second tap; the tray is unchanged until enforcement) | forgotten uncommitted picks; committed-vs-shown drift |
| OD-2 wording | satisfied (picks kept across filter/search/shelf; pinned 選択中 area; never hidden) | satisfied literally |

OD-2 asks for a pinned 「選択中」 area and separation from `selectedIngredientId`; both models satisfy it. Model D removes a whole state and the discard question, so it is recommended; Model P is the fallback if the Owner wants an explicit "confirm".

### 8.2 Operations (Model D, over the existing pure API)

| Action | API | Contract |
|---|---|---|
| Add pick | `addToHand(session, [id], ctx)` | accepted only if OWNED and in the category (already enforced). If the pins would exceed `capacity − placedCount`, the add is **blocked** with a neutral message (「手元がいっぱいです。外してから追加してください」); no silent eviction of a pin. |
| Remove pick | `removeFromHand` | works for pins; **refused for a placed ingredient** (§8.4). |
| Clear picks | `replaceHand(session, [], ctx)` | clears pins only (placed stay; auto fill refills). Label 「おまかせに戻す」 (not 「すべて外す」), because the hand is never empty. |
| Replace | `replaceHand` | internal / reset use only (clear, prune). **No** UI "replace hand with these picks" in R5 — there is no multi-select-then-apply flow in Model D. In Model P, commit = `replaceHand(session, picks)` per category (replace, not append), so the strip and the hand always agree. |
| Prune | `pruneHand` | on open and on round start: drops pins that are no longer owned (e.g. a reset). |

### 8.3 What "the hand" actually is (an important clarification)

`selectWorkingSet` fills the hand to capacity when active: `placed > pinned > (hint) > favourite > recent > new > fill`. So with > capacity owned, the hand always has `capacity` items; a pin **displaces the last automatic item**, and the automatic part can change between rounds (`recent` / `new` derive from acquisition order; `emptyUsageSession()` means favourite / recent are empty today, `new` = recently acquired, `fill` = catalog order, zero-stock skipped). Consequences:

- The 選択中 strip must show **pins** (explicit), not the whole hand.
- Each pantry tile should show a 3-state cue: **手元に固定** (pinned) / **手元** (in hand automatically) / no mark (not in hand). Tapping an automatic-hand tile pins it (no visible change to the tray); tapping an unmarked tile pins it and displaces the last automatic item. This is more UI than "in / out"; the simpler alternative is **pins-only hand** (no automatic fill for the pins-active case, hand = pins ∪ placed, empty pins ⇒ deterministic fill). That changes R2's approved source order and is an Owner Decision (OD-R5-3): recommend **keep R2's order** and show the 3-state cue, because a hand that is empty on first use is worse than a deterministic fill.
- Displaced automatic items are player-owned ingredients (no privacy issue), but the tray order must stay **stable**: the tray shows hand items in **catalog order** (not source order) so muscle memory survives a pin (required test).

### 8.4 Placed-ingredient protection

- Placed ids (on the pizza now) are the top source; they can never be evicted, and their pin/remove control is disabled (`aria-disabled`, no tap effect, explained by 「配置ずみ」), including when stock has dropped to 0.
- A placed ingredient counts toward capacity (it occupies a slot).
- If `placed > capacity` (a single round with more distinct placed ingredients than capacity) the hand keeps all placed (`overflowIds` is for pins only); pins are dropped last-added-first. UI shows no error; the strip greys the overflow pins. Unlikely with 12 (recipes need ≤ 4) but possible in free play; needs a test.
- Where the placed ids come from in `GameState` is a to-verify item at R5-c (the reducer's `pizza` shape); the pantry must not read reducer internals — `GameScreen` passes `placedIds`.

### 8.5 Zero inventory

- Existing pins stay when stock reaches 0 (LC-OD-17: explicit choices stay; R2 API accepts them). The tile shows `×0`; the Builder chip is disabled (EP3).
- **New** picks of a `×0` tile: recommended **not pickable** (tile `aria-disabled`, same visual as today's `×0` grey) — a `×0` pick wastes a hand slot and produces a disabled chip. This is stricter than the R2 API (which accepts zero stock); the guard belongs in the pantry, not in `handSession` (Owner Decision OD-R5-6, small).
- Auto sources skip zero stock (unchanged); a category where every owned item is `×0` shows the R3 list unchanged.

### 8.6 Capacity excess and interaction with categories

- Hand is **per category** (`HandSession` = sauce / cheese / topping). The pantry edits only the active step's category, matching the tray. An unedited category uses its deterministic fill.
- Capacity excess = blocked add (§8.2) when pins + placed = capacity; visual: strip shows `n / cap`, the add is refused with the neutral message, no eviction, no toast that names anything.
- With `HAND_ENFORCEMENT_ENABLED=false` (R5 production state) the resolved hand is inactive (`handCapacityFor` = owned count): pins are stored and shown, the tray is unchanged, and **the strip must not promise an effect** (see the R5-b/R6 note below).

Note (R5-b/R6): while enforcement is off, showing 「選択中 n / 12」 would imply a 12-limit that is not enforced. Options: hide the strip until R6, or show it with the pins but no `n / cap` before the flag. Recommended: ship R5 behind an **internal capability switch** (an `IngredientPantry` prop set by `GameScreen` from `HAND_ENFORCEMENT_ENABLED`) so the pins UI is not production-visible before enforcement; R5 tests force it on. This is what makes "R5 implemented, R6 enables" coherent (§16).

---

## 9. Hand capacity: 9 vs 12 (OD-R2-1) — Fresh Audit

Geometry (R2 harness, Chromium, measured): stage Ø, dock, tray, chip and pager row are **identical** for 9, 12 and today's 22 at all four viewports (dock already reserves two chip rows + pager whenever a step exceeds 6). So geometry does not decide. Comparison on the other axes:

| Axis | 9 | 12 |
|---|---|---|
| Tray pages | 2 (6 + 3) | 2 (6 + 6) |
| Free cells | 3 free cells on page 2 (room for an in-grid 食材庫 tile — but only on page 2) | none; entry stays in the pager row |
| Reach of 22 toppings | 41 % without the pantry | 55 % |
| Recipe coverage | ≤ 4 toppings per recipe ⇒ both hold a whole recipe + spares; 9 leaves 5 spare, 12 leaves 8 | same |
| Discoverability (finding a topping) | more pantry trips (a 22-set: 13 hidden vs 10) | fewer trips |
| Mis-tap / thumb | same chip size (118×64 / 108×64, 58 at short); page 2 with 3 chips leaves an empty band under them (odd), 12 gives two balanced pages | balanced |
| Mass-catalog scaling (62: 42 toppings) | 33 hidden (79 %) | 30 hidden (71 %) — both rely on the pantry; the *hand* helps little either way |
| **Sauce / cheese in the 62 catalog** | **10 / 10 owned > 9 ⇒ the hand becomes active on SAUCE and CHEESE** (sauce is the step where the player must find *the* sauce; hiding sauces is the worst place to enforce) | **10 ≤ 12 ⇒ inactive** (sauce/cheese unchanged until > 12) |
| Production (29): sauce 3 / cheese 4 | inactive | inactive |
| Search/pantry load | pantry needed earlier (7+ owned toppings already leave the 6-per-page tray; at 10+ with 9 the hand hides items) | hides items only above 12 |

Recommendation: **12**, applied through `handCapacityFor`. The decisive evidence is not geometry: it is the sauce/cheese counts at 62 (the 9 candidate activates the hand on steps where hiding an ingredient is harmful) plus a balanced two-page tray and fewer pantry trips. Two caveats to carry into the Owner Decision: (1) a real-device thumb / mis-tap comparison is still owed (R2 said so; the harness is re-runnable); (2) a variant "enforce the hand on TOPPING only" would remove the sauce/cheese concern entirely and make 9 viable — that is a separate policy change (OD-R5-4) and is not recommended before the 62 catalog exists. Capacity stays an argument, not a constant in the UI.

---

## 10. Pantry availability and entry placement (OD-R4-3)

### 10.1 Availability contract

Today: `pantryAvailable = eligible ∧ PREPARE ∧ step ≠ DOUGH ∧ dockReserve.pager`, and `dockReserve.pager` = "some step's category has > 6 owned" (from `trayIngredientsFor`, *all-owned*). Hazard (OD-R4-3): once the tray is fed from the **hand**, anyone who re-derives `dockReserve` from the hand size couples the entry to the hand; and any hand ≤ 6 (or a different `pagerNeeded`) would remove the entry exactly when the pantry is the only way to change the hand.

Recommended contract (R5-a, before any hand wiring):

```
pantryWorthwhile(state)  = some step category of the round has  ownedCount(category) > MAX_INGREDIENT_PALETTE_SLOTS
                           (computed from OWNERSHIP, never from the hand, never from dockReserve.pager)
pantryAvailable          = isLargeCatalogEligible ∧ PREPARE ∧ step ≠ DOUGH ∧ pantryWorthwhile
dockReserve.utilityRow   = pager ∨ pantryWorthwhile      // the reserved 28px row; pager UI inside stays pager-only
```

Today `pantryWorthwhile ⇔ dockReserve.pager` numerically (same threshold, same source), so **layout is byte-identical** (Δ 0px) — the split is logical. After R5-c the tray count comes from the hand; `pager` is then a tray-page fact (hand > 6) and can disappear independently, while `utilityRow` (and the entry) does not. A test pins: enforcement forced on, hand ≤ 6 (or one page) ⇒ entry still present; ownership ≤ 6 in every category ⇒ no entry (no room by design).

### 10.2 Placement options

| Option | Where | Stage floor / dock Δ | Hit target | Verdict |
|---|---|---|---|---|
| **E1 (recommended)** | Left edge of the existing 28px utility row (R3), row reserved by `utilityRow` | Δ 0 (measured at all four viewports in R3) | 44px via `::after` (≤ 2px overlap of one chip's bottom border, audited) | Keep; decouple the *reservation*, not the geometry. |
| E2 | Centre of the row, pager moved right | Δ 0 | same | No gain; moves the pager (regression surface). |
| E3 | In-grid 食材庫 tile in the tray | Δ 0 only for hand 9 page 2 | 118×64 (better) | Not on page 1; changes tray item count / paging; rejected. |
| E4 | Top HUD / header button | unmeasured; the DM-3R-0 HUD floors (Free 269 / Dinner ≈ 236 at 390×664) | 44px possible | Adds a competing control near the hint button; only if E1's overlap is rejected by the Owner. |
| E5 | Floating button over the stage | violates the stage floor | — | Rejected (OD-B3). |

Viewport check (all from R3/R4 measurements; none re-measured here): 390×844 (stage 290, dock 174), 360×800 (273.6 / 174), 390×664 (269.1 / 162), 360×640 (245.1 / 162) — E1 changes none of these because the row already exists in every eligible profile. E1's residual issues are the R3-documented ≤ 2px overlap and "no entry when no step pages" (correct: nothing to browse).

### 10.3 Sheet height budget (R5 additions)

R4 measurements: sheet = 70 dvh (590.8 / 560 / 464.8 / 448); fixed chrome (header + subtitle + gaps) = 101px; chip slot 54px. R5 adds: search (44 + 8 gap = 52, est.) and a 選択中 strip (44 + 8 = 52, est., only while ≥ 1 pick, else 0).

| Viewport | list h (R4, with chips) | + search | + strip | rows visible (78px each) |
|---|---|---|---|---|
| 390×844 | 435.8 | 383.8 | 331.8 | ≈ 4.2 |
| 360×800 | 405 | 353 | 301 | ≈ 3.9 |
| 390×664 | 309.8 | 257.8 | 205.8 | ≈ 2.6 |
| 360×640 | 293 | 241 | 189 | ≈ 2.4 |

At the smallest viewports the list falls under three rows with everything visible. Levers (Owner decision OD-R5-5; all measurable in R5-a, none decided here): **L1** raise the sheet from 70 dvh to the #304 ceiling (`100dvh − safe-top − 20px`, ≈ 620 at 640, +172px) — the R3 note already reserved this as a Human Feel call; **L2** put the search field on the subtitle line (saves ≈ 24px); **L3** show search / chips only when needed (search > 6 rows, chips ≥ 2 shelves — already the R4 rule); **L4** make the strip one line of compact tiles instead of a separate 44px row. Recommended: L1 + L3 (+ L2 if L1 is refused). Stage / dock are untouched in every lever (the sheet is a fixed overlay).

---

## 11. Mobile layout analysis (R5 additions)

- **Tap targets:** search field ≥ 44px tall, ✕ ≥ 44×44, 選択中 remove ≥ 44px (the tiles' remove control is the tile itself in the strip), tiles are ≥ 44px already (≈ 70px), 閉じる 44px unchanged. Tile tap toggles a pick, so a scrolling drag must not toggle it (use `click`, not `pointerdown`; verify with a touch-scroll e2e).
- **iOS keyboard (P7, blocker for R5-a exit):** `dvh` does not shrink for the software keyboard; a field at the top of a 70 dvh sheet keeps the field visible but the lower list can end under the keyboard, and Safari may scroll the page to reveal the focused field. Requirements: page/body must never scroll; the field stays visible; the list stays reachable; closing the keyboard restores the layout. Needs a real-device iOS test (Playwright WebKit does not emulate the keyboard). Mitigation candidates: `visualViewport`-based sheet height only while the field is focused; or place the search field so it stays above the keyboard by construction; both belong to R5-a.
- **Scroll ownership:** the list stays the only vertical scroller; chip row and strip scroll horizontally only (`overscroll-behavior-x: contain`); the strip is not a second vertical scroller (single row, horizontally scrolling, `min-width:0`).
- **Fixed slots:** search, chips and strip are each `flex: none`; the strip's slot is reserved only while ≥ 1 pick (the list absorbs the change, as R4 chips do) — sheet outer bounds never change.
- **Zero/few results:** grid + empty text stay inside the scroller (R4 rule); sheet bounds identical for 0 → many rows.
- **Viewports for the e2e:** 390×844, 360×800, 390×664, 360×640 (same four as R3/R4); WebKit only in CI.
- **A11y:** field `aria-label="材料を検索"` (no example text), `role="search"` wrapper, ✕ labelled 「検索をクリア」; picks: each tile `aria-pressed` (toggle button semantics — R4 tiles are non-interactive `li`s, so the tile becomes a `<button>` inside the `li`); strip is a labelled group with per-item remove buttons; disabled (placed / ×0) use `aria-disabled` + description; focus stays in the sheet after every action; Tab order: 閉じる → search → ✕ → chips → strip → list; Escape closes (R3).
- **Input pause:** cooking inputs stay paused while open (R3); the pantry never places, so no stock/scoring effect.

---

## 12. Privacy analysis (Hint 5.0 contract unchanged)

| Surface | Rule | Why safe / test |
|---|---|---|
| Rows | OWNED only via `queryCatalog` (no LOCKED / NEW-only / silhouette / `???`) | unchanged; search & shelves are ANDed on top; nothing widens the scope |
| Search as an oracle | text is matched only against owned rows; an unowned or non-existent string returns the same neutral empty result | no way to probe unowned names; no suggestions / history / placeholder names / "did you mean"; the text is never persisted or dispatched |
| Chips | derived from owned rows, independent of the text | a shelf without an owned row has no chip (R4) |
| Counts | **none**: no result count, shelf count, category count, "n種", `aria-live` number, no `total` in the DOM; the only numeric surfaces are `×stock` (own inventory) and — if the Owner allows it — the hand indicator `選択中 n / cap` (own pins vs a constant capacity; never a catalog total). OD-R5-7 | Phase 5 (OD-CT-6) owns counts; test: no digit in the sheet except `×n` / the allowed hand indicator |
| Hand | pins are the player's own choices; automatic tiers use only owned ids, stock, catalog order, acquisition order | `resolveHand` keeps `NO_DISCLOSED_HINTS`: **no hint tier in R5** |
| Empty states | 「まだこのカテゴリの材料を持っていません」 / 「該当する材料がありません」 mention nothing unowned | both derive from owned rows |
| Recipes / targets | the pantry, search and hand import no recipe, target, matcher, near-miss, reserve, Dinner target | boundary test extended (as R4) |
| Timing / focus / DOM | no hidden nodes for unowned items; no `data-*` naming an unowned id | DOM scan test |

**Hint 5.0 integration (item 8).** What the sheet *displays* (`Hint5Presentation`): completed rungs — SAUCE / CHEESE / KEY_TOPPING (named ingredient ids, or 「なし」), STRUCTURE (a line), SUB_CLASS (a class view 「🥩 肉系」, symbol + label, never an ingredient) — plus the player's own legacy known names. Findings:

1. **The class vocabulary already aligns:** shelf ids for toppings *are* `AttributeFamilyId` (the same 7 families, Hint 5.0's order; `ingredientShelf.ts` states it). A displayed 「🥩 肉系」 maps 1:1 to the 肉 shelf chip. The **labels differ** (the shelf UI label is not Hint 5.0's label, per `ingredientShelf.ts`; e.g. 肉 vs 肉系) — the player links them by meaning; do not "fix" it by borrowing the hint label or symbol into the chip (that would make a chip look like a hint answer).
2. **Sauce / cheese / key topping:** the sheet shows the name after purchase; the natural path is to look it up in the pantry — by the category chip-less list (sauce/cheese steps) or by search on the topping step. With an unowned name the search returns the neutral empty result, exactly like any other unowned string.
3. **Recommendation for R5: no automatic hint → pantry link, no hint tier in the hand, no hint-driven chip highlight.** The natural path is manual and adequate: chip 肉 on the topping step; search for the named key topping; sauce / cheese steps have ≤ 4 items. A deep link (「食材庫で探す」 on a displayed row that presets the shelf / search *from displayed data only*) is a good later slice (LC-4) but needs its own audit against `Hint5Presentation` (`hintDisclosure.ts` never reads it — R1 flagged this) and the rule of OD-B5: re-show only what the ladder displayed, at the displayed granularity, no new k ≥ 2 rule. Constraints to record now: a preset shelf must exist as an owned chip or be ignored **silently**; a preset search must be a displayed name only; the pantry must not indicate "the answer is here".
4. **Hint sheet and pantry are mutually exclusive overlays** (both pause inputs); the hint state is never read by the pantry.

---

## 13. Persistence analysis (item 10)

- **Keep session-only pins** (LC-OD-5 / OD-R2-3): App-level state, lost on reload, kept across FREE rounds within the session. **No save schema change is required by R5.**
- What is lost on reload: pins only. The hand falls back to the deterministic automatic composition (`fill` catalog order; `new` from the existing acquisition-ordered `ownedIngredientIds`; favourite/recent empty). Cooking state itself is not persisted mid-round (`persistence.ts` is progression-only), so a reload restarts at least the round; the pin loss adds one re-pick at worst.
- Is it a problem? Only if players curate a hand once and expect it forever. That is not established without usage data; the cost of a new field is real (schema version, migration, forward-compat, cross-device). Recommendation: **A + derived B** (session pins + acquisition-ordered "new" tier), revisit at LC-9 with evidence (how often pins are set / lost). Named trigger for revisiting: the Owner's HV reports "my hand is gone after reload" as a defect, or telemetry (if any exists) shows repeated re-picking.
- Cross-round lifetime needs an `App`-level holder (§4). If that is refused, the fallback is per-round pins (lost on leaving GAME), which is simpler and also acceptable for R5 — Owner Decision OD-R5-9.
- Not persisted, never: search text, shelf, pending picks, scroll.

## 14. Dinner / guided / Lunch Rush isolation (item 11)

- Gate stays `isLargeCatalogEligible` (`FREE_COOK ∧ dinner === null`) evaluated in `GameScreen`; never `freeCook` alone, never `recipeFreeTray` (Dinner has `recipeFreeTray` true and `freeCook` false — the classic trap).
- With the gate false: no entry, no sheet, no search, no picks; `resolveHand` returns `null` ⇒ the tray uses today's list; `App` never creates pins for a non-FREE round; Dinner's paged tray and stage floor (≈ 236 at 390×664) are untouched; guided and Lunch Rush trays are recipe-only and stay so.
- Required regression: the R3/R4 gate tests stay; add: pins existing from an earlier FREE round do **not** affect a Dinner tray in the same session (the strongest isolation test — session pins are the new cross-mode state), and `resolveHand(…dinner…) === null` with pins present.

---

## 15. Proposed implementation slices (each ends in tests, mutation gate, Result report; UI slices add HV video + before/after screenshots per the policy)

| Slice | Content | Builder visible set changes? | #197 |
|---|---|---|---|
| **R5-0** (docs, optional) | Owner answers OD-R5-1…9 into the handoff | no | — |
| **R5-a Availability split** | `pantryWorthwhile` from ownership; `dockReserve.utilityRow`; entry gate uses it; tests that pin equality with today's layout and the "pager gone ⇒ entry stays" case (with an injected hand size) | no (Δ 0 layout) | not applicable |
| **R5-b Search** | search field (+✕), `queryCatalog({text})`, availability rule (> 6), layout lever chosen (OD-R5-5), iOS keyboard verification, IME test, privacy tests | no | not applicable (pantry list only) |
| **R5-c Picks + 選択中** | `App`-level pins, `onHandChange`, strip, tile toggle (Model D or P), placed / ×0 / capacity rules, 3-state cue; pins stored but the tray is unchanged (enforcement off) | no in production; yes under forced-on tests | contract §7 implemented + tested with enforcement forced on |
| **R5-d Tray consumes the hand** | tray reads `resolveHand` (catalog order, page reset), reserve/pager from the hand size, page-level `selectionAfterVisibleChange`; **still `HAND_ENFORCEMENT_ENABLED = false`** | production no (flag off); tests yes | wired and dormant in production |
| **R5-e Verification** | e2e at four viewports (WebKit in CI), Dinner isolation, mutation additions, HV (390×844) + screenshots | — | — |

R5-a and R5-b are independent and can land in either order; R5-c/d must follow R5-a. No slice flips the flag (R6).

## 16. R6 enablement gate — required before `HAND_ENFORCEMENT_ENABLED = true`

All must hold (each with a named test):

1. **Reachability:** every owned ingredient of every category is reachable — visible in the hand, or reachable in ≤ 1 pantry open + ≤ 1 tap — for 12 and 22+ owned toppings and at 62 fixtures; no owned ingredient can become unreachable (R2's promise, now with real hands). Includes zero-stock and placed.
2. **Entry independence:** the pantry entry is present whenever `pantryWorthwhile`, whatever the pager/hand size; verified on all four viewports with the stage / dock / pager row unchanged (OD-R4-3).
3. **#197:** page-level clear implemented and pinned (§7); no invisible selection after any pin change / clear / round / step change; no clear on pantry-only actions.
4. **Placed protection, capacity excess, ×0 rules** (§8) implemented and tested; the hand never evicts a placed ingredient.
5. **Stability:** tray order = catalog order; a pin never re-orders unrelated tiles; page resets to 0 after hand change (or the alternative is explicitly chosen).
6. **Capacity chosen (OD-R5-1)** and the real-device thumb / mis-tap check done; the sauce/cheese-at-62 consequence acknowledged.
7. **Privacy:** no counts / LOCKED / NEW-only / `???` / unowned names; no hint tier in the hand; DOM and a11y tree scans pass; Hint 5.0 suites unchanged and green.
8. **Dinner / guided / Lunch Rush unchanged** (session-pin isolation test).
9. **iOS keyboard / search** verified on a real device; WebKit gate green.
10. **Human Verification** video + screenshots per the policy; Owner approval of the Human Feel (this is the first slice that changes what the tray shows).
11. **Rollback:** the flag is the rollback; with it `false` the tray must be byte-for-byte today's (regression test kept).

Explicitly *not* required for R6: cross-category pantry, hint deep link (LC-4), save persistence, counts, 62-catalog activation, Dinner.

---

## 17. Cross-category decision (item 6)

Evidence from the real Builder flow (§1 fact 3): steps are forward-only, placement is category-locked per step, and a category's tray is used only during its own step. A player editing the sauce hand while on the topping step gains nothing in that round; the topping tray they need is the one they are on.

| Option | Description | Pros | Cons |
|---|---|---|---|
| **A. Active-category pantry (recommended; R3/R4 behaviour)** | the sheet shows / edits only the step's category; sauce = sauce, cheese = cheese, topping = shelves | matches the tray and the step; no new chips; minimal risk; R4-tested; hand and pins are per category anyway | the player cannot pre-arrange the next step's hand (they can when they reach it: the pantry is 2 taps away) |
| B. All-category pantry with category + shelf chips | one sheet, ソース / チーズ / 分類 chips; edits any category's hand | pre-arrange multiple hands in one visit; reuses shelf ids `sauce` / `cheese` | second filter axis, longer chip row (already scrolls at 702px), tiles from three categories under 「すべて」, hand per category confuses the 選択中 strip (three lists), #197 has to consider off-step categories, larger e2e/privacy surface, and no in-round benefit (steps forward-only) |
| C. A, plus a category switch in the header (view only) | peek at other categories | discoverability | read-only peeking has no job; adds a control |

Decision: **A** for R5. B stays a candidate only if HV shows players wanting to prepare the topping hand before the sauce step; that is a hypothesis, not evidence. The `ソース` / `チーズ` shelves exist in `ingredientShelf` and would be natural chips for B, so B is not blocked technically — recorded for the Owner (OD-R5-4).

---

## 18. Required tests (by slice)

Unit / component (vitest): 
- **Search:** normalization cases (katakana↔hiragana, half-width, ー, spaces, ・); owned-only (unowned name returns empty, same DOM as gibberish); AND with shelf; chips independent of text; category scope; empty text = no filter; clear (✕) resets text and keeps focus; close resets text and shelf; `scrollTop = 0` on text and shelf change; no counts / suggestions / example placeholder; IME composition sequence; search hidden when ≤ 6 rows.
- **Picks / hand (Model D):** toggle add / remove; order kept; persists across shelf / search change (OD-2); shown in the strip even when filtered out; clear = `おまかせに戻す`; capacity block (no eviction, neutral message); placed protected (disabled, never removed, counts toward capacity, survives ×0); `×0` new pick refused / existing pin kept; `pruneHand` on unowned; per-category sessions independent; strip shows pins not the whole hand; 3-state cue; catalog-order tray; `sanitizeHandSession` on garbage.
- **Availability:** `pantryWorthwhile` from ownership only; entry present with hand ≤ 6 and enforcement forced on; absent when owned ≤ 6 everywhere; unchanged layout classes in the current configuration; source-level check that `pantryAvailable` does not reference `dockReserve.pager` / the hand.
- **#197:** not cleared by shelf / search / open / close / pick toggling with enforcement off; cleared when the selected item leaves page 0 after a hand change (enforcement forced on); kept when on page 0; page-level (not hand-level) — mutant test; other-category selection untouched; step / round change clears as today.
- **Privacy:** DOM / a11y scan: no LOCKED / NEW / `???` / silhouette / unowned names in any (shelf × search × pick) state; no digits except `×n` and the allowed hand indicator; `resolveHand` ignores hints (`disclosedHints` stays `NO_DISCLOSED_HINTS`; smuggled hint props change nothing); hint sheet state is never read by the pantry (import test).
- **Dinner / guided / Lunch Rush:** no entry / sheet / pins effect; session pins from a prior FREE round do not alter a Dinner tray; `resolveHand === null`.
- **Boundary:** extended allow-lists (§5); `workingSet` / `hintDisclosure` still not imported directly by production components; no save / persistence import in the pantry; `HAND_ENFORCEMENT_ENABLED` still `false` in R5 (pinned test that R6 replaces).
- **Mutation additions (examples):** search matches unowned; chips derived after text; pins cleared on shelf change; selection cleared on shelf change; hand-level instead of page-level clear; pantry gate references the pager again; placed removable; eviction of a pin at capacity; ×0 pick allowed; pins written to storage; Dinner reads pins; count rendered; hint tier enabled.

E2E (Chromium real layout; WebKit in CI; 390×844, 360×800, 390×664, 360×640): sheet bounds identical across search / shelf / picks states; search field and ✕ ≥ 44px; list is the only vertical scroller; strip does not scroll vertically; body never scrolls (also with the field focused); list ≥ 2 rows at every viewport with search + chips + strip (or the chosen lever); picks survive filter changes; tray unchanged with enforcement off; forced-on: tray = hand, pager/entry independence, stage / dock identical; Dinner has no entry; touch-scroll on the list does not toggle a pick; Escape closes from the field; focus returns to the entry. Real-device iOS keyboard check (manual, recorded in the Result).

## 19. Owner Decisions

| ID | Question | Recommendation |
|---|---|---|
| **OD-R5-1** | Hand capacity 9 vs 12 (OD-R2-1) | **12** (§9); real-device check before R6 |
| **OD-R5-2** | Pick model: direct hand edit (D) or pending picks + commit (P) | **D** |
| **OD-R5-3** | Hand composition: keep R2's pins + automatic fill (3-state tile cue) or pins-only | **keep R2 order**, show the cue |
| **OD-R5-4** | Cross-category pantry (A / B / C) and "enforce on TOPPING only" | **A**; no topping-only policy now |
| **OD-R5-5** | Sheet height lever: keep 70 dvh + L2–L4, or raise to the #304 ceiling (L1) | **L1 + L3** (measure in R5-b) |
| **OD-R5-6** | `×0` picks: refuse new picks of `×0` tiles (existing pins stay) | **refuse** |
| **OD-R5-7** | Show the hand indicator `選択中 n / cap` (own pins vs a constant; never a catalog count) | **allow**, and only when enforcement is active |
| **OD-R5-8** | Escape in the search field: always close the sheet (R3) vs first-Escape clears | **always close** |
| **OD-R5-9** | Pin lifetime: across FREE rounds (App-level) vs per round (GameScreen) | **App-level, session-only** |
| **OD-R5-10** | Pantry entry: E1 (keep placement, decouple the reservation) vs E4 (HUD) | **E1** |
| **OD-R5-11** | Hint → pantry in R5: none (manual) vs presets | **none in R5**; LC-4 later with its own audit |
| **OD-R5-12** | R5 slicing: R5 lands wiring dormant, R6 flips the flag (§16) vs R5 = enablement | **R5 dormant / R6 enable** |

Already decided and not re-asked: OD-1 (FREE only, Dinner excluded), OD-2 (picks ≠ selection; picks never hidden), OD-R4-1/2/3, OD-4, OD-B5 (Hint 5 privacy unchanged, no new k ≥ 2 rule), no counts before Phase 5, 62-catalog activation out of scope.

## 20. Blockers

**None for the audit.** Gating items (not blockers to Owner decisions; they gate the slices named):

1. **PR #306 (LC-R4) is not merged** — R5 implementation must start from main **after** it merges; this audit's PR #306 reading is at `ead02fb0…` and must be re-diffed if the PR changes.
2. **iOS keyboard behaviour** with a search field in a fixed sheet is unverified (needs a real device) — gates R5-b exit.
3. **OD-R5-1 / -2 / -3 / -5** are needed before R5-b/c layout and state are cut; OD-R5-1 is needed before R6, not before R5.
4. WebKit cannot run in this sandbox and `node_modules` is absent here: nothing in this document was test-executed; the R5 slices must re-measure every "est." number.
5. Two to-verify items for R5-c: the exact `GameState` source of `placedIds`, and Hint 5.0 family ↔ shelf label mapping (ids identical; labels differ by design).

**Status update (Owner Decisions recorded):** PR #306 (LC-R4) has since **merged** into main (`12725eb3461583a5349259868fe2e7163b3eacf0`). The audit body above was written against PR #306 HEAD `ead02fb0…` (unchanged content on main) and is kept as written; §21 supersedes §19's "Recommendation" column where they differ. Blocker 1 in §20 is resolved.

---

## 21. Owner Decisions — CONFIRMED (Owner Authority, recorded after the audit)

Status: **OD-R5-2 … OD-R5-12 are Owner-confirmed. OD-R5-1 is a confirmed *design candidate* only — final decision pending the R6 real-device Human Feel Gate ("R6 finalization pending").** Docs only: no production, save or PR change was made by recording these.

| ID | Decision (Owner) |
|---|---|
| **OD-R5-1** *(R6 finalization pending)* | Hand capacity **12 is kept as the current design candidate**. R5 is designed and verified assuming 12, but 12 is **not final**. 9 vs 12 is confirmed at the **R6 real-device Human Feel Gate** and only then finalized. |
| **OD-R5-2** | **Model D.** A pantry tile operation edits the `HandSession` pin **directly**. No pending picks + confirm two-stage state is introduced. |
| **OD-R5-3** | Keep R2's hand composition: **pins + deterministic automatic fill**. Not pins-only. |
| **OD-R5-4** | Keep the **active-category pantry**. No cross-category pantry in R5. **No topping-only enforcement.** |
| **OD-R5-5** | The pantry sheet grows, to accommodate search / selection UI, **toward the maximum usable viewport height**. No fixed value is finalized up front: **R5-b measures the 4 viewports (390×844, 360×800, 390×664, 360×640) and runs the iPhone real-device keyboard Human Verification, then fixes the safe maximum height.** Search is shown **only when needed**; the 選択中 area is shown **only while a pin exists**. A **collapsible selected strip is not adopted.** |
| **OD-R5-6** | An inventory-0 ingredient **cannot be newly pinned**. Existing pins keep the R2 contract and follow the prune / sanitize authority. |
| **OD-R5-7** | 「選択中 n/cap」 is **allowed**, but with `HAND_ENFORCEMENT_ENABLED=false` (R5) the **capacity UI is not shown in production**; it is shown when R6 enables enforcement. |
| **OD-R5-8** | Escape keeps the R3 contract: it **closes the sheet even while the search field is focused**. No "first Escape clears only the search" behaviour. |
| **OD-R5-9** | Pins are **App-level, session-only**, kept across round end / HOME / FREE restart; **no effect on Dinner / guided / Lunch Rush**; lost on reload / app restart; **no save schema addition**. |
| **OD-R5-10** | **E1.** Keep the current placement at the left of the utility / pager row; only the **availability / reservation authority** is separated from the pager: `utilityRow = pager OR pantryWorthwhile`. `pantryWorthwhile` is derived from **owned / catalog authority** and must not depend on hand availability or pager availability. **Stage / dock Δ0 is re-verified at the 4 viewports.** |
| **OD-R5-11** | R5 has **no automatic Hint 5.0 → Pantry preset / link**. The manual path stays. Reconsider only in a dedicated audit (LC-4 or similar). |
| **OD-R5-12** | R5 = **wiring, search, pin editing, #197, entry separation**. `HAND_ENFORCEMENT_ENABLED` **stays `false`**; it becomes `true` only after the R6 Gate (§16) is satisfied. |

### 21.1 #197 additional contract (Owner; refines §7)

- **`selectedIngredientId` is NOT cleared by:** pantry open / close, shelf change, search change, pantry scroll, or a pin change that **does not actually change the Builder visible tray**.
- The clear decision is made **only at the moment HAND enforcement actually changes the Builder tray's visible set.**
- **After a hand change the tray returns to page 0.**
- After the change: if `selectedIngredientId` is **not** on the now-visible page → **clear**; if it **is** → **keep**.
- **Being somewhere in the whole hand is not enough. The authority is the currently visible tray page** (this fixes the hand-level vs page-level gap of §7 item 4: R5 implements a page-level rule, not the R2 hand-level `selectionAfterVisibleChange` as is).
- OD-2 stands: picks / pins are never cleared by filter / search / shelf; they are a separate state from `selectedIngredientId`.

### 21.2 Consequences carried into the R5 slices (no new decision)

- **OD-R5-5 ⇒ R5-b:** the sheet-height lever is chosen by measurement (4 viewports + iPhone keyboard HV), not before; the 70 dvh → ceiling change is allowed in direction only. Search field: hidden when the category has ≤ 6 owned rows; strip: rendered only while ≥ 1 pin. R5-b's exit condition includes the real-device keyboard verification (§11).
- **OD-R5-7 ⇒ R5-c:** the pins UI's capacity indicator sits behind the internal capability switch tied to `HAND_ENFORCEMENT_ENABLED`; R5 tests force it on; production shows none.
- **OD-R5-10 ⇒ R5-a:** the source-level test that `pantryAvailable` / `pantryWorthwhile` reference neither `dockReserve.pager` nor the hand stays required; the stage / dock Δ0 e2e at the 4 viewports is required.
- **OD-R5-1 ⇒ R6:** the R6 Gate item 6 (capacity chosen + real-device thumb / mis-tap check) is where 9 vs 12 is finalized; `handCapacityFor` keeps capacity as an argument. R5 must not hard-code 12 in UI copy or layout.
- **§19 table:** the "Recommendation" column is now the record of what was recommended; the decisions above are authoritative. OD-R5-2 … 12 match the recommendations except OD-R5-1 (candidate, not final), OD-R5-5 (direction only, value by measurement) and OD-R5-7 (no capacity UI in production during R5).

---

**FINAL VERDICT: A. LC-R5 READY FOR OWNER DECISIONS** (original audit verdict; Owner Decisions since recorded in §21 — OD-R5-1 pending R6 finalization, OD-R5-2 … 12 confirmed)

(No blocker prevents the Owner from answering OD-R5-1 … 12. Implementation may begin only after PR #306 merges and the decisions are recorded; R5 must not flip `HAND_ENFORCEMENT_ENABLED`.)
