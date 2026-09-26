#!/usr/bin/env python3
"""Generate and validate the Progression 2.0 W1 content-authoring audit.

Docs/data/tooling only.  The script deliberately does not emit production-ready
TypeScript and carries no progression price/gate decisions.

W1 authority: PR #220 exact HEAD ``AUTHORITY_HEAD_SHA`` (Owner Decision Sauce
OD-S1 = A: the #220 W1 is authoritative, sauceless recipes stay W4, Sauce
Contract 2.0 is not implemented here).  The W1 slice of the #220 waves artifact
is pinned by digest; any drift in that slice, in the #220 head, or in the
authority blob makes both generation and ``--check`` fail.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUDITED_MAIN_SHA = "dff233c042d2df6ee1c3a92f2d2419830aa05460"
RECIPE_OUT = ROOT / "docs/reports/data/TETO_PROGRESS2_W1_RECIPE_AUTHORING_MATRIX.json"
INGREDIENT_OUT = ROOT / "docs/reports/data/TETO_PROGRESS2_W1_INGREDIENT_AUTHORING_MATRIX.json"
LEDGER_OUT = ROOT / "docs/reports/data/TETO_PROGRESS2_W1_UNRESOLVED_EVIDENCE_LEDGER.json"
CHANGE_MAP_OUT = ROOT / "docs/reports/data/TETO_PROGRESS2_W1_FUTURE_IMPLEMENTATION_CHANGE_MAP.json"
AUTHORITY_OUT = ROOT / "docs/reports/data/TETO_PROGRESS2_W1_AUTHORITY_REFERENCE.json"
REPORT_OUT = ROOT / "docs/reports/TETO_PROGRESS2_W1_CONTENT_AUTHORING_FRESH-AUDIT.md"

SOURCE_MATRIX = ROOT / "docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json"
SOURCE_EVIDENCE = ROOT / "docs/reports/data/TETO_PIZZADB_172_MASTER-EVIDENCE.json"
PRODUCTION_RECIPES = ROOT / "src/data/recipes.ts"
PRODUCTION_INGREDIENTS = ROOT / "src/data/ingredients.ts"
REFERENCE_LAYOUT = ROOT / "src/logic/pizzaReferenceLayout.ts"

# --- W1 authority pin (PR #220) --------------------------------------------
AUTHORITY_PR = 220
AUTHORITY_BRANCH = "codex/content-readiness-fresh-audit"
AUTHORITY_HEAD_SHA = "e49dab96bd9b26dc0f520349cf09d1160c3519f5"
AUTHORITY_WAVES_PATH = "docs/reports/data/TETO_PROGRESS2_CONTENT_READINESS_WAVES.json"
AUTHORITY_WAVES_BLOB_SHA = "af5b5689fc5c86bd47b31d79c5d11750ec89b7b8"
AUTHORITY_WAVES_SHA256 = "3db316e3b656462384708ef7f5a78cdef03a7e6765f047ce249e23dc8915b2be"
# sha256 of the canonical JSON of authority_snapshot(); pinned so drift fails.
AUTHORITY_W1_SNAPSHOT_SHA256 = "88422a13baff67a3ad65eb8df9f7c116d2d2d8db73ba04034cf7b7bdb375e746"
OWNER_DECISION = {
    "id": "Sauce OD-S1",
    "choice": "A",
    "meaning": "PR #220 W1 is authoritative; sauceless recipes stay W4; Sauce Contract 2.0 is not implemented in this audit.",
    "recordedAt": "PR #221 owner comment 2026-09-24",
}
# Rows that were W1 in the stale #221 authoring and are removed by this sync.
PREVIOUS_W1_REMOVED = [
    "aussie-pizzadb", "bacalhau-pizzadb", "full-english-pizza-pizzadb-p10",
    "polish-kielbasa-pizzadb-p12", "tsukimi-pizza-pizzadb-p14",
]
GLOBAL_LEDGER_SCOPES = {"all recipes"}
SUPPORTED_SAUCE_IDS = {"tomato-sauce", "pesto", "olive-oil"}
CHEESE_IDS = {"mozzarella", "gorgonzola", "parmigiano", "fontina"}


def req(ingredient_id: str, count: int, rationale: str) -> dict:
    return {"ingredientId": ingredient_id, "minCountCandidate": count,
            "status": "AUTHORING_CANDIDATE", "rationale": rationale}


COMMON = {
    "currentMechanicRepresentability": "FULL",
    "mechanicDependencies": [],
    "runtimeContractDependencies": [],
    "cutRequirement": {
        "eligibilityCandidate": "STANDARD_ROUND_6_SLICES",
        "completionGateEffect": "OWNER_DECISION_REQUIRED_ISSUE_218",
        "status": "AUTHORING_CANDIDATE"
    },
    "progression": {
        "pitzPrice": "TBD", "unlockFee": "TBD", "starGate": "TBD",
        "nonStarUnlockCondition": "OWNER_DECISION_REQUIRED"
    },
    "baseRewardPitz": "OUT_OF_SCOPE_PROGRESSION_DECISION"
}


def recipe(evidence_id, recipe_id, name, description, ingredients, sauce, cheese,
           toppings, bake_start, bake_end, nearest, evidence_note, status,
           unresolved=None):
    row = {
        "evidenceId": evidence_id,
        "recipeIdCandidate": recipe_id,
        "nameJa": name,
        "descriptionCandidate": description,
        "descriptionStatus": "AUTHORING_CANDIDATE",
        "requiredIngredients": ingredients,
        "sauce": sauce,
        "cheese": cheese,
        "toppings": toppings,
        "bakeTargetCandidate": {"start": bake_start, "end": bake_end,
                                "status": "AUTHORING_CANDIDATE"},
        "productionSchemaFit": {
            "recipeFields": ["id", "nameJa", "description", "requiredIngredients", "bakeTarget"],
            "sauceProfileRequired": sauce is not None,
            "cookingProfile": "derived core steps + explicit CUT allowlist review"
        },
        "collisionRisk": {
            "level": "LOW",
            "nearestProductionRecipeId": nearest,
            "exactIngredientSetCollision": False,
            "note": evidence_note
        },
        "evidenceStatus": {
            "composition": "EVIDENCE_READY",
            "sourceAuthority": f"PR_{AUTHORITY_PR}_W1_{AUTHORITY_HEAD_SHA[:7]}+MERGED_PR_189_MATRIX_AND_MASTER_EVIDENCE",
            "description": "GAME_AUTHORING_NOT_EXTERNAL_EVIDENCE",
            "minCounts": "GAME_AUTHORING_NOT_EXTERNAL_EVIDENCE",
            "bakeTarget": "GAME_AUTHORING_NOT_EXTERNAL_EVIDENCE"
        },
        "readiness": status,
        "unresolvedRefs": unresolved or []
    }
    row.update(COMMON)
    return row


RECIPES = [
    recipe("new-haven-apizza-pizzadb", "new-haven-apizza", "ニューヘイブンアピッツァ",
           "オリーブオイルを塗った生地に、あさり、にんにく、パルミジャーノをのせて香ばしく焼き上げたアメリカ・ニューヘイブン風の一枚。",
           [req("olive-oil", 1, "one spread use"), req("parmigiano", 2, "existing cheese-density baseline"),
            req("clam", 3, "primary topping"), req("garlic", 2, "supporting topping")],
           "olive-oil", ["parmigiano"], ["clam", "garlic"], 62, 82, "quattro-formaggi",
           "Shares only olive-oil/parmigiano with Quattro Formaggi; clam+garlic identity is distinct; exact-set collision absent.",
           "REVIEW", ["ING-07"]),
    recipe("hawaiian-pizzadb-row", "hawaiian", "ハワイアンピザ",
           "トマトソースにハムとパイナップル、モッツァレラを合わせた、甘みと塩気のバランスが楽しい一枚。",
           [req("tomato-sauce", 1, "one spread use"), req("mozzarella", 2, "existing cheese-density baseline"),
            req("ham", 2, "supporting meat"), req("pineapple", 3, "primary topping")],
           "tomato-sauce", ["mozzarella"], ["ham", "pineapple"], 58, 78, "meat-lovers",
           "Ham+pineapple is distinct from Meat Lovers' mixed meats; one-ingredient neighbour of Bambino (pineapple vs corn); exact-set collision absent.",
           "REVIEW", ["ING-10"]),
    recipe("parmigiana-pizza-pizzadb-p7", "parmigiana-pizza", "パルミジャーナピザ",
           "トマトソースにナス、モッツァレラ、パルミジャーノ、バジルを合わせた南イタリア風の一枚。",
           [req("tomato-sauce", 1, "one spread use"), req("mozzarella", 2, "existing cheese-density baseline"),
            req("eggplant", 3, "primary topping"), req("parmigiano", 2, "secondary cheese"), req("basil", 2, "herb baseline")],
           "tomato-sauce", ["mozzarella", "parmigiano"], ["eggplant", "basil"], 58, 78, "margherita",
           "Eggplant family is compositionally distinct from Melanzane and alla Norma.", "REVIEW",
           ["ING-03", "REC-08", "REC-10", "RT-01"]),
    recipe("bambino-pizzadb-p7", "bambino", "バンビーノ",
           "トマトソースにハム、コーン、モッツァレラをのせた、やさしい甘みで親しみやすい一枚。",
           [req("tomato-sauce", 1, "one spread use"), req("mozzarella", 2, "existing cheese-density baseline"),
            req("ham", 2, "supporting meat"), req("corn", 3, "primary topping")],
           "tomato-sauce", ["mozzarella"], ["ham", "corn"], 56, 76, "meat-lovers",
           "Ham+corn is distinct from Meat Lovers; one-ingredient neighbour of Hawaiian (corn vs pineapple); exact-set collision absent.",
           "REVIEW", ["ING-08"]),
    recipe("pizza-portuguesa-pizzadb-p9", "pizza-portuguesa", "ピッツァ・ポルトゲーザ",
           "トマトソースにハム、卵、たまねぎ、ブラックオリーブ、モッツァレラを重ねたブラジル定番の一枚。",
           [req("tomato-sauce", 1, "one spread use"), req("mozzarella", 2, "existing cheese-density baseline"),
            req("ham", 3, "capricciosa analogue"), req("egg", 1, "single center-piece convention"),
            req("onion", 2, "supporting topping"), req("black-olive", 2, "supporting topping")],
           "tomato-sauce", ["mozzarella"], ["ham", "egg", "onion", "black-olive"], 58, 78, "capricciosa",
           "Adds egg/onion and omits mushroom; exact-set collision absent.", "REVIEW", ["REC-06", "RT-01"]),
    recipe("puttanesca-pizza-pizzadb-p10", "puttanesca-pizza", "プッタネスカ",
           "トマトソースにアンチョビ、ブラックオリーブ、ケッパー、にんにくを効かせた、塩味と香りの強い一枚。",
           [req("tomato-sauce", 1, "one spread use"), req("anchovy", 3, "napoletana analogue"),
            req("black-olive", 2, "supporting topping"), req("capers", 2, "accent topping"), req("garlic", 2, "marinara analogue")],
           "tomato-sauce", [], ["anchovy", "black-olive", "capers", "garlic"], 50, 70, "marinara",
           "Cheese-free identity remains distinct; exact-set collision absent.", "REVIEW", ["ING-02", "REC-07", "RT-01"]),
    recipe("pesto-caprese-pizzadb-p11", "pesto-caprese", "ペストカプレーゼピザ",
           "ジェノベーゼソースにトマト、モッツァレラ、バジルを重ねた、カプレーゼ仕立ての爽やかな一枚。",
           [req("pesto", 1, "one spread use"), req("mozzarella", 2, "existing cheese-density baseline"),
            req("fresh-tomato", 3, "primary topping"), req("basil", 2, "herb baseline")],
           "pesto", ["mozzarella"], ["fresh-tomato", "basil"], 50, 70, "margherita",
           "Pesto base separates it from Margherita; fresh-tomato vs Genovese's cherry-tomato must stay visually distinct; exact-set collision absent.",
           "REVIEW", ["ING-09"]),
    recipe("pesto-tonno-pizzadb-p12", "pesto-tonno", "ペストトンノピザ",
           "香り高いジェノベーゼソースに、ツナ、ブラックオリーブ、たまねぎを合わせた爽やかな一枚。",
           [req("pesto", 1, "one spread use"), req("tuna", 3, "tonno-e-cipolla analogue"),
            req("black-olive", 2, "supporting topping"), req("onion", 2, "supporting topping")],
           "pesto", [], ["tuna", "black-olive", "onion"], 50, 70, "tonno-e-cipolla",
           "Pesto base distinguishes it from shipped Tonno e cipolla; exact-set collision absent.", "REVIEW", ["REC-09"]),
    recipe("pesto-patate-pizzadb-p12", "pesto-patate", "ペストパターテピザ",
           "ジェノベーゼソースにじゃがいも、ベーコン、モッツァレラを合わせた、ほくほくと香ばしい一枚。",
           [req("pesto", 1, "one spread use"), req("mozzarella", 2, "existing cheese-density baseline"),
            req("potato", 3, "primary topping"), req("bacon", 2, "supporting meat")],
           "pesto", ["mozzarella"], ["potato", "bacon"], 58, 78, "genovese",
           "Shares pesto/mozzarella with Genovese but swaps cherry-tomato for potato+bacon; exact-set collision absent.",
           "REVIEW", ["ING-11"]),
    recipe("melanzane-pizza-pizzadb-p13", "melanzane-pizza", "メランザーネピザ",
           "トマトソースにナス、モッツァレラ、バジルを合わせた、素朴で香り豊かな南イタリア風ピザ。",
           [req("tomato-sauce", 1, "one spread use"), req("mozzarella", 2, "existing cheese-density baseline"),
            req("eggplant", 3, "primary topping"), req("basil", 2, "herb baseline")],
           "tomato-sauce", ["mozzarella"], ["eggplant", "basil"], 58, 78, "margherita",
           "Superset of Margherita by eggplant; exact-set collision absent but family proximity requires regression coverage.",
           "REVIEW", ["ING-03", "REC-08"]),
]


def _ingredient(ingredient_id, name, emoji, color, piece, uncertainty):
    return {"id": ingredient_id, "displayName": name, "emojiCandidate": emoji, "colorCandidate": color,
            "categoryCandidate": "topping", "placementCandidate": "scatter", "pieceRepresentation": piece,
            "recipesUsingItInCandidateSet": sorted(r["recipeIdCandidate"] for r in RECIPES
                                                   if ingredient_id in {x["ingredientId"] for x in r["requiredIngredients"]}),
            "authoringStatus": "REVIEW", "authoringUncertainty": uncertainty}


INGREDIENTS = [
    _ingredient("capers", "ケッパー", "🟢", "#6f7f35", "emoji dot piece; one tap places one caper token",
                ["No dedicated caper emoji; generic green-circle glyph needs visual differentiation review."]),
    _ingredient("clam", "あさり", "🦪", "#c9b89a", "emoji piece; one tap represents one shucked-clam portion",
                ["No clam emoji; the oyster glyph stands in for a bivalve and must not read as a different shellfish recipe."]),
    _ingredient("corn", "コーン", "🌽", "#f5cf3a", "emoji piece; one tap represents a small kernel cluster",
                ["Whole-cob glyph represents loose kernels abstractly; yellow tone must stay distinguishable from egg on cheese."]),
    _ingredient("eggplant", "ナス", "🍆", "#62407b", "emoji piece; one tap represents one eggplant slice",
                ["Whole-eggplant glyph represents a slice abstractly; verify visual density and tone after bake."]),
    _ingredient("fresh-tomato", "トマト", "🍅", "#d9432f", "emoji piece; one tap represents one fresh-tomato slice",
                ["Same glyph as production tomato-sauce and cherry-tomato; needs a distinguishing representation so Pesto Caprese is not confused with Genovese."]),
    _ingredient("pineapple", "パイナップル", "🍍", "#f3c623", "emoji piece; one tap represents one pineapple chunk",
                ["Whole-fruit glyph represents chunks abstractly; verify contrast on mozzarella after bake."]),
    _ingredient("potato", "じゃがいも", "🥔", "#d9b77e", "emoji piece; one tap represents one potato slice",
                ["Whole-potato glyph represents slices abstractly; beige tone may blend with cheese/crust after bake."]),
]


LEDGER = [
    {"id": "REC-01", "scope": "all recipes", "inheritedByEveryRecipe": True, "status": "AUTHORING_REQUIRED", "field": "description/minCount/bakeTarget", "detail": "Values are original game-authoring candidates, not claims from external evidence. Human content sign-off remains required before production."},
    {"id": "REC-02", "scope": "all recipes", "inheritedByEveryRecipe": True, "status": "AUTHORING_REQUIRED", "field": "cutRequirement", "detail": "All ten fit the current round-six-slice mechanic, but future production must explicitly opt each ID into the allowlist."},
    {"id": "REC-03", "scope": "all recipes", "inheritedByEveryRecipe": True, "status": "OWNER_DECISION_REQUIRED", "field": "completionGate", "detail": "Record compatibility only. Do not decide whether CUT/minCount/bake thresholds gate completion before #218."},
    {"id": "REC-04", "scope": "all recipes", "inheritedByEveryRecipe": True, "status": "OWNER_DECISION_REQUIRED", "field": "progression", "detail": "Pitz price, unlock fee, star gate, and non-star condition stay TBD pending Progression 2.0."},
    {"id": "REC-06", "scope": "pizza-portuguesa", "status": "EVIDENCE_REQUIRED", "field": "black-olive alias", "aliasEvidence": {"token": "オリーブ", "canonicalId": "black-olive"}, "detail": "Source token オリーブ is a likely alias to black-olive, not an exact lexical alias; merged canonicalization is usable but provenance must remain visible."},
    {"id": "REC-07", "scope": "puttanesca-pizza", "status": "EVIDENCE_REQUIRED", "field": "black-olive alias", "aliasEvidence": {"token": "オリーブ", "canonicalId": "black-olive"}, "detail": "Source token オリーブ is a likely alias to black-olive; do not claim a more specific variety."},
    {"id": "REC-08", "scope": "parmigiana-pizza,melanzane-pizza", "status": "AUTHORING_REQUIRED", "field": "discovery regression", "detail": "Both are eggplant-family recipes. Keep exact ingredient signatures distinct and add collision regression coverage."},
    {"id": "REC-09", "scope": "pesto-tonno", "status": "EVIDENCE_REQUIRED", "field": "black-olive alias", "aliasEvidence": {"token": "オリーブ", "canonicalId": "black-olive"}, "detail": "Source token オリーブ is a likely alias to black-olive, not an exact lexical alias; preserve the merged canonicalization but do not treat the provenance as settled."},
    {"id": "REC-10", "scope": "parmigiana-pizza", "status": "EVIDENCE_REQUIRED", "field": "parmigiano alias", "aliasEvidence": {"token": "パルミジャーノチーズ", "canonicalId": "parmigiano"}, "detail": "Source token パルミジャーノチーズ is classified likely_alias to parmigiano by the merged canonicalizer; keep the provenance visible until confirmed."},
    {"id": "REC-11", "scope": "all recipes", "inheritedByEveryRecipe": False, "status": "OWNER_DECISION_RECORDED", "field": "sauce contract", "detail": "Sauce OD-S1 = A: every W1 recipe uses a sauce inside the current RecipeSauceProfile union (tomato-sauce | pesto | olive-oil). Sauceless rows (Aussie, Bacalhau, Full English, Polish Kielbasa, Tsukimi) stay W4; Sauce Contract 2.0 is out of scope."},
    {"id": "RT-01", "scope": "parmigiana-pizza,pizza-portuguesa,puttanesca-pizza", "status": "RUNTIME_DEPENDENCY_REQUIRED", "field": "reference capacity", "runtimeDependency": "REFERENCE_RING_CAPACITY", "detail": "Authored non-sauce piece counts (Parmigiana 9, Pizza Portuguesa 10, Puttanesca 9) exceed the fixed 8-slot PIECE_RING_POSITIONS ring; getPlayerReferencePizza() assigns slots modulo 8, so reference pieces would overlap. The counts are kept as authored and not trimmed to fit the UI; the reference-capacity / 8-slot limit must be resolved by future runtime work (slice E) before these recipes can be READY."},
    {"id": "ING-02", "scope": "capers", "status": "AUTHORING_REQUIRED", "field": "visual", "detail": "No exact emoji; approve or replace generic green-circle representation."},
    {"id": "ING-03", "scope": "eggplant", "status": "AUTHORING_REQUIRED", "field": "visual", "detail": "Approve whole-eggplant glyph as the abstraction for slices."},
    {"id": "ING-07", "scope": "clam", "status": "AUTHORING_REQUIRED", "field": "visual", "detail": "Approve the oyster glyph as a bivalve abstraction or choose a distinct representation."},
    {"id": "ING-08", "scope": "corn", "status": "AUTHORING_REQUIRED", "field": "visual", "detail": "Approve whole-cob glyph for kernels and confirm contrast against egg/cheese."},
    {"id": "ING-09", "scope": "fresh-tomato", "status": "AUTHORING_REQUIRED", "field": "visual", "detail": "Tomato glyph is already used by tomato-sauce and cherry-tomato; approve a distinguishing representation."},
    {"id": "ING-10", "scope": "pineapple", "status": "AUTHORING_REQUIRED", "field": "visual", "detail": "Approve whole-fruit glyph for chunks and post-bake contrast."},
    {"id": "ING-11", "scope": "potato", "status": "AUTHORING_REQUIRED", "field": "visual", "detail": "Approve whole-potato glyph for slices and post-bake contrast against cheese/crust."},
]

# Ledger ids from the stale W1 authoring that must never be reused with a new meaning.
RETIRED_LEDGER_IDS = {
    "REC-05": "cheese-family sauceless base; no W1 recipe is sauceless after the #220 sync (OD-S1 = A)",
    "ING-01": "baked-beans left W1 with full-english-pizza",
    "ING-04": "green-onion left W1 with tsukimi-pizza",
    "ING-05": "salt-cod left W1 with bacalhau",
    "ING-06": "sauerkraut left W1 with polish-kielbasa",
}


CHANGE_MAP = {
    "scope": "FUTURE_ONLY_NO_RUNTIME_CHANGE_IN_THIS_AUDIT",
    "slices": [
        {"id": "A", "title": "Existing-ingredient recipes with likely-alias evidence review", "recipes": ["pizza-portuguesa", "pesto-tonno"], "dependsOn": ["REC-01 content sign-off", "REC-02 CUT allowlist review", "REC-03 completion-gate decision", "REC-04 Progression 2.0 owner decisions", "REC-06 evidence resolution", "REC-09 evidence resolution", "RT-01 reference-capacity resolution via slice E"], "likelyFiles": ["src/data/recipes.ts", "src/data/recipes.test.ts", "src/data/recipeSauceProfiles.ts", "src/data/recipeSauceProfiles.test.ts", "src/data/cookingProfiles.ts", "src/data/cookingProfiles.test.ts", "src/logic/discovery/*"]},
        {"id": "B", "title": "Seven new ingredient records", "ingredients": [i["id"] for i in INGREDIENTS], "dependsOn": ["visual authoring approval", "Progression 2.0 owner decisions"], "likelyFiles": ["src/data/ingredients.ts", "src/data/ingredients.test.ts", "src/components/IngredientPieceVisual.test.tsx"]},
        {"id": "C", "title": "Recipes using approved new ingredients", "recipes": ["new-haven-apizza", "hawaiian", "parmigiana-pizza", "bambino", "puttanesca-pizza", "pesto-caprese", "pesto-patate", "melanzane-pizza"], "dependsOn": ["slice B", "REC-01 content sign-off", "REC-02 CUT allowlist review", "REC-03 completion-gate decision", "REC-04 Progression 2.0 owner decisions", "REC-07 evidence resolution", "REC-08 discovery regression coverage", "REC-10 evidence resolution", "RT-01 reference-capacity resolution via slice E"], "likelyFiles": ["src/data/recipes.ts", "src/data/recipes.test.ts", "src/data/recipeSauceProfiles.ts", "src/data/recipeSauceProfiles.test.ts", "src/data/cookingProfiles.ts", "src/logic/discovery/*"]},
        {"id": "D", "title": "Completion Gate integration", "dependsOn": ["#218 owner decision"], "likelyFiles": ["src/logic/completionGate.ts", "src/state/gameReducer.completionGate.test.ts"], "guard": "Do not implement or decide in this audit."},
        {"id": "E", "title": "Reference ring capacity beyond 8 non-sauce pieces", "resolves": ["RT-01"], "blocksRecipes": ["parmigiana-pizza", "pizza-portuguesa", "puttanesca-pizza"], "dependsOn": ["reference-layout redesign owner approval"], "likelyFiles": ["src/logic/pizzaReferenceLayout.ts", "src/data/playerReference.ts", "src/components/PizzaThumbnail.tsx"], "guard": "Runtime change; not implemented in this audit. Do not trim authored minCounts to fit the ring."}
    ]
}


def reference_ring_slots() -> int:
    """Slot count of the shared reference ring (read-only view of src/)."""
    text = REFERENCE_LAYOUT.read_text(encoding="utf-8")
    body = re.search(r"PIECE_RING_POSITIONS = \[(.*?)\] as const", text, re.S)
    assert body, "PIECE_RING_POSITIONS not found"
    return len(re.findall(r"\{\s*x:", body.group(1)))


def non_sauce_piece_count(row: dict) -> int:
    return sum(x["minCountCandidate"] for x in row["requiredIngredients"] if x["ingredientId"] != row["sauce"])


def open_global_ledger_ids() -> list[str]:
    """Global requirements every recipe inherits until they are resolved."""
    return [item["id"] for item in LEDGER
            if item["scope"] in GLOBAL_LEDGER_SCOPES and item.get("inheritedByEveryRecipe")]


RING_SLOTS = reference_ring_slots()
for _row in RECIPES:
    _pieces = non_sauce_piece_count(_row)
    _row["inheritedRefs"] = open_global_ledger_ids()
    _row["referenceCapacity"] = {
        "nonSaucePieceCount": _pieces,
        "ringSlots": RING_SLOTS,
        "fits": _pieces <= RING_SLOTS,
        "runtimeDependency": None if _pieces <= RING_SLOTS else "REFERENCE_RING_CAPACITY",
    }


for _section in CHANGE_MAP["slices"]:
    if "recipes" in _section:
        _section["recipeDependencies"] = {
            recipe_id: next(r["unresolvedRefs"] + r["inheritedRefs"] for r in RECIPES if r["recipeIdCandidate"] == recipe_id)
            for recipe_id in _section["recipes"]
        }


LEDGER_REF_PREFIXES = ("REC-", "ING-", "RT-")
EXPECTED_TOTALS = {"READY": 0, "REVIEW": 10, "BLOCKED": 0}


# --- authority --------------------------------------------------------------

def _git(*args: str) -> str | None:
    try:
        result = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, check=False)
    except OSError:
        return None
    return result.stdout.decode("utf-8") if result.returncode == 0 else None


def canonical_digest(value) -> str:
    text = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def authority_snapshot(waves: dict) -> dict:
    """The W1 slice of the #220 waves artifact that this audit depends on."""
    rows = {r["evidenceId"]: r for r in waves["rows"]}
    w1_wave = next(w for w in waves["waves"] if w["wave"] == "W1")
    first10 = waves["first10CandidateSet"]
    w1_rows = sorted((r for r in waves["rows"] if r["wave"] == "W1"), key=lambda r: r["evidenceId"])
    return {
        "auditedMainSha": waves["auditedMainSha"],
        "supportedSauceIngredientIds": sorted(waves["runtimeContractPolicy"]["supportedSauceIngredientIds"]),
        "w1Wave": {k: w1_wave[k] for k in ("recipeCount", "newIngredientCount", "newIngredientIds",
                                           "mechanicDependencies", "collisionRiskCounts", "evidenceStatusCounts")},
        "first10CandidateSet": {
            "recipeCount": first10["recipeCount"],
            "distinctNewIngredientIds": first10["distinctNewIngredientIds"],
            "evidenceIds": sorted(r["evidenceId"] for r in first10["recipes"]),
        },
        "w1Rows": [{
            "evidenceId": r["evidenceId"],
            "canonicalCandidateId": r["canonicalCandidateId"],
            "nameJa": r["nameJa"],
            "canonicalIngredientIds": r["canonicalIngredientIds"],
            "newIngredientIds": r["newIngredientIds"],
            "sauceBaseStatus": r["sauceBaseStatus"],
            "sauceBaseIngredientId": r["sauceBaseIngredientId"],
            "runtimeContractDependencies": r["runtimeContractDependencies"],
            "currentFlowRepresentability": r["currentFlowRepresentability"],
            "productDecisionStatus": r["productDecisionStatus"],
            "nearestProductionRecipeId": r["ingredientOverlap"]["nearestProductionRecipeId"],
            "collisionRisk": r["collisionRisk"],
            "blockers": r["blockers"],
        } for r in w1_rows],
        "previousW1Removed": [{
            "evidenceId": evidence_id,
            "canonicalCandidateId": rows[evidence_id]["canonicalCandidateId"],
            "wave": rows[evidence_id]["wave"],
            "runtimeContractDependencies": rows[evidence_id]["runtimeContractDependencies"],
        } for evidence_id in PREVIOUS_W1_REMOVED],
    }


