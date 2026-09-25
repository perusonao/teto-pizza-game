#!/usr/bin/env python3
"""Progression 2.0 W1 -- Ingredient Visual Gate slice 2 (dedicated preview candidates) result.

Writes docs/reports/data/TETO_PROGRESS2_W1_VISUAL_GATE_2_RESULT.json and validates:

  - every candidate status is one of PREVIEW_CANDIDATE_OK / DEDICATED_VISUAL_REQUIRED /
    HUMAN_VERIFICATION_REQUIRED (PREVIEW_CANDIDATE_OK = "may go to the device Human Gate", never
    a production-adoption PASS); nothing is marked PASS or adopted for production;
  - fresh-tomato / capers / clam keep their ingredient ids (visual-only change, no alias);
  - clam keeps OD-CLAM-GLYPH = DEFER_TO_VISUAL_GATE (A and B compared, none chosen);
  - every referenced screenshot exists; the Preview records an exact 40-hex source SHA;
  - slice 1's result and the evidence / Owner Decision inputs are pinned by sha256 and unchanged,
    and the evidence ledger still reads READY 0 / REVIEW 10 / BLOCKED 0 with RT-01 / REC-01..04
    and every ING row open.

Usage: python3 tools/w1_visual_gate_2_result.py [--check | --self-test]
"""
from __future__ import annotations

import copy
import hashlib
import json
import subprocess
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs/reports/data/TETO_PROGRESS2_W1_VISUAL_GATE_2_RESULT.json"
SHOT_DIR = "docs/reports/screenshots/w1-ingredient-visual-gate-2"
BEFORE_DIR = "docs/reports/screenshots/w1-ingredient-visual-gate"
LEDGER = "docs/reports/data/TETO_PROGRESS2_W1_EVIDENCE_RESOLUTION_LEDGER.json"
PINNED = [
    LEDGER,
    "docs/reports/data/TETO_PROGRESS2_W1_VISUAL_EVIDENCE_REQUIREMENTS.json",
    "docs/reports/data/TETO_PROGRESS2_W1_OWNER_DECISIONS.json",
    "docs/reports/data/TETO_PROGRESS2_W1_DISCOVERY_REGRESSION_FIXTURES.json",
    "docs/reports/data/TETO_PROGRESS2_W1_VISUAL_GATE_RESULT.json",
]

STATUSES = ("PREVIEW_CANDIDATE_OK", "DEDICATED_VISUAL_REQUIRED", "HUMAN_VERIFICATION_REQUIRED")
VIEWPORTS = ("390x844", "360x800")

PREVIEW_SOURCE_SHA = "ea8ae74b898698b7550bc8cf6ddd7f9382bc044b"
PREVIEW = {
    "url": "https://perusonao.github.io/teto-pizza-game-preview/w1-visual-gate/",
    "pages": {
        "hub": "index.html (Human Verification entry; one-tap seeded links)",
        "gameClamA": "game.html?seed=all",
        "gameClamB": "game.html?seed=all&clam=dedicated",
        "board": "board.html",
        "legacyBefore": "game.html?seed=all&w1visual=emoji",
    },
    "sourceRepo": "perusonao/teto-pizza-game",
    "sourceBranch": "claude/w1-ingredient-visual-preview-mt4uxw",
    "sourceSha": PREVIEW_SOURCE_SHA,
    "shaShownOnEveryPage": True,
    "deployRepo": "perusonao/teto-pizza-game-preview",
    "deployCommit": "a0f34c150d45d1b8ba0e374619f56c2b816a47ee",
    "deployPath": "site/w1-visual-gate/ (additive; the existing top-level preview e5d5452 is unchanged)",
    "pagesRun": "https://github.com/perusonao/teto-pizza-game-preview/actions/runs/36031443175 (success)",
    "productionPagesTouched": False,
    "saveKey": "teto-pizza-w1-visual-gate-save-v1 (never teto-pizza-save-v1 / teto-pizza-preview-save-v1)",
    "liveUrlFetchedFromSandbox": False,
    "liveVerification": "perusonao.github.io is egress-blocked from this sandbox; the deployed tree was verified byte-identical (diff -r) to the bundle the Chromium E2E suite ran against.",
}


def shots(*names: str) -> dict[str, list[str]]:
    return {vp: [f"{SHOT_DIR}/{vp}/{name}.png" for name in names] for vp in VIEWPORTS}


