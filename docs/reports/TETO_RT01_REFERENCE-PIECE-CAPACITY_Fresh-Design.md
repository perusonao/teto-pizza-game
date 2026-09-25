# RT-01 Reference Pizza Piece Capacity — Fresh Design

Status: **Fresh Design (docs/tools only) — OWNER APPROVED 2026-09-25 (RT-01-OD-1, see §14)**. There is no production change in this document, no PR and no merge.
Branch: `claude/rt-01-pizza-piece-capacity-1ncicd` (from main `1e53baa`).

Companion (machine-readable): `docs/reports/data/TETO_RT01_REFERENCE_PIECE_CAPACITY_DESIGN.json`
Visual comparison (HTML): `docs/design/rt01/TETO_RT01_PLACEMENT_COMPARISON.html`
Generator / checker: `python3 tools/rt01_reference_capacity_design.py [--check]`. Run
`git fetch origin codex/w1-authoring-fresh-audit codex/content-readiness-fresh-audit` first.

This task did not touch the branches of the other sessions (Production Visual P1, REC-04 Fresh
Design, REC-01..03 Fresh Audit). The #220 and #221 branches were only fetched and read.

---

## 0. Authority (re-read from GitHub, not from memory)

| Item | Value |
|---|---|
| #221 (RT-01 authority) | OPEN, unmerged, head `070afc0827f382bec8bc813d62e7fafe663a0991`. Codex Final Gate: "no major issues" on this exact head |
| #220 (W1 authority) | OPEN, unmerged, head `e49dab96bd9b26dc0f520349cf09d1160c3519f5`. #221 `authorityRef.headSha` matches it |
| RT-01 ledger row | `RUNTIME_DEPENDENCY_REQUIRED`, `REFERENCE_RING_CAPACITY`. Scope: `parmigiana-pizza, pizza-portuguesa, puttanesca-pizza` |
| #221 slice E | "Reference ring capacity beyond 8 non-sauce pieces". **dependsOn: "reference-layout redesign owner approval"**. Guard: "Do not trim authored minCounts" |

The tool re-derives these from `git show <pinned sha>:<path>` and fails on any mismatch. It
checks: W1 membership (#220 vs #221), each recipe's non-sauce piece count (recomputed vs #221
`referenceCapacity`), and RT-01 scope vs the recomputed over-capacity set. Result:
**verified, 0 errors**.

| W1 recipe | non-sauce pieces (types) | > 8? |
|---|---|---|
| Parmigiana Pizza | **9** (mozzarella 2, eggplant 3, parmigiano 2, basil 2) | yes |
| Pizza Portuguesa | **10** (mozzarella 2, ham 3, egg 1, onion 2, black-olive 2) | yes |
| Puttanesca | **9** (anchovy 3, black-olive 2, capers 2, garlic 2) | yes |
| other 7 W1 recipes | 7 each | no |

The latest authority confirms the counts in the brief: 9 / 10 / 9.

---

## 1. Root cause

The layout is driven by one hard-coded 8-entry table,
`PIECE_RING_POSITIONS` (`src/logic/pizzaReferenceLayout.ts`). It holds 7 hand-tuned points on a
ring (r ≈ 26–31) plus a centre point. Minimum gap 20.0, max radius 31.4.

Two consumers index this table with `% 8`, so any overflow silently wraps onto an occupied slot:

- `getPlayerReferencePizza()` (`src/data/playerReference.ts:52`):
  `PIECE_RING_POSITIONS[slot % PIECE_RING_POSITIONS.length]`. Piece 9 lands exactly on piece 1.
  The reference then *looks* like 8 pieces while the caption says 9. This misrepresents the
  quantity.
- `PizzaThumbnail` (`src/components/PizzaThumbnail.tsx`, Recipe Select): uses `index % 8`, but
  it draws **one glyph per ingredient type**, not per piece. Its limit is 8 types.

The 8 limit has also been enforced by **content authoring**, not only by code:

- Capricciosa was trimmed from the audit's 10 pieces to 8 (`src/data/recipes.ts:307-316`).
- Supreme was deferred (`src/data/recipes.ts:357-368`).
- Meat Lovers' Scoring fixture copies the 8 ring coordinates by hand (`src/data/referencePizza.ts:862-935`).
- Two tests lock the ceiling (`src/data/recipes.test.ts:194,234`, and
  `src/data/playerReference.test.ts:45` "never places two pieces … at a colliding slot").

