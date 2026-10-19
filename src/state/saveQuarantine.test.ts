import { describe, expect, it } from "vitest";
import {
  MAX_QUARANTINE_RAW_LENGTH,
  QUARANTINE_KEY_SUFFIX,
  discardQuarantine,
  quarantineKey,
  quarantineRaw,
  readQuarantine,
  type QuarantineEntry,
} from "./saveQuarantine";
import type { StorageLike } from "./persistence";
import { faultyStorage } from "./testSupport/faultyStorage";
import { memoryStorage } from "./testSupport/memoryStorage";

/** Save Compatibility Phase B PR-1 (Issue #560): the quarantine's own contract, independent of the save write path. */

const KEY = "teto-pizza-save-v1";
const AT = "2026-10-19T00:00:00.000Z";
const FIRST = quarantineKey("first", KEY);
const LATEST = quarantineKey("latest", KEY);
const isQuarantineKey = (key: string) => key.includes(QUARANTINE_KEY_SUFFIX);

function entryOf(storage: StorageLike, slot: "first" | "latest"): QuarantineEntry {
  const read = readQuarantine(storage, slot, KEY);
  if (read.kind !== "ok") throw new Error(`slot ${slot} is ${read.kind}`);
  return read.entry;
}

describe("quarantine keys", () => {
  it("sit beside the save key, one per slot, and a Preview build's sit beside the Preview save", () => {
    expect(FIRST).toBe("teto-pizza-save-v1.quarantine-v1.first");
    expect(LATEST).toBe("teto-pizza-save-v1.quarantine-v1.latest");
    expect(quarantineKey("first", "teto-pizza-preview-save-v1")).toBe("teto-pizza-preview-save-v1.quarantine-v1.first");
  });
});

describe("quarantineRaw: what is stored", () => {
  it("writes `first` with the raw text byte for byte, the kind, the length, the source key and acknowledged=false", () => {
    const storage = memoryStorage();
    const raw = '{"schemaVersion":3,"dex":[],"x":"日本語\\n\\u2028 \\"quoted\\""}';
    expect(quarantineRaw(storage, raw, "unknown-schema", AT, KEY)).toEqual({ ok: true, outcome: "written", slot: "first" });
    expect(entryOf(storage, "first")).toEqual({ v: 1, slot: "first", createdAt: AT, sourceKey: KEY, kind: "unknown-schema", rawLength: raw.length, raw, acknowledged: false });
  });

  it("keeps awkward text exactly: empty, unicode, a lone surrogate, embedded JSON, newlines", () => {
    for (const raw of ["", "{", "日本語🍕", "\ud800", '{"a":1}\n{"b":2}', "null"]) {
      const storage = memoryStorage();
      expect(quarantineRaw(storage, raw, "corrupt", AT, KEY).ok).toBe(true);
      expect(entryOf(storage, "first").raw).toBe(raw);
    }
  });

  it("records both kinds", () => {
    const a = memoryStorage();
    quarantineRaw(a, "x", "corrupt", AT, KEY);
    expect(entryOf(a, "first").kind).toBe("corrupt");
    const b = memoryStorage();
    quarantineRaw(b, "y", "unknown-schema", AT, KEY);
    expect(entryOf(b, "first").kind).toBe("unknown-schema");
  });

  it("never touches the save key", () => {
    const storage = memoryStorage({ [KEY]: "corrupt-main" });
    quarantineRaw(storage, "corrupt-main", "corrupt", AT, KEY);
    expect(storage.getItem(KEY)).toBe("corrupt-main");
  });
});

