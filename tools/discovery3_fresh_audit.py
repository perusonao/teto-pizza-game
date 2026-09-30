#!/usr/bin/env python3
"""Recipe Discovery 3.0 Fresh Audit -- read-only analysis (docs/tools only, no src/** change).

Reads the PRODUCTION data files as text (src/data/recipes.ts, ingredients.ts, discoveryLadder.ts,
ingredientTaxonomy.ts, recipeHintRoles.ts) so the numbers can never drift from the shipped data,
plus the 172-row candidate matrix. Emits docs/reports/data/TETO_DISCOVERY-3_FRESH-AUDIT_DATA.json.
Deterministic (fixed seeds). Usage:  python3 tools/discovery3_fresh_audit.py [--out PATH]
"""
import json, re, sys, random, itertools, collections, statistics, os
from math import comb

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def rd(p): return open(os.path.join(ROOT, p), encoding="utf-8").read()

# ---------------------------------------------------------------- production data
rec_src = rd("src/data/recipes.ts")
body = rec_src[rec_src.index("export const RECIPES = ["):rec_src.index("] as const;")]
RECIPES = []
for m in re.finditer(r'\{\s*id: "([a-z-]+)",\s*nameJa: "([^"]+)",(.*?)\n  \},', body, re.S):
    req = re.findall(r'ingredientId: "([a-z-]+)", minCount: (\d+)', m.group(3))
    RECIPES.append({"id": m.group(1), "nameJa": m.group(2), "req": [(a, int(b)) for a, b in req]})
assert len(RECIPES) == 25, len(RECIPES)
RID = [r["id"] for r in RECIPES]
ING = {}
isrc = rd("src/data/ingredients.ts")
for m in re.finditer(r'\{\s*id: "([a-z-]+)",[^{}]*?category: "(\w+)"(.*?)\n  \},', isrc, re.S):
    ING[m.group(1)] = {"cat": m.group(2), "starter": "unlockCondition" not in m.group(3)}
STARTERS = sorted(i for i, v in ING.items() if v["starter"])
assert STARTERS == ["basil", "mozzarella", "tomato-sauce"], STARTERS
tax = rd("src/data/ingredientTaxonomy.ts")
FAM = dict(re.findall(r'\["([a-z-]+)", "(\w+)"\],', tax))
roles_src = rd("src/data/recipeHintRoles.ts")
ROLES = {}
for m in re.finditer(r'"?([a-z-]+)"?: \{ hintKeyToppingId: (null|"[a-z-]+"), hintSubToppingOrder: \[([^\]]*)\] \}', roles_src):
    ROLES[m.group(1)] = (None if m.group(2) == "null" else m.group(2).strip('"'), re.findall(r'"([a-z-]+)"', m.group(3)))
assert set(ROLES) == set(RID)
lad_src = rd("src/data/discoveryLadder.ts")
w1 = lad_src[lad_src.index("export const W1_25_DISCOVERY_LADDER"):lad_src.index("LAD-1 (Issue #261")]
LADDER = [(int(s), re.findall(r'"([a-z-]+)"', ids), key) for s, ids, key in
          re.findall(r'step: (\d+), kind: "MATERIAL", ingredientIds: \[([^\]]*)\], keyRecipeId: "([a-z-]+)"', w1)]
assert len(LADDER) == 24

for r in RECIPES:
    r["set"] = frozenset(i for i, _ in r["req"])
    r["sauce"] = sorted(i for i in r["set"] if ING[i]["cat"] == "sauce")
    r["cheese"] = sorted(i for i in r["set"] if ING[i]["cat"] == "cheese")
    r["top"] = sorted(i for i in r["set"] if ING[i]["cat"] == "topping")
    r["fam"] = collections.Counter(FAM[i] for i in r["top"])
    r["total"] = len(r["set"])
R = {r["id"]: r for r in RECIPES}
FAM_ORDER = ["meat", "seafood", "vegetable", "fruit", "herb", "spice", "other"]
def makeable(owned): return {r["id"] for r in RECIPES if r["set"] <= owned}

out = {}
# ---------------------------------------------------------------- 1. ladder recompute
owned = set(STARTERS); disc = ["margherita"]  # Dex-0 onboarding recipe = discovery #1
M_prev = makeable(owned)
rows = []
row0 = {"step": 0, "unlock": sorted(STARTERS), "available_before": [], "newly_makeable": sorted(M_prev),
        "new_count": len(M_prev), "carried_undiscovered": 0, "pool_after_unlock": len(M_prev) - 1, "discovered_at_unlock": 0}
rows.append(row0)
for s, ids, key in LADDER:
    before = set(owned)
    owned |= set(ids)
    M = makeable(owned)
    new = sorted(M - M_prev)
    discovered_now = disc[:]  # s recipes discovered when step s is reached (margherita + keys of steps < s)
    assert len(discovered_now) == s, (s, len(discovered_now))
    carried = sorted(M_prev - set(discovered_now))
    rows.append({"step": s, "unlock": ids, "available_before": sorted(before), "key": key,
                 "newly_makeable": new, "new_count": len(new), "carried_undiscovered": len(carried),
                 "carried": carried, "pool_after_unlock": len(M) - len(discovered_now),
                 "pool_ids": sorted(M - set(discovered_now)), "discovered_at_unlock": s})
    disc.append(key)   # canonical path: the player discovers the step's key recipe next
    M_prev = M
out["ladder"] = rows
out["ladder_summary"] = {
    "steps_with_new_count": dict(collections.Counter(r["new_count"] for r in rows[1:])),
    "steps_with_ge2_new": [r["step"] for r in rows[1:] if r["new_count"] >= 2],
    "max_pool_after_unlock": max(r["pool_after_unlock"] for r in rows[1:]),
    "pool_histogram": dict(collections.Counter(r["pool_after_unlock"] for r in rows[1:])),
    "all_25_makeable_after_step": next(r["step"] for r in rows if len(makeable(set(STARTERS).union(*[set(x[1]) for x in LADDER if x[0] <= r["step"]]))) == 25),
}

