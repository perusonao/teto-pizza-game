import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { INGREDIENTS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import type { DiscoveryOutcome } from "../logic/discovery/matcher";
import { NEAR_MISS_COPY, NEAR_MISS_FAR_GENERIC_COPY, type ResultNearMissLine } from "../state/resultNearMiss";
import { ResultPanel } from "./ResultPanel";

/**
 * Original Pizza Recovery P2: the automated privacy gate for the ORIGINAL result card. The DOM is
 * compared as raw HTML (attributes, aria, data-*, class names, titles) so a distinction that only
 * exists in an attribute cannot slip through.
 */
const HIDDEN_RECIPE = RECIPES.find((r) => r.id === "quattro-formaggi")!;
const HIDDEN_TARGET_IDS = ["shipped:quattro-formaggi", "shipped:hidden-twin", "collision-target-7"];

const ORDINARY: DiscoveryOutcome = { kind: "ORIGINAL", blockedTargetIds: [] };
const AMBIGUOUS: DiscoveryOutcome = { kind: "AMBIGUOUS", targetIds: HIDDEN_TARGET_IDS };
const INCOMPLETE: DiscoveryOutcome = { kind: "INCOMPLETE_MATCH", recipeId: HIDDEN_RECIPE.id, targetId: HIDDEN_TARGET_IDS[0] };

function html(discovery: DiscoveryOutcome, nearMiss: ResultNearMissLine | null = null): string {
  cleanup();
  const { container } = render(
    <ResultPanel
      completion={{ status: "PASS" }}
      score={null}
      bakeState="perfect"
      sauceScore={null}
      headingJa="x"
      recipeNameJa="ORIGINAL-ROUND-SENTINEL"
      justDiscovered={false}
      justGotNewBest={false}
      pitzCredit={null}
      freeCook
      discovery={discovery}
      usedIngredientIds={["tomato-sauce", "mozzarella"]}
      onRetrySameRecipe={vi.fn()}
      onBackToPizzaSelect={vi.fn()}
      onShowHint={vi.fn()}
      nearMiss={nearMiss}
    />,
  );
  return container.innerHTML;
}

afterEach(() => cleanup());

const LINES: (ResultNearMissLine | null)[] = [
  null,
  ...(["ADD_ONE", "REMOVE_ONE", "SAUCE_ONLY", "CLOSE"] as const).map((kind) => ({ kind, textJa: NEAR_MISS_COPY[kind] })),
  { kind: "FAR" as const, textJa: NEAR_MISS_COPY.FAR_KEY_UNUSED },
  { kind: "FAR" as const, textJa: NEAR_MISS_FAR_GENERIC_COPY },
];

describe("P2-A: AMBIGUOUS is distinguished internally but leaks nothing into the DOM", () => {
  it.each(LINES.map((l, i) => [i, l] as const))("AMBIGUOUS renders byte-identically to an ordinary original (near-miss #%i)", (_i, line) => {
    expect(html(AMBIGUOUS, line)).toBe(html(ORDINARY, line));
  });

  it("no candidate id, count or list reaches the DOM", () => {
    const dom = html(AMBIGUOUS);
    for (const id of HIDDEN_TARGET_IDS) expect(dom).not.toContain(id);
    expect(dom).not.toContain("targetIds");
    expect(dom).not.toContain("AMBIGUOUS");
    expect(dom).not.toMatch(/data-(kind|outcome|ambiguous|candidate|target)/i);
  });
});

describe("lead / action split: a FAR ORIGINAL says the next action once", () => {
  it.each([
    ["ordinary", ORDINARY],
    ["ambiguous", AMBIGUOUS],
  ] as const)("%s + generic FAR: the lead only (#346 S0: no near/far line on a Recipe Discovery ORIGINAL)", (_name, outcome) => {
    const dom = html(outcome, { kind: "FAR", textJa: NEAR_MISS_FAR_GENERIC_COPY });
    const text = document.body.textContent ?? "";
    expect(text).toContain("まだ新しいレシピは見つかっていません");
    expect(text).not.toContain(NEAR_MISS_FAR_GENERIC_COPY);
    expect(dom).not.toContain("別の組み合わせ");
  });

  it.each(LINES.map((l, i) => [i, l] as const))("near-miss #%i: 「試してみよう」 appears at most once", (_i, line) => {
    html(ORDINARY, line);
    expect((document.body.textContent ?? "").split("試してみよう").length - 1).toBeLessThanOrEqual(1);
  });
});

describe("privacy gate: no undiscovered-recipe information in any ORIGINAL card variant", () => {
  const variants: [string, DiscoveryOutcome][] = [
    ["ordinary", ORDINARY],
    ["ambiguous", AMBIGUOUS],
    ["incomplete match", INCOMPLETE],
  ];
  const hiddenStrings = [
    HIDDEN_RECIPE.id,
    HIDDEN_RECIPE.nameJa,
    ...HIDDEN_TARGET_IDS,
    // ingredients that only the hidden recipe would need (the player did not use them)
    ...INGREDIENTS.filter((i) => ["gorgonzola", "parmigiano"].includes(i.id)).flatMap((i) => [i.id, i.nameJa]),
    "distance",
    "blockedTargetIds",
  ];

  it.each(variants.flatMap(([name, outcome]) => LINES.map((line, i) => [name, i, outcome, line] as const)))(
    "%s / near-miss #%i",
    (_name, _i, outcome, line) => {
      const dom = html(outcome, line);
      for (const s of hiddenStrings) expect(dom, s).not.toContain(s);
      // the sentinel proves the card never reads the selected recipe's name either
      expect(dom).not.toContain("ORIGINAL-ROUND-SENTINEL");
    },
  );

  it("the only ingredients listed are the player's own (list items, not substrings)", () => {
    html(AMBIGUOUS, LINES[1]);
    const items = [...document.querySelectorAll(".original-pizza__ingredient")].map((li) => li.textContent?.trim());
    expect(items).toHaveLength(2);
    for (const id of ["gorgonzola", "parmigiano"]) {
      const name = INGREDIENTS.find((i) => i.id === id)!.nameJa;
      expect(items.some((t) => t?.includes(name))).toBe(false);
    }
  });
});
