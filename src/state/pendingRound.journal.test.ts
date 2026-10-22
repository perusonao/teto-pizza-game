import { beforeEach, describe, expect, it } from "vitest";
import { SAVE_STORAGE_KEY, commitProgress, loadSave, persistProgress, readStoredJournal } from "./persistence";
import { gameReducer } from "./gameReducer";
import { PENDING_ROUND_MAX_BYTES, pendingRoundByteLength } from "./pendingRound";
import { progressionSnapshotOf } from "./roundCommit";
import { memoryStorage } from "./testSupport/memoryStorage";
import { walkPostBakeToResult } from "./testSupport/postBakeFlow";
import { SEED_SAVE, Tab, dexIds, fugazzaAtBake, onionPizza } from "./testSupport/r8Harness";

/**
 * Save R8 (Issue #617, J-B): consumption and registration are saved together or not at all.
 * Fugazza has a CUT step (`POST_BAKE`), so a bake leaves "stock consumed, pizza not registered" until CUT ends -- the window
 * the `pendingRound` journal closes.
 */

function seeded() {
  return memoryStorage({ [SAVE_STORAGE_KEY]: SEED_SAVE });
}

function bakingTab(storage = seeded()) {
  const tab = new Tab(storage);
  tab.setRound(fugazzaAtBake({ onion: 20 }, { base: tab.state }));
  return tab;
}

/** The result a player gets by finishing the same round by hand: the parity reference. */
function manualResult() {
  const baked = gameReducer(fugazzaAtBake({ onion: 20 }, { base: new Tab(seeded()).state }), { type: "CONFIRM_BAKE", value: 70 });
  return gameReducer(walkPostBakeToResult(baked), { type: "REGISTER_TO_DEX" });
}

beforeEach(() => undefined);

describe("the bake saves the consumed stock and the journal in ONE write", () => {
  it("one setItem holds onion 15 and a pending journal; nothing else is written", () => {
    const storage = seeded();
    const tab = bakingTab(storage);
    const writes: string[] = [];
    const original = storage.setItem.bind(storage);
    storage.setItem = (key, value) => {
      writes.push(value);
      original(key, value);
    };
    const step = tab.bake();
    expect(step.status).toBe("committed");
    expect(writes).toHaveLength(1);
    const saved = JSON.parse(writes[0]!) as { inventory: Record<string, number>; pendingRound: { status: string; id: string; kind: string; recipeId: string }; dex: unknown[] };
    expect(saved.inventory.onion).toBe(15);
    expect(saved.pendingRound).toMatchObject({ status: "pending", id: "round-1", kind: "GUIDED", recipeId: "fugazza" });
    expect(saved.dex).toEqual([]); // not registered yet -- the journal is what will register it
    expect(tab.state.phase).toBe("POST_BAKE");
  });

  it("a bake with no CUT / FINISH after it registers at once: one write holds the stock AND the registered pizza, and no journal exists", () => {
    const storage = seeded();
    const tab = new Tab(storage);
    // a failed bake skips CUT (Issue #256): stock is used, the pizza does not register
    tab.setRound(fugazzaAtBake({ onion: 20 }, { base: tab.state }));
    const step = tab.bake(5); // far under the target
    expect(step.status).toBe("committed");
    expect(tab.state.phase).toBe("RESULT");
    expect(tab.stored().pendingRound).toBeUndefined();
    expect(loadSave(storage).inventory.onion).toBe(15);
    expect(readStoredJournal(storage).kind).toBe("none");
  });
});

