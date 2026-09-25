#!/usr/bin/env python3
"""REC-04 Fresh Design: ingredient unlock / fee / first-stock / pack / price simulator.

Docs/tools only.  Reads (never writes) production data and pinned design authorities:

* ``src/data/recipes.ts`` / ``src/data/ingredients.ts`` on ``main`` (15 shipped recipes);
* PR #221 W1 recipe authoring matrix at its exact head (10 W1 recipes, 7 new ingredients);
* PR #196 (merged) Phase 3-4 ingredient unlock matrix (authority absolute star gates/prices);
* PR #191 (merged) Phase 2 unlock matrix (101-target pool, used only for a scale stress test).

It generates candidate unlock ladders, simulates deterministic player profiles through the
New Game -> Margherita -> unlock -> buy -> discover loop, and detects deadlock, unreachable
recipes, unusable unlocks, currency/stock starvation, unlock bursts, useless unlocks and
circular prerequisites.  Every value it emits is tagged PROPOSED / OWNER_DECISION_REQUIRED /
CONFIRMED / MERGED_DESIGN_BASELINE / RECORDED_IN_OPEN_PR so candidates are never confused with
authority.

    python tools/progression2_rec04_fresh_design.py          # regenerate outputs
    python tools/progression2_rec04_fresh_design.py --check  # rebuild in memory, verify pins,
                                                             # invariants, negative controls and
                                                             # byte drift; exit 1 on any failure
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_JSON = ROOT / "docs/reports/data/TETO_PROGRESS2_REC-04_FRESH-DESIGN.json"
OUT_MD = ROOT / "docs/reports/TETO_PROGRESS2_REC-04_SIMULATION.md"

# --------------------------------------------------------------------------------------------
# Authority pins (fresh GitHub state, 2026-09-25)
# --------------------------------------------------------------------------------------------
PINS = {
    "main": "1e53baa88f390bf6d8f52647e7c65cc279eb2567",
    "pr220Head": "e49dab96bd9b26dc0f520349cf09d1160c3519f5",
    "pr221Head": "070afc0827f382bec8bc813d62e7fafe663a0991",
    "pr217Head": "a39932d6b750cd0dd16b63e8635ac40c53a9fb70",
    "pr214Head": "5c1d6f06bfaf87b6f1cab3056dd1065d6adf7919",
    "pr205Head": "9035606bec2cec112289654ce4c4e7bebaca303a",
    "pr206Head": "edfca8bcad59906847c0ff8b766d8a8a0dd75f20",
    "pr218Head": "5105771d37577ad353e869ea35295a4ea18bbce9",
    "pr222Head": "81a850c26edf4c7f7f8cf69fad64e66d75830efd",
}
W1_MATRIX_PATH = "docs/reports/data/TETO_PROGRESS2_W1_RECIPE_AUTHORING_MATRIX.json"
W1_MATRIX_BLOB = "a4beec95029643ea11f9be5deaaddfa0e68bd2d1"
AUTH34 = ROOT / "docs/design/data/TETO_PROGRESSION2_PHASE34_INGREDIENT-UNLOCK-MATRIX.json"
P2 = ROOT / "docs/design/data/TETO_PROGRESSION2_PHASE2_UNLOCK-MATRIX.json"
P2_SHA256 = "1ee8bb0900d365ec927862525e5cc2f02bf71d3ec172e8876ff1d5a072d165a3"
RECIPES_TS = ROOT / "src/data/recipes.ts"
INGREDIENTS_TS = ROOT / "src/data/ingredients.ts"

W1_RECIPE_IDS = [
    "new-haven-apizza", "hawaiian", "parmigiana-pizza", "bambino", "pizza-portuguesa",
    "puttanesca-pizza", "pesto-caprese", "pesto-tonno", "pesto-patate", "melanzane-pizza",
]
W1_NEW_INGREDIENTS = ["capers", "clam", "corn", "eggplant", "fresh-tomato", "pineapple", "potato"]
STARTERS = ("basil", "mozzarella", "tomato-sauce")
START_RECIPE = "margherita"

# --------------------------------------------------------------------------------------------
# Economy constants.  Status tags keep candidate values separate from authority.
# --------------------------------------------------------------------------------------------
# CONFIRMED on main (src/logic/pitzReward.ts, OD-02 approved in PR #196).
REWARD_BASE = 100
QUALITY_MULT = {1: 0.0, 2: 0.5, 3: 0.8, 4: 1.0, 5: 1.2}
PITZ_FLOOR = 20
DISCOVERY_BONUS = 50
# PROPOSED (REC-04): W1 recipes use the same baseRewardPitz as every shipped recipe.
W1_BASE_REWARD = 100

PROFILES = {  # quality star each deterministic profile bakes at (Phase-2 skill labels)
    "low": 1, "beginner": 2, "standard": 3, "skilled": 5,
}
BAKE_CAP = 3000


def reward(q: int) -> int:
    return max(PITZ_FLOOR, round(REWARD_BASE * QUALITY_MULT[q]))


def stars_for(q: int, model: str) -> int:
    # HYBRID = sum(max(2, BEST)) -- merged Phase-2/#196 design, implemented only in open PR #205.
    # PRODUCTION = sum(BEST) -- current main src/logic/mastery.ts totalStars.
    return max(2, q) if model == "HYBRID" else q


# --------------------------------------------------------------------------------------------
# Input loading and pin verification
# --------------------------------------------------------------------------------------------

def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def git_show(ref_path: str) -> bytes | None:
    try:
        return subprocess.run(["git", "show", ref_path], cwd=ROOT, check=True,
                              capture_output=True).stdout
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None


def git_blob_sha(data: bytes) -> str:
    return hashlib.sha1(b"blob %d\0" % len(data) + data).hexdigest()


def parse_recipes_ts(text: str) -> list[dict]:
    """Read-only parse of shipped recipe ids and requiredIngredients from recipes.ts."""
    body = text[text.index("export const RECIPES"):]
    recipes = []
    for m in re.finditer(r'\n  \{\n    id: "([^"]+)",(.*?)\n  \},', body, re.S):
        rid, block = m.group(1), m.group(2)
        req = {i: int(c) for i, c in re.findall(
            r'\{ ingredientId: "([^"]+)", minCount: (\d+) \}', block)}
        reward_m = re.search(r"baseRewardPitz: (\d+)", block)
        recipes.append({"id": rid, "source": "shipped", "items": req,
                        "baseRewardPitz": int(reward_m.group(1)) if reward_m else None})
    return recipes


def load_inputs(offline_ok: bool = False) -> tuple[dict, list[str]]:
    problems: list[str] = []
    recipes_text = RECIPES_TS.read_text(encoding="utf-8")
    main_recipes = git_show(f"{PINS['main']}:src/data/recipes.ts")
    if main_recipes is None:
        (None if offline_ok else problems.append("PIN_UNVERIFIABLE main recipes.ts"))
    elif main_recipes.decode("utf-8") != recipes_text:
        problems.append("recipes.ts differs from pinned main; re-audit REC-04 inputs")
    shipped = parse_recipes_ts(recipes_text)

    w1_raw = git_show(f"{PINS['pr221Head']}:{W1_MATRIX_PATH}")
    snapshot_path = OUT_JSON
    if w1_raw is None:
        if not offline_ok:
            problems.append("PIN_UNVERIFIABLE PR #221 W1 matrix (fetch codex/w1-authoring-fresh-audit)")
        prior = json.loads(snapshot_path.read_text(encoding="utf-8")) if snapshot_path.exists() else None
        if prior is None:
            raise SystemExit("W1 authority unavailable and no committed snapshot")
        w1 = prior["inputs"]["w1Snapshot"]["recipes"]
    else:
        if git_blob_sha(w1_raw) != W1_MATRIX_BLOB:
            problems.append("PR #221 W1 matrix blob drifted from pin")
        rows = json.loads(w1_raw)["rows"]
        w1 = []
        for row in rows:
            w1.append({"id": row["recipeIdCandidate"], "source": "w1",
                       "items": {r["ingredientId"]: r["minCountCandidate"] for r in row["requiredIngredients"]},
                       "baseRewardPitz": W1_BASE_REWARD})
        if sorted(r["id"] for r in w1) != sorted(W1_RECIPE_IDS):
            problems.append("W1 recipe id set differs from REC-04 scope")

    auth34 = json.loads(AUTH34.read_text(encoding="utf-8"))
    p2_bytes = P2.read_bytes()
    if sha256_bytes(p2_bytes) != P2_SHA256:
        problems.append("Phase-2 matrix sha256 drifted")
    p2 = json.loads(p2_bytes)
    ingredients_text = INGREDIENTS_TS.read_text(encoding="utf-8")
    known = re.findall(r'\n  \{\n    id: "([^"]+)"', ingredients_text)
    return {
        "shipped": shipped, "w1": sorted(w1, key=lambda r: r["id"]), "auth34": auth34, "p2": p2,
        "productionIngredientIds": known,
        "hashes": {
            "recipesTsSha256": sha256_bytes(recipes_text.encode("utf-8")),
            "ingredientsTsSha256": sha256_bytes(ingredients_text.encode("utf-8")),
            "auth34Sha256": sha256_bytes(AUTH34.read_bytes()),
            "phase2Sha256": sha256_bytes(p2_bytes),
            "w1MatrixBlob": W1_MATRIX_BLOB,
        },
    }, problems


# --------------------------------------------------------------------------------------------
# Ladder generation (rule-based, content-relative)
# --------------------------------------------------------------------------------------------

def reachable(recipes, owned) -> set[str]:
    return {r["id"] for r in recipes if set(r["items"]) <= owned}


def key_recipe_ladder(recipes: list[dict], starters=STARTERS) -> list[dict]:
    """Each step unlocks the smallest item set that completes >=1 new recipe (its key recipe).

    Ties: most recipes newly reachable, then most future reuse of the unlocked items, then
    recipe id.  Guarantees: no useless step, every prerequisite is an earlier step (acyclic),
    every recipe whose items are all known becomes reachable.
    """
    owned = set(starters)
    steps = []
    remaining = [r for r in recipes if not set(r["items"]) <= owned]
    while remaining:
        best = None
        for r in remaining:
            missing = tuple(sorted(set(r["items"]) - owned))
            after = reachable(recipes, owned | set(missing))
            gain = len(after - reachable(recipes, owned))
            reuse = sum(1 for x in recipes for i in missing if i in x["items"]
                        and not set(x["items"]) <= owned)
            key = (len(missing), -gain, -reuse, r["id"])
            if best is None or key < best[0]:
                best = (key, r, missing)
        _, r, missing = best
        before = reachable(recipes, owned)
        owned |= set(missing)
        now = reachable(recipes, owned)
        steps.append({"items": list(missing), "keyRecipe": r["id"],
                      "newlyReachable": sorted(now - before)})
        remaining = [x for x in remaining if not set(x["items"]) <= owned]
    return steps


def authority_ladder(recipes: list[dict], auth34: dict) -> list[dict]:
    """#196 authority order/gates restricted to the ingredients the population actually uses."""
    used = {i for r in recipes for i in r["items"]} - set(STARTERS)
    rows = [row for row in auth34["rows"] if row["nodeId"] in used]
    owned = set(STARTERS)
    steps = []
    for row in rows:
        gate = max([c.get("minimum", 0) for c in row["unlockCondition"].get("all", [])] or [0])
        before = reachable(recipes, owned)
        owned.add(row["nodeId"])
        steps.append({"items": [row["nodeId"]], "keyRecipe": None,
                      "newlyReachable": sorted(reachable(recipes, owned) - before),
                      "authorityGate": gate, "authorityPrice": row["pricePitz"]})
    missing = used - owned
    if missing:
        steps.append({"items": sorted(missing), "keyRecipe": None, "newlyReachable": [],
                      "authorityGate": None, "authorityPrice": None})
    return steps


