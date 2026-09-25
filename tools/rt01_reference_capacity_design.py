#!/usr/bin/env python3
"""
RT-01 Reference Pizza Piece Capacity -- Fresh Design analysis + placement prototype.

Docs/tools-only. Reads production source as data (never imports or edits src/**) and the
PR #220 / #221 authorities via `git show <pinned sha>:<path>`; writes:

  docs/reports/data/TETO_RT01_REFERENCE_PIECE_CAPACITY_DESIGN.json  (machine-readable companion)
  docs/design/rt01/TETO_RT01_PLACEMENT_COMPARISON.html              (human visual comparison)

Usage:
  python3 tools/rt01_reference_capacity_design.py           # regenerate both outputs
  python3 tools/rt01_reference_capacity_design.py --check   # fail on drift / authority mismatch

Before running, fetch the pinned authority commits:
  git fetch origin codex/w1-authoring-fresh-audit codex/content-readiness-fresh-audit

Nothing here is production code. The placement functions below are a *prototype* of the
candidate designs so a human can compare them; the eventual TS implementation is a separate
slice (see the report's implementation slices).
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import math
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_JSON = ROOT / "docs/reports/data/TETO_RT01_REFERENCE_PIECE_CAPACITY_DESIGN.json"
OUT_HTML = ROOT / "docs/design/rt01/TETO_RT01_PLACEMENT_COMPARISON.html"

RECIPES_TS = ROOT / "src/data/recipes.ts"
INGREDIENTS_TS = ROOT / "src/data/ingredients.ts"
LAYOUT_TS = ROOT / "src/logic/pizzaReferenceLayout.ts"
CATALOG_53 = ROOT / "data/recipes/pizza_master_catalog.json"
MATRIX_172 = ROOT / "docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json"

# Authority pins. #221 is the machine-readable RT-01 authority; #221 itself pins #220's W1.
PR221_SHA = "070afc0827f382bec8bc813d62e7fafe663a0991"
PR221_BRANCH = "codex/w1-authoring-fresh-audit"
PR220_SHA = "e49dab96bd9b26dc0f520349cf09d1160c3519f5"
PR220_BRANCH = "codex/content-readiness-fresh-audit"
W1_RECIPE_MATRIX = "docs/reports/data/TETO_PROGRESS2_W1_RECIPE_AUTHORING_MATRIX.json"
W1_LEDGER = "docs/reports/data/TETO_PROGRESS2_W1_UNRESOLVED_EVIDENCE_LEDGER.json"
W1_INGREDIENTS = "docs/reports/data/TETO_PROGRESS2_W1_INGREDIENT_AUTHORING_MATRIX.json"
W1_AUTHORITY_REF = "docs/reports/data/TETO_PROGRESS2_W1_AUTHORITY_REFERENCE.json"
AUDITED_MAIN_SHA = "1e53baa88f390bf6d8f52647e7c65cc279eb2567"
WAVES_220 = "docs/reports/data/TETO_PROGRESS2_CONTENT_READINESS_WAVES.json"

# ---------------------------------------------------------------------------------------------
# Geometry constants (dough-percent space, see src/logic/pizzaCoordinates.ts)
# ---------------------------------------------------------------------------------------------
CENTER = 50.0
DOUGH_RADIUS = 48.0
# Outermost piece-centre radius any candidate may use. Existing hand-authored Scoring 2.0
# fixtures reach 32.2 (capricciosa black-olive) and the legacy ring 30.9; the ideal sauce
# fixture paints to radius 36. 34 keeps every piece centre on sauce and leaves >= the largest
# half-footprint (~9.6%, see VIEWS) before the dough edge.
R_MAX = 34.0
GOLDEN_ANGLE = math.pi * (3.0 - math.sqrt(5.0))

# Reference views that render per-piece reference positions today. Footprint = rendered
# piece glyph width (28px base * --piece-scale) as a percentage of the positioning box
# (element box minus border), i.e. the minimum centre spacing for two pieces not to touch.
# Values read from src/App.css (.mini-reference__thumb .reference-thumbnail, .reference-thumbnail,
# .reference-mini-pizza / .player-reference-mini-pizza).
VIEWS = [
    {"id": "making-mini-thumb-48", "boxPx": 48, "borderPx": 4, "pieceScale": 0.26,
     "where": "GameScreen always-visible mini 見本 (.mini-reference__thumb .reference-thumbnail)"},
    {"id": "reference-thumb-64", "boxPx": 64, "borderPx": 4, "pieceScale": 0.34,
     "where": "ReferenceThumbnail default size (.reference-thumbnail)"},
    {"id": "reference-popover-140", "boxPx": 140, "borderPx": 6, "pieceScale": 0.5,
     "where": "見本 popover (.reference-mini-pizza / .player-reference-mini-pizza)"},
]
BASE_PIECE_PX = 28.0

for v in VIEWS:
    inner = v["boxPx"] - 2 * v["borderPx"]
    v["innerPx"] = inner
    v["footprintPct"] = round(BASE_PIECE_PX * v["pieceScale"] / inner * 100.0, 2)

COMPARE_COUNTS = [8, 9, 10, 12, 16, 20]
SCAN_MAX = 40


# ---------------------------------------------------------------------------------------------
# Source parsing (read-only)
# ---------------------------------------------------------------------------------------------
def parse_legacy_ring() -> list[tuple[float, float]]:
    text = LAYOUT_TS.read_text(encoding="utf-8")
    body = text.split("PIECE_RING_POSITIONS", 1)[1]
    pts = re.findall(r"\{\s*x:\s*([\d.]+),\s*y:\s*([\d.]+)\s*\}", body.split("] as const", 1)[0])
    return [(float(x), float(y)) for x, y in pts]


def decode_ts_string(s: str) -> str:
    return re.sub(r"\\u\{([0-9A-Fa-f]+)\}", lambda m: chr(int(m.group(1), 16)), s)


def parse_ingredients() -> dict[str, dict]:
    text = INGREDIENTS_TS.read_text(encoding="utf-8")
    out: dict[str, dict] = {}
    for m in re.finditer(r'\{\s*id:\s*"([^"]+)",(.*?)\n  \}', text, re.S):
        block = m.group(2)
        cat = re.search(r'category:\s*"(\w+)"', block)
        emo = re.search(r'emoji:\s*"([^"]+)"', block)
        col = re.search(r'color:\s*"([^"]+)"', block)
        name = re.search(r'nameJa:\s*"([^"]+)"', block)
        if cat:
            out[m.group(1)] = {
                "category": cat.group(1),
                "emoji": decode_ts_string(emo.group(1)) if emo else "?",
                "color": col.group(1) if col else "#999",
                "nameJa": name.group(1) if name else m.group(1),
            }
    return out


def parse_production_recipes(ings: dict[str, dict]) -> list[dict]:
    text = RECIPES_TS.read_text(encoding="utf-8")
    rows = []
    for m in re.finditer(r'\{\s*id:\s*"([^"]+)",\s*nameJa:\s*"([^"]+)".*?requiredIngredients:\s*\[(.*?)\]', text, re.S):
        reqs = [(i, int(c)) for i, c in re.findall(r'ingredientId:\s*"([^"]+)",\s*minCount:\s*(\d+)', m.group(3))]
        pieces = [(i, c) for i, c in reqs if ings.get(i, {}).get("category") != "sauce"]
        rows.append({
            "recipeId": m.group(1),
            "nonSauceTypes": len(pieces),
            "nonSaucePieces": sum(c for _, c in pieces),
            "groups": [{"ingredientId": i, "minCount": c} for i, c in pieces],
        })
    return rows


def git_show(sha: str, path: str) -> str:
    try:
        return subprocess.run(["git", "show", f"{sha}:{path}"], cwd=ROOT, check=True,
                              capture_output=True, text=True).stdout
    except subprocess.CalledProcessError as exc:
        raise SystemExit(
            f"FAIL authority unavailable: git show {sha[:7]}:{path}\n{exc.stderr.strip()}\n"
            f"Run: git fetch origin {PR221_BRANCH} {PR220_BRANCH}")


def branch_tip(branch: str) -> str | None:
    r = subprocess.run(["git", "rev-parse", f"origin/{branch}"], cwd=ROOT, capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else None


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------------------------
# Candidate placements. Every candidate returns LEGACY[:n] for n <= 8 (existing visuals frozen).
# ---------------------------------------------------------------------------------------------
def polar(r: float, theta: float) -> tuple[float, float]:
    return (round(CENTER + r * math.cos(theta), 2), round(CENTER + r * math.sin(theta), 2))


def cand_current(n: int, legacy, _key: str = "") -> list:
    """Current production behaviour: slot % 8 (wraps, collides for n > 8)."""
    return [legacy[i % len(legacy)] for i in range(n)]


def cand_a_radial(n: int, legacy, _key: str = "") -> list:
    """A. Dynamic radial: centre + (n-1) evenly on one ring (the legacy ring's own shape)."""
    if n <= len(legacy):
        return list(legacy[:n])
    ring = n - 1
    return [polar(0, 0)] + [polar(28.0, -math.pi / 2 + 2 * math.pi * i / ring) for i in range(ring)]


def _multiring(n: int, rings: int, centre: int, outer: float) -> list:
    rest = n - centre
    radii = [outer * (k + 1) / rings for k in range(rings)]
    # Largest-remainder split proportional to circumference (constant arc spacing).
    total = sum(radii)
    raw = [rest * r / total for r in radii]
    counts = [int(math.floor(x)) for x in raw]
    order = sorted(range(rings), key=lambda k: (-(raw[k] - counts[k]), -k))
    for k in order[: rest - sum(counts)]:
        counts[k] += 1
    pts = [polar(0, 0)] * centre
    for k, (r, c) in enumerate(zip(radii, counts)):
        if c <= 0:
            continue
        offset = (math.pi / c) if k % 2 == 1 else 0.0  # stagger adjacent rings
        pts += [polar(r, -math.pi / 2 + offset + 2 * math.pi * i / c) for i in range(c)]
    return pts


# Outer-ring radii B may use, most compact first. 28 is the legacy ring's own mean radius.
B_OUTER_RADII = (28.0, 30.0, 32.0, R_MAX)
B_INNER_RADII = tuple(float(r) for r in range(8, 25))


def _ring(r: float, count: int, offset_steps: float) -> list:
    return [polar(r, -math.pi / 2 + 2 * math.pi * (i + offset_steps) / count) for i in range(count)]


def _b_configs(n: int):
    """Every B configuration for n pieces: (outer, rings, centre, pts)."""
    for outer in B_OUTER_RADII:
        for centre in (1, 0):
            rest = n - centre
            yield outer, 1, centre, [polar(0, 0)] * centre + _ring(outer, rest, 0)
            for inner in B_INNER_RADII:
                if inner >= outer - 6:
                    continue
                for n_in in range(1, rest):
                    for off in (0.0, 0.5):
                        yield outer, 2, centre, ([polar(0, 0)] * centre + _ring(outer, rest - n_in, 0)
                                                 + _ring(inner, n_in, off))
            for rings in (3, 4):
                yield outer, rings, centre, _multiring(n, rings, centre, outer)


_B_CACHE: dict[int, list] = {}


def cand_b_multiring(n: int, legacy, _key: str = "") -> list:
    """B. Multi-ring: optional centre + 1-4 concentric rings (outer ring 28-34, inner ring
    radius/count searched for 2 rings). Picks the most compact config (smallest outer radius,
    then fewest rings, centre kept, then largest gap) whose minimum gap is touch-free at the
    smallest reference view; if none exists, the config with the largest minimum gap.
    Deterministic, depends only on n (memoised per n)."""
    if n <= len(legacy):
        return list(legacy[:n])
    if n in _B_CACHE:
        return list(_B_CACHE[n])
    target = max(v["footprintPct"] for v in VIEWS)
    best_ok, best_any = None, None
    for idx, (outer, rings, centre, pts) in enumerate(_b_configs(n)):
        gap = round(min_pair(pts), 6)
        if gap + 1e-9 >= target:
            key = (outer, rings, -centre, -gap, idx)
            if best_ok is None or key < best_ok[0]:
                best_ok = (key, pts)
        key_any = (-gap, outer, rings, -centre, idx)
        if best_any is None or key_any < best_any[0]:
            best_any = (key_any, pts)
    _B_CACHE[n] = (best_ok or best_any)[1]
    return list(_B_CACHE[n])


def _fnv1a(s: str) -> int:
    h = 0x811C9DC5
    for b in s.encode("utf-8"):
        h ^= b
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


def _mulberry32(seed: int):
    state = seed & 0xFFFFFFFF

    def rnd() -> float:
        nonlocal state
        state = (state + 0x6D2B79F5) & 0xFFFFFFFF
        t = state
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t ^= (t + (((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296.0
    return rnd


def cand_c_seeded(n: int, legacy, key: str = "") -> list:
    """C. Deterministic seeded: Mitchell best-candidate sampling in the R_MAX disc,
    PRNG seeded by fnv1a(recipeId|n). Natural-looking, reproducible, but seed-dependent."""
    if n <= len(legacy):
        return list(legacy[:n])
    rnd = _mulberry32(_fnv1a(f"{key or 'synthetic'}|{n}"))
    pts: list = []
    for _ in range(n):
        best, best_d = None, -1.0
        for _c in range(24):
            r = R_MAX * math.sqrt(rnd())
            t = 2 * math.pi * rnd()
            p = polar(r, t)
            d = min((math.dist(p, q) for q in pts), default=1e9)
            if d > best_d:
                best, best_d = p, d
        pts.append(best)
    return pts


def cand_d_sunflower(n: int, legacy, _key: str = "") -> list:
    """D. Golden-angle (Vogel) sunflower: r = R_MAX*sqrt((i+0.5)/n), theta = i*golden."""
    if n <= len(legacy):
        return list(legacy[:n])
    return [polar(R_MAX * math.sqrt((i + 0.5) / n), -math.pi / 2 + i * GOLDEN_ANGLE) for i in range(n)]


CANDIDATES = [
    ("CURRENT", "Current (slot % 8)", cand_current),
    ("A", "A. Dynamic radial (1 ring + centre)", cand_a_radial),
    ("B", "B. Multi-ring (adaptive rings)", cand_b_multiring),
    ("C", "C. Seeded best-candidate", cand_c_seeded),
    ("D", "D. Golden-angle sunflower", cand_d_sunflower),
]


def min_pair(pts) -> float:
    best = float("inf")
    for i in range(len(pts)):
        for j in range(i + 1, len(pts)):
            best = min(best, math.dist(pts[i], pts[j]))
    return best if best != float("inf") else 0.0


def max_radius(pts) -> float:
    return max((math.dist(p, (CENTER, CENTER)) for p in pts), default=0.0)


def overlapping_pairs(pts, footprint: float) -> int:
    return sum(1 for i in range(len(pts)) for j in range(i + 1, len(pts))
               if math.dist(pts[i], pts[j]) < footprint - 1e-9)


def assign_groups(pts, groups, mode: str) -> list[dict]:
    """consecutive = legacy playerReference behaviour; interleaved = turn-based farthest-slot
    assignment over angle-sorted slots so every ingredient spreads around the pizza."""
    if mode == "consecutive":
        order = list(range(len(pts)))
        seq = [g["ingredientId"] for g in groups for _ in range(g["minCount"])]
    else:
        def ang(i):
            x, y = pts[i]
            if math.dist((x, y), (CENTER, CENTER)) < 0.5:
                return (1, 0.0, 0.0)
            return (0, -round(math.dist((x, y), (CENTER, CENTER)), 1),
                    (math.atan2(y - CENTER, x - CENTER) + math.pi / 2) % (2 * math.pi))
        order = sorted(range(len(pts)), key=ang)
        # Turn-based interleave (RT-01b): each group's first piece takes the first free slot in
        # angle order; every later piece takes the free slot farthest from its own group's
        # earlier pieces (earliest on a tie). Mirrors src/logic/pizzaReferenceLayout.ts.
        free = list(order)
        remaining = [g["minCount"] for g in groups]
        placed: list[list[int]] = [[] for _ in groups]
        while any(c > 0 for c in remaining):
            for gi in range(len(groups)):
                if remaining[gi] <= 0:
                    continue
                pick = 0
                if placed[gi]:
                    best = -1.0
                    for idx, s2 in enumerate(free):
                        d = round(min(math.dist(pts[s2], pts[p]) for p in placed[gi]), 6)
                        if d > best:
                            best, pick = d, idx
                placed[gi].append(free.pop(pick))
                remaining[gi] -= 1
        result = []
        for g, slots in zip(groups, placed):
            result.append({"ingredientId": g["ingredientId"],
                           "positions": [{"x": pts[i][0], "y": pts[i][1]} for i in slots]})
        return result
    out: dict[str, list] = {}
    for slot, ing in zip(order, seq):
        out.setdefault(ing, []).append({"x": pts[slot][0], "y": pts[slot][1]})
    return [{"ingredientId": g["ingredientId"], "positions": out.get(g["ingredientId"], [])} for g in groups]


def same_group_min(assigned) -> float:
    return min((min_pair([(p["x"], p["y"]) for p in g["positions"]]) for g in assigned
                if len(g["positions"]) > 1), default=0.0)


# ---------------------------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------------------------
def build() -> tuple[dict, str]:
    legacy = parse_legacy_ring()
    if len(legacy) != 8:
        raise SystemExit(f"FAIL expected 8 legacy PIECE_RING_POSITIONS, parsed {len(legacy)}")
    ings = parse_ingredients()
    prod = parse_production_recipes(ings)

    # ---- authority -------------------------------------------------------------------------
    w1_text = git_show(PR221_SHA, W1_RECIPE_MATRIX)
    ledger_text = git_show(PR221_SHA, W1_LEDGER)
    w1ing_text = git_show(PR221_SHA, W1_INGREDIENTS)
    authref = json.loads(git_show(PR221_SHA, W1_AUTHORITY_REF))
    waves_text = git_show(PR220_SHA, WAVES_220)
    w1 = json.loads(w1_text)
    ledger = json.loads(ledger_text)
    w1ing = {r["id"]: r for r in json.loads(w1ing_text)["rows"]}
    waves = json.loads(waves_text)
    errors: list[str] = []

    if w1["authorityRef"]["headSha"] != PR220_SHA:
        errors.append(f"#221 authorityRef.headSha {w1['authorityRef']['headSha']} != pinned #220 {PR220_SHA}")
    w1_ids_220 = sorted(r["canonicalCandidateId"] for r in waves["rows"] if r.get("wave") == "W1")
    w1_ids_221 = sorted(r["recipeIdCandidate"] for r in w1["rows"])
    if w1_ids_220 != w1_ids_221:
        errors.append(f"W1 membership mismatch #220 {w1_ids_220} vs #221 {w1_ids_221}")

    all_sauce = {i for i, v in ings.items() if v["category"] == "sauce"}
    w1_rows = []
    for r in w1["rows"]:
        groups = [{"ingredientId": q["ingredientId"], "minCount": q["minCountCandidate"]}
                  for q in r["requiredIngredients"] if q["ingredientId"] != r["sauce"] and q["ingredientId"] not in all_sauce]
        n = sum(g["minCount"] for g in groups)
        rc = r["referenceCapacity"]
        if rc["nonSaucePieceCount"] != n:
            errors.append(f"{r['recipeIdCandidate']}: recomputed {n} != #221 nonSaucePieceCount {rc['nonSaucePieceCount']}")
        w1_rows.append({"recipeId": r["recipeIdCandidate"], "nameJa": r["nameJa"], "nonSauceTypes": len(groups),
                        "nonSaucePieces": n, "authority221": rc, "groups": groups,
                        "overCurrentCapacity": n > len(legacy)})
    rt01 = next((e for e in ledger.get("entries", ledger.get("rows", [])) if e.get("id") == "RT-01"), None)
    if rt01 is None:
        errors.append("RT-01 ledger entry missing in #221")
        rt01_scope = []
    else:
        rt01_scope = sorted(rt01["scope"].split(","))
    over = sorted(r["recipeId"] for r in w1_rows if r["overCurrentCapacity"])
    if over != rt01_scope:
        errors.append(f"RT-01 scope {rt01_scope} != recomputed over-capacity {over}")
    # Branch tips are informational: a moved PR branch is reported (the pinned SHAs stay the
    # authority until this tool is re-pinned), never silently accepted.
    for branch, pinned in ((PR221_BRANCH, PR221_SHA), (PR220_BRANCH, PR220_SHA)):
        tip = branch_tip(branch)
        if tip and tip != pinned:
            print(f"WARN origin/{branch} tip {tip[:7]} != pinned {pinned[:7]} -- re-audit RT-01 authority")

    # ---- distributions --------------------------------------------------------------------
    authored = [r for r in prod] + w1_rows
    per_type = [g["minCount"] for r in authored for g in r["groups"]]
    mean_per_type = sum(per_type) / len(per_type)
    per_type_hist = dict(sorted(Counter(per_type).items()))

    cat53 = json.loads(CATALOG_53.read_text(encoding="utf-8"))
    ing_cat_path = ROOT / "data/recipes/ingredient_master_catalog.json"
    cat_ing = {i["id"]: i["category"] for i in json.loads(ing_cat_path.read_text(encoding="utf-8"))["ingredients"]}
    types53 = []
    for r in cat53["recipes"]:
        ids = [i for i in r["ingredients"] if i != r["sauce"] and cat_ing.get(i) != "sauce"]
        types53.append({"id": r["id"], "k": len(ids)})
    m172 = json.loads(MATRIX_172.read_text(encoding="utf-8"))
    types172 = []
    for r in m172["rows"]:
        spread = set(r["sauceBase"].get("spreadLayers") or [])
        src_ids = r["ingredients"].get("identityIngredientSet") or r["ingredients"].get("canonicalIngredientIds") or []
        ids = [i for i in src_ids if i not in spread and cat_ing.get(i) != "sauce"]
        types172.append({"id": r["evidenceId"], "k": len(ids),
                         "identityComplete": r["ingredients"].get("identityIngredientSet") is not None})

    def est(k: int) -> dict:
        return {"min1PerType": k, "empiricalMean": round(k * mean_per_type), "w1ConventionHigh": 2 * k + 1 if k else 0}

    def dist_block(label, rows, exact=None):
        ks = [r["k"] for r in rows]
        block = {"population": label, "rowCount": len(rows),
                 "rowsWithIncompleteIdentitySet": sum(1 for r in rows if r.get("identityComplete") is False),
                 "nonSauceTypeHistogram": {str(k): v for k, v in sorted(Counter(ks).items())},
                 "maxTypes": max(ks)}
        for model in ("min1PerType", "empiricalMean", "w1ConventionHigh"):
            vals = [est(k)[model] for k in ks]
            block[f"pieces_{model}"] = {
                "histogram": {str(k): v for k, v in sorted(Counter(vals).items())},
                "max": max(vals), "over8": sum(1 for v in vals if v > 8),
                "over12": sum(1 for v in vals if v > 12), "over16": sum(1 for v in vals if v > 16)}
        if exact is not None:
            block["exactPieces"] = {"histogram": {str(k): v for k, v in sorted(Counter(exact).items())},
                                    "max": max(exact), "over8": sum(1 for v in exact if v > 8)}
        return block

    distributions = [
        dist_block("production (src/data/recipes.ts)", [{"id": r["recipeId"], "k": r["nonSauceTypes"]} for r in prod],
                   [r["nonSaucePieces"] for r in prod]),
        dist_block("W1 (#221 @ 070afc0 / #220 @ e49dab9)", [{"id": r["recipeId"], "k": r["nonSauceTypes"]} for r in w1_rows],
                   [r["nonSaucePieces"] for r in w1_rows]),
        dist_block("53-entry master catalog (data/recipes/pizza_master_catalog.json)", types53),
        dist_block("172 evidence (TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json)", types172),
    ]
    k_max = max(d["maxTypes"] for d in distributions)
    evidence_high = 2 * k_max + 1

    # ---- candidate metrics ----------------------------------------------------------------
    def legible_max(fn, fp):
        last = 0
        for n in range(1, SCAN_MAX + 1):
            if min_pair(fn(n, legacy, f"n{n}")) + 1e-9 >= fp or n == 1:
                last = n
            else:
                break
        return last

    candidates = []
    for cid, label, fn in CANDIDATES:
        per_n = []
        for n in list(range(1, 9)) + [c for c in range(9, SCAN_MAX + 1)]:
            pts = fn(n, legacy, f"n{n}")
            if n <= 8 or n in COMPARE_COUNTS or n in (evidence_high, 24, 32, 40):
                per_n.append({
                    "n": n, "minPairDistance": round(min_pair(pts), 2), "maxRadius": round(max_radius(pts), 2),
                    "distinctPositions": len(set(pts)),
                    "overlapPairs": {v["id"]: overlapping_pairs(pts, v["footprintPct"]) for v in VIEWS},
                    "positions": [{"x": x, "y": y} for x, y in pts] if n in COMPARE_COUNTS else None,
                })
        candidates.append({
            "id": cid, "label": label, "doc": (fn.__doc__ or "").strip().replace("\n    ", " "),
            "preservesLegacyUpTo8": all(fn(n, legacy) == legacy[:n] for n in range(1, 9)),
            "deterministic": fn(12, legacy, "x") == fn(12, legacy, "x"),
            "dependsOnRecipeId": cid == "C",
            "legibleMaxNoTouch": {v["id"]: legible_max(fn, v["footprintPct"]) for v in VIEWS},
            "perCount": per_n,
        })

    # ---- real W1 recipes -----------------------------------------------------------------
    recipe_layouts = []
    for r in w1_rows:
        if not r["overCurrentCapacity"]:
            continue
        entry = {"recipeId": r["recipeId"], "nonSaucePieces": r["nonSaucePieces"], "layouts": {}}
        for cid, _label, fn in CANDIDATES:
            pts = fn(r["nonSaucePieces"], legacy, r["recipeId"])
            for mode in ("consecutive", "interleaved"):
                if cid == "CURRENT" and mode == "interleaved":
                    continue
                a = assign_groups(pts, r["groups"], mode)
                entry["layouts"][f"{cid}/{mode}"] = {
                    "minPairDistance": round(min_pair(pts), 2),
                    "sameIngredientMinDistance": round(same_group_min(a), 2),
                    "pieceGroups": a}
        recipe_layouts.append(entry)

    report = {
        "schemaVersion": 1,
        "kind": "RT01_REFERENCE_PIECE_CAPACITY_FRESH_DESIGN",
        "generatedBy": "tools/rt01_reference_capacity_design.py",
        "auditedMainSha": AUDITED_MAIN_SHA,
        "authority": {
            "rt01Source": {"pr": 221, "sha": PR221_SHA, "branch": PR221_BRANCH,
                           "recipeMatrixSha256": sha256(w1_text), "ledgerSha256": sha256(ledger_text),
                           "rt01": rt01},
            "w1Source": {"pr": 220, "sha": PR220_SHA, "branch": PR220_BRANCH,
                         "wavesSha256": sha256(waves_text), "w1SnapshotSha256Per221": authref.get("w1SnapshotSha256")},
            "verified": not errors,
            "errors": errors,
        },
        "currentRuntime": {
            "slotTable": "src/logic/pizzaReferenceLayout.ts PIECE_RING_POSITIONS",
            "slotCount": len(legacy),
            "legacySlots": [{"x": x, "y": y} for x, y in legacy],
            "legacyMinPairDistance": round(min_pair(legacy), 2),
            "legacyMaxRadius": round(max_radius(legacy), 2),
            "consumers": [
                {"file": "src/data/playerReference.ts", "fn": "getPlayerReferencePizza",
                 "unit": "piece (minCount-expanded)", "capacity": 8, "overflow": "slot % 8 -> exact duplicate coordinates",
                 "productionReachability": "fallback only: every shipped recipe has a referencePizza.ts fixture; any new recipe without one renders through this path"},
                {"file": "src/components/PizzaThumbnail.tsx", "fn": "PizzaThumbnail (Recipe Select cards)",
                 "unit": "ingredient TYPE (one glyph per non-sauce type, minCount ignored)", "capacity": 8,
                 "overflow": "index % 8 -> duplicate coordinates for a 9th type"},
                {"file": "src/data/referencePizza.ts", "fn": "getReferencePizza (Scoring 2.0 fixtures)",
                 "unit": "piece", "capacity": "no structural cap (hand-authored literals); MEAT_LOVERS_REFERENCE reuses the 8 legacy coordinates by hand",
                 "overflow": "n/a -- but a new recipe needs a fixture or computeScoringV2 returns available:false"},
                {"file": "src/data/recipes.test.ts / src/data/playerReference.test.ts", "fn": "tests",
                 "unit": "piece", "capacity": 8,
                 "overflow": "playerReference.test 'never places two pieces ... at a colliding slot' iterates RECIPES and would fail for a 9+ piece recipe"},
            ],
            "renderersThatOnlyDrawGivenPositions": [
                "src/components/ReferenceThumbnail.tsx", "src/components/ReferencePreview.tsx",
                "src/components/PlayerReferencePreview.tsx", "src/components/PizzaVisualPieces.tsx"],
            "notReferencePositionConsumers": {
                "PizzaStage raw/baked": "renders the player's own placed toppings; bakeVisual.ts only changes colour/filters, never positions",
                "ResultPanel": "renders the player's own baked pizza, no reference positions",
                "persistence.ts": "schemaVersion 2 stores no reference or topping coordinates",
            },
        },
        "views": VIEWS,
        "authoredMinCountPerType": {"histogram": {str(k): v for k, v in per_type_hist.items()},
                                    "mean": round(mean_per_type, 3), "sampleRows": len(authored)},
        "w1": w1_rows,
        "distributions": distributions,
        "capacityEstimate": {
            "maxNonSauceTypesAcrossAllPopulations": k_max,
            "evidenceHighPieces": evidence_high,
            "rule": "w1ConventionHigh = 2*types + 1 (W1 authoring convention: one primary x3, every other type x2); the "
                    "largest value any known population reaches under the most generous observed authoring rule",
            "noHardCap": True,
            "note": "No upper limit is imposed. The algorithm is defined for any n; legibility thresholds per view are "
                    "reported per candidate (legibleMaxNoTouch) and are a physical property of piece size, not a cap.",
        },
        "candidates": candidates,
        "w1OverCapacityLayouts": recipe_layouts,
        "recommendation": {
            "candidate": "B",
            "assignment": "interleaved for n > 8; consecutive (unchanged) for n <= 8",
            "legacyFreeze": "n <= 8 returns PIECE_RING_POSITIONS[:n] byte-identically",
            "scoringFixtures": "new recipes' referencePizza.ts fixtures are authored from the generator output and "
                               "frozen as literals (MEAT_LOVERS precedent); existing 15 fixtures untouched",
            "scoringImpact": "NONE for shipped content (referencePizza.ts / scoringV2 / referenceMatching untouched)",
            "saveImpact": "NONE (persistence schema v2 stores no reference/topping coordinates)",
            "safariRisk": "LOW (pure TS data, existing percent left/top + transform; no new CSS features)",
            "implementationSlices": ["RT-01a getReferenceSlots(n) + tests (no visible change)",
                                     "RT-01b playerReference/PizzaThumbnail switch + invariant tests (byte-identical for shipped)",
                                     "RT-01c W1 fixtures frozen from generator + Human Verification (new recipes only)"],
            "ownerDecisionRequired": True,
            "ownerDecisionReason": "#221 slice E dependsOn 'reference-layout redesign owner approval'",
            "ownerDecisionItems": ["adopt candidate B with n<=8 legacy freeze",
                                   "interleaved slot assignment for n>8",
                                   "new recipes' Scoring 2.0 fixtures = frozen generator output"],
            "verdictBeforeDecision": "OWNER_DECISION_REQUIRED",
        },
        "ownerDecision": {
            "id": "RT-01-OD-1",
            "status": "OWNER_APPROVED",
            "decidedOn": "2026-09-25",
            "decidedBy": "owner (perusonao), session instruction",
            "approved": [
                "Adopt Candidate B (multi-ring placement)",
                "n = 1..8 pieces keep the current PIECE_RING_POSITIONS layout exactly",
                "n >= 9 pieces assign ingredients interleaved",
                "placement stays deterministic",
                "new recipes' Scoring fixtures store getReferenceSlots(n)-style generator output as frozen coordinates",
                "runtime scoring targets are NOT generated dynamically",
            ],
            "resolves": "#221 slice E dependsOn 'reference-layout redesign owner approval'",
            "scopeNow": ["RT-01a getReferenceSlots(n)", "RT-01b playerReference/PizzaThumbnail switch"],
            "deferred": ["RT-01c W1 fixtures (Parmigiana/Portuguesa/Puttanesca) -- joins REC-01..04 authority first"],
        },
        "verdict": "IMPLEMENTATION_READY",
    }
    return report, render_html(report, legacy, ings, w1ing)


# ---------------------------------------------------------------------------------------------
# HTML
# ---------------------------------------------------------------------------------------------
PALETTE = ["#c2410c", "#15803d", "#1d4ed8", "#a21caf", "#b45309", "#0f766e", "#be123c", "#4d7c0f"]


def svg_pizza(pts, size: int, footprint: float, labels=None, colors=None) -> str:
    s = size / 100.0
    overl = set()
    for i in range(len(pts)):
        for j in range(i + 1, len(pts)):
            if math.dist(pts[i], pts[j]) < footprint - 1e-9:
                overl.update((i, j))
    parts = [f'<svg viewBox="0 0 100 100" width="{size}" height="{size}" role="img" aria-label="{len(pts)} pieces">',
             '<circle cx="50" cy="50" r="49" class="crust"/>',
             f'<circle cx="50" cy="50" r="{DOUGH_RADIUS - 6}" class="sauce"/>']
    for i, (x, y) in enumerate(pts):
        cls = "pc bad" if i in overl else "pc"
        fill = f' style="fill:{colors[i]}"' if colors else ""
        parts.append(f'<circle cx="{x}" cy="{y}" r="{footprint / 2:.2f}" class="{cls}"{fill}/>')
        if labels:
            parts.append(f'<text x="{x}" y="{y}" class="glyph" font-size="{footprint * 0.8:.2f}">{html.escape(labels[i])}</text>')
    parts.append("</svg>")
    _ = s
    return "".join(parts)


def render_html(rep: dict, legacy, ings, w1ing) -> str:
    fp = {v["id"]: v["footprintPct"] for v in VIEWS}
    cand_fns = {cid: fn for cid, _l, fn in CANDIDATES}
    rows_html = []
    for n in COMPARE_COUNTS:
        cells = []
        for cid, label, fn in CANDIDATES:
            pts = fn(n, legacy, f"n{n}")
            mp = min_pair(pts)
            bad = overlapping_pairs(pts, fp["making-mini-thumb-48"])
            cells.append(
                f'<td><div class="trio">{svg_pizza(pts, 132, fp["reference-popover-140"])}'
                f'<div class="small">{svg_pizza(pts, 64, fp["reference-thumb-64"])}{svg_pizza(pts, 48, fp["making-mini-thumb-48"])}</div></div>'
                f'<div class="m">min gap <b>{mp:.1f}</b>{" · <span class=warn>" + str(bad) + " touch @48px</span>" if bad else ""}</div></td>')
        rows_html.append(f'<tr><th scope="row">{n}</th>{"".join(cells)}</tr>')
    head = "".join(f"<th scope=col>{html.escape(l)}</th>" for _c, l, _f in CANDIDATES)

    def glyph(i):
        if i in ings:
            return ings[i]["emoji"] if ings[i]["category"] != "cheese" else "\U0001F9C0"
        return w1ing.get(i, {}).get("emojiCandidate", "?")

    recipe_html = []
    for r in rep["w1OverCapacityLayouts"]:
        cells = []
        for key in ("CURRENT/consecutive", "B/consecutive", "B/interleaved", "D/interleaved", "C/interleaved"):
            lay = r["layouts"][key]
            pts, labels, colors = [], [], []
            for gi, g in enumerate(lay["pieceGroups"]):
                for p in g["positions"]:
                    pts.append((p["x"], p["y"]))
                    labels.append(glyph(g["ingredientId"]))
                    colors.append(PALETTE[gi % len(PALETTE)])
            cells.append(f'<figure>{svg_pizza(pts, 150, fp["reference-popover-140"], labels, colors)}'
                         f'<figcaption>{html.escape(key)}<br>min gap {lay["minPairDistance"]:.1f} · same-ingredient {lay["sameIngredientMinDistance"]:.1f}</figcaption></figure>')
        legend = " ".join(
            f'<span class="chip" style="--c:{PALETTE[gi % len(PALETTE)]}">{html.escape(glyph(g["ingredientId"]))} {html.escape(g["ingredientId"])} ×{len(g["positions"])}</span>'
            for gi, g in enumerate(r["layouts"]["B/interleaved"]["pieceGroups"]))
        recipe_html.append(f'<section class="recipe"><h3>{html.escape(r["recipeId"])} — {r["nonSaucePieces"]} pieces</h3>'
                           f'<p class="legend">{legend}</p><div class="figs">{"".join(cells)}</div></section>')

    dist_rows = []
    for d in rep["distributions"]:
        ex = d.get("exactPieces")
        dist_rows.append(
            f'<tr><td>{html.escape(d["population"])}</td><td class=n>{d["rowCount"]}</td><td class=n>{d["maxTypes"]}</td>'
            f'<td class=n>{ex["max"] if ex else "—"}</td><td class=n>{ex["over8"] if ex else "—"}</td>'
            f'<td class=n>{d["pieces_empiricalMean"]["max"]} / {d["pieces_empiricalMean"]["over8"]}</td>'
            f'<td class=n>{d["pieces_w1ConventionHigh"]["max"]} / {d["pieces_w1ConventionHigh"]["over8"]}</td></tr>')

    leg_rows = "".join(
        f'<tr><td>{html.escape(c["label"])}</td>' + "".join(f'<td class=n>{c["legibleMaxNoTouch"][v["id"]]}</td>' for v in VIEWS) +
        f'<td>{"yes" if c["preservesLegacyUpTo8"] else "no"}</td><td>{"recipeId seed" if c["dependsOnRecipeId"] else "n only"}</td></tr>'
        for c in rep["candidates"])
    view_hdr = "".join(f'<th scope=col>{html.escape(v["id"])}<br><span class=m>{v["footprintPct"]}% piece</span></th>' for v in VIEWS)
    auth = rep["authority"]
    _ = cand_fns
    return f"""<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>RT-01 Placement Comparison</title>
<style>
:root{{--bg:#fbf7f0;--fg:#2b2118;--muted:#6b5d50;--line:#e4d9c8;--crust:#c99b56;--sauce:#e8a07a;--pc:#fff7e6;--pcs:#6b4226;--bad:#dc2626;--card:#fffdf8}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{--bg:#1c1814;--fg:#f1e9dd;--muted:#b3a594;--line:#3a322a;--crust:#8a6a3c;--sauce:#9c4f33;--pc:#f5ead6;--pcs:#2b2118;--bad:#f87171;--card:#25201a}}}}
:root[data-theme="dark"]{{--bg:#1c1814;--fg:#f1e9dd;--muted:#b3a594;--line:#3a322a;--crust:#8a6a3c;--sauce:#9c4f33;--pc:#f5ead6;--pcs:#2b2118;--bad:#f87171;--card:#25201a}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 system-ui,-apple-system,"Hiragino Sans",sans-serif}}
main{{max-width:1180px;margin:0 auto;padding:24px 16px 64px}}h1{{font-size:1.6rem;margin:0 0 4px}}h2{{margin-top:40px;font-size:1.2rem}}
p.lead{{color:var(--muted);margin:0 0 16px;max-width:70ch}}.scroll{{overflow-x:auto;border:1px solid var(--line);border-radius:10px;background:var(--card)}}
table{{border-collapse:collapse;width:100%}}th,td{{padding:8px;border-bottom:1px solid var(--line);vertical-align:top;text-align:left}}td.n{{text-align:right;font-variant-numeric:tabular-nums}}
.grid th[scope=row]{{font-size:1.3rem;text-align:center;vertical-align:middle}}.trio{{display:flex;gap:6px;align-items:center}}.small{{display:flex;flex-direction:column;gap:6px;align-items:center}}
.crust{{fill:var(--crust)}}.sauce{{fill:var(--sauce)}}.pc{{fill:var(--pc);stroke:var(--pcs);stroke-width:.6;fill-opacity:.9}}.pc.bad{{stroke:var(--bad);stroke-width:1.4}}
.glyph{{text-anchor:middle;dominant-baseline:central}}.m{{color:var(--muted);font-size:12px}}.warn{{color:var(--bad);font-weight:600}}
.recipe{{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin:14px 0}}.recipe h3{{margin:0 0 6px}}
.figs{{display:flex;flex-wrap:wrap;gap:12px}}figure{{margin:0;text-align:center}}figcaption{{font-size:12px;color:var(--muted)}}
.chip{{display:inline-block;border-left:4px solid var(--c);padding:1px 8px;margin:2px 4px 2px 0;background:var(--bg);border-radius:4px;font-size:13px}}
code{{font-size:.9em}}
</style></head><body><main>
<h1>RT-01 Reference Pizza — placement comparison</h1>
<p class="lead">Prototype output of <code>tools/rt01_reference_capacity_design.py</code>. Not production code. Every candidate keeps the current 8-slot layout for 1–8 pieces. Circles are drawn at each view's real piece footprint; a red outline means two pieces touch at that size. Authority: #221 @ <code>{PR221_SHA[:7]}</code> → #220 @ <code>{PR220_SHA[:7]}</code> (verified: {str(auth['verified']).lower()}).</p>

<h2>1. Synthetic counts</h2>
<p class="lead">Each cell: popover (140px), reference thumbnail (64px), mini 見本 (48px). “min gap” = smallest centre distance in dough-percent.</p>
<div class="scroll"><table class="grid"><thead><tr><th>n</th>{head}</tr></thead><tbody>{''.join(rows_html)}</tbody></table></div>

<h2>2. W1 recipes over capacity (popover size, real glyphs)</h2>
<p class="lead">CURRENT shows today's modulo-8 wrap: stacked pieces sit on the same coordinates, so a 9–10 piece recipe looks like 8. <b>consecutive</b> keeps today's “same ingredient in adjacent slots” rule; <b>interleaved</b> spreads each ingredient around the pizza.</p>
{''.join(recipe_html)}

<h2>3. Legibility thresholds (largest n with no touching pieces)</h2>
<div class="scroll"><table><thead><tr><th>candidate</th>{view_hdr}<th>1–8 unchanged</th><th>depends on</th></tr></thead><tbody>{leg_rows}</tbody></table></div>

<h2>4. Piece-count distribution</h2>
<p class="lead">53/172 have no authored counts, so pieces are estimated from non-sauce ingredient types: empirical mean {rep['authoredMinCountPerType']['mean']} per type ({rep['authoredMinCountPerType']['sampleRows']} authored rows), and the W1 convention high (2×types+1). Cells: max / rows over 8.</p>
<div class="scroll"><table><thead><tr><th>population</th><th>rows</th><th>max types</th><th>exact max</th><th>exact &gt;8</th><th>empirical max / &gt;8</th><th>W1-high max / &gt;8</th></tr></thead><tbody>{''.join(dist_rows)}</tbody></table></div>
</main></body></html>
"""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    report, page = build()
    js = json.dumps(report, ensure_ascii=False, indent=1) + "\n"
    if report["authority"]["errors"]:
        for e in report["authority"]["errors"]:
            print("FAIL", e)
        return 1
    if args.check:
        ok = True
        for path, text in ((OUT_JSON, js), (OUT_HTML, page)):
            if not path.exists() or path.read_text(encoding="utf-8") != text:
                print(f"FAIL {path.relative_to(ROOT)} is stale -- rerun without --check")
                ok = False
        if ok:
            print("PASS RT-01 design artifacts up to date; authority verified")
        return 0 if ok else 1
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_HTML.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(js, encoding="utf-8")
    OUT_HTML.write_text(page, encoding="utf-8")
    print(f"wrote {OUT_JSON.relative_to(ROOT)} and {OUT_HTML.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
