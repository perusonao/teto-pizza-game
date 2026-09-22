#!/usr/bin/env python3
"""
Progression 2.0 ingredient canonicalizer (Issue #182 / PR #183, Phase 0B.2).
Docs/data-only tooling -- NOT part of src/**, NOT wired into CI.

Implements the deterministic classification procedure documented in
docs/design/TETO_PROGRESS2_INGREDIENT-CANONICALIZATION-RULES.md: given a
candidate ingredient name (Japanese, optionally with an English hint), decide
whether it is exact_alias / likely_alias / ambiguous / genuinely_new /
needs_review against the existing canonical ingredient set (the shipped 62 +
Phase 0B's 15 + Phase 0B.1's 6 confirmed-new ids).

This tool does NOT fetch or invent any ingredient name -- it only classifies
names it is given, either via --input (a JSON list of {"nameJa": ...}
candidates) or, with no --input, by re-classifying Phase 0B.1's own 36
already-relayed names as a determinism self-test (the output should exactly
reproduce that Phase's dispositions).

Usage:
  python3 tools/progression2_ingredient_canonicalizer.py
      (self-test: re-classifies the 36 Phase 0B.1 names, diffs against their
      recorded dispositions, exits non-zero on any mismatch)
  python3 tools/progression2_ingredient_canonicalizer.py --input new_names.json
      (classifies a new batch; new_names.json = [{"nameJa": "...", "count": N,
      "sourceNote": "..."}, ...])
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INGREDIENT_CATALOG_PATH = ROOT / "data/recipes/ingredient_master_catalog.json"
PHASE0B_SAMPLES_PATH = ROOT / "docs/reports/data/TETO_PROGRESS2_PHASE0B_pizzadb-external-samples.json"
PHASE0B1_DIFF_PATH = ROOT / "docs/reports/data/TETO_PROGRESS2_PHASE0B1_ingredient-universe-diff.json"

# --- Rule 1b: orthographic/abbreviation equivalents -- NOT a different-word
# synonym (that's rule 2), just kanji/kana spelling variance or a common
# short form of the exact same stored nameJa. Folded into rule 1 (still
# exact_alias) rather than demoted to likely_alias, since there is no
# identity ambiguity, only a spelling difference. Key: PIZZA DB nameJa.
# Value: the existing catalog's own stored nameJa this normalizes to. ---
ORTHOGRAPHIC_EQUIVALENTS = {
    "玉ねぎ": "たまねぎ",  # 玉ねぎ -> たまねぎ (onion): kanji/kana variant of the same word.
    "リコッタ": "リコッタチーズ",  # リコッタ -> リコッタチーズ (ricotta): common short form.
    "海苔": "のり",  # 海苔 -> のり (nori): kanji/kana variant of the same word.
    "イチゴ": "いちご",  # イチゴ -> いちご (strawberry): katakana/hiragana variant of the same word.
    "蜂蜜": "はちみつ",  # 蜂蜜 -> はちみつ (honey): kanji/kana variant of the same word. Phase 0B.9 finding (nashville-hot-chicken-pizza-pizzadb-p6).
    # Phase 0B.9 finding: モッツァレラチーズ/ナス have been used as raw ingredientsJa
    # strings across ~20+ already-ingested rows since Phase 0B.4 without ever
    # being run through this classifier -- both are pre-existing needs_review
    # gaps against the catalog's own stored forms (モッツァレラ / なす). Fixed here
    # rather than left open, since both are plain suffix/script variants with
    # no identity ambiguity, exactly like 玉ねぎ->たまねぎ and リコッタ->リコッタチーズ above.
    "モッツァレラチーズ": "モッツァレラ",  # チーズ suffix variant of existing mozzarella's nameJa モッツァレラ.
    "ナス": "なす",  # ナス -> なす (eggplant): katakana/hiragana variant of the same word.
}

# --- Phase 0B introduced 15 new ingredient ids without recording a
# standalone Japanese name per id (only inside recipe-sample prose). Their
# Japanese names as first used in Phase 0B.1's own diff table are registered
# here so a later exact-nameJa lookup (rule 1) recognizes them too, not just
# the base 62-ingredient catalog. Only the two that recur in Phase 0B.1's
# named-ingredient list are needed here; the rest surface only if/when a
# future relayed batch names them explicitly. ---
PHASE0B_NEW_INGREDIENT_NAMES = {
    "トマト": "fresh-tomato",
    "クリームチーズ": "cream-cheese",
    # Phase 0B.3 additions: first standalone-occurrence Japanese-name
    # evidence for ids Phase 0B had already introduced only inside recipe-
    # sample prose (see docs/reports/TETO_PROGRESS2_PHASE0B3_INGREDIENT-CANONICALIZATION-BATCH.md
    # section 2 for the per-entry cross-reference).
    "アサリ": "clam",
    "タラ": "salt-cod",
    "レタス": "lettuce",
    "パプリカパウダー": "paprika-powder",
    "トルティーヤチップス": "tortilla-chips",
    "サラミ": "salami",
    "フロマージュブラン": "fromage-blanc-sauce",
    "りんご": "apple",
    "シナモン": "cinnamon",
    "ブルーチーズドレッシング": "blue-cheese-dressing",
}

# --- Rule 2: curated synonym table (likely_alias). Every entry needs a
# justification -- never a bare guess. Key: PIZZA DB nameJa. Value: (existing
# canonical id, justification). ---
LIKELY_ALIAS_TABLE = {
    "オリーブ": ("black-olive", "Existing catalog's only olive-type ingredient; PIZZA DB's plain 'olive' doesn't specify color/variety, so this is a confidence-flagged match, not exact."),
    "コリアンダー": ("cilantro", "Same plant as existing cilantro (nameJa パクチー) -- coriander leaf and cilantro are the same herb under different common names."),
    "大葉": ("shiso", "Phase 0B.6 finding: 大葉 (ooba) is the common culinary name for shiso leaf, same plant as the already-registered genuinely_new 'shiso' (nameJa しそ, Phase 0B.3) -- different common name, not a new ingredient."),
    # Phase 0B.3 additions:
    "鶏肉": ("chicken", "Japanese native word for chicken meat vs. existing loanword チキン -- same ingredient, different common name."),
    "ゴルゴンゾーラチーズ": ("gorgonzola", "チーズ suffix variant of existing gorgonzola's nameJa ゴルゴンゾーラ."),
    "チェダーチーズ": ("cheddar", "First Japanese-name evidence for Phase 0B's already-introduced 'cheddar' id (taco-pizza-pizzadb) -- チーズ suffix variant."),
    "カチョカヴァッロチーズ": ("caciocavallo", "Suffix (チーズ) + small-tsu transliteration variant of existing caciocavallo's nameJa カチョカヴァロ."),
    "フォンティーナチーズ": ("fontina", "チーズ suffix variant of existing fontina's nameJa フォンティーナ."),
    "リコッタサラータチーズ": ("ricotta-salata", "チーズ suffix variant of existing ricotta-salata's nameJa リコッタサラータ."),
    "ポルチーニ茸": ("porcini", "茸(mushroom) suffix variant of existing porcini's nameJa ポルチーニ."),
    "サラミピカンテ": ("spicy-salami", "Italian 'piccante' (spicy) -- matches existing spicy-salami (used by diavola), distinct from plain サラミ/salami."),
    "カレーケチャップソース": ("curry-ketchup", "ソース suffix variant of Phase 0B's curry-ketchup (currywurst-pizzadb)."),
    "サルサソース": ("salsa", "ソース suffix variant of Phase 0B's salsa (taco-pizza-pizzadb)."),
    "ヘーゼルナッツチョコレートスプレッド": ("nutella-spread", "Word-order variant of existing nutella-spread's nameJa チョコヘーゼルナッツソース -- same chocolate-hazelnut spread concept."),
    "甘めのトマトソース": ("tomato-sauce", "A sweeter variant of the same base tomato-sauce, not treated as a structurally distinct sauce family."),
}

# --- Rule 3: curated ambiguity table (ambiguous). Never auto-resolved. Key:
# PIZZA DB nameJa. Value: (list of candidate related ids, justification). ---
AMBIGUOUS_TABLE = {
    "ひき肉": (["ground-beef"], "Phase 0B's 'ground-beef' is taco-specific; ひき肉 (ground meat) is generic and could be pork/mixed -- not merged without a product decision."),
    "チリ": (["chili-oil"], "Existing chili-oil is a spread SAUCE; チリ likely denotes a raw chili-pepper SCATTER topping -- a different ingredient class, not merged."),
    # Phase 0B.3 additions:
    "チーズ": (["mozzarella"], "GENERIC 'cheese' with no specific variety named -- cannot be resolved to one canonical cheese id without more context; not defaulted to mozzarella or any other cheese."),
    "肉": (["beef", "pork", "chicken", "ground-beef"], "GENERIC 'meat' with no specific variety named -- not defaulted to any one meat id."),
    "ナッツ": (["walnut"], "GENERIC 'nuts' with no specific variety named."),
    "チーズソース": (["mozzarella"], "TAXONOMY: this is a SAUCE (cheese sauce), not a scatter topping -- flagged, not merged into any cheese topping id."),
    "ホワイトソース": (["fromage-blanc-sauce"], "GENERIC 'white sauce' -- may or may not be the same as the specific fromage-blanc-sauce Phase 0B introduced for flammkuchen; not merged without confirmation."),
    "スパイシーソーセージ": (["sausage"], "A spicier variant of existing sausage -- not confirmed to be the same game ingredient."),
    "カレーソース": (["curry-ketchup"], "A more generic curry sauce than the specific curry-ketchup Phase 0B introduced for currywurst -- not merged."),
    "青唐辛子": (["chili-oil"], "Green chili variant -- part of the existing chili/chili-oil naming-ambiguity group (see also 'チリ' above), kept distinct."),
    "赤唐辛子": (["chili-oil"], "Red chili variant -- same ambiguity group as 青唐辛子."),
    "青のり": (["nori"], "Aonori is a related but visually/culinarily distinct seaweed condiment from plain nori -- not merged."),
    "プロヴェルチーズ": (["provolone"], "'Provel' is a real, distinct St. Louis-style cheese blend, commonly confused with provolone by name similarity -- explicitly NOT the same cheese, kept separate."),
    # Phase 0B.9 addition:
    "唐辛子": (["chili-oil"], "Plain 'chili pepper' (color/type unspecified) -- part of the existing chili/chili-oil naming-ambiguity group (see also チリ/青唐辛子/赤唐辛子), kept distinct from the chili-oil sauce."),
}

# --- Rule 0 (checked first, before all other rules): known generic-phrase /
# non-ingredient placeholders. These are not real ingredients at all (e.g. a
# PIZZA DB entry meaning "toppings of your choice") and must never be
# classified as genuinely_new or counted toward the canonical ingredient
# universe -- excluded outright, with the reason recorded. ---
EXCLUDED_NON_INGREDIENT = {
    "お好みの具材": "Generic placeholder phrase ('toppings of your choice'), not a specific real-world ingredient -- excluded from the canonical ingredient universe entirely.",
}

# --- Taxonomy flags (independent of disposition): PIZZA DB's ingredient-
# frequency list mixes true scatter/spread TOPPINGS with items that are
# structurally SAUCES, prepared/composite DISHES, or otherwise don't fit the
# game's topping model as-is. Recorded here so classify() can surface the
# issue without it being lost inside a plain genuinely_new/likely_alias
# disposition -- a future integration decision must look at this before
# adding any of these as an ordinary scatter/spread ingredient. Key: nameJa
# (works for genuinely_new candidates AND likely_alias/ambiguous entries that
# also need the flag, e.g. カレーケチャップソース is both likely_alias AND a
# sauce). ---
TAXONOMY_FLAGS = {
    "チーズ": "generic_unspecified", "肉": "generic_unspecified", "ナッツ": "generic_unspecified",
    "チーズソース": "sauce_not_topping", "ホワイトソース": "sauce_not_topping",
    "カレーケチャップソース": "sauce_not_topping", "サルサソース": "sauce_not_topping",
    "カレーソース": "sauce_not_topping", "お好み焼きソース": "sauce_not_topping",
    "グレイビーソース": "sauce_not_topping", "ケバブソース": "sauce_not_topping",
    "ヨーグルトソース": "sauce_not_topping", "生クリームソース": "sauce_not_topping",
    "焼肉のタレ": "sauce_not_topping", "醤油ソース": "sauce_not_topping",
    "甜麺醤": "sauce_not_topping", "豆板醤": "sauce_not_topping", "味噌だれ": "sauce_not_topping",
    "タヒニ": "sauce_or_condiment", "チャツネ": "sauce_or_condiment",
    "バルサミコ酢": "sauce_or_condiment", "マスタード": "sauce_or_condiment",
    "柚子胡椒": "sauce_or_condiment", "溶かしバター": "sauce_or_condiment",
    "ピーナッツソース": "sauce_not_topping",
    "チキンティッカ": "prepared_dish_composite", "ホットドッグ": "prepared_dish_composite",
    "北京ダック": "prepared_dish_composite",
    "梅肉": "false_friend_not_meat -- contains 肉 kanji but means plum FLESH, not meat; do not group with beef/pork/chicken/ground-beef.",
}

# --- Rule 4: registry of already-confirmed new ingredients (genuinely_new),
# so a repeat sighting reuses the same id instead of registering it twice.
# Key: PIZZA DB nameJa (or a known alternate spelling). Value: proposed id.
# NOTE: Phase 0B.1 classified '牛肉' (beef) as genuinely_new despite its
# own unresolved relationship to existing 'steak' and Phase 0B's
# 'ground-beef' -- that relationship is recorded as a note on the id itself,
# not as an AMBIGUOUS_TABLE entry, so this registry (checked after
# AMBIGUOUS_TABLE) is what actually classifies it; keeping it out of
# AMBIGUOUS_TABLE too is deliberate, matching Phase 0B.1's recorded
# disposition exactly (see the self-test). ---
GENUINELY_NEW_REGISTRY = {
    "牛肉": "beef",
    "レモン": "lemon",
    "ピーマン": "green-pepper",
    "青ねぎ": "green-onion",
    "万能ねぎ": "green-onion",
    "しそ": "shiso",
    "豚肉": "pork",
    # Phase 0B.3 additions (95 entries, occurrence tiers 4/3/2/1 -- see
    # docs/reports/TETO_PROGRESS2_PHASE0B3_INGREDIENT-CANONICALIZATION-BATCH.md
    # for the full per-entry disposition rationale and taxonomy notes):
    "ケッパー": "capers",
    "サーモン": "salmon",
    "フェタチーズ": "feta",
    "ブラータチーズ": "burrata",
    "ミント": "mint",
    "白ごま": "white-sesame",
    "アボカド": "avocado",
    "カトゥピリチーズ": "catupiry",
    "きゅうり": "cucumber",
    "しらす": "whitebait",
    "にんじん": "carrot",
    "ピクルス": "pickles",
    "ムール貝": "mussel",
    "ヤシの新芽": "palm-heart",
    "ラム肉": "lamb",
    "松の実": "pine-nuts",
    "アーモンド": "almond",
    "アスパラガス": "asparagus",
    "アヒアマリージョ": "aji-amarillo",
    "イカ": "squid",
    "いくら": "salmon-roe",
    "イワシ": "sardine",
    "うなぎ": "eel",
    "オクラ": "okra",
    "オレンジ": "orange",
    "お好み焼きソース": "okonomiyaki-sauce",
    "カシューナッツチーズ": "cashew-cheese",
    "かつお節": "bonito-flakes",
    "カリフラワー": "cauliflower",
    "キウイ": "kiwi",
    "キムチ": "kimchi",
    "キャベツ": "cabbage",
    "クミン": "cumin",
    "グラナパダーノチーズ": "grana-padano",
    "グラハムクラッカー": "graham-cracker",
    "グレイビーソース": "gravy-sauce",
    "ケバブソース": "kebab-sauce",
    "コティーハチーズ": "cotija",
    "コンデンスミルク": "condensed-milk",
    "ザアタル": "zaatar",
    "ザクロ": "pomegranate",
    "さつまいも": "sweet-potato",
    "ザワークラウト": "sauerkraut",
    "サワークリーム": "sour-cream",
    "スイスチーズ": "swiss-cheese",
    "セロリ": "celery",
    "タヒニ": "tahini",
    "たらこ": "cod-roe",
    "チーズカード": "cheese-curd",
    "チキンティッカ": "chicken-tikka",
    "チコリ": "chicory",
    "チャツネ": "chutney",
    "チョコレート": "chocolate",
    "チリパウダー": "chili-powder",
    "バナナ": "banana",
    "パニール": "paneer",
    "ハラペーニョ": "jalapeno",
    "バルサミコ酢": "balsamic-vinegar",
    "ハロウミチーズ": "halloumi",
    "ピーナッツソース": "peanut-sauce",
    "ひまわりの種": "sunflower-seeds",
    "フェンネル": "fennel",
    "フリアリエッリ": "friarielli",
    "ブリックチーズ": "brick-cheese",
    "ブルーベリー": "blueberry",
    "プンタレッレ": "puntarelle",
    "ベイクドビーンズ": "baked-beans",
    "ペコリーノチーズ": "pecorino",
    "ほうれん草": "spinach",
    "ホットドッグ": "hot-dog",
    "マシュマロ": "marshmallow",
    "マスタード": "mustard",
    "もち": "mochi",
    "ヤギのチーズ": "goat-cheese",
    "ヨーグルトソース": "yogurt-sauce",
    "ライム": "lime",
    "ラディッキオ": "radicchio",
    "レバーパテ": "liver-pate",
    "わさび": "wasabi",
    "岩塩": "rock-salt",
    "山椒": "sansho-pepper",
    "紫キャベツ": "red-cabbage",
    "焼肉のタレ": "yakiniku-sauce",
    "醤油ソース": "soy-sauce",
    "生クリームソース": "fresh-cream-sauce",
    "大根": "daikon",
    "甜麺醤": "sweet-bean-sauce",
    "豆板醤": "doubanjiang",
    "納豆": "natto",
    "梅肉": "umeboshi-paste",
    "北京ダック": "peking-duck",
    "味噌だれ": "miso-sauce",
    "明太子": "mentaiko",
    "柚子胡椒": "yuzu-kosho",
    "溶かしバター": "melted-butter",
}


def load_canonical_names():
    """Returns {nameJa: canonical_id} for every existing exact nameJa/alias,
    drawn from the shipped 62 (ingredient_master_catalog.json) plus Phase 0B's
    15 new candidate ingredients (from the staging samples file's
    ingredientsCanonical/newIngredientsNeeded, cross-referenced with each
    sample's nameJa where derivable) -- Phase 0B itself didn't record a
    Japanese name per new ingredient id, so those 15 are only reachable via
    their existing English id equality (handled separately in classify())."""
    with open(INGREDIENT_CATALOG_PATH, encoding="utf-8") as f:
        catalog = json.load(f)
    exact = {}
    for ing in catalog["ingredients"]:
        exact[ing["nameJa"]] = ing["id"]
        for alias in ing["aliases"]:
            exact.setdefault(alias, ing["id"])
    for name_ja, cid in PHASE0B_NEW_INGREDIENT_NAMES.items():
        exact.setdefault(name_ja, cid)
    return exact


def classify(name_ja, exact_names):
    """Applies the rule procedure from
    TETO_PROGRESS2_INGREDIENT-CANONICALIZATION-RULES.md, in order. A
    taxonomyFlag (sauce_not_topping / generic_unspecified /
    prepared_dish_composite / false_friend_not_meat / sauce_or_condiment) is
    attached whenever TAXONOMY_FLAGS has an entry, independent of and in
    addition to the disposition -- so a flagged item is never silently
    treated as an ordinary scatter/spread topping just because it also
    resolved to likely_alias/ambiguous/genuinely_new."""
    result = _classify_disposition(name_ja, exact_names)
    if name_ja in TAXONOMY_FLAGS:
        result["taxonomyFlag"] = TAXONOMY_FLAGS[name_ja]
    return result


def _classify_disposition(name_ja, exact_names):
    if name_ja in EXCLUDED_NON_INGREDIENT:
        return {"disposition": "excluded_non_ingredient", "canonicalId": None, "rule": "0_excluded_non_ingredient", "justification": EXCLUDED_NON_INGREDIENT[name_ja]}
    normalized = ORTHOGRAPHIC_EQUIVALENTS.get(name_ja, name_ja)
    if normalized in exact_names:
        return {"disposition": "exact_alias", "canonicalId": exact_names[normalized], "rule": "1_exact_nameJa_or_alias"}
    if name_ja in LIKELY_ALIAS_TABLE:
        cid, why = LIKELY_ALIAS_TABLE[name_ja]
        return {"disposition": "likely_alias", "canonicalId": cid, "rule": "2_curated_synonym_table", "justification": why}
    if name_ja in AMBIGUOUS_TABLE:
        related, why = AMBIGUOUS_TABLE[name_ja]
        return {"disposition": "ambiguous", "canonicalId": None, "relatedIds": related, "rule": "3_curated_ambiguity_table", "justification": why}
    if name_ja in GENUINELY_NEW_REGISTRY:
        return {"disposition": "genuinely_new", "canonicalId": GENUINELY_NEW_REGISTRY[name_ja], "rule": "4_confirmed_new_registry"}
    return {"disposition": "needs_review", "canonicalId": None, "rule": "5_no_table_match"}


def self_test(exact_names):
    """Re-classifies Phase 0B.1's own 36 names; the result must exactly
    reproduce that Phase's recorded dispositions (proves the tables above
    faithfully encode what Phase 0B/0B.1 already decided, not a new,
    silently-drifted judgment)."""
    with open(PHASE0B1_DIFF_PATH, encoding="utf-8") as f:
        diff = json.load(f)
    mismatches = []
    for row in diff["ingredientOccurrenceDiff"]:
        result = classify(row["nameJa"], exact_names)
        if result["disposition"] != row["disposition"]:
            mismatches.append({
                "nameJa": row["nameJa"], "expected": row["disposition"],
                "got": result["disposition"],
            })
        elif (
            row["disposition"] != "genuinely_new"
            and result.get("canonicalId") != row.get("canonicalId")
        ):
            # genuinely_new is exempt: Phase 0B.1 recorded canonicalId=null
            # for every genuinely_new entry (no id had been minted yet at
            # that point); GENUINELY_NEW_REGISTRY's whole purpose (rule 4) is
            # to now supply that id on a repeat sighting, which is an
            # intentional improvement, not disposition drift.
            mismatches.append({
                "nameJa": row["nameJa"], "expectedCanonicalId": row.get("canonicalId"),
                "gotCanonicalId": result.get("canonicalId"),
            })
    return mismatches


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=None, help="JSON list of {nameJa, count?, sourceNote?} candidates to classify")
    args = parser.parse_args()

    exact_names = load_canonical_names()

    if args.input is None:
        print("No --input given: running determinism self-test against Phase 0B.1's 36 recorded dispositions...")
        mismatches = self_test(exact_names)
        if mismatches:
            print(f"FAIL: {len(mismatches)} mismatch(es) -- the canonicalization tables have drifted from Phase 0B.1's recorded dispositions:")
            for m in mismatches:
                print(" ", m)
            return 1
        print("PASS: all 36 Phase 0B.1 names reclassify identically. Tables are consistent with prior findings.")
        return 0

    with open(args.input, encoding="utf-8") as f:
        loaded = json.load(f)
    # Accept either a bare list, or a documented {"candidates": [...]} wrapper
    # (the latter is what the Phase 0B.3 raw-input file uses, so it can carry
    # a schemaNote/sourceMeta alongside the actual candidate list).
    candidates = loaded["candidates"] if isinstance(loaded, dict) else loaded
    results = []
    for c in candidates:
        r = classify(c["nameJa"], exact_names)
        r["nameJa"] = c["nameJa"]
        r["count"] = c.get("count")
        r["sourceNote"] = c.get("sourceNote")
        results.append(r)

    needs_review = [r for r in results if r["disposition"] == "needs_review"]
    print(json.dumps(results, ensure_ascii=False, indent=2))
    print(f"\n{len(results)} classified, {len(needs_review)} need human review (disposition=needs_review).", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