# ---------------------------------------------------------------- 2. branching / hubs
nonstart = sorted(i for i in ING if not ING[i]["starter"])
uses = {i: sorted(r["id"] for r in RECIPES if i in r["set"]) for i in ING}
out["ingredient_use"] = {i: uses[i] for i in sorted(ING, key=lambda x: -len(uses[x]))}
# single-ingredient reach from the starters only
single = collections.defaultdict(list)
for r in RECIPES:
    miss = r["set"] - set(STARTERS)
    if len(miss) == 1: single[next(iter(miss))].append(r["id"])
out["starter_plus_one"] = dict(single)
out["starter_only_makeable"] = sorted(makeable(set(STARTERS)))
out["missing_count_from_starters"] = dict(collections.Counter(len(r["set"] - set(STARTERS)) for r in RECIPES))
# best single-ingredient branch at each ladder state
best_single = []
owned = set(STARTERS)
for s, ids, key in [(0, [], None)] + LADDER:
    owned |= set(ids)
    cur = makeable(owned)
    opts = []
    for x in nonstart:
        if x in owned: continue
        n = len(makeable(owned | {x}) - cur)
        opts.append((n, x))
    opts.sort(key=lambda t: (-t[0], t[1]))
    best_single.append({"after_step": s, "best_single_unlock": opts[:3], "max_new": opts[0][0] if opts else 0})
out["best_single_branch_by_state"] = best_single

def groups_ladder(order):
    """order = list of unlock groups (tuples). Returns (ok, stats) under the discovered>=step rule."""
    owned = set(STARTERS); M_prev = makeable(owned); newc = []; pools = []
    for k, g in enumerate(order, start=1):
        if len(M_prev) < k: return False, None   # softlock: need k discoveries, fewer makeable
        owned |= set(g); M = makeable(owned)
        newc.append(len(M) - len(M_prev)); pools.append(len(M) - k)  # discovered == k at this point
        M_prev = M
    return True, {"new": newc, "pool": pools}
cur_groups = [tuple(x[1]) for x in LADDER]
ok, st = groups_ladder(cur_groups); assert ok
def score(st):  # prefer steps that open >=2 recipes; then breadth of pool
    return (sum(1 for n in st["new"] if n >= 2), sum(max(0, n - 1) for n in st["new"]), sum(st["pool"]))
rng = random.Random(20260930)
best = (score(st), cur_groups, st)
for restart in range(40):
    order = cur_groups[:] if restart == 0 else rng.sample(cur_groups, len(cur_groups))
    okk, stt = groups_ladder(order)
    if not okk: continue
    sc = score(stt)
    improved = True
    while improved:
        improved = False
        for i in range(len(order)):
            for j in range(i + 1, len(order)):
                o2 = order[:]; o2[i], o2[j] = o2[j], o2[i]
                ok2, s2 = groups_ladder(o2)
                if ok2 and score(s2) > sc: order, sc, stt, improved = o2, score(s2), s2, True
    if sc > best[0]: best = (sc, order, stt)
out["reorder_search"] = {
    "note": "permutations of the 24 existing unlock groups, hill-climb x40 restarts, softlock-free under 'step s needs s discoveries'",
    "current_score_ge2_steps_excess_poolsum": score(st),
    "best_score": best[0], "best_order": [list(g) for g in best[1]], "best_new_per_step": best[2]["new"],
    "best_pool_per_step": best[2]["pool"], "current_new_per_step": st["new"], "current_pool_per_step": st["pool"]}
# what stays exclusive: recipes that become makeable ONLY when a specific ingredient arrives
out["hub_ranking"] = sorted(
    [{"ingredient": i, "cat": ING[i]["cat"], "recipes": len(uses[i]), "ids": uses[i]} for i in ING if len(uses[i]) >= 3],
    key=lambda d: (-d["recipes"], d["ingredient"]))
# recipe pairs/groups that share all-but-one ingredient (natural sibling branches)
sib = []
for a, b in itertools.combinations(RECIPES, 2):
    d = a["set"] ^ b["set"]
    if len(d) <= 2: sib.append({"a": a["id"], "b": b["id"], "symdiff": sorted(d)})
out["sibling_pairs_symdiff_le2"] = sib

# -- 2b. exhaustive single-ingredient-step feasibility (the softlock rule: step k needs >= k makeable recipes before it)
_idx = {x: i for i, x in enumerate(nonstart)}
_need = [sum(1 << _idx[i] for i in (r["set"] - set(STARTERS))) for r in RECIPES]
def _mk(S): return sum(1 for n in _need if n & ~S == 0)
_layers = [{0}]; _newhist = collections.Counter()
for _k in range(1, len(nonstart) + 1):
    _nxt = set()
    for _S in _layers[-1]:
        for _b in range(len(nonstart)):
            if _S >> _b & 1: continue
            _T = _S | (1 << _b)
            if _k < len(nonstart) and _mk(_T) < _k + 1: continue
            _nxt.add(_T); _newhist[_mk(_T) - _mk(_S)] += 1
    _layers.append(_nxt)
    if not _nxt: break
out["single_step_feasibility"] = {
    "rule": "after k single-ingredient unlocks at least k+1 recipes must be makeable (k discoveries + 1 to find), else SOFTLOCK (validateLadderProgression)",
    "feasible_states_per_layer": [len(l) for l in _layers],
    "deepest_feasible_layer": max(i for i, l in enumerate(_layers) if l),
    "newly_makeable_histogram_over_all_feasible_transitions": dict(_newhist),
    "reading": "with single-ingredient steps every feasible transition opens exactly 1 recipe, and no feasible chain covers all 26 ingredients (the real ladder needs two 2-ingredient steps)"}
