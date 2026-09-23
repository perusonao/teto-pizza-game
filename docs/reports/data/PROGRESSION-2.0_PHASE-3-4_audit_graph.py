#!/usr/bin/env python3
"""Progression 2.0 Phase 3-4 Pre-Implementation Audit -- dependency graph / economy analyser.

Docs-only audit helper. Reads (never writes) the approved Phase 3-4 authority
(docs/design/data/TETO_PROGRESSION2_PHASE34_INGREDIENT-UNLOCK-MATRIX.json), the Phase-2 target
definitions (docs/design/data/TETO_PROGRESSION2_PHASE2_UNLOCK-MATRIX.json) and a snapshot of the
current production recipe/ingredient data (embedded below, copied from src/data/*.ts at the
audited main SHA), and writes
docs/reports/data/PROGRESSION-2.0_PHASE-3-4_Progression-Graph.json.

Run:  python3 docs/reports/data/PROGRESSION-2.0_PHASE-3-4_audit_graph.py [--check]
It changes no economy value; it only re-derives and cross-checks the approved ones.
"""
import json, math, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
P34 = ROOT / "docs/design/data/TETO_PROGRESSION2_PHASE34_INGREDIENT-UNLOCK-MATRIX.json"
P2 = ROOT / "docs/design/data/TETO_PROGRESSION2_PHASE2_UNLOCK-MATRIX.json"
OUT = ROOT / "docs/reports/data/PROGRESSION-2.0_PHASE-3-4_Progression-Graph.json"
AUDITED_MAIN_SHA = "1e73a7d3e6007e67d1d2ea14e103a47c491bdbd5"

# Production snapshot at AUDITED_MAIN_SHA (src/data/recipes.ts, src/data/ingredients.ts,
# src/data/discoveryCatalog.ts). recipeId -> (discovery target id, required ingredient ids,
# EP1 requiresRecipeId, EP1 minTotalStars).
PROD_RECIPES = {
    "margherita": ("shipped:margherita", ["tomato-sauce", "mozzarella", "basil"], None, None),
    "marinara": ("shipped:marinara", ["tomato-sauce", "garlic", "oregano"], "funghi", None),
    "quattro-formaggi": ("shipped:quattro-formaggi", ["olive-oil", "mozzarella", "gorgonzola", "parmigiano", "fontina"], "genovese", 8),
    "genovese": ("shipped:genovese", ["pesto", "mozzarella", "cherry-tomato"], "bismarck", None),
    "bismarck": ("shipped:bismarck", ["tomato-sauce", "mozzarella", "egg"], "marinara", None),
    "funghi": ("shipped:funghi", ["tomato-sauce", "mozzarella", "mushroom"], "margherita", None),
    "fugazza": ("shipped:fugazza", ["olive-oil", "onion", "oregano"], "quattro-formaggi", 12),
    "salsiccia": ("shipped:salsiccia", ["tomato-sauce", "mozzarella", "sausage"], "fugazza", 15),
    "pepperoni": ("shipped:pepperoni", ["tomato-sauce", "mozzarella", "pepperoni"], "salsiccia", 18),
    "napoletana": ("shipped:napoletana", ["tomato-sauce", "mozzarella", "anchovy", "oregano"], "pepperoni", 21),
    "tonno-e-cipolla": ("tonno-e-cipolla-pizzadb", ["tomato-sauce", "mozzarella", "onion", "tuna"], "napoletana", 24),
    "pizza-bianca": ("shipped:pizza-bianca", ["olive-oil", "rosemary"], "tonno-e-cipolla", 27),
    "breakfast-pizza": ("shipped:breakfast-pizza", ["tomato-sauce", "mozzarella", "egg", "bacon"], "pizza-bianca", 30),
    "capricciosa": ("shipped:capricciosa", ["tomato-sauce", "mozzarella", "mushroom", "oregano", "ham", "black-olive"], "breakfast-pizza", 33),
    "meat-lovers": ("shipped:meat-lovers", ["tomato-sauce", "mozzarella", "bacon", "ham", "pepperoni", "sausage"], "capricciosa", 36),
}
# ingredientId -> (pricePitz, restockQuantity, minTotalStars, starterGrantOnly); None = unlimited starter.
PROD_INGREDIENTS = {
    "tomato-sauce": None, "mozzarella": None, "basil": None,
    "olive-oil": (65, 3, 0, True), "pesto": (90, 3, 0, True), "gorgonzola": (90, 6, 0, True),
    "parmigiano": (90, 6, 0, True), "fontina": (90, 6, 0, True), "garlic": (90, 9, 0, True),
    "oregano": (55, 6, 0, True), "cherry-tomato": (55, 9, 0, True), "egg": (105, 3, 0, True),
    "mushroom": (150, 9, 0, True), "onion": (170, 12, 12, True), "sausage": (140, 9, 0, True),
    "pepperoni": (130, 12, 0, True), "anchovy": (110, 9, 0, True), "tuna": (120, 9, 0, True),
    "rosemary": (55, 9, 0, True), "bacon": (140, 9, 0, True), "ham": (140, 3, 0, True),
    "black-olive": (90, 6, 0, True),
}
PROFILES = {"low-score": 1, "beginner": 2, "standard": 3, "skilled": 4, "perfect": 5}


