#!/usr/bin/env python3
"""Progression 2.0 W1 -- Ingredient Visual Preview Gate result (machine-readable).

Writes docs/reports/data/TETO_PROGRESS2_W1_VISUAL_GATE_RESULT.json from the verdict table below
and validates the gate's own invariants:

  - every status is one of PASS / FAIL / HUMAN_VERIFICATION_REQUIRED / DEDICATED_VISUAL_REQUIRED,
    and no ingredient is PASS (no Human device verification has happened yet);
  - fresh-tomato keeps its own id and is never aliased to cherry-tomato;
  - clam has no chosen glyph (OD-CLAM-GLYPH = DEFER_TO_VISUAL_GATE is an Owner call);
  - every referenced screenshot exists under docs/reports/screenshots/w1-ingredient-visual-gate/;
  - the W1 authority inputs (evidence ledger, visual requirements, Owner Decisions) are pinned by
    sha256 and the ledger still reads READY 0 / REVIEW 10 / BLOCKED 0 with RT-01 / REC-01..04 open.

Usage:
  python3 tools/w1_visual_gate_result.py            # write
  python3 tools/w1_visual_gate_result.py --check    # byte-identical regeneration + invariants
  python3 tools/w1_visual_gate_result.py --self-test
"""
from __future__ import annotations

import copy
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs/reports/data/TETO_PROGRESS2_W1_VISUAL_GATE_RESULT.json"
SHOT_DIR = "docs/reports/screenshots/w1-ingredient-visual-gate"
LEDGER = "docs/reports/data/TETO_PROGRESS2_W1_EVIDENCE_RESOLUTION_LEDGER.json"
VISUAL_REQ = "docs/reports/data/TETO_PROGRESS2_W1_VISUAL_EVIDENCE_REQUIREMENTS.json"
OWNER_DECISIONS = "docs/reports/data/TETO_PROGRESS2_W1_OWNER_DECISIONS.json"

STATUSES = ("PASS", "FAIL", "HUMAN_VERIFICATION_REQUIRED", "DEDICATED_VISUAL_REQUIRED")
VIEWPORTS = ("390x844", "360x800")

# Automated layout checks the Playwright gate asserts at both viewports for every scenario
# (visual-gate/w1/e2e/w1-visual-gate.spec.ts). These are layout facts, not visual verdicts.
LAYOUT_CHECKS = [
    "no horizontal overflow (PREPARE, RESULT, QA board)",
    ".game-screen needs no vertical scroll at TOPPING (tray + placed pieces)",
    "bottom bar (焼く!) stays on-screen",
    "3-page topping tray (15 owned toppings) pages without overflow",
    "RESULT reached, not burnt, no page errors",
    "placed pieces keep their own ingredient id (fresh-tomato x3 + cherry-tomato x3 counted separately)",
]


def shots(*names: str) -> dict[str, list[str]]:
    return {vp: [f"{SHOT_DIR}/{vp}/{name}.png" for name in names] for vp in VIEWPORTS}


def viewport(visual: str) -> dict[str, str]:
    return {"layout": "AUTOMATED_CHECKS_PASSED", "visual": visual}


