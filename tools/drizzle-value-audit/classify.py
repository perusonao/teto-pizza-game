#!/usr/bin/env python3
"""Issue #579 DRIZZLE value audit (docs-only, observation only; writes JSON to stdout).

Reads the 172-recipe candidate matrix (docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json) and the
runtime recipe ids (src/data/recipes.ts + src/data/lateCatalog.ts), and classifies every UNSHIPPED row by whether it
would need a liquid / paste applied AFTER the bake (what DRIZZLE would add).

Classes (declared before reading the results):
  L1  a post-bake entry names a liquid / paste ingredient (evidence recorded with its strength)
  L2  a post-bake entry exists but names no ingredient (timing known, content unspecified), and the row lists a
      liquid / oil ingredient that could be the finishing item
  L2b a liquid / oil ingredient is listed but the row has NO post-bake evidence (timing unknown)
  L0  post-bake entries name only solids (existing POST_BAKE topping path is enough: not DRIZZLE)
Liquids / pastes considered (explicit, reviewable): LIQUID.
Other blockers = every blocker / capability other than LATE_ADDITION (a row that DRIZZLE alone would not release).
"""
import json, re, sys, collections
M = json.load(open("docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json"))["rows"]
src = open("src/data/recipes.ts").read() + open("src/data/lateCatalog.ts").read()
ids = set(re.findall(r'\bid: "([a-z0-9-]+)"', src))
norm = lambda e: re.sub(r"-pizzadb(-p\d+)?$", "", e)
shipped = lambda r: r["evidenceId"] in ids or norm(r["evidenceId"]) in ids or r.get("canonicalCandidateId") in ids
LIQUID = {"honey", "olive-oil", "mayo", "buffalo-sauce", "balsamic-vinegar", "blue-cheese-dressing", "yogurt-sauce",
          "tomato-sauce", "gravy-sauce", "sweet-bean-sauce", "soy-sauce", "wasabi", "truffle-oil", "chili-oil", "sriracha",
          "nutella-spread", "fresh-cream-sauce", "curry-ketchup", "ketchup", "tahini", "miso-sauce", "yuzu-kosho"}
OIL_OR_HONEY = {"olive-oil", "honey", "mayo"}
out = []
for r in M:
    if shipped(r):
        continue
    pbs = r["postBakeFinish"]
    ing = r["ingredients"]["canonicalIngredientIds"]
    pb_liq = sorted({i for pb in pbs for i in pb["ingredients"] if i in LIQUID})
    pb_solid = sorted({i for pb in pbs for i in pb["ingredients"] if i not in LIQUID})
    pb_empty = any(not pb["ingredients"] for pb in pbs)
    listed_liq = sorted(i for i in ing if i in OIL_OR_HONEY)
    if pb_liq:
        cls = "L1"
    elif pb_empty and listed_liq:
        cls = "L2"
    elif not pbs and listed_liq:
        cls = "L2b"
    elif pbs and not pb_liq:
        cls = "L0"
    else:
        continue
    caps = [c for c in r["requiredCapabilities"] if c != "LATE_ADDITION"]
    blockers = [b["type"] + (":" + b["ref"][:24] if b["type"] in ("BASE_SAUCE_UNSPECIFIED", "COMPOSITION_CONFLICT_CANDIDATE", "UNRESOLVED_INGREDIENT") else "") for b in r["blockers"] if not (b["type"] == "MECHANIC_INTERPRETATION" and b["ref"] == "LATE_ADDITION")]
    interp = any(b["type"] == "MECHANIC_INTERPRETATION" for b in r["blockers"])
    out.append({
        "evidenceId": r["evidenceId"], "nameJa": r["nameJa"], "status": r["productDecisionStatus"], "class": cls,
        "postBake": [{"mode": pb["mode"], "ingredients": pb["ingredients"], "strength": pb["strength"]} for pb in pbs],
        "liquidsPostBake": pb_liq, "liquidsListed": listed_liq, "solidsPostBake": pb_solid,
        "otherCapabilities": caps, "otherBlockers": blockers, "timingInterpretationOpen": interp,
        "ingredients": ing,
    })
by = collections.Counter((o["class"], o["status"]) for o in out)
print(json.dumps({"counts": {f"{k[0]}|{k[1]}": v for k, v in sorted(by.items())}, "rows": out}, ensure_ascii=False, indent=1))
