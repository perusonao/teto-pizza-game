import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { placedVisualIds } from "./placedVisuals/registry";
import { getIngredient } from "../data/ingredients";

/**
 * Topping Visuals 2.0 (#824 PR-1, Owner Q2/Q3): pins WHERE `IngredientPieceVisual` is invoked and with which `surface`. The default is `"placed"`, so a
 * selection / Reference call site that forgot `surface="selection"` would silently switch to the placed drawing. Counting is by JSX invocation (the
 * seven direct call sites; the three Reference views reach `PizzaVisualPieces.tsx` through `renderPizzaVisualPieces`, so that one line is their boundary).
 */
const COMPONENTS = path.resolve(__dirname);

/** file (relative to src/components) -> the `surface` each of its invocations must carry ("placed" = none passed, the default). */
const EXPECTED: Readonly<Record<string, readonly ("selection" | "placed")[]>> = {
  "IngredientTray.tsx": ["selection", "selection"], // tray chip + drag preview
  "InventoryOverlay.tsx": ["selection"],
  "PizzaThumbnail.tsx": ["selection"], // recipe card / Dex thumbnail
  "PizzaVisualPieces.tsx": ["selection"], // the shared Reference boundary (Q3)
  "PizzaStage.tsx": ["placed"], // the player's own pizza
  "PostBakePiece.tsx": ["placed"], // POST_BAKE pieces
};

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

function invocations(file: string): string[] {
  const text = fs.readFileSync(file, "utf8");
  return text.match(/<IngredientPieceVisual\b[^>]*?\/>/gs) ?? [];
}

describe("IngredientPieceVisual call sites", () => {
  const found = new Map<string, string[]>();
  for (const file of sourceFiles(path.resolve(COMPONENTS, ".."))) {
    const calls = invocations(file);
    if (calls.length > 0) found.set(path.relative(COMPONENTS, file), calls);
  }

  it("is invoked from exactly the known files (7 direct call sites)", () => {
    expect([...found.keys()].sort()).toEqual(Object.keys(EXPECTED).sort());
    expect([...found.values()].reduce((sum, calls) => sum + calls.length, 0)).toBe(7);
  });

  it.each(Object.entries(EXPECTED))("%s passes the expected surface on every invocation", (file, surfaces) => {
    const calls = found.get(file) ?? [];
    expect(calls).toHaveLength(surfaces.length);
    calls.forEach((call, index) => {
      if (surfaces[index] === "selection") expect(call).toContain('surface="selection"');
      else expect(call).not.toContain("surface=");
    });
  });
});

describe("placedVisuals boundary", () => {
  it("registers parmigiano only (PR-1); eggplant is never registered and never gains a pieceVisual", () => {
    expect(placedVisualIds()).toEqual(["parmigiano"]);
    expect(getIngredient("eggplant")?.pieceVisual).toBeUndefined();
  });

  it("the placed drawings are self-contained and name no other cooking method", () => {
    const dir = path.resolve(COMPONENTS, "placedVisuals");
    for (const file of sourceFiles(dir)) {
      const text = fs.readFileSync(file, "utf8");
      const name = path.relative(COMPONENTS, file);
      expect(/\bfry\b|\bfried\b|steam|sear|\/logic\/|\/state\//i.test(text), `${name} must not mention or import another cooking method / state`).toBe(false);
      if (/\.tsx$/.test(file)) {
        expect(/<svg[^>]*\sid=|url\(#|<defs|linearGradient|radialGradient/.test(text), `${name}: no id / gradient / defs / url references`).toBe(false);
        expect(text).toContain('aria-hidden="true"');
        expect(text).toContain('viewBox="0 0 64 64"');
      }
    }
  });
});
