# Multi-Sauce S3 — `grandma-pizza` (the first two-sauce recipe) — Result

Issue #521 (S3 of S1 / S2 / S3). Design: `TETO_MULTI-SAUCE-RECIPES_Design-Lock.md` (unchanged by this PR). Base: `origin/main` `608e65b` (S1 #524, S2 #525, Design Lock #528, #522 all merged).
Not merged, not deployed (no shared Preview touched, no Production).

## Source check — PENDING (Owner)
`pizzadb.jp` is **unreachable from this environment** (the agent proxy answers 403), so the live page was **not** re-read. What was checked is the repository's own record of the original
(`docs/reports/data/TETO_PIZZADB_172_MASTER-EVIDENCE.json` row `grandma-pizza-pizzadb`, Phase 0B original sample, page 3): ingredients `tomato-sauce, mozzarella, garlic, olive-oil`, all four
canonical (not family-derived), `doughStyle` null, pre/post-bake use of the oil **not recorded**. That list equals the requested composition, so no mismatch was found, but this is **not** a live-site confirmation.
Design Lock §8-1 (live check; "if it contradicts a pre-bake oil, grandma goes back on hold") therefore stays **open**. Counts (3 / 2) and the bake window are gameplay calibration, not source.

## What changed

| Area | Change |
|---|---|
| `data/recipes.ts` | `grandma-pizza` / グランマピザ: tomato-sauce 1, olive-oil 1, mozzarella 3, garlic 2; `bakeTarget` 56–76 (provisional); `ladderCredit:false`; `lunchRush:false`; no CUT; timing-neutral description. |
| `data/recipeSauceProfiles.ts` | `grandma-pizza` → `tomato-sauce` / `PAINT` (the PRIMARY sauce only). The secondary olive-oil has no profile entry: it is judged by presence (Design Lock §5.3). |
| `data/referencePizza.ts` | Reference: primary tomato target + mozzarella 3 / garlic 2 on the first five ring slots (= `getReferenceSlots(8)`). |
| `data/discoveryCatalog.ts` | target `grandma-pizza-pizzadb`, `sauceBase` = both sauces. Requires **no capability** and leaves `spreadLayers` null (see Deviations). |
| `data/orders.ts`, `data/recipeHintRoles.ts` | Order line; key-free Hint roles. |
| `data/hints.ts` | Guided hint copy: `empty` (tomato), `missing["olive-oil"]`, `ready`. |
| `preview/hvSeeds.ts` | From the garlic step the HV seeds count `grandma-pizza` as already found, so the one-target seeds stay one-target. |

No new ingredient, glyph, icon, CSS, technique, ladder step, FINISH, or save field. Save schema stays v2 (the Dex gains one additive recipe id). Production behaviour of the 57 existing recipes is unchanged
(parity pinned: hint text, golden for the Hint 5.0 ladders — **161 lines added, 0 changed**, Scoring/Completion, discovery matcher).

## Unlock and pool (visible effect — please confirm)
Makeable once tomato-sauce, mozzarella, olive-oil (step 13) and garlic (step 14) are owned, i.e. **from ladder step 14**, a branching pool beside `marinara` (precedent: calabresa + portuguesa at step 12).
Because it is non-credit it stays in every later pool until found (like calabresa / aussie) and never advances the ladder. Consequences, all consistent with Design Lock §6:
- At step 14, with both undiscovered, the Research entries read **「？？？ピザ A（にんにく）」 / 「？？？ピザ B（にんにく）」** — **marinara gains a letter** (before: bare). Screenshots below.
- A player who is past step 14 sees a **new Research entry** for grandma-pizza (no migration needed; additive).
- Chapter 2 grows 11 → 12 slots; grandma is the last slot (earlier No. unchanged, pinned).

## Engine behaviour verified (real reducer / gate / matcher)
| Case | Result |
|---|---|
| tomato → oil, oil → tomato | Completion Gate **PASS**; both sauces are on the pizza with their own per-kind deposits |
| oil = one tick | PASS (secondary = presence only, Owner policy) |
| tomato only | FAILED `MISSING_REQUIRED_INGREDIENT` (olive-oil) |
| oil only | FAILED (tomato) |
| faint tomato + full oil | FAILED `INSUFFICIENT_SAUCE` (tomato keeps its own quantity floor) |
| discovery | tomato + oil + pieces = `UNIQUE_MATCH` grandma; no production recipe collides; tomato-only is not grandma; a 3-sauce pizza is not grandma |
| Research rows | grandma target: both sauces POSITIVE; a one-sauce target still sees the oil as NEGATIVE |
| Hint 5.0 | ONE SAUCE rung naming **both** sauces (Design Lock §5.2, §8-3 — Owner acceptance pending) |

## Gates updated deliberately (Design Lock §5.4) — nothing skipped, quarantined or loosened
- **DH4 privacy gate** (`deductionProduction.gate`) and **Hint 5.0 production gate** (`hint5Production.gate`): the whole gates and every DH4 sweep were re-run **with grandma in `GATE_STATES`** — no new leak (the only
  failures were the two explicit "exactly one sauce" assertions). Those two now assert `NO_SAUCE ∪ MULTI_SAUCE_RECIPE_IDS` (an explicit allowlist in `logic/testSupport/requiredSauces.ts`), and that the
  allowlisted recipe has exactly 2 sauces and one SAUCE rung naming both.
