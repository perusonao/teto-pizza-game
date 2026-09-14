import type { BakeState } from "../logic/bake";
import type { ScoreBreakdown } from "../logic/scoring";
import { getRecipeIndex, type Recipe } from "./recipes";

export type Speaker = "teto" | "mito" | "blue";

export interface DialogueLine {
  speaker: Speaker;
  id: string;
  textJa: string;
}

/**
 * Deterministically rotates through `variants` using `seed`. No randomness and no
 * play-history state — the same (recipe, outcome) always maps to the same seed, but
 * different recipes/outcomes land on different variants so lines don't feel identical
 * across a run of several pizzas.
 */
function pickVariant<T>(variants: readonly T[], seed: number): T {
  const index = ((seed % variants.length) + variants.length) % variants.length;
  return variants[index];
}

const TETO_ORDER_VARIANTS = [
  (name: string) => `よし！${name}を作ろう！生地にソースを塗って好きなトッピングを選んでね。`,
  (name: string) => `${name}か、腕が鳴るな！まずは生地にソースを塗るところからだ。`,
  (name: string) => `よーし、今日は${name}に挑戦だ！トッピングは好きに選んでいいぞ。`,
] as const;

export function buildTetoOrderLine(recipe: Recipe): DialogueLine {
  const template = pickVariant(TETO_ORDER_VARIANTS, getRecipeIndex(recipe.id));
  return { speaker: "teto", id: `order.teto.${recipe.id}`, textJa: template(recipe.nameJa) };
}

const TETO_BAKE_VARIANTS = [
  (name: string) =>
    `${name}、いい香りがしてきたぞ…色の変化をよく見て、ちょうどいいタイミングで取り出そう！`,
  (name: string) => `おっ、${name}のいい匂いだ！色をしっかり見て、ベストな瞬間で取り出すぞ！`,
] as const;

export function buildTetoBakeLine(recipe: Recipe): DialogueLine {
  const template = pickVariant(TETO_BAKE_VARIANTS, getRecipeIndex(recipe.id));
  return { speaker: "teto", id: `bake.teto.${recipe.id}`, textJa: template(recipe.nameJa) };
}

const TETO_RESULT_VARIANTS: Record<BakeState, readonly ((name: string) => string)[]> = {
  perfect: [
    (name) => `${name}、いい焼き色だ！これはうまく焼けたぞ！`,
    (name) => `よし、${name}が完璧に焼けた！我ながらいい仕事だ！`,
  ],
  raw: [
    (name) => `${name}、もう少し焼いてもよかったかもな…`,
    (name) => `うーん、${name}はちょっと早く出しすぎたか…次はもう少し粘ってみよう。`,
  ],
  burnt: [
    (name) => `${name}、ちょっと焼きすぎたな…次はうまくやろう！`,
    (name) => `おっと、${name}が香ばしくなりすぎた…！次は早めに取り出すぞ。`,
  ],
};

export function buildTetoResultLine(
  recipe: Recipe,
  bakeState: BakeState,
  bakeResult: number | null,
): DialogueLine {
  const variants = TETO_RESULT_VARIANTS[bakeState];
  const seed = getRecipeIndex(recipe.id) + Math.floor(bakeResult ?? 0);
  const template = pickVariant(variants, seed);
  return {
    speaker: "teto",
    id: `result.teto.${bakeState}.${recipe.id}`,
    textJa: template(recipe.nameJa),
  };
}

type BlueBand = "high" | "mid" | "low" | "lowRaw" | "lowBurnt";

const BLUE_RESULT_VARIANTS: Record<BlueBand, readonly ((name: string) => string)[]> = {
  high: [
    (name) => `${name}、最高だよ！これぞ職人の仕事だね！また作ってよ！`,
    (name) => `うまい…！${name}がこんなに美味しくなるとはね！また食べたいな。`,
  ],
  mid: [
    (name) => `${name}、なかなかいいじゃないか。あと一息で完璧だね。`,
    (name) => `おいしいよ、${name}！でももう少し極められそうだね。`,
  ],
  low: [
    (name) => `${name}、うーん、次はレシピどおりの材料で挑戦してみて！`,
    (name) => `${name}か…次はもっとおいしくなりそうだな。材料を見直してみよう！`,
  ],
  lowRaw: [
    (name) => `うわ、${name}の真ん中がまだ生っぽいや…次はもう少し長めに焼いてみよう！`,
    (name) => `おっと、${name}が生焼けだ…！もうちょい火を通してみて。`,
  ],
  lowBurnt: [
    (name) => `うっ、${name}が香ばしいを通り越して焦げてるよ…次は早めに取り出してみて！`,
    (name) => `おおっと、${name}が真っ黒だ…！次はもっと早く取り出そう。`,
  ],
};

function classifyBlueBand(score: ScoreBreakdown, bakeState: BakeState | null): BlueBand {
  if (score.stars === 3) return "high";
  if (bakeState === "raw") return "lowRaw";
  if (bakeState === "burnt") return "lowBurnt";
  if (score.stars === 2) return "mid";
  return "low";
}

export function buildBlueResultLine(
  recipe: Recipe,
  score: ScoreBreakdown,
  bakeState: BakeState | null,
  bakeResult: number | null,
): DialogueLine {
  const band = classifyBlueBand(score, bakeState);
  const variants = BLUE_RESULT_VARIANTS[band];
  const seed = getRecipeIndex(recipe.id) + Math.floor(bakeResult ?? 0);
  const template = pickVariant(variants, seed);
  return { speaker: "blue", id: `result.blue.${band}.${recipe.id}`, textJa: template(recipe.nameJa) };
}

const MITO_REPEAT_ORDER_VARIANTS = [
  (name: string) => `また${name}が食べたいな！今日もお願いしてもいい？`,
  (name: string) => `${name}、また食べたくなっちゃった！今日はそれでお願い！`,
  (name: string) => `今日の気分は${name}かな。また作ってくれる？`,
] as const;

/**
 * Order-time line for Mito. Undiscovered recipes keep their existing hand-written
 * flavor text from ORDERS (unchanged, including the first-play Margherita intro).
 * Once a recipe is already in the dex, a rotating "repeat order" line is used instead
 * so replaying the same recipe doesn't show the exact same request every time.
 */
export function buildMitoOrderLine(
  orderId: string,
  orderLineJa: string,
  recipe: Recipe,
  dex: string[],
): DialogueLine {
  const alreadyDiscovered = dex.includes(recipe.id);
  if (!alreadyDiscovered) {
    return { speaker: "mito", id: orderId, textJa: orderLineJa };
  }
  const template = pickVariant(MITO_REPEAT_ORDER_VARIANTS, getRecipeIndex(recipe.id));
  return { speaker: "mito", id: `${orderId}.repeat`, textJa: template(recipe.nameJa) };
}
