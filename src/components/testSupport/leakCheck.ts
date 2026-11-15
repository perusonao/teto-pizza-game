/**
 * Batch 25 M-1 (Owner-approved minimal fix): the ingredient-name disclosure check of the Hint 5.0 sheet tests.
 *
 * `surface()` concatenates neighbouring elements without a separator, so a BOUGHT name followed by a section label can spell another
 * (unbought) ingredient across the boundary: 「サワークリーム」 (bought) + the label 「チーズ」 = 「クリームチーズ」. That is not a leak.
 *
 * An occurrence of `name` in `text` is tolerated ONLY if it STARTS inside an occurrence of a bought name (so it is the tail of something the player paid for).
 * Every other occurrence -- standalone, split across elements, or starting outside a bought name -- is a leak and is reported. Nothing else is relaxed.
 */
export function leakedOccurrences(text: string, name: string, boughtNames: readonly string[]): number[] {
  if (name.length === 0) return [];
  const boughtSpans: Array<[number, number]> = [];
  for (const bought of boughtNames) {
    if (bought.length === 0) continue;
    for (let at = text.indexOf(bought); at !== -1; at = text.indexOf(bought, at + 1)) boughtSpans.push([at, at + bought.length]);
  }
  const leaks: number[] = [];
  for (let at = text.indexOf(name); at !== -1; at = text.indexOf(name, at + 1)) {
    const startsInsideBought = boughtSpans.some(([from, to]) => from <= at && at < to);
    if (!startsInsideBought) leaks.push(at);
  }
  return leaks;
}
