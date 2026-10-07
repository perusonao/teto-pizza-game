import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { INGREDIENTS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { DiscoveryProgressionInspector } from "./DiscoveryProgressionInspector";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Discovery Progression Inspector screen", () => {
  it("lists every step with Step / Unlock / Newly Discoverable / Pool / Result from production data", () => {
    render(<DiscoveryProgressionInspector />);
    expect(screen.getByRole("heading", { name: "Discovery Progression Inspector" })).toBeInTheDocument();
    expect(screen.getByTestId("dpi-recipe-count")).toHaveTextContent(String(RECIPES.length));
    expect(screen.getByTestId("dpi-ingredient-count")).toHaveTextContent(String(INGREDIENTS.length));
    expect(screen.getByTestId("dpi-step-count")).toHaveTextContent(String(DISCOVERY_LADDER.steps.length));
    expect(screen.getByTestId("dpi-multi-count")).toHaveTextContent("2");
    const first = screen.getByTestId("dpi-row-1");
    expect(first).toHaveTextContent("🆕 たまご");
    expect(first).toHaveTextContent("Pool 1");
    expect(first).toHaveTextContent("NORMAL");
    const onion = screen.getByTestId("dpi-row-12");
    expect(onion).toHaveTextContent("🆕");
    expect(onion).toHaveTextContent("ポルトゲーザ");
    expect(onion).toHaveTextContent("ブラジリアン・カラブレーザ");
    expect(onion).toHaveTextContent("オージーピザ"); // TQ-1D: the third recipe made makeable by the onion
    expect(onion).toHaveTextContent("Pool 3");
    expect(within(onion).getByText("OPEN_POOL")).toBeInTheDocument();
    expect(screen.getByTestId("dpi-row-13")).toHaveTextContent("OPEN_POOL POSSIBLE");
  });

  it("expands a step to its detail: owned before/after, recipe No./id, missing material, ladderCredit, lunchRush, pools", async () => {
    const user = userEvent.setup();
    render(<DiscoveryProgressionInspector />);
    expect(screen.queryByTestId("dpi-detail-12")).toBeNull();
    await user.click(within(screen.getByTestId("dpi-row-12")).getByRole("button"));
    const detail = screen.getByTestId("dpi-detail-12");
    expect(detail).toHaveTextContent("Before owned");
    expect(detail).toHaveTextContent("After owned");
    expect(detail).toHaveTextContent("Before pool");
    expect(detail).toHaveTextContent("After pool");
    expect(screen.getByTestId("dpi-newly-count-12")).toHaveTextContent("3");
    const calabresa = within(detail).getByTestId("dpi-recipe-brazilian-calabresa");
    expect(calabresa).toHaveTextContent(/No\.\d\d/);
    expect(calabresa).toHaveTextContent("ladderCredit: false");
    expect(calabresa).toHaveTextContent("lunchRush: false");
    expect(calabresa).toHaveTextContent("Before不足: たまねぎ");
    expect(within(detail).getByTestId("dpi-recipe-pizza-portuguesa")).toHaveTextContent("ladderCredit: true");
    expect(within(detail).getByTestId("dpi-clue-onion")).toHaveTextContent("ピッツァ・ポルトゲーザ / ブラジリアン・カラブレーザ");
    await user.click(within(screen.getByTestId("dpi-row-12")).getByRole("button"));
    expect(screen.queryByTestId("dpi-detail-12")).toBeNull();
  });

  it("shows the cherry-tomato step (genovese) and filters by multi-recipe / OPEN_POOL / search", async () => {
    const user = userEvent.setup();
    render(<DiscoveryProgressionInspector />);
    expect(screen.getByTestId("dpi-row-18")).toHaveTextContent("チェリートマト");
    expect(screen.getByTestId("dpi-row-18")).toHaveTextContent("ジェノベーゼ");

    await user.click(screen.getByRole("button", { name: "複数recipe同時解禁" }));
    expect(screen.getByTestId("dpi-visible-count")).toHaveTextContent(`2 / ${DISCOVERY_LADDER.steps.length}`); // step 12 + Wave 2 step 28
    expect(screen.getByTestId("dpi-row-12")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "OPEN_POOL関連" }));
    expect(screen.getByTestId("dpi-visible-count")).toHaveTextContent(`${DISCOVERY_LADDER.steps.length - 11} / ${DISCOVERY_LADDER.steps.length}`); // step 12 + 13..last

    await user.click(screen.getByRole("button", { name: "全step" }));
    await user.type(screen.getByRole("searchbox", { name: "search" }), "cherry-tomato");
    expect(screen.getByTestId("dpi-row-18")).toBeInTheDocument();
    expect(screen.queryByTestId("dpi-row-1")).toBeNull();
  });

  it("is read-only: rendering and interacting never touch storage", async () => {
    const calls = [vi.spyOn(Storage.prototype, "getItem"), vi.spyOn(Storage.prototype, "setItem"), vi.spyOn(Storage.prototype, "removeItem"), vi.spyOn(Storage.prototype, "clear")];
    const user = userEvent.setup();
    render(<DiscoveryProgressionInspector />);
    await user.click(within(screen.getByTestId("dpi-row-12")).getByRole("button"));
    await user.click(screen.getByRole("button", { name: "OPEN_POOL関連" }));
    expect(calls.map((c) => c.mock.calls.length)).toEqual([0, 0, 0, 0]);
    expect(window.localStorage.length).toBe(0);
  });
});
