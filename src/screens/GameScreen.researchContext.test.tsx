import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "../state/gameReducer";
import { discoveredDex } from "../state/testSupport/guidedRound";
import { keysBefore, ladderOwned, renderGameScreen as renderAt, researchRound, RESEARCH_TARGET as T } from "./testSupport/researchRound";

/**
 * Issue #358 Slice 1: where does the Research Target context (`research-context`: 「🔎 研究中 ？？？ピザ」) live across
 * the cooking transitions of a Research round? Real reducer + real GameScreen (Dex 25 ladder save, pesto-pollo the
 * single Research Entry).
 */

afterEach(cleanup);

// PREPARE shows the dedicated card; BAKE keeps the label in its compact row.
const hasContext = (s: GameState) => {
  const r = renderAt(s);
  const has = !!screen.queryByTestId("research-context") || (s.phase === "BAKE" && !!screen.queryByText(/研究中/));
  r.unmount();
  return has;
};
const trace: string[] = [];
function step(label: string, s: GameState, ...a: GameAction[]) {
  const next = a.reduce(gameReducer, s);
  trace.push(`${label}: phase=${next.phase} step=${next.makingStep} target=${next.researchTargetId} ctx=${hasContext(next)}`);
  return next;
}

describe("Research context across the transitions of a Research round", () => {
  it("traces every transition", () => {
    let s = researchRound();
    s = step("start", s);
    s = step("dough stretch", s, { type: "COMMIT_DOUGH_STRETCH", shape: { widthPct: 100, heightPct: 100 } as never });
    s = step("reset (dough)", s, { type: "RESET_PIZZA" });
    s = step("next->SAUCE", s, { type: "CONFIRM_MAKING_STEP" });
    s = step("sauce", s, { type: "APPLY_SAUCE", ingredientId: "pesto", x: 50, y: 50 });
    s = step("next", s, { type: "CONFIRM_MAKING_STEP" });
    s = step("next", s, { type: "CONFIRM_MAKING_STEP" });
    s = step("topping", s, { type: "PLACE_TOPPING", ingredientId: "egg", x: 40, y: 40 });
    s = step("bake", s, { type: "START_BAKE" });
    expect(trace.every((l) => l.endsWith("ctx=true"))).toBe(true);
  });

  it("retry after an attempt that used the target's last finite stock", () => {
    const owned = ladderOwned(25);
    const base = createInitialGameState(discoveredDex([...keysBefore(25), "brazilian-calabresa"]), owned, 1000);
    const inv: Record<string, number> = Object.fromEntries(owned.map((id) => [id, 10]));
    for (const id of ["chicken", "mozzarella", "fresh-tomato", "pesto"]) inv[id] = 1;
    let s = gameReducer({ ...base, inventory: inv }, { type: "START_FREE_COOK", researchTargetId: T });
    const out: string[] = [];
    out.push(`start ctx=${hasContext(s)}`);
    s = [{ type: "CONFIRM_MAKING_STEP" }, { type: "APPLY_SAUCE", ingredientId: "pesto", x: 50, y: 50 }, { type: "CONFIRM_MAKING_STEP" }, { type: "CONFIRM_MAKING_STEP" },
      { type: "PLACE_TOPPING", ingredientId: "chicken", x: 40, y: 40 }, { type: "PLACE_TOPPING", ingredientId: "egg", x: 55, y: 45 }, { type: "START_BAKE" }, { type: "CONFIRM_BAKE", value: 68 }, { type: "CONFIRM_MAKING_STEP" }, { type: "REGISTER_TO_DEX" }].reduce(
      (a, x) => gameReducer(a, x as GameAction), s);
    out.push(`result ${s.phase}`);
    s = gameReducer(s, { type: "RETRY_SAME_RECIPE" });
    expect(out[0]).toBe("start ctx=true");
    expect(s.researchTargetId).toBe(T);
    expect(s.inventory["chicken"]).toBe(0); // the target's own ingredient is used up: not cookable any more
    expect(hasContext(s)).toBe(true); // DOUGH of the retry still names the research (was: only 「🎨 レシピ発見の試作」)
    expect(out.length).toBe(2);
  });

  it("a targetless free cook has no research context", () => {
    const owned = ladderOwned(25);
    const base = createInitialGameState(discoveredDex([...keysBefore(25), "brazilian-calabresa"]), owned, 1000);
    const s = gameReducer({ ...base, inventory: Object.fromEntries(owned.map((id) => [id, 10])) }, { type: "START_FREE_COOK" });
    expect(hasContext(s)).toBe(false);
  });
});

