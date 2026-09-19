import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { SAVE_STORAGE_KEY, type PersistentSaveV1 } from "./state/persistence";
import { STARTER_INGREDIENT_IDS } from "./data/ingredients";
import { RECIPES, type RecipeId } from "./data/recipes";

/**
 * Cooking Time CT2: end-to-end coverage for the App-level pause wiring
 * (`isAnyCookingTimingPauseReasonActive`, ../logic/cookingTiming.ts) -- items 9/10/11 of the
 * task's own test list. Mocks `Date.now` directly (App.tsx is the sole real-clock call site for
 * this feature) rather than fake timers, mirroring this file's sibling `App.test.tsx`'s own
 * "real reducers, real localStorage" integration style. See
 * docs/reports/TETO_COOKING-TIME_CT2_Efficiency-Result.md for the background/pause policy this
 * suite enforces.
 */

function seedSave(overrides: Partial<PersistentSaveV1>): void {
  const save: PersistentSaveV1 = {
    schemaVersion: 1,
    dex: [],
    pitzBalance: 0,
    ownedIngredientIds: [...STARTER_INGREDIENT_IDS],
    missionBest: {},
    ...overrides,
  };
  window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(save));
}

function seedBismarckUnlocked(): void {
  seedSave({
    dex: [
      { recipeId: "margherita", discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 },
      { recipeId: "funghi", discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 },
      { recipeId: "marinara", discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 },
    ],
  });
}

async function selectRecipeInPizzaSelect(
  user: ReturnType<typeof userEvent.setup>,
  recipeId: RecipeId,
) {
  const targetIndex = RECIPES.findIndex((r) => r.id === recipeId);
  for (let i = 0; i < targetIndex; i += 1) {
    await user.click(screen.getByRole("button", { name: "次のレシピ" }));
  }
  await user.click(screen.getByRole("button", { name: /このピザを作る/ }));
}

function completeDoughStep() {
  const dough = document.querySelector<HTMLElement>('[data-pizza-drop-target="true"]');
  if (!dough) throw new Error("Pizza dough missing");
  dough.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 300, height: 300, right: 300, bottom: 300, x: 0, y: 0, toJSON: () => {} }) as DOMRect;

  const center = 150;
  const radius = 140;
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    const clientX = center + Math.cos(angle) * radius;
    const clientY = center + Math.sin(angle) * radius;
    const pointerId = 1000 + i;
    fireEvent.pointerDown(dough, { pointerId, isPrimary: true, pointerType: "touch", clientX, clientY });
    fireEvent.pointerUp(dough, { pointerId, isPrimary: true, pointerType: "touch", clientX, clientY });
  }
}

async function advanceThroughMakingSteps(user: ReturnType<typeof userEvent.setup>) {
  completeDoughStep();
  await user.click(screen.getByRole("button", { name: /次へ/ }));
  await user.click(screen.getByRole("button", { name: /次へ/ }));
  await user.click(screen.getByRole("button", { name: /次へ/ }));
}

function readDisplayedCookingTime(): string {
  const dt = screen.getByText("調理時間");
  const row = dt.closest(".pitz-credit-summary__row");
  if (!row) throw new Error("Cooking Time row missing from RESULT");
  return row.querySelector("dd")?.textContent ?? "";
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("Cooking Time CT2: background (visibilitychange/blur) exclusion", () => {
  it("excludes a window-blur interruption from the displayed Cooking Time", async () => {
    seedBismarckUnlocked();
    let now = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    await selectRecipeInPizzaSelect(user, "bismarck"); // SELECT_RECIPE starts cookingTiming at now

    now += 5_000; // 5s of active work
    fireEvent(window, new Event("blur")); // app backgrounded (iOS app switch / alt-tab)
    now += 30_000; // 30s away -- must never be billed to Cooking Time
    fireEvent(window, new Event("focus")); // player returns

    now += 3_000; // another 3s of active work
    await advanceThroughMakingSteps(user);
    await user.click(screen.getByRole("button", { name: /焼く/ })); // START_BAKE finalizes at `now`
    await user.click(screen.getByRole("button", { name: "取り出す！" }));

    // 5s + 3s active = 8s total -- the 30s background span is excluded entirely.
    expect(readDisplayedCookingTime()).toBe("0:08");
  });

  it("excludes a document.hidden (visibilitychange) interruption identically to blur", async () => {
    seedBismarckUnlocked();
    let now = 2_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const hiddenSpy = vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    await selectRecipeInPizzaSelect(user, "bismarck");

    now += 4_000;
    hiddenSpy.mockReturnValue(true);
    fireEvent(document, new Event("visibilitychange"));
    now += 20_000; // tab/app switched away
    hiddenSpy.mockReturnValue(false);
    fireEvent(document, new Event("visibilitychange"));

    now += 6_000;
    await advanceThroughMakingSteps(user);
    await user.click(screen.getByRole("button", { name: /焼く/ }));
    await user.click(screen.getByRole("button", { name: "取り出す！" }));

    // 4s + 6s active = 10s total -- the 20s hidden span is excluded.
    expect(readDisplayedCookingTime()).toBe("0:10");
  });
});

describe("Cooking Time CT2: overlay pause (Reference popover)", () => {
  it("excludes time spent with the Reference popover open", async () => {
    seedBismarckUnlocked();
    let now = 3_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    await selectRecipeInPizzaSelect(user, "bismarck");

    now += 2_000;
    await user.click(screen.getByRole("button", { name: /ビスマルクの見本を拡大表示/ }));
    now += 15_000; // player studies the Reference popover, not actively making the pizza
    await user.click(screen.getByRole("button", { name: "閉じる" }));

    now += 6_000;
    await advanceThroughMakingSteps(user);
    await user.click(screen.getByRole("button", { name: /焼く/ }));
    await user.click(screen.getByRole("button", { name: "取り出す！" }));

    // 2s + 6s active = 8s total -- the 15s Reference-open span is excluded.
    expect(readDisplayedCookingTime()).toBe("0:08");
  });
});

describe("Cooking Time CT2: overlapping pause reasons never resume prematurely", () => {
  it("Reference open -> app backgrounds -> foregrounds -> Reference still open: stays paused throughout", async () => {
    seedBismarckUnlocked();
    let now = 4_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    await selectRecipeInPizzaSelect(user, "bismarck");

    now += 1_000; // 1s active
    await user.click(screen.getByRole("button", { name: /ビスマルクの見本を拡大表示/ })); // Reference opens
    now += 10_000; // paused (Reference open)

    fireEvent(window, new Event("blur")); // app also backgrounds while Reference is still open
    now += 20_000; // paused (both reasons active)
    fireEvent(window, new Event("focus")); // app foregrounds again -- Reference is STILL open
    now += 5_000; // must still be paused -- premature resume would wrongly count this span

    await user.click(screen.getByRole("button", { name: "閉じる" })); // Reference finally closes -- NOW it resumes
    now += 4_000; // 4s active after the real resume

    await advanceThroughMakingSteps(user);
    await user.click(screen.getByRole("button", { name: /焼く/ }));
    await user.click(screen.getByRole("button", { name: "取り出す！" }));

    // 1s (before Reference opened) + 4s (after Reference actually closed) = 5s total. The whole
    // 10s + 20s + 5s = 35s span (Reference open, with a background overlap in the middle) is
    // excluded in full -- a premature resume on the mid-span `focus` would have wrongly counted
    // the trailing 5s as active, producing 0:10 instead of 0:05.
    expect(readDisplayedCookingTime()).toBe("0:05");
  });
});
