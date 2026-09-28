#!/usr/bin/env python3
"""
172 Recipe DA-1 Preparation Audit. Docs/data/tools only. NOT a production authority and NOT wired
into CI. It does not implement DA-1.

Question: for the 17 rows the 172 Recipe Authority Matrix classifies as B ("data authority addition
only"), what still has to be decided before a data-only production PR is possible?

It is a CONSUMER. It reads the other lanes' authorities and never decides for them:
  - the Authority Matrix                  (79873c0; the B=17 selection and its per-row facts)
  - production taxonomy / ingredients     (main, DH4-1 rows; the W2-A1 rows on the Wave 2 branch)
  - Hint 5.0 (#292)                       (roles + G17 gate + H5-4 Fresh Gate at the branch head)
  - Wave 2 (OD-W2 ledger, W2-A authoring) (branch head; approved values only)
  - Cooking Steps / Techniques            (PR #295 reference; TQ SSOT on main)
Where no authority exists a value is a CANDIDATE and says so. Nothing is promoted to authority.

Every input is a pinned git object, so the output does not depend on the checkout. It never writes
to the Authority Matrix files and does not import the matrix generator.

Usage:
  python3 tools/recipe172_da1_preparation.py           # writes the JSON
  python3 tools/recipe172_da1_preparation.py --check   # rebuilds and fails on byte drift
"""
import argparse
import json
import math
import re
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_JSON = ROOT / "docs/reports/data/TETO_RECIPE-172_DA-1_PREPARATION-AUDIT.json"

PINS = {
    "main": ("86b48fd51423a8f76db5398ab88ecfd944e2ae10", "origin/main (Merge PR #291)"),
    "authorityMatrix": ("79873c0d389d90f551e5ea0afcb52e7f15623c29", "claude/172-recipe-authority-matrix (no PR)"),
    "hint5": ("5eadb96", "claude/hint-5-0-fresh-audit-cdgm9e (H5-3 head 1ec4253 + H5-4 Fresh Gate report; no PR)"),
    "wave2": ("2bc40e41f320f9c46ea6110e9df4d50866325cf3", "claude/wave2-runtime-recipe-design-os06j1 (W2-A1; no PR)"),
    "taxCoverage": ("1bb4f9d3a10172b8f6a3f4bb2af794db2435db4c", "PR #293 head (open, reference)"),
    "cookingSteps": ("13d68366fa7b7cee953680cde5990fd5b7c2f098", "PR #295 head (open, CS-1a; reference)"),
    "hcgPack": ("7792bc8e2c877c254c2d5be2eebc7b83d4de995c", "claude/recipe172-taxonomy-hcg (the HCG lane's docs pack for F=65; no decision; no PR)"),
}

# ---------------------------------------------------------------------------------------------
# Lanes. A row is "missing" a lane when a decision or data item owned by that lane is not final.
# Lane families drive the B0..B4 grouping: Hint 5.0 / Taxonomy / Owner recipe authority.
# ---------------------------------------------------------------------------------------------
LANES = {
    "H": ("Hint 5.0", "Hint 5.0 key topping and sub-topping order (OD-H5-C1: explicit authority; #292)"),
    "N": ("Hint 5.0", "OD-H5-P4-CHEESE: a cheeseless recipe would reach RESERVED_EMPTY_RUNG (H5-4 Fresh Gate; undecided)"),
    "T": ("Taxonomy", "a topping has no production family and no Owner-approved row (HCG, OD-TAX-7)"),
    "I": ("Owner recipe authority", "a new ingredient or paint sauce has no approved authoring row (art, colour, category, profile)"),
    "R": ("Owner recipe authority", "recipe authoring values (nameJa, description, minCount, bakeTarget, reference)"),
    "P": ("Owner recipe authority", "progression / wave: no approved wave (OD-W2-3 approves only W2-A -> W2-C -> W2-D)"),
    "O": ("Owner recipe authority", "an open matrix review item that no approved decision covers"),
}
FAMILY_OF_LANE = {k: v[0] for k, v in LANES.items()}