RT-01 exists to stop hiding the problem by trimming `minCount`.

## 2. Current capacity (and which renderer is authoritative)

| Consumer | Unit | Capacity | Overflow | Role |
|---|---|---|---|---|
| `playerReference.ts` `getPlayerReferencePizza` | piece | **8** | wraps → duplicate coords | player-facing *visual*; fallback when no Scoring fixture exists |
| `PizzaThumbnail.tsx` (Recipe Select) | ingredient **type** | **8 types** | wraps | visual only |
| `referencePizza.ts` `getReferencePizza` (Scoring 2.0 fixtures) | piece | no structural cap (hand-authored literals) | n/a | **scoring authority**: its positions are placement targets |
| `ReferenceThumbnail` / `ReferencePreview` / `PlayerReferencePreview` / `PizzaVisualPieces` | piece | draw whatever positions they receive | — | visual only |

**Is the Reference Pizza layout a scoring authority?** It depends on which layout.

- `referencePizza.ts` fixtures **are** scoring authority. `computeScoringV2` → `scorePiecesComponentV2`
  matches player toppings against `pieceGroups[].positions`. The matching uses a per-ingredient
  Hungarian assignment with a full-credit radius of 8 and a zero-credit radius of 22. It is
  authoritative for `state.score`, RESULT, Dex BEST, Mission and progression. A recipe without a
  fixture returns `available: false`.
- `playerReference.ts` / `PIECE_RING_POSITIONS` are **visual only**. Their headers state that
  nothing in Scoring 2.0 reads them, and the popover disclaimer says so to the player
  (「採点の基準座標ではありません」).
- In production today, all 15 shipped recipes have a fixture. GameScreen therefore shows the
  **fixture** positions in the mini 見本 and in the popover. `playerReference` is the defensive
  fallback.

Consequences for W1:

- Each W1 recipe needs a new Scoring fixture anyway, and the fixture has no 8 cap.
- The 8-slot ring still blocks W1:
  - (a) the fallback path renders 9 and 10 as 8;
  - (b) the ring is the de facto authoring convention for fixture coordinates (Meat Lovers
    precedent);
  - (c) the existing capacity tests fail as soon as a 9+ piece recipe enters `RECIPES`.

Not affected:

- **PizzaStage (raw and baked)** renders the player's own toppings, and `bakeVisual.ts` changes
  only colour and filters. Reference positions do not depend on bake state, so baking cannot
  move them.
- **ResultPanel** shows the player's pizza only.
- **Persistence** (schema v2) stores no coordinates.

## 3. Affected W1 recipes

Parmigiana Pizza (9), Pizza Portuguesa (10) and Puttanesca (9) are affected, the same set as
RT-01's scope (verified by the tool).

- All W1 recipes have 3–5 non-sauce **types**, so Recipe Select `PizzaThumbnail` is not affected
  for W1.
- The other 7 W1 recipes have 7 pieces and fit.

## 4. Future data distribution

Authored counts exist only for production and W1. For the 53-entry catalog and the 172 evidence
rows, pieces are **estimated** from the number of non-sauce types, using two rules taken from
authored data:

- **empirical**: types × 2.203. This is the mean `minCount` per type over 25 authored rows. The
  histogram is x1: 9, x2: 43, x3: 20, x4: 2.
- **W1 high**: 2 × types + 1. This is the W1 convention: one primary ×3, every other type ×2.

Both rules give the same maximum.

| Population | rows | max non-sauce types | exact max pieces | rows > 8 | est. max pieces | est. rows > 8 | est. > 12 | est. > 16 |
|---|---|---|---|---|---|---|---|---|
| production | 15 | 5 | 8 | 0 | — | — | — | — |
| W1 | 10 | 5 | **10** | **3** | — | — | — | — |
| 53 catalog | 53 | 7 (Supreme) | — | — | **15** | 14 | 1 | 0 |
| 172 evidence | 172 | 6 | — | — | **13** | 81 | 5 | 0 |

Caveats:

- 52 of the 172 rows have an incomplete identity set; those rows fall back to their canonical
  IDs.
- Sauce-like tokens that are not a declared spread layer are counted as pieces, so the estimate
  is conservative (high).

**Capacity estimate: 15 pieces** (7 types × 2 + 1) is the highest value any known population
reaches under the most generous authoring rule observed. About **half of the 172 evidence rows
(81)** would exceed 8 pieces under standard authoring. The problem is structural, not a W1 edge
case.

