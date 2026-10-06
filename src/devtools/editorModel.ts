import type { EditorCatalog } from "./editorCatalog";
import { PRESET_FINITE_STOCK } from "./presets";
import { EDITABLE_FIELD_LABELS_JA, EDITABLE_STATE_KEYS, type EditableState } from "./stateModel";

/**
 * DEV State Editor (Issue #403) S4: the editing operations on a DRAFT and the diff shown before an apply.
 *
 * Pure functions over `EditableState`; nothing here reads or writes storage. Every operation returns a new
 * state (or the very same reference when it changes nothing) and works for any `EditorCatalog`: no recipe /
 * ingredient id or count is named here.
 */

const isStarter = (catalog: EditorCatalog, id: string) => catalog.starterIds.includes(id);
const isFiniteIngredient = (catalog: EditorCatalog, id: string) => catalog.ingredients.some((i) => i.id === id && i.unlockCondition !== undefined);

export function ingredientName(catalog: EditorCatalog, id: string): string {
  return catalog.ingredients.find((i) => i.id === id)?.nameJa ?? id;
}

export function recipeName(catalog: EditorCatalog, id: string): string {
  return catalog.recipes.find((r) => r.id === id)?.nameJa ?? id;
}

/** OWNED on: the material is appended LAST in the acquisition order, with the preset stock (editable). OFF: it and its stock are removed. */
export function toggleOwned(state: EditableState, id: string, catalog: EditorCatalog): EditableState {
  if (!isFiniteIngredient(catalog, id)) return state;
  if (state.ownedIngredientIds.includes(id)) {
    const { [id]: _removed, ...inventory } = state.inventory;
    return { ...state, ownedIngredientIds: state.ownedIngredientIds.filter((x) => x !== id), inventory };
  }
  return { ...state, ownedIngredientIds: [...state.ownedIngredientIds, id], inventory: { ...state.inventory, [id]: PRESET_FINITE_STOCK } };
}

/** A finite material's stock (a non-negative integer); only for an OWNED finite material. */
export function setStock(state: EditableState, id: string, qty: number, catalog: EditorCatalog): EditableState {
  if (!isFiniteIngredient(catalog, id) || !state.ownedIngredientIds.includes(id)) return state;
  if (!Number.isInteger(qty) || qty < 0) return state;
  if ((state.inventory[id] ?? 0) === qty && id in state.inventory) return state;
  return { ...state, inventory: { ...state.inventory, [id]: qty } };
}

/** Moves an OWNED finite material one place earlier / later in the acquisition order (the starters stay first). */
export function moveOwned(state: EditableState, id: string, direction: "earlier" | "later", catalog: EditorCatalog): EditableState {
  const order = state.ownedIngredientIds;
  const from = order.indexOf(id);
  const to = direction === "earlier" ? from - 1 : from + 1;
  const firstMovable = catalog.starterIds.length;
  if (from < firstMovable || to < firstMovable || to >= order.length) return state;
  const next = [...order];
  [next[from], next[to]] = [next[to], next[from]];
  return { ...state, ownedIngredientIds: next };
}

export function setPitz(state: EditableState, pitz: number): EditableState {
  if (!Number.isInteger(pitz) || pitz < 0 || pitz === state.pitzBalance) return state;
  return { ...state, pitzBalance: pitz };
}

/** Research Hint reset: the bought facts and the purchase ledger of every recipe. */
export function clearHints(state: EditableState): EditableState {
  return { ...state, discoveryHintFacts: {}, discoveryHintPurchases: {} };
}

export function hintCounts(state: EditableState): { factRecipes: number; factIds: number; purchaseRecipes: number } {
  return {
    factRecipes: Object.keys(state.discoveryHintFacts).length,
    factIds: Object.values(state.discoveryHintFacts).reduce((n, facts) => n + facts.length, 0),
    purchaseRecipes: Object.keys(state.discoveryHintPurchases).length,
  };
}

