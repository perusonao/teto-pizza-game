#!/usr/bin/env python3
"""W1 REC-01 / REC-02 / REC-03 resolution Fresh Audit (read-only).

Docs/data/tooling only.  This script never writes to ``src/**``, ``e2e/**`` or
``.github/**`` and never modifies PR #220 / #221 / #222.  It reads:

* PR #220 exact HEAD (W1 authority: the recipe set),
* PR #221 exact HEAD (REC-01..03 definitions, recipe authoring candidates,
  change map),
* the W1 Visual Evidence Sync commit (latest ledger state for REC-01..03 and
  the recipe open-ref lists),
* the current ``main`` working tree (production conventions: recipes, CUT
  allowlist, Scoring Reference map, Completion Gate, reference ring, palette),

pins every input by sha256, and derives, per W1 recipe, what is already
mechanically settled and what still needs a Human / Owner answer.

Evidence layers are kept apart on purpose:

* ``PIZZA_DB_EVIDENCE``        -- facts from the owner-relayed PIZZA DB rows
* ``GAME_DESIGN_MATRIX``       -- merged 172-row design matrix derivations
* ``INTERNAL_CATALOG``         -- data/recipes/pizza_master_catalog.json
* ``PRODUCTION_CONVENTION``    -- values measured from src/** (read-only)
* ``GAME_AUTHORING_CANDIDATE`` -- #221 candidates (never evidence)
* ``OWNER_DECISION_RECORD``    -- decisions recorded by the owner on GitHub
* ``HUMAN_SIGNOFF``            -- pending human sign-off; never external evidence

Usage::

    git fetch origin codex/content-readiness-fresh-audit \
        codex/w1-authoring-fresh-audit claude/w1-ingredient-visual-preview-mt4uxw
    python3 tools/progression2_w1_rec_resolution_audit.py            # regenerate
    python3 tools/progression2_w1_rec_resolution_audit.py --check    # verify
    python3 tools/progression2_w1_rec_resolution_audit.py --self-test
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_JSON = ROOT / "docs/reports/data/TETO_PROGRESS2_W1_REC01-03_RESOLUTION_AUDIT.json"
OUT_REPORT = ROOT / "docs/reports/TETO_PROGRESS2_W1_REC01-03_RESOLUTION_FRESH-AUDIT.md"
PACK_BEGIN = "<!-- BEGIN GENERATED: HUMAN REVIEW PACK (tools/progression2_w1_rec_resolution_audit.py) -->"
PACK_END = "<!-- END GENERATED: HUMAN REVIEW PACK -->"

AUDITED_MAIN_SHA = "1e53baa88f390bf6d8f52647e7c65cc279eb2567"

# --- pinned authority ------------------------------------------------------
PR220 = {
    "pr": 220, "branch": "codex/content-readiness-fresh-audit",
    "headSha": "e49dab96bd9b26dc0f520349cf09d1160c3519f5",
}
PR221 = {
    "pr": 221, "branch": "codex/w1-authoring-fresh-audit",
    "headSha": "070afc0827f382bec8bc813d62e7fafe663a0991",
}
VISUAL_SYNC = {
    "commit": "3fc02a06c197967c5989e0b0c1f88a0a546e2d2c",
    "branch": "claude/w1-ingredient-visual-preview-mt4uxw",
    "title": "docs: sync W1 Human Visual Verification (7/7 HUMAN_PASS) and final visual Owner Decisions",
}
GIT_INPUTS = {
    "pr220.waves": (PR220["headSha"], "docs/reports/data/TETO_PROGRESS2_CONTENT_READINESS_WAVES.json"),
    "pr221.recipeMatrix": (PR221["headSha"], "docs/reports/data/TETO_PROGRESS2_W1_RECIPE_AUTHORING_MATRIX.json"),
    "pr221.ledger": (PR221["headSha"], "docs/reports/data/TETO_PROGRESS2_W1_UNRESOLVED_EVIDENCE_LEDGER.json"),
    "pr221.changeMap": (PR221["headSha"], "docs/reports/data/TETO_PROGRESS2_W1_FUTURE_IMPLEMENTATION_CHANGE_MAP.json"),
    "pr221.ingredientMatrix": (PR221["headSha"], "docs/reports/data/TETO_PROGRESS2_W1_INGREDIENT_AUTHORING_MATRIX.json"),
    "sync.evidenceLedger": (VISUAL_SYNC["commit"], "docs/reports/data/TETO_PROGRESS2_W1_EVIDENCE_RESOLUTION_LEDGER.json"),
    "sync.ownerDecisions": (VISUAL_SYNC["commit"], "docs/reports/data/TETO_PROGRESS2_W1_OWNER_DECISIONS.json"),
}
LOCAL_INPUTS = {
    "main.recipes": "src/data/recipes.ts",
    "main.ingredients": "src/data/ingredients.ts",
    "main.cookingProfiles": "src/data/cookingProfiles.ts",
    "main.referencePizza": "src/data/referencePizza.ts",
    "main.referencePizzaTest": "src/data/referencePizza.test.ts",
    "main.playerReference": "src/data/playerReference.ts",
    "main.referenceLayout": "src/logic/pizzaReferenceLayout.ts",
    "main.completionGate": "src/logic/completionGate.ts",
    "main.pizzaCatalog": "data/recipes/pizza_master_catalog.json",
    "main.pizzaDbEvidence": "docs/reports/data/TETO_PIZZADB_172_MASTER-EVIDENCE.json",
    "main.designMatrix": "docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json",
    "main.cookingStepsSsot": "docs/design/TETO_RECIPE-COOKING-STEPS_1.0.md",
    "main.pizzaCuttingSsot": "docs/design/TETO_PIZZA-CUTTING_1.0.md",
}
# sha256 of every input, pinned; any drift fails generation and --check.
PINS_FILE = ROOT / "tools/progression2_w1_rec_resolution_audit.pins.json"

# Owner decision records on GitHub (not in git).  Quoted, not re-decided.
ISSUE_215_OD = {
    "sourceClass": "OWNER_DECISION_RECORD",
    "where": "Issue #215 owner comment 2026-09-24 (id 5814618436) + handoff comment (id 5816513943)",
    "reviewedAuditPr": "#218 @ 5105771d37577ad353e869ea35295a4ea18bbce9 (OPEN, docs-only)",
    "decisions": {
        "OD-1": "G1 -- a required ingredient at 0 pieces => FAILED; 1+ can complete",
        "OD-2": "Q shortage coefficient 0.5 (quality)",
        "OD-3": "excess penalty 0.15 (quality)",
        "OD-4": "LR-A -- Lunch Rush still requires the ordered quantity",
        "OD-4b": "Lunch Rush excess penalty 0.15",
        "OD-5": "D-A -- Free Cooking discovers on ingredient kinds; quantity is not Recipe Identity",
    },
    "principle": "Recipe Identity = ingredient kinds (+ future required steps); Completion/Quality = quantity, placement, sauce, dough, bake, cut",
    "runtimeImplementation": {"pr": 222, "headSha": "81a850c26edf4c7f7f8cf69fad64e66d75830efd",
                              "state": "OPEN (not merged)", "baseSha": "dff233c042d2df6ee1c3a92f2d2419830aa05460"},
    "bakeChanged": False,
    "cutChanged": False,
}

REC_IDS = ["REC-01", "REC-02", "REC-03"]
SOURCE_CLASSES = {
    "PIZZA_DB_EVIDENCE", "GAME_DESIGN_MATRIX", "INTERNAL_CATALOG", "PRODUCTION_CONVENTION",
    "GAME_AUTHORING_CANDIDATE", "OWNER_DECISION_RECORD", "HUMAN_SIGNOFF", "MERGED_SSOT",
}
EXTERNAL_EVIDENCE_CLASSES = {"PIZZA_DB_EVIDENCE"}
# Accepted description surface forms beyond production nameJa, each with a
# production precedent (bismarck's description writes 卵 for egg).
SURFACE_ALIASES = {"egg": ["卵"]}
REGION_WORDS = ["アメリカ", "ニューヘイブン", "ブラジル", "南イタリア", "ナポリ", "ローマ", "アルゼンチン", "カナダ", "イタリア"]


class AuditError(Exception):
    pass


# --- input loading ----------------------------------------------------------

def git_blob(sha: str, path: str) -> bytes:
    try:
        return subprocess.run(["git", "show", f"{sha}:{path}"], cwd=ROOT, check=True,
                              capture_output=True).stdout
    except subprocess.CalledProcessError as exc:
        raise AuditError(f"authority unavailable: {sha}:{path} ({exc.stderr.decode().strip()}). "
                         "Run the git fetch shown in this script's docstring.") from exc


def branch_tip(branch: str) -> str | None:
    res = subprocess.run(["git", "rev-parse", "--verify", "-q", f"refs/remotes/origin/{branch}"],
                         cwd=ROOT, capture_output=True, text=True)
    return res.stdout.strip() or None


def load_inputs(require_pins: bool = True) -> tuple[dict[str, bytes], dict[str, str]]:
    raw: dict[str, bytes] = {}
    for key, (sha, path) in GIT_INPUTS.items():
        raw[key] = git_blob(sha, path)
    for key, path in LOCAL_INPUTS.items():
        p = ROOT / path
        if not p.exists():
            raise AuditError(f"missing local input {path}")
        raw[key] = p.read_bytes()
    digests = {k: hashlib.sha256(v).hexdigest() for k, v in raw.items()}
    if not require_pins:
        return raw, digests
    if not PINS_FILE.exists():
        raise AuditError(f"{PINS_FILE.relative_to(ROOT)} missing; inputs are unpinned")
    pins = json.loads(PINS_FILE.read_text())
    if set(pins) != set(digests):
        raise AuditError(f"pin set mismatch: {sorted(set(pins) ^ set(digests))}")
    for key, digest in digests.items():
        if pins[key] != digest:
            raise AuditError(f"input drift: {key} sha256 {digest} != pinned {pins[key]}")
    return raw, digests


def authority_tip_findings() -> list[dict]:
    """Remote-tracking tips vs. pins.  A moved #220/#221 tip is drift (FAIL);
    the visual-sync branch is shared with a parallel session, so only the
    pinned commit's ancestry is required there."""
    out = []
    for label, pin, must_equal in (("PR #220", PR220, True), ("PR #221", PR221, True)):
        tip = branch_tip(pin["branch"])
        if tip is None:
            out.append({"authority": label, "status": "TIP_NOT_FETCHED", "pinned": pin["headSha"]})
        elif tip != pin["headSha"] and must_equal:
            raise AuditError(f"{label} branch tip {tip} != pinned {pin['headSha']} (authority moved)")
        else:
            out.append({"authority": label, "status": "TIP_MATCHES_PIN", "pinned": pin["headSha"]})
    tip = branch_tip(VISUAL_SYNC["branch"])
    if tip is None:
        out.append({"authority": "Visual Evidence Sync", "status": "TIP_NOT_FETCHED", "pinned": VISUAL_SYNC["commit"]})
    else:
        anc = subprocess.run(["git", "merge-base", "--is-ancestor", VISUAL_SYNC["commit"], tip], cwd=ROOT).returncode == 0
        if not anc:
            raise AuditError("Visual Evidence Sync commit is no longer an ancestor of its branch (history rewritten)")
        out.append({"authority": "Visual Evidence Sync", "status": "PINNED_COMMIT_IS_ANCESTOR_OF_TIP",
                    "pinned": VISUAL_SYNC["commit"]})
    return out


