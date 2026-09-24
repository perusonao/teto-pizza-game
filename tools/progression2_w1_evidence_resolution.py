#!/usr/bin/env python3
"""
Progression 2.0 -- W1 Content Evidence Resolution (docs/data-only tooling, NOT wired into CI).

Resolves, as far as repository evidence allows, the W1 content-evidence ledger entries left open
by PR #221 (read-only input, OPEN / Final Gate) against the PR #220 W1 authority:

  REC-06 / REC-07 / REC-09  -- PIZZA DB token オリーブ -> black-olive (likely_alias)
  REC-10                    -- PIZZA DB token パルミジャーノチーズ -> parmigiano (likely_alias)
  REC-08                    -- eggplant-family discovery regression (Parmigiana / Melanzane)
  ING-02/03/07/08/09/10/11  -- visual evidence requirements for the 7 new W1 ingredients

Evidence classes are kept separate on purpose:
  PIZZA_DB_EVIDENCE    -- docs/reports/data/TETO_PIZZADB_172_MASTER-EVIDENCE.json (owner-relayed)
  EXISTING_CATALOG     -- data/recipes/ingredient_master_catalog.json + the merged canonicalizer
  PRODUCTION_DATA      -- src/** (imported read-only through tools/w1_discovery_regression_probe.mjs)
  PR_221_CANDIDATE     -- authoring candidates in PR #221 (not evidence, not production)

Nothing here promotes a likely_alias to canonical, edits recipe quantities, touches src/**, e2e/**
or any PR branch, or marks a visual item PASS. Device-level visual checks are always
HUMAN_VERIFICATION_REQUIRED.

Usage:
  python3 tools/progression2_w1_evidence_resolution.py          # regenerate outputs
  python3 tools/progression2_w1_evidence_resolution.py --check  # regenerate in memory, diff, exit 1 on drift
"""
import argparse
import hashlib
import json
import subprocess
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import progression2_ingredient_canonicalizer as canon  # noqa: E402  (merged tool, read-only use)

MAIN_SHA = "dff233c042d2df6ee1c3a92f2d2419830aa05460"
PR220_SHA = "e49dab96bd9b26dc0f520349cf09d1160c3519f5"
PR221_SHA = "d028844e3a848ebf53cbc45d745784b7695dedf2"

PR220_WAVES = "docs/reports/data/TETO_PROGRESS2_CONTENT_READINESS_WAVES.json"
PR221_RECIPES = "docs/reports/data/TETO_PROGRESS2_W1_RECIPE_AUTHORING_MATRIX.json"
PR221_INGREDIENTS = "docs/reports/data/TETO_PROGRESS2_W1_INGREDIENT_AUTHORING_MATRIX.json"
PR221_LEDGER = "docs/reports/data/TETO_PROGRESS2_W1_UNRESOLVED_EVIDENCE_LEDGER.json"
MASTER_EVIDENCE = "docs/reports/data/TETO_PIZZADB_172_MASTER-EVIDENCE.json"
INGREDIENT_CATALOG = "data/recipes/ingredient_master_catalog.json"
# Files read from the working tree; they must be byte-identical to MAIN_SHA or the run fails.
MAIN_PINNED_PATHS = [
    MASTER_EVIDENCE,
    INGREDIENT_CATALOG,
    "tools/progression2_ingredient_canonicalizer.py",
    "src/data/ingredients.ts",
    "src/data/recipes.ts",
    "src/data/discoveryCatalog.ts",
    "src/logic/discovery/matcher.ts",
    "src/logic/discovery/signature.ts",
    "src/components/IngredientPieceVisual.tsx",
    "src/logic/pizzaReferenceLayout.ts",
]

OUT_DIR = ROOT / "docs/reports/data"
OUT_LEDGER = "TETO_PROGRESS2_W1_EVIDENCE_RESOLUTION_LEDGER.json"
OUT_PROVENANCE = "TETO_PROGRESS2_W1_TOKEN_PROVENANCE.json"
OUT_DISCOVERY = "TETO_PROGRESS2_W1_DISCOVERY_REGRESSION_FIXTURES.json"
OUT_VISUAL = "TETO_PROGRESS2_W1_VISUAL_EVIDENCE_REQUIREMENTS.json"

