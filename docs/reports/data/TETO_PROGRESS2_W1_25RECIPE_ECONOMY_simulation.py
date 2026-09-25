#!/usr/bin/env python3
"""25-Recipe Economy & Progression Balance Fresh Audit -- analysis-only simulator.

Docs-only analysis tool for
docs/reports/TETO_PROGRESS2_W1_25RECIPE_ECONOMY_BALANCE_FRESH-AUDIT.md. It never touches the runtime:
it reads `src/data/recipes.ts` (the shipped 15) as text and hard-codes the authority it audits:

- 10 W1 recipes: I5b Fresh Audit §1 / `W1_RECIPE_REQUIREMENTS_FIXTURE` (I5b-1 `861798f`)
- 25-recipe / 24-step ladder: `W1_25_DISCOVERY_LADDER` (I5b-1 `861798f`) == REC-04 fixture
- shipped-15 / 14-step ladder: `SHIPPED_15_DISCOVERY_LADDER` (main `12a09de`)
- price tiers, pack = 10 x k: `src/logic/materialShop.ts` (main, REC-04 OD-REC04-2/3)
- reward: `src/logic/pitzReward.ts` (x1.2/1.0/0.8/0.5/0 bands, floor 20, first discovery +50)
  + CT2 efficiency bonus `src/logic/efficiency.ts` (0-10% of base)
- consumption: `consumePizzaInventory` (placed pieces for scatter, 1 per spread sauce; starters never)

Run:  python3 docs/reports/data/TETO_PROGRESS2_W1_25RECIPE_ECONOMY_simulation.py
Writes docs/reports/data/TETO_PROGRESS2_W1_25RECIPE_ECONOMY_simulation.json (deterministic).
"""
from __future__ import annotations

import json
import math
import re
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).with_suffix(".json")

# ------------------------------------------------------------------------------------------------
# Authority data
# ------------------------------------------------------------------------------------------------
STARTERS = {"tomato-sauce", "mozzarella", "basil"}
SPREAD = {"tomato-sauce", "olive-oil", "pesto"}  # placement "spread": 1 unit per pizza


def parse_shipped_recipes() -> dict:
    src = (ROOT / "src/data/recipes.ts").read_text()
    out = {}
    for block in re.split(r'\n  \{\n    id: "', src)[1:]:
        rid = block.split('"')[0]
        reqs = {i: int(c) for i, c in re.findall(r'ingredientId: "([a-z-]+)", minCount: (\d+)', block)}
        uc = re.search(r"unlockCondition: \{([^}]*)\}", block)
        cond = None
        if uc:
            r = re.search(r'requiresRecipeId: "([a-z-]+)"', uc.group(1))
            s = re.search(r"minTotalStars: (\d+)", uc.group(1))
            cond = {"requires": r.group(1) if r else None, "stars": int(s.group(1)) if s else 0}
        out[rid] = {"reqs": reqs, "ep1": cond, "wave": "shipped"}
    assert len(out) == 15, len(out)
    return out


W1 = {
    "new-haven-apizza": {"olive-oil": 1, "parmigiano": 2, "clam": 3, "garlic": 2},
    "hawaiian": {"tomato-sauce": 1, "mozzarella": 2, "ham": 2, "pineapple": 3},
    "parmigiana-pizza": {"tomato-sauce": 1, "mozzarella": 2, "eggplant": 3, "parmigiano": 2, "basil": 2},
    "bambino": {"tomato-sauce": 1, "mozzarella": 2, "ham": 2, "corn": 3},
    "pizza-portuguesa": {"tomato-sauce": 1, "mozzarella": 2, "ham": 3, "egg": 1, "onion": 2, "black-olive": 2},
    "puttanesca-pizza": {"tomato-sauce": 1, "anchovy": 3, "black-olive": 2, "capers": 2, "garlic": 2},
    "pesto-caprese": {"pesto": 1, "mozzarella": 2, "fresh-tomato": 3, "basil": 2},
    "pesto-tonno": {"pesto": 1, "tuna": 3, "black-olive": 2, "onion": 2},
    "pesto-patate": {"pesto": 1, "mozzarella": 2, "potato": 3, "bacon": 2},
    "melanzane-pizza": {"tomato-sauce": 1, "mozzarella": 2, "eggplant": 3, "basil": 2},
}

