import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { gameReducer, type GameState } from "../state/gameReducer";
import { toStep } from "../logic/steam/steamFixtures";
import { PizzaStage } from "./PizzaStage";

/**
 * Cooking Steam Phase 1 (#726, S3b): PizzaStage draws a steamed ingredient's placed pieces with the steam look, composes it with the bake's own filter, and
 * everything else exactly as before. (The wrapper's inline bake `filter` always beats a class, so the steam filter lives on the inner glyph: ./Steam.css.)
 */
function withShellfish(): GameState {
  let s = toStep("GUIDED", "TOPPING");
  for (const [ingredientId, x, y] of [["clam", 40, 50], ["mozzarella", 60, 50], ["clam", 50, 30], ["mussel", 55, 65], ["sausage", 30, 40]] as const) {
    s = gameReducer(s, { type: "PLACE_TOPPING", ingredientId, x, y });
  }
  return s;
}
type Extra = { steamedLook?: Record<string, number>; searedLook?: Record<string, number>; steamOverlay?: React.ReactNode; searOverlay?: React.ReactNode; bakeProgress?: number | null };
function stage(state: GameState, extra: Extra = {}) {
  const { bakeProgress = null, ...rest } = extra;
  return (
    <PizzaStage
      pizza={state.pizza}
      recipe={state.recipe}
      interactive
      activeIngredient={null}
      bakeProgress={bakeProgress}
      placement={null}
      resultRevealed={false}
      referenceModeEnabled={false}
      resetToken={0}
      makingStepToken={state.makingStepToken}
      makingStep="TOPPING"
      showDoughShape
      onTap={() => {}}
      onDispenseProgress={() => {}}
      onDispenseCommit={() => {}}
      onDoughStretchProgress={() => {}}
      onDoughStretchCommit={() => {}}
      cutState={state.cutState}
      onAddCutLine={() => {}}
      {...rest}
    />
  );
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const wrappers = (container: HTMLElement, id: string) => [...container.querySelectorAll(`.pizza-topping--${id} .ingredient-piece-visual__emoji`)] as HTMLElement[];
const stripIds = (html: string) => html.replace(/topping-\d+/g, "topping-N").replace(/_r_[0-9a-z]+_/g, "ID");

describe("PizzaStage steamed pieces", () => {
  const state = withShellfish();

  it("without the prop (flag OFF) the markup is exactly today's: no steamed class, no custom property, no steam element", () => {
    const { container } = render(stage(state));
    expect(wrappers(container, "clam").length).toBe(2);
    expect(container.querySelectorAll(".ingredient-piece--steamed")).toHaveLength(0);
    expect(container.innerHTML).not.toMatch(/--steam-(bright|sat|sheen)/);
    expect(container.innerHTML).not.toMatch(/cooking-steam/);
  });

  it("an empty look is the same markup as no prop", () => {
    const a = stripIds(render(stage(state)).container.innerHTML);
    cleanup();
    const b = stripIds(render(stage(state, { steamedLook: {} })).container.innerHTML);
    expect(b).toBe(a);
  });

  it("with the clam steamed, every placed clam piece (and only those) carries the class and the three variables", () => {
    const { container } = render(stage(state, { steamedLook: { clam: 0.6 } }));
    const clams = wrappers(container, "clam");
    expect(clams).toHaveLength(2);
    for (const el of clams) {
      expect(el.className).toContain("ingredient-piece--steamed");
      for (const v of ["--steam-bright", "--steam-sat", "--steam-sheen"]) expect(Number.isFinite(Number(el.style.getPropertyValue(v)))).toBe(true);
    }
    for (const id of ["mussel", "mozzarella", "sausage"]) {
      for (const el of wrappers(container, id)) {
        expect(el.className).not.toContain("steamed");
        expect(el.getAttribute("style") ?? "").not.toContain("--steam");
      }
    }
    expect(container.querySelectorAll(".ingredient-piece--steamed")).toHaveLength(2);
  });

  it("clam and mussel are looked up separately; the sear's look on the sausage is unaffected and the two never meet on a piece", () => {
    const { container } = render(stage(state, { steamedLook: { clam: 0.3, mussel: 1 }, searedLook: { sausage: 0.5 } }));
    expect(wrappers(container, "clam")[0].style.getPropertyValue("--steam-sheen")).not.toBe(wrappers(container, "mussel")[0].style.getPropertyValue("--steam-sheen"));
    expect(wrappers(container, "mussel")[0].className).toContain("ingredient-piece--steamed");
    const sausage = wrappers(container, "sausage")[0];
    expect(sausage.className).toContain("ingredient-piece--seared");
    expect(sausage.className).not.toContain("steamed");
    for (const el of [...wrappers(container, "clam"), ...wrappers(container, "mussel")]) expect(el.className).not.toContain("seared");
  });

  it("the drawing stays the wrapper's inner glyph (the steam filter's target) and the glyph itself is not modified", () => {
    const plain = render(stage(state));
    const plainGlyph = plain.container.querySelector(".pizza-topping--clam .ingredient-glyph--clam-valve")!;
    expect(plainGlyph).not.toBeNull();
    expect(plainGlyph.parentElement!.className).toContain("ingredient-piece-visual__emoji");
    const plainSvg = plainGlyph.outerHTML;
    plain.unmount();
    const steamed = render(stage(state, { steamedLook: { clam: 0.6 } }));
    const glyph = steamed.container.querySelector(".pizza-topping--clam .ingredient-glyph--clam-valve")!;
    expect(glyph.outerHTML).toBe(plainSvg);
    expect(glyph.getAttribute("style")).toBeNull();
  });

  it("during the bake the wrapper keeps ITS inline filter exactly as without the steam, and the steam rides on class + variables (the glyph carries the steam filter)", () => {
    const without = wrappers(render(stage(state, { bakeProgress: 70 })).container, "clam")[0].style.filter;
    expect(without).toMatch(/brightness\(/);
    cleanup();
    const { container } = render(stage(state, { bakeProgress: 70, steamedLook: { clam: 0.6 } }));
    const el = wrappers(container, "clam")[0];
    expect(el.style.filter).toBe(without);
    expect(el.style.filter).not.toMatch(/steam/);
    expect(el.className).toContain("ingredient-piece--steamed");
    expect(el.style.getPropertyValue("--steam-bright")).not.toBe("");
  });

  it("an over-steamed piece differs from a fully open one only in its variables (no new elements)", () => {
    const open = render(stage(state, { steamedLook: { clam: 0.95 } }));
    const openHtml = stripIds(open.container.innerHTML);
    const openCount = open.container.querySelectorAll("*").length;
    cleanup();
    const over = render(stage(state, { steamedLook: { clam: 1 } }));
    expect(over.container.querySelectorAll("*").length).toBe(openCount);
    expect(stripIds(over.container.innerHTML)).not.toBe(openHtml);
  });
});

describe("the steam overlay slot", () => {
  const state = withShellfish();
  it("is rendered inside the stage, after the sear's slot; nothing when absent", () => {
    const { container } = render(stage(state, { searOverlay: <i data-testid="sear-slot" />, steamOverlay: <i data-testid="steam-slot" /> }));
    const stageEl = container.querySelector(".pizza-stage")!;
    const kids = [...stageEl.children];
    const sear = kids.findIndex((k) => k.getAttribute("data-testid") === "sear-slot");
    const steam = kids.findIndex((k) => k.getAttribute("data-testid") === "steam-slot");
    expect(sear).toBeGreaterThanOrEqual(0);
    expect(steam).toBe(sear + 1);
    cleanup();
    expect(render(stage(state)).container.querySelector('[data-testid="steam-slot"]')).toBeNull();
  });
});

describe("./Steam.css: the steam filter targets the inner glyph only", () => {
  const css = readFileSync(path.resolve(__dirname, "Steam.css"), "utf8");
  it("has the glyph rule with filter and transition, and never filters or transforms the wrapper", () => {
    expect(css).toMatch(/\.ingredient-piece--steamed \.ingredient-glyph\s*\{[^}]*filter:/);
    expect(css).not.toMatch(/\.ingredient-piece--steamed\s*\{[^}]*(filter|transform):/);
    const glyphRule = css.match(/\.ingredient-piece--steamed \.ingredient-glyph\s*\{([^}]*)\}/)![1];
    expect(glyphRule).not.toMatch(/transform:/);
  });
});

describe("./Steam.css: H11 opened-shell overlay (#738)", () => {
  const css = readFileSync(path.resolve(__dirname, "Steam.css"), "utf8");
  it("draws the clam / mussel overlay only under .ingredient-piece--steamed, as a non-interactive absolute ::after (no layout / transform / filter change)", () => {
    const overlayRules = [...css.matchAll(/([^{}]*::after)\s*\{/g)].map((m) => m[1]).join("\n");
    for (const sel of overlayRules.split(",")) expect(sel).toContain(".ingredient-piece--steamed");
    expect(css).toMatch(/\.ingredient-piece--steamed:has\(\.ingredient-glyph--clam-valve\)::after/);
    expect(css).toMatch(/\.ingredient-piece--steamed:has\(\.ingredient-glyph--mussel-shell\)::after/);
    const base = css.match(/\.ingredient-piece--steamed:has\(\.ingredient-glyph--clam-valve\)::after,\s*\.ingredient-piece--steamed:has\(\.ingredient-glyph--mussel-shell\)::after\s*\{([^}]*)\}/)![1];
    expect(base).toMatch(/position:\s*absolute/);
    expect(base).toMatch(/pointer-events:\s*none/);
    expect(base).not.toMatch(/transform:|filter:/);
  });
  it("leaves the raw glyph SVG source untouched (no steam wiring in IngredientGlyph.tsx)", () => {
    const glyph = readFileSync(path.resolve(__dirname, "IngredientGlyph.tsx"), "utf8");
    expect(glyph).not.toMatch(/steam/i);
  });
});
