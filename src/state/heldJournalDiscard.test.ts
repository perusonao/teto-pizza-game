import { beforeEach, describe, expect, it } from "vitest";
import { SAVE_STORAGE_KEY } from "./persistence";
import { persistProgress } from "./persistence";
import { discardHeldJournal, heldJournalQuarantineKey, inspectHeldJournal } from "./heldJournalDiscard";
import { progressionSnapshotOf } from "./roundCommit";
import { quarantineKey, readQuarantine } from "./saveQuarantine";
import { resetSaveSessionsForTests } from "./saveSession";
import { faultyStorage } from "./testSupport/faultyStorage";
import { memoryStorage, type MemoryStorage } from "./testSupport/memoryStorage";
import { FUTURE_V3, GOLDEN_ERAS } from "./testSupport/saveGoldenFixtures";
import { SEED_SAVE, Tab, fugazzaAtBake, onionPizza } from "./testSupport/r8Harness";
import type { HeldPendingRoundReason } from "./pendingRound";

/**
 * Save P1-1 (Issue #664): a held `pendingRound` is removed only after a verified copy of the whole save, on explicit request, and
 * nothing but that one key changes.
 */

const QKEY = heldJournalQuarantineKey();
const FIRST = quarantineKey("first", QKEY);
const LATEST = quarantineKey("latest", QKEY);

const BASE = { schemaVersion: 2, dex: [], pitzBalance: 40, ownedIngredientIds: ["onion"], missionBest: {}, inventory: { onion: 20 } };

const stray = {
  v: 1, id: "late-1", status: "pending", kind: "GUIDED", recipeId: "fugazza", bakeValue: 70, createdAt: 1,
  pizza: { ...onionPizza(5), toppings: [{ id: "t1", ingredientId: "ingredient-from-a-later-catalog", x: 1, y: 1 }], doughShape: { radii: [18, 18, 18, 18, 18, 18, 18, 18] } },
};

const HELD: Record<HeldPendingRoundReason, unknown> = {
  "unknown-version": { v: 2, id: "future-1", status: "pending", anything: { new: "shape" } },
  corrupt: { v: 1, id: 5, status: "pending" },
  unresolvable: stray,
  oversize: { v: 1, id: "big-1", status: "pending", padding: "x".repeat(70 * 1024) },
};

function saveWith(journal: unknown, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ ...BASE, ...extra, pendingRound: journal });
}

function without<T extends Record<string, unknown>>(raw: string): Omit<T, "pendingRound"> {
  const { pendingRound: _removed, ...rest } = JSON.parse(raw) as T;
  return rest;
}

/** A page on `storage`: starts the save session the way App does. Its startup save effect may re-serialize the save, so tests read the stored text afterwards. */
function page(storage: MemoryStorage) {
  return new Tab(storage);
}

function discard(storage: MemoryStorage, _journal: unknown, options: { replace?: boolean } = {}) {
  const inspected = inspectHeldJournal(storage);
  if (!inspected.ok) throw new Error(`inspect failed: ${inspected.reason}`);
  return discardHeldJournal(storage, {
    expected: { reason: inspected.inspection.reason, journalJson: inspected.inspection.journalJson },
    confirmReplaceLatest: options.replace === true,
  });
}

beforeEach(() => resetSaveSessionsForTests());