def vp(visual: str) -> dict[str, str]:
    return {"layout": "AUTOMATED_CHECKS_PASSED", "visual": visual}


CANDIDATES = [
    {
        "ingredientId": "fresh-tomato",
        "ledgerId": "ING-09",
        "candidate": "dedicated:tomato-slice",
        "candidateVisual": "flat cross-section slice: dark skin ring + outline, pale core, 4 pale seed chambers with seeds; no calyx (SVG, W1Glyph)",
        "replaces": "🍅 shared with cherry-tomato / tomato-sauce (slice 1: DEDICATED_VISUAL_REQUIRED)",
        "identity": {"ingredientId": "fresh-tomato", "aliasOf": None, "distinctFrom": "cherry-tomato"},
        "comparedAgainst": ["cherry-tomato 🍅 (whole, calyx)", "tomato-sauce (spread; 🍅 only on its tray chip / RESULT list)"],
        "rawResult": "AI_OBSERVED: wheel/cross-section silhouette vs whole 🍅 -- distinguishable on sauce, cheese and pesto",
        "bakedResult": "AI_OBSERVED: heat 1.0 / 1.6 keep the ring + chamber pattern; still distinct from 🍅",
        "shapeOnlyResult": "AI_OBSERVED: grayscale keeps the ring + pale chambers vs the 🍅 calyx silhouette -- not colour-dependent",
        "smallPieceResult": "AI_OBSERVED: 16px thumbnail and RESULT-list size still read as a slice vs 🍅",
        "trayResult": "Own chip drawing (slice) next to チェリートマト 🍅 and the sauce tray's トマトソース 🍅",
        "watchItems": [
            "renders ~25% smaller than neighbouring emoji (SVG fills its 1em box less than Noto/Apple glyphs)",
            "at a glance the dotted red disc could read as salami / pepperoni slice -- human check",
            "flat-vector style next to emoji style",
        ],
        "viewport390x844": vp("PREVIEW_CANDIDATE_OK"),
        "viewport360x800": vp("PREVIEW_CANDIDATE_OK"),
        "status": "PREVIEW_CANDIDATE_OK",
        "reason": "Shape-based distinction from cherry-tomato and tomato-sauce holds raw, baked, grayscale and at small size; ready for the device Human Gate. Not a production PASS.",
        "requiredFollowUp": "iPhone Human Verification (tray / pizza / baked / RESULT); decide size parity with emoji.",
        "screenshots": shots("tomato-1-tray", "tomato-2-raw-stage", "tomato-3-baked-stage", "tomato-4-result", "busy-2-raw-stage", "busy-3-baked-stage", "board-tomato"),
        "before": {vp_: [f"{BEFORE_DIR}/{vp_}/tomato-2-raw-stage.png", f"{BEFORE_DIR}/{vp_}/board-tomato.png"] for vp_ in VIEWPORTS},
    },
    {
        "ingredientId": "capers",
        "ledgerId": "ING-02",
        "candidate": "dedicated:caper-cluster",
        "candidateVisual": "irregular cluster of 3 small pointed olive-green buds of different sizes, dark outline, bud line + highlight (SVG, W1Glyph)",
        "replaces": "🟢 single circle (slice 1: DEDICATED_VISUAL_REQUIRED)",
        "identity": {"ingredientId": "capers", "aliasOf": None},
        "comparedAgainst": ["black-olive ⚫", "pepperoni 🔴", "garlic 🧄", "anchovy 🐟"],
        "rawResult": "AI_OBSERVED: multi-bud cluster vs single discs -- distinct on sauce and cheese",
        "bakedResult": "AI_OBSERVED: heat 1.0 / 1.6 keep the cluster outline",
        "shapeOnlyResult": "AI_OBSERVED: grayscale / deuteranopia / protanopia simulations keep a 3-bud cluster next to two plain discs -- shape cue exists (slice 1 had none)",
        "smallPieceResult": "AI_OBSERVED: 16px still reads as a small cluster",
        "trayResult": "Own chip drawing next to ペパロニ 🔴 / ブラックオリーブ ⚫",
        "watchItems": [
            "renders smaller than 🔴 pepperoni",
            "could read as peas / grapes / a herb cluster rather than capers -- human check",
        ],
        "viewport390x844": vp("PREVIEW_CANDIDATE_OK"),
        "viewport360x800": vp("PREVIEW_CANDIDATE_OK"),
        "status": "PREVIEW_CANDIDATE_OK",
        "reason": "Colour is no longer the only cue: the bud-cluster silhouette separates capers from ⚫ / 🔴 in every simulation, raw and baked; ready for the device Human Gate. Not a production PASS.",
        "requiredFollowUp": "iPhone Human Verification incl. a greyscale look (iOS Settings > Accessibility > Colour Filters) on Puttanesca-like pizzas.",
        "screenshots": shots("capers-1-tray", "capers-2-raw-stage", "capers-3-baked-stage", "capers-4-result", "busy-2-raw-stage", "busy-3-baked-stage", "board-capers"),
        "before": {vp_: [f"{BEFORE_DIR}/{vp_}/capers-2-raw-stage.png", f"{BEFORE_DIR}/{vp_}/board-capers.png"] for vp_ in VIEWPORTS},
    },
    {
        "ingredientId": "clam",
        "ledgerId": "ING-07",
        "candidate": "A:🦪 vs B:dedicated:asari-valve",
        "candidateVisual": {
            "A": {"visual": "🦪 OYSTER (PR #221 emoji)", "status": "HUMAN_VERIFICATION_REQUIRED",
                  "note": "Legible, not confused with garlic / parmigiano; reads as an oyster (open shell + pearl), not あさり."},
            "B": {"visual": "dedicated asari valve: closed wide rounded-triangle shell, hinge bump, horizontal growth bands + zig-zag marks, dark outline (SVG, W1Glyph)",
                  "status": "PREVIEW_CANDIDATE_OK",
                  "note": "Reads as a closed bivalve: no pearl / open meat (not oyster), no spiral (not a sea snail); bands run across while garlic's ribs run lengthwise; dark outline keeps it off parmigiano and the oil base, including grayscale and 16px."},
            "chosen": None,
        },
        "identity": {"ingredientId": "clam", "aliasOf": None},
        "comparedAgainst": ["🦪 (A)", "garlic 🧄", "parmigiano", "olive-oil base", "mushroom 🍄", "tomato sauce"],
        "rawResult": "AI_OBSERVED: A and B both legible; B reads as clam-like, A as oyster",
        "bakedResult": "AI_OBSERVED: heat 1.0 / 1.6 keep both outlines",
        "shapeOnlyResult": "AI_OBSERVED: grayscale -- B's banded outline stays apart from garlic; A too",
        "smallPieceResult": "AI_OBSERVED: 16px -- both keep their outline",
        "watchItems": ["B renders smaller than 🦪", "B could read as a scallop / bread bun -- human check", "B's flat-vector style vs emoji"],
        "viewport390x844": vp("HUMAN_VERIFICATION_REQUIRED (A) / PREVIEW_CANDIDATE_OK (B)"),
        "viewport360x800": vp("HUMAN_VERIFICATION_REQUIRED (A) / PREVIEW_CANDIDATE_OK (B)"),
        "status": "HUMAN_VERIFICATION_REQUIRED",
        "reason": "Both A and B go to the device Human Gate side by side; picking one is the Owner call OD-CLAM-GLYPH defers. B is PREVIEW_CANDIDATE_OK, A stays HUMAN_VERIFICATION_REQUIRED. Nothing chosen here.",
        "requiredFollowUp": "iPhone: compare hub links ① (A) and ② (B) on the same pizza; Owner decides A / B / other.",
        "screenshots": shots("clam-a-oyster-1-tray", "clam-a-oyster-2-raw-stage", "clam-a-oyster-3-baked-stage", "clam-a-oyster-4-result", "clam-b-dedicated-1-tray", "clam-b-dedicated-2-raw-stage", "clam-b-dedicated-3-baked-stage", "clam-b-dedicated-4-result", "board-clam"),
        "before": {vp_: [f"{BEFORE_DIR}/{vp_}/board-clam.png"] for vp_ in VIEWPORTS},
    },
]

