#!/usr/bin/env python3
"""Issue #215 Completion Gate Fresh Audit -- comparison-matrix builder (docs/data tooling only).

Input : docs/reports/data/ISSUE-215_COMPLETION-GATE_sim-raw.json
        (the output of docs/reports/data/ISSUE-215_COMPLETION-GATE_simulation.test.ts.txt, run once
        against production code at the audited main; see the report's Appendix A to reproduce)
Output: docs/reports/data/ISSUE-215_COMPLETION-GATE_COMPARISON-MATRIX.json

Usage:
  python3 tools/issue215_completion_gate_audit.py          # (re)write the matrix
  python3 tools/issue215_completion_gate_audit.py --check  # fail if the committed matrix is stale

Nothing here reads or writes src/**. Every number is either copied from the raw production run
or derived from it by the small, explicit formulas below (economy / Lunch Rush throughput are
MODELS, labelled as such in the report).
"""
from __future__ import annotations

import json
import math
import sys
from collections import Counter, OrderedDict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "docs/reports/data/ISSUE-215_COMPLETION-GATE_sim-raw.json"
OUT = ROOT / "docs/reports/data/ISSUE-215_COMPLETION-GATE_COMPARISON-MATRIX.json"

AUDITED_MAIN = "dff233c042d2df6ee1c3a92f2d2419830aa05460"

# Lunch Rush throughput MODEL (not measured): seconds per pizza = base + per-item * items, using
# src/logic/efficiency.ts's own authored "comfortable" constants as the only in-repo time proxy.
LR_BASE_S = 25.0
LR_PER_ITEM_S = 3.0
LR_DURATION_S = 180.0

# D-4 (PR #214) purchase quantity: 10 x k pieces, k = max minCount of that ingredient at cutover.
D4_MULTIPLIER = 10


def stars_from_total(total: float) -> int:
    for floor, stars in ((90, 5), (75, 4), (60, 3), (40, 2)):
        if total >= floor:
            return stars
    return 1


# ---------------------------------------------------------------------------------------------
# Gate candidates. Each returns True when the single-group count c (ideal n) PASSes composition.
# ---------------------------------------------------------------------------------------------
GATES = OrderedDict(
    [
        ("G0_current_min_eq_ideal", lambda c, n: c >= n),
        ("G1_zero_only", lambda c, n: c >= 1),
        ("G2_ratio_50pct", lambda c, n: c >= math.ceil(n * 0.5)),
        ("G2b_ratio_67pct", lambda c, n: c >= math.ceil(n * 2 / 3)),
    ]
)

# Scoring models: key -> (label, extractor(row) -> total or None)
MODELS = OrderedDict(
    [
        ("S0_current", lambda r: r["S0"]),
        ("S1_placement_coverage", lambda r: r["S1"]),
        ("S2_coverage_plus_steeper_qty", lambda r: r["S2"]),
        ("Q_short0.5_excess0", lambda r: r["Q0"]["total"]),
        ("Q_short0.5_excess0.15", lambda r: r["Q0.15"]["total"]),
        ("Q_short0.5_excess0.25", lambda r: r["Q0.25"]["total"]),
        ("S4_star_cap_bands", lambda r: r["S4cap"]["total"]),
    ]
)


def bucket(c: int, n: int) -> str:
    if c == 0:
        return "0_zero"
    if c < n:
        kept = c / n
        if kept >= 2 / 3:
            return "1_short_ge_2of3"
        if kept >= 1 / 2:
            return "2_short_ge_half"
        return "3_short_lt_half"
    if c == n:
        return "4_ideal"
    return "5_excess_1" if c == n + 1 else "6_excess_2plus"


