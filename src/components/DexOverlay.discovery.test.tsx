import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DexOverlay } from "./DexOverlay";
import { RECIPES } from "../data/recipes";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { materialIdsOfSteps } from "../logic/discoveryLadder";
import type { DexState } from "../state/dex";
import type { InventoryState } from "../state/inventory";
import { discoveredDex } from "../state/testSupport/guidedRound";

/**
 * Progression 2.0 W1 Discovery 2.0 -- W1-f: the Dex is grouped by the canonical 6 / 10 / 10
 * chapters with a fixed No. per slot; an undiscovered slot shows ？？？ plus, for the "next" ones,
 * a state tag -- never a name, finished preview, ingredients or name length.
 */

afterEach(cleanup);

function renderDex(p: {
  dex?: DexState;
  owned?: readonly string[];
  unlocked?: readonly string[];
  inventory?: InventoryState;
}) {
  const onGoFreeCook = vi.fn();
  const onOpenShop = vi.fn();
  render(
    <DexOverlay
      dex={p.dex ?? []}
      newlyDiscoveredId={null}
      newBestRecipeId={null}
      onClose={vi.fn()}
      ownedIngredientIds={[...STARTER_INGREDIENT_IDS, ...(p.owned ?? [])]}
      unlockedForShopIngredientIds={p.unlocked ?? []}
      inventory={p.inventory ?? {}}
      onGoFreeCook={onGoFreeCook}
      onOpenShop={onOpenShop}
    />,
  );
  return { onGoFreeCook, onOpenShop };
}

const chapterTitles = () =>
  Array.from(document.querySelectorAll(".dex-overlay__chapter-title")).map((e) => e.textContent);

describe("W1-f Dex", () => {
  it("3 chapters (6 / 10 / 11) with per-chapter counts and fixed No. slots", () => {
    renderDex({ dex: discoveredDex(["margherita", "marinara"]) });
    expect(chapterTitles()).toEqual(["第1章1/6", "第2章1/10", "第3章0/11"]);
    const chapters = Array.from(document.querySelectorAll(".dex-overlay__chapter"));
    expect(chapters.map((c) => c.querySelectorAll(".dex-card").length)).toEqual([6, 10, 11]);
    expect(within(chapters[1] as HTMLElement).getByText(/マリナーラ/).textContent).toContain("No.01");
  });

  it("a complete chapter is checked", () => {
    renderDex({ dex: discoveredDex(["margherita", "bismarck", "funghi", "breakfast-pizza", "melanzane-pizza", "parmigiana-pizza"]) });
    expect(chapterTitles()[0]).toBe("第1章6/6 ✓");
  });

  it("tags: 🎨 for DISCOVERABLE (-> Free Cooking), 🏪 for Shop-gated (-> Shop), plain ？？？ otherwise", async () => {
    // Margherita discovered, egg arrived but not bought: bismarck is Shop-gated.
    const shop = renderDex({ dex: discoveredDex(["margherita"]), unlocked: ["egg"] });
    const shopSlot = document.querySelector<HTMLElement>('[data-dex-state="KNOWN_BUT_MISSING_MATERIAL"]')!;
    expect(shopSlot).toHaveTextContent("🏪 ショップの材料で作れるかも");
    await userEvent.click(within(shopSlot).getByRole("button", { name: "ショップを見る" }));
    expect(shop.onOpenShop).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('[data-dex-state="KNOWN_BUT_MISSING_MATERIAL"]')).toHaveLength(1);
    cleanup();

    // Egg bought with stock: bismarck is DISCOVERABLE.
    const free = renderDex({ dex: discoveredDex(["margherita"]), owned: ["egg"], unlocked: ["egg"], inventory: { egg: 10 } });
    const freeSlot = document.querySelector<HTMLElement>('[data-dex-state="DISCOVERABLE"]')!;
    expect(freeSlot).toHaveTextContent("🎨 今の材料で作れるかも");
    await userEvent.click(within(freeSlot).getByRole("button", { name: "フリークッキングで探す" }));
    expect(free.onGoFreeCook).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('[data-dex-state="UNKNOWN"]').length).toBe(25);
    expect(screen.getAllByText("まだ見ぬピザ")).toHaveLength(25);
  });

  it("nothing about an undiscovered recipe reaches the DOM, at every ladder Dex (arrived / bought)", () => {
    const keyOrder = ["margherita", ...DISCOVERY_LADDER.steps.map((s) => s.keyRecipeId)];
    for (const bought of [false, true]) {
      for (let n = 0; n <= keyOrder.length; n++) {
        const unlocked = materialIdsOfSteps(DISCOVERY_LADDER.steps.filter((s) => s.step <= n));
        const owned = bought ? unlocked : materialIdsOfSteps(DISCOVERY_LADDER.steps.filter((s) => s.step < n));
        renderDex({
          dex: discoveredDex(keyOrder.slice(0, n)),
          owned,
          unlocked,
          inventory: Object.fromEntries(owned.map((m) => [m, 30])),
        });
        const known = new Set(keyOrder.slice(0, n));
        const attrs = Array.from(document.querySelectorAll("*"))
          .map((e) => ["aria-label", "title", "alt", "style"].map((a) => e.getAttribute(a) ?? "").join("|"))
          .join("|");
        const everything = `${document.body.textContent}||${attrs}`;
        for (const r of RECIPES.filter((x) => !known.has(x.id))) {
          // NF-8 lexical overlaps (not leaks): a discovered card's own ingredient
          // (ジェノベーゼソース contains ジェノベーゼ) and marinara's own description (「ナポリ生まれ」
          // contains ナポリ). Scrubbed by exact phrase, never by loose substring.
          const overlap: Record<string, string> = { ジェノベーゼ: "ジェノベーゼソース", ナポリ: "ナポリ生まれ" };
          const scrubbed = overlap[r.nameJa] ? everything.split(overlap[r.nameJa]).join("") : everything;
          expect(scrubbed, `${bought ? "B" : "A"} Dex ${n}: ${r.id}`).not.toContain(r.nameJa);
          expect(everything, r.id).not.toContain(r.description);
        }
        // 27 recipes; the walk never discovers the non-credit calabresa. Once the key recipe's materials are owned (Dex
        // 12 bought) and until the 26th (step 25's pesto-pollo is the last key recipe), the ladder's key recipe and calabresa are both DISCOVERABLE:
        // pool 2 adds exactly one extra aggregated unknown card (D-2).
        const pool2 = bought && n >= 12 && n < 26; // "arrived, not bought": the newest material is missing, so the key recipe is not yet DISCOVERABLE
        expect(document.querySelectorAll(".dex-card--locked"), `${bought ? "B" : "A"} Dex ${n}`).toHaveLength(27 - n + (pool2 ? 1 : 0));
        expect(document.querySelectorAll("[data-dex-aggregated]")).toHaveLength(pool2 ? 1 : 0);
        expect(document.querySelectorAll(".dex-card--locked .dex-card__ingredient, .dex-card--locked svg")).toHaveLength(0);
        cleanup();
      }
    }
  });
});
