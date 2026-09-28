#!/usr/bin/env python3
"""
W2-A Hint 5.0 Role Authoring Review (Owner Review pack). Docs/data/tools only.

NOT an authority. NOT wired into CI. It is NOT the DA-1 implementation.
It decides nothing: every key / sub-order value it prints is a CANDIDATE for the Owner.

Question: for the 9 Owner-approved W2-A recipes, which topping could be the Hint 5.0 key topping
(OD-H5-C1-P) and in which order could the remaining toppings be the SUB_CLASS rungs, so that the
Owner can decide each one?

Inputs are pinned git objects only (never the checkout), so the output does not depend on the
working tree:
  - Hint 5.0 (#292)      recipeHintRoles.ts + design doc @ 5eadb96 (H5-3 head 1ec4253 is its ancestor)
  - Wave 2 W2-A          approved authoring JSON, OD-W2 ledger, W2-A1 taxonomy rows @ 2bc40e4
  - DA-1 Preparation     branch claude/172-da-1-preparation-audit @ e829a17 (reference only)
  - main                 86b48fd (to prove which W2-A rows are NOT on main)

The recipe `requiredIngredients` order is never used to derive a candidate. The description mention
order is printed as reference evidence only, and is not used either.

Usage:
  python3 tools/w2a_hint5_role_authoring_review.py           # writes the JSON and the report
  python3 tools/w2a_hint5_role_authoring_review.py --check   # rebuilds and fails on byte drift
"""
import argparse
import itertools
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_JSON = ROOT / "docs/reports/data/TETO_W2-A_HINT5_ROLE-AUTHORING_REVIEW.json"
OUT_MD = ROOT / "docs/reports/TETO_W2-A_HINT5_ROLE-AUTHORING_REVIEW.md"

PINS = {
    "main": "86b48fd51423a8f76db5398ab88ecfd944e2ae10",
    "hint5Head": "5eadb96",
    "hint5H53": "1ec4253",
    "wave2": "2bc40e41f320f9c46ea6110e9df4d50866325cf3",
    "da1Prep": "e829a17",
    "authorityMatrix": "79873c0",
}


def git_show(rev, path):
    return subprocess.run(["git", "show", f"{rev}:{path}"], cwd=ROOT, check=True, capture_output=True, text=True).stdout


def rev_parse(rev):
    return subprocess.run(["git", "rev-parse", rev], cwd=ROOT, check=True, capture_output=True, text=True).stdout.strip()


