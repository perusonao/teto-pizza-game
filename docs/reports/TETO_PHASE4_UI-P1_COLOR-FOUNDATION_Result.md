# TETO Phase 4 UI P1 配色の土台 Result

日付: 2026-11-28  
基準: `main` / `0c755d02`  
正本: Draft PR #927 `docs/design/TETO_PHASE4_UI-REVIEW_INVENTORY-AND-SCOPE_2026-11-28.md` §5.1 M1、§5.4 P1、Owner 決定 Q8(b) / Q9 / Q10 / Q11(a)

## 実装結果

- `--teto-ground-cream`、`--teto-ink-brown` と、注文（橙）・メニュー開発（水色）・お店（緑）・ランチラッシュ（黄）の4アクション色を `:root` に定義した。
- HOME と図鑑・ショップ・在庫・設定の各シートへクリーム地と焦げ茶の文字色を適用した。
- 注文、メニュー開発、ショップ、ランチラッシュの HOME 導線と対応画面へ同じアクション色を展開した。
- 調理工程は `.app-frame` の共通地色変数に乗せるだけに留め、工程レイアウトやピザ描画は変更していない。
- ディナーの `--dinner-night: #2f2a52` / `--dinner-night-soft: #ece8fb` は夜専用の体系外トークンとして値を維持した。
- shop / legacy 専用分岐は追加していない。共通部品を通る地色変更だけが双方へ届く。

## 範囲外の維持

P2 の呼称統一、P3 以降のレイアウト、#885 ゲージ、P7 図鑑の見た目、#417 材料アイコン、#824 完成ピザ描画には触れていない。

## 検証

- 関連 Vitest: 9 files / 73 tests PASS
- 関連 Chromium e2e: `e2e/ui-color-foundation.spec.ts`、390×844、7 tests PASS
- `npm run lint`: PASS（既存 warning のみ）
- `npm run build`: PASS
- 動画メタデータ: Chromium で読み込み、VP8、`readyState=4`、再生エラーなし、390×844、23.04秒を確認。16倍速検証で `ended=true` / `currentTime=duration=23.04` まで完走した。

Windows checkout では `src/logic/prepareDock.test.ts` の LF 固定文字列比較1件が、作業ツリーの CRLF によりローカルだけ失敗した。配色や CSS の内容に対する失敗ではなく、テスト条件は緩めていない。Linux の PR CI をフル Vitest の最終判定とする。

## Before / After（390×844）

全証跡: `docs/reports/screenshots/p1-color-foundation/`

| 画面 | Before | After |
|---|---|---|
| HOME | `before/01-home-390x844.png` | `after/01-home-390x844.png` |
| 図鑑 | `before/02-dex-390x844.png` | `after/02-dex-390x844.png` |
| ショップ | `before/03-shop-390x844.png` | `after/03-shop-390x844.png` |
| 在庫 | `before/04-inventory-390x844.png` | `after/04-inventory-390x844.png` |
| 設定 | `before/05-settings-390x844.png` | `after/05-settings-390x844.png` |
| ランチラッシュ | `before/06-lunch-rush-390x844.png` | `after/06-lunch-rush-390x844.png` |

## Human Verification Videos

| Video | Submission method | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---:|---|
| `video.webm` (WebM / VP8) | Draft PR attachment（リポジトリには commit しない） | 390×844 | 23.04 s | 998,084 B | PASS |

収録内容: HOME → 図鑑 → ショップ → 在庫 → 設定 → ランチラッシュ → メニュー開発。各画面を静止して配色を確認できる。MP4 変換に必要な `ffmpeg` / `ffprobe` が環境にないため、HV ポリシーの許容形式である WebM のまま提出する。

Video Verification: PASS（存在、非0サイズ、WebM / VP8、390×844、23.04秒、Chromium で末尾まで再生完了、エラーなし）。これは Chromium のレビュー素材であり、iPhone Safari 実機 HV の PASS を主張しない。共有 Preview は更新していない。
