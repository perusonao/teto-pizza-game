import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { RECIPES } from "../../data/recipes";
import { computeParityRows, PARITY_VARIANTS, type ParityRow } from "./testSupport/parityPizzas";

/**
 * TQ-1B (Issue #263, OD-TQ-S1 absolute condition): the no-sauce profile must not move any existing
 * sauce recipe's score by a single point. The snapshot was captured on `main` 7bb0116 -- before
 * the profile existed -- by running this file once with `TQ1B_WRITE_PARITY_SNAPSHOT=1`; it is
 * never regenerated after the change. Every row must still match exactly (total, stars, every
 * component score, the quantity factor).
 */
const SNAPSHOT = resolve(__dirname, "__fixtures__/scoreParity.main-7bb0116.json");

describe("TQ-1B: existing recipe scores are bit-identical to main 7bb0116", () => {
  const rows = computeParityRows();

  it("the snapshot covers every production recipe x every variant", () => {
    if (process.env.TQ1B_WRITE_PARITY_SNAPSHOT === "1") {
      writeFileSync(SNAPSHOT, JSON.stringify({ base: "7bb0116", rows }, null, 1) + "\n");
    }
    expect(existsSync(SNAPSHOT)).toBe(true);
    const snapshot = JSON.parse(readFileSync(SNAPSHOT, "utf8")) as { base: string; rows: ParityRow[] };
    expect(snapshot.base).toBe("7bb0116");
    expect(snapshot.rows).toHaveLength(RECIPES.length * PARITY_VARIANTS.length);
    expect(rows).toEqual(snapshot.rows);
  });

  it("every production recipe has a sauce Reference, so none of them can take the no-sauce profile", () => {
    for (const row of rows.filter((r) => r.variant === "ideal")) {
      expect(row.available).toBe(true);
      expect(row.components.sauce).not.toBeNull();
    }
  });
});