# ---------------------------------------------------------------------------------------------
# Hand-authored review content (CANDIDATES). Validated against the pinned data in build().
# keyClass:
#   CLEAR_MAIN  the approved W2-A authoring tags one topping as the primary / name-giving one, and
#               C1-P leaves exactly one non-aroma main. Still an Owner Review item (not authority).
#   CO_EQUAL    the approved W2-A authoring records several co-defining / co-equal toppings, so
#               C1-P does not pick one. The Owner must choose the key (and hence the sub order).
# ---------------------------------------------------------------------------------------------
REVIEW = {
    "vongole": {
        "keyClass": "CLEAR_MAIN",
        "candidates": {
            "clam": "C1-P main (魚介の主役)。名前 vongole = あさり。W2-A A1 の primary。W1 の new-haven-apizza (olive-oil base, clam 3) と同じ構成で、その runtime key も clam。",
            "garlic": "aroma。C1-P は aroma より main を優先するので不採用寄り。",
            "parsley": "aroma / garnish。C1-P は aroma・添え物より main を優先するので不採用寄り。",
        },
        "recommendedKey": "clam",
        "confidence": "high (confirm)",
        "garnishAromaRisk": "garlic / parsley は herb family の aroma。key にすると C1-P に反する。clam はどちらでもない。",
        "sauceCheeseOverlap": "なし。sauce = olive-oil、cheese = なし。clam は topping で、sauce / cheese の情報と重複しない。",
    },
    "flammkuchen": {
        "keyClass": "CO_EQUAL",
        "candidates": {
            "bacon": "meat。W2-A A1 は bacon 3 / onion 2 を採用したが、これは minCount であって Hint role の authority ではない。W1 の breakfast-pizza (bacon key, egg sub) が analog。",
            "onion": "vegetable。W2-A A1 が bacon と並ぶ co-defining topping と記録。W1 の fugazza は onion key (C1a) で、onion を key にした前例はある。",
        },
        "recommendedKey": "bacon",
        "confidence": "low (genuine co-equal; Owner choice)",
        "garnishAromaRisk": "どちらも aroma / garnish ではない (onion は vegetable family で herb / spice ではない)。C1-P はどちらも排除しない。",
        "sauceCheeseOverlap": "なし。sauce = fromage-blanc-sauce、cheese = なし。",
        "recommendationWhy": "弱い推奨。bacon は承認済み minCount が最大 (evidence only)、protein で W1 breakfast-pizza と同型。ただし onion も co-defining と明記されているので、これは Owner 判断。",
    },
    "jamon-serrano-pizza": {
        "keyClass": "CLEAR_MAIN",
        "candidates": {
            "prosciutto-crudo": "C1-P main (protein)。名前 jamón = 生ハム。W2-A A1 の primary (jamón)。",
            "arugula": "leaf の添え物 (supporting)。C1-P は garnish より main を優先するので不採用寄り。",
        },
        "recommendedKey": "prosciutto-crudo",
        "confidence": "high (confirm)",
        "garnishAromaRisk": "arugula は葉物の添え物。key にすると C1-P に反する。prosciutto-crudo は protein main。",
        "sauceCheeseOverlap": "なし。sauce = tomato-sauce、cheese = mozzarella。key は topping。",
        "note": "runtime id は W2-A authoring では `jamon-serrano-pizza` (PIZZA DB evidence id `jamon-serrano-pizza-pizzadb-p7`)。task の `jamon-serrano` と同じ recipe。pinsa-romana と ingredient set が完全一致 (P0-COLL-4, OD-W2-7: DOUGH_VARIANT で後に分離)。pinsa-romana の role はこの review の対象外。",
    },
    "brazilian-calabresa": {
        "keyClass": "CLEAR_MAIN",
        "candidates": {
            "sausage": "C1-P main (calabresa = sausage)。W2-A A1 の primary。W1 の salsiccia (sausage key) が analog。",
            "onion": "supporting vegetable。W2-A A1 は supporting 扱い。",
            "black-olive": "supporting vegetable。W2-A A1 は supporting 扱い。family は HCG watch。",
            "oregano": "aroma (accent, minCount 1)。C1-P は aroma を優先しない。",
        },
        "recommendedKey": "sausage",
        "confidence": "high (confirm)",
        "garnishAromaRisk": "oregano は accent の aroma (herb)。key にすると C1-P に反する。onion / black-olive は supporting で main ではない。sausage は main。",
        "sauceCheeseOverlap": "なし。sauce = tomato-sauce、cheese = なし。",
    },
    "prosciutto-funghi": {
        "keyClass": "CO_EQUAL",
        "candidates": {
            "mushroom": "vegetable。W2-A A1: 'two name-giving toppings' で、'keeps funghi's mushroom 3, so the recipe reads as funghi + prosciutto'。承認済み minCount は mushroom 3 (最大)。W1 funghi の key は mushroom。",
            "prosciutto-crudo": "meat。名前の先頭 (prosciutto e funghi)。W2-A A1 で minCount 2。jamon-serrano の key 候補と同じ ingredient。",
        },
        "recommendedKey": "mushroom",
        "confidence": "low (genuine co-equal; Owner choice)",
        "garnishAromaRisk": "どちらも aroma / garnish ではない。C1-P はどちらも排除しない。",
        "sauceCheeseOverlap": "なし。sauce = tomato-sauce、cheese = mozzarella。",
        "recommendationWhy": "弱い推奨。承認済み authoring は「funghi + prosciutto」と読める形で mushroom 3 を保持している (evidence only)。一方、名前順では prosciutto-crudo が先で、W1 の funghi (key mushroom) との区別も prosciutto-crudo の方が付く。名前順と数量の両基準が食い違うので、これは Owner 判断。",
        "extraConsideration": "key の被り: mushroom は W1 funghi の key と同じ、prosciutto-crudo は jamon-serrano の key 候補と同じ。sauce / cheese rung が先に出るので recipe は区別されるが、どちらを選んでも 1 つの sibling と key が重なる。",
    },
    "pesto-gamberi": {
        "keyClass": "CLEAR_MAIN",
        "candidates": {
            "shrimp": "C1-P main (gamberi = shrimp)。W2-A A1 の primary。W1 の pesto-tonno (pesto base, seafood primary, tuna key) が analog。",
            "fresh-tomato": "supporting vegetable。W1 の pesto-caprese は fresh-tomato key だが、あちらは名前の主役 (caprese)。",
            "garlic": "aroma。C1-P は aroma を優先しない。family は HCG watch。",
        },
        "recommendedKey": "shrimp",
        "confidence": "high (confirm)",
        "garnishAromaRisk": "garlic は aroma (herb)。key にすると C1-P に反する。fresh-tomato は supporting。shrimp は main。",
        "sauceCheeseOverlap": "なし。sauce = pesto、cheese = なし。key は topping。",
    },
    "pesto-vegetariana": {
        "keyClass": "CO_EQUAL",
        "candidates": {
            "eggplant": "vegetable。3 つの co-equal vegetable の 1 つ。W1 の melanzane-pizza / parmigiana-pizza の key が eggplant。3 つの中で main の catalog に既にある ingredient (zucchini / bell-pepper は W2-A1 branch のみ)。",
            "zucchini": "vegetable。3 つの co-equal vegetable の 1 つ。新規 ingredient (W2-A1 branch のみ)。",
            "bell-pepper": "vegetable。3 つの co-equal vegetable の 1 つ。新規 ingredient (W2-A1 branch のみ)。",
        },
        "recommendedKey": "eggplant",
        "confidence": "low (genuine co-equal; Owner choice)",
        "garnishAromaRisk": "3 つとも vegetable family で aroma / garnish ではない。C1-P はどれも排除しない。",
        "sauceCheeseOverlap": "なし。sauce = pesto、cheese = mozzarella。",
        "recommendationWhy": "弱い推奨。3 つは W2-A A1 と description (「野菜が主役」) の両方で co-equal。eggplant は W1 で key になった前例があり、main に既にある ingredient、という 2 点だけが差。一般則ではない。",
        "extraConsideration": "ratatouille-pizza と vegetable 3 種が同じ。両者は sauce rung (pesto / tomato-sauce) で区別されるので、key が同じでも recipe は曖昧にならない。key を分けるかどうかも Owner 判断。",
    },
    "pesto-pollo": {
        "keyClass": "CLEAR_MAIN",
        "candidates": {
            "chicken": "C1-P main (pollo = chicken)。W2-A A1 の primary。",
            "fresh-tomato": "supporting vegetable。W1 の pesto-caprese は fresh-tomato key だが、あちらは名前の主役。",
        },
        "recommendedKey": "chicken",
        "confidence": "high (confirm)",
        "garnishAromaRisk": "fresh-tomato は supporting で main ではない。chicken は protein main。",
        "sauceCheeseOverlap": "なし。sauce = pesto、cheese = mozzarella。key は topping。",
    },
    "ratatouille-pizza": {
        "keyClass": "CO_EQUAL",
        "candidates": {
            "eggplant": "vegetable。3 つの co-equal vegetable の 1 つ。W1 の melanzane-pizza / parmigiana-pizza の key が eggplant。main の catalog に既にある。",
            "zucchini": "vegetable。3 つの co-equal vegetable の 1 つ。新規 ingredient (W2-A1 branch のみ)。",
            "bell-pepper": "vegetable。3 つの co-equal vegetable の 1 つ。新規 ingredient (W2-A1 branch のみ)。",
            "oregano": "accent の aroma (minCount 1)。W2-A A1: 'R-MC oregano accent'。C1-P は aroma を優先しないので不採用寄り。",
        },
        "recommendedKey": "eggplant",
        "confidence": "low (genuine co-equal; Owner choice)",
        "garnishAromaRisk": "oregano は accent の aroma (herb)。key にすると C1-P に反する。3 つの vegetable は main 側。",
        "sauceCheeseOverlap": "なし。sauce = tomato-sauce、cheese = なし。",
        "recommendationWhy": "弱い推奨。pesto-vegetariana と同じ理由 (W1 で key になった前例、main に既にある ingredient)。W2-A A1: 'three co-equal vegetables, no name-giving primary'。一般則ではない。",
        "extraConsideration": "key を選ぶと sub は残り 2 vegetable + oregano の 3 つで、順序の組合せは 6 通り。",
    },
}

