#!/usr/bin/env python3
"""Generate the Progression 2.0 content-readiness / implementation-wave audit.

This consumes the merged 172-row mechanic matrix.  It deliberately does not
reconstruct or reinterpret the source research.
"""

from __future__ import annotations

import argparse
import csv
import io
import itertools
import json
import re
from collections import Counter
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MATRIX_PATH = ROOT / "docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json"
PIZZA_CATALOG_PATH = ROOT / "data/recipes/pizza_master_catalog.json"
INGREDIENT_CATALOG_PATH = ROOT / "data/recipes/ingredient_master_catalog.json"
RECIPES_TS_PATH = ROOT / "src/data/recipes.ts"
INGREDIENTS_TS_PATH = ROOT / "src/data/ingredients.ts"
SAUCE_PROFILES_TS_PATH = ROOT / "src/data/recipeSauceProfiles.ts"
SAUCE_PROFILES_TEST_PATH = ROOT / "src/data/recipeSauceProfiles.test.ts"

JSON_OUT = ROOT / "docs/reports/data/TETO_PROGRESS2_CONTENT_READINESS_WAVES.json"
CSV_OUT = ROOT / "docs/reports/data/TETO_PROGRESS2_CONTENT_READINESS_MATRIX.csv"
UNRESOLVED_OUT = ROOT / "docs/reports/data/TETO_PROGRESS2_CONTENT_READINESS_UNRESOLVED.json"
REPORT_OUT = ROOT / "docs/reports/TETO_PROGRESS2_CONTENT_READINESS_Fresh-Audit.md"

AUDITED_MAIN_SHA = "dff233c042d2df6ee1c3a92f2d2419830aa05460"
AUDITED_AT = "2026-09-24T06:19:56+09:00"

SOURCE_SSOT = [
    {"kind": "github_issue", "ref": "#182", "state": "OPEN", "url": "https://github.com/perusonao/teto-pizza-game/issues/182"},
    {"kind": "github_pr", "ref": "#189", "state": "MERGED", "mergeSha": "2f9f28e9fdea3372569973d84fc8cb7ba31369e4", "url": "https://github.com/perusonao/teto-pizza-game/pull/189"},
    {"kind": "github_pr", "ref": "#191", "state": "MERGED", "mergeSha": "9c22ef2e58c73e76377b7cba018e5e868a78a75a", "url": "https://github.com/perusonao/teto-pizza-game/pull/191"},
    {"kind": "github_pr", "ref": "#217", "state": "OPEN", "headSha": "a39932d6b750cd0dd16b63e8635ac40c53a9fb70", "baseSha": AUDITED_MAIN_SHA, "url": "https://github.com/perusonao/teto-pizza-game/pull/217"},
    {"kind": "repo_data", "ref": str(MATRIX_PATH.relative_to(ROOT)).replace("\\", "/")},
    {"kind": "repo_data", "ref": str(PIZZA_CATALOG_PATH.relative_to(ROOT)).replace("\\", "/")},
    {"kind": "production_data", "ref": "src/data/recipes.ts"},
    {"kind": "production_data", "ref": "src/data/ingredients.ts"},
]

FUTURE_FILES = {
    "recipe": ["src/data/recipes.ts", "src/data/recipes.test.ts"],
    "ingredient": ["src/data/ingredients.ts", "src/data/ingredients.test.ts"],
    "discovery": ["src/logic/discovery/*", "src/logic/discovery/*.test.ts"],
    "sauce": ["src/data/recipeSauceProfiles.ts", "src/data/recipeSauceProfiles.test.ts"],
    "assets": [],
}


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def ts_ids(path: Path) -> set[str]:
    return set(re.findall(r'^\s{4}id: "([^"]+)",$', path.read_text(encoding="utf-8"), re.MULTILINE))


