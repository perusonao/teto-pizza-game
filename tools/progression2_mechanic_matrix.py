#!/usr/bin/env python3
"""
Progression 2.0 Phase 1 -- 172-recipe Game-Design Candidate / Mechanic Matrix
(Issue #188). Docs/data-only tooling -- NOT part of src/**, NOT wired into CI,
NOT a production SSOT, NOT a price/threshold decision.

Converts the Phase-0 172-row evidence population
(docs/reports/data/TETO_PIZZADB_172_MASTER-EVIDENCE.json) into a per-row
game-design candidate matrix that answers, for every evidenced recipe:
  1. which canonical ingredients the game needs (deterministic only),
  2. which identity dimensions distinguish it from collisions/near-neighbours,
  3. whether the CURRENT cooking flow can represent it
     (DOUGH(round) -> SAUCE(one paint layer) -> CHEESE/TOPPING(scatter)
      -> BAKE(one oven judgment) -> optional CUT(round, 6 slices)),
  4. if not, which reusable mechanic capabilities it needs,
  5. which evidence/conflicts remain unresolved,
  6. whether it is ready to become a production catalog candidate.

Discipline (Issue #188 scope guards):
  * The 172-source evidence is READ-ONLY input. Nothing here edits it.
  * Ingredient names are resolved ONLY through
    tools/progression2_ingredient_canonicalizer.py's classify() -- the same
    tables Phase 0B.2-0B.18 used. ambiguous / needs_review tokens stay
    unresolved (preserved verbatim, never guess-filled).
  * Mechanic requirements come ONLY from the curated, cited evidence table
    below (ROW_MECHANIC_EVIDENCE) and the deterministic doughStyle table
    (DOUGH_STYLE_TABLE). Each entry records its evidence strength. Only
    source/catalog-grounded strengths count as REQUIRED; repo-inference
    entries are kept as CANDIDATE capabilities (a product decision), never
    silently promoted.
  * No ★ threshold, Pitz price, unlock order or production SSOT is decided.

Usage:
  python3 tools/progression2_mechanic_matrix.py          # regenerate + validate
  python3 tools/progression2_mechanic_matrix.py --check  # validate only; fails if
                                                         # committed outputs differ
                                                         # from a fresh regeneration
Writes:
  docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json
  docs/design/TETO_RECIPE_172_MECHANIC-MATRIX_ROWS.md   (generated per-row table)
"""
import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import progression2_ingredient_canonicalizer as canon  # noqa: E402

MASTER_PATH = ROOT / "docs/reports/data/TETO_PIZZADB_172_MASTER-EVIDENCE.json"
LEDGER_PATH = ROOT / "docs/reports/data/TETO_PROGRESS2_PHASE0B4_recipe-row-evidence.json"
DEADLOCK_PATH = ROOT / "docs/reports/data/TETO_PROGRESS2_PHASE0B18_full172-deadlock-analysis.json"
CATALOG_PATH = ROOT / "data/recipes/pizza_master_catalog.json"
INGREDIENT_CATALOG_PATH = ROOT / "data/recipes/ingredient_master_catalog.json"
SRC_RECIPES_PATH = ROOT / "src/data/recipes.ts"
SRC_INGREDIENTS_PATH = ROOT / "src/data/ingredients.ts"
OUT_JSON = ROOT / "docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json"
OUT_ROWS_MD = ROOT / "docs/design/TETO_RECIPE_172_MECHANIC-MATRIX_ROWS.md"

EXPECTED_ROWS = 172
# Regression case for an unspecified sauce base (甘辛だれ family, no listed tare): see validate().
UNSPECIFIED_BASE_REGRESSION_ROW = "teriyaki-chicken-pizza-pizzadb-p14"
# Regression case for per-row same-set review (both share {mozzarella, tomato-sauce}; only NY
# declares the 'ny-style' correspondence): see validate().
SAME_SET_REGRESSION_ROWS = ("trenton-tomato-pie-pizzadb", "ny-style-pizzadb")
# Regression case for excluded placeholders (お好みの具材): see validate().
PLACEHOLDER_REGRESSION_ROW = "colorado-mountain-pie-pizzadb-p3"
PHASE0_MERGE_SHA = "5676ae9d2ade0bd3675523be351152a24508c9a5"

# ---------------------------------------------------------------------------
# 1. Capability taxonomy
# ---------------------------------------------------------------------------
# The CURRENT flow (verified against src/data/cookingProfiles.ts,
# src/data/recipeSauceProfiles.ts, src/state/gameReducer.ts at the audited SHA):
BASELINE_FLOW = {
    "steps": ["DOUGH", "SAUCE", "CHEESE", "TOPPING", "BAKE", "CUT(optional)"],
    "facts": [
        "DOUGH: one round, reversible stretch gesture (8-point doughShape, ideal-circle scoring); no thickness/material/shape parameter.",
        "SAUCE: exactly ONE sauce ingredient per recipe (RecipeSauceProfile.ingredientId, PAINT/PAINT_TEMPORARY); skipped when the recipe has no sauce-category ingredient.",
        "CHEESE/TOPPING: free scatter placement anywhere on the dough; fixed order SAUCE -> CHEESE -> TOPPING (deriveCoreSteps).",
        "BAKE: one oven bake with a single bakeTarget window; no pan/tray, no mid-bake interruption, no alternative cooking method.",
        "POST_BAKE: phase exists; only CUT is wired (round, requestedSliceCount 6, opt-in allowlist). FINISH/FOLD/SEAL/EDGE_FILL are reserved MakingStep values with zero gameplay.",
        "New ingredient ids with an existing placementType (spread/scatter) are CONTENT work, not a mechanic -- they do not affect representability.",
    ],
}

# Proposed minimum reusable capability set. `structural`: the current flow
# would produce a different dish FORM without it (-> NOT_REPRESENTABLE);
# non-structural: the dish is playable but loses an evidenced identity
# dimension (-> PARTIAL). costClass is a relative estimate grounded in the
# existing architecture (reserved MakingStep values, CookingProfile seam),
# not a schedule.
CAPABILITIES = {
    "DOUGH_VARIANT": {
        "labelJa": "生地バリエーション（配合・厚み・食感・発酵）",
        "axes": ["dough composition/type", "dough thickness"],
        "structural": False,
        "costClass": "S",
        "reuses": "existing DOUGH step gesture; adds a per-recipe dough-base parameter (visual + bakeTarget), no new gesture",
        "dependsOn": [],
        "mergeRationale": "Composition (cauliflower/keto/multigrain/cookie), thickness (thick/fluffy/cracker) and flatbread types never change the player's gesture in the evidence -- they are one data-level dough selection, so they are merged rather than split into four mechanics.",
    },
    "MULTI_SPREAD_LAYER": {
        "labelJa": "複数スプレッド層（第2ソース・ドリズル・ペースト）",
        "axes": ["sauce/spread placement"],
        "structural": False,
        "costClass": "M",
        "reuses": "existing SAUCE paint controller; generalizes RecipeSauceProfile from one ingredient to an ordered list of spread layers",
        "dependsOn": [],
        "mergeRationale": "Second sauces, oil/honey/mayo drizzles and spread pastes (lahmacun) are all 'another spread-type layer'; the evidence never distinguishes their gesture, so one capability.",
    },
    "STEP_ORDER": {
        "labelJa": "工程順序の入れ替え（チーズ先・ソース後）",
        "axes": ["topping placement/zones/order"],
        "structural": False,
        "costClass": "S",
        "reuses": "CookingProfile.steps ordering (today fixed by deriveCoreSteps)",
        "dependsOn": [],
        "mergeRationale": "Reverse layering (cheese before sauce) is only an order change of existing steps.",
    },
    "ZONED_PLACEMENT": {
        "labelJa": "エリア指定配置（4分割・ハーフ・中央）",
        "axes": ["topping placement/zones/order"],
        "structural": False,
        "costClass": "M",
        "reuses": "SAUCE/TOPPING modifier (regions) per docs/design/TETO_RECIPE-COOKING-STEPS_1.0.md section 4",
        "dependsOn": [],
        "mergeRationale": "Quadrant, half and centre placement are the same region-restricted placement modifier.",
    },
    "PREP_STEP": {
        "labelJa": "下ごしらえ（炒める・水切り）",
        "axes": ["pre-cook/prep"],
        "structural": False,
        "costClass": "M",
        "reuses": "new PREPARE step before TOPPING; output is an ordinary scatter topping",
        "dependsOn": [],
        "mergeRationale": "Stir-fry and drain are both 'transform an ingredient before placing it'.",
    },
    "LATE_ADDITION": {
        "labelJa": "後乗せ（焼成途中・焼成後の仕上げ）",
        "axes": ["post-bake topping/drizzle/finish", "bake profile (timing)"],
        "structural": False,
        "costClass": "M",
        "reuses": "reserved FINISH MakingStep in the existing POST_BAKE phase; mode mid_bake adds a short re-bake after FINISH",
        "dependsOn": [],
        "mergeRationale": "Mid-bake (natto/tarako/fries) and post-bake (wasabi/graham/finishing herbs) additions are both 'place an ingredient after the main bake started'; one FINISH step with a mode parameter, not two mechanics. Keeps the eel row's unresolved timing a mode question, not a capability question.",
    },
    "PAN_BAKE": {
        "labelJa": "型・鉄板焼き（浅型・深型・天板）",
        "axes": ["pan/deep", "bake profile"],
        "structural": True,
        "costClass": "M",
        "reuses": "BAKE step with a pan/tray container and pan-specific bakeTarget/visual (crisp bottom, walls)",
        "dependsOn": [],
        "mergeRationale": "Kept separate from DOUGH_SHAPE_TARGET because the evidence contains round pan bakes (deep dish, Montreal, bar pizza) and a non-pan shaped form (pide).",
    },
    "DOUGH_SHAPE_TARGET": {
        "labelJa": "生地の目標形状（四角・舟形）",
        "axes": ["dough thickness/shape/form", "cut/serve/eating-form behavior"],
        "structural": True,
        "costClass": "L",
        "reuses": "doughShape.ts shape-validation seam; requires CUT geometry to stop assuming an ideal circle",
        "dependsOn": [],
        "mergeRationale": "Square and boat are the same 'non-round target silhouette' problem (shape scoring + reference + cut geometry).",
    },
    "ENCLOSE": {
        "labelJa": "包む・重ねる（折り込み・上生地・積層）",
        "axes": ["fold/cover/layer"],
        "structural": True,
        "costClass": "L",
        "reuses": "reserved FOLD/SEAL MakingStep values; hides the filling and normally disables CUT",
        "dependsOn": [],
        "mergeRationale": "Fold-over (calzone), top-sheet cover (stuffed/rellena), stacked layers (scacciata) and a cover layer on top (a caballo) all end with filling covered by a dough/bread layer; one capability with a mode.",
    },
    "LAMINATE": {
        "labelJa": "多層折り込み生地（ラミネート）",
        "axes": ["fold/cover/layer", "dough composition/type"],
        "structural": True,
        "costClass": "L",
        "reuses": "new DOUGH-preparation gesture (repeated fold of the dough itself)",
        "dependsOn": [],
        "mergeRationale": "Kept separate from ENCLOSE: lamination folds the dough into many layers before any topping, it does not cover a filling (Phase-0 master report section 4 already distinguishes it).",
    },
    "FRY_COOK": {
        "labelJa": "揚げ調理（焼成の代替）",
        "axes": ["fry vs bake"],
        "structural": True,
        "costClass": "L",
        "reuses": "replaces BAKE with a fry judgment (new cooking-method profile)",
        "dependsOn": [],
        "mergeRationale": "The only evidenced non-bake cooking method.",
    },
    "SERVE_FORM": {
        "labelJa": "食べ方・提供形態（巻く・折って食べる）",
        "axes": ["cut/serve/eating-form behavior"],
        "structural": False,
        "costClass": "M",
        "reuses": "POST_BAKE presentation step (alternative to CUT)",
        "dependsOn": [],
        "mergeRationale": "Evidence is context-only or repo inference (lahmacun roll-to-eat flagged unconfirmed in Phase 0, NY fold-to-eat inferred) -- candidate only, never REQUIRED in this matrix.",
    },
}
CAPABILITY_ORDER = list(CAPABILITIES)
COST_RANK = {"S": 0, "M": 1, "L": 2}

