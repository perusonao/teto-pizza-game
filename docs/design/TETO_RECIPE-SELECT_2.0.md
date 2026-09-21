# Teto Pizza Game — Recipe Select 2.0 — Design

**Status: design candidate, READ-ONLY task — no `src/**` changes.**
Audited `main` SHA: `1b0b764b0c09d0f74215a04f303095bea577a572`
Companion report: `docs/reports/TETO_RECIPE-SELECT_2.0_Phase0_Fresh-Audit.md`
Companion screenshots: `docs/reports/screenshots/recipe-select-2.0-phase0/`

This document is docs-only, per the task's own instruction. Nothing here is wired into
`src/**`; every recommendation below is a plan for a future implementation phase, not a change
made in this session.

---

## 1. Scope and why this task exists

Recipe Select shipped as a full-catalog scrolling grid (Issue #39, PS1–PS3), was rebuilt into a
single-recipe pager with 前へ/次へ navigation (Issue #88 / UX-4, `TETO_UX-4_PIZZA-SELECT-PAGER_Result.md`),
and the catalog has since grown from 7 to **15 production recipes** (Batch 1A/1B-A/1B-B/1B-C).
UX-4's own result report was explicit that it implemented only the "≤10: pager" rung of a
pre-existing Scale Gate table (`TETO_INGREDIENT-ECONOMY-UI-SCALABILITY_Fresh-Audit.md` §10.2) and
left the next rung — "11–30: pager + tier/chapter section headers" — for a later phase once recipe
count actually grew past Chapter 1. **That later phase is now.** 15 already sits inside the
11–30 band; this document is the design pass for that next rung, extended out to the 30–50 range
the task asks about.

---

## 2. Fresh state of the current implementation (verified against `main`, not memory)

| Fact | Value | Source |
|---|---|---|
| Production recipe count | **15** | `src/data/recipes.ts` (`RECIPES` array, 15 entries) |
| UI model | Single-recipe pager, 前へ/次へ, clamp-at-ends (no wrap) | `src/screens/PizzaSelectScreen.tsx` |
| Position indicator | Dots at ≤10 recipes, `"N / total"` counter above 10 (`PAGER_DOT_INDICATOR_MAX = 10`) | `src/state/pizzaSelect.ts` |
| **At 15 recipes today, the indicator is already in counter mode** (`8 / 15` etc.), not dots | Confirmed live in screenshots | — |
| Card states | `COMPLETED` (★ + BEST score), `NEW` (badge, "未挑戦"), `LOCKED` (silhouette + name or `？？？` + hint) | `src/state/pizzaSelect.ts` `recipeCardState` |
| Category / tier / difficulty field on `Recipe` | **None exists** — only `id`, `nameJa`, `description`, `requiredIngredients`, `bakeTarget`, `baseRewardPitz`, `unlockCondition`, `mysteryLock` | `src/data/recipes.ts` |
| Unlock structure | **One single linear chain** — every recipe (except margherita) requires exactly one specific prior recipe `discovered` + an increasing `minTotalStars` floor (8→12→...→36, +3~4 per step in the Chapter-2 tail) | `src/data/recipes.ts` |
| Display order vs. chain order | **Diverge for the first 7 recipes** (original Chapter 1): array order is margherita/marinara/quattro-formaggi/genovese/bismarck/funghi/fugazza, but the real unlock chain is margherita→funghi→marinara→bismarck→genovese→quattro-formaggi→fugazza. From recipe #8 onward (Chapter 2) array order and chain order are identical. This divergence is intentional and already unit-tested ("Recipe ordering preserved — RECIPES' own declared order, not chain order") | `TETO_UX-4_PIZZA-SELECT-PAGER_Result.md` §13 test 11 |
| Mystery lock (`？？？`) usage | **Exactly 1 recipe** (`fugazza`) sets `mysteryLock: true`; every other locked recipe shows its real name + a hint | `src/data/recipes.ts` |
| CookingProfile | Exists (`src/data/cookingProfiles.ts`) but is a per-recipe *step-order* profile for gameplay (DOUGH→SAUCE→CHEESE→TOPPING flow), never surfaced on Recipe Select or Dex today. Not a source of a "difficulty" signal in the UI currently. | `src/data/cookingProfiles.ts` |
| Dex (図鑑) | Separate overlay, own scrollable list of all 15 recipes, shows description + full ingredient list + ★BEST/score/timesMade per discovered recipe, generic `？？？`/🔒 for every undiscovered one (no per-recipe unlock hint) | `src/components/DexOverlay.tsx` |
| HOME → Recipe Select entry | HOME's `🍕 ピザを作る` CTA → `PIZZA_SELECT` screen; HOME also shows a `レシピ N/15` badge and a `ビザ図鑑 発見 N/15` card (opens Dex, not Recipe Select) | `src/screens/HomeScreen.tsx`, `src/App.tsx` |
| Favorite | Does not exist in save schema or UI | `src/state/persistence.ts` |
| Search | Does not exist | — |

**Prior-art tension already on record, restated fresh:** `TETO_INGREDIENT-ECONOMY-UI-SCALABILITY_Fresh-Audit.md`
§9 independently evaluated "full grid" vs. "1-recipe/screen carousel" and recommended grid at
every scale, calling a carousel "strictly worse" once recipe count grows, and reserving a
single-recipe *view* for a **detail screen reached by tapping a grid card**, not as the primary
browsing model. Issue #88 nonetheless chose the pager for the (then 7-recipe) production catalog
on explicit product instruction ("ピザ選択は1画面に収め、次へ・前へボタンで切り替える"), while keeping the
`recipes` prop swappable specifically so a future phase could revisit this without a rewrite.
Section 5 below re-evaluates this tension fresh, now that the catalog has actually grown.

---

## 3. Duplicate gate

Searched for existing Issues/PRs/docs covering Recipe Select 2.0, catalog/filtering/category/
search/favorite UX: no open Issue or PR matches (`search_issues` for "recipe select catalog
filtering category search favorite 2.0" returned zero results; open PRs are only #133 — Player
Profile ranking snapshot — and #136 — Pizza Cutting Phase 4 audit, both docs/feature work
unrelated to Recipe Select's own UI). `TETO_RECIPE-EXPANSION-20.md` / `TETO_RECIPE-MASTER-CATALOG.md`
/ `TETO_RECIPE-MASTER-CATALOG_160_Fresh-Analysis.md` cover *which recipes to add next and in what
order* (content/data), not *how Recipe Select displays them* (UX/information design) — no overlap
with this document's scope. No duplicate work exists; this document is new ground.

---

## 4. Layout options (390×844 first)

| # | Layout | Visibility | Touchability | Scalability (15→50) | Visual richness | Impl. cost | Image/reference compat. |
|---|---|---|---|---|---|---|---|
| A | Vertical scrolling cards (pre-Issue #88 original) | 1 full card + partial next visible | Good, large targets | Poor — 50 recipes = very long scroll, no structure | Good — full card per recipe | Low (already built once, removed) | Good |
| B | 2-column compact grid | 6–8 cards/screen | Good if cards ≥ ~150×150px | OK to ~30 with section headers; needs those past 30 or it's one long scroll | Medium — thumbnail-led, less room for status text | Medium | Good — thumbnails scale down cleanly |
| C | Horizontal one-recipe carousel (**current**) | 1 recipe | Very good, huge target, no accidental mis-tap | **Poor past ~15** — confirmed by measurement below: 15 taps from first to last recipe today, 50 would be up to 49 taps one-way with zero overview | Very good — full detail per card | Already built | Good |
| D | Category tabs + grid | 6–8 cards/screen within a tab | Good | Good to 50+, *if* categories are real and roughly balanced | Medium-good | Medium-high (new tab chrome + data categorization) | Good |
| E | Category tabs + compact list | ~5–6 rows/screen within a tab | Good, but rows are narrower targets than grid cells | Good to 50+ | Lower — list rows read as more "admin panel" than "game" | Medium | Weaker — thumbnails get squeezed into a row, less visual presence |
| F | **Chapter/section-header grid, no tabs** (flat scroll with sticky `第1章`/`第2章` headers, per the pre-existing Scale Gate's own 11–30 recommendation) | 6–8 cards/screen, headers as landmarks | Good | Good to ~30; needs to graduate to D past 30–50 once section count itself grows past a handful | Medium-good | Medium (grid + headers, no tab-switch state) | Good |

**Measured cost of C (current) at today's 15 recipes:** confirmed live via the fresh screenshots
(§7/§8 of the companion audit) — reaching the 15th recipe from the 1st requires 14 consecutive
「次へ」taps with **zero visibility of any other recipe** while doing so (only a `1/15`-style
counter, no names, no thumbnails of what's ahead). At 30 that is 29 taps; at 50 it is 49. This is
the concrete mechanism behind "破綻" (breakdown) at scale, not a subjective impression.

### Recommendation

**F now → D once category becomes real (see §8's threshold).** A flat grid with sticky
chapter-position section headers keeps browsing scalable without inventing categories the data
doesn't support yet (§2: there is no `category` field, and the unlock structure is one single
chain, not category-shaped). Tabs (D) become worth their implementation cost only once there is
a second, independent grouping axis (e.g., a real "系統/カテゴリ" field, not just "unlocked so
far in order") — see §8. The pager (C) is not discarded outright; see §5's own recommendation for
where a single-recipe *focused* view still earns its place.

---

## 5. Fresh evaluation of the "1画面に収め、次へ・前へ" requirement

This was a real, explicit past product instruction (Issue #88), not assumed here. Re-evaluated
against today's 15-recipe data, not accepted automatically per the task's own instruction:

- **At 15, it still technically "works"** — no crash, no overflow, no broken layout (confirmed:
  §7/§8 measurements below). But the *browsing* cost is already real: a player who wants recipe
  #12 and is sitting at #2 has no way to know that without either tapping 10 times or opening Dex
  (a different screen, different purpose) to look up its position.
- **The single-recipe *focus* is still valuable** — large thumbnail, no competing content,
  strong "which pizza am I about to make" moment, good touch-target safety (the shared CTA is
  never accidentally the wrong recipe, unlike a dense grid of same-sized tappable cells).
- **What breaks at 30–50 is *finding* a recipe, not *looking at* one.** The fix is not
  necessarily removing the pager experience — it's giving the player an overview (grid/section
  list) to *jump into* a specific recipe, with the focused one-recipe view (今の pager) still
  available as the "confirm and start" step after that jump, matching exactly the "detail view
  reached by tapping a grid card" model the Ingredient-Economy audit already recommended in a
  different context (§9 there, §4 here).

**Verdict: do not keep the pager as the sole/first screen past ~15–20 recipes.** Recommended
target shape: a grid/section overview is the primary browsing surface (Layout F, graduating to D);
tapping a card opens a focused one-recipe detail (today's pager panel, minus the 前へ/次へ chrome,
plus a 戻る-to-grid affordance) as the confirm step before `このピザを作る！`. This keeps every
UX property Issue #88 wanted (a focused, single-recipe commit moment, big CTA, no accidental
selection) while fixing the part that doesn't scale (browsing via serial taps alone).

---

## 6. Recipe card information — select vs. Dex

Two clearly separate concerns per the task's own framing (§12 below expands this into the
screens' full division of responsibility):

**Recipe Select card (choosing what to make) — minimum necessary:**
- Pizza name (or `？？？` for the one mystery-lock recipe)
- Thumbnail/reference image
- Unlocked / Locked state (visually obvious without reading text — today's silhouette+lock icon
  already does this well)
- Locked: unlock condition/hint (today's `〇〇を1枚完成させると解禁` / `あと★Nで解禁` — keep, it
  already answers "what do I do next")
- NEW badge (never-yet-made, already unlocked) — this is the single most actionable signal for
  "what should I try next," keep it prominent
- Already-made: BEST ★ and BEST score (short-form mastery, useful for "do I want to retry this
  one" without needing the full Dex)

**Deliberately left off the select card** (available in Dex instead, avoiding duplication):
- Full description text
- Full ingredient list
- `timesMade` count
- Any "cooking steps" detail (Recipe Cooking Steps 1.0's `CookingProfile` — not a player-facing
  signal today, and this document does not propose making it one; a future difficulty label, if
  ever added, should come from actual gameplay data such as `CookingProfile.steps.length` or
  measured completion rates, not be invented here)

**Favorite / difficulty / ingredient count / cooking-step count**: evaluated and intentionally
excluded from the select card for now — see §7 (locked UX doesn't need it), §11 (favorite has no
save-schema slot yet and no clear value signal at 15 recipes), and the "information overload"
instruction in the task itself. A card with name + image + lock state + one status line
(NEW/★BEST/hint) is already the right density; adding difficulty, ingredient count, and
cooking-step count on top of that would turn a "which pizza looks fun" glance into a spec-sheet
read, which fights §13's "game, not admin panel" goal directly.

---

## 7. Locked recipe UX

| Option | Pro | Con |
|---|---|---|
| Fully hidden | Simplest | Player can't see how much content exists, no motivation signal — actively bad for retention once the catalog is worth exploring |
| Silhouette (**current**) | Shows "there's something here," doesn't spoil, low-cost to render at scale | None significant at 15; still cheap at 50 (same fixed-size placeholder asset regardless of catalog size) |
| Name only | More motivating than silhouette (concrete goal) | Reveals every future recipe name immediately, including comedic/surprise names (フガッサ's whole "big reveal" design point) — breaks the one existing mystery-lock recipe's intent if applied uniformly |
| Unlock condition shown (**current**) | Directly answers "what do I do next" — the task's own stated priority for this section | None — already the shipped behavior, keep it |
| Progress bar/number | Most concrete motivator (e.g. "★24/27") | Slightly denser card; only worth it once a locked recipe's threshold is far enough away that a static hint sentence feels vague — not clearly true yet at today's +3~4-star chain steps |

**Recommendation: keep the current silhouette + real name (or `？？？` for the one deliberate
mystery-lock recipe) + textual unlock hint combination exactly as shipped.** It already satisfies
"player understands what to do next" (the task's own stated priority), scales to 50 without any
new asset or layout cost (same placeholder card regardless of how many locked recipes exist),
and preserves フガッサ's mystery design without a special case in the browsing UI (mystery-lock is
already a boolean per-recipe flag `recipeCardState` reads, no UI branch needed). A numeric
progress bar is a reasonable *future* enhancement once a recipe's threshold gap is large enough to
need it (e.g. a 30-star gap at high tiers), not a Phase-0 requirement.

**One addition worth flagging for 2.0B (not required for 2.0A):** in a grid/overview layout
(§4/§5), a long unstructured run of 20+ identical lock silhouettes in a row is visually flat in a
way it isn't in the pager (only one is ever visible at a time today). This is a visual-polish
question, not a functional one — a subtle count-so-far label ("あと8種類" on a section header,
which the Dex overlay already renders: `あと${total - discoveredCount}種類！`) is enough to keep a
long locked run legible without over-designing individual locked cards.

---

## 8. Categories

**Current reality: there is no category field, and the unlock structure is one single linear
chain** (§2) — every recipe requires exactly the one before it, in a fixed order. This is
fundamentally different from the design-candidate catalog explored in
`TETO_RECIPE-MASTER-CATALOG.md`/`pizza_master_catalog.json` (which does carry a `progressionTier`-
style field for a much larger, not-yet-implemented candidate pool) — none of that structure exists
in `src/data/recipes.ts` today.

Two distinct things could be called "category" here, and they should not be conflated:

1. **Position-based sectioning** (Chapter 1 / Chapter 2, or "レシピ #1–7" / "#8–15") — needs no
   new data field at all. It's derivable purely from array position or from the existing
   `unlockCondition` chain, which is exactly what Layout F (§4) uses. This is available *today*
   with zero data-model change.
2. **Flavor/ingredient-family category** (Classic/Meat/Vegetable/Cheese/Special, as the task's own
   example lists) — requires a genuinely new `category` field authored per recipe, a decision on
   which of the 15 existing recipes gets which label (some are ambiguous — e.g. is カプリチョーザ
   "Meat" or "Special"?), and, because the unlock chain is strictly linear today, would **not**
   change unlock order — it would only reorganize *browsing*, decoupled from progression. That's a
   legitimate thing to want (browse by flavor even though you unlock in a fixed sequence) but it
   is real content-authoring + design work, not free.

**Threshold recommendation:** introduce (1) position-based sectioning immediately as part of 2.0A
(no data change, addresses the actual §4 breakdown mechanism directly). Defer (2) flavor category
until either (a) recipe count crosses ~30, where the task's own §10.2 Scale Gate precedent
("31–80: tier tabs") starts to apply, or (b) a future recipe-expansion phase explicitly authors a
`category` field as part of adding new recipes (cheapest time to assign a category is when a
recipe is first written, not retrofitted onto 15+ existing ones later). Forcing flavor categories
onto today's 15 recipes now would be exactly the "don't force categories that aren't needed yet"
case the task explicitly warns against.

---

## 9. Search

At 15 recipes, a player can visually scan a flat/sectioned grid (Layout F) faster than typing a
query — search is pure overhead at this scale, consistent with the pre-existing Ingredient-Economy
Scale Gate precedent (`10.1`: search/filter only justified once a set is "80+" for ingredients;
`10.2`: recipe search is only listed at the "80+" recipe band, not 11–30 or 31–80). Even at 30–50,
a well-sectioned/tabbed grid (§4/§8) is likely to stay faster than a mobile keyboard for a catalog
this size — pizza names are short, and there are at most a handful of sections to scan. **Recommendation: search is 2.0C-or-later, gated on evidence (either recipe count nearing 80,
or a future usability signal that players are struggling to find a specific recipe in the
grid/tabs), not part of 2.0A/2.0B.**

---

## 10. Sort / Filter

Minimum viable set for 2.0A/2.0B, evaluated against the task's candidate list:

| Candidate | Include now? | Why |
|---|---|---|
| Unlocked first | **No, as an explicit control** — but the grid's default order (chain/array order, §2) already puts every unlocked recipe before any locked one in practice today, since unlock is strictly sequential. No control needed to get this outcome. |
| NEW | **Yes — as a badge (already shipped), not a separate sort/filter control.** A NEW badge on the card is enough at 15–50; a dedicated "show NEW only" filter is overkill until the catalog is large enough that NEW recipes get lost in a long scroll, which position-based sectioning (§8) already mitigates. |
| Favorites | No — favorite doesn't exist yet (§11) |
| Difficulty | No — no difficulty field exists (§6); do not invent one for this document |
| Alphabetical | No — actively counterproductive here: it would break the unlock-chain narrative order the current card hints depend on ("〇〇を1枚完成させると解禁" reads naturally in chain order) |
| Category | No — no category field yet (§8) |
| Completion (★/BEST) | **Partially — already shown per-card (§6), no separate sort needed at 15–50** |
| BEST score | Same as above |

**Recommendation: no dedicated sort/filter UI for 2.0A or 2.0B.** The existing per-card status
(NEW badge, ★BEST) plus position-based sectioning (§8) already answers "what's new" and "what have
I mastered" without adding a control surface. Revisit only alongside real search (§9), i.e. 2.0C-
or-later.

---

## 11. Favorite

No save-schema field exists (`PersistentSaveV2` in `src/state/persistence.ts` has no favorite-
related key), and per the task's own §11/§18 instruction, this document does not propose changing
the save schema. Value at 15 recipes is low — a player can hold "which pizza I like" in their head
at this scale; it becomes more useful once the catalog is large enough that scrolling back to a
specific favorite recipe is itself a chore (correlates with the same 30–50+ threshold as search,
§9). **Recommendation: defer to a future phase (potentially bundled with 2.0C's search/filter
work, since a schema bump is cheapest to batch with other schema-touching changes) — no schema
change in 2.0A/2.0B.**

---

## 12. Recipe Select ↔ Dex relationship

The task's proposed split is already close to what's shipped, and this document adopts it
explicitly as the target division of responsibility:

- **Recipe Select: "what will I make next."** Forward-looking, action-oriented, ends in
  `このピザを作る！`. Minimum info to decide (§6).
- **Dex (図鑑): "what have I made."** Retrospective record — full description, full ingredient
  list, `timesMade`, ★BEST/score. Already scoped this way in `DexOverlay.tsx` today — no
  functional change recommended here, only a light content trim on the *Select* side (§6) to stop
  any future temptation to duplicate Dex's descriptive text onto the select card as the catalog
  grows.

**One integration point worth adding in a later phase (2.0C), not required for 2.0A/2.0B:** a
"開く図鑑で" / "レシピ図鑑を見る" affordance directly from Recipe Select's overview grid, so a
player curious about an already-discovered recipe's full record doesn't have to back out to HOME
first. Low cost, not blocking — flagged as a nice-to-have, not scoped into a specific phase number
here since it's independent of the layout work.

---

## 13. Visual direction

Reviewed `docs/design/PIZZA_GAME_UI_SPEC.md` §4 (warm wood/cream palette, rounded hand-drawn-style
font, colored step tabs) and the fresh screenshots of HOME/Recipe Select/Dex side by side
(`docs/reports/screenshots/recipe-select-2.0-phase0/`). Recipe Select today is already visually
consistent with HOME (same warm cream card background, same header treatment, same rounded CTA
button) — it does not currently read as an "admin panel." The risk flagged by the task (§13) is
prospective: a grid/section-header layout (§4/§8) *could* drift toward a spreadsheet-like density
if built carelessly (many identical small cards, a plain list of section labels). Concrete
guidance for 2.0A implementation to avoid that: keep the existing warm-cream rounded-card visual
language per grid cell (reuse `.pizza-select-card`'s existing look at a smaller size, don't
introduce a new flat/square card style), keep thumbnails prominent (not shrunk to icon size), and
render section headers as the same warm/friendly typographic style already used for `作るピザを選ぼう！`
rather than a plain bold label. This is a call for implementation discipline, not a layout
mechanism — no new visual system needs to be designed in this doc.

---

## 14. Performance (conceptual — no measurement tooling run this session)

- **DOM**: 30–50 grid cells is a small DOM by any modern web standard (well under the range where
  React reconciliation or layout cost becomes visible on a phone-class device) — not a concern
  requiring mitigation at this scale.
- **Image loading**: today's `PizzaThumbnail` renders per-recipe reference art. At 50 recipes,
  loading every thumbnail eagerly the moment Recipe Select mounts is the one real cost worth
  guarding against (network + decode cost on a mobile connection). Standard mitigation:
  `loading="lazy"` on off-screen thumbnails (native browser lazy-loading, near-zero implementation
  cost) is sufficient at this scale — no custom virtualization/windowing library is warranted for
  30–50 items.
- **Scroll performance**: a native-scroll grid of 30–50 lightweight cards is well within what
  mobile Safari/Chrome handle smoothly without virtualization. Revisit only if a future catalog
  size (80+, matching the same Scale Gate band search/favorite are gated on) makes this a measured
  problem, not a projected one.

**Recommendation: `loading="lazy"` on thumbnails is worth doing in 2.0A as a one-line safeguard;
no other performance work is justified by today's or 30–50's scale.**

---

## 15. Recommended architecture

| Phase | Scope | Depends on | Est. Claude Code time |
|---|---|---|---|
| **2.0A** | Replace the pager's sole-browsing role with a flat/sectioned grid (Layout F: position-based `第1章`/`第2章`-style headers, no new data field) as the primary Recipe Select screen; tapping a card opens today's existing focused single-recipe panel (minus 前へ/次へ, plus 戻る-to-grid) as the confirm-and-select step. Locked-card treatment (§7), card info trim (§6), and lazy thumbnail loading (§14) land in this phase. | This audit | 2–3 hours |
| **2.0B** | Graduate section headers to real category tabs (Layout D) **only if/when** a `category` field is authored (§8) — e.g. alongside a future recipe-expansion content phase. Otherwise 2.0B is "add a second, later section-header rung" (e.g. Chapter 3) with no tab chrome yet. | 2.0A; a category-authoring decision | 2–3 hours (tabs) or ~1 hour (more sections only) |
| **2.0C** | Search + favorite (schema bump) + Dex quick-link from the grid, gated on recipe count approaching 80 or an evidenced findability problem (§9/§11), not on a calendar date. | 2.0A/2.0B; a save-schema version bump | 2–3 hours |

This intentionally mirrors the pre-existing Scale Gate table's own phasing discipline (`11–30`,
`31–80`, `80+`) rather than inventing a new one — 2.0A closes the gap Issue #88 explicitly left
open for "later," 2.0B/2.0C are gated on data/scale conditions actually being met, not scheduled
speculatively.

---

## 16. Implementation priority (vs. other in-flight work)

Not evaluating in a vacuum — the task asks this explicitly. Candidates on record this session:
Player Profile (PR #133, open), Pizza Cutting 1.0 Phase 4 (PR #136, open), Dex Gallery, Visual
Polish, further recipe expansion (content-only, `TETO_RECIPE-MASTER-CATALOG_160_Fresh-Analysis.md`).

**Recipe Select 2.0A is not urgent relative to those, but it is a prerequisite for further recipe
expansion, not parallel/unrelated work.** Concretely: the moment a future content phase adds
recipe #16, the pager's browsing-cost problem (§4/§5) gets strictly worse with no code change of
its own — every recipe added before 2.0A ships is added directly onto the thing this document
identifies as already past its designed threshold. **Recommendation: land 2.0A before (or
alongside, if scheduled adjacently) the next recipe-content expansion phase, rather than after
it** — this avoids growing the catalog further on top of a browsing model the pre-existing Scale
Gate document already flagged as due for replacement at this size. PR #133 and #136 are unrelated
screens (Player Profile, Pizza Cutting) and have no sequencing dependency with this work either
direction.

---

## 17. Open questions for the next implementation phase (not resolved here)

- Exact section-header copy/threshold for 2.0A ("第1章"/"第2章" vs. "レシピ #1–7"/"#8–15" vs. some
  other framing) — a copy decision, not a structural one, left to 2.0A's own implementation pass.
- Whether the focused single-recipe detail view (post-2.0A) keeps any 前へ/次へ chrome at all
  (e.g. for adjacent-recipe browsing without returning to the grid) or drops navigation entirely
  in favor of 戻る-only — a small UX call best made with the actual grid in hand, not speculatively
  here.
- Grid column count (2 vs. 3) at 390×844 — a layout-density call for 2.0A's implementation,
  bounded by the existing 44×44px minimum tap target (`PIZZA_GAME_UI_SPEC.md` §5).
