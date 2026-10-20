/**
 * FINISH D2-2b harness (dev/test only; never part of the app build): the real production `PizzaStage` inside the real cooking
 * skeleton (`.app-frame > .game-screen.game-screen--cooking`: header 56 / tabs 44 / order-card 78 (TOPPING) or 44 (CUT) / stage /
 * dock 132 or cut-readout 24 + action-row 70 -- the block heights are the ones measured in the running game at 390x844 and
 * 360x800), with a post-bake piece row so the separated layer can be verified before FINISH exists in GameScreen (D2-2).
 *
 *   ?bake=none|raw|perfect|burnt  &post=0|1  &step=TOPPING|CUT|RESULT (RESULT: no making step, resultCompact, `&cuts=0..3` committed rim-to-rim cuts at 0 / 60 / 120 degrees)  &pan=square (Preview / DEV pan override)  &onguide=1 (extra pieces on the cut guide lines)
 *
 * Controls in the dock change the same things; `window.__hv` exposes them for the scripted verification and the video.
 */
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import "../../src/App.css";
import { getRecipe } from "../../src/data/recipes";
import { createIdealDoughShape } from "../../src/logic/doughShape";
import { addCutLine, createCutState, resetCutState } from "../../src/logic/cut/state";
import type { CutLine } from "../../src/logic/cut/types";
import { DOUGH_CENTER, DOUGH_RADIUS } from "../../src/logic/pizzaCoordinates";
import { createEmptyPizza, type PlacedTopping } from "../../src/state/pizzaState";
import { PizzaStage } from "../../src/components/PizzaStage";

const params = new URLSearchParams(location.search);
const BAKE_VALUE = { raw: 20, perfect: 70, burnt: 95 } as const;
type Bake = keyof typeof BAKE_VALUE | "none";
type Step = "TOPPING" | "CUT" | "RESULT";

/** the same three ingredients twice: a pre-bake row (y 66) and a post-bake row (y 30), so one crop compares them */
const PRE: PlacedTopping[] = [
  { id: "pre-basil", ingredientId: "basil", x: 26, y: 66 },
  { id: "pre-tomato", ingredientId: "fresh-tomato", x: 48, y: 70 },
  { id: "pre-pepper", ingredientId: "bell-pepper", x: 70, y: 66 },
  { id: "pre-mozz-1", ingredientId: "mozzarella", x: 38, y: 50 },
  { id: "pre-mozz-2", ingredientId: "mozzarella", x: 62, y: 50 },
];
const POST: PlacedTopping[] = [
  { id: "post-basil", ingredientId: "basil", x: 26, y: 30, stage: "post" },
  { id: "post-tomato", ingredientId: "fresh-tomato", x: 48, y: 28, stage: "post" },
  { id: "post-pepper", ingredientId: "bell-pepper", x: 70, y: 30, stage: "post" },
];

/** `?onguide=1`: three more post pieces ON the CUT guide lines (0 / 60 / 120 degrees through the centre) and on the centre marker */
const ON_GUIDE: PlacedTopping[] = [
  { id: "post-g-basil", ingredientId: "basil", x: 40, y: 33, stage: "post" },
  { id: "post-g-pepper", ingredientId: "bell-pepper", x: 60, y: 33, stage: "post" },
  { id: "post-g-tomato", ingredientId: "fresh-tomato", x: 50, y: 50, stage: "post" },
];

/** a rim-to-rim cut through the centre at `angleDeg` (dough-percent), as a finished CUT leaves it */
function throughCut(angleDeg: number): CutLine {
  const a = (angleDeg * Math.PI) / 180;
  const start = { x: DOUGH_CENTER - Math.cos(a) * DOUGH_RADIUS, y: DOUGH_CENTER - Math.sin(a) * DOUGH_RADIUS };
  const end = { x: DOUGH_CENTER + Math.cos(a) * DOUGH_RADIUS, y: DOUGH_CENTER + Math.sin(a) * DOUGH_RADIUS };
  return { start, end, path: [start, end] };
}

declare global {
  interface Window {
    __hv: { setBake: (b: Bake) => void; setPost: (p: boolean) => void; setStep: (s: Step) => void; setCaption: (c: string) => void; reset: () => void; taps: () => string[] };
  }
}