- `researchResultRows`, `sauceKinds.research`, `hints.multiSauce`, `multiSauce.guards`, `wave2` sauce-count assertions: the one-sauce production assertion became "one sauce, NO_SAUCE → 0, allowlisted → 2".
  `sauceKinds.research` excludes the allowlisted recipe from the "extra sauce makes it no recipe" cases (its own composition IS a mixed pizza; covered by `recipes.grandmaPizza.test`).
- Count pins: recipes 58, chapter sizes `[6, 12, 16, 24]`, Lunch Rush opt-outs 33, key-free population 33 (sauce + cheese 14), key-free hint parity, multi-recipe steps `[12, 14, 28]`, non-credit set, 12 e2e dex-count pills.
- Test fixtures that built a "finished" pizza from the Reference sauce alone now use `requiredSauceIds(recipe)` (a two-sauce recipe is only itself with both). The three economy / research sims keep every sauce
  (`.slice(0, 1)` removed); the research-attempt sim player now adds one more unseen sauce **only after its final build failed** (a one-sauce target never reaches that step; no existing stage changed).
- Recipe Batch Validator: grandma adds no material and no ladder step, so it is not a batch recipe. The manifest pins it as `followedBy`; the batch's own identity checks still run on the catalog as it stood
  (grandma's identity effects are pinned in `recipes.grandmaPizza.test.ts` and the cohort-letter test instead).
- `DiscoveryProgressionInspector` (DEV only): the non-credit pool lists collapse a contiguous run to `12〜53` (a third non-credit recipe pushed step 1 out of the first screen and failed `discovery-inspector-scroll`).

## Deviations from the Design Lock (for review)
1. Target capabilities / `spreadLayers`: the Phase-2 row lists `MULTI_SPREAD_LAYER` and `spreadLayers: [olive-oil, tomato-sauce]`. No capability is runtime-supported (a target requiring one is unmatchable) and the runtime
   observes `spreadLayers` as null for every target, so the production target requires nothing; the two sauces are in `items` / `sauceBase`. `discoveryCatalog.test` names this exception.
2. Hint copy for grandma was added (Design Lock §5.1 proposed it); `ready` is the default text.

## Tests
- `npx tsc -b` clean; `oxlint`: 0 errors (the warnings are the same pre-existing ones as on main); `npm run build` OK.
- Vitest **8350 passed / 2 skipped / 0 failed** (437 files; 18 new in `recipes.grandmaPizza.test.ts`).
- E2E (Chromium, 390×844): full suite + `layout-chromium` = 374 passed / 95 skipped (project filters) before the last fixes; the 3 reds were fixed or confirmed flaky under 4-worker load
  (`discovery-hint-sheet:278`, `dough-size-status-474` pass alone; `layout-contract` LC-5 pinned 27 cards → derived from `ALL_RECIPES`). New `e2e/expansion-grandma.spec.ts` passes at 390×844 and 360×800:
  SAUCE tomato → olive oil (rendered-pixel check: tomato still visible, oil changes the colour) → CHEESE → TOPPING → BAKE → NEW DISCOVERY → Dex, plus oil-only does not discover.
- **WebKit 390×844 / 360×800: not run locally** (only Chromium is installed in this environment). The repository's `E2E WebKit` workflow runs every spec on both viewports for the PR — its result is the WebKit gate.

## Screenshots (committed)
`docs/reports/screenshots/multi-sauce-s3-grandma-pizza/` — `before-dex-research-step14-*` (main) vs `after-dex-research-step14-*` (A / B labels), and `after-grandma-{sauce-both,topping,new-recipe,dex}-*` at 390×844 and 360×800.

## Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| `grandma-pizza-s3-390x844.mp4` (H.264) | 390×844 | 25.0 s | 331 KB | PASS |

Download: delivered directly in the session (never committed; `artifacts/review/` is git-ignored).
Video Verification: PASS (file exists, size > 0, plays to the end, full 390×844 viewport, ffprobe: h264 390×844 25.0 s).

What to check in the video:
- SAUCE: tomato is painted first, then olive oil over it — the tomato stays visible under the oil (#519), the oil reads as a sheen.
- Both sauces are on the tray as separate chips; CHEESE (mozzarella ×3) and TOPPING (garlic ×2) follow the normal flow; BAKE → RESULT.
- RESULT: 「グランマピザ」NEW PIZZA, Dex No.12 (第2章 1/12).

## Open items for the Owner (not decided here)
1. **Live PIZZA DB check** of grandma (ingredients unchanged; nothing contradicts a pre-bake oil) — Design Lock §8-1. Unreachable from here.
2. Design Lock §8-3 (the SAUCE rung names both sauces) and §8-4 (ship a two-sauce recipe before a multi-spread Technique TQ-3, none registered) were taken as accepted by the instruction to implement per the Design Lock; please confirm.
3. The marinara **「A」 letter** at step 14 (above).
4. Follow-ups noticed, **not** implemented (outside the Design Lock): the player-facing Reference thumbnail / Pizza Select card (`playerReference`, `PizzaThumbnail`) show only the primary sauce (tomato), so the oil is
   visible only on the tray and in the hint text; the legacy Hint 2.0 step builder (`hintSteps`, rollback path only) names only the first sauce; the legacy near-miss classifier (no production caller since Near/Far
   Neutralization) would call a tomato-only grandma pizza "change the sauce".
5. Calibration: counts (3 / 2) and bake 56–76 are provisional.