LADDER_25 = [
    (1, ["egg"], "bismarck"), (2, ["bacon"], "breakfast-pizza"), (3, ["mushroom"], "funghi"),
    (4, ["eggplant"], "melanzane-pizza"), (5, ["parmigiano"], "parmigiana-pizza"),
    (6, ["pepperoni"], "pepperoni"), (7, ["sausage"], "salsiccia"), (8, ["ham"], "meat-lovers"),
    (9, ["corn"], "bambino"), (10, ["pineapple"], "hawaiian"),
    (11, ["black-olive", "oregano"], "capricciosa"), (12, ["onion"], "pizza-portuguesa"),
    (13, ["olive-oil"], "fugazza"), (14, ["garlic"], "marinara"), (15, ["anchovy"], "napoletana"),
    (16, ["tuna"], "tonno-e-cipolla"), (17, ["pesto"], "pesto-tonno"), (18, ["cherry-tomato"], "genovese"),
    (19, ["clam"], "new-haven-apizza"), (20, ["fresh-tomato"], "pesto-caprese"),
    (21, ["potato"], "pesto-patate"), (22, ["rosemary"], "pizza-bianca"),
    (23, ["capers"], "puttanesca-pizza"), (24, ["fontina", "gorgonzola"], "quattro-formaggi"),
]
LADDER_15 = [
    (1, ["egg"], "bismarck"), (2, ["bacon"], "breakfast-pizza"), (3, ["mushroom"], "funghi"),
    (4, ["pepperoni"], "pepperoni"), (5, ["sausage"], "salsiccia"), (6, ["ham"], "meat-lovers"),
    (7, ["black-olive", "oregano"], "capricciosa"), (8, ["garlic"], "marinara"),
    (9, ["anchovy"], "napoletana"), (10, ["olive-oil", "onion"], "fugazza"),
    (11, ["rosemary"], "pizza-bianca"), (12, ["tuna"], "tonno-e-cipolla"),
    (13, ["cherry-tomato", "pesto"], "genovese"), (14, ["fontina", "gorgonzola", "parmigiano"], "quattro-formaggi"),
]
TIERS = [("T1", 1, 5, 60, 30), ("T2", 6, 14, 80, 40), ("T3", 15, 29, 100, 50), ("T4", 30, 10**9, 120, 60)]
QUALITY_BANDS = [(90, 1.2), (75, 1.0), (60, 0.8), (40, 0.5), (0, 0.0)]
FLOOR, DISC_BONUS, BASE_REWARD = 20, 50, 100


def tier_for(step):
    return next(t for t in TIERS if t[1] <= step <= t[2])


def stars(score):
    return 5 if score >= 90 else 4 if score >= 75 else 3 if score >= 60 else 2 if score >= 40 else 1


def reward(score, new_disc, eff_bonus, base=BASE_REWARD, disc_bonus=DISC_BONUS):
    m = next(mult for lo, mult in QUALITY_BANDS if score >= lo)
    return max(FLOOR, round(base * m)) + (disc_bonus if new_disc else 0) + eff_bonus


class World:
    def __init__(self, recipes, ladder, price_mod=None):
        self.recipes = recipes
        self.ladder = ladder
        self.step_of = {i: s for s, ids, _ in ladder for i in ids}
        self.k = {}
        for r in recipes.values():
            for i, c in r["reqs"].items():
                self.k[i] = max(self.k.get(i, 0), c)
        self.price_mod = price_mod or {}

    def offer(self, ing):
        s = self.step_of[ing]
        t, _, _, pack, refill = tier_for(s)
        k = self.k[ing]
        first = pack
        pm = self.price_mod
        if "first_delta" in pm:
            first = max(0, first + pm["first_delta"])
        if "first_factor" in pm:
            first = round(first * pm["first_factor"])
        if pm.get("t3_first") and t == "T3":
            first = pm["t3_first"]
        if pm.get("first_free"):
            first = 0
        if pm.get("bundle_half"):
            ids = next(ids for st, ids, _ in self.ladder if st == s)
            if len(ids) > 1 and ids[0] != ing:
                first = round(first * 0.5)
        return {"ingredient": ing, "step": s, "tier": t, "k": k, "pack": 10 * k, "first": first,
                "refill": refill, "listFirst": pack}


def finite(reqs):
    return {i: c for i, c in reqs.items() if i not in STARTERS}


