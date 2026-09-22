import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";
import { SAVE_STORAGE_KEY, type PersistentSaveV1 } from "./state/persistence";
import { STARTER_INGREDIENT_IDS } from "./data/ingredients";
import { RECIPES, type RecipeId } from "./data/recipes";

/**
 * Issue #47 Slice B (Findings F/H) integration coverage: the persistent mini Reference
 * thumbnail during Making PREPARE, its tap-to-expand popover, and its lifecycle across
 * reset/retry/recipe-switch, end to end through the real `App`.
 *
 * B2 (Reference coverage 7/7, see docs/reports/TETO_SCORING2-B2_REFERENCE-COVERAGE_Result.md):
 * this file originally paired one recipe with a Scoring 2.0 Reference fixture (Margherita)
 * against one genuinely without one (Bismarck), to prove both the precise `ReferencePreview`
 * and the generic `PlayerReferencePreview` paths render correctly end to end. Now that every
 * real recipe has a reviewed Reference fixture, Bismarck also takes the precise-panel path --
 * kept here as a *second* concrete recipe proving that path generalizes correctly (not just a
 * Margherita special case; this is exactly the bug this same B2 pass found and fixed --
 * `ReferencePreview` used to hardcode "マルゲリータ" in its title/caption regardless of which
 * recipe was open, invisible while only Margherita ever reached it). The generic
 * `PlayerReferencePreview` panel itself is unit-tested directly elsewhere
 * (`PlayerReferencePreview.test.tsx`) and remains real, working code -- it is simply not
 * reachable through this integration test's real `App` flow for any of the current 7 recipes,
 * since none of them lack a Reference fixture anymore.
 */
beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

/** Economy & Progression 1.0 EP1: bismarck needs margherita->funghi->marinara discovered
 *  first (the Chapter 1 recipe-unlock chain, src/state/progression.ts's `recipeUnlocked`).
 *  Pre-seeds that chain into localStorage so bismarck shows up as an unlocked, NEW Pizza
 *  Select card -- unaffected for the Margherita-only flows in this file, which never call it. */
function seedBismarckUnlocked(): void {
  const save: PersistentSaveV1 = {
    schemaVersion: 1,
    dex: [
      { recipeId: "margherita", discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 },
      { recipeId: "funghi", discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 },
      { recipeId: "marinara", discovered: true, bestScore: 60, bestStars: 1, timesMade: 1 },
    ],
    pitzBalance: 0,
    ownedIngredientIds: [...STARTER_INGREDIENT_IDS],
    missionBest: {},
  };
  window.localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(save));
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

async function enterMakingWith(user: ReturnType<typeof userEvent.setup>, recipeId: RecipeId) {
  if (recipeId === "bismarck") seedBismarckUnlocked();
  render(<App />);
  await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
  await selectRecipeInPizzaSelect(user, recipeId);
}

/** Issue #33 D1: a fresh round now starts at DOUGH, whose own "次へ" stays disabled until the
 *  size-completion threshold is met. Simulates enough taps around the dough's full radius to
 *  clear it (a stretch applies on pointerdown itself -- see PizzaStage's own DOUGH gesture
 *  branch -- so a tap at each of the 8 control-point angles is enough, no drag needed). */
function completeDoughStep() {
  const dough = document.querySelector<HTMLElement>('[data-pizza-drop-target="true"]');
  if (!dough) throw new Error("Pizza dough missing");
  dough.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 300, height: 300, right: 300, bottom: 300, x: 0, y: 0, toJSON: () => {} }) as DOMRect;

  const center = 150; // 50% of a 300px box
  const radius = 140; // safely inside DOUGH_RADIUS (48%) to avoid float rounding at the rim
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    const clientX = center + Math.cos(angle) * radius;
    const clientY = center + Math.sin(angle) * radius;
    const pointerId = 1000 + i;
    fireEvent.pointerDown(dough, { pointerId, isPrimary: true, pointerType: "touch", clientX, clientY });
    fireEvent.pointerUp(dough, { pointerId, isPrimary: true, pointerType: "touch", clientX, clientY });
  }
}

// Pizza Cutting 1.0 Phase 4B: bismarck is now CUT-eligible (../data/cookingProfiles.ts), so
// 取り出す！ lands on POST_BAKE/CUT instead of RESULT directly. Mirrors App.test.tsx's own
// `completeCutStepIfPresent` helper.
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

