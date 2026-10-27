/**
 * Issue #611 BBQ Final Design Gate (docs-only): reads the CURRENT data (main 9761d03) and prints the facts the gate needs.
 * Run: npx vite-node tools/bbq-final-gate/check.ts   (observation only; nothing is written)
 */
import { INGREDIENTS, getIngredient } from "../../src/data/ingredients";
import { RECIPES } from "../../src/data/recipes";
import { DISCOVERY_LADDER } from "../../src/data/discoveryLadder";
import { LATE_ENTITLEMENT_FLOORS, LATE_LADDER_STEPS } from "../../src/data/lateCatalog";
import { getReferenceSlots, PIECE_RING_POSITIONS } from "../../src/logic/pizzaReferenceLayout";
import { ingredientAttributeFamily } from "../../src/data/ingredientTaxonomy";
import { toppingSizeClass } from "../../src/data/toppingSizeClass";

const need = ["chicken", "onion", "mozzarella", "bbq-sauce", "cilantro"];
const out: Record<string, unknown> = {};
out.ingredientsPresent = Object.fromEntries(need.map((id) => [id, !!getIngredient(id)]));
const stepOf = (id: string) => DISCOVERY_LADDER.steps.find((s) => (s.ingredientIds as readonly string[]).includes(id))?.step ?? null;
out.unlockStep = Object.fromEntries(["chicken", "onion", "mozzarella"].map((id) => [id, stepOf(id)]));
out.ladderSteps = DISCOVERY_LADDER.steps.length;
out.lateSteps = LATE_LADDER_STEPS.map((s) => ({ ids: s.ingredientIds, key: s.keyRecipeId }));
out.lateFloors = LATE_ENTITLEMENT_FLOORS;
out.counts = { recipes: RECIPES.length, ingredients: INGREDIENTS.length };
out.sharedSubsets = RECIPES.filter((r) => ["chicken", "onion", "mozzarella"].every((i) => r.requiredIngredients.some((q) => q.ingredientId === i))).map((r) => r.id);
out.recipesWithChicken = RECIPES.filter((r) => r.requiredIngredients.some((q) => q.ingredientId === "chicken")).map((r) => `${r.id}:${r.requiredIngredients.find((q) => q.ingredientId === "chicken")!.minCount}`);
out.herbFamilySizeClass = INGREDIENTS.filter((i) => ingredientAttributeFamily(i.id) === "herb").map((i) => `${i.id}:${toppingSizeClass(i.id) ?? "?"}:${i.pieceVisual ?? "emoji"}`);
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const minGap = (pts: readonly { x: number; y: number }[]) => Math.min(...pts.flatMap((p, i) => pts.slice(i + 1).map((q) => dist(p, q))));
const s8 = getReferenceSlots(8);
out.ring = { equalsFixedRing8: JSON.stringify(s8) === JSON.stringify(PIECE_RING_POSITIONS), slots8: s8, minGap8: Math.round(minGap(s8) * 10) / 10 };
const s7 = getReferenceSlots(7);
out.ring7 = { minGap7: Math.round(minGap(s7) * 10) / 10 };
const s9 = getReferenceSlots(9);
out.ring9 = { count: s9.length, minGap9: Math.round(minGap(s9) * 10) / 10, note: "n >= 9 is generated (RT-01 multi-ring)" };
// the BBQ assignment (Owner D-1 = A / D-6 = a): requiredIngredients order = mozzarella 2, onion 1, chicken 3, cilantro 2
const order: [string, number][] = [["mozzarella", 2], ["onion", 1], ["chicken", 3], ["cilantro", 2]];
let i = 0;
out.bbqAssignment = order.flatMap(([id, n]) => Array.from({ length: n }, () => ({ ingredient: id, slot: i + 1, at: s8[i++] })));
// distance from each cilantro slot to its nearest non-cilantro slot
const cil = (out.bbqAssignment as { ingredient: string; at: { x: number; y: number } }[]).filter((p) => p.ingredient === "cilantro");
const rest = (out.bbqAssignment as { ingredient: string; at: { x: number; y: number } }[]).filter((p) => p.ingredient !== "cilantro");
out.cilantroNearest = cil.map((c) => Math.round(Math.min(...rest.map((r) => dist(c.at, r.at))) * 10) / 10);
// emoji: every ingredient's text fallback and which leaf-like ones are taken
const leaf = ["🌿", "🍃", "☘️", "🍀", "🌱", "🌾", "🥗", "🥬", "🪴"];
out.leafEmojiUse = Object.fromEntries(leaf.map((e) => [e, INGREDIENTS.filter((x) => x.emoji.replace("️", "") === e.replace("️", "")).map((x) => x.id)]));
console.log(JSON.stringify(out, null, 1));