CARRIED = [
    {"ingredientId": i, "ledgerId": l, "candidateVisual": e, "status": "HUMAN_VERIFICATION_REQUIRED",
     "note": "Unchanged emoji; slice 1 AI observation re-confirmed in the busy 22-piece pizza at both viewports. Device check pending.",
     "screenshots": shots("busy-2-raw-stage", "busy-3-baked-stage", s)}
    for i, l, e, s in [
        ("eggplant", "ING-03", "🍆", "eggplant-3-baked-stage"),
        ("corn", "ING-08", "🌽", "yellow-3-baked-stage"),
        ("pineapple", "ING-10", "🍍", "yellow-3-baked-stage"),
        ("potato", "ING-11", "🥔", "full-tray-3-baked-stage"),
    ]
]

HUMAN_CHECKLIST = [
    "capers dedicated (bud cluster) vs ⚫ black-olive / 🔴 pepperoni -- tray, pizza raw/baked, RESULT, greyscale",
    "fresh-tomato dedicated (slice) vs 🍅 cherry-tomato vs トマトソース -- tray, pizza raw/baked, RESULT; does it read as tomato (not salami)?",
    "clam A 🦪 -- reads as あさり enough? (hub ①)",
    "clam B dedicated -- clam, not oyster / snail / garlic / parmigiano? (hub ②)",
    "eggplant 🍆 on tomato sauce after bake (Apple glyph is darker)",
    "corn 🌽 on cheese, raw/baked",
    "pineapple 🍍 on cheese, raw/baked",
    "potato 🥔 on cheese/pesto, incl. a long (deep) bake",
    "dedicated pieces' size vs neighbouring emoji; style fit",
    "crowded pizza / 3-page tray stays one screen and RESULT is reachable",
]