describe("the four held reasons: copy, verify, then remove only the journal", () => {
  for (const reason of Object.keys(HELD) as HeldPendingRoundReason[]) {
    it(`${reason}: the whole save is copied verbatim, the journal is gone, every other value is unchanged`, () => {
      let raw = saveWith(HELD[reason], { futureTopLevel: { keep: ["me"] }, researchExclusions: {}, dinnerMissionRecords: { m: { best: 1 } } });
      const storage = memoryStorage({ [SAVE_STORAGE_KEY]: raw, "unrelated-key": "keep" });
      const tab = page(storage);
      expect(tab.held).toBe(reason);
      raw = storage.getItem(SAVE_STORAGE_KEY)!;
      expect(raw).toContain("pendingRound");
      const result = discard(storage, HELD[reason]);
      expect(result).toEqual({ ok: true, outcome: "written", slot: "first" });
      // the copy is the whole save text, byte for byte
      const copy = readQuarantine(storage, "first", QKEY);
      expect(copy.kind === "ok" && copy.entry.raw).toBe(raw);
      expect(copy.kind === "ok" && copy.entry.kind).toBe("held-journal");
      // the save is the old save minus that one key (values and key order)
      const after = storage.getItem(SAVE_STORAGE_KEY)!;
      expect(JSON.parse(after)).toEqual(without(raw));
      expect(Object.keys(JSON.parse(after) as object)).toEqual(Object.keys(without(raw)));
      expect(after).not.toContain("pendingRound");
      // no other key was created or touched
      expect(storage.getItem("unrelated-key")).toBe("keep");
      expect(storage.keys().sort()).toEqual([SAVE_STORAGE_KEY, FIRST, "unrelated-key"].sort());
    });
  }

  it("the save's own quarantine keys are neither created nor touched", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: saveWith(HELD.corrupt) });
    page(storage);
    discard(storage, HELD.corrupt);
    expect(storage.keys().some((k) => k.startsWith(`${SAVE_STORAGE_KEY}.quarantine-v1`))).toBe(false);
  });

  for (const era of GOLDEN_ERAS) {
    it(`golden era "${era.name}" with a held journal: only that key differs afterwards`, () => {
      const withJournal = JSON.stringify({ ...(JSON.parse(era.raw) as object), pendingRound: HELD.unresolvable });
      const storage = memoryStorage({ [SAVE_STORAGE_KEY]: withJournal });
      page(storage);
      const startedWith = storage.getItem(SAVE_STORAGE_KEY)!; // the page's own startup save may have normalised the text
      expect(discard(storage, HELD.unresolvable).ok).toBe(true);
      expect(JSON.parse(storage.getItem(SAVE_STORAGE_KEY)!)).toEqual(without(startedWith));
    });
  }
});

describe("after the discard the bake that needs a journal works again", () => {
  it("occupied before, a CUT bake commits after; the new journal is the only difference", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: saveWith(HELD["unknown-version"]) });
    const tab = page(storage);
    tab.setRound(fugazzaAtBake({ onion: 20 }, { base: tab.state }));
    expect(tab.bake()).toEqual({ status: "refused", commit: { status: "failed", failure: "occupied" } });
    expect(discard(storage, null).ok).toBe(true);
    const step = tab.bake();
    expect(step.status).toBe("committed");
    expect((tab.stored().pendingRound as { status: string }).status).toBe("pending");
  });
});

describe("refusals: nothing is copied and nothing is removed", () => {
  function untouched(storage: MemoryStorage, raw: string) {
    expect(storage.getItem(SAVE_STORAGE_KEY)).toBe(raw);
    expect(storage.getItem(FIRST)).toBeNull();
    expect(storage.getItem(LATEST)).toBeNull();
  }

  it("a pending journal (this build can act on it) is refused", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: SEED_SAVE });
    const tab = page(storage);
    tab.setRound(fugazzaAtBake({ onion: 20 }, { base: tab.state }));
    tab.bake();
    const raw = storage.getItem(SAVE_STORAGE_KEY)!;
    expect((tab.stored().pendingRound as { status: string }).status).toBe("pending");
    expect(inspectHeldJournal(storage)).toEqual({ ok: false, reason: "not-held" });
    expect(discardHeldJournal(storage, { expected: { reason: "corrupt", journalJson: "{}" }, confirmReplaceLatest: true })).toEqual({ ok: false, reason: "not-held" });
    untouched(storage, raw);
  });

  it("a settled journal is refused", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: SEED_SAVE });
    const tab = page(storage);
    tab.setRound(fugazzaAtBake({ onion: 20 }, { base: tab.state }));
    tab.bake();
    expect(tab.goHome().status).toBe("settled");
    const raw = storage.getItem(SAVE_STORAGE_KEY)!;
    expect((tab.stored().pendingRound as { status: string }).status).toBe("settled");
    expect(discardHeldJournal(storage, { expected: { reason: "corrupt", journalJson: "{}" }, confirmReplaceLatest: true })).toEqual({ ok: false, reason: "not-held" });
    untouched(storage, raw);
  });

  it("no journal at all is refused", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: SEED_SAVE });
    page(storage);
    expect(inspectHeldJournal(storage)).toEqual({ ok: false, reason: "not-held" });
  });

  it("a save this build cannot read (newer schema, damaged text) is refused", () => {
    for (const raw of [FUTURE_V3.replace("}", ',"pendingRound":{"v":9}}'), "{not json"]) {
      const storage = memoryStorage({ [SAVE_STORAGE_KEY]: raw });
      page(storage);
      expect(inspectHeldJournal(storage)).toEqual({ ok: false, reason: "not-readable" });
      untouched(storage, raw);
    }
  });

  it("a journal other than the one that was shown is refused (changed)", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: saveWith(HELD.corrupt) });
    page(storage);
    const raw = storage.getItem(SAVE_STORAGE_KEY)!;
    const result = discardHeldJournal(storage, { expected: { reason: "corrupt", journalJson: '{"other":1}' }, confirmReplaceLatest: false });
    expect(result).toEqual({ ok: false, reason: "changed" });
    const reason = discardHeldJournal(storage, { expected: { reason: "oversize", journalJson: inspectJson(storage) }, confirmReplaceLatest: false });
    expect(reason).toEqual({ ok: false, reason: "changed" });
    untouched(storage, raw);
  });

  it("a page whose startup read failed (load-failed) is refused", () => {
    const raw = saveWith(HELD.corrupt);
    const inner = memoryStorage({ [SAVE_STORAGE_KEY]: raw });
    let failing = true;
    const storage = faultyStorage(inner, { getThrows: (key) => failing && key === SAVE_STORAGE_KEY });
    new Tab(storage as unknown as MemoryStorage);
    failing = false;
    expect(inner.getItem(SAVE_STORAGE_KEY)).toBe(raw); // the failed-load page wrote nothing
    expect(inspectHeldJournal(storage)).toEqual({ ok: false, reason: "load-failed" });
    untouched(inner, raw);
  });

  it("a second operation after a success finds nothing to discard", () => {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: saveWith(HELD.corrupt) });
    page(storage);
    const inspected = inspectHeldJournal(storage);
    if (!inspected.ok) throw new Error("inspect");
    const options = { expected: { reason: inspected.inspection.reason, journalJson: inspected.inspection.journalJson }, confirmReplaceLatest: false };
    expect(discardHeldJournal(storage, options).ok).toBe(true);
    const after = storage.getItem(SAVE_STORAGE_KEY);
    expect(discardHeldJournal(storage, options)).toEqual({ ok: false, reason: "not-held" });
    expect(storage.getItem(SAVE_STORAGE_KEY)).toBe(after);
  });
});