describe("Mini Reference (Margherita, Scoring 2.0 fixture)", () => {
  it("is visible during PREPARE without pressing anything", async () => {
    const user = userEvent.setup();
    await enterMakingWith(user, "margherita");
    expect(document.querySelector(".mini-reference")).toBeInTheDocument();
  });

  it("tapping it opens the existing unchanged Margherita popover", async () => {
    const user = userEvent.setup();
    await enterMakingWith(user, "margherita");
    await user.click(screen.getByRole("button", { name: /マルゲリータの見本を拡大表示/ }));
    expect(screen.getByRole("dialog", { name: /マルゲリータの見本/ })).toBeInTheDocument();
    // No numeric-precision content was lost for Margherita -- its own reviewed sauce bars
    // still render, unlike the generic panel used for recipes with no Scoring 2.0 fixture.
    expect(document.querySelector(".reference-preview__bar-row")).toBeInTheDocument();
  });

  it("closing the popover leaves the mini reference in place", async () => {
    const user = userEvent.setup();
    await enterMakingWith(user, "margherita");
    await user.click(screen.getByRole("button", { name: /マルゲリータの見本を拡大表示/ }));
    await user.click(screen.getByRole("button", { name: "閉じる" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.querySelector(".mini-reference")).toBeInTheDocument();
  });

  it("RESET_PIZZA (やり直す) preserves the same-recipe mini reference", async () => {
    const user = userEvent.setup();
    await enterMakingWith(user, "margherita");
    expect(document.querySelector(".mini-reference")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "やり直す" }));
    expect(document.querySelector(".mini-reference")).toBeInTheDocument();
    expect(document.querySelector(".order-card")).toHaveTextContent("マルゲリータ");
  });
});

describe("Mini Reference (Bismarck, B2 PART C2 -- also a Scoring 2.0 fixture recipe now)", () => {
  it("is visible during PREPARE", async () => {
    const user = userEvent.setup();
    await enterMakingWith(user, "bismarck");
    expect(document.querySelector(".mini-reference")).toBeInTheDocument();
  });

  it("tapping it opens Bismarck's own precise popover, not a leftover Margherita title/caption", async () => {
    const user = userEvent.setup();
    await enterMakingWith(user, "bismarck");
    await user.click(screen.getByRole("button", { name: /ビスマルクの見本を拡大表示/ }));
    // B2 found and fixed a real bug here: ReferencePreview used to hardcode "マルゲリータ"
    // in its title/aria-label/caption regardless of which recipe was actually open, invisible
    // while Margherita was the only recipe that ever reached this panel. This dialog query
    // itself is the regression pin -- it fails again immediately if that ever comes back.
    expect(screen.getByRole("dialog", { name: /ビスマルクの見本/ })).toBeInTheDocument();
    expect(screen.queryByText(/マルゲリータ/)).not.toBeInTheDocument();
    // The precise panel (real Scoring 2.0 Reference data) shows numeric quantity/coverage bars
    // -- the opposite of the old generic-panel expectation, since Bismarck now has real data.
    expect(document.querySelector(".reference-preview__bar-row")).toBeInTheDocument();
    expect(screen.queryByText(/採点の基準座標ではありません/)).not.toBeInTheDocument();
  });

  it("RESET_PIZZA preserves the same-recipe mini reference", async () => {
    const user = userEvent.setup();
    await enterMakingWith(user, "bismarck");
    await user.click(screen.getByRole("button", { name: "やり直す" }));
    expect(document.querySelector(".mini-reference")).toBeInTheDocument();
    expect(document.querySelector(".order-card")).toHaveTextContent("ビスマルク");
  });

  it("RETRY_SAME_RECIPE (もう一度つくる) preserves the same-recipe reference", async () => {
    const user = userEvent.setup();
    await enterMakingWith(user, "bismarck");
    completeDoughStep();
    await user.click(screen.getByRole("button", { name: /次へ/ })); // DOUGH -> SAUCE
    await user.click(screen.getByRole("button", { name: /次へ/ })); // SAUCE -> CHEESE
    await user.click(screen.getByRole("button", { name: /次へ/ })); // CHEESE -> TOPPING
    await user.click(screen.getByRole("button", { name: /焼く/ }));
    // RESULT 2.0 Slice 1: REGISTER_TO_DEX now applies automatically at BAKE -> RESULT, so this
    // lands directly on the merged Hero result screen -- no separate registration tap.
    await user.click(screen.getByRole("button", { name: "取り出す！" }));
    await completeCutStepIfPresent(user);

    await user.click(screen.getByRole("button", { name: "もう一度つくる" }));

    expect(document.querySelector(".order-card")).toHaveTextContent("ビスマルク");
    expect(
      screen.getByRole("button", { name: /ビスマルクの見本を拡大表示/ }),
    ).toBeInTheDocument();
  });
});

describe("Selecting a different recipe updates the reference", () => {
  it("Pizza Select -> a different recipe swaps the mini/expanded reference accordingly", async () => {
    const user = userEvent.setup();
    await enterMakingWith(user, "bismarck");
    expect(
      screen.getByRole("button", { name: /ビスマルクの見本を拡大表示/ }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /ホーム/ }));
    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    // The pre-seeded Chapter 1 chain (bismarck's own unlock prerequisite) already discovered
    // margherita too, so its grid card now reads COMPLETED, not NEW -- `selectRecipeInPizzaSelect`
    // matches by name prefix only, so this holds regardless of card state.
    await selectRecipeInPizzaSelect(user, "margherita");

    expect(
      screen.queryByRole("button", { name: /ビスマルクの見本を拡大表示/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /マルゲリータの見本を拡大表示/ }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /マルゲリータの見本を拡大表示/ }));
    expect(screen.getByRole("dialog", { name: /マルゲリータの見本/ })).toBeInTheDocument();
  });
});
