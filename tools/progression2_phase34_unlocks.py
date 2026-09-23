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
AUDITED_MAIN_SHA = "5cf59f94309288ebcf9c02f0310f1f47ef6c74f2"
STARTERS = {"basil", "mozzarella", "tomato-sauce"}
TIER_PRICE = {"early": 60, "mid": 100, "late": 140, "endgame": 180}
SKILLS = {"low-score": 20, "beginner": 50, "standard": 80, "skilled": 100,
          "pitz-constrained": 20}


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


def condition_for(step, before, node):
    if step == 0:
        return {"type": "INITIAL_OWNED", "all": []}
    needed = max(1, math.ceil(before * 0.60))
    if step == 1:
        primary = {"type": "SPECIFIC_DISCOVERY", "targetId": "shipped:margherita"}
    elif step % 3 == 0:
        primary = {"type": "CUMULATIVE_STARS", "minimum": needed * 2,
                   "starModel": "HYBRID_MINIMUM_2_PER_DISCOVERY"}
    else:
        primary = {"type": "DISCOVERED_RECIPE_COUNT", "minimum": needed}
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


def build():
    p2 = load(P2)
    targets = p2["targets"]["SHIPPED_KEEP"]
    target_by_id = {t["targetId"]: t for t in targets}
    schedule = p2["unlockSchedules"]["SHIPPED_KEEP"]["M2_TUTORIAL_WEIGHTED"]["steps"]
    impact = {x["node"]: x for x in p2["nodeImpact"]}
    names = display_names()
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
            cond = condition_for(step["step"], imp["cumulativeDiscoverableBefore"], imp)
            rows.append({
                "sequence": sequence, "nodeId": node_id, "ingredientId": node_id if kind == "ingredient" else None,
                "displayName": names.get(node_id, node_id.replace(":", " / ").replace("-", " ").title()),
                "kind": kind, "tier": step["tier"], "lifecycle": "OWNED" if step["step"] == 0 else "LOCKED_TO_AVAILABLE_TO_BUY_TO_OWNED",
                "unlockCondition": cond, "conditionType": "INITIAL_OWNED" if step["step"] == 0 else cond["all"][0]["type"],
                "pricePitz": price, "stockPolicy": "UNLIMITED" if node_id in STARTERS else ("NON_CONSUMABLE" if kind != "ingredient" else "PURCHASE_GRANT_10_REFILL_10_AT_HALF_PRICE"),
                "prerequisite": (next(iter(imp["prerequisite"].values())) if isinstance(imp["prerequisite"], dict) else imp["prerequisite"]),
                "recipeReuseCount": imp["totalTargetsUsingNode"],
                "newlyReachableRecipeIds": new, "newlyReachableRecipes": len(new),
                "rationale": ("Initial unlimited income/discovery guarantee." if node_id in STARTERS else
                              f"Phase-2 step {step['step']}; {imp['totalTargetsUsingNode']} target reuse, placed in {step['tier']} tier."),
                "blockedDeferredReason": None,
            })
    # The ordering helper mutates owned; recompute final proof from the matrix rows.
    simulations = []
    for skill, reward in SKILLS.items():
        state = {"owned": set(STARTERS), "discovered": reachable(targets, set(STARTERS)), "stars": 0, "pitz": 0}
        state["stars"] = len(state["discovered"]) * 2
        bakes = 1
        max_gap = 1
        max_burst = len(state["discovered"])
        purchase_wait = 0
        events = []
        for row in rows:
            waits = 0
            if row["lifecycle"] == "OWNED" or row["kind"] == "capability":
                state["owned"].add(row["nodeId"])
            else:
                if not condition_met(row["unlockCondition"], state):
                    # Discover all currently reachable targets: deterministic completionist path.
                    state["discovered"] |= reachable(targets, state["owned"])
                    state["stars"] = len(state["discovered"]) * 2
                if not condition_met(row["unlockCondition"], state):
                    raise AssertionError(f"condition deadlock: {skill}/{row['nodeId']}")
                waits = max(0, math.ceil((row["pricePitz"] - state["pitz"]) / reward))
                state["pitz"] += waits * reward
                bakes += waits
                purchase_wait = max(purchase_wait, waits)
                state["pitz"] -= row["pricePitz"]
                state["owned"].add(row["nodeId"])
            new = reachable(targets, state["owned"]) - state["discovered"]
            if new:
                state["discovered"] |= new
                state["stars"] = len(state["discovered"]) * 2
                state["pitz"] += len(new) * 50
                max_burst = max(max_burst, len(new))
            events.append({"sequence": row["sequence"], "nodeId": row["nodeId"], "waitBakes": waits if row["pricePitz"] else 0,
                           "newlyDiscovered": sorted(new), "discoveredTotal": len(state["discovered"]), "pitzAfter": state["pitz"]})
        simulations.append({"profile": skill, "outcome": "COMPLETE" if len(state["discovered"]) == 101 else "DEADLOCK",
                            "reachableTargets": len(state["discovered"]), "targetCount": 101, "totalIncomeBakes": bakes,
                            "maxPurchaseWaitBakes": purchase_wait, "maxUnlockOpportunityGapBakes": max_gap + purchase_wait,
                            "maxUnlockBurstRecipes": max_burst, "finalPitz": state["pitz"], "events": events})
    ingredient_rows = [r for r in rows if r["kind"] == "ingredient"]
    first10 = [r for r in rows if r["lifecycle"] != "OWNED" and r["kind"] != "capability"][:10]
    early_owned = STARTERS | {r["nodeId"] for r in first10}
    early_reachable = len(reachable(targets, early_owned))
    step_bursts = Counter(impact[r["nodeId"]]["step"] for r in rows if r["lifecycle"] != "OWNED")
    blockers = Counter(e["phase2Class"] for e in p2["rowClassification"] if e["phase2Class"] != "EVIDENCE_READY_TARGET")
    out = {
        "schemaVersion": 1, "issue": 195, "auditedMainSha": AUDITED_MAIN_SHA,
        "generatedBy": "tools/progression2_phase34_unlocks.py", "phase2InputSha256": hashlib.sha256(P2.read_bytes()).hexdigest(),
        "semantics": {"stars": "monotonic progression/achievement; never spent", "pitz": "spendable purchase/refill currency",
                      "ownership": "permanent", "stock": "consumable and separate from ownership"},
        "policy": {"profile": "SHIPPED_KEEP", "mechanicPolicy": "M2_TUTORIAL_WEIGHTED", "gateFraction": 0.60,
                   "pricesByTier": TIER_PRICE, "firstDiscoveryBonusPitz": 50, "purchaseGrantPortions": 10,
                   "refillPortions": 10, "refillPriceFactor": 0.5},
        "summary": {"ingredientCount": len(ingredient_rows), "initialOwnedIngredientCount": 3,
                    "unlockableIngredientCount": len(ingredient_rows)-3, "allNodeCount": len(rows),
                    "conditionTypes": dict(sorted(Counter(r["conditionType"] for r in rows).items())),
                    "tiers": dict(sorted(Counter(r["tier"] for r in rows).items())),
                    "oneRecipeIngredients": sorted(r["nodeId"] for r in ingredient_rows if r["recipeReuseCount"] == 1),
                    "highReuseIngredients": [{"ingredientId": r["nodeId"], "recipeReuseCount": r["recipeReuseCount"]}
                                             for r in sorted(ingredient_rows, key=lambda x: (-x["recipeReuseCount"], x["nodeId"]))[:10]],
                    "earlyGameReachableRecipeCountAfter10Purchases": early_reachable,
                    "maxUnlockBurstNodes": max(step_bursts.values()), "phase2WorstCaseMaxGrindStreakBakes": 24,
                    "mechanicBlockers": blockers["BLOCKED_MECHANIC_INTERPRETATION"],
                    "evidenceBlockers": blockers["BLOCKED_EVIDENCE"], "phase2BlockedClasses": dict(sorted(blockers.items()))},
        "rows": rows, "first10Unlocks": first10, "simulations": simulations,
        "ownerDecisions": [
            {"id": "OD-01", "decision": "Confirm shipped recipe compositions as the 101-target overlay.",
             "recommendation": "Keep SHIPPED_KEEP; it preserves shipped saves/content and the starter-only Margherita loop.",
             "impactIfRejected": "Use EVIDENCE_STRICT: 87 targets, no starter-only first discovery; regenerate this matrix."},
            {"id": "OD-02", "decision": "Approve the Phase-2 reward contract change: PASS ★1 floor 20 and first-discovery bonus 50.",
             "recommendation": "Approve before production Phase 3-4; current ★1=0 deadlocks the low-score path.",
             "impactIfRejected": "Low-score affordability is not implementable without another guaranteed Pitz source."}
        ],
        "implementationVerdict": "READY_WITH_TWO_OWNER_CONFIRMATIONS"
    }
    return out


