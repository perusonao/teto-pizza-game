#!/usr/bin/env python3
"""Issue #256 Implementation Gate: Lunch Rush run-score impact of skipping CUT on a bake failure.

Deterministic Monte Carlo (seeded). Nothing here is read by the game.

Production rules (src/shared/lunchRushScoring.ts, src/mission/lunchRush.ts, App.tsx):
  - run = 180 s (LUNCH_RUSH_RULESET_DURATION_SECONDS); a serve counts only if it lands before the end;
  - score = round(passCount * 100 + sum(qualityTotal of PASS serves)); a FAILED serve adds 0;
  - a FAILED pizza still consumes its order and the clock (the run moves on to the next order).
#256 (OD-CUT256-1) changes one thing: a Completion-Gate UNDERBAKED / OVERBAKED pizza of a CUT
recipe no longer spends the CUT step, so that attempt is `cut_s` seconds shorter. Nothing else
(formula, gate, duration, serve log) changes.

Inputs marked (A) are assumptions, not measurements:
  - per-pizza cycle and CUT seconds per player profile: DM-4/DM-5 Fresh Audit model
    (branch claude/dinner-mission-dm4-dm5-audit-0dotex, tools/dinner-dm5/dm5_balance_model.py,
    margherita row: 18.9 / 29.9 / 50.1 s; CUT 2.1 / 3.0 / 4.8 s) -- KLM-based, not human telemetry;
  - quality of a PASS pizza (qualityTotal);
  - bake-failure rate p (independent per pizza).
(M) measured in this gate (tools/cut256_cut_timing.spec.ts, main 51e0923, Chromium 390x844): the CUT
UI floor (3 automated drags + confirm -> result) is ~0.5 s; confirm -> result ~0.1 s.

Usage: python3 tools/cut256_lunch_rush_impact.py [--out docs/reports/data/...json] [--check]
"""
import argparse
import json
import random
import sys

RUN_S = 180.0
RUNS = 20000
SEED = 256

PROFILES = {  # (A) cycle_s includes the CUT step; cut_s is the part #256 removes on a bake failure
    "EXPERT": {"cycle_s": 18.9, "cut_s": 2.1, "quality": 85},
    "AVERAGE": {"cycle_s": 29.9, "cut_s": 3.0, "quality": 75},
    "BEGINNER": {"cycle_s": 50.1, "cut_s": 4.8, "quality": 65},
}
FAIL_RATES = [0.0, 0.05, 0.10, 0.20, 0.30]
JITTERS = [0.0, 0.2]  # (A) per-pizza cycle sd as a fraction of the mean (0 = the discrete lower bound)


def one_run(rng: random.Random, cycle: float, cut: float, quality: int, p: float, skip: bool, jitter: float) -> tuple[int, int, int]:
    t = 0.0
    passes = fails = 0
    while True:
        failed = rng.random() < p
        # Two draws per pizza in both rules, so the same run sees the same pizzas (common random numbers).
        this_cycle = max(0.5 * cycle, cycle * (1 + rng.gauss(0, jitter))) if jitter else cycle
        if not jitter:
            rng.random()
        dt = this_cycle - cut if (failed and skip) else this_cycle
        if t + dt >= RUN_S:
            break
        t += dt
        if failed:
            fails += 1
        else:
            passes += 1
    return round(passes * 100 + passes * quality), passes, fails


def simulate() -> dict:
    out = {"runSeconds": RUN_S, "cycleJitters": JITTERS, "runs": RUNS, "seed": SEED, "profiles": PROFILES, "rows": []}
    for name, prof in PROFILES.items():
        for jitter, p in [(j, q) for j in JITTERS for q in FAIL_RATES]:
            # Common random numbers: the same failure sequence for both rules in each run.
            deltas, cur_scores, new_scores, fails = [], [], [], []
            for i in range(RUNS):
                a = one_run(random.Random(SEED * 1_000_003 + i), prof["cycle_s"], prof["cut_s"], prof["quality"], p, False, jitter)
                b = one_run(random.Random(SEED * 1_000_003 + i), prof["cycle_s"], prof["cut_s"], prof["quality"], p, True, jitter)
                cur_scores.append(a[0])
                new_scores.append(b[0])
                deltas.append(b[0] - a[0])
                fails.append(a[2])
            mean_cur = sum(cur_scores) / RUNS
            mean_new = sum(new_scores) / RUNS
            out["rows"].append({
                "profile": name,
                "cycleJitter": jitter,
                "bakeFailRate": p,
                "meanFailedPizzas": round(sum(fails) / RUNS, 3),
                "meanScoreCurrent": round(mean_cur, 1),
                "meanScoreSkip": round(mean_new, 1),
                "meanDelta": round(mean_new - mean_cur, 1),
                "meanDeltaPct": round(100 * (mean_new - mean_cur) / mean_cur, 2) if mean_cur else 0.0,
                "runsImproved": round(sum(1 for d in deltas if d > 0) / RUNS, 4),
                "runsWorse": round(sum(1 for d in deltas if d < 0) / RUNS, 4),
                "maxDelta": max(deltas),
                "bestScoreCurrent": max(cur_scores),
                "bestScoreSkip": max(new_scores),
            })
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out")
    ap.add_argument("--check", action="store_true", help="fail if --out differs from a fresh run")
    args = ap.parse_args()
    data = simulate()
    text = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    if args.check:
        if not args.out or open(args.out, encoding="utf-8").read() != text:
            sys.exit("cut256_lunch_rush_impact: output drifted")
        print("OK")
        return
    if args.out:
        open(args.out, "w", encoding="utf-8").write(text)
    for r in data["rows"]:
        print(f"{r['profile']:8} j={r['cycleJitter']:.1f} p={r['bakeFailRate']:.2f} fails={r['meanFailedPizzas']:5.2f} "
              f"score {r['meanScoreCurrent']:7.1f} -> {r['meanScoreSkip']:7.1f} "
              f"(+{r['meanDelta']:5.1f}, {r['meanDeltaPct']:5.2f}%) improved={r['runsImproved']:.3f} "
              f"worse={r['runsWorse']:.3f} max+{r['maxDelta']} best {r['bestScoreCurrent']}->{r['bestScoreSkip']}")


if __name__ == "__main__":
    main()
