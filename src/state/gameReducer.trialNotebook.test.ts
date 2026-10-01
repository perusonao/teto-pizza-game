import { describe, expect, it } from "vitest";
import { INGREDIENTS } from "../data/ingredients";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "./gameReducer";
import { notebookSize, notebookView, recordAttempt, createTrialNotebook, trialNotebookViolations } from "../logic/discovery/trialNotebook";
import { resultNearMiss } from "./resultNearMiss";
import { persistProgress, loadSave, type StorageLike } from "./persistence";
import { discoveredDex } from "./testSupport/guidedRound";
import {
  cook,
  DEX_3,
  FAR_ORIGINAL,
  freeRound,
  INCOMPLETE,
  INVENTORY,
  MARGHERITA,
  MID_BAKE,
  NOW,
  ORDINARY,
  OWNED,
  playFreeRound,
  register,
} from "./testSupport/trialNotebookFlow";
import { recordTrialAttempt } from "./trialRecord";

/**
 * Original Pizza Recovery P3-3a: the Trial Notebook is written by REGISTER_TO_DEX's free-cook ORIGINAL transition
 * only (OD-P3-17), carried through every round transition, never saved, and never read by a render. Real reducer
 * actions throughout; no state injection except where a test needs a *different mode's* round.
 */
// A Dinner-capable save (mirrors gameReducer.dinner.test.ts): every ingredient owned, dm-a's recipes discovered.
const ALL_IDS = INGREDIENTS.map((i) => i.id);
const FINITE_IDS = INGREDIENTS.filter((i) => i.unlockCondition).map((i) => i.id);
const dinnerReady = () =>
  createInitialGameState(
    discoveredDex(["margherita", "bismarck", "breakfast-pizza", "funghi", "marinara"]),
    ALL_IDS,
    500,
    { egg: 30, bacon: 30, mushroom: 30 },
    [],
    FINITE_IDS,
    {},
  );
const rows = (s: GameState) => notebookView(s.trialNotebook);
const size = (s: GameState) => notebookSize(s.trialNotebook);

describe("initial state", () => {
  it("13. a fresh initial state (reload / app restart / Full Game Reset) has an empty notebook and no record result", () => {
    const s = createInitialGameState(DEX_3, OWNED, 0, INVENTORY, []);
    expect(size(s)).toEqual({ display: 0, identities: 0, nextNumber: 1 });
    expect(s.lastTrialAttempt).toBeNull();
    expect(trialNotebookViolations(s.trialNotebook)).toEqual([]);
  });

  it("13b. a hydrated save builds an empty notebook: the save format has no notebook and loadSave returns none", () => {
    const store: Record<string, string> = {};
    const storage: StorageLike = { getItem: (k) => store[k] ?? null, setItem: (k, v) => void (store[k] = v), removeItem: (k) => void delete store[k] };
    const played = playFreeRound(freeRound(), ORDINARY);
    expect(size(played).identities).toBe(1);
    // Force a real write (a changed Pitz balance) of the exact field list App.tsx passes; the notebook is not in it.
    persistProgress(
      {
        dex: played.dex,
        pitzBalance: played.pitzBalance + 123,
        ownedIngredientIds: played.ownedIngredientIds,
        inventory: played.inventory,
        starterGrantClaimedRecipeIds: played.starterGrantClaimedRecipeIds,
        unlockedForShopIngredientIds: played.unlockedForShopIngredientIds,
        discoveryHintPurchases: played.discoveryHintPurchases,
        discoveryHintFacts: played.discoveryHintFacts,
        discoveredTechniqueIds: played.discoveredTechniqueIds,
        dinnerMissionRecordUpdates: played.dinnerMissionRecordsState.records,
        requireDinnerRecords: true,
      },
      storage,
    );
    expect(Object.keys(store).length).toBeGreaterThan(0); // the write really happened
    const raw = Object.values(store).join("\n");
    expect(raw).not.toMatch(/trialNotebook|lastTrialAttempt|fp1:/);
    const loaded = loadSave(storage);
    expect(JSON.stringify(loaded)).not.toMatch(/trialNotebook|fp1:/);
    const fresh = createInitialGameState(loaded.dex, loaded.ownedIngredientIds, loaded.pitzBalance, loaded.inventory, []);
    expect(size(fresh).identities).toBe(0);
  });
});

