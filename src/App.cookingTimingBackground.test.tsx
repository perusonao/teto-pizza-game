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
      // Discovery 2.0: bismarck itself is discovered -- guided rounds need a discovery.
      { recipeId: "bismarck", discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 },
    ],
    // Progression 2.0 I4b-3: EP4's load-time Starter Grant is retired, so the materials these
    // recipes need are seeded as already bought (the v1 -> v2 migration backfills their stock).
    ownedIngredientIds: [...STARTER_INGREDIENT_IDS, "mushroom", "garlic", "oregano", "egg"],
  });
}

/** Recipe Select 2.0A: Pizza Select is a sectioned browse grid, not a single-recipe pager --
 *  reaching a given recipe means tapping its own grid card (opens the focused detail/confirm
 *  view), then the one shared CTA there. */
async function selectRecipeInPizzaSelect(
  user: ReturnType<typeof userEvent.setup>,
  recipeId: RecipeId,
) {
  const recipe = RECIPES.find((r) => r.id === recipeId)!;
  await user.click(screen.getByRole("button", { name: new RegExp(`^${recipe.nameJa}、`) }));
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

// Completion Gate Phase 1 (merged into this branch from PR #102): a round with no sauce/cheese/
// topping at all is now a FAILED round (../logic/completionGate.ts), not merely a low-scoring
// PASS -- so these Cooking Time tests, which only care about the *timing*, still need a real
// PASSing pizza for the RESULT screen to ever reach the 手際/調理時間 markup at all. Reuses the
// exact same tap/paint/needle-control helpers `App.test.tsx` already built for this (see that
// file's own doc comments for the full rationale of each).
async function selectAndTapPizza(
  user: ReturnType<typeof userEvent.setup>,
  ingredientNameJa: string,
  xPercent: number,
  yPercent: number,
) {
  await user.click(screen.getByRole("button", { name: new RegExp(ingredientNameJa) }));
  const dough = document.querySelector<HTMLElement>('[data-pizza-drop-target="true"]');
  if (!dough) throw new Error("Pizza dough missing");
  dough.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 300, height: 300, right: 300, bottom: 300, x: 0, y: 0, toJSON: () => {} }) as DOMRect;
  const clientX = (xPercent / 100) * 300;
  const clientY = (yPercent / 100) * 300;
  const pointerId = Math.floor(Math.random() * 1_000_000);
  fireEvent.pointerDown(dough, { pointerId, isPrimary: true, pointerType: "touch", clientX, clientY });
  fireEvent.pointerUp(dough, { pointerId, isPrimary: true, pointerType: "touch", clientX, clientY });
}

async function paintSauceRing(
  user: ReturnType<typeof userEvent.setup>,
  ingredientNameJa: string,
  radius: number,
  count: number,
) {
  await user.click(screen.getByRole("button", { name: new RegExp(ingredientNameJa) }));
  const dough = document.querySelector<HTMLElement>('[data-pizza-drop-target="true"]');
  if (!dough) throw new Error("Pizza dough missing");
  dough.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 300, height: 300, right: 300, bottom: 300, x: 0, y: 0, toJSON: () => {} }) as DOMRect;
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const xPercent = 50 + Math.cos(angle) * radius;
    const yPercent = 50 + Math.sin(angle) * radius;
    const clientX = (xPercent / 100) * 300;
    const clientY = (yPercent / 100) * 300;
    const pointerId = Math.floor(Math.random() * 1_000_000);
    fireEvent.pointerDown(dough, { pointerId, isPrimary: true, pointerType: "touch", clientX, clientY });
    fireEvent.pointerUp(dough, { pointerId, isPrimary: true, pointerType: "touch", clientX, clientY });
  }
}

