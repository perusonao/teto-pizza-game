import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { walkExisting25 } from "./testSupport/hint5Existing25Walk";

/** Discovery 3.0 PR-3 (OD-D3-19 Migration A): the shipped 25 recipes' Hint 5.0 output is
 *  byte-identical to `main` before key-free support. Regenerate ONLY by deliberately changing
 *  production Hint 5.0 (`HINT5_GOLDEN_UPDATE=1`). */
const GOLDEN = "src/logic/discovery/hint5Existing25.golden.json"; // vitest runs from the repo root

describe("existing 25 recipes: Hint 5.0 output is unchanged (Migration A)", () => {
  it("matches the pre-PR-3 golden", () => {
    const actual = JSON.stringify(walkExisting25(), null, 1) + "\n";
    if (process.env.HINT5_GOLDEN_UPDATE === "1") writeFileSync(GOLDEN, actual);
    expect(existsSync(GOLDEN)).toBe(true);
    expect(actual).toBe(readFileSync(GOLDEN, "utf8"));
  });
});