def assign_gates(steps: list[dict], recipes: list[dict], rule: dict, starters=STARTERS) -> None:
    owned = set(starters)
    for idx, step in enumerate(steps, start=1):
        r_before = len(reachable(recipes, owned))
        step["recipesBefore"] = r_before
        kind = rule["kind"]
        step["dexRequired"] = idx if kind == "DEX" else None
        if kind == "DEX":
            # Discovery Ladder: step s unlocks at Dex discovered count >= s.  Shown as the
            # equivalent HYBRID star value 2*s for comparison only; stars do not gate.
            step["gate"] = 2 * idx
            step["gateClamped"] = False
        elif kind == "LADDER":
            safe_cap = 2 * r_before
            step["gate"] = min(2 + rule["cadence"] * (idx - 1), safe_cap)
            step["gateClamped"] = step["gate"] == safe_cap and safe_cap < 2 + rule["cadence"] * (idx - 1)
        elif kind == "FRACTION":
            step["gate"] = 2 * math.ceil(rule["fraction"] * r_before)
            step["gateClamped"] = False
        elif kind == "AUTHORITY":
            step["gate"] = step["authorityGate"] if step["authorityGate"] is not None else 10 ** 6
            step["gateClamped"] = False
        else:
            raise ValueError(kind)
        owned |= set(step["items"])


GATE_BANDS = [12, 30, 60, None]  # PROPOSED: tier by ladder band; in Dex terms T1 steps 1-5, T2 6-14, T3 15-29, T4 30+
PRICE_SCHEDULES = {
    # MERGED_DESIGN_BASELINE prices (#196 tiers) mapped onto REC-04 gate bands
    "AUTH_60_100_140_180": [60, 100, 140, 180],
    # PROPOSED gentler curve: +20 per tier
    "GENTLE_60_80_100_120": [60, 80, 100, 120],
}
PRICE_SCHEDULE = "GENTLE_60_80_100_120"


def price_tiers(schedule: str) -> list[dict]:
    return [{"tier": f"T{n + 1}", "maxGateExclusive": band, "packPrice": price}
            for n, (band, price) in enumerate(zip(GATE_BANDS, PRICE_SCHEDULES[schedule]))]


PRICE_TIERS = price_tiers(PRICE_SCHEDULE)


def tier_for_gate(gate: int, schedule: str = PRICE_SCHEDULE) -> dict:
    for t in price_tiers(schedule):
        if t["maxGateExclusive"] is None or gate < t["maxGateExclusive"]:
            return t
    raise AssertionError


