/** Path geometry of the placed parmigiano shavings (pure; kept out of the component file so that file exports only a component). */
export const r = (n: number): string => (Math.round(n * 100) / 100).toString();

/** A broad flake: an irregular sheet outline (ragged, with notches; corners only slightly rounded) around an ellipse, so no two are the same silhouette and none is a hard shard. */
export function flakePath(len: number, wid: number, verts: readonly number[]): string {
  const count = verts.length;
  const points = verts.map((factor, index) => {
    // the angular position is nudged by a neighbour's factor so the corners are not evenly spaced
    const theta = ((index + (verts[(index + 3) % count] - 1) * 1.6) / count) * Math.PI * 2 + 0.35;
    return { x: (len / 2) * factor * Math.cos(theta), y: (wid / 2) * factor * Math.sin(theta) };
  });
  const toward = (from: { x: number; y: number }, to: { x: number; y: number }, amount: number) => ({ x: from.x + (to.x - from.x) * amount, y: from.y + (to.y - from.y) * amount });
  let d = "";
  for (let index = 0; index < count; index += 1) {
    const corner = points[index];
    const before = toward(corner, points[(index + count - 1) % count], 0.3);
    const after = toward(corner, points[(index + 1) % count], 0.3);
    d += `${index === 0 ? "M" : "L"} ${r(before.x)} ${r(before.y)} Q ${r(corner.x)} ${r(corner.y)} ${r(after.x)} ${r(after.y)} `;
  }
  return `${d}Z`;
}

const lerpProfile = (profile: readonly number[], offset: number, t: number): number => {
  const span = 4; // five samples per edge
  const position = Math.min(span - 1e-9, Math.max(0, t * span));
  const index = Math.floor(position);
  const mix = position - index;
  return profile[offset + index] * (1 - mix) + profile[offset + index + 1] * mix;
};

/** One fine grain line along a flake (the fibre of a thin shaving), slightly off-axis. */
export function grainPath(len: number, wid: number, core: number): string {
  const l = (len / 2) * (0.5 + core * 0.4);
  return `M ${r(-l)} ${r(wid * 0.06)} Q ${r(0)} ${r(-wid * 0.12)} ${r(l)} ${r(wid * 0.02)}`;
}

/** The centre line of a ribbon at `t` in 0..1: a slight arc plus a slow S-shaped wander. */
function ribbonCentre(len: number, bend: number, wobble: number, t: number): { x: number; y: number } {
  return { x: len * (t - 0.5), y: bend * len * (1 - 4 * (t - 0.5) * (t - 0.5)) * 0.5 + wobble * len * Math.sin(2 * Math.PI * t) };
}

/** Half-width envelope: blunt ends (never a point) and a body that is widest around the middle. */
const envelope = (t: number): number => 0.3 + 0.7 * Math.pow(Math.sin(Math.PI * t), 0.6);

/** A thin shaving longer than it is wide, whose two edges have different, uneven widths (a cut strip, not a crescent or a horn). */
export function ribbonPath(len: number, wid: number, bend: number, wobble: number, profile: readonly number[]): string {
  const steps = 13;
  const top: string[] = [];
  const bottom: string[] = [];
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const centre = ribbonCentre(len, bend, wobble, t);
    const upper = (wid / 2) * envelope(t) * lerpProfile(profile, 0, t);
    const lower = (wid / 2) * envelope(t) * lerpProfile(profile, 5, t);
    top.push(`${r(centre.x)} ${r(centre.y - upper)}`);
    bottom.push(`${r(centre.x)} ${r(centre.y + lower)}`);
  }
  return `M ${top.join(" L ")} L ${bottom.reverse().join(" L ")} Z`;
}

/** A faint line along the upper part of a ribbon (a thin shaving catching the light). */
export function ribbonHighlightPath(len: number, wid: number, bend: number, wobble: number, profile: readonly number[]): string {
  const points: string[] = [];
  for (let step = 2; step <= 9; step += 1) {
    const t = step / 11;
    const centre = ribbonCentre(len, bend, wobble, t);
    const upper = (wid / 2) * envelope(t) * lerpProfile(profile, 0, t);
    points.push(`${r(centre.x)} ${r(centre.y - upper * 0.4)}`);
  }
  return `M ${points.join(" L ")}`;
}