INGREDIENTS = [
    {
        "ledgerId": "ING-02",
        "ingredientId": "capers",
        "focus": True,
        "candidateVisual": {"emoji": "🟢", "unicodeName": "LARGE GREEN CIRCLE"},
        "comparedAgainst": ["black-olive ⚫", "pepperoni 🔴", "garlic 🧄", "anchovy 🐟 (co-placed in Puttanesca)"],
        "rawResult": "AI_OBSERVED: visible on tomato sauce; identical plain-circle silhouette to 🔴 pepperoni; ⚫ black-olive differs by size + darkness",
        "bakedResult": "AI_OBSERVED: still visible at heat 1.0 / 1.6; roast tint pulls 🟢 and 🔴 toward the same muddy tone",
        "cvdResult": "AI_OBSERVED (simulated): grayscale -> 🟢 and 🔴 are two mid-grey discs of the same shape; deuteranopia sim -> both khaki, near-identical; protanopia sim -> luminance-only difference. No shape cue exists.",
        "viewport390x844": viewport("DEDICATED_VISUAL_REQUIRED"),
        "viewport360x800": viewport("DEDICATED_VISUAL_REQUIRED"),
        "status": "DEDICATED_VISUAL_REQUIRED",
        "reason": "Colour is the only identification cue: 🟢 and 🔴 are the same plain-circle glyph shape, so capers vs pepperoni fails under grayscale / red-green CVD simulation, and 🟢 does not read as a caper. This is a property of the glyph pair, not of one device.",
        "requiredFollowUp": "Dedicated caper piece visual with a non-circle silhouette (e.g. a cluster of 2-3 small olive-green buds with a lighter tip, drawn like the cheese branch's physical CSS pieces) across every emoji render site; then device Human Verification including a grayscale pass.",
        "screenshots": {**shots("capers-1-tray", "capers-2-raw", "capers-2-raw-stage", "capers-3-baked", "capers-3-baked-stage", "capers-4-result", "board-capers")},
    },
    {
        "ledgerId": "ING-07",
        "ingredientId": "clam",
        "focus": True,
        "candidateVisual": {
            "emoji": None,
            "compared": [
                {"emoji": "🦪", "unicodeName": "OYSTER", "gateFinding": "PREFERRED_CANDIDATE",
                 "note": "Reads as a bivalve/shellfish on olive oil + parmigiano; dark shell outline keeps it separate from 🧄 garlic and parmigiano slivers raw and baked, and still readable at 16px thumbnail size. Semantically an oyster (牡蠣), not あさり."},
                {"emoji": "🐚", "unicodeName": "SPIRAL SHELL", "gateFinding": "FAIL",
                 "note": "Reads as a sea snail / conch, not a clam; pale white-pink body sits in the same value range as 🧄 garlic and parmigiano on the oil base, and at 16px it is the easiest of the four pieces to confuse with garlic."},
            ],
        },
        "comparedAgainst": ["garlic 🧄", "parmigiano (physical piece)", "olive-oil base", "mushroom 🍄"],
        "rawResult": "AI_OBSERVED: 🦪 distinct; 🐚 low contrast against garlic/parmigiano",
        "bakedResult": "AI_OBSERVED: same ranking after roast tint (heat 1.0 / 1.6)",
        "viewport390x844": viewport("HUMAN_VERIFICATION_REQUIRED"),
        "viewport360x800": viewport("HUMAN_VERIFICATION_REQUIRED"),
        "status": "HUMAN_VERIFICATION_REQUIRED",
        "reason": "Among the two standard glyphs only 🦪 is usable (🐚 FAIL). 🦪 is legible and not confused with co-placed pieces, but whether an oyster glyph is acceptable for あさり is an Owner/Human call and the iOS Apple glyph differs from the Noto rendering captured here. Not PASS.",
        "requiredFollowUp": "Owner picks between 🦪 (keep, label carries あさり) and a dedicated clam visual; device check on iPhone Safari 390x844. If 🦪 is rejected -> DEDICATED_VISUAL_REQUIRED. OD-CLAM-GLYPH stays DEFER_TO_VISUAL_GATE until then (no glyph chosen here).",
        "screenshots": {**shots("clam-oyster-1-tray", "clam-oyster-2-raw-stage", "clam-oyster-3-baked-stage", "clam-oyster-4-result", "clam-spiral-1-tray", "clam-spiral-2-raw-stage", "clam-spiral-3-baked-stage", "clam-spiral-4-result", "board-clam")},
    },
    {
        "ledgerId": "ING-08",
        "ingredientId": "corn",
        "focus": False,
        "candidateVisual": {"emoji": "🌽", "unicodeName": "EAR OF MAIZE"},
        "comparedAgainst": ["egg 🥚", "ham 🍖", "mozzarella", "pineapple 🍍"],
        "rawResult": "AI_OBSERVED: high contrast on mozzarella and sauce; green husk separates it from 🥚 egg",
        "bakedResult": "AI_OBSERVED: identifiable at heat 1.0 / 1.6 and at 16px",
        "viewport390x844": viewport("HUMAN_VERIFICATION_REQUIRED"),
        "viewport360x800": viewport("HUMAN_VERIFICATION_REQUIRED"),
        "status": "HUMAN_VERIFICATION_REQUIRED",
        "reason": "No collision or contrast issue found in the preview; device (Apple glyph) confirmation still required. Not PASS.",
        "requiredFollowUp": "Device Human Verification (390x844 iPhone Safari).",
        "screenshots": {**shots("yellow-1-tray", "yellow-2-raw-stage", "yellow-3-baked-stage", "yellow-4-result", "board-yellow")},
    },
    {
        "ledgerId": "ING-03",
        "ingredientId": "eggplant",
        "focus": True,
        "candidateVisual": {"emoji": "🍆", "unicodeName": "AUBERGINE"},
        "comparedAgainst": ["tomato-sauce base", "mozzarella", "basil 🌿", "parmigiano"],
        "rawResult": "AI_OBSERVED: purple body + green cap stays clear on red sauce and on mozzarella; does not sink into the sauce",
        "bakedResult": "AI_OBSERVED: heat 1.0 unchanged in practice; heat 1.6 dims the purple slightly but the silhouette and cap stay readable, including at 16px",
        "viewport390x844": viewport("HUMAN_VERIFICATION_REQUIRED"),
        "viewport360x800": viewport("HUMAN_VERIFICATION_REQUIRED"),
        "status": "HUMAN_VERIFICATION_REQUIRED",
        "reason": "Preview shows no sinking on sauce or cheese, raw or baked, but the Apple 🍆 is a darker purple than Noto's, which is exactly the risk flagged; device check required. Not PASS.",
        "requiredFollowUp": "Device Human Verification on red sauce after bake (heat ~1.0-1.6), 390x844 iPhone Safari.",
        "screenshots": {**shots("eggplant-1-tray", "eggplant-2-raw", "eggplant-2-raw-stage", "eggplant-3-baked", "eggplant-3-baked-stage", "eggplant-4-result", "board-eggplant")},
    },
    {
        "ledgerId": "ING-09",
        "ingredientId": "fresh-tomato",
        "focus": True,
        "candidateVisual": {"emoji": "🍅", "unicodeName": "TOMATO", "sharedWith": ["cherry-tomato", "tomato-sauce"], "ownerDecision": "OD-TOMATO-REPRESENTATION = TEMPORARY_SHARED_GLYPH"},
        "identity": {"ingredientId": "fresh-tomato", "aliasOf": None, "distinctFrom": "cherry-tomato"},
        "comparedAgainst": ["cherry-tomato 🍅", "tomato-sauce 🍅 (sauce tray chip / RESULT list)"],
        "rawResult": "AI_OBSERVED: fresh-tomato and cherry-tomato pieces are pixel-identical on the pizza (same codepoint); only the tray label text differs",
        "bakedResult": "AI_OBSERVED: still pixel-identical after bake (same topping roast curve, no bakeRoastResistant difference)",
        "trayResult": "Distinguishable only by label (トマト vs チェリートマト); with a full owned set they land on different tray pages (cherry-tomato page 1, fresh-tomato page 3). RESULT ingredient list shows 🍅 トマトソース next to 🍅 トマト.",
        "recipeMisreadRisk": "HIGH: Pesto Caprese built with cherry-tomato looks identical and is NO_MATCH (production matcher, W1 discovery regression fixtures).",
        "viewport390x844": viewport("DEDICATED_VISUAL_REQUIRED"),
        "viewport360x800": viewport("DEDICATED_VISUAL_REQUIRED"),
        "status": "DEDICATED_VISUAL_REQUIRED",
        "reason": "A shared codepoint renders identically on every device, so the pizza, bake and thumbnail views carry zero distinguishing cue between fresh-tomato and cherry-tomato; the player cannot tell which one produced a NO_MATCH. The shared 🍅 is acceptable only as the temporary preview glyph OD-TOMATO-REPRESENTATION allowed.",
        "requiredFollowUp": "Dedicated fresh-tomato visual (e.g. a red round slice with lighter seed chambers, distinct from the whole 🍅 cherry-tomato) across every emoji render site; register it as a new runtime dependency (proposed, not registered here). fresh-tomato keeps its own id throughout.",
        "screenshots": {**shots("tomato-1-tray", "tomato-2-raw", "tomato-2-raw-stage", "tomato-3-baked", "tomato-3-baked-stage", "tomato-4-result", "full-tray-1-tray", "full-tray-1-tray-page3", "board-tomato")},
    },
    {
        "ledgerId": "ING-10",
        "ingredientId": "pineapple",
        "focus": False,
        "candidateVisual": {"emoji": "🍍", "unicodeName": "PINEAPPLE"},
        "comparedAgainst": ["ham 🍖", "mozzarella", "corn 🌽"],
        "rawResult": "AI_OBSERVED: yellow body + green crown clear on mozzarella; smaller glyph footprint than 🌽",
        "bakedResult": "AI_OBSERVED: identifiable at heat 1.0 / 1.6 and 16px",
        "viewport390x844": viewport("HUMAN_VERIFICATION_REQUIRED"),
        "viewport360x800": viewport("HUMAN_VERIFICATION_REQUIRED"),
        "status": "HUMAN_VERIFICATION_REQUIRED",
        "reason": "No collision or contrast issue found in the preview; device confirmation still required. Not PASS.",
        "requiredFollowUp": "Device Human Verification (390x844 iPhone Safari).",
        "screenshots": {**shots("yellow-1-tray", "yellow-2-raw-stage", "yellow-3-baked-stage", "yellow-4-result", "board-yellow")},
    },
    {
        "ledgerId": "ING-11",
        "ingredientId": "potato",
        "focus": False,
        "candidateVisual": {"emoji": "🥔", "unicodeName": "POTATO"},
        "comparedAgainst": ["pesto base", "mozzarella", "baked crust"],
        "rawResult": "AI_OBSERVED: brown body clear on pesto and mozzarella",
        "bakedResult": "AI_OBSERVED: readable at heat 1.0; at heat 1.6 over bare crust the brown potato is the lowest-contrast of the 7 (still readable on cheese/pesto)",
        "viewport390x844": viewport("HUMAN_VERIFICATION_REQUIRED"),
        "viewport360x800": viewport("HUMAN_VERIFICATION_REQUIRED"),
        "status": "HUMAN_VERIFICATION_REQUIRED",
        "reason": "Readable in the preview; deep-bake contrast against crust is the one watch item for the device check. Not PASS.",
        "requiredFollowUp": "Device Human Verification, including a deep-bake (heat ~1.6) Pesto Patate.",
        "screenshots": {**shots("full-tray-2-raw-stage", "full-tray-3-baked-stage", "full-tray-4-result", "board-yellow")},
    },
]


