import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { getIngredient } from "../data/ingredients";
import { getRecipe } from "../data/recipes";
import { addCutLine, createCutState } from "../logic/cut/state";
import { createEmptyPizza, type PizzaState, type SauceDeposit } from "../state/pizzaState";
import { ringBatch } from "../state/testSupport/sauceKindFixtures";
import { PizzaStage } from "./PizzaStage";

/**
 * Sauce B2 (layered painting): with two or more sauce kinds each kind is its own heatmap layer -- first laid at the bottom, its
 * own deposits and colour -- and the pizza keeps what was painted before a switch. The canvases are replaced by probes that print
 * their props, so what each layer is given is asserted here; the pixels are checked in the browser (e2e/sauce-layers-b2.spec.ts).
 */
type ProbeProps = { deposits: SauceDeposit[]; color: string; className?: string; underDeposits?: SauceDeposit[] };
// Every render of a probe records the props object it was given, so a test can tell "the same props as last time" (no repaint) from new ones.
const seen = vi.hoisted(() => ({ heatmap: [] as unknown[][], overflow: [] as unknown[][] }));
vi.mock("./SauceHeatmapCanvas", () => ({
  SauceHeatmapCanvas: (props: ProbeProps) => {
    seen.heatmap.push([props.deposits, props.underDeposits]);
    return <canvas data-probe="heatmap" data-props={JSON.stringify(props)} />;
  },
}));
vi.mock("./OverflowMarkerCanvas", () => ({
  OverflowMarkerCanvas: (props: ProbeProps) => {
    seen.overflow.push([props.deposits]);
    return <canvas data-probe="overflow" data-props={JSON.stringify(props)} />;
  },
}));

const RECT = { left: 0, top: 0, width: 300, height: 300, right: 300, bottom: 300 } as DOMRect;
const margherita = getRecipe("margherita")!;
const tomatoColor = getIngredient("tomato-sauce")!.color;
const pestoColor = getIngredient("pesto")!.color;
const oilColor = getIngredient("olive-oil")!.color;

const stamp = (ds: SauceDeposit[], id: string): SauceDeposit[] => ds.map((d) => ({ ...d, ingredientId: id }));
const multi = (...parts: Array<[string, SauceDeposit[]]>): PizzaState => ({
  ...createEmptyPizza(),
  sauceIds: parts.map(([id]) => id),
  sauceToken: parts.length,
  sauceDeposits: parts.flatMap(([id, ds]) => stamp(ds, id)),
});

function stageElement(pizza: PizzaState, extra: { bakeProgress?: number; cuts?: boolean; pressWith?: string } = {}) {
  const cutState = extra.cuts
    ? addCutLine(addCutLine(createCutState(), { start: { x: 0, y: 50 }, end: { x: 100, y: 50 } }), { start: { x: 50, y: 0 }, end: { x: 50, y: 100 } })
    : createCutState();
  return (
    <PizzaStage
      pizza={pizza}
      recipe={margherita}
      interactive={extra.pressWith !== undefined}
      activeIngredient={getIngredient(extra.pressWith ?? "tomato-sauce")!}
      bakeProgress={extra.bakeProgress ?? null}
      placement={null}
      resultRevealed={false}
      referenceModeEnabled
      resetToken={0}
      makingStepToken={0}
      makingStep="SAUCE"
      showDoughShape
      onTap={() => {}}
      onDispenseProgress={() => {}}
      onDispenseCommit={() => {}}
      onDoughStretchProgress={() => {}}
      onDoughStretchCommit={() => {}}
      cutState={cutState}
      onAddCutLine={() => {}}
    />
  );
}

function renderStage(pizza: PizzaState, extra: { bakeProgress?: number; cuts?: boolean; pressWith?: string } = {}) {
  const view = render(stageElement(pizza, extra));
  if (extra.pressWith !== undefined) {
    const dough = view.container.querySelector<HTMLElement>('[data-pizza-drop-target="true"]')!;
    dough.getBoundingClientRect = () => RECT;
    fireEvent.pointerDown(dough, { pointerId: 1, isPrimary: true, pointerType: "touch", clientX: 150, clientY: 150 });
  }
  return view.container;
}

