# Discovery Hint 3.0 H3-4 — Human Verification seeds (Issue #238)

Save seeds for the Fresh Audit §11 Human Verification matrix (HV-1 … HV-17). They let a reviewer reach
each Hint sheet state on a real iPhone without replaying the discovery ladder.

**This is docs only.** No seed helper ships in the game, and nothing here touches a production save.

## Safety rules

1. **Use a Preview build only.**
   - A Preview build shows the `PREVIEW` badge.
   - It stores its save under `teto-pizza-preview-save-v1`, not the production key
     `teto-pizza-save-v1` (`src/state/persistence.ts`). This matters because Preview and production
     share the `perusonao.github.io` origin.
   - The snippet below refuses to run without the Preview badge, and it only ever writes the
     Preview key.
2. **Back up first:** `copy(localStorage.getItem("teto-pizza-preview-save-v1"))` in the console
   copies the current Preview save to the clipboard. To restore it:
   `localStorage.setItem("teto-pizza-preview-save-v1", <pasted>)`.
3. Every seed **replaces** the Preview save, then reloads the page.

## How to run it on an iPhone

1. On the iPhone: Settings → Safari → Advanced → Web Inspector: on. Open the Preview URL in Safari.
2. On a Mac: Safari → Develop → [the iPhone] → the Preview page → Console.
3. Paste the snippet once per page load. Then run, for example, `h34Seed("HV8_LEGACY_H2_PLUS_NEW")`.
4. In the game:
   1. Tap フリークッキング.
   2. Shape the dough.
   3. Tap 次へ until the トッピング step.
   4. Tap 「ヒント」.

## Snippet

```js
(() => {
  if (!document.querySelector(".preview-badge")) throw new Error("H3-4 seeds: Preview build only (no PREVIEW badge found).");
  const KEY = "teto-pizza-preview-save-v1";
  // The discovery ladder (e2e/discovery-hint-sheet.spec.ts): recipe, the materials its step unlocks.
  const LADDER = [
    ["margherita", []], ["bismarck", ["egg"]], ["breakfast-pizza", ["bacon"]], ["funghi", ["mushroom"]],
    ["melanzane-pizza", ["eggplant"]], ["parmigiana-pizza", ["parmigiano"]], ["pepperoni", ["pepperoni"]],
    ["salsiccia", ["sausage"]], ["meat-lovers", ["ham"]], ["bambino", ["corn"]], ["hawaiian", ["pineapple"]],
    ["capricciosa", ["black-olive", "oregano"]], ["pizza-portuguesa", ["onion"]], ["fugazza", ["olive-oil"]],
    ["marinara", ["garlic"]], ["napoletana", ["anchovy"]], ["tonno-e-cipolla", ["tuna"]], ["pesto-tonno", ["pesto"]],
    ["genovese", ["cherry-tomato"]], ["new-haven-apizza", ["clam"]], ["pesto-caprese", ["fresh-tomato"]],
    ["pesto-patate", ["potato"]], ["pizza-bianca", ["rosemary"]], ["puttanesca-pizza", ["capers"]],
    ["quattro-formaggi", ["fontina", "gorgonzola"]],
  ];
  // Dex = the first `count` recipes; the next recipe's materials are owned, so it is the hint target.
  const save = (count, pitz, purchases, facts) => {
    const materials = LADDER.slice(1, count + 1).flatMap(([, m]) => m);
    return {
      schemaVersion: 2,
      dex: LADDER.slice(0, count).map(([recipeId]) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
      pitzBalance: pitz,
      ...(purchases ? { discoveryHintPurchases: purchases } : {}),
      ...(facts ? { discoveryHintFacts: facts } : {}),
      ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", ...materials],
      missionBest: {},
      inventory: Object.fromEntries(materials.map((m) => [m, 10])),
      starterGrantClaimedRecipeIds: [],
      unlockedForShopIngredientIds: materials,
    };
  };
  const SEEDS = {
    HV1_DEX0_MARGHERITA: save(0, 0),
    HV2_FRESH: save(11, 120),                                        // capricciosa target, 4 facts for sale
    HV6_SHORT_PITZ: save(11, 25, { capricciosa: 3 }),                // legacy H3, next 40 > 25
    HV7_LEGACY_H1: save(11, 200, { capricciosa: 1 }),                // 10 -> 20 -> 40 -> 支払いずみ (real fact) -> guidance
    HV7_LEGACY_H2: save(11, 200, { capricciosa: 2 }),
    HV7_LEGACY_H3: save(11, 200, { capricciosa: 3 }),                // 「以前のヒント」 archive
    HV7_LEGACY_H4: save(11, 200, { capricciosa: 4 }),                // 支払いずみ -> guidance; archive
    HV8_LEGACY_H2_PLUS_NEW: save(11, 200, { capricciosa: 2 }, { capricciosa: ["ing:ham"] }),
    HV9_ALL_BOUGHT_FRESH: save(11, 120, undefined, { capricciosa: ["ing:tomato-sauce", "ing:mozzarella", "ing:mushroom", "ing:ham"] }),
    HV10_ONE_FACT_RECIPE: save(1, 50),                               // 5 Pitz, then a priced request -> guidance, 0 charged
    HV10_PIZZA_BIANCA: save(22, 50),                                  // zero sellable facts: looks like any sheet (5 Pitz) -> guidance
  };
  window.h34Seed = (name) => {
    if (!SEEDS[name]) throw new Error(`unknown seed ${name}; one of: ${Object.keys(SEEDS).join(", ")}`);
    localStorage.setItem(KEY, JSON.stringify(SEEDS[name]));
    location.reload();
  };
  console.log("H3-4 seeds ready:", Object.keys(SEEDS).join(", "));
})();
```

