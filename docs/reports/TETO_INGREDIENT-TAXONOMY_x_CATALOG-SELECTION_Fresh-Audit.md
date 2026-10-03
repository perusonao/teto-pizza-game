# Ingredient Taxonomy + Large Catalog Ingredient Selection UI — Fresh Audit (Re-Audit)

**docs-only. Audit / design only. No `src/`, CSS, test, e2e, tool, Issue, PR or deploy change.**
Human Verification: not applicable (docs-only, Policy §2).
Machine-readable companion: `docs/reports/data/TETO_INGREDIENT-TAXONOMY_PRODUCTION30_Fresh-Audit.json` (30 rows + summary; static parse of the three source files; audit evidence only, not an authority, not read by `src/**`).

## 0. Headline (read this first)

**The premise "a shared taxonomy and category tabs are still to be designed" no longer matches `main`.** The shared taxonomy and the category-chip UI are **already implemented and live** in three screens, under Owner Decisions that are recorded in `docs/PROJECT_HANDOFF.md`:

- one membership authority (`src/data/ingredientShelf.ts`, a *composed view* with no table of its own) over two stored tables (`Ingredient.category` + `ingredientTaxonomy.ts` families);
- one presentational component (`ShelfChips.tsx`) used by **Shop (#301), Ingredients/Inventory (#302) and the Cooking 食材庫 sheet (LC-R4)**;
- the 食材庫 sheet with shelf chips + search + IME contract + keyboard fit is live for FREE Cooking (LC-R3 / R4 / R5-a / R5-b).

So this audit does **not** propose a new taxonomy or a new tab system. It (a) verifies that claim against real data, (b) answers the ROLE vs FAMILY question the Owner asked, (c) lists what is genuinely still open, and (d) corrects stale numbers in earlier reports.

## 1. Audited main SHA / working tree

- `origin/main` = **`fbd5305fb9452e0a6d38b188dd6f3099898a7ae8`** (Contract 2.1 Production Activation, #366). Local HEAD equals it. Branch `claude/ingredient-taxonomy-audit-151bry` was cut from it; working tree clean before this report.
- Production flags read from source: `RESEARCH_IDENTIFY_PRODUCTION_DEFAULT = true`, `HINT5_LADDER_PRODUCTION_DEFAULT = true`, `HAND_ENFORCEMENT_ENABLED = false`.

## 2. Existing Issues / PRs / duplicate gate

Open Issues read (37). None is a Category-Tabs / taxonomy implementation Issue. Related:

| # | Relation |
|---|---|
| #360 | Hint 5.0 knowledge duplication (Design Audit, open). Explicitly out of scope here ("taxonomy の変更" is out of its scope too). |
| #292 | Hint 5.0 Sub-topping Classification Ladder (parent; Hint 5.0 is production-default ON). |
| #269 / #270 | Large Catalog UX LC-1 (pure model, issue still open though the LC-R0..R5 slices landed from fresh branches) / Undo (separate). |
| #294 | Post-W1 Cooking Steps (FINISH / post-bake seam; affects the ROLE axis, §7). |
| #216 / #182 | Progression 2.0 (unlock path to 172; supplies the 105-ingredient universe). |

Open PRs (24 read). Related, all **not** duplicates of this audit and none touched:

| PR | State / relevance |
|---|---|
| #319 | LC-R6-b Preview-only Hand activation infrastructure (open since 09-30, base `6abddc7`). Production `HAND_ENFORCEMENT` stays false. |
| #307 | docs: mark LC-R4 complete (stale vs. main handoff). |
| #296 / #293 / #255 | 172 HCG pack / 62-172 coverage audit / OD-TAX-1..9 (docs / data, "PROPOSED, not authority"). |
| #272 | Old LC-1 PR, frozen as porting source (OD-4); effectively superseded by LC-R0..R5 landed on main. Closure was deferred to the Owner. |
| #295 | Post-W1 Cooking Steps design + CS-1a (open). |

Duplicate verdict: **no open work item covers "shared taxonomy / selection UI" any more; it is landed.** The only duplication risk is *creating a new taxonomy doc*, so this report is a single re-audit and proposes updates to existing documents (§16).

## 3. Existing taxonomy authority (current repo)

| Layer | Authority | Notes |
|---|---|---|
| ROLE (stored) | `Ingredient.category` ∈ sauce / cheese / topping (`ingredients.ts`) | Also = the making step (SAUCE / CHEESE / TOPPING). |
| FAMILY (stored) | `TOPPING_FAMILY_ROWS` in `ingredientTaxonomy.ts` — 7 ids (meat, seafood, vegetable, fruit, herb, spice, other) + 4 coarse groups, **toppings only** | OD-DH4-4. 23 rows today. |
| Shelf (derived) | `ingredientShelf()`: topping → its family; sauce / cheese → its category. 9 shelves. `null` = fail-closed. `auditShelfAuthority` | No table, cannot drift. |
| Hint 5.0 display | `HINT_CLASS_DISPLAY` (labels + class symbol, keyed by family id) | Display only. |
| Query engine | `queryCatalog` (OWNED-only; `shelves` filter; text / sort), descriptor `shelf` copied from `ingredientShelf()` | LC-R1. |
| Presentation | `ShelfChips` (group of `aria-pressed` buttons, one nowrap scroll row, ≥ 44 px) | Shop / Inventory / Pantry. |
| Search aliases | `ingredientSearchAliases.ts` — 3 Owner-approved (onion 玉ねぎ, egg 卵, mozzarella モッツァレラチーズ); search only | Separate authority (LC-R5-b). |
| Non-production | `data/recipes/ingredient_master_catalog.json` — frozen research artifact (OD-T8); family rows are added to `ingredientTaxonomy.ts` in the PR that introduces the ingredient (OD-T7) | No second runtime authority. |

The "Research Hint taxonomy = Ingredient selection taxonomy = Inventory = Shop" unification the Owner asks for **already holds at the id level** (all four read the same 7 family ids and the same role). It does **not** hold at the label level, by decision (§5).

## 4. Production ingredient audit (30)

Source: static parse; the 30 rows are in the companion JSON.

| Measure | Value |
|---|---|
| Production ingredients | **30** (sauce 3, cheese 4, topping 23) |
| Classified (exactly one shelf) | **30** (7 by role, 23 by family) |
| Unclassified | **0** |
| Orphan / duplicate taxonomy rows | 0 / 0 |
| Conflicting classifications (same ingredient, different bucket across Hint / Shop / Inventory / Cooking) | **0** — Shop, Inventory and Pantry all call `ingredientShelf` / `filterByShelf`; Hint 5.0 reads `ingredientAttributeFamily`; no screen owns a private ingredient → bucket table (verified by `grep`: only `ingredientShelf.ts`, `deductionHint/Guard/Request.ts`, `hint5Ladder.ts` read the taxonomy) |
| Family sizes | vegetable 8, meat 5, herb 4, seafood 3, fruit 1, spice 1, other 1 |
| Starter (always owned) | tomato-sauce, mozzarella, basil |

Family membership (all Owner-confirmed; OD-T3 individually confirms garlic = herb, black-olive = vegetable, capers = spice): meat = sausage, pepperoni, bacon, ham, chicken · seafood = anchovy, tuna, clam · vegetable = mushroom, cherry-tomato, onion, black-olive, corn, eggplant, fresh-tomato, potato · herb = basil, oregano, rosemary, garlic · fruit = pineapple · spice = capers · other = egg. Sauce = tomato-sauce, olive-oil, pesto. Cheese = mozzarella, gorgonzola, parmigiano, fontina.

**Not found in production data (asked about explicitly):** a separate seafood-sauce, oil/base or "base" role — `olive-oil` is a `sauce` (spread); no ingredient has more than one family; `pesto` is a sauce, not a herb. There is no `aliases` field on `Ingredient` (search aliases live in a separate table, 3 entries).

### Label divergences (same dimension, different words)

These are the only inconsistencies found. All are label-only; ids are shared.

| Subject | Where | Words |
|---|---|---|
| Topping role | making-step tab (`STEP_LABEL.TOPPING`) | **具材** |
| Topping role | pantry subtitle, Inventory card, HintSheet row (`CATEGORY_LABEL.topping`) | **トッピング** |
| Family `other` | shelf chip (`ATTRIBUTE_FAMILIES`) | **その他** |
| Family `other` | Hint 5.0 (`HINT_CLASS_DISPLAY`) | **ちょっと変わった材料** (OD-CT-3 / OD-TAX-8: intentional, "other never reads その他" in Hint) |
| Other six families | shelf chip vs Hint | `肉` vs `肉系`, `野菜・きのこ` vs `野菜・きのこ系`, … (stem vs stem + 系; intentional) |
| Legacy DH4 特徴 line | `attributeFamily().labelJa` | same stem as the chip; used only by legacy lines (Hint 5.0 ON retires 材料/構成/特徴 purchases) |

The 具材 / トッピング split is the one unforced inconsistency (a player sees 「具材」 on the step tab and 「トッピング」 on the sheet opened from it). It was kept on purpose twice (Issue #159 tab width; Phase 4 "card label kept"), so it is an **Owner decision (OD-1 below)**, not a bug.

## 5. Hint 5.0 overlap

- Hint 5.0 uses **family only for sub-toppings** (SUB_CLASS rung, `cls:<ingredientId>` records; display via `HINT_CLASS_DISPLAY`). SAUCE / CHEESE / KEY_TOPPING / STRUCTURE are **rung kinds**, i.e. ROLE-like concepts (sauce, cheese, key topping, count), not families. Hint 5.0 already treats "role" and "family" as two different things.
- Gate G1 (`hint5Taxonomy.gate.test.ts`): a hint-eligible topping needs **exactly one** family. That is the evidence for 1 ingredient = 1 family.
- After Contract 2.1 ✓/○/× the information value shifts: ✓ exact ingredient (Research fact) vs △ family (Hint) vs count. A shared family vocabulary makes △ and the shelf chip the *same words*, which is what lets a player turn a △ 「肉系」 into "open the 肉 shelf". #360 (duplicate ✓ exact / キートッピング) is about exact ingredients, not taxonomy; **this audit does not touch Hint 5.0 and the taxonomy can be shared as-is.**
- **Save impact of Hint:** `cls:<ingredientId>` stores ids only (display re-derived from today's taxonomy). Legacy E3 facts `attr:family:<familyId>` store **family ids** in `discoveryHintFacts`. Therefore **family ids are persisted** and must be immutable; labels are free to change.

## 6. Large Catalog / 53 / 172 readiness

Meaning of the numbers (verified in `data/recipes`): the **53** is the `pizza_master_catalog.json` entry count (51 viable, 15 shipped, 33 candidate, 5 deferred); its union of ingredient ids is **62** (= the 62-catalog), of which 27 are production; production also has 3 ids missing from the 62 (`capers`, `clam`, `fresh-tomato`). So **53-scale = 65 distinct ids** (30 production + 35 new: **22 toppings, 7 sauce-like, 6 cheese-like**). **172-scale** = the Progression 2.0 universe of **105** ingredients (sauce 18, cheese 16, topping 71; evidence `TETO_LARGE-CATALOG-UX_SCALE-MODEL.json`, PROPOSED families only: vegetable 24, meat 13, seafood 11, herb 8, other 7, spice 5, fruit 3).

| Question | Finding (no gaps filled) |
|---|---|
| Can the 7 production families express the 22 new 53-scale toppings? | Yes, **Owner-confirmed**: 15 remaining OD-T1 ids + 7 OD-T2 ids = 22 (the 16th OD-T1 id, `chicken`, already shipped in #342 with its row), but **not yet production rows** — rows ship with each ingredient (OD-T7). 0 UNRESOLVED. |
| Can they express the 105 / 172 toppings? | Only PROPOSED (#255, 132 PROPOSED / 47 NEEDS_REVIEW / 13 UNKNOWN; #296: 54 ids, 18 category-undecided). **Not authority; not decided here.** |
| Sauce / cheese beyond production | Category only from the research artifact (12 rows + `mascarpone` deferred, OD-T4 / OD-T5: confirm per ingredient at introduction). Wrong category ⇒ silent mis-shelving (62-audit C-5). |
| no-sauce / oil-base | 2 of 53 recipes have no sauce (`mezza-e-mezza`, `honey-fig`) — the SAUCE rung is RESERVED for TQ-1D (OD-H5-P4-SAUCE). `chili-oil`, `honey`, `nutella-spread`, `mayo` are sauce-category spreads in the artifact. **No separate "oil/base" family or role is needed by the data**; whether `honey` / `nutella-spread` should be `sauce` is unconfirmed (category authority is not HCG-grade). |
| late topping / special mechanic | 15 of 53 have `postBakeFinishing`; 9 other mechanics are rare (≤ 4 recipes). These are **placement / timing**, not family: OD-T2 states "placement / timing / Technique are separate from family authority" (truffle = vegetable regardless of finishing use). They affect the **ROLE/step axis** (a FINISH step, #294 / #295), not the taxonomy. |
| Taxonomy fail-closed for expansion | `auditShelfAuthority()` is injectable and already used by a 62-catalog detection gate; G1 / G16 / G22–G24 fail CI on an unclassified runtime topping. |
| Scale problem the taxonomy does **not** solve | Sauce 18 and cheese 16 have **no sub-structure at all** (a single shelf each). In the pantry they are browsable only by search (> 6 rows) and paging. No data supports sub-shelves; **do not invent them** (§11, OD-4). |

**Stale numbers found in earlier reports (drift; resolved by S-0, §16):** the 62-Ingredient audit and its generator state production = 29 ingredients / 22 taxonomy rows. Main is **30 / 23** (`chicken` shipped with No.27 in #342). `tools/ingredient_taxonomy_hcg_authority_audit.py --sha fbd5305… --check` fails with *"ingredientTaxonomy.ts differs from the audited main"* (it is a point-in-time check; reproduced here). The audit also still lists `chicken` among "23 unresolved toppings"; the real non-production topping count is **22** (computed from the artifact: 42 toppings − 20 production ones in it).

## 7. Current UI structure

**Cooking (FREE).** Step tabs: 生地 / ソース / チーズ / 具材 (/ 焼く / カット …, recipe-specific, `MakingStepTabs`, `STEP_LABEL`). The Builder tray is a **fixed paged grid (6 slots/page)**; the pager row is reserved only when needed. The **食材庫 sheet** (FREE Cooking only: `roundKind === FREE_COOK && dinner === null`) is opened from the dock and is **per active step category**; it shows `ShelfChips` only when the active category's OWNED rows span ≥ 2 shelves (in practice the topping step), a search field when OWNED rows of the category > 6, a fixed header / chip slot and one scrolling list. Hand / pins / "手元" are built **dormant** (`HAND_ENFORCEMENT_ENABLED = false`; R5-c / R5-d / R5-e-h done; R6-b preview infra = open PR #319). Dinner and recipe-specified rounds keep the paged tray (OD-1).
**Inventory (Ingredients).** OWNED rows only; `ShelfChips` over `shelvesPresent(owned)`; no counts; card label 「トッピング」.
**Shop.** NEW + OWNED rows; `ShelfChips` over `shelvesPresent(listed)`; a shelf that only has LOCKED rows has no chip / node / text (privacy).
**Hint / Research.** Hint 5.0 shows `HINT_CLASS_DISPLAY` labels (`肉系` …); Research card shows ✓ exact ingredients.
**Persistence:** nothing about shelves is saved (filter = local state, reset on close; hand / pins = App session-only).

Mobile layout evidence already on file (not re-measured; this is an audit): chip row ≥ 44 px, 14 px text, one nowrap row, own horizontal scroll, page never scrolls; chip row costs **54 px** of pantry list height (11–16 %); pantry sheet 590.8 / 560 / 464.8 / 448 px and list with chips 435.8 / 405 / 309.8 / 293 px at 390×844 / 360×800 / 390×664 / 360×640; with 7 shelves the row is 702 px wide in a 358 / 328 px viewport; smallest viewport still shows ≈ 3.5 tile rows (LC-R4 Result). Keyboard at 360×640 leaves 1 list row (LC-R5c audit).

## 8. UI alternatives (evidence-based)

Scale columns use the numbers in §6; "30 / 65 / 105" = ingredients; worst-case family size 8 / ≈ 15 (assumed from the confirmed 53-scale rows; not measured) / 24 (PROPOSED).

| | A. sub-tabs inside the 具材 tab (in the tray) | B. horizontal chips (in the tray) | C. 食材庫 sheet = chips + search | D. C + 最近 / お気に入り / 手元 |
|---|---|---|---|---|
| Status | **Rejected by Owner (OD-B1..B3, OD-CT-1 withdrawn)** | **Rejected for the tray** (stage −32…−52 px; 360×640 stage floor). Allowed *inside* the sheet = already C | **Implemented & live** (R3 / R4 / R5-a / R5-b) | **Partly built, dormant** (pins, hand, #197 transition; `usageSignals` favorites / recent have no UI and no persistence) |
| 30 | works but unnecessary | fine | fine (chips only when ≥ 2 shelves) | not needed (owned ≤ capacity ⇒ inactive) |
| 65 | tray pages grow 4 → ≈ 8 | row of ≈ 9 | fine; family lists ≤ ≈ 2 pages | helps; capacity undecided (9 vs 12) |
| 105 | vegetable alone 24 ⇒ 4 pages even filtered | 9 chips scroll (already scrolls at 10) | vegetable 24 ⇒ ≈ 4 pages of tiles inside the list; search covers the rest | needed for repeat use; sauce 18 / cheese 16 get only search + paging |
| 390×844 / 360×800 | −32 px stage (A and B) | same | stage unchanged (fixed overlay) | stage unchanged |
| Tap target / overflow | n/a | 44 px chips, one scroll row | 44 px, own scroll, page never scrolls (e2e-pinned) | pin badge / strip; strip hidden while keyboard up (OD-R5c-2) |
| Category count growth | rows wrap | more chips ⇒ scroll | same; no counts (OD-CT-6) | same |
| Localization | Japanese literals (no i18n layer in `src`; 4 label tables) | same | same | same |
| Accessibility | — | `role=group` + `aria-pressed`, no tablist | same; IME contract; Escape / focus contract | pin = toggle with `aria-pressed` |
| Hint consistency | shares ids | shares ids | shares ids; labels differ by decision | shares ids |
| Shop / Inventory consistency | — | same component | **same component already** | same |
| Complexity / migration risk | high (reopens #197 vs OD-CT-5) | high | **done** | medium; R6 activation + HV; capacity open |

**Conclusion from the repo evidence:** keep **C (with B *inside* the sheet)** as the Large Catalog selection UI and **complete it with D's hand/pin mechanism (R6)**. **A and tray-level B stay rejected** (Owner-closed, and the stage-floor evidence supports it). No alternative E is needed.

## 9. Proposed shared taxonomy

**Keep the existing one — no new family, no new shelf, no id change.**

| Shelf id | Kind | Chip label (UI) | Hint 5.0 label |
|---|---|---|---|
| sauce | role | ソース | – |
| cheese | role | チーズ | – |
| meat | family | 肉 | 肉系 |
| seafood | family | 魚介 | 魚介系 |
| vegetable | family | 野菜・きのこ | 野菜・きのこ系 |
| fruit | family | 果物 | 果物系 |
| herb | family | ハーブ・香味 | ハーブ・香味系 |
| spice | family | スパイス・薬味 | スパイス・薬味系 |
| other | family | その他 | ちょっと変わった材料 |

Requirements check: (1) Japanese names the player already sees ✔ (they are exactly what production shows today); (2) `○○系` works in Hint ✔ (stem + 系); (3) works as picker categories ✔ (live); (4) reused by Shop / Inventory ✔ (live); (5) 7 families + 2 roles = 9 (no growth proposed); (6) **1 ingredient = 1 family, no multi-family** — evidence: Hint 5.0 G1 requires exactly one; every ambiguous 53-scale case was decided as a single independent id (OD-T1 / OD-T2: `bell-pepper`, `cilantro`, `porcini`, `prosciutto-crudo` not aliased); multi-family would also force a privacy rule for △ hints (OD-B5 forbids a new k ≥ 2 rule); (7) see §10.

`mushroom` remains in `vegetable` (label "野菜・きのこ"); a separate きのこ shelf is **not** supported by data or decision (singleton / near-singleton families are explicitly avoided, OD-DH4-4) and would change a persisted family id (§12).

## 10. ROLE vs FAMILY

**Recommendation: two axes in data (already true), one composed axis in presentation (already true), and name them.**

- **ROLE** = `Ingredient.category` = sauce / cheese / topping = *which making step consumes it*. Stored, required for every ingredient, drives the tray / step / pantry scope.
- **FAMILY** = 7 ids, **toppings only**, = *what kind of food it is*. Stored in `TOPPING_FAMILY_ROWS`, drives Hint 5.0 △ and the chip.
- **SHELF** = derived "where the player looks for it": role for sauce / cheese, family for toppings. Never stored.

Why this and not "one mixed dimension in data":
1. A mixed table would make `chicken` simultaneously "topping" and "meat" in one column and would put `ソース` and `肉` in the same enum — then `auditShelfAuthority`'s guarantee ("a topping always has a family; a sauce/cheese never does") could no longer be checked.
2. The two axes have different consumers: ROLE is gameplay (step tabs, `workingSet` per category, recipe completion); FAMILY is knowledge/browsing (Hint, chips). Merging couples them.
3. The data already forces separation: a placement/timing concept (finishing, `spread` vs `scatter`, FINISH step) is a **third, separate property** (OD-T2) and must not be put into either axis.
4. The mix in presentation is acceptable and intentional: Shop / Inventory show `すべて / ソース / チーズ / 肉 / 野菜 …` in one row (a grocery-aisle metaphor; the P3 / P4 HV passed). In the Cooking pantry the step already fixes ROLE, so the chip row is **family-only** inside the topping step.
5. **Do not extend FAMILY to sauce / cheese now.** At 105 scale sauce 18 / cheese 16 are large and have no browse structure; but no field, evidence or decision supports sub-families (tomato / cream / oil-based …). Introducing one is an Owner/HCG decision (OD-4), and a sub-family for sauce/cheese would be a *new* axis, not a new value of today's `AttributeFamilyId`.

Rename-level suggestion (docs only): call the stored value ROLE in docs/comments; keep the code identifier `category` (a rename would be pure churn with no player benefit).

## 11. Save / schema impact

| Item | Impact |
|---|---|
| Ingredient → shelf / family / role | **not persisted**; derived at runtime |
| Shelf filter, chip choice | local UI state; reset on close |
| Hand / pins | App session-only (OD-R2-3 / OD-R5c) |
| `discoveryHintFacts` | stores `ing:<id>`, `cls:<id>`, `h5:*` and legacy **`attr:family:<familyId>`** ⇒ **family ids must never be renamed, split or merged** without a migration; **labels may change freely** |
| `ownedIngredientIds`, inventory | ingredient ids only; unaffected by any taxonomy change |
| New taxonomy-related field needed | none for any slice in §13 except an optional favorites list (persisted ⇒ would be a `schemaVersion` / forward-compat change; the current design keeps it session-only) |

## 12. Implementation slices (design only; most already exist)

Mapping of the Owner's T1..T10 onto reality (status verified on main):

| Slice (requested) | Status on main | Real remaining work |
|---|---|---|
| T1 taxonomy authority / data | **DONE** (`ingredientTaxonomy.ts`, `ingredientShelf.ts`, audit gates) | doc sync only (S-0) |
| T2 Production migration (30) | **DONE** — 30 / 30 classified, 0 conflicts | none |
| T3 shared chips / filter | **DONE** (`ShelfChips`, `filterByShelf`, `queryCatalog.shelves`) | none |
| T4 Cooking picker | **DONE for FREE** (食材庫 R3 / R4 / R5-a / R5-b). Tray stays chip-free by decision | R6 hand activation (capacity 9 vs 12; HV) |
| T5 Inventory | **DONE** (#302) | per-shelf 「所持 N/M」 and counts = Phase 5 |
| T6 Shop | **DONE** (#301) | counts = Phase 5 |
| T7 Hint integration | **ids shared**; labels differ by decision | optional label policy (OD-1, OD-2); no code needed for ids |
| T8 Large Catalog / search | search **DONE** (R5-b); favorites / recent **unwired** | optional (S-4) |
| T9 mobile HV | per-phase HV done (390×844 / 360×800) | repeat per new slice |
| T10 53 / 172 expansion gate | **Gate exists** (G1, `auditShelfAuthority`, OD-T7) | per-ingredient runtime PR carries its family row; owner HCG for non-confirmed ids |

Proposed new / remaining slices:

| ID | Slice | Depends on | Notes |
|---|---|---|---|
| S-0 | Docs sync: handoff + 62-audit drift (30 / 23, `chicken`, generator `--check` pin) + mark #272 / #307 status | – | docs-only |
| S-1 | Label policy (OD-1 具材 vs トッピング; OD-2 `その他` vs `ちょっと変わった材料`) | Owner | UI text only if changed; HV applies |
| S-2 | Dinner / recipe-specified tray catalog scale (OD-1 of LC said "separate audit") | R6 outcome | Fresh Audit first |
| S-3 | Counts Phase 5 (OD-CT-6: owned × shelf only, never recipe-derived) | S-1 | wire `familyCounts` behind a boundary test |
| S-4 | Recent / favorites UI | R6 | favorites persistence = save change; recent = session-only |
| S-5 | Sauce / cheese browse structure at 105 scale | Owner + HCG | only if a real data field is decided |
| S-6 | 53 expansion per-ingredient PRs (row + `auditShelfAuthority` ok + HV) | Owner category confirmation (mascarpone, `honey`, `nutella-spread`) | each ingredient with its own row (OD-T7) |
| R6 | existing: hand activation, capacity decision, HV, production activation (#319 is R6-b) | #319 | not re-designed here |

**Parallelizable:** S-0 ‖ S-1 (decision) ‖ R6 work; S-5 (data/HCG) ‖ everything; S-6 batches ‖ each other (disjoint ingredients) but each must precede its own recipe. **Sequential:** S-3 after S-1; S-4 after R6; S-2 after R6.

## 13. Blockers / Owner decisions

| ID | Decision | Recommendation |
|---|---|---|
| OD-1 | 具材 vs トッピング: unify the topping role word on the sheet / card with the step tab? | **Unify to 具材 on the sheet subtitle and HintSheet row; keep 「トッピング」 only where a full word fits** — or explicitly accept the split. Needs HV (UI text). |
| OD-2 | `other` label: keep `その他` (chip) vs `ちょっと変わった材料` (Hint) | **Keep** (intentional, OD-CT-3). Re-confirm only if players report confusion. |
| OD-3 | Close / formally supersede #272 and #307; refresh Issue #269 | Owner housekeeping. |
| OD-4 | Does sauce / cheese need browse sub-structure at 105 scale? | **Defer** until the 53 batch lands and HCG supplies data; do not infer. |
| OD-5 | Capacity 9 vs 12 (R6 Human Feel) | existing decision gate. |
| OD-6 | Category authority for `mascarpone`, `honey`, `nutella-spread` (and the 12 non-production sauce / cheese ids) | confirm per ingredient in the introducing PR (OD-T4 / OD-T5). |

No blocker prevents the current production behaviour. Nothing here requires a save migration.

## 14. Update proposals for existing documents (instead of new authority files)

1. `docs/PROJECT_HANDOFF.md` — add one line under "Ingredient Category Tabs 1.0" / "Large Catalog UX": *"Taxonomy audit 2026-10-03 (main `fbd5305`): 30 / 30 classified; ROLE (category) / FAMILY (toppings) / SHELF (derived) wording; family ids are persisted (`attr:family:`) and immutable."*
2. `TETO_62-INGREDIENT-TAXONOMY-HCG_Fresh-Audit.md` — add a "post-#342" note: production 30 / 23 rows, `chicken` is production, 22 non-production toppings, generator `--check` is point-in-time (pinned hashes).
3. `ingredientTaxonomy.ts` header comment (a later code PR): add "family ids are persisted in `attr:family:<id>` — never rename".
Not applied here: this task is audit-only and edits no existing authority.

## 15. Verification performed

- `git fetch origin main`; HEAD = origin/main = `fbd5305…`; clean tree.
- Static parse of `ingredients.ts` / `ingredientTaxonomy.ts` / `hintClassDisplay.ts` (companion JSON): 30 ingredients, 0 unclassified.
- Cross-read of `ingredientShelf.ts`, `ShelfChips.tsx`, `catalogQuery.ts`, `catalogTypes.ts`, `IngredientPantry.tsx`, `ShopOverlay.tsx`, `InventoryOverlay.tsx`, `GameScreen.tsx` (pantry gate), `hint5Ladder.ts`, `deductionRequest.ts`, `persistence.ts` fact ids; the handoff sections; P1 / P3 / P4 / LC-R4 / Reconciliation / 62-audit reports.
- 53 / 62 / 105 numbers recomputed from `data/recipes/*.json` and `TETO_LARGE-CATALOG-UX_SCALE-MODEL.json`.
- Not run: vitest / e2e / WebKit (no `node_modules`, audit-only), no new viewport measurement (existing measurements cited).

**FINAL STATUS: A. AUDIT COMPLETE — the shared taxonomy and category-chip selection UI are already implemented; no new taxonomy proposed; remaining work is Owner label decisions (OD-1, OD-2), R6 hand activation, and the 53 per-ingredient expansion gate.**

## 16. S-0 record — Owner Decisions (2026-10-03) and authority sync

**Owner approval:** the Fresh Audit result is approved. Decisions:

| ID | Decision (Owner) |
|---|---|
| OD-1 | The player-facing ROLE word for topping is to be unified to **「具材」**, direction only. **No UI change in S-0**; S-0 records which displays would change (below). |
| OD-2 | Family `other` stays as is: category chip 「その他」, Hint 「ちょっと変わった材料」 — purpose-specific labels from the same family id. |
| OD-3 | #272 / #307: re-check the latest GitHub state, reconcile with what main already holds, **do not close**, report the needed action (§16.3). |
| OD-4 | sauce / cheese family sub-division is **deferred** to the 105-ingredient Scale Audit. |
| OD-5 | Hand capacity 9 / 12 stays **undecided**; the R6 390×844 real-device comparison is the Owner Decision Gate. |
| OD-6 | Future-ingredient categories (mascarpone / honey / nutella-spread …) are confirmed on the 53 / 172 Scale Audit side; **nothing is added to the production taxonomy by inference**. |

### 16.1 Authority sync (S-0)

Audited main `fbd5305fb9452e0a6d38b188dd6f3099898a7ae8` (unchanged since the Fresh Audit). Between the 62-audit's main `21dc0a6` and now, the only change to the three authority files is #342 (`chicken` + its `meat` row): `git diff 21dc0a6 HEAD -- ingredients.ts ingredientTaxonomy.ts ingredient_master_catalog.json` = +17 / +1 / 0 lines.
**Why `--check` failed:** not a data error. The point-in-time tool pinned `ingredientTaxonomy.ts` / `ingredients.ts` sha256 and hard-coded 29 / 22 / "23 pending = derived unresolved"; `chicken` is both an OD-T1 id and now a production row, so four assertions (hashes, 22 rows, 29 ingredients, "confirmed ids absent from production") and the generated JSON drifted. Fix (tools + data only, taxonomy untouched): re-pin the two hashes, count 30 / 23, and model `chicken` as `OWNER_CONFIRMED_SHIPPED_OD_T7` (production family must equal the Owner-confirmed one), pending 22. Result: `--sha fbd5305… --check` = OK; the regenerated JSON differs only in chicken-related fields, counts and the new sync fields.
**Current authority:** 30 ingredients (sauce 3 / cheese 4 / topping 23), 23 family rows, 9 shelves, 30 / 30 classified.

### 16.2 OD-1 — displays that would change to 「具材」 (recorded only; nothing changed)

Verified by `grep` on main. Player-visible *category* label for topping:

| # | Location | Surface | Today |
|---|---|---|---|
| 1 | `src/data/ingredients.ts:571` `CATEGORY_LABEL.topping` | 食材庫 sheet subtitle (`IngredientPantry.tsx:204`), Inventory card label (`InventoryOverlay.tsx`) | トッピング |
| 2 | `src/components/HintSheet.tsx:104` `CATEGORY_LABEL.topping` | Hint sheet row label | トッピング |
| 3 | `src/components/ResultPanel.tsx:710` `RESEARCH_ROW_CATEGORIES` | Research「今回の試作結果」group header (ソース / チーズ / トッピング) | トッピング |
| 4 | `src/logic/discovery/researchResultFeedback.ts:35` `CATEGORY_LABEL_JA.topping` | Research rows feedback copy (same triple) | トッピング |
| 5 | `src/logic/discovery/deductionHint.ts:246` `CATEGORY_JA` | legacy 特徴 / attr category line (Hint 5.0 ON retires the purchases; old stored facts may still render) | トッピング |

Already 「具材」: `STEP_LABEL.TOPPING` (`makingStepLabels.ts:15`), `ResultPanel.tsx:169` score row, `quantityMessages.ts:11` fallback name.

**Not a category label (OD-1b, confirmed 2026-10-03: these stay unchanged, see §16.5):** sentence copy (`ResultPanel.tsx:705` 「トッピングは一度に3種類まで調べられるよ」, `deductionRequest.ts:155` 「トッピングは◯種類使うよ」, `dialogue.ts:25,27`), and the compound hint terms `キートッピング` (`HintSheet.tsx:815`, `hint5Ladder.ts:473,478`) / `サブトッピング` (`HintSheet.tsx:808,823,892,946`, `hint5Ladder.ts:478`). `src/preview/hvSeeds.ts` strings are Preview/DEV only (not player-facing). `GameScreen.tsx:581` is a comment.
**Cost when it is done:** UI text only, no id / save change; ~25 unit-test files and ~19 e2e lines mention 「トッピング」 (some are the compound words, so the exact set is decided in the slice); the UI-text change needs Human Verification (Policy §2); Hint/Research copy is Anti-Oracle-neutral, so a pure label swap should not change the privacy contract but must be re-gated by the existing oracle / copy tests.

### 16.3 #272 / #307 (read-only; GitHub state fetched 2026-10-03; nothing changed, nothing closed)

- **#272** — open, not draft, base `e21fbc2` (stale), 11 commits, 75 files, **"Closes #269"** in its body (merging would auto-close #269). A local trial merge into main (`git merge-tree`, no push) conflicts in **all 14 files of `src/logic/catalog/**`** (add/add: main already holds the LC-R0-ported, shelf-reconciled versions). Its content is **superseded by LC-R0..R5 on main** (OD-4: frozen as porting source). Action for the Owner: it must **not** be merged; close as superseded when ready (OD-3: not done here); then close or re-scope #269 (its slices landed through different PRs).
- **#307** — open, 2 files (+2 / −1): adds the "LC-R4 MERGED / COMPLETE (PR #306 …)" line to `PROJECT_HANDOFF.md` and the merged status to the LC-R4 Result. **Not a duplicate: main does not contain this content** (`grep "LC-R4 MERGED"` = 0; the Result still says "No PR yet"), PR #306 itself is in main. It conflicts with main in `PROJECT_HANDOFF.md` only (trial merge). Action: either resolve the one handoff conflict and merge (docs-only), or fold the two lines into the next docs sync PR and close #307 as superseded.
- Related, unchanged: #319 (R6-b) is untouched by S-0.

### 16.4 Historical values retained (not edited)

All of these state 29 / 22 as the value *at their own audited time* and are kept: `PROJECT_HANDOFF.md` Hint 5.0 section (Round 2 "T-COV runtime 25 / 29", dated 2026-09-28); H5-0 design OD-H5-T-COV / §669 ("25 recipes / 29 ingredients", "22 / 22 toppings"); the 62-audit body (`21dc0a6`, now with an S-0 banner and four `[S-0: now …]` tags); `TETO_HINT-5_TAXONOMY-COVERAGE_Fresh-Audit.json` (#293 snapshot); DH4-1 / DH4-2 / Hint-5 audit and result reports; Large Catalog LC-R1..R5 and Category Tabs P3 / P4 reports and their measurements ("22 toppings owned", "29 production parity"); Progression W1 reports ("22 toppings, 4 pages"). The Category Tabs visibility JSONs record 22 / 29 rows as measurements of their date.

### 16.5 OD-1b (Owner, confirmed 2026-10-03)

「トッピング」 is **not** bulk-replaced. The 「具材」 unification covers only the player-facing places that show `topping` **as a category / role name** — §16.2 rows 1–5 (this includes the legacy 特徴 category line, row 5, because it names the category). **Unchanged:** wording that is natural as a cooking action, placement / operation explanations, `キートッピング` (kept for existing compatibility; the "no new key-topping design" policy stays), `サブトッピング` (handled separately with #360 / Hint 5.0), internal ids / enums / variables, and historical docs. The UI change itself is a later slice (UI text ⇒ Human Verification; the unit / e2e selectors that assert the category word move with it).

### 16.6 OD-3 executed (2026-10-03) — final status of #272 / #307 and the #269 audit

**#272 — CLOSED (not merged), superseded by main.** Re-verified before closing: of the 75 files, 5 are byte-identical on main, 16 exist on main in a *revised* form (the 14 `src/logic/catalog/**` files, `mutation-check.mjs`, `PROJECT_HANDOFF.md`), and 54 are absent on main (design / gate docs, measurement JSON, 39 old screenshots, measure specs, scale-model generator). The 54 are exactly what `TETO_LARGE-CATALOG-UX_LC-R0_Foundation-Migration_Result.md` records as "intentionally not migrated, left on the frozen #272 SHA as history". Closing deletes nothing: branch `claude/large-catalog-ux-design-sq8saf` @ `f5b0ab54e06ed0794e48aee9eb10e399f9b5cf57` is kept (**do not delete it**). A supersession comment was posted. #269 was **not** closed (closing a PR does not trigger "Closes #269").

**#307 — CLOSED (not merged), absorbed.** Its two changes were verified absent from main and carried into this branch with their original text (commit `a70b9ec`): the `LC-R4 MERGED / COMPLETE (PR #306 …)` line in `PROJECT_HANDOFF.md` and the merged-status header of the LC-R4 Result. A comment names that commit. The CI facts in that text (Deploy #220, E2E WebKit #348) are as recorded by #307 (not re-verified here); PR #306's merge commit `12725eb` is verified to be in main.

**#269 — read-only audit: COMPLETE as to its own scope (LC-1 / LC-1b); stays open pending an Owner close decision.**

| #269 scope item | On main |
|---|---|
| working-set selection, placed / pinned, deterministic fill | `selectWorkingSet` (`workingSet.ts`) — ported in LC-R0, extended through R2 / R5-d |
| disclosed-hint priority | `hintDisclosure.ts` — **trimmed** (named-ingredient disclosure only); Hint 5.0 ladder × `hintDisclosure` is **unaudited, deferred to LC-4** |
| favorites / recent / newly owned (session-only) | `usageSignals.ts` — present, **no UI** |
| category / family / search query | `queryCatalog` — **reshaped**: one `shelves` axis from `ingredientShelf` (the free-string family axis was retired on purpose), + JA search / aliases |
| ownership-basis Dex summary | `dexActionSummary.ts` — as is |
| fixtures 29×25 … 179×172 | `LARGE_CATALOG_FIXTURE_IDS` — 8 populations (incl. the mixed 37×34), pinned to the committed scale model |
| privacy regressions, static import boundary, mutation gate | carried over; mutation gate has since grown (M1–M114 + E-series) |

Residual work that is **not** #269 scope and has **no open tracking Issue** (search of open Issues: only #269): R6 hand / pin activation + capacity decision (PR #319 is the only vehicle), Dinner / recipe-tray audit, Phase 5 counts, LC-4 Hint 5.0 × `hintDisclosure`, favorites / recent UI. Verdict: **完了済み (scope complete) — with a hand-over need**: if the Owner wants these tracked, a new umbrella Issue is the right vehicle (not created here). Suggested action: close #269 as completed with a comment pointing at LC-R0 / R1 Results and the new Issue, if any.