# -- 2c. packages that open >=2 recipes at once from the starter-only state (minimal packages, size <= 3)
_pk = []
for _k in (1, 2, 3):
    for _sub in itertools.combinations(nonstart, _k):
        _n = len(makeable(set(STARTERS) | set(_sub)) - {"margherita"})
        if _n >= 2: _pk.append((_n, _sub))
_pk.sort(key=lambda t: (-t[0], len(t[1]), t[1]))
_min = [p for p in _pk if not any(set(q[1]) < set(p[1]) and q[0] >= p[0] for q in _pk)]
out["packages_open_ge2_from_starters"] = {"count_all_size_le3": len(_pk), "minimal_examples": [{"unlock": list(s), "opens": sorted(makeable(set(STARTERS) | set(s)) - {"margherita"})} for n, s in _min[:10]],
                                           "note": "every package is a BUNDLE of independent one-ingredient recipes (egg+mushroom opens bismarck and funghi), not a hub: no single ingredient opens two recipes on the 25-recipe data"}
# natural hub events: the recipe pairs whose identity differs by exactly one ingredient (x opens both when their other needs are already owned)
_hub = []
for _a, _b in itertools.combinations(RECIPES, 2):
    _d = (_a["set"] ^ _b["set"]) - set(STARTERS)
    if _a["set"] < _b["set"] or _b["set"] < _a["set"]:
        _hub.append({"small": (_a if _a["set"] < _b["set"] else _b)["id"], "large": (_b if _a["set"] < _b["set"] else _a)["id"], "extra": sorted(_a["set"] ^ _b["set"])})
out["subset_recipe_pairs"] = _hub
# -- 2d. constrained hill-climb with 2-ingredient packages allowed: maximise steps opening 2..4 recipes, pool <= 6
def _evalseq(order, cuts):
    owned = set(STARTERS); Mp = makeable(owned); new = []; pool = []; i = 0
    for k, sz in enumerate(cuts, start=1):
        if len(Mp) < k: return None
        g = order[i:i + sz]; i += sz
        owned |= set(g); M = makeable(owned); new.append(len(M) - len(Mp)); pool.append(len(M) - k); Mp = M
    return new, pool
def _sc(st):
    new, pool = st
    return (-(sum(1 for n in new if n > 4) + sum(1 for p in pool if p > 6)), sum(1 for n in new if 2 <= n <= 4), -sum(1 for n in new if n == 0), len(new))
_rng = random.Random(5)
def _rc(n):
    c = []
    while sum(c) < n: c.append(min(_rng.randint(1, 2), n - sum(c)))
    return c
_best = None
for _ in range(150):
    _o = nonstart[:]; _rng.shuffle(_o); _c = _rc(len(_o)); _st = _evalseq(_o, _c); _t = 0
    while _st is None and _t < 500: _rng.shuffle(_o); _c = _rc(len(_o)); _st = _evalseq(_o, _c); _t += 1
    if _st is None: continue
    _cur = _sc(_st)
    for _i in range(1500):
        _o2 = _o[:]; _c2 = _c[:]
        if _rng.random() < 0.7:
            _x, _y = _rng.sample(range(len(_o2)), 2); _o2[_x], _o2[_y] = _o2[_y], _o2[_x]
        else: _c2 = _rc(len(_o2))
        _s2 = _evalseq(_o2, _c2)
        if _s2 and _sc(_s2) >= _cur: _o, _c, _st, _cur = _o2, _c2, _s2, _sc(_s2)
    if _best is None or _cur > _best[0]: _best = (_cur, _o[:], _c[:], _st)
_groups = []; _i = 0
for _sz in _best[2]: _groups.append(_best[1][_i:_i + _sz]); _i += _sz
out["branching_ladder_example_25_recipes"] = {
    "constraints": "groups of 1-2 ingredients, softlock-free, pool <= 6, objective = most steps opening 2..4 recipes (seeded hill-climb, illustrative not optimal)",
    "steps": len(_groups), "groups": _groups, "new_per_step": _best[3][0], "pool_per_step": _best[3][1],
    "steps_opening_2_to_4": sum(1 for n in _best[3][0] if 2 <= n <= 4), "dry_steps_opening_0": sum(1 for n in _best[3][0] if n == 0),
    "reading": "the existing 25 CAN branch, but only through 2-ingredient packages plus dry prerequisite steps, and only by replacing the frozen W1 ladder (LAD-1)"}

# ---------------------------------------------------------------- 3. hint candidate reduction
def cons_ladder5(t, k):
    """Current Hint 5.0 ladder after rung k (0..): recipes consistent with everything revealed."""
    def ok(c):
        if k >= 1 and c["sauce"] != t["sauce"]: return False
        if k >= 2 and c["cheese"] != t["cheese"]: return False
        if k >= 3 and ROLES[c["id"]][0] != ROLES[t["id"]][0]: return False
        if k >= 4 and c["total"] != t["total"]: return False
        if k >= 5:
            sub_t = [FAM[i] for i in ROLES[t["id"]][1]]
            sub_c = [FAM[i] for i in ROLES[c["id"]][1]]
            n = min(k - 4, len(sub_t))
            if len(sub_c) < n or sub_c[:n] != sub_t[:n]: return False
        return True
    return [c["id"] for c in RECIPES if ok(c)]
def nsub(t): return len(ROLES[t["id"]][1])
h5 = {}
for t in RECIPES:
    tk = 4 + nsub(t)
    h5[t["id"]] = [len(cons_ladder5(t, k)) for k in range(0, tk + 1)]
out["hint5_current_reduction"] = {"stages": ["0 none", "1 SAUCE", "2 CHEESE", "3 KEY_TOPPING", "4 STRUCTURE", "5.. SUB_CLASS 1..n"],
                                  "per_recipe_remaining_of_25": h5,
                                  "final_remaining_histogram": dict(collections.Counter(v[-1] for v in h5.values())),
                                  "unique_after_full_ladder": sum(1 for v in h5.values() if v[-1] == 1)}
