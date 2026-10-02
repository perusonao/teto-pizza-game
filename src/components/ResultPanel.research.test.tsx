import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { RECIPES } from "../data/recipes";
import type { DiscoveryOutcome } from "../logic/discovery/matcher";
import { postDiscoveryPrimary } from "../logic/discovery/postDiscoveryPrimary";
import { NEAR_MISS_COPY } from "../state/resultNearMiss";
import { ResultPanel, RESEARCH_ORIGINAL_LEAD_COPY } from "./ResultPanel";

/**
 * Discovery 3.0 #346 S4: the Research ORIGINAL result and the post-discovery primary CTA. The Research ORIGINAL
 * card is one string for every original kind and carries no right/wrong, count, distance or near/far feedback.
 */
const HIDDEN = RECIPES.find((r) => r.id === "quattro-formaggi")!;
const ORDINARY: DiscoveryOutcome = { kind: "ORIGINAL", blockedTargetIds: [] };
const AMBIGUOUS: DiscoveryOutcome = { kind: "AMBIGUOUS", targetIds: ["shipped:quattro-formaggi", "shipped:twin"] };
const INCOMPLETE: DiscoveryOutcome = { kind: "INCOMPLETE_MATCH", recipeId: HIDDEN.id, targetId: "shipped:quattro-formaggi" };

const handlers = () => ({
  onRetrySameRecipe: vi.fn(),
  onBackToPizzaSelect: vi.fn(),
  onShowHint: vi.fn(),
  onOpenAttemptLog: vi.fn(),
});

function original(discovery: DiscoveryOutcome, props: Partial<Parameters<typeof ResultPanel>[0]> = {}) {
  cleanup();
  const h = handlers();
  const { container } = render(
    <ResultPanel
      completion={{ status: "PASS" }}
      score={null}
      bakeState="perfect"
      sauceScore={null}
      headingJa="x"
      recipeNameJa="ROUND-SENTINEL"
      justDiscovered={false}
      justGotNewBest={false}
      pitzCredit={null}
      freeCook
      discovery={discovery}
      usedIngredientIds={["tomato-sauce", "chicken"]}
      researchLabelJa="？？？ピザ ①"
      {...h}
      {...props}
    />,
  );
  return { html: container.innerHTML, ...h };
}

afterEach(() => cleanup());

describe("Research ORIGINAL copy", () => {
  it("heading + lead are the Research contract, and the context names the anonymous target", () => {
    original(ORDINARY);
    expect(screen.getByText("🧪 オリジナルピザ")).toBeInTheDocument();
    expect(screen.getByText(RESEARCH_ORIGINAL_LEAD_COPY)).toBeInTheDocument();
    expect(RESEARCH_ORIGINAL_LEAD_COPY).toBe("まだ新しいレシピは見つかっていません");
    expect(screen.getByText(/研究中 ？？？ピザ ①/)).toBeInTheDocument();
  });

  it("ORDINARY / AMBIGUOUS / INCOMPLETE_MATCH render byte-identically (no identity or correctness feedback)", () => {
    const o = original(ORDINARY).html;
    expect(original(AMBIGUOUS).html).toBe(o);
    expect(original(INCOMPLETE).html).toBe(o);
  });

  it("never says right/wrong, counts, distance or near/far, and never carries a recipe identity", () => {
    const dom = original(INCOMPLETE).html;
    expect(dom).not.toMatch(/一致しません|正解|不正解|✓|✕|足りない|間違|残り|あと[0-9０-９]|おしい|近づ|別の組み合わせ|新しく入荷/);
    expect(dom).not.toContain(HIDDEN.id);
    expect(dom).not.toContain(HIDDEN.nameJa);
    expect(dom).not.toContain("INCOMPLETE");
    expect(dom).not.toMatch(/data-(kind|outcome|candidate|target)/i);
  });

  it("a near-miss line handed in is not rendered while a Research Target is set", () => {
    const { html } = original(ORDINARY, { nearMiss: { kind: "ADD_ONE", textJa: NEAR_MISS_COPY.ADD_ONE } });
    expect(html).not.toContain(NEAR_MISS_COPY.ADD_ONE);
    expect(html).toBe(original(ORDINARY).html);
  });

  it("without a Research Target the card is exactly the previous one", () => {
    original(ORDINARY, { researchLabelJa: null });
    expect(screen.getByText(/オリジナルピザ完成！/)).toBeInTheDocument();
    expect(screen.queryByText(RESEARCH_ORIGINAL_LEAD_COPY)).toBeNull();
    expect(screen.queryByRole("button", { name: /試作ノート/ })).toBeNull();
  });
});

