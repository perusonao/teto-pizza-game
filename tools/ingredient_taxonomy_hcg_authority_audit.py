#!/usr/bin/env python3
"""62-ingredient taxonomy / HCG authority Fresh Audit generator (docs/data/tools only).

Reads: working tree (run on the audited main) + pinned git objects of PR #255 / #293.
Writes docs/reports/data/TETO_62-INGREDIENT-TAXONOMY-HCG_Fresh-Audit.json (deterministic).
`--check` fails when the committed JSON differs. Not in CI; nothing in src/** imports it.
It classifies nothing: every family value in the output is copied from an existing source and
labelled with its source and status. Absence of an Owner-confirmed source stays UNRESOLVED.
"""
import json, re, subprocess, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "docs/reports/data/TETO_62-INGREDIENT-TAXONOMY-HCG_Fresh-Audit.json"
PIN_255 = "e221e36c9278311dfecc22263b5467dab7984555"
PIN_293 = "1bb4f9d3a10172b8f6a3f4bb2af794db2435db4c"
P255 = "docs/reports/data/TETO_INGREDIENT-TAXONOMY_172_FRESH-AUDIT.json"
P293 = "docs/reports/data/TETO_HINT-5_TAXONOMY-172-COVERAGE_Fresh-Audit.json"


def git_show(ref, path):
    return subprocess.check_output(["git", "-C", str(ROOT), "show", f"{ref}:{path}"]).decode()


def main_sha():
    return subprocess.check_output(["git", "-C", str(ROOT), "rev-parse", "HEAD"]).decode().strip()


def build(audited_sha):
    ing_src = (ROOT / "src/data/ingredients.ts").read_text()
    prod = re.findall(r'^\s{4}id: "([^"]+)",\s*\n\s*category: "(\w+)"', ing_src, re.M)
    prod_cat = dict(prod)
    tax_src = (ROOT / "src/data/ingredientTaxonomy.ts").read_text()
    rows = re.findall(r'^\s*\["([^"]+)", "(\w+)"\],', tax_src, re.M)
    fam = dict(rows)
    master = json.loads((ROOT / "data/recipes/ingredient_master_catalog.json").read_text())["ingredients"]
    t255 = {i["id"]: i for i in json.loads(git_show(PIN_255, P255))["ingredients"]}
    c293 = {i["id"]: i for i in json.loads(git_show(PIN_293, P293))["catalog62"]}
    out, ids = [], []
    for m in master:
        ids.append(m["id"])
    extra = [p for p, _ in prod if p not in ids]
    for iid in ids + extra:
        m = next((x for x in master if x["id"] == iid), None)
        cat = prod_cat.get(iid) or (m["category"] if m else None)
        rec = {
            "id": iid,
            "inMasterCatalog62": m is not None,
            "inProduction": iid in prod_cat,
            "category": cat,
            "categorySource": "production ingredients.ts" if iid in prod_cat else "data/recipes/ingredient_master_catalog.json (research artifact, not wired)",
            "productionFamily": fam.get(iid),
            "shelf": (cat if cat in ("sauce", "cheese") else fam.get(iid)),
        }
        if cat == "topping":
            x, y = t255.get(iid, {}), c293.get(iid, {})
            rec["pr255"] = {"family": x.get("family"), "status": x.get("classificationStatus"),
                            "confidence": x.get("confidence"), "subfamily": x.get("subfamily")}
            rec["pr293Status"] = y.get("status")
            rec["ownerConfirmedSource"] = (
                "merged DH4-1 table (OD-DH4-4)" + ("; OD-H5-C4 final names mushroom -> vegetable" if iid == "mushroom" else "")
                if iid in fam else None
            )
            if iid in fam:
                rec["state"] = "CLASSIFIED_PRODUCTION"
                if y.get("status") == "VALID_PRODUCTION_UNDER_REVIEW":
                    rec["state"] = "CLASSIFIED_PRODUCTION_UNDER_REVIEW"
            else:
                rec["state"] = "UNRESOLVED_NEEDS_REVIEW" if x.get("classificationStatus") == "NEEDS_REVIEW" else "UNRESOLVED_PROPOSED_ONLY"
        else:
            rec["state"] = "SHELF_BY_CATEGORY" if iid in prod_cat else "CATEGORY_FROM_CATALOG_ONLY"
            if iid == "mascarpone":
                rec["state"] = "CATEGORY_AMBIGUOUS"
        out.append(rec)
    def n(s): return sum(1 for r in out if r["state"] == s)
    summary = {
        "productionIngredients": len(prod), "productionByCategory": {c: sum(1 for _, k in prod if k == c) for c in ("sauce", "cheese", "topping")},
        "productionTaxonomyRows": len(rows), "masterCatalog62": len(ids), "productionIdsNotInMaster62": extra,
        "distinctIdsAudited": len(out),
        "toppingsInMaster62": sum(1 for r in out if r["inMasterCatalog62"] and r["category"] == "topping"),
        "states": {s: n(s) for s in sorted({r["state"] for r in out})},
        "unresolvedToppingIds": sorted(r["id"] for r in out if r["state"].startswith("UNRESOLVED")),
        "ownerConfirmedUnresolvedCount": sum(1 for r in out if r["state"].startswith("UNRESOLVED") and r["ownerConfirmedSource"]),
    }
    return {"schemaNote": "62-ingredient taxonomy / HCG authority Fresh Audit. NOT an authority; classifies nothing.",
            "generatedBy": "tools/ingredient_taxonomy_hcg_authority_audit.py", "auditedMainSha": audited_sha,
            "pinned": {"pr255": PIN_255, "pr293": PIN_293}, "summary": summary, "ingredients": out}


if __name__ == "__main__":
    sha = sys.argv[sys.argv.index("--sha") + 1] if "--sha" in sys.argv else main_sha()
    text = json.dumps(build(sha), ensure_ascii=False, indent=2) + "\n"
    if "--check" in sys.argv:
        ok = OUT.read_text() == text
        print("OK, no drift" if ok else "DRIFT"); sys.exit(0 if ok else 1)
    OUT.write_text(text); print("wrote", OUT)