const probes = (c: HTMLElement, kind: "heatmap" | "overflow") =>
  [...c.querySelectorAll<HTMLElement>(`canvas[data-probe="${kind}"]`)].map((el) => JSON.parse(el.dataset.props!) as ProbeProps);

beforeEach(() => {
  seen.heatmap.length = 0;
  seen.overflow.length = 0;
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PizzaStage layered sauce painting", () => {
  const tomato = ringBatch(35, 40, 14, 20);
  const pesto = ringBatch(62, 58, 14, 20);

  it("two kinds: one heatmap per kind, first laid at the bottom, each with its own deposits and colour", () => {
    const heat = probes(renderStage(multi(["tomato-sauce", tomato], ["pesto", pesto])), "heatmap");
    expect(heat).toHaveLength(2);
    expect(heat[0].color).toBe(tomatoColor);
    expect(heat[1].color).toBe(pestoColor);
    expect(heat[0].deposits).toHaveLength(20);
    expect(heat[1].deposits).toHaveLength(20);
    expect(heat[0].deposits.every((d) => d.ingredientId === "tomato-sauce")).toBe(true);
    expect(heat[1].deposits.every((d) => d.ingredientId === "pesto")).toBe(true);
    expect(heat[0].className).toContain("pizza-sauce-heatmap--kind-tomato-sauce");
    expect(heat[1].className).toContain("pizza-sauce-heatmap--kind-pesto");
  });

  it("what was painted before a switch keeps its colour and its positions", () => {
    const heat = probes(renderStage(multi(["tomato-sauce", tomato], ["pesto", pesto])), "heatmap");
    expect(heat[0].deposits.map((d) => [d.x, d.y])).toEqual(tomato.map((d) => [d.x, d.y]));
    expect(heat[0].color).toBe(tomatoColor);
  });

  it("DOM order is the paint order: every heatmap in first-use order, then the overflow markers on top", () => {
    const c = renderStage(multi(["tomato-sauce", tomato], ["pesto", pesto]));
    const order = [...c.querySelectorAll<HTMLElement>("canvas[data-probe]")].map((el) => `${el.dataset.probe}:${JSON.parse(el.dataset.props!).color}`);
    expect(order).toEqual([`heatmap:${tomatoColor}`, `heatmap:${pestoColor}`, `overflow:${tomatoColor}`, `overflow:${pestoColor}`]);
  });

  it("each overflow layer carries its own kind's deposits and colour", () => {
    const over = probes(renderStage(multi(["tomato-sauce", ringBatch(50, 50, 62, 10)], ["pesto", ringBatch(50, 50, 62, 8)])), "overflow");
    expect(over.map((o) => [o.color, o.deposits.length])).toEqual([[tomatoColor, 10], [pestoColor, 8]]);
  });

  it("three kinds stack in the order they were laid", () => {
    const heat = probes(renderStage(multi(["olive-oil", tomato], ["tomato-sauce", pesto], ["pesto", ringBatch(48, 52, 10, 10)])), "heatmap");
    expect(heat.map((h) => h.color)).toEqual([oilColor, tomatoColor, pestoColor]);
  });

  it("tomato, pesto, then tomato again: three layers, the later tomato on top of the pesto (Owner Decision, #494)", () => {
    const p: PizzaState = {
      ...createEmptyPizza(),
      sauceIds: ["tomato-sauce", "pesto"],
      sauceToken: 3,
      sauceDeposits: [...stamp(tomato, "tomato-sauce"), ...stamp(pesto, "pesto"), ...stamp(ringBatch(48, 52, 10, 10), "tomato-sauce")],
    };
    const heat = probes(renderStage(p), "heatmap");
    expect(heat.map((h) => h.color)).toEqual([tomatoColor, pestoColor, tomatoColor]);
    expect(heat.map((h) => h.deposits.length)).toEqual([20, 20, 10]);
  });

  it("a cut pizza draws every run once per piece, each piece in the same chronological order (#494)", () => {
    const p: PizzaState = {
      ...createEmptyPizza(),
      sauceIds: ["tomato-sauce", "pesto"],
      sauceToken: 3,
      sauceDeposits: [...stamp(tomato, "tomato-sauce"), ...stamp(pesto, "pesto"), ...stamp(ringBatch(48, 52, 10, 10), "tomato-sauce")],
    };
    const c = renderStage(p, { cuts: true });
    const heat = probes(c, "heatmap");
    expect(heat).toHaveLength(12); // 4 pieces x 3 runs
    const perPiece = [tomatoColor, pestoColor, tomatoColor];
    expect(heat.map((h) => h.color)).toEqual([...perPiece, ...perPiece, ...perPiece, ...perPiece]);
    expect(probes(c, "overflow")).toHaveLength(12);
  });

  it("each heatmap layer is told what lies under it (overlap dimming, #494): nothing for the bottom layer, everything below for the rest", () => {
    const p: PizzaState = {
      ...createEmptyPizza(),
      sauceIds: ["tomato-sauce", "pesto"],
      sauceToken: 3,
      sauceDeposits: [...stamp(tomato, "tomato-sauce"), ...stamp(pesto, "pesto"), ...stamp(ringBatch(48, 52, 10, 10), "tomato-sauce")],
    };
    const c = renderStage(p);
    const heat = probes(c, "heatmap");
    expect(heat.map((h) => h.underDeposits?.length ?? 0)).toEqual([0, 20, 40]);
    // the markers are not dimmed: only the heatmap layers get `underDeposits`
    for (const o of probes(c, "overflow")) expect(o.underDeposits).toBeUndefined();
  });

  it("a one-sauce pizza passes no `underDeposits` at all (its raster is never touched)", () => {
    const one: PizzaState = { ...createEmptyPizza(), sauceIds: ["tomato-sauce"], sauceToken: 1, sauceDeposits: tomato };
    expect(probes(renderStage(one), "heatmap")[0].underDeposits).toBeUndefined();
  });

  it("a stroke in progress over another sauce's later run is a new top layer, not folded under it", () => {
    const p: PizzaState = {
      ...createEmptyPizza(),
      sauceIds: ["tomato-sauce", "pesto"],
      sauceToken: 2,
      sauceDeposits: [...stamp(tomato, "tomato-sauce"), ...stamp(pesto, "pesto")],
    };
    const heat = probes(renderStage(p, { pressWith: "tomato-sauce" }), "heatmap");
    expect(heat.map((h) => h.color)).toEqual([tomatoColor, pestoColor, tomatoColor]);
    expect(heat[2].deposits.length).toBeGreaterThan(0);
  });

  it("a layer's alpha is the canvas's own: no extra opacity or blend is applied to a layer", () => {
    const heat = probes(renderStage(multi(["tomato-sauce", tomato], ["pesto", pesto])), "heatmap");
    for (const h of heat) expect(h.className).not.toMatch(/opacity|blend/);
  });

  it("olive oil keeps its own treatment on ITS layer only, and the full-pizza sheen is not drawn", () => {
    const c = renderStage(multi(["tomato-sauce", tomato], ["olive-oil", pesto]));
    const heat = probes(c, "heatmap");
    expect(heat[0].className).not.toContain("pizza-sauce-heatmap--oil");
    expect(heat[1].className).toContain("pizza-sauce-heatmap--oil");
    expect(c.querySelectorAll(".pizza-sauce-oil-sheen")).toHaveLength(0);
    expect(renderStage(multi(["tomato-sauce", tomato], ["pesto", pesto])).querySelectorAll(".pizza-sauce-oil-sheen")).toHaveLength(0);
  });

  it("the bake tint reaches every layer", () => {
    const heat = probes(renderStage(multi(["tomato-sauce", tomato], ["pesto", pesto]), { bakeProgress: 95 }), "heatmap");
    for (const h of heat) expect(h.className).toContain("pizza-sauce-heatmap--burnt");
  });

  it("a cut pizza draws every layer once per piece, each piece in the same order", () => {
    const c = renderStage(multi(["tomato-sauce", tomato], ["pesto", pesto]), { cuts: true });
    const heat = probes(c, "heatmap");
    expect(heat).toHaveLength(8); // 4 pieces x 2 layers
    expect(heat.map((h) => h.color)).toEqual([tomatoColor, pestoColor, tomatoColor, pestoColor, tomatoColor, pestoColor, tomatoColor, pestoColor]);
  });

  it("a stroke in progress over another sauce is the top layer; the committed sauce stays underneath", () => {
    const c = renderStage(multi(["tomato-sauce", tomato]), { pressWith: "pesto" });
    // one committed kind + the pesto stroke just started (its starter tick is buffered, not yet committed)
    const heat = probes(c, "heatmap");
    expect(heat.map((h) => h.color)).toEqual([tomatoColor, pestoColor]);
    expect(heat[0].deposits).toHaveLength(20);
    expect(heat[1].deposits.length).toBeGreaterThan(0);
  });

  it("a stroke in progress over the SAME sauce stays one layer (the single path)", () => {
    const heat = probes(renderStage(multi(["tomato-sauce", tomato]), { pressWith: "tomato-sauce" }), "heatmap");
    expect(heat).toHaveLength(1);
  });

  it("one sauce kind is never layered: a single heatmap with every deposit, as before", () => {
    const one: PizzaState = { ...createEmptyPizza(), sauceIds: ["tomato-sauce"], sauceToken: 1, sauceDeposits: tomato };
    const heat = probes(renderStage(one), "heatmap");
    expect(heat).toHaveLength(1);
    expect(heat[0].deposits).toHaveLength(20);
    expect(heat[0].className).not.toContain("--kind-");
  });

  it("a one-shot sauce followed by a painted one is a single painted layer", () => {
    const p: PizzaState = { ...createEmptyPizza(), sauceIds: ["tomato-sauce", "pesto"], sauceToken: 2, sauceDeposits: stamp(pesto, "pesto") };
    expect(probes(renderStage(p), "heatmap")).toHaveLength(1);
  });
});