EXPECTED_W1 = [
    "new-haven-apizza", "hawaiian", "parmigiana-pizza", "bambino", "pizza-portuguesa",
    "puttanesca-pizza", "pesto-caprese", "pesto-tonno", "pesto-patate", "melanzane-pizza",
]
EXPECTED_NEW_INGREDIENTS = ["capers", "clam", "corn", "eggplant", "fresh-tomato", "pineapple", "potato"]
ALIAS_LEDGER = {"REC-06": "pizza-portuguesa", "REC-07": "puttanesca-pizza", "REC-09": "pesto-tonno", "REC-10": "parmigiana-pizza"}
VISUAL_LEDGER = {
    "ING-02": "capers", "ING-03": "eggplant", "ING-07": "clam", "ING-08": "corn",
    "ING-09": "fresh-tomato", "ING-10": "pineapple", "ING-11": "potato",
}
# Glyph the task brief refers to for clam; recorded next to PR #221's candidate, never chosen here.
BRIEF_CLAM_GLYPH = "\U0001F41A"
STRICT_GLYPH_ITEMS = {"fresh-tomato", "eggplant", "clam", "capers"}


def fail(msg):
    print(f"FAIL: {msg}", file=sys.stderr)
    sys.exit(1)


def git(*args, binary=False):
    r = subprocess.run(["git", *args], cwd=ROOT, capture_output=True)
    if r.returncode != 0:
        fail(f"git {' '.join(args)}: {r.stderr.decode(errors='replace').strip()}")
    return r.stdout if binary else r.stdout.decode()


def blob(sha, path):
    raw = git("show", f"{sha}:{path}", binary=True)
    return json.loads(raw), hashlib.sha256(raw).hexdigest()


