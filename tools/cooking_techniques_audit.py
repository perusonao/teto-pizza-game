#!/usr/bin/env python3
"""
Cooking Techniques 1.0 -- Fresh Design audit (docs/data/tooling only).

NOT part of src/**, NOT wired into CI, NOT a production SSOT. Reads the Phase-1 172-row mechanic
matrix, the Phase-2 row classification and the current runtime recipe/ingredient data (read-only,
by regex over src/data/*.ts) and answers, per Technique candidate:

  * how many of the 172 evidenced rows need it (required strength only),
  * how many need it only as a candidate (inference -- never counted as required),
  * how many of those are Phase-2 EVIDENCE_READY_TARGETs (the reachable pool),
  * how many ready targets could be made with the ingredients the runtime already ships,
  * whether today's runtime already *observes* the axis (so it could be discovered with no new
    gesture), and
  * which current runtime recipes (25) already carry it.

Every candidate gets a verdict class (TECHNIQUE / TECHNIQUE_LATER / BASELINE / MATERIAL /
SERVE_ATTRIBUTE). Verdict classes are the design proposal of
docs/design/TETO_COOKING-TECHNIQUES_1.0_DESIGN.md; the counts are pure derivation.

Discipline (same as the Phase-1/2 tools):
  * All inputs are read-only. No evidence is added, no row is guess-filled.
  * Candidate-strength (repo inference) evidence never makes a row "require" a technique.
  * No price, no ★ threshold, no unlock step is decided here.

Usage:
  python3 tools/cooking_techniques_audit.py          # regenerate + validate
  python3 tools/cooking_techniques_audit.py --check  # validate only; fails if the committed
                                                     # outputs differ from a fresh regeneration
Writes:
  docs/design/data/TETO_COOKING-TECHNIQUES_1.0_AUDIT.json
  docs/design/TETO_COOKING-TECHNIQUES_1.0_ROWS.md   (generated per-row technique table)
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MATRIX = ROOT / "docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json"
PHASE2 = ROOT / "docs/design/data/TETO_PROGRESSION2_PHASE2_UNLOCK-MATRIX.json"
RECIPES_TS = ROOT / "src/data/recipes.ts"
INGREDIENTS_TS = ROOT / "src/data/ingredients.ts"
CATALOG_TS = ROOT / "src/data/discoveryCatalog.ts"
OUT_JSON = ROOT / "docs/design/data/TETO_COOKING-TECHNIQUES_1.0_AUDIT.json"
OUT_MD = ROOT / "docs/design/TETO_COOKING-TECHNIQUES_1.0_ROWS.md"

# --------------------------------------------------------------------------------------------
# Technique candidates. `capability` links to the Phase-1 capability taxonomy (or None when the
# candidate is not a Phase-1 capability). `predicate` names the row test below. `runtimeAxis`
# is what src/logic/discovery/signature.ts observes today for that axis (read by hand from the
# file at the audited SHA; validated below against the file text so it cannot silently drift).
# --------------------------------------------------------------------------------------------
CANDIDATES = [
    {
        "id": "PRE_BAKE_PLACEMENT",
        "nameJa": "焼く前にのせる",
        "userListed": True,
        "capability": None,
        "predicate": "all_rows",
        "runtimeAxis": "FIXED_BY_FLOW (the only placement timing that exists)",
        "verdict": "BASELINE",
        "verdictReasonJa": "全172行・全25 runtime recipeの既定動作。発見対象ではなく、後乗せ/途中のせを『対比として』理解させる基準線。",
    },
    {
        "id": "POST_BAKE_FINISH",
        "nameJa": "焼いた後にのせる（後乗せ）",
        "userListed": True,
        "capability": "LATE_ADDITION",
        "predicate": "late_post_bake",
        "runtimeAxis": "FIXED_BY_FLOW (late: FINISH is a reserved step with no gameplay)",
        "verdict": "TECHNIQUE",
        "verdictReasonJa": "新しい『動詞』ではなく『タイミング』。既存のTOPPING操作を焼成後にもう一度使うだけなので、偶然発見しやすく、教える負荷が最小。POST_BAKE phase が既に存在する。",
    },
    {
        "id": "MID_BAKE_ADD",
        "nameJa": "焼いている途中でのせる（途中のせ）",
        "userListed": False,
        "capability": "LATE_ADDITION",
        "predicate": "late_mid_bake",
        "runtimeAxis": "FIXED_BY_FLOW (BAKE is one uninterrupted judgment)",
        "verdict": "TECHNIQUE_LATER",
        "verdictReasonJa": "BAKEを中断・再開する新しい時間操作が要る。後乗せの派生として後で。うなぎはmodeが未確定。",
    },
    {
        "id": "NO_SAUCE",
        "nameJa": "ソースなし",
        "userListed": True,
        "capability": None,
        "predicate": "no_sauce",
        "runtimeAxis": "OBSERVED (sauceBase can already be empty: free cook's SAUCE step is not content-gated)",
        "verdict": "TECHNIQUE",
        "verdictReasonJa": "『省く』という発想の発見。runtimeで既に観測可能（新しい操作ゼロ）。ただし現在の25 recipeに該当0なので、単独で入れると発見しても行き先が無い（dead technique）。",
    },
    {
        "id": "DOUBLE_SPREAD",
        "nameJa": "複数spread（重ね塗り・仕上げがけ）",
        "userListed": True,
        "capability": "MULTI_SPREAD_LAYER",
        "predicate": "multi_spread",
        "runtimeAxis": "FIXED_BY_FLOW (one sauce per pizza; a new sauce replaces the old)",
        "verdict": "TECHNIQUE",
        "verdictReasonJa": "既存のSAUCE塗り操作の2回目。『置き換えではなく重ねる』という発見。後乗せ（焼成後のオイルがけ等）と組み合わさる行が多い。",
    },
    {
        "id": "SPECIAL_SAUCE",
        "nameJa": "特殊なソース",
        "userListed": True,
        "capability": None,
        "predicate": "special_sauce",
        "runtimeAxis": "OBSERVED (sauceBase id; pesto/olive-oil already ship)",
        "verdict": "MATERIAL",
        "verdictReasonJa": "操作は同じSAUCE塗り。違うのは材料だけなので Recipe/Material Discovery の領域。Techniqueにすると『材料を買えば技法が増える』になり、Shopで答えを買う構造に戻る。",
    },
    {
        "id": "SHAPE_SQUARE",
        "nameJa": "特殊形状：四角",
        "userListed": True,
        "capability": "DOUGH_SHAPE_TARGET",
        "predicate": "shape_square",
        "runtimeAxis": "UNAVAILABLE (doughShape radii exist but no shape classification rule)",
        "verdict": "TECHNIQUE_LATER",
        "verdictReasonJa": "D3Aの8点doughShapeでは四角を作れない/判定できない。形状判定・shape-aware CUT・（ほぼ全行）PAN_BAKEが前提。構造的。",
    },
    {
        "id": "SHAPE_BOAT",
        "nameJa": "特殊形状：舟形（ピデ）",
        "userListed": True,
        "capability": "DOUGH_SHAPE_TARGET",
        "predicate": "shape_boat",
        "runtimeAxis": "UNAVAILABLE",
        "verdict": "TECHNIQUE_LATER",
        "verdictReasonJa": "1行のみ（turkish-pide、BLOCKED）。形状判定＋縁を寄せる操作が必要。",
    },
    {
        "id": "ENCLOSE",
        "nameJa": "包む・折る・かぶせる",
        "userListed": False,
        "capability": "ENCLOSE",
        "predicate": "enclose",
        "runtimeAxis": "FIXED_BY_FLOW (FOLD/SEAL are reserved steps with no gameplay)",
        "verdict": "TECHNIQUE_LATER",
        "verdictReasonJa": "『発見した！』の驚きは最大級だが新ジェスチャー＋CUT無効化が必要。Technique Dexの後半の山場として温存。",
    },
    {
        "id": "NO_CUT",
        "nameJa": "CUTなし",
        "userListed": True,
        "capability": None,
        "predicate": "no_cut",
        "runtimeAxis": "NOT AN IDENTITY AXIS (CUT is excluded from the signature by design)",
        "verdict": "SERVE_ATTRIBUTE",
        "verdictReasonJa": "CUTはidentityではなく提供方法。CUTなしは『包む』等の形状の結果として付随する。プレイヤーが『切らない』ことを発見しても新しいピザは生まれない。",
    },
    {
        "id": "PAN_BAKE",
        "nameJa": "型で焼く（パン／トレイ）",
        "userListed": True,
        "capability": "PAN_BAKE",
        "predicate": "pan",
        "runtimeAxis": "FIXED_BY_FLOW (no pan exists)",
        "verdict": "TECHNIQUE_LATER",
        "verdictReasonJa": "『道具の選択』。型そのものは材料と同じく入手物になりやすいので、Techniqueは『型に入れて焼いた』初回で発見、という形なら成立。ready行が少ない。",
    },
    {
        "id": "DOUGH_BASE",
        "nameJa": "生地の種類（ピアディーナ等の平焼き・厚生地・素材生地）",
        "userListed": True,
        "capability": "DOUGH_VARIANT",
        "predicate": "dough_variant",
        "runtimeAxis": "FIXED_BY_FLOW (one dough style only)",
        "verdict": "MATERIAL",
        "verdictReasonJa": "Phase-1の結論どおり操作は変わらず『生地カードの選択』。材料と同じ入手物として扱い、Techniqueにはしない（ピアディーナはこの枠）。ただし『生地を選べる』こと自体の初回体験は Technique Dex に載せない。",
    },
    {
        "id": "CHEESE_FIRST",
        "nameJa": "チーズを先に（逆順）",
        "userListed": False,
        "capability": "STEP_ORDER",
        "predicate": "step_order",
        "runtimeAxis": "FIXED_BY_FLOW (reducer enforces DOUGH -> SAUCE -> CHEESE -> TOPPING)",
        "verdict": "TECHNIQUE_LATER",
        "verdictReasonJa": "偶然性は高い（順番を変えられれば起きる）が、ready 1行・NYとの衝突解消が主目的。工程順の自由化はUI全体に波及。",
    },
    {
        "id": "ZONED",
        "nameJa": "区切ってのせる（クアトロ・スタジオーニ等）",
        "userListed": False,
        "capability": "ZONED_PLACEMENT",
        "predicate": "zoned",
        "runtimeAxis": "UNAVAILABLE (piece positions exist but no zone classification rule)",
        "verdict": "TECHNIQUE_LATER",
        "verdictReasonJa": "位置は既に記録されているので将来は『偶然』発見可能。ただし判定ルールが未定義で、required 1行。",
    },
    {
        "id": "PREP",
        "nameJa": "炒めてからのせる（下ごしらえ）",
        "userListed": False,
        "capability": "PREP_STEP",
        "predicate": "prep",
        "runtimeAxis": "FIXED_BY_FLOW (no prep step exists)",
        "verdict": "TECHNIQUE_LATER",
        "verdictReasonJa": "新しい工程。ready 1行。",
    },
    {
        "id": "FRY",
        "nameJa": "揚げる",
        "userListed": False,
        "capability": "FRY_COOK",
        "predicate": "fry",
        "runtimeAxis": "FIXED_BY_FLOW (BAKE is the only cooking method)",
        "verdict": "TECHNIQUE_LATER",
        "verdictReasonJa": "調理法そのものの置換。1行。",
    },
    {
        "id": "LAMINATE",
        "nameJa": "生地を折り重ねる",
        "userListed": False,
        "capability": "LAMINATE",
        "predicate": "laminate",
        "runtimeAxis": "FIXED_BY_FLOW (no laminate step exists)",
        "verdict": "TECHNIQUE_LATER",
        "verdictReasonJa": "feteerのscope questionが先。ready 0行。",
    },
]

VERDICTS = ["TECHNIQUE", "TECHNIQUE_LATER", "BASELINE", "MATERIAL", "SERVE_ATTRIBUTE"]


def load_json(path: Path):
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def runtime_data():
    """Current runtime recipes / ingredients (regex over src/data, read-only)."""
    ing_text = INGREDIENTS_TS.read_text(encoding="utf-8")
    ingredient_ids = sorted(set(re.findall(r'^\s+id: "([a-z0-9-]+)",', ing_text, re.M)))
    sauce_ids = sorted(
        set(re.findall(r'id: "([a-z0-9-]+)",(?:(?!\bid: ")[\s\S])*?category: "sauce"', ing_text))
    )
    rec_text = RECIPES_TS.read_text(encoding="utf-8")
    recipes = {}
    current = None
    for line in rec_text.splitlines():
        m = re.match(r'^    id: "([a-z0-9-]+)",', line)
        if m:
            current = m.group(1)
            recipes[current] = []
            continue
        m = re.search(r'ingredientId: "([a-z0-9-]+)"', line)
        if m and current:
            if m.group(1) not in recipes[current]:
                recipes[current].append(m.group(1))
    cat_text = CATALOG_TS.read_text(encoding="utf-8")
    evidence_map = dict(re.findall(r'^\s+"?([a-z0-9-]+)"?: "([a-z0-9:-]+)",', cat_text, re.M))
    return ingredient_ids, sauce_ids, recipes, evidence_map


def late_modes(row, required_strengths):
    return {
        m["mode"]
        for m in row["postBakeFinish"]
        if m["strength"] in required_strengths and "LATE_ADDITION" in row["requiredCapabilities"]
    }


def predicate(name, row, required_strengths, strength):
    """strength: 'required' or 'candidate'. Returns True when the row needs the technique."""
    req = row["requiredCapabilities"]
    cand = row["candidateCapabilities"]
    if name == "all_rows":
        return strength == "required"
    if name == "late_post_bake":
        if strength == "required":
            return "post_bake" in late_modes(row, required_strengths)
        return "LATE_ADDITION" in cand and any(m["mode"] == "post_bake" for m in row["postBakeFinish"])
    if name == "late_mid_bake":
        if strength == "required":
            return any(md.startswith("mid_bake") or md.startswith("unresolved") for md in late_modes(row, required_strengths))
        return False
    if name == "no_sauce":
        return strength == "required" and row["sauceBase"]["status"] == "none"
    if name == "multi_spread":
        return ("MULTI_SPREAD_LAYER" in req) if strength == "required" else ("MULTI_SPREAD_LAYER" in cand)
    if name == "special_sauce":
        base = row["sauceBase"].get("baseIngredientId")
        return strength == "required" and base is not None and base != "tomato-sauce"
    if name == "shape_square":
        return strength == "required" and row["dough"]["shape"] == "square"
    if name == "shape_boat":
        return strength == "required" and row["dough"]["shape"] == "boat"
    if name == "enclose":
        return strength == "required" and "ENCLOSE" in req
    if name == "no_cut":
        return strength == "required" and row["cutServe"]["behavior"] in ("serve-whole-no-cut",)
    if name == "pan":
        return strength == "required" and "PAN_BAKE" in req
    if name == "dough_variant":
        return strength == "required" and "DOUGH_VARIANT" in req
    if name == "step_order":
        return strength == "required" and "STEP_ORDER" in req
    if name == "zoned":
        return ("ZONED_PLACEMENT" in req) if strength == "required" else ("ZONED_PLACEMENT" in cand)
    if name == "prep":
        return strength == "required" and "PREP_STEP" in req
    if name == "fry":
        return strength == "required" and "FRY_COOK" in req
    if name == "laminate":
        return strength == "required" and "LAMINATE" in req
    raise ValueError(name)


def build():
    matrix = load_json(MATRIX)
    phase2 = load_json(PHASE2)
    rows = matrix["rows"]
    required_strengths = set(matrix["requiredStrengths"])
    cls = {r["evidenceId"]: r for r in phase2["rowClassification"]}
    ingredient_ids, sauce_ids, recipes, evidence_map = runtime_data()
    runtime_ing = set(ingredient_ids)
    evidence_to_recipe = {v: k for k, v in evidence_map.items()}

    candidates_out = []
    per_row = {r["evidenceId"]: {"required": [], "candidate": []} for r in rows}
    for c in CANDIDATES:
        req_rows, cand_rows = [], []
        for r in rows:
            if predicate(c["predicate"], r, required_strengths, "required"):
                req_rows.append(r["evidenceId"])
                per_row[r["evidenceId"]]["required"].append(c["id"])
            elif predicate(c["predicate"], r, required_strengths, "candidate"):
                cand_rows.append(r["evidenceId"])
                per_row[r["evidenceId"]]["candidate"].append(c["id"])
        ready = [e for e in req_rows if cls[e]["phase2Class"] == "EVIDENCE_READY_TARGET"]
        row_by_id = {r["evidenceId"]: r for r in rows}
        ready_detail = []
        for e in ready:
            items = row_by_id[e]["ingredients"]["identityIngredientSet"] or []
            missing = sorted(set(items) - runtime_ing)
            ready_detail.append(
                {
                    "evidenceId": e,
                    "nameJa": row_by_id[e]["nameJa"],
                    "reachableAtStep": cls[e].get("reachableAtStep"),
                    "tier": cls[e].get("tier"),
                    "otherRequiredCapabilities": sorted(
                        x for x in row_by_id[e]["requiredCapabilities"] if x != c["capability"]
                    ),
                    "ingredientsMissingFromRuntime": missing,
                    "runtimeRecipeId": evidence_to_recipe.get(e),
                }
            )
        # Runtime (25 recipe) view -- only for axes the runtime recipe data can express.
        runtime_recipes = []
        if c["predicate"] == "all_rows":
            runtime_recipes = sorted(recipes)
        elif c["predicate"] == "no_sauce":
            runtime_recipes = sorted(k for k, v in recipes.items() if not (set(v) & set(sauce_ids)))
        elif c["predicate"] == "special_sauce":
            runtime_recipes = sorted(
                k for k, v in recipes.items() if (set(v) & set(sauce_ids)) and "tomato-sauce" not in v
            )
        candidates_out.append(
            {
                **{k: c[k] for k in ("id", "nameJa", "userListed", "capability", "runtimeAxis", "verdict", "verdictReasonJa")},
                "rowsRequired": len(req_rows),
                "rowsCandidateOnly": len(cand_rows),
                "rowsRequiredReady": len(ready),
                "readyTargetsOnlyThisTechnique": sum(1 for x in ready_detail if not x["otherRequiredCapabilities"]),
                "readyTargetsBuildableWithRuntimeIngredients": sum(
                    1 for x in ready_detail if not x["ingredientsMissingFromRuntime"] and not x["otherRequiredCapabilities"]
                ),
                "runtimeRecipesCarryingIt": runtime_recipes,
                "requiredRowIds": req_rows,
                "candidateOnlyRowIds": cand_rows,
                "readyTargets": ready_detail,
            }
        )

    technique_ids = {c["id"] for c in CANDIDATES if c["verdict"] in ("TECHNIQUE", "TECHNIQUE_LATER")}
    rows_out = []
    for r in rows:
        e = r["evidenceId"]
        req = [t for t in per_row[e]["required"] if t in technique_ids]
        rows_out.append(
            {
                "evidenceId": e,
                "nameJa": r["nameJa"],
                "phase2Class": cls[e]["phase2Class"],
                "techniquesRequired": req,
                "techniquesCandidateOnly": [t for t in per_row[e]["candidate"] if t in technique_ids],
                "nonTechniqueTags": [
                    t for t in per_row[e]["required"] if t not in technique_ids and t != "PRE_BAKE_PLACEMENT"
                ],
            }
        )

    by_count = Counter(len(x["techniquesRequired"]) for x in rows_out)
    ready_rows = [x for x in rows_out if x["phase2Class"] == "EVIDENCE_READY_TARGET"]
    summary = {
        "rows": len(rows_out),
        "rowsByTechniqueCount": {str(k): by_count[k] for k in sorted(by_count)},
        "rowsNeedingNoTechnique": by_count[0],
        "readyTargets": len(ready_rows),
        "readyTargetsNeedingNoTechnique": sum(1 for x in ready_rows if not x["techniquesRequired"]),
        "readyTargetsNeedingTechnique": sum(1 for x in ready_rows if x["techniquesRequired"]),
        "verdictCounts": {v: sum(1 for c in CANDIDATES if c["verdict"] == v) for v in VERDICTS},
        "runtimeRecipeCount": len(recipes),
        "runtimeIngredientCount": len(ingredient_ids),
        "runtimeSauceIds": sauce_ids,
    }
    return {
        "schemaNote": "Cooking Techniques 1.0 Fresh Design audit. Docs/data only; not a production SSOT. "
        "Counts derive from the Phase-1 matrix + Phase-2 classification; verdicts are the design proposal.",
        "generatedBy": "tools/cooking_techniques_audit.py",
        "inputs": [str(p.relative_to(ROOT)) for p in (MATRIX, PHASE2, RECIPES_TS, INGREDIENTS_TS, CATALOG_TS)],
        "requiredStrengths": sorted(required_strengths),
        "summary": summary,
        "candidates": candidates_out,
        "rows": rows_out,
    }


def render_md(data):
    out = [
        "# Cooking Techniques 1.0 — generated per-candidate / per-row tables",
        "",
        "Generated by `tools/cooking_techniques_audit.py`. Do not edit by hand; the JSON",
        "`docs/design/data/TETO_COOKING-TECHNIQUES_1.0_AUDIT.json` is authoritative. Design text:",
        "`docs/design/TETO_COOKING-TECHNIQUES_1.0_DESIGN.md`.",
        "",
        "## 1. Candidates",
        "",
        "| Candidate | 表示名 | Capability | Verdict | Rows required | Candidate-only | Ready | Ready, only this technique | …and all ingredients already in runtime | Runtime axis today |",
        "|---|---|---|---|---:|---:|---:|---:|---:|---|",
    ]
    for c in data["candidates"]:
        out.append(
            f"| `{c['id']}` | {c['nameJa']} | {c['capability'] or '—'} | **{c['verdict']}** | {c['rowsRequired']} | "
            f"{c['rowsCandidateOnly']} | {c['rowsRequiredReady']} | {c['readyTargetsOnlyThisTechnique']} | "
            f"{c['readyTargetsBuildableWithRuntimeIngredients']} | {c['runtimeAxis']} |"
        )
    out += ["", "## 2. Ready targets per candidate", ""]
    for c in data["candidates"]:
        if not c["readyTargets"] or c["id"] == "PRE_BAKE_PLACEMENT":
            continue
        out += [f"### `{c['id']}` ({c['nameJa']}) — {len(c['readyTargets'])} ready", ""]
        out += ["| Row | Name | Phase-2 step | Tier | Other capabilities | Ingredients not in runtime | Runtime recipe |", "|---|---|---:|---|---|---|---|"]
        for t in c["readyTargets"]:
            out.append(
                f"| `{t['evidenceId']}` | {t['nameJa']} | {t['reachableAtStep']} | {t['tier']} | "
                f"{', '.join(t['otherRequiredCapabilities']) or '—'} | {', '.join(t['ingredientsMissingFromRuntime']) or '—'} | "
                f"{t['runtimeRecipeId'] or '—'} |"
            )
        out.append("")
    s = data["summary"]
    out += [
        "## 3. Summary",
        "",
        f"- Rows: {s['rows']}. Rows needing no technique: {s['rowsNeedingNoTechnique']}. By technique count: {s['rowsByTechniqueCount']}.",
        f"- Phase-2 ready targets: {s['readyTargets']}; need no technique: {s['readyTargetsNeedingNoTechnique']}; need ≥1: {s['readyTargetsNeedingTechnique']}.",
        f"- Verdicts: {s['verdictCounts']}.",
        f"- Runtime: {s['runtimeRecipeCount']} recipes, {s['runtimeIngredientCount']} ingredients, sauces {', '.join(s['runtimeSauceIds'])}.",
        "",
        "## 4. Per-row techniques (172)",
        "",
        "| # | Row | Name | Phase-2 class | Techniques required | Candidate-only | Non-technique tags |",
        "|---:|---|---|---|---|---|---|",
    ]
    for i, r in enumerate(data["rows"], 1):
        out.append(
            f"| {i} | `{r['evidenceId']}` | {r['nameJa']} | {r['phase2Class']} | {', '.join(r['techniquesRequired']) or '—'} | "
            f"{', '.join(r['techniquesCandidateOnly']) or '—'} | {', '.join(r['nonTechniqueTags']) or '—'} |"
        )
    return "\n".join(out) + "\n"


def validate(data):
    errors = []
    s = data["summary"]
    if s["rows"] != 172:
        errors.append(f"expected 172 rows, got {s['rows']}")
    if len({r["evidenceId"] for r in data["rows"]}) != 172:
        errors.append("duplicate row ids")
    ids = [c["id"] for c in data["candidates"]]
    if len(ids) != len(set(ids)):
        errors.append("duplicate candidate ids")
    for c in data["candidates"]:
        if c["verdict"] not in VERDICTS:
            errors.append(f"{c['id']}: bad verdict")
        if set(c["requiredRowIds"]) & set(c["candidateOnlyRowIds"]):
            errors.append(f"{c['id']}: a row is both required and candidate-only")
    # Every user-listed item must be audited.
    listed = {c["id"] for c in data["candidates"] if c["userListed"]}
    for must in ("PRE_BAKE_PLACEMENT", "POST_BAKE_FINISH", "NO_SAUCE", "DOUBLE_SPREAD", "SPECIAL_SAUCE",
                 "SHAPE_SQUARE", "SHAPE_BOAT", "NO_CUT", "PAN_BAKE", "DOUGH_BASE"):
        if must not in listed:
            errors.append(f"user-listed candidate missing: {must}")
    # Cross-check with the Phase-1 capability counts (the technique split must not invent rows).
    matrix = load_json(MATRIX)
    cap_rows = Counter(c for r in matrix["rows"] for c in r["requiredCapabilities"])
    by_id = {c["id"]: c for c in data["candidates"]}
    for tid, cap in (("DOUBLE_SPREAD", "MULTI_SPREAD_LAYER"), ("PAN_BAKE", "PAN_BAKE"), ("ENCLOSE", "ENCLOSE"),
                     ("DOUGH_BASE", "DOUGH_VARIANT"), ("CHEESE_FIRST", "STEP_ORDER"), ("ZONED", "ZONED_PLACEMENT"),
                     ("PREP", "PREP_STEP"), ("FRY", "FRY_COOK"), ("LAMINATE", "LAMINATE")):
        if by_id[tid]["rowsRequired"] != cap_rows[cap]:
            errors.append(f"{tid}: {by_id[tid]['rowsRequired']} rows != Phase-1 {cap} {cap_rows[cap]}")
    late = set(by_id["POST_BAKE_FINISH"]["requiredRowIds"]) | set(by_id["MID_BAKE_ADD"]["requiredRowIds"])
    late_phase1 = {r["evidenceId"] for r in matrix["rows"] if "LATE_ADDITION" in r["requiredCapabilities"]}
    if late != late_phase1:
        errors.append(f"LATE split {sorted(late ^ late_phase1)} does not partition Phase-1 LATE_ADDITION rows")
    shape = set(by_id["SHAPE_SQUARE"]["requiredRowIds"]) | set(by_id["SHAPE_BOAT"]["requiredRowIds"])
    shape_phase1 = {r["evidenceId"] for r in matrix["rows"] if "DOUGH_SHAPE_TARGET" in r["requiredCapabilities"]}
    if shape != shape_phase1:
        errors.append("SHAPE split does not equal Phase-1 DOUGH_SHAPE_TARGET rows")
    # Runtime-axis claims must still match signature.ts.
    sig = (ROOT / "src/logic/discovery/signature.ts").read_text(encoding="utf-8")
    for needle in ('late: { status: "FIXED_BY_FLOW"', 'spreadLayers: { status: "FIXED_BY_FLOW"',
                   'shape: { status: "UNAVAILABLE"', 'zones: { status: "UNAVAILABLE"',
                   "RUNTIME_SUPPORTED_CAPABILITIES: readonly string[] = []"):
        if needle not in sig:
            errors.append(f"signature.ts drifted: '{needle}' not found; re-audit runtimeAxis")
    if s["runtimeRecipeCount"] < 1 or not s["runtimeSauceIds"]:
        errors.append("runtime recipe/ingredient parse failed")
    return errors


def main():
    check = "--check" in sys.argv
    data = build()
    errors = validate(data)
    js = json.dumps(data, ensure_ascii=False, indent=1) + "\n"
    md = render_md(data)
    if check:
        if not OUT_JSON.exists() or OUT_JSON.read_text(encoding="utf-8") != js:
            errors.append(f"{OUT_JSON.relative_to(ROOT)} differs from a fresh regeneration")
        if not OUT_MD.exists() or OUT_MD.read_text(encoding="utf-8") != md:
            errors.append(f"{OUT_MD.relative_to(ROOT)} differs from a fresh regeneration")
    else:
        OUT_JSON.write_text(js, encoding="utf-8")
        OUT_MD.write_text(md, encoding="utf-8")
    s = data["summary"]
    print(f"Rows: {s['rows']}  ready targets: {s['readyTargets']}  runtime recipes: {s['runtimeRecipeCount']}")
    for c in data["candidates"]:
        print(f"  {c['id']:<20} {c['verdict']:<16} req={c['rowsRequired']:<3} cand={c['rowsCandidateOnly']:<3} "
              f"ready={c['rowsRequiredReady']:<3} solo={c['readyTargetsOnlyThisTechnique']:<3} "
              f"buildable={c['readyTargetsBuildableWithRuntimeIngredients']:<3} runtime={len(c['runtimeRecipesCarryingIt'])}")
    if errors:
        print("VALIDATION FAILED:")
        for e in errors:
            print("  -", e)
        sys.exit(1)
    print("All Cooking Techniques 1.0 audit validations passed.")


if __name__ == "__main__":
    main()
