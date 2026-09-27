#!/usr/bin/env python3
"""Large Catalog UX Fresh Design -- deterministic scale-failure projection model.

Reads:
  - docs/reports/data/TETO_LARGE-CATALOG-UX_UI-MEASUREMENTS.json (measured on the unchanged UI by
    tools/large-catalog-ux/measure.spec.ts, 25 recipes / 29 ingredients)
  - docs/design/data/TETO_PROGRESSION2_PHASE34_INGREDIENT-UNLOCK-MATRIX.json (the 105-ingredient
    progression universe)
  - src/data/ingredients.ts (runtime category of the 29 shipped ingredients)

Writes:
  - docs/reports/data/TETO_LARGE-CATALOG-UX_SCALE-MODEL.json

`--check` recomputes and fails if the committed JSON differs (no write).

Category / family counts for the 105 and 179 universes are PROPOSED classifications recorded by the
172 taxonomy Fresh Audit (PR #255, OD-TAX-7: not production authority). They are pinned below as
constants with that provenance so this tool does not depend on an unmerged branch.

Everything here is a projection for UX design. No production data or rule is changed or implied.
"""
from __future__ import annotations

import argparse
import json
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MEASURE = ROOT / "docs/reports/data/TETO_LARGE-CATALOG-UX_UI-MEASUREMENTS.json"
UNLOCK = ROOT / "docs/design/data/TETO_PROGRESSION2_PHASE34_INGREDIENT-UNLOCK-MATRIX.json"
INGREDIENTS_TS = ROOT / "src/data/ingredients.ts"
OUT = ROOT / "docs/reports/data/TETO_LARGE-CATALOG-UX_SCALE-MODEL.json"

SLOTS_PER_PAGE = 6  # MAX_INGREDIENT_PALETTE_SLOTS (src/data/ingredients.ts)
TRAY_COLUMNS = 3

# PR #255 (Discovery Hint 4.0 172 taxonomy Fresh Audit) §3 / audit JSON `ingredients`, PROPOSED.
PROPOSED_CATEGORY_COUNTS = {
    "105": {"sauce": 18, "cheese": 16, "topping": 71},
    "179": {"sauce": 31, "cheese": 25, "topping": 123},
}
PROPOSED_TOPPING_FAMILY_COUNTS = {
    "105": {"vegetable": 24, "meat": 13, "seafood": 11, "herb": 8, "other": 7, "spice": 5, "fruit": 3},
    "179": {"vegetable": 40, "meat": 20, "other": 17, "seafood": 15, "spice": 12, "fruit": 11, "herb": 8},
}
RECIPE_POPULATIONS = {"runtime": 25, "pool101": 101, "full172": 172}

# Candidate "counter" sizes for the proposed Free Cooking model (see the design report §5).
COUNTER_PAGES = 2  # 12 slots: the counter itself never has more than two pages


def runtime_category_counts() -> dict[str, int]:
    text = INGREDIENTS_TS.read_text(encoding="utf-8")
    body = text.split("export const INGREDIENTS: Ingredient[] = [", 1)[1].split("\n];", 1)[0]
    cats = re.findall(r'category: "(sauce|cheese|topping)"', body)
    counts = {"sauce": 0, "cheese": 0, "topping": 0}
    for c in cats:
        counts[c] += 1
    return counts


def pages(n: int) -> int:
    return max(1, math.ceil(n / SLOTS_PER_PAGE))


def worst_taps_pager(n: int) -> int:
    """Taps to select the last item with the current ◀/▶ pager: (pages - 1) ▶ taps + 1 chip tap."""
    return pages(n) - 1 + 1