# ------------------------------------------------------------------------------------------------
# Profiles
# ------------------------------------------------------------------------------------------------
PROFILES = {
    "A_Efficient": dict(label="A. Efficient", disc_score=85, replay_score=88, eff=6, overuse=1.0,
                        forced="margherita", voluntary_every=0, voluntary_target="new", explore_fail=0,
                        fail_every=0, topup=False),
    "B_Normal": dict(label="B. Normal", disc_score=78, replay_score=80, eff=0, overuse=1.0,
                     forced="recent", voluntary_every=3, voluntary_target="new", explore_fail=0,
                     fail_every=0, topup=True),
    "C_Explorer": dict(label="C. Explorer", disc_score=70, replay_score=74, eff=0, overuse=1.0,
                       forced="recent", voluntary_every=1, voluntary_target="new", explore_fail=2,
                       fail_every=0, topup=True),
    "D_LowScore": dict(label="D. Low-score / high-consumption", disc_score=50, replay_score=50, eff=0,
                       overuse=1.5, forced="recent", voluntary_every=1, voluntary_target="new",
                       explore_fail=0, fail_every=4, topup=True),
    "E_Floor": dict(label="E. Floor (★1 stress, added)", disc_score=35, replay_score=35, eff=0, overuse=1.0,
                    forced="margherita", voluntary_every=0, voluntary_target="new", explore_fail=0,
                    fail_every=0, topup=False),
    "F_Skilled": dict(label="F. Skilled (added)", disc_score=92, replay_score=93, eff=10, overuse=1.0,
                      forced="margherita", voluntary_every=0, voluntary_target="new", explore_fail=0,
                      fail_every=0, topup=False),
}
MIN_PER_BAKE = 1.25   # assumption: ~45s active making + ~30s bake / RESULT
MIN_PER_SHOP = 0.25   # assumption: one Shop visit


def pieces(reqs, overuse):
    """Stock one bake consumes: placed scatter pieces (ceil(minCount x overuse)), 1 per spread."""
    out = {}
    for i, c in finite(reqs).items():
        out[i] = 1 if i in SPREAD else math.ceil(c * overuse)
    return out


