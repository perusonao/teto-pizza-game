import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { DexOverlay } from "./DexOverlay";
import { AnonymousLockFrame, GenericPizzaSilhouette } from "./AnonymousLockFrame";
import { ANONYMOUS_LOCK_HINTS } from "./anonymousLockHints";
import { RECIPES } from "../data/recipes";
import { INGREDIENTS, STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { TECHNIQUES } from "../data/techniques";
import { materialIdsOfSteps } from "../logic/discoveryLadder";
import { discoveredDex } from "../state/testSupport/guidedRound";

/**
 * #422 PR-A (OD-DISPLAY-1): every undiscovered Dex slot carries the one generic, CSS-only pizza
 * silhouette. Pinned here: it is present on exactly the locked slots, byte-identical on all of
 * them, and neither it nor the slot adds any attribute that could name the recipe behind it.
 */

afterEach(cleanup);

const KEY_ORDER = ["margherita", ...DISCOVERY_LADDER.steps.map((s) => s.keyRecipeId)];

function renderStage(n: number, bought = true) {
  const unlocked = materialIdsOfSteps(DISCOVERY_LADDER.steps.filter((s) => s.step <= n));
  const owned = bought ? unlocked : materialIdsOfSteps(DISCOVERY_LADDER.steps.filter((s) => s.step < n));
  return render(
    <DexOverlay
      dex={discoveredDex(KEY_ORDER.slice(0, n))}
      newlyDiscoveredId={null}
      newBestRecipeId={null}
      onClose={vi.fn()}
      ownedIngredientIds={[...STARTER_INGREDIENT_IDS, ...owned]}
      unlockedForShopIngredientIds={unlocked}
      inventory={Object.fromEntries(owned.map((m) => [m, 30]))}
      onGoFreeCook={vi.fn()}
      onOpenShop={vi.fn()}
      onShowHint={vi.fn()}
    />,
  );
}

/** Locked recipe slots and the aggregated card -- never the 調理法 riddle cards. */
const lockedSlots = () => Array.from(document.querySelectorAll<HTMLElement>(".anonymous-lock"));
const silhouettes = () => Array.from(document.querySelectorAll<HTMLElement>(".generic-pizza-silhouette"));

const stages = [0, 1, Math.floor(KEY_ORDER.length / 2), KEY_ORDER.length - 1, KEY_ORDER.length];

describe("Dex generic pizza silhouette (#422 PR-A)", () => {
  it.each(stages)("Dex stage %i: one silhouette on each locked slot, none elsewhere", (n) => {
    renderStage(n);
    const slots = lockedSlots();
    expect(silhouettes()).toHaveLength(slots.length);
    for (const slot of slots) expect(slot.querySelectorAll(".generic-pizza-silhouette")).toHaveLength(1);
    // the locked recipe slots are exactly the undiscovered recipes (the aggregated card is extra)
    const recipeSlots = slots.filter((s) => !s.hasAttribute("data-dex-aggregated"));
    expect(recipeSlots).toHaveLength(RECIPES.length - n);
  });

  it.each(stages)("Dex stage %i: every silhouette is byte-identical and attribute-minimal", (n) => {
    renderStage(n);
    const html = new Set(silhouettes().map((s) => s.outerHTML));
    expect(html.size).toBeLessThanOrEqual(1);
    for (const s of silhouettes()) {
      expect(s.getAttributeNames().sort()).toEqual(["aria-hidden", "class"]);
      expect(s.getAttribute("aria-hidden")).toBe("true");
      for (const el of [s, ...Array.from(s.querySelectorAll("*"))]) {
        expect(el.hasAttribute("style")).toBe(false);
        expect(el.hasAttribute("id")).toBe(false);
        expect(el.hasAttribute("title")).toBe(false);
      }
    }
  });

  it("the silhouette is the same markup whatever the Dex looks like", () => {
    renderStage(0);
    const early = silhouettes()[0].outerHTML;
    cleanup();
    renderStage(KEY_ORDER.length - 1);
    const late = silhouettes()[0].outerHTML;
    expect(late).toBe(early);
  });

  it.each([false, true])("locked slots expose only allowed attributes, none recipe-derived (bought: %s)", (bought) => {
    const allowedNames = new Set(["class", "data-dex-state", "data-dex-aggregated", "aria-hidden", "type"]);
    for (const n of stages) {
      renderStage(n, bought);
      const known = new Set(KEY_ORDER.slice(0, n));
      const secrets = [
        ...RECIPES.filter((r) => !known.has(r.id)).flatMap((r) => [r.id, r.nameJa]),
        ...INGREDIENTS.filter((i) => i.unlockCondition).flatMap((i) => [i.id, i.nameJa]),
      ];
      for (const slot of lockedSlots()) {
        for (const el of [slot, ...Array.from(slot.querySelectorAll("*"))]) {
          for (const name of el.getAttributeNames()) {
            expect(allowedNames.has(name), `${name} on a locked slot (Dex ${n})`).toBe(true);
            if (name === "class") continue;
            const value = el.getAttribute(name) ?? "";
            expect(secrets.filter((s) => value.includes(s)), `${name}="${value}"`).toEqual([]);
          }
        }
      }
      cleanup();
    }
  });

  it("keeps the permitted per-slot differences: No., the state marker, the hint line", () => {
    renderStage(1);
    const states = new Set(lockedSlots().map((s) => s.getAttribute("data-dex-state")));
    expect([...states].every((v) => ["UNKNOWN", "DISCOVERABLE", "KNOWN_BUT_MISSING_MATERIAL"].includes(v ?? ""))).toBe(true);
    for (const slot of lockedSlots().filter((s) => !s.hasAttribute("data-dex-aggregated"))) {
      expect(slot.querySelector(".dex-card__no")?.textContent).toMatch(/^No\.\d\d$/);
      expect(slot.querySelector(".dex-card__lock-label")?.textContent).toMatch(/？？？$/);
      expect(Object.values(ANONYMOUS_LOCK_HINTS)).toContain(slot.querySelector(".dex-card__lock-hint")?.textContent);
    }
  });

  it("does not put the silhouette on 調理法 riddle cards", () => {
    const { container } = render(
      <DexOverlay
        dex={[]}
        newlyDiscoveredId={null}
        newBestRecipeId={null}
        onClose={vi.fn()}
        techniqueViews={[{ id: TECHNIQUES[0].id, state: "RIDDLE", riddleJa: "なぞなぞ" }]}
      />,
    );
    const riddle = container.querySelector('[data-technique-state="RIDDLE"]')!;
    expect(riddle).not.toBeNull();
    expect(riddle.querySelector(".generic-pizza-silhouette")).toBeNull();
    expect(riddle.classList.contains("anonymous-lock")).toBe(false);
  });

  it("the frame takes no recipe-derived free text (compile-time)", () => {
    // @ts-expect-error `lead` must be a "No.xx" marker, not a name
    const a = <AnonymousLockFrame lead="マルゲリータ" hint={ANONYMOUS_LOCK_HINTS.UNKNOWN} />;
    // @ts-expect-error `hint` must be one of the fixed lines
    const b = <AnonymousLockFrame hint="マルゲリータ" />;
    // @ts-expect-error the silhouette takes no props at all
    const c = <GenericPizzaSilhouette recipeId="margherita" />;
    expect([a, b, c]).toHaveLength(3);
  });
});

describe("Dex 44x44 targets and no whole-card opacity (#422 PR-A, CSS contract)", () => {
  const css = readFileSync(resolve(process.cwd(), "src/App.css"), "utf8");
  const rule = (selector: string) => {
    const start = css.indexOf(`\n${selector} {`);
    expect(start, `rule ${selector}`).toBeGreaterThanOrEqual(0);
    return css.slice(start, css.indexOf("}", start));
  };

  it("the Dex close button and a locked slot's CTA are at least 44x44", () => {
    for (const selector of [".dex-overlay__close--tap44", ".dex-card--locked .dex-card__tag-cta"]) {
      expect(rule(selector)).toMatch(/min-height:\s*44px/);
      expect(rule(selector)).toMatch(/min-width:\s*44px/);
    }
  });

  it("only the Dex close button opts in (the shared base rule and other overlays are unchanged)", () => {
    expect(rule(".dex-overlay__close")).toMatch(/min-height:\s*40px/);
    const { container } = render(<DexOverlay dex={[]} newlyDiscoveredId={null} newBestRecipeId={null} onClose={vi.fn()} />);
    expect(container.querySelector(".dex-overlay__close")?.classList.contains("dex-overlay__close--tap44")).toBe(true);
  });

  it(".dex-card--locked no longer dims the whole card", () => {
    expect(rule(".dex-card--locked")).not.toMatch(/opacity/);
  });
});
