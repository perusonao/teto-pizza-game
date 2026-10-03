import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { DISCOVERY_LADDER } from "../data/discoveryLadder";
import { STARTER_INGREDIENT_IDS } from "../data/ingredients";
import { RECIPES } from "../data/recipes";
import { deriveResearchEntries } from "../logic/discovery/researchEntry";
import { HintSheet } from "../components/HintSheet";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "./gameReducer";
import {
  hint5SheetView,
  hintSheetView,
  needsResearchTargetChoice,
  purchaseSelectableHintFact,
  requestDeductionHintFact,
  requestHint5RungFact,
  resolveHintSession,
  unlockNextHint,
} from "./discoveryHint";
import { discoveredDex } from "./testSupport/guidedRound";

/**
 * #353 (Owner Option B): with 2+ REGISTERED Research Entries and no valid Research Target the system never picks a
 * recipe for the player (no legacy sticky / purchase / session pick); the player's own Dex choice still does.
 * Production data only: ladder step 12 = 2 entries (pizza-portuguesa + brazilian-calabresa), step 25 = 1 entry.
 */

afterEach(cleanup);

const act = (s: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, s);
const ladderOwned = (step: number) => [
  ...STARTER_INGREDIENT_IDS,
  ...DISCOVERY_LADDER.steps.filter((s) => s.step <= step).flatMap((s) => s.ingredientIds),
];
const keysBefore = (step: number) => ["margherita", ...DISCOVERY_LADDER.steps.filter((s) => s.step < step).map((s) => s.keyRecipeId)];

function save(step: number, extraDiscovered: readonly string[] = [], over: Partial<GameState> = {}, stock = 10): GameState {
  const owned = ladderOwned(step);
  const base = createInitialGameState(discoveredDex([...keysBefore(step), ...extraDiscovered]), owned, 1000);
  return { ...base, inventory: Object.fromEntries(owned.map((id) => [id, stock])), ...over };
}

const multi = (over: Partial<GameState> = {}, stock?: number) => save(12, [], over, stock);
const single = (over: Partial<GameState> = {}) => save(25, ["brazilian-calabresa"], over);
const entryIds = (s: GameState) => deriveResearchEntries(s).entries.map((e) => e.recipeId);
const [A, B] = entryIds(multi());
const BOUGHT = { discoveryHintFacts: { [A]: ["ing:tomato-sauce"] } } as const;
const startFree = (s: GameState, researchTargetId?: string) => act(s, { type: "START_FREE_COOK", researchTargetId });

describe("multi-entry + targetless + bought facts: no implicit recipe", () => {
  it("fixture: two registered entries, facts bought on one of them", () => {
    expect(entryIds(multi())).toHaveLength(2);
    expect(multi(BOUGHT).discoveryHintFacts[A]).toEqual(["ing:tomato-sauce"]);
  });

  it("legacy purchased level + facts + a revealed / bought session never pick a recipe", () => {
    for (const over of [
      BOUGHT,
      { discoveryHintPurchases: { [B]: 2 } },
      { hintSession: { targetId: A, revealedIndex: 2 } },
      { ...BOUGHT, hintSession: { targetId: A, revealedIndex: 0 } },
    ] as Partial<GameState>[]) {
      const s = multi(over);
      expect(needsResearchTargetChoice(s)).toBe(true);
      expect(resolveHintSession(s)).toBeNull();
      expect(hintSheetView(s)).toEqual({ kind: "CHOOSE_RESEARCH" });
    }
  });

  it("HOME start + the sheet: no session and no recipe-specific view (SHOW_HINT)", () => {
    const opened = act(startFree(multi(BOUGHT)), { type: "SHOW_HINT" });
    expect(opened.hintSession).toBeNull();
    expect(opened.researchTargetId).toBeNull();
    expect(hintSheetView(opened)).toEqual({ kind: "CHOOSE_RESEARCH" });
    expect(hint5SheetView(opened)).toBeNull();
  });

  it("a new start (HOME) drops a Hint session carried from an earlier round, even a Dex-pinned one: it is not this round's choice", () => {
    for (const hintSession of [
      { targetId: A, revealedIndex: 1 },
      { targetId: A, revealedIndex: 0, fromDex: true },
    ]) {
      const carried = startFree(multi({ ...BOUGHT, hintSession }));
      expect(carried.hintSession).toBeNull();
      expect(act(carried, { type: "SHOW_HINT" }).hintSession).toBeNull();
      expect(hintSheetView(carried)).toEqual({ kind: "CHOOSE_RESEARCH" });
    }
  });

  it("reload: a state rebuilt from the saved facts alone behaves the same, and the facts are kept", () => {
    const fresh = multi();
    const reloaded = createInitialGameState(fresh.dex, ladderOwned(12), 1000, fresh.inventory, [], [], {}, BOUGHT.discoveryHintFacts);
    expect(reloaded.researchTargetId).toBeNull();
    const withFacts = startFree(reloaded);
    const opened = act(withFacts, { type: "SHOW_HINT" });
    expect(hintSheetView(opened)).toEqual({ kind: "CHOOSE_RESEARCH" });
    expect(opened.discoveryHintFacts).toEqual(BOUGHT.discoveryHintFacts);
  });

  it("stock 0 does not change the count: the entries still exist, so the choice is still asked", () => {
    const s = multi(BOUGHT, 0);
    expect(entryIds(s)).toHaveLength(2);
    expect(needsResearchTargetChoice(s)).toBe(true);
  });
});

