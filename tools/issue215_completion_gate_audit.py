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

Determinism (Rev.4): every derived value is computed in exact rational arithmetic
(`fractions.Fraction`; raw JSON floats are parsed as exact decimals) and times in integer
milliseconds / tenths of a second, and is converted to a JSON float only when written. The output
therefore no longer depends on the interpreter's float `sum()` (which switched to compensated
summation in Python 3.12) or on float rounding, so `--check` is byte-stable across Python versions.
"""
from __future__ import annotations

import json
import random
import sys
from collections import Counter, OrderedDict
from fractions import Fraction
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "docs/reports/data/ISSUE-215_COMPLETION-GATE_sim-raw.json"
OUT = ROOT / "docs/reports/data/ISSUE-215_COMPLETION-GATE_COMPARISON-MATRIX.json"

AUDITED_MAIN = "dff233c042d2df6ee1c3a92f2d2419830aa05460"

# Lunch Rush throughput MODEL (not measured): seconds per pizza = base + per-item * items, using
# src/logic/efficiency.ts's own authored "comfortable" constants as the only in-repo time proxy.
LR_BASE_S = 25.0
LR_PER_ITEM_S = 3.0
LR_DURATION_S = 180.0  # src/mission/lunchRush.ts DEFAULT_MISSION_DURATION_SECONDS

# Discrete serve rule (Rev.3). src/mission/lunchRush.ts: SERVE is recorded only while
# `now < endsAt` (`isMissionExpired` is `now >= endsAt`), and App.tsx's handleMissionServeNext
# mirrors that check; a pizza still in progress at the deadline never scores. Pizzas are served
# back-to-back, so serve k lands at k * T and counts iff k * T < 180 s (strict).
LR_DURATION_MS = 180_000
LR_BASE_MS = 25_000
# Per-item seconds are held as integer tenths of a second (30 = 3.0 s) so no float ever reaches
# the time model.
LR_PER_ITEM_TENTHS = 30
LR_PER_ITEM_GRID = list(range(5, 61))  # 0.5 .. 6.0 s
LR_DISPLAY_PER_ITEM = (15, 20, 25, 30, 40, 60)
# Order-stream simulation: production pickMissionOrder -> getNextOrder without `dex`, i.e. a
# uniform pick over the pool that avoids repeating the previous recipe (orders.ts avoidRepeat).
LR_STREAM_RUNS = 2000
LR_STREAM_SEED = 215
LR_PLANS = ("allMinusOne", "allHalf", "allOne")


def pizza_ms(per_item_tenths: int, items: int) -> int:
    return LR_BASE_MS + per_item_tenths * 100 * items


def tenths_key(per_item_tenths: int) -> str:
    return f"{per_item_tenths // 10}.{per_item_tenths % 10}s"


def tenths_value(per_item_tenths: int) -> Fraction:
    return Fraction(per_item_tenths, 10)


def ceil_div(a: int, b: int) -> int:
    return -(-a // b)


def json_default(value):
    if isinstance(value, Fraction):
        return float(value)
    raise TypeError(f"not JSON serializable: {type(value).__name__}")


def completed_serves(t_ms: int) -> int:
    """Serves completed strictly before the 180 s deadline when each takes t_ms."""
    return (LR_DURATION_MS - 1) // t_ms

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
        ("G2_ratio_50pct", lambda c, n: c >= ceil_div(n, 2)),
        ("G2b_ratio_67pct", lambda c, n: c >= ceil_div(2 * n, 3)),
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
        kept = Fraction(c, n)
        if kept >= Fraction(2, 3):
            return "1_short_ge_2of3"
        if kept >= Fraction(1, 2):
            return "2_short_ge_half"
        return "3_short_lt_half"
    if c == n:
        return "4_ideal"
    return "5_excess_1" if c == n + 1 else "6_excess_2plus"


def main() -> int:
    # Raw floats are parsed as exact decimals (Fraction("97.9") == 979/10), never as binary floats.
    raw = json.loads(RAW.read_text(encoding="utf-8"), parse_float=Fraction)
    rows = raw["rows"]
    recipes = raw["recipes"]
    ingredients = {i["id"]: i for i in raw["ingredients"]}

    # k per ingredient (max ideal count across shipped recipes; spread = 1) -- D-4's own rule.
    k: dict[str, int] = {}
    for rec in recipes:
        for s in rec["scatter"]:
            k[s["id"]] = max(k.get(s["id"], 0), s["n"])

    def cost_per_unit(ing_id: str, basis: str) -> Fraction:
        ing = ingredients[ing_id]
        if not ing["finite"] or ing["pricePitz"] is None:
            return Fraction(0)
        if basis == "D4":
            qty = D4_MULTIPLIER * (k.get(ing_id, 1) if ing["placement"] == "scatter" else 1)
        else:  # EP3 restock
            qty = ing["restockQuantity"]
        return Fraction(ing["pricePitz"]) / qty

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
    def pizza_cost(rec: dict, counts: dict[str, int], basis: str) -> Fraction:
        total = Fraction(0)
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
                ("allHalf", ({s["id"]: ceil_div(s["n"], 2) for s in rec["scatter"]}, rec["allHalf"])),
                ("allOne", ({s["id"]: 1 for s in rec["scatter"]}, rec["allOne"])),
            ]
        )
        out = OrderedDict()
        for name, (counts, res) in plans.items():
            pieces = sum(counts.values())
            items = pieces + len(rec.get("spreads", []))
            t_ms = pizza_ms(LR_PER_ITEM_TENTHS, items)
            seconds = Fraction(t_ms, 1000)
            serves = completed_serves(t_ms)
            entry = OrderedDict(pieces=pieces, lrModelSecondsPerPizza=seconds, lrCompletedServes=serves)
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
                q = total if passed else Fraction(0)
                per_pizza_lr = (100 + q) if passed else Fraction(0)
                entry[model_key] = OrderedDict(
                    passed=passed,
                    total=total if passed else None,
                    stars=stars_from_total(total) if passed else None,
                    pitz=pitz if passed else 0,
                    netPitzD4=round((pitz if passed else 0) - entry["costD4"], 1),
                    netPitzEP3=round((pitz if passed else 0) - entry["costEP3"], 1),
                    lrPointsPerRunModel=round(per_pizza_lr * serves, 1),
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

    # ------------------------------------------------------------------------------------------
    # Lunch Rush, discrete serves (Rev.3). Q model for an under-fill plan: quality =
    # max(0, S0 * (1 - a * worstShort)); `a` multiplies the shortage ratio. Ideal quality = S0 ideal.
    # A plan "beats" ideal only when its completed-serve score is strictly greater.
    # ------------------------------------------------------------------------------------------
    def worst_short(rec: dict, counts: dict[str, int]) -> Fraction:
        return max((Fraction(s["n"] - counts[s["id"]], s["n"]) for s in rec["scatter"]), default=Fraction(0))

    def plan_counts(rec: dict, name: str) -> dict[str, int]:
        return {
            "ideal": {s["id"]: s["n"] for s in rec["scatter"]},
            "allMinusOne": {s["id"]: max(1, s["n"] - 1) for s in rec["scatter"]},
            "allHalf": {s["id"]: ceil_div(s["n"], 2) for s in rec["scatter"]},
            "allOne": {s["id"]: 1 for s in rec["scatter"]},
        }[name]

    def plan_items(rec: dict, name: str) -> int:
        return sum(plan_counts(rec, name).values()) + len(rec.get("spreads", []))

    def q_quality(s0: Fraction, short: Fraction, a: Fraction) -> Fraction:
        return max(Fraction(0), s0 * (1 - a * short))

    # Recipe-mode ceiling: the largest a that still keeps every single-group "kept >= 2/3" shortage
    # (e.g. ideal 3 -> 2, ideal 4 -> 3) at >= 75 (star 4) under best placement -- the design intent
    # the report recommends for OD-2. Independent of Lunch Rush timing.
    recipe_mode_ceiling = None
    recipe_mode_ceiling_case = None
    for r in rows:
        c, n = r["count"], r["ideal"]
        if 0 < c < n and Fraction(c, n) >= Fraction(2, 3):
            short = Fraction(n - c, n)
            a_max = (1 - Fraction(75) / r["S0"]) / short
            if recipe_mode_ceiling is None or a_max < recipe_mode_ceiling:
                recipe_mode_ceiling = a_max
                recipe_mode_ceiling_case = f"{r['recipeId']}:{r['ingredientId']}:{c}/{n}"

    # --- (1) per-recipe repeated run: every order is the same recipe --------------------------
    def repeated(per_item: int) -> OrderedDict:
        worst_a = Fraction(0)
        binding = None
        zero_wins = []
        plan_count = 0
        for rec in recipes:
            ideal_serves = completed_serves(pizza_ms(per_item, plan_items(rec, "ideal")))
            ideal_score = ideal_serves * (100 + rec["idealTotal"]["S0"])
            for name in LR_PLANS:
                short = worst_short(rec, plan_counts(rec, name))
                if short == 0:
                    continue
                plan_count += 1
                serves = completed_serves(pizza_ms(per_item, plan_items(rec, name)))
                s0 = rec[name]["S0"]
                if serves * 100 > ideal_score:
                    zero_wins.append(
                        OrderedDict(
                            case=f"{rec['recipeId']}:{name}",
                            idealServes=ideal_serves,
                            idealScore=round(ideal_score, 1),
                            underfillServes=serves,
                            zeroQualityScore=serves * 100,
                        )
                    )
                    continue  # no coefficient can deter this plan
                if serves == 0 or serves * (100 + s0) <= ideal_score:
                    continue  # already deterred at a = 0
                need_q = ideal_score / serves - 100
                a = (1 - need_q / s0) / short
                if a > worst_a:
                    worst_a = a
                    binding = OrderedDict(
                        case=f"{rec['recipeId']}:{name}",
                        worstShortRatio=round(short, 3),
                        idealServes=ideal_serves,
                        idealScore=round(ideal_score, 1),
                        underfillServes=serves,
                        breakEvenQuality=round(need_q, 1),
                        retainedQualityFactorAtMinCoefficient=round(1 - a * short, 3),
                    )
        attainable = not zero_wins
        return OrderedDict(
            minShortCoefficient=round(worst_a, 3) if attainable else None,
            binding=binding if attainable else None,
            zeroQualityUnderfillBeatsIdeal=f"{len(zero_wins)}/{plan_count}",
            zeroQualityWinningCases=zero_wins,
            compatibleWithRecipeModeStar4AtTwoThirds=attainable and worst_a <= recipe_mode_ceiling,
        )

    # --- (2) order stream: production order-selection rule, all 15 recipes discovered ----------
    recipe_ids = [rec["recipeId"] for rec in recipes]
    by_id = {rec["recipeId"]: rec for rec in recipes}

    def stream_mean_counts(per_item: int, plan: str) -> dict[str, Fraction]:
        """Mean completed serves per recipe over LR_STREAM_RUNS seeded runs, same order sequence
        for every plan (the sequence depends only on the RNG, never on the plan)."""
        totals = Counter()
        t_ms = {rid: pizza_ms(per_item, plan_items(by_id[rid], plan)) for rid in recipe_ids}
        for run in range(LR_STREAM_RUNS):
            rng = random.Random(LR_STREAM_SEED * 100003 + run)
            elapsed = 0
            prev = None
            while True:
                pool = [rid for rid in recipe_ids if rid != prev] or recipe_ids
                rid = pool[rng.randrange(len(pool))]
                elapsed += t_ms[rid]
                if elapsed >= LR_DURATION_MS:
                    break  # strict deadline: this pizza never scores
                totals[rid] += 1
                prev = rid
        return {rid: Fraction(totals[rid], LR_STREAM_RUNS) for rid in recipe_ids}

    def stream(per_item: int) -> OrderedDict:
        ideal_counts = stream_mean_counts(per_item, "ideal")
        ideal_mean = sum(c * (100 + by_id[rid]["idealTotal"]["S0"]) for rid, c in ideal_counts.items())
        plans = OrderedDict()
        worst_a = Fraction(0)
        attainable = True
        for name in LR_PLANS:
            counts = stream_mean_counts(per_item, name)
            shorts = {rid: worst_short(by_id[rid], plan_counts(by_id[rid], name)) for rid in recipe_ids}

            def mean_at(a: Fraction) -> Fraction:
                return sum(
                    c * (100 + q_quality(by_id[rid][name]["S0"], shorts[rid], a)) for rid, c in counts.items()
                )

            zero_mean = sum(c * 100 for c in counts.values())
            if zero_mean > ideal_mean:
                a_need = None
                attainable = False
            elif mean_at(Fraction(0)) <= ideal_mean:
                a_need = Fraction(0)
            else:
                lo, hi = Fraction(0), 1 / min(v for v in shorts.values() if v > 0)
                for _ in range(60):
                    mid = (lo + hi) / 2
                    if mean_at(mid) <= ideal_mean:
                        hi = mid
                    else:
                        lo = mid
                a_need = hi
                worst_a = max(worst_a, a_need)
            plans[name] = OrderedDict(
                meanServes=round(sum(counts.values()), 3),
                meanScoreAtQ05=round(mean_at(Fraction(1, 2)), 1),
                meanScoreZeroQuality=round(zero_mean, 1),
                zeroQualityBeatsIdeal=zero_mean > ideal_mean,
                breakEvenShortCoefficient=None if a_need is None else round(a_need, 3),
            )
        return OrderedDict(
            idealMeanServes=round(sum(ideal_counts.values()), 3),
            idealMeanScore=round(ideal_mean, 1),
            plans=plans,
            minShortCoefficient=round(worst_a, 3) if attainable else None,
            compatibleWithRecipeModeStar4AtTwoThirds=attainable and worst_a <= recipe_mode_ceiling,
        )

    repeated_grid = OrderedDict((tenths_key(x), repeated(x)) for x in LR_PER_ITEM_GRID)
    stream_grid = OrderedDict((tenths_key(x), stream(x)) for x in LR_PER_ITEM_GRID)

    def compact(grid: OrderedDict) -> OrderedDict:
        return OrderedDict(
            (
                key,
                OrderedDict(
                    minShortCoefficient=v["minShortCoefficient"],
                    zeroQuality=v.get("zeroQualityUnderfillBeatsIdeal")
                    or ("wins" if any(p["zeroQualityBeatsIdeal"] for p in v["plans"].values()) else "loses"),
                    compatible=v["compatibleWithRecipeModeStar4AtTwoThirds"],
                ),
            )
            for key, v in grid.items()
        )

    # Regression (Codex review on 1c46f2c): 6 s/item, Margherita. Ideal = 61 s -> 2 completed
    # serves -> 399; allOne = 43 s -> 4 completed serves -> 400 even at zero quality. Plus the strict
    # deadline boundary: a 45 s pizza completes 3 serves (the 4th would land exactly at 180 s).
    marg = by_id["margherita"]
    reg_ideal_ms = pizza_ms(60, plan_items(marg, "ideal"))
    reg_one_ms = pizza_ms(60, plan_items(marg, "allOne"))
    regression = OrderedDict(
        margheritaIdeal6s=OrderedDict(
            seconds=Fraction(reg_ideal_ms, 1000),
            serves=completed_serves(reg_ideal_ms),
            score=round(completed_serves(reg_ideal_ms) * (100 + marg["idealTotal"]["S0"]), 1),
        ),
        margheritaAllOne6sZeroQuality=OrderedDict(
            seconds=Fraction(reg_one_ms, 1000),
            serves=completed_serves(reg_one_ms),
            score=completed_serves(reg_one_ms) * 100,
        ),
        strictDeadline45s=OrderedDict(seconds=Fraction(45), serves=completed_serves(45000)),
    )
    assert regression["margheritaIdeal6s"] == OrderedDict(seconds=61.0, serves=2, score=399.0), regression
    assert regression["margheritaAllOne6sZeroQuality"] == OrderedDict(seconds=43.0, serves=4, score=400), regression
    assert regression["strictDeadline45s"]["serves"] == 3, regression
    assert "margherita:allOne" in [
        c["case"] for c in repeated_grid["6.0s"]["zeroQualityWinningCases"]
    ], "the Codex 6 s Margherita case must be reported as a zero-quality win"

    lunch_rush_discrete = OrderedDict(
        rule=OrderedDict(
            deadline="serve k at k*T counts iff k*T < 180 s (src/mission/lunchRush.ts isMissionExpired: now >= endsAt)",
            servesFormula="(180000 - 1) // T_ms",
            secondsPerPizza=f"{LR_BASE_S} + perItem * items (items = pieces + spreads); MODEL, not measured",
            qualityModel="under-fill quality = max(0, S0 * (1 - a * worstShortRatio)); ideal = S0",
            orderStream=(
                f"{LR_STREAM_RUNS} runs, random.Random(seed={LR_STREAM_SEED}*100003+run), pool = all 15 recipes, "
                "uniform pick avoiding the previous recipe (orders.ts getNextOrder/avoidRepeat); same order "
                "sequence for every plan; a pizza that would finish at or after 180 s never scores"
            ),
        ),
        regressionChecks=regression,
        recipeModeMaxShortCoefficientForStar4AtTwoThirds=round(recipe_mode_ceiling, 3),
        recipeModeBindingCase=recipe_mode_ceiling_case,
        perRecipeRepeated=OrderedDict((tenths_key(x), repeated_grid[tenths_key(x)]) for x in LR_DISPLAY_PER_ITEM),
        orderStream=OrderedDict((tenths_key(x), stream_grid[tenths_key(x)]) for x in LR_DISPLAY_PER_ITEM),
        gridPerRecipeRepeated=compact(repeated_grid),
        gridOrderStream=compact(stream_grid),
        compatibleSecondsPerItem=OrderedDict(
            perRecipeRepeated=[
                tenths_value(x)
                for x in LR_PER_ITEM_GRID
                if repeated_grid[tenths_key(x)]["compatibleWithRecipeModeStar4AtTwoThirds"]
            ],
            orderStream=[
                tenths_value(x)
                for x in LR_PER_ITEM_GRID
                if stream_grid[tenths_key(x)]["compatibleWithRecipeModeStar4AtTwoThirds"]
            ],
        ),
        note=(
            "Rev.3 replaces the Rev.2 points-per-second model, which awarded fractional serves. "
            "`a` multiplies the worst shortage ratio. MODEL ONLY: per-item seconds are assumptions."
        ),
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
        lunchRushDiscrete=lunch_rush_discrete,
        lunchRushModel=OrderedDict(
            secondsPerPizza=f"{LR_BASE_S} + {LR_PER_ITEM_S} * items (items = pieces + spreads)",
            runSeconds=LR_DURATION_S,
            pointsPerServe="100 + qualityTotal (PASS only), shared/lunchRushScoring.ts",
            servesCounted="completed serves only, strictly before 180 s (see lunchRushDiscrete.rule)",
            caveat="MODEL ONLY -- not measured; real per-piece time is higher on a phone (drag+drop).",
        ),
    )
    text = json.dumps(matrix, ensure_ascii=False, indent=1, default=json_default) + "\n"

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
