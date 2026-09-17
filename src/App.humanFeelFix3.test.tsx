import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

/**
 * Human Feel Fix 3 (PREPARE 1-screen layout + Compact Evaluation UI) integration coverage.
 * jsdom has no real box layout engine, so the actual "fits 390x844 without scrolling" claim
 * is verified in a real browser (see the Fix 3 result report's Browser Verification section,
 * with screenshots) -- what's testable here, and regresses just as easily, is the DOM
 * structure that layout depends on: the compact order-card replacing the old
 * character-portrait hint dialogue, the fixed-position Bake CTA bar, and the Sauce-category-
 * only gating on SauceMetricsPanel. Renders the real `App` end-to-end (same pattern as
 * App.test.tsx), not a mock of GameScreen's ~30-prop interface.
 */

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

async function enterFreePlayPrepare() {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
  // Issue #39: HOME's CTA now lands on Pizza Select first -- pick Margherita explicitly so
  // this suite's own "マルゲリータ" assertions below still hold (a fresh save's undiscovered,
  // unlocked Margherita renders as a NEW card). Issue #47 Finding C: selecting a recipe now
  // lands straight at PREPARE -- the old redundant フリープレイ tap is gone.
  await user.click(screen.getByRole("button", { name: "マルゲリータ、未挑戦" }));
  return user;
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

async function enterFreePlayAtSauce() {
  const user = await enterFreePlayPrepare();
  completeDoughStep();
  await user.click(screen.getByRole("button", { name: /次へ/ })); // DOUGH -> SAUCE
  return user;
}

describe("PREPARE 1-screen layout (Human Feel Fix 3)", () => {
  it("renders a single compact order-card (recipe name + hint + 見本) instead of the old character-portrait hint dialogue", async () => {
    await enterFreePlayAtSauce();

    const orderCard = document.querySelector(".order-card");
    expect(orderCard).toBeInTheDocument();
    expect(orderCard).toHaveTextContent("マルゲリータ");
    // buildHintLine's empty-sauce message for Margherita -- see data/hints.ts.
    expect(orderCard).toHaveTextContent("指でなぞってトマトソースを塗ろう");
    expect(screen.getByRole("button", { name: /見本/ })).toBeInTheDocument();

    // The old per-phase dialogue-area (character portrait + speech bubble) must not also be
    // rendering the hint redundantly during PREPARE.
    expect(document.querySelector(".dialogue-area")).not.toBeInTheDocument();
  });

  it("Issue #33 D1: the order-card shows DOUGH's own concise hint while DOUGH is the active step", async () => {
    await enterFreePlayPrepare();

    const orderCard = document.querySelector(".order-card");
    expect(orderCard).toBeInTheDocument();
    expect(orderCard).toHaveTextContent("生地を外側へ伸ばそう");
  });

  it("the Reference popover (existing modal, unchanged) still opens from the compact card's 見本 button", async () => {
    const user = await enterFreePlayPrepare();
    await user.click(screen.getByRole("button", { name: /見本/ }));
    expect(screen.getByRole("dialog", { name: /マルゲリータの見本/ })).toBeInTheDocument();
  });

  it("the PREPARE action row (やり直す/焼く/ヒント) uses the fixed-position Bake CTA bar class", async () => {
    const user = await enterFreePlayAtSauce();
    // Issue #32 Phase 2 / Issue #33 D1: 焼く only appears once the making flow has reached
    // TOPPING (DOUGH/SAUCE/CHEESE all show the "次へ" step-confirm CTA in the same slot
    // instead); this harness is already past DOUGH (enterFreePlayAtSauce), so two more clicks.
    await user.click(screen.getByRole("button", { name: /次へ/ })); // SAUCE -> CHEESE
    await user.click(screen.getByRole("button", { name: /次へ/ })); // CHEESE -> TOPPING
    const bakeButton = screen.getByRole("button", { name: /焼く/ });
    const actionRow = bakeButton.closest(".action-row");
    expect(actionRow).toHaveClass("prepare-bake-bar");
  });

  it("Ingredient Palette stays a fixed 3x2 grid (Fix 2 architecture untouched by Fix 3)", async () => {
    await enterFreePlayAtSauce();
    const tray = document.querySelector(".ingredient-tray");
    expect(tray).toBeInTheDocument();
    expect(tray!.className).not.toMatch(/scroll/i);
  });

  it("Issue #33 D1: the Ingredient Palette is hidden entirely while DOUGH is the active step", async () => {
    await enterFreePlayPrepare();
    expect(document.querySelector(".ingredient-tray")).not.toBeInTheDocument();
  });

  it("Issue #33 D1: DOUGH's own 次へ is disabled before the size threshold and enabled once stretched", async () => {
    await enterFreePlayPrepare();
    const nextButton = screen.getByRole("button", { name: /次へ/ });
    expect(nextButton).toBeDisabled();

    completeDoughStep();
    expect(nextButton).toBeEnabled();
  });
});

describe("Sauce evaluation panel: Sauce-category-only (Human Feel Fix 3 brief section F)", () => {
  it("is hidden while DOUGH is the active step (before sauce is even reachable)", async () => {
    await enterFreePlayPrepare();
    expect(document.querySelector(".sauce-metrics-panel")).not.toBeInTheDocument();
  });

  it("shows the compact ソースのでき panel once SAUCE is reached", async () => {
    await enterFreePlayAtSauce();
    expect(document.querySelector(".sauce-metrics-panel")).toBeInTheDocument();
    expect(screen.getByText("ソースのでき")).toBeInTheDocument();
  });

  it("hides the panel entirely on the Cheese tab", async () => {
    // Issue #32 Phase 2: category tabs are locked to the current making step -- reaching
    // CHEESE now goes through the real "次へ" step-confirm CTA, not a free tab click.
    const user = await enterFreePlayAtSauce();
    await user.click(screen.getByRole("button", { name: /次へ/ })); // SAUCE -> CHEESE
    expect(document.querySelector(".sauce-metrics-panel")).not.toBeInTheDocument();
    expect(screen.queryByText("ソースのでき")).not.toBeInTheDocument();
  });

  it("hides the panel entirely on the Topping tab", async () => {
    const user = await enterFreePlayAtSauce();
    await user.click(screen.getByRole("button", { name: /次へ/ })); // SAUCE -> CHEESE
    await user.click(screen.getByRole("button", { name: /次へ/ })); // CHEESE -> TOPPING
    expect(document.querySelector(".sauce-metrics-panel")).not.toBeInTheDocument();
  });

  it("shows the panel again only after a whole-pizza discard/restart back to DOUGH, then reaching SAUCE again", async () => {
    // Issue #32 Phase 2: the making flow is one-way -- there is no backward-editing path from
    // CHEESE to SAUCE. The only way back (and to the Sauce-only panel) is the explicit
    // whole-pizza discard/restart ("やり直す"), never a free tab click. Issue #33 D1: that
    // discard now returns to DOUGH, not directly to SAUCE, so the panel stays hidden until
    // DOUGH is completed and confirmed again too.
    const user = await enterFreePlayAtSauce();
    await user.click(screen.getByRole("button", { name: /次へ/ })); // SAUCE -> CHEESE
    expect(document.querySelector(".sauce-metrics-panel")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "やり直す" }));
    expect(document.querySelector(".sauce-metrics-panel")).not.toBeInTheDocument();

    completeDoughStep();
    await user.click(screen.getByRole("button", { name: /次へ/ })); // DOUGH -> SAUCE
    expect(document.querySelector(".sauce-metrics-panel")).toBeInTheDocument();
  });
});