# proposed stage ladders (no key topping).  Candidate set = closed world of the 25.
def fam_pairs(t):
    return [(f, t["fam"][f]) for f in FAM_ORDER if t["fam"][f] > 0]
def cons_new(t, k, cat_mode="family"):
    """stages: 0 none, 1 sauce, 2 cheese, 3 topping count, 4.. category clue 1..m (fixed family order)."""
    def ok(c):
        if k >= 1 and c["sauce"] != t["sauce"]: return False
        if k >= 2 and c["cheese"] != t["cheese"]: return False
        if k >= 3 and len(c["top"]) != len(t["top"]): return False
        if k >= 4:
            tp = fam_pairs(t)[:k - 3]
            for f, n in tp:
                if c["fam"][f] != n: return False
        return True
    return [c["id"] for c in RECIPES if ok(c)]
newm = {}
for t in RECIPES:
    m = len(fam_pairs(t))
    newm[t["id"]] = [len(cons_new(t, k)) for k in range(0, 3 + m + 1)]
out["new_ladder_reduction"] = {"per_recipe_remaining_of_25": newm,
                               "final_remaining_histogram": dict(collections.Counter(v[-1] for v in newm.values())),
                               "unique_after_full": sum(1 for v in newm.values() if v[-1] == 1)}
# mean remaining per stage index for both, padded with the last value
def mean_by_stage(d, upto):
    res = []
    for k in range(upto + 1):
        res.append(round(statistics.mean(v[min(k, len(v) - 1)] for v in d.values()), 2))
    return res
out["stage_means"] = {"hint5_current": mean_by_stage(h5, 8), "new_no_key": mean_by_stage(newm, 8)}
# deduction room in the OPEN world (what the player actually faces): ingredient-level combos given OWNED set
def room(t, owned, facts):
    """# of distinct ingredient sets (sauce, cheese set, topping set) over OWNED that satisfy the facts."""
    saucs = [i for i in owned if ING[i]["cat"] == "sauce"]; ch = [i for i in owned if ING[i]["cat"] == "cheese"]
    tp = [i for i in owned if ING[i]["cat"] == "topping"]
    # sauce
    n_sauce = 1 if "sauce" in facts else len(saucs)
    n_ch = 1 if "cheese" in facts else 2 ** len(ch)
    if "count" in facts:
        k = len(t["top"])
        if "fam" in facts:  # per-family exact counts (all revealed)
            n_top = 1
            for f in FAM_ORDER:
                own_f = sum(1 for i in tp if FAM[i] == f)
                n_top *= comb(own_f, t["fam"][f])
        else:
            n_top = comb(len(tp), k)
    else:
        n_top = 2 ** len(tp)
    return n_sauce * n_ch * n_top
owned_full = set(ING)
def owned_at(step): return set(STARTERS).union(*[set(x[1]) for x in LADDER if x[0] <= step])
room_rows = {}
key_step = {x[2]: x[0] for x in LADDER}
for t in RECIPES:
    s = key_step.get(t["id"], 0); O = owned_at(s)
    stages = {"none": room(t, O, set()), "sauce": room(t, O, {"sauce"}), "sauce+cheese": room(t, O, {"sauce", "cheese"}),
              "sauce+cheese+count": room(t, O, {"sauce", "cheese", "count"}),
              "sauce+cheese+count+families": room(t, O, {"sauce", "cheese", "count", "fam"})}
    room_rows[t["id"]] = {"key_step": s, "owned": len(O), **stages}
out["open_world_room_at_key_step"] = room_rows
def q(vals): 
    v = sorted(vals); return {"min": v[0], "median": statistics.median(v), "max": v[-1], "eq1": sum(1 for x in v if x == 1)}
out["open_world_room_summary"] = {k: q([r[k] for r in room_rows.values()]) for k in ["none", "sauce", "sauce+cheese", "sauce+cheese+count", "sauce+cheese+count+families"]}


# ---------------------------------------------------------------- 3b. open-world deduction room per hint PROFILE (what the player actually faces)
def room2(t, O, facts, key=None):
    """# of ingredient sets over OWNED consistent with `facts`; key = named key topping (ingredient id) or None."""
    saucs = [i for i in O if ING[i]["cat"] == "sauce"]; ch = [i for i in O if ING[i]["cat"] == "cheese"]
    tp = [i for i in O if ING[i]["cat"] == "topping"]
    n_sauce = 1 if "sauce" in facts else len(saucs) + 1           # +1: "no sauce" is also a pizza
    n_ch = 1 if "cheese" in facts else 2 ** len(ch)
    k = len(t["top"])
    kf = FAM[key] if key else None
    if "fam" in facts:
        n_top = 1
        for f in FAM_ORDER:
            own_f = sum(1 for i in tp if FAM[i] == f); c = t["fam"][f]
            if key and f == kf: n_top *= comb(own_f - 1, c - 1)
            else: n_top *= comb(own_f, c)
    elif "count" in facts:
        n_top = comb(len(tp) - 1, k - 1) if key else comb(len(tp), k)
    else:
        n_top = 2 ** (len(tp) - 1) if key else 2 ** len(tp)
    return n_sauce * n_ch * n_top