# --------------------------------------------------------------------------------------------
# Candidate designs
# --------------------------------------------------------------------------------------------
CANDIDATES = {
    "A_AUTH": {
        "label": "Authority as-is: #196 absolute star gates + free unlock + paid first pack",
        "ladder": "AUTHORITY", "gate": {"kind": "AUTHORITY"}, "unlockFeeFactor": 0.0,
        "firstPackPaid": True, "trialPizzas": 0, "grantPizzas": 0, "recipePrereq": False,
    },
    "A": {
        "label": "Discovery Ladder + free unlock + paid first pack (入荷パック)",
        "ladder": "KEY_RECIPE", "gate": {"kind": "DEX"}, "unlockFeeFactor": 0.0,
        "firstPackPaid": True, "trialPizzas": 0, "grantPizzas": 0, "stepsPerDiscovery": 1, "recipePrereq": False,
    },
    "B": {
        "label": "Discovery Ladder + one-time unlock fee (50%) + paid first pack (#217 3-layer)",
        "ladder": "KEY_RECIPE", "gate": {"kind": "DEX"}, "unlockFeeFactor": 0.5,
        "firstPackPaid": True, "trialPizzas": 0, "grantPizzas": 0, "stepsPerDiscovery": 1, "recipePrereq": False,
    },
    "C": {
        "label": "Discovery Ladder + key-recipe discovery prerequisite + free starter grant (3 pizzas)",
        "ladder": "KEY_RECIPE", "gate": {"kind": "DEX"}, "unlockFeeFactor": 0.0,
        "firstPackPaid": False, "trialPizzas": 0, "grantPizzas": 3, "stepsPerDiscovery": 1, "recipePrereq": True,
    },
    "D": {
        "label": "Discovery Ladder + free unlock with 1-pizza trial + paid first pack",
        "ladder": "KEY_RECIPE", "gate": {"kind": "DEX"}, "unlockFeeFactor": 0.0,
        "firstPackPaid": True, "trialPizzas": 1, "grantPizzas": 0, "stepsPerDiscovery": 1, "recipePrereq": False,
    },
}
RECOMMENDED = "A"
PACK_PIZZAS = {"recommended": 10, "alternative": 5}   # PROPOSED; OWNER_DECISION_REQUIRED
REFILL_PRICE_FACTOR = 0.5  # MERGED_DESIGN_BASELINE (#196 S10_R10 refill at half price)
SENSITIVITY = [  # (label, overrides) -- run against the recommended candidate
    ("starLadder_f1.0_noThrottle", {"gate": {"kind": "FRACTION", "fraction": 1.0}, "stepsPerDiscovery": None}),
    ("starLadder_f0.6_noThrottle", {"gate": {"kind": "FRACTION", "fraction": 0.6}, "stepsPerDiscovery": None}),
    ("starLadder_f1.0_productionStars", {"gate": {"kind": "FRACTION", "fraction": 1.0}, "starModel": "PRODUCTION"}),
    ("dexLadder_productionStars", {"starModel": "PRODUCTION"}),
    ("authPrices", {"priceSchedule": "AUTH_60_100_140_180"}),
    ("pack5", {"packPizzas": 5}),
]


def k_values(recipes):
    k = {}
    for r in recipes:
        for i, c in r["items"].items():
            k[i] = max(k.get(i, 0), c)
    return k


def is_capability(node: str) -> bool:
    return node.isupper()


def build_design(recipes, cand, auth34):
    if cand["ladder"] == "AUTHORITY":
        steps = authority_ladder(recipes, auth34)
    else:
        steps = key_recipe_ladder(recipes)
    assign_gates(steps, recipes, cand["gate"])
    k = k_values(recipes)
    items = {}
    for idx, step in enumerate(steps, start=1):
        step["step"] = idx
        tier = tier_for_gate(step["gate"], cand.get("priceSchedule", PRICE_SCHEDULE))
        price = step.get("authorityPrice") if cand["ladder"] == "AUTHORITY" else tier["packPrice"]
        price = price if price is not None else tier["packPrice"]
        step["tier"] = tier["tier"]
        for i in step["items"]:
            if is_capability(i):
                # capability nodes auto-unlock (#217 B_AUTO baseline): no price, no stock
                continue
            items[i] = {"step": idx, "gate": step["gate"], "tier": tier["tier"], "packPrice": price,
                        "refillPrice": math.ceil(price * REFILL_PRICE_FACTOR),
                        "unlockFee": round(price * cand["unlockFeeFactor"] / 10) * 10,
                        "k": k.get(i, 1), "prereqRecipe": None}
            if cand["recipePrereq"] and idx > 1:
                items[i]["prereqRecipe"] = steps[idx - 2]["keyRecipe"]
    return steps, items


# --------------------------------------------------------------------------------------------
# Deterministic player simulation
# --------------------------------------------------------------------------------------------

def _run(recipes, steps, items, cand, q, star_model, pack_pizzas, trace, st):
    by_id = {r["id"]: r for r in recipes}
    order = {r["id"]: i for i, r in enumerate(recipes)}
    finite = set(items)
    S = {"stars": 0, "pitz": 0, "bakes": 0, "grind": 0, "streak": 0, "maxStreak": 0,
         "refills": 0, "maxWait": 0, "stockBlockBakes": 0, "maxUnlocksPerBake": 0,
         "maxBacklog": 0, "backlogBakes": 0, "pitzSpentFirst": 0, "pitzSpentFee": 0,
         "pitzSpentRefill": 0, "idle": 0, "maxIdle": 0}
    discovered: list[str] = []
    available: set[str] = set()
    fee_paid: set[str] = set()
    bought_first: set[str] = set()
    owned: set[str] = set(STARTERS)
    stock: dict[str, int] = {}
    wait_since: dict[str, int] = {}
    unlocked_step: dict[int, int] = {}
    events: list[dict] = []
    milestones: dict[str, int] = {}

    def makeable(rid):
        return all(i in owned and (i not in finite or stock.get(i, 0) >= c)
                   for i, c in by_id[rid]["items"].items())

    def snap(kind, detail):
        if not trace:
            return
        disc = sorted(r["id"] for r in recipes if r["id"] not in discovered and set(r["items"]) <= owned)
        nxt = next((s for s in steps if s["step"] not in unlocked_step), None)
        events.append({
            "bake": S["bakes"], "event": kind, "detail": detail, "stars": S["stars"], "pitz": S["pitz"],
            "ownedFinite": sorted(owned - set(STARTERS)),
            "stock": {i: stock[i] for i in sorted(stock)},
            "discoveredCount": len(discovered), "discoverableNow": disc,
            "nextUnlock": None if nxt is None else {"step": nxt["step"], "items": nxt["items"], "gate": nxt["gate"]},
        })

    def finish(outcome):
        return {
            "outcome": outcome, "discovered": len(discovered), "recipes": len(recipes),
            "undiscovered": sorted(r["id"] for r in recipes if r["id"] not in discovered),
            "totalBakes": S["bakes"], "discoveryBakes": len(discovered), "grindBakes": S["grind"],
            "maxGrindStreak": S["maxStreak"], "refills": S["refills"],
            "maxPurchaseWaitBakes": S["maxWait"],
            "maxIdleWaitWithUnlockedUnbought": S["maxIdle"], "stockBlockedBakes": S["stockBlockBakes"],
            "maxUnlocksInOneBake": S["maxUnlocksPerBake"], "maxUnboughtBacklog": S["maxBacklog"],
            "finalStars": S["stars"], "finalPitz": S["pitz"],
            "pitzSpent": {"unlockFee": S["pitzSpentFee"], "firstPack": S["pitzSpentFirst"],
                          "refill": S["pitzSpentRefill"]},
            "milestones": milestones,
            **({"trace": events} if trace else {}),
        }

    snap("NEW_GAME", "Dex 0 / starters only (tomato-sauce, mozzarella, basil)")
    throttle = cand.get("stepsPerDiscovery")
    while S["bakes"] < BAKE_CAP:
        newly = []
        for s in steps:
            if s["step"] in unlocked_step:
                continue
            if s["dexRequired"] is not None:
                if len(discovered) < s["dexRequired"]:
                    continue
            elif S["stars"] < s["gate"]:
                continue
            # Stateless throttle (derivable from the save, no new field): the number of unlocked
            # ladder steps may never exceed the Dex discovery count.
            if throttle is not None and len(unlocked_step) >= len(discovered) * throttle:
                break
            if cand["recipePrereq"] and s["step"] > 1 and steps[s["step"] - 2]["keyRecipe"] not in discovered:
                continue
            unlocked_step[s["step"]] = S["bakes"]
            for i in s["items"]:
                newly.append(i)
                if is_capability(i):
                    owned.add(i)
                    continue
                available.add(i)
                wait_since[i] = S["bakes"]
                grant = cand["grantPizzas"] or cand["trialPizzas"]
                if grant:
                    owned.add(i)
                    stock[i] = stock.get(i, 0) + grant * items[i]["k"]
                if not cand["firstPackPaid"]:
                    wait_since.pop(i)
        if newly:
            S["maxUnlocksPerBake"] = max(S["maxUnlocksPerBake"], len(newly))
            snap("UNLOCK", newly)
        for s in steps:
            for i in s["items"]:
                if i not in available:
                    continue
                fee = items[i]["unlockFee"]
                if fee and i not in fee_paid:
                    if S["pitz"] < fee:
                        continue
                    S["pitz"] -= fee
                    S["pitzSpentFee"] += fee
                    fee_paid.add(i)
                    snap("PAY_UNLOCK_FEE", i)
                if cand["firstPackPaid"] and i not in bought_first and S["pitz"] >= items[i]["packPrice"]:
                    S["pitz"] -= items[i]["packPrice"]
                    S["pitzSpentFirst"] += items[i]["packPrice"]
                    bought_first.add(i)
                    owned.add(i)
                    stock[i] = stock.get(i, 0) + pack_pizzas * items[i]["k"]
                    S["maxWait"] = max(S["maxWait"], S["bakes"] - wait_since.pop(i))
                    snap("BUY_FIRST_PACK", i)
        backlog = sorted(i for i in available if cand["firstPackPaid"] and i not in bought_first)
        S["maxBacklog"] = max(S["maxBacklog"], len(backlog))
        targets = sorted((r for r in recipes if r["id"] not in discovered and set(r["items"]) <= owned),
                         key=lambda x: order[x["id"]])
        for r in targets:
            for i, c in r["items"].items():
                if i in finite and stock.get(i, 0) < c and S["pitz"] >= items[i]["refillPrice"]:
                    S["pitz"] -= items[i]["refillPrice"]
                    S["pitzSpentRefill"] += items[i]["refillPrice"]
                    stock[i] = stock.get(i, 0) + pack_pizzas * items[i]["k"]
                    S["refills"] += 1
                    snap("REFILL", i)
        if len(discovered) == len(recipes):
            return finish("COMPLETE")
        ready = [r for r in targets if makeable(r["id"])]
        stock_blocked = [r["id"] for r in targets if not makeable(r["id"])]
        if stock_blocked and not ready:
            S["stockBlockBakes"] += 1
        if ready:
            r = ready[0]
            for i, c in r["items"].items():
                if i in finite:
                    stock[i] -= c
            discovered.append(r["id"])
            S["stars"] += stars_for(q, star_model)
            S["pitz"] += reward(q) + DISCOVERY_BONUS
            S["bakes"] += 1
            S["streak"] = 0
            S["idle"] = 0
            if r["source"] == "w1" and "firstW1Discovery" not in milestones:
                milestones["firstW1Discovery"] = S["bakes"]
            milestones.setdefault("firstDiscovery", S["bakes"])
            snap("DISCOVER", r["id"])
            continue
        remaining_steps = [s for s in steps if s["step"] not in unlocked_step]
        if not backlog and not stock_blocked:
            if not remaining_steps:
                return finish("COMPLETE" if len(discovered) == len(recipes) else "UNREACHABLE_RECIPES")
            if remaining_steps[0]["dexRequired"] is not None:
                return finish("DEX_DEADLOCK")  # impossible by construction; kept as a detector
            nxt_gate = min(s["gate"] for s in remaining_steps)
            if throttle is not None and nxt_gate <= S["stars"] and len(unlocked_step) >= len(discovered) * throttle:
                return finish("THROTTLE_DEADLOCK")
            if nxt_gate > S["stars"]:
                # Fixed-quality profile: grinding a known recipe never raises BEST, and every
                # reachable recipe is already discovered -> the next gate can never be met.
                return finish("STAR_DEADLOCK")
            if cand["recipePrereq"]:
                return finish("PREREQ_DEADLOCK")
        S["pitz"] += reward(q)   # Margherita grind: unlimited starters, never consumes stock
        S["bakes"] += 1
        S["grind"] += 1
        S["streak"] += 1
        S["maxStreak"] = max(S["maxStreak"], S["streak"])
        if backlog:
            S["backlogBakes"] += 1
            S["idle"] += 1
            S["maxIdle"] = max(S["maxIdle"], S["idle"])
        else:
            S["idle"] = 0
    return finish("TIMEOUT")