describe("recording an ORIGINAL attempt", () => {
  it("1. the first ordinary ORIGINAL is NEW (#1) and stored once", () => {
    const s = playFreeRound(freeRound(), ORDINARY);
    expect(s.phase).toBe("DISCOVERED");
    expect(s.lastDiscovery?.kind).toBe("ORIGINAL");
    expect(s.lastTrialAttempt).toEqual({ kind: "NEW", number: 1 });
    expect(size(s)).toEqual({ display: 1, identities: 1, nextNumber: 2 });
    expect(rows(s)).toHaveLength(1);
  });

  it("2/3/25. the same attempt again is DUPLICATE with the same #n and retryCount exactly +1 per retry", () => {
    let s = playFreeRound(freeRound(), ORDINARY);
    expect(rows(s)[0]).toMatchObject({ number: 1, retryCount: 0 });
    s = playFreeRound(s, ORDINARY);
    expect(s.lastTrialAttempt).toEqual({ kind: "DUPLICATE", number: 1 });
    expect(rows(s)).toHaveLength(1);
    expect(rows(s)[0]).toMatchObject({ number: 1, retryCount: 1 });
    s = playFreeRound(s, ORDINARY);
    expect(s.lastTrialAttempt).toEqual({ kind: "DUPLICATE", number: 1 });
    expect(rows(s)[0]).toMatchObject({ number: 1, retryCount: 2 });
    expect(size(s).nextNumber).toBe(2); // #n is never reused or re-issued
  });

  it("25. a different combination is a new attempt with the next stable #n; the first keeps its number", () => {
    let s = playFreeRound(freeRound(), ORDINARY);
    s = playFreeRound(s, FAR_ORIGINAL);
    expect(s.lastTrialAttempt).toEqual({ kind: "NEW", number: 2 });
    s = playFreeRound(s, ORDINARY);
    expect(s.lastTrialAttempt).toEqual({ kind: "DUPLICATE", number: 1 });
    expect(rows(s).map((r) => r.number)).toEqual([1, 2]); // retry = newest activity, on top
  });

  it("4. a repeated REGISTER_TO_DEX never records again (same state reference, same notebook)", () => {
    const atResult = cook(freeRound(), ORDINARY);
    const once = register(atResult);
    const again = register(once);
    expect(again).toBe(once);
    expect(register(again).trialNotebook).toBe(once.trialNotebook);
    expect(rows(once)[0].retryCount).toBe(0);
  });

  it("4b. stray CONFIRM_BAKE / REGISTER after the commit cannot change the notebook or the record result", () => {
    const once = register(cook(freeRound(), ORDINARY));
    const stray: GameAction[] = [{ type: "CONFIRM_BAKE", value: MID_BAKE }, { type: "REGISTER_TO_DEX" }, { type: "CLOSE_HINT" }];
    const after = stray.reduce(gameReducer, once);
    expect(after.trialNotebook).toBe(once.trialNotebook);
    expect(after.lastTrialAttempt).toBe(once.lastTrialAttempt);
  });

  it("5. the commit transition is pure: the same input state yields the same output (React StrictMode double-invokes reducers)", () => {
    const atResult = cook(freeRound(), ORDINARY);
    const a = register(atResult);
    const b = register(atResult);
    expect(JSON.stringify(a.trialNotebook)).toBe(JSON.stringify(b.trialNotebook));
    expect(a.lastTrialAttempt).toEqual(b.lastTrialAttempt);
    // and a committed retry: two invocations from the same pre-commit state agree, and the notebook itself is not mutated
    const pre = cook(gameReducer(a, { type: "START_FREE_COOK", now: NOW }), ORDINARY);
    const beforeJson = JSON.stringify(pre.trialNotebook);
    const c = register(pre);
    const d = register(pre);
    expect(JSON.stringify(pre.trialNotebook)).toBe(beforeJson);
    expect(JSON.stringify(c.trialNotebook)).toBe(JSON.stringify(d.trialNotebook));
    expect(rows(c)[0].retryCount).toBe(1);
    expect(rows(d)[0].retryCount).toBe(1);
  });

  it("23/24. the stored feedback is exactly the P2 line shown ({ kind, textJa }), with no other field", () => {
    for (const pizza of [ORDINARY, FAR_ORIGINAL]) {
      const s = playFreeRound(freeRound(), pizza);
      const shown = resultNearMiss(s);
      const stored = rows(s)[0].feedback;
      expect(shown).not.toBeNull();
      expect(stored).toEqual({ kind: shown!.kind, textJa: shown!.textJa });
      expect(Object.keys(stored!).sort()).toEqual(["kind", "textJa"]);
    }
  });

  it("23b. when P2 shows no line, the stored feedback is null (not stored ⇒ not invented)", () => {
    // A combination whose P2 line is absent: far from everything while the generic FAR line is on still shows a line,
    // so force the null path through the adapter with P2's own null input (FAILED-like freeCook=false is never eligible).
    const s = playFreeRound(freeRound(), ORDINARY);
    const out = recordTrialAttempt({ ...s, freeCook: false, trialNotebook: createTrialNotebook() }, { kind: "ORIGINAL", blockedTargetIds: [] });
    expect(notebookView(out.trialNotebook)[0].feedback).toBeNull();
    expect(out.lastTrialAttempt).toEqual({ kind: "NEW", number: 1 });
  });

  it("23c. a retry replaces the feedback with the latest one shown (no feedback history)", () => {
    const first = playFreeRound(freeRound(), ORDINARY);
    expect(rows(first)[0].feedback).not.toBeNull();
    const pre = cook(gameReducer(first, { type: "START_FREE_COOK", now: NOW }), ORDINARY);
    // The same attempt, this time with no P2 line shown (P2 is null outside a free round): the stored line is replaced.
    const out = recordTrialAttempt({ ...pre, freeCook: false }, { kind: "ORIGINAL", blockedTargetIds: [] });
    expect(out.lastTrialAttempt).toEqual({ kind: "DUPLICATE", number: 1 });
    expect(notebookView(out.trialNotebook)).toHaveLength(1);
    expect(notebookView(out.trialNotebook)[0]).toMatchObject({ number: 1, retryCount: 1, feedback: null });
  });
});

