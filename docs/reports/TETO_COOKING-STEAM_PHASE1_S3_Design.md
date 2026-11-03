# Cooking Steam Phase 1 — S3 設計・実装計画（UI・描画、docs-only、Issue #726）

状態: **設計と実装計画のみ。S3 のコード実装・PR は Owner 判断を待つ。** 基準 main `158e035`（#734 = S2 merge 済み）。ブランチ `claude/cooking-steam-s3-ui`（#726 に claim 済み・設計段階）。
Owner 方針（2026-11-03）: 蒸す **Production ON は HOLD**（`STEAM_EXPERIENCE_PRODUCTION = false` のまま）／共有 Preview は更新しない／他の PR は変更しない／A（ふたタップ）と B（鍋ゆすり）の両案を比較。

## 0. 結論
1. **S3 は成立する。** Owner 指定の 3 検証点（炙りピルとの共存、`ingredient-glyph` への filter、`steamOverlay` スロット）は、実コードで確認できた（§2）。
2. 実装は **新規ファイル中心 + HOT 3 ファイルへの追加のみ**。`SteamLayer.tsx` / `Steam.css` / `steamPillPlacement.ts`（新規）、`PizzaStage.tsx`（約 +12 行）、`GameScreen.tsx`（約 +22 行）、`App.tsx`（約 +2 行）。炙り・炒めのファイルは変更しない。
3. 見た目は **CSS 優先**（Owner 決定）。置いたピースは内側の `.ingredient-glyph` への `filter` のみ。殻が開く表現は **`SteamLayer.tsx` 内の自前の小さな inline SVG**（新規ファイル）で描き、`IngredientGlyph.tsx`（共有の SVG）は変更しない。
4. **2 スライス・1 PR** を推奨: S3a（HOT に触れない新規ファイルのみ）→ S3b（HOT 配線・E2E・gate）。S3a は未配線でも単体で検証できる。
5. 本番 OFF のまま入れる。Preview/DEV の `?cookSteam=on` でのみ操作可能。HV は Owner の実機（iPhone Safari）で A/B を比較する。

## 1. 範囲
**やる:** 蒸しピル／蒸し済み印、蒸し画面（A・B 両案）、置いたピースの見た目、`App` からの dispatch 配線、Preview/DEV opt-in の読み取り配線、実ビルドのゲートテスト、E2E、HV 素材。
**やらない:** 蒸す Production ON（HOLD）、新食材・新レシピ・技法化（INV-TQ）、`IngredientGlyph.tsx` / `ingredients.ts` / `App.css` の変更、炙り・炒めの変更、採点・保存・識別・ladder、共有 Preview の更新、HANDOFF 更新。

## 2. 検証結果（Owner 指定の 3 点）

### 2.1 炙りピルとの共存 — OK（ただし位置の判断を複製する）
- **同時に出ない:** ピルは「選択中の食材 1 つ」にだけ出る（`searOffer` / `steamOffer` とも `selectedIngredientId` が入力）。対象は炒め=beef、炙り=sausage（**本番 ON**）、蒸し=clam/mussel で互いに素（S1・S2 のテストで固定済み）。1 つの食材に 2 つのピルは出ない。
- **本番の炙りピルと蒸しピルは別 DOM:** 炙りは `.cooking-sear-pill`（`bottom:18px`・中央・120×44）。蒸しは別クラス `.cooking-steam-pill` を同じ帯に置く。炙りの CSS には触れない。
- **位置の教訓:** 炙りは iPhone Safari で「ピルが生地に 30〜58px 重なる」問題を実機 HV で出し、`searPillNeedsCorner`（生地の円と帯の距離を実測し、足りなければ右下の隅へ）で解決した。蒸しは**最初から同じ判定を使う**。独立実装の方針なので `steamPillPlacement.ts` として**純関数を複製**する（`logic/sear` を import しない。S1 の architecture テストが禁止している）。単体テストも複製。
- **その他の同居物:** ステージ内には `{overlay}`（炒め）・`{searOverlay}`（炙り）がある。蒸しは `{steamOverlay}` を末尾に追加（§2.3）。busy 状態（背面を `inert` にする `setPrepBusy`）は 3 者で共有する。

