import { describe, expect, it } from "vitest";

describe("PAN_PROFILE Phase 1 architecture", () => {
  const productionSources = import.meta.glob<string>(
    [
      "../../**/*.ts", "../../**/*.tsx",
      "!../panProfile/**", "!../doughShapeTarget/**",
      "!../../**/*.test.ts", "!../../**/*.test.tsx",
    ],
    { query: "?raw", import: "default", eager: true },
  );

  it("is not wired into Production", () => {
    expect(Object.keys(productionSources).length).toBeGreaterThan(100);
    for (const [path, source] of Object.entries(productionSources)) {
      const specifiers = [...source.matchAll(/(?:from\s*|import\s*\()\s*["']([^"']+)["']/g)].map((match) => match[1]);
      const newNamespaceImports = specifiers.filter((specifier) =>
        specifier.includes("doughShapeTarget") || (specifier.includes("panProfile") && !specifier.endsWith("/pan/panProfile"))
      );
      expect(newNamespaceImports, path).toEqual([]);
    }
  });

  it("leaves the existing pan/panProfile.ts compatibility module in place", async () => {
    const legacyModule = await import("../pan/panProfile");
    expect(legacyModule.cookingProfileForPan).toBeTypeOf("function");
  });
});
