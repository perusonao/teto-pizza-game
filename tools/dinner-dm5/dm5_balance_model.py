#!/usr/bin/env python3
"""Dinner Mission DM-4 / DM-5 Fresh Audit — balance model (docs/data/tools only).

Reads the measurement JSON Lines written by ./measure.play.ts (run against PR #252's head) and
produces the DM-5 balance matrix: per-pizza and per-mission clear-time estimates for three
player profiles, time-limit / tier-threshold option sets, ★ (minimumStars) pass rates by effort,
and reward options priced against the existing FREE / Lunch Rush economy.

Nothing here is a production value. Every constant is either
  (M) measured by ./measure.play.ts,
  (C) copied from the code at the audited SHA (the source is named next to it), or
  (A) an assumption — a human-operator time from keystroke-level modelling. (A) values are the
      ones DM-5's human calibration run must replace (see the report, DM-5 slice 5-1).

Usage:
  python3 tools/dinner-dm5/dm5_balance_model.py \
      --measure docs/reports/data/TETO_DINNER-MISSION_DM4-DM5_measure.jsonl \
      --out docs/reports/data/TETO_DINNER-MISSION_DM4-DM5_balance-matrix.json
"""

from __future__ import annotations

import argparse
import json
import statistics
from collections import defaultdict

# ---------------------------------------------------------------------------------------------
# (C) Code constants at the audited SHA
# ---------------------------------------------------------------------------------------------
BAKE_NEEDLE_PCT_PER_S = 55  # src/components/BakeOverlay.tsx SPEED
BAKE_FULL_CYCLE_S = 200 / BAKE_NEEDLE_PCT_PER_S  # 0 -> 100 -> 0
SAUCE_RATE_PER_S = 0.02 / 0.050  # src/logic/sauceQuantity.ts: 0.02 per 50 ms tick
REFERENCE_SAUCE_QTY = 0.92  # src/data/referencePizza.ts margherita reference quantity
SAUCE_MIN_HOLD_S = REFERENCE_SAUCE_QTY / SAUCE_RATE_PER_S  # 2.3 s
FREE_BASE_REWARD = 100  # recipes.ts baseRewardPitz (all DM-A / DM-B targets)
FREE_MULTIPLIER = {1: 0.0, 2: 0.5, 3: 0.8, 4: 1.0, 5: 1.2}  # src/logic/pitzReward.ts bands
FREE_FLOOR = 20  # PITZ_QUALITY_FLOOR
CT2_GOOD_RATE = {5: 0.10, 4: 0.06, 3: 0.03, 2: 0.0, 1: 0.0}  # src/logic/efficiency.ts (GOOD tier)
LUNCH_RUSH_RUN_S = 180  # src/mission/lunchRush.ts
LUNCH_RUSH_MAX_PITZ = 140  # src/logic/economy.ts calculateMissionReward ceiling
# Material refill cost of one clean clear (minCount exactly), T1 refill 30 Pitz per pack of 10*k.
# From docs/reports/data/TETO_DINNER-MISSION_PHASE0_mission-candidates.json (recipes / shop /
# ladder unchanged on main since 42feec7: `git log 42feec7..origin/main -- src/data/recipes.ts
# src/logic/materialShop.ts src/data/discoveryLadder.ts` is empty).
MISSIONS = {
    "dm-a": {"targets": ["margherita", "bismarck", "breakfast-pizza", "funghi"], "refillCostPitz": 12.0,
             "finiteNeed": {"egg": 2, "bacon": 3, "mushroom": 3}},
    "dm-b": {"targets": ["margherita", "funghi", "melanzane-pizza", "parmigiana-pizza"], "refillCostPitz": 12.0,
             "finiteNeed": {"mushroom": 3, "eggplant": 6, "parmigiano": 2}},
}
PER_UNIT_REFILL = {"egg": 3.0, "bacon": 1.0, "mushroom": 1.0, "eggplant": 1.0, "parmigiano": 1.5}

# ---------------------------------------------------------------------------------------------
# (A) Human operator times, seconds. Keystroke-level model (Card, Moran & Newell): M = 1.35 s
# mental preparation; touch pointing per Fitts' law on a 390-wide phone lands between ~0.4 s
# (practised, large target) and ~1.1 s (novice, small target, reference glance). These are the
# numbers DM-5 slice 5-1 replaces with the Owner's measured iPhone runs.
# ---------------------------------------------------------------------------------------------
PROFILES = {
    "EXPERT": {
        "plan": 1.5, "dough_tap": 0.25, "sauce_hold": 2.6, "chip": 0.7, "page_flip": 0.5, "piece": 0.45,
        "cta": 0.5, "bake_react": 0.3, "bake_miss": 0.05, "cut_drag": 0.7, "result": 1.0, "remake_rate": 0.02,
        "sauce_mode": "SPIRAL", "variant": "REFERENCE",
    },
    "AVERAGE": {
        "plan": 4.0, "dough_tap": 0.35, "sauce_hold": 3.5, "chip": 1.2, "page_flip": 0.8, "piece": 0.7,
        "cta": 0.8, "bake_react": 0.4, "bake_miss": 0.20, "cut_drag": 1.0, "result": 2.0, "remake_rate": 0.10,
        "sauce_mode": "SPIRAL", "variant": "CARELESS",
    },
    "BEGINNER": {
        "plan": 8.0, "dough_tap": 0.5, "sauce_hold": 5.0, "chip": 2.0, "page_flip": 1.2, "piece": 1.1,
        "cta": 1.2, "bake_react": 0.5, "bake_miss": 0.40, "cut_drag": 1.6, "result": 3.5, "remake_rate": 0.25,
        "sauce_mode": "TAPS", "variant": "CARELESS",
    },
}