# --- production parsing (read-only) ------------------------------------------

def parse_recipes_ts(text: str) -> dict[str, dict]:
    recipes = {}
    for block in re.split(r"\n  \{\n", text)[1:]:
        m = re.search(r'^\s*id: "([a-z0-9-]+)"', block, re.M)
        if not m:
            continue
        desc = re.search(r'description:\s*"([^"]*)"', block)
        reqs = [(a, int(b)) for a, b in re.findall(r'ingredientId: "([a-z0-9-]+)", minCount: (\d+)', block)]
        bake = re.search(r"bakeTarget: \{ start: (\d+), end: (\d+) \}", block)
        recipes[m.group(1)] = {
            "description": desc.group(1) if desc else None,
            "requiredIngredients": reqs,
            "bakeTarget": (int(bake.group(1)), int(bake.group(2))) if bake else None,
        }
    if len(recipes) != 15:
        raise AuditError(f"expected 15 production recipes in recipes.ts, parsed {len(recipes)}")
    return recipes


def parse_ingredients_ts(text: str) -> dict[str, dict]:
    out = {m.group(1): {"category": m.group(2), "nameJa": m.group(3)} for m in re.finditer(
        r'id: "([a-z0-9-]+)",\s*category: "(\w+)",\s*nameJa: "([^"]+)"', text)}
    palette = re.search(r"MAX_INGREDIENT_PALETTE_SLOTS = (\d+)", text)
    if not out or not palette:
        raise AuditError("could not parse ingredients.ts")
    return {"ingredients": out, "maxPaletteSlots": int(palette.group(1))}