### 2.2 `ingredient-glyph` への filter — OK（ラッパーではなく内側に当てる）
実コードで確認した構造:
- 置いたピース = `IngredientPieceVisual` → `<span class="ingredient-piece-visual__emoji {className}" style=…>` → 内側に `<svg class="ingredient-glyph ingredient-glyph--clam-valve">`。
- **ラッパーに `filter` が 2 重に掛かる:** CSS `drop-shadow(0 2px 2px …)`（`App.css`）と、BAKE/RESULT 中は `PizzaStage` の `toppingPieceStyle` が inline で `brightness/saturate/sepia(焼成の連続曲線) drop-shadow(…)` を設定する。**インラインが勝つ**ので、蒸しの `filter` をラッパーに当てると焼成の見た目が消えるか、焼成が蒸しを消す。
- **内側の `svg` には基底の `filter` が無い**（`.ingredient-glyph` は `display / width / height / vertical-align / overflow` のみ。clam-valve は専用の寸法ルールなし、mussel-shell は 1.3em の寸法ルールのみ。炙りが sausage の glyph にだけ `drop-shadow` を当てている）。
- **設計:** ラッパーには**クラス `ingredient-piece--steamed` と CSS 変数だけ**を付け（S1 の `steamedPieceVisual` が返す）、`Steam.css` で
  `.ingredient-piece--steamed .ingredient-glyph { filter: brightness(var(--steam-bright)) saturate(var(--steam-sat)) drop-shadow(0 -1px 0 rgba(255,255,255,calc(var(--steam-sheen) * 0.45))); }`
  を**内側の glyph**に当てる。フィルタは入れ子（内側→外側）で**乗算的に合成**される: 蒸し（艶・わずかな明るさ）× 焼成（焼き色）。
- **これは S3 の E2E で確認する:** 焼成後にラッパーの inline filter と glyph の computed filter の**両方が非 none**であること、蒸さないピースでは glyph の filter が none（従来どおり）であること。
- 注意: `transform` は使わない（配置・RESULT の拡大縮小が所有）。`transition` は glyph の `filter` に付ける（ラッパーの 0.3s と別）。

### 2.3 `steamOverlay` スロット — OK（`searOverlay` と同じ追加のみ）
- `PizzaStage` は `overlay`（炒め）と `searOverlay`（炙り）を、ステージ `div` の末尾に `{overlay}{searOverlay}` と描く（`PizzaStage.tsx` 約 1813–1814 行）。蒸しは `steamOverlay?: ReactNode` を props に足して `{steamOverlay}` を**その直後**に置く。
- `GameScreen` は `searOverlay={onSearIngredient ? <SearLayer … /> : undefined}` と同形に `steamOverlay={onSteamIngredient ? <SteamLayer … /> : undefined}`。props に `onSteamIngredient?`、`PizzaStage` に `steamedLook={state.steamedLook}` を渡す。
- `App.tsx` は `onSearIngredient={…}` の隣に `onSteamIngredient={(ingredientId, amount) => dispatch({ type: "STEAM_INGREDIENT", ingredientId, amount })}`。
- **フラグ OFF のとき DOM は不変:** `SteamLayer` は `steamOffer` が null なら `null` を返す（炙りと同じ）。本番ビルドの DOM golden は無修正で通る想定。
- 配置クラス: ピースのクラス選択は `preparedLook?.className ?? searLook?.className`。蒸しは `?? steamLook?.className` を末尾に足す（対象が互いに素のため順序は影響しない）。`style` の合成も同様に 1 分岐追加。

## 3. 蒸し画面の設計（A・B 共通の骨格）

### 3.1 ステージ内の構成
炙りと同じ流儀: ピル → タップ（指を離した位置がピル内のときだけ）で蒸し画面（ステージ全体を覆う）→ 確定 → 語を一瞬出す → 閉じて「✓ 蒸し済み」。背面は `inert`（共有 busy）。確定直後は短いガード（`STEAM_GUARD_MS` ≒ 300ms）で背面への誤タップを防ぐ。×（やめる）は何も残さない。ゲージ・数値・残り時間は出さない。

