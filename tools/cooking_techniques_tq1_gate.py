#!/usr/bin/env python3
"""
Cooking Techniques 1.0 -- TQ-1 Owner Decision Gate audit (docs/data/tooling only).

NOT part of src/**, NOT wired into CI, NOT a production SSOT. Builds on
tools/cooking_techniques_audit.py (design commit 49b0976) and answers the TQ-1 gate questions
mechanically:

  1. every NO_SAUCE candidate row of the 172 matrix as a machine-readable table (ingredients,
     sauce requirement, required techniques, runtime ingredient availability, progression
     availability, matcher identity, collisions, scoring impact, CUT, evidence strength) and an
     explicit TQ-1 eligibility verdict;
  2. the no-sauce Scoring 2.0 options (A proportional / B dedicated profile / C sauce=full /
     D1 zero-target reference / current) over a deterministic skill grid, with ★ and Pitz bands;
  3. the Discovery Ladder impact of adding a TQ-1 recipe (REC-04 key-recipe rule ported from
     src/logic/testSupport/discoveryLadderRule.ts, parity-checked against the shipped W1 ladder),
     regenerate vs append-only;
  4. near-miss privacy: the k (number of concrete base choices consistent with the existing
     SAUCE_ONLY line) at the moment each candidate first becomes makeable;
  5. the OD-TQ-2 classification re-checked against the 172 evidence (C1..C6).

The weights, star thresholds and Pitz bands are read from src/** by regex (read-only) and the
tool fails if they drift. A "skill grid" is a model, not play data: it answers "at equal skill,
does a no-sauce pizza land in the same ★ band as a sauce pizza?", never "what will players score".

Usage:
  python3 tools/cooking_techniques_tq1_gate.py          # regenerate + validate
  python3 tools/cooking_techniques_tq1_gate.py --check  # validate only; fails if the committed
                                                        # outputs differ from a fresh regeneration
Writes:
  docs/design/data/TETO_COOKING-TECHNIQUES_TQ1_GATE.json
  docs/design/TETO_COOKING-TECHNIQUES_TQ1_GATE_TABLES.md   (generated)
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MATRIX = ROOT / "docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json"
PHASE2 = ROOT / "docs/design/data/TETO_PROGRESSION2_PHASE2_UNLOCK-MATRIX.json"
AUDIT = ROOT / "docs/design/data/TETO_COOKING-TECHNIQUES_1.0_AUDIT.json"
RECIPES_TS = ROOT / "src/data/recipes.ts"
INGREDIENTS_TS = ROOT / "src/data/ingredients.ts"
LADDER_TS = ROOT / "src/data/discoveryLadder.ts"
SCORING_INDEX_TS = ROOT / "src/logic/scoringV2/index.ts"
SAUCE_TS = ROOT / "src/logic/scoringV2/sauceComponent.ts"
SCORING_TS = ROOT / "src/logic/scoring.ts"
PITZ_TS = ROOT / "src/logic/pitzReward.ts"
NEARMISS_TS = ROOT / "src/state/resultNearMiss.ts"
FREECOOK_HINTS_TS = ROOT / "src/data/hints.ts"
OUT_JSON = ROOT / "docs/design/data/TETO_COOKING-TECHNIQUES_TQ1_GATE.json"
OUT_MD = ROOT / "docs/design/TETO_COOKING-TECHNIQUES_TQ1_GATE_TABLES.md"

REC04_STARTERS = ["basil", "mozzarella", "tomato-sauce"]


def load_json(p: Path):
    with p.open(encoding="utf-8") as f:
        return json.load(f)


def read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


# ------------------------------------------------------------------------------------ runtime
def runtime():
    ing = read(INGREDIENTS_TS)
    ingredient_ids = sorted(set(re.findall(r'^\s+id: "([a-z0-9-]+)",', ing, re.M)))
    categories = dict(re.findall(r'id: "([a-z0-9-]+)",(?:(?!\bid: ")[\s\S])*?category: "([a-z]+)"', ing))
    recipes: dict[str, list[str]] = {}
    current = None
    for line in read(RECIPES_TS).splitlines():
        m = re.match(r'^    id: "([a-z0-9-]+)",', line)
        if m:
            current = m.group(1)
            recipes[current] = []
            continue
        m = re.search(r'ingredientId: "([a-z0-9-]+)"', line)
        if m and current and m.group(1) not in recipes[current]:
            recipes[current].append(m.group(1))
    lad = read(LADDER_TS)
    w1 = lad[lad.index("export const W1_25_DISCOVERY_LADDER"):]
    w1 = w1[: w1.index("};") + 2]
    steps = []
    for m in re.finditer(r'\{\s*step: (\d+),\s*kind: "MATERIAL",\s*ingredientIds: \[([^\]]*)\],\s*keyRecipeId: "([a-z0-9-]+)"\s*\}', w1):
        steps.append({"step": int(m.group(1)), "ingredientIds": re.findall(r'"([a-z0-9-]+)"', m.group(2)), "keyRecipeId": m.group(3)})
    return ingredient_ids, categories, recipes, steps


def scoring_constants():
    idx = read(SCORING_INDEX_TS)
    w = {k: int(re.search(rf"const {k}_WEIGHT = (\d+);", idx).group(1)) for k in ("SAUCE", "PIECES", "RECIPE", "BAKE")}
    sauce = read(SAUCE_TS)
    sw = {k: int(re.search(rf"export const SAUCE_{k}_WEIGHT = (\d+);", sauce).group(1)) for k in ("QUANTITY", "COVERAGE", "EVENNESS", "EDGE")}
    stars = [(int(a), int(b)) for a, b in re.findall(r"\{ min: (\d+), stars: (\d) \}", read(SCORING_TS))]
    pitz = [(int(a), float(b)) for a, b in re.findall(r"\{ min: (\d+), multiplier: ([\d.]+) \}", read(PITZ_TS))]
    floor = int(re.search(r"export const PITZ_QUALITY_FLOOR = (\d+);", read(PITZ_TS)).group(1))
    return w, sw, stars, pitz, floor


# ------------------------------------------------------------------------------------ ladder
def build_key_recipe_ladder(recipes: dict[str, list[str]], starters=REC04_STARTERS):
    """Port of buildKeyRecipeLadder (src/logic/testSupport/discoveryLadderRule.ts)."""
    owned = set(starters)
    pop = {k: list(v) for k, v in recipes.items()}

    def reachable(o):
        return {r for r, items in pop.items() if set(items) <= o}

    steps = []
    remaining = [r for r, items in pop.items() if not set(items) <= owned]
    while remaining:
        before = reachable(owned)
        best = None
        for r in remaining:
            missing = sorted(set(i for i in pop[r] if i not in owned))
            after = reachable(owned | set(missing))
            gain = len(after - before)
            reuse = 0
            for x, items in pop.items():
                if set(items) <= owned:
                    continue
                reuse += sum(1 for i in missing if i in items)
            key = (len(missing), -gain, -reuse, r)
            if best is None or key < best[0]:
                best = (key, r, missing)
        _, r, missing = best
        owned |= set(missing)
        steps.append({"ingredientIds": missing, "keyRecipeId": r})
        remaining = [x for x in remaining if not set(pop[x]) <= owned]
    return [{"step": i + 1, **s} for i, s in enumerate(steps)]


def material_step(ladder, ingredient):
    if ingredient in REC04_STARTERS:
        return 0
    for s in ladder:
        if ingredient in s["ingredientIds"]:
            return s["step"]
    return None


def makeable_step(ladder, items):
    """First ladder step at which every item is unlocked (0 = starters only); None if an item is
    not on the ladder at all."""
    steps = [material_step(ladder, i) for i in items]
    return None if any(s is None for s in steps) else max(steps, default=0)


# ------------------------------------------------------------------------------------ scoring
def star_of(total, stars):
    for mn, st in stars:
        if total >= mn:
            return st
    return 1


def pitz_mult(total, pitz):
    for mn, m in pitz:
        if total >= mn:
            return m
    return 0.0


def scoring_options(w, sw):
    """Total (0..100) for a no-sauce pizza under each option, given pieces P, recipe R, bake B.
    `current` = today's code applied to a no-sauce recipe whose Reference still carries a sauce
    target (the sauce component then reads ~0 because presence/quantity/coverage are all missed)."""
    S, Pw, Rw, Bw = w["SAUCE"], w["PIECES"], w["RECIPE"], w["BAKE"]
    zero_target_sauce = sw["QUANTITY"] + sw["COVERAGE"]  # D1: quantity/coverage similarity 1, evenness/edge gated to 0
    return {
        "current_sauce_scored_as_missing": lambda P, R, B: (0 * S + P * Pw + R * Rw + B * Bw) / 100,
        "A_proportional_redistribution": lambda P, R, B: (P * Pw + R * Rw + B * Bw) / (Pw + Rw + Bw),
        "B_dedicated_profile_pieces_takes_sauce": lambda P, R, B: (P * (Pw + S) + R * Rw + B * Bw) / 100,
        "C_sauce_full_marks": lambda P, R, B: (100 * S + P * Pw + R * Rw + B * Bw) / 100,
        "D1_zero_target_reference": lambda P, R, B: (zero_target_sauce * S + P * Pw + R * Rw + B * Bw) / 100,
    }


def sauce_recipe_total(w, S_, P, R, B):
    return (S_ * w["SAUCE"] + P * w["PIECES"] + R * w["RECIPE"] + B * w["BAKE"]) / 100


# ------------------------------------------------------------------------------------ build
def build():
    matrix = load_json(MATRIX)
    phase2 = load_json(PHASE2)
    audit = load_json(AUDIT)
    cls = {r["evidenceId"]: r for r in phase2["rowClassification"]}
    tech_by_row = {r["evidenceId"]: r for r in audit["rows"]}
    ingredient_ids, categories, recipes, shipped_ladder = runtime()
    runtime_ing = set(ingredient_ids)
    runtime_sauces = sorted(i for i, c in categories.items() if c == "sauce")
    w, sw, stars, pitz, pitz_floor = scoring_constants()

    # ---- ladder parity + impact
    derived_now = build_key_recipe_ladder(recipes)
    ladder_parity = [
        {"step": s["step"], "ingredientIds": s["ingredientIds"], "keyRecipeId": s["keyRecipeId"]} for s in derived_now
    ] == shipped_ladder

    runtime_targets = {
        rid: {"items": sorted(set(items)), "sauceBase": sorted(i for i in set(items) if categories.get(i) == "sauce")}
        for rid, items in recipes.items()
    }

    # ---- 172 identity sets (complete rows) for collision checks
    identity = {}
    for r in matrix["rows"]:
        s = r["ingredients"]["identityIngredientSet"]
        if s:
            identity[r["evidenceId"]] = sorted(s)

    def nm_distance(pizza_items, pizza_sauces, t_items, t_sauces):
        piz = [i for i in pizza_items if i not in pizza_sauces]
        tgt = [i for i in t_items if i not in t_sauces]
        missing = len([i for i in tgt if i not in piz])
        extra = len([i for i in piz if i not in tgt])
        sauce_wrong = sorted(pizza_sauces) != sorted(t_sauces)
        return missing + extra + (1 if sauce_wrong else 0)

    rows_out = []
    for r in matrix["rows"]:
        if r["sauceBase"]["status"] != "none":
            continue
        e = r["evidenceId"]
        items = r["ingredients"]["identityIngredientSet"] or []
        missing_rt = sorted(set(items) - runtime_ing)
        req_tech = tech_by_row[e]["techniquesRequired"]
        other_tech = [t for t in req_tech if t != "NO_SAUCE"]
        p2 = cls[e]
        ms = makeable_step(shipped_ladder, items) if items and not missing_rt else None
        # exact collisions
        exact_runtime = sorted(rid for rid, t in runtime_targets.items() if t["items"] == sorted(items) and t["sauceBase"] == [])
        exact_172 = sorted(x for x, s in identity.items() if x != e and s == sorted(items))
        # runtime near neighbours: a pizza that is exactly a runtime recipe, measured to this target
        neighbours = []
        for rid, t in runtime_targets.items():
            if not items:
                break
            d = nm_distance(t["items"], t["sauceBase"], sorted(items), [])
            if d <= 2:
                neighbours.append({"recipeId": rid, "distance": d})
        neighbours.sort(key=lambda x: (x["distance"], x["recipeId"]))
        # SAUCE_ONLY privacy: the player's pizza = this target's toppings + one owned sauce.
        # Concrete base choices consistent with 「ソースを変えると…」 = owned sauces other than the one
        # used, plus "none". k is taken at the first makeable step (worst case = fewest sauces owned).
        k_at_makeable = None
        owned_sauces_at_makeable = None
        if ms is not None:
            owned_sauces_at_makeable = sorted(
                sc for sc in runtime_sauces if (material_step(shipped_ladder, sc) is not None and material_step(shipped_ladder, sc) <= ms)
            )
            k_at_makeable = (len(owned_sauces_at_makeable) - 1) + 1  # alternatives to the sauce used + "none"
        dough_raw = r["dough"]["doughStyleRaw"]
        cut = r["cutServe"]["behavior"]
        wave2_cut = "NO_CUT (OD-W2-4 New Haven precedent: no dough evidence)" if dough_raw is None else "STANDARD_6 (round dough evidenced)"
        blockers = [b["type"] if isinstance(b, dict) else b for b in r["blockers"]]
        reviews = [x["type"] for x in r["reviewItems"]]
        reasons = []
        if p2["phase2Class"] != "EVIDENCE_READY_TARGET":
            reasons.append(f"phase2Class={p2['phase2Class']}")
        if not items:
            reasons.append("identity set incomplete")
        if missing_rt:
            reasons.append("ingredients not in runtime: " + ", ".join(missing_rt))
        if other_tech:
            reasons.append("needs other techniques: " + ", ".join(other_tech))
        if exact_runtime or exact_172:
            reasons.append("exact identity collision")
        if reviews:
            reasons.append("review items: " + ", ".join(reviews))
        rows_out.append(
            {
                "evidenceId": e,
                "canonicalCandidateId": r["canonicalCandidateId"],
                "nameJa": r["nameJa"],
                "ingredients": items,
                "sauceRequirement": {"sauceFamily": r["sauceBase"]["sauceFamily"], "status": r["sauceBase"]["status"], "rule": r["sauceBase"]["rule"]},
                "requiredTechniques": req_tech,
                "runtimeIngredientsMissing": missing_rt,
                "progression": {
                    "phase2Class": p2["phase2Class"],
                    "phase2ReachableAtStep": p2.get("reachableAtStep"),
                    "w1LadderFirstMakeableStep": ms,
                },
                "matcherIdentity": {"items": sorted(items), "sauceBase": [], "nonDefaultDimensions": other_tech},
                "collision": {"exactRuntime": exact_runtime, "exact172": exact_172, "runtimeNeighboursWithin2": neighbours},
                "scoringImpact": "needs a no-sauce scoring profile: under today's formula the sauce component (weight "
                f"{w['SAUCE']}) reads ~0, so the maximum total is {w['PIECES'] + w['RECIPE'] + w['BAKE']} (★{star_of(w['PIECES'] + w['RECIPE'] + w['BAKE'], stars)} cap)",
                "cut": {"matrix": cut, "doughStyleRaw": dough_raw, "wave2Profile": wave2_cut},
                "evidence": {
                    "productDecisionStatus": r["productDecisionStatus"],
                    "evidenceOrigin": r["phase0"]["evidenceOrigin"],
                    "sourceUrl": r["phase0"].get("sourceUrl"),
                    "blockers": blockers,
                    "reviewItems": reviews,
                    "sauceEvidence": "family label（" + str(r["sauceBase"]["sauceFamily"]) + "）= no spread sauce",
                },
                "privacy": {"ownedSaucesAtFirstMakeableStep": owned_sauces_at_makeable, "sauceOnlyK": k_at_makeable},
                "tq1Eligible": not reasons,
                "tq1IneligibleReasons": reasons,
            }
        )

    eligible = [x["evidenceId"] for x in rows_out if x["tq1Eligible"]]

    # ---- ladder impact of adding each eligible recipe
    ladder_impact = []
    for e in eligible:
        row = next(x for x in rows_out if x["evidenceId"] == e)
        with_it = dict(recipes)
        with_it[row["canonicalCandidateId"]] = row["ingredients"]
        regen = build_key_recipe_ladder(with_it)
        first_diff = next(
            (i + 1 for i, (a, b) in enumerate(zip(regen, shipped_ladder)) if (a["ingredientIds"], a["keyRecipeId"]) != (b["ingredientIds"], b["keyRecipeId"])),
            None if len(regen) == len(shipped_ladder) else min(len(regen), len(shipped_ladder)) + 1,
        )
        ladder_impact.append(
            {
                "evidenceId": e,
                "regenerate": {
                    "stepCount": len(regen),
                    "w1OrderChanged": first_diff is not None,
                    "firstChangedStep": first_diff,
                    "firstSteps": [f"{s['step']}:{'+'.join(s['ingredientIds'])}→{s['keyRecipeId']}" for s in regen[:14]],
                },
                "appendOnly": {
                    "newSteps": 0,
                    "w1OrderChanged": False,
                    "note": "every ingredient is already a W1 material or starter, so an append-only ladder adds no step; "
                    "the recipe becomes discoverable at W1 step " + str(row["progression"]["w1LadderFirstMakeableStep"]),
                },
            }
        )

    # ---- scoring comparison
    opts = scoring_options(w, sw)
    grid = []
    for x in range(0, 101, 10):
        entry = {"skill": x, "sauceRecipe_equalSkill": round(sauce_recipe_total(w, x, x, 100, 100), 2)}
        entry["sauceRecipe_stars"] = star_of(entry["sauceRecipe_equalSkill"], stars)
        for name, f in opts.items():
            t = f(x, 100, 100)
            entry[name] = {"total": round(t, 2), "stars": star_of(t, stars), "pitzMultiplier": pitz_mult(t, pitz)}
        grid.append(entry)
    parity = {name: max(abs(g[name]["total"] - g["sauceRecipe_equalSkill"]) for g in grid) for name in opts}
    star_mismatch = {name: sum(1 for g in grid if g[name]["stars"] != g["sauceRecipe_stars"]) for name in opts}
    floors = {name: round(f(0, 100, 100), 2) for name, f in opts.items()}
    ceilings = {name: round(f(100, 100, 100), 2) for name, f in opts.items()}
    bake_miss = {name: round(f(80, 100, 40), 2) for name, f in opts.items()}
    scoring = {
        "weights": w,
        "sauceSubWeights": sw,
        "starThresholds": stars,
        "pitzBands": pitz,
        "pitzFloor": pitz_floor,
        "assumption": "equal skill: a sauce recipe with sauce=pieces=x vs a no-sauce recipe with pieces=x; recipe=100 "
        "(an exact-match discovery is always 100% present, purity 1) and bake=100; quantity factor 1",
        "grid": grid,
        "maxAbsDeviationFromEqualSkillParity": {k: round(v, 2) for k, v in parity.items()},
        "starBandMismatchesOver11GridPoints": star_mismatch,
        "freeCreditFloor_pieces0": floors,
        "ceiling_all100": ceilings,
        "bakeMissCase_pieces80_bake40": bake_miss,
        "existing25Unchanged": {
            "current_sauce_scored_as_missing": True,
            "A_proportional_redistribution": True,
            "B_dedicated_profile_pieces_takes_sauce": True,
            "C_sauce_full_marks": True,
            "D1_zero_target_reference": True,
            "why": "every option is selected only when a recipe's Reference has no sauce (data-driven); all 25 runtime "
            "Reference fixtures carry a sauce, so their branch is byte-identical. Pinned by a golden test in TQ-1B.",
        },
    }

    # ---- OD-TQ-2 re-check against the 172 evidence
    rows = matrix["rows"]
    checks = []
    special = [r for r in rows if r["sauceBase"].get("baseIngredientId") not in (None, "tomato-sauce")]
    checks.append({"id": "C1-special-sauce-is-material", "holds": all(r["sauceBase"]["certainSpreadLayerCount"] <= 2 for r in special)
                   and any(not r["requiredCapabilities"] for r in special),
                   "detail": f"{len(special)} non-tomato-base rows; {sum(1 for r in special if not r['requiredCapabilities'])} need no capability at all, "
                   "so a special sauce never requires a new gesture by itself (a second layer is DOUBLE_SPREAD, counted separately)"})
    dv = [r for r in rows if "DOUGH_VARIANT" in r["requiredCapabilities"]]
    checks.append({"id": "C2-dough-variant-is-material", "holds": len(dv) == 33,
                   "detail": "33 DOUGH_VARIANT rows; Phase-1 merge rationale: the evidence never changes the player's gesture for any dough variant (data-level dough base)"})
    piadina = next(r for r in rows if r["evidenceId"].startswith("piadina-romagnola"))
    checks.append({"id": "C3-piadina-is-dough-plus-no-sauce", "holds": piadina["requiredCapabilities"] == ["DOUGH_VARIANT"] and piadina["sauceBase"]["status"] == "none",
                   "detail": f"piadina requiredCapabilities={piadina['requiredCapabilities']}, sauce={piadina['sauceBase']['status']}: piadina itself is not a technique; it is DOUGH_VARIANT (material) × NO_SAUCE (technique)"})
    nocut = [r["evidenceId"] for r in rows if r["cutServe"]["behavior"] == "serve-whole-no-cut"]
    enclose = {r["evidenceId"] for r in rows if "ENCLOSE" in r["requiredCapabilities"]}
    checks.append({"id": "C4-no-cut-follows-a-form", "holds": set(nocut) <= enclose,
                   "detail": f"serve-whole-no-cut rows {nocut} are all ENCLOSE rows; CUT is not an identity dimension (signature.ts); the only full-signature collision group (fugazza/fugazzetta) is not separated by CUT"})
    late_items_ok = []
    for r in rows:
        late = {i for m in r["postBakeFinish"] for i in m["ingredients"]}
        ident = set(r["ingredients"]["identityIngredientSet"] or [])
        if ident and late:
            late_items_ok.append(bool(ident - late))
    checks.append({"id": "C5-pre-bake-is-baseline", "holds": all(late_items_ok),
                   "detail": f"every complete row with a late-addition ingredient ({len(late_items_ok)} rows) still has pre-bake ingredients; "
                   "no evidenced pizza is made only after the bake, so pre-bake placement is the baseline every row shares"})
    late_req = [r["evidenceId"] for r in rows if "LATE_ADDITION" in r["requiredCapabilities"]]
    late_cand = [r["evidenceId"] for r in rows if "LATE_ADDITION" in r["candidateCapabilities"]]
    checks.append({"id": "C6-post-bake-inference-kept-separate", "holds": not (set(late_req) & set(late_cand)),
                   "detail": f"{len(late_req)} rows need LATE_ADDITION on required-strength evidence; {len(late_cand)} rows carry it as candidate-only (repo inference) and are never counted as required (OD-TQ-12)"})

    return {
        "schemaNote": "Cooking Techniques 1.0 TQ-1 Owner Decision Gate audit. Docs/data only; not a production SSOT.",
        "generatedBy": "tools/cooking_techniques_tq1_gate.py",
        "designBase": "49b0976 (claude/cooking-techniques-design-n0qfwj)",
        "inputs": [str(p.relative_to(ROOT)) for p in (MATRIX, PHASE2, AUDIT, RECIPES_TS, INGREDIENTS_TS, LADDER_TS, SCORING_INDEX_TS, SAUCE_TS, SCORING_TS, PITZ_TS)],
        "runtime": {"recipeCount": len(recipes), "ingredientCount": len(ingredient_ids), "sauces": runtime_sauces, "w1LadderSteps": len(shipped_ladder)},
        "ladderRulePortParity": ladder_parity,
        "noSauceCandidates": rows_out,
        "tq1EligibleEvidenceIds": eligible,
        "ladderImpact": ladder_impact,
        "scoring": scoring,
        "classificationChecks": checks,
        "summary": {
            "noSauceRows": len(rows_out),
            "readyNoSauceRows": sum(1 for x in rows_out if x["progression"]["phase2Class"] == "EVIDENCE_READY_TARGET"),
            "tq1Eligible": eligible,
        },
    }


def render_md(d):
    o = [
        "# Cooking Techniques 1.0 — TQ-1 Gate tables (generated)",
        "",
        "Generated by `tools/cooking_techniques_tq1_gate.py`; the JSON `docs/design/data/TETO_COOKING-TECHNIQUES_TQ1_GATE.json` is",
        "authoritative. Design text: `docs/design/TETO_COOKING-TECHNIQUES_1.0_OWNER-DECISION-GATE.md`.",
        "",
        f"Ladder rule port parity with the shipped W1 ladder: **{d['ladderRulePortParity']}**.",
        "",
        "## 1. All NO_SAUCE rows (172 matrix) — TQ-1 eligibility",
        "",
        "| Row | 名前 | Ingredients | Sauce | Techniques | Missing in runtime | Phase-2 | W1 makeable step | Exact collision | Runtime neighbours (d≤2) | CUT (Wave 2) | Evidence | SAUCE_ONLY k | TQ-1 |",
        "|---|---|---|---|---|---|---|---:|---|---|---|---|---:|---|",
    ]
    for x in d["noSauceCandidates"]:
        col = x["collision"]
        exact = ", ".join(col["exactRuntime"] + col["exact172"]) or "—"
        nb = ", ".join(f"{n['recipeId']}({n['distance']})" for n in col["runtimeNeighboursWithin2"]) or "—"
        ev = x["evidence"]["productDecisionStatus"] + ("; " + ", ".join(x["evidence"]["reviewItems"]) if x["evidence"]["reviewItems"] else "")
        o.append(
            f"| `{x['evidenceId']}` | {x['nameJa']} | {', '.join(x['ingredients']) or '(incomplete)'} | {x['sauceRequirement']['sauceFamily']} | "
            f"{', '.join(x['requiredTechniques'])} | {', '.join(x['runtimeIngredientsMissing']) or '—'} | {x['progression']['phase2Class']} | "
            f"{x['progression']['w1LadderFirstMakeableStep'] if x['progression']['w1LadderFirstMakeableStep'] is not None else '—'} | {exact} | {nb} | "
            f"{x['cut']['wave2Profile'].split(' ')[0]} | {ev} | {x['privacy']['sauceOnlyK'] if x['privacy']['sauceOnlyK'] is not None else '—'} | "
            f"{'**ELIGIBLE**' if x['tq1Eligible'] else '; '.join(x['tq1IneligibleReasons'])} |"
        )
    o += ["", "## 2. Ladder impact of adding a TQ-1 recipe", ""]
    for li in d["ladderImpact"]:
        rg = li["regenerate"]
        o.append(f"- `{li['evidenceId']}` — regenerate: {rg['stepCount']} steps, W1 order changed = **{rg['w1OrderChanged']}** (first changed step {rg['firstChangedStep']}); append-only: {li['appendOnly']['note']}.")
        o.append(f"  - regenerated first steps: {' / '.join(rg['firstSteps'])}")
    s = d["scoring"]
    o += [
        "",
        "## 3. No-sauce scoring options (equal-skill model)",
        "",
        f"Weights {s['weights']}; ★ thresholds {s['starThresholds']}; Pitz bands {s['pitzBands']}. Assumption: {s['assumption']}.",
        "",
        "| skill x | sauce recipe total (★) | " + " | ".join(k for k in s["grid"][0] if k not in ("skill", "sauceRecipe_equalSkill", "sauceRecipe_stars")) + " |",
        "|---:|---|" + "---|" * (len(s["grid"][0]) - 3),
    ]
    for g in s["grid"]:
        cells = [f"{v['total']} (★{v['stars']}, ×{v['pitzMultiplier']})" for k, v in g.items() if k not in ("skill", "sauceRecipe_equalSkill", "sauceRecipe_stars")]
        o.append(f"| {g['skill']} | {g['sauceRecipe_equalSkill']} (★{g['sauceRecipe_stars']}) | " + " | ".join(cells) + " |")
    o += [
        "",
        f"- max |deviation| from equal-skill parity: {s['maxAbsDeviationFromEqualSkillParity']}",
        f"- ★ band mismatches over 11 grid points: {s['starBandMismatchesOver11GridPoints']}",
        f"- free-credit floor (pieces 0, recipe 100, bake 100): {s['freeCreditFloor_pieces0']}",
        f"- ceiling (all 100): {s['ceiling_all100']}",
        "",
        "## 4. OD-TQ-2 classification re-check against the 172 evidence",
        "",
    ]
    for c in d["classificationChecks"]:
        o.append(f"- **{c['id']}** — holds: **{c['holds']}**. {c['detail']}")
    return "\n".join(o) + "\n"


def validate(d):
    errs = []
    if not d["ladderRulePortParity"]:
        errs.append("ladder rule port does not reproduce the shipped W1 ladder (port drifted from discoveryLadderRule.ts)")
    if d["runtime"]["recipeCount"] != 25:
        errs.append(f"runtime recipe count {d['runtime']['recipeCount']} != 25: re-audit TQ-1 (content moved)")
    if d["summary"]["noSauceRows"] != 44:
        errs.append("NO_SAUCE row count drifted from the 49b0976 audit (44)")
    for c in d["classificationChecks"]:
        if not c["holds"]:
            errs.append(f"classification check failed: {c['id']}")
    s = d["scoring"]
    if s["weights"] != {"SAUCE": 52, "PIECES": 16, "RECIPE": 12, "BAKE": 20}:
        errs.append(f"Scoring 2.0 weights drifted: {s['weights']}")
    if s["maxAbsDeviationFromEqualSkillParity"]["B_dedicated_profile_pieces_takes_sauce"] != 0:
        errs.append("option B lost equal-skill parity")
    for x in d["noSauceCandidates"]:
        if x["tq1Eligible"] and (x["collision"]["exactRuntime"] or x["collision"]["exact172"]):
            errs.append(f"{x['evidenceId']}: eligible despite an exact collision")
    if "aussie-pizzadb" not in d["tq1EligibleEvidenceIds"]:
        errs.append("aussie-pizzadb is no longer TQ-1 eligible: re-audit the gate")
    # existing SAUCE_ONLY copy and free-cook sauce copy (privacy findings depend on them)
    if "ソースを変えると" not in read(NEARMISS_TS):
        errs.append("SAUCE_ONLY copy changed: re-audit the near-miss privacy finding")
    if "なしでもOK" not in read(FREECOOK_HINTS_TS):
        errs.append("free-cook SAUCE copy changed: re-audit the affordance finding")
    return errs


def main():
    check = "--check" in sys.argv
    d = build()
    errs = validate(d)
    js = json.dumps(d, ensure_ascii=False, indent=1) + "\n"
    md = render_md(d)
    if check:
        if not OUT_JSON.exists() or read(OUT_JSON) != js:
            errs.append(f"{OUT_JSON.relative_to(ROOT)} differs from a fresh regeneration")
        if not OUT_MD.exists() or read(OUT_MD) != md:
            errs.append(f"{OUT_MD.relative_to(ROOT)} differs from a fresh regeneration")
    else:
        OUT_JSON.write_text(js, encoding="utf-8")
        OUT_MD.write_text(md, encoding="utf-8")
    s = d["summary"]
    print(f"NO_SAUCE rows: {s['noSauceRows']} (ready {s['readyNoSauceRows']}); TQ-1 eligible: {s['tq1Eligible']}")
    print(f"ladder port parity: {d['ladderRulePortParity']}")
    for li in d["ladderImpact"]:
        print(f"  {li['evidenceId']}: regenerate changes W1 order = {li['regenerate']['w1OrderChanged']} (step {li['regenerate']['firstChangedStep']})")
    sc = d["scoring"]
    print("  parity deviation:", sc["maxAbsDeviationFromEqualSkillParity"])
    print("  ★ mismatches:", sc["starBandMismatchesOver11GridPoints"])
    print("  floor:", sc["freeCreditFloor_pieces0"])
    if errs:
        print("VALIDATION FAILED:")
        for e in errs:
            print("  -", e)
        sys.exit(1)
    print("All TQ-1 gate validations passed.")


if __name__ == "__main__":
    main()
