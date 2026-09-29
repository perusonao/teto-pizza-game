import "@testing-library/jest-dom/vitest";
import { useReducer, useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { GameScreen } from "./GameScreen";
import { createInitialGameState, gameReducer, type GameState } from "../state/gameReducer";
import { HAND_ENFORCEMENT_ENABLED } from "../logic/catalog/handPolicy";
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

  it("the pantry does not reduce reachability: every owned topping is still on the tray pages, and enforcement is OFF", () => {
    expect(HAND_ENFORCEMENT_ENABLED).toBe(false);
    render(<Harness initial={freeTopping()} />);
    const seen = new Set(chipNames());
    fireEvent.click(screen.getByRole("button", { name: "次のページ" }));
    for (const n of chipNames()) seen.add(n);
    expect([...seen].sort()).toEqual(OWNED_TOPPINGS.map((id) => getIngredient(id)!.nameJa).sort());
  });
});
