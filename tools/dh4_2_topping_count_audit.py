#!/usr/bin/env python3
"""Discovery Hint 4.0 DH4-2 pre-implementation audit (Issue #253): topping-count privacy audit.

Docs-only analysis tool. It reads the runtime snapshot of origin/main
(docs/reports/data/TETO_DISCOVERY-HINT-4_DH4-2_RUNTIME-SNAPSHOT.json) and the 172-recipe design
matrix, and writes docs/reports/data/TETO_DISCOVERY-HINT-4_DH4-2_PRE-AUDIT.json.

Nothing here is authority. The attribute answer below replicates the DH4-1 pure layer
(src/logic/discovery/deductionHint.ts, merged via PR #254 as 5a33d85) so the combinations can be
measured without wiring anything. The replica was checked against the merged module for all 24
targets x 2 inventories (48/48 identical) by a throw-away probe.

Player model (worst case = a smart player):
- S is the target's ingredient set. The player knows K (free key + bought material facts).
- Prior: every pizza has exactly one sauce (true for all 25 runtime recipes; visible in the Dex).
- N  = whole-recipe total (DH4-1 structure fact). Near-miss ADD_ONE on a pizza made of exactly K
  gives the same closure for free, so N stands for "N bought OR ADD_ONE seen".
- T  = topping total (the candidate this audit is about).
- A  = the DH4-1 reserve attribute answer (family -> group -> category -> existence, k >= 2 over
  OWNED ingredients not in the recipe, the reserve included).
A hypothesis is a set U of owned, not-known ingredients with K + U consistent with every given fact.
An ingredient is FORCED when it is in every hypothesis: the player can name it.

Usage:
  python3 tools/dh4_2_topping_count_audit.py           # regenerate the JSON
  python3 tools/dh4_2_topping_count_audit.py --check   # fail (exit 1) on drift or on a broken
                                                       # Owner-decided invariant (OD-DH4-2-1/2/4)
"""
from __future__ import annotations

import itertools
import json
import math
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SNAPSHOT = ROOT / "docs/reports/data/TETO_DISCOVERY-HINT-4_DH4-2_RUNTIME-SNAPSHOT.json"
MATRIX_172 = ROOT / "docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json"
CATALOG_62 = ROOT / "data/recipes/ingredient_master_catalog.json"
OUT = ROOT / "docs/reports/data/TETO_DISCOVERY-HINT-4_DH4-2_PRE-AUDIT.json"

# DH4-1 taxonomy (src/data/ingredientTaxonomy.ts, merged in 5a33d85).
FAMILY = {
    "sausage": "meat", "pepperoni": "meat", "bacon": "meat", "ham": "meat",
    "anchovy": "seafood", "tuna": "seafood", "clam": "seafood",
    "mushroom": "vegetable", "cherry-tomato": "vegetable", "onion": "vegetable", "black-olive": "vegetable",
    "corn": "vegetable", "eggplant": "vegetable", "fresh-tomato": "vegetable", "potato": "vegetable",
    "pineapple": "fruit",
    "basil": "herb", "oregano": "herb", "rosemary": "herb", "garlic": "herb",
    "capers": "spice",
    "egg": "other",
}
GROUP = {"meat": "protein", "seafood": "protein", "vegetable": "produce", "fruit": "produce",
         "herb": "aroma", "spice": "aroma", "other": "other"}

snap = json.loads(SNAPSHOT.read_text())
CAT = {i["id"]: i["category"] for i in snap["ingredients"]}
STARTERS = [i["id"] for i in snap["ingredients"] if i["starter"]]
RECIPES = {r["id"]: r for r in snap["recipes"]}
LADDER = snap["ladder"]
ORDER = ["margherita"] + [s["keyRecipeId"] for s in LADDER]
ALL_IDS = [i["id"] for i in snap["ingredients"]]


def ids(r):
    return [i["id"] for i in r["ingredients"]]


def n_total(r):
    return len(ids(r))


def t_total(r):
    return sum(1 for i in ids(r) if CAT[i] == "topping")


def c_total(r):
    return sum(1 for i in ids(r) if CAT[i] == "cheese")


def s_total(r):
    return sum(1 for i in ids(r) if CAT[i] == "sauce")


def owned_at(index):
    out = list(STARTERS)
    for s in LADDER:
        if s["step"] <= index:
            out += s["ingredientIds"]
    return list(dict.fromkeys(out))


# ---- DH4-1 attribute answer (replica of PR #254 reserveAttributeAnswer) -------------------------
def matches(level, value, i):
    if level == "family":
        return CAT[i] == "topping" and FAMILY.get(i) == value
    if level == "group":
        return CAT[i] == "topping" and FAMILY.get(i) is not None and GROUP[FAMILY[i]] == value
    if level == "category":
        return CAT[i] == value
    return True


def attribute_answer(r, owned):
    reserve = r["reserve"]
    rec = set(ids(r))
    levels = []
    if CAT[reserve] == "topping" and reserve in FAMILY:
        levels.append(("family", FAMILY[reserve]))
        levels.append(("group", GROUP[FAMILY[reserve]]))
    levels.append(("category", CAT[reserve]))
    for level, value in levels:
        pool = [reserve] + [i for i in owned if i not in rec and matches(level, value, i)]
        if len(pool) >= 2:
            return (level, value)
    return ("existence", None)


# ---- hypothesis enumeration ---------------------------------------------------------------------
def subsets(pool, k):
    if k < 0 or k > len(pool):
        return []
    return [frozenset(c) for c in itertools.combinations(pool, k)]


