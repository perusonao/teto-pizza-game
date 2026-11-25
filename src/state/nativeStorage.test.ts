import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  NativeStorageWriteError,
  createNativeStorage,
  hydrateNativeStorage,
  type AsyncKeyValueBackend,
} from "./nativeStorage";
import { initNativeStorage } from "./nativeStorageBoot";
import {
  SAVE_STORAGE_KEY,
  commitProgress,
  createDefaultSave,
  getDefaultStorage,
  loadSave,
  loadStartupSave,
  persistProgress,
  resetSaveResult,
  setDefaultStorageOverride,
  type StorageLike,
} from "./persistence";
import { QUARANTINE_KEY_SUFFIX } from "./saveQuarantine";
import { resetSaveSessionsForTests } from "./saveSession";
import { FUTURE_V3, GOLDEN_ERAS, UNUSABLE_ROOTS } from "./testSupport/saveGoldenFixtures";
import { memoryStorage } from "./testSupport/memoryStorage";

/**
 * M1 (#571): the native-storage adapter. The fake backend is asynchronous with controllable latency and failures, so these
 * tests exercise the same ordering / failure / hydration paths a device would, without a device.
 */

interface FakeBackend extends AsyncKeyValueBackend {
  store: Map<string, string>;
  log: string[];
  /** Max number of native calls that were in flight at the same time. */
  maxInFlight: number;
  failSet: boolean;
  failGet: boolean;
  /** Accept writes and then not hold them. */
  dropWrites: boolean;
  latency: (key: string) => number;
}

function fakeBackend(initial: Record<string, string> = {}): FakeBackend {
  let inFlight = 0;
  const b: FakeBackend = {
    store: new Map(Object.entries(initial)),
    log: [],
    maxInFlight: 0,
    failSet: false,
    failGet: false,
    dropWrites: false,
    latency: () => 0,
    keys: async () => [...b.store.keys()],
    async get(key: string) {
      if (b.failGet) throw new Error("native get failed");
      return b.store.get(key) ?? null;
    },
    async set(key: string, value: string) {
      inFlight++;
      b.maxInFlight = Math.max(b.maxInFlight, inFlight);
      try {
        await new Promise((r) => setTimeout(r, b.latency(key)));
        if (b.failSet) throw new Error("native set failed");
        b.log.push(`set:${key}`);
        if (!b.dropWrites) b.store.set(key, value);
      } finally {
        inFlight--;
      }
    },
    async remove(key: string) {
      inFlight++;
      b.maxInFlight = Math.max(b.maxInFlight, inFlight);
      try {
        await new Promise((r) => setTimeout(r, b.latency(key)));
        if (b.failSet) throw new Error("native remove failed");
        b.log.push(`remove:${key}`);
        b.store.delete(key);
      } finally {
        inFlight--;
      }
    },
  };
  return b;
}

beforeEach(() => {
  // Only `Date` is faked (the quarantine copy records a creation time); the fake backend's timers stay real.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-24T00:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
  setDefaultStorageOverride(undefined);
  resetSaveSessionsForTests();
});

describe("hydration", () => {
  it("loads every stored key into memory so reads are synchronous", async () => {
    const backend = fakeBackend({ a: "1", b: "2" });
    const storage = await hydrateNativeStorage(backend);
    expect(storage.getItem("a")).toBe("1");
    expect(storage.getItem("b")).toBe("2");
    expect(storage.getItem("missing")).toBeNull();
  });

  it("rejects when the native store cannot be read", async () => {
    const backend = fakeBackend({ a: "1" });
    backend.failGet = true;
    await expect(hydrateNativeStorage(backend)).rejects.toThrow("native get failed");
  });

  it("a failed hydrate never lets the game start from an empty save: nothing is written and the stored save is untouched", async () => {
    const stored = JSON.stringify(createDefaultSave());
    const backend = fakeBackend({ [SAVE_STORAGE_KEY]: stored });
    backend.failGet = true;
    await initNativeStorage(backend);

    const storage = getDefaultStorage();
    expect(storage).not.toBeNull();
    // persistence.ts reads this as a failed startup read -> the page session is `load-failed` -> every write is blocked.
    const startup = loadStartupSave();
    expect(startup.pendingRound).toEqual({ kind: "none" });
    const result = persistProgress({ ...startup.save, pitzBalance: 999 });
    expect(result.blocked).toBeDefined(); // refused, whatever the exact reason code
    expect(commitProgress({ ...startup.save, pitzBalance: 999 }).status).toBe("blocked");
    expect(resetSaveResult().ok).toBe(false);

    backend.failGet = false;
    expect(backend.log).toEqual([]);
    expect(backend.store.get(SAVE_STORAGE_KEY)).toBe(stored);
  });

  it("a hydrate that fails once and then succeeds is retried", async () => {
    const backend = fakeBackend({ k: "v" });
    let first = true;
    const realKeys = backend.keys.bind(backend);
    backend.keys = async () => {
      if (first) {
        first = false;
        throw new Error("transient");
      }
      return realKeys();
    };
    await initNativeStorage(backend);
    expect(getDefaultStorage()?.getItem("k")).toBe("v");
  });
});

