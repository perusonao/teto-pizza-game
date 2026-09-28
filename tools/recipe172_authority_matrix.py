#!/usr/bin/env python3
"""
172 Recipe Authority Matrix Fresh Audit. Docs/data/tools only. It is NOT a production authority
and NOT wired into CI.

For each of the 172 PIZZA DB evidence rows, it records which authorities that production would
need already exist, which exist only as candidates, and which are missing. It is a CONSUMER of
other lanes:

  - ingredient taxonomy  -> production DH4-1 rows on main; the Hint 5.0 Taxonomy Coverage audit
                            (PR #293, reference, not authority) for coverage tiers. It never
                            proposes or changes a family.
  - Hint 5.0 key / sub   -> RECIPE_HINT_ROLES at the approved H5-1 head (Issue #292). Runtime 25
                            only. Nothing is authored for 172 here; candidates are labelled as such.
  - Cooking Techniques   -> the TQ SSOT and src/data/techniques.ts on main. No technique id is made.
  - Cooking Steps        -> the Post-W1 Cooking Steps design (PR #295, open, not authority) for the
                            mechanic class and the candidate CS phase. No step semantics are made.
  - Wave 2               -> the OD-W2 ledger and the W2-A authoring set (branch, approved values).

Every input is read from a pinned git object, so the output does not depend on the checkout.
Missing objects: `git fetch origin main <branches>` (see PINS).

Usage:
  python3 tools/recipe172_authority_matrix.py           # writes JSON + CSV
  python3 tools/recipe172_authority_matrix.py --check   # rebuilds and fails on byte drift
"""
import argparse
import csv
import io
import json
import re
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_JSON = ROOT / "docs/reports/data/TETO_RECIPE-172_AUTHORITY-MATRIX.json"
OUT_CSV = ROOT / "docs/reports/data/TETO_RECIPE-172_AUTHORITY-MATRIX.csv"

PINS = {
    "main": ("86b48fd51423a8f76db5398ab88ecfd944e2ae10", "origin/main (Merge PR #291)"),
    "hint5": ("abce62ad9f88044746850411af1c44305c979439", "claude/hint-5-0-fresh-audit-cdgm9e (H5-2 head; H5-1 approved; no PR, not merged)"),
    "taxCoverage": ("1bb4f9d3a10172b8f6a3f4bb2af794db2435db4c", "PR #293 head (open, not authority)"),
    "cookingSteps": ("7d48669d8100daadddf0b17ad78d0a7de19fcd6d", "PR #295 head (open, not authority)"),
    "taxonomyAudit": ("e221e36c9278311dfecc22263b5467dab7984555", "PR #255 head (open, OD-TAX-1..9 recorded; rows PROPOSED only)"),
    "wave2": ("2bc40e41f320f9c46ea6110e9df4d50866325cf3", "claude/wave2-runtime-recipe-design-os06j1 (W2-A1; not merged)"),
}

PAINT_SAUCES_ON_MAIN = ("tomato-sauce", "olive-oil", "pesto")

# Consumer mapping: 172 mechanic key -> (Cooking Technique status, candidate Cooking Steps phase).
# The technique column quotes OD-TQ-2 (APPROVED classification) and src/data/techniques.ts; it never
# creates an id. The CS column quotes PR #295 §5 (a candidate phase plan, not authority).
MECHANIC_DEPENDENCIES = {
    "NO_SAUCE": ("TQ_REGISTERED: 'no-sauce' (TQ-1). The production requirement is activated by TQ-1D (not shipped); OD-W2-8 is open for W2-C", "none (PR #295: DATA_ONLY after TQ-1D)"),
    "LATE_ADDITION:post_bake": ("CANDIDATE / REVIEW REQUIRED: OD-TQ-2 classifies post-bake as a technique (TQ-2); no technique id exists", "CS-1 -> CS-2 -> CS-3 (=TQ-2)"),
    "LATE_ADDITION:mid_bake": ("CANDIDATE / REVIEW REQUIRED: not separately classified by OD-TQ-2", "CS-9+ (mid-bake)"),
    "LATE_ADDITION:unresolved:mid_bake|post_bake": ("CANDIDATE / REVIEW REQUIRED: the timing mode itself is unresolved", "unresolved"),
    "MULTI_SPREAD_LAYER": ("CANDIDATE / REVIEW REQUIRED: OD-TQ-2 classifies multi-spread as a technique (TQ-3); no id; OD-W2-9 open", "CS-6 (=TQ-3)"),
    "DOUGH_VARIANT": ("NOT A TECHNIQUE: OD-TQ-2 C2 (dough type = material)", "CS-7"),
    "STEP_ORDER": ("CANDIDATE / REVIEW REQUIRED: not classified by OD-TQ-2", "CS-8"),
    "ZONED_PLACEMENT": ("CANDIDATE / REVIEW REQUIRED: not classified by OD-TQ-2", "CS-8"),
    "PAN_BAKE": ("CANDIDATE / REVIEW REQUIRED: OD-TQ-2 later tier (pan)", "CS-9+"),
    "DOUGH_SHAPE_TARGET": ("CANDIDATE / REVIEW REQUIRED: OD-TQ-2 later tier (shape)", "CS-9+"),
    "ENCLOSE": ("CANDIDATE / REVIEW REQUIRED: OD-TQ-2 later tier (enclose / fold)", "CS-9+"),
    "PREP_STEP": ("CANDIDATE / REVIEW REQUIRED: OD-TQ-2 'other' later tier", "CS-9+"),
    "LAMINATE": ("CANDIDATE / REVIEW REQUIRED: OD-TQ-2 'other' later tier", "CS-9+"),
    "FRY_COOK": ("CANDIDATE / REVIEW REQUIRED: OD-TQ-2 'other' later tier", "CS-9+"),
    "NO_CUT_OR_CUT_UNSPECIFIED": ("NOT A TECHNIQUE: OD-TQ-2 (no CUT); OD-W2-4 (no dough evidence -> no CUT)", "none (data: CUT profile)"),
}