def parse_cut_allowlist(text: str) -> dict:
    body = re.search(r"CUT_ELIGIBLE_RECIPE_IDS[^=]*= new Set<RecipeId>\(\[(.*?)\]\)", text, re.S)
    slices = re.search(r"STANDARD_CUT_CONFIG: CutConfig = \{ requestedSliceCount: (\d+) \}", text)
    if not body or not slices:
        raise AuditError("could not parse CUT allowlist")
    return {"ids": re.findall(r'"([a-z0-9-]+)"', body.group(1)),
            "standardSliceCount": int(slices.group(1)),
            "optInOnly": "opt-in CUT-eligibility allowlist" in text}


def parse_reference_map(text: str) -> list[str]:
    consts = dict(re.findall(r'export const ([A-Z_]+_REFERENCE): ReferencePizza = \{\s*recipeId: "([a-z0-9-]+)"', text))
    body = re.search(r"const REFERENCE_PIZZAS[^=]*= new Map\(\[(.*?)\]\);", text, re.S)
    if not body:
        raise AuditError("could not parse REFERENCE_PIZZAS")
    return [consts[c] for c in re.findall(r"\[([A-Z_]+_REFERENCE)\.recipeId", body.group(1))]


def parse_ring_slots(text: str) -> int:
    body = re.search(r"PIECE_RING_POSITIONS = \[(.*?)\] as const", text, re.S)
    if not body:
        raise AuditError("could not parse PIECE_RING_POSITIONS")
    return len(re.findall(r"\{ x:", body.group(1)))


def parse_completion_gate(text: str) -> dict:
    margin = re.search(r"BAKE_ACCEPTABLE_MARGIN_RATIO = ([0-9.]+);", text)
    return {
        "bakeMarginRatio": float(margin.group(1)) if margin else None,
        "readsCut": re.search(r"\bcut", text, re.I) is not None,
        "minCountGates": "INSUFFICIENT_REQUIRED_AMOUNT" in text and "count < req.minCount" in text,
        "bakeGates": "UNDERBAKED" in text and "OVERBAKED" in text,
        "readsScoringReference": "getReferencePizza(recipe.id)" in text,
    }


# --- derivation --------------------------------------------------------------

def production_conventions(recipes: dict, ing: dict) -> dict:
    cats = ing["ingredients"]
    by_cat: dict[str, set] = {"sauce": set(), "cheese": set(), "topping": set()}
    widths, starts, lengths, piece_totals = set(), [], [], []
    for r in recipes.values():
        pieces = 0
        for iid, n in r["requiredIngredients"]:
            by_cat[cats[iid]["category"]].add(n)
            if cats[iid]["category"] != "sauce":
                pieces += n
        piece_totals.append(pieces)
        s, e = r["bakeTarget"]
        widths.add(e - s)
        starts.append(s)
        lengths.append(len(r["description"]))
    return {
        "sourceClass": "PRODUCTION_CONVENTION",
        "minCountBySauce": sorted(by_cat["sauce"]),
        "minCountByCheese": sorted(by_cat["cheese"]),
        "minCountByTopping": sorted(by_cat["topping"]),
        "bakeWidths": sorted(widths),
        "bakeStartRange": [min(starts), max(starts)],
        "descriptionLengthRange": [min(lengths), max(lengths)],
        "nonSaucePieceRange": [min(piece_totals), max(piece_totals)],
    }


def region_claims(desc: str, origin: str | None, name: str) -> list[dict]:
    claims, seen = [], desc
    for word in REGION_WORDS:
        if word not in seen:
            continue
        seen = seen.replace(word, "")
        hay = f"{origin or ''} {name}"
        ok = word in hay or (word == "南イタリア" and "イタリア" in hay and "南" in hay)
        claims.append({"word": word, "supportedBy": "PIZZA_DB origin/nameJa" if ok else None,
                       "status": "SUPPORTED" if ok else "NOT_IN_PIZZA_DB_EVIDENCE"})
    return claims