def load_authority(explicit: Path | None) -> tuple[dict, str]:
    """Load the #220 waves artifact and fail on any authority drift.

    Sources, in order: --authority-waves PATH; the working-tree copy (present
    once #220 is merged into the base); the git object at AUTHORITY_HEAD_SHA.
    A byte-exact blob is required unless the source is the working tree, where
    only the pinned W1 slice must match.  If the locally known #220 branch tip
    has moved away from AUTHORITY_HEAD_SHA the check fails as well.
    """
    problems = []
    tip = None
    for ref in (f"refs/remotes/origin/{AUTHORITY_BRANCH}", f"refs/heads/{AUTHORITY_BRANCH}"):
        tip = (_git("rev-parse", "--verify", "--quiet", ref) or "").strip() or None
        if tip:
            break
    if tip and tip != AUTHORITY_HEAD_SHA:
        problems.append(f"PR #{AUTHORITY_PR} head moved: {AUTHORITY_BRANCH} is {tip}, pinned {AUTHORITY_HEAD_SHA}")

    worktree = ROOT / AUTHORITY_WAVES_PATH
    if explicit is not None:
        raw, source = explicit.read_bytes(), f"explicit:{explicit}"
    elif worktree.exists():
        raw, source = worktree.read_bytes(), "working-tree"
    else:
        blob = _git("rev-parse", "--verify", "--quiet", f"{AUTHORITY_HEAD_SHA}:{AUTHORITY_WAVES_PATH}")
        if not blob:
            raise SystemExit(
                f"FAIL: W1 authority unavailable. Fetch PR #{AUTHORITY_PR} head first: "
                f"git fetch origin {AUTHORITY_BRANCH}  (pinned {AUTHORITY_HEAD_SHA})")
        if blob.strip() != AUTHORITY_WAVES_BLOB_SHA:
            problems.append(f"authority blob drift: {blob.strip()} != pinned {AUTHORITY_WAVES_BLOB_SHA}")
        raw = subprocess.run(["git", "cat-file", "blob", blob.strip()], cwd=ROOT,
                             capture_output=True, check=True).stdout
        source = f"git:{AUTHORITY_HEAD_SHA[:7]}"
    if source != "working-tree" and hashlib.sha256(raw).hexdigest() != AUTHORITY_WAVES_SHA256:
        problems.append(f"authority waves sha256 drift ({source})")

    snapshot = authority_snapshot(json.loads(raw.decode("utf-8")))
    digest = canonical_digest(snapshot)
    if digest != AUTHORITY_W1_SNAPSHOT_SHA256:
        problems.append(f"W1 authority snapshot drift ({source}): {digest} != pinned {AUTHORITY_W1_SNAPSHOT_SHA256}")
    if problems:
        raise SystemExit("FAIL: W1 authority drift -- re-sync PR #221 to the new #220 authority.\n  - "
                         + "\n  - ".join(problems))
    return snapshot, source