# ---------------------------------------------------------------------------------------------
# C1-P assessment. CANDIDATES ONLY (never authority). Hand-authored, validated against the row.
# basis:
#   APPROVED_ROLE   the W2-A authoring (A1, Owner-approved) tags the topping "primary (name-giving)"
#   NAME_MATCH      the Authority Matrix found the topping named in the recipe name (H5-0 6.4 step 1;
#                   a guideline candidate, not authority)
#   READING         this audit's own C1-P reading of the dish (lowest confidence; not evidence)
#   NONE            no unique main under C1-P: Owner choice
# ---------------------------------------------------------------------------------------------
C1P = {
    "calabresa-argentina-pizzadb": ("salami", "READING", "salami is the protein main; black-olive supports and oregano is an aroma. The name has no ingredient token. The salami / spicy-salami / sausage cluster is unresolved (OD-TAX-7)."),
    "vongole-pizzadb": ("clam", "APPROVED_ROLE", "W2-A A1 tags clam 3 as primary (= new-haven-apizza clam 3, whose runtime key is clam). garlic / parsley are aromas and are not key candidates."),
    "flammkuchen-pizzadb": (None, "NONE", "W2-A A1 records 'two co-defining toppings (bacon + onion)'. C1-P has no unique main. The H5-0 6.4 tie-break (largest amount) would give bacon, but the tie-break is not authority."),
    "eggplant-tahini-pizza-pizzadb-p5": ("eggplant", "NAME_MATCH", "eggplant is the named main; parsley is an aroma and pomegranate a garnish-like fruit."),
    "eggplant-dengaku-pizza-pizzadb-p6": ("eggplant", "NAME_MATCH", "eggplant is the named main; white-sesame is a garnish."),
    "baba-ganoush-pizza-pizzadb-p7": ("eggplant", "READING", "the name has no ingredient token; eggplant as the main is this audit's reading of the dish, not evidence."),
    "jamon-serrano-pizza-pizzadb-p7": ("prosciutto-crudo", "APPROVED_ROLE", "W2-A A1 tags prosciutto-crudo 3 as primary (jamon); arugula is the supporting leaf."),
    "brazilian-calabresa-pizzadb-p10": ("sausage", "APPROVED_ROLE", "W2-A A1 tags sausage 3 as primary; onion and black-olive support and oregano is an accent (an aroma, so never key)."),
    "prosciutto-funghi-pizzadb-p11": (None, "NONE", "W2-A A1 records 'two name-giving toppings' (prosciutto-crudo 2, mushroom 3). The tie-break steps disagree: name order gives prosciutto-crudo, largest amount gives mushroom."),
    "veggie-supreme-pizza-pizzadb-p11": (None, "NONE", "five co-equal vegetables; no name-giving topping."),
    "pesto-gamberi-pizzadb-p11": ("shrimp", "APPROVED_ROLE", "W2-A A1 tags shrimp 3 as primary (gamberi); fresh-tomato and garlic support."),
    "pesto-salmone-pizzadb-p11": ("salmon", "NAME_MATCH", "salmon is the named main; lemon is a garnish."),
    "pesto-trapanese-pizzadb-p11": (None, "NONE", "almond, fresh-tomato and garlic: none is name-giving and none is clearly the main."),
    "pesto-vegetariana-pizzadb-p12": (None, "NONE", "W2-A A1 records 'three co-equal vegetables' (zucchini, bell-pepper, eggplant at 2 each)."),
    "pesto-pollo-pizzadb-p12": ("chicken", "APPROVED_ROLE", "W2-A A1 tags chicken 3 as primary (pollo); fresh-tomato supports."),
    "ratatouille-pizza-pizzadb-p13": (None, "NONE", "W2-A A1 records 'three co-equal vegetables, no name-giving'. oregano is an accent (an aroma), so it is excluded from the key by C1-P."),
    "rucola-e-grana-pizzadb-p13": (None, "NONE", "the name gives arugula, yet arugula is a leaf garnish while prosciutto-crudo is the protein main. C1-P (main over garnish) and the name point in different directions."),
}

# Open-decision notes that no approved decision covers (row -> item). W2-A rows' matrix review items
# are covered by OD-W2-7 (a) and are not listed here.
OPEN_REVIEW = {
    "calabresa-argentina-pizzadb": "NAMING_CLUSTER NC-4-calabresa (sibling of brazilian-calabresa: different composition, same name family) and the salami / spicy-salami / sausage cluster (OD-TAX-7)",
}
COVERED_BY_OD_W2_7 = {
    "brazilian-calabresa-pizzadb-p10": "OD-W2-7 (a): brazilian-calabresa keeps black-olive; NAMING_CLUSTER NC-4 sibling stays out of W2-A",
    "vongole-pizzadb": "OD-W2-7 (a): vongole uses olive oil as its base (PAINT_TEMPORARY)",
    "prosciutto-funghi-pizzadb-p11": "OD-W2-7 (a): id kept as prosciutto-funghi",
    "jamon-serrano-pizza-pizzadb-p7": "OD-W2-7 (a): jamon-serrano adopted with the pinsa-romana reservation",
}

