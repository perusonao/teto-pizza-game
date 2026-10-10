import "@testing-library/jest-dom/vitest";
import { useReducer, useState, type Dispatch } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { GameScreen } from "./GameScreen";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "../state/gameReducer";
import { INITIAL_MISSION_STATE } from "../mission/lunchRush";
import { emptySauceMetrics } from "../logic/sauceField";
import { createTrialNotebook, recordAttempt } from "../logic/discovery/trialNotebook";
import { RECIPES } from "../data/recipes";
import { INGREDIENTS } from "../data/ingredients";
import { discoveredDex } from "../state/testSupport/guidedRound";
import {
  cook,
  FAR_ORIGINAL,
  freeRound,
  INCOMPLETE,
  MARGHERITA,
  NOW,
  ORDINARY,
  playFreeRound,
  register,
} from "../state/testSupport/trialNotebookFlow";

/**
 * P3-3b: the RESULT duplicate notice through the real GameScreen + ResultPanel, on states produced by the real reducer
 * (and, for the lifecycle tests, driven by `useReducer(gameReducer)` itself). The notice must read only the record result
 * the reducer wrote at the commit (`lastTrialAttempt`): never the notebook, never a retry count.
 */
afterEach(cleanup);

const NOTICE = ".original-pizza__trial-notice";
const noticeOf = (n: number) => `📓 前にも同じ材料の組み合わせで作ったよ（試作#${n}）`;

function Screen({ state, dispatch }: { state: GameState; dispatch: Dispatch<GameAction> }) {
  return (
    <GameScreen
      state={state}
      mission={INITIAL_MISSION_STATE}
      missionNow={0}
      missionDurationSeconds={180}
      missionBestAtStartOfRun={0}
      activeCategory="cheese"
      selectedIngredientId={null}
      bakeProgress={null}
      referenceModeEnabled={false}
      referencePizza={null}
      isReferencePopoverOpen={false}
      isGlobalOverlayOpen={false}
      sauceMetrics={emptySauceMetrics()}
      sauceShadowScore={{ quantitySimilarity: 0, coverageSimilarity: 0, overall: 0 }}
      isDispensingSauce={false}
      pieceShadowMetrics={[]}
      showDoughShape
      doughShapeComplete={false}
      onGoHome={() => {}}
      onBeginPrepare={() => {}}
      onResetPizza={() => {}}
      onUndoPlacement={() => {}}
      onConfirmMakingStep={() => {}}
      onStartBake={() => {}}
      onShowHint={() => {}}
      onChangeCategory={() => {}}
      onSelectIngredient={() => {}}
      onTapPizza={() => {}}
      onBakeTick={() => {}}
      onConfirmBake={() => {}}
      onRetrySameRecipe={() => dispatch({ type: "RETRY_SAME_RECIPE", now: NOW })}
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
      onDoughElementChange={() => {}}
      resolvePhysicalDrop={() => null}
      onPhysicalDrop={() => {}}
    />
  );
}

/** Renders a state as-is (a reducer-produced RESULT / DISCOVERED screen). */
function renderState(state: GameState) {
  return render(<Screen state={state} dispatch={() => {}} />);
}

/** A live harness: GameScreen on `useReducer(gameReducer)`, dispatch exposed. */
function live(initial: GameState) {
  const out = {} as { dispatch: Dispatch<GameAction>; state: GameState; rerender: () => void };
  const report = (state: GameState, dispatch: Dispatch<GameAction>, rerender: () => void) => {
    out.state = state;
    out.dispatch = dispatch;
    out.rerender = rerender;
  };
  function Harness() {
    const [state, dispatch] = useReducer(gameReducer, initial);
    const [, setTick] = useState(0);
    report(state, dispatch, () => setTick((t) => t + 1)); // an unrelated re-render, no reducer action
    return <Screen state={state} dispatch={dispatch} />;
  }
  render(<Harness />);
  return { out };
}

const notice = () => document.querySelector(NOTICE);
const panelText = () => document.querySelector(".result-panel")?.textContent ?? "";

