import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { INGREDIENTS } from "../data/ingredients";
import { getDinnerMission } from "../mission/dinner/dinnerMission";
import { startDinnerRun, type DinnerRunState } from "../mission/dinner/dinnerRun";
import { RECIPES } from "../data/recipes";
import {
  DinnerAbandonDialog,
  DinnerAttemptResultPanel,
  DinnerHud,
  DinnerResultOverlay,
  DinnerTargetRow,
} from "./DinnerGameUi";

/** Dinner Mission DM-3 (Issue #242) / DM-3R-2 (Issue #250): the in-game Dinner components render the run as is. */

afterEach(cleanup);

const DM_A_IDS = ["margherita", "bismarck", "breakfast-pizza", "funghi"];
const T0 = 1_000_000;

function run(patch: Partial<DinnerRunState> = {}): DinnerRunState {
  const started = startDinnerRun(
    getDinnerMission("dm-a")!,
    {
      dex: DM_A_IDS.map((recipeId) => ({ recipeId, discovered: true, bestScore: 70, bestStars: 3 as const, timesMade: 1 })),
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

// DM-3R-2 replaces DM-3's DinnerTargetBoard (select a target, then cook it) with the compact target
// row, and DinnerTargetResultPanel (the declared target's PASS / FAILED) with the 6-category
// attempt result: there is no selection to test any more, only that a tap is not one.
describe("DinnerTargetRow (R27: a reference tap is not a selection)", () => {
  it("shows the time, progress and every target with ✓ on the completed ones", () => {
    render(<DinnerTargetRow run={run({ completedRecipeIds: ["margherita"] })} now={T0 + 78_000} onOpenReference={vi.fn()} />);
    expect(screen.getByTestId("dinner-hud")).toHaveTextContent("01:42");
    expect(screen.getByTestId("dinner-hud")).toHaveTextContent("1/4");
    const row = screen.getByTestId("dinner-target-row");
    for (const name of ["マルゲリータ", "ビスマルク", "ブレックファストピザ", "フンギ"]) expect(row).toHaveTextContent(name);
    expect(screen.getByTestId("dinner-chip-margherita")).toHaveClass("dinner-chip--done");
    expect(screen.getByTestId("dinner-chip-margherita")).toHaveTextContent("✓");
    expect(screen.getByTestId("dinner-chip-bismarck")).not.toHaveClass("dinner-chip--done");
  });

  it("a tap only asks to open that target's reference -- completed targets too, nothing else happens", () => {
    const onOpenReference = vi.fn();
    render(<DinnerTargetRow run={run({ completedRecipeIds: ["margherita"] })} now={T0} onOpenReference={onOpenReference} />);
    fireEvent.click(screen.getByTestId("dinner-chip-bismarck"));
    fireEvent.click(screen.getByTestId("dinner-chip-margherita"));
    expect(onOpenReference.mock.calls).toEqual([["bismarck"], ["margherita"]]);
    for (const chip of screen.getAllByRole("button")) {
      expect(chip).not.toHaveAttribute("aria-pressed");
      expect(chip).not.toHaveAttribute("aria-selected");
      expect(chip).toBeEnabled();
    }
  });
});

describe("DinnerAttemptResultPanel", () => {
  it("TARGET_PASS: 「○○完成！」, the progress and 次のピザを作る", () => {
    const onNext = vi.fn();
    render(
      <DinnerAttemptResultPanel
        view={{ category: "TARGET_PASS", recipeId: "bismarck", nameJa: "ビスマルク", stars: 5, minimumStars: 3 }}
        completed={1}
        total={4}
        onNext={onNext}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("ビスマルク完成！");
    expect(screen.getByTestId("dinner-attempt-result")).toHaveTextContent("完成 1 / 4");
    fireEvent.click(screen.getByRole("button", { name: /次のピザを作る/ }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ category: "QUALITY_FAIL", recipeId: "funghi", nameJa: "フンギ", failure: { kind: "BELOW_MINIMUM_STARS", stars: 2, minimumStars: 3 } }, "もう少し丁寧に作ろう"],
    [{ category: "DUPLICATE_TARGET", recipeId: "funghi", nameJa: "フンギ" }, "これはもう完成済み！"],
    [{ category: "NON_TARGET", recipeId: "marinara", nameJa: "マリナーラ" }, "マリナーラができた！"],
    [{ category: "ORIGINAL" }, "オリジナルピザ！"],
    [{ category: "INVALID_PIZZA", reason: "OVERBAKED" }, "ピザとして完成しませんでした"],
  ] as const)("%j -> %s", (view, title) => {
    render(<DinnerAttemptResultPanel view={view} completed={0} total={4} onNext={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent(title);
    expect(screen.getByTestId("dinner-attempt-result")).toHaveAttribute("data-category", view.category);
  });

  it("OD-DUI-5a: a QUALITY_FAIL below S shows あと★N (N = injected S − ★); other results do not", () => {
    render(
      <DinnerAttemptResultPanel
        view={{ category: "QUALITY_FAIL", recipeId: "margherita", nameJa: "マルゲリータ", failure: { kind: "BELOW_MINIMUM_STARS", stars: 3, minimumStars: 5 } }}
        completed={0}
        total={4}
        onNext={vi.fn()}
      />,
    );
    expect(screen.getByTestId("dinner-attempt-gap")).toHaveTextContent("あと★2");
    expect(screen.getByTestId("dinner-attempt-result")).toHaveTextContent("マルゲリータ ★3（合格は★5以上）");
  });

  it.each([
    { category: "TARGET_PASS", recipeId: "bismarck", nameJa: "ビスマルク", stars: 4, minimumStars: 3 },
    { category: "QUALITY_FAIL", recipeId: "funghi", nameJa: "フンギ", failure: { kind: "COMPLETION_GATE", reason: "MISSING_REQUIRED_INGREDIENT", ingredientId: "mushroom" } },
    { category: "INVALID_PIZZA", reason: "UNDERBAKED" },
    { category: "ORIGINAL" },
  ] as const)("no あと★ line for %j", (view) => {
    render(<DinnerAttemptResultPanel view={view} completed={0} total={4} onNext={vi.fn()} />);
    expect(screen.queryByTestId("dinner-attempt-gap")).toBeNull();
    expect(screen.getByTestId("dinner-attempt-result")).not.toHaveTextContent("あと★");
  });

  it("an ORIGINAL result shows no recipe name at all", () => {
    render(<DinnerAttemptResultPanel view={{ category: "ORIGINAL" }} completed={0} total={4} onNext={vi.fn()} />);
    const text = screen.getByTestId("dinner-attempt-result").textContent ?? "";
    for (const r of RECIPES) expect(text, r.id).not.toContain(r.nameJa);
  });
});

describe("DinnerResultOverlay", () => {
  const handlers = { onRetry: vi.fn(), onHome: vi.fn(), onOpenShop: vi.fn() };

  it("CLEAR: title, pizzas made and the clear time; no reward row (DM-4)", () => {
    const r = run({ status: "CLEARED", completedRecipeIds: DM_A_IDS, outcome: { kind: "CLEAR", endedAt: T0 + 95_000, clearMs: 95_000 } });
    render(
      <DinnerResultOverlay
        run={r}
        titleJa="ディナーミッション 1"
        lastResult={{ category: "TARGET_PASS", recipeId: "breakfast-pizza", nameJa: "ブレックファストピザ", stars: 4, minimumStars: 3 }}
        retryBlocked={false}
        {...handlers}
      />,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("DINNER CLEAR!");
    // The pizza that cleared the run is named, not only the aggregate.
    expect(screen.getByTestId("dinner-result-last")).toHaveTextContent("最後のピザ：ブレックファストピザ ★4");
    // OD-DUI-3a: the pizza itself, never a headline.
    expect(screen.getByTestId("dinner-result-last")).not.toHaveTextContent("完成！");
    expect(dialog).toHaveTextContent("4 / 4");
    expect(dialog).toHaveTextContent("01:35");
    expect(dialog).not.toHaveTextContent("Pitz");
    expect(dialog).not.toHaveTextContent("報酬");
  });

  it("TIME_UP: 時間切れ！ with the count", () => {
    const r = run({ status: "FAILED", completedRecipeIds: ["funghi"], outcome: { kind: "FAILED", reason: "TIME_UP", endedAt: T0 + 180_000 } });
    render(
      <DinnerResultOverlay
        run={r}
        titleJa="ディナーミッション 1"
        lastResult={{ category: "ORIGINAL" }}
        retryBlocked={false}
        {...handlers}
      />,
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("時間切れ！");
    expect(screen.queryByTestId("dinner-result-last")).toBeNull();
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
    render(<DinnerResultOverlay run={r} titleJa="ディナーミッション 1" lastResult={{ category: "DUPLICATE_TARGET", recipeId: "bismarck", nameJa: "ビスマルク" }} retryBlocked onRetry={vi.fn()} onHome={vi.fn()} onOpenShop={onOpenShop} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("材料が足りなくなりました");
    expect(dialog).toHaveTextContent("たまご 必要 1 / 所持 0");
    expect(screen.getByTestId("dinner-result-last")).toHaveTextContent("最後のピザ：ビスマルク");
    expect(screen.getByTestId("dinner-result-last")).not.toHaveTextContent("これはもう完成済み！");
    expect(screen.getByRole("button", { name: "もう一度" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "ショップへ" }));
    expect(onOpenShop).toHaveBeenCalled();
  });

  it("renders nothing for a run that is still PLAYING", () => {
    const { container } = render(<DinnerResultOverlay run={run()} titleJa="x" lastResult={null} retryBlocked={false} {...handlers} />);
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