def md(out):
    s = out["summary"]
    lines = ["# Progression 2.0 Phase 3-4 — Final ingredient unlock / price design", "",
             f"Audited `origin/main`: `{out['auditedMainSha']}`. Generated from the Phase-2 matrix; JSON is authoritative.", "",
             "## Verdict", "", "**READY WITH TWO OWNER CONFIRMATIONS.** The matrix is implementation-readable without prose reinterpretation once OD-01/OD-02 are confirmed.", "",
             "Stars are monotonic progression and are never spent. Pitz is spendable. Permanent OWNED and consumable stock are separate.", "",
             "## Counts and balance", "", f"- Ingredients: {s['ingredientCount']} (3 initial OWNED, {s['unlockableIngredientCount']} purchasable)",
             f"- All scheduled nodes including dough/pan/capability: {s['allNodeCount']}",
             f"- Early reachable recipes after the first 10 purchases: {s['earlyGameReachableRecipeCountAfter10Purchases']}",
             f"- Maximum availability burst: {s['maxUnlockBurstNodes']} nodes; full Phase-2 worst-case grind streak: {s['phase2WorstCaseMaxGrindStreakBakes']} bakes",
             f"- One-recipe ingredients: {len(s['oneRecipeIngredients'])}", f"- Evidence/mechanic blockers outside the 101 pool: {s['evidenceBlockers']} / {s['mechanicBlockers']}", "",
             "| Profile | Result | Reach | Max opportunity gap (bakes) | Max burst (recipes) | Max purchase wait (bakes) |", "|---|---:|---:|---:|---:|---:|"]
    for x in out["simulations"]:
        lines.append(f"| {x['profile']} | {x['outcome']} | {x['reachableTargets']}/{x['targetCount']} | {x['maxUnlockOpportunityGapBakes']} | {x['maxUnlockBurstRecipes']} | {x['maxPurchaseWaitBakes']} |")
    lines += ["", "## First 10 purchasable unlocks", "", "| # | Action / condition | Available item | Price | Newly reachable pizzas |", "|---:|---|---|---:|---|"]
    for i, r in enumerate(out["first10Unlocks"], 1):
        lines.append(f"| {i} | `{json.dumps(r['unlockCondition'], ensure_ascii=False, separators=(',', ':'))}` | {r['displayName']} (`{r['nodeId']}`) | {r['pricePitz']} | {', '.join(r['newlyReachableRecipeIds']) or '0 at this individual purchase; completes a Phase-2 set'} |")
    lines += ["", "## Full unlock table", "", "| Id | Name | Kind | Tier | Condition type | Price | Prerequisite | Reuse | New | Rationale | Blocked/deferred |", "|---|---|---|---|---|---:|---|---:|---:|---|---|"]
    for r in out["rows"]:
        lines.append(f"| `{r['nodeId']}` | {r['displayName']} | {r['kind']} | {r['tier']} | {r['conditionType']} | {r['pricePitz']} | {r['prerequisite'] or ''} | {r['recipeReuseCount']} | {r['newlyReachableRecipes']} | {r['rationale']} | {r['blockedDeferredReason'] or ''} |")
    lines += ["", "## Phase 2 differences", "", "- Converts group/step candidates into deterministic per-node conditions and a stable purchase order.",
              "- Freezes tier prices at 60/100/140/180 Pitz and preserves Phase-2 S10/R10 stock policy.",
              "- Keeps the mixed, derived 60% gate; it does not restore the rejected fixed ★10 ladder.",
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
             "| Id | Decision | Recommendation | Impact if rejected |", "|---|---|---|---|"]
    for d in out["ownerDecisions"]:
        lines.append(f"| {d['id']} | {d['decision']} | {d['recommendation']} | {d['impactIfRejected']} |")
    lines += ["", "Display copy, category authoring, and per-row PIZZA DB evidence gaps are not owner decisions for this 101-target implementation slice.", ""]
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