ORDER = [
    "vongole",
    "flammkuchen",
    "jamon-serrano-pizza",
    "brazilian-calabresa",
    "prosciutto-funghi",
    "pesto-gamberi",
    "pesto-vegetariana",
    "pesto-pollo",
    "ratatouille-pizza",
]
# Japanese token each ingredient uses in the approved description (for the reference-only mention order).
JP = {
    "clam": "あさり", "garlic": "にんにく", "parsley": "パセリ", "bacon": "ベーコン", "onion": "たまねぎ",
    "prosciutto-crudo": "生ハム", "arugula": "ルッコラ", "sausage": "ソーセージ", "black-olive": "ブラックオリーブ",
    "oregano": "オレガノ", "mushroom": "マッシュルーム", "shrimp": "エビ", "fresh-tomato": "トマト",
    "zucchini": "ズッキーニ", "bell-pepper": "パプリカ", "eggplant": "ナス", "chicken": "チキン",
}
WAVE2_FAMILY_ROWS = ["prosciutto-crudo", "arugula", "shrimp", "chicken", "parsley", "bell-pepper", "zucchini"]
P_C_PRICE = {"sauce": 10, "cheese": 10, "key": 10, "structure": 5, "sub": 5}


def parse_families(taxonomy_ts):
    return dict(re.findall(r'\["([a-z-]+)", "([a-z]+)"\]', taxonomy_ts))


def parse_categories(ingredients_ts):
    return dict(re.findall(r'id: "([a-z-]+)",\s*\n(?:.*\n){0,6}?\s*category: "([a-z]+)"', ingredients_ts))


