#!/usr/bin/env python3
"""Progression 2.0 Phase 2 (Issue #190): discovery / unlock / economy design generator,
deterministic simulator and validator.

Docs/data/tooling only. Reads the Phase-1 matrix and the production recipe/ingredient data
READ-ONLY and writes:

  docs/design/data/TETO_PROGRESSION2_PHASE2_UNLOCK-MATRIX.json   (machine-readable SSOT candidate)
  docs/design/TETO_PROGRESSION2_PHASE2_UNLOCK-GRAPH.md           (generated tables)
  docs/design/TETO_PROGRESSION2_PHASE2_DECISION-LEDGER.md        (generated decision ledger)

Nothing here changes src/**, the production Progression SSOT, or the Phase-0/Phase-1 evidence.
No ambiguous ingredient, unspecified sauce base, composition conflict, collision or evidence gap
is resolved: a row that carries any Phase-1 hard blocker is never a discovery target. The only
product-decision options this tool *models* are explicitly labelled decision profiles
(`DECISION_PROFILES`) that the owner must confirm; the evidence-strict profile is always
computed alongside so the impact of each assumption stays visible.

Usage:
  python3 tools/progression2_phase2_progression.py           # regenerate outputs
  python3 tools/progression2_phase2_progression.py --check   # validate only; fail on any drift

Everything is deterministic: no randomness, every iteration order is sorted.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MATRIX_PATH = ROOT / "docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json"
SRC_RECIPES_PATH = ROOT / "src/data/recipes.ts"
SRC_INGREDIENTS_PATH = ROOT / "src/data/ingredients.ts"
INGREDIENT_CATALOG_PATH = ROOT / "data/recipes/ingredient_master_catalog.json"
OUT_JSON = ROOT / "docs/design/data/TETO_PROGRESSION2_PHASE2_UNLOCK-MATRIX.json"
OUT_GRAPH_MD = ROOT / "docs/design/TETO_PROGRESSION2_PHASE2_UNLOCK-GRAPH.md"
OUT_LEDGER_MD = ROOT / "docs/design/TETO_PROGRESSION2_PHASE2_DECISION-LEDGER.md"
DESIGN_MD_PATH = ROOT / "docs/design/TETO_PROGRESSION2_PHASE2_DESIGN.md"

EXPECTED_ROWS = 172
READY_STATUSES = ("READY", "READY_WITH_REVIEW", "ALREADY_SHIPPED_CORROBORATED")
STARTER_ITEMS = ("basil", "mozzarella", "tomato-sauce")  # Issue #190 initial-state candidate
FUGAZZA_PAIR = ("fugazza-pizzadb-p10", "fugazzetta-pizzadb-p10")

# ---------------------------------------------------------------------------------------------
# Decision profiles. EVIDENCE_STRICT uses the Phase-1 statuses as-is. SHIPPED_KEEP additionally
# models option 1 of every SHIPPED composition-decision ledger entry ("keep shipped composition;
# the PIZZA DB row stays a separate, still-blocked candidate") plus keeping the shipped recipes
# that have no 172-row counterpart. It never touches a 172 row: the shipped recipes enter as
# separate `shipped:<id>` targets built from src/data/recipes.ts (read-only), and every Phase-1
# BLOCKED row stays blocked. The owner must confirm this (ledger A-01 / A-02).
# ---------------------------------------------------------------------------------------------
DECISION_PROFILES = {
    "EVIDENCE_STRICT": {
        "labelJa": "証拠のみ（未決定の製品判断をすべて未解決のまま扱う）",
        "includeShippedOverlay": False,
        "assumptions": [],
    },
    "SHIPPED_KEEP": {
        "labelJa": "出荷済みレシピの構成を維持（A-01/A-02 のオプション1を仮置き）",
        "includeShippedOverlay": True,
        "assumptions": ["A-01", "A-02"],
    },
}
RECOMMENDED_PROFILE = "SHIPPED_KEEP"

# ---------------------------------------------------------------------------------------------
# Capability onboarding cost (design judgement, 1..5). `load` = new concepts a tutorial must
# teach; `difficulty` = execution difficulty on a 390x844 touch screen. Grounded in the Phase-1
# cost class / structural flag and in which existing seam each capability reuses.
# ---------------------------------------------------------------------------------------------
CAPABILITY_ONBOARDING = {
    "DOUGH_VARIANT":      {"load": 1, "difficulty": 1, "teach": "生地カードを選ぶだけ。既存の DOUGH ジェスチャーはそのまま。"},
    "MULTI_SPREAD_LAYER": {"load": 2, "difficulty": 2, "teach": "2つめのソース/ドリズル。既存のソース塗りジェスチャーを再利用。"},
    "LATE_ADDITION":      {"load": 2, "difficulty": 2, "teach": "焼いた後（または途中）にのせる FINISH ステップ。"},
    "STEP_ORDER":         {"load": 2, "difficulty": 1, "teach": "チーズを先に、ソースを後に。順番という概念だけ。"},
    "PAN_BAKE":           {"load": 2, "difficulty": 2, "teach": "焼き型（パン/天板）を選んで焼く。構造的変化。"},
    "PREP_STEP":          {"load": 3, "difficulty": 3, "teach": "のせる前に炒める/水気を切る下ごしらえ。新しい操作。"},
    "ZONED_PLACEMENT":    {"load": 3, "difficulty": 3, "teach": "4分割などエリアごとに具材を置く。"},
    "DOUGH_SHAPE_TARGET": {"load": 4, "difficulty": 4, "teach": "四角/舟形に生地を成形し、形に合わせてカット。"},
    "ENCLOSE":            {"load": 4, "difficulty": 4, "teach": "折る/2枚で挟む/重ねる。閉じた形はカットなし。"},
    "FRY_COOK":           {"load": 4, "difficulty": 3, "teach": "焼く代わりに揚げる。"},
    "LAMINATE":           {"load": 5, "difficulty": 5, "teach": "生地そのものを折り込んで層にする。"},
}
CAPABILITY_ITEM_PREFIX = {"DOUGH_VARIANT": "dough:", "PAN_BAKE": "pan:"}


def cap_weight(cap):
    o = CAPABILITY_ONBOARDING[cap]
    return (o["load"] + o["difficulty"]) / 2


MECHANIC_POLICIES = {
    "M1_COVERAGE_GREEDY": {
        "labelJa": "解禁レシピ数だけで貪欲に選ぶ（Phase-1 の順序付けと同じ考え方）",
        "weightedCapabilities": False, "minDiscoverableBeforeFirstMechanic": 0, "mechanicSpacing": 0,
        "mechanicsOnlyWhenIngredientsExhausted": False, "cadence": False,
    },
    "M2_TUTORIAL_WEIGHTED": {
        "labelJa": "最初の12発見は材料だけ。以後、6発見ごとに「いま届く中で一番やさしい」Mechanic を1つ教える",
        "weightedCapabilities": True, "minDiscoverableBeforeFirstMechanic": 12, "mechanicSpacing": 6,
        "mechanicsOnlyWhenIngredientsExhausted": False, "cadence": True,
    },
    "M3_MECHANICS_LAST": {
        "labelJa": "材料だけで届くレシピを出し切ってから Mechanic を導入",
        "weightedCapabilities": True, "minDiscoverableBeforeFirstMechanic": 0, "mechanicSpacing": 0,
        "mechanicsOnlyWhenIngredientsExhausted": True, "cadence": False,
    },
}
RECOMMENDED_MECHANIC_POLICY = "M2_TUTORIAL_WEIGHTED"
MAX_CANDIDATE_SIZE = 3

# ---------------------------------------------------------------------------------------------
# Economy candidates. Nothing here is a final value; the report compares them.
# ---------------------------------------------------------------------------------------------
SKILLS = {  # deterministic player models: every PASS bake lands on this quality
    "WORST": {"stars": 1, "labelJa": "常に★1（最低品質でも完成扱い）"},
    "BEGINNER": {"stars": 2, "labelJa": "初心者 ★2"},
    "STANDARD": {"stars": 3, "labelJa": "標準 ★3"},
    "SKILLED": {"stars": 4, "labelJa": "上手 ★4"},
}
# Current production multiplier table (src/logic/pitzReward.ts, read-only) and a floor variant.
REWARD_TABLES = {
    "LEGACY": {"labelJa": "現行 pitzReward.ts（★1=×0）", "base": 100, "mult": {1: 0.0, 2: 0.5, 3: 0.8, 4: 1.0, 5: 1.2},
               "discoveryBonus": 0},
    "FLOOR": {"labelJa": "★1 に下限 ×0.2 を追加（PASS した焼成は必ず Pitz>0）", "base": 100, "mult": {1: 0.2, 2: 0.5, 3: 0.8, 4: 1.0, 5: 1.2},
              "discoveryBonus": 0},
    "FLOOR_DISCOVERY_BONUS": {"labelJa": "FLOOR ＋ 新発見ボーナス +50 Pitz", "base": 100, "mult": {1: 0.2, 2: 0.5, 3: 0.8, 4: 1.0, 5: 1.2},
                              "discoveryBonus": 50},
}
# Deterministic explorer models. `findRate` = share of targets the player finds on their own by free
# experimentation (a stable per-target hash decides which); the rest need a Teto hint. The tutorial
# target (the starter-only discovery) is always found.
EXPLORERS = {
    "COMPLETIONIST": {"labelJa": "到達可能なものは全部自力で見つける", "findRate": 1.0},
    "EXPLORER_60": {"labelJa": "自力で見つけるのは60%", "findRate": 0.6},
    "EXPLORER_40": {"labelJa": "自力で見つけるのは40%", "findRate": 0.4},
}
HINT_POLICIES = {
    "HINTS_OFF": {"labelJa": "ヒントなし", "idleBakesBeforeHint": None},
    "HINTS_ON": {"labelJa": "新発見のない焼成が2回続いたら、テトが「いま作れるのに未発見」の1枚をほのめかす", "idleBakesBeforeHint": 2},
}
GATE_CURVES = {
    "G0_LEGACY_LADDER_10": {
        "labelJa": "旧案型: ⭐=Dex BEST★合計、解禁ごとに ⭐+10 の固定ラダー",
        "starModel": "SUM_BEST", "gate": "FIXED_LADDER", "ladderStep": 10,
    },
    "G1_LEGACY_SUM_DERIVED_060": {
        "labelJa": "⭐=Dex BEST★合計、しきい値は到達可能数から導出（f=0.6）",
        "starModel": "SUM_BEST", "gate": "DERIVED", "fraction": 0.6, "guaranteedStarsPerDiscovery": 1,
    },
    "G2_DISCOVERY_COUNT_060": {
        "labelJa": "発見数のみ（f=0.6）。⭐は表示用",
        "starModel": "DISCOVERY_COUNT", "gate": "DERIVED", "fraction": 0.6, "guaranteedStarsPerDiscovery": 1,
    },
    "G3_HYBRID_050": {
        "labelJa": "Hybrid ⭐（発見+2、BEST★3/4/5で各+1）f=0.5",
        "starModel": "HYBRID", "discoveryStars": 2, "qualityBonusAtStars": [3, 4, 5], "gate": "DERIVED", "fraction": 0.5, "guaranteedStarsPerDiscovery": 2,
    },
    "G4_HYBRID_060": {
        "labelJa": "Hybrid ⭐ f=0.6",
        "starModel": "HYBRID", "discoveryStars": 2, "qualityBonusAtStars": [3, 4, 5], "gate": "DERIVED", "fraction": 0.6, "guaranteedStarsPerDiscovery": 2,
    },
    "G5_HYBRID_075": {
        "labelJa": "Hybrid ⭐ f=0.75",
        "starModel": "HYBRID", "discoveryStars": 2, "qualityBonusAtStars": [3, 4, 5], "gate": "DERIVED", "fraction": 0.75, "guaranteedStarsPerDiscovery": 2,
    },
    "G6_HYBRID_100": {
        "labelJa": "Hybrid ⭐ f=1.0（到達可能なものを全部発見するまで次へ進めない）",
        "starModel": "HYBRID", "discoveryStars": 2, "qualityBonusAtStars": [3, 4, 5], "gate": "DERIVED", "fraction": 1.0, "guaranteedStarsPerDiscovery": 2,
    },
}
PRICE_SCHEDULES = {
    "PR_FLAT_120": {"labelJa": "全材料 120 Pitz（現行 onion 相当）", "kind": "FLAT", "price": 120},
    "PR_TIERED": {"labelJa": "tier 別 60/100/140/180", "kind": "BY_TIER", "byTier": {"early": 60, "mid": 100, "late": 140, "endgame": 180}},
    "PR_IMPACT": {"labelJa": "50 + 25×その解禁で増える発見数（最大4）", "kind": "IMPACT", "base": 50, "perNewTarget": 25, "newTargetCap": 4},
}
STOCK_POLICIES = {
    "S10_R10": {"labelJa": "購入時 10 回分、補充 +10 回分（価格×0.5）", "grant": 10, "restock": 10, "restockFactor": 0.5},
    "S5_R5": {"labelJa": "購入時 5 回分、補充 +5 回分（価格×0.3）", "grant": 5, "restock": 5, "restockFactor": 0.3},
    "S3_R5": {"labelJa": "購入時 3 回分、補充 +5 回分（価格×0.3）", "grant": 3, "restock": 5, "restockFactor": 0.3},
}
RECOMMENDED_ECONOMY = {"gate": "G4_HYBRID_060", "price": "PR_TIERED", "stock": "S10_R10", "reward": "FLOOR_DISCOVERY_BONUS", "hints": "HINTS_ON"}
TURN_CAP = 20000
TIER_BANDS = (("early", 0.25), ("mid", 0.60), ("late", 0.90), ("endgame", 1.01))

# ---------------------------------------------------------------------------------------------
# Curated decision ledger (A: blocks progression design; B: blocks discovery identity of the
# listed rows; C: can wait until implementation; D: content polish). Row-level entries are
# generated from Phase-1 blockers/review items below; these are the design-level ones.
# ---------------------------------------------------------------------------------------------
DESIGN_DECISIONS = [
    {"id": "A-01", "class": "A", "topic": "Margherita composition (first discovery)",
     "question": "shipped margherita {tomato-sauce, mozzarella, basil} vs PIZZA DB row (+olive-oil, needs MULTI_SPREAD_LAYER)",
     "whyItBlocks": "Under EVIDENCE_STRICT the three starter ingredients complete ZERO evidence-ready targets; the zero-recipe start has no first discovery without this decision.",
     "options": ["keep shipped composition (modelled by SHIPPED_KEEP)", "adopt PIZZA DB composition and change the starter set (see alternativeFirstDiscoveries)", "ship both as distinct dishes"],
     "modelledAs": "SHIPPED_KEEP profile", "recommendation": "keep shipped composition; PIZZA DB row stays a separate blocked candidate until MULTI_SPREAD_LAYER exists"},
    {"id": "A-02", "class": "A", "topic": "Shipped recipes without a 172 row, and shipped composition conflicts",
     "question": "Do the 14 shipped recipes (excluding corroborated tonno-e-cipolla) stay discoverable with their shipped compositions?",
     "whyItBlocks": "They are the densest early content (funghi, pepperoni, salsiccia...) and existing saves already contain them.",
     "options": ["keep all 14 as discovery targets (modelled)", "keep only the 5 that have no 172 row", "retire / migrate each individually"],
     "modelledAs": "SHIPPED_KEEP profile", "recommendation": "keep all 14 for Phase 3; resolve each PIZZA DB conflict row separately later"},
    {"id": "A-03", "class": "A", "topic": "Star (⭐) definition",
     "question": "Replace totalStars = sum(Dex BEST) with a guaranteed-per-discovery star model?",
     "whyItBlocks": "With a one-recipe start the legacy ladder (⭐10/20/...) is unreachable; see simulation G0.",
     "options": list(GATE_CURVES), "modelledAs": "gate curve comparison", "economyKey": "gate"},
    {"id": "A-04", "class": "A", "topic": "Free-cook discovery instead of recipe selection",
     "question": "Discovery happens by exact runtime-signature match of a free-cooked pizza (no recipe picked first).",
     "whyItBlocks": "Current production is recipe-first (SELECT_RECIPE -> PREPARE); a zero-recipe start cannot begin there.",
     "options": ["free-cook + signature match (recommended)", "keep recipe-first and pre-grant margherita (contradicts zero-recipe start)"],
     "modelledAs": "discovery rule", "recommendation": "free-cook + signature match"},
    {"id": "A-05", "class": "A", "topic": "Pitz floor for a PASS ★1 bake",
     "question": "Current reward table pays ×0 at ★1; a player who never exceeds ★1 can never buy anything.",
     "whyItBlocks": "Economic deadlock for the WORST skill model (simulation reward=LEGACY).",
     "options": list(REWARD_TABLES), "modelledAs": "reward comparison", "economyKey": "reward"},
    {"id": "C-01", "class": "C", "topic": "Starter stock / restock size", "question": "portions granted on purchase and per restock",
     "options": list(STOCK_POLICIES), "modelledAs": "stock comparison", "economyKey": "stock"},
    {"id": "C-02", "class": "C", "topic": "Ingredient prices", "question": "price schedule", "options": list(PRICE_SCHEDULES),
     "modelledAs": "price comparison", "economyKey": "price"},
    {"id": "C-03", "class": "C", "topic": "Dough / pan item granularity",
     "question": "Every evidenced non-standard dough variant and pan is one item here; merging would need evidence that it keeps all signatures unique.",
     "options": ["one item per evidenced variant (modelled)", "merge after a collision re-check"], "modelledAs": "one item per variant",
     "recommendation": "keep per-variant until content polish"},
    {"id": "C-04", "class": "C", "topic": "Existing-save migration",
     "question": "Grandfather existing Dex/owned ingredients into Progression 2.0 or reset?",
     "options": ["grandfather (discovered stays discovered; owned stays owned; ⭐ recomputed)", "reset with compensation"], "modelledAs": "not simulated",
     "recommendation": "grandfather"},
    {"id": "C-05", "class": "C", "topic": "UI ingredient categories for ~170 items",
     "question": "Only 62 catalog ingredients have a category; the rest need one before the tray can tab/filter them.",
     "options": ["author categories during content ingestion"], "modelledAs": "counts only", "recommendation": "author per content batch"},
    {"id": "C-06", "class": "C", "topic": "Lunch Rush entry and order pool",
     "question": "Lunch Rush unlocks at the first discovery and draws only from discovered recipes with stock (never the all-orders fallback).",
     "options": ["gate on ≥1 discovery (recommended)", "gate on N discoveries"], "modelledAs": "proof in noDeadlockProof", "recommendation": "≥1 discovery"},
    {"id": "D-01", "class": "D", "topic": "Display names for naming clusters", "question": "Napoletana/Bianca/Sicilian... names",
     "options": ["decide at content polish"], "modelledAs": "not needed for progression", "recommendation": "content polish"},
    {"id": "D-02", "class": "D", "topic": "Teto hint copy", "question": "exact hint lines per tier", "options": ["write at implementation"],
     "modelledAs": "hint tiers only", "recommendation": "content polish"},
]

ECONOMY_DECISION_IDS = {"A-03": "gate", "A-05": "reward", "C-01": "stock", "C-02": "price"}


def resolved_design_decisions():
    """Economy decisions never carry a literal recommendation: it is derived from
    RECOMMENDED_ECONOMY, the single source of truth the simulations also run on."""
    out = []
    for d in DESIGN_DECISIONS:
        d = dict(d)
        key = d.get("economyKey")
        if key:
            pid = RECOMMENDED_ECONOMY[key]
            d["recommendedPolicyId"] = pid
            d["recommendation"] = f"{pid} (= recommended.economy.{key}; see simulation)"
        out.append(d)
    return out


BLOCKER_CLASS = {
    # Phase-1 hard blocker type -> ledger class for the ROW (never A: the progression design does
    # not depend on any single blocked row; the row simply stays out of the reachable pool).
    "UNRESOLVED_INGREDIENT": "B",
    "BASE_SAUCE_UNSPECIFIED": "B",
    "EVIDENCE_GAP": "B",
    "DISCOVERY_COLLISION": "B",
    "MECHANIC_INTERPRETATION": "B",
    "COMPOSITION_CONFLICT_SHIPPED": "B",
    "COMPOSITION_CONFLICT_CANDIDATE": "B",
    "SCOPE_QUESTION": "B",
}
REVIEW_CLASS = {
    "NAMING_CLUSTER": "D", "SAME_INGREDIENT_SET_AS_CATALOG_RECIPE": "D", "NAME_SPECIFICITY_GAP": "D",
    "SOURCE_INCONSISTENCY": "D", "PREPARED_COMPOSITE_INGREDIENT": "D", "CANDIDATE_CAPABILITY": "C",
}


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def strip_ts_comments(text):
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    return re.sub(r"//[^\n]*", "", text)


def parse_shipped_recipes():
    """Shipped recipe id -> sorted ingredient ids, from src/data/recipes.ts (read-only)."""
    text = strip_ts_comments(SRC_RECIPES_PATH.read_text(encoding="utf-8"))
    body = text.split("export const RECIPES", 1)[1]
    out = {}
    for chunk in re.split(r'\n\s*\{\s*\n\s*id: "', body)[1:]:
        rid = chunk.split('"', 1)[0]
        req = chunk.split("requiredIngredients:", 1)[1].split("]", 1)[0]
        out[rid] = sorted(set(re.findall(r'ingredientId: "([a-z0-9-]+)"', req)))
    return dict(sorted(out.items()))


def parse_src_ingredient_categories():
    text = strip_ts_comments(SRC_INGREDIENTS_PATH.read_text(encoding="utf-8"))
    out = {}
    for m in re.finditer(r'id: "([a-z0-9-]+)"(.*?)category: "([a-z]+)"', text, flags=re.S):
        out[m.group(1)] = m.group(3)
    return out


# ---------------------------------------------------------------------------------------------
# Targets and runtime identity
# ---------------------------------------------------------------------------------------------
def required_only(entries, required_strengths):
    return [e for e in entries if e.get("strength") in required_strengths]


def row_target(r, required_strengths):
    """Discovery target for an evidence-ready row. Identity = ingredient set + every dimension the
    row's REQUIRED capabilities make observable (candidate-only evidence never enters identity)."""
    ing = r["ingredients"]
    assert ing["complete"] and ing["identityIngredientSet"] is not None, r["evidenceId"]
    caps = sorted(r["requiredCapabilities"])
    items = set(ing["identityIngredientSet"])
    dims = {"dough": "standard", "pan": None, "layerOrder": "standard", "zones": [], "late": [],
            "prep": [], "enclosure": None, "shape": "round", "cook": "bake", "laminate": False, "spreadLayers": None}
    if "DOUGH_VARIANT" in caps:
        v = r["dough"]["variant"]
        assert v, r["evidenceId"]
        items.add("dough:" + v)
        dims["dough"] = v
    if "PAN_BAKE" in caps:
        p = r["cookingProfile"]["pan"]
        assert p, r["evidenceId"]
        items.add("pan:" + p)
        dims["pan"] = p
    if "STEP_ORDER" in caps:
        dims["layerOrder"] = r["placementLayering"]["layerOrder"]
    if "ZONED_PLACEMENT" in caps:
        dims["zones"] = sorted(z["mode"] for z in required_only(r["placementLayering"]["zones"], required_strengths))
    if "LATE_ADDITION" in caps:
        dims["late"] = sorted([a["mode"], sorted(a["ingredients"])] for a in required_only(r["postBakeFinish"], required_strengths))
    if "PREP_STEP" in caps:
        dims["prep"] = sorted([p["mode"], sorted(p["ingredients"])] for p in r["prep"])
    if "ENCLOSE" in caps:
        dims["enclosure"] = r["placementLayering"]["enclosure"]
    if "DOUGH_SHAPE_TARGET" in caps:
        dims["shape"] = r["dough"]["shape"]
    if "FRY_COOK" in caps:
        dims["cook"] = r["cookingProfile"]["method"]
    if "LAMINATE" in caps:
        dims["laminate"] = True
    if "MULTI_SPREAD_LAYER" in caps:
        dims["spreadLayers"] = list(r["placementLayering"]["spreadLayers"])
    return {
        "targetId": r["evidenceId"], "source": "pizzadb-172", "nameJa": r["nameJa"],
        "items": sorted(items), "capabilities": caps, "identityDimensions": dims,
        "productDecisionStatus": r["productDecisionStatus"],
        "reviewItems": sorted({x["type"] for x in r["reviewItems"]}),
    }


