/** Player-facing copy for the R8 (#617) round journal: the completed-for-you notice, the kept-journal notice, and why a round could not be saved. */
import { getIngredient } from "../data/ingredients";
import { getRecipe, type RecipeId } from "../data/recipes";
import { TECHNIQUES } from "../data/techniques";
import type { CommitFailure } from "./persistence";
import type { SaveWriteBlock } from "./persistence";
import type { HeldPendingRoundReason, PendingRoundSummary } from "./pendingRound";

export interface RoundNoticeCopy {
  title: string;
  /** One line per fact; empty strings never appear. */
  lines: string[];
}

export function describeSettledRound(summary: PendingRoundSummary): RoundNoticeCopy {
  const title = "中断していたピザを完成させました";
  const lines: string[] = [];
  if (summary.outcome === "REGISTERED") {
    const name = summary.recipeId ? (getRecipe(summary.recipeId as RecipeId)?.nameJa ?? summary.recipeId) : "ピザ";
    lines.push(`${name}を図鑑に登録しました${summary.stars !== null ? `（★${summary.stars}）` : ""}。`);
    if (summary.discovered) lines.push("新しい発見です。");
    if (summary.newBest) lines.push("ベスト更新です。");
    if (summary.earnedPitz > 0) lines.push(`Pitz +${summary.earnedPitz}`);
  } else if (summary.outcome === "ORIGINAL") {
    lines.push("オリジナルのピザとして記録しました。");
  } else if (summary.outcome === "FAILED") {
    lines.push("焼き上がりが料理として成立せず、登録はありませんでした。材料は使用済みです。");
  } else {
    lines.push("どのレシピにも当てはまらず、登録はありませんでした。");
  }
  if (summary.newMaterialIds.length > 0) {
    lines.push(`新しい材料：${summary.newMaterialIds.map((id) => getIngredient(id)?.nameJa ?? id).join("・")}`);
  }
  if (summary.newTechniqueIds.length > 0) {
    lines.push(`新しい技法：${summary.newTechniqueIds.map((id) => TECHNIQUES.find((t) => t.id === id)?.nameJa ?? id).join("・")}`);
  }
  return { title, lines };
}

export function describeHeldRound(reason: HeldPendingRoundReason): RoundNoticeCopy {
  const title = "完了していない調理の記録があります";
  const body: Record<HeldPendingRoundReason, string> = {
    "unknown-version": "新しいバージョンのゲームが書いた記録です。データはそのまま残してあります。最新版で開くと完了します。",
    unresolvable: "この版にはない材料やレシピを使った記録です。データはそのまま残してあります。対応する版で開くと完了します。",
    corrupt: "記録を読み取れませんでした。データは消さずにそのまま残してあります。",
    oversize: "記録が大きすぎて処理できません。データは消さずにそのまま残してあります。",
  };
  return { title, lines: [body[reason], "この記録が残っている間は、仕上げ工程のあるピザは焼けません。"] };
}

const BLOCK_REASON: Record<SaveWriteBlock, string> = {
  "unknown-schema": "保存データが新しいバージョンのものです。",
  "quarantine-failed": "壊れた保存データを退避できていません。",
  "quarantine-too-large": "壊れた保存データが大きすぎて退避できません。",
  "storage-error": "保存先を読み取れません。",
  "load-failed": "起動時に保存データを読み込めませんでした。",
  "stale-save": "別の画面で保存データが更新されました。",
};

const FAILURE_REASON: Record<CommitFailure, string> = {
  quota: "保存領域がいっぱいで書き込めません。",
  unavailable: "保存先に書き込めません（プライベートブラウズなどの設定を確認してください）。",
  dropped: "書き込んだはずのデータが保存先に残りませんでした。",
  mismatch: "保存した内容が保存先で食い違っています。",
  oversize: "ピザの記録が大きすぎて保存できません。",
  occupied: "前回の調理の記録がまだ残っています。先にホームで確認してください。",
};

/** Why the round could not be saved, and what the player may do (the game never goes on without the save holding the round). */
export function describeRoundSaveFailure(
  cause: { kind: "blocked"; block: SaveWriteBlock } | { kind: "failed"; failure: CommitFailure },
  step: "bake" | "post-bake" | "leave",
): RoundNoticeCopy {
  const reason = cause.kind === "blocked" ? BLOCK_REASON[cause.block] : FAILURE_REASON[cause.failure];
  if (step === "leave") {
    return {
      title: "完了を保存できませんでした",
      lines: [reason, "保存データには焼成時点の記録が残っているため、保存できる状態で次に開いたときに完了します。"],
    };
  }
  return {
    title: step === "bake" ? "保存できないため、焼成を確定しません" : "保存できないため、先へ進みません",
    lines: [
      reason,
      cause.kind === "blocked" && (cause.block === "stale-save" || cause.block === "load-failed")
        ? "ページを再読み込みしてください。この画面での内容は保存されません。"
        : "もう一度お試しください。ホームに戻れば、材料は使われていません。",
    ],
  };
}