// Pizza Cutting 1.0 Phase 4B: bismarck is now CUT-eligible (../data/cookingProfiles.ts), so
// 取り出す！ lands on POST_BAKE/CUT instead of RESULT directly -- these tests only care about
// Cooking Time's own pause bookkeeping, already finalized by CONFIRM_BAKE/START_BAKE's timing
// boundary, so completing CUT at the same mocked `now` (zero additional elapsed time) and
// confirming is enough to reach RESULT without perturbing any of this suite's own assertions.
// Mirrors App.test.tsx's own `completeCutStepIfPresent` helper.
async function completeCutStepIfPresent(user: ReturnType<typeof userEvent.setup>) {
  if (!screen.queryByRole("button", { name: /切り終わる/ })) return;
  const dough = document.querySelector<HTMLElement>('[data-pizza-drop-target="true"]');
  if (!dough) throw new Error("Pizza dough missing");
  dough.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 300, height: 300, right: 300, bottom: 300, x: 0, y: 0, toJSON: () => {} }) as DOMRect;
  const center = 150;
  const radius = 140;
  for (const angleDeg of [0, 60, 120]) {
    const angle = (angleDeg * Math.PI) / 180;
    const dx = Math.cos(angle) * radius;
    const dy = Math.sin(angle) * radius;
    const startX = center - dx;
    const startY = center - dy;
    const endX = center + dx;
    const endY = center + dy;
    const pointerId = Math.floor(Math.random() * 1_000_000);
    fireEvent.pointerDown(dough, { pointerId, isPrimary: true, pointerType: "touch", clientX: startX, clientY: startY });
    fireEvent.pointerMove(dough, { pointerId, isPrimary: true, pointerType: "touch", clientX: endX, clientY: endY });
    fireEvent.pointerUp(dough, { pointerId, isPrimary: true, pointerType: "touch", clientX: endX, clientY: endY });
  }
  await user.click(screen.getByRole("button", { name: /切り終わる/ }));
}

/** Drives BakeOverlay's needle to an exact value before confirming -- see App.test.tsx's own
 *  `controlBakeNeedle` doc comment for the full rationale (stubs `requestAnimationFrame`/
 *  `performance.now`, independent of this file's own `Date.now` stub for Cooking Time). */
function controlBakeNeedle() {
  let now = 0;
  let rafCallback: FrameRequestCallback | null = null;
  return {
    stub() {
      vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
        rafCallback = callback;
        return 1;
      });
      vi.stubGlobal("cancelAnimationFrame", () => {});
      vi.stubGlobal("performance", { now: () => now });
    },
    driveTo(targetPosition: number) {
      const BAKE_NEEDLE_SPEED = 55; // percent per second, BakeOverlay.tsx's own SPEED constant
      now += (targetPosition / BAKE_NEEDLE_SPEED) * 1000;
      const callback = rafCallback;
      rafCallback = null;
      callback?.(now);
    },
    unstub() {
      vi.unstubAllGlobals();
    },
  };
}

/** Builds a real, PASSing bismarck pizza (トマトソース ring + 3x モッツァレラ + 1x たまご,
 *  bismarck's own three required ingredients) and confirms the bake in the middle of its
 *  {55, 75} target zone -- everything these Cooking Time tests need beyond the pizza itself is
 *  in each test's own `now`/pause-signal choreography around this call. */
async function advanceThroughMakingSteps(user: ReturnType<typeof userEvent.setup>) {
  completeDoughStep();
  await user.click(screen.getByRole("button", { name: /次へ/ })); // DOUGH -> SAUCE
  await paintSauceRing(user, "トマトソース", 25, 16);
  await user.click(screen.getByRole("button", { name: /次へ/ })); // SAUCE -> CHEESE
  await selectAndTapPizza(user, "モッツァレラ", 40, 50);
  await selectAndTapPizza(user, "モッツァレラ", 60, 50);
  await selectAndTapPizza(user, "モッツァレラ", 50, 30);
  await user.click(screen.getByRole("button", { name: /次へ/ })); // CHEESE -> TOPPING
  await selectAndTapPizza(user, "たまご", 50, 65);
}

