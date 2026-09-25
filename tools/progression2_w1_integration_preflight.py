#!/usr/bin/env python3
"""Progression 2.0 W1 Integration Preflight -- read-only checker / JSON generator.

Docs/tools only.  Never writes anything except the companion JSON (``--write``).  It reads
production code and design authorities *from git objects at pinned SHAs* (never from the working
tree), so the result does not depend on which branch is checked out:

* ``main`` and every in-flight branch/PR head that W1 depends on (PINS below);
* the REC-01..03 Owner Decision record (``35bc937``) and the REC-04 Owner Decision record
  (``6fe02e2``) JSON companions -- the audit tables below are cross-checked against them;
* PR #221's W1 recipe authoring matrix (authored minCounts / bake targets).

It then

1. runs code probes (does ``main`` drop unknown ingredient inventory?  does #206 keep it?
   does RT-01 have ``getReferenceSlots``?  ...) and fails if any probe disagrees with the
   recorded expectation;
2. runs ``git merge-tree`` for every implementation branch against main and pairwise, and
   fails if the conflict matrix differs from the recorded one;
3. recomputes P2 ingredient readiness and W1 recipe readiness from per-dimension statuses
   (rule: any BLOCKED dimension -> BLOCKED, all DONE -> READY, otherwise WAITING);
4. emits ``docs/reports/data/TETO_PROGRESS2_W1_INTEGRATION_PREFLIGHT.json``.

    python3 tools/progression2_w1_integration_preflight.py --write   # regenerate the JSON
    python3 tools/progression2_w1_integration_preflight.py --check   # rebuild in memory; exit 1
                                                                     # on probe/merge/drift failure
    python3 tools/progression2_w1_integration_preflight.py --live    # additionally report whether
                                                                     # the remote branch tips moved
                                                                     # since the pins (informational)
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_JSON = ROOT / "docs/reports/data/TETO_PROGRESS2_W1_INTEGRATION_PREFLIGHT.json"
AUDIT_DATE = "2026-09-25"

# --------------------------------------------------------------------------------------------
# Exact GitHub state at audit start (fetched fresh, 2026-09-25).
# --------------------------------------------------------------------------------------------
PINS = {
    "main": {"ref": "main", "sha": "1e53baa88f390bf6d8f52647e7c65cc279eb2567", "pr": None,
             "state": "DEFAULT_BRANCH"},
    "visualP1": {"ref": "claude/w1-ingredient-visual-preview-mt4uxw",
                 "sha": "802b023d0753eebd9bd4222d21f5fa33424df5d6", "pr": None,
                 "state": "BRANCH_ONLY"},
    "rec0103": {"ref": "claude/w1-fresh-audit-rec-6u420b",
                "sha": "35bc937556ba6df0b4458c8bffbecc95b9058c92", "pr": None,
                "state": "BRANCH_ONLY"},
    "rec04": {"ref": "claude/rec-04-fresh-design-gz6em4",
              "sha": "6fe02e2d23610e926bab2367405fe9f717d25421", "pr": None,
              "state": "BRANCH_ONLY"},
    "rt01": {"ref": "claude/rt-01-pizza-piece-capacity-1ncicd",
             "sha": "63d3acfd9410dbdac5b53e2a506a850a6f5e2871", "pr": None,
             "state": "BRANCH_ONLY"},
    "pr205": {"ref": "claude/progression-2-0-phase-3-4a-km8q1c",
              "sha": "9035606bec2cec112289654ce4c4e7bebaca303a", "pr": 205, "state": "OPEN"},
    "pr206": {"ref": "claude/progression-2-0-phase-3-4b-y8g73a",
              "sha": "edfca8bcad59906847c0ff8b766d8a8a0dd75f20", "pr": 206, "state": "OPEN"},
    "pr222": {"ref": "claude/completion-gate-partial-quantity-7myahx",
              "sha": "81a850c26edf4c7f7f8cf69fad64e66d75830efd", "pr": 222, "state": "OPEN"},
    "pr218": {"ref": "claude/completion-gate-audit-7rqylp",
              "sha": "5105771d37577ad353e869ea35295a4ea18bbce9", "pr": 218, "state": "OPEN"},
    "pr217": {"ref": "codex/issue-216-fresh-design",
              "sha": "a39932d6b750cd0dd16b63e8635ac40c53a9fb70", "pr": 217, "state": "OPEN"},
    "pr220": {"ref": "codex/content-readiness-fresh-audit",
              "sha": "e49dab96bd9b26dc0f520349cf09d1160c3519f5", "pr": 220, "state": "OPEN"},
    "pr221": {"ref": "codex/w1-authoring-fresh-audit",
              "sha": "070afc0827f382bec8bc813d62e7fafe663a0991", "pr": 221, "state": "OPEN"},
    "pr214": {"ref": "claude/teto-pizza-p3-4c-decision-foc6x9",
              "sha": "5c1d6f06bfaf87b6f1cab3056dd1065d6adf7919", "pr": 214, "state": "OPEN"},
}

# Named commits the owner / earlier sessions reported; every one is verified reachable from the
# pinned branch that carries it (probe COMMIT_*).
NAMED_COMMITS = {
    "visualP1Implementation": ("visualP1", "39ce35cc80b17574ed85e60c71f989acb1b41237"),
    "visualP1HumanPass": ("visualP1", "802b023d0753eebd9bd4222d21f5fa33424df5d6"),
    "w1VisualEvidenceSync": ("visualP1", "3fc02a06c197967c5989e0b0c1f88a0a546e2d2c"),
    "rec0103OwnerDecision": ("rec0103", "35bc937556ba6df0b4458c8bffbecc95b9058c92"),
    "rec04FreshDesign": ("rec04", "2e1941582313e12d616b99d017a72681f2b3bfbb"),
    "rec04OwnerDecision": ("rec04", "6fe02e2d23610e926bab2367405fe9f717d25421"),
    "rt01OwnerDecision": ("rt01", "745fbd7fae66fcd6c3951337575e8f2ea8e2df80"),
    "rt01a": ("rt01", "e708dd2611894befff61690e854da0d50af2ad45"),
    "rt01b": ("rt01", "afcce5131b80eb483ea5d4aa592729880ac175ec"),
    "pr222Implementation": ("pr222", "9abe481c313998a44b94b15cd4874fb3d3e7e03b"),
    "pr206Implementation": ("pr206", "4c1da8703bb22a2be7cad911f92ec33cb0f0485d"),
}

W1_RECIPES = ["new-haven-apizza", "hawaiian", "parmigiana-pizza", "bambino", "pizza-portuguesa",
              "puttanesca-pizza", "pesto-caprese", "pesto-tonno", "pesto-patate",
              "melanzane-pizza"]
P2_INGREDIENTS = ["capers", "clam", "corn", "eggplant", "fresh-tomato", "pineapple", "potato"]
RING_SLOTS = 8  # PIECE_RING_POSITIONS on main

# Implementation branches whose merge behaviour is checked.
IMPL_BRANCHES = ["visualP1", "rt01", "pr205", "pr206", "pr222"]
# Recorded merge-tree result: files that conflict.  "main+X" = merge X into main.
EXPECTED_CONFLICTS = {
    "main+visualP1": [], "main+rt01": [], "main+pr205": [], "main+pr206": [], "main+pr222": [],
    "visualP1+rt01": ["src/components/PizzaThumbnail.tsx"],
    "visualP1+pr205": [], "visualP1+pr206": [], "visualP1+pr222": [],
    "rt01+pr205": [], "rt01+pr206": [], "rt01+pr222": [],
    "pr205+pr206": [], "pr205+pr222": [], "pr206+pr222": [],
}


# --------------------------------------------------------------------------------------------
# git helpers (read-only)
# --------------------------------------------------------------------------------------------
def git(*args: str, check: bool = True) -> str:
    res = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True)
    if check and res.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} failed: {res.stderr.strip()}")
    return res.stdout


def show(sha: str, path: str) -> str | None:
    res = subprocess.run(["git", "show", f"{sha}:{path}"], cwd=ROOT, capture_output=True,
                         text=True)
    return res.stdout if res.returncode == 0 else None


def sha_of(key: str) -> str:
    return PINS[key]["sha"]


def is_ancestor(a: str, b: str) -> bool:
    return subprocess.run(["git", "merge-base", "--is-ancestor", a, b], cwd=ROOT).returncode == 0


def merge_conflicts(a: str, b: str) -> list[str]:
    res = subprocess.run(["git", "merge-tree", "--write-tree", "--name-only", a, b], cwd=ROOT,
                         capture_output=True, text=True)
    if res.returncode not in (0, 1):
        raise RuntimeError(f"merge-tree {a} {b} failed: {res.stderr.strip()}")
    lines = res.stdout.splitlines()
    files: list[str] = []
    for line in lines[1:]:
        if not line.strip():
            break  # blank line separates conflicted-file list from informational messages
        files.append(line.strip())
    return sorted(set(files))


def changed_paths(key: str) -> list[str]:
    base = git("merge-base", sha_of("main"), sha_of(key)).strip()
    out = git("diff", "--name-only", base, sha_of(key))
    return sorted(p for p in out.splitlines() if p)


# --------------------------------------------------------------------------------------------
# Code probes: (id, pin key, path, kind, needle, expected, meaning)
#   contains  -> needle substring present in file (file missing counts as False)
#   exists    -> file exists at that SHA
#   same      -> file byte-identical to main's copy
# --------------------------------------------------------------------------------------------
PROBES = [
    # --- main: save layer drops data a newer build wrote -------------------------------------
    ("MAIN_INVENTORY_DROPS_UNKNOWN_ID", "main", "src/state/persistence.ts", "contains",
     "if (!KNOWN_INGREDIENT_IDS.includes(id)) continue;", True,
     "main sanitizeInventory drops inventory for an unknown ingredient id"),
    ("MAIN_OWNED_DROPS_UNKNOWN_ID", "main", "src/state/persistence.ts", "contains",
     'typeof id === "string" && KNOWN_INGREDIENT_IDS.includes(id)', True,
     "main sanitizeOwnedIngredientIds drops an unknown owned ingredient id"),
    ("MAIN_DEX_DROPS_UNKNOWN_RECIPE", "main", "src/state/persistence.ts", "contains",
     "if (!isKnownRecipeId(r.recipeId)) return null;", True,
     "main sanitizeDexEntry drops a Dex entry for an unknown recipe id"),
    ("MAIN_LEDGER_DROPS_UNKNOWN_RECIPE", "main", "src/state/persistence.ts", "contains",
     "if (isKnownRecipeId(id)) seen.add(id);", True,
     "main starter-grant ledger keeps known recipe ids only"),
    ("MAIN_TOPLEVEL_RECONSTRUCTED", "main", "src/state/persistence.ts", "contains",
     "schemaVersion: CURRENT_SCHEMA_VERSION,\n    dex: sanitizeDex(intermediate.dex),", True,
     "main sanitizeSave rebuilds the root from known keys, so unknown top-level keys are lost on "
     "the next write"),
    ("MAIN_NO_FORWARD_COMPAT_WRITE", "main", "src/state/persistence.ts", "contains",
     "function writeSave(", False, "main has no forward-compat write path (#206 not merged)"),
    # --- main: content / runtime not integrated ---------------------------------------------
    ("MAIN_EP4_STARTER_GRANT_ACTIVE", "main", "src/state/starterStock.ts", "contains",
     "export function applyStarterGrants(", True,
     "main still grants finite stock when a recipe unlocks (EP4) -- conflicts with REC-04 first "
     "stock 0"),
    ("MAIN_RECIPE_UNLOCK_CHAIN_ACTIVE", "main", "src/data/recipes.ts", "contains",
     "unlockCondition: { requiresRecipeId:", True,
     "main still uses the EP1 requiresRecipeId/minTotalStars recipe chain"),
    ("MAIN_INGREDIENT_STAR_UNLOCK", "main", "src/data/ingredients.ts", "contains",
     "unlockCondition: { minTotalStars: 0 },", True,
     "main ingredient rows still carry star unlockCondition + legacy pricePitz/restockQuantity"),
    ("MAIN_NO_LADDER", "main", "src/data/progressionUnlocks.ts", "exists", None, False,
     "no progression unlock table on main (#205 not merged, Discovery Ladder not implemented)"),
    ("MAIN_CUT_ALLOWLIST_TYPED_BY_RECIPEID", "main", "src/data/cookingProfiles.ts", "contains",
     "const CUT_ELIGIBLE_RECIPE_IDS: ReadonlySet<RecipeId>", True,
     "CUT allowlist is typed on RecipeId -> CUT entries can only land with the recipe records"),
    ("MAIN_REFERENCE_REQUIRED_FOR_EVERY_RECIPE", "main", "src/data/referencePizza.test.ts",
     "contains", "for (const recipe of RECIPES) {", True,
     "referencePizza.test requires a Scoring 2.0 Reference for every RECIPES entry -> MD-01 "
     "fixtures must land in the same slice as the recipe records"),
    ("MAIN_SAUCE_PROFILE_PER_RECIPE", "main", "src/data/recipeSauceProfiles.ts", "contains",
     "Readonly<Record<RecipeId, RecipeSauceProfile>>", True,
     "every recipe needs a sauce profile entry (same slice as the recipe records)"),
    ("MAIN_DISCOVERY_CATALOG_DERIVED", "main", "src/data/discoveryCatalog.ts", "contains",
     "RECIPES.map((recipe) => ({", True,
     "discovery catalog is derived from RECIPES (no separate matcher data to author)"),
    ("MAIN_NO_REFERENCE_SLOTS", "main", "src/logic/pizzaReferenceLayout.ts", "contains",
     "getReferenceSlots", False, "RT-01a/b not on main"),
    ("MAIN_NO_INGREDIENT_GLYPH", "main", "src/components/IngredientGlyph.tsx", "exists", None,
     False, "Production Visual P1 not on main"),
    ("MAIN_NO_COMPLETION_POLICY", "main", "src/logic/completionGate.ts", "contains",
     "completionMinimum", False, "#222 Completion Gate G1 not on main"),
    ("MAIN_RULESET_SHADOW_3", "main", "src/logic/scoringV2/index.ts", "contains",
     'SCORING_V2_RULESET_VERSION = "phase-4a-2-shadow-3"', True, "main Scoring 2.0 ruleset"),
    # --- #206 -----------------------------------------------------------------------------------
    ("PR206_FORWARD_COMPAT_WRITE", "pr206", "src/state/persistence.ts", "contains",
     "function writeSave(", True, "#206 routes every write through writeSave (merge extras back)"),
    ("PR206_KEEPS_UNKNOWN_INVENTORY", "pr206", "src/state/persistence.ts", "contains",
     "isForwardCompatUnknownId(id, KNOWN_INGREDIENT_IDS) && isNonNegativeInteger(value)", True,
     "#206 keeps well-formed unknown-id inventory entries"),
    ("PR206_KEEPS_UNKNOWN_DEX", "pr206", "src/state/persistence.ts", "contains",
     "const entry = sanitizeDexEntry(item, isUnknownRecipeId);", True,
     "#206 keeps well-formed unknown-recipe Dex entries"),
    ("PR206_KEEPS_UNKNOWN_TOPLEVEL", "pr206", "src/state/persistence.ts", "contains",
     "if (KNOWN_SAVE_KEYS.has(key) || key === \"__proto__\") continue;", True,
     "#206 keeps unknown top-level keys verbatim"),
    ("PR206_KEEPS_UNKNOWN_LEDGER", "pr206", "src/state/persistence.ts", "contains",
     "starterGrantClaimedRecipeIds: unknownIdsIn(r.starterGrantClaimedRecipeIds, "
     "KNOWN_RECIPE_IDS),", True, "#206 keeps unknown starter-grant ledger ids"),
    ("PR206_PINS_ENTITLEMENT_FIELD", "pr206", "src/state/persistence.forwardCompat.test.ts",
     "contains", "unlockedForShopIngredientIds", True,
     "#206 B-2 pins survival of the future unlockedForShopIngredientIds field"),
    ("PR206_NO_UNIT_CHANGE", "pr206", "src/state/persistence.ts", "contains",
     "CURRENT_SCHEMA_VERSION = 3", False, "#206 does not bump schemaVersion"),
    ("PR206_STARTER_STOCK_SAME_AS_MAIN", "pr206", "src/state/starterStock.ts", "same",
     None, True, "starterStock unchanged between #206 head and main"),
    # --- Visual P1 ------------------------------------------------------------------------------
    ("P1_GLYPH_EXISTS", "visualP1", "src/components/IngredientGlyph.tsx", "exists", None, True,
     "P1 IngredientGlyph abstraction on the P1 branch"),
    ("P1_THREE_DEDICATED_VISUALS", "visualP1", "src/data/ingredients.ts", "contains",
     'DedicatedIngredientVisual = "tomato-slice" | "caper-cluster" | "clam-valve"', True,
     "P1 defines exactly the 3 Human-approved dedicated visuals"),
    ("P1_NO_W1_INGREDIENT_RECORDS", "visualP1", "src/data/ingredients.ts", "contains",
     'id: "fresh-tomato"', False, "P1 did not register any W1 ingredient (P2 not started)"),
    ("P1_PERSISTENCE_SAME_AS_MAIN", "visualP1", "src/state/persistence.ts", "same", None, True,
     "P1 branch has main's save layer (drops unknown ids)"),
    # --- RT-01a/b -------------------------------------------------------------------------------
    ("RT01_REFERENCE_SLOTS", "rt01", "src/logic/pizzaReferenceLayout.ts", "contains",
     "export function getReferenceSlots", True, "RT-01a multi-ring placement on the RT-01 branch"),
    ("RT01_SCORING_FIXTURES_UNTOUCHED", "rt01", "src/data/referencePizza.ts", "same", None, True,
     "RT-01 did not author any Scoring 2.0 fixture (RT-01c not started)"),
    ("RT01_RECIPES_UNTOUCHED", "rt01", "src/data/recipes.ts", "same", None, True,
     "RT-01 did not add recipes"),
    # --- #205 -----------------------------------------------------------------------------------
    ("PR205_STAR_GATE_TABLE", "pr205", "src/data/progressionUnlocks.ts", "contains",
     'ingredientId: "potato", sequence: 76, tier: "late", initialOwned: false, '
     "minProgressionStars: 88, purchasePricePitz: 140", True,
     "#205 encodes the #196 absolute star gates / 60-100-140-180 prices REC-04 replaced"),
    ("PR205_USES_MODEL", "pr205", "src/logic/progressionEconomy.ts", "contains",
     "export const PROGRESSION_PURCHASE_GRANT_USES = 10;", True,
     "#205 grants 10 'uses' (1 pizza = 1 use), not REC-04's 10 x k storage units"),
    ("PR205_REFILL_HALF", "pr205", "src/logic/progressionEconomy.ts", "contains",
     "export const PROGRESSION_REFILL_PRICE_FACTOR = 0.5;", True,
     "#205 refill = 50% of pack price (matches OD-REC04-3)"),
    ("PR205_STAR_FORMULA", "pr205", "src/logic/progressionStars.ts", "contains",
     "return Math.max(sanitizeBestStars(bestStars), PROGRESSION_STARS_PER_DISCOVERY);", True,
     "#205 progression-star formula sum(max(2, BEST))"),
    # --- #222 -----------------------------------------------------------------------------------
    ("PR222_COMPLETION_POLICY", "pr222", "src/logic/completionGate.ts", "contains",
     "export function completionMinimum", True, "#222 G1 recipe/order completion policy"),
    ("PR222_RULESET_BUMP", "pr222", "src/logic/scoringV2/index.ts", "contains",
     '"phase-4a-2-shadow-4-quantity"', True, "#222 bumps the Scoring 2.0 ruleset (Q factor)"),
    ("PR222_RECIPES_UNCHANGED", "pr222", "src/data/recipes.ts", "same", None, True,
     "#222 leaves minCount untouched"),
    ("PR222_SAVE_UNCHANGED", "pr222", "src/state/persistence.ts", "same", None, True,
     "#222 changes no save schema"),
    ("PR222_REFERENCE_UNCHANGED", "pr222", "src/data/referencePizza.ts", "same", None, True,
     "#222 leaves Scoring 2.0 fixtures untouched"),
]


def run_probe(probe: tuple) -> dict:
    pid, key, path, kind, needle, expected, meaning = probe
    text = show(sha_of(key), path)
    if kind == "exists":
        actual = text is not None
    elif kind == "contains":
        actual = text is not None and needle in text
    elif kind == "same":
        actual = text is not None and text == show(sha_of("main"), path)
    else:  # pragma: no cover
        raise ValueError(kind)
    return {"id": pid, "at": key, "sha": sha_of(key)[:7], "path": path, "kind": kind,
            "expected": expected, "actual": actual, "pass": actual == expected,
            "meaning": meaning}


def main_facts() -> dict:
    recipes = show(sha_of("main"), "src/data/recipes.ts") or ""
    ingredients = show(sha_of("main"), "src/data/ingredients.ts") or ""
    cut = show(sha_of("main"), "src/data/cookingProfiles.ts") or ""
    recipe_ids = re.findall(r'^    id: "([a-z0-9-]+)"', recipes, flags=re.M)
    ingredient_ids = re.findall(r'^    id: "([a-z0-9-]+)"', ingredients, flags=re.M)
    cut_block = cut.split("const CUT_ELIGIBLE_RECIPE_IDS", 1)[1].split("]);", 1)[0]
    ham_counts = [int(n) for n in re.findall(r'ingredientId: "ham", minCount: (\d+)', recipes)]
    return {
        "recipeCount": len(recipe_ids),
        "ingredientCount": len(ingredient_ids),
        "cutAllowlistCount": len(re.findall(r'"[a-z0-9-]+"', cut_block)),
        "w1RecipesOnMain": sorted(set(W1_RECIPES) & set(recipe_ids)),
        "p2IngredientsOnMain": sorted(set(P2_INGREDIENTS) & set(ingredient_ids)),
        "hamMinCountsOnMain": ham_counts,
    }


# --------------------------------------------------------------------------------------------
# Authority inputs (read from git at the pinned SHAs)
# --------------------------------------------------------------------------------------------
def load_json(key: str, path: str) -> dict:
    text = show(sha_of(key), path)
    if text is None:
        raise RuntimeError(f"missing {path} at {key}")
    return json.loads(text)


def authority() -> dict:
    rec04 = load_json("rec04", "docs/reports/data/TETO_PROGRESS2_REC-04_FRESH-DESIGN.json")
    rec0103 = load_json("rec0103",
                        "docs/reports/data/TETO_PROGRESS2_W1_REC01-03_RESOLUTION_AUDIT.json")
    matrix = load_json("pr221", "docs/reports/data/TETO_PROGRESS2_W1_RECIPE_AUTHORING_MATRIX.json")
    visual = load_json("visualP1",
                       "docs/reports/data/TETO_PROGRESS2_W1_HUMAN_VISUAL_VERIFICATION.json")
    return {"rec04": rec04, "rec0103": rec0103, "matrix": matrix, "visual": visual}


# --------------------------------------------------------------------------------------------
# Readiness model
# --------------------------------------------------------------------------------------------
# Dimension status vocabulary
#   DONE     -- authority resolved AND present on main
#   WAITING  -- authority resolved; only implementation/integration work (named slice) remains
#   BLOCKED  -- authority missing (needs an Owner Decision / evidence)
#   N/A      -- dimension does not apply
def rollup(dims: dict) -> str:
    states = [d["status"] for d in dims.values()]
    if "BLOCKED" in states:
        return "BLOCKED"
    if all(s in ("DONE", "N/A") for s in states):
        return "READY"
    return "WAITING"


DEDICATED = {"fresh-tomato": "tomato-slice", "capers": "caper-cluster", "clam": "clam-valve"}


def p2_readiness(auth: dict) -> list[dict]:
    rows = {r["ingredient"]: r for r in auth["rec04"]["recommended"]["w1IngredientMatrix"]}
    visual = {r["ingredientId"]: r["verificationResult"] for r in auth["visual"]["ingredients"]}
    out = []
    for ing in P2_INGREDIENTS:
        r = rows[ing]
        dims = {
            "visualP1": {"status": "WAITING", "slice": "I3",
                         "detail": (f"dedicated pieceVisual '{DEDICATED[ing]}' (P1 39ce35c, "
                                    "branch only)") if ing in DEDICATED
                         else "emoji glyph via IngredientGlyph fallback (P1 39ce35c, branch only)"},
            "visualHumanApproval": {"status": "DONE" if visual.get(ing) == "HUMAN_PASS"
                                    else "BLOCKED",
                                    "detail": f"{visual.get(ing)} (iPhone Safari 390x844)"},
            "rec04": {"status": "DONE", "detail": "OD-REC04-1..3 CONFIRMED_OWNER_DECISION (6fe02e2)"},
            "priceTier": {"status": "WAITING", "slice": "I4a",
                          "detail": f"{r['tier']} pack {r['firstPackPrice']} / refill "
                                    f"{r['refillPrice']} Pitz (DERIVED_FROM_CONFIRMED_RULES; no "
                                    "price fields on main)"},
            "packQuantity": {"status": "WAITING", "slice": "I4a",
                             "detail": f"10 x k = 10 x {r['k']} = {r['packPieces']} pieces"},
            "progressionStep": {"status": "WAITING", "slice": "I4a",
                                "detail": f"ladder step {r['step']} (Dex >= {r['dexRequired']}), "
                                          f"key recipe {r['keyRecipe']}; ladder not on main"},
            "saveCompatibility": {"status": "WAITING", "slice": "I0",
                                  "detail": "main drops unknown ids on write; #206 must be "
                                            "released before the id ships"},
            "matcherDiscovery": {"status": "DONE",
                                 "detail": "discovery catalog derived from RECIPES; 25-target "
                                           "probe: 0 signature collisions, all W1 unique "
                                           "self-match (P1 branch fixtures)"},
            "canonicalization": {"status": "DONE",
                                 "detail": ("fresh-tomato != cherry-tomato (alias forbidden, "
                                            "OD-TOMATO-REPRESENTATION)" if ing == "fresh-tomato"
                                            else "own id, no alias (OD-OLIVE/OD-PARM do not "
                                                 "touch it)")},
            "catalog": {"status": "DONE", "detail": "PIZZA DB evidence row (#220 e49dab9)"},
            "identity": {"status": "DONE",
                         "detail": "id fixed; category topping / placement scatter (#221)"},
        }
        out.append({"ingredient": ing, "step": r["step"], "tier": r["tier"],
                    "firstPackPrice": r["firstPackPrice"], "refillPrice": r["refillPrice"],
                    "k": r["k"], "packPieces": r["packPieces"], "recipesUsing": r["recipesUsing"],
                    "pieceVisual": DEDICATED.get(ing), "dimensions": dims,
                    "readiness": rollup(dims)})
    return out


def w1_recipes(auth: dict) -> list[dict]:
    """Final (post-Owner-Decision) values come from the REC-01..03 record's ``recipes[].final``;
    the #221 matrix is only used to cross-check that nothing but the two approved
    normalizations (Hawaiian bake, New Haven description) changed."""
    authored = {r["recipeIdCandidate"]: r for r in auth["matrix"]["rows"]}
    final = {r["recipeId"]: r["final"] for r in auth["rec0103"]["recipes"]}
    reach = {r["recipe"]: r for r in auth["rec04"]["recommended"]["w1RecipeReachability"]}
    cut_enabled = set(auth["rec0103"]["cutDecision"]["cutEnabled"])
    out = []
    for rid in W1_RECIPES:
        f = final[rid]
        items = {q["ingredientId"]: q["minCount"] for q in f["requiredIngredients"]}
        a = authored[rid]
        sauce = a["sauce"]
        non_sauce = sum(v for k, v in items.items() if k != sauce)
        if non_sauce != f["nonSaucePieceCount"]:
            raise AssertionError(f"{rid}: non-sauce count disagrees with REC-01..03 record")
        bake = {"start": f["bakeTarget"][0], "end": f["bakeTarget"][1]}
        authored_items = {q["ingredientId"]: q["minCountCandidate"]
                          for q in a["requiredIngredients"]}
        authored_bake = {"start": a["bakeTargetCandidate"]["start"],
                         "end": a["bakeTargetCandidate"]["end"]}
        drift = []
        if authored_items != items:
            drift.append("quantity")
        if authored_bake != bake:
            drift.append("bakeTarget")
        cut = rid in cut_enabled
        new_ings = [i for i in items if i in P2_INGREDIENTS]
        needs_rt01 = non_sauce > RING_SLOTS
        dims = {
            "rec01": {"status": "WAITING", "slice": "I5b",
                      "detail": "RESOLVED (Q1/Q2); values authored in the W1 content slice"},
            "rec02": {"status": "WAITING", "slice": "I5b",
                      "detail": "RESOLVED (Q3): " + ("CUT 6 slices" if cut else "no CUT")},
            "rec03": {"status": "WAITING", "slice": "I1",
                      "detail": "RESOLVED by #215 OD-1..5; Implementation Gate = #222 (OPEN)"},
            "rec04": {"status": "WAITING", "slice": "I4a/I4b",
                      "detail": f"RESOLVED; reachable at ladder step {reach[rid]['reachableAtStep']}"
                                "; ladder/economy not on main"},
            "ingredients": ({"status": "WAITING", "slice": "I5a",
                             "detail": "new: " + ", ".join(new_ings)} if new_ings else
                            {"status": "DONE", "detail": "all ingredients already on main"}),
            "bakeTarget": {"status": "WAITING", "slice": "I5b",
                           "detail": f"{bake['start']}-{bake['end']}"
                                     + (" (catalog normalization; #221 had "
                                        f"{authored_bake['start']}-{authored_bake['end']})"
                                        if "bakeTarget" in drift else "")},
            "quantity": {"status": "WAITING", "slice": "I5b",
                         "detail": f"non-sauce pieces {non_sauce}"
                                   + (" (> 8: kept by Q2)" if needs_rt01 else "")},
            "cut": {"status": "WAITING", "slice": "I5b",
                    "detail": "allowlist entry, 6 slices" if cut else "not allowlisted (no dough "
                                                                      "evidence)"},
            "rt01": ({"status": "WAITING", "slice": "I2+I5b",
                      "detail": "RT-01a/b FINAL PASS on branch; RT-01c fixture in I5b"}
                     if needs_rt01 else {"status": "N/A", "detail": f"{non_sauce} <= 8 ring slots"}),
            "md01": {"status": "WAITING", "slice": "I5b",
                     "detail": "Scoring 2.0 reference fixture not authored"},
            "completionGate": {"status": "WAITING", "slice": "I1",
                               "detail": "G1/Q runtime is #222 (OPEN)"},
            "save": {"status": "WAITING", "slice": "I0",
                     "detail": "rollback would drop the Dex entry / new-ingredient stock on main"},
            "scoring": {"status": "WAITING", "slice": "I5b",
                        "detail": "computeScoringV2 returns available:false until MD-01 lands"},
        }
        out.append({"recipe": rid, "nameJa": a["nameJa"], "sauce": sauce, "items": items,
                    "nonSaucePieces": non_sauce, "bakeTarget": bake, "cut": cut,
                    "description": f["description"], "driftFromPr221": drift,
                    "newIngredients": new_ings,
                    "ladderStep": reach[rid]["reachableAtStep"], "dimensions": dims,
                    "readiness": rollup(dims)})
    return out


# --------------------------------------------------------------------------------------------
# Static audit tables (hand-audited; the checker validates the parts that are mechanical)
# --------------------------------------------------------------------------------------------
DEPENDENCY_GRAPH = [
    {"item": "Production Visual P1", "location": "BRANCH_ONLY",
     "where": "claude/w1-ingredient-visual-preview-mt4uxw @802b023 (src = single commit 39ce35c)",
     "status": "FINAL PASS (Human PASS 802b023)", "onMain": False},
    {"item": "REC-01..03", "location": "DOCS_ONLY", "where": "claude/w1-fresh-audit-rec-6u420b "
     "@35bc937 (docs + tools)", "status": "RESOLVED (Owner Decision Q1-Q4)", "onMain": False},
    {"item": "REC-04", "location": "DOCS_ONLY", "where": "claude/rec-04-fresh-design-gz6em4 "
     "@6fe02e2 (docs + tools)", "status": "RESOLVED (OD-REC04-1..3)", "onMain": False},
    {"item": "RT-01a/b", "location": "BRANCH_ONLY", "where": "claude/rt-01-pizza-piece-capacity-"
     "1ncicd @63d3acf (based on current main 1e53baa)", "status": "FINAL PASS, Human PASS",
     "onMain": False},
    {"item": "#205 headless progression rules", "location": "OPEN_PR",
     "where": "PR #205 @9035606 (28 behind main)", "status": "OBSOLETE vs REC-04 (star gates)",
     "onMain": False},
    {"item": "#206 save forward-compat", "location": "OPEN_PR",
     "where": "PR #206 @edfca8b (28 behind main; persistence.ts unchanged on main since base)",
     "status": "implemented, CI green at edfca8b, merges clean", "onMain": False},
    {"item": "#218 Completion Gate audit", "location": "OPEN_PR_DOCS_ONLY",
     "where": "PR #218 @5105771", "status": "design authority consumed by #215 OD-1..5",
     "onMain": False},
    {"item": "#222 Completion Gate G1 + Q", "location": "OPEN_PR",
     "where": "PR #222 @81a850c (impl 9abe481)", "status": "implemented; owner Human PASS not "
     "recorded on GitHub", "onMain": False},
    {"item": "#217 paid unlock design", "location": "OPEN_PR_DOCS_ONLY",
     "where": "PR #217 @a39932d", "status": "SUPERSEDED for W1 by REC-04 (unlock fee 0); "
     "OD216-3 capability mode deferred (not needed for W1)", "onMain": False},
    {"item": "MD-01 Scoring 2.0 fixtures", "location": "NOT_IMPLEMENTED",
     "where": "requirement recorded in 35bc937", "status": "0/10 authored", "onMain": False},
    {"item": "CUT allowlist (9 W1)", "location": "NOT_IMPLEMENTED",
     "where": "decision in 35bc937 (Q3)", "status": "0/9 on main", "onMain": False},
    {"item": "W1 ingredient records (7)", "location": "NOT_IMPLEMENTED",
     "where": "#221 matrix + REC-04 matrix (docs)", "status": "0/7 on main or any branch",
     "onMain": False},
    {"item": "W1 recipe records (10)", "location": "NOT_IMPLEMENTED",
     "where": "#221 matrix + REC-01..03 decisions (docs)", "status": "0/10 on main or any branch",
     "onMain": False},
    {"item": "Discovery Ladder", "location": "DOCS_ONLY",
     "where": "REC-04 6fe02e2 (generator tool + JSON)", "status": "not implemented anywhere",
     "onMain": False},
    {"item": "Shop / economy (pack 10 x k, tiers)", "location": "DOCS_ONLY",
     "where": "REC-04 6fe02e2", "status": "main still EP1 chain + EP4 grant + legacy restock",
     "onMain": False},
    {"item": "Inventory / save compatibility", "location": "OPEN_PR",
     "where": "#206 (forward-compat); storage unit unchanged (REC-04 units CONFIRMED)",
     "status": "main drops unknown ids", "onMain": False},
]

SAVE_MATRIX = {
    "fields": ["unknownRecipeDex", "unknownIngredientOwned", "unknownIngredientInventory",
               "starterGrantLedgerUnknownRecipe", "unknownTopLevelKeys",
               "unlockedForShopIngredientIds"],
    "main": {"unknownRecipeDex": "DROPPED", "unknownIngredientOwned": "DROPPED",
             "unknownIngredientInventory": "DROPPED", "starterGrantLedgerUnknownRecipe": "DROPPED",
             "unknownTopLevelKeys": "DROPPED", "unlockedForShopIngredientIds": "DROPPED"},
    "pr206": {"unknownRecipeDex": "KEPT", "unknownIngredientOwned": "KEPT",
              "unknownIngredientInventory": "KEPT", "starterGrantLedgerUnknownRecipe": "KEPT",
              "unknownTopLevelKeys": "KEPT", "unlockedForShopIngredientIds": "KEPT (as unknown "
              "top-level key, pinned by B-2 test)"},
    "visualP1": "same as main (persistence.ts identical)",
    "rt01": "same as main",
    "pr222": "same as main",
    "futureIntegration": "#206 first (I0); I4b adds unlockedForShopIngredientIds as a KNOWN key "
                         "(monotonic, never re-locks); no schemaVersion bump; storage unit "
                         "unchanged",
    "reconciliation": "REC-04's 'main drops unknown ingredient inventory' and #206's 'unknown id "
                      "forward compatibility done' are both true: they describe different refs "
                      "(main vs the unmerged #206 branch). No conflict.",
}

SLICES = [
    {"id": "I0", "name": "Save forward-compat (land #206)", "dependsOn": [],
     "strategy": "REBASE_OR_MERGE_MAIN (clean); no code change needed",
     "changedFiles": ["src/state/persistence.ts", "src/state/persistence.forwardCompat.test.ts",
                      "e2e/save-forward-compat-3-4b.spec.ts"],
     "risk": "LOW (save layer only; known fields unchanged; verified 665/665 src/state tests on "
             "main+#206)",
     "testGate": "full vitest, tsc -b, lint, build, save-forward-compat e2e",
     "chromium": "REQUIRED (e2e spec)", "webkit": "REQUIRED (Full WebKit + Gate, touches e2e)",
     "humanVerification": "NOT REQUIRED (no UI/UX/gameplay change)",
     "orderConstraint": "must be DEPLOYED to production before any build that ships a new "
                        "recipe/ingredient id (rollback target must already preserve them)"},
    {"id": "I1", "name": "Completion Gate G1 + Q (land #222)", "dependsOn": [],
     "strategy": "MERGE_MAIN into #222 (clean) and land 9abe481 + 81a850c as-is",
     "changedFiles": ["src/logic/completionGate.ts", "src/logic/scoringV2/*", "src/state/"
                      "gameReducer.ts", "src/logic/discovery/freeCook.ts",
                      "src/state/discoveryRegistration.ts", "src/components/ResultPanel.tsx",
                      "src/components/MissionServePanel.tsx", "src/screens/GameScreen.tsx",
                      "src/App.css", "src/data/*Messages.ts", "e2e/completion-gate-partial-"
                      "quantity.spec.ts"],
     "risk": "MEDIUM (scoring ruleset bump; Lunch Rush ranking mixed-score known limitation "
             "accepted by OD-LR-RANKING)",
     "testGate": "full vitest, completion-gate e2e, Scoring 2.0 authority suite",
     "chromium": "REQUIRED", "webkit": "REQUIRED (re-run at the merged head)",
     "humanVerification": "REQUIRED -- videos delivered (390x844 / 360x800) but owner PASS is not "
                          "recorded on GitHub; record it before merge",
     "orderConstraint": "before I5b (REC-03 Implementation Gate); independent of I0/I2/I3/I4"},
    {"id": "I2", "name": "RT-01a/b reference multi-ring (land branch)", "dependsOn": [],
     "strategy": "OPEN PR from the branch as-is (6 commits on current main)",
     "changedFiles": ["src/logic/pizzaReferenceLayout.ts", "src/data/playerReference.ts",
                      "src/components/PizzaThumbnail.tsx", "tests", "e2e/rt01-reference-"
                      "capacity.spec.ts", "e2e/harness/rt01-*"],
     "risk": "LOW (1-8 placement byte-identical; FINAL PASS)",
     "testGate": "full vitest, rt01 e2e", "chromium": "REQUIRED",
     "webkit": "REQUIRED (PASS at afcce51; re-run at merge head)",
     "humanVerification": "DONE (FINAL PASS 63d3acf); no new video unless code changes",
     "orderConstraint": "before I3 is preferred (I3 then resolves the one import-line conflict "
                        "in PizzaThumbnail.tsx); before I5b (RT-01c)"},
    {"id": "I3", "name": "Production Visual P1 (land IngredientGlyph)", "dependsOn": ["I2 (order "
     "only)"], "strategy": "CHERRY_PICK 39ce35c (+ tools d323d36/e83bee4, docs 9420478/802b023); "
     "do NOT merge the branch (it carries the visual-gate preview app and 16 earlier evidence "
     "commits)",
     "changedFiles": ["src/components/IngredientGlyph.tsx", "src/data/ingredients.ts (type + "
                      "optional field only)", "8 call sites (Tray, Thumbnail, Result, Shop, "
                      "Inventory, Dex, PieceVisual)", "src/App.css"],
     "risk": "LOW (no visual change; pixel harness proves it)",
     "testGate": "IngredientGlyph tests, P1 before/after pixel harness re-run after the "
                 "PizzaThumbnail conflict resolution",
     "chromium": "REQUIRED", "webkit": "REQUIRED",
     "humanVerification": "DONE (FINAL PASS 802b023) if the pixel harness stays identical",
     "orderConstraint": "before I5a (pieceVisual consumers)"},
    {"id": "I4a", "name": "Discovery Ladder + pack economy, headless (unwired)", "dependsOn": [],
     "strategy": "FRESH_IMPLEMENTATION (do not cherry-pick #205; reuse its purchase/refill "
                 "failure-reason shape, 0.5 refill factor and state enum idea)",
     "changedFiles": ["src/data/progressionLadder.ts (new, rule-generated for the shipped "
                      "recipe set)", "src/logic/progressionLadder.ts (new): "
                      "ladderUnlockedSteps(dexCount), ingredientShopState, packQuantity(k), "
                      "purchaseFirstPack, refill", "unit tests"],
     "risk": "LOW (pure, unwired)", "testGate": "unit tests incl. REC-04 negative controls "
     "(deadlock / useless unlock / burst) against the generated ladder",
     "chromium": "unit only", "webkit": "Gate only (classify may skip)",
     "humanVerification": "NOT REQUIRED (unwired)", "orderConstraint": "before I4b"},
    {"id": "I4b", "name": "Economy wiring: Shop NEW入荷 / pack UI / DISCOVERED notice / EP4 "
     "grant retirement / entitlement", "dependsOn": ["I0", "I4a"],
     "strategy": "FRESH_IMPLEMENTATION",
     "changedFiles": ["src/components/ShopOverlay.tsx", "src/components/ResultPanel.tsx",
                      "src/logic/economy.ts", "src/state/starterStock.ts", "src/state/"
                      "gameReducer.ts", "src/state/persistence.ts (unlockedForShopIngredientIds "
                      "known key)", "src/state/progression.ts", "e2e"],
     "risk": "HIGH (changes how every finite ingredient is obtained; existing saves must keep "
             "owned ingredients + stock, no clawback)",
     "testGate": "full vitest + e2e (new-save loop NEW MATERIAL -> Shop -> first pack -> Free "
                 "Cooking; legacy-save carry-over; rollback preservation)",
     "chromium": "REQUIRED", "webkit": "REQUIRED (Full)",
     "humanVerification": "REQUIRED (390x844 video + before/after screenshots)",
     "orderConstraint": "before I5b: a W1 recipe without unlockCondition would otherwise trigger "
                        "the EP4 grant (violates first stock 0)"},
    {"id": "I5a", "name": "P2: 7 W1 ingredient records (ladder-dark)", "dependsOn": ["I0", "I3",
     "I4a"], "strategy": "FRESH_IMPLEMENTATION (data rows)",
     "changedFiles": ["src/data/ingredients.ts (+7 rows, pieceVisual on 3)",
                      "src/data/ingredients.test.ts", "economy/shop data tests"],
     "risk": "LOW (no recipe uses them yet -> no ladder step -> not reachable)",
     "testGate": "data tests incl. fresh-tomato != cherry-tomato, pack = 10 x k, no Shop row "
                 "before the ladder step", "chromium": "REQUIRED (smoke)",
     "webkit": "REQUIRED (Gate)",
     "humanVerification": "NOT REQUIRED if nothing becomes player-visible; REQUIRED if the "
                          "slice is merged into I5b",
     "orderConstraint": "may be folded into I5b; must not land before I0 is released"},
    {"id": "I5b", "name": "W1 recipe content (atomic)", "dependsOn": ["I0", "I1", "I2", "I4b",
     "I5a"], "strategy": "FRESH_IMPLEMENTATION",
     "changedFiles": ["src/data/recipes.ts (+10)", "src/data/recipeSauceProfiles.ts (+10)",
                      "src/data/cookingProfiles.ts (CUT +9)", "src/data/referencePizza.ts "
                      "(MD-01 +10, RT-01c for 3)", "ladder regeneration (25 recipes; ham k 1->3)",
                      "discovery regression tests (port REC-08 probe)"],
     "risk": "MEDIUM", "testGate": "referencePizza coverage 25/25, discovery 0 collisions, "
     "REC-04 checker on the 25-recipe ladder, completion/scoring per recipe",
     "chromium": "REQUIRED", "webkit": "REQUIRED (Full)",
     "humanVerification": "REQUIRED (W1 recipes playable; 390x844 video)",
     "orderConstraint": "atomic: recipe ids, CUT allowlist (RecipeId-typed), sauce profiles and "
                        "MD-01 fixtures (coverage test) cannot be split"},
    {"id": "I6", "name": "W1 release gate (integration E2E + human-feel)", "dependsOn": ["I5b"],
     "strategy": "tests/docs only",
     "changedFiles": ["e2e W1 loop spec", "docs/reports"], "risk": "LOW",
     "testGate": "new save -> 25/25 reachable in E2E; REC-04 S6 low/standard real-device runs",
     "chromium": "REQUIRED", "webkit": "REQUIRED (Full)",
     "humanVerification": "REQUIRED (owner real-device playthrough)",
     "orderConstraint": "last"},
]

BRANCH_STRATEGY = [
    {"branch": "Production Visual P1", "decision": "CHERRY_PICK",
     "commits": {"39ce35c": "cherry-pick (only src commit)", "d323d36": "cherry-pick (tools "
                 "pixel harness)", "e83bee4": "cherry-pick (tools HV script)",
                 "9420478": "docs", "802b023": "docs", "589b324": "tools (evidence generator; "
                 "optional)", "d62e884..3fc02a0": "docs/evidence + visual-gate preview app: do not "
                 "bring the preview app into main; bring the W1 evidence docs only if wanted"},
     "notes": "conflicts only with RT-01 (PizzaThumbnail.tsx import lines); keep both edits"},
    {"branch": "RT-01a/b", "decision": "MERGE_AS_IS (PR from branch)",
     "commits": {"d1b22ca": "docs", "745fbd7": "docs (Owner Decision)", "e708dd2": "code",
                 "afcce51": "code", "269b5d3": "docs", "63d3acf": "docs"},
     "notes": "based on current main 1e53baa; no rebase needed"},
    {"branch": "#205", "decision": "FRESH_IMPLEMENTATION (do not merge)",
     "commits": {"9035606": "OBSOLETE as a whole"},
     "keep": ["purchase/refill failure-reason union shape", "refill = ceil(0.5 x price)",
              "LOCKED/AVAILABLE_TO_BUY/OWNED state enum (already on main)",
              "input sanitisation helpers"],
     "obsolete": ["PROGRESSION_INGREDIENT_UNLOCKS (101-row absolute star gates + 60/100/140/180)",
                  "progressionIngredientState gating on stars", "PROGRESSION_PURCHASE_GRANT_USES "
                  "= 10 uses / USES_PER_PIZZA (replaced by 10 x k storage units)",
                  "progressionStars sum(max(2,BEST)) as a material gate"],
     "notes": "star formula may be revisited for non-material gates later; not needed for W1"},
    {"branch": "#206", "decision": "REBASE (or merge main); land as-is",
     "commits": {"4c1da87": "code", "edfca8b": "tests"},
     "notes": "persistence.ts unchanged on main since #206 base; merge-tree clean; 665/665 "
              "src/state tests pass on main+#206"},
    {"branch": "#222", "decision": "MERGE_MAIN then land as-is",
     "commits": {"9abe481": "code (required for W1: REC-03 Implementation Gate)",
                 "81a850c": "docs (Known Limitation)"},
     "notes": "the only commits; both needed. #218 is docs-only authority, not required in main "
              "for W1"},
    {"branch": "#217 / #214 / #209", "decision": "DOCS_ONLY / SUPERSEDED for W1",
     "commits": {}, "notes": "REC-04 superseded star gates (#209/#214 D-1) and unlock fee "
                             "(#217); #214 D-2 (M4 pieces, no migration) agrees with REC-04"},
    {"branch": "#220 / #221 / REC-01..03 / REC-04", "decision": "DOCS_ONLY",
     "commits": {}, "notes": "authority inputs for I4a/I5a/I5b; merging them is optional and "
                             "not a code dependency"},
]

HAM_X3 = {
    "classification": "RECIPE_SPECIFIC_QUANTITY -> DERIVED per-ingredient pack size",
    "recipeQuantity": "pizza-portuguesa ham minCount 3 (authored #221, approved Q1 + Q2 "
                      "KEEP AUTHORED COUNTS)",
    "existingRecipes": "unchanged: capricciosa ham 1, meat-lovers ham 1 (main)",
    "economyEffect": "OD-REC04-3 defines pack = 10 x k with k = max minCount of that ingredient "
                     "over shipped recipes. With W1: ham k = max(1,1,2,2,3) = 3 -> pack 30 "
                     "(Hawaiian/Bambino alone already make k = 2)",
    "globalBalanceChange": False,
    "referenceFixtureOnly": False,
    "ownerDecisionNeeded": False,
    "note": "REC-04 JSON tags 'hamKChangeForW1' as PROPOSED, but it is a mechanical output of two "
            "confirmed decisions (Q1/Q2 quantity + OD-REC04-3 rule). Implement by generating k "
            "from the recipe set (I5b ladder regeneration), never by hand-editing ham.",
}

INVENTORY_UNIT = {
    "current": "scatter = pieces, spread = uses (Save v2, schemaVersion 2)",
    "rec04": "storage unit unchanged; display 'ピザ10枚分（30個）'; units row is "
             "CONFIRMED_OWNER_DECISION",
    "pr214": "D-2 = M4 (pieces, no migration) -- RECORDED_IN_OPEN_PR, consistent with REC-04",
    "pr205": "'1 pizza = 1 use' model -- not adopted",
    "verdict": "NOT a W1/P2 blocker. Pack = 10 x k pieces works in the current unit; a later "
               "piece->portion migration (if ever wanted) can convert stock with k and is "
               "independent of W1.",
}

REMAINING_OWNER_DECISIONS: list[dict] = []  # none -- see IMPLEMENTATION_DEFAULTS

IMPLEMENTATION_DEFAULTS = [
    {"id": "DEF-1", "topic": "Entitlement monotonicity",
     "default": "an ingredient that became AVAILABLE never re-locks when a later wave regenerates "
                "the ladder (persist unlockedForShopIngredientIds)",
     "why_not_owner": "only prevents a regression; changes no approved value (REC-04 §16/§17)"},
    {"id": "DEF-2", "topic": "EP4 grant retirement for existing saves",
     "default": "stop EP4 grants for all saves going forward; keep every already-owned id and "
                "its stock (no clawback)", "why_not_owner": "REC-04 §17 already states existing "
                "stock is kept and Dex 15 players start at step 15"},
    {"id": "DEF-3", "topic": "W1 recipe baseRewardPitz",
     "default": "100 (every shipped recipe; REC-04 simulation input)",
     "why_not_owner": "#221 marked it out of scope, but REC-04's approved economy safety record "
                      "was computed with 100"},
    {"id": "DEF-4", "topic": "Emoji fallback for the 3 dedicated visuals",
     "default": "keep an emoji string (required field) that is never rendered while pieceVisual is "
                "set; must not be a rejected glyph (🦪/🐚/🟢) nor 🍅 for fresh-tomato",
     "why_not_owner": "presentation fallback only; visual authority is the Human-approved SVG"},
    {"id": "DEF-5", "topic": "Ladder regeneration per wave",
     "default": "I4a generates the ladder for the shipped set (15); I5b regenerates for 25",
     "why_not_owner": "REC-04 marks ladder order DERIVED_FROM_CONFIRMED_RULES, regenerated per "
                      "wave"},
]

BLOCKERS = [
    {"id": "B-1", "blocks": ["P2", "W1"], "what": "main drops unknown recipe/ingredient data on "
     "write", "resolution": "I0 (#206) released before any new id"},
    {"id": "B-2", "blocks": ["P2", "W1"], "what": "no Discovery Ladder / pack economy on main "
     "(EP1 chain + EP4 grant + legacy restock/price still active)", "resolution": "I4a, I4b"},
    {"id": "B-3", "blocks": ["P2"], "what": "IngredientGlyph (P1) only on a branch",
     "resolution": "I3"},
    {"id": "B-4", "blocks": ["W1"], "what": "Completion Gate G1/Q only in PR #222 (owner Human "
     "PASS not recorded)", "resolution": "I1"},
    {"id": "B-5", "blocks": ["W1 (Parmigiana, Portuguesa, Puttanesca)"], "what": "RT-01a/b only "
     "on a branch", "resolution": "I2"},
    {"id": "B-6", "blocks": ["W1"], "what": "MD-01 fixtures 0/10, CUT allowlist 0/9, recipe "
     "records 0/10", "resolution": "I5b (atomic)"},
]


# --------------------------------------------------------------------------------------------
# Build
# --------------------------------------------------------------------------------------------
def build() -> tuple[dict, list[str]]:
    failures: list[str] = []

    commits = []
    for name, (key, sha) in NAMED_COMMITS.items():
        ok = is_ancestor(sha, sha_of(key))
        on_main = is_ancestor(sha, sha_of("main"))
        commits.append({"name": name, "sha": sha, "carriedBy": key, "reachable": ok,
                        "onMain": on_main})
        if not ok:
            failures.append(f"named commit {name} {sha[:7]} not reachable from {key}")
        if on_main:
            failures.append(f"named commit {name} unexpectedly already on main")

    probes = [run_probe(p) for p in PROBES]
    failures += [f"probe {p['id']}: expected {p['expected']} got {p['actual']}" for p in probes
                 if not p["pass"]]

    facts = main_facts()
    base206 = git("merge-base", sha_of("main"), sha_of("pr206")).strip()
    facts["persistenceUnchangedSincePr206Base"] = (
        show(base206, "src/state/persistence.ts") == show(sha_of("main"), "src/state/persistence.ts"))
    if not facts["persistenceUnchangedSincePr206Base"]:
        failures.append("main persistence.ts changed since #206 base -- re-audit #206 rebase")

    # negative controls: the probe machinery must be able to fail
    neg = [run_probe(("NEG_MISSING_NEEDLE", "main", "src/state/persistence.ts", "contains",
                      "THIS_NEEDLE_DOES_NOT_EXIST", True, "negative control")),
           run_probe(("NEG_SAME_DIFFERENT_FILE", "pr206", "src/state/persistence.ts", "same", None,
                      True, "negative control"))]
    if any(p["pass"] for p in neg):
        failures.append("negative control passed unexpectedly")
    expected_facts = {"recipeCount": 15, "ingredientCount": 22, "cutAllowlistCount": 15,
                      "w1RecipesOnMain": [], "p2IngredientsOnMain": [],
                      "hamMinCountsOnMain": [1, 1]}
    for k, v in expected_facts.items():
        if facts[k] != v:
            failures.append(f"main fact {k}: expected {v} got {facts[k]}")

    merges = {}
    for i, a in enumerate(IMPL_BRANCHES):
        merges[f"main+{a}"] = merge_conflicts(sha_of("main"), sha_of(a))
        for b in IMPL_BRANCHES[i + 1:]:
            merges[f"{a}+{b}"] = merge_conflicts(sha_of(a), sha_of(b))
    for k, v in merges.items():
        if v != EXPECTED_CONFLICTS[k]:
            failures.append(f"merge {k}: expected conflicts {EXPECTED_CONFLICTS[k]} got {v}")

    code_paths = {}
    for key in IMPL_BRANCHES:
        paths = changed_paths(key)
        code_paths[key] = {
            "src": len([p for p in paths if p.startswith("src/")]),
            "e2e": len([p for p in paths if p.startswith("e2e/")]),
            ".github": len([p for p in paths if p.startswith(".github/")]),
            "docs": len([p for p in paths if p.startswith("docs/")]),
            "other": len([p for p in paths if not p.startswith(("src/", "e2e/", ".github/",
                                                                 "docs/"))]),
        }

    auth = authority()
    rec04_status = {od["id"]: od["status"] for od in auth["rec04"]["ownerDecisions"]}
    if any(s != "CONFIRMED_OWNER_DECISION" for s in rec04_status.values()) or \
            auth["rec04"]["verdict"] != "RESOLVED":
        failures.append(f"REC-04 record not RESOLVED: {rec04_status}")
    rec0103_status = {od["id"]: od["status"] for od in auth["rec0103"]["ownerDecisions"]}
    if any(rec0103_status.get(q) != "APPROVED" for q in ("Q1", "Q2", "Q3", "Q4")):
        failures.append(f"REC-01..03 record not APPROVED: {rec0103_status}")
    approved = auth["rec04"]["recommended"]["rules"]
    ham_k = approved.get("hamKChangeForW1", {}).get("status")

    p2 = p2_readiness(auth)
    w1 = w1_recipes(auth)
    for row in w1:
        if row["recipe"] in ("parmigiana-pizza", "pizza-portuguesa", "puttanesca-pizza"):
            if row["nonSaucePieces"] <= RING_SLOTS:
                failures.append(f"{row['recipe']} expected > 8 pieces")
        elif row["nonSaucePieces"] > RING_SLOTS:
            failures.append(f"{row['recipe']} unexpectedly > 8 pieces")
    if sum(1 for r in w1 if r["cut"]) != 9:
        failures.append("CUT count != 9")
    for row in w1:
        allowed = {"hawaiian": ["bakeTarget"]}.get(row["recipe"], [])
        if row["driftFromPr221"] != allowed:
            failures.append(f"{row['recipe']} drift from #221 {row['driftFromPr221']} != {allowed}")
    port = next(r for r in w1 if r["recipe"] == "pizza-portuguesa")
    if port["items"].get("ham") != 3:
        failures.append("pizza-portuguesa ham != 3")
    ham_ks = [r["k"] for r in auth["rec04"]["recommended"]["w1IngredientMatrix"]]
    if any(k not in (2, 3) for k in ham_ks):
        failures.append("unexpected k in W1 ingredient matrix")

    def counts(rows: list[dict]) -> dict:
        return {s: sum(1 for r in rows if r["readiness"] == s)
                for s in ("READY", "WAITING", "BLOCKED")}

    p2_counts = counts(p2)
    w1_counts = counts(w1)
    p2_verdict = "READY" if p2_counts["READY"] == len(p2) else "NOT READY"
    w1_verdict = "READY" if w1_counts["READY"] == len(w1) else "NOT READY"

    out = {
        "schemaVersion": 1,
        "kind": "TETO_PROGRESS2_W1_INTEGRATION_PREFLIGHT",
        "auditDate": AUDIT_DATE,
        "generatedBy": "tools/progression2_w1_integration_preflight.py",
        "scope": "READ-ONLY audit; docs/tools only; no src/e2e/.github change; no PR; no merge",
        "githubHeads": {k: {"ref": v["ref"], "sha": v["sha"], "pr": v["pr"], "state": v["state"]}
                        for k, v in PINS.items()},
        "namedCommits": commits,
        "mainFacts": facts,
        "probes": probes,
        "negativeControls": {"count": 2, "allFailedAsExpected": not any(p["pass"] for p in neg)},
        "mergeMatrix": merges,
        "changedPathCounts": code_paths,
        "dependencyGraph": DEPENDENCY_GRAPH,
        "saveCompatibility": SAVE_MATRIX,
        "pr205Audit": next(b for b in BRANCH_STRATEGY if b["branch"] == "#205"),
        "completionGate": {
            "requiredCommits": ["9abe481c313998a44b94b15cd4874fb3d3e7e03b",
                                "81a850c26edf4c7f7f8cf69fad64e66d75830efd"],
            "notRequired": ["#218 (docs-only design authority)"],
            "ci": "build + WebKit Gate success at 81a850c (WebKit shards ran at 9abe481)",
            "humanVerification": "videos delivered by the implementing session; owner PASS not "
                                 "found in PR #222 / Issue #215",
            "w1Compatibility": "all W1 minCounts >= 1 (G1), Lunch Rush order = minCount (LR-A), "
                               "fixtures at ideal quantity score Q = 1",
        },
        "inventoryUnit": INVENTORY_UNIT,
        "hamX3": dict(HAM_X3, rec04JsonStatus=ham_k),
        "p2Ingredients": p2,
        "p2Counts": p2_counts,
        "w1Recipes": w1,
        "w1Counts": w1_counts,
        "integrationSlices": SLICES,
        "branchStrategy": BRANCH_STRATEGY,
        "remainingOwnerDecisions": REMAINING_OWNER_DECISIONS,
        "implementationDefaults": IMPLEMENTATION_DEFAULTS,
        "blockers": BLOCKERS,
        "verdict": {
            "P2": p2_verdict,
            "W1_IMPLEMENTATION": w1_verdict,
            "nextImplementationSlice": "I0",
            "nextSliceReason": "smallest dependency-free prerequisite on every path to P2/W1; "
                               "code already exists and merges clean; needs one production "
                               "release of lead time before any new id ships. I1/I2/I3/I4a can "
                               "proceed in parallel.",
            "ownerDecisionsRequired": len(REMAINING_OWNER_DECISIONS),
        },
        "checkerFailures": failures,
    }
    return out, failures


def render(data: dict) -> str:
    return json.dumps(data, ensure_ascii=False, indent=2) + "\n"


def live_drift() -> list[str]:
    notes = []
    for key, pin in PINS.items():
        res = subprocess.run(["git", "ls-remote", "origin", f"refs/heads/{pin['ref']}"], cwd=ROOT,
                             capture_output=True, text=True)
        tip = res.stdout.split()[0] if res.stdout.strip() else None
        if tip != pin["sha"]:
            notes.append(f"{key}: pinned {pin['sha'][:7]} remote {tip[:7] if tip else 'MISSING'}")
    return notes


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--live", action="store_true")
    args = ap.parse_args()

    data, failures = build()
    text = render(data)
    if args.write:
        OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
        OUT_JSON.write_text(text, encoding="utf-8")
        print(f"wrote {OUT_JSON.relative_to(ROOT)}")
    if args.check:
        if not OUT_JSON.exists() or OUT_JSON.read_text(encoding="utf-8") != text:
            failures.append("committed JSON drifts from regenerated output (run --write)")
    if args.live:
        drift = live_drift()
        print("live drift: " + ("none" if not drift else "; ".join(drift)))
    print(f"probes {sum(p['pass'] for p in data['probes'])}/{len(data['probes'])}, "
          f"merges {len(data['mergeMatrix'])}, P2 {data['p2Counts']}, W1 {data['w1Counts']}")
    print(f"P2: {data['verdict']['P2']} / W1 IMPLEMENTATION: {data['verdict']['W1_IMPLEMENTATION']}"
          f" / NEXT: {data['verdict']['nextImplementationSlice']}")
    if failures:
        print("FAIL:\n  " + "\n  ".join(failures))
        return 1
    print("PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