describe("a reload at any point of CUT ends with the stock consumed AND the pizza registered, exactly once", () => {
  const reference = manualResult();

  function expectCompleted(reloaded: Tab) {
    expect(reloaded.state.inventory.onion).toBe(15);
    expect(dexIds(reloaded.state)).toContain("fugazza");
    expect(reloaded.settled?.status).toBe("settled");
    expect(reloaded.settled?.settled?.outcome).toBe("REGISTERED");
    // parity with finishing the same pizza by hand (no efficiency bonus: the clock is not journaled)
    expect(reloaded.state.dex).toEqual(reference.dex);
    expect(reloaded.state.pitzBalance).toBe(reference.pitzBalance);
    expect(reloaded.state.inventory.onion).toBe(reference.inventory.onion);
    expect(reloaded.stored().pendingRound).toMatchObject({ status: "settled" });
  }

  it("right after the bake", () => {
    const storage = seeded();
    const tab = bakingTab(storage);
    tab.bake();
    expectCompleted(new Tab(storage.view()));
  });

  it("in the middle of CUT (lines drawn, not confirmed -- they are not saved)", () => {
    const storage = seeded();
    const tab = bakingTab(storage);
    tab.bake();
    tab.state = gameReducer(tab.state, { type: "ADD_CUT_LINE", line: { start: { x: 10, y: 50 }, end: { x: 90, y: 50 } } });
    tab.saveEffect();
    expectCompleted(new Tab(storage.view()));
  });

  it("just before the last confirmation", () => {
    const storage = seeded();
    const tab = bakingTab(storage);
    tab.bake();
    tab.state = gameReducer(tab.state, { type: "ADD_CUT_LINE", line: { start: { x: 10, y: 50 }, end: { x: 90, y: 50 } } });
    expectCompleted(new Tab(storage.view()));
  });

  it("just after the confirmation: registered, journal gone, nothing to announce, no second registration on reload", () => {
    const storage = seeded();
    const tab = bakingTab(storage);
    tab.bake();
    const step = tab.cutAndConfirm();
    expect(step.status).toBe("committed");
    expect(tab.state.phase).toBe("DISCOVERED");
    expect(tab.stored().pendingRound).toBeUndefined();
    const reloaded = new Tab(storage.view());
    expect(reloaded.settled).toBeNull();
    expect(reloaded.state.dex).toEqual(reference.dex);
    expect(reloaded.state.dex.find((e) => e.recipeId === "fugazza")?.timesMade).toBe(1);
    expect(reloaded.state.inventory.onion).toBe(15);
  });
});

describe("registration and the journal change in one write", () => {
  it("the CUT confirmation writes Dex, Pitz, stock and the journal's removal in a single setItem", () => {
    const storage = seeded();
    const tab = bakingTab(storage);
    tab.bake();
    const writes: Record<string, unknown>[] = [];
    const original = storage.setItem.bind(storage);
    storage.setItem = (key, value) => {
      writes.push(JSON.parse(value) as Record<string, unknown>);
      original(key, value);
    };
    tab.cutAndConfirm();
    expect(writes).toHaveLength(1);
    expect(writes[0]!.pendingRound).toBeUndefined();
    expect((writes[0]!.dex as unknown[]).length).toBeGreaterThan(0);
    expect(writes[0]!.pitzBalance).toBeGreaterThan(40);
  });

  it("the startup completion writes the registered progress and the settled journal in a single setItem", () => {
    const storage = seeded();
    const tab = bakingTab(storage);
    tab.bake();
    const second = storage.view();
    const writes: Record<string, unknown>[] = [];
    const original = second.setItem.bind(second);
    second.setItem = (key, value) => {
      writes.push(JSON.parse(value) as Record<string, unknown>);
      original(key, value);
    };
    new Tab(second);
    expect(writes).toHaveLength(1);
    expect((writes[0]!.pendingRound as { status: string }).status).toBe("settled");
    expect((writes[0]!.dex as unknown[]).length).toBeGreaterThan(0);
  });
});

describe("leaving for HOME completes the round exactly like a restart", () => {
  it("Dex, Pitz, stock and the summary match a reload of the same moment", () => {
    const storageA = seeded();
    const tabA = bakingTab(storageA);
    tabA.bake();
    const storageB = seeded();
    const tabB = bakingTab(storageB);
    tabB.bake();
    expect(tabA.hasJournalToSettle()).toBe(true);

    expect(tabA.goHome().status).toBe("settled");
    const reloaded = new Tab(storageB.view());

    expect(tabA.state.dex).toEqual(reloaded.state.dex);
    expect(tabA.state.pitzBalance).toBe(reloaded.state.pitzBalance);
    expect(tabA.state.inventory).toEqual(reloaded.state.inventory);
    expect(tabA.settled?.settled).toEqual(reloaded.settled?.settled);
    expect(tabA.stored().dex).toEqual(reloaded.stored().dex);
    expect(tabA.stored().inventory).toEqual(reloaded.stored().inventory);
    expect(tabA.stored().pitzBalance).toEqual(reloaded.stored().pitzBalance);
  });

  it("the summary is kept until the player confirms; the confirmation removes the journal and a reload shows nothing", () => {
    const storage = seeded();
    const tab = bakingTab(storage);
    tab.bake();
    tab.goHome();
    expect(tab.stored().pendingRound).toMatchObject({ status: "settled" });
    const reopened = new Tab(storage.view());
    expect(reopened.settled?.status).toBe("settled"); // still there after another restart
    expect(reopened.state.dex.find((e) => e.recipeId === "fugazza")?.timesMade).toBe(1); // not registered again
    expect(reopened.acknowledge().status).toBe("ok");
    expect(reopened.stored().pendingRound).toBeUndefined();
    expect(new Tab(storage.view()).settled).toBeNull();
  });
});

