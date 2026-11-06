/**
 * DRIZZLE (Issue #579), D1: read-side validation of a post-bake liquid (pure, unwired; never throws). Given anything (a parsed save, a journal, a
 * hostile object), it returns a well-formed `PostBakeLiquid` or `null` / an empty list. D1 only READS; the writer is D2 (journal), on HOLD.
 *
 * Idempotent: sanitizing a sanitized value changes nothing, and a JSON round trip is stable. Unknown fields are dropped (not passed through).
 */
import {
  LIQUID_ID_PATTERN,
  MAX_RAW_LIQUIDS,
  MAX_RAW_TRAIL_POINTS,
  PERSIST_MAX_LIQUIDS,
  PERSIST_MAX_POINTS_PER_STROKE,
  POST_BAKE_LIQUID_STAGE,
  isPostBakeLiquidIngredient,
  type PostBakeLiquid,
  type TrailPoint,
} from "./postBakeLiquid";
import { clampTrailPoint, dropRepeats, isTrailPoint, thinTrail, trailLength } from "./trail";

/** A saved trail: finite points only, clamped into the dough, quantized, repeats removed, thinned to the persist limit. Not an array / too long -> []. */
export function sanitizeTrail(raw: unknown, max: number = PERSIST_MAX_POINTS_PER_STROKE): TrailPoint[] {
  try {
    if (!Array.isArray(raw) || raw.length > MAX_RAW_TRAIL_POINTS) return [];
    const points: TrailPoint[] = [];
    for (let i = 0; i < raw.length; i++) {
      const p: unknown = raw[i];
      if (!isTrailPoint(p)) continue;
      const c = clampTrailPoint(p.x, p.y);
      if (c) points.push(c);
    }
    return thinTrail(dropRepeats(points), max);
  } catch {
    return [];
  }
}

/** One saved liquid, or `null` when it is not a valid one (wrong stage, unknown material, bad id, or fewer than two distinct points / a zero-length trail). */
export function sanitizePostBakeLiquid(raw: unknown): PostBakeLiquid | null {
  try {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const o = raw as Record<string, unknown>;
    if (o.stage !== POST_BAKE_LIQUID_STAGE) return null;
    const id = o.id;
    if (typeof id !== "string" || !LIQUID_ID_PATTERN.test(id)) return null;
    const ingredientId = o.ingredientId;
    if (!isPostBakeLiquidIngredient(ingredientId)) return null;
    const trail = sanitizeTrail(o.trail);
    if (trail.length < 2 || trailLength(trail) <= 0) return null;
    return { id, ingredientId, trail, stage: POST_BAKE_LIQUID_STAGE };
  } catch {
    return null;
  }
}

/**
 * The saved list: not an array -> []; an array longer than `MAX_RAW_LIQUIDS` is read from its end; invalid entries are dropped; a repeated id keeps its
 * LAST entry; at most `PERSIST_MAX_LIQUIDS`, the newest (last) ones kept, in their original order.
 */
export function sanitizePostBakeLiquids(raw: unknown): PostBakeLiquid[] {
  try {
    if (!Array.isArray(raw)) return [];
    const start = Math.max(0, raw.length - MAX_RAW_LIQUIDS);
    const seen = new Set<string>();
    const kept: PostBakeLiquid[] = [];
    for (let i = raw.length - 1; i >= start && kept.length < PERSIST_MAX_LIQUIDS; i--) {
      const liquid = sanitizePostBakeLiquid(raw[i]);
      if (!liquid || seen.has(liquid.id)) continue;
      seen.add(liquid.id);
      kept.push(liquid);
    }
    return kept.reverse();
  } catch {
    return [];
  }
}
