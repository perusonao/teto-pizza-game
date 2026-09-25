#!/usr/bin/env python3
"""Progression 2.0 W1 -- Ingredient Visual Gate slice 3 (final) result.

Writes docs/reports/data/TETO_PROGRESS2_W1_VISUAL_GATE_3_RESULT.json and validates:

  - Human Evidence (owner-relayed iPhone Safari Human Gate on the slice 2 Preview): exactly
    clam dedicated B / capers dedicated / eggplant / corn / pineapple / potato are HUMAN_PASS,
    and fresh-tomato stays HUMAN_VERIFICATION_REQUIRED (never HUMAN_PASS from automation);
  - clam Owner Decision DEDICATED_CLAM_B with 🦪 / 🐚 rejected; capers 🟢 rejected;
  - the fresh-tomato automated verdicts are only PREVIEW_CANDIDATE_OK / NEEDS_REVISION;
  - no production adoption is recorded (decided after the fresh-tomato iPhone Gate);
  - identities unchanged (fresh-tomato is not cherry-tomato); the Preview records an exact
    40-hex source SHA; every referenced screenshot exists;
  - earlier results and the evidence / Owner Decision inputs are pinned and unchanged, and the
    evidence ledger still reads READY 0 / REVIEW 10 / BLOCKED 0 with its open rows open (this
    visual slice does not re-interpret readiness).

Usage: python3 tools/w1_visual_gate_3_result.py [--check | --self-test]
"""
from __future__ import annotations

import copy
import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs/reports/data/TETO_PROGRESS2_W1_VISUAL_GATE_3_RESULT.json"
SHOT_DIR = "docs/reports/screenshots/w1-ingredient-visual-gate-3"
LEDGER = "docs/reports/data/TETO_PROGRESS2_W1_EVIDENCE_RESOLUTION_LEDGER.json"
PINNED = [
    LEDGER,
    "docs/reports/data/TETO_PROGRESS2_W1_VISUAL_EVIDENCE_REQUIREMENTS.json",
    "docs/reports/data/TETO_PROGRESS2_W1_OWNER_DECISIONS.json",
    "docs/reports/data/TETO_PROGRESS2_W1_DISCOVERY_REGRESSION_FIXTURES.json",
    "docs/reports/data/TETO_PROGRESS2_W1_VISUAL_GATE_RESULT.json",
    "docs/reports/data/TETO_PROGRESS2_W1_VISUAL_GATE_2_RESULT.json",
]
VIEWPORTS = ("390x844", "360x800")
AUTOMATED_STATUSES = ("PREVIEW_CANDIDATE_OK", "NEEDS_REVISION")
HUMAN_STATUSES = ("HUMAN_PASS", "HUMAN_VERIFICATION_REQUIRED")
HUMAN_PASS_IDS = ["capers", "clam", "corn", "eggplant", "pineapple", "potato"]

PREVIEW_SOURCE_SHA = "fe80e3c2ee4f0d7d3967cbe35780d819e7f842e7"


def shots(*names: str) -> dict[str, list[str]]:
    return {vp: [f"{SHOT_DIR}/{vp}/{name}.png" for name in names] for vp in VIEWPORTS}


HUMAN_EVIDENCE = {
    "source": "Owner-relayed iPhone Safari Human Visual Gate on the slice 2 Preview (source ea8ae74b898698b7550bc8cf6ddd7f9382bc044b, report dcd6ae6)",
    "recordedBy": "this gate (relay only -- no automated check produced any HUMAN_PASS)",
    "ingredients": [
        {"ingredientId": "clam", "ledgerId": "ING-07", "visual": "dedicated asari valve (B)", "status": "HUMAN_PASS", "reverify": False},
        {"ingredientId": "capers", "ledgerId": "ING-02", "visual": "dedicated caper bud cluster", "status": "HUMAN_PASS", "reverify": False},
        {"ingredientId": "eggplant", "ledgerId": "ING-03", "visual": "🍆", "status": "HUMAN_PASS", "reverify": False},
        {"ingredientId": "corn", "ledgerId": "ING-08", "visual": "🌽", "status": "HUMAN_PASS", "reverify": False},
        {"ingredientId": "pineapple", "ledgerId": "ING-10", "visual": "🍍", "status": "HUMAN_PASS", "reverify": False},
        {"ingredientId": "potato", "ledgerId": "ING-11", "visual": "🥔", "status": "HUMAN_PASS", "reverify": False},
        {"ingredientId": "fresh-tomato", "ledgerId": "ING-09", "visual": "dedicated slice (A, slice 2)", "status": "HUMAN_VERIFICATION_REQUIRED", "reverify": True,
         "humanFinding": "Distinguishable from cherry-tomato 🍅 and tomato-sauce, visible raw/baked/small -- but on iPhone the red disc + inner pattern reads at first sight as salami / pepperoni. Revise fresh-tomato only."},
    ],
}