describe("the duplicate notice on the ORIGINAL RESULT", () => {
  it("1. the first attempt (NEW) shows no notice", () => {
    renderState(playFreeRound(freeRound(), ORDINARY));
    expect(document.querySelector(".result-panel--original")).not.toBeNull();
    expect(notice()).toBeNull();
  });

  it("2/3/4. the second identical attempt shows the notice with the stable #n; the third keeps the same #n", () => {
    const second = playFreeRound(playFreeRound(freeRound(), ORDINARY), ORDINARY);
    const { unmount } = renderState(second);
    expect(notice()).toHaveTextContent(noticeOf(1));
    unmount();
    const third = playFreeRound(second, ORDINARY);
    renderState(third);
    expect(notice()).toHaveTextContent(noticeOf(1));
    expect(document.querySelectorAll(NOTICE)).toHaveLength(1);
  });

  it("5. the retry count is never shown (exact copy; no ×n, no count digits beyond #n)", () => {
    let s = freeRound();
    for (let i = 0; i < 4; i += 1) s = playFreeRound(s, ORDINARY); // retryCount 3
    renderState(s);
    const text = notice()!.textContent!;
    expect(text).toBe(noticeOf(1));
    expect(text).not.toMatch(/×|回|retry|3/);
    expect(panelText()).not.toContain("×");
  });

  it("6. a different combination shows no notice, and a later different attempt is a NEW number", () => {
    const s = playFreeRound(playFreeRound(freeRound(), ORDINARY), FAR_ORIGINAL);
    renderState(s);
    expect(s.lastTrialAttempt).toEqual({ kind: "NEW", number: 2 });
    expect(notice()).toBeNull();
  });

  it("7. the notice is stable across re-renders and adds no record (live reducer)", () => {
    const base = playFreeRound(freeRound(), ORDINARY);
    const at = cook(gameReducer(base, { type: "START_FREE_COOK", now: NOW }), ORDINARY);
    const { out } = live(at);
    act(() => out.dispatch({ type: "REGISTER_TO_DEX" }));
    expect(notice()).toHaveTextContent(noticeOf(1));
    const committed = out.state.trialNotebook;
    const html = document.querySelector(".result-panel")!.innerHTML;
    for (let i = 0; i < 5; i += 1) act(() => out.rerender());
    act(() => out.dispatch({ type: "REGISTER_TO_DEX" }));
    expect(out.state.trialNotebook).toBe(committed);
    expect(out.state.lastTrialAttempt).toEqual({ kind: "DUPLICATE", number: 1 });
    expect(document.querySelector(".result-panel")!.innerHTML).toBe(html);
    expect(document.querySelectorAll(NOTICE)).toHaveLength(1);
  });

  it("7b. re-rendering the same state leaves the DOM byte-identical", () => {
    const s = playFreeRound(playFreeRound(freeRound(), ORDINARY), ORDINARY);
    const { container, rerender } = renderState(s);
    const first = container.innerHTML;
    for (let i = 0; i < 4; i += 1) rerender(<Screen state={s} dispatch={() => {}} />);
    expect(container.innerHTML).toBe(first);
  });

  it("8. HOME -> FREE -> the same attempt again shows the notice", () => {
    const home = gameReducer(playFreeRound(freeRound(), ORDINARY), { type: "PLAY_AGAIN" });
    renderState(playFreeRound(home, ORDINARY));
    expect(notice()).toHaveTextContent(noticeOf(1));
  });

  it("8b. a fresh round carries no stale notice (the record result is reset)", () => {
    const second = playFreeRound(playFreeRound(freeRound(), ORDINARY), ORDINARY);
    expect(second.lastTrialAttempt?.kind).toBe("DUPLICATE");
    const next = gameReducer(second, { type: "START_FREE_COOK", now: NOW });
    renderState(next);
    expect(notice()).toBeNull();
    // a different, non-recorded result after a duplicate shows nothing either
    renderState(playFreeRound(second, INCOMPLETE));
    expect(document.querySelectorAll(NOTICE)).toHaveLength(0);
  });
});