TIER_ORDER = ["GOLD", "SILVER", "BRONZE"]


def load(path: str) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def per_recipe_structure(rows: list[dict]) -> dict:
    """(M) op counts, needle time, UI floor and ★ per recipe / variant / sauce mode."""
    out: dict = defaultdict(lambda: defaultdict(list))
    for r in rows:
        key = (r["recipeId"], r["variant"], r.get("sauceMode", "TAPS"), r["bakeMode"], r.get("spiralHoldMs"))
        out[r["recipeId"]][key].append(r)
    return out


def pieces_of(row: dict) -> int:
    return sum(row["placed"].values())


def pizza_time(recipe_rows: list[dict], prof: dict) -> dict:
    """Seconds for one pizza of this recipe for one profile (first-try, no remake)."""
    ref = next((r for r in recipe_rows if r["variant"] == prof["variant"] and r.get("sauceMode", "TAPS") == prof["sauce_mode"]
                and r["bakeMode"] == "CENTER"), recipe_rows[0])
    ops = ref["ops"]
    pieces = pieces_of(ref)
    # UI floor: median automation ms of the non-sauce, non-bake steps (render / transition latency).
    floor_s = statistics.median(
        (r["ms"]["dough"] + r["ms"]["cheese"] + r["ms"]["topping"] + r["ms"]["cut"]) / 1000 for r in recipe_rows
    )
    needle_s = ref["bakeNeedleMs"] / 1000
    parts = {
        "plan": prof["plan"],
        "dough": 8 * prof["dough_tap"],
        "sauce": max(SAUCE_MIN_HOLD_S, prof["sauce_hold"]) if prof["sauce_mode"] == "SPIRAL" else 16 * prof["dough_tap"],
        "chips": ops["chipSelects"] * prof["chip"] + ops["pageFlips"] * prof["page_flip"],
        "pieces": pieces * prof["piece"],
        "ctas": ops["ctas"] * prof["cta"],
        "bake": needle_s + prof["bake_react"] + prof["bake_miss"] * BAKE_FULL_CYCLE_S,
        "cut": 3 * prof["cut_drag"],
        "result": prof["result"],
        "uiFloor": floor_s,
    }
    parts = {k: round(v, 2) for k, v in parts.items()}
    return {"seconds": round(sum(parts.values()), 1), "parts": parts, "pieces": pieces, "ops": ops}


def star_table(rows: list[dict]) -> dict:
    table: dict = defaultdict(dict)
    for r in rows:
        mode = r.get("sauceMode", "TAPS") + (f"@{r['spiralHoldMs']}ms" if r.get("spiralHoldMs") else "")
        key = f"{r['variant']}/{mode}/bake={r['bakeMode']}"
        table[r["recipeId"]].setdefault(key, []).append(r["stars"] if r["category"] == "TARGET_PASS" else 0)
    return {rid: {k: sorted(set(v)) for k, v in sorted(d.items())} for rid, d in table.items()}