function inspectJson(storage: MemoryStorage): string {
  const r = inspectHeldJournal(storage);
  if (!r.ok) throw new Error("inspect");
  return r.inspection.journalJson;
}

describe("a copy that cannot be made means nothing is removed", () => {
  function setup(faults: Parameters<typeof faultyStorage>[1]) {
    const inner = memoryStorage({ [SAVE_STORAGE_KEY]: saveWith(HELD.unresolvable) });
    const storage = faultyStorage(inner, faults);
    new Tab(storage as unknown as MemoryStorage);
    return { raw: inner.getItem(SAVE_STORAGE_KEY)!, inner, storage };
  }
  function run(storage: ReturnType<typeof faultyStorage>) {
    const inspected = inspectHeldJournal(storage);
    if (!inspected.ok) throw new Error("inspect");
    return discardHeldJournal(storage, { expected: { reason: inspected.inspection.reason, journalJson: inspected.inspection.journalJson }, confirmReplaceLatest: true });
  }

  it("quota on the copy: backup-failed, the save is byte-identical, no copy remains", () => {
    const { raw, inner, storage } = setup({ setThrows: (k) => k.startsWith(QKEY) });
    expect(run(storage)).toEqual({ ok: false, reason: "backup-failed" });
    expect(inner.getItem(SAVE_STORAGE_KEY)).toBe(raw);
    expect(inner.keys()).toEqual([SAVE_STORAGE_KEY]);
  });

  it("a copy that is silently dropped: backup-failed, the save is byte-identical", () => {
    const { raw, inner, storage } = setup({ setDrops: (k) => k.startsWith(QKEY) });
    expect(run(storage)).toEqual({ ok: false, reason: "backup-failed" });
    expect(inner.getItem(SAVE_STORAGE_KEY)).toBe(raw);
  });

  it("a copy that reads back differently: backup-failed, the save is byte-identical, no copy remains", () => {
    const { raw, inner, storage } = setup({ getTransform: (k, v) => (k === FIRST && v ? v.replace("late-1", "tampered") : v) });
    expect(run(storage)).toEqual({ ok: false, reason: "backup-failed" });
    expect(inner.getItem(SAVE_STORAGE_KEY)).toBe(raw);
    expect(inner.getItem(FIRST)).toBeNull();
  });

  it("a save above the copy limit cannot be copied: too-large, nothing changes", () => {
    const raw = saveWith(HELD.corrupt, { padding: "y".repeat(260 * 1024) });
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: raw });
    page(storage);
    const startedWith = storage.getItem(SAVE_STORAGE_KEY);
    expect(inspectHeldJournal(storage)).toEqual({ ok: false, reason: "too-large" });
    expect(storage.getItem(SAVE_STORAGE_KEY)).toBe(startedWith);
  });

  it("the copy is written but the save write throws: write-failed, the save is unchanged, the copy stays, a retry succeeds as a duplicate", () => {
    const inner = memoryStorage({ [SAVE_STORAGE_KEY]: saveWith(HELD.unresolvable) });
    let fail = false;
    const storage = faultyStorage(inner, { setThrows: (k) => fail && k === SAVE_STORAGE_KEY });
    new Tab(storage as unknown as MemoryStorage);
    const raw = inner.getItem(SAVE_STORAGE_KEY)!;
    fail = true;
    expect(run(storage)).toEqual({ ok: false, reason: "write-failed" });
    expect(inner.getItem(SAVE_STORAGE_KEY)).toBe(raw);
    expect(readQuarantine(inner, "first", QKEY).kind).toBe("ok");
    fail = false;
    expect(run(storage)).toEqual({ ok: true, outcome: "duplicate", slot: "first" });
    expect(JSON.parse(inner.getItem(SAVE_STORAGE_KEY)!)).toEqual(without(raw));
  });

  it("the save write is dropped: verify-failed; it is not repaired, the copy stays", () => {
    const inner = memoryStorage({ [SAVE_STORAGE_KEY]: saveWith(HELD.unresolvable) });
    let drop = false;
    const storage = faultyStorage(inner, { setDrops: (k) => drop && k === SAVE_STORAGE_KEY });
    new Tab(storage as unknown as MemoryStorage);
    const raw = inner.getItem(SAVE_STORAGE_KEY)!;
    drop = true;
    expect(run(storage)).toEqual({ ok: false, reason: "verify-failed" });
    expect(inner.getItem(SAVE_STORAGE_KEY)).toBe(raw);
    expect(readQuarantine(inner, "first", QKEY).kind).toBe("ok");
  });

  it("the save write reads back as something else (another tab's save?): verify-failed, and nothing is written to repair it", () => {
    const inner = memoryStorage({ [SAVE_STORAGE_KEY]: saveWith(HELD.unresolvable) });
    const other = JSON.stringify({ ...BASE, pitzBalance: 999 });
    const storage = faultyStorage(inner, {
      // the read-back of the removal write: the stored text no longer has the journal, and reads as someone else's save
      getTransform: (k, v) => (k === SAVE_STORAGE_KEY && v !== null && !v.includes("pendingRound") ? other : v),
    });
    new Tab(storage as unknown as MemoryStorage);
    const before = storage.setCount(SAVE_STORAGE_KEY);
    expect(run(storage)).toEqual({ ok: false, reason: "verify-failed" });
    expect(storage.setCount(SAVE_STORAGE_KEY) - before).toBe(1); // only the removal write; no "put it back" write
  });
});