def build():
    auth = json.loads(git_show(PINS["wave2"], "tools/wave2-w2a/w2a_authoring_candidates.json"))
    fam_w2 = parse_families(git_show(PINS["wave2"], "src/data/ingredientTaxonomy.ts"))
    fam_main = parse_families(git_show(PINS["main"], "src/data/ingredientTaxonomy.ts"))
    cat = parse_categories(git_show(PINS["wave2"], "src/data/ingredients.ts"))
    roles_ts = git_show(PINS["hint5Head"], "src/data/recipeHintRoles.ts")
    roles_ids = re.findall(r'^\s*"?([a-z-]+)"?: \{ hintKeyToppingId', roles_ts, re.M)
    by_id = {r["runtimeId"]: r for r in auth["recipes"]}
    assert sorted(by_id) == sorted(ORDER), "W2-A recipe set drifted"
    assert sorted(REVIEW) == sorted(ORDER)

    rows = []
    for rid in ORDER:
        r = by_id[rid]
        rv = REVIEW[rid]
        ings = r["requiredIngredients"]
        for i in ings:
            assert i["ingredientId"] in cat, i["ingredientId"]
        sauces = [i["ingredientId"] for i in ings if cat[i["ingredientId"]] == "sauce"]
        cheeses = [i["ingredientId"] for i in ings if cat[i["ingredientId"]] == "cheese"]
        tops = [i for i in ings if cat[i["ingredientId"]] == "topping"]
        assert len(sauces) == 1, rid  # G7: exactly one sauce
        top_ids = sorted(t["ingredientId"] for t in tops)
        assert set(rv["candidates"]) <= set(top_ids), rid
        assert rv["recommendedKey"] in rv["candidates"], rid
        for t in top_ids:
            assert t in fam_w2, f"{rid}: {t} has no family row"
        key = rv["recommendedKey"]
        subs = sorted(t for t in top_ids if t != key)
        # Every permutation of the sub-toppings, for every possible key (sorted, so the output is stable).
        per_key = {}
        for k in top_ids:
            rest = sorted(t for t in top_ids if t != k)
            perms = [list(p) for p in itertools.permutations(rest)]
            seqs = sorted({" > ".join(fam_w2[x] for x in p) for p in perms})
            per_key[k] = {
                "isCandidate": k in rv["candidates"],
                "subToppings": rest,
                "orderCount": len(perms),
                "orders": perms,
                "distinctFamilyLabelSequences": seqs,
                "forcedOrder": len(perms) == 1,
            }
        desc = r["descriptionDraft"]
        mention = sorted((desc.index(JP[t]), t) for t in top_ids if JP[t] in desc)
        assert len(mention) == len(top_ids), rid
        total = P_C_PRICE["sauce"] + P_C_PRICE["cheese"] + P_C_PRICE["key"] + P_C_PRICE["structure"] + P_C_PRICE["sub"] * len(subs)
        evidence = {i["ingredientId"]: {"minCount": i["minCount"], "status": i["status"], "why": i["why"]} for i in ings}
        rows.append({
            "recipeId": rid,
            "evidenceId": r["evidenceId"],
            "nameJa": r["nameJa"],
            "keyClass": rv["keyClass"],
            "sauce": sauces,
            "cheese": cheeses,
            "hasCheese": bool(cheeses),
            "toppings": [
                {"ingredientId": t, "minCount": evidence[t]["minCount"], "family": fam_w2[t],
                 "familyOnMain": fam_main.get(t), "candidateForKey": t in rv["candidates"]}
                for t in top_ids
            ],
            "w2aEvidence": {
                "ingredients": evidence,
                "description": desc,
                "descriptionStatus": r["descriptionStatus"],
                "w1Analog": r["w1Analog"],
                "descriptionMentionOrderReferenceOnly": [t for _, t in mention],
            },
            "keyCandidates": [{"ingredientId": t, "reason": why} for t, why in rv["candidates"].items()],
            "recommendedKey": key,
            "recommendationConfidence": rv["confidence"],
            "recommendationWhy": rv.get("recommendationWhy"),
            "garnishAromaRisk": rv["garnishAromaRisk"],
            "sauceCheeseOverlapRisk": rv["sauceCheeseOverlap"],
            "extraConsideration": rv.get("extraConsideration"),
            "note": rv.get("note"),
            "remainingSubToppings": subs,
            "subOrderByKey": per_key,
            "subOrderUnderRecommendedKey": {
                "orderCount": per_key[key]["orderCount"],
                "orders": per_key[key]["orders"],
                "distinctFamilyLabelSequences": per_key[key]["distinctFamilyLabelSequences"],
                "authorityBasis": "NONE" if per_key[key]["orderCount"] > 1 else "FORCED_BY_KEY",
                "recommendedOrder": None if per_key[key]["orderCount"] > 1 else per_key[key]["orders"][0],
                "ownerDecisionNeeded": per_key[key]["orderCount"] > 1,
            },
            "keyOwnerDecisionNeeded": True,
            "keyOwnerDecisionKind": "CHOOSE_AMONG_CO_EQUAL" if rv["keyClass"] == "CO_EQUAL" else "CONFIRM_UNIQUE_MAIN",
            "p4CheeseApplicable": not cheeses,
            "hint5LadderTotalPitzIfP4CheeseAdopted": total,
            "keyUniqueMainUnderC1P": rv["keyClass"] == "CLEAR_MAIN",
            "c1pConflict": False,
        })

    c1p_checks = []
    for row in rows:
        for c in row["keyCandidates"]:
            fam = fam_w2[c["ingredientId"]]
            c1p_checks.append({"recipeId": row["recipeId"], "candidate": c["ingredientId"], "family": fam,
                               "isAroma": fam in ("herb", "spice"), "category": cat[c["ingredientId"]]})
    aroma_recommended = [r["recipeId"] for r in rows if fam_w2[r["recommendedKey"]] in ("herb", "spice")]
    assert not aroma_recommended, aroma_recommended

    clear = [r["recipeId"] for r in rows if r["keyClass"] == "CLEAR_MAIN"]
    co = [r["recipeId"] for r in rows if r["keyClass"] == "CO_EQUAL"]
    sub_dec = [r["recipeId"] for r in rows if r["subOrderUnderRecommendedKey"]["ownerDecisionNeeded"]]
    forced = [r["recipeId"] for r in rows if not r["subOrderUnderRecommendedKey"]["ownerDecisionNeeded"]]
    cheeseless = [r["recipeId"] for r in rows if not r["hasCheese"]]
    with_cheese = [r["recipeId"] for r in rows if r["hasCheese"]]
    not_on_main = [t for t in WAVE2_FAMILY_ROWS if t not in fam_main]
    used_new = sorted({t["ingredientId"] for r in rows for t in r["toppings"] if t["ingredientId"] in not_on_main})

    return {
        "schema": "teto-w2a-hint5-role-authoring-review/1",
        "status": "OWNER_REVIEW_PACK: NOT_AUTHORITY. Every key / sub value is a CANDIDATE. Docs/data/tools only. DA-1 is not implemented.",
        "pins": {k: v for k, v in PINS.items()},
        "resolved": {
            "main": rev_parse(PINS["main"]),
            "wave2": rev_parse(PINS["wave2"]),
            "hint5Head": rev_parse(PINS["hint5Head"]),
            "hint5H53": rev_parse(PINS["hint5H53"]),
            "da1Prep": rev_parse(PINS["da1Prep"]),
        },
        "principle": {
            "C1-P": "Hint 5.0 key topping = the main topping that characterises the recipe. A main ingredient is preferred over an aroma or garnish, and the key never duplicates sauce / cheese information (OD-H5-C1-P, H5-0 §4).",
            "notAuthority": [
                "recipe requiredIngredients array order (OD-H5-C1)",
                "name-match candidates (DA-1 Preparation Audit: guideline only)",
                "the H5-0 §6.4 tie-break (\"NOT Owner authority\")",
                "the W2-A minCount roles (R-MC): quantity authoring, not Hint 5.0 role authority; cited as evidence only",
            ],
            "g17": "The key is a topping of the recipe (null only without toppings). The sub order is exactly the other toppings, once each. No sub-order rule exists.",
        },
        "recipes": rows,
        "c1pCandidateCheck": c1p_checks,
        "summary": {
            "recipes": len(rows),
            "clearMainRecipes": clear,
            "clearMainCount": len(clear),
            "coEqualRecipes": co,
            "coEqualCount": len(co),
            "keyOwnerDecisionCount": len(rows),
            "subOrderOwnerDecisionRecipes": sub_dec,
            "subOrderOwnerDecisionCount": len(sub_dec),
            "subOrderForcedAfterKeyRecipes": forced,
            "c1pConflictCount": 0,
            "c1pNonDeterminativeRecipes": co,
            "recommendedKeyIsAromaOrSpice": aroma_recommended,
            "p4Cheese": {"applicable": cheeseless, "applicableCount": len(cheeseless), "notApplicable": with_cheese,
                         "p4bKeyNone": [], "note": "No W2-A recipe has zero toppings, so P4b (key none) never applies. Roles do not depend on the cheese rung."},
            "taxonomy": {
                "authority": "OD-W2-5 (APPROVED, scoped)",
                "onMain": False,
                "branchOnly": "claude/wave2-runtime-recipe-design-os06j1 @ 2bc40e4 (W2-A1, no PR)",
                "familyRowsNotOnMain": not_on_main,
                "familyRowsUsedByTheNine": used_new,
                "recipesUsingThem": sum(1 for r in rows if any(t["ingredientId"] in not_on_main for t in r["toppings"])),
                "recipesNotUsingThem": [r["recipeId"] for r in rows if not any(t["ingredientId"] in not_on_main for t in r["toppings"])],
                "watch": {"garlic": ["vongole", "pesto-gamberi"], "black-olive": ["brazilian-calabresa"]},
                "watchIsKeyCandidate": False,
            },
            "roleIdsInRecipeHintRolesTs": len(roles_ids),
            "w2aIdsInRecipeHintRolesTs": [i for i in roles_ids if i in ORDER],
        },
    }


