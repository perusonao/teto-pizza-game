import { getIngredient } from "./ingredients";
import type { Recipe } from "./recipes";
import { countUsedIngredient } from "../logic/scoring";
import type { PizzaState } from "../state/pizzaState";
import type { DialogueLine } from "./dialogue";

interface RecipeHintSet {
  empty: string;
  emptyHint: string;
  missing: Record<string, string>;
  ready: string;
}

export const RECIPE_HINTS: Record<string, RecipeHintSet> = {
  margherita: {
    empty: "指でなぞってトマトソースを塗ろう！",
    emptyHint: "ピザを指でなぞると、トマトソースが塗れるよ。ふちの近くまで大胆に広げてみて！",
    missing: {
      mozzarella: "とろっとしたモッツァレラをたっぷりのせよう！",
      basil: "仕上げに香り高いバジルをのせたら完成に近いよ！",
    },
    ready: "いい感じ！「焼く！」を押してみよう。",
  },
  marinara: {
    empty: "指でなぞってトマトソースを塗ろう！",
    emptyHint: "指でくるくるなぞると塗れるよ。ふちの近くまで大胆に広げてみて！",
    missing: {
      garlic: "にんにくをぱらぱらっと散らしてみて！香りが決め手だよ。",
      oregano: "オレガノを振ったら、ナポリの下町の味になるよ！",
    },
    ready: "シンプルだけど本格的！そろそろ焼いちゃおう。",
  },
  "quattro-formaggi": {
    empty: "指でなぞってオリーブオイルを塗ろう！",
    emptyHint: "指でなぞるとオリーブオイルが広がるよ。ふちの近くまでしっかり塗ってみて！",
    missing: {
      mozzarella: "まずはモッツァレラをのせて土台を作ろう！",
      gorgonzola: "ゴルゴンゾーラも忘れずに、少しクセのある香りが決め手だよ！",
      parmigiano: "パルミジャーノを削ってのせると香ばしくなるよ！",
      fontina: "とろけるフォンティーナで仕上げよう！",
    },
    ready: "4種のチーズが勢ぞろい！とろとろに焼き上げよう！",
  },
  genovese: {
    empty: "指でなぞって緑のソースを塗ろう！",
    emptyHint: "指でなぞると緑のソースが広がるよ。ふちの近くまで大胆に塗ってみて！",
    missing: {
      mozzarella: "モッツァレラをのせて、まろやかさをプラスしよう！",
      "cherry-tomato": "チェリートマトを散らすと彩りがぐっと良くなるよ！",
    },
    ready: "彩り鮮やかになった！そろそろ焼いてみよう。",
  },
  bismarck: {
    empty: "指でなぞってトマトソースを塗ろう！",
    emptyHint: "指でくるくるなぞると塗れるよ。ふちの近くまで大胆に広げてみて！",
    missing: {
      mozzarella: "モッツァレラをたっぷりのせよう！",
      egg: "まんなかに卵をのせたら、ビスマルクらしくなるよ！",
    },
    ready: "卵がまんなかで輝いてる！焼いてみよう。",
  },
  funghi: {
    empty: "指でなぞってトマトソースを塗ろう！",
    emptyHint: "指でなぞるとトマトソースが塗れるよ。ふちの近くまで大胆に広げてみて！",
    missing: {
      mozzarella: "モッツァレラをのせて土台を作ろう！",
      mushroom: "マッシュルームをたっぷりのせて、香り豊かに仕上げよう！",
    },
    ready: "きのこの香りがいい感じ！そろそろ焼いてみよう。",
  },
};

export function buildHintLine(
  recipe: Recipe,
  pizza: PizzaState,
  isExplicitHint = false,
): DialogueLine {
  const hints = RECIPE_HINTS[recipe.id];
  const sauceRequirement = recipe.requiredIngredients.find(
    (req) => getIngredient(req.ingredientId)?.category === "sauce",
  );
  const hasCorrectSauce = sauceRequirement
    ? pizza.sauceIds.includes(sauceRequirement.ingredientId)
    : false;

  let text: string;
  if (sauceRequirement && !hasCorrectSauce) {
    const fallback = "まずはソースを塗ってみて！ピザを指でなぞると塗れるよ。";
    text = isExplicitHint ? (hints?.emptyHint ?? fallback) : (hints?.empty ?? fallback);
  } else {
    const missingReq = recipe.requiredIngredients.find((req) => {
      if (getIngredient(req.ingredientId)?.category === "sauce") return false;
      return countUsedIngredient(pizza, req.ingredientId) < req.minCount;
    });
    if (missingReq) {
      const ingredient = getIngredient(missingReq.ingredientId);
      text = hints?.missing[missingReq.ingredientId] ?? `${ingredient?.nameJa}をのせてみよう！`;
    } else {
      text = hints?.ready ?? "いい感じ！「焼く！」を押してみよう。";
    }
  }

  return { speaker: "mito", id: `hint.${recipe.id}`, textJa: text };
}