describe("committing a stroke repaints only the run it touched (Codex P2 on PR #494)", () => {
  // run i = [kind, deposits]; alternating tomato / pesto, one deposit each
  // The log is append-only and a commit keeps the earlier deposit objects, so the deposits are made once and each pizza is a prefix of them.
  const log: SauceDeposit[] = Array.from({ length: 60 }, (_, i) => ({ x: 20 + i, y: 40, amount: 0.02, ingredientId: i % 2 === 0 ? "tomato-sauce" : "pesto" }));
  const pizzaOf = (n: number): PizzaState => ({ ...createEmptyPizza(), sauceIds: ["tomato-sauce", "pesto"], sauceToken: 2, sauceDeposits: log.slice(0, n) });
  const lastRender = (kind: "heatmap" | "overflow", count: number) => seen[kind].slice(-count);

  it("a new run leaves every earlier layer's props (deposits, under) the very same objects", () => {
    const view = render(stageElement(pizzaOf(12)));
    const before = lastRender("heatmap", 12);
    seen.heatmap.length = 0;
    seen.overflow.length = 0;
    view.rerender(stageElement(pizzaOf(13)));
    const after = lastRender("heatmap", 13);
    for (let i = 0; i < 12; i += 1) {
      expect(after[i][0]).toBe(before[i][0]);
      expect(after[i][1]).toBe(before[i][1]);
    }
    expect(after[12][0]).not.toBe(undefined);
    const overflowAfter = lastRender("overflow", 13);
    expect(overflowAfter).toHaveLength(13);
  });

  it("the same holds at 50 runs, and for a stroke that extends the top run (only that layer changes)", () => {
    const view = render(stageElement(pizzaOf(50)));
    const before = lastRender("heatmap", 50);
    const grown = pizzaOf(50);
    const top = grown.sauceDeposits[grown.sauceDeposits.length - 1];
    view.rerender(stageElement({ ...grown, sauceDeposits: [...grown.sauceDeposits, { ...top, x: top.x + 1 }] }));
    const after = lastRender("heatmap", 50);
    for (let i = 0; i < 49; i += 1) {
      expect(after[i][0]).toBe(before[i][0]);
      expect(after[i][1]).toBe(before[i][1]);
    }
    expect(after[49][0]).not.toBe(before[49][0]); // the extended run has a new deposit list
    expect(after[49][1]).toBe(before[49][1]); // ...but the layers under it did not change
  });
});
