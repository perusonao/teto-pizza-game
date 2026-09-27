#!/usr/bin/env python3
"""Dinner Mission DM-5-1 — Human Timing summary (docs/data/tools only).

Reads the two Human Timing sheets recorded from Preview play (protocol:
docs/reports/TETO_DINNER-MISSION_DM-4_Phase4-0_Plan.md §11; Owner steps:
docs/reports/TETO_DINNER-MISSION_DM-5-1_Human-Timing-Gate_Result.md) and prints the distributions
DM-5-2 needs. It decides nothing: tier thresholds, the time limit and the reward table stay Owner
decisions (OD-DM5-2 / OD-DM5-3 / OD-DM4-1). The candidate rules below are labelled options.

Evidence classes are never mixed (Phase 4-0 §4):
  - Only rows with evidence_class=HUMAN are read. Anything else (AUTOMATED, MODEL, SYNTHETIC, empty)
    is excluded and listed under "excluded"; the AUTOMATED / MODEL data live in other files
    (TETO_DINNER-MISSION_DM4-DM5_measure.jsonl / _balance-matrix.json) and are not inputs here.

Conditions are never mixed (Phase 4-0 §11.2, U-7):
  - BASELINE  duration = the OD-DM5-2 baseline (DM-A 320 s / DM-B 355 s), minStars = 3.
              The only balance sample: gate, tier candidates, TIME_UP share, repeat cap.
  - AUX_900   duration = 900 s, beginner only. Censored / time-distribution observation only
              ("how long would it take without the cut-off"). Reported separately under
              "auxiliaryUncensored"; never counted by the gate or any candidate.
  - anything else is OFF_PROTOCOL: excluded, with a problem.

Input sheets (templates in docs/reports/data/):
  runs.csv    one row per START (run_id, tester_id, tester_profile, is_owner, device, os_browser,
              viewport_css, preview_badge, mission_id, duration_param_s, min_stars_param,
              attempt_index, outcome, remaining_at_end_s, clear_s, notes, evidence_class)
  pizzas.csv  one row per resolved pizza, in the order made (run_id, pizza_seq,
              remaining_at_result_s, pizza_s, category, stars, target_recipe_id, notes)
The Preview recorder (tools/dinner-dm5/preview/dm5-timing.html) emits both as one text bundle
("# ... runs.csv" / "# pizzas.csv" marker lines); --bundle reads that directly.

Times are read off the in-game HUD (⏱ remaining, 1 s resolution) on the per-pizza result and on
the CLEAR / FAILED overlay, so no instrumentation is needed:
  clear_s = duration_param_s - remaining_at_end_s   (CLEAR only)
  pizza_s = previous remaining_at_result_s (or duration_param_s) - this remaining_at_result_s
  The last pizza of a CLEAR may leave remaining_at_result_s empty: it is duration - clear_s.
  The CLEAR overlay does not show the last pizza's ★, so its stars may be empty.

Usage:
  python3 tools/dinner-dm5/dm5_human_timing_summary.py --runs runs.csv --pizzas pizzas.csv
  python3 tools/dinner-dm5/dm5_human_timing_summary.py --bundle pasted.txt [--split-to DIR]
  python3 tools/dinner-dm5/dm5_human_timing_summary.py --self-test
  --strict exits 1 when any problem is found (warnings do not fail).
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import os
import sys
from collections import defaultdict

EVIDENCE_CLASS = "HUMAN"
PROFILES = ("experienced", "normal", "beginner")
OUTCOMES = ("CLEAR", "TIME_UP", "INFEASIBLE", "ABANDONED")
CATEGORIES = ("TARGET_PASS", "QUALITY_FAIL", "DUPLICATE_TARGET", "NON_TARGET", "ORIGINAL", "INVALID_PIZZA")
RUN_COLS = ("run_id", "tester_id", "tester_profile", "is_owner", "device", "os_browser", "viewport_css",
            "preview_badge", "mission_id", "duration_param_s", "min_stars_param", "attempt_index", "outcome",
            "remaining_at_end_s", "clear_s", "notes", "evidence_class")
PIZZA_COLS = ("run_id", "pizza_seq", "remaining_at_result_s", "pizza_s", "category", "stars", "target_recipe_id", "notes")
# src/mission/dinner/dinnerMission.ts DINNER_MISSIONS (definition order).
MISSION_TARGETS = {
    "dm-a": ("margherita", "bismarck", "breakfast-pizza", "funghi"),
    "dm-b": ("margherita", "funghi", "melanzane-pizza", "parmigiana-pizza"),
}
# OD-DM5-2 Human Validation baseline (NOT final, NOT human-validated): T-1.
BASELINE_LIMIT_S = {"dm-a": 320, "dm-b": 355}
# OD-DM5-1 provisional S.
BASELINE_MIN_STARS = 3
# Phase 4-0 §11.2 / U-7: beginner-only auxiliary, censored / time-distribution observation only.
AUX_DURATION_S = 900
AUX_PROFILES = ("beginner",)
# OD-DM4-1: repeat farming must not beat Lunch Rush's Pitz per minute (economy.ts: max 140 / 180 s).
LUNCH_RUSH_MAX_PITZ_PER_MIN = 140 / 3
# Gate: the minimum evidence before DM-5-2 may use the numbers (Phase 4-0 plan §11.5).
MIN_CLEAR_RUNS_PER_PROFILE = 3
MIN_TESTERS_PER_PROFILE = 1
# HUD resolution is 1 s; two readings of the same second may differ by one.
TOLERANCE_S = 1


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
    rows = csv.DictReader(io.StringIO(text))
    return [{k: (v or "").strip() for k, v in row.items() if k is not None}
            for row in rows if any((v or "").strip() for v in row.values() if isinstance(v, str))]


def split_bundle(text: str) -> tuple[str, str]:
    """The recorder's paste: '# ... runs.csv' then the runs sheet, '# pizzas.csv' then the pizzas sheet."""
    parts: dict[str, list[str]] = {"runs": [], "pizzas": []}
    current = None
    for line in text.splitlines():
        if line.startswith("#"):
            current = "pizzas" if "pizzas.csv" in line else "runs" if "runs.csv" in line else current
            continue
        if current:
            parts[current].append(line)
    if not parts["runs"] or not parts["pizzas"]:
        raise ValueError("bundle needs a '# ... runs.csv' and a '# pizzas.csv' section")
    return "\n".join(parts["runs"]) + "\n", "\n".join(parts["pizzas"]) + "\n"