```
┌───────── ステージ（390×~450） ─────────┐
│ ×                                      │
│ 〈いまの様子の語〉 (STEAM_LOOK_LIVE)    │
│        ♨ ♨ ♨   （蒸気: 量で数と濃さ）   │
│     ╭───────────────╮                  │
│     │ ◐ ◐ ◐ ◐ ◐    │ 殻 5 枚（閉→開）  │
│     ╰───────────────╯  ← 鍋            │
│   [A: ふたをする / ふたを開ける]        │
│   [B: ← ゆする → ／ ゆする(タップ代替)／ふたを開ける] │
└────────────────────────────────────────┘
```

### 3.2 描画（CSS 優先・新規ファイルのみ）
- **鍋・ふた・殻・蒸気は `SteamLayer.tsx` 内の自前の小さな inline SVG + CSS**（`Steam.css`）。`IngredientGlyph.tsx` は変更しない。殻は「閉じた殻」と「開いた殻（橙の身が見える）」の 2 状態を同じ viewBox で描き、`data-open` で切替（CSS の `transform`/`opacity` と短い `transition`）。clam と mussel は色味だけ変える（CSS 変数）。
- 殻の開閉は **S1 の `STEAM_SHELL_THRESHOLDS` に厳密に従う**（`steamOpenCount(level)`）。乱数なし。`prefers-reduced-motion` では `transition` / 蒸気のアニメを止め、開いた数だけを静止表示で保つ。
- 蒸気は `<i>` 3 本が立ち上る CSS アニメ。量（level）は `--steam-heat`（0..1）で濃さ・本数を決める。
- iOS 対策（炙り・炒めの教訓）: `touch-action: none`、`-webkit-touch-callout: none`、`user-select: none`、`-webkit-tap-highlight-color: transparent`、`onContextMenu` で preventDefault、ポインタキャプチャ、`pointercancel` / `blur` / `visibilitychange` で `CANCEL`/`INTERRUPT`。

### 3.3 案 A（ふたタップ）
`[ふたをする]` をタップ → `CLOSE`（蒸気が溜まり殻が順に開く）→ `[ふたを開ける]` をタップ → `OPEN`（確定）。時間は `performance.now()`（`eventMoment` 相当を複製）。tick は ~20Hz で `steamLidLevelAt` を再計算して描画。比較用 `?cookSteamMs=3000|4500|6000`（`OPEN` の `fullMs`）。早すぎる開封（600ms 未満）は「もう少し待ってね」で何も残さない。キーボード: ふたボタンは Enter/Space。

### 3.4 案 B（鍋ゆすり）
鍋の上で**左右に往復ドラッグ**（`pointermove` の x と鍋の幅で `MOVE`）。止めると蒸気が弱まる（遅延評価の減衰なので tick で再描画するだけ）。**タップ代替の `[ゆする]` ボタンを常設**（Enter/Space 対応、`TAP`）。`[ふたを開ける]` で確定。800ms 未満は何も残さない。ドラッグ中は画面のスクロール・長押しメニューに化けないこと（H7）。
- 鍋の幅は `getBoundingClientRect().width`（CSS px）。`MOVE` は `pointermove` ごとに 1 回（rAF でまとめない — S1 は 1 MOVE = 最大 1 ストローク）。

### 3.5 `?cookSteamVariant=both` の切替
`both`（既定）のとき、画面の最上部に小さな 2 択（`ふた` / `ゆすり`）を出し、選択中の案を画面に明示する（HV 動画で A/B を判別できる）。`lid` / `shake` 指定時は切替なしでその案のみ。選択は画面内のみ（保存しない）。切替で進行中の状態は破棄（`CANCEL`）。

### 3.6 状態の持ち方
- `useReducer(steamLidReducer)` / `useReducer(steamShakeReducer)` を案ごとに使う（S1 の純粋ロジックをそのまま利用）。確定（`released`）で `onSteam(ingredientId, result.amount)` を**ちょうど 1 回**呼ぶ（炙りと同じ ref + effect）。
- 画面は `(step, pizza, ingredient)` に紐づき、`makingStepToken` / `resetToken` / 食材が変わると remount（何も dispatch せず破棄）。
- 結果の語は `STEAM_LOOK_COPY[look]`、蒸し中は `STEAM_LOOK_LIVE[look]`（描写のみ。評価語なし）。`aria-live="polite"` の `role="status"` で読み上げ。

