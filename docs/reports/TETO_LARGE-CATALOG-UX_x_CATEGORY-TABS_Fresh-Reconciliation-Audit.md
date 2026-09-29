# PR #272 (Large Catalog UX) × Ingredient Category Tabs 1.0 — Fresh Reconciliation Audit

**docs-only. No production code, test, tool, CSS or e2e change. PR #272 untouched (not commented, not rebased, not merged).**
Human Verification: not applicable (no visible / interaction change; policy §2).

- Baseline: `origin/main` = `cf1c57d` (PR #301, Category Tabs Phase 3 Shop merged; Phase 1 `ingredientShelf` #299 in).
- PR #272: head `f5b0ab5` (branch `claude/large-catalog-ux-design-sq8saf`), base `e21fbc2` (stale), 11 commits, 75 files, `src/logic/catalog/*` pure and unwired.
- Method: read both sides' source and docs at those SHAs; trial-merged #272 into a throw-away worktree of `main` (not pushed, removed afterwards); ran `src/logic/catalog`, `src/data/ingredientShelf.test.ts`, `deductionGuard.test.ts`, `deductionHint.test.ts`.

## 1. Mechanical state of #272 on latest main

| Check | Result |
|---|---|
| `git merge origin/main`-equivalent | **clean** (only `docs/PROJECT_HANDOFF.md` auto-merged) |
| 12 test files (catalog + shelf + DH4 guards) on the merged tree | **150 / 150 pass** |
| Production importers of `src/logic/catalog` | none (B-6 guard) — so no runtime overlap exists today |

Staleness is therefore documentary (handoff, base SHA), not a code conflict.

## 2. Responsibility comparison

| Concern | main today | #272 / LC design | Overlap? |
|---|---|---|---|
| **ingredientShelf** (`data/ingredientShelf.ts`) | Membership authority: ingredient → exactly one shelf (`sauce` \| `cheese` \| DH4-1 family), fail-closed `null`, `filterByShelf`, `shelvesPresent`, `auditShelfAuthority`. Single axis. | `CatalogIngredient` has **two axes**: `category` (sauce/cheese/topping) + injected `family: string \| null` (toppings only). `CatalogFamilyId = string`, not tied to `AttributeFamilyId`. | **Yes — same fact (which bucket) modelled twice.** |
| **ShelfChips** | Presentational chip row; caller owns filter and derives shelves from listed rows; no counts. | LC-3 sheet plans a "family タブ / 横チップ列 1 行" of its own; LC-2 plans a "棚バー". No component in #272. | Design-level only (3 planned chip UIs, see §4). |
| **Phase 3 Shop** | Chips + `filterByShelf` over `shopRows()` = **NEW + OWNED**. Shelves derived from listed rows so a LOCKED-only shelf never appears. | LC-8 Shop reuses the library; `queryCatalog` returns **OWNED only** (`ownedCatalog`). | **Mismatch**: Shop's universe (NEW+OWNED) ≠ catalogQuery's universe (OWNED). Not a problem until LC-8. |
| **Phase 4 Ingredients (Inventory)** | Own `TAB_ORDER` / `role=tablist` on category only (owned rows). Plan: swap to `ShelfChips` + `filterByShelf`. | LC-7/8: Inventory = library **view mode** (search, family, sort, ⭐). | Sequencing overlap: Phase 4 chips would be rebuilt inside the library. Small (chip row only). |
| **catalogQuery** | absent | category / families / text / only / sort query over **owned** descriptors; pure. | This is the natural query engine. |
| **familyCounts** | absent (OD-CT-6: counts deferred to Phase 5) | `familyCounts(catalog, ownership, category?)` exported + tested in #272, owned × family only (H-H safe). | **Policy conflict only if wired.** Unwired now; boundary test stops production import. |
| **手元 ≤ 12** | none (tray shows every owned ingredient, paged) | `workingSet.ts`, `capacity` is an argument; LC-OD-4 says **12 is provisional (9 vs 12 decided at LC-2)**, inactive when owned ≤ capacity. | Not an authority conflict. Conflicts with a Builder chip filter (§4). |
| **食材庫 sheet** | none | LC-3: bottom sheet, family chip row, search, ✓ pick. Not in #272. | Should reuse `ShelfChips`; otherwise a second chip implementation. |
| **PR #197 selection reset** | `IngredientTray.goToPage` → `onClearSelection` when a page switch would hide the selected chip. Shop has no selection. | LC F-09 notes reset fires often with many pages; 手元 = 2 pages. | Contract must be extended to "any change of the visible set clears an invisible selection" — page switch, shelf chip, 手元⇄すべて, sheet close. OD-CT-5 already flags this as a Builder-phase re-audit. |

## 3. Can the authority split hold? — **Yes, with one small revision**

Proposed split:

```
ingredientShelf  = membership authority   (which shelf an ingredient belongs to; ids, order, labels, fail-closed, audit)
catalogQuery     = query engine           (ownership scope, text, sort, favorites/recent, zero-stock ordering, composition)
ShelfChips       = presentation only      (renders shelves it is handed)
workingSet       = selection policy for the tray (never classifies)
```

What makes it work: `catalogQuery` never decides membership — it only compares a descriptor field. If that field **is** the shelf, both sides agree by construction.

Required revision to #272 (later, not now):
1. Replace the `category` + `family` pair as *filter inputs* with one `shelf?: IngredientShelfId` filter, and populate `CatalogIngredient.shelf` in `catalogSource.ts` **from `ingredientShelf()`** (sauce/cheese → category, topping → family, `null` fail-closed; `null` reachable only under "すべて", same as OD-CT-7). `category` may stay as a separate descriptor field for the working-set's per-category logic (`workingSet` takes `category`), but it must not be a second way to filter a shelf.
2. Type `CatalogFamilyId` as `AttributeFamilyId` / `IngredientShelfId` (type-only), not `string`, so a taxonomy change is a compile error rather than silent drift.
3. Allow `../../data/ingredientShelf` in `catalogBoundary.test.ts` `ALLOWED_VALUE` (today it only allows `../../data/ingredients`; the DH4 guards already list `ingredientShelf.ts` as a sanctioned taxonomy reader on main, so the taxonomy stays reachable only through it — the injection workaround #272 introduced for "DH4 unwired" is obsolete).
4. Keep `familyCounts` out of every UI until Phase 5 (see §5). Either leave it (unwired, guarded) or drop it from the rebase and re-add in Phase 5; leaving it is harmless because the B-6 guard forbids production imports.
5. Universe: `queryCatalog` stays OWNED-only for tray/library/Inventory. Shop needs NEW+OWNED; decide at LC-8 whether `ownership` gains a `listedIds` scope or Shop keeps `filterByShelf` over `shopRows()`. Do **not** widen it now.

Nothing in `main` needs to change for this split. `ingredientShelf.ts` stays as is.

## 4. Double-implementation risks (ranked)

1. **Builder Phase 2 chips vs LC-OD-1 (手元 + 食材庫).** Category Tabs OD-CT-1 adopts in-tray chips in FREE Cooking when > 6 candidate toppings. LC-OD-1 explicitly *rejected* an in-tray family tab row (stage −32px; 360×640 stage floor) in favour of 手元 (≤ 12) + 食材庫 sheet, with a 棚バー replacing the pager row. Two answers to "filter the tray". Also semantic: when 手元 is active (owned > capacity), a shelf chip over the tray would filter the *working set*, not the owned set, which misleads; the family filter belongs in the 食材庫 sheet (owned × family). This is a product decision → see §6.
2. **Chip row implemented twice** (LC-3 sheet, LC-2 棚バー, Shop, Inventory). Mitigation: all use `ShelfChips`; LC docs should reference it instead of "family タブ".
3. **Two family filter fields** (`category`+`families` vs shelf). Removed by §3 rev. 1.
4. **Phase 4 Inventory rebuilt by LC-7.** Keep Phase 4 to the chip swap only; LC-7 reuses the same `ShelfChips`.
5. **Counts creeping in** via `familyCounts` (LC-3 sheet shows "食材庫 71" style counts). OD-CT-6 forbids counts before Phase 5.

## 5. familyCounts — Phase 5 only

- Status in #272: exported, unit-tested, **not imported by any production file**; the B-6 guard fails the build if one does.
- Rule for all follow-ups: no UI, no `aria-label`, no chip suffix, no sheet header may consume it before Phase 5. The LC-3 wireframe's counts (e.g. "食材庫 71", "具材 71") must be removed or gated to Phase 5 when LC-3 is designed.
- At Phase 5 the H-H rule (count = owned × filter only, never recipe-derived) already holds in the implementation; counts must additionally be derived from `shelf`, not from a second family notion.
- Suggested cheap guard (future, not done here): a test that no non-test file outside `logic/catalog` references `familyCounts`.

## 6. PR #197 selection reset — required contract

Current: page switch that hides the selected chip → clear selection. Extend, at the Builder / LC-2 phase, to a single rule: **any change to the visible set (page, shelf chip, 手元 ⇄ すべて, sheet confirm/close) clears a selection that would become invisible; a selection that stays visible is kept.** Shelf change in Shop needs nothing (no selection state; Phase 3 already independent). 手元 with 12 = 2 pages keeps the reset rare, which is an argument for 手元 over in-tray chips. This item is the one OD-CT-5 already reserves for re-audit, so it needs no new decision, only inclusion in the LC-2 gate.

## 7. Verdict

**B — #272 should be rebased / revised later (before LC-2 wiring, not now).**

Reasons:
- It is not wrong and not obsolete: it merges cleanly and is green on latest main; it holds the only implementation of working set, query, disclosure privacy and scale fixtures, none of which Category Tabs provides. So **C (supersede)** would throw away audited work (19/19 mutation gate).
- It cannot stay as-is (**A**): it models bucket membership a second time (category + free-string family), forbids importing the very authority that now exists (`ingredientShelf`), and carries `familyCounts` that conflicts with OD-CT-6 timing. Those become real duplication the moment LC-2/LC-3 wires it beside Shop/Inventory chips.
- The revision is small (§3, five items) and can wait: nothing is wired, so there is no present harm. Do it as the first step of LC-2, after the owner resolves the sub-decision below.

**Owner decision needed (sub-item, does not block #272 staying open):** Builder Phase 2 (in-tray chips, OD-CT-1) vs LC-OD-1 (手元 + 食材庫, no in-tray family row). Recommendation: keep Phase 2 as "no in-tray chips"; fold the Builder filter into the 食材庫 sheet (LC-3) using `ShelfChips`, and keep Category Tabs Phases 3 (done) and 4 (Inventory chip swap) as they are. If the owner instead wants in-tray chips first, then #272's `workingSet` needs a rule for chip × 手元 before rebase. Until decided, do not implement Phase 2 or LC-2.

If the owner wants a single answer label: **B**, with a scoped **D** on the Phase 2 / LC-OD-1 question.

## 8. Next actions (superseded in part by §9)

1. Owner: decide Phase 2 vs LC-OD-1 (§7).
2. Category Tabs Phase 4 may proceed independently (chip swap in Inventory using `ShelfChips`; no counts).
3. Before LC-2: revise #272 per §3 on its own branch (or a follow-up on top of main), add the `shelf` filter, type the family id, adjust the boundary allow-list, add the `familyCounts` reference guard, and update handoff.
4. Extend the #197 contract per §6 in the LC-2 gate.

## 9. Owner Decision (2026-09-29) — Builder Category Tabs decision CLOSED

The Owner adopted the recommendation in §7 after the Builder Fresh Re-Audit and this audit. This section is the authoritative record; §7's "owner decision needed" item is resolved and its verdict stays **B** for #272.

| ID | Decision |
|---|---|
| **OD-B1** | The Builder tray gets no family chip, so the #197 vs OD-CT-5 conflict on the tray is resolved. For a future 食材庫 sheet, when a filter / page / working-set change would hide the selected ingredient, #197's existing principle applies: **an invisible selection is cleared** (this is the §6 rule, now limited to the sheet and the working set, not tray chips). |
| **OD-B2** | Builder family filtering is integrated into the Large Catalog UX 食材庫 sheet, not the tray. The sheet reuses `ShelfChips`. |
| **OD-B3** | The pizza stage floor takes priority. No ~40–52px row is added to the tray for family filtering; the stage is not shrunk. |
| **OD-B4** | A future FREE-Cooking-only feature gate must **explicitly exclude Dinner**, not rely on `freeCook` alone. |
| **OD-B5** | The Hint 5 privacy contract is kept. No new k>=2 coarsening rule is introduced. |

**OD-CT-1 is withdrawn.** Old text: "in FREE Cooking with > 6 candidate toppings, show family tabs in the Builder tray". Replacement: "The Builder tray shows no family tabs; the Large Catalog UX 食材庫 sheet provides family filtering."

Consequences (docs only; nothing implemented here):
- Category Tabs "Phase 2 Builder" as an in-tray chip row is cancelled. Earlier reports (P1 Result, P3 Fresh Audit / Result) that mention OD-CT-1 or a Phase 2 Builder are historical and are superseded by this section; they are not edited.
- The LC-OD-1 A model (手元 + 食材庫 sheet, 棚バー replacing the pager row) is no longer in conflict with Category Tabs. §4 risk 1 is closed; §4 risks 2–5 remain.
- Phases 3 (Shop, done) and 4 (Inventory chip swap) are unaffected. Counts stay Phase 5 only (OD-CT-6); `familyCounts` remains unused.
- The #272 revision list (§3) is unchanged and still due before LC-2. When LC-2 / LC-3 are gated, they must cite OD-B1–B5.
- SSOT: `docs/PROJECT_HANDOFF.md` section "Ingredient Category Tabs 1.0 — Builder decision".

**FINAL STATUS: A. BUILDER CATEGORY-TABS DECISION CLOSED**
