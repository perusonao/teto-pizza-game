/** Path geometry of the placed parmigiano shavings (pure; kept out of the component file so that file exports only a component). */
export const r = (n: number): string => (Math.round(n * 100) / 100).toString();

/** A broad flake: a ragged polygon (mostly straight edges, softly rounded corners) around an ellipse, so no two are the same silhouette. */
export function flakePath(len: number, wid: number, verts: readonly number[]): string {
  const count = verts.length;
  const points = verts.map((factor, index) => {
    // the angular position is nudged by a neighbour's factor so the corners are not evenly spaced
    const theta = ((index + (verts[(index + 2) % count] - 1) * 1.4) / count) * Math.PI * 2 + 0.35;
    return { x: (len / 2) * factor * Math.cos(theta), y: (wid / 2) * factor * Math.sin(theta) };
  });
  const toward = (from: { x: number; y: number }, to: { x: number; y: number }, amount: number) => ({ x: from.x + (to.x - from.x) * amount, y: from.y + (to.y - from.y) * amount });
  let d = "";
  for (let index = 0; index < count; index += 1) {
    const corner = points[index];
    const before = toward(corner, points[(index + count - 1) % count], 0.24);
    const after = toward(corner, points[(index + 1) % count], 0.24);
    d += `${index === 0 ? "M" : "L"} ${r(before.x)} ${r(before.y)} Q ${r(corner.x)} ${r(corner.y)} ${r(after.x)} ${r(after.y)} `;
  }
  return `${d}Z`;
}

/** The centre line of a ribbon at `t` in 0..1: a gentle arc, `bend` being its rise as a fraction of the length. */
function ribbonCentre(len: number, bend: number, t: number): { x: number; y: number } {
  return { x: len * (t - 0.5), y: bend * len * (1 - 4 * (t - 0.5) * (t - 0.5)) * 0.5 };
}

/** A long thin ribbon along a slight arc, with blunt cut ends (a shaving is a cut strip, not a horn). */
export function ribbonPath(len: number, wid: number, bend: number): string {
  const steps = 11;
  const top: string[] = [];
  const bottom: string[] = [];
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const centre = ribbonCentre(len, bend, t);
    const half = (wid / 2) * Math.pow(Math.sin(Math.PI * t), 0.3);
    top.push(`${r(centre.x)} ${r(centre.y - half)}`);
    bottom.push(`${r(centre.x)} ${r(centre.y + half)}`);
  }
  return `M ${top.join(" L ")} L ${bottom.reverse().join(" L ")} Z`;
}

/** The pale highlight along the upper edge of a ribbon (the curl catching the light). */
export function ribbonHighlightPath(len: number, wid: number, bend: number): string {
  const points: string[] = [];
  for (let step = 1; step <= 8; step += 1) {
    const t = step / 10;
    const centre = ribbonCentre(len, bend, t);
    const half = (wid / 2) * Math.pow(Math.sin(Math.PI * t), 0.3);
    points.push(`${r(centre.x)} ${r(centre.y - half * 0.45)}`);
  }
  return `M ${points.join(" L ")}`;
}