describe("Research ORIGINAL actions", () => {
  it("もう一度試す / 試作ノート / ヒント are all reachable and wired", () => {
    const h = original(ORDINARY);
    fireEvent.click(screen.getByRole("button", { name: "もう一度試す" }));
    expect(h.onRetrySameRecipe).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /試作ノート/ }));
    expect(h.onOpenAttemptLog).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /ヒント/ }));
    expect(h.onShowHint).toHaveBeenCalledTimes(1);
  });
});

describe("post-discovery primary CTA on a NEW_DISCOVERY result", () => {
  const NEW: DiscoveryOutcome = { kind: "NEW_DISCOVERY", recipeId: "pesto-pollo" } as DiscoveryOutcome;
  function discovered(primary: ReturnType<typeof postDiscoveryPrimary> | null) {
    cleanup();
    const cb = { onOpenDex: vi.fn(), onOpenShop: vi.fn(), onResearchNext: vi.fn() };
    render(
      <ResultPanel
        completion={{ status: "PASS" }}
        score={{ total: 80, stars: 4, matchScore: 80, ingredientScore: 80, placementScore: 80, bakeScore: 80 } as never}
        bakeState="perfect"
        sauceScore={80}
        headingJa="x"
        recipeNameJa="ピザX"
        justDiscovered
        justGotNewBest={false}
        pitzCredit={null}
        freeCook
        discovery={NEW}
        onRetrySameRecipe={vi.fn()}
        onBackToPizzaSelect={vi.fn()}
        postDiscovery={primary}
        {...cb}
      />,
    );
    return cb;
  }

  it("F: research remains -> 「次のピザを研究する」 starts the one entry (or returns to the Dex for 2+)", () => {
    const one = discovered(postDiscoveryPrimary({ researchableEntryIds: ["e1"], newMaterialAvailable: true }));
    fireEvent.click(screen.getByRole("button", { name: "🔎 次のピザを研究する" }));
    expect(one.onResearchNext).toHaveBeenCalledWith("e1");
    expect(screen.queryByRole("button", { name: "📖 図鑑を見る" })).toBeNull();
    const many = discovered(postDiscoveryPrimary({ researchableEntryIds: ["e1", "e2"], newMaterialAvailable: false }));
    fireEvent.click(screen.getByRole("button", { name: "🔎 次のピザを研究する" }));
    expect(many.onResearchNext).toHaveBeenCalledWith(null);
  });

  it("G: no research, new material -> 「新しい食材を見る」 opens the Shop", () => {
    const cb = discovered(postDiscoveryPrimary({ researchableEntryIds: [], newMaterialAvailable: true }));
    fireEvent.click(screen.getByRole("button", { name: "🛒 新しい食材を見る" }));
    expect(cb.onOpenShop).toHaveBeenCalledTimes(1);
  });

  it("H: neither -> 「図鑑を見る」 opens the Dex", () => {
    const cb = discovered(postDiscoveryPrimary({ researchableEntryIds: [], newMaterialAvailable: false }));
    fireEvent.click(screen.getByRole("button", { name: "📖 図鑑を見る" }));
    expect(cb.onOpenDex).toHaveBeenCalledTimes(1);
  });

  it("no count / remaining wording on any of the three", () => {
    for (const p of [
      postDiscoveryPrimary({ researchableEntryIds: ["e1", "e2"], newMaterialAvailable: false }),
      postDiscoveryPrimary({ researchableEntryIds: [], newMaterialAvailable: true }),
      postDiscoveryPrimary({ researchableEntryIds: [], newMaterialAvailable: false }),
    ]) {
      discovered(p);
      const row = document.querySelector(".dex-registration-row__cta") as HTMLElement;
      expect(row.textContent).not.toMatch(/[0-9０-９]|残り|あと|全部|すべて/);
    }
  });
});
