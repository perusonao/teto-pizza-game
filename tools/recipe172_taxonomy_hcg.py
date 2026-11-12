#!/usr/bin/env python3
"""172 Recipe Taxonomy / HCG authority pack -- docs/data tooling only.

NOT production code, NOT wired into CI, NOT an authority. It prepares the Human Classification Gate
(OD-TAX-7) for the ingredients that put 172-matrix rows into class F ("ingredient ID / taxonomy
blocker") in the 172 Recipe Authority Matrix.

It reads pinned git objects only (deterministic):
  main  86b48fd  src/data/ingredients.ts, src/data/ingredientTaxonomy.ts,
                 data/recipes/ingredient_master_catalog.json,
                 docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json,
                 tools/progression2_ingredient_canonicalizer.py (alias / ambiguity / registry tables)
  PR #255 e221e36  TETO_INGREDIENT-TAXONOMY_172_FRESH-AUDIT.json (PROPOSED rows, review queue)
  Matrix  79873c0  TETO_RECIPE-172_AUTHORITY-MATRIX.json (the F set, classes, blockers)

The DECISIONS table below lists QUESTIONS for the Owner / HCG, never answers. Every option stays
inside the 7 DH4-1 families; an option outside them is recorded as `newFamilyPressure` and must go
back to the Owner (never added here). `other` is only listed where an existing authority already
puts that kind of ingredient there (DH4-1 header: egg / nuts / sweets share `other`).

Usage:  python3 tools/recipe172_taxonomy_hcg.py [--check]
"""
from __future__ import annotations

import argparse
import ast
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PINS = {
    "main": "86b48fd51423a8f76db5398ab88ecfd944e2ae10",
    "pr255": "e221e36c9278311dfecc22263b5467dab7984555",
    "matrix": "79873c0",
}
OUT = ROOT / "docs/reports/data/TETO_RECIPE-172_TAXONOMY-HCG.json"
FAMILIES = ["meat", "seafood", "vegetable", "herb", "spice", "fruit", "other"]
PRECEDENCE = ["F", "E", "D", "C", "B", "A"]


def git_show(ref: str, path: str) -> str:
    try:
        return subprocess.run(["git", "show", f"{ref}:{path}"], cwd=ROOT, check=True,
                              capture_output=True, text=True).stdout
    except subprocess.CalledProcessError:
        sys.exit(f"missing git object {ref}:{path} -- git fetch origin (main, "
                 "claude/172-recipe-ingredient-audit-d33d8i, claude/172-recipe-authority-matrix)")


def canonicalizer_tables(src: str) -> dict:
    tree = ast.parse(src)
    out = {}
    for node in tree.body:
        if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            name = node.targets[0].id
            if name in ("LIKELY_ALIAS_TABLE", "AMBIGUOUS_TABLE", "GENUINELY_NEW_REGISTRY", "TAXONOMY_FLAGS"):
                out[name] = ast.literal_eval(node.value)
    return out