# --------------------------------------------------------------------------------------------
# Static detectors
# --------------------------------------------------------------------------------------------

def detect_cycles(prereq: dict[str, list[str]]) -> list[list[str]]:
    color, stack, cycles = {}, [], []

    def dfs(n):
        color[n] = 1
        stack.append(n)
        for m in prereq.get(n, []):
            if color.get(m) == 1:
                cycles.append(stack[stack.index(m):] + [m])
            elif color.get(m) is None:
                dfs(m)
        stack.pop()
        color[n] = 2
    for n in sorted(prereq):
        if color.get(n) is None:
            dfs(n)
    return cycles


def prerequisite_graph(recipes, steps, items, cand):
    """item -> items that must be unlocked first (bundle partners of its key recipe from earlier
    steps, plus the key-recipe-discovery prerequisite for candidate C)."""
    graph = {}
    step_of = {i: s["step"] for s in steps for i in s["items"]}
    by_id = {r["id"]: r for r in recipes}
    for s in steps:
        for i in s["items"]:
            deps = []
            if s.get("keyRecipe"):
                deps += [x for x in by_id[s["keyRecipe"]]["items"] if x in step_of and step_of[x] < s["step"]]
            pr = items.get(i, {}).get("prereqRecipe")
            if pr:
                deps += [x for x in by_id[pr]["items"] if x in step_of]
            graph[i] = sorted(set(deps))
    return graph


def static_checks(recipes, steps, items, cand):
    covered = {i for s in steps for i in s["items"]} | set(STARTERS)
    unreachable = sorted(r["id"] for r in recipes if not set(r["items"]) <= covered)
    useless = [s["step"] for s in steps if not s["newlyReachable"]]
    cycles = detect_cycles(prerequisite_graph(recipes, steps, items, cand))
    gates = [s["gate"] for s in steps]
    return {
        "unreachableRecipes": unreachable,
        "uselessUnlockSteps": useless,
        "circularPrerequisites": cycles,
        "gatesMonotonic": all(a <= b for a, b in zip(gates, gates[1:])),
        "maxItemsPerStep": max(len(s["items"]) for s in steps),
        "firstGate": gates[0],
        "margheritaAtStart": START_RECIPE in reachable(recipes, set(STARTERS)),
        "onlyMargheritaAtStart": reachable(recipes, set(STARTERS)) == {START_RECIPE},
    }


# --------------------------------------------------------------------------------------------
# Economy margin / affordability
# --------------------------------------------------------------------------------------------

def recipe_margins(recipes, items, pack_pizzas):
    rows = []
    for r in recipes:
        cost = 0.0
        for i, c in r["items"].items():
            if i in items:
                cost += items[i]["refillPrice"] * c / (pack_pizzas * items[i]["k"])
        cost = round(cost, 1)
        rows.append({"recipe": r["id"], "source": r["source"], "refillCostPerPizza": cost,
                     "marginByQuality": {str(q): round(reward(q) - cost, 1) for q in (1, 2, 3, 5)}})
    return rows


def pack_comparison(recipes, items):
    out = {}
    for p in (5, 10):
        m = recipe_margins(recipes, items, p)
        out[str(p)] = {
            "negativeMarginRecipesAtQ1": sorted(x["recipe"] for x in m if x["marginByQuality"]["1"] < 0),
            "negativeMarginRecipesAtQ2": sorted(x["recipe"] for x in m if x["marginByQuality"]["2"] < 0),
            "worstRefillCostPerPizza": max(x["refillCostPerPizza"] for x in m),
            "shopVisitsPerIngredientPer30Pizzas": round(30 / p, 1),
        }
    return out


