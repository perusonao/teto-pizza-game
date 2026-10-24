import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { FREE_COOK_FINISH_PRODUCTION, freeCookFinishEnabled } from "./freeCookFinishGate";
import { DEFAULT_COOKING_PROFILE, freeCookingProfile, getCookingProfile, visibleCookingTabCount, MAX_VISIBLE_COOKING_TABS } from "./cookingProfiles";
import { FREE_COOK_RECIPE_ID } from "./freeCook";
import { FREE_FINISH_ON_VALUE, FREE_FINISH_PARAM, resolveFreeFinishOptIn, freeFinishPreviewOptedIn } from "../preview/freeFinishPreview";

/**
 * FINISH FIN-E3a (Issue #604): the Free Cooking FINISH gate. Production is OFF; the one other way ON is the explicit Preview / DEV
 * opt-in. These pin the switch itself (the bundle-level counterpart is ../preview/freeFinishPreview.gate.test.ts) and that nothing
 * else decides it.
 */
describe("Free Cooking FINISH gate", () => {
  it("E5: Production is ON, and the gate is exactly that literal (the query opt-in is not involved)", () => {
    expect(FREE_COOK_FINISH_PRODUCTION).toBe(true);
    expect(freeFinishPreviewOptedIn()).toBe(false); // vitest runs as DEV, with no ?freeFinish in the URL
    expect(freeCookFinishEnabled()).toBe(true);
  });

  it("the opt-in is the explicit query only: ?freeFinish=on exactly once", () => {
    expect(FREE_FINISH_PARAM).toBe("freeFinish");
    expect(FREE_FINISH_ON_VALUE).toBe("on");
    expect(resolveFreeFinishOptIn("?freeFinish=on")).toBe(true);
    expect(resolveFreeFinishOptIn("?x=1&freeFinish=on")).toBe(true);
    for (const search of ["", "?freeFinish", "?freeFinish=", "?freeFinish=1", "?freeFinish=true", "?freeFinish=ON", "?freeFinish=on&freeFinish=on", "?freeFinish=off", "?other=on"]) {
      expect(resolveFreeFinishOptIn(search), search).toBe(false);
    }
    for (const bad of [undefined, null, 1, {}, []]) expect(resolveFreeFinishOptIn(bad)).toBe(false);
  });

  it("freeCookingProfile: OFF returns the profile itself; ON appends FINISH once, without mutating the shared default", () => {
    expect(freeCookingProfile(DEFAULT_COOKING_PROFILE, false)).toBe(DEFAULT_COOKING_PROFILE);
    const on = freeCookingProfile(DEFAULT_COOKING_PROFILE, true);
    expect(on).not.toBe(DEFAULT_COOKING_PROFILE);
    expect(on.steps).toEqual(["DOUGH", "SAUCE", "CHEESE", "TOPPING", "FINISH"]);
    expect(DEFAULT_COOKING_PROFILE.steps).toEqual(["DOUGH", "SAUCE", "CHEESE", "TOPPING"]);
    expect(freeCookingProfile(on, true)).toBe(on); // already carries FINISH
    expect(visibleCookingTabCount(on)).toBe(MAX_VISIBLE_COOKING_TABS);
  });

  it("the Free Cooking sentinel's own catalog profile never carries FINISH (the gate applies per round, not to the catalog)", () => {
    expect(getCookingProfile(FREE_COOK_RECIPE_ID)).toBe(DEFAULT_COOKING_PROFILE);
  });

  it("only the profile derivation reads the gate, and only the gate reads the opt-in", () => {
    const root = join(__dirname, "..");
    const users: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
          const text = readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""); // code only, not the comments that name the gate
          const rel = relative(root, path);
          if (text.includes("freeCookFinishEnabled") && rel !== "data/freeCookFinishGate.ts") users.push(`${rel} -> freeCookFinishEnabled`);
          if (text.includes("freeFinishPreviewOptedIn") && !rel.startsWith("preview/freeFinishPreview") && rel !== "data/freeCookFinishGate.ts") users.push(`${rel} -> freeFinishPreviewOptedIn`);
          if (text.includes("FREE_COOK_FINISH_PRODUCTION") && rel !== "data/freeCookFinishGate.ts") users.push(`${rel} -> FREE_COOK_FINISH_PRODUCTION`);
        }
      }
    };
    walk(root);
    expect(users).toEqual(["state/gameReducer.ts -> freeCookFinishEnabled"]);
  });
});
