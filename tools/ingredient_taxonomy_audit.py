#!/usr/bin/env python3
"""
172 Recipe Ingredient Taxonomy Fresh Audit (Discovery Hint 4.0 Lane C, parent Issue #253).
Docs/data-only tooling -- NOT part of src/**, NOT wired into CI, NOT a production authority.

It rebuilds the ingredient universe from the existing repo evidence and scores a PROPOSED
hierarchical, multi-axis taxonomy against it. The PROPOSED classification below is written by
hand, one row per ingredient. Each row carries a status. PROPOSED means the class follows from
the canonical ingredient identity alone. NEEDS_REVIEW means a boundary call that a human must
make. UNKNOWN means there is no canonical id yet. Nothing here is promoted to src/**. DH4-1
(PR #254, src/data/ingredientTaxonomy.ts) is read as input only and is never changed.

Inputs (read-only):
  src/data/ingredients.ts, src/data/recipes.ts                        runtime 29 / 25
  data/recipes/ingredient_master_catalog.json                         62-row catalog v2
  docs/design/data/TETO_PROGRESSION2_PHASE34_INGREDIENT-UNLOCK-MATRIX.json   105 universe
  docs/design/data/TETO_PROGRESSION2_PHASE2_UNLOCK-MATRIX.json        101-target pool
  docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json  172 rows (Phase 1)
  tools/progression2_ingredient_canonicalizer.py                       canonicalization tables
  PR #254 head (git object) src/data/ingredientTaxonomy.ts             DH4-1 families

Usage:
  python3 tools/ingredient_taxonomy_audit.py            # writes the audit JSON
  python3 tools/ingredient_taxonomy_audit.py --check    # rebuilds and fails on byte drift
"""
import argparse
import itertools
import json
import math
import re
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
import progression2_ingredient_canonicalizer as CANON  # noqa: E402

OUT = ROOT / "docs/reports/data/TETO_INGREDIENT-TAXONOMY_172_FRESH-AUDIT.json"
DH4_1_REF = "origin/claude/dh4-1-deduction-pure-layer"
DH4_1_HEAD = "057e387b8ca065cb4f2e8c438fa4734a0fd2c40d"
AUDITED_MAIN = "22658f7f2313264b686d299ea9fc11ba8679e8e5"

# ---------------------------------------------------------------------------------------------
# Layer definitions (PROPOSED, not authority).
# L1 group  : the coarse fallback. These are DH4-1's 4 groups, kept as they are.
# L2 family : the player-facing attribute. These are DH4-1's 7 family ids, kept as they are.
# L3 subfam : internal only. It is NEVER shown until a population-level k gate passes (§8).
# The groups, families and labels are copied from DH4-1 so the audit measures *that* table.
# ---------------------------------------------------------------------------------------------
GROUPS = {"protein": "肉・魚介", "produce": "野菜・果物", "aroma": "香り・薬味", "other": "その他"}
FAMILIES = {
    "meat": ("protein", "肉"),
    "seafood": ("protein", "魚介"),
    "vegetable": ("produce", "野菜・きのこ"),
    "fruit": ("produce", "果物"),
    "herb": ("aroma", "ハーブ・香味"),
    "spice": ("aroma", "スパイス・薬味"),
    "other": ("other", "その他"),
}
SUBFAMILIES = {
    "meat.cured": "加工肉（ハム・ソーセージ・サラミ等）",
    "meat.fresh": "精肉（牛・豚・羊）",
    "meat.poultry": "鶏・鴨",
    "seafood.fish": "魚",
    "seafood.shellfish": "貝・エビ・イカ",
    "seafood.roe": "魚卵",
    "vegetable.fruiting": "実野菜（トマト・ナス・ピーマン等）",
    "vegetable.leafy": "葉野菜",
    "vegetable.allium": "ねぎ類",
    "vegetable.root": "根菜・いも",
    "vegetable.stem-flower": "茎・花の野菜",
    "vegetable.mushroom": "きのこ",
    "vegetable.legume": "豆",
    "vegetable.pickled": "漬物・発酵野菜",
    "fruit.citrus": "柑橘",
    "fruit.tropical": "南国の果物",
    "fruit.berry": "ベリー",
    "fruit.orchard": "りんご・いちじく等",
    "herb.leaf": "葉のハーブ",
    "herb.allium": "香味（にんにく）",
    "spice.dried": "乾燥スパイス・塩",
    "spice.chili": "とうがらし系",
    "spice.condiment": "薬味・つけあわせ",
    "other.egg": "たまご",
    "other.nut-seed": "ナッツ・種",
    "other.sweet": "甘いもの",
    "other.starch": "パン粉・ポテト・チップス",
    "other.dairy": "乳製品（チーズ以外）",
    "other.seaweed": "海藻",
    # sauce / cheese categories: internal subfamilies only (DH4-1 answers them at category level)
    "sauce.tomato": "トマト系ソース",
    "sauce.oil-fat": "オイル・バター",
    "sauce.cream-dairy": "クリーム・乳系ソース",
    "sauce.sweet": "甘いソース",
    "sauce.paste": "ペースト（ペスト・ごま・ナッツ）",
    "sauce.asian-savory": "和・アジアのたれ",
    "sauce.condiment": "調味料・ドレッシング",
    "cheese.fresh": "フレッシュチーズ",
    "cheese.soft": "ソフト・白カビ",
    "cheese.semi": "セミハード",
    "cheese.hard": "ハード（粉チーズ系）",
    "cheese.blue": "青カビ",
    "cheese.processed": "加工・代替チーズ",
}