# Severity of a mechanic for the A-F engine axis. This consumes PR #295's class rules exactly,
# except NO_SAUCE: PR #295 files it as DATA_ONLY *after* TQ-1D. TQ-1D is not shipped and it
# changes ReferencePizza / UI (TQ SSOT §6), so here it is a C (small engine) dependency. The
# disagreement is recorded per row (engineAxisNote).
ENGINE_CLASS = {
    "NO_SAUCE": "C", "LATE_ADDITION:post_bake": "C", "DOUGH_VARIANT": "C", "STEP_ORDER": "C",
    "ZONED_PLACEMENT": "C",
    "MULTI_SPREAD_LAYER": "D", "LATE_ADDITION:mid_bake": "D", "PAN_BAKE": "D", "DOUGH_SHAPE_TARGET": "D",
    "ENCLOSE": "D", "PREP_STEP": "D", "LAMINATE": "D", "FRY_COOK": "D",
    "LATE_ADDITION:unresolved:mid_bake|post_bake": "E",
    "NO_CUT_OR_CUT_UNSPECIFIED": "B",
}
# Matrix hard blockers that mean "authority insufficient" (E). UNRESOLVED_INGREDIENT is F.
E_BLOCKERS = {"BASE_SAUCE_UNSPECIFIED", "COMPOSITION_CONFLICT_CANDIDATE", "COMPOSITION_CONFLICT_SHIPPED",
              "DISCOVERY_COLLISION", "EVIDENCE_GAP", "SCOPE_QUESTION", "MECHANIC_INTERPRETATION"}
PRECEDENCE = ["F", "E", "D", "C", "B", "A"]

# Approved Owner decisions that override a matrix field for a specific row (quoted, never invented).
# OD-W2-7 (a) (docs/design/TETO_WAVE2_OWNER-DECISION-LEDGER.md on the Wave 2 branch): vongole uses
# olive oil as its base (PAINT_TEMPORARY, fugazza / New Haven style), so it is not a no-sauce row.
APPROVED_OVERRIDES = {
    "vongole-pizzadb": {"dropMechanics": ["NO_SAUCE"], "noSauceFlag": "NO (OD-W2-7 a: olive-oil base)",
                        "decision": "OD-W2-7 (a)"},
}
# Short label of the engine lane that gates a candidate wave (consumer wording).
WAVE_GATE = {
    "NO_SAUCE": "TQ-1D + OD-W2-8 (W2-C)", "LATE_ADDITION:post_bake": "CS-3 / TQ-2",
    "MULTI_SPREAD_LAYER": "CS-6 / TQ-3 + OD-W2-9 (W2-D)", "DOUGH_VARIANT": "CS-7",
    "STEP_ORDER": "CS-8", "ZONED_PLACEMENT": "CS-8",
}

CLASS_LABELS = {
    "A": "current engine + current authority (can ship as is)",
    "B": "data authority addition only",
    "C": "small engine extension",
    "D": "major mechanic",
    "E": "authority insufficient",
    "F": "ingredient ID / taxonomy blocker",
}


def git_show(sha, path):
    try:
        return subprocess.run(["git", "show", f"{sha}:{path}"], cwd=ROOT, capture_output=True,
                              text=True, check=True).stdout
    except subprocess.CalledProcessError:
        raise SystemExit(f"missing git object {sha[:8]}:{path}. Run: git fetch origin main "
                         "claude/hint-5-0-fresh-audit-cdgm9e claude/hint-5-0-taxonomy-audit-g9d1u9 "
                         "claude/post-w1-cooking-steps-design-2nomy3 claude/172-recipe-ingredient-audit-d33d8i "
                         "claude/wave2-runtime-recipe-design-os06j1")


def gjson(pin, path):
    return json.loads(git_show(PINS[pin][0], path))


def runtime_ingredients(src):
    return {m[0]: {"category": m[1], "nameJa": m[2]}
            for m in re.findall(r'id: "([^"]+)",\s*category: "(\w+)",\s*nameJa: "([^"]+)"', src)}


def runtime_recipes(src):
    body = src[src.index("export const RECIPES"):]
    out = {}
    for rid, block in re.findall(r'\n  \{\s*id: "([^"]+)",(.*?)(?=\n  \{\s*id: "|\n\] as const)', body, re.S):
        out[rid] = {"ids": sorted(set(re.findall(r'ingredientId: "([^"]+)"', block))),
                    "nameJa": (re.search(r'nameJa: "([^"]+)"', block) or [None, None])[1]}
    return out


def hint_roles(src):
    out = {}
    for rid, key, subs in re.findall(r'"?([a-z0-9-]+)"?: \{ hintKeyToppingId: (null|"[^"]+"), hintSubToppingOrder: \[([^\]]*)\] \}', src):
        out[rid] = {"key": None if key == "null" else key.strip('"'),
                    "subs": re.findall(r'"([^"]+)"', subs)}
    return out