PROFILES = {
    "H0 nothing": (set(), False),
    "P-B core: sauce + cheese + topping count + family composition": ({"sauce", "cheese", "count", "fam"}, False),
    "P-C: sauce + cheese + topping count": ({"sauce", "cheese", "count"}, False),
    "P-D structure-only: topping count + family composition (no sauce / cheese names)": ({"count", "fam"}, False),
    "P-E: P-B + named key topping": ({"sauce", "cheese", "count", "fam"}, True),
    "H5 current full ladder (sauce, cheese, KEY named, structure, all sub classes)": ({"sauce", "cheese", "count", "fam"}, True),
}
prof = {}
for name, (facts, usekey) in PROFILES.items():
    vals = []; 
    for t in RECIPES:
        if usekey and ROLES[t["id"]][0] is None: key = None
        else: key = ROLES[t["id"]][0] if usekey else None
        s = key_step.get(t["id"], 0); O = owned_at(s)
        vals.append((t["id"], room2(t, O, facts, key)))
    v = sorted(x[1] for x in vals)
    prof[name] = {"min": v[0], "median": statistics.median(v), "p90": v[int(0.9 * (len(v) - 1))], "max": v[-1], "giveaways_eq1": sum(1 for x in v if x == 1),
                  "giveaway_ids": sorted(i for i, x in vals if x == 1), "room_le_4": sum(1 for x in v if x <= 4)}
out["open_world_profile_room_at_key_step"] = prof
# bits revealed by an "empty element" answer, over the 25 production recipes
def bits(p): return round(-__import__("math").log2(p), 2)
out["empty_element_information"] = {
    "cheese_none": {"share": "5/25", "bits_if_none": bits(5 / 25), "bits_if_present": bits(20 / 25)},
    "cheese_named_mozzarella": {"share": "19/25", "bits": bits(19 / 25)},
    "topping_none": {"share": "1/25", "bits_if_none": bits(1 / 25), "bits_if_present": bits(24 / 25)},
    "sauce_none_production": {"share": "0/25", "note": "no production recipe has no sauce; 'no sauce' is the reserved Technique no-sauce (TQ-1D)"},
    "sauce_none_172_spread0": {"share": "30/172", "bits_if_none": bits(30 / 172)},
    "sauce_none_172_status_none": {"share": "44/172", "bits_if_none": bits(44 / 172)}}
# ---------------------------------------------------------------- 4. census of the 25 production recipes
out["production_census"] = {
    "n": 25,
    "sauce": dict(collections.Counter(r["sauce"][0] if r["sauce"] else "NONE" for r in RECIPES)),
    "no_sauce": sum(1 for r in RECIPES if not r["sauce"]),
    "no_cheese": sorted(r["id"] for r in RECIPES if not r["cheese"]),
    "no_topping": sorted(r["id"] for r in RECIPES if not r["top"]),
    "multi_cheese": sorted(r["id"] for r in RECIPES if len(r["cheese"]) > 1),
    "multi_sauce": sorted(r["id"] for r in RECIPES if len(r["sauce"]) > 1),
    "topping_count": dict(sorted(collections.Counter(len(r["top"]) for r in RECIPES).items())),
    "total_count": dict(sorted(collections.Counter(r["total"] for r in RECIPES).items())),
    "hint_key_null": sorted(i for i, v in ROLES.items() if v[0] is None),
}
# family-composition equivalence classes (sauce, cheese, topping count, family multiset)
def sig(r, parts):
    d = {}
    if "sauce" in parts: d["s"] = tuple(r["sauce"])
    if "cheese" in parts: d["c"] = tuple(r["cheese"])
    if "count" in parts: d["n"] = len(r["top"])
    if "fam" in parts: d["f"] = tuple(fam_pairs(r))
    if "cat" in parts: d["cat"] = (len(r["sauce"]), len(r["cheese"]), len(r["top"]))
    return json.dumps(d, sort_keys=True)
classes = {}
for name, parts in {"sauce+cheese+count": ["sauce", "cheese", "count"], "sauce+cheese+count+families": ["sauce", "cheese", "count", "fam"],
                    "families only": ["fam"], "counts only (cat sizes)": ["cat"]}.items():
    g = collections.defaultdict(list)
    for r in RECIPES: g[sig(r, parts)].append(r["id"])
    classes[name] = {"n_classes": len(g), "singleton_recipes": sum(1 for v in g.values() if len(v) == 1),
                     "shared": sorted([v for v in g.values() if len(v) > 1])}
out["closed_world_equivalence_classes"] = classes

if __name__ == "__main__":
    pass

# ---------------------------------------------------------------- 4b. 172-row census (candidate matrix, read-only)
mat = json.load(open(os.path.join(ROOT, "docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json"), encoding="utf-8"))
master = json.load(open(os.path.join(ROOT, "data/recipes/ingredient_master_catalog.json"), encoding="utf-8"))["ingredients"]
MCAT = {i["id"]: i["category"] for i in master}
CHEESE_EXTRA = {"burrata", "brick-cheese", "cashew-cheese", "cheddar", "cheese-curd", "cotija", "cream-cheese", "feta", "goat-cheese",
                "grana-padano", "halloumi", "paneer", "pecorino", "swiss-cheese", "catupiry"}
SPREAD = set(mat["spreadLayerIngredientIds"])
def kind172(i):
    if i in SPREAD or MCAT.get(i) == "sauce": return "sauce"
    if MCAT.get(i) == "cheese" or i in CHEESE_EXTRA: return "cheese"
    return "topping"
