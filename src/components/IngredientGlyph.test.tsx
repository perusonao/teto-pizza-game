import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { IngredientGlyph } from "./IngredientGlyph";
import { IngredientPieceVisual } from "./IngredientPieceVisual";
import { IngredientTray } from "./IngredientTray";
import { ResultPanel } from "./ResultPanel";
import { InventoryOverlay } from "./InventoryOverlay";
import { ShopOverlay } from "./ShopOverlay";
import { DexOverlay } from "./DexOverlay";
import { PizzaThumbnail } from "./PizzaThumbnail";
import {
  getIngredient,
  INGREDIENTS,
  type DedicatedIngredientVisual,
  type Ingredient,
  type IngredientCategory,
} from "../data/ingredients";
import { FREE_COOK_RECIPE } from "../data/freeCook";
import { RECIPES, type Recipe } from "../data/recipes";
import { EMPTY_DEX } from "../state/dex";
import { createEmptyPizza } from "../state/pizzaState";
import { createDefaultSave, SAVE_STORAGE_KEY } from "../state/persistence";

/**
 * Production Visual P1 (docs/reports/TETO_PROGRESS2_W1_VISUAL_PRODUCTION_PLAN.md): the
 * IngredientGlyph abstraction must leave every current production ingredient pixel- and
 * DOM-identical to the old `{ingredient.emoji}`, draw a dedicated visual only when an ingredient
 * declares one, and be the only thing in src/** that renders `ingredient.emoji`.
 */

afterEach(() => cleanup());

const DEDICATED: readonly DedicatedIngredientVisual[] = ["tomato-slice", "caper-cluster", "clam-valve"];
const W1_NEW_IDS = ["capers", "clam", "corn", "eggplant", "fresh-tomato", "pineapple", "potato"];
/** Progression 2.0 I5a: the W1 Human Visual Gate authority for the 3 dedicated-visual materials. */
const W1_DEDICATED: Record<string, DedicatedIngredientVisual> = {
  capers: "caper-cluster",
  clam: "clam-valve",
  "fresh-tomato": "tomato-slice",
};
/** Every production row that draws its emoji (no dedicated visual). */
const EMOJI_ROWS = INGREDIENTS.filter((i) => i.pieceVisual === undefined);

/** The pre-P1 rendering of a glyph: the emoji as a bare text node. */
const oldMarkup = (ingredient: Ingredient) => renderToStaticMarkup(<span>{ingredient.emoji}</span>);
const newMarkup = (ingredient: Ingredient) =>
  renderToStaticMarkup(
    <span>
      <IngredientGlyph ingredient={ingredient} />
    </span>,
  );

function fixture(overrides: Partial<Ingredient>): Ingredient {
  return {
    id: "p1-fixture",
    category: "topping",
    nameJa: "テスト具材",
    color: "#cc3333",
    emoji: "\u{1F9EA}",
    placement: "scatter",
    ...overrides,
  };
}

describe("IngredientGlyph: default emoji path (every production ingredient without a dedicated visual)", () => {
  it("production has 29 ingredients and only capers / clam / fresh-tomato declare a dedicated visual (I5a)", () => {
    expect(INGREDIENTS).toHaveLength(29);
    expect(
      Object.fromEntries(INGREDIENTS.filter((i) => i.pieceVisual !== undefined).map((i) => [i.id, i.pieceVisual])),
    ).toEqual(W1_DEDICATED);
    expect(EMOJI_ROWS).toHaveLength(26);
  });

  it.each(EMOJI_ROWS.map((i) => [i.id, i] as const))("%s renders the identical emoji DOM", (_id, ingredient) => {
    expect(newMarkup(ingredient)).toBe(oldMarkup(ingredient));
  });

  it("the emoji path is a single text node, not an element", () => {
    const { container } = render(
      <span data-testid="host">
        <IngredientGlyph ingredient={getIngredient("basil")!} />
      </span>,
    );
    const host = container.firstElementChild!;
    expect(host.childNodes).toHaveLength(1);
    expect(host.firstChild!.nodeType).toBe(Node.TEXT_NODE);
    expect(host.querySelector("svg")).toBeNull();
  });
});

