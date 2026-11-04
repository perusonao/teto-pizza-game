# Save: Dex raw エントリ保持（R4/R5）— Result（Issue #668）

Status: 実装完了・PR 作成済み・**merge は Owner 判断待ち**。Owner 設計判断コメント（Issue #668）の採用方針と受け入れ条件に従う。
変更範囲: `src/state/persistence.ts`（Dex 組み立てと保存全体サイズ検証）、通知の最小配線（下記）、`persistence*.test.ts`。
`loadSave`・`DexEntry`・reducer・UI・`schemaVersion`・保存キーは変更していない。

## 実装
- `extractForwardCompatExtras` が保存済み Dex を **id ごとの生エントリ**（`valid` / `foreign`）として保持する。1 id につき「この版が読む最初の有効エントリ、無ければ最初の生エントリ」。`SAVE_ID_PATTERN` に合わない id・オブジェクトでない要素は従来どおり運ばない。
- `mergeDexForWrite`（`writeSave` の Dex 組み立てのみ）:
  1. `next` に含まれ保存側が有効 → `{ ...未知キー, ...next }`。
  2. `next` に含まれ保存側が foreign → 保存側の生エントリを**そのまま**維持（旧ビルドの結果は反映しない）。
  3. `next` に含まれない生エントリ → 末尾に保存順で追加（既知・未知、有効・不正とも）。
- 未知キーの上限（超過分は**未知キーだけ**捨てる。コア5項目・`next`・foreign は捨てない）: 16 キー / 512 文字 / エントリ、32Ki 文字 / Dex、未知キーを保持するのは先頭 256 エントリ。エントリ内は保存順の先頭から入るものまで。`__proto__` キーは複製しない。
- 捨てたときは無言にしない: `persistDex` / `persistProgress` の結果に `dexUnknownKeysDropped: true`、`commitProgress` は `{ status: "ok", dexUnknownKeysDropped: true }`。
- 保存全体サイズ: `MAX_SAVE_WRITE_LENGTH` = `MAX_QUARANTINE_RAW_LENGTH`（256Ki）− 64Ki = **192Ki 文字**。導出: 全 67 レシピの Dex ≈ 6.5K + 未知キー上限 32Ki + `pendingRound` 上限 64Ki ≈ 100Ki。書き込み直前に直列化後の長さを検証し、超過ならまず Dex の未知キーを全て外して再計算（結果で報告）、それでも超過し、かつ foreign の生エントリを保持している場合は**書き込みを拒否**（`blocked: "save-too-large"`、保存は不変）。
- 通知: `SaveWriteBlock` に `save-too-large` を追加し、既存の様式に合わせて `saveHealth`（notice kind）・`saveNoticeCopy`・`roundNoticeCopy`（`BLOCK_REASON`）へ最小限の文言を追加。通常は到達しない経路の文言のみで、画面レイアウトは変更していない。

## テスト
- `persistence.dexRaw.test.ts`（新規 23 件）: A〜F、衝突規則、順序、BEST 非減少（C は BEST=120 / ★6 / timesMade 9 を旧ビルドの BEST=80 が置換しない回帰）、各上限の境界（ちょうど / 1 超過: 16 キー、512 文字、32Ki、256 件、全体 192Ki）、サイズ起因の未知キー切り捨て、冪等、`persistDex` の変化なしスキップ、`loadSave` 非流入、`resetSave` 後に復活しない、往復（新ビルド相当 fixture → 修正版で書き込み → 旧ビルド相当の読み込み → 再び修正版で書き込み）。
- 反転: `persistence.compat.risks.test.ts` の R4/R5 `it.todo`（2 件）と `CURRENT BEHAVIOUR`（R4・R5）。
- 期待値が変わった既存テスト（意図した変化）: `compat.risks` R2 の Dex 行（古いタブの書き込みでも他タブの Dex エントリは消えない。Pitz の last-writer-wins は不変）、`forwardCompat` の「不正な形の未知 Dex」（well-formed な id で検証に通らないエントリは foreign として保持。id 不正・非オブジェクトは従来どおり破棄）。

## 既知の制限（rollback）
修正を含まないビルド（`a540983` 以前）へ rollback すると、そのビルドの次の書き込みで未知サブフィールド・範囲外の既知エントリ・不正な未知エントリは消える。保護が効くのは本修正を含むビルドの間だけ。余分なキーは旧ビルドの読み込みを壊さない。foreign エントリへの旧ビルドの調理結果は保存に反映されない（方針 3）。

## Human Verification
UI/ゲームプレイ変更なし（`TETO_HUMAN-VERIFICATION-POLICY.md` の「原則不要」: 見た目/操作が変化しない変更）。動画・スクリーンショットは不要。
