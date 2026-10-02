import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { RECIPE_DISCOVERY_CATALOG } from "./data/discoveryCatalog";
import { STARTER_INGREDIENT_IDS } from "./data/ingredients";
import type { TechniqueRuntimeContext } from "./logic/techniques/runtime";
import { SAVE_STORAGE_KEY } from "./state/persistence";

/**
 * Cooking Techniques 1.0 TQ-1C (Issue #287): the technique step through the real App -- a Free
 * Cooking round played with the UI, then the save. With a synthetic context in which Margherita
 * requires NO_SAUCE, discovering Margherita records the technique in the same save write; with the
 * production context (INV-TQ-4) nothing is recorded. Either way nothing new appears on screen
 * (TQ-1C has no UI; the technique stage is TQ-1D).
 */

const technique = vi.hoisted(() => ({ context: null as TechniqueRuntimeContext | null }));
vi.mock("./logic/techniques/runtime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./logic/techniques/runtime")>();
  return { ...actual, productionTechniqueContext: () => technique.context ?? actual.productionTechniqueContext() };
});

function dough(): HTMLElement {
  const el = document.querySelector<HTMLElement>('[data-pizza-drop-target="true"]');
  if (!el) throw new Error("Pizza dough missing");
  el.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 300, height: 300, right: 300, bottom: 300, x: 0, y: 0, toJSON: () => {} }) as DOMRect;
  return el;
}

function tapPizza(xPercent: number, yPercent: number) {
  const el = dough();
  const clientX = (xPercent / 100) * 300;
  const clientY = (yPercent / 100) * 300;
  const pointerId = Math.floor(Math.random() * 1_000_000);
  fireEvent.pointerDown(el, { pointerId, isPrimary: true, pointerType: "touch", clientX, clientY });
  fireEvent.pointerUp(el, { pointerId, isPrimary: true, pointerType: "touch", clientX, clientY });
}

const chip = (name: RegExp) => screen.getByRole("button", { name });

/** Free Cooking: dough, tomato sauce, 3 mozzarella, 2 basil, bake inside Margherita's window. */
async function playMargherita(user: ReturnType<typeof userEvent.setup>) {
  render(<App />);
  await user.click(screen.getByRole("button", { name: /レシピ発見/ }));
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    tapPizza(50 + Math.cos(angle) * 46.6, 50 + Math.sin(angle) * 46.6);
  }
  await user.click(screen.getByRole("button", { name: /次へ/ }));
  await user.click(chip(/トマトソース/));
  for (let i = 0; i < 16; i += 1) {
    const angle = (i / 16) * Math.PI * 2;
    tapPizza(50 + Math.cos(angle) * 25, 50 + Math.sin(angle) * 25);
  }
  await user.click(screen.getByRole("button", { name: /次へ/ }));
  await user.click(chip(/モッツァレラ/));
  tapPizza(40, 50);
  tapPizza(60, 50);
  tapPizza(50, 30);
  await user.click(screen.getByRole("button", { name: /次へ/ }));
  await user.click(chip(/バジル/));
  tapPizza(45, 60);
  tapPizza(58, 42);

  let now = 0;
  let raf: FrameRequestCallback | null = null;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    raf = cb;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  vi.stubGlobal("performance", { now: () => now });
  await user.click(screen.getByRole("button", { name: /焼く/ }));
  now += (70 / 55) * 1000;
  const cb = raf as FrameRequestCallback | null;
  raf = null;
  cb?.(now);
  await user.click(screen.getByRole("button", { name: "取り出す！" }));
  vi.unstubAllGlobals();
  await screen.findByText("NEW PIZZA! ✨");
}

function stored(): Record<string, unknown> {
  return JSON.parse(window.localStorage.getItem(SAVE_STORAGE_KEY) ?? "null");
}

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem(
    SAVE_STORAGE_KEY,
    JSON.stringify({
      schemaVersion: 2,
      dex: [],
      pitzBalance: 0,
      ownedIngredientIds: [...STARTER_INGREDIENT_IDS],
      missionBest: {},
      inventory: {},
      starterGrantClaimedRecipeIds: [],
      discoveredTechniqueIds: ["future-technique"],
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  technique.context = null;
});

describe("TQ-1C through the App", () => {
  it("a technique recipe's discovery saves the technique with the Dex (unknown ids kept) and shows nothing new", async () => {
    technique.context = {
      catalog: RECIPE_DISCOVERY_CATALOG.map((t) => (t.recipeId === "margherita" ? { ...t, sauceBase: [] } : t)),
      materialStep: () => null,
    };
    await playMargherita(userEvent.setup());
    const save = stored();
    expect((save.dex as { recipeId: string }[]).map((e) => e.recipeId)).toEqual(["margherita"]);
    expect(save.discoveredTechniqueIds).toEqual(["no-sauce", "future-technique"]);
    expect(document.body.textContent).not.toMatch(/ソースなし|調理法|技法/);
  });

  it("with the production context (INV-TQ-4) the same round records no technique", async () => {
    await playMargherita(userEvent.setup());
    const save = stored();
    expect((save.dex as { recipeId: string }[]).map((e) => e.recipeId)).toEqual(["margherita"]);
    expect(save.discoveredTechniqueIds).toEqual(["future-technique"]);
    expect(document.body.textContent).not.toMatch(/ソースなし|調理法|技法/);
  });
});
