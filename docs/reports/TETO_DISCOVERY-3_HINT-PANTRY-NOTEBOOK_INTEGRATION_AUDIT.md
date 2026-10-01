# Discovery 3.0 — Hint × Pantry × Free Cooking × Trial Notebook Integration Audit

- Status: **READ-ONLY AUDIT.** No `src/` / `e2e/` / CSS change, no implementation, no PR, no merge. MC-1 is **not** implemented.
- Companion (kept unchanged): `docs/reports/TETO_DISCOVERY-3_MULTI-CANDIDATE_HINT_AUDIT.md` (the multi-candidate Hint audit, MC-1 proposal). §10 of this report revises what MC-1 should be.
- Audited `main`: `93ca1e404c4e942e48b69506ff600bd8fcdfbb51` (fresh `git fetch origin`; `origin/main` unchanged since the first audit).
- Evidence labels: **(verified)** = read in code / git / GitHub on this SHA, or reproduced with a throw-away `vite-node` probe (scratchpad only, not committed); *(inference)* = reasoning; *(to verify)* = left for the slice.

---

## 1. Large Catalog history (fresh)

Sources: GitHub PR state (`#272 #305 #306 #307 #308 #310 #312 #314 #318 #319`), `git log origin/main`, `git branch -r` ahead-counts, `docs/PROJECT_HANDOFF.md` ("Large Catalog UX — current SSOT"), the reports under `docs/reports/TETO_LARGE-CATALOG-UX_*`.

