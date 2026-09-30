#!/usr/bin/env python3
"""Discovery 3.0 S1 measurement: items E (hint candidate reduction), F (direct-answer recipes), H (near/far leakage).

Tooling only (no src/** change). Reuses the audit script's own parsing and solver code by slicing it at fixed markers, so the two
cannot drift. brazilian-calabresa is a SYNTHETIC fixture (it is not in RECIPES). Deterministic (fixed seeds).
Usage: python3 tools/discovery3_s1_measure.py [--out PATH]      (needs numpy; ~3 min)
"""
import json, os, sys, collections, itertools, random, statistics
from math import comb

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
audit = open(os.path.join(ROOT, "tools/discovery3_fresh_audit.py"), encoding="utf-8").read()
# 1) production data parsing (RECIPES, ING, FAM, ROLES, LADDER, STARTERS, makeable, FAM_ORDER)
exec(audit[: audit.index("out = {}")].replace("os.path.dirname(os.path.dirname(os.path.abspath(__file__)))", repr(ROOT)))
out = {}

def owned_at(step): return set(STARTERS).union(*[set(x[1]) for x in LADDER if x[0] <= step])
key_step = {x[2]: x[0] for x in LADDER}

# ---- fixture: brazilian-calabresa (identity from the 172 matrix / PIZZA DB evidence; quantities irrelevant to identity)
def mkrecipe(rid, ids):
    r = {"id": rid, "set": frozenset(ids)}
    r["sauce"] = sorted(i for i in ids if ING[i]["cat"] == "sauce"); r["cheese"] = sorted(i for i in ids if ING[i]["cat"] == "cheese")
    r["top"] = sorted(i for i in ids if ING[i]["cat"] == "topping"); r["fam"] = collections.Counter(FAM[i] for i in r["top"]); r["total"] = len(ids)
    return r
CAL = mkrecipe("brazilian-calabresa", ["tomato-sauce", "sausage", "onion", "black-olive", "oregano"])
POP = RECIPES + [CAL]
key_step["brazilian-calabresa"] = max(step for s, ids, _ in LADDER for step in [s] if set(ids) & CAL["set"])
assert key_step["brazilian-calabresa"] == 12

# ---- E: open-world deduction room R per hint profile (what the player faces), 26 recipes
def room2(t, O, facts, key=None):
    saucs = [i for i in O if ING[i]["cat"] == "sauce"]; ch = [i for i in O if ING[i]["cat"] == "cheese"]; tp = [i for i in O if ING[i]["cat"] == "topping"]
    n_sauce = 1 if "sauce" in facts else len(saucs) + 1
    n_ch = 1 if "cheese" in facts else 2 ** len(ch)
    k = len(t["top"]); kf = FAM[key] if key else None
    if "fam" in facts:
        n_top = 1
        for f in FAM_ORDER:
            own_f = sum(1 for i in tp if FAM[i] == f); c = t["fam"][f]
            n_top *= comb(own_f - 1, c - 1) if (key and f == kf) else comb(own_f, c)
    elif "count" in facts: n_top = comb(len(tp) - 1, k - 1) if key else comb(len(tp), k)
    else: n_top = 2 ** (len(tp) - 1) if key else 2 ** len(tp)
    return n_sauce * n_ch * n_top
PROFILES = {"P-B sauce+cheese+count+families": {"sauce", "cheese", "count", "fam"}, "P-C sauce+cheese+count": {"sauce", "cheese", "count"},
            "P-D count+families (no sauce/cheese named)": {"count", "fam"}, "P-G sauce+families (no cheese, no count)": {"sauce", "fam"}}
def R_of(t, facts, key=None): return room2(t, owned_at(key_step.get(t["id"], 0)), facts, key)
def klass(R, hi): return "DIRECT_ANSWER" if R == 1 else ("APPROPRIATE" if R <= hi else "TOO_BROAD")
THRESHOLDS = {"tight (appropriate R<=8)": 8, "mid (R<=32)": 32, "loose (R<=128)": 128}
E = {"population": len(POP), "owned_basis": "each recipe's own key-step owned set (frozen W1 ladder)", "profiles": {}}
for name, facts in PROFILES.items():
    rows = {t["id"]: R_of(t, facts) for t in POP}
    v = sorted(rows.values())
    E["profiles"][name] = {"R": rows, "min": v[0], "median": statistics.median(v), "p90": v[int(0.9 * (len(v) - 1))], "max": v[-1],
                           "by_threshold": {tn: dict(collections.Counter(klass(R, hi) for R in rows.values())) for tn, hi in THRESHOLDS.items()}}
