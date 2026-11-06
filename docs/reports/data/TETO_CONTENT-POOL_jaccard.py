#!/usr/bin/env python3
"""Static Jaccard pre-check for candidate recipes (Issue #772, docs-only). Reads src/data/recipes.ts + lateCatalog.ts requiredIngredients
(ingredient id SETS only, minCount ignored, sauces counted as ingredients). NOT the game's own validator: confirm with the real tests in the Batch PR."""
import re, json, sys, itertools
root = sys.argv[1] if len(sys.argv) > 1 else "."
src = open(f"{root}/src/data/recipes.ts").read() + "\n" + open(f"{root}/src/data/lateCatalog.ts").read()
rec = {}
for m in re.finditer(r'\n\s{4}id: "([a-z0-9-]+)",\s*\n\s*nameJa:.*?requiredIngredients: \[(.*?)\]\s*,', src, re.S):
    rec[m.group(1)] = set(re.findall(r'ingredientId: "([a-z0-9-]+)"', m.group(2)))
rec = {k: v for k, v in rec.items() if v}
CAND = {
 "bulgogi+newSweetSoySauce": {"beef","mozzarella","onion","white-sesame","sweet-soy-sauce"},
 "bulgogi NO_SAUCE": {"beef","mozzarella","onion","white-sesame"},
 "teriyaki+newTeriyakiSauce": {"chicken","mayo","nori","onion","teriyaki-sauce"},
 "teriyaki NO_SAUCE": {"chicken","mayo","nori","onion"},
 "keema curry-ketchup+beef": {"curry-ketchup","mozzarella","onion","beef"},
 "keema curry-ketchup+ground-beef(new)": {"curry-ketchup","mozzarella","onion","ground-beef"},
 "keema curry-ketchup+ground-beef+chili-oil(new)": {"curry-ketchup","mozzarella","onion","ground-beef","chili-oil"},
 "philly beef+pepper+onion+mozzarella": {"beef","green-pepper","onion","mozzarella"},
 "chilena tomato+ground-beef(new)": {"tomato-sauce","black-olive","egg","mozzarella","onion","ground-beef"},
 "chilena tomato+beef": {"tomato-sauce","black-olive","egg","mozzarella","onion","beef"},
 "baiana +chili-oil(new)": {"tomato-sauce","egg","mozzarella","onion","sausage","chili-oil"},
 "baiana omit chili": {"tomato-sauce","egg","mozzarella","onion","sausage"},
 "de-cancha +chili-oil(new)": {"tomato-sauce","olive-oil","garlic","oregano","chili-oil"},
 "de-cancha omit chili": {"tomato-sauce","olive-oil","garlic","oregano"},
 "hokkaido bacon+corn+potato+mozzarella": {"bacon","corn","potato","mozzarella"},
 "zucchine-menta": {"olive-oil","lemon","mint","mozzarella","ricotta","zucchini"},
}
def j(a,b): return len(a&b)/len(a|b)
out = {}
for n, s in CAND.items():
    rows = sorted(((j(s, v), k, len(s ^ v)) for k, v in rec.items()), reverse=True)[:3]
    ident = [k for k, v in rec.items() if v == s]
    sub = [k for k, v in rec.items() if v < s]
    sup = [k for k, v in rec.items() if v > s]
    one = [k for k, v in rec.items() if len(s ^ v) == 1]
    out[n] = {"set": sorted(s), "top3": [(round(a,3), k, d) for a,k,d in rows], "identical": ident, "subsetOfCandidate": sub, "supersetOfCandidate": sup, "oneIngredientDiff": one, "over0.4": rows[0][0] > 0.4}
print(json.dumps({"existingRecipesParsed": len(rec), "results": out}, ensure_ascii=False, indent=1))
