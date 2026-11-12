/** Train Kit: node:test suite of the plain-JS parts (run by src/trainKit/kitCli.test.ts, so the existing CI job covers it). */
import assert from "node:assert/strict";
import { test } from "node:test";
import { deepDiff, parseArgs } from "./cli.mjs";
import { findClaimConflicts } from "./claims.mjs";
import { touchedFiles } from "./plan.mjs";
import { parseCsv, renderProgress, summarize } from "./progress.mjs";

const NOW = Date.parse("2026-11-11T00:00:00Z");
const claim = (session, files, extra = {}) => ({ author_association: "OWNER", created_at: "2026-11-10T00:00:00Z", html_url: `u/${session}`, body: `<!-- teto-claim:v1 ${JSON.stringify({ session, issue: 780, pr: null, branch: "b", files, dependsOn: [], expires: "2026-11-20T00:00:00Z", ...extra })} -->` });

test("parseArgs: flags with and without a value, positional arguments", () => {
  assert.deepEqual(parseArgs(["spec.json", "--dry-run", "--out", "x", "--tsc"]), { flags: { "dry-run": true, out: "x", tsc: true }, rest: ["spec.json"] });
});

test("deepDiff: key order is ignored, array order and values are not", () => {
  assert.deepEqual(deepDiff({ a: 1, b: [1, 2] }, { b: [1, 2], a: 1 }), []);
  assert.equal(deepDiff({ a: [1, 2] }, { a: [2, 1] }).length, 2);
  assert.match(deepDiff({ a: 1 }, { a: 1, b: 2 })[0], /^b: undefined != 2/);
});

test("claims: a live claim of another session or an open PR on my files is a conflict; mine, released, expired and untrusted ones are not", () => {
  const comments = [
    claim("other", ["src/data/**"]),
    claim("me", ["src/data/recipes.ts"]),
    claim("gone", ["src/data/recipes.ts"], { released: true, files: [] }),
    claim("old", ["src/data/recipes.ts"], { expires: "2026-11-10T12:00:00Z" }),
    { ...claim("stranger", ["src/data/recipes.ts"]), author_association: "NONE" },
  ];
  const r = findClaimConflicts({ files: ["src/data/recipes.ts", "e2e/t24.spec.ts"], comments, prs: [{ number: 9, files: ["e2e/t24.spec.ts"] }, { number: 10, files: ["README.md"] }], session: "me", nowMs: NOW, hotFiles: ["src/data/recipes.ts"] });
  assert.equal(r.live, 1);
  assert.equal(r.invalid, 1);
  assert.deepEqual(r.conflicts.map((c) => [c.kind, c.by, c.files, c.hot]), [["CLAIM", "other", ["src/data/recipes.ts"], ["src/data/recipes.ts"]], ["OPEN_PR", "#9", ["e2e/t24.spec.ts"], []]]);
  assert.deepEqual(findClaimConflicts({ files: ["docs/x.md"], comments, session: "me", nowMs: NOW }).conflicts, []);
});

test("plan: the touched files follow the spec's shape", () => {
  const late = { tag: "t9", recipes: [{ id: "r", placement: "late", ladderStep: { ingredientIds: ["x"] } }], newIngredients: [{ id: "x", pieceVisual: "x-art" }] };
  const a = touchedFiles(late);
  assert.ok(a.edited.includes("src/data/lateCatalog.ts") && a.edited.includes("src/components/IngredientGlyph.tsx") && a.edited.includes("src/preview/hvSeeds.ts"));
  assert.ok(!a.edited.includes("src/data/recipes.ts") && !a.edited.includes("src/data/ingredientTaxonomy.ts"));
  assert.deepEqual(a.generated, ["src/trainKit/landed/t9.json", "src/preview/t9HvSeeds.ts", "src/preview/t9HvSeeds.test.ts", "e2e/t9.spec.ts"]);
  const rider = touchedFiles({ tag: "t8", recipes: [{ id: "r", placement: "ordinary", ladderStep: null }], newIngredients: [] });
  assert.deepEqual(rider.generated, ["src/trainKit/landed/t8.json"]);
  assert.ok(rider.edited.includes("src/data/recipes.ts") && !rider.edited.includes("src/preview/hvSeeds.ts") && !rider.edited.includes("src/data/ingredients.ts"));
});

test("progress: shipped / staged / target arithmetic and the CSV reader", () => {
  assert.deepEqual(parseCsv('id,name,status\nA,"x, ""y""",IMPLEMENTED\nB,z,HOLD\n'), [{ id: "A", name: 'x, "y"', status: "IMPLEMENTED" }, { id: "B", name: "z", status: "HOLD" }]);
  const s = summarize({
    dump: { recipes: [{ id: "r1" }, { id: "r2" }], ingredients: [{ id: "i1" }] },
    stagedRecipes: [{ id: "r2", mechanics: [] }, { id: "r3", mechanics: [] }, { id: "r4", mechanics: ["FRY", "PREP"] }],
    stagedIngredients: [{ id: "i2" }],
    methods: [{ status: "IMPLEMENTED" }, { status: "HOLD" }],
    targets: { ingredients: 4, recipes: 5, methods: 2 },
    landed: [],
  });
  assert.deepEqual(s.lines.map((l) => [l.line, l.shipped, l.staged, l.remaining, l.unplanned]), [["ingredients", 1, 1, 3, 2], ["recipes", 2, 2, 3, 1], ["methods", 1, 1, 1, 0]]);
  assert.deepEqual(s.catalogOnlyReady, ["r3"]);
  assert.deepEqual(s.pendingRecipesByMechanic, { "(none: catalog-only)": 1, FRY: 1, PREP: 1 });
  assert.match(renderProgress(s, "abc1234"), /\| recipes \| 2 \| 2 \| 5 \| 3 \| 1 \| 40% \|/);
});

import { applyOps } from "./mutation.mjs";

test("mutation: every operation must match exactly once, and a stale mutation throws instead of passing", () => {
  const text = "a\nb\nc\nb2\n";
  assert.equal(applyOps(text, [{ type: "replace", from: "c", to: "C" }]), "a\nb\nC\nb2\n");
  assert.equal(applyOps(text, [{ type: "swapLines", a: "a", b: "c" }]), "c\nb\na\nb2\n");
  assert.equal(applyOps(text, [{ type: "deleteLine", line: "b" }]), "a\nc\nb2\n");
  assert.throws(() => applyOps(text, [{ type: "replace", from: "b", to: "x" }]), /matches 2x/); // "b" is also inside "b2"
  assert.throws(() => applyOps(text, [{ type: "replace", from: "zzz", to: "x" }]), /matches 0x/);
  assert.throws(() => applyOps(text, [{ type: "deleteLine", line: "nope" }]), /matches 0x/);
  assert.throws(() => applyOps(text, [{ type: "boom" }]), /unknown operation/);
});