describe("IngredientGlyph: dedicated visual path (fixtures only -- no production row uses it in P1)", () => {
  it.each(DEDICATED)("%s draws its inline SVG and no emoji text", (visual) => {
    const { container } = render(<IngredientGlyph ingredient={fixture({ pieceVisual: visual })} />);
    const svg = container.querySelector("svg")!;
    expect(svg).not.toBeNull();
    expect(svg.getAttribute("data-ingredient-visual")).toBe(visual);
    expect(svg).toHaveClass("ingredient-glyph", `ingredient-glyph--${visual}`);
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("focusable")).toBe("false");
    expect(svg.getAttribute("width")).toBe("1em");
    expect(svg.getAttribute("height")).toBe("1em");
    expect(container.textContent).toBe("");
    // No ids/gradients: many pieces can share one page without id collisions.
    expect(svg.querySelector("[id]")).toBeNull();
    expect(svg.querySelectorAll("path, ellipse").length).toBeGreaterThan(0);
  });

  it("is chosen by the declared visual only, never by the ingredient id", () => {
    const a = renderToStaticMarkup(<IngredientGlyph ingredient={fixture({ id: "alpha", pieceVisual: "tomato-slice" })} />);
    const b = renderToStaticMarkup(<IngredientGlyph ingredient={fixture({ id: "cherry-tomato", pieceVisual: "tomato-slice" })} />);
    expect(a).toBe(b);
    // An id that will later carry a dedicated visual still renders its emoji without one.
    const plain = fixture({ id: "fresh-tomato", emoji: "\u{1F345}" });
    expect(newMarkup(plain)).toBe(oldMarkup(plain));
  });

  it("inside IngredientPieceVisual the bake filter still lands on the piece span around the SVG", () => {
    const { container } = render(
      <IngredientPieceVisual
        ingredient={fixture({ pieceVisual: "clam-valve" })}
        style={{ filter: "brightness(0.9) sepia(0.14)" }}
      />,
    );
    const piece = container.querySelector(".ingredient-piece-visual__emoji") as HTMLElement;
    expect(piece.style.filter).toBe("brightness(0.9) sepia(0.14)");
    expect(piece.querySelector('svg[data-ingredient-visual="clam-valve"]')).not.toBeNull();
  });
});

/**
 * Progression 2.0 I5a: the 3 W1 materials with a Human-approved dedicated visual draw that SVG
 * everywhere, and their required `emoji` text fallback is never drawn.
 */
describe("I5a: W1 dedicated-visual materials never draw their emoji fallback", () => {
  it.each(Object.entries(W1_DEDICATED))("%s -> %s", (id, visual) => {
    const ingredient = getIngredient(id)!;
    expect(ingredient.emoji.length).toBeGreaterThan(0); // the fallback still exists as data

    const glyph = render(<IngredientGlyph ingredient={ingredient} />);
    expect(glyph.container.querySelector(`svg[data-ingredient-visual="${visual}"]`)).not.toBeNull();
    expect(glyph.container.textContent).toBe("");
    expect(glyph.container.innerHTML).not.toContain(ingredient.emoji);
    glyph.unmount();

    const piece = render(<IngredientPieceVisual ingredient={ingredient} />);
    const pieceSpan = piece.container.querySelector(".ingredient-piece-visual__emoji")!;
    expect(pieceSpan.querySelector(`svg[data-ingredient-visual="${visual}"]`)).not.toBeNull();
    expect(pieceSpan.textContent).toBe("");
    piece.unmount();

    const tray = render(
      <IngredientTray
        activeCategory="topping"
        selectedIngredientId={null}
        onSelectIngredient={() => {}}
        ownedIngredientIds={[id]}
        recipe={FREE_COOK_RECIPE}
        freeCook
        inventory={{ [id]: 3 }}
        pizza={createEmptyPizza()}
      />,
    );
    const chip = tray.container.querySelector(".ingredient-chip__emoji")!;
    expect(chip.querySelector(`svg[data-ingredient-visual="${visual}"]`)).not.toBeNull();
    expect(chip.textContent).toBe("");
    expect(tray.getByRole("button", { name: new RegExp(ingredient.nameJa) })).toBeInTheDocument();
    tray.unmount();

    const inventory = render(<InventoryOverlay ownedIngredientIds={[id]} inventory={{ [id]: 1 }} onClose={() => {}} />);
    const card = inventory.container.querySelector(".inventory-card__emoji")!;
    expect(card.querySelector(`svg[data-ingredient-visual="${visual}"]`)).not.toBeNull();
    expect(card.textContent).toBe("");
    inventory.unmount();
  });

  it("corn / eggplant / pineapple / potato draw their approved emoji", () => {
    const expected: Record<string, string> = {
      corn: "\u{1F33D}",
      eggplant: "\u{1F346}",
      pineapple: "\u{1F34D}",
      potato: "\u{1F954}",
    };
    for (const [id, emoji] of Object.entries(expected)) {
      const ingredient = getIngredient(id)!;
      expect(ingredient.emoji).toBe(emoji);
      expect(ingredient.pieceVisual).toBeUndefined();
      expect(renderToStaticMarkup(<IngredientGlyph ingredient={ingredient} />)).toBe(emoji);
    }
  });
});