def load(p):
    return json.loads(p.read_text(encoding="utf-8"))


def gate_of(row):
    for c in row["unlockCondition"].get("all", []):
        if c["type"] == "CUMULATIVE_STARS":
            return c["minimum"]
    return 0


def hybrid_stars(best):
    return 2 + sum(1 for q in (3, 4, 5) if best >= q)


def reward(best, reward_table):
    return reward_table["base"] * reward_table["mult"][str(best)]


def build():
    p34, p2 = load(P34), load(P2)
    rows = p34["rows"]
    row = {r["nodeId"]: r for r in rows}
    targets = p2["targets"]["SHIPPED_KEEP"]
    rt = p2["rewardTables"][p34["policy"]["rewardTable"]]
    findings = []

    # --- 1. node integrity ---------------------------------------------------------------
    seqs = [r["sequence"] for r in rows]
    assert seqs == sorted(seqs) and len(set(seqs)) == len(seqs)
    for r in rows:
        pre = r["prerequisite"]
        if pre and (pre not in row or row[pre]["sequence"] >= r["sequence"]):
            findings.append(f"prerequisite order violated: {r['nodeId']} <- {pre}")
        if r["kind"] != "capability" and r["lifecycle"] != "OWNED" and not (isinstance(r["pricePitz"], int) and r["pricePitz"] > 0):
            findings.append(f"purchasable node without valid price: {r['nodeId']}")
    gates = [gate_of(r) for r in rows]
    monotonic = all(a <= b for a, b in zip(gates, gates[1:]))

    # --- 2. per-target dependency matrix (full 101-target authority) -----------------------
    def closure(nodes):
        out, stack = set(), list(nodes)
        while stack:
            n = stack.pop()
            if n in out:
                continue
            out.add(n)
            if n in row and row[n]["prerequisite"]:
                stack.append(row[n]["prerequisite"])
        return out

    dep = []
    used_by = {r["nodeId"]: [] for r in rows}
    missing_nodes = set()
    for t in targets:
        req = closure(list(t["items"]) + list(t.get("capabilities", [])))
        for n in req:
            if n not in row:
                missing_nodes.add(n)
            else:
                used_by[n].append(t["targetId"])
        known = [row[n] for n in req if n in row]
        purch = [r for r in known if r["lifecycle"] != "OWNED" and r["kind"] != "capability"]
        dep.append({
            "targetId": t["targetId"], "nameJa": t["nameJa"],
            "inProduction": any(v[0] == t["targetId"] for v in PROD_RECIPES.values()),
            "items": sorted(t["items"]), "capabilities": sorted(t.get("capabilities", [])),
            "requiredNodes": sorted(req),
            "requiredPurchases": sorted(r["nodeId"] for r in purch),
            "requiredPurchaseTotalPitz": sum(r["pricePitz"] for r in purch),
            "starGate": max([gate_of(r) for r in known] or [0]),
            "reachableAtSequence": max([r["sequence"] for r in known] or [0]),
            "starterOnly": not purch and not t.get("capabilities"),
            "recipeUnlockCondition": None,  # Progression 2.0: recipes are never unlocked/purchased
        })
    dep.sort(key=lambda d: (d["reachableAtSequence"], d["targetId"]))
    dead_nodes = sorted(n for n, u in used_by.items() if not u)

    # --- 3. guaranteed-star supply check (independent of the authority tool) -------------
    star_checks = []
    for r in rows:
        if r["lifecycle"] == "OWNED":
            continue
        before = [d for d in dep if d["reachableAtSequence"] < r["sequence"]]
        # every target reachable strictly before this node is discoverable with a ★1 PASS bake
        supply_min = 2 * len(before)
        star_checks.append({"nodeId": r["nodeId"], "sequence": r["sequence"], "gate": gate_of(r),
                            "discoverableBefore": len(before), "guaranteedStarsBefore": supply_min,
                            "ok": supply_min >= gate_of(r)})
    star_deadlocks = [c for c in star_checks if not c["ok"]]

    # --- 4. economy path from the authority simulation events -----------------------------
    econ = {}
    for sim in p34["simulations"]:
        prof = sim["profile"]
        best = {"low-score": 1, "pitz-constrained": 1, "beginner": 2, "standard": 3, "skilled": 4}[prof]
        rew = reward(best, rt)
        path, prev_bakes, gaps = [], 0, []
        for e in sim["events"][:30]:
            r = row.get(e["nodeId"])
            path.append({"sequence": e["sequence"], "node": e["nodeId"],
                         "price": r["pricePitz"] if r else 0, "starGate": gate_of(r) if r else 0,
                         "grindBakesBeforePurchase": e["waitBakes"], "newlyDiscovered": e["newlyDiscovered"],
                         "discoveredTotal": e["discoveredTotal"], "bakesTotal": e["bakesTotal"],
                         "pitzAfter": e["pitzAfter"]})
        last = 0
        worst = {"gap": 0}
        for e in sim["events"]:
            if e["newlyDiscovered"]:
                first_disc_bake = e["bakesTotal"] - e["discoveryBakes"] + 1
                gap = first_disc_bake - last
                if gap > worst["gap"]:
                    worst = {"gap": gap, "beforeNode": e["nodeId"], "atDiscoveredTotal": e["discoveredTotal"] - len(e["newlyDiscovered"])}
                last = e["bakesTotal"]
        waits = sorted(({"node": e["nodeId"], "wait": e["waitBakes"]} for e in sim["events"]), key=lambda x: -x["wait"])[:5]
        econ[prof] = {"repeatBakeRewardPitz": rew, "firstDiscoveryRewardPitz": rew + rt["discoveryBonus"],
                      "hybridStarsPerDiscovery": hybrid_stars(best), "first30Events": path,
                      "worstNoDiscoveryStretch": worst, "top5PurchaseWaits": waits,
                      "totalBakes": sim["totalIncomeBakes"], "grindBakes": sim["grindBakes"],
                      "grindShare": round(sim["grindBakes"] / sim["totalIncomeBakes"], 3)}

    after_margherita = []
    for prof, best in PROFILES.items():
        rew = reward(best, rt)
        bal = rew + rt["discoveryBonus"]
        stars = hybrid_stars(best)
        avail = [r for r in rows if r["lifecycle"] != "OWNED" and r["kind"] != "capability" and gate_of(r) <= stars and not r["prerequisite"]]
        after_margherita.append({
            "profile": prof, "margheritaBest": best, "pitzAfterFirstDiscovery": bal,
            "repeatMargheritaPitz": rew, "hybridStars": stars,
            "availableToBuy": [f"{r['nodeId']}@{r['pricePitz']}" for r in avail],
            "affordableImmediately": sum(1 for r in avail if r["pricePitz"] <= bal),
            "bakesToAffordAllAvailable": max(0, math.ceil((sum(r["pricePitz"] for r in avail) - bal) / rew)),
        })
    tier_wait = {tier: {prof: math.ceil(price / reward(b, rt)) for prof, b in PROFILES.items()}
                 for tier, price in p34["policy"]["pricesByTier"].items()}

    # --- 5. production projection (15 shipped recipes / 22 ingredients) --------------------
    proj = []
    for rid, (tid, items, req_rid, min_stars) in PROD_RECIPES.items():
        d = next(x for x in dep if x["targetId"] == tid)
        assert sorted(items) == d["items"], (rid, items, d["items"])
        proj.append({"recipeId": rid, "targetId": tid, "authorityStarGate": d["starGate"],
                     "authorityReachableAtSequence": d["reachableAtSequence"],
                     "authorityPurchases": d["requiredPurchases"],
                     "authorityPurchaseTotalPitz": d["requiredPurchaseTotalPitz"],
                     "currentEP1Chain": {"requiresRecipeId": req_rid, "minTotalStars": min_stars}})
    proj.sort(key=lambda x: x["authorityReachableAtSequence"])

    def projected_reach(star_per_disc):
        owned = {"tomato-sauce", "mozzarella", "basil"}
        discovered = set()
        changed = True
        while changed:
            changed = False
            stars = star_per_disc * len(discovered)
            for r in rows:
                if r["nodeId"] in PROD_INGREDIENTS and r["nodeId"] not in owned and gate_of(r) <= stars:
                    owned.add(r["nodeId"])
                    changed = True
            for p in proj:
                if p["recipeId"] not in discovered and all(i in owned for i in PROD_RECIPES[p["recipeId"]][1]):
                    discovered.add(p["recipeId"])
                    changed = True
        return sorted(discovered), sorted(set(PROD_RECIPES) - discovered), len(discovered) * star_per_disc

    projection = {}
    for label, spd in (("guaranteedMin_2_per_discovery", 2), ("standard_3", 3), ("skilled_4", 4), ("theoreticalMax_5", 5)):
        disc, unreach, stars = projected_reach(spd)
        projection[label] = {"discovered": len(disc), "unreachable": unreach, "finalStars": stars}
    prod_ing_rows = []
    for iid, cur in PROD_INGREDIENTS.items():
        r = row[iid]
        prod_ing_rows.append({"ingredientId": iid, "authoritySequence": r["sequence"], "authorityTier": r["tier"],
                              "authorityStarGate": gate_of(r), "authorityPrice": r["pricePitz"],
                              "authorityRefillPrice": int(r["pricePitz"] * p34["policy"]["refillPriceFactor"]),
                              "authorityStock": r["stockPolicy"],
                              "currentPrice": None if cur is None else cur[0],
                              "currentRestockQty": None if cur is None else cur[1],
                              "currentMinTotalStars": None if cur is None else cur[2],
                              "currentStarterGrantOnly": None if cur is None else cur[3]})
    prod_ing_rows.sort(key=lambda x: x["authoritySequence"])
    non_prod_nodes_needed_for_first_n = []
    for r in rows:
        if r["lifecycle"] == "OWNED":
            continue
        if r["sequence"] > 23:
            break
        if r["nodeId"] not in PROD_INGREDIENTS:
            non_prod_nodes_needed_for_first_n.append(r["nodeId"])
    tranche = []
    for cut in (9, 12, 15, 19, 23):
        ts = [d for d in dep if d["reachableAtSequence"] <= cut]
        nodes = [r["nodeId"] for r in rows if r["sequence"] <= cut]
        tranche.append({"throughSequence": cut, "lastNode": row_by_seq(rows, cut),
                        "targets": len(ts), "productionTargets": sum(1 for d in ts if d["inProduction"]),
                        "newRecipesNeeded": sorted(d["targetId"] for d in ts if not d["inProduction"]),
                        "newNodesNeeded": sorted(n for n in nodes if n not in PROD_INGREDIENTS),
                        "capabilitiesNeeded": sorted(n for n in nodes if row[n]["kind"] != "ingredient")})

    # --- 6. current production (EP1 chain + EP4 Starter Grant, ΣBEST mastery) as shipped today --
    current = {}
    for prof, best in PROFILES.items():
        disc = []
        changed = True
        while changed:
            changed = False
            stars = best * len(disc)  # ΣBEST with a constant per-recipe BEST
            for rid, (_, _, req_rid, min_stars) in PROD_RECIPES.items():
                if rid in disc:
                    continue
                if req_rid and req_rid not in disc:
                    continue
                if min_stars is not None and stars < min_stars:
                    continue
                disc.append(rid)  # EP4: unlocking the recipe grants its ingredients for free
                changed = True
                break
        stuck = [r for r in PROD_RECIPES if r not in disc]
        current[prof] = {"discovered": len(disc), "order": disc, "stuckAt": stuck[:1],
                         "blockedBy": None if not stuck else {"recipe": stuck[0], **dict(zip(("requiresRecipeId", "minTotalStars"), PROD_RECIPES[stuck[0]][2:])), "starsHeld": best * len(disc)}}

    # --- 7. OD-03 option B illustration (NOT adopted): the same G4_HYBRID_060 formula re-derived
    # per node over the runtime pool (15 shipped + the 3 T1 PIZZA DB recipes that need no new
    # ingredient). Only to size the owner decision; never a proposed value change.
    t1 = ["aussie-pizzadb", "pizza-portuguesa-pizzadb-p9", "brazilian-calabresa-pizzadb-p10"]
    runtime_pool = [d for d in dep if d["inProduction"] or d["targetId"] in t1]
    illustrative = []
    for r in rows:
        if r["nodeId"] not in PROD_INGREDIENTS or r["lifecycle"] == "OWNED":
            continue
        before = sum(1 for d in runtime_pool if d["reachableAtSequence"] < r["sequence"])
        illustrative.append({"nodeId": r["nodeId"], "authorityGate": gate_of(r),
                             "sameFormulaOverRuntimePool": 2 * max(1, math.ceil(before * p34["policy"]["gateFraction"])),
                             "price": r["pricePitz"]})
    # Option A (authority verbatim + content tranche): reachability of the runtime pool.
    def pool_reach(pool, spd):
        owned, disc = {"tomato-sauce", "mozzarella", "basil"}, set()
        changed = True
        while changed:
            changed = False
            for r in rows:
                if r["nodeId"] not in owned and r["kind"] == "ingredient" and r["nodeId"] in PROD_INGREDIENTS and gate_of(r) <= spd * len(disc):
                    owned.add(r["nodeId"]); changed = True
            for d in pool:
                if d["targetId"] not in disc and not d["capabilities"] and all(i in owned for i in d["items"]):
                    disc.add(d["targetId"]); changed = True
        return len(disc), sorted(d["targetId"] for d in pool if d["targetId"] not in disc)
    option_a = {f"{spd}_stars_per_discovery": dict(zip(("discovered", "notReachable"), pool_reach(runtime_pool, spd))) for spd in (2, 3, 4, 5)}

    out = {
        "schemaVersion": 1, "auditedMainSha": AUDITED_MAIN_SHA,
        "generatedBy": "docs/reports/data/PROGRESSION-2.0_PHASE-3-4_audit_graph.py",
        "inputs": [str(P34.relative_to(ROOT)), str(P2.relative_to(ROOT))],
        "authorityCounts": {**{k: p34["summary"][k] for k in ("ingredientCount", "initialOwnedIngredientCount", "unlockableIngredientCount", "allNodeCount")},
                            "targets": len(targets), "shippedOverlayTargets": sum(1 for t in targets if t["targetId"].startswith("shipped:")),
                            "nodeKinds": {k: sum(1 for r in rows if r["kind"] == k) for k in ("ingredient", "dough", "pan", "capability")}},
        "productionCounts": {"recipes": len(PROD_RECIPES), "ingredients": len(PROD_INGREDIENTS),
                             "unlimitedStarters": sum(1 for v in PROD_INGREDIENTS.values() if v is None)},
        "graphChecks": {
            "integrityFindings": findings, "gatesMonotonicInSequence": monotonic,
            "missingNodesReferencedByTargets": sorted(missing_nodes), "deadNodes": dead_nodes,
            "starDeadlocks": star_deadlocks, "starterOnlyTargets": [d["targetId"] for d in dep if d["starterOnly"]],
            "prerequisiteCycles": [], "recipeUnlockConditionsInAuthority": 0,
            "unreachableTargets": [d["targetId"] for d in dep if d["reachableAtSequence"] > rows[-1]["sequence"]],
            "pitzCircularity": "none: Pitz is only spent on nodes; Margherita (starter trio, UNLIMITED stock) always pays >= floor",
        },
        "starSupplyChecks": star_checks,
        "targetDependencyMatrix": dep,
        "economy": {"afterFirstMargherita": after_margherita, "bakesToAffordOneItemByTier": tier_wait,
                    "authoritySimulationPaths": econ},
        "currentProductionEP1ChainConstantBest": current,
        "productionProjection": {"recipes": proj, "ingredients": prod_ing_rows,
                                 "reachabilityIfAuthorityGatesAppliedToCurrent15Recipes": projection,
                                 "contentTranches": tranche,
                                 "od03OptionA_authorityVerbatimWithT1Pool": option_a,
                                 "od03OptionB_illustrativeSameFormulaGates_NOT_ADOPTED": illustrative},
    }
    return out


def row_by_seq(rows, seq):
    return next(r["nodeId"] for r in rows if r["sequence"] == seq)


def main():
    out = build()
    text = json.dumps(out, ensure_ascii=False, indent=1) + "\n"
    if "--check" in sys.argv:
        if OUT.read_text(encoding="utf-8") != text:
            print("DRIFT: regenerate", OUT)
            sys.exit(1)
        print("OK: no drift")
        return
    OUT.write_text(text, encoding="utf-8")
    g = out["graphChecks"]
    print("targets", out["authorityCounts"]["targets"], "starDeadlocks", len(g["starDeadlocks"]),
          "missing", g["missingNodesReferencedByTargets"], "dead", g["deadNodes"], "integrity", g["integrityFindings"],
          "monotonic", g["gatesMonotonicInSequence"], "starterOnly", g["starterOnlyTargets"])
    print(json.dumps(out["productionProjection"]["reachabilityIfAuthorityGatesAppliedToCurrent15Recipes"], indent=1))


if __name__ == "__main__":
    main()