describe("another tab's update is never overwritten", () => {
  it("tab B saves after tab A showed the dialog: A is refused (stale-save) and B's data is intact", () => {
    const a = memoryStorage({ [SAVE_STORAGE_KEY]: saveWith(HELD.corrupt) });
    const b = a.view();
    page(a);
    const tabB = page(b);
    const shown = inspectHeldJournal(a);
    if (!shown.ok) throw new Error("inspect");
    // B plays on (a Pitz change) and writes; the held journal rides along untouched
    persistProgress({ ...progressionSnapshotOf(tabB.state, undefined), pitzBalance: 77 }, b);
    const bText = b.getItem(SAVE_STORAGE_KEY)!;
    expect(JSON.parse(bText).pitzBalance).toBe(77);
    const result = discardHeldJournal(a, { expected: { reason: shown.inspection.reason, journalJson: shown.inspection.journalJson }, confirmReplaceLatest: false });
    expect(result).toEqual({ ok: false, reason: "stale-save" });
    expect(a.getItem(SAVE_STORAGE_KEY)).toBe(bText);
    expect(a.getItem(FIRST)).toBeNull();
  });

  it("another tab writes between the copy and the removal: stale-during-discard; the other tab's save stays and a failed removal never writes the old text back", () => {
    const inner = memoryStorage({ [SAVE_STORAGE_KEY]: saveWith(HELD.corrupt) });
    const otherSave = JSON.stringify({ ...BASE, pitzBalance: 123, pendingRound: HELD.corrupt });
    const storage = faultyStorage(inner, {});
    const originalSet = storage.setItem.bind(storage);
    storage.setItem = (key, value) => {
      originalSet(key, value);
      if (key === FIRST) inner.setItem(SAVE_STORAGE_KEY, otherSave); // the other tab saves right after our copy
    };
    new Tab(storage as unknown as MemoryStorage);
    const shown = inspectHeldJournal(storage);
    if (!shown.ok) throw new Error("inspect");
    const result = discardHeldJournal(storage, { expected: { reason: shown.inspection.reason, journalJson: shown.inspection.journalJson }, confirmReplaceLatest: false });
    expect(result).toEqual({ ok: false, reason: "stale-during-discard" });
    expect(inner.getItem(SAVE_STORAGE_KEY)).toBe(otherSave);
  });
});

