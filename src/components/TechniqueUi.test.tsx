import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { DexOverlay } from "./DexOverlay";
import { ResultPanel } from "./ResultPanel";
import { TechniqueReveal } from "./TechniqueReveal";
import { TECHNIQUES } from "../data/techniques";
import { RECIPE_DISCOVERY_CATALOG } from "../data/discoveryCatalog";
import type { RecipeDiscoveryTarget } from "../logic/discovery/matcher";
import { DEFAULT_IDENTITY_DIMENSIONS } from "../logic/discovery/signature";
import { techniqueDexViews } from "../logic/techniques/dexView";
import { productionTechniqueContext, type TechniqueRuntimeContext } from "../logic/techniques/runtime";
import { W1_ORDER } from "../logic/testSupport/branchingFixture";
import { discoveredDex } from "../state/testSupport/guidedRound";

/**
 * Cooking Techniques 1.0 TQ-1D: the two places a technique is shown -- the RESULT's technique stage and the Dex's
 * 調理法 section. A technique's name appears only after the technique was discovered; before that the Dex shows at
 * most 「？？？」 and the fixed riddle (and only once the affordance is open).
 */

afterEach(cleanup);

/** Production catalog + one synthetic tray recipe: no production recipe requires the tray yet (Square Dough E). */
const SYN_TRAY: RecipeDiscoveryTarget = {
  targetId: "syn:tray-pizza",
  recipeId: "syn-tray" as RecipeDiscoveryTarget["recipeId"],
  items: ["garlic", "mozzarella", "olive-oil", "tomato-sauce"],
  sauceBase: ["olive-oil", "tomato-sauce"],
  capabilities: [],
  identityDimensions: { ...DEFAULT_IDENTITY_DIMENSIONS, pan: "tray" },
  eligibility: { status: "ELIGIBLE" },
};
const TRAY_CONTEXT: TechniqueRuntimeContext = { ...productionTechniqueContext(), catalog: [...RECIPE_DISCOVERY_CATALOG, SYN_TRAY] };

const NAME = TECHNIQUES[0].nameJa; // 「ソースなし」
const RIDDLE = TECHNIQUES[0].riddleJa;

const baseResult = {
  completion: { status: "PASS" as const },
  score: { matchScore: 100, ingredientScore: 100, placementScore: 100, bakeScore: 100, total: 90, stars: 5 as const },
  bakeState: "perfect" as const,
  sauceScore: null,
  headingJa: "完成！",
  recipeNameJa: "オージーピザ",
  justDiscovered: true,
  justGotNewBest: false,
  pitzCredit: null,
  efficiencyCredit: null,
  onRetrySameRecipe: () => {},
  onBackToPizzaSelect: () => {},
};

