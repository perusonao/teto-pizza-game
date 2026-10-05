import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { GameScreen } from "./GameScreen";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "../state/gameReducer";
import { INITIAL_MISSION_STATE } from "../mission/lunchRush";
import { emptySauceMetrics } from "../logic/sauceField";
import type { IngredientCategory } from "../data/ingredients";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { discoveredDex } from "../state/testSupport/guidedRound";
import { RESEARCH_UX_COPY } from "../components/researchUxCopy";

/**
 * Issue #358 Slice 1: where does the Research Target context (`research-context`: 「🔎 研究中 ？？？ピザ」) live across
 * the cooking transitions of a Research round? Real reducer + real GameScreen (Dex 25 ladder save, pesto-pollo the
 * single Research Entry).
 */
const ladderOwned = (step: number) => [
  ...STARTER_INGREDIENT_IDS,
  ...DISCOVERY_LADDER.steps.filter((s) => s.step <= step).flatMap((s) => s.ingredientIds),
];
const keysBefore = (step: number) => ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId)];
const T = "pesto-pollo";
function researchRound(): GameState {
  const owned = ladderOwned(25);
  const base = createInitialGameState(discoveredDex([...keysBefore(25), "brazilian-calabresa", "aussie"]), owned, 1000);
  const s: GameState = { ...base, inventory: Object.fromEntries(owned.map((id) => [id, 10])) };
  return gameReducer(s, { type: "START_FREE_COOK", researchTargetId: T });
}
const CATEGORY_FOR_STEP: Record<string, IngredientCategory> = { DOUGH: "sauce", SAUCE: "sauce", CHEESE: "cheese", TOPPING: "topping" };
function renderAt(state: GameState) {
  return render(
    <GameScreen
      state={state}
      mission={INITIAL_MISSION_STATE}
      missionNow={0}
      missionDurationSeconds={180}
      missionBestAtStartOfRun={0}
      activeCategory={CATEGORY_FOR_STEP[state.makingStep] ?? "topping"}
      selectedIngredientId={null}
      bakeProgress={null}
      referenceModeEnabled
      referencePizza={null}
      isReferencePopoverOpen={false}
      isGlobalOverlayOpen={false}
      sauceMetrics={emptySauceMetrics()}
      sauceShadowScore={{ quantitySimilarity: 0, coverageSimilarity: 0, overall: 0 }}
      isDispensingSauce={false}
      pieceShadowMetrics={[]}
      showDoughShape
      doughShapeComplete
      onGoHome={() => {}}
      onBeginPrepare={() => {}}
      onResetPizza={() => {}}
      onConfirmMakingStep={() => {}}
      onStartBake={() => {}}
      onShowHint={() => {}}
      onChangeCategory={() => {}}
      onSelectIngredient={() => {}}
      onTapPizza={() => {}}
      onBakeTick={() => {}}
      onConfirmBake={() => {}}
      onRetrySameRecipe={() => {}}
      onBackToPizzaSelect={() => {}}
      onMissionServeNext={() => {}}
      onMissionSkipOrder={() => {}}
      onMissionStart={() => {}}
      onMissionExitToFree={() => {}}
      onMissionCloseIntro={() => {}}
      onShowRanking={() => {}}
      onReferencePopoverChange={() => {}}
      onDispenseProgress={() => {}}
      onDispenseCommit={() => {}}
      onDoughStretchProgress={() => {}}
      onDoughStretchCommit={() => {}}
      onAddCutLine={() => {}}
      onUndoCutLine={() => {}}
      cutRejectionMessage={null}
      onDoughElementChange={() => {}}
      resolvePhysicalDrop={() => null}
      onPhysicalDrop={() => {}}
    />,
  );
}

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
    const base = createInitialGameState(discoveredDex([...keysBefore(25), "brazilian-calabresa", "aussie"]), owned, 1000);
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
    const base = createInitialGameState(discoveredDex([...keysBefore(25), "brazilian-calabresa", "aussie"]), owned, 1000);
    const s = gameReducer({ ...base, inventory: Object.fromEntries(owned.map((id) => [id, 10])) }, { type: "START_FREE_COOK" });
    expect(hasContext(s)).toBe(false);
  });

  // Contract 2.1 S3: no pre-attempt declaration UI exists in any PREPARE step (the flag is ON under vitest).
  it("no ingredient picker / declaration control or copy in any PREPARE step; the Research context stays", () => {
    let s = researchRound();
    const prepareStates = [s];
    for (const a of [{ type: "CONFIRM_MAKING_STEP" }, { type: "CONFIRM_MAKING_STEP" }, { type: "CONFIRM_MAKING_STEP" }] as GameAction[]) {
      s = gameReducer(s, a);
      prepareStates.push(s);
    }
    for (const st of prepareStates) {
      const r = renderAt(st);
      expect(screen.queryByTestId("research-test-button")).toBeNull();
      expect(screen.queryByTestId("research-test-picker")).toBeNull();
      expect(r.container.textContent ?? "").not.toMatch(/調べる食材|今回調べる|食材調査なし|試作中は変更できません/);
      if (st.phase === "PREPARE") expect(screen.queryByTestId("research-context")).not.toBeNull();
      r.unmount();
    }
  });
});