## 4. Preview / DEV の配線とゲート
- `SteamLayer` は `steamExperienceEnabled()`（本番 `false` / Preview opt-in）と `steamVariantChoice()`、`steamFullMsOverride()` を読む（S1 で用意済み）。Preview/DEV 以外では常に OFF。
- **実ビルドのゲートテスト**（`searPreview.gate.test.ts` と同型）: 本番 `vite build` に `cookSteam` / `cookSteamVariant` / `cookSteamMs` の文字列が**含まれない**こと、Preview ビルド（`VITE_PREVIEW_MODE`）には含まれること。S1 ではまだ配線されていないので、**このテストは S3 で初めて意味を持つ**。
- HV 用の入口: 炙りの `cookSearHv` のような専用入口は **作らない**（Owner 未指示）。Free Cooking → 生地 → TOPPING → clam 選択、で十分。必要なら Owner が判断。

## 5. 実装スライス・ファイル・見積り
| スライス | 内容 | ファイル | HOT |
|---|---|---|---|
| **S3a** | 蒸し画面と部品（未配線でも単体で検証可能） | `src/components/SteamLayer.tsx` / `SteamLayer.test.tsx` / `Steam.css`、`src/logic/steam/steamPillPlacement.ts`（+test）、`src/logic/steam/steamCopy.ts`（必要なら）| なし |
| **S3b** | 配線と合成 | `PizzaStage.tsx`（props 2 + 1 分岐 + スロット 1、約 +12）、`GameScreen.tsx`（props + 約 +22）、`App.tsx`（約 +2）、`PizzaStage.SteamLook.test.tsx`、`src/preview/steamPreview.gate.test.ts`、`e2e/cooking-steam.spec.ts` | **あり（追加のみ）** |
| S3c | HV 素材と Result | `docs/reports/TETO_COOKING-STEAM_PHASE1_S3_Result.md`、`docs/reports/screenshots/cooking-steam-phase1/**`、動画（commit しない・Owner へ直接） | なし |

1 PR・複数 commit を推奨（S3a 単体は到達不能で、レビュー単位として S3b と分ける意味が薄い）。ただし **S3b の HOT 差分は追加のみ・最小**にし、PR 本文で行数を明示する。

## 6. テスト計画
| 区分 | 内容 |
|---|---|
| 単体（S3a） | `steamPillPlacement`（炙りの境界テストを複製: 帯が空く／重なる／非有限・未レイアウト）、`SteamLayer`（fake timers: ピルが対象食材でだけ出る／Lunch Rush・Dinner・フラグ OFF で `null`／蒸し済みは印／A の CLOSE→OPEN と早すぎ／B の MOVE・TAP・OPEN と早すぎ／×・remount で dispatch なし／確定は 1 回だけ dispatch／`both` の切替で CANCEL／reduced-motion／`aria-live`／`inert`・ガード） |
| コンポーネント（S3b） | `PizzaStage.SteamLook`: `steamedLook` を渡すと clam/mussel のピースに `ingredient-piece--steamed` と `--steam-*` が付く／未蒸しは付かない／**ラッパーの inline `filter` を変更しない**／炙り・炒めのクラスと衝突しない |
| architecture（既存を活用） | `steam.architecture.test.ts` の許可リスト（`LATER_SLICES`）に `SteamLayer.tsx` / `Steam.css` / `PizzaStage.tsx` / `GameScreen.tsx` / `App.tsx` は既に入っている。**ただし独立性の検査（`--sear-` / `--prep-` / 炙り・炒めの名前を使わない）の対象 `OWN` は現在 `logic/steam`・`data/steam*`・`preview/steam*` のみ**なので、S3 で `components/SteamLayer.tsx` / `components/Steam.css` / `logic/steam/steamPillPlacement.ts` を `OWN` に加える（S1 の自作テストファイルへの小さな編集。炙り・炒めのテストは触れない） |
| ゲート | 実ビルド 2 回（本番に opt-in 名が無い／Preview にはある） |
| E2E（Chromium 390×844 / 360×800、WebKit は CI） | フラグなし → ピルが出ない／`?cookSteam=on` → clam でピル・sausage でピルは炙り（蒸しは出ない）／A の完了／B のドラッグ完了／B のタップ代替のみ完了／確定後に配置→焼成→RESULT／**焼成後も蒸しの glyph filter と焼成の inline filter が両立**／RESET で消える／Lunch Rush で出ない／タブ数・縦レイアウト不変（`dynamic-cooking-steps`・`viewport-1screen` が無修正）／炙りの本番ピル（sausage）が無影響 |
| 回帰 | 既存の全 Vitest・DOM golden・炙り／炒めの E2E が**無修正**で通る |

