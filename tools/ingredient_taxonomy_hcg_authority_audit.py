#!/usr/bin/env python3
"""62-ingredient taxonomy / HCG authority Fresh Audit generator (docs/data/tools only).

Reads the working tree (run on the audited main's production files) and the committed evidence
snapshot docs/reports/data/TETO_62-INGREDIENT-TAXONOMY-HCG_Evidence-Snapshot.json. It needs NO git
object of PR #255 / #293, so it runs in a fresh or shallow clone. Only `--refresh-snapshot`
(maintainer use, never the normal path) reads those pinned git objects.

  python3 tools/ingredient_taxonomy_hcg_authority_audit.py --sha <audited main SHA>            # regenerate
  python3 tools/ingredient_taxonomy_hcg_authority_audit.py --sha <audited main SHA> --check    # drift + validation
  python3 tools/ingredient_taxonomy_hcg_authority_audit.py --refresh-snapshot                  # needs PR objects

Writes docs/reports/data/TETO_62-INGREDIENT-TAXONOMY-HCG_Fresh-Audit.json (deterministic). Not in CI;
nothing in src/** imports it. It classifies nothing: the Owner Authority (OD-T1..T8) is recorded
input, and every other family value is copied from the snapshot with its source and status.
"""
import hashlib, json, re, subprocess, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "docs/reports/data/TETO_62-INGREDIENT-TAXONOMY-HCG_Fresh-Audit.json"
SNAPSHOT = ROOT / "docs/reports/data/TETO_62-INGREDIENT-TAXONOMY-HCG_Evidence-Snapshot.json"
REPORT = ROOT / "docs/reports/TETO_62-INGREDIENT-TAXONOMY-HCG_Fresh-Audit.md"
# sha256 of the production / frozen source files at the audited main. A mismatch means main moved
# (for example a runtime-introduction PR added a taxonomy row, OD-T7): this audit is a point-in-time
# record, so re-audit instead of silently regenerating.
# S-0 sync (2026-10-03): re-pinned from the original audited main 21dc0a6 (29 ingredients / 22 rows) to the
# post-#342 production files (30 ingredients / 23 rows: `chicken` shipped with its row, as OD-T7 requires).
# The master catalog hash is unchanged. The original 21dc0a6 hashes are kept below as history only.
ORIGINAL_AUDITED_MAIN_SHA = "21dc0a670e586f478661a6cf54671313b2a7cb5b"
ORIGINAL_AUDITED_FILE_SHA256 = {  # history, not checked
    "src/data/ingredientTaxonomy.ts": "f5ee6b79e51323d258a4acdbc170b2d28447a090077527fb03d6fa6642885437",
    "src/data/ingredients.ts": "c4f73bd74f979aaff097bbeb3b39df9dcc56ceaff735492a6f66b3542ca8fbca",
    "data/recipes/ingredient_master_catalog.json": "287e391fed307acfece0308627316ad1ca9a46042ae61d2519b0b18e90cbc4c1",
}
AUDITED_FILE_SHA256 = {
    "src/data/ingredientTaxonomy.ts": "981c9e0e9f7f8a37b5888937380c159c9183f1693b5bcae9eef80f7791b1c6b0",
    "src/data/ingredients.ts": "100ba550e36b0cffcaef68f9822f74ff519f439e2395d730725ba129860ccb8f",
    "data/recipes/ingredient_master_catalog.json": "287e391fed307acfece0308627316ad1ca9a46042ae61d2519b0b18e90cbc4c1",
}
# Owner-confirmed (OD-T1) ids whose production row has shipped since the audit: id -> PR. Their row must equal the
# Owner-confirmed family (OD-T7). Nothing else may be added here without a runtime-introduction PR.
SHIPPED_SINCE_AUDIT = {"chicken": "#342"}
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


def git_show(ref, path):  # only used by --refresh-snapshot
    return subprocess.check_output(["git", "-C", str(ROOT), "show", f"{ref}:{path}"]).decode()


def main_sha():
    return subprocess.check_output(["git", "-C", str(ROOT), "rev-parse", "HEAD"]).decode().strip()