| Item | Status | Class | Notes (verified) |
|---|---|---|---|
| **#269** (Issue: LC-1 / LC-1b) | OPEN | OPEN | Origin Issue for the pure model. |
| **#272** LC-1 / LC-1b pure catalog model + scale fixtures | OPEN, unmerged, branch `claude/large-catalog-ux-design-sq8saf` (11 ahead of main, last commit 2026-09-28) | **OPEN + SUPERSEDED (in practice)** | SSOT OD-4: "frozen as the porting source, not rebased in place"; closing is the Owner's call. Its Owner Decision Gate / Fresh Design docs live **only on that branch** (read from there for this audit). |
| **LC-R0** foundation port (`src/logic/catalog/**`) | branch `claude/lc-r0-fresh-main-foundation`, 0 ahead of main, no PR of its own | **MERGED (landed inside #305)** | Content is in main (`src/logic/catalog/`). |
| **LC-R1** shelf authority (`queryCatalog({shelves})`) | branch `…lc-r1-shelf-authority`, 0 ahead, no own PR | **MERGED (inside #305)** | Same. |
| **LC-R2** working set / hand foundation (capacity policy, enforcement OFF) | branch `…lc-r2-working-set-foundation`, 0 ahead, no own PR | **MERGED (inside #305)** | Same. |
| **LC-R3** pantry sheet shell — **#305** | MERGED 2026-09-29 (`3b0da33`) | **MERGED + PRODUCTION-ON** | FREE-only entry in the pager row; read-only OWNED list. |
| **LC-R4** pantry shelf filtering — **#306** | MERGED 2026-09-29 | **MERGED + PRODUCTION-ON** | `ShelfChips` in the pantry. |
| **#307** docs: mark LC-R4 complete | OPEN | **OPEN + DOCS-ONLY** | Not needed for behaviour; main's handoff already records R4. |
| **LC-R5-a** pantry vs pager availability — **#308** | MERGED 2026-09-29 | **MERGED + PRODUCTION-ON** | Layout/availability split only. |
| **LC-R5-b** search / aliases / IME / keyboard fit — **#310** | MERGED 2026-09-29 | **MERGED + PRODUCTION-ON** | Real-iPhone HV PASS recorded in handoff. |
| **LC-R5-c** dormant pin foundation — **#312** | MERGED 2026-09-30 | **MERGED + FLAG-OFF** | Pin UI behind `HAND_ENFORCEMENT_ENABLED = false`. |
| **LC-R5-d** dormant tray hand wiring + #197 transition — **#314** | MERGED 2026-09-30 | **MERGED + FLAG-OFF** | Tray reads the hand only when the flag is on. |
| **LC-R5-e / R5-e-h** activation Fresh Audit + hardening — **#318** | MERGED 2026-09-30 (`6abddc7`) | **MERGED + DOCS/TESTS-ONLY** (flag stays OFF) | Verdict A: "R6 AUDIT-READY". |
| **R5 audit branches** (`lc-r5-fresh-audit-z4bga9`, `lc-r5-implementation-verification-jo557t`, `lc-r5b-*` audits/harness, `lc-r4-*-audit`, `lc-r5c-fresh-audit`, `pr272-catalog-ux-audit`) | not merged (1–4 ahead each) | **BRANCH-ONLY (DOCS/tools)** | Some are cited as authority (e.g. R5-b PreAudit §15–18 on `lc-r5b-pre-audit-mbinf3` @ `77482f5`). Not on main. |
| **LC-R6-a** Preview-activation Fresh Audit (`4d2d6ae`, `7727cdc`) | commits are **ancestors of main** but the report file was reverted off main (`89a23ee`); the file is **absent on main** | **DOCS-ONLY / history-only** | #319's body: "history-only authority, intentionally not re-landed". Records OD-R6a-1 = A2 and BL-2 verified. |
| **LC-R6-b** Preview-only Hand activation infra — **#319** | OPEN, `mergeable_state: clean`, base `6abddc7`, 886+/18−, 24 files | **OPEN + FLAG-OFF** (Preview-only variant; production literal `false`; committed `LC_HAND_PREVIEW_CAPACITY = null`) | WebKit gate must come from PR CI (could not run locally). |
| **LC-R6-c** Hand/Pin UI activation, **R6-d** HV, **R6-e** production activation | not started | **NOT STARTED** | Capacity 9 vs 12 undecided until the R6 Human Feel Gate. |
| Prior Category-Tabs work (#299 shelf foundation, #301 Shop, #302 Ingredients, #304 stable modal) | MERGED | **MERGED + PRODUCTION-ON** | `ShelfChips` / shelf authority come from here. |

Net: **R0–R5-e are all in main; search + shelf filter are live; pin + hand are in main but dormant (flag `false`); R6 activation is the open frontier (#319 open, R6-c/d/e not started).**

---

## 2. Pantry / Search / Category / Pin / Hand — current state on `93ca1e4`

Classification: IMPLEMENTED + PRODUCTION ON / IMPLEMENTED + FLAG OFF / BRANCH ONLY / DESIGNED ONLY / NOT IMPLEMENTED.

| Feature | Class | Evidence (verified) |
|---|---|---|
| Pantry component | **IMPLEMENTED + PRODUCTION ON** | `src/components/IngredientPantry.tsx` (358 lines); rendered by `GameScreen.tsx:888` |
| Pantry sheet / modal | **IMPLEMENTED + PRODUCTION ON** | fixed-height dialog (PR #304 pattern), pinned header, only the list scrolls; focus returns to the entry; background input paused |
| Entry condition | production-on, **conditional** | `pantryAvailable = isLargeCatalogEligible(state) && PREPARE && makingStep !== "DOUGH" && dockReserve.pantryWorthwhile` (`GameScreen.tsx:344-345`). `isLargeCatalogEligible` = FREE_COOK round and `dinner === null`. `pantryWorthwhile` = some step category has more than 6 OWNED ingredients (`pantryAvailability.ts`). No feature flag gates the entry |
| Ingredient search | **IMPLEMENTED + PRODUCTION ON** | shown only when the active category has > 6 owned rows (`showSearch`); name match with the three approved search-only aliases (onion/egg/mozzarella; `ingredientSearchAliases.ts`); IME contract; Mode C keyboard fit |
| Category / shelf filter | **IMPLEMENTED + PRODUCTION ON** | `ShelfChips`, derived from the OWNED rows; shown only when the rows span ≥ 2 shelves; filter state is local to the sheet (resets on reopen); no counts |
| Pin / unpin | **IMPLEMENTED + FLAG OFF** | `pinEdit.ts` (Model D), pin UI in `IngredientPantry` behind `handEditing = HAND_ENFORCEMENT_ENABLED` (`false`). With the flag off, tiles are plain read-only `<li>`; no badge, no strip |
| Pinned ingredients (「選択中」 strip, 「おまかせに戻す」) | **IMPLEMENTED + FLAG OFF** | same flag |
| Working set / hand | **IMPLEMENTED + FLAG OFF** | `workingSet.ts` (placed > pinned > hint > favorite > recent > new > fill), `handSession.ts`, `handTray.ts`; `resolveTrayHandIds` returns `null` while the flag is off |
| Session-only state | **IMPLEMENTED** | App-level `useState<HandSession>` (`App.tsx:237`); pantry shelf / search are local component state |
| Persistence | **NOT IMPLEMENTED (by decision)** | nothing in `persistence.ts`; OD-R2-3 / OD-R5-9: session-only; no save change |
| FREE integration | **IMPLEMENTED (entry + sheet); hand wiring FLAG OFF** | entry sits in the existing pager row; `trayHand` is relayed App → GameScreen → `IngredientTray handIds` (null today) |
| Feature flag | `HAND_ENFORCEMENT_ENABLED = false` (`handPolicy.ts`); `DEFAULT_HAND_CAPACITY_CANDIDATE = 12` (candidate only) | #319 adds a Preview-only variant (committed `null`); production literal stays `false` |
| Hint → pantry / hand ("LC-4") | **DESIGNED ONLY** | `hintDisclosure.ts` exists but `resolveHand` passes `NO_DISCLOSED_HINTS`; the file header says the attribute mapping "returns with LC-4 after an audit against the Hint 5.0 ladder". No UI link exists in HintSheet |
| Usage signals (favorites / recent) | **IMPLEMENTED as types only, never fed** | `usageSignals.ts`; the pantry passes `emptyUsageSession()`; nothing calls `recordUse` / `toggleFavorite` outside tests. The only live "recent" input is `recentlyAcquiredIds(ownedIngredientIds)` in `handTray` (acquisition order, OD-R2-2) |
| Pantry as an action surface | **NOT IMPLEMENTED** | the pantry never places an ingredient and never changes Builder selection (OD-2: separate states) |

**Production reach at the multi-candidate moment (verified probe, Dex 12 + onion):** owned = sauce 1 / cheese 2 / **topping 13**; owned toppings by shelf = herb 2, other 1, meat 4, vegetable 5, fruit 1 → `pantryWorthwhile = true`, the topping pantry shows search (13 > 6) and 5 shelf chips. At Dex 25: topping 22 (meat 4, vegetable 8, seafood 3, herb 4, fruit 1, spice 1, other 1). So **in the exact situation where the Owner saw no Hint, the player already has a working pantry with search and category chips.**

---

## 3. Owner's recollection — **PARTIAL**

Owner: 「食材庫の検索やピンどめ機能は、材料が増えたFree Cookingを扱いやすくするために実装していた」

- **Intent and flow: YES.** The formal flow in the Rebase Revision Gate §13 and the Owner Decision Gate (on #272's branch) is exactly: pantry (LC-R3) → shelf chips / search (R4 / R5-b) → ✓ **picks = pins** → hand / working set that feeds the FREE tray (R2 / R5-d) → activation (R6). Search and pins were built *because* the FREE tray had to scale (22 → 62 → 172 toppings, 6 per page). The Gate also states the hint connection as design intent (LC-OD-7: 「ヒントから食材庫へつながる」; "feature-hint answers open as a library filter at the answered granularity").
- **Implemented: PARTIAL.** Pantry, search and shelf filter are in main and **production-on**. Pin and hand are in main (#312 / #314 / #318) but **dormant** (`HAND_ENFORCEMENT_ENABLED = false`), so a player cannot pin today; the tray still shows every owned ingredient, 6 per page. The Hint → pantry link (LC-4) was never built.

So: the Owner's picture is true of the design and of the code; it is only half true of what a player can use today (search + category yes, pin + hand no, hint link no). I did not find any change of the flow's shape in git history: R5-c's Owner Decision OD-R5c-1 explicitly makes pin UI "go public together with hand behaviour when R6 enables the flag".

---

## 4. Current FREE 「具材」 (TOPPING) step in production (verified)

| Aspect | Current behaviour |
|---|---|
| What is listed | `IngredientTray`: `requiredItems = handIds ? … : trayIngredientsFor(activeCategory, {ownedIngredientIds, freeCook, recipe})`. `handIds` is `null` in production, so: every **owned** ingredient of the active category in a FREE round (recipe-limited in guided / Lunch Rush) |
| OWNED acquisition | `trayIngredientsFor` (`src/logic/prepareDock.ts:31`): `ingredientsByCategory(category).filter(i => ownedIngredientIds.includes(i.id) && (freeCook || recipe requires i))` |
| Sort | catalog (declaration) order; zero-stock owned items stay listed |
| Filter | none (the pantry has the filters; the tray has none, by decision OD-B1 "no tray family chips") |
| Pin priority | none (pins dormant) |
| Working set | none in production (`resolveTrayHandIds` → `null`) |
| Max display | 3×2 = **6 per page** (`MAX_INGREDIENT_PALETTE_SLOTS = 6`), unlimited pages with a pager; 22 toppings = 4 pages today |
| Pantry | extra read-only browser via the pager-row entry, own filter/search; closing changes nothing |

When the hand is later activated (R6), capacity 9 or 12 would limit the tray to the hand (placed > pinned > hint (unwired) > favorite (unfed) > recent (unfed) > new (acquisition order) > fill), shown in **catalog order**, with the pantry as the way to reach the rest. *(inference from `workingSet.ts` / `handTray.ts`)*

---

## 5. Taxonomy chain (one authority; no new taxonomy needed)

```
ingredient id
  └─ ingredientAttributeFamily()        src/data/ingredientTaxonomy.ts   (TOPPING_FAMILY_ROWS: topping id → AttributeFamilyId)
        ├─ subToppingClass()            hint5Ladder.ts   (topping only; null = fail-closed, recipe not a target)
        │     └─ Hint5ClassView.family  → HINT_CLASS_DISPLAY[family]  (Hint labels: 肉系 / 野菜・きのこ系 / …)
        └─ ingredientShelf()            src/data/ingredientShelf.ts  (sauce/cheese → category; topping → the same family id)
              └─ CatalogIngredient.shelf (catalogSource) → queryCatalog({shelves}) → ShelfChips → Pantry filter
```

- **Same id authority: YES (verified).** `ingredientShelf.ts` states it: "a topping's shelf is its DH4-1 family, the same ids Hint 5.0 reads"; `Hint5ClassView.family` is an `AttributeFamilyId`; `shelf` for a topping is `ingredientAttributeFamily(id)`. One table (`TOPPING_FAMILY_ROWS`, 22 toppings today, all classified at production size) feeds both. `auditShelfAuthority` + the Hint 5 taxonomy gate keep them consistent.
- **Labels are deliberately different** (OD-CT-3 / OD-H5-C4): shelf labels are `ATTRIBUTE_FAMILIES.labelJa` (肉 / 魚介 / 野菜・きのこ / 果物 / ハーブ・香味 / スパイス・薬味 / **その他**), Hint labels are `HINT_CLASS_DISPLAY` (肉系 / 魚介系 / 野菜・きのこ系 / … / **ちょっと変わった材料** for `other`). A link must be keyed by **family id**, never by label text, and the `other` shelf's label (「その他」) differs from the Hint's 「ちょっと変わった材料」 (OD-TAX-8: the Hint never says 「その他」) — Owner decision OD-HP-2.
- **Sauce / cheese** have no family; they are shelved by category, and the Hint ladder names them directly (SAUCE / CHEESE rungs), so there is nothing to classify.
- **Fail-closed at scale:** at the 62-ingredient catalog 23 toppings have no family (open docs #293 / #296); such an ingredient has `shelf === null` → pantry 「すべて」 only, and a recipe using it is not a Hint 5.0 target. A link keyed by family id inherits this behaviour with no new rule.
- No new taxonomy is proposed anywhere in this report.

---

## 6. Hint → Pantry: is the proposed UX possible on today's architecture?

Proposed: Hint 「野菜・きのこ系」 → 「この分類の食材を見る」 → pantry opens on the same class → player searches / browses → (pin) → back to FREE → try → Notebook.

| Step | Feasible now? | What exists / what is missing |
|---|---|---|
| Hint shows a class | **Yes, only when a ladder exists** (pool = 1). The SUB_CLASS board entry carries `classView.family` (a family id) | In **OPEN_POOL there is no ladder and no class** (D-1), so there is nothing to link from |
| Link button 「この分類の食材を見る」 | **Additive UI** | None exists. HintSheet receives `hint5.board[].classView.family`, so the id is already at hand |
| Pantry opens on that class | **Mostly** | `queryCatalog({shelves:[family]})` exists; `ShelfChips` derives chips from owned rows and a missing shelf falls back to 「すべて」. Missing: an **initial-shelf** input (the pantry's `activeShelf` is local state starting at `"all"`) |
| Pantry category | **Gap** | The pantry shows **only the active step's category** (OD-R4-1, no cross-category pantry). A class is always a **topping**, but the Hint sheet is available in any PREPARE step (SAUCE / CHEESE), and the pantry entry is unavailable in DOUGH. A link needs a category override or must be shown only in the TOPPING step — Owner decision OD-HP-3 |
| Availability gate | **Gap** | `pantryAvailable` also requires `pantryWorthwhile` (> 6 owned in some step category) — fine at production size (13 toppings), but the Hint link would inherit the gate |
| Overlay stacking | **Pattern exists** | N1 already opens a sheet over the Hint sheet (Hint made `inert`); the pantry is a GameScreen-level overlay with its own `pantryOpen`. Needs a coordinated "open pantry from hint" and a return path |
| Player searches / browses | **Yes** (live) | search + chips already work |
| Pin | **Not in production** | pin UI is flag-off; pins only matter once the hand is active (tray ≤ 12 vs owned 13 at Dex 12 under the 12 candidate). Until R6-c/e, browsing is **read-only**; the player closes the sheet and finds the ingredient in the 6-per-page tray |
| Back to FREE, try, Notebook | **Yes** | existing |
| Privacy | **OK by construction if keyed by the displayed family id** | The class is already displayed; the pantry lists the player's own owned items of that family. No candidate name / count, no 💡 on a recipe's ingredient (H-J / H-K in the Gate forbid marking unrevealed-fact ingredients), no new k ≥ 2 rule (OD-B5). The pantry is OWNED-only, so it never shows a locked or unbought ingredient |

**Verdict:** the *browse* half is feasible on existing architecture with additive, presentation-level changes (a link, an initial-shelf prop, a category decision, stacking). The *pin → FREE hand* half is **blocked on R6-c/e** (flag activation, capacity 9 vs 12, real-device HV) and is not needed to deliver the browse value. It does **not** help the pool > 1 window (no class shown there).

---

## 7. MC-1 vs Pantry / Search / Pin / Working Set — overlap

MC-1 (from the first audit): list owned ingredients not yet in the Notebook, grouped by category, in the Hint sheet.

| Need MC-1 serves | Already served by | Gap that remains |
|---|---|---|
| "I have many ingredients; show me them" | **Pantry** (list, search, shelf chips; production-on) | none — it is the browser |
| "Show me my newest ingredients" | **Hand `new` tier** (acquisition order, OD-R2-2), once the hand is on; today the tray's catalog order | tray shows all today; nothing highlights new |
| "Group by kind" | **Pantry shelf chips** (by the same family ids) | none |
| "Keep the ones I care about at hand" | **Pins / hand** (dormant) | activation (R6) |
| "Which of my ingredients have I **not yet put in the Notebook**?" | **nothing** — the pantry's query has `only.recent / favorites` but usage is never fed; the Notebook is not an input to the pantry | **this is the only genuinely new piece** (a join between two player-owned sources) |
| "Link from the Hint sheet to materials" | nothing (LC-4 undesigned) | the link |

**Conclusion:** a Hint-side material browser (MC-1 as first written) would **duplicate** the pantry's list/grouping/search and the hand's `new`/pin concepts, and would diverge from the shelf authority and the pantry's category/keyboard/modal contracts. Per the instruction, **do not build a new Hint-side material browser.** What is not covered is only the "not in the Notebook" *predicate*; it should be delivered as a pantry-side marker/filter (or a deep link into the pantry), reusing `queryCatalog` and the shelf chips, not as a second list.

*(Why this changes my first recommendation: the first audit did not have the Large Catalog history; it assumed no material browser existed. It exists.)*

---

## 8. Notebook attempt diff — feasibility

Requested: between the player's own attempts (e.g. #2 vs #1) show `+ added`, `− removed`, `sauce changed`; never compare with a hidden recipe.

- **Data available (verified):** each Notebook row carries `number`, `retryCount`, `combination = { sauceBase[], ingredientSet[] }` (sorted, de-duplicated ids), and the shown P2 line. The identity index (≤ 2000) keeps the fingerprint (parseable to the same combination) and `number`.
- **Pure computation is trivial and recipe-blind:** `added = B.ingredientSet − A.ingredientSet`, `removed = A − B`, `sauceChanged = A.sauceBase ≠ B.sauceBase`. Inputs are two of the player's own rows; no recipe, pool, target, Hint fact or Pitz can enter. Output is deterministic and explainable ("what you changed since the previous note").
- **Granularity limit:** the fingerprint is **set-level** (no piece counts, quantities, positions, order, bake). A diff can say "+ハム" but never "ハムを2→3個" (by P1 design: counts are not identity).
- **Pairing rule needs a decision (OD-HP-4):** "previous" can mean creation order (`#n` vs `#n−1`, stable) or activity order (display order, moves on retry). Creation order is the explainable one. Because the Notebook records only ORIGINAL / AMBIGUOUS / INCOMPLETE tries (not FAILED, MATCHED, ALREADY_DISCOVERED) and is session-only and display-limited to 50, the copy must say "ノートの前の試作とくらべて", not "前に作ったピザ".
- **Safety caveat — gradient channel:** each row already shows the P2 near-miss line (the shipped, pool-derived "おしい / あと1つ / かなり近づいてるよ" authority, first audit §2.2). Placing a diff next to that line makes the pair "(+X) → line changed" explicit, which makes hill-climbing toward the nearest candidate easier than today. It is not new information, but it is a stronger presentation of it. Mitigation: show the diff without re-rendering the feedback line beside it (or place it in the header of the row, feedback unchanged), and keep it out of RESULT. Owner decision.
- **Hidden-recipe comparison:** none. Verdict: **feasible and safe** as a pure, session-only, read-only addition to `TrialNotebookSheet`; no save change.

---

## 9. Responsibility split — 172 recipes

| Surface | Owns | Scales with | Must not do |
|---|---|---|---|
| **Pantry** (search, shelf chips, later pins / hand) | the player's **materials**: browse, find, group, keep at hand | owned count (≤ 62 now; 172 recipes ⇒ inventory ≤ ~62, toppings 42) | know any recipe, pool, target or hint content; show locked items; counts (deferred to Phase 5) |
| **Hint sheet** | **paid recipe knowledge** (Hint 5.0 ladder, per single target) and the pool > 1 message | targets with a classified ladder | browse materials; show anything unpaid; pick a target at pool > 1 |
| **Trial Notebook** (+ diff) | the player's **history of tries** and what changed between them | session tries (≤ 50 rows / 2000 identities) | any recipe, distance or comparison with a candidate |
| **Free Cooking tray / hand** | placing; shows the hand (R6) | capacity 9/12, pages | filtering, searching |
| **Bridges (new, additive)** | Hint→Pantry link by displayed family id; Notebook→Pantry "not in notes" marker | — | duplicate a list; add a taxonomy |

At 172 recipes: pool > 1 becomes normal (first audit §8), so the *only* hint-adjacent affordances that work in every state are the ones built from the player's own state (materials + history). That is exactly the pantry + Notebook pair. Ladder-linked class jumps work only for pool = 1 targets. About 120 / 172 recipes have no catalog sauce (indicative), so any bridge must never imply "no sauce" (H5-INV-4); the pantry's sauce shelf simply lists what the player owns.

---

## 10. Revised minimum Completion Plan (maximum reuse of existing assets)

This **replaces MC-1's "Hint-side ingredient list"**; MC-1 as written should not be built.

| Slice | Content | Reuses | New | Save | Depends on |
|---|---|---|---|---|---|
| **IP-0 (decision only)** | Owner closes OD-HP-1…8; confirm #319 / R6 sequencing | — | — | none | — |
| **IP-1: OPEN_POOL points at what exists** | In the OPEN_POOL view: replace the one paragraph's dead end with fixed copy that points to the **Notebook** (already in the header) and offers a **「食材庫を見る」** button that opens the existing pantry (topping category) | `IngredientPantry`, N1 header entry, stacking pattern | a button + initial-category prop + copy | none | OD-HP-3, OD-HP-7 |
| **IP-2: Hint → Pantry for a displayed class (pool = 1 ladder)** | In the ladder's SUB_CLASS entries: 「この分類の食材を見る」 → pantry opens in the topping category on `shelves:[family]` | shelf authority, `ShelfChips`, `queryCatalog` | initial-shelf prop, link, stacking, return focus | none | IP-1, OD-HP-2 |
| **IP-3: Notebook diff line** | per row: `+ −` ingredients and sauce change vs `#n−1` (creation order) | `TrialEntryView`, chip components | pure `attemptDiff()` + row line | none | OD-HP-4 |
| **IP-4 (optional): "ノートにまだ" marker in the pantry** | a pantry-side marker / filter chip for owned items absent from the Notebook identity index — replaces MC-1's list | `queryCatalog`, pantry tiles | one pure selector over the identity index, a marker | none | OD-HP-6; copy must read "ノートにのっていない" (Notebook coverage limits, first audit §5) |
| **R6-c/d/e (existing roadmap)** | pin UI + hand activation, capacity 9 vs 12, HV | all R5 assets | — | none | #319, Owner Human Feel Gate |

IP-1…IP-4 can ship before R6: each works with the flag off (read-only pantry). They do not need pins. If R6 activates the hand first, IP-2/IP-4 become *more* valuable because some owned items will be off the tray and reachable only through the pantry.

Not in any slice: a Hint-side browser, any paid pool-level rung, any target selection, any new taxonomy, any count, any 💡 on an ingredient, any recipe-derived ordering.

---

## 11. Owner Decisions

| ID | Question | Recommendation |
|---|---|---|
| OD-HP-1 | Drop MC-1's Hint-side material list and deliver via pantry bridges (IP-1…IP-4)? | **Yes.** The pantry already is the browser. |
| OD-HP-2 | Hint→Pantry label mapping: keep separate labels (Hint 「野菜・きのこ系」 vs pantry chip 「野菜・きのこ」) and key the link by family id; what about `other` (Hint 「ちょっと変わった材料」 vs shelf 「その他」)? | Key by id; accept the label difference; for `other` either hide the link or open 「すべて」. |
| OD-HP-3 | Pantry category when opened from Hint: allow a topping override in any step, or only offer the link in the TOPPING step? | Offer in TOPPING step only first (no cross-category pantry, OD-R4-1 intact). |
| OD-HP-4 | Notebook diff: include? pairing = creation order? place beside the P2 line or not? | Include; creation order; keep it out of the same visual unit as the P2 line. |
| OD-HP-5 | Sequence: Hint/Notebook bridges before or after R6-c/e (pin + hand activation)? Merge #319? | Bridges first (flag-off safe); #319 is independent infra. |
| OD-HP-6 | A pantry "not in the Notebook" marker (IP-4): wanted at all? | Optional, after IP-1/2; wording "ノートにのっていない". |
| OD-HP-7 | In OPEN_POOL, is a generic 「食材庫を見る」 button acceptable (it reveals nothing, but it is the only pool-state affordance)? | Yes. |
| OD-HP-8 | Close #272 as superseded now that R0–R5 are in main? | Owner's call (SSOT OD-4). |
| Carry-over | OD-MC-2…7 from the first audit remain open where still relevant (near-miss authority, 1-vs-≥2 shape signal). | — |

---

## 12. Blockers / risks

1. **Pin → FREE hand cannot be delivered yet:** `HAND_ENFORCEMENT_ENABLED = false`; R6-c/d/e not started; capacity 9 vs 12 undecided (R6 real-device Human Feel Gate); #319 open.
2. **Category scope (OD-R4-1):** the pantry is per active category; a class link is topping-only → category/step decision (OD-HP-3).
3. **Availability gate:** the pantry entry is absent in DOUGH and when no step category has > 6 owned (fine at 13 toppings; would be absent for very small inventories).
4. **Notebook limits for any "not in notes" claim:** records only ORIGINAL / AMBIGUOUS / INCOMPLETE; session-only; display limit 50 (use the 2000-entry identity index).
5. **Usage signals unfed:** favorites / recent are not collected; do not design on them (use Notebook / acquisition order).
6. **Hint ladder × `hintDisclosure`:** `hintDisclosure.ts` was never audited against the Hint 5.0 view (`Hint5Presentation`); a link must read `classView.family` directly and must not reuse the old `HintSheetView` reader (LC-R1 result, Revision Gate §11).
7. **62-catalog unclassified toppings (#293 / #296 open):** unclassified → no shelf, no SUB_CLASS; fail-closed, no extra work, but the link must never guess.
8. **HV policy:** every UI slice needs the 390×844 Human Verification video + before/after screenshots (CLAUDE.md); mobile height is tight (the pantry already has keyboard-fit work; stacking over the Hint sheet needs its own fit check at 360×640).
9. **Gradient channel** if the diff sits beside the P2 line (§8).

---

## 13. Save schema

**No save change for any slice (IP-1…IP-4) or for the existing R6 roadmap.** Pins / hand are session-only (OD-R2-3 / OD-R5-9), the Notebook is session-only (N1), pantry shelf / search are local component state, and every new item above is derived from existing in-memory state.

---

## 14. What was not done

- No code, test, CSS, e2e or save was changed; no implementation, PR or merge. MC-1 was not implemented; the first report is unchanged.
- The #272 branch's Owner Decision Gate / Fresh Design were read from the branch (not on main); R6-a's report was not read in full (only its status and the #319 / R6-b result summary) because it is not on main.
- The 172-recipe figures are the first audit's indicative numbers (design matrix + catalog JSON), not a gameplay authority.
- No Preview / HV video: nothing UI changed.