# ---------------------------------------------------------------------------------------------
# PROPOSED classification, one row per canonical id.
# (category, family|None, subfamily, flavorTags, status, confidence, note)
#  - category: the game slot (sauce/cheese/topping); its SOURCE is resolved separately (evidence
#    beats proposal).
#  - family is None for sauce/cheese (DH4-1 answers those at category level).
#  - status: PROPOSED (the identity is evident from the canonical name) | NEEDS_REVIEW
#    (a boundary call; see the note).
#  - flavorTags: a PROPOSED flavor/property axis ("spicy", "sweet", "salty-cured"). It is
#    internal only and is used here only to measure intersection risk.
# ---------------------------------------------------------------------------------------------
P, R = "PROPOSED", "NEEDS_REVIEW"
H, M, L = "high", "medium", "low"
CLASSIFICATION = {
    # --- meat ------------------------------------------------------------------------------
    "sausage": ("topping", "meat", "meat.cured", [], P, H, ""),
    "pepperoni": ("topping", "meat", "meat.cured", ["spicy"], P, H, ""),
    "bacon": ("topping", "meat", "meat.cured", ["salty-cured"], P, H, ""),
    "ham": ("topping", "meat", "meat.cured", [], P, H, ""),
    "salami": ("topping", "meat", "meat.cured", ["salty-cured"], P, H, ""),
    "spicy-salami": ("topping", "meat", "meat.cured", ["spicy"], R, M, "Near-alias of salami (サラミ（ピリ辛）). As a separate id, the subfamily meat.cured is fine, but the two names differ only in a flavor. A flavor hint would then isolate it."),
    "wurstel": ("topping", "meat", "meat.cured", [], R, M, "ウインナー vs sausage (ソーセージ) vs hot-dog: three sausage-like ids. The canonicalization relationship needs an Owner call."),
    "prosciutto-crudo": ("topping", "meat", "meat.cured", ["salty-cured"], P, H, "Also a post-bake finishing ingredient in catalog recipes. That is timing (recipe×ingredient), not identity."),
    "speck": ("topping", "meat", "meat.cured", ["salty-cured"], P, H, "Catalog-only (not in the 172 or 105 evidence)."),
    "nduja": ("topping", "meat", "meat.cured", ["spicy"], R, M, "The catalog gives it placement=spread (a spreadable salami). Its identity is meat, but its use is a spread. Keep the family meat and put the spread in role/technique."),
    "hot-dog": ("topping", "meat", "meat.cured", [], R, L, "Canonicalizer flag prepared_dish_composite. It may be a dish (sausage + bun), not an ingredient."),
    "liver-pate": ("topping", "meat", "meat.cured", [], R, L, "A paste made from liver. Is it a meat topping or a spread condiment? An Owner call."),
    "chicken": ("topping", "meat", "meat.poultry", [], P, H, ""),
    "chicken-tikka": ("topping", "meat", "meat.poultry", ["spicy"], R, L, "Canonicalizer flag prepared_dish_composite (a marinated, cooked dish)."),
    "peking-duck": ("topping", "meat", "meat.poultry", [], R, L, "Canonicalizer flag prepared_dish_composite."),
    "beef": ("topping", "meat", "meat.fresh", [], R, M, "Its relationship to steak and ground-beef is unresolved (canonicalizer note on 牛肉)."),
    "steak": ("topping", "meat", "meat.fresh", [], R, M, "Catalog-only. It may be a beef alias."),
    "ground-beef": ("topping", "meat", "meat.fresh", [], R, M, "Ambiguity group with the ひき肉 token (canonicalizer AMBIGUOUS_TABLE)."),
    "pork": ("topping", "meat", "meat.fresh", [], P, H, ""),
    "lamb": ("topping", "meat", "meat.fresh", [], P, H, ""),
    # --- seafood ---------------------------------------------------------------------------
    "anchovy": ("topping", "seafood", "seafood.fish", ["salty-cured"], P, H, ""),
    "tuna": ("topping", "seafood", "seafood.fish", [], P, H, ""),
    "salmon": ("topping", "seafood", "seafood.fish", [], P, H, ""),
    "sardine": ("topping", "seafood", "seafood.fish", [], P, H, ""),
    "salt-cod": ("topping", "seafood", "seafood.fish", ["salty-cured"], P, H, ""),
    "eel": ("topping", "seafood", "seafood.fish", ["sweet"], P, H, "Its 172 evidence has an unresolved mid/post-bake timing. That is timing, not family."),
    "whitebait": ("topping", "seafood", "seafood.fish", [], P, H, ""),
    "bonito-flakes": ("topping", "seafood", "seafood.fish", [], R, M, "Dried fish flakes used as a garnish (かつお節). Is it seafood or spice.condiment (薬味)? An Owner call."),
    "clam": ("topping", "seafood", "seafood.shellfish", [], P, H, ""),
    "mussel": ("topping", "seafood", "seafood.shellfish", [], P, H, ""),
    "shrimp": ("topping", "seafood", "seafood.shellfish", [], P, H, ""),
    "squid": ("topping", "seafood", "seafood.shellfish", [], P, H, "A cephalopod, grouped with shellfish as 貝・エビ・イカ."),
    "salmon-roe": ("topping", "seafood", "seafood.roe", [], P, H, ""),
    "cod-roe": ("topping", "seafood", "seafood.roe", [], P, H, ""),
    "mentaiko": ("topping", "seafood", "seafood.roe", ["spicy"], R, M, "Seasoned cod roe (明太子). It is a near-alias of cod-roe (たらこ), so an Owner call is needed on whether they stay two ids."),
    "nori": ("topping", "other", "other.seaweed", [], R, L, "Seaweed is not 魚介 in everyday Japanese. Candidates: seafood, other, or spice.condiment (a garnish). An Owner call."),
    # --- vegetable -------------------------------------------------------------------------
    "fresh-tomato": ("topping", "vegetable", "vegetable.fruiting", [], P, H, ""),
    "cherry-tomato": ("topping", "vegetable", "vegetable.fruiting", [], P, H, ""),
    "eggplant": ("topping", "vegetable", "vegetable.fruiting", [], P, H, ""),
    "zucchini": ("topping", "vegetable", "vegetable.fruiting", [], P, H, ""),
    "bell-pepper": ("topping", "vegetable", "vegetable.fruiting", [], P, H, ""),
    "green-pepper": ("topping", "vegetable", "vegetable.fruiting", [], P, H, ""),
    "okra": ("topping", "vegetable", "vegetable.fruiting", [], P, H, ""),
    "cucumber": ("topping", "vegetable", "vegetable.fruiting", [], P, H, ""),
    "corn": ("topping", "vegetable", "vegetable.fruiting", ["sweet"], P, M, "A grain, but a vegetable topping in everyday use."),
    "black-olive": ("topping", "vegetable", "vegetable.fruiting", ["salty-cured"], R, M, "DH4-1 puts it in vegetable. Botanically it is a fruit, and it is used as a brined condiment. オリーブ is only a likely_alias to it."),
    "avocado": ("topping", "vegetable", "vegetable.fruiting", [], R, M, "Is it a vegetable or a fruit (果物) to Japanese players? An Owner call."),
    "jalapeno": ("topping", "spice", "spice.chili", ["spicy"], R, M, "A chili pepper. Is it a vegetable (sliced pepper) or スパイス・薬味? An Owner call."),
    "aji-amarillo": ("topping", "spice", "spice.chili", ["spicy"], R, L, "A Peruvian chili pepper. It may be a paste. Its form is unknown."),
    "onion": ("topping", "vegetable", "vegetable.allium", [], P, H, ""),
    "green-onion": ("topping", "vegetable", "vegetable.allium", [], R, M, "青ねぎ is also a 薬味 (garnish) in Japanese use. Is it vegetable or spice.condiment?"),
    "arugula": ("topping", "vegetable", "vegetable.leafy", [], P, H, "Post-bake in catalog recipes. That is timing, not identity."),
    "spinach": ("topping", "vegetable", "vegetable.leafy", [], P, H, ""),
    "lettuce": ("topping", "vegetable", "vegetable.leafy", [], P, H, ""),
    "cabbage": ("topping", "vegetable", "vegetable.leafy", [], P, H, ""),
    "red-cabbage": ("topping", "vegetable", "vegetable.leafy", [], R, M, "A near-alias of cabbage. Does it stay a separate id?"),
    "radicchio": ("topping", "vegetable", "vegetable.leafy", [], P, H, ""),
    "chicory": ("topping", "vegetable", "vegetable.leafy", [], P, M, ""),
    "puntarelle": ("topping", "vegetable", "vegetable.leafy", [], R, M, "A chicory variety. Near-alias of chicory."),
    "friarielli": ("topping", "vegetable", "vegetable.leafy", [], P, M, "A regional (Naples) leafy green."),
    "potato": ("topping", "vegetable", "vegetable.root", [], P, H, ""),
    "sweet-potato": ("topping", "vegetable", "vegetable.root", ["sweet"], P, H, ""),
    "carrot": ("topping", "vegetable", "vegetable.root", [], P, H, ""),
    "daikon": ("topping", "vegetable", "vegetable.root", [], P, H, ""),
    "asparagus": ("topping", "vegetable", "vegetable.stem-flower", [], P, H, ""),
    "artichoke": ("topping", "vegetable", "vegetable.stem-flower", [], P, H, ""),
    "cauliflower": ("topping", "vegetable", "vegetable.stem-flower", [], P, H, ""),
    "celery": ("topping", "vegetable", "vegetable.stem-flower", [], P, H, ""),
    "fennel": ("topping", "vegetable", "vegetable.stem-flower", [], R, M, "Fennel bulb (a vegetable) or fennel seed/frond (a herb/spice)? The evidence names only フェンネル."),
    "palm-heart": ("topping", "vegetable", "vegetable.stem-flower", [], P, M, "A regional (Brazil) vegetable."),
    "mushroom": ("topping", "vegetable", "vegetable.mushroom", [], P, H, "DH4-1 merges きのこ into 野菜・きのこ."),
    "porcini": ("topping", "vegetable", "vegetable.mushroom", [], P, H, ""),
    "truffle": ("topping", "vegetable", "vegetable.mushroom", [], R, M, "A mushroom by identity, but a post-bake luxury finish in use. Keep the family vegetable and put the finish in timing/technique."),
    "baked-beans": ("topping", "vegetable", "vegetable.legume", ["sweet"], R, M, "A prepared dish (beans in sauce)."),
    "natto": ("topping", "vegetable", "vegetable.legume", [], R, M, "Fermented soybeans. Is it a vegetable (legume) or other? It also has mid-bake timing evidence."),
    "kimchi": ("topping", "vegetable", "vegetable.pickled", ["spicy"], R, M, "A fermented vegetable. Is it a vegetable or spice.condiment?"),
    "sauerkraut": ("topping", "vegetable", "vegetable.pickled", [], R, M, "A fermented vegetable. Is it a vegetable or spice.condiment?"),
    "pickles": ("topping", "vegetable", "vegetable.pickled", [], R, M, "A pickled vegetable. Is it a vegetable or spice.condiment?"),
    # --- fruit -----------------------------------------------------------------------------
    "pineapple": ("topping", "fruit", "fruit.tropical", ["sweet"], P, H, ""),
    "banana": ("topping", "fruit", "fruit.tropical", ["sweet"], P, H, ""),
    "kiwi": ("topping", "fruit", "fruit.tropical", ["sweet"], P, H, ""),
    "lemon": ("topping", "fruit", "fruit.citrus", [], P, H, "It can also be a zest or finishing garnish. That is timing, not identity."),
    "lime": ("topping", "fruit", "fruit.citrus", [], P, H, ""),
    "orange": ("topping", "fruit", "fruit.citrus", ["sweet"], P, H, ""),
    "apple": ("topping", "fruit", "fruit.orchard", ["sweet"], P, H, ""),
    "fig": ("topping", "fruit", "fruit.orchard", ["sweet"], P, H, "Catalog-only."),
    "pomegranate": ("topping", "fruit", "fruit.orchard", ["sweet"], P, M, ""),
    "blueberry": ("topping", "fruit", "fruit.berry", ["sweet"], P, H, ""),
    "strawberry": ("topping", "fruit", "fruit.berry", ["sweet"], P, H, ""),
    # --- herb ------------------------------------------------------------------------------
    "basil": ("topping", "herb", "herb.leaf", [], P, H, ""),
    "oregano": ("topping", "herb", "herb.leaf", [], P, H, ""),
    "rosemary": ("topping", "herb", "herb.leaf", [], P, H, ""),
    "parsley": ("topping", "herb", "herb.leaf", [], P, H, ""),
    "cilantro": ("topping", "herb", "herb.leaf", [], P, H, "コリアンダー is a likely_alias."),
    "mint": ("topping", "herb", "herb.leaf", [], P, H, ""),
    "shiso": ("topping", "herb", "herb.leaf", [], P, H, "大葉 is a likely_alias (same plant)."),
    "garlic": ("topping", "herb", "herb.allium", [], R, M, "DH4-1 puts it in herb (ハーブ・香味). It could also be vegetable.allium with onion. The runtime herb family relies on it."),
    # --- spice / condiment -----------------------------------------------------------------
    "capers": ("topping", "spice", "spice.condiment", ["salty-cured"], R, M, "DH4-1 puts it in spice. It is a pickled flower bud. Is it spice.condiment or vegetable.pickled?"),
    "chili-powder": ("topping", "spice", "spice.chili", ["spicy"], P, H, ""),
    "paprika-powder": ("topping", "spice", "spice.dried", [], P, H, ""),
    "cumin": ("topping", "spice", "spice.dried", [], P, H, ""),
    "cinnamon": ("topping", "spice", "spice.dried", ["sweet"], P, H, ""),
    "sansho-pepper": ("topping", "spice", "spice.dried", ["spicy"], P, H, ""),
    "zaatar": ("topping", "spice", "spice.dried", [], R, M, "A herb-and-sesame blend. Is it spice or herb?"),
    "rock-salt": ("topping", "spice", "spice.dried", ["salty-cured"], R, M, "Salt is a seasoning, not a spice. The label スパイス・薬味 may not read naturally for it."),
    "wasabi": ("topping", "spice", "spice.condiment", ["spicy"], R, M, "Post-bake in its 172 evidence. Its category (topping vs spread) is also unresolved."),
    "umeboshi-paste": ("topping", "spice", "spice.condiment", [], R, L, "Canonicalizer flag false_friend_not_meat. It is a paste. Its category (topping vs spread) is unresolved."),
    # --- other -----------------------------------------------------------------------------
    "egg": ("topping", "other", "other.egg", [], P, H, "DH4-1 puts egg in その他 so the label is never the name."),
    "almond": ("topping", "other", "other.nut-seed", [], P, H, ""),
    "walnut": ("topping", "other", "other.nut-seed", [], P, H, ""),
    "pine-nuts": ("topping", "other", "other.nut-seed", [], P, H, ""),
    "white-sesame": ("topping", "other", "other.nut-seed", [], P, H, ""),
    "sunflower-seeds": ("topping", "other", "other.nut-seed", [], P, H, ""),
    "chocolate": ("topping", "other", "other.sweet", ["sweet"], P, H, ""),
    "marshmallow": ("topping", "other", "other.sweet", ["sweet"], P, H, ""),
    "graham-cracker": ("topping", "other", "other.sweet", ["sweet"], P, H, "Post-bake in its 172 evidence."),
    "powdered-sugar": ("topping", "other", "other.sweet", ["sweet"], P, H, "A post-bake finish in the catalog."),
    "mochi": ("topping", "other", "other.starch", [], R, M, "Is it a sweet or a starch? The evidence is a savory Japanese fusion pizza (unverified)."),
    "condensed-milk": ("topping", "other", "other.dairy", ["sweet"], R, M, "A liquid. Its category (topping vs spread) is unresolved."),
    "sour-cream": ("topping", "other", "other.dairy", [], R, M, "Cheese vs dairy vs spread. Its category is unresolved."),
    "french-fries": ("topping", "other", "other.starch", [], R, M, "Potato-derived and prepared. Is it vegetable.root or other.starch? Mid-bake in its 172 evidence."),
    "tortilla-chips": ("topping", "other", "other.starch", [], P, M, "Post-bake in its 172 evidence."),
    "breadcrumb": ("topping", "other", "other.starch", [], P, H, "Catalog-only."),
    # --- cheese (category = cheese; family None) ------------------------------------------
    "mozzarella": ("cheese", None, "cheese.fresh", [], P, H, ""),
    "burrata": ("cheese", None, "cheese.fresh", [], P, H, ""),
    "ricotta": ("cheese", None, "cheese.fresh", [], P, H, ""),
    "cream-cheese": ("cheese", None, "cheese.fresh", [], P, H, ""),
    "feta": ("cheese", None, "cheese.fresh", ["salty-cured"], P, H, ""),
    "goat-cheese": ("cheese", None, "cheese.fresh", [], P, M, ""),
    "cheese-curd": ("cheese", None, "cheese.fresh", [], P, M, ""),
    "paneer": ("cheese", None, "cheese.fresh", [], P, M, ""),
    "mascarpone": ("cheese", None, "cheese.fresh", ["sweet"], R, M, "Catalog-only and dessert-only. Is it a cheese, or cream (other.dairy)?"),
    "brie": ("cheese", None, "cheese.soft", [], P, H, ""),
    "catupiry": ("cheese", None, "cheese.processed", [], R, M, "A creamy processed cheese, often a spread. Its category needs a check."),
    "fontina": ("cheese", None, "cheese.semi", [], P, H, ""),
    "caciocavallo": ("cheese", None, "cheese.semi", [], P, H, ""),
    "provolone": ("cheese", None, "cheese.semi", [], P, H, "Catalog-only. プロヴェルチーズ is kept distinct (ambiguous)."),
    "halloumi": ("cheese", None, "cheese.semi", [], P, H, ""),
    "swiss-cheese": ("cheese", None, "cheese.semi", [], P, H, ""),
    "cheddar": ("cheese", None, "cheese.semi", [], P, H, ""),
    "brick-cheese": ("cheese", None, "cheese.semi", [], P, M, "A regional (Detroit) cheese."),
    "parmigiano": ("cheese", None, "cheese.hard", [], P, H, ""),
    "grana-padano": ("cheese", None, "cheese.hard", [], P, H, ""),
    "pecorino": ("cheese", None, "cheese.hard", ["salty-cured"], P, H, ""),
    "ricotta-salata": ("cheese", None, "cheese.hard", ["salty-cured"], P, M, ""),
    "cotija": ("cheese", None, "cheese.hard", ["salty-cured"], P, M, ""),
    "gorgonzola": ("cheese", None, "cheese.blue", [], P, H, ""),
    "cashew-cheese": ("cheese", None, "cheese.processed", [], R, M, "A plant-based substitute. Is it a cheese (category) or other.nut-seed? An Owner call."),
    # --- sauce (category = sauce; family None) ---------------------------------------------
    "tomato-sauce": ("sauce", None, "sauce.tomato", [], P, H, "It is also a post-bake layer in one catalog recipe. That is timing, not identity."),
    "salsa": ("sauce", None, "sauce.tomato", ["spicy"], P, M, ""),
    "curry-ketchup": ("sauce", None, "sauce.tomato", ["spicy"], R, M, "Is it tomato or condiment? A generic カレーソース token is ambiguous with it."),
    "bbq-sauce": ("sauce", None, "sauce.condiment", ["sweet"], P, H, ""),
    "olive-oil": ("sauce", None, "sauce.oil-fat", [], P, H, ""),
    "chili-oil": ("sauce", None, "sauce.oil-fat", ["spicy"], P, H, "Catalog-only. It is in the chili naming-ambiguity group."),
    "melted-butter": ("sauce", None, "sauce.oil-fat", [], R, M, "Canonicalizer flag sauce_or_condiment."),
    "pesto": ("sauce", None, "sauce.paste", [], P, H, ""),
    "tahini": ("sauce", None, "sauce.paste", [], P, H, ""),
    "peanut-sauce": ("sauce", None, "sauce.paste", ["sweet"], P, M, ""),
    "fresh-cream-sauce": ("sauce", None, "sauce.cream-dairy", [], P, H, ""),
    "fromage-blanc-sauce": ("sauce", None, "sauce.cream-dairy", [], P, H, "A generic ホワイトソース token is ambiguous with it."),
    "yogurt-sauce": ("sauce", None, "sauce.cream-dairy", [], P, H, ""),
    "blue-cheese-dressing": ("sauce", None, "sauce.cream-dairy", [], P, M, ""),
    "mayo": ("sauce", None, "sauce.condiment", [], P, H, "A post-bake drizzle in the catalog. That is timing."),
    "honey": ("sauce", None, "sauce.sweet", ["sweet"], P, H, "A post-bake drizzle in the catalog. That is timing."),
    "nutella-spread": ("sauce", None, "sauce.sweet", ["sweet"], P, H, ""),
    "soy-sauce": ("sauce", None, "sauce.asian-savory", [], P, H, ""),
    "miso-sauce": ("sauce", None, "sauce.asian-savory", [], P, H, ""),
    "yakiniku-sauce": ("sauce", None, "sauce.asian-savory", ["sweet"], P, H, ""),
    "sweet-bean-sauce": ("sauce", None, "sauce.asian-savory", ["sweet"], P, H, ""),
    "doubanjiang": ("sauce", None, "sauce.asian-savory", ["spicy"], P, H, ""),
    "teriyaki-sauce": ("sauce", None, "sauce.asian-savory", ["sweet"], P, H, "Catalog-only."),
    "okonomiyaki-sauce": ("sauce", None, "sauce.asian-savory", ["sweet"], P, H, ""),
    "gravy-sauce": ("sauce", None, "sauce.condiment", [], P, M, ""),
    "kebab-sauce": ("sauce", None, "sauce.condiment", [], R, L, "Its composition is regional and unspecified (a yogurt or garlic sauce?)."),
    "buffalo-sauce": ("sauce", None, "sauce.condiment", ["spicy"], P, H, "A post-bake finish in the catalog."),
    "mustard": ("sauce", None, "sauce.condiment", ["spicy"], R, M, "Canonicalizer flag sauce_or_condiment. Is it a spread or spice.condiment?"),
    "yuzu-kosho": ("sauce", None, "sauce.condiment", ["spicy"], R, M, "Canonicalizer flag sauce_or_condiment. It is a paste 薬味. Is it a spread or spice.condiment?"),
    "balsamic-vinegar": ("sauce", None, "sauce.condiment", [], R, M, "Canonicalizer flag sauce_or_condiment."),
    "chutney": ("sauce", None, "sauce.condiment", ["sweet"], R, M, "Canonicalizer flag sauce_or_condiment."),
}