def analyse(r, owned, known, facts):
    """facts: dict with optional N, T, A. Returns (hypothesis count or None, forced set)."""
    known = set(known)
    unk = [i for i in owned if i not in known]
    pools = {c: [i for i in unk if CAT[i] == c] for c in ("sauce", "cheese", "topping")}
    ks = {c: sum(1 for i in known if CAT[i] == c) for c in ("sauce", "cheese", "topping")}
    s_need = 0 if ks["sauce"] >= 1 else 1  # exactly-one-sauce prior
    if s_need > len(pools["sauce"]):
        return 0, set()
    A = facts.get("A")

    def a_ok(u):
        if A is None:
            return True
        level, value = A
        return any(matches(level, value, i) for i in u) if level != "existence" else len(u) > 0

    unbounded = "N" not in facts and "T" not in facts
    if unbounded:
        # Topping subsets are unconstrained: only the attribute can force something.
        if A is None:
            forced = set(pools["sauce"]) if s_need == 1 and len(pools["sauce"]) == 1 else set()
            return None, forced
        level, value = A
        cand = [i for i in unk if (matches(level, value, i) if level != "existence" else True)]
        forced = set(cand) if len(cand) == 1 else set()
        if s_need == 1 and len(pools["sauce"]) == 1:
            forced |= set(pools["sauce"])
        return None, forced

    hyps = []
    t_range = [facts["T"] - ks["topping"]] if "T" in facts else range(0, len(pools["topping"]) + 1)
    for t in t_range:
        if t < 0 or t > len(pools["topping"]):
            continue
        if "N" in facts:
            c_range = [facts["N"] - len(known) - s_need - t]
        else:
            c_range = range(0, len(pools["cheese"]) + 1)
        for c in c_range:
            if c < 0 or c > len(pools["cheese"]):
                continue
            for su in subsets(pools["sauce"], s_need):
                for cu in subsets(pools["cheese"], c):
                    for tu in subsets(pools["topping"], t):
                        u = su | cu | tu
                        if a_ok(u):
                            hyps.append(u)
    if not hyps:
        return 0, set()
    forced = set.intersection(*[set(h) for h in hyps])
    return len(hyps), forced


def reachable_known_sets(r):
    key = r["key"]
    sell = r["sellable"]
    by = defaultdict(list)
    for i in sell:
        by[CAT[i]].append(i)
    cats = [c for c in ("sauce", "cheese", "topping") if by[c]]
    out = []
    for lens in itertools.product(*[range(len(by[c]) + 1) for c in cats]):
        k = set([key] if key else [])
        for c, n in zip(cats, lens):
            k |= set(by[c][:n])
        out.append(frozenset(k))
    return out


def recipe_candidates(target_index, known, facts, owned=None):
    out = []
    for j, rid in enumerate(ORDER):
        if j < target_index or j == 0:
            continue  # discovered (earlier ladder steps) or the onboarding
        r = RECIPES[rid]
        s = set(ids(r))
        if not set(known) <= s:
            continue
        if owned is not None and not s <= set(owned):
            continue
        if "N" in facts and n_total(r) != facts["N"]:
            continue
        if "T" in facts and t_total(r) != facts["T"]:
            continue
        if "A" in facts:
            level, value = facts["A"]
            rest = s - set(known)
            if level != "existence" and not any(matches(level, value, i) for i in rest):
                continue
            if level == "existence" and not rest:
                continue
        out.append(rid)
    return out


COMBOS = {
    "none": (),
    "N": ("N",),
    "T": ("T",),
    "A": ("A",),
    "N+T": ("N", "T"),
    "N+A": ("N", "A"),
    "T+A": ("T", "A"),
    "N+T+A": ("N", "T", "A"),
}

rows = []
summary = {sc: {c: {"reserveForcedRecipes": [], "unsoldMaterialForcedRecipes": [], "unsoldMaterialNewlyForcedRecipes": []} for c in COMBOS} for sc in ("ladderOwned", "allOwned")}
endgame_pools = []
for index, rid in enumerate(ORDER):
    if index == 0:
        continue
    r = RECIPES[rid]
    row = {
        "ladderIndex": index, "recipeId": rid, "nameJa": r["nameJa"],
        "N": n_total(r), "T": t_total(r), "cheese": c_total(r), "sauce": s_total(r),
        "key": r["key"], "reserve": r["reserve"], "reserveCategory": CAT[r["reserve"]],
        "sellable": r["sellable"], "scenarios": {},
    }
    for sc, owned in (("ladderOwned", owned_at(index)), ("allOwned", ALL_IDS)):
        A = attribute_answer(r, owned)
        facts_full = {"N": n_total(r), "T": t_total(r), "A": A}
        sc_out = {"owned": len(owned), "attributeAnswer": f"{A[0]}:{A[1]}" if A[1] else A[0], "combos": {}}
        states = reachable_known_sets(r)
        endgame = frozenset(([r["key"]] if r["key"] else []) + r["sellable"])
        fresh = frozenset([r["key"]] if r["key"] else [])
        for cname, keys in COMBOS.items():
            facts = {k: facts_full[k] for k in keys}
            reserve_forced_states = 0
            unsold_forced_states = 0
            new_unsold_states = []
            for k in states:
                nh, forced = analyse(r, owned, k, facts)
                _, baseline = analyse(r, owned, k, {})
                if r["reserve"] in forced:
                    reserve_forced_states += 1
                if forced & (set(r["sellable"]) - k):
                    unsold_forced_states += 1
                newly = (forced - baseline) & (set(r["sellable"]) - k)
                if newly:
                    new_unsold_states.append({"known": sorted(k), "newlyForced": sorted(newly)})
            nh_end, forced_end = analyse(r, owned, endgame, facts)
            nh_fresh, forced_fresh = analyse(r, owned, fresh, facts)
            sc_out["combos"][cname] = {
                "reachableStates": len(states),
                "statesWhereReserveForced": reserve_forced_states,
                "statesWhereUnboughtMaterialForced": unsold_forced_states,
                "statesWhereUnboughtMaterialNewlyForced": new_unsold_states,
                "endgameHypotheses": nh_end,
                "endgameForced": sorted(forced_end),
                "freshHypotheses": nh_fresh,
                "freshForced": sorted(forced_fresh),
                "recipeCandidatesFresh": len(recipe_candidates(index, fresh, facts)),
                "recipeCandidatesEndgame": len(recipe_candidates(index, endgame, facts)),
                "makeableCandidatesFresh": len(recipe_candidates(index, fresh, facts, owned)),
            }
            if reserve_forced_states:
                summary[sc][cname]["reserveForcedRecipes"].append(rid)
            if unsold_forced_states:
                summary[sc][cname]["unsoldMaterialForcedRecipes"].append(rid)
            if new_unsold_states:
                summary[sc][cname]["unsoldMaterialNewlyForcedRecipes"].append(rid)
        row["scenarios"][sc] = sc_out
    rows.append(row)