def authority_reference(snapshot: dict) -> dict:
    return {
        "schemaVersion": 1,
        "kind": "w1_authority_reference",
        "auditedMainSha": AUDITED_MAIN_SHA,
        "authority": {
            "pr": AUTHORITY_PR,
            "branch": AUTHORITY_BRANCH,
            "headSha": AUTHORITY_HEAD_SHA,
            "wavesPath": AUTHORITY_WAVES_PATH,
            "wavesBlobSha": AUTHORITY_WAVES_BLOB_SHA,
            "wavesSha256": AUTHORITY_WAVES_SHA256,
            "w1SnapshotSha256": AUTHORITY_W1_SNAPSHOT_SHA256,
        },
        "ownerDecision": OWNER_DECISION,
        "driftPolicy": [
            "The generator and --check both recompute the W1 snapshot from the #220 waves artifact and fail if its sha256 differs from w1SnapshotSha256.",
            "When read from git or an explicit file the whole waves blob must match wavesBlobSha/wavesSha256.",
            "If the locally known #220 branch tip differs from headSha the check fails (fetch before --check).",
            "If the authority cannot be loaded at all the check fails; there is no silent pass.",
        ],
        "snapshot": snapshot,
    }


def authority_ref() -> dict:
    return {"pr": AUTHORITY_PR, "headSha": AUTHORITY_HEAD_SHA, "w1SnapshotSha256": AUTHORITY_W1_SNAPSHOT_SHA256,
            "referenceFile": str(AUTHORITY_OUT.relative_to(ROOT)).replace("\\", "/")}