# The 13 unresolved 172 tokens (canonicalizer ambiguous). They have no id, so their family is only
# indicative. They are never usable at runtime until canonicalized.
UNRESOLVED_TOKEN_CLASS = {
    "肉": ("topping", "meat", None, "The family is certain (meat), but the id is unknown (generic_unspecified)."),
    "ひき肉": ("topping", "meat", "meat.fresh", "The family is certain. Is it ground-beef or pork/mixed?"),
    "スパイシーソーセージ": ("topping", "meat", "meat.cured", "The family is certain. Is it the same id as sausage or spicy-salami?"),
    "チーズ": ("cheese", None, None, "Cheese of an unknown variety (generic_unspecified)."),
    "プロヴェルチーズ": ("cheese", None, "cheese.processed", "Kept distinct from provolone."),
    "チーズソース": ("sauce", None, "sauce.cream-dairy", "sauce_not_topping."),
    "ホワイトソース": ("sauce", None, "sauce.cream-dairy", "Is it the same as fromage-blanc-sauce or a béchamel?"),
    "カレーソース": ("sauce", None, None, "Is it the same as curry-ketchup?"),
    "唐辛子": ("topping", "spice", "spice.chili", "Its form is unknown (fresh, dried or flakes). It is in the chili ambiguity group."),
    "赤唐辛子": ("topping", "spice", "spice.chili", "The chili ambiguity group."),
    "青唐辛子": ("topping", "spice", "spice.chili", "The chili ambiguity group. It may be a vegetable if it is fresh."),
    "青のり": ("topping", "other", "other.seaweed", "Related to nori, and kept distinct."),
    "ナッツ": ("topping", "other", "other.nut-seed", "Nuts of an unknown variety (generic_unspecified)."),
}

