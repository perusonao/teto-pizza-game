/**
 * Large Catalog UX LC-1 (pure, UNWIRED): search text normalization.
 *
 * NFKC (full/half width), katakana -> hiragana, lower case, and the long-vowel mark, middle dots
 * and whitespace removed, so 「ベーコン」「べこん」「ﾍﾞｰｺﾝ」 all meet. Code-point based (no locale
 * collation), so results never depend on the runtime's ICU data.
 */
import type { CatalogIngredient } from "./catalogTypes";

const KATAKANA_START = 0x30a1;
const KATAKANA_END = 0x30f6;
const KANA_OFFSET = 0x60;
const IGNORED = /[\sー‐-―−ｰ・·･・-]/gu;

export function normalizeForSearch(text: string): string {
  if (typeof text !== "string") return "";
  let out = "";
  for (const ch of text.normalize("NFKC").toLowerCase()) {
    const code = ch.codePointAt(0)!;
    out += code >= KATAKANA_START && code <= KATAKANA_END ? String.fromCodePoint(code - KANA_OFFSET) : ch;
  }
  return out.replace(IGNORED, "");
}

/** Empty (or whitespace-only) query matches everything. */
export function matchesSearch(item: CatalogIngredient, query: string): boolean {
  const q = normalizeForSearch(query);
  if (q === "") return true;
  return (
    normalizeForSearch(item.nameJa).includes(q) ||
    (item.readingJa !== undefined && normalizeForSearch(item.readingJa).includes(q)) ||
    // LC-R5-b: an Owner-approved written form (search only). Same normalized SUBSTRING rule; no reverse match.
    (item.searchAliasesJa ?? []).some((alias) => normalizeForSearch(alias).includes(q))
  );
}

/** Deterministic reading comparison (code points of the normalized reading, then catalog order). */
export function compareReading(a: CatalogIngredient, b: CatalogIngredient): number {
  const ra = normalizeForSearch(a.readingJa ?? a.nameJa);
  const rb = normalizeForSearch(b.readingJa ?? b.nameJa);
  if (ra !== rb) return ra < rb ? -1 : 1;
  return a.catalogIndex - b.catalogIndex || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}
