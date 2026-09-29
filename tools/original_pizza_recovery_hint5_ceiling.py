#!/usr/bin/env python3
"""Original Pizza Recovery / Discovery Assistance -- Fresh Audit, tooling-only simulation.

READ-ONLY analysis. Touches no src/, no save schema, no gameplay. Writes one JSON under
docs/reports/data/. It never guesses a classification: a topping without a row in
src/data/ingredientTaxonomy.ts (the only family authority on main) is UNCLASSIFIED and the
recipes that contain it are reported as "no Hint 5.0 view under current authority", not folded
into a guessed family. PR #309's owner-confirmed pending-runtime taxonomy is NOT read here.

Inputs (all on main):
  src/data/recipes.ts                                                 25 production recipes
  data/recipes/pizza_master_catalog.json                              53-entry master catalog (62-catalog foundation)
  data/recipes/ingredient_master_catalog.json                         62-ingredient catalog (category)
  docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json  172 authority rows (identity sets)
  src/data/ingredientTaxonomy.ts                                      runtime topping -> family rows
  src/data/ingredients.ts                                             runtime ids' category
  src/data/recipeHintRoles.ts                                         authored key topping (25 recipes)

Hint 5.0 full-open discloses (src/logic/discovery/hint5Ladder.ts): every sauce NAME, every cheese
NAME, the key topping NAME, the distinct ingredient TOTAL, and one FAMILY per sub-topping.

Metrics per population (recipes indistinguishable from the target after every rung is bought):
  viewA  key NOT modelled            -> UPPER bound of remaining recipe candidates
  viewB  key disclosed by name       -> best / worst key choice, plus the authored key where one exists
  answerSpace  number of sub-topping combinations still consistent with the disclosed families at
               full ownership (classified pools only -> a LOWER bound while toppings are unclassified)

Usage: python3 tools/original_pizza_recovery_hint5_ceiling.py [--out PATH]
"""
import argparse
import collections
import json
import math
import re
import statistics
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DEFAULT = ROOT / "docs/reports/data/TETO_ORIGINAL-PIZZA-RECOVERY_DISCOVERY-ASSISTANCE_Analysis.json"


def load_catalog_rows():
    return json.loads((ROOT / "data/recipes/ingredient_master_catalog.json").read_text())["ingredients"]


def load_catalog():
    cat = json.loads((ROOT / "data/recipes/ingredient_master_catalog.json").read_text())
    return {i["id"]: i["category"] for i in cat["ingredients"]}


def load_runtime_categories():
    text = (ROOT / "src/data/ingredients.ts").read_text()
    return {m.group(1): m.group(2) for m in re.finditer(r'id:\s*"([a-z0-9-]+)",\s*category:\s*"(sauce|cheese|topping)"', text)}


def load_families():
    text = (ROOT / "src/data/ingredientTaxonomy.ts").read_text()
    return {m.group(1): m.group(2) for m in re.finditer(r'\["([a-z0-9-]+)",\s*"([a-z]+)"\]', text)}


def load_keys():
    text = (ROOT / "src/data/recipeHintRoles.ts").read_text()
    keys = {}
    for m in re.finditer(r'"?([a-z0-9-]+)"?:\s*\{\s*hintKeyToppingId:\s*(null|"[a-z0-9-]+")', text):
        keys[m.group(1)] = None if m.group(2) == "null" else m.group(2).strip('"')
    return keys


def load_production():
    """The production recipes (src/data/recipes.ts); identity = distinct requiredIngredients."""
    text = (ROOT / "src/data/recipes.ts").read_text()
    out = []
    for block in re.split(r"\n  \{\n    id: \"", text)[1:]:
        rid = block.split('"', 1)[0]
        ids = sorted(set(re.findall(r'ingredientId:\s*"([a-z0-9-]+)"', block.split("bakeTarget", 1)[0])))
        out.append({"evidenceId": rid, "canonicalId": rid, "ids": ids})
    return out


def load_master53():
    p = json.loads((ROOT / "data/recipes/pizza_master_catalog.json").read_text())
    return [
        {"evidenceId": r["id"], "canonicalId": r["id"], "ids": sorted(set(r["ingredients"]))}
        for r in p["recipes"]
        if not r.get("rejectedDuplicateOf")
    ]