# Evidence strengths. REQUIRED_STRENGTHS count toward representability.
STRENGTHS = {
    "source_dough_field": "PIZZA DB row doughStyle field (master evidence).",
    "source_ingredient_field": "PIZZA DB row ingredient / sauceFamily fields (master evidence).",
    "source_profile_text": "PIZZA DB profile text as relayed and recorded in the Phase-0 ledger (mechanicIdentityNote or a corroboration note).",
    "catalog_design_tag": "Existing repo catalog design decision (data/recipes/pizza_master_catalog.json mechanics/finishingIngredients) for the corresponding catalog entry, applied only where the finishing ingredient is present in this row.",
    "phase0_sample_mechanic_tag": "Phase 0B comparison-table sample mechanicNote naming an existing catalog mechanic id for this exact row.",
    "source_profile_text_context_only": "PIZZA DB profile text describing an element that is NOT in the row's published ingredient list (kept as context, never promoted).",
    "repo_inference": "A Phase-0 design interpretation (e.g. 'looks like', 'plausible', open question) -- not source-stated.",
}
REQUIRED_STRENGTHS = {
    "source_dough_field", "source_ingredient_field", "source_profile_text",
    "catalog_design_tag", "phase0_sample_mechanic_tag",
}

# ---------------------------------------------------------------------------
# 2. doughStyle -> dough/form classification (every distinct string in the
#    master evidence must appear here; the validator enforces it).
# ---------------------------------------------------------------------------
STANDARD = {"class": "standard"}
DOUGH_STYLE_TABLE = {
    None: {"class": "unknown"},
    "薄めの生地": {"class": "standard", "variant": "thin"},
    "薄め": {"class": "standard", "variant": "thin"},
    "薄焼きピッツァ生地": {"class": "standard", "variant": "thin"},
    "薄焼きピザ生地": {"class": "standard", "variant": "thin"},
    "薄めから中厚": {"class": "standard", "variant": "thin-to-medium"},
    "薄〜中厚": {"class": "standard", "variant": "thin-to-medium"},
    "ピッツァ生地": {"class": "standard", "variant": "generic"},
    "ナポリピッツァ生地": {"class": "standard", "variant": "neapolitan"},
    "ナポリピッツァ": {"class": "standard", "variant": "neapolitan"},
    "薄めのナポリ風生地": {"class": "standard", "variant": "neapolitan"},
    "ナポリピッツァ生地（薄めで縁が厚い）": {"class": "standard", "variant": "neapolitan"},
    "ローマ風ピッツァ生地": {"class": "variant", "variant": "roman"},
    "薄くパリッとしたローマ風": {"class": "variant", "variant": "roman-thin-crisp"},
    "厚みのあるふんわりした生地": {"class": "variant", "variant": "thick-fluffy"},
    "厚めの生地": {"class": "variant", "variant": "thick"},
    "イーストなし極薄クラッカー": {"class": "variant", "variant": "yeastless-cracker-thin"},
    "モルトを加えた薄くパリッとした生地": {"class": "variant", "variant": "malt-thin-crisp"},
    "はちみつを練り込んだ厚めの生地": {"class": "variant", "variant": "honey-thick"},
    "カリフラワーを主原料にした低糖質生地": {"class": "variant", "variant": "material-cauliflower"},
    "モッツァレラ・アーモンドフラワーの低糖質生地": {"class": "variant", "variant": "material-keto-mozzarella-almond"},
    "小麦・米・大豆をブレンドした長時間発酵生地": {"class": "variant", "variant": "material-multigrain-long-ferment"},
    "クッキー生地": {"class": "variant", "variant": "material-cookie"},
    "薄い無発酵の平焼き生地": {"class": "variant", "variant": "flatbread-unleavened"},
    "厚みのあるオリーブオイル風味のフラットブレッド": {"class": "variant", "variant": "flatbread-focaccia-thick"},
    "ピタパンに似た柔らかいフラットブレッド": {"class": "variant", "variant": "flatbread-pita-soft"},
    "極薄のクリスピーなフラットブレッド": {"class": "variant", "variant": "flatbread-ultra-thin-crisp"},
    "四角い天板焼きの中厚生地": {"class": "variant", "variant": "medium-thick", "shape": "square", "pan": "sheet-pan"},
    "四角い鉄板で焼く厚めの生地（底はカリカリ）": {"class": "variant", "variant": "thick-crisp-bottom", "shape": "square", "pan": "steel-pan"},
    "長時間発酵の四角い天板生地": {"class": "variant", "variant": "long-ferment", "shape": "square", "pan": "tray"},
    "薄くパリッとした鉄板焼き生地": {"class": "variant", "variant": "thin-crisp", "pan": "shallow-pan"},
    "厚め鍋焼き": {"class": "variant", "variant": "thick", "pan": "deep-pan"},
    "舟形に成形したふんわり生地": {"class": "variant", "variant": "fluffy", "shape": "boat"},
    "上下2枚の生地で具材を包み込む厚い生地": {"class": "variant", "variant": "thick", "enclose": "two-sheet"},
    "厚みのあるふんわりした生地（2枚の生地でチーズ・ハムを挟む）": {"class": "variant", "variant": "thick-fluffy", "enclose": "two-sheet"},
    "重ねて焼く層状": {"class": "form", "enclose": "layered-stack"},
    "層状に折り込んだ多層生地（デザート系）": {"class": "form", "laminate": "multi-layer"},
    "揚げピッツァ生地": {"class": "form", "cook": "fry"},
}

# ---------------------------------------------------------------------------
# 3. Curated, cited mechanic evidence per row. Every entry names the exact
#    Phase-0 field it came from. Nothing here is new external evidence.
# ---------------------------------------------------------------------------
M = "recipeRows[].mechanicIdentityNote"
CORR = "TETO_PROGRESS2_PHASE0B4_recipe-row-evidence.json corroborations[]"
CAT = "data/recipes/pizza_master_catalog.json"
SAMPLE = "TETO_PROGRESS2_PHASE0B_pizzadb-external-samples.json mechanicNote"
PAGE8 = [
    "pizza-asparagi-limone-pizzadb-p8", "pizza-carciofi-salad-pizzadb-p8",
    "pizza-finocchi-salad-pizzadb-p8", "pizza-cavolo-carote-pizzadb-p8",
    "pizza-zucchine-menta-pizzadb-p8", "pizza-cicoria-limone-pizzadb-p8",
    "pizza-puntarelle-pizzadb-p8", "pizza-radicchio-noci-pizzadb-p8",
]


def ev(cap, mode, strength, source, detail, ingredients=None):
    e = {"capability": cap, "mode": mode, "strength": strength, "source": source, "detail": detail}
    if ingredients:
        e["ingredients"] = ingredients
    return e


ROW_MECHANIC_EVIDENCE = {
    "calzone-pizzadb": [
        ev("ENCLOSE", "fold", "phase0_sample_mechanic_tag", SAMPLE, "foldDough (matches catalog 'calzone' mechanic tag)"),
        ev("ENCLOSE", "fold", "source_profile_text", CORR, "Phase 0B.8 re-confirmation adds folded/shape mechanic identity confirmation"),
    ],
    "quattro-stagioni-pizzadb": [
        ev("ZONED_PLACEMENT", "quadrant", "phase0_sample_mechanic_tag", SAMPLE, "quadrantPlacement (matches catalog 'quattro-stagioni')"),
    ],
    "chicago-deep-dish-pizzadb": [
        ev("STEP_ORDER", "cheese-before-sauce", "phase0_sample_mechanic_tag", SAMPLE, "layeredReverseOrder"),
        ev("STEP_ORDER", "cheese-before-sauce", "source_profile_text", CORR, "Phase 0B.5: 'cheese placed before sauce (reverse/layered order)'"),
        ev("PAN_BAKE", "deep-pan", "source_profile_text", CORR, "Phase 0B.5: 'deep pan/shape'"),
        ev("PAN_BAKE", "deep-pan", "catalog_design_tag", CAT, "catalog 'chicago-deep-dish' specialShapePan (round deep pan, not a square silhouette)"),
    ],
    "trenton-tomato-pie-pizzadb": [
        ev("STEP_ORDER", "cheese-before-sauce", "phase0_sample_mechanic_tag", SAMPLE, "layeredReverseOrder (reuses existing mechanic id)"),
    ],
    "taco-pizza-pizzadb": [
        ev("LATE_ADDITION", "post_bake", "repo_inference", SAMPLE, "open mechanic-schema question: raw/cold post-bake treatment for lettuce/tortilla-chips (not source-stated)", ["lettuce", "tortilla-chips"]),
    ],
    "pizza-a-caballo": [
        ev("ENCLOSE", "cover-layer", "source_profile_text", M, "profile text: a Faina (chickpea flatbread) layer is placed on top -- the layer itself is an evidence gap (absent from the ingredient list)"),
    ],
    "greek-style-pizzadb": [
        ev("PAN_BAKE", "pan", "source_profile_text", CORR, "Phase 0B.8: 'オリーブオイルを多く使う、ふんわりとした鍋焼き生地'"),
        ev("PAN_BAKE", "pan", "catalog_design_tag", CAT, "catalog 'greek-style' specialShapePan"),
        ev("DOUGH_VARIANT", "fluffy-olive-oil", "source_profile_text", CORR, "Phase 0B.8 dough detail"),
    ],
    "siciliana-pizzadb": [
        ev("DOUGH_SHAPE_TARGET", "square", "source_profile_text", CORR, "Phase 0B.8: '厚みのある四角い生地（スポンジのような食感）'"),
        ev("DOUGH_VARIANT", "thick-spongy", "source_profile_text", CORR, "Phase 0B.8 dough detail"),
        ev("PAN_BAKE", "pan", "catalog_design_tag", CAT, "catalog 'siciliana' specialShapePan (label 特殊形状（角型・厚底パン）)"),
    ],
    "ny-style-pizzadb": [
        ev("DOUGH_VARIANT", "thin-large-pliable", "source_profile_text", CORR, "Phase 0B.9: '薄くて大きく、よくしなる生地'"),
        ev("SERVE_FORM", "fold-to-eat", "repo_inference", SAMPLE, "'real-world distinguishing trait is crust style (thin, foldable)' -- not source-stated as an eating behavior"),
    ],
    "detroit-style-pizza-pizzadb-p5": [
        ev("LATE_ADDITION", "post_bake", "catalog_design_tag", CAT, "catalog 'detroit-style' finishingIngredients [tomato-sauce] (sauce stripe after bake); tomato-sauce present via this row's トマトソース sauceFamily", ["tomato-sauce"]),
    ],
    "bbq-chicken-pizzadb": [
        ev("LATE_ADDITION", "post_bake", "catalog_design_tag", CAT, "catalog 'bbq-chicken' finishingIngredients [cilantro]; cilantro present in this row", ["cilantro"]),
    ],
    "buffalo-chicken-pizzadb": [
        ev("LATE_ADDITION", "post_bake", "catalog_design_tag", CAT, "catalog 'buffalo-chicken' finishingIngredients [buffalo-sauce]; buffalo-sauce present in this row", ["buffalo-sauce"]),
    ],
    "teriyaki-chicken-pizza-pizzadb-p14": [
        ev("LATE_ADDITION", "post_bake", "catalog_design_tag", CAT, "catalog 'teriyaki-chicken' finishingIngredients [mayo, nori]; both present in this row", ["mayo", "nori"]),
    ],
    "nutella-dessert-pizza-pizzadb-p6": [
        ev("LATE_ADDITION", "post_bake", "catalog_design_tag", CAT, "catalog 'nutella-dessert' finishingIngredients [powdered-sugar]; present in this row", ["powdered-sugar"]),
    ],
    "black-truffle-pizza-pizzadb-p14": [
        ev("LATE_ADDITION", "post_bake", "catalog_design_tag", CAT, "catalog 'al-tartufo' finishingIngredients [truffle]; truffle present in this row", ["truffle"]),
    ],
    "eel-pizza-pizzadb-p1": [
        ev("LATE_ADDITION", "unresolved:mid_bake|post_bake", "source_profile_text", CORR, "profile: eel is added at finishing ('late/post-bake topping') -- timing mode not disambiguated", ["eel"]),
    ],
    "mentaiko-cream-pizza-pizzadb-p4": [
        ev("LATE_ADDITION", "mid_bake", "source_profile_text", CORR, "profile: tarako added in the final few minutes of the bake", ["cod-roe"]),
    ],
    "kimchi-pizza-pizzadb-p2": [
        ev("PREP_STEP", "drain/stir-fry", "source_profile_text", CORR, "profile: kimchi drained/lightly stir-fried before topping", ["kimchi"]),
    ],
    "smore-dessert-pizza-pizzadb-p4": [
        ev("LATE_ADDITION", "post_bake", "source_profile_text", CORR, "profile: crushed graham cracker added as a post-bake finish (marshmallow before baking = baseline)", ["graham-cracker"]),
    ],
    "natto-pizza": [
        ev("LATE_ADDITION", "mid_bake", "source_profile_text", M, "profile: natto added a few minutes before the bake finishes", ["natto"]),
    ],
    "wasabi-beef-pizza": [
        ev("LATE_ADDITION", "post_bake", "source_profile_text", M, "profile: wasabi added after the bake (焼き上がり後に添える)", ["wasabi"]),
    ],
    "yakiniku-pizza": [
        ev("PREP_STEP", "stir-fry", "source_profile_text", M, "profile: meat seasoned and stir-fried before topping", ["beef"]),
    ],
    "pizza-de-lomo-saltado": [
        ev("PREP_STEP", "stir-fry", "source_profile_text", M, "profile: beef and vegetables stir-fried first", ["beef", "onion", "fresh-tomato"]),
        ev("LATE_ADDITION", "mid_bake", "source_profile_text", M, "profile: fries added just before the bake finishes", ["french-fries"]),
    ],
    "lahmacun": [
        ev("MULTI_SPREAD_LAYER", "paste-spread", "source_profile_text", M, "profile: ground-meat paste spread thinly over the dough before baking (a spread-type topping layer on top of the tomato-sauce family base)"),
        ev("LATE_ADDITION", "post_bake", "source_profile_text_context_only", M, "profile: lemon squeezed after baking -- lemon is NOT in the published ingredient list, kept as context"),
        ev("SERVE_FORM", "roll-to-eat", "source_profile_text_context_only", M, "profile: eaten rolled with fresh vegetables -- Phase 0 flagged 'not confirmed as a distinct mechanic requirement'"),
    ],
    "capricciosa-pizzadb": [
        ev("ZONED_PLACEMENT", "center", "repo_inference", SAMPLE, "'egg placement matches existing eggCenter/centerPlacement gap' (repo interpretation)", ["egg"]),
    ],
    "bismarck-pizza-pizzadb-p7": [
        ev("ZONED_PLACEMENT", "center", "repo_inference", "data/recipes/gameplay_mechanic_master.json centerPlacement.notes", "Bismarck centre-egg flagged as a real-world implementation gap (repo interpretation)", ["egg"]),
    ],
    "hot-honey-pepperoni-pizzadb-p12": [
        ev("LATE_ADDITION", "post_bake", "repo_inference", "recipeRows[].namingAmbiguityNote", "'honey as a post-bake finishing drizzle -- a plausible ...' (repo interpretation; honey itself is counted as a spread layer from the ingredient field)", ["honey"]),
    ],
    "pizza-fritta-pizzadb-p9": [],  # covered by DOUGH_STYLE_TABLE (揚げピッツァ生地)
}
for _rid in PAGE8:
    ROW_MECHANIC_EVIDENCE[_rid] = [
        ev("LATE_ADDITION", "post_bake", "repo_inference", M,
           "page-8 no-sauce raw-topping family: 'looks like a genuinely distinct FINISHING mechanic (raw salad topping added post-bake)' -- design finding, not source-stated"),
    ]

