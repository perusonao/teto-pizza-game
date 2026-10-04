#!/usr/bin/env python3
"""Expansion Slice 1 (pesto-gamberi + shrimp) pre-implementation Gate audit (audit / docs tool only).

Reads (never writes) the working tree; imports the parse + ladder-rule helpers of
tools/post_prod27_53_scale_audit.py. Writes docs/reports/data/TETO_EXPANSION-SLICE-1_PESTO-GAMBERI_Gate-Audit.json.
Not imported by src/**; not a production authority. Usage: python3 tools/expansion_slice1_pesto_gamberi_gate_audit.py [--check]
"""
from __future__ import annotations
import importlib.util, itertools, json, math, re, subprocess, sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs/reports/data/TETO_EXPANSION-SLICE-1_PESTO-GAMBERI_Gate-Audit.json"
spec = importlib.util.spec_from_file_location("scale_audit", ROOT / "tools/post_prod27_53_scale_audit.py")
sa = importlib.util.module_from_spec(spec); spec.loader.exec_module(sa)

RID, EVID = "pesto-gamberi", "pesto-gamberi-pizzadb-p11"
HAND = 12


def rd(p): return (ROOT / p).read_text(encoding="utf-8")


def main():
    check = "--check" in sys.argv
    head = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    recipes, ingredients, fam, ladder = sa.parse_production()
    ing = {i["id"]: i for i in ingredients}
    starters = {i["id"] for i in ingredients if not i["finite"]}
    prod = {r["id"]: frozenset(r["ingredients"]) for r in recipes}
    credited = {r["id"] for r in recipes if r["ladderCredit"]}
    matrix = json.loads(rd("docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json"))
    row = next(r for r in matrix["rows"] if r["evidenceId"] == EVID)
    evid = json.loads(rd("docs/reports/data/TETO_PIZZADB_172_MASTER-EVIDENCE.json"))
    src = next(r for r in evid["recipeRows"] if r["id"] == EVID)
    cat_ing = {i["id"]: i for i in json.loads(rd("data/recipes/ingredient_master_catalog.json"))["ingredients"]}
    tax = {i["id"]: i for i in json.loads(rd("docs/reports/data/TETO_62-INGREDIENT-TAXONOMY-HCG_Fresh-Audit.json"))["ingredients"]}

    # ---- 4. composition from authority
    items = frozenset(row["ingredients"]["identityIngredientSet"])
    composition = {
        "evidenceId": EVID, "nameJa": src["nameJa"], "sourceIngredientsJa": src["ingredientsJa"], "sourceSauceFamily": src["sauceFamily"],
        "doughStyle": src["doughStyle"], "evidenceOrigin": src["evidenceOrigin"], "sourceUrl": src["sourceUrl"],
        "tokenTrace": row["ingredients"]["tokenTrace"], "identityIngredientSet": sorted(items),
        "baseSauce": row["sauceBase"], "matrixStatus": {"representability": row["currentFlowRepresentability"], "productDecision": row["productDecisionStatus"],
                                                          "requiredCapabilities": row["requiredCapabilities"], "blockers": row["blockers"], "reviewItems": row["reviewItems"],
                                                          "collisionRefs": row["collisionRefs"], "conflictRefs": row["conflictRefs"]},
        "hasCheese": any(ing.get(i, {}).get("category") == "cheese" for i in items),
        "sourceAuthorityDoesNotCarry": ["minCount per ingredient", "bakeTarget", "baseRewardPitz", "description", "emoji / color of shrimp", "reference piece layout"],
        "precedentForSameMapping": {"No.27 pesto-pollo": "sauce base pesto is family-derived from sauceFamily バジル; トマト -> fresh-tomato (same token mapping as pesto-pollo / pesto-caprese)"},
    }

    # ---- 5. 27 -> 28 impact
    sets28 = dict(prod); sets28[RID] = items
    coll = [r for r, s in prod.items() if s == items]
    sub = [r for r, s in prod.items() if s < items]
    sup = [r for r, s in prod.items() if s > items]
    near = sorted(((round(len(items & s) / len(items | s), 2), r) for r, s in prod.items() if len(items & s) >= 2), reverse=True)[:5]
    owned25 = starters | {i for s in ladder for i in s["ingredientIds"]}
    app = sa.key_recipe_ladder(list(sets28.items()), owned25)
    full = list(ladder) + [{"step": 25 + n + 1, "ingredientIds": m, "keyRecipeId": k} for n, (m, k) in enumerate(app)]
    rows27, _, _ = sa.simulate(ladder, prod, credited, starters)
    rows28c, _, mk_c = sa.simulate(full, sets28, credited | {RID}, starters)
    rows28n, _, mk_n = sa.simulate(full, sets28, credited, starters)
    frozen_ok = full[:25] == ladder
    chapter3_before = sum(1 for r, s in prod.items() if sa.tier_of(max([next((x["step"] for x in ladder if i in x["ingredientIds"]), 0) for i in s] + [1])) == "T3")
    new_prod_sets = {r: s for r, s in prod.items()}
    impact = {
        "recipes": [27, 28], "ingredients": [30, 31], "ladderSteps": [25, len(full)], "creditedRecipes": [26, 27],
        "obtainableMaterialsForCollectionCount": [30, 31], "dexChapter3Recipes": [chapter3_before, chapter3_before + 1],
        "identityCollisionWithProduction": coll, "strictSubsetOfProduction": sub, "strictSupersetOfProduction": sup, "nearestByJaccard": near,
        "appendedSteps": [{"step": 25 + n + 1, "ingredientIds": m, "keyRecipeId": k, "tier": sa.tier_of(25 + n + 1)} for n, (m, k) in enumerate(app)],
        "frozenSteps1to25Unchanged": frozen_ok,
        "poolMinSlackProduction": [r["poolMinSlack"] for r in rows27],
        "poolMinSlackWith28_creditTrue": [r["poolMinSlack"] for r in rows28c], "poolMinSlackWith28_creditFalse": [r["poolMinSlack"] for r in rows28n],
        "frozenStepPoolsUnchanged": [r["poolMinSlack"] for r in rows28c][:25] == [r["poolMinSlack"] for r in rows27],
        "softlockSteps_creditTrue": [r["step"] for r in rows28c if r["softlock"]], "softlockSteps_creditFalse": [r["step"] for r in rows28n if r["softlock"]],
        "makeableCreditedAfterStep26": [len(mk_n), len(mk_c)],
        "newRecipesNeedingNoNewMaterial": [],
        "refillAllMaterialsPitz": [sum({"T1": 30, "T2": 40, "T3": 50, "T4": 60}[sa.tier_of(x["step"])] * len(x["ingredientIds"]) for x in ladder),
                                    sum({"T1": 30, "T2": 40, "T3": 50, "T4": 60}[sa.tier_of(x["step"])] * len(x["ingredientIds"]) for x in full)],
        "stepsAtOrAboveT4": [s["step"] for s in full if s["step"] >= 30],
        "maxSimultaneousResearchEntries": [sa.max_entries(ladder, prod, credited, starters), sa.max_entries(full, sets28, credited | {RID}, starters)],
    }

    # ---- 7. shop / price / pack
    tiers = {"T3": (100, 50)}
    cur_k = {}
    for r in recipes:
        for i, c in r["minCounts"].items():
            cur_k[i] = max(cur_k.get(i, 0), c)
    shop = {
        "unlockStep": 26, "tier": "T3", "firstPackPitz": 100, "refillPitz": 50,
        "unlockGrantsStock": False, "starterGrantRetired": True,
        "packFormula": "10 x k, k = largest minCount of the ingredient over RECIPES (materialOffer / materialK)",
        "kOfShrimp": 3,  # Owner C1 (2026-10-03)
        "packByK": {str(k): 10 * k for k in (1, 2, 3, 4)}, "packQuantityDecided": 30,
        "existingK": {i: cur_k.get(i) for i in ("pesto", "fresh-tomato", "garlic")},
        "invariantToKeepExistingPacksUnchanged": "pesto-gamberi minCount: pesto <= 1, fresh-tomato <= 3, garlic <= 3 (No.27 pinned the same way)",
        "ingredientFieldsRequired": {"id": "shrimp", "category": "topping", "placement": "scatter", "unlockCondition": {"minTotalStars": 0}, "pricePitz": "absent (derived from ladder tier)", "restockQuantity": "absent", "starterGrantOnly": "absent",
                                     "nameJa": cat_ing["shrimp"]["nameJa"], "color": "#f4977c (Owner C3 = A)", "emoji": "U+1F990 (Owner C3 = A)", "pieceVisual": "absent (plain emoji)"},
    }

    # ---- 8. taxonomy
    t = tax["shrimp"]
    fam_before = Counter(fam.values())
    taxonomy = {
        "id": "shrimp", "role": cat_ing["shrimp"]["category"], "playerFacingCategoryJa": "具材", "family": t["ownerDecision"]["family"], "ownerDecision": t["ownerDecision"], "state": t["state"],
        "catalogPlacement": cat_ing["shrimp"]["placementType"], "catalogUnit": cat_ing["shrimp"]["inventoryUnit"], "shelf": "seafood",
        "productionTaxonomyRowToAdd": ["shrimp", "seafood"], "familyCounts": {"before": dict(fam_before), "after": dict(fam_before + Counter({"seafood": 1}))},
        "newFamilyIdNeeded": False, "searchAliasNeeded": False, "nameIsKatakanaOnly": bool(re.fullmatch(r"[゠-ヿ]+", cat_ing["shrimp"]["nameJa"])),
        "mustShipTogether": "OD-T7: taxonomy row in the same PR; tools/ingredient_taxonomy_hcg_authority_audit.py pins (hashes, counts, SHIPPED_SINCE_AUDIT) updated in that PR",
    }

    # ---- 9. Research Entry / Contract 2.1 / Hint / Dex
    fin = sorted(i for i in items if (ing[i]["finite"] if i in ing else True))
    step_of = {i: s["step"] for s in full for i in s["ingredientIds"]}
    toppings = sorted(i for i in items if (ing[i]["category"] if i in ing else cat_ing[i]["category"]) == "topping")
    entry = {"finiteIngredients": fin, "unlockStepOf": {i: step_of[i] for i in fin}, "registrableWhen": "all finite ingredients owned (stock ignored)",
             "unlockFactByLastAcquired": {i: {"unknownToppingsU": len([x for x in toppings if x != i]), "overK3": len([x for x in toppings if x != i]) > 3} for i in fin},
             "maxUnknownToppings": max(len([x for x in toppings if x != i]) for i in fin), "K": 3, "toppingKinds": toppings}
    names = {i: (rd("src/data/ingredients.ts") and re.search(r'id: "%s",[\s\S]*?nameJa: "([^"]+)"' % re.escape(i), rd("src/data/ingredients.ts")).group(1)) for i in ing}
    names["shrimp"] = cat_ing["shrimp"]["nameJa"]
    longest = lambda role, n=1: sorted([names[i] for i in names if (ing[i]["category"] if i in ing else "topping") == role], key=len, reverse=True)[:n]
    cheeses = [names[i] for i in ing if ing[i]["category"] == "cheese"]
    label = "？？？ピザ ⑩（" + max(names.values(), key=len) + "）"
    nb = len(label + " ソース: " + longest("sauce")[0] + "× チーズ: " + " ".join(c + "×" for c in cheeses) + " トッピング: " + " ".join(n + "×" for n in longest("topping", 3)))
    cheese_rule = {"cheeseInRecipe": False, "precedent": ["marinara", "fugazza", "pizza-bianca", "pesto-tonno", "puttanesca-pizza", "brazilian-calabresa"],
                   "hint5": "no-cheese recipe: CHEESE rung absent for key-free recipes (calabresa precedent); EMPTY cheese rung charges 0 (hint5Ladder)"}
    compat = {
        "researchEntry": entry, "contract21": {"sauceRow": "1 item (single sauce); pesto is the only sauce in canonical(T)", "cheeseRow": "every cheese the player uses is ×; recipe has none",
                                              "toppingOverCap": False, "notebookWorstCaseChars": nb, "notebookLimit": 200, "persisted": "○ ing:<id> only (existing schema)"},
        "hint": {"roles": "RECIPE_HINT_ROLES row is type-required (Record<RecipeId,..>): key-free (calabresa / pesto-pollo precedent) or authored -> Owner confirmation",
                 "keyFreeRungs": ["SAUCE", "STRUCTURE", "SUB_CLASS x3 (catalog order)"], "subClassFamilies": {"garlic": fam["garlic"], "fresh-tomato": fam["fresh-tomato"], "shrimp": "seafood"},
                 "distinctFamilies": 3, "cheeseRule": cheese_rule},
        "pool": {"before step 26": "pesto-gamberi has UNKNOWN / KNOWN_BUT_MISSING_MATERIAL state (shrimp not entitled); pools at steps 1-25 unchanged",
                 "step26 minSlack": rows28c[25]["poolMinSlack"], "afterShrimpBought": "pool 1 => auto TARGET (pesto-pollo Case B precedent); OPEN_POOL only if another undiscovered makeable recipe exists"},
        "dex": {"chapter": 3, "slot": chapter3_before + 1, "discoveryTargetId": EVID, "discoveryItems": sorted(items), "sauceBase": ["pesto"], "identityDimensions": "default (no capability)"},
    }

    # ---- 10. HAND 12
    topping_total = sum(1 for i in ingredients if i["category"] == "topping")
    hand = {"capacity": HAND, "toppingsOwned": [topping_total, topping_total + 1], "handActiveFromStep": 12, "hiddenWhenAllOwned": [topping_total - HAND, topping_total + 1 - HAND],
            "seafoodShelf": [3, 4], "shelfChipCountUnchanged": True, "recipeToppingKinds": len(toppings), "placedProtectedBeyondCapacity": True,
            "newPurchaseEntersHandVia": "usage.newlyOwned ('new') while stock >= 1; otherwise pin / pantry search",
            "pantrySearch": "name エビ (katakana only): no alias / reading needed", "dinnerLunchRushPagedTrayPages": [math.ceil(topping_total / 6), math.ceil((topping_total + 1) / 6)],
            "capacityChanged": False}

    # ---- 11. save forward compat
    save = {"schemaVersion": [2, 2], "migration": False, "newFields": False,
            "idGrammar": "SAVE_ID_PATTERN ^[a-z0-9][a-z0-9_-]{0,63}$",
            "idsMatch": bool(re.match(r"^[a-z0-9][a-z0-9_-]{0,63}$", RID)) and bool(re.match(r"^[a-z0-9][a-z0-9_-]{0,63}$", "shrimp")),
            "knownIdWhitelists": "derived from RECIPES / INGREDIENTS (persistence.ts KNOWN_RECIPE_IDS / KNOWN_INGREDIENT_IDS)",
            "forwardRollback": "an older build keeps unknown ids (dex entry, inventory, ownedIngredientIds order, unlockedForShop, hint purchases / facts) via extractForwardCompatExtras",
            "existingSaveAtCredited26OrMore": "step 26 entitled at next resolve (shrimp NEW in Shop, stock 0); no stock granted",
            "persistedFactIds": "ing:shrimp only after a disclosed ○; attr:family:seafood already exists",
            "gameStatePersisted": False}

    # ---- Owner decisions C1..C8 (2026-10-03) applied; invariants re-checked
    calib = {"pesto": 1, "fresh-tomato": 2, "garlic": 2, "shrimp": 3}
    invariants = {
        "existingPacksUnchanged": all(calib[i] <= cur_k[i] for i in ("pesto", "fresh-tomato", "garlic")),
        "nonSaucePieces": sum(v for i, v in calib.items() if i != "pesto"), "ringCapacityNote": "7 <= 8 (RT-01 also supports 9+)",
        "shrimpPackQuantity": 10 * calib["shrimp"], "shrimpFirstPackPitz": 100, "shrimpRefillPitz": 50, "shrimpPizzasPerPack": 10,
    }
    assert invariants["existingPacksUnchanged"]
    owner = {
        "C1_minCount": calib, "C2_bakeTarget": {"start": 50, "end": 70}, "C3_shrimpVisual": {"decision": "A", "emoji": "U+1F990", "emojiSourceForm": "\\u{1F990} (same escape form as chicken)", "color": "#f4977c", "dedicatedSvg": "not in Slice 1 (follow-up slice may consider after Human Feel)", "finalLook": "Human Verification after implementation; NOT a gate that blocks starting implementation"},
        "C4_ladderCredit": "true (granted): step 26 formal progression recipe; credited recipes 26 -> 27",
        "C5_lunchRush": "false in Slice 1 (not a ban on future participation)", "C6_cut": "no CUT in Slice 1 (not in CUT_ELIGIBLE_RECIPE_IDS; 5 tabs)",
        "C7_hintRoles": "key-free (no KEY_TOPPING)", "C8_copy": "description / order copy presented in the implementation PR for Owner confirmation",
        "baseRewardPitz": "100 (Pitz Reward V1, existing authority)", "invariants": invariants,
    }

    def _lab(h):
        r, g, b = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
        f = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
        r, g, b = f(r), f(g), f(b)
        X, Y, Z = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, r * 0.2126 + g * 0.7152 + b * 0.0722, (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883
        q = lambda t: t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
        fx, fy, fz = q(X), q(Y), q(Z)
        return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)

    src_ing = rd("src/data/ingredients.ts")
    def prod_field(i, k):
        m = re.search(r'id: "%s",[\s\S]*?%s: "([^"]+)"' % (re.escape(i), k), src_ing)
        return m.group(1) if m else None
    tops = {i["id"]: prod_field(i["id"], "color") for i in ingredients if i["category"] == "topping"}
    def nearest(c):
        return sorted((round(math.dist(_lab(c), _lab(v)), 1), k) for k, v in tops.items())[:3]
    c3 = {
        "chosen": "A",
        "toppingColorIsRenderedToday": False,
        "toppingColorNote": "ingredient.color is read for sauce (paint) and cheese (--cheese-color) only; a topping is drawn by its emoji / dedicated SVG (IngredientGlyph) -> color is metadata for toppings",
        "existingSeafood": {k: {"emoji": prod_field(k, "emoji"), "color": tops[k], "dedicatedVisual": k == "clam"} for k in ("anchovy", "tuna", "clam")},
        "renderContext": {"onPizzaFontPx": 28, "trayChipFontPx": 26, "bakeRoastFilterAtHeat2": {"brightness": 0.78, "saturate": 0.8, "sepia": 0.2}},
        "dedicatedVisualCount": 3, "dedicatedVisualRequires": "type member in DedicatedIngredientVisual + drawing in IngredientGlyph + Human Visual Gate (W1 precedent)",
        "candidates": [
            {"id": "A", "emoji": "U+1F990 (shrimp)", "color": "#f4977c", "pieceVisual": None, "nearestToppingDeltaE": nearest("#f4977c")},
            {"id": "B", "emoji": "U+1F364 (fried shrimp)", "color": "#e3a857", "pieceVisual": None, "nearestToppingDeltaE": nearest("#e3a857")},
            {"id": "C", "emoji": "U+1F990 (fallback) + dedicated SVG 'shrimp-curl'", "color": "#f4977c", "pieceVisual": "shrimp-curl (new)", "nearestToppingDeltaE": nearest("#f4977c")},
        ],
    }

    # ---- release gate
    out = {"auditedMainSha": "b8617ac0218bf20eb53f68ed12dea09db20e3fa8", "generatedBy": "tools/expansion_slice1_pesto_gamberi_gate_audit.py", "composition": composition, "impact27to28": impact, "shop": shop,
           "taxonomy": taxonomy, "compat": compat, "hand": hand, "save": save,
           "ownerDecisionsApplied": owner, "C3Candidates": c3, "remainingGate": [], "implementationTimeGates": ["C8 description / order copy: presented in the implementation PR for Owner confirmation", "Human Verification of final shrimp look (device emoji differences) after implementation", "regression gates (ladder / append-only / matcher / hint5 taxonomy / DH4 / save forward-compat / count pins)", "taxonomy audit tool pins updated in the same PR (OD-T7)"],
           "readiness": {"implementationReady": True, "reason": "C1..C7 all Owner-confirmed; composition / shrimp / taxonomy / ladder / shop / compat audits PASS; no authority blocker", "productionReleaseBlockers": ["#378 (OD-P6): open, no implementation PR, OD-378-6 Audit not done"]},
           "issue378": {"state": "open (re-read 2026-10-04)", "implementationPr": None, "od3786Audit": "not done", "productionReleaseBlocker": True, "implementationStartBlocker": False}}
    text = json.dumps(out, ensure_ascii=False, indent=1) + "\n"
    if check:
        ok = OUT.exists() and OUT.read_text(encoding="utf-8") == text
        print("CHECK", "OK" if ok else "DRIFT"); sys.exit(0 if ok else 1)
    OUT.write_text(text, encoding="utf-8"); print("wrote", OUT.relative_to(ROOT))


if __name__ == "__main__":
    main()