def shipped_target(rid, ingredients, name_ja):
    dims = {"dough": "standard", "pan": None, "layerOrder": "standard", "zones": [], "late": [],
            "prep": [], "enclosure": None, "shape": "round", "cook": "bake", "laminate": False, "spreadLayers": None}
    return {"targetId": "shipped:" + rid, "source": "shipped-src", "nameJa": name_ja, "items": list(ingredients),
            "capabilities": [], "identityDimensions": dims, "productDecisionStatus": "SHIPPED_KEEP_ASSUMPTION",
            "reviewItems": []}


def signature(t):
    return json.dumps([t["items"], t["identityDimensions"]], ensure_ascii=False, sort_keys=True)


def node_kind(node):
    if node in CAPABILITY_ONBOARDING:
        return "capability"
    if node.startswith("dough:"):
        return "dough"
    if node.startswith("pan:"):
        return "pan"
    return "ingredient"


def node_prereq(node):
    if node.startswith("dough:"):
        return "DOUGH_VARIANT"
    if node.startswith("pan:"):
        return "PAN_BAKE"
    return None


def requirements(t):
    return frozenset(t["items"]) | frozenset(t["capabilities"])


# ---------------------------------------------------------------------------------------------
# Unlock schedule (deterministic greedy over single nodes and pairs, bundle fallback)
# ---------------------------------------------------------------------------------------------
def build_schedule(targets, policy_id):
    policy = MECHANIC_POLICIES[policy_id]
    unlocked = set(STARTER_ITEMS)
    req = {t["targetId"]: requirements(t) for t in targets}
    discoverable = sorted(tid for tid, r in req.items() if r <= unlocked)
    remaining = {tid for tid in req if tid not in set(discoverable)}
    steps = [{"step": 0, "nodes": [{"id": n, "kind": node_kind(n)} for n in STARTER_ITEMS], "reason": "starter",
              "newlyDiscoverable": discoverable, "cumulativeDiscoverable": len(discoverable)}]
    last_mech_at = None
    spacing_relaxations = 0

    def weight(n):
        if node_kind(n) == "capability" and policy["weightedCapabilities"]:
            return cap_weight(n)
        return 1.0

    def allowed(nodes, cum, allow_mech):
        for n in nodes:
            p = node_prereq(n)
            if p and p not in unlocked and p not in nodes:
                return False
            if node_kind(n) == "capability" and not allow_mech:
                return False
        return True

    while remaining:
        cum = len(req) - len(remaining)
        missing = {tid: req[tid] - unlocked for tid in sorted(remaining)}
        # Candidate unlock sets = the exact missing sets of size <= MAX_CANDIDATE_SIZE; gain = how
        # many remaining targets that exact set completes. A superset never completes more targets
        # than the union of its members' exact sets, so this is complete for small steps.
        exact = Counter(tuple(sorted(m)) for m in missing.values() if len(m) <= MAX_CANDIDATE_SIZE)
        gains = Counter()
        for nodes in exact:
            s = set(nodes)
            gains[nodes] = sum(1 for m in missing.values() if m <= s)
        reuse = Counter()
        for m in missing.values():
            for n in m:
                reuse[n] += 1
        mech_ok_spacing = (cum >= policy["minDiscoverableBeforeFirstMechanic"] and
                           (last_mech_at is None or cum - last_mech_at >= policy["mechanicSpacing"]))
        cands = []
        for nodes, gain in gains.items():
            if not allowed(nodes, cum, True):
                continue
            has_mech = any(node_kind(n) == "capability" for n in nodes)
            mech_w = max((cap_weight(n) for n in nodes if node_kind(n) == "capability"), default=0)
            score = gain / sum(weight(n) for n in nodes)
            cands.append({"nodes": nodes, "gain": gain, "hasMech": has_mech, "mechWeight": mech_w,
                          "key": (-score, -sum(reuse[n] for n in nodes), len(nodes), nodes)})
        choice = None
        if cands:
            plain = [c for c in cands if not c["hasMech"]]
            mech = [c for c in cands if c["hasMech"]]
            if policy["cadence"] and mech_ok_spacing and mech:
                # tutorial cadence: when a technique slot is open, teach the lightest available one
                pick = min(mech, key=lambda c: (c["mechWeight"], c["key"]))
            elif policy["mechanicsOnlyWhenIngredientsExhausted"] or policy["cadence"]:
                pool = plain or mech
                pick = min(pool, key=lambda c: c["key"])
                if policy["cadence"] and not plain and not mech_ok_spacing:
                    spacing_relaxations += 1
            else:
                pick = min(cands, key=lambda c: c["key"])
            choice = (pick["nodes"], {1: "single", 2: "pair"}.get(len(pick["nodes"]), "set"))
        if choice is None:
            # bundle fallback: the target with the fewest missing nodes (ties by id)
            tid = min(missing, key=lambda x: (len(missing[x]), x))
            nodes = tuple(sorted(missing[tid], key=lambda n: (node_prereq(n) is not None, n)))
            choice = (nodes, "bundle")
        nodes, reason = choice
        # a capability's own item prerequisite: order capability first inside the step
        nodes = tuple(sorted(nodes, key=lambda n: (node_kind(n) != "capability", n)))
        unlocked |= set(nodes)
        if any(node_kind(n) == "capability" for n in nodes):
            last_mech_at = cum
        newly = sorted(tid for tid in remaining if req[tid] <= unlocked)
        remaining -= set(newly)
        steps.append({"step": len(steps), "nodes": [{"id": n, "kind": node_kind(n)} for n in nodes], "reason": reason,
                      "newlyDiscoverable": newly, "cumulativeDiscoverable": len(req) - len(remaining)})
    total = len(req)
    for s in steps:
        frac = s["cumulativeDiscoverable"] / total if total else 1
        s["tier"] = next(name for name, hi in TIER_BANDS if frac <= hi)
    return {"policy": policy_id, "steps": steps, "spacingRelaxations": spacing_relaxations, "targetCount": total}


