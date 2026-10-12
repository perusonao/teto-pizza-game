import { describe, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { CHEESE_POOL_GRID, renderCheesePool } from "./cheesePool";

/**
 * #421 S1 report utility (NOT a regression test): writes raw RGBA renders of `renderCheesePool` for the Owner-facing comparison sheet and the
 * measurement script. Skipped unless CHEESE_POOL_OUT is set. Output: <dir>/<name>.rgba (96x96 straight RGBA) and <dir>/manifest.json.
 */
const OUT = process.env.CHEESE_POOL_OUT;

const SEEDS = ["mozzarella:40.00:50.00", "mozzarella:60.00:50.00", "mozzarella:50.00:30.00", "mozzarella:25.00:35.00", "mozzarella:70.00:62.00", "mozzarella:33.00:71.00", "mozzarella:55.00:48.00", "mozzarella:18.00:60.00"];

describe.skipIf(!OUT)("cheese pool report", () => {
  it("writes the renders", () => {
    mkdirSync(OUT!, { recursive: true });
    const manifest: Array<{ name: string; seed: string; melt: number; toast: number; char: number; reduced: boolean }> = [];
    const emit = (name: string, seed: string, melt: number, toast: number, char: number, reduced = false) => {
      const img = renderCheesePool(seed, melt, toast, char, { reducedMotion: reduced });
      writeFileSync(`${OUT}/${name}.rgba`, Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength));
      manifest.push({ name, seed, melt, toast, char, reduced });
    };
    SEEDS.forEach((seed, i) => {
      for (const melt of [0, 0.4, 0.7, 1]) emit(`s${i}-melt${melt}`, seed, melt, 0, 0);
      emit(`s${i}-baked`, seed, 1, 0.6, 0); // golden browning
      emit(`s${i}-toast`, seed, 1, 1, 0);
      emit(`s${i}-char`, seed, 1, 1, 1);
    });
    writeFileSync(`${OUT}/manifest.json`, JSON.stringify({ grid: CHEESE_POOL_GRID, items: manifest }));
  });
});
