import { describe, expect, it } from "vitest";
import { SAVE_STORAGE_KEY, loadSave } from "./persistence";
import { gameReducer, type GameState } from "./gameReducer";
import { memoryStorage } from "./testSupport/memoryStorage";
import { SEED_SAVE, Tab, fugazzaAtBake } from "./testSupport/r8Harness";
import { walkPostBakeToResult } from "./testSupport/postBakeFlow";

/**
 * Save R8 (Issue #617), Lunch Rush L-1: a pizza that was baked but never SERVED did not happen. Its stock is not saved as consumed
 * until the serve is accepted; leaving without serving (HOME, expiry, a new run, a reload) puts it back, in memory too.
 *
 * KNOWN EXCEPTION (Owner decision 4, recorded here and in the Issue): the bake's result is visible before the serve, so a player
 * may bake, look at the result, and leave -- and get that pizza's stock back (a free "look" at the first pizza of a run). L-1 makes the
 * leave and a reload agree and keeps everything already SERVED consumed; it does not hide the result.
 */

/** Lunch Rush only serves DISCOVERED recipes: the save already knows fugazza. */
const MISSION_SAVE = JSON.stringify({
  ...(JSON.parse(SEED_SAVE) as object),
  dex: [
    { recipeId: "fugazza", discovered: true, bestScore: 50, bestStars: 2, timesMade: 1 },
    { recipeId: "margherita", discovered: true, bestScore: 50, bestStars: 2, timesMade: 1 },
  ],
});

function missionTab() {
  const storage = memoryStorage({ [SAVE_STORAGE_KEY]: MISSION_SAVE });
  const tab = new Tab(storage);
  tab.setRound(fugazzaAtBake({ onion: 20 }, { base: tab.state, mission: true }));
  return { storage, tab };
}

/** Bake, then walk CUT (fugazza has one) to the result screen, like the player: nothing is committed on the way (Lunch Rush has no journal). */
function bakeMission(tab: Tab) {
  tab.apply({ type: "CONFIRM_BAKE", value: 70, now: 1_000 });
  tab.state = walkPostBakeToResult(tab.state, 2_000);
  tab.saveEffect();
}

/** Absent and 0 are the same stock. */
const stockOf = (inventory: Readonly<Record<string, number>>) => Object.fromEntries(Object.entries(inventory).filter(([, n]) => n > 0));

describe("Lunch Rush L-1", () => {
  it("the bake consumes in memory but the save still holds the stock as it was", () => {
    const { storage, tab } = missionTab();
    bakeMission(tab);
    expect(tab.state.phase).toBe("RESULT");
    expect(tab.state.inventory.onion).toBe(15);
    expect(tab.state.unservedConsumption?.onion).toBe(5);
    expect(loadSave(storage).inventory.onion).toBe(20);
    expect(tab.state.dex.find((e) => e.recipeId === "fugazza")?.timesMade).toBe(1); // nothing registered either
  });

  it("a reload on the result screen leaves the stock as it was before the bake", () => {
    const { storage, tab } = missionTab();
    bakeMission(tab);
    const reloaded = new Tab(memoryStorage({ [SAVE_STORAGE_KEY]: storage.getItem(SAVE_STORAGE_KEY) ?? "" }));
    expect(reloaded.state.inventory.onion).toBe(20);
    expect(reloaded.state.dex.find((e) => e.recipeId === "fugazza")?.timesMade).toBe(1);
    expect(reloaded.settled).toBeNull();
  });

  it("leaving without serving (HOME / expiry / exit) puts the stock back in memory too, so the leave and a reload agree", () => {
    const { storage, tab } = missionTab();
    bakeMission(tab);
    tab.apply({ type: "PLAY_AGAIN" }); // exitMissionToFree
    expect(tab.state.inventory.onion).toBe(20);
    expect(tab.state.unservedConsumption).toBeNull();
    expect(loadSave(storage).inventory.onion).toBe(20);
    const reloaded = new Tab(memoryStorage({ [SAVE_STORAGE_KEY]: storage.getItem(SAVE_STORAGE_KEY) ?? "" }));
    expect(stockOf(reloaded.state.inventory)).toEqual(stockOf(tab.state.inventory));
  });

  it("a new run (MISSION_RESET_ORDER) also puts an unserved pizza's stock back", () => {
    const { tab } = missionTab();
    bakeMission(tab);
    tab.apply({ type: "MISSION_RESET_ORDER" });
    expect(tab.state.inventory.onion).toBe(20);
  });

  it("serving is the commit point: stock consumed and the registration are saved in the same write", () => {
    const { storage, tab } = missionTab();
    bakeMission(tab);
    const writes: Record<string, unknown>[] = [];
    const original = storage.setItem.bind(storage);
    storage.setItem = (key, value) => {
      writes.push(JSON.parse(value) as Record<string, unknown>);
      original(key, value);
    };
    tab.apply({ type: "MISSION_NEXT_ORDER" });
    expect(tab.state.unservedConsumption).toBeNull();
    expect(writes).toHaveLength(1);
    expect((writes[0]!.inventory as Record<string, number>).onion).toBe(15);
    expect((writes[0]!.dex as { recipeId: string; timesMade: number }[]).find((e) => e.recipeId === "fugazza")?.timesMade).toBe(2);
  });

  it("a RESTOCK during the window composes: what is saved is the pre-bake stock plus the restock", () => {
    const { storage, tab } = missionTab();
    bakeMission(tab);
    const restocked: GameState = { ...tab.state, inventory: { ...tab.state.inventory, onion: tab.state.inventory.onion! + 40 } };
    tab.setRound(restocked);
    expect(restocked.inventory.onion).toBe(55);
    expect(loadSave(storage).inventory.onion).toBe(60); // 20 saved + 40 bought; the unserved 5 stay uncommitted
    // leaving puts the 5 back in memory: 55 + 5 = 60, the same as the save
    tab.apply({ type: "PLAY_AGAIN" });
    expect(tab.state.inventory.onion).toBe(60);
    expect(loadSave(storage).inventory.onion).toBe(60);
  });

  it("a second bake after a serve: only the unserved pizza's stock is outstanding", () => {
    const { storage, tab } = missionTab();
    bakeMission(tab);
    tab.apply({ type: "MISSION_NEXT_ORDER" });
    expect(loadSave(storage).inventory.onion).toBe(15);
    tab.setRound(fugazzaAtBake(tab.state.inventory, { base: tab.state, mission: true }));
    bakeMission(tab);
    expect(tab.state.inventory.onion).toBe(10);
    expect(loadSave(storage).inventory.onion).toBe(15); // the first pizza stays consumed, the second is not yet
    tab.apply({ type: "PLAY_AGAIN" });
    expect(tab.state.inventory.onion).toBe(15);
  });

  it("the exception has a limit: a SERVED pizza is never given back by leaving", () => {
    const { storage, tab } = missionTab();
    bakeMission(tab);
    tab.apply({ type: "MISSION_NEXT_ORDER" });
    tab.apply({ type: "PLAY_AGAIN" });
    expect(tab.state.inventory.onion).toBe(15);
    expect(loadSave(storage).inventory.onion).toBe(15);
  });

  it("Free play and Dinner are unchanged: no unserved stock is ever held", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: SEED_SAVE });
    const tab = new Tab(storage);
    tab.setRound(fugazzaAtBake({ onion: 20 }, { base: tab.state }));
    const baked = gameReducer(tab.state, { type: "CONFIRM_BAKE", value: 70 });
    expect(baked.unservedConsumption).toBeNull();
  });
});
