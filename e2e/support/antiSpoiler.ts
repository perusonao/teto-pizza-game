import { expect, type Page } from "@playwright/test";
import { INGREDIENTS } from "../../src/data/ingredients";
import { RECIPES } from "../../src/data/recipes";

/**
 * Discovery Hint 2.0 (Issue #229) Final Gate: a whole-document anti-spoiler sweep for the hint
 * surfaces (HintSheet, near-miss RESULT, Dex hint CTA).
 *
 * Scans the entire DOM -- every text node, hidden and offscreen ones included (not `innerText`),
 * except <style> / <script> contents, and every attribute of every element (id, class, aria-*,
 * data-*, ...) -- for any identity of a recipe that is NOT in `discovered`: its name, its
 * description, or its id.
 *
 * Public text is stripped before the name check, so known string collisions are not reported:
 *  - ingredient names (allowed in hints, A-3): 「ジェノベーゼソース」 contains the recipe name
 *    「ジェノベーゼ」, the ingredient 「ペパロニ」 is also a recipe name;
 *  - discovered recipes' own names / descriptions (public in the Dex): marinara's description says
 *    「ナポリ生まれ」, which contains the recipe name 「ナポリ」.
 * Recipe ids that are also ingredient ids (`pepperoni`) are public ingredient ids, so the id check
 * skips them.
 */
export async function expectNoUndiscoveredIdentity(page: Page, discovered: readonly string[], where: string) {
  const dom = await page.evaluate(() => {
    // Every text node of the document (hidden / offscreen / aria-hidden included) except the
    // contents of <style> / <script> / <noscript>, which are not UI (the dev server inlines CSS,
    // whose source comments name recipes; the recipe data itself ships in the JS bundle).
    const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
    const parts: string[] = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.parentElement?.closest("style, script, noscript")) parts.push(n.nodeValue ?? "");
    }
    return {
      text: parts.join("\n"),
      attributes: [...document.querySelectorAll("*")].flatMap((el) => [...el.attributes].map((a) => a.value)),
    };
  });
  const publicStrings = [
    ...INGREDIENTS.map((i) => i.nameJa),
    ...RECIPES.filter((r) => discovered.includes(r.id)).flatMap((r) => [r.description, r.nameJa]),
  ].sort((a, b) => b.length - a.length);
  const text = publicStrings.reduce((t, s) => t.split(s).join("□"), dom.text);
  const ingredientIds = new Set(INGREDIENTS.map((i) => i.id));
  const tokens = new Set(dom.attributes.flatMap((v) => v.split(/[^a-z0-9-]+/)));

  for (const r of RECIPES) {
    if (discovered.includes(r.id)) continue;
    expect.soft(text, `${where}: undiscovered name ${r.nameJa}`).not.toContain(r.nameJa);
    expect.soft(text, `${where}: undiscovered description of ${r.id}`).not.toContain(r.description);
    if (!ingredientIds.has(r.id)) expect.soft(tokens.has(r.id), `${where}: undiscovered id ${r.id} in an attribute`).toBe(false);
  }
}