def simulate(world, prof, start=None, reward_base=BASE_REWARD, disc_bonus=DISC_BONUS, explore_fail=None):
    p = dict(prof)
    if explore_fail is not None:
        p["explore_fail"] = explore_fail
    st = start or {"discovered": [], "owned": set(), "stock": {}, "pitz": 0, "entitled": set()}
    st = deepcopy(st)
    discovered = list(st["discovered"])
    owned, stock, pitz = set(st["owned"]), dict(st["stock"]), st["pitz"]
    entitled = set(st["entitled"])
    log = []
    tot = dict(earned=0, first_spend=0, refill_spend=0, bakes=0, forced=0, voluntary=0, failures=0,
               shop_visits=0, refills=0, blocked_unlocks=0)
    min_bal = math.inf  # lowest balance after any purchase/refill (the trivial new-game 0 is excluded)
    per_step = []
    attempt_counter = [0]

    def earn(n):
        nonlocal pitz
        pitz += n
        tot["earned"] += n

    def consume(reqs):
        for i, n in pieces(reqs, p["overuse"]).items():
            stock[i] = max(0, stock.get(i, 0) - n)

    def can_bake(rid):
        need = pieces(world.recipes[rid]["reqs"], p["overuse"])
        return all(i in owned and stock.get(i, 0) >= n for i, n in need.items())

    def do_replay(kind):
        # forced/voluntary replay of a KNOWN recipe (never a new discovery).
        rid = "margherita"
        if p["forced"] == "recent" or kind == "voluntary":
            for cand in reversed(discovered):
                if can_bake(cand):
                    rid = cand
                    break
        consume(world.recipes[rid]["reqs"])
        earn(reward(p["replay_score"], False, p["eff"], reward_base, disc_bonus))
        tot["bakes"] += 1
        return rid

    def unlock_upto(n):
        newly = []
        for s, ids, _ in world.ladder:
            if s <= n:
                for i in ids:
                    if i not in entitled:
                        entitled.add(i)
                        newly.append(i)
        return newly

    unlock_upto(len(discovered))
    targets = ["margherita"] + [key for _, _, key in world.ladder]
    for target in targets:
        if target in discovered:
            continue
        step_rec = {"target": target, "dexBefore": len(discovered), "forced": 0, "pitzAtStart": pitz}
        reqs = world.recipes[target]["reqs"]
        need = pieces(reqs, p["overuse"])
        # Explorer: failed free-cook tries before the right combination (new material k pcs + 2 pcs of
        # the best-stocked other owned material). The failure bake itself earns 0 Pitz.
        fails_needed = p["explore_fail"] if target != "margherita" else 0
        new_mats = [i for i in finite(reqs) if i not in owned]
        while True:
            # what it takes: first packs for unowned + refills for stock shortfalls (incl. failures)
            demand = dict(need)
            for i in new_mats[:1]:
                demand[i] = demand.get(i, 0) + fails_needed * world.k.get(i, 1)
            cost, plan = 0, []
            for i, n in demand.items():
                off = world.offer(i)
                have = stock.get(i, 0)
                if i not in owned:
                    cost += off["first"]
                    plan.append(("first", i, off["first"], off["pack"]))
                    have += off["pack"]
                while have < n:
                    cost += off["refill"]
                    plan.append(("refill", i, off["refill"], off["pack"]))
                    have += off["pack"]
            if pitz >= cost:
                break
            do_replay("forced")
            tot["forced"] += 1
            step_rec["forced"] += 1
        if plan:
            tot["shop_visits"] += 1
        for kind, i, price, qty in plan:
            pitz -= price
            if kind == "first":
                owned.add(i)
                tot["first_spend"] += price
            else:
                tot["refill_spend"] += price
                tot["refills"] += 1
            stock[i] = stock.get(i, 0) + qty
        if plan:
            min_bal = min(min_bal, pitz)
        step_rec["pitzAfterPurchase"] = pitz
        # failures
        for _ in range(fails_needed):
            fake = {new_mats[0]: world.k.get(new_mats[0], 1)} if new_mats else {}
            others = sorted((i for i in owned if i not in need and stock.get(i, 0) >= 2), key=lambda i: -stock[i])
            if others:
                fake[others[0]] = 2
            for i, n in fake.items():
                stock[i] = max(0, stock.get(i, 0) - n)
            tot["bakes"] += 1
            tot["failures"] += 1
        # discovery bake (D: every Nth attempt FAILS -> 0 Pitz, stock still consumed, retry)
        while True:
            attempt_counter[0] += 1
            if p["fail_every"] and attempt_counter[0] % p["fail_every"] == 0 and target != "margherita":
                consume(reqs)
                tot["bakes"] += 1
                tot["failures"] += 1
                while not can_bake(target):
                    short = [i for i, n in need.items() if stock.get(i, 0) < n]
                    c = sum(world.offer(i)["refill"] for i in short)
                    if pitz >= c:
                        for i in short:
                            pitz -= world.offer(i)["refill"]
                            tot["refill_spend"] += world.offer(i)["refill"]
                            tot["refills"] += 1
                            stock[i] += world.offer(i)["pack"]
                        tot["shop_visits"] += 1
                    else:
                        do_replay("forced")
                        tot["forced"] += 1
                        step_rec["forced"] += 1
                    min_bal = min(min_bal, pitz)
                continue
            break
        consume(reqs)
        earn(reward(p["disc_score"], True, p["eff"], reward_base, disc_bonus))
        tot["bakes"] += 1
        discovered.append(target)
        newly = unlock_upto(len(discovered))
        unlock_cost = sum(world.offer(i)["first"] for i in newly)
        blocked = bool(newly) and pitz < unlock_cost
        if blocked:
            tot["blocked_unlocks"] += 1
        # voluntary replays of the new recipe (Normal every 3rd discovery, Explorer/Low every one)
        ve = p["voluntary_every"]
        if ve and len(discovered) % ve == 0 and target != "margherita":
            do_replay("voluntary")
            tot["voluntary"] += 1
        # Normal/Explorer/Low "sometimes refill": top up any owned material below one pizza's worth
        # when it does not cut into the next unlock's first-pack money.
        if p["topup"]:
            for i in sorted(owned):
                off = world.offer(i)
                if stock.get(i, 0) < off["k"] and pitz - off["refill"] >= unlock_cost:
                    pitz -= off["refill"]
                    tot["refill_spend"] += off["refill"]
                    tot["refills"] += 1
                    stock[i] = stock.get(i, 0) + off["pack"]
                    tot["shop_visits"] += 1
        min_bal = min(min_bal, pitz)
        step_rec.update({"dexAfter": len(discovered), "pitzAfter": pitz, "newlyUnlocked": newly,
                         "unlockCost": unlock_cost, "blockedAtUnlock": blocked,
                         "shortfallAtUnlock": max(0, unlock_cost - pitz)})
        per_step.append(step_rec)
    stock_total = {i: n for i, n in sorted(stock.items()) if n}
    minutes = tot["bakes"] * MIN_PER_BAKE + tot["shop_visits"] * MIN_PER_SHOP
    streak = max((s["forced"] for s in per_step), default=0)
    return {"totals": tot, "endingPitz": pitz, "minBalance": None if min_bal == math.inf else min_bal, "maxForcedStreak": streak,
            "minutes": round(minutes, 1), "perStep": per_step, "endingStock": stock_total,
            "discovered": len(discovered)}


