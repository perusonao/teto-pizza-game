import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { INGREDIENTS } from "../data/ingredients";
import { getDinnerMission } from "../mission/dinner/dinnerMission";
import { startDinnerRun, type DinnerRunState } from "../mission/dinner/dinnerRun";
import { DinnerAbandonDialog, DinnerHud, DinnerResultOverlay, DinnerTargetBoard, DinnerTargetResultPanel } from "./DinnerGameUi";

/** Dinner Mission DM-3 (Issue #242): the in-game Dinner components render the DM-2 run as is. */

afterEach(cleanup);

const DM_A_IDS = ["margherita", "bismarck", "breakfast-pizza", "funghi"];
const T0 = 1_000_000;

function run(patch: Partial<DinnerRunState> = {}): DinnerRunState {
  const started = startDinnerRun(
    getDinnerMission("dm-a")!,
    {
      dex: DM_A_IDS.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3, timesMade: 1 })),
      ownedIngredientIds: INGREDIENTS.map((i) => i.id),
      inventory: { egg: 2, bacon: 3, mushroom: 3 },
    },
    T0,
    180_000,
  );
  if (!started.ok) throw new Error("start");
  return { ...started.state, ...patch };
}

describe("DinnerHud", () => {
  it("shows DINNER, the time left from the run's own clock, and completed / total", () => {
    render(<DinnerHud run={run({ completedRecipeIds: ["funghi", "bismarck"] })} now={T0 + 78_000} />);
    const hud = screen.getByTestId("dinner-hud");
    expect(hud).toHaveTextContent("DINNER");
    expect(hud).toHaveTextContent("01:42");
    expect(hud).toHaveTextContent("2 / 4");
  });
});

describe("DinnerTargetBoard", () => {
  it("lists every target; completed ones are checked and cannot be selected", () => {
    const onSelect = vi.fn();
    render(<DinnerTargetBoard run={run({ completedRecipeIds: ["margherita"] })} now={T0} titleJa="ディナーミッション 1" onSelect={onSelect} />);
    expect(screen.getByText("残り", { exact: false })).toHaveTextContent("残り 3 / 4");
    const done = screen.getByRole("button", { name: /マルゲリータ/ });
    expect(done).toBeDisabled();
    fireEvent.click(done);
    fireEvent.click(screen.getByRole("button", { name: /ビスマルク/ }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("bismarck");
  });
});

describe("DinnerTargetResultPanel", () => {
  it("PASS: 完成！ and back to the list", () => {
    const onBack = vi.fn();
    render(<DinnerTargetResultPanel recipeNameJa="ビスマルク" completion={{ status: "PASS" }} completed={1} total={4} onBack={onBack} />);
    expect(screen.getByRole("status")).toHaveTextContent("ビスマルク 完成！");
    fireEvent.click(screen.getByRole("button", { name: "ターゲット一覧へ" }));
    expect(onBack).toHaveBeenCalled();
  });

  it("FAILED: the Completion Gate reason and that it can be cooked again", () => {
    render(
      <DinnerTargetResultPanel
        recipeNameJa="ビスマルク"
        completion={{ status: "FAILED", reason: "UNDERBAKED", failures: [{ reason: "UNDERBAKED" }] }}
        completed={0}
        total={4}
        onBack={() => {}}
      />,
    );
    expect(screen.getByRole("alert").textContent).not.toBe("");
    expect(screen.getByText("ビスマルクはもう一度作れます")).toBeInTheDocument();
  });
});

describe("DinnerResultOverlay", () => {
  const handlers = { onRetry: vi.fn(), onHome: vi.fn(), onOpenShop: vi.fn() };

  it("CLEAR: title, pizzas made and the clear time; no reward row (DM-4)", () => {
    const r = run({ status: "CLEARED", completedRecipeIds: DM_A_IDS, outcome: { kind: "CLEAR", endedAt: T0 + 95_000, clearMs: 95_000 } });
    render(<DinnerResultOverlay run={r} titleJa="ディナーミッション 1" retryBlocked={false} {...handlers} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("DINNER CLEAR!");
    expect(dialog).toHaveTextContent("4 / 4");
    expect(dialog).toHaveTextContent("01:35");
    expect(dialog).not.toHaveTextContent("Pitz");
    expect(dialog).not.toHaveTextContent("報酬");
  });

  it("TIME_UP: 時間切れ！ with the count", () => {
    const r = run({ status: "FAILED", completedRecipeIds: ["funghi"], outcome: { kind: "FAILED", reason: "TIME_UP", endedAt: T0 + 180_000 } });
    render(<DinnerResultOverlay run={r} titleJa="ディナーミッション 1" retryBlocked={false} {...handlers} />);
    expect(screen.getByRole("dialog")).toHaveTextContent("時間切れ！");
    expect(screen.getByRole("dialog")).toHaveTextContent("1 / 4");
  });

  it("INFEASIBLE: 材料が足りなくなりました with the shortage; a blocked retry offers the Shop", () => {
    const r = run({
      status: "FAILED",
      completedRecipeIds: ["bismarck"],
      outcome: {
        kind: "FAILED",
        reason: "INFEASIBLE",
        endedAt: T0 + 5,
        shortages: [{ ingredientId: "egg", need: 1, have: 0, recipeIds: ["breakfast-pizza"] }],
      },
    });
    const onOpenShop = vi.fn();
    render(<DinnerResultOverlay run={r} titleJa="ディナーミッション 1" retryBlocked onRetry={vi.fn()} onHome={vi.fn()} onOpenShop={onOpenShop} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("材料が足りなくなりました");
    expect(dialog).toHaveTextContent("たまご 必要 1 / 所持 0");
    expect(screen.getByRole("button", { name: "もう一度" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "ショップへ" }));
    expect(onOpenShop).toHaveBeenCalled();
  });

  it("renders nothing for a run that is still PLAYING", () => {
    const { container } = render(<DinnerResultOverlay run={run()} titleJa="x" retryBlocked={false} {...handlers} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("DinnerAbandonDialog", () => {
  it("explains the cost and offers 続ける / やめる", () => {
    const onContinue = vi.fn();
    const onQuit = vi.fn();
    render(<DinnerAbandonDialog onContinue={onContinue} onQuit={onQuit} />);
    expect(screen.getByRole("alertdialog")).toHaveTextContent("ここまで使った材料は戻りません。");
    fireEvent.click(screen.getByRole("button", { name: "続ける" }));
    fireEvent.click(screen.getByRole("button", { name: "やめる" }));
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onQuit).toHaveBeenCalledTimes(1);
  });
});