def num(value: str | None) -> float | None:
    try:
        return float(value) if value not in (None, "") else None
    except ValueError:
        return None


def condition_of(r: dict) -> str:
    duration, stars = num(r.get("duration_param_s")), num(r.get("min_stars_param"))
    if stars != BASELINE_MIN_STARS:
        return "OFF_PROTOCOL"
    if duration == BASELINE_LIMIT_S.get(r.get("mission_id", "")):
        return "BASELINE"
    if duration == AUX_DURATION_S and r.get("tester_profile") in AUX_PROFILES:
        return "AUX_900"
    return "OFF_PROTOCOL"


def is_owner_iphone(r: dict) -> bool:
    return r.get("is_owner", "").lower() in ("1", "true", "yes") and "iphone" in r.get("device", "").lower()


def validate(runs: list[dict], pizzas: list[dict]) -> tuple[list[dict], dict, list[str], list[str], list[dict]]:
    """Returns (usable HUMAN runs with derived fields, their pizzas by run, problems, warnings, excluded)."""
    problems: list[str] = []
    warnings: list[str] = []
    excluded: list[dict] = []
    if runs and (missing := [c for c in RUN_COLS if c not in runs[0]]):
        problems.append(f"runs sheet: missing columns {missing}")
    if pizzas and (missing := [c for c in PIZZA_COLS if c not in pizzas[0]]):
        problems.append(f"pizzas sheet: missing columns {missing}")

    seen: set[str] = set()
    usable: list[dict] = []
    for r in runs:
        rid = r.get("run_id", "")
        if not rid or rid in seen:
            problems.append(f"run {rid!r}: empty or duplicate run_id")
            excluded.append({"run_id": rid, "reason": "DUPLICATE_OR_EMPTY_RUN_ID"})
            continue
        seen.add(rid)
        ec = r.get("evidence_class", "")
        if ec != EVIDENCE_CLASS:
            # Never summarise AUTOMATED / MODEL / synthetic rows as HUMAN.
            excluded.append({"run_id": rid, "reason": f"EVIDENCE_CLASS_{ec or 'MISSING'}"})
            if ec:
                warnings.append(f"run {rid}: {ec} row in a HUMAN sheet, excluded (keep AUTOMATED / MODEL data in their own files)")
            else:
                problems.append(f"run {rid}: evidence_class is empty (must be {EVIDENCE_CLASS!r})")
            continue
        bad = []
        if r.get("tester_profile") not in PROFILES:
            bad.append(f"unknown tester_profile {r.get('tester_profile')!r}")
        if r.get("outcome") not in OUTCOMES:
            bad.append(f"unknown outcome {r.get('outcome')!r}")
        if r.get("mission_id") not in MISSION_TARGETS:
            bad.append(f"unknown mission_id {r.get('mission_id')!r}")
        if bad:
            problems.extend(f"run {rid}: {b}" for b in bad)
            excluded.append({"run_id": rid, "reason": "INVALID_ROW"})
            continue
        cond = condition_of(r)
        if cond == "OFF_PROTOCOL":
            problems.append(
                f"run {rid}: off protocol ({r['mission_id']} {r.get('duration_param_s')} s, ★{r.get('min_stars_param')}, "
                f"{r['tester_profile']}); BASELINE = DM-A 320 / DM-B 355 with ★3, AUX_900 = beginner only"
            )
            excluded.append({"run_id": rid, "reason": "OFF_PROTOCOL"})
            continue
        duration = num(r["duration_param_s"])
        remaining, clear = num(r.get("remaining_at_end_s")), num(r.get("clear_s"))
        if r["outcome"] == "CLEAR":
            if clear is None and remaining is not None:
                clear = duration - remaining
            if clear is None:
                problems.append(f"run {rid}: CLEAR without clear_s or remaining_at_end_s")
            elif remaining is not None and abs(duration - remaining - clear) > TOLERANCE_S:
                problems.append(f"run {rid}: clear_s {clear:g} != duration - remaining_at_end_s ({duration - remaining:g})")
            elif not 0 < clear <= duration:
                problems.append(f"run {rid}: clear_s {clear:g} outside (0, {duration:g}]")
        elif r["outcome"] == "TIME_UP" and remaining not in (None, 0.0):
            problems.append(f"run {rid}: TIME_UP with remaining_at_end_s {remaining:g} (expected 0)")
        r = dict(r, condition=cond, clear_s=(str(clear) if r["outcome"] == "CLEAR" and clear is not None else ""))
        usable.append(r)

    by_id = {r["run_id"]: r for r in usable}
    known = {r.get("run_id") for r in runs}
    by_run: dict[str, list[dict]] = defaultdict(list)
    for p in pizzas:
        rid = p.get("run_id", "")
        if rid not in known:
            problems.append(f"pizza {rid}#{p.get('pizza_seq')}: run_id not in the runs sheet")
            continue
        if rid in by_id:
            by_run[rid].append(dict(p))

    for rid, ps in by_run.items():
        r = by_id[rid]
        duration = num(r["duration_param_s"])
        ps.sort(key=lambda p: num(p.get("pizza_seq")) or 0)
        seqs = [num(p.get("pizza_seq")) for p in ps]
        if seqs != [float(i) for i in range(1, len(ps) + 1)]:
            problems.append(f"run {rid}: pizza_seq must be 1..{len(ps)}, got {[p.get('pizza_seq') for p in ps]}")
        prev = duration
        for i, p in enumerate(ps):
            tag = f"pizza {rid}#{p.get('pizza_seq')}"
            if p.get("category") not in CATEGORIES:
                problems.append(f"{tag}: unknown category {p.get('category')!r}")
            stars = p.get("stars", "")
            if stars and stars not in ("1", "2", "3", "4", "5"):
                problems.append(f"{tag}: stars must be 1..5 or empty, got {stars!r}")
            if p.get("category") == "TARGET_PASS" and stars.isdigit() and int(stars) < BASELINE_MIN_STARS:
                problems.append(f"{tag}: TARGET_PASS with ★{stars} below minStars {BASELINE_MIN_STARS}")
            tid = p.get("target_recipe_id", "")
            if p.get("category") in ("TARGET_PASS", "QUALITY_FAIL", "DUPLICATE_TARGET") and tid not in MISSION_TARGETS[r["mission_id"]]:
                warnings.append(f"{tag}: {p.get('category')} without one of {r['mission_id']}'s targets ({tid!r})")
            rem = num(p.get("remaining_at_result_s"))
            if rem is None and i == len(ps) - 1 and r["outcome"] == "CLEAR" and num(r["clear_s"]) is not None:
                rem = duration - num(r["clear_s"])
                p["remaining_at_result_s"] = f"{rem:g}"
            if rem is None:
                problems.append(f"{tag}: remaining_at_result_s is empty")
                continue
            if rem > prev + TOLERANCE_S or rem < 0:
                problems.append(f"{tag}: remaining {rem:g} s is not within [0, previous {prev:g} s]")
            derived = prev - rem
            given = num(p.get("pizza_s"))
            if given is not None and abs(given - derived) > TOLERANCE_S:
                problems.append(f"{tag}: pizza_s {given:g} != previous remaining - remaining ({derived:g})")
            p["pizza_s"] = f"{derived:g}"
            prev = rem
        passes = [p for p in ps if p.get("category") == "TARGET_PASS"]
        if r["outcome"] == "CLEAR":
            if len(passes) != len(MISSION_TARGETS[r["mission_id"]]):
                problems.append(f"run {rid}: CLEAR with {len(passes)} TARGET_PASS pizzas (expected {len(MISSION_TARGETS[r['mission_id']])})")
            if ps and ps[-1].get("category") != "TARGET_PASS":
                problems.append(f"run {rid}: CLEAR but the last pizza is {ps[-1].get('category')}")
            if num(r["clear_s"]) is not None and ps and abs(duration - num(r["clear_s"]) - num(ps[-1]["remaining_at_result_s"])) > TOLERANCE_S:
                problems.append(f"run {rid}: last pizza remaining does not match clear_s")
        ids = [p.get("target_recipe_id") for p in passes]
        if len(set(ids)) != len(ids):
            problems.append(f"run {rid}: the same target passed twice ({ids}); the second one is DUPLICATE_TARGET")

    for r in usable:
        if not by_run.get(r["run_id"]):
            warnings.append(f"run {r['run_id']}: no pizza rows (per-pizza time, retakes and QUALITY_FAIL unknown)")
    # attempt_index: 1..n per tester x mission x condition, in sheet order.
    seq: dict[tuple, list[float]] = defaultdict(list)
    for r in usable:
        seq[(r["tester_id"], r["mission_id"], r["condition"])].append(num(r.get("attempt_index")) or 0)
    for key, got in seq.items():
        if got != [float(i) for i in range(1, len(got) + 1)]:
            warnings.append(f"attempt_index for {key} is {got}, expected 1..{len(got)}")
    return usable, by_run, problems, warnings, excluded