describe("the backup slots: first is kept, latest is replaced only when confirmed", () => {
  function twoBackups() {
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: saveWith(HELD.corrupt, { pitzBalance: 1 }) });
    page(storage);
    expect(discard(storage, null).ok).toBe(true); // -> first
    storage.setItem(SAVE_STORAGE_KEY, saveWith(HELD.corrupt, { pitzBalance: 2 }));
    resetSaveSessionsForTests();
    page(storage);
    expect(discard(storage, null)).toEqual({ ok: true, outcome: "written", slot: "latest" }); // -> latest (empty)
    storage.setItem(SAVE_STORAGE_KEY, saveWith(HELD.corrupt, { pitzBalance: 3 }));
    resetSaveSessionsForTests();
    page(storage);
    return storage;
  }

  it("with both slots held by other saves, a third copy needs confirmation; unconfirmed it changes nothing", () => {
    const storage = twoBackups();
    const before = [storage.getItem(SAVE_STORAGE_KEY), storage.getItem(FIRST), storage.getItem(LATEST)];
    const shown = inspectHeldJournal(storage);
    expect(shown.ok && shown.inspection.replacesLatest).toBe(true);
    expect(discard(storage, null)).toEqual({ ok: false, reason: "replace-not-confirmed" });
    expect([storage.getItem(SAVE_STORAGE_KEY), storage.getItem(FIRST), storage.getItem(LATEST)]).toEqual(before);
  });

  it("confirmed: first is untouched, latest holds the new copy, the journal is removed", () => {
    const storage = twoBackups();
    const firstBefore = storage.getItem(FIRST);
    const newRaw = storage.getItem(SAVE_STORAGE_KEY)!;
    expect(discard(storage, null, { replace: true })).toEqual({ ok: true, outcome: "written", slot: "latest" });
    expect(storage.getItem(FIRST)).toBe(firstBefore);
    const latest = readQuarantine(storage, "latest", QKEY);
    expect(latest.kind === "ok" && latest.entry.raw).toBe(newRaw);
    expect(storage.getItem(SAVE_STORAGE_KEY)).not.toContain("pendingRound");
  });

  it("a replacement whose copy fails restores the previous latest", () => {
    const storage = twoBackups();
    const latestBefore = storage.getItem(LATEST);
    const faulty = faultyStorage(storage, { getTransform: (k, v) => (k === LATEST && v && v.includes('pitzBalance\\":3') ? v.replace('"acknowledged":false', '"acknowledged":true') : v) });
    // the new entry reads back differently from what was written: verify fails and the slot is put back
    const inspected = inspectHeldJournal(faulty);
    if (!inspected.ok) throw new Error("inspect");
    const result = discardHeldJournal(faulty, { expected: { reason: inspected.inspection.reason, journalJson: inspected.inspection.journalJson }, confirmReplaceLatest: true });
    expect(result).toEqual({ ok: false, reason: "backup-failed" });
    expect(storage.getItem(LATEST)).toBe(latestBefore);
    expect(storage.getItem(SAVE_STORAGE_KEY)).toContain("pendingRound");
  });
});

describe("a held journal and the other round kinds", () => {
  it("Lunch Rush and Dinner never read the journal slot: the discard changes none of their saved values", () => {
    const raw = saveWith(HELD.corrupt, { missionBest: { "lunch-rush": 500 }, dinnerMissionRecords: { "dinner-1": { cleared: true } } });
    const storage = memoryStorage({ [SAVE_STORAGE_KEY]: raw });
    page(storage);
    discard(storage, null);
    const after = JSON.parse(storage.getItem(SAVE_STORAGE_KEY)!) as Record<string, unknown>;
    expect(after.missionBest).toEqual({ "lunch-rush": 500 });
    expect(after.dinnerMissionRecords).toEqual({ "dinner-1": { cleared: true } });
  });
});