**No hard cap is proposed.** The algorithm is defined for any n. Section 5 reports, per view,
the n at which pieces physically start to touch. That limit comes from piece size; it is not a
content limit.

Piece footprints, measured from `App.css` as a % of the positioning box:

| View | Piece footprint |
|---|---|
| mini 見本 48px | 18.2% |
| reference thumb 64px | 17.0% |
| popover 140px | 10.9% |

These views have fixed pixel sizes, so the numbers are the same at 390×844 and 360×800. The
only viewport-dependent surface is the player's own dough (`min(78vw, 300px)`), which is not a
reference renderer.

## 5. Candidates

Every candidate returns `PIECE_RING_POSITIONS[:n]` unchanged for n ≤ 8. The tool asserts this
(`preservesLegacyUpTo8 = true` for all candidates). All candidates are deterministic.

| | Idea | Deterministic input | Largest n with no touching pieces (48 / 64 / 140 px) | min gap @9 / 10 / 12 / 15 / 16 / 20 |
|---|---|---|---|---|
| CURRENT | slot % 8 | n | 8 / 8 / 8 | 0 / 0 / 0 / 0 / 0 / 0 |
| **A** Dynamic radial | centre + (n−1) on one r=28 ring | n | 10 / 11 / 16 | 21.4 / 19.2 / 15.8 / 12.5 / 11.6 / 9.2 |
| **B** Multi-ring | centre (0/1) + 1–4 concentric rings; most compact config that stays touch-free at 48px, else the widest gap | n | **15 / 17 / 38** | 21.4 / 19.2 / 19.2 / 19.2 / 18.1 / 16.3 |
| **C** Seeded best-candidate | Mitchell sampling, PRNG = fnv1a(recipeId\|n) | recipeId + n | 8 / 9 / 17 | 18.1 / 15.2 / 14.1 / 12.5 / 11.0 / 9.7 |
| **D** Golden-angle sunflower | r = R·√((i+½)/n), θ = i·137.5° | n | 8 / 9 / 23 | 17.5 / 16.6 / 15.2 / 13.6 / 13.1 / 11.8 |

- **A** is simple and, at 9 and 10, looks like today's ring. It collapses into a crowded
  necklace from about 12 pieces.
- **B** generalises what the legacy table already is: a ring plus a centre. For 9 and 10 it
  picks the same "ring (r=28) + centre" shape as A. It adds a second ring only when needed
  (12 → outer 30; 15 → outer 34 + inner ring). It is the only candidate that stays touch-free
  through the capacity estimate (15) at every view.
- **C** looks natural but clumps, depends on the recipe ID (a rename changes the layout), and
  is hardest to test.
- **D** has uniform density and a neat formula, but already touches at 9 in the mini thumbnail.

Slot → ingredient assignment for n > 8:

- **consecutive**: today's rule. Each ingredient takes adjacent slots.
- **interleaved**: round-robin over slots sorted by angle.

With B, interleaving raises the minimum distance between pieces of the same ingredient from
19–21 to **28.0** for all three W1 recipes. Each ingredient then spreads across the pizza, which
matches the popover's 「まんべんなく」 guidance. For n ≤ 8, assignment stays consecutive so that
shipped visuals do not change.

## 6. Visual comparison

`docs/design/rt01/TETO_RT01_PLACEMENT_COMPARISON.html` is self-contained and viewable offline
(light and dark). It shows:

- **§1**: n = 8, 9, 10, 12, 16, 20 × {CURRENT, A, B, C, D}, each at popover (140), thumbnail
  (64) and mini (48) size. Pieces are drawn at the real footprint; a red outline means two
  pieces touch.
- **§2**: Parmigiana, Portuguesa and Puttanesca with real glyphs, for CURRENT, B-consecutive,
  B-interleaved, D and C.
- **§3**: legibility thresholds.
- **§4**: distribution table.

Headless-Chromium screenshots at 1200 px and 390 px wide were checked for rendering. They are
review aids, not committed. No video was produced: this is a docs/tools-only design, and the
Human Verification Policy §2 exempts docs-only changes.

## 7. Recommended architecture

1. **Candidate B + interleaved assignment for n > 8; legacy freeze for n ≤ 8.**
   - A new pure function `getReferenceSlots(n)` in `src/logic/pizzaReferenceLayout.ts`:
     - n ≤ 8: `PIECE_RING_POSITIONS.slice(0, n)`, byte-identical;
     - n > 8: the B search, memoised per n. About 4k configurations × n² distance checks,
       single-digit ms, run once per n.
   - `PIECE_RING_POSITIONS` is kept and exported unchanged.