def bucket(n):
    return "0" if n == 0 else "1" if n == 1 else "2-3" if n <= 3 else "4-5" if n <= 5 else "6+"


# ------------------------------------------------------------------------------------------------
# Static analyses
# ------------------------------------------------------------------------------------------------
def branching(world):
    """Undiscovered recipes makeable at each Dex count along the ladder (all unlocked materials owned)."""
    rows = []
    for d in range(0, len(world.ladder) + 1):
        owned = {i for s, ids, _ in world.ladder if s <= d for i in ids}
        discovered = {"margherita"} | {k for s, _, k in world.ladder if s < d} if d else set()
        makeable = [r for r, v in world.recipes.items() if set(finite(v["reqs"])) <= owned]
        und = sorted(set(makeable) - discovered)
        rows.append({"dex": d, "makeableUndiscovered": und, "branching": len(und)})
    return rows


def ep1_lock_at_step(world, disc_score):
    """Is the step's key recipe still EP1-chain-locked in Pizza Select when its material arrives?
    (Free Cooking ignores EP1 -- it is then the only way to discover it.)"""
    rows = []
    discovered = ["margherita"]
    for s, ids, key in world.ladder:
        cond = world.recipes[key].get("ep1")
        total_stars = stars(disc_score) * len(discovered)
        locked = False
        why = ""
        if cond:
            if cond["requires"] and cond["requires"] not in discovered:
                locked, why = True, f"needs {cond['requires']}"
            if cond["stars"] and total_stars < cond["stars"]:
                locked = True
                why = (why + "; " if why else "") + f"needs ★{cond['stars']} (has {total_stars})"
        rows.append({"step": s, "key": key, "ep1Locked": locked, "why": why})
        discovered.append(key)
    return rows


def usage_along_path(world, overuse=1.0):
    use = {}
    for _, _, key in [(0, [], "margherita")] + world.ladder:
        for i, n in pieces(world.recipes[key]["reqs"], overuse).items():
            use[i] = use.get(i, 0) + n
    return use


