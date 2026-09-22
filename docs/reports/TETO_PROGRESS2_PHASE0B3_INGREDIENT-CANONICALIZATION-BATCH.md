# Progression 2.0 — Phase 0B.3: Long-Tail Ingredient Canonicalization Batch (Issue #182 / PR #183)

Status: **Phase 0B.3 — audit / design only, NOT complete. No `src/**` change. No production
Progression SSOT overwrite. No unlock threshold / Pitz price finalized. No merge to `main`.**
Ingredient-universe work only — **recipe rows remain 25/172, unchanged, so a full-population
deadlock simulation stays correctly blocked** (§5). **PR #183 stays OPEN / unmerged.**

Trigger: PR #183 comment
[#5774945778](https://github.com/perusonao/teto-pizza-game/pull/183#issuecomment-5774945778)
("Phase 0B.3 — Fresh Japanese long-tail ingredient evidence supplied"), posted by the repository
owner (`perusonao`, `author_association: OWNER`).

Companion data: `docs/reports/data/TETO_PROGRESS2_PHASE0B3_longtail-raw-input.json` (raw relayed
names, unmodified transcription), `docs/reports/data/TETO_PROGRESS2_PHASE0B3_canonicalization-results.json`
(classification output), `docs/reports/data/TETO_PROGRESS2_PHASE0B2_evidence-status.json`
(updated ledger)
Companion tooling: `tools/progression2_ingredient_canonicalizer.py` (extended tables),
`tools/progression2_evidence_invariants.py` (re-verified, still passing)

---

## 0. Source / Provenance Gate — this turn's re-check

`WebFetch https://pizzadb.jp/` re-attempted at the start of this Phase: **`EGRESS_BLOCKED`**,
unchanged. The 145 relayed names are treated exactly like every prior Phase's relayed content:
owner-relayed, **not independently re-verified by this Claude session**.

### 0.1 Transcription integrity check

Before running classification, this Phase re-read every one of the 145 relayed names against
the raw comment text and found **7 transcription errors from this session's own first pass**
(not errors in the relayed comment itself) — 6 single-character CJK codepoint typos (e.g. `鵏肉`
instead of `鶏肉`/chicken, `味噬だれ` instead of `味噌だれ`/miso-sauce) and 1 missing small-tsu in
a katakana word (`ピーナツソース` instead of `ピーナッツソース`/peanut sauce), all caught by
diffing suspicious codepoints against `unicodedata` lookups and corrected before classification.
**145/145 names verified unique, non-duplicated, and now byte-accurate** against the source
comment.

## 1. Ingestion into the evidence ledger

`docs/reports/data/TETO_PROGRESS2_PHASE0B2_evidence-status.json` updated:

| Occurrence tier | Before (Phase 0B.2) | After (Phase 0B.3) |
|---|---|---|
| ≥5 (named individually) | evidenced, 36 | evidenced, 36 (unchanged) |
| 4 | pending, 0 | **evidenced, 8** |
| 3 | pending, 0 | **evidenced, 10** |
| 2 | pending, 0 | **evidenced, 19** |
| 1 | pending, 0 | **evidenced, 108** |
| **Total named** | **36** | **181** |

**Notable corroboration**: 36 + 145 = **181**, which matches **exactly** the historical "160
canonical pizzas / 181 unique ingredients" figure already on record in
`docs/design/TETO_RECIPE-MASTER-CATALOG.md` §1 (from earlier, separate sessions' PIZZA DB
research, predating this Issue). This is a strong internal-consistency signal that the
ingredient-name universe is now fully enumerated down to occurrence=1 — recorded honestly as
`"likely, not certain"` in the ledger (`fullIngredientUniverseKnown`), since it remains an
owner-relayed claim this session has not independently re-fetched.

**Recipe-row evidence is explicitly unchanged**: still 25/172, still `status: "incomplete"`.
Ingredient-name completeness is a different metric from recipe-row completeness (invariant 2
continues to enforce this separation — see §5).

## 2. Deterministic canonicalization results

Running `tools/progression2_ingredient_canonicalizer.py --input
TETO_PROGRESS2_PHASE0B3_longtail-raw-input.json` against the rule tables (extended this Phase
with justified entries — see §2.1) classified **all 145 names, 0 left as `needs_review`**:

| Disposition | Count | Notes |
|---|---|---|
| `exact_alias` | 26 | 14 matched the base 62 directly out of the box; 12 more after registering the Japanese names of 10 already-introduced Phase 0B ids (`アサリ`→`clam`, `タラ`→`salt-cod`, `レタス`→`lettuce`, `パプリカパウダー`→`paprika-powder`, `トルティーヤチップス`→`tortilla-chips`, `サラミ`→`salami`, `フロマージュブラン`→`fromage-blanc-sauce`, `りんご`→`apple`, `シナモン`→`cinnamon`, `ブルーチーズドレッシング`→`blue-cheese-dressing`) plus 2 orthographic variants (`海苔`→のり/nori, `イチゴ`→いちご/strawberry) |
| `likely_alias` | 12 | All チーズ/ソース suffix-variants or word-order variants of an existing id, each with a one-line justification in the script (e.g. `ゴルゴンゾーラチーズ`→`gorgonzola`, `サラミピカンテ`→`spicy-salami`) |
| `ambiguous` | 11 | Never auto-resolved — see §3 |
| `genuinely_new` | 95 | New distinct ids proposed, e.g. `salmon`, `feta`, `burrata`, `cucumber`, `lamb`, `swiss-cheese`, `okonomiyaki-sauce` — full list in the results JSON |
| `excluded_non_ingredient` | 1 | `お好みの具材` ("toppings of your choice") — a generic placeholder phrase, not a real ingredient; permanently excluded, never counted toward the universe |
| **Total** | **145** | |

Self-test (`python3 tools/progression2_ingredient_canonicalizer.py`, no `--input`) still passes
after these table extensions — Phase 0B.1's 36 names reclassify identically, confirming the new
entries didn't disturb prior determinism.

### 2.1 Table extension discipline

Every `likely_alias`/`ambiguous` addition carries a one-line justification in the script, per
the rules doc's own requirement (`docs/design/TETO_PROGRESS2_INGREDIENT-CANONICALIZATION-RULES.md`
§"Rule order"). No fuzzy matching was used. `genuinely_new` ids were assigned only where no
existing/Phase-0B/Phase-0B.1 id plausibly matched; every id was checked for collision against the
full existing set (0 collisions found).

