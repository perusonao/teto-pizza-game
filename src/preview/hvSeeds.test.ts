import { afterEach, describe, expect, it, vi } from "vitest";
import { hint5Presentation } from "../logic/discovery/hint5Ladder";
import type { StorageLike } from "../state/persistence";
import { HV_SCENARIOS, buildHvSnapshot, findHvScenario, parseHvParam, shouldApplyHvSeed } from "./hvSeeds";

/**
 * Discovery Hint 5.0 H5-5: the Human Verification seeds. Each scenario's stored facts are checked
 * against the REAL ladder (the seed module itself does not import it), and the Preview save isolation
 * is checked with a Preview key namespace and a planted production save.
 */

function memory(seed: Record<string, string> = {}): StorageLike & { map: Map<string, string> } {
  const map = new Map(Object.entries(seed));
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

/** What the first offer of each scenario must be (label, price), and what the board must hold. */
const EXPECTED: Record<string, { next: [string, number]; board: string[]; discoveredCount?: number }> = {
  normal: { next: ["ヒント1: ソース", 10], board: [] },
  "cheese-none": { next: ["ヒント2: チーズ", 10], board: ["SAUCE"] },
  "key-none": { next: ["ヒント3: キートッピング", 10], board: ["SAUCE", "CHEESE"] },
  "already-known": { next: ["ヒント1: ソース", 10], board: [] },
  "multi-sub": { next: ["ヒント5: サブトッピング①の分類", 5], board: ["SAUCE", "CHEESE", "KEY_TOPPING", "STRUCTURE"] },
  "last-sub": { next: ["ヒント7: サブトッピング③の分類", 5], board: ["SAUCE", "CHEESE", "KEY_TOPPING", "STRUCTURE", "SUB_CLASS", "SUB_CLASS"] },
  "low-pitz": { next: ["ヒント1: ソース", 10], board: [] },
};

describe("HV scenarios against the real ladder", () => {
  it("the 7 scenario ids are exactly the documented ones, each unique, each with a recipe on the ladder", () => {
    expect(HV_SCENARIOS.map((s) => s.id)).toEqual(["normal", "cheese-none", "key-none", "already-known", "multi-sub", "last-sub", "low-pitz"]);
    expect(new Set(HV_SCENARIOS.map((s) => s.id)).size).toBe(HV_SCENARIOS.length);
    for (const s of HV_SCENARIOS) expect(() => buildHvSnapshot(s), s.id).not.toThrow();
  });

  it("each scenario offers the intended first rung at its normal price, with the intended board", () => {
    for (const s of HV_SCENARIOS) {
      const snapshot = buildHvSnapshot(s);
      const view = hint5Presentation({
        recipeId: s.recipeId,
        discoveredCount: snapshot.dex.length,
        storedFactIds: snapshot.discoveryHintFacts?.[s.recipeId] ?? [],
        legacyPurchases: {},
        pitzBalance: snapshot.pitzBalance,
      });
      const want = EXPECTED[s.id];
      expect(view, s.id).not.toBeNull();
      expect(view!.next, s.id).toMatchObject({ labelJa: want.next[0], price: want.next[1] });
      expect(view!.board.map((e) => e.kind), s.id).toEqual(want.board);
      expect(view!.onboarding, s.id).toBe(false);
      // The offer never shows 「なし」 before its purchase (P4-CHEESE / P4b).
      expect(JSON.stringify(view!.next), s.id).not.toContain("なし");
    }
  });

  it("the first-offer text of each scenario matches what the ladder offers", () => {
    for (const s of HV_SCENARIOS) expect(s.firstOfferJa.startsWith(EXPECTED[s.id].next[0]), s.id).toBe(true);
  });

  it("already-known: the offer is a fresh save's, and only the request completes it for 0 Pitz (M3-D)", () => {
    const s = findHvScenario("already-known")!;
    expect(s.facts.every((f) => f.startsWith("ing:"))).toBe(true);
    const fresh = hint5Presentation({ recipeId: "meat-lovers", discoveredCount: 8, storedFactIds: [], legacyPurchases: {}, pitzBalance: 300 })!;
    const seeded = hint5Presentation({ recipeId: "meat-lovers", discoveredCount: 8, storedFactIds: s.facts, legacyPurchases: {}, pitzBalance: 300 })!;
    expect(seeded.next).toEqual(fresh.next);
    expect(seeded.board).toEqual(fresh.board);
  });

  it("low-pitz: the first rung is affordable and the second is not", () => {
    const s = findHvScenario("low-pitz")!;
    expect(s.pitz).toBeLessThan(20);
    expect(s.pitz).toBeGreaterThanOrEqual(10);
  });

  it("the snapshot is a Dex before the recipe's ladder step, with that step's materials owned and stocked", () => {
    const s = findHvScenario("cheese-none")!;
    const snapshot = buildHvSnapshot(s);
    expect(snapshot.dex.map((d) => d.recipeId)).toContain("margherita");
    expect(snapshot.dex.map((d) => d.recipeId)).not.toContain("marinara");
    expect(snapshot.ownedIngredientIds).toContain("garlic");
    expect(snapshot.inventory).toMatchObject({ garlic: 10 });
    expect(snapshot.pitzBalance).toBe(300);
  });
});

describe("parameters and the navigation gate", () => {
  it("?hv= accepts only a known scenario id", () => {
    for (const s of HV_SCENARIOS) expect(parseHvParam(`?hint5=1&hv=${s.id}`)).toBe(s.id);
    for (const search of ["", "?hv=", "?hv=unknown", "?hv=NORMAL", "?hv=__proto__", "?hv=constructor", "?hv=normal,key-none", "?hint5=1"]) {
      expect(parseHvParam(search), search).toBeNull();
    }
    for (const search of [null, undefined, 1, {}, ["?hv=normal"]]) expect(parseHvParam(search)).toBeNull();
  });

  it("a seed applies to a fresh navigation only: never to a reload or a history step", () => {
    expect(shouldApplyHvSeed("navigate")).toBe(true);
    expect(shouldApplyHvSeed(undefined)).toBe(true);
    for (const type of ["reload", "back_forward", "prerender", ""]) expect(shouldApplyHvSeed(type), type).toBe(false);
  });
});

describe("Preview save isolation (a Preview build keeps its own save key)", () => {
  async function previewModules() {
    vi.resetModules();
    vi.stubEnv("VITE_PREVIEW_MODE", "1");
    const persistence = await import("../state/persistence");
    const seeds = await import("./hvSeeds");
    return { persistence, seeds };
  }

  it("the Preview save key is not the production key", async () => {
    const { persistence } = await previewModules();
    expect(persistence.SAVE_STORAGE_KEY).toBe("teto-pizza-preview-save-v1");
  });

  it("applying a seed writes only the Preview key and never reads or writes a production save", async () => {
    const { persistence, seeds } = await previewModules();
    const production = JSON.stringify({ sentinel: "PRODUCTION-SAVE", pitzBalance: 999 });
    const storage = memory({ "teto-pizza-save-v1": production });
    const reads: string[] = [];
    const spy: StorageLike = {
      getItem: (k) => (reads.push(k), storage.getItem(k)),
      setItem: (k, v) => storage.setItem(k, v),
      removeItem: (k) => storage.removeItem(k),
    };
    for (const s of seeds.HV_SCENARIOS) {
      expect(seeds.applyHvSeed(s.id, spy), s.id).toBe(true);
      expect(storage.map.get("teto-pizza-save-v1"), s.id).toBe(production);
      expect(reads.every((k) => k === persistence.SAVE_STORAGE_KEY), `${s.id}: ${reads.join(",")}`).toBe(true);
      const stored = persistence.loadSave(spy);
      expect(stored.pitzBalance, s.id).toBe(s.pitz);
      expect(stored.discoveryHintFacts[s.recipeId] ?? [], s.id).toEqual([...s.facts]);
    }
    expect([...storage.map.keys()].sort()).toEqual(["teto-pizza-preview-save-v1", "teto-pizza-save-v1"]);
  });

  it("a second scenario replaces the first (the URL always restarts its scenario); Full Reset clears the Preview save only", async () => {
    const { persistence, seeds } = await previewModules();
    const storage = memory({ "teto-pizza-save-v1": "PRODUCTION" });
    seeds.applyHvSeed("last-sub", storage);
    seeds.applyHvSeed("cheese-none", storage);
    const stored = persistence.loadSave(storage);
    expect(Object.keys(stored.discoveryHintFacts)).toEqual(["marinara"]);
    expect(persistence.resetSave(storage)).toBe(true);
    expect(storage.map.has("teto-pizza-preview-save-v1")).toBe(false);
    expect(storage.map.get("teto-pizza-save-v1")).toBe("PRODUCTION");
  });

  it("applyPreviewHvSeed: a reload keeps the player's save, a navigation seeds, an unknown scenario does nothing", async () => {
    const { persistence, seeds } = await previewModules();
    const storage = memory();
    expect(seeds.applyPreviewHvSeed("?hint5=1&hv=normal", storage, "navigate")).toBe("normal");
    persistence.persistProgress({ ...buildHvSnapshot(findHvScenario("normal")!), pitzBalance: 111 }, storage);
    expect(persistence.loadSave(storage).pitzBalance).toBe(111);
    expect(seeds.applyPreviewHvSeed("?hint5=1&hv=normal", storage, "reload")).toBeNull();
    expect(persistence.loadSave(storage).pitzBalance).toBe(111);
    expect(seeds.applyPreviewHvSeed("?hv=unknown", storage, "navigate")).toBeNull();
    expect(seeds.applyPreviewHvSeed("?hint5=1", storage, "navigate")).toBeNull();
    expect(seeds.applyPreviewHvSeed("?hv=normal", null, "navigate")).toBeNull();
    expect(persistence.loadSave(storage).pitzBalance).toBe(111);
  });
});