def taxonomy_rows(src):
    rows = src[src.index("TOPPING_FAMILY_ROWS"):]
    rows = rows[:rows.index("];")]
    return dict(re.findall(r'\["([^"]+)", "(\w+)"\]', rows))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    data = build()
    text = json.dumps(data, ensure_ascii=False, indent=1) + "\n"
    csv_text = to_csv(data["recipes"])
    if args.check:
        bad = [p for p, t in ((OUT_JSON, text), (OUT_CSV, csv_text))
               if not p.exists() or p.read_text(encoding="utf-8") != t]
        if bad:
            print("DRIFT: " + ", ".join(str(p.relative_to(ROOT)) for p in bad), file=sys.stderr)
            sys.exit(1)
        print("OK: no drift")
        return
    OUT_JSON.write_text(text, encoding="utf-8")
    OUT_CSV.write_text(csv_text, encoding="utf-8")
    print(f"wrote {OUT_JSON.relative_to(ROOT)} and {OUT_CSV.relative_to(ROOT)}")


def build():
    main_sha = PINS["main"][0]
    matrix = gjson("main", "docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json")
    catalog = {i["id"]: i for i in gjson("main", "data/recipes/ingredient_master_catalog.json")["ingredients"]}
    rt_ing = runtime_ingredients(git_show(main_sha, "src/data/ingredients.ts"))
    rt_rec = runtime_recipes(git_show(main_sha, "src/data/recipes.ts"))
    prod_tax = taxonomy_rows(git_show(main_sha, "src/data/ingredientTaxonomy.ts"))
    techniques = re.findall(r'\{ id: "([^"]+)", nameJa', git_show(main_sha, "src/data/techniques.ts"))
    roles = hint_roles(git_show(PINS["hint5"][0], "src/data/recipeHintRoles.ts"))
    cov = gjson("taxCoverage", "docs/reports/data/TETO_HINT-5_TAXONOMY-172-COVERAGE_Fresh-Audit.json")
    cs = gjson("cookingSteps", "docs/reports/data/TETO_POST-W1_COOKING-STEPS_172-MECHANIC-CLASSIFICATION.json")
    tax255 = gjson("taxonomyAudit", "docs/reports/data/TETO_INGREDIENT-TAXONOMY_172_FRESH-AUDIT.json")
    w2 = gjson("wave2", "docs/design/data/TETO_WAVE2_RUNTIME-RECIPE_CANDIDATES.json")
    w2_tax = taxonomy_rows(git_show(PINS["wave2"][0], "src/data/ingredientTaxonomy.ts"))
    w2a_ids = next(o["recipeEvidenceIds"] for o in w2["waveOptions"] if o["id"] == "W2-A_LEAN_DATA_ONLY")
    w2_options = {o["id"]: o["recipeEvidenceIds"] for o in w2["waveOptions"]}

    if len(rt_rec) != 25 or len(rt_ing) != 29 or len(roles) != 25:
        raise SystemExit(f"unexpected runtime shape: recipes {len(rt_rec)} ingredients {len(rt_ing)} roles {len(roles)}")
    if set(roles) != set(rt_rec):
        raise SystemExit("Hint 5.0 roles do not cover exactly the runtime recipes")

    cs_rows = {r["evidenceId"]: r for r in cs["rows"]}
    cov_rows = {r["evidenceId"]: r for r in cov["recipes172"]}
    w2_rows = {r["evidenceId"]: r for r in w2["rows"]}
    names = {}
    for r in tax255["ingredients"]:
        names[r["id"]] = sorted({n for n in [r["nameJa"], *r["aliasesObserved"], *r["likelyAliasNames"]] if n})
    for i, v in rt_ing.items():
        names.setdefault(i, [])
        if v["nameJa"] not in names[i]:
            names[i] = sorted(names[i] + [v["nameJa"]])

    def category_of(i):
        if i in rt_ing:
            return rt_ing[i]["category"], "PRODUCTION (src/data/ingredients.ts)"
        if i in catalog:
            return catalog[i]["category"], "CATALOG_62 (data/recipes/ingredient_master_catalog.json)"
        u = cov["universe172"].get(i)
        if u:
            return u["category"], f"UNCONFIRMED ({u['categorySource']}; PR #293)"
        return None, "UNKNOWN"

    recipes = []
    for r in matrix["rows"]:
        eid = r["evidenceId"]
        ing = r["ingredients"]
        ids = sorted(set(ing["identityIngredientSet"] or ing["canonicalIngredientIds"]))
        tokens = [t["token"] for t in ing["unresolvedTokens"]]
        cats = {i: category_of(i) for i in ids}
        by_cat = defaultdict(list)
        for i, (c, _src) in cats.items():
            by_cat[c or "unknown"].append(i)
        for t in tokens:
            tc = cov["unresolvedTokens172"].get(t, {}).get("indicativeCategory")
            by_cat[f"{tc or 'unknown'}:unresolved"].append(t)
        toppings = sorted(by_cat.get("topping", []))
        topping_tokens = sorted(by_cat.get("topping:unresolved", []))
        sauces = sorted(by_cat.get("sauce", []))
        cheeses = sorted(by_cat.get("cheese", []))
        cat_unconfirmed = sorted(i for i, (_c, s) in cats.items() if s.startswith("UNCONFIRMED") or s == "UNKNOWN")

        # --- runtime mapping ---------------------------------------------------------------
        csr = cs_rows[eid]
        rt_id = csr["runtimeRecipeId"] or (r["phase0"].get("correspondsToExistingCatalogId")
                                           if r["phase0"].get("correspondsToExistingCatalogId") in rt_rec else None)
        runtime = {"runtimeRecipeId": rt_id, "match": "NONE", "addedByRow": [], "missingFromRow": []}
        if rt_id:
            rset = set(rt_rec[rt_id]["ids"])
            runtime["addedByRow"] = sorted(set(ids) - rset)
            runtime["missingFromRow"] = sorted(rset - set(ids))
            runtime["match"] = "EXACT" if not runtime["addedByRow"] and not runtime["missingFromRow"] and not tokens else "DIVERGENT"

        # --- taxonomy completeness (consumer of production rows + PR #293) --------------------
        topping_tax = []
        for t in toppings:
            u = cov["universe172"].get(t, {})
            topping_tax.append({"id": t, "productionFamily": prod_tax.get(t),
                                "w2aBranchFamily": w2_tax.get(t) if t not in prod_tax else None,
                                "coverageStatus": u.get("status"), "pr255Status": u.get("pr255Status")})
        covr = cov_rows[eid]
        n_top = len(toppings) + len(topping_tokens)
        tax_complete = n_top == len([x for x in topping_tax if x["productionFamily"]]) and not topping_tokens

        # --- Hint 5.0 ------------------------------------------------------------------------
        role = roles.get(rt_id) if runtime["match"] == "EXACT" else None
        if role is not None:
            key_status, key_cand, key_basis = "AUTHORITY_EXISTS", role["key"], "RECIPE_HINT_ROLES (H5-1 approved, abce62a; not on main)"
            sub_status = "AUTHORITY_EXISTS"
            sub_count = len(role["subs"])
        else:
            key_cand, key_basis = None, None
            if n_top == 0 and not tokens:
                key_status, key_basis = "NOT_APPLICABLE_NO_TOPPING", "0 toppings: G17 requires key = null (the quattro-formaggi C1a precedent)"
            else:
                key_status = "MISSING"
                if rt_id and roles[rt_id]["key"] in toppings:
                    key_cand, key_basis = roles[rt_id]["key"], f"CANDIDATE: the runtime key of divergent '{rt_id}' is still a topping of this row"
                elif len(toppings) == 1 and not topping_tokens:
                    key_cand, key_basis = toppings[0], "CANDIDATE: the only topping (forced by G17 if a key exists)"
                else:
                    hits = [t for t in toppings if any(n and n in (r["nameJa"] or "") for n in names.get(t, []))]
                    if len(hits) == 1:
                        key_cand, key_basis = hits[0], "CANDIDATE: named in the recipe name (H5-0 §6.4 tie-break step 1; a guideline candidate, not authority)"
                    elif hits:
                        key_basis = f"CANDIDATE AMBIGUOUS: several toppings are named in the recipe name {hits}"
                if key_cand:
                    key_status = "CANDIDATE_ONLY"
            if key_status == "NOT_APPLICABLE_NO_TOPPING":
                sub_status, sub_count = "NOT_APPLICABLE", 0
            elif key_cand:
                sub_count = n_top - 1
                sub_status = "NOT_NEEDED_0_SUBS" if sub_count == 0 else ("FORCED_1_SUB (candidate)" if sub_count == 1 else "MISSING")
            else:
                sub_count = None
                sub_status = "MISSING"
        # C1-P risk (consumer signal only): the candidate is an aroma (herb / spice family, production
        # or PR #293 proposed) while the row has a non-aroma topping. C1-P prefers the main topping.
        def fam(i):
            return prod_tax.get(i) or cov["universe172"].get(i, {}).get("proposedFamily")
        c1p_risk = bool(key_cand and key_status == "CANDIDATE_ONLY" and fam(key_cand) in ("herb", "spice")
                        and any(fam(t) not in ("herb", "spice", None) for t in toppings if t != key_cand))
        hint5 = {
            "allIngredientIdsResolve": not tokens and ing["complete"],
            "roleCategoryResolves": not tokens and not cat_unconfirmed,
            "hintEligibleToppingsExactlyOneFamily": tax_complete,
            "keySubAuthorityExists": key_status in ("AUTHORITY_EXISTS", "NOT_APPLICABLE_NO_TOPPING") and sub_status in ("AUTHORITY_EXISTS", "NOT_APPLICABLE"),
        }
        hint5["hint5ProductionReady"] = all(hint5.values())

        # --- mechanics -----------------------------------------------------------------------
        override = APPROVED_OVERRIDES.get(eid, {})
        keys = [k for k in csr["mechanicKeys"] if k not in override.get("dropMechanics", [])]
        cand_caps = sorted(set(r["candidateCapabilities"]))
        sb = r["sauceBase"]
        spreads = sb.get("spreadLayers") or []
        post = [f for f in (r["postBakeFinish"] or []) if f["mode"] == "post_bake"]
        mid = [f for f in (r["postBakeFinish"] or []) if "mid_bake" in f["mode"]]

        def flag(required, candidate=False, unknown=False):
            return "REQUIRED" if required else ("CANDIDATE" if candidate else ("UNKNOWN" if unknown else "NO"))

        flags = {
            "noSauce": override.get("noSauceFlag") or flag(sb["status"] == "none", unknown=sb["status"] in ("unspecified", "listed_unresolved")),
            "noCheese": flag(ing["complete"] and not cheeses and not any(t.startswith("cheese") for t in by_cat if t.endswith(":unresolved") and by_cat[t]), unknown=not ing["complete"]),
            "toppingLess": flag(ing["complete"] and n_top == 0, unknown=not ing["complete"]),
            "lateAddition": flag("LATE_ADDITION:post_bake" in keys, candidate="LATE_ADDITION" in cand_caps or any(f["strength"] == "repo_inference" for f in post)),
            "midBakeAddition": flag("LATE_ADDITION:mid_bake" in keys, unknown="LATE_ADDITION:unresolved:mid_bake|post_bake" in keys),
            "multiSpread": flag("MULTI_SPREAD_LAYER" in keys, candidate="MULTI_SPREAD_LAYER" in cand_caps),
            "specialDough": flag("DOUGH_VARIANT" in keys),
            "pan": flag("PAN_BAKE" in keys or bool(r["cookingProfile"]["pan"])),
            "boatShape": flag(r["dough"]["shape"] == "boat"),
            "fold": flag(r["placementLayering"]["enclosure"] in ("fold",) or "ENCLOSE" in keys),
            "fry": flag(r["cookingProfile"]["method"] == "fry" or "FRY_COOK" in keys),
            "otherSpecial": sorted(k for k in keys if k in ("STEP_ORDER", "ZONED_PLACEMENT", "PREP_STEP", "LAMINATE", "DOUGH_SHAPE_TARGET", "NO_CUT_OR_CUT_UNSPECIFIED"))
                            + [f"candidate:{c}" for c in cand_caps if c not in ("LATE_ADDITION", "MULTI_SPREAD_LAYER")],
        }
        technique_deps = [{"mechanic": k, "status": MECHANIC_DEPENDENCIES[k][0]} for k in keys]
        steps_deps = [{"mechanic": k, "candidatePhase": MECHANIC_DEPENDENCIES[k][1]} for k in keys]
        for c in cand_caps:
            technique_deps.append({"mechanic": f"candidate:{c}", "status": "CANDIDATE / REVIEW REQUIRED (repo-inference or context-only evidence; OD-TQ-12: not promoted)"})

        # --- current engine expressibility (main 86b48fd) ------------------------------------
        reasons = []
        if tokens or not ing["complete"]:
            reasons.append("unresolved ingredient tokens")
        new_ids = sorted(i for i in ids if i not in rt_ing)
        if new_ids:
            reasons.append(f"ingredients not in runtime: {new_ids}")
        if sb["status"] == "none" and "NO_SAUCE" in keys:
            reasons.append("no sauce (TQ-1D not shipped)")
        elif sb["status"] in ("unspecified", "listed_unresolved"):
            reasons.append(f"sauce {sb['status']}")
        elif sb["status"] == "none" and override:
            reasons.append(f"sauce {spreads[0]} base per {override['decision']}") if spreads and spreads[0] not in PAINT_SAUCES_ON_MAIN else None
        elif len(spreads) > 1:
            reasons.append("more than one spread layer")
        elif spreads and spreads[0] not in PAINT_SAUCES_ON_MAIN:
            reasons.append(f"sauce {spreads[0]} has no runtime paint profile")
        eng_keys = [k for k in keys if k not in ("NO_SAUCE", "NO_CUT_OR_CUT_UNSPECIFIED")]
        if eng_keys:
            reasons.append(f"mechanics: {eng_keys}")
        if not reasons:
            expr = "EXPRESSIBLE_NOW"
        elif all(x.startswith(("ingredients not in runtime", "sauce ")) and "unspecified" not in x and "unresolved" not in x for x in reasons):
            expr = "EXPRESSIBLE_WITH_DATA_ONLY"
        else:
            expr = "NOT_EXPRESSIBLE"

        # --- A-F classification --------------------------------------------------------------
        blockers = []

        def add(cls, code, detail, owner):
            blockers.append({"class": cls, "code": code, "detail": detail, "owner": owner})

        for t in tokens:
            add("F", "UNRESOLVED_INGREDIENT_TOKEN", t, "Canonicalization / Hint 5.0 Taxonomy HCG")
        if covr["coverage"] == "NEEDS_HCG_DECISION":
            add("F", "TAXONOMY_NEEDS_HCG_DECISION", {"missing": covr["taxonomyMissing"], "ambiguous": covr["authorityAmbiguous"]}, "Hint 5.0 Taxonomy HCG (PR #293 lane)")
        for b in r["blockers"]:
            if b["type"] in E_BLOCKERS:
                add("E", b["type"], b.get("detail") or b.get("ref"), "Owner / recipe authority")
        if "LATE_ADDITION:unresolved:mid_bake|post_bake" in keys:
            add("E", "LATE_MODE_UNRESOLVED", "mid- or post-bake", "Owner / Cooking Steps")
        for k in keys:
            c = ENGINE_CLASS[k]
            if c in ("C", "D"):
                add(c, k, MECHANIC_DEPENDENCIES[k][1], "Cooking Steps / Techniques lanes")
        if runtime["match"] != "EXACT":
            if covr["coverage"] == "DATA_ONLY_AFTER_HCG":
                add("B", "TAXONOMY_ROWS_AFTER_HCG", covr["taxonomyMissing"], "Hint 5.0 Taxonomy HCG")
            if new_ids:
                add("B", "NEW_INGREDIENT_DATA", new_ids, "ingredient authoring")
            if spreads and len(spreads) == 1 and spreads[0] not in PAINT_SAUCES_ON_MAIN and sb["status"] not in ("unspecified", "listed_unresolved"):
                add("B", "NEW_PAINT_SAUCE_PROFILE", spreads[0], "recipe authoring")
            if "NO_CUT_OR_CUT_UNSPECIFIED" in keys:
                add("B", "CUT_PROFILE", "no CUT / unspecified (OD-W2-4)", "recipe authoring")
            add("B", "RECIPE_AUTHORING_VALUES", "nameJa / description / minCount / bakeTarget / reference" +
                (" (W2-A: approved on the Wave 2 branch, not merged)" if eid in w2a_ids else ""), "recipe authoring")
            if key_status in ("MISSING", "CANDIDATE_ONLY") or sub_status in ("MISSING", "FORCED_1_SUB (candidate)"):
                add("B", "HINT5_KEY_SUB_AUTHORING", {"key": key_status, "sub": sub_status}, "Hint 5.0 lane (#292)")
        classes = sorted({b["class"] for b in blockers}, key=PRECEDENCE.index)
        primary = classes[0] if classes else "A"

        # --- phase / wave (candidate) --------------------------------------------------------
        if runtime["match"] == "EXACT":
            wave = "SHIPPED (runtime, W1 or earlier)"
        elif runtime["match"] == "DIVERGENT":
            wave = f"SHIPPED_AS_DIFFERENT_COMPOSITION ({rt_id}); Owner decision before any change"
        elif eid == "aussie-pizzadb":
            wave = "TQ-1D (OD-TQ-18 approved)"
        elif eid in w2a_ids:
            wave = "W2-A (approved authoring set; OD-W2-3/6, A1..A8; branch not merged)"
        elif primary == "F":
            wave = "BLOCKED: HCG / canonicalization first"
        elif primary == "E":
            wave = "BLOCKED: authority / Owner decision first"
        else:
            opts = [o for o, ids_ in w2_options.items() if eid in ids_ and o != "W2-A_LEAN_DATA_ONLY"]
            eng = sorted({WAVE_GATE.get(k, "CS-9+ major") for k in keys if ENGINE_CLASS[k] in ("C", "D")})
            if primary == "B":
                wave = "CANDIDATE: data-only wave after W2-A" + (f" (listed in Wave 2 options {opts})" if opts else "")
            else:
                wave = f"CANDIDATE: after {' + '.join(eng)}" + (f" (listed in Wave 2 options {opts})" if opts else "")

        # --- owner decisions required --------------------------------------------------------
        ods = []
        if runtime["match"] == "DIVERGENT":
            ods.append("OD-AM-1 runtime composition divergence: keep the runtime recipe, or add this row as a separate recipe")
        for b in r["blockers"]:
            if b["type"] == "BASE_SAUCE_UNSPECIFIED":
                ods.append("OD-AM-2 base sauce unspecified: which sauce (or none)")
            elif b["type"].startswith("COMPOSITION_CONFLICT") and runtime["match"] != "DIVERGENT":
                ods.append(f"OD-AM-3 composition conflict ({b['type']})")
            elif b["type"] in ("MECHANIC_INTERPRETATION", "SCOPE_QUESTION", "EVIDENCE_GAP", "DISCOVERY_COLLISION"):
                ods.append(f"OD-AM-4 {b['type'].lower().replace('_', ' ')}")
        for ri in r["reviewItems"]:
            ods.append(f"OD-AM-5 review item {ri['type']}")
        if any(b["class"] == "F" for b in blockers):
            ods.append("OD-AM-6 HCG / canonicalization (owned by the Hint 5.0 Taxonomy lane)")
        if key_status in ("MISSING", "CANDIDATE_ONLY") and runtime["match"] != "EXACT":
            ods.append("OD-AM-7 Hint 5.0 key / sub authoring for 172 (owned by #292)")
        if flags["noSauce"] == "REQUIRED" or flags["noCheese"] == "REQUIRED":
            ods.append("OD-AM-8 Hint 5.0 P4 「なし」 rung (open in #292) applies to this row")
        if any(k in keys for k in ("LATE_ADDITION:post_bake", "MULTI_SPREAD_LAYER")) or cand_caps:
            ods.append("OD-AM-9 technique authority (TQ-2 / TQ-3; owned by Cooking Techniques)")

        recipes.append({
            "recipeId": eid,
            "canonicalCandidateId": r["canonicalCandidateId"],
            "canonicalName": {"nameJa": r["nameJa"], "status": "RUNTIME" if runtime["match"] == "EXACT" else "CANDIDATE (PIZZA DB evidence name)"},
            "source": {"evidenceOrigin": r["phase0"]["evidenceOrigin"], "sourceUrl": r["phase0"]["sourceUrl"],
                       "correspondsToCatalogId": r["phase0"].get("correspondsToExistingCatalogId"),
                       "matrixProductDecisionStatus": r["productDecisionStatus"]},
            "runtime": runtime,
            "ingredients": {"canonicalIds": ids, "unresolvedNames": tokens,
                            "excludedNonIngredient": ing["excludedNonIngredientTokens"], "complete": ing["complete"],
                            "categoryUnconfirmed": cat_unconfirmed},
            "sauce": {"candidates": sauces, "count": len(sauces), "sauceBaseStatus": sb["status"],
                      "baseIngredientId": sb.get("baseIngredientId"), "spreadLayers": spreads},
            "cheese": {"candidates": cheeses, "count": len(cheeses)},
            "topping": {"candidates": toppings, "unresolvedToppingNames": topping_tokens, "count": n_top},
            "taxonomy": {"complete": tax_complete, "coverageTierPR293": covr["coverage"], "toppings": topping_tax},
            "hint5": {"keyToppingAuthorityStatus": key_status, "keyToppingCandidate": key_cand, "keyToppingBasis": key_basis,
                      "keyCandidateC1PRisk": c1p_risk,
                      "subToppingCount": sub_count, "subToppingCountIfKeyAuthored": covr["subToppingIfKeyAuthored"],
                      "subToppingCountIfNoKey": covr["subToppingIfNoKey"], "subToppingOrderAuthorityStatus": sub_status,
                      "eligibility": hint5},
            "techniqueDependency": technique_deps,
            "cookingStepsDependency": {"classPR295": csr["class"], "classIfAuthorityResolvedPR295": csr["mechanicClassIfAuthorityResolved"],
                                       "wave2Class": w2_rows[eid]["class"], "mechanics": steps_deps},
            "mechanicFlags": flags,
            "currentEngineExpressibility": {"status": expr, "reasons": reasons},
            "approvedOverride": override or None,
            "classification": {"primary": primary, "all": classes or ["A"],
                               "engineAxisNote": "NO_SAUCE counted as C (TQ-1D not shipped); PR #295 files it as DATA_ONLY after TQ-1D" if "NO_SAUCE" in keys else None},
            "productionBlockers": blockers,
            "ownerDecisionsRequired": sorted(set(ods)),
            "eligiblePhaseWave": wave,
        })

    return {
        "schemaNote": ("172 Recipe Authority Matrix Fresh Audit. Docs/data/tools only. NOT a production authority. "
                       "Consumer of the taxonomy (DH4-1 on main; PR #293 reference), Hint 5.0 (#292 H5-1 roles), "
                       "Cooking Techniques (TQ SSOT on main) and Cooking Steps (PR #295 reference). "
                       "Candidates are labelled CANDIDATE and never used as authority."),
        "generatedBy": "tools/recipe172_authority_matrix.py",
        "auditedMainSha": main_sha,
        "pins": {k: {"sha": v[0], "ref": v[1]} for k, v in PINS.items()},
        "classDefinitions": CLASS_LABELS,
        "classPrecedence": "F > E > D > C > B > A (primary = the most blocking class; every class is kept in classification.all)",
        "mechanicDependencies": {k: {"technique": v[0], "cookingStepsCandidatePhase": v[1], "engineClass": ENGINE_CLASS[k]}
                                 for k, v in MECHANIC_DEPENDENCIES.items()},
        "techniquesOnMain": techniques,
        "runtimeNotIn172": sorted(set(rt_rec) - {x["runtime"]["runtimeRecipeId"] for x in recipes if x["runtime"]["runtimeRecipeId"]}),
        "summary": summarize(recipes, w2a_ids),
        "recipes": recipes,
    }


