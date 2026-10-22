/**
 * R8 (Issue #617) test harness: a "tab" that does what App.tsx does around the save -- builds its state from storage at start (a
 * baked round's journal is completed there), saves with the same snapshot after every dispatch, and runs the committed steps
 * (`roundCommit.ts`). Two tabs on one origin share a store (`MemoryStorage.view()`).
 */
import { getCookingProfile } from "../../data/cookingProfiles";
import { findOrderForRecipe } from "../../data/orders";
import { STARTER_INGREDIENT_IDS } from "../../data/ingredients";
import { getRecipe } from "../../data/recipes";
import { requiredCutCount } from "../../logic/cut/evaluation";
import { createCutState } from "../../logic/cut/state";
import { resolveRequestedSliceCount, type CutLine } from "../../logic/cut/types";
import { DOUGH_CENTER, DOUGH_RADIUS } from "../../logic/pizzaCoordinates";
import { EMPTY_DEX } from "../dex";
import { createInitialGameState, gameReducer, type GameAction, type GameState } from "../gameReducer";
import type { InventoryState } from "../inventory";
import type { PendingRound } from "../pendingRound";
import { persistProgress, SAVE_STORAGE_KEY, type StorageLike } from "../persistence";
import { createEmptyPizza, type PizzaState } from "../pizzaState";
import {
  journalToSettleOnLeave,
  progressionSnapshotOf,
  runAcknowledgeSettled,
  runBake,
  runLeaveRound,
  runPostBakeStep,
  type RoundStep,
} from "../roundCommit";
import { buildStartup } from "../startup";
import type { MemoryStorage } from "./memoryStorage";

export function onionPizza(count: number): PizzaState {
  return {
    ...createEmptyPizza(),
    sauceIds: ["olive-oil"],
    // fugazza = olive-oil + 4 onion + 1 oregano (src/data/recipes.ts); `count` onions beyond that are consumed too.
    toppings: [
      ...Array.from({ length: count }, (_, i) => ({ id: `onion-${i}`, ingredientId: "onion", x: 10 + i * 10, y: 20 + i * 5 })),
      { id: "oregano-0", ingredientId: "oregano", x: 20, y: 60 },
    ],
  };
}

/** A fugazza round at BAKE (fugazza has a CUT step), carrying `pizza` and `inventory`. */
export function fugazzaAtBake(inventory: InventoryState, options: { mission?: boolean; pizza?: PizzaState; base?: GameState } = {}): GameState {
  const recipe = getRecipe("fugazza");
  const order = findOrderForRecipe("fugazza");
  if (!recipe || !order) throw new Error("Missing fugazza recipe/order fixture");
  const cookingProfile = getCookingProfile(recipe.id);
  const base = options.base ?? createInitialGameState(EMPTY_DEX, [...STARTER_INGREDIENT_IDS, "onion"], 40, inventory);
  const state: GameState = {
    ...base,
    recipe,
    order,
    pizza: options.pizza ?? onionPizza(5),
    isMissionRound: options.mission === true,
    roundKind: options.mission ? "LUNCH_RUSH" : "GUIDED",
    freeCook: false,
    cookingProfile,
    cutState: createCutState(cookingProfile.cutConfig),
  };
  return gameReducer(state, { type: "START_BAKE" });
}

export const SEED_SAVE = JSON.stringify({
  schemaVersion: 2,
  dex: [],
  pitzBalance: 40,
  ownedIngredientIds: ["onion"],
  missionBest: {},
  inventory: { onion: 20 },
});

export class Tab {
  state: GameState;
  settled: PendingRound | null;
  held: string | null;
  writes = 0;

  readonly storage: MemoryStorage;

  constructor(storage: MemoryStorage) {
    this.storage = storage;
    const startup = buildStartup(storage);
    this.state = startup.state;
    this.settled = startup.settled;
    this.held = startup.held;
    this.saveEffect();
  }

  /** What App.tsx's save effect writes for the current state. */
  saveEffect(): void {
    persistProgress({ ...progressionSnapshotOf(this.state, this.state.pendingRound ?? this.settled ?? undefined), requireDinnerRecords: true }, this.storage);
  }

  apply(...actions: GameAction[]): void {
    for (const action of actions) this.state = gameReducer(this.state, action);
    this.saveEffect();
  }

  /** Puts a prepared round on this tab (the PREPARE steps are not what is under test). */
  setRound(state: GameState): void {
    this.state = state;
    this.saveEffect();
  }

  private run(step: RoundStep): RoundStep {
    if (step.status === "committed") this.apply(...step.actions);
    return step;
  }

  bake(value = 70, now = 1_000, roundId = "round-1"): RoundStep {
    return this.run(runBake(this.state, value, now, roundId, this.storage));
  }

  postBakeStep(now = 2_000): RoundStep {
    return this.run(runPostBakeStep(this.state, now, this.storage));
  }

  /** Cut lines (session-only) then the confirmation, like the CUT step's UI. */
  cutAndConfirm(): RoundStep {
    const walked = walkPostBakeToResultUntilConfirm(this.state);
    this.state = walked;
    return this.postBakeStep();
  }

  goHome(): ReturnType<typeof runLeaveRound> {
    const left = runLeaveRound(this.state, this.storage);
    if (left.status === "settled") {
      this.state = gameReducer(this.state, { type: "ADOPT_STATE", state: left.completed.state });
      this.settled = left.completed.settled;
    } else if (left.status === "refused") {
      // like App: stay in the round, nothing is dropped
    } else {
      this.state = gameReducer(this.state, { type: "PLAY_AGAIN" });
    }
    this.saveEffect();
    return left;
  }

  hasJournalToSettle(): boolean {
    return journalToSettleOnLeave(this.state) !== null;
  }

  acknowledge() {
    const result = runAcknowledgeSettled(this.state, this.storage);
    if (result.status === "ok") this.settled = null;
    this.saveEffect();
    return result;
  }

  stored(): Record<string, unknown> {
    return JSON.parse(this.storage.getItem(SAVE_STORAGE_KEY) ?? "null") as Record<string, unknown>;
  }
}

/** Adds the CUT step's required lines (like the player's gestures) without confirming. */
function walkPostBakeToResultUntilConfirm(state: GameState): GameState {
  return state.phase === "POST_BAKE" && state.makingStep === "CUT" ? withCutLines(state) : state;
}

function withCutLines(state: GameState): GameState {
  const required = requiredCutCount(resolveRequestedSliceCount(state.cutState.config));
  let next = state;
  for (let i = 0; i < required; i += 1) {
    const angle = (Math.PI * i) / required;
    const line: CutLine = {
      start: { x: DOUGH_CENTER - Math.cos(angle) * DOUGH_RADIUS, y: DOUGH_CENTER - Math.sin(angle) * DOUGH_RADIUS },
      end: { x: DOUGH_CENTER + Math.cos(angle) * DOUGH_RADIUS, y: DOUGH_CENTER + Math.sin(angle) * DOUGH_RADIUS },
    };
    next = gameReducer(next, { type: "ADD_CUT_LINE", line });
  }
  return next;
}

export function dexIds(state: GameState): string[] {
  return state.dex.filter((e) => e.discovered).map((e) => e.recipeId);
}

export type { StorageLike };
