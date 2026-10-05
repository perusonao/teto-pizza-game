import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
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

function renderDex(p: {
  dex?: DexState;
  owned: readonly string[];
  facts?: Record<string, string[]>;
  inventory?: Record<string, number>;
  onResearch?: (recipeId: string) => void;
}) {
  const { container } = render(
    <DexOverlay
      dex={p.dex ?? []}
      newlyDiscoveredId={null}
      newBestRecipeId={null}
      onClose={() => {}}
      ownedIngredientIds={p.owned}
      inventory={p.inventory ?? {}}
      discoveryHintFacts={p.facts}
      onResearch={p.onResearch}
    />,
  );
  const section = container.querySelector<HTMLElement>(".dex-overlay__research");
  return { container, section, cards: Array.from(section?.querySelectorAll(".dex-research-card") ?? []) };
}

const single = () => ({
  dex: discoveredDex([...keysBefore(25), "brazilian-calabresa", "aussie"]), // the two non-credit onion-step recipes (TQ-1D: aussie) are found
  owned: ladderOwned(25),
});
const multi = () => ({ dex: discoveredDex(keysBefore(12)), owned: ladderOwned(12) });

describe("Research Dex section", () => {
  it("A: hidden when there is no entry (and says nothing about the population)", () => {
    const { section, container } = renderDex({ owned: [...STARTER_INGREDIENT_IDS] });
    expect(section).toBeNull();
    expect(container.textContent).not.toMatch(/研究中|研究できる|すべて発見/);
  });

  it("B: a single cohort shows a letterless ？？？ピザ（unlock fact）", () => {
    const { cards } = renderDex(single());
    expect(cards).toHaveLength(1);
    expect(cards[0].querySelector("h3")?.textContent).toBe("？？？ピザ（チキン）");
    expect(cards[0].textContent).toContain("わかっていること");
    expect(cards[0].textContent).toContain("✓ チキンを使う");
    expect(cards[0].querySelector("button")).toBeNull();
  });

  it("C: cohort siblings get stable letters (A（たまねぎ）, B（たまねぎ）) and no hidden names", () => {
    const { cards, section } = renderDex(multi());
    expect(cards.length).toBeGreaterThanOrEqual(2);
    expect(cards.map((c) => c.querySelector("h3")?.textContent).slice(0, 2)).toEqual(["？？？ピザ A（たまねぎ）", "？？？ピザ B（たまねぎ）"]);
    for (const id of ["pizza-portuguesa", "brazilian-calabresa", "aussie"]) {
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

describe("S3: 「このピザを研究する」 (Research Target selection)", () => {
  const stocked = (owned: readonly string[]) => Object.fromEntries(owned.map((id) => [id, 10]));

  it("a single cookable entry offers one anonymous research CTA that reports its recipe through the callback only", () => {
    const picked: string[] = [];
    const p = single();
    const { cards } = renderDex({ ...p, inventory: stocked(p.owned), onResearch: (id) => picked.push(id) });
    const button = cards[0].querySelector("button")!;
    expect(button.textContent).toContain("このピザを研究する");
    expect(button.getAttribute("aria-label")).toBe("？？？ピザ（チキン）を研究する");
    fireEvent.click(button);
    expect(picked).toEqual(["pesto-pollo"]);
  });

  it("multiple entries: each anonymous card selects its own entry, and the DOM never carries an id or a name", () => {
    const picked: string[] = [];
    const p = multi();
    const { cards, section } = renderDex({ ...p, inventory: stocked(p.owned), onResearch: (id) => picked.push(id) });
    const buttons = cards.map((c) => c.querySelector("button")!);
    expect(buttons.map((b) => b.getAttribute("aria-label")).slice(0, 2)).toEqual(["？？？ピザ A（たまねぎ）を研究する", "？？？ピザ B（たまねぎ）を研究する"]);
    fireEvent.click(buttons[1]);
    expect(picked).toHaveLength(1);
    const html = section!.outerHTML;
    for (const r of RECIPES) {
      expect(html).not.toContain(r.id);
      expect(html).not.toContain(r.nameJa);
    }
    expect(section!.querySelectorAll("[data-testid],[data-recipe-id]")).toHaveLength(0);
  });

  it("an entry that cannot be cooked now (stock 0) offers no CTA, and no onResearch means no CTA", () => {
    const p = single();
    expect(renderDex({ ...p, inventory: {}, onResearch: () => {} }).cards[0].querySelector("button")).toBeNull();
    cleanup();
    expect(renderDex({ ...p, inventory: stocked(p.owned) }).cards[0].querySelector("button")).toBeNull();
  });

  it("bought Hint facts appear as exact / class lines without a name or id for the hidden recipe", () => {
    const p = single();
    const { section } = renderDex({
      ...p,
      inventory: stocked(p.owned),
      onResearch: () => {},
      facts: { "pesto-pollo": ["ing:pesto", "h5:sauce", "meta:ingredient-total", "h5:structure", "cls:fresh-tomato"] },
    });
    expect(section!.textContent).toContain("✓ チキンを使う");
    expect(section!.textContent).toContain("✓ ジェノベーゼソースを使う");
    expect(section!.textContent).toMatch(/△ /);
    expect(section!.textContent).toMatch(/全部で 4 種類の材料を使う/);
    expect(section!.textContent).not.toContain(RECIPES.find((r) => r.id === "pesto-pollo")!.nameJa);
  });
});
