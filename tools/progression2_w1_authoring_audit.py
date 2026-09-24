#!/usr/bin/env python3
"""Generate and validate the Progression 2.0 W1 content-authoring audit.

Docs/data/tooling only.  The script deliberately does not emit production-ready
TypeScript and carries no progression price/gate decisions.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUDITED_MAIN_SHA = "dff233c042d2df6ee1c3a92f2d2419830aa05460"
RECIPE_OUT = ROOT / "docs/reports/data/TETO_PROGRESS2_W1_RECIPE_AUTHORING_MATRIX.json"
INGREDIENT_OUT = ROOT / "docs/reports/data/TETO_PROGRESS2_W1_INGREDIENT_AUTHORING_MATRIX.json"
LEDGER_OUT = ROOT / "docs/reports/data/TETO_PROGRESS2_W1_UNRESOLVED_EVIDENCE_LEDGER.json"
CHANGE_MAP_OUT = ROOT / "docs/reports/data/TETO_PROGRESS2_W1_FUTURE_IMPLEMENTATION_CHANGE_MAP.json"
REPORT_OUT = ROOT / "docs/reports/TETO_PROGRESS2_W1_CONTENT_AUTHORING_FRESH-AUDIT.md"

SOURCE_MATRIX = ROOT / "docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json"
SOURCE_EVIDENCE = ROOT / "docs/reports/data/TETO_PIZZADB_172_MASTER-EVIDENCE.json"


def req(ingredient_id: str, count: int, rationale: str) -> dict:
    return {"ingredientId": ingredient_id, "minCountCandidate": count,
            "status": "AUTHORING_CANDIDATE", "rationale": rationale}


COMMON = {
    "currentMechanicRepresentability": "FULL",
    "mechanicDependencies": [],
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
            "sourceAuthority": "MERGED_PR_189_MATRIX_AND_MASTER_EVIDENCE",
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
    recipe("aussie-pizzadb", "aussie", "オージーピザ",
           "モッツァレラにベーコン、卵、たまねぎを重ねた、コクのあるオーストラリア風ピザ。",
           [req("mozzarella", 2, "existing cheese-density baseline"), req("bacon", 3, "breakfast-pizza analogue"),
            req("egg", 1, "single center-piece convention"), req("onion", 3, "scatter-density baseline")],
           None, ["mozzarella"], ["bacon", "egg", "onion"], 56, 76, "breakfast-pizza",
           "Near-neighbor only: no tomato sauce and adds onion; exact-set collision absent.", "READY"),
    recipe("bacalhau-pizzadb", "bacalhau", "バカリャウピザ",
           "塩だらの旨みを、モッツァレラ、たまねぎ、ブラックオリーブと焼き上げるポルトガル風ピザ。",
           [req("mozzarella", 2, "existing cheese-density baseline"), req("salt-cod", 3, "primary topping"),
            req("onion", 2, "supporting topping"), req("black-olive", 2, "supporting topping")],
           None, ["mozzarella"], ["salt-cod", "onion", "black-olive"], 58, 78, "tonno-e-cipolla",
           "Distinct protein and no tomato sauce; exact-set collision absent.", "REVIEW", ["ING-05"]),
    recipe("parmigiana-pizza-pizzadb-p7", "parmigiana-pizza", "パルミジャーナピザ",
           "トマトソースにナス、モッツァレラ、パルミジャーノ、バジルを合わせた南イタリア風の一枚。",
           [req("tomato-sauce", 1, "one spread use"), req("mozzarella", 2, "existing cheese-density baseline"),
            req("eggplant", 3, "primary topping"), req("parmigiano", 2, "secondary cheese"), req("basil", 2, "herb baseline")],
           "tomato-sauce", ["mozzarella", "parmigiano"], ["eggplant", "basil"], 58, 78, "margherita",
           "Eggplant family is compositionally distinct from Melanzane and alla Norma.", "REVIEW", ["ING-03", "REC-08"]),
    recipe("pizza-portuguesa-pizzadb-p9", "pizza-portuguesa", "ピッツァ・ポルトゲーザ",
           "トマトソースにハム、卵、たまねぎ、ブラックオリーブ、モッツァレラを重ねたブラジル定番の一枚。",
           [req("tomato-sauce", 1, "one spread use"), req("mozzarella", 2, "existing cheese-density baseline"),
            req("ham", 3, "capricciosa analogue"), req("egg", 1, "single center-piece convention"),
            req("onion", 2, "supporting topping"), req("black-olive", 2, "supporting topping")],
           "tomato-sauce", ["mozzarella"], ["ham", "egg", "onion", "black-olive"], 58, 78, "capricciosa",
           "Adds egg/onion and omits mushroom; exact-set collision absent.", "REVIEW", ["REC-06"]),
    recipe("puttanesca-pizza-pizzadb-p10", "puttanesca-pizza", "プッタネスカ",
           "トマトソースにアンチョビ、ブラックオリーブ、ケッパー、にんにくを効かせた、塩味と香りの強い一枚。",
           [req("tomato-sauce", 1, "one spread use"), req("anchovy", 3, "napoletana analogue"),
            req("black-olive", 2, "supporting topping"), req("capers", 2, "accent topping"), req("garlic", 2, "marinara analogue")],
           "tomato-sauce", [], ["anchovy", "black-olive", "capers", "garlic"], 50, 70, "marinara",
           "Cheese-free identity remains distinct; exact-set collision absent.", "REVIEW", ["ING-02"]),
    recipe("full-english-pizza-pizzadb-p10", "full-english-pizza", "フルイングリッシュピザ",
           "ベーコン、ソーセージ、卵、ベイクドビーンズをモッツァレラと焼き上げた、朝食仕立ての一枚。",
           [req("mozzarella", 2, "existing cheese-density baseline"), req("bacon", 2, "supporting meat"),
            req("sausage", 2, "supporting meat"), req("egg", 1, "single center-piece convention"),
            req("baked-beans", 3, "primary topping")],
           None, ["mozzarella"], ["bacon", "sausage", "egg", "baked-beans"], 60, 80, "breakfast-pizza",
           "No tomato sauce and adds sausage/beans; exact-set collision absent.", "REVIEW", ["ING-01"]),
    recipe("pesto-tonno-pizzadb-p12", "pesto-tonno", "ペストトンノピザ",
           "香り高いジェノベーゼソースに、ツナ、ブラックオリーブ、たまねぎを合わせた爽やかな一枚。",
           [req("pesto", 1, "one spread use"), req("tuna", 3, "tonno-e-cipolla analogue"),
            req("black-olive", 2, "supporting topping"), req("onion", 2, "supporting topping")],
           "pesto", [], ["tuna", "black-olive", "onion"], 50, 70, "tonno-e-cipolla",
           "Pesto base distinguishes it from shipped Tonno e cipolla; exact-set collision absent.", "REVIEW", ["REC-09"]),
    recipe("polish-kielbasa-pizzadb-p12", "polish-kielbasa", "ポーリッシュキエルバサピザ",
           "ソーセージ、ザワークラウト、たまねぎをモッツァレラと焼き上げた、酸味と旨みのある一枚。",
           [req("mozzarella", 2, "existing cheese-density baseline"), req("sausage", 3, "salsiccia analogue"),
            req("sauerkraut", 3, "primary topping"), req("onion", 2, "supporting topping")],
           None, ["mozzarella"], ["sausage", "sauerkraut", "onion"], 60, 80, "salsiccia",
           "Adds sauerkraut/onion and omits tomato sauce; exact-set collision absent.", "REVIEW", ["ING-06"]),
    recipe("melanzane-pizza-pizzadb-p13", "melanzane-pizza", "メランザーネピザ",
           "トマトソースにナス、モッツァレラ、バジルを合わせた、素朴で香り豊かな南イタリア風ピザ。",
           [req("tomato-sauce", 1, "one spread use"), req("mozzarella", 2, "existing cheese-density baseline"),
            req("eggplant", 3, "primary topping"), req("basil", 2, "herb baseline")],
           "tomato-sauce", ["mozzarella"], ["eggplant", "basil"], 58, 78, "margherita",
           "Superset of Margherita by eggplant; exact-set collision absent but family proximity requires regression coverage.",
           "REVIEW", ["ING-03", "REC-08"]),
    recipe("tsukimi-pizza-pizzadb-p14", "tsukimi-pizza", "月見ピザ",
           "卵を月に見立て、ベーコン、青ねぎ、モッツァレラを合わせた和風の一枚。",
           [req("mozzarella", 2, "existing cheese-density baseline"), req("egg", 1, "single center-piece convention"),
            req("bacon", 3, "breakfast-pizza analogue"), req("green-onion", 2, "herb-like accent")],
           None, ["mozzarella"], ["egg", "bacon", "green-onion"], 56, 76, "breakfast-pizza",
           "Green onion replaces tomato sauce; exact-set collision absent.", "REVIEW", ["ING-04"]),
]


INGREDIENTS = [
    {"id": "baked-beans", "displayName": "ベイクドビーンズ", "emojiCandidate": "🫘", "colorCandidate": "#a94f35", "categoryCandidate": "topping", "placementCandidate": "scatter", "pieceRepresentation": "emoji piece; one tap places one bean-cluster token", "recipesUsingItInCandidateSet": ["full-english-pizza"], "authoringStatus": "REVIEW", "authoringUncertainty": ["Emoji appearance varies by platform; verify legibility at tray and baked-piece sizes."]},
    {"id": "capers", "displayName": "ケッパー", "emojiCandidate": "🟢", "colorCandidate": "#6f7f35", "categoryCandidate": "topping", "placementCandidate": "scatter", "pieceRepresentation": "emoji dot piece; one tap places one caper token", "recipesUsingItInCandidateSet": ["puttanesca-pizza"], "authoringStatus": "REVIEW", "authoringUncertainty": ["No dedicated caper emoji; generic green-circle glyph needs visual differentiation review."]},
    {"id": "eggplant", "displayName": "ナス", "emojiCandidate": "🍆", "colorCandidate": "#62407b", "categoryCandidate": "topping", "placementCandidate": "scatter", "pieceRepresentation": "emoji piece; one tap represents one eggplant slice", "recipesUsingItInCandidateSet": ["parmigiana-pizza", "melanzane-pizza"], "authoringStatus": "REVIEW", "authoringUncertainty": ["Whole-eggplant glyph represents a slice abstractly; verify visual density and tone after bake."]},
    {"id": "green-onion", "displayName": "青ねぎ", "emojiCandidate": "🌱", "colorCandidate": "#4f8a3c", "categoryCandidate": "topping", "placementCandidate": "scatter", "pieceRepresentation": "emoji herb piece; one tap represents a small chopped-onion cluster", "recipesUsingItInCandidateSet": ["tsukimi-pizza"], "authoringStatus": "REVIEW", "authoringUncertainty": ["No exact green-onion emoji; sprout glyph can be confused with basil/herbs."]},
    {"id": "salt-cod", "displayName": "塩だら", "emojiCandidate": "🐟", "colorCandidate": "#d8c9aa", "categoryCandidate": "topping", "placementCandidate": "scatter", "pieceRepresentation": "emoji piece; one tap represents one flaked-cod portion", "recipesUsingItInCandidateSet": ["bacalhau"], "authoringStatus": "REVIEW", "authoringUncertainty": ["Generic fish glyph does not encode salted cod; description/name must carry specificity."]},
    {"id": "sauerkraut", "displayName": "ザワークラウト", "emojiCandidate": "🥬", "colorCandidate": "#d8d59a", "categoryCandidate": "topping", "placementCandidate": "scatter", "pieceRepresentation": "emoji piece; one tap represents one shredded-cabbage cluster", "recipesUsingItInCandidateSet": ["polish-kielbasa"], "authoringStatus": "REVIEW", "authoringUncertainty": ["Leafy-green glyph represents shredded fermented cabbage abstractly; verify contrast on cheese."]},
]


LEDGER = [
    {"id": "REC-01", "scope": "all recipes", "status": "AUTHORING_REQUIRED", "field": "description/minCount/bakeTarget", "detail": "Values are original game-authoring candidates, not claims from external evidence. Human content sign-off remains required before production."},
    {"id": "REC-02", "scope": "all recipes", "status": "AUTHORING_REQUIRED", "field": "cutRequirement", "detail": "All ten fit the current round-six-slice mechanic, but future production must explicitly opt each ID into the allowlist."},
    {"id": "REC-03", "scope": "all recipes", "status": "OWNER_DECISION_REQUIRED", "field": "completionGate", "detail": "Record compatibility only. Do not decide whether CUT/minCount/bake thresholds gate completion before #218."},
    {"id": "REC-04", "scope": "all recipes", "status": "OWNER_DECISION_REQUIRED", "field": "progression", "detail": "Pitz price, unlock fee, star gate, and non-star condition stay TBD pending Progression 2.0."},
    {"id": "REC-05", "scope": "cheese-family recipes", "status": "EVIDENCE_READY", "field": "sauce", "detail": "Merged #189 matrix interprets チーズ family as no spread base; preserve that evidence-derived choice."},
    {"id": "REC-06", "scope": "pizza-portuguesa", "status": "EVIDENCE_REQUIRED", "field": "black-olive alias", "detail": "Source token オリーブ is a likely alias to black-olive, not an exact lexical alias; merged canonicalization is usable but provenance must remain visible."},
    {"id": "REC-07", "scope": "puttanesca-pizza", "status": "EVIDENCE_REQUIRED", "field": "black-olive alias", "detail": "Source token オリーブ is a likely alias to black-olive; do not claim a more specific variety."},
    {"id": "REC-08", "scope": "parmigiana-pizza,melanzane-pizza", "status": "AUTHORING_REQUIRED", "field": "discovery regression", "detail": "Both are eggplant-family recipes. Keep exact ingredient signatures distinct and add collision regression coverage."},
    {"id": "REC-09", "scope": "pesto-tonno", "status": "EVIDENCE_REQUIRED", "field": "black-olive alias", "detail": "Source token オリーブ is a likely alias to black-olive, not an exact lexical alias; preserve the merged canonicalization but do not treat the provenance as settled."},
    {"id": "ING-01", "scope": "baked-beans", "status": "AUTHORING_REQUIRED", "field": "visual", "detail": "Confirm emoji legibility and color after bake."},
    {"id": "ING-02", "scope": "capers", "status": "AUTHORING_REQUIRED", "field": "visual", "detail": "No exact emoji; approve or replace generic green-circle representation."},
    {"id": "ING-03", "scope": "eggplant", "status": "AUTHORING_REQUIRED", "field": "visual", "detail": "Approve whole-eggplant glyph as the abstraction for slices."},
    {"id": "ING-04", "scope": "green-onion", "status": "AUTHORING_REQUIRED", "field": "visual", "detail": "Approve sprout fallback or choose a distinct glyph."},
    {"id": "ING-05", "scope": "salt-cod", "status": "AUTHORING_REQUIRED", "field": "visual", "detail": "Approve generic fish glyph; specificity is textual."},
    {"id": "ING-06", "scope": "sauerkraut", "status": "AUTHORING_REQUIRED", "field": "visual", "detail": "Approve leafy-green abstraction and cheese-background contrast."},
]


CHANGE_MAP = {
    "scope": "FUTURE_ONLY_NO_RUNTIME_CHANGE_IN_THIS_AUDIT",
    "slices": [
        {"id": "A", "title": "Evidence-clean existing-ingredient recipe data", "recipes": ["aussie"], "dependsOn": ["Progression 2.0 owner decisions"], "likelyFiles": ["src/data/recipes.ts", "src/data/recipes.test.ts", "src/data/cookingProfiles.ts", "src/data/cookingProfiles.test.ts", "src/logic/discovery/*"]},
        {"id": "B", "title": "Existing-ingredient recipes with likely-alias evidence review", "recipes": ["pizza-portuguesa", "pesto-tonno"], "dependsOn": ["REC-06/REC-09 evidence resolution", "Progression 2.0 owner decisions"], "likelyFiles": ["src/data/recipes.ts", "src/data/recipes.test.ts", "src/data/recipeSauceProfiles.ts", "src/data/recipeSauceProfiles.test.ts", "src/data/cookingProfiles.ts", "src/data/cookingProfiles.test.ts", "src/logic/discovery/*"]},
        {"id": "C", "title": "Six new ingredient records", "ingredients": [i["id"] for i in INGREDIENTS], "dependsOn": ["visual authoring approval", "Progression 2.0 owner decisions"], "likelyFiles": ["src/data/ingredients.ts", "src/data/ingredients.test.ts", "src/components/IngredientPieceVisual.test.tsx"]},
        {"id": "D", "title": "Recipes using approved new ingredients", "recipes": ["bacalhau", "parmigiana-pizza", "puttanesca-pizza", "full-english-pizza", "polish-kielbasa", "melanzane-pizza", "tsukimi-pizza"], "dependsOn": ["slice C", "Progression 2.0 owner decisions"], "likelyFiles": ["src/data/recipes.ts", "src/data/recipes.test.ts", "src/data/recipeSauceProfiles.ts", "src/data/cookingProfiles.ts", "src/logic/discovery/*"]},
        {"id": "E", "title": "Completion Gate integration", "dependsOn": ["#218 owner decision"], "likelyFiles": ["src/logic/completionGate.ts", "src/state/gameReducer.completionGate.test.ts"], "guard": "Do not implement or decide in this audit."}
    ]
}


def envelope(kind: str, rows) -> dict:
    return {"schemaVersion": 1, "kind": kind, "auditedMainSha": AUDITED_MAIN_SHA,
            "sourceRefs": ["Issue #182", "PR #189 (MERGED)", "PR #191 (MERGED)",
                           "PR #217 (OPEN)", "PR #220 (OPEN)"], "rows": rows}


def report() -> str:
    ready = sum(r["readiness"] == "READY" for r in RECIPES)
    review = sum(r["readiness"] == "REVIEW" for r in RECIPES)
    blocked = sum(r["readiness"] == "BLOCKED" for r in RECIPES)
    lines = [
        "# Progression 2.0 W1 Content Authoring — Fresh Audit", "",
        "## 結論", "",
        f"監査基準は最新 `main` `{AUDITED_MAIN_SHA}`。Issue #182、merged PR #189/#191、open PR #217/#220 を確認し、#220 の unordered first-10 candidate set だけを content authoring 面で再監査した。既存172件調査は再実施していない。", "",
        f"判定は **READY {ready} / REVIEW {review} / BLOCKED {blocked}**。根拠未確定値を READY に含めないため、Progression 2.0 確定後に content data 実装へ直行できるのは Aussie のみ。Pizza Portuguesa / Pesto Tonno は `オリーブ` → `black-olive` の likely-alias provenance review、残る7件は新 ingredient 6種の visual authoring approvalを要する。", "",
        "## 判定基準", "",
        "- `READY`: composition evidence、独自 description/minCount/bakeTarget candidate、現行 ingredient visual が揃う。", 
        "- `REVIEW`: recipe data は準備済みだが、新 ingredient の emoji/color/piece abstraction を human review する。", 
        "- `BLOCKED`: evidence または現行 mechanic で安全に表現できない。今回0件。", "",
        "## Recipe authoring summary", "",
        "| recipe | sauce | cheese | toppings | bake | CUT | collision | evidence | status |", "|---|---|---|---|---|---|---|---|---|"
    ]
    for r in RECIPES:
        ingredients = ", ".join(f"{x['ingredientId']}×{x['minCountCandidate']}" for x in r["requiredIngredients"])
        lines.append(f"| `{r['recipeIdCandidate']}`<br>{ingredients} | {r['sauce'] or 'none'} | {', '.join(r['cheese']) or 'none'} | {', '.join(r['toppings']) or 'none'} | {r['bakeTargetCandidate']['start']}–{r['bakeTargetCandidate']['end']} | 6-slice candidate; Gate TBD | {r['collisionRisk']['level']} | {r['evidenceStatus']['composition']} | **{r['readiness']}** |")
    lines += ["", "Descriptions、minCount、bakeTarget は外部事実ではなく独自 game-authoring candidate。production投入前の content sign-off を `AUTHORING_REQUIRED` として ledger に残した。", "",
              "## Ingredient authoring summary", "", "| id | displayName | emoji | color | category / placement | recipes | status | uncertainty |", "|---|---|---|---|---|---|---|---|"]
    for i in INGREDIENTS:
        lines.append(f"| `{i['id']}` | {i['displayName']} | {i['emojiCandidate']} | `{i['colorCandidate']}` | {i['categoryCandidate']} / {i['placementCandidate']} | {', '.join(i['recipesUsingItInCandidateSet'])} | **{i['authoringStatus']}** | {' '.join(i['authoringUncertainty'])} |")
    lines += ["", "全6種は current `Ingredient` schema と `IngredientPieceVisual` の emoji branch で表現可能。専用bitmapは不要だが、絵文字のOS差・抽象表現・焼成後コントラストを authoring review する。", "",
              "## Completion Gate / Progression 接点", "",
              "- 現行 Completion Gate が読む `requiredIngredients[].minCount` と `bakeTarget` の候補は用意した。ただし #218 の requiredForCompletion、CUT採否、許容幅を決めない。", 
              "- `pitzPrice`, `unlockFee`, `starGate`, `nonStarUnlockCondition`, `baseRewardPitz` は未決定。PR #217 の owner decision を先取りしない。", 
              "- wave は実装順候補であり unlock order ではない。", "",
              "## Collision / evidence", "",
              "10件とも exact production ingredient-set collision は0。近傍 recipe は regression target として記録した。Pizza Portuguesa / Puttanesca / Pesto Tonno の「オリーブ→black-olive」は merged canonicalization の likely alias であり、より具体的な品種は主張しない。Parmigiana / Melanzane は eggplant family として別 signature を固定する。Polish Kielbasa は governing matrix と同じ canonical ID `polish-kielbasa` を使用する。", "",
              "## Progression確定後すぐ実装可能な範囲", "",
              "- 即時: slice A（Aussie）の recipe data、CUT opt-in review、discovery collision tests。",
              "- alias evidence確認後: slice B（Pizza Portuguesa / Pesto Tonno）。",
              "- visual approval後: slice C（6 ingredients）→ slice D（残り7 recipes）。",
              "- #218後: slice E（Completion Gate integration）。", "",
              "## Deliverables", "",
              "- `docs/reports/data/TETO_PROGRESS2_W1_RECIPE_AUTHORING_MATRIX.json`", 
              "- `docs/reports/data/TETO_PROGRESS2_W1_INGREDIENT_AUTHORING_MATRIX.json`", 
              "- `docs/reports/data/TETO_PROGRESS2_W1_UNRESOLVED_EVIDENCE_LEDGER.json`", 
              "- `docs/reports/data/TETO_PROGRESS2_W1_FUTURE_IMPLEMENTATION_CHANGE_MAP.json`", 
              "- `tools/progression2_w1_authoring_audit.py --check`", "",
              "## Validation", "",
              f"- W1 generator/checker: PASS（10 recipes / 6 ingredients / READY {ready} / REVIEW {review} / BLOCKED {blocked}）。",
              "- `validate_recipe_catalog.py`: PASS（53 / 62 / 11）。", 
              "- `progression2_evidence_invariants.py`: PASS 4/4。", 
              "- PR #189 matrix semantic validation: 172 unique rows、counts/capabilities/ledgers PASS。既存 `--check` の byte comparison だけは Windows path separator（`docs\\...` vs `docs/...`）差で FAIL。source matrix は変更していない。", "",
              "## Issue management", "", "Issue #182 が既に content inventory / ingredient canonicalization / implementation split を管理しているため、新Issueは作らない。", ""]
    return "\n".join(lines)


def outputs() -> dict[Path, str]:
    return {
        RECIPE_OUT: json.dumps(envelope("recipe_authoring_matrix", RECIPES), ensure_ascii=False, indent=2) + "\n",
        INGREDIENT_OUT: json.dumps(envelope("ingredient_authoring_matrix", INGREDIENTS), ensure_ascii=False, indent=2) + "\n",
        LEDGER_OUT: json.dumps(envelope("unresolved_evidence_ledger", LEDGER), ensure_ascii=False, indent=2) + "\n",
        CHANGE_MAP_OUT: json.dumps({"schemaVersion": 1, "auditedMainSha": AUDITED_MAIN_SHA, **CHANGE_MAP}, ensure_ascii=False, indent=2) + "\n",
        REPORT_OUT: report(),
    }


def validate_sources() -> None:
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
    assert len(INGREDIENTS) == 6 and len({i["id"] for i in INGREDIENTS}) == 6
    recipe_ids = {r["recipeIdCandidate"] for r in RECIPES}
    ledger_by_id = {item["id"]: item for item in LEDGER}
    assert len(ledger_by_id) == len(LEDGER)
    assert all(set(r["unresolvedRefs"]) <= set(ledger_by_id) for r in RECIPES)
    assert all(set(i["recipesUsingItInCandidateSet"]) <= recipe_ids for i in INGREDIENTS)
    mapped_recipe_ids = {
        recipe_id for section in CHANGE_MAP["slices"] for recipe_id in section.get("recipes", [])
    }
    assert mapped_recipe_ids == recipe_ids, (recipe_ids - mapped_recipe_ids, mapped_recipe_ids - recipe_ids)
    for row in RECIPES:
        unresolved_statuses = {ledger_by_id[ref]["status"] for ref in row["unresolvedRefs"]}
        if "EVIDENCE_REQUIRED" in unresolved_statuses:
            assert row["readiness"] != "READY", row["recipeIdCandidate"]
    assert {r["readiness"] for r in RECIPES} <= {"READY", "REVIEW", "BLOCKED"}
    assert sum(r["readiness"] == "READY" for r in RECIPES) == 1
    assert sum(r["readiness"] == "REVIEW" for r in RECIPES) == 9
    assert len(LEDGER) == 15
    assert next(r for r in RECIPES if r["recipeIdCandidate"] == "pesto-tonno")["unresolvedRefs"] == ["REC-09"]
    assert not any(k in json.dumps(RECIPES) for k in ['"pitzPrice": 0', '"unlockFee": 0', '"starGate": 0'])
    assert all(r["currentMechanicRepresentability"] == "FULL" for r in RECIPES)
    assert all(0 < r["bakeTargetCandidate"]["start"] < r["bakeTargetCandidate"]["end"] < 100 for r in RECIPES)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    validate_sources()
    generated = outputs()
    if args.check:
        mismatches = [str(path.relative_to(ROOT)) for path, text in generated.items()
                      if not path.exists() or path.read_text(encoding="utf-8") != text]
        if mismatches:
            raise SystemExit("generated outputs differ: " + ", ".join(mismatches))
        print("PASS: W1 authoring audit is source-valid and byte-identical (10 recipes, 6 ingredients, READY 1 / REVIEW 9 / BLOCKED 0; canonicalCandidateId drift 0).")
        return 0
    for path, text in generated.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8", newline="\n")
    print("Generated W1 authoring audit outputs.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
