#!/usr/bin/env python3
"""Post-Production-27 / 53-recipe Scale Fresh Audit generator (audit / docs tool only).

Reads (never writes) the working tree at the audited main SHA:
  src/data/{recipes,ingredients,ingredientTaxonomy,discoveryLadder}.ts   (static parse, no node_modules)
  data/recipes/{pizza_master_catalog,ingredient_master_catalog}.json     (frozen research artifacts, OD-T8)
  docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json     (PIZZA DB evidence, not authority)
  docs/reports/data/TETO_62-INGREDIENT-TAXONOMY-HCG_Fresh-Audit.json     (Owner-confirmed OD-T1..T8 families)
Writes: docs/reports/data/TETO_POST-PROD27_53-RECIPE-SCALE_Fresh-Audit.json

Nothing here is imported by src/**, nothing is a production authority, no runtime / save / schema is touched.
The ladder rule is a Python port of src/logic/testSupport/discoveryLadderRule.ts (`buildKeyRecipeLadder`) and is
validated against the production ladder (steps 1..25) before any scenario is run.

Usage: python3 tools/post_prod27_53_scale_audit.py [--sha <40-hex>] [--check]
"""
from __future__ import annotations

import argparse
import hashlib
import itertools
import json
import math
import re
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs/reports/data/TETO_POST-PROD27_53-RECIPE-SCALE_Fresh-Audit.json"

# ---- constants read from production source (re-verified by assert_constants) -------------------------------------
HAND_CAPACITY = 12
TRAY_PAGE_SLOTS = 6            # MAX_INGREDIENT_PALETTE_SLOTS
NOTEBOOK_MAX = 200             # trialNotebook.ts MAX_FEEDBACK_TEXT
RESEARCH_TOPPING_K = 3         # OD-RB-10
ENTRY_MARKS = 10               # researchEntry.ts ENTRY_MARKS (①..⑩); beyond that the label falls back to a number
TIERS = [("T1", 1, 5), ("T2", 6, 14), ("T3", 15, 29), ("T4", 30, None)]
PAINT_SAUCES = {"tomato-sauce", "olive-oil", "pesto"}  # RecipeSauceProfile.ingredientId literal union


def read(p: str) -> str:
    return (ROOT / p).read_text(encoding="utf-8")


def sha256(p: str) -> str:
    return hashlib.sha256((ROOT / p).read_bytes()).hexdigest()


# ---- production static parse ------------------------------------------------------------------------------------
def parse_production():
    rt = read("src/data/recipes.ts")
    body = rt[rt.index("export const RECIPES"):]
    body = body[: body.index("] as const;")]
    recipes = []
    for b in re.split(r"\n  \{\n    id: ", body)[1:]:
        rid = re.match(r'"([^"]+)"', b).group(1)
        ings = re.findall(r'ingredientId: "([^"]+)", minCount: (\d+)', b)
        recipes.append({
            "id": rid,
            "ingredients": [i for i, _ in ings],
            "minCounts": {i: int(c) for i, c in ings},
            "ladderCredit": "ladderCredit: false" not in b,
            "lunchRush": "lunchRush: false" not in b,
            "unlockCondition": bool(re.search(r"unlockCondition:", b)),
        })
    it = read("src/data/ingredients.ts")
    ibody = it[it.index("export const INGREDIENTS"):]
    ingredients = []
    for b in re.split(r"\n  \{\n    id: ", ibody)[1:]:
        iid = re.match(r'"([^"]+)"', b).group(1)
        cat = re.search(r'category: "(sauce|cheese|topping)"', b).group(1)
        pl = re.search(r'placement: "(spread|scatter)"', b).group(1)
        ingredients.append({"id": iid, "category": cat, "placement": pl, "finite": "unlockCondition:" in b})
    tx = read("src/data/ingredientTaxonomy.ts")
    fam = dict(re.findall(r'\["([a-z-]+)", "([a-z]+)"\]', tx))
    ld = read("src/data/discoveryLadder.ts")
    w1 = ld[ld.index("export const W1_25_DISCOVERY_LADDER"):ld.index("export const W1_FIXED_STEP_COUNT")]
    steps = [
        {"step": int(s), "ingredientIds": re.findall(r'"([^"]+)"', ids), "keyRecipeId": k}
        for s, ids, k in re.findall(r'step: (\d+), kind: "MATERIAL", ingredientIds: \[([^\]]*)\], keyRecipeId: "([^"]+)"', w1)
    ]
    app = ld[ld.index("export const POST_W1_APPENDED_STEPS"):ld.index("export const DISCOVERY_LADDER")]
    for ids, k in re.findall(r'ingredientIds: \[([^\]]*)\], keyRecipeId: "([^"]+)"', app):
        steps.append({"step": len(steps) + 1, "ingredientIds": re.findall(r'"([^"]+)"', ids), "keyRecipeId": k})
    return recipes, ingredients, fam, steps


# ---- ladder rule (port of buildKeyRecipeLadder / buildAppendOnlyLadder) ---------------------------------------------
def key_recipe_ladder(recipes, owned0):
    """recipes: list of (id, frozenset). Returns appended steps [(ingredient list, keyRecipeId)]."""
    owned = set(owned0)

    def reach(o):
        return {r for r, s in recipes if s <= o}

    remaining = [(r, s) for r, s in recipes if not s <= owned]
    out = []
    while remaining:
        before = reach(owned)
        best = None
        for r, s in remaining:
            missing = sorted(s - owned)
            after = reach(owned | set(missing))
            gain = len(after - before)
            reuse = sum(1 for _, x in recipes if not x <= owned for i in missing if i in x)
            key = (len(missing), -gain, -reuse, r)
            if best is None or key < best[0]:
                best = (key, r, missing)
        _, r, missing = best
        owned |= set(missing)
        out.append((missing, r))
        remaining = [(x, s) for x, s in remaining if not s <= owned]
    return out


