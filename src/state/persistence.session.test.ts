import { describe, expect, it } from "vitest";
import {
  SAVE_STORAGE_KEY,
  loadSave,
  loadSaveForSession,
  persistDex,
  persistMissionBest,
  persistProgress,
  resetSaveResult,
  type ProgressionSnapshot,
  type StorageLike,
} from "./persistence";
import type { DexEntry } from "./dex";
import { inspectSaveHealth } from "./saveHealth";
import { getSaveSession } from "./saveSession";
import { FUTURE_V3, GOLDEN_ERAS, UNUSABLE_ROOTS } from "./testSupport/saveGoldenFixtures";
import { faultyStorage, type FaultyStorage } from "./testSupport/faultyStorage";
import { memoryStorage } from "./testSupport/memoryStorage";

/**
 * Save Protection PR-3 (Issue #560, Fresh Audit N1; #282 regression): a write is allowed only while the stored text is the
 * one THIS session loaded at startup or wrote itself. See ./saveSession.ts.
 *
 *   N1    the startup read failed once -> the default state is on screen -> a later read succeeds -> that default state must
 *         NOT replace the real save.
 *   #282  a tab that loaded an older save must not write over what another tab saved.
 */

const MARGHERITA: DexEntry = { recipeId: "margherita", discovered: true, bestScore: 90, bestStars: 5, timesMade: 9 };
const FUGAZZA: DexEntry = { recipeId: "fugazza", discovered: true, bestScore: 64, bestStars: 3, timesMade: 1 };

const REAL_SAVE = JSON.stringify({
  schemaVersion: 2,
  dex: [MARGHERITA],
  pitzBalance: 5000,
  ownedIngredientIds: [],
  missionBest: {},
  inventory: {},
});

/** What App.tsx's persistence effect passes: the page's in-memory state (here, always the state its startup load produced). */
function snapshotOf(state: ReturnType<typeof loadSave>, over: Partial<ProgressionSnapshot> = {}): ProgressionSnapshot {
  return {
    dex: state.dex,
    pitzBalance: state.pitzBalance,
    ownedIngredientIds: state.ownedIngredientIds,
    inventory: state.inventory,
    starterGrantClaimedRecipeIds: state.starterGrantClaimedRecipeIds,
    ...over,
  };
}

const rawOf = (s: StorageLike) => s.getItem(SAVE_STORAGE_KEY);

/** A storage whose save-key reads can be made to throw, and later to work again, like a transient browser failure. */
function flaky(initial: Record<string, string>): FaultyStorage & { failReads(on: boolean): void } {
  let failing = false;
  const storage = faultyStorage(memoryStorage(initial), { getThrows: (key) => failing && key === SAVE_STORAGE_KEY });
  return Object.assign(storage, { failReads: (on: boolean) => void (failing = on) });
}

