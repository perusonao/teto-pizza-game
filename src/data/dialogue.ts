export type Speaker = "teto" | "mito" | "blue";

export interface DialogueLine {
  speaker: Speaker;
  id: string;
  textJa: string;
}

export const DIALOGUE: Record<string, DialogueLine> = {
  "order.teto": {
    speaker: "teto",
    id: "order.teto",
    textJa: "よし！おいしいピザを作ろう！生地にソースを塗って好きなトッピングを選んでね。",
  },
  "bake.teto": {
    speaker: "teto",
    id: "bake.teto",
    textJa: "いい香り…色の変化をよく見て、ちょうどいいタイミングで取り出そう！",
  },
  "result.blue.high": {
    speaker: "blue",
    id: "result.blue.high",
    textJa: "最高だよ！これぞ職人の仕事！また作って！",
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
  "result.blue.low.raw": {
    speaker: "blue",
    id: "result.blue.low.raw",
    textJa: "うわ、真ん中がまだ生っぽいや…次はもう少し長めに焼いてみよう！",
  },
  "result.blue.low.burnt": {
    speaker: "blue",
    id: "result.blue.low.burnt",
    textJa: "うっ、香ばしいを通り越して焦げてるよ…次は早めに取り出してみて！",
  },
};

export function getLine(key: string): DialogueLine {
  const line = DIALOGUE[key];
  if (!line) {
    throw new Error(`Unknown dialogue key: ${key}`);
  }
  return line;
}
