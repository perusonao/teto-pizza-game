/**
 * Large Catalog UX LC-1 (pure, UNWIRED): the player's own favorites / recent / newly-owned signals.
 *
 * LC-OD-5: session-only. Nothing here is written to the save; LC-9 re-decides persistence. Every
 * list holds ingredient ids only (never a recipe), newest first, de-duplicated and capped.
 */
import { cleanIds } from "./catalogTypes";

export interface UsageSession {
  favorites: readonly string[];
  /** Most recently used first. */
  recent: readonly string[];
  /** Most recently obtained first (session-only stand-in for "not used yet", LC-OD-5). */
  newlyOwned: readonly string[];
}

export const DEFAULT_RECENT_CAP = 20;
export const DEFAULT_NEWLY_OWNED_CAP = 20;

export function emptyUsageSession(): UsageSession {
  return { favorites: [], recent: [], newlyOwned: [] };
}

/** Untrusted -> well-formed (unknown shapes become empty lists). */
export function sanitizeUsageSession(raw: unknown): UsageSession {
  // Own properties only: an inherited (`__proto__`) list is never read.
  const own = (key: keyof UsageSession) =>
    raw !== null && typeof raw === "object" && Object.hasOwn(raw, key) ? (raw as Record<string, unknown>)[key] : undefined;
  return { favorites: cleanIds(own("favorites")), recent: cleanIds(own("recent")), newlyOwned: cleanIds(own("newlyOwned")) };
}

export function toggleFavorite(session: UsageSession, id: string): UsageSession {
  if (typeof id !== "string") return session;
  const favorites = session.favorites.includes(id)
    ? session.favorites.filter((f) => f !== id)
    : [...session.favorites, id];
  return { ...session, favorites };
}

function pushFront(list: readonly string[], ids: readonly string[], cap: number): string[] {
  const front = cleanIds([...ids].reverse());
  const rest = list.filter((id) => !front.includes(id));
  return [...front, ...rest].slice(0, Math.max(0, Math.floor(cap)));
}

/** A finished pizza's ingredients, in the order they were used (the last one becomes first). */
export function recordUse(session: UsageSession, usedIds: readonly string[], cap = DEFAULT_RECENT_CAP): UsageSession {
  return { ...session, recent: pushFront(session.recent, usedIds, cap) };
}

export function recordNewlyOwned(session: UsageSession, id: string, cap = DEFAULT_NEWLY_OWNED_CAP): UsageSession {
  return { ...session, newlyOwned: pushFront(session.newlyOwned, [id], cap) };
}