describe("N1: a failed startup read never lets the default state replace the real save", () => {
  it("REPRODUCTION: startup read throws, the mount-time write finds a readable save -> refused, bytes untouched", () => {
    const storage = flaky({ [SAVE_STORAGE_KEY]: REAL_SAVE });
    storage.failReads(true);
    const startup = loadSaveForSession(storage); // App's initial state: the default, not the player's save
    storage.failReads(false); // ...and the very next read works (a transient failure)
    expect(startup.pitzBalance).toBe(0);
    expect(startup.dex).toEqual([]);

    const result = persistProgress(snapshotOf(startup), storage); // App's mount-time persistence effect

    expect(result.blocked).toBe("load-failed");
    expect(rawOf(storage)).toBe(REAL_SAVE);
    expect(loadSave(storage).pitzBalance).toBe(5000);
  });

  it("every write API is refused, again and again, and nothing else is written", () => {
    const storage = flaky({ [SAVE_STORAGE_KEY]: REAL_SAVE });
    storage.failReads(true);
    const startup = loadSaveForSession(storage);
    storage.failReads(false);
    for (let i = 0; i < 3; i += 1) {
      expect(persistProgress(snapshotOf(startup, { pitzBalance: 10 + i }), storage).blocked).toBe("load-failed");
      expect(persistDex([FUGAZZA], storage).blocked).toBe("load-failed");
      expect(persistMissionBest("lunch-rush", 999, storage).blocked).toBe("load-failed");
    }
    expect(rawOf(storage)).toBe(REAL_SAVE);
    expect(storage.setCount(SAVE_STORAGE_KEY)).toBe(0);
  });

  it("a later SUCCESSFUL startup load does not lift it (the StrictMode double initializer, or any second load)", () => {
    const storage = flaky({ [SAVE_STORAGE_KEY]: REAL_SAVE });
    storage.failReads(true);
    const first = loadSaveForSession(storage);
    storage.failReads(false);
    loadSaveForSession(storage); // succeeds, but the state in use may be `first`
    expect(getSaveSession(storage)).toEqual({ kind: "load-failed" });
    expect(persistProgress(snapshotOf(first, { pitzBalance: 1 }), storage).blocked).toBe("load-failed");
    expect(rawOf(storage)).toBe(REAL_SAVE);
  });

  it("with no save at all the same rule holds: a failed read is not evidence that the slot is empty", () => {
    const storage = flaky({});
    storage.failReads(true);
    const startup = loadSaveForSession(storage);
    storage.failReads(false);
    expect(persistProgress(snapshotOf(startup, { pitzBalance: 30 }), storage).blocked).toBe("load-failed");
    expect(rawOf(storage)).toBeNull();
  });

  it("a read that keeps failing is still reported as storage-error (unchanged), and nothing is written", () => {
    const storage = flaky({ [SAVE_STORAGE_KEY]: REAL_SAVE });
    storage.failReads(true);
    const startup = loadSaveForSession(storage);
    expect(persistProgress(snapshotOf(startup, { pitzBalance: 30 }), storage).blocked).toBe("storage-error");
    storage.failReads(false);
    expect(rawOf(storage)).toBe(REAL_SAVE);
  });

  it("a reload recovers: a fresh startup load of the same storage reads the save and writes normally", () => {
    const storage = flaky({ [SAVE_STORAGE_KEY]: REAL_SAVE });
    storage.failReads(true);
    loadSaveForSession(storage);
    storage.failReads(false);
    // "reload" = a new page = no session state; model it with a second handle on the same data.
    const reloaded = memoryStorage({ [SAVE_STORAGE_KEY]: REAL_SAVE });
    const state = loadSaveForSession(reloaded);
    expect(state.pitzBalance).toBe(5000);
    expect(persistProgress(snapshotOf(state, { pitzBalance: 5010 }), reloaded).blocked).toBeUndefined();
    expect(loadSave(reloaded).pitzBalance).toBe(5010);
  });

  it("a Full Game Reset the player chose lifts it (the app reloads right after)", () => {
    const storage = flaky({ [SAVE_STORAGE_KEY]: REAL_SAVE });
    storage.failReads(true);
    loadSaveForSession(storage);
    storage.failReads(false);
    expect(resetSaveResult(storage)).toEqual({ ok: true });
    expect(rawOf(storage)).toBeNull();
    expect(getSaveSession(storage)).toEqual({ kind: "loaded", expectedRaw: null });
  });
});