describe("eligibility (OD-P3-16): only ORIGINAL and AMBIGUOUS record", () => {
  const notRecorded = (s: GameState) => {
    expect(size(s)).toEqual({ display: 0, identities: 0, nextNumber: 1 });
    expect(s.lastTrialAttempt).toBeNull();
  };

  it("15. INCOMPLETE_MATCH is recorded like any ORIGINAL (OD-D3-23: no absent-record oracle)", () => {
    const s = register(cook(freeRound(), INCOMPLETE));
    expect(s.lastDiscovery?.kind).toBe("INCOMPLETE_MATCH");
    expect(s.phase).toBe("DISCOVERED");
    expect(size(s)).toEqual({ display: 1, identities: 1, nextNumber: 2 });
    expect(s.lastTrialAttempt).toEqual({ kind: "NEW", number: 1 });
  });

  it("16. NEW_DISCOVERY is not recorded", () => {
    const s = playFreeRound(freeRound(discoveredDex(["bismarck", "breakfast-pizza"])), MARGHERITA);
    expect(s.lastDiscovery?.kind ?? s.lastDiscovery).toBeDefined();
    expect(s.score).not.toBeNull();
    notRecorded(s);
  });

  it("17. a known pizza (ALREADY_DISCOVERED) is not recorded", () => {
    const s = playFreeRound(freeRound(), MARGHERITA);
    expect(s.score).not.toBeNull();
    notRecorded(s);
  });

  it("18. a FAILED round (raw bake) is not recorded and stays parked at RESULT", () => {
    const s = playFreeRound(freeRound(), ORDINARY, 5);
    expect(s.phase).toBe("RESULT");
    expect(s.completion?.status).toBe("FAILED");
    notRecorded(s);
  });

  it("22. AMBIGUOUS has the same record eligibility as an ordinary ORIGINAL (unreachable in production: adapter-level)", () => {
    const s = cook(freeRound(), ORDINARY);
    const out = recordTrialAttempt(s, { kind: "AMBIGUOUS", targetIds: ["a", "b"] });
    expect(out.lastTrialAttempt).toEqual({ kind: "NEW", number: 1 });
    expect(notebookView(out.trialNotebook)).toHaveLength(1);
    // the same attempt again is a DUPLICATE, exactly like an ordinary ORIGINAL
    const twice = recordTrialAttempt({ ...s, trialNotebook: out.trialNotebook }, { kind: "AMBIGUOUS", targetIds: ["a", "b"] });
    expect(twice.lastTrialAttempt).toEqual({ kind: "DUPLICATE", number: 1 });
    // an ORIGINAL of the same combination dedupes against it (one identity, no outcome field)
    const mixed = recordTrialAttempt({ ...s, trialNotebook: out.trialNotebook }, { kind: "ORIGINAL", blockedTargetIds: [] });
    expect(mixed.lastTrialAttempt).toEqual({ kind: "DUPLICATE", number: 1 });
  });

  it("the adapter records nothing for any non-ORIGINAL/AMBIGUOUS/INCOMPLETE outcome and returns the same references", () => {
    const s = cook(freeRound(), ORDINARY);
    for (const outcome of [
      { kind: "NEW_DISCOVERY", recipeId: "funghi", targetId: "t" },
      { kind: "ALREADY_DISCOVERED", recipeId: "funghi", targetId: "t" },
    ] as const) {
      const out = recordTrialAttempt(s, outcome as never);
      expect(out.trialNotebook).toBe(s.trialNotebook);
      expect(out.lastTrialAttempt).toBeNull();
    }
  });

  it("19. a guided round is not recorded", () => {
    let s = createInitialGameState(DEX_3, OWNED, 0, INVENTORY, []);
    s = gameReducer(s, { type: "SELECT_RECIPE", recipeId: "margherita", now: NOW });
    expect(s.freeCook).toBe(false);
    s = register(cook(s, MARGHERITA));
    expect(s.phase).toBe("DISCOVERED");
    notRecorded(s);
  });

  it("20. a Lunch Rush round (MISSION_NEXT_ORDER) is not recorded", () => {
    let s = gameReducer(createInitialGameState(DEX_3, OWNED, 0, INVENTORY, []), { type: "MISSION_RESET_ORDER" });
    expect(s.isMissionRound).toBe(true);
    s = cook(gameReducer(s, { type: "BEGIN_PREPARE", now: NOW }), MARGHERITA);
    expect(s.score).not.toBeNull();
    const before = s.trialNotebook;
    const next = gameReducer(s, { type: "MISSION_NEXT_ORDER" });
    expect(next.trialNotebook).toBe(before);
    notRecorded(next);
    // and a stray REGISTER_TO_DEX inside Lunch Rush registers nothing into the notebook either
    const reg = gameReducer(s, { type: "REGISTER_TO_DEX" });
    expect(reg.trialNotebook).toBe(before);
    expect(reg.lastTrialAttempt).toBeNull();
  });

  it("21. a Dinner pizza is not recorded (REGISTER_TO_DEX is refused during a run; the run never touches the notebook)", () => {
    let s = dinnerReady();
    s = gameReducer(s, { type: "DINNER_START", missionId: "dm-a", now: NOW, durationMs: 600_000, minimumStars: 3 });
    expect(s.dinner).not.toBeNull();
    const before = s.trialNotebook;
    s = cook(s, ORDINARY);
    // Dinner resolves its own results (DM-3R-1); whatever phase the pizza is at, REGISTER_TO_DEX is refused.
    const atResult: GameState = { ...s, phase: "RESULT", score: null, completion: { status: "PASS" } };
    const reg = gameReducer(atResult, { type: "REGISTER_TO_DEX" });
    expect(reg).toBe(atResult);
    expect(reg.trialNotebook).toBe(before);
    expect(gameReducer(s, { type: "REGISTER_TO_DEX" })).toBe(s);
    notRecorded(reg);
  });
});

