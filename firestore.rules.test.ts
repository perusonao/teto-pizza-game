import { afterAll, beforeAll, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { doc, getDoc, setDoc } from "firebase/firestore";

/**
 * Firebase Ranking 1.0 Phase 1B (Issue #87). Exercises `firestore.rules` against a real
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
    it("denies an authenticated client read (Phase 1B ships no ranking UI yet)", async () => {
      const alice = testEnv.authenticatedContext("alice");
      await assertFails(getDoc(doc(alice.firestore(), "leaderboards/all_all/entries/alice")));
    });

    it("denies an authenticated client write -- the exact '{ score: 999999 }' attack Issue #87 calls out", async () => {
      const alice = testEnv.authenticatedContext("alice");
      await assertFails(
        setDoc(doc(alice.firestore(), "leaderboards/all_all/entries/alice"), { score: 999_999 }),
      );
    });

    it("denies a client writing to a different uid's entry too (not just its own)", async () => {
      const alice = testEnv.authenticatedContext("alice");
      await assertFails(
        setDoc(doc(alice.firestore(), "leaderboards/all_all/entries/bob"), { score: 1 }),
      );
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
