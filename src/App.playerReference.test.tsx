import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

/**
 * Issue #47 Slice B (Findings F/H) integration coverage: the persistent mini Reference
 * thumbnail during Making PREPARE, its tap-to-expand popover, and its lifecycle across
 * reset/retry/recipe-switch -- for both a recipe with a Scoring 2.0 Reference fixture
 * (Margherita) and one without (Bismarck), end to end through the real `App`.
 */
beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

async function enterMakingWith(user: ReturnType<typeof userEvent.setup>, cardName: string) {
  render(<App />);
  await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
  await user.click(screen.getByRole("button", { name: cardName }));
}

describe("Mini Reference (Margherita, Scoring 2.0 fixture)", () => {
  it("is visible during PREPARE without pressing anything", async () => {
    const user = userEvent.setup();
    await enterMakingWith(user, "マルゲリータ、未挑戦");
    expect(document.querySelector(".mini-reference")).toBeInTheDocument();
  });

  it("tapping it opens the existing unchanged Margherita popover", async () => {
    const user = userEvent.setup();
    await enterMakingWith(user, "マルゲリータ、未挑戦");
    await user.click(screen.getByRole("button", { name: /マルゲリータの見本を拡大表示/ }));
    expect(screen.getByRole("dialog", { name: /マルゲリータの見本/ })).toBeInTheDocument();
    // No numeric-precision content was lost for Margherita -- its own reviewed sauce bars
    // still render, unlike the generic panel used for recipes with no Scoring 2.0 fixture.
    expect(document.querySelector(".reference-preview__bar-row")).toBeInTheDocument();
  });

  it("closing the popover leaves the mini reference in place", async () => {
    const user = userEvent.setup();
    await enterMakingWith(user, "マルゲリータ、未挑戦");
    await user.click(screen.getByRole("button", { name: /マルゲリータの見本を拡大表示/ }));
    await user.click(screen.getByRole("button", { name: "閉じる" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.querySelector(".mini-reference")).toBeInTheDocument();
  });

  it("RESET_PIZZA (やり直す) preserves the same-recipe mini reference", async () => {
    const user = userEvent.setup();
    await enterMakingWith(user, "マルゲリータ、未挑戦");
    expect(document.querySelector(".mini-reference")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "やり直す" }));
    expect(document.querySelector(".mini-reference")).toBeInTheDocument();
    expect(document.querySelector(".order-card")).toHaveTextContent("マルゲリータ");
  });
});

describe("Mini Reference (Bismarck, no Scoring 2.0 fixture)", () => {
  it("is visible during PREPARE even though Scoring 2.0 has no Reference fixture for it", async () => {
    const user = userEvent.setup();
    await enterMakingWith(user, "ビスマルク、未挑戦");
    expect(document.querySelector(".mini-reference")).toBeInTheDocument();
  });

  it("tapping it opens the generic player reference popover, not Margherita's", async () => {
    const user = userEvent.setup();
    await enterMakingWith(user, "ビスマルク、未挑戦");
    await user.click(screen.getByRole("button", { name: /ビスマルクの見本を拡大表示/ }));
    expect(screen.getByRole("dialog", { name: /ビスマルクの見本/ })).toBeInTheDocument();
    // The generic panel never shows numeric quantity/coverage bars (no fabricated precision).
    expect(document.querySelector(".reference-preview__bar-row")).not.toBeInTheDocument();
    expect(screen.getByText(/採点の基準座標ではありません/)).toBeInTheDocument();
  });

  it("RESET_PIZZA preserves the same-recipe mini reference", async () => {
    const user = userEvent.setup();
    await enterMakingWith(user, "ビスマルク、未挑戦");
    await user.click(screen.getByRole("button", { name: "やり直す" }));
    expect(document.querySelector(".mini-reference")).toBeInTheDocument();
    expect(document.querySelector(".order-card")).toHaveTextContent("ビスマルク");
  });

  it("RETRY_SAME_RECIPE (もう一度つくる) preserves the same-recipe reference", async () => {
    const user = userEvent.setup();
    await enterMakingWith(user, "ビスマルク、未挑戦");
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /次へ/ }));
    await user.click(screen.getByRole("button", { name: /焼く/ }));
    await user.click(screen.getByRole("button", { name: "取り出す！" }));
    await user.click(screen.getByRole("button", { name: "レシピ図鑑に登録する" })); // DISCOVERED

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
    await enterMakingWith(user, "ビスマルク、未挑戦");
    expect(
      screen.getByRole("button", { name: /ビスマルクの見本を拡大表示/ }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /ホーム/ }));
    await user.click(screen.getByRole("button", { name: /ピザを作る/ }));
    await user.click(screen.getByRole("button", { name: "マルゲリータ、未挑戦" }));

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
