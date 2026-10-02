#!/usr/bin/env python3
"""OD-03 / R-02 decision-brief model (docs-only, read-only).

Rebuilds docs/reports/data/PROGRESSION-2.0_OD-03_Option-Comparison.json from:
  - docs/design/data/TETO_PROGRESSION2_PHASE34_INGREDIENT-UNLOCK-MATRIX.json (authority, PR #196)
  - docs/design/data/TETO_PROGRESSION2_PHASE2_UNLOCK-MATRIX.json (reward table)
  - src/data/recipes.ts / src/data/ingredients.ts / src/data/discoveryCatalog.ts (production)

It does not choose an option and does not change any value. Option C cap values are
ILLUSTRATIVE placeholders (the Option B formula value) only, so the effect of a special case can be
sized; the actual value is an owner decision.

Stars follow the Phase 3-4A rule (PR #205, unmerged): each discovered recipe contributes
max(BEST, 2). Reachability ignores Pitz (Pitz can always be ground on Margherita, which uses the
unlimited starter trio), except in the walkthroughs, which simulate Pitz explicitly.

Usage: python3 docs/reports/data/PROGRESSION-2.0_OD-03_option_model.py [--check]
"""
import json
import math
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
P34 = ROOT / "docs/design/data/TETO_PROGRESSION2_PHASE34_INGREDIENT-UNLOCK-MATRIX.json"
P2 = ROOT / "docs/design/data/TETO_PROGRESSION2_PHASE2_UNLOCK-MATRIX.json"
OUT = ROOT / "docs/reports/data/PROGRESSION-2.0_OD-03_Option-Comparison.json"
STARTERS = ("basil", "mozzarella", "tomato-sauce")
T1 = ("aussie-pizzadb", "pizza-portuguesa-pizzadb-p9", "brazilian-calabresa-pizzadb-p10")
PROFILES = {"lowScore_1": 1, "beginner_2": 2, "standard_3": 3, "skilled_4": 4, "perfect_5": 5}
MILESTONES = (2, 6, 10, 14, 18, 22, 28, 32, 40, 44, 48, 56, 65, 76, 102)


def parse_production():
    src = (ROOT / "src/data/recipes.ts").read_text()
    recipes = {}
    for block in re.split(r"\n  \{\n", src)[1:]:
        m = re.search(r'^\s*id: "([^"]+)"', block, re.M)
        if not m:
            continue
        req = re.search(r"requiredIngredients: \[(.*?)\]", block, re.S)
        recipes[m.group(1)] = re.findall(r'ingredientId: "([^"]+)"', req.group(1))
    ing = re.findall(r'^    id: "([^"]+)"', (ROOT / "src/data/ingredients.ts").read_text(), re.M)
    cat = (ROOT / "src/data/discoveryCatalog.ts").read_text()
    overrides = dict(re.findall(r'^\s*"([a-z-]+)": "([a-z0-9-]+)",', cat, re.M))
    target = {r: overrides.get(r, f"shipped:{r}") for r in recipes}
    return recipes, ing, target


def gate_of(row):
    for c in row["unlockCondition"].get("all", []):
        if c["type"] == "CUMULATIVE_STARS":
            return c["minimum"]
    return 0


