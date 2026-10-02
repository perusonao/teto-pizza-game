import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ResultPanel } from "../components/ResultPanel";
import { buildIdealSauceFixture } from "../data/referencePizza";
import { RECIPES } from "../data/recipes";
import { notebookView } from "../logic/discovery/trialNotebook";
import { executionAdviceJa } from "./executionAdvice";
import type { GameState } from "./gameReducer";
import { NEAR_MISS_FAR_GENERIC_COPY, resultNearMiss } from "./resultNearMiss";
import { cook, freeRound, INCOMPLETE, NOW, pieces, playFreeRound, register, type Pizza } from "./testSupport/trialNotebookFlow";
import { gameReducer } from "./gameReducer";

/**
 * Discovery 3.0 PR-1 (OD-D3-20 / OD-D3-23): the oracle neutralization, on states produced by the real reducer (Dex 3 save: funghi
 * = tomato sauce + mozzarella + mushroom is the one DISCOVERABLE recipe).
 *
 * The three paths S1 reproduced in the browser -- the lead wording, the presence of the near/far row, the Trial Notebook record
 * (the 「試作#n」 notice on a retry) -- must not separate "the combination is a recipe" from "it is not", and the execution advice
 * must depend on the player's sauce only.
 */
afterEach(cleanup);

const THIN = buildIdealSauceFixture().slice(0, 1);
/** exact funghi, sauce too thin: the INCOMPLETE_MATCH the old line gave away. */
const EXACT_THIN: Pizza = { ...INCOMPLETE };
/** a different combination that also uses the key ingredient (mushroom) and is far from funghi, same thin sauce. */
const OTHER_THIN: Pizza = {
  sauce: "tomato-sauce",
  sauceDeposits: THIN,
  cheese: [],
  toppings: [...pieces("mushroom", 1), ...pieces("basil", 1, 1), ...pieces("egg", 2, 2), ...pieces("bacon", 2, 4)],
};
const EXACT_GOOD: Pizza = { ...INCOMPLETE, sauceDeposits: undefined };
const OTHER_GOOD: Pizza = { ...OTHER_THIN, sauceDeposits: undefined };

const resultOf = (pizza: Pizza, from: GameState = freeRound()) => playFreeRound(from, pizza);

function panel(state: GameState, over: { discoveryOverride?: GameState["lastDiscovery"] } = {}): HTMLElement {
  cleanup();
  const { container } = render(
    <ResultPanel
      completion={state.completion}
      score={state.score}
      bakeState={state.bakeState}
      sauceScore={null}
      headingJa="x"
      recipeNameJa="ROUND-SENTINEL"
      justDiscovered={false}
      justGotNewBest={false}
      pitzCredit={null}
      freeCook
      discovery={over.discoveryOverride === undefined ? state.lastDiscovery : over.discoveryOverride}
      usedIngredientIds={[]}
      onRetrySameRecipe={vi.fn()}
      onBackToPizzaSelect={vi.fn()}
      onShowHint={vi.fn()}
      nearMiss={resultNearMiss(state)}
      executionAdviceJa={executionAdviceJa(state.pizza)}
      trialNoticeNumber={state.lastTrialAttempt?.kind === "DUPLICATE" ? state.lastTrialAttempt.number : null}
    />,
  );
  return container;
}

describe("the setup really has the situation S1 reproduced", () => {
  it("exact + thin sauce is an INCOMPLETE_MATCH; the other combination is an ordinary ORIGINAL", () => {
    expect(resultOf(EXACT_THIN).lastDiscovery?.kind).toBe("INCOMPLETE_MATCH");
    expect(resultOf(OTHER_THIN).lastDiscovery?.kind).toBe("ORIGINAL");
    expect(resultOf(EXACT_GOOD).lastDiscovery?.kind).toBe("NEW_DISCOVERY");
  });
});

describe("path 1: the lead wording", () => {
  it("an INCOMPLETE_MATCH and an ordinary ORIGINAL show the same lead", () => {
    const lead = (s: GameState) => panel(s).querySelector(".original-pizza__lead")!.textContent;
    expect(lead(resultOf(EXACT_THIN))).toBe(lead(resultOf(OTHER_THIN)));
    expect(lead(resultOf(EXACT_THIN))).not.toMatch(/あと少し/);
  });
});

