"""Post-W1 Cooking Steps Next-Phase Design: 172-row mechanic classification (read-only).

Inputs (read-only): docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json rows
(evidence-derived fields only; the src-derived header fields are stale, see #260) and
src/data/ingredients.ts / recipes.ts. ALL inputs are read from the given commit with `git show`, never
from the working tree, so the output is reproducible and its `auditedMainSha` is always the commit the data
came from. The SHA must resolve to a commit in <repo-root>; otherwise the run is rejected (exit 2).
The recorded value is the full 40-char SHA. Writes nothing outside its arguments.

Re-baselining at a new SHA: RUNTIME_SAUCES below is a snapshot for the committed audited SHA, not derived from
the runtime. Before regenerating at another SHA, read that SHA's `src/data/ingredients.ts` (and the sauce-profile
authority) for the supported sauce ids, update RUNTIME_SAUCES (and the CURRENT_ENGINE rule text) to match, then
regenerate; classify_test.py fails if the set and the recorded SHA disagree. Dynamic derivation is intentionally
not implemented (out of scope for PR-A).

Usage: python3 docs/reports/data/TETO_POST-W1_COOKING-STEPS_classify.py <repo-root> <out.json> <out-rows.md> <audited-sha>
"""
import json, re, sys, collections as C

import subprocess


def _git(*args):
    return subprocess.run(["git", "-C", ROOT, *args], capture_output=True, text=True)


if len(sys.argv) != 5:
    sys.exit("usage: classify.py <repo-root> <out.json> <out-rows.md> <audited-sha>")
ROOT = sys.argv[1]
OUT_JSON = sys.argv[2]
OUT_MD = sys.argv[3]
_resolved = _git("rev-parse", "--verify", "--quiet", f"{sys.argv[4]}^{{commit}}")
if _resolved.returncode != 0:
    sys.stderr.write(f"audited SHA {sys.argv[4]!r} does not resolve to a commit in {ROOT}\n")
    sys.exit(2)
SHA = _resolved.stdout.strip()


def read_at_sha(path):
    r = _git("show", f"{SHA}:{path}")
    if r.returncode != 0:
        sys.stderr.write(f"{path} is missing at {SHA}\n")
        sys.exit(2)
    return r.stdout


m = json.loads(read_at_sha("docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json"))
rows = m["rows"]
ing_src = read_at_sha("src/data/ingredients.ts")
RUNTIME_ING = set(re.findall(r'^\s{4}id: "([^"]+)"', ing_src, re.M))
# SNAPSHOT, not derived: the sauce ids the runtime supports at the audited SHA recorded in the committed JSON
# (`e0397ae`: tomato-sauce / olive-oil / pesto = every `category: "sauce"` ingredient there). It is deliberately
# fixed; see "Re-baselining at a new SHA" in the module docstring. classify_test.py checks it against the
# audited SHA's ingredients.ts.
RUNTIME_SAUCES = {"tomato-sauce", "olive-oil", "pesto"}
rec_src = read_at_sha("src/data/recipes.ts")
RUNTIME_RECIPES = set(re.findall(r'^\s{4}id: "([^"]+)"', rec_src, re.M))

ORDER = ["CURRENT_ENGINE", "DATA_ONLY", "SMALL_ENGINE", "MAJOR", "AUTHORITY_GAP"]
CAP_CLASS = {
    "DOUGH_VARIANT": "SMALL_ENGINE",
    "STEP_ORDER": "SMALL_ENGINE",
    "ZONED_PLACEMENT": "SMALL_ENGINE",
    "MULTI_SPREAD_LAYER": "MAJOR",
    "PAN_BAKE": "MAJOR",
    "DOUGH_SHAPE_TARGET": "MAJOR",
    "ENCLOSE": "MAJOR",
    "PREP_STEP": "MAJOR",
    "LAMINATE": "MAJOR",
    "FRY_COOK": "MAJOR",
}
AUTHORITY_BLOCKERS = {"MECHANIC_INTERPRETATION", "EVIDENCE_GAP", "SCOPE_QUESTION", "BASE_SAUCE_UNSPECIFIED"}