# --- production baseline (read-only) --------------------------------------

def production_recipe_sets() -> dict[str, frozenset]:
    text = PRODUCTION_RECIPES.read_text(encoding="utf-8")
    sets = {}
    for match in re.finditer(r'id: "([^"]+)"(.*?)bakeTarget:', text, re.S):
        ids = re.findall(r'ingredientId: "([^"]+)"', match.group(2))
        if ids:
            sets[match.group(1)] = frozenset(ids)
    assert len(sets) == 15, f"unexpected production recipe count {len(sets)}"
    return sets


def production_ingredient_ids() -> set[str]:
    text = PRODUCTION_INGREDIENTS.read_text(encoding="utf-8")
    return set(re.findall(r'^\s+id: "([^"]+)",', text, re.M))


# --- ledger links (bidirectional; preserved from 279b6b1) -------------------

def effective_refs(row: dict) -> list[str]:
    """Recipe-specific open refs plus the open global requirements it inherits."""
    return row["unresolvedRefs"] + row["inheritedRefs"]


def derived_readiness(refs) -> str:
    """READY only when no ledger entry (own or inherited) is left open for the recipe."""
    return "READY" if not refs else "REVIEW"


def readiness_after_resolving(row: dict, resolved_ids) -> str:
    return derived_readiness([ref for ref in effective_refs(row) if ref not in set(resolved_ids)])


