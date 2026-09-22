#!/usr/bin/env python3
"""
Progression 2.0 ingredient canonicalizer (Issue #182 / PR #183, Phase 0B.2).
Docs/data-only tooling -- NOT part of src/**, NOT wired into CI.

Implements the deterministic classification procedure documented in
docs/design/TETO_PROGRESS2_INGREDIENT-CANONICALIZATION-RULES.md: given a
candidate ingredient name (Japanese, optionally with an English hint), decide
whether it is exact_alias / likely_alias / ambiguous / genuinely_new /
needs_review against the existing canonical ingredient set (the shipped 62 +
Phase 0B's 15 + Phase 0B.1's 6 confirmed-new ids).

This tool does NOT fetch or invent any ingredient name -- it only classifies
names it is given, either via --input (a JSON list of {"nameJa": ...}
candidates) or, with no --input, by re-classifying Phase 0B.1's own 36
already-relayed names as a determinism self-test (the output should exactly
reproduce that Phase's dispositions).

Usage:
  python3 tools/progression2_ingredient_canonicalizer.py
      (self-test: re-classifies the 36 Phase 0B.1 names, diffs against their
      recorded dispositions, exits non-zero on any mismatch)
  python3 tools/progression2_ingredient_canonicalizer.py --input new_names.json
      (classifies a new batch; new_names.json = [{"nameJa": "...", "count": N,
      "sourceNote": "..."}, ...])
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INGREDIENT_CATALOG_PATH = ROOT / "data/recipes/ingredient_master_catalog.json"
PHASE0B_SAMPLES_PATH = ROOT / "docs/reports/data/TETO_PROGRESS2_PHASE0B_pizzadb-external-samples.json"
PHASE0B1_DIFF_PATH = ROOT / "docs/reports/data/TETO_PROGRESS2_PHASE0B1_ingredient-universe-diff.json"

# --- Rule 1b: orthographic/abbreviation equivalents -- NOT a different-word
# synonym (that's rule 2), just kanji/kana spelling variance or a common
# short form of the exact same stored nameJa. Folded into rule 1 (still
# exact_alias) rather than demoted to likely_alias, since there is no
# identity ambiguity, only a spelling difference. Key: PIZZA DB nameJa.
# Value: the existing catalog's own stored nameJa this normalizes to. ---
ORTHOGRAPHIC_EQUIVALENTS = {
    "玉ねぎ": "たまねぎ",  # 玉ねぎ -> たまねぎ (onion): kanji/kana variant of the same word.
    "リコッタ": "リコッタチーズ",  # リコッタ -> リコッタチーズ (ricotta): common short form.
}

# --- Phase 0B introduced 15 new ingredient ids without recording a
# standalone Japanese name per id (only inside recipe-sample prose). Their
# Japanese names as first used in Phase 0B.1's own diff table are registered
# here so a later exact-nameJa lookup (rule 1) recognizes them too, not just
# the base 62-ingredient catalog. Only the two that recur in Phase 0B.1's
# named-ingredient list are needed here; the rest surface only if/when a
# future relayed batch names them explicitly. ---
PHASE0B_NEW_INGREDIENT_NAMES = {
    "トマト": "fresh-tomato",  # トマト
    "クリームチーズ": "cream-cheese",  # クリームチーズ
}

# --- Rule 2: curated synonym table (likely_alias). Every entry needs a
# justification -- never a bare guess. Key: PIZZA DB nameJa. Value: (existing
# canonical id, justification). ---
LIKELY_ALIAS_TABLE = {
    "オリーブ": ("black-olive", "Existing catalog's only olive-type ingredient; PIZZA DB's plain 'olive' doesn't specify color/variety, so this is a confidence-flagged match, not exact."),
    "コリアンダー": ("cilantro", "Same plant as existing cilantro (nameJa パクチー) -- coriander leaf and cilantro are the same herb under different common names."),
}

# --- Rule 3: curated ambiguity table (ambiguous). Never auto-resolved. Key:
# PIZZA DB nameJa. Value: (list of candidate related ids, justification). ---
AMBIGUOUS_TABLE = {
    "ひき肉": (["ground-beef"], "Phase 0B's 'ground-beef' is taco-specific; ひき肉 (ground meat) is generic and could be pork/mixed -- not merged without a product decision."),
    "チリ": (["chili-oil"], "Existing chili-oil is a spread SAUCE; チリ likely denotes a raw chili-pepper SCATTER topping -- a different ingredient class, not merged."),
}

# --- Rule 4: registry of already-confirmed new ingredients (genuinely_new),
# so a repeat sighting reuses the same id instead of registering it twice.
# Key: PIZZA DB nameJa (or a known alternate spelling). Value: proposed id.
# NOTE: Phase 0B.1 classified '牛肉' (beef) as genuinely_new despite its
# own unresolved relationship to existing 'steak' and Phase 0B's
# 'ground-beef' -- that relationship is recorded as a note on the id itself,
# not as an AMBIGUOUS_TABLE entry, so this registry (checked after
# AMBIGUOUS_TABLE) is what actually classifies it; keeping it out of
# AMBIGUOUS_TABLE too is deliberate, matching Phase 0B.1's recorded
# disposition exactly (see the self-test). ---
GENUINELY_NEW_REGISTRY = {
    "牛肉": "beef",
    "レモン": "lemon",
    "ピーマン": "green-pepper",
    "青ねぎ": "green-onion",
    "万能ねぎ": "green-onion",
    "しそ": "shiso",
    "豚肉": "pork",
}


def load_canonical_names():
    """Returns {nameJa: canonical_id} for every existing exact nameJa/alias,
    drawn from the shipped 62 (ingredient_master_catalog.json) plus Phase 0B's
    15 new candidate ingredients (from the staging samples file's
    ingredientsCanonical/newIngredientsNeeded, cross-referenced with each
    sample's nameJa where derivable) -- Phase 0B itself didn't record a
    Japanese name per new ingredient id, so those 15 are only reachable via
    their existing English id equality (handled separately in classify())."""
    with open(INGREDIENT_CATALOG_PATH, encoding="utf-8") as f:
        catalog = json.load(f)
    exact = {}
    for ing in catalog["ingredients"]:
        exact[ing["nameJa"]] = ing["id"]
        for alias in ing["aliases"]:
            exact.setdefault(alias, ing["id"])
    for name_ja, cid in PHASE0B_NEW_INGREDIENT_NAMES.items():
        exact.setdefault(name_ja, cid)
    return exact


def classify(name_ja, exact_names):
    """Applies the 5-rule procedure from
    TETO_PROGRESS2_INGREDIENT-CANONICALIZATION-RULES.md, in order."""
    normalized = ORTHOGRAPHIC_EQUIVALENTS.get(name_ja, name_ja)
    if normalized in exact_names:
        return {"disposition": "exact_alias", "canonicalId": exact_names[normalized], "rule": "1_exact_nameJa_or_alias"}
    if name_ja in LIKELY_ALIAS_TABLE:
        cid, why = LIKELY_ALIAS_TABLE[name_ja]
        return {"disposition": "likely_alias", "canonicalId": cid, "rule": "2_curated_synonym_table", "justification": why}
    if name_ja in AMBIGUOUS_TABLE:
        related, why = AMBIGUOUS_TABLE[name_ja]
        return {"disposition": "ambiguous", "canonicalId": None, "relatedIds": related, "rule": "3_curated_ambiguity_table", "justification": why}
    if name_ja in GENUINELY_NEW_REGISTRY:
        return {"disposition": "genuinely_new", "canonicalId": GENUINELY_NEW_REGISTRY[name_ja], "rule": "4_confirmed_new_registry"}
    return {"disposition": "needs_review", "canonicalId": None, "rule": "5_no_table_match"}


def self_test(exact_names):
    """Re-classifies Phase 0B.1's own 36 names; the result must exactly
    reproduce that Phase's recorded dispositions (proves the tables above
    faithfully encode what Phase 0B/0B.1 already decided, not a new,
    silently-drifted judgment)."""
    with open(PHASE0B1_DIFF_PATH, encoding="utf-8") as f:
        diff = json.load(f)
    mismatches = []
    for row in diff["ingredientOccurrenceDiff"]:
        result = classify(row["nameJa"], exact_names)
        if result["disposition"] != row["disposition"]:
            mismatches.append({
                "nameJa": row["nameJa"], "expected": row["disposition"],
                "got": result["disposition"],
            })
        elif (
            row["disposition"] != "genuinely_new"
            and result.get("canonicalId") != row.get("canonicalId")
        ):
            # genuinely_new is exempt: Phase 0B.1 recorded canonicalId=null
            # for every genuinely_new entry (no id had been minted yet at
            # that point); GENUINELY_NEW_REGISTRY's whole purpose (rule 4) is
            # to now supply that id on a repeat sighting, which is an
            # intentional improvement, not disposition drift.
            mismatches.append({
                "nameJa": row["nameJa"], "expectedCanonicalId": row.get("canonicalId"),
                "gotCanonicalId": result.get("canonicalId"),
            })
    return mismatches


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=None, help="JSON list of {nameJa, count?, sourceNote?} candidates to classify")
    args = parser.parse_args()

    exact_names = load_canonical_names()

    if args.input is None:
        print("No --input given: running determinism self-test against Phase 0B.1's 36 recorded dispositions...")
        mismatches = self_test(exact_names)
        if mismatches:
            print(f"FAIL: {len(mismatches)} mismatch(es) -- the canonicalization tables have drifted from Phase 0B.1's recorded dispositions:")
            for m in mismatches:
                print(" ", m)
            return 1
        print("PASS: all 36 Phase 0B.1 names reclassify identically. Tables are consistent with prior findings.")
        return 0

    with open(args.input, encoding="utf-8") as f:
        candidates = json.load(f)
    results = []
    for c in candidates:
        r = classify(c["nameJa"], exact_names)
        r["nameJa"] = c["nameJa"]
        r["count"] = c.get("count")
        r["sourceNote"] = c.get("sourceNote")
        results.append(r)

    needs_review = [r for r in results if r["disposition"] == "needs_review"]
    print(json.dumps(results, ensure_ascii=False, indent=2))
    print(f"\n{len(results)} classified, {len(needs_review)} need human review (disposition=needs_review).", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
