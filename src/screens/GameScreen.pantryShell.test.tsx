import "@testing-library/jest-dom/vitest";
import { useReducer, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { GameScreen } from "./GameScreen";
import { createInitialGameState, gameReducer, type GameState } from "../state/gameReducer";
import { INITIAL_MISSION_STATE } from "../mission/lunchRush";
import { resolvePieceDrop } from "../logic/pieceDrag";
import { emptySauceMetrics } from "../logic/sauceField";
import { getIngredient, INGREDIENTS, STARTER_INGREDIENT_IDS, type Ingredient, type IngredientCategory } from "../data/ingredients";
import type { DoughPoint } from "../logic/pizzaCoordinates";

/**
 * Large Catalog UX LC-R3: the 食材庫 entry and pantry sheet SHELL inside the real GameScreen and reducer.
 * jsdom has no layout, so the pixel contract (stage size, sheet bounds, scroll ownership) is pinned by
 * e2e/large-catalog-pantry-shell.spec.ts; this file pins eligibility, privacy, open / close / focus and
 * "opening changes nothing".
 */
const FINITE = INGREDIENTS.filter((i) => i.unlockCondition).map((i) => i.id);
const TOPPINGS = INGREDIENTS.filter((i) => i.category === "topping").map((i) => i.id);
// 10 owned toppings (3 starters-side + 9 bought) => the topping step pages => the pager row is reserved.
const OWNED_TOPPINGS = TOPPINGS.slice(0, 10);
const OWNED = [...STARTER_INGREDIENT_IDS, ...OWNED_TOPPINGS.filter((id) => !STARTER_INGREDIENT_IDS.includes(id as never))];
const INVENTORY = Object.fromEntries(OWNED.map((id) => [id, 4]));

function toStep(state: GameState, step: GameState["makingStep"]): GameState {
  let s = gameReducer(state, { type: "BEGIN_PREPARE" });
  for (let i = 0; i < 6 && s.makingStep !== step; i += 1) s = gameReducer(s, { type: "CONFIRM_MAKING_STEP" });
  return s;
}
const freeBase = () => createInitialGameState([], OWNED, 0, INVENTORY, [], FINITE, {});
const freeTopping = () => toStep(freeBase(), "TOPPING");

function dinnerState(): GameState {
  const dex = ["margherita", "bismarck", "breakfast-pizza", "funghi", "marinara"].map((recipeId) => ({
    recipeId,
    discovered: true,
    bestScore: 70,
    bestStars: 3 as const,
    timesMade: 1,
  }));
  const owned = [...OWNED, "egg", "bacon", "mushroom"];
  const s = gameReducer(createInitialGameState(dex, owned, 500, { ...INVENTORY, egg: 2, bacon: 3, mushroom: 3 }, [], FINITE, {}), {
    type: "DINNER_START",
    missionId: "dm-a",
    now: 1_000_000,
    durationMs: 600_000,
    minimumStars: 3,
  });
  if (s.dinner === null) throw new Error("Dinner did not start");
  return s;
}

function guidedState(): GameState {
  const dex = [{ recipeId: "margherita", discovered: true, bestScore: 70, bestStars: 3 as const, timesMade: 1 }];
  const s = gameReducer(createInitialGameState(dex, OWNED, 0, INVENTORY, [], FINITE, {}), { type: "SELECT_RECIPE", recipeId: "margherita" as never });
  if (s.roundKind !== "GUIDED") throw new Error("expected guided");
  return s;
}

function Harness({ initial, category = "topping" }: { initial: GameState; category?: IngredientCategory }) {
  const [state, dispatch] = useReducer(gameReducer, initial);
  const [activeCategory, setActiveCategory] = useState<IngredientCategory>(category);
  const [selectedIngredientId, setSelectedIngredientId] = useState<string | null>(null);
  function resolvePhysicalDrop(clientX: number, clientY: number): DoughPoint | null {
    return resolvePieceDrop(clientX, clientY, { left: 0, top: 0, width: 300, height: 300 } as DOMRect);
  }
  function handleTapPizza(x: number, y: number) {
    const ingredient = selectedIngredientId ? getIngredient(selectedIngredientId) : undefined;
    if (ingredient && ingredient.placement !== "spread") dispatch({ type: "PLACE_TOPPING", ingredientId: ingredient.id, x, y });
  }
  return (
    <div>
      <span data-testid="state-json">{JSON.stringify({ ...state, hint: null })}</span>
      <span data-testid="selected">{selectedIngredientId ?? ""}</span>
      <GameScreen
        state={state}
        mission={INITIAL_MISSION_STATE}
        missionNow={0}
        missionDurationSeconds={180}
        missionBestAtStartOfRun={0}
        activeCategory={activeCategory}
        selectedIngredientId={selectedIngredientId}
        bakeProgress={null}
        referenceModeEnabled={false}
        referencePizza={null}
        isReferencePopoverOpen={false}
        isGlobalOverlayOpen={false}
        sauceMetrics={emptySauceMetrics()}
        sauceShadowScore={{ quantitySimilarity: 0, coverageSimilarity: 0, overall: 0 }}
        isDispensingSauce={false}
        pieceShadowMetrics={[]}
        showDoughShape
        doughShapeComplete={false}
        onGoHome={() => {}}
        onBeginPrepare={() => {}}
        onResetPizza={() => dispatch({ type: "RESET_PIZZA" })}
        onConfirmMakingStep={() => dispatch({ type: "CONFIRM_MAKING_STEP" })}
        onStartBake={() => {}}
        onShowHint={() => dispatch({ type: "SHOW_HINT" })}
        onUnlockHint={() => {}}
        onCloseHint={() => dispatch({ type: "CLOSE_HINT" })}
        onChangeCategory={setActiveCategory}
        onSelectIngredient={(ingredient: Ingredient) => setSelectedIngredientId(ingredient.id)}
        onClearIngredientSelection={() => setSelectedIngredientId(null)}
        onTapPizza={handleTapPizza}
        onBakeTick={() => {}}
        onConfirmBake={() => {}}
        onRetrySameRecipe={() => {}}
        onBackToPizzaSelect={() => {}}
        onMissionServeNext={() => {}}
        onMissionSkipOrder={() => {}}
        onMissionStart={() => {}}
        onMissionExitToFree={() => {}}
        onMissionCloseIntro={() => {}}
        onShowRanking={() => {}}
        onReferencePopoverChange={() => {}}
        onDispenseProgress={() => {}}
        onDispenseCommit={() => {}}
        onDoughStretchProgress={() => {}}
        onDoughStretchCommit={() => {}}
        onAddCutLine={() => {}}
        onUndoCutLine={() => {}}
        cutRejectionMessage={null}
        onDoughElementChange={() => {}}
        resolvePhysicalDrop={resolvePhysicalDrop}
        onPhysicalDrop={() => {}}
        {...(initial.dinner ? { dinner: undefined } : {})}
      />
    </div>
  );
}

afterEach(() => cleanup());

const entry = () => screen.queryByRole("button", { name: /食材庫/ });
const chipNames = () => [...document.querySelectorAll(".ingredient-chip__name")].map((n) => n.textContent);
const stateJson = () => screen.getByTestId("state-json").textContent;

describe("LC-R3 entry eligibility (FREE Cooking cooking screen only)", () => {
  it("FREE Cooking at the topping step with a paged tray shows the entry", () => {
    render(<Harness initial={freeTopping()} />);
    expect(freeTopping().roundKind).toBe("FREE_COOK");
    expect(entry()).toBeInTheDocument();
    expect(entry()).toHaveAttribute("aria-haspopup", "dialog");
    // It lives inside the existing pager row (no extra row): a sibling of the pager group.
    const row = entry()!.closest(".ingredient-page-nav");
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByRole("group", { name: "素材ページ切り替え" })).toBeInTheDocument();
  });

  it("the initial FREE round in ORDER (no tray, no cooking interaction) shows no entry", () => {
    const initial = freeBase();
    expect(initial.roundKind).toBe("FREE_COOK");
    expect(initial.phase).toBe("ORDER");
    render(<Harness initial={initial} />);
    expect(entry()).not.toBeInTheDocument();
  });

  it("FREE PREPARE at the DOUGH step (tray hidden) shows no entry", () => {
    const s = gameReducer(freeBase(), { type: "BEGIN_PREPARE" });
    expect(s.makingStep).toBe("DOUGH");
    render(<Harness initial={s} />);
    expect(entry()).not.toBeInTheDocument();
  });

  it("no entry when the round has no paged step (the pager row is not reserved, so there is no room: no new row)", () => {
    const few = toStep(createInitialGameState([], [...STARTER_INGREDIENT_IDS], 0, {}, [], FINITE, {}), "TOPPING");
    render(<Harness initial={few} />);
    expect(document.querySelector(".ingredient-page-nav")).toBeNull();
    expect(entry()).not.toBeInTheDocument();
  });

  it("Dinner: no entry, and the existing paged tray is unchanged", () => {
    const d = dinnerState();
    expect(d.roundKind).toBe("DINNER");
    const dinnerAtTray = toStep(d, "TOPPING");
    render(<Harness initial={dinnerAtTray} />);
    expect(entry()).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "素材ページ切り替え" })).toBeInTheDocument(); // same paged tray as before
    expect(chipNames().length).toBeGreaterThan(0);
    expect(document.querySelector(".pantry-entry")).toBeNull();
  });

  it("guided round: no entry (recipe-only tray)", () => {
    const g = toStep(guidedState(), "TOPPING");
    render(<Harness initial={g} />);
    expect(entry()).not.toBeInTheDocument();
  });

  it("Lunch Rush round kind: no entry", () => {
    const g = toStep(guidedState(), "TOPPING");
    render(<Harness initial={{ ...g, roundKind: "LUNCH_RUSH", isMissionRound: true } as GameState} />);
    expect(entry()).not.toBeInTheDocument();
  });

  it("the entry is not offered from a FREE-kind state that still carries a Dinner session", () => {
    const g = freeTopping();
    render(<Harness initial={{ ...g, dinner: dinnerState().dinner } as GameState} />);
    expect(entry()).not.toBeInTheDocument();
  });
});