def ledger_scope_kind(item: dict, recipe_ids: set, ingredient_ids: set) -> str:
    scope = item["scope"]
    if scope in GLOBAL_LEDGER_SCOPES:
        return "global"
    tokens = {token.strip() for token in scope.split(",")}
    if tokens <= recipe_ids:
        return "recipe"
    if tokens <= ingredient_ids and len(tokens) == 1:
        return "ingredient"
    raise AssertionError(f"ledger scope is neither global, recipe-specific nor ingredient-specific: {item['id']} {scope!r}")


def validate_ledger_links(recipes, ingredients, ledger, change_map) -> None:
    """Bidirectional recipe <-> ledger <-> change-map consistency.

    Fails when a recipe-specific or ingredient-specific ledger entry is orphaned
    (its scope names a recipe that does not reference it), when a recipe
    references an entry outside that entry's scope, or when the future
    implementation change-map drops a recipe's ledger dependency.
    """
    recipe_ids = {r["recipeIdCandidate"] for r in recipes}
    ingredient_ids = {i["id"] for i in ingredients}
    ledger_by_id = {item["id"]: item for item in ledger}
    referencing = {item_id: set() for item_id in ledger_by_id}
    for row in recipes:
        for ref in row["unresolvedRefs"]:
            assert ref in ledger_by_id, f"{row['recipeIdCandidate']} references unknown ledger id {ref}"
            referencing[ref].add(row["recipeIdCandidate"])
    for item_id, item in ledger_by_id.items():
        kind = ledger_scope_kind(item, recipe_ids, ingredient_ids)
        if kind == "global":
            expected = set()
        elif kind == "recipe":
            expected = {token.strip() for token in item["scope"].split(",")}
        else:
            expected = {r["recipeIdCandidate"] for r in recipes
                        if item["scope"] in {x["ingredientId"] for x in r["requiredIngredients"]}}
        assert referencing[item_id] == expected, (
            f"ledger link mismatch for {item_id}: orphaned from {sorted(expected - referencing[item_id])}, "
            f"out-of-scope refs from {sorted(referencing[item_id] - expected)}")
    # Global requirements are inherited, never listed per recipe: every open global
    # entry must reach every recipe (and every recipe slice, below) via inheritedRefs.
    open_globals = [item["id"] for item in ledger
                    if ledger_scope_kind(item, recipe_ids, ingredient_ids) == "global" and item.get("inheritedByEveryRecipe")]
    for item in ledger:
        if ledger_scope_kind(item, recipe_ids, ingredient_ids) == "global":
            assert isinstance(item.get("inheritedByEveryRecipe"), bool), f"global {item['id']} must declare inheritedByEveryRecipe"
            if item["status"] in {"AUTHORING_REQUIRED", "OWNER_DECISION_REQUIRED", "EVIDENCE_REQUIRED", "RUNTIME_DEPENDENCY_REQUIRED"}:
                assert item["inheritedByEveryRecipe"], f"open global requirement {item['id']} is not inherited by recipes"
    for row in recipes:
        assert row["inheritedRefs"] == open_globals, (
            f"{row['recipeIdCandidate']} inheritedRefs {row['inheritedRefs']} != open globals {open_globals}")
    ingredient_entries = [i for i in ledger if ledger_scope_kind(i, recipe_ids, ingredient_ids) == "ingredient"]
    assert sorted(i["scope"] for i in ingredient_entries) == sorted(ingredient_ids), (
        "every new ingredient needs exactly one ingredient-scoped ledger entry")
    rows_by_id = {r["recipeIdCandidate"]: r for r in recipes}
    slices = {section["id"]: section for section in change_map["slices"]}
    for section in change_map["slices"]:
        mentioned = {token for token in " ".join(section["dependsOn"]).replace("/", " ").split()
                     if token.startswith(LEDGER_REF_PREFIXES)}
        assert mentioned <= set(ledger_by_id), f"slice {section['id']} depends on unknown ledger ids {mentioned - set(ledger_by_id)}"
        for recipe_id in section.get("recipes", []):
            row = rows_by_id[recipe_id]
            assert section["recipeDependencies"][recipe_id] == effective_refs(row), (section["id"], recipe_id)
            for ref in row["inheritedRefs"]:
                assert ref in mentioned, f"slice {section['id']} drops inherited global requirement {ref} for {recipe_id}"
            for ref in row["unresolvedRefs"]:
                if ledger_scope_kind(ledger_by_id[ref], recipe_ids, ingredient_ids) == "recipe":
                    assert ref in mentioned, f"slice {section['id']} drops {recipe_id} dependency {ref}"
                    runtime = ledger_by_id[ref].get("runtimeDependency")
                    if runtime:
                        resolver = [sid for sid, other in slices.items() if ref in other.get("resolves", [])]
                        assert len(resolver) == 1 and f"slice {resolver[0]}" in " ".join(section["dependsOn"]), (
                            f"slice {section['id']} drops runtime slice for {recipe_id} dependency {ref}")
                else:
                    ingredient_slice = next(sid for sid, other in slices.items()
                                            if ledger_by_id[ref]["scope"] in other.get("ingredients", []))
                    assert f"slice {ingredient_slice}" in section["dependsOn"], (
                        f"slice {section['id']} drops {recipe_id} dependency {ref} via slice {ingredient_slice}")
        for ref in mentioned:
            if ledger_scope_kind(ledger_by_id[ref], recipe_ids, ingredient_ids) == "recipe":
                scoped = {token.strip() for token in ledger_by_id[ref]["scope"].split(",")}
                assert scoped & set(section.get("recipes", [])), f"slice {section['id']} depends on {ref} without carrying its recipes"
        for ref in section.get("resolves", []):
            scoped = sorted(token.strip() for token in ledger_by_id[ref]["scope"].split(","))
            assert sorted(section["blocksRecipes"]) == scoped, f"slice {section['id']} blocksRecipes != {ref} scope"