describe("P1 / I5a scope guard: identity / save untouched", () => {
  it("registers all 7 W1 ingredients (I5a)", () => {
    for (const id of W1_NEW_IDS) expect(getIngredient(id)).toBeDefined();
  });

  it("fresh-tomato is its own id, not an alias of cherry-tomato or tomato-sauce", () => {
    const fresh = getIngredient("fresh-tomato")!;
    expect(fresh.id).toBe("fresh-tomato");
    expect(fresh.nameJa).not.toBe(getIngredient("cherry-tomato")!.nameJa);
    expect(fresh.nameJa).not.toBe(getIngredient("tomato-sauce")!.nameJa);
  });

  it("cherry-tomato keeps its own id and its 🍅 emoji path", () => {
    const cherry = getIngredient("cherry-tomato")!;
    expect(cherry.emoji).toBe("\u{1F345}");
    expect(cherry.pieceVisual).toBeUndefined();
  });

  it("the save never carries a visual descriptor and keeps its key", () => {
    expect(SAVE_STORAGE_KEY).toBe("teto-pizza-save-v1");
    expect(JSON.stringify(createDefaultSave())).not.toContain("pieceVisual");
  });
});

/**
 * Static checker: IngredientGlyph.tsx is the only production file allowed to read `.emoji` for
 * rendering, and each of the 8 audited render sites routes through it. Comments are stripped
 * first so doc comments that mention `ingredient.emoji` don't count.
 */
