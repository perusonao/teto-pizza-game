// Changed-file overlap between open PRs and active claims. Warnings only.

const HAS_WILD = /[*?]/;

export function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        i++;
        if (glob[i + 1] === "/") {
          i++;
          re += "(?:.*/)?";
        } else re += ".*";
      } else re += "[^/]*";
    } else if (ch === "?") re += "[^/]";
    else re += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

export const matchesGlob = (file, glob) => globToRegExp(glob).test(file);
export const matchesAny = (file, globs) => globs.some((g) => matchesGlob(file, g));

/** Conservative: true when two path/glob strings could name a common file. */
export function globsIntersect(a, b) {
  if (a === b) return true;
  if (!HAS_WILD.test(a)) return matchesGlob(a, b);
  if (!HAS_WILD.test(b)) return matchesGlob(b, a);
  const pa = a.split(/[*?]/)[0];
  const pb = b.split(/[*?]/)[0];
  return pa.startsWith(pb) || pb.startsWith(pa);
}

/**
 * @param prs    [{ number, title, draft, hold, files: string[] }]
 * @param claims active claims from parseClaims (files are globs)
 * @param hotFiles glob list (scripts/ops/hot-files.json)
 * @returns [{ a: {kind,id}, b: {kind,id}, files: string[], hot: string[] }]
 */
export function findOverlaps({ prs, claims, hotFiles }) {
  const owners = [
    ...prs.map((p) => ({ kind: "pr", id: p.number, label: `PR #${p.number}`, files: p.files, exact: true, draft: p.draft, hold: p.hold })),
    ...claims.map((c) => ({ kind: "claim", id: `${c.session}#${c.issue}`, label: `claim ${c.session} (Issue #${c.issue})`, files: c.files, exact: false, pr: c.pr })),
  ];
  const out = [];
  for (let i = 0; i < owners.length; i++) {
    for (let j = i + 1; j < owners.length; j++) {
      const a = owners[i];
      const b = owners[j];
      // A claim and the PR that realises it are one piece of work.
      if ((a.kind === "claim" && a.pr && b.kind === "pr" && b.id === a.pr) || (b.kind === "claim" && b.pr && a.kind === "pr" && a.id === b.pr)) continue;
      const shared = new Set();
      for (const fa of a.files) {
        for (const fb of b.files) {
          if (a.exact && b.exact) {
            if (fa === fb) shared.add(fa);
          } else if (a.exact) {
            if (matchesGlob(fa, fb)) shared.add(fa);
          } else if (b.exact) {
            if (matchesGlob(fb, fa)) shared.add(fb);
          } else if (globsIntersect(fa, fb)) shared.add(fa === fb ? fa : `${fa} ~ ${fb}`);
        }
      }
      if (shared.size === 0) continue;
      const files = [...shared].sort();
      out.push({
        a: { kind: a.kind, id: a.id, label: a.label, draft: a.draft ?? false, hold: a.hold ?? false },
        b: { kind: b.kind, id: b.id, label: b.label, draft: b.draft ?? false, hold: b.hold ?? false },
        files,
        hot: files.filter((f) => matchesAny(f, hotFiles)),
      });
    }
  }
  return out.sort((x, y) => y.hot.length - x.hot.length || y.files.length - x.files.length);
}