# Historical snapshot: this gate ran against the evidence branch state abb0a3d (before the
# 2026-09-25 Human Visual Verification sync resolved the ING rows). Evidence files are therefore
# read from that commit, not the working tree, so this record stays reproducible as history.
GATE_EVIDENCE_COMMIT = "abb0a3df29043238c1079e5cad78f0ec4f16875a"
EVIDENCE_FILES_AT_GATE = {
    "docs/reports/data/TETO_PROGRESS2_W1_EVIDENCE_RESOLUTION_LEDGER.json",
    "docs/reports/data/TETO_PROGRESS2_W1_VISUAL_EVIDENCE_REQUIREMENTS.json",
    "docs/reports/data/TETO_PROGRESS2_W1_OWNER_DECISIONS.json",
    "docs/reports/data/TETO_PROGRESS2_W1_DISCOVERY_REGRESSION_FIXTURES.json",
}


def _read_bytes(rel: str) -> bytes:
    if rel in EVIDENCE_FILES_AT_GATE:
        return subprocess.run(["git", "show", f"{GATE_EVIDENCE_COMMIT}:{rel}"], cwd=ROOT, check=True, capture_output=True).stdout
    return (ROOT / rel).read_bytes()


def sha256(rel: str) -> str:
    return hashlib.sha256(_read_bytes(rel)).hexdigest()