# Axis boundary (Audit E/G): the axes an ingredient row may carry and the axes it must not carry.
AXES = {
    "identity": {"owner": "ingredient catalog", "examples": ["family", "subfamily"], "inIngredientRow": True},
    "flavorProperty": {"owner": "ingredient catalog (optional, internal)", "examples": ["spicy", "sweet", "salty-cured"], "inIngredientRow": True},
    "gameCategory": {"owner": "ingredient catalog (existing field)", "examples": ["sauce", "cheese", "topping"], "inIngredientRow": True},
    "role": {"owner": "recipe x ingredient (Cooking Steps / Technique Discovery)", "examples": ["base spread", "second spread", "scatter", "garnish"], "inIngredientRow": False},
    "timing": {"owner": "recipe x ingredient (Cooking Steps / Technique Discovery)", "examples": ["pre-bake", "mid-bake", "post-bake"], "inIngredientRow": False},
    "preparationForm": {"owner": "recipe x ingredient or technique", "examples": ["sliced", "grated", "paste", "drizzle"], "inIngredientRow": False},
}


# ---------------------------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------------------------
def load_json(rel):
    with open(ROOT / rel, encoding="utf-8") as f:
        return json.load(f)


def runtime_ingredients():
    src = (ROOT / "src/data/ingredients.ts").read_text(encoding="utf-8")
    return {m[0]: {"category": m[1], "nameJa": m[2]}
            for m in re.findall(r'id: "([^"]+)",\s*category: "(\w+)",\s*nameJa: "([^"]+)"', src)}