describe("session lifecycle: the notebook rides ProgressionCarry", () => {
  const recorded = () => playFreeRound(freeRound(), ORDINARY);

  it("7/8. the next FREE round, PLAY_AGAIN and RETRY_SAME_RECIPE keep the notebook; the record result is reset", () => {
    const s = recorded();
    for (const action of [
      { type: "START_FREE_COOK", now: NOW },
      { type: "RETRY_SAME_RECIPE", now: NOW },
      { type: "PLAY_AGAIN" },
    ] as GameAction[]) {
      const next = gameReducer(s, action);
      expect(next.trialNotebook, action.type).toBe(s.trialNotebook);
      expect(next.lastTrialAttempt, action.type).toBeNull();
    }
  });

  it("7. the RESULT -> HOME path dispatches nothing that touches the notebook (PLAY_AGAIN at HOME keeps it; no record from HOME)", () => {
    const s = recorded();
    const home = gameReducer(s, { type: "PLAY_AGAIN" });
    expect(home.trialNotebook).toBe(s.trialNotebook);
    expect(size(home).identities).toBe(1);
    expect(rows(home)[0].retryCount).toBe(0);
  });

  it("9. HOME -> FREE retains the notebook, and the first retry afterwards is a DUPLICATE", () => {
    const s = gameReducer(recorded(), { type: "PLAY_AGAIN" });
    const again = playFreeRound(s, ORDINARY);
    expect(again.lastTrialAttempt).toEqual({ kind: "DUPLICATE", number: 1 });
    expect(rows(again)[0].retryCount).toBe(1);
  });

  it("10. a guided round trip keeps the notebook", () => {
    const base = recorded();
    let s = gameReducer(base, { type: "SELECT_RECIPE", recipeId: "margherita", now: NOW });
    expect(s.freeCook).toBe(false);
    expect(s.trialNotebook).toBe(base.trialNotebook);
    s = register(cook(s, MARGHERITA));
    const back = playFreeRound(s, ORDINARY);
    expect(back.lastTrialAttempt).toEqual({ kind: "DUPLICATE", number: 1 });
    expect(size(back).identities).toBe(1);
  });

  it("11. a Lunch Rush round trip keeps the notebook", () => {
    const base = recorded();
    const before = base.trialNotebook;
    let s = gameReducer(base, { type: "MISSION_RESET_ORDER" });
    expect(s.trialNotebook).toBe(before);
    s = cook(gameReducer(s, { type: "BEGIN_PREPARE", now: NOW }), MARGHERITA);
    s = gameReducer(s, { type: "MISSION_NEXT_ORDER" });
    expect(s.trialNotebook).toBe(before);
    const back = playFreeRound({ ...s, isMissionRound: false }, ORDINARY);
    expect(back.lastTrialAttempt).toEqual({ kind: "DUPLICATE", number: 1 });
  });

  it("12. a Dinner round trip keeps the notebook (start, next pizza, abandon, exit)", () => {
    const base = dinnerReady();
    const seeded = { ...base, ...{ trialNotebook: recorded().trialNotebook } } as GameState;
    const before = seeded.trialNotebook;
    let s = gameReducer(seeded, { type: "DINNER_START", missionId: "dm-a", now: NOW, durationMs: 600_000, minimumStars: 3 });
    expect(s.dinner).not.toBeNull();
    expect(s.trialNotebook).toBe(before);
    s = cook(s, ORDINARY);
    s = gameReducer(s, { type: "DINNER_NEXT_PIZZA", now: NOW + 100_000 });
    expect(s.trialNotebook).toBe(before);
    s = [{ type: "DINNER_REQUEST_ABANDON" }, { type: "DINNER_CONFIRM_ABANDON", now: NOW + 200_000 }, { type: "DINNER_EXIT" }].reduce(
      gameReducer as never,
      s,
    ) as GameState;
    expect(s.dinner).toBeNull();
    expect(s.trialNotebook).toBe(before);
    const back = playFreeRound(s, ORDINARY);
    expect(back.lastTrialAttempt).toEqual({ kind: "DUPLICATE", number: 1 });
  });

  it("26. REVIVE works through the real wiring: a row pushed out of the 50-row display comes back with its #n", () => {
    // Seed 50 other identities through the model (synthetic fingerprints), then a real attempt, then 50 more.
    let nb = createTrialNotebook();
    const fp = (i: number) => `fp1:[["tomato-sauce"],["tomato-sauce","x${String(i).padStart(3, "0")}"]]`;
    let s = freeRound();
    s = { ...s, trialNotebook: nb };
    s = register(cook(s, ORDINARY)); // real attempt: #1
    expect(s.lastTrialAttempt).toEqual({ kind: "NEW", number: 1 });
    nb = s.trialNotebook;
    for (let i = 0; i < 60; i += 1) nb = recordAttempt(nb, { fingerprint: fp(i), feedback: null }).state;
    expect(notebookSize(nb)).toMatchObject({ display: 50 });
    expect(notebookView(nb).some((r) => r.number === 1)).toBe(false); // detail left the display, identity kept
    const revived = playFreeRound({ ...s, trialNotebook: nb }, ORDINARY);
    expect(revived.lastTrialAttempt).toEqual({ kind: "DUPLICATE", number: 1 });
    const top = notebookView(revived.trialNotebook)[0];
    expect(top).toMatchObject({ number: 1, retryCount: 1 });
    expect(notebookSize(revived.trialNotebook).display).toBe(50);
  });

  it("26b. an identity evicted from the 2 000 index is a NEW attempt with a new number (never a false duplicate)", () => {
    let nb = createTrialNotebook({ display: 2, identity: 3 });
    const base = register(cook(freeRound(), ORDINARY));
    // base used the default limits; re-run the same pizza against a tiny notebook through the adapter
    const first = recordTrialAttempt({ ...base, trialNotebook: nb }, { kind: "ORIGINAL", blockedTargetIds: [] });
    nb = first.trialNotebook;
    for (let i = 0; i < 3; i += 1) {
      nb = recordAttempt(nb, { fingerprint: `fp1:[["tomato-sauce"],["tomato-sauce","y${i}"]]`, feedback: null }).state;
    }
    const again = recordTrialAttempt({ ...base, trialNotebook: nb }, { kind: "ORIGINAL", blockedTargetIds: [] });
    expect(again.lastTrialAttempt?.kind).toBe("NEW");
    expect(again.lastTrialAttempt?.number).toBeGreaterThan(1);
  });
});