# ---- distributions ------------------------------------------------------------------------------
targets = [RECIPES[rid] for rid in ORDER[1:]]
all25 = [RECIPES[rid] for rid in ORDER]
dist = {
    "toppingTotal25": dict(sorted(Counter(t_total(r) for r in all25).items())),
    "toppingTotalTargets24": dict(sorted(Counter(t_total(r) for r in targets).items())),
    "ingredientTotal25": dict(sorted(Counter(n_total(r) for r in all25).items())),
    "sauceTotal25": dict(sorted(Counter(s_total(r) for r in all25).items())),
    "cheeseTotal25": dict(sorted(Counter(c_total(r) for r in all25).items())),
    "recipesByToppingTotal": {str(t): [r["id"] for r in all25 if t_total(r) == t] for t in sorted({t_total(r) for r in all25})},
    "recipesByNT": {f"N{n}-T{t}": [r["id"] for r in all25 if (n_total(r), t_total(r)) == (n, t)]
                    for n, t in sorted({(n_total(r), t_total(r)) for r in all25})},
    "nonSauceCountEqualsNminus1For": sum(1 for r in all25 if n_total(r) - s_total(r) == n_total(r) - 1),
}
nt_classes = Counter((n_total(r), t_total(r)) for r in targets)
n_classes = Counter(n_total(r) for r in targets)
dist["structureIdentifiability24"] = {
    "N_only": {"classes": len(n_classes), "largest": max(n_classes.values()), "unique": sum(1 for v in n_classes.values() if v == 1)},
    "N_and_T": {"classes": len(nt_classes), "largest": max(nt_classes.values()), "unique": sum(1 for v in nt_classes.values() if v == 1)},
}

# key + structure identity among the 24 catalogue targets (catalogue-level, no Dex filter)
def ident(keys):
    groups = Counter()
    for r in targets:
        sig = tuple([r["key"]] + [n_total(r) if "N" in keys else None, t_total(r) if "T" in keys else None])
        groups[sig] += 1
    return sum(1 for r in targets if groups[tuple([r["key"]] + [n_total(r) if "N" in keys else None, t_total(r) if "T" in keys else None])] == 1)
dist["keyPlusStructureUniqueAmong24"] = {"key": ident(()), "key+N": ident(("N",)), "key+T": ident(("T",)), "key+N+T": ident(("N", "T"))}

# ---- information value (endgame bits, ladder owned) ---------------------------------------------
def bits(before, after):
    if not before or not after:
        return None
    return round(math.log2(before / after), 2)

info = []
for row in rows:
    c = row["scenarios"]["ladderOwned"]["combos"]
    info.append({
        "recipeId": row["recipeId"],
        "endgameHyp": {k: c[k]["endgameHypotheses"] for k in ("N", "N+T", "N+A", "N+T+A")},
        "bits_T_given_N": bits(c["N"]["endgameHypotheses"], c["N+T"]["endgameHypotheses"]),
        "bits_A_given_N": bits(c["N"]["endgameHypotheses"], c["N+A"]["endgameHypotheses"]),
    })
def avg(key):
    vals = [x[key] for x in info if x[key] is not None]
    return round(sum(vals) / len(vals), 2) if vals else None

# ---- mid-game value of T (all reachable states, ladder owned) -----------------------------------
def guard_T(r, owned):
    """Candidate TC-G guard: T >= 1 and, in the privacy worst case (every other ingredient known and
    N known), the reserve still has >= 2 candidates on its side of the topping / non-topping split."""
    if t_total(r) == 0:
        return False
    rec = set(ids(r))
    side = (lambda i: CAT[i] == "topping") if CAT[r["reserve"]] == "topping" else (lambda i: CAT[i] == CAT[r["reserve"]])
    pool = [r["reserve"]] + [i for i in owned if i not in rec and side(i)]
    return len(pool) >= 2

midgame = []
for index, rid in enumerate(ORDER):
    if index == 0:
        continue
    r = RECIPES[rid]
    owned = owned_at(index)
    A = attribute_answer(r, owned)
    endgame = frozenset(([r["key"]] if r["key"] else []) + r["sellable"])
    vals_T, vals_A, vals_TA = [], [], []
    for k in reachable_known_sets(r):
        if k == endgame:
            continue
        n0, _ = analyse(r, owned, k, {"N": n_total(r)})
        nT, _ = analyse(r, owned, k, {"N": n_total(r), "T": t_total(r)})
        nA, _ = analyse(r, owned, k, {"N": n_total(r), "A": A})
        nTA, _ = analyse(r, owned, k, {"N": n_total(r), "A": A, "T": t_total(r)})
        vals_T.append(bits(n0, nT)); vals_A.append(bits(n0, nA)); vals_TA.append(bits(nA, nTA))
    midgame.append({"recipeId": rid, "nonEndgameStates": len(vals_T),
                    "avgBits_T_given_N": round(sum(vals_T) / len(vals_T), 2) if vals_T else None,
                    "avgBits_A_given_N": round(sum(vals_A) / len(vals_A), 2) if vals_A else None,
                    "avgBits_T_given_NA": round(sum(vals_TA) / len(vals_TA), 2) if vals_TA else None,
                    "guardTC_G_ladderOwned": guard_T(r, owned), "guardTC_G_allOwned": guard_T(r, ALL_IDS)})
def mavg(key):
    v = [x[key] for x in midgame if x[key] is not None]
    return round(sum(v) / len(v), 2)
endgame_T_given_NA = []
for row in rows:
    c = row["scenarios"]["ladderOwned"]["combos"]
    endgame_T_given_NA.append({"recipeId": row["recipeId"], "bits": bits(c["N+A"]["endgameHypotheses"], c["N+T+A"]["endgameHypotheses"])})

# ---- guard-aware player (inverts the answer LEVEL), endgame with N known ---------------------------
def guard_aware_endgame(r, owned, use_T_guard):
    """Endgame, N known (bought or via ADD_ONE): exactly one unknown x. A guard-aware player keeps x
    only if the attribute answer computed for the hypothetical recipe K+{x} (reserve x) equals the
    observed answer (and, for TC-G, the guard outcome is the same)."""
    k = set(([r["key"]] if r["key"] else []) + r["sellable"])
    obs = attribute_answer(r, owned)
    obs_g = guard_T(r, owned)
    cands = []
    for x in owned:
        if x in k:
            continue
        if CAT[x] == "sauce" and any(CAT[i] == "sauce" for i in k):
            continue  # exactly-one-sauce prior
        if CAT[x] != "sauce" and not any(CAT[i] == "sauce" for i in k):
            continue
        hyp = {"id": "hyp", "ingredients": [{"id": i} for i in list(k) + [x]], "reserve": x}
        if attribute_answer(hyp, owned) != obs:
            continue
        if use_T_guard and guard_T(hyp, owned) != obs_g:
            continue
        cands.append(x)
    return cands