def affordability(steps, items):
    rows = []
    for s in steps:
        price = sum(items[i]["packPrice"] + items[i]["unlockFee"] for i in s["items"] if i in items)
        row = {"step": s["step"], "items": s["items"], "gate": s["step"], "totalFirstCost": price}
        for name, q in PROFILES.items():
            disc = reward(q) + DISCOVERY_BONUS
            row[f"extraBakes_{name}"] = max(0, math.ceil((price - disc) / reward(q)))
        rows.append(row)
    return rows


# --------------------------------------------------------------------------------------------
# Build
# --------------------------------------------------------------------------------------------

def population(inputs):
    return inputs["shipped"] + inputs["w1"]


def stress_population(inputs):
    """101-target Phase-2 pool (merged #191) as a scale stress test: items + capabilities,
    minCount unknown -> 1 (uses model)."""
    out = []
    for t in inputs["p2"]["targets"]["SHIPPED_KEEP"]:
        items = {i: 1 for i in t["items"]}
        for c in t["capabilities"]:
            items[c] = 1
        out.append({"id": t["targetId"], "source": "p2", "items": items, "baseRewardPitz": 100})
    return sorted(out, key=lambda r: (0 if r["id"] == "shipped:margherita" else 1, r["id"]))


def run_candidate(recipes, cid, cand, auth34, pack_pizzas=10, star_model="HYBRID", trace_profiles=()):
    steps, items = build_design(recipes, cand, auth34)
    static = static_checks(recipes, steps, items, cand)
    sims = {}
    for name, q in PROFILES.items():
        sims[name] = _run(recipes, steps, items, cand, q, star_model, pack_pizzas,
                          name in trace_profiles, {})
    return {"candidate": cid, "label": cand["label"], "packPizzas": pack_pizzas,
            "starModel": star_model, "steps": steps, "items": items, "static": static,
            "simulations": sims}


def findings_for(result):
    f = []
    st = result["static"]
    if st["unreachableRecipes"]:
        f.append("RECIPE_UNREACHABLE")
    if st["uselessUnlockSteps"]:
        f.append("USELESS_UNLOCK")
    if st["circularPrerequisites"]:
        f.append("CIRCULAR_PREREQUISITE")
    for name, sim in result["simulations"].items():
        if sim["outcome"] != "COMPLETE":
            f.append(f"PROGRESSION_DEADLOCK:{name}:{sim['outcome']}")
        if sim["maxUnlocksInOneBake"] > THRESHOLDS["unlockBurstItemsPerBake"]:
            f.append(f"UNLOCK_BURST:{name}")
        if sim["maxIdleWaitWithUnlockedUnbought"] > THRESHOLDS["unlockedButUnusableBakes"]:
            f.append(f"UNLOCKED_BUT_UNUSABLE:{name}")
        if sim["maxGrindStreak"] > THRESHOLDS["currencyStarvationGrindStreak"]:
            f.append(f"CURRENCY_STARVATION:{name}")
        if sim["stockBlockedBakes"] > THRESHOLDS["stockStarvationBakes"]:
            f.append(f"STOCK_STARVATION:{name}")
    return sorted(set(f))


THRESHOLDS = {
    "unlockBurstItemsPerBake": 3, "unlockedButUnusableBakes": 6, "currencyStarvationGrindStreak": 8,
    "stockStarvationBakes": 8,
}


def w1_matrix(result, recipes):
    by_id = {r["id"]: r for r in recipes}
    steps = {s["step"]: s for s in result["steps"]}
    rows = []
    for i in W1_NEW_INGREDIENTS:
        it = result["items"][i]
        st = steps[it["step"]]
        partners = [x for x in st["items"] if x != i]
        key = by_id[st["keyRecipe"]] if st["keyRecipe"] else None
        earlier = sorted(x for x in (key["items"] if key else {}) if x in result["items"] and x not in st["items"])
        enables = sorted(r["id"] for r in recipes if i in r["items"])
        rows.append({
            "ingredient": i, "step": it["step"], "keyRecipe": st["keyRecipe"],
            "prerequisiteIngredients": earlier, "bundledWith": partners,
            "dexRequired": st["dexRequired"], "starEquivalent": it["gate"], "tier": it["tier"], "unlockCost": it["unlockFee"],
            "firstStockOnUnlock": 0, "firstPackPrice": it["packPrice"], "refillPrice": it["refillPrice"],
            "k": it["k"], "packPieces": result["packPizzas"] * it["k"],
            "packLabelJa": f"ピザ{result['packPizzas']}枚分（{result['packPizzas'] * it['k']}個）",
            "recipesUsing": enables,
            "status": "PROPOSED",
        })
    return rows


def authority_w1_gates(auth34):
    out = {}
    for row in auth34["rows"]:
        if row["nodeId"] in W1_NEW_INGREDIENTS:
            out[row["nodeId"]] = {"gate": max(c.get("minimum", 0) for c in row["unlockCondition"]["all"]),
                                  "price": row["pricePitz"], "tier": row["tier"],
                                  "status": "MERGED_DESIGN_BASELINE"}
    return out


def star_capacity(recipes):
    n = len(recipes)
    return {"recipes": n, "minHybridStars": 2 * n, "maxStars": 5 * n}


def w1_reachability(result, recipes):
    by_step = {i: s for s in result["steps"] for i in s["items"]}
    rows = []
    for rid in W1_RECIPE_IDS:
        r = next(x for x in recipes if x["id"] == rid)
        finite = [i for i in r["items"] if i in result["items"]]
        last = max((by_step[i]["step"] for i in finite), default=0)
        gate = max((by_step[i]["step"] for i in finite), default=0)
        disc_bake = {n: next((e["bake"] for e in result["simulations"][n].get("trace", [])
                              if e["event"] == "DISCOVER" and e["detail"] == rid), None)
                     for n in ("low", "standard")}
        rows.append({"recipe": rid, "finiteIngredients": finite,
                     "newW1Ingredients": [i for i in finite if i in W1_NEW_INGREDIENTS],
                     "reachableAtStep": last, "dexRequiredToReach": gate,
                     "discoveredAtBake": disc_bake,
                     "reachable": True})
    return rows


def build(inputs):
    recipes = population(inputs)
    auth34 = inputs["auth34"]
    results = {}
    for cid, cand in CANDIDATES.items():
        trace = ("low", "standard") if cid == RECOMMENDED else ()
        results[cid] = run_candidate(recipes, cid, cand, auth34, trace_profiles=trace)
        results[cid]["findings"] = findings_for(results[cid])
    sens = {}
    for label, over in SENSITIVITY:
        cand = dict(CANDIDATES[RECOMMENDED])
        pack = over.get("packPizzas", PACK_PIZZAS["recommended"])
        model = over.get("starModel", "HYBRID")
        if "gate" in over:
            cand["gate"] = over["gate"]
        if "stepsPerDiscovery" in over:
            cand["stepsPerDiscovery"] = over["stepsPerDiscovery"]
        if "priceSchedule" in over:
            cand["priceSchedule"] = over["priceSchedule"]
        res = run_candidate(recipes, f"{RECOMMENDED}:{label}", cand, auth34, pack, model)
        res["findings"] = findings_for(res)
        sens[label] = {"findings": res["findings"],
                       "simulations": {k: {x: v[x] for x in ("outcome", "totalBakes", "grindBakes",
                                                               "maxGrindStreak", "maxPurchaseWaitBakes",
                                                               "maxIdleWaitWithUnlockedUnbought",
                                                               "maxUnlocksInOneBake", "refills", "finalPitz")}
                                       for k, v in res["simulations"].items()},
                       "gates": [s["gate"] for s in res["steps"]]}
    stress = population_stress(inputs)
    rec = results[RECOMMENDED]
    return recipes, results, sens, stress, rec