def sha256(rel: str) -> str:
    return hashlib.sha256((ROOT / rel).read_bytes()).hexdigest()


def build() -> dict:
    ledger = json.loads((ROOT / LEDGER).read_text())
    return {
        "schemaVersion": 1,
        "kind": "w1_ingredient_visual_gate_result",
        "gate": "W1 Ingredient Visual Preview Gate (Visual Evidence Gate, not production authoring)",
        "authority": {
            "evidenceOwnerDecisionCommit": "abb0a3d",
            "w1AuthorityPr": {"pr": 220, "headSha": "e49dab96bd9b26dc0f520349cf09d1160c3519f5"},
            "contentAuthoringPr": {"pr": 221, "headSha": "d028844e3a848ebf53cbc45d745784b7695dedf2", "use": "read-only candidate rows"},
            "pinnedInputs": {rel: sha256(rel) for rel in (LEDGER, VISUAL_REQ, OWNER_DECISIONS)},
            "ownerDecisions": {
                "OD-S1": "A",
                "OD-OLIVE": "BLACK_OLIVE_CANONICAL",
                "OD-PARM": "PARMIGIANO_CANONICAL",
                "OD-CLAM-GLYPH": "DEFER_TO_VISUAL_GATE",
                "OD-TOMATO-REPRESENTATION": "TEMPORARY_SHARED_GLYPH",
            },
        },
        "method": {
            "preview": "visual-gate/w1 (separate Vite root; injects PR #221 candidate rows into the real game at runtime; src/** unchanged; not part of npm run build)",
            "inGameScenarios": ["tomato", "capers", "eggplant", "clam-oyster", "clam-spiral", "yellow", "full-tray"],
            "qaBoard": "visual-gate/w1/board.html (production IngredientPieceVisual / IngredientTray / toppingVisualFrame; heat 0 / 1.0 / 1.6; 28px and 16px; grayscale + deuteranopia/protanopia simulation)",
            "bakeCapture": "virtual clock paused with the needle at the free-cook target center (heat = 1.0), then RESULT",
            "renderer": "Playwright Chromium with Noto Color Emoji -- NOT Apple Color Emoji; every visual verdict below is AI observation of this renderer, never a Human device PASS",
            "automatedLayoutChecks": LAYOUT_CHECKS,
            "webkit": "Not run locally (WebKit executable not installed in this environment). Not required as Final Gate: src/** and e2e/** are unchanged, no Safari runtime path is affected.",
        },
        "ingredients": INGREDIENTS,
        "summary": {
            "PASS": [],
            "FAIL": [],
            "HUMAN_VERIFICATION_REQUIRED": [i["ingredientId"] for i in INGREDIENTS if i["status"] == "HUMAN_VERIFICATION_REQUIRED"],
            "DEDICATED_VISUAL_REQUIRED": [i["ingredientId"] for i in INGREDIENTS if i["status"] == "DEDICATED_VISUAL_REQUIRED"],
            "glyphLevelFindings": {"clam:🐚": "FAIL", "clam:🦪": "HUMAN_VERIFICATION_REQUIRED (preferred candidate)"},
            "readiness": {k: ledger["summary"][k] for k in ("READY", "REVIEW", "BLOCKED")},
            "readinessImpact": "None: READY 0 / REVIEW 10 / BLOCKED 0 unchanged. puttanesca-pizza (ING-02) and pesto-caprese (ING-09) now wait on a dedicated visual instead of a device check; still REVIEW (implementable, not BLOCKED).",
            "ledgerReflectable": {
                "statusChangeCandidates": {"ING-02": "DEDICATED_VISUAL_REQUIRED", "ING-09": "DEDICATED_VISUAL_REQUIRED"},
                "evidenceAttachOnly": ["ING-03", "ING-07", "ING-08", "ING-10", "ING-11"],
                "resolvable": [],
                "note": "Nothing is resolvable: no Human device verification yet. The evidence ledger itself is not edited by this gate.",
            },
            "untouched": ["REC-01", "REC-02", "REC-03", "REC-04", "RT-01", "recipe quantities", "OD-S1 = A", "ingredient identities"],
        },
    }