def build(raw: dict[str, bytes], digests: dict[str, str], tips: list[dict]) -> dict:
    paths = {**{k: p for k, (_, p) in GIT_INPUTS.items()}, **LOCAL_INPUTS}
    j = {k: json.loads(v) for k, v in raw.items() if paths[k].endswith(".json")}
    t = {k: v.decode() for k, v in raw.items() if k in LOCAL_INPUTS and not LOCAL_INPUTS[k].endswith(".json")}

    prod = parse_recipes_ts(t["main.recipes"])
    ing = parse_ingredients_ts(t["main.ingredients"])
    cut = parse_cut_allowlist(t["main.cookingProfiles"])
    ref_ids = parse_reference_map(t["main.referencePizza"])
    ring = parse_ring_slots(t["main.referenceLayout"])
    gate = parse_completion_gate(t["main.completionGate"])
    conv = production_conventions(prod, ing)
    ref_test_requires_all = "every RECIPES entry has a non-null Reference" in t["main.referencePizzaTest"]
    player_ref_from_mincount = "req.minCount" in t["main.playerReference"]
    ssot_cut_score_only = ("No (§10 — degrades score only)" in t["main.cookingStepsSsot"]
                           and "`false`\nfor CUT/FINISH" in t["main.cookingStepsSsot"])
    cutting_adopts_score_only = "**Adopted: A.** A pizza with zero committed cuts still passes the Completion Gate" in t["main.pizzaCuttingSsot"]

    waves_w1 = sorted(r["canonicalCandidateId"] for r in j["pr220.waves"]["rows"] if r.get("wave") == "W1")
    w1_rows220 = {r["canonicalCandidateId"]: r for r in j["pr220.waves"]["rows"] if r.get("wave") == "W1"}
    matrix = {r["recipeIdCandidate"]: r for r in j["pr221.recipeMatrix"]["rows"]}
    ledger = {r["id"]: r for r in j["pr221.ledger"]["rows"]}
    sync = j["sync.evidenceLedger"]
    sync_rows = {r["id"]: r for r in sync["rows"]}
    sync_recipes = {r["recipeIdCandidate"]: r for r in sync["recipes"]}
    ev_rows = {r["id"]: r for r in j["main.pizzaDbEvidence"]["recipeRows"]}
    dm_rows = {r["evidenceId"]: r for r in j["main.designMatrix"]["rows"]}
    catalog = {r["id"]: r for r in j["main.pizzaCatalog"]["recipes"]}
    change_files = sorted({f for s in j["pr221.changeMap"]["slices"] for f in s.get("likelyFiles", [])})
    new_ing = {r["id"]: r for r in j["pr221.ingredientMatrix"]["rows"]}
    desc_checks = {c["recipeIdCandidate"]: c for c in j["sync.ownerDecisions"]["descriptionConsistency"]
                   if isinstance(c, dict) and "recipeIdCandidate" in c}

    chain = []
    for key, (_, path) in GIT_INPUTS.items():
        if key.startswith("pr221."):
            recorded = sync["inputs"]["pr221"]["files"].get(path)
            if recorded is not None:
                if recorded != digests[key]:
                    raise AuditError(f"provenance break: visual sync recorded {path} as {recorded}, #221 head has {digests[key]}")
                chain.append({"path": path, "sha256": recorded, "status": "MATCHES_VISUAL_SYNC_RECORD"})
    if sync["inputs"]["pr220"]["blobSha256"] != digests["pr220.waves"] or sync["inputs"]["pr221"]["headSha"] != PR221["headSha"]:
        raise AuditError("provenance break: visual sync ledger pins a different #220 blob or #221 head")
    for rid in REC_IDS:
        if rid not in ledger:
            raise AuditError(f"{rid} missing from #221 ledger")
        if sync_rows[rid]["resolution"] != "UNCHANGED" or not sync_rows[rid]["stillOpen"]:
            raise AuditError(f"{rid} changed state in the visual sync ledger; re-audit required")

    def name_of(iid: str) -> str:
        if iid in ing["ingredients"]:
            return ing["ingredients"][iid]["nameJa"]
        return new_ing[iid]["displayName"]

    def cat_of(iid: str) -> str:
        if iid in ing["ingredients"]:
            return ing["ingredients"][iid]["category"]
        return new_ing[iid]["categoryCandidate"]

    recipes = []
    # #221 matrix order (= #220 first-10 listing); the set itself is checked below.
    for rid in [r["recipeIdCandidate"] for r in j["pr221.recipeMatrix"]["rows"]]:
        m = matrix[rid]
        ev = ev_rows[m["evidenceId"]]
        dm = dm_rows[m["evidenceId"]]
        reqs = [(q["ingredientId"], q["minCountCandidate"]) for q in m["requiredIngredients"]]
        desc = m["descriptionCandidate"]
        start, end = m["bakeTargetCandidate"]["start"], m["bakeTargetCandidate"]["end"]
        pieces = sum(n for i, n in reqs if cat_of(i) != "sauce")

        # REC-01 mechanical checks ------------------------------------------------
        mentions = []
        for iid, _ in reqs:
            forms = [name_of(iid)] + SURFACE_ALIASES.get(iid, [])
            hit = next((f for f in forms if f in desc), None)
            mentions.append({"ingredientId": iid, "form": hit, "ok": hit is not None})
        regions = region_claims(desc, ev.get("origin"), ev.get("nameJa") or "")
        cat_entry = catalog.get(rid)
        cat_bake = cat_entry.get("bakeProfile") if cat_entry else None
        if cat_bake:
            bake_precedent = {
                "catalogEntry": rid, "catalogBakeProfile": [cat_bake["start"], cat_bake["end"]],
                "catalogVerificationStatus": cat_entry.get("verificationStatus"),
                "status": "MATCH" if (cat_bake["start"], cat_bake["end"]) == (start, end) else "CONFLICT",
                "rule": "Batch 1A / 1B-B precedent: a non-null catalog bakeProfile is used verbatim (recipes.ts comments)",
            }
        else:
            bake_precedent = {"catalogEntry": rid if cat_entry else None, "catalogBakeProfile": None,
                              "status": "NO_CATALOG_VALUE",
                              "rule": "Batch 1B-A / 1B-C precedent: null catalog bakeProfile => original value on the 20-wide span convention"}
        qty_checks = []
        for iid, n in reqs:
            c = cat_of(iid)
            allowed = {"sauce": conv["minCountBySauce"], "cheese": conv["minCountByCheese"],
                       "topping": conv["minCountByTopping"]}[c]
            qty_checks.append({"ingredientId": iid, "category": c, "minCount": n,
                               "withinProductionRange": min(allowed) <= n <= max(allowed)})
        mech01 = {
            "descriptionNamesEveryRequiredIngredient": all(x["ok"] for x in mentions),
            "descriptionLengthWithinProductionRange": conv["descriptionLengthRange"][0] <= len(desc) <= conv["descriptionLengthRange"][1],
            "descriptionOwnerDecisionConsistency": desc_checks.get(rid, {}).get("status", "NOT_CHECKED_BY_SYNC"),
            "regionClaimsSupported": all(r["status"] == "SUPPORTED" for r in regions),
            "minCountsWithinProductionRanges": all(q["withinProductionRange"] for q in qty_checks),
            "identitySetMatchesPr220": sorted(i for i, _ in reqs) == sorted(w1_rows220[rid]["identityIngredientIds"]),
            "ingredientTypesFitPalette": len(reqs) <= ing["maxPaletteSlots"],
            "nonSaucePiecesFitReferenceRing": pieces <= ring,
            "bakeWidthMatchesProductionConvention": (end - start) in conv["bakeWidths"],
            "bakeStartWithinProductionRange": conv["bakeStartRange"][0] <= start <= conv["bakeStartRange"][1],
            "bakeCatalogPrecedent": bake_precedent["status"],
            "scoringReferenceEntryExists": rid in ref_ids,
        }
        human01 = []
        if not mech01["descriptionLengthWithinProductionRange"]:
            human01.append(f"description is {len(desc)} chars; production range is {conv['descriptionLengthRange'][0]}-{conv['descriptionLengthRange'][1]} (check card fit)")
        if not mech01["regionClaimsSupported"]:
            human01.append("region wording not backed by PIZZA DB origin (see regionClaims)")
        if bake_precedent["status"] == "CONFLICT":
            human01.append("bakeTarget differs from the internal catalog value (see bakePrecedent)")
        if not mech01["nonSaucePiecesFitReferenceRing"]:
            human01.append(f"{pieces} non-sauce pieces > {ring}-slot ring: keep authored (RT-01) or trim (capricciosa/meat-lovers precedent)")
        human01.append("batch content sign-off of description / minCount / bakeTarget (REC-01 itself)")

        # REC-02 classification ---------------------------------------------------
        dough = dm["dough"]
        caps = dm.get("requiredCapabilities", [])
        structural = [c for c in caps if c in ("ENCLOSE", "DOUGH_SHAPE_TARGET", "PAN_BAKE")]
        if structural or dough.get("shape") not in (None, "round") or dm["cutServe"]["behavior"] != "existing-round-cut-optional":
            cut_class = "MECHANIC_INSUFFICIENT"
        elif dough.get("doughStyleRaw") is None:
            cut_class = "EVIDENCE_INSUFFICIENT"
        else:
            cut_class = "CUT_CANDIDATE"
        cut_basis = {
            "doughStyleRaw": dough.get("doughStyleRaw"), "doughClass": dough.get("class"),
            "shape": dough.get("shape"),
            "shapeSource": "explicit standard doughStyle (round open pizza)" if dough.get("doughStyleRaw") else
                           "DEFAULT -- design matrix falls back to 'round' when doughStyle is null (tools/progression2_mechanic_matrix.py)",
            "requiresMechanicIdentity": ev.get("requiresMechanicIdentity"),
            "requiredCapabilities": caps, "designMatrixCutServe": dm["cutServe"],
            "pr221Candidate": m["cutRequirement"]["eligibilityCandidate"],
            "inProductionAllowlist": rid in cut["ids"],
        }

        # REC-03 compatibility ----------------------------------------------------
        rec03 = {
            "cutGatesCompletion": False,
            "minCountAllAtLeastOne": all(n >= 1 for _, n in reqs),
            "g1ZeroPieceFailureApplies": True,
            "lunchRushOrderQuantity": {i: n for i, n in reqs if cat_of(i) != "sauce"},
            "bakeGateWindow": [start - (end - start) * gate["bakeMarginRatio"], end + (end - start) * gate["bakeMarginRatio"]],
            "compatible": all(n >= 1 for _, n in reqs) and end > start,
        }

        recipes.append({
            "recipeId": rid,
            "nameJa": m["nameJa"],
            "evidence": {
                "sourceClass": "PIZZA_DB_EVIDENCE",
                "evidenceId": m["evidenceId"], "pizzaDbNameJa": ev.get("nameJa"), "origin": ev.get("origin"),
                "doughStyle": ev.get("doughStyle"), "sauceFamily": ev.get("sauceFamily"),
                "ingredientsJa": ev.get("ingredientsJa"), "ingredientsCanonical": ev.get("ingredientsCanonical"),
                "evidenceOrigin": ev.get("evidenceOrigin"), "corroborationCount": ev.get("corroborationCount"),
                "sourceUrl": ev.get("sourceUrl"),
                "carriesQuantity": False, "carriesBakeTarget": False, "carriesDescription": False,
                "carriesCutInfo": False,
            },
            "authoring": {
                "sourceClass": "GAME_AUTHORING_CANDIDATE",
                "source": f"PR #221 @ {PR221['headSha']}",
                "description": desc,
                "requiredIngredients": [{"ingredientId": i, "nameJa": name_of(i), "category": cat_of(i),
                                         "minCount": n} for i, n in reqs],
                "nonSaucePieceCount": pieces,
                "bakeTarget": [start, end],
                "sauce": m["sauce"],
            },
            "rec01": {
                "definition": ledger["REC-01"]["field"],
                "mechanical": mech01,
                "descriptionMentions": mentions,
                "regionClaims": regions,
                "quantityChecks": qty_checks,
                "bakePrecedent": bake_precedent,
                "humanSignoff": {"sourceClass": "HUMAN_SIGNOFF", "status": "PENDING",
                                 "countsAsExternalEvidence": False, "signedBy": None, "signedAt": None},
                "humanItems": human01,
                "status": "NOT_READY",
            },
            "rec02": {
                "definition": ledger["REC-02"]["field"],
                "classification": cut_class,
                "basis": cut_basis,
                "completionEffect": "SCORE_ONLY (merged SSOT)",
                "status": "NOT_READY",
            },
            "rec03": {
                "definition": ledger["REC-03"]["field"],
                "compatibility": rec03,
                "status": "NOT_READY",
            },
            "missingDependencies": [] if rid in ref_ids else ["MD-01"],
            "otherOpenRefs": [r for r in sync_recipes[rid]["effectiveOpenRefs"] if r not in REC_IDS],
        })

    cut_counts: dict[str, int] = {}
    for r in recipes:
        cut_counts[r["rec02"]["classification"]] = cut_counts.get(r["rec02"]["classification"], 0) + 1
    for k in ("CUT_CANDIDATE", "CUT_NONE", "EVIDENCE_INSUFFICIENT", "MECHANIC_INSUFFICIENT"):
        cut_counts.setdefault(k, 0)

    return {
        "schemaVersion": 1,
        "kind": "w1_rec01_03_resolution_audit",
        "auditedMainSha": AUDITED_MAIN_SHA,
        "authority": {"pr220": PR220, "pr221": PR221, "visualEvidenceSync": VISUAL_SYNC,
                      "issue215OwnerDecision": ISSUE_215_OD, "tipChecks": tips,
                      "provenanceChain": chain},
        "inputSha256": dict(sorted(digests.items())),
        "scopeGuard": ["no src/** / e2e/** / .github/** change", "PR #220 / #221 / #222 not modified",
                       "no Owner Decision is recorded as CONFIRMED by this audit"],
        "recDefinitions": {rid: {"source": f"PR #221 ledger @ {PR221['headSha']}", **ledger[rid],
                                 "visualSyncState": sync_rows[rid]["resolution"]} for rid in REC_IDS},
        "w1RecipeSet": {"pr220": waves_w1, "pr221Matrix": sorted(matrix),
                        "visualSyncLedger": sorted(sync_recipes)},
        "productionConventions": {**conv, "cutAllowlist": cut, "scoringReferenceRecipeIds": ref_ids,
                                  "referenceRingSlots": ring, "maxPaletteSlots": ing["maxPaletteSlots"],
                                  "completionGate": gate,
                                  "referenceTestRequiresEveryRecipe": ref_test_requires_all,
                                  "playerReferenceDerivedFromMinCount": player_ref_from_mincount},
        "mergedSsot": {"sourceClass": "MERGED_SSOT",
                       "cookingStepsCutScoreOnly": ssot_cut_score_only,
                       "pizzaCuttingAdoptsScoreOnly": cutting_adopts_score_only},
        "missingDependencyCatalog": {
            "MD-01": {
                "title": "Scoring 2.0 Reference entry (src/data/referencePizza.ts REFERENCE_PIZZAS)",
                "why": "computeScoringV2 returns available:false (no totalScore/stars) and checkSauceQuantity is skipped when a recipe has no Reference; referencePizza.test.ts requires every RECIPES entry to have one; its pieceGroups positions are hand-authored reviewed geometry (count = minCount), not derivable from #221",
                "trackedByPr221Ledger": False,
                "inPr221ChangeMapLikelyFiles": "src/data/referencePizza.ts" in change_files,
                "kind": "AUTHORING_REQUIRED (geometry) -- not an owner decision",
            },
        },
        "recipes": recipes,
        "cutClassificationCounts": dict(sorted(cut_counts.items())),
        "ownerDecisionsProposed": OWNER_QUESTIONS,
        "verdict": {
            "REC-01": {"status": "NOT_READY", "why": "Human content sign-off is pending for all 10 (not machine-resolvable); Q1/Q2 decide the rules it signs against"},
            "REC-02": {"status": "NOT_READY", "why": "No W1 id is in CUT_ELIGIBLE_RECIPE_IDS; opt-in needs a deliberate human shape confirmation (cookingProfiles.ts); Q3 settles the one EVIDENCE_INSUFFICIENT row"},
            "REC-03": {"status": "NOT_READY", "why": "Every axis is compatible and the blocking #218 decision now exists (Issue #215 OD); closing it needs Q4 (spec record vs #222 merge)"},
            "readinessAfterThisAudit": {"READY": 0, "REVIEW": 10, "BLOCKED": 0},
        },
    }


