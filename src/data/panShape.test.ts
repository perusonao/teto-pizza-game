import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { getReferencePizza } from "./referencePizza";
import { DEFAULT_PAN_SHAPE, resolvePanShape } from "./panShape";
import { RECIPES, type Recipe } from "./recipes";
import { panGeometryFor } from "../logic/pan/panGeometry";
import { clampToDough, isInsideDough } from "../logic/pizzaCoordinates";

/**
 * Square-Pan Dough A (Issue #534): `panShape` is a reusable recipe field whose default is `round`, and in this slice NO recipe sets it, so the whole square branch is
 * unreachable and every round pizza behaves exactly as before.
 */
describe("panShape on recipes", () => {
  it("defaults to round, and an absent field / unknown recipe resolves to round", () => {
    expect(DEFAULT_PAN_SHAPE).toBe("round");
    expect(resolvePanShape({})).toBe("round");
    expect(resolvePanShape(undefined)).toBe("round");
    expect(resolvePanShape(null)).toBe("round");
    expect(resolvePanShape({ panShape: "square" })).toBe("square");
    expect(resolvePanShape({ panShape: "round" })).toBe("round");
  });

  it("no production recipe sets panShape: all of them are round (the grandma-pizza square pan is Epic #532's step E)", () => {
    for (const r of RECIPES) {
      expect(Object.prototype.hasOwnProperty.call(r, "panShape"), r.id).toBe(false);
      expect(resolvePanShape(r as Recipe), r.id).toBe("round");
    }
  });

  it("for every recipe the pan geometry is the existing circular behaviour at its own Reference positions and around the rim", () => {
    for (const r of RECIPES) {
      const g = panGeometryFor(resolvePanShape(r as Recipe));
      const reference = getReferencePizza(r.id);
      const points = [...(reference?.pieceGroups.flatMap((p) => p.positions) ?? []), { x: 50, y: 2 }, { x: 98.5, y: 50 }, { x: 5, y: 95 }, { x: -3, y: 40 }];
      for (const p of points) {
        expect(g.contains(p.x, p.y), `${r.id} ${p.x},${p.y}`).toBe(isInsideDough(p.x, p.y));
        expect(g.clamp(p.x, p.y), `${r.id} ${p.x},${p.y}`).toEqual(clampToDough(p.x, p.y));
      }
    }
  });
});

describe("the shape foundation is unreachable from the game", () => {
  const ROOT = join(__dirname, "..");
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });
  const production = walk(ROOT).filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.(ts|tsx)$/.test(f));

  // Deliberate: when step B legitimately wires the module in, this allowlist is updated in B's PR (that edit is the review point for "is it reachable now?").
  it("only recipes.ts (a type import) and the pan modules themselves import the new modules", () => {
    const importers = production
      // static imports and dynamic `import("…")` / `require("…")` of the new modules
      .filter((f) => /(from\s+|import\(\s*|require\(\s*)["'](\.\/|[^"']*\/)(panGeometry|squareDough|panShape)["']/.test(readFileSync(f, "utf8")))
      .map((f) => relative(ROOT, f).split("\\").join("/"))
      .sort();
    expect(importers).toEqual(["data/recipes.ts", "logic/pan/panGeometry.ts", "logic/pan/squareDough.ts"]);
  });

  it("recipes.ts imports panShape as a type only", () => {
    expect(readFileSync(join(ROOT, "data/recipes.ts"), "utf8")).toMatch(/import type \{ PanShape \} from "\.\/panShape";/);
  });
});