rows172 = mat["rows"]
def census(rs):
    c = collections.Counter(); tcount = collections.Counter(); cheesecount = collections.Counter(); spread = collections.Counter()
    for r in rs:
        ids = r["ingredients"]["canonicalIngredientIds"]
        ks = collections.Counter(kind172(i) for i in ids)
        sb = r["sauceBase"]
        c["rows"] += 1
        c["sauce_status_" + sb["status"]] += 1
        if sb["status"] == "none": c["no_sauce(status none)"] += 1
        if sb["spreadLayerCount"] >= 2: c["multi_spread(>=2 layers)"] += 1
        if sb["spreadLayerCount"] == 0: c["no_spread_layer(spreadLayerCount==0)"] += 1
        if sb["status"] == "none" and sb["spreadLayerCount"] >= 1: c["sauce_status_none_but_oil_or_spread_layer"] += 1
        if ks["cheese"] == 0: c["no_cheese(listed ingredients)"] += 1
        if ks["cheese"] >= 2: c["multi_cheese(>=2)"] += 1
        if ks["topping"] == 0: c["no_topping"] += 1
        if "LATE_ADDITION" in r["requiredCapabilities"] + r["candidateCapabilities"]: c["late_addition(req|cand)"] += 1
        if "LATE_ADDITION" in r["requiredCapabilities"]: c["late_addition(required)"] += 1
        if r["postBakeFinish"]: c["post_bake_finish"] += 1
        if r["prep"]: c["prep_step"] += 1
        if r["requiredCapabilities"]: c["needs_any_capability"] += 1
        if sb["status"] == "none" and ks["cheese"] == 0: c["no_sauce_AND_no_cheese"] += 1
        tcount[ks["topping"]] += 1
        cheesecount[ks["cheese"]] += 1
        spread[sb["spreadLayerCount"]] += 1
        c["sauce_family_" + str(sb.get("sauceFamily"))] += 1
    return {"counts": dict(sorted(c.items())), "topping_count_hist": dict(sorted(tcount.items())),
            "cheese_count_hist": dict(sorted(cheesecount.items())), "spread_layer_hist": dict(sorted(spread.items()))}
complete = [r for r in rows172 if r["ingredients"]["complete"]]
ready = [r for r in rows172 if r["productDecisionStatus"] in ("READY", "READY_WITH_REVIEW")]
out["census_172"] = {"all_172": census(rows172), "ingredient_complete_120": census(complete), "decision_ready_86": census(ready),
                     "note": "cheese/sauce kinds for ids outside the 62-ingredient master catalog are classified by name (CHEESE_EXTRA) and by the matrix spreadLayerIngredientIds; topping = the rest. sauce 'none' = matrix sauceBase.status."}
# technique: NO_SAUCE-class rows among 'none' (aussie is the TQ-1D production recipe)
out["census_172"]["no_sauce_rows_sample"] = sorted(r["evidenceId"] for r in rows172 if r["sauceBase"]["status"] == "none")[:12]
out["census_172"]["capability_required_hist"] = dict(collections.Counter(c for r in rows172 for c in r["requiredCapabilities"]))

# ---------------------------------------------------------------- 6. attempt-feedback solver simulation (brute-force resistance)
import numpy as np
ALL_ING = sorted(ING)
BIT = {i: 1 << k for k, i in enumerate(ALL_ING)}
def mask(ids):
    m = 0
    for i in ids: m |= BIT[i]
    return m
_PC16 = np.array([bin(i).count("1") for i in range(1 << 16)], dtype=np.int32)
def popcount(a):
    a = np.asarray(a).astype(np.uint64)
    return _PC16[(a & np.uint64(0xFFFF)).astype(np.int64)] + _PC16[((a >> np.uint64(16)) & np.uint64(0xFFFF)).astype(np.int64)]
SM = mask([i for i in ALL_ING if ING[i]["cat"] == "sauce"]); CM = mask([i for i in ALL_ING if ING[i]["cat"] == "cheese"]); TMk = mask([i for i in ALL_ING if ING[i]["cat"] == "topping"])
FAMM = {f: mask([i for i in ALL_ING if FAM.get(i) == f]) for f in FAM_ORDER}
class Space:
    """Every pizza identity over the OWNED set: (no sauce | one sauce) x (any subset of cheeses) x (<=4 toppings)."""
    def __init__(self, O, max_top=4):
        saucs = [i for i in sorted(O) if ING[i]["cat"] == "sauce"]; chs = [i for i in sorted(O) if ING[i]["cat"] == "cheese"]
        tps = [i for i in sorted(O) if ING[i]["cat"] == "topping"]
        S = np.array([0] + [BIT[i] for i in saucs], dtype=np.uint64)
        C = np.array([sum(BIT[c] for c in sub) for k in range(len(chs) + 1) for sub in itertools.combinations(chs, k)], dtype=np.uint64)
        T = np.array([sum(BIT[t] for t in sub) for k in range(max_top + 1) for sub in itertools.combinations(tps, k)], dtype=np.uint64)
        self.m = (S[:, None, None] | C[None, :, None] | T[None, None, :]).reshape(-1)
        self.attr = self.attrs(self.m)
    @staticmethod
    def attrs(m):
        a = {"S": m & np.uint64(SM), "C": m & np.uint64(CM), "T": m & np.uint64(TMk)}
        a["nS"] = popcount(a["S"]); a["nC"] = popcount(a["C"]); a["nT"] = popcount(a["T"])
        code = np.zeros(m.shape, dtype=np.int64)
        for k, f in enumerate(FAM_ORDER): code += popcount(m & np.uint64(FAMM[f])).astype(np.int64) * (5 ** k)
        a["fam"] = code
        return a
def g_attrs(g):
    return {k: v[0] for k, v in Space.attrs(np.array([g], dtype=np.uint64)).items()}
def hint_keep(sp, tgt_attr, hint):
    keep = np.ones(sp.m.shape, dtype=bool)
    if not hint: return keep
    if "sauce" in hint: keep &= sp.attr["S"] == tgt_attr["S"]
    if "cheese" in hint: keep &= sp.attr["C"] == tgt_attr["C"]
    if "count" in hint: keep &= sp.attr["nT"] == tgt_attr["nT"]
    if "fam" in hint: keep &= sp.attr["fam"] == tgt_attr["fam"]
    return keep