describe("restarts and failed saves never register twice", () => {
  it("repeated starts whose saves keep failing complete the same way each time, and the one save that works registers once", () => {
    const storage = seeded();
    const first = bakingTab(storage);
    first.bake();
    const stored = storage.getItem(SAVE_STORAGE_KEY);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failing = storage.view();
      failing.setItem = () => {
        throw new DOMException("full", "QuotaExceededError");
      };
      const tab = new Tab(failing);
      expect(tab.state.dex.find((e) => e.recipeId === "fugazza")?.timesMade).toBe(1);
      expect(tab.state.inventory.onion).toBe(15);
      expect(storage.getItem(SAVE_STORAGE_KEY)).toBe(stored); // nothing changed in the save
    }
    const working = new Tab(storage.view());
    expect(working.state.dex.find((e) => e.recipeId === "fugazza")?.timesMade).toBe(1);
    const again = new Tab(storage.view());
    expect(again.state.dex.find((e) => e.recipeId === "fugazza")?.timesMade).toBe(1);
    expect(again.settled?.status).toBe("settled");
  });

  it("a settled journal is never settled again", () => {
    const storage = seeded();
    const tab = bakingTab(storage);
    tab.bake();
    const done = new Tab(storage.view());
    const journal = done.settled!;
    expect(journal.status).toBe("settled");
    const rebuilt = new Tab(storage.view());
    expect(rebuilt.state.dex).toEqual(done.state.dex);
    expect(rebuilt.state.pitzBalance).toBe(done.state.pitzBalance);
  });
});

describe("a save that cannot take the step stops the round (nothing is consumed without being saved)", () => {
  function expectUntouched(tab: Tab, before: string | null) {
    expect(tab.storage.getItem(SAVE_STORAGE_KEY)).toBe(before);
    expect(tab.state.phase).toBe("BAKE");
    expect(tab.state.inventory.onion).toBe(20);
  }

  it("storage full (setItem throws): failed quota, still at BAKE, the save is as it was; a retry after space is freed goes through", () => {
    const storage = seeded();
    const tab = bakingTab(storage);
    const before = storage.getItem(SAVE_STORAGE_KEY);
    const original = storage.setItem.bind(storage);
    storage.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
    const step = tab.bake();
    expect(step).toEqual({ status: "refused", commit: { status: "failed", failure: "quota" } });
    expectUntouched(tab, before);
    storage.setItem = original;
    expect(tab.bake().status).toBe("committed");
    expect(loadSave(storage).inventory.onion).toBe(15);
  });

  it("storage unavailable (setItem throws something else): failed unavailable", () => {
    const storage = seeded();
    const tab = bakingTab(storage);
    const before = storage.getItem(SAVE_STORAGE_KEY);
    storage.setItem = () => {
      throw new Error("SecurityError");
    };
    expect(tab.bake()).toEqual({ status: "refused", commit: { status: "failed", failure: "unavailable" } });
    expectUntouched(tab, before);
  });

  it("a write that is silently dropped is caught by the read-back: failed dropped", () => {
    const storage = seeded();
    const tab = bakingTab(storage);
    const before = storage.getItem(SAVE_STORAGE_KEY);
    storage.setItem = () => undefined;
    expect(tab.bake()).toEqual({ status: "refused", commit: { status: "failed", failure: "dropped" } });
    expectUntouched(tab, before);
  });

  it("a write that reads back as something else is caught: failed mismatch", () => {
    const storage = seeded();
    const tab = bakingTab(storage);
    const before = storage.getItem(SAVE_STORAGE_KEY);
    const original = storage.setItem.bind(storage);
    storage.setItem = (key, value) => original(key, value.replace('"onion":15', '"onion":14'));
    expect(tab.bake()).toEqual({ status: "refused", commit: { status: "failed", failure: "mismatch" } });
    expect(tab.state.phase).toBe("BAKE");
    expect(before).not.toBeNull();
  });

  it("a journal above the hard cap is refused before anything is written: failed oversize", () => {
    const storage = seeded();
    const tab = new Tab(storage);
    const huge = {
      ...onionPizza(5),
      sauceDeposits: Array.from({ length: 3000 }, (_, i) => ({ x: 10 + (i % 80) + 0.123456789012345, y: 10 + (i % 70) + 0.987654321098765, amount: 0.02 })),
    };
    tab.setRound(fugazzaAtBake({ onion: 20 }, { base: tab.state, pizza: huge }));
    const before = storage.getItem(SAVE_STORAGE_KEY);
    const step = tab.bake();
    expect(step).toEqual({ status: "refused", commit: { status: "failed", failure: "oversize" } });
    expectUntouched(tab, before);
  });

  it("the cap counts UTF-8 bytes of the journal", () => {
    const tab = bakingTab();
    tab.bake();
    const journal = tab.state.pendingRound!;
    expect(pendingRoundByteLength(journal)).toBeLessThan(PENDING_ROUND_MAX_BYTES);
    expect(pendingRoundByteLength(journal)).toBe(new TextEncoder().encode(JSON.stringify(journal)).length);
  });
});

