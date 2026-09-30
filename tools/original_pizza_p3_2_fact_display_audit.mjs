#!/usr/bin/env node
/**
 * Original Pizza Recovery P3-2 Fresh Audit: checks the proposed fact -> display matrix
 * (docs/reports/data/TETO_ORIGINAL-PIZZA-RECOVERY_P3-2_FACT-DISPLAY-MATRIX.json) against CURRENT main.
 *
 * Read-only. Loads the production TS modules through Vite SSR (no build, no `src/` change). For every
 * production recipe it walks the real Hint 5.0 authority (`requestHint5Rung`) one rung at a time, projects
 * `hint5Presentation` the way the future Dex 発見メモ would (board + legacyKnownIngredientIds + completeText
 * only) and verifies every invariant of the matrix, plus adversarial ledgers. Exit 1 when any invariant fails.
 *
 * Usage: node tools/original_pizza_p3_2_fact_display_audit.mjs [--out PATH]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outArg = process.argv.indexOf("--out");
const outPath = outArg > -1 ? resolve(process.argv[outArg + 1]) : resolve(root, "docs/reports/data/TETO_ORIGINAL-PIZZA-RECOVERY_P3-2_FACT-DISPLAY_Audit.json");
const matrix = JSON.parse(readFileSync(resolve(root, "docs/reports/data/TETO_ORIGINAL-PIZZA-RECOVERY_P3-2_FACT-DISPLAY-MATRIX.json"), "utf8"));

const server = await createServer({ root, logLevel: "error", server: { middlewareMode: true }, appType: "custom" });
const results = new Map(matrix.invariants.map((i) => [i.id, { id: i.id, statement: i.statement, cases: 0, failures: [] }]));
const check = (id, ok, detail) => {
  const r = results.get(id);
  if (!r) throw new Error(`unknown invariant ${id}`);
  r.cases += 1;
  if (!ok) r.failures.push(detail);
};

try {
  const load = (p) => server.ssrLoadModule(resolve(root, p));
  const L = await load("src/logic/discovery/hint5Ladder.ts");
  const { RECIPES } = await load("src/data/recipes.ts");
  const { getIngredient } = await load("src/data/ingredients.ts");
  const { HINT5_LADDER_ENABLED } = await load("src/logic/discovery/hint5Flag.ts");
  const { recipeDiscoveryState } = await load("src/state/recipeDiscoveryState.ts");

  const DISCOVERED_COUNT = 5; // past the Dex-0 onboarding
  const project = (p) => ({ board: p.board, legacyKnownIngredientIds: p.legacyKnownIngredientIds, completeText: p.completeText });
  const presentation = (recipeId, stored, legacy = {}, discoveredCount = DISCOVERED_COUNT) =>
    L.hint5Presentation({ recipeId, discoveredCount, storedFactIds: stored, legacyPurchases: legacy, pitzBalance: 100000 });

  // ---- gate inputs exist and behave (MX-GATE-*) -----------------------------------------------------------
  check("MX-GATE-CARD", typeof recipeDiscoveryState === "function" && recipeDiscoveryState(RECIPES[0], { dex: [], ownedIngredientIds: [], unlockedForShopIngredientIds: [], inventory: {} }) === "DISCOVERABLE", "recipeDiscoveryState missing or margherita not DISCOVERABLE at an empty save");
  check("MX-GATE-FLAG", typeof HINT5_LADDER_ENABLED === "boolean", "HINT5_LADDER_ENABLED is not a boolean export");
  check("MX-GATE-TARGET", L.hint5Presentation({ recipeId: "no-such-recipe", discoveredCount: 5, storedFactIds: [], legacyPurchases: {}, pitzBalance: 0 }) === null, "a non-target did not yield null");
  check("MX-GATE-ONBOARDING", presentation("margherita", [], {}, 0)?.onboarding === true && presentation("margherita", [], {}, 5)?.onboarding === false, "onboarding flag does not mark the Dex-0 Margherita only");
  const ladderSource = readFileSync(resolve(root, "src/logic/discovery/hint5Ladder.ts"), "utf8");
  const imports = [...ladderSource.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
  check("MX-INPUT", !imports.some((i) => /nearMiss|trialNotebook|attemptFingerprint|matcher|resultNearMiss|technique/i.test(i)), `hint5Ladder imports ${imports.join(", ")}`);

  const allowedNameKeys = ["ingredientIds", "kind", "none", "rungIndex"];
  const allowedStructureKeys = ["kind", "lineJa", "rungIndex"];
  const allowedSubKeys = ["classView", "kind", "ordinal", "rungIndex"];
  const allowedClassKeys = ["family", "labelJa", "lineJa", "symbol"];
  const sortedKeys = (o) => Object.keys(o).sort().join(",");

  const shapeRows = [];
  const contentKeys = new Map(); // recipe -> prefix -> content key (MX-METAMORPHIC)
  const prefixProjections = new Map();

  for (const recipe of RECIPES) {
    const ladder = L.buildHint5Ladder(recipe.id);
    check("MX-GATE-TARGET", ladder !== null, `${recipe.id} is not a ladder target`);
    if (!ladder) continue;
    const fixedSubjects = Object.fromEntries(ladder.rungs.filter((r) => r.kind !== "SUB_CLASS").map((r) => [r.kind, r.subjectIds]));
    const subIds = ladder.rungs.filter((r) => r.kind === "SUB_CLASS").map((r) => r.subjectIds[0]);
    shapeRows.push({ recipeId: recipe.id, rungs: ladder.rungs.length, subToppings: subIds.length, total: ladder.total });

    let stored = [];
    let prefix = 0;
    const perPrefix = [];
    contentKeys.set(recipe.id, perPrefix);
    for (;;) {
      const p = presentation(recipe.id, stored);
      const proj = project(p);
      const projJson = JSON.stringify(proj);
      const completed = ladder.rungs.slice(0, prefix); // the ladder is strictly linear: a prefix is what is bought
      const completedIds = new Set(completed.flatMap((r) => r.subjectIds));

      // MX-PREFIX / MX-SUB: rows are exactly the completed rungs, in ladder order, with the ladder's own content
      check("MX-PREFIX", proj.board.length === completed.length, `${recipe.id} prefix ${prefix}: board has ${proj.board.length} entries`);
      completed.forEach((rung, i) => {
        const entry = proj.board[i];
        const ok = entry && entry.kind === rung.kind && entry.rungIndex === rung.index;
        check("MX-PREFIX", !!ok, `${recipe.id} prefix ${prefix}: entry ${i} is not rung ${rung.index}`);
        if (!entry) return;
        if (rung.kind === "SUB_CLASS") {
          check("MX-SUB", sortedKeys(entry) === allowedSubKeys.join(",") && sortedKeys(entry.classView) === allowedClassKeys.join(",") && entry.ordinal === rung.ordinal, `${recipe.id} prefix ${prefix}: bad SUB_CLASS entry`);
        } else if (rung.kind === "STRUCTURE") {
          check("MX-PREFIX", sortedKeys(entry) === allowedStructureKeys.join(","), `${recipe.id}: bad STRUCTURE keys`);
        } else {
          const same = JSON.stringify(entry.ingredientIds) === JSON.stringify(fixedSubjects[rung.kind]) && entry.none === (rung.subjectIds.length === 0);
          check("MX-PREFIX", sortedKeys(entry) === allowedNameKeys.join(",") && same, `${recipe.id} prefix ${prefix}: bad ${rung.kind} entry`);
        }
      });
      // no row before STRUCTURE for a sub-topping, ever
      const structureDone = completed.some((r) => r.kind === "STRUCTURE");
      check("MX-SUB", structureDone || !proj.board.some((e) => e.kind === "SUB_CLASS"), `${recipe.id} prefix ${prefix}: SUB_CLASS before STRUCTURE`);
      // MX-COMPLETE
      const allDone = prefix === ladder.rungs.length;
      check("MX-COMPLETE", (proj.completeText !== null) === allDone, `${recipe.id} prefix ${prefix}: completeText ${proj.completeText !== null} vs complete ${allDone}`);
      // MX-PROJECTION: only these three keys, no next / price / pitz
      check("MX-PROJECTION", sortedKeys(proj) === "board,completeText,legacyKnownIngredientIds" && !/Pitz|price|next/i.test(projJson), `${recipe.id} prefix ${prefix}: projection carries an offer`);
      // MX-PRIVACY
      const hidden = new Set([...ladder.rungs.flatMap((r) => r.subjectIds)].filter((id) => !completedIds.has(id)));
      for (const id of hidden) {
        check("MX-PRIVACY", !projJson.includes(`"${id}"`), `${recipe.id} prefix ${prefix}: hidden id ${id} present`);
        const name = getIngredient(id)?.nameJa;
        if (name) check("MX-PRIVACY", !projJson.includes(name), `${recipe.id} prefix ${prefix}: hidden name ${name} present`);
      }
      for (const id of subIds) {
        if (completedIds.has(id)) continue;
        check("MX-PRIVACY", !projJson.includes(`"${id}"`), `${recipe.id} prefix ${prefix}: sub-topping id ${id} present`);
      }
      // A recipe id may equal an ingredient id that is legitimately on the board (pepperoni's key topping is "pepperoni").
      const idIsOwnedIngredient = completedIds.has(recipe.id);
      check("MX-PRIVACY", (idIsOwnedIngredient || !projJson.includes(`"${recipe.id}"`)) && !projJson.includes(recipe.nameJa) && !projJson.includes(recipe.description.slice(0, 12)), `${recipe.id} prefix ${prefix}: recipe identity present`);
      check("MX-PRIVACY", !/(cls:|h5:|ing:|meta:|attr:)/.test(projJson), `${recipe.id} prefix ${prefix}: a ledger string is present`);
      // deterministic
      check("MX-PRIVACY", JSON.stringify(project(presentation(recipe.id, stored))) === projJson, `${recipe.id} prefix ${prefix}: not deterministic`);

      perPrefix.push(JSON.stringify({ board: proj.board.map((e) => ({ ...e, rungIndex: undefined })), done: allDone, legacy: proj.legacyKnownIngredientIds }));
      prefixProjections.set(`${recipe.id}|${prefix}`, projJson);

      if (prefix === 0) {
        // nothing bought: identical for every recipe (MX-FREELEAK)
        check("MX-FREELEAK", projJson === prefixProjections.get(`${RECIPES[0].id}|0`), `${recipe.id}: nothing-bought projection differs from ${RECIPES[0].id}`);
      }
      if (!p.next) break;
      const r = L.requestHint5Rung({ recipeId: recipe.id, discoveredCount: DISCOVERED_COUNT, storedFactIds: stored, legacyPurchases: {}, expectedRungIndex: p.next.rungIndex, pitzBalance: 100000 });
      if (r.outcome !== "ANSWERED" && r.outcome !== "ALREADY_KNOWN") {
        check("MX-PREFIX", false, `${recipe.id} prefix ${prefix}: authority answered ${r.outcome}`);
        break;
      }
      stored = [...stored, ...r.addFactIds.filter((id) => !stored.includes(id))];
      prefix += 1;
    }

    // MX-SUB: forged cls: records without STRUCTURE (and without any h5 marker) never produce a row
    if (subIds.length > 0) {
      const forged = subIds.map((id) => `cls:${id}`);
      for (const extra of [[], ["h5:sauce"], ["h5:sauce", "h5:cheese", "h5:key"]]) {
        const proj = project(presentation(recipe.id, [...extra, ...forged]));
        check("MX-SUB", !proj.board.some((e) => e.kind === "SUB_CLASS"), `${recipe.id}: forged cls: records drew a row without STRUCTURE (${extra.join("+") || "no markers"})`);
      }
      // MX-LEGACY: a legacy ing: name is an owned name, completes nothing, leaves the pre-purchase view alone
      const base = presentation(recipe.id, []);
      const legacy = presentation(recipe.id, [`ing:${subIds[0]}`]);
      check("MX-LEGACY", legacy.board.length === 0 && JSON.stringify(legacy.legacyKnownIngredientIds) === JSON.stringify([subIds[0]]), `${recipe.id}: legacy name handling`);
      check("MX-LEGACY", JSON.stringify(legacy.next) === JSON.stringify(base.next), `${recipe.id}: a legacy name changed the pre-purchase offer`);
    }
  }

  // MX-METAMORPHIC: equal completed content => equal projection, for every pair and prefix
  const ids = [...contentKeys.keys()];
  let pairs = 0;
  for (let a = 0; a < ids.length; a += 1) {
    for (let b = a + 1; b < ids.length; b += 1) {
      const ka = contentKeys.get(ids[a]);
      const kb = contentKeys.get(ids[b]);
      for (let k = 0; k < Math.min(ka.length, kb.length); k += 1) {
        if (ka[k] !== kb[k]) continue;
        pairs += 1;
        check("MX-METAMORPHIC", prefixProjections.get(`${ids[a]}|${k}`) === prefixProjections.get(`${ids[b]}|${k}`), `${ids[a]} vs ${ids[b]} at prefix ${k}: same completed content, different projection`);
      }
    }
  }

  // MX-ROBUST: hostile ledgers never throw and never add a row
  const hostile = [null, undefined, 0, "h5:sauce", {}, { 0: "h5:sauce" }, [1, 2, 3], [null, {}, []], ["__proto__", "constructor", "toString", "hasOwnProperty"], ["h5:future", "cls:", "cls:__proto__", "ing:", "meta:", "x".repeat(10000)], Array.from({ length: 5000 }, (_, i) => `ing:unknown-${i}`)];
  for (const stored of hostile) {
    for (const legacy of [undefined, null, 5, [], { discoveryHintPurchases: "x" }, { margherita: "9" }]) {
      let ok = true;
      let p = null;
      try {
        p = L.hint5Presentation({ recipeId: "capricciosa", discoveredCount: 5, storedFactIds: stored, legacyPurchases: legacy, pitzBalance: 0 });
      } catch {
        ok = false;
      }
      check("MX-ROBUST", ok && p !== null && p.board.length === 0, `hostile ledger ${JSON.stringify(stored)?.slice(0, 40)} / legacy ${JSON.stringify(legacy)}: ${ok ? `${p?.board.length} rows` : "threw"}`);
    }
  }

  // ---- report ---------------------------------------------------------------------------------------------
  const invariants = [...results.values()].map((r) => ({ ...r, status: r.failures.length === 0 && r.cases > 0 ? "PASS" : r.cases === 0 ? "NOT EXERCISED" : "FAIL", failures: r.failures.slice(0, 10) }));
  const subCounts = shapeRows.reduce((acc, r) => ({ ...acc, [r.subToppings]: (acc[r.subToppings] ?? 0) + 1 }), {});
  const out = {
    tool: "tools/original_pizza_p3_2_fact_display_audit.mjs",
    matrix: matrix.id,
    note: "Read-only check of the proposed matrix against current main; no design value is decided here.",
    production: { recipes: RECIPES.length, hint5Flag: HINT5_LADDER_ENABLED, metamorphicPairsChecked: pairs },
    ladderShapes: { recipes: shapeRows, recipesBySubToppingCount: subCounts, maxBoardRows: Math.max(...shapeRows.map((r) => r.rungs)) },
    invariants,
  };
  writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);
  for (const i of invariants) console.log(`${i.id.padEnd(20)} ${i.status.padEnd(13)} cases=${i.cases}${i.failures.length ? `  first failure: ${i.failures[0]}` : ""}`);
  console.log(JSON.stringify({ ...out.production, recipesBySubToppingCount: subCounts, maxBoardRows: out.ladderShapes.maxBoardRows }));
  process.exitCode = invariants.some((i) => i.status !== "PASS") ? 1 : 0;
} finally {
  await server.close();
}
