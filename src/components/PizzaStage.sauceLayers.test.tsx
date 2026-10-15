import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { getIngredient } from "../data/ingredients";
import { getRecipe } from "../data/recipes";
import { createChordCutLine } from "../logic/cut/fixtures";
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
const seen = vi.hoisted(() => ({ heatmap: [] as unknown[][], overflow: [] as unknown[][], merged: [] as unknown[][] }));
vi.mock("./SauceHeatmapCanvas", () => ({
  SauceHeatmapCanvas: (props: ProbeProps) => {
    seen.heatmap.push([props.deposits, props.underDeposits]);
    return <canvas data-probe="heatmap" data-props={JSON.stringify(props)} />;
  },
}));
vi.mock("./SauceMergedCanvas", () => ({
  SauceMergedHeatmapCanvas: (props: { runs: Array<{ deposits: unknown; ingredientId: string }>; bakedOil?: boolean; className?: string }) => {
    seen.merged.push(props.runs.map((r) => r.deposits));
    return <canvas data-probe="merged" data-kinds={props.runs.map((r) => r.ingredientId).join(",")} data-baked={String(!!props.bakedOil)} className={props.className} />;
  },
  SauceMergedOverflowCanvas: () => <canvas data-probe="merged-overflow" />,
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

function stageElement(pizza: PizzaState, extra: { bakeProgress?: number; cuts?: boolean | 8 | Array<[number, number]>; pressWith?: string } = {}) {
  const quarters = addCutLine(addCutLine(createCutState(), { start: { x: 0, y: 50 }, end: { x: 100, y: 50 } }), { start: { x: 50, y: 0 }, end: { x: 50, y: 100 } });
  const eighths = addCutLine(addCutLine(quarters, { start: { x: 0, y: 0 }, end: { x: 100, y: 100 } }), { start: { x: 100, y: 0 }, end: { x: 0, y: 100 } });
  const chords = Array.isArray(extra.cuts) ? extra.cuts.reduce((state, [angle, offset]) => addCutLine(state, createChordCutLine(angle, offset)), createCutState()) : null;
  const cutState = chords ?? (extra.cuts === 8 ? eighths : extra.cuts ? quarters : createCutState());
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

function renderStage(pizza: PizzaState, extra: { bakeProgress?: number; cuts?: boolean | 8 | Array<[number, number]>; pressWith?: string } = {}) {
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
  seen.merged.length = 0;
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
    // after the cut each piece flattens the (final) sauce into one shared group, every run in the same chronological order (Codex P2: per-piece budget)
    expect(probes(c, "heatmap")).toHaveLength(0);
    const merged = [...c.querySelectorAll<HTMLElement>('canvas[data-probe="merged"]')];
    expect(merged.map((m) => m.dataset.kinds)).toEqual(Array(4).fill("tomato-sauce,pesto,tomato-sauce")); // 4 pieces
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
    const merged = [...c.querySelectorAll<HTMLElement>('canvas[data-probe="merged"]')];
    expect(merged.map((m) => m.dataset.kinds)).toEqual(Array(4).fill("tomato-sauce,pesto")); // each piece: both layers, in order, on one shared group
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
  // The log is append-only and a commit keeps the earlier deposit objects, so the deposits are made once and each pizza is a prefix of them.
  const log: SauceDeposit[] = Array.from({ length: 60 }, (_, i) => ({ x: 20 + i, y: 40, amount: 0.02, ingredientId: i % 2 === 0 ? "tomato-sauce" : "pesto" }));
  const pizzaOf = (n: number): PizzaState => ({ ...createEmptyPizza(), sauceIds: ["tomato-sauce", "pesto"], sauceToken: 2, sauceDeposits: log.slice(0, n) });
  /** every run's deposit list as it was handed to a canvas (own or merged) in the last render */
  const drawn = (own: number) => new Set<unknown>([...seen.heatmap.slice(-own).map((r) => r[0]), ...seen.merged.slice(-100).flat()]);
  const lastRenderMerged = () => {
    const mergedNow = seen.merged.splice(0);
    return mergedNow;
  };

  it("a new run hands every earlier run's very same deposit list to its canvas (own or merged)", () => {
    const view = render(stageElement(pizzaOf(12)));
    const ownBefore = seen.heatmap.slice(-8).map((r) => r[0]);
    const mergedBefore = lastRenderMerged().slice(-4).flat();
    const before = new Set<unknown>([...ownBefore, ...mergedBefore]);
    expect(before.size).toBe(12);
    seen.heatmap.length = 0;
    view.rerender(stageElement(pizzaOf(13)));
    const after = drawn(8);
    expect(after.size).toBe(13);
    for (const deposits of before) expect(after.has(deposits)).toBe(true); // nothing was rebuilt
  });

  it("the same at 50 runs, and a stroke that extends the top run changes only that layer", () => {
    const view = render(stageElement(pizzaOf(50)));
    const before = new Set<unknown>([...seen.heatmap.slice(-8).map((r) => r[0]), ...lastRenderMerged().slice(-4).flat()]);
    expect(before.size).toBe(50);
    seen.heatmap.length = 0;
    const grown = pizzaOf(50);
    const top = grown.sauceDeposits[grown.sauceDeposits.length - 1];
    view.rerender(stageElement({ ...grown, sauceDeposits: [...grown.sauceDeposits, { ...top, x: top.x + 1 }] }));
    const after = drawn(8);
    expect(after.size).toBe(50);
    const rebuilt = [...after].filter((d) => !before.has(d));
    expect(rebuilt).toHaveLength(1); // the extended top run
    expect([...before].filter((d) => !after.has(d))).toHaveLength(1); // ...replacing its old list
  });
});

describe("the sauce canvas budget after the cut (Codex P2 on PR #494)", () => {
  const log = (n: number, kindOf: (i: number) => string): PizzaState => ({
    ...createEmptyPizza(),
    sauceIds: ["tomato-sauce", "pesto", "olive-oil"],
    sauceToken: 3,
    sauceDeposits: Array.from({ length: n }, (_, i) => ({ x: 20 + (i % 60), y: 40, amount: 0.02, ingredientId: kindOf(i) })),
  });
  const canvases = (c: HTMLElement) => c.querySelectorAll("canvas").length;

  it("an eight-piece pizza with 100 alternating oil / other runs carries at most 32 sauce canvases (4 per piece)", () => {
    const c = renderStage(log(100, (i) => (i % 2 ? "olive-oil" : "tomato-sauce")), { cuts: 8 });
    expect(canvases(c)).toBeLessThanOrEqual(32);
    expect(canvases(c)).toBeGreaterThan(0);
    expect(c.querySelectorAll('canvas[data-probe="heatmap"]')).toHaveLength(0); // nothing is drawn run by run after the cut
  });

  // six committed cuts (an 8-slice order allows requiredCutCount + 2) make 22 pieces: the largest cut pizza the rules allow
  const SIX_CUTS: Array<[number, number]> = [[72.7, -6.7], [109.4, -21.4], [82.5, -12.5], [23.7, -17.9], [53, -16.2], [132.3, -16.3]];

  it("an extra-cut pizza with 22 pieces carries at most 44 sauce canvases, with or without oil (Codex P2)", () => {
    for (const other of ["pesto", "tomato-sauce"]) {
      const c = renderStage(log(100, (i) => (i % 2 ? "olive-oil" : other)), { cuts: SIX_CUTS });
      expect(c.querySelector(".pizza-pieces")!.getAttribute("data-piece-count")).toBe("22");
      expect(canvases(c)).toBe(44); // 22 pieces x one group (a heatmap and an overflow canvas)
    }
    const plain = renderStage(log(100, (i) => (i % 2 ? "pesto" : "tomato-sauce")), { cuts: SIX_CUTS });
    expect(canvases(plain)).toBe(44);
  });

  it("every cut count from 1 to 6 lines stays within the pizza-wide budget", () => {
    for (let n = 1; n <= 6; n += 1) {
      const c = renderStage(log(100, (i) => (i % 2 ? "olive-oil" : "tomato-sauce")), { cuts: SIX_CUTS.slice(0, n) });
      expect(canvases(c)).toBeLessThanOrEqual(44);
    }
  });

  it("without oil every piece needs one shared group: 2 canvases per piece", () => {
    const c = renderStage(log(100, (i) => (i % 2 ? "pesto" : "tomato-sauce")), { cuts: 8 });
    expect(canvases(c)).toBe(16);
  });

  it("the same pizza before the cut keeps its own per-run layers for the newest runs (unchanged)", () => {
    const c = renderStage(log(12, (i) => (i % 2 ? "pesto" : "tomato-sauce")));
    expect(c.querySelectorAll('canvas[data-probe="heatmap"]')).toHaveLength(8);
    expect(c.querySelectorAll('canvas[data-probe="merged"]')).toHaveLength(1);
  });
});

describe("the sauce canvas budget (Codex P2 on PR #494)", () => {
  const stampedLog = (n: number, kindOf: (i: number) => string): PizzaState => ({
    ...createEmptyPizza(),
    sauceIds: ["tomato-sauce", "pesto", "olive-oil"],
    sauceToken: 3,
    sauceDeposits: Array.from({ length: n }, (_, i) => ({ x: 20 + (i % 60), y: 40, amount: 0.02, ingredientId: kindOf(i) })),
  });
  const canvasCount = (c: HTMLElement) => c.querySelectorAll("canvas").length;

  it("at most 8 runs: every run has its own heatmap and overflow canvas and nothing is merged", () => {
    const c = renderStage(stampedLog(8, (i) => (i % 2 ? "pesto" : "tomato-sauce")));
    expect(c.querySelectorAll('canvas[data-probe="heatmap"]')).toHaveLength(8);
    expect(c.querySelectorAll('canvas[data-probe="merged"]')).toHaveLength(0);
  });

  it("100 alternating runs: the newest 8 stay separate, the rest share a few canvases", () => {
    const c = renderStage(stampedLog(100, (i) => (i % 2 ? "pesto" : "tomato-sauce")));
    expect(c.querySelectorAll('canvas[data-probe="heatmap"]')).toHaveLength(8);
    expect(c.querySelectorAll('canvas[data-probe="merged"]')).toHaveLength(1); // one plain stretch
    expect(canvasCount(c)).toBeLessThanOrEqual(24);
  });

  it("100 runs alternating oil and another sauce: still at most 24 canvases, and the oldest oil is baked into a plain group", () => {
    const c = renderStage(stampedLog(100, (i) => (i % 2 ? "olive-oil" : "tomato-sauce")));
    expect(canvasCount(c)).toBeLessThanOrEqual(24);
    const merged = [...c.querySelectorAll<HTMLElement>('canvas[data-probe="merged"]')];
    expect(merged.length).toBeLessThanOrEqual(4);
    expect(merged[0].dataset.baked).toBe("true");
  });

  it("an oil stretch inside a long history keeps the oil canvas treatment when the budget allows", () => {
    // 12 runs: tomato, then 3 oil, then 8 tomato/pesto alternating -> the older part is tomato / oil / ... within 4 groups
    const kinds = ["tomato-sauce", "olive-oil", "tomato-sauce", "olive-oil", ...Array.from({ length: 8 }, (_, i) => (i % 2 ? "pesto" : "tomato-sauce"))];
    const c = renderStage(stampedLog(12, (i) => kinds[i]));
    const merged = [...c.querySelectorAll<HTMLElement>('canvas[data-probe="merged"]')];
    expect(merged.map((m) => m.dataset.kinds)).toEqual(["tomato-sauce", "olive-oil", "tomato-sauce", "olive-oil"]);
    expect(merged.every((m) => m.dataset.baked === "false")).toBe(true);
    expect(merged.map((m) => m.className.includes("pizza-sauce-heatmap--oil"))).toEqual([false, true, false, true]);
  });
});
