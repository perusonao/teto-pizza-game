/**
 * Issue #39 PS3 / Issue #47 Slice B: the single shared ring of dough-percent slot positions
 * used to lay out a recipe's non-sauce pieces deterministically from its own
 * `requiredIngredients` order -- originally authored for `../components/PizzaThumbnail.tsx`
 * (Pizza Select's card preview) and reused as-is by `../data/playerReference.ts` (Issue #47
 * Finding F/H's player-facing Making reference) so both consumers draw from one canonical
 * generated layout table instead of two independently hand-tuned coordinate schemes. Both now
 * read it through `getReferenceSlots(n)` below (RT-01b), which is exact for n <= 8 and never
 * wraps for larger n.
 *
 * RT-01 (docs/reports/TETO_RT01_REFERENCE-PIECE-CAPACITY_Fresh-Design.md, Owner Decision
 * RT-01-OD-1): this table stays byte-identical and is still the exact layout for 1-8 pieces --
 * `getReferenceSlots(n)` below returns `PIECE_RING_POSITIONS.slice(0, n)` for n <= 8 and only
 * generates a new (Candidate B, multi-ring) layout for n >= 9.
 */
export const PIECE_RING_POSITIONS = [
  { x: 50, y: 24 },
  { x: 73, y: 36 },
  { x: 76, y: 63 },
  { x: 58, y: 79 },
  { x: 38, y: 79 },
  { x: 22, y: 63 },
  { x: 25, y: 36 },
  { x: 50, y: 52 },
] as const;

export interface ReferenceSlot {
  x: number;
  y: number;
}

const CENTER = 50;

/** Outermost piece-centre radius a generated layout may use (dough-percent). Every piece centre
 *  stays on the ideal sauce fixture's painted area (outer ring radius 36, ../data/referencePizza.ts)
 *  with room for the largest half-footprint before the dough edge (radius 48). The existing
 *  hand-authored Scoring 2.0 fixtures reach 32.2 and the legacy ring 30.9. */
export const REFERENCE_SLOT_MAX_RADIUS = 34;

/** Minimum centre-to-centre gap (dough-percent) at which two pieces do not touch in the smallest
 *  reference view that draws per-piece positions: the Making screen's always-visible mini 見本
 *  (`.mini-reference__thumb .reference-thumbnail`, App.css: 48px box, 4px border, piece-scale
 *  0.26 on a 28px base glyph) -> 28 * 0.26 / (48 - 2 * 4) * 100 = 18.2. The 64px thumbnail (17.0)
 *  and the 140px popover (10.94) are both looser. This is a legibility target, not a capacity
 *  cap: a count that cannot meet it still gets the widest-gap layout available. */
export const REFERENCE_SLOT_MIN_GAP = 18.2;

/** Outer-ring radii the multi-ring search may use, most compact first (28 = the legacy ring's own
 *  mean radius). */
const OUTER_RADII = [28, 30, 32, REFERENCE_SLOT_MAX_RADIUS] as const;
/** Inner-ring radii searched for two-ring layouts. */
const INNER_RADII = Array.from({ length: 17 }, (_, i) => 8 + i);
/** An inner ring must sit at least this far inside the outer ring. */
const MIN_RING_SEPARATION = 6;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function polar(radius: number, theta: number): ReferenceSlot {
  return { x: round2(CENTER + radius * Math.cos(theta)), y: round2(CENTER + radius * Math.sin(theta)) };
}

/** `count` points evenly spaced on one ring, starting at 12 o'clock, rotated by `offsetSteps`
 *  fractions of one step (0.5 staggers it against a neighbouring ring). */
function ring(radius: number, count: number, offsetSteps: number): ReferenceSlot[] {
  return Array.from({ length: count }, (_, i) =>
    polar(radius, -Math.PI / 2 + (2 * Math.PI * (i + offsetSteps)) / count),
  );
}

function centrePoints(centre: number): ReferenceSlot[] {
  return centre ? [{ x: CENTER, y: CENTER }] : [];
}

/** `rings` concentric rings at outer * (k + 1) / rings, counts proportional to circumference
 *  (largest-remainder rounding), odd rings staggered by half a step. */