def run_row(r: dict, ps: list[dict]) -> dict:
    cats = defaultdict(int)
    for p in ps:
        cats[p.get("category")] += 1
    return {
        "run_id": r["run_id"],
        "tester": r["tester_id"],
        "profile": r["tester_profile"],
        "ownerIphone": is_owner_iphone(r),
        "device": r.get("device"),
        "viewport": r.get("viewport_css"),
        "mission": r["mission_id"],
        "condition": r["condition"],
        "durationS": num(r["duration_param_s"]),
        "attemptIndex": int(num(r.get("attempt_index")) or 1),
        "runRetries": max(0, int(num(r.get("attempt_index")) or 1) - 1),
        "outcome": r["outcome"],
        "timeUp": r["outcome"] == "TIME_UP",
        "clearS": num(r["clear_s"]),
        "pizzasMade": len(ps),
        "pizzaRetakes": sum(1 for p in ps if p.get("category") != "TARGET_PASS"),
        "qualityFailCount": cats.get("QUALITY_FAIL", 0),
        "pizzaCategories": dict(cats),
        "pizzaSeconds": [num(p.get("pizza_s")) for p in ps],
        "passStars": [int(p["stars"]) if p.get("stars", "").isdigit() else None for p in ps if p.get("category") == "TARGET_PASS"],
        "completionOrder": [p.get("target_recipe_id") for p in ps if p.get("category") == "TARGET_PASS"],
        "notes": r.get("notes", ""),
    }