describe("nothing is bought or changed while the choice is open", () => {
  const open = () => act(startFree(multi(BOUGHT)), { type: "SHOW_HINT" });

  it("every purchase / request path is refused: no Pitz, no facts, no state change", () => {
    const s = open();
    expect(purchaseSelectableHintFact(s, "sauce", 0)).toBeNull();
    expect(requestDeductionHintFact(s, "structure", 0, true)).toBeNull();
    expect(requestDeductionHintFact(s, "attribute", 0, true)).toBeNull();
    expect(requestHint5RungFact(s, 0, true)).toBeNull();
    expect(unlockNextHint(s, 1)).toBeNull();
    const after = act(
      s,
      { type: "PURCHASE_HINT5_RUNG", expectedRungIndex: 0 },
      { type: "PURCHASE_SELECTABLE_HINT", preference: "sauce", expectedPaidCount: 0 },
      { type: "PURCHASE_SELECTABLE_HINT", preference: "sauce", expectedPaidCount: 0, family: "structure" },
      { type: "PURCHASE_DISCOVERY_HINT", level: 1 },
    );
    expect(after.pitzBalance).toBe(s.pitzBalance);
    expect(after.discoveryHintFacts).toEqual(s.discoveryHintFacts);
    expect(after.discoveryHintPurchases).toEqual(s.discoveryHintPurchases);
  });
});

describe("explicit Dex selection is the player's choice", () => {
  it("START_FREE_COOK { researchTargetId }: that entry is the target; its bought facts show with no charge", () => {
    const s = startFree(multi(BOUGHT), A);
    expect(s.researchTargetId).toBe(A);
    expect(needsResearchTargetChoice(s)).toBe(false);
    const opened = act(s, { type: "SHOW_HINT" });
    expect(opened.hintSession?.targetId).toBe(A);
    expect(hintSheetView(opened).kind).toBe("SELECTABLE");
    expect(opened.pitzBalance).toBe(s.pitzBalance);
    expect(opened.discoveryHintFacts).toEqual(BOUGHT.discoveryHintFacts);
  });

  it("choosing the other entry shows that entry only; the first one's facts stay saved but unshown", () => {
    const s = act(startFree(multi(BOUGHT), B), { type: "SHOW_HINT" });
    expect(s.hintSession?.targetId).toBe(B);
    expect(s.discoveryHintFacts[A]).toEqual(["ing:tomato-sauce"]);
    expect(s.discoveryHintFacts[B] ?? []).toEqual([]);
  });

  it("a Dex card's Hint pin (SHOW_HINT { pinnedRecipeId }) is an explicit choice: its recipe, over a bought one; it keeps working on reopen / retry", () => {
    const s = act(startFree(multi(BOUGHT)), { type: "SHOW_HINT", pinnedRecipeId: B });
    expect(s.hintSession).toMatchObject({ targetId: B, fromDex: true });
    expect(hintSheetView(s).kind).toBe("SELECTABLE");
    expect(s.discoveryHintFacts[A]).toEqual(["ing:tomato-sauce"]);
    expect(act(s, { type: "CLOSE_HINT" }, { type: "SHOW_HINT" }).hintSession?.targetId).toBe(B);
  });

  it("a stale / unregistered / empty pin is no choice", () => {
    for (const pin of ["margherita", "no-such-recipe", ""]) {
      const s = act(startFree(multi(BOUGHT)), { type: "SHOW_HINT", pinnedRecipeId: pin });
      expect(s.researchTargetId, pin).toBeNull();
      expect(s.hintSession, pin).toBeNull();
    }
  });

  it("a target that is no longer valid (not cookable) is treated as none, not as a pick", () => {
    const s = multi({ ...BOUGHT, researchTargetId: A }, 0);
    expect(needsResearchTargetChoice(s)).toBe(true);
  });
});