OWNER_QUESTIONS = [
    {"id": "Q1", "rec": "REC-01", "status": "PROPOSED_NOT_CONFIRMED",
     "title": "REC-01 batch sign-off rule (description / minCount / bakeTarget)",
     "options": {
         "A": "Approve all 10 #221 candidates; Hawaiian bakeTarget follows the catalog precedent (60-80)",
         "B": "Approve all 10 #221 candidates exactly as authored (Hawaiian 58-78)",
         "C": "Do not approve yet; list edits"},
     "recommended": "A"},
    {"id": "Q2", "rec": "REC-01", "status": "PROPOSED_NOT_CONFIRMED",
     "title": "Quantity rule for recipes over the 8-slot reference ring (Parmigiana 9 / Portuguesa 10 / Puttanesca 9)",
     "options": {
         "A": "Keep authored counts; recipes wait for RT-01 runtime slice E",
         "B": "Trim to <= 8 non-sauce pieces (capricciosa / meat-lovers precedent); RT-01 no longer blocks them"},
     "recommended": None},
    {"id": "Q3", "rec": "REC-02", "status": "PROPOSED_NOT_CONFIRMED",
     "title": "CUT default rule",
     "options": {
         "A": "Opt in the 9 CUT_CANDIDATE recipes (6 slices); New Haven Apizza without CUT until dough-shape evidence exists",
         "B": "Opt in all 10 (treat New Haven's missing doughStyle as a standard round pizza)",
         "C": "Opt in none of W1 yet"},
     "recommended": "A"},
    {"id": "Q4", "rec": "REC-03", "status": "PROPOSED_NOT_CONFIRMED",
     "title": "REC-03 closing basis",
     "options": {
         "A": "Close now against the recorded Issue #215 Owner Decision (spec authority); runtime follows #222",
         "B": "Close only after #222 is merged to main"},
     "recommended": "A"},
]


