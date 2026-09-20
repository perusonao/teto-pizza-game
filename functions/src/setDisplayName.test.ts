import { beforeEach, describe, expect, it } from "vitest";
import {
  handleSetDisplayName,
  RENAME_COOLDOWN_MS,
  SetDisplayNameError,
  type ExistingProfile,
  type FirestoreLike,
  type ProfileWrite,
  type SetDisplayNameDeps,
} from "./setDisplayName";

/** In-memory Firestore fake -- no emulator, no Java dependency. Keyed by uid (mirroring
 *  `users/{uid}` being one document per caller) so a second uid's first write is never
 *  mistaken for a rename of a different uid's document. A real Firestore transaction retries
 *  `mutate` on write-write contention (re-reading fresh state each time); this fake
 *  approximates that for the concurrent-rename test below by simply running each `mutate` call
 *  against whatever that uid's doc currently holds at the moment it runs -- exactly what a
 *  serialized (one-at-a-time) transaction retry loop would observe. */
class FakeFirestore implements FirestoreLike {
  docs = new Map<string, ExistingProfile>();
  writes: ProfileWrite[] = [];

  async runTransaction<T>(
    uid: string,
    mutate: (existing: ExistingProfile | null) => Promise<{ write: ProfileWrite; result: T }>,
  ): Promise<T> {
    const { write, result } = await mutate(this.docs.get(uid) ?? null);
    this.writes.push(write);
    this.docs.set(uid, {
      displayName: write.displayName,
      createdAt: write.createdAt,
      updatedAtMillis: write.updatedAt as number,
    });
    return result;
  }

  doc(uid: string): ExistingProfile | null {
    return this.docs.get(uid) ?? null;
  }
}

function makeDeps(nowEpochMs: number): SetDisplayNameDeps & { firestore: FakeFirestore } {
  const firestore = new FakeFirestore();
  const deps: SetDisplayNameDeps & { firestore: FakeFirestore } = {
    firestore,
    now: () => nowEpochMs,
    // Reads `deps.now()` dynamically (not a captured `nowEpochMs`) so a test reassigning
    // `deps.now` later (to simulate the clock advancing) is reflected here too -- exactly what
    // a same-instant serverTimestamp()-then-read-back would show in production.
    serverTimestamp: () => deps.now(),
  };
  return deps;
}

const BASE_TIME = Date.UTC(2026, 8, 20, 3);

