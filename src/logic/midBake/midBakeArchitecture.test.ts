import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MID_BAKE_EXPERIENCE_PRODUCTION, midBakeExperienceEnabled } from "./midBakeGate";

describe("MID_BAKE isolation", () => {
  it("stays Production OFF", () => {
    expect(MID_BAKE_EXPERIENCE_PRODUCTION).toBe(false);
    expect(midBakeExperienceEnabled()).toBe(false);
  });

  it("does not import React, UI, state, PREP or FRY", () => {
    const root = join(process.cwd(), "src", "logic", "midBake");
    for (const file of readdirSync(root).filter((name) => name.endsWith(".ts"))) {
      const source = readFileSync(join(root, file), "utf8");
      const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
      expect(imports, file).not.toContain("react");
      expect(imports, file).not.toContain("react-dom");
      expect(imports, file).not.toContain("../prep");
      expect(imports, file).not.toContain("../fry");
      expect(imports.some((path) => /(?:^|\/)(components|screens|state|prep|fry)(?:\/|$)/i.test(path)), file).toBe(false);
    }
  });
});