def validate(doc: dict) -> list[str]:
    errors: list[str] = []
    ids = [i["ingredientId"] for i in doc["ingredients"]]
    if sorted(ids) != ["capers", "clam", "corn", "eggplant", "fresh-tomato", "pineapple", "potato"]:
        errors.append(f"ingredient set drift: {ids}")
    for item in doc["ingredients"]:
        iid = item["ingredientId"]
        for key in ("ingredientId", "candidateVisual", "comparedAgainst", "rawResult", "bakedResult",
                    "viewport390x844", "viewport360x800", "status", "reason", "requiredFollowUp"):
            if key not in item or item[key] in (None, "", []):
                if not (key == "candidateVisual" and item.get(key)):
                    errors.append(f"{iid}: missing {key}")
        if item["status"] not in STATUSES:
            errors.append(f"{iid}: unknown status {item['status']}")
        if item["status"] == "PASS":
            errors.append(f"{iid}: PASS without Human device verification")
        for vp in ("viewport390x844", "viewport360x800"):
            if item[vp].get("visual") == "PASS":
                errors.append(f"{iid}: {vp} visual PASS without Human device verification")
        for vp, files in item.get("screenshots", {}).items():
            for rel in files:
                if not (ROOT / rel).is_file():
                    errors.append(f"{iid}: missing screenshot {rel}")
    by_id = {i["ingredientId"]: i for i in doc["ingredients"]}
    tomato = by_id.get("fresh-tomato", {})
    if tomato.get("identity", {}).get("aliasOf") is not None or tomato.get("identity", {}).get("ingredientId") != "fresh-tomato":
        errors.append("fresh-tomato aliased / identity changed")
    if by_id.get("clam", {}).get("candidateVisual", {}).get("emoji") is not None:
        errors.append("clam glyph chosen by the gate (OD-CLAM-GLYPH is DEFER_TO_VISUAL_GATE)")
    if doc["summary"]["PASS"]:
        errors.append("summary lists PASS")
    if doc["summary"]["ledgerReflectable"]["resolvable"]:
        errors.append("gate claims a resolvable ledger row")
    if doc["authority"]["ownerDecisions"]["OD-S1"] != "A":
        errors.append("OD-S1 changed")
    # Authority ledger state must be what this gate was run against.
    ledger = json.loads((ROOT / LEDGER).read_text())
    counts = {k: ledger["summary"][k] for k in ("READY", "REVIEW", "BLOCKED")}
    if counts != {"READY": 0, "REVIEW": 10, "BLOCKED": 0} or doc["summary"]["readiness"] != counts:
        errors.append(f"readiness drift: ledger {counts}, result {doc['summary']['readiness']}")
    open_ids = {row["id"] for row in ledger["rows"] if row["stillOpen"]}
    must_be_open = {"REC-01", "REC-02", "REC-03", "REC-04", "RT-01"} | {i["ledgerId"] for i in doc["ingredients"]}
    if not must_be_open <= open_ids:
        errors.append(f"evidence ledger closed rows this gate expects open: {sorted(must_be_open - open_ids)}")
    return errors


