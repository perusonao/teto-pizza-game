import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { RECIPES } from "../../data/recipes";
import { PizzaThumbnail } from "../PizzaThumbnail";

/**
 * Square-Pan Dough D2-b2 (#537) + Anti-Oracle (decision 4 of the D2-a2 audit): the pan is the PLAYER's choice, so a surface that draws a recipe before it is discovered
 * (Recipe Select, the Reference) must stay shape-neutral. There is no surface that draws the player's OWN cooked pizza as a thumbnail today (the RESULT is the stage
 * itself, already a square), so `SquareThumbnailBase` stays unused; this pins both facts so the first caller has to come with its own review.
 */
const SQUARE_WORDS = /square|天板|tray|pan-shape|panShape/i;

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = `${dir}/${name}`;
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

describe("shape-neutral recipe thumbnails (Anti-Oracle)", () => {
  it("no recipe's Recipe Select thumbnail carries a pan-shaped class or word, so a square recipe is not told apart before it is discovered", () => {
    for (const recipe of RECIPES) {
      const html = renderToStaticMarkup(<PizzaThumbnail recipe={recipe} />);
      expect(html, recipe.id).not.toMatch(SQUARE_WORDS);
      expect(html, recipe.id).toContain("pizza-thumbnail");
    }
  });

  it("the square thumbnail base and the dough sheet are used by nothing but the square layer itself (no player-own or recipe-side surface draws a square thumbnail yet)", () => {
    const files = sourceFiles(`${process.cwd()}/src`);
    const users = (needle: string, definedIn: string) =>
      files.filter((f) => !f.endsWith(definedIn) && readFileSync(f, "utf8").includes(needle)).map((f) => f.replace(`${process.cwd()}/`, ""));
    expect(users("SquareThumbnailBase", "SquareThumbnailBase.tsx")).toEqual([]);
    expect(users("rasterizeSquareDoughSheet", "squareDoughSheet.ts")).toEqual(["src/components/SquareDoughCanvas.tsx"]);
  });
});