def build() -> dict:
    ledger = json.loads(_read_bytes(LEDGER))
    return {
        "schemaVersion": 1,
        "kind": "w1_ingredient_visual_gate_2_result",
        "gate": "W1 Ingredient Visual Gate slice 2 -- dedicated preview candidates (Preview-only, not production authoring)",
        "authority": {
            "branchBase": "d62e884 (slice 1)",
            "evidenceOwnerDecisionCommit": "abb0a3d",
            "mainAtStart": "1e53baa (only #223 CI-only change since dff233c)",
            "w1AuthorityPr": {"pr": 220, "headSha": "e49dab96bd9b26dc0f520349cf09d1160c3519f5"},
            "contentAuthoringPr": {
                "pr": 221,
                "headShaAtSlice1": "d028844e3a848ebf53cbc45d745784b7695dedf2",
                "headShaNow": "070afc0",
                "changeSinceSlice1": "merge of main (#223 WebKit CI evidence fix) only -- no W1 content / authority meaning change; not modified or rebased here",
            },
            "pinnedInputs": {rel: sha256(rel) for rel in PINNED},
            "ownerDecisions": {"OD-S1": "A", "OD-CLAM-GLYPH": "DEFER_TO_VISUAL_GATE", "OD-TOMATO-REPRESENTATION": "TEMPORARY_SHARED_GLYPH"},
        },
        "method": {
            "rendering": "visual-gate/w1/W1Glyph.tsx draws the dedicated SVGs by ingredient id; a preview-bundle-only Vite transform routes all 8 production `ingredient.emoji` render sites through it (src/** unchanged on disk; each rewrite must match exactly or the build fails).",
            "renderer": "Playwright Chromium + Noto Color Emoji (emoji neighbours are not Apple glyphs); all verdicts are AI observation, never a Human PASS.",
            "scenarios": ["tomato", "capers", "eggplant", "clam-a-oyster", "clam-b-dedicated", "yellow", "full-tray", "busy (22 pieces)", "hub -> seeded game"],
            "backgrounds": ["tomato sauce", "mozzarella", "pesto", "olive oil + parmigiano"],
            "bake": "needle paused at free-cook target center (heat 1.0) + board heat 1.6",
            "automatedLayoutChecks": [
                "no horizontal overflow (PREPARE / RESULT / board / hub)",
                "TOPPING needs no vertical scroll; bottom bar on-screen; 3-page tray pages cleanly",
                "RESULT reached, not burnt, no page errors",
                "dedicated visual count == placed id count; cherry-tomato stays 🍅 text; fresh-tomato draws no 🍅",
                "RESULT list draws the same dedicated visual",
                "only the gate save key is written",
            ],
            "e2e": "20/20 Chromium (390x844 + 360x800) against the exact deployed bytes",
            "webkit": "not runnable in this sandbox (no WebKit executable); src/** unchanged, so not a Final Gate; the device Human Gate covers iPhone Safari",
        },
        "preview": PREVIEW,
        "candidates": CANDIDATES,
        "carriedHumanVerification": CARRIED,
        "humanVerificationChecklist": HUMAN_CHECKLIST,
        "summary": {
            "PREVIEW_CANDIDATE_OK": ["fresh-tomato:dedicated", "capers:dedicated", "clam:B-dedicated"],
            "HUMAN_VERIFICATION_REQUIRED": ["clam:A-🦪", "eggplant", "corn", "pineapple", "potato"],
            "DEDICATED_VISUAL_REQUIRED": [],
            "productionAdoption": None,
            "productionAdoptionNote": "Nothing is adopted for production. PREVIEW_CANDIDATE_OK only means the candidate may go to the device Human Gate.",
            "readiness": {k: ledger["summary"][k] for k in ("READY", "REVIEW", "BLOCKED")},
            "untouched": ["src/**", "e2e/**", "PR #220", "PR #221", "#215/#222/#223", "REC-01..04", "RT-01", "recipe quantities", "OD-S1 = A", "evidence ledger / Owner Decisions", "ingredient identities"],
        },
    }


def validate(doc: dict) -> list[str]:
    errors: list[str] = []
    text = json.dumps(doc, ensure_ascii=False)
    if re.search(r'"(status|visual)": "PASS"', text):
        errors.append("a PASS status appears (no Human device verification yet)")
    if doc["summary"]["productionAdoption"] is not None:
        errors.append("production adoption recorded")
    ids = sorted([c["ingredientId"] for c in doc["candidates"]] + [c["ingredientId"] for c in doc["carriedHumanVerification"]])
    if ids != ["capers", "clam", "corn", "eggplant", "fresh-tomato", "pineapple", "potato"]:
        errors.append(f"ingredient set drift: {ids}")
    for item in doc["candidates"] + doc["carriedHumanVerification"]:
        iid = item["ingredientId"]
        if item["status"] not in STATUSES:
            errors.append(f"{iid}: unknown status {item['status']}")
        if item.get("identity", {"aliasOf": None, "ingredientId": iid}).get("aliasOf") is not None:
            errors.append(f"{iid}: aliased")
        if item.get("identity", {}).get("ingredientId", iid) != iid:
            errors.append(f"{iid}: identity changed")
        for key in ("reason", "requiredFollowUp", "rawResult", "bakedResult"):
            if item in doc["candidates"] and not item.get(key):
                errors.append(f"{iid}: missing {key}")
        for group in (item.get("screenshots", {}), item.get("before", {})):
            for files in group.values():
                for rel in files:
                    if not (ROOT / rel).is_file():
                        errors.append(f"{iid}: missing screenshot {rel}")
    clam = next(c for c in doc["candidates"] if c["ingredientId"] == "clam")
    if clam["candidateVisual"].get("chosen") is not None:
        errors.append("clam glyph chosen (OD-CLAM-GLYPH is DEFER_TO_VISUAL_GATE)")
    if not re.fullmatch(r"[0-9a-f]{40}", doc["preview"]["sourceSha"]):
        errors.append("preview source SHA is not an exact 40-hex SHA")
    if doc["preview"]["productionPagesTouched"]:
        errors.append("production Pages touched")
    if doc["authority"]["ownerDecisions"]["OD-S1"] != "A":
        errors.append("OD-S1 changed")
    ledger = json.loads(_read_bytes(LEDGER))
    counts = {k: ledger["summary"][k] for k in ("READY", "REVIEW", "BLOCKED")}
    if counts != {"READY": 0, "REVIEW": 10, "BLOCKED": 0} or doc["summary"]["readiness"] != counts:
        errors.append(f"readiness drift: ledger {counts}, result {doc['summary']['readiness']}")
    open_ids = {row["id"] for row in ledger["rows"] if row["stillOpen"]}
    must_be_open = {"REC-01", "REC-02", "REC-03", "REC-04", "RT-01", "ING-02", "ING-03", "ING-07", "ING-08", "ING-09", "ING-10", "ING-11"}
    if not must_be_open <= open_ids:
        errors.append(f"ledger rows closed: {sorted(must_be_open - open_ids)}")
    return errors


