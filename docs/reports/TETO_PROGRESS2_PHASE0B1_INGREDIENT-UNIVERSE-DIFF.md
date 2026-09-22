# Progression 2.0 — Phase 0B.1: Fresh 172-Population Ingredient Universe Diff (Issue #182 / PR #183)

Status: **Phase 0B.1 — audit / design only, NOT complete. No `src/**` change. No production
Progression SSOT overwrite. No unlock threshold / Pitz price finalized. No merge to `main`.**
This is an **ingredient-universe diff only** — it does not attempt recipe canonicalization
(still blocked on pages 7–15 + long-tail recipe rows, per the Phase 0B report's gap list).
**PR #183 stays OPEN / unmerged.**

Trigger: PR #183 comment
[#5774770124](https://github.com/perusonao/teto-pizza-game/pull/183#issuecomment-5774770124)
("Phase 0B.1 — Fresh external verification update"), posted by the repository owner
(`perusonao`, `author_association: OWNER`).

Companion data: `docs/reports/data/TETO_PROGRESS2_PHASE0B1_ingredient-universe-diff.json`
Companion prior reports: `TETO_PROGRESS2_PHASE0_FULL-CATALOG_FRESH-AUDIT.md` (Phase 0A),
`TETO_PROGRESS2_PHASE0B_EXTERNAL-VERIFICATION_HANDOFF.md` (Phase 0B)

---

## 1. Source / Provenance Gate — this turn's re-check

This session's own `WebFetch` to `pizzadb.jp` was **not** re-attempted this turn beyond what
Phase 0B already established (`EGRESS_BLOCKED`, re-confirmed at the start of the Phase 0B
handoff) — the block is a stable, repeatedly-confirmed condition of this environment, not
something that plausibly changed in the few minutes since. The relayed comment's content is
treated with the same trust model as Phase 0B: the **author** (repository owner) is a trusted
instruction channel; the **PIZZA DB facts within the comment** are external, relayed,
**not independently re-verified by this Claude session**. No PIZZA DB descriptive text, image,
or page structure is reproduced anywhere in this document or its companion JSON — only
ingredient names (facts about real-world ingredient existence, exactly as the existing 53-entry
catalog already treats dish names) and this session's own independently-authored disposition
judgment.

### 1.1 172 (Japanese) vs. 160 (English) — kept separate

The relayed comment explicitly distinguishes:

- **172** — "日本語トップ: 172種類のピザを掲載中" / "世界のピザ比較: PIZZA DB登録データ 172種類"
  — the **Japanese canonical population**, matching the figure Issue #182's own body already
  used.
- **160** — "English版は160 translated pizza profiles" — a **translated subset** of the 172, not
  a separate or larger population.

**This session has not previously used, referenced, or conflated any "54/30/15"-style
sauce-family numbers from the English 160 subset** — Phase 0A/0B's own output never included a
sauce-family breakdown at all (this Phase 0B.1 is the first time one is recorded here). There is
nothing to retroactively correct in this session's own prior artifacts. The 172/160 distinction
is tracked explicitly from this point forward (`sourceMeta.populationSeparationNote` in the
companion JSON) and no figure in this document mixes the two populations.

## 2. Sauce-family breakdown (172-population, Fresh per the relayed comment)

| Family | Count | Proposed game mapping |
|---|---|---|
| tomato sauce | 60 | `tomato-sauce` (existing) |
| cheese | 34 | No dedicated sauce ingredient today — needs a product decision (see §5) |
| other | 17 | Unclassified without the underlying recipe rows |
| basil | 11 | Ambiguous: existing `pesto` (nameJa ジェノベーゼソース) vs. a distinct literal basil-oil sauce |
| no sauce | 10 | Sauceless (matches the existing `vongole-pizzadb`/`pizza-bianca` pattern) |
| sweet-savory (甘辛だれ) | 9 | `bbq-sauce` / `teriyaki-sauce` family (existing) |
| hot sauce | 8 | `buffalo-sauce` / `chili-oil` family (existing) |
| white sauce | 8 | `fromage-blanc-sauce` (Phase 0B-introduced) |
| curry | 7 | `curry-ketchup` (Phase 0B-introduced) |
| dessert sauce | 5 | `nutella-spread` / `honey` / `powdered-sugar` family (existing) |
| oil | 3 | Olive-oil-only base (existing) |
| **Total** | **172** | Matches the claimed population exactly — internal consistency check passed |

## 3. Ingredient occurrence diff vs. existing 62 canonical ingredients

**36 ingredients named** (occurrence ≥ 5, per the relayed comment). **This is not the full
172-population ingredient universe** — see §4 for the explicit gap.

| Disposition | Count | Meaning |
|---|---|---|
| `exact_alias` | 26 | Directly matches an existing canonical id (22 from the Phase 0A/production 62, 2 corroborating a Phase 0B-introduced id: `fresh-tomato`, `cream-cheese`) |
| `likely_alias` | 2 | High-confidence match, not byte-identical naming — `olive`→`black-olive` (color/variety unspecified by PIZZA DB), `coriander`→`cilantro` (same plant, different common name) |
| `genuinely_new` | 6 | No existing match anywhere in the 62 + Phase 0B's 15: `beef`, `lemon`, `green-pepper` (ピーマン, distinct from `bell-pepper`/パプリカ), `green-onion` (distinct from bulb `onion`), `shiso`, `pork` |
| `ambiguous` | 2 | Relationship to an existing/Phase-0B id unclear, not resolved here: `ground-meat` (ひき肉, vs. Phase 0B's taco-specific `ground-beef`), `chili` (チリ, vs. existing `chili-oil` sauce) |
| **Total named** | **36** | |

Full 36-row table with exact Japanese names and per-entry notes:
`docs/reports/data/TETO_PROGRESS2_PHASE0B1_ingredient-universe-diff.json` →
`ingredientOccurrenceDiff`.

### 3.1 Notable findings

- **`paprika`(パプリカ) is not ambiguous** — the existing catalog's `bell-pepper` entry's own
  `nameJa` is already パプリカ, confirmed by direct read of
  `data/recipes/ingredient_master_catalog.json`. Direct match, no product decision needed.
- **`green pepper`(ピーマン) is a genuinely separate ingredient from `bell-pepper`** in Japanese
  culinary convention (thin-walled/bitter vs. thick-walled/sweet — commercially and
  gameplay-visually distinct), not a color variant to fold into the same id.
- **`tomato`(トマト, count 16) and `cream cheese`(クリームチーズ, count 7) corroborate two
  ingredients Phase 0B had already independently introduced** (`fresh-tomato` for
  `taco-pizza-pizzadb`/`chilean-napolitana-pizzadb`, `cream-cheese` for
  `apple-cinnamon-dessert-pizzadb`) — cross-check passed, no id conflict.
- **`beef`(牛肉, count 9) sits in an unresolved 3-way relationship** with the existing `steak`
  (whole-cut) and Phase 0B's `ground-beef` (taco-specific) — not merged with either; flagged for
  a future product decision on whether the game needs a generic `beef` id, or whether `steak`/
  `ground-beef` already cover its real uses.
- **`prosciutto`(count 6) was already anticipated** — the existing catalog's
  `prosciutto-crudo` entry already lists `prosciutto` in its `aliases` array (confirmed by direct
  file read), so this is a clean, pre-existing exact alias, not a new finding.

## 4. Explicit gap: the long tail (occurrence 4, 3, 2, 1) is unnamed

The relaying comment states the Japanese top page lists further ingredients at occurrence counts
4, 3, 2, and 1, but **did not include their names**. This Phase 0B.1's 36-entry diff is therefore
**a coverage of the ≥5-occurrence ingredients only** — an unknown number of additional,
completely unnamed ingredients exist in the real 172-population universe below that threshold.
**Not guess-filled.** This gap is recorded in the companion JSON's `longTailGap` field and
carried into §6's final report as an open item, exactly like Phase 0B's own recipe-row gap
(pages 7–15).

## 5. Design implications (per the relayed comment's own correction items)

1. **172 vs. 160 kept separate** — done, §1.1.
2. **recipeReach expectation check** — not yet possible without the underlying 172 recipe rows
   (only 25 individual recipes are known so far, from Phase 0B); this diff supplies the
   ingredient-side half of that future check, not the recipe-side half.
3. **The existing 62 canonical ingredients are confirmed to NOT be the full 172-population
   ingredient universe** — at minimum 6 genuinely-new + 2 ambiguous ingredients exist among just
   the ≥5-occurrence names, before even considering the unnamed long tail (§4).
4. **Recipe identity as a composite (ingredient set + sauce/dough/shape/mechanic/finishing/bake
   profile)** — unchanged from the Phase 0B design draft §10 conclusion: every concrete collision
   found so far is disambiguated by mechanic/shape alone; sauce/dough/bake-profile/finishing-order
   remain a watch-list, not yet evidenced as necessary. This Phase 0B.1 finds no new collision
   requiring them either (no recipe-row-level analysis was possible this Phase — see §6).
5. **No full-172 deadlock=0 declared** — none is declared here. This Phase 0B.1 only extends the
   *ingredient* universe diff; the Phase 0B combined-pool deadlock result (0 states) remains
   explicitly scoped to the 64-of-172 (37.2%) recipe pool, unchanged by this Phase 0B.1.

## 6. Final Report (Phase 0B.1)

- **Population separation**: 172 (Japanese, canonical) vs. 160 (English, translated subset) —
  kept distinct; nothing in this session's prior output needed correction (§1.1).
- **Sauce family breakdown**: 11 categories, sums to exactly 172 (internal consistency check
  passed) (§2).
- **Ingredients named this Phase**: 36 (occurrence ≥ 5) — 26 exact-alias, 2 likely-alias, 6
  genuinely-new, 2 ambiguous (§3).
- **Genuinely-new ingredient ids identified**: `beef`, `lemon`, `green-pepper`, `green-onion`,
  `shiso`, `pork` — not yet added to any catalog file, recorded only in the Phase 0B.1 staging
  JSON pending a future integration decision.
- **Ambiguous items requiring a future product decision**: `ground-meat` (vs. `ground-beef`),
  `chili` (vs. `chili-oil`), plus the `beef`/`steak`/`ground-beef` 3-way relationship.
- **Long-tail gap**: occurrence 4/3/2/1 ingredients exist per the relayed comment but are
  entirely unnamed — not guess-filled, recorded as an open item (§4).
- **Recipe-row status**: unchanged from Phase 0B — only 25 of 172 recipe rows known; this
  Phase 0B.1 did not add any new recipe rows, only ingredient-universe data.
- **Deadlock status**: unchanged from Phase 0B — 0 deadlocks in the 64-of-172 (37.2%) partial
  recipe pool only; still explicitly not a full-172 claim.
- **Scope guard**: `src/**` untouched, `PIZZA_GAME_PROGRESSION_SSOT.md` untouched, no unlock
  threshold/Pitz price finalized, no PIZZA DB text/image/structure copied.
- **PR #183 status**: **OPEN, unmerged.** Given the recipe-row gap (§4, and Phase 0B §7)
  persists unchanged, this Phase 0B.1 is not represented as closing Issue #182's Full-Catalog
  acceptance criteria — only as narrowing the ingredient-side uncertainty.