describe("a healthy session saves exactly as before", () => {
  it("its own consecutive writes are all allowed (every write API, many times)", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: REAL_SAVE });
    const state = loadSaveForSession(storage);
    for (let i = 1; i <= 5; i += 1) {
      expect(persistProgress(snapshotOf(state, { pitzBalance: 5000 + i }), storage).blocked).toBeUndefined();
    }
    expect(persistDex([MARGHERITA, FUGAZZA], storage).blocked).toBeUndefined();
    expect(persistMissionBest("lunch-rush", 700, storage).blocked).toBeUndefined();
    expect(persistProgress(snapshotOf(state, { dex: [MARGHERITA, FUGAZZA], pitzBalance: 6000 }), storage).blocked).toBeUndefined();
    const after = loadSave(storage);
    expect(after.pitzBalance).toBe(6000);
    expect(after.missionBest["lunch-rush"]).toBe(700);
    expect(after.dex.map((e) => e.recipeId)).toEqual(["margherita", "fugazza"]);
  });

  it("a fresh install (no save) writes its first save and keeps writing", () => {
    const storage = memoryStorage();
    const state = loadSaveForSession(storage);
    expect(persistProgress(snapshotOf(state, { pitzBalance: 40 }), storage).blocked).toBeUndefined();
    expect(persistProgress(snapshotOf(state, { pitzBalance: 41 }), storage).blocked).toBeUndefined();
    expect(loadSave(storage).pitzBalance).toBe(41);
  });

  it("every golden era: load, then write twice -- nothing blocked, progress kept, nothing but the save key written", () => {
    for (const era of GOLDEN_ERAS) {
      const storage = memoryStorage({ [SAVE_STORAGE_KEY]: era.raw });
      const state = loadSaveForSession(storage);
      expect(persistProgress(snapshotOf(state, { pitzBalance: state.pitzBalance + 5 }), storage).blocked, era.name).toBeUndefined();
      expect(persistProgress(snapshotOf(state, { pitzBalance: state.pitzBalance + 9 }), storage).blocked, era.name).toBeUndefined();
      expect(storage.keys(), era.name).toEqual([SAVE_STORAGE_KEY]);
      const after = loadSave(storage);
      expect(after.pitzBalance, era.name).toBe(state.pitzBalance + 9);
      expect(after.dex.map((e) => e.recipeId), era.name).toEqual(era.expect.dexIds);
    }
  });

  it("a write whose setItem throws does not move the expectation: the next attempt still goes through", () => {
    const inner = memoryStorage({ [SAVE_STORAGE_KEY]: REAL_SAVE });
    let failSet = true;
    const storage = faultyStorage(inner, { setThrows: () => failSet });
    const state = loadSaveForSession(storage);
    expect(persistProgress(snapshotOf(state, { pitzBalance: 1 }), storage).blocked).toBeUndefined(); // swallowed, as always
    expect(rawOf(storage)).toBe(REAL_SAVE);
    failSet = false;
    expect(persistProgress(snapshotOf(state, { pitzBalance: 2 }), storage).blocked).toBeUndefined();
    expect(loadSave(storage).pitzBalance).toBe(2);
  });

  it("storage that was never given a session is not guarded by it: a changed stored text is not refused (the guard is opt-in)", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: REAL_SAVE });
    const state = loadSave(storage); // plain loadSave: no session
    storage.view().setItem(SAVE_STORAGE_KEY, REAL_SAVE.replace("5000", "5300")); // another writer changes it
    expect(persistProgress(snapshotOf(state, { pitzBalance: 2 }), storage).blocked).toBeUndefined();
    // the very same sequence under a session IS refused
    const guarded = memoryStorage({ [SAVE_STORAGE_KEY]: REAL_SAVE });
    const guardedState = loadSaveForSession(guarded);
    guarded.view().setItem(SAVE_STORAGE_KEY, REAL_SAVE.replace("5000", "5300"));
    expect(persistProgress(snapshotOf(guardedState, { pitzBalance: 2 }), guarded).blocked).toBe("stale-save");
  });
});