/** The finite material acquired last (what a Research Entry names as its unlock fact), or null. */
export function lastAcquiredFinite(state: EditableState, catalog: EditorCatalog): string | null {
  const finite = state.ownedIngredientIds.filter((id) => !isStarter(catalog, id));
  return finite.length > 0 ? finite[finite.length - 1] : null;
}

export type OwnedFilter = "all" | "owned" | "not-owned";

export interface IngredientRow {
  id: string;
  nameJa: string;
  starter: boolean;
  owned: boolean;
  stock: number | null;
  /** 1-based place among the OWNED finite materials in the acquisition order (null when not owned or a starter). */
  order: number | null;
  canMoveEarlier: boolean;
  canMoveLater: boolean;
}

/** The rows of the ingredient list, in catalog order, filtered by a search text (id or name) and an OWNED filter. */
export function ingredientRows(state: EditableState, catalog: EditorCatalog, query: string, filter: OwnedFilter): IngredientRow[] {
  const q = query.trim().toLowerCase();
  const finiteOwned = state.ownedIngredientIds.filter((id) => !isStarter(catalog, id));
  const rows: IngredientRow[] = [];
  for (const ing of catalog.ingredients) {
    const starter = isStarter(catalog, ing.id);
    const owned = starter || state.ownedIngredientIds.includes(ing.id);
    if (filter === "owned" && !owned) continue;
    if (filter === "not-owned" && owned) continue;
    const nameJa = ing.nameJa ?? ing.id;
    if (q && !ing.id.toLowerCase().includes(q) && !nameJa.toLowerCase().includes(q)) continue;
    const position = starter ? -1 : finiteOwned.indexOf(ing.id);
    rows.push({
      id: ing.id,
      nameJa,
      starter,
      owned,
      stock: starter || !owned ? null : (state.inventory[ing.id] ?? 0),
      order: position >= 0 ? position + 1 : null,
      canMoveEarlier: position > 0,
      canMoveLater: position >= 0 && position < finiteOwned.length - 1,
    });
  }
  return rows;
}

// ---- the diff shown before an apply ---------------------------------------------------------------------

export interface DiffRow {
  id: string;
  label: string;
  detail: string;
}