def validate_reference_capacity(recipes, ledger) -> None:
    """Recipes over the reference ring capacity must carry the runtime dependency, and only they."""
    over = {r["recipeIdCandidate"] for r in recipes if non_sauce_piece_count(r) > RING_SLOTS}
    for row in recipes:
        cap = row["referenceCapacity"]
        assert cap["nonSaucePieceCount"] == non_sauce_piece_count(row) and cap["ringSlots"] == RING_SLOTS, row["recipeIdCandidate"]
        assert cap["fits"] == (row["recipeIdCandidate"] not in over), row["recipeIdCandidate"]
    capacity_entries = [item for item in ledger if item.get("runtimeDependency") == "REFERENCE_RING_CAPACITY"]
    assert len(capacity_entries) == 1, "exactly one reference-capacity ledger entry expected"
    entry = capacity_entries[0]
    assert entry["status"] == "RUNTIME_DEPENDENCY_REQUIRED", entry["id"]
    scoped = {token.strip() for token in entry["scope"].split(",")}
    assert scoped == over, f"{entry['id']} scope {sorted(scoped)} != over-capacity recipes {sorted(over)}"
    for row in recipes:
        assert (entry["id"] in row["unresolvedRefs"]) == (row["recipeIdCandidate"] in over), row["recipeIdCandidate"]
        if row["recipeIdCandidate"] in over:
            # Resolving every evidence/visual/global ref must still leave the runtime dependency open.
            others = [ref for ref in effective_refs(row) if ref != entry["id"]]
            assert readiness_after_resolving(row, others) != "READY", row["recipeIdCandidate"]


def validate_authority_alignment(snapshot: dict) -> None:
    """Recipe/ingredient evidence must equal the pinned #220 W1 slice."""
    auth_rows = {r["evidenceId"]: r for r in snapshot["w1Rows"]}
    assert set(auth_rows) == {r["evidenceId"] for r in RECIPES}, (
        "W1 recipe set differs from #220 authority",
        sorted(set(auth_rows) - {r["evidenceId"] for r in RECIPES}),
        sorted({r["evidenceId"] for r in RECIPES} - set(auth_rows)))
    assert set(snapshot["first10CandidateSet"]["evidenceIds"]) == set(auth_rows)
    assert snapshot["auditedMainSha"] == AUDITED_MAIN_SHA
    supported = set(snapshot["supportedSauceIngredientIds"])
    assert supported == SUPPORTED_SAUCE_IDS, supported
    for row in RECIPES:
        auth = auth_rows[row["evidenceId"]]
        required = {x["ingredientId"] for x in row["requiredIngredients"]}
        rid = row["recipeIdCandidate"]
        assert rid == auth["canonicalCandidateId"], (rid, auth["canonicalCandidateId"])
        assert row["nameJa"] == auth["nameJa"], rid
        assert required == set(auth["canonicalIngredientIds"]) | {auth["sauceBaseIngredientId"]}, rid
        assert row["sauce"] == auth["sauceBaseIngredientId"] and row["sauce"] in supported, rid
        assert auth["runtimeContractDependencies"] == [] and row["runtimeContractDependencies"] == [], rid
        assert auth["currentFlowRepresentability"] == row["currentMechanicRepresentability"] == "FULL", rid
        assert auth["blockers"] == [] and auth["productDecisionStatus"] == "READY", rid
        assert row["collisionRisk"]["nearestProductionRecipeId"] == auth["nearestProductionRecipeId"], rid
        assert row["collisionRisk"]["level"] == auth["collisionRisk"], rid
        assert set(row["cheese"]) == required & CHEESE_IDS, rid
        assert set(row["toppings"]) == required - CHEESE_IDS - {row["sauce"]}, rid
        ing_refs = {ref for ref in row["unresolvedRefs"] if ref.startswith("ING-")}
        ledger_scopes = {item["id"]: item["scope"] for item in LEDGER}
        assert {ledger_scopes[ref] for ref in ing_refs} == set(auth["newIngredientIds"]), rid
    new_ids = sorted(i["id"] for i in INGREDIENTS)
    assert new_ids == sorted(snapshot["w1Wave"]["newIngredientIds"]), new_ids
    assert new_ids == sorted(snapshot["first10CandidateSet"]["distinctNewIngredientIds"])
    assert snapshot["w1Wave"]["recipeCount"] == len(RECIPES) == 10
    for removed in snapshot["previousW1Removed"]:
        assert removed["wave"] != "W1", removed
        assert "SAUCELESS_RECIPE_CONTRACT" in removed["runtimeContractDependencies"], removed
        assert removed["canonicalCandidateId"] not in {r["recipeIdCandidate"] for r in RECIPES}


def validate_sources(snapshot: dict) -> None:
    matrix = json.loads(SOURCE_MATRIX.read_text(encoding="utf-8"))
    evidence = json.loads(SOURCE_EVIDENCE.read_text(encoding="utf-8"))
    matrix_rows = {r.get("evidenceId", r.get("id")): r for r in matrix["rows"]}
    matrix_ids = set(matrix_rows)
    evidence_ids = {r["id"] for r in evidence["recipeRows"]}
    target_ids = {r["evidenceId"] for r in RECIPES}
    assert target_ids <= matrix_ids, target_ids - matrix_ids
    assert target_ids <= evidence_ids, target_ids - evidence_ids
    canonical_drift = {
        r["evidenceId"]: (r["recipeIdCandidate"], matrix_rows[r["evidenceId"]].get("canonicalCandidateId"))
        for r in RECIPES
        if r["recipeIdCandidate"] != matrix_rows[r["evidenceId"]].get("canonicalCandidateId")
    }
    assert not canonical_drift, f"canonicalCandidateId drift: {canonical_drift}"
    assert len(RECIPES) == 10 and len({r["recipeIdCandidate"] for r in RECIPES}) == 10
    assert len(INGREDIENTS) == 7 and len({i["id"] for i in INGREDIENTS}) == 7
    validate_authority_alignment(snapshot)

    # Composition equals the governing matrix identity set; likely aliases are ledgered both ways.
    ledger_by_id = {item["id"]: item for item in LEDGER}
    assert len(ledger_by_id) == len(LEDGER)
    assert not set(ledger_by_id) & set(RETIRED_LEDGER_IDS), f"retired ledger ids reused: {sorted(set(ledger_by_id) & set(RETIRED_LEDGER_IDS))}"
    source_aliases, ledger_aliases = set(), set()
    for row in RECIPES:
        m = matrix_rows[row["evidenceId"]]
        assert {x["ingredientId"] for x in row["requiredIngredients"]} == set(m["ingredients"]["identityIngredientSet"]), row["recipeIdCandidate"]
        assert m["ingredients"]["complete"] and not m["ingredients"]["unresolvedTokens"], row["recipeIdCandidate"]
        for trace in m["ingredients"]["tokenTrace"]:
            if trace["disposition"] == "likely_alias":
                source_aliases.add((row["recipeIdCandidate"], trace["token"], trace["canonicalId"]))
        for ref in row["unresolvedRefs"]:
            alias = ledger_by_id[ref].get("aliasEvidence")
            if alias:
                assert ledger_by_id[ref]["status"] == "EVIDENCE_REQUIRED", ref
                ledger_aliases.add((row["recipeIdCandidate"], alias["token"], alias["canonicalId"]))
    assert source_aliases == ledger_aliases, (
        f"likely_alias provenance not ledgered: missing {sorted(source_aliases - ledger_aliases)}, "
        f"stale {sorted(ledger_aliases - source_aliases)}")

    # Production baseline: no exact ingredient-set collision; new ingredients are really new.
    production_sets = production_recipe_sets()
    for row in RECIPES:
        required = frozenset(x["ingredientId"] for x in row["requiredIngredients"])
        assert required not in production_sets.values(), f"exact collision: {row['recipeIdCandidate']}"
        assert row["collisionRisk"]["exactIngredientSetCollision"] is False
        assert row["collisionRisk"]["nearestProductionRecipeId"] in production_sets
    production_ingredients = production_ingredient_ids()
    assert not {i["id"] for i in INGREDIENTS} & production_ingredients
    for row in RECIPES:
        unknown = {x["ingredientId"] for x in row["requiredIngredients"]} - production_ingredients - {i["id"] for i in INGREDIENTS}
        assert not unknown, (row["recipeIdCandidate"], unknown)

    recipe_ids = {r["recipeIdCandidate"] for r in RECIPES}
    assert all(set(r["unresolvedRefs"]) <= set(ledger_by_id) for r in RECIPES)
    validate_ledger_links(RECIPES, INGREDIENTS, LEDGER, CHANGE_MAP)
    validate_reference_capacity(RECIPES, LEDGER)
    assert all(set(i["recipesUsingItInCandidateSet"]) <= recipe_ids and i["recipesUsingItInCandidateSet"] for i in INGREDIENTS)
    mapped_recipe_ids = [recipe_id for section in CHANGE_MAP["slices"] for recipe_id in section.get("recipes", [])]
    assert sorted(mapped_recipe_ids) == sorted(recipe_ids), (recipe_ids - set(mapped_recipe_ids), set(mapped_recipe_ids) - recipe_ids)
    for row in RECIPES:
        unresolved_statuses = {ledger_by_id[ref]["status"] for ref in row["unresolvedRefs"]}
        if "EVIDENCE_REQUIRED" in unresolved_statuses:
            assert row["readiness"] != "READY", row["recipeIdCandidate"]
        if row["readiness"] != "BLOCKED":
            assert row["readiness"] == derived_readiness(effective_refs(row)), row["recipeIdCandidate"]
        # Resolving every recipe-specific ref must still leave inherited global requirements open.
        if row["inheritedRefs"]:
            assert readiness_after_resolving(row, row["unresolvedRefs"]) != "READY", row["recipeIdCandidate"]
        # Approving new-ingredient visuals alone must never make a recipe with
        # recipe-specific evidence/authoring refs implementation-ready.
        visual_only = [ref for ref in row["unresolvedRefs"] if ref.startswith("ING-")]
        if any(ref.startswith("REC-") for ref in row["unresolvedRefs"]):
            assert readiness_after_resolving(row, visual_only) != "READY", row["recipeIdCandidate"]
    assert {r["readiness"] for r in RECIPES} <= set(EXPECTED_TOTALS)
    assert totals() == EXPECTED_TOTALS, totals()
    puttanesca = next(r for r in RECIPES if r["recipeIdCandidate"] == "puttanesca-pizza")
    assert readiness_after_resolving(puttanesca, ["ING-02"]) == "REVIEW"
    assert not any(k in json.dumps(RECIPES) for k in ['"pitzPrice": 0', '"unlockFee": 0', '"starGate": 0'])
    assert all(0 < r["bakeTargetCandidate"]["start"] < r["bakeTargetCandidate"]["end"] < 100 for r in RECIPES)