# current Hint 5.0 (key named) for the 25 only, for comparison
h5 = {t["id"]: room2(t, owned_at(key_step.get(t["id"], 0)), {"sauce", "cheese", "count", "fam"}, ROLES[t["id"]][0]) for t in RECIPES}
E["hint5_current_full_ladder_25"] = {"R": h5, "by_threshold": {tn: dict(collections.Counter(klass(R, hi) for R in h5.values())) for tn, hi in THRESHOLDS.items()}}
# closed-world reduction sequences (P-B order: sauce, cheese, count, then family clues one at a time) over the 26 and inside the step-12 pool
def fam_pairs(t): return [(f, t["fam"][f]) for f in FAM_ORDER if t["fam"][f] > 0]
def cons(t, k, universe):
    def ok(c):
        if k >= 1 and c["sauce"] != t["sauce"]: return False
        if k >= 2 and c["cheese"] != t["cheese"]: return False
        if k >= 3 and len(c["top"]) != len(t["top"]): return False
        if k >= 4:
            for f, n in fam_pairs(t)[: k - 3]:
                if c["fam"][f] != n: return False
        return True
    return [c["id"] for c in universe if ok(c)]
seq26 = {t["id"]: [len(cons(t, k, POP)) for k in range(0, 3 + len(fam_pairs(t)) + 1)] for t in POP}
pool12 = [R_ for R_ in POP if R_["id"] in ("pizza-portuguesa", "brazilian-calabresa")]
seqpool = {t["id"]: [len(cons(t, k, pool12)) for k in range(0, 3 + len(fam_pairs(t)) + 1)] for t in pool12}
E["closed_world_26_reduction"] = {"stages": "0 none, 1 sauce, 2 cheese, 3 count, 4.. family clue 1..n", "per_recipe": seq26,
                                   "final_unique": sum(1 for v in seq26.values() if v[-1] == 1), "final_histogram": dict(collections.Counter(v[-1] for v in seq26.values()))}
E["step12_pool_pair_reduction"] = {"pool": [r["id"] for r in pool12], "per_recipe": seqpool,
    "first_stage_that_separates": "cheese (portuguesa: mozzarella; calabresa: none)" if seqpool["pizza-portuguesa"][2] == 1 else "later"}
# "applicable hints derived from recipe structure" (OD-D3-1): which fact types exist for each recipe
def applicable(t):
    a = ["sauce/base:" + ("+".join(t["sauce"]) if t["sauce"] else "NONE(no-sauce -> technique, not offered)")]
    a.append("cheese:" + ("+".join(t["cheese"]) if t["cheese"] else "NONE (nothing to ask; offering it leaks 2.3 bit)"))
    a.append(f"ingredient_count:{t['total']}"); a.append(f"topping_count:{len(t['top'])}")
    a.append("families:" + (",".join(f"{f}x{n}" for f, n in fam_pairs(t)) if t["top"] else "none (no toppings)"))
    return a
E["applicable_hint_rule_examples"] = {rid: applicable(R_) for rid, R_ in {t["id"]: t for t in POP}.items() if rid in ("margherita", "marinara", "quattro-formaggi", "pizza-bianca", "brazilian-calabresa", "pizza-portuguesa")}
out["E"] = E
# ---- F: direct answers, one by one, with the reason
def reason(t, facts, key=None):
    O = owned_at(key_step.get(t["id"], 0)); tp = [i for i in O if ING[i]["cat"] == "topping"]; why = []
    if "fam" in facts:
        for f in FAM_ORDER:
            c = t["fam"][f]
            if c == 0: continue
            own_f = sum(1 for i in tp if FAM[i] == f) - (1 if (key and FAM[key] == f) else 0)
            need = c - (1 if (key and FAM[key] == f) else 0)
            if comb(own_f, need) == 1: why.append(f"{f}: needs {need} of {own_f} owned" + (" (family saturated)" if own_f == need and own_f > 0 else " (nothing else in the family is owned)" if need == 0 else ""))
    if not why: why.append("unique under the remaining facts")
    return why
F = {"note": "direct answer = R == 1 at the recipe's own key step, after every hint of the profile", "profiles": {}}
for name, facts in list(PROFILES.items())[:1]:
    F["profiles"][name] = [{"recipe": t["id"], "key_step": key_step.get(t["id"], 0), "R": R_of(t, facts), "why": reason(t, facts)} for t in POP if R_of(t, facts) == 1]
F["profiles"]["H5 current full ladder (key named)"] = [{"recipe": t["id"], "key_step": key_step.get(t["id"], 0), "R": h5[t["id"]], "why": reason(t, {"fam"}, ROLES[t["id"]][0])} for t in RECIPES if h5[t["id"]] == 1]
out["F"] = F