describe("Slice 4: research card = knowledge / current hypothesis / step instruction", () => {
  const declared = (...a: GameAction[]) => a.reduce(gameReducer, gameReducer(researchRound(), { type: "SET_RESEARCH_TEST", ingredientId: "egg" }));

  it("EDITABLE: a selector button for the hypothesis, the knowledge line and the step instruction", () => {
    renderAt(declared());
    expect(screen.getByTestId("research-test-button")).toHaveTextContent("🔬 今回の調査: たまご");
    expect(screen.queryByTestId("research-test-status")).not.toBeInTheDocument();
    expect(screen.getByTestId("research-context")).toHaveTextContent("わかっていること：✓ チキンを使う");
    expect(screen.getByTestId("research-step-instruction")).toHaveTextContent("生地");
  });

  it("LOCKED (first step confirmed): a read-only 「調査中」 status replaces the button on every later step and in BAKE", () => {
    for (const s of [declared({ type: "CONFIRM_MAKING_STEP" }), declared({ type: "CONFIRM_MAKING_STEP" }, { type: "CONFIRM_MAKING_STEP" }), declared({ type: "RESET_PIZZA" }, { type: "CONFIRM_MAKING_STEP" }, { type: "RESET_PIZZA" }), declared({ type: "START_BAKE" })]) {
      const r = renderAt(s);
      expect(screen.queryByTestId("research-test-button")).not.toBeInTheDocument();
      expect(screen.getByTestId("research-test-status")).toHaveTextContent("🔬 調査中：たまご");
      expect(screen.getByTestId("research-test-status").tagName).toBe("SPAN");
      r.unmount();
    }
  });

  it("OD-358-7 priority: EDITABLE + valid target -> the selector only; never 「今回は食材調査なし」 beside it", () => {
    renderAt(researchRound());
    expect(screen.getByTestId("research-test-button")).toHaveTextContent("今回の調査をえらぶ");
    expect(screen.queryByTestId("research-test-status")).not.toBeInTheDocument();
    expect(screen.queryByText(/今回は食材調査なし/)).not.toBeInTheDocument();
  });

  it("LOCKED without a selection: no selector, a read-only 「🔬 今回は食材調査なし」 (PREPARE, after RESET, BAKE)", () => {
    const locked = gameReducer(researchRound(), { type: "CONFIRM_MAKING_STEP" });
    expect(locked.researchTest).toBeNull();
    for (const s of [locked, gameReducer(locked, { type: "RESET_PIZZA" }), gameReducer(researchRound(), { type: "START_BAKE" })]) {
      const r = renderAt(s);
      expect(screen.queryByTestId("research-test-button")).not.toBeInTheDocument();
      const status = screen.getByTestId("research-test-status");
      expect(status).toHaveTextContent("🔬 今回は食材調査なし");
      expect(status.tagName).toBe("SPAN");
      r.unmount();
    }
    // the research context itself is still there on the locked PREPARE card
    renderAt(locked);
    expect(screen.getByTestId("research-context")).toHaveTextContent("研究中");
  });

  it("selector unavailable (the target is not cookable any more): the same status, as a fact", () => {
    const owned = ladderOwned(25);
    const base = createInitialGameState(discoveredDex([...keysBefore(25), "brazilian-calabresa"]), owned, 1000);
    const inv: Record<string, number> = Object.fromEntries(owned.map((id) => [id, 10]));
    for (const id of ["chicken", "mozzarella", "fresh-tomato", "pesto"]) inv[id] = 1;
    let s = gameReducer({ ...base, inventory: inv }, { type: "START_FREE_COOK", researchTargetId: T });
    s = [{ type: "CONFIRM_MAKING_STEP" }, { type: "APPLY_SAUCE", ingredientId: "pesto", x: 50, y: 50 }, { type: "CONFIRM_MAKING_STEP" }, { type: "CONFIRM_MAKING_STEP" },
      { type: "PLACE_TOPPING", ingredientId: "chicken", x: 40, y: 40 }, { type: "START_BAKE" }, { type: "CONFIRM_BAKE", value: 68 }, { type: "CONFIRM_MAKING_STEP" }, { type: "REGISTER_TO_DEX" }].reduce(
      (a, x) => gameReducer(a, x as GameAction), s);
    s = gameReducer(s, { type: "RETRY_SAME_RECIPE" }); // EDITABLE, but chicken is used up: no selector can be offered
    expect(s.researchTestLocked).toBe(false);
    renderAt(s);
    expect(screen.queryByTestId("research-test-button")).not.toBeInTheDocument();
    expect(screen.getByTestId("research-test-status")).toHaveTextContent("🔬 今回は食材調査なし");
  });

  it("LOCKED with a selection keeps 「🔬 調査中：○○」, never the 「なし」 status", () => {
    renderAt(declared({ type: "CONFIRM_MAKING_STEP" }));
    expect(screen.getByTestId("research-test-status")).toHaveTextContent("🔬 調査中：たまご");
    expect(screen.queryByText(/今回は食材調査なし/)).not.toBeInTheDocument();
  });

  it("Production flag OFF: no identification UI at all (no selector, no status)", async () => {
    vi.resetModules();
    vi.doMock("../logic/discovery/researchIdentifyFlag", () => ({ RESEARCH_IDENTIFY_ENABLED: false }));
    try {
      const support = await import("./testSupport/researchRound");
      const reducer = await import("../state/gameReducer");
      for (const s of [support.researchRound(), reducer.gameReducer(support.researchRound(), { type: "CONFIRM_MAKING_STEP" })]) {
        const r = support.renderGameScreen(s);
        expect(screen.getByTestId("research-context")).toHaveTextContent("研究中");
        expect(screen.queryByTestId("research-test-button")).not.toBeInTheDocument();
        expect(screen.queryByTestId("research-test-status")).not.toBeInTheDocument();
        r.unmount();
      }
    } finally {
      vi.doUnmock("../logic/discovery/researchIdentifyFlag");
      vi.resetModules();
    }
  });

  it("shows no count / ratio / percentage / hidden identity", () => {
    renderAt(declared({ type: "CONFIRM_MAKING_STEP" }));
    const text = screen.getByTestId("research-context").textContent ?? "";
    expect(text).not.toMatch(/[0-9０-９]+\s*[/／%％]|残り|あと[0-9０-９]|ペスト|pesto-pollo/);
  });
});
