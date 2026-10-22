/**
 * Tables keyed by `RecipeId` (sauce profiles, hint roles, ...) carry a row for every late-catalog recipe in EVERY build, because
 * `RecipeId` includes the late ids (types only). In a build where the late catalog is OFF (Production) those recipes do not exist at
 * runtime, so a "table keys == RECIPES" check must ignore their rows. With the catalog ON nothing is ignored. TEST SUPPORT ONLY.
 */
import { LATE_RECIPES, lateCatalogEnabled } from "../../../data/lateCatalog";

const INACTIVE: ReadonlySet<string> = lateCatalogEnabled() ? new Set() : new Set(LATE_RECIPES.map((r) => r.id));

/** `ids` without the late recipes that do not exist in this build. */
export function withoutInactiveLate<T extends string>(ids: readonly T[]): T[] {
  return ids.filter((id) => !INACTIVE.has(id));
}

/** The values of a RecipeId-keyed table, without the rows of late recipes that do not exist in this build. */
export function activeRows<V>(table: Readonly<Record<string, V>>): V[] {
  return Object.entries(table).filter(([id]) => !INACTIVE.has(id)).map(([, v]) => v);
}