def schedule_node_table(schedule, targets):
    by_node_targets = defaultdict(list)
    for t in targets:
        for n in requirements(t):
            by_node_targets[n].append(t["targetId"])
    rows = []
    cum_before = 0
    for s in schedule["steps"]:
        for nd in s["nodes"]:
            n = nd["id"]
            later = sorted(set(by_node_targets[n]) - set(s["newlyDiscoverable"]))
            rows.append({
                "node": n, "kind": nd["kind"], "step": s["step"], "tier": s["tier"],
                "prerequisite": {"capability": node_prereq(n)} if node_prereq(n) else None,
                "unlockedTogetherWith": [x["id"] for x in s["nodes"] if x["id"] != n],
                "newlyDiscoverableAtStep": len(s["newlyDiscoverable"]),
                "cumulativeDiscoverableBefore": cum_before,
                "cumulativeDiscoverableAfter": s["cumulativeDiscoverable"],
                "totalTargetsUsingNode": len(by_node_targets[n]),
                "laterTargetsUsingNode": len(later),
                "laterTargetIds": later,
                "deadNode": len(by_node_targets[n]) == 0,
            })
        cum_before = s["cumulativeDiscoverable"]
    return rows


def mechanic_introductions(schedule):
    out = []
    for s in schedule["steps"]:
        for nd in s["nodes"]:
            if nd["kind"] == "capability":
                prev = schedule["steps"][s["step"] - 1]["cumulativeDiscoverable"]
                out.append({"capability": nd["id"], "step": s["step"], "discoverableBefore": prev,
                            "newlyDiscoverableAtStep": len(s["newlyDiscoverable"]), "tier": s["tier"],
                            "onboardingWeight": cap_weight(nd["id"])})
    return out


def mechanic_pressure(schedule, sim):
    at = [m["discoverableBefore"] for m in mechanic_introductions(schedule)]
    window = max((sum(1 for y in at if x <= y < x + 10) for x in at), default=0)
    gaps = [b - a for a, b in zip(at, at[1:])]
    return {"introducedAtDiscoverable": at, "firstMechanicAt": at[0] if at else None,
            "maxMechanicsWithin10Discoveries": window, "minGapBetweenMechanics": min(gaps) if gaps else None,
            "capabilitiesNeverIntroduced": sorted(set(CAPABILITY_ONBOARDING) - {m["capability"] for m in mechanic_introductions(schedule)}),
            "standardBakesToAll": sim["bakesToDiscovery"].get("all")}