guard_aware = []
for index, rid in enumerate(ORDER):
    if index == 0:
        continue
    r = RECIPES[rid]
    for sc, owned in (("ladderOwned", owned_at(index)), ("allOwned", ALL_IDS)):
        a = guard_aware_endgame(r, owned, False)
        g = guard_aware_endgame(r, owned, True)
        guard_aware.append({"recipeId": rid, "scenario": sc, "answer": "%s:%s" % attribute_answer(r, owned),
                            "candidatesAfterLevelInversion_A": a, "candidatesAfterLevelInversion_A_plus_TCG_guard": g})

# ---- proposed inversion-safe guard ("level before value") -----------------------------------------
def worst_case_pool(r, owned):
    """W = the reserve plus every owned ingredient that is not in the recipe: the unknowns the player
    could still be choosing between after learning every other ingredient."""
    rec = set(ids(r))
    return [r["reserve"]] + [i for i in owned if i not in rec]


def class_of(level, i):
    """Total at every level: an ingredient without a family (sauce, cheese, an unclassified topping)
    is classed by its category, so the level choice can never depend on whether the reserve has a
    family (that difference alone would be invertible)."""
    if level in ("family", "group") and CAT[i] == "topping" and i in FAMILY:
        return (level, FAMILY[i] if level == "family" else GROUP[FAMILY[i]])
    if level in ("family", "group", "category"):
        return ("category", CAT[i])
    return ("existence", None)


def safe_attribute_answer(r, owned):
    """The level is chosen from W alone (the same W for every hypothetical reserve in W), so the level
    says nothing about which member is the reserve. A level is usable only if EVERY member of W that
    has a class at that level shares it with >= 2 members, and the reserve has a class there."""
    w = [i for i in worst_case_pool(r, owned) if not (CAT[i] == "sauce" and any(CAT[j] == "sauce" and j != r["reserve"] for j in ids(r)))]
    for level in ("family", "group", "category"):
        classes = Counter(class_of(level, i) for i in w)
        if all(v >= 2 for v in classes.values()):
            c = class_of(level, r["reserve"])
            return (c[0], c[1])
    return ("existence", None)


def safe_attribute_answer_variant(family_patch):
    """Re-runs the strict rule with a merged runtime taxonomy (measurement only)."""
    base = dict(FAMILY)
    FAMILY.update(family_patch)
    try:
        res = {}
        for sc in ("ladderOwned", "allOwned"):
            levels = Counter()
            name_eq = []
            for index, rid in enumerate(ORDER):
                if index == 0:
                    continue
                r = RECIPES[rid]
                owned = owned_at(index) if sc == "ladderOwned" else ALL_IDS
                levels[safe_attribute_answer(r, owned)[0]] += 1
                if len(inversion_candidates(r, owned, safe_attribute_answer)) < 2:
                    name_eq.append(rid)
            res[sc] = {"levels": dict(levels), "nameEquivalentAfterInversion": name_eq}
        return res
    finally:
        FAMILY.clear()
        FAMILY.update(base)


def safe_T_guard(r, owned):
    """TC-G (inversion-safe): T is told only if T >= 1 and every category side present in W has >= 2
    members, so the told value never isolates one hypothetical reserve."""
    if t_total(r) == 0:
        return False
    w = [i for i in worst_case_pool(r, owned) if not (CAT[i] == "sauce" and any(CAT[j] == "sauce" and j != r["reserve"] for j in ids(r)))]
    sides = Counter("topping" if CAT[i] == "topping" else CAT[i] for i in w)
    return all(v >= 2 for v in sides.values())


def inversion_candidates(r, owned, fn):
    k = set(([r["key"]] if r["key"] else []) + r["sellable"])
    obs = fn(r, owned)
    out = []
    for x in owned:
        if x in k:
            continue
        if CAT[x] == "sauce" and any(CAT[i] == "sauce" for i in k):
            continue
        if CAT[x] != "sauce" and not any(CAT[i] == "sauce" for i in k):
            continue
        hyp = {"id": "hyp", "ingredients": [{"id": i} for i in list(k) + [x]], "reserve": x}
        if fn(hyp, owned) == obs:
            out.append(x)
    return out


def combined_safe(r, owned):
    a = safe_attribute_answer(r, owned)
    g = safe_T_guard(r, owned)
    return (a, g, t_total(r) if g else None)


safe_rows = []
for index, rid in enumerate(ORDER):
    if index == 0:
        continue
    r = RECIPES[rid]
    for sc, owned in (("ladderOwned", owned_at(index)), ("allOwned", ALL_IDS)):
        a = safe_attribute_answer(r, owned)
        safe_rows.append({
            "recipeId": rid, "scenario": sc,
            "dh41Answer": "%s:%s" % attribute_answer(r, owned),
            "safeAnswer": "%s:%s" % a,
            "safeTGuardPasses": safe_T_guard(r, owned),
            "inversionCandidates_safeA": inversion_candidates(r, owned, safe_attribute_answer),
            "inversionCandidates_safeA_plus_TCG": inversion_candidates(r, owned, combined_safe),
        })

# ---- Final Owner Decision Gate: attribute-guard options (OD-DH4-2-4) -------------------------------
def known_of(r):
    """The worst-case known set: every recipe ingredient except the reserve."""
    return {i["id"] for i in r["ingredients"]} - {r["reserve"]}


def hypothetical_recipes(known, owned):
    """Every hypothetical recipe the player cannot rule out at the endgame: known + one owned x
    (exactly-one-sauce prior), with x as its reserve."""
    out = []
    for x in owned:
        if x in known:
            continue
        if CAT[x] == "sauce" and any(CAT[i] == "sauce" for i in known):
            continue
        if CAT[x] != "sauce" and not any(CAT[i] == "sauce" for i in known):
            continue
        out.append({"id": "hyp", "ingredients": [{"id": i} for i in list(known) + [x]], "reserve": x})
    return out


def reserve_isolation_wrapper(r, owned):
    """Option (b): DH4-1's answer function is kept as is. A wrapper keeps its answer when at least 2
    hypothetical reserves would receive the same DH4-1 answer, else falls back to the strict level."""
    a = attribute_answer(r, owned)
    same = [h for h in hypothetical_recipes(known_of(r), owned) if attribute_answer(h, owned) == a]
    return a if len(same) >= 2 else safe_attribute_answer(r, owned)


def partition_checked(r, owned):
    """Option (c): DH4-1's answer only if EVERY DH4-1 answer class over the hypotheses has >= 2
    members (decided from W alone), else the strict answer for everyone. Inversion-safe."""
    counts = Counter(attribute_answer(h, owned) for h in hypothetical_recipes(known_of(r), owned))
    return attribute_answer(r, owned) if all(v >= 2 for v in counts.values()) else safe_attribute_answer(r, owned)


