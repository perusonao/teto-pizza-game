import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { DexOverlay } from "./DexOverlay";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { discoveredDex } from "../state/testSupport/guidedRound";

/** Research 2.0 Phase 1: the Dex's research cards carry the stable cohort label and nothing hidden (INV-B7). */

afterEach(cleanup);

const owned = (step: number) => [
  ...STARTER_INGREDIENT_IDS,
  ...DISCOVERY_LADDER.steps.filter((s) => s.step <= step).flatMap((s) => s.ingredientIds),
];
const keysBefore = (step: number) => ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId)];

function renderDex(step: number, extra: readonly string[] = []) {
  const ownedIds = owned(step);
  const { container } = render(
    <DexOverlay
      dex={discoveredDex([...keysBefore(step), ...extra])}
      newlyDiscoveredId={null}
      newBestRecipeId={null}
      onClose={() => {}}
      ownedIngredientIds={ownedIds}
      inventory={Object.fromEntries(ownedIds.map((id) => [id, 10]))}
      onResearch={() => {}}
    />,
  );
  const section = container.querySelector<HTMLElement>(".dex-overlay__research")!;
  const cards = Array.from(section.querySelectorAll(".dex-research-card"));
  return {
    section,
    titles: cards.map((c) => c.querySelector("h3")?.textContent),
    buttons: cards.map((c) => c.querySelector("button")?.getAttribute("aria-label")),
  };
}

describe("Dex research cards: stable cohort labels", () => {
  it("step 12: A / B / C (たまねぎ), in letter order", () => {
    const { titles, buttons } = renderDex(12);
    expect(titles).toEqual(["？？？ピザ A（たまねぎ）", "？？？ピザ B（たまねぎ）", "？？？ピザ C（たまねぎ）"]);
    expect(buttons).toEqual(["？？？ピザ A（たまねぎ）を研究する", "？？？ピザ B（たまねぎ）を研究する", "？？？ピザ C（たまねぎ）を研究する"]);
  });

  it("step 12 with B discovered: the cards are A and C, never A and B", () => {
    expect(renderDex(12, ["brazilian-calabresa"]).titles).toEqual(["？？？ピザ A（たまねぎ）", "？？？ピザ C（たまねぎ）"]);
  });

  it("step 28 with A discovered: the remaining card is B", () => {
    const settled = ["brazilian-calabresa", "aussie"];
    expect(renderDex(28, [...settled, "ratatouille-pizza"]).titles).toEqual(["？？？ピザ B（ズッキーニ）"]);
    expect(renderDex(28, settled).titles).toEqual(["？？？ピザ A（ズッキーニ）", "？？？ピザ B（ズッキーニ）"]);
  });

  it("DOM / aria scan: no recipe id or name, No.xx, cohort size, hash or circled number in the research section", () => {
    for (const [step, extra] of [[12, []], [12, ["brazilian-calabresa"]], [28, ["brazilian-calabresa", "aussie"]]] as const) {
      const { section } = renderDex(step, extra);
      const html = section.outerHTML;
      for (const r of RECIPES) {
        expect(html).not.toContain(r.id);
        expect(html).not.toContain(r.nameJa);
      }
      expect(html).not.toMatch(/No\.\d|[①-⑳㉑-㊿]|data-(?:cohort|hash|slot|recipe)|cohort|hash/i);
      const labels = [...section.querySelectorAll("[aria-label]")].map((e) => e.getAttribute("aria-label")!);
      expect(labels.length).toBeGreaterThan(0);
      for (const label of labels) expect(label).toMatch(/^？？？ピザ( [A-Z]+)?（[^（）]+）を研究する$/);
    }
  });
});
