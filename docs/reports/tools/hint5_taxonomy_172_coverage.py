#!/usr/bin/env python3
"""Hint 5.0 Taxonomy Coverage Fresh Audit (62 ingredients / 172 recipes) -- docs tooling only.

Not production code, not wired into CI, not an authority. It only READS:
  - src/data/ingredients.ts, src/data/ingredientTaxonomy.ts, src/data/recipes.ts   (runtime)
  - data/recipes/ingredient_master_catalog.json                                     (62 catalog)
  - docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json               (172 matrix)
  - PR #255's TETO_INGREDIENT-TAXONOMY_172_FRESH-AUDIT.json, read from the pinned PR head git
    object (PR #255 is OPEN; this script never modifies it and never copies it into main)

and writes one JSON snapshot (default: docs/reports/data/TETO_HINT-5_TAXONOMY-172-COVERAGE_Fresh-Audit.json).

Definitions (see the report, section 2):
  * "valid Hint taxonomy" (production) = a row in the runtime DH4-1 table (ingredientTaxonomy.ts).
  * "hint-eligible sub-topping (potential)" = an ingredient whose best-evidence category is
    `topping` and that appears in at least one recipe. No key-topping authority exists yet
    (Issue #292 §9), so ANY topping may be a sub-topping; the worst case is used.
  * A PR #255 PROPOSED family is NOT authority (OD-TAX-7); it is reported as a remediation path.

Deterministic: sorted keys and lists, no timestamps. `--check` compares against the committed file.
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PR255_HEAD = "e221e36c9278311dfecc22263b5467dab7984555"
PR255_JSON = "docs/reports/data/TETO_INGREDIENT-TAXONOMY_172_FRESH-AUDIT.json"
OUT = ROOT / "docs/reports/data/TETO_HINT-5_TAXONOMY-172-COVERAGE_Fresh-Audit.json"
DH4_FAMILIES = ["meat", "seafood", "vegetable", "fruit", "herb", "spice", "other"]


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, check=True, capture_output=True, text=True).stdout


def runtime() -> dict:
    ing_src = (ROOT / "src/data/ingredients.ts").read_text()
    cats = dict(re.findall(r'\bid: "([a-z0-9-]+)",\s*\n\s*category: "(sauce|cheese|topping)"', ing_src))
    tax_src = (ROOT / "src/data/ingredientTaxonomy.ts").read_text()
    block = tax_src.split("const TOPPING_FAMILY_ROWS", 1)[1].split("];", 1)[0]
    fam = dict(re.findall(r'\["([a-z0-9-]+)", "([a-z]+)"\]', block))
    fam_ids = re.search(r"export type AttributeFamilyId = ([^;]+);", tax_src).group(1)
    families = re.findall(r'"([a-z]+)"', fam_ids)
    rec_src = (ROOT / "src/data/recipes.ts").read_text().split("export const RECIPES", 1)[1]
    recipes: dict[str, list[str]] = {}
    for m in re.finditer(r'\n    id: "([a-z0-9-]+)",(.*?)(?=\n    id: "|\Z)', rec_src, re.S):
        recipes[m.group(1)] = re.findall(r'ingredientId: "([a-z0-9-]+)"', m.group(2).split("bakeTarget", 1)[0])
    return {"categories": cats, "family": fam, "familyIds": families, "recipes": recipes}


def load_json(rel: str):
    return json.loads((ROOT / rel).read_text())


def build() -> dict:
    head = git("merge-base", "HEAD", "origin/main").strip()
    rt = runtime()
    if sorted(rt["familyIds"]) != sorted(DH4_FAMILIES):
        sys.exit(f"DH4-1 family ids changed: {rt['familyIds']}")
    cat62 = load_json("data/recipes/ingredient_master_catalog.json")["ingredients"]
    mx = load_json("docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json")
    try:
        tax = json.loads(git("show", f"{PR255_HEAD}:{PR255_JSON}"))
    except subprocess.CalledProcessError:
        sys.exit(f"PR #255 head {PR255_HEAD} not available: git fetch origin claude/172-recipe-ingredient-audit-d33d8i")
    trow = {r["id"]: r for r in tax["ingredients"]}
    ttok = {t["token"]: t for t in tax["unresolvedTokens"]}
    hrq = {r["id"] for r in tax["humanReviewQueue"] if "id" in r}
    spread_ids = set(mx["spreadLayerIngredientIds"])

    # ---- 172 recipe usage -------------------------------------------------------------------
    usage: dict[str, list[str]] = {}
    tok_usage: dict[str, list[str]] = {}
    rows_out = []
    for r in mx["rows"]:
        ing = r["ingredients"]
        ids = sorted(set(ing["canonicalIngredientIds"]) | set(ing["identityIngredientSet"] or []))
        toks = sorted({t["token"] if isinstance(t, dict) else t for t in ing["unresolvedTokens"]})
        for i in ids:
            usage.setdefault(i, []).append(r["evidenceId"])
        for t in toks:
            tok_usage.setdefault(t, []).append(r["evidenceId"])
        rows_out.append((r, ids, toks))

    def status_of(i: str) -> dict:
        """Per-ingredient hint-taxonomy status (best evidence, never guessed)."""
        t = trow.get(i)
        cat = rt["categories"].get(i) or (t and t["category"])
        if cat is None:
            return {"category": None, "status": "NO_CATEGORY_AUTHORITY", "family": None}
        cat_src = "runtime" if i in rt["categories"] else (t["categorySource"].split(":")[0] if t else "none")
        role_ambiguous = i in spread_ids and cat == "topping" or (cat != "topping" and i in hrq)
        if cat != "topping":
            st = "CATEGORY_AMBIGUOUS_NON_TOPPING" if role_ambiguous else f"NOT_SUBTOPPING_{cat.upper()}"
            return {"category": cat, "categorySource": cat_src, "status": st, "family": None,
                    "proposedFamily": t and t["family"], "pr255Status": t and t["classificationStatus"]}
        if i in rt["family"]:
            st = "VALID_PRODUCTION_UNDER_REVIEW" if (t and t["classificationStatus"] == "NEEDS_REVIEW") else "VALID_PRODUCTION"
            return {"category": cat, "categorySource": cat_src, "status": st, "family": rt["family"][i],
                    "proposedFamily": t and t["family"], "pr255Status": t and t["classificationStatus"]}
        if t is None:
            return {"category": cat, "categorySource": cat_src, "status": "MISSING_NO_PROPOSAL", "family": None}
        if t["family"] not in DH4_FAMILIES:
            st = "MISSING_NEW_FAMILY_REQUIRED"
        elif t["classificationStatus"] == "NEEDS_REVIEW":
            st = "MISSING_NEEDS_REVIEW"
        else:
            st = "MISSING_PROPOSED"
        if cat_src == "proposed" and st == "MISSING_PROPOSED":
            st = "MISSING_PROPOSED_CATEGORY_UNCONFIRMED"
        return {"category": cat, "categorySource": cat_src, "status": st, "family": None,
                "proposedFamily": t["family"], "proposedSubfamily": t["subfamily"],
                "pr255Status": t["classificationStatus"], "pr255Note": t.get("note")}

    # ---- 62-ingredient coverage -------------------------------------------------------------
    c62 = []
    for c in sorted(cat62, key=lambda x: x["id"]):
        i = c["id"]
        s = status_of(i)
        t = trow.get(i)
        alias = bool(c.get("aliases")) or bool(t and (t["aliasesObserved"] or t["likelyAliasNames"])) \
            or (t and t["canonicalizationStatus"] not in ("RUNTIME_CANONICAL", "CATALOG_CANONICAL"))
        used172 = usage.get(i, [])
        c62.append({
            "id": i, "nameJa": c["nameJa"], "catalogCategory": c["category"], **s,
            "runtime": i in rt["categories"], "mechanicDependency": c.get("mechanicDependency"),
            "catalogAliases": c.get("aliases", []),
            "aliasesObserved172": (t or {}).get("aliasesObserved", []),
            "likelyAliasNames": (t or {}).get("likelyAliasNames", []),
            "aliasOrCanonicalizationFlag": bool(alias),
            "used172RowCount": len(used172),
            "potentialSubTopping172": s["category"] == "topping" and len(used172) > 0,
            "potentialSubToppingRuntime": s["category"] == "topping" and any(i in v for v in rt["recipes"].values()),
        })
    runtime_not_in_62 = sorted(set(rt["categories"]) - {c["id"] for c in cat62})

    # ---- whole 172 ingredient universe ------------------------------------------------------
    u172 = {i: {**status_of(i), "rows": len(v)} for i, v in sorted(usage.items())}
    tokens = {}
    for t, v in sorted(tok_usage.items()):
        tt = ttok.get(t, {})
        cat = tt.get("indicativeCategory")
        st = "UNRESOLVED_TOKEN_TOPPING" if cat == "topping" else ("UNRESOLVED_TOKEN_NON_TOPPING" if cat else "UNRESOLVED_TOKEN_NO_CATEGORY")
        tokens[t] = {"status": st, "indicativeCategory": cat, "indicativeFamily": tt.get("indicativeFamily"),
                     "taxonomyFlag": tt.get("taxonomyFlag"), "rows": len(v), "rowIds": sorted(v)}

    # ---- recipe level -----------------------------------------------------------------------
    recipe_rows = []
    for r, ids, toks in rows_out:
        tops = [i for i in ids if u172[i]["category"] == "topping"]
        tok_tops = [t for t in toks if tokens[t]["indicativeCategory"] == "topping"]
        missing = sorted([i for i in tops if not u172[i]["status"].startswith("VALID")] + tok_tops)
        ambiguous = sorted(
            [i for i in ids if u172[i]["status"] in ("CATEGORY_AMBIGUOUS_NON_TOPPING", "MISSING_NEEDS_REVIEW")]
            + tok_tops)
        boundary_review = sorted(i for i in tops if u172[i]["status"] == "VALID_PRODUCTION_UNDER_REVIEW")
        non_topping_tokens = sorted(t for t in toks if tokens[t]["indicativeCategory"] != "topping")
        n = len(tops) + len(tok_tops)
        sb = r["sauceBase"]
        no_sauce = sb["spreadLayerCount"] == 0
        tq = sorted(set(r["requiredCapabilities"]) | set(r["candidateCapabilities"])
                    | ({"NO_SAUCE"} if no_sauce else set()) | ({"NO_SAUCE_LABEL"} if sb["status"] == "none" else set()))
        if tok_tops:
            cov = "UNRESOLVED_TOPPING_TOKEN"
        elif ambiguous:
            cov = "NEEDS_HCG_DECISION"
        elif missing:
            cov = "DATA_ONLY_AFTER_HCG"
        else:
            cov = "VALID_NOW"
        recipe_rows.append({
            "evidenceId": r["evidenceId"], "nameJa": r["nameJa"], "canonicalCandidateId": r["canonicalCandidateId"],
            "productDecisionStatus": r["productDecisionStatus"], "complete": r["ingredients"]["complete"],
            "toppingCount": n, "subToppingIfKeyAuthored": max(n - 1, 0), "subToppingIfNoKey": n,
            "taxonomyMissing": missing, "authorityAmbiguous": ambiguous, "coverage": cov,
            "validButBoundaryUnderReview": boundary_review, "nonToppingUnresolvedTokens": non_topping_tokens,
            "sauceStatus": sb["status"], "spreadLayerCount": sb["spreadLayerCount"],
            "techniqueTriggers": tq,
        })

    def bucket(n: int) -> str:
        return "3+" if n >= 3 else str(n)

    # runtime 25 baseline
    rt_rows = []
    for rid, ids in rt["recipes"].items():
        tops = [i for i in ids if rt["categories"].get(i) == "topping"]
        rt_rows.append({"id": rid, "toppingCount": len(tops),
                        "unclassified": [i for i in tops if i not in rt["family"]]})

    # ---- summaries --------------------------------------------------------------------------
    def dist(key):
        return dict(sorted(Counter(bucket(x[key]) for x in recipe_rows).items()))

    missing_subtoppings = sorted(
        [{"id": i, **{k: v for k, v in s.items() if k in ("status", "proposedFamily", "pr255Status", "categorySource")},
          "rows": s["rows"], "rowIds": sorted(usage[i])}
         for i, s in u172.items() if s["category"] == "topping" and not s["status"].startswith("VALID")],
        key=lambda x: (x["status"], x["id"]))
    new_family_candidates = sorted(
        [{"id": i, "proposedFamily": s.get("proposedFamily"), "status": s["status"], "rows": s["rows"],
          "rowIds": sorted(usage[i]), "note": s.get("pr255Note")}
         for i, s in u172.items() if s["category"] == "topping" and s.get("proposedFamily") == "other"
         and not s["status"].startswith("VALID")],
        key=lambda x: x["id"])
    ambiguous_non_topping = sorted(
        [{"id": i, "category": s["category"], "rows": s["rows"], "pr255Status": s.get("pr255Status"),
          "rowIds": sorted(usage[i])}
         for i, s in u172.items() if s["status"] == "CATEGORY_AMBIGUOUS_NON_TOPPING"], key=lambda x: x["id"])

    return {
        "schemaNote": "Hint 5.0 Taxonomy Coverage Fresh Audit (62 ingredients / 172 recipes). Docs-only snapshot; NOT an authority, NOT wired into CI. PR #255 PROPOSED families are remediation candidates only (OD-TAX-7).",
        "generatedBy": "docs/reports/tools/hint5_taxonomy_172_coverage.py",
        "auditedMainSha": head if head else None,
        "pr255HeadRead": PR255_HEAD,
        "definitions": {
            "validHintTaxonomy": "row in src/data/ingredientTaxonomy.ts TOPPING_FAMILY_ROWS (production DH4-1)",
            "potentialSubTopping": "best-evidence category == topping and used by >= 1 recipe (no key-topping authority exists; worst case)",
            "subToppingIfKeyAuthored": "toppingCount - 1 (Issue #292 OD-H5-C1 option A with a topping key)",
            "subToppingIfNoKey": "toppingCount (key null / non-topping)",
        },
        "counts": {
            "runtimeIngredients": len(rt["categories"]),
            "runtimeToppings": sum(1 for c in rt["categories"].values() if c == "topping"),
            "runtimeToppingsWithFamily": sum(1 for i, c in rt["categories"].items() if c == "topping" and i in rt["family"]),
            "runtimeRecipes": len(rt["recipes"]),
            "runtimeRecipesWithUnclassifiedTopping": sum(1 for x in rt_rows if x["unclassified"]),
            "catalog62": len(c62),
            "catalog62ByStatus": dict(sorted(Counter(x["status"] for x in c62).items())),
            "catalog62ByCategory": dict(sorted(Counter(x["catalogCategory"] for x in c62).items())),
            "catalog62AliasOrCanonicalizationFlag": sum(1 for x in c62 if x["aliasOrCanonicalizationFlag"]),
            "catalog62PotentialSubTopping172": sum(1 for x in c62 if x["potentialSubTopping172"]),
            "catalog62NotUsedBy172": sorted(x["id"] for x in c62 if x["used172RowCount"] == 0),
            "runtimeIdsNotIn62": runtime_not_in_62,
            "universe172Ids": len(u172),
            "universe172ByStatus": dict(sorted(Counter(s["status"] for s in u172.values()).items())),
            "universe172ToppingIds": sum(1 for s in u172.values() if s["category"] == "topping"),
            "unresolvedTokens172": len(tokens),
            "unresolvedTokensByStatus": dict(sorted(Counter(t["status"] for t in tokens.values()).items())),
            "missingSubToppingIds172": len(missing_subtoppings),
            "missingSubToppingByStatus": dict(sorted(Counter(x["status"] for x in missing_subtoppings).items())),
            "proposedFamilyOutsideDh4": sum(1 for s in u172.values() if s["status"] == "MISSING_NEW_FAMILY_REQUIRED"),
            "recipes172": len(recipe_rows),
            "recipes172ByCoverage": dict(sorted(Counter(x["coverage"] for x in recipe_rows).items())),
            "recipes172SubToppingDistIfKeyAuthored": dist("subToppingIfKeyAuthored"),
            "recipes172SubToppingDistIfNoKey": dist("subToppingIfNoKey"),
            "recipes172WithTaxonomyMissing": sum(1 for x in recipe_rows if x["taxonomyMissing"]),
            "recipes172WithAuthorityAmbiguous": sum(1 for x in recipe_rows if x["authorityAmbiguous"]),
            "recipes172NoSpreadLayer_NO_SAUCE": sum(1 for x in recipe_rows if "NO_SAUCE" in x["techniqueTriggers"]),
            "recipes172SauceStatusNone": sum(1 for x in recipe_rows if x["sauceStatus"] == "none"),
            "recipes172AnyTechniqueTrigger": sum(1 for x in recipe_rows if x["techniqueTriggers"]),
            "recipes172TechniqueTriggerCounts": dict(sorted(Counter(t for x in recipe_rows for t in x["techniqueTriggers"]).items())),
            "runtimeRecipeToppingDist": dict(sorted(Counter(bucket(x["toppingCount"]) for x in rt_rows).items())),
        },
        "catalog62": c62,
        "universe172": u172,
        "unresolvedTokens172": tokens,
        "missingSubToppings172": missing_subtoppings,
        "otherFamilyCandidates": new_family_candidates,
        "categoryAmbiguousNonTopping": ambiguous_non_topping,
        "recipes172": recipe_rows,
        "runtime25": sorted(rt_rows, key=lambda x: x["id"]),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--out", default=str(OUT))
    a = ap.parse_args()
    data = build()
    text = json.dumps(data, ensure_ascii=False, indent=1, sort_keys=False) + "\n"
    out = Path(a.out)
    if a.check:
        old = out.read_text() if out.exists() else ""
        # auditedMainSha legitimately differs on a later checkout; compare everything else.
        strip = lambda s: re.sub(r'"auditedMainSha": "[0-9a-f]+"', "", s)
        if strip(old) != strip(text):
            sys.exit("DRIFT: regenerate the snapshot")
        print("OK, no drift")
        return
    out.write_text(text)
    print(f"wrote {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
