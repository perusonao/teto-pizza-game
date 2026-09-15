# Issue #24: HOME/GAME Separation + App Icon/PWA — Result

Status: 実装完了

## Base / Branch / Commit

- Base SHA: `45362e210a3e99ecc949706e9d007bf42e558881`（`origin/main`, fresh main — PR #21 のコードは一切含まない）
- Branch: `claude/teto-pizza-home-game-icon-i8xofr`
- Final HEAD: `596628a898d996d0382e7235ac3681fdae3f19e4`
- PR: 本レポート作成時点では未作成（ユーザーの明示的な依頼があり次第、この branch から作成する）

## 1. Architecture（HOME/GAME分離方式）

`App.tsx` を「router兼ロジックオーナー」として残し、JSXを2つの純粋な画面コンポーネントへ
分割した。

```
src/
  App.tsx                 -- 全reducer/effect/handlerを保持。どの画面を出すかも
                             App-levelのUI state（screen: "HOME" | "GAME"）として持つ。
  screens/
    HomeScreen.tsx         -- HOME。GameState/DexStateから導出した値のみを表示する
                             純粋な表示コンポーネント。
    GameScreen.tsx         -- 旧App.tsxのgameplay部分（ORDER/PREPARE/BAKE/RESULT/
                             DISCOVERED + Lunch Rushオーバーレイ）をそのまま移設。
  components/DexOverlay.tsx, ShopOverlay.tsx
                             -- App.tsx直下（HOME/GAMEどちらの上にも重ねられるモーダル）
                             に引き上げ、isDexOpen/isShopOpen で開閉。
```

- `gameReducer` / `missionRunReducer` / 各種effect（persistProgress・
  persistMissionBest・CLAIM_MISSION_REWARDなど）は**一切変更していない** — Phase 3C系の
  既存ロジックそのまま。
- HOME/GAMEどちらも `state`（`GameState`）と `mission`（`MissionState`）を props 経由で
  受け取るだけの「同じ状態に対する2つのビュー」であり、状態を複製していない。
- 画面遷移（`screen` state）はそれ自体、`isDexOpen`/`isShopOpen` と同じ粒度のApp-level UI
  stateとして扱った。

## 2. HOME構成

`src/screens/HomeScreen.tsx` / CSSは `src/App.css` の `HOME / GAME screens (Issue #24)`
セクション。

- 最上部: タイトル「テトのピザ屋さん」、Pitz残高、レシピ図鑑の発見数/全体数
  （`RECIPES.length` を都度参照。**ハードコードなし**）、Settings（実装なしのため
  `disabled` の decorative button）。
- Hero: 既存公式 `src/assets/characters/teto.webp` を円形ポートレートとして使用。吹き出し
  「今日はどんなピザを作ろう？」。
- Primary CTA:「🍕 ピザを作る」— HOMEで最も目立つボタン（フル幅・54px高・オレンジ
  グラデーション）。
- 2×2 secondary cards: ランチラッシュ / ピザ図鑑 / ショップ / 実績。
  - ランチラッシュ・ピザ図鑑・ショップは実データ/実機能に接続済み。
  - 「実績」は裏付けとなる機能がリポジトリに存在しないため、指示どおり**偽の進捗を作らず**
    `disabled` + 「近日公開」表示に留めた。
- Footer: テトの一言「🐾 いいピザは、いい一日をつくる！」のみ（build/versionの数値表示は
  今回省略 — 画面高に余裕はあったが、誤解を招く数値を出すより省く方を優先した）。

## 3. GAME分離方式

`src/screens/GameScreen.tsx` は旧 `App.tsx` の gameplay JSX をほぼそのまま移設したもの
（ORDER/PREPARE/BAKE/RESULT/DISCOVEREDの意味・遷移は無変更）。差分は以下のみ:

- ヘッダー左側が「🏠 ホーム」ボタンに変更（タイトルの代わり）。
- HOMEへ戻る際、**作りかけのピザ（PREPARE/BAKE）または進行中のLunch Rush
  （`mission.mode === "PLAYING"`）がある場合のみ** `window.confirm` で確認する
  （`isRoundInProgress()` / `handleGoHome()`, `src/App.tsx`）。ORDER/RESULT/DISCOVERED
  はそもそも「失われるもの」が無いため確認なしで戻る。
- 確認してHOMEへ戻る場合は `PLAY_AGAIN`（Free play中）または `EXIT_TO_FREE` +
  `PLAY_AGAIN`（Mission中 — 既存の `exitMissionToFree()` をそのまま再利用）で
  ラウンドを破棄してから遷移する。

## 4. Teto asset使用方法