CLASS_LABELS = {
    "B0": "no missing authority lane: a data PR is possible once the Start Gate passes",
    "B1": "only the Hint 5.0 lane is missing (key / sub-topping authoring, and P4-CHEESE where the recipe has no cheese)",
    "B2": "only the Taxonomy / HCG lane is missing",
    "B3": "only the Owner recipe authority lane is missing (ingredient art, recipe values, wave, review items)",
    "B4a": "two lane families are missing",
    "B4b": "all three lane families are missing",
}


def git_show(sha, path):
    try:
        return subprocess.run(["git", "show", f"{sha}:{path}"], cwd=ROOT, capture_output=True,
                              text=True, check=True).stdout
    except subprocess.CalledProcessError:
        raise SystemExit(f"missing git object {sha[:8]}:{path}. Run: git fetch origin main "
                         "claude/172-recipe-authority-matrix claude/hint-5-0-fresh-audit-cdgm9e "
                         "claude/wave2-runtime-recipe-design-os06j1 claude/hint-5-0-taxonomy-audit-g9d1u9 "
                         "claude/post-w1-cooking-steps-design-2nomy3 claude/recipe172-taxonomy-hcg")


def gjson(pin, path):
    return json.loads(git_show(PINS[pin][0], path))


def gtext(pin, path):
    return git_show(PINS[pin][0], path)


def taxonomy_rows(src):
    rows = src[src.index("TOPPING_FAMILY_ROWS"):]
    rows = rows[:rows.index("];")]
    return dict(re.findall(r'\["([^"]+)", "(\w+)"\]', rows))