def worst(a, b):
    return a if ORDER.index(a) >= ORDER.index(b) else b


def mechanic_keys(r):
    keys = []
    caps = r["requiredCapabilities"]
    for c in caps:
        if c == "LATE_ADDITION":
            modes = {f["mode"] for f in r["postBakeFinish"]} or {"post_bake"}
            for mode in sorted(modes):
                keys.append(f"LATE_ADDITION:{mode}")
        else:
            keys.append(c)
    sb = r["sauceBase"]["status"]
    if sb == "none":
        keys.append("NO_SAUCE")
    if r["cutServe"]["behavior"] in ("serve-whole-no-cut", "unspecified"):
        keys.append("NO_CUT_OR_CUT_UNSPECIFIED")
    return keys


def classify(r):
    reasons = []
    cls = "CURRENT_ENGINE"
    for key in mechanic_keys(r):
        if key.startswith("LATE_ADDITION:"):
            mode = key.split(":", 1)[1]
            k = "SMALL_ENGINE" if mode == "post_bake" else ("MAJOR" if mode == "mid_bake" else "AUTHORITY_GAP")
        elif key == "NO_SAUCE":
            k = "DATA_ONLY"  # engine + TQ-1B scoring + TQ-1D technique shipped (aussie is live); more no-sauce recipes are data
        elif key == "NO_CUT_OR_CUT_UNSPECIFIED":
            k = "DATA_ONLY"  # CUT allowlist opt-out (REC-02: no dough evidence -> no CUT)
        else:
            k = CAP_CLASS[key]
        reasons.append(f"{key}->{k}")
        cls = worst(cls, k)
    # data-only: new sauce id or new ingredient ids (content, no engine change)
    layers = [x for x in r["sauceBase"]["spreadLayers"] if not x.startswith("<")]
    if r["sauceBase"]["certainSpreadLayerCount"] <= 1:
        for s in layers:
            if s not in RUNTIME_SAUCES:
                reasons.append(f"new-sauce:{s}->DATA_ONLY")
                cls = worst(cls, "DATA_ONLY")
    new_ing = [i for i in r["ingredients"]["canonicalIngredientIds"] if i not in RUNTIME_ING]
    if new_ing:
        reasons.append("new-ingredients->DATA_ONLY")
        cls = worst(cls, "DATA_ONLY")
    blockers = sorted({b["type"] for b in r["blockers"]})
    auth = [b for b in blockers if b in AUTHORITY_BLOCKERS]
    if r["sauceBase"]["status"] == "listed_unresolved":
        auth.append("SAUCE_LISTED_UNRESOLVED")
    mechanic_class_if_resolved = cls
    if auth:
        cls = "AUTHORITY_GAP"
        reasons.append("authority:" + "+".join(auth))
    return cls, mechanic_class_if_resolved, reasons, new_ing, blockers


out = []
for r in rows:
    cls, mech, reasons, new_ing, blockers = classify(r)
    cid = r["canonicalCandidateId"]
    runtime = cid if cid in RUNTIME_RECIPES else (r["phase0"].get("correspondsToExistingCatalogId") if r["phase0"].get("correspondsToExistingCatalogId") in RUNTIME_RECIPES else None)
    out.append({
        "evidenceId": r["evidenceId"],
        "nameJa": r["nameJa"],
        "runtimeRecipeId": runtime,
        "class": cls,
        "mechanicClassIfAuthorityResolved": mech,
        "mechanicKeys": mechanic_keys(r),
        "candidateOnlyCapabilities": r["candidateCapabilities"],
        "sauceStatus": r["sauceBase"]["status"],
        "spreadLayers": r["sauceBase"]["spreadLayers"],
        "lateAdditions": [{"mode": f["mode"], "ingredients": f["ingredients"], "strength": f["strength"]} for f in r["postBakeFinish"]],
        "dough": {"variant": r["dough"]["variant"], "shape": r["dough"]["shape"], "form": r["dough"]["form"]},
        "pan": r["cookingProfile"]["pan"],
        "cut": r["cutServe"]["behavior"],
        "newIngredientCount": len(new_ing),
        "matrixBlockers": blockers,
        "matrixStatus": r["productDecisionStatus"],
        "reasons": reasons,
    })