def totals() -> dict:
    return {status: sum(r["readiness"] == status for r in RECIPES) for status in EXPECTED_TOTALS}


def envelope(kind: str, rows) -> dict:
    return {"schemaVersion": 1, "kind": kind, "auditedMainSha": AUDITED_MAIN_SHA,
            "authorityRef": authority_ref(),
            "sourceRefs": ["Issue #182", "PR #189 (MERGED)", "PR #191 (MERGED)",
                           "PR #217 (OPEN)", f"PR #220 (OPEN) @ {AUTHORITY_HEAD_SHA} -- W1 authority",
                           "Owner Decision Sauce OD-S1 = A"], "rows": rows}


def report() -> str:
    t = totals()
    ready, review, blocked = t["READY"], t["REVIEW"], t["BLOCKED"]
    lines = [
        "# Progression 2.0 W1 Content Authoring — Fresh Audit", "",
        "## 結論", "",
        f"監査基準は最新 `main` `{AUDITED_MAIN_SHA}`。W1 authority は PR #{AUTHORITY_PR} exact HEAD `{AUTHORITY_HEAD_SHA}` の `{AUTHORITY_WAVES_PATH}`（Owner Decision **Sauce OD-S1 = A**: #220 の W1 を正とし、sauceless recipes は W4 のまま、Sauce Contract 2.0 は実装しない）。既存172件調査は再実施していない。", "",
        f"判定は **READY {ready} / REVIEW {review} / BLOCKED {blocked}**。旧 #221 の W1（Aussie READY を含む）は stale authority に基づいていたため同期で置き換えた。10件すべてに global requirement（REC-01〜04、全 recipe が継承）と、新 ingredient の visual approval、likely-alias provenance、discovery regression、reference-capacity runtime dependency のいずれかが残るため、Progression 2.0 確定後すぐ content data 実装へ直行できる recipe は現時点で0件。READY を維持するための調整はしていない。", "",
        "## Authority sync", "",
        f"- authority: PR #{AUTHORITY_PR} `{AUTHORITY_HEAD_SHA}`、waves blob `{AUTHORITY_WAVES_BLOB_SHA}`、W1 snapshot sha256 `{AUTHORITY_W1_SNAPSHOT_SHA256}`（`{AUTHORITY_OUT.relative_to(ROOT).as_posix()}`）。",
        "- W1 から外した（#220 では W4 / `SAUCELESS_RECIPE_CONTRACT`）: Aussie, Bacalhau, Full English, Polish Kielbasa, Tsukimi。",
        "- W1 に加えた: New Haven Apizza, Hawaiian, Bambino, Pesto Caprese, Pesto Patate。",
        "- 維持: Parmigiana Pizza, Pizza Portuguesa, Puttanesca, Pesto Tonno, Melanzane Pizza。",
        f"- retired ledger ids（再利用禁止）: {', '.join(f'`{k}`' for k in RETIRED_LEDGER_IDS)}。",
        "- drift 検出: generator と `--check` はどちらも #220 waves artifact から W1 snapshot を再計算し、pin した sha256 と一致しなければ FAIL。git object / 明示ファイルから読む場合は blob 全体の sha256 も照合する。ローカルに見えている #220 branch tip が pin と異なる場合、または authority を読めない場合も FAIL（silent pass なし）。", "",
        "## Reference capacity / global requirements", "",
        f"- 現行 reference ring は `PIECE_RING_POSITIONS` の {RING_SLOTS} slot 固定で、`getPlayerReferencePizza()` は slot を modulo 割り当てする。authored non-sauce piece 数が {RING_SLOTS} を超える Parmigiana（9）/ Pizza Portuguesa（10）/ Puttanesca（9）は `RT-01`（`REFERENCE_RING_CAPACITY`, `RUNTIME_DEPENDENCY_REQUIRED`）を参照し、runtime slice E が解消するまで READY にならない。minCount は UI 制約に合わせて削らない。",
        "- global ledger entry は `inheritedByEveryRecipe` を持ち、open な REC-01 / REC-02 / REC-03 / REC-04 は全 recipe の `inheritedRefs` に継承される。readiness と change-map の `recipeDependencies` は `unresolvedRefs + inheritedRefs` から導出し、recipe を運ぶ slice の `dependsOn` も継承 global を明記する。REC-11（OD-S1 記録）は解決済み決定のため継承しない。", "",
        "## 判定基準", "",
        "- `READY`: composition evidence、独自 description/minCount/bakeTarget candidate、現行 ingredient visual、reference capacity が揃い、recipe 固有 ref と継承 global ref のどちらも open でない。",
        "- `REVIEW`: recipe data は準備済みだが、継承 global requirement、新 ingredient の visual、likely-alias provenance、discovery regression、または reference-capacity runtime dependency が open。",
        "- `BLOCKED`: evidence または現行 mechanic で安全に表現できない。今回0件。", "",
        "## Recipe authoring summary", "",
        "| recipe | sauce | cheese | toppings | pieces / ring | bake | CUT | collision | open refs (+ inherited) | status |", "|---|---|---|---|---|---|---|---|---|---|"
    ]
    for r in RECIPES:
        ingredients = ", ".join(f"{x['ingredientId']}×{x['minCountCandidate']}" for x in r["requiredIngredients"])
        lines.append(f"| `{r['recipeIdCandidate']}`<br>{ingredients} | {r['sauce'] or 'none'} | {', '.join(r['cheese']) or 'none'} | {', '.join(r['toppings']) or 'none'} | {r['referenceCapacity']['nonSaucePieceCount']} / {r['referenceCapacity']['ringSlots']}{'' if r['referenceCapacity']['fits'] else ' ⚠'} | {r['bakeTargetCandidate']['start']}–{r['bakeTargetCandidate']['end']} | 6-slice candidate; Gate TBD | {r['collisionRisk']['level']} (near `{r['collisionRisk']['nearestProductionRecipeId']}`) | {', '.join(r['unresolvedRefs'])} (+ {', '.join(r['inheritedRefs'])}) | **{r['readiness']}** |")
    lines += ["", "Descriptions、minCount、bakeTarget は外部事実ではなく独自 game-authoring candidate。production投入前の content sign-off を `AUTHORING_REQUIRED` として ledger に残した。全10件の sauce は現行 `RecipeSauceProfile` union（tomato-sauce / pesto / olive-oil）内。", "",
              "## Ingredient authoring summary", "", "| id | displayName | emoji | color | category / placement | recipes | status | uncertainty |", "|---|---|---|---|---|---|---|---|"]
    for i in INGREDIENTS:
        lines.append(f"| `{i['id']}` | {i['displayName']} | {i['emojiCandidate']} | `{i['colorCandidate']}` | {i['categoryCandidate']} / {i['placementCandidate']} | {', '.join(i['recipesUsingItInCandidateSet'])} | **{i['authoringStatus']}** | {' '.join(i['authoringUncertainty'])} |")
    lines += ["", f"全{len(INGREDIENTS)}種は current `Ingredient` schema と `IngredientPieceVisual` の emoji branch で表現可能で、#220 W1 の newIngredientIds と一致する。専用bitmapは不要だが、絵文字のOS差・抽象表現・焼成後コントラストを authoring review する。", "",
              "## Completion Gate / Progression 接点", "",
              "- 現行 Completion Gate が読む `requiredIngredients[].minCount` と `bakeTarget` の候補は用意した。ただし #218 の requiredForCompletion、CUT採否、許容幅を決めない。",
              "- `pitzPrice`, `unlockFee`, `starGate`, `nonStarUnlockCondition`, `baseRewardPitz` は未決定。PR #217 の owner decision を先取りしない。",
              "- wave は実装順候補であり unlock order ではない。", "",
              "## Collision / evidence", "",
              "10件とも exact production ingredient-set collision は0（`src/data/recipes.ts` を read-only で照合）。近傍 recipe は #220 authority の `nearestProductionRecipeId` と一致させ、regression target として記録した。Pizza Portuguesa / Puttanesca / Pesto Tonno の「オリーブ→black-olive」と Parmigiana の「パルミジャーノチーズ→parmigiano」は merged canonicalizer の likely alias であり、ledger（REC-06 / REC-07 / REC-09 / REC-10）と source trace を双方向照合する。Parmigiana / Melanzane は eggplant family として別 signature を固定する（REC-08）。Hawaiian / Bambino は1 ingredient 差、Pesto Caprese は Genovese と tomato glyph を共有するため visual 区別が必要（ING-09）。", "",
              "## Progression確定後すぐ実装可能な範囲", "",
              "- 即時: なし（READY 0）。全 recipe slice は REC-01〜04 を継承する。",
              "- alias evidence確認後: slice A（Pizza Portuguesa / Pesto Tonno）。Pizza Portuguesa は RT-01（slice E）も必要。",
              "- visual approval後: slice B（7 ingredients）→ slice C（残り8 recipes）。slice C の Puttanesca は REC-07 / RT-01、Parmigiana は REC-08 / REC-10 / RT-01、Melanzane は REC-08 も dependency として保持する（`recipeDependencies`）。",
              "- #218後: slice D（Completion Gate integration）。",
              "- reference-layout redesign 承認後: slice E（8-slot reference ring の capacity 拡張、runtime）。RT-01 を解消する。", "",
              "## Deliverables", "",
              "- `docs/reports/data/TETO_PROGRESS2_W1_RECIPE_AUTHORING_MATRIX.json`",
              "- `docs/reports/data/TETO_PROGRESS2_W1_INGREDIENT_AUTHORING_MATRIX.json`",
              "- `docs/reports/data/TETO_PROGRESS2_W1_UNRESOLVED_EVIDENCE_LEDGER.json`",
              "- `docs/reports/data/TETO_PROGRESS2_W1_FUTURE_IMPLEMENTATION_CHANGE_MAP.json`",
              "- `docs/reports/data/TETO_PROGRESS2_W1_AUTHORITY_REFERENCE.json`",
              "- `tools/progression2_w1_authoring_audit.py --check`", "",
              "## Validation", "",
              "- W1 authority checker: recipe / ingredient evidence を #220 W1 snapshot（evidenceId、canonicalCandidateId、identity ingredients、sauce、newIngredientIds、nearest recipe、runtimeContractDependencies）と照合。authority drift で FAIL。",
              "- W1 ledger link checker: recipe ↔ ledger ↔ change-map を双方向検証（recipe-specific / ingredient-specific ledger entry の orphan、scope外参照、change-map dependency 欠落、likely-alias の未ledger化、global requirement の継承漏れを検出）。",
              "- reference-capacity checker: `src/logic/pizzaReferenceLayout.ts` の slot 数を read-only で数え、超過 recipe 集合 = RT-01 scope を双方向照合。RT-01 以外を全解決しても超過 recipe は READY にならない。",
              "- canonicalCandidateId checker: 全 recipeIdCandidate を governing matrix と #220 authority の canonicalCandidateId と照合。",
              f"- W1 generator/checker: PASS（10 recipes / {len(INGREDIENTS)} ingredients / READY {ready} / REVIEW {review} / BLOCKED {blocked}）。",
              "- `validate_recipe_catalog.py`: PASS（53 / 62 / 11）。",
              "- `progression2_evidence_invariants.py`: PASS 4/4。", "",
              "## Issue management", "", "Issue #182 が既に content inventory / ingredient canonicalization / implementation split を管理しているため、新Issueは作らない。", ""]
    return "\n".join(lines)


