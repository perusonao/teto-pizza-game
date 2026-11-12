/**
 * Train Kit: claim / dependency check BEFORE the first edit. It reuses the Owner Gate's own parser and overlap rules
 * (scripts/ops/lib) on JSON you already have, so it needs no token and writes nothing to GitHub:
 *
 *   --files  a,b,c | @file.json      the files you are about to edit (plan writes claim-files.json)
 *   --claims comments.json           the Issue / PR comments (the array a GitHub client returns: body, author_association, created_at, user)
 *   --prs    prs.json                optional: open PRs as [{ number, title, files: [...] }]
 *   --session <id>                   your own session id (its claims are not conflicts)
 *
 * Exit 1 when another live claim or open PR overlaps. A claim is a soft reservation (Session Operations §1): on a HOT overlap the
 * later session states which PR merges first; this tool only makes the overlap impossible to miss.
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseClaims } from "../../scripts/ops/lib/claims.mjs";
import { globsIntersect, matchesAny } from "../../scripts/ops/lib/overlap.mjs";
import { ROOT } from "./cli.mjs";

export function findClaimConflicts({ files, comments, prs = [], session = "", nowMs = Date.now(), hotFiles = [] }) {
  const parsed = parseClaims(comments, nowMs);
  const live = parsed.active.filter((c) => c.session !== session);
  const conflicts = [];
  for (const c of live) {
    const hit = files.filter((f) => (c.files ?? []).some((g) => globsIntersect(f, g)));
    if (hit.length > 0) conflicts.push({ kind: "CLAIM", by: c.session, pr: c.pr ?? null, expires: new Date(c.expiresAt).toISOString(), files: hit, hot: hit.filter((f) => matchesAny(f, hotFiles)) });
  }
  for (const pr of prs) {
    const hit = files.filter((f) => (pr.files ?? []).some((g) => globsIntersect(f, g)));
    if (hit.length > 0) conflicts.push({ kind: "OPEN_PR", by: `#${pr.number}`, pr: pr.number, expires: null, files: hit, hot: hit.filter((f) => matchesAny(f, hotFiles)) });
  }
  return { live: live.length, invalid: parsed.invalid.length, conflicts };
}

export function claims(flags) {
  if (typeof flags.files !== "string" || typeof flags.claims !== "string") throw new Error("claims needs --files <a,b|@file.json> --claims <comments.json>");
  const files = flags.files.startsWith("@") ? JSON.parse(readFileSync(resolve(flags.files.slice(1)), "utf8")) : flags.files.split(",");
  const comments = JSON.parse(readFileSync(resolve(flags.claims), "utf8"));
  const prs = typeof flags.prs === "string" ? JSON.parse(readFileSync(resolve(flags.prs), "utf8")) : [];
  const { hotFiles } = JSON.parse(readFileSync(join(ROOT, "scripts", "ops", "hot-files.json"), "utf8"));
  const result = findClaimConflicts({ files, comments, prs, session: typeof flags.session === "string" ? flags.session : "", hotFiles });
  console.log(`live claims of other sessions: ${result.live}; ignored (untrusted / malformed): ${result.invalid}; open PRs checked: ${prs.length}; conflicts: ${result.conflicts.length}`);
  for (const c of result.conflicts) console.log(`${c.hot.length ? "HOT " : ""}${c.kind} ${c.by}${c.expires ? ` (until ${c.expires})` : ""}: ${c.files.slice(0, 8).join(", ")}${c.files.length > 8 ? ` ... +${c.files.length - 8}` : ""}`);
  return result.conflicts.length > 0 ? 1 : 0;
}