# Explicit catalog tags that are deliberately NOT applied (recorded for audit).
CATALOG_TAGS_NOT_APPLIED = [
    {"rowId": "fugazzetta-pizzadb-p10", "catalogId": "fugazzeta", "tag": "stuffedDough",
     "reason": "The PIZZA DB fugazzetta row gives no enclosure evidence (plain thick-fluffy dough); the enclosed version is evidenced separately as fugazzeta-rellena. Applying the deferred catalog tag would silently resolve the fugazza/fugazzetta discovery blocker without evidence."},
    {"rowId": "diavola-pizza-pizzadb-p5", "catalogId": "diavola", "tag": "postBakeFinishing [chili-oil]",
     "reason": "Row lists 唐辛子 (ambiguous chili), not chili-oil; the finishing ingredient is not present, so the tag is not applied."},
    {"rowId": "frutti-di-mare-pizzadb-p11", "catalogId": "frutti-di-mare", "tag": "postBakeFinishing [parsley]",
     "reason": "Row does not list parsley."},
    {"rowId": "speck-e-brie-pizzadb-p4", "catalogId": "speck-e-brie", "tag": "postBakeFinishing [arugula]",
     "reason": "Row does not list arugula."},
]

# Rows whose inclusion as a 'pizza' is itself an open product question
# (recorded in the Phase-0 notes, not decided here).
SCOPE_QUESTIONS = {
    "focaccia-genovese-pizzadb-p10": "Plain focaccia bread with no cheese/topping beyond oil/salt/rosemary -- Phase 0 flagged whether it qualifies as a 'pizza' entry at all.",
    "feteer-meshaltet-pizzadb-p10": "Laminated pastry whose single ingredient list spans dessert (honey, condensed milk) and savory (ground meat) -- Phase 0 flagged the unusual composition; not split or resolved here.",
}
SOURCE_INCONSISTENCIES = {
    "manakish": "PIZZA DB header tags sauceFamily オイル while its own Q&A says ノンソース -- preserved as-is (header value used).",
}
NAME_SPECIFICITY_GAPS = {
    "nduja-pizza-pizzadb-p14": "Name implies nduja (spreadable salami; catalog has 'nduja' as a spread topping) but the source lists only generic ソーセージ -- kept generic.",
    "south-african-boerewors-pizzadb-p14": "Name implies boerewors sausage but the source lists only generic ソーセージ -- kept generic.",
}

# Naming clusters, exactly as enumerated in TETO_PIZZADB_172_MASTER-REPORT.md section 5.
NAMING_CLUSTERS = [
    {"id": "NC-1-napoletana", "label": "Napoletana family (3-way)", "catalogIds": ["napoletana"],
     "rowIds": ["chilean-napolitana-pizzadb", "argentine-napolitana-pizzadb-p1"]},
    {"id": "NC-2-bianca", "label": "Bianca family (3-way)", "catalogIds": ["pizza-bianca", "ricotta-bianca"],
     "rowIds": ["bianca-pizzadb-row"]},
    {"id": "NC-3-sicilian", "label": "Sicilian family (3-way)", "catalogIds": ["siciliana"],
     "rowIds": ["siciliana-pizzadb", "sfincione-pizzadb"]},
    {"id": "NC-4-calabresa", "label": "Calabresa family (2-way)", "catalogIds": [],
     "rowIds": ["calabresa-argentina-pizzadb", "brazilian-calabresa-pizzadb-p10"]},
    {"id": "NC-5-speck-e-brie", "label": "speck-e-brie candidate vs differently-composed PIZZA DB row", "catalogIds": ["speck-e-brie"],
     "rowIds": ["speck-e-brie-pizzadb-p4"]},
    {"id": "NC-6-frutti-pescatore", "label": "Frutti di Mare vs Pescatore (cross-referenced, kept separate)", "catalogIds": ["frutti-di-mare"],
     "rowIds": ["frutti-di-mare-pizzadb-p11", "pescatore-pizzadb-p11"]},
    {"id": "NC-7-chicago", "label": "Chicago Deep-Dish vs Chicago Stuffed (two real styles)", "catalogIds": ["chicago-deep-dish"],
     "rowIds": ["chicago-deep-dish-pizzadb", "chicago-stuffed-pizza-pizzadb-p3"]},
]

# Composition conflicts as listed by the Phase-0 master report section 5 (for reconciliation).
PHASE0_CONFLICTS_SHIPPED = ["fugazza", "breakfast-pizza", "genovese", "marinara", "meat-lovers"]
PHASE0_CONFLICTS_CANDIDATE = ["detroit-style", "nutella-dessert", "bismarck", "romana", "boscaiola",
                              "frutti-di-mare", "ai-funghi-porcini", "al-tartufo", "teriyaki-chicken"]

# ---------------------------------------------------------------------------
# 4. Spread-layer (sauce-type) classification
# ---------------------------------------------------------------------------
# Ingredients that are spread-type layers rather than scatter toppings:
#   * category 'sauce' in data/recipes/ingredient_master_catalog.json,
#   * Phase 0B sample ids introduced as sauces/dressings,
#   * genuinely_new ids whose Japanese name carries a canonicalizer
#     TAXONOMY_FLAGS sauce_not_topping / sauce_or_condiment flag.
PHASE0B_SAUCE_IDS = {"curry-ketchup", "salsa", "fromage-blanc-sauce", "blue-cheese-dressing"}

# sauceFamily -> base sauce. `derive` = deterministic ingredient id when the
# family label names exactly one existing sauce; `matches` = listed ids that
# satisfy a generic family; `none` = family implies no spread base.
SAUCE_FAMILY_TABLE = {
    "トマトソース": {"derive": "tomato-sauce", "rule": "family label names the existing tomato-sauce"},
    "BBQソース": {"derive": "bbq-sauce", "rule": "family label names the existing bbq-sauce"},
    "オイル": {"derive": "olive-oil", "rule": "family label 'oil'; the only oil sauce in the catalogs is olive-oil"},
    "サルサ": {"derive": "salsa", "rule": "family label names Phase 0B's salsa"},
    "バジル": {"derive": "pesto", "rule": "all 11 バジル-family rows are ペスト-named dishes; the existing basil sauce is pesto (ジェノベーゼソース). pesto-trapanese is a pesto variant -- flagged as a content note, not a separate sauce id"},
    "チーズ": {"none": True, "rule": "cheese base, no spread sauce (SAUCE step skipped, as for shipped quattro-formaggi-style rows)"},
    "チーズ（トマトソースなし）": {"none": True, "rule": "cheese base without tomato sauce"},
    "ノンソース": {"none": True, "rule": "explicitly no sauce"},
    "ホワイトソース": {"matches": {"fromage-blanc-sauce", "fresh-cream-sauce"}, "matchTokens": {"ホワイトソース"}, "rule": "generic white sauce -- ambiguous in the canonicalizer (ホワイトソース); satisfied only by a listed white-sauce item"},
    "カレー": {"matches": {"curry-ketchup"}, "matchTokens": {"カレーソース"}, "rule": "generic curry sauce; satisfied only by a listed curry sauce"},
    "ホットソース": {"matches": {"buffalo-sauce", "doubanjiang", "chili-oil"}, "matchTokens": set(), "rule": "generic hot sauce; satisfied only by a listed hot sauce"},
    "甘辛だれ": {"matches": {"teriyaki-sauce", "yakiniku-sauce", "sweet-bean-sauce", "miso-sauce", "okonomiyaki-sauce"}, "matchTokens": set(), "rule": "generic sweet-savory tare; satisfied only by a listed tare"},
    "デザートソース": {"matches": {"nutella-spread"}, "matchTokens": set(), "rule": "generic dessert sauce; satisfied only by a listed dessert spread"},
    "その他": {"matchesAnySpread": True, "rule": "'other' family; any listed spread-type item satisfies it, otherwise unspecified"},
}


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def src_ids(path):
    text = path.read_text(encoding="utf-8")
    return sorted(set(re.findall(r'^\s+id: "([a-z0-9-]+)",', text, flags=re.M)))


def build_spread_ids(ingredient_catalog):
    ids = {i["id"] for i in ingredient_catalog["ingredients"] if i["category"] == "sauce"}
    ids |= PHASE0B_SAUCE_IDS
    for name, flag in canon.TAXONOMY_FLAGS.items():
        if flag in ("sauce_not_topping", "sauce_or_condiment") and name in canon.GENUINELY_NEW_REGISTRY:
            ids.add(canon.GENUINELY_NEW_REGISTRY[name])
    return ids


