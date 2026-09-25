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

Owner Decisions are applied as separate layers:
  GAME_NORMALIZATION_DECISION (2026-09-24)
    OD-OLIVE = BLACK_OLIVE_CANONICAL          -> resolves REC-06 / REC-07 / REC-09
    OD-PARM = PARMIGIANO_CANONICAL            -> resolves REC-10
  VISUAL_DECISION_FINAL (2026-09-25, after the W1 Ingredient Visual Gate)
    OD-CLAM-GLYPH = DEDICATED_CLAM_B          (supersedes DEFER_TO_VISUAL_GATE)
    OD-TOMATO-REPRESENTATION = DEDICATED_FRESH_TOMATO_B (supersedes TEMPORARY_SHARED_GLYPH)
    OD-CAPERS-VISUAL = DEDICATED_CAPER_CLUSTER
The PIZZA DB evidence (token, likely_alias disposition) and the merged canonicalizer tables are
not rewritten: a game normalization rule is recorded next to the evidence, never as a PIZZA DB fact.

HUMAN_VISUAL_VERIFICATION is a third, separate evidence class (owner-relayed iPhone Safari Human
Gate + Human Verification MP4 on the visual-gate Preview): it resolves ING-02/03/07/08/09/10/11
and nothing else. It is never recorded as PIZZA DB evidence or as a game normalization rule.

