/**
 * CS-4a harness (dev/test only; never part of the app build): renders the real production
 * `MakingStepTabs` with step lists taken from the URL, so a 7-tab strip can be measured without any
 * Production recipe having a FINISH step (Owner Decision: 7 tabs are verified on fixtures only).
 *
 *   ?pre=DOUGH,SAUCE,CHEESE,TOPPING&post=FINISH,CUT&step=SAUCE&phase=PREPARE
 *
 * `step` defaults to the first pre-bake step, `phase` to PREPARE. Tapping the (only enabled) next
 * tab advances like the 「次へ」 CTA would: pre-bake -> the bake -> the post-bake steps.
 */
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import "../../src/App.css";
import { MakingStepTabs } from "../../src/components/MakingStepTabs";
import type { MakingStep } from "../../src/state/gameReducer";

const params = new URLSearchParams(location.search);
const list = (key: string): MakingStep[] =>
  (params.get(key) ?? "").split(",").filter(Boolean) as MakingStep[];
const pre = list("pre");
const post = list("post");

type Phase = "PREPARE" | "BAKE" | "POST_BAKE";

export function Harness() {
  const [phase, setPhase] = useState<Phase>((params.get("phase") as Phase | null) ?? "PREPARE");
  const [step, setStep] = useState<MakingStep>((params.get("step") as MakingStep | null) ?? pre[0]);
  const advance = () => {
    if (phase === "PREPARE") {
      const i = pre.indexOf(step);
      if (i < pre.length - 1) setStep(pre[i + 1]);
    } else if (phase === "POST_BAKE") {
      const i = post.indexOf(step);
      if (i < post.length - 1) setStep(post[i + 1]);
    }
  };
  return (
    <div style={{ background: "#fbf4e6", paddingTop: 12, width: "100%" }}>
      <MakingStepTabs
        steps={pre}
        postSteps={post}
        currentStep={step}
        currentPhase={phase}
        nextReady
        onAdvance={advance}
      />
      <button
        type="button"
        data-testid="to-bake"
        onClick={() => setPhase("BAKE")}
      >
        bake
      </button>
      <button
        type="button"
        data-testid="to-post"
        onClick={() => {
          setPhase("POST_BAKE");
          setStep(post[0]);
        }}
      >
        post
      </button>
      <span data-testid="state">{`${phase}:${step}`}</span>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Harness />
  </StrictMode>,
);
