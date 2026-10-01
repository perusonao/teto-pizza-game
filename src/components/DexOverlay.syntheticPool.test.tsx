import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { RECIPES } from "../data/recipes";
import { discoverableHintCandidates } from "../logic/discovery/hintTarget";
import { discoverIds, walkInputs } from "../logic/testSupport/discoveryWalk";
import {
  SYNTH_BRANCH_A_ID,
  SYNTH_BRANCH_B_ID,
  withSyntheticBranch,
} from "../logic/testSupport/syntheticPopulation";
import { DexOverlay } from "./DexOverlay";

/**
 * Discovery 3.0 PR-4a -- Dex 🎨 cards with a pool of 2 (synthetic population; production Dex unchanged).
 *
 * OWNER DECISION PENDING (not decided here): whether the 🎨 card count may reveal how many recipes are
 * discoverable right now. These tests CHARACTERISE what the current architecture does -- one card per
 * undiscovered recipe, each CTA bound to its own recipe -- they do not declare "2 cards" the correct UI.
 * What they DO pin as a privacy invariant (independent of the decision): no card ever carries a recipe
 * identity (id / name / ingredients / description) in its DOM.
 */

afterEach(cleanup);

const POP = withSyntheticBranch(RECIPES);
const FIRST_12 = ["margherita", "bismarck", "breakfast-pizza", "funghi", "melanzane-pizza", "parmigiana-pizza", "pepperoni", "salsiccia", "meat-lovers", "bambino", "hawaiian", "capricciosa"];

function renderPool() {
  const dex = discoverIds([], FIRST_12);
  const inputs = walkInputs(dex, POP);
  const onShowHint = vi.fn();
  const { container } = render(
    <DexOverlay
      dex={inputs.dex}
      newlyDiscoveredId={null}
      newBestRecipeId={null}
      onClose={() => undefined}
      ownedIngredientIds={inputs.ownedIngredientIds}
      unlockedForShopIngredientIds={inputs.unlockedForShopIngredientIds}
      inventory={inputs.inventory}
      onShowHint={onShowHint}
      recipes={POP}
    />,
  );
  return { container, onShowHint, inputs };
}

describe("Dex with a synthetic pool of 2", () => {
  it("renders the whole synthetic population (N/26) through the `recipes` seam", () => {
    const { container } = renderPool();
    expect(container.querySelector(".dex-overlay__progress-count")?.textContent).toContain("12 / 26");
  });

  it("CHARACTERISATION: one 🎨 card per DISCOVERABLE recipe (card count == pool size); each CTA hands over its own, distinct recipe", () => {
    const { container, onShowHint, inputs } = renderPool();
    const pool = discoverableHintCandidates(inputs, POP).map((r) => r.id);
    expect(pool.sort()).toEqual([SYNTH_BRANCH_A_ID, SYNTH_BRANCH_B_ID].sort());
    const cards = [...container.querySelectorAll<HTMLElement>('[data-dex-state="DISCOVERABLE"]')];
    expect(cards).toHaveLength(2);
    for (const card of cards) fireEvent.click(card.querySelector("button")!);
    expect(onShowHint.mock.calls.map((c) => c[0]).sort()).toEqual(pool.sort());
  });

  it("PRIVACY INVARIANT: no undiscovered card shows a recipe id, name, description or ingredient; only the fixed tag", () => {
    const { container } = renderPool();
    const cards = [...container.querySelectorAll<HTMLElement>('[data-dex-state="DISCOVERABLE"]')];
    for (const card of cards) {
      expect(card.outerHTML).not.toContain(SYNTH_BRANCH_B_ID);
      expect(card.outerHTML).not.toContain(SYNTH_BRANCH_A_ID);
      expect(card.textContent).toMatch(/？？？/);
      expect(card.textContent).toContain("今の材料で作れるかも");
      expect(card.querySelector(".dex-card__ingredient")).toBeNull();
    }
    // The two 🎨 cards are indistinguishable except for the slot number (fixed chapter position).
    const normalised = cards.map((c) => c.outerHTML.replace(/No\.\d+/, "No.NN"));
    expect(new Set(normalised).size).toBe(1);
  });
});