def resolve_tokens(row, exact_names):
    """Resolve the row's raw ingredient list. Returns dict with resolved ids,
    per-token trace, unresolved tokens, excluded tokens, taxonomy flags."""
    trace, resolved, unresolved, excluded, flags = [], [], [], [], []
    if row["ingredientsJa"] is not None:
        for name in row["ingredientsJa"]:
            r = canon.classify(name, exact_names)
            t = {"token": name, "disposition": r["disposition"], "canonicalId": r.get("canonicalId")}
            if r.get("taxonomyFlag"):
                t["taxonomyFlag"] = r["taxonomyFlag"]
                flags.append({"token": name, "flag": r["taxonomyFlag"]})
            if r["disposition"] in ("exact_alias", "likely_alias", "genuinely_new"):
                resolved.append(r["canonicalId"])
            elif r["disposition"] == "excluded_non_ingredient":
                excluded.append(name)
            else:
                unresolved.append({"token": name, "disposition": r["disposition"], "relatedIds": r.get("relatedIds")})
            trace.append(t)
        source = "ingredientsJa via tools/progression2_ingredient_canonicalizer.py classify()"
    else:
        for cid in row["ingredientsCanonical"]:
            trace.append({"token": cid, "disposition": "phase0b_sample_canonical", "canonicalId": cid})
            resolved.append(cid)
        source = "ingredientsCanonical (Phase 0B comparison-table sample, already canonical)"
    return {
        "source": source, "trace": trace, "resolved": sorted(set(resolved)),
        "unresolved": unresolved, "excluded": excluded, "flags": flags,
    }


def base_sauce(row, res, spread_ids):
    fam = row["sauceFamily"]
    spec = SAUCE_FAMILY_TABLE[fam]
    listed_spread = sorted(i for i in res["resolved"] if i in spread_ids)
    listed_spread_tokens = sorted(u["token"] for u in res["unresolved"]
                                  if canon.TAXONOMY_FLAGS.get(u["token"]) == "sauce_not_topping")
    out = {"sauceFamily": fam, "rule": spec["rule"]}
    base_satisfied_by = []
    if spec.get("none"):
        out["status"] = "none"
        out["baseIngredientId"] = None
        family_layer = 0
    elif "derive" in spec:
        d = spec["derive"]
        out["baseIngredientId"] = d
        out["status"] = "listed" if d in listed_spread else "family_derived"
        base_satisfied_by = [d] if d in listed_spread else []
        family_layer = 0 if d in listed_spread else 1
    elif spec.get("matchesAnySpread"):
        if listed_spread or listed_spread_tokens:
            out["status"] = "listed"
            out["baseIngredientId"] = listed_spread[0] if len(listed_spread) == 1 and not listed_spread_tokens else None
            base_satisfied_by = listed_spread + listed_spread_tokens
            family_layer = 0
        else:
            out["status"] = "unspecified"
            out["baseIngredientId"] = None
            family_layer = 1
    else:
        hits = [i for i in listed_spread if i in spec["matches"]]
        tok_hits = [t for t in listed_spread_tokens if t in spec["matchTokens"]]
        if hits or tok_hits:
            out["status"] = "listed" if hits else "listed_unresolved"
            out["baseIngredientId"] = hits[0] if len(hits) == 1 and not tok_hits else None
            base_satisfied_by = hits + tok_hits
            family_layer = 0
        else:
            out["status"] = "unspecified"
            out["baseIngredientId"] = None
            family_layer = 1
    layers = []
    if family_layer:
        layers.append(out["baseIngredientId"] or f"<unspecified {fam} base>")
    layers += listed_spread + listed_spread_tokens
    out["spreadLayers"] = layers
    out["spreadLayerCount"] = len(layers)
    # Layers that certainly exist: a family-derived base plus every listed spread item. An
    # UNSPECIFIED base next to a listed spread item may be that same item (e.g. ホワイトソース
    # family + listed mayo), so it is not counted as a certain extra layer.
    out["certainSpreadLayerCount"] = (1 if out["status"] == "family_derived" else 0) + len(listed_spread) + len(listed_spread_tokens)
    out["satisfiedBy"] = base_satisfied_by
    return out


def dough_evidence(row):
    spec = DOUGH_STYLE_TABLE[row["doughStyle"]]
    evs = []
    src = "recipeRows[].doughStyle"
    if spec["class"] == "variant" and spec.get("variant"):
        evs.append(ev("DOUGH_VARIANT", spec["variant"], "source_dough_field", src, row["doughStyle"]))
    if spec.get("shape"):
        evs.append(ev("DOUGH_SHAPE_TARGET", spec["shape"], "source_dough_field", src, row["doughStyle"]))
    if spec.get("pan"):
        evs.append(ev("PAN_BAKE", spec["pan"], "source_dough_field", src, row["doughStyle"]))
    if spec.get("enclose"):
        evs.append(ev("ENCLOSE", spec["enclose"], "source_dough_field", src, row["doughStyle"]))
    if spec.get("laminate"):
        evs.append(ev("LAMINATE", spec["laminate"], "source_dough_field", src, row["doughStyle"]))
    if spec.get("cook"):
        evs.append(ev("FRY_COOK", spec["cook"], "source_dough_field", src, row["doughStyle"]))
    return spec, evs


def candidate_id(row, catalog_ids, relation, taken):
    corr = row["correspondsToExistingCatalogId"]
    if corr and relation == "IDENTICAL":
        return corr, "reuses existing catalog id (composition IDENTICAL)"
    base = re.sub(r"-pizzadb(-row|-p\d+)?$", "", row["id"])
    base = re.sub(r"-pizzadb$", "", base)
    cid = base
    note = "evidence id with the -pizzadb[-row|-pN] provenance suffix stripped"
    if cid in catalog_ids or cid in taken:
        cid = f"{base}-pizzadb"
        note = "stripped id collides with an existing catalog id or another candidate -- kept a -pizzadb suffix"
    return cid, note


def relation_of(row_set, cat_set):
    if row_set == cat_set:
        return "IDENTICAL"
    if row_set > cat_set:
        return "PIZZADB_SUPERSET"
    if row_set < cat_set:
        return "PIZZADB_SUBSET"
    return "DIVERGENT"