def render(doc: dict) -> str:
    return json.dumps(doc, ensure_ascii=False, indent=2) + "\n"


def self_test() -> int:
    base = build()
    assert not validate(base), validate(base)
    mutations = {
        "capers PASS": lambda d: d["ingredients"][0].__setitem__("status", "PASS"),
        "viewport visual PASS": lambda d: d["ingredients"][2]["viewport390x844"].__setitem__("visual", "PASS"),
        "fresh-tomato alias": lambda d: d["ingredients"][4]["identity"].__setitem__("aliasOf", "cherry-tomato"),
        "clam glyph chosen": lambda d: d["ingredients"][1]["candidateVisual"].__setitem__("emoji", "🦪"),
        "unknown status": lambda d: d["ingredients"][3].__setitem__("status", "OK"),
        "missing reason": lambda d: d["ingredients"][5].__setitem__("reason", ""),
        "missing screenshot": lambda d: d["ingredients"][6]["screenshots"]["390x844"].append(f"{SHOT_DIR}/390x844/nope.png"),
        "summary PASS": lambda d: d["summary"]["PASS"].append("corn"),
        "resolvable ledger row": lambda d: d["summary"]["ledgerReflectable"]["resolvable"].append("ING-08"),
        "OD-S1 changed": lambda d: d["authority"]["ownerDecisions"].__setitem__("OD-S1", "B"),
        "readiness edited": lambda d: d["summary"]["readiness"].__setitem__("READY", 1),
        "ingredient dropped": lambda d: d["ingredients"].pop(),
    }
    caught = 0
    for name, mutate in mutations.items():
        doc = copy.deepcopy(base)
        mutate(doc)
        if validate(doc):
            caught += 1
            print(f"  caught  {name}")
        else:
            print(f"  MISSED  {name}")
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
        print(f"PASS: W1 visual gate result reproducible; HVR={doc['summary']['HUMAN_VERIFICATION_REQUIRED']} DEDICATED={doc['summary']['DEDICATED_VISUAL_REQUIRED']} PASS=[]")
        return 0
    OUT.write_text(text)
    print(f"wrote {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