def capability_impact(targets, schedule, matrix_rows):
    """Per capability: targets requiring it, targets it is the only missing capability for, the
    incremental coverage in the order the schedule introduces capabilities, and the demand from
    all 172 rows (including rows still blocked by a decision) for context."""
    out = []
    demand_all = Counter(c for r in matrix_rows for c in r["requiredCapabilities"])
    demand_blocked = Counter(c for r in matrix_rows if r["productDecisionStatus"] not in READY_STATUSES
                             for c in r["requiredCapabilities"])
    order = [m["capability"] for m in mechanic_introductions(schedule)]
    have = set()
    base = sum(1 for t in targets if not t["capabilities"])
    for cap in order:
        have.add(cap)
        cum = sum(1 for t in targets if set(t["capabilities"]) <= have)
        out.append({
            "capability": cap,
            "targetsRequiring": sum(1 for t in targets if cap in t["capabilities"]),
            "targetsRequiringOnlyThis": sum(1 for t in targets if t["capabilities"] == [cap]),
            "capabilitySetCoverageAfter": cum,
            "incrementalCoverage": cum - base,
            "rowsRequiringAcross172": demand_all[cap],
            "blockedRowsRequiring": demand_blocked[cap],
            "onboarding": CAPABILITY_ONBOARDING[cap] | {"weight": cap_weight(cap)},
        })
        base = cum
    for cap in sorted(set(CAPABILITY_ONBOARDING) - set(order)):
        out.append({"capability": cap, "targetsRequiring": 0, "targetsRequiringOnlyThis": 0,
                    "capabilitySetCoverageAfter": None, "incrementalCoverage": 0,
                    "rowsRequiringAcross172": demand_all[cap], "blockedRowsRequiring": demand_blocked[cap],
                    "onboarding": CAPABILITY_ONBOARDING[cap] | {"weight": cap_weight(cap)},
                    "note": "no evidence-ready target needs it; introduce only once a blocked row that needs it is resolved"})
    return out


# ---------------------------------------------------------------------------------------------
# Economy simulation (deterministic agent)
# ---------------------------------------------------------------------------------------------
def step_gates(schedule, curve_id, tables=None):
    curve = (tables or default_tables())["gateCurves"][curve_id]
    gates = []
    for i, s in enumerate(schedule["steps"]):
        if i == 0:
            gates.append(0)
            continue
        if curve["gate"] == "FIXED_LADDER":
            gates.append(curve["ladderStep"] * i)
        else:
            prev = schedule["steps"][i - 1]["cumulativeDiscoverable"]
            need = math.ceil(curve["fraction"] * prev - 1e-9)
            gates.append(need * curve["guaranteedStarsPerDiscovery"])
    # monotone non-decreasing
    for i in range(1, len(gates)):
        gates[i] = max(gates[i], gates[i - 1])
    return gates


def node_price(schedule_cfg, step, gain):
    kind = schedule_cfg["kind"]
    if kind == "FLAT":
        return schedule_cfg["price"]
    if kind == "BY_TIER":
        return schedule_cfg["byTier"][step["tier"]]
    if kind == "IMPACT":
        return schedule_cfg["base"] + schedule_cfg["perNewTarget"] * min(schedule_cfg["newTargetCap"], gain)
    raise KeyError(kind)


def stars_for_discovery(curve, skill_stars):
    model = curve["starModel"]
    if model == "SUM_BEST":
        return skill_stars
    if model == "DISCOVERY_COUNT":
        return 1
    return curve["discoveryStars"] + sum(1 for q in curve["qualityBonusAtStars"] if skill_stars >= q)


def default_tables():
    """Every economy/player parameter the simulator reads. `simulate` only ever reads these through
    a `tables` bundle, so the validator can rebuild the bundle from the serialized JSON and re-run
    the simulations to prove the JSON alone reconstructs every simulated policy."""
    return {"gateCurves": GATE_CURVES, "priceSchedules": PRICE_SCHEDULES, "stockPolicies": STOCK_POLICIES,
            "rewardTables": REWARD_TABLES, "skills": SKILLS, "explorers": EXPLORERS, "hintPolicies": HINT_POLICIES}


def serialize_reward_tables(tables):
    return {k: {"labelJa": v["labelJa"], "base": v["base"], "mult": {str(a): b for a, b in v["mult"].items()},
                "discoveryBonus": v["discoveryBonus"]} for k, v in tables.items()}


def tables_from_json(out):
    """Rebuild the simulator's parameter bundle purely from the serialized matrix."""
    return {
        "gateCurves": out["gateCurves"], "priceSchedules": out["priceSchedules"], "stockPolicies": out["stockPolicies"],
        "rewardTables": {k: {"labelJa": v["labelJa"], "base": v["base"], "mult": {int(a): b for a, b in v["mult"].items()},
                             "discoveryBonus": v["discoveryBonus"]} for k, v in out["rewardTables"].items()},
        "skills": out["skills"], "explorers": out["explorers"], "hintPolicies": out["hintPolicies"],
    }


def found_on_own(target_id, find_rate):
    """Stable, platform-independent 'does this player find it without a hint' draw."""
    if find_rate >= 1.0:
        return True
    h = int(hashlib.sha256(target_id.encode("utf-8")).hexdigest()[:8], 16) % 1000
    return h < round(find_rate * 1000)


def simulate(targets, schedule, curve_id, price_id, stock_id, reward_id, skill_id,
             explorer_id="COMPLETIONIST", hints_id="HINTS_ON", log_limit=0, tables=None):
    """One deterministic player run. A turn is one PASS bake. Buying, restocking and receiving
    capabilities are free actions between bakes. Every bake is either a discovery bake (the first
    known, owned, in-stock undiscovered target in schedule order) or an income bake of an
    already-discovered target that uses only unlimited starter items."""
    tb = tables or default_tables()
    skill = tb["skills"][skill_id]["stars"]
    rt = tb["rewardTables"][reward_id]
    bake_reward = round(rt["base"] * rt["mult"][skill])
    discovery_bonus = rt["discoveryBonus"]
    stock_cfg = tb["stockPolicies"][stock_id]
    price_cfg = tb["priceSchedules"][price_id]
    curve = tb["gateCurves"][curve_id]
    find_rate = tb["explorers"][explorer_id]["findRate"]
    idle_before_hint = tb["hintPolicies"][hints_id]["idleBakesBeforeHint"]
    gates = step_gates(schedule, curve_id, tb)
    by_id = {t["targetId"]: t for t in targets}
    starters = set(STARTER_ITEMS)

    def consumables(t):
        return [n for n in t["items"] if node_kind(n) == "ingredient" and n not in starters]

    queue = []
    for i, st in enumerate(schedule["steps"]):
        if i == 0:
            continue
        for nd in st["nodes"]:
            queue.append({"node": nd["id"], "kind": nd["kind"], "step": i, "gate": gates[i],
                          "price": 0 if nd["kind"] == "capability" else node_price(price_cfg, st, len(st["newlyDiscoverable"]))})
    price_of = {q["node"]: q["price"] for q in queue}
    tutorial = set(schedule["steps"][0]["newlyDiscoverable"])
    known = {t["targetId"] for t in targets if t["targetId"] in tutorial or found_on_own(t["targetId"], find_rate)}
    owned = set(STARTER_ITEMS)
    stock = defaultdict(int)
    discovered, discovered_set, unlimited_discovered = [], set(), []
    stars = pitz = turns = grind_turns = restocks = hints_used = 0
    spent_purchase = spent_restock = 0
    grind_streak = max_grind_streak = idle = 0
    max_grind_at = None
    qi = 0
    milestones, events = {}, []
    owned_snapshots = {"start": sorted(owned)}
    outcome = None
    bottleneck_counter = Counter()
    target_order = [tid for st in schedule["steps"] for tid in st["newlyDiscoverable"]]

    def log(kind, **kw):
        if log_limit and len(discovered) <= log_limit:
            events.append({"turn": turns, "event": kind, **kw})

    while turns < TURN_CAP:
        progressed = True
        while progressed and qi < len(queue):
            progressed = False
            q = queue[qi]
            if stars < q["gate"]:
                break
            if q["kind"] == "capability":
                owned.add(q["node"])
                log("unlock_capability", node=q["node"], gateStars=q["gate"])
                qi += 1
                progressed = True
            elif pitz >= q["price"]:
                pitz -= q["price"]
                spent_purchase += q["price"]
                owned.add(q["node"])
                if q["kind"] == "ingredient":
                    stock[q["node"]] += stock_cfg["grant"]
                log("buy", node=q["node"], price=q["price"], pitzAfter=pitz, gateStars=q["gate"])
                qi += 1
                progressed = True
        bakeable = starved = None
        makeable_unknown = []
        for tid in target_order:
            if tid in discovered_set:
                continue
            t = by_id[tid]
            if not requirements(t) <= owned:
                continue
            if tid not in known:
                makeable_unknown.append(tid)
                continue
            short = [n for n in consumables(t) if stock[n] < 1]
            if not short:
                bakeable = t
                break
            if starved is None:
                starved = (t, short)
        if bakeable is None and starved is not None:
            n = starved[1][0]
            rprice = math.ceil(price_of[n] * stock_cfg["restockFactor"])
            if pitz >= rprice:
                pitz -= rprice
                spent_restock += rprice
                stock[n] += stock_cfg["restock"]
                restocks += 1
                log("restock", node=n, price=rprice, pitzAfter=pitz)
                continue
        if bakeable is None and makeable_unknown and idle_before_hint is not None and idle >= idle_before_hint:
            known.add(makeable_unknown[0])
            hints_used += 1
            idle = 0
            log("teto_hint", target=makeable_unknown[0])
            continue
        if bakeable is not None:
            turns += 1
            t = bakeable
            for n in consumables(t):
                stock[n] -= 1
            discovered.append(t["targetId"])
            discovered_set.add(t["targetId"])
            stars += stars_for_discovery(curve, skill)
            pitz += bake_reward + discovery_bonus
            grind_streak = idle = 0
            if not consumables(t):
                unlimited_discovered.append(t["targetId"])
            n_disc = len(discovered)
            if n_disc in (1, 10, 20, 50):
                milestones[str(n_disc)] = turns
                # ownership actually held when this milestone discovery was baked (purchases run
                # ahead of discoveries because gates open at a fraction of what is discoverable)
                owned_snapshots[str(n_disc)] = sorted(owned)
            log("discover", target=t["targetId"], nameJa=t["nameJa"], n=n_disc, stars=stars, pitzAfter=pitz)
            if n_disc == len(targets):
                milestones["all"] = turns
                owned_snapshots["all"] = sorted(owned)
                outcome = "COMPLETE"
                break
            continue
        # no discovery possible this bake
        if qi >= len(queue) and starved is None and not makeable_unknown:
            outcome = "COMPLETE" if len(discovered) == len(targets) else "UNREACHABLE_TARGETS"
            break
        gate_blocked = qi < len(queue) and stars < queue[qi]["gate"]
        if gate_blocked and starved is None and (not makeable_unknown or idle_before_hint is None):
            outcome = "STAR_DEADLOCK"  # stars only come from discoveries and the player can find none
            break
        if qi >= len(queue) and starved is None and makeable_unknown and idle_before_hint is None:
            outcome = "PLATEAU_UNFOUND"  # everything bought, the rest is never found without hints
            break
        if not unlimited_discovered:
            outcome = "START_DEADLOCK" if not discovered else "PITZ_DEADLOCK_NO_UNLIMITED_RECIPE"
            break
        if bake_reward <= 0:
            outcome = "PITZ_DEADLOCK_ZERO_REWARD"
            break
        turns += 1
        pitz += bake_reward
        grind_turns += 1
        grind_streak += 1
        idle += 1
        waiting_on = ("restock" if starved is not None else "gate_hint" if gate_blocked else
                      "purchase" if qi < len(queue) else "hint")
        bottleneck_counter[f"step{queue[qi]['step'] if qi < len(queue) else 'end'}:{waiting_on}"] += 1
        if grind_streak > max_grind_streak:
            max_grind_streak = grind_streak
            max_grind_at = {"afterDiscoveries": len(discovered), "waitingOn": waiting_on,
                            "nextNode": queue[qi]["node"] if qi < len(queue) else None}
    if outcome is None:
        outcome = "TURN_CAP"
    return {
        "curve": curve_id, "price": price_id, "stock": stock_id, "reward": reward_id, "skill": skill_id,
        "explorer": explorer_id, "hints": hints_id,
        "outcome": outcome, "deadlock": outcome != "COMPLETE",
        "discovered": len(discovered), "targets": len(targets), "turns": turns,
        "bakesToDiscovery": milestones, "grindBakes": grind_turns,
        "grindShare": round(grind_turns / turns, 3) if turns else None,
        "maxGrindStreak": max_grind_streak, "maxGrindStreakAt": max_grind_at, "hintsUsed": hints_used,
        "restocks": restocks, "pitzSpentPurchase": spent_purchase, "pitzSpentRestock": spent_restock,
        "finalStars": stars, "finalPitz": pitz, "bakeRewardPitz": bake_reward,
        "topBottlenecks": [{"key": k, "grindBakes": v} for k, v in sorted(bottleneck_counter.items(), key=lambda kv: (-kv[1], kv[0]))[:5]],
        "events": events if log_limit else None,
        "ownedSnapshots": owned_snapshots if log_limit else None,
    }