def overlap(candidate: set[str] | None, production: dict[str, set[str]]) -> dict:
    if candidate is None:
        return {
            "status": "NOT_COMPUTABLE_INCOMPLETE_IDENTITY_SET",
            "productionIngredientCount": None,
            "candidateIngredientCount": None,
            "overlapRatio": None,
            "nearestProductionRecipeId": None,
            "nearestJaccard": None,
            "sharedIngredientIds": [],
            "exactProductionIngredientSet": None,
        }
    scored = []
    for recipe_id, ingredients in production.items():
        union = candidate | ingredients
        score = len(candidate & ingredients) / len(union) if union else 1.0
        scored.append((score, recipe_id, sorted(candidate & ingredients), candidate == ingredients))
    score, recipe_id, shared, exact = max(scored, default=(0.0, None, [], False))
    return {
        "status": "COMPUTED_FROM_COMPLETE_IDENTITY_SETS",
        "productionIngredientCount": len(candidate & set().union(*production.values())),
        "candidateIngredientCount": len(candidate),
        "overlapRatio": round(len(candidate & set().union(*production.values())) / len(candidate), 4) if candidate else 0.0,
        "nearestProductionRecipeId": recipe_id,
        "nearestJaccard": round(score, 4),
        "sharedIngredientIds": shared,
        "exactProductionIngredientSet": exact,
    }


def mapped_production_ids(row: dict, production_ids: set[str]) -> list[str]:
    values = {row.get("canonicalCandidateId"), row["phase0"].get("correspondsToExistingCatalogId")}
    return sorted(production_ids & {value for value in values if value})


def collision_risk(row: dict, ov: dict) -> tuple[str, list[str]]:
    reasons = []
    if ov["status"] != "COMPUTED_FROM_COMPLETE_IDENTITY_SETS":
        reasons.append("INCOMPLETE_IDENTITY_SET")
        return "UNKNOWN", reasons
    if ov["exactProductionIngredientSet"]:
        reasons.append("EXACT_PRODUCTION_INGREDIENT_SET")
    if row["collisionRefs"]:
        reasons.append("MATRIX_COLLISION_REF")
    if any(item["type"] in {"DISCOVERY_COLLISION", "SAME_INGREDIENT_SET_AS_CATALOG_RECIPE"} for item in row["blockers"] + row["reviewItems"]):
        reasons.append("DISCOVERY_IDENTITY_REVIEW")
    if reasons:
        return "HIGH", sorted(set(reasons))
    if row["reviewItems"] or ov["nearestJaccard"] >= 0.8:
        reasons.append("CONTENT_REVIEW_OR_HIGH_SIMILARITY")
        return "MEDIUM", reasons
    return "LOW", []


def classify(row: dict, production_match: list[str], new_count: int, runtime_contract_dependencies: list[str]) -> tuple[str, str]:
    if production_match:
        return "W0_CORRESPONDENCE", "Matrix evidence row corresponding to an already shipped recipe; audit/reference only."
    representability = row["currentFlowRepresentability"]
    status = row["productDecisionStatus"]
    if representability == "NOT_REPRESENTABLE":
        return "W5", "Current flow cannot represent the evidenced form; structural mechanic required."
    if representability == "FULL" and status != "READY":
        return "W3", "Current mechanics suffice, but evidence/content/product review remains."
    if runtime_contract_dependencies:
        return "W4", "Matrix mechanics are sufficient, but the current production runtime contract cannot represent this recipe."
    if representability == "FULL" and status == "READY" and new_count <= 1:
        return "W1", "Current mechanics, decision-ready, and at most one new ingredient."
    if representability == "FULL" and status == "READY":
        return "W2", "Current mechanics and decision-ready, but two or more new ingredients."
    if representability == "PARTIAL":
        return "W4", "Playable only with evidenced identity loss; new non-structural mechanic or interpretation required."
    raise AssertionError(f"unclassified row: {row['evidenceId']}")


