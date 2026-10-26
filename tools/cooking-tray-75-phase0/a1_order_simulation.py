#!/usr/bin/env python3
"""Issue #675 A1 pre-implementation simulation (observation only; no product change).

Input : the measured 75-ingredient run (pr673-75-390x844.json): `allOrder` = the current 「すべて」 order (catalog order),
        `families` = per-family names (the family chips' own order, catalog order within a family).
Model : A1 = the chip order of the families (すべて -> 肉 魚介 野菜 果物 ハーブ スパイス その他), catalog order inside a family.
Output: JSON on stdout. Pages hold 6 (MAX_INGREDIENT_PALETTE_SLOTS).
"""
import json, sys, statistics as st
PAGE = 6
d = json.load(open(sys.argv[1]))
cur = d["allOrder"]
fam_names = {k: sum(v["names"], []) for k, v in d["families"].items() if k != "すべて"}
chip_order = [k for k in d["families"] if k != "すべて"]            # the chips' own order
fam_of = {n: k for k, ns in fam_names.items() for n in ns}
assert set(cur) == set(fam_of), "family map must cover the catalog"
catalog_pos = {n: i for i, n in enumerate(cur)}
def a1_order(items):
    return sorted(items, key=lambda n: (chip_order.index(fam_of[n]), catalog_pos[n]))
a1 = a1_order(cur)
def pages(order): return [order[i:i + PAGE] for i in range(0, len(order), PAGE)]
def page_of(order): return {n: i // PAGE for i, n in enumerate(order)}
def metrics(order):
    pg, po = pages(order), page_of(order)
    span = {}
    for f in chip_order:
        ps = sorted({po[n] for n in fam_names[f]})
        span[f] = {"first": ps[0], "last": ps[-1], "pagesTouched": len(ps), "items": len(fam_names[f])}
    return {
        "pages": len(pg),
        "meanFlips": round(st.mean(po.values()), 2), "maxFlips": max(po.values()),
        "distinctFamiliesPerPageMean": round(st.mean(len({fam_of[n] for n in p}) for p in pg), 2),
        "distinctFamiliesPerPage": [len({fam_of[n] for n in p}) for p in pg],
        "meanPagesTouchedPerFamily": round(st.mean(v["pagesTouched"] for v in span.values()), 2),
        "familySpan": span,
        "flipsToSeeWholeFamilyMean": round(st.mean(v["last"] for v in span.values()), 2),
        "flipsToFirstSightingMean": round(st.mean(v["first"] for v in span.values()), 2),
    }
cur_m, a1_m = metrics(cur), metrics(a1)
# growth stability: one new topping appended to the catalog (current order: appended at the end; A1: end of its family block).
def growth(order_fn, fam):
    new = "NEW-" + fam
    fam_of[new] = fam; catalog_pos[new] = len(cur)
    base = order_fn(cur)
    grown = order_fn(cur + [new])
    pb = {n: i // PAGE for i, n in enumerate(base)}
    pg = {n: i // PAGE for i, n in enumerate(grown) if n != new}
    moved = sum(1 for n in base if pb[n] != pg[n])
    gi = {n: i for i, n in enumerate(grown)}
    slot_moved = sum(1 for i, n in enumerate(base) if gi[n] != i)  # absolute slot (page + position on the page)
    del fam_of[new], catalog_pos[new]
    return moved, slot_moved
cur_fn = lambda items: list(items)
growth_rows = {f: {"current": growth(cur_fn, f)[0], "a1": growth(a1_order, f)[0], "currentSlots": growth(cur_fn, f)[1], "a1Slots": growth(a1_order, f)[1]} for f in chip_order}
out = {"items": len(cur), "current": cur_m, "a1": a1_m,
       "growthItemsChangingPage": growth_rows,
       "growthMeanItemsChangingPage": {"current": round(st.mean(v["current"] for v in growth_rows.values()), 2), "a1": round(st.mean(v["a1"] for v in growth_rows.values()), 2)},
       "growthMeanItemsChangingSlot": {"current": round(st.mean(v["currentSlots"] for v in growth_rows.values()), 2), "a1": round(st.mean(v["a1Slots"] for v in growth_rows.values()), 2)},
       "a1Order": a1, "currentOrder": cur}
print(json.dumps(out, ensure_ascii=False, indent=1))