describe("protected saves do not let the round go on either", () => {
  it("another tab saved in between (stale-save): blocked, the round stays at BAKE, this tab writes nothing", () => {
    const storage = seeded();
    const tab = bakingTab(storage);
    const other = new Tab(storage.view());
    persistProgress({ ...progressionSnapshotOf(other.state, undefined), pitzBalance: 9000 }, other.storage);
    const before = storage.getItem(SAVE_STORAGE_KEY);
    const step = tab.bake();
    expect(step).toEqual({ status: "refused", commit: { status: "blocked", block: "stale-save" } });
    expect(tab.state.phase).toBe("BAKE");
    expect(storage.getItem(SAVE_STORAGE_KEY)).toBe(before);
  });

  it("the startup read failed (load-failed): blocked, and still blocked after the storage works again", () => {
    const storage = seeded();
    const failingRead = storage.view();
    const realGet = failingRead.getItem.bind(failingRead);
    let failures = 1;
    failingRead.getItem = (key) => {
      if (failures-- > 0) throw new Error("transient");
      return realGet(key);
    };
    const tab = new Tab(failingRead);
    tab.setRound(fugazzaAtBake({ onion: 20 }, { base: tab.state }));
    expect(tab.bake()).toEqual({ status: "refused", commit: { status: "blocked", block: "load-failed" } });
    expect(tab.bake()).toEqual({ status: "refused", commit: { status: "blocked", block: "load-failed" } });
    expect(storage.getItem(SAVE_STORAGE_KEY)).toBe(SEED_SAVE);
  });

  it("a newer build's save (unknown schema) is not written to and the bake is refused", () => {
    const future = JSON.stringify({ schemaVersion: 3, dex: [], pitzBalance: 777 });
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: future });
    const tab = new Tab(storage);
    tab.setRound(fugazzaAtBake({ onion: 20 }, { base: tab.state }));
    expect(tab.bake().status).toBe("refused");
    expect(storage.getItem(SAVE_STORAGE_KEY)).toBe(future);
  });
});

describe("two tabs on one save register once", () => {
  it("tab B completes the journal at start; tab A's next save is refused (stale-save) and the pizza is registered a single time", () => {
    const storage = seeded();
    const a = bakingTab(storage);
    a.bake();
    const b = new Tab(storage.view());
    expect(b.state.dex.find((e) => e.recipeId === "fugazza")?.timesMade).toBe(1);

    const step = a.cutAndConfirm();
    expect(step).toMatchObject({ status: "refused", commit: { status: "blocked", block: "stale-save" } });
    expect(a.state.phase).toBe("POST_BAKE"); // did not move on
    const final = new Tab(storage.view());
    expect(final.state.dex.find((e) => e.recipeId === "fugazza")?.timesMade).toBe(1);
    expect(final.state.inventory.onion).toBe(15);
  });
});