- HOME Heroは既存公式 `src/assets/characters/teto.webp` をそのまま import（既存の
  `DialogueBox.tsx` / `BakeOverlay.tsx` と同じ import 規約）。**別個体のTetoをAI生成して
  置換していない。**
- ミト/ブルーはHOMEに一切登場しない（指示どおりHOMEの主役はテトのみ）。

## 5. App Icon生成方法

`scripts/generate-icons.cjs`（`node scripts/generate-icons.cjs` で再生成可能、`sharp` を
devDependencyとして追加）。

1. **背景の除去（crop/composite、AI再生成なし）**: `teto.webp` 自体の背景は上から下への
   単純な2色グラデーション（実測 `top≈(235,217,175)` → `bottom≈(208,178,124)`）。この
   既知グラデーションを基準に、画像四辺からの **flood fill**（4近傍）で「背景と連結して
   いる領域」だけを透明化した。単純な色距離しきい値だけだと毛皮の暖色トーンまで誤検出して
   しまったため、境界に連結しているかどうかで判定する方式に変更している（詳細は
   スクリプト内コメント参照）。キャラクター本体のピクセルは一切加工していない。
2. **合成**: 背景を除去したテトを、ブランドカラー（`src/App.css` のヘッダー茶
   `#6b4226` / アクセント赤 `#e4572e` / 深い焦げ茶 `#2a170d`）による暖色ラジアル
   グラデーション（石窯の火のイメージ）へ合成。
   - 標準版: テトが枠のほぼ全体（90%）を占め、32px程度でも顔の判別が可能。
   - maskable版: セーフゾーンを確保するためテトを62%に縮小、背景をフルブリードで
     敷いた版を別途生成。
3. **書き出し**: `public/icons/` へ `icon-16/32/40/58/60/76/120/180/192/512.png` と
   `icon-512-maskable.png` を出力。

## 6. PWA設定

- `public/manifest.webmanifest` を新規追加:
  `name`=「テトのピザ屋さん」, `short_name`=「テトのピザ屋」, `display`=`standalone`,
  `background_color`=`#2a170d`, `theme_color`=`#6b4226`（いずれもHOMEの世界観に合わせた
  色）, `start_url`/`scope`=`/teto-pizza-game/`（既存の Vite `base` 設定と一致）,
  icons に 192/512（`purpose: "any"`）と 512 maskable を登録。
- `index.html`: favicon（32/16px PNG）、`apple-touch-icon`（180px）、`link rel="manifest"`、
  `meta theme-color`、`apple-mobile-web-app-*` を追加。既定のVite/Reactプレースホルダー
  favicon（`public/favicon.svg`、無関係な紫のロゴ）は削除した。

## 7. Existing Data（ハードコードなし）

- Pitz残高: `state.pitzBalance`（`GameState`、`persistProgress`で永続化済みの値）をHOME・
  GAME双方の同じ箇所から参照。
- Dex発見数/全体数: `state.dex.filter(e => e.discovered).length` / `RECIPES.length`
  （`DexOverlay.tsx` と全く同じ導出方法）。
- localStorage / `PersistentSaveV1`（`schemaVersion: 1`）は**無変更**。

## 8. Tests

`src/App.test.tsx`（新規, jsdom + `@testing-library/react` + `@testing-library/user-event`）:

- 初期表示がHOME（GAMEではない）
- HOME → FREE play（CTAタップでGAME/ORDER phaseへ）
- HOME → Lunch Rush（GAMEへ遷移しMission Introオーバーレイが開く）
- HOME → Dex（HOMEの上にオーバーレイ、HOME自体は残る）
- HOME → Shop（同上）
- 「実績」がdisabled表示であること（偽の進捗を出していないこと）
- GAME → HOME（何も進行中でない場合は確認なしで戻る）
- GAME途中（PREPARE）でHOMEへ戻る際の確認ダイアログ（キャンセル時はGAMEに留まり、
  確認時はHOMEへ戻ってラウンドが破棄されること）
- 永続化された `pitzBalance`/`dex` がHOMEにそのまま反映されること（**ハードコードで
  ないことの直接的な検証**）
- reload相当（unmount→再mount）後もHOMEが最初に表示され、永続値が保たれること

既存の `src/**/*.test.ts`（Phase 3B〜3C-6, 254件）は**無変更・全green**。

テスト実行には `jsdom` / `@testing-library/react` / `@testing-library/jest-dom` /
`@testing-library/user-event` を新規devDependencyとして追加し、`vitest.config.ts` の
`environment` を `node` → `jsdom` に変更（全既存テストは元々DOMの有無に依存していないため
影響なし）。