# --- report pack -----------------------------------------------------------------

def render_pack(audit: dict) -> str:
    lines = [PACK_BEGIN, ""]
    for r in audit["recipes"]:
        a, e, r1, r2, r3 = r["authoring"], r["evidence"], r["rec01"], r["rec02"], r["rec03"]
        mech = r1["mechanical"]
        ings = "、".join(f"{x['nameJa']}（{x['ingredientId']}）" for x in a["requiredIngredients"])
        qty = " / ".join(f"{x['ingredientId']}×{x['minCount']}" for x in a["requiredIngredients"])
        fails = [k for k, v in mech.items() if v is False]
        cut_word = {"CUT_CANDIDATE": "CUT候補（6切れ）", "EVIDENCE_INSUFFICIENT": "evidence不足",
                    "MECHANIC_INSUFFICIENT": "mechanic不足", "CUT_NONE": "CUTなし"}[r2["classification"]]
        q = []
        if r1["bakePrecedent"]["status"] == "CONFLICT":
            q.append("Q1（Hawaiian の焼き目標: catalog 60–80 か #221 58–78 か）")
        if not mech["nonSaucePiecesFitReferenceRing"]:
            q.append("Q2（8個を超える具材数をそのまま残すか、8個以下に減らすか）")
        if r2["classification"] != "CUT_CANDIDATE":
            q.append("Q3（New Haven に CUT を入れるか）")
        if not mech["descriptionLengthWithinProductionRange"]:
            q.append(f"Q1 に含めて確認: 説明文が {len(a['description'])} 文字（production は {audit['productionConventions']['descriptionLengthRange'][0]}〜{audit['productionConventions']['descriptionLengthRange'][1]} 文字）")
        if not mech["regionClaimsSupported"]:
            q.append("Q1 に含めて確認: 説明文の「" + "・".join(c["word"] for c in r1["regionClaims"] if c["status"] != "SUPPORTED") + "」は PIZZA DB の origin にない")
        q_text = "; ".join(q) if q else "共通の Q1 / Q3 / Q4 だけ（この recipe 固有の質問はなし）"
        lines += [
            f"### {r['nameJa']}（`{r['recipeId']}`）",
            "",
            "| 項目 | 内容 |",
            "|---|---|",
            f"| Recipe | {a['description']} |",
            f"| Evidence | PIZZA DB `{e['evidenceId']}`（{e['evidenceOrigin']}）: {e['pizzaDbNameJa']} / 生地 {e['doughStyle'] or '記載なし'} / ソース {e['sauceFamily']} / origin {e['origin'] or '記載なし'}。量・焼き・説明文・CUT は PIZZA DB に含まれない |",
            f"| Ingredients | {ings} |",
            f"| Quantity | {qty}（ソース以外 {a['nonSaucePieceCount']} 個 / ring {audit['productionConventions']['referenceRingSlots']}）。#221 の game authoring candidate |",
            f"| Bake target | {a['bakeTarget'][0]}–{a['bakeTarget'][1]}（幅 {a['bakeTarget'][1]-a['bakeTarget'][0]}）。catalog: {r1['bakePrecedent']['status']}"
            + (f" {r1['bakePrecedent']['catalogBakeProfile'][0]}–{r1['bakePrecedent']['catalogBakeProfile'][1]}" if r1['bakePrecedent']['catalogBakeProfile'] else "") + " |",
            f"| CUT | {cut_word}。生地 {r2['basis']['doughStyleRaw'] or '記載なし'} → shape {r2['basis']['shape']}"
            + ("（default）" if r2['basis']['doughStyleRaw'] is None else "") + "。CUT は score のみで完成判定に使わない |",
            f"| REC-01 status | **{r1['status']}** — 機械チェックの不合格: {', '.join(fails) if fails else 'なし'}。Human sign-off: PENDING |",
            f"| REC-02 status | **{r2['status']}** — {r2['classification']}（production allowlist 未登録） |",
            f"| REC-03 status | **{r3['status']}** — 互換性: {'OK' if r3['compatibility']['compatible'] else 'NG'}（全具材 minCount ≥ 1、焼きの判定範囲 {r3['compatibility']['bakeGateWindow'][0]:g}–{r3['compatibility']['bakeGateWindow'][1]:g}） |",
            f"| Question | {q_text} |",
            "",
        ]
    lines.append(PACK_END)
    return "\n".join(lines)