describe("render-site checker", () => {
  // Every production source under src/ as raw text, keyed "components/Foo.tsx" (tests excluded).
  const SOURCES = Object.fromEntries(
    Object.entries(
      import.meta.glob(["../**/*.ts", "../**/*.tsx", "!../**/*.test.ts", "!../**/*.test.tsx"], {
        query: "?raw",
        import: "default",
        eager: true,
      }) as Record<string, string>,
    ).map(([path, code]) => [path.startsWith("./") ? `components/${path.slice(2)}` : path.replace(/^\.\.\//, ""), code]),
  );
  const AUDITED_SITES: Record<string, number> = {
    "components/IngredientPieceVisual.tsx": 1,
    "components/IngredientTray.tsx": 2,
    "components/ResultPanel.tsx": 1,
    "components/PizzaThumbnail.tsx": 1,
    "components/InventoryOverlay.tsx": 1,
    "components/ShopOverlay.tsx": 1,
    "components/DexOverlay.tsx": 1,
  };

  const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

  it("no production file other than IngredientGlyph.tsx reads `.emoji`", () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(50);
    expect(SOURCES["components/IngredientGlyph.tsx"]).toBeDefined();
    const offenders = Object.entries(SOURCES)
      .filter(([rel]) => rel !== "components/IngredientGlyph.tsx")
      .filter(([, code]) => /\.emoji\b/.test(stripComments(code)))
      .map(([rel]) => rel);
    expect(offenders).toEqual([]);
  });

  it.each(Object.entries(AUDITED_SITES))("%s renders the glyph through IngredientGlyph (%i site(s))", (rel, count) => {
    const code = stripComments(SOURCES[rel]);
    expect(code).toContain('import { IngredientGlyph } from "./IngredientGlyph";');
    expect(code.match(/<IngredientGlyph\b/g) ?? []).toHaveLength(count);
  });

  it("the audited sites add up to the 8 render sites", () => {
    expect(Object.values(AUDITED_SITES).reduce((a, b) => a + b, 0)).toBe(8);
  });
});

/**
 * Site-level: every audited context shows exactly the old glyph text for every emoji-path ingredient, and
 * the dedicated SVG when an ingredient declares one (a fixture row is appended to INGREDIENTS for
 * this block only, then removed).
 */
describe("render sites with every current ingredient (emoji path)", () => {
  const nonCheese = EMOJI_ROWS.filter((i) => i.category !== "cheese");
  const allIds = INGREDIENTS.map((i) => i.id);
  const emojiIds = EMOJI_ROWS.map((i) => i.id);

  it("tray chips show each ingredient's emoji text", () => {
    for (const category of ["sauce", "topping"] as IngredientCategory[]) {
      const ids = EMOJI_ROWS.filter((i) => i.category === category).map((i) => i.id);
      for (let page = 0; page * 6 < ids.length; page += 1) {
        const owned = ids.slice(page * 6, page * 6 + 6);
        const { container, unmount } = render(
          <IngredientTray
            activeCategory={category}
            selectedIngredientId={null}
            onSelectIngredient={() => {}}
            ownedIngredientIds={owned}
            recipe={FREE_COOK_RECIPE}
            freeCook
            inventory={Object.fromEntries(owned.map((id) => [id, 3]))}
            pizza={createEmptyPizza()}
          />,
        );
        const glyphs = Array.from(container.querySelectorAll(".ingredient-chip__emoji"));
        expect(glyphs.map((g) => g.innerHTML)).toEqual(owned.map((id) => getIngredient(id)!.emoji));
        unmount();
      }
    }
  });

  it("pizza pieces (IngredientPieceVisual) show each non-cheese emoji text", () => {
    for (const ingredient of nonCheese) {
      const { container, unmount } = render(<IngredientPieceVisual ingredient={ingredient} />);
      expect(container.querySelector(".ingredient-piece-visual__emoji")!.innerHTML).toBe(ingredient.emoji);
      unmount();
    }
  });

  it("RESULT ingredient list keeps the exact `${emoji} ${nameJa}` text (dedicated rows: SVG + name)", () => {
    const { getByRole } = render(
      <ResultPanel
        completion={{ status: "PASS" }}
        bakeState="perfect"
        sauceScore={null}
        headingJa=""
        recipeNameJa="フリー"
        justDiscovered={false}
        justGotNewBest={false}
        pitzCredit={null}
        freeCook
        onRetrySameRecipe={vi.fn()}
        onBackToPizzaSelect={vi.fn()}
        score={null}
        discovery={{ kind: "ORIGINAL", blockedTargetIds: [] }}
        usedIngredientIds={allIds}
      />,
    );
    const items = within(getByRole("list", { name: "使った材料" })).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual(
      INGREDIENTS.map((i) => (i.pieceVisual ? ` ${i.nameJa}` : `${i.emoji} ${i.nameJa}`)),
    );
    expect(getByRole("list", { name: "使った材料" }).querySelectorAll("svg")).toHaveLength(
      Object.keys(W1_DEDICATED).length,
    );
  });

  it("Inventory shows each owned non-cheese emoji text", () => {
    const { container } = render(
      <InventoryOverlay ownedIngredientIds={emojiIds} inventory={Object.fromEntries(emojiIds.map((id) => [id, 5]))} onClose={() => {}} />,
    );
    const texts = Array.from(container.querySelectorAll(".inventory-card__emoji")).map((e) => e.innerHTML);
    expect(texts.sort()).toEqual(nonCheese.map((i) => i.emoji).sort());
  });

  it("Shop shows each for-sale owned ingredient's emoji text", () => {
    const forSale = INGREDIENTS.filter((i) => i.unlockCondition);
    const { container } = render(
      <ShopOverlay
        dex={EMPTY_DEX}
        ownedIngredientIds={allIds}
        unlockedForShopIngredientIds={[]}
        pitzBalance={9999}
        inventory={Object.fromEntries(allIds.map((id) => [id, 1]))}
        onPurchase={() => {}}
        onRestock={() => {}}
        onClose={() => {}}
      />,
    );
    const texts = Array.from(container.querySelectorAll(".shop-item__emoji")).map((e) => e.innerHTML);
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.every((t) => forSale.some((i) => i.emoji === t))).toBe(true);
    expect(container.querySelector(".shop-item__emoji svg")).toBeNull();
  });

  it("Pizza Select thumbnails show each recipe's non-cheese emoji text", () => {
    for (const recipe of RECIPES as readonly Recipe[]) {
      const { container, unmount } = render(<PizzaThumbnail recipe={recipe} />);
      const expected = recipe.requiredIngredients
        .map((req) => getIngredient(req.ingredientId)!)
        .filter((i) => i.category !== "sauce" && i.category !== "cheese")
        .map((i) => i.emoji);
      expect(Array.from(container.querySelectorAll(".pizza-thumbnail__piece-emoji")).map((e) => e.innerHTML)).toEqual(expected);
      unmount();
    }
  });

  it("Dex ingredient chips keep the exact `${emoji} ${nameJa}` text", () => {
    const dex = RECIPES.map((r) => ({ recipeId: r.id, discovered: true, bestScore: 80, bestStars: 3, timesMade: 1 }));
    const { container } = render(
      <DexOverlay dex={dex as unknown as typeof EMPTY_DEX} newlyDiscoveredId={null} newBestRecipeId={null} onClose={() => {}} />,
    );
    const chips = Array.from(container.querySelectorAll(".dex-card__ingredient"));
    expect(chips.length).toBeGreaterThan(0);
    const expected = RECIPES.flatMap((r) => r.requiredIngredients.map((req) => {
      const i = getIngredient(req.ingredientId)!;
      return `${i.emoji} ${i.nameJa}`;
    }));
    expect(chips.map((c) => c.textContent)).toEqual(expected);
    expect(container.querySelector(".dex-card__ingredient svg")).toBeNull();
  });
});

describe("render sites with a dedicated-visual fixture row", () => {
  // Finite + for sale so it also appears in Shop; starterGrantOnly keeps it out of purchase rows.
  const row = fixture({
    id: "p1-dedicated-fixture",
    nameJa: "専用テスト",
    pieceVisual: "tomato-slice",
    unlockCondition: { minTotalStars: 0 },
    pricePitz: 10,
    restockQuantity: 3,
    starterGrantOnly: true,
  });

  beforeAll(() => {
    INGREDIENTS.push(row);
  });
  afterAll(() => {
    INGREDIENTS.splice(INGREDIENTS.indexOf(row), 1);
  });

  it("tray chip, RESULT list, Inventory, Shop and Pizza Select thumbnail draw the SVG instead of the emoji", () => {
    const tray = render(
      <IngredientTray
        activeCategory="topping"
        selectedIngredientId={null}
        onSelectIngredient={() => {}}
        ownedIngredientIds={[row.id]}
        recipe={FREE_COOK_RECIPE}
        freeCook
        inventory={{ [row.id]: 2 }}
        pizza={createEmptyPizza()}
      />,
    );
    const chip = tray.container.querySelector(".ingredient-chip__emoji")!;
    expect(chip.querySelector('svg[data-ingredient-visual="tomato-slice"]')).not.toBeNull();
    expect(chip.textContent).toBe("");
    // The chip's accessible name still comes from nameJa.
    expect(tray.getByRole("button", { name: /専用テスト/ })).toBeInTheDocument();
    tray.unmount();

    const result = render(
      <ResultPanel
        completion={{ status: "PASS" }}
        bakeState="perfect"
        sauceScore={null}
        headingJa=""
        recipeNameJa="フリー"
        justDiscovered={false}
        justGotNewBest={false}
        pitzCredit={null}
        freeCook
        onRetrySameRecipe={vi.fn()}
        onBackToPizzaSelect={vi.fn()}
        score={null}
        discovery={{ kind: "ORIGINAL", blockedTargetIds: [] }}
        usedIngredientIds={[row.id]}
      />,
    );
    const li = within(result.getByRole("list", { name: "使った材料" })).getByRole("listitem");
    expect(li.querySelector('svg[data-ingredient-visual="tomato-slice"]')).not.toBeNull();
    expect(li.textContent).toBe(" 専用テスト");
    result.unmount();

    const inventory = render(<InventoryOverlay ownedIngredientIds={[row.id]} inventory={{ [row.id]: 1 }} onClose={() => {}} />);
    expect(inventory.container.querySelector('.inventory-card__emoji svg[data-ingredient-visual="tomato-slice"]')).not.toBeNull();
    inventory.unmount();

    // Progression 2.0 I4b-4: the Shop lists only Discovery Ladder materials, so the fixture row
    // (not on the ladder) is never a Shop row. The Shop's glyph path is checked on a real ladder
    // material (egg) given the same dedicated visual for the duration of this render.
    const egg = getIngredient("egg")!;
    const eggVisual = egg.pieceVisual;
    egg.pieceVisual = "tomato-slice";
    try {
      const shop = render(
        <ShopOverlay
          dex={EMPTY_DEX}
          ownedIngredientIds={["egg"]}
          unlockedForShopIngredientIds={["egg"]}
          pitzBalance={999}
          inventory={{ egg: 0 }}
          onPurchase={() => {}}
          onRestock={() => {}}
          onClose={() => {}}
        />,
      );
      expect(shop.container.querySelector('.shop-item__emoji svg[data-ingredient-visual="tomato-slice"]')).not.toBeNull();
      expect(shop.container.textContent).not.toContain(egg.emoji);
      shop.unmount();
    } finally {
      egg.pieceVisual = eggVisual;
    }

    const recipe = { ...RECIPES[0], requiredIngredients: [{ ingredientId: row.id, minCount: 1 }] } as unknown as Recipe;
    const thumb = render(<PizzaThumbnail recipe={recipe} />);
    expect(thumb.container.querySelector('.pizza-thumbnail__piece-emoji svg[data-ingredient-visual="tomato-slice"]')).not.toBeNull();
    thumb.unmount();
  });
});