2. **`getPlayerReferencePizza`** uses `getReferenceSlots(totalPieces)`. It keeps consecutive
   assignment when total ≤ 8 and uses interleaved assignment otherwise. The modulo wrap is
   removed. Output for every shipped recipe stays byte-identical, and a snapshot test proves it.
3. **`PizzaThumbnail`** uses `getReferenceSlots(typeCount)` instead of `index % 8`. This changes
   nothing for ≤ 8 types, which covers all known data (max 7), and removes the latent wrap.
4. **Scoring fixtures for new recipes**: a W1 recipe's `referencePizza.ts` fixture is authored
   by taking the generator's output for that recipe and **freezing it as literals**. This is the
   Meat Lovers precedent, and `referencePizza.ts` stays import-independent of the layout module.
   Then:
   - the mini 見本, the popover and the scoring targets show the same coordinates (Reference
     Truth, #167);
   - a later change to the generator cannot silently move a scoring target;
   - the existing 15 fixtures are untouched.

   Tolerances stay at the standard 8/22. B's minimum gap (≥ 19 for n ≤ 15) keeps same-ingredient
   targets apart, and matching is per ingredient.
5. **Replace the 8-ceiling tests with invariant tests.** The new tests check: no duplicate
   coordinates, min gap ≥ view footprint for n ≤ 15, max radius ≤ 34, legacy prefix identical,
   and determinism. The "exactly 8 pieces" comments on Capricciosa and Meat Lovers become
   historical notes. The content of those recipes does not change.

Requirement check:

| Requirement | Result |
|---|---|
| 1–8 unchanged | yes (legacy freeze) |
| 9+ without overlap | yes; touch-free to 15 at 48px, to 38 at 140px |
| deterministic | yes; depends on n only, not on recipe ID |
| 390×844 and 360×800 legible | yes; the reference views are fixed-pixel |
| raw and baked positions do not jump | yes; positions are a pure function of recipe data |
| ingredient identity unaffected | yes; glyphs and colours untouched |
| scoring unchanged | yes |
| save schema unchanged | yes |
| supports 172-scale data | yes; the maximum estimate is 15 |

## 8. Scoring impact

**None for shipped content.** `referencePizza.ts`, `scoringV2/*` and `referenceMatching.ts` are
not modified, and the ruleset version stays `phase-4a-2-shadow-3`.

New W1 recipes get **new** fixtures, which is new data, not a change to scoring. Slice RT-01d
authors them together with the W1 recipe rows (#221 slices A/C). An optional regression test
checks that a player placing pieces exactly on the fixture scores 100 on Pieces.

## 9. Save impact

**None.** Schema v2 persists recipe IDs, Dex, inventory, Pitz and settings. It persists no
reference coordinates and no toppings, so no migration is needed.

## 10. Safari risk

**Low.** The change is pure TS data (percent `left/top` + the existing
`translate(-50%, -50%) rotate()`). It adds no new CSS features: no CSS trig, no container
queries. At most about 15–20 absolutely positioned spans are drawn per view, compared with 8
today.

The one thing to watch: emoji glyph widths differ slightly on iOS. The footprint model uses the
28px base size, and a Human Verification pass on real WebKit covers it. The implementation
slices change `src/**` and therefore need the WebKit CI gate. This design does not.

## 11. Tests required (implementation slices)

- `pizzaReferenceLayout.test.ts` (new):
  - `getReferenceSlots(n)` for n = 1..8 deep-equals `PIECE_RING_POSITIONS.slice(0, n)`;
  - for n = 1..40: exactly n distinct points and every point within r ≤ 34;
  - for n ≤ 15: min gap ≥ 18.2 (the largest footprint);
  - for n ≤ 38: min gap ≥ 10.94;
  - repeated calls return identical output;
  - golden snapshot for n = 9, 10, 12, 15, taken from the tool JSON.
- `playerReference.test.ts`:
  - byte-identical output for all 15 shipped recipes (snapshot taken before the change);
  - synthetic 9-, 10-, 15- and 20-piece recipes produce distinct coordinates with total =
    Σ minCount;
  - interleaved same-ingredient min distance ≥ consecutive.
- `PizzaThumbnail.test.tsx`: unchanged DOM for shipped recipes; a synthetic 9-type recipe has no
  duplicate positions.
- `recipes.test.ts`: replace the "exactly 8 … ceiling" assertions with the capacity invariant.
  Keep the recipe data untouched.
- Reference Truth (`ReferenceTruth.test.tsx`): the mini thumbnail and the popover still read the
  same `pieceGroups`.
- Human Verification for slice RT-01c (a W1 recipe with 9 or 10 pieces visible):
  - 390×844 video (+360×800 if a layout issue appears) with before/after screenshots under
    `docs/reports/screenshots/rt-01/`, per the policy;
  - cover Recipe Select → Making → mini 見本 → popover → bake → RESULT.

## 12. Implementation slices

| Slice | Content | Visible change | Depends on |
|---|---|---|---|
| **RT-01a** | `getReferenceSlots(n)` (B) + tests; `PIECE_RING_POSITIONS` kept | none | owner approval of §7 |
| **RT-01b** | `playerReference.ts` and `PizzaThumbnail.tsx` switched to `getReferenceSlots`; interleave for > 8; 8-ceiling tests replaced by invariants; byte-identity snapshots for the 15 recipes | none for shipped content | RT-01a |
| **RT-01c** | W1 over-capacity recipes: freeze generator output as `referencePizza.ts` fixtures when #221 slices A/C add Parmigiana / Portuguesa / Puttanesca; Human Verification video | yes (new recipes only) | RT-01b, #221 W1 slices, REC-01..04 / ING / REC-06/07/08/10 per #221 |
| (optional) RT-01d | Supreme / Capricciosa re-expansion: out of scope, product decision only | — | — |

RT-01a and RT-01b are internal refactors that are byte-identical for shipped content. They can
land before any W1 content.

## 13. Owner Decision

**Required: one approval, with a recommended default.** #221's own slice E declares
`dependsOn: "reference-layout redesign owner approval"`. This design cannot grant that approval
itself.

Decision requested (recommended default in bold):

1. **Adopt Candidate B (multi-ring) with legacy freeze for n ≤ 8.** The alternatives are A, C
   and D.
2. **Interleaved slot assignment for n > 8.** The alternative is consecutive, as today.
3. **New recipes' Scoring 2.0 fixtures are the frozen generator output (Meat Lovers
   precedent).** The alternative is hand-authoring each fixture.

The design otherwise needs no further decisions: no scoring, save or progression change, and no
trimming of `minCount`. Once these three points are approved, RT-01a and RT-01b are
implementation-ready.

## 14. Owner Decision record (RT-01-OD-1): OWNER APPROVED, 2026-09-25

The owner approved the following:

1. Adopt Candidate B (multi-ring placement).
2. n = 1..8 pieces keep the current `PIECE_RING_POSITIONS` layout exactly.
3. n ≥ 9 pieces assign ingredients interleaved.
4. Placement stays deterministic.
5. New recipes' Scoring fixtures store the output of `getReferenceSlots(n)` (or an equivalent
   placement function) as **frozen coordinates** in the fixture.