def main():
    shipped = parse_shipped_recipes()
    r25 = dict(shipped)
    for rid, reqs in W1.items():
        r25[rid] = {"reqs": reqs, "ep1": None, "wave": "w1"}
    w25 = World(r25, LADDER_25)
    w15 = World(shipped, LADDER_15)

    # authority table
    table = []
    for s, ids, key in LADDER_25:
        for i in ids:
            o = w25.offer(i)
            table.append({"step": s, "dex": s, "ingredient": i, "tier": o["tier"], "first": o["first"],
                          "refill": o["refill"], "k": o["k"], "pack": o["pack"], "key": key})
    old = {}
    for s, ids, key in LADDER_15:
        for i in ids:
            o = w15.offer(i)
            old[i] = o

    result = {"authority": table, "profiles": {}, "sensitivity": {}, "branching": branching(w25),
              "branching15": branching(w15), "ep1Lock": ep1_lock_at_step(w25, 78),
              "usageAlongPath": usage_along_path(w25), "usageAlongPathLow": usage_along_path(w25, 1.5)}
    result["priceChanges"] = [
        {"ingredient": i, "old": {"step": old[i]["step"], "tier": old[i]["tier"], "first": old[i]["first"],
                                  "refill": old[i]["refill"], "k": old[i]["k"], "pack": old[i]["pack"]},
         "new": {"step": w25.offer(i)["step"], "tier": w25.offer(i)["tier"], "first": w25.offer(i)["first"],
                 "refill": w25.offer(i)["refill"], "k": w25.offer(i)["k"], "pack": w25.offer(i)["pack"]}}
        for i in old
    ]
    for name, prof in PROFILES.items():
        result["profiles"][name] = simulate(w25, prof)
        result["profiles"][name]["label"] = prof["label"]
        result["profiles"][name]["old15"] = {k: v for k, v in simulate(w15, prof).items() if k != "perStep"}

    # experimentation cost (Explorer, per-step failures 0/1/3/5)
    result["experimentation"] = {}
    for f in (0, 1, 3, 5):
        r = simulate(w25, PROFILES["C_Explorer"], explore_fail=f)
        result["experimentation"][f] = {k: r[k] for k in ("totals", "endingPitz", "minBalance", "maxForcedStreak",
                                                          "minutes")}
        result["experimentation"][f]["forcedPerStep"] = [s["forced"] for s in r["perStep"]]

    # Floor (★1) player experimenting: failures per step 0/1/3/5
    result["experimentationFloor"] = {}
    for f in (0, 1, 3, 5):
        r = simulate(w25, PROFILES["E_Floor"], explore_fail=f)
        result["experimentationFloor"][f] = {"forced": r["totals"]["forced"], "maxStreak": r["maxForcedStreak"],
                                             "refillSpend": r["totals"]["refill_spend"], "minutes": r["minutes"],
                                             "forcedPerStep": [s["forced"] for s in r["perStep"]]}

    # quality sweep: an Efficient player (no voluntary replay, Margherita grind) at each quality band
    result["qualitySweep"] = {}
    for score, label in ((95, "★5"), (80, "★4"), (65, "★3"), (45, "★2"), (30, "★1")):
        prof = dict(PROFILES["A_Efficient"], disc_score=score, replay_score=score,
                    eff=10 if score >= 90 else 6 if score >= 75 else 3 if score >= 60 else 0)
        rows = {}
        for vname, kw in (("current", {}), ("reward120", {"reward_base": 120}),
                          ("first-20", {"price_mod": {"first_delta": -20}}),
                          ("T3first80", {"price_mod": {"t3_first": 80}}),
                          ("firstPackFree", {"price_mod": {"first_free": True}}),
                          ("noDiscoveryBonus", {"disc_bonus": 0}),
                          ("bundleHalf", {"price_mod": {"bundle_half": True}}),
                          ("floor40", {"floor": 40})):
            global FLOOR
            FLOOR = kw.get("floor", 20)
            w = World(r25, LADDER_25, kw.get("price_mod"))
            r = simulate(w, prof, reward_base=kw.get("reward_base", BASE_REWARD),
                         disc_bonus=kw.get("disc_bonus", DISC_BONUS))
            rows[vname] = {"forced": r["totals"]["forced"], "maxStreak": r["maxForcedStreak"],
                           "blocked": r["totals"]["blocked_unlocks"], "endingPitz": r["endingPitz"],
                           "minutes": r["minutes"], "minBalance": r["minBalance"],
                           "forcedPerStep": [s["forced"] for s in r["perStep"]]}
            FLOOR = 20
        result["qualitySweep"][label] = rows

    # sensitivity (what-if only)
    variants = {
        "current": dict(),
        "reward120": dict(reward_base=120),
        "first-20": dict(price_mod={"first_delta": -20}),
        "firstPackFree": dict(price_mod={"first_free": True}),
        "first50pct": dict(price_mod={"first_factor": 0.5}),
        "T3first80": dict(price_mod={"t3_first": 80}),
        "noDiscoveryBonus": dict(disc_bonus=0),
        "bundleHalf": dict(price_mod={"bundle_half": True}),
    }
    for vname, v in variants.items():
        w = World(r25, LADDER_25, v.get("price_mod"))
        result["sensitivity"][vname] = {}
        for name, prof in PROFILES.items():
            r = simulate(w, prof, reward_base=v.get("reward_base", BASE_REWARD),
                         disc_bonus=v.get("disc_bonus", DISC_BONUS))
            result["sensitivity"][vname][name] = {
                "forced": r["totals"]["forced"], "maxStreak": r["maxForcedStreak"],
                "blocked": r["totals"]["blocked_unlocks"], "endingPitz": r["endingPitz"],
                "minBalance": r["minBalance"], "minutes": r["minutes"]}

    # refill cost per pizza (placing exactly minCount) vs FREE replay / Lunch Rush income
    per_pizza = {}
    for rid, v in r25.items():
        c = 0.0
        for i, n in pieces(v["reqs"], 1.0).items():
            o = w25.offer(i)
            c += n * o["refill"] / o["pack"]
        per_pizza[rid] = round(c, 2)
    avg = round(sum(per_pizza.values()) / len(per_pizza), 2)
    lr = {}
    for q, served in ((78, 4), (78, 6), (85, 8)):
        rew = 40 + (q // 10) * 5 + min(served, 10) * 5
        lr[f"q{q}_served{served}"] = {"runReward": rew, "perPizza": round(rew / served, 1),
                                      "netPerRunAfterRefill": round(rew - served * avg, 1),
                                      "netPerMinute": round((rew - served * avg) / 3.0, 1)}
    result["refillCostPerPizza"] = {"perRecipe": per_pizza, "average": avg, "lunchRush": lr,
                                    "freeMargheritaReplayPerMinute": {
                                        "★4": round(106 / MIN_PER_BAKE, 1), "★1": round(20 / MIN_PER_BAKE, 1)}}

    # migration: shipped-15 saves switched to the 25 ladder
    result["migration"] = migration(w15, w25)
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=1, default=list) + "\n")
    print_summary(result)