def dump(obj: dict) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=2) + "\n"


# --- invariants ------------------------------------------------------------------

def check_invariants(audit: dict) -> list[str]:
    errs: list[str] = []
    sets = audit["w1RecipeSet"]
    ids = [r["recipeId"] for r in audit["recipes"]]
    if len(ids) != 10 or len(set(ids)) != 10:
        errs.append(f"expected 10 distinct W1 recipes, got {ids}")
    if not (sets["pr220"] == sets["pr221Matrix"] == sets["visualSyncLedger"] == sorted(ids)):
        errs.append("W1 recipe set differs between #220 authority, #221 matrix, visual sync ledger and this audit")
    for rid in REC_IDS:
        d = audit["recDefinitions"].get(rid)
        if not d or not d.get("detail"):
            errs.append(f"{rid} definition missing (must be copied from the #221 ledger)")
    ref_ids = set(audit["productionConventions"]["scoringReferenceRecipeIds"])
    md = audit["missingDependencyCatalog"]["MD-01"]
    for r in audit["recipes"]:
        rid = r["recipeId"]
        expect_md = rid not in ref_ids and audit["productionConventions"]["referenceTestRequiresEveryRecipe"]
        if expect_md != ("MD-01" in r["missingDependencies"]):
            errs.append(f"{rid}: MD-01 (Scoring Reference) detection mismatch")
        if "MD-01" in r["missingDependencies"] and md["inPr221ChangeMapLikelyFiles"]:
            errs.append("MD-01 claims untracked but #221 change map lists referencePizza.ts")
        for key in ("evidence", "authoring"):
            sc = r[key]["sourceClass"]
            if sc not in SOURCE_CLASSES:
                errs.append(f"{rid}.{key}: unknown sourceClass {sc}")
        if r["authoring"]["sourceClass"] in EXTERNAL_EVIDENCE_CLASSES:
            errs.append(f"{rid}: authoring candidate labelled as external evidence")
        ev = r["evidence"]
        if ev["sourceClass"] != "PIZZA_DB_EVIDENCE" or any(ev[k] for k in ("carriesQuantity", "carriesBakeTarget", "carriesDescription", "carriesCutInfo")):
            errs.append(f"{rid}: PIZZA DB provenance altered (it carries no quantity/bake/description/cut)")
        hs = r["rec01"]["humanSignoff"]
        if hs["sourceClass"] != "HUMAN_SIGNOFF" or hs["countsAsExternalEvidence"] is not False:
            errs.append(f"{rid}: Human sign-off treated as external evidence")
        if hs["status"] != "PENDING" and (hs["signedBy"] is None or hs["signedAt"] is None):
            errs.append(f"{rid}: sign-off marked done without a signer/date")
        if hs["status"] == "PENDING" and r["rec01"]["status"] != "NOT_READY":
            errs.append(f"{rid}: REC-01 ready while Human sign-off is pending")
        if r["rec02"]["status"] != "NOT_READY" and not r["rec02"]["basis"]["inProductionAllowlist"]:
            errs.append(f"{rid}: REC-02 ready without an explicit allowlist opt-in")
        if r["rec02"]["classification"] == "CUT_CANDIDATE" and r["rec02"]["basis"]["doughStyleRaw"] is None:
            errs.append(f"{rid}: CUT_CANDIDATE on a defaulted (null) dough shape")
        if r["rec03"]["status"] != "NOT_READY" and not any(
                q["id"] == "Q4" and q["status"].startswith("CONFIRMED") for q in audit["ownerDecisionsProposed"]):
            errs.append(f"{rid}: REC-03 ready without the owner's closing basis")
    for q in audit["ownerDecisionsProposed"]:
        if q["status"] != "PROPOSED_NOT_CONFIRMED":
            errs.append(f"{q['id']}: this audit must not record an Owner Decision as confirmed")
    if not (2 <= len(audit["ownerDecisionsProposed"]) <= 4):
        errs.append("owner questions must be compressed to 2-4")
    if audit["productionConventions"]["completionGate"]["readsCut"] or not audit["mergedSsot"]["cookingStepsCutScoreOnly"]:
        errs.append("CUT completion effect is no longer score-only; REC-02/03 need re-audit")
    return errs


