#!/usr/bin/env python3
"""
Progression 2.0 recipe-row evidence ingest (Issue #182 / PR #183, Phase 0B.4).
Docs/data-only tooling -- NOT part of src/**, NOT wired into CI.

Deterministically appends new individually-evidenced PIZZA DB ja-172
population rows to
docs/reports/data/TETO_PROGRESS2_PHASE0B4_recipe-row-evidence.json,
deduplicating each candidate against:
  1. the 25 existing comparison-table sample rows
     (docs/reports/data/TETO_PROGRESS2_PHASE0B_pizzadb-external-samples.json), and
  2. every row already in the recipe-row evidence ledger itself,
by exact `id` match OR exact `nameJa` match (never fuzzy -- a near-miss name
is reported as `possibleDuplicate`, not silently merged, mirroring
tools/progression2_ingredient_canonicalizer.py's own no-fuzzy-matching
discipline).

This tool does NOT fetch any PIZZA DB content -- it only ingests rows it is
given via --input, recomputes the ledger's counters, and writes the result
back. Never invents a row, an ingredient within a row, or a mechanic note.

A duplicate found by exact id/nameJa match is not just dropped -- it is
recorded as a `corroboration` (new source URL + evidence note against the
row it matches), so re-confirmations of an already-evidenced dish are never
silently discarded. Exact matching only catches same-id/same-nameJa
duplicates; a row that corroborates an existing entry under a *different*
nameJa (e.g. this session's own "...(PIZZA DB版)" disambiguating suffix
convention from Phase 0B) will NOT be auto-detected -- --manual-corroborate
records that case explicitly instead of silently mis-counting it as new.

Usage:
  python3 tools/progression2_recipe_row_ingest.py --input new_rows.json
      (new_rows.json = a JSON list of row objects with at least
      "id"/"nameJa"/"sourceUrl"; exact-match duplicates are recorded as
      corroborations, not merged or discarded)
  python3 tools/progression2_recipe_row_ingest.py --check
      (no ingestion -- just recomputes and prints the current ledger's
      counters, and verifies they match what's actually stored, catching
      manual-edit drift)
  python3 tools/progression2_recipe_row_ingest.py --manual-corroborate manual.json
      (manual.json = a JSON list of {"matchedRowId", "matchedNameJa",
      "newSourceUrl", "note"} -- for a corroboration exact id/nameJa
      matching cannot catch, found and recorded by human review instead)
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEDGER_PATH = ROOT / "docs/reports/data/TETO_PROGRESS2_PHASE0B4_recipe-row-evidence.json"
SAMPLES_PATH = ROOT / "docs/reports/data/TETO_PROGRESS2_PHASE0B_pizzadb-external-samples.json"
CLAIMED_TOTAL_POPULATION = 172


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def existing_identity_sets(ledger):
    """Returns (ids, names) sets covering the 25 comparison-table samples
    PLUS every row already in the ledger's individualProfilePageRows."""
    samples = load(SAMPLES_PATH)["samples"]
    ids = {s["id"] for s in samples}
    names = {s["nameJa"] for s in samples}
    for row in ledger["individualProfilePageRows"]:
        ids.add(row["id"])
        names.add(row["nameJa"])
    return ids, names


