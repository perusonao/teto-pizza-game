#!/usr/bin/env python3
"""Post-W1 Runtime Recipe Expansion -- Wave 2 Fresh Design: candidate classifier.

Docs/data/tools only. Reads (never writes) the Phase-1 172 matrix, the Phase-2 101-target unlock
matrix and the production runtime sources (src/data/recipes.ts, ingredients.ts,
discoveryCatalog.ts, recipeSauceProfiles.ts, cookingProfiles.ts, ingredientTaxonomy.ts) and writes:

  docs/design/data/TETO_WAVE2_RUNTIME-RECIPE_CANDIDATES.json   (machine-readable, deterministic)

Every one of the 172 evidence rows gets exactly one class:

  A  current mechanics only: every ingredient and every sauce already exists in the runtime, no
     required capability, a sauce layer the Scoring 2.0 reference can score, a round dough.
  B  a small data/profile addition only: new ingredient rows (+ visual, Shop price, taxonomy row)
     and/or a new PAINT sauce ingredient (widens RecipeSauceProfile.ingredientId); no new step.
  C  a Cooking Steps extension on existing seams: post-bake FINISH (LATE_ADDITION post_bake),
     MULTI_SPREAD_LAYER, STEP_ORDER, or a sauce-less recipe (SAUCE step already skippable by
     deriveCoreSteps, but ReferencePizza.sauce / the 52-weight Sauce component / the
     RECIPE_SAUCE_PROFILES Record all assume exactly one sauce).
  D  a new mechanic: DOUGH_VARIANT (identity axis + selector), PAN_BAKE, DOUGH_SHAPE_TARGET,
     ENCLOSE, PREP_STEP, ZONED_PLACEMENT, LAMINATE, FRY_COOK, mid-bake LATE_ADDITION.
  E  evidence insufficient / Owner decision first: Phase-1 BLOCKED rows (unresolved token,
     unspecified base sauce, evidence gap, mechanic interpretation, composition conflict,
     discovery collision, scope question) and rows whose ingredient set collides exactly with a
     runtime recipe while no unlocked dimension separates them.

A row already in the runtime (the 25 RECIPE_DISCOVERY_TARGET_IDS, plus the Phase-2 shipped:<id>
overlay) is RUNTIME and is not a candidate. Nothing is guessed: unknown ingredient categories and
families are emitted as proposals flagged `proposed: true`.

Usage:  python3 tools/progression2_wave2_candidates.py          # regenerate
        python3 tools/progression2_wave2_candidates.py --check  # validate + byte-compare
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MATRIX = ROOT / "docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json"
PHASE2 = ROOT / "docs/design/data/TETO_PROGRESSION2_PHASE2_UNLOCK-MATRIX.json"
ING_CATALOG = ROOT / "data/recipes/ingredient_master_catalog.json"
OUT = ROOT / "docs/design/data/TETO_WAVE2_RUNTIME-RECIPE_CANDIDATES.json"

SRC_RECIPES = ROOT / "src/data/recipes.ts"
SRC_INGREDIENTS = ROOT / "src/data/ingredients.ts"
SRC_DISCOVERY = ROOT / "src/data/discoveryCatalog.ts"
SRC_SAUCE = ROOT / "src/data/recipeSauceProfiles.ts"
SRC_COOKING = ROOT / "src/data/cookingProfiles.ts"
SRC_TAXONOMY = ROOT / "src/data/ingredientTaxonomy.ts"

STARTERS = ["basil", "mozzarella", "tomato-sauce"]  # REC-04 onboarding starters
RUNTIME_PAINT_SAUCES = {"tomato-sauce", "pesto", "olive-oil"}  # RecipeSauceProfile.ingredientId

C_CAPS = {"MULTI_SPREAD_LAYER", "STEP_ORDER"}
D_CAPS = {"DOUGH_VARIANT", "PAN_BAKE", "DOUGH_SHAPE_TARGET", "ENCLOSE", "PREP_STEP",
          "ZONED_PLACEMENT", "LAMINATE", "FRY_COOK"}
EVIDENCE_BLOCKERS = {"UNRESOLVED_INGREDIENT", "BASE_SAUCE_UNSPECIFIED", "EVIDENCE_GAP",
                     "MECHANIC_INTERPRETATION"}
DECISION_BLOCKERS = {"COMPOSITION_CONFLICT_SHIPPED", "COMPOSITION_CONFLICT_CANDIDATE",
                     "DISCOVERY_COLLISION", "SCOPE_QUESTION"}

# Mechanic cost classes (relative; Phase-1 matrix §4 + this design §4). Not a schedule.
MECHANIC_COST = {
    "NEW_INGREDIENT_DATA": 1, "NEW_PAINT_SAUCE_PROFILE": 2, "NO_CUT_PROFILE": 0,
    "SAUCELESS_SCORING": 8, "FINISH_POST_BAKE": 13, "MULTI_SPREAD_LAYER": 13, "STEP_ORDER": 5,
    "DOUGH_VARIANT": 8, "LATE_ADDITION_MID_BAKE": 13, "PAN_BAKE": 13, "DOUGH_SHAPE_TARGET": 21,
    "ENCLOSE": 21, "PREP_STEP": 13, "ZONED_PLACEMENT": 13, "LAMINATE": 21, "FRY_COOK": 21,
}
MECHANIC_CLASS = {
    "NEW_INGREDIENT_DATA": "B", "NEW_PAINT_SAUCE_PROFILE": "B", "NO_CUT_PROFILE": "A",
    "SAUCELESS_SCORING": "C", "FINISH_POST_BAKE": "C", "MULTI_SPREAD_LAYER": "C",
    "STEP_ORDER": "C", "DOUGH_VARIANT": "D", "LATE_ADDITION_MID_BAKE": "D", "PAN_BAKE": "D",
    "DOUGH_SHAPE_TARGET": "D", "ENCLOSE": "D", "PREP_STEP": "D", "ZONED_PLACEMENT": "D",
    "LAMINATE": "D", "FRY_COOK": "D",
}

# Cheese ids among the new canonical ids (the ingredient master catalog covers only 62 ids, so the
# category of the rest is a proposal; sauces come from the Phase-1 spreadLayerIngredientIds).
PROPOSED_CHEESE = {"brick-cheese", "brie", "burrata", "caciocavallo", "cashew-cheese", "catupiry",
                   "cheddar", "cheese-curd", "cotija", "cream-cheese", "feta", "goat-cheese",
                   "grana-padano", "halloumi", "mascarpone", "paneer", "pecorino", "provolone",
                   "ricotta", "ricotta-salata", "swiss-cheese"}
# DH4 attribute family proposals for new topping ids (OD-DH4-4 families). Unlisted -> null.
PROPOSED_FAMILY = {
    "meat": ["beef", "chicken", "chicken-tikka", "ground-beef", "hot-dog", "lamb", "liver-pate",
             "peking-duck", "pork", "prosciutto-crudo", "salami", "spicy-salami", "wurstel",
             "nduja", "speck", "steak"],
    "seafood": ["cod-roe", "eel", "mentaiko", "mussel", "salmon", "salmon-roe", "salt-cod",
                "sardine", "shrimp", "squid", "whitebait", "bonito-flakes", "nori"],
    "vegetable": ["artichoke", "arugula", "asparagus", "avocado", "baked-beans", "bell-pepper",
                  "cabbage", "carrot", "cauliflower", "celery", "chicory", "cucumber", "daikon",
                  "fennel", "french-fries", "friarielli", "green-onion", "green-pepper",
                  "jalapeno", "kimchi", "lettuce", "okra", "palm-heart", "pickles", "porcini",
                  "puntarelle", "radicchio", "red-cabbage", "sauerkraut", "spinach",
                  "sweet-potato", "truffle", "zucchini", "tortilla-chips"],
    "fruit": ["apple", "banana", "blueberry", "fig", "kiwi", "lemon", "lime", "orange",
              "pomegranate", "strawberry"],
    "herb": ["cilantro", "mint", "parsley", "shiso"],
    "spice": ["aji-amarillo", "chili-powder", "cinnamon", "cumin", "paprika-powder",
              "rock-salt", "sansho-pepper", "wasabi", "zaatar", "white-sesame"],
    "other": ["almond", "chocolate", "condensed-milk", "graham-cracker", "marshmallow", "mochi",
              "natto", "pine-nuts", "powdered-sugar", "sunflower-seeds", "walnut"],
}

# Gameplay-experience axes a candidate adds (what the player does/sees differently).
EXPERIENCE_OF = {
    "NO_SAUCE": "SAUCE工程なし（生地→チーズ/具）",
    "WHITE_BASE": "白いベース（非トマト系の塗り）",
    "PESTO_BASE": "ペスト（緑）ベース",
    "OLIVE_OIL_BASE": "オイルベース（PAINT_TEMPORARY）",
    "NEW_SAUCE_COLOR": "新しい色のソース（PAINT）",
    "POST_BAKE_TOPPING": "焼いた後にのせる（FINISH）",
    "MULTI_SPREAD": "2種類を塗る/かける",
    "NO_CUT": "切らずに提供（CUTなし）",
    "CHEESE_ONLY_TOP": "具なし（TOPPING工程なし）",
    "UNUSUAL_SHAPE": "丸以外の形",
    "PAN": "型・天板で焼く",
    "ENCLOSED": "包む/折る",
    "DOUGH_TYPE": "生地の種類を選ぶ",
    "TIMING": "材料を入れるタイミング",
    "SWEET": "デザート系",
}


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def parse_runtime():
    rec_src = read(SRC_RECIPES)
    recipes = {}
    for m in re.finditer(r'\{\s*id: "([a-z0-9-]+)",\s*nameJa: "([^"]+)".*?requiredIngredients: \[(.*?)\],\s*bakeTarget',
                         rec_src, re.S):
        items = re.findall(r'ingredientId: "([a-z0-9-]+)", minCount: (\d+)', m.group(3))
        recipes[m.group(1)] = {"nameJa": m.group(2), "items": {i: int(c) for i, c in items}}
    ing_src = read(SRC_INGREDIENTS)
    ingredients = dict(re.findall(r'id: "([a-z0-9-]+)",\s*category: "(sauce|cheese|topping)"', ing_src))
    disc = dict(re.findall(r'^\s*"?([a-z0-9-]+)"?: "([a-z0-9:-]+)",$', read(SRC_DISCOVERY), re.M))
    disc = {k: v for k, v in disc.items() if k in recipes}
    cut_block = re.search(r"CUT_ELIGIBLE_RECIPE_IDS[^\[]*\[(.*?)\]\);", read(SRC_COOKING), re.S).group(1)
    cut = set(re.findall(r'^\s*"([a-z0-9-]+)",', cut_block, re.M))
    tax = dict(re.findall(r'\["([a-z0-9-]+)", "([a-z]+)"\]', read(SRC_TAXONOMY)))
    sauce_union = set(re.findall(r'"(tomato-sauce|pesto|olive-oil)"', read(SRC_SAUCE).split("interaction:")[0]))
    return recipes, ingredients, disc, cut, tax, sauce_union


def reachable(pop, owned):
    return {r for r, items in pop.items() if set(items) <= owned}


def append_only_ladder(base_pop, pop):
    """Prefix-preserving alternative: the shipped W1 ladder stays steps 1..24 unchanged and the
    same REC-04 key-recipe rule runs only over what W1 does not already make available."""
    owned = set(STARTERS) | {i for items in base_pop.values() for i in items}
    return key_recipe_ladder({r: v for r, v in pop.items() if r not in base_pop}, sorted(owned))


def key_recipe_ladder(pop, starters=STARTERS):
    """Python mirror of src/logic/discoveryLadder.ts buildKeyRecipeLadder (REC-04 rule)."""
    owned = set(starters)
    steps = []
    remaining = [r for r in sorted(pop) if not set(pop[r]) <= owned]
    while remaining:
        before = reachable(pop, owned)
        best = None
        for r in remaining:
            missing = sorted(set(i for i in pop[r] if i not in owned))
            after = reachable(pop, owned | set(missing))
            gain = len(after - before)
            reuse = sum(1 for x in pop if not set(pop[x]) <= owned for i in missing if i in pop[x])
            key = (len(missing), -gain, -reuse, r)
            if best is None or key < best[0]:
                best = (key, r, missing)
        _, r, missing = best
        owned |= set(missing)
        now = reachable(pop, owned)
        steps.append({"ingredientIds": missing, "keyRecipeId": r, "newlyReachable": sorted(now - before)})
        remaining = [x for x in remaining if not set(pop[x]) <= owned]
    return steps


def family_of(i, tax):
    if i in tax:
        return tax[i], False
    for fam, ids in PROPOSED_FAMILY.items():
        if i in ids:
            return fam, True
    return None, True


def main(check: bool) -> int:
    matrix = json.loads(read(MATRIX))
    phase2 = json.loads(read(PHASE2))
    catalog = {x["id"]: x for x in json.loads(read(ING_CATALOG))["ingredients"]}
    recipes, ingredients, disc, cut, tax, sauce_union = parse_runtime()
    errors = []
    if len(recipes) != 25:
        errors.append(f"runtime recipes parsed {len(recipes)} != 25")
    if len(ingredients) != 29:
        errors.append(f"runtime ingredients parsed {len(ingredients)} != 29")
    if set(disc) != set(recipes):
        errors.append("discovery target ids do not cover every runtime recipe")
    if sauce_union != RUNTIME_PAINT_SAUCES:
        errors.append(f"RecipeSauceProfile.ingredientId union drifted: {sorted(sauce_union)}")

    spread_ids = set(matrix["spreadLayerIngredientIds"])
    runtime_evidence = {v for v in disc.values() if not v.startswith("shipped:")}
    runtime_sets = {r: frozenset(v["items"]) for r, v in recipes.items()}
    set_to_runtime = defaultdict(list)
    for r, s in runtime_sets.items():
        set_to_runtime[s].append(r)
    targets = {t["targetId"]: t for t in phase2["targets"]["SHIPPED_KEEP"]}
    phase2_class = {r["evidenceId"]: r for r in phase2["rowClassification"]}

    def category(i):
        if i in ingredients:
            return ingredients[i], False
        if i in catalog:
            return catalog[i]["category"], False
        if i in spread_ids:
            return "sauce", True
        if i in PROPOSED_CHEESE:
            return "cheese", True
        return "topping", True

    rows_out = []
    for row in matrix["rows"]:
        eid = row["evidenceId"]
        ing = row["ingredients"]
        idset = ing["identityIngredientSet"]
        items = sorted(set(idset or ing["canonicalIngredientIds"] or []))
        blockers = sorted({b["type"] for b in row["blockers"]})
        caps = list(row["requiredCapabilities"])
        late_modes = sorted({e.get("mode") for e in row["mechanicEvidence"]
                             if e["capability"] == "LATE_ADDITION" and e["strength"] in matrix["requiredStrengths"]})
        late_ings = sorted({i for e in row["mechanicEvidence"] if e["capability"] == "LATE_ADDITION"
                            and e["strength"] in matrix["requiredStrengths"] for i in e.get("ingredients") or []})
        sauces = sorted(i for i in items if category(i)[0] == "sauce")
        new_ings = sorted(i for i in items if i not in ingredients)
        new_sauces = sorted(i for i in sauces if i not in RUNTIME_PAINT_SAUCES)
        dough = row["dough"]
        cut_behavior = row["cutServe"]["behavior"]

        mechanics = []
        if new_ings:
            mechanics.append("NEW_INGREDIENT_DATA")
        if new_sauces:
            mechanics.append("NEW_PAINT_SAUCE_PROFILE")
        sauce_none = row["sauceBase"].get("status") == "none"
        if sauce_none and not sauces:
            mechanics.append("SAUCELESS_SCORING")
        for c in caps:
            if c == "LATE_ADDITION":
                if "post_bake" in late_modes:
                    mechanics.append("FINISH_POST_BAKE")
                if "mid_bake" in late_modes or not late_modes:
                    mechanics.append("LATE_ADDITION_MID_BAKE")
            else:
                mechanics.append(c)
        # CUT: evidence-backed round dough only (New Haven precedent, REC-02 / 35bc937 Q3).
        if cut_behavior == "serve-whole-no-cut" or dough["class"] == "unknown":
            cut_profile = "NONE"
            mechanics.append("NO_CUT_PROFILE")
        elif cut_behavior == "shape-aware-cut-required":
            cut_profile = "SHAPE_AWARE_REQUIRED"
        elif cut_behavior == "existing-round-cut-optional":
            cut_profile = "STANDARD_6"
        else:
            cut_profile = "UNSPECIFIED"
        mechanics = sorted(set(mechanics), key=lambda m: (MECHANIC_COST[m], m))

        exact_runtime = sorted(set_to_runtime.get(frozenset(items), [])) if idset else []
        near = []
        if idset:
            s = set(items)
            for r, rs in runtime_sets.items():
                if s != rs and (len(s ^ rs) == 1):
                    near.append(r)
        nondefault_axes = sorted(k for k, v in (targets.get(eid, {}).get("identityDimensions") or {}).items()
                                 if v not in (None, "standard", "round", "bake", False, [], ))

        if eid in runtime_evidence:
            cls, sub = "RUNTIME", "SHIPPED_IN_W1_OR_EARLIER"
        elif blockers:
            ev = [b for b in blockers if b in EVIDENCE_BLOCKERS]
            cls, sub = "E", ("E_EVIDENCE" if ev else "E_OWNER_DECISION")
        elif exact_runtime and not caps:
            cls, sub = "E", "E_RUNTIME_SET_COLLISION"
        else:
            classes = [MECHANIC_CLASS[m] for m in mechanics] or ["A"]
            cls = max(classes)
            sub = cls
        if cls in ("A", "B", "C", "D") and eid not in targets:
            errors.append(f"{eid}: decision-ready class {cls} but not a Phase-2 target")

        experience = set()
        if sauce_none and not sauces:
            experience.add("NO_SAUCE")
        if "pesto" in sauces:
            experience.add("PESTO_BASE")
        if "olive-oil" in sauces:
            experience.add("OLIVE_OIL_BASE")
        if any(s in ("fresh-cream-sauce", "fromage-blanc-sauce", "mayo", "yogurt-sauce", "tahini") for s in sauces):
            experience.add("WHITE_BASE")
        elif new_sauces:
            experience.add("NEW_SAUCE_COLOR")
        if "FINISH_POST_BAKE" in mechanics:
            experience.add("POST_BAKE_TOPPING")
        if "LATE_ADDITION_MID_BAKE" in mechanics:
            experience.add("TIMING")
        if "MULTI_SPREAD_LAYER" in mechanics or len(sauces) > 1:
            experience.add("MULTI_SPREAD")
        if cut_profile == "NONE":
            experience.add("NO_CUT")
        if items and not any(category(i)[0] == "topping" for i in items):
            experience.add("CHEESE_ONLY_TOP")
        if "DOUGH_SHAPE_TARGET" in caps or dough["shape"] not in ("round",):
            experience.add("UNUSUAL_SHAPE")
        if "PAN_BAKE" in caps:
            experience.add("PAN")
        if "ENCLOSE" in caps or "LAMINATE" in caps:
            experience.add("ENCLOSED")
        if "DOUGH_VARIANT" in caps:
            experience.add("DOUGH_TYPE")
        if row["sauceBase"].get("sauceFamily") == "デザート" or any(i in ("nutella-spread", "chocolate", "marshmallow", "powdered-sugar") for i in items):
            experience.add("SWEET")

        new_topping_tax = []
        for i in new_ings:
            cat, cat_prop = category(i)
            fam, fam_prop = family_of(i, tax) if cat == "topping" else (None, False)
            new_topping_tax.append({"ingredientId": i, "category": cat, "categoryProposed": cat_prop,
                                    "attributeFamily": fam, "familyProposed": fam_prop if cat == "topping" else False,
                                    "inIngredientMasterCatalog": i in catalog})
        topping_types = sum(1 for i in items if category(i)[0] in ("topping", "cheese"))
        ambiguity = ("HIGH_EXACT_RUNTIME_SET" if exact_runtime else
                     "MEDIUM_ONE_INGREDIENT_FROM_RUNTIME" if near else "LOW")
        tests = ["recipes.test.ts", "discoveryCatalog.test.ts (Record entry + Phase-2 parity)",
                 "discoveryLadder.test.ts (population regenerated)", "referencePizza.w1.test.ts-style fixture",
                 "recipeSauceProfiles.test.ts (Record entry)", "cookingProfiles.test.ts (CUT allowlist decision)",
                 "e2e counts (/25) + Layout Contract LC-5 grid", "deductionHint.audit.test.ts (k>=2 population)"]
        if new_ings:
            tests += ["ingredients.test.ts", "ingredientTaxonomy coverage (topping family rows)",
                      "materialShop / economySimulation (new price tier)", "visual: ingredient art (Human Visual)"]
        for m in mechanics:
            if MECHANIC_CLASS[m] in ("C", "D") or m == "NEW_PAINT_SAUCE_PROFILE":
                tests.append(f"mechanic suite: {m}")
        rows_out.append({
            "evidenceId": eid,
            "canonicalCandidateId": row["canonicalCandidateId"],
            "nameJa": row["nameJa"],
            "class": cls,
            "subclass": sub,
            "isPhase2Target": eid in targets,
            "phase1Status": row["productDecisionStatus"],
            "phase2Tier": phase2_class.get(eid, {}).get("tier"),
            "blockers": blockers,
            "phase1ReviewItems": sorted({f"{x['type']}:{x['ref']}" for x in row["reviewItems"]}),
            "ingredients": items,
            "unresolvedTokens": ing["unresolvedTokens"],
            "sauces": sauces,
            "newIngredients": new_ings,
            "newSauces": new_sauces,
            "requiredCapabilities": caps,
            "lateAddition": {"modes": late_modes, "ingredients": late_ings},
            "requiredMechanics": mechanics,
            "implementationCostPoints": sum(MECHANIC_COST[m] for m in mechanics) + len(new_ings),
            "cutProfile": cut_profile,
            "dough": {"class": dough["class"], "variant": dough["variant"], "shape": dough["shape"], "form": dough["form"]},
            "nonDefaultIdentityAxes": nondefault_axes,
            "discoveryAmbiguity": {"level": ambiguity, "exactRuntimeSetMatch": exact_runtime,
                                   "oneIngredientFromRuntime": sorted(near)},
            "taxonomyImpact": new_topping_tax,
            "pieceTypeCount": topping_types,
            "palettePressure": "OVER_6_TYPES" if len(items) > 6 else "OK",
            "experienceAxes": sorted(experience),
            "testImpact": tests,
        })

    by_id = {r["evidenceId"]: r for r in rows_out}
    # Candidate-vs-candidate exact collisions (any class) -> flag.
    groups = defaultdict(list)
    for r in rows_out:
        if r["class"] != "RUNTIME" and r["ingredients"] and not r["unresolvedTokens"]:
            groups[tuple(r["ingredients"])].append(r["evidenceId"])
    cand_collisions = sorted([sorted(v) for v in groups.values() if len(v) > 1])
    for grp in cand_collisions:
        for e in grp:
            by_id[e]["discoveryAmbiguity"]["exactCandidateSetMatch"] = [x for x in grp if x != e]

    counts = Counter(r["class"] for r in rows_out)
    sub_counts = Counter(r["subclass"] for r in rows_out)

    # Wave options (Owner comparison; none is adopted here).
    def pick(ids):
        return [by_id[i] for i in ids]

    focus = {}
    for key, pred in {
        "no-sauce": lambda r: "NO_SAUCE" in r["experienceAxes"],
        "white-sauce": lambda r: "WHITE_BASE" in r["experienceAxes"] or any("ホワイト" in t for t in r["unresolvedTokens"]) or "ホワイト" in (matrix_row(matrix, r["evidenceId"])["sauceBase"].get("sauceFamily") or ""),
        "pesto": lambda r: "PESTO_BASE" in r["experienceAxes"],
        "olive-oil": lambda r: "OLIVE_OIL_BASE" in r["experienceAxes"],
        "post-bake-topping": lambda r: "FINISH_POST_BAKE" in r["requiredMechanics"],
        "multi-spread": lambda r: "MULTI_SPREAD" in r["experienceAxes"],
        "unusual-shape": lambda r: "UNUSUAL_SHAPE" in r["experienceAxes"],
        "pan-boat-piadina": lambda r: "PAN" in r["experienceAxes"] or r["dough"]["form"] not in ("open-round",) or r["dough"]["variant"] in ("piadina", "flatbread") or "ピアディーナ" in r["nameJa"] or "ボート" in r["nameJa"],
        "no-cut": lambda r: r["cutProfile"] == "NONE",
        "ingredient-timing": lambda r: bool(r["lateAddition"]["modes"]) or "PREP_STEP" in r["requiredCapabilities"] or "STEP_ORDER" in r["requiredCapabilities"],
    }.items():
        hits = [r for r in rows_out if r["class"] != "RUNTIME" and pred(r)]
        focus[key] = {
            "count": len(hits),
            "byClass": dict(sorted(Counter(r["class"] for r in hits).items())),
            "rows": [{"evidenceId": r["evidenceId"], "nameJa": r["nameJa"], "class": r["class"],
                      "subclass": r["subclass"], "requiredMechanics": r["requiredMechanics"],
                      "blockers": r["blockers"]} for r in hits],
        }
    runtime_now = {
        "no-sauce": 0, "white-sauce": 0,
        "pesto": sum(1 for v in recipes.values() if "pesto" in v["items"]),
        "olive-oil": sum(1 for v in recipes.values() if "olive-oil" in v["items"]),
        "post-bake-topping": 0, "multi-spread": 0, "unusual-shape": 0, "pan-boat-piadina": 0,
        "no-cut": 25 - len(cut), "ingredient-timing": 0,
    }
    for k in focus:
        focus[k]["runtimeToday"] = runtime_now[k]

    options = build_options(by_id, recipes)
    for opt in options:
        opt.update(evaluate_option(opt, by_id, recipes, ingredients, tax))

    out = {
        "schemaVersion": "teto-wave2-candidates/1",
        "generatedBy": "tools/progression2_wave2_candidates.py",
        "scope": "Docs/data/tools only. No src/e2e/CSS change, no runtime recipe added, no production set decided.",
        "inputs": [str(p.relative_to(ROOT)) for p in (MATRIX, PHASE2, ING_CATALOG, SRC_RECIPES, SRC_INGREDIENTS,
                                                     SRC_DISCOVERY, SRC_SAUCE, SRC_COOKING, SRC_TAXONOMY)],
        "runtimeBaseline": {
            "recipeCount": len(recipes), "ingredientCount": len(ingredients),
            "paintSauces": sorted(RUNTIME_PAINT_SAUCES), "cutEligible": len(cut),
            "noCutRecipes": sorted(set(recipes) - cut),
            "taxonomyToppingRows": len(tax),
            "currentLadderSteps": len(key_recipe_ladder({r: v["items"] for r, v in recipes.items()})),
        },
        "classDefinitions": {
            "A": "current mechanics only (existing ingredients + existing sauce profile; NO_CUT allowed)",
            "B": "small data/profile addition (new ingredient rows, new PAINT sauce profile)",
            "C": "Cooking Steps extension on existing seams (FINISH post-bake, MULTI_SPREAD_LAYER, STEP_ORDER, sauce-less scoring)",
            "D": "new mechanic (DOUGH_VARIANT, PAN_BAKE, DOUGH_SHAPE_TARGET, ENCLOSE, PREP_STEP, ZONED_PLACEMENT, LAMINATE, FRY_COOK, mid-bake)",
            "E": "evidence insufficient or Owner decision first (E_EVIDENCE / E_OWNER_DECISION / E_RUNTIME_SET_COLLISION)",
            "RUNTIME": "already one of the 25 runtime recipes",
        },
        "mechanicCostPoints": MECHANIC_COST,
        "mechanicClass": MECHANIC_CLASS,
        "summary": {"byClass": dict(sorted(counts.items())), "bySubclass": dict(sorted(sub_counts.items())),
                    "candidateExactSetCollisions": cand_collisions},
        "focusChecks": focus,
        "waveOptions": options,
        "rows": rows_out,
    }
    text = json.dumps(out, ensure_ascii=False, indent=1) + "\n"
    # Validation
    if len(rows_out) != 172:
        errors.append("rows != 172")
    if counts["RUNTIME"] != 11:
        errors.append(f"RUNTIME rows {counts['RUNTIME']} != 11 (tonno + 10 W1 PIZZA DB rows)")
    for opt in options:
        for e in opt["recipeEvidenceIds"]:
            if by_id[e]["class"] not in ("A", "B", "C", "D"):
                errors.append(f"{opt['id']}: {e} is class {by_id[e]['class']}")
        if opt["evaluation"]["exactSetCollisionsInPopulation"]:
            errors.append(f"{opt['id']}: exact-set collision {opt['evaluation']['exactSetCollisionsInPopulation']}")
    if errors:
        print("\n".join(errors))
        return 1
    if check:
        if not OUT.exists() or OUT.read_text(encoding="utf-8") != text:
            print("committed JSON differs from regeneration")
            return 1
        print("Wave 2 candidates: all validations passed; JSON byte-identical.")
    else:
        OUT.write_text(text, encoding="utf-8")
        print(f"wrote {OUT.relative_to(ROOT)}")
    print("byClass", dict(sorted(counts.items())), "bySubclass", dict(sorted(sub_counts.items())))
    for opt in options:
        ev = opt["evaluation"]
        print(opt["id"], len(opt["recipeEvidenceIds"]), "newIng", ev["newIngredientCount"],
              "steps+", ev["ladderStepsAdded"], "reorder", ev["existingLadderReordered"],
              "cost", ev["implementationCostPoints"], "exp", ev["newExperienceAxes"])
    return 0


_MATRIX_CACHE = {}


def matrix_row(matrix, eid):
    if not _MATRIX_CACHE:
        _MATRIX_CACHE.update({r["evidenceId"]: r for r in matrix["rows"]})
    return _MATRIX_CACHE[eid]


# ---------------------------------------------------------------------------------------------
# Wave options. Selection lists are authored in WAVE_OPTION_SPECS (docs), then evaluated here.
# ---------------------------------------------------------------------------------------------
WAVE_OPTION_SPECS = json.loads((Path(__file__).resolve().parent / "wave2_option_specs.json").read_text(encoding="utf-8"))


def build_options(by_id, recipes):
    opts = []
    for spec in WAVE_OPTION_SPECS["options"]:
        opts.append({k: spec[k] for k in ("id", "title", "thesis", "mechanicsIntroduced", "recipeEvidenceIds")})
    return opts


def evaluate_option(opt, by_id, recipes, ingredients, tax):
    base_pop = {r: sorted(v["items"]) for r, v in recipes.items()}
    base_ladder = key_recipe_ladder(base_pop)
    pop = dict(base_pop)
    rows = [by_id[e] for e in opt["recipeEvidenceIds"]]
    for r in rows:
        pop[r["canonicalCandidateId"]] = r["ingredients"]
    ladder = key_recipe_ladder(pop)
    base_keys = [(tuple(s["ingredientIds"]), s["keyRecipeId"]) for s in base_ladder]
    new_keys = [(tuple(s["ingredientIds"]), s["keyRecipeId"]) for s in ladder]
    prefix_same = base_keys == [k for k in new_keys if k[1] in base_pop][: len(base_keys)]
    appended = append_only_ladder(base_pop, pop)
    free = sorted(r["canonicalCandidateId"] for r in rows if not r["newIngredients"])
    sets = defaultdict(list)
    for r, items in pop.items():
        sets[tuple(sorted(items))].append(r)
    coll = sorted(sorted(v) for v in sets.values() if len(v) > 1)
    new_ings = sorted({i for r in rows for i in r["newIngredients"]})
    mechs = sorted({m for r in rows for m in r["requiredMechanics"]}, key=lambda m: (MECHANIC_COST[m], m))
    exp_before = set()
    exp_after = sorted({a for r in rows for a in r["experienceAxes"]})
    runtime_axes = {"PESTO_BASE", "OLIVE_OIL_BASE", "NO_CUT"}
    mech_cost = sum(MECHANIC_COST[m] for m in mechs if MECHANIC_CLASS[m] in ("C", "D"))
    content_cost = len(rows) * 2 + len(new_ings) * 2 + (2 if "NEW_PAINT_SAUCE_PROFILE" in mechs else 0)
    new_topping_rows = [i for r in rows for t in r["taxonomyImpact"] if (i := t["ingredientId"]) and t["category"] == "topping"]
    fam_counts = Counter(tax.values())
    for t in {t["ingredientId"]: t for r in rows for t in r["taxonomyImpact"]}.values():
        if t["category"] == "topping" and t["attributeFamily"]:
            fam_counts[t["attributeFamily"]] += 1
    classes = Counter(r["class"] for r in rows)
    return {"evaluation": {
        "recipeCountAfter": len(pop),
        "byClass": dict(sorted(classes.items())),
        "recipes": [{"evidenceId": r["evidenceId"], "proposedRuntimeId": r["canonicalCandidateId"], "nameJa": r["nameJa"],
                     "class": r["class"], "ingredients": r["ingredients"], "requiredMechanics": r["requiredMechanics"],
                     "cutProfile": r["cutProfile"], "discoveryAmbiguity": r["discoveryAmbiguity"]["level"],
                     "experienceAxes": r["experienceAxes"]} for r in rows],
        "newIngredients": new_ings,
        "newIngredientCount": len(new_ings),
        "newToppingTaxonomyRows": sorted(set(new_topping_rows)),
        "taxonomyFamilySizesAfter": dict(sorted(fam_counts.items())),
        "requiredMechanics": mechs,
        "ladderStepsBefore": len(base_ladder),
        "ladderStepsAfter": len(ladder),
        "ladderStepsAdded": len(ladder) - len(base_ladder),
        "existingLadderReordered": not prefix_same,
        "ladder": [{"step": n + 1, **s} for n, s in enumerate(ladder)],
        "appendOnlyLadder": [{"step": len(base_ladder) + n + 1, **s} for n, s in enumerate(appended)],
        "appendOnlyStepsAdded": len(appended),
        "recipesWithoutOwnLadderStep": free,
        "exactSetCollisionsInPopulation": coll,
        "discoveryAmbiguityCounts": dict(sorted(Counter(r["discoveryAmbiguity"]["level"] for r in rows).items())),
        "newExperienceAxes": sorted(set(exp_after) - runtime_axes),
        "implementationCostPoints": mech_cost + content_cost,
        "costBreakdown": {"mechanicPoints": mech_cost, "contentPoints": content_cost},
        "testImpactSummary": sorted({t for r in rows for t in r["testImpact"]}),
    }}


if __name__ == "__main__":
    sys.exit(main("--check" in sys.argv))
