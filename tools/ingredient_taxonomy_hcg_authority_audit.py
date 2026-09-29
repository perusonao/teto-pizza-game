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
OWNER_DATE = "2026-09-29"
# Owner Authority, recorded verbatim from the Owner's OD-T1..T8 answers. Nothing here is inferred.
OD_T1 = {  # confirmed families, independent ids (bell-pepper / cilantro / porcini / prosciutto-crudo not aliased)
    **{i: "vegetable" for i in ("artichoke", "arugula", "bell-pepper", "porcini", "zucchini")},
    **{i: "other" for i in ("breadcrumb", "powdered-sugar", "walnut")},
    **{i: "meat" for i in ("chicken", "prosciutto-crudo", "speck")},
    **{i: "herb" for i in ("cilantro", "parsley")},
    **{i: "fruit" for i in ("fig", "strawberry")},
    "shrimp": "seafood",
}
OD_T2 = {"french-fries": "other", "nduja": "meat", "nori": "other", "spicy-salami": "meat",
         "steak": "meat", "truffle": "vegetable", "wurstel": "meat"}  # all independent ids
OD_T3 = {"garlic": "herb", "black-olive": "vegetable", "capers": "spice"}  # keep production
OD_T4_DEFER = ["mascarpone"]
DECISIONS = {
    "OD-T1": "16 PROPOSED toppings confirmed with the listed families; bell-pepper / cilantro / porcini / prosciutto-crudo are independent ids (no alias merge).",
    "OD-T2": "7 NEEDS_REVIEW toppings confirmed as independent id + family. placement / timing / Technique are separate from family: nduja=spread does not change meat; truffle late / high-end finishing does not change vegetable.",
    "OD-T3": "(a) keep production: garlic=herb, black-olive=vegetable, capers=spice, recorded individually. DH4 design capers=vegetable is a historical discrepancy; no production change.",
    "OD-T4": "(c) mascarpone deferred; category is confirmed by the Owner at runtime introduction.",
    "OD-T5": "(b) non-production sauce / cheese category is confirmed per ingredient in the PR that introduces it to runtime.",
    "OD-T6": "(a) the 22 production toppings are accepted as merged authority under OD-DH4-4; no per-ingredient re-approval (OD-T3's 3 are recorded individually).",
    "OD-T7": "(a) a non-production ingredient's taxonomy row is added to ingredientTaxonomy.ts in the same PR that introduces it to runtime; no second runtime taxonomy authority; pre-checks via fixture / report only.",
    "OD-T8": "(b) ingredient_master_catalog.json is frozen as a historical / research artifact; ingredients.ts is the only authority for production existence; the catalog is not rewritten for stale existingInGame or the 3 missing ids.",
}
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
            rec["pr255NeedsReview"] = x.get("classificationStatus") == "NEEDS_REVIEW"
            if iid in OD_T3:
                assert fam.get(iid) == OD_T3[iid], iid  # OD-T3 = keep production
                rec["state"] = "CLASSIFIED_PRODUCTION_OWNER_CONFIRMED_OD_T3"
                rec["ownerDecision"] = {"id": "OD-T3", "family": OD_T3[iid], "date": OWNER_DATE, "productionChange": False}
            elif iid in fam:
                rec["state"] = "CLASSIFIED_PRODUCTION"
            elif iid in OD_T1 or iid in OD_T2:
                od, f = ("OD-T1", OD_T1[iid]) if iid in OD_T1 else ("OD-T2", OD_T2[iid])
                assert iid not in fam
                rec["state"] = "OWNER_CONFIRMED_PENDING_RUNTIME"
                rec["ownerDecision"] = {"id": od, "family": f, "independentId": True, "date": OWNER_DATE,
                                        "productionRowAdded": False, "matchesPr255Candidate": x.get("family") == f}
                rec["ownerConfirmedSource"] = f"Owner {od} {OWNER_DATE}"
            else:
                rec["state"] = "UNRESOLVED"
        else:
            rec["state"] = "SHELF_BY_CATEGORY" if iid in prod_cat else "CATEGORY_FROM_CATALOG_ONLY"
            if iid in OD_T4_DEFER:
                rec["state"] = "DEFERRED_CATEGORY_OD_T4"
                rec["ownerDecision"] = {"id": "OD-T4", "choice": "c", "date": OWNER_DATE}
            elif iid not in prod_cat:
                rec["categoryConfirmation"] = "at runtime-introduction PR (OD-T5)"
        out.append(rec)
    def n(s): return sum(1 for r in out if r["state"] == s)
    summary = {
        "productionIngredients": len(prod), "productionByCategory": {c: sum(1 for _, k in prod if k == c) for c in ("sauce", "cheese", "topping")},
        "productionTaxonomyRows": len(rows), "masterCatalog62": len(ids), "productionIdsNotInMaster62": extra,
        "distinctIdsAudited": len(out),
        "toppingsInMaster62": sum(1 for r in out if r["inMasterCatalog62"] and r["category"] == "topping"),
        "states": {s: n(s) for s in sorted({r["state"] for r in out})},
        "unresolvedToppingIds": sorted(r["id"] for r in out if r["state"] == "UNRESOLVED"),
        "unresolvedToppingsBeforeOwnerDecision": 23,
        "ownerConfirmedFromUnresolved": sum(1 for r in out if r["state"] == "OWNER_CONFIRMED_PENDING_RUNTIME"),
        "ownerConfirmedByDecision": {"OD-T1": len(OD_T1), "OD-T2": len(OD_T2), "OD-T3": len(OD_T3)},
        "deferred": ["mascarpone (OD-T4 category)"],
        "pr255NeedsReviewProductionRows": sorted(r["id"] for r in out if r["inProduction"] and r.get("pr255NeedsReview")),
        "productionTaxonomyChanged": False,
    }
    return {"schemaNote": "62-ingredient taxonomy / HCG authority Fresh Audit. NOT an authority; classifies nothing.",
            "generatedBy": "tools/ingredient_taxonomy_hcg_authority_audit.py", "auditedMainSha": audited_sha,
            "pinned": {"pr255": PIN_255, "pr293": PIN_293}, "ownerDecisions": {"recordedOn": OWNER_DATE, "status": "OWNER AUTHORITY (recorded; production taxonomy NOT changed)", "decisions": DECISIONS},
            "summary": summary, "ingredients": out}


if __name__ == "__main__":
    sha = sys.argv[sys.argv.index("--sha") + 1] if "--sha" in sys.argv else main_sha()
    text = json.dumps(build(sha), ensure_ascii=False, indent=2) + "\n"
    if "--check" in sys.argv:
        ok = OUT.read_text() == text
        print("OK, no drift" if ok else "DRIFT"); sys.exit(0 if ok else 1)
    OUT.write_text(text); print("wrote", OUT)