def population_stress(inputs):
    recipes = stress_population(inputs)
    out = {}
    for cid in (RECOMMENDED, "A_AUTH"):
        cand = CANDIDATES[cid]
        res = run_candidate(recipes, cid, cand, inputs["auth34"])
        res["findings"] = findings_for(res)
        out[cid] = {"findings": res["findings"], "steps": len(res["steps"]),
                    "maxItemsPerStep": res["static"]["maxItemsPerStep"],
                    "finalGate": res["steps"][-1]["gate"],
                    "uselessUnlockSteps": len(res["static"]["uselessUnlockSteps"]),
                    "simulations": {k: {x: v[x] for x in ("outcome", "discovered", "recipes", "totalBakes",
                                                          "grindBakes", "maxGrindStreak",
                                                          "maxPurchaseWaitBakes", "maxUnlocksInOneBake")}
                                    for k, v in res["simulations"].items()}}
    return {"population": "Phase-2 SHIPPED_KEEP 101 targets (merged #191)", "recipes": len(recipes),
            "note": "minCount is unknown for the non-shipped rows -> k=1 per item (uses model). Capability nodes "
                    "auto-unlock at their step with no price/stock (#217 B_AUTO baseline); dough/pan nodes are priced like ingredients.", "results": out}


def negative_controls(inputs):
    """Seed known-bad designs and require each detector to fire."""
    recipes = population(inputs)
    auth34 = inputs["auth34"]
    out = {}
    # 1. deadlock: production star model (sum BEST) with a low-skill profile on the ladder
    star_cand = dict(CANDIDATES[RECOMMENDED], gate={"kind": "FRACTION", "fraction": 1.0})
    s_steps, s_items = build_design(recipes, star_cand, auth34)
    sim = _run(recipes, s_steps, s_items, star_cand, 1, "PRODUCTION", 10, False, {})
    out["deadlockDetected"] = sim["outcome"] == "STAR_DEADLOCK"
    cand = CANDIDATES[RECOMMENDED]
    steps, items = build_design(recipes, cand, auth34)
    # 2. unreachable recipe: add a recipe needing an ingredient no step unlocks
    bad = recipes + [{"id": "zz-unreachable", "source": "test", "items": {"unobtainium": 1}, "baseRewardPitz": 100}]
    st = static_checks(bad, steps, items, cand)
    out["unreachableDetected"] = st["unreachableRecipes"] == ["zz-unreachable"]
    # 3. circular prerequisite
    out["cycleDetected"] = bool(detect_cycles({"a": ["b"], "b": ["c"], "c": ["a"]}))
    # 4. affordability / unusable unlock: first pack priced beyond reach for a long time
    items2 = {i: dict(v, packPrice=5000) for i, v in items.items()}
    sim2 = _run(recipes, steps, items2, cand, 1, "HYBRID", 10, False, {})
    out["unaffordableDetected"] = sim2["maxGrindStreak"] > THRESHOLDS["currencyStarvationGrindStreak"]
    # 5. useless unlock: authority order restricted to the 25-recipe population
    a = build_design(recipes, CANDIDATES["A_AUTH"], auth34)
    out["uselessDetectedOnAuthorityOrder"] = bool(static_checks(recipes, a[0], a[1], CANDIDATES["A_AUTH"])["uselessUnlockSteps"])
    # 6. determinism: two identical runs are byte-identical
    s1 = json.dumps(_run(recipes, steps, items, cand, 3, "HYBRID", 10, True, {}), sort_keys=True)
    s2 = json.dumps(_run(recipes, steps, items, cand, 3, "HYBRID", 10, True, {}), sort_keys=True)
    out["deterministic"] = s1 == s2
    return out


STATUS_LEGEND = {
    "CONFIRMED": "On main and owner-approved (e.g. OD-01/OD-02 in PR #196).",
    "MERGED_DESIGN_BASELINE": "Merged design document value (PR #191/#196) that no owner decision confirmed.",
    "RECORDED_IN_OPEN_PR": "Recorded as decided in an unmerged PR (#214/#217); not authority on main.",
    "PROPOSED": "REC-04 Fresh Design candidate value.",
    "OWNER_DECISION_REQUIRED": "Must be chosen by the owner before implementation.",
}


def build_json(inputs):
    recipes, results, sens, stress, rec = build(inputs)
    compact = {}
    for cid, r in results.items():
        compact[cid] = {
            "label": r["label"], "findings": r["findings"], "static": r["static"],
            "gates": [s["gate"] for s in r["steps"]], "stepCount": len(r["steps"]),
            "simulations": {k: {x: v for x, v in s.items() if x != "trace"} for k, s in r["simulations"].items()},
        }
    ladder = [{"step": s["step"], "items": s["items"], "keyRecipe": s["keyRecipe"],
               "newlyReachable": s["newlyReachable"], "recipesBefore": s["recipesBefore"],
               "dexRequired": s["dexRequired"], "gate": s["gate"], "tier": s["tier"],
               "packPrice": rec["items"][s["items"][0]]["packPrice"], "status": "PROPOSED"}
              for s in rec["steps"]]
    doc = {
        "schemaVersion": 1,
        "kind": "REC-04 Fresh Design companion",
        "generatedBy": "tools/progression2_rec04_fresh_design.py",
        "verdict": "READY_FOR_OWNER_DECISION",
        "statusLegend": STATUS_LEGEND,
        "authorityPins": PINS,
        "inputs": {
            "hashes": inputs["hashes"],
            "shippedRecipeCount": len(inputs["shipped"]),
            "w1Snapshot": {"source": f"PR #221 @ {PINS['pr221Head']} {W1_MATRIX_PATH}",
                           "recipes": inputs["w1"]},
        },
        "authorityAudit": {
            "confirmed": [
                {"id": "OD-01", "value": "SHIPPED_KEEP 101-target overlay", "status": "CONFIRMED"},
                {"id": "OD-02", "value": "PASS floor 20 Pitz + first-discovery bonus 50", "status": "CONFIRMED"},
                {"id": "OD-S1", "value": "W1 = #220 W1, sauce inside current union", "status": "CONFIRMED"},
                {"id": "onboarding", "value": "Dex 0 -> starters only -> Free Cooking -> Margherita (#199 on main)",
                 "status": "CONFIRMED"},
            ],
            "mergedBaseline": [
                {"id": "starModel", "value": "sum(max(2, BEST)) (Phase 2 G4 hybrid)", "runtime": "open PR #205 only; main uses sum(BEST)",
                 "status": "MERGED_DESIGN_BASELINE"},
                {"id": "gateCurve", "value": "G4_HYBRID_060 absolute gates for the 101 pool", "status": "MERGED_DESIGN_BASELINE"},
                {"id": "tierPrices", "value": {"early": 60, "mid": 100, "late": 140, "endgame": 180}, "status": "MERGED_DESIGN_BASELINE"},
                {"id": "stockPolicy", "value": "S10_R10 (purchase 10 / refill 10 portions, refill price x0.5)", "status": "MERGED_DESIGN_BASELINE"},
            ],
            "recordedInOpenPrs": [
                {"pr": 214, "id": "D-1", "value": "OD-03 Option A fixed authority star gates", "status": "RECORDED_IN_OPEN_PR"},
                {"pr": 214, "id": "D-2", "value": "M4 inventory unit = pieces, no migration", "status": "RECORDED_IN_OPEN_PR"},
                {"pr": 214, "id": "D-4", "value": "fixed 10 x k pieces purchase/refill", "status": "RECORDED_IN_OPEN_PR"},
                {"pr": 217, "id": "OD216-1..4", "value": "unlock fee curve / non-star gate / capability mode / k authoring", "status": "OWNER_DECISION_REQUIRED"},
            ],
            "w1AuthorityGatesOn25Recipes": authority_w1_gates(inputs["auth34"]),
            "starCapacityShippedPlusW1": star_capacity(recipes),
        },
        "recommended": {
            "candidate": RECOMMENDED,
            "rules": {
                "unlockCondition": {"value": "Discovery Ladder: ladder step s unlocks when Dex discovered count >= s (one step per new discovery)", "status": "OWNER_DECISION_REQUIRED"},
                "ladderGeneration": {"value": "key-recipe rule: each step = smallest ingredient set completing >=1 new recipe (tie: most new recipes, most reuse, id)", "status": "PROPOSED"},
                "starEquivalent": {"value": "2*s stars under sum(max(2, BEST)); stars are displayed, not gating", "status": "PROPOSED"},
                "starModel": {"value": "not required by the recommended gate (works with main sum(BEST) and #205 sum(max(2,BEST)))", "status": "PROPOSED"},
                "unlockFee": {"value": 0, "status": "PROPOSED"},
                "firstStockOnUnlock": {"value": 0, "note": "unlock notice deep-links to the first-pack purchase", "status": "OWNER_DECISION_REQUIRED"},
                "packDefinition": {"value": "P pizzas x k pieces (k = max minCount at authoring time, fixed data)", "status": "PROPOSED"},
                "packPizzas": {"value": PACK_PIZZAS["recommended"], "alternative": PACK_PIZZAS["alternative"], "status": "OWNER_DECISION_REQUIRED"},
                "priceTiers": {"value": PRICE_TIERS, "status": "PROPOSED"},
                "refillPrice": {"value": "ceil(packPrice x 0.5)", "status": "MERGED_DESIGN_BASELINE"},
                "entitlement": {"value": "unlock is permanent (never re-locks when later waves change gates)", "status": "PROPOSED"},
            },
            "ladder": ladder,
            "w1IngredientMatrix": w1_matrix(rec, recipes),
            "w1RecipeReachability": w1_reachability(rec, recipes),
            "affordability": affordability(rec["steps"], rec["items"]),
            "recipeMargins": recipe_margins(recipes, rec["items"], PACK_PIZZAS["recommended"]),
            "packComparison": pack_comparison(recipes, rec["items"]),
            "traces": {k: rec["simulations"][k]["trace"] for k in ("low", "standard")},
        },
        "candidates": compact,
        "sensitivity": sens,
        "scaleStress": stress,
        "thresholds": THRESHOLDS,
        "negativeControls": negative_controls(inputs),
        "ownerDecisions": [
            {"id": "REC04-OD1", "topic": "Unlock condition basis",
             "options": ["DISCOVERY_LADDER: 1 new discovery = next ladder step (recommended)",
                         "STAR_LADDER: content-relative star gate 2*ceil(f*R_before), quality can run ahead (burst risk at scale)",
                         "AUTHORITY_ABSOLUTE_GATES: #196 values as-is (deadlocks at W1 content size)"],
             "status": "OWNER_DECISION_REQUIRED"},
            {"id": "REC04-OD2", "topic": "First stock at unlock",
             "options": ["0 + paid first pack from the unlock notice (recommended)",
                         "1-pizza free trial + paid first pack"],
             "status": "OWNER_DECISION_REQUIRED"},
            {"id": "REC04-OD3", "topic": "Economy numbers",
             "options": ["pack = 10 pizzas (10 x k pieces) + gentle tiers 60/80/100/120, refill x0.5 (recommended)",
                         "pack = 10 pizzas + #196 tiers 60/100/140/180",
                         "pack = 5 pizzas + gentle tiers"],
             "status": "OWNER_DECISION_REQUIRED"},
        ],
    }
    return doc