# ---------------------------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------------------------
def build():
    matrix = load(MATRIX_PATH)
    rows = matrix["rows"]
    required_strengths = set(matrix["requiredStrengths"])
    shipped = parse_shipped_recipes()
    src_categories = parse_src_ingredient_categories()
    ing_catalog = load(INGREDIENT_CATALOG_PATH)
    catalog_category = {i["id"]: i["category"] for i in ing_catalog["ingredients"]}
    shipped_name = {}
    txt = strip_ts_comments(SRC_RECIPES_PATH.read_text(encoding="utf-8"))
    for m in re.finditer(r'id: "([a-z0-9-]+)",\s*nameJa: "([^"]+)"', txt):
        shipped_name[m.group(1)] = m.group(2)

    ready_rows = [r for r in rows if r["productDecisionStatus"] in READY_STATUSES]
    row_targets = [row_target(r, required_strengths) for r in ready_rows]
    corroborated = {r["phase0"]["correspondsToExistingCatalogId"] for r in ready_rows
                    if r["productDecisionStatus"] == "ALREADY_SHIPPED_CORROBORATED"}
    overlay = [shipped_target(rid, ings, shipped_name.get(rid, rid)) for rid, ings in shipped.items()
               if rid not in corroborated]
    shipped_row_of = {}
    for r in rows:
        cid = r["phase0"]["correspondsToExistingCatalogId"]
        if cid in shipped:
            shipped_row_of[cid] = r["evidenceId"]

    profiles = {}
    for pid, prof in DECISION_PROFILES.items():
        targets = list(row_targets) + (list(overlay) if prof["includeShippedOverlay"] else [])
        targets.sort(key=lambda t: t["targetId"])
        sig_groups = defaultdict(list)
        for t in targets:
            sig_groups[signature(t)].append(t["targetId"])
        collisions = sorted(sorted(v) for v in sig_groups.values() if len(v) > 1)
        schedules = {mp: build_schedule(targets, mp) for mp in MECHANIC_POLICIES}
        start_discoverable = schedules[RECOMMENDED_MECHANIC_POLICY]["steps"][0]["newlyDiscoverable"]
        profiles[pid] = {"targets": targets, "collisions": collisions, "schedules": schedules,
                         "startDiscoverable": start_discoverable}

    rec = profiles[RECOMMENDED_PROFILE]
    rec_targets = rec["targets"]
    rec_schedule = rec["schedules"][RECOMMENDED_MECHANIC_POLICY]
    reached_at = {}
    for s in rec_schedule["steps"]:
        for tid in s["newlyDiscoverable"]:
            reached_at[tid] = s["step"]

    # --- per-row classification (all 172) ------------------------------------------------------
    row_class = []
    for r in rows:
        blockers = sorted({b["type"] for b in r["blockers"]})
        entry = {
            "evidenceId": r["evidenceId"], "nameJa": r["nameJa"], "phase1Status": r["productDecisionStatus"],
            "currentFlowRepresentability": r["currentFlowRepresentability"],
            "requiredCapabilities": sorted(r["requiredCapabilities"]),
        }
        if r["productDecisionStatus"] in READY_STATUSES:
            entry["phase2Class"] = "EVIDENCE_READY_TARGET"
            entry["reachableAtStep"] = reached_at.get(r["evidenceId"])
            entry["tier"] = rec_schedule["steps"][reached_at[r["evidenceId"]]]["tier"] if r["evidenceId"] in reached_at else None
            entry["blockerTypes"] = []
            entry["ledgerClass"] = None
            entry["reviewLedgerClasses"] = sorted({REVIEW_CLASS[x["type"]] for x in r["reviewItems"]})
        else:
            evidence = [b for b in blockers if b in ("UNRESOLVED_INGREDIENT", "BASE_SAUCE_UNSPECIFIED", "EVIDENCE_GAP")]
            if evidence:
                cls = "BLOCKED_EVIDENCE"
            elif "DISCOVERY_COLLISION" in blockers:
                cls = "BLOCKED_DISCOVERY_RULE"
            elif "MECHANIC_INTERPRETATION" in blockers:
                cls = "BLOCKED_MECHANIC_INTERPRETATION"
            else:
                cls = "BLOCKED_PRODUCT_DECISION"
            entry["phase2Class"] = cls
            entry["reachableAtStep"] = None
            entry["tier"] = None
            entry["blockerTypes"] = blockers
            entry["ledgerClass"] = "A" if r["evidenceId"] == shipped_row_of.get("margherita") else "B"
            entry["reviewLedgerClasses"] = sorted({REVIEW_CLASS[x["type"]] for x in r["reviewItems"]})
            cid = r["phase0"]["correspondsToExistingCatalogId"]
            entry["coveredByShippedTargetUnderSHIPPED_KEEP"] = ("shipped:" + cid) if cid in shipped and cid not in corroborated else None
            entry["unresolvedTokens"] = [x if isinstance(x, str) else x.get("token") for x in r["ingredients"]["unresolvedTokens"]]
            entry["wouldNeedCapabilitiesOnceUnblocked"] = sorted(r["requiredCapabilities"])
        row_class.append(entry)

    # --- alternative first discoveries under EVIDENCE_STRICT ------------------------------------
    alt_first = sorted(
        ({"targetId": t["targetId"], "nameJa": t["nameJa"], "items": t["items"]}
         for t in profiles["EVIDENCE_STRICT"]["targets"] if not t["capabilities"] and len(t["items"]) <= 3),
        key=lambda x: (len(x["items"]), x["targetId"]))

    # --- economy simulations --------------------------------------------------------------------
    sims = []
    base = dict(RECOMMENDED_ECONOMY)

    def run(profile_id, policy_id, tag, log_limit=0, **kw):
        cfg = {"curve": base["gate"], "price": base["price"], "stock": base["stock"], "reward": base["reward"],
               "skill": "STANDARD", "explorer": "COMPLETIONIST", "hints": base["hints"]}
        cfg.update(kw)
        p = profiles[profile_id]
        res = simulate(p["targets"], p["schedules"][policy_id], cfg["curve"], cfg["price"], cfg["stock"], cfg["reward"],
                       cfg["skill"], cfg["explorer"], cfg["hints"], log_limit)
        res.update({"profile": profile_id, "mechanicPolicy": policy_id, "comparison": tag})
        return res

    R, M = RECOMMENDED_PROFILE, RECOMMENDED_MECHANIC_POLICY
    for curve in GATE_CURVES:
        for explorer in EXPLORERS:
            for hints in HINT_POLICIES:
                sims.append(run(R, M, "gateCurve", curve=curve, explorer=explorer, hints=hints))
    for skill in SKILLS:
        for explorer in EXPLORERS:
            sims.append(run(R, M, "recommendedRobustness", skill=skill, explorer=explorer))
    for price in PRICE_SCHEDULES:
        for stock in STOCK_POLICIES:
            for skill in ("BEGINNER", "STANDARD"):
                sims.append(run(R, M, "priceStock", price=price, stock=stock, skill=skill))
    for reward in REWARD_TABLES:
        for skill in ("WORST", "BEGINNER", "STANDARD"):
            sims.append(run(R, M, "reward", reward=reward, skill=skill))
    for policy in MECHANIC_POLICIES:
        sims.append(run(R, policy, "mechanicPolicy"))
    for skill in SKILLS:
        sims.append(run("EVIDENCE_STRICT", M, "decisionProfile", skill=skill))
    for s_ in sims:
        s_.pop("events")
        s_.pop("ownedSnapshots")
    walkthrough = run(R, M, "walkthrough", log_limit=50)
    events = walkthrough.pop("events")
    owned_snapshots = walkthrough.pop("ownedSnapshots")
    first = {}
    disc = [e for e in events if e["event"] == "discover"]
    for n in (10, 20, 50):
        first[str(n)] = [{"n": e["n"], "turn": e["turn"], "targetId": e["target"], "nameJa": e["nameJa"],
                          "stars": e["stars"], "pitzAfter": e["pitzAfter"]} for e in disc[:n]]
    unlock_events = [e for e in events if e["event"] in ("buy", "unlock_capability", "teto_hint")]

    # --- UI sizing ------------------------------------------------------------------------------
    # PR #191 review (P2): derived from what the walkthrough player actually OWNS when it bakes
    # discovery 10/20/50 (and at start / completion), never from schedule coverage.
    ui = ui_sizing(owned_snapshots, matrix, src_categories, catalog_category)

    # --- summaries ------------------------------------------------------------------------------
    def sim_key(s):
        return (s["comparison"], s["profile"], s["mechanicPolicy"], s["curve"], s["price"], s["stock"], s["reward"],
                s["skill"], s["explorer"], s["hints"])
    sims.sort(key=sim_key)
    rec_sims = [s for s in sims if s["comparison"] == "recommendedRobustness"]
    profile_summ = {}
    for pid, p in profiles.items():
        sch = p["schedules"][RECOMMENDED_MECHANIC_POLICY]
        profile_summ[pid] = {
            "labelJa": DECISION_PROFILES[pid]["labelJa"], "assumptions": DECISION_PROFILES[pid]["assumptions"],
            "targetCount": len(p["targets"]),
            "targetsFrom172": sum(1 for t in p["targets"] if t["source"] == "pizzadb-172"),
            "targetsFromShippedOverlay": sum(1 for t in p["targets"] if t["source"] == "shipped-src"),
            "runtimeSignatureCollisions": p["collisions"],
            "discoverableAtStart": p["startDiscoverable"],
            "finalReachable": sch["steps"][-1]["cumulativeDiscoverable"],
            "scheduleSteps": len(sch["steps"]) - 1,
            "unlockNodes": sum(len(s["nodes"]) for s in sch["steps"][1:]),
        }

    out = {
        "schemaNote": ("Progression 2.0 Phase 2 (Issue #190) discovery/unlock/economy design candidate. Docs/data only; "
                       "NOT src/**, NOT the production Progression SSOT, NOT final prices or thresholds. Generated "
                       "deterministically by tools/progression2_phase2_progression.py from the Phase-1 matrix and read-only "
                       "production data. Every value here is a comparison candidate; the recommended one is labelled."),
        "generatedBy": "tools/progression2_phase2_progression.py",
        "issue": "https://github.com/perusonao/teto-pizza-game/issues/190",
        "inputs": [str(p.relative_to(ROOT)) for p in (MATRIX_PATH, SRC_RECIPES_PATH, SRC_INGREDIENTS_PATH, INGREDIENT_CATALOG_PATH)],
        "phase1MatrixRowCount": len(rows),
        "starterItems": list(STARTER_ITEMS),
        "discoveryRule": {
            "matching": "exact runtime-signature match of a PASS free-cooked pizza against every discoverable, undiscovered target",
            "signatureDimensions": ["ingredientSet (incl. base sauce)", "dough (standard | evidenced variant)", "pan", "layerOrder",
                                    "zones", "lateAdditions(mode, ingredients)", "prep(mode, ingredients)", "enclosure", "shape",
                                    "cookMethod", "laminate", "spreadLayer order"],
            "observationRule": "a dimension is observed only once its capability is unlocked; before that the default value is assumed, so a player can never miss a target because of a dimension they cannot yet control",
            "candidateOnlyEvidence": "never part of identity (Phase-1 CANDIDATE strengths are excluded)",
            "extraIngredients": "a superset of a target's ingredients is an ORIGINAL pizza, not a discovery (Teto may give a near-miss hint)",
        },
        "decisionProfiles": profile_summ,
        "recommended": {"profile": RECOMMENDED_PROFILE, "mechanicPolicy": RECOMMENDED_MECHANIC_POLICY, "economy": RECOMMENDED_ECONOMY},
        "capabilityOnboarding": {k: v | {"weight": cap_weight(k)} for k, v in CAPABILITY_ONBOARDING.items()},
        "mechanicPolicies": MECHANIC_POLICIES,
        "gateCurves": GATE_CURVES,
        "priceSchedules": PRICE_SCHEDULES,
        "stockPolicies": STOCK_POLICIES,
        "rewardTables": serialize_reward_tables(REWARD_TABLES),
        "skills": SKILLS,
        "explorers": EXPLORERS,
        "hintPolicies": HINT_POLICIES,
        "recommendedGates": step_gates(rec_schedule, base["gate"]),
        "unlockSchedules": {pid: {mp: sch for mp, sch in p["schedules"].items()} for pid, p in profiles.items()},
        "nodeImpact": schedule_node_table(rec_schedule, rec_targets),
        "mechanicIntroductions": {mp: mechanic_introductions(sch) for mp, sch in rec["schedules"].items()},
        "mechanicPolicyComparison": {mp: mechanic_pressure(sch, [s_ for s_ in sims if s_["comparison"] == "mechanicPolicy" and s_["mechanicPolicy"] == mp][0])
                                     for mp, sch in rec["schedules"].items()},
        "capabilityImpact": capability_impact(rec_targets, rec_schedule, rows),
        "targets": {pid: p["targets"] for pid, p in profiles.items()},
        "rowClassification": row_class,
        "rowClassificationSummary": dict(sorted(Counter(e["phase2Class"] for e in row_class).items())),
        "alternativeFirstDiscoveriesEvidenceStrict": alt_first,
        "simulations": sims,
        "recommendedSimulationBySkill": [{k: s[k] for k in ("skill", "explorer", "outcome", "turns", "bakesToDiscovery", "grindBakes", "maxGrindStreak", "hintsUsed", "restocks")} for s in rec_sims],
        "walkthrough": {"config": {k: walkthrough[k] for k in ("profile", "mechanicPolicy", "curve", "price", "stock", "reward", "skill", "explorer", "hints")},
                        "first10": first["10"], "first20": first["20"], "first50": first["50"],
                        "ownedAtDiscovery": owned_snapshots,
                        "unlockEventsUntil50": unlock_events},
        "uiSizing": ui,
        "uiSizingBasis": "walkthrough player's actual owned items at the moment it bakes each milestone discovery (see walkthrough.config)",
        "designDecisions": resolved_design_decisions(),
    }
    ni = out["nodeImpact"]
    out["nodeSummary"] = {
        "unlockNodesByKind": dict(sorted(Counter(n["kind"] for n in ni if n["step"] > 0).items())),
        "unlockNodesByTier": dict(sorted(Counter(n["tier"] for n in ni if n["step"] > 0).items())),
        "targetsByTier": dict(sorted(Counter(e["tier"] for e in [
            {"tier": s_["tier"]} for s_ in rec_schedule["steps"] for _ in s_["newlyDiscoverable"]]).items())),
        "oneShotIngredients": sorted(n["node"] for n in ni if n["kind"] == "ingredient" and n["totalTargetsUsingNode"] == 1),
        "hubIngredientsTop10": [{"node": n["node"], "targets": n["totalTargetsUsingNode"]} for n in
                                sorted((n for n in ni if n["kind"] == "ingredient"), key=lambda n: (-n["totalTargetsUsingNode"], n["node"]))[:10]],
    }
    out["noDeadlockProof"] = build_proof(out)
    return out


