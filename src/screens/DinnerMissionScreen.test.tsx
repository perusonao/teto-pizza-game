import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { INGREDIENTS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { getDinnerMission, type DinnerMissionDefinition } from "../mission/dinner/dinnerMission";
import type { DexEntry } from "../state/dex";
import { DinnerMissionScreen } from "./DinnerMissionScreen";

/** Dinner Mission DM-3 (Issue #242) / DM-3R-2 (Issue #250): Mission Select / Detail, with the privacy rule on the DOM. */

afterEach(cleanup);

const ALL_IDS = INGREDIENTS.map((i) => i.id);
const DM_A_IDS = ["margherita", "bismarck", "breakfast-pizza", "funghi"];
const dexOf = (ids: readonly string[]): DexEntry[] =>
  ids.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3 as const, timesMade: 1 }));

function renderScreen(
  discovered: readonly string[],
  inventory: Record<string, number>,
  durationMs: number | null = 60_000,
  minimumStars: 1 | 2 | 3 | 4 | 5 | null = 3,
) {
  const handlers = { onStart: vi.fn(), onBack: vi.fn(), onOpenShop: vi.fn() };
  const view = render(
    <DinnerMissionScreen
      dex={dexOf(discovered)}
      ownedIngredientIds={ALL_IDS}
      inventory={inventory}
      durationFor={() => durationMs}
      minimumStarsFor={() => minimumStars}
      {...handlers}
    />,
  );
  return { ...view, ...handlers };
}

/** Every text node and attribute value in the rendered tree. */
function domStrings(container: HTMLElement): string {
  const parts: string[] = [container.textContent ?? ""];
  for (const el of container.querySelectorAll("*")) for (const a of el.attributes) parts.push(a.value);
  return parts.join("\n");
}

describe("Mission Select privacy", () => {
  it("with only margherita discovered, no other recipe's name, description or id is anywhere in the DOM", () => {
    const { container } = renderScreen(["margherita"], {});
    expect(screen.getAllByText(/あと3種類のピザを発見すると解放/)).toHaveLength(2);
    const dom = domStrings(container);
    for (const r of RECIPES.filter((x) => x.id !== "margherita")) {
      expect(dom, r.id).not.toContain(r.nameJa);
      expect(dom, r.id).not.toContain(r.description);
      expect(dom, r.id).not.toMatch(new RegExp(`\\b${r.id}\\b`));
    }
    // A locked card is not interactive at all.
    expect(container.querySelectorAll(".dinner-mission-card--locked button")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /ディナーミッション 2/ })).toBeNull();
  });

  it("DM-A unlocked lists its names; DM-B stays anonymous", () => {
    const { container } = renderScreen(DM_A_IDS, {});
    expect(screen.getByRole("button", { name: /ディナーミッション 1/ })).toHaveTextContent("ブレックファストピザ");
    const dom = domStrings(container);
    for (const id of ["melanzane-pizza", "parmigiana-pizza"]) {
      const r = RECIPES.find((x) => x.id === id)!;
      expect(dom).not.toContain(r.nameJa);
      expect(dom).not.toContain(id);
    }
  });
});

describe("Mission Detail", () => {
  it("READY: targets, time limit, the injected ★ line and an enabled START that passes duration and S", () => {
    const { onStart } = renderScreen(DM_A_IDS, { egg: 2, bacon: 3, mushroom: 3 }, 300_000, 4);
    fireEvent.click(screen.getByRole("button", { name: /ディナーミッション 1/ }));
    expect(screen.getByText("材料はそろっています", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("05:00")).toBeInTheDocument();
    expect(screen.getByText("★4 以上")).toBeInTheDocument();
    expect(screen.getByText(/作るピザは選びません/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /スタート/ }));
    expect(onStart).toHaveBeenCalledWith("dm-a", 300_000, 4);
  });

  it("OD-R2: no S (production until DM-5) -> START disabled like a missing duration", () => {
    renderScreen(DM_A_IDS, { egg: 2, bacon: 3, mushroom: 3 }, 300_000, null);
    fireEvent.click(screen.getByRole("button", { name: /ディナーミッション 1/ }));
    expect(screen.getByRole("button", { name: /スタート/ })).toBeDisabled();
    expect(screen.queryByText(/以上/)).toBeNull();
  });

  it("SHORTAGE: 材料が足りません with need / have, START disabled, Shop offered", () => {
    const { onStart, onOpenShop } = renderScreen(DM_A_IDS, { egg: 1, bacon: 3, mushroom: 3 });
    fireEvent.click(screen.getByRole("button", { name: /ディナーミッション 1/ }));
    expect(screen.getByRole("alert")).toHaveTextContent("材料が足りません");
    expect(screen.getByRole("alert")).toHaveTextContent("たまご 必要 2 / 所持 1");
    const start = screen.getByRole("button", { name: /スタート/ });
    expect(start).toBeDisabled();
    fireEvent.click(start);
    expect(onStart).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /ショップで補充する/ }));
    expect(onOpenShop).toHaveBeenCalled();
  });

  it("OD-DM3-1: no duration -> 調整中 and START disabled", () => {
    renderScreen(DM_A_IDS, { egg: 2, bacon: 3, mushroom: 3 }, null);
    fireEvent.click(screen.getByRole("button", { name: /ディナーミッション 1/ }));
    expect(screen.getByText("調整中")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /スタート/ })).toBeDisabled();
  });

  it("Detail resolves from the supplied `missions`, not the global list", () => {
    const dmA = getDinnerMission("dm-a")!;
    const custom: DinnerMissionDefinition = {
      ...dmA,
      missionId: "dm-test",
      display: { ...dmA.display, titleJa: "テストミッション" },
      targetRecipeIds: ["margherita", "funghi"],
    };
    const onStart = vi.fn();
    render(
      <DinnerMissionScreen
        dex={dexOf(DM_A_IDS)}
        ownedIngredientIds={ALL_IDS}
        inventory={{ egg: 2, bacon: 3, mushroom: 3 }}
        durationFor={() => 60_000}
        minimumStarsFor={() => 3}
        onStart={onStart}
        onBack={vi.fn()}
        onOpenShop={vi.fn()}
        missions={[custom]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /テストミッション/ }));
    expect(screen.getByText("この 2 種類を、時間内に全部作ろう！")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /スタート/ }));
    expect(onStart).toHaveBeenCalledWith("dm-test", 60_000, 3);
  });

  it("← もどる returns to the list; ホーム leaves", () => {
    const { onBack } = renderScreen(DM_A_IDS, {});
    fireEvent.click(screen.getByRole("button", { name: /ディナーミッション 1/ }));
    fireEvent.click(screen.getByRole("button", { name: /もどる/ }));
    expect(screen.getByRole("button", { name: /ディナーミッション 1/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /ホーム/ }));
    expect(onBack).toHaveBeenCalled();
  });
});