def initial_kana_stats(catalog_rows, family):
    """Rescue-hint Level 2 sizing: within each family, how many toppings have a first-kana no other
    topping of that family shares (a letter hint + family would then name the ingredient)."""
    by_family = collections.defaultdict(list)
    for i in catalog_rows:
        if i["category"] == "topping" and i["id"] in family:
            by_family[family[i["id"]]].append((i["id"], i["nameJa"][0]))
    out = {}
    for f, items in sorted(by_family.items()):
        c = collections.Counter(k for _, k in items)
        out[f] = {"toppings": len(items), "uniqueInitial": sum(1 for _, k in items if c[k] == 1)}
    return out


def bucket(n):
    return "1" if n == 1 else "2-3" if n <= 3 else "4-10" if n <= 10 else "10+"


def dist(sizes):
    c = collections.Counter(bucket(s) for s in sizes)
    return {b: c.get(b, 0) for b in ("1", "2-3", "4-10", "10+")}


def summarize(v):
    v = sorted(v)
    if not v:
        return None
    return {
        "n": len(v), "min": v[0], "median": statistics.median(v), "p90": v[int(0.9 * (len(v) - 1))],
        "max": v[-1], "share_gt_10": round(sum(1 for a in v if a > 10) / len(v), 3),
        "share_gt_100": round(sum(1 for a in v if a > 100) / len(v), 3),
    }