UI_SNAPSHOT_LABELS = ("start", "10", "20", "50", "all")


def ui_sizing(owned_snapshots, matrix, src_categories, catalog_category):
    spread_ids = set(matrix["spreadLayerIngredientIds"])
    ui = []
    for label in UI_SNAPSHOT_LABELS:
        owned = owned_snapshots[label]
        ings = sorted(x for x in owned if node_kind(x) == "ingredient")
        cats = Counter(src_categories.get(i) or catalog_category.get(i) or ("sauce(spread)" if i in spread_ids else "uncategorized")
                       for i in ings)
        ui.append({"atDiscoveries": label, "ownedIngredients": len(ings),
                   "ownedDoughVariants": sum(1 for x in owned if node_kind(x) == "dough"),
                   "ownedPans": sum(1 for x in owned if node_kind(x) == "pan"),
                   "byKnownCategory": dict(sorted(cats.items())),
                   "freeCookCombinationSpaceLog2": len(ings)})
    return ui


def build_proof(out):
    rec = out["decisionProfiles"][RECOMMENDED_PROFILE]
    sims = [s for s in out["simulations"] if s["comparison"] == "recommendedRobustness"]
    return {
        "zeroRecipeStart": {
            "claim": "The recommended start (0 discovered, starters tomato-sauce/mozzarella/basil) always has a discoverable target.",
            "discoverableAtStart": rec["discoverableAtStart"],
            "holds": len(rec["discoverableAtStart"]) >= 1,
        },
        "unlimitedIncomeRecipe": {
            "claim": "After the first discovery at least one discovered target uses only unlimited starter items, so a PASS bake is always possible without stock or Pitz.",
            "holds": any(t for t in out["targets"][RECOMMENDED_PROFILE]
                         if t["targetId"] in rec["discoverableAtStart"] and set(t["items"]) <= set(STARTER_ITEMS)),
        },
        "pitzNeverCircular": {
            "claim": "Pitz income needs only that unlimited recipe; with the FLOOR reward every PASS bake pays > 0, so any finite price is reachable.",
            "floorRewardAtStar1": round(REWARD_TABLES["FLOOR"]["base"] * REWARD_TABLES["FLOOR"]["mult"][1]),
            "holds": REWARD_TABLES["FLOOR"]["mult"][1] > 0,
        },
        "starsNeverCircular": {
            "claim": "Each gate asks for at most ceil(f x previously-discoverable) guaranteed-star discoveries, so it is always met by targets that are already discoverable.",
            "holds": all(s["outcome"] == "COMPLETE" for s in sims),
            "runsChecked": [s["skill"] + "/" + s["explorer"] for s in sims],
        },
        "lunchRush": {
            "claim": "Lunch Rush opens at the first discovery and draws orders only from discovered targets with stock; the unlimited Margherita keeps the pool non-empty.",
            "holds": len(rec["discoverableAtStart"]) >= 1,
        },
        "allEvidenceReadyReachable": {
            "claim": "Every evidence-ready target is reachable by the unlock schedule.",
            "reachable": rec["finalReachable"], "targets": rec["targetCount"],
            "holds": rec["finalReachable"] == rec["targetCount"],
        },
    }


# ---------------------------------------------------------------------------------------------
# Markdown rendering
# ---------------------------------------------------------------------------------------------
def md_escape(s):
    return str(s).replace("|", "\\|")


