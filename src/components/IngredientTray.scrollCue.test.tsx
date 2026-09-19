import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { IngredientTray } from "./IngredientTray";
import { getRecipe } from "../data/recipes";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { EMPTY_INVENTORY } from "../state/inventory";
import { createEmptyPizza } from "../state/pizzaState";
import type { Recipe } from "../data/recipes";

/**
 * Visual Polish 1A (Ingredient Tray Overflow, P1-1, docs/reports/
 * TETO_VISUAL-POLISH_1A_Ingredient-Tray_Result.md): a "Recommended row + full Other grid"
 * recipe used to hide its own last Other row under the fixed `.prepare-bake-bar` with no
 * on-screen sign that scrolling would reveal it (reproduced live with Tonno e Cipolla, see the
 * Result Report). The actual fix is layout/scroll-affordance, not testable meaningfully as pure
 * CSS -- this file pins the one piece of *behavior* that fix adds: an IntersectionObserver-
 * driven scroll-cue that appears exactly when tray content still sits below the visible-above-
 * the-CTA-bar area, and the always-present sentinel node it observes. Real 390x844/360x800
 * on-screen verification (chevron visible/hidden at the right scroll position, no horizontal
 * overflow, no console errors) is documented in the Result Report rather than re-asserted here
 * -- jsdom has no real layout engine to make that assertion meaningful.
 */

const margheritaFixture = getRecipe("margherita");
if (!margheritaFixture) throw new Error("margherita fixture missing");
const MARGHERITA: Recipe = margheritaFixture;

const tonnoFixture = getRecipe("tonno-e-cipolla");
if (!tonnoFixture) throw new Error("tonno-e-cipolla fixture missing");
const TONNO: Recipe = tonnoFixture;

// Captures the IntersectionObserver callback so a test can drive it directly (jsdom itself
// has no IntersectionObserver -- see IngredientTray.tsx's own guard for that default case).
let observerCallbacks: IntersectionObserverCallback[] = [];
let observedTargets: Element[] = [];

class FakeIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    observerCallbacks.push(callback);
  }
  observe(target: Element) {
    observedTargets.push(target);
  }
  disconnect() {}
  unobserve() {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

function fireIntersection(isIntersecting: boolean) {
  const callback = observerCallbacks[observerCallbacks.length - 1];
  act(() => {
    callback([{ isIntersecting } as IntersectionObserverEntry], null as unknown as IntersectionObserver);
  });
}

beforeEach(() => {
  observerCallbacks = [];
  observedTargets = [];
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderTray(recipe: Recipe, ownedIngredientIds: readonly string[]) {
  return render(
    <IngredientTray
      activeCategory="topping"
      selectedIngredientId={null}
      onSelectIngredient={() => {}}
      ownedIngredientIds={ownedIngredientIds}
      recipe={recipe}
      inventory={EMPTY_INVENTORY}
      pizza={createEmptyPizza()}
    />,
  );
}

describe("Ingredient Tray scroll cue (Visual Polish 1A, P1-1)", () => {
  it("always renders the content-end sentinel the observer watches, regardless of overflow", () => {
    renderTray(MARGHERITA, STARTER_INGREDIENT_IDS);
    expect(document.querySelector(".ingredient-panel__content-end")).toBeInTheDocument();
    expect(observedTargets).toHaveLength(1);
  });

  it("shows the scroll cue once the observer reports the tray's end is not yet visible above the CTA bar", () => {
    renderTray(TONNO, [...STARTER_INGREDIENT_IDS, "onion", "tuna", "mushroom", "sausage", "pepperoni", "anchovy"]);
    expect(screen.queryByText("▼")).not.toBeInTheDocument();

    fireIntersection(false);
    expect(screen.getByText("▼")).toBeInTheDocument();
  });

  it("hides the scroll cue again once the observer reports the tray's end has scrolled into view", () => {
    renderTray(TONNO, [...STARTER_INGREDIENT_IDS, "onion", "tuna", "mushroom", "sausage", "pepperoni", "anchovy"]);

    fireIntersection(false);
    expect(screen.getByText("▼")).toBeInTheDocument();

    fireIntersection(true);
    expect(screen.queryByText("▼")).not.toBeInTheDocument();
  });

  it("never shows the cue for Margherita's simple single-row case (no regression)", () => {
    renderTray(MARGHERITA, STARTER_INGREDIENT_IDS);
    // Even if something did report non-intersection, this is the same component/state --
    // the real-world claim (App.css/browser verification, see the Result Report) is that a
    // short tray never overflows in the first place, so the observer never fires `false` for
    // it. This pins the cue's own default-hidden state independent of that CSS claim.
    expect(screen.queryByText("▼")).not.toBeInTheDocument();
  });

  it("does not crash when IntersectionObserver is unavailable (jsdom's real default)", () => {
    vi.unstubAllGlobals();
    // @ts-expect-error -- simulating an environment with no IntersectionObserver at all.
    delete window.IntersectionObserver;
    expect(() => renderTray(TONNO, [...STARTER_INGREDIENT_IDS, "onion", "tuna"])).not.toThrow();
    expect(screen.queryByText("▼")).not.toBeInTheDocument();
  });
});