def analyze(name, recs, category, family, keys):
    fam_size = collections.Counter(family[i] for i, c in category.items() if c == "topping" and i in family)
    for x in recs:
        x["sauces"] = sorted(i for i in x["ids"] if category.get(i) == "sauce")
        x["cheeses"] = sorted(i for i in x["ids"] if category.get(i) == "cheese")
        x["toppings"] = sorted(i for i in x["ids"] if category.get(i) == "topping")
        x["total"] = len(x["ids"])
        x["strictEligible"] = all(t in family for t in x["toppings"])
    eligible = [x for x in recs if x["strictEligible"]]

    def fams(ts):
        return tuple(sorted(family[t] for t in ts))

    view_a = collections.defaultdict(list)
    for x in eligible:
        view_a[(tuple(x["sauces"]), tuple(x["cheeses"]), x["total"], fams(x["toppings"]))].append(x["evidenceId"])
    a_sizes = {e: len(v) for v in view_a.values() for e in v}

    def view_b_size(x, key):
        rest = [t for t in x["toppings"] if t != key]
        return sum(
            1
            for y in eligible
            if key in y["toppings"] and y["sauces"] == x["sauces"] and y["cheeses"] == x["cheeses"]
            and y["total"] == x["total"] and fams([t for t in y["toppings"] if t != key]) == fams(rest)
        )

    b_best, b_worst, b_actual = {}, {}, {}
    for x in eligible:
        e = x["evidenceId"]
        if not x["toppings"]:
            b_best[e] = b_worst[e] = a_sizes[e]
            continue
        sizes = [view_b_size(x, t) for t in x["toppings"]]
        b_best[e], b_worst[e] = min(sizes), max(sizes)
        k = keys.get(x["canonicalId"])
        if k in x["toppings"]:
            b_actual[e] = view_b_size(x, k)

    def space(x, key):
        rest = [t for t in x["toppings"] if t != key]
        ways = 1
        for f, k in collections.Counter(family[t] for t in rest).items():
            ways *= math.comb(fam_size[f] - (1 if key and family.get(key) == f else 0), k)
        return ways

    best, worst = [], []
    for x in eligible:
        s = [space(x, t) for t in x["toppings"]] or [1]
        best.append(min(s))
        worst.append(max(s))

    by_set = collections.defaultdict(list)
    for x in recs:
        by_set[tuple(x["ids"])].append(x["evidenceId"])
    collisions = {"|".join(k): v for k, v in by_set.items() if len(v) > 1}

    def d(a, b):  # the near-miss distance (src/logic/discovery/nearMiss.ts): non-sauce diff + sauce-differs
        pa, pb = set(a["ids"]) - set(a["sauces"]), set(b["ids"]) - set(b["sauces"])
        return len(pa - pb) + len(pb - pa) + (1 if set(a["sauces"]) != set(b["sauces"]) else 0)

    dens = sorted(sum(1 for j, b in enumerate(recs) if i != j and d(a, b) == 1) for i, a in enumerate(recs))
    return {
        "population": name,
        "recipes": len(recs),
        "strictHint5Eligible": len(eligible),
        "blockedByUnclassifiedTopping": len(recs) - len(eligible),
        "exactIdentitySetCollisionGroups": collisions,
        "viewA_keyNotModelled_UPPER_BOUND_buckets": dist(a_sizes.values()),
        "viewB_bestKey_buckets": dist(b_best.values()),
        "viewB_worstKey_buckets": dist(b_worst.values()),
        "viewB_authoredKey": {"rows": len(b_actual), "buckets": dist(b_actual.values())},
        "answerSpace_bestKey_lowerBound": summarize(best),
        "answerSpace_worstKey_lowerBound": summarize(worst),
        "nearMissD1NeighboursPerRecipe": {
            "median": statistics.median(dens) if dens else None,
            "p90": dens[int(0.9 * (len(dens) - 1))] if dens else None,
            "max": dens[-1] if dens else None,
            "shareWithZero": round(sum(1 for v in dens if v == 0) / len(dens), 3) if dens else None,
        },
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(OUT_DEFAULT))
    args = ap.parse_args()

    catalog = load_catalog()
    runtime_cat = load_runtime_categories()
    category = {**runtime_cat, **catalog}  # runtime-only ids (capers/clam/fresh-tomato) added
    family = load_families()
    keys = load_keys()
    matrix = json.loads((ROOT / "docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json").read_text())

    toppings_all = sorted(i for i, c in category.items() if c == "topping")
    unclassified = [i for i in toppings_all if i not in family]

    a172 = []
    unresolved_rows = outside_rows = 0
    outside_ids = collections.Counter()
    for r in matrix["rows"]:
        ids = r["ingredients"].get("identityIngredientSet")
        if not r["ingredients"]["complete"] or not ids:
            unresolved_rows += 1
            continue
        out = [i for i in ids if i not in category]
        if out:
            outside_rows += 1
            outside_ids.update(out)
            continue
        a172.append({"evidenceId": r["evidenceId"], "canonicalId": r["canonicalCandidateId"], "ids": sorted(ids)})

    pops = [
        analyze("production (src/data/recipes.ts)", load_production(), category, family, keys),
        analyze("master53 (pizza_master_catalog.json; 62-catalog foundation)", load_master53(), category, family, keys),
        analyze("authority172 rows fully expressible in the 62+runtime ids", a172, category, family, keys),
    ]
    result = {
        "schemaNote": "Tooling-only Fresh Audit simulation. Not an authority. No guessed classification; unclassified "
                      "toppings are reported, never assigned a family. PR #309 pending-runtime taxonomy NOT read.",
        "tool": "tools/original_pizza_recovery_hint5_ceiling.py",
        "hint5FullOpenDisclosure": "sauce NAMES + cheese NAMES + key topping NAME + distinct ingredient TOTAL + one FAMILY per sub-topping",
        "ingredientPopulation": {
            "catalog62": dict(collections.Counter(catalog.values())),
            "runtimeIngredients": len(runtime_cat),
            "runtimeOnlyIdsNotInCatalog": sorted(set(runtime_cat) - set(catalog)),
            "toppingsTotal": len(toppings_all),
            "toppingsClassifiedOnMain": len(toppings_all) - len(unclassified),
            "toppingsUnclassifiedOnMain": len(unclassified),
            "unclassifiedToppingIds": unclassified,
            "familyPoolSizesClassifiedOnly": dict(collections.Counter(family[i] for i in toppings_all if i in family)),
        },
        "authority172Coverage": {
            "rows": len(matrix["rows"]),
            "rowsWithoutResolvedIdentitySet": unresolved_rows,
            "rowsWithIngredientsOutsideThe62Catalog": outside_rows,
            "distinctOutsideIds": len(outside_ids),
            "topOutsideIds": outside_ids.most_common(12),
            "rowsFullyExpressibleIn62": len(a172),
        },
        "populations": pops,
        "rescueLevel2_initialKana_classifiedToppingsOnly": initial_kana_stats(load_catalog_rows(), family),
        "answerSpaceSensitivity_pure_math": {
            "note": "sub-topping combinations left when k sub-toppings of ONE family are disclosed by family only; pool = family size",
            "table": {f"pool={p},k={k}": math.comb(p, k) for p in (4, 8, 12, 20, 40) for k in (1, 2, 3)},
        },
    }
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(json.dumps(result, ensure_ascii=False, indent=1) + "\n")
    print(json.dumps(result, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