def mean_taps_pager(n: int) -> float:
    if n == 0:
        return 0.0
    return round(sum((i // SLOTS_PER_PAGE) + 1 for i in range(n)) / n, 2)


def worst_taps_family(families: dict[str, int]) -> int:
    """Family rail (1 tap) + pager inside the largest family + chip tap."""
    return 1 + max(pages(v) for v in families.values()) - 1 + 1


def tray_projection(category_counts: dict[str, int], families: dict[str, int] | None) -> dict:
    out = {}
    for cat, n in category_counts.items():
        row = {
            "ownedCount": n,
            "pages": pages(n),
            "worstTapsCurrentPager": worst_taps_pager(n),
            "meanTapsCurrentPager": mean_taps_pager(n),
        }
        if cat == "topping" and families:
            row["familyRail"] = {
                "families": families,
                "largestFamilyPages": max(pages(v) for v in families.values()),
                "worstTaps": worst_taps_family(families),
            }
        # Proposed model: Counter (<= 12 slots) + Pantry sheet (tap to pick, any item in <= 3 taps:
        # open pantry, [family tab], item). Search: open, type, item.
        row["proposed"] = {
            "counterPagesMax": COUNTER_PAGES,
            "worstTapsCounterHit": COUNTER_PAGES,
            "worstTapsPantryPick": 3,
        }
        out[cat] = row
    return out


def vertical_scroll(measure: dict, vp: str, recipes: int, ingredients: int, owned_toppings: int) -> dict:
    m = measure["viewports"][vp]
    dex = m["dex_dex11"]
    locked_h = dex["lockedCard"]["heightMin"]
    disc_h = (dex["discoveredCard"]["heightMin"] + dex["discoveredCard"]["heightMax"]) / 2
    client = dex["body"]["clientHeight"]
    gap = 10  # measured list gap (px) between Dex cards, approx.
    chapters = 3 if recipes <= 25 else math.ceil(recipes / 25)
    header = 120 + chapters * 40
    dex_all_locked = header + (recipes - 1) * (locked_h + gap) + disc_h
    dex_half = header + recipes / 2 * (locked_h + gap) + recipes / 2 * (disc_h + gap)
    dex_all_found = header + recipes * (disc_h + gap)

    ps = m["pizzaSelect_dex11"]
    ps_card = (ps["gridCard"]["heightMin"] + ps["gridCard"]["heightMax"]) / 2 + 12
    ps_client = ps["body"]["clientHeight"]
    ps_all = 150 + chapters * 40 + math.ceil(recipes / ps["gridCard"]["columns"]) * ps_card

    shop = m["shop"]
    shop_row = (shop["row"]["heightMin"] + shop["row"]["heightMax"]) / 2 + 10
    shop_rows = ingredients - 3  # starters are never listed
    shop_h = shop["listTop"]["y"] + shop_rows * shop_row

    inv = m["inventory"]
    inv_row = (inv["card"]["heightMin"] + inv["card"]["heightMax"]) / 2 + 8
    inv_h = inv["gridTop"]["y"] + math.ceil(ingredients / inv["card"]["columns"]) * inv_row
    inv_topping_h = inv["gridTop"]["y"] + math.ceil(owned_toppings / inv["card"]["columns"]) * inv_row

    def screens(h: float, c: float) -> float:
        return round(h / c, 1)

    return {
        "dex": {
            "clientHeight": client,
            "allUndiscoveredPx": round(dex_all_locked),
            "halfDiscoveredPx": round(dex_half),
            "allDiscoveredPx": round(dex_all_found),
            "screensHalfDiscovered": screens(dex_half, client),
            "screensAllDiscovered": screens(dex_all_found, client),
            "undiscoveredSlotsShown": recipes - 1,
        },
        "pizzaSelect": {
            "clientHeight": ps_client,
            "allDiscoveredPx": round(ps_all),
            "screensAllDiscovered": screens(ps_all, ps_client),
        },
        "shop": {
            "clientHeight": shop["body"]["clientHeight"],
            "listedRows": shop_rows,
            "allRowsPx": round(shop_h),
            "screens": screens(shop_h, shop["body"]["clientHeight"]),
        },
        "inventory": {
            "clientHeight": inv["body"]["clientHeight"],
            "allOwnedPx": round(inv_h),
            "screensAll": screens(inv_h, inv["body"]["clientHeight"]),
            "toppingTabScreens": screens(inv_topping_h, inv["body"]["clientHeight"]),
        },
    }


def dom_projection(measure: dict) -> dict:
    m = measure["viewports"]["390x844"]
    d11, d1 = m["dex_dex11"]["domElements"], m["dex_dex0"]["domElements"]
    per_discovered = (d11 - d1) / 10  # 10 more discovered cards between the two saves
    per_locked = 7  # anonymous slot: card, icon, text, label, no, hint, CTA
    base = d1 - per_locked * 24 - per_discovered
    ps = m["pizzaSelect_dex11"]["domElements"]
    per_ps_card = round((ps - 40) / 11, 1)
    return {
        "dexPerDiscoveredCard": round(per_discovered, 1),
        "dexAt172AllDiscovered": round(base + per_discovered * 172),
        "pizzaSelectPerCard": per_ps_card,
        "pizzaSelectAt172": round(40 + per_ps_card * 172),
        "shopAt102Rows": round(m["shop"]["domElements"] / 26 * 102),
        "note": "Element counts, 390x844. Budget guidance: keep any one overlay under ~1500 elements "
        "without virtualization on low-end phones; collapsed chapters keep the initial render small.",
    }


def build() -> dict:
    measure = json.loads(MEASURE.read_text(encoding="utf-8"))
    unlock = json.loads(UNLOCK.read_text(encoding="utf-8"))
    universe105 = [r["ingredientId"] for r in unlock["rows"] if r["kind"] == "ingredient"]
    runtime = runtime_category_counts()
    if sum(runtime.values()) != 29:
        raise SystemExit(f"runtime ingredient count changed: {runtime}")
    if len(universe105) != 105 or sum(PROPOSED_CATEGORY_COUNTS["105"].values()) != 105:
        raise SystemExit("105 universe mismatch")

    populations = {
        "runtime29": {"categories": runtime, "families": None, "recipes": 25},
        "universe105": {
            "categories": PROPOSED_CATEGORY_COUNTS["105"],
            "families": PROPOSED_TOPPING_FAMILY_COUNTS["105"],
            "recipes": 172,
        },
        "union179": {
            "categories": PROPOSED_CATEGORY_COUNTS["179"],
            "families": PROPOSED_TOPPING_FAMILY_COUNTS["179"],
            "recipes": 172,
        },
    }
    tray = {k: tray_projection(v["categories"], v["families"]) for k, v in populations.items()}
    scroll = {}
    for vp in measure["viewports"]:
        scroll[vp] = {
            "runtime_25r_29i": vertical_scroll(measure, vp, 25, 29, runtime["topping"]),
            "scale_172r_105i": vertical_scroll(measure, vp, 172, 105, 71),
        }
    return {
        "generatedBy": "tools/large_catalog_ux_scale_model.py",
        "inputs": {
            "measurements": str(MEASURE.relative_to(ROOT)),
            "universe105": str(UNLOCK.relative_to(ROOT)),
            "proposedCategoryAndFamilyCounts": "PR #255 taxonomy Fresh Audit (PROPOSED, OD-TAX-7: not authority)",
        },
        "slotsPerTrayPage": SLOTS_PER_PAGE,
        "trayProjection": tray,
        "verticalScrollProjection": scroll,
        "domProjection": dom_projection(measure),
        "measuredTrayVerticalBudget": {
            vp: {
                "stageHeight": v["freeCookTray"]["TOPPING"]["stageRect"]["height"],
                "trayHeight": v["freeCookTray"]["TOPPING"]["trayRect"]["height"],
                "pagerRowHeight": v["freeCookTray"]["TOPPING"]["pagerRect"]["height"],
                "chipSize": [
                    v["freeCookTray"]["TOPPING"]["chips"]["width"],
                    v["freeCookTray"]["TOPPING"]["chips"]["heightMin"],
                ],
                "hintSheetHeight": v["hintSheet"]["sheetRect"]["height"],
            }
            for vp, v in measure["viewports"].items()
        },
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    data = build()
    text = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    if args.check:
        if not OUT.exists() or OUT.read_text(encoding="utf-8") != text:
            print("scale model out of date; rerun without --check", file=sys.stderr)
            return 1
        print("ok")
        return 0
    OUT.write_text(text, encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
