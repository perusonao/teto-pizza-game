/** Player-facing copy for each save notice (Save Protection PR-2, #560). One entry per distinct situation. */
import type { SaveNotice } from "./saveHealth";

export interface SaveNoticeCopy {
  title: string;
  body: string;
}

export function describeSaveNotice(notice: SaveNotice): SaveNoticeCopy {
  switch (notice.kind) {
    case "future-version":
      return {
        title: "新しいバージョンの保存データがあります",
        body: "この端末のデータは、より新しいバージョンのゲームで保存されたものです。データはそのまま残していますが、このバージョンでは保存されません。いま遊んでいる内容は、再読み込みすると失われる可能性があります。最新版で開いてください。",
      };
    case "corrupt":
      return {
        title: "保存データを読み込めませんでした",
        body: notice.backedUp
          ? "壊れたデータは端末内に退避してあります。これはバックアップで、復元ではありません。以前の進行は復元されておらず、新しいデータで始めています。"
          : "新しいデータで始めています。以前の進行は復元されていません。次に保存するとき、壊れたデータは消さずに、バックアップとして端末内へ退避します（復元ではありません）。",
      };
    case "backup-failed":
      return {
        title: "壊れた保存データを退避できませんでした",
        body:
          notice.reason === "quarantine-too-large"
            ? "データが大きすぎて退避できないため、上書きを止めています。この状態ではプレイ内容は保存されません。"
            : "退避コピーを安全に作れなかったため、上書きを止めています。この状態ではプレイ内容は保存されません。",
      };
    case "storage-unavailable":
      return {
        title: "保存先にアクセスできません",
        body: "ブラウザの保存領域を読み取れないため、プレイ内容は保存されません。プライベートブラウズや保存の設定を確認してください。",
      };
    case "load-failed":
      return {
        title: "保存データを読み込めませんでした（一時的な失敗）",
        body: "起動時に保存データを読み込めなかったため、いま表示している内容はあなたの保存データではありません。保存データには手を加えていません。上書きを防ぐため、この画面での内容は保存されません。ページを再読み込みすると、保存データを読み込み直せます。",
      };
    case "stale-save":
      return {
        title: "別の画面で保存データが更新されました",
        body: "別のタブなどで保存データが更新されたため、この画面は古い内容になっています。更新された保存データを上書きしないよう、この画面での内容は保存されません。ページを再読み込みすると、最新の保存データを読み込めます（この画面での未保存の進行は失われます）。",
      };
    case "save-too-large":
      return {
        title: "保存データが大きくなりすぎました",
        body: "この版では読み込めない記録を消さないよう、保存を止めています。保存データには手を加えていません。この状態ではプレイ内容は保存されません。",
      };
    case "backup-kept":
      return {
        title: "以前の保存データを退避してあります",
        body:
          notice.entryKind === "unknown-schema"
            ? "新しいバージョンで保存されたデータを、リセットの前に端末内へ退避しました。"
            : "読み込めなかった保存データを、消さずに端末内へ退避しました。これはバックアップで、復元ではありません。以前の進行は復元されていません。",
      };
  }
}