## Seed → HV scenario

| Seed | HV | What to look at |
|---|---|---|
| `HV1_DEX0_MARGHERITA` | HV-1 | Free onboarding, unchanged: 「次のヒントを見る」, no Pitz |
| `HV2_FRESH` | HV-2, 3, 4, 5, 9, 12, 13, 16 | 「ヒントを1つもらう 5 Pitz」, 「Pitzはヒントが出たときだけ使うよ」, the new-chip highlight, the double tap buying one fact, the fallback (ソース twice → チーズ) with no 「ない」, the fourth buy leading to 「ヒントをたずねる／支払いずみ」 (enabled), then guidance and only then 「今あるヒントはここまで」 (disabled), and a reload |
| `HV6_SHORT_PITZ` | HV-6 | Disabled 「ヒントを1つもらう 40 Pitz」 in grey and 「Pitzがたまったら、またためしてね。」. 閉じる and cooking still work. |
| `HV7_LEGACY_H1…H4` | HV-7 | The ladder continues at 10 / 20 / 40 / 支払いずみ. H3/H4: the 「以前のヒント」 archive box at the end of the body |
| `HV8_LEGACY_H2_PLUS_NEW` | HV-8 | 40 Pitz → 支払いずみ → **a real chip, the balance unchanged** → 支払いずみ → guidance |
| `HV9_ALL_BOUGHT_FRESH` | HV-9 | 「ヒントをたずねる／支払いずみ」 looks the same as HV-8's state before its free fact; pressing shows guidance |
| `HV10_ONE_FACT_RECIPE`, `HV10_PIZZA_BIANCA` | HV-10 | A normal price before the request. After it: guidance, **0 charged**, the CTA stops |
| any Dex ≥ 1 seed | HV-11 | Bake an off-by-one pizza → the RESULT near-miss line → 「💡 ヒントを見る」 |
| — | HV-14 / HV-15 | Repeat HV-2 and HV-7 (H4) on a 390×844-class iPhone and on a small one (SE / reduced Safari viewport) |
| — | HV-17 | A Dinner run shows no 「ヒント」 entry |