describe("#282: a stale tab never overwrites what another tab saved", () => {
  function twoTabs(initial: Record<string, string> = { [SAVE_STORAGE_KEY]: REAL_SAVE }) {
    const tabA = memoryStorage(initial);
    const tabB = tabA.view();
    const stateA = loadSaveForSession(tabA);
    const stateB = loadSaveForSession(tabB);
    return { tabA, tabB, stateA, stateB };
  }

  it("a Dex entry and the Pitz tab B saved survive tab A's later write (the old R2 characterization)", () => {
    const { tabA, tabB, stateA, stateB } = twoTabs();
    expect(persistProgress(snapshotOf(stateB, { dex: [...stateB.dex, FUGAZZA], pitzBalance: 5300 }), tabB).blocked).toBeUndefined();
    const savedByB = rawOf(tabB);

    const result = persistProgress(snapshotOf(stateA, { pitzBalance: 5150 }), tabA);

    expect(result.blocked).toBe("stale-save");
    expect(rawOf(tabA)).toBe(savedByB);
    const after = loadSave(tabA);
    expect(after.dex.map((e) => e.recipeId)).toEqual(["margherita", "fugazza"]);
    expect(after.pitzBalance).toBe(5300);
  });

  it("stock and ownership are protected the same way, and so are persistDex and persistMissionBest", () => {
    const { tabA, tabB, stateA, stateB } = twoTabs();
    persistProgress(snapshotOf(stateB, { ownedIngredientIds: [...stateB.ownedIngredientIds, "onion"], inventory: { onion: 8 } }), tabB);
    const savedByB = rawOf(tabB);
    expect(persistProgress(snapshotOf(stateA, { pitzBalance: 5001 }), tabA).blocked).toBe("stale-save");
    expect(persistDex([MARGHERITA, FUGAZZA], tabA).blocked).toBe("stale-save");
    expect(persistMissionBest("lunch-rush", 900, tabA).blocked).toBe("stale-save");
    expect(rawOf(tabA)).toBe(savedByB);
    expect(loadSave(tabA).inventory).toEqual({ onion: 8 });
  });

  it("the refusal has no side effect: nothing quarantined, no other key written", () => {
    const { tabA, tabB, stateA, stateB } = twoTabs();
    persistProgress(snapshotOf(stateB, { pitzBalance: 5300 }), tabB);
    const keysBefore = tabA.keys();
    persistProgress(snapshotOf(stateA, { pitzBalance: 5150 }), tabA);
    expect(tabA.keys()).toEqual(keysBefore);
  });

  it("the refusal is permanent for that page until it reloads, and a reload then saves on top of the newer save", () => {
    const { tabA, tabB, stateA, stateB } = twoTabs();
    persistProgress(snapshotOf(stateB, { pitzBalance: 5300 }), tabB);
    for (let i = 0; i < 3; i += 1) {
      expect(persistProgress(snapshotOf(stateA, { pitzBalance: 5100 + i }), tabA).blocked).toBe("stale-save");
    }
    // A reloads: a new page, a new startup load of what is stored now.
    const reloadedStorage = memoryStorage({ [SAVE_STORAGE_KEY]: rawOf(tabA) as string });
    const reloaded = loadSaveForSession(reloadedStorage);
    expect(reloaded.pitzBalance).toBe(5300);
    expect(persistProgress(snapshotOf(reloaded, { pitzBalance: 5320 }), reloadedStorage).blocked).toBeUndefined();
    expect(loadSave(reloadedStorage).pitzBalance).toBe(5320);
  });

  it("a tab that started with no save is refused once another tab saved the first one", () => {
    const { tabA, tabB, stateA, stateB } = twoTabs({});
    expect(persistProgress(snapshotOf(stateB, { pitzBalance: 70 }), tabB).blocked).toBeUndefined();
    expect(persistProgress(snapshotOf(stateA, { pitzBalance: 20 }), tabA).blocked).toBe("stale-save");
    expect(loadSave(tabA).pitzBalance).toBe(70);
  });

  it("the save key removed behind a page (another tab's Reset) is also a change: refused, nothing resurrected", () => {
    const { tabA, tabB, stateA } = twoTabs();
    tabB.removeItem(SAVE_STORAGE_KEY);
    expect(persistProgress(snapshotOf(stateA, { pitzBalance: 5001 }), tabA).blocked).toBe("stale-save");
    expect(rawOf(tabA)).toBeNull();
  });

  it("each tab's own consecutive writes keep working while nobody else writes", () => {
    const { tabA, stateA } = twoTabs();
    for (let i = 1; i <= 4; i += 1) {
      expect(persistProgress(snapshotOf(stateA, { pitzBalance: 5000 + i }), tabA).blocked).toBeUndefined();
    }
  });

  it("KNOWN LIMIT (documented): the check and the write are separate calls, so a write that lands in between is not seen by THIS write", () => {
    const inner = memoryStorage({ [SAVE_STORAGE_KEY]: REAL_SAVE });
    const otherTab = inner.view();
    const otherTabsText = REAL_SAVE.replace("5000", "5300");
    let readsSinceLoad = -1; // -1: the startup load is still running
    // persistProgress reads once itself (`loadSave`), then the write guard reads once more: right AFTER that second read the
    // other tab saves, before this page's `setItem`.
    const tab: StorageLike = {
      getItem: (k) => {
        const value = inner.getItem(k);
        if (readsSinceLoad >= 0 && k === SAVE_STORAGE_KEY && ++readsSinceLoad === 2) otherTab.setItem(SAVE_STORAGE_KEY, otherTabsText);
        return value;
      },
      setItem: (k, v) => inner.setItem(k, v),
      removeItem: (k) => inner.removeItem(k),
    };
    const state = loadSaveForSession(tab);
    readsSinceLoad = 0;

    // The race is NOT caught by this write: the guard saw the expected text, then the other tab saved, then setItem replaced it.
    expect(persistProgress(snapshotOf(state, { pitzBalance: 5100 }), tab).blocked).toBeUndefined();
    expect(loadSave(inner).pitzBalance).toBe(5100);
    // The page's NEXT write sees text it did not write and is refused, so the damage is bounded to that one write.
    expect(persistProgress(snapshotOf(state, { pitzBalance: 5101 }), tab).blocked).toBeUndefined(); // it wrote 5100 itself: expected
    otherTab.setItem(SAVE_STORAGE_KEY, otherTabsText);
    expect(persistProgress(snapshotOf(state, { pitzBalance: 5102 }), tab).blocked).toBe("stale-save");
  });
});