def summarize(recipes, w2a_ids):
    s = {}
    s["recipes"] = len(recipes)
    s["primaryClass"] = dict(sorted(Counter(r["classification"]["primary"] for r in recipes).items()))
    s["rowsWithClass"] = {c: sum(1 for r in recipes if c in r["classification"]["all"]) for c in PRECEDENCE}
    s["runtimeMatch"] = dict(sorted(Counter(r["runtime"]["match"] for r in recipes).items()))
    s["authorityComplete"] = sum(1 for r in recipes if r["classification"]["primary"] == "A")
    s["hint5ProductionReady"] = sum(1 for r in recipes if r["hint5"]["eligibility"]["hint5ProductionReady"])
    s["hint5ReadyBreakdown"] = dict(sorted(Counter(f"{r['runtime']['match']}/{r['hint5']['keyToppingAuthorityStatus']}" for r in recipes
                                                   if r["hint5"]["eligibility"]["hint5ProductionReady"]).items()))
    s["hint5Checks"] = {k: sum(1 for r in recipes if r["hint5"]["eligibility"][k])
                        for k in ("allIngredientIdsResolve", "roleCategoryResolves", "hintEligibleToppingsExactlyOneFamily", "keySubAuthorityExists")}
    s["keyCandidateC1PRisk"] = sorted(r["recipeId"] for r in recipes if r["hint5"]["keyCandidateC1PRisk"])
    s["keyToppingAuthority"] = dict(sorted(Counter(r["hint5"]["keyToppingAuthorityStatus"] for r in recipes).items()))
    s["subOrderAuthority"] = dict(sorted(Counter(r["hint5"]["subToppingOrderAuthorityStatus"] for r in recipes).items()))
    s["currentEngineExpressibility"] = dict(sorted(Counter(r["currentEngineExpressibility"]["status"] for r in recipes).items()))
    s["mechanicFlags"] = {f: dict(sorted(Counter(r["mechanicFlags"][f] for r in recipes).items()))
                          for f in ("noSauce", "noCheese", "toppingLess", "lateAddition", "midBakeAddition", "multiSpread",
                                    "specialDough", "pan", "boatShape", "fold", "fry")}
    s["otherSpecial"] = dict(sorted(Counter(x for r in recipes for x in r["mechanicFlags"]["otherSpecial"]).items()))
    tq = Counter()
    for r in recipes:
        for d in r["techniqueDependency"]:
            tq[d["status"].split(":")[0]] += 1
    s["techniqueDependencyStatusCounts"] = dict(sorted(tq.items()))
    s["techniqueRowsByMechanic"] = dict(sorted(Counter(d["mechanic"] for r in recipes for d in r["techniqueDependency"]).items()))
    s["cookingStepsRowsByCandidatePhase"] = dict(sorted(Counter(p for r in recipes for p in {m["candidatePhase"] for m in r["cookingStepsDependency"]["mechanics"]}).items()))
    s["rowsWithAnyCookingStepsDependency"] = sum(1 for r in recipes if any(ENGINE_CLASS[m["mechanic"]] in ("C", "D", "E") for m in r["cookingStepsDependency"]["mechanics"]))
    s["rowsWithAnyTechniqueDependency"] = sum(1 for r in recipes if any(not d["status"].startswith("NOT A TECHNIQUE") for d in r["techniqueDependency"]))
    s["blockerCodes"] = dict(sorted(Counter(b["code"] for r in recipes for b in r["productionBlockers"]).items()))
    s["ownerDecisionQueue"] = dict(sorted(Counter(o.split(" ")[0] for r in recipes for o in r["ownerDecisionsRequired"]).items()))
    s["wave"] = dict(sorted(Counter(r["eligiblePhaseWave"].split(" (")[0] if not r["eligiblePhaseWave"].startswith("CANDIDATE: after") else r["eligiblePhaseWave"].split(" (listed")[0] for r in recipes).items()))
    s["crossCheck"] = {
        "pr295VsPrimary": dict(sorted(Counter(f"{r['cookingStepsDependency']['classPR295']}->{r['classification']['primary']}" for r in recipes).items())),
        "wave2VsPrimary": dict(sorted(Counter(f"{r['cookingStepsDependency']['wave2Class']}->{r['classification']['primary']}" for r in recipes).items())),
    }
    s["w2aRows"] = {r["recipeId"]: r["classification"]["all"] for r in recipes if r["recipeId"] in w2a_ids}
    return s