def profile_block(rows: list[dict]) -> dict:
    clears = [x["clearS"] for x in rows if x["outcome"] == "CLEAR" and x["clearS"] is not None]
    per_pizza = [s for x in rows for s in x["pizzaSeconds"] if s is not None]
    cats: dict[str, int] = defaultdict(int)
    for x in rows:
        for k, v in x["pizzaCategories"].items():
            cats[k] += v
    stars = [s for x in rows for s in x["passStars"] if s is not None]
    return {
        "runs": len(rows),
        "testers": len({x["tester"] for x in rows}),
        "ownerIphoneRuns": sum(1 for x in rows if x["ownerIphone"]),
        "outcomes": {o: sum(1 for x in rows if x["outcome"] == o) for o in OUTCOMES},
        "retryRuns": sum(1 for x in rows if x["runRetries"] > 0),
        "clearSeconds": dist(clears),
        "pizzaSeconds": dist(per_pizza),
        "pizzaRetakes": sum(x["pizzaRetakes"] for x in rows),
        "pizzaCategories": dict(cats),
        "qualityFailCount": cats.get("QUALITY_FAIL", 0),
        "passStars": dict(sorted((s, stars.count(s)) for s in set(stars))),
    }


def summarize(runs: list[dict], pizzas: list[dict]) -> dict:
    usable, by_run, problems, warnings, excluded = validate(runs, pizzas)
    rows = [run_row(r, by_run.get(r["run_id"], [])) for r in usable]
    out: dict = {
        "evidenceClass": EVIDENCE_CLASS,
        "note": "HUMAN rows only. 320 / 355 s and S=3 are the OD-DM5-2 / OD-DM5-1 validation baseline, not final values. "
                "Tier candidates are options for the Owner (OD-DM5-3), not decisions.",
        "problems": problems,
        "warnings": warnings,
        "excluded": excluded,
        "runs": rows,
        "missions": {},
        "auxiliaryUncensored": {},
    }
    for mission in sorted(MISSION_TARGETS):
        limit = BASELINE_LIMIT_S[mission]
        base = [x for x in rows if x["mission"] == mission and x["condition"] == "BASELINE"]
        aux = [x for x in rows if x["mission"] == mission and x["condition"] == "AUX_900"]
        if base:
            per_profile = {prof: profile_block([x for x in base if x["profile"] == prof]) for prof in PROFILES}
            exp_clears = [x["clearS"] for x in base if x["profile"] == "experienced" and x["outcome"] == "CLEAR" and x["clearS"] is not None]
            ended = [x for x in base if x["outcome"] in ("CLEAR", "TIME_UP")]
            gate = {
                prof: per_profile[prof]["clearSeconds"]["n"] >= MIN_CLEAR_RUNS_PER_PROFILE
                and per_profile[prof]["testers"] >= MIN_TESTERS_PER_PROFILE
                for prof in PROFILES
            }
            gate["ownerIphone"] = any(per_profile[p]["ownerIphoneRuns"] > 0 for p in PROFILES)
            out["missions"][mission] = {
                "condition": f"BASELINE {limit} s / ★{BASELINE_MIN_STARS}",
                "perProfile": per_profile,
                "baselineLimitS": limit,
                # Share of runs that ran out of time at the baseline (TIME_UP / (CLEAR + TIME_UP)).
                "baselineTimeUpShare": round(sum(1 for x in ended if x["timeUp"]) / len(ended), 2) if ended else None,
                # OPTIONS ONLY (OD-DM5-3): candidate tier rules evaluated on the BASELINE sample only.
                # Beginner clears at the baseline are right-censored at the limit (TIME_UP runs have no time).
                "tierCandidates": {
                    "TC-1 (GOLD=experienced median, SILVER=normal median, BRONZE=limit)": {
                        "goldS": per_profile["experienced"]["clearSeconds"]["median"],
                        "silverS": per_profile["normal"]["clearSeconds"]["median"],
                        "bronzeS": limit,
                    },
                    "TC-2 (GOLD=experienced p25, SILVER=normal p25, BRONZE=beginner p90, censored)": {
                        "goldS": per_profile["experienced"]["clearSeconds"]["p25"],
                        "silverS": per_profile["normal"]["clearSeconds"]["p25"],
                        "bronzeS": per_profile["beginner"]["clearSeconds"]["p90"],
                    },
                },
                # OD-DM4-1 invariant: the most a repeat clear may pay so that the fastest measured
                # experienced clear still earns no more per minute than Lunch Rush's ceiling.
                "repeatPayoutCapPitz": int(LUNCH_RUSH_MAX_PITZ_PER_MIN * min(exp_clears) / 60) if exp_clears else None,
                "gate": gate,
                "gatePass": all(gate.values()),
            }
        if aux:
            clears = [x["clearS"] for x in aux if x["outcome"] == "CLEAR" and x["clearS"] is not None]
            ended = [x for x in aux if x["outcome"] in ("CLEAR", "TIME_UP")]
            out["auxiliaryUncensored"][mission] = {
                "label": "AUX_900 — beginner censored / time-distribution observation ONLY. NOT a balance sample: "
                         "excluded from the gate, tier candidates, TIME_UP share and repeat cap.",
                "durationS": AUX_DURATION_S,
                "runs": len(aux),
                "testers": len({x["tester"] for x in aux}),
                "outcomes": {o: sum(1 for x in aux if x["outcome"] == o) for o in OUTCOMES},
                "clearSeconds": dist(clears),
                "pizzaSeconds": dist([s for x in aux for s in x["pizzaSeconds"] if s is not None]),
                "qualityFailCount": sum(x["qualityFailCount"] for x in aux),
                # Would this run have ended TIME_UP at the baseline? (clear later than the limit, or TIME_UP at 900)
                "wouldTimeUpAtBaselineShare": (
                    round(sum(1 for x in ended if x["timeUp"] or x["clearS"] > limit) / len(ended), 2) if ended else None
                ),
                "baselineLimitS": limit,
            }
    missions = out["missions"]
    out["gatePass"] = bool(missions) and set(missions) == set(MISSION_TARGETS) and all(m["gatePass"] for m in missions.values())
    return out