## 9. Lint / Typecheck / Build

すべてgreen（ルートで実行、コマンドはリポジトリの `package.json` スクリプトそのまま）。

```
$ npx tsc -b            # exit 0, 出力なし
$ npm run lint           # oxlint, exit 0, 出力なし
$ npm test                # vitest run -> Test Files 14 passed (14) / Tests 264 passed (264)
$ npm run build           # tsc -b && vite build -> exit 0
$ git diff --cached --check   # 出力なし（whitespace error なし）
```

## 10. 390×844 Browser Verification

Playwrightで実機同等の検証を実施（`vite preview` + Chromium, viewport 390×844）。

- **HOME**
  - 初回表示: `.home-screen` が表示され `.game-screen` は存在しない
  - CTA（「🍕 ピザを作る」）・2×2メニューとも初期viewport内（CTA bottom ≈ y=364、
    メニュー bottom ≈ y=570、いずれも viewport高 844 以内）
  - テト・Pitz・Dex件数（0/7）とも表示
  - 横スクロール（`scrollWidth - clientWidth`）: 全画面で **0px**
- **GAME**
  - HOME → FREE / GAME → HOME（ホームボタン）/ Mission Intro（Lunch Rush）/ Dex / Shop
    いずれも正常に遷移・オーバーレイ表示
  - GAME途中（PREPARE）でホームボタン押下 → `window.confirm` が呼ばれ、
    キャンセル時はGAME継続、確認時はHOMEへ遷移してラウンド破棄
- **Reload**: リロード相当（unmount→remount）後もHOMEが最初に表示され、永続値
  （Pitz/Dex）は保たれる
- **Console / page errors**: 全シナリオ通して **0件**

スクリーンショット（本レポートには同梱せず、セッション内の一時ディレクトリに保存）:
HOME初期表示 / HOME 2×2メニュー / GAME（ORDER phase）/ Lunch Rush Intro / Dex（HOME上）/
Shop（HOME上）。

## 11. Regression Guard

以下は**すべて無変更**（コード上も、reducerロジック上も）:

- legacy scoring semantics（`src/logic/scoring.ts`）
- Dex BEST semantics（`src/state/dex.ts`）
- stars / totalStars（`src/logic/mastery.ts`）
- Mission scoring（`src/logic/missionScoring.ts`, `src/mission/lunchRush.ts`）
- Pitz economy（`src/logic/economy.ts`）
- Shop purchase semantics（`gameReducer.ts` の `PURCHASE_INGREDIENT`）
- save schema（`PersistentSaveV1`, `schemaVersion: 1`）

PR #21（Phase 4A-1A / timestamp・Reference Sauce関連）のコードはこのbranchに**一切
含めていない**（`origin/main` からの fresh branch であることは base SHA が
`origin/main` の HEAD と一致していることで確認済み）。

## 12. P0 / P1 / P2

- **P0**: なし。
- **P1**: なし。
- **P2 / 既知の妥協点**:
  - GAME→HOMEの確認ダイアログはブラウザネイティブの `window.confirm` を使用している
    （他のオーバーレイ群のような自前デザインのモーダルではない）。デザインモックにも
    確認ダイアログの指定は無かったため、実装コストと確実なテスト容易性を優先した簡易実装。
  - HOME Heroのテト画像は円形クロップ表示のみで、テト画像自体の背景（薄いクリーム色の
    グラデーション）は除去していない（App Iconの方は背景除去込みで合成している）。
    円の縁は4pxのクリーム色ボーダーで馴染むようにしており、実機確認上も違和感のある
    見た目にはなっていない。
  - Settingsボタンは実装が存在しないためdisabledの装飾のみ（issue側も実績同様
    「安全な扱いでよい」対象として言及されている範囲）。
  - Footerのbuild/version表示は省略（数値の出典が無いものを表示するより省く方を優先）。

## 13. Known Limitations

- 実績（Achievements）機能そのものは本Issueのスコープ外のため未実装（disabled表示のみ）。
- Settings機能そのものも同様に未実装（decorative disabledボタンのみ）。
- Playwright/`sharp`は検証・アイコン生成用に本セッションでdevDependency
  （`sharp` はcommit済み / Playwrightは検証専用のため `--no-save` でインストールし
  コミットには含めていない）として使用した。

## 14. Issue #24 Readiness

HOME/GAME分離・App Icon・PWA設定・テスト・lint/typecheck/build・390×844実機検証まで
Issue #24記載の要件をすべて満たしている。**mainへのmergeは行っていない**（指示どおり）。
PRはユーザーの明示的な依頼を受けてから作成する。