function list(names: readonly string[], max = 8): string {
  return names.length <= max ? names.join("・") : `${names.slice(0, max).join("・")} ほか${names.length - max}件`;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** What applying `next` over `base` changes, as readable rows. Empty = no change. */
export function diffEditable(base: EditableState, next: EditableState, catalog: EditorCatalog): DiffRow[] {
  const rows: DiffRow[] = [];
  const add = (id: string, label: string, detail: string) => rows.push({ id, label, detail });

  if (base.pitzBalance !== next.pitzBalance) add("pitz", "Pitz", `${base.pitzBalance} → ${next.pitzBalance}`);

  const baseOwned = new Set(base.ownedIngredientIds);
  const nextOwned = new Set(next.ownedIngredientIds);
  const gained = next.ownedIngredientIds.filter((id) => !baseOwned.has(id));
  const lost = base.ownedIngredientIds.filter((id) => !nextOwned.has(id));
  if (gained.length > 0) add("owned-added", `材料を OWNED にする（${gained.length}件）`, list(gained.map((id) => ingredientName(catalog, id))));
  if (lost.length > 0) add("owned-removed", `材料の OWNED を外す（${lost.length}件）`, list(lost.map((id) => ingredientName(catalog, id))));

  const commonBase = base.ownedIngredientIds.filter((id) => nextOwned.has(id));
  const commonNext = next.ownedIngredientIds.filter((id) => baseOwned.has(id));
  if (!same(commonBase, commonNext)) {
    const names = (ids: readonly string[]) => list(ids.filter((id) => !isStarter(catalog, id)).map((id) => ingredientName(catalog, id)), 12).replaceAll("・", "→");
    add("order", "取得順の変更（共通の材料）", `前: ${names(commonBase)} ／ 後: ${names(commonNext)}`);
  }
  const lastBase = lastAcquiredFinite(base, catalog);
  const lastNext = lastAcquiredFinite(next, catalog);
  if (lastBase !== lastNext) {
    add("last-acquired", "最後に取得した材料（Research Entry の unlock fact に影響）", `${lastBase ? ingredientName(catalog, lastBase) : "なし"} → ${lastNext ? ingredientName(catalog, lastNext) : "なし"}`);
  }

  const stockIds = [...new Set([...Object.keys(base.inventory), ...Object.keys(next.inventory)])].filter((id) => (base.inventory[id] ?? 0) !== (next.inventory[id] ?? 0));
  if (stockIds.length > 0) add("stock", `在庫の変更（${stockIds.length}件）`, list(stockIds.map((id) => `${ingredientName(catalog, id)} ${base.inventory[id] ?? 0}→${next.inventory[id] ?? 0}`)));

  const baseDex = new Map(base.dex.map((e) => [e.recipeId, e]));
  const nextDex = new Map(next.dex.map((e) => [e.recipeId, e]));
  const dexAdded = [...nextDex.keys()].filter((id) => !baseDex.has(id));
  const dexRemoved = [...baseDex.keys()].filter((id) => !nextDex.has(id));
  const dexChanged = [...nextDex.keys()].filter((id) => baseDex.has(id) && !same(baseDex.get(id), nextDex.get(id)));
  if (dexAdded.length + dexRemoved.length + dexChanged.length > 0) {
    const parts = [
      dexAdded.length > 0 ? `発見 +${dexAdded.length}（${list(dexAdded.map((id) => recipeName(catalog, id)), 6)}）` : "",
      dexRemoved.length > 0 ? `未発見に戻す −${dexRemoved.length}（${list(dexRemoved.map((id) => recipeName(catalog, id)), 6)}）` : "",
      dexChanged.length > 0 ? `記録更新 ${dexChanged.length}件` : "",
    ].filter(Boolean);
    add("dex", `Dex: ${base.dex.length} → ${next.dex.length} 件`, parts.join(" ／ "));
  }

  const hintBefore = hintCounts(base);
  const hintAfter = hintCounts(next);
  if (!same(base.discoveryHintFacts, next.discoveryHintFacts)) add("hint-facts", EDITABLE_FIELD_LABELS_JA.discoveryHintFacts, `${hintBefore.factRecipes} レシピ（${hintBefore.factIds} facts） → ${hintAfter.factRecipes} レシピ（${hintAfter.factIds} facts）`);
  if (!same(base.discoveryHintPurchases, next.discoveryHintPurchases)) add("hint-purchases", EDITABLE_FIELD_LABELS_JA.discoveryHintPurchases, `${hintBefore.purchaseRecipes} レシピ → ${hintAfter.purchaseRecipes} レシピ`);

  // The remaining fields are plain id lists (ledgers): a generic added / removed row, labelled from the field list.
  const handled = new Set<string>(["dex", "pitzBalance", "ownedIngredientIds", "inventory", "discoveryHintFacts", "discoveryHintPurchases"]);
  for (const key of EDITABLE_STATE_KEYS) {
    if (handled.has(key)) continue;
    const before = base[key] as readonly string[];
    const after = next[key] as readonly string[];
    const addedIds = after.filter((id) => !before.includes(id));
    const removedIds = before.filter((id) => !after.includes(id));
    if (addedIds.length + removedIds.length === 0) continue;
    const name = (id: string) => (key === "starterGrantClaimedRecipeIds" ? recipeName(catalog, id) : ingredientName(catalog, id));
    add(`ledger:${key}`, EDITABLE_FIELD_LABELS_JA[key], [addedIds.length > 0 ? `+${addedIds.length}（${list(addedIds.map(name), 6)}）` : "", removedIds.length > 0 ? `−${removedIds.length}（${list(removedIds.map(name), 6)}）` : ""].filter(Boolean).join(" ／ "));
  }
  return rows;
}