def migration(w15, w25):
    """Existing saves under the shipped-15 ladder, switched to the 25 ladder."""
    def entitled_at(world, d, owned):
        e = {i for s, ids, _ in world.ladder if s <= d for i in ids}
        return e | {i for i in owned if i not in STARTERS}

    cases = {}
    keys15 = ["margherita"] + [k for _, _, k in LADDER_15]

    def case(name, dex_n, owned, stock, pitz, note):
        disc = keys15[:dex_n]
        old_ent = entitled_at(w15, dex_n, owned)
        new_ent = entitled_at(w25, dex_n, owned) | old_ent  # ledger union, never shrinks
        new_rows = sorted(new_ent - owned - old_ent, key=lambda i: w25.step_of[i])
        new_offer_rows = sorted(new_ent - owned, key=lambda i: w25.step_of[i])
        cost_new = sum(w25.offer(i)["first"] for i in new_offer_rows)
        makeable = sorted(r for r, v in w25.recipes.items()
                          if r not in disc and set(finite(v["reqs"])) <= owned)
        after_buy = sorted(r for r, v in w25.recipes.items()
                           if r not in disc and set(finite(v["reqs"])) <= (owned | new_ent))
        # next hint: first step > dex_n with a not-entitled material
        nxt = next((s for s, ids, _ in LADDER_25 if s > dex_n and any(i not in new_ent for i in ids)), None)
        price_seen = []
        for i in sorted(new_ent, key=lambda i: w25.step_of[i]):
            if i in w15.step_of:
                o, n = w15.offer(i), w25.offer(i)
                if (o["first"], o["refill"], o["pack"]) != (n["first"], n["refill"], n["pack"]):
                    price_seen.append({"ingredient": i, "row": "refill" if i in owned else "first",
                                       "old": [o["first"], o["refill"], o["pack"]],
                                       "new": [n["first"], n["refill"], n["pack"]]})
        # Pitz needed to make everything newly makeable once (first packs + refills for 0-stock)
        cases[name] = {"note": note, "dex": dex_n, "pitz": pitz, "owned": sorted(owned),
                       "newShopRowsFromSwitch": new_rows, "allNewRows": new_offer_rows,
                       "firstPackCostAllNew": cost_new, "makeableWithoutBuying": makeable,
                       "makeableAfterBuyingAllNew": after_buy,
                       "nextHintStep": nxt, "discoveriesToNextHint": (nxt - dex_n) if nxt else None,
                       "priceChangesSeen": price_seen, "stock": stock}
        return cases[name]

    all15 = {i for _, ids, _ in LADDER_15 for i in ids}
    case("A_Dex0", 0, set(), {}, 0, "fresh save")
    case("B_Dex1", 1, set(), {}, 150, "Margherita only; egg unlocked, not bought")
    case("C_Dex5", 5, {"egg", "bacon", "mushroom", "pepperoni"}, {"egg": 8, "bacon": 25, "mushroom": 27, "pepperoni": 36},
         300, "old keys 1-4 done; sausage unlocked (old step 5) not bought")
    case("D_Dex15", 15, set(all15), {i: 10 for i in all15}, 600, "all 15 discovered, all 22 owned")
    case("E_EP4", 3, {"egg", "mushroom", "onion"}, {"egg": 1, "mushroom": 3, "onion": 4}, 120,
         "EP4-era grants (first unit free) kept as OWNED")
    case("F_HighStock", 15, set(all15), {i: 99 for i in all15}, 2000, "high stock + Pitz")
    case("G_LowPitz", 15, set(all15), {i: 0 for i in all15}, 0, "Dex 15, 0 Pitz, 0 stock everywhere")
    # Dex15 play-through after the switch (each profile), starting from D and G
    for base in ("D_Dex15", "G_LowPitz"):
        c = cases[base]
        start = {"discovered": keys15, "owned": set(c["owned"]), "stock": dict(c["stock"]), "pitz": c["pitz"],
                 "entitled": set(c["allNewRows"]) | set(c["owned"])}
        c["playthrough"] = {}
        for name in ("A_Efficient", "B_Normal", "D_LowScore", "E_Floor"):
            r = simulate_migrated(w25, PROFILES[name], start)
            c["playthrough"][name] = r
    return cases