def with_tcg(fn):
    def combined(r, owned):
        g = safe_T_guard(r, owned)
        return (fn(r, owned), g, t_total(r) if g else None)
    return combined


attribute_options = {}
for label, fn in (("a_dh41_as_merged", attribute_answer), ("b_reserve_isolation_wrapper", reserve_isolation_wrapper),
                  ("c_partition_checked", partition_checked), ("strict_level_before_value", safe_attribute_answer)):
    res = {}
    for sc in ("ladderOwned", "allOwned"):
        levels = Counter()
        named, named_tcg = [], []
        for index, rid in enumerate(ORDER):
            if index == 0:
                continue
            r = RECIPES[rid]
            owned = owned_at(index) if sc == "ladderOwned" else ALL_IDS
            levels[fn(r, owned)[0]] += 1
            if len(inversion_candidates(r, owned, fn)) < 2:
                named.append(rid)
            if len(inversion_candidates(r, owned, with_tcg(fn))) < 2:
                named_tcg.append(rid)
        res[sc] = {"levels": dict(levels), "namedAfterLevelInversion": named, "namedAfterLevelInversion_withTCG": named_tcg}
    attribute_options[label] = res

RUNTIME_MERGE = {"pineapple": "other", "capers": "other"}  # needs the Human Classification Gate (PR #255 OD-TAX-7)


def fmt_answer(a):
    return a[0] if a[0] == "existence" else "%s:%s" % a


def option_d_run():
    base = dict(FAMILY)
    FAMILY.update(RUNTIME_MERGE)
    try:
        res = {}
        for sc in ("ladderOwned", "allOwned"):
            levels, named = Counter(), []
            for index, rid in enumerate(ORDER):
                if index == 0:
                    continue
                r = RECIPES[rid]
                owned = owned_at(index) if sc == "ladderOwned" else ALL_IDS
                levels[partition_checked(r, owned)[0]] += 1
                if len(inversion_candidates(r, owned, partition_checked)) < 2 or len(inversion_candidates(r, owned, with_tcg(partition_checked))) < 2:
                    named.append(rid)
            res[sc] = {"levels": dict(levels), "namedAfterLevelInversion_incl_TCG": named}
        per = {}
        for index, rid in enumerate(ORDER):
            if index == 0:
                continue
            r = RECIPES[rid]
            per[rid] = {sc: fmt_answer(partition_checked(r, owned_at(index) if sc == "ladderOwned" else ALL_IDS)) for sc in ("ladderOwned", "allOwned")}
        return res, per
    finally:
        FAMILY.clear()
        FAMILY.update(base)


# Inventory sweep: every target at its own ladder step and at every later ladder step (a Dex-pinned
# or late target), 300 states. The two sampled inventories above are a subset.
inventory_sweep = {"states": 0, "a_dh41_as_merged": [], "c_partition_checked": [], "c_partition_checked_withTCG": [], "c_levels": Counter()}
for index, rid in enumerate(ORDER):
    if index == 0:
        continue
    r = RECIPES[rid]
    for step in range(index, len(ORDER)):
        owned = owned_at(step)
        inventory_sweep["states"] += 1
        if len(inversion_candidates(r, owned, attribute_answer)) < 2:
            inventory_sweep["a_dh41_as_merged"].append({"recipeId": rid, "ladderStep": step, "answer": fmt_answer(attribute_answer(r, owned)),
                                                        "named": inversion_candidates(r, owned, attribute_answer)})
        if len(inversion_candidates(r, owned, partition_checked)) < 2:
            inventory_sweep["c_partition_checked"].append({"recipeId": rid, "ladderStep": step})
        if len(inversion_candidates(r, owned, with_tcg(partition_checked))) < 2:
            inventory_sweep["c_partition_checked_withTCG"].append({"recipeId": rid, "ladderStep": step})
        inventory_sweep["c_levels"][partition_checked(r, owned)[0]] += 1
        # TC-G closure over every reachable purchase state: N (bought or ADD_ONE) + clause (+ the
        # adopted guarded attribute) must never force the reserve.
        facts = {"N": n_total(r)}
        if safe_T_guard(r, owned):
            facts["T"] = t_total(r)
        guarded = partition_checked(r, owned)
        for k in reachable_known_sets(r):
            for extra in ({}, {"A": guarded}):
                _, forced = analyse(r, owned, k, dict(facts, **extra))
                _, base = analyse(r, owned, k, extra)
                if r["reserve"] in forced and r["reserve"] not in base:
                    inventory_sweep.setdefault("tcg_reserveForced", []).append({"recipeId": rid, "ladderStep": step})
                if (forced - base) & (set(r["sellable"]) - k):
                    inventory_sweep.setdefault("tcg_unboughtMaterialNamedRecipes", set()).add(rid)
inventory_sweep["c_levels"] = dict(inventory_sweep["c_levels"])
inventory_sweep.setdefault("tcg_reserveForced", [])
inventory_sweep["tcg_unboughtMaterialNamedRecipes"] = sorted(inventory_sweep.get("tcg_unboughtMaterialNamedRecipes", set()))
inventory_sweep["a_dh41_recipes"] = sorted({x["recipeId"] for x in inventory_sweep["a_dh41_as_merged"]})

attribute_options["d_partition_checked_plus_runtime_merge"], per_d = option_d_run()
attribute_answers_per_recipe = {}
for index, rid in enumerate(ORDER):
    if index == 0:
        continue
    r = RECIPES[rid]
    row = {}
    for sc in ("ladderOwned", "allOwned"):
        owned = owned_at(index) if sc == "ladderOwned" else ALL_IDS
        row[sc] = {"a": fmt_answer(attribute_answer(r, owned)), "b": fmt_answer(reserve_isolation_wrapper(r, owned)),
                   "c": fmt_answer(partition_checked(r, owned)), "d": per_d[rid][sc]}
    attribute_answers_per_recipe[rid] = row