def rows_sha256(rows):
    return hashlib.sha256(json.dumps(rows, sort_keys=True, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()


def sha256_file(rel):
    return hashlib.sha256((ROOT / rel).read_bytes()).hexdigest()


def load_production():
    ing_src = (ROOT / "src/data/ingredients.ts").read_text()
    prod = re.findall(r'^\s{4}id: "([^"]+)",\s*\n\s*category: "(\w+)"', ing_src, re.M)
    tax_src = (ROOT / "src/data/ingredientTaxonomy.ts").read_text()
    rows = re.findall(r'^\s*\["([^"]+)", "(\w+)"\],', tax_src, re.M)
    families = re.findall(r'^\s*\{ id: "(\w+)", group: "\w+", labelJa', tax_src, re.M)
    master = json.loads((ROOT / "data/recipes/ingredient_master_catalog.json").read_text())["ingredients"]
    return prod, rows, families, master


def snapshot_topping_ids():
    """The only ids the generator reads evidence for: master toppings plus production toppings."""
    prod, _, _, master = load_production()
    pc = dict(prod)
    ids = [m["id"] for m in master if m["category"] == "topping"]
    return ids + [p for p, c in prod if c == "topping" and p not in ids]


def refresh_snapshot():
    t255 = {i["id"]: i for i in json.loads(git_show(PIN_255, P255))["ingredients"]}
    c293 = {i["id"]: i for i in json.loads(git_show(PIN_293, P293))["catalog62"]}
    ids = snapshot_topping_ids()
    rows = {
        "pr255": {i: {k: t255[i].get(k) for k in ("family", "classificationStatus", "confidence", "subfamily")} for i in ids if i in t255},
        "pr293": {i: {"status": c293[i].get("status")} for i in ids if i in c293},
    }
    snap = {
        "schemaNote": "Minimal input snapshot for tools/ingredient_taxonomy_hcg_authority_audit.py. AUDIT EVIDENCE ONLY: it is not a production authority and not an Owner Decision, is not read by src/**, and no classification may be inferred from it. The Owner Authority is OD-T1..T8 in the Fresh Audit report.",
        "purpose": "Make the audit generator and its --check reproducible without fetching the git objects of open PRs #255 / #293.",
        "sources": [
            {"pr": 255, "sha": PIN_255, "path": P255, "fields": ["family", "classificationStatus", "confidence", "subfamily"], "scope": "topping ids of the 62 master catalog plus production toppings"},
            {"pr": 293, "sha": PIN_293, "path": P293, "fields": ["status"], "scope": "same ids, where present in its catalog62 list"},
        ],
        "rowsSha256": rows_sha256(rows),
        "rows": rows,
    }
    SNAPSHOT.write_text(json.dumps(snap, ensure_ascii=False, indent=2) + "\n")
    print("wrote", SNAPSHOT, "rows:", {k: len(v) for k, v in rows.items()})


def load_snapshot():
    snap = json.loads(SNAPSHOT.read_text())
    assert [(x["pr"], x["sha"]) for x in snap["sources"]] == [(255, PIN_255), (293, PIN_293)], "snapshot source pin mismatch"
    assert snap["rowsSha256"] == rows_sha256(snap["rows"]), "evidence snapshot was modified (rowsSha256 mismatch)"
    for i in snapshot_topping_ids():  # coverage: every topping the generator needs has a #255 row
        assert i in snap["rows"]["pr255"], f"snapshot lacks a #255 row for {i}"
    return snap["rows"]["pr255"], snap["rows"]["pr293"], snap["rowsSha256"]


def parse_report_owner_rows():
    """Owner Authority text as recorded in report section 0, parsed back into dicts (cross-check)."""
    r = REPORT.read_text()
    t1 = re.search(r"\| \*\*OD-T1\*\* \| The 16 .*?\*\*confirmed\*\*: (.*?)\. `bell-pepper`", r).group(1)
    t2 = re.search(r"\| \*\*OD-T2\*\* \| The 7 .*?\*\*confirmed as independent id \+ family\*\*: (.*?)\. \*\*placement", r).group(1)
    d1 = {i.strip(): seg.split("=")[0].strip() for seg in t1.split(";") for i in seg.split("=")[1].split(",")}
    d2 = {seg.split("=")[0].strip(): seg.split("=")[1].strip() for seg in t2.split(";")}
    t3 = re.search(r"garlic = (\w+), black-olive = (\w+), capers = (\w+)", r)
    return d1, d2, dict(zip(("garlic", "black-olive", "capers"), t3.groups()))


def validate(prod, rows, families, master, pr255, out):
    """Machine checks. Everything derivable is derived from the inputs; raises AssertionError."""
    fam, prod_cat = dict(rows), dict(prod)
    for rel, want in AUDITED_FILE_SHA256.items():
        assert sha256_file(rel) == want, f"{rel} differs from the audited main (point-in-time audit; re-audit required)"
    assert len(rows) == 23 and len(fam) == 23, "production taxonomy must have 23 unique rows (22 audited + chicken, #342)"
    assert len(prod) == 30 and sum(1 for _, c in prod if c == "topping") == 23
    assert set(fam) <= {i for i, c in prod if c == "topping"}
    assert len(OD_T1) == 16 and len(OD_T2) == 7                                  # 1, 2
    assert not (set(OD_T1) & set(OD_T2)) and len({*OD_T1, *OD_T2}) == 23          # 3
    confirmed = {**OD_T1, **OD_T2}
    shipped = {i for i in confirmed if i in fam}
    assert shipped == set(SHIPPED_SINCE_AUDIT), "an Owner-confirmed id gained / lost a production row without being recorded"
    assert all(fam[i] == confirmed[i] for i in shipped), "a shipped Owner-confirmed id must carry its confirmed family (OD-T7)"
    pending = set(confirmed) - shipped
    derived_unresolved = {m["id"] for m in master if m["category"] == "topping"} - set(fam)
    assert len(pending) == 22 and derived_unresolved == pending, \
        "the 22 pending Owner-confirmed ids must equal the master-catalog toppings that have no production row"  # 3, 4, 5
    state = {r["id"]: r["state"] for r in out}
    assert all(state[i] == "OWNER_CONFIRMED_PENDING_RUNTIME" for i in pending)     # 4
    assert all(state[i] == "OWNER_CONFIRMED_SHIPPED_OD_T7" for i in shipped)
    assert not [r["id"] for r in out if r["state"] == "UNRESOLVED"]                # 5
    valid_fams = set(families)
    assert len(valid_fams) == 7 and set(confirmed.values()) <= valid_fams          # 6 (families are the existing 7)
    r1, r2, r3 = parse_report_owner_rows()
    assert r1 == OD_T1 and r2 == OD_T2 and r3 == OD_T3, "generator Owner Authority differs from report section 0"  # 6
    assert all(i not in fam and i not in prod_cat for i in pending)                # 7
    assert all(fam.get(i) == f for i, f in OD_T3.items())                          # 8
    mm = next(m for m in master if m["id"] == "mascarpone")
    assert OD_T4_DEFER == ["mascarpone"] and mm["category"] == "cheese" and "mascarpone" not in prod_cat
    assert state["mascarpone"] == "DEFERRED_CATEGORY_OD_T4"                        # 9
    return {  # 10 is the pinned-file-hash assertion above plus the OD-T3 / 22-row / not-in-production checks
        "od_t1_count_16": True, "od_t2_count_7": True, "confirmed_23_unique_and_equals_derived_unresolved": True,
        "all_23_owner_confirmed": True, "pending_22_shipped_1": True, "unresolved_0": True, "families_within_existing_7": True,
        "owner_authority_matches_report_section_0": True, "confirmed_absent_from_production": True,
        "od_t3_matches_production": True, "mascarpone_deferred": True, "production_files_match_audited_sha256": True,
    }


def build(audited_sha):
    prod, rows, families, master = load_production()
    prod_cat, fam = dict(prod), dict(rows)
    t255, c293, snap_sha = load_snapshot()
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
            elif iid in fam and (iid in OD_T1 or iid in OD_T2):
                od, f = ("OD-T1", OD_T1[iid]) if iid in OD_T1 else ("OD-T2", OD_T2[iid])
                rec["state"] = "OWNER_CONFIRMED_SHIPPED_OD_T7"
                rec["ownerDecision"] = {"id": od, "family": f, "independentId": True, "date": OWNER_DATE,
                                        "productionRowAdded": True, "shippedIn": SHIPPED_SINCE_AUDIT.get(iid),
                                        "matchesPr255Candidate": x.get("family") == f}
                rec["ownerConfirmedSource"] = f"Owner {od} {OWNER_DATE}; production row shipped in {SHIPPED_SINCE_AUDIT.get(iid)} (OD-T7)"
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
        "ownerConfirmedFromUnresolved": sum(1 for r in out if r["state"] in ("OWNER_CONFIRMED_PENDING_RUNTIME", "OWNER_CONFIRMED_SHIPPED_OD_T7")),
        "ownerConfirmedPendingRuntime": n("OWNER_CONFIRMED_PENDING_RUNTIME"),
        "ownerConfirmedShippedSinceAudit": {i: SHIPPED_SINCE_AUDIT[i] for i in sorted(SHIPPED_SINCE_AUDIT)},
        "ownerConfirmedByDecision": {"OD-T1": len(OD_T1), "OD-T2": len(OD_T2), "OD-T3": len(OD_T3)},
        "deferred": ["mascarpone (OD-T4 category)"],
        "pr255NeedsReviewProductionRows": sorted(r["id"] for r in out if r["inProduction"] and r.get("pr255NeedsReview")),
        "productionTaxonomyChangedByThisAudit": False,
    }
    validation = validate(prod, rows, families, master, t255, out)
    return {"schemaNote": "Records the Owner Authority OD-T1..T8 (2026-09-29) for the 62-ingredient taxonomy / HCG audit. This artifact is NOT the production taxonomy: production taxonomy is src/data/ingredientTaxonomy.ts and is unchanged. Ingredients in state OWNER_CONFIRMED_PENDING_RUNTIME are Owner-confirmed but are NOT production rows; each is added to ingredientTaxonomy.ts only in the PR that introduces it to runtime (OD-T7). The audit itself classifies nothing.",
            "generatedBy": "tools/ingredient_taxonomy_hcg_authority_audit.py", "auditedMainSha": audited_sha,
            "originalAuditedMainSha": ORIGINAL_AUDITED_MAIN_SHA,
            "syncNote": "S-0 (2026-10-03): re-synced to the post-#342 production files (30 ingredients / 23 topping rows). The Owner Authority OD-T1..T8 text is unchanged; chicken (OD-T1, meat) now has its production row (OD-T7). The original audit values (29 / 22, 23 pending) are history in the Fresh Audit report.",
            "evidenceSnapshot": {"path": "docs/reports/data/TETO_62-INGREDIENT-TAXONOMY-HCG_Evidence-Snapshot.json", "rowsSha256": snap_sha, "sources": {"pr255": PIN_255, "pr293": PIN_293}, "note": "audit evidence only, not authority"},
            "validation": validation, "ownerDecisions": {"recordedOn": OWNER_DATE, "status": "OWNER AUTHORITY (recorded; production taxonomy NOT changed)", "decisions": DECISIONS},
            "summary": summary, "ingredients": out}


if __name__ == "__main__":
    if "--refresh-snapshot" in sys.argv:
        refresh_snapshot(); sys.exit(0)
    sha = sys.argv[sys.argv.index("--sha") + 1] if "--sha" in sys.argv else main_sha()
    text = json.dumps(build(sha), ensure_ascii=False, indent=2) + "\n"
    if "--check" in sys.argv:
        ok = OUT.read_text() == text
        print("OK, no drift" if ok else "DRIFT"); sys.exit(0 if ok else 1)
    OUT.write_text(text); print("wrote", OUT)