# --------------------------------------------------------------------------------------------
# Markdown appendix (generated tables)
# --------------------------------------------------------------------------------------------

def md(doc):
    L = ["# REC-04 Simulation appendix (generated)", "",
         f"Generated by `{doc['generatedBy']}`. Do not edit by hand; run the tool. "
         f"Main `{PINS['main'][:7]}`, W1 authority PR #221 `{PINS['pr221Head'][:7]}`.", "",
         "## Recommended ladder (Candidate A: Discovery Ladder, pack 10, gentle prices) — PROPOSED", "",
         "| step | unlocks | key recipe | newly reachable | recipes before | Dex required | ⭐ equivalent (2×step) | tier | first pack 🪙 |",
         "|---:|---|---|---|---:|---:|---:|---|---:|"]
    for s in doc["recommended"]["ladder"]:
        L.append(f"| {s['step']} | {', '.join(s['items'])} | {s['keyRecipe']} | {', '.join(s['newlyReachable'])} | "
                 f"{s['recipesBefore']} | {s['dexRequired']} | {s['gate']} | {s['tier']} | {s['packPrice']} |")
    L += ["", "## Candidate comparison (25 recipes = 15 shipped + 10 W1)", "",
          "| candidate | profile | outcome | bakes | grind | max grind streak | max purchase wait | max idle wait (unlocked, unbought) | max unlocks/bake | refills | final ⭐ | final 🪙 | findings |",
          "|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|"]
    for cid, c in doc["candidates"].items():
        for p, s in c["simulations"].items():
            L.append(f"| {cid} | {p} | {s['outcome']} | {s['totalBakes']} | {s['grindBakes']} | {s['maxGrindStreak']} | "
                     f"{s['maxPurchaseWaitBakes']} | {s['maxIdleWaitWithUnlockedUnbought']} | {s['maxUnlocksInOneBake']} | {s['refills']} | {s['finalStars']} | {s['finalPitz']} | "
                     f"{'<br>'.join(f for f in c['findings'] if p in f or ':' not in f) or '—'} |")
    L += ["", "## Static checks", "", "| candidate | steps | unreachable | useless steps | cycles | gates monotonic | max items/step |",
          "|---|---:|---|---|---|---|---:|"]
    for cid, c in doc["candidates"].items():
        st = c["static"]
        L.append(f"| {cid} | {c['stepCount']} | {st['unreachableRecipes'] or '—'} | {st['uselessUnlockSteps'] or '—'} | "
                 f"{st['circularPrerequisites'] or '—'} | {st['gatesMonotonic']} | {st['maxItemsPerStep']} |")
    L += ["", "## Sensitivity (recommended candidate)", "",
          "| variant | profile | outcome | bakes | grind | max grind streak | max wait | max idle wait | max unlocks/bake | refills | final 🪙 | findings |",
          "|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|"]
    for label, s in doc["sensitivity"].items():
        for p, v in s["simulations"].items():
            L.append(f"| {label} | {p} | {v['outcome']} | {v['totalBakes']} | {v['grindBakes']} | {v['maxGrindStreak']} | "
                     f"{v['maxPurchaseWaitBakes']} | {v['maxIdleWaitWithUnlockedUnbought']} | {v['maxUnlocksInOneBake']} | {v['refills']} | {v['finalPitz']} | "
                     f"{'<br>'.join(f for f in s['findings'] if p in f or ':' not in f) or '—'} |")
    L += ["", "## W1 ingredient matrix — PROPOSED", "",
          "| ingredient | step | key recipe | prerequisite (earlier) | bundled | Dex required | ⭐ equiv. | #196 ⭐ gate | unlock fee | first stock | pack | first pack 🪙 | refill 🪙 | recipes |",
          "|---|---:|---|---|---|---:|---:|---:|---:|---:|---|---:|---:|---|"]
    auth = doc["authorityAudit"]["w1AuthorityGatesOn25Recipes"]
    for r in doc["recommended"]["w1IngredientMatrix"]:
        L.append(f"| {r['ingredient']} | {r['step']} | {r['keyRecipe']} | {', '.join(r['prerequisiteIngredients']) or '—'} | "
                 f"{', '.join(r['bundledWith']) or '—'} | {r['dexRequired']} | {r['starEquivalent']} | {auth[r['ingredient']]['gate']} | {r['unlockCost']} | "
                 f"{r['firstStockOnUnlock']} | {r['packLabelJa']} | {r['firstPackPrice']} | {r['refillPrice']} | {', '.join(r['recipesUsing'])} |")
    L += ["", "## W1 recipe reachability", "", "| recipe | finite ingredients | new W1 ingredient | reachable at step | Dex required | discovered at bake (low / standard) |",
          "|---|---|---|---:|---:|---|"]
    for r in doc["recommended"]["w1RecipeReachability"]:
        L.append(f"| {r['recipe']} | {', '.join(r['finiteIngredients'])} | {', '.join(r['newW1Ingredients']) or '—'} | "
                 f"{r['reachableAtStep']} | {r['dexRequiredToReach']} | {r['discoveredAtBake']['low']} / {r['discoveredAtBake']['standard']} |")
    L += ["", "## Affordability (first cost of each step vs one discovery bake)", "",
          "| step | items | Dex required | first cost 🪙 | extra grind bakes low / beginner / standard / skilled |",
          "|---:|---|---:|---:|---|"]
    for a in doc["recommended"]["affordability"]:
        L.append(f"| {a['step']} | {', '.join(a['items'])} | {a['gate']} | {a['totalFirstCost']} | "
                 f"{a['extraBakes_low']} / {a['extraBakes_beginner']} / {a['extraBakes_standard']} / {a['extraBakes_skilled']} |")
    L += ["", "## Per-recipe refill cost per pizza vs reward (pack 10)", "",
          "| recipe | source | refill cost / pizza | margin ★1 | ★2 | ★3 | ★5 |", "|---|---|---:|---:|---:|---:|---:|"]
    for m in doc["recommended"]["recipeMargins"]:
        g = m["marginByQuality"]
        L.append(f"| {m['recipe']} | {m['source']} | {m['refillCostPerPizza']} | {g['1']} | {g['2']} | {g['3']} | {g['5']} |")
    L += ["", "## Pack size comparison", "", "| pizzas per pack | recipes losing Pitz at ★1 | at ★2 | worst refill cost / pizza | refills per ingredient per 30 pizzas |",
          "|---:|---|---|---:|---:|"]
    for p, v in doc["recommended"]["packComparison"].items():
        L.append(f"| {p} | {', '.join(v['negativeMarginRecipesAtQ1']) or '—'} | {', '.join(v['negativeMarginRecipesAtQ2']) or '—'} | "
                 f"{v['worstRefillCostPerPizza']} | {v['shopVisitsPerIngredientPer30Pizzas']} |")
    for prof in ("standard", "low"):
        L += ["", f"## Trace — recommended, {prof} profile", "",
              "| bake | event | detail | ⭐ | 🪙 | discovered | discoverable now | next unlock |", "|---:|---|---|---:|---:|---:|---|---|"]
        for e in doc["recommended"]["traces"][prof]:
            det = e["detail"] if isinstance(e["detail"], str) else ", ".join(e["detail"])
            nx = "—" if e["nextUnlock"] is None else f"#{e['nextUnlock']['step']} {', '.join(e['nextUnlock']['items'])} @⭐{e['nextUnlock']['gate']}"
            L.append(f"| {e['bake']} | {e['event']} | {det} | {e['stars']} | {e['pitz']} | {e['discoveredCount']} | "
                     f"{', '.join(e['discoverableNow']) or '—'} | {nx} |")
    s = doc["scaleStress"]
    L += ["", f"## Scale stress — {s['population']} ({s['recipes']} recipes)", "", s["note"], "",
          "| candidate | steps | final gate | useless steps | profile | outcome | discovered | bakes | grind | max streak | max wait | max unlocks/bake | findings |",
          "|---|---:|---:|---:|---|---|---:|---:|---:|---:|---:|---:|---|"]
    for cid, r in s["results"].items():
        for p, v in r["simulations"].items():
            L.append(f"| {cid} | {r['steps']} | {r['finalGate']} | {r['uselessUnlockSteps']} | {p} | {v['outcome']} | "
                     f"{v['discovered']}/{v['recipes']} | {v['totalBakes']} | {v['grindBakes']} | {v['maxGrindStreak']} | "
                     f"{v['maxPurchaseWaitBakes']} | {v['maxUnlocksInOneBake']} | "
                     f"{'<br>'.join(f for f in r['findings'] if p in f or ':' not in f) or '—'} |")
    L += ["", "## Negative controls", "", "| control | detector fired |", "|---|---|"]
    for k, v in doc["negativeControls"].items():
        L.append(f"| {k} | {v} |")
    return "\n".join(L) + "\n"