describe("the earlier protections are unchanged under a session (R1, R3)", () => {
  it("R1: a newer build's save is still refused as unknown-schema (not as stale), bytes untouched", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: FUTURE_V3 });
    const state = loadSaveForSession(storage);
    expect(persistProgress(snapshotOf(state, { pitzBalance: 10 }), storage).blocked).toBe("unknown-schema");
    expect(rawOf(storage)).toBe(FUTURE_V3);
  });

  it("R3: every unusable root is quarantined, replaced once, and the session then keeps saving", () => {
    for (const { name, raw } of UNUSABLE_ROOTS) {
      const storage = memoryStorage({ [SAVE_STORAGE_KEY]: raw });
      const state = loadSaveForSession(storage);
      expect(persistProgress(snapshotOf(state, { pitzBalance: 10 }), storage).blocked, name).toBeUndefined();
      expect(persistProgress(snapshotOf(state, { pitzBalance: 11 }), storage).blocked, name).toBeUndefined();
      expect(loadSave(storage).pitzBalance, name).toBe(11);
      const held = JSON.parse(storage.getItem("teto-pizza-save-v1.quarantine-v1.first") ?? "null");
      expect(held?.raw, name).toBe(raw);
    }
  });

  it("R3: a corrupt save changed by another tab before this page's first write is refused, and not quarantined by this page", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: "{broken" });
    const other = storage.view();
    const state = loadSaveForSession(storage);
    other.setItem(SAVE_STORAGE_KEY, REAL_SAVE);
    expect(persistProgress(snapshotOf(state, { pitzBalance: 10 }), storage).blocked).toBe("stale-save");
    expect(rawOf(storage)).toBe(REAL_SAVE);
    expect(storage.keys()).toEqual([SAVE_STORAGE_KEY]);
  });
});

describe("what the player is told", () => {
  it("the startup failure is reported at once (no write attempt needed), and a keep-failing read stays storage-unavailable", () => {
    const storage = flaky({ [SAVE_STORAGE_KEY]: REAL_SAVE });
    storage.failReads(true);
    loadSaveForSession(storage);
    expect(inspectSaveHealth(storage, null).notice).toEqual({ kind: "storage-unavailable" });
    storage.failReads(false);
    expect(inspectSaveHealth(storage, null).notice).toEqual({ kind: "load-failed" });
    expect(inspectSaveHealth(storage, "load-failed").notice).toEqual({ kind: "load-failed" });
  });

  it("a refused stale write is reported as stale-save", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: REAL_SAVE });
    loadSaveForSession(storage);
    expect(inspectSaveHealth(storage, "stale-save").notice).toEqual({ kind: "stale-save" });
  });

  it("a healthy session shows nothing", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: REAL_SAVE });
    loadSaveForSession(storage);
    expect(inspectSaveHealth(storage, null).notice).toBeNull();
  });
});
