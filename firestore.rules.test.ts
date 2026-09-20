import { afterAll, beforeAll, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

/**
 * Firebase Ranking 1.0 Phase 1B/2A (Issue #87). Exercises `firestore.rules` against a real
 * Firestore emulator (`@firebase/rules-unit-testing`) -- not a unit test of application code,
 * a verification that the deployed rules actually deny what this task requires them to deny.
 * Deliberately NOT wired into the root `npm test` (see docs/design/
 * TETO_FIREBASE-RANKING_SETUP.md's Phase 1B "Local/emulator setup" section) -- it needs a
 * running Firestore emulator (Java) and `@firebase/rules-unit-testing` installed
 * (`npm install --no-save @firebase/rules-unit-testing`), neither of which the main app/CI
 * needs for anything else, so this stays a manually-run verification rather than a permanent
 * project dependency.
 *
 * Run (after `npm install --no-save @firebase/rules-unit-testing`):
 *   npx firebase-tools emulators:exec --only firestore \
 *     "npx vitest run --config vitest.rules.config.ts"
 */

const PROJECT_ID = "demo-teto-pizza-game-rules-test";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("firestore.rules", () => {
  describe("runs/{runId}", () => {
    it("denies an authenticated client read", async () => {
      const alice = testEnv.authenticatedContext("alice");
      await assertFails(getDoc(doc(alice.firestore(), "runs/run1")));
    });

    it("denies an authenticated client write -- the exact 'browser writes a fake run' attack", async () => {
      const alice = testEnv.authenticatedContext("alice");
      await assertFails(
        setDoc(doc(alice.firestore(), "runs/run1"), { uid: "alice", score: 999_999 }),
      );
    });

    it("denies an unauthenticated write", async () => {
      const anon = testEnv.unauthenticatedContext();
      await assertFails(setDoc(doc(anon.firestore(), "runs/run1"), { score: 1 }));
    });
  });

  describe("leaderboards/{periodId}/entries/{uid}", () => {
    // Firebase Ranking 1.0 Phase 2A (Issue #87): the one loosening this phase makes --
    // `weekly_*` entries become publicly readable (WeeklyRankingOverlay's read path), while
    // every write stays denied exactly as Phase 1B left it, and `monthly_*`/`all_all` (no
    // Phase 2A UI reads them) stay just as read-denied as they were before this phase too.
    describe("weekly_* (Phase 2A: public read)", () => {
      it("A. allows an unauthenticated client read", async () => {
        const anon = testEnv.unauthenticatedContext();
        await assertSucceeds(getDoc(doc(anon.firestore(), "leaderboards/weekly_2026-W38/entries/alice")));
      });

      it("B. allows an authenticated client read", async () => {
        const alice = testEnv.authenticatedContext("alice");
        await assertSucceeds(getDoc(doc(alice.firestore(), "leaderboards/weekly_2026-W38/entries/alice")));
      });

      it("C. denies an authenticated client write -- the exact '{ score: 999999 }' attack Issue #87 calls out", async () => {
        const alice = testEnv.authenticatedContext("alice");
        await assertFails(
          setDoc(doc(alice.firestore(), "leaderboards/weekly_2026-W38/entries/alice"), { score: 999_999 }),
        );
      });

      it("D. denies a client update to an existing entry", async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
          await setDoc(doc(context.firestore(), "leaderboards/weekly_2026-W38/entries/alice"), { score: 1 });
        });
        const alice = testEnv.authenticatedContext("alice");
        await assertFails(
          updateDoc(doc(alice.firestore(), "leaderboards/weekly_2026-W38/entries/alice"), { score: 2 }),
        );
      });

      it("E. denies a client delete", async () => {
        await testEnv.withSecurityRulesDisabled(async (context) => {
          await setDoc(doc(context.firestore(), "leaderboards/weekly_2026-W38/entries/alice"), { score: 1 });
        });
        const alice = testEnv.authenticatedContext("alice");
        await assertFails(deleteDoc(doc(alice.firestore(), "leaderboards/weekly_2026-W38/entries/alice")));
      });

      it("denies a client writing to a different uid's entry too (not just its own)", async () => {
        const alice = testEnv.authenticatedContext("alice");
        await assertFails(
          setDoc(doc(alice.firestore(), "leaderboards/weekly_2026-W38/entries/bob"), { score: 1 }),
        );
      });
    });

    describe("monthly_*/all_all (Phase 2A ships no UI for these -- still read-denied)", () => {
      it("denies an authenticated client read on all_all", async () => {
        const alice = testEnv.authenticatedContext("alice");
        await assertFails(getDoc(doc(alice.firestore(), "leaderboards/all_all/entries/alice")));
      });

      it("denies an authenticated client read on monthly_2026-09", async () => {
        const alice = testEnv.authenticatedContext("alice");
        await assertFails(getDoc(doc(alice.firestore(), "leaderboards/monthly_2026-09/entries/alice")));
      });

      it("denies an authenticated client write on all_all -- Phase 1B's own guarantee, unweakened", async () => {
        const alice = testEnv.authenticatedContext("alice");
        await assertFails(
          setDoc(doc(alice.firestore(), "leaderboards/all_all/entries/alice"), { score: 999_999 }),
        );
      });
    });
  });

  describe("users/{uid} (Player Profile 1.0 Phase 1A, Issue #129)", () => {
    it("allows the authenticated owner to read their own profile", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), "users/alice"), { displayName: "Alice" });
      });
      const alice = testEnv.authenticatedContext("alice");
      await assertSucceeds(getDoc(doc(alice.firestore(), "users/alice")));
    });

    it("denies an authenticated user reading another user's profile", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), "users/alice"), { displayName: "Alice" });
      });
      const bob = testEnv.authenticatedContext("bob");
      await assertFails(getDoc(doc(bob.firestore(), "users/alice")));
    });

    it("denies an unauthenticated read", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), "users/alice"), { displayName: "Alice" });
      });
      const anon = testEnv.unauthenticatedContext();
      await assertFails(getDoc(doc(anon.firestore(), "users/alice")));
    });

    it("denies the owner writing their own profile directly -- setDisplayName is the only writer", async () => {
      const alice = testEnv.authenticatedContext("alice");
      await assertFails(setDoc(doc(alice.firestore(), "users/alice"), { displayName: "Alice" }));
    });

    it("denies the owner updating their own existing profile directly", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), "users/alice"), { displayName: "Alice" });
      });
      const alice = testEnv.authenticatedContext("alice");
      await assertFails(updateDoc(doc(alice.firestore(), "users/alice"), { displayName: "Eve" }));
    });

    it("denies the owner deleting their own profile directly", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), "users/alice"), { displayName: "Alice" });
      });
      const alice = testEnv.authenticatedContext("alice");
      await assertFails(deleteDoc(doc(alice.firestore(), "users/alice")));
    });

    it("denies an authenticated user writing to a different uid's profile -- the exact profile-spoofing attack", async () => {
      const bob = testEnv.authenticatedContext("bob");
      await assertFails(setDoc(doc(bob.firestore(), "users/alice"), { displayName: "Eve" }));
    });

    it("denies an unauthenticated write", async () => {
      const anon = testEnv.unauthenticatedContext();
      await assertFails(setDoc(doc(anon.firestore(), "users/alice"), { displayName: "Eve" }));
    });
  });

  describe("deny-by-default backstop", () => {
    it("denies read/write on an entirely unmatched collection", async () => {
      const alice = testEnv.authenticatedContext("alice");
      await assertFails(getDoc(doc(alice.firestore(), "someOtherCollection/doc1")));
      await assertFails(setDoc(doc(alice.firestore(), "someOtherCollection/doc1"), { x: 1 }));
    });
  });

  // Sanity check that the emulator/rules wiring itself works (a rule that *would* pass, if one
  // existed) -- proves `assertFails` above is actually exercising the rules engine, not just
  // trivially passing because of a setup mistake. Uses `withSecurityRulesDisabled`, the
  // supported way to seed data for a test *un*related to what the rules themselves allow.
  it("sanity: withSecurityRulesDisabled bypasses the rules (proves assertFails above is real)", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await assertSucceeds(setDoc(doc(context.firestore(), "runs/seed"), { score: 1 }));
    });
  });
});