6. Runtime scoring targets are **not** generated dynamically.

This resolves #221 slice E `dependsOn: "reference-layout redesign owner approval"`. It is
recorded in the companion JSON as `ownerDecision` and `verdict: IMPLEMENTATION_READY`.

Scope authorised now:

- RT-01a (`getReferenceSlots(n)`)
- RT-01b (`playerReference` / `PizzaThumbnail` switch)

Deferred:

- RT-01c (W1 fixtures for Parmigiana, Portuguesa and Puttanesca). It joins the REC-01..04
  authority first.

Still out of scope:

- registering the 7 new ingredients
- registering the W1 recipes
- any change to #220, #221, #222, REC-04 or Production Visual P1

---

Implementation note (RT-01b): the interleave for n ≥ 9 is implemented as a turn-based
farthest-slot assignment. Groups still alternate turns, and each later piece takes the free
slot farthest from its own group's earlier pieces. This is the same approved "interleaved" rule,
refined over plain round-robin: at 12 pieces the minimum same-ingredient distance rises from 19.2
to 34.2, and at 15 pieces from 20.2 to 34.9. The prototype tool uses the same rule. Results:
`docs/reports/TETO_RT01_RT01A-B_Reference-Capacity_Result.md`.

Verdict before the decision: OWNER DECISION REQUIRED.

**Current verdict: RT-01 IMPLEMENTATION READY** (Owner Decision RT-01-OD-1 approved).