def md_perms(perms):
    return " / ".join("[" + ", ".join(p) + "]" for p in perms) if perms and perms[0] else "(なし)"


def render(data):
    rows = data["recipes"]
    s = data["summary"]
    o = []
    w = o.append
    w("# W2-A Hint 5.0 Role Authoring Review (Owner Review pack)")
    w("")
    w("**docs/data/tools only。これは DA-1 実装ではなく、authority でもない。**")
    w("- 全ての key / sub 順は **CANDIDATE**。Owner が決めるまで何も確定しない。")
    w("- 変更なし: `recipeHintRoles.ts`、`src`、e2e、recipe / ingredient production、taxonomy、Hint 5.0 実装、H5-4、TQ、Cooking Steps、progression、Wave 2 実装。merge / PR なし。")
    w("")
    w("| 成果物 | パス |")
    w("|---|---|")
    w("| Report (this file) | `docs/reports/TETO_W2-A_HINT5_ROLE-AUTHORING_REVIEW.md` |")
    w("| Machine-readable | `docs/reports/data/TETO_W2-A_HINT5_ROLE-AUTHORING_REVIEW.json` |")
    w("| Generator / checker | `tools/w2a_hint5_role_authoring_review.py` (`--check` は byte drift を検出) |")
    w("")
    w("## 0. 結果 (一覧)")
    w("")
    w(f"- 対象 **{s['recipes']} recipe**、全件が Owner Review 対象。「主役が 1 つ明確」な recipe も authority 化していない。")
    w(f"- **明確な主役あり: {s['clearMainCount']}** ({', '.join(s['clearMainRecipes'])})。Owner は「確認」するだけでよいが、確認は必要。")
    w(f"- **co-equal で Owner 選択が必要: {s['coEqualCount']}** ({', '.join(s['coEqualRecipes'])})。")
    w(f"- **sub 順の Owner Decision: {s['subOrderOwnerDecisionCount']} 件** ({', '.join(s['subOrderOwnerDecisionRecipes'])})。sub が 2 つ以上あり、既存 authoring に順序の根拠がない。")
    w(f"- 残り {len(s['subOrderForcedAfterKeyRecipes'])} recipe ({', '.join(s['subOrderForcedAfterKeyRecipes'])}) は topping が 2 つだけなので、key が決まれば sub は 1 つで順序は強制される。")
    w("- **C1-P conflict: 0**。推奨・候補のどれも sauce / cheese ではなく、推奨 key は herb / spice family ではない。ただし co-equal の 4 recipe では C1-P だけでは key が決まらない (conflict ではなく non-determinative)。")
    w(f"- **P4-CHEESE 対象: {s['p4Cheese']['applicableCount']} recipe** ({', '.join(s['p4Cheese']['applicable'])})。P4b (key なし) の対象は 0。")
    w("")
    w("## 1. Fresh state と参照した authority")
    w("")
    w("| 項目 | 状態 |")
    w("|---|---|")
    w(f"| audited `main` | `{PINS['main']}` (Merge PR #291)。 |")
    w("| Hint 5.0 (#292) | branch `claude/hint-5-0-fresh-audit-cdgm9e`。H5-3 head `1ec4253`、H5-4 Fresh Gate commit `5eadb96`。`recipeHintRoles.ts` は runtime 25 recipe のみ (W2-A id は 0 件)。PR / main 未反映。 |")
    w("| DA-1 Preparation Audit | branch `claude/172-da-1-preparation-audit` @ `e829a17`。参照のみ。 |")
    w("| 172 Authority Matrix | branch `claude/172-recipe-authority-matrix` @ `79873c0`。参照のみ。 |")
    w("| Wave 2 W2-A | branch `claude/wave2-runtime-recipe-design-os06j1` @ `2bc40e4`。OD-W2 ledger と `w2a_authoring_candidates.json` (A1〜A8 は `APPROVED_OWNER`) を **read-only** で参照。PR なし。 |")
    w("")
    w("**C1-P (OD-H5-C1-P, APPROVED):** Hint 5.0 の key topping は、そのレシピを特徴づける主要トッピング。香り付け・添え物より主役となる材料を優先し、sauce / cheese と情報を重複させない。")
    w("")
    w("**authority として使っていないもの:**")
    for x in data["principle"]["notAuthority"]:
        w(f"- {x}")
    w("")
    w("G17 (H5-1) が課す制約は「key は recipe の topping」「sub 順は key 以外の topping を 1 回ずつ」だけで、sub 順の規則は存在しない。この review も規則を作らない。汎用の tie-break rule (172 recipe 向け) も作らない。")
    w("")
    w("### 記法")
    w("- 「W2-A A1 の primary」等は W2-A minCount authoring (R-MC) の役割タグで、Hint 5.0 role の authority ではない。Owner 判断の **evidence** として引用する。")
    w("- 「sub 順の family label 列」は、sub① から順に何の family label が出るかを機械的に並べたもの。順序を選ぶ根拠ではなく、順序が player に見える情報を変えるかどうかを示す事実。")
    w("- sub 順は key が決まって初めて意味を持つので、key を変えた場合の全組合せも JSON (`subOrderByKey`) に載せた。")
    w("")
    w("## 2. 9 recipe 概要")
    w("")
    w("| Recipe | class | sauce | cheese | toppings | 推奨 key (candidate) | 確度 | sub 残り | sub 順の Owner Decision | P4-CHEESE |")
    w("|---|---|---|---|---|---|---|---|---|---|")
    for r in rows:
        tops = ", ".join(f"{t['ingredientId']}×{t['minCount']}" for t in r["toppings"])
        su = r["subOrderUnderRecommendedKey"]
        w(f"| `{r['recipeId']}` | {r['keyClass']} | {', '.join(r['sauce'])} | {', '.join(r['cheese']) or 'なし'} | {tops} | **{r['recommendedKey']}** | {r['recommendationConfidence']} | {', '.join(r['remainingSubToppings'])} | {'要 (' + str(su['orderCount']) + ' 通り)' if su['ownerDecisionNeeded'] else '不要 (強制)'} | {'対象' if r['p4CheeseApplicable'] else '対象外'} |")
    w("")
    w("`jamon-serrano-pizza` は task の `jamon-serrano` と同じ recipe (W2-A authoring の runtime id)。")
    w("")
    w("## 3. Recipe 別 review (A〜M)")
    w("")
    for n, r in enumerate(rows, 1):
        su = r["subOrderUnderRecommendedKey"]
        w(f"### 3.{n} `{r['recipeId']}` — {r['nameJa']} ({r['keyClass']})")
        w("")
        w("**A. recipe**")
        w(f"- evidence id: `{r['evidenceId']}`。sauce: {', '.join(r['sauce'])}。cheese: {', '.join(r['cheese']) or 'なし'}。W1 analog: {r['w2aEvidence']['w1Analog']}。")
        w(f"- description (A3 承認済み): 「{r['w2aEvidence']['description']}」")
        if r.get("note"):
            w(f"- 注: {r['note']}")
        w("")
        w("**B. toppings 全件** (minCount は W2-A A1 承認済み、family は OD-W2-5 / main)")
        w("")
        w("| topping | minCount | family | main に family row | key candidate |")
        w("|---|---:|---|---|---|")
        for t in r["toppings"]:
            w(f"| `{t['ingredientId']}` | {t['minCount']} | {t['family']} | {'あり' if t['familyOnMain'] else '**なし (W2-A1 branch のみ)**'} | {'✔' if t['candidateForKey'] else '—'} |")
        w("")
        w("**C. 承認済み W2-A authoring evidence** (Hint role の authority ではない)")
        for ing, e in r["w2aEvidence"]["ingredients"].items():
            w(f"- `{ing}` ×{e['minCount']} ({e['status']}): {e['why']}")
        w(f"- description 内の登場順 (参照のみ、候補の導出には不使用): {', '.join(r['w2aEvidence']['descriptionMentionOrderReferenceOnly'])}")
        w("")
        w("**D. C1-P による key candidate / E. alternative candidate / F. candidate ごとの理由**")
        w("")
        w("| candidate | 位置づけ | 理由 |")
        w("|---|---|---|")
        for c in r["keyCandidates"]:
            role = "推奨" if c["ingredientId"] == r["recommendedKey"] else "alternative"
            w(f"| `{c['ingredientId']}` | {role} | {c['reason']} |")
        w("")
        w(f"**G. garnish / aromatic risk:** {r['garnishAromaRisk']}")
        w("")
        w(f"**H. sauce / cheese overlap risk:** {r['sauceCheeseOverlapRisk']}")
        w("")
        w(f"**I. 推奨 key candidate:** `{r['recommendedKey']}` (確度: {r['recommendationConfidence']})。**candidate であり authority ではない。**")
        if r.get("recommendationWhy"):
            w(f"- {r['recommendationWhy']}")
        if r.get("extraConsideration"):
            w(f"- 補足: {r['extraConsideration']}")
        w("")
        w(f"**J. 残り sub toppings (推奨 key の場合):** {', '.join('`' + x + '`' for x in r['remainingSubToppings'])}")
        w("")
        w("**K. sub order candidate (推奨 key の場合)**")
        if su["ownerDecisionNeeded"]:
            w(f"- 全 {su['orderCount']} 通り: {md_perms(su['orders'])}")
            w(f"- family label 列 (sub① → …) の種類: {len(su['distinctFamilyLabelSequences'])} 種: " + "; ".join(su["distinctFamilyLabelSequences"]))
            w("- **推奨順序なし** (根拠となる authority がない)。")
        else:
            w(f"- 強制: {md_perms(su['orders'])} (topping が 2 つだけなので key が決まれば sub は 1 つ)。")
        alt = [(k, v) for k, v in r["subOrderByKey"].items() if k != r["recommendedKey"] and v["isCandidate"]]
        for k, v in alt:
            if v["forcedOrder"]:
                w(f"- alternative key `{k}` の場合: 強制 {md_perms(v['orders'])}")
            else:
                w(f"- alternative key `{k}` の場合: {v['orderCount']} 通り (family label 列 {len(v['distinctFamilyLabelSequences'])} 種)。全組合せは JSON。")
        w("")
        w("**L. sub order を決める根拠**")
        if su["ownerDecisionNeeded"]:
            w("- 既存 authoring (A1〜A4) に順序の根拠はない。Hint 5.0 にも sub 順の一般 authority はなく、この review も規則を作らない。")
            if len(su["distinctFamilyLabelSequences"]) == 1:
                w("- 事実: sub の family がすべて同じなので、どの順序でも player に見える family label の列は同じ (保存される `cls:<ingredientId>` の id だけが変わる)。")
            else:
                w("- 事実: 順序によって sub① で見える family label が変わる。")
        else:
            w("- key が決まれば sub は 1 つで、順序の根拠は不要。ただし key が Owner 判断なので、sub もそれに従属する。")
        w("")
        kd = "co-equal から選択" if r["keyOwnerDecisionKind"] == "CHOOSE_AMONG_CO_EQUAL" else "唯一の主役の確認"
        w(f"**M. Owner Decision:** key = **必要** ({kd})。sub 順 = **{'必要' if su['ownerDecisionNeeded'] else '不要 (key に従属)'}**。")
        w("")
    w("## 4. co-equal 4 recipe の Owner Decision")
    w("")
    w("W2-A A1 が複数の主役を記録している recipe。どれを key にするか、残りをどの順にするかを Owner が決める。")
    w("")
    for rid in ["flammkuchen", "prosciutto-funghi", "pesto-vegetariana", "ratatouille-pizza"]:
        r = next(x for x in rows if x["recipeId"] == rid)
        w(f"### `{rid}`")
        w(f"- W2-A evidence: " + "; ".join(f"`{i}`: {e['why']}" for i, e in r["w2aEvidence"]["ingredients"].items() if e["status"] == "APPROVED_OWNER" or i in ("oregano",)))
        w("- 選択肢:")
        for k, v in r["subOrderByKey"].items():
            if not v["isCandidate"]:
                continue
            flag = " ← 推奨 (弱い)" if k == r["recommendedKey"] else ""
            w(f"  - key `{k}`{flag} → sub: {v['orderCount']} 通り {md_perms(v['orders'])}")
        w(f"- 推奨の理由と限界: {r.get('recommendationWhy')}")
        if r.get("extraConsideration"):
            w(f"- 補足: {r['extraConsideration']}")
        w("")
    w("## 5. sub order Owner Decision")
    w("")
    w("| Recipe | 推奨 key の場合の sub | 通り数 | family label 列の種類 | 根拠 |")
    w("|---|---|---:|---:|---|")
    for r in rows:
        su = r["subOrderUnderRecommendedKey"]
        if su["ownerDecisionNeeded"]:
            w(f"| `{r['recipeId']}` | {', '.join(r['remainingSubToppings'])} | {su['orderCount']} | {len(su['distinctFamilyLabelSequences'])} | なし (Owner Decision) |")
    w("")
    w(f"合計 **{s['subOrderOwnerDecisionCount']} 件**。ここに載らない {len(s['subOrderForcedAfterKeyRecipes'])} recipe は、どの key を選んでも sub が 1 つで順序は強制される。")
    w("")
    w("メタな問い (Owner が答えると 5 件が一括で決まりうる): sub 順の **根拠** を Owner がどう決めるか。例えば「承認済み description の登場順を使う」「個別に指定する」など。この review は根拠を提案も採用もしない。description の登場順は各 recipe の節に参照値として載せただけで、どの候補の導出にも使っていない。")
    w("")
    w("## 6. P4-CHEESE との compatibility (確認のみ)")
    w("")
    w("H5-4 のコード・authority は変更しない。OD-H5-P4-CHEESE は **未決**。")
    w("")
    w("| Recipe | cheese | P4-CHEESE | roles への影響 | ladder 合計 (P4-CHEESE 採用時, 参考) |")
    w("|---|---|---|---|---:|")
    for r in rows:
        w(f"| `{r['recipeId']}` | {', '.join(r['cheese']) or 'なし'} | {'**対象**' if r['p4CheeseApplicable'] else '対象外'} | なし | {r['hint5LadderTotalPitzIfP4CheeseAdopted']} |")
    w("")
    w("- P4-CHEESE 対象 5 recipe: " + ", ".join(s["p4Cheese"]["applicable"]) + "。")
    w("- key / sub は topping だけを参照するので、P4-CHEESE の採否で **変わらない**。採用されれば CHEESE rung は 10 Pitz の「チーズ：なし」になり、採用されなければ `RESERVED_EMPTY_RUNG` のままで、この 5 recipe は Hint 5.0 の target にできない (roles 自体は type gate のためどちらにせよ必要)。")
    w("- P4b (「キートッピング：なし」) は対象 0: 9 recipe すべてが 2 つ以上の topping を持つ。")
    w("- ladder 合計は sauce 10 + cheese 10 + key 10 + structure 5 + sub 5 × n (H5-4 §3 の式)。価格は rung 種別のみで決まるので、key の選択で変わらない。")
    w("- no-sauce / TQ-1D には触れていない: 9 recipe はすべて sauce が 1 つ (`vongole` は olive-oil base) で、Technique を要しない。")
    w("")
    w("## 7. Taxonomy")
    w("")
    w("- **OD-W2-5 (APPROVED, scoped)** の 7 family row を authority として参照した: prosciutto-crudo・chicken → meat、arugula・bell-pepper・zucchini → vegetable、shrimp → seafood、parsley → herb。")
    w(f"- **main には未反映。** これらは W2-A1 branch (`2bc40e4`, PR なし) にだけあり、`origin/main` の `ingredientTaxonomy.ts` には無い (generator が確認)。9 recipe のうち {s['taxonomy']['recipesUsingThem']} recipe が少なくとも 1 つ使う (使わないのは flammkuchen と brazilian-calabresa): " + ", ".join(s["taxonomy"]["familyRowsUsedByTheNine"]) + "。")
    w("- 影響: 推奨 key の `prosciutto-crudo` / `chicken` / `shrimp` は W2-A1 が main に入るまで G17 で検証できない。")
    w("- **watch (再決定しない):** `garlic` (herb; vongole, pesto-gamberi) と `black-olive` (vegetable; brazilian-calabresa) は production row だが HCG queue で boundary が review 中。どちらも **key candidate ではなく sub のみ**。family が動いても role の割当は変わらず、変わるのは sub の family label だけ (`cls:<ingredientId>` は id 保存で family 移動に耐える、PR #293 F-8)。")
    w("")
    w("## 8. DA-1 Start Gate への影響 (9 件を Owner が authority 化した場合)")
    w("")
    w("DA-1 Preparation Audit §11 の Start Gate を、この 9 件だけ authority 化した仮定で読み替えた。**実際には何も変わっていない。**")
    w("")
    w("| Gate | 現状 | 9 件を authority 化した場合 |")
    w("|---|---|---|")
    w("| SG-1 fresh check | PASS | 変わらず。main `86b48fd` を再確認すること。 |")
    w("| SG-2 scope | OPEN | 変わらず (8 non-W2-A は Authoring Gate なし)。W2-A 9 件だけなら scope を決めやすくなる。 |")
    w("| **SG-3 Hint 5.0 roles** | OPEN (0 / 17) | **W2-A 9 件は authority 完了**。17 行では 9 / 17。8 non-W2-A 行は OPEN のまま。 |")
    w("| SG-4 P4-CHEESE | OPEN | 変わらず。5 recipe が待つ。 |")
    w("| SG-5 / SG-6 family row と W2-A1 の main 反映 | OPEN | 変わらず (implementation state)。 |")
    w("| SG-7 / SG-8 / SG-9 | 変わらず | 変わらず。 |")
    w("")
    w("- 9 行の lane: H は解消。**4 行は B0 になる** (jamon-serrano, prosciutto-funghi, pesto-vegetariana, pesto-pollo: cheese がある)。**5 行は B1 のまま** (vongole, flammkuchen, brazilian-calabresa, pesto-gamberi, ratatouille: lane N = P4-CHEESE 待ち)。")
    w("- 「Hint 5.0 と DA-1 の後に merge される方が role を運ぶ」という sequencing (Record<RecipeId> の type gate) は変わらない。承認された role は、その PR が `recipeHintRoles.ts` に書く。この review は書かない。")
    w("")
    w("## 9. Owner に決めてほしいこと (queued, 未決)")
    w("")
    w("| ID (working label) | 内容 | 件数 |")
    w("|---|---|---:|")
    w("| RK-CONFIRM | 唯一の主役 key の確認: " + ", ".join(s["clearMainRecipes"]) + " | 5 |")
    w("| RK-CHOOSE | co-equal の key の選択: " + ", ".join(s["coEqualRecipes"]) + " | 4 |")
    w("| RS-ORDER | sub 順: " + ", ".join(s["subOrderOwnerDecisionRecipes"]) + " | 5 |")
    w("| RS-BASIS | (任意) sub 順の根拠を Owner がどう決めるか。この review は提案しない | 1 |")
    w("")
    w("## 10. 非目標 / 変更していないもの")
    w("")
    w("- `recipeHintRoles.ts`、`src`、e2e、recipe / ingredient production、taxonomy、Hint 5.0 実装、H5-4、TQ、Cooking Steps、progression、Wave 2 実装は無変更。DA-1 は未実装。merge / PR なし。")
    w("- 汎用の 172 向け tie-break rule は作っていない。H5-0 §6.4 の tie-break も authority として使っていない。")
    w("- no-sauce / TQ-1D authority、taxonomy の再決定はしていない。")
    w("- UI / gameplay 変更ではないので Human Verification video は不要 (docs / data / tools のみ)。")
    w("")
    w("**STOP。Owner Review 待ち。key / sub は authority として確定していない。**")
    w("")
    return "\n".join(o)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    data = build()
    js = json.dumps(data, ensure_ascii=False, indent=1, sort_keys=True) + "\n"
    md = render(data)
    if args.check:
        ok = OUT_JSON.exists() and OUT_JSON.read_text() == js and OUT_MD.exists() and OUT_MD.read_text() == md
        print("OK: no drift" if ok else "DRIFT")
        sys.exit(0 if ok else 1)
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(js)
    OUT_MD.write_text(md)
    print(f"wrote {OUT_JSON.relative_to(ROOT)} and {OUT_MD.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
