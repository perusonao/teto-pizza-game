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
"""
from __future__ import annotations

import itertools
import json
import math
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
    "authorityNote": "Docs-only audit. Not authority. Proposed rules (strict guard, TC-G) are measurement only until the Owner decides.",
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
    "recipes": rows,
    "scalability172": {"summary": special, "rows": rows172},
}
OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n")
print(json.dumps(out["informationValue"]["guardTC_G"]), mavg("avgBits_T_given_N"), mavg("avgBits_A_given_N"), mavg("avgBits_T_given_NA"), [x for x in endgame_T_given_NA if x["bits"]])
print(out["informationValue"]["guardAwareNameEquivalent_A"], out["informationValue"]["guardAwareNameEquivalent_A_plus_TCG"])
print(json.dumps({k: v for k, v in out["informationValue"]["inversionSafeProposal"].items() if k != "rows"}))
print(json.dumps({"T0": special["T0"], "allLate": special["lateAdditionRowsWhereAllToppingsAreLate"], "sauce0": special["sauce0"]}, ensure_ascii=False))
print(json.dumps({"summary": summary, "dist": dist, "info": {"T|N": avg("bits_T_given_N"), "A|N": avg("bits_A_given_N")}, "172": {k: v for k, v in special.items() if k not in ("T0", "lateAdditionRowsWhereAllToppingsAreLate")}}, ensure_ascii=False, indent=1))