describe("path 2: the neutral Discovery row", () => {
  it("an INCOMPLETE_MATCH gets the neutral generic row, exactly like any other original", () => {
    const state = resultOf(EXACT_THIN);
    expect(resultNearMiss(state)).toEqual({ kind: "NEUTRAL", textJa: NEAR_MISS_FAR_GENERIC_COPY });
    expect(panel(state).querySelector(".result-near-miss__text")).toHaveTextContent(NEAR_MISS_FAR_GENERIC_COPY);
    expect(resultNearMiss(resultOf(OTHER_THIN))).toEqual(resultNearMiss(resultOf(EXACT_THIN)));
  });

  it("the row does not depend on the pool: an empty pool gives the very same row", () => {
    const state = resultOf(EXACT_THIN);
    const noPool = { ...state, ownedIngredientIds: [...state.ownedIngredientIds].filter((id) => id !== "mushroom") };
    expect(resultNearMiss(noPool)).toEqual(resultNearMiss(state));
    expect(resultNearMiss({ ...resultOf(OTHER_THIN), ownedIngredientIds: noPool.ownedIngredientIds })).toEqual(resultNearMiss(state));
  });
});

describe("path 3: the Trial Notebook", () => {
  it("an INCOMPLETE_MATCH is recorded; the same combination again is a DUPLICATE of #1, like any original", () => {
    const first = resultOf(EXACT_THIN);
    expect(first.lastTrialAttempt).toEqual({ kind: "NEW", number: 1 });
    const second = resultOf(EXACT_THIN, first);
    expect(second.lastTrialAttempt).toEqual({ kind: "DUPLICATE", number: 1 });
    const other = resultOf(OTHER_THIN);
    expect(other.lastTrialAttempt).toEqual({ kind: "NEW", number: 1 });
    expect(resultOf(OTHER_THIN, other).lastTrialAttempt).toEqual({ kind: "DUPLICATE", number: 1 });
    expect(panel(second).querySelector(".original-pizza__trial-notice")).toHaveTextContent("試作#1");
  });

  it("stores only the player's combination and the line shown -- never a recipe, a target, a distance or 'it was right'", () => {
    const state = resultOf(EXACT_THIN);
    const rows = notebookView(state.trialNotebook);
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]).sort()).toEqual(["combination", "feedback", "number", "retryCount"]);
    expect(rows[0].feedback).toBeNull();
    const text = JSON.stringify(rows);
    for (const recipe of RECIPES) expect(text).not.toContain(recipe.id);
    expect(text).not.toMatch(/INCOMPLETE|MATCH|distance|あと少し|正解|correct/i);
  });

  it("a good-quality correct combination is still a discovery and is not recorded as an attempt (unchanged)", () => {
    const state = resultOf(EXACT_GOOD);
    expect(state.lastDiscovery?.kind).toBe("NEW_DISCOVERY");
    expect(state.lastTrialAttempt).toBeNull();
  });
});

describe("the whole card: no DOM difference that depends on whether the combination is a recipe", () => {
  const strip = (el: HTMLElement) => el.innerHTML;

  it("INCOMPLETE_MATCH renders byte-identically to an ordinary original with the same near/far row, advice and notice", () => {
    const state = resultOf(EXACT_THIN);
    expect(strip(panel(state, { discoveryOverride: { kind: "ORIGINAL", blockedTargetIds: [] } }))).toBe(strip(panel(state)));
  });

  it("the exact-but-thin card and the other-but-thin card differ in nothing a recipe check could use", () => {
    expect(strip(panel(resultOf(EXACT_THIN)))).toBe(strip(panel(resultOf(OTHER_THIN))));
  });

  it("and the retry card likewise (both show the duplicate notice)", () => {
    const a = resultOf(EXACT_THIN, resultOf(EXACT_THIN));
    const b = resultOf(OTHER_THIN, resultOf(OTHER_THIN));
    expect(strip(panel(a))).toBe(strip(panel(b)));
  });
});

describe("execution advice", () => {
  it("shows for a thin sauce whatever the composition, and for no good sauce", () => {
    const thinAdvice = (s: GameState) => panel(s).querySelector(".original-pizza__advice")?.textContent ?? null;
    expect(thinAdvice(resultOf(EXACT_THIN))).toBe(thinAdvice(resultOf(OTHER_THIN)));
    expect(thinAdvice(resultOf(EXACT_THIN))).not.toBeNull();
    expect(panel(resultOf(OTHER_GOOD)).querySelector(".original-pizza__advice")).toBeNull();
  });

  it("is a static line (no live region)", () => {
    const line = panel(resultOf(EXACT_THIN)).querySelector(".original-pizza__advice")!;
    expect(line.hasAttribute("aria-live")).toBe(false);
    expect(line.closest("[aria-live]")).toBeNull();
  });

  it("never changes the discovery outcome: the same pizzas resolve exactly as before", () => {
    // Free-cook resolution is untouched: exact + thin is INCOMPLETE (nothing registered), exact + good discovers.
    const incomplete = resultOf(EXACT_THIN);
    expect(incomplete.lastDiscovery?.kind).toBe("INCOMPLETE_MATCH");
    expect(incomplete.dex).toEqual(freeRound().dex);
    const good = register(cook(gameReducer(freeRound(), { type: "START_FREE_COOK", now: NOW }), EXACT_GOOD));
    expect(good.lastDiscovery?.kind).toBe("NEW_DISCOVERY");
  });
});
