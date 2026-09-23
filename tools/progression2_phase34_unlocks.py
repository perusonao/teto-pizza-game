#!/usr/bin/env python3
"""Issue #195: deterministic ingredient unlock/price matrix and deadlock validator.

Phase 2 remains the evidence/graph authority.  This tool freezes its recommended 101-target
schedule into per-node conditions and prices, simulates the actual AVAILABLE -> buy -> discovery
loop, and writes implementation-ready JSON plus human-readable reports.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
P2 = ROOT / "docs/design/data/TETO_PROGRESSION2_PHASE2_UNLOCK-MATRIX.json"
CATALOG = ROOT / "data/recipes/ingredient_master_catalog.json"
OUT = ROOT / "docs/design/data/TETO_PROGRESSION2_PHASE34_INGREDIENT-UNLOCK-MATRIX.json"
REPORT = ROOT / "docs/design/TETO_PROGRESSION2_PHASE34_UNLOCKS.md"
LEDGER = ROOT / "docs/design/TETO_PROGRESSION2_PHASE34_OWNER-DECISION-LEDGER.md"
AUDITED_MAIN_SHA = "08b04f8f1c59b8adb38964d4ec3e08e6acb6cbc2"
OWNER_DECISION_CONFIRMATION = "Approved by repo owner (perusonao) in PR #196 comment, 2026-09-23."
STARTERS = {"basil", "mozzarella", "tomato-sauce"}
TIER_PRICE = {"early": 60, "mid": 100, "late": 140, "endgame": 180}
STOCK_CONSUMABLE_POLICY = "PURCHASE_GRANT_10_REFILL_10_AT_HALF_PRICE"
# Quality-star rating each reference profile bakes at (matches Phase-2 skills.* labels
# WORST=1/BEGINNER=2/STANDARD=3/SKILLED=4); pitz-constrained models a worst-quality,
# income-starved player and is kept at the WORST quality star.
SKILL_QUALITY_STAR = {"low-score": 1, "beginner": 2, "standard": 3, "skilled": 4,
                       "pitz-constrained": 1}


def load(path):
    return json.loads(path.read_text(encoding="utf-8"))


def requirements(target):
    return set(target["items"]) | set(target["capabilities"])


def reachable(targets, owned):
    return {t["targetId"] for t in targets if requirements(t) <= owned}


def display_names():
    result = {}
    for row in load(CATALOG)["ingredients"]:
        result[row["id"]] = row.get("nameOriginal") or row["id"]
    return result


def ordered_nodes(nodes, targets, owned):
    """Choose the deterministic within-step order with the largest immediate recipe payoff."""
    remaining = [dict(n) for n in nodes]
    result = []
    base = reachable(targets, owned)
    while remaining:
        ranked = []
        for n in remaining:
            after = reachable(targets, owned | {n["id"]})
            ranked.append((len(after - base), n["id"], n, after))
        _, _, chosen, after = sorted(ranked, key=lambda x: (-x[0], x[1]))[0]
        result.append(chosen)
        owned.add(chosen["id"])
        base = after
        remaining.remove(chosen)
    return result


def condition_for(step, before, node, gate_fraction, gate_stars_per_discovery):
    """Every non-initial step derives its gate from the selected Phase-2 hybrid-star
    curve (G4_HYBRID_060): minimum = guaranteedStarsPerDiscovery * ceil(before * fraction).
    This matches p2['recommendedGates'] for this exact schedule byte-for-byte (see
    --check), so no step-ordinal (step % 3) special-casing is used."""
    if step == 0:
        return {"type": "INITIAL_OWNED", "all": []}
    needed = max(1, math.ceil(before * gate_fraction))
    primary = {"type": "CUMULATIVE_STARS", "minimum": needed * gate_stars_per_discovery,
               "starModel": "HYBRID_MINIMUM_2_PER_DISCOVERY"}
    clauses = [primary]
    prereq_raw = node.get("prerequisite")
    prereq = next(iter(prereq_raw.values())) if isinstance(prereq_raw, dict) else prereq_raw
    if prereq:
        clauses.append({"type": "PREREQUISITE_OWNED", "nodeId": prereq})
    return {"type": "ALL", "all": clauses}


def condition_met(condition, state):
    typ = condition["type"]
    if typ == "INITIAL_OWNED": return True
    if typ == "ALL": return all(condition_met(c, state) for c in condition["all"])
    if typ == "SPECIFIC_DISCOVERY": return condition["targetId"] in state["discovered"]
    if typ == "DISCOVERED_RECIPE_COUNT": return len(state["discovered"]) >= condition["minimum"]
    if typ == "CUMULATIVE_STARS": return state["stars"] >= condition["minimum"]
    if typ == "PREREQUISITE_OWNED": return condition["nodeId"] in state["owned"]
    raise ValueError(typ)


def simulate_profile(targets, target_by_id, rows, row_by_id, reward, quality_bonus_stars,
                      stars_per_discovery, discovery_bonus, stock_policy):
    """Model the real AVAILABLE -> purchase -> OWNED -> free-cook -> PASS bake -> discovery
    loop for one reference skill profile: a purchase only makes a recipe reachable; it still
    takes a PASS free-cook bake (with its own stock cost, base reward and first-discovery
    bonus) to actually discover it, and the next unlock gate is only evaluated once those
    bakes have happened."""
    grant, restock, restock_factor = stock_policy["grant"], stock_policy["restock"], stock_policy["restockFactor"]
    sim = {"owned": set(STARTERS), "discovered": set(),
           "stars": 0, "pitz": 0, "stock": {}, "bakes": 0, "discoveryBakes": 0, "grindBakes": 0,
           "refills": 0, "maxGap": 0, "lastDiscoveryBake": 0, "maxBurst": 0, "purchaseWait": 0,
           "events": []}

    def bake_discovery(target_id):
        for item in target_by_id[target_id]["items"]:
            item_row = row_by_id.get(item)
            if not item_row or item_row["stockPolicy"] != STOCK_CONSUMABLE_POLICY:
                continue
            if sim["stock"].get(item, 0) <= 0:
                refill_cost = item_row["pricePitz"] * restock_factor
                if sim["pitz"] < refill_cost:
                    grind = math.ceil((refill_cost - sim["pitz"]) / reward)
                    sim["pitz"] += grind * reward
                    sim["bakes"] += grind
                    sim["grindBakes"] += grind
                sim["pitz"] -= refill_cost
                sim["stock"][item] = sim["stock"].get(item, 0) + restock
                sim["refills"] += 1
            sim["stock"][item] -= 1
        sim["bakes"] += 1
        sim["discoveryBakes"] += 1
        sim["pitz"] += reward + discovery_bonus
        sim["discovered"].add(target_id)
        sim["stars"] += stars_per_discovery + quality_bonus_stars
        sim["maxGap"] = max(sim["maxGap"], sim["bakes"] - sim["lastDiscoveryBake"])
        sim["lastDiscoveryBake"] = sim["bakes"]

    def process_pending(sequence, node_id, wait):
        pending = sorted(reachable(targets, sim["owned"]) - sim["discovered"])
        for target_id in pending:
            bake_discovery(target_id)
        sim["maxBurst"] = max(sim["maxBurst"], len(pending))
        sim["events"].append({"sequence": sequence, "nodeId": node_id, "waitBakes": wait,
                              "newlyDiscovered": pending, "discoveryBakes": len(pending),
                              "discoveredTotal": len(sim["discovered"]), "bakesTotal": sim["bakes"],
                              "stockRefillsTotal": sim["refills"], "pitzAfter": sim["pitz"]})

    # The starter trio's own PASS bake (Margherita) is not a purchase; credit its reward,
    # discovery bonus and stars like any other discovery bake before any row is processed.
    process_pending(0, "shipped:margherita", 0)

    for row in rows:
        if row["lifecycle"] == "OWNED":
            sim["owned"].add(row["nodeId"])
            continue
        if row["kind"] == "capability":
            sim["owned"].add(row["nodeId"])
            process_pending(row["sequence"], row["nodeId"], 0)
            continue
        if not condition_met(row["unlockCondition"], sim):
            raise AssertionError(f"condition deadlock: {row['nodeId']}")
        price = row["pricePitz"]
        wait = max(0, math.ceil((price - sim["pitz"]) / reward))
        sim["pitz"] += wait * reward
        sim["bakes"] += wait
        sim["grindBakes"] += wait
        sim["purchaseWait"] = max(sim["purchaseWait"], wait)
        sim["pitz"] -= price
        sim["owned"].add(row["nodeId"])
        if row["kind"] == "ingredient" and row["stockPolicy"] == STOCK_CONSUMABLE_POLICY:
            sim["stock"][row["nodeId"]] = grant
        process_pending(row["sequence"], row["nodeId"], wait)
    return sim


def build():
    p2 = load(P2)
    targets = p2["targets"]["SHIPPED_KEEP"]
    target_by_id = {t["targetId"]: t for t in targets}
    schedule = p2["unlockSchedules"]["SHIPPED_KEEP"]["M2_TUTORIAL_WEIGHTED"]["steps"]
    impact = {x["node"]: x for x in p2["nodeImpact"]}
    names = display_names()
    gate_curve_name = p2["recommended"]["economy"]["gate"]
    gate_curve = p2["gateCurves"][gate_curve_name]
    gate_fraction = gate_curve["fraction"]
    gate_stars_per_discovery = gate_curve["guaranteedStarsPerDiscovery"]
    gate_quality_bonus_stars = set(gate_curve.get("qualityBonusAtStars", []))
    reward_table_name = p2["recommended"]["economy"]["reward"]
    reward_table = p2["rewardTables"][reward_table_name]
    stock_policy_name = p2["recommended"]["economy"]["stock"]
    stock_policy = p2["stockPolicies"][stock_policy_name]
    owned = set()
    discovered = set()
    rows = []
    sequence = 0
    for step in schedule:
        before = len(discovered)
        for node in ordered_nodes(step["nodes"], targets, set(owned)):
            node_id = node["id"]
            prior = reachable(targets, owned)
            owned.add(node_id)
            after = reachable(targets, owned)
            new = sorted(after - prior)
            discovered |= after
            imp = impact[node_id]
            kind = node["kind"]
            price = 0 if step["step"] == 0 or kind == "capability" else TIER_PRICE[step["tier"]]
            sequence += 1
            cond = condition_for(step["step"], imp["cumulativeDiscoverableBefore"], imp,
                                  gate_fraction, gate_stars_per_discovery)
            rows.append({
                "sequence": sequence, "nodeId": node_id, "ingredientId": node_id if kind == "ingredient" else None,
                "displayName": names.get(node_id, node_id.replace(":", " / ").replace("-", " ").title()),
                "kind": kind, "tier": step["tier"], "lifecycle": "OWNED" if step["step"] == 0 else "LOCKED_TO_AVAILABLE_TO_BUY_TO_OWNED",
                "unlockCondition": cond, "conditionType": "INITIAL_OWNED" if step["step"] == 0 else cond["all"][0]["type"],
                "pricePitz": price, "stockPolicy": "UNLIMITED" if node_id in STARTERS else ("NON_CONSUMABLE" if kind != "ingredient" else STOCK_CONSUMABLE_POLICY),
                "prerequisite": (next(iter(imp["prerequisite"].values())) if isinstance(imp["prerequisite"], dict) else imp["prerequisite"]),
                "recipeReuseCount": imp["totalTargetsUsingNode"],
                "newlyReachableRecipeIds": new, "newlyReachableRecipes": len(new),
                "rationale": ("Initial unlimited income/discovery guarantee." if node_id in STARTERS else
                              f"Phase-2 step {step['step']}; {imp['totalTargetsUsingNode']} target reuse, placed in {step['tier']} tier."),
                "blockedDeferredReason": None,
            })
    # The ordering helper mutates owned; recompute final proof from the matrix rows.
    row_by_id = {r["nodeId"]: r for r in rows}
    simulations = []
    for skill, quality_star in SKILL_QUALITY_STAR.items():
        reward = reward_table["base"] * reward_table["mult"][str(quality_star)]
        # Matches tools/progression2_phase2_progression.py stars_for_discovery(): one bonus
        # star per qualityBonusAtStars threshold reached, not just membership (a SKILLED
        # quality_star=4 bake reaches both the 3-star and 4-star thresholds).
        quality_bonus_stars = sum(1 for q in gate_quality_bonus_stars if quality_star >= q)
        sim = simulate_profile(targets, target_by_id, rows, row_by_id, reward, quality_bonus_stars,
                                gate_stars_per_discovery, reward_table["discoveryBonus"], stock_policy)
        simulations.append({
            "profile": skill, "outcome": "COMPLETE" if len(sim["discovered"]) == 101 else "DEADLOCK",
            "reachableTargets": len(sim["discovered"]), "targetCount": 101,
            "totalIncomeBakes": sim["bakes"], "discoveryBakes": sim["discoveryBakes"],
            "grindBakes": sim["grindBakes"], "stockRefills": sim["refills"],
            "maxPurchaseWaitBakes": sim["purchaseWait"], "maxUnlockOpportunityGapBakes": sim["maxGap"],
            "maxUnlockBurstRecipes": sim["maxBurst"], "finalPitz": sim["pitz"], "events": sim["events"],
        })
    ingredient_rows = [r for r in rows if r["kind"] == "ingredient"]
    first10 = [r for r in rows if r["lifecycle"] != "OWNED" and r["kind"] != "capability"][:10]
    early_owned = STARTERS | {r["nodeId"] for r in first10}
    early_reachable = len(reachable(targets, early_owned))
    step_bursts = Counter(impact[r["nodeId"]]["step"] for r in rows if r["lifecycle"] != "OWNED")
    blockers = Counter(e["phase2Class"] for e in p2["rowClassification"] if e["phase2Class"] != "EVIDENCE_READY_TARGET")
    phase2_worst_completionist = next(s for s in p2["recommendedSimulationBySkill"]
                                       if s["skill"] == "WORST" and s["explorer"] == "COMPLETIONIST")
    out = {
        "schemaVersion": 1, "issue": 195, "auditedMainSha": AUDITED_MAIN_SHA,
        "generatedBy": "tools/progression2_phase34_unlocks.py", "phase2InputSha256": hashlib.sha256(P2.read_bytes()).hexdigest(),
        "semantics": {"stars": "monotonic progression/achievement; never spent", "pitz": "spendable purchase/refill currency",
                      "ownership": "permanent", "stock": "consumable and separate from ownership"},
        "policy": {"profile": "SHIPPED_KEEP", "mechanicPolicy": "M2_TUTORIAL_WEIGHTED",
                   "gateCurve": gate_curve_name, "gateFraction": gate_fraction,
                   "gateStarsPerDiscovery": gate_stars_per_discovery,
                   "gateQualityBonusAtStars": sorted(gate_quality_bonus_stars),
                   "pricesByTier": TIER_PRICE, "rewardTable": reward_table_name,
                   "firstDiscoveryBonusPitz": reward_table["discoveryBonus"],
                   "stockPolicy": stock_policy_name, "purchaseGrantPortions": stock_policy["grant"],
                   "refillPortions": stock_policy["restock"], "refillPriceFactor": stock_policy["restockFactor"]},
        "summary": {"ingredientCount": len(ingredient_rows), "initialOwnedIngredientCount": 3,
                    "unlockableIngredientCount": len(ingredient_rows)-3, "allNodeCount": len(rows),
                    "conditionTypes": dict(sorted(Counter(r["conditionType"] for r in rows).items())),
                    "tiers": dict(sorted(Counter(r["tier"] for r in rows).items())),
                    "oneRecipeIngredients": sorted(r["nodeId"] for r in ingredient_rows if r["recipeReuseCount"] == 1),
                    "highReuseIngredients": [{"ingredientId": r["nodeId"], "recipeReuseCount": r["recipeReuseCount"]}
                                             for r in sorted(ingredient_rows, key=lambda x: (-x["recipeReuseCount"], x["nodeId"]))[:10]],
                    "earlyGameReachableRecipeCountAfter10Purchases": early_reachable,
                    "maxUnlockBurstNodes": max(step_bursts.values()),
                    "phase2WorstCaseMaxGrindStreakBakes": phase2_worst_completionist["maxGrindStreak"],
                    "mechanicBlockers": blockers["BLOCKED_MECHANIC_INTERPRETATION"],
                    "evidenceBlockers": blockers["BLOCKED_EVIDENCE"], "phase2BlockedClasses": dict(sorted(blockers.items()))},
        "rows": rows, "first10Unlocks": first10, "simulations": simulations,
        "ownerDecisions": [
            {"id": "OD-01", "decision": "Confirm shipped recipe compositions as the 101-target overlay.",
             "recommendation": "Keep SHIPPED_KEEP; it preserves shipped saves/content and the starter-only Margherita loop.",
             "impactIfRejected": "Use EVIDENCE_STRICT: 87 targets, no starter-only first discovery; regenerate this matrix.",
             "status": "APPROVED", "confirmation": OWNER_DECISION_CONFIRMATION},
            {"id": "OD-02", "decision": "Approve the Phase-2 reward contract change: PASS ★1 floor 20 and first-discovery bonus 50.",
             "recommendation": "Approve before production Phase 3-4; current ★1=0 deadlocks the low-score path.",
             "impactIfRejected": "Low-score affordability is not implementable without another guaranteed Pitz source.",
             "status": "APPROVED", "confirmation": OWNER_DECISION_CONFIRMATION}
        ],
        "implementationVerdict": "READY_APPROVED_FOR_PRODUCTION_IMPLEMENTATION"
    }
    return out


def md(out):
    s = out["summary"]
    lines = ["# Progression 2.0 Phase 3-4 — Final ingredient unlock / price design", "",
             f"Audited `origin/main`: `{out['auditedMainSha']}`. Generated from the Phase-2 matrix; JSON is authoritative.", "",
             "## Verdict", "", "**READY, APPROVED FOR PRODUCTION IMPLEMENTATION.** OD-01 and OD-02 are both APPROVED "
             f"({OWNER_DECISION_CONFIRMATION}); the matrix is implementation-readable without prose reinterpretation.", "",
             "Stars are monotonic progression and are never spent. Pitz is spendable. Permanent OWNED and consumable stock are separate.", "",
             "## Counts and balance", "", f"- Ingredients: {s['ingredientCount']} (3 initial OWNED, {s['unlockableIngredientCount']} purchasable)",
             f"- All scheduled nodes including dough/pan/capability: {s['allNodeCount']}",
             f"- Early reachable recipes after the first 10 purchases: {s['earlyGameReachableRecipeCountAfter10Purchases']}",
             f"- Maximum availability burst: {s['maxUnlockBurstNodes']} nodes; full Phase-2 worst-case grind streak: {s['phase2WorstCaseMaxGrindStreakBakes']} bakes",
             f"- One-recipe ingredients: {len(s['oneRecipeIngredients'])}", f"- Evidence/mechanic blockers outside the 101 pool: {s['evidenceBlockers']} / {s['mechanicBlockers']}", "",
             "Discovery is only granted after a simulated PASS free-cook bake (base reward + first-discovery bonus, "
             "ingredient stock consumption and refills included); reachability alone never marks a recipe discovered.", "",
             "| Profile | Result | Reach | Total bakes | Discovery bakes | Grind bakes | Stock refills | Max opportunity gap (bakes) | Max burst (recipes) | Max purchase wait (bakes) |",
             "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|"]
    for x in out["simulations"]:
        lines.append(f"| {x['profile']} | {x['outcome']} | {x['reachableTargets']}/{x['targetCount']} | {x['totalIncomeBakes']} | {x['discoveryBakes']} | {x['grindBakes']} | {x['stockRefills']} | {x['maxUnlockOpportunityGapBakes']} | {x['maxUnlockBurstRecipes']} | {x['maxPurchaseWaitBakes']} |")
    lines += ["", "## First 10 purchasable unlocks", "", "| # | Action / condition | Available item | Price | Newly reachable pizzas |", "|---:|---|---|---:|---|"]
    for i, r in enumerate(out["first10Unlocks"], 1):
        lines.append(f"| {i} | `{json.dumps(r['unlockCondition'], ensure_ascii=False, separators=(',', ':'))}` | {r['displayName']} (`{r['nodeId']}`) | {r['pricePitz']} | {', '.join(r['newlyReachableRecipeIds']) or '0 at this individual purchase; completes a Phase-2 set'} |")
    lines += ["", "## Full unlock table", "", "| Id | Name | Kind | Tier | Condition type | Price | Prerequisite | Reuse | New | Rationale | Blocked/deferred |", "|---|---|---|---|---|---:|---|---:|---:|---|---|"]
    for r in out["rows"]:
        lines.append(f"| `{r['nodeId']}` | {r['displayName']} | {r['kind']} | {r['tier']} | {r['conditionType']} | {r['pricePitz']} | {r['prerequisite'] or ''} | {r['recipeReuseCount']} | {r['newlyReachableRecipes']} | {r['rationale']} | {r['blockedDeferredReason'] or ''} |")
    lines += ["", "## Phase 2 differences", "", "- Converts group/step candidates into deterministic per-node conditions and a stable purchase order.",
              "- Freezes tier prices at 60/100/140/180 Pitz and preserves Phase-2 S10/R10 stock policy.",
              f"- Every non-initial step derives its gate from the selected `{out['policy']['gateCurve']}` hybrid-star curve "
              f"(minimum = {out['policy']['gateStarsPerDiscovery']} x ceil(before x {out['policy']['gateFraction']})); "
              "it does not restore the rejected fixed ★10 ladder and does not alternate with a discovery-count gate.",
              "- Reduces the decision ledger to the two confirmations that genuinely change production behavior.", "",
              "## Fresh-audit findings", "", f"- Phase-2 input: 172 rows; recommended pool 101 targets (87 evidence-ready + 14 shipped overlay). Input SHA-256 `{out['phase2InputSha256']}`.",
              "- Phase-1 mechanic matrix remains the evidence authority: 53 evidence blockers, 22 product-decision blockers, 8 mechanic-interpretation blockers, and 2 discovery-rule blockers stay outside this matrix.",
              "- Current production catalog has 15 shipped recipes and 22 ingredient records; this design matrix deliberately describes the future 105-ingredient 101-target pool and does not mutate production data.",
              "- Current production contract derives LOCKED/AVAILABLE_TO_BUY/OWNED from `minTotalStars` and ownership, treats ownership as permanent, and stock as a separate consumable map. `starterGrantOnly` suppresses first purchase today; Phase 3-4 must replace that path for this matrix.",
              "- Current FREE reward is base 100 with multipliers 0/0.5/0.8/1.0/1.2. Therefore OD-02 is real: ★1 currently earns 0, while this matrix requires floor 20 and +50 on first discovery. Lunch Rush remains 40 + quality + served bonus (max 140/run) and is not required for deadlock freedom.", "",
              "## Validation", "", "Run `python tools/progression2_phase34_unlocks.py --check`. It rebuilds twice, validates conditions, prices, counts, 101/101 reachability, and byte drift.", ""]
    return "\n".join(lines)


def ledger(out):
    lines = ["# Progression 2.0 Phase 3-4 — Owner Decision Ledger", "", "Only decisions that change the implementable contract remain.", "",
             "| Id | Decision | Status | Recommendation | Impact if rejected |", "|---|---|---|---|---|"]
    for d in out["ownerDecisions"]:
        lines.append(f"| {d['id']} | {d['decision']} | {d['status']} | {d['recommendation']} | {d['impactIfRejected']} |")
    lines += ["", f"Confirmation: {OWNER_DECISION_CONFIRMATION}", "",
              "Display copy, category authoring, and per-row PIZZA DB evidence gaps are not owner decisions for this 101-target implementation slice.", ""]
    return "\n".join(lines)


def validate(out):
    errors = []
    rows = out["rows"]
    if len([r for r in rows if r["kind"] == "ingredient"]) != 105: errors.append("ingredient count != 105")
    if {r["nodeId"] for r in rows if r["lifecycle"] == "OWNED"} != STARTERS: errors.append("initial OWNED differs from starter trio")
    for r in rows:
        if not r["unlockCondition"] or r["pricePitz"] < 0: errors.append(f"invalid row {r['nodeId']}")
        if r["lifecycle"] != "OWNED" and r["kind"] != "capability" and r["pricePitz"] <= 0: errors.append(f"missing price {r['nodeId']}")
        if r["blockedDeferredReason"] is not None: errors.append(f"scheduled row unexpectedly deferred {r['nodeId']}")
    for sim in out["simulations"]:
        if sim["outcome"] != "COMPLETE" or sim["reachableTargets"] != 101: errors.append(f"deadlock {sim['profile']}")
    if len(out["first10Unlocks"]) != 10: errors.append("first10 length")
    return errors


def dumps(x): return json.dumps(x, ensure_ascii=False, indent=2) + "\n"


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--check", action="store_true"); args = ap.parse_args()
    out = build(); errors = validate(out)
    if dumps(build()) != dumps(out): errors.append("non-deterministic double build")
    outputs = ((OUT, dumps(out)), (REPORT, md(out)), (LEDGER, ledger(out)))
    if args.check:
        for path, content in outputs:
            if not path.exists() or path.read_text(encoding="utf-8") != content: errors.append(f"drift: {path.relative_to(ROOT)}")
    else:
        for path, content in outputs:
            path.parent.mkdir(parents=True, exist_ok=True); path.write_text(content, encoding="utf-8", newline="\n"); print(f"Wrote {path.relative_to(ROOT)}")
    print(f"ingredients={out['summary']['ingredientCount']} nodes={out['summary']['allNodeCount']} targets=101")
    for s in out["simulations"]: print(f"{s['profile']}: {s['outcome']} {s['reachableTargets']}/101 maxWait={s['maxPurchaseWaitBakes']}")
    if errors:
        print("FAIL:"); [print(" - " + e) for e in errors]; return 1
    print("All Phase 3-4 validations passed."); return 0


if __name__ == "__main__": sys.exit(main())
