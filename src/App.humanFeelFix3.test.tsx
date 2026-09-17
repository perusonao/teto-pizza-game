import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
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
  // unlocked Margherita renders as a NEW card).
  await user.click(screen.getByRole("button", { name: "マルゲリータ、未挑戦" }));
  await user.click(screen.getByRole("button", { name: /フリープレイ/ }));
  return user;
}

describe("PREPARE 1-screen layout (Human Feel Fix 3)", () => {
  it("renders a single compact order-card (recipe name + hint + 見本) instead of the old character-portrait hint dialogue", async () => {
    await enterFreePlayPrepare();

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

  it("the Reference popover (existing modal, unchanged) still opens from the compact card's 見本 button", async () => {
    const user = await enterFreePlayPrepare();
    await user.click(screen.getByRole("button", { name: /見本/ }));
    expect(screen.getByRole("dialog", { name: /マルゲリータの見本/ })).toBeInTheDocument();
  });

  it("the PREPARE action row (やり直す/焼く/ヒント) uses the fixed-position Bake CTA bar class", async () => {
    const user = await enterFreePlayPrepare();
    // Issue #32 Phase 2: 焼く only appears once the making flow has reached TOPPING (SAUCE and
    // CHEESE show the "次へ" step-confirm CTA in the same slot instead).
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    const bakeButton = screen.getByRole("button", { name: /焼く/ });
    const actionRow = bakeButton.closest(".action-row");
    expect(actionRow).toHaveClass("prepare-bake-bar");
  });

  it("Ingredient Palette stays a fixed 3x2 grid (Fix 2 architecture untouched by Fix 3)", async () => {
    await enterFreePlayPrepare();
    const tray = document.querySelector(".ingredient-tray");
    expect(tray).toBeInTheDocument();
    expect(tray!.className).not.toMatch(/scroll/i);
  });
});

describe("Sauce evaluation panel: Sauce-category-only (Human Feel Fix 3 brief section F)", () => {
  it("shows the compact ソースのでき panel while Sauce is the active category (default)", async () => {
    await enterFreePlayPrepare();
    expect(document.querySelector(".sauce-metrics-panel")).toBeInTheDocument();
    expect(screen.getByText("ソースのでき")).toBeInTheDocument();
  });

  it("hides the panel entirely on the Cheese tab", async () => {
    // Issue #32 Phase 2: category tabs are locked to the current making step -- reaching
    // CHEESE now goes through the real "次へ" step-confirm CTA, not a free tab click.
    const user = await enterFreePlayPrepare();
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    expect(document.querySelector(".sauce-metrics-panel")).not.toBeInTheDocument();
    expect(screen.queryByText("ソースのでき")).not.toBeInTheDocument();
  });

  it("hides the panel entirely on the Topping tab", async () => {
    const user = await enterFreePlayPrepare();
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    expect(document.querySelector(".sauce-metrics-panel")).not.toBeInTheDocument();
  });

  it("shows the panel again only after a whole-pizza discard/restart back to Sauce", async () => {
    // Issue #32 Phase 2: the making flow is one-way -- there is no backward-editing path from
    // CHEESE to SAUCE. The only way back to SAUCE (and the Sauce-only panel) is the explicit
    // whole-pizza discard/restart ("やり直す"), never a free tab click.
    const user = await enterFreePlayPrepare();
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    expect(document.querySelector(".sauce-metrics-panel")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "やり直す" }));
    expect(document.querySelector(".sauce-metrics-panel")).toBeInTheDocument();
  });
});