by = C.Counter(o["class"] for o in out)
mech_counts = C.Counter(k for o in out for k in o["mechanicKeys"])
cls_mech = C.Counter(o["mechanicClassIfAuthorityResolved"] for o in out if o["class"] == "AUTHORITY_GAP")
summary = {
    "auditedMainSha": SHA,
    "rows": len(out),
    "byClass": {k: by.get(k, 0) for k in ORDER},
    "authorityGapRowsByUnderlyingMechanicClass": {k: cls_mech.get(k, 0) for k in ORDER},
    "mechanicKeyRowCounts": dict(sorted(mech_counts.items())),
    "runtimeRecipesMatched": sorted({o["runtimeRecipeId"] for o in out if o["runtimeRecipeId"]}),
}
json.dump({"schemaNote": "Post-W1 Cooking Steps Next-Phase Design (docs-only). Derived, read-only view of the 172 mechanic matrix rows; the matrix JSON stays the evidence authority.",
           "classRules": {
               "CURRENT_ENGINE": "no required capability, sauce is one of tomato-sauce/olive-oil/pesto, every ingredient already in src/data/ingredients.ts, CUT per existing allowlist rule",
               "DATA_ONLY": "no engine change: new ingredient ids, a new single sauce id on the shared paint path, a no-sauce reference (TQ-1B scoring and the TQ-1D `no-sauce` technique are shipped; aussie is live), or a CUT opt-out",
               "SMALL_ENGINE": "reuses an existing phase/step/gesture and existing score components; adds a data field plus a guard: DOUGH_VARIANT, STEP_ORDER, ZONED_PLACEMENT, LATE_ADDITION post_bake (after the one-time finalization prerequisite)",
               "MAJOR": "new gesture, new score component, new geometry, split bake or new phase type: MULTI_SPREAD_LAYER, LATE_ADDITION mid_bake, PAN_BAKE, DOUGH_SHAPE_TARGET, ENCLOSE, PREP_STEP, LAMINATE, FRY_COOK",
               "AUTHORITY_GAP": "the row cannot be classified from recipe data alone: MECHANIC_INTERPRETATION / EVIDENCE_GAP / SCOPE_QUESTION / BASE_SAUCE_UNSPECIFIED blocker, unresolved sauce, or an unresolved late-addition mode",
               "precedence": "AUTHORITY_GAP > MAJOR > SMALL_ENGINE > DATA_ONLY > CURRENT_ENGINE",
           },
           "summary": summary, "rows": out}, open(OUT_JSON, "w"), ensure_ascii=False, indent=1)

# markdown table
def cell(v):
    """Escape characters that would break a GitHub-flavored Markdown table cell (pipes; newlines)."""
    return str(v).replace("\\", "\\\\").replace("|", "\\|").replace("\n", " ")


lines = ["| # | evidenceId | 名前 | runtime | class | (if resolved) | mechanic keys | late | candidate-only |", "|---|---|---|---|---|---|---|---|---|"]
for i, o in enumerate(out, 1):
    late = "; ".join(f"{l['mode']}:{','.join(l['ingredients']) or '—'}" for l in o["lateAdditions"]) or ""
    cells = [str(i), f"`{cell(o['evidenceId'])}`", cell(o['nameJa']), cell(o['runtimeRecipeId'] or ''), f"**{o['class']}**",
             cell(o['mechanicClassIfAuthorityResolved'] if o['class'] == 'AUTHORITY_GAP' else ''),
             cell(', '.join(o['mechanicKeys'])), cell(late), cell(', '.join(o['candidateOnlyCapabilities']))]
    lines.append("| " + " | ".join(cells) + " |")
open(OUT_MD, "w").write("\n".join(lines) + "\n")
print(json.dumps(summary, ensure_ascii=False, indent=1))
