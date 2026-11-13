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

import { classifyRun, judge, mutation as runMutation } from "./mutation.mjs";
import { mkdtempSync as mkTmp, mkdirSync as mkDir, writeFileSync as writeF, readFileSync as readF } from "node:fs";
import { tmpdir as tmpDir } from "node:os";
import { join as joinPath } from "node:path";

test("mutation (fail-closed): timeout, detected and missed are three different outcomes", () => {
  const timeoutMsg = [{ file: "a.test.ts", message: "Error: Test timed out in 5000ms." }];
  const assertMsg = [{ file: "a.test.ts", message: "AssertionError: expected 1 to be 2" }];
  assert.equal(classifyRun({ code: 0, messages: [] }), "pass");
  assert.equal(classifyRun({ code: 1, messages: assertMsg }), "detected");
  assert.equal(classifyRun({ code: 1, messages: [...timeoutMsg, ...assertMsg] }), "detected"); // one real failure among timeouts still detects
  assert.equal(classifyRun({ code: 1, messages: timeoutMsg }), "timeout");
  assert.equal(classifyRun({ code: 1, messages: [], suiteFailed: false }), "detected"); // crash / nothing parsed: non-zero exit is never a miss
  assert.equal(classifyRun({ code: 1, messages: timeoutMsg, suiteFailed: true }), "detected"); // a suite-level error next to timeouts is a real failure
  const r = (outcome) => ({ outcome, detected: outcome === "detected" });
  const row = (id, o, n) => ({ id, old: r(o), new: r(n), lost: o === "detected" && n === "pass" });
  const okControl = [["old", r("pass")], ["new", r("pass")]];
  assert.equal(judge([row("A", "detected", "detected"), row("B", "pass", "pass")], okControl).verdict, "PASS"); // a miss on both sides is not a failure of parity
  assert.equal(judge([row("A", "detected", "pass")], okControl).verdict, "FAIL"); // lost
  const t = judge([row("A", "timeout", "detected")], okControl);
  assert.equal(t.verdict, "FAIL");
  assert.deepEqual(t.indeterminate, ["A"]);
  assert.equal(judge([row("A", "detected", "timeout")], okControl).verdict, "FAIL");
  assert.equal(judge([], [["old", r("timeout")], ["new", r("pass")]]).verdict, "FAIL");
});

/** Two real temp trees + a stub runner, so the whole `mutation` flow (control, retry, report, exit code) is exercised without vitest. */
async function runWith(script) {
  const base = mkTmp(joinPath(tmpDir(), "kit-mut-selftest-"));
  for (const t of ["old", "new"]) { mkDir(joinPath(base, t, "src"), { recursive: true }); writeF(joinPath(base, t, "src", "x.ts"), "const v = 1;\n"); }
  writeF(joinPath(base, "muts.json"), JSON.stringify({ mutations: [{ id: "M1", description: "d", file: "src/x.ts", ops: [{ type: "replace", from: "v = 1", to: "v = 2" }] }] }));
  const calls = { old: 0, new: 0 };
  const run = async (tree) => {
    const side = tree.endsWith("/old") ? "old" : "new";
    const mutated = readF(joinPath(tree, "src", "x.ts"), "utf8").includes("v = 2");
    const outcome = script(side, mutated, ++calls[side]);
    return { outcome, detected: outcome === "detected", timeoutOnly: outcome === "timeout", firstFailingFile: null };
  };
  const out = joinPath(base, "out.json");
  const quiet = console.log; console.log = () => {};
  try {
    const flags = { old: joinPath(base, "old"), new: joinPath(base, "new"), files: "src/x.ts", out, mutations: joinPath(base, "muts.json") };
    const code = await runMutation(flags, { run }).catch((e) => e);
    return { code, report: (() => { try { return JSON.parse(readF(out, "utf8")); } catch { return null; } })(), calls, restored: ["old", "new"].every((t) => readF(joinPath(base, t, "src", "x.ts"), "utf8") === "const v = 1;\n") };
  } finally { console.log = quiet; }
}

test("mutation (fail-closed): a timeout-only control is a FAIL, never a pass", async () => {
  const r = await runWith(() => "timeout"); // every child returns a timeout-only report
  assert.ok(r.code instanceof Error && /control run did not pass.*timeout-only/.test(r.code.message));
  assert.equal(r.report, null); // no success report is written
  const r2 = await runWith((side, mutated) => (!mutated && side === "new" ? "timeout" : "detected"));
  assert.ok(r2.code instanceof Error);
  const r3 = await runWith((side, mutated) => (!mutated ? "detected" : "detected")); // a failing control is a FAIL as well
  assert.ok(r3.code instanceof Error);
});

test("mutation (fail-closed): a mutation that is still timeout-only after the retry is indeterminate = exit 1, lost is not reported as an empty success", async () => {
  const r = await runWith((side, mutated) => (!mutated ? "pass" : side === "old" ? "detected" : "timeout"));
  assert.equal(r.code, 1);
  assert.equal(r.calls.new, 3); // control + mutated run + exactly one retry
  assert.equal(r.report.summary.verdict, "FAIL");
  assert.deepEqual(r.report.summary.indeterminate, ["M1"]);
  assert.equal(r.report.summary.timeoutNew, 1);
  assert.equal(r.report.summary.missedNew, 0); // a timeout is not counted as a miss ...
  assert.equal(r.report.summary.detectedNew, 0); // ... nor as a detection
  assert.equal(r.restored, true);
});

test("mutation (fail-closed): a single timeout that the retry clears is fine; detected, missed and lost stay separate", async () => {
  let first = true;
  const ok = await runWith((side, mutated) => { if (!mutated) return "pass"; if (side === "new" && first) { first = false; return "timeout"; } return "detected"; });
  assert.equal(ok.code, 0);
  assert.equal(ok.report.summary.detectedNew, 1);
  assert.equal(ok.report.summary.timeoutNew, 0);
  const lost = await runWith((side, mutated) => (!mutated ? "pass" : side === "old" ? "detected" : "pass"));
  assert.equal(lost.code, 1);
  assert.deepEqual(lost.report.summary.lost, ["M1"]);
  assert.equal(lost.report.summary.missedNew, 1);
  const both = await runWith((side, mutated) => (!mutated ? "pass" : "pass")); // missed on both sides: parity holds, but it is reported as missed, not detected
  assert.equal(both.code, 0);
  assert.equal(both.report.summary.missedOld, 1);
  assert.equal(both.report.summary.detectedOld, 0);
});