# ---- Final Owner Decision Gate: topping-count options A..E (STEP 2) -------------------------------
def option_summary(fact_keys, use_tcg=False):
    """Per option: reserve named / unbought material newly named, over every reachable state, with and
    without the DH4-1 attribute, N always assumed known when the option includes it or via ADD_ONE."""
    out = {}
    for sc in ("ladderOwned", "allOwned"):
        reserve_named, material_named, zero_stated = [], [], []
        for index, rid in enumerate(ORDER):
            if index == 0:
                continue
            r = RECIPES[rid]
            owned = owned_at(index) if sc == "ladderOwned" else ALL_IDS
            facts = {}
            if "N" in fact_keys:
                facts["N"] = n_total(r)
            if "T" in fact_keys and (not use_tcg or safe_T_guard(r, owned)):
                facts["T"] = t_total(r)
            if "T" in facts and facts["T"] == 0:
                zero_stated.append(rid)
            hit_r = hit_m = False
            for k in reachable_known_sets(r):
                for extra in ({}, {"A": attribute_answer(r, owned)}):
                    f = dict(facts, **extra)
                    _, forced = analyse(r, owned, k, f)
                    _, base = analyse(r, owned, k, extra)
                    if r["reserve"] in forced and r["reserve"] not in base:
                        hit_r = True
                    if (forced - base) & (set(r["sellable"]) - k):
                        hit_m = True
            if hit_r:
                reserve_named.append(rid)
            if hit_m:
                material_named.append(rid)
        out[sc] = {"reserveNamed": reserve_named, "unboughtMaterialNewlyNamed": material_named, "zeroCountStated": zero_stated}
    return out

targets24 = [RECIPES[rid] for rid in ORDER[1:]]
def classes(fn):
    c = Counter(fn(r) for r in targets24)
    return {"classes": len(c), "largest": max(c.values()), "unique": sum(1 for v in c.values() if v == 1)}

topping_count_options = {
    "A_ingredient_total": {"copy": "材料は全部で○種類", "sameInformationAs": "E", "recipeClasses24": classes(n_total), **option_summary(("N",))},
    "B_topping_total_raw": {"copy": "トッピングは全部で○種類", "recipeClasses24": classes(t_total), **option_summary(("N", "T"))},
    "C_gu_zai_total": {"copy": "具材は全部で○種類", "note": "Read as cheese + topping it equals N - 1 for all 25 (one sauce each), so the information is N; read as toppings it is B.",
                       "equalsNminus1For": sum(1 for r in all25 if n_total(r) - s_total(r) == n_total(r) - 1), "recipeClasses24": classes(lambda r: n_total(r) - s_total(r)), **option_summary(("N",))},
    "D_total_plus_topping_raw": {"copy": "材料は全部で○種類 + トッピングは○種類", "recipeClasses24": classes(lambda r: (n_total(r), t_total(r))), **option_summary(("N", "T"))},
    "D_prime_total_plus_topping_TCG": {"copy": "材料は全部で○種類（+ ガード通過時のみ トッピングは○種類）", **option_summary(("N", "T"), use_tcg=True)},
    "E_total_only": {"copy": "材料総数だけ", "sameInformationAs": "A", "recipeClasses24": classes(n_total), **option_summary(("N",))},
}


# ---- Owner Decisions (Owner Authority, recorded at the DH4-2 Final Owner Decision Gate) ------------
OWNER_DECISIONS = [
    {"id": "OD-DH4-2-1", "topic": "構成ヒント (structure)", "decision": "D-prime: base fact 「材料は全部で○種類」; the added fact 「トッピングは○種類使うよ」 only when the TC-G safety check passes.",
     "forbidden": ["topping 0", "remaining ingredient count", "remaining topping count", "category-zero", "a count that names the Rule W reserve", "pre-purchase availability / granularity leak"]},
    {"id": "OD-DH4-2-2", "topic": "特徴ヒント guard", "decision": "Option (c) partition check, as an outer privacy guard around the unchanged DH4-1 answer function. Over W, the DH4-1 answer of every hypothetical reserve is partitioned; if any class would single out a reserve, fall back to the strict (coarser) answer.",
     "requirements": ["inversion name leak = 0", "decision from W only", "granularity not inferable from the pre-purchase UI", "deterministic"]},
    {"id": "OD-DH4-2-3", "topic": "Taxonomy", "decision": "No semantic reclassification for privacy alone. pineapple / capers / black-olive / garlic are decided at the PR #255 Human Classification Gate. Option (d) is not production authority."},
    {"id": "OD-DH4-2-4", "topic": "Existence-only outcome", "decision": "charge 0, no persistence mutation, not recorded as a purchased fact, consistent with 「Pitzはヒントが出たときだけ使うよ」. The pre-purchase UI must not say 「今回は無料」 or 「具体的なヒントは出ない」 (FREE LEAK)."},
    {"id": "OD-DH4-2-5", "topic": "Economy", "decision": "E3: structure and attribute purchases are wired and verifiable under the DEV / Preview flag only; production does not enable them; no production 0 Pitz price; production prices are decided in DH4-ECON / H3-ECON-1. The material ESC 5/10/20/40 is unchanged."},
    {"id": "OD-DH4-2-6", "topic": "UI", "decision": "U3-C. 「わかっていること」 (材料 / 構成 / 特徴 / 以前のヒント) and 「ヒントをもらう」 (材料 / 構成 / 特徴). The material card gets 「おまかせ」. A card is a choice of question type and never shows availability, granularity or candidate counts in advance."},
    {"id": "OD-DH4-2-7", "topic": "Vertical layout", "decision": "The 45dvh cap is revisited: H3-4 OD-H3-4-7 is superseded by DH4-2. A near-full-screen sheet on mobile with a fixed header, 「わかっていること」 as the main scroll area, and a fixed footer holding mainly 「ヒントをもらう」 and the Pitz line. Safe area. Verified at 390x844, 360x800 and 360x640. Scrollability visible; 「▾ 下にもヒントがあるよ」 when needed.", "supersedes": ["OD-H3-4-7"]},
    {"id": "OD-DH4-2-8", "topic": "Known Information", "decision": "The unknown 「？」 rows are removed in the new U3. Only real positive facts are shown. The legacy 「以前のヒント」 stays in a separate box with its display right, including legacy negative lines as archive.", "supersedes": ["OD-H3-4-5 / OD-H3-4-6 「？」 rows and legend (in the U3 sheet)"]},
    {"id": "OD-DH4-2-9", "topic": "「その他」 wording", "decision": "Final wording after the taxonomy authority is settled. 「ちょっと変わった材料があるよ」 is provisional and usable in Preview only, and must not imply a classification for undecided ingredients."},
    {"id": "OD-DH4-2-10", "topic": "Near-miss / Dinner", "decision": "Near-miss unchanged; no free attribute hint; the hint purchase flow stays blocked in Dinner."},
    {"id": "OD-DH4-2-11", "topic": "Slicing", "decision": "DH4-2A pure logic only (no production wiring) -> DH4-2B runtime wiring behind the DEV / Preview flag (production purchase disabled) -> DH4-2C U3 UI + near-full-screen sheet + iPhone Human Verification -> DH4-2D adversarial privacy, legacy migration / regression, purchase / persistence regression, full final gate. Each slice is its own PR or a clearly separate commit, rollback-able on its own."},
    {"id": "OD-DH4-2-12", "topic": "PR #255", "decision": "Not merged now. Its audit docs gain the 5 level-inversion cases; statements that read 'runtime singletons are safe by the DH4-1 guard' are corrected, and the need for the DH4-2 partition guard is stated. No production taxonomy logic change. The Human Classification Gate stays."},
    {"id": "OD-DH4-2-13", "topic": "Re-verify the current build", "decision": "The Hint UI is re-checked on the current Preview / build. Not a blocker for DH4-2A; recorded as the DH4-2C Human Verification baseline."},
]
OWNER_DECISIONS_META = {"authority": "Owner Authority, recorded 2026-09-27 at the DH4-2 Final Owner Decision Gate",
                        "adoptedAttributeGuard": "c_partition_checked", "notAuthority": ["d_partition_checked_plus_runtime_merge"],
                        "adoptedStructure": "D_prime_total_plus_topping_TCG"}

