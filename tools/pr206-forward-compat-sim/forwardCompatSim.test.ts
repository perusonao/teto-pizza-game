/**
 * PR #206 Forward-Compatibility Deployment Readiness Fresh Audit -- simulation harness.
 *
 * Runs the REAL `persistence.ts` / `starterStock.ts` / `gameReducer.ts` / `dex.ts` of two source
 * trees against an in-memory storage:
 *   A = current main (SIM_TREE_A)
 *   B = main + PR #206 (SIM_TREE_B)
 * "C" (future Progression 2.0) is only a fixture writer/reader (./fixtures.ts). No production code
 * is changed; this file lives outside `src/**` and is not part of `npm test`.
 *
 * Run: tools/pr206-forward-compat-sim/run.sh  (creates the trees, runs this, writes the JSON)
 */
import { describe, it, expect, afterAll } from "vitest";
import { writeFileSync } from "node:fs";
import { SAVE_KEY, futureSaveC, FUTURE_TOP_LEVEL_KEYS } from "./fixtures";

const TREE_A = process.env.SIM_TREE_A;
const TREE_B = process.env.SIM_TREE_B;
const OUT = process.env.SIM_OUT;

type Json = Record<string, any>;

class MemStorage {
  map = new Map<string, string>();
  writes = 0;
  getItem(k: string) {
    return this.map.has(k) ? (this.map.get(k) as string) : null;
  }
  setItem(k: string, v: string) {
    this.writes++;
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  raw(): Json | null {
    const v = this.getItem(SAVE_KEY);
    return v === null ? null : JSON.parse(v);
  }
  seed(save: unknown) {
    this.map.set(SAVE_KEY, JSON.stringify(save));
  }
}

interface Build {
  label: string;
  p: any;
  s: any;
  g: any;
  d: any;
}

async function loadBuild(label: string, tree: string): Promise<Build> {
  const p = await import(/* @vite-ignore */ `${tree}/src/state/persistence.ts`);
  const s = await import(/* @vite-ignore */ `${tree}/src/state/starterStock.ts`);
  const g = await import(/* @vite-ignore */ `${tree}/src/state/gameReducer.ts`);
  const d = await import(/* @vite-ignore */ `${tree}/src/state/dex.ts`);
  return { label, p, s, g, d };
}

/** Mirrors App.tsx: loadSave -> applyStarterGrants (EP4 catch-up) -> createInitialGameState,
 *  then the mount-time persistProgress effect. */
function boot(b: Build, st: MemStorage) {
  const save = b.p.loadSave(st);
  const grant = b.s.applyStarterGrants(
    save.dex,
    save.ownedIngredientIds,
    save.inventory,
    save.starterGrantClaimedRecipeIds,
  );
  const state = b.g.createInitialGameState(
    save.dex,
    grant.ownedIngredientIds,
    save.pitzBalance,
    grant.inventory,
    grant.claimedRecipeIds,
  );
  persist(b, st, state);
  return { state, granted: grant.grantedRecipeIds as string[] };
}

function persist(b: Build, st: MemStorage, state: any) {
  b.p.persistProgress(
    {
      dex: state.dex,
      pitzBalance: state.pitzBalance,
      ownedIngredientIds: state.ownedIngredientIds,
      inventory: state.inventory,
      starterGrantClaimedRecipeIds: state.starterGrantClaimedRecipeIds,
    },
    st,
  );
}

/** Pizza completion == REGISTER_TO_DEX's persisted effect: registerScoreToDex + starter grants. */
function completePizza(b: Build, st: MemStorage, state: any, recipeId: string) {
  const reg = b.d.registerScoreToDex(state.dex, recipeId, { total: 72, stars: 3 });
  const grant = b.s.applyStarterGrants(
    reg.dex,
    state.ownedIngredientIds,
    state.inventory,
    state.starterGrantClaimedRecipeIds,
  );
  const next = {
    ...state,
    dex: reg.dex,
    ownedIngredientIds: grant.ownedIngredientIds,
    inventory: grant.inventory,
    starterGrantClaimedRecipeIds: grant.claimedRecipeIds,
  };
  persist(b, st, next);
  return next;
}

function shopRestock(b: Build, st: MemStorage, state: any, ingredientId: string) {
  const next = b.g.gameReducer(state, { type: "RESTOCK_INGREDIENT", ingredientId });
  persist(b, st, next);
  return next;
}

function lunchRush(b: Build, st: MemStorage, state: any, score: number, reward: number) {
  const next = b.g.gameReducer(state, { type: "CLAIM_MISSION_REWARD", runId: 1, amount: reward });
  persist(b, st, next);
  b.p.persistMissionBest("lunch-rush", score, st);
  return next;
}

/** What survives, probe by probe, in a raw save C reads back. */
function probe(raw: Json | null) {
  const r = raw ?? {};
  const dex: Json[] = Array.isArray(r.dex) ? r.dex : [];
  const byId = (id: string) => dex.find((e) => e.recipeId === id);
  const owned: string[] = Array.isArray(r.ownedIngredientIds) ? r.ownedIngredientIds : [];
  const inv: Json = r.inventory ?? {};
  const mb: Json = r.missionBest ?? {};
  const ledger: string[] = Array.isArray(r.starterGrantClaimedRecipeIds)
    ? r.starterGrantClaimedRecipeIds
    : [];
  return {
    schemaVersion: r.schemaVersion ?? null,
    "top.unlockedForShopIngredientIds": r.unlockedForShopIngredientIds ?? null,
    "top.lifetimePitzEarned": r.lifetimePitzEarned ?? null,
    "top.futureMeta": r.futureMeta ?? null,
    "dex.future-recipe-a": byId("future-recipe-a") ?? null,
    "dex.future-recipe-b(entry)": byId("future-recipe-b") ? true : false,
    "dex.future-recipe-b.perfectCount": byId("future-recipe-b")?.perfectCount ?? null,
    "dex.marinara(known).perfectCount": byId("marinara")?.perfectCount ?? null,
    "owned.future-ingredient-a": owned.includes("future-ingredient-a"),
    "owned.Future_Ingredient_C(malformed id)": owned.includes("Future_Ingredient_C"),
    "inventory.future-ingredient-a": inv["future-ingredient-a"] ?? null,
    "inventory.future-ingredient-b(2.5)": inv["future-ingredient-b"] ?? null,
    "inventory.oregano(known,1.5)": inv["oregano"] ?? null,
    "missionBest.future-mission-x": mb["future-mission-x"] ?? null,
    "missionBest.future-mission-y(12.5)": mb["future-mission-y"] ?? null,
    "missionBest.lunch-rush": mb["lunch-rush"] ?? null,
    "ledger.future-recipe-a": ledger.includes("future-recipe-a"),
    pitzBalance: r.pitzBalance ?? null,
    ownedIngredientIds: owned,
    starterGrantClaimedRecipeIds: ledger,
    dexIds: dex.map((e) => e.recipeId),
  };
}

const results: Json = {};

describe.skipIf(!TREE_A || !TREE_B)("PR #206 forward-compat simulation", () => {
  let A: Build;
  let B: Build;

  it("loads both builds", async () => {
    A = await loadBuild("A(main dff233c)", TREE_A!);
    B = await loadBuild("B(main+#206)", TREE_B!);
    expect(typeof B.p.persistProgress).toBe("function");
  });

  it("S1 field matrix: C save -> one write through each write path -> read", () => {
    const out: Json = {};
    for (const b of [A, B]) {
      for (const path of ["persistDex", "persistProgress", "persistMissionBest"] as const) {
        const st = new MemStorage();
        st.seed(futureSaveC());
        const cur = b.p.loadSave(st);
        if (path === "persistDex") {
          const reg = b.d.registerScoreToDex(cur.dex, "margherita", { total: 90, stars: 4 });
          b.p.persistDex(reg.dex, st);
        } else if (path === "persistProgress") {
          b.p.persistProgress({ ...cur, pitzBalance: cur.pitzBalance + 1 }, st);
        } else {
          b.p.persistMissionBest("lunch-rush", 999, st);
        }
        const raw = st.raw();
        out[`${b.label}/${path}`] = {
          writes: st.writes,
          afterWrite: probe(raw),
          // loadSave view (what GameState would see) of that written save
          loadSaveView: b.p.loadSave(st),
        };
      }
    }
    results.S1_fieldMatrix = out;
  });

  it("S2 full session on each build with the future entitlement save", () => {
    const out: Json = {};
    for (const b of [A, B]) {
      const st = new MemStorage();
      st.seed(futureSaveC());
      const steps: Json[] = [];
      const snap = (step: string, extra: Json = {}) =>
        steps.push({ step, writesSoFar: st.writes, ...extra, save: probe(st.raw()) });

      let { state, granted } = boot(b, st);
      snap("1 boot + EP4 catch-up (mount persistProgress)", { granted });
      state = completePizza(b, st, state, "margherita");
      snap("2 pizza completed (margherita, REGISTER_TO_DEX equivalent)");
      const before = state.pitzBalance;
      state = shopRestock(b, st, state, "mushroom");
      snap("3 Shop restock mushroom", { pitzBefore: before, pitzAfter: state.pitzBalance });
      state = lunchRush(b, st, state, 640, 55);
      snap("4 Lunch Rush result (CLAIM_MISSION_REWARD + persistMissionBest)");
      snap("5 HOME (no write path)");
      const again = boot(b, st);
      snap("6 restart (fresh loadSave + EP4 + mount persistProgress)", {
        grantedOnRestart: again.granted,
        gameStateOwnedHasFutureId: again.state.ownedIngredientIds.includes("future-ingredient-a"),
        gameStateDexIds: again.state.dex.map((e: any) => e.recipeId),
      });
      out[b.label] = steps;
    }
    results.S2_fullSession = out;

    const bLast = out["B(main+#206)"].at(-1).save;
    expect(bLast["top.unlockedForShopIngredientIds"]).toEqual([
      "future-ingredient-a",
      "future-ingredient-b",
    ]);
  });

  it("S3 old-tab / deploy-order scenarios", () => {
    const out: Json = {};

    // S3a sequential: C writes -> B boots+plays (writes) -> C reads
    {
      const st = new MemStorage();
      st.seed(futureSaveC());
      let { state } = boot(B, st);
      state = completePizza(B, st, state, "margherita");
      state = shopRestock(B, st, state, "mushroom");
      out["S3a C->B(sequential)->C"] = probe(st.raw());
    }

    // S3b concurrent stale tab: B tab opened BEFORE C's write (holds pre-C in-memory state),
    // C tab then pays an unlock fee (-100 Pitz, +entitlement) and discovers a future recipe,
    // then the stale B tab writes once (pizza completed) -> C reads.
    {
      const st = new MemStorage();
      const preC = futureSaveC();
      delete preC.unlockedForShopIngredientIds;
      preC.pitzBalance = 400;
      st.seed(preC);
      const tabB = boot(B, st).state; // stale in-memory snapshot
      const cWrite = st.raw()!;
      cWrite.pitzBalance = cWrite.pitzBalance - 100; // C: unlock fee paid
      cWrite.unlockedForShopIngredientIds = ["future-ingredient-a", "future-ingredient-b"];
      cWrite.dex = [
        ...cWrite.dex.filter((e: any) => e.recipeId !== "margherita"),
        { recipeId: "margherita", discovered: true, bestScore: 95, bestStars: 5, timesMade: 9 },
        { recipeId: "future-recipe-c", discovered: true, bestScore: 60, bestStars: 3, timesMade: 1 },
      ];
      st.seed(cWrite);
      const cView = probe(st.raw());
      completePizza(B, st, tabB, "funghi");
      const after = probe(st.raw());
      out["S3b stale B tab overwrites concurrent C write"] = {
        cWroteBeforeStaleWrite: {
          pitzBalance: cView.pitzBalance,
          unlocked: cView["top.unlockedForShopIngredientIds"],
          margherita: st.raw() && cWrite.dex.find((e: any) => e.recipeId === "margherita"),
        },
        afterStaleBWrite: after,
        margheritaAfter: (st.raw()!.dex as any[]).find((e) => e.recipeId === "margherita"),
        futureRecipeCKept: after.dexIds.includes("future-recipe-c"),
      };
    }

    // S3c rollback to A: C writes -> A boots (EP4 mount write) -> C reads
    {
      const st = new MemStorage();
      st.seed(futureSaveC());
      const { state } = boot(A, st);
      const afterBoot = probe(st.raw());
      completePizza(A, st, state, "margherita");
      out["S3c C->A(rollback)->C"] = { afterBootOnly: afterBoot, afterPizza: probe(st.raw()) };
    }

    // S3d chain: C -> B writes -> A writes -> B -> C  (is B enough once A ran?)
    {
      const st = new MemStorage();
      st.seed(futureSaveC());
      let s = boot(B, st).state;
      s = completePizza(B, st, s, "margherita");
      const afterB = probe(st.raw());
      boot(A, st);
      completePizza(A, st, boot(A, st).state, "funghi");
      const afterA = probe(st.raw());
      boot(B, st);
      out["S3d C->B->A->B->C"] = { afterB, afterA, afterBAgain: probe(st.raw()) };
    }

    // S3e old tab of A left open across the B deploy (no rollback, just a stale tab)
    {
      const st = new MemStorage();
      st.seed(futureSaveC());
      // The A tab loaded the same user's save before C's future fields existed.
      const pre = new MemStorage();
      const preSave = futureSaveC();
      FUTURE_TOP_LEVEL_KEYS.forEach((k) => delete preSave[k]);
      pre.seed(preSave);
      const staleA = boot(A, pre).state;
      completePizza(A, st, staleA, "margherita");
      out["S3e stale A tab (opened before B deploy) writes C save"] = probe(st.raw());
    }

    results.S3_oldTab = out;
    expect(out["S3a C->B(sequential)->C"]["top.unlockedForShopIngredientIds"]).toEqual([
      "future-ingredient-a",
      "future-ingredient-b",
    ]);
  });

  it("S4 schemaVersion probes", () => {
    const out: Json = {};
    for (const b of [A, B]) {
      // v2 additive: covered by S1-S3. Here: v3 root (a bump) and v1 root with a future field.
      const st3 = new MemStorage();
      st3.seed({ ...futureSaveC(), schemaVersion: 3 });
      let { state } = boot(b, st3);
      const afterBoot = { writes: st3.writes, schemaVersion: st3.raw()!.schemaVersion };
      state = completePizza(b, st3, state, "margherita");
      out[`${b.label}/v3-root`] = { afterBoot, afterFirstRealWrite: probe(st3.raw()) };

      const st1 = new MemStorage();
      const v1 = futureSaveC();
      v1.schemaVersion = 1;
      delete v1.inventory;
      delete v1.starterGrantClaimedRecipeIds;
      st1.seed(v1);
      boot(b, st1);
      out[`${b.label}/v1-root+future-field`] = probe(st1.raw());
    }
    results.S4_schemaVersion = out;
  });

  it("S5 idempotence: 5 C->B round trips create no duplicates", () => {
    const st = new MemStorage();
    st.seed(futureSaveC());
    for (let i = 0; i < 5; i++) {
      let { state } = boot(B, st);
      state = completePizza(B, st, state, "margherita");
      const raw = st.raw()!;
      raw.futureMeta = { ...raw.futureMeta, round: i }; // C touches its own field each round
      st.seed(raw);
    }
    const raw = st.raw()!;
    const dup = (xs: string[]) => xs.length !== new Set(xs).size;
    results.S5_idempotence = {
      dexDuplicates: dup(raw.dex.map((e: any) => e.recipeId)),
      ownedDuplicates: dup(raw.ownedIngredientIds),
      ledgerDuplicates: dup(raw.starterGrantClaimedRecipeIds),
      unlocked: raw.unlockedForShopIngredientIds,
      futureMeta: raw.futureMeta,
    };
    expect(results.S5_idempotence.dexDuplicates).toBe(false);
  });

  it("S6 a save with no future data: A and B write identical bytes (A stays a safe floor pre-C)", () => {
    const run = (b: Build) => {
      const st = new MemStorage();
      // Only data this build knows (what every production save holds today).
      st.seed({
        schemaVersion: 2,
        dex: [
          { recipeId: "margherita", discovered: true, bestScore: 70, bestStars: 3, timesMade: 2 },
          { recipeId: "marinara", discovered: true, bestScore: 66, bestStars: 3, timesMade: 4 },
        ],
        pitzBalance: 400,
        ownedIngredientIds: ["tomato-sauce", "mozzarella", "basil", "garlic"],
        missionBest: { "lunch-rush": 500 },
        inventory: { garlic: 6 },
        starterGrantClaimedRecipeIds: ["marinara"],
      });
      let { state } = boot(b, st);
      const out = [st.getItem(SAVE_KEY)];
      state = completePizza(b, st, state, "margherita");
      out.push(st.getItem(SAVE_KEY));
      state = shopRestock(b, st, state, "mushroom");
      out.push(st.getItem(SAVE_KEY));
      lunchRush(b, st, state, 640, 55);
      out.push(st.getItem(SAVE_KEY));
      return out;
    };
    const a = run(A);
    const b = run(B);
    results.S6_noFutureDataByteIdentical = { identical: a.every((x, i) => x === b[i]), steps: a.length };
    expect(a).toEqual(b);
  });

  afterAll(() => {
    if (OUT) writeFileSync(OUT, JSON.stringify(results, null, 2));
  });
});