// Research UX Phase 1 (P1-a / P1-b / P1-c): PREPARE guidance, direct 試作ノート entry, Hint sheet label.
describe("Research UX Phase 1 in PREPARE", () => {
  const lastStockRetry = () => {
    const owned = ladderOwned(25);
    const base = createInitialGameState(discoveredDex([...keysBefore(25), "brazilian-calabresa", "aussie"]), owned, 1000);
    const inv: Record<string, number> = Object.fromEntries(owned.map((id) => [id, 10]));
    for (const id of ["chicken", "mozzarella", "fresh-tomato", "pesto"]) inv[id] = 1;
    let s = gameReducer({ ...base, inventory: inv }, { type: "START_FREE_COOK", researchTargetId: T });
    s = [{ type: "CONFIRM_MAKING_STEP" }, { type: "APPLY_SAUCE", ingredientId: "pesto", x: 50, y: 50 }, { type: "CONFIRM_MAKING_STEP" }, { type: "CONFIRM_MAKING_STEP" },
      { type: "PLACE_TOPPING", ingredientId: "chicken", x: 40, y: 40 }, { type: "START_BAKE" }, { type: "CONFIRM_BAKE", value: 68 }, { type: "CONFIRM_MAKING_STEP" }, { type: "REGISTER_TO_DEX" }].reduce(
      (a, x) => gameReducer(a, x as GameAction), s);
    return gameReducer(s, { type: "RETRY_SAME_RECIPE" });
  };

  it("a valid target shows the fixed ○× guidance and the 試作ノート entry (same text for any target)", () => {
    const s = researchRound();
    expect(s.researchTargetValidAtStart).toBe(true);
    renderAt(s);
    expect(screen.getByTestId("research-guidance").textContent).toBe(RESEARCH_UX_COPY.prepareGuidance);
    expect(screen.getByTestId("research-guidance").textContent).toBe("材料を足して試そう。焼くと使った材料の○×がわかるよ");
    expect(screen.getByTestId("research-notebook-entry").textContent).toBe("📓 試作ノート");
    expect(screen.getByTestId("research-context").textContent).toContain("🔎 研究中 ？？？ピザ");
    // static, no count / recipe / hidden wording
    expect(RESEARCH_UX_COPY.prepareGuidance).not.toMatch(/[0-9０-９]|種類|全部|残り|あと|ペスト|チキン|正解|なし/);
  });

  it("last-stock retry (target not valid at start): no ○× promise, the notebook sentence instead", () => {
    const s = lastStockRetry();
    expect(s.researchTargetId).toBe(T);
    expect(s.researchTargetValidAtStart).toBe(false);
    renderAt(s);
    expect(screen.getByTestId("research-guidance").textContent).toBe("試作ノートを見て、次に試す材料を考えよう");
    expect(screen.getByTestId("research-context").textContent).not.toMatch(/○|×/);
    expect(screen.getByTestId("research-notebook-entry")).toBeTruthy();
  });

  it("targetless FREE has neither guidance nor notebook entry", () => {
    const owned = ladderOwned(25);
    const base = createInitialGameState(discoveredDex([...keysBefore(25), "brazilian-calabresa", "aussie"]), owned, 1000);
    renderAt(gameReducer({ ...base, inventory: Object.fromEntries(owned.map((id) => [id, 10])) }, { type: "START_FREE_COOK" }));
    expect(screen.queryByTestId("research-guidance")).toBeNull();
    expect(screen.queryByTestId("research-notebook-entry")).toBeNull();
  });

  it("a guided (non-FREE) round has neither guidance nor notebook entry", () => {
    const owned = ladderOwned(25);
    const base = createInitialGameState(discoveredDex([...keysBefore(25)]), owned, 1000);
    renderAt(gameReducer(base, { type: "SELECT_RECIPE", recipeId: "margherita" } as GameAction));
    expect(screen.queryByTestId("research-guidance")).toBeNull();
    expect(screen.queryByTestId("research-notebook-entry")).toBeNull();
  });

  it("the entry opens the read-only notebook (labelled, back = もどる) and focus returns to the entry", async () => {
    renderAt(researchRound());
    const entry = screen.getByTestId("research-notebook-entry");
    fireEvent.click(entry);
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("？？？ピザ");
    expect(dialog.textContent).toContain("もどる");
    fireEvent.click(screen.getByRole("button", { name: /もどる/ }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(entry));
  });

  // PR #390 Codex P2: the PREPARE notebook is modal for the keyboard / assistive technology too.
  it("while the notebook is open everything behind it is inert; closing removes the inert and returns focus", async () => {
    renderAt(researchRound());
    const entry = screen.getByTestId("research-notebook-entry");
    const root = document.querySelector(".game-screen")!;
    expect(root.hasAttribute("inert")).toBe(false);
    fireEvent.click(entry);
    const dialog = screen.getByRole("dialog");
    // the cooking screen is inert, the sheet is not inside it
    expect(root.hasAttribute("inert")).toBe(true);
    expect(dialog.closest("[inert]")).toBeNull();
    expect(root.contains(dialog)).toBe(false);
    // every focusable control in the document is either in the sheet or behind an inert ancestor
    const focusables = Array.from(document.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]"));
    expect(focusables.length).toBeGreaterThan(3);
    for (const el of focusables) {
      if (dialog.contains(el)) continue;
      expect(el.closest("[inert]"), `${el.textContent?.slice(0, 12)} must be unreachable`).not.toBeNull();
    }
    // the sheet takes focus on open
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /もどる/ }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(root.hasAttribute("inert")).toBe(false);
    expect(document.querySelectorAll("[inert]").length).toBe(0);
    await waitFor(() => expect(document.activeElement).toBe(entry));
  });

  it("targetless FREE never gets an inert game screen", () => {
    const owned = ladderOwned(25);
    const base = createInitialGameState(discoveredDex([...keysBefore(25), "brazilian-calabresa", "aussie"]), owned, 1000);
    renderAt(gameReducer({ ...base, inventory: Object.fromEntries(owned.map((id) => [id, 10])) }, { type: "START_FREE_COOK" }));
    expect(document.querySelectorAll("[inert]").length).toBe(0);
  });

  it("the Hint sheet of a Research round: no inert game screen from the PREPARE notebook logic", () => {
    renderAt(gameReducer(researchRound(), { type: "SHOW_HINT" }));
    expect(document.querySelector(".game-screen")!.hasAttribute("inert")).toBe(false);
  });

  it("the Hint sheet names the Research Target with the public label only", () => {
    const s = gameReducer(researchRound(), { type: "SHOW_HINT" });
    renderAt(s);
    const band = document.querySelector("[data-hint-research]");
    expect(band?.textContent).toBe("🔎 研究中 ？？？ピザ");
    expect(band?.textContent).not.toMatch(/ペスト|pesto|チキン|chicken|[0-9０-９]/);
  });

  it("the Hint sheet of a targetless FREE round shows no research band", () => {
    const owned = ladderOwned(25);
    const base = createInitialGameState(discoveredDex([...keysBefore(25), "brazilian-calabresa", "aussie"]), owned, 1000);
    const s = gameReducer(gameReducer({ ...base, inventory: Object.fromEntries(owned.map((id) => [id, 10])) }, { type: "START_FREE_COOK" }), { type: "SHOW_HINT" });
    renderAt(s);
    expect(document.querySelector("[data-hint-research]")).toBeNull();
  });
});