describe("RESULT: the technique stage", () => {
  it("names the technique only because it was just discovered, as one status block", () => {
    const { container } = render(<TechniqueReveal techniqueIds={["no-sauce"]} />);
    const block = container.querySelector("[data-technique-reveal]");
    expect(block).toHaveAttribute("role", "status");
    expect(block).toHaveTextContent(`新しい調理法を発見！`);
    expect(block).toHaveTextContent(`「${NAME}」`);
    expect(container.querySelectorAll("[data-technique-reveal]")).toHaveLength(1);
  });

  it("renders nothing for no technique, an empty list or an unknown id", () => {
    for (const ids of [null, [], ["post-bake" as never]]) {
      const { container } = render(<TechniqueReveal techniqueIds={ids} />);
      expect(container).toBeEmptyDOMElement();
      cleanup();
    }
  });

  it("a NEW_DISCOVERY result shows the technique BEFORE the recipe banner (SSOT P5)", () => {
    const { container } = render(
      <ResultPanel {...baseResult} freeCook discovery={{ kind: "NEW_DISCOVERY", recipeId: "aussie", targetId: "aussie-pizzadb" }} techniqueReveal={["no-sauce"]} />,
    );
    const reveal = container.querySelector("[data-technique-reveal]")!;
    const banner = container.querySelector(".discovered-banner--new-pizza")!;
    expect(reveal).toBeTruthy();
    expect(banner).toBeTruthy();
    expect(reveal.compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("an ORIGINAL result (a sauce-free pizza that is no recipe) can reveal the technique alone, with no recipe", () => {
    const { container } = render(
      <ResultPanel {...baseResult} score={null} justDiscovered={false} freeCook discovery={{ kind: "ORIGINAL", outcome: { kind: "NO_MATCH" } } as never} techniqueReveal={["no-sauce"]} />,
    );
    expect(container.querySelector("[data-technique-reveal]")).toHaveTextContent(`「${NAME}」`);
    expect(container.querySelector(".discovered-banner--new-pizza")).toBeNull();
  });

  it("the result adds no 「ソース：なし」 row and no zero-point sauce row: a no-sauce result looks like any other result", () => {
    const { container } = render(
      <ResultPanel {...baseResult} freeCook discovery={{ kind: "NEW_DISCOVERY", recipeId: "aussie", targetId: "aussie-pizzadb" }} techniqueReveal={null} />,
    );
    expect(container.textContent).not.toMatch(/ソース\s*[：:]\s*なし|ソースなし|ソース不要/);
    // sauceScore null -> no sauce row at all (never a fabricated 0): the rows are 具材 / 配置 / 焼き only.
    const labels = [...container.querySelectorAll(".score-bar__label")].map((e) => e.textContent);
    expect(labels).toEqual(["具材", "配置", "焼き"]);
    expect(container.textContent).not.toContain(NAME);
  });
});

describe("Dex: the 調理法 section", () => {
  const props = (dex = discoveredDex(W1_ORDER.slice(0, 12))) => ({
    dex,
    newlyDiscoveredId: null,
    newBestRecipeId: null,
    onClose: () => {},
  });

  it("absent without any view (before the affordance opens) -- not even a heading", () => {
    const { container } = render(<DexOverlay {...props(discoveredDex(W1_ORDER.slice(0, 5)))} techniqueViews={techniqueDexViews([], discoveredDex(W1_ORDER.slice(0, 5)))} />);
    expect(container.querySelector("[data-dex-techniques]")).toBeNull();
    expect(container.textContent).not.toMatch(/調理法/);
  });

  it("undiscovered but open: only 「？？？」 and the riddle -- never the name", () => {
    const dex = discoveredDex(W1_ORDER.slice(0, 12));
    const { container } = render(<DexOverlay {...props(dex)} techniqueViews={techniqueDexViews([], dex)} />);
    const section = container.querySelector("[data-dex-techniques]")!;
    expect(section).toBeTruthy();
    const card = section.querySelector("[data-technique-state]")!;
    expect(card).toHaveAttribute("data-technique-state", "RIDDLE");
    expect(card).toHaveTextContent("？？？");
    expect(card).toHaveTextContent(RIDDLE);
    expect(section.textContent).not.toContain(NAME);
    expect(section.textContent).not.toMatch(/ソースなし|ソース不要|省/);
    // The whole Dex, attributes included, never carries the name or the id before discovery.
    const everything = `${container.textContent}|${[...container.querySelectorAll("*")].flatMap((e) => [...e.attributes].map((a) => a.value)).join("|")}`;
    expect(everything).not.toContain(NAME);
    expect(everything).not.toContain("no-sauce");
  });

  it("discovered: the name (and no riddle)", () => {
    const dex = discoveredDex(W1_ORDER.slice(0, 12));
    const { container } = render(<DexOverlay {...props(dex)} techniqueViews={techniqueDexViews(["no-sauce"], dex)} />);
    const card = container.querySelector("[data-dex-techniques] [data-technique-state]")!;
    expect(card).toHaveAttribute("data-technique-state", "DISCOVERED");
    expect(card).toHaveTextContent(NAME);
    expect(card.textContent).not.toContain(RIDDLE);
  });

  it("TRAY (Square Dough F2), undiscovered but open: only 「？？？」 and the approved riddle -- never the name, the description or the id", () => {
    const tray = TECHNIQUES.find((t) => t.id === "tray")!;
    const dex = discoveredDex(W1_ORDER.slice(0, 14));
    const views = techniqueDexViews([], dex, TRAY_CONTEXT).filter((v) => v.id === "tray");
    const { container } = render(<DexOverlay {...props(dex)} techniqueViews={views} />);
    const card = container.querySelector("[data-dex-techniques] [data-technique-state]")!;
    expect(card).toHaveAttribute("data-technique-state", "RIDDLE");
    expect(card).toHaveTextContent("？？？");
    expect(card).toHaveTextContent("丸くなくても、ピザは焼ける。四つの角まで生地を広げてみよう。");
    const everything = `${container.textContent}|${[...container.querySelectorAll("*")].flatMap((e) => [...e.attributes].map((a) => a.value)).join("|")}`;
    expect(everything).not.toContain(tray.nameJa);
    expect(everything).not.toContain(tray.descriptionJa!);
    expect(everything).not.toContain("tray");
  });

  it("TRAY discovered: the name and the approved description (and no riddle)", () => {
    const dex = discoveredDex(W1_ORDER.slice(0, 14));
    const views = techniqueDexViews(["tray"], dex, TRAY_CONTEXT).filter((v) => v.id === "tray");
    const { container } = render(<DexOverlay {...props(dex)} techniqueViews={views} />);
    const card = container.querySelector("[data-dex-techniques] [data-technique-state]")!;
    expect(card).toHaveAttribute("data-technique-state", "DISCOVERED");
    expect(card).toHaveTextContent("天板焼き");
    expect(card).toHaveTextContent("四角い天板に生地を広げて焼く調理法。指で押し広げ、四隅まで伸ばして形を整えよう。");
    expect(card.textContent).not.toContain("丸くなくても");
  });

  it("a NO_SAUCE card has no description paragraph", () => {
    const dex = discoveredDex(W1_ORDER.slice(0, 12));
    const { container } = render(<DexOverlay {...props(dex)} techniqueViews={techniqueDexViews(["no-sauce"], dex)} />);
    expect(container.querySelector(".dex-card__technique-desc")).toBeNull();
  });
});
