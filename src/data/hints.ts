import { getIngredient } from "./ingredients";
import type { Recipe } from "./recipes";
import { countUsedIngredient } from "../logic/scoring";
import type { PizzaState } from "../state/pizzaState";
import type { MakingStep } from "../state/gameReducer";
import type { DialogueLine } from "./dialogue";
import { isFreeCookRecipe } from "./freeCook";

/** Progression 2.0 Phase 3-2 (Issue #194): a free-cook round has no recipe, so its hint names
 *  no target ingredient -- it only explains the current step and that skipping it is allowed. */
const FREE_COOK_STEP_HINTS: Partial<Record<MakingStep, { text: string; explicit: string }>> = {
  SAUCE: {
    text: "好きなソースを選んでぬろう（なしでもOK）",
    explicit: "ソースを選んで、ピザを指でなぞるとぬれるよ。ぬらずに「次へ」でもOK！",
  },
  CHEESE: {
    text: "好きなチーズをのせよう（なしでもOK）",
    explicit: "チーズを選んでピザをタップするとのせられるよ。何枚でもOK！",
  },
  TOPPING: {
    text: "好きな具をのせて「焼く！」",
    explicit: "持っている材料なら何でものせられるよ。組み合わせ次第で新しいピザが見つかるかも！",
  },
};
const FREE_COOK_FALLBACK_HINT = "好きな材料で自由に作ってみよう！";

/** Progression 2.0 Phase 3-3 (Issue #198): pre-first-discovery hint escalation. Reuses the
 *  existing Free Cooking hint slot (`buildHintLine`'s free-cook branch below) -- no separate
 *  hint/discovery system. Index 0 is never read (level 0 keeps the untouched
 *  `FREE_COOK_STEP_HINTS`/`FREE_COOK_FALLBACK_HINT` copy above, so a brand-new player's very
 *  first free-cook attempt, and any player who has already discovered something, sees exactly
 *  the pre-existing text). `GameState.preDiscoveryFreeCookAttempts` counts non-matching
 *  (ORIGINAL/AMBIGUOUS/INCOMPLETE_MATCH/FAILED) free-cook rounds while the Dex is still
 *  completely empty (../state/gameReducer.ts's CONFIRM_BAKE); `Math.min(attempts, 3)` caps the
 *  escalation at the most explicit line rather than growing forever. Each level still leaves
 *  something for the player to do themselves -- level 1/2 never name an ingredient outright,
 *  and even level 3's concrete steps require the player to actually place them. */
const FREE_COOK_DISCOVERY_HINT_LEVELS: readonly string[] = [
  "",
  "気になる色の材料が3つあるよ…赤・白・緑を探してみよう！",
  "赤いソース、とろける白いチーズ、香る緑のハーブを合わせてみたら？",
  "トマトソースを塗って、モッツァレラをのせて、バジルをちらして焼いてみよう！",
];

/** Issue #33 D1/D3A: DOUGH's own hint copy -- concise per the task's own "avoid long tutorial
 *  copy" guidance, distinct from every recipe's sauce copy so it never silently falls
 *  through to a misleading "塗ろう" (sauce) line before sauce is even reachable. D3A: updated
 *  to mention shrinking/correcting, not just stretching, now that the gesture is reversible. */
const DOUGH_HINT = "生地を伸ばしたり縮めたりして形を整えよう";
const DOUGH_HINT_EXPLICIT =
  "指で外側へなぞると伸び、内側へ戻すと縮むよ。伸ばしすぎても、縮めてやり直せるよ！";

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
      // PR-A (Issue #167 §9): mozzarella/basil are this recipe's own physically-draggable
      // ingredients (GameScreen.tsx's `draggableIngredientIds`) -- the tray's own per-chip
      // "ドラッグしてのせる" hint (`.ingredient-chip__drag-hint`) duplicated this step's own
      // instruction text and was removed (IngredientTray.tsx); the drag affordance itself is
      // folded into these two lines instead so a first-time player still learns "drag" is the
      // gesture here, without a second on-screen line saying it a second time.
      mozzarella: "とろっとしたモッツァレラをドラッグしてたっぷりのせよう！",
      basil: "仕上げに香り高いバジルをドラッグしてのせたら完成に近いよ！",
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
  makingStep: MakingStep,
  isExplicitHint = false,
  preDiscoveryFreeCookAttempts = 0,
): DialogueLine {
  if (makingStep === "DOUGH") {
    return {
      speaker: "mito",
      id: `hint.dough.${recipe.id}`,
      textJa: isExplicitHint ? DOUGH_HINT_EXPLICIT : DOUGH_HINT,
    };
  }

  if (isFreeCookRecipe(recipe)) {
    const discoveryHintLevel = Math.min(Math.max(preDiscoveryFreeCookAttempts, 0), 3);
    if (discoveryHintLevel > 0) {
      return {
        speaker: "mito",
        id: `hint.free-cook.discovery-level-${discoveryHintLevel}`,
        textJa: FREE_COOK_DISCOVERY_HINT_LEVELS[discoveryHintLevel],
      };
    }
    const stepHint = FREE_COOK_STEP_HINTS[makingStep];
    return {
      speaker: "mito",
      id: `hint.free-cook.${makingStep}`,
      textJa: stepHint ? (isExplicitHint ? stepHint.explicit : stepHint.text) : FREE_COOK_FALLBACK_HINT,
    };
  }

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