def runtime_recipes():
    src = (ROOT / "src/data/recipes.ts").read_text(encoding="utf-8")
    body = src[src.index("export const RECIPES"):]
    out = {}
    for rid, block in re.findall(r'\{\s*id: "([^"]+)",(.*?)bakeTarget', body, re.S):
        out[rid] = sorted(set(re.findall(r'ingredientId: "([^"]+)"', block)))
    return out


def dh4_1_families():
    try:
        src = subprocess.run(["git", "show", f"{DH4_1_HEAD}:src/data/ingredientTaxonomy.ts"], cwd=ROOT,
                             capture_output=True, text=True, check=True).stdout
    except subprocess.CalledProcessError:
        src = subprocess.run(["git", "show", f"{DH4_1_REF}:src/data/ingredientTaxonomy.ts"], cwd=ROOT,
                             capture_output=True, text=True, check=True).stdout
    rows = src[src.index("TOPPING_FAMILY_ROWS"):]
    rows = rows[:rows.index("];")]
    return dict(re.findall(r'\["([^"]+)", "(\w+)"\]', rows))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    audit = build()
    text = json.dumps(audit, ensure_ascii=False, indent=1) + "\n"
    if args.check:
        if not OUT.exists() or OUT.read_text(encoding="utf-8") != text:
            print("DRIFT: regenerate with python3 tools/ingredient_taxonomy_audit.py", file=sys.stderr)
            sys.exit(1)
        print("OK: no drift")
        return
    OUT.write_text(text, encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}")