describe("no notice outside an eligible ORIGINAL result", () => {
  const seeded = () => playFreeRound(playFreeRound(freeRound(), ORDINARY), ORDINARY); // ORDINARY is now a duplicate

  it("9. a guided result shows none", () => {
    let s = gameReducer(seeded(), { type: "SELECT_RECIPE", recipeId: "margherita", now: NOW });
    expect(s.freeCook).toBe(false);
    s = register(cook(s, MARGHERITA));
    renderState(s);
    expect(notice()).toBeNull();
  });

  it("10. a Lunch Rush result shows none", () => {
    let s = gameReducer(seeded(), { type: "MISSION_RESET_ORDER" });
    s = cook(gameReducer(s, { type: "BEGIN_PREPARE", now: NOW }), MARGHERITA);
    renderState(s);
    expect(notice()).toBeNull();
    expect(panelText()).not.toContain("前にも同じ材料");
  });

  it("11. a Dinner result shows none", () => {
    const base = createInitialGameState(
      discoveredDex(["margherita", "bismarck", "breakfast-pizza", "funghi", "marinara"]),
      INGREDIENTS.map((i) => i.id),
      500,
      { egg: 30, bacon: 30, mushroom: 30 },
      [],
      INGREDIENTS.filter((i) => i.unlockCondition).map((i) => i.id),
      {},
    );
    let s = { ...base, trialNotebook: seeded().trialNotebook } as GameState;
    s = gameReducer(s, { type: "DINNER_START", missionId: "dm-a", now: NOW, durationMs: 600_000, minimumStars: 3 });
    s = { ...cook(s, ORDINARY), lastTrialAttempt: { kind: "DUPLICATE", number: 1 } }; // even a stale DUPLICATE: Dinner is not free cook
    expect(s.freeCook).toBe(false);
    renderState(s);
    expect(notice()).toBeNull();
  });

  it("12. INCOMPLETE_MATCH reads like any ORIGINAL: neutral lead, first attempt no notice (but it is recorded)", () => {
    const s = playFreeRound(seeded(), INCOMPLETE);
    expect(s.lastDiscovery?.kind).toBe("INCOMPLETE_MATCH");
    renderState(s);
    expect(document.querySelector(".original-pizza__lead")).toHaveTextContent("まだ新しいレシピは見つかっていません");
    expect(notice()).toBeNull();
  });

  it("13. a known pizza shows none", () => {
    const s = playFreeRound(seeded(), MARGHERITA);
    expect(s.score).not.toBeNull();
    renderState(s);
    expect(notice()).toBeNull();
  });

  it("14. a FAILED round shows none", () => {
    const s = playFreeRound(seeded(), ORDINARY, 5);
    expect(s.completion?.status).toBe("FAILED");
    renderState(s);
    expect(notice()).toBeNull();
  });

  it("15. a NEW_DISCOVERY shows none", () => {
    const s = playFreeRound(
      { ...freeRound(discoveredDex(["bismarck", "breakfast-pizza"])), trialNotebook: seeded().trialNotebook } as GameState,
      MARGHERITA,
    );
    expect(s.score).not.toBeNull();
    renderState(s);
    expect(notice()).toBeNull();
    expect(document.querySelector(".discovered-banner--new-pizza")).not.toBeNull();
  });

  it("guards in the panel itself: a DUPLICATE record result on a non-free or scored state never renders", () => {
    const s = seeded();
    renderState({ ...s, freeCook: false });
    expect(notice()).toBeNull();
  });
});

describe("AMBIGUOUS, REVIVE and eviction", () => {
  it("16. AMBIGUOUS follows the ordinary Original authority: the same lead, the same notice, nothing extra", () => {
    const ordinary = playFreeRound(playFreeRound(freeRound(), ORDINARY), ORDINARY);
    const a = renderState(ordinary);
    const ordinaryLead = a.container.querySelector(".original-pizza__lead")!.textContent;
    const ordinaryNotice = notice()!.textContent;
    a.unmount();
    const ambiguous: GameState = { ...ordinary, lastDiscovery: { kind: "AMBIGUOUS", targetIds: ["x", "y"] } };
    const b = renderState(ambiguous);
    expect(b.container.querySelector(".original-pizza__lead")!.textContent).toBe(ordinaryLead);
    expect(notice()!.textContent).toBe(ordinaryNotice);
    expect(notice()).toHaveTextContent(noticeOf(1));
    expect(document.querySelectorAll(NOTICE)).toHaveLength(1);
  });

  it("17. REVIVE keeps the original stable #n on screen", () => {
    const first = playFreeRound(freeRound(), ORDINARY); // #1
    let nb = first.trialNotebook;
    for (let i = 0; i < 60; i += 1) nb = recordAttempt(nb, { fingerprint: `fp1:[["tomato-sauce"],["tomato-sauce","x${String(i).padStart(3, "0")}"]]`, feedback: null }).state;
    expect(nb.display.some((r) => r.number === 1)).toBe(false); // the detail row left the display
    const revived = playFreeRound({ ...first, trialNotebook: nb }, ORDINARY);
    expect(revived.lastTrialAttempt).toEqual({ kind: "DUPLICATE", number: 1 });
    renderState(revived);
    expect(notice()).toHaveTextContent(noticeOf(1));
  });

  it("18. after the identity was evicted, the same combination is a NEW attempt: no notice", () => {
    const first = playFreeRound({ ...freeRound(), trialNotebook: createTrialNotebook({ display: 2, identity: 3 }) } as GameState, ORDINARY);
    expect(first.lastTrialAttempt).toEqual({ kind: "NEW", number: 1 });
    let nb = first.trialNotebook;
    for (let i = 0; i < 3; i += 1) nb = recordAttempt(nb, { fingerprint: `fp1:[["tomato-sauce"],["tomato-sauce","y${i}"]]`, feedback: null }).state;
    const again = playFreeRound({ ...first, trialNotebook: nb }, ORDINARY);
    expect(again.lastTrialAttempt?.kind).toBe("NEW");
    renderState(again);
    expect(notice()).toBeNull();
  });

  it("the displayed #n is the record result's number, not a re-lookup: a notebook changed after the commit does not change it", () => {
    const s = playFreeRound(playFreeRound(freeRound(), ORDINARY), ORDINARY);
    const tampered: GameState = { ...s, trialNotebook: createTrialNotebook() }; // empty notebook, same record result
    renderState(tampered);
    expect(notice()).toHaveTextContent(noticeOf(1));
    cleanup();
    const other: GameState = { ...s, lastTrialAttempt: { kind: "DUPLICATE", number: 7 } };
    renderState(other);
    expect(notice()).toHaveTextContent(noticeOf(7));
  });
});