describe("quarantineRaw: slots and idempotence", () => {
  it("the same text again writes nothing (no second slot, no rewrite)", () => {
    const inner = memoryStorage();
    const storage = faultyStorage(inner);
    quarantineRaw(storage, "same", "corrupt", AT, KEY);
    const before = inner.keys().length;
    expect(quarantineRaw(storage, "same", "corrupt", "2030-01-01T00:00:00.000Z", KEY)).toEqual({ ok: true, outcome: "duplicate", slot: "first" });
    expect(inner.keys().length).toBe(before);
    expect(storage.setCount(FIRST)).toBe(1);
    expect(storage.setCount(LATEST)).toBe(0);
  });

  it("a different text goes to `latest`; a third replaces `latest`; `first` is never rewritten", () => {
    const inner = memoryStorage();
    const storage = faultyStorage(inner);
    quarantineRaw(storage, "one", "corrupt", AT, KEY);
    const firstBytes = inner.getItem(FIRST);
    expect(quarantineRaw(storage, "two", "corrupt", AT, KEY)).toEqual({ ok: true, outcome: "written", slot: "latest" });
    expect(quarantineRaw(storage, "three", "unknown-schema", AT, KEY)).toEqual({ ok: true, outcome: "written", slot: "latest" });
    expect(inner.getItem(FIRST)).toBe(firstBytes);
    expect(storage.setCount(FIRST)).toBe(1);
    expect(entryOf(inner, "latest").raw).toBe("three");
    expect(inner.keys().filter(isQuarantineKey).sort()).toEqual([FIRST, LATEST]);
  });

  it("the text held in `latest` is a duplicate too", () => {
    const storage = memoryStorage();
    quarantineRaw(storage, "one", "corrupt", AT, KEY);
    quarantineRaw(storage, "two", "corrupt", AT, KEY);
    expect(quarantineRaw(storage, "two", "corrupt", AT, KEY)).toEqual({ ok: true, outcome: "duplicate", slot: "latest" });
    expect(quarantineRaw(storage, "one", "corrupt", AT, KEY)).toEqual({ ok: true, outcome: "duplicate", slot: "first" });
  });

  it("many launches with alternating texts never create a third key", () => {
    const storage = memoryStorage();
    for (let i = 0; i < 40; i += 1) quarantineRaw(storage, `broken-${i % 5}`, "corrupt", AT, KEY);
    expect(storage.keys().filter(isQuarantineKey).length).toBeLessThanOrEqual(2);
    expect(entryOf(storage, "first").raw).toBe("broken-0");
  });

  it("an unreadable `first` envelope still counts as occupied: the next text goes to `latest`, `first` is untouched", () => {
    const storage = memoryStorage({ [FIRST]: "{not an entry" });
    expect(quarantineRaw(storage, "new", "corrupt", AT, KEY)).toEqual({ ok: true, outcome: "written", slot: "latest" });
    expect(storage.getItem(FIRST)).toBe("{not an entry");
  });

  it("an entry that belongs to another save key is not trusted as a duplicate", () => {
    const storage = memoryStorage();
    quarantineRaw(storage, "x", "corrupt", AT, "teto-pizza-preview-save-v1");
    storage.setItem(FIRST, storage.getItem(quarantineKey("first", "teto-pizza-preview-save-v1"))!);
    expect(readQuarantine(storage, "first", KEY).kind).toBe("corrupt");
    expect(quarantineRaw(storage, "x", "corrupt", AT, KEY)).toMatchObject({ ok: true, outcome: "written", slot: "latest" });
  });
});

describe("quarantineRaw: size", () => {
  it("exactly the maximum is held; one more is refused and nothing is written", () => {
    const ok = memoryStorage();
    expect(quarantineRaw(ok, "x".repeat(MAX_QUARANTINE_RAW_LENGTH), "corrupt", AT, KEY).ok).toBe(true);
    expect(entryOf(ok, "first").rawLength).toBe(MAX_QUARANTINE_RAW_LENGTH);

    const tooBig = memoryStorage();
    expect(quarantineRaw(tooBig, "x".repeat(MAX_QUARANTINE_RAW_LENGTH + 1), "corrupt", AT, KEY)).toEqual({ ok: false, reason: "too-large" });
    expect(tooBig.keys()).toEqual([]);
  });

  it("the maximum is 256 KB", () => {
    expect(MAX_QUARANTINE_RAW_LENGTH).toBe(256 * 1024);
  });
});

