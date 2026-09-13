export type Speaker = "teto" | "mito" | "blue";

export interface DialogueLine {
  speaker: Speaker;
  id: string;
  textJa: string;
}

export const DIALOGUE: Record<string, DialogueLine> = {
  "order.mito": {
    speaker: "mito",
    id: "order.mito",
    textJa: "マルゲリータが食べたいな！おすすめを教えてテト！",
  },
  "order.teto": {
    speaker: "teto",
    id: "order.teto",
    textJa: "よし！おいしいピザを作ろう！生地にソースを塗って好きなトッピングを選んでね。",
  },
  "prepare.hint.empty": {
    speaker: "mito",
    id: "prepare.hint.empty",
    textJa: "まずはソースを塗ってみて！",
  },
  "prepare.hint.sauceOnly": {
    speaker: "mito",
    id: "prepare.hint.sauceOnly",
    textJa: "いいね！次はモッツァレラをのせよう。",
  },
  "prepare.hint.needBasil": {
    speaker: "mito",
    id: "prepare.hint.needBasil",
    textJa: "あとはバジルをのせたら完成に近いよ！",
  },
  "prepare.hint.ready": {
    speaker: "mito",
    id: "prepare.hint.ready",
    textJa: "いい感じ！「焼く！」を押してみよう。",
  },
  "bake.teto": {
    speaker: "teto",
    id: "bake.teto",
    textJa: "いい香り…ちょうどいいタイミングで取り出そう！",
  },
  "result.blue.high": {
    speaker: "blue",
    id: "result.blue.high",
    textJa: "最高だよ！これぞマルゲリータ！また作って！",
  },
  "result.blue.mid": {
    speaker: "blue",
    id: "result.blue.mid",
    textJa: "おいしいよ！でももう少し極められそうだね。",
  },
  "result.blue.low": {
    speaker: "blue",
    id: "result.blue.low",
    textJa: "うーん、次はレシピどおりの材料で挑戦してみて！",
  },
  "discovered.mito": {
    speaker: "mito",
    id: "discovered.mito",
    textJa: "マルゲリータがレシピ図鑑に登録されたよ！",
  },
};

export function getLine(key: string): DialogueLine {
  const line = DIALOGUE[key];
  if (!line) {
    throw new Error(`Unknown dialogue key: ${key}`);
  }
  return line;
}