# ---------------------------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------------------------
def build():
    rt_ing = runtime_ingredients()
    rt_rec = runtime_recipes()
    dh4 = dh4_1_families()
    catalog = {i["id"]: i for i in load_json("data/recipes/ingredient_master_catalog.json")["ingredients"]}
    p34 = load_json("docs/design/data/TETO_PROGRESSION2_PHASE34_INGREDIENT-UNLOCK-MATRIX.json")
    p2 = load_json("docs/design/data/TETO_PROGRESSION2_PHASE2_UNLOCK-MATRIX.json")
    m172 = load_json("docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json")

    u105 = sorted(r["ingredientId"] for r in p34["rows"] if r["kind"] == "ingredient")
    u105_set = set(u105)
    spread_ids = set(m172["spreadLayerIngredientIds"])

    # 101-target pool (SHIPPED_KEEP profile, the recommended Phase 2/3/4 pool)
    pool101 = {}
    for t in p2["targets"]["SHIPPED_KEEP"]:
        pool101[t["targetId"]] = sorted(x for x in t["items"] if ":" not in x)

    # 172 rows: identity set when complete, else canonical ids (+ unresolved tokens)
    rows172 = {}
    tokens_by_id = defaultdict(Counter)
    unresolved_rows = defaultdict(list)
    post_bake = defaultdict(set)
    mid_bake = defaultdict(set)
    caps172 = {}
    for r in m172["rows"]:
        ing = r["ingredients"]
        ids = sorted(set(ing["identityIngredientSet"] or ing["canonicalIngredientIds"]))
        rows172[r["evidenceId"]] = {"ids": ids, "complete": bool(ing["complete"]),
                                   "unresolved": [t["token"] for t in ing["unresolvedTokens"]]}
        caps172[r["evidenceId"]] = sorted(set(r["requiredCapabilities"]))
        for t in ing["tokenTrace"]:
            if t.get("canonicalId") and not re.fullmatch(r"[a-z0-9-]+", t["token"]):
                tokens_by_id[t["canonicalId"]][t["token"]] += 1
        for t in ing["unresolvedTokens"]:
            unresolved_rows[t["token"]].append(r["evidenceId"])
        for f in r["postBakeFinish"] or []:
            for x in f.get("ingredients", []):
                (mid_bake if "mid_bake" in f["mode"] and "post" not in f["mode"] else post_bake)[x].add(r["evidenceId"])

    ids172 = sorted({i for v in rows172.values() for i in v["ids"]})
    cnt172 = Counter(i for v in rows172.values() for i in v["ids"])
    cnt101 = Counter(i for v in pool101.values() for i in v)
    cntrt = Counter(i for v in rt_rec.values() for i in v)
    universe = sorted(set(ids172) | u105_set | set(rt_ing) | set(catalog))

    # --- names -------------------------------------------------------------------------
    reverse = defaultdict(list)
    for ja, cid in CANON.GENUINELY_NEW_REGISTRY.items():
        reverse[cid].append(ja)
    for ja, cid in CANON.PHASE0B_NEW_INGREDIENT_NAMES.items():
        reverse[cid].append(ja)
    for ja, (cid, _) in CANON.LIKELY_ALIAS_TABLE.items():
        reverse[cid].append(ja)

    missing = [i for i in universe if i not in CLASSIFICATION]
    if missing:
        raise SystemExit(f"unclassified ids (add a row, never guess silently): {missing}")
    extra = [i for i in CLASSIFICATION if i not in universe]
    if extra:
        raise SystemExit(f"classification rows without evidence: {extra}")

    # --- canonicalization status + category source ---------------------------------------
    rows = []
    for i in universe:
        cat, fam, sub, tags, status, conf, note = CLASSIFICATION[i]
        if i in rt_ing:
            name, canon = rt_ing[i]["nameJa"], "RUNTIME_CANONICAL"
            cat_src, cat_val = "runtime:src/data/ingredients.ts", rt_ing[i]["category"]
        elif i in catalog:
            name, canon = catalog[i]["nameJa"], "CATALOG_CANONICAL"
            cat_src, cat_val = "catalog:data/recipes/ingredient_master_catalog.json", catalog[i]["category"]
        else:
            names = reverse.get(i) or []
            name = names[0] if names else None
            canon = "REGISTERED_NEW_ID" if names else "ID_WITHOUT_NAME_EVIDENCE"
            if i in spread_ids:
                cat_src, cat_val = "evidence:172 matrix spreadLayerIngredientIds", "sauce"
            else:
                cat_src, cat_val = "proposed", cat
        if cat_val != cat:
            raise SystemExit(f"{i}: proposed category {cat} disagrees with evidence {cat_val} ({cat_src})")
        aliases = sorted({t for t in tokens_by_id.get(i, {}) if t != name} | set(catalog.get(i, {}).get("aliases", []))
                         | {n for n in reverse.get(i, []) if n != name})
        dh4_family = dh4.get(i)
        if dh4_family and fam != dh4_family:
            raise SystemExit(f"{i}: proposed family {fam} disagrees with DH4-1 {dh4_family}")
        # ids whose 172 name went through a likely_alias (a judgment) are marked, not hidden
        likely = sorted({ja for ja, (cid, _) in CANON.LIKELY_ALIAS_TABLE.items() if cid == i})
        rows.append({
            "id": i,
            "nameJa": name,
            "aliasesObserved": aliases,
            "canonicalizationStatus": canon,
            "likelyAliasNames": likely,
            "category": cat,
            "categorySource": cat_src,
            "broadGroup": FAMILIES[fam][0] if fam else None,
            "family": fam,
            "familySource": "DH4-1 PR #254 (open, not on main)" if dh4_family else ("proposed" if fam else "n/a (category-level)"),
            "subfamily": sub,
            "flavorTags": tags,
            "classificationStatus": status,
            "confidence": conf,
            "note": note,
            "evidence": {
                "runtime": i in rt_ing,
                "runtimeRecipeCount": cntrt.get(i, 0),
                "universe105": i in u105_set,
                "pool101RecipeCount": cnt101.get(i, 0),
                "evidence172RecipeCount": cnt172.get(i, 0),
                "catalog62": i in catalog,
                "postBakeEvidenceRows": sorted(post_bake.get(i, [])),
                "midBakeEvidenceRows": sorted(mid_bake.get(i, [])),
                "catalogMechanicDependency": catalog.get(i, {}).get("mechanicDependency"),
            },
        })
    by_id = {r["id"]: r for r in rows}

    token_rows = []
    for tok, (cat, fam, sub, note) in sorted(UNRESOLVED_TOKEN_CLASS.items()):
        token_rows.append({
            "token": tok, "canonicalizationStatus": "UNRESOLVED_AMBIGUOUS",
            "relatedIds": CANON.AMBIGUOUS_TABLE.get(tok, ([], ""))[0],
            "taxonomyFlag": CANON.TAXONOMY_FLAGS.get(tok),
            "indicativeCategory": cat, "indicativeFamily": fam, "indicativeSubfamily": sub,
            "classificationStatus": "UNKNOWN", "note": note,
            "evidence172Rows": sorted(unresolved_rows.get(tok, [])),
        })
    missing_tokens = sorted(set(unresolved_rows) - set(UNRESOLVED_TOKEN_CLASS))
    if missing_tokens:
        raise SystemExit(f"unresolved tokens without a row: {missing_tokens}")

    populations = {
        "runtime29": sorted(rt_ing),
        "universe105": u105,
        "evidence172": ids172,
        "union": universe,
    }
    rec_pops = {"runtime25": rt_rec, "pool101": pool101,
                "evidence172Complete": {k: v["ids"] for k, v in rows172.items() if v["complete"]}}

    audit = {
        "schemaNote": ("172 Recipe Ingredient Taxonomy Fresh Audit (Discovery Hint 4.0 Lane C, parent Issue #253). "
                       "Docs/data-only. NOT a production authority, NOT wired into src/**. DH4-1 (PR #254) is read, never changed. "
                       "Every classification is PROPOSED / NEEDS_REVIEW / UNKNOWN; none is final."),
        "generatedBy": "tools/ingredient_taxonomy_audit.py",
        "auditedMainSha": AUDITED_MAIN,
        "dh4_1ReadFrom": {"pr": 254, "headSha": DH4_1_HEAD, "file": "src/data/ingredientTaxonomy.ts"},
        "inputs": [
            "src/data/ingredients.ts", "src/data/recipes.ts", "data/recipes/ingredient_master_catalog.json",
            "docs/design/data/TETO_PROGRESSION2_PHASE34_INGREDIENT-UNLOCK-MATRIX.json",
            "docs/design/data/TETO_PROGRESSION2_PHASE2_UNLOCK-MATRIX.json",
            "docs/design/data/TETO_RECIPE_172_GAME-DESIGN-CANDIDATE_MATRIX.json",
            "tools/progression2_ingredient_canonicalizer.py",
        ],
        "layers": {
            "L1_group": GROUPS,
            "L2_family": {k: {"group": g, "labelJa": lab} for k, (g, lab) in FAMILIES.items()},
            "L3_subfamily": SUBFAMILIES,
        },
        "axes": AXES,
        "universeCounts": universe_counts(populations, rows172, pool101, rt_rec, token_rows, by_id),
        "classCounts": class_counts(rows, populations, rec_pops),
        "singletonReport": singleton_report(rows, populations),
        "dh4_1CompatibilitySimulation": dh4_simulation(by_id, pool101, p34, rt_rec, rt_ing),
        "intersection": intersection(rows, populations, by_id),
        "recipeIdentity": recipe_identity(by_id, rec_pops, caps172),
        "humanReviewQueue": review_queue(rows, token_rows),
        "ingredients": rows,
        "unresolvedTokens": token_rows,
    }
    return audit


