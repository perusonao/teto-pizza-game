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
  if (summary.unfinishedFinish) {
    lines.push("仕上げの工程が終わる前に中断したため、仕上げなしの状態で登録しました（未完成のピザです）。");
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
    "unknown-version": "新しいバージョンのゲームが書いた記録です。データはそのまま残してあります。",
    unresolvable: "この版にはない材料やレシピを使った記録です。データはそのまま残してあります。",
    corrupt: "記録を読み取れませんでした。データは消さずにそのまま残してあります。",
    oversize: "記録が大きすぎて処理できません。データは消さずにそのまま残してあります。",
  };
  const recovery: Record<HeldPendingRoundReason, string> = {
    "unknown-version": "復旧: このデータを書いた新しい版（ブックマークや更新後のURL）でゲームを開くと、自動で完了します。完了させない場合は、下のボタンで破棄できます。",
    unresolvable: "復旧: 対応する版（この記録を作ったときと同じ版）でゲームを開くと、自動で完了します。完了させない場合は、下のボタンで破棄できます。",
    corrupt: "復旧: 自動では直せません。ほかの遊びには影響しません。下のボタンで、ゲームデータ全体の控えを保存したうえでこの記録だけを破棄できます（設定のリセットは進行がすべて消えます）。",
    oversize: "復旧: 自動では直せません。ほかの遊びには影響しません。下のボタンで、ゲームデータ全体の控えを保存したうえでこの記録だけを破棄できます（設定のリセットは進行がすべて消えます）。",
  };
  return {
    title,
    lines: [body[reason], recovery[reason], "この記録が残っている間は、仕上げ工程のあるピザ（CUTなど）は焼けません。それ以外のピザは今までどおり遊べます。"],
  };
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
  occupied: "前回の調理の記録が保存に残っています。ホームに通知があれば確認してください。",
};

/** Why the round could not be saved, and what the player may do (the game never goes on without the save holding the round). */
export function describeRoundSaveFailure(
  cause: { kind: "blocked"; block: SaveWriteBlock } | { kind: "failed"; failure: CommitFailure },
  step: "bake" | "post-bake" | "leave",
  held = false,
): RoundNoticeCopy {
  // A kept journal that this build cannot act on is not something HOME can confirm: say what is true.
  const reason =
    cause.kind === "failed" && cause.failure === "occupied" && held
      ? "この版では完了できない調理の記録が保存に残っています（ホームの通知を参照）。仕上げ工程のあるピザは、対応する版で開くまで焼けません。"
      : cause.kind === "blocked"
        ? BLOCK_REASON[cause.block]
        : FAILURE_REASON[cause.failure];
  if (step === "leave") {
    return {
      title: "完了を保存できませんでした",
      lines: [reason, "保存データには焼成時点の記録が残っています。保存できる状態でもう一度お試しください（ページを再読み込みしても完了します）。"],
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

/** P1-1 (Issue #664): the confirmation for getting rid of a kept journal. Shown on HOME only. */
export interface HeldDiscardDialogCopy {
  title: string;
  /** What is about to happen and what is lost. */
  lines: string[];
  /** Extra warning for a journal a matching build could still complete (`unknown-version` / `unresolvable`). */
  strongWarning: string[] | null;
  /** Each must be ticked before the button works. */
  checks: { id: "irreversible" | "completable" | "replace-latest"; label: string }[];
  confirmLabel: string;
}

export function describeHeldDiscardDialog(reason: HeldPendingRoundReason, replacesLatest: boolean): HeldDiscardDialogCopy {
  const completable = reason === "unknown-version" || reason === "unresolvable";
  const checks: HeldDiscardDialogCopy["checks"] = [
    { id: "irreversible", label: "このピザは図鑑に登録されず、使った材料も戻らないことを理解しました" },
  ];
  if (completable) {
    checks.push({ id: "completable", label: "対応する版で開けば完了できた可能性があることを理解しました" });
  }
  if (replacesLatest) {
    checks.push({ id: "replace-latest", label: "以前の退避（最新の1件）が今回の退避で置き換わることを理解しました" });
  }
  return {
    title: "この調理の記録を破棄しますか？",
    lines: [
      "ゲームデータ全体の控えを端末に保存し、その控えを確認できてから、この調理の記録だけを取り除きます。",
      "図鑑・Pitz・所持材料などのほかのデータは変わりません。",
      "控えが保存できなかったときは、何も破棄しません。",
      "この画面から控えを元に戻すことはできません。",
    ],
    strongWarning: completable
      ? [
          reason === "unknown-version"
            ? "この記録は新しいバージョンのゲームが書いたものです。そのバージョンで開けば、自動で完了します。"
            : "この記録は、この版にはない材料やレシピを使っています。対応する版で開けば、自動で完了します。",
          "破棄すると、そのピザの登録（発見・ベスト・Pitz）は行われません。",
        ]
      : null,
    checks,
    confirmLabel: "控えを保存して破棄する",
  };
}

const DISCARD_FAILURE: Record<string, string> = {
  "no-storage": "保存先に書き込めません。何も破棄していません。",
  "storage-error": "保存先を読み取れません。何も破棄していません。",
  "load-failed": "起動時に保存データを読み込めなかったため、破棄できません。ページを再読み込みしてください。",
  "stale-save": "別の画面で保存データが更新されました。何も破棄していません。ページを再読み込みしてください。",
  "stale-during-discard": "操作中に保存データが更新されました。記録は破棄していません。ページを再読み込みしてください。",
  "not-readable": "保存データを読み取れないため、破棄できません。何も破棄していません。",
  "not-held": "破棄の対象になる記録がありません。何も破棄していません。",
  "too-large": "保存データが大きすぎて控えを作れません。何も破棄していません。",
  changed: "記録の内容が変わりました。何も破棄していません。もう一度、内容を確認してください。",
  "replace-not-confirmed": "以前の退避を置き換える確認がありません。何も破棄していません。",
  "backup-failed": "控えを保存できませんでした（保存領域がいっぱいの可能性があります）。何も破棄していません。",
  "write-failed": "記録を取り除けませんでした。ゲームデータは変わっていません。控えは残してあります。",
  "verify-failed": "取り除いた結果を確認できませんでした。ページを再読み込みして、状態を確かめてください。控えは残してあります。",
};

export function describeHeldDiscardFailure(reason: string): RoundNoticeCopy {
  return { title: "記録を破棄できませんでした", lines: [DISCARD_FAILURE[reason] ?? "記録を破棄できませんでした。何も破棄していません。"] };
}

export function describeHeldDiscardDone(): RoundNoticeCopy {
  return {
    title: "調理の記録を破棄しました",
    lines: ["ゲームデータ全体の控えは端末に保存してあります。ほかのデータは変わっていません。", "仕上げ工程のあるピザも、ふつうに焼けるようになります。"],
  };
}