describe("the display-only record result (lastTrialAttempt)", () => {
  it("27. it is written at the commit and cleared by every fresh round, guided / Lunch Rush / Dinner included", () => {
    const s = playFreeRound(freeRound(), ORDINARY);
    expect(s.lastTrialAttempt).toEqual({ kind: "NEW", number: 1 });
    const fresh: GameAction[] = [
      { type: "START_FREE_COOK", now: NOW },
      { type: "RETRY_SAME_RECIPE", now: NOW },
      { type: "PLAY_AGAIN" },
      { type: "SELECT_RECIPE", recipeId: "margherita", now: NOW },
      { type: "MISSION_RESET_ORDER" },
    ];
    for (const action of fresh) expect(gameReducer(s, action).lastTrialAttempt, action.type).toBeNull();
  });

  it("27b. it is not recomputed from the notebook: a later lookup-style change of the notebook never changes it", () => {
    const s = playFreeRound(freeRound(), ORDINARY);
    const result = s.lastTrialAttempt;
    // any unrelated action on the DISCOVERED state leaves both untouched
    const after = [{ type: "SHOW_HINT" }, { type: "CLOSE_HINT" }].reduce(gameReducer as never, s) as GameState;
    expect(after.lastTrialAttempt).toBe(result);
    expect(after.trialNotebook).toBe(s.trialNotebook);
  });

  it("27c. a FAILED / known result carries no record result even after an earlier recorded round; INCOMPLETE is recorded", () => {
    const first = playFreeRound(freeRound(), ORDINARY);
    const incomplete = playFreeRound(first, INCOMPLETE);
    expect(incomplete.lastTrialAttempt).toEqual({ kind: "NEW", number: 2 });
    const failed = playFreeRound(first, ORDINARY, 5);
    expect(failed.lastTrialAttempt).toBeNull();
    expect(failed.trialNotebook).toBe(first.trialNotebook);
  });

  it("carries only `kind` and the stable `#n` (no retryCount, no outcome, no internal field)", () => {
    const s = playFreeRound(playFreeRound(freeRound(), ORDINARY), ORDINARY);
    expect(Object.keys(s.lastTrialAttempt!).sort()).toEqual(["kind", "number"]);
  });
});