HEADER_RUNS = ",".join(RUN_COLS)
HEADER_PIZZAS = ",".join(PIZZA_COLS)
SELF_TEST_RUNS = HEADER_RUNS + """
r1,t1,experienced,yes,iPhone,Safari,390x844,x,dm-a,320,3,1,CLEAR,240,,,HUMAN
r2,t1,experienced,yes,iPhone,Safari,390x844,x,dm-a,320,3,2,CLEAR,230,,,HUMAN
r3,t1,experienced,yes,iPhone,Safari,390x844,x,dm-a,320,3,3,CLEAR,236,,,HUMAN
r4,t2,beginner,no,Android,Chrome,360x800,x,dm-a,320,3,1,TIME_UP,0,,,HUMAN
r5,t2,beginner,no,Android,Chrome,360x800,x,dm-a,900,3,1,CLEAR,500,,,HUMAN
m1,model,experienced,no,iPhone,-,390x844,-,dm-a,320,3,1,CLEAR,300,,KLM model row,MODEL
a1,pw,experienced,no,Chromium,-,390x844,-,dm-a,320,3,1,CLEAR,310,,scripted run,AUTOMATED
x1,t3,normal,no,iPhone,Safari,390x844,x,dm-a,900,3,1,CLEAR,700,,,HUMAN
"""
SELF_TEST_PIZZAS = HEADER_PIZZAS + """
r1,1,300,20,TARGET_PASS,4,funghi,
r1,2,280,20,QUALITY_FAIL,2,bismarck,
r1,3,262,,TARGET_PASS,3,bismarck,
r1,4,250,,TARGET_PASS,3,margherita,
r1,5,,,TARGET_PASS,,breakfast-pizza,
"""


