// Session claims: "this session owns this Issue / these files until <expires>".
// Soft reservation only -- the Owner Gate WARNS on overlap, it never blocks.
//
// A claim is a hidden JSON block inside a comment (PR body, PR comment or Issue comment):
//   <!-- teto-claim:v1 {"session":"...","issue":123,"branch":"...","files":["src/a.ts","e2e/a*.spec.ts"],
//                       "dependsOn":[558],"expires":"2026-10-22T00:00:00Z"} -->
// Release with the same (session, issue) and "released": true. The newest block per (session, issue) wins.

import { isTrustedAuthor } from "./trust.mjs";

export const CLAIM_MARKER = "teto-claim:v1";
export const DEFAULT_TTL_MS = 72 * 3600 * 1000;
// The collector only looks back 14 days of comments, so a longer claim could silently vanish: cap it.
export const MAX_TTL_MS = 14 * 86400 * 1000;
const BLOCK_RE = /<!--\s*teto-claim:v1\s*(\{[\s\S]*?\})\s*-->/g;

function validate(raw, createdAt) {
  if (!raw || typeof raw !== "object") return { error: "not an object" };
  if (typeof raw.session !== "string" || !raw.session.trim()) return { error: "session missing" };
  if (!Number.isInteger(raw.issue) || raw.issue <= 0) return { error: "issue must be a positive integer" };
  const released = raw.released === true;
  const files = raw.files ?? [];
  if (!Array.isArray(files) || files.some((f) => typeof f !== "string" || !f.trim() || f.startsWith("/") || f.includes(".."))) {
    return { error: "files must be repo-relative path/glob strings" };
  }
  if (!released && files.length === 0) return { error: "files missing" };
  const dependsOn = raw.dependsOn ?? [];
  if (!Array.isArray(dependsOn) || dependsOn.some((n) => !Number.isInteger(n) || n <= 0)) return { error: "dependsOn must be integers" };
  let expiresAt = Date.parse(createdAt) + DEFAULT_TTL_MS;
  if (raw.expires !== undefined) {
    const e = Date.parse(raw.expires);
    if (Number.isNaN(e)) return { error: "expires is not a date" };
    expiresAt = Math.min(e, Date.parse(createdAt) + MAX_TTL_MS);
  }
  return {
    claim: {
      session: raw.session.trim(),
      issue: raw.issue,
      pr: Number.isInteger(raw.pr) ? raw.pr : null,
      branch: typeof raw.branch === "string" ? raw.branch : null,
      files,
      dependsOn,
      expiresAt,
      released,
    },
  };
}

/**
 * @param comments [{ body, created_at, html_url, author_association, user }] (PR bodies are passed as pseudo-comments)
 * @returns { active, expired, released, invalid } -- only trusted authors can create or release a claim.
 */
export function parseClaims(comments, nowMs) {
  const latest = new Map();
  const invalid = [];
  for (const c of comments) {
    if (!c?.body || !c.body.includes(CLAIM_MARKER)) continue;
    if (!isTrustedAuthor(c)) {
      invalid.push({ url: c.html_url ?? null, error: "author is not trusted (claims must come from the Owner account)" });
      continue;
    }
    for (const m of c.body.matchAll(BLOCK_RE)) {
      let raw;
      try {
        raw = JSON.parse(m[1]);
      } catch {
        invalid.push({ url: c.html_url ?? null, error: "claim JSON does not parse" });
        continue;
      }
      const v = validate(raw, c.created_at);
      if (v.error) {
        invalid.push({ url: c.html_url ?? null, error: v.error });
        continue;
      }
      const key = `${v.claim.session}#${v.claim.issue}`;
      const at = Date.parse(c.created_at);
      const prev = latest.get(key);
      if (!prev || at >= prev.at) latest.set(key, { at, claim: { ...v.claim, url: c.html_url ?? null } });
    }
  }
  const out = { active: [], expired: [], released: [], invalid };
  for (const { claim } of latest.values()) {
    if (claim.released) out.released.push(claim);
    else if (claim.expiresAt <= nowMs) out.expired.push(claim);
    else out.active.push(claim);
  }
  return out;
}

/** `Depends-on: #558, #560` lines of a PR body. */
export function parseDependsOn(body) {
  const nums = new Set();
  for (const m of (body ?? "").matchAll(/^[ \t]*Depends[- ]on:[ \t]*(.+)$/gim)) {
    for (const n of m[1].matchAll(/#(\d+)/g)) nums.add(Number(n[1]));
  }
  return [...nums].sort((a, b) => a - b);
}