describe("LC-R3 open / close, focus, keyboard", () => {
  it("open: dialog with an accessible name; focus lands inside on 閉じる; the page keeps its tray", () => {
    render(<Harness initial={freeTopping()} />);
    const before = chipNames();
    fireEvent.click(entry()!);
    const dialog = screen.getByRole("dialog", { name: /食材庫/ });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByRole("button", { name: "閉じる" })).toHaveFocus();
    expect(chipNames()).toEqual(before);
  });

  it("close button closes and returns focus to the entry", () => {
    render(<Harness initial={freeTopping()} />);
    fireEvent.click(entry()!);
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(entry()).toHaveFocus();
  });

  it("Escape inside the sheet closes it and returns focus to the entry", () => {
    render(<Harness initial={freeTopping()} />);
    fireEvent.click(entry()!);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(entry()).toHaveFocus();
  });

  it("a backdrop tap closes; a tap inside the sheet does not", () => {
    render(<Harness initial={freeTopping()} />);
    fireEvent.click(entry()!);
    fireEvent.click(screen.getByRole("dialog"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(document.querySelector(".pantry-sheet__backdrop")!);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("the scroll region is a labelled, keyboard-focusable region (tabIndex 0)", () => {
    render(<Harness initial={freeTopping()} />);
    fireEvent.click(entry()!);
    const list = screen.getByRole("region", { name: "所持している材料" });
    expect(list).toHaveAttribute("tabindex", "0");
    expect(list.className).toContain("pantry-sheet__list");
  });

  it("while open, cooking input is paused (a dough tap places nothing); after closing it works again", () => {
    render(<Harness initial={freeTopping()} />);
    const dough = () => {
      const el = document.querySelector('[data-pizza-drop-target="true"]') as HTMLElement;
      el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 300, right: 300, bottom: 300, x: 0, y: 0, toJSON: () => {} }) as DOMRect;
      return el;
    };
    fireEvent.click(screen.getAllByRole("button", { name: /バジル/ })[0]);
    fireEvent.click(entry()!);
    fireEvent.pointerDown(dough(), { pointerId: 1, isPrimary: true, pointerType: "touch", clientX: 150, clientY: 150 });
    fireEvent.pointerUp(dough(), { pointerId: 1, clientX: 150, clientY: 150 });
    expect(document.querySelectorAll(".pizza-topping")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    fireEvent.pointerDown(dough(), { pointerId: 2, isPrimary: true, pointerType: "touch", clientX: 150, clientY: 150 });
    fireEvent.pointerUp(dough(), { pointerId: 2, clientX: 150, clientY: 150 });
    expect(document.querySelectorAll(".pizza-topping")).toHaveLength(1);
  });
});

describe("LC-R3 OWNED-only privacy and shell content", () => {
  it("lists exactly the owned toppings of the active category, catalog order, with stock", () => {
    render(<Harness initial={freeTopping()} />);
    fireEvent.click(entry()!);
    const names = [...document.querySelectorAll(".pantry-tile__name")].map((n) => n.textContent);
    expect(names).toEqual(OWNED_TOPPINGS.map((id) => getIngredient(id)!.nameJa));
    expect(document.querySelectorAll(".pantry-tile__stock")).toHaveLength(names.length);
  });

  it("never shows an unowned / locked / not-yet-bought ingredient, a silhouette, ??? or an unowned name", () => {
    render(<Harness initial={freeTopping()} />);
    fireEvent.click(entry()!);
    const dialog = screen.getByRole("dialog");
    const text = dialog.textContent ?? "";
    const ownedNames = OWNED.map((id) => getIngredient(id)!.nameJa);
    const tileNames = [...dialog.querySelectorAll(".pantry-tile__name")].map((n) => n.textContent ?? "");
    for (const id of INGREDIENTS.map((i) => i.id).filter((id) => !OWNED.includes(id))) {
      const name = getIngredient(id)!.nameJa;
      expect(tileNames).not.toContain(name);
      // A whole unowned name may only appear as a fragment of an owned name (e.g. トマト in チェリートマト).
      if (!ownedNames.some((n) => n.includes(name))) expect(text).not.toContain(name);
    }
    expect(text).not.toMatch(/\?\?\?|？？？|NEW|LOCKED|🔒/);
    expect(dialog.querySelectorAll("[class*='silhouette'], [class*='locked']")).toHaveLength(0);
  });

  it("shows the active step's category only (cheese step -> owned cheeses)", () => {
    render(<Harness initial={toStep(freeBase(), "CHEESE")} category="cheese" />);
    const trigger = entry();
    if (trigger) {
      fireEvent.click(trigger);
      const names = [...document.querySelectorAll(".pantry-tile__name")].map((n) => n.textContent);
      expect(names).toEqual(["モッツァレラ"]);
    } else {
      // With one owned cheese the row is still reserved by the topping step's paging, so it must exist.
      throw new Error("expected the entry on the cheese step of a round whose topping step pages");
    }
  });

  it("zero-stock owned rows are listed last and marked ×0", () => {
    const s = freeTopping();
    render(<Harness initial={{ ...s, inventory: { ...s.inventory, basil: 0, garlic: 0 } }} />);
    fireEvent.click(entry()!);
    const stocks = [...document.querySelectorAll(".pantry-tile__stock")].map((n) => n.textContent);
    expect(stocks.slice(-1)[0]).toBe("×0");
  });
});

describe("LC-R3 opening changes nothing", () => {
  it("game state, ownership, inventory, selection and the tray are identical before / after open + close", () => {
    render(<Harness initial={freeTopping()} />);
    fireEvent.click(screen.getAllByRole("button", { name: /バジル/ })[0]);
    const selected = screen.getByTestId("selected").textContent;
    const before = { json: stateJson(), chips: chipNames(), selected };
    fireEvent.click(entry()!);
    expect(screen.getByTestId("selected").textContent).toBe(selected); // no #197 clear: nothing filtered
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect({ json: stateJson(), chips: chipNames(), selected: screen.getByTestId("selected").textContent }).toEqual(before);
  });

  it("the pantry does not reduce reachability: every owned topping is still on the tray pages (GameScreen without a tray hand)", () => {
    render(<Harness initial={freeTopping()} />);
    const seen = new Set(chipNames());
    fireEvent.click(screen.getByRole("button", { name: "次のページ" }));
    for (const n of chipNames()) seen.add(n);
    expect([...seen].sort()).toEqual(OWNED_TOPPINGS.map((id) => getIngredient(id)!.nameJa).sort());
  });
});

/**
 * Large Catalog UX LC-R4 (Owner-confirmed OD-R4-1 / OD-R4-2): shelf filtering inside the active-category pantry.
 * OWNED_TOPPINGS spans the shelves meat (sausage, pepperoni), seafood (anchovy), vegetable (cherry-tomato,
 * mushroom, onion), herb (basil, garlic, oregano) and other (egg); fruit and spice are NOT represented.
 */
const shelfChipLabels = () => [...document.querySelectorAll(".shelf-chip")].map((n) => n.textContent);
const tileNames = () => [...document.querySelectorAll(".pantry-tile__name")].map((n) => n.textContent);
const namesOf = (ids: string[]) => ids.map((id) => getIngredient(id)!.nameJa);
const ALL_NAMES = namesOf(OWNED_TOPPINGS);
const chip = (label: string) => screen.getByRole("button", { name: label, pressed: undefined });

describe("LC-R4 chips are derived from the OWNED rows of the active category", () => {
  it("topping step: すべて + only the represented shelves, in the shelf authority order, no counts", () => {
    render(<Harness initial={freeTopping()} />);
    fireEvent.click(entry()!);
    expect(shelfChipLabels()).toEqual(["すべて", "肉", "魚介", "野菜・きのこ", "ハーブ・香味", "その他"]);
    const dialog = screen.getByRole("dialog");
    // Unrepresented shelves have no chip, node, data attribute or text.
    for (const absent of ["果物", "スパイス・薬味", "ソース", "チーズ"]) expect(dialog.textContent).not.toContain(absent);
    for (const shelf of ["fruit", "spice", "sauce", "cheese"]) expect(dialog.querySelector(`[data-shelf="${shelf}"]`)).toBeNull();
    for (const c of dialog.querySelectorAll(".shelf-chip")) expect(c.textContent).not.toMatch(/\d/);
  });

  it("the chips sit in the fixed slot between the subtitle and the list, outside the scroll region", () => {
    render(<Harness initial={freeTopping()} />);
    fireEvent.click(entry()!);
    const slot = document.querySelector(".pantry-sheet__shelves")!;
    const list = document.querySelector(".pantry-sheet__list")!;
    expect(slot.querySelectorAll(".shelf-chip").length).toBeGreaterThan(1);
    expect(list.contains(slot)).toBe(false);
    expect(slot.nextElementSibling).toBe(list);
    // LC-R5-b: the topping category has more than one page of owned rows, so the search row sits between the subtitle and the chips.
    expect(slot.previousElementSibling?.className).toContain("pantry-sheet__search");
    expect(slot.previousElementSibling?.previousElementSibling?.className).toContain("pantry-sheet__subtitle");
    expect(screen.getByRole("group", { name: "材料の分類" })).toBeInTheDocument();
  });

  it("sauce step and cheese step (one shelf each): no chip row at all", () => {
    for (const [step, category] of [["SAUCE", "sauce"], ["CHEESE", "cheese"]] as const) {
      render(<Harness initial={toStep(freeBase(), step)} category={category} />);
      fireEvent.click(entry()!);
      expect(document.querySelector(".pantry-sheet__shelves")).toBeNull();
      expect(document.querySelectorAll(".shelf-chip")).toHaveLength(0);
      expect(tileNames().length).toBeGreaterThan(0);
      cleanup();
    }
  });

  it("two shelves owned in the topping category: the row is shown (and only those shelves)", () => {
    const owned = [...STARTER_INGREDIENT_IDS, "garlic", "oregano", "rosemary", "sausage", "pepperoni", "bacon", "ham"];
    const two = createInitialGameState([], owned, 0, Object.fromEntries(owned.map((id) => [id, 4])), [], FINITE, {});
    render(<Harness initial={toStep(two, "TOPPING")} />);
    fireEvent.click(entry()!);
    expect(shelfChipLabels()).toEqual(["すべて", "肉", "ハーブ・香味"]);
  });
});

describe("LC-R4 filtering", () => {
  it("すべて is active by default and lists every owned row of the category", () => {
    render(<Harness initial={freeTopping()} />);
    fireEvent.click(entry()!);
    expect(tileNames()).toEqual(ALL_NAMES);
    expect(chip("すべて")).toHaveAttribute("aria-pressed", "true");
  });

  it("each represented shelf shows exactly its owned rows (catalog order); exactly one chip is pressed", () => {
    render(<Harness initial={freeTopping()} />);
    fireEvent.click(entry()!);
    const expected: Record<string, string[]> = {
      肉: ["sausage", "pepperoni"],
      魚介: ["anchovy"],
      "野菜・きのこ": ["cherry-tomato", "mushroom", "onion"],
      "ハーブ・香味": ["basil", "garlic", "oregano"],
      その他: ["egg"],
    };
    const catalogOrder = TOPPINGS.filter((id) => OWNED_TOPPINGS.includes(id));
    for (const [label, ids] of Object.entries(expected)) {
      fireEvent.click(chip(label));
      expect(tileNames(), label).toEqual(namesOf(catalogOrder.filter((id) => ids.includes(id))));
      expect(chip(label)).toHaveAttribute("aria-pressed", "true");
      expect([...document.querySelectorAll('.shelf-chip[aria-pressed="true"]')]).toHaveLength(1);
    }
    fireEvent.click(chip("すべて"));
    expect(tileNames()).toEqual(ALL_NAMES);
  });

  it("privacy: no unowned name, silhouette, ??? or LOCKED / NEW text under any filter, and no counts", () => {
    render(<Harness initial={freeTopping()} />);
    fireEvent.click(entry()!);
    const ownedNames = OWNED.map((id) => getIngredient(id)!.nameJa);
    for (const label of ["すべて", "肉", "魚介", "野菜・きのこ", "ハーブ・香味", "その他"]) {
      fireEvent.click(chip(label));
      const dialog = screen.getByRole("dialog");
      const text = dialog.textContent ?? "";
      for (const id of INGREDIENTS.map((i) => i.id).filter((id) => !OWNED.includes(id))) {
        const name = getIngredient(id)!.nameJa;
        if (!ownedNames.some((n) => n.includes(name))) expect(text, `${label}: ${name}`).not.toContain(name);
      }
      expect(text).not.toMatch(/\?\?\?|？？？|NEW|LOCKED|🔒/);
      expect(dialog.querySelectorAll("[class*='silhouette'], [class*='locked']")).toHaveLength(0);
      // The only digits are the per-row stock (×n); no "n種" / category or shelf counts anywhere else.
      expect(text.replace(/×\d+/g, "")).not.toMatch(/\d/);
    }
  });

  it("changing the shelf resets the pantry list's own scrollTop to 0 (and only that)", () => {
    render(<Harness initial={freeTopping()} />);
    fireEvent.click(entry()!);
    const list = document.querySelector<HTMLElement>(".pantry-sheet__list")!;
    let top = 120;
    Object.defineProperty(list, "scrollTop", { configurable: true, get: () => top, set: (v: number) => void (top = v) });
    fireEvent.click(chip("肉"));
    expect(top).toBe(0);
    top = 90;
    fireEvent.click(chip("すべて"));
    expect(top).toBe(0);
  });

  it("close and reopen: the shelf filter is back on すべて (not saved, not in GameState)", () => {
    render(<Harness initial={freeTopping()} />);
    fireEvent.click(entry()!);
    fireEvent.click(chip("肉"));
    expect(tileNames()).toEqual(namesOf(["sausage", "pepperoni"]));
    const json = stateJson();
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(stateJson()).toBe(json);
    expect(stateJson()).not.toMatch(/shelf/i);
    fireEvent.click(entry()!);
    expect(chip("すべて")).toHaveAttribute("aria-pressed", "true");
    expect(tileNames()).toEqual(ALL_NAMES);
  });
});

describe("LC-R4 focus, keyboard and the Builder selection", () => {
  it("chip taps keep the sheet open and inside the dialog; Escape (from a chip) still closes and returns focus to the entry", () => {
    render(<Harness initial={freeTopping()} />);
    fireEvent.click(entry()!);
    const meat = chip("肉");
    meat.focus();
    fireEvent.click(meat);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(meat, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(entry());
  });

  it("#197 is NOT applied in R4: filtering the pantry never clears selectedIngredientId or touches the tray / state", () => {
    render(<Harness initial={freeTopping()} />);
    fireEvent.click(screen.getAllByRole("button", { name: /バジル/ })[0]);
    const before = { json: stateJson(), chips: chipNames(), selected: screen.getByTestId("selected").textContent };
    expect(before.selected).toBe("basil");
    fireEvent.click(entry()!);
    fireEvent.click(chip("肉")); // basil (herb) is now NOT in the pantry list; it is still on the Builder tray
    expect(tileNames()).not.toContain("バジル");
    expect(screen.getByTestId("selected").textContent).toBe("basil");
    fireEvent.click(chip("魚介"));
    fireEvent.click(chip("すべて"));
    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect({ json: stateJson(), chips: chipNames(), selected: screen.getByTestId("selected").textContent }).toEqual(before);
    expect(screen.getAllByRole("button", { name: /バジル/ })[0]).toHaveAttribute("aria-pressed", "true");
  });

  it("Dinner isolation: still no entry and no pantry / chips in a Dinner round", () => {
    render(<Harness initial={toStep(dinnerState(), "TOPPING")} />);
    expect(entry()).toBeNull();
    expect(document.querySelector(".pantry-sheet, .shelf-chips")).toBeNull();
  });
});

describe("LC-R5-a utility row: pantryWorthwhile is separate from the pager and never changes the dock today", () => {
  const dock = () => document.querySelector<HTMLElement>('[data-testid="prepare-dock"]')!;
  const dockVars = (el: HTMLElement) => ({
    cls: el.className,
    pager: el.style.getPropertyValue("--dock-pager"),
    sauce: el.style.getPropertyValue("--dock-sauce-rows"),
    other: el.style.getPropertyValue("--dock-other-rows"),
  });

  it("FREE, > 6 owned toppings: entry present and the utility row is reserved (same as the old pager row)", () => {
    render(<Harness initial={freeTopping()} />);
    expect(entry()).toBeInTheDocument();
    expect(dock().className).not.toContain("prepare-dock--no-pager");
    expect(dock().style.getPropertyValue("--dock-pager")).toBe("1");
  });

  it("FREE, every category <= 6 owned: no entry, no utility row (no new empty row)", () => {
    const few = toStep(createInitialGameState([], [...STARTER_INGREDIENT_IDS], 0, {}, [], FINITE, {}), "TOPPING");
    render(<Harness initial={few} />);
    expect(entry()).not.toBeInTheDocument();
    expect(dock().className).toContain("prepare-dock--no-pager");
    expect(dock().style.getPropertyValue("--dock-pager")).toBe("0");
  });

  it("Dinner / guided / Lunch Rush with > 6 owned: no entry and the dock's utility row follows the tray pager only", () => {
    const g = toStep(guidedState(), "TOPPING");
    const lunch = { ...g, roundKind: "LUNCH_RUSH", isMissionRound: true } as GameState;
    const d = toStep(dinnerState(), "TOPPING");
    // guided / Lunch Rush: recipe-limited tray -> pager false -> NO utility row, although ownership is > 6.
    for (const initial of [g, lunch]) {
      render(<Harness initial={initial} />);
      expect(entry()).not.toBeInTheDocument();
      expect(dockVars(dock())).toMatchObject({ pager: "0" });
      expect(dock().className).toContain("prepare-dock--no-pager");
      cleanup();
    }
    // Dinner: recipe-free tray -> pager true (its existing paged tray), still no entry.
    render(<Harness initial={d} />);
    expect(entry()).not.toBeInTheDocument();
    expect(dockVars(dock())).toMatchObject({ pager: "1" });
    expect(document.querySelector(".pantry-entry")).toBeNull();
  });

  it("the dock vars of a guided round are the same whether or not FREE would have a pantry (R4 golden)", () => {
    render(<Harness initial={toStep(guidedState(), "SAUCE")} />);
    expect(dockVars(dock())).toMatchObject({ pager: "0", sauce: "1", other: "1" });
  });
});