# ---- 172 scalability ----------------------------------------------------------------------------
m172 = json.loads(MATRIX_172.read_text())
cat62 = {i["id"]: i["category"] for i in json.loads(CATALOG_62.read_text())["ingredients"]}
spread = set(m172["spreadLayerIngredientIds"])
CHEESE_TOKENS = ("cheese", "mozzarella", "parmigiano", "gorgonzola", "fontina", "feta", "cheddar", "burrata",
                 "paneer", "pecorino", "ricotta", "provolone", "scamorza", "stracchino", "taleggio", "emmental",
                 "gruyere", "raclette", "camembert", "brie", "halloumi", "mascarpone", "provola", "caciocavallo",
                 "fior-di-latte", "bufala", "asiago", "comte", "reblochon", "manchego", "queso")
def cat172(i):
    if i in CAT:
        return CAT[i], "runtime"
    if i in cat62:
        return cat62[i], "catalog62"
    if i in spread:
        return "sauce", "heuristic:spreadLayer"
    if i.endswith("-sauce") or i.endswith("-dressing") or i in ("salsa",):
        return "sauce", "heuristic:name"
    if any(tok in i for tok in CHEESE_TOKENS) and not i.endswith("-sauce"):
        return "cheese", "heuristic:name"
    return "topping", "heuristic:default"

prov = Counter()
rows172 = []
for r in m172["rows"]:
    sb = r["sauceBase"]
    layers = sb.get("spreadLayers") or []
    placeholder_layers = [x for x in layers if x.startswith("<")]
    ing = list(dict.fromkeys(r["ingredients"]["canonicalIngredientIds"] + [x for x in layers if not x.startswith("<")]
                              + ([sb["baseIngredientId"]] if sb.get("baseIngredientId") else [])))
    cats = {}
    for i in ing:
        c, p = cat172(i)
        if i in layers or i == sb.get("baseIngredientId"):
            c, p = "sauce", "sauceBase"
        cats[i] = c
        prov[p] += 1
    late = sorted({x for f in r.get("postBakeFinish", []) for x in f.get("ingredients", [])})
    t = sum(1 for c in cats.values() if c == "topping")
    rows172.append({
        "id": r["evidenceId"], "complete": r["ingredients"]["complete"],
        "N": len(ing) + len(placeholder_layers), "T": t,
        "unresolvedSauceLayers": len(placeholder_layers),
        "cheese": sum(1 for c in cats.values() if c == "cheese"),
        "sauce": sum(1 for c in cats.values() if c == "sauce") + len(placeholder_layers),
        "sauceStatus": r["sauceBase"]["status"],
        "spreadLayerCount": r["sauceBase"].get("spreadLayerCount"),
        "shape": r["dough"]["shape"], "form": r["dough"]["form"],
        "lateAddition": late,
        "lateToppingCount": sum(1 for x in late if cats.get(x) == "topping"),
        "capabilities": r["requiredCapabilities"],
        "categoryProvenance": sorted({cat172(i)[1] for i in ing}),
    })

def cnt(pred):
    return sum(1 for x in rows172 if pred(x))
special = {
    "rows": len(rows172),
    "ingredientListComplete": cnt(lambda x: x["complete"]),
    "rowsWithAnyHeuristicCategory": cnt(lambda x: any(p.startswith("heuristic") for p in x["categoryProvenance"])),
    "toppingTotalDistribution": dict(sorted(Counter(x["T"] for x in rows172).items())),
    "toppingTotalDistributionCompleteRowsOnly": dict(sorted(Counter(x["T"] for x in rows172 if x["complete"]).items())),
    "T0": [x["id"] for x in rows172 if x["T"] == 0],
    "cheese0": cnt(lambda x: x["cheese"] == 0),
    "sauce0": cnt(lambda x: x["sauce"] == 0),
    "sauce0Ids": [x["id"] for x in rows172 if x["sauce"] == 0],
    "rowsWithUnresolvedSauceLayer": cnt(lambda x: x["unresolvedSauceLayers"] > 0),
    "sauceStatusNoneOrUnspecified": cnt(lambda x: x["sauceStatus"] in ("none", "unspecified")),
    "sauce2plus": cnt(lambda x: x["sauce"] >= 2),
    "lateAdditionRows": cnt(lambda x: x["lateAddition"]),
    "lateAdditionRowsWhereAllToppingsAreLate": [x["id"] for x in rows172 if x["lateToppingCount"] and x["lateToppingCount"] == x["T"]],
    "lateAdditionRowsWhereToppingCountDropsTo0IfLateExcluded": cnt(lambda x: x["lateToppingCount"] and x["T"] - x["lateToppingCount"] == 0),
    "nonRoundOrEnclosedForms": dict(Counter(x["form"] for x in rows172 if x["form"] != "open-round")),
    "capabilityRows": dict(Counter(c for x in rows172 for c in x["capabilities"])),
    "categoryProvenanceOccurrences": dict(prov),
}
nt172 = Counter((x["N"], x["T"]) for x in rows172)
special["NTclasses"] = {"classes": len(nt172), "largest": max(nt172.values()), "unique": sum(1 for v in nt172.values() if v == 1)}