describe("unchanged states", () => {
  it("Entry = 1 + bought facts: the lone entry is the target as before (no choice asked)", () => {
    const s = single({ discoveryHintFacts: { "pesto-pollo": ["ing:chicken"] } });
    expect(entryIds(s)).toEqual(["pesto-pollo"]);
    expect(needsResearchTargetChoice(s)).toBe(false);
    expect(act(startFree(s), { type: "SHOW_HINT" }).hintSession?.targetId).toBe("pesto-pollo");
  });

  it("Entry = 1 with nothing bought: unchanged", () => {
    expect(act(startFree(single()), { type: "SHOW_HINT" }).hintSession?.targetId).toBe("pesto-pollo");
  });

  it("two entries become one once one is discovered: the remaining one is the target again", () => {
    const s = save(12, [B]);
    expect(entryIds(s)).toHaveLength(1);
    expect(act(startFree({ ...s, ...BOUGHT }), { type: "SHOW_HINT" }).hintSession).not.toBeNull();
  });

  it("with a Research Target nothing changes: the target's Hint, and a purchase still works", () => {
    const s = act(startFree(multi(), A), { type: "SHOW_HINT" });
    const view = hint5SheetView(s);
    expect(view?.next).toBeTruthy();
    const bought = act(s, { type: "PURCHASE_HINT5_RUNG", expectedRungIndex: view!.next!.rungIndex });
    expect(bought.pitzBalance).toBeLessThan(s.pitzBalance);
    expect(bought.discoveryHintFacts[A]?.length ?? 0).toBeGreaterThan(0);
  });

  it("no registered entry (Dex-0 Margherita onboarding) is untouched", () => {
    const s = act(startFree(createInitialGameState()), { type: "SHOW_HINT" });
    expect(needsResearchTargetChoice(s)).toBe(false);
    expect(s.hintSession?.targetId).toBe("margherita");
  });
});

describe("CHOOSE_RESEARCH sheet DOM (privacy)", () => {
  it("fixed copy only: no recipe name, id, number, count, fact or oracle word; the button navigates", () => {
    const onChoose = vi.fn();
    const { container } = render(<HintSheet view={{ kind: "CHOOSE_RESEARCH" }} onUnlock={() => {}} onChooseResearch={onChoose} onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /研究するピザを選ぶ/ }));
    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(container.querySelector("[data-hint-kind]")?.getAttribute("data-hint-kind")).toBe("CHOOSE_RESEARCH");
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/\d/);
    expect(text).not.toMatch(/ヒントをもらう|たずねる|Pitz|近い|遠い|正解|あと|残り|全部で/);
    for (const r of RECIPES) {
      expect(text).not.toContain(r.nameJa);
      expect(container.innerHTML).not.toContain(r.id);
    }
    expect(container.querySelector(".hint-sheet__next")).toBeNull();
  });

  it("the view object carries nothing but its kind", () => {
    expect(Object.keys(hintSheetView(multi(BOUGHT)))).toEqual(["kind"]);
  });
});