def free_income(stars: int) -> int:
    base = max(FREE_FLOOR, round(FREE_BASE_REWARD * FREE_MULTIPLIER[stars]))
    return base + round(FREE_BASE_REWARD * CT2_GOOD_RATE[stars])


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--measure", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    rows = load(args.measure)
    by_recipe = per_recipe_structure(rows)

    # --- per pizza / per mission time -----------------------------------------------------
    pizza: dict = {}
    for rid, groups in by_recipe.items():
        recipe_rows = [r for g in groups.values() for r in g]
        pizza[rid] = {p: pizza_time(recipe_rows, prof) for p, prof in PROFILES.items()}

    missions: dict = {}
    for mid, m in MISSIONS.items():
        per_profile = {}
        for p, prof in PROFILES.items():
            clean = sum(pizza[t][p]["seconds"] for t in m["targets"])
            avg = clean / len(m["targets"])
            expected = clean + prof["remake_rate"] * len(m["targets"]) * avg
            per_profile[p] = {"cleanClearS": round(clean, 1), "expectedClearS": round(expected, 1)}
        missions[mid] = per_profile

    # --- time limit / tier options ----------------------------------------------------------
    def rnd5(x: float) -> int:
        return int(5 * round(x / 5))

    options = {}
    for mid, per in missions.items():
        e, a, b = (per[p]["expectedClearS"] for p in ("EXPERT", "AVERAGE", "BEGINNER"))
        options[mid] = {
            "T-1 generous (limit = 1.25 x BEGINNER expected)": {
                "limitS": rnd5(1.25 * b), "goldS": rnd5(1.15 * e), "silverS": rnd5(1.1 * a), "bronzeS": rnd5(1.25 * b),
            },
            "T-2 standard (limit = BEGINNER expected)": {
                "limitS": rnd5(b), "goldS": rnd5(1.1 * e), "silverS": rnd5(a), "bronzeS": rnd5(b),
            },
            "T-3 tight (limit = 1.2 x AVERAGE expected)": {
                "limitS": rnd5(1.2 * a), "goldS": rnd5(e), "silverS": rnd5(0.9 * a), "bronzeS": rnd5(1.2 * a),
            },
        }
    for mid, opts in options.items():
        for name, o in opts.items():
            o["whoClears"] = {
                p: next((t for t in TIER_ORDER if missions[mid][p]["expectedClearS"] <= o[t.lower() + "S"]),
                        "CLEAR" if missions[mid][p]["expectedClearS"] <= o["limitS"] else "TIME_UP")
                for p in PROFILES
            }

    # --- reward options vs existing income -----------------------------------------------------
    income = {
        "FREE per pizza (★3 / ★4 / ★5, incl. CT2 GOOD)": {s: free_income(s) for s in (3, 4, 5)},
        "Lunch Rush max per run": LUNCH_RUSH_MAX_PITZ,
        "Lunch Rush max per minute": round(LUNCH_RUSH_MAX_PITZ / (LUNCH_RUSH_RUN_S / 60), 1),
    }
    reward_options = {
        "RW-A improvement-only (Phase 0 RW-3)": {
            "firstClear": {"clear": 150, "tierBonus": {"GOLD": 150, "SILVER": 75, "BRONZE": 25}},
            "repeatClear": {"clear": 0, "tierBonus": {"GOLD": 0, "SILVER": 0, "BRONZE": 0}},
            "tierUpgrade": "pay the difference of tierBonus when best tier improves",
        },
        "RW-B material-plus repeat": {
            "firstClear": {"clear": 150, "tierBonus": {"GOLD": 100, "SILVER": 50, "BRONZE": 20}},
            "repeatClear": {"clear": 30, "tierBonus": {"GOLD": 30, "SILVER": 15, "BRONZE": 5}},
            "tierUpgrade": "none (repeat schedule already pays tier)",
        },
        "RW-C FREE parity repeat": {
            "firstClear": {"clear": 200, "tierBonus": {"GOLD": 150, "SILVER": 75, "BRONZE": 25}},
            "repeatClear": {"clear": 240, "tierBonus": {"GOLD": 80, "SILVER": 40, "BRONZE": 0}},
            "tierUpgrade": "none",
        },
    }
    # Pitz per minute of a repeat clear, per profile, using T-2 tiers of dm-a, minus material cost.
    per_min = {}
    for name, ro in reward_options.items():
        per_min[name] = {}
        for p in PROFILES:
            tier = options["dm-a"]["T-2 standard (limit = BEGINNER expected)"]["whoClears"][p]
            rep = ro["repeatClear"]
            pay = rep["clear"] + rep["tierBonus"].get(tier, 0) if tier != "TIME_UP" else 0
            secs = missions["dm-a"][p]["expectedClearS"]
            cost = MISSIONS["dm-a"]["refillCostPitz"] * (1 + PROFILES[p]["remake_rate"])
            per_min[name][p] = {"tier": tier, "repeatPitz": pay, "netPerMin": round((pay - cost) / (secs / 60), 1)}
    free_per_min = {}
    for p in PROFILES:
        secs = statistics.mean(pizza[t][p]["seconds"] for t in MISSIONS["dm-a"]["targets"])
        stars = {"EXPERT": 4, "AVERAGE": 3, "BEGINNER": 3}[p]
        free_per_min[p] = round((free_income(stars) - 3) / (secs / 60), 1)

    result = {
        "note": "Model output, not production values. (M)=measured, (C)=code, (A)=assumption; see the tool header.",
        "constants": {
            "sauceMinHoldS": round(SAUCE_MIN_HOLD_S, 2), "bakeFullCycleS": round(BAKE_FULL_CYCLE_S, 2),
            "profiles": PROFILES,
        },
        "measuredStars": star_table(rows),
        "perPizzaSeconds": pizza,
        "missionClearSeconds": missions,
        "timeLimitOptions": options,
        "existingIncome": income,
        "freeNetPitzPerMinute": free_per_min,
        "rewardOptions": reward_options,
        "dinnerRepeatNetPitzPerMinute_dmA_T2": per_min,
    }
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(json.dumps({"missionClearSeconds": missions, "timeLimitOptions": options, "freeNetPitzPerMinute": free_per_min,
                      "dinnerRepeatNetPitzPerMinute_dmA_T2": per_min}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
