import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { INGREDIENTS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import type { ScoreBreakdown } from "../logic/scoring";
import type { PitzCredit } from "../logic/pitzReward";
import { NEAR_MISS_COPY, type ResultNearMissLine } from "../state/resultNearMiss";
import { ResultPanel } from "./ResultPanel";

/**
 * Discovery Hint 2.0 (Issue #229, 229-C): the Free Cooking RESULT's one secondary "おしい" row and
 * its 「💡 ヒントを見る」 CTA -- where it appears, where it never does, and that the result's own
 * hierarchy is untouched.
 */

const score: ScoreBreakdown = { matchScore: 90, ingredientScore: 90, placementScore: 80, bakeScore: 90, total: 72, stars: 4 };
const pitz: PitzCredit = { baseReward: 20, multiplier: 1.2, earnedPitz: 24, discoveryBonusPitz: 0, balanceAfter: 124 } as PitzCredit;

function props(over: Record<string, unknown> = {}) {
  return {
    completion: { status: "PASS" as const },
    score: null as ScoreBreakdown | null,
    bakeState: "perfect" as const,
    sauceScore: null,
    headingJa: "いいできばえだね！",
    recipeNameJa: "ビスマルク",
    justDiscovered: false,
    justGotNewBest: false,
    pitzCredit: null as PitzCredit | null,
    freeCook: true,
    discovery: { kind: "ORIGINAL" as const, blockedTargetIds: [] },
    usedIngredientIds: ["tomato-sauce", "mozzarella"],
    onRetrySameRecipe: vi.fn(),
    onBackToPizzaSelect: vi.fn(),
    onShowHint: vi.fn(),
    ...over,
  };
}
const line = (kind: ResultNearMissLine["kind"]): ResultNearMissLine => ({
  kind,
  textJa: kind === "FAR" ? NEAR_MISS_COPY.FAR_KEY_UNUSED : NEAR_MISS_COPY[kind],
});
const row = () => document.querySelector(".result-near-miss");

afterEach(() => cleanup());

describe("ORIGINAL result", () => {
  it.each(["ADD_ONE", "REMOVE_ONE", "SAUCE_ONLY", "CLOSE", "FAR"] as const)("%s: the line and the hint CTA", (kind) => {
    const p = props({ nearMiss: line(kind) });
    render(<ResultPanel {...p} />);
    expect(screen.getByText(line(kind).textJa)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /ヒントを見る/ }));
    expect(p.onShowHint).toHaveBeenCalledTimes(1);
  });

  it("no near-miss line: the lead stays and the hint CTA is still offered", () => {
    render(<ResultPanel {...props()} />);
    expect(screen.getByText("図鑑にはない、あなただけのピザ！")).toBeInTheDocument();
    expect(row()?.querySelector(".result-near-miss__text")).toBeNull();
    expect(screen.getByRole("button", { name: /ヒントを見る/ })).toBeInTheDocument();
  });

  it("the row sits under the result (after the headline, before the note and the CTA bar)", () => {
    render(<ResultPanel {...props({ nearMiss: line("ADD_ONE") })} />);
    const order = [".result-panel__headline", ".result-near-miss", ".original-pizza__note", ".result-panel__actions"].map((sel) =>
      [...document.querySelectorAll(".result-panel *")].indexOf(document.querySelector(sel)!),
    );
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(order.every((i) => i >= 0)).toBe(true);
  });

  it("INCOMPLETE_MATCH: the new sauce-amount / bake wording, no recipe id in the DOM", () => {
    render(<ResultPanel {...props({ discovery: { kind: "INCOMPLETE_MATCH", recipeId: "funghi", targetId: "shipped:funghi" } })} />);
    expect(screen.getByText("図鑑のピザまであと少し…！ソースの量や焼き加減を見直してみよう。")).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain("funghi");
    expect(document.body.textContent).not.toContain("フンギ");
  });

  it("without onShowHint (not Free Cooking) there is no CTA", () => {
    render(<ResultPanel {...props({ onShowHint: undefined })} />);
    expect(screen.queryByRole("button", { name: /ヒントを見る/ })).not.toBeInTheDocument();
  });
});

describe("other results", () => {
  it("FAILED: no near-miss, no hint row", () => {
    render(
      <ResultPanel
        {...props({ completion: { status: "FAILED", reason: "UNDERBAKED", failures: [{ reason: "UNDERBAKED" }] }, nearMiss: line("ADD_ONE") })}
      />,
    );
    expect(row()).toBeNull();
    expect(screen.queryByText(NEAR_MISS_COPY.ADD_ONE)).not.toBeInTheDocument();
  });

  it("ALREADY_DISCOVERED with a d=1 line: one extra row after the known-pizza line; hierarchy intact", () => {
    render(
      <ResultPanel
        {...props({
          score,
          pitzCredit: pitz,
          discovery: { kind: "ALREADY_DISCOVERED", recipeId: "bismarck", targetId: "shipped:bismarck" },
          nearMiss: line("ADD_ONE"),
        })}
      />,
    );
    const all = [...document.querySelectorAll(".result-panel *")];
    const at = (sel: string) => all.indexOf(document.querySelector(sel)!);
    expect(screen.getByText("いいできばえだね！")).toBeInTheDocument();
    expect(at(".result-panel__stars")).toBeLessThan(at(".free-cook-known"));
    expect(at(".free-cook-known")).toBeLessThan(at(".result-near-miss"));
    expect(at(".result-near-miss")).toBeLessThan(at(".pitz-credit-summary"));
    expect(at(".pitz-credit-summary")).toBeLessThan(at(".result-panel__actions"));
    expect(screen.getByRole("button", { name: /ヒントを見る/ })).toBeInTheDocument();
  });

  it("ALREADY_DISCOVERED without a line (d>=2): no row, no CTA", () => {
    render(
      <ResultPanel {...props({ score, pitzCredit: pitz, discovery: { kind: "ALREADY_DISCOVERED", recipeId: "bismarck", targetId: "shipped:bismarck" } })} />,
    );
    expect(row()).toBeNull();
  });

  it("NEW_DISCOVERY: discovery-first layout, no near-miss row even if a line were passed", () => {
    render(
      <ResultPanel
        {...props({
          score,
          pitzCredit: pitz,
          discovery: { kind: "NEW_DISCOVERY", recipeId: "bismarck", targetId: "shipped:bismarck" },
          justDiscovered: true,
          nearMiss: line("ADD_ONE"),
        })}
      />,
    );
    expect(document.querySelector(".result-panel--discovery")).not.toBeNull();
    expect(row()).toBeNull();
  });
});

describe("anti-spoiler", () => {
  it("the row carries no recipe or ingredient identity (text, aria-*, data-*)", () => {
    for (const kind of ["ADD_ONE", "REMOVE_ONE", "SAUCE_ONLY", "CLOSE", "FAR"] as const) {
      render(<ResultPanel {...props({ nearMiss: line(kind), usedIngredientIds: [] })} />);
      const html = row()!.outerHTML;
      const text = row()!.textContent ?? "";
      for (const r of RECIPES) {
        expect(text).not.toContain(r.nameJa);
        expect(html).not.toContain(`"${r.id}"`);
      }
      for (const ing of INGREDIENTS) {
        expect(text).not.toContain(ing.nameJa);
        expect(html).not.toContain(ing.id);
      }
      expect(html).not.toMatch(/data-(?!testid)/);
      cleanup();
    }
  });
});