describe("older builds, kept journals and a changing catalog", () => {
  it("an older build's writes (no journal in its snapshot) keep the journal exactly as stored", () => {
    const storage = seeded();
    const tab = bakingTab(storage);
    tab.bake();
    const journalText = JSON.stringify(tab.stored().pendingRound);
    // an older build knows nothing of `pendingRound`: its saves are plain progress writes (the key rides through untouched)
    persistProgress({ ...loadSave(storage), pitzBalance: 41, inventory: { onion: 15 } }, storage);
    persistProgress({ ...loadSave(storage), pitzBalance: 42 }, storage);
    expect(JSON.stringify(tab.stored().pendingRound)).toBe(journalText);
    expect(tab.stored().pitzBalance).toBe(42);
    expect(tab.stored().schemaVersion).toBe(2);
  });

  it("a journal this build cannot act on is held byte-for-byte through other saves, announced, and never replaced", () => {
    const future = { v: 2, id: "future-1", status: "pending", anything: { new: "shape" } };
    const raw = JSON.stringify({ schemaVersion: 2, dex: [], pitzBalance: 40, ownedIngredientIds: ["onion"], missionBest: {}, inventory: { onion: 20 }, pendingRound: future });
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: raw });
    const tab = new Tab(storage);
    expect(tab.held).toBe("unknown-version");
    persistProgress({ ...progressionSnapshotOf(tab.state, undefined), pitzBalance: 55 }, storage);
    expect(JSON.parse(storage.getItem(SAVE_STORAGE_KEY)!).pendingRound).toEqual(future);
    // a round that needs the slot cannot be baked while it is held ...
    tab.setRound(fugazzaAtBake({ onion: 20 }, { base: tab.state }));
    expect(tab.bake()).toEqual({ status: "refused", commit: { status: "failed", failure: "occupied" } });
    // ... and nothing can remove it
    expect(commitProgress(progressionSnapshotOf(tab.state, null), storage)).toEqual({ status: "failed", failure: "occupied" });
    expect(JSON.parse(storage.getItem(SAVE_STORAGE_KEY)!).pendingRound).toEqual(future);
  });

  it("a journal naming something this build does not have (catalog OFF) is held with its original text, and a round that needs no journal still plays", () => {
    const stray = {
      v: 1, id: "late-1", status: "pending", kind: "GUIDED", recipeId: "fugazza", bakeValue: 70, createdAt: 1,
      pizza: { ...onionPizza(5), toppings: [{ id: "t1", ingredientId: "ingredient-from-a-later-catalog", x: 1, y: 1 }], doughShape: { radii: [18, 18, 18, 18, 18, 18, 18, 18] } },
    };
    const raw = JSON.stringify({ schemaVersion: 2, dex: [], pitzBalance: 40, ownedIngredientIds: ["onion"], missionBest: {}, inventory: { onion: 20 }, pendingRound: stray });
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: raw });
    const tab = new Tab(storage);
    expect(tab.held).toBe("unresolvable");
    expect(JSON.parse(storage.getItem(SAVE_STORAGE_KEY)!).pendingRound).toEqual(stray);
    expect(tab.state.dex).toEqual([]); // nothing was registered from it
  });
});

describe("a leave the save cannot take keeps the player in the round", () => {
  it("HOME refused (storage full): still at CUT with the journal pending; the retry after space is freed completes it once", () => {
    const storage = seeded();
    const tab = bakingTab(storage);
    tab.bake();
    const original = storage.setItem.bind(storage);
    storage.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
    expect(tab.goHome()).toEqual({ status: "refused", commit: { status: "failed", failure: "quota" } });
    expect(tab.state.phase).toBe("POST_BAKE");
    expect(tab.state.pendingRound?.status).toBe("pending");
    storage.setItem = original;
    expect(tab.goHome().status).toBe("settled");
    expect(tab.state.dex.find((e) => e.recipeId === "fugazza")?.timesMade).toBe(1);
    expect(new Tab(storage.view()).state.dex.find((e) => e.recipeId === "fugazza")?.timesMade).toBe(1);
  });
});

describe("a write that lands but cannot be read back (known limit): a reload recovers", () => {
  it("the bake is reported as failed and the page stays at BAKE; a retry on the same page is refused (stale-save); a reload completes the round exactly once", () => {
    const storage = seeded();
    const tab = bakingTab(storage);
    const realGet = storage.getItem.bind(storage);
    let armed = false;
    // the first read AFTER the write throws (the read-back); every other read works
    const original = storage.setItem.bind(storage);
    storage.setItem = (key, value) => {
      original(key, value);
      armed = true;
    };
    storage.getItem = (key) => {
      if (armed) {
        armed = false;
        throw new Error("read-back failed");
      }
      return realGet(key);
    };
    const step = tab.bake();
    expect(step.status).toBe("refused");
    expect(tab.state.phase).toBe("BAKE");
    storage.getItem = realGet;
    // the write did land: storage holds the consumed stock and the journal
    expect(JSON.parse(storage.getItem(SAVE_STORAGE_KEY)!).pendingRound).toMatchObject({ status: "pending" });
    // (App gives every attempt a new round id, so the retry's journal differs from the one that landed)
    expect(tab.bake(70, 1_000, "round-2")).toEqual({ status: "refused", commit: { status: "blocked", block: "stale-save" } });

    const reloaded = new Tab(storage.view());
    expect(reloaded.state.inventory.onion).toBe(15);
    expect(reloaded.state.dex.find((e) => e.recipeId === "fugazza")?.timesMade).toBe(1);
    expect(reloaded.settled?.settled?.outcome).toBe("REGISTERED");
    const again = new Tab(storage.view());
    expect(again.state.dex.find((e) => e.recipeId === "fugazza")?.timesMade).toBe(1);
  });
});