def render_graph_md(out):
    L = []
    rec = out["recommended"]
    L.append("# Progression 2.0 Phase 2 — Unlock graph (generated)")
    L.append("")
    L.append("Generated by `tools/progression2_phase2_progression.py` from "
             "`docs/design/data/TETO_PROGRESSION2_PHASE2_UNLOCK-MATRIX.json`. Do not edit by hand; "
             "`--check` fails if this file drifts from a fresh regeneration.")
    L.append("")
    L.append(f"Recommended profile `{rec['profile']}`, mechanic policy `{rec['mechanicPolicy']}`, economy "
             f"`{rec['economy']['gate']}` / `{rec['economy']['price']}` / `{rec['economy']['stock']}` / `{rec['economy']['reward']}` / `{rec['economy']['hints']}`.")
    L.append("")
    L.append("## 1. Decision profiles")
    L.append("")
    L.append("| Profile | Targets (172 rows + shipped) | Discoverable at start | Final reachable | Unlock steps | Signature collisions |")
    L.append("|---|---|---|---|---|---|")
    for pid, p in out["decisionProfiles"].items():
        L.append(f"| `{pid}` | {p['targetCount']} ({p['targetsFrom172']} + {p['targetsFromShippedOverlay']}) | "
                 f"{len(p['discoverableAtStart'])} {md_escape(', '.join(p['discoverableAtStart']))} | {p['finalReachable']} | "
                 f"{p['scheduleSteps']} | {len(p['runtimeSignatureCollisions'])} |")
    L.append("")
    L.append("## 2. Recommended unlock schedule")
    L.append("")
    gates = out["recommendedGates"]
    sch = out["unlockSchedules"][rec["profile"]][rec["mechanicPolicy"]]
    L.append("⭐ gate = Hybrid stars required before the step's nodes become available (capabilities are granted free at the gate; items become AVAILABLE_TO_BUY).")
    L.append("")
    L.append("| Step | Tier | ⭐ gate | Unlock | New targets | Cumulative | Newly discoverable |")
    L.append("|---|---|---|---|---|---|---|")
    for s in sch["steps"]:
        nodes = ", ".join(f"**{n['id']}**" if n["kind"] == "capability" else n["id"] for n in s["nodes"])
        L.append(f"| {s['step']} | {s['tier']} | {gates[s['step']]} | {md_escape(nodes)} | {len(s['newlyDiscoverable'])} | "
                 f"{s['cumulativeDiscoverable']} | {md_escape(', '.join(s['newlyDiscoverable']))} |")
    L.append("")
    L.append("## 3. Mechanic introduction order by policy")
    L.append("")
    L.append("| Policy | Order (discoverable-before → new at step) |")
    L.append("|---|---|")
    for mp, intro in out["mechanicIntroductions"].items():
        L.append(f"| `{mp}` | " + " → ".join(f"{m['capability']} ({m['discoverableBefore']}→+{m['newlyDiscoverableAtStep']})" for m in intro) + " |")
    L.append("")
    L.append("## 4. Capability impact (recommended order)")
    L.append("")
    L.append("| Capability | Ready targets requiring | Requiring only this | Incremental coverage | Coverage after | All-172 rows requiring | Blocked rows requiring | Onboarding weight |")
    L.append("|---|---|---|---|---|---|---|---|")
    for c in out["capabilityImpact"]:
        L.append(f"| {c['capability']} | {c['targetsRequiring']} | {c['targetsRequiringOnlyThis']} | +{c['incrementalCoverage']} | "
                 f"{c['capabilitySetCoverageAfter'] if c['capabilitySetCoverageAfter'] is not None else '–'} | {c['rowsRequiringAcross172']} | "
                 f"{c['blockedRowsRequiring']} | {c['onboarding']['weight']} |")
    L.append("")
    L.append("## 5. Node impact (recommended schedule)")
    L.append("")
    L.append("| Node | Kind | Step | Tier | Prereq | New at step | Cum. before→after | Later targets using it |")
    L.append("|---|---|---|---|---|---|---|---|")
    for n in out["nodeImpact"]:
        pre = n["prerequisite"]["capability"] if n["prerequisite"] else ""
        L.append(f"| {n['node']} | {n['kind']} | {n['step']} | {n['tier']} | {pre} | {n['newlyDiscoverableAtStep']} | "
                 f"{n['cumulativeDiscoverableBefore']}→{n['cumulativeDiscoverableAfter']} | {n['laterTargetsUsingNode']} |")
    L.append("")
    L.append("## 6. Simulation matrix")
    L.append("")
    L.append("| Comparison | Profile | Policy | Gate | Price | Stock | Reward | Skill | Explorer | Hints | Outcome | Discovered | Bakes to 1/10/20/50/all | Grind | Max grind streak | Hints used | Restocks |")
    L.append("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|")
    for s in out["simulations"]:
        b = s["bakesToDiscovery"]
        bt = "/".join(str(b.get(k, "–")) for k in ("1", "10", "20", "50", "all"))
        L.append(f"| {s['comparison']} | {s['profile']} | {s['mechanicPolicy']} | {s['curve']} | {s['price']} | {s['stock']} | "
                 f"{s['reward']} | {s['skill']} | {s['explorer']} | {s['hints']} | {s['outcome']} | {s['discovered']}/{s['targets']} | {bt} | "
                 f"{s['grindBakes']} | {s['maxGrindStreak']} | {s['hintsUsed']} | {s['restocks']} |")
    L.append("")
    L.append("## 7. Walkthrough: first 50 discoveries (recommended, STANDARD skill)")
    L.append("")
    L.append("| # | Bake | Target | ⭐ | Pitz after |")
    L.append("|---|---|---|---|---|")
    for e in out["walkthrough"]["first50"]:
        L.append(f"| {e['n']} | {e['turn']} | {e['targetId']} ({md_escape(e['nameJa'])}) | {e['stars']} | {e['pitzAfter']} |")
    L.append("")
    L.append("## 8. Row classification (all 172)")
    L.append("")
    L.append("| Evidence id | Phase-1 status | Phase-2 class | Step | Tier | Blockers | Ledger |")
    L.append("|---|---|---|---|---|---|---|")
    for e in out["rowClassification"]:
        L.append(f"| {e['evidenceId']} | {e['phase1Status']} | {e['phase2Class']} | {e['reachableAtStep'] if e['reachableAtStep'] is not None else ''} | "
                 f"{e['tier'] or ''} | {', '.join(e['blockerTypes'])} | {e['ledgerClass'] or ''} |")
    L.append("")
    return "\n".join(L)


def render_ledger_md(out):
    L = ["# Progression 2.0 Phase 2 — Decision ledger (generated)", "",
         "Generated by `tools/progression2_phase2_progression.py`. Classes: **A** blocks the progression design, "
         "**B** blocks the discovery identity of the listed rows (they stay out of the reachable pool), "
         "**C** can wait until implementation, **D** content polish. Nothing here is decided by this PR; the "
         "recommendation column is a proposal for the owner.", "",
         "## 1. Design-level decisions", "",
         "| Id | Class | Topic | Question | Modelled as | Recommendation |", "|---|---|---|---|---|---|"]
    for d in out["designDecisions"]:
        L.append(f"| {d['id']} | {d['class']} | {md_escape(d['topic'])} | {md_escape(d['question'])} | {md_escape(d['modelledAs'])} | {md_escape(d['recommendation'])} |")
    L += ["", "## 2. Row-level blockers (85 Phase-1 BLOCKED rows)", "",
          "| Evidence id | Phase-2 class | Ledger class | Blocker types | Unresolved tokens | Covered by shipped target (SHIPPED_KEEP) | Capabilities once unblocked |",
          "|---|---|---|---|---|---|---|"]
    for e in out["rowClassification"]:
        if e["phase2Class"] == "EVIDENCE_READY_TARGET":
            continue
        L.append(f"| {e['evidenceId']} | {e['phase2Class']} | {e['ledgerClass']} | {', '.join(e['blockerTypes'])} | "
                 f"{md_escape(', '.join(t for t in e['unresolvedTokens'] if t))} | {e['coveredByShippedTargetUnderSHIPPED_KEEP'] or ''} | "
                 f"{', '.join(e['wouldNeedCapabilitiesOnceUnblocked'])} |")
    cnt = Counter()
    for e in out["rowClassification"]:
        for b in e["blockerTypes"]:
            cnt[b] += 1
    L += ["", "## 3. Blocker-type totals", "", "| Blocker type | Rows | Ledger class |", "|---|---|---|"]
    for k, v in sorted(cnt.items()):
        L.append(f"| {k} | {v} | {BLOCKER_CLASS[k]} |")
    rv = Counter()
    for e in out["rowClassification"]:
        if e["phase2Class"] == "EVIDENCE_READY_TARGET":
            for c in e["reviewLedgerClasses"]:
                rv[c] += 1
    L += ["", "## 4. Review items on evidence-ready targets (non-blocking)", "",
          "| Ledger class | Ready rows carrying it |", "|---|---|"]
    for k, v in sorted(rv.items()):
        L.append(f"| {k} | {v} |")
    L.append("")
    return "\n".join(L)


# ---------------------------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------------------------
def validate(out):
    errors = []
    matrix = load(MATRIX_PATH)
    ids = [r["evidenceId"] for r in matrix["rows"]]
    if len(ids) != EXPECTED_ROWS or len(set(ids)) != EXPECTED_ROWS:
        errors.append(f"matrix rows {len(ids)} / unique {len(set(ids))} != {EXPECTED_ROWS}")
    cls_ids = [e["evidenceId"] for e in out["rowClassification"]]
    if cls_ids != ids:
        errors.append("rowClassification does not cover the 172 matrix rows exactly once in matrix order")
    by_row = {r["evidenceId"]: r for r in matrix["rows"]}
    ready_ids = {r["evidenceId"] for r in matrix["rows"] if r["productDecisionStatus"] in READY_STATUSES}
    for pid, targets in out["targets"].items():
        tids = [t["targetId"] for t in targets]
        if len(tids) != len(set(tids)):
            errors.append(f"{pid}: duplicate target ids")
        row_tids = {t for t in tids if not t.startswith("shipped:")}
        if row_tids != ready_ids:
            errors.append(f"{pid}: 172-row targets != evidence-ready rows (extra {sorted(row_tids - ready_ids)}, missing {sorted(ready_ids - row_tids)})")
        for t in targets:
            if any(not isinstance(x, str) or not x for x in t["items"]):
                errors.append(f"{pid}: {t['targetId']} has an empty/None item")
            if t["source"] == "pizzadb-172":
                r = by_row[t["targetId"]]
                if r["ingredients"]["unresolvedTokens"] or not r["ingredients"]["complete"]:
                    errors.append(f"{pid}: incomplete/unresolved row {t['targetId']} became a target")
                if r["blockers"]:
                    errors.append(f"{pid}: blocked row {t['targetId']} became a target")
                base_items = {x for x in t["items"] if node_kind(x) == "ingredient"}
                if base_items != set(r["ingredients"]["identityIngredientSet"]):
                    errors.append(f"{pid}: {t['targetId']} ingredient items differ from the Phase-1 identity set")
                if set(t["capabilities"]) != set(r["requiredCapabilities"]):
                    errors.append(f"{pid}: {t['targetId']} capabilities differ from Phase-1 requiredCapabilities")
                expect = row_target(r, set(matrix["requiredStrengths"]))
                if t["items"] != expect["items"] or t["identityDimensions"] != expect["identityDimensions"]:
                    errors.append(f"{pid}: {t['targetId']} items/identity dimensions differ from a fresh derivation")
            for late in t["identityDimensions"]["late"]:
                if not set(late[1]) <= set(t["items"]):
                    errors.append(f"{pid}: {t['targetId']} late-addition ingredient not in its item set")
        for f in FUGAZZA_PAIR:
            if f in tids:
                errors.append(f"{pid}: {f} (discovery-rule blocker) became a target")
        prof = out["decisionProfiles"][pid]
        if prof["runtimeSignatureCollisions"]:
            errors.append(f"{pid}: runtime signature collisions {prof['runtimeSignatureCollisions']}")
        for mp, sch in out["unlockSchedules"][pid].items():
            unlocked = set()
            seen_nodes = []
            for s in sch["steps"]:
                if s["step"] > 0 and not s["newlyDiscoverable"]:
                    errors.append(f"{pid}/{mp}: step {s['step']} unlocks nothing (dead step)")
                for nd in s["nodes"]:
                    pre = node_prereq(nd["id"])
                    if pre and pre not in unlocked and pre not in {x["id"] for x in s["nodes"]}:
                        errors.append(f"{pid}/{mp}: {nd['id']} unlocked before its prerequisite {pre}")
                    seen_nodes.append(nd["id"])
                unlocked |= {x["id"] for x in s["nodes"]}
            if len(seen_nodes) != len(set(seen_nodes)):
                errors.append(f"{pid}/{mp}: a node is unlocked twice")
            if sch["steps"][-1]["cumulativeDiscoverable"] != len(targets):
                errors.append(f"{pid}/{mp}: not every evidence-ready target is reachable")
            used = set()
            for t in targets:
                used |= requirements(t)
            dead = sorted(set(seen_nodes) - used - set(STARTER_ITEMS))
            if dead:
                errors.append(f"{pid}/{mp}: dead unlock nodes {dead}")
            flat = [tid for s in sch["steps"] for tid in s["newlyDiscoverable"]]
            if sorted(flat) != sorted(tids):
                errors.append(f"{pid}/{mp}: newlyDiscoverable lists do not partition the targets")
    # decision-profile findings the report relies on
    strict = out["decisionProfiles"]["EVIDENCE_STRICT"]
    if strict["discoverableAtStart"]:
        errors.append("EVIDENCE_STRICT unexpectedly has a starter-only discovery; report section on A-01 is stale")
    for s in out["simulations"]:
        if s["comparison"] == "decisionProfile" and s["outcome"] != "START_DEADLOCK":
            errors.append(f"EVIDENCE_STRICT simulation {s['skill']} outcome {s['outcome']} != START_DEADLOCK")
        if s["comparison"] == "gateCurve" and s["curve"] == "G0_LEGACY_LADDER_10" and not s["deadlock"]:
            errors.append(f"negative control G0 {s['skill']} did not deadlock")
        if s["comparison"] == "reward" and s["reward"] == "LEGACY" and s["skill"] == "WORST" and s["outcome"] != "PITZ_DEADLOCK_ZERO_REWARD":
            errors.append("LEGACY reward table no longer deadlocks the WORST player; A-05 is stale")
    rob = [s for s in out["simulations"] if s["comparison"] == "recommendedRobustness"]
    if len(rob) != len(SKILLS) * len(EXPLORERS):
        errors.append("recommendedRobustness does not cover every skill x explorer")
    for s in rob:
        if s["outcome"] != "COMPLETE":
            errors.append(f"recommended economy fails for {s['skill']}/{s['explorer']}: {s['outcome']}")
    errors.extend(validate_economy_serialization(out))
    errors.extend(validate_recommendation_consistency(out))
    for k, v in out["noDeadlockProof"].items():
        if not v["holds"]:
            errors.append(f"noDeadlockProof.{k} does not hold")
    for key in ("first10", "first20", "first50"):
        n = int(key[5:])
        if len(out["walkthrough"][key]) != n:
            errors.append(f"walkthrough {key} has {len(out['walkthrough'][key])} entries")
    cls_count = Counter(e["phase2Class"] for e in out["rowClassification"])
    if cls_count["EVIDENCE_READY_TARGET"] != len(ready_ids):
        errors.append("EVIDENCE_READY_TARGET count mismatch")
    if sum(cls_count.values()) != EXPECTED_ROWS:
        errors.append("classification total != 172")
    return errors