function proportionalRings(n: number, rings: number, centre: number, outer: number): ReferenceSlot[] {
  const rest = n - centre;
  const radii = Array.from({ length: rings }, (_, k) => (outer * (k + 1)) / rings);
  const total = radii.reduce((sum, r) => sum + r, 0);
  const raw = radii.map((r) => (rest * r) / total);
  const counts = raw.map((value) => Math.floor(value));
  const order = radii
    .map((_, k) => k)
    .sort((a, b) => raw[b] - counts[b] - (raw[a] - counts[a]) || b - a);
  let missing = rest - counts.reduce((sum, c) => sum + c, 0);
  for (const k of order) {
    if (missing <= 0) break;
    counts[k] += 1;
    missing -= 1;
  }
  const points = centrePoints(centre);
  radii.forEach((radius, k) => {
    const count = counts[k];
    if (count > 0) points.push(...ring(radius, count, k % 2 === 1 ? 0.5 : 0));
  });
  return points;
}

/** Smallest centre-to-centre distance in a layout (0 for fewer than two points). */
export function minimumSlotGap(slots: readonly ReferenceSlot[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < slots.length; i += 1) {
    for (let j = i + 1; j < slots.length; j += 1) {
      best = Math.min(best, Math.hypot(slots[i].x - slots[j].x, slots[i].y - slots[j].y));
    }
  }
  return Number.isFinite(best) ? best : 0;
}

/** `minimumSlotGap`, but stops as soon as any pair is closer than `floor` (the result is then
 *  some value < floor, which is all a caller that discards such layouts needs to know). */
function minimumSlotGapAtLeast(slots: readonly ReferenceSlot[], floor: number): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < slots.length; i += 1) {
    for (let j = i + 1; j < slots.length; j += 1) {
      const d = Math.hypot(slots[i].x - slots[j].x, slots[i].y - slots[j].y);
      if (d < best) {
        best = d;
        if (best < floor) return best;
      }
    }
  }
  return Number.isFinite(best) ? best : 0;
}

interface Candidate {
  rings: number;
  centre: number;
  gap: number;
  index: number;
  slots: ReferenceSlot[];
}

function* candidatesForOuter(n: number, outer: number): Generator<Omit<Candidate, "gap" | "index">> {
  for (const centre of [1, 0]) {
    const rest = n - centre;
    yield { rings: 1, centre, slots: [...centrePoints(centre), ...ring(outer, rest, 0)] };
    for (const inner of INNER_RADII) {
      if (inner >= outer - MIN_RING_SEPARATION) continue;
      for (let innerCount = 1; innerCount < rest; innerCount += 1) {
        for (const offset of [0, 0.5]) {
          yield {
            rings: 2,
            centre,
            slots: [...centrePoints(centre), ...ring(outer, rest - innerCount, 0), ...ring(inner, innerCount, offset)],
          };
        }
      }
    }
    for (const rings of [3, 4]) {
      yield { rings, centre, slots: proportionalRings(n, rings, centre, outer) };
    }
  }
}

/** Candidate B (multi-ring) for n >= 9: the most compact configuration (smallest outer radius,
 *  then fewest rings, then keep the centre piece, then widest gap) whose minimum gap meets
 *  `REFERENCE_SLOT_MIN_GAP`; if no configuration meets it, the widest-gap configuration. Mirrors
 *  tools/rt01_reference_capacity_design.py's `cand_b_multiring` (same enumeration order and
 *  tie-breaks). */
function multiRingSlots(n: number): ReferenceSlot[] {
  let bestAny: Candidate | null = null;
  let bestAnyOuter = 0;
  let index = 0;
  for (const outer of OUTER_RADII) {
    let bestOk: Candidate | null = null;
    for (const candidate of candidatesForOuter(n, outer)) {
      // A layout below both the legibility target and the best fallback so far can never be
      // selected, so its exact gap is not needed.
      const floor = Math.min(REFERENCE_SLOT_MIN_GAP, bestAny ? bestAny.gap : 0) - 1e-6;
      const gap = Math.round(minimumSlotGapAtLeast(candidate.slots, floor) * 1e6) / 1e6;
      const scored: Candidate = { ...candidate, gap, index };
      index += 1;
      if (gap + 1e-9 >= REFERENCE_SLOT_MIN_GAP) {
        if (
          !bestOk ||
          scored.rings < bestOk.rings ||
          (scored.rings === bestOk.rings && scored.centre > bestOk.centre) ||
          (scored.rings === bestOk.rings && scored.centre === bestOk.centre && scored.gap > bestOk.gap)
        ) {
          bestOk = scored;
        }
      }
      // Fallback ranking: widest gap, then smaller outer radius (enumeration order), fewer rings,
      // keep the centre piece, earliest enumerated.
      if (
        !bestAny ||
        scored.gap > bestAny.gap ||
        (scored.gap === bestAny.gap &&
          outer === bestAnyOuter &&
          (scored.rings < bestAny.rings || (scored.rings === bestAny.rings && scored.centre > bestAny.centre)))
      ) {
        bestAny = scored;
        bestAnyOuter = outer;
      }
    }
    // Configurations are scored smallest-outer-radius first, so the first radius with any
    // legible configuration wins outright.
    if (bestOk) return bestOk.slots;
  }
  return bestAny ? bestAny.slots : [];
}