# ---------------------------------------------------------------------------------------------
# HCG decision questions. Each lists the blocker items it settles and the dimension it settles.
# kind: CONFIRM  = existing authority already implies the answer; HCG only confirms (no judgment)
#       ALIAS    = raw label -> canonical id only; every candidate id shares category and family
#       ID       = a canonical id must be chosen or registered (candidates may differ)
#       CATEGORY = sauce / cheese / topping must be decided first (family only after)
#       FAMILY   = choose one of the 7 families (category already topping)
# ---------------------------------------------------------------------------------------------
DECISIONS = [
    {"id": "HCG-01", "kind": "CONFIRM", "dims": ["id", "family"], "items": ["beef"],
     "question": "Confirm beef (牛肉) as its own topping id, family meat.",
     "options": ["beef = own id, meat (canonicalizer GENUINELY_NEW_REGISTRY 牛肉→beef, Phase 0B.1)"],
     "authority": "GENUINELY_NEW_REGISTRY['牛肉']='beef'; every related id (steak, ground-beef) is meat, so the steak / ground-beef relation cannot change the family",
     "ownerDecision": False, "newFamilyPressure": None},
    {"id": "HCG-02", "kind": "ID", "dims": ["id"], "items": ["ひき肉", "ground-beef"],
     "question": "ひき肉 → ground-beef, or a new generic ground-meat id? (ground-beef has no Japanese name evidence of its own.)",
     "options": ["ひき肉 = ground-beef (gives ground-beef its name evidence)", "new id ground-meat (pork / mixed allowed); ground-beef stays taco-only"],
     "authority": "AMBIGUOUS_TABLE['ひき肉'] (never auto-resolved); family meat either way",
     "ownerDecision": True, "newFamilyPressure": None},
    {"id": "HCG-03", "kind": "ID", "dims": ["id"], "items": ["肉"],
     "question": "Generic 肉 in swedish-kebab-pizza: which meat id?",
     "options": ["an existing id (beef / pork / chicken / lamb)", "new id kebab-meat", "leave the row blocked"],
     "authority": "AMBIGUOUS_TABLE['肉'] generic_unspecified; family meat either way",
     "ownerDecision": True, "newFamilyPressure": None},
    {"id": "HCG-04", "kind": "FAMILY", "dims": ["family"], "items": ["green-onion"],
     "question": "green-onion (青ねぎ / 万能ねぎ): vegetable or spice (薬味)?",
     "options": ["vegetable (PR #255 proposal, vegetable.allium)", "spice (スパイス・薬味, as a garnish)"],
     "authority": "PR #255 NEEDS_REVIEW; related runtime boundary: garlic (herb) is also OD-TAX-7",
     "ownerDecision": True, "newFamilyPressure": None},
    {"id": "HCG-05", "kind": "ID", "dims": ["id"], "items": ["唐辛子", "赤唐辛子", "青唐辛子"],
     "question": "唐辛子 / 赤唐辛子 / 青唐辛子 → one new chili-pepper id, or colour variants? (Never chili-oil.)",
     "options": ["one id chili-pepper (colour is presentation)", "two ids red-chili / green-chili (+ 唐辛子 = red-chili)"],
     "authority": "AMBIGUOUS_TABLE keeps all three distinct from chili-oil (a sauce)",
     "ownerDecision": True, "newFamilyPressure": None},
    {"id": "HCG-06", "kind": "FAMILY", "dims": ["family"], "items": ["唐辛子", "赤唐辛子", "青唐辛子", "jalapeno", "aji-amarillo"],
     "question": "Fresh chili peppers (唐辛子 tokens, jalapeno, aji-amarillo): spice or vegetable?",
     "options": ["spice (PR #255 proposal spice.chili)", "vegetable (sliced fresh pepper)"],
     "authority": "PR #255 NEEDS_REVIEW (jalapeno, aji-amarillo); the tokens' indicative family is spice",
     "ownerDecision": True, "newFamilyPressure": None},
    {"id": "HCG-07", "kind": "FAMILY", "dims": ["family"], "items": ["nori", "青のり"],
     "question": "Seaweed (nori, and 青のり if it becomes an id): seafood, spice (薬味) or other?",
     "options": ["seafood", "spice (as a garnish)", "other (PR #255 proposal other.seaweed)"],
     "authority": "PR #255 NEEDS_REVIEW (low): 'Seaweed is not 魚介 in everyday Japanese'",
     "ownerDecision": True,
     "newFamilyPressure": "A 海藻 family would be a label ≈ name (のり) (PR #255 §8). If none of the 3 options is acceptable → STOP, Owner Decision (new family)."},
    {"id": "HCG-08", "kind": "ALIAS", "dims": ["id"], "items": ["青のり"],
     "question": "青のり → nori (alias), or its own id?",
     "options": ["alias of nori", "own id aonori (same family as nori, HCG-07)"],
     "authority": "AMBIGUOUS_TABLE['青のり'] ('related but distinct'); family follows HCG-07 either way",
     "ownerDecision": True, "newFamilyPressure": None},
    {"id": "HCG-09", "kind": "ID", "dims": ["id"], "items": ["チーズ"],
     "question": "Generic チーズ (3 rows): which cheese id per row?",
     "options": ["per row, an existing cheese id (mozzarella is NOT a default)", "leave the rows blocked"],
     "authority": "AMBIGUOUS_TABLE['チーズ'] generic_unspecified; category cheese, so no hint family is needed",
     "ownerDecision": True, "newFamilyPressure": None},
    {"id": "HCG-10", "kind": "ID", "dims": ["id"], "items": ["ホワイトソース"],
     "question": "ホワイトソース → fromage-blanc-sauce, or a new white-sauce id?",
     "options": ["fromage-blanc-sauce", "new id white-sauce (béchamel)"],
     "authority": "AMBIGUOUS_TABLE['ホワイトソース'] (sauce_not_topping); category sauce, no hint family",
     "ownerDecision": True, "newFamilyPressure": None},
    {"id": "HCG-11", "kind": "ID", "dims": ["id", "category"], "items": ["カレーソース", "curry-ketchup"],
     "question": "カレーソース vs curry-ketchup: one sauce id or two? Is curry-ketchup a spread sauce?",
     "options": ["カレーソース = curry-ketchup (sauce)", "new id curry-sauce; curry-ketchup stays (sauce)"],
     "authority": "AMBIGUOUS_TABLE['カレーソース']; TAXONOMY_FLAGS カレーケチャップソース = sauce_not_topping",
     "ownerDecision": True, "newFamilyPressure": None},
    {"id": "HCG-12", "kind": "ID", "dims": ["id"], "items": ["チーズソース"],
     "question": "チーズソース: register a new cheese-sauce id (category sauce)?",
     "options": ["new id cheese-sauce (sauce)", "leave the row blocked"],
     "authority": "AMBIGUOUS_TABLE['チーズソース'] says: a SAUCE, not merged into any cheese id",
     "ownerDecision": True, "newFamilyPressure": None},
    {"id": "HCG-13", "kind": "CONFIRM", "dims": ["id"], "items": ["プロヴェルチーズ"],
     "question": "Register provel as its own cheese id (not provolone).",
     "options": ["provel = own id, category cheese"],
     "authority": "AMBIGUOUS_TABLE['プロヴェルチーズ']: 'explicitly NOT the same cheese, kept separate'",
     "ownerDecision": False, "newFamilyPressure": None},
    {"id": "HCG-14", "kind": "ALIAS", "dims": ["id"], "items": ["wurstel", "スパイシーソーセージ"],
     "question": "Sausage cluster: wurstel (ウインナー) and スパイシーソーセージ → sausage, or own ids?",
     "options": ["both alias sausage (runtime id, already meat)", "wurstel own id; スパイシーソーセージ → sausage", "both own ids (meat)"],
     "authority": "AMBIGUOUS_TABLE['スパイシーソーセージ']; PR #255 NEEDS_REVIEW wurstel; family meat either way",
     "ownerDecision": True, "newFamilyPressure": None},
    {"id": "HCG-15", "kind": "CATEGORY", "dims": ["category", "family"],
     "items": ["mustard", "yuzu-kosho", "balsamic-vinegar", "chutney", "curry-ketchup", "umeboshi-paste", "wasabi", "melted-butter"],
     "question": "Condiments: spread sauce, or topping (then family spice)? Decide category first.",
     "options": ["sauce (spread; no hint family)", "topping → spice (スパイス・薬味)"],
     "authority": "TAXONOMY_FLAGS sauce_or_condiment (mustard, yuzu-kosho, balsamic, chutney, 溶かしバター); false_friend_not_meat (梅肉); PR #255 NEEDS_REVIEW",
     "ownerDecision": True,
     "newFamilyPressure": "A 調味料 family would be new (PR #293 NF-2). If neither option is acceptable → STOP."},
    {"id": "HCG-16", "kind": "CATEGORY", "dims": ["category", "family"], "items": ["catupiry", "cashew-cheese", "sour-cream", "condensed-milk"],
     "question": "Creamy dairy: cheese (no hint family) or topping? sour-cream / condensed-milk may also be a spread sauce.",
     "options": ["catupiry, cashew-cheese = cheese; sour-cream = sauce", "sour-cream = topping → other (dairy, explicit)", "cashew-cheese = topping → other (nut-seed, explicit)"],
     "authority": "PR #255 NEEDS_REVIEW (cheese vs dairy)",
     "ownerDecision": True,
     "newFamilyPressure": "乳製品 is not one of the 7 (PR #255 §9: 'do not use'). A topping outcome must pick `other` explicitly, not by default."},
    {"id": "HCG-17", "kind": "FAMILY", "dims": ["family"], "items": ["pickles", "kimchi", "sauerkraut"],
     "question": "Pickled / fermented vegetables: vegetable or spice (薬味)?",
     "options": ["vegetable (PR #255 proposal vegetable.pickled)", "spice"],
     "authority": "PR #255 NEEDS_REVIEW",
     "ownerDecision": True, "newFamilyPressure": None},
    {"id": "HCG-18", "kind": "ID", "dims": ["id", "category"],
     "items": ["chicken-tikka", "peking-duck", "hot-dog", "liver-pate", "baked-beans"],
     "question": "Prepared / composite foods: accept as ingredient ids (family of the main ingredient), re-canonicalize, or exclude?",
     "options": ["accept: chicken-tikka / peking-duck / hot-dog / liver-pate = meat, baked-beans = vegetable",
                 "re-canonicalize (e.g. hot-dog → sausage, peking-duck → duck)", "liver-pate = spread sauce"],
     "authority": "TAXONOMY_FLAGS prepared_dish_composite (chicken-tikka, hot-dog, peking-duck); PR #255 NEEDS_REVIEW",
     "ownerDecision": True, "newFamilyPressure": None},
    {"id": "HCG-19", "kind": "FAMILY", "dims": ["family"], "items": ["natto", "baked-beans"],
     "question": "Legumes (natto, baked-beans): vegetable or other?",
     "options": ["vegetable (PR #255 proposal vegetable.legume)", "other (explicit)"],
     "authority": "PR #255 NEEDS_REVIEW",
     "ownerDecision": True, "newFamilyPressure": None},
    {"id": "HCG-20", "kind": "FAMILY", "dims": ["family"], "items": ["french-fries", "mochi"],
     "question": "Starches (french-fries, mochi): vegetable or other?",
     "options": ["french-fries = vegetable (potato is vegetable at runtime)", "other (explicit; DH4-1 puts sweets in other)"],
     "authority": "PR #255 NEEDS_REVIEW (other.starch proposal); runtime potato = vegetable",
     "ownerDecision": True,
     "newFamilyPressure": "A 主食・でんぷん family would be new. If neither option is acceptable → STOP."},
    {"id": "HCG-21", "kind": "FAMILY", "dims": ["family"], "items": ["avocado"],
     "question": "avocado: vegetable or fruit?",
     "options": ["vegetable (PR #255 proposal)", "fruit"],
     "authority": "PR #255 NEEDS_REVIEW",
     "ownerDecision": True, "newFamilyPressure": None},
    {"id": "HCG-22", "kind": "ALIAS", "dims": ["id"], "items": ["red-cabbage"],
     "question": "red-cabbage (紫キャベツ): own id or alias of cabbage?",
     "options": ["own id", "alias of cabbage"], "authority": "PR #255 NEEDS_REVIEW; vegetable either way",
     "ownerDecision": True, "newFamilyPressure": None},
    {"id": "HCG-23", "kind": "ALIAS", "dims": ["id"], "items": ["puntarelle"],
     "question": "puntarelle: own id or alias of chicory?",
     "options": ["own id", "alias of chicory"], "authority": "PR #255 NEEDS_REVIEW; vegetable either way",
     "ownerDecision": True, "newFamilyPressure": None},
    {"id": "HCG-24", "kind": "ID", "dims": ["id", "family"], "items": ["fennel"],
     "question": "フェンネル: bulb (vegetable) or seed / frond (spice / herb)?",
     "options": ["fennel bulb, vegetable", "fennel seed, spice", "fennel frond, herb"],
     "authority": "PR #255 NEEDS_REVIEW (the evidence names only フェンネル)",
     "ownerDecision": True, "newFamilyPressure": None},
    {"id": "HCG-25", "kind": "FAMILY", "dims": ["family"], "items": ["rock-salt", "zaatar"],
     "question": "Seasonings: rock-salt and zaatar → spice or herb? (「スパイス・薬味」 reads oddly for salt.)",
     "options": ["both spice", "zaatar herb, rock-salt spice"],
     "authority": "PR #255 NEEDS_REVIEW",
     "ownerDecision": True,
     "newFamilyPressure": "A 調味料 family would be new. Label copy is OD-H5-C4b's, not a family question."},
    {"id": "HCG-26", "kind": "ALIAS", "dims": ["id"], "items": ["mentaiko"],
     "question": "mentaiko (明太子) vs cod-roe (たらこ): two ids or one?",
     "options": ["two ids (seafood)", "mentaiko alias of cod-roe"], "authority": "PR #255 NEEDS_REVIEW; seafood either way",
     "ownerDecision": True, "newFamilyPressure": None},
    {"id": "HCG-27", "kind": "CONFIRM", "dims": ["family"], "items": ["truffle"],
     "question": "Confirm truffle = vegetable (mushroom identity); its post-bake use is timing, not taxonomy.",
     "options": ["vegetable"],
     "authority": "OD-TAX-6 (identity ≠ timing) + OD-DH4-4 (mushrooms fold into vegetable); catalog category topping",
     "ownerDecision": False, "newFamilyPressure": None},
    {"id": "HCG-29", "kind": "FAMILY", "dims": ["family"], "items": ["bonito-flakes"],
     "question": "bonito-flakes (かつお節): seafood or spice (薬味)?",
     "options": ["seafood (PR #255 proposal)", "spice (as a garnish)"],
     "authority": "PR #255 NEEDS_REVIEW (seafood / seaweed bucket)",
     "ownerDecision": True, "newFamilyPressure": None},
    {"id": "HCG-30", "kind": "CONFIRM", "dims": ["category"], "items": ["kebab-sauce"],
     "question": "Confirm kebab-sauce = sauce (no hint family).",
     "options": ["sauce"],
     "authority": "TAXONOMY_FLAGS['ケバブソース'] = sauce_not_topping; 172 spread-layer list",
     "ownerDecision": False, "newFamilyPressure": None},
    {"id": "HCG-31", "kind": "ALIAS", "dims": ["id"], "items": ["spicy-salami"],
     "question": "spicy-salami (サラミピカンテ): own id, or a variant of salami?",
     "options": ["own id (catalog, used by diavola)", "alias of salami"],
     "authority": "LIKELY_ALIAS_TABLE['サラミピカンテ']='spicy-salami' (distinct from plain salami); meat either way",
     "ownerDecision": True, "newFamilyPressure": None},
    {"id": "HCG-28", "kind": "ID", "dims": ["id"], "items": ["ナッツ"],
     "question": "Generic ナッツ (nutella dessert): which id? (family other is DH4-1's rule for nuts)",
     "options": ["an existing nut id (walnut / almond)", "new id hazelnut", "new generic id nuts"],
     "authority": "AMBIGUOUS_TABLE['ナッツ'] generic_unspecified; DH4-1 header: nuts share `other`",
     "ownerDecision": True, "newFamilyPressure": None},
]


