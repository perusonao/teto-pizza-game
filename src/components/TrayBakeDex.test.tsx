import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { DexOverlay } from "./DexOverlay";
import { TechniqueReveal } from "./TechniqueReveal";
import { TRAY_BAKE_DESCRIPTION_JA, TRAY_BAKE_RIDDLE_JA } from "../data/techniques";
import { techniqueDexViews } from "../logic/techniques/dexView";
import type { TechniqueRuntimeContext } from "../logic/techniques/runtime";
import { W1_ORDER } from "../logic/testSupport/branchingFixture";
import { discoveredDex } from "../state/testSupport/guidedRound";

/** Square Dough F2: the Dex 調理法 card and the RESULT technique stage for 天板焼き (injected context; inert in production). */

afterEach(cleanup);

const ctx: TechniqueRuntimeContext = {
  catalog: [{ recipeId: "syn-tray", items: ["garlic"], sauceBase: ["tomato-sauce"], identityDimensions: { pan: "tray" } as never }],
  materialStep: () => 3,
  countsTowardLadder: () => true,
};
const dex = discoveredDex(W1_ORDER.slice(0, 5));
const props = {
  dex,
  newlyDiscoveredId: null,
  newBestRecipeId: null,
  onClose: () => {},
};
const everything = (c: HTMLElement) => `${c.textContent}|${[...c.querySelectorAll("*")].flatMap((e) => [...e.attributes].map((a) => a.value)).join("|")}`;

describe("Dex: 天板焼き", () => {
  it("open but undiscovered: 「？？？」 and the riddle; neither the name, the description nor the id anywhere", () => {
    const { container } = render(<DexOverlay {...props} techniqueViews={techniqueDexViews([], dex, ctx).filter((v) => v.id === "tray-bake")} />);
    const card = container.querySelector("[data-technique-state]")!;
    expect(card).toHaveAttribute("data-technique-state", "RIDDLE");
    expect(card).toHaveTextContent("？？？");
    expect(card).toHaveTextContent(TRAY_BAKE_RIDDLE_JA);
    const all = everything(container);
    expect(all).not.toContain("天板焼き");
    expect(all).not.toContain("tray");
    expect(all).not.toContain(TRAY_BAKE_DESCRIPTION_JA);
  });

  it("discovered: name and description, no riddle", () => {
    const { container } = render(<DexOverlay {...props} techniqueViews={techniqueDexViews(["tray-bake"], dex, ctx).filter((v) => v.id === "tray-bake")} />);
    const card = container.querySelector("[data-technique-state]")!;
    expect(card).toHaveAttribute("data-technique-state", "DISCOVERED");
    expect(card).toHaveTextContent("天板焼き");
    expect(card).toHaveTextContent(TRAY_BAKE_DESCRIPTION_JA);
    expect(card.textContent).not.toContain(TRAY_BAKE_RIDDLE_JA);
  });

  it("not open (production, no requiring recipe): no 調理法 section about it at all", () => {
    const { container } = render(<DexOverlay {...props} techniqueViews={techniqueDexViews([], dex)} />);
    expect(everything(container)).not.toMatch(/天板|tray|四つの角/);
  });
});

describe("RESULT technique stage", () => {
  it("names 天板焼き only when just discovered", () => {
    const { container } = render(<TechniqueReveal techniqueIds={["tray-bake"]} />);
    expect(container.querySelector("[data-technique-reveal]")).toHaveTextContent("「天板焼き」");
    cleanup();
    expect(render(<TechniqueReveal techniqueIds={null} />).container).toBeEmptyDOMElement();
  });
});