def feedback(kind, sp, idx, g, ga):
    """feedback code of guess g against each hypothetical target idx (array of indices into sp)."""
    at = {k: v[idx] for k, v in sp.attr.items()}; t = sp.m[idx]
    if kind == "E": return (t == np.uint64(g)).astype(np.int64)
    inter = popcount(t & np.uint64(g)); tot_t = at["nS"] + at["nC"] + at["nT"]; tot_g = ga["nS"] + ga["nC"] + ga["nT"]
    if kind == "B": return inter.astype(np.int64)
    sym = tot_t + tot_g - 2 * inter
    if kind == "A2": return sym.astype(np.int64)
    sauce_same = (at["S"] == ga["S"]); sauce_shared = (sauce_same & (ga["nS"] == 1)).astype(np.int32)
    if kind == "A":  # the shipped P2 classes: add-one / remove-one / sauce-only / close / far
        inter_ns = inter - sauce_shared
        ns_t = at["nC"] + at["nT"]; ns_g = ga["nC"] + ga["nT"]
        missing = ns_t - inter_ns; extra = ns_g - inter_ns
        d = missing + extra + (~sauce_same).astype(np.int32)
        code = np.full(t.shape, 4, dtype=np.int64); code[d == 2] = 3
        code[(d == 1) & ~sauce_same] = 2
        code[(d == 1) & sauce_same & (extra == 1)] = 1
        code[(d == 1) & sauce_same & (missing == 1)] = 0
        code[d == 0] = 9
        return code
    if kind == "C":  # component flags: sauce ok / cheese set ok / topping set ok / family composition ok
        return sauce_same.astype(np.int64) + 2 * (at["C"] == ga["C"]) + 4 * (at["T"] == ga["T"]) + 8 * (at["fam"] == ga["fam"])
    if kind == "D":  # composition counts only (sauce n / cheese n / topping n equal?)
        return (at["nS"] == ga["nS"]).astype(np.int64) + 2 * (at["nC"] == ga["nC"]) + 4 * (at["nT"] == ga["nT"])
    raise ValueError(kind)
def solve(sp, tgt_idx, kind, rng, hint, cap=400):
    tattr = {k: v[tgt_idx] for k, v in sp.attr.items()}
    idx = np.nonzero(hint_keep(sp, tattr, hint))[0]; n0 = len(idx); tries = 0
    while tries < cap and len(idx) > 0:
        pick = int(idx[rng.randrange(len(idx))]); tries += 1
        if pick == tgt_idx: return tries, n0
        g = sp.m[pick]; ga = g_attrs(g)
        fb = feedback(kind, sp, idx, g, ga)
        ref = feedback(kind, sp, np.array([tgt_idx]), g, ga)[0]
        idx = idx[(fb == ref) & (idx != pick)]
    return cap, n0
sim = {"model": "space = {no sauce | one owned sauce} x {any subset of owned cheeses} x {<=4 owned toppings (production max)}; targets = every recipe makeable at that ladder state; "
                "solver = uniformly random guess among combinations consistent with every feedback so far (a neutral baseline: an entropy-maximising solver is faster for B / A2); "
                "attempts counted until the exact combination is baked. E (Hint + Notebook only, no per-attempt fact) is analytic: elimination = (N+1)/2.",
       "results": {}}
rngs = random.Random(7)
SIM_STEPS = (6, 12, 18, 24)
for step in SIM_STEPS:
    O = owned_at(step); sp = Space(O)
    lookup = {int(v): k for k, v in enumerate(sp.m)}
    tgts = [r for r in RECIPES if r["set"] <= O]
    sim["results"][str(step)] = {"space": int(len(sp.m)), "targets": len(tgts), "owned": len(O)}
    for hint_name, hint in (("H0 none", None), ("H3 sauce+cheese+toppingCount", {"sauce", "cheese", "count"}), ("H4 +families", {"sauce", "cheese", "count", "fam"})):
        for kind in ("E", "A", "A2", "B", "C", "D"):
            res = []; n0s = []
            for r in tgts:
                ti = lookup[mask(r["set"])]
                if kind == "E":
                    n0s.append(int(hint_keep(sp, {k: v[ti] for k, v in sp.attr.items()}, hint).sum())); continue
                for _ in range(1 if step >= 18 else 2):
                    tr, n0 = solve(sp, ti, kind, rngs, hint); res.append(tr); n0s.append(n0)
            if kind == "E":
                nh = int(statistics.median(n0s))
                sim["results"][str(step)][f"{hint_name}|E"] = {"hyp_space_after_hint_median": nh, "mean": round((nh + 1) / 2, 1), "median": round((nh + 1) / 2, 1), "p90": int(0.9 * nh), "max": nh}
                continue
            res.sort()
            sim["results"][str(step)][f"{hint_name}|{kind}"] = {"hyp_space_after_hint_median": int(statistics.median(n0s)), "mean": round(statistics.mean(res), 1),
                                                                 "median": statistics.median(res), "p90": res[int(0.9 * (len(res) - 1))], "max": res[-1]}
out["feedback_sim"] = sim

# ---------------------------------------------------------------- 8. representative recipe pack (proposal; nothing is implemented)
PACK_IDS = ["aussie-pizzadb", "brazilian-calabresa-pizzadb-p10", "chilean-napolitana-pizzadb", "hot-honey-pepperoni-pizzadb-p12",
            "spanish-chorizo-pizza-pizzadb-p4", "ratatouille-pizza-pizzadb-p13", "pesto-vegetariana-pizzadb-p12"]