SIM_COMPARE_FIELDS = ("outcome", "discovered", "turns", "bakesToDiscovery", "grindBakes", "maxGrindStreak", "hintsUsed",
                      "restocks", "pitzSpentPurchase", "pitzSpentRestock", "finalStars", "finalPitz", "bakeRewardPitz")


def validate_economy_serialization(out):
    """PR #191 review (P2): the JSON must carry every economy parameter the simulator used, so a
    Phase-3 consumer can rebuild each policy. Checks the serialization against the simulator input,
    pins the discovery bonus explicitly, then re-runs every recorded simulation from the JSON alone."""
    errors = []
    if out.get("rewardTables") != serialize_reward_tables(REWARD_TABLES):
        errors.append("rewardTables serialization differs from the simulator's REWARD_TABLES input")
    for tid, t in out.get("rewardTables", {}).items():
        if not isinstance(t.get("discoveryBonus"), int):
            errors.append(f"rewardTables.{tid}.discoveryBonus missing or not an integer")
    expected_bonus = {"FLOOR_DISCOVERY_BONUS": 50, "FLOOR": 0, "LEGACY": 0}
    for tid, bonus in expected_bonus.items():
        got = out.get("rewardTables", {}).get(tid, {}).get("discoveryBonus")
        if got != bonus:
            errors.append(f"regression: rewardTables.{tid}.discoveryBonus = {got!r}, expected {bonus}")
    for key, value in (("gateCurves", GATE_CURVES), ("priceSchedules", PRICE_SCHEDULES), ("stockPolicies", STOCK_POLICIES),
                       ("skills", SKILLS), ("explorers", EXPLORERS), ("hintPolicies", HINT_POLICIES)):
        if json.loads(json.dumps(out.get(key))) != json.loads(json.dumps(value)):
            errors.append(f"{key} serialization differs from the simulator input")
    try:
        tables = tables_from_json(out)
        runs = [(s, None) for s in out["simulations"]]
        wt = out["walkthrough"]["config"]
        for s, _ in runs + [(dict(wt, comparison="walkthrough"), None)]:
            res = simulate(out["targets"][s["profile"]], out["unlockSchedules"][s["profile"]][s["mechanicPolicy"]],
                           s["curve"], s["price"], s["stock"], s["reward"], s["skill"], s["explorer"], s["hints"],
                           log_limit=50 if s["comparison"] == "walkthrough" else 0, tables=tables)
            if s["comparison"] == "walkthrough":
                disc = [e for e in res["events"] if e["event"] == "discover"]
                rebuilt = [{"n": e["n"], "turn": e["turn"], "targetId": e["target"], "nameJa": e["nameJa"],
                            "stars": e["stars"], "pitzAfter": e["pitzAfter"]} for e in disc[:50]]
                if rebuilt != out["walkthrough"]["first50"]:
                    errors.append("walkthrough is not reproducible from the serialized economy parameters")
                if res["ownedSnapshots"] != out["walkthrough"]["ownedAtDiscovery"]:
                    errors.append("walkthrough.ownedAtDiscovery is not reproducible from the serialized economy parameters")
                matrix = load(MATRIX_PATH)
                cat = {i["id"]: i["category"] for i in load(INGREDIENT_CATALOG_PATH)["ingredients"]}
                if ui_sizing(res["ownedSnapshots"], matrix, parse_src_ingredient_categories(), cat) != out["uiSizing"]:
                    errors.append("uiSizing does not match the walkthrough player's actual ownership at each milestone")
                continue
            diff = [f for f in SIM_COMPARE_FIELDS if res[f] != s[f]]
            if diff:
                errors.append(f"simulation {s['comparison']}/{s['curve']}/{s['price']}/{s['stock']}/{s['reward']}/"
                              f"{s['skill']}/{s['explorer']}/{s['hints']} not reproducible from JSON: {diff}")
    except (KeyError, TypeError, ValueError) as exc:
        errors.append(f"economy policies cannot be reconstructed from the serialized JSON: {exc!r}")
    return errors


def validate_recommendation_consistency(out):
    """PR #191 review (P2): the ledger's economy recommendations, the recommended economy, the
    simulations run on it, the generated MDs and the hand-written report must all name the same
    policy (in particular C-01 starter/refill stock)."""
    errors = []
    rec = out["recommended"]["economy"]
    if rec != RECOMMENDED_ECONOMY:
        errors.append("recommended.economy differs from RECOMMENDED_ECONOMY")
    by_id = {d["id"]: d for d in out["designDecisions"]}
    for did, key in ECONOMY_DECISION_IDS.items():
        d = by_id.get(did, {})
        if d.get("recommendedPolicyId") != rec.get(key):
            errors.append(f"{did} recommends {d.get('recommendedPolicyId')!r} but recommended.economy.{key} is {rec.get(key)!r}")
        if rec.get(key) not in (d.get("recommendation") or ""):
            errors.append(f"{did} recommendation text does not name {rec.get(key)!r}")
    stock_id = rec.get("stock")
    if stock_id not in out.get("stockPolicies", {}):
        errors.append(f"recommended stock {stock_id!r} is not a serialized stock policy")
    if out["walkthrough"]["config"].get("stock") != stock_id:
        errors.append("walkthrough stock policy differs from the recommended stock policy")
    for s in out["simulations"]:
        if s["comparison"] == "recommendedRobustness":
            for key, field in (("gate", "curve"), ("price", "price"), ("stock", "stock"), ("reward", "reward"), ("hints", "hints")):
                if s[field] != rec[key]:
                    errors.append(f"recommendedRobustness {s['skill']}/{s['explorer']} runs {field}={s[field]!r}, not {rec[key]!r}")
    ledger = render_ledger_md(out)
    c01 = next((l for l in ledger.splitlines() if l.startswith("| C-01 ")), "")
    if stock_id not in c01:
        errors.append("generated ledger C-01 row does not name the recommended stock policy")
    if f"`{stock_id}`" not in render_graph_md(out):
        errors.append("generated graph header does not name the recommended stock policy")
    combo = " + ".join(rec[k] for k in ("gate", "price", "stock", "reward", "hints"))
    if combo not in DESIGN_MD_PATH.read_text(encoding="utf-8"):
        errors.append(f"design report does not state the recommended combination '{combo}'")
    return errors


def dumps(out):
    return json.dumps(out, ensure_ascii=False, indent=2) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="validate committed outputs without writing")
    args = ap.parse_args()
    out = build()
    errors = validate(out)
    text = dumps(out)
    if dumps(build()) != text:
        errors.append("two in-process builds differ (non-deterministic)")
    graph = render_graph_md(out)
    ledger = render_ledger_md(out)
    outputs = ((OUT_JSON, text), (OUT_GRAPH_MD, graph), (OUT_LEDGER_MD, ledger))
    if args.check:
        for path, content in outputs:
            if not path.exists() or path.read_text(encoding="utf-8") != content:
                errors.append(f"{path.relative_to(ROOT)} differs from a fresh deterministic regeneration")
    else:
        for path, content in outputs:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
            print(f"Wrote {path.relative_to(ROOT)}")
    print(f"Rows analysed: {len(out['rowClassification'])}  classification: {out['rowClassificationSummary']}")
    for pid, p in out["decisionProfiles"].items():
        print(f"Profile {pid}: targets={p['targetCount']} ({p['targetsFrom172']}+{p['targetsFromShippedOverlay']}) "
              f"start={len(p['discoverableAtStart'])} reachable={p['finalReachable']} steps={p['scheduleSteps']} "
              f"collisions={len(p['runtimeSignatureCollisions'])}")
    for mp, intro in out["mechanicIntroductions"].items():
        print(f"  {mp}: " + " -> ".join(f"{m['capability']}@{m['discoverableBefore']}" for m in intro))
    for s in out["recommendedSimulationBySkill"]:
        print(f"  recommended {s['skill']:<9} {s['explorer']:<13} {s['outcome']:<10} bakes={s['bakesToDiscovery']} grind={s['grindBakes']} maxStreak={s['maxGrindStreak']} hints={s['hintsUsed']}")
    print("noDeadlockProof: " + ", ".join(f"{k}={v['holds']}" for k, v in out["noDeadlockProof"].items()))
    if errors:
        print(f"\nFAIL: {len(errors)} validation error(s)")
        for e in errors:
            print("  - " + e)
        return 1
    print("\nAll Phase-2 validations passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