## 7. HV（S3 の比較）
基準は計画書 §6（H1〜H11）。S3 で追加の確認:
- **ピル位置**（実機 Safari で生地に重ならないか。炙りの教訓）、**ドラッグ誤爆**（B）、**疲労**（B）、**殻の「出来事」が読めるか**（A・B）、**置いたピースの艶**（蒸した／蒸さないの区別、焼成後の合成）。
- 撮影: 390×844 の動画 1 本（A・B・`both` 切替・焼成まで）と、before/after スクリーンショット（`docs/reports/screenshots/cooking-steam-phase1/`）。**動画は commit せず Owner へ直接**。実機 iPhone Safari は Owner が確認（CI の WebKit は代わりにならない）。共有 Preview への掲載は **Owner 承認後のみ**（現在は他の HV に使われうる）。

## 8. 依存関係・競合
- **ブロッカーなし:** #734（S2）は main に入った。炙り Production ON（#730）も済み。
- **HOT:** `PizzaStage.tsx` / `GameScreen.tsx` / `App.tsx`。open PR で触れているものは古い #581・#478・#468（どれも stale）のみ。着手時に `merge-tree` で再確認。claim は #726 に投稿済み。
- **触れない:** 炙り・炒め、`IngredientGlyph.tsx`、`ingredients.ts`、`App.css`、採点・保存・識別・ladder。
- **CI:** S3b は WebKit 対象（src 変更）。`handPick.ts` の check-then-act 競合（#394 に記録）で 360×800 が間欠失敗しうる。失敗時は記録して失敗ジョブの再実行は 1 回まで、テスト・timeout は変更しない。

## 9. リスク
| # | リスク | 対策 |
|---|---|---|
| R1 | 殻が「開く」表現が弱い（単純な CSS 変形） | 自前 SVG で 2 状態を描き、HV の H4 で判定。足りなければ別 Gate |
| R2 | B の往復ドラッグが iOS でスクロール／メニューに化ける | `touch-action:none`・ポインタキャプチャ・`preventDefault`、タップ代替を常設。HV で H7 |
| R3 | 蒸し済みの見た目が焼成の `filter` と干渉 | 内側 glyph に当てる設計（§2.2）＋ E2E で両立を確認 |
| R4 | 炙りの本番ピルと位置が揃わない／生地に重なる | `steamPillPlacement`（実測）＋実機 HV。炙りの E2E は無修正で通す |
| R5 | 3 つ目の似たレイヤ（保守負債） | Owner 決定どおり許容（一般化しない）。3 つ目が残ると決まった後に別 Gate |
| R6 | 間欠 E2E（#394）で Gate が揺れる | 記録・失敗ジョブの再実行 1 回まで。テスト変更なし |

## 10. Owner 判断が要る点
| ID | 論点 | 助言 |
|---|---|---|
| S3-1 | この設計で S3 の実装に進んでよいか | 進めてよい（Production は HOLD のまま） |
| S3-2 | 殻の描画を `SteamLayer.tsx` 内の自前 inline SVG にする（`IngredientGlyph.tsx` は触らない） | 自前 SVG を推奨 |
| S3-3 | 1 PR（S3a→S3b の複数 commit）か、S3a と S3b を別 PR か | 1 PR を推奨 |
| S3-4 | HV 専用の入口（炙りの `cookSearHv` 相当）を作るか | 作らない（通常の入口で足りる）。必要なら別途 |
| S3-5 | 共有 Preview への掲載時期（実機 HV のため） | Owner 承認後。現在の公開元・他の HV の状況を確認してから |
| S3-6 | `handPick.ts` の競合修正（別対応）との前後関係 | S3 とは独立。先に直るなら CI が安定する |
