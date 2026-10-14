import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { getIngredient } from "../data/ingredients";
import { getRecipe } from "../data/recipes";
import { addCutLine, createCutState } from "../logic/cut/state";
import type { PizzaState, SauceDeposit } from "../state/pizzaState";
import { createEmptyPizza } from "../state/pizzaState";
import { hashOf, ringBatch } from "../state/testSupport/sauceKindFixtures";
import { PizzaStage } from "./PizzaStage";

/**
 * Sauce B2 (layered sauce painting): the SINGLE-SOURCE rendering Golden. Generated BEFORE B2 on the rendering as it was;
 * B2 must keep every one-sauce-kind pizza's sauce DOM byte-identical (the same canvases, with the same props and classes, in the
 * same order). The two canvas components are replaced by probes that print every prop they receive, so the hash covers the
 * deposits, colour, dough shape and class names each canvas is given. The pixels themselves are pinned by the browser tests
 * (e2e/sauce-edge-475.spec.ts). Never edit the golden to make B2 pass; regenerate only on purpose (UPDATE_SAUCE_B2_GOLDEN=1).
 */
vi.mock("./SauceHeatmapCanvas", () => ({
  SauceHeatmapCanvas: (props: { deposits: unknown; doughShape: unknown; color: string; className?: string }) => (
    <canvas data-probe="heatmap" data-props={JSON.stringify(props)} />
  ),
}));
vi.mock("./OverflowMarkerCanvas", () => ({
  OverflowMarkerCanvas: (props: { deposits: unknown; doughShape: unknown; color: string; className?: string }) => (
    <canvas data-probe="overflow" data-props={JSON.stringify(props)} />
  ),
}));

const GOLDEN_PATH = resolve(__dirname, "__golden__/sauceRender.singleSource.json");
const RECT = { left: 0, top: 0, width: 300, height: 300, right: 300, bottom: 300 } as DOMRect;
const margherita = getRecipe("margherita")!;

const ring = (n = 46, r = 25): SauceDeposit[] => ringBatch(50, 50, r, n);
const pizzaWith = (sauceIds: string[], deposits: SauceDeposit[], token = 1): PizzaState => ({
  ...createEmptyPizza(),
  sauceIds,
  sauceToken: token,
  sauceDeposits: deposits,
});

interface Scenario {
  name: string;
  pizza: PizzaState;
  bakeProgress?: number | null;
  active?: string;
  withCuts?: boolean;
  pendingPress?: boolean;
  step?: "SAUCE" | "CHEESE";
}

const SCENARIOS: Scenario[] = [
  { name: "empty", pizza: createEmptyPizza() },
  { name: "oneShotTomato", pizza: pizzaWith(["tomato-sauce"], []) },
  { name: "tomatoField", pizza: pizzaWith(["tomato-sauce"], ring()) },
  { name: "oliveOilField", pizza: pizzaWith(["olive-oil"], ring()) },
  { name: "pestoField", pizza: pizzaWith(["pesto"], ring()) },
  { name: "tomatoOverflow", pizza: pizzaWith(["tomato-sauce"], ring(30, 62)) },
  { name: "tomatoRaw", pizza: pizzaWith(["tomato-sauce"], ring()), bakeProgress: 40 },
  { name: "tomatoPerfect", pizza: pizzaWith(["tomato-sauce"], ring()), bakeProgress: 70 },
  { name: "tomatoBurnt", pizza: pizzaWith(["tomato-sauce"], ring()), bakeProgress: 95 },
  { name: "oliveOilPerfect", pizza: pizzaWith(["olive-oil"], ring()), bakeProgress: 70 },
  { name: "tomatoCut", pizza: pizzaWith(["tomato-sauce"], ring()), withCuts: true },
  { name: "oliveOilCut", pizza: pizzaWith(["olive-oil"], ring()), withCuts: true },
  { name: "tomatoPending", pizza: pizzaWith(["tomato-sauce"], ring(20)), active: "tomato-sauce", pendingPress: true },
  { name: "firstStrokePending", pizza: createEmptyPizza(), active: "tomato-sauce", pendingPress: true },
  { name: "wrongSingleSauce", pizza: pizzaWith(["pesto"], ring()), active: "pesto" },
];

function renderScenario(s: Scenario): string {
  const cutState = s.withCuts
    ? addCutLine(
        addCutLine(createCutState(), { start: { x: 0, y: 50 }, end: { x: 100, y: 50 } }),
        { start: { x: 50, y: 0 }, end: { x: 50, y: 100 } },
      )
    : createCutState();
  const { container } = render(
    <PizzaStage
      pizza={s.pizza}
      recipe={margherita}
      interactive={s.pendingPress === true}
      activeIngredient={getIngredient(s.active ?? "tomato-sauce")!}
      bakeProgress={s.bakeProgress ?? null}
      placement={null}
      resultRevealed={false}
      referenceModeEnabled
      resetToken={0}
      makingStepToken={0}
      makingStep={s.step ?? "SAUCE"}
      showDoughShape
      onTap={() => {}}
      onDispenseProgress={() => {}}
      onDispenseCommit={() => {}}
      onDoughStretchProgress={() => {}}
      onDoughStretchCommit={() => {}}
      cutState={cutState}
      onAddCutLine={() => {}}
    />,
  );
  if (s.pendingPress) {
    const dough = container.querySelector<HTMLElement>('[data-pizza-drop-target="true"]')!;
    dough.getBoundingClientRect = () => RECT;
    fireEvent.pointerDown(dough, { pointerId: 1, isPrimary: true, pointerType: "touch", clientX: 150, clientY: 150 });
  }
  const html = container.innerHTML;
  cleanup();
  return html;
}

function build(): Record<string, { html: string; heatmaps: number; overflows: number }> {
  const out: Record<string, { html: string; heatmaps: number; overflows: number }> = {};
  for (const s of SCENARIOS) {
    const html = renderScenario(s);
    out[s.name] = {
      html: hashOf(html),
      heatmaps: (html.match(/data-probe="heatmap"/g) ?? []).length,
      overflows: (html.match(/data-probe="overflow"/g) ?? []).length,
    };
  }
  return out;
}

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PizzaStage single-source sauce rendering Golden (pinned before B2)", () => {
  if (process.env.UPDATE_SAUCE_B2_GOLDEN === "1") {
    it("regenerates the golden (opt-in only)", () => {
      writeFileSync(GOLDEN_PATH, JSON.stringify(build(), null, 1) + "\n");
    });
    return;
  }
  const golden: Record<string, { html: string; heatmaps: number; overflows: number }> = existsSync(GOLDEN_PATH)
    ? JSON.parse(readFileSync(GOLDEN_PATH, "utf8"))
    : {};

  it("the golden exists and covers every scenario", () => {
    expect(Object.keys(golden).sort()).toEqual(SCENARIOS.map((s) => s.name).sort());
  });

  for (const s of SCENARIOS) {
    it(`${s.name}: the sauce DOM and every canvas prop are unchanged`, () => {
      const html = renderScenario(s);
      expect(hashOf(html)).toBe(golden[s.name].html);
    });
  }

  it("sanity: the golden distinguishes the scenarios (probes are really rendered)", () => {
    expect(golden.tomatoField.heatmaps).toBe(1);
    expect(golden.tomatoField.overflows).toBe(1);
    expect(golden.empty.heatmaps).toBe(0);
    expect(golden.oneShotTomato.heatmaps).toBe(0);
    expect(golden.tomatoCut.heatmaps).toBeGreaterThan(1); // one copy per piece
    expect(new Set(Object.values(golden).map((g) => g.html)).size).toBeGreaterThan(12);
  });
});
