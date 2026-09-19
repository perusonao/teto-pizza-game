# TETO Recipe Master Catalog — Research Result (READ-ONLY RESEARCH / DATA / DOCS)

**Type:** Research / Data / Docs only. No production code (`src/**`) changed.
**Audited `main` SHA:** `5d28c5dc996c0ea76aa6428f158a766165477213` (fetched fresh via `git fetch origin`
before branching; the session's branch `claude/recipe-master-catalog-1j9jrb` contains this
SHA as its base with zero divergence at research start).
**Research date:** 2026-09-18 / 2026-09-19.
**Companion deliverables:** `docs/design/TETO_RECIPE-MASTER-CATALOG.md`,
`data/recipes/pizza_master_catalog.json`, `data/recipes/ingredient_master_catalog.json`.

## 1. Audited main SHA

`5d28c5dc996c0ea76aa6428f158a766165477213` (`origin/main` HEAD at session start, commit
`docs: Pizza DB 160 catalog recovery audit (read-only, verdict D) (#76)`). Confirmed via
`git fetch origin` + `git rev-parse HEAD origin/main` at the start of this session — both
matched exactly, so the research branch started from a byte-identical, fully fresh `main`.

## 2. Research date

2026-09-18 (start) through 2026-09-19 (completion). All source-access attempts described
below were made on 2026-09-18.

## 3. Source

