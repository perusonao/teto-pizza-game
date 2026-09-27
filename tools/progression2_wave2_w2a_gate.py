#!/usr/bin/env python3
"""Wave 2 Owner Decision Gate -- W2-A (Lean data-only) machine checks.

Docs/data/tools only. Reads the production runtime (src/data/*.ts, src/logic/materialShop.ts,
src/logic/prepareDock.ts constants), the Phase-1 172 matrix and the Wave 2 candidate JSON, and
writes:

  docs/design/data/TETO_WAVE2_W2A_OWNER-GATE.json

What it verifies (OD-W2-1 append-only, adopted as the Owner's candidate policy):

  L-1  the W1 ladder parsed from src/data/discoveryLadder.ts equals the REC-04 key-recipe rule on
       the runtime 25 (so "fixed W1 steps" means exactly the shipped ladder);
  L-2  in the W1+W2-A ladder, steps 1..24 are byte-identical to W1;
  L-3  every W2-A material sits at step >= 25 and no W1 material moves;
  L-4  for every existing-save discovered count 0..25, the reached steps and the next step are
       unchanged where W1 defined them (0..23), and only >= 25 is new;
  L-5  no ingredient appears in two steps and no W2 step re-unlocks a W1 / starter material;
  L-6  deadlock 0 for ANY discovery order: for each count c the recipes makeable from starters +
       materials of steps <= c are at least c + 1 (until all are discovered);
  L-7  unreachable recipe 0: all 34 recipes are makeable once every step is reached;
  D-1  discovery matcher: exact identity collision 0 over all C(34, 2) pairs (ingredient set +
       sauce base, default dimensions); d = 1 / d = 2 near-miss pairs are reported (the
       nearMiss.ts distance: missing + extra non-sauce + sauce base differs).

Usage:  python3 tools/progression2_wave2_w2a_gate.py [--check]
"""
from __future__ import annotations

import hashlib
import itertools
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import progression2_wave2_candidates as w2  # noqa: E402  (reuse parsers / ladder mirror)

ROOT = w2.ROOT
OUT = ROOT / "docs/design/data/TETO_WAVE2_W2A_OWNER-GATE.json"
CANDIDATES = ROOT / "docs/design/data/TETO_WAVE2_RUNTIME-RECIPE_CANDIDATES.json"
SRC_LADDER = ROOT / "src/data/discoveryLadder.ts"
SRC_SHOP = ROOT / "src/logic/materialShop.ts"
SRC_DOCK = ROOT / "src/logic/prepareDock.ts"
HASHED_INPUTS = [
    "src/data/recipes.ts", "src/data/ingredients.ts", "src/data/discoveryCatalog.ts",
    "src/data/discoveryLadder.ts", "src/data/recipeSauceProfiles.ts", "src/data/cookingProfiles.ts",
    "src/data/ingredientTaxonomy.ts", "src/data/referencePizza.ts", "src/logic/materialShop.ts",
    "src/logic/discovery/matcher.ts", "src/logic/discovery/nearMiss.ts", "src/logic/discoveryLadder.ts",
    "src/state/recipeChapters.ts", "src/state/materialEntitlement.ts", "src/logic/prepareDock.ts",
    "src/mission/dinner/dinnerMission.ts",
]

W2A_ID = "W2-A_LEAN_DATA_ONLY"

# Display names (ja) for the 8 new materials: the ingredient master catalog's nameJa where it
# exists, else the 172 taxonomy audit's (PR #255) nameJa. Proposals, not production copy.
NEW_INGREDIENT_META = {
    "arugula": {"nameJa": "ルッコラ", "nameSource": "ingredient_master_catalog.json", "subfamily": "vegetable.leafy"},
    "bell-pepper": {"nameJa": "パプリカ", "nameSource": "ingredient_master_catalog.json", "subfamily": "vegetable.fruiting"},
    "chicken": {"nameJa": "チキン", "nameSource": "ingredient_master_catalog.json", "subfamily": "meat.poultry"},
    "fromage-blanc-sauce": {"nameJa": "フロマージュブラン", "nameSource": "PR #255 taxonomy audit (not in catalog v2)", "subfamily": "sauce.cream-dairy"},
    "parsley": {"nameJa": "パセリ", "nameSource": "ingredient_master_catalog.json", "subfamily": "herb.leaf"},
    "prosciutto-crudo": {"nameJa": "生ハム", "nameSource": "ingredient_master_catalog.json", "subfamily": "meat.cured"},
    "shrimp": {"nameJa": "エビ", "nameSource": "ingredient_master_catalog.json", "subfamily": "seafood.shellfish"},
    "zucchini": {"nameJa": "ズッキーニ", "nameSource": "ingredient_master_catalog.json", "subfamily": "vegetable.fruiting"},
}