def tier_of(step):
    for name, lo, hi in TIERS:
        if step >= lo and (hi is None or step <= hi):
            return name
    return "T4"


def simulate(ladder_steps, recipes, credited, starters, cookable=None):
    """ladder_steps: [{'step','ingredientIds','keyRecipeId'}]; recipes: {id: frozenset}; credited: set of ids that count.

    pool[s] = (# credited makeable recipes with materials of steps < s) - (s - 1): undiscovered makeable recipes when the
    player holds exactly the s-1 discoveries that reached step s-1 (the minimum-slack state; production = 1 everywhere).
    cookable: optional set; recipes outside it are makeable on paper but cannot actually be produced / identified.
    """
    owned = set(starters)
    rows = []
    for st in ladder_steps:
        s = st["step"]
        mk = {r for r, x in recipes.items() if x <= owned and r in credited}
        mk_c = mk if cookable is None else {r for r in mk if r in cookable}
        rows.append({"step": s, "makeableBefore": len(mk), "poolMinSlack": len(mk) - (s - 1),
                     "cookableMakeableBefore": len(mk_c), "softlock": len(mk) < s,
                     "hardBlockedByUncookable": len(mk_c) < s <= len(mk) + 0 or (cookable is not None and len(mk_c) < s)})
        owned |= set(st["ingredientIds"])
    final_mk = {r for r, x in recipes.items() if x <= owned and r in credited}
    return rows, owned, final_mk