def self_test() -> None:
    out = summarize(read_csv(SELF_TEST_RUNS), read_csv(SELF_TEST_PIZZAS))
    a = out["missions"]["dm-a"]
    exp = a["perProfile"]["experienced"]
    # Only the 5 HUMAN in-protocol rows are read; MODEL / AUTOMATED / off-protocol are excluded.
    assert [x["run_id"] for x in out["runs"]] == ["r1", "r2", "r3", "r4", "r5"], out["runs"]
    assert {e["run_id"]: e["reason"] for e in out["excluded"]} == {
        "m1": "EVIDENCE_CLASS_MODEL", "a1": "EVIDENCE_CLASS_AUTOMATED", "x1": "OFF_PROTOCOL"}, out["excluded"]
    assert out["problems"] == [
        "run x1: off protocol (dm-a 900 s, ★3, normal); BASELINE = DM-A 320 / DM-B 355 with ★3, AUX_900 = beginner only"
    ], out["problems"]
    assert exp["clearSeconds"]["median"] == 84.0 and exp["clearSeconds"]["min"] == 80.0
    assert exp["retryRuns"] == 2 and exp["qualityFailCount"] == 1 and exp["pizzaRetakes"] == 1
    r1 = out["runs"][0]
    # Last pizza of a CLEAR: remaining derived from clear_s (320 - 80 = 240 → 10 s pizza).
    assert r1["pizzaSeconds"] == [20.0, 20.0, 18.0, 12.0, 10.0], r1["pizzaSeconds"]
    assert r1["completionOrder"] == ["funghi", "bismarck", "margherita", "breakfast-pizza"]
    assert r1["passStars"] == [4, 3, 3, None]
    # The AUX_900 beginner clear is NOT in the balance sample...
    assert a["perProfile"]["beginner"]["runs"] == 1 and a["perProfile"]["beginner"]["clearSeconds"]["n"] == 0
    assert a["baselineTimeUpShare"] == 0.25  # 1 TIME_UP of 4 BASELINE runs
    # ...only under auxiliaryUncensored: 400 s > 320 s would have been TIME_UP at the baseline.
    aux = out["auxiliaryUncensored"]["dm-a"]
    assert aux["clearSeconds"]["median"] == 400.0 and aux["wouldTimeUpAtBaselineShare"] == 1.0
    assert a["repeatPayoutCapPitz"] == int(140 / 3 * 80 / 60)  # 62
    assert a["gate"]["experienced"] is True and a["gate"]["beginner"] is False and a["gatePass"] is False
    assert a["gate"]["ownerIphone"] is True and out["gatePass"] is False
    assert any("r2: no pizza rows" in w for w in out["warnings"])

    # Consistency checks catch transcription slips.
    bad = summarize(read_csv(HEADER_RUNS + "\nb1,t1,experienced,yes,iPhone,S,390x844,x,dm-b,355,3,1,CLEAR,100,200,,HUMAN\n"),
                    read_csv(HEADER_PIZZAS + "\nb1,1,300,,TARGET_PASS,2,funghi,\nb1,2,310,,QUALITY_FAIL,,melanzane-pizza,\n"))
    joined = " | ".join(bad["problems"])
    for needle in ("clear_s 200 != duration - remaining_at_end_s (255)", "TARGET_PASS with ★2", "remaining 310 s is not within",
                   "CLEAR with 1 TARGET_PASS", "CLEAR but the last pizza is QUALITY_FAIL"):
        assert needle in joined, (needle, bad["problems"])

    # The recorder's pasted bundle splits back into the two sheets.
    runs_text, pizzas_text = split_bundle("# DM-5-1 HUMAN timing (x) -- runs.csv\n" + SELF_TEST_RUNS + "# pizzas.csv\n" + SELF_TEST_PIZZAS)
    assert summarize(read_csv(runs_text), read_csv(pizzas_text)) == out
    print("self-test OK (synthetic rows only; not measurement data)")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs")
    ap.add_argument("--pizzas")
    ap.add_argument("--bundle", help="the recorder's pasted text (both sheets)")
    ap.add_argument("--split-to", help="with --bundle: also write runs.csv / pizzas.csv into this directory")
    ap.add_argument("--strict", action="store_true", help="exit 1 when any problem is found")
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()
    if args.self_test:
        self_test()
        return
    if args.bundle:
        with open(args.bundle, encoding="utf-8") as f:
            runs_text, pizzas_text = split_bundle(f.read())
        if args.split_to:
            os.makedirs(args.split_to, exist_ok=True)
            for name, text in (("runs.csv", runs_text), ("pizzas.csv", pizzas_text)):
                with open(os.path.join(args.split_to, name), "w", encoding="utf-8") as f:
                    f.write(text)
    elif args.runs and args.pizzas:
        with open(args.runs, encoding="utf-8") as f:
            runs_text = f.read()
        with open(args.pizzas, encoding="utf-8") as f:
            pizzas_text = f.read()
    else:
        ap.error("--runs and --pizzas (or --bundle, or --self-test) are required")
    out = summarize(read_csv(runs_text), read_csv(pizzas_text))
    print(json.dumps(out, ensure_ascii=False, indent=1))
    if args.strict and out["problems"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