def build() -> dict:
    main = PINS["main"]
    ing_src = git_show(main, "src/data/ingredients.ts")
    runtime_cat = dict(re.findall(r'\bid: "([a-z0-9-]+)",\s*\n\s*category: "(sauce|cheese|topping)"', ing_src))
    tax_src = git_show(main, "src/data/ingredientTaxonomy.ts")
    runtime_fam = dict(re.findall(r'\["([a-z0-9-]+)", "([a-z]+)"\]', tax_src.split("const TOPPING_FAMILY_ROWS", 1)[1].split("];", 1)[0]))
    fam_ids = re.findall(r'"([a-z]+)"', re.search(r"export type AttributeFamilyId = ([^;]+);", tax_src).group(1))
    if sorted(fam_ids) != sorted(FAMILIES):
        sys.exit(f"DH4-1 family ids changed: {fam_ids}")
    cat62 = {r["id"]: r for r in json.loads(git_show(main, "data/recipes/ingredient_master_catalog.json"))["ingredients"]}
    mx = json.loads(git_show(main, "docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json"))
    canon = canonicalizer_tables(git_show(main, "tools/progression2_ingredient_canonicalizer.py"))
    tax = json.loads(git_show(PINS["pr255"], "docs/reports/data/TETO_INGREDIENT-TAXONOMY_172_FRESH-AUDIT.json"))
    trow = {r["id"]: r for r in tax["ingredients"]}
    ttok = {t["token"]: t for t in tax["unresolvedTokens"]}
    hrq = {r["id"]: r for r in tax["humanReviewQueue"] if "id" in r}
    am = json.loads(git_show(PINS["matrix"], "docs/reports/data/TETO_RECIPE-172_AUTHORITY-MATRIX.json"))
    am_rows = {r["recipeId"]: r for r in am["recipes"]}

    # ---- 1. Independent recomputation of the F set (not copied from the matrix) --------------
    ev_rows = {r["evidenceId"]: r for r in mx["rows"]}
    ambiguous_ids = {i for i, r in trow.items()
                     if i not in runtime_fam and r["classificationStatus"] == "NEEDS_REVIEW"
                     and (r["category"] == "topping" or i in hrq)}
    raw_names: dict[str, set] = {}
    recomputed: dict[str, set] = {}
    for rid, r in ev_rows.items():
        ing = r["ingredients"]
        ids = set(ing["canonicalIngredientIds"]) | set(ing["identityIngredientSet"] or [])
        toks = {t["token"] if isinstance(t, dict) else t for t in ing["unresolvedTokens"]}
        for tr in ing.get("tokenTrace", []):
            if tr.get("canonicalId"):
                raw_names.setdefault(tr["canonicalId"], set()).add(tr["token"])
        for t in toks:
            raw_names.setdefault(t, set()).add(t)
        blockers = (ids & ambiguous_ids) | toks
        if blockers:
            recomputed[rid] = blockers
    matrix_f = {rid for rid, r in am_rows.items() if "F" in r["classification"]["all"]}
    if set(recomputed) != matrix_f:
        sys.exit(f"F set mismatch: only recomputed {sorted(set(recomputed) - matrix_f)}, only matrix {sorted(matrix_f - set(recomputed))}")
    # The matrix's per-row F detail must be a SUBSET of ours. It can be smaller: the matrix lists
    # PR #293's `authorityAmbiguous` only for NEEDS_HCG rows, so an ambiguous id inside an
    # UNRESOLVED_TOPPING_TOKEN row is not listed there. Such rows need that id resolved too.
    matrix_underreport = []
    for rid in sorted(matrix_f):
        mb = set()
        for b in am_rows[rid]["productionBlockers"]:
            if b["code"] == "TAXONOMY_NEEDS_HCG_DECISION":
                mb |= set(b["detail"]["ambiguous"])
            elif b["code"] == "UNRESOLVED_INGREDIENT_TOKEN":
                mb.add(b["detail"])
        if not mb <= recomputed[rid]:
            sys.exit(f"F detail not a subset on {rid}: {sorted(mb)} vs {sorted(recomputed[rid])}")
        if mb != recomputed[rid]:
            matrix_underreport.append({"recipeId": rid, "matrixListed": sorted(mb), "alsoBlocking": sorted(recomputed[rid] - mb)})

    items = sorted({i for s in recomputed.values() for i in s})
    dec_by_item: dict[str, list] = {}
    for d in DECISIONS:
        for i in d["items"]:
            dec_by_item.setdefault(i, []).append(d["id"])
    missing = [i for i in items if i not in dec_by_item]
    extra = sorted({i for d in DECISIONS for i in d["items"]} - set(items))
    if missing or extra:
        sys.exit(f"DECISIONS coverage: missing {missing}, not blocking {extra}")
    for d in DECISIONS:
        for opt in d["options"]:
            pass
        if d["kind"] == "FAMILY":
            for i in d["items"]:
                if i in trow and trow[i]["family"] not in FAMILIES:
                    sys.exit(f"{i}: proposed family outside the 7")

    # ---- 2. Per-blocker-item rows ----------------------------------------------------------
    usage172 = {}
    for rid, r in ev_rows.items():
        ing = r["ingredients"]
        for i in set(ing["canonicalIngredientIds"]) | set(ing["identityIngredientSet"] or []) | {t["token"] if isinstance(t, dict) else t for t in ing["unresolvedTokens"]}:
            usage172.setdefault(i, set()).add(rid)

    def next_primary(rid: str) -> str:
        rest = [c for c in am_rows[rid]["classification"]["all"] if c != "F"]
        for c in PRECEDENCE:
            if c in rest:
                return c
        return "A"

    item_rows = []
    for i in items:
        f_rows = sorted(r for r, s in recomputed.items() if i in s)
        sole = sorted(r for r in f_rows if recomputed[r] == {i})
        is_token = i not in trow
        t = trow.get(i, {})
        tt = ttok.get(i, {})
        h = hrq.get(i, {})
        # blocker dimensions come from the questions that need judgment; CONFIRM questions do not count
        dims = sorted({dim for dec in DECISIONS if i in dec["items"] and dec["kind"] != "CONFIRM" for dim in dec["dims"]})
        kinds = sorted({dec["kind"] for dec in DECISIONS if i in dec["items"]})
        if is_token:
            cat, cat_src = tt.get("indicativeCategory"), "indicative (PR #255 unresolvedTokens)"
            fam = tt.get("indicativeFamily")
        else:
            cat = runtime_cat.get(i) or t.get("category")
            cat_src = "runtime" if i in runtime_cat else t.get("categorySource", "").split(":")[0]
            fam = t.get("family")
        category_open = "category" in dims
        blocker_types = []
        if is_token:
            blocker_types.append("CANONICAL_ID_MISSING")
        if "id" in dims and not is_token:
            blocker_types.append("ALIAS_OR_ID_RELATION")
        if category_open:
            blocker_types.append("CATEGORY_UNDECIDED")
        if "family" in dims and not category_open:
            blocker_types.append("FAMILY_UNDECIDED")
        confirm_only = kinds == ["CONFIRM"]
        if confirm_only:
            blocker_types.append("CONFIRM_ONLY")
        alias_only = (not category_open) and ("family" not in dims) and kinds in (["ALIAS"], ["ID"], ["ALIAS", "ID"]) \
            and all(DECISIONS_BY_ID[x]["kind"] in ("ALIAS", "ID") for x in dec_by_item[i]) \
            and (cat in ("sauce", "cheese") or fam in FAMILIES)
        item_rows.append({
            "item": i,
            "rawNames": sorted(raw_names.get(i, [])) or ([t["nameJa"]] if t.get("nameJa") else []),
            "displayName": t.get("nameJa") or i,
            "isUnresolvedToken": is_token,
            "canonicalIdCandidates": [] if is_token else [i],
            "relatedIdsFromAmbiguityTable": (tt.get("relatedIds") or []) if is_token else [],
            "idExists": {
                "runtime": i in runtime_cat,
                "catalog62": i in cat62,
                "canonicalizerRegistry": i in canon["GENUINELY_NEW_REGISTRY"].values(),
                "pr255Row": i in trow,
            },
            "canonicalizationStatus": t.get("canonicalizationStatus") or tt.get("canonicalizationStatus"),
            "aliasCandidates": sorted(set((t.get("aliasesObserved") or []) + (t.get("likelyAliasNames") or [])
                                          + [k for k, v in canon["LIKELY_ALIAS_TABLE"].items() if v[0] == i]
                                          + [k for k, v in canon["AMBIGUOUS_TABLE"].items() if i in v[0]])),
            "ambiguity": h.get("reason") or tt.get("note") or t.get("note"),
            "reviewBucket": h.get("bucket"),
            "taxonomyFlag": canon["TAXONOMY_FLAGS"].get(t.get("nameJa") or i) or tt.get("taxonomyFlag"),
            "categoryCandidate": cat,
            "categorySource": cat_src,
            "categoryOpen": category_open,
            "familyCandidate": None if category_open and cat != "topping" else fam,
            "familyCandidateNote": ("withheld: category undecided (family only after the category)" if category_open else
                                    "not applicable: sauce / cheese carry no hint family" if cat in ("sauce", "cheese") else
                                    "PR #255 proposal / token indication, NOT authority"),
            "solvableWithin7Families": True,
            "confidence": t.get("confidence") or "unknown",
            "existingAuthority": [DECISIONS_BY_ID[x]["authority"] for x in dec_by_item[i]],
            "decisions": dec_by_item[i],
            "blockerTypes": blocker_types,
            "confirmOnly": confirm_only,
            "aliasOnly": bool(alias_only) and i in ALIAS_TARGETS,
            "idOnlyNewId": bool(alias_only) and i not in ALIAS_TARGETS,
            "aliasTargetsExisting": ALIAS_TARGETS.get(i, []),
            "humanReviewRequired": not confirm_only,
            "usage172Rows": len(usage172.get(i, [])),
            "fRows": len(f_rows),
            "fRowsSoleBlocker": len(sole),
            "fRowIds": f_rows,
        })
    item_rows.sort(key=lambda x: (-x["fRowsSoleBlocker"], -x["fRows"], x["item"]))

    # ---- 3. Decisions: release effect and greedy ordering ------------------------------------
    def covered(chosen: set) -> set:
        done = {i for d in DECISIONS if d["id"] in chosen for i in d["items"]}
        # an item is resolved only when ALL of its decisions are taken
        return {i for i in items if set(dec_by_item[i]) <= chosen}

    def released(chosen: set) -> list:
        res = covered(chosen)
        return sorted(r for r, s in recomputed.items() if s <= res)

    dec_rows = []
    for d in DECISIONS:
        alone = released({d["id"]})
        touch = sorted(r for r, s in recomputed.items() if s & set(d["items"]))
        dec_rows.append({**{k: d[k] for k in ("id", "kind", "dims", "items", "question", "options", "authority", "ownerDecision", "newFamilyPressure")},
                         "fRowsTouched": len(touch), "fRowsReleasedAlone": len(alone), "releasedAloneIds": alone})

    def run_greedy(start: set) -> list:
        greedy, chosen = [], set(start)
        remaining = set(recomputed)
        ids_all = [d["id"] for d in DECISIONS]
        while remaining:
            base = set(released(chosen))
            best = None
            free = [x for x in ids_all if x not in chosen]
            cands = [(x,) for x in free] + [(x, y) for n, x in enumerate(free) for y in free[n + 1:]]
            for c in cands:
                gain = len(set(released(chosen | set(c))) - base)
                if gain == 0 and len(c) == 2:
                    continue
                owner = sum(DECISIONS_BY_ID[x]["ownerDecision"] for x in c)
                key = (gain / len(c), -len(c), gain, -owner, tuple(reversed(c)))
                if best is None or key > best[0]:
                    best = (key, c)
            for x in best[1]:
                chosen.add(x)
                now = set(released(chosen))
                greedy.append({"step": len(greedy) + 1, "decision": x, "bundle": list(best[1]),
                               "gain": len(now - base), "fRemaining": len(set(recomputed) - now),
                               "ownerDecision": DECISIONS_BY_ID[x]["ownerDecision"]})
                base = now
            remaining = set(recomputed) - set(released(chosen))
        return greedy

    greedy = run_greedy(set())
    confirm_ids = {d["id"] for d in DECISIONS if not d["ownerDecision"]}
    owner_curve = [{"ownerDecisions": 0, "decisions": sorted(confirm_ids), "fRemaining": len(recomputed) - len(released(confirm_ids))}]
    n_owner = 0
    for g in run_greedy(confirm_ids):
        n_owner += 1
        owner_curve.append({"ownerDecisions": n_owner, "decisions": [g["decision"]], "bundle": g["bundle"], "fRemaining": g["fRemaining"]})
    after_confirm = len(recomputed) - len(released(confirm_ids))
    top10 = {g["decision"] for g in greedy[:10]}
    rel10 = released(top10)
    nxt = {}
    for r in rel10:
        nxt[next_primary(r)] = nxt.get(next_primary(r), 0) + 1
    all_rel_next = {}
    for r in recomputed:
        c = next_primary(r)
        all_rel_next[c] = all_rel_next.get(c, 0) + 1

    # minimal owner set to reach thresholds
    def owner_decisions_for(k: int) -> int:
        return sum(1 for g in greedy[:k] if g["ownerDecision"])

    tokens = [x for x in item_rows if x["isUnresolvedToken"]]
    summary = {
        "A_fRows": len(recomputed),
        "A_rootCauseItems": len(items),
        "A_rowsByBlockerCount": {str(n): sum(1 for s in recomputed.values() if len(s) == n) for n in sorted({len(s) for s in recomputed.values()})},
        "B_canonicalIdMissing": len(tokens),
        "B_canonicalIdMissingItems": [x["item"] for x in tokens],
        "C_categoryUndecided": sum(1 for x in item_rows if x["categoryOpen"]),
        "C_categoryUndecidedItems": sorted(x["item"] for x in item_rows if x["categoryOpen"]),
        "D_familyUndecided": sum(1 for x in item_rows if "FAMILY_UNDECIDED" in x["blockerTypes"]),
        "D_familyUndecidedItems": sorted(x["item"] for x in item_rows if "FAMILY_UNDECIDED" in x["blockerTypes"]),
        "E_aliasOnly": sum(1 for x in item_rows if x["aliasOnly"]),
        "E_aliasOnlyItems": sorted(x["item"] for x in item_rows if x["aliasOnly"]),
        "E_idOnlyNewIdItems": sorted(x["item"] for x in item_rows if x["idOnlyNewId"]),
        "F_humanReviewRequired": sum(1 for x in item_rows if x["humanReviewRequired"]),
        "G_existingAuthorityOnly": sum(1 for x in item_rows if x["confirmOnly"]),
        "G_existingAuthorityOnlyItems": sorted(x["item"] for x in item_rows if x["confirmOnly"]),
        "G_rowsReleasedByConfirmOnly": len(recomputed) - after_confirm,
        "H_rowsReleasedByTop10": len(rel10),
        "H_fAfterTop10": len(recomputed) - len(rel10),
        "H_top10": [g["decision"] for g in greedy[:10]],
        "H_top10OwnerDecisions": owner_decisions_for(10),
        "ownerCurveAfterConfirmOnly": owner_curve,
        "decisionsToClearAllF": len(greedy),
        "ownerDecisionsToClearAllF": owner_decisions_for(len(greedy)),
        "newFamilyRequired": 0,
        "newFamilyPressureDecisions": [d["id"] for d in DECISIONS if d["newFamilyPressure"]],
        "releasedTop10NextPrimaryClass": dict(sorted(nxt.items())),
        "releasedTop10ToB": sorted(r for r in rel10 if next_primary(r) == "B"),
        "allFToB": sorted(r for r in recomputed if next_primary(r) == "B"),
        "allFNextPrimaryClass": dict(sorted(all_rel_next.items())),
        "matrixUnderreportedRows": matrix_underreport,
        "fRowsAlsoE": sum(1 for r in recomputed if "E" in am_rows[r]["classification"]["all"]),
    }
    return {
        "schemaNote": "172 Recipe Taxonomy / HCG authority pack. Docs/data only; NOT an authority. Decisions are QUESTIONS for the Owner / HCG (OD-TAX-7), not answers. Nothing here is production data.",
        "generatedBy": "tools/recipe172_taxonomy_hcg.py",
        "pins": PINS,
        "families": FAMILIES,
        "resolutionOrder": ["raw label", "canonical ingredient id", "category (sauce / cheese / topping)", "taxonomy family (7, topping only)"],
        "summary": summary,
        "greedy": greedy,
        "decisions": sorted(dec_rows, key=lambda d: (-d["fRowsReleasedAlone"], -d["fRowsTouched"], d["id"])),
        "items": item_rows,
        "fRows": [{"recipeId": r, "nameJa": ev_rows[r]["nameJa"], "blockers": sorted(s),
                   "decisionsNeeded": sorted({x for i in s for x in dec_by_item[i]}),
                   "otherClasses": [c for c in am_rows[r]["classification"]["all"] if c != "F"],
                   "nextPrimaryIfFCleared": next_primary(r)} for r, s in sorted(recomputed.items())],
    }


DECISIONS_BY_ID = {d["id"]: d for d in DECISIONS}

# For ID-only items: the EXISTING ids (runtime / catalog / canonicalizer / PR #255 row) that at least
# one decision option maps the raw label to. Presence here = "resolvable by an alias alone".
ALIAS_TARGETS = {
    "wurstel": ["sausage"], "スパイシーソーセージ": ["sausage"], "spicy-salami": ["salami"],
    "ひき肉": ["ground-beef"], "ground-beef": ["beef"], "肉": ["beef", "pork", "chicken", "lamb"],
    "チーズ": ["mozzarella", "cheddar", "parmigiano"], "ナッツ": ["walnut", "almond"],
    "ホワイトソース": ["fromage-blanc-sauce"], "mentaiko": ["cod-roe"], "red-cabbage": ["cabbage"],
    "puntarelle": ["chicory"],
}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    text = json.dumps(build(), ensure_ascii=False, indent=1) + "\n"
    if a.check:
        if not OUT.exists() or OUT.read_text() != text:
            sys.exit("DRIFT: regenerate")
        print("OK, no drift")
        return
    OUT.write_text(text)
    print(f"wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