def max_entries(ladder_steps, recipes, credited, starters):
    """Max simultaneous Research Entries along the minimum-discovery path: all unlocked materials bought, s discoveries."""
    owned = set(starters)
    best = (0, 0)
    for st in ladder_steps:
        owned |= set(st["ingredientIds"])
        mk = {r for r, x in recipes.items() if x <= owned and r in credited}
        e = len(mk) - st["step"]
        if e > best[0]:
            best = (e, st["step"])
    return {"maxSimultaneousEntries": best[0], "atStep": best[1]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sha", default=None)
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    head = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    sha = args.sha or head

    recipes, ingredients, fam, ladder = parse_production()
    ing_by = {i["id"]: i for i in ingredients}
    prod_ids = [r["id"] for r in recipes]
    cat_recipes = json.loads(read("data/recipes/pizza_master_catalog.json"))
    cat_ing = json.loads(read("data/recipes/ingredient_master_catalog.json"))
    matrix = json.loads(read("docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json"))
    tax62 = json.loads(read("docs/reports/data/TETO_62-INGREDIENT-TAXONOMY-HCG_Fresh-Audit.json"))

    # ---------------------------------------------------------------- 0. production counts
    prod_by_cat = Counter(i["category"] for i in ingredients)
    production = {
        "recipes": len(recipes), "ingredients": len(ingredients),
        "ingredientsByRole": dict(prod_by_cat),
        "starterIngredients": [i["id"] for i in ingredients if not i["finite"]],
        "taxonomyFamilyRows": len(fam), "ladderSteps": len(ladder),
        "ladderCreditedRecipes": sum(1 for r in recipes if r["ladderCredit"]),
        "lunchRushParticipating": sum(1 for r in recipes if r["lunchRush"]),
        "noSauceRecipes": [r["id"] for r in recipes if not any(ing_by[i]["category"] == "sauce" for i in r["ingredients"])],
        "noCheeseRecipes": [r["id"] for r in recipes if not any(ing_by[i]["category"] == "cheese" for i in r["ingredients"])],
        "multiSauceRecipes": [r["id"] for r in recipes if sum(ing_by[i]["category"] == "sauce" for i in r["ingredients"]) > 1],
        "sourceHashes": {p: sha256(p) for p in ["src/data/recipes.ts", "src/data/ingredients.ts",
                                                 "src/data/ingredientTaxonomy.ts", "src/data/discoveryLadder.ts"]},
    }
    assert production["recipes"] == 27 and production["ingredients"] == 30, production
    assert dict(prod_by_cat) == {"sauce": 3, "cheese": 4, "topping": 23}
    assert len(fam) == 23 and set(fam) == {i["id"] for i in ingredients if i["category"] == "topping"}

    starters = {i["id"] for i in ingredients if not i["finite"]}
    prod_sets = {r["id"]: frozenset(r["ingredients"]) for r in recipes}

    # ---- ladder port validation: steps 1..24 frozen, step 25 = what the rule appends over production
    fixed24 = ladder[:24]
    owned24 = starters | {i for s in fixed24 for i in s["ingredientIds"]}
    derived = key_recipe_ladder(list(prod_sets.items()), owned24)
    ladder_ok = [(s["ingredientIds"], s["keyRecipeId"]) for s in ladder[24:]] == [(m, k) for m, k in derived]
    assert ladder_ok, (derived, ladder[24:])
    owned25 = starters | {i for s in ladder for i in s["ingredientIds"]}
    assert all(s <= owned25 for s in prod_sets.values()), "production ladder must make all 27 recipes makeable"
    credited_prod = {r["id"] for r in recipes if r["ladderCredit"]}
    rows27, _, mk27 = simulate(ladder, prod_sets, credited_prod, starters)
    prod_sim = {
        "ladderPortValidated": ladder_ok,
        "poolMinSlackBySteps": [r["poolMinSlack"] for r in rows27],
        "everyStepPoolIsOne": all(r["poolMinSlack"] == 1 for r in rows27),
        "softlockSteps": [r["step"] for r in rows27 if r["softlock"]],
        "credited": len(credited_prod), "makeableAfterLastStep": len(mk27),
        "maxSimultaneousEntries": max_entries(ladder, prod_sets, credited_prod, starters),
        "toppingsOwnedAtEnd": prod_by_cat["topping"],
        "refillAllMaterialsPitz": sum({"T1": 30, "T2": 40, "T3": 50, "T4": 60}[tier_of(x["step"])] * len(x["ingredientIds"]) for x in ladder),
        "finiteMaterials": sum(len(x["ingredientIds"]) for x in ladder),
        "handActiveFromStep": None,
    }
    _o = set(starters)
    for _s in ladder:
        _o |= set(_s["ingredientIds"])
        if sum(1 for i in _o if ing_by[i]["category"] == "topping") > HAND_CAPACITY and prod_sim["handActiveFromStep"] is None:
            prod_sim["handActiveFromStep"] = _s["step"]

    # ---------------------------------------------------------------- 1. candidate population
    cat_by = {r["id"]: r for r in cat_recipes["recipes"]}
    cing = {i["id"]: i for i in cat_ing["ingredients"]}
    cat_cat = lambda iid: (ing_by[iid]["category"] if iid in ing_by else cing[iid]["category"])
    cat_plc = lambda iid: (ing_by[iid]["placement"] if iid in ing_by else cing[iid]["placementType"])

    union_ing = set(ing_by) | set(cing)
    new_ing = sorted(i for i in union_ing if i not in ing_by)
    overlap_ing = sorted(set(ing_by) & set(cing))
    prod_only_ing = sorted(set(ing_by) - set(cing))
    catalog_only_recipes = [r for r in cat_recipes["recipes"] if r["id"] not in prod_sets]
    overlap_recipes = [r for r in cat_recipes["recipes"] if r["id"] in prod_sets]
    prod_only_recipes = sorted(set(prod_sets) - set(cat_by))

    # stale / drift of the overlapping 16 (catalog composition vs production composition)
    drift = []
    for r in overlap_recipes:
        cs, ps = set(r["ingredients"]), set(prod_sets[r["id"]])
        if cs != ps:
            drift.append({"id": r["id"], "catalogOnly": sorted(cs - ps), "productionOnly": sorted(ps - cs)})
    stale_flags = {
        "ingredientsMarkedNotInGameButShippedNow": sorted(i for i, x in cing.items() if not x["existingInGame"] and i in ing_by),
        "productionIngredientsMissingFromCatalog": prod_only_ing,
        "productionRecipesMissingFromCatalog": prod_only_recipes,
        "catalogHeaderCounts": {"totalIngredientCount": cat_ing["totalIngredientCount"], "existingIngredientCount": cat_ing["existingIngredientCount"],
                                "newIngredientCount": cat_ing["newIngredientCount"], "catalogEntryCount": cat_recipes["catalogEntryCount"]},
        "nameJaDriftCatalogVsProduction": sorted(
            {i: (cing[i]["nameJa"]) for i in overlap_ing}.items()) and None,
        "catalogStatusStaleForShipped": sorted(r["id"] for r in overlap_recipes if r["gameDesignStatus"] != "shipped"),
        "catalogCompositionDriftOnOverlap": drift,
    }
    src_ing = read("src/data/ingredients.ts")
    nm_prod = dict(re.findall(r'id: "([^"]+)",\s*category: "[a-z]+",\s*nameJa: "([^"]+)"', src_ing))
    nm_prod = {i: re.search(r'id: "%s",[\s\S]*?nameJa: "([^"]+)"' % re.escape(i), src_ing).group(1) for i in ing_by}
    stale_flags["nameJaDriftCatalogVsProduction"] = [
        {"id": i, "catalog": cing[i]["nameJa"], "production": nm_prod[i]} for i in overlap_ing if cing[i]["nameJa"] != nm_prod[i]]

    st = Counter(r["verificationStatus"] for r in catalog_only_recipes)
    gs = Counter(r["gameDesignStatus"] for r in catalog_only_recipes)

    # identity collisions across the union (matcher = exact ingredient set + sauceBase, default dimensions)
    def ident(rid, ings):
        s = frozenset(ings)
        return (s, frozenset(i for i in s if cat_cat(i) == "sauce"))

    all_idents = {r: ident(r, prod_sets[r]) for r in prod_sets}
    for r in cat_recipes["recipes"]:
        if r["id"] not in prod_sets and r["ingredients"]:
            all_idents[r["id"]] = ident(r["id"], r["ingredients"])
    groups = defaultdict(list)
    for rid, k in all_idents.items():
        groups[k].append(rid)
    collisions = [{"items": sorted(k[0]), "recipes": sorted(v)} for k, v in groups.items() if len(v) > 1]
    collide_with = {r for c in collisions for r in c["recipes"]}

    # PIZZA DB evidence link (composition ledger = catalogId -> evidence row)
    rows_by = {r["evidenceId"]: r for r in matrix["rows"]}
    ledger = {x["catalogId"]: x for x in matrix["compositionDecisionLedger"]}
    first_rows = {}
    for r in matrix["rows"]:
        first_rows.setdefault(r["canonicalCandidateId"], r)

    def evidence_of(cid):
        led = ledger.get(cid)
        row = rows_by[led["evidenceId"]] if led else first_rows.get(cid)
        if not row:
            return None
        return {"evidenceId": row["evidenceId"], "relation": (led or {}).get("relation", "SAME_ID_ROW"),
                "representability": row["currentFlowRepresentability"], "requiredCapabilities": row["requiredCapabilities"],
                "productDecisionStatus": row["productDecisionStatus"],
                "capabilityStrengths": sorted({(m["capability"], m["strength"]) for m in row["mechanicEvidence"]})}

    # ---------------------------------------------------------------- 5. per-recipe engine flags
    cand = []
    for r in catalog_only_recipes:
        ings = r["ingredients"]
        sauces = [i for i in ings if cat_cat(i) == "sauce"]
        mech = set(r["mechanics"])
        fin = list(r["finishingIngredients"])
        new_mech = sorted(mech - {"spread", "scatter", "postBakeFinishing"})
        ev = evidence_of(r["id"])
        flags = []
        if r["verificationStatus"] == "rejected_duplicate": flags.append("REJECTED_DUPLICATE")
        if r["verificationStatus"] == "deferred": flags.append("DEFERRED")
        if not ings: flags.append("PLACEHOLDER_NO_INGREDIENTS")
        if r["id"] in collide_with: flags.append("IDENTITY_COLLISION")
        if len(sauces) > 1: flags.append("MULTI_SAUCE")
        if ings and (not sauces or r.get("sauce") is None): flags.append("NO_SAUCE")
        if any(s not in PAINT_SAUCES for s in sauces): flags.append("NEW_SAUCE_ID")
        if fin or "postBakeFinishing" in mech: flags.append("POST_BAKE_FINISH")
        if new_mech: flags.append("NEW_MECHANIC:" + "+".join(new_mech))
        if any(cat_cat(i) == "topping" and cat_plc(i) == "spread" for i in ings): flags.append("SPREAD_PLACED_TOPPING")
        if ev and ev["relation"] in ("DIVERGENT", "PIZZADB_SUPERSET", "PIZZADB_SUBSET") or (ev and ev["relation"].startswith("INDETERMINATE")):
            flags.append("SOURCE_COMPOSITION_CONFLICT")
        new_i = sorted(i for i in set(ings) if i not in ing_by)
        toppings = [i for i in ings if cat_cat(i) == "topping"]
        cheeses = [i for i in ings if cat_cat(i) == "cheese"]
        cand.append({
            "id": r["id"], "nameJa": r["nameJa"], "catalogStatus": r["verificationStatus"], "gameDesignStatus": r["gameDesignStatus"],
            "implementationClass": r["implementationClass"], "catalogMechanics": r["mechanics"], "ingredients": ings,
            "finishingIngredients": fin, "sauceCategoryIngredients": sauces, "newIngredients": new_i,
            "toppingKinds": len(toppings), "cheeseKinds": len(cheeses),
            "pizzaDbEvidence": ev, "flags": flags,
        })
    cand_by = {c["id"]: c for c in cand}

    def has(c, *fs):
        return any(f in c["flags"] or any(x.startswith(f) for x in c["flags"]) for f in fs)

    HARD_EXCLUDE = ("REJECTED_DUPLICATE", "DEFERRED", "PLACEHOLDER_NO_INGREDIENTS", "IDENTITY_COLLISION", "MULTI_SAUCE",
                    "NO_SAUCE", "POST_BAKE_FINISH", "NEW_MECHANIC", "SPREAD_PLACED_TOPPING")
    for c in cand:
        c["currentEngineReady"] = not has(c, *HARD_EXCLUDE)
        c["currentEngineReadyNewSauceFree"] = c["currentEngineReady"] and not has(c, "NEW_SAUCE_ID")

    cohorts = {
        "U64_all_union": [c["id"] for c in cand],
        "U62_minus_rejected_duplicates": [c["id"] for c in cand if "REJECTED_DUPLICATE" not in c["flags"]],
        "U57_minus_deferred_too": [c["id"] for c in cand if not has(c, "REJECTED_DUPLICATE", "DEFERRED")],
        "ENGINE_READY": [c["id"] for c in cand if c["currentEngineReady"]],
        "ENGINE_READY_EXISTING_SAUCES_ONLY": [c["id"] for c in cand if c["currentEngineReadyNewSauceFree"]],
        "ENGINE_READY_AND_SOURCE_CLEAN": [c["id"] for c in cand if c["currentEngineReady"] and "SOURCE_COMPOSITION_CONFLICT" not in c["flags"]],
    }

    # ---- capability dependency table: which recipes become engine-ready if exactly these capabilities exist
    INFO_FLAGS = {"SOURCE_COMPOSITION_CONFLICT"}

    def caps(c):
        return {f.split(":")[0] if not f.startswith("NEW_MECHANIC:") else f for f in c["flags"]} - INFO_FLAGS

    live = [c for c in cand if not (caps(c) & {"REJECTED_DUPLICATE", "DEFERRED"})]
    single = Counter()
    for c in live:
        k = caps(c)
        if len(k) == 1: single[next(iter(k))] += 1
    order = ["SPREAD_PLACED_TOPPING", "NEW_SAUCE_ID", "POST_BAKE_FINISH", "MULTI_SAUCE", "NO_SAUCE",
             "NEW_MECHANIC:specialShapePan", "NEW_MECHANIC:quadrantPlacement", "NEW_MECHANIC:foldDough", "NEW_MECHANIC:ringPlacement",
             "NEW_MECHANIC:layeredReverseOrder", "NEW_MECHANIC:halfAndHalfSplit", "IDENTITY_COLLISION", "PLACEHOLDER_NO_INGREDIENTS"]
    have, cum = set(), []
    for o in order:
        have.add(o)
        cum.append({"addCapability": o, "recipesEngineReadyCumulative": sum(1 for c in live if caps(c) <= have),
                    "recipesWhoseOnlyDependencyIsThis": single.get(o, 0)})
    capability_unlock = {"liveCandidates(non-rejected,non-deferred)": len(live), "baseEngineReady": sum(1 for c in live if not caps(c)),
                         "cumulativeInOrder": cum, "singleDependencyCounts": dict(single)}

    # ---- uncookable-by-current-engine set (used to expose HARD-deadlock conditions of a naive ladder)
    cookable_new = set(cohorts["ENGINE_READY"])
    cookable_all = set(prod_sets) | cookable_new

    # ---------------------------------------------------------------- 3. progression simulations
    def build_scenario(name, new_ids):
        sets = dict(prod_sets)
        for rid in new_ids:
            if cand_by[rid]["ingredients"]:
                sets[rid] = frozenset(cand_by[rid]["ingredients"])
        credited = set(credited_prod) | {r for r in new_ids if r in sets}
        app = key_recipe_ladder(list(sets.items()), owned25)
        full = list(ladder) + [{"step": 25 + n + 1, "ingredientIds": m, "keyRecipeId": k} for n, (m, k) in enumerate(app)]
        rows, owned_end, mk = simulate(full, sets, credited, starters, cookable=cookable_all)
        pop = set(sets)
        grp = defaultdict(list)
        for rid in pop:
            grp[all_idents[rid]].append(rid)
        collide_pop = {r for v in grp.values() if len(v) > 1 for r in v}
        literal_bad = {r for r in new_ids if r in pop and has(cand_by[r], "MULTI_SAUCE", "PLACEHOLDER_NO_INGREDIENTS")} | collide_pop
        literal_ok = pop - literal_bad
        rows_lit, _, _ = simulate(full, sets, credited, starters, cookable=literal_ok)
        no_new_material = sorted(r for r in new_ids if r in sets and sets[r] <= owned25)
        newrows = rows[25:]
        key_flags = {k: cand_by[k]["flags"] for _, k in app if k in cand_by}
        appended_ing = [i for m, _ in app for i in m]
        entries = max_entries(full, sets, credited, starters)
        tier_counts = Counter(tier_of(s["step"]) for s in full[24:])
        pools = [r["poolMinSlack"] for r in rows]
        unreachable = sorted({i for s in sets.values() for i in s if i not in owned_end})
        # chapter = price tier of key step (last material step of the recipe)
        step_of = {i: s["step"] for s in full for i in s["ingredientIds"]}
        chapters = Counter()
        for rid, s in sets.items():
            ks = max([step_of.get(i, 0) for i in s] + [0])
            chapters[tier_of(max(1, ks))] += 1
        toppings_owned_by_step = []
        owned = set(starters)
        for s in full:
            owned |= set(s["ingredientIds"])
            toppings_owned_by_step.append(sum(1 for i in owned if (cat_cat(i) == "topping")))
        sauces_end = sum(1 for i in owned_end if cat_cat(i) == "sauce")
        cheeses_end = sum(1 for i in owned_end if cat_cat(i) == "cheese")
        refill_prices = {"T1": 30, "T2": 40, "T3": 50, "T4": 60}
        refill_all = sum(refill_prices[tier_of(x["step"])] * len(x["ingredientIds"]) for x in full)
        return {
            "refillAllMaterialsPitz": refill_all, "materialsFinite": sum(len(x["ingredientIds"]) for x in full),
            "name": name, "recipes": len(sets), "newRecipes": len([r for r in new_ids if r in sets]),
            "appendedLadderSteps": len(app), "totalLadderSteps": len(full),
            "appendedSteps": [{"step": 25 + n + 1, "ingredientIds": m, "keyRecipeId": k, "tier": tier_of(25 + n + 1)} for n, (m, k) in enumerate(app)],
            "newIngredientsUnlocked": len(appended_ing),
            "materialsTotalAfter": len(owned_end), "rolesAfter": {"sauce": sauces_end, "cheese": cheeses_end,
                                                                  "topping": toppings_owned_by_step[-1]},
            "toppingsOwnedAtEnd": toppings_owned_by_step[-1], "handActiveFromStep": next((i + 1 for i, n in enumerate(toppings_owned_by_step) if n > HAND_CAPACITY), None),
            "tierCountsOfSteps16Plus": dict(tier_counts), "firstT4Step": 30 if len(full) >= 30 else None,
            "chaptersByKeyStepTier": dict(chapters),
            "poolMinSlackAppended": [r["poolMinSlack"] for r in newrows],
            "poolMinSlackAll": pools,
            "stepsWithSinglePool": sum(1 for p in pools if p == 1), "stepsWithPoolGE2": sum(1 for p in pools if p >= 2),
            "softlockSteps": [r["step"] for r in rows if r["softlock"]],
            "hardBlockedStepsIfUncookableCounted": [r["step"] for r in rows if (r["cookableMakeableBefore"] < r["step"])],
            "keyRecipesThatCurrentEngineCannotProduce": {k: f for k, f in key_flags.items() if k not in cookable_all},
            "literalUnreachableRecipes": sorted(literal_bad),
            "hardBlockedStepsLiteral": [r["step"] for r in rows_lit if r["cookableMakeableBefore"] < r["step"]],
            "newRecipesNeedingNoNewMaterial": no_new_material,
            "unreachableIngredients": unreachable, "maxSimultaneousResearchEntries": entries,
            "entryMarkOverflow": entries["maxSimultaneousEntries"] > ENTRY_MARKS,
        }

    scenarios = {n: build_scenario(n, ids) for n, ids in cohorts.items()}
    # the "53 total" arithmetic: production 27 + k new
    need_for_53 = 53 - 27
    live_ing = [c for c in live if c["ingredients"]]
    nmap = {c["id"]: set(c["newIngredients"]) for c in live_ing}
    k_rm = len(live_ing) - need_for_53
    min_new = max_new = None
    if k_rm >= 0:
        sizes = [len(set().union(*[nmap[i] for i in nmap if i not in rem])) for rem in itertools.combinations(list(nmap), k_rm)]
        min_new, max_new = min(sizes), max(sizes)
    arithmetic = {
        "liveCandidatesWithIngredients": len(live_ing), "newIngredientsRangeWhenPickingExactly26": [min_new, max_new],
        "ingredientTotalRangeAt53Recipes": [30 + min_new, 30 + max_new] if min_new is not None else None,
        "targetTotal": 53, "currentProduction": 27, "additionalRecipesNeeded": need_for_53,
        "poolOfNewCandidates": {k: len(v) for k, v in cohorts.items()},
        "engineReadyCoversNeed": len(cohorts["ENGINE_READY"]) >= need_for_53,
        "shortfallWithoutNewMechanicOrNewSauceOrIdentityDimension": max(0, need_for_53 - len(cohorts["ENGINE_READY"])),
    }

    # ---------------------------------------------------------------- 2. ingredient taxonomy
    t62 = {r["id"]: r for r in tax62["ingredients"]}
    used_by = defaultdict(list)
    for r in cat_recipes["recipes"]:
        for i in set(r["ingredients"]) | set(r["finishingIngredients"]):
            used_by[i].append(r["id"])
    ing_rows = []
    for iid in sorted(union_ing):
        shipped = iid in ing_by
        role = cat_cat(iid)
        t = t62.get(iid, {})
        od = t.get("ownerDecision")
        family = fam.get(iid) if shipped else (od or {}).get("family")
        state = t.get("state")
        if shipped:
            classification = "PRODUCTION"
            owner = "none"
        elif role == "topping":
            classification = "CLASSIFIABLE_OWNER_CONFIRMED_PENDING_RUNTIME" if od else "UNCLASSIFIED"
            owner = "none (OD-T1/T2); taxonomy row must ship in the introducing PR (OD-T7)"
        elif iid == "mascarpone":
            classification = "ROLE_DEFERRED_OD_T4"
            owner = "REQUIRED: category (cheese vs other) at runtime introduction"
        else:
            classification = "ROLE_FROM_CATALOG_ARTIFACT_ONLY"
            owner = "REQUIRED per ingredient at runtime introduction (OD-T5)"
        flags = []
        if not shipped:
            usage_finishing = [r for r in used_by[iid] if iid in cat_by[r]["finishingIngredients"]]
            if role == "sauce" and usage_finishing: flags.append("SAUCE_ROLE_USED_AS_POST_BAKE_FINISH")
            if role == "sauce" and any(sum(cat_cat(x) == "sauce" for x in cat_by[r]["ingredients"]) > 1 for r in used_by[iid]):
                flags.append("SECOND_SAUCE_IN_RECIPE")
            if role == "topping" and cat_plc(iid) == "spread": flags.append("TOPPING_WITH_SPREAD_PLACEMENT")
            if role == "sauce" and iid not in PAINT_SAUCES: flags.append("NEEDS_SAUCE_PROFILE_TYPE_EXTENSION")
            if iid in ("bell-pepper", "cilantro", "porcini", "prosciutto-crudo", "spicy-salami", "wurstel", "steak", "french-fries", "speck"):
                flags.append("NEAR_ALIAS_OF_EXISTING_BUT_INDEPENDENT_ID")
            if re.search(r"[一-鿿Ａ-Ｚ]|[A-Za-z]", cing[iid]["nameJa"]): flags.append("NAME_NEEDS_SEARCH_ALIAS_OR_READING")
        ing_rows.append({
            "id": iid, "nameJa": (nm_prod[iid] if shipped else cing[iid]["nameJa"]), "inProduction": shipped,
            "role": role, "playerFacingCategoryJa": {"sauce": "ソース", "cheese": "チーズ", "topping": "具材"}[role],
            "placement": cat_plc(iid), "toppingFamily": family if role == "topping" else None,
            "shelf": (family if role == "topping" else role),
            "state": state, "classification": classification, "ownerDecisionNeeded": owner, "flags": flags,
            "usedByCatalogRecipes": sorted(used_by.get(iid, [])),
        })
    new_rows = [r for r in ing_rows if not r["inProduction"]]
    tax_summary = {
        "newIngredients": len(new_rows), "byRole": dict(Counter(r["role"] for r in new_rows)),
        "toppingFamilyResolved": sum(1 for r in new_rows if r["role"] == "topping" and r["toppingFamily"]),
        "toppingFamilyUnresolved": sum(1 for r in new_rows if r["role"] == "topping" and not r["toppingFamily"]),
        "roleNotOwnerConfirmed": [r["id"] for r in new_rows if r["classification"] in ("ROLE_FROM_CATALOG_ARTIFACT_ONLY", "ROLE_DEFERRED_OD_T4")],
        "roleUsageConflict": sorted({r["id"] for r in new_rows if "SAUCE_ROLE_USED_AS_POST_BAKE_FINISH" in r["flags"] or "SECOND_SAUCE_IN_RECIPE" in r["flags"] or "TOPPING_WITH_SPREAD_PLACEMENT" in r["flags"]}),
        "newToppingFamilyCounts": dict(Counter(r["toppingFamily"] for r in new_rows if r["role"] == "topping")),
        "unionToppingFamilyCounts": dict(Counter(r["toppingFamily"] for r in ing_rows if r["role"] == "topping")),
        "namesNeedingAliasOrReading": [r["id"] for r in new_rows if "NAME_NEEDS_SEARCH_ALIAS_OR_READING" in r["flags"]],
        "needSauceProfileTypeExtension": [r["id"] for r in new_rows if "NEEDS_SAUCE_PROFILE_TYPE_EXTENSION" in r["flags"]],
    }
    tax_summary["unresolvedCount"] = len(tax_summary["roleNotOwnerConfirmed"]) + tax_summary["toppingFamilyUnresolved"]

    # ---------------------------------------------------------------- 4. HAND 12 scale
    topping_union = [r for r in ing_rows if r["role"] == "topping"]
    max_distinct_toppings = max(
        [sum(1 for i in set(r["ingredients"]) if cat_cat(i) == "topping") for r in cat_recipes["recipes"]]
        + [sum(1 for i in r["ingredients"] if ing_by[i]["category"] == "topping") for r in recipes])
    hand = {
        "capacity": HAND_CAPACITY, "handIsPerCategoryAndFreeCookOnly": True,
        "productionToppingsAllOwned": prod_by_cat["topping"], "productionHiddenFromHandWhenAllOwned": prod_by_cat["topping"] - HAND_CAPACITY,
        "unionToppings": len(topping_union), "unionHiddenFromHandWhenAllOwned": len(topping_union) - HAND_CAPACITY,
        "unionSauces": sum(1 for r in ing_rows if r["role"] == "sauce"), "unionCheeses": sum(1 for r in ing_rows if r["role"] == "cheese"),
        "handActiveForSauceOrCheese": False,
        "maxDistinctToppingsInOneRecipe": max_distinct_toppings,
        "trayPages": {"production": {"sauce": math.ceil(3 / 6), "cheese": math.ceil(4 / 6), "topping": math.ceil(23 / 6)},
                      "union": {"sauce": math.ceil(sum(1 for r in ing_rows if r["role"] == "sauce") / 6),
                                "cheese": math.ceil(sum(1 for r in ing_rows if r["role"] == "cheese") / 6),
                                "topping": math.ceil(len(topping_union) / 6)}},
        "dinnerAndLunchRushKeepPagedTrayWorstTaps": {"production": math.ceil(23 / 6), "union": math.ceil(len(topping_union) / 6)},
        "shelfChipsMax": 9, "toppingFamilyChipsMax": 7, "newFamilyIdsNeeded": 0,
        "familySizesProduction": dict(Counter(fam.values())), "familySizesUnion": tax_summary["unionToppingFamilyCounts"],
        "largestFamilyUnion": max(tax_summary["unionToppingFamilyCounts"].items(), key=lambda kv: kv[1]),
        "searchVisibleWhenOwnedRowsGT": 6, "productionReadingJaFields": 0,
        "searchAliasEntriesProduction": 3,
    }

    # ---------------------------------------------------------------- Notebook 200-char worst case
    def label(unlock_ja, index):
        mark = "①②③④⑤⑥⑦⑧⑨⑩"
        return f"？？？ピザ {mark[index] if index < 10 else index + 1}（{unlock_ja}）"

    def names(role, source):
        return [nm_prod[i] if i in ing_by else cing[i]["nameJa"] for i in source if cat_cat(i) == role]

    def worst(ids, topping_label="トッピング", sauce_n=1, entry_index=9):
        sauces = sorted(names("sauce", ids), key=len, reverse=True)[:sauce_n]
        cheeses = names("cheese", ids)
        tops = sorted(names("topping", ids), key=len, reverse=True)[:RESEARCH_TOPPING_K]
        unlock = max(names("sauce", ids) + names("cheese", ids) + names("topping", ids), key=len)
        parts = [f"ソース: {' '.join(s + '×' for s in sauces)}", f"チーズ: {' '.join(c + '×' for c in cheeses)}",
                 f"{topping_label}: {' '.join(t + '×' for t in tops)}"]
        return len(label(unlock, entry_index) + " " + " ".join(parts))

    prod_ids_all = list(ing_by)
    union_ids_all = list(union_ing)
    notebook = {
        "limit": NOTEBOOK_MAX, "truncation": "none; recordAttempt rejects > 200 (INVALID_FEEDBACK, nothing stored)",
        "worstCaseProduction_sauce1": worst(prod_ids_all, sauce_n=1), "worstCaseProduction_sauce3_contractMethod": worst(prod_ids_all, sauce_n=3),
        "contractDocumentedWorstCase": 126,
        "worstCaseUnion_sauce1": worst(union_ids_all, sauce_n=1),
        "worstCaseUnion_sauce1_allCheesesUsed_labelFallbackIndex11": worst(union_ids_all, entry_index=10),
        "worstCaseUnion_with具材Label": worst(union_ids_all, topping_label="具材"),
        "cheesesInUnion": sum(1 for i in union_ids_all if cat_cat(i) == "cheese"),
        "cheeseRowIsUncapped": True,
        "note": "worst case = longest label + every cheese of the population judged + 3 longest unknown toppings + 1 sauce; a real attempt is shorter.",
    }
    notebook["headroomUnion"] = NOTEBOOK_MAX - notebook["worstCaseUnion_sauce1"]

    # ---------------------------------------------------------------- 5. cooking-step candidates (evidence-gated)
    steps_cand = []
    for c in cand:
        reasons = []
        f = c["flags"]
        if "NO_SAUCE" in f: reasons.append(("NO_SAUCE", "catalog: no sauce-category ingredient"))
        if "PLACEHOLDER_NO_INGREDIENTS" in f: reasons.append(("COMPOSITE_OF_TWO_RECIPES", "catalog mezza-e-mezza has no ingredients of its own"))
        if "MULTI_SAUCE" in f: reasons.append(("SECOND_SPREAD_LAYER", "2+ sauce-category ingredients; pizza.sauceIds holds 1 sauce"))
        if "POST_BAKE_FINISH" in f: reasons.append(("LATE_POST_BAKE_ADDITION", "catalog finishingIngredients / postBakeFinishing: " + ",".join(c["finishingIngredients"])))
        for fl in f:
            if fl.startswith("NEW_MECHANIC:"):
                for m in fl.split(":")[1].split("+"):
                    reasons.append(({"quadrantPlacement": "ZONED_QUADRANT", "halfAndHalfSplit": "SPLIT_CANVAS", "foldDough": "FOLD_SEAL",
                                     "stuffedDough": "ENCLOSE_STUFF", "ringPlacement": "EDGE_RING_FILL", "layeredReverseOrder": "REVERSE_LAYER",
                                     "specialShapePan": "PAN_SHAPE"}.get(m, m), "catalog mechanic tag " + m))
        if "SPREAD_PLACED_TOPPING" in f: reasons.append(("SPREAD_PLACED_TOPPING", "catalog placementType=spread on a topping-role ingredient"))
        if "NEW_SAUCE_ID" in f and "MULTI_SAUCE" not in f and "NO_SAUCE" not in f:
            reasons.append(("UNUSUAL_BASE_SPREAD", "base sauce outside tomato-sauce/olive-oil/pesto: " + ",".join(s for s in c["sauceCategoryIngredients"] if s not in PAINT_SAUCES)))
        if "IDENTITY_COLLISION" in f: reasons.append(("IDENTITY_COLLISION_NEEDS_DIMENSION", "same ingredient set + sauce base as another recipe"))
        ev = c["pizzaDbEvidence"]
        if reasons:
            steps_cand.append({"id": c["id"], "needs": [{"kind": k, "basis": b} for k, b in reasons],
                               "pizzaDbRow": ev["evidenceId"] if ev else None,
                               "pizzaDbRequiredCapabilities": ev["requiredCapabilities"] if ev else None,
                               "pizzaDbRepresentability": ev["representability"] if ev else None,
                               "pizzaDbCapabilityStrengths": ev["capabilityStrengths"] if ev else None,
                               "evidenceGrade": ("NO_PIZZA_DB_ROW__CATALOG_DESIGN_TAG_ONLY" if not ev else
                                                 "PIZZA_DB_SOURCE_OR_PROFILE_TEXT" if any(st_ not in ("catalog_design_tag", "repo_inference") for _, st_ in ev["capabilityStrengths"]) else
                                                 "PIZZA_DB_ROW__CAPABILITY_FROM_CATALOG_TAG_ONLY"),
                               "catalogStatus": c["catalogStatus"]})
    needs_counter = Counter(n["kind"] for s in steps_cand for n in s["needs"])

    # ---------------------------------------------------------------- 6. vertical slice scoring (data-driven shortlist)
    def slice_score(c):
        if not c["currentEngineReady"] or c["catalogStatus"] == "deferred": return None
        return (len(c["newIngredients"]), c["toppingKinds"], c["id"])
    shortlist = sorted((slice_score(c) + (c["id"],) for c in cand if slice_score(c)), key=lambda x: (x[0], x[1], x[2]))
    shortlist = [{"id": s[2], "newIngredients": cand_by[s[2]]["newIngredients"], "evidence": cand_by[s[2]]["pizzaDbEvidence"],
                  "flags": cand_by[s[2]]["flags"], "catalogStatus": cand_by[s[2]]["catalogStatus"]} for s in shortlist]

    out = {
        "schemaNote": "Audit evidence only. Not a production authority, not read by src/**. Regenerate: python3 tools/post_prod27_53_scale_audit.py",
        "auditedMainSha": sha, "generatedBy": "tools/post_prod27_53_scale_audit.py",
        "production": production, "productionSimulation": prod_sim,
        "population": {
            "catalogRecipes": cat_recipes["catalogEntryCount"], "catalogViable": cat_recipes["viableEntryCount"],
            "overlapWithProduction": len(overlap_recipes), "newRecipesRaw": len(catalog_only_recipes),
            "productionOnlyRecipes": prod_only_recipes, "unionRecipes": len(prod_sets) + len(catalog_only_recipes),
            "newByCatalogStatus": dict(st), "newByGameDesignStatus": dict(gs),
            "newRecipesExcludingRejectedDuplicates": len(cohorts["U62_minus_rejected_duplicates"]),
            "newRecipesExcludingRejectedAndDeferred": len(cohorts["U57_minus_deferred_too"]),
            "catalogIngredients": cat_ing["totalIngredientCount"], "ingredientOverlapWithProduction": len(overlap_ing),
            "newIngredients": len(new_ing), "unionIngredients": len(union_ing), "productionOnlyIngredients": prod_only_ing,
            "newIngredientsByRole": dict(Counter(cat_cat(i) for i in new_ing)),
            "staleDuplicateAlias": stale_flags, "identityCollisions": collisions,
            "namingClusters": matrix["namingClusterLedger"],
        },
        "arithmeticFor53": arithmetic, "capabilityUnlock": capability_unlock, "cohorts": cohorts, "scenarios": scenarios,
        "candidateRecipes": cand, "ingredients": ing_rows, "taxonomySummary": tax_summary,
        "hand": hand, "notebook": notebook,
        "cookingStepCandidates": steps_cand, "cookingStepNeedCounts": dict(needs_counter),
        "verticalSliceShortlist": shortlist,
        "constants": {"handCapacity": HAND_CAPACITY, "trayPageSlots": TRAY_PAGE_SLOTS, "notebookMax": NOTEBOOK_MAX,
                      "researchToppingK": RESEARCH_TOPPING_K, "entryMarks": ENTRY_MARKS, "priceTiers": TIERS},
    }
    text = json.dumps(out, ensure_ascii=False, indent=1, sort_keys=False) + "\n"
    if args.check:
        ok = OUT.exists() and OUT.read_text(encoding="utf-8") == text
        print("CHECK", "OK" if ok else "DRIFT")
        sys.exit(0 if ok else 1)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(text, encoding="utf-8")
    print("wrote", OUT.relative_to(ROOT), len(text))


if __name__ == "__main__":
    main()
