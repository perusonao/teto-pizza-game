# Result Report — タイトル／キャラクター表記を「てっちゃん」へ変更（Owner 決定 2026-11-26）

Status: Draft PR（マージ・Draft 解除は Owner 承認待ち）

## 1. 変更内容（表示のみの置換）

| 箇所 | Before | After |
|---|---|---|
| `index.html` `<title>` | テトのピザ屋さん | てっちゃんのピザ屋さん |
| `index.html` meta description / apple-mobile-web-app-title | テト… / テトのピザ屋 | てっちゃん… / てっちゃんのピザ屋 |
| `public/manifest.webmanifest` name / short_name / description | テト… | てっちゃん… |
| `HomeScreen.tsx` ヘッダー `<h1>` / ヒーロー画像 alt | テトのピザ屋さん / テト | てっちゃんのピザ屋さん / てっちゃん |
| `BakeOverlay.tsx` アバター alt | テト | てっちゃん |
| `DialogueBox.tsx` `SPEAKER_LABEL`（キー `teto` は不変） | テト | てっちゃん |
| `orders.ts` マルゲリータの注文セリフ | …教えてテト！ | …教えて、てっちゃん！（「教えててっちゃん」の読みづらさを避けるため読点のみ追加） |
| `capacitor.config.ts` `appName` と、同名が入る `android/.../strings.xml`（app_name / title_activity_main）・`ios/.../Info.plist`（CFBundleDisplayName） | Teto Pizza PoC | Tecchan Pizza PoC（「PoC」表記は維持） |
| `public/icons/*`（16/32/40/58/60/76/120/180/192/512・512-maskable） | 旧アイコン | 支給画像から再生成 |
| `scripts/generate-icons.cjs` + `scripts/assets/tecchan-app-icon-source.png` | 旧 teto.webp 合成 | 支給マスター（1600×1600）を内側 100px クロップしてリサイズ。maskable は 80% セーフゾーンでクリーム地に配置 |

## 2. 変えていないもの（指示どおり）

セーブキー `teto-pizza-save-v1` と形式 / appId・Bundle ID（`com.example.tetopizza.poc`）/ リポジトリ名・公開 URL・Pages パス / コード識別子・ファイル名 / ゲーム仕様・バランス / docs（過去の記録）/ iOS・Android のネイティブアイコン。

## 3. 要確認（Owner 向け）

1. **ゲーム内キャラ画像は旧「テト」（黒いポメラニアン風の犬）のまま。** `src/assets/characters/teto.webp` は ホーム中央のヒーロー・BAKE のアバター・対話ボックスに使われており、今回は名前だけが「てっちゃん」になり、画像はオランウータンではない。画像差し替えは依頼範囲外のため未着手。
2. iOS `AppIcon-512@2x.png` と Android の mipmap は Capacitor 既定のまま（依頼の変更対象に「アプリ名」のみで、ネイティブアイコンは含まれていなかった）。
3. Capacitor の表示名は `Tecchan Pizza PoC`（PoC 暫定名の構造を維持）。ストア名は M3 の Owner 決定事項。
4. 支給ファイル名は `…-1024.png` だが実寸は 1600×1600。白い角丸の余白を避けるため、全アイコンで内側 100px をクロップ（角 4 点がクリーム地であることを確認）。

## 4. 検証

- 出現箇所の洗い出し: 表示に関わるのは上表のみ（`ポテト` 等の無関係一致を除く）。想定外の広がりなし。
- テスト期待値の更新: タイトル／キャラ名の文字列を直接見るテストは無く、更新不要。
- lint: 警告のみ（既存、本変更と無関係）/ build: PASS
- vitest: 下記「Test results」を参照。

## Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| tecchan-rename-hv-390x844.mp4 | 390×844 | 20.0s | 309 KB | PASS |

Download: セッション内直接提出（リポジトリには含めない）

Video Verification: PASS（H.264 / 390×844 / 再生可能 / ホーム → レシピ選択 → ゲーム画面 → ホーム）

この動画で確認すること:
- ホームのヘッダーが「てっちゃんのピザ屋さん」になっている
- 画面遷移（ホーム → ピザを作る → レシピ選択 → ゲーム → ホーム）が従来どおり動く
- 注意: 動画のヒーロー画像は旧キャラ（犬）のまま（§3-1）

Screenshots: `docs/reports/screenshots/tecchan-rename/`（before/after ホーム、after ゲーム、アイコン 512 / maskable）。
撮影は Preview モード（`VITE_PREVIEW_MODE=1`、`?hv=b18-reina` のシード済みセーブ）の dev サーバー。Before は同一コミットの worktree。