# Per-recipe unresolved items found by reading the evidence rows (not generated).
UNRESOLVED = {
    "brazilian-calabresa-pizzadb-p10": [
        "オリーブ -> black-olive is a likely_alias (colour not stated in PIZZA DB)",
        "NAMING_CLUSTER NC-4-calabresa (アルゼンチン風カラブレーサ is a blocked sibling)",
        "no cheese in evidence -> no CHEESE step (same as marinara / puttanesca)",
    ],
    "vongole-pizzadb": [
        "sauce family label is ノンソース but olive-oil is a listed spread layer; represented as the olive-oil PAINT_TEMPORARY base like fugazza / new-haven (Phase-1 FULL); a drizzle reading would move it to W2-D",
        "dough evidence absent -> no CUT under the New Haven precedent (OD-W2-4)",
        "no cheese -> no CHEESE step",
    ],
    "flammkuchen-pizzadb": [
        "first non-tomato/pesto/oil PAINT sauce: RecipeSauceProfile.ingredientId union must widen; white-on-dough visibility needs a Human Visual check (olive-oil needed a --oil class, PR #45)",
        "dough evidence absent -> no CUT (real-world flammkuchen is often rectangular; evidence is silent on shape, so round is kept)",
        "no cheese -> no CHEESE step",
    ],
    "pesto-gamberi-pizzadb-p11": ["no cheese in evidence -> no CHEESE step"],
    "pesto-pollo-pizzadb-p12": [],
    "ratatouille-pizza-pizzadb-p13": ["no cheese in evidence -> no CHEESE step"],
    "pesto-vegetariana-pizzadb-p12": [],
    "prosciutto-funghi-pizzadb-p11": [
        "SAME_INGREDIENT_SET_AS_CATALOG_RECIPE prosciutto-e-funghi (catalog-only, not runtime): naming decision",
        "prosciutto-crudo is post-bake in catalog finishing tags; this row has no REQUIRED late-addition evidence, so it is placed pre-bake (OD-TAX-6: timing is not identity)",
        "one ingredient from runtime funghi (near-miss ADD_ONE / REMOVE_ONE neighbour)",
    ],
    "jamon-serrano-pizza-pizzadb-p7": [
        "reserves the P0-COLL-4 pair: pinsa-romana can later ship only with DOUGH_VARIANT",
        "arugula / prosciutto-crudo are post-bake in catalog finishing tags; no REQUIRED evidence here -> pre-bake",
    ],
}


def read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


def parse_w1_ladder():
    src = read(SRC_LADDER)
    block = src[src.index("export const W1_25_DISCOVERY_LADDER"):]
    block = block[: block.index("\n};")]
    steps = []
    for m in re.finditer(r'step: (\d+), kind: "MATERIAL", ingredientIds: \[([^\]]*)\], keyRecipeId: "([a-z0-9-]+)"', block):
        steps.append({"step": int(m.group(1)), "ingredientIds": re.findall(r'"([a-z0-9-]+)"', m.group(2)),
                      "keyRecipeId": m.group(3)})
    # multi-line entries
    for m in re.finditer(r'\{\s*step: (\d+),\s*kind: "MATERIAL",\s*ingredientIds: \[([^\]]*)\],\s*keyRecipeId: "([a-z0-9-]+)",?\s*\}', block, re.S):
        n = int(m.group(1))
        if not any(s["step"] == n for s in steps):
            steps.append({"step": n, "ingredientIds": re.findall(r'"([a-z0-9-]+)"', m.group(2)), "keyRecipeId": m.group(3)})
    return sorted(steps, key=lambda s: s["step"])


def parse_tiers():
    return [{"tier": t, "firstStep": int(a), "lastStep": None if b == "null" else int(b), "packPrice": int(p), "refillPrice": int(r)}
            for t, a, b, p, r in re.findall(r'tier: "(T\d)", firstStep: (\d+), lastStep: (\d+|null), packPrice: (\d+), refillPrice: (\d+)', read(SRC_SHOP))]