OWNER_DECISIONS = {
    "OD-CLAM-GLYPH": {"value": "DEDICATED_CLAM_B", "previous": "DEFER_TO_VISUAL_GATE", "rejected": ["🦪 OYSTER", "🐚 SPIRAL SHELL"]},
    "capersVisual": {"value": "DEDICATED_CAPER_CLUSTER (Human PASS, adoption candidate)", "rejected": ["🟢 LARGE GREEN CIRCLE"]},
    "OD-TOMATO-REPRESENTATION": {"value": "TEMPORARY_SHARED_GLYPH (unchanged; 🍅 sharing is not returned to)", "aliasToCherryTomato": False},
    "OD-S1": "A",
    "note": "Recorded here as gate evidence; the evidence-branch OWNER_DECISIONS.json (abb0a3d) is not edited by this visual slice.",
}

FRESH_TOMATO = {
    "ingredientId": "fresh-tomato",
    "identity": {"ingredientId": "fresh-tomato", "aliasOf": None, "distinctFrom": "cherry-tomato"},
    "candidates": {
        "A": {
            "visualKey": "tomato-slice",
            "description": "round disc: thick dark-red skin ring + outline, 4 round pale seed chambers, pale core",
            "automatedStatus": "NEEDS_REVISION",
            "reason": "iPhone Human finding (salami / pepperoni reading) reproduced in the preview: in grayscale A is a dark-rimmed disc with 4 round blobs -- the evenly spotted round-sausage pattern.",
            "reachableAs": "game.html?tomato=a / board A rows",
        },
        "B": {
            "visualKey": "tomato-slice-final",
            "description": "irregular softly lobed outline (not a perfect circle), thin skin, 6 radial pale walls meeting at a star-shaped core, 6 yellow jelly chambers each holding 3 teardrop seeds pointing at the core; drawn at 1.15em (visual size parity with neighbouring emoji)",
            "automatedStatus": "PREVIEW_CANDIDATE_OK",
            "reason": "Reads as a tomato cross-section from shape + internal structure: wavy outline, radial wheel, jelly chambers and seeds -- none of which a salami / pepperoni slice has. Holds raw / baked / deep, 16px, grayscale, deuteranopia / protanopia simulations. Automated only: still HUMAN_VERIFICATION_REQUIRED.",
            "reachableAs": "game.html (default) / board B rows",
        },
    },
    "vsPepperoni": "🔴 is a plain round disc with a gloss highlight and no internal structure; B has a non-circular lobed outline, a radial wheel and jelly chambers with seeds. In grayscale 🔴 is a uniform grey disc, B a light radial wheel. A (dark ring + 4 round blobs) was the pepperoni/salami-like one.",
    "vsCherryTomato": "🍅 is a whole glossy fruit with a green calyx (side view); B is a flat cross-section with no calyx -- different silhouette in colour, grayscale and at 16px. Ids stay separate (NO_MATCH swap preserved).",
    "vsTomatoSauce": "tomato-sauce is a spread (painted field) on the pizza; its 🍅 appears only on the sauce tray chip / RESULT list, next to B's slice drawing.",
    "rawResult": "AI_OBSERVED: B distinct on tomato sauce, mozzarella and pesto",
    "bakedResult": "AI_OBSERVED: heat 1.0 keeps outline, wheel and seeds",
    "deepBakeResult": "AI_OBSERVED: heat 1.6 dims colours; lobed outline + radial wheel still read",
    "smallResult": "AI_OBSERVED: 16px thumbnail + RESULT list icon keep the radial wheel",
    "grayscaleResult": "AI_OBSERVED: B = light radial wheel vs 🔴 uniform grey disc vs 🍅 calyx silhouette",
    "colorSimulationResult": "AI_OBSERVED: deuteranopia / protanopia sims keep the wheel + seed structure; distinction is shape-based",
    "trayResult": "Own chip (B slice) next to チェリートマト 🍅 and ペパロニ 🔴; sauce tray keeps トマトソース 🍅",
    "status": "HUMAN_VERIFICATION_REQUIRED",
    "automatedStatus": "PREVIEW_CANDIDATE_OK",
    "requiredFollowUp": "iPhone Human Gate on B (and A/B comparison); production adoption decided after that.",
    "screenshots": shots(
        "tomato-b-final-1-tray", "tomato-b-final-2-raw-stage", "tomato-b-final-3-baked-stage", "tomato-b-final-4-result",
        "tomato-a-slice2-1-tray", "tomato-a-slice2-2-raw-stage", "tomato-a-slice2-3-baked-stage", "tomato-a-slice2-4-result",
        "busy-2-raw-stage", "busy-3-baked-stage", "full-tray-1-tray-page3", "board-tomato", "hub",
    ),
}