def build():
    master = load(MASTER_PATH)
    ledger = load(LEDGER_PATH)
    deadlock = load(DEADLOCK_PATH)
    catalog = load(CATALOG_PATH)
    ing_catalog = load(INGREDIENT_CATALOG_PATH)
    exact_names = canon.load_canonical_names()
    spread_ids = build_spread_ids(ing_catalog)

    rows = master["recipeRows"]
    cat_by_id = {r["id"]: r for r in catalog["recipes"]}
    catalog_ids = set(cat_by_id)
    shipped_ids = sorted(r["id"] for r in catalog["recipes"] if r["currentGameRecipe"])
    src_recipe_ids = src_ids(SRC_RECIPES_PATH)
    src_ingredient_ids = set(src_ids(SRC_INGREDIENTS_PATH))

    matrix_rows = []
    taken_ids = set()
    comp_ledger = []

    # pass 1: per-row resolution
    pre = []
    for r in rows:
        res = resolve_tokens(r, exact_names)
        bs = base_sauce(r, res, spread_ids)
        identity = set(res["resolved"])
        if bs["status"] == "family_derived":
            identity.add(bs["baseIngredientId"])
        pre.append((r, res, bs, sorted(identity)))

    for r, res, bs, identity in pre:
        rid = r["id"]
        spec, evs = dough_evidence(r)
        evs = evs + ROW_MECHANIC_EVIDENCE.get(rid, [])
        if bs["certainSpreadLayerCount"] >= 2:
            evs.append(ev("MULTI_SPREAD_LAYER", "additional-spread-layer", "source_ingredient_field",
                          "recipeRows[].sauceFamily + ingredients",
                          f"{bs['certainSpreadLayerCount']} spread-type layers: {', '.join(bs['spreadLayers'])} (current SAUCE supports exactly one)"))
        elif bs["spreadLayerCount"] >= 2:
            evs.append(ev("MULTI_SPREAD_LAYER", "additional-spread-layer", "repo_inference",
                          "recipeRows[].sauceFamily + ingredients",
                          f"unspecified {bs['sauceFamily']} base next to listed spread item(s) {', '.join(bs['spreadLayers'][1:])} -- "
                          "a second layer exists only if the listed item is NOT itself the family base (content decision)"))
        required = sorted({e["capability"] for e in evs if e["strength"] in REQUIRED_STRENGTHS},
                          key=CAPABILITY_ORDER.index)
        candidates = sorted({e["capability"] for e in evs if e["strength"] not in REQUIRED_STRENGTHS} - set(required),
                            key=CAPABILITY_ORDER.index)
        structural = [c for c in required if CAPABILITIES[c]["structural"]]
        s4_only_identity = r["requiresMechanicIdentity"] and not required
        if structural:
            rep = "NOT_REPRESENTABLE"
            rep_reason = f"structural capability missing from current flow: {', '.join(structural)}"
        elif required:
            rep = "PARTIAL"
            rep_reason = f"playable via current flow but loses evidenced dimension(s): {', '.join(required)}"
        elif s4_only_identity:
            rep = "PARTIAL"
            rep_reason = "Phase 0 flagged a mechanic identity, but only repo-inference evidence exists for it -- cannot be declared FULL; mechanic interpretation is a product decision"
        else:
            rep = "FULL"
            rep_reason = "every evidenced dimension is expressible by DOUGH(round) -> SAUCE(one layer) -> CHEESE/TOPPING(scatter) -> BAKE(one) -> optional CUT, given ingredient content"

        def modes(cap):
            return sorted({e["mode"] for e in evs if e["capability"] == cap and e["strength"] in REQUIRED_STRENGTHS})

        late = [{"mode": e["mode"], "ingredients": e.get("ingredients", []), "strength": e["strength"]}
                for e in evs if e["capability"] == "LATE_ADDITION"]
        prep = [{"mode": e["mode"], "ingredients": e.get("ingredients", []), "strength": e["strength"]}
                for e in evs if e["capability"] == "PREP_STEP"]
        shape = (modes("DOUGH_SHAPE_TARGET") or ["round"])[0]
        pan = (modes("PAN_BAKE") or [None])[0]
        enclose = (modes("ENCLOSE") or [None])[0]
        cook = "fry" if "FRY_COOK" in required else "bake"
        if "LAMINATE" in required:
            form = "laminated-pastry"
        elif enclose:
            form = f"enclosed:{enclose}"
        else:
            form = f"open-{shape}"
        # cut / serve
        if enclose == "fold":
            cut = {"behavior": "serve-whole-no-cut", "basis": "docs/design/TETO_RECIPE-COOKING-STEPS_1.0.md section 5: a closed folded calzone is served whole"}
        elif enclose or "LAMINATE" in required or cook == "fry":
            cut = {"behavior": "unspecified", "basis": "no evidence on cutting/serving for this form; current CUT assumes an open round pizza"}
        elif shape != "round":
            cut = {"behavior": "shape-aware-cut-required", "basis": "current CUT geometry assumes an ideal circle (cookingProfiles.ts CUT_ELIGIBLE_RECIPE_IDS note)"}
        else:
            cut = {"behavior": "existing-round-cut-optional", "basis": "current CUT (6 slices, opt-in allowlist)"}
        serve = [{"mode": e["mode"], "strength": e["strength"]} for e in evs if e["capability"] == "SERVE_FORM"]
        if serve:
            cut["serveFormEvidence"] = serve

        step_order = (modes("STEP_ORDER") or ["standard(sauce->cheese->topping)"])[0]
        zones = [{"mode": e["mode"], "strength": e["strength"]} for e in evs if e["capability"] == "ZONED_PLACEMENT"]
        dough_variant = (modes("DOUGH_VARIANT") or [spec.get("variant") if spec["class"] == "standard" else None])[0]

        identity_dims = ["ingredientSet"]
        if bs["status"] != "none":
            identity_dims.append("baseSauce")
        for cap, dim in [("DOUGH_VARIANT", "doughVariant"), ("DOUGH_SHAPE_TARGET", "doughShape"), ("PAN_BAKE", "panBake"),
                         ("ENCLOSE", "enclosure"), ("LAMINATE", "lamination"), ("FRY_COOK", "cookingMethod"),
                         ("STEP_ORDER", "layerOrder"), ("ZONED_PLACEMENT", "placementZones"),
                         ("LATE_ADDITION", "lateAdditionTiming"), ("PREP_STEP", "prepStep"),
                         ("MULTI_SPREAD_LAYER", "spreadLayers")]:
            if cap in required:
                identity_dims.append(dim)

        # A row is ingredient-complete only if every source token resolved AND no token was an
        # excluded placeholder (e.g. お好みの具材 = "toppings of your choice"): a placeholder means
        # the real topping set is unspecified, so the resolved remainder must NOT be treated as a
        # complete identity set (it would enter same-set / collision analysis as a false match).
        # Likewise an UNSPECIFIED sauce base (a generic sauceFamily such as 甘辛だれ with no listed
        # sauce) is an unknown ingredient: the dish has a base the evidence does not name, so the
        # resolved tokens alone are not its identity set, and an exact composition diff would
        # wrongly call a catalog sauce "missing" when the unknown base may be exactly that sauce.
        incomplete_reasons = []
        if res["unresolved"]:
            incomplete_reasons.append("unresolved_tokens")
        if res["excluded"]:
            incomplete_reasons.append("excluded_placeholder_tokens")
        if bs["status"] == "unspecified":
            incomplete_reasons.append("unspecified_sauce_base")
        ingredients_complete = not incomplete_reasons
        corr = r["correspondsToExistingCatalogId"]
        relation = None
        if corr:
            if res["unresolved"]:
                relation = "INDETERMINATE_UNRESOLVED_TOKENS"
            elif res["excluded"]:
                relation = "INDETERMINATE_PLACEHOLDER_TOKENS"
            elif bs["status"] == "unspecified":
                relation = "INDETERMINATE_UNSPECIFIED_SAUCE_BASE"
            else:
                relation = relation_of(set(identity), set(cat_by_id[corr]["ingredients"]))
        cid, cid_note = candidate_id(r, catalog_ids, relation, taken_ids)
        taken_ids.add(cid)

        matrix_rows.append({
            "evidenceId": rid,
            "nameJa": r["nameJa"],
            "origin": r["origin"],
            "canonicalCandidateId": cid,
            "canonicalCandidateIdNote": cid_note,
            "ingredients": {
                "resolutionSource": res["source"],
                "canonicalIngredientIds": res["resolved"],
                "unresolvedTokens": res["unresolved"],
                "excludedNonIngredientTokens": res["excluded"],
                "taxonomyFlags": res["flags"],
                "tokenTrace": res["trace"],
                "complete": ingredients_complete,
                "incompleteReasons": incomplete_reasons,
                "identityIngredientSet": identity if ingredients_complete else None,
                "newContentIngredientIds": sorted(i for i in identity if i not in src_ingredient_ids),
            },
            "sauceBase": bs,
            "dough": {
                "doughStyleRaw": r["doughStyle"],
                "class": spec["class"],
                "variant": dough_variant,
                "shape": shape,
                "form": form,
            },
            "placementLayering": {
                "layerOrder": step_order,
                "zones": zones,
                "enclosure": enclose,
                "spreadLayers": bs["spreadLayers"],
            },
            "cookingProfile": {"method": cook, "pan": pan},
            "prep": prep,
            "postBakeFinish": late,
            "cutServe": cut,
            "identityDimensions": identity_dims,
            "mechanicEvidence": evs,
            "currentFlowRepresentability": rep,
            "representabilityReason": rep_reason,
            "requiredCapabilities": required,
            "candidateCapabilities": candidates,
            "phase0": {
                "requiresMechanicIdentity": r["requiresMechanicIdentity"],
                "evidenceGaps": r["evidenceGaps"],
                "correspondsToExistingCatalogId": corr,
                "evidenceOrigin": r["evidenceOrigin"],
                "sourceUrl": r["sourceUrl"],
            },
            "collisionRefs": [],
            "conflictRefs": [],
            "blockers": [],
            "reviewItems": [],
        })
        if corr:
            cat = cat_by_id[corr]
            comp_ledger.append({
                "evidenceId": rid,
                "catalogId": corr,
                "catalogStatus": "shipped" if cat["currentGameRecipe"] else f"candidate:{cat['gameDesignStatus']}/{cat['verificationStatus']}",
                "catalogIngredients": sorted(cat["ingredients"]),
                "pizzadbIdentitySet": identity if ingredients_complete else None,
                "pizzadbUnresolvedTokens": [u["token"] for u in res["unresolved"]],
                "pizzadbExcludedPlaceholderTokens": res["excluded"],
                "pizzadbSauceBaseStatus": bs["status"],
                "relation": relation,
                "addedByPizzaDb": sorted(set(identity) - set(cat["ingredients"])) if ingredients_complete else None,
                "missingFromPizzaDb": sorted(set(cat["ingredients"]) - set(identity)) if ingredients_complete else None,
                "phase0Flagged": corr in PHASE0_CONFLICTS_SHIPPED + PHASE0_CONFLICTS_CANDIDATE,
                "phase0FlaggedAs": ("shipped" if corr in PHASE0_CONFLICTS_SHIPPED else "candidate") if corr in PHASE0_CONFLICTS_SHIPPED + PHASE0_CONFLICTS_CANDIDATE else None,
            })

    by_id = {m["evidenceId"]: m for m in matrix_rows}

    # --- composition-decision ledger ---------------------------------------
    for c in comp_ledger:
        shipped = c["catalogStatus"] == "shipped"
        if c["relation"] == "IDENTICAL":
            c["decisionStatus"] = "NO_DECISION_CORROBORATES"
            c["options"] = []
        else:
            c["decisionStatus"] = "PRODUCT_DECISION_REQUIRED"
            c["options"] = (["keep shipped composition (PIZZA DB row becomes a separate candidate or is dropped)",
                             "adopt PIZZA DB composition (changes a shipped recipe -- needs its own migration review)",
                             "ship both as distinct dishes with disambiguated names"] if shipped else
                            ["keep catalog candidate composition", "replace with PIZZA DB composition",
                             "keep both as distinct candidates"])
            c["notes"] = []
            if c["phase0Flagged"] and c["phase0FlaggedAs"] == "candidate" and shipped:
                c["notes"].append("Phase-0 master report section 5 listed this under 'unshipped candidates', but the catalog marks it currentGameRecipe=true and src/data/recipes.ts ships it -- this is a conflict against a SHIPPED recipe.")
            if c["catalogId"] == "marinara":
                c["notes"].append("With the row's own トマトソース sauceFamily applied as the base sauce, the difference narrows to the added olive-oil (Phase 0 compared the ingredient list alone).")
            if not c["phase0Flagged"]:
                c["notes"].append("Newly surfaced by this matrix (identity set incl. family-derived base sauce vs catalog ingredients); not in the Phase-0 conflict list.")
        row = by_id[c["evidenceId"]]
        ref = f"COMP:{c['evidenceId']}->{c['catalogId']}"
        if c["decisionStatus"] != "NO_DECISION_CORROBORATES":
            row["conflictRefs"].append(ref)
            row["blockers"].append({"type": "COMPOSITION_CONFLICT_SHIPPED" if shipped else "COMPOSITION_CONFLICT_CANDIDATE",
                                    "ref": ref, "detail": c["relation"]})

    # --- naming clusters -----------------------------------------------------
    for nc in NAMING_CLUSTERS:
        for rid in nc["rowIds"]:
            by_id[rid]["conflictRefs"].append(nc["id"])
            by_id[rid]["reviewItems"].append({"type": "NAMING_CLUSTER", "ref": nc["id"], "detail": nc["label"]})

    # --- Phase-0 exact-set collision groups (the 5) --------------------------
    p0_groups = deadlock["exactIngredientSetCollisions"]["groups"]
    collision_ledger = []
    for gi, g in enumerate(p0_groups, 1):
        gid = f"P0-COLL-{gi}"
        members = g["recipeIds"]
        dims = {}
        for mid in members:
            mr = by_id[mid]
            dims[mid] = {
                "doughVariant": mr["dough"]["variant"], "shape": mr["dough"]["shape"],
                "pan": mr["cookingProfile"]["pan"], "layerOrder": mr["placementLayering"]["layerOrder"],
                "requiredCapabilities": mr["requiredCapabilities"],
                "sauceFamily": mr["sauceBase"]["sauceFamily"], "doughStyleRaw": mr["dough"]["doughStyleRaw"],
            }
        sigs = {mid: (d["doughVariant"], d["shape"], d["pan"], d["layerOrder"], d["sauceFamily"]) for mid, d in dims.items()}
        distinguished = len(set(sigs.values())) == len(members)
        distinguishing = []
        if distinguished:
            for key in ["doughVariant", "shape", "pan", "layerOrder", "sauceFamily"]:
                if len({str(d[key]) for d in dims.values()}) == len(members):
                    distinguishing.append(key)
        collision_ledger.append({
            "id": gid, "source": "TETO_PROGRESS2_PHASE0B18_full172-deadlock-analysis.json exactIngredientSetCollisions",
            "phase0IngredientSet": g["ingredientSet"], "members": members, "memberDimensions": dims,
            "verdict": "DISTINGUISHED" if distinguished else "DISCOVERY_RULE_BLOCKER",
            "distinguishingDimensions": distinguishing,
            "requiresCapabilities": sorted({c for mid in members for c in by_id[mid]["requiredCapabilities"]
                                            if c in ("DOUGH_VARIANT", "DOUGH_SHAPE_TARGET", "PAN_BAKE", "STEP_ORDER")},
                                           key=CAPABILITY_ORDER.index) if distinguished else [],
            "note": ("Distinguishable only once the listed capabilities exist; under the current flow alone the members stay indistinguishable."
                     if distinguished else
                     "No evidenced non-ingredient dimension separates the members (same doughStyle, same sauceFamily, no mechanic evidence). Cannot be resolved without new evidence or a product decision."),
        })
        for mid in members:
            by_id[mid]["collisionRefs"].append(gid)
            if not distinguished:
                by_id[mid]["blockers"].append({"type": "DISCOVERY_COLLISION", "ref": gid,
                                               "detail": "identical ingredient set and no distinguishing evidenced dimension"})

    # --- extended discovery-signature analysis over all complete rows --------
    def signature(mr):
        return json.dumps([
            mr["ingredients"]["identityIngredientSet"], mr["dough"]["variant"] if mr["dough"]["class"] != "standard" else "standard",
            mr["dough"]["shape"], mr["dough"]["form"], mr["cookingProfile"],
            mr["placementLayering"]["layerOrder"],
            sorted(z["mode"] for z in mr["placementLayering"]["zones"] if z["strength"] in REQUIRED_STRENGTHS),
            sorted((a["mode"], tuple(a["ingredients"])) for a in mr["postBakeFinish"] if a["strength"] in REQUIRED_STRENGTHS),
            sorted((p["mode"], tuple(p["ingredients"])) for p in mr["prep"]),
            mr["sauceBase"]["sauceFamily"],
        ], ensure_ascii=False, sort_keys=True)

    complete = [mr for mr in matrix_rows if mr["ingredients"]["identityIngredientSet"] is not None]
    by_set = defaultdict(list)
    for mr in complete:
        by_set[tuple(mr["ingredients"]["identityIngredientSet"])].append(mr["evidenceId"])
    # add catalog recipes (shipped + viable candidates) to the ingredient-set view
    cat_by_set = defaultdict(list)
    for cr in catalog["recipes"]:
        if cr["verificationStatus"] == "rejected_duplicate":
            continue
        cat_by_set[tuple(sorted(cr["ingredients"]))].append(cr["id"])
    extended = []
    for key in sorted(set(by_set) | set(k for k in cat_by_set if k in by_set)):
        rids = sorted(by_set.get(key, []))
        cids = sorted(cat_by_set.get(key, []))
        if len(rids) + len(cids) < 2:
            continue
        # Per ROW, never a group-wide union: one row declaring a catalog correspondence must not
        # hide that same catalog recipe from a sibling row that declares nothing (Trenton vs NY).
        undeclared_by_row = {x: [c for c in cids if c != by_id[x]["phase0"]["correspondsToExistingCatalogId"]]
                             for x in rids}
        sigs = defaultdict(list)
        for x in rids:
            sigs[signature(by_id[x])].append(x)
        sig_groups = [sorted(v) for v in sigs.values() if len(v) > 1]
        extended.append({
            "identityIngredientSet": list(key), "rowIds": rids, "catalogIdsWithSameSet": cids,
            "catalogIdsNotDeclaredByRow": undeclared_by_row,
            "rowsSeparatedByFullSignature": not sig_groups,
            "rowsWithIdenticalFullSignature": sig_groups,
        })
    sig_all = defaultdict(list)
    for mr in complete:
        sig_all[signature(mr)].append(mr["evidenceId"])
    signature_blockers = sorted(sorted(v) for v in sig_all.values() if len(v) > 1)

    # undeclared equality with a catalog recipe's ingredient set: soft review
    for e in extended:
        for rid in e["rowIds"]:
            mr = by_id[rid]
            others = e["catalogIdsNotDeclaredByRow"][rid]
            if others:
                mr["reviewItems"].append({"type": "SAME_INGREDIENT_SET_AS_CATALOG_RECIPE", "ref": ",".join(others),
                                          "detail": "identity ingredient set equals an existing catalog recipe that the row is not declared to correspond to -- distinguishable only by " + (", ".join(mr["requiredCapabilities"]) or "nothing evidenced")})

    # --- per-row blockers / review items -------------------------------------
    for mr in matrix_rows:
        rid = mr["evidenceId"]
        for u in mr["ingredients"]["unresolvedTokens"]:
            mr["blockers"].append({"type": "UNRESOLVED_INGREDIENT", "ref": u["token"],
                                   "detail": f"{u['disposition']}; related ids {u['relatedIds']} -- preserved, not canonicalized"})
        for g in mr["phase0"]["evidenceGaps"]:
            mr["blockers"].append({"type": "EVIDENCE_GAP", "ref": rid, "detail": g[:240]})
        if mr["sauceBase"]["status"] == "unspecified":
            mr["blockers"].append({"type": "BASE_SAUCE_UNSPECIFIED", "ref": mr["sauceBase"]["sauceFamily"],
                                   "detail": "sauceFamily implies a spread base but no specific sauce ingredient is evidenced; a sauce id must be chosen (product/content decision)"})
        if rid in SCOPE_QUESTIONS:
            mr["blockers"].append({"type": "SCOPE_QUESTION", "ref": rid, "detail": SCOPE_QUESTIONS[rid]})
        # A Phase-0 mechanic-identity flag whose (part of the) mechanic is backed only by repo
        # inference / context-only text is a product decision, not a silently dropped dimension.
        if mr["phase0"]["requiresMechanicIdentity"] and mr["candidateCapabilities"]:
            mr["blockers"].append({"type": "MECHANIC_INTERPRETATION", "ref": ",".join(mr["candidateCapabilities"]),
                                   "detail": "Phase 0 flagged a mechanic identity that is supported only by repo inference or context-only text; the capability must be confirmed or rejected"})
        for a in mr["postBakeFinish"]:
            if a["mode"].startswith("unresolved") and a["strength"] in REQUIRED_STRENGTHS:
                mr["blockers"].append({"type": "MECHANIC_INTERPRETATION", "ref": "LATE_ADDITION",
                                       "detail": f"timing mode unresolved ({a['mode']})"})
        if rid in SOURCE_INCONSISTENCIES:
            mr["reviewItems"].append({"type": "SOURCE_INCONSISTENCY", "ref": rid, "detail": SOURCE_INCONSISTENCIES[rid]})
        if rid in NAME_SPECIFICITY_GAPS:
            mr["reviewItems"].append({"type": "NAME_SPECIFICITY_GAP", "ref": rid, "detail": NAME_SPECIFICITY_GAPS[rid]})
        for f in mr["ingredients"]["taxonomyFlags"]:
            if f["flag"] == "prepared_dish_composite":
                mr["reviewItems"].append({"type": "PREPARED_COMPOSITE_INGREDIENT", "ref": f["token"],
                                          "detail": "prepared dish used as a topping (canonicalizer taxonomy flag)"})
        if mr["candidateCapabilities"] and not mr["phase0"]["requiresMechanicIdentity"]:
            mr["reviewItems"].append({"type": "CANDIDATE_CAPABILITY", "ref": ",".join(mr["candidateCapabilities"]),
                                      "detail": "repo-inference / context-only mechanic evidence -- confirm or drop"})
        for sb in signature_blockers:
            if rid in sb and not any(b["type"] == "DISCOVERY_COLLISION" for b in mr["blockers"]):
                mr["blockers"].append({"type": "DISCOVERY_COLLISION", "ref": "SIG:" + "|".join(sb),
                                       "detail": "identical full discovery signature"})
        corr = mr["phase0"]["correspondsToExistingCatalogId"]
        comp = next((c for c in comp_ledger if c["evidenceId"] == rid), None)
        if mr["blockers"]:
            status = "BLOCKED_PRODUCT_DECISION"
        elif corr and comp and comp["relation"] == "IDENTICAL" and corr in shipped_ids:
            status = "ALREADY_SHIPPED_CORROBORATED"
        elif mr["reviewItems"]:
            status = "READY_WITH_REVIEW"
        else:
            status = "READY"
        mr["productDecisionStatus"] = status
        mr["blockers"].sort(key=lambda b: (b["type"], b["ref"]))
        mr["reviewItems"].sort(key=lambda b: (b["type"], b["ref"]))

    # --- capability statistics & implementation order -------------------------
    def required_of(mr):
        return set(mr["requiredCapabilities"])

    cap_stats = []
    for cap in CAPABILITY_ORDER:
        req_rows = sorted(mr["evidenceId"] for mr in matrix_rows if cap in mr["requiredCapabilities"])
        cand_rows = sorted(mr["evidenceId"] for mr in matrix_rows if cap in mr["candidateCapabilities"])
        alone = sorted(mr["evidenceId"] for mr in matrix_rows if required_of(mr) == {cap})
        mode_counts = Counter(e["mode"] for mr in matrix_rows for e in mr["mechanicEvidence"]
                              if e["capability"] == cap and e["strength"] in REQUIRED_STRENGTHS)
        cap_stats.append({
            "capability": cap, **{k: CAPABILITIES[cap][k] for k in ("labelJa", "axes", "structural", "costClass", "reuses", "mergeRationale")},
            "rowsRequiringCount": len(req_rows), "rowsRequiring": req_rows,
            "rowsUnlockedAloneCount": len(alone), "rowsUnlockedAlone": alone,
            "rowsCandidateOnlyCount": len(cand_rows), "rowsCandidateOnly": cand_rows,
            "evidencedModes": dict(sorted(mode_counts.items())),
        })
    proposed_set = [c["capability"] for c in cap_stats if c["rowsRequiringCount"] > 0]
    candidate_only_caps = [c["capability"] for c in cap_stats if c["rowsRequiringCount"] == 0 and c["rowsCandidateOnlyCount"] > 0]

    # greedy order: maximize rows that become fully satisfied; tie-break cheaper, then taxonomy order
    implemented = set()
    order = []
    full_now = sum(1 for mr in matrix_rows if not required_of(mr))
    remaining = [c for c in proposed_set]
    cumulative = full_now
    while remaining:
        def gain(c):
            s = implemented | {c}
            return sum(1 for mr in matrix_rows if required_of(mr) and required_of(mr) <= s and not required_of(mr) <= implemented)
        best = max(remaining, key=lambda c: (gain(c), -COST_RANK[CAPABILITIES[c]["costClass"]], -CAPABILITY_ORDER.index(c)))
        before = set(implemented)
        implemented.add(best)
        newly = [mr for mr in matrix_rows
                 if required_of(mr) and required_of(mr) <= implemented and not required_of(mr) <= before]
        cumulative += len(newly)
        remaining.remove(best)
        order.append({"step": len(order) + 1, "capability": best, "costClass": CAPABILITIES[best]["costClass"],
                      "structural": CAPABILITIES[best]["structural"],
                      "newlyFullySatisfiedRows": len(newly), "cumulativeRowsWithAllRequiredCapabilities": cumulative,
                      "newlyFullySatisfiedAndDecisionReady": sum(1 for mr in newly if mr["productDecisionStatus"] in ("READY", "READY_WITH_REVIEW")),
                      "newlyFullySatisfiedRowIds": sorted(mr["evidenceId"] for mr in newly)})

    rep_counts = Counter(mr["currentFlowRepresentability"] for mr in matrix_rows)
    status_counts = Counter(mr["productDecisionStatus"] for mr in matrix_rows)
    blocker_counts = Counter(b["type"] for mr in matrix_rows for b in mr["blockers"])
    blocker_row_counts = Counter(t for mr in matrix_rows for t in {b["type"] for b in mr["blockers"]})
    review_row_counts = Counter(t for mr in matrix_rows for t in {b["type"] for b in mr["reviewItems"]})
    unresolved_tokens = Counter(u["token"] for mr in matrix_rows for u in mr["ingredients"]["unresolvedTokens"])
    new_content = sorted({i for mr in matrix_rows for i in mr["ingredients"]["newContentIngredientIds"]})
    all_ids = sorted({i for mr in matrix_rows for i in (mr["ingredients"]["identityIngredientSet"] or mr["ingredients"]["canonicalIngredientIds"])})

    summary = {
        "rowCount": len(matrix_rows),
        "uniqueEvidenceIds": len(by_id),
        "currentFlowRepresentability": {k: rep_counts.get(k, 0) for k in ("FULL", "PARTIAL", "NOT_REPRESENTABLE")},
        "productDecisionStatus": dict(sorted(status_counts.items())),
        "rowsWithHardBlockerByType": dict(sorted(blocker_row_counts.items())),
        "hardBlockerOccurrencesByType": dict(sorted(blocker_counts.items())),
        "rowsBlockedByExactlyOneBlockerType": dict(sorted(Counter(
            next(iter({b["type"] for b in mr["blockers"]})) for mr in matrix_rows
            if len({b["type"] for b in mr["blockers"]}) == 1).items())),
        "representabilityByStatus": {rep: dict(sorted(Counter(mr["productDecisionStatus"] for mr in matrix_rows
                                                               if mr["currentFlowRepresentability"] == rep).items()))
                                     for rep in ("FULL", "PARTIAL", "NOT_REPRESENTABLE")},
        "fullAndDecisionReadyRowIds": sorted(mr["evidenceId"] for mr in matrix_rows
                                             if mr["currentFlowRepresentability"] == "FULL"
                                             and mr["productDecisionStatus"] in ("READY", "READY_WITH_REVIEW")),
        "rowsWithReviewItemByType": dict(sorted(review_row_counts.items())),
        "rowsWithUnresolvedIngredients": sum(1 for mr in matrix_rows if mr["ingredients"]["unresolvedTokens"]),
        "unresolvedIngredientTokenOccurrences": dict(sorted(unresolved_tokens.items())),
        "rowsWithCompleteIdentityIngredientSet": len(complete),
        "rowsIncompleteByReason": dict(sorted(Counter(reason for mr in matrix_rows
                                                     for reason in mr["ingredients"]["incompleteReasons"]).items())),
        "rowsWithExcludedPlaceholderTokens": sorted(mr["evidenceId"] for mr in matrix_rows
                                                    if mr["ingredients"]["excludedNonIngredientTokens"]),
        "canonicalIngredientIdsAcrossMatrix": len(all_ids),
        "ingredientIdsNotYetInShippedGame": len(new_content),
        "sauceBaseStatus": dict(sorted(Counter(mr["sauceBase"]["status"] for mr in matrix_rows).items())),
        "phase0MechanicIdentityRows": sum(1 for mr in matrix_rows if mr["phase0"]["requiresMechanicIdentity"]),
        "rowsWithAnyRequiredCapability": sum(1 for mr in matrix_rows if mr["requiredCapabilities"]),
        "rowsWithRequiredCapabilityNotFlaggedInPhase0": sorted(mr["evidenceId"] for mr in matrix_rows
                                                                if mr["requiredCapabilities"] and not mr["phase0"]["requiresMechanicIdentity"]),
        "proposedReusableCapabilitySet": proposed_set,
        "candidateOnlyCapabilities": candidate_only_caps,
        "phase0CollisionGroups": {"total": len(collision_ledger),
                                  "distinguished": sum(1 for c in collision_ledger if c["verdict"] == "DISTINGUISHED"),
                                  "blocked": sum(1 for c in collision_ledger if c["verdict"] != "DISTINGUISHED")},
        "fullSignatureCollisionGroups": signature_blockers,
        "compositionLedger": {
            "entries": len(comp_ledger),
            "byRelation": dict(sorted(Counter(c["relation"] for c in comp_ledger).items())),
            "decisionRequired": sum(1 for c in comp_ledger if c["decisionStatus"] == "PRODUCT_DECISION_REQUIRED"),
            "decisionRequiredAgainstShipped": sum(1 for c in comp_ledger if c["decisionStatus"] == "PRODUCT_DECISION_REQUIRED" and c["catalogStatus"] == "shipped"),
            "newlySurfacedVsPhase0": sorted(c["evidenceId"] for c in comp_ledger if c["decisionStatus"] == "PRODUCT_DECISION_REQUIRED" and not c["phase0Flagged"]),
        },
        "namingClusters": len(NAMING_CLUSTERS),
    }

    out = {
        "schemaNote": ("Progression 2.0 Phase 1 (Issue #188) game-design candidate / mechanic matrix. "
                       "Docs/data-only; NOT part of src/**, NOT a production SSOT, NOT a price/threshold/unlock decision. "
                       "Generated deterministically by tools/progression2_mechanic_matrix.py from the Phase-0 master evidence; "
                       "the 172-source evidence itself is read-only input and is not modified."),
        "generatedBy": "tools/progression2_mechanic_matrix.py",
        "issue": "https://github.com/perusonao/teto-pizza-game/issues/188",
        "phase0BaseMergeSha": PHASE0_MERGE_SHA,
        "inputs": [str(p.relative_to(ROOT)) for p in (MASTER_PATH, LEDGER_PATH, DEADLOCK_PATH, CATALOG_PATH, INGREDIENT_CATALOG_PATH, SRC_RECIPES_PATH, SRC_INGREDIENTS_PATH)]
                  + ["tools/progression2_ingredient_canonicalizer.py"],
        "currentFlowBaseline": BASELINE_FLOW,
        "shippedRecipeIds": shipped_ids,
        "shippedRecipeIdsInSrc": src_recipe_ids,
        "evidenceStrengths": STRENGTHS,
        "requiredStrengths": sorted(REQUIRED_STRENGTHS),
        "representabilityRule": {
            "FULL": "no required capability and no Phase-0 mechanic flag left uninterpreted",
            "PARTIAL": "only non-structural required capabilities missing (dish playable, evidenced dimension lost), or a Phase-0 mechanic flag backed only by repo inference",
            "NOT_REPRESENTABLE": "at least one structural required capability missing (current flow produces a different dish form)",
        },
        "productDecisionStatusRule": {
            "BLOCKED_PRODUCT_DECISION": "any hard blocker (unresolved ingredient, evidence gap, composition conflict, discovery collision, unspecified base sauce, scope question, mechanic interpretation)",
            "ALREADY_SHIPPED_CORROBORATED": "no hard blocker; composition IDENTICAL to a shipped recipe",
            "READY_WITH_REVIEW": "no hard blocker; soft review items only (naming cluster, source inconsistency, name specificity, prepared composite, candidate capability, same set as a catalog recipe)",
            "READY": "no blocker and no review item (capability dependencies are listed separately and are NOT product blockers)",
        },
        "capabilityTaxonomy": CAPABILITIES,
        "doughStyleTable": {str(k): v for k, v in DOUGH_STYLE_TABLE.items()},
        "sauceFamilyTable": {k: {kk: (sorted(vv) if isinstance(vv, set) else vv) for kk, vv in v.items()} for k, v in SAUCE_FAMILY_TABLE.items()},
        "spreadLayerIngredientIds": sorted(spread_ids),
        "summary": summary,
        "capabilityStats": cap_stats,
        "recommendedImplementationOrder": {
            "method": "greedy: each step adds the capability that makes the most additional rows have ALL their required capabilities; ties -> cheaper costClass, then taxonomy order. Coverage only -- no prices, star thresholds or unlock order decided.",
            "baselineRowsNeedingNoCapability": full_now,
            "steps": order,
        },
        "collisionLedger": collision_ledger,
        "extendedIdentitySetCollisions": extended,
        "compositionDecisionLedger": comp_ledger,
        "namingClusterLedger": NAMING_CLUSTERS,
        "catalogTagsNotApplied": CATALOG_TAGS_NOT_APPLIED,
        "rows": matrix_rows,
    }
    return out


