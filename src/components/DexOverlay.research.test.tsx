import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { DexOverlay } from "./DexOverlay";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import type { DexState } from "../state/dex";
import { discoveredDex } from "../state/testSupport/guidedRound";

/** #346 S2: the Dex 「🔎 研究中のピザ」 section -- display only, anonymous, S1 authority. */

afterEach(cleanup);

const ladderOwned = (step: number) => [
  ...STARTER_INGREDIENT_IDS,
  ...DISCOVERY_LADDER.steps.filter((s) => s.step <= step).flatMap((s) => s.ingredientIds),
];
const keysBefore = (step: number) => [
  "margherita",
  ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId),
];

function renderDex(p: { dex?: DexState; owned: readonly string[]; facts?: Record<string, string[]> }) {
  const { container } = render(
    <DexOverlay
      dex={p.dex ?? []}
      newlyDiscoveredId={null}
      newBestRecipeId={null}
      onClose={() => {}}
      ownedIngredientIds={p.owned}
      inventory={{}}
      discoveryHintFacts={p.facts}
    />,
  );
  const section = container.querySelector<HTMLElement>(".dex-overlay__research");
  return { container, section, cards: Array.from(section?.querySelectorAll(".dex-research-card") ?? []) };
}

const single = () => ({
  dex: discoveredDex([...keysBefore(25), "brazilian-calabresa"]),
  owned: ladderOwned(25),
});
const multi = () => ({ dex: discoveredDex(keysBefore(12)), owned: ladderOwned(12) });

describe("Research Dex section", () => {
  it("A: hidden when there is no entry (and says nothing about the population)", () => {
    const { section, container } = renderDex({ owned: [...STARTER_INGREDIENT_IDS] });
    expect(section).toBeNull();
    expect(container.textContent).not.toMatch(/研究中|研究できる|すべて発見/);
  });

  it("B: a single entry shows an unnumbered ？？？ピザ with the unlock fact", () => {
    const { cards } = renderDex(single());
    expect(cards).toHaveLength(1);
    expect(cards[0].querySelector("h3")?.textContent).toBe("？？？ピザ");
    expect(cards[0].textContent).toContain("わかっていること");
    expect(cards[0].textContent).toContain("✓ チキンを使う");
    expect(cards[0].querySelector("button")).toBeNull();
  });

  it("C: multiple entries get ①② labels and no hidden names", () => {
    const { cards, section } = renderDex(multi());
    expect(cards.length).toBeGreaterThanOrEqual(2);
    expect(cards.map((c) => c.querySelector("h3")?.textContent).slice(0, 2)).toEqual(["？？？ピザ ①", "？？？ピザ ②"]);
    for (const id of ["pizza-portuguesa", "brazilian-calabresa"]) {
      const name = RECIPES.find((r) => r.id === id)!.nameJa;
      expect(section!.textContent).not.toContain(name);
    }
  });

  it("D: entries do not depend on stock (inventory 0)", () => {
    expect(renderDex(single()).cards).toHaveLength(1);
  });

  it("E: a discovered recipe leaves the research section and stays in the formal Dex", () => {
    const base = single();
    cleanup();
    const after = renderDex({ ...base, dex: discoveredDex(["pesto-pollo"], base.dex) });
    expect(after.section).toBeNull();
    expect(after.container.textContent).toContain(RECIPES.find((r) => r.id === "pesto-pollo")!.nameJa);
  });

  it("F/G: the ingredient total appears only after STRUCTURE is bought", () => {
    const before = renderDex(single());
    expect(before.section!.textContent).not.toMatch(/全部で|種類の材料/);
    cleanup();
    const after = renderDex({ ...single(), facts: { "pesto-pollo": ["meta:ingredient-total"] } });
    expect(after.section!.textContent).toMatch(/全部で \d+ 種類の材料を使う/);
  });

  it("privacy: no recipe id / No.xx / counts / distance copy in the section DOM", () => {
    for (const p of [single(), multi()]) {
      cleanup();
      const { section } = renderDex(p);
      const html = section!.outerHTML;
      for (const r of RECIPES) expect(html).not.toContain(r.id);
      expect(section!.textContent).not.toMatch(/No\.|残り|あと|\d+\s*\/\s*\d+|%|候補|未登録|Near|Far|近い|遠い/);
      expect(section!.querySelectorAll("[aria-label],[data-testid],[data-recipe-id]")).toHaveLength(0);
    }
  });
});