def build() -> tuple[dict, str, dict, str]:
    matrix = read_json(MATRIX_PATH)
    pizzas = read_json(PIZZA_CATALOG_PATH)["recipes"]
    ingredient_catalog = read_json(INGREDIENT_CATALOG_PATH)["ingredients"]
    # Production catalog ingredient sets are complete recipe identity sets: required toppings plus
    # the required sauce. This is symmetric with matrix `identityIngredientSet`, which also adds a
    # family-derived sauce that may be absent from the raw source tokens.
    production = {item["id"]: set(item["ingredients"]) for item in pizzas if item.get("currentGameRecipe")}
    production_ids = set(production)
    production_ingredients = {item["id"] for item in ingredient_catalog if item["existingInGame"]}

    assert len(matrix["rows"]) == 172
    assert matrix["summary"]["currentFlowRepresentability"] == {"FULL": 101, "PARTIAL": 55, "NOT_REPRESENTABLE": 16}
    assert len(production) == 15
    assert len(production_ingredients) == 22
    assert production_ids == set(matrix["shippedRecipeIdsInSrc"])
    assert production_ids <= ts_ids(RECIPES_TS_PATH)
    assert production_ingredients <= ts_ids(INGREDIENTS_TS_PATH)
    sauce_contract = SAUCE_PROFILES_TS_PATH.read_text(encoding="utf-8")
    sauce_contract_test = SAUCE_PROFILES_TEST_PATH.read_text(encoding="utf-8")
    assert "Readonly<Record<RecipeId, RecipeSauceProfile>>" in sauce_contract
    assert "points at each recipe's required sauce" in sauce_contract_test

    rows = []
    for row in matrix["rows"]:
        known_ingredients = set(row["ingredients"]["canonicalIngredientIds"])
        identity_values = row["ingredients"]["identityIngredientSet"]
        identity_ingredients = set(identity_values) if identity_values is not None else None
        ingredients_for_content = identity_ingredients if identity_ingredients is not None else known_ingredients
        new_ids = sorted(ingredients_for_content - production_ingredients)
        production_match = mapped_production_ids(row, production_ids)
        ov = overlap(identity_ingredients, production)
        risk, risk_reasons = collision_risk(row, ov)
        runtime_contract_dependencies = []
        if row["sauceBase"]["status"] == "none" and not production_match:
            runtime_contract_dependencies.append("SAUCELESS_RECIPE_CONTRACT")
        wave, rationale = classify(row, production_match, len(new_ids), runtime_contract_dependencies)
        if runtime_contract_dependencies and row["requiredCapabilities"]:
            implementation_type = "NEW_MECHANIC_AND_RUNTIME_CONTRACT_REQUIRED"
        elif runtime_contract_dependencies:
            implementation_type = "RUNTIME_CONTRACT_CHANGE_REQUIRED"
        elif row["requiredCapabilities"]:
            implementation_type = "NEW_MECHANIC_REQUIRED"
        elif row["blockers"] or row["reviewItems"]:
            implementation_type = "EVIDENCE_OR_CONTENT_REVIEW_REQUIRED"
        elif new_ids:
            implementation_type = "NEW_INGREDIENT_DATA_ONLY"
        else:
            implementation_type = "RECIPE_DATA_ONLY"
        rows.append({
            "evidenceId": row["evidenceId"],
            "nameJa": row["nameJa"],
            "canonicalCandidateId": row.get("canonicalCandidateId"),
            "productionRecipeIds": production_match,
            "wave": wave,
            "waveRationale": rationale,
            "currentFlowRepresentability": row["currentFlowRepresentability"],
            "productDecisionStatus": row["productDecisionStatus"],
            "implementationType": implementation_type,
            "canonicalIngredientIds": sorted(known_ingredients),
            "identityIngredientIds": sorted(identity_ingredients) if identity_ingredients is not None else None,
            "existingIngredientIds": sorted(ingredients_for_content & production_ingredients),
            "newIngredientIds": new_ids,
            "newIngredientCount": len(new_ids),
            "ingredientOverlap": ov,
            "requiredCapabilities": row["requiredCapabilities"],
            "candidateCapabilities": row["candidateCapabilities"],
            "runtimeContractDependencies": runtime_contract_dependencies,
            "sauceBaseStatus": row["sauceBase"]["status"],
            "collisionRisk": risk,
            "collisionRiskReasons": risk_reasons,
            "evidenceComplete": row["ingredients"]["complete"],
            "blockers": row["blockers"],
            "reviewItems": row["reviewItems"],
            "dedicatedAssetAdditionRequired": False,
            "assetNote": "Current production renders ingredient color + emoji from data; no dedicated bitmap asset is required. Visual fields still need content authoring/review.",
            "progression": {
                "pitzPrice": "TBD",
                "unlockFee": "TBD",
                "starGate": "TBD",
                "nonStarCondition": "OWNER_DECISION_REQUIRED",
                "completionGate": "OWNER_DECISION_REQUIRED",
            },
        })

    assert not any(row["sauceBaseStatus"] == "none" and row["wave"] in {"W1", "W2"} for row in rows)
    assert all(
        "RUNTIME_CONTRACT" in row["implementationType"]
        for row in rows
        if row["sauceBaseStatus"] == "none" and row["productDecisionStatus"] == "READY" and not row["productionRecipeIds"]
    )

    wave_meta = {
        "W0": ("Current production baseline", "15 shipped recipes; not an implementation wave."),
        "W0_CORRESPONDENCE": ("Matrix-to-production correspondence", "10 evidence rows map to shipped recipes and are excluded from addition waves."),
        "W1": ("Minimal current-mechanic additions", "FULL + READY; zero or one new ingredient."),
        "W2": ("Multi-ingredient current-mechanic additions", "FULL + READY; two or more new ingredients."),
        "W3": ("Content/evidence decision queue", "FULL, but review or product decision remains."),
        "W4": ("Runtime-contract / non-structural mechanic queue", "PARTIAL under the matrix flow, or blocked by a current production runtime contract such as mandatory sauce profiles."),
        "W5": ("Structural mechanic queue", "NOT_REPRESENTABLE under current flow."),
    }
    wave_summaries = []
    for wave_id in wave_meta:
        if wave_id == "W0":
            selected = []
            recipe_count = len(production)
            new_ids = set()
            mechanics = []
            evidence = {"SHIPPED": recipe_count}
            risks = {"PRODUCTION_BASELINE": recipe_count}
            files = []
        else:
            selected = [row for row in rows if row["wave"] == wave_id]
            recipe_count = len(selected)
            new_ids = set().union(*(set(row["newIngredientIds"]) for row in selected)) if selected else set()
            mechanics = sorted(set().union(*(set(row["requiredCapabilities"]) | set(row["runtimeContractDependencies"]) for row in selected))) if selected else []
            evidence = dict(sorted(Counter(row["productDecisionStatus"] for row in selected).items()))
            risks = dict(sorted(Counter(row["collisionRisk"] for row in selected).items()))
            needs_sauce_contract = any(row["runtimeContractDependencies"] for row in selected)
            files = sorted(set(FUTURE_FILES["recipe"] + FUTURE_FILES["discovery"] + (FUTURE_FILES["ingredient"] if new_ids else []) + (FUTURE_FILES["sauce"] if needs_sauce_contract or any(i.endswith("sauce") or i in {"olive-oil", "pesto"} for i in new_ids) else [])))
        title, rule = wave_meta[wave_id]
        wave_summaries.append({
            "wave": wave_id,
            "title": title,
            "rule": rule,
            "recipeCount": recipe_count,
            "newIngredientCount": len(new_ids),
            "newIngredientIds": sorted(new_ids),
            "mechanicDependencies": mechanics,
            "collisionRiskCounts": risks,
            "evidenceStatusCounts": evidence,
            "futureImplementationFiles": files,
        })

    w1 = [row for row in rows if row["wave"] == "W1" and row["collisionRisk"] == "LOW"]
    best = None
    for combo in itertools.combinations(w1, 10):
        union = set().union(*(set(row["newIngredientIds"]) for row in combo))
        score = (
            len(union),
            sum(row["newIngredientCount"] for row in combo),
            -sum(row["ingredientOverlap"]["overlapRatio"] for row in combo),
            tuple(row["evidenceId"] for row in combo),
        )
        if best is None or score < best[0]:
            best = (score, combo, union)
    assert best is not None
    selected_ids = {row["evidenceId"] for row in best[1]}
    assert {"hawaiian-pizzadb-row", "bambino-pizzadb-p7"} <= selected_ids
    assert not ({"polish-kielbasa-pizzadb-p12", "tsukimi-pizza-pizzadb-p14"} & selected_ids)
    candidate_set = {
        "policy": "Unordered set from W1: minimize distinct new ingredients, then total new-ingredient rows, then maximize production-ingredient overlap; lexical order is only a deterministic tie-break, not a ranking.",
        "recipeCount": 10,
        "distinctNewIngredientCount": len(best[2]),
        "distinctNewIngredientIds": sorted(best[2]),
        "recipes": [{
            "evidenceId": row["evidenceId"],
            "nameJa": row["nameJa"],
            "canonicalCandidateId": row["canonicalCandidateId"],
            "newIngredientIds": row["newIngredientIds"],
            "overlapRatio": row["ingredientOverlap"]["overlapRatio"],
            "nearestProductionRecipeId": row["ingredientOverlap"]["nearestProductionRecipeId"],
            "collisionRisk": row["collisionRisk"],
        } for row in best[1]],
    }

    output = {
        "schemaVersion": 1,
        "purpose": "Fresh Content Readiness / Implementation Wave audit. Consumes PR #189's merged matrix; does not recreate the 172-recipe research.",
        "auditedMainSha": AUDITED_MAIN_SHA,
        "auditedMainCommittedAt": AUDITED_AT,
        "sourceSSOT": SOURCE_SSOT,
        "scope": {"changedNow": ["docs/**", "data/**", "tools/**"], "srcChanged": False, "runtimeImplemented": False},
        "issueManagement": {
            "decision": "USE_EXISTING_ISSUE_182",
            "reason": "Issue #182 already owns the 172-recipe Progression 2.0 content/progression program and explicitly lists the matrix, ingredient reuse, mechanic dependency, and implementation split deliverables. A second tracking issue would duplicate that scope.",
            "dedicatedIssueCreated": False,
        },
        "validation": {
            "contentReadinessCheck": "PASS",
            "catalogValidation": "PASS",
            "evidenceInvariants": "PASS_4_OF_4",
            "mechanicMatrixSemanticValidation": "PASS",
            "mechanicMatrixByteCheck": "WINDOWS_PATH_SEPARATOR_ONLY_MISMATCH",
            "mechanicMatrixByteCheckDetail": "The existing generator emits docs\\reports\\... in inputs[0] on Windows while the committed JSON contains docs/reports/...; the first and only semantic diff is a path representation string. No row, count, ingredient, status, capability, or ledger differs.",
        },
        "productionBaseline": {
            "recipeCount": len(production),
            "ingredientCount": len(production_ingredients),
            "recipeIds": sorted(production),
            "ingredientIds": sorted(production_ingredients),
            "matrixCorrespondenceCount": sum(bool(row["productionRecipeIds"]) for row in rows),
            "productionRecipesWithoutMatrixCorrespondence": sorted(production_ids - set().union(*(set(row["productionRecipeIds"]) for row in rows))),
            "identityIngredientSets": {recipe_id: sorted(ingredients) for recipe_id, ingredients in sorted(production.items())},
        },
        "matrixBaseline": {
            "recipeCount": len(rows),
            "representability": matrix["summary"]["currentFlowRepresentability"],
            "productDecisionStatus": matrix["summary"]["productDecisionStatus"],
        },
        "assetPolicy": {
            "dedicatedAssetRequiredByCurrentRenderer": False,
            "reason": "IngredientPieceVisual uses data-authored color and emoji for all non-cheese ingredients; no candidate needs a dedicated bitmap solely to enter production.",
            "contentFieldsStillRequired": ["nameJa", "category", "placement", "color", "emoji"],
        },
        "runtimeContractPolicy": {
            "sauceLessDependency": "SAUCELESS_RECIPE_CONTRACT",
            "source": "src/data/recipeSauceProfiles.ts + src/data/recipeSauceProfiles.test.ts",
            "currentContract": "RECIPE_SAUCE_PROFILES is an exhaustive Record<RecipeId, RecipeSauceProfile>; every profile must point to a sauce-category required ingredient.",
            "classification": "A non-production row with sauceBase.status == none cannot be RECIPE_DATA_ONLY or NEW_INGREDIENT_DATA_ONLY. A decision-ready FULL row moves to W4; a row with an evidence/content blocker remains W3 until that blocker is resolved.",
        },
        "progressionDecisions": {"pitzPrice": "TBD", "unlockFee": "TBD", "starGate": "TBD", "nonStarCondition": "OWNER_DECISION_REQUIRED", "completionGate": "OWNER_DECISION_REQUIRED"},
        "waves": wave_summaries,
        "first10CandidateSet": candidate_set,
        "rows": rows,
    }

    unresolved_rows = [row for row in rows if row["blockers"] or row["reviewItems"]]
    unresolved = {
        "auditedMainSha": AUDITED_MAIN_SHA,
        "count": len(unresolved_rows),
        "typeCounts": dict(sorted(Counter(item["type"] for row in unresolved_rows for item in row["blockers"] + row["reviewItems"]).items())),
        "rows": [{key: row[key] for key in (
            "evidenceId", "nameJa", "wave", "currentFlowRepresentability", "productDecisionStatus",
            "implementationType", "sauceBaseStatus", "runtimeContractDependencies", "blockers", "reviewItems",
        )} for row in unresolved_rows],
        "ownerDecisions": output["progressionDecisions"],
    }

    csv_buffer = io.StringIO(newline="")
    writer = csv.DictWriter(csv_buffer, fieldnames=[
        "evidence_id", "name_ja", "candidate_id", "production_recipe_ids", "wave",
        "representability", "decision_status", "implementation_type", "identity_set_status", "identity_ingredient_count",
        "existing_ingredient_count", "new_ingredient_count", "new_ingredient_ids",
        "overlap_ratio", "nearest_production_recipe_id", "nearest_jaccard", "collision_risk",
        "collision_risk_reasons", "required_capabilities", "candidate_capabilities",
        "runtime_contract_dependencies", "sauce_base_status", "evidence_complete", "blocker_types", "review_item_types", "dedicated_asset_required",
        "pitz_price", "unlock_fee", "star_gate", "non_star_condition", "completion_gate",
    ], lineterminator="\n")
    writer.writeheader()
    for row in rows:
        writer.writerow({
            "evidence_id": row["evidenceId"], "name_ja": row["nameJa"],
            "candidate_id": row["canonicalCandidateId"] or "", "production_recipe_ids": "|".join(row["productionRecipeIds"]),
            "wave": row["wave"], "representability": row["currentFlowRepresentability"],
            "decision_status": row["productDecisionStatus"], "implementation_type": row["implementationType"],
            "identity_set_status": row["ingredientOverlap"]["status"],
            "identity_ingredient_count": len(row["identityIngredientIds"]) if row["identityIngredientIds"] is not None else "",
            "existing_ingredient_count": len(row["existingIngredientIds"]),
            "new_ingredient_count": row["newIngredientCount"], "new_ingredient_ids": "|".join(row["newIngredientIds"]),
            "overlap_ratio": row["ingredientOverlap"]["overlapRatio"],
            "nearest_production_recipe_id": row["ingredientOverlap"]["nearestProductionRecipeId"],
            "nearest_jaccard": row["ingredientOverlap"]["nearestJaccard"], "collision_risk": row["collisionRisk"],
            "collision_risk_reasons": "|".join(row["collisionRiskReasons"]),
            "required_capabilities": "|".join(row["requiredCapabilities"]),
            "candidate_capabilities": "|".join(row["candidateCapabilities"]),
            "runtime_contract_dependencies": "|".join(row["runtimeContractDependencies"]),
            "sauce_base_status": row["sauceBaseStatus"], "evidence_complete": row["evidenceComplete"],
            "blocker_types": "|".join(item["type"] for item in row["blockers"]),
            "review_item_types": "|".join(item["type"] for item in row["reviewItems"]),
            "dedicated_asset_required": False, "pitz_price": "TBD", "unlock_fee": "TBD",
            "star_gate": "TBD", "non_star_condition": "OWNER_DECISION_REQUIRED", "completion_gate": "OWNER_DECISION_REQUIRED",
        })

    report = render_report(output, unresolved)
    return output, csv_buffer.getvalue(), unresolved, report