Nothing here edits recipe quantities, touches src/**, e2e/** or any PR branch, or resolves RT-01
or REC-01..04. Readiness is re-derived from every open dependency, never set by hand.

Usage:
  python3 tools/progression2_w1_evidence_resolution.py              # regenerate outputs
  python3 tools/progression2_w1_evidence_resolution.py --check      # regenerate in memory, diff, exit 1 on drift
  python3 tools/progression2_w1_evidence_resolution.py --self-test  # mutation self-test of the validator
"""
import argparse
import copy
import hashlib
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import progression2_ingredient_canonicalizer as canon  # noqa: E402  (merged tool, read-only use)

MAIN_SHA = "1e53baa88f390bf6d8f52647e7c65cc279eb2567"
PR220_SHA = "e49dab96bd9b26dc0f520349cf09d1160c3519f5"
PR221_SHA = "070afc0827f382bec8bc813d62e7fafe663a0991"
# Earlier pins (Content Evidence Resolution, abb0a3d). The #221 W1 inputs must stay byte-identical
# across both #221 heads (070afc0 only merged main's CI-only #223), or the run fails.
PREVIOUS_PINS = {"main": "dff233c042d2df6ee1c3a92f2d2419830aa05460", "pr221": "d028844e3a848ebf53cbc45d745784b7695dedf2"}

PR220_WAVES = "docs/reports/data/TETO_PROGRESS2_CONTENT_READINESS_WAVES.json"
PR221_RECIPES = "docs/reports/data/TETO_PROGRESS2_W1_RECIPE_AUTHORING_MATRIX.json"
PR221_INGREDIENTS = "docs/reports/data/TETO_PROGRESS2_W1_INGREDIENT_AUTHORING_MATRIX.json"
PR221_LEDGER = "docs/reports/data/TETO_PROGRESS2_W1_UNRESOLVED_EVIDENCE_LEDGER.json"
SOURCE_MATRIX = "docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json"
MASTER_EVIDENCE = "docs/reports/data/TETO_PIZZADB_172_MASTER-EVIDENCE.json"
INGREDIENT_CATALOG = "data/recipes/ingredient_master_catalog.json"
# Files read from the working tree; they must be byte-identical to MAIN_SHA or the run fails.
MAIN_PINNED_PATHS = [
    MASTER_EVIDENCE,
    SOURCE_MATRIX,
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
OUT_DECISIONS = "TETO_PROGRESS2_W1_OWNER_DECISIONS.json"
OUT_HUMAN = "TETO_PROGRESS2_W1_HUMAN_VISUAL_VERIFICATION.json"

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
GLOBAL_LEDGER = ["REC-01", "REC-02", "REC-03", "REC-04"]
SUPPORTED_SAUCES = {"tomato-sauce", "pesto", "olive-oil"}  # Sauce OD-S1 = A (RecipeSauceProfile union)

# ---------------------------------------------------------------- owner decisions (2026-09-24)
# Recorded verbatim from the owner. These are GAME decisions: none of them adds or changes a
# PIZZA DB fact, and none of them edits the merged canonicalizer tables.
OWNER_DECISIONS = {
    "OD-OLIVE": {
        "value": "BLACK_OLIVE_CANONICAL",
        "kind": "GAME_NORMALIZATION_DECISION",
        "decision": "色指定なし「オリーブ」を既存 ingredient black-olive へ正規化する（ゲーム側 canonicalization policy）。",
        "notAClaimThat": "PIZZA DB の「オリーブ」に色指定がある、または黒オリーブと記載されている。",
        "resolves": ["REC-06", "REC-07", "REC-09"],
        "descriptionAlignment": "関連 description candidate は black-olive（ブラックオリーブ）と整合させる。",
    },
    "OD-PARM": {
        "value": "PARMIGIANO_CANONICAL",
        "kind": "GAME_NORMALIZATION_DECISION",
        "decision": "「パルミジャーノチーズ」を既存 ingredient parmigiano への game-side canonical alias として扱う。",
        "notAClaimThat": "PIZZA DB の新しい事実（exact alias / 表記の確定）。canonicalizer の disposition は likely_alias のまま。",
        "resolves": ["REC-10"],
    },
    "OD-CLAM-GLYPH": {
        "value": "DEDICATED_CLAM_B",
        "kind": "VISUAL_DECISION_FINAL",
        "decidedAt": "2026-09-25",
        "decision": "clam は Preview で Human PASS した専用 visual B（閉じたあさりの二枚貝）を採用する。",
        "supersedes": {"value": "DEFER_TO_VISUAL_GATE", "decidedAt": "2026-09-24",
                       "note": "Visual Gate へ持ち越した判断を、Gate の結果で確定した（矛盾ではなく予定どおりの確定）。"},
        "chosenVisual": {"kind": "DEDICATED_VISUAL", "key": "asari-valve", "label": "dedicated clam B (closed asari valve)"},
        "rejected": ["\U0001F9AA OYSTER", "\U0001F41A SPIRAL SHELL"],
        "ingredientIdKept": "clam",
        "resolves": [],
        "supportsHumanVisualResolution": ["ING-07"],
    },
    "OD-TOMATO-REPRESENTATION": {
        "value": "DEDICATED_FRESH_TOMATO_B",
        "kind": "VISUAL_DECISION_FINAL",
        "decidedAt": "2026-09-25",
        "decision": "fresh-tomato は Human PASS した専用 visual B（トマトの輪切り断面）を採用する。ingredient ID は fresh-tomato のまま、cherry-tomato への alias は禁止。",
        "supersedes": {"value": "TEMPORARY_SHARED_GLYPH", "decidedAt": "2026-09-24",
                       "note": "🍅 共有は Preview 用の暫定 visual だった。Gate で識別性 FAIL（DEDICATED_VISUAL_REQUIRED）→ 専用 visual B が Human PASS。"},
        "chosenVisual": {"kind": "DEDICATED_VISUAL", "key": "tomato-slice-final", "label": "dedicated fresh-tomato B (irregular cross-section slice)"},
        "rejected": ["\U0001F345 shared representation (with cherry-tomato / tomato-sauce)", "dedicated candidate A (tomato-slice: read as salami / pepperoni)"],
        "resolves": [],
        "supportsHumanVisualResolution": ["ING-09"],
        "ingredientIdKept": "fresh-tomato",
        "aliasTo": None,
        "forbiddenAliases": ["cherry-tomato"],
        "deviceVisualGate": "HUMAN_PASS",
    },
    "OD-CAPERS-VISUAL": {
        "value": "DEDICATED_CAPER_CLUSTER",
        "kind": "VISUAL_DECISION_FINAL",
        "decidedAt": "2026-09-25",
        "decision": "capers は Human PASS した専用 visual（小さな蕾の不規則な塊）を採用する。",
        "chosenVisual": {"kind": "DEDICATED_VISUAL", "key": "caper-cluster", "label": "dedicated capers (irregular 3-bud cluster)"},
        "rejected": ["\U0001F7E2 LARGE GREEN CIRCLE"],
        "ingredientIdKept": "capers",
        "resolves": [],
        "supportsHumanVisualResolution": ["ING-02"],
    },
}
DECISION_DATE = "2026-09-24"
VISUAL_DECISION_DATE = "2026-09-25"

# ---------------------------------------------------------------- human visual verification (2026-09-25)
# HUMAN_VISUAL_VERIFICATION evidence class: owner-relayed result of the W1 Ingredient Visual Gate on
# the preview-only visual-gate build (branch claude/w1-ingredient-visual-preview-mt4uxw). Kept apart
# from PIZZA_DB_EVIDENCE and from GAME_NORMALIZATION_DECISION. The MP4 is never committed.
PREVIEW_URL = "https://perusonao.github.io/teto-pizza-game-preview/w1-visual-gate/"
HUMAN_SESSIONS = {
    "HVG-1": {
        "previewSourceSha": "ea8ae74b898698b7550bc8cf6ddd7f9382bc044b",
        "previewRepoSha": "a0f34c150d45d1b8ba0e374619f56c2b816a47ee",
        "gateReport": "docs/reports/TETO_PROGRESS2_W1_INGREDIENT_VISUAL_GATE_2.md",
        "gateResult": "docs/reports/data/TETO_PROGRESS2_W1_VISUAL_GATE_2_RESULT.json",
        "evidence": ["iPhone Safari real-device Human Visual Gate (owner-relayed)"],
    },
    "HVG-2": {
        "previewSourceSha": "fe80e3c2ee4f0d7d3967cbe35780d819e7f842e7",
        "previewRepoSha": "0e1e6028ad3a0f89949a8be5c15fe2bf6c215097",
        "gateReport": "docs/reports/TETO_PROGRESS2_W1_INGREDIENT_VISUAL_GATE_3.md",
        "gateResult": "docs/reports/data/TETO_PROGRESS2_W1_VISUAL_GATE_3_RESULT.json",
        "evidence": [
            "iPhone Safari real-device Human Visual Gate (owner-relayed)",
            "Human Verification MP4 w1-fresh-tomato-B-human-verification-390x844.mp4 (390x844 H.264 63.97 s, sha256 bf545dcebca7abda84b991cd520580b3595b60c7c928a089abc71aee7d1734a0; delivered in-session, not committed)",
        ],
    },
}
HUMAN_VERIFIED_VISUALS = {
    "fresh-tomato": {"session": "HVG-2", "approvedVisual": {"kind": "DEDICATED_VISUAL", "key": "tomato-slice-final"},
                     "ownerDecision": "OD-TOMATO-REPRESENTATION",
                     "comparedAgainst": ["cherry-tomato", "pepperoni", "tomato-sauce", "dedicated candidate A"],
                     "contexts": ["tray", "pizza raw", "pizza baked", "deep bake", "RESULT icons", "16px", "grayscale", "red/green colour simulation"]},
    "capers": {"session": "HVG-1", "approvedVisual": {"kind": "DEDICATED_VISUAL", "key": "caper-cluster"},
               "ownerDecision": "OD-CAPERS-VISUAL",
               "comparedAgainst": ["black-olive", "pepperoni", "garlic"],
               "contexts": ["tray", "pizza raw", "pizza baked", "16px", "grayscale", "red/green colour simulation"]},
    "clam": {"session": "HVG-1", "approvedVisual": {"kind": "DEDICATED_VISUAL", "key": "asari-valve"},
             "ownerDecision": "OD-CLAM-GLYPH",
             "comparedAgainst": ["\U0001F9AA oyster (A)", "garlic", "parmigiano", "olive-oil base"],
             "contexts": ["tray", "pizza raw", "pizza baked", "16px", "grayscale"]},
    "eggplant": {"session": "HVG-1", "approvedVisual": {"kind": "EMOJI", "glyph": "\U0001F346"}, "ownerDecision": None,
                 "comparedAgainst": ["tomato-sauce base", "mozzarella", "basil"], "contexts": ["tray", "pizza raw", "pizza baked", "16px"]},
    "corn": {"session": "HVG-1", "approvedVisual": {"kind": "EMOJI", "glyph": "\U0001F33D"}, "ownerDecision": None,
             "comparedAgainst": ["egg", "ham", "mozzarella"], "contexts": ["tray", "pizza raw", "pizza baked", "16px"]},
    "pineapple": {"session": "HVG-1", "approvedVisual": {"kind": "EMOJI", "glyph": "\U0001F34D"}, "ownerDecision": None,
                  "comparedAgainst": ["ham", "corn", "mozzarella"], "contexts": ["tray", "pizza raw", "pizza baked", "16px"]},
    "potato": {"session": "HVG-1", "approvedVisual": {"kind": "EMOJI", "glyph": "\U0001F954"}, "ownerDecision": None,
               "comparedAgainst": ["pesto base", "mozzarella", "baked crust"], "contexts": ["tray", "pizza raw", "pizza baked", "16px"]},
}
DEDICATED_VISUAL_KEYS = {"fresh-tomato": "tomato-slice-final", "capers": "caper-cluster", "clam": "asari-valve"}
# The same Human-approved visuals under their production renderer names (src/components/IngredientGlyph.tsx).
PRODUCTION_VISUAL_KEYS = {"fresh-tomato": "tomato-slice", "capers": "caper-cluster", "clam": "clam-valve"}

# Game canonicalization rule table (GAME_NORMALIZATION_DECISION layer). Keyed by the exact PIZZA DB
# token; evidenceDisposition must equal what the merged canonicalizer still returns.
GAME_CANONICALIZATION_RULES = [
    {
        "ruleId": "GCR-OLIVE-01",
        "token": "オリーブ",
        "match": "exact token only (not オリーブオイル, not any colour/variety-specified olive token)",
        "canonicalId": "black-olive",
        "ownerDecision": "OD-OLIVE",
        "evidenceDisposition": "likely_alias",
        "pizzaDbFact": "PIZZA DB lists plain オリーブ with no colour/variety; colour is NOT a PIZZA DB fact",
        "gameRationale": "black-olive is the existing catalog's only olive-type topping; the game normalizes uncoloured olive to it by owner decision.",
    },
    {
        "ruleId": "GCR-PARM-01",
        "token": "パルミジャーノチーズ",
        "match": "exact token only",
        "canonicalId": "parmigiano",
        "ownerDecision": "OD-PARM",
        "evidenceDisposition": "likely_alias",
        "pizzaDbFact": "PIZZA DB lists パルミジャーノチーズ; this is not recorded as a new PIZZA DB fact",
        "gameRationale": "game-side canonical alias to the existing parmigiano (nameJa パルミジャーノ).",
    },
]
# Words a description candidate uses for an ingredient, and olive wording the game must not assert.
DESCRIPTION_TERMS = {"black-olive": "ブラックオリーブ", "parmigiano": "パルミジャーノ"}
FORBIDDEN_OLIVE = re.compile(r"(?<!ブラック)オリーブ(?!オイル)")
FRESH_TOMATO_TERM = re.compile(r"トマト(?!ソース)")
CHERRY_TOMATO_TERMS = ("チェリートマト", "ミニトマト")


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


# Visual-only production files that later slices may edit (Production Visual P1: IngredientGlyph /
# optional `pieceVisual`). They may drift from MAIN_SHA in the working tree; identity is still proven
# because every identity-bearing output (production ingredient ids / categories / emoji via the probe,
# discovery fixtures, visual requirements) is regenerated and byte-compared by --check, and
# check_visual_descriptors() below forbids any dedicated visual on an id the Human Gate did not pass.
VISUAL_ONLY_DRIFT_ALLOWED = {"src/data/ingredients.ts", "src/components/IngredientPieceVisual.tsx"}


def verify_pins():
    for sha in (MAIN_SHA, PR220_SHA, PR221_SHA, *PREVIOUS_PINS.values()):
        if subprocess.run(["git", "cat-file", "-e", f"{sha}^{{commit}}"], cwd=ROOT).returncode != 0:
            fail(f"commit {sha} not available locally; fetch main and refs/pull/220/head, refs/pull/221/head")
    for path in MAIN_PINNED_PATHS:
        if git("diff", "--name-only", MAIN_SHA, "--", path).strip() and path not in VISUAL_ONLY_DRIFT_ALLOWED:
            fail(f"{path} differs from pinned main {MAIN_SHA[:7]}; re-audit instead of silently passing")
        if git("ls-tree", MAIN_SHA, "--", path).strip() == "":
            fail(f"{path} missing at {MAIN_SHA[:7]}")
        if git("diff", "--name-only", PREVIOUS_PINS["main"], MAIN_SHA, "--", path).strip():
            fail(f"{path} changed between previous main {PREVIOUS_PINS['main'][:7]} and {MAIN_SHA[:7]}: W1 authority meaning may have moved")
    for path in (PR221_RECIPES, PR221_INGREDIENTS, PR221_LEDGER):
        if git("diff", "--name-only", PREVIOUS_PINS["pr221"], PR221_SHA, "--", path).strip():
            fail(f"{path} differs between #221 {PREVIOUS_PINS['pr221'][:7]} and {PR221_SHA[:7]}: re-audit the W1 authoring inputs")


def load_inputs():
    waves, waves_hash = blob(PR220_SHA, PR220_WAVES)
    recipes, recipes_hash = blob(PR221_SHA, PR221_RECIPES)
    ingredients, ingredients_hash = blob(PR221_SHA, PR221_INGREDIENTS)
    ledger, ledger_hash = blob(PR221_SHA, PR221_LEDGER)
    master = json.loads((ROOT / MASTER_EVIDENCE).read_text(encoding="utf-8"))
    catalog = json.loads((ROOT / INGREDIENT_CATALOG).read_text(encoding="utf-8"))
    source_matrix = json.loads((ROOT / SOURCE_MATRIX).read_text(encoding="utf-8"))

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
            "state": "OPEN, Final Codex Gate PASS -- read-only input, not modified",
            "previousHeadSha": PREVIOUS_PINS["pr221"],
            "w1InputsIdenticalToPreviousHead": True,
            "files": {PR221_RECIPES: recipes_hash, PR221_INGREDIENTS: ingredients_hash, PR221_LEDGER: ledger_hash},
        },
        "main": {"sha": MAIN_SHA, "previousSha": PREVIOUS_PINS["main"],
                 "changeSincePrevious": "CI-only (#223: .github/workflows/e2e-webkit.yml, scripts/ci/*); pinned paths identical",
                 "files": {p: hashlib.sha256(git("show", f"{MAIN_SHA}:{p}", binary=True)).hexdigest() for p in MAIN_PINNED_PATHS}},
    }
    return w1_rows, recipes, ingredients, ledger, master, catalog, source_matrix, inputs


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


# ---------------------------------------------------------------- visual descriptor guard

def check_visual_descriptors(production_ingredients):
    """A dedicated visual may only sit on an id whose Human Gate approved exactly that visual; everything
    else (every current production ingredient, cherry-tomato in particular) must stay on the emoji path."""
    for i in production_ingredients:
        visual = i.get("pieceVisual")
        if visual is None:
            continue
        if PRODUCTION_VISUAL_KEYS.get(i["id"]) != visual:
            fail(f"production ingredient {i['id']} carries dedicated visual {visual!r} not approved for that id by the Human Visual Gate")


# ---------------------------------------------------------------- discovery regression (REC-08)

def build_discovery(recipes, ingredients):
    w1 = [{"id": r["recipeIdCandidate"], "ingredients": [x["ingredientId"] for x in r["requiredIngredients"]]}
          for r in recipes["rows"]]
    w1.sort(key=lambda r: EXPECTED_W1.index(r["id"]))
    cats = {r["id"]: r["categoryCandidate"] for r in ingredients["rows"]}
    base = run_probe({"w1": w1, "extraIngredientCategories": cats})
    check_visual_descriptors(base["productionIngredients"])
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
            "verdict": "HUMAN_PASS",
            "verdictEvidenceClass": "HUMAN_VISUAL_VERIFICATION",
            "verdictNote": "Static findings above are the pre-gate analysis. The verdict comes only from the owner-relayed iPhone Safari Human Gate (see docs/reports/data/" + OUT_HUMAN + ").",
            "approvedVisual": HUMAN_VERIFIED_VISUALS[ing]["approvedVisual"],
            "humanSession": HUMAN_VERIFIED_VISUALS[ing]["session"],
            "productionRenderRequirement": ("dedicated (non-emoji) piece visual -- needs a production visual abstraction; the preview-only Vite transform is not production code"
                                            if ing in DEDICATED_VISUAL_KEYS else "existing emoji render path (IngredientPieceVisual emoji branch)"),
        }
        if ing == "clam":
            item["staticFindings"]["glyphCandidatesOnRecord"] = [
                {"emoji": glyph, "unicodeName": glyph_name(glyph), "source": "PR #221 ingredient matrix emojiCandidate"},
                {"emoji": BRIEF_CLAM_GLYPH, "unicodeName": glyph_name(BRIEF_CLAM_GLYPH), "source": "W1 evidence-resolution task brief (clam 🐚 visibility)"},
            ]
            item["staticFindings"]["note"] = ("Neither glyph is a clam: PR #221 proposes OYSTER, the brief names SPIRAL SHELL. "
                                              "Which glyph is authored is an Owner Decision; both need the device check.")
            od = OWNER_DECISIONS["OD-CLAM-GLYPH"]
            item["ownerDecision"] = {"id": "OD-CLAM-GLYPH", "value": od["value"], "chosenVisual": od["chosenVisual"],
                                     "rejected": od["rejected"], "supersedes": od["supersedes"]["value"]}
        if ing == "fresh-tomato":
            od = OWNER_DECISIONS["OD-TOMATO-REPRESENTATION"]
            item["ownerDecision"] = {"id": "OD-TOMATO-REPRESENTATION", "value": od["value"], "chosenVisual": od["chosenVisual"],
                                     "rejected": od["rejected"], "supersedes": od["supersedes"]["value"],
                                     "ingredientIdKept": od["ingredientIdKept"], "aliasTo": od["aliasTo"],
                                     "forbiddenAliases": od["forbiddenAliases"], "deviceVisualGate": od["deviceVisualGate"]}
        if ing == "capers":
            od = OWNER_DECISIONS["OD-CAPERS-VISUAL"]
            item["ownerDecision"] = {"id": "OD-CAPERS-VISUAL", "value": od["value"], "chosenVisual": od["chosenVisual"],
                                     "rejected": od["rejected"]}
        out.append(item)

    focus = {
        "fresh-tomato": "🍅 collision: identical glyph to production cherry-tomato (placed piece) and tomato-sauce (tray chip). OD-TOMATO-REPRESENTATION = TEMPORARY_SHARED_GLYPH allows the shared 🍅 in Preview only; fresh-tomato stays its own id (no cherry-tomato alias). Verify a player can tell fresh-tomato from cherry-tomato on tray and pizza; a cherry-tomato Pesto Caprese renders identically but discovers nothing (see sameGlyphSubstitutionOutcomes). FAIL -> dedicated visual/runtime work.",
        "eggplant": "🍆 visibility: dark-purple glyph on tomato-sauce red and after bake roast tint; verify it stays identifiable at piece size on 390x844 and in reference/thumbnail.",
        "clam": "clam visibility: pale shell glyph (🦪 candidate / 🐚 in brief; OD-CLAM-GLYPH = DEFER_TO_VISUAL_GATE, neither chosen) on olive-oil base with parmigiano and garlic 🧄 (also pale); verify both glyphs read as shellfish, not as garlic or cheese.",
        "capers": "🟢 distinguishability: plain LARGE GREEN CIRCLE beside ⚫ black-olive in Puttanesca and 🔴 pepperoni in the tray -- hue is the only cue (red/green colour-vision risk); verify on device, including a greyscale/CVD pass.",
    }
    return {
        "schemaVersion": 1,
        "kind": "w1_visual_evidence_requirements",
        "policy": "docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md (390x844 authority viewport, video delivered directly, never committed)",
        "prerequisite": "Satisfied: the preview-only visual-gate build (visual-gate/w1) carried the candidate rows; verdicts come from the owner-relayed iPhone Safari Human Gate.",
        "explicitFocus": {k: {"verdict": "HUMAN_PASS", "approvedVisual": HUMAN_VERIFIED_VISUALS[k]["approvedVisual"], "check": v} for k, v in focus.items()},
        "checkContextsPerIngredient": [
            "Ingredient tray chip (390x844, iPhone Safari)",
            "Placed piece on the recipe's sauce + cheese before bake",
            "Same piece after bake (toppingVisualFrame roast tint)",
            "Reference ring / ReferenceThumbnail",
            "RESULT / Dex thumbnail",
            "Side-by-side with every sameGlyph / coPlaced ingredient listed for it",
        ],
        "ingredients": out,
        "previewVisualGateHandoff": {
            "gate": "Preview Visual Gate (390x844 iPhone Safari, docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md)",
            "ingredients": [i["ingredientId"] for i in out],
            "mandatoryFocus": sorted(focus),
            "status": "COMPLETED",
            "result": "7/7 HUMAN_PASS",
            "humanVerificationFile": f"docs/reports/data/{OUT_HUMAN}",
            "ownerDecisionsFinal": {"clam": "OD-CLAM-GLYPH = DEDICATED_CLAM_B (🦪 / 🐚 rejected)",
                                    "fresh-tomato": "OD-TOMATO-REPRESENTATION = DEDICATED_FRESH_TOMATO_B (shared 🍅 and candidate A rejected; own id kept)",
                                    "capers": "OD-CAPERS-VISUAL = DEDICATED_CAPER_CLUSTER (🟢 rejected)"},
        },
    }


# ---------------------------------------------------------------- human visual verification

def build_human():
    rows = []
    for lid, ing in sorted(VISUAL_LEDGER.items(), key=lambda kv: kv[1]):
        v = HUMAN_VERIFIED_VISUALS[ing]
        sess = HUMAN_SESSIONS[v["session"]]
        rows.append({
            "ledgerId": lid,
            "ingredientId": ing,
            "evidenceClass": "HUMAN_VISUAL_VERIFICATION",
            "verificationResult": "HUMAN_PASS",
            "deviceClass": "iPhone Safari",
            "viewportAuthority": "390x844",
            "previewUrl": PREVIEW_URL,
            "previewSourceSha": sess["previewSourceSha"],
            "previewRepoSha": sess["previewRepoSha"],
            "session": v["session"],
            "approvedVisual": v["approvedVisual"],
            "ownerDecision": v["ownerDecision"],
            "comparedAgainst": v["comparedAgainst"],
            "verifiedContexts": v["contexts"],
            "evidence": sess["evidence"],
        })
    return {
        "schemaVersion": 1,
        "kind": "w1_human_visual_verification",
        "evidenceClass": "HUMAN_VISUAL_VERIFICATION",
        "evidenceClassNote": "Owner-relayed human judgement of rendered visuals on a preview-only build. Not PIZZA_DB_EVIDENCE, not EXISTING_CATALOG, not a GAME_NORMALIZATION_DECISION; it says nothing about recipe identity, tokens or quantities.",
        "verifiedAt": VISUAL_DECISION_DATE,
        "previewUrl": PREVIEW_URL,
        "previewBranch": "claude/w1-ingredient-visual-preview-mt4uxw (visual-gate/w1, preview-only; src/** unchanged)",
        "sessions": HUMAN_SESSIONS,
        "videoPolicy": "Human Verification videos are delivered in-session and never committed (docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md).",
        "ingredients": rows,
        "summary": {"HUMAN_PASS": sorted(r["ingredientId"] for r in rows), "result": f"{len(rows)}/{len(rows)} HUMAN_PASS"},
    }


# ---------------------------------------------------------------- owner decisions / game canonicalization

def likely_alias_occurrences(provenance, source_matrix, w1_rows):
    """(recipe, token, canonicalId) for every W1 likely_alias token, read from the PIZZA DB evidence
    (re-classified here) and from the merged matrix tokenTrace; the two must agree."""
    from_evidence = {(p["recipeIdCandidate"], t["token"], t["canonicalId"])
                     for p in provenance["recipes"] for t in p.get("tokens", []) if t["disposition"] == "likely_alias"}
    ev_to_recipe = {r["evidenceId"]: r["canonicalCandidateId"] for r in w1_rows}
    from_matrix = set()
    for r in source_matrix["rows"]:
        rid = ev_to_recipe.get(r.get("evidenceId", r.get("id")))
        if rid:
            from_matrix |= {(rid, t["token"], t["canonicalId"]) for t in r["ingredients"]["tokenTrace"]
                            if t["disposition"] == "likely_alias"}
    if from_evidence != from_matrix:
        fail(f"likely_alias occurrences differ: evidence-only {sorted(from_evidence - from_matrix)}, "
             f"matrix-only {sorted(from_matrix - from_evidence)}")
    return from_evidence


OD_INGREDIENT = (("OD-OLIVE", "black-olive"), ("OD-PARM", "parmigiano"), ("OD-TOMATO-REPRESENTATION", "fresh-tomato"),
                 ("OD-CLAM-GLYPH", "clam"), ("OD-CAPERS-VISUAL", "capers"))


def description_consistency(recipes):
    out = []
    for r in sorted(recipes["rows"], key=lambda x: EXPECTED_W1.index(x["recipeIdCandidate"])):
        req = {x["ingredientId"] for x in r["requiredIngredients"]}
        d = r["descriptionCandidate"]
        checks = {f"{ing} named iff required": (term in d) == (ing in req) for ing, term in DESCRIPTION_TERMS.items()}
        checks["no uncoloured / other-colour olive wording"] = not FORBIDDEN_OLIVE.search(d)
        checks["fresh-tomato named iff required"] = bool(FRESH_TOMATO_TERM.search(d)) == ("fresh-tomato" in req)
        checks["no cherry-tomato wording or id for fresh-tomato"] = not (
            "fresh-tomato" in req and ("cherry-tomato" in req or any(t in d for t in CHERRY_TOMATO_TERMS)))
        related = sorted({od for od, ing in OD_INGREDIENT if ing in req})
        out.append({"recipeIdCandidate": r["recipeIdCandidate"], "descriptionCandidate": d, "relatedOwnerDecisions": related,
                    "checks": checks, "status": "CONSISTENT" if all(checks.values()) else "INCONSISTENT"})
    return out


def build_decisions(ledger, recipes, provenance, occurrences, w1_rows):
    exact_names = canon.load_canonical_names()
    w1_evidence = {r["evidenceId"] for r in w1_rows}
    outside_w1 = {
        "オリーブ": sorted(set(provenance["oliveCensus"]["pizzaDbRowsWithPlainOliveTokenIds"]) - w1_evidence),
        "パルミジャーノチーズ": sorted(set(provenance["parmigianoCensus"]["pizzaDbRowsWithToken"]) - w1_evidence),
    }
    rules = []
    for rule in GAME_CANONICALIZATION_RULES:
        c = canon.classify(rule["token"], exact_names)
        rules.append({
            **rule,
            "layer": "GAME_NORMALIZATION_DECISION",
            "canonicalizerNow": {"disposition": c["disposition"], "canonicalId": c.get("canonicalId"), "rule": c.get("rule")},
            "canonicalizerTableModified": False,
            "w1Applications": sorted(rid for rid, tok, _ in occurrences if tok == rule["token"]),
            "resolvesLedgerIds": sorted(r["id"] for r in ledger["rows"] if (r.get("aliasEvidence") or {}).get("token") == rule["token"]),
            "pizzaDbRowsOutsideW1WithToken": outside_w1[rule["token"]],
            "outsideW1Note": "Token-wide game policy; rows outside W1 are normalized when their wave is authored (not processed here).",
        })
    return {
        "schemaVersion": 1,
        "kind": "w1_owner_decisions",
        "decisionDate": DECISION_DATE,
        "layers": {
            "PIZZA_DB_EVIDENCE": f"{MASTER_EVIDENCE} tokens and the merged canonicalizer dispositions -- unchanged (TOKEN_PROVENANCE is regenerated byte-identically)",
            "GAME_NORMALIZATION_DECISION": "gameCanonicalizationRules below -- owner decisions about how the game represents a token; never a PIZZA DB fact",
            "VISUAL_DECISION_FINAL": "OD-CLAM-GLYPH / OD-TOMATO-REPRESENTATION / OD-CAPERS-VISUAL -- how an ingredient is drawn; never identity, tokens or quantities",
            "HUMAN_VISUAL_VERIFICATION": f"docs/reports/data/{OUT_HUMAN} -- the human evidence the visual decisions rest on",
        },
        "visualDecisionDate": VISUAL_DECISION_DATE,
        "ownerDecisions": OWNER_DECISIONS,
        "gameCanonicalizationRules": rules,
        "descriptionConsistency": description_consistency(recipes),
        "heldConstraints": {
            "sauce": "OD-S1 = A (maintained)",
            "quantities": "authored minCounts unchanged",
            "runtime": "RT-01 not resolved",
            "globals": "REC-01..04 not resolved",
            "visual": "ING-02/03/07/08/09/10/11 resolved only by HUMAN_VISUAL_VERIFICATION (7/7 HUMAN_PASS); identities unchanged",
            "pr221": f"{PR221_SHA} read-only, not modified",
        },
    }


# ---------------------------------------------------------------- resolution ledger

def build_ledger(ledger, recipes, provenance, discovery, decisions, inputs, human):
    olive = provenance["oliveCensus"]
    rule_by_token = {r["token"]: r for r in decisions["gameCanonicalizationRules"]}
    consistency = {c["recipeIdCandidate"]: c["status"] for c in decisions["descriptionConsistency"]}
    rows = []
    for row in ledger["rows"]:
        rid = row["id"]
        entry = {"id": rid, "scope": row["scope"], "pr221Status": row["status"], "field": row["field"]}
        if rid in ("REC-06", "REC-07", "REC-09"):
            recipe = ALIAS_LEDGER[rid]
            rule = rule_by_token["オリーブ"]
            entry.update({
                "resolution": "RESOLVED",
                "resolutionStatus": "RESOLVED_BY_OWNER_DECISION_GAME_NORMALIZATION",
                "evidenceFact": {
                    "PIZZA_DB_EVIDENCE": f"token オリーブ (plain); {olive['pizzaDbRowsWithPlainOliveToken']} PIZZA DB rows use the plain token, {len(olive['pizzaDbColorSpecifiedOliveTokens'])} use a colour-specified olive token",
                    "disposition": rule["canonicalizerNow"]["disposition"],
                    "EXISTING_CATALOG": f"likely_alias -> black-olive (LIKELY_ALIAS_TABLE, unchanged); catalog olive ids = {olive['existingCatalogOliveIds']}",
                    "colourIsPizzaDbFact": False,
                },
                "gameNormalization": {"ownerDecision": "OD-OLIVE = BLACK_OLIVE_CANONICAL", "rule": rule["ruleId"],
                                      "token": "オリーブ", "canonicalId": rule["canonicalId"]},
                "gameCanonicalizationRule": rule["ruleId"],
                "descriptionCandidate": {"recipe": recipe, "status": consistency[recipe],
                                         "note": "PR #221 candidate already names ブラックオリーブ; no wording change needed (and #221 is not edited)."},
                "stillOpen": False,
            })
        elif rid == "REC-10":
            rule = rule_by_token["パルミジャーノチーズ"]
            entry.update({
                "resolution": "RESOLVED",
                "resolutionStatus": "RESOLVED_BY_OWNER_DECISION_GAME_NORMALIZATION",
                "evidenceFact": {
                    "PIZZA_DB_EVIDENCE": f"token パルミジャーノチーズ in {provenance['parmigianoCensus']['pizzaDbRowsWithToken']}",
                    "disposition": rule["canonicalizerNow"]["disposition"],
                    "EXISTING_CATALOG": "parmigiano nameJa パルミジャーノ; LIKELY_ALIAS_TABLE entry unchanged (not moved to ORTHOGRAPHIC_EQUIVALENTS)",
                    "newPizzaDbFactRecorded": False,
                },
                "gameNormalization": {"ownerDecision": "OD-PARM = PARMIGIANO_CANONICAL", "rule": rule["ruleId"],
                                      "token": "パルミジャーノチーズ", "canonicalId": rule["canonicalId"]},
                "gameCanonicalizationRule": rule["ruleId"],
                "descriptionCandidate": {"recipe": "parmigiana-pizza", "status": consistency["parmigiana-pizza"],
                                         "note": "PR #221 candidate names パルミジャーノ (the catalog nameJa); no wording change needed."},
                "stillOpen": False,
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
            hv = next(h for h in human["ingredients"] if h["ledgerId"] == rid)
            od_id = HUMAN_VERIFIED_VISUALS[ing]["ownerDecision"]
            entry.update({
                "resolution": "RESOLVED",
                "resolutionStatus": "RESOLVED_BY_HUMAN_VISUAL_VERIFICATION",
                "ingredientId": ing,
                "explicitFocus": ing in STRICT_GLYPH_ITEMS,
                "requirementsFile": f"docs/reports/data/{OUT_VISUAL}",
                "evidence": {"HUMAN_VISUAL_VERIFICATION": {k: hv[k] for k in ("verificationResult", "deviceClass", "previewSourceSha", "previewRepoSha", "previewUrl", "session")}},
                "approvedVisual": hv["approvedVisual"],
                "ownerDecision": f"{od_id} = {OWNER_DECISIONS[od_id]['value']}" if od_id else None,
                "carryForward": ("Production needs a dedicated-visual render path for this id (implementation prerequisite, not an evidence gap)."
                                 if ing in DEDICATED_VISUAL_KEYS else "Production registers the id with its existing emoji (implementation, not evidence)."),
                "stillOpen": False,
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
    globals_open = [x for x in GLOBAL_LEDGER if x in open_ids]
    per_recipe = []
    for r in sorted(recipes["rows"], key=lambda x: EXPECTED_W1.index(x["recipeIdCandidate"])):
        specific = [x for x in r["unresolvedRefs"] if x in open_ids]
        effective = specific + globals_open
        req = {x["ingredientId"] for x in r["requiredIngredients"]}
        per_recipe.append({
            "recipeIdCandidate": r["recipeIdCandidate"],
            "resolvedByThisAudit": [x for x in r["unresolvedRefs"] if x not in open_ids],
            "remainingRecipeSpecific": specific,
            "remainingByKind": {
                "ownerDecision": [x for x in specific if x in ALIAS_LEDGER],
                "humanVerification": [x for x in specific if x in VISUAL_LEDGER],
                "runtime": [x for x in specific if x == "RT-01"],
            },
            "relatedOwnerDecisions": sorted({od for od, ing in OD_INGREDIENT if ing in req}),
            # Implementation prerequisites are production work, not open evidence: they never feed readiness.
            "implementationPrerequisites": sorted(f"dedicated visual: {ing} ({DEDICATED_VISUAL_KEYS[ing]})" for ing in req if ing in DEDICATED_VISUAL_KEYS),
            "inheritedGlobalOpen": globals_open,
            "effectiveOpenRefs": effective,
            "recipeSpecificClear": not specific,
            "authoredMinCounts": {x["ingredientId"]: x["minCountCandidate"] for x in r["requiredIngredients"]},
            "sauce": r["sauce"],
            "readiness": derived_readiness(effective),
        })
    totals = {k: sum(p["readiness"] == k for p in per_recipe) for k in ("READY", "REVIEW", "BLOCKED")}
    return {
        "schemaVersion": 1,
        "kind": "w1_evidence_resolution_ledger",
        "inputs": inputs,
        "ownerDecisions": {k: f"{k} = {v['value']}" for k, v in OWNER_DECISIONS.items()},
        "humanVisualVerificationFile": f"docs/reports/data/{OUT_HUMAN}",
        "ownerDecisionsFile": f"docs/reports/data/{OUT_DECISIONS}",
        "ownerDecisionsHeld": {"sauce": "OD-S1 = A (maintained)", "quantities": "authored minCounts unchanged; not trimmed to the 8-slot ring",
                               "completionGate": "#215 production untouched"},
        "readinessRule": "READY only when no recipe-specific ref and no inherited global ref is open (PR #221 derived_readiness); BLOCKED = not safely representable by evidence/current mechanic. Re-derived from every open dependency; implementationPrerequisites never feed it.",
        "rows": rows,
        "resolvedIds": sorted(r["id"] for r in rows if r["resolution"] == "RESOLVED"),
        "unresolvedIds": sorted(r["id"] for r in rows if r["resolution"] == "UNRESOLVED"),
        "unchangedIds": sorted(r["id"] for r in rows if r["resolution"] == "UNCHANGED"),
        "recipes": per_recipe,
        "summary": {**totals,
                    "readyNowRecipes": [p["recipeIdCandidate"] for p in per_recipe if p["readiness"] == "READY"],
                    "recipeSpecificClearRecipes": [p["recipeIdCandidate"] for p in per_recipe if p["recipeSpecificClear"]],
                    "noNewIngredientRecipes": sorted(r["recipeIdCandidate"] for r in recipes["rows"]
                                                     if not set(x["ingredientId"] for x in r["requiredIngredients"]) & set(EXPECTED_NEW_INGREDIENTS))},
    }


def derived_readiness(refs):
    """Same rule as PR #221: READY only when nothing (own or inherited) is open."""
    return "READY" if not refs else "REVIEW"


# ---------------------------------------------------------------- validator (bidirectional invariants)

EXPECTED_OWNER_DECISIONS = {"OD-OLIVE": "BLACK_OLIVE_CANONICAL", "OD-PARM": "PARMIGIANO_CANONICAL",
                            "OD-CLAM-GLYPH": "DEDICATED_CLAM_B", "OD-TOMATO-REPRESENTATION": "DEDICATED_FRESH_TOMATO_B",
                            "OD-CAPERS-VISUAL": "DEDICATED_CAPER_CLUSTER"}
EXPECTED_SUPERSEDED = {"OD-CLAM-GLYPH": "DEFER_TO_VISUAL_GATE", "OD-TOMATO-REPRESENTATION": "TEMPORARY_SHARED_GLYPH"}


def check(cond, msg):
    if not cond:
        raise AssertionError(msg)


def ledger_scope_recipes(row, recipes):
    """Recipes a PR #221 ledger row applies to (recipe-scoped or ingredient-scoped); None for globals."""
    ids = {r["recipeIdCandidate"] for r in recipes["rows"]}
    tokens = {t.strip() for t in row["scope"].split(",")}
    if tokens <= ids:
        return tokens
    if len(tokens) == 1 and row["id"] in VISUAL_LEDGER:
        return {r["recipeIdCandidate"] for r in recipes["rows"] if row["scope"] in {x["ingredientId"] for x in r["requiredIngredients"]}}
    return None


def validate(state, ctx):
    led, dec, vis, hum = state[OUT_LEDGER], state[OUT_DECISIONS], state[OUT_VISUAL], state[OUT_HUMAN]
    recipes, ledger221, occurrences = ctx["recipes"], ctx["ledger221"], ctx["occurrences"]
    rows = {r["id"]: r for r in led["rows"]}
    per = {p["recipeIdCandidate"]: p for p in led["recipes"]}
    src = {r["recipeIdCandidate"]: r for r in recipes["rows"]}

    # Owner decisions are recorded exactly as given.
    check({k: v["value"] for k, v in dec["ownerDecisions"].items()} == EXPECTED_OWNER_DECISIONS, "owner decision values drifted")

    # Evidence vs game decision: every W1 likely_alias occurrence <-> exactly one rule application <-> #221 alias row.
    rules = dec["gameCanonicalizationRules"]
    applied = {(rid, r["token"], r["canonicalId"]) for r in rules for rid in r["w1Applications"]}
    check(applied == occurrences, f"rule applications != likely_alias evidence: missing {sorted(occurrences - applied)}, stale {sorted(applied - occurrences)}")
    alias221 = {(row["scope"], row["aliasEvidence"]["token"], row["aliasEvidence"]["canonicalId"]) for row in ledger221["rows"] if row.get("aliasEvidence")}
    check(alias221 == occurrences, f"#221 alias ledger != likely_alias evidence: {sorted(alias221 ^ occurrences)}")
    for r in rules:
        check(r["layer"] == "GAME_NORMALIZATION_DECISION", f"{r['ruleId']} not in the game-decision layer")
        check(r["evidenceDisposition"] == r["canonicalizerNow"]["disposition"] == "likely_alias",
              f"{r['ruleId']} rewrites the evidence disposition ({r['evidenceDisposition']}) -- a game decision is not a PIZZA DB fact")
        check(r["canonicalizerNow"]["canonicalId"] == r["canonicalId"], f"{r['ruleId']} redirects {r['token']} away from the evidence candidate")
        check(r["canonicalizerTableModified"] is False, f"{r['ruleId']} claims a canonicalizer table change")
        od = dec["ownerDecisions"].get(r["ownerDecision"])
        check(od is not None and od["kind"] == "GAME_NORMALIZATION_DECISION", f"{r['ruleId']} lacks a game-normalization owner decision")
        check(sorted(od["resolves"]) == r["resolvesLedgerIds"], f"{r['ruleId']} resolves {r['resolvesLedgerIds']} != {r['ownerDecision']} {od['resolves']}")

    # Ledger rows <-> rules <-> owner decisions (both ways).
    rule_by_id = {r["ruleId"]: r for r in rules}
    od_resolves = {x: k for k, v in dec["ownerDecisions"].items() for x in v["resolves"]}
    for row in ledger221["rows"]:
        e = rows[row["id"]]
        if row.get("aliasEvidence"):
            rule = rule_by_id.get(e.get("gameCanonicalizationRule"))
            check(e["resolution"] == "RESOLVED" and not e["stillOpen"], f"{row['id']} alias row not resolved")
            check(rule is not None and row["id"] in rule["resolvesLedgerIds"] and rule["token"] == row["aliasEvidence"]["token"],
                  f"{row['id']} resolved without a matching game canonicalization rule")
            check(od_resolves.get(row["id"]) == rule["ownerDecision"], f"{row['id']} not resolved by its owner decision")
            check(e["evidenceFact"]["disposition"] == "likely_alias", f"{row['id']} evidence fact rewritten")
    check(set(led["resolvedIds"]) == {"REC-08"} | set(od_resolves) | set(VISUAL_LEDGER),
          f"resolved set {led['resolvedIds']} != REC-08 + owner-decision set + human-verified visual set")
    for rid in led["resolvedIds"]:
        check(rows[rid]["resolution"] == "RESOLVED" and not rows[rid]["stillOpen"], f"{rid} listed resolved but open")

    # Held constraints.
    for g in GLOBAL_LEDGER:
        check(rows[g]["stillOpen"] and rows[g]["resolution"] == "UNCHANGED", f"global {g} must stay open")
    check(rows["RT-01"]["stillOpen"] and rows["RT-01"]["resolutionStatus"] == "RUNTIME_DEPENDENCY_REQUIRED", "RT-01 must stay open")
    over = {rid for rid, r in src.items() if not r["referenceCapacity"]["fits"]}
    check(ledger_scope_recipes(rows["RT-01"], recipes) == over, "RT-01 scope != over-capacity recipes")
    check({rid for rid, p in per.items() if "RT-01" in p["remainingByKind"]["runtime"]} == over, "RT-01 carriers != over-capacity recipes")
    check(rows["REC-11"]["resolutionStatus"] == "OWNER_DECISION_RECORDED" and led["ownerDecisionsHeld"]["sauce"].startswith("OD-S1 = A"),
          "Sauce OD-S1 = A not held")
    for rid, p in per.items():
        check(p["sauce"] == src[rid]["sauce"] in SUPPORTED_SAUCES, f"{rid} sauce outside OD-S1 = A")
        check(p["authoredMinCounts"] == {x["ingredientId"]: x["minCountCandidate"] for x in src[rid]["requiredIngredients"]},
              f"{rid} authored quantities changed")

    # Visual: each ING row is resolved only by HUMAN_VISUAL_VERIFICATION; decisions are final, keep ids, never alias.
    check(hum["evidenceClass"] == "HUMAN_VISUAL_VERIFICATION", "human evidence class drifted")
    hum_by = {h["ingredientId"]: h for h in hum["ingredients"]}
    check(sorted(hum_by) == EXPECTED_NEW_INGREDIENTS, "human verification != the 7 new ingredients")
    vis_by = {i["ingredientId"]: i for i in vis["ingredients"]}
    for lid, ing in VISUAL_LEDGER.items():
        row, h, v = rows[lid], hum_by[ing], vis_by[ing]
        check(not row["stillOpen"] and row["resolution"] == "RESOLVED" and row["resolutionStatus"] == "RESOLVED_BY_HUMAN_VISUAL_VERIFICATION",
              f"{lid} must be resolved by human visual verification")
        check(set(row["evidence"]) == {"HUMAN_VISUAL_VERIFICATION"}, f"{lid} human result recorded under another evidence class {sorted(row['evidence'])}")
        check(h["evidenceClass"] == "HUMAN_VISUAL_VERIFICATION" and h["verificationResult"] == "HUMAN_PASS" and h["deviceClass"] == "iPhone Safari",
              f"{ing} human verification incomplete")
        check(re.fullmatch(r"[0-9a-f]{40}", h["previewSourceSha"] or "") and re.fullmatch(r"[0-9a-f]{40}", h["previewRepoSha"] or "")
              and h["previewUrl"] == PREVIEW_URL, f"{ing} human verification lacks exact preview provenance")
        check(v["verdict"] == "HUMAN_PASS" and v["verdictEvidenceClass"] == "HUMAN_VISUAL_VERIFICATION", f"{ing} visual verdict {v['verdict']}")
        check(v["approvedVisual"] == h["approvedVisual"] == row["approvedVisual"], f"{ing} approved visual disagrees across files")
        dedicated = DEDICATED_VISUAL_KEYS.get(ing)
        check((h["approvedVisual"].get("key") == dedicated) if dedicated else h["approvedVisual"]["kind"] == "EMOJI",
              f"{ing} approved visual {h['approvedVisual']} != human-passed candidate")
    check(all(v["verdict"] == "HUMAN_PASS" for v in vis["explicitFocus"].values()), "explicit focus item not HUMAN_PASS")
    check(sorted(vis["previewVisualGateHandoff"]["ingredients"]) == EXPECTED_NEW_INGREDIENTS, "visual gate handoff != 7 new ingredients")
    for od_id, old in EXPECTED_SUPERSEDED.items():
        check(dec["ownerDecisions"][od_id]["supersedes"]["value"] == old, f"{od_id} history lost (must record it supersedes {old})")
    for od_id, ing in (("OD-CLAM-GLYPH", "clam"), ("OD-TOMATO-REPRESENTATION", "fresh-tomato"), ("OD-CAPERS-VISUAL", "capers")):
        od = dec["ownerDecisions"][od_id]
        check(od["kind"] == "VISUAL_DECISION_FINAL" and od["resolves"] == [], f"{od_id} must be a visual decision that resolves no evidence row by itself")
        check(od["chosenVisual"]["key"] == DEDICATED_VISUAL_KEYS[ing] == vis_by[ing]["ownerDecision"]["chosenVisual"]["key"], f"{od_id} chosen visual drift")
        check(od["ingredientIdKept"] == ing, f"{od_id} changes the ingredient id")
    check(any("OYSTER" in x for x in dec["ownerDecisions"]["OD-CLAM-GLYPH"]["rejected"]) and any("SPIRAL" in x for x in dec["ownerDecisions"]["OD-CLAM-GLYPH"]["rejected"]),
          "clam must reject 🦪 and 🐚")
    tom = dec["ownerDecisions"]["OD-TOMATO-REPRESENTATION"]
    check(tom["aliasTo"] is None and vis_by["fresh-tomato"]["ownerDecision"]["aliasTo"] is None and tom["ingredientIdKept"] == "fresh-tomato"
          and tom["forbiddenAliases"] == ["cherry-tomato"], "fresh-tomato must keep its own id (no alias)")
    check(tom["deviceVisualGate"] == "HUMAN_PASS" and hum_by["fresh-tomato"]["previewSourceSha"] == HUMAN_SESSIONS["HVG-2"]["previewSourceSha"],
          "fresh-tomato B must rest on the HVG-2 (fe80e3c) human pass")
    check(any("\U0001F345" in x for x in tom["rejected"]) and any("candidate A" in x for x in tom["rejected"]), "fresh-tomato must reject shared 🍅 and candidate A")
    check(any("\U0001F7E2" in x for x in dec["ownerDecisions"]["OD-CAPERS-VISUAL"]["rejected"]), "capers must reject 🟢")
    for rid, p in per.items():
        if "fresh-tomato" in p["authoredMinCounts"]:
            check("cherry-tomato" not in p["authoredMinCounts"], f"{rid} substitutes cherry-tomato for fresh-tomato")
        req = set(p["authoredMinCounts"])
        check(p["implementationPrerequisites"] == sorted(f"dedicated visual: {i} ({DEDICATED_VISUAL_KEYS[i]})" for i in req if i in DEDICATED_VISUAL_KEYS),
              f"{rid} implementation prerequisites drift")

    # Description candidates agree with the decisions (recomputed from the #221 input, not trusted).
    recomputed = description_consistency(recipes)
    bad = [(c["recipeIdCandidate"], [k for k, v in c["checks"].items() if not v]) for c in recomputed if c["status"] != "CONSISTENT"]
    check(not bad, f"description candidates inconsistent with owner decisions: {bad}")
    check(recomputed == dec["descriptionConsistency"], "description consistency record is stale")

    # Recipe <-> ledger links (both ways) and readiness.
    for row in ledger221["rows"]:
        scope = ledger_scope_recipes(row, recipes)
        if scope is None:
            continue
        e = rows[row["id"]]
        field = "remainingRecipeSpecific" if e["stillOpen"] else "resolvedByThisAudit"
        other = "resolvedByThisAudit" if e["stillOpen"] else "remainingRecipeSpecific"
        carriers = {rid for rid, p in per.items() if row["id"] in p[field]}
        check(carriers == scope, f"{row['id']} link mismatch: orphaned from {sorted(scope - carriers)}, out of scope {sorted(carriers - scope)}")
        check(not any(row["id"] in p[other] for p in per.values()), f"{row['id']} listed on the wrong side")
    for rid, p in per.items():
        check(sorted(p["resolvedByThisAudit"] + p["remainingRecipeSpecific"]) == sorted(src[rid]["unresolvedRefs"]), f"{rid} refs not partitioned")
        check(p["inheritedGlobalOpen"] == GLOBAL_LEDGER, f"{rid} does not inherit REC-01..04")
        check(p["effectiveOpenRefs"] == p["remainingRecipeSpecific"] + p["inheritedGlobalOpen"], f"{rid} effective refs drift")
        check(p["readiness"] == derived_readiness(p["effectiveOpenRefs"]), f"{rid} readiness {p['readiness']} not derived")
        check(p["recipeSpecificClear"] == (not p["remainingRecipeSpecific"]), f"{rid} recipeSpecificClear drift")
    totals = {k: sum(p["readiness"] == k for p in per.values()) for k in ("READY", "REVIEW", "BLOCKED")}
    check({k: led["summary"][k] for k in totals} == totals, "summary totals drift")
    check(led["summary"]["readyNowRecipes"] == [rid for rid in EXPECTED_W1 if per[rid]["readiness"] == "READY"], "readyNow drift")


MUTATIONS = [
    ("OD-OLIVE value flipped", lambda s, c: s[OUT_DECISIONS]["ownerDecisions"]["OD-OLIVE"].update(value="GENERIC_OLIVE")),
    ("olive rule removed", lambda s, c: s[OUT_DECISIONS]["gameCanonicalizationRules"].pop(0)),
    ("rule records a PIZZA DB fact (exact_alias)", lambda s, c: s[OUT_DECISIONS]["gameCanonicalizationRules"][0].update(evidenceDisposition="exact_alias")),
    ("rule redirects olive to another id", lambda s, c: s[OUT_DECISIONS]["gameCanonicalizationRules"][0].update(canonicalId="green-olive")),
    ("rule claims canonicalizer table edit", lambda s, c: s[OUT_DECISIONS]["gameCanonicalizationRules"][1].update(canonicalizerTableModified=True)),
    ("REC-07 resolved without rule", lambda s, c: next(r for r in s[OUT_LEDGER]["rows"] if r["id"] == "REC-07").update(gameCanonicalizationRule=None)),
    ("REC-10 reopened but not carried", lambda s, c: next(r for r in s[OUT_LEDGER]["rows"] if r["id"] == "REC-10").update(stillOpen=True, resolution="UNRESOLVED")),
    ("evidence fact rewritten", lambda s, c: next(r for r in s[OUT_LEDGER]["rows"] if r["id"] == "REC-06")["evidenceFact"].update(disposition="exact_alias")),
    ("uncovered likely_alias occurrence", lambda s, c: c["occurrences"].add(("hawaiian", "パイン", "pineapple"))),
    ("RT-01 resolved", lambda s, c: next(r for r in s[OUT_LEDGER]["rows"] if r["id"] == "RT-01").update(stillOpen=False, resolution="RESOLVED")),
    ("RT-01 dropped from portuguesa", lambda s, c: next(p for p in s[OUT_LEDGER]["recipes"] if p["recipeIdCandidate"] == "pizza-portuguesa")["remainingByKind"].update(runtime=[])),
    ("REC-01 resolved", lambda s, c: next(r for r in s[OUT_LEDGER]["rows"] if r["id"] == "REC-01").update(stillOpen=False)),
    ("ING-09 reopened while listed resolved", lambda s, c: next(r for r in s[OUT_LEDGER]["rows"] if r["id"] == "ING-09").update(stillOpen=True)),
    ("capers verdict reverted to HVR", lambda s, c: next(i for i in s[OUT_VISUAL]["ingredients"] if i["ingredientId"] == "capers").update(verdict="HUMAN_VERIFICATION_REQUIRED")),
    ("clam decision reverted to DEFER", lambda s, c: s[OUT_DECISIONS]["ownerDecisions"]["OD-CLAM-GLYPH"].update(value="DEFER_TO_VISUAL_GATE")),
    ("clam 🦪 un-rejected", lambda s, c: s[OUT_DECISIONS]["ownerDecisions"]["OD-CLAM-GLYPH"]["rejected"].pop(0)),
    ("clam chosen visual = oyster", lambda s, c: s[OUT_DECISIONS]["ownerDecisions"]["OD-CLAM-GLYPH"]["chosenVisual"].update(key="oyster")),
    ("fresh-tomato aliased to cherry-tomato", lambda s, c: s[OUT_DECISIONS]["ownerDecisions"]["OD-TOMATO-REPRESENTATION"].update(aliasTo="cherry-tomato")),
    ("fresh-tomato approved visual = shared 🍅", lambda s, c: next(h for h in s[OUT_HUMAN]["ingredients"] if h["ingredientId"] == "fresh-tomato").update(approvedVisual={"kind": "EMOJI", "glyph": "\U0001F345"})),
    ("fresh-tomato approved = candidate A", lambda s, c: [x["approvedVisual"].update(key="tomato-slice") for x in (next(h for h in s[OUT_HUMAN]["ingredients"] if h["ingredientId"] == "fresh-tomato"), next(i for i in s[OUT_VISUAL]["ingredients"] if i["ingredientId"] == "fresh-tomato"), next(r for r in s[OUT_LEDGER]["rows"] if r["id"] == "ING-09"))]),
    ("fresh-tomato pass rests on HVG-1", lambda s, c: next(h for h in s[OUT_HUMAN]["ingredients"] if h["ingredientId"] == "fresh-tomato").update(previewSourceSha=HUMAN_SESSIONS["HVG-1"]["previewSourceSha"])),
    ("tomato decision history dropped", lambda s, c: s[OUT_DECISIONS]["ownerDecisions"]["OD-TOMATO-REPRESENTATION"]["supersedes"].update(value=None)),
    ("human pass recorded as PIZZA DB evidence", lambda s, c: next(r for r in s[OUT_LEDGER]["rows"] if r["id"] == "ING-08")["evidence"].update(PIZZA_DB_EVIDENCE="corn verified")),
    ("human pass without device class", lambda s, c: next(h for h in s[OUT_HUMAN]["ingredients"] if h["ingredientId"] == "potato").update(deviceClass=None)),
    ("human pass without exact preview SHA", lambda s, c: next(h for h in s[OUT_HUMAN]["ingredients"] if h["ingredientId"] == "corn").update(previewSourceSha="fe80e3c")),
    ("capers 🟢 un-rejected", lambda s, c: s[OUT_DECISIONS]["ownerDecisions"]["OD-CAPERS-VISUAL"].update(rejected=[])),
    ("visual OD resolves an evidence row by itself", lambda s, c: s[OUT_DECISIONS]["ownerDecisions"]["OD-CLAM-GLYPH"].update(resolves=["ING-07"])),
    ("implementation prerequisite dropped", lambda s, c: next(p for p in s[OUT_LEDGER]["recipes"] if p["recipeIdCandidate"] == "pesto-caprese").update(implementationPrerequisites=[])),
    ("visual gate handoff drops eggplant", lambda s, c: s[OUT_VISUAL]["previewVisualGateHandoff"]["ingredients"].remove("eggplant")),
    ("quantity changed", lambda s, c: next(p for p in s[OUT_LEDGER]["recipes"] if p["recipeIdCandidate"] == "puttanesca-pizza")["authoredMinCounts"].update({"black-olive": 1})),
    ("sauce OD changed", lambda s, c: s[OUT_LEDGER]["ownerDecisionsHeld"].update(sauce="OD-S1 = B")),
    ("description says plain オリーブ", lambda s, c: next(r for r in c["recipes"]["rows"] if r["recipeIdCandidate"] == "pesto-tonno").update(
        descriptionCandidate=next(r for r in c["recipes"]["rows"] if r["recipeIdCandidate"] == "pesto-tonno")["descriptionCandidate"].replace("ブラックオリーブ", "オリーブ"))),
    ("description says グリーンオリーブ", lambda s, c: next(r for r in c["recipes"]["rows"] if r["recipeIdCandidate"] == "puttanesca-pizza").update(
        descriptionCandidate=next(r for r in c["recipes"]["rows"] if r["recipeIdCandidate"] == "puttanesca-pizza")["descriptionCandidate"].replace("ブラックオリーブ", "グリーンオリーブ"))),
    ("description says チェリートマト", lambda s, c: next(r for r in c["recipes"]["rows"] if r["recipeIdCandidate"] == "pesto-caprese").update(
        descriptionCandidate=next(r for r in c["recipes"]["rows"] if r["recipeIdCandidate"] == "pesto-caprese")["descriptionCandidate"].replace("トマト、", "チェリートマト、"))),
    ("pesto-tonno forced READY", lambda s, c: next(p for p in s[OUT_LEDGER]["recipes"] if p["recipeIdCandidate"] == "pesto-tonno").update(readiness="READY")),
    ("hawaiian forced READY on visual pass alone", lambda s, c: next(p for p in s[OUT_LEDGER]["recipes"] if p["recipeIdCandidate"] == "hawaiian").update(readiness="READY")),
    ("melanzane drops resolved ING-03 (orphan)", lambda s, c: next(p for p in s[OUT_LEDGER]["recipes"] if p["recipeIdCandidate"] == "melanzane-pizza")["resolvedByThisAudit"].remove("ING-03")),
    ("parmigiana drops RT-01 while ING-03 resolved", lambda s, c: next(p for p in s[OUT_LEDGER]["recipes"] if p["recipeIdCandidate"] == "parmigiana-pizza")["remainingRecipeSpecific"].remove("RT-01")),
    ("resolved REC-10 still carried", lambda s, c: next(p for p in s[OUT_LEDGER]["recipes"] if p["recipeIdCandidate"] == "parmigiana-pizza")["remainingRecipeSpecific"].append("REC-10")),
    ("summary totals edited", lambda s, c: s[OUT_LEDGER]["summary"].update(READY=1, REVIEW=9)),
]


def self_test(state, ctx):
    validate(state, ctx)
    missed = []
    for name, mutate in MUTATIONS:
        s, c = copy.deepcopy(state), copy.deepcopy(ctx)
        mutate(s, c)
        try:
            validate(s, c)
        except AssertionError as exc:
            print(f"  caught  {name}: {exc}")
            continue
        missed.append(name)
        print(f"  MISSED  {name}")
    if missed:
        fail(f"validator missed {len(missed)} mutation(s): {missed}")
    print(f"PASS: mutation self-test {len(MUTATIONS)}/{len(MUTATIONS)} caught (baseline valid)")


def dump(obj):
    return json.dumps(obj, ensure_ascii=False, indent=2) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()

    verify_pins()
    w1_rows, recipes, ingredients, ledger, master, catalog, source_matrix, inputs = load_inputs()
    provenance = build_provenance(w1_rows, recipes, master, catalog)
    if provenance["w1LikelyAliasTokens"] != sorted(["オリーブ->black-olive", "パルミジャーノチーズ->parmigiano"]):
        fail(f"unexpected W1 likely_alias token set: {provenance['w1LikelyAliasTokens']}")
    occurrences = likely_alias_occurrences(provenance, source_matrix, w1_rows)
    discovery = build_discovery(recipes, ingredients)
    visual = build_visual(ingredients, discovery, recipes)
    decisions = build_decisions(ledger, recipes, provenance, occurrences, w1_rows)
    human = build_human()
    resolution = build_ledger(ledger, recipes, provenance, discovery, decisions, inputs, human)

    outputs = {OUT_LEDGER: resolution, OUT_PROVENANCE: provenance, OUT_DISCOVERY: discovery, OUT_VISUAL: visual,
               OUT_DECISIONS: decisions, OUT_HUMAN: human}
    ctx = {"recipes": recipes, "ledger221": ledger, "occurrences": occurrences}
    try:
        validate(outputs, ctx)
    except AssertionError as exc:
        fail(f"invariant violated: {exc}")
    if args.self_test:
        self_test(outputs, ctx)
        return
    s = resolution["summary"]
    summary = (f"resolved={resolution['resolvedIds']}, unresolved={resolution['unresolvedIds']}, "
               f"READY={s['READY']}, REVIEW={s['REVIEW']}, BLOCKED={s['BLOCKED']}")
    if args.check:
        drift = [n for n, o in outputs.items() if not (OUT_DIR / n).exists() or (OUT_DIR / n).read_text(encoding="utf-8") != dump(o)]
        if drift:
            fail(f"generated output differs from committed file(s): {drift}")
        print(f"PASS: W1 evidence resolution reproducible and invariants hold ({summary})")
        return
    for name, obj in outputs.items():
        (OUT_DIR / name).write_text(dump(obj), encoding="utf-8")
    print(f"wrote {len(outputs)} files; {summary}")


if __name__ == "__main__":
    main()