describe("write order", () => {
  it("writes reach the native store one at a time, in the order they were made, and the last write wins", async () => {
    const backend = fakeBackend();
    // Earlier writes are slower: an unserialized queue would let them land last.
    let n = 0;
    backend.latency = () => Math.max(0, 8 - n++);
    const storage = await hydrateNativeStorage(backend);
    for (let i = 0; i < 8; i++) storage.setItem("save", `v${i}`);
    storage.setItem("other", "x");
    storage.removeItem("other");
    await storage.flush();
    expect(backend.maxInFlight).toBe(1);
    expect(backend.log).toEqual([...Array.from({ length: 8 }, () => "set:save"), "set:other", "remove:other"]);
    expect(backend.store.get("save")).toBe("v7");
    expect(backend.store.has("other")).toBe(false);
    expect(storage.getItem("save")).toBe("v7");
  });
});

describe("write failure is reported", () => {
  it("a native write that fails is not treated as saved: later writes throw, the memory copy is unchanged, and flush rejects", async () => {
    const backend = fakeBackend({ save: "old" });
    const storage = await hydrateNativeStorage(backend);
    backend.failSet = true;
    storage.setItem("save", "new1");
    await expect(storage.flush()).rejects.toBeInstanceOf(NativeStorageWriteError);
    expect(storage.getWriteError()).not.toBeNull();
    expect(backend.store.get("save")).toBe("old");

    expect(() => storage.setItem("save", "new2")).toThrow(NativeStorageWriteError);
    expect(storage.getItem("save")).toBe("new1"); // the refused write did not enter the copy
    expect(() => storage.removeItem("save")).toThrow(NativeStorageWriteError);
  });

  it("subscribers are told about a failure and about the recovery", async () => {
    const backend = fakeBackend();
    const storage = await hydrateNativeStorage(backend);
    const seen: boolean[] = [];
    storage.subscribe((error) => seen.push(error !== null));
    backend.failSet = true;
    storage.setItem("k", "1");
    await storage.flush().catch(() => undefined);
    backend.failSet = false;
    await storage.flush();
    expect(seen).toEqual([true, false]);
    expect(backend.store.get("k")).toBe("1"); // the write that failed is not lost: it is retried and lands first
  });

  it("heals by itself: a refused write retries the queue, and after it lands the adapter accepts writes again", async () => {
    const backend = fakeBackend();
    const storage = await hydrateNativeStorage(backend);
    backend.failSet = true;
    storage.setItem("k", "1");
    await storage.flush().catch(() => undefined);
    backend.failSet = false;
    expect(() => storage.setItem("k", "2")).toThrow(NativeStorageWriteError); // refused, but kicks the retry
    await storage.flush();
    expect(storage.getWriteError()).toBeNull();
    storage.setItem("k", "3");
    await storage.flush();
    expect(backend.store.get("k")).toBe("3");
    expect(backend.log).toEqual(["set:k", "set:k"]); // "1" (retried), then "3"; "2" was refused, never queued
  });

  it("a store that accepts a write and does not hold it is a failure (read-back)", async () => {
    const backend = fakeBackend();
    const storage = await hydrateNativeStorage(backend);
    backend.dropWrites = true;
    storage.setItem("k", "1");
    await expect(storage.flush()).rejects.toBeInstanceOf(NativeStorageWriteError);
  });

  it("commitProgress reports failure (not ok) once the native store has refused a write", async () => {
    const backend = fakeBackend();
    const storage = await hydrateNativeStorage(backend);
    backend.failSet = true;
    const base = createDefaultSave();
    commitProgress({ ...base, pitzBalance: 10 }, storage);
    await storage.flush().catch(() => undefined);
    expect(commitProgress({ ...base, pitzBalance: 20 }, storage)).toEqual({ status: "failed", failure: "unavailable" });
  });
});