def universe_counts(pops, rows172, pool101, rt_rec, token_rows, by_id):
    status = Counter(r["canonicalizationStatus"] for r in by_id.values())
    cls = Counter(r["classificationStatus"] for r in by_id.values())
    return {
        "runtimeIngredients": len(pops["runtime29"]),
        "runtimeRecipes": len(rt_rec),
        "universe105Ingredients": len(pops["universe105"]),
        "pool101Recipes": len(pool101),
        "evidence172Rows": len(rows172),
        "evidence172CompleteRows": sum(1 for v in rows172.values() if v["complete"]),
        "evidence172CanonicalIds": len(pops["evidence172"]),
        "evidence172UnresolvedTokens": len(token_rows),
        "evidence172NameUniverse": len(pops["evidence172"]) + len(token_rows),
        "catalogOnlyIds": sorted(i for i in pops["union"] if not by_id[i]["evidence"]["universe105"]
                                 and not by_id[i]["evidence"]["evidence172RecipeCount"]),
        "universe105NotIn172Evidence": sorted(set(pops["universe105"]) - set(pops["evidence172"])),
        "unionCanonicalIds": len(pops["union"]),
        "canonicalizationStatus": dict(sorted(status.items())),
        "classificationStatus": dict(sorted(cls.items())),
        "categoryByPopulation": {p: dict(sorted(Counter(by_id[i]["category"] for i in ids).items()))
                                 for p, ids in pops.items()},
    }


def class_counts(rows, pops, rec_pops):
    out = {}
    for level in ("broadGroup", "family", "subfamily"):
        level_out = {}
        keys = sorted({r[level] for r in rows if r[level]})
        for k in keys:
            members = {r["id"] for r in rows if r[level] == k}
            entry = {p: len(members & set(ids)) for p, ids in pops.items()}
            entry["recipesContaining"] = {p: sum(1 for v in recs.values() if members & set(v))
                                          for p, recs in rec_pops.items()}
            level_out[k] = entry
        out[level] = level_out
    return out


def singleton_report(rows, pops):
    out = {}
    for level in ("family", "subfamily"):
        rep = {}
        for p, ids in pops.items():
            members = defaultdict(list)
            for r in rows:
                if r["id"] in ids and r[level]:
                    members[r[level]].append(r["id"])
            rep[p] = {f"size{n}": {k: sorted(v) for k, v in sorted(members.items()) if len(v) == n}
                      for n in (1, 2, 3)}
        out[level] = rep
    # label ~= ingredient name: a class whose only member(s) the label effectively names
    out["labelNameEquivalence"] = [
        {"class": "other.egg / たまご", "why": "In every population its only member is egg. As a label, たまご IS the name. DH4-1 already folds it into その他."},
        {"class": "vegetable.mushroom / きのこ", "why": "Its runtime member is mushroom only. At 172 it has 3 (mushroom, porcini, truffle), so it is near-singleton. It must stay folded into 野菜・きのこ."},
        {"class": "fruit (runtime) / 果物", "why": "At runtime its only member is pineapple. At 105 it has 3 (lemon, pineapple, pomegranate). At 172 it is safe (10). The DH4-1 k>=2 guard covers runtime and 105."},
        {"class": "spice (runtime) / スパイス・薬味", "why": "At runtime its only member is capers. The DH4-1 k>=2 guard covers it."},
        {"class": "other.seaweed / 海藻", "why": "Its members are nori and the unresolved 青のり. A label 海藻 = のり."},
    ]
    return out


# ---------------------------------------------------------------------------------------------
# DH4-1 compatibility: re-implements the DH4-1 guard (family -> group -> category -> existence,
# candidates = reserve + OWNED same-level ingredients NOT in the recipe) over the 101-pool, for
# every topping of every recipe as a hypothetical reserve (Rule W picks one; this is the worst
# case over all picks). Owned states: EARLIEST = the ingredients unlocked by the Phase 3/4
# sequence step that first makes the recipe reachable; MATURE = all 105.
# ---------------------------------------------------------------------------------------------
def dh4_levels(reserve, recipe_ids, owned, by_id, family_fn, extra_first=None):
    cat = by_id[reserve]["category"]
    levels = []
    if extra_first:
        levels.append(("subfamily", lambda i: by_id[i]["category"] == cat and by_id[i]["subfamily"] == by_id[reserve]["subfamily"]))
    fam = family_fn(reserve) if cat == "topping" else None
    if fam:
        grp = FAMILIES[fam][0]
        levels.append(("family", lambda i: by_id[i]["category"] == cat and family_fn(i) == fam))
        levels.append(("group", lambda i: by_id[i]["category"] == cat and family_fn(i) and FAMILIES[family_fn(i)][0] == grp))
    levels.append(("category", lambda i: by_id[i]["category"] == cat))
    for name, match in levels:
        k = 1 + sum(1 for i in owned if i not in recipe_ids and i in by_id and match(i))
        if k >= 2:
            return name, k
    return "existence", 1