PREVIEW = {
    "url": "https://perusonao.github.io/teto-pizza-game-preview/w1-visual-gate/",
    "sourceRepo": "perusonao/teto-pizza-game",
    "sourceBranch": "claude/w1-ingredient-visual-preview-mt4uxw",
    "sourceSha": PREVIEW_SOURCE_SHA,
    "shaShownOnEveryPage": True,
    "deployRepo": "perusonao/teto-pizza-game-preview",
    "deployCommit": "0e1e6028ad3a0f89949a8be5c15fe2bf6c215097",
    "deployScope": "site/w1-visual-gate/ only (incl. SOURCE.txt); top-level preview, README and production Pages untouched",
    "pagesRun": None,  # filled below
    "saveKey": "teto-pizza-w1-visual-gate-save-v1",
    "bytesVerification": "deployed site/w1-visual-gate/ is diff -r identical to the bundle the 20/20 Chromium E2E ran against; live URL not fetchable from this sandbox (perusonao.github.io egress-blocked)",
    "links": {
        "hub": "index.html",
        "tomatoB": "game.html?seed=all&clam=dedicated",
        "tomatoA": "game.html?seed=all&clam=dedicated&tomato=a",
        "board": "board.html",
    },
}
PREVIEW["pagesRun"] = "https://github.com/perusonao/teto-pizza-game-preview/actions/runs/PAGES_RUN_ID"