def render(doc: dict) -> str:
    return json.dumps(doc, ensure_ascii=False, indent=2) + "\n"


def self_test() -> int:
    base = build()
    assert not validate(base), validate(base)
    mutations = {
        "candidate PASS": lambda d: d["candidates"][0].__setitem__("status", "PASS"),
        "viewport visual PASS": lambda d: d["candidates"][1]["viewport390x844"].__setitem__("visual", "PASS"),
        "production adoption": lambda d: d["summary"].__setitem__("productionAdoption", ["fresh-tomato"]),
        "fresh-tomato alias": lambda d: d["candidates"][0]["identity"].__setitem__("aliasOf", "cherry-tomato"),
        "capers id change": lambda d: d["candidates"][1]["identity"].__setitem__("ingredientId", "caper"),
        "clam chosen": lambda d: d["candidates"][2]["candidateVisual"].__setitem__("chosen", "B"),
        "unknown status": lambda d: d["carriedHumanVerification"][0].__setitem__("status", "OK"),
        "missing screenshot": lambda d: d["candidates"][0]["screenshots"]["360x800"].append(f"{SHOT_DIR}/360x800/nope.png"),
        "short preview SHA": lambda d: d["preview"].__setitem__("sourceSha", "ea8ae74"),
        "production pages touched": lambda d: d["preview"].__setitem__("productionPagesTouched", True),
        "OD-S1 changed": lambda d: d["authority"]["ownerDecisions"].__setitem__("OD-S1", "B"),
        "readiness edited": lambda d: d["summary"]["readiness"].__setitem__("READY", 1),
        "ingredient dropped": lambda d: d["carriedHumanVerification"].pop(),
        "missing reason": lambda d: d["candidates"][1].__setitem__("reason", ""),
    }
    caught = 0
    for name, mutate in mutations.items():
        doc = copy.deepcopy(base)
        mutate(doc)
        ok = bool(validate(doc))
        caught += ok
        print(f"  {'caught' if ok else 'MISSED'}  {name}")
    print(f"{'PASS' if caught == len(mutations) else 'FAIL'}: mutation self-test {caught}/{len(mutations)} caught (baseline valid)")
    return 0 if caught == len(mutations) else 1


def main(argv: list[str]) -> int:
    if "--self-test" in argv:
        return self_test()
    doc = build()
    errors = validate(doc)
    if errors:
        for error in errors:
            print(f"FAIL: {error}")
        return 1
    text = render(doc)
    if "--check" in argv:
        if not OUT.is_file() or OUT.read_text() != text:
            print(f"FAIL: {OUT.relative_to(ROOT)} is stale; rerun without --check")
            return 1
        print(f"PASS: W1 visual gate 2 result reproducible; OK={doc['summary']['PREVIEW_CANDIDATE_OK']} HVR={doc['summary']['HUMAN_VERIFICATION_REQUIRED']} preview={PREVIEW_SOURCE_SHA}")
        return 0
    OUT.write_text(text)
    print(f"wrote {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
