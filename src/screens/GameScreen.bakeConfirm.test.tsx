import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { gameReducer, type GameAction, type GameState } from "../state/gameReducer";
import { renderGameScreen, researchRound, researchSave } from "./testSupport/researchRound";

/**
 * Issue #358 Slice 3 (OD-358-5): 「🔥 焼く！」 with the declared ingredient not on the player's own pizza asks first;
 * it never forbids baking and reads only the pizza + the declaration (no recipe membership).
 */
afterEach(cleanup);

const act = (s: GameState, ...a: GameAction[]) => a.reduce(gameReducer, s);
/** A Research round at its last PREPARE step with `ingredientId` declared. */
function atBake(ingredientId: string | null, ...place: string[]): GameState {
  let s = researchRound();
  if (ingredientId) s = act(s, { type: "SET_RESEARCH_TEST", ingredientId });
  s = act(s, { type: "CONFIRM_MAKING_STEP" }, { type: "CONFIRM_MAKING_STEP" }, { type: "CONFIRM_MAKING_STEP" });
  place.forEach((id, i) => {
    s = act(s, { type: "PLACE_TOPPING", ingredientId: id, x: 40 + i * 6, y: 45 });
  });
  expect(s.makingStep).toBe("TOPPING");
  return s;
}
const bake = () => screen.getByRole("button", { name: /焼く！/ });

describe("unused declared ingredient -> confirm before baking", () => {
  it("unused: 焼く！ opens the confirm and does not start the bake", () => {
    const onStartBake = vi.fn();
    renderGameScreen(atBake("egg"), { onStartBake });
    fireEvent.click(bake());
    const dialog = screen.getByTestId("bake-unused-confirm");
    expect(dialog).toHaveTextContent("たまごをまだ使っていません");
    expect(dialog).toHaveTextContent("このまま焼くと、今回の食材調査は行われません");
    expect(onStartBake).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "戻って追加する" })).toHaveFocus();
  });

  it("戻って追加する closes it, stays in PREPARE and hands focus back to 焼く！", async () => {
    const onStartBake = vi.fn();
    renderGameScreen(atBake("egg"), { onStartBake });
    fireEvent.click(bake());
    fireEvent.click(screen.getByRole("button", { name: "戻って追加する" }));
    expect(screen.queryByTestId("bake-unused-confirm")).not.toBeInTheDocument();
    expect(onStartBake).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(bake()).toHaveFocus();
  });

  it("Escape is 戻る too", () => {
    const onStartBake = vi.fn();
    renderGameScreen(atBake("egg"), { onStartBake });
    fireEvent.click(bake());
    fireEvent.keyDown(screen.getByTestId("bake-unused-confirm"), { key: "Escape" });
    expect(screen.queryByTestId("bake-unused-confirm")).not.toBeInTheDocument();
    expect(onStartBake).not.toHaveBeenCalled();
  });

  it("このまま焼く starts the bake exactly as before", () => {
    const onStartBake = vi.fn();
    renderGameScreen(atBake("egg"), { onStartBake });
    fireEvent.click(bake());
    fireEvent.click(screen.getByRole("button", { name: "このまま焼く" }));
    expect(onStartBake).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("bake-unused-confirm")).not.toBeInTheDocument();
  });

  it("used: no confirm, 焼く！ starts the bake directly", () => {
    const onStartBake = vi.fn();
    renderGameScreen(atBake("egg", "egg"), { onStartBake });
    fireEvent.click(bake());
    expect(screen.queryByTestId("bake-unused-confirm")).not.toBeInTheDocument();
    expect(onStartBake).toHaveBeenCalledTimes(1);
  });

  it("a declared sauce counts as used once it is on the pizza (same rule: the pizza only)", () => {
    let s = researchRound();
    s = act(s, { type: "SET_RESEARCH_TEST", ingredientId: "pesto" }, { type: "CONFIRM_MAKING_STEP" }, { type: "APPLY_SAUCE", ingredientId: "pesto", x: 50, y: 50 });
    s = act(s, { type: "CONFIRM_MAKING_STEP" }, { type: "CONFIRM_MAKING_STEP" });
    const onStartBake = vi.fn();
    renderGameScreen(s, { onStartBake });
    fireEvent.click(bake());
    expect(onStartBake).toHaveBeenCalledTimes(1);
  });

  it("targetless / nothing declared: no confirm", () => {
    const onStartBake = vi.fn();
    renderGameScreen(atBake(null), { onStartBake });
    fireEvent.click(bake());
    expect(onStartBake).toHaveBeenCalledTimes(1);
    cleanup();
    const targetless = act(researchSave(), { type: "START_FREE_COOK" }, { type: "CONFIRM_MAKING_STEP" }, { type: "CONFIRM_MAKING_STEP" }, { type: "CONFIRM_MAKING_STEP" });
    const again = vi.fn();
    renderGameScreen(targetless, { onStartBake: again });
    fireEvent.click(bake());
    expect(again).toHaveBeenCalledTimes(1);
  });

  it("the confirm depends on the player's pizza only: the same for an in-recipe and an out-of-recipe ingredient", () => {
    for (const id of ["egg", "pesto", "fresh-tomato"]) {
      renderGameScreen(atBake(id));
      fireEvent.click(bake());
      expect(screen.queryByTestId("bake-unused-confirm")).toBeInTheDocument();
      cleanup();
    }
  });
});

describe("the confirmation is a decision pause (Codex P2)", () => {
  it("reports open / closed so App can pause the Cooking Time while it is up", () => {
    const onBakeConfirmChange = vi.fn();
    renderGameScreen(atBake("egg"), { onBakeConfirmChange });
    expect(onBakeConfirmChange).toHaveBeenLastCalledWith(false);
    fireEvent.click(bake());
    expect(onBakeConfirmChange).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: "戻って追加する" }));
    expect(onBakeConfirmChange).toHaveBeenLastCalledWith(false);
  });
});