CSV_COLUMNS = [
    ("recipeId", lambda r: r["recipeId"]),
    ("canonicalName", lambda r: r["canonicalName"]["nameJa"]),
    ("nameStatus", lambda r: r["canonicalName"]["status"]),
    ("evidenceOrigin", lambda r: r["source"]["evidenceOrigin"]),
    ("runtimeRecipeId", lambda r: r["runtime"]["runtimeRecipeId"] or ""),
    ("runtimeMatch", lambda r: r["runtime"]["match"]),
    ("canonicalIngredientIds", lambda r: " ".join(r["ingredients"]["canonicalIds"])),
    ("unresolvedNames", lambda r: " ".join(r["ingredients"]["unresolvedNames"])),
    ("sauceCandidates", lambda r: " ".join(r["sauce"]["candidates"])),
    ("sauceCount", lambda r: r["sauce"]["count"]),
    ("cheeseCandidates", lambda r: " ".join(r["cheese"]["candidates"])),
    ("cheeseCount", lambda r: r["cheese"]["count"]),
    ("toppingCandidates", lambda r: " ".join(r["topping"]["candidates"] + r["topping"]["unresolvedToppingNames"])),
    ("toppingCount", lambda r: r["topping"]["count"]),
    ("taxonomyComplete", lambda r: r["taxonomy"]["complete"]),
    ("taxonomyTierPR293", lambda r: r["taxonomy"]["coverageTierPR293"]),
    ("hint5KeyAuthority", lambda r: r["hint5"]["keyToppingAuthorityStatus"]),
    ("hint5KeyCandidate", lambda r: r["hint5"]["keyToppingCandidate"] or ""),
    ("subToppingCount", lambda r: "" if r["hint5"]["subToppingCount"] is None else r["hint5"]["subToppingCount"]),
    ("subOrderAuthority", lambda r: r["hint5"]["subToppingOrderAuthorityStatus"]),
    ("hint5Ready", lambda r: r["hint5"]["eligibility"]["hint5ProductionReady"]),
    ("techniqueDependency", lambda r: " | ".join(d["mechanic"] for d in r["techniqueDependency"])),
    ("cookingStepsPhases", lambda r: " | ".join(sorted({m["candidatePhase"] for m in r["cookingStepsDependency"]["mechanics"]}))),
    ("classPR295", lambda r: r["cookingStepsDependency"]["classPR295"]),
    ("noSauce", lambda r: r["mechanicFlags"]["noSauce"]),
    ("noCheese", lambda r: r["mechanicFlags"]["noCheese"]),
    ("toppingLess", lambda r: r["mechanicFlags"]["toppingLess"]),
    ("lateAddition", lambda r: r["mechanicFlags"]["lateAddition"]),
    ("multiSpread", lambda r: r["mechanicFlags"]["multiSpread"]),
    ("specialDough", lambda r: r["mechanicFlags"]["specialDough"]),
    ("pan", lambda r: r["mechanicFlags"]["pan"]),
    ("boatShape", lambda r: r["mechanicFlags"]["boatShape"]),
    ("fold", lambda r: r["mechanicFlags"]["fold"]),
    ("midBakeAddition", lambda r: r["mechanicFlags"]["midBakeAddition"]),
    ("fry", lambda r: r["mechanicFlags"]["fry"]),
    ("otherSpecial", lambda r: " ".join(r["mechanicFlags"]["otherSpecial"])),
    ("engineExpressibility", lambda r: r["currentEngineExpressibility"]["status"]),
    ("primaryClass", lambda r: r["classification"]["primary"]),
    ("allClasses", lambda r: "".join(r["classification"]["all"])),
    ("blockers", lambda r: " | ".join(sorted({b["code"] for b in r["productionBlockers"]}))),
    ("ownerDecisions", lambda r: " | ".join(o.split(" ")[0] for o in r["ownerDecisionsRequired"])),
    ("eligiblePhaseWave", lambda r: r["eligiblePhaseWave"]),
]


def to_csv(recipes):
    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow([c for c, _ in CSV_COLUMNS])
    for r in recipes:
        w.writerow([f(r) for _, f in CSV_COLUMNS])
    return buf.getvalue()


if __name__ == "__main__":
    main()
