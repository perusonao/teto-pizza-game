import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";

/** The plain-JS parts of the Train Kit (CLI helpers, claim check, verification packet, progress ledger) have a node:test suite; this runs it inside the existing Vitest job, so no workflow changes. */
it("tools/train-kit/kit.test.mjs passes", () => {
  const run = spawnSync(process.execPath, ["--test", "tools/train-kit/kit.test.mjs"], { cwd: process.cwd(), encoding: "utf8" });
  expect(run.status, `${run.stdout}\n${run.stderr}`).toBe(0);
}, 60_000);
