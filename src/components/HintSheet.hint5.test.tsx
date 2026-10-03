import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { INGREDIENTS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { TECHNIQUES } from "../data/techniques";
import { KEY_FREE_RECIPES } from "../logic/testSupport/hintRoles";
import { buildHint5Ladder, hint5Presentation, requestHint5Rung, type Hint5Presentation } from "../logic/discovery/hint5Ladder";
import { buildSelectableHintModel } from "../logic/discovery/selectableHint";
import type { HintSheetView } from "../state/discoveryHint";
import { HintSheet } from "./HintSheet";

/** HintSheet.tsx `ALREADY_KNOWN` (module-private there). */
const ALREADY_KNOWN = "このヒントはもう知っていたよ！（Pitzは使っていないよ）";

/**
 * Discovery Hint 5.0 (Issue #292), H5-3: the ladder body of the hint sheet, rendered from the real H5-1
 * view model for all 25 targets. It is the DOM counterpart of the pure G6 / G15 / M3 gates:
 * - the same pre-purchase DOM for every target and every legacy fact set;
 * - no recipe, sub-topping or Technique identity in any text or attribute;
 * - the classification label only.
 */

afterEach(cleanup);

type Selectable = Extract<HintSheetView, { kind: "SELECTABLE" }>;
const selectable = (outcome: Selectable["outcome"] = null): Selectable =>
  ({ kind: "SELECTABLE", existenceText: "今の材料で、まだ見つけていないピザが作れそう！", presentation: {} as never, grandfatheredSteps: [], outcome, deduction: null }) as Selectable;

function renderLadder(hint5: Hint5Presentation, outcome: Selectable["outcome"] = null, onBuyHint5 = () => {}) {
  return render(<HintSheet view={selectable(outcome)} hint5={hint5} onUnlock={() => {}} onBuyHint5={onBuyHint5} onClose={() => {}} />);
}

const pres = (recipeId: string, stored: string[], pitzBalance = 100, legacyPurchases: Record<string, number> = {}) =>
  hint5Presentation({ recipeId, discoveredCount: 5, storedFactIds: stored, legacyPurchases, pitzBalance })!;

/** The ledger after buying `k` rungs in order (fresh save). */
function prefix(recipeId: string, k: number): string[] | null {
  let stored: string[] = [];
  for (let i = 1; i <= k; i += 1) {
    const r = requestHint5Rung({ recipeId, discoveredCount: 5, storedFactIds: stored, legacyPurchases: {}, expectedRungIndex: i, pitzBalance: 1000 });
    if (r.outcome !== "ANSWERED") return null;
    stored = [...stored, ...r.addFactIds];
  }
  return stored;
}

/** The dialog's pre-purchase surface without the player's own-name archive. */
function shape(container: HTMLElement): string {
  const dialog = container.querySelector('[role="dialog"]')!.cloneNode(true) as HTMLElement;
  dialog.querySelector(".hint-sheet__legacy")?.remove();
  // React's useId values differ per render; they carry no content.
  return dialog.innerHTML.replace(/(id|aria-labelledby|name)="[^"]*"/g, '$1="*"');
}

function surface(container: HTMLElement): string {
  const dialog = container.querySelector('[role="dialog"]') as HTMLElement;
  const attrs = [...dialog.querySelectorAll("*")].flatMap((el) => [...el.attributes].map((a) => `${a.name}=${a.value}`));
  return `${dialog.textContent}\n${attrs.join("\n")}`;
}

const TARGETS = RECIPES.filter((r) => r.id !== "margherita");

describe("Hint 5.0 ladder DOM: FREE LEAK (H5-INV-5) and M3", () => {
  it("before STRUCTURE, the rendered sheet is byte-identical for every target that reached the same rung", () => {
    // Keyed targets form one group; a key-free target (OD-D3-21) has only the rungs that apply, so it is
    // compared within its own sauce/cheese pattern. The absence of a rung is the accepted information.
    const has = (r: (typeof RECIPES)[number], category: string) => r.requiredIngredients.some((q) => INGREDIENTS.find((i) => i.id === q.ingredientId)?.category === category);
    const groupOf = (r: (typeof RECIPES)[number]) => (KEY_FREE_RECIPES.includes(r) ? `key-free:sauce=${has(r, "sauce")}:cheese=${has(r, "cheese")}` : "keyed");
    for (let k = 0; k <= 3; k += 1) {
      const groups = new Map<string, Set<string>>();
      for (const r of TARGETS) {
        if (k > buildHint5Ladder(r.id)!.rungs.findIndex((x) => x.kind === "STRUCTURE")) continue; // past STRUCTURE
        const shapes = groups.get(groupOf(r)) ?? new Set<string>();
        groups.set(groupOf(r), shapes);
        const stored = prefix(r.id, k);
        expect(stored, `${r.id} k=${k}`).not.toBeNull(); // round 6: no target stops before STRUCTURE
        const { container } = renderLadder(pres(r.id, stored!));
        shapes.add(k === 0 ? shape(container) : shape(container).replace(/<span class="hint-sheet__chips">.*?<\/span><\/li>/gs, "<chips/>"));
        // 「なし」 appears only on a bought rung: never in the offer.
        expect(container.querySelector(".hint-sheet__h5-next")!.textContent, `${r.id} k=${k}`).not.toContain("なし");
        cleanup();
      }
      for (const [group, shapes] of groups) expect(shapes.size, `after ${k} rungs, ${group}`).toBe(1);
    }
  });

  it("M3: every legacy fact set gives the same rendered sheet as a fresh save (only 「以前のヒント」 differs)", () => {
    for (const r of TARGETS) {
      const sellable = buildSelectableHintModel(r.id, { discoveredCount: 1 })!.purchasableFacts.map((f) => `ing:${f.ingredientId}`);
      const { container } = renderLadder(pres(r.id, []));
      const fresh = shape(container);
      cleanup();
      for (const [stored, legacy] of [[sellable, {}], [["meta:ingredient-total", "attr:family:meat"], {}], [[], { [r.id]: 4 }]] as const) {
        const { container: c } = renderLadder(pres(r.id, [...stored], 100, legacy));
        expect(shape(c), `${r.id} ${stored.join(",")}`).toBe(fresh);
        expect(c.textContent).not.toContain(ALREADY_KNOWN);
        cleanup();
      }
    }
  });

  it("「以前のヒント」 never repeats what the board shows (a ladder-bought total or name)", () => {
    const stored = prefix("hawaiian", 4)!;
    const view = { ...selectable(), deduction: { structureLines: ["このピザは全部で4種類の材料を使うよ"], attributeLines: [] } as never };
    const { container } = render(<HintSheet view={view} hint5={pres("hawaiian", stored)} onUnlock={() => {}} onClose={() => {}} />);
    expect(container.querySelector(".hint-sheet__legacy")).toBeNull();
    expect(container.textContent!.match(/全部で4種類/g)).toHaveLength(1);
  });

  it("「もう知っていた」 appears only with the post-request outcome", () => {
    const { container } = renderLadder(pres("hawaiian", ["h5:sauce"]), "HINT5_ALREADY_KNOWN");
    expect(container).toHaveTextContent(ALREADY_KNOWN);
    expect(container.querySelector(".hint-sheet__h5-next .hint-sheet__price")).toHaveTextContent("10 Pitz");
  });
});

describe("Hint 5.0 ladder DOM: disclosure boundary (H5-INV-1 / 3 / 4) and AC-1", () => {
  it("at every purchase state of every target: no recipe identity, no unbought ingredient, no sub-topping name / id / glyph, no Technique", () => {
    const techWords = TECHNIQUES.flatMap((t) => [t.nameJa, t.riddleJa]);
    for (const r of TARGETS) {
      const subs = new Set(buildHint5Ladder(r.id)!.rungs.filter((x) => x.kind === "SUB_CLASS").map((x) => x.subjectIds[0]));
      for (let k = 0; k <= 10; k += 1) {
        const stored = prefix(r.id, k);
        if (!stored) break;
        const { container } = renderLadder(pres(r.id, stored));
        const all = surface(container);
        const bought = new Set(stored.filter((s) => s.startsWith("ing:")).map((s) => s.slice(4)));
        expect(all).not.toContain(r.description);
        // A bought ingredient name may contain the recipe name (pepperoni = ペパロニ, pesto = 「ジェノベーゼソース」
        // for genovese). That is the ingredient the player paid for (P3), not the recipe identity.
        if (![...bought].some((id) => INGREDIENTS.find((i) => i.id === id)?.nameJa.includes(r.nameJa))) expect(all).not.toContain(r.nameJa);
        const boughtNames = INGREDIENTS.filter((i) => bought.has(i.id)).map((i) => i.nameJa);
        for (const ing of INGREDIENTS) {
          // 「トマト」 is inside the bought 「トマトソース」: a substring of a bought name is not a leak.
          if (bought.has(ing.id) || boughtNames.some((n) => n.includes(ing.nameJa))) continue;
          expect(all.includes(ing.nameJa), `${r.id} k=${k}: ${ing.nameJa}`).toBe(false);
        }
        for (const sub of subs) expect(all.includes(`=${sub}\n`) || all.endsWith(`=${sub}`), `${r.id}: ${sub} in an attribute`).toBe(false);
        for (const w of techWords) expect(all.includes(w), `${r.id}: ${w}`).toBe(false);
        cleanup();
      }
    }
  });

  it("AC-1: the last sub-topping of meat-lovers shows its classification (🥩 肉系), by label only", () => {
    const stored = prefix("meat-lovers", 7)!;
    const { container } = renderLadder(pres("meat-lovers", stored, 0));
    const rows = [...container.querySelectorAll('[data-hint5-rung="SUB_CLASS"]')].map((row) => row.textContent);
    expect(rows).toEqual(["サブトッピング①\u{1F969}肉系", "サブトッピング②\u{1F969}肉系", "サブトッピング③\u{1F969}肉系"]);
    expect(container).toHaveTextContent("ここまでのヒントで、推理してみよう！");
    expect(container.querySelector(".hint-sheet__h5-next")).toBeNull();
    for (const name of ["ベーコン", "ペパロニ", "ソーセージ"]) expect(container.textContent).not.toContain(name);
  });

  it("the CTA reports the offered rung index once; an empty CHEESE rung is offered like any other", () => {
    const onBuy = vi.fn();
    const { container } = renderLadder(pres("marinara", prefix("marinara", 1)!), null, onBuy);
    expect(container.querySelector(".hint-sheet__h5-next .hint-sheet__card-title")!.firstChild!.textContent).toBe("ヒント2: チーズ");
    const button = container.querySelector<HTMLButtonElement>(".hint-sheet__h5-next .hint-sheet__next")!;
    expect(button).toHaveTextContent("たずねる 10 Pitz");
    expect(container.textContent).not.toContain("なし");
    fireEvent.click(button);
    fireEvent.click(button);
    expect(onBuy).toHaveBeenCalledTimes(1);
    expect(onBuy).toHaveBeenCalledWith(2);
  });
});

describe("round 6: 「なし」 rows (OD-H5-P4-CHEESE / P4b) and fail closed", () => {
  it("after the purchase only: 「チーズ」 | 「なし」 (marinara) and 「キートッピング」 | 「なし」 (quattro-formaggi), with no glyph and no ingredient name", () => {
    for (const [id, k, kind, label] of [["marinara", 2, "CHEESE", "チーズ"], ["quattro-formaggi", 3, "KEY_TOPPING", "キートッピング"]] as const) {
      const before = renderLadder(pres(id, prefix(id, k - 1)!));
      expect(before.container.querySelector(".hint-sheet__chip--none"), id).toBeNull();
      expect(before.container.textContent, id).not.toContain("なし");
      cleanup();
      const { container } = renderLadder(pres(id, prefix(id, k)!));
      const row = container.querySelector(`[data-hint5-rung="${kind}"]`)!;
      expect(row.textContent, id).toBe(`${label}なし`);
      expect(row.querySelector(".hint-sheet__glyph"), id).toBeNull();
      expect(container.querySelectorAll(".hint-sheet__chip--none"), id).toHaveLength(1);
      cleanup();
    }
  });

  it("the whole quattro-formaggi ladder renders to the complete line (sauce, cheeses, key 「なし」, structure)", () => {
    const { container } = renderLadder(pres("quattro-formaggi", prefix("quattro-formaggi", 4)!, 0));
    expect([...container.querySelectorAll("[data-hint5-rung]")].map((r) => r.getAttribute("data-hint5-rung"))).toEqual(["SAUCE", "CHEESE", "KEY_TOPPING"]);
    expect(container).toHaveTextContent("ここまでのヒントで、推理してみよう！");
    expect(container.querySelector(".hint-sheet__h5-next")).toBeNull();
    expect(container.textContent).not.toMatch(/ソース(：)?なし|ソースを?使わない/);
  });

  it("fail closed: the ladder active but no ladder view (a target outside the ladder) offers nothing, and never the 材料 / 構成 / 特徴 body", () => {
    const onBuy = vi.fn();
    const { container } = render(<HintSheet view={selectable()} hint5={null} hint5Active onUnlock={() => {}} onBuySelectable={onBuy} onBuyHint5={onBuy} onClose={() => {}} />);
    expect(container.querySelector('[role="dialog"]')!.getAttribute("data-hint-ladder")).toBe("hint5-closed");
    // 閉じる + the (read-only) 試作ノート entry: nothing to buy.
    expect([...container.querySelectorAll("button")].map((b) => b.textContent)).toEqual([expect.stringContaining("試作ノートを見る"), "閉じる"]);
    // The existence caption (「今の材料で…」) is the only shared line; no family, price or request.
    expect(container.textContent!.replace("今の材料で、まだ見つけていないピザが作れそう！", "")).not.toMatch(/材料|構成|特徴|Pitz|ヒントをもらう/);
    expect(container).toHaveTextContent("このピザのヒントは今は出せないよ");
  });
});