// Gameplay UX PR-C (Timing Transparency): 調理時間 moved from `.pitz-credit-summary__row` into
// its own always-visible `.cooking-timing-summary` headline (a `<details>`'s own `<summary>` when
// per-step rows exist -- the real-production shape -- see ResultPanel.tsx) -- reads the
// elapsed-time text out of that headline's own `<strong>`, no dt/dd row anymore.
function readDisplayedCookingTime(): string {
  const timing = document.querySelector(".cooking-timing-summary");
  if (!timing) throw new Error("Cooking Time summary missing from RESULT");
  return timing.querySelector("strong")?.textContent ?? "";
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
    const needle1 = controlBakeNeedle();
    needle1.stub();
    await user.click(screen.getByRole("button", { name: /焼く/ })); // START_BAKE finalizes at `now`
    needle1.driveTo(65); // bismarck's {55, 75} target zone
    await user.click(screen.getByRole("button", { name: "取り出す！" }));
    await completeCutStepIfPresent(user);
    needle1.unstub();

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
    const needle = controlBakeNeedle();
    needle.stub();
    await user.click(screen.getByRole("button", { name: /焼く/ }));
    needle.driveTo(65); // bismarck's {55, 75} target zone
    await user.click(screen.getByRole("button", { name: "取り出す！" }));
    await completeCutStepIfPresent(user);
    needle.unstub();

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
    const needle = controlBakeNeedle();
    needle.stub();
    await user.click(screen.getByRole("button", { name: /焼く/ }));
    needle.driveTo(65); // bismarck's {55, 75} target zone
    await user.click(screen.getByRole("button", { name: "取り出す！" }));
    await completeCutStepIfPresent(user);
    needle.unstub();

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
    const needle = controlBakeNeedle();
    needle.stub();
    await user.click(screen.getByRole("button", { name: /焼く/ }));
    needle.driveTo(65); // bismarck's {55, 75} target zone
    await user.click(screen.getByRole("button", { name: "取り出す！" }));
    await completeCutStepIfPresent(user);
    needle.unstub();

    // 1s (before Reference opened) + 4s (after Reference actually closed) = 5s total. The whole
    // 10s + 20s + 5s = 35s span (Reference open, with a background overlap in the middle) is
    // excluded in full -- a premature resume on the mid-span `focus` would have wrongly counted
    // the trailing 5s as active, producing 0:10 instead of 0:05.
    expect(readDisplayedCookingTime()).toBe("0:05");
  });
});

// Discovery Hint 2.0 (#229, OD-HINT-8 no penalty): reading hints never costs Cooking Time. The
// Dex CTA case closes the Dex (a pause reason) and opens the sheet (another) in the same render,
// while a brand-new round's timer starts -- that timer must start paused, not run under a pause
// signal that never transitioned (PR #231 review).
describe("Cooking Time: Discovery Hint sheet pause (#229)", () => {
  function seedWithDiscoverable(): void {
    seedBismarckUnlocked();
    const save = JSON.parse(window.localStorage.getItem(SAVE_STORAGE_KEY)!);
    save.ownedIngredientIds.push("bacon"); // breakfast-pizza becomes DISCOVERABLE
    window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(save));
  }

  async function bakeBismarck(user: ReturnType<typeof userEvent.setup>) {
    await advanceThroughMakingSteps(user);
    const needle = controlBakeNeedle();
    needle.stub();
    await user.click(screen.getByRole("button", { name: /焼く/ }));
    needle.driveTo(65);
    await user.click(screen.getByRole("button", { name: "取り出す！" }));
    await completeCutStepIfPresent(user);
    needle.unstub();
  }

  it("excludes time spent reading a sheet opened from the Dex 「💡 ヒントを見る」", async () => {
    seedWithDiscoverable();
    let now = 5_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /ピザ図鑑/ }));
    await user.click(screen.getByRole("button", { name: /ヒントを見る/ })); // new round + sheet, same render
    expect(screen.getByRole("dialog", { name: /ヒント/ })).toBeInTheDocument();
    now += 30_000; // reading hints -- never billed
    await user.click(screen.getByRole("button", { name: "閉じる" }));
    now += 8_000; // active work
    await bakeBismarck(user);

    expect(readDisplayedCookingTime()).toBe("0:08");
  });

  it("excludes time spent reading a sheet opened from the in-round 「ヒント」 button", async () => {
    seedWithDiscoverable();
    let now = 6_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /フリークッキング/ }));
    now += 5_000;
    await user.click(screen.getByRole("button", { name: "ヒント" }));
    now += 30_000;
    await user.click(screen.getByRole("button", { name: "閉じる" }));
    now += 3_000;
    await bakeBismarck(user);

    expect(readDisplayedCookingTime()).toBe("0:08");
  });
});