HV_VIDEO = {
    "file": "w1-fresh-tomato-B-human-verification-390x844.mp4",
    "delivery": "delivered directly in the session (artifacts/review/, gitignored) -- never committed",
    "recordedFrom": "the exact deployed bundle (source fe80e3c, byte-identical to site/w1-visual-gate/ @ 0e1e602)",
    "script": "visual-gate/w1/e2e/w1-hv-video.spec.ts (W1_GATE_HV_VIDEO=1; test-side captions / tap cursor / final card only)",
    "codec": "H.264 High, yuv420p, 30 fps",
    "resolution": "390x844",
    "durationSeconds": 63.97,
    "bytes": 1873039,
    "sha256": "bf545dcebca7abda84b991cd520580b3595b60c7c928a089abc71aee7d1734a0",
    "sequence": [
        "1 Preview entry (hub, exact source SHA) + game ribbon (SHA, tomato B (Final))",
        "2 tray: トマト (B) · チェリートマト 🍅 · ペパロニ 🔴 (stock ×30)",
        "3 place ×3 each on one pizza (left B · middle pepperoni · right cherry), tap cursor visible",
        "4 RAW hold + same pizza in grayscale",
        "5 BAKED (needle at the bake-window center) hold",
        "6 DEEP bake look (needle ≈ 87, heat ≈ 1.6) hold, then back to the window center before taking out",
        "7 RESULT (normal bake, not burnt): small ingredient icons",
        "8 comparison board: tray A/B + sauce tray, B / A rows with cherry-tomato + pepperoni on tomato sauce, 16px",
        "9 grayscale: B vs pepperoni (+ A for reference)",
        "10 final still: HUMAN CHECK (4 questions) + source SHA + Preview URL",
    ],
    "frameSamplingVerification": {
        "decodeToEnd": "PASS (ffmpeg full decode, 0 errors)",
        "resolution390x844": "PASS",
        "rawBakedResultGrayscalePresent": "PASS (1 fps sampling; each held >= 3 s)",
        "bAndPepperoniTogether": "PASS (raw / raw grayscale / baked / deep / board)",
        "shaVisible": "PASS (hub caption + hub line, in-game ribbon, final card)",
        "unintendedStates": "none: RESULT is a normal bake (いい焼き加減); the deep bake is shown only as the labelled step 6",
    },
    "humanPass": None,
    "note": "Human PASS for fresh-tomato is decided by the user after watching this video.",
}

HUMAN_CHECKLIST = [
    "B reads as a tomato slice at first sight -- not salami / pepperoni",
    "B vs 🔴 pepperoni on the same pizza: tell apart by shape",
    "B vs 🍅 cherry-tomato: tray / pizza / baked / RESULT",
    "B vs トマトソース (spread + sauce chip)",
    "baked, long bake, and the small RESULT-list icon",
    "iOS Colour Filters > Grayscale: B vs 🔴",
    "A vs B: B is the better one",
]


def sha256(rel: str) -> str:
    return hashlib.sha256((ROOT / rel).read_bytes()).hexdigest()


def build(pages_run_id: str) -> dict:
    ledger = json.loads((ROOT / LEDGER).read_text())
    preview = dict(PREVIEW)
    preview["pagesRun"] = PREVIEW["pagesRun"].replace("PAGES_RUN_ID", pages_run_id)
    return {
        "schemaVersion": 1,
        "kind": "w1_ingredient_visual_gate_3_result",
        "gate": "W1 Ingredient Visual Gate slice 3 (final) -- fresh-tomato Final candidate; Preview-only, not production authoring",
        "authority": {
            "branch": "claude/w1-ingredient-visual-preview-mt4uxw",
            "slice2PreviewSha": "ea8ae74b898698b7550bc8cf6ddd7f9382bc044b",
            "slice2Report": "dcd6ae6",
            "main": "1e53baa (unchanged since slice 2; W1 authority meaning unchanged)",
            "w1AuthorityPr": {"pr": 220, "headSha": "e49dab96bd9b26dc0f520349cf09d1160c3519f5"},
            "contentAuthoringPr": {"pr": 221, "headSha": "070afc0827f382bec8bc813d62e7fafe663a0991", "finalCodexGate": "PASS (owner-relayed)", "modified": False},
            "pinnedInputs": {rel: sha256(rel) for rel in PINNED},
        },
        "humanEvidence": HUMAN_EVIDENCE,
        "ownerDecisions": OWNER_DECISIONS,
        "freshTomato": FRESH_TOMATO,
        "preview": preview,
        "layoutRegression": {
            "e2e": "20/20 Chromium (390x844 + 360x800) against the exact deployed bytes",
            "checks": [
                "no horizontal overflow (PREPARE / RESULT / board / hub)",
                "TOPPING one screen; bottom bar on-screen; 3-page tray",
                "busy 22-piece pizza -> bake -> RESULT (not burnt, no page errors)",
                "fresh-tomato x3 + cherry-tomato x3 counted as separate ids; only the selected tomato candidate drawn; cherry-tomato stays 🍅; pepperoni stays 🔴",
                "RESULT list draws the same candidate",
                "only the gate save key is written",
            ],
            "webkit": "not runnable in this sandbox; src/** unchanged -> not a Final Gate; iPhone Safari covered by the Human Gate",
        },
        "humanVerificationChecklist": HUMAN_CHECKLIST,
        "humanVerificationVideo": HV_VIDEO,
        "summary": {
            "HUMAN_PASS": HUMAN_PASS_IDS,
            "HUMAN_VERIFICATION_REQUIRED": ["fresh-tomato"],
            "freshTomatoAutomated": {"A": "NEEDS_REVISION", "B": "PREVIEW_CANDIDATE_OK"},
            "productionAdoption": None,
            "productionAdoptionNote": "Not decided. Final production adoption is decided after the fresh-tomato iPhone Human Gate.",
            "readiness": {k: ledger["summary"][k] for k in ("READY", "REVIEW", "BLOCKED")},
            "readinessNote": "This visual slice does not re-interpret READY / REVIEW / BLOCKED; the evidence ledger is not edited.",
            "untouched": ["src/**", "e2e/**", ".github/**", "PR #220", "PR #221", "REC-01..04", "RT-01", "recipe quantities", "OD-S1 = A", "evidence ledger / OWNER_DECISIONS.json", "ingredient identities", "the 6 Human PASS visuals"],
        },
    }