def sha256_file(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()


def verify_pins():
    for sha in (MAIN_SHA, PR220_SHA, PR221_SHA):
        if subprocess.run(["git", "cat-file", "-e", f"{sha}^{{commit}}"], cwd=ROOT).returncode != 0:
            fail(f"commit {sha} not available locally; fetch main and refs/pull/220/head, refs/pull/221/head")
    for path in MAIN_PINNED_PATHS:
        if git("diff", "--name-only", MAIN_SHA, "--", path).strip():
            fail(f"{path} differs from pinned main {MAIN_SHA[:7]}; re-audit instead of silently passing")
        if git("ls-tree", MAIN_SHA, "--", path).strip() == "":
            fail(f"{path} missing at {MAIN_SHA[:7]}")


def load_inputs():
    waves, waves_hash = blob(PR220_SHA, PR220_WAVES)
    recipes, recipes_hash = blob(PR221_SHA, PR221_RECIPES)
    ingredients, ingredients_hash = blob(PR221_SHA, PR221_INGREDIENTS)
    ledger, ledger_hash = blob(PR221_SHA, PR221_LEDGER)
    master = json.loads((ROOT / MASTER_EVIDENCE).read_text(encoding="utf-8"))
    catalog = json.loads((ROOT / INGREDIENT_CATALOG).read_text(encoding="utf-8"))

    w1_rows = [r for r in waves["rows"] if r.get("wave") == "W1"]
    w1_wave = next(w for w in waves["waves"] if w["wave"] == "W1")
    if sorted(r["canonicalCandidateId"] for r in w1_rows) != sorted(EXPECTED_W1):
        fail("PR #220 W1 recipe set drifted from the expected 10")
    if sorted(w1_wave["newIngredientIds"]) != EXPECTED_NEW_INGREDIENTS:
        fail("PR #220 W1 newIngredientIds drifted")
    if sorted(r["recipeIdCandidate"] for r in recipes["rows"]) != sorted(EXPECTED_W1):
        fail("PR #221 recipe matrix does not carry the #220 W1 set")
    if recipes["authorityRef"]["headSha"] != PR220_SHA:
        fail("PR #221 recipe matrix is not synced to the pinned #220 authority")
    ledger_ids = {row["id"] for row in ledger["rows"]}
    for needed in [*ALIAS_LEDGER, "REC-08", *VISUAL_LEDGER, "RT-01", "REC-01", "REC-02", "REC-03", "REC-04", "REC-11"]:
        if needed not in ledger_ids:
            fail(f"PR #221 ledger lacks {needed}")

    inputs = {
        "pr220": {"headSha": PR220_SHA, "path": PR220_WAVES, "blobSha256": waves_hash},
        "pr221": {
            "headSha": PR221_SHA,
            "state": "OPEN (Final Gate) -- read-only input, not modified",
            "files": {PR221_RECIPES: recipes_hash, PR221_INGREDIENTS: ingredients_hash, PR221_LEDGER: ledger_hash},
        },
        "main": {"sha": MAIN_SHA, "files": {p: sha256_file(p) for p in MAIN_PINNED_PATHS}},
    }
    return w1_rows, recipes, ingredients, ledger, master, catalog, inputs


def run_probe(payload):
    cmd = ["node", "--experimental-strip-types", "--no-warnings", "--import",
           "./tools/lib/register_ts_loader.mjs", "tools/w1_discovery_regression_probe.mjs"]
    r = subprocess.run(cmd, cwd=ROOT, input=json.dumps(payload).encode(), capture_output=True)
    if r.returncode != 0:
        fail(f"discovery probe failed: {r.stderr.decode(errors='replace')[-2000:]}")
    return json.loads(r.stdout)


def glyph_name(ch):
    return " + ".join(unicodedata.name(c, f"U+{ord(c):04X}") for c in ch if c not in "️")


# ---------------------------------------------------------------- token provenance

def classify_row(row, exact_names):
    if row.get("ingredientsJa"):
        tokens = []
        for tok in row["ingredientsJa"]:
            c = canon.classify(tok, exact_names)
            tokens.append({"token": tok, "disposition": c["disposition"], "canonicalId": c.get("canonicalId"),
                           "rule": c.get("rule")})
        return {"tokenSource": "ingredientsJa", "tokens": tokens}
    return {
        "tokenSource": "ingredientsCanonical_only",
        "note": "Phase 0B original relay recorded canonical ids only (no Japanese token); nothing to re-classify.",
        "canonicalIds": row.get("ingredientsCanonical") or [],
    }


def build_provenance(w1_rows, recipes, master, catalog):
    exact_names = canon.load_canonical_names()
    by_id = {r["id"]: r for r in master["recipeRows"]}
    matrix = {r["recipeIdCandidate"]: r for r in recipes["rows"]}
    cat = {i["id"]: i for i in catalog["ingredients"]}

    per_recipe = []
    for row in sorted(w1_rows, key=lambda r: EXPECTED_W1.index(r["canonicalCandidateId"])):
        rid = row["canonicalCandidateId"]
        ev = by_id[row["evidenceId"]]
        cls = classify_row(ev, exact_names)
        likely = [t for t in cls.get("tokens", []) if t["disposition"] == "likely_alias"]
        other = [t for t in cls.get("tokens", []) if t["disposition"] not in ("exact_alias", "likely_alias", "genuinely_new")]
        per_recipe.append({
            "recipeIdCandidate": rid,
            "evidenceId": row["evidenceId"],
            "pizzaDbSourceUrl": ev.get("sourceUrl"),
            "pizzaDbSauceFamily": ev.get("sauceFamily"),
            "pizzaDbEvidenceOrigin": ev.get("evidenceOrigin"),
            "pizzaDbVerifiedAt": ev.get("verifiedAt"),
            **cls,
            "likelyAliasTokens": [f"{t['token']}->{t['canonicalId']}" for t in likely],
            "nonExactNonLikelyTokens": other,
            "pr221IdentityIngredients": [x["ingredientId"] for x in matrix[rid]["requiredIngredients"]],
            "pr221DescriptionCandidate": matrix[rid]["descriptionCandidate"],
        })

    # Olive census over the whole PIZZA DB population (not only W1).
    olive_rows, olive_color_tokens = [], []
    for r in master["recipeRows"]:
        for tok in r.get("ingredientsJa") or []:
            if "オリーブ" in tok and tok != "オリーブオイル":
                (olive_rows if tok == "オリーブ" else olive_color_tokens).append({"rowId": r["id"], "token": tok})
    canonical_only_black = [r["id"] for r in master["recipeRows"]
                            if not r.get("ingredientsJa") and "black-olive" in (r.get("ingredientsCanonical") or [])]
    olive_ids_in_catalog = sorted(i["id"] for i in catalog["ingredients"] if "olive" in i["id"])

    parm_rows = [r["id"] for r in master["recipeRows"] if "パルミジャーノチーズ" in (r.get("ingredientsJa") or [])]
    suffix_precedent = {k: v for k, v in canon.ORTHOGRAPHIC_EQUIVALENTS.items() if k.endswith("チーズ")}
    suffix_likely = {k: v[0] for k, v in canon.LIKELY_ALIAS_TABLE.items() if k.endswith("チーズ")}
    parm_family = sorted(i["id"] for i in catalog["ingredients"]
                         if i["id"] in ("parmigiano", "grana-padano", "pecorino") or "パルミ" in i["nameJa"])

    # Eggplant family census (PIZZA DB rows containing ナス), classified token by token.
    eggplant_family = []
    for r in master["recipeRows"]:
        if "ナス" in (r.get("ingredientsJa") or []):
            toks = [canon.classify(t, exact_names) for t in r["ingredientsJa"]]
            ids = sorted({t.get("canonicalId") or f"UNRESOLVED:{tok}" for t, tok in zip(toks, r["ingredientsJa"])})
            eggplant_family.append({"rowId": r["id"], "nameJa": r["nameJa"], "sauceFamily": r["sauceFamily"],
                                    "tokenIds": ids, "inW1": r["id"] in {x["evidenceId"] for x in w1_rows}})

    new_ing_identity = {}
    for pr in per_recipe:
        for t in pr.get("tokens", []):
            if t["canonicalId"] in EXPECTED_NEW_INGREDIENTS:
                new_ing_identity.setdefault(t["canonicalId"], set()).add(f"{t['token']}:{t['disposition']}:{t['rule']}")
        for cid in pr.get("canonicalIds", []):
            if cid in EXPECTED_NEW_INGREDIENTS:
                new_ing_identity.setdefault(cid, set()).add(f"(canonical-at-relay):{pr['evidenceId']}")

    return {
        "schemaVersion": 1,
        "kind": "w1_token_provenance",
        "evidenceClasses": {
            "PIZZA_DB_EVIDENCE": MASTER_EVIDENCE,
            "EXISTING_CATALOG": [INGREDIENT_CATALOG, "tools/progression2_ingredient_canonicalizer.py"],
            "PRODUCTION_DATA": "src/** (read-only)",
            "PR_221_CANDIDATE": PR221_RECIPES,
        },
        "externalFetchThisSession": "EGRESS_BLOCKED (pizzadb.jp CONNECT 403 via environment network policy, 2026-09-24); no new PIZZA DB evidence added",
        "recipes": per_recipe,
        "w1LikelyAliasTokens": sorted({a for p in per_recipe for a in p["likelyAliasTokens"]}),
        "newIngredientIdentityEvidence": {k: sorted(v) for k, v in sorted(new_ing_identity.items())},
        "oliveCensus": {
            "pizzaDbRowsWithPlainOliveToken": len({x["rowId"] for x in olive_rows}),
            "pizzaDbRowsWithPlainOliveTokenIds": sorted({x["rowId"] for x in olive_rows}),
            "pizzaDbColorSpecifiedOliveTokens": olive_color_tokens,
            "pizzaDbRowsCanonicalBlackOliveWithoutJaToken": canonical_only_black,
            "existingCatalogOliveIds": olive_ids_in_catalog,
            "finding": ("PIZZA DB ingredient columns use a single plain token オリーブ (distinct from オリーブオイル) and never a "
                        "color/variety-specified olive token; the Phase 0B rows that carry canonical black-olive recorded no "
                        "Japanese token, so they cannot show how the source spelled it. Olive colour is therefore not "
                        "determinable from PIZZA DB evidence. black-olive is the existing catalog's only olive-type topping "
                        "(EXISTING_CATALOG), not a PIZZA DB fact."),
        },
        "parmigianoCensus": {
            "pizzaDbRowsWithToken": parm_rows,
            "existingCatalogParmigiano": {k: cat["parmigiano"][k] for k in ("id", "nameJa", "nameOriginal", "aliases", "existingInGame")},
            "catalogHardCheeseIds": parm_family,
            "canonicalizerChiizuSuffixAsOrthographicExact": suffix_precedent,
            "canonicalizerChiizuSuffixAsLikelyAlias": suffix_likely,
            "finding": ("Token = the catalog nameJa パルミジャーノ + the generic suffix チーズ; no other catalog id has a competing "
                        "claim (grana-padano / pecorino are separate names). The merged canonicalizer treats the same pattern "
                        "as orthographic exact for モッツァレラチーズ but as likely_alias for パルミジャーノチーズ and other cheeses, "
                        "so the likely_alias label reflects table placement, not a competing identity. Moving it is a "
                        "canonicalizer-table review decision and is NOT applied here."),
        },
        "eggplantFamilyCensus": eggplant_family,
    }


# ---------------------------------------------------------------- discovery regression (REC-08)

def build_discovery(recipes, ingredients):
    w1 = [{"id": r["recipeIdCandidate"], "ingredients": [x["ingredientId"] for x in r["requiredIngredients"]]}
          for r in recipes["rows"]]
    w1.sort(key=lambda r: EXPECTED_W1.index(r["id"]))
    cats = {r["id"]: r["categoryCandidate"] for r in ingredients["rows"]}
    base = run_probe({"w1": w1, "extraIngredientCategories": cats})
    prod = {i["id"]: i for i in base["productionIngredients"]}
    emoji = {i["id"]: i["emoji"] for i in base["productionIngredients"]}
    emoji.update({r["id"]: r["emojiCandidate"] for r in ingredients["rows"]})
    category = {i: prod[i]["category"] for i in prod}
    category.update(cats)

    # Same-glyph substitutions: a non-cheese, non-sauce piece swapped for another topping that renders
    # the identical emoji (IngredientPieceVisual renders only the emoji for non-cheese ingredients).
    scenarios = []
    for r in w1:
        for ing in r["ingredients"]:
            if category.get(ing) != "topping":
                continue
            for other, glyph in sorted(emoji.items()):
                if other != ing and glyph == emoji[ing] and category.get(other) == "topping":
                    swapped = [other if x == ing else x for x in r["ingredients"]]
                    scenarios.append({"id": f"{r['id']}:{ing}->{other}", "recipe": r["id"], "swap": [ing, other],
                                      "glyph": glyph, "ingredients": swapped})
    res = run_probe({"w1": w1, "extraIngredientCategories": cats, "extraScenarios": scenarios})

    egg = {"parmigiana-pizza", "melanzane-pizza"}
    egg_adj = [a for a in res["oneEditAdjacency"] if a["from"].removeprefix("w1:") in egg]
    egg_rev = [a for a in res["reverseAdjacency"] if a["outcome"]["targetId"].removeprefix("w1:") in egg]
    checks = {
        "catalogSize": res["catalogSize"],
        "signatureCollisionCount": len(res["signatureCollisions"]),
        "allW1ExactUniqueSelfMatch": all(e["outcome"] == {"kind": "UNIQUE_MATCH", "targetId": e["targetId"]} for e in res["exact"]),
        "ambiguousOutcomesInOneEditNeighbourhood": [a for a in res["oneEditAdjacency"] if a["outcome"]["kind"] == "AMBIGUOUS"],
    }
    if checks["signatureCollisionCount"] or not checks["allW1ExactUniqueSelfMatch"]:
        fail(f"discovery regression failed: {checks}")
    return {
        "schemaVersion": 1,
        "kind": "w1_discovery_regression_fixtures",
        "evidenceClass": "PRODUCTION_DATA (matcher executed read-only) + PR_221_CANDIDATE (W1 ingredient sets)",
        "matcher": "src/logic/discovery/matcher.ts matchDiscovery (exact ingredient set + sauce base + identity dimensions)",
        "catalog": "RECIPE_DISCOVERY_CATALOG (15 production) + 10 W1 candidate targets built the same way as src/data/discoveryCatalog.ts",
        "checks": checks,
        "exactMatches": res["exact"],
        "rec08EggplantFamily": {
            "parmigianaItems": next(e["items"] for e in res["exact"] if e["targetId"] == "w1:parmigiana-pizza"),
            "melanzaneItems": next(e["items"] for e in res["exact"] if e["targetId"] == "w1:melanzane-pizza"),
            "relation": "melanzane-pizza is a strict subset of parmigiana-pizza (differs by parmigiano only); signatures are distinct under exact matching",
            "oneEditAdjacency": egg_adj,
            "reverseAdjacencyFromProduction": egg_rev,
            "portableTestCases": [
                {"pizza": e["items"], "expect": e["outcome"]} for e in res["exact"] if e["targetId"].removeprefix("w1:") in egg
            ] + [{"pizza": a["ingredients"], "from": a["from"], "edit": a["edit"], "expect": a["outcome"]} for a in egg_adj + egg_rev],
        },
        "oneEditAdjacencyAllW1": res["oneEditAdjacency"],
        "reverseAdjacencyAllW1": res["reverseAdjacency"],
        "sameGlyphSubstitutionScenarios": res["extraScenarios"],
        "_emoji": emoji,
        "_category": category,
        "_productionIngredients": base["productionIngredients"],
    }


# ---------------------------------------------------------------- visual evidence requirements

def build_visual(ingredients, discovery, recipes):
    emoji, category = discovery.pop("_emoji"), discovery.pop("_category")
    prod = {i["id"]: i for i in discovery.pop("_productionIngredients")}
    rows = {r["id"]: r for r in ingredients["rows"]}
    matrix = {r["recipeIdCandidate"]: r for r in recipes["rows"]}
    subs = discovery["sameGlyphSubstitutionScenarios"]
    circle_family = sorted(i for i, e in emoji.items() if "CIRCLE" in glyph_name(e))

    out = []
    for ledger_id, ing in sorted(VISUAL_LEDGER.items(), key=lambda kv: kv[1]):
        r = rows[ing]
        glyph = r["emojiCandidate"]
        shared = sorted(o for o, e in emoji.items() if e == glyph and o != ing)
        cohabit = sorted({x["ingredientId"] for rid in r["recipesUsingItInCandidateSet"]
                          for x in matrix[rid]["requiredIngredients"] if x["ingredientId"] != ing})
        item = {
            "ledgerId": ledger_id,
            "ingredientId": ing,
            "pr221Candidate": {"displayName": r["displayName"], "emoji": glyph, "unicodeName": glyph_name(glyph),
                               "color": r["colorCandidate"], "category": r["categoryCandidate"]},
            "recipes": r["recipesUsingItInCandidateSet"],
            "renderPath": "IngredientPieceVisual emoji branch (non-cheese): the glyph alone identifies the piece on the pizza, tray, reference and thumbnails; `color` is not drawn for the piece",
            "staticFindings": {
                "sameGlyphIngredients": [{"id": o, "category": category.get(o), "source": "PRODUCTION_DATA" if o in prod else "PR_221_CANDIDATE"} for o in shared],
                "sameGlyphSubstitutionOutcomes": [s for s in subs if ing in s["swap"]],
                "coPlacedIngredients": [{"id": o, "emoji": emoji.get(o), "category": category.get(o)} for o in cohabit],
                "plainCircleGlyphFamily": circle_family if ing in circle_family or "CIRCLE" in glyph_name(glyph) else [],
            },
            "verdict": "HUMAN_VERIFICATION_REQUIRED",
            "verdictNote": "Static analysis cannot show device rendering (iOS emoji font, 390x844 scale, bake tint). Not PASS.",
        }
        if ing == "clam":
            item["staticFindings"]["glyphCandidatesOnRecord"] = [
                {"emoji": glyph, "unicodeName": glyph_name(glyph), "source": "PR #221 ingredient matrix emojiCandidate"},
                {"emoji": BRIEF_CLAM_GLYPH, "unicodeName": glyph_name(BRIEF_CLAM_GLYPH), "source": "W1 evidence-resolution task brief (clam 🐚 visibility)"},
            ]
            item["staticFindings"]["note"] = ("Neither glyph is a clam: PR #221 proposes OYSTER, the brief names SPIRAL SHELL. "
                                              "Which glyph is authored is an Owner Decision; both need the device check.")
        out.append(item)

    focus = {
        "fresh-tomato": "🍅 collision: identical glyph to production cherry-tomato (placed piece) and tomato-sauce (tray chip). Verify a player can tell fresh-tomato from cherry-tomato on tray and pizza; a cherry-tomato Pesto Caprese renders identically but discovers nothing (see sameGlyphSubstitutionOutcomes).",
        "eggplant": "🍆 visibility: dark-purple glyph on tomato-sauce red and after bake roast tint; verify it stays identifiable at piece size on 390x844 and in reference/thumbnail.",
        "clam": "clam visibility: pale shell glyph (🦪 candidate / 🐚 in brief) on olive-oil base with parmigiano and garlic 🧄 (also pale); verify it reads as shellfish, not as garlic or cheese.",
        "capers": "🟢 distinguishability: plain LARGE GREEN CIRCLE beside ⚫ black-olive in Puttanesca and 🔴 pepperoni in the tray -- hue is the only cue (red/green colour-vision risk); verify on device, including a greyscale/CVD pass.",
    }
    return {
        "schemaVersion": 1,
        "kind": "w1_visual_evidence_requirements",
        "policy": "docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md (390x844 authority viewport, video delivered directly, never committed)",
        "prerequisite": "A Preview build that actually contains the candidate ingredient rows (future slice B). Device verification cannot be performed from docs; no verdict here is PASS.",
        "explicitFocus": {k: {"verdict": "HUMAN_VERIFICATION_REQUIRED", "check": v} for k, v in focus.items()},
        "checkContextsPerIngredient": [
            "Ingredient tray chip (390x844, iPhone Safari)",
            "Placed piece on the recipe's sauce + cheese before bake",
            "Same piece after bake (toppingVisualFrame roast tint)",
            "Reference ring / ReferenceThumbnail",
            "RESULT / Dex thumbnail",
            "Side-by-side with every sameGlyph / coPlaced ingredient listed for it",
        ],
        "ingredients": out,
    }


# ---------------------------------------------------------------- resolution ledger

def build_ledger(ledger, recipes, provenance, discovery, visual, inputs):
    olive = provenance["oliveCensus"]
    rows = []
    for row in ledger["rows"]:
        rid = row["id"]
        entry = {"id": rid, "scope": row["scope"], "pr221Status": row["status"], "field": row["field"]}
        if rid in ("REC-06", "REC-07", "REC-09"):
            recipe = ALIAS_LEDGER[rid]
            desc = next(r["descriptionCandidate"] for r in recipes["rows"] if r["recipeIdCandidate"] == recipe)
            entry.update({
                "resolution": "UNRESOLVED",
                "resolutionStatus": "EVIDENCE_EXHAUSTED_OWNER_DECISION_REQUIRED",
                "evidence": {
                    "PIZZA_DB_EVIDENCE": f"token オリーブ (plain); {olive['pizzaDbRowsWithPlainOliveToken']} PIZZA DB rows use the plain token, {len(olive['pizzaDbColorSpecifiedOliveTokens'])} use a colour-specified olive token",
                    "EXISTING_CATALOG": f"likely_alias -> black-olive (LIKELY_ALIAS_TABLE); catalog olive ids = {olive['existingCatalogOliveIds']}",
                    "PRODUCTION_DATA": "black-olive shipped (nameJa ブラックオリーブ, ⚫)",
                    "PR_221_CANDIDATE": f"description asserts ブラックオリーブ: {'ブラックオリーブ' in desc}",
                },
                "whyNotResolved": "Olive colour/variety is not stated by PIZZA DB and pizzadb.jp is unreachable from this environment; mapping to black-olive is a catalog convenience, not evidence.",
                "ownerDecision": "OD-OLIVE (shared by REC-06/07/09)",
                "stillOpen": True,
            })
        elif rid == "REC-10":
            entry.update({
                "resolution": "UNRESOLVED",
                "resolutionStatus": "EVIDENCE_SUPPORTS_IDENTITY_RECLASSIFICATION_REVIEW_REQUIRED",
                "evidence": {
                    "PIZZA_DB_EVIDENCE": f"token パルミジャーノチーズ in {provenance['parmigianoCensus']['pizzaDbRowsWithToken']}",
                    "EXISTING_CATALOG": "parmigiano nameJa パルミジャーノ; LIKELY_ALIAS_TABLE entry justified as 'チーズ suffix variant'; same pattern for モッツァレラチーズ is ORTHOGRAPHIC (exact)",
                    "PRODUCTION_DATA": "parmigiano shipped (cheese, dedicated .pizza-cheese--parmigiano)",
                },
                "whyNotResolved": "The canonicalizer still classifies the token likely_alias; promoting it would be a canonicalizer-table change that this task must not make unilaterally.",
                "ownerDecision": "OD-PARM (canonicalizer table review: keep likely_alias or move to ORTHOGRAPHIC_EQUIVALENTS)",
                "stillOpen": True,
            })
        elif rid == "REC-08":
            eg = discovery["rec08EggplantFamily"]
            entry.update({
                "resolution": "RESOLVED",
                "resolutionStatus": "RESOLVED_BY_PRODUCTION_MATCHER_EVIDENCE",
                "evidence": {
                    "PRODUCTION_DATA": f"production matchDiscovery over {discovery['checks']['catalogSize']} targets: 0 signature collisions; both recipes UNIQUE_MATCH themselves",
                    "PIZZA_DB_EVIDENCE": "eggplant-family census recorded (TOKEN_PROVENANCE eggplantFamilyCensus); only the two W1 rows are in scope",
                    "relation": eg["relation"],
                },
                "carryForward": "Port rec08EggplantFamily.portableTestCases into src/logic/discovery tests in the recipe-data implementation slice (src/** out of scope here). Production's existing 'all runtime signatures are unique' test covers distinctness automatically once the recipes land.",
                "stillOpen": False,
            })
        elif rid in VISUAL_LEDGER:
            ing = VISUAL_LEDGER[rid]
            entry.update({
                "resolution": "UNRESOLVED",
                "resolutionStatus": "HUMAN_VERIFICATION_REQUIRED",
                "ingredientId": ing,
                "explicitFocus": ing in STRICT_GLYPH_ITEMS,
                "requirementsFile": f"docs/reports/data/{OUT_VISUAL}",
                "ownerDecision": {"clam": "OD-CLAM-GLYPH (🦪 per PR #221 vs 🐚 per brief vs other)",
                                  "fresh-tomato": "OD-TOMATO-REPRESENTATION (accept shared 🍅 or require a distinguishing representation; a non-emoji representation would be a new runtime dependency)"}.get(ing),
                "stillOpen": True,
            })
        elif rid == "RT-01":
            entry.update({"resolution": "UNCHANGED", "resolutionStatus": "RUNTIME_DEPENDENCY_REQUIRED",
                          "note": "Kept as a separate runtime dependency (reference ring capacity). Quantities not trimmed.", "stillOpen": True})
        elif rid == "REC-11":
            entry.update({"resolution": "UNCHANGED", "resolutionStatus": "OWNER_DECISION_RECORDED",
                          "note": "Sauce OD-S1 = A maintained.", "stillOpen": False})
        else:
            entry.update({"resolution": "UNCHANGED", "resolutionStatus": row["status"],
                          "note": "Global requirement inherited by every recipe; out of this task's scope (#215/#217/#218 owner tracks).",
                          "stillOpen": True})
        rows.append(entry)

    open_ids = {r["id"] for r in rows if r["stillOpen"]}
    globals_open = sorted(r["id"] for r in rows if r["id"] in ("REC-01", "REC-02", "REC-03", "REC-04") and r["stillOpen"])
    per_recipe = []
    for r in sorted(recipes["rows"], key=lambda x: EXPECTED_W1.index(x["recipeIdCandidate"])):
        specific = [x for x in r["unresolvedRefs"] if x in open_ids]
        resolved_here = [x for x in r["unresolvedRefs"] if x not in open_ids]
        per_recipe.append({
            "recipeIdCandidate": r["recipeIdCandidate"],
            "resolvedByThisAudit": resolved_here,
            "remainingRecipeSpecific": specific,
            "remainingByKind": {
                "ownerDecision": [x for x in specific if x in ("REC-06", "REC-07", "REC-09", "REC-10")],
                "humanVerification": [x for x in specific if x in VISUAL_LEDGER],
                "runtime": [x for x in specific if x == "RT-01"],
            },
            "inheritedGlobalOpen": globals_open,
            "readiness": "REVIEW",
            "readyNow": False,
        })
    return {
        "schemaVersion": 1,
        "kind": "w1_evidence_resolution_ledger",
        "inputs": inputs,
        "ownerDecisionsHeld": {"sauce": "OD-S1 = A (maintained)", "quantities": "authored minCounts unchanged; not trimmed to the 8-slot ring",
                               "completionGate": "#215 production untouched"},
        "rows": rows,
        "resolvedIds": sorted(r["id"] for r in rows if r["resolution"] == "RESOLVED"),
        "unresolvedIds": sorted(r["id"] for r in rows if r["resolution"] == "UNRESOLVED"),
        "unchangedIds": sorted(r["id"] for r in rows if r["resolution"] == "UNCHANGED"),
        "recipes": per_recipe,
        "summary": {"READY": 0, "REVIEW": len(per_recipe), "BLOCKED": 0,
                    "readyNowRecipes": [],
                    "noNewIngredientRecipes": sorted(r["recipeIdCandidate"] for r in recipes["rows"]
                                                     if not set(x["ingredientId"] for x in r["requiredIngredients"]) & set(EXPECTED_NEW_INGREDIENTS))},
    }


def dump(obj):
    return json.dumps(obj, ensure_ascii=False, indent=2) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()

    verify_pins()
    w1_rows, recipes, ingredients, ledger, master, catalog, inputs = load_inputs()
    provenance = build_provenance(w1_rows, recipes, master, catalog)
    if provenance["w1LikelyAliasTokens"] != sorted(["オリーブ->black-olive", "パルミジャーノチーズ->parmigiano"]):
        fail(f"unexpected W1 likely_alias token set: {provenance['w1LikelyAliasTokens']}")
    discovery = build_discovery(recipes, ingredients)
    visual = build_visual(ingredients, discovery, recipes)
    resolution = build_ledger(ledger, recipes, provenance, discovery, visual, inputs)

    outputs = {OUT_LEDGER: resolution, OUT_PROVENANCE: provenance, OUT_DISCOVERY: discovery, OUT_VISUAL: visual}
    if args.check:
        drift = [n for n, o in outputs.items() if not (OUT_DIR / n).exists() or (OUT_DIR / n).read_text(encoding="utf-8") != dump(o)]
        if drift:
            fail(f"generated output differs from committed file(s): {drift}")
        print(f"PASS: W1 evidence resolution reproducible (resolved={resolution['resolvedIds']}, "
              f"unresolved={resolution['unresolvedIds']}, READY=0, REVIEW=10)")
        return
    for name, obj in outputs.items():
        (OUT_DIR / name).write_text(dump(obj), encoding="utf-8")
    print(f"wrote {len(outputs)} files; resolved={resolution['resolvedIds']} unresolved={resolution['unresolvedIds']}")


if __name__ == "__main__":
    main()
