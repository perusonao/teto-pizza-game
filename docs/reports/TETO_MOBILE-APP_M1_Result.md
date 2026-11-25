# Mobile App M1 Result — 起動 PoC の土台 + 保存層アダプタ（Issue #571）

日付: 2026-11-24 / 状態: **Draft PR・merge しない・Owner 承認待ち**。基準 main `68c057b`。ブランチ `claude/m1-app-prompt-handoff-658ts5`。
M2 以降（セーブ移行・エクスポート／インポート、戻るボタン・safe-area・アイコン、ランキング再送、広告・課金、ストア申請）には手を付けていない。

## 1. 着手前の確認
- #568 は 2026-10-19 にマージ済み。保存層・`vite.config.ts`・`package.json` に触れる open PR は確認できた範囲でなし（変更ファイルを取得して確認したのは #878 と #738 のみ。他の open PR のファイル一覧は未確認）。#738 は `main.tsx` に +3 行あり、小さな競合の可能性。
- 依存追加は #571 の Owner 承認（2026-11-24）を根拠に実施。
- 保存の入口は `getDefaultStorage()`（persistence.ts）の 1 か所。App.tsx の呼び出しもすべてこれ経由で、分散はしていない。

## 2. 変更
| コミット | 内容 |
|---|---|
| Capacitor 導入 | `@capacitor/core` 8.6.2 / `preferences` 8.0.1 / `ios` 8.6.2 / `android` 8.6.2、`@capacitor/cli` 8.6.2（dev）。`vite build --mode app`（`base: './'`、出力 `dist-app`）、`build:app`、`capacitor.config.ts`、Android / iOS 雛形。**暫定 ID: `com.example.tetopizza.poc` / `Teto Pizza PoC`**（最終値は M3 までの Owner 判断）。ブラウザ版のビルド出力は導入前と byte 同一（`diff -r` で確認）。 |
| 保存層アダプタ | `src/state/nativeStorage.ts`（アダプタ）、`nativeStorageBoot.ts`（Preferences 接続・hydrate）、`nativeStorage.test.ts`（37 件）、`persistence.ts`（`setDefaultStorageOverride` と `getDefaultStorage` の分岐）、`main.tsx`（`import.meta.env.MODE === 'app'` のときだけ描画前に hydrate）。ブラウザ版の bundle にはネイティブ保存のコードが入らない（確認済み）。 |

仕組み: `persistence.ts` は全体が同期 API のため、起動時に非同期で全キーをメモリへ hydrate し、読み出しはメモリ、書き込みはメモリ反映 + 厳密 FIFO の 1 件ずつのネイティブ書き込み（書き込み後に読み戻して検証）。失敗状態では `setItem` / `removeItem` が例外を投げ、`persistence.ts` が保存失敗として扱う。hydrate 失敗時は読み取り不能な保存先を入れ、既存の `load-failed` 経路で全書き込みをブロックする（空セーブで上書きしない）。

## 3. 既知の制約（Owner 承認済み・2026-11-24）
**`setItem` が正常に戻っても「ネイティブに確定済み」とは限らない。** 戻り値は「受け付けて待ち行列に入れた」を意味し、確定は `flush()`。書き込み失敗は呼び出しの後に判明する（`getWriteError()` / `subscribe` / 次の書き込みでの例外）。同期の保存 API を保つ限り避けられない。

- 失われうるのは **最後の（未確定の）書き込みのみ**。確定済みの直前のセーブは壊れない（1 キーずつ丸ごと書き込み、読み戻しで検証）。
- `commitProgress` の読み戻し検証（`dropped` / `mismatch`）はメモリのコピーに対する検証になり、ネイティブ確定は保証しない。
- `reload()` 直前に `flush()` を待つ処理は未実装（リセットは安全側＝保存が残る側に倒れる）。M2。
- **Owner 条件**: PoC **(c)（保存直後の強制終了 → 再起動でセーブが残るか）は M2 完了までの必須確認**。最後の書き込みが消える結果なら、その時点で保存方式を再検討する。

## 4. M1 Gate の確認結果
| 項目 | 結果 |
|---|---|
| hydrate 完了前に描画・保存・リセットが走らない／失敗時に空セーブで上書きしない | テストで確認（失敗時は全書き込みブロック、保存データ無変更、3 回再試行） |
| 連続書き込みの順序 | テストで確認（遅延を逆転させても同時実行 1 件・投入順・最後が勝つ） |
| 書き込み失敗が成功扱いにならない | 確認（§3 の制約つき） |
| 強制終了・再起動でもセーブが残る | **テスト（fake backend）のみ。実機・エミュレータは未確認** |
| #567 / #568 の保護契約が同等 | 確認。同一シナリオをブラウザ用保存先とアダプタで実行し最終保存内容が一致（未知スキーマ拒否、破損セーブ退避、追加フィールド保持、リセット）。既存 persistence テストは無修正 |
| ブラウザ版の既存テスト・e2e・WebKit CI | フル Vitest **682 files passed / 3 skipped、12,762 tests passed / 20 skipped / 2 todo、失敗 0**。Chromium e2e は保存関連 24 件（390×844・360×800）通過。**e2e 全体と WebKit は CI で確認** |

実行: `tsc -b` エラーなし／`oxlint` 新規警告なし／`npm run build`・`npm run build:app` 成功。

## 5. PoC (a)〜(d)
**すべて実機・エミュレータ未確認**（この環境に Android SDK / Xcode なし。ネイティブビルドも未実施で、`cap add` と `cap sync` が通っただけ）。
ブラウザ（Chromium）でアプリビルドを開き、HOME が表示されること、Preferences（Web 実装）から保存済み（500 Pitz）が hydrate されること、通信先が localhost のみであることを確認。UI 操作で 1 品作る書き込みは未確認（書き込み経路はテストのみ）。

手動手順: (a) 機内モードで初回起動し HOME が出る → (b) 1 品作る → (c) 保存直後に強制終了して再起動し、セーブが残る → (d) 上書きインストール後もセーブが残る。

## 6. M2 への持ち越し
- ブラウザ版 → アプリ版のセーブ移行（別オリジンのため自動では引き継がれない）。エクスポート／インポートの実装が前提。
- `reload()` 前の `flush()` 待ち、書き込み失敗を HOME 通知へ出す配線（`subscribe` の口は用意済み）。
- PoC (c) の実機確認（必須）。
- 判断待ち（決めていない）: 配信名・Bundle ID・配信国・広告除去の価格・Pitz パックの可否。

## 7. HV
UI / UX / ゲームプレイの変更なし（HV Policy の対象外）。動画・スクリーンショットなし。