# ---- H: near/far (and the other feedback kinds) leakage, 26-recipe world, from the audit's own solver
sim_src = audit[audit.index("import numpy as np"): audit.index("sim = {")]
exec(sim_src)
def run_sim(steps):
    res = {}; rngs = random.Random(7)
    for step in steps:
        O = owned_at(step); sp = Space(O); lookup = {int(v): k for k, v in enumerate(sp.m)}
        tg = [r for r in POP if r["set"] <= O]
        res[str(step)] = {"space": int(len(sp.m)), "targets": len(tg)}
        for hn, hint in (("H0 none", None), ("H3 sauce+cheese+count", {"sauce", "cheese", "count"}), ("H4 +families", {"sauce", "cheese", "count", "fam"})):
            for kind in ("E", "A", "A2", "B", "C", "D"):
                n0s = []; tries = []
                for r in tg:
                    ti = lookup[mask(r["set"])]
                    if kind == "E":
                        n0s.append(int(hint_keep(sp, {k: v[ti] for k, v in sp.attr.items()}, hint).sum())); continue
                    for _ in range(1 if step >= 18 else 2):
                        t_, n0 = solve(sp, ti, kind, rngs, hint); tries.append(t_); n0s.append(n0)
                if kind == "E":
                    nh = int(statistics.median(n0s)); res[str(step)][f"{hn}|E"] = {"mean": round((nh + 1) / 2, 1), "hyp_space_median": nh}; continue
                tries.sort(); res[str(step)][f"{hn}|{kind}"] = {"mean": round(statistics.mean(tries), 1), "p90": tries[int(0.9 * (len(tries) - 1))], "hyp_space_median": int(statistics.median(n0s)), "capped_share": round(sum(1 for x in tries if x >= 400) / len(tries), 2)}
    return res
H = {"model": "same solver as the Fresh Audit; targets = every recipe makeable at the step, now INCLUDING brazilian-calabresa (26-world)", "sim": run_sim((12, 18, 24))}
# ratio to no-feedback elimination and two candidate definitions of 'hard to brute force' (OD-D3-16 input)
ratios = {}
for step, d in H["sim"].items():
    for hn in ("H3 sauce+cheese+count", "H4 +families"):
        e = d[f"{hn}|E"]["mean"]
        ratios[f"step{step} {hn}"] = {k: round(d[f"{hn}|{k}"]["mean"] / e, 3) for k in ("A", "A2", "B", "C", "D")}
H["ratio_vs_no_feedback"] = ratios
cands = {}
for step, d in H["sim"].items():
    for hn in ("H3 sauce+cheese+count",):
        e = d[f"{hn}|E"]["mean"]
        cands[f"step{step}"] = {"E_mean": e, "kinds_with_ratio_ge_0.25": [k for k in ("A", "A2", "B", "C", "D") if d[f"{hn}|{k}"]["mean"] / e >= 0.25],
                                "kinds_with_mean_ge_20": [k for k in ("A", "A2", "B", "C", "D") if d[f"{hn}|{k}"]["mean"] >= 20]}
H["OD_D3_16_candidate_definitions"] = {"def1": "mean attempts >= 25% of the no-feedback elimination at the same hint level", "def2": "mean attempts >= 20 under H3 at steps >= 12", "evaluation": cands}
# reach of the near/far oracle: share of ALL identities within distance 1 of a recipe in the pool (pool 1 vs pool 2), step 12
sp12 = Space(owned_at(12))
def within1(recipes):
    res = np.zeros(len(sp12.m), dtype=bool)
    for r in recipes:
        t = np.uint64(mask(r["set"]))
        inter = popcount(sp12.m & t); tot_g = sp12.attr["nS"] + sp12.attr["nC"] + sp12.attr["nT"]
        sym = tot_g + popcount(np.array([t]))[0] - 2 * inter
        res |= (sym <= 1)
    return float(res.mean()), int(res.sum())
pz = R_ = [r for r in POP if r["id"] == "pizza-portuguesa"]; cl = [r for r in POP if r["id"] == "brazilian-calabresa"]
H["near_reach_step12"] = {"space": int(len(sp12.m)), "pool1_portuguesa": within1(pz), "pool2_portuguesa_calabresa": within1(pz + cl),
                          "reading": "(share, count) of all identities that the near/far line reports as one edit away (d<=1, symmetric difference) from a pool recipe; note P2 also separates add / remove / sauce direction"}
out["H"] = H
OUT = os.path.join(ROOT, "docs/reports/data/TETO_DISCOVERY-3_S1_MEASURE.json")
if "--out" in sys.argv: OUT = sys.argv[sys.argv.index("--out") + 1]
os.makedirs(os.path.dirname(OUT), exist_ok=True)
json.dump(out, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1, default=str)
print("wrote", OUT)