describe("quarantineRaw: failures are reported and leave nothing half-written", () => {
  it("a quota error on `first`: write-failed, no key left", () => {
    const inner = memoryStorage();
    const storage = faultyStorage(inner, { setThrows: isQuarantineKey });
    expect(quarantineRaw(storage, "x", "corrupt", AT, KEY)).toEqual({ ok: false, reason: "write-failed" });
    expect(inner.keys()).toEqual([]);
  });

  it("a write that is silently dropped is caught by the read-back: verify-failed", () => {
    const inner = memoryStorage();
    const storage = faultyStorage(inner, { setDrops: isQuarantineKey });
    expect(quarantineRaw(storage, "x", "corrupt", AT, KEY)).toEqual({ ok: false, reason: "verify-failed" });
    expect(inner.keys()).toEqual([]);
  });

  it("a read-back that differs from what was written is caught: verify-failed, the slot is removed", () => {
    const inner = memoryStorage();
    const storage = faultyStorage(inner, { getTransform: (key, value) => (key === FIRST && value !== null ? value.replace('"raw":"x"', '"raw":"y"') : value) });
    expect(quarantineRaw(storage, "x", "corrupt", AT, KEY)).toEqual({ ok: false, reason: "verify-failed" });
    expect(inner.getItem(FIRST)).toBeNull();
  });

  it("a read-back that parses to a well-formed entry with a DIFFERENT raw is still verify-failed", () => {
    const inner = memoryStorage();
    const storage = faultyStorage(inner, {
      getTransform: (key, value) => {
        if (key !== FIRST || value === null) return value;
        const entry = JSON.parse(value);
        return JSON.stringify({ ...entry, raw: "tampered", rawLength: 8 });
      },
    });
    expect(quarantineRaw(storage, "original", "corrupt", AT, KEY)).toEqual({ ok: false, reason: "verify-failed" });
  });

  it("a failed replacement of `latest` puts the previous `latest` back", () => {
    const inner = memoryStorage();
    quarantineRaw(inner, "one", "corrupt", AT, KEY);
    quarantineRaw(inner, "two", "corrupt", AT, KEY);
    const latestBefore = inner.getItem(LATEST);
    const failing = faultyStorage(inner, { getTransform: (key, value) => (key === LATEST && value !== null && value.includes('"raw":"three"') ? "garbled" : value) });
    expect(quarantineRaw(failing, "three", "corrupt", AT, KEY)).toEqual({ ok: false, reason: "verify-failed" });
    expect(inner.getItem(LATEST)).toBe(latestBefore);
    expect(entryOf(inner, "first").raw).toBe("one");
  });

  it("a quota error while replacing `latest` leaves the previous `latest`", () => {
    const inner = memoryStorage();
    quarantineRaw(inner, "one", "corrupt", AT, KEY);
    quarantineRaw(inner, "two", "corrupt", AT, KEY);
    const latestBefore = inner.getItem(LATEST);
    const storage = faultyStorage(inner, { setThrows: (key) => key === LATEST });
    expect(quarantineRaw(storage, "three", "corrupt", AT, KEY)).toEqual({ ok: false, reason: "write-failed" });
    expect(inner.getItem(LATEST)).toBe(latestBefore);
  });

  it("slots that cannot be read at all: storage-error, nothing written", () => {
    const inner = memoryStorage();
    const storage = faultyStorage(inner, { getThrows: isQuarantineKey });
    expect(quarantineRaw(storage, "x", "corrupt", AT, KEY)).toEqual({ ok: false, reason: "storage-error" });
    expect(inner.keys()).toEqual([]);
  });
});

describe("discardQuarantine (the only deletion)", () => {
  it("removes both slots and nothing else, and reports true", () => {
    const storage = memoryStorage({ [KEY]: "main", other: "kept" });
    quarantineRaw(storage, "one", "corrupt", AT, KEY);
    quarantineRaw(storage, "two", "corrupt", AT, KEY);
    expect(discardQuarantine(storage, KEY)).toBe(true);
    expect(storage.keys().sort()).toEqual(["other", KEY].sort());
  });

  it("is true with nothing to remove and with no storage", () => {
    expect(discardQuarantine(memoryStorage(), KEY)).toBe(true);
    expect(discardQuarantine(null, KEY)).toBe(true);
  });

  it("reports false when a slot cannot be removed, and the data is still there", () => {
    const inner = memoryStorage();
    quarantineRaw(inner, "one", "corrupt", AT, KEY);
    expect(discardQuarantine(faultyStorage(inner, { removeThrows: () => true }), KEY)).toBe(false);
    expect(discardQuarantine(faultyStorage(inner, { removeDrops: () => true }), KEY)).toBe(false);
    expect(entryOf(inner, "first").raw).toBe("one");
  });
});