def tier_for(step, tiers):
    for t in tiers:
        if step >= t["firstStep"] and (t["lastStep"] is None or step <= t["lastStep"]):
            return t
    return None


def main(check: bool) -> int:
    errors = []
    recipes, ingredients, disc, cut, tax, _ = w2.parse_runtime()
    cand = json.loads(read(CANDIDATES))
    matrix = {r["evidenceId"]: r for r in json.loads(read(w2.MATRIX))["rows"]}
    catalog = {x["id"]: x for x in json.loads(read(w2.ING_CATALOG))["ingredients"]}
    rows = {r["evidenceId"]: r for r in cand["rows"]}
    option = next(o for o in cand["waveOptions"] if o["id"] == W2A_ID)
    w2a = [rows[e] for e in option["recipeEvidenceIds"]]
    tiers = parse_tiers()
    palette = int(re.search(r"MAX_INGREDIENT_PALETTE_SLOTS = (\d+)", read(w2.SRC_INGREDIENTS)).group(1))
    columns = int(re.search(r"TRAY_COLUMNS = (\d+)", read(SRC_DOCK)).group(1))

    base_pop = {r: sorted(v["items"]) for r, v in recipes.items()}
    w1 = parse_w1_ladder()
    derived = w2.key_recipe_ladder(base_pop)
    l1 = [(s["ingredientIds"], s["keyRecipeId"]) for s in w1] == [(s["ingredientIds"], s["keyRecipeId"]) for s in derived]
    if len(w1) != 24 or not l1:
        errors.append("L-1: parsed W1 ladder is not the REC-04 derivation of the runtime 25")

    pop = dict(base_pop)
    rid = {}
    for r in w2a:
        rid[r["evidenceId"]] = r["canonicalCandidateId"]
        pop[r["canonicalCandidateId"]] = r["ingredients"]
    appended = w2.append_only_ladder(base_pop, pop)
    ladder = [dict(s) for s in w1] + [{"step": 25 + i, "ingredientIds": s["ingredientIds"], "keyRecipeId": s["keyRecipeId"]}
                                     for i, s in enumerate(appended)]

    # L-2 / L-3
    l2 = ladder[:24] == w1
    w1_mats = {i for s in w1 for i in s["ingredientIds"]}
    w2_mats = {i for s in ladder[24:] for i in s["ingredientIds"]}
    new_ings = sorted({i for r in w2a for i in r["newIngredients"]})
    l3 = w2_mats == set(new_ings) and not (w2_mats & w1_mats) and all(s["step"] >= 25 for s in ladder[24:])
    # L-5
    seen, l5_problems = {}, []
    for s in ladder:
        for i in s["ingredientIds"]:
            if i in seen:
                l5_problems.append(f"{i} in steps {seen[i]} and {s['step']}")
            seen[i] = s["step"]
            if i in w2.STARTERS:
                l5_problems.append(f"starter {i} in step {s['step']}")
    # L-4
    def reached(lad, c):
        return [s["step"] for s in lad if s["step"] <= c]

    def nxt(lad, c):
        return next((s["step"] for s in lad if s["step"] > c), None)

    l4_rows = []
    l4_ok = True
    for c in range(0, 26):
        before_r, after_r = reached(w1, c), reached(ladder, c)
        before_n, after_n = nxt(w1, c), nxt(ladder, c)
        same_reached = after_r[: len(before_r)] == before_r and all(s >= 25 for s in after_r[len(before_r):])
        same_next = before_n == after_n if before_n is not None else (after_n is None or after_n >= 25)
        if not (same_reached and same_next):
            l4_ok = False
        l4_rows.append({"discoveredCount": c, "w1NextStep": before_n, "w2aNextStep": after_n,
                        "w2aNextMaterials": next((s["ingredientIds"] for s in ladder if s["step"] == after_n), None),
                        "newlyReachedAtThisCount": [s for s in after_r if s not in before_r], "unchanged": same_reached and same_next})

    # L-6 / L-7
    def makeable(c):
        owned = set(w2.STARTERS) | {i for s in ladder if s["step"] <= c for i in s["ingredientIds"]}
        return sorted(r for r, items in pop.items() if set(items) <= owned)

    deadlocks, curve = [], []
    for c in range(0, len(pop)):
        m = makeable(c)
        curve.append({"discoveredCount": c, "makeable": len(m), "slack": len(m) - (c + 1)})
        if len(m) < c + 1:
            deadlocks.append(c)
    unreachable = sorted(set(pop) - set(makeable(len(ladder))))

    # D-1 collisions
    sauce_ids = {i for i, c in ingredients.items() if c == "sauce"} | {"fromage-blanc-sauce"}

    def split(items):
        return {i for i in items if i not in sauce_ids}, sorted(i for i in items if i in sauce_ids)

    pairs = {"d0": [], "d1": [], "d2": []}
    for a, b in itertools.combinations(sorted(pop), 2):
        (na, sa), (nb, sb) = split(pop[a]), split(pop[b])
        d = len(na - nb) + len(nb - na) + (0 if sa == sb else 1)
        if d <= 2:
            pairs[f"d{d}"].append({"a": a, "b": b, "aIsWave2": a not in base_pop, "bIsWave2": b not in base_pop,
                                   "diff": sorted((na ^ nb)) + ([f"base:{'/'.join(sa)}->{'/'.join(sb)}"] if sa != sb else [])})
    base_d1 = sum(1 for p in pairs["d1"] if not p["aIsWave2"] and not p["bIsWave2"])
    base_d2 = sum(1 for p in pairs["d2"] if not p["aIsWave2"] and not p["bIsWave2"])
    if pairs["d0"]:
        errors.append(f"D-1: exact collisions {pairs['d0']}")

    # Recipes table
    step_of = {i: s["step"] for s in ladder for i in s["ingredientIds"]}
    recipe_rows = []
    for r in w2a:
        m = matrix[r["evidenceId"]]
        items = r["ingredients"]
        cats = {i: (ingredients.get(i) or ("sauce" if i in sauce_ids else catalog.get(i, {}).get("category", "topping"))) for i in items}
        steps = ["DOUGH"] + [s for s, c in (("SAUCE", "sauce"), ("CHEESE", "cheese"), ("TOPPING", "topping")) if c in cats.values()]
        if r["cutProfile"] == "STANDARD_6":
            steps.append("CUT")
        sauces = [i for i in items if cats[i] == "sauce"]
        interaction = {"tomato-sauce": "PAINT", "pesto": "PAINT", "olive-oil": "PAINT_TEMPORARY"}.get(sauces[0], "PAINT (new profile)") if sauces else None
        key_step = max([step_of.get(i, 0) for i in items if i not in w2.STARTERS] or [0])
        tier = tier_for(key_step, tiers) if key_step else None
        chapter = (tiers.index(tier) + 1) if tier else 1
        tokens = m["ingredients"]["tokenTrace"]
        recipe_rows.append({
            "evidenceId": r["evidenceId"],
            "proposedRuntimeId": r["canonicalCandidateId"],
            "nameJa": r["nameJa"],
            "origin": m["origin"],
            "ingredients": items,
            "ingredientCategories": cats,
            "sauce": {"ingredientId": sauces[0] if sauces else None, "interaction": interaction,
                      "evidenceFamily": m["sauceBase"]["sauceFamily"], "evidenceRule": m["sauceBase"]["rule"]},
            "cookingProfile": {"steps": steps, "derivedBy": "deriveCoreSteps (category-derived) + CUT allowlist"},
            "cut": {"profile": r["cutProfile"], "doughEvidence": m["dough"]["doughStyleRaw"]},
            "discoveryIdentity": {"targetId": r["evidenceId"], "items": items, "sauceBase": sorted(sauces),
                                  "identityDimensions": "DEFAULT (no capability)",
                                  "nearestRuntime": sorted({p["a"] if p["b"] == r["canonicalCandidateId"] else p["b"]
                                                            for p in pairs["d1"] if r["canonicalCandidateId"] in (p["a"], p["b"])})},
            "newIngredients": r["newIngredients"],
            "progression": {"keyStep": key_step, "keyStepMaterials": next((s["ingredientIds"] for s in ladder if s["step"] == key_step), []),
                            "discoverableAtDiscoveredCount": key_step, "priceTier": tier["tier"] if tier else None,
                            "chapter": chapter,
                            "note": "no own step: makeable from W1 materials" if key_step <= 24 else "keyed by an appended W2 step"},
            "expectedScoring": {
                "components": {"sauce": 52, "pieces": 16, "recipe": 12, "bake": 20},
                "sauceReference": "computeMechanicalSauceReference (ingredient-agnostic; same target as every recipe)",
                "starCeiling": 5,
                "calibration": "NOT_CALIBRATED: minCount / bakeTarget / reference piece layout are OD-W2-6 authoring values; expected curve = the W1 analog below",
                "w1Analog": {"brazilian-calabresa-pizzadb-p10": "salsiccia / capricciosa", "vongole-pizzadb": "new-haven-apizza",
                             "flammkuchen-pizzadb": "fugazza (no cheese, painted base)", "pesto-gamberi-pizzadb-p11": "pesto-tonno",
                             "pesto-pollo-pizzadb-p12": "pesto-caprese", "ratatouille-pizza-pizzadb-p13": "melanzane-pizza",
                             "pesto-vegetariana-pizzadb-p12": "pesto-patate", "prosciutto-funghi-pizzadb-p11": "funghi",
                             "jamon-serrano-pizza-pizzadb-p7": "hawaiian"}[r["evidenceId"]],
            },
            "evidence": {"phase1Status": m["productDecisionStatus"], "evidenceOrigin": m["phase0"]["evidenceOrigin"],
                         "source": m["phase0"].get("sourceUrl"),
                         "tokenDispositions": sorted({t["disposition"] for t in tokens}),
                         "likelyAliasTokens": [t["token"] + "->" + str(t["canonicalId"]) for t in tokens if t["disposition"] == "likely_alias"],
                         "reviewItems": r["phase1ReviewItems"],
                         "strength": "MEDIUM" if (r["phase1ReviewItems"] or any(t["disposition"] == "likely_alias" for t in tokens)) else "HIGH"},
            "unresolved": UNRESOLVED[r["evidenceId"]],
        })

    # Ingredient table
    recipe_of = {i: sorted(r["canonicalCandidateId"] for r in w2a if i in r["ingredients"]) for i in new_ings}
    ing_rows = []
    for i in new_ings:
        cat = "sauce" if i in sauce_ids else catalog.get(i, {}).get("category") or "topping"
        fam, _ = w2.family_of(i, tax) if cat == "topping" else (None, False)
        st = step_of[i]
        t = tier_for(st, tiers)
        ing_rows.append({
            "id": i, "nameJa": NEW_INGREDIENT_META[i]["nameJa"], "nameSource": NEW_INGREDIENT_META[i]["nameSource"],
            "category": cat, "placement": "spread" if cat == "sauce" else "scatter",
            "inventoryUnit": "use (spread, k=1)" if cat == "sauce" else "piece (scatter, k = max minCount)",
            "taxonomy": {"family": fam, "subfamily": NEW_INGREDIENT_META[i]["subfamily"],
                         "status": "PROPOSED (PR #255 audit: high confidence; production row needs OD-W2-5)" if cat == "topping"
                         else "category-level attribute (DH4-1: sauces/cheeses have no family row)"},
            "unlockStep": st, "priceTier": t["tier"], "packPrice": t["packPrice"], "refillPrice": t["refillPrice"],
            "packQuantity": "10 x k (k = max minCount over recipes, OD-W2-6)",
            "recipeDependency": recipe_of[i],
            "evidence": {"inCatalogV2": i in catalog, "catalogUsedBy": catalog.get(i, {}).get("usedByRecipeIds"),
                         "evidence172RowCount": sum(1 for r in matrix.values() if i in (r["ingredients"]["identityIngredientSet"] or []))},
        })

    # Chapters (recipeChapters.ts rule: price tier of the key step; starter-only -> 1)
    def chapter_of(items):
        k = max([step_of.get(i, 0) for i in items if i not in w2.STARTERS] or [0])
        t = tier_for(max(1, k), tiers)
        return tiers.index(t) + 1
    chapters_before = {}
    for r, items in base_pop.items():
        chapters_before.setdefault(str(chapter_of(items)), []).append(r)
    chapters = {}
    for r, items in pop.items():
        chapters.setdefault(str(chapter_of(items)), []).append(r)
    chapters = {k: {"count": len(v), "wave2": sorted(x for x in v if x not in base_pop),
                    "countBefore": len(chapters_before.get(k, []))} for k, v in sorted(chapters.items())}

    # Post-W2A counts, tray pages
    cat_counts_before = {c: sum(1 for v in ingredients.values() if v == c) for c in ("sauce", "cheese", "topping")}
    cat_counts_after = dict(cat_counts_before)
    for x in ing_rows:
        cat_counts_after[x["category"]] += 1
    pages = lambda n: -(-n // palette)
    tray = {c: {"before": cat_counts_before[c], "after": cat_counts_after[c],
                "freeCookPagesBefore": pages(cat_counts_before[c]), "freeCookPagesAfter": pages(cat_counts_after[c])}
            for c in cat_counts_before}
    guided_max = max(sum(1 for i in r["ingredients"] if (ingredients.get(i) or "") == c or (i in new_ings and next(x["category"] for x in ing_rows if x["id"] == i) == c))
                     for r in w2a for c in ("sauce", "cheese", "topping"))

    checks = {
        "L-1_w1LadderEqualsRuleDerivation": l1,
        "L-2_steps1to24Identical": l2,
        "L-3_wave2OnlyAt25Plus": l3,
        "L-4_existingSaveNextUnlockUnchanged": l4_ok,
        "L-5_noIngredientUnlockCollision": not l5_problems,
        "L-6_deadlockCount": len(deadlocks),
        "L-7_unreachableRecipes": unreachable,
        "D-1_exactIdentityCollisions": len(pairs["d0"]),
    }
    for k, v in checks.items():
        if v is False or (isinstance(v, int) and not isinstance(v, bool) and v != 0) or (isinstance(v, list) and v):
            errors.append(f"{k} failed: {v}")

    out = {
        "schemaVersion": "teto-wave2-w2a-gate/1",
        "generatedBy": "tools/progression2_wave2_w2a_gate.py",
        "scope": "Owner Decision Gate for W2-A. Docs/data/tools only; nothing here is production authority.",
        "inputHashes": {p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest()[:16] for p in HASHED_INPUTS},
        "policy": {"OD-W2-1": "APPEND_ONLY (Owner candidate): W1 steps 1..24 fixed; Wave 2 materials appended from step 25 with the REC-04 key-recipe rule applied to the delta only"},
        "checks": checks,
        "ladder": ladder,
        "existingSaveNextUnlock": l4_rows,
        "deadlockCurve": curve,
        "collisionAudit": {"population": len(pop), "pairs": len(pop) * (len(pop) - 1) // 2,
                           "exactCollisions": pairs["d0"], "d1Pairs": pairs["d1"], "d2PairCount": len(pairs["d2"]),
                           "d1PairsRuntimeOnlyBefore": base_d1, "d1PairsAfter": len(pairs["d1"]),
                           "d2PairsRuntimeOnlyBefore": base_d2},
        "recipes": recipe_rows,
        "newIngredients": ing_rows,
        "afterW2A": {
            "recipeCount": len(pop), "ingredientCount": len(ingredients) + len(new_ings),
            "categoryCounts": cat_counts_after, "ladderSteps": len(ladder),
            "dexPill": f"n/{len(pop)}",
            "chapters": chapters,
            "tray": {"paletteSlotsPerPage": palette, "columns": columns, "rowsPerPageMax": -(-palette // columns),
                     "categories": tray, "guidedMaxItemsPerCategory": guided_max},
        },
    }
    text = json.dumps(out, ensure_ascii=False, indent=1) + "\n"
    if errors:
        print("\n".join(errors))
        return 1
    if check:
        if not OUT.exists() or read(OUT) != text:
            print("committed gate JSON differs from regeneration")
            return 1
        print("W2-A gate: all checks passed; JSON byte-identical.")
    else:
        OUT.write_text(text, encoding="utf-8")
        print(f"wrote {OUT.relative_to(ROOT)}")
    print(json.dumps(checks, ensure_ascii=False))
    print("tray", json.dumps(tray), "guidedMax", guided_max)
    print("collisions d1 before/after", base_d1, len(pairs["d1"]), "d2", base_d2, len(pairs["d2"]))
    return 0


if __name__ == "__main__":
    sys.exit(main("--check" in sys.argv))