def serialize(doc):
    return json.dumps(doc, ensure_ascii=False, indent=2, sort_keys=False) + "\n"


def validate(doc, problems):
    rec = doc["candidates"][RECOMMENDED]
    if rec["findings"]:
        problems.append(f"recommended candidate has findings: {rec['findings']}")
    st = rec["static"]
    if not st["onlyMargheritaAtStart"]:
        problems.append("onboarding broken: starters must reach Margherita only")
    if st["firstGate"] != 2:
        problems.append("first unlock must follow the Margherita discovery (gate 2)")
    for k, v in doc["negativeControls"].items():
        if not v:
            problems.append(f"negative control failed: {k}")
    if set(r["ingredient"] for r in doc["recommended"]["w1IngredientMatrix"]) != set(W1_NEW_INGREDIENTS):
        problems.append("W1 ingredient matrix incomplete")
    for r in doc["recommended"]["w1RecipeReachability"]:
        if r["discoveredAtBake"]["low"] is None or r["discoveredAtBake"]["standard"] is None:
            problems.append(f"W1 recipe not discovered in trace: {r['recipe']}")
    for r in doc["recommended"]["w1IngredientMatrix"]:
        if r["status"] == "CONFIRMED":
            problems.append("REC-04 must not emit CONFIRMED candidate values")
    for d in doc["ownerDecisions"]:
        if d["status"] != "OWNER_DECISION_REQUIRED":
            problems.append("owner decision mislabelled")
    st = doc["scaleStress"]["results"][RECOMMENDED]
    if any(v["outcome"] != "COMPLETE" for v in st["simulations"].values()):
        problems.append("scale stress: recommended rules deadlock at 101 targets")
    if st["uselessUnlockSteps"] or st["maxItemsPerStep"] > 3:
        problems.append("scale stress: useless steps or oversized bundles")
    if any(v["maxUnlocksInOneBake"] > THRESHOLDS["unlockBurstItemsPerBake"] for v in st["simulations"].values()):
        problems.append("scale stress: unlock burst under recommended rules")
    for m in doc["recommended"]["recipeMargins"]:
        if m["marginByQuality"]["2"] < 0:
            problems.append(f"negative ★2 margin: {m['recipe']}")
    return problems


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--allow-offline-pins", action="store_true",
                    help="use the committed W1 snapshot when PR #221 objects are not fetched")
    args = ap.parse_args(argv)
    inputs, problems = load_inputs(args.allow_offline_pins)
    doc = build_json(inputs)
    doc2 = build_json(inputs)
    if serialize(doc) != serialize(doc2):
        problems.append("non-deterministic build")
    validate(doc, problems)
    out_json, out_md = serialize(doc), md(doc)
    if args.check:
        for path, text in ((OUT_JSON, out_json), (OUT_MD, out_md)):
            if not path.exists() or path.read_text(encoding="utf-8") != text:
                problems.append(f"byte drift: {path.relative_to(ROOT)}")
        if problems:
            print("FAIL")
            for p in problems:
                print(" -", p)
            return 1
        rec = doc["candidates"][RECOMMENDED]
        outcomes = ", ".join(k + "=" + v["outcome"] for k, v in rec["simulations"].items())
        print("PASS REC-04 check: pins ok, recommended findings=0, negative controls "
              f"{sum(doc['negativeControls'].values())}/{len(doc['negativeControls'])}, "
              f"profiles {outcomes}")
        return 0
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(out_json, encoding="utf-8")
    OUT_MD.write_text(out_md, encoding="utf-8")
    if problems:
        print("WROTE with problems:")
        for p in problems:
            print(" -", p)
        return 1
    print(f"wrote {OUT_JSON.relative_to(ROOT)} and {OUT_MD.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