**Intended primary source:** PIZZA DB, https://pizzadb.jp/, per this task's own Source
Policy and per `docs/design/PIZZA_GAME_SSOT.md` section 1 (which already names pizzadb.jp
as this project's UX/world-view reference).

**Actual outcome: source access was blocked at the network layer, not at the site's own
access-control layer.** Full evidence:

| Attempt | Method | Result |
|---|---|---|
| `curl https://pizzadb.jp/robots.txt` | direct HTTPS via the session's egress proxy | `curl: (56) CONNECT tunnel failed, response 403` — agent-proxy log: `connect_rejected`, `gateway answered 403 to CONNECT (policy denial or upstream failure)`, host `pizzadb.jp:443`, logged twice at `2026-09-18T16:12:16Z` |
| `curl -o /dev/null -w "%{http_code}" https://pizzadb.jp/` | same | same `CONNECT tunnel failed` / exit 56 |
| `WebFetch https://pizzadb.jp/` | harness web-fetch tool | `{"error_type":"EGRESS_BLOCKED","domain":"pizzadb.jp", ...}` |
| `WebFetch https://www.pizzadb.jp/` | harness web-fetch tool (www subdomain) | same `EGRESS_BLOCKED` |
| `WebFetch https://web.archive.org/web/2024/https://pizzadb.jp/` | Wayback Machine snapshot, as an alternative to the live site | tool-level refusal: "Claude Code is unable to fetch from web.archive.org" |
| `WebFetch https://ja.wikipedia.org/wiki/ピザ` | alternative secondary source (general pizza background, not PIZZA DB content) | `EGRESS_BLOCKED` |
| `WebFetch https://en.wikipedia.org/wiki/Pizza` | same, English | `EGRESS_BLOCKED` |
| `WebFetch https://example.com/` | control test — a domain with no possible site-specific restriction | `EGRESS_BLOCKED` |

The last row is the decisive control: `example.com` has no robots.txt disallow, no rate
limit, and no reason any site owner would block this session — yet it returned the exact
same `EGRESS_BLOCKED` error as pizzadb.jp. This proves the block is a **session-level
network egress policy** (an organization/environment-level allowlist that this session's
outbound HTTPS does not clear for arbitrary external domains), not a pizzadb.jp-specific
robots.txt/ToS/rate-limit decision. The task's own contingency plan ("大量自動取得が禁止/
不明な場合は無理にスクレイピングしない。手動/低頻度Research方式へ切り替え") assumes the
*site* imposes a restriction that a slower, manual approach could work around. That does not
apply here: no HTTP request of any kind, at any frequency, to any external domain, reached
the outside network from this session. There was no manual fallback available to switch to.

**Source-policy conclusion:** the source policy itself (structured facts only, no bulk
text/image copying, source URLs retained, respect robots/ToS/access limits) was never
actually tested against pizzadb.jp, because the site was never reached. This report cannot
claim compliance or non-compliance with pizzadb.jp's own terms — only that this session made
no request against them at all.

## 4. Current source recipe count

**0** — no recipe could be freshly confirmed against pizzadb.jp this session, for the reason
in section 3. Per the task's explicit instruction not to reconstruct the historical
"160 canonical pizzas" figure from memory, this is reported as 0, not backfilled with any
number from a prior session's memory or from this session's own general knowledge.

## 5. Canonical recipe count

**7** — the 7 recipes currently implemented in `src/data/recipes.ts`
(margherita, marinara, quattro-formaggi, genovese, bismarck, funghi, fugazza), catalogued in
`data/recipes/pizza_master_catalog.json` with `currentGameRecipe: true`. These are not
"pizzadb.jp-verified" entries — `researchStatus` on every one of them is explicitly
`existing_game_data_unverified_against_pizzadb`, and `sourceUrl` points at the repository's
own `src/data/recipes.ts` (`internal://` scheme) rather than an external page, because that
actually is where these 7 entries came from this session (read-only cataloguing of existing
production data, not new field research).

## 6. Alias / duplicate count

4 naming-ambiguity notes were recorded across the 7 catalogued recipes (as `aliases`/`notes`
fields, never auto-merged into a single entry, per the task's explicit instruction):

1. **marinara** — "marinara sauce" (Italian-American tomato-garlic-herb pasta sauce) vs. the
   Neapolitan pizza marinara, which traditionally uses plain tomato + garlic + oregano + oil
   rather than a distinct branded sauce product.
2. **genovese** — "alla Genovese" most commonly names a Neapolitan slow-cooked onion/meat
   ragù (a pasta sauce), unrelated to Ligurian basil pesto, despite sharing the
   Genoa/Genovese name. This game's Genovese pizza is pesto-based; flagged for re-check once
   pizzadb.jp is reachable.
3. **quattro-formaggi** — noted as distinct from "Quattro Stagioni" (four seasons, four
   topped quadrants), a different, unrelated dish that a future catalog expansion could
   easily confuse it with by name.
4. **fugazza** — noted as distinct from "Fugazzeta" (a related but different Argentine dish
   that adds cheese), to avoid conflating the two later.

0 duplicate recipe **IDs** and 0 duplicate `sourceUrl` values exist in the catalog (both
programmatically validated — section 15).

## 7. Unique ingredient count

**14** — every ingredient in `src/data/ingredients.ts` (13 Starter Set + `onion`), catalogued
in `data/recipes/ingredient_master_catalog.json`. This intentionally does not attempt to
reproduce the historical "181 unique ingredients" figure, for the same reason as section 4:
that number cannot be verified this session, and the task explicitly says not to target it
("過去の「181 ingredients」を再現することを目的にしない").

## 8. Current 7 mapping

7/7 mapped, `currentGameRecipe: true` on exactly the 7 ids present in `src/data/recipes.ts`,
cross-checked programmatically against the live TypeScript source (section 15):

| id | nameJa | mapped |
|---|---|---|
| margherita | マルゲリータ | ✅ |
| marinara | マリナーラ | ✅ |
| quattro-formaggi | クアトロ フォルマッジ | ✅ |
| genovese | ジェノベーゼ | ✅ |
| bismarck | ビスマルク | ✅ |
| funghi | フンギ | ✅ |
| fugazza | フガッサ | ✅ |

## 9. A/B/C/D/E counts (implementation classes)

All 7 catalogued recipes are current game recipes, so all 7 are trivially **Class A**
(buildable today with existing ingredients and existing operations — they are, in fact,
already built). **A=7, B=0, C=0, D=0, E=0.** This distribution is not yet meaningful as a
*discriminator* — it will only become useful once new, not-yet-implemented candidate recipes
are added to the catalog in a future session with working source access, so their classes can
be compared against these 7's baseline.

## 10. Tier counts

| difficultyTier | recipes |
|---|---|
| 1 | margherita, marinara (2) |
| 2 | genovese, bismarck, funghi, fugazza (4) |
| 3 | quattro-formaggi (1) |

| progressionTier | recipes |
|---|---|
| starter | margherita, marinara (2) |
| early | quattro-formaggi, genovese (2) |
| mid | bismarck, funghi (2) |
| late | fugazza (1) |
| master | (none yet) |

`fugazza`'s `late` tier is not an arbitrary design guess — it is cross-checked against its
actual in-game unlock gate (`src/data/ingredients.ts`'s `onion`: `minTotalStars: 12`,
`pricePitz: 120`), the only one of the 7 recipes with a real unlock gate today. The other
tier assignments are this session's own design judgement (ingredient-count/complexity-based),
clearly separated into the `gameDesign` sub-object per the schema (section 3.1 of the design
doc) so they are never confused with the factual fields above them.

## 11. Recipe 20 candidate 13

**Not produced as a data deliverable.** Phase 6 of the task asks for 13 expansion candidates
evaluated against real-world differentiation, but every candidate would need to be a
plausible, source-grounded real pizza — exactly the kind of claim this report cannot make
responsibly without reachable source verification (pizzadb.jp or any other external
reference). Proposing 13 "real pizza" candidates from this session's own unverified general
knowledge would risk exactly the failure mode the task explicitly prohibits: presenting
memory-derived content as if it were freshly researched. Rather than fabricate a candidate
list dressed up as research, this report leaves Recipe 20 candidate selection as explicit
**follow-up work gated on source access** — see section 16.

What *can* be said now, from the 7 already-catalogued recipes, is which axes a future
candidate pass should score against (unchanged from the task's own list): differentiation
from the current 7, new-ingredient count, new-operation need, visual distinctiveness,
learning-curve fit, Shop/Inventory compatibility, Pizza Dex collection value, and
implementation cost. `docs/design/TETO_RECIPE-MASTER-CATALOG.md` records this schema so the
next session can populate real candidates directly into it once pizzadb.jp (or another
verifiable source) is reachable.

## 12. New-mechanic findings

Cataloguing the current 7 against the task's seed mechanic-flag vocabulary surfaced:

- **`eggCenter` (bismarck) is an unmet mechanic, not a met one.** The real dish's
  whole-egg-in-the-center presentation (soft-set yolk, fixed placement) is not currently
  distinguished from ordinary scatter-topping placement in-game — egg is just another
  scatter topping today. This is a genuine implementation gap worth tracking for a future
  Making Game 2.0 slice, independent of any pizzadb.jp research.
- **`multipleCheeseZones` (quattro-formaggi)** is the current 7's highest cheese-variety
  complexity (4 distinct cheeses in one recipe) and is already handled by the existing
  scatter-placement model without any code gap.
- Two mechanic flags not in the task's seed list were added because the current 7 already
  exercise them in production: **`noCheese`** (marinara, fugazza) and **`noTomatoSauce`**
  (quattro-formaggi, genovese, fugazza — all three use an olive-oil or pesto sauce family
  instead). Recorded in the design doc's vocabulary (section 6) rather than silently reused
  under an existing flag name.
- No recipe in the current 7 needs `foldDough`, `stuffCrust`, `postBakeTopping`,
  `halfAndHalf`, `quarteredPlacement`, `noSauce` (literal no-sauce-at-all, as opposed to
  non-tomato sauce), `whiteSauce`, `veryHighToppingCount`, or `specialBake` — these remain
  open flags for future candidate recipes to actually exercise.

## 13. Limitations

1. **Zero external source access this session** (section 3) — the single largest limitation.
   Phases 1 (Source Inventory), most of Phase 2 (beyond the current 7), all of Phase 6
   (13 expansion candidates), and Phase 7 (Future Dex population count) could not be
   performed against pizzadb.jp at all.
2. **No fresh verification of the current 7's real-world accuracy.** These 7 recipes'
   plausibility rests entirely on prior sessions' design decisions
   (`PIZZA_GAME_SSOT.md` section 1's "no invented ingredient combinations" policy, and
   `PROJECT_HANDOFF.md`'s fugazza/onion note citing "a real-world pizza per PIZZA DB's
   canonical data") — not on anything independently re-checked this session.
3. **`styleCategory` is free-text, not a formal taxonomy**, because a real taxonomy needs
   broader source coverage than 7 recipes to design well. Left as an open item in the design
   doc rather than prematurely formalized.
4. **No large-scale catalog exists to validate the historical 160/181/190 figures against**,
   one way or the other. This report neither confirms nor denies those figures; it only
   confirms (per the prior Recovery Audit, `docs/reports/TETO_PIZZADB-160_CATALOG_Recovery-Audit.md`)
   that no underlying data for them survives anywhere in this repository's git history.

## 14. Source-policy concerns

1. **Unresolved tension with `PIZZA_GAME_SSOT.md` section 1.** The SSOT states plainly:
   "PIZZA DB のテキスト・画像・データそのものは一切使用しない" ("PIZZA DB's text, images,
   and data itself are never used at all") — PIZZA DB is defined there as inspiration for
   UX/world-view only, explicitly not a data source. This task's own Source Policy takes a
   narrower, more permissive reading (structured factual attributes only, with source
   tracking, are acceptable; bulk text/image copying is not). These two policies are not
   identical, and this report did not have to resolve the tension in practice (since
   pizzadb.jp was unreachable), but a future session that *can* reach pizzadb.jp will need
   an explicit decision from the project owner on which policy governs before extracting any
   structured data from it — this should not be decided unilaterally by an implementation
   session.
2. **robots.txt/ToS could not be checked.** Because `curl https://pizzadb.jp/robots.txt`
   itself failed at the network layer (section 3), this report cannot state whether
   automated fetching of pizzadb.jp is permitted, disallowed, or silent on the question.
3. **No scraping was attempted or performed**, automated or manual, at any frequency,
   against pizzadb.jp or any other external site. Nothing in this report or in the two JSON
   data files was extracted from pizzadb.jp.

## 15. Validation results

A temporary Node.js validation script (not committed to the repository; see section 16 for a
`tools/` proposal) was run against both JSON files and the live TypeScript source. All checks
passed:

```
[PASS] duplicate recipe IDs = 0
[PASS] duplicate sourceUrl = 0
[PASS] required fields missing = 0
[PASS] sourceUrl present for all recipes
[PASS] sourceUrl present for all ingredients (via candidateShopTier/family proxy)
[PASS] current 7 mapping = 7/7
[PASS] ingredient references resolve
[PASS] ingredient catalog count matches src/data/ingredients.ts (14)
[PASS] usedByRecipeCount matches actual recipe cross-references
[PASS] canonicalRecipeCount field matches recipes array length
[PASS] uniqueIngredientCount field matches ingredients array length

ALL CHECKS PASSED
```

Checks performed: duplicate recipe IDs, duplicate `sourceUrl` values, no missing required
schema fields, `sourceUrl` present on every entry, current-7 mapping is exactly 7/7 against
the live `RECIPES` array in `src/data/recipes.ts` (regex-matched, not hand-copied), every
recipe's `ingredients[]` resolves to a real entry in the ingredient catalog, the ingredient
catalog's id set matches `src/data/ingredients.ts`'s live `INGREDIENTS` array exactly (14/14,
neither more nor fewer), each ingredient's `usedByRecipeCount` matches an independent
recount from the recipe catalog's own `ingredients[]` arrays, and both catalogs' summary
count fields (`canonicalRecipeCount`, `uniqueIngredientCount`) match their actual array
lengths. No production code was touched by this validation — it only read
`data/recipes/*.json` and `src/data/{recipes,ingredients}.ts`.

**Proposal:** if this catalog is extended in future sessions, a small permanent script at
`tools/validate-recipe-catalog.js` (or `.mjs`) running the same checks — plus a CI step that
runs it on any PR touching `data/recipes/**` — would prevent a future edit from silently
breaking the current-7 mapping or introducing an unresolvable ingredient reference. This is a
proposal only; nothing was added under `tools/` in this PR, per the task's scope guard
against adding new production tooling as a side effect of a data/research slice.

## 16. Next implementation/research slice

The single most valuable next step is a **dedicated source-access resolution slice**, not
more recipe cataloguing from memory:

1. Confirm with the project owner whether pizzadb.jp (or any external domain) can be made
   reachable from a future session's network policy, or whether external research for this
   project must instead happen out-of-band (a human researcher manually visiting pizzadb.jp
   and handing structured notes to a session, rather than a session fetching it directly).
2. Once *any* path to external verification exists, resolve the `PIZZA_GAME_SSOT.md`
   section-1 vs. this task's Source Policy tension (section 14 above) explicitly, in writing,
   before extracting any new structured data from pizzadb.jp.
3. Only then attempt Phase 1 (source inventory: listing structure, pagination, canonical
   URLs, total count) for real, and only then populate Phase 6's 13 Recipe 20 candidates —
   each one grounded in an actual fetched/cited page, not general knowledge presented as
   research.
4. Independent of source access, `bismarck`'s `eggCenter` gap (section 12) is a legitimate,
   already-evidenced Making Game 2.0 candidate slice that needs no external research at all —
   it could be scoped and implemented on its own.

## Final Verdict

**D. SOURCE ACCESS BLOCKED**

The primary source (pizzadb.jp) and every alternative external source tested (Wikipedia in
two languages, the Wayback Machine, and a neutral control domain) were unreachable from this
session's network egress policy, not from any site-specific restriction. Per the task's own
explicit instructions, this report does not compensate for that block by reconstructing the
historical 160/181/190 figures from memory, and does not fabricate new "researched" recipes
to fill Phase 6. What could be done honestly — cataloguing the current 7 production recipes
and 14 ingredients with full traceability and validation, and documenting exactly what
blocked further research — has been done and committed.