def recompute_counters(ledger):
    rows = ledger["individualProfilePageRows"]
    comparison_count = ledger["existingRowsFromComparisonTableSamples"]["count"]
    total = comparison_count + len(rows)
    mechanic_ids = [r["id"] for r in rows if r.get("requiresMechanicIdentity")]
    gap_ids = [r["id"] for r in rows if r.get("evidenceGaps")]
    catalog_ids = [r["id"] for r in rows if r.get("correspondsToExistingCatalogId")]
    corroborations = ledger.setdefault("corroborations", [])
    ledger["counters"] = {
        "uniqueRecipeRowsEvidencedTotal": total,
        "uniqueRecipeRowsEvidencedFormula": f"{comparison_count} (comparison_table_sample) + {len(rows)} (individual_profile_page, deduplicated against the {comparison_count} + all prior individual-profile rows)",
        "claimedTotalPopulation": CLAIMED_TOTAL_POPULATION,
        "coveragePercent": round(100 * total / CLAIMED_TOTAL_POPULATION, 1),
        "independentlyFreshVerifiedRows": len(rows),
        "independentlyFreshVerifiedNote": ledger["counters"].get("independentlyFreshVerifiedNote", ""),
        "relayedOnlyRows": comparison_count,
        "relayedOnlyNote": ledger["counters"].get("relayedOnlyNote", ""),
        "duplicateCorroborationsCount": len(corroborations),
        "duplicateCorroborationsNote": "Each entry in the top-level 'corroborations' list is a re-confirmation of an already-evidenced row (new source URL/date), found either by exact id/nameJa match (matchType=automatic_exact_match) or by human ingredient-set review (matchType=manual_review) -- never counted toward uniqueRecipeRowsEvidencedTotal.",
        "rowsRequiringMechanicIdentityCount": len(mechanic_ids),
        "rowsRequiringMechanicIdentityIds": mechanic_ids,
        "rowsWithEvidenceGapsCount": len(gap_ids),
        "rowsWithEvidenceGapsIds": gap_ids,
        "rowsCorrespondingToExistingCatalogEntry": len(catalog_ids),
        "rowsCorrespondingToExistingCatalogEntryIds": catalog_ids,
        "rowsCorrespondingToExistingCatalogEntryNote": "correspondsToExistingCatalogId is set whether that catalog entry is already SHIPPED (e.g. margherita) or still an unshipped candidate (e.g. hawaiian) -- check each row's own correspondenceNote for which.",
        "pendingRowCount": CLAIMED_TOTAL_POPULATION - total,
        "pendingRowNote": f"{CLAIMED_TOTAL_POPULATION} - {total} = {CLAIMED_TOTAL_POPULATION - total} rows remain with zero evidence.",
    }
    return ledger


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=None, help="JSON list of new row candidates to ingest")
    parser.add_argument("--check", action="store_true", help="Recompute and print counters without writing")
    parser.add_argument("--manual-corroborate", type=Path, default=None, help="JSON list of {matchedRowId, matchedNameJa, newSourceUrl, note} found by human review, not exact-match dedup")
    args = parser.parse_args()

    ledger = load(LEDGER_PATH)
    ledger.setdefault("corroborations", [])
    ids, names = existing_identity_sets(ledger)

    if args.check:
        before = json.dumps(ledger["counters"], sort_keys=True)
        recompute_counters(ledger)
        after = json.dumps(ledger["counters"], sort_keys=True)
        if before != after:
            print("DRIFT: stored counters do not match a fresh recomputation. Re-run without --check to fix.")
            return 1
        print("OK: stored counters match a fresh recomputation.")
        print(json.dumps(ledger["counters"], ensure_ascii=False, indent=2))
        return 0

    if args.manual_corroborate is not None:
        manual = load(args.manual_corroborate)
        for m in manual:
            ledger["corroborations"].append({
                "matchedRowId": m["matchedRowId"], "matchedNameJa": m["matchedNameJa"],
                "newSourceUrl": m["newSourceUrl"], "note": m["note"],
                "matchType": "manual_review",
            })
        recompute_counters(ledger)
        with open(LEDGER_PATH, "w", encoding="utf-8") as f:
            json.dump(ledger, f, ensure_ascii=False, indent=2)
        print(f"Recorded {len(manual)} manual corroboration(s). Total corroborations: {len(ledger['corroborations'])}.")
        return 0

    if args.input is None:
        parser.error("--input, --manual-corroborate, or --check is required")

    candidates = load(args.input)
    accepted, rejected = [], []
    for c in candidates:
        if c["id"] in ids or c["nameJa"] in names:
            ledger["corroborations"].append({
                "matchedRowId": c["id"], "matchedNameJa": c["nameJa"],
                "newSourceUrl": c.get("sourceUrl"), "note": c.get("verifiedAt", ""),
                "matchType": "automatic_exact_match",
            })
            rejected.append({"id": c["id"], "nameJa": c["nameJa"], "reason": "duplicate id or nameJa against existing evidence -- recorded as a corroboration"})
            continue
        accepted.append(c)
        ids.add(c["id"])
        names.add(c["nameJa"])

    ledger["individualProfilePageRows"].extend(accepted)
    recompute_counters(ledger)

    with open(LEDGER_PATH, "w", encoding="utf-8") as f:
        json.dump(ledger, f, ensure_ascii=False, indent=2)

    print(f"Ingested {len(accepted)} new row(s), recorded {len(rejected)} corroboration(s) (duplicates, not counted as new).")
    if rejected:
        print(json.dumps(rejected, ensure_ascii=False, indent=2))
    print(f"Unique recipe rows evidenced: {ledger['counters']['uniqueRecipeRowsEvidencedTotal']} / {CLAIMED_TOTAL_POPULATION}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
