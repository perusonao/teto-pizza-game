import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MissionShortagePanel } from "./MissionShortagePanel";

afterEach(() => {
  cleanup();
});

/** Issue #212 (H-R): the short Lunch Rush order card. */
describe("MissionShortagePanel", () => {
  it("lists every short material as name + have/need, in the given order", () => {
    render(
      <MissionShortagePanel
        shortages={[
          { ingredientId: "olive-oil", need: 1, have: 0 },
          { ingredientId: "gorgonzola", need: 2, have: 1 },
          { ingredientId: "fontina", need: 2, have: 0 },
        ]}
        onSkip={() => {}}
      />,
    );
    expect(screen.getByRole("heading", { name: /材料が足りません/ })).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items.map((li) => li.getAttribute("data-ingredient-id"))).toEqual(["olive-oil", "gorgonzola", "fontina"]);
    expect(items[1]).toHaveTextContent("ゴルゴンゾーラ1/2");
    expect(screen.getByLabelText("オリーブオイル 在庫0 必要1")).toBeInTheDocument();
    expect(screen.getByText("補充はランチラッシュのあとでショップへ")).toBeInTheDocument();
  });

  it("「この注文をスキップ」 is the only CTA and calls onSkip once per tap", async () => {
    const onSkip = vi.fn();
    const user = userEvent.setup();
    render(<MissionShortagePanel shortages={[{ ingredientId: "egg", need: 1, have: 0 }]} onSkip={onSkip} />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "この注文をスキップ" }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