describe("accessibility and privacy", () => {
  it("19. the notice is a static paragraph: no live region of its own, none around it, and the live-region count is unchanged", () => {
    const withNotice = renderState(playFreeRound(playFreeRound(freeRound(), ORDINARY), ORDINARY));
    const n = notice()!;
    expect(n.tagName).toBe("P");
    expect(n.hasAttribute("aria-live")).toBe(false);
    expect(n.hasAttribute("role")).toBe(false);
    expect(n.closest("[aria-live]")).toBeNull();
    const liveWith = document.querySelectorAll("[aria-live]").length;
    withNotice.unmount();
    renderState(playFreeRound(freeRound(), ORDINARY));
    expect(document.querySelectorAll("[aria-live]").length).toBe(liveWith);
  });

  it("the meaning is in the text (📓 + words), not in a colour or an icon alone", () => {
    renderState(playFreeRound(playFreeRound(freeRound(), ORDINARY), ORDINARY));
    expect(notice()!.textContent).toMatch(/前にも同じ材料の組み合わせで作ったよ（試作#1）/);
  });

  it("20. the notice and the whole ORIGINAL card expose no recipe, distance, candidate, retry or hint information", () => {
    let s = freeRound();
    for (const pizza of [ORDINARY, FAR_ORIGINAL, ORDINARY, FAR_ORIGINAL, ORDINARY]) s = playFreeRound(s, pizza);
    renderState(s);
    const html = document.querySelector(".result-panel")!.outerHTML;
    for (const r of RECIPES) {
      expect(html, `recipe name ${r.nameJa}`).not.toContain(r.nameJa);
      expect(html, `recipe id ${r.id}`).not.toContain(`"${r.id}"`);
    }
    for (const word of ["distance", "candidate", "collision", "shipped:", "retryCount", "×", "target", "h5:", "cls:"]) expect(html, word).not.toContain(word);
    expect(notice()!.textContent).toBe(noticeOf(1));
  });

  it("the P2 line is unchanged by the notice (same text and live region with and without a duplicate)", () => {
    const first = playFreeRound(freeRound(), ORDINARY);
    const second = playFreeRound(first, ORDINARY);
    const a = renderState(first);
    const p2a = document.querySelector(".original-pizza__lead")!.outerHTML;
    a.unmount();
    renderState(second);
    expect(document.querySelector(".original-pizza__lead")!.outerHTML).toBe(p2a);
    // order: lead (#346 S0: no near/far row), then the notice, then the note
    const html = document.querySelector(".result-panel")!.innerHTML;
    expect(html.indexOf("original-pizza__lead")).toBeLessThan(html.indexOf("original-pizza__trial-notice"));
    expect(html.indexOf("original-pizza__trial-notice")).toBeLessThan(html.indexOf("original-pizza__note"));
  });
});