def dh4_simulation(by_id, pool101, p34, rt_rec, rt_ing):
    seq = sorted((r for r in p34["rows"]), key=lambda r: r["sequence"])
    reach_step = {}
    unlocked = []
    owned_at = {}
    for r in seq:
        if r["kind"] == "ingredient":
            unlocked.append(r["ingredientId"])
        for rid in r.get("newlyReachableRecipeIds") or []:
            if rid not in reach_step:
                reach_step[rid] = r["sequence"]
                owned_at[rid] = list(unlocked)
    all105 = [r["ingredientId"] for r in seq if r["kind"] == "ingredient"]
    fam_fn = lambda i: by_id[i]["family"]  # noqa: E731

    def run(recipes, owned_for, subfamily_first=False):
        dist = defaultdict(Counter)
        pairs = 0
        for rid, ids in sorted(recipes.items()):
            owned = owned_for(rid)
            if owned is None:
                continue
            for t in ids:
                lvl, _k = dh4_levels(t, set(ids), owned, by_id, fam_fn, subfamily_first)
                dist[by_id[t]["category"]][lvl] += 1
                pairs += 1
        return {"reservePairs": pairs,
                "answerLevelByCategory": {c: dict(sorted(v.items())) for c, v in sorted(dist.items())}}

    def closure(recipes, owned_for):
        """Composition closure if the FULL family signature were sold: the number of ingredient sets
        over the owned inventory that fit it. 1 means the signature names the whole composition."""
        vals = []
        for rid, ids in sorted(recipes.items()):
            owned = set(owned_for(rid) or []) | set(ids)
            cls = lambda i: by_id[i]["family"] or by_id[i]["category"]  # noqa: E731
            per = Counter(cls(i) for i in owned)
            n = 1
            for f, k in Counter(cls(i) for i in ids).items():
                n *= math.comb(per[f], k)
            vals.append((n, rid))
        return {"recipesPinnedToOneComposition": sorted(r for n, r in vals if n == 1),
                "recipesWithAtMost3Compositions": sum(1 for n, _ in vals if n <= 3),
                "medianCompositions": sorted(n for n, _ in vals)[len(vals) // 2]}

    initial = [r["ingredientId"] for r in seq if r["conditionType"] == "INITIAL_OWNED"]
    return {
        "method": ("Worst case over every (recipe, ingredient) pair as a hypothetical Rule W reserve. The real reserve "
                   "is one per recipe (selectableHint.ts). DH4-1 guard re-implemented: the answer is the first level "
                   "with k>=2, where k = 1 + OWNED same-level ingredients outside the recipe."),
        "initialOwned": initial,
        "pool101_EARLIEST_familyTable": run(pool101, lambda rid: owned_at.get(rid)),
        "pool101_MATURE_familyTable": run(pool101, lambda rid: all105),
        "pool101_EARLIEST_withSubfamilyFirst": run(pool101, lambda rid: owned_at.get(rid), True),
        "pool101_MATURE_withSubfamilyFirst": run(pool101, lambda rid: all105, True),
        "runtime25_MATURE_familyTable": run(rt_rec, lambda rid: sorted(rt_ing)),
        "pool101RecipesWithReachStep": sum(1 for r in pool101 if r in owned_at),
        "fullSignatureClosure_pool101_EARLIEST": closure(pool101, lambda rid: owned_at.get(rid)),
        "fullSignatureClosure_pool101_MATURE": closure(pool101, lambda rid: all105),
        "fullSignatureClosure_runtime25_MATURE": closure(rt_rec, lambda rid: sorted(rt_ing)),
    }


def intersection(rows, pops, by_id):
    """Audit E: cells of (family x flavor tag x post-bake evidence) that hold 1 ingredient."""
    out = {}
    for p in ("universe105", "evidence172"):
        ids = [i for i in pops[p] if by_id[i]["category"] == "topping"]
        combos = {
            "family": lambda r: (r["family"],),
            "family+spicy": lambda r: (r["family"], "spicy" in r["flavorTags"]),
            "family+sweet": lambda r: (r["family"], "sweet" in r["flavorTags"]),
            "family+postBakeEvidence": lambda r: (r["family"], bool(r["evidence"]["postBakeEvidenceRows"] or r["evidence"]["catalogMechanicDependency"])),
            "family+spicy+postBake": lambda r: (r["family"], "spicy" in r["flavorTags"], bool(r["evidence"]["postBakeEvidenceRows"] or r["evidence"]["catalogMechanicDependency"])),
            "subfamily": lambda r: (r["subfamily"],),
            "subfamily+spicy": lambda r: (r["subfamily"], "spicy" in r["flavorTags"]),
        }
        rep = {}
        for name, key in combos.items():
            cells = defaultdict(list)
            for i in ids:
                cells[json.dumps(key(by_id[i]), ensure_ascii=False)].append(i)
            singles = {k: v[0] for k, v in sorted(cells.items()) if len(v) == 1}
            rep[name] = {"cells": len(cells), "singletonCells": len(singles),
                         "singletonIngredients": sorted(singles.values())}
        out[p] = rep
    return out


def recipe_identity(by_id, rec_pops, caps172):
    """Audit F. (a) population uniqueness of each signature; (b) composition closure: how many
    ingredient sets over the population's owned universe fit the full family signature."""
    def fam_or_cat(i):
        r = by_id[i]
        return r["family"] or r["category"]

    out = {}
    for p, recs in rec_pops.items():
        universe = sorted({i for v in recs.values() for i in v})
        per_class = Counter(fam_or_cat(i) for i in universe)
        sigs = {
            "totalCount": lambda ids, rid: (len(ids),),
            "toppingCount": lambda ids, rid: (sum(1 for i in ids if by_id[i]["category"] == "topping"),),
            "totalCount+toppingCount": lambda ids, rid: (len(ids), sum(1 for i in ids if by_id[i]["category"] == "topping")),
            "familySet": lambda ids, rid: tuple(sorted({fam_or_cat(i) for i in ids})),
            "familyMultiset": lambda ids, rid: tuple(sorted(Counter(fam_or_cat(i) for i in ids).items())),
            "familyMultiset+techniques": lambda ids, rid: (tuple(sorted(Counter(fam_or_cat(i) for i in ids).items())), tuple(caps172.get(rid, []))),
            "subfamilyMultiset": lambda ids, rid: tuple(sorted(Counter(by_id[i]["subfamily"] or by_id[i]["category"] for i in ids).items())),
        }
        rep = {}
        for name, fn in sigs.items():
            groups = defaultdict(list)
            for rid, ids in recs.items():
                groups[json.dumps(fn(ids, rid), ensure_ascii=False)].append(rid)
            unique = sum(1 for v in groups.values() if len(v) == 1)
            rep[name] = {"classes": len(groups), "uniqueRecipes": unique,
                         "uniqueShare": round(unique / len(recs), 3),
                         "medianClassSizeByRecipe": sorted(len(groups[json.dumps(fn(ids, rid), ensure_ascii=False)]) for rid, ids in recs.items())[len(recs) // 2]}
        # single facts: "the recipe contains family X" -> share of the population still consistent
        single = []
        for rid, ids in recs.items():
            fams = {fam_or_cat(i) for i in ids}
            best = min(sum(1 for v in recs.values() if f in {fam_or_cat(i) for i in v}) for f in fams)
            single.append(best)
        rep["singleFamilyFact_minConsistentRecipes"] = {
            "min": min(single), "median": sorted(single)[len(single) // 2],
            "recipesWhereSomeSingleFactLeavesAtMost3": sum(1 for s in single if s <= 3)}
        # composition closure under the mature owned universe (= the population's own universe)
        closure = []
        for rid, ids in recs.items():
            c = Counter(fam_or_cat(i) for i in ids)
            n = 1
            for f, k in c.items():
                n *= math.comb(per_class[f], k)
            closure.append(n)
        rep["fullSignatureCompositionClosure"] = {
            "recipesPinnedToOneComposition": sum(1 for n in closure if n == 1),
            "recipesWithAtMost3Compositions": sum(1 for n in closure if n <= 3),
            "medianCompositions": sorted(closure)[len(closure) // 2]}
        out[p] = rep
    return out


def review_queue(rows, token_rows):
    q = []
    for r in rows:
        if r["classificationStatus"] == "NEEDS_REVIEW":
            q.append({"id": r["id"], "nameJa": r["nameJa"], "proposedFamily": r["family"] or r["category"],
                      "proposedSubfamily": r["subfamily"], "reason": r["note"],
                      "bucket": bucket(r), "universe105": r["evidence"]["universe105"],
                      "evidence172RecipeCount": r["evidence"]["evidence172RecipeCount"]})
    for t in token_rows:
        q.append({"id": None, "nameJa": t["token"], "proposedFamily": t["indicativeFamily"] or t["indicativeCategory"],
                  "proposedSubfamily": t["indicativeSubfamily"], "reason": t["note"], "bucket": "unresolved-token",
                  "universe105": False, "evidence172RecipeCount": len(t["evidence172Rows"])})
    return q


def bucket(r):
    n = r["note"]
    if r["subfamily"] in ("vegetable.pickled", "vegetable.legume"):
        return "pickled / fermented / legume"
    if "prepared_dish_composite" in n or "prepared" in n.lower():
        return "prepared / composite"
    if r["family"] in ("meat",):
        return "meat alias / cut"
    if r["family"] == "seafood" or r["subfamily"] == "other.seaweed":
        return "seafood / seaweed"
    if r["category"] == "cheese" or r["subfamily"] == "other.dairy":
        return "cheese vs dairy"
    if r["category"] == "sauce" or "spread" in n:
        return "condiment vs topping / spread"
    if r["subfamily"] in ("vegetable.pickled", "vegetable.legume"):
        return "pickled / fermented / legume"
    if r["family"] in ("herb", "spice") or "spice" in n or "herb" in n:
        return "herb vs vegetable / spice"
    if "post-bake" in n.lower() or "finish" in n.lower():
        return "finishing ingredient"
    return "boundary / near-alias"


if __name__ == "__main__":
    main()