describe("durability across a restart", () => {
  it("a confirmed save is what a fresh hydrate (a restart) reads back", async () => {
    const backend = fakeBackend();
    const first = await hydrateNativeStorage(backend);
    setDefaultStorageOverride(first);
    loadStartupSave();
    const saved = { ...loadSave(first), pitzBalance: 123 };
    expect(persistProgress(saved).blocked).toBeUndefined();
    await first.flush();

    resetSaveSessionsForTests();
    const second = await hydrateNativeStorage(backend);
    expect(loadSave(second).pitzBalance).toBe(123);
  });

  it("a forced stop with writes still queued leaves the last confirmed save readable and unchanged", async () => {
    const backend = fakeBackend();
    const first = await hydrateNativeStorage(backend);
    first.setItem(SAVE_STORAGE_KEY, JSON.stringify({ ...createDefaultSave(), pitzBalance: 1 }));
    await first.flush();
    const confirmed = backend.store.get(SAVE_STORAGE_KEY);
    backend.latency = () => 50;
    first.setItem(SAVE_STORAGE_KEY, JSON.stringify({ ...createDefaultSave(), pitzBalance: 2 }));
    // "kill" the app here: the second write never completes (the backend only ever applies whole values).
    const second = await hydrateNativeStorage(fakeBackend(Object.fromEntries(backend.store)));
    expect(second.getItem(SAVE_STORAGE_KEY)).toBe(confirmed);
    expect(loadSave(second).pitzBalance).toBe(1);
    await first.flush();
  });
});

/**
 * The #567 / #568 protection contract must behave exactly as it does on the browser's synchronous storage. Each scenario
 * runs once on the in-memory browser-like storage and once through the adapter; the visible results and the final stored
 * bytes must be identical.
 */
describe("protection contract through the adapter equals the browser storage", () => {
  type Scenario = { name: string; stored: Record<string, string>; run: (s: StorageLike) => unknown };
  const played = (s: StorageLike) => ({ ...loadSave(s), pitzBalance: 77 });
  const withExtras = JSON.stringify({ ...JSON.parse(GOLDEN_ERAS[GOLDEN_ERAS.length - 1].raw), futureTopLevel: { keep: ["me"] } });
  const scenarios: Scenario[] = [
    { name: "empty storage, first write", stored: {}, run: (s) => persistProgress(played(s), s) },
    ...GOLDEN_ERAS.map((era) => ({
      name: `readable save (${era.name}), ordinary write`,
      stored: { [SAVE_STORAGE_KEY]: era.raw },
      run: (s: StorageLike) => persistProgress(played(s), s),
    })),
    { name: "readable save with unknown top-level fields: write keeps them", stored: { [SAVE_STORAGE_KEY]: withExtras }, run: (s) => persistProgress(played(s), s) },
    { name: "newer build's save: write refused", stored: { [SAVE_STORAGE_KEY]: FUTURE_V3 }, run: (s) => persistProgress(played(s), s) },
    { name: "newer build's save: reset keeps a copy", stored: { [SAVE_STORAGE_KEY]: FUTURE_V3 }, run: (s) => resetSaveResult(s) },
    ...UNUSABLE_ROOTS.map((root) => ({
      name: `damaged save (${root.name}): quarantined before it is replaced`,
      stored: { [SAVE_STORAGE_KEY]: root.raw },
      run: (s: StorageLike) => persistProgress(played(s), s),
    })),
    { name: "readable save: reset", stored: { [SAVE_STORAGE_KEY]: withExtras }, run: (s) => resetSaveResult(s) },
  ];

  for (const sc of scenarios) {
    it(sc.name, async () => {
      const browser = memoryStorage({ ...sc.stored });
      loadStartupSave(browser);
      const browserResult = sc.run(browser);
      const browserFinal = Object.fromEntries(browser.keys().map((k) => [k, browser.getItem(k)]));

      resetSaveSessionsForTests();
      const backend = fakeBackend({ ...sc.stored });
      const native = await hydrateNativeStorage(backend);
      loadStartupSave(native);
      const nativeResult = sc.run(native);
      await native.flush();

      expect(nativeResult).toEqual(browserResult);
      expect(Object.fromEntries(backend.store)).toEqual(
        Object.fromEntries(Object.entries(browserFinal).filter(([, v]) => v !== null)),
      );
    });
  }

  it("unknown top-level fields really are kept by the browser path (so the parity above checks something)", () => {
    const store = memoryStorage({ [SAVE_STORAGE_KEY]: withExtras });
    loadStartupSave(store);
    persistProgress(played(store), store);
    expect(JSON.parse(store.getItem(SAVE_STORAGE_KEY) as string).futureTopLevel).toEqual({ keep: ["me"] });
  });

  it("the scenarios do exercise the quarantine", () => {
    const store = memoryStorage({ [SAVE_STORAGE_KEY]: FUTURE_V3 });
    loadStartupSave(store);
    resetSaveResult(store);
    expect(store.keys().some((k) => k.includes(QUARANTINE_KEY_SUFFIX))).toBe(true);
  });
});

describe("createNativeStorage", () => {
  it("coerces values like Storage and never aliases the initial map", async () => {
    const initial = new Map([["a", "1"]]);
    const storage = createNativeStorage(fakeBackend({ a: "1" }), initial);
    storage.setItem("a", "2");
    expect(initial.get("a")).toBe("1");
    await storage.flush();
  });
});