## 3. Ambiguous entries (11) — never auto-resolved

| Japanese name | Related existing id(s) | Why not merged |
|---|---|---|
| `チーズ` | mozzarella | Generic "cheese," no variety specified |
| `肉` | beef, pork, chicken, ground-beef | Generic "meat," no variety specified |
| `ナッツ` | walnut | Generic "nuts," no variety specified |
| `チーズソース` | mozzarella | Taxonomy: this is a SAUCE, not a cheese topping |
| `ホワイトソース` | fromage-blanc-sauce | Generic "white sauce" may not be the same as the specific fromage blanc |
| `スパイシーソーセージ` | sausage | Spicier variant, not confirmed identical |
| `カレーソース` | curry-ketchup | More generic than the specific curry-ketchup |
| `青唐辛子` | chili-oil | Green chili variant of the existing chili/chili-oil ambiguity group |
| `赤唐辛子` | chili-oil | Red chili variant, same group |
| `青のり` | nori | Aonori is related but visually/culinarily distinct from plain nori |
| `プロヴェルチーズ` | provolone | "Provel" is a real, distinct cheese commonly confused with provolone by name |

Resolving any of these (merge into the listed existing id, or mint as a new distinct id) is a
**product decision**, not made by this Phase — recorded as a new open item in the evidence
ledger.

## 4. Taxonomy flags — generic / non-gameplay / sauce-vs-ingredient issues