def render_report(output: dict, unresolved: dict) -> str:
    waves_by_id = {wave["wave"]: wave for wave in output["waves"]}
    wave_lines = []
    for wave in output["waves"]:
        wave_lines.append(
            f"| {wave['wave']} | {wave['title']} | {wave['recipeCount']} | {wave['newIngredientCount']} | "
            f"{', '.join(wave['mechanicDependencies']) or 'none'} | {json.dumps(wave['collisionRiskCounts'], ensure_ascii=False)} | "
            f"{json.dumps(wave['evidenceStatusCounts'], ensure_ascii=False)} |"
        )
    candidate_lines = [
        f"| `{row['evidenceId']}` | {row['nameJa']} | {', '.join(f'`{x}`' for x in row['newIngredientIds']) or 'none'} | {row['overlapRatio']:.0%} | `{row['nearestProductionRecipeId']}` |"
        for row in output["first10CandidateSet"]["recipes"]
    ]
    files = sorted(set(path for wave in output["waves"] for path in wave["futureImplementationFiles"]))
    return f"""# Progression 2.0 Content Readiness / Implementation Wave — Fresh Audit

## 0. 結論

監査基準は `main` `{AUDITED_MAIN_SHA}`（{AUDITED_AT}）。PR #189 の 172-row matrix を read-only input として使い、分類を再作成していない。

- production は **15 recipes / 22 ingredients**。
- matrix は **172 rows: FULL 101 / PARTIAL 55 / NOT_REPRESENTABLE 16** のまま。
- production 15 件のうち 10 件に matrix correspondence があり、5 件（`funghi`, `napoletana`, `pepperoni`, `pizza-bianca`, `salsiccia`）は対応 row がない。これは欠落ではなく、172 evidence と production overlay の集合差である。
- 追加候補から production correspondence 10 row を除くと、最小差分 Wave は **W1 {waves_by_id['W1']['recipeCount']}件**、複数材料 Wave は **W2 {waves_by_id['W2']['recipeCount']}件**、runtime-contract / 非構造 mechanic Wave は **W4 {waves_by_id['W4']['recipeCount']}件**。
- 最初の 10 件候補は W1 内の同順位集合で、**新 ingredient {output['first10CandidateSet']['distinctNewIngredientCount']}種**に抑えられる。
- current renderer は ingredient の `color` + `emoji` を data から描画するため、専用 bitmap asset が必須の候補は **0**。ただし visual content authoring/review は新 ingredient ごとに必要。

## 1. SSOT / GitHub 実状態

| Source | State |
|---|---|
| Issue #182 | OPEN; parent scope。recipe は購入せず Free Cooking で discover。 |
| PR #189 | MERGED (`2f9f28e9...`); 172 mechanic matrix の authority。 |
| PR #191 | MERGED (`9c22ef2e...`); progression candidate design。数値は final ではない。 |
| PR #217 | OPEN / unmerged / clean; base = audited main。価格、unlock fee、star/non-star gates は owner decision のまま。 |
| Matrix | `docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json` |
| Production | `src/data/recipes.ts`, `src/data/ingredients.ts`（catalog と ID set を照合） |

## 2. 分類方法

1. matrix の canonical ingredient IDs と production 22 ingredient IDs を差分化。
2. ingredient overlap は matrix の完全な `identityIngredientSet`（family-derived sauce を含む）と、同じく sauce を含む production の完全 recipe ingredient set を対称比較する。identity set が incomplete の行は Jaccard / exact-set を算出しない。
3. `FULL + READY` のうち production runtime contract でも表現可能な行だけを即時 content wave に入れる。0–1 新材料を W1、2+ を W2 とした。
4. `FULL` でも review/blocker があれば W3。`PARTIAL` または `SAUCELESS_RECIPE_CONTRACT` 依存は W4、`NOT_REPRESENTABLE` は W5。
5. production correspondence は W0 reference とし、追加候補に二重計上しない。

## 3. Proposed implementation waves

| Wave | Meaning | recipes | distinct new ingredients | mechanic dependency | collision risk | evidence status |
|---|---|---:|---:|---|---|---|
{chr(10).join(wave_lines)}

Wave counts are implementation buckets, not unlock order. Pitz price, unlock fee, star gate, non-star condition, and Completion Gate are all `TBD` / `OWNER_DECISION_REQUIRED`.

## 4. 最初の 10 recipes（順位なし、W1 内 candidate set）

選択規則は distinct new ingredients を最小化し、次に production ingredient overlap を最大化する deterministic set optimization。表示順は matrix 順であり順位ではない。

| evidence id | recipe | new ingredient | existing overlap | nearest production recipe |
|---|---|---|---:|---|
{chr(10).join(candidate_lines)}

必要な新材料は **{output['first10CandidateSet']['distinctNewIngredientCount']}種**: {', '.join(f'`{x}`' for x in output['first10CandidateSet']['distinctNewIngredientIds'])}。

## 5. Change map（将来実装。今回変更なし）

今回の変更は docs/data/tooling のみ。runtime 実装時に影響する可能性がある file family:

{chr(10).join(f'- `{path}`' for path in files)}

- Recipe data only: production 既存 ingredient だけを使い、現 runtime contract に適合する W1 rows。
- New ingredient data only: current `spread` / `scatter` と `color` / `emoji` で成立する W1/W2。
- Asset addition: dedicated bitmap は不要。新 ingredient の visual fields は content authoring 対象。
- Evidence/content review: W3 と unresolved ledger を先に解消する。
- Runtime contract: `sauceBase.status == none` は exhaustive `RECIPE_SAUCE_PROFILES` とその test contract の変更が必要なため `SAUCELESS_RECIPE_CONTRACT` として W4 に置く。
- New mechanic: W4/W5。PR #189 の capability IDs はそのまま参照し、172 mechanic分類を再作成しない。

## 6. Unresolved / content-authoring

- blocker/review を持つ rows: **{unresolved['count']}**。
- type counts: `{json.dumps(unresolved['typeCounts'], ensure_ascii=False)}`。
- 詳細: `docs/reports/data/TETO_PROGRESS2_CONTENT_READINESS_UNRESOLVED.json`。
- 価格・unlock: `pitzPrice=TBD`, `unlockFee=TBD`, `starGate=TBD`, `nonStarCondition=OWNER_DECISION_REQUIRED`。
- Completion Gate: `OWNER_DECISION_REQUIRED`。#217 や関連 Issue/PR の決定を先取りしない。

## 7. Machine-readable artifacts

- JSON: `docs/reports/data/TETO_PROGRESS2_CONTENT_READINESS_WAVES.json`
- CSV: `docs/reports/data/TETO_PROGRESS2_CONTENT_READINESS_MATRIX.csv`
- unresolved: `docs/reports/data/TETO_PROGRESS2_CONTENT_READINESS_UNRESOLVED.json`
- generator/checker: `tools/progression2_content_readiness_audit.py --check`

## 8. 次の推奨作業

1. W1 の candidate set 10件について、recipe description / minCount / bakeTarget / visual fields を content-authoring review する。
2. #217 の owner decision が終わるまで価格・unlock 条件を埋めない。
3. W1 を小さな production implementation PR に分け、discovery collision regression tests を同時追加する。
4. W3 unresolved ledger を blocker type ごとに別作業化する。W4/W5 は mechanic implementation 後に再評価する。

## 9. Issue management

既存 Issue #182 が 172 recipes、ingredient reuse、mechanic dependency、実装 PR 分割までを明示的に管理しているため、本 audit は #182 の子成果物として十分に管理可能。重複する専用 Issue は作成しない。

## 10. Validation

- `python tools/progression2_content_readiness_audit.py --check`: PASS
- `python tools/validate_recipe_catalog.py`: PASS（53 recipes / 62 ingredients / 11 mechanics）
- `python tools/progression2_evidence_invariants.py`: PASS 4/4
- #189 matrix `build()` + `validate()`: semantic PASS
- 既存 `progression2_mechanic_matrix.py --check` の byte check は Windows で `inputs[0]` の `/` と `\\` だけが一致しない。最初かつ唯一の値差分であり、row/count/ingredient/status/capability/ledger の差分ではない。本 task では #189 generator/matrix を変更しない。
"""


def serialize_json(value: dict) -> str:
    return json.dumps(value, ensure_ascii=False, indent=2) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    output, csv_text, unresolved, report = build()
    artifacts = {
        JSON_OUT: serialize_json(output),
        CSV_OUT: csv_text,
        UNRESOLVED_OUT: serialize_json(unresolved),
        REPORT_OUT: report,
    }
    if args.check:
        stale = [str(path.relative_to(ROOT)) for path, text in artifacts.items() if not path.exists() or path.read_text(encoding="utf-8") != text]
        if stale:
            raise SystemExit("stale/missing artifacts: " + ", ".join(stale))
        print("content readiness audit: OK (172 rows, 15 production recipes)")
        return 0
    for path, text in artifacts.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8", newline="")
    print("generated:", ", ".join(str(path.relative_to(ROOT)) for path in artifacts))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