def generate() -> tuple[dict, str]:
    raw, digests = load_inputs()
    tips = authority_tip_findings()
    audit = build(raw, digests, tips)
    errs = check_invariants(audit)
    if errs:
        raise AuditError("invariant failures:\n  " + "\n  ".join(errs))
    return audit, render_pack(audit)


def splice_report(text: str, pack: str) -> str:
    if PACK_BEGIN not in text or PACK_END not in text:
        raise AuditError("report is missing the generated Human Review Pack markers")
    head, rest = text.split(PACK_BEGIN, 1)
    _, tail = rest.split(PACK_END, 1)
    return head + pack + tail


def self_test() -> int:
    audit, _ = generate()
    mutations = {
        "drop a recipe": lambda a: a["recipes"].pop(),
        "authority set drift": lambda a: a["w1RecipeSet"]["pr220"].append("aussie"),
        "hide MD-01": lambda a: a["recipes"][0]["missingDependencies"].clear(),
        "sign-off as evidence": lambda a: a["recipes"][0]["rec01"]["humanSignoff"].update(countsAsExternalEvidence=True),
        "sign-off relabelled PIZZA DB": lambda a: a["recipes"][0]["rec01"]["humanSignoff"].update(sourceClass="PIZZA_DB_EVIDENCE"),
        "authoring as evidence": lambda a: a["recipes"][1]["authoring"].update(sourceClass="PIZZA_DB_EVIDENCE"),
        "PIZZA DB claims quantity": lambda a: a["recipes"][2]["evidence"].update(carriesQuantity=True),
        "REC-01 ready w/o sign-off": lambda a: a["recipes"][3]["rec01"].update(status="READY"),
        "sign-off without signer": lambda a: a["recipes"][3]["rec01"]["humanSignoff"].update(status="SIGNED"),
        "REC-02 ready w/o allowlist": lambda a: a["recipes"][4]["rec02"].update(status="READY"),
        "defaulted shape as candidate": lambda a: next(r for r in a["recipes"] if r["recipeId"] == "new-haven-apizza")["rec02"].update(classification="CUT_CANDIDATE"),
        "REC-03 ready w/o Q4": lambda a: a["recipes"][5]["rec03"].update(status="READY"),
        "owner decision confirmed": lambda a: a["ownerDecisionsProposed"][0].update(status="CONFIRMED"),
        "too many questions": lambda a: a["ownerDecisionsProposed"].extend(copy.deepcopy(a["ownerDecisionsProposed"])),
        "REC definition dropped": lambda a: a["recDefinitions"]["REC-03"].update(detail=""),
        "CUT gates completion": lambda a: a["productionConventions"]["completionGate"].update(readsCut=True),
    }
    failed = []
    for name, mut in mutations.items():
        m = copy.deepcopy(audit)
        mut(m)
        if not check_invariants(m):
            failed.append(name)
    print(f"self-test: {len(mutations) - len(failed)}/{len(mutations)} mutations detected")
    for f in failed:
        print(f"  NOT DETECTED: {f}")
    return 1 if failed else 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--self-test", action="store_true")
    ap.add_argument("--write-pins", action="store_true", help="record current input digests as pins")
    args = ap.parse_args()
    try:
        if args.write_pins:
            _, digests = load_inputs(require_pins=False)
            PINS_FILE.write_text(dump(dict(sorted(digests.items()))))
            print(f"wrote {PINS_FILE.relative_to(ROOT)}")
            return 0
        if args.self_test:
            return self_test()
        audit, pack = generate()
        want_json = dump(audit)
        want_report = splice_report(OUT_REPORT.read_text(), pack)
        if args.check:
            errs = []
            if not OUT_JSON.exists() or OUT_JSON.read_text() != want_json:
                errs.append(f"{OUT_JSON.relative_to(ROOT)} is stale")
            if OUT_REPORT.read_text() != want_report:
                errs.append(f"{OUT_REPORT.relative_to(ROOT)} Human Review Pack is stale")
            if errs:
                print("FAIL\n  " + "\n  ".join(errs))
                return 1
            s = audit["cutClassificationCounts"]
            print(f"PASS -- W1 {len(audit['recipes'])} recipes; REC-01/02/03 NOT_READY; "
                  f"CUT {s}; MD-01 on {sum('MD-01' in r['missingDependencies'] for r in audit['recipes'])}; "
                  f"owner questions {len(audit['ownerDecisionsProposed'])}")
            return 0
        OUT_JSON.write_text(want_json)
        OUT_REPORT.write_text(want_report)
        print(f"wrote {OUT_JSON.relative_to(ROOT)} and the Human Review Pack in {OUT_REPORT.relative_to(ROOT)}")
        return 0
    except AuditError as exc:
        print(f"FAIL -- {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
