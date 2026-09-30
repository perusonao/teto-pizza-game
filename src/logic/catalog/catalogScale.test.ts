import { describe, expect, it } from "vitest";
import { queryCatalog } from "./catalogQuery";
import { summarizeChapters } from "./dexActionSummary";
import { selectWorkingSet } from "./workingSet";
import { emptyUsageSession, recordUse } from "./usageSignals";
import { fixtureStock, largeCatalogFixture, LARGE_CATALOG_FIXTURE_IDS } from "./testSupport/largeCatalogFixtures";

/** Performance / determinism on every population (Implementation Gate §6). The time bound is a
 *  generous CI ceiling for one full pass, not a benchmark. */
describe("scale: deterministic and fast on 29 .. 179 ingredients / 25 .. 172 recipes", () => {
  for (const id of LARGE_CATALOG_FIXTURE_IDS) {
    it(id, () => {
      const f = largeCatalogFixture(id);
      const ownership = { ownedIds: f.catalog.map((i) => i.id), stock: fixtureStock(f) };
      const usage = recordUse(emptyUsageSession(), f.catalog.slice(0, 8).map((i) => i.id));
      const run = () => {
        const out: unknown[] = [];
        for (const category of ["sauce", "cheese", "topping"] as const) {
          for (const capacity of [9, 12]) {
            out.push(
              selectWorkingSet({
                category,
                capacity,
                catalog: f.catalog,
                ownership,
                placedIds: f.recipes[0].requiredIngredientIds,
                pinnedIds: [],
                disclosedHints: { namedIngredientIds: [] },
                usage,
              }),
            );
          }
          out.push(queryCatalog(f.catalog, ownership, usage, { sort: "reading", text: "テスト" }).map((i) => i.id));
        }
        const chapters = f.chapterSizes.map((_, c) => ({
          key: c + 1,
          recipes: f.recipes
            .filter((r) => r.chapter === c + 1)
            .map((r, k) => ({ discovered: k % 3 === 0, requiredIngredientIds: r.requiredIngredientIds })),
        }));
        out.push(summarizeChapters(chapters, { ownedIds: ownership.ownedIds, shopEntitledIds: [], starterIds: f.starterIds }));
        return out;
      };
      const t0 = performance.now();
      const a = run();
      const elapsed = performance.now() - t0;
      expect(run()).toEqual(a);
      expect(elapsed).toBeLessThan(250);
    });
  }
});