def validate(doc: dict) -> list[str]:
    errors: list[str] = []
    rows = doc["humanEvidence"]["ingredients"]
    by_id = {r["ingredientId"]: r for r in rows}
    if sorted(by_id) != sorted(HUMAN_PASS_IDS + ["fresh-tomato"]):
        errors.append(f"human evidence set drift: {sorted(by_id)}")
    for r in rows:
        if r["status"] not in HUMAN_STATUSES:
            errors.append(f"{r['ingredientId']}: unknown human status {r['status']}")
    passed = sorted(r["ingredientId"] for r in rows if r["status"] == "HUMAN_PASS")
    if passed != sorted(HUMAN_PASS_IDS) or sorted(doc["summary"]["HUMAN_PASS"]) != sorted(HUMAN_PASS_IDS):
        errors.append(f"HUMAN_PASS set drift: {passed}")
    if by_id.get("fresh-tomato", {}).get("status") != "HUMAN_VERIFICATION_REQUIRED" or doc["freshTomato"]["status"] != "HUMAN_VERIFICATION_REQUIRED":
        errors.append("fresh-tomato must stay HUMAN_VERIFICATION_REQUIRED")
    if doc["summary"]["HUMAN_VERIFICATION_REQUIRED"] != ["fresh-tomato"]:
        errors.append("summary HUMAN_VERIFICATION_REQUIRED must be exactly fresh-tomato")
    ft = doc["freshTomato"]
    for key, cand in ft["candidates"].items():
        if cand["automatedStatus"] not in AUTOMATED_STATUSES:
            errors.append(f"fresh-tomato {key}: automated status {cand['automatedStatus']} not allowed")
    if ft["automatedStatus"] not in AUTOMATED_STATUSES:
        errors.append("fresh-tomato automated status not allowed")
    if ft["identity"]["aliasOf"] is not None or ft["identity"]["ingredientId"] != "fresh-tomato":
        errors.append("fresh-tomato aliased / identity changed")
    od = doc["ownerDecisions"]
    if od["OD-CLAM-GLYPH"]["value"] != "DEDICATED_CLAM_B" or sorted(od["OD-CLAM-GLYPH"]["rejected"]) != sorted(["🦪 OYSTER", "🐚 SPIRAL SHELL"]):
        errors.append("clam Owner Decision drift")
    if od["OD-TOMATO-REPRESENTATION"]["aliasToCherryTomato"]:
        errors.append("tomato alias recorded")
    if od["OD-S1"] != "A":
        errors.append("OD-S1 changed")
    if doc["humanVerificationVideo"]["humanPass"] is not None:
        errors.append("video recorded as Human PASS before the user reviewed it")
    if doc["humanVerificationVideo"]["resolution"] != "390x844" or not re.fullmatch(r"[0-9a-f]{64}", doc["humanVerificationVideo"]["sha256"]):
        errors.append("human verification video record incomplete")
    if doc["summary"]["productionAdoption"] is not None:
        errors.append("production adoption recorded")
    if not re.fullmatch(r"[0-9a-f]{40}", doc["preview"]["sourceSha"]):
        errors.append("preview source SHA not exact")
    if not re.fullmatch(r"https://github.com/perusonao/teto-pizza-game-preview/actions/runs/\d+", doc["preview"]["pagesRun"]):
        errors.append("pages run not recorded")
    for files in ft["screenshots"].values():
        for rel in files:
            if not (ROOT / rel).is_file():
                errors.append(f"missing screenshot {rel}")
    ledger = json.loads((ROOT / LEDGER).read_text())
    counts = {k: ledger["summary"][k] for k in ("READY", "REVIEW", "BLOCKED")}
    if counts != {"READY": 0, "REVIEW": 10, "BLOCKED": 0} or doc["summary"]["readiness"] != counts:
        errors.append(f"readiness drift: ledger {counts}, result {doc['summary']['readiness']}")
    open_ids = {row["id"] for row in ledger["rows"] if row["stillOpen"]}
    if not {"REC-01", "REC-02", "REC-03", "REC-04", "RT-01", "ING-09"} <= open_ids:
        errors.append("evidence ledger rows unexpectedly closed")
    return errors