def ingredient_ids(src):
    return {m[0]: m[1] for m in re.findall(r'id: "([^"]+)",\s*category: "(\w+)"', src)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    text = json.dumps(build(), ensure_ascii=False, indent=1) + "\n"
    if args.check:
        if not OUT_JSON.exists() or OUT_JSON.read_text(encoding="utf-8") != text:
            print(f"DRIFT: {OUT_JSON.relative_to(ROOT)}", file=sys.stderr)
            sys.exit(1)
        print("OK: no drift")
        return
    OUT_JSON.write_text(text, encoding="utf-8")
    print(f"wrote {OUT_JSON.relative_to(ROOT)}")


def build():
    main_sha = PINS["main"][0]
    am = gjson("authorityMatrix", "docs/reports/data/TETO_RECIPE-172_AUTHORITY-MATRIX.json")
    if am["summary"]["primaryClass"] != {"A": 11, "B": 17, "C": 24, "D": 16, "E": 39, "F": 65}:
        raise SystemExit(f"Authority Matrix class counts changed: {am['summary']['primaryClass']}")
    mx = {r["evidenceId"]: r for r in gjson("main", "docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json")["rows"]}
    cov = gjson("taxCoverage", "docs/reports/data/TETO_HINT-5_TAXONOMY-172-COVERAGE_Fresh-Audit.json")
    cs = {r["evidenceId"]: r for r in gjson("cookingSteps", "docs/reports/data/TETO_POST-W1_COOKING-STEPS_172-MECHANIC-CLASSIFICATION.json")["rows"]}
    w2a = {r["evidenceId"]: r for r in gjson("wave2", "tools/wave2-w2a/w2a_authoring_candidates.json")["recipes"]}
    w2cand = gjson("wave2", "docs/design/data/TETO_WAVE2_RUNTIME-RECIPE_CANDIDATES.json")
    w2rows = {r["evidenceId"]: r for r in w2cand["rows"]}
    w2opts = {o["id"]: o["recipeEvidenceIds"] for o in w2cand["waveOptions"]}
    ledger = gtext("wave2", "docs/design/TETO_WAVE2_OWNER-DECISION-LEDGER.md")
    gate = gtext("wave2", "docs/reports/TETO_WAVE2_W2A_AUTHORING-GATE.md")
    catalog = {r["id"]: r for r in gjson("main", "data/recipes/pizza_master_catalog.json")["recipes"]}
    hcg = gjson("hcgPack", "docs/reports/data/TETO_RECIPE-172_TAXONOMY-HCG.json")
    hcg_items = {x["item"] for x in hcg["items"]}
    hcg_decision_items = {i for d in hcg["decisions"] for i in d["items"]}
    # the pack must still describe itself as questions, not decisions; if that changes, re-read it
    assert "NOT an authority" in hcg["schemaNote"] and "QUESTIONS" in hcg["schemaNote"], hcg["schemaNote"][:120]
    assert all(d.get("ownerDecision") is True for d in hcg["decisions"] if d["kind"] == "FAMILY")

    prod_ing = ingredient_ids(gtext("main", "src/data/ingredients.ts"))
    w2_ing = ingredient_ids(gtext("wave2", "src/data/ingredients.ts"))
    prod_tax = taxonomy_rows(gtext("main", "src/data/ingredientTaxonomy.ts"))
    w2_tax = taxonomy_rows(gtext("wave2", "src/data/ingredientTaxonomy.ts"))
    sauce_profiles_main = set(re.findall(r'ingredientId: "([a-z-]+)",', gtext("main", "src/data/recipeSauceProfiles.ts")))
    sauce_union_w2 = gtext("wave2", "src/data/recipeSauceProfiles.ts")
    hint_roles_src = gtext("hint5", "src/data/recipeHintRoles.ts")
    hint_ladder_src = gtext("hint5", "src/logic/discovery/hint5Ladder.ts")
    h54 = gtext("hint5", "docs/reports/TETO_DISCOVERY-HINT-5_H5-4_Fresh-Gate.md")
    runtime_role_ids = re.findall(r'"?([a-z0-9-]+)"?: \{ hintKeyToppingId:', hint_roles_src)

    # --- guards: the consumed rules still read the way this audit assumes -----------------------
    assert len(runtime_role_ids) == 25, len(runtime_role_ids)
    assert "Record<RecipeId, RecipeHintRoles>" in hint_roles_src
    assert "if (toppings.length > 0) return false;" in hint_ladder_src and "expected = toppings.filter" in hint_ladder_src
    assert "P4-CHEESE" in h54 and "STOP:** waiting for the Owner's decision" in h54
    for od in ("OD-W2-3", "OD-W2-5", "OD-W2-6", "OD-W2-7", "**A1**", "**A3**", "**A4**"):
        assert od in ledger, od
    assert "W2-A → W2-C → W2-D" in ledger
    assert sauce_profiles_main == {"tomato-sauce", "pesto", "olive-oil"}, sauce_profiles_main
    assert "fromage-blanc-sauce" in sauce_union_w2

    # --- W2-A gate: per-recipe progression facts (key step, chapter, CUT) ------------------------
    gate_facts = {}
    for sec in gate.split("\n### 1.")[1:]:
        rid = re.match(r"\d+ .*?`([a-z0-9-]+)`", sec)
        if not rid:
            continue
        step = re.search(r"\| unlock prerequisite \| key step (\d+)（発見数 ≥ (\d+)）: ([^|]+?) \|", sec)
        chap = re.search(r"\| chapter \| 第(\d)章（(T\d)）", sec)
        cut = re.search(r"\| CUT \| (あり|なし)", sec)
        gate_facts[rid.group(1)] = {
            "ladderKeyStep": int(step.group(1)) if step else None,
            "ladderKeyMaterial": step.group(3).strip() if step else None,
            "chapter": chap.group(2) if chap else None,
            "cut": {"あり": "CUT", "なし": "NO_CUT"}.get(cut.group(1)) if cut else None,
        }
    w2_ids_by_runtime = {v["runtimeId"]: k for k, v in w2a.items()}
    assert len(gate_facts) == 9 and set(gate_facts) == set(w2_ids_by_runtime), sorted(gate_facts)

    b_rows = [r for r in am["recipes"] if r["classification"]["primary"] == "B"]
    assert len(b_rows) == 17
    assert {r["recipeId"] for r in b_rows if r["recipeId"] in w2a} == set(w2a)
    assert set(C1P) == {r["recipeId"] for r in b_rows}
    assert set(COVERED_BY_OD_W2_7) <= set(w2a) and set(OPEN_REVIEW) <= {r["recipeId"] for r in b_rows}

    def pr255(i):
        return cov["universe172"].get(i, {})

    out_rows = []
    for r in b_rows:
        eid = r["recipeId"]
        m = mx[eid]
        is_w2a = eid in w2a
        toppings = sorted(r["topping"]["candidates"])
        ids = r["ingredients"]["canonicalIds"]
        assert not r["ingredients"]["unresolvedNames"] and r["ingredients"]["complete"]

        # ---- catalog relation --------------------------------------------------------------
        cat_id = r["source"]["correspondsToCatalogId"]
        cat = catalog.get(cat_id) if cat_id else None
        relation = {
            "runtimeMatch": r["runtime"]["match"],
            "runtimeRecipeId": r["runtime"]["runtimeRecipeId"],
            "pizzaMasterCatalogId": cat_id,
            "pizzaMasterCatalogStatus": None if not cat else {"verification": cat["verificationStatus"], "gameDesign": cat["gameDesignStatus"], "currentGameRecipe": cat["currentGameRecipe"]},
            "matrixReviewItems": [x["type"] for x in m["reviewItems"]],
            "namingOrCollisionRefs": sorted(set(m["collisionRefs"] + m["conflictRefs"])),
            "exactRuntimeSetMatch": w2rows[eid]["discoveryAmbiguity"]["exactRuntimeSetMatch"],
        }

        # ---- ingredients / sauce / cheese / topping ---------------------------------------
        new_ids = [i for i in ids if i not in prod_ing]
        ingredient_authoring = {}
        for i in new_ids:
            ingredient_authoring[i] = ("APPROVED_ON_W2A1_BRANCH (OD-W2-5 / A5 / A6 / A7; not on main)"
                                       if i in w2_ing else "MISSING (no approved row: art / colour / category / tray order)")
        sauces = r["sauce"]["candidates"]
        sauce_status = []
        for s in sauces:
            if s in sauce_profiles_main:
                sauce_status.append({"id": s, "profile": "PRODUCTION_PROFILE_ON_MAIN"})
            elif s == "fromage-blanc-sauce":
                sauce_status.append({"id": s, "profile": "APPROVED_W2A (type union on the W2-A1 branch; the recipe's PAINT profile is authored in W2-A2)"})
            else:
                sauce_status.append({"id": s, "profile": "MISSING (new PAINT sauce profile + ingredient row)"})
        cheeses = r["cheese"]["candidates"]
        cheese_status = ("NO_CHEESE (evidence: complete identity set has none)" if not cheeses else
                         [{"id": c, "row": "PRODUCTION" if c in prod_ing else ("APPROVED_ON_W2A1_BRANCH" if c in w2_ing else "MISSING (new ingredient row)")} for c in cheeses])

        # ---- taxonomy ----------------------------------------------------------------------
        tax = []
        for t in toppings:
            if t in prod_tax:
                st, fam = "PRODUCTION_ON_MAIN", prod_tax[t]
            elif t in w2_tax:
                st, fam = "APPROVED_ON_W2A1_BRANCH (OD-W2-5; not on main)", w2_tax[t]
            else:
                st, fam = "MISSING", None
            u = pr255(t)
            tax.append({"id": t, "status": st, "family": fam, "proposedFamily": u.get("proposedFamily"),
                        "pr255Status": u.get("pr255Status"), "pr293Status": u.get("status"),
                        "hcgWatch": u.get("pr255Status") == "NEEDS_REVIEW"})
        tax_missing = [x["id"] for x in tax if x["status"] == "MISSING"]
        tax_pending_merge = [x["id"] for x in tax if x["status"].startswith("APPROVED_ON")]
        hcg_watch = [x["id"] for x in tax if x["hcgWatch"]]

        # ---- Hint 5.0 ----------------------------------------------------------------------
        n = len(toppings)
        cand, basis, note = C1P[eid]
        if cand is not None:
            assert cand in toppings, (eid, cand)
        fam_of = lambda i: next((x["family"] or x["proposedFamily"] for x in tax if x["id"] == i), None)  # noqa: E731
        listing = [t for t in (w2a[eid]["requiredIngredients"] and [x["ingredientId"] for x in w2a[eid]["requiredIngredients"]] or [])] if is_w2a else None
        if listing is None:
            seen = []
            for tr in mx[eid]["ingredients"]["tokenTrace"]:
                cid = tr.get("canonicalId")
                if cid and cid in toppings and cid not in seen:
                    seen.append(cid)
            listing = seen
            listing_src = "PIZZA DB evidence listing order (matrix tokenTrace)"
        else:
            listing_src = "W2-A approved authoring requiredIngredients order (H5-0 6.1: sub order = one-time copy of the recipe's own listing order; applied to the runtime 25 only)"
        listing_top = [t for t in listing if t in toppings]
        assert sorted(listing_top) == toppings, (eid, listing_top, toppings)
        seed_sub = [t for t in listing_top if t != cand] if cand else None
        hint = {
            "toppingCount": n,
            "validRoleAssignmentsUnderG17": math.factorial(n),
            "forcedByG17": n <= 1,
            "keyToppingAuthority": "MISSING" if cand is None else "CANDIDATE_ONLY",
            "keyToppingCandidate": cand,
            "keyCandidateBasis": basis,
            "keyCandidateNote": note,
            "subToppingOrderAuthority": "MISSING" if cand is None else "CANDIDATE_ONLY (seed)",
            "subToppingOrderSeedCandidate": seed_sub,
            "subToppingOrderSeedSource": listing_src if cand else None,
            "subOrderChoiceCount": None if cand is None else math.factorial(n - 1),
            "ownerChoiceRequired": True,
            "c1p": {
                "keyIsToppingNotSauceOrCheese": True,
                "candidateIsAromaFamily": bool(cand and fam_of(cand) in ("herb", "spice")),
                "assessment": ("OWNER_CHOICE (no unique main under C1-P)" if cand is None else
                               {"APPROVED_ROLE": "CANDIDATE consistent with C1-P (Owner-approved W2-A role)",
                                "NAME_MATCH": "CANDIDATE consistent with C1-P (name match; guideline only)",
                                "READING": "CANDIDATE by this audit's reading only (low confidence)"}[basis]),
            },
        }

        # ---- recipe authoring / progression -------------------------------------------------
        if is_w2a:
            wa = w2a[eid]
            g = gate_facts[wa["runtimeId"]]
            authoring = {"status": "APPROVED_OWNER (A1 minCount, A2 bakeTarget, A3 description, A4 name)",
                         "runtimeId": wa["runtimeId"], "nameJa": wa["nameJa"],
                         "minCounts": {x["ingredientId"]: x["minCount"] for x in wa["requiredIngredients"]},
                         "bakeTarget": [wa["bakeTarget"]["start"], wa["bakeTarget"]["end"]],
                         "descriptionStatus": wa["descriptionStatus"], "cut": g["cut"],
                         "note": "the Authoring Gate report still prints the description as OWNER_REQUIRED; the ledger (A3) and the authoring JSON supersede it"}
            progression = {"status": "APPROVED (OD-W2-1/2/3; ladder append verified in the W2-A Authoring Gate)",
                           "ladderKeyStep": g["ladderKeyStep"], "ladderKeyMaterial": g["ladderKeyMaterial"], "chapter": g["chapter"]}
        else:
            authoring = {"status": "MISSING (no Authoring Gate for this row)", "candidateName": r["canonicalName"]["nameJa"],
                         "candidateNameSource": "PIZZA DB evidence name (not an approved recipe name)",
                         "cutCandidate": w2rows[eid]["cutProfile"]}
            progression = {"status": "NO_APPROVED_WAVE",
                           "waveOptionsListingIt": [k for k, v in w2opts.items() if eid in v],
                           "note": "Wave 2 options are options, not decisions; OD-W2-3 approves only W2-A -> W2-C -> W2-D"}

        # ---- TQ / CS -----------------------------------------------------------------------
        tq = [d for d in r["techniqueDependency"] if not d["status"].startswith("NOT A TECHNIQUE")]
        csdeps = [d for d in r["cookingStepsDependency"]["mechanics"] if d["candidatePhase"].startswith("CS-")]
        assert not tq and not csdeps, (eid, tq, csdeps)
        engine = {
            "techniqueDependencyCount": len(tq), "cookingStepsEngineDependencyCount": len(csdeps),
            "candidateOnlyCapabilities": m["candidateCapabilities"],
            "pr295Class": cs[eid]["class"], "singleSauce": len(r["sauce"]["spreadLayers"]) == 1,
            "requiresTechnique": False,
            "cut": ("CUT (existing allowlist rule; data)" if authoring.get("cut") == "CUT" or authoring.get("cutCandidate") in ("STANDARD_6",) else "NO_CUT (data allowlist opt-out; OD-W2-4)"),
            "maxVisibleTabs": 3 + (1 if sauces else 0) + (1 if cheeses else 0) + (1 if (authoring.get("cut") == "CUT" or authoring.get("cutCandidate") == "STANDARD_6") else 0),  # DOUGH + TOPPING + BAKE (+ SAUCE, CHEESE, CUT)
        }
        assert engine["singleSauce"] and engine["maxVisibleTabs"] <= 6, (eid, engine)

        # ---- lanes -------------------------------------------------------------------------
        missing = {}
        missing["H"] = "key topping and sub order are not authority (Owner choice among %d valid assignments)" % hint["validRoleAssignmentsUnderG17"]
        if not cheeses:
            missing["N"] = "no cheese: the CHEESE rung is empty (RESERVED) until OD-H5-P4-CHEESE is decided and implemented"
        if tax_missing:
            missing["T"] = f"no production family or approved row: {tax_missing}"
        ing_missing = [i for i, s in ingredient_authoring.items() if s.startswith("MISSING")] + \
                      [x["id"] for x in sauce_status if x["profile"].startswith("MISSING")]
        if ing_missing:
            missing["I"] = f"no approved authoring row: {sorted(set(ing_missing))}"
        if authoring["status"].startswith("MISSING"):
            missing["R"] = "recipe authoring values are not decided"
        if progression["status"] == "NO_APPROVED_WAVE":
            missing["P"] = "no approved wave / ladder placement"
        if eid in OPEN_REVIEW:
            missing["O"] = OPEN_REVIEW[eid]
        pending = []
        uses_w2a1_rows = sorted(i for i in ids if i in w2_ing and i not in prod_ing)
        if uses_w2a1_rows:
            pending.append(f"W2-A1 must land on main first: this recipe uses its ingredient rows {uses_w2a1_rows}"
                           + (f" and its approved family rows for {tax_pending_merge}" if tax_pending_merge else "")
                           + " (the W2-A1 branch has no PR)")
        if is_w2a:
            pending.append("W2-A2 (recipes + ladder append + references) is not implemented")

        families = sorted({FAMILY_OF_LANE[k] for k in missing})
        if not families:
            group = "B0"
        elif families == ["Hint 5.0"]:
            group = "B1"
        elif families == ["Taxonomy"]:
            group = "B2"
        elif families == ["Owner recipe authority"]:
            group = "B3"
        else:
            group = "B4a" if len(families) == 2 else "B4b"

        # ---- minimum conditions ------------------------------------------------------------
        minimum = ["OD-DA1-1: the Owner authors hintKeyToppingId and hintSubToppingOrder for this recipe (G17: key in the recipe's toppings; order = the other toppings)"]
        if "N" in missing:
            minimum.append("OD-DA1-2: OD-H5-P4-CHEESE decided and implemented, or the Hint 5.0 flag stays OFF for this recipe's release")
        if "T" in missing:
            minimum.append(f"OD-DA1-8: the Taxonomy / HCG lane approves a family row for {tax_missing}")
        if "I" in missing:
            minimum.append(f"OD-DA1-3: an Authoring Gate approves the art / colour / category / profile rows for {sorted(set(ing_missing))}")
        if "R" in missing:
            minimum.append("OD-DA1-4: an Authoring Gate approves name, description, minCount, bakeTarget and reference values")
        if "P" in missing:
            minimum.append("OD-DA1-5: the Owner assigns an approved wave (append per LAD-1)")
        if "O" in missing:
            minimum.append("OD-DA1-6: the Owner resolves the open review item")
        for p in pending:
            minimum.append("implementation state: " + p)

        out_rows.append({
            "recipeId": eid,
            "canonicalName": {"nameJa": r["canonicalName"]["nameJa"], "status": authoring.get("status", "")[:8] == "APPROVED" and "APPROVED_OWNER (A4)" or "CANDIDATE (PIZZA DB evidence name)"},
            "w2a": is_w2a,
            "catalogRelation": relation,
            "canonicalIngredientIds": ids,
            "newIngredientIds": new_ids,
            "ingredientAuthoring": ingredient_authoring,
            "sauceAuthority": sauce_status,
            "cheeseAuthority": cheese_status,
            "toppingAuthority": tax,
            "taxonomy": {"missingFamilyRows": tax_missing, "approvedOnBranchPendingMerge": tax_pending_merge, "hcgWatch": hcg_watch,
                         "hcgSensitive": bool(tax_missing or hcg_watch),
                         "missingRowsQueuedInHcgPack": sorted(set(tax_missing) & hcg_items),
                         "missingRowsNotQueuedInHcgPack": sorted(set(tax_missing) - hcg_items),
                         "watchIdsInHcgDecisionList": sorted(set(hcg_watch) & hcg_decision_items)},
            "hint5": hint,
            "recipeAuthoring": authoring,
            "progression": progression,
            "engine": engine,
            "coveredReviewItems": COVERED_BY_OD_W2_7.get(eid),
            "lanesMissing": missing,
            "usesUnmergedW2A1Rows": uses_w2a1_rows,
            "implementationPending": pending,
            "lanesMissingFamilies": families,
            "group": group,
            "minimumConditions": minimum,
        })

    return {
        "schemaNote": ("172 Recipe DA-1 Preparation Audit. Docs/data/tools only. NOT a production authority; DA-1 is not "
                       "implemented. Consumer of the Authority Matrix, Hint 5.0, Wave 2, taxonomy and Cooking Steps / Technique "
                       "authorities. Candidates are labelled CANDIDATE and are never used as authority."),
        "generatedBy": "tools/recipe172_da1_preparation.py",
        "auditedMainSha": main_sha,
        "pins": {k: {"sha": v[0], "ref": v[1]} for k, v in PINS.items()},
        "lanes": {k: {"family": v[0], "meaning": v[1]} for k, v in LANES.items()},
        "groupDefinitions": CLASS_LABELS,
        "summary": summarize(out_rows),
        "recipes": out_rows,
    }


def summarize(rows):
    s = {"b": len(rows), "w2a": sum(1 for r in rows if r["w2a"])}
    s["groups"] = dict(sorted(Counter(r["group"] for r in rows).items()))
    s["groupMembers"] = {g: [r["recipeId"] for r in rows if r["group"] == g] for g in sorted({r["group"] for r in rows})}
    s["w2aMembers"] = [r["recipeId"] for r in rows if r["w2a"]]
    s["lanesMissingCounts"] = {k: sum(1 for r in rows if k in r["lanesMissing"]) for k in LANES}
    s["lanesMissingCountsW2A"] = {k: sum(1 for r in rows if r["w2a"] and k in r["lanesMissing"]) for k in LANES}
    s["hint5"] = {
        "keyAuthorityExists": 0,
        "keyAuthorityMissingOrCandidate": len(rows),
        "candidateOnly": sum(1 for r in rows if r["hint5"]["keyToppingAuthority"] == "CANDIDATE_ONLY"),
        "noCandidate_ownerChoice": sum(1 for r in rows if r["hint5"]["keyToppingAuthority"] == "MISSING"),
        "candidateBasis": dict(sorted(Counter(r["hint5"]["keyCandidateBasis"] for r in rows).items())),
        "forcedByG17": sum(1 for r in rows if r["hint5"]["forcedByG17"]),
        "candidateIsAromaFamily": sum(1 for r in rows if r["hint5"]["c1p"]["candidateIsAromaFamily"]),
        "noCheeseP4Cheese": [r["recipeId"] for r in rows if "N" in r["lanesMissing"]],
        "hint5Ready": 0,
    }
    s["taxonomy"] = {
        "rowsWithMissingFamily": [r["recipeId"] for r in rows if r["taxonomy"]["missingFamilyRows"]],
        "rowsDependingOnBranchRows": [r["recipeId"] for r in rows if r["taxonomy"]["approvedOnBranchPendingMerge"]],
        "rowsWithHcgWatch": {r["recipeId"]: r["taxonomy"]["hcgWatch"] for r in rows if r["taxonomy"]["hcgWatch"]},
        "rowsWithNoTaxonomyDependencyOnOpenHcg": [r["recipeId"] for r in rows if not r["taxonomy"]["hcgSensitive"]],
    }
    s["hcgPack"] = {
        "queuedItems": sorted({i for r in rows for i in r["taxonomy"]["missingRowsQueuedInHcgPack"]}),
        "missingIdsNotQueued": sorted({i for r in rows for i in r["taxonomy"]["missingRowsNotQueuedInHcgPack"]}),
        "watchIdsInDecisionList": sorted({i for r in rows for i in r["taxonomy"]["watchIdsInHcgDecisionList"]}),
    }
    s["noDependencyOnUnmergedW2A1"] = [r["recipeId"] for r in rows if not r["usesUnmergedW2A1Rows"]]
    s["ownerRecipeAuthority"] = {
        "missing": [r["recipeId"] for r in rows if any(k in r["lanesMissing"] for k in ("I", "R", "P", "O"))],
        "openReviewItem": [r["recipeId"] for r in rows if "O" in r["lanesMissing"]],
    }
    s["engine"] = {
        "techniqueDependencyRows": sum(1 for r in rows if r["engine"]["techniqueDependencyCount"]),
        "cookingStepsEngineDependencyRows": sum(1 for r in rows if r["engine"]["cookingStepsEngineDependencyCount"]),
        "candidateOnlyCapabilityRows": sum(1 for r in rows if r["engine"]["candidateOnlyCapabilities"]),
        "pr295Class": dict(sorted(Counter(r["engine"]["pr295Class"] for r in rows).items())),
        "maxVisibleTabs": max(r["engine"]["maxVisibleTabs"] for r in rows),
    }
    # After the Taxonomy / HCG lane completes, which rows have no other lane family missing than Hint 5.0?
    after_hcg = [r["recipeId"] for r in rows if set(r["lanesMissingFamilies"]) - {"Taxonomy"} <= {"Hint 5.0"}]
    s["afterTaxonomyHcgComplete"] = {
        "rowsWhoseOnlyRemainingFamilyIsHint5": after_hcg,
        "rowsUnlockedByHcgAlone": [r["recipeId"] for r in rows if r["lanesMissingFamilies"] == ["Taxonomy"]],
        "rowsWhoseTaxonomyBlockerIsTheirLastTaxonomyItem": [r["recipeId"] for r in rows if "T" in r["lanesMissing"]],
        "hcgInsensitiveAmongThem": [x for x in after_hcg if not next(r for r in rows if r["recipeId"] == x)["taxonomy"]["hcgSensitive"]],
        "hcgSensitiveAmongThem": {x: next(r for r in rows if r["recipeId"] == x)["taxonomy"]["hcgWatch"]
                                  for x in after_hcg if next(r for r in rows if r["recipeId"] == x)["taxonomy"]["hcgSensitive"]},
    }
    return s


if __name__ == "__main__":
    main()