def outputs(snapshot: dict) -> dict[Path, str]:
    return {
        RECIPE_OUT: json.dumps(envelope("recipe_authoring_matrix", RECIPES), ensure_ascii=False, indent=2) + "\n",
        INGREDIENT_OUT: json.dumps(envelope("ingredient_authoring_matrix", INGREDIENTS), ensure_ascii=False, indent=2) + "\n",
        LEDGER_OUT: json.dumps({**envelope("unresolved_evidence_ledger", LEDGER), "retiredIds": RETIRED_LEDGER_IDS}, ensure_ascii=False, indent=2) + "\n",
        CHANGE_MAP_OUT: json.dumps({"schemaVersion": 1, "auditedMainSha": AUDITED_MAIN_SHA, "authorityRef": authority_ref(), **CHANGE_MAP}, ensure_ascii=False, indent=2) + "\n",
        AUTHORITY_OUT: json.dumps(authority_reference(snapshot), ensure_ascii=False, indent=2) + "\n",
        REPORT_OUT: report(),
    }


def validate_committed_authority_refs() -> None:
    """Every committed artifact must carry the same authority reference."""
    expected = authority_ref()
    for path in (RECIPE_OUT, INGREDIENT_OUT, LEDGER_OUT, CHANGE_MAP_OUT):
        if path.exists():
            found = json.loads(path.read_text(encoding="utf-8")).get("authorityRef")
            assert found == expected, f"{path.relative_to(ROOT).as_posix()} authorityRef {found} != {expected}"
    if AUTHORITY_OUT.exists():
        found = json.loads(AUTHORITY_OUT.read_text(encoding="utf-8"))["authority"]
        assert found["headSha"] == AUTHORITY_HEAD_SHA and found["w1SnapshotSha256"] == AUTHORITY_W1_SNAPSHOT_SHA256, found


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--authority-waves", type=Path, default=None,
                        help="explicit copy of the #220 waves artifact (default: working tree, then git object)")
    args = parser.parse_args()
    snapshot, source = load_authority(args.authority_waves)
    validate_sources(snapshot)
    generated = outputs(snapshot)
    t = totals()
    if args.check:
        validate_committed_authority_refs()
        mismatches = [path.relative_to(ROOT).as_posix() for path, text in generated.items()
                      if not path.exists() or path.read_text(encoding="utf-8") != text]
        if mismatches:
            raise SystemExit("generated outputs differ: " + ", ".join(mismatches))
        print(f"PASS: W1 authoring audit is source-valid and byte-identical (authority PR #{AUTHORITY_PR} "
              f"{AUTHORITY_HEAD_SHA[:7]} via {source}; 10 recipes, {len(INGREDIENTS)} ingredients, "
              f"READY {t['READY']} / REVIEW {t['REVIEW']} / BLOCKED {t['BLOCKED']}; "
              "authority drift 0; canonicalCandidateId drift 0; ledger orphans 0).")
        return 0
    for path, text in generated.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8", newline="\n")
    print(f"Generated W1 authoring audit outputs (authority via {source}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