function Harness() {
  const [bake, setBake] = useState<Bake>((params.get("bake") as Bake | null) ?? "none");
  const [post, setPost] = useState(params.get("post") !== "0");
  const [step, setStep] = useState<Step>(params.get("step") === "CUT" ? "CUT" : params.get("step") === "RESULT" ? "RESULT" : "TOPPING");
  const [cut, setCut] = useState(() =>
    [0, 60, 120].slice(0, step === "RESULT" ? Number(params.get("cuts") ?? 0) : 0).reduce((c, deg) => addCutLine(c, throughCut(deg)), createCutState()),
  );
  const [caption, setCaption] = useState("");
  const [taps, setTaps] = useState<string[]>([]);
  window.__hv = {
    setBake, setPost, setStep, setCaption,
    reset: () => setCut((c) => resetCutState(c)),
    taps: () => taps,
  };
  const recipe = getRecipe("margherita")!;
  const pizza = {
    ...createEmptyPizza(),
    doughShape: createIdealDoughShape(),
    toppings: post ? [...PRE, ...POST, ...(params.get("onguide") === "1" ? ON_GUIDE : [])] : PRE,
    bakeResult: bake === "none" ? null : BAKE_VALUE[bake],
  };
  const cutting = step === "CUT";
  const btn = (label: string, on: () => void, active = false) => (
    <button type="button" onClick={on} data-active={active} style={{ font: "600 12px sans-serif", padding: "6px 8px", minHeight: 32, margin: 2, border: "1px solid #8a6a3a", borderRadius: 8, background: active ? "#f0b552" : "#fff6e0" }}>
      {label}
    </button>
  );
  return (
    <div className="app-frame">
      <div className="game-screen game-screen--cooking" data-testid="hv-screen">
        <header className="app-header" style={{ height: 56, boxSizing: "border-box" }}>
          <span style={{ font: "700 13px sans-serif" }}>D2-2b HV harness · {step} · bake={bake} · post={post ? "on" : "off"}</span>
        </header>
        <div className="making-step-tabs" style={{ height: 44, boxSizing: "border-box" }} />
        <div className="order-card" style={{ height: cutting ? 44 : 78, boxSizing: "border-box", padding: "4px 12px", font: "12px sans-serif" }} data-testid="hv-caption">
          {caption}
        </div>
        <PizzaStage
          pizza={pizza}
          recipe={recipe}
          interactive={step !== "RESULT"}
          activeIngredient={null}
          bakeProgress={pizza.bakeResult}
          placement={null}
          resultRevealed={false}
          referenceModeEnabled={false}
          resetToken={0}
          makingStepToken={0}
          makingStep={cutting ? "CUT" : "TOPPING"}
          resultCompact={step === "RESULT"}
          showDoughShape
          roomy={cutting}
          compact={!cutting && step !== "RESULT"}
          onTap={(x, y) => setTaps((t) => [...t, `${x.toFixed(1)},${y.toFixed(1)}`])}
          onDispenseProgress={() => {}}
          onDispenseCommit={() => {}}
          onDoughStretchProgress={() => {}}
          onDoughStretchCommit={() => {}}
          cutState={cut}
          onAddCutLine={(line: CutLine) => setCut((c) => addCutLine(c, line))}
        />
        {cutting ? (
          <div className="cut-progress-readout" style={{ height: 24, boxSizing: "border-box", font: "12px sans-serif", textAlign: "center" }}>{cut.lines.length} 本</div>
        ) : (
          <div className="prepare-dock" style={{ height: 132, boxSizing: "border-box", padding: 4 }}>
            <div>
              {btn("焼成なし", () => setBake("none"), bake === "none")}
              {btn("生焼け", () => setBake("raw"), bake === "raw")}
              {btn("ジャスト", () => setBake("perfect"), bake === "perfect")}
              {btn("焦げ", () => setBake("burnt"), bake === "burnt")}
            </div>
            <div>
              {btn(post ? "後乗せ: あり" : "後乗せ: なし", () => setPost((p) => !p), post)}
              {btn("切り直し", () => setCut((c) => resetCutState(c)))}
            </div>
            <span data-testid="hv-taps" style={{ font: "11px monospace" }}>{taps.length}:{taps[taps.length - 1] ?? ""}</span>
          </div>
        )}
        <div className="action-row prepare-bake-bar" style={{ height: 70, boxSizing: "border-box", padding: 4 }}>
          {cutting && (
            <>
              {btn("焼成なし", () => setBake("none"), bake === "none")}
              {btn("生焼け", () => setBake("raw"), bake === "raw")}
              {btn("ジャスト", () => setBake("perfect"), bake === "perfect")}
              {btn("焦げ", () => setBake("burnt"), bake === "burnt")}
              {btn("切り直し", () => setCut((c) => resetCutState(c)))}
            </>
          )}
          {btn(cutting ? "TOPPING へ" : "CUT へ", () => setStep(cutting ? "TOPPING" : "CUT"))}
          {cutting && <span data-testid="hv-taps" style={{ font: "11px monospace" }}>{taps.length}</span>}
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
);