def main() -> int:
    raw = json.loads(RAW.read_text(encoding="utf-8"))
    rows = raw["rows"]
    recipes = raw["recipes"]
    ingredients = {i["id"]: i for i in raw["ingredients"]}

    # k per ingredient (max ideal count across shipped recipes; spread = 1) -- D-4's own rule.
    k: dict[str, int] = {}
    for rec in recipes:
        for s in rec["scatter"]:
            k[s["id"]] = max(k.get(s["id"], 0), s["n"])

    def cost_per_unit(ing_id: str, basis: str) -> float:
        ing = ingredients[ing_id]
        if not ing["finite"] or ing["pricePitz"] is None:
            return 0.0
        if basis == "D4":
            qty = D4_MULTIPLIER * (k.get(ing_id, 1) if ing["placement"] == "scatter" else 1)
        else:  # EP3 restock
            qty = ing["restockQuantity"]
        return ing["pricePitz"] / qty

    # ---- 1. single-group star distribution per (gate, model, bucket) -------------------------
    distribution: dict = OrderedDict()
    for gate_key, gate in GATES.items():
        for model_key, model in MODELS.items():
            per_bucket: dict[str, Counter] = {}
            for r in rows:
                b = bucket(r["count"], r["ideal"])
                passed = gate(r["count"], r["ideal"])
                label = "FAILED" if not passed else f"star{stars_from_total(model(r))}"
                per_bucket.setdefault(b, Counter())[label] += 1
            distribution[f"{gate_key}|{model_key}"] = {
                b: dict(sorted(cnt.items())) for b, cnt in sorted(per_bucket.items())
            }

    # ---- 2. Human-replay-shaped rows (ideal 3 -> 3/2/1/0/4/5) ---------------------------------
    replay = []
    for r in rows:
        if r["ideal"] == 3:
            replay.append(
                OrderedDict(
                    recipeId=r["recipeId"],
                    ingredientId=r["ingredientId"],
                    count=r["count"],
                    currentGate=r["gate"],
                    S0=r["S0"],
                    S0stars=r["S0stars"],
                    S1=r["S1"],
                    Q015=r["Q0.15"],
                    S4cap=r["S4cap"],
                )
            )

    # ---- 3. Economy + Lunch Rush model on whole-pizza strategies ------------------------------
    def pizza_cost(rec: dict, counts: dict[str, int], basis: str) -> float:
        total = 0.0
        for s in rec["scatter"]:
            total += counts[s["id"]] * cost_per_unit(s["id"], basis)
        for sp in rec.get("spreads", []):
            total += cost_per_unit(sp, basis)
        return total

    strategies = OrderedDict()
    for rec in recipes:
        ideal_counts = {s["id"]: s["n"] for s in rec["scatter"]}
        plans = OrderedDict(
            [
                ("ideal", (ideal_counts, None)),
                ("allMinusOne", ({s["id"]: max(1, s["n"] - 1) for s in rec["scatter"]}, rec["allMinusOne"])),
                ("allHalf", ({s["id"]: math.ceil(s["n"] / 2) for s in rec["scatter"]}, rec["allHalf"])),
                ("allOne", ({s["id"]: 1 for s in rec["scatter"]}, rec["allOne"])),
            ]
        )
        out = OrderedDict()
        for name, (counts, res) in plans.items():
            pieces = sum(counts.values())
            items = pieces + len(rec.get("spreads", []))
            seconds = LR_BASE_S + LR_PER_ITEM_S * items
            entry = OrderedDict(pieces=pieces, lrModelSecondsPerPizza=seconds)
            entry["costD4"] = round(pizza_cost(rec, counts, "D4"), 2)
            entry["costEP3"] = round(pizza_cost(rec, counts, "EP3"), 2)
            for model_key, extractor, pitz_key, gate in (
                ("current", None, None, "G0"),
                ("G1+S0", "S0", "pitzS0", "G1"),
                ("G1+Q0.15", "Q0.15", None, "G1"),
                ("G1+S4cap", "S4cap", None, "G1"),
            ):
                if res is None:  # ideal
                    total, pitz, passed = rec["idealTotal"]["S0"], 120, True
                else:
                    passed = gate == "G1" or res["gate"] == "PASS"
                    if extractor in ("Q0.15", "S4cap"):
                        total, pitz = res[extractor]["total"], res[extractor]["pitz"]
                    else:
                        total, pitz = res["S0"], res["pitzS0"]
                q = total if passed else 0.0
                per_pizza_lr = (100 + q) if passed else 0.0
                entry[model_key] = OrderedDict(
                    passed=passed,
                    total=total if passed else None,
                    stars=stars_from_total(total) if passed else None,
                    pitz=pitz if passed else 0,
                    netPitzD4=round((pitz if passed else 0) - entry["costD4"], 1),
                    netPitzEP3=round((pitz if passed else 0) - entry["costEP3"], 1),
                    lrPointsPerRunModel=round(per_pizza_lr * LR_DURATION_S / seconds, 1),
                )
            out[name] = entry
        strategies[rec["recipeId"]] = out

    # dominance summary: does any under-fill strategy beat ideal on Pitz-net or LR points?
    dominance = OrderedDict()
    for model_key in ("current", "G1+S0", "G1+Q0.15", "G1+S4cap"):
        beats_net = beats_lr = beats_net_ep3 = 0
        total_cases = 0
        for rid, plans in strategies.items():
            ideal = plans["ideal"][model_key]
            for name in ("allMinusOne", "allHalf", "allOne"):
                if plans[name]["pieces"] == plans["ideal"]["pieces"]:
                    continue  # recipe where the plan equals ideal (all n == 1)
                total_cases += 1
                p = plans[name][model_key]
                beats_net += p["netPitzD4"] > ideal["netPitzD4"]
                beats_net_ep3 += p["netPitzEP3"] > ideal["netPitzEP3"]
                beats_lr += p["lrPointsPerRunModel"] > ideal["lrPointsPerRunModel"]
        dominance[model_key] = OrderedDict(
            cases=total_cases,
            underfillBeatsIdealNetPitzD4=beats_net,
            underfillBeatsIdealNetPitzEP3=beats_net_ep3,
            underfillBeatsIdealLunchRushModel=beats_lr,
        )

    # Lunch Rush break-even: the smallest Q shortage coefficient a (total x (1 - a*worstShort),
    # excess ignored) for which NO whole-pizza under-fill plan out-scores ideal per second, for a
    # range of assumed per-item seconds. a > 1 means "even a zero-quality serve still wins".
    def worst_short(rec: dict, counts: dict[str, int]) -> float:
        return max(((s["n"] - counts[s["id"]]) / s["n"] for s in rec["scatter"]), default=0.0)

    lr_break_even = OrderedDict()
    for per_item in (1.5, 2.0, 3.0, 4.0):
        worst_a = 0.0
        worst_case = None
        for rec in recipes:
            spreads = len(rec.get("spreads", []))
            ideal_items = sum(s["n"] for s in rec["scatter"]) + spreads
            ideal_rate = (100 + rec["idealTotal"]["S0"]) / (LR_BASE_S + per_item * ideal_items)
            for name in ("allMinusOne", "allHalf", "allOne"):
                res = rec[name]
                counts = {
                    "allMinusOne": {s["id"]: max(1, s["n"] - 1) for s in rec["scatter"]},
                    "allHalf": {s["id"]: math.ceil(s["n"] / 2) for s in rec["scatter"]},
                    "allOne": {s["id"]: 1 for s in rec["scatter"]},
                }[name]
                short = worst_short(rec, counts)
                if short == 0:
                    continue
                t = LR_BASE_S + per_item * (sum(counts.values()) + spreads)
                # need (100 + S0*(1 - a*short)) / t <= ideal_rate
                need_total = ideal_rate * t - 100
                a = (1 - need_total / res["S0"]) / short if res["S0"] > 0 else 0.0
                if a > worst_a:
                    worst_a, worst_case = a, f"{rec['recipeId']}:{name}"
        lr_break_even[f"{per_item}s_per_item"] = OrderedDict(
            minShortCoefficient=round(worst_a, 3), bindingCase=worst_case
        )

    matrix = OrderedDict(
        schema="issue215-completion-gate-comparison/v1",
        auditedMain=AUDITED_MAIN,
        source=str(RAW.relative_to(ROOT)),
        models=OrderedDict(
            S0_current="production Scoring 2.0 (phase-4a-2-shadow-3)",
            S1_placement_coverage="Pieces placement x c/n when c<n (missing Reference slots score 0)",
            S2_coverage_plus_steeper_qty="S1 + shortage quantity similarity 1-(n-c)/n",
            **{
                "Q_short0.5_excessX": "S0 total x (1 - 0.5*worstShortRatio - X*min(1,worstExcessRatio)), X in {0,0.15,0.25}",
                "S4_star_cap_bands": "S0 total capped by worst kept ratio: <1 ->89.9, <2/3 ->74.9, <1/2 ->59.9",
            },
        ),
        gates=list(GATES.keys()),
        kPerIngredient=dict(sorted(k.items())),
        singleGroupStarDistribution=distribution,
        idealThreeReplayRows=replay,
        wholePizzaStrategies=strategies,
        underfillDominance=dominance,
        lunchRushBreakEvenShortCoefficient=lr_break_even,
        lunchRushModel=OrderedDict(
            secondsPerPizza=f"{LR_BASE_S} + {LR_PER_ITEM_S} * items (items = pieces + spreads)",
            runSeconds=LR_DURATION_S,
            pointsPerServe="100 + qualityTotal (PASS only), shared/lunchRushScoring.ts",
            caveat="MODEL ONLY -- not measured; real per-piece time is higher on a phone (drag+drop).",
        ),
    )
    text = json.dumps(matrix, ensure_ascii=False, indent=1) + "\n"

    if "--check" in sys.argv:
        if not OUT.exists() or OUT.read_text(encoding="utf-8") != text:
            print(f"STALE: {OUT.relative_to(ROOT)} differs from regenerated output", file=sys.stderr)
            return 1
        print("OK: comparison matrix is up to date")
        return 0
    OUT.write_text(text, encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