out = {
    "schema": "teto.discovery-hint-4.dh4-2-pre-audit.v1",
    "auditedMainSha": snap["auditedMainSha"],
    "dh41MergedAs": "5a33d855674652ab3483c3cedb8815859e88ce6e (PR #254, tree identical to its head 057e387)",
    "replicaCheck": "DH4-1 attribute answer replica == merged reserveAttributeAnswer for 24 targets x {ladderOwned, allOwned}: 48/48",
    "authorityNote": "Docs-only audit. The Owner Decisions below are Owner Authority for DH4-2; the tool's measurements are evidence, not production code.",
    "ownerDecisions": {"meta": OWNER_DECISIONS_META, "decisions": OWNER_DECISIONS},
    "playerModel": __doc__.split("Player model")[1].strip(),
    "distributions": dist,
    "combinationSummary": summary,
    "informationValue": {
        "endgame": {"avgBits_T_given_N": avg("bits_T_given_N"), "avgBits_A_given_N": avg("bits_A_given_N"), "perRecipe": info,
                    "T_given_N_and_A": endgame_T_given_NA},
        "midgame": {"avgBits_T_given_N": mavg("avgBits_T_given_N"), "avgBits_A_given_N": mavg("avgBits_A_given_N"),
                    "avgBits_T_given_NA": mavg("avgBits_T_given_NA"), "perRecipe": midgame},
        "guardAwareEndgame": guard_aware,
        "guardAwareNameEquivalent_A": sorted({x["recipeId"] + "@" + x["scenario"] for x in guard_aware if len(x["candidatesAfterLevelInversion_A"]) == 1}),
        "guardAwareNameEquivalent_A_plus_TCG": sorted({x["recipeId"] + "@" + x["scenario"] for x in guard_aware if len(x["candidatesAfterLevelInversion_A_plus_TCG_guard"]) == 1}),
        "inversionSafeProposal": {
            "rows": safe_rows,
            "levels_ladderOwned": dict(Counter(x["safeAnswer"].split(":")[0] for x in safe_rows if x["scenario"] == "ladderOwned")),
            "levels_allOwned": dict(Counter(x["safeAnswer"].split(":")[0] for x in safe_rows if x["scenario"] == "allOwned")),
            "dh41Levels_ladderOwned": dict(Counter(x["dh41Answer"].split(":")[0] for x in safe_rows if x["scenario"] == "ladderOwned")),
            "dh41Levels_allOwned": dict(Counter(x["dh41Answer"].split(":")[0] for x in safe_rows if x["scenario"] == "allOwned")),
            "TGuardPass_ladderOwned": sum(1 for x in safe_rows if x["scenario"] == "ladderOwned" and x["safeTGuardPasses"]),
            "TGuardPass_allOwned": sum(1 for x in safe_rows if x["scenario"] == "allOwned" and x["safeTGuardPasses"]),
            "mergedTaxonomyVariants": {
                "fruit+spice+other->other": safe_attribute_answer_variant({"pineapple": "other", "capers": "other"}),
            },
            "nameEquivalentAfterInversion": sorted({x["recipeId"] + "@" + x["scenario"] for x in safe_rows
                                                    if len(x["inversionCandidates_safeA"]) < 2 or len(x["inversionCandidates_safeA_plus_TCG"]) < 2}),
        },
        "guardTC_G": {"failLadderOwned": [x["recipeId"] for x in midgame if not x["guardTC_G_ladderOwned"]],
                      "failAllOwned": [x["recipeId"] for x in midgame if not x["guardTC_G_allOwned"]]},
    },
    "finalGate": {"attributeGuardOptions": attribute_options, "inventorySweep": inventory_sweep, "attributeAnswersPerRecipe": attribute_answers_per_recipe,
                  "runtimeMergeForOptionD": RUNTIME_MERGE, "toppingCountOptions": topping_count_options},
    "recipes": rows,
    "scalability172": {"summary": special, "rows": rows172},
}
TEXT = json.dumps(out, ensure_ascii=False, indent=1) + "\n"


def invariant_failures():
    """Owner-decided invariants (OD-DH4-2-1 / 2 / 4): any failure makes --check exit 1."""
    fails = []
    adopted = out["finalGate"]["attributeGuardOptions"]["c_partition_checked"]
    for sc, v in adopted.items():
        if v["namedAfterLevelInversion"] or v["namedAfterLevelInversion_withTCG"]:
            fails.append("OD-DH4-2-2: inversion name leak under the adopted guard (%s)" % sc)
    sweep = out["finalGate"]["inventorySweep"]
    if sweep["tcg_reserveForced"]:
        fails.append("OD-DH4-2-1: N + TC-G clause (+ guarded attribute) forces the reserve in the inventory sweep")
    if sweep["c_partition_checked"] or sweep["c_partition_checked_withTCG"]:
        fails.append("OD-DH4-2-2: inversion name leak under the adopted guard in the inventory sweep")
    tcg = out["finalGate"]["toppingCountOptions"]["D_prime_total_plus_topping_TCG"]
    for sc, v in tcg.items() if isinstance(tcg, dict) else []:
        if isinstance(v, dict) and (v.get("reserveNamed") or v.get("zeroCountStated")):
            fails.append("OD-DH4-2-1: TC-G names the reserve or states 0 (%s)" % sc)
    for index, rid in enumerate(ORDER):
        if index and t_total(RECIPES[rid]) == 0 and (safe_T_guard(RECIPES[rid], ALL_IDS) or safe_T_guard(RECIPES[rid], owned_at(index))):
            fails.append("OD-DH4-2-1: TC-G passes for a zero-topping recipe (%s)" % rid)
    return fails


if "--check" in sys.argv[1:]:
    problems = invariant_failures()
    current = OUT.read_text() if OUT.exists() else ""
    if current != TEXT:
        problems.append("drift: %s differs from a fresh regeneration" % OUT.relative_to(ROOT))
    if problems:
        print("CHECK FAILED\n- " + "\n- ".join(problems))
        sys.exit(1)
    print("CHECK OK: %s is up to date; Owner-decided invariants hold (adopted guard: 0 inversion names; TC-G: 0 named, never 0)" % OUT.relative_to(ROOT))
    sys.exit(0)

problems = invariant_failures()
if problems:
    print("REFUSING TO WRITE: Owner-decided invariant broken\n- " + "\n- ".join(problems))
    sys.exit(1)
OUT.write_text(TEXT)
print("wrote %s" % OUT.relative_to(ROOT))