const slotCache = new Map<number, readonly ReferenceSlot[]>();

/**
 * RT-01a: `n` deterministic, pairwise-distinct piece positions (dough-percent) for a reference
 * pizza. n <= 8 returns `PIECE_RING_POSITIONS.slice(0, n)` exactly (every shipped layout stays
 * byte-identical); n >= 9 returns the approved Candidate B multi-ring layout. Depends only on
 * `n` (never on a recipe id), and has no upper bound on `n`. Results are memoised per `n` and
 * returned as fresh copies, so callers may not mutate the cache.
 */
export function getReferenceSlots(n: number): ReferenceSlot[] {
  const count = Math.max(0, Math.floor(n));
  if (count <= PIECE_RING_POSITIONS.length) {
    return PIECE_RING_POSITIONS.slice(0, count).map((slot) => ({ x: slot.x, y: slot.y }));
  }
  let slots = slotCache.get(count);
  if (!slots) {
    slots = multiRingSlots(count);
    slotCache.set(count, slots);
  }
  return slots.map((slot) => ({ x: slot.x, y: slot.y }));
}

export interface ReferenceSlotGroup {
  ingredientId: string;
  count: number;
}

/**
 * RT-01 (Owner Decision RT-01-OD-1): assigns `getReferenceSlots(total)` to ingredient groups.
 * total <= 8 keeps the existing consecutive rule (group 1 takes the first `count` slots, and so
 * on -- exactly what `../data/playerReference.ts` has always done). total >= 9 interleaves: slots
 * are ordered outer ring first, clockwise from 12 o'clock, centre last; groups take turns in their
 * given order, and each group's next piece takes the free slot farthest from its own earlier
 * pieces, so no ingredient clusters in one area.
 */
export function assignReferenceSlots(
  groups: readonly ReferenceSlotGroup[],
): { ingredientId: string; positions: ReferenceSlot[] }[] {
  const total = groups.reduce((sum, group) => sum + Math.max(0, group.count), 0);
  const slots = getReferenceSlots(total);
  const result = groups.map((group) => ({ ingredientId: group.ingredientId, positions: [] as ReferenceSlot[] }));

  if (total <= PIECE_RING_POSITIONS.length) {
    let slot = 0;
    groups.forEach((group, g) => {
      for (let i = 0; i < group.count; i += 1) {
        result[g].positions.push(slots[slot]);
        slot += 1;
      }
    });
    return result;
  }

  const sortKey = (slot: ReferenceSlot): [number, number, number] => {
    const radius = Math.hypot(slot.x - CENTER, slot.y - CENTER);
    if (radius < 0.5) return [1, 0, 0];
    const angle = (Math.atan2(slot.y - CENTER, slot.x - CENTER) + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI);
    return [0, -Math.round(radius * 10) / 10, angle];
  };
  const ordered = slots
    .map((slot, index) => ({ slot, key: sortKey(slot), index }))
    .sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.key[2] - b.key[2] || a.index - b.index);

  // Groups take turns in their given order. A group's first piece takes the first free slot in
  // that order; each later piece takes the free slot farthest from the group's own earlier
  // pieces (earliest in order on a tie), so no ingredient ends up clustered.
  const free = ordered.map((entry) => entry.slot);
  const remaining = groups.map((group) => Math.max(0, group.count));
  while (remaining.some((c) => c > 0)) {
    remaining.forEach((count, g) => {
      if (count <= 0) return;
      const own = result[g].positions;
      let pick = 0;
      if (own.length > 0) {
        let bestDistance = -1;
        free.forEach((slot, index) => {
          const nearest = Math.min(...own.map((p) => Math.hypot(p.x - slot.x, p.y - slot.y)));
          const rounded = Math.round(nearest * 1e6) / 1e6;
          if (rounded > bestDistance) {
            bestDistance = rounded;
            pick = index;
          }
        });
      }
      own.push(free[pick]);
      free.splice(pick, 1);
      remaining[g] -= 1;
    });
  }
  return result;
}