def render(doc: dict) -> str:
    return json.dumps(doc, ensure_ascii=False, indent=2) + "\n"


def self_test(pages_run_id: str) -> int:
    base = build(pages_run_id)
    assert not validate(base), validate(base)

    def row(d, iid):
        return next(r for r in d["humanEvidence"]["ingredients"] if r["ingredientId"] == iid)

    mutations = {
        "fresh-tomato HUMAN_PASS": lambda d: row(d, "fresh-tomato").__setitem__("status", "HUMAN_PASS"),
        "Human PASS reverted": lambda d: row(d, "capers").__setitem__("status", "HUMAN_VERIFICATION_REQUIRED"),
        "summary PASS adds tomato": lambda d: d["summary"]["HUMAN_PASS"].append("fresh-tomato"),
        "automated PASS": lambda d: d["freshTomato"]["candidates"]["B"].__setitem__("automatedStatus", "PASS"),
        "fresh-tomato alias": lambda d: d["freshTomato"]["identity"].__setitem__("aliasOf", "cherry-tomato"),
        "clam decision drift": lambda d: d["ownerDecisions"]["OD-CLAM-GLYPH"].__setitem__("value", "OYSTER"),
        "🐚 un-rejected": lambda d: d["ownerDecisions"]["OD-CLAM-GLYPH"]["rejected"].pop(),
        "tomato alias OD": lambda d: d["ownerDecisions"]["OD-TOMATO-REPRESENTATION"].__setitem__("aliasToCherryTomato", True),
        "production adoption": lambda d: d["summary"].__setitem__("productionAdoption", ["fresh-tomato"]),
        "short SHA": lambda d: d["preview"].__setitem__("sourceSha", "fe80e3c"),
        "missing screenshot": lambda d: d["freshTomato"]["screenshots"]["390x844"].append(f"{SHOT_DIR}/390x844/nope.png"),
        "readiness edited": lambda d: d["summary"]["readiness"].__setitem__("REVIEW", 9),
        "OD-S1 changed": lambda d: d["ownerDecisions"].__setitem__("OD-S1", "B"),
        "evidence row dropped": lambda d: d["humanEvidence"]["ingredients"].pop(0),
        "video marked Human PASS": lambda d: d["humanVerificationVideo"].__setitem__("humanPass", True),
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


PAGES_RUN_ID = "36092970122"


def main(argv: list[str]) -> int:
    if "--self-test" in argv:
        return self_test(PAGES_RUN_ID)
    doc = build(PAGES_RUN_ID)
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
        print(f"PASS: W1 visual gate 3 result reproducible; HUMAN_PASS={HUMAN_PASS_IDS} HVR=['fresh-tomato'] B=PREVIEW_CANDIDATE_OK preview={PREVIEW_SOURCE_SHA}")
        return 0
    OUT.write_text(text)
    print(f"wrote {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
