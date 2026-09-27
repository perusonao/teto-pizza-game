#!/usr/bin/env python3
"""Dinner Mission DM-5-1 — Human Timing summary (docs/data/tools only).

Reads the two Human Timing sheets recorded from Preview play (protocol:
docs/reports/TETO_DINNER-MISSION_DM-4_Phase4-0_Plan.md §9) and prints the distributions DM-5-2
needs. It decides nothing: tier thresholds, the time limit and the reward table stay Owner
decisions (OD-DM5-2 / OD-DM5-3 / OD-DM4-1). The candidate rules below are labelled options.

Input sheets (templates in docs/reports/data/):
  runs.csv    one row per START (run_id, tester_profile, is_owner, device, viewport_css, mission_id,
              duration_param_s, min_stars_param, attempt_index, outcome, remaining_at_end_s,
              clear_s, ...)
  pizzas.csv  one row per resolved pizza (run_id, pizza_seq, remaining_at_result_s, pizza_s,
              category, stars, ...)

Times are read off the in-game HUD (⏱ remaining, 1 s resolution) on the per-pizza result and on
the CLEAR / FAILED overlay, so no instrumentation is needed:
  clear_s = duration_param_s - remaining_at_end_s   (CLEAR only)
  pizza_s = previous remaining_at_result_s (or duration_param_s) - this remaining_at_result_s

Usage:
  python3 tools/dinner-dm5/dm5_human_timing_summary.py --runs runs.csv --pizzas pizzas.csv
  python3 tools/dinner-dm5/dm5_human_timing_summary.py --self-test
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import statistics
from collections import defaultdict

PROFILES = ("experienced", "normal", "beginner")
OUTCOMES = ("CLEAR", "TIME_UP", "INFEASIBLE", "ABANDONED")
CATEGORIES = ("TARGET_PASS", "QUALITY_FAIL", "DUPLICATE_TARGET", "NON_TARGET", "ORIGINAL", "INVALID_PIZZA")
# OD-DM5-2 Human Validation baseline (NOT final, NOT human-validated): T-1.
BASELINE_LIMIT_S = {"dm-a": 320, "dm-b": 355}
# OD-DM4-1: repeat farming must not beat Lunch Rush's Pitz per minute (economy.ts: max 140 / 180 s).
LUNCH_RUSH_MAX_PITZ_PER_MIN = 140 / 3
# Gate: the minimum evidence before DM-5-2 may use the numbers (Phase 4-0 plan §9.5).
MIN_CLEAR_RUNS_PER_PROFILE = 3
MIN_TESTERS_PER_PROFILE = 1


def pct(values: list[float], q: float) -> float | None:
    if not values:
        return None
    s = sorted(values)
    if len(s) == 1:
        return s[0]
    pos = (len(s) - 1) * q
    lo = int(pos)
    hi = min(lo + 1, len(s) - 1)
    return round(s[lo] + (s[hi] - s[lo]) * (pos - lo), 1)


def dist(values: list[float]) -> dict:
    return {
        "n": len(values),
        "min": min(values) if values else None,
        "p25": pct(values, 0.25),
        "median": pct(values, 0.5),
        "p75": pct(values, 0.75),
        "p90": pct(values, 0.9),
        "max": max(values) if values else None,
    }


def read_csv(text: str) -> list[dict]:
    return [row for row in csv.DictReader(io.StringIO(text)) if any((v or "").strip() for v in row.values())]


def num(value: str | None) -> float | None:
    try:
        return float(value) if value not in (None, "") else None
    except ValueError:
        return None


def summarize(runs: list[dict], pizzas: list[dict]) -> dict:
    problems: list[str] = []
    pizzas_by_run: dict[str, list[dict]] = defaultdict(list)
    for p in pizzas:
        pizzas_by_run[p["run_id"]].append(p)
    for r in runs:
        if r["tester_profile"] not in PROFILES:
            problems.append(f"run {r['run_id']}: unknown tester_profile {r['tester_profile']!r}")
        if r["outcome"] not in OUTCOMES:
            problems.append(f"run {r['run_id']}: unknown outcome {r['outcome']!r}")
        duration, remaining = num(r["duration_param_s"]), num(r["remaining_at_end_s"])
        if r["outcome"] == "CLEAR" and num(r["clear_s"]) is None and duration is not None and remaining is not None:
            r["clear_s"] = str(duration - remaining)
    for p in pizzas:
        if p["category"] not in CATEGORIES:
            problems.append(f"pizza {p['run_id']}#{p['pizza_seq']}: unknown category {p['category']!r}")

    out: dict = {"problems": problems, "missions": {}}
    for mission in sorted({r["mission_id"] for r in runs}):
        m_runs = [r for r in runs if r["mission_id"] == mission]
        per_profile = {}
        for prof in PROFILES:
            pr = [r for r in m_runs if r["tester_profile"] == prof]
            clears = [num(r["clear_s"]) for r in pr if r["outcome"] == "CLEAR" and num(r["clear_s"]) is not None]
            ps = [p for r in pr for p in pizzas_by_run.get(r["run_id"], [])]
            per_pizza = [num(p["pizza_s"]) for p in ps if num(p["pizza_s"]) is not None]
            cats = defaultdict(int)
            for p in ps:
                cats[p["category"]] += 1
            stars = [int(p["stars"]) for p in ps if p["category"] == "TARGET_PASS" and (p.get("stars") or "").isdigit()]
            per_profile[prof] = {
                "runs": len(pr),
                "testers": len({r["tester_id"] for r in pr}),
                "ownerIphoneRuns": sum(1 for r in pr if r.get("is_owner", "").lower() in ("1", "true", "yes")
                                       and "iphone" in r.get("device", "").lower()),
                "outcomes": {o: sum(1 for r in pr if r["outcome"] == o) for o in OUTCOMES},
                "retryRuns": sum(1 for r in pr if (num(r.get("attempt_index")) or 1) > 1),
                "clearSeconds": dist(clears),
                "pizzaSeconds": dist(per_pizza),
                "pizzaCategories": dict(cats),
                "qualityFailCount": cats.get("QUALITY_FAIL", 0),
                "passStars": dict(sorted((s, stars.count(s)) for s in set(stars))),
            }
        exp_clears = [num(r["clear_s"]) for r in m_runs if r["tester_profile"] == "experienced"
                      and r["outcome"] == "CLEAR" and num(r["clear_s"]) is not None]
        all_clears = [num(r["clear_s"]) for r in m_runs if r["outcome"] == "CLEAR" and num(r["clear_s"]) is not None]
        limit = BASELINE_LIMIT_S.get(mission)
        gate = {
            prof: per_profile[prof]["clearSeconds"]["n"] >= MIN_CLEAR_RUNS_PER_PROFILE
            and per_profile[prof]["testers"] >= MIN_TESTERS_PER_PROFILE
            for prof in PROFILES
        }
        gate["ownerIphone"] = any(per_profile[p]["ownerIphoneRuns"] > 0 for p in PROFILES)
        out["missions"][mission] = {
            "perProfile": per_profile,
            "baselineLimitS": limit,
            "baselineTimeUpShare": (
                round(sum(1 for c in all_clears if c > limit) / len(all_clears), 2) if limit and all_clears else None
            ),
            # OPTIONS ONLY (OD-DM5-3): candidate tier rules evaluated on the measured data.
            "tierCandidates": {
                "TC-1 (GOLD=experienced median, SILVER=normal median, BRONZE=limit)": {
                    "goldS": per_profile["experienced"]["clearSeconds"]["median"],
                    "silverS": per_profile["normal"]["clearSeconds"]["median"],
                    "bronzeS": limit,
                },
                "TC-2 (GOLD=experienced p25, SILVER=normal p25, BRONZE=beginner p90)": {
                    "goldS": per_profile["experienced"]["clearSeconds"]["p25"],
                    "silverS": per_profile["normal"]["clearSeconds"]["p25"],
                    "bronzeS": per_profile["beginner"]["clearSeconds"]["p90"],
                },
            },
            # OD-DM4-1 invariant: the most a repeat clear may pay so that the fastest measured
            # experienced clear still earns no more per minute than Lunch Rush's ceiling.
            "repeatPayoutCapPitz": (
                int(LUNCH_RUSH_MAX_PITZ_PER_MIN * min(exp_clears) / 60) if exp_clears else None
            ),
            "gate": gate,
            "gatePass": all(gate.values()),
        }
    return out


SELF_TEST_RUNS = """run_id,tester_id,tester_profile,is_owner,device,os_browser,viewport_css,preview_badge,mission_id,duration_param_s,min_stars_param,attempt_index,outcome,remaining_at_end_s,clear_s,notes
r1,t1,experienced,yes,iPhone,Safari,390x844,x,dm-a,320,3,1,CLEAR,230,,
r2,t1,experienced,yes,iPhone,Safari,390x844,x,dm-a,320,3,2,CLEAR,240,,
r3,t1,experienced,yes,iPhone,Safari,390x844,x,dm-a,320,3,3,CLEAR,236,,
r4,t2,beginner,no,Android,Chrome,360x800,x,dm-a,320,3,1,TIME_UP,0,,
"""
SELF_TEST_PIZZAS = """run_id,pizza_seq,remaining_at_result_s,pizza_s,category,stars,target_recipe_id,notes
r1,1,300,20,TARGET_PASS,4,funghi,
r1,2,280,20,QUALITY_FAIL,2,bismarck,
"""


def self_test() -> None:
    out = summarize(read_csv(SELF_TEST_RUNS), read_csv(SELF_TEST_PIZZAS))
    a = out["missions"]["dm-a"]
    assert not out["problems"], out["problems"]
    assert a["perProfile"]["experienced"]["clearSeconds"]["median"] == 84.0
    assert a["perProfile"]["experienced"]["clearSeconds"]["min"] == 80.0
    assert a["perProfile"]["experienced"]["retryRuns"] == 2
    assert a["perProfile"]["experienced"]["qualityFailCount"] == 1
    assert a["perProfile"]["beginner"]["outcomes"]["TIME_UP"] == 1
    assert a["repeatPayoutCapPitz"] == int(140 / 3 * 80 / 60)  # 62
    assert a["gate"]["experienced"] is True and a["gate"]["beginner"] is False and a["gatePass"] is False
    print("self-test OK (synthetic rows only; not measurement data)")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs")
    ap.add_argument("--pizzas")
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()
    if args.self_test:
        self_test()
        return
    if not args.runs or not args.pizzas:
        ap.error("--runs and --pizzas are required (or --self-test)")
    with open(args.runs, encoding="utf-8") as f:
        runs = read_csv(f.read())
    with open(args.pizzas, encoding="utf-8") as f:
        pizzas = read_csv(f.read())
    print(json.dumps(summarize(runs, pizzas), ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