def simulate_migrated(world, prof, start):
    """Dex15 -> 25: greedy -- discover whatever undiscovered recipe is cheapest to make next."""
    p = prof
    discovered = list(start["discovered"])
    owned, stock, pitz = set(start["owned"]), dict(start["stock"]), start["pitz"]
    entitled = set(start["entitled"])
    forced = first_spend = refill_spend = bakes = 0
    min_bal = pitz
    order = []
    streak = 0

    def unlock():
        for s, ids, _ in world.ladder:
            if s <= len(discovered):
                entitled.update(ids)

    while len(discovered) < len(world.recipes):
        unlock()
        best = None
        for r, v in world.recipes.items():
            if r in discovered:
                continue
            need = pieces(v["reqs"], p["overuse"])
            if not all(i in entitled for i in need):
                continue
            cost = 0
            for i, n in need.items():
                o = world.offer(i)
                have = stock.get(i, 0) if i in owned else 0
                if i not in owned:
                    cost += o["first"]
                    have += o["pack"]
                while have < n:
                    cost += o["refill"]
                    have += o["pack"]
            if best is None or cost < best[1]:
                best = (r, cost, need)
        r, cost, need = best
        s_here = 0
        while pitz < cost:
            pitz += reward(p["replay_score"], False, p["eff"])
            forced += 1
            bakes += 1
            s_here += 1
        streak = max(streak, s_here)
        for i, n in need.items():
            o = world.offer(i)
            if i not in owned:
                owned.add(i)
                pitz -= o["first"]
                first_spend += o["first"]
                stock[i] = stock.get(i, 0) + o["pack"]
            while stock.get(i, 0) < n:
                pitz -= o["refill"]
                refill_spend += o["refill"]
                stock[i] = stock.get(i, 0) + o["pack"]
            stock[i] -= n
        min_bal = min(min_bal, pitz)
        pitz += reward(p["disc_score"], True, p["eff"])
        bakes += 1
        discovered.append(r)
        order.append({"recipe": r, "cost": cost, "forcedBefore": s_here})
    return {"forced": forced, "maxStreak": streak, "firstSpend": first_spend, "refillSpend": refill_spend,
            "endingPitz": pitz, "minBalance": min_bal, "bakes": bakes, "order": order}


def print_summary(res):
    for name, r in res["profiles"].items():
        t = r["totals"]
        print(f"{name:12} earned={t['earned']:5} first={t['first_spend']:5} refill={t['refill_spend']:4} "
              f"end={r['endingPitz']:5} min={r['minBalance']:4} forced={t['forced']:3} streak={r['maxForcedStreak']} "
              f"blocked={t['blocked_unlocks']} vol={t['voluntary']} fail={t['failures']} refills={t['refills']} "
              f"bakes={t['bakes']} min~{r['minutes']}")
    for v, rows in res["sensitivity"].items():
        print(v, {k: (x["forced"], x["maxStreak"], x["blocked"]) for k, x in rows.items()})


if __name__ == "__main__":
    main()