29 of the 145 names carry a taxonomy flag (independent of their disposition — a flagged item
might still be `genuinely_new` or `ambiguous`, the flag is an orthogonal warning that it doesn't
fit the game's ordinary scatter/spread topping model as-is):

| Flag | Count | Examples |
|---|---|---|
| `sauce_not_topping` | 16 | チーズソース, ホワイトソース, カレーケチャップソース(also likely_alias), サルサソース(also likely_alias), カレーソース(also ambiguous), お好み焼きソース, グレイビーソース, ケバブソース, ヨーグルトソース, 生クリームソース, 焼肉のタレ, 醤油ソース, 甜麺醤, 豆板醤, 味噌だれ, ピーナッツソース |
| `sauce_or_condiment` | 6 | タヒニ, チャツネ, バルサミコ酢, マスタード, 柚子胡椒, 溶かしバター |
| `generic_unspecified` | 3 | チーズ, 肉, ナッツ (all also `ambiguous`) |
| `prepared_dish_composite` | 3 | チキンティッカ, ホットドッグ, 北京ダック — these are prepared/composite dishes, not raw scatter ingredients |
| `false_friend_not_meat` | 1 | 梅肉 (umeboshi plum **flesh**, not meat — flagged specifically so a future pass doesn't group it with beef/pork/chicken/ground-beef by the shared 肉 kanji) |

**Design implication**: 22 of the 145 relayed names (16 + 6) are structurally sauces/condiments,
not scatter toppings — PIZZA DB's "main ingredients" column mixes both categories freely. A
future integration pass must route each of these through the game's `sauce`/`spread` model, not
the `scatter`-topping model, before adding it as an ordinary ingredient row.

## 5. Recipe-row completeness — still blocked (unchanged, per instruction)

Per the trigger comment's explicit item 6 ("keep full recipe/deadlock completeness blocked"):
`tools/progression2_evidence_invariants.py` re-run after this ingestion, **all 4 invariants
still pass**, including the one that matters most here:

```
[PASS] full_deadlock_blocked_unless_172_covered: full-population deadlock simulation correctly
BLOCKED: only 25/172 recipe rows have evidence -- any deadlock result must stay scoped to a
partial pool
```

This Phase added zero recipe rows (ingredient-frequency evidence is explicitly not recipe-row
evidence — invariant 2 enforces this separation, and passed: "ingredient occurrence (181 named)
and recipe rows (25 evidenced) are tracked as distinct, non-equal metrics"). No deadlock claim,
full or partial, is made or changed by this Phase.

## 6. Candidate canonical ingredient-universe size — range, not a point estimate

| | Count |
|---|---|
| Baseline before Phase 0B.3 (62 shipped + 15 Phase 0B new + 6 Phase 0B.1 genuinely_new) | 83 |
| + Phase 0B.3 definite additions (`genuinely_new`) | +95 |
| **Minimum candidate universe** (if all 11 `ambiguous` entries ultimately merge into an existing related id) | **178** |
| **Maximum candidate universe** (if all 11 `ambiguous` entries ultimately resolve to a distinct new id) | **189** |

The range reflects the 11 unresolved `ambiguous` entries (§3) honestly rather than picking a
point estimate — resolving each one narrows the range, never invents a number in between.

## 7. Scope guard (confirmed, same as prior Phases)

- `src/**`: not modified.
- `docs/design/PIZZA_GAME_PROGRESSION_SSOT.md`: not modified.
- No unlock threshold / Pitz price finalized.
- No PIZZA DB text/image/site-structure copied — only ingredient names and this session's own
  independently-authored classification/justification text.
- No merge to `main`.
- `python3 tools/validate_recipe_catalog.py` — still all-pass.
- `python3 tools/progression2_phase0_analysis.py` / `progression2_phase0b_analysis.py` — both
  still run clean (this Phase added no new recipe rows to either pool).

## 8. Final Report (Phase 0B.3)

- **145 names ingested**, 0 left `needs_review` after table extension.
- **Dispositions**: 26 `exact_alias`, 12 `likely_alias`, 11 `ambiguous`, 95 `genuinely_new`, 1
  `excluded_non_ingredient`.
- **Candidate canonical ingredient-universe size**: **178–189** (range, pending 11 ambiguous
  resolutions).
- **Taxonomy issues flagged**: 29 entries (16 sauce-not-topping, 6 sauce-or-condiment, 3
  generic-unspecified, 3 prepared-dish-composite, 1 false-friend-not-meat).
- **Corroboration**: 181 total named ingredients exactly matches the historical "181 unique
  ingredients" figure on record elsewhere in this repo — a strong, honestly-caveated signal that
  the ingredient-name universe (not the recipe-row universe) is now fully enumerated.
- **Recipe-row completeness**: unchanged, 25/172. Full-population deadlock simulation remains
  correctly **blocked** by `tools/progression2_evidence_invariants.py` (4/4 invariants passing).
- **Transcription fix**: 7 codepoint/spelling errors in this session's own first-pass
  transcription found and corrected before classification (§0.1) — not errors in the relayed
  comment.
- **New open item**: product decision needed on the 11 `ambiguous` entries (§3) — added to the
  evidence ledger's `openRequestsForExternalEvidence`.
- **PR #183 status**: **OPEN, unmerged.**