def main():
    p34 = json.loads(P34.read_text())
    reward_tbl = json.loads(P2.read_text())["rewardTables"]["FLOOR_DISCOVERY_BONUS"]
    rows = p34["rows"]
    row = {r["nodeId"]: r for r in rows}
    frac = p34["policy"]["gateFraction"]
    spd_min = p34["policy"]["gateStarsPerDiscovery"]
    step = {}
    for r in rows:
        m = re.search(r"Phase-2 step (\d+)", r["rationale"])
        step[r["nodeId"]] = int(m.group(1)) if m else 0
    reach_step = {t: step[r["nodeId"]] for r in rows for t in r["newlyReachableRecipeIds"]}
    reach_seq = {t: r["sequence"] for r in rows for t in r["newlyReachableRecipeIds"]}

    recipes, prod_ing, target = parse_production()
    assert len(recipes) == 15 and len(prod_ing) == 22, (len(recipes), len(prod_ing))
    for rid, t in target.items():
        assert t in reach_step, (rid, t)
    prod_nodes = sorted(set(i for items in recipes.values() for i in items))
    assert set(prod_nodes) <= set(prod_ing)

    def formula_gate(node, pool_targets):
        """G4_HYBRID_060 gate for `node` if the discoverable pool were `pool_targets`."""
        before = sum(1 for t in pool_targets if reach_step[t] < step[node])
        return spd_min * math.ceil(before * frac)

    # Sanity: over the full 101 pool the formula reproduces every authority gate exactly.
    all_targets = list(reach_step)
    formula_mismatch = [r["nodeId"] for r in rows
                        if r["conditionType"] == "CUMULATIVE_STARS" and formula_gate(r["nodeId"], all_targets) != gate_of(r)]
    assert not formula_mismatch, formula_mismatch

    authority = {n: gate_of(row[n]) for n in prod_nodes}
    pool15 = [target[r] for r in recipes]
    pool18 = pool15 + list(T1)
    option_b15 = {n: (0 if n in STARTERS else formula_gate(n, pool15)) for n in prod_nodes}
    option_b18 = {n: (0 if n in STARTERS else formula_gate(n, pool18)) for n in prod_nodes}

    def reach(gates, per):
        """Fixed point of discovery with a constant max(BEST,2) per discovery; Pitz ignored."""
        owned, disc = set(STARTERS), []
        while True:
            stars = per * len(disc)
            owned |= {n for n in prod_nodes if gates[n] <= stars}
            new = [r for r in recipes if r not in disc and all(i in owned for i in recipes[r])]
            if not new:
                break
            disc += sorted(new, key=lambda r: reach_seq[target[r]])
        stuck = [r for r in recipes if r not in disc]
        stars = per * len(disc)
        blockers = sorted({(i, gates[i]) for r in stuck for i in recipes[r] if gates[i] > stars}, key=lambda x: (x[1], x[0]))
        return {"discovered": len(disc), "finalStars": stars, "order": disc,
                "notReachable": sorted(stuck, key=lambda r: reach_seq[target[r]]),
                "firstBlockingGate": None if not blockers else {"ingredientId": blockers[0][0], "gate": blockers[0][1]},
                "blockingGates": [{"ingredientId": i, "gate": g} for i, g in blockers]}

    # Option C: authority gates, except ingredients that the chosen "reach level" cannot satisfy.
    def c_variant(level_per):
        base = reach(authority, level_per)
        over = {g["ingredientId"] for g in base["blockingGates"]}
        # iterate: after lifting blockers new blockers may appear (they do not here, asserted below)
        gates = dict(authority)
        for n in over:
            gates[n] = option_b15[n]
        return sorted(over), gates

    c_hard_nodes, c_hard_gates = c_variant(5)   # only what even ★5 everywhere cannot reach
    c_all_nodes, c_all_gates = c_variant(2)     # everything the guaranteed-minimum path cannot reach

    options = {
        "A_authority_verbatim": authority,
        "B_recomputed_for_15": option_b15,
        "C1_special_case_hard_locks_only": c_hard_gates,
        "C2_special_case_all_min_path_locks": c_all_gates,
    }
    reachability = {o: {p: reach(g, max(v, spd_min)) for p, v in PROFILES.items()} for o, g in options.items()}
    max_stars_all15 = 5 * len(recipes)

    # Walkthrough: Margherita-first, one discovery per bake, Pitz simulated with the approved
    # FLOOR_DISCOVERY_BONUS table, grind = replay Margherita (unlimited starters).
    def walkthrough(gates, best):
        per = max(best, spd_min)
        pay = reward_tbl["base"] * reward_tbl["mult"][str(best)]
        bonus = reward_tbl["discoveryBonus"]
        owned, disc, pitz, bakes, grind, events = set(STARTERS), [], 0, 0, 0, []
        hit = set()

        def stars():
            return per * len(disc)

        def log(kind, **kw):
            events.append({"kind": kind, "stars": stars(), "pitz": pitz, "bakes": bakes, **kw})

        def milestones():
            for m in MILESTONES:
                if m not in hit and stars() >= m:
                    hit.add(m)

        log("START")
        while True:
            ready = [r for r in recipes if r not in disc and all(i in owned for i in recipes[r])]
            if ready:
                r = min(ready, key=lambda x: reach_seq[target[x]])
                disc.append(r); bakes += 1; pitz += pay + bonus
                before = set(hit); milestones()
                log("DISCOVER", recipeId=r, newlyBuyable=sorted(n for n in prod_nodes if n not in owned and gates[n] <= stars() and gates[n] > stars() - per),
                    milestonesCrossed=sorted(set(hit) - before))
                continue
            cands = [r for r in recipes if r not in disc and all(i in owned or gates[i] <= stars() for i in recipes[r])]
            if not cands:
                break
            r = min(cands, key=lambda x: reach_seq[target[x]])
            for i in sorted((i for i in recipes[r] if i not in owned), key=lambda i: row[i]["sequence"]):
                price = row[i]["pricePitz"]
                if pitz < price:
                    need = math.ceil((price - pitz) / pay)
                    grind += need; bakes += need; pitz += need * pay
                    log("GRIND_MARGHERITA", bakesAdded=need)
                pitz -= price; owned.add(i)
                log("BUY", ingredientId=i, pricePitz=price, gate=gates[i])
        stuck = [r for r in recipes if r not in disc]
        nxt = sorted({(i, gates[i]) for r in stuck for i in recipes[r] if i not in owned and gates[i] > stars()}, key=lambda x: (x[1], x[0]))
        log("STOP", notReachable=sorted(stuck, key=lambda r: reach_seq[target[r]]),
            nextGate=None if not nxt else {"ingredientId": nxt[0][0], "gate": nxt[0][1], "starsShort": nxt[0][1] - stars()})
        return {"best": best, "starsPerDiscovery": per, "discovered": len(disc), "finalStars": stars(),
                "totalBakes": bakes, "grindBakes": grind, "milestonesReached": sorted(hit),
                "milestonesNotReached": [m for m in MILESTONES if m not in hit], "events": events}

    walks = {o: {p: walkthrough(g, v) for p, v in PROFILES.items()} for o, g in options.items()}

    # Option A: minimum runtime pool (authority order prefix) needed for each shipped recipe.
    ordered = sorted(all_targets, key=lambda t: (reach_step[t], reach_seq[t]))

    def pool_needed(rid, per):
        g = max(authority[i] for i in recipes[rid])
        s = max(step[i] for i in recipes[rid])
        prefix = [t for t in ordered if reach_step[t] < s]
        return {"gate": g, "authorityTargetsBeforeGateStep": len(prefix),
                "discoveriesNeeded": math.ceil(g / per),
                "reachableWithCurrent15AtThisRate": rid not in reach(authority, per)["notReachable"]}

    late = [r for r in recipes if max(authority[i] for i in recipes[r]) > 22]
    option_a_tranche = {r: {"min2": pool_needed(r, 2), "max5": pool_needed(r, 5)} for r in sorted(late, key=lambda r: reach_seq[target[r]])}

    # Option B drift: gate table per content size (15, 18 with T1, 101 = authority).
    drift = [{"ingredientId": n, "authoritySequence": row[n]["sequence"], "pool15": option_b15[n], "pool18_T1": option_b18[n],
              "pool101_authority": authority[n], "C1": c_hard_gates[n], "C2": c_all_gates[n],
              "shippedRecipesUsing": sorted(r for r in recipes if n in recipes[r])}
             for n in sorted(prod_nodes, key=lambda n: row[n]["sequence"])]

    sha = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    out = {
        "schemaVersion": 1,
        "generatedBy": "docs/reports/data/PROGRESSION-2.0_OD-03_option_model.py",
        "decision": "OD-03 / R-02 -- NOT DECIDED. Options are not ranked.",
        "inputs": {"authority": str(P34.relative_to(ROOT)), "authorityAuditedMainSha": p34["auditedMainSha"],
                   "rewardTable": str(P2.relative_to(ROOT)), "production": ["src/data/recipes.ts", "src/data/ingredients.ts", "src/data/discoveryCatalog.ts"]},
        "starRule": "Σ over discovered recipes of max(BEST, 2) (Phase 3-4A, PR #205 unmerged)",
        "rewardRule": {"perBakeByBest": {k: reward_tbl["base"] * v for k, v in reward_tbl["mult"].items()}, "firstDiscoveryBonus": reward_tbl["discoveryBonus"]},
        "counts": {"productionRecipes": len(recipes), "productionIngredients": len(prod_ing),
                   "ingredientsUsedByProductionRecipes": len(prod_nodes), "authorityTargets": len(all_targets),
                   "authorityIngredients": p34["summary"]["ingredientCount"], "authorityNodes": p34["summary"]["allNodeCount"]},
        "starCeilings": {"all15AtStar5": max_stars_all15, "optionA_fixedPointAtStar5": reachability["A_authority_verbatim"]["perfect_5"]["finalStars"],
                         "all15AtGuaranteedMin2": 2 * len(recipes)},
        "formulaCheck": {"formula": "gate(step) = 2 * ceil(0.6 * #targets reachable at earlier Phase-2 steps)",
                         "reproducesAllAuthorityGatesOver101": not formula_mismatch},
        "productionRecipes": {r: {"targetId": target[r], "ingredients": recipes[r], "authorityReachSequence": reach_seq[target[r]],
                                  "authorityGate": max(authority[i] for i in recipes[r])}
                              for r in sorted(recipes, key=lambda r: reach_seq[target[r]])},
        "gateTable": drift,
        "optionCSpecialCaseSets": {"C1_special_case_hard_locks_only": c_hard_nodes, "C2_special_case_all_min_path_locks": c_all_nodes,
                                   "capValueNote": "ILLUSTRATIVE: Option B pool-15 formula value. The actual cap value is an owner decision."},
        "reachability": reachability,
        "optionA_contentNeededForLateShipped": option_a_tranche,
        "walkthroughs": walks,
    }
    text = json.dumps(out, ensure_ascii=False, indent=1) + "\n"
    if "--check" in sys.argv:
        cur = OUT.read_text() if OUT.exists() else ""
        # generatedAt-free output; the only volatile field would be none.
        if cur != text:
            print("DRIFT: regenerate", OUT); sys.exit(1)
        print("OK"); return
    OUT.write_text(text)
    print("wrote", OUT.relative_to(ROOT), "HEAD", sha)
    for o, prof in reachability.items():
        print(o, {p: (v["discovered"], v["finalStars"], v["firstBlockingGate"]) for p, v in prof.items()})


if __name__ == "__main__":
    main()
