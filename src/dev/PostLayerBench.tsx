import { useState } from "react";
import { getRecipe } from "../data/recipes";
import { createIdealDoughShape } from "../logic/doughShape";
import { createCutState } from "../logic/cut/state";
import { createEmptyPizza, type PlacedTopping } from "../state/pizzaState";
import { PizzaStage } from "../components/PizzaStage";

/**
 * FINISH D2-2a (Issue #518): a DEV / Preview-only bench that draws one pizza with post-bake pieces at a chosen bake state, so the
 * separated layer can be checked on real pixels (src/main.tsx, `?dev=postlayer`). Same static env gate as the Inspector -- a
 * production build drops it. It shows one fixed pizza, never loads or writes the save, and is not reachable from the game.
 *
 * Query: `bake=raw|perfect|burnt|none` (default perfect), `post=0` (no post-bake pieces; the pre-bake-only baseline).
 */
export const POST_LAYER_BENCH_MARK = "post-layer-bench-v1";

const BAKE_VALUE = { raw: 20, perfect: 70, burnt: 95 } as const; // margherita's window is 60-80
export type BenchBake = keyof typeof BAKE_VALUE | "none";

const PRE: PlacedTopping[] = [
  { id: "pre-mozzarella-1", ingredientId: "mozzarella", x: 40, y: 45 },
  { id: "pre-mozzarella-2", ingredientId: "mozzarella", x: 62, y: 58 },
  { id: "pre-basil-1", ingredientId: "basil", x: 52, y: 70 },
];
const POST: PlacedTopping[] = [
  { id: "post-basil-1", ingredientId: "basil", x: 30, y: 32, stage: "post" },
  { id: "post-pepper-1", ingredientId: "bell-pepper", x: 66, y: 30, stage: "post" },
  { id: "post-tomato-1", ingredientId: "fresh-tomato", x: 50, y: 52, stage: "post" },
];

export function parseBench(search: string): { bake: BenchBake; post: boolean } {
  const params = new URLSearchParams(search);
  const bake = params.get("bake");
  return {
    bake: bake === "raw" || bake === "burnt" || bake === "none" ? bake : "perfect",
    post: params.get("post") !== "0",
  };
}

export function PostLayerBench({ search = window.location.search }: { search?: string }) {
  const { bake, post } = parseBench(search);
  const recipe = getRecipe("margherita")!;
  const [taps, setTaps] = useState<string[]>([]);
  const pizza = {
    ...createEmptyPizza(),
    doughShape: createIdealDoughShape(),
    toppings: post ? [...PRE, ...POST] : PRE,
    bakeResult: bake === "none" ? null : BAKE_VALUE[bake],
  };
  return (
    <main data-post-layer-bench={POST_LAYER_BENCH_MARK} style={{ maxWidth: 420, margin: "0 auto", padding: 8 }}>
      <p style={{ font: "12px monospace" }}>post-layer bench · bake={bake} · post={post ? 1 : 0}</p>
      <PizzaStage
        pizza={pizza}
        recipe={recipe}
        interactive
        activeIngredient={null}
        bakeProgress={pizza.bakeResult}
        placement={null}
        resultRevealed={false}
        referenceModeEnabled={false}
        resetToken={0}
        makingStepToken={0}
        makingStep="TOPPING"
        showDoughShape
        compact
        onTap={(x, y) => setTaps((t) => [...t, `${x.toFixed(1)},${y.toFixed(1)}`])}
        onDispenseProgress={() => {}}
        onDispenseCommit={() => {}}
        onDoughStretchProgress={() => {}}
        onDoughStretchCommit={() => {}}
        cutState={createCutState()}
        onAddCutLine={() => {}}
      />
      <p data-testid="bench-taps" style={{ font: "12px monospace" }}>{taps.length}:{taps[taps.length - 1] ?? ""}</p>
    </main>
  );
}