PACK_OPTIONAL = ["bbq-chicken-pizzadb"]
EXTRA_FAM = {"bell-pepper": "vegetable", "zucchini": "vegetable", "chicken": "meat", "cilantro": "herb"}
EXTRA_CAT = {"honey": "sauce", "bbq-sauce": "sauce", "bell-pepper": "topping", "zucchini": "topping", "chicken": "topping", "cilantro": "topping"}
byid172 = {r["evidenceId"]: r for r in mat["rows"]}
def cat_any(i): return ING[i]["cat"] if i in ING else EXTRA_CAT[i]
def fam_any(i): return FAM[i] if i in FAM else EXTRA_FAM[i]
pack = []
for eid in PACK_IDS + PACK_OPTIONAL:
    r = byid172[eid]; S = frozenset(r["ingredients"]["identityIngredientSet"])
    p = {"id": eid, "nameJa": r["nameJa"], "set": S, "new": sorted(i for i in S if i not in ING),
         "sauce": sorted(i for i in S if cat_any(i) == "sauce"), "cheese": sorted(i for i in S if cat_any(i) == "cheese"),
         "top": sorted(i for i in S if cat_any(i) == "topping"), "status": r["productDecisionStatus"], "caps": r["requiredCapabilities"],
         "cand_caps": r["candidateCapabilities"], "spread_layers": r["sauceBase"]["spreadLayers"], "optional": eid in PACK_OPTIONAL}
    p["fam"] = collections.Counter(fam_any(i) for i in p["top"])
    p["sauce_none_identity"] = not [i for i in r["sauceBase"]["spreadLayers"]]
    pack.append(p)
prod_sets = {r["set"]: r["id"] for r in RECIPES}
coll_prod = [(p["id"], prod_sets[p["set"]]) for p in pack if p["set"] in prod_sets]
coll_pack = [(a["id"], b["id"]) for a, b in itertools.combinations(pack, 2) if a["set"] == b["set"]]
# which existing ladder step opens each reuse-only pack recipe (frozen W1 ladder), and the sibling recipes opened at the same step
step_of = {}
for s, ids, key in LADDER:
    for i in ids: step_of[i] = s
open_rows = []
for p in pack:
    if p["new"]: open_rows.append({"id": p["id"], "opens_at": "needs new ingredient(s): " + ", ".join(p["new"])}); continue
    need = [i for i in p["set"] if i not in STARTERS]
    st = max((step_of[i] for i in need), default=0)
    ladder_ids = set(STARTERS) | {i for s, ids, _ in LADDER if s <= st for i in ids}
    sib = sorted([r["id"] for r in RECIPES if r["set"] <= ladder_ids and not (r["set"] <= (set(STARTERS) | {i for s, ids, _ in LADDER if s <= st - 1 for i in ids}))])
    open_rows.append({"id": p["id"], "opens_at_ladder_step": st, "last_needed_ingredient": [i for i in need if step_of[i] == st], "opened_together_with": sib})
# hint discrimination over 25 + pack (closed world, sauce ids include the no-sauce case)
ALLR = [{"id": r["id"], "sauce": r["sauce"], "cheese": r["cheese"], "top": r["top"], "fam": r["fam"]} for r in RECIPES] + \
       [{"id": p["id"], "sauce": [i for i in p["sauce"]], "cheese": p["cheese"], "top": p["top"], "fam": p["fam"]} for p in pack if not p["optional"]]
def key_of(r, parts):
    d = []
    if "sauce" in parts: d.append(tuple(r["sauce"]))
    if "cheese" in parts: d.append(tuple(r["cheese"]))
    if "count" in parts: d.append(len(r["top"]))
    if "fam" in parts: d.append(tuple((f, r["fam"][f]) for f in FAM_ORDER if r["fam"][f]))
    return tuple(d)
def classes_of(parts):
    g = collections.defaultdict(list)
    for r in ALLR: g[key_of(r, parts)].append(r["id"])
    return sorted([v for v in g.values() if len(v) > 1]), sum(1 for v in g.values() if len(v) == 1), len(ALLR)
cls_pack = {}
for nm, parts in {"families + count only": ["count", "fam"], "sauce+cheese+count": ["sauce", "cheese", "count"], "sauce+cheese+count+families": ["sauce", "cheese", "count", "fam"]}.items():
    shared, single, n = classes_of(parts)
    cls_pack[nm] = {"population": n, "singleton": single, "shared_groups": shared}
# pace: lazy (only key recipes) vs greedy (discovers everything makeable) player on the FROZEN ladder, with reuse-only pack recipes added
def pace(extra_sets):
    recs = [(r["id"], r["set"]) for r in RECIPES] + [(i, s) for i, s in extra_sets]
    disc = set(); steps_reached = 0; trace = []
    for rnd in range(1, 60):
        owned = set(STARTERS) | {i for s, ids, _ in LADDER if s <= steps_reached for i in ids}
        make = [i for i, s in recs if s <= owned and i not in disc]
        if not make: break
        disc |= set(make)           # greedy: discovers everything makeable
        trace.append({"round": rnd, "discovered_total": len(disc), "steps_reached_before": steps_reached, "pool_seen": len(make)})
        steps_reached = min(len(disc), 24)
    return trace
reuse = [(p["id"], p["set"]) for p in pack if not p["new"] and not p["optional"] and all(i in ING for i in p["set"])]
out["pack_dv1"] = {
    "recipes": [{"id": p["id"], "nameJa": p["nameJa"], "ingredients": sorted(p["set"]), "new_ingredients": p["new"], "sauce_layers": p["spread_layers"],
                 "cheese": p["cheese"], "topping_count": len(p["top"]), "family_composition": dict(p["fam"]), "decision_status": p["status"],
                 "required_capabilities": p["caps"], "candidate_capabilities": p["cand_caps"], "optional": p["optional"]} for p in pack],
    "identity_collisions_with_production_25": coll_prod, "identity_collisions_inside_pack": coll_pack,
    "opening_on_frozen_ladder": open_rows,
    "closed_world_classes_25_plus_pack_core": cls_pack,
    "greedy_pace_25_only": pace([]), "greedy_pace_25_plus_reuse_only": pace(reuse),
    "note": "reuse-only pack recipes add discoveries without adding ladder steps; because the ladder is COUNT-based (step s at s discoveries) every extra recipe advances the ladder one step sooner for a player who finds it"}

OUT = os.path.join(ROOT, "docs/reports/data/TETO_DISCOVERY-3_FRESH-AUDIT_DATA.json")
if "--out" in sys.argv: OUT = sys.argv[sys.argv.index("--out") + 1]
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1, default=str)
print("wrote", OUT)
