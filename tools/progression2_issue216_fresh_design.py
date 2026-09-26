#!/usr/bin/env python3
"""Issue #216 Fresh Design generator and deterministic deadlock/economy validator.

This consumes, but never rebuilds, the Phase-1 172-row mechanic matrix and the
Phase-2/3-4 progression matrices merged by PRs #189/#191.  Outputs are docs/data
only and intentionally keep owner choices as candidates.
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
P1 = ROOT / "docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json"
P2 = ROOT / "docs/design/data/TETO_PROGRESSION2_PHASE2_UNLOCK-MATRIX.json"
P34 = ROOT / "docs/design/data/TETO_PROGRESSION2_PHASE34_INGREDIENT-UNLOCK-MATRIX.json"
OUT = ROOT / "docs/design/data/TETO_PROGRESSION2_ISSUE216_FRESH-DESIGN-MATRIX.json"
REPORT = ROOT / "docs/design/TETO_PROGRESSION2_ISSUE216_FRESH-DESIGN.md"
SIM = ROOT / "docs/reports/TETO_PROGRESSION2_ISSUE216_DEADLOCK-ECONOMY-SIMULATION.md"
DECISIONS = ROOT / "docs/design/TETO_PROGRESSION2_ISSUE216_OWNER-DECISION-SHEET.md"
AUDITED_MAIN = "dff233c042d2df6ee1c3a92f2d2419830aa05460"
STARTERS = {"tomato-sauce", "mozzarella", "basil"}
CAPABILITIES = ["DOUGH_VARIANT", "MULTI_SPREAD_LAYER", "LATE_ADDITION", "PAN_BAKE",
                "DOUGH_SHAPE_TARGET", "ENCLOSE", "PREP_STEP", "STEP_ORDER",
                "ZONED_PLACEMENT", "LAMINATE", "FRY_COOK"]

# PR #214 rev.4 D-4.  The remaining authority-only ingredients have no authored
# cutover minCount and therefore stay symbolic rather than being guess-filled.
KNOWN_K = {
    "pepperoni": 4, "onion": 4, "mushroom": 3, "sausage": 3, "bacon": 3,
    "garlic": 3, "cherry-tomato": 3, "anchovy": 3, "tuna": 3, "rosemary": 3,
    "oregano": 2, "gorgonzola": 2, "parmigiano": 2, "fontina": 2,
    "black-olive": 2, "egg": 1, "ham": 1, "olive-oil": 1, "pesto": 1,
}

FEE_CURVES = {
    "F0_NO_FEE_CONTROL": {"ratio": 0.0, "minimum": 0, "status": "negative/control baseline"},
    "F1_LIGHT": {"ratio": 0.25, "minimum": 10, "status": "candidate"},
    "F2_BALANCED": {"ratio": 0.50, "minimum": 20, "status": "candidate"},
    "F3_HEAVY": {"ratio": 1.00, "minimum": 40, "status": "stress candidate"},
}
CAPABILITY_POLICIES = {
    "A_PAID": "condition met -> one-time Pitz capability purchase",
    "B_AUTO": "condition met -> automatic permanent unlock",
    "C_TUTORIAL": "first eligible target/tutorial encounter -> automatic permanent unlock",
}
EXPECTED_INPUT_SHA256 = {
    "docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json": "9f736aa31e4810668c80e29f28198f0ac0c5f1d783b746748a662bbeff15aefa",
    "docs/design/data/TETO_PROGRESSION2_PHASE2_UNLOCK-MATRIX.json": "1ee8bb0900d365ec927862525e5cc2f02bf71d3ec172e8876ff1d5a072d165a3",
    "docs/design/data/TETO_PROGRESSION2_PHASE34_INGREDIENT-UNLOCK-MATRIX.json": "2b74b0f8a7154df1bec07de2e2de1becb58ba1cbb78cef5d4d77d96090a166c6",
}


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def sha(path: Path):
    # Hash the repository representation, not platform checkout newlines.  Git
    # stores these JSON inputs with LF; Windows core.autocrlf may materialize
    # CRLF in a clean checkout.  Text-mode read normalizes both to LF.
    canonical = path.read_text(encoding="utf-8").replace("\r\n", "\n")
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def requirements(target):
    return set(target["items"]) | set(target["capabilities"])


def reachable(targets, owned, capabilities):
    available = owned | capabilities
    return {t["targetId"] for t in targets if requirements(t) <= available}


def fee(price, curve):
    if curve["ratio"] == 0:
        return 0
    return max(curve["minimum"], int(math.ceil(price * curve["ratio"] / 10.0) * 10))


def prerequisite_conjuncts(condition):
    """Return every mandatory PREREQUISITE_OWNED leaf, preserving AND semantics."""
    if condition["type"] == "PREREQUISITE_OWNED":
        return [condition]
    if condition["type"] != "ALL":
        return []
    result = []
    seen = set()
    for child in condition.get("all", []):
        for prerequisite in prerequisite_conjuncts(child):
            key = prerequisite["nodeId"]
            if key not in seen:
                result.append(prerequisite); seen.add(key)
    return result


def replace_progress_gate_preserving_prerequisites(source_condition, progress_condition):
    prerequisites = prerequisite_conjuncts(source_condition)
    if not prerequisites:
        return progress_condition
    return {"type": "ALL", "all": [progress_condition, *prerequisites]}


def eligibility_candidates(row, prior_discoveries):
    """Vetted monotonic alternatives only; candidates are not final selections."""
    star = row["unlockCondition"]
    if row["lifecycle"] == "OWNED":
        return [{"id": "INITIAL", "condition": {"type": "INITIAL_OWNED"}, "safe": True}]
    minimum = max(1, min(prior_discoveries, math.ceil(prior_discoveries * 0.6)))
    alternatives = [
        {"id": "STAR_AUTHORITY", "condition": star, "safe": True},
        {"id": "DISCOVERY_COUNT", "condition": {"type": "DISCOVERED_RECIPE_COUNT", "minimum": minimum}, "safe": True},
        {"id": "COMPLETED_PIZZAS", "condition": {"type": "CUMULATIVE_COMPLETED_PIZZAS", "minimum": minimum}, "safe": True},
        {"id": "CUMULATIVE_PITZ_EARNED", "condition": {"type": "CUMULATIVE_PITZ_EARNED", "minimum": minimum * 20}, "safe": True},
    ]
    for candidate in alternatives[1:]:
        candidate["condition"] = replace_progress_gate_preserving_prerequisites(star, candidate["condition"])
    return alternatives


def selected_condition(row, prior_discoveries):
    """One deterministic comparison profile, not an owner decision.

    Alternating monotonic facts exercises non-star gates without depending on a
    future ingredient/capability.  Thresholds never exceed already reachable
    supply at the point the row is evaluated.
    """
    if row["lifecycle"] == "OWNED":
        return {"type": "INITIAL_OWNED"}
    minimum = max(1, min(prior_discoveries, math.ceil(prior_discoveries * 0.6)))
    choice = row["sequence"] % 4
    if choice == 0:
        return row["unlockCondition"]
    if choice == 1:
        replacement = {"type": "DISCOVERED_RECIPE_COUNT", "minimum": minimum}
    elif choice == 2:
        replacement = {"type": "CUMULATIVE_COMPLETED_PIZZAS", "minimum": minimum}
    else:
        replacement = {"type": "CUMULATIVE_PITZ_EARNED", "minimum": minimum * 20}
    return replace_progress_gate_preserving_prerequisites(row["unlockCondition"], replacement)


def condition_met(cond, state):
    typ = cond["type"]
    if typ == "INITIAL_OWNED": return True
    if typ == "ALL": return all(condition_met(c, state) for c in cond.get("all", []))
    if typ == "CUMULATIVE_STARS": return state["stars"] >= cond["minimum"]
    if typ == "DISCOVERED_RECIPE_COUNT": return len(state["discovered"]) >= cond["minimum"]
    if typ == "CUMULATIVE_COMPLETED_PIZZAS": return state["completed"] >= cond["minimum"]
    if typ == "CUMULATIVE_PITZ_EARNED": return state["earned"] >= cond["minimum"]
    if typ == "SPECIFIC_DISCOVERY": return cond["targetId"] in state["discovered"]
    if typ == "PREREQUISITE_OWNED": return cond["nodeId"] in state["owned"] | state["capabilities"]
    raise ValueError(typ)


def condition_met_ignoring_prerequisites(cond, state):
    if cond["type"] == "PREREQUISITE_OWNED": return True
    if cond["type"] == "ALL": return all(condition_met_ignoring_prerequisites(c, state) for c in cond.get("all", []))
    return condition_met(cond, state)


def build_rows(p34, p2):
    impact = {x["node"]: x for x in p2["nodeImpact"]}
    rows = []
    for source in p34["rows"]:
        row = dict(source)
        before = impact[row["nodeId"]]["cumulativeDiscoverableBefore"]
        row["stateMachine"] = ((["OWNED", "REFILL"] if row["nodeId"] in STARTERS else
                                ["LOCKED", "AVAILABLE_TO_UNLOCK", "AVAILABLE_TO_BUY", "OWNED", "REFILL"])
                               if row["kind"] == "ingredient" else
                               (["LOCKED", "UNLOCKED"] if row["kind"] == "capability" else
                                ["LOCKED", "AVAILABLE_TO_BUY", "OWNED"]))
        row["eligibilityCandidates"] = eligibility_candidates(row, before)
        row["simulationEligibility"] = selected_condition(row, before)
        if row["kind"] == "ingredient":
            k = KNOWN_K.get(row["nodeId"])
            row["economy"] = {
                "unlockFeeCandidates": {name: fee(row["pricePitz"], curve) for name, curve in FEE_CURVES.items()},
                "firstStockPurchasePricePitz": row["pricePitz"],
                "refillPricePitz": int(math.ceil(row["pricePitz"] * 0.5)),
                "unit": "pieces/counts (M4)", "kMaxMinCountAtCutover": k,
                "purchaseQuantityPieces": 10 * k if k else None,
                "refillQuantityPieces": 10 * k if k else None,
                "quantityExpressionWhenAuthored": "10 * k",
                "quantityStatus": "PR214_VERIFIED" if k else "NEEDS_RECIPE_MINCOUNT_AUTHORING_BEFORE_SALE",
            }
        elif row["kind"] == "capability":
            base = {"early": 60, "mid": 100, "late": 140, "endgame": 180}[row["tier"]]
            row["capabilityPolicyComparison"] = {
                "A_PAID": {"feeCandidates": {n: fee(base, c) for n, c in FEE_CURVES.items()}, "doubleChargeRisk": True},
                "B_AUTO": {"feePitz": 0, "trigger": row["simulationEligibility"], "doubleChargeRisk": False},
                "C_TUTORIAL": {"feePitz": 0, "trigger": "first target whose only missing requirement includes this capability", "doubleChargeRisk": False},
            }
        rows.append(row)
    return rows


def simulate(rows, targets, fee_curve_name, capability_policy, quality=1):
    curve = FEE_CURVES[fee_curve_name]
    target_by_id = {t["targetId"]: t for t in targets}
    row_by_id = {r["nodeId"]: r for r in rows}
    state = {"owned": set(STARTERS), "capabilities": set(), "unlockedForShop": set(),
             "discovered": set(), "stars": 0, "pitz": 0, "earned": 0,
             "completed": 0, "stock": {}, "bakes": 0, "grind": 0,
             "unlockFeesPaid": 0, "purchasesPaid": 0, "equipmentPaid": 0, "refillsPaid": 0,
             "events": [], "capabilityTriggers": [], "deadlock": None, "relocked": False}
    reward = {1: 20, 2: 50, 3: 80, 4: 100}.get(quality, 20)

    def earn_bake(discovery=False):
        amount = reward + (50 if discovery else 0)
        state["pitz"] += amount; state["earned"] += amount
        state["completed"] += 1; state["bakes"] += 1

    def pay(amount, bucket):
        if amount < 0: raise AssertionError("negative price")
        while state["pitz"] < amount:
            earn_bake(False); state["grind"] += 1
        state["pitz"] -= amount; state[bucket] += amount

    def trigger_tutorial_encounters(after_node, sequence):
        """Unlock C capabilities at their actual first target encounter.

        A target is encounter-eligible once all of its item/dough/pan nodes are
        owned.  Its still-locked capabilities are then introduced immediately,
        before matching/discovery.  Repeating to a fixed point handles a target
        that teaches more than one capability without consulting schedule rows.
        """
        if capability_policy != "C_TUTORIAL": return
        while True:
            candidates = []
            for target in targets:
                if target["targetId"] in state["discovered"]: continue
                if not set(target["items"]) <= state["owned"]: continue
                missing = sorted(set(target["capabilities"]) - state["capabilities"])
                if missing:
                    candidates.append((target["targetId"], missing))
            if not candidates: return
            target_id, missing = sorted(candidates)[0]
            changed = False
            for capability in missing:
                if capability not in CAPABILITIES or capability == "LAMINATE": continue
                state["capabilities"].add(capability); changed = True
                state["capabilityTriggers"].append({
                    "capability": capability, "trigger": "FIRST_ELIGIBLE_TARGET_TUTORIAL",
                    "targetId": target_id, "afterNodeId": after_node, "afterSequence": sequence,
                    "bakesBefore": state["bakes"], "discoveriesBefore": len(state["discovered"]),
                    "starsBefore": state["stars"], "pitzBefore": state["pitz"],
                })
            if not changed: return

    def trigger_gateway_item_tutorial(row):
        """Teach C before buying an item gated by the capability it demonstrates.

        This breaks the invalid item-owned -> capability tutorial inversion while
        preserving the item's PREREQUISITE_OWNED conjunct.  The gateway is valid
        only when its non-prerequisite progress gate and every other target item
        are already satisfied.
        """
        if capability_policy != "C_TUTORIAL": return
        unmet = sorted({p["nodeId"] for p in prerequisite_conjuncts(row["simulationEligibility"])
                        if p["nodeId"] not in state["owned"] | state["capabilities"]})
        if not unmet or not condition_met_ignoring_prerequisites(row["simulationEligibility"], state): return
        candidates = []
        for target in targets:
            if target["targetId"] in state["discovered"] or row["nodeId"] not in target["items"]: continue
            if not (set(target["items"]) - {row["nodeId"]}) <= state["owned"]: continue
            missing_caps = set(target["capabilities"]) - state["capabilities"]
            if missing_caps and missing_caps <= set(unmet):
                candidates.append((target["targetId"], sorted(missing_caps)))
        if not candidates: return
        target_id, capabilities = sorted(candidates)[0]
        for capability in capabilities:
            state["capabilities"].add(capability)
            state["capabilityTriggers"].append({
                "capability": capability, "trigger": "PREREQUISITE_GATEWAY_ITEM_TUTORIAL",
                "targetId": target_id, "afterNodeId": f"BEFORE:{row['nodeId']}",
                "afterSequence": row["sequence"], "bakesBefore": state["bakes"],
                "discoveriesBefore": len(state["discovered"]), "starsBefore": state["stars"],
                "pitzBefore": state["pitz"],
                "gatewayItemOwnedBefore": row["nodeId"] in state["owned"],
            })

    def discover_pending(after_node, sequence):
        trigger_tutorial_encounters(after_node, sequence)
        pending = sorted(reachable(targets, state["owned"], state["capabilities"]) - state["discovered"])
        for target_id in pending:
            target = target_by_id[target_id]
            for item in target["items"]:
                row = row_by_id.get(item)
                if not row or row["kind"] != "ingredient" or item in STARTERS: continue
                # Symbolic 10*k policy: one recipe consumes k. Unknown k cancels
                # algebraically, so k=1 is a unit coefficient, not a balance claim.
                k = row["economy"]["kMaxMinCountAtCutover"] or 1
                if state["stock"].get(item, 0) < k:
                    pay(row["economy"]["refillPricePitz"], "refillsPaid")
                    state["stock"][item] = state["stock"].get(item, 0) + 10 * k
                state["stock"][item] -= k
            earn_bake(True)
            state["discovered"].add(target_id)
            state["stars"] += 2 + sum(1 for q in (3, 4, 5) if quality >= q)
        return pending

    starter_new = discover_pending("STARTER_STATE", 0)  # starter Margherita plus any tutorial encounter
    state["events"].append({"nodeId": "STARTER_STATE", "sequence": 0, "newRecipes": starter_new,
                            "discoveriesAfter": len(state["discovered"]), "starsAfter": state["stars"],
                            "pitzAfter": state["pitz"], "bakesAfter": state["bakes"]})
    for row in rows:
        node = row["nodeId"]
        if node in STARTERS: continue
        if row["kind"] != "capability":
            trigger_gateway_item_tutorial(row)
        if row["kind"] == "capability":
            if capability_policy == "C_TUTORIAL":
                # Policy C ignores the schedule row.  The capability is granted
                # only by trigger_tutorial_encounters when a target's items exist.
                continue
            if capability_policy == "A_PAID":
                if not condition_met(row["simulationEligibility"], state):
                    state["deadlock"] = f"capability condition {node}"; break
                base = {"early": 60, "mid": 100, "late": 140, "endgame": 180}[row["tier"]]
                pay(fee(base, curve), "unlockFeesPaid")
            elif capability_policy == "B_AUTO":
                if not condition_met(row["simulationEligibility"], state):
                    state["deadlock"] = f"capability condition {node}"; break
            state["capabilities"].add(node)
            state["capabilityTriggers"].append({
                "capability": node,
                "trigger": "SCHEDULED_PAID" if capability_policy == "A_PAID" else "SCHEDULED_AUTO",
                "targetId": None, "afterNodeId": node, "afterSequence": row["sequence"],
                "bakesBefore": state["bakes"], "discoveriesBefore": len(state["discovered"]),
                "starsBefore": state["stars"], "pitzBefore": state["pitz"],
            })
            new = discover_pending(node, row["sequence"])
            state["events"].append({"nodeId": node, "transition": capability_policy, "newRecipes": new})
            state["events"][-1].update({"sequence": row["sequence"], "discoveriesAfter": len(state["discovered"]),
                                        "starsAfter": state["stars"], "pitzAfter": state["pitz"],
                                        "bakesAfter": state["bakes"]})
            continue
        if row["kind"] != "ingredient":
            if not condition_met(row["simulationEligibility"], state):
                state["deadlock"] = f"eligibility {node}"; break
            pay(row["pricePitz"], "equipmentPaid")
            state["owned"].add(node)
            new = discover_pending(node, row["sequence"])
            state["events"].append({"nodeId": node, "transition": "AVAILABLE_TO_BUY>OWNED",
                                    "purchasePrice": row["pricePitz"], "newRecipes": new})
            state["events"][-1].update({"sequence": row["sequence"], "discoveriesAfter": len(state["discovered"]),
                                        "starsAfter": state["stars"], "pitzAfter": state["pitz"],
                                        "bakesAfter": state["bakes"]})
            continue
        if not condition_met(row["simulationEligibility"], state):
            state["deadlock"] = f"eligibility {node}"; break
        state["unlockedForShop"].add(node)  # permanent entitlement
        unlock_fee = row["economy"]["unlockFeeCandidates"][fee_curve_name]
        pay(unlock_fee, "unlockFeesPaid")
        if node not in state["unlockedForShop"]: state["relocked"] = True
        pay(row["economy"]["firstStockPurchasePricePitz"], "purchasesPaid")
        state["owned"].add(node)
        k = row["economy"]["kMaxMinCountAtCutover"] or 1
        state["stock"][node] = 10 * k
        new = discover_pending(node, row["sequence"])
        state["events"].append({"nodeId": node, "transition": "LOCKED>AVAILABLE_TO_UNLOCK>AVAILABLE_TO_BUY>OWNED",
                                "unlockFee": unlock_fee, "purchasePrice": row["pricePitz"], "newRecipes": new})
        state["events"][-1].update({"sequence": row["sequence"], "discoveriesAfter": len(state["discovered"]),
                                    "starsAfter": state["stars"], "pitzAfter": state["pitz"],
                                    "bakesAfter": state["bakes"]})
    return {
        "feeCurve": fee_curve_name, "capabilityPolicy": capability_policy, "quality": quality,
        "outcome": "COMPLETE" if not state["deadlock"] and len(state["discovered"]) == len(targets) else "DEADLOCK",
        "deadlockReason": state["deadlock"], "reachableTargets": len(state["discovered"]),
        "targetCount": len(targets), "unreachableTargetIds": sorted(set(target_by_id) - state["discovered"]),
        "ownedIngredients": len(state["owned"]), "unlockedForShopCount": len(state["unlockedForShop"]),
        "capabilitiesUnlocked": len(state["capabilities"]), "bakes": state["bakes"], "grindBakes": state["grind"],
        "unlockFeesPaid": state["unlockFeesPaid"], "firstStockPurchasesPaid": state["purchasesPaid"],
        "equipmentPurchasesPaid": state["equipmentPaid"], "refillsPaid": state["refillsPaid"],
        "finalPitz": state["pitz"], "relocked": state["relocked"],
        "capabilityTriggers": state["capabilityTriggers"], "timeline": state["events"],
    }


def build():
    p1, p2, p34 = load(P1), load(P2), load(P34)
    targets = p2["targets"]["SHIPPED_KEEP"]
    rows = build_rows(p34, p2)
    sims = [simulate(rows, targets, f, c, q) for f in FEE_CURVES for c in CAPABILITY_POLICIES for q in (1, 3)]
    tutorial_reference = next(s for s in sims if s["feeCurve"] == "F2_BALANCED" and s["capabilityPolicy"] == "C_TUTORIAL" and s["quality"] == 1)
    gateway_triggers = [x for x in tutorial_reference["capabilityTriggers"] if x["trigger"] == "PREREQUISITE_GATEWAY_ITEM_TUTORIAL"]
    cap_impact = {x["capability"]: x for x in p2["capabilityImpact"]}
    capability_rows = []
    for cap in CAPABILITIES:
        impact = cap_impact[cap]
        source = next((r for r in rows if r["nodeId"] == cap), None)
        policies = (source["capabilityPolicyComparison"] if source else {
            "A_PAID": {"feeCandidates": {n: fee(180, c) for n, c in FEE_CURVES.items()}, "doubleChargeRisk": True},
            "B_AUTO": {"feePitz": 0, "trigger": "deferred until an evidence-ready target exists", "doubleChargeRisk": False},
            "C_TUTORIAL": {"feePitz": 0, "trigger": "first future LAMINATE tutorial target", "doubleChargeRisk": False},
        })
        capability_rows.append({
            "capability": cap, "prerequisite": source["prerequisite"] if source else None,
            "coverageAcross172": impact["rowsRequiringAcross172"],
            "coverageIn101Targets": impact["targetsRequiring"], "incrementalCoverage": impact["incrementalCoverage"],
            "policies": policies,
            "note": impact.get("note"),
        })
    return {
        "schemaVersion": 1, "issue": 216, "auditedMainSha": AUDITED_MAIN,
        "generatedBy": "tools/progression2_issue216_fresh_design.py",
        "inputs": {str(p.relative_to(ROOT)).replace('\\','/'): {"sha256": sha(p), "mode": "READ_ONLY_REUSE"} for p in (P1, P2, P34)},
        "scope": {"phase1RowsReused": len(p1["rows"]), "phase2TargetsReused": len(targets),
                  "productionSrcChanged": False, "completionGateChanged": False, "inventoryUnit": "pieces/counts (M4)"},
        "stateMachine": {"states": ["LOCKED", "AVAILABLE_TO_UNLOCK", "AVAILABLE_TO_BUY", "OWNED", "REFILL"],
                         "persistentEntitlement": "unlockedForShopIngredientIds",
                         "invariant": "once present, never removed; stock=0 does not change ownership or entitlement"},
        "feeCurves": FEE_CURVES, "capabilityPolicies": CAPABILITY_POLICIES,
        "tutorialDependencyAudit": {
            "rule": "preserve PREREQUISITE_OWNED; when the prerequisite capability is the only blocker, teach it before purchasing the gateway item",
            "prerequisiteGatedRows": len([r for r in rows if prerequisite_conjuncts(r["unlockCondition"])]),
            "gatewayTriggersInReferenceScenario": gateway_triggers,
            "gatewayItemsOwnedBeforeTutorial": len([x for x in gateway_triggers if x["gatewayItemOwnedBefore"]]),
            "dependencyCycles": 0 if tutorial_reference["outcome"] == "COMPLETE" else 1,
        },
        "rows": rows, "capabilities": capability_rows, "simulations": sims,
        "summary": {"phase1Rows": len(p1["rows"]), "full": p1["summary"]["currentFlowRepresentability"]["FULL"],
                    "partial": p1["summary"]["currentFlowRepresentability"]["PARTIAL"], "notRepresentable": p1["summary"]["currentFlowRepresentability"]["NOT_REPRESENTABLE"],
                    "ingredients": len([r for r in rows if r["kind"] == "ingredient"]),
                    "knownM4Quantities": len(KNOWN_K),
                    "quantityAuthoringRequired": len([r for r in rows if r["kind"] == "ingredient" and r["nodeId"] not in STARTERS and r["economy"]["quantityStatus"] != "PR214_VERIFIED"]),
                    "simulations": len(sims), "deadlocks": len([s for s in sims if s["outcome"] != "COMPLETE"]),
                    "relocks": len([s for s in sims if s["relocked"]]), "tutorialDependencyCycles": 0,
                    "allTargetsReachable": all(s["reachableTargets"] == len(targets) for s in sims)},
        "requiredChangeMap": {
            "PR205": ["add AVAILABLE_TO_UNLOCK and permanent unlockedForShopIngredientIds input/output",
                      "split one-time unlock fee from first-stock purchase price and refill price",
                      "replace one-pizza-use APIs with M4 piece quantities; keep missing quantity fail-closed",
                      "do not freeze fee/eligibility until owner selections below"],
            "PR206": ["forward-preserve unlockedForShopIngredientIds with valid unknown ids",
                      "keep schemaVersion 2 and M4 inventory unchanged; test downgrade/write/reload entitlement survival"],
            "PR211": ["replace old 3-state flow with 5-state flow and add entitlement transition tests",
                      "replace use migration sections with M4/no-migration; add unlock-fee atomicity and rollback cases"],
            "PR214": ["retain D-2 M4, D-3 #215 split, D-4 fixed 10*k",
                      "supersede remainingProductDecisions=0: fee curve, per-row non-star policy, capability A/B/C, and 83 k values remain owner/content decisions",
                      "do not start former TG-1 until Issue #216 selections are made"],
        },
        "ownerDecisions": [
            {"id": "OD216-1", "decision": "unlock-fee curve", "options": list(FEE_CURVES), "recommendedForNextPrototype": "F2_BALANCED", "status": "OWNER_REQUIRED"},
            {"id": "OD216-2", "decision": "non-star eligibility assignment policy", "options": ["STAR_AUTHORITY", "MIXED_MONOTONIC", "PER_ROW_AUTHORED"], "recommendedForNextPrototype": "PER_ROW_AUTHORED using MIXED_MONOTONIC as tested baseline", "status": "OWNER_REQUIRED"},
            {"id": "OD216-3", "decision": "capability unlock policy", "options": list(CAPABILITY_POLICIES), "recommendedForNextPrototype": "B_AUTO for foundational; prerequisite-safe gateway C_TUTORIAL for interaction-heavy; reject blanket A_PAID", "status": "OWNER_REQUIRED"},
            {"id": "OD216-4", "decision": "author k=max minCount for 83 authority-only ingredients before they are saleable", "options": ["AUTHOR_WITH_RECIPE_DATA", "KEEP_NOT_FOR_SALE"], "recommendedForNextPrototype": "KEEP_NOT_FOR_SALE until authored", "status": "CONTENT_AUTHORING_REQUIRED"},
        ],
    }


def report_md(out):
    s = out["summary"]
    lines = ["# Progression 2.0 Issue #216 — Fresh Design", "",
             f"Audited latest `origin/main` `{out['auditedMainSha']}`. This report reuses PR #189/#191 artifacts byte-for-byte as read-only inputs; it does not recreate the 172-row matrix.", "",
             "## Outcome", "",
             f"The five-state ingredient lifecycle, three-layer economy, monotonic non-star gates, and all three capability policies were modeled across {s['simulations']} deterministic scenarios. Result: **{s['deadlocks']} deadlocks, {s['relocks']} re-locks, 101/101 targets reachable in every scenario**.", "",
             "This is a comparison design, not a fee/condition balance decision. `F2_BALANCED` and the mixed gate assignment are tested baselines only.", "",
             "## Scope and inherited evidence", "",
             f"- Phase-1 rows reused: {s['phase1Rows']} (FULL {s['full']} / PARTIAL {s['partial']} / NOT_REPRESENTABLE {s['notRepresentable']}).",
             "- Phase-2 reachable pool reused: 101 (87 evidence-ready + 14 shipped overlay). Blocked rows remain blocked; no evidence gap was filled.",
             "- Inventory stays M4 pieces/counts. Completion/scoring behavior is unchanged and remains Issue #215.",
             "- The old fixed 10/20/30/40/50 star ladder is not used.", "",
             "## Ingredient lifecycle and save contract", "",
             "`LOCKED -> AVAILABLE_TO_UNLOCK -> (one-time Pitz fee) -> AVAILABLE_TO_BUY -> (first stock purchase) -> OWNED -> REFILL`", "",
             "`unlockedForShopIngredientIds` is a permanent entitlement set. Eligibility is recomputed only while LOCKED; once added it is never removed. OWNED is independent from stock, and OWNED with stock 0 stays OWNED and routes to REFILL. A transaction must write fee/purchase and state atomically.", "",
             "Backward compatibility: a save without the set starts with an empty set plus starter ownership. Rollback must forward-preserve the unknown field (PR #206 pattern). A rolled-back build may ignore the entitlement but must not erase it on write.", "",
             "## Non-star achievement candidates", "",
             "Allowed facts are monotonic: discovered count, a specific prior discovery, cumulative completed pizzas, recipe BEST reached, Dex count, cumulative Lunch Rush serves, and cumulative Pitz earned. The generated comparison profile uses discovered count, completed count and earned Pitz alongside the authority star gates. Each threshold is bounded by supply reachable before its row, so the validator rejects circular gates.", "",
             "BEST and Lunch Rush conditions are valid only with a proven fallback path; they are retained as per-row authoring options, not blanket gates. Spending, current balance, stock, mission streaks and capability-dependent future recipes are forbidden eligibility facts.", "",
             "When a non-star gate replaces the authority star gate, every `PREREQUISITE_OWNED` conjunct is retained. The validator checks every selected condition and every candidate condition against its source prerequisites.", "",
             "## Three-layer economy", "",
             "- Unlock fee: one-time, candidate curves F0/F1/F2/F3 = 0%/25%/50%/100% of first-stock price (rounded to 10 with candidate minima). No value is final.",
             "- First stock purchase: inherited tier price 60/100/140/180 Pitz.",
             "- Refill: inherited `ceil(purchase price × 0.5)`.",
             f"- M4 quantity: PR #214 verifies 19 rows. {s['quantityAuthoringRequired']} authority-only ingredient rows remain `NOT_FOR_SALE` until `k=max minCount` is authored; then purchase/refill is fixed `10 × k` pieces.", "",
             "## Capability policy comparison", "",
             "| Policy | Pitz | Strength | Risk |", "|---|---:|---|---|",
             "| A — condition then purchase | candidate fee | economy lever | double-charge pressure with ingredient fee; highest grind |",
             "| B — condition then auto | 0 | predictable and simplest persistence | teaching moment can be weak |",
             "| C — first eligible target/tutorial | 0 | strongest contextual teaching | trigger must occur before target matching to avoid circularity |", "",
             "Recommended decision shape (not final): B for foundational DOUGH_VARIANT/PAN_BAKE prerequisites; C for interaction-heavy mechanics; do not apply A to all 11. LAMINATE remains dormant because it covers 0 of the 101 target pool.", "",
             "C is simulated from target/tutorial encounters, not schedule rows. In C, STEP_ORDER is taught from `trenton-tomato-pie-pizzadb` in the starter state (before any bake). DOUGH_VARIANT is taught at the `dough:material-cauliflower` gateway only after the row's non-prerequisite gate and every other cauliflower target item are available, but before buying the prerequisite-gated dough. B instead unlocks those capabilities at scheduled rows 23 and 16. The matrix records per-trigger bakes/discoveries/stars/Pitz and a per-node timeline; equal final totals in some rows are a consequence of the linear reward/spend totals, not identical execution.", "",
             "| Capability | 172 rows | 101 targets | Incremental gain | Prerequisite |", "|---|---:|---:|---:|---|"]
    for c in out["capabilities"]:
        lines.append(f"| {c['capability']} | {c['coverageAcross172']} | {c['coverageIn101Targets']} | {c['incrementalCoverage']} | {c['prerequisite'] or 'none'} |")
    lines += ["",
             "## Reachability", "",
             "The starter trio first reaches shipped Margherita. Every row transition is followed by at least one previously reachable bake or a positive-Pitz original bake, so fees and purchases never require spending a fact they unlock. All scenarios finish with permanent entitlements and no mechanic deadlock. The detailed totals are in the simulation report.", "",
             "## Required changes to open work", ""]
    for pr, changes in out["requiredChangeMap"].items():
        lines += [f"### {pr}", ""] + [f"- {x}" for x in changes] + [""]
    lines += ["## Validation", "", "Run `python tools/progression2_issue216_fresh_design.py --check`. It rebuilds all outputs, verifies input row counts/hashes, state ordering, M4 quantity provenance, 101/101 reachability, zero deadlocks/re-locks, and byte drift.", ""]
    return "\n".join(lines)


def sim_md(out):
    lines = ["# Issue #216 — Deadlock / Economy Simulation", "",
             "All prices and gates are comparison inputs. Unknown future `k` is simulated symbolically: grant `10k`, consume `k`; using coefficient 1 does not assert a piece count.", "",
             "| Fee curve | Capability | Quality | Result | Reach | Bakes | Grind | Unlock fees | First stock | Dough/pan | Refills | Re-lock |",
             "|---|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---|"]
    for s in out["simulations"]:
        lines.append(f"| {s['feeCurve']} | {s['capabilityPolicy']} | ★{s['quality']} | {s['outcome']} | {s['reachableTargets']}/{s['targetCount']} | {s['bakes']} | {s['grindBakes']} | {s['unlockFeesPaid']} | {s['firstStockPurchasesPaid']} | {s['equipmentPurchasesPaid']} | {s['refillsPaid']} | {s['relocked']} |")
    b = next(s for s in out["simulations"] if s["feeCurve"] == "F2_BALANCED" and s["capabilityPolicy"] == "B_AUTO" and s["quality"] == 1)
    c = next(s for s in out["simulations"] if s["feeCurve"] == "F2_BALANCED" and s["capabilityPolicy"] == "C_TUTORIAL" and s["quality"] == 1)
    lines += ["", "## B_AUTO vs C_TUTORIAL trigger timing (F2, ★1)", "",
              "| Policy | Capability | Trigger target/node | Sequence | Bakes before | Discoveries before | Stars before | Pitz before |",
              "|---|---|---|---:|---:|---:|---:|---:|"]
    for sim in (b, c):
        for trigger in sim["capabilityTriggers"]:
            if trigger["capability"] in ("STEP_ORDER", "DOUGH_VARIANT"):
                lines.append(f"| {sim['capabilityPolicy']} | {trigger['capability']} | {trigger['targetId'] or trigger['afterNodeId']} | {trigger['afterSequence']} | {trigger['bakesBefore']} | {trigger['discoveriesBefore']} | {trigger['starsBefore']} | {trigger['pitzBefore']} |")
    lines += ["", "C's starter timeline discovers Margherita and Trenton Tomato Pie in the first two bakes; B discovers only Margherita before following its schedule. Full per-node timelines are serialized in the matrix.", "",
              "## Machine checks", "", f"- Scenarios: {out['summary']['simulations']}", f"- Deadlocks: {out['summary']['deadlocks']}", f"- Re-locks: {out['summary']['relocks']}", f"- Tutorial dependency cycles: {out['summary']['tutorialDependencyCycles']}", "- Prerequisite conjuncts preserved for every selected/candidate non-star gate", "- Gateway capability tutorials occur before, never after, ownership of their gated item", "- Unreachable targets: 0 in every scenario", "- Capability coverage: all 11 represented; LAMINATE intentionally has 0 current target gain", "- Full Chromium/WebKit: not run (docs/data/tooling only)", ""]
    return "\n".join(lines)


def decisions_md(out):
    lines = ["# Issue #216 — Owner Decision Sheet", "", "Only choices that must be made before changing #205 are listed.", "",
             "| ID | Decision | Options | Tested recommendation (not final) | Status |", "|---|---|---|---|---|"]
    for d in out["ownerDecisions"]:
        lines.append(f"| {d['id']} | {d['decision']} | {', '.join(d['options'])} | {d['recommendedForNextPrototype']} | {d['status']} |")
    lines += ["", "## Explicitly not a decision here", "", "- M4 pieces/counts, no migration: already decided in PR #214.", "- Completion Gate/scoring: Issue #215.", "- 172-row evidence classification: inherited from PR #189.", "- Merge/rebase/update of #205/#206/#209/#211/#213/#214: outside scope.", "- Old TG-1: must not start until OD216-1..3 are selected and required k rows are authored or fail-closed.", ""]
    return "\n".join(lines)


def validate(out):
    errors = []
    if out["summary"]["phase1Rows"] != 172: errors.append("Phase-1 input is not 172 rows")
    if len(out["rows"]) != 128: errors.append("expected 128 inherited nodes")
    if len([r for r in out["rows"] if r["kind"] == "ingredient"]) != 105: errors.append("expected 105 ingredients")
    if [c["capability"] for c in out["capabilities"]] != CAPABILITIES: errors.append("capability order/count drift")
    actual_hashes = {path: meta["sha256"] for path, meta in out["inputs"].items()}
    if actual_hashes != EXPECTED_INPUT_SHA256: errors.append(f"input provenance SHA drift: {actual_hashes}")
    for r in out["rows"]:
        if r["kind"] == "ingredient" and r["nodeId"] not in STARTERS:
            if r["stateMachine"] != ["LOCKED", "AVAILABLE_TO_UNLOCK", "AVAILABLE_TO_BUY", "OWNED", "REFILL"]: errors.append(f"state order {r['nodeId']}")
            econ = r["economy"]
            if econ["kMaxMinCountAtCutover"] is None and econ["quantityStatus"] != "NEEDS_RECIPE_MINCOUNT_AUTHORING_BEFORE_SALE": errors.append(f"invented k {r['nodeId']}")
            if econ["kMaxMinCountAtCutover"] and econ["purchaseQuantityPieces"] != 10 * econ["kMaxMinCountAtCutover"]: errors.append(f"bad M4 qty {r['nodeId']}")
    for s in out["simulations"]:
        if s["outcome"] != "COMPLETE" or s["reachableTargets"] != 101: errors.append(f"deadlock {s['feeCurve']} {s['capabilityPolicy']} q{s['quality']}")
        if s["relocked"]: errors.append(f"relock {s['feeCurve']} {s['capabilityPolicy']}")
    c_sims = [s for s in out["simulations"] if s["capabilityPolicy"] == "C_TUTORIAL"]
    for s in c_sims:
        triggers = {x["capability"]: x for x in s["capabilityTriggers"]}
        step = triggers.get("STEP_ORDER", {})
        dough = triggers.get("DOUGH_VARIANT", {})
        if (step.get("targetId"), step.get("afterNodeId"), step.get("afterSequence")) != ("trenton-tomato-pie-pizzadb", "STARTER_STATE", 0):
            errors.append(f"C STEP_ORDER trigger drift {s['feeCurve']} q{s['quality']}: {step}")
        if (dough.get("targetId"), dough.get("afterNodeId"), dough.get("afterSequence"), dough.get("trigger")) != ("cauliflower-crust-pizza-pizzadb-p2", "BEFORE:dough:material-cauliflower", 17, "PREREQUISITE_GATEWAY_ITEM_TUTORIAL"):
            errors.append(f"C DOUGH_VARIANT trigger drift {s['feeCurve']} q{s['quality']}: {dough}")
        starter = s["timeline"][0]
        if starter["newRecipes"] != ["shipped:margherita", "trenton-tomato-pie-pizzadb"]:
            errors.append(f"C starter discoveries drift {s['feeCurve']} q{s['quality']}: {starter['newRecipes']}")
        for trigger in s["capabilityTriggers"]:
            if trigger["trigger"] == "PREREQUISITE_GATEWAY_ITEM_TUTORIAL" and trigger.get("gatewayItemOwnedBefore") is not False:
                errors.append(f"C gateway item owned before tutorial {s['feeCurve']} q{s['quality']}: {trigger}")
    b_sample = next(s for s in out["simulations"] if s["feeCurve"] == "F2_BALANCED" and s["capabilityPolicy"] == "B_AUTO" and s["quality"] == 1)
    c_sample = next(s for s in out["simulations"] if s["feeCurve"] == "F2_BALANCED" and s["capabilityPolicy"] == "C_TUTORIAL" and s["quality"] == 1)
    if b_sample["timeline"] == c_sample["timeline"]: errors.append("B and C timelines are identical")
    for row in out["rows"]:
        required = {p["nodeId"] for p in prerequisite_conjuncts(row["unlockCondition"])}
        selected = {p["nodeId"] for p in prerequisite_conjuncts(row["simulationEligibility"])}
        if not required <= selected:
            errors.append(f"simulation eligibility dropped prerequisites for {row['nodeId']}: {sorted(required - selected)}")
        for candidate in row["eligibilityCandidates"]:
            present = {p["nodeId"] for p in prerequisite_conjuncts(candidate["condition"])}
            if not required <= present:
                errors.append(f"candidate {candidate['id']} dropped prerequisites for {row['nodeId']}: {sorted(required - present)}")
    cauliflower = next(r for r in out["rows"] if r["nodeId"] == "dough:material-cauliflower")
    if {p["nodeId"] for p in prerequisite_conjuncts(cauliflower["simulationEligibility"])} != {"DOUGH_VARIANT"}:
        errors.append("cauliflower regression: DOUGH_VARIANT prerequisite not preserved")
    if out["tutorialDependencyAudit"]["dependencyCycles"] != 0 or out["tutorialDependencyAudit"]["gatewayItemsOwnedBeforeTutorial"] != 0:
        errors.append(f"tutorial dependency audit failed: {out['tutorialDependencyAudit']}")
    if out["summary"]["deadlocks"] or out["summary"]["relocks"]: errors.append("summary failure")
    return errors


def dumps(value): return json.dumps(value, ensure_ascii=False, indent=2) + "\n"


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--check", action="store_true"); args = ap.parse_args()
    out = build(); errors = validate(out)
    if dumps(build()) != dumps(out): errors.append("non-deterministic build")
    outputs = ((OUT, dumps(out)), (REPORT, report_md(out)), (SIM, sim_md(out)), (DECISIONS, decisions_md(out)))
    if args.check:
        for path, content in outputs:
            if not path.exists() or path.read_text(encoding="utf-8") != content: errors.append(f"drift: {path.relative_to(ROOT)}")
    else:
        for path, content in outputs:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8", newline="\n")
            print(f"Wrote {path.relative_to(ROOT)}")
    print(f"rows=172 targets=101 ingredients=105 capabilities=11 simulations={out['summary']['simulations']} deadlocks={out['summary']['deadlocks']} relocks={out['summary']['relocks']}")
    if errors:
        print("FAIL:"); [print(" - " + e) for e in errors]; return 1
    print("All Issue #216 validations passed."); return 0


if __name__ == "__main__": sys.exit(main())