describe("privacy: the notebook and the record result hold no hidden information", () => {
  const FORBIDDEN = ["distance", "sauceStep", "keyUnused", "candidate", "collision", "shipped:", "cls:", "h5:", "ing:", "meta:", "targetId", "recipeId", "blockedTargetIds", "outcome"];

  it("24. after real flows over ORIGINAL neighbours the serialised notebook and result hold none of them", async () => {
    const { RECIPES } = await import("../data/recipes");
    let s = freeRound();
    for (const pizza of [ORDINARY, FAR_ORIGINAL, ORDINARY, FAR_ORIGINAL]) s = playFreeRound(s, pizza);
    const text = JSON.stringify([s.trialNotebook, s.lastTrialAttempt]);
    for (const word of FORBIDDEN) expect(text, word).not.toContain(word);
    for (const r of RECIPES) {
      expect(text, `recipe id ${r.id}`).not.toContain(`"${r.id}"`);
      expect(text, `recipe name ${r.nameJa}`).not.toContain(r.nameJa);
      expect(text, `recipe description of ${r.id}`).not.toContain(r.description.slice(0, 8));
    }
    expect(trialNotebookViolations(s.trialNotebook)).toEqual([]);
  });

  it("the stored combination is the player's own ingredients only", () => {
    const s = playFreeRound(freeRound(), ORDINARY);
    expect(rows(s)[0].combination).toEqual({ sauceBase: ["tomato-sauce"], ingredientSet: ["mozzarella", "tomato-sauce"] });
  });
});