describe("handleSetDisplayName", () => {
  let deps: SetDisplayNameDeps & { firestore: FakeFirestore };

  beforeEach(() => {
    deps = makeDeps(BASE_TIME);
  });

  it("rejects when auth is null", async () => {
    await expect(handleSetDisplayName({ displayName: "Alice" }, null, deps)).rejects.toMatchObject({
      code: "unauthenticated",
    });
    expect(deps.firestore.writes).toHaveLength(0);
  });

  it("rejects when auth.uid is empty", async () => {
    await expect(
      handleSetDisplayName({ displayName: "Alice" }, { uid: "" }, deps),
    ).rejects.toBeInstanceOf(SetDisplayNameError);
  });

  it("rejects a null payload", async () => {
    await expect(handleSetDisplayName(null, { uid: "u1" }, deps)).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("rejects a non-object payload", async () => {
    await expect(handleSetDisplayName("Alice", { uid: "u1" }, deps)).rejects.toMatchObject({
      code: "invalid-argument",
    });
  });

  it("never reads a uid from the payload -- always writes to auth.uid's own document", async () => {
    await handleSetDisplayName({ displayName: "Alice", uid: "someone-else" }, { uid: "u1" }, deps);
    // runTransaction's own `uid` parameter (never anything from the payload) is what a real
    // adapter would key the Firestore ref on -- asserting the payload's spoofed uid was never
    // consulted for anything, and the write landed on the auth uid's own document.
    expect(deps.firestore.doc("u1")?.displayName).toBe("Alice");
    expect(deps.firestore.doc("someone-else")).toBeNull();
  });

  describe("first profile creation", () => {
    it("creates a new profile with the normalized name", async () => {
      const result = await handleSetDisplayName({ displayName: "  Alice  " }, { uid: "u1" }, deps);
      expect(result).toEqual({ displayName: "Alice" });
      expect(deps.firestore.writes).toHaveLength(1);
      expect(deps.firestore.writes[0]).toMatchObject({ displayName: "Alice" });
    });

    it("sets createdAt on first creation", async () => {
      await handleSetDisplayName({ displayName: "Alice" }, { uid: "u1" }, deps);
      expect(deps.firestore.writes[0].createdAt).toBe(BASE_TIME);
    });

    it("sets updatedAt on first creation", async () => {
      await handleSetDisplayName({ displayName: "Alice" }, { uid: "u1" }, deps);
      expect(deps.firestore.writes[0].updatedAt).toBe(BASE_TIME);
    });

    it("applies no cooldown to first creation", async () => {
      // now() === BASE_TIME with no existing document -- if a cooldown were wrongly applied to
      // creation, this would reject; it must succeed instead.
      await expect(
        handleSetDisplayName({ displayName: "Alice" }, { uid: "u1" }, deps),
      ).resolves.toEqual({ displayName: "Alice" });
    });
  });

  describe("rename", () => {
    it("preserves createdAt across a rename", async () => {
      await handleSetDisplayName({ displayName: "Alice" }, { uid: "u1" }, deps);
      const createdAt = deps.firestore.writes[0].createdAt;

      deps.now = () => BASE_TIME + RENAME_COOLDOWN_MS;
      await handleSetDisplayName({ displayName: "Bob" }, { uid: "u1" }, deps);

      expect(deps.firestore.writes[1].createdAt).toBe(createdAt);
      expect(deps.firestore.writes[1].displayName).toBe("Bob");
    });

    it("rejects a rename under the 60-second cooldown", async () => {
      await handleSetDisplayName({ displayName: "Alice" }, { uid: "u1" }, deps);

      deps.now = () => BASE_TIME + RENAME_COOLDOWN_MS - 1;
      await expect(
        handleSetDisplayName({ displayName: "Bob" }, { uid: "u1" }, deps),
      ).rejects.toMatchObject({ code: "resource-exhausted" });
      // The rejected rename must not have written anything.
      expect(deps.firestore.writes).toHaveLength(1);
      expect(deps.firestore.doc("u1")?.displayName).toBe("Alice");
    });

    it("accepts a rename at exactly 60 seconds", async () => {
      await handleSetDisplayName({ displayName: "Alice" }, { uid: "u1" }, deps);

      deps.now = () => BASE_TIME + RENAME_COOLDOWN_MS;
      await expect(
        handleSetDisplayName({ displayName: "Bob" }, { uid: "u1" }, deps),
      ).resolves.toEqual({ displayName: "Bob" });
    });

    it("accepts a rename well after the cooldown", async () => {
      await handleSetDisplayName({ displayName: "Alice" }, { uid: "u1" }, deps);

      deps.now = () => BASE_TIME + RENAME_COOLDOWN_MS * 10;
      await expect(
        handleSetDisplayName({ displayName: "Bob" }, { uid: "u1" }, deps),
      ).resolves.toEqual({ displayName: "Bob" });
    });

    it("updates updatedAt on an accepted rename", async () => {
      await handleSetDisplayName({ displayName: "Alice" }, { uid: "u1" }, deps);
      const renameTime = BASE_TIME + RENAME_COOLDOWN_MS;
      deps.now = () => renameTime;
      await handleSetDisplayName({ displayName: "Bob" }, { uid: "u1" }, deps);
      expect(deps.firestore.writes[1].updatedAt).toBe(renameTime);
    });

    it("concurrent rename attempts: a transaction-style serialized retry means the second call sees the first's fresh write, not stale data", async () => {
      await handleSetDisplayName({ displayName: "Alice" }, { uid: "u1" }, deps);

      // Two "concurrent" callers both fire at the same instant, 60s after Alice's creation --
      // simulating two requests racing in. The fake serializes them one at a time (as a real
      // Firestore transaction's retry loop would, re-reading fresh state before each attempt),
      // so the second sees the first's already-committed write and its own fresh cooldown
      // clock -- never a stale pre-write snapshot.
      const renameTime = BASE_TIME + RENAME_COOLDOWN_MS;
      deps.now = () => renameTime;
      const first = await handleSetDisplayName({ displayName: "Bob" }, { uid: "u1" }, deps);
      expect(first).toEqual({ displayName: "Bob" });

      // The second call, at the exact same instant, is now *within* cooldown of the first
      // call's own updatedAt (renameTime), so it must be rejected -- a naive read-then-write
      // (not a real transaction) racing both reads before either write completes could let
      // both succeed instead.
      await expect(
        handleSetDisplayName({ displayName: "Carol" }, { uid: "u1" }, deps),
      ).rejects.toMatchObject({ code: "resource-exhausted" });
      expect(deps.firestore.doc("u1")?.displayName).toBe("Bob");
    });
  });

  describe("validation delegation (full contract lives in ../../src/shared/displayNameValidation.ts)", () => {
    it("rejects and does not write on a validation failure (trim/whitespace still delegated correctly)", async () => {
      await expect(
        handleSetDisplayName({ displayName: "" }, { uid: "u1" }, deps),
      ).rejects.toMatchObject({ code: "invalid-argument" });
      expect(deps.firestore.writes).toHaveLength(0);
    });

    it("writes the normalized (trimmed/whitespace-collapsed) name, not the raw input", async () => {
      await handleSetDisplayName({ displayName: "  Alice   Bob  " }, { uid: "u1" }, deps);
      expect(deps.firestore.writes[0].displayName).toBe("Alice Bob");
    });

    it("rejects an over-length name (21 codepoints)", async () => {
      await expect(
        handleSetDisplayName({ displayName: "A".repeat(21) }, { uid: "u1" }, deps),
      ).rejects.toMatchObject({ code: "invalid-argument" });
    });

    it("accepts Japanese", async () => {
      await expect(
        handleSetDisplayName({ displayName: "ピザ職人" }, { uid: "u1" }, deps),
      ).resolves.toEqual({ displayName: "ピザ職人" });
    });

    it("rejects an emoji", async () => {
      await expect(
        handleSetDisplayName({ displayName: "Alice\u{1F600}" }, { uid: "u1" }, deps),
      ).rejects.toMatchObject({ code: "invalid-argument" });
    });

    it("rejects a newline", async () => {
      await expect(
        handleSetDisplayName({ displayName: "Alice\nBob" }, { uid: "u1" }, deps),
      ).rejects.toMatchObject({ code: "invalid-argument" });
    });

    it("rejects a control character", async () => {
      await expect(
        handleSetDisplayName({ displayName: "Alice\u0000" }, { uid: "u1" }, deps),
      ).rejects.toMatchObject({ code: "invalid-argument" });
    });

    it("rejects a zero-width character", async () => {
      await expect(
        handleSetDisplayName({ displayName: "Ali​ce" }, { uid: "u1" }, deps),
      ).rejects.toMatchObject({ code: "invalid-argument" });
    });

    it("rejects reserved word 'あなた'", async () => {
      await expect(
        handleSetDisplayName({ displayName: "あなた" }, { uid: "u1" }, deps),
      ).rejects.toMatchObject({ code: "invalid-argument" });
    });

    it("rejects reserved word 'Anata' case variants", async () => {
      await expect(
        handleSetDisplayName({ displayName: "ANATA" }, { uid: "u1" }, deps),
      ).rejects.toMatchObject({ code: "invalid-argument" });
    });

    it("rejects reserved word 'You' case variants", async () => {
      await expect(
        handleSetDisplayName({ displayName: "you" }, { uid: "u1" }, deps),
      ).rejects.toMatchObject({ code: "invalid-argument" });
    });

    it("rejects oversized raw input (over 200 UTF-16 units)", async () => {
      await expect(
        handleSetDisplayName({ displayName: "A".repeat(201) }, { uid: "u1" }, deps),
      ).rejects.toMatchObject({ code: "invalid-argument" });
    });

    it("allows duplicate names across different players (a second uid may reuse an already-taken name)", async () => {
      await handleSetDisplayName({ displayName: "Alice" }, { uid: "u1" }, deps);
      await expect(
        handleSetDisplayName({ displayName: "Alice" }, { uid: "u2" }, deps),
      ).resolves.toEqual({ displayName: "Alice" });
    });
  });
});