# ---------------------------------------------------------------------------
# Generated per-row Markdown table
# ---------------------------------------------------------------------------
ABBR = {"DOUGH_VARIANT": "DV", "MULTI_SPREAD_LAYER": "MS", "STEP_ORDER": "SO", "ZONED_PLACEMENT": "ZP",
        "PREP_STEP": "PR", "LATE_ADDITION": "LA", "PAN_BAKE": "PB", "DOUGH_SHAPE_TARGET": "SH",
        "ENCLOSE": "EN", "LAMINATE": "LM", "FRY_COOK": "FR", "SERVE_FORM": "SV"}
REP_ABBR = {"FULL": "FULL", "PARTIAL": "PART", "NOT_REPRESENTABLE": "NR"}


def render_rows_md(out):
    lines = [
        "# 172 Recipe Mechanic Matrix — per-row table (GENERATED)",
        "",
        "Generated by `tools/progression2_mechanic_matrix.py` from",
        "`docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json`. Do not edit by hand —",
        "rerun the tool. Narrative, taxonomy and ledgers: `docs/design/TETO_RECIPE_172_MECHANIC-MATRIX.md`.",
        "",
        "Capability codes: " + ", ".join(f"`{v}`={k}" for k, v in ABBR.items()) + ". "
        "Required capabilities are plain; candidate-only (repo inference / context) are in *(parentheses)*.",
        "",
        "| # | evidence id | 名称 | sauce base | dough | ingredients (canonical) | unresolved | flow | required | status | blockers |",
        "|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    for i, mr in enumerate(out["rows"], 1):
        req = " ".join(ABBR[c] for c in mr["requiredCapabilities"])
        cand = " ".join(ABBR[c] for c in mr["candidateCapabilities"])
        caps = req + (f" *({cand})*" if cand else "")
        sb = mr["sauceBase"]
        sauce = f"{sb['sauceFamily']} → {sb['baseIngredientId'] or sb['status']}"
        dough = mr["dough"]["variant"] or mr["dough"]["class"]
        if mr["dough"]["form"] != "open-round":
            dough += f" / {mr['dough']['form']}"
        ings = ", ".join(mr["ingredients"]["canonicalIngredientIds"])
        unres = ", ".join(u["token"] for u in mr["ingredients"]["unresolvedTokens"] + [{"token": t} for t in mr["ingredients"]["excludedNonIngredientTokens"]])
        blk = ", ".join(sorted({b["type"] for b in mr["blockers"]}))
        lines.append(f"| {i} | `{mr['evidenceId']}` | {mr['nameJa']} | {sauce} | {dough} | {ings} | {unres} | "
                     f"{REP_ABBR[mr['currentFlowRepresentability']]} | {caps} | {mr['productDecisionStatus']} | {blk} |")
    lines.append("")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
def validate(out):
    errors = []
    master = load(MASTER_PATH)
    deadlock = load(DEADLOCK_PATH)
    mrows = {r["id"]: r for r in master["recipeRows"]}
    rows = out["rows"]
    by_row = {r["evidenceId"]: r for r in rows}

    def check(cond, msg):
        if not cond:
            errors.append(msg)

    ids = [r["evidenceId"] for r in rows]
    check(len(rows) == EXPECTED_ROWS, f"expected {EXPECTED_ROWS} rows, got {len(rows)}")
    check(len(set(ids)) == len(ids), "duplicate evidence ids in matrix")
    check(set(ids) == set(mrows), "matrix ids != master evidence ids (invented or missing row)")
    check(ids == [r["id"] for r in master["recipeRows"]], "matrix row order must follow master evidence order")
    cids = [r["canonicalCandidateId"] for r in rows]
    check(len(set(cids)) == len(cids), "canonical candidate ids are not unique")
    for d in {r["doughStyle"] for r in master["recipeRows"]}:
        check(d in DOUGH_STYLE_TABLE, f"doughStyle not classified: {d!r}")
    for f in {r["sauceFamily"] for r in master["recipeRows"]}:
        check(f in SAUCE_FAMILY_TABLE, f"sauceFamily not classified: {f!r}")
    for rid in ROW_MECHANIC_EVIDENCE:
        check(rid in mrows, f"curated evidence references unknown row {rid}")
    for rid in list(SCOPE_QUESTIONS) + list(SOURCE_INCONSISTENCIES) + list(NAME_SPECIFICITY_GAPS):
        check(rid in mrows, f"ledger references unknown row {rid}")
    for nc in NAMING_CLUSTERS:
        for rid in nc["rowIds"]:
            check(rid in mrows, f"naming cluster {nc['id']} references unknown row {rid}")

    excluded_p0 = {e["id"] for e in deadlock["excludedRowsWithAmbiguousIngredients"]}
    unresolved_rows = set()
    for r in rows:
        m = mrows[r["evidenceId"]]
        check(r["nameJa"] == m["nameJa"], f"{r['evidenceId']}: nameJa altered")
        check(r["sauceBase"]["sauceFamily"] == m["sauceFamily"], f"{r['evidenceId']}: sauceFamily altered")
        check(r["dough"]["doughStyleRaw"] == m["doughStyle"], f"{r['evidenceId']}: doughStyle altered")
        ing = r["ingredients"]
        # every source token accounted for exactly once
        src_tokens = m["ingredientsJa"] if m["ingredientsJa"] is not None else m["ingredientsCanonical"]
        check([t["token"] for t in ing["tokenTrace"]] == list(src_tokens), f"{r['evidenceId']}: token trace does not mirror source")
        for t in ing["tokenTrace"]:
            if t["disposition"] in ("ambiguous", "needs_review"):
                check(t["canonicalId"] is None, f"{r['evidenceId']}: unresolved token {t['token']} silently canonicalized")
                check(t["token"] in [u["token"] for u in ing["unresolvedTokens"]], f"{r['evidenceId']}: unresolved token {t['token']} not preserved")
        if ing["unresolvedTokens"]:
            unresolved_rows.add(r["evidenceId"])
            check(ing["identityIngredientSet"] is None, f"{r['evidenceId']}: identity set present despite unresolved tokens")
        if ing["excludedNonIngredientTokens"]:
            check(ing["identityIngredientSet"] is None,
                  f"{r['evidenceId']}: identity set present despite excluded placeholder token(s) {ing['excludedNonIngredientTokens']}")
        check((ing["identityIngredientSet"] is not None) == ing["complete"],
              f"{r['evidenceId']}: identityIngredientSet presence disagrees with the complete flag")
        rep = r["currentFlowRepresentability"]
        req = r["requiredCapabilities"]
        check(rep in ("FULL", "PARTIAL", "NOT_REPRESENTABLE"), f"{r['evidenceId']}: bad representability")
        if rep == "FULL":
            check(not req, f"{r['evidenceId']}: FULL but has required capabilities")
            check(not r["phase0"]["requiresMechanicIdentity"], f"{r['evidenceId']}: Phase-0 mechanic-identity row marked FULL")
        if rep == "NOT_REPRESENTABLE":
            check(any(CAPABILITIES[c]["structural"] for c in req), f"{r['evidenceId']}: NOT_REPRESENTABLE without structural capability")
        if rep == "PARTIAL":
            check(not any(CAPABILITIES[c]["structural"] for c in req), f"{r['evidenceId']}: PARTIAL but has structural capability")
        for c in req:
            check(any(e["capability"] == c and e["strength"] in REQUIRED_STRENGTHS for e in r["mechanicEvidence"]),
                  f"{r['evidenceId']}: required capability {c} lacks required-strength evidence")
        check("SERVE_FORM" not in req, f"{r['evidenceId']}: SERVE_FORM must stay candidate-only")
        check(bool(r["blockers"]) == (r["productDecisionStatus"] == "BLOCKED_PRODUCT_DECISION"),
              f"{r['evidenceId']}: status/blocker mismatch")
    # Regression (Codex review on PR #189): colorado-mountain-pie lists the excluded placeholder
    # お好みの具材, so its resolved remainder {mozzarella, tomato-sauce} must never be treated as a
    # complete identity set nor enter the complete-set / same-set / collision analyses.
    colorado = by_row.get(PLACEHOLDER_REGRESSION_ROW)
    check(colorado is not None, f"regression row {PLACEHOLDER_REGRESSION_ROW} missing")
    if colorado is not None:
        check("お好みの具材" in colorado["ingredients"]["excludedNonIngredientTokens"],
              f"{PLACEHOLDER_REGRESSION_ROW}: placeholder token no longer recorded as excluded")
        check(colorado["ingredients"]["complete"] is False, f"{PLACEHOLDER_REGRESSION_ROW}: marked ingredient-complete")
        check(colorado["ingredients"]["identityIngredientSet"] is None,
              f"{PLACEHOLDER_REGRESSION_ROW}: placeholder row has a complete identity set")
        check(all(PLACEHOLDER_REGRESSION_ROW not in e["rowIds"] for e in out["extendedIdentitySetCollisions"]),
              f"{PLACEHOLDER_REGRESSION_ROW}: placeholder row entered extended identity-set collision analysis")
        check(all(PLACEHOLDER_REGRESSION_ROW not in g for g in out["summary"]["fullSignatureCollisionGroups"]),
              f"{PLACEHOLDER_REGRESSION_ROW}: placeholder row entered full-signature collision analysis")
        check(not any(i["type"] == "SAME_INGREDIENT_SET_AS_CATALOG_RECIPE" for i in colorado["reviewItems"]),
              f"{PLACEHOLDER_REGRESSION_ROW}: placeholder row got a same-set review item")
    # Every indeterminate input (unresolved token, excluded placeholder, unspecified sauce base)
    # keeps a row out of the complete identity sets and out of exact composition diffs.
    for r in rows:
        ing = r["ingredients"]
        expected_reasons = ([ "unresolved_tokens"] if ing["unresolvedTokens"] else []) \
            + (["excluded_placeholder_tokens"] if ing["excludedNonIngredientTokens"] else []) \
            + (["unspecified_sauce_base"] if r["sauceBase"]["status"] == "unspecified" else [])
        check(ing["incompleteReasons"] == expected_reasons, f"{r['evidenceId']}: incompleteReasons {ing['incompleteReasons']} != {expected_reasons}")
        check(ing["complete"] == (not expected_reasons), f"{r['evidenceId']}: complete flag ignores an indeterminate input")
        if r["sauceBase"]["status"] == "unspecified":
            check(ing["identityIngredientSet"] is None, f"{r['evidenceId']}: identity set present despite an unspecified sauce base")
    for c in out["compositionDecisionLedger"]:
        row = by_row[c["evidenceId"]]
        if not row["ingredients"]["complete"]:
            check(c["relation"].startswith("INDETERMINATE_"), f"{c['evidenceId']}: exact composition relation {c['relation']} on an incomplete row")
            check(c["pizzadbIdentitySet"] is None and c["addedByPizzaDb"] is None and c["missingFromPizzaDb"] is None,
                  f"{c['evidenceId']}: composition diff asserted on an incomplete row")
    for e in out["extendedIdentitySetCollisions"]:
        for rid in e["rowIds"]:
            check(by_row[rid]["ingredients"]["complete"], f"{rid}: incomplete row entered the extended identity-set analysis")
    teri = by_row.get(UNSPECIFIED_BASE_REGRESSION_ROW)
    check(teri is not None, f"regression row {UNSPECIFIED_BASE_REGRESSION_ROW} missing")
    if teri is not None:
        check(teri["sauceBase"]["status"] == "unspecified", f"{UNSPECIFIED_BASE_REGRESSION_ROW}: sauce base no longer unspecified (update the regression case)")
        check(teri["ingredients"]["identityIngredientSet"] is None, f"{UNSPECIFIED_BASE_REGRESSION_ROW}: unspecified-base row has a complete identity set")
        tc = [c for c in out["compositionDecisionLedger"] if c["evidenceId"] == UNSPECIFIED_BASE_REGRESSION_ROW]
        check(len(tc) == 1 and tc[0]["relation"] == "INDETERMINATE_UNSPECIFIED_SAUCE_BASE",
              f"{UNSPECIFIED_BASE_REGRESSION_ROW}: composition relation must be INDETERMINATE_UNSPECIFIED_SAUCE_BASE")
        check(len(tc) == 1 and tc[0]["missingFromPizzaDb"] is None,
              f"{UNSPECIFIED_BASE_REGRESSION_ROW}: teriyaki-sauce asserted missing although the base is unknown")
    # Same-set review is computed per row against that row's OWN declared correspondence.
    for e in out["extendedIdentitySetCollisions"]:
        for rid in e["rowIds"]:
            own = by_row[rid]["phase0"]["correspondsToExistingCatalogId"]
            exp = [c for c in e["catalogIdsWithSameSet"] if c != own]
            check(e["catalogIdsNotDeclaredByRow"].get(rid) == exp, f"{rid}: per-row undeclared catalog ids wrong in extended ledger")
            refs = [i["ref"] for i in by_row[rid]["reviewItems"] if i["type"] == "SAME_INGREDIENT_SET_AS_CATALOG_RECIPE"]
            check(refs == ([",".join(exp)] if exp else []), f"{rid}: same-set review ref {refs} != own undeclared {exp}")
    tre, ny = (by_row.get(x) for x in SAME_SET_REGRESSION_ROWS)
    check(tre is not None and ny is not None, "same-set regression rows missing")
    if tre is not None and ny is not None:
        tre_ref = [i["ref"] for i in tre["reviewItems"] if i["type"] == "SAME_INGREDIENT_SET_AS_CATALOG_RECIPE"]
        ny_ref = [i["ref"] for i in ny["reviewItems"] if i["type"] == "SAME_INGREDIENT_SET_AS_CATALOG_RECIPE"]
        check(tre["phase0"]["correspondsToExistingCatalogId"] is None and ny["phase0"]["correspondsToExistingCatalogId"] == "ny-style",
              "same-set regression premise changed (update the regression case)")
        check(len(tre_ref) == 1 and "ny-style" in tre_ref[0].split(","),
              "trenton-tomato-pie-pizzadb: 'ny-style' hidden from its same-set review by NY's declaration")
        check(len(ny_ref) == 1 and "ny-style" not in ny_ref[0].split(","),
              "ny-style-pizzadb: its own declared correspondence listed as undeclared")
    check(out["summary"]["rowsWithCompleteIdentityIngredientSet"]
          == sum(1 for r in rows if r["ingredients"]["complete"]),
          "rowsWithCompleteIdentityIngredientSet does not match the per-row complete flags")
    check(unresolved_rows == excluded_p0,
          f"unresolved-ingredient rows ({len(unresolved_rows)}) do not reconcile with Phase-0 excluded rows ({len(excluded_p0)}): "
          f"{sorted(unresolved_rows ^ excluded_p0)}")

    # collision ledger reconciles with Phase 0 and rows
    p0 = deadlock["exactIngredientSetCollisions"]["groups"]
    check(len(out["collisionLedger"]) == len(p0), "collision ledger does not cover every Phase-0 group")
    by_id = {r["evidenceId"]: r for r in rows}
    for c in out["collisionLedger"]:
        for mid in c["members"]:
            check(c["id"] in by_id[mid]["collisionRefs"], f"{mid}: missing collisionRef {c['id']}")
            if c["verdict"] != "DISTINGUISHED":
                check(any(b["type"] == "DISCOVERY_COLLISION" for b in by_id[mid]["blockers"]), f"{mid}: blocked collision not a blocker")
    # composition ledger reconciles
    corr_rows = sorted(r["evidenceId"] for r in rows if r["phase0"]["correspondsToExistingCatalogId"])
    check(corr_rows == sorted(c["evidenceId"] for c in out["compositionDecisionLedger"]), "composition ledger != correspondence rows")
    check(len(corr_rows) == master["coverage"]["rowsCorrespondingToExistingCatalogEntryCount"], "correspondence count differs from master coverage")
    for cat_id in PHASE0_CONFLICTS_SHIPPED + PHASE0_CONFLICTS_CANDIDATE:
        entries = [c for c in out["compositionDecisionLedger"] if c["catalogId"] == cat_id]
        check(entries and all(c["decisionStatus"] == "PRODUCT_DECISION_REQUIRED" for c in entries),
              f"Phase-0 composition conflict {cat_id} not preserved as PRODUCT_DECISION_REQUIRED")
    for c in out["compositionDecisionLedger"]:
        row = by_id[c["evidenceId"]]
        if c["decisionStatus"] == "PRODUCT_DECISION_REQUIRED":
            check(any(b["type"].startswith("COMPOSITION_CONFLICT") for b in row["blockers"]), f"{c['evidenceId']}: conflict not a row blocker")
    # mechanic-identity rows
    flagged = [r for r in rows if r["phase0"]["requiresMechanicIdentity"]]
    check(len(flagged) == master["coverage"]["rowsRequiringMechanicIdentityCount"], "Phase-0 mechanic-identity count mismatch")
    # summary recount
    s = out["summary"]
    check(sum(s["currentFlowRepresentability"].values()) == EXPECTED_ROWS, "representability counts do not sum to 172")
    check(sum(s["productDecisionStatus"].values()) == EXPECTED_ROWS, "status counts do not sum to 172")
    for cs in out["capabilityStats"]:
        check(cs["rowsRequiringCount"] == sum(1 for r in rows if cs["capability"] in r["requiredCapabilities"]),
              f"capability frequency mismatch for {cs['capability']}")
    return errors


def dumps(out):
    return json.dumps(out, ensure_ascii=False, indent=2, sort_keys=False) + "\n"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="validate committed outputs without writing")
    args = ap.parse_args()
    out = build()
    errors = validate(out)
    text = dumps(out)
    md = render_rows_md(out)
    if args.check:
        if not OUT_JSON.exists() or OUT_JSON.read_text(encoding="utf-8") != text:
            errors.append(f"{OUT_JSON.relative_to(ROOT)} differs from a fresh deterministic regeneration")
        if not OUT_ROWS_MD.exists() or OUT_ROWS_MD.read_text(encoding="utf-8") != md:
            errors.append(f"{OUT_ROWS_MD.relative_to(ROOT)} differs from a fresh deterministic regeneration")
    else:
        OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
        OUT_JSON.write_text(text, encoding="utf-8")
        OUT_ROWS_MD.write_text(md, encoding="utf-8")
        print(f"Wrote {OUT_JSON.relative_to(ROOT)}")
        print(f"Wrote {OUT_ROWS_MD.relative_to(ROOT)}")
    s = out["summary"]
    print(f"Rows: {s['rowCount']} (unique {s['uniqueEvidenceIds']})")
    print(f"Current-flow representability: {s['currentFlowRepresentability']}")
    print(f"Product-decision status: {s['productDecisionStatus']}")
    print(f"Proposed reusable capabilities: {s['proposedReusableCapabilitySet']}")
    print(f"Phase-0 collision groups: {s['phase0CollisionGroups']}")
    for cs in out["capabilityStats"]:
        print(f"  {cs['capability']:<20} required={cs['rowsRequiringCount']:<3} alone={cs['rowsUnlockedAloneCount']:<3} candidateOnly={cs['rowsCandidateOnlyCount']}")
    for st in out["recommendedImplementationOrder"]["steps"]:
        print(f"  order {st['step']}: {st['capability']:<20} +{st['newlyFullySatisfiedRows']} -> {st['cumulativeRowsWithAllRequiredCapabilities']}")
    if errors:
        print(f"\nFAIL: {len(errors)} validation error(s)")
        for e in errors:
            print("  - " + e)
        return 1
    print("\nAll matrix validations passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
