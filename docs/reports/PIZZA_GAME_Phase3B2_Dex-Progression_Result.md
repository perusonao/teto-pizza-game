# Phase 3B-2 Dex Progression — Result

## Base / Branch

- Base SHA: `ac3551cc8e422a8e742534f0f345794eb6393066`（origin/main、セッション開始時に
  `git fetch origin main` で確認、指示のconfirmed SHAと一致。これ以上mainは進んでいなかったため
  この時点のmainをそのまま使用）
- Branch: `claude/dex-progression-phase-3b2-bv5bbk`

## 目的 / 方針

既存の`DexOverlay`を「recipe一覧」から「あと何枚でコンプリートか分かる収集UI」へ
最小変更で強化した。新しい図鑑システムの作り直しは行っておらず、変更は
`src/components/DexOverlay.tsx` と `src/App.css` の2ファイルのみ。
`RECIPES`データ（Phase 3B-1で確定した6レシピ）、`gameReducer.ts`、`App.tsx`、
Recipe schemaは無変更。

## 1. Progress表示

`DexOverlay`内で`RECIPES.length`から総数を取得（ハードコード6は使用していない）。
Header直下に progress blockを追加:

- 未コンプリート: `🍕 発見 X / 6` + 補助文 `あと(6-X)種類！`
- コンプリート: `🏆 6 / 6` + 補助文 `コンプリート！`

`discoveredCount`は`discoveredRecipeIds.length`、`total`は`RECIPES.length`から算出し、
`isComplete = discoveredCount >= total`で状態を切り替えている。

## 2. Discovered card

既存カード構造をそのまま維持: recipe名（`nameJa`）・ingredients・`description`・NEW badge。
新しいRecipe schema追加はしていない（全6レシピに既存`description`フィールドがあるため、
「description不在時は既存表示維持」のフォールバックは今回発生しなかった）。

## 3. NEW

既存の`justDiscovered` / `newlyDiscoveredId` semanticsは無変更。`isNew`の判定ロジック
（`discovered && recipe.id === newlyDiscoveredId`）もそのまま。既存の
`.dex-card--new`のglow animation（`dex-new-glow` keyframes）をそのまま流用し、
新しいanimation systemは追加していない。localStorage等の永続NEW管理も追加していない。

## 4. Undiscovered

大きなlocked cardを、よりコンパクトな横並びlock rowに変更:

```
🔒  ？？？
    まだ見ぬピザ
```

recipe名は表示しない。良いhintを安全に作れる既存データが「materialの個数」程度しかなく、
個数だけでは複数レシピが同じ値を取り得て中途半端な情報になる（かつ答えの推測材料になり得る）ため、
指示にある通り無理にcategory hintは追加せず、`🔒 ？？？` / `まだ見ぬピザ`という
最小限のプレースホルダーに留めた。新しいcategory schemaの追加はしていない。

## 5. 6/6 completion

新しい画面・modal・新animationは作らず、既存Dex内のprogress blockが
`🏆 6 / 6` + `コンプリート！`に切り替わることで達成感を表現。カード一覧は通常通り
6件とも表示され、既存の閉じる/PLAY AGAIN導線もそのまま。

## 6. CTA

`DexOverlay`最下部に既存`onClose`を再利用するfooter CTAを追加（`cta-button--primary`を再利用）。

- 未コンプリート: `次のピザを作る`
- 6/6: `もう一枚作る`

いずれも`onClick={onClose}`のみで、新しいgame state / navigationは追加していない
（クリックするとDexが閉じるだけで、既存の`isDexOpen`トグル以外の副作用はない）。
header側の既存`閉じる`ボタンも無変更のまま残している。

## 7. 390×844

`.dex-overlay__panel`は既存の`width:100%` / `max-height:80%` / `overflow-y:auto`のままで、
追加したprogress blockとfooterはその内側に収まる。Playwright（390×844）実測で
horizontal overflowなし（`scrollWidth === clientWidth`）を確認。ロック行はコンパクトな
1行レイアウト（icon + `？？？` + hint）にしたため、6件locked状態でも画面を占有しすぎない。

## 8. Browser verification（390×844, Playwright + Chromium）

Vite dev server起動後、Playwright（`chromium.launch({ executablePath:
"/opt/pw-browsers/chromium" })`, viewport 390×844）で実プレイを自動操作し確認。
`REGISTER_TO_DEX`は現在の注文recipeをdexに追加するだけで、実際のトッピング内容に
依存しない既存仕様のため、各注文は「PREPARE→即BAKE→即取り出す→登録」で6周実測した。

### A. 1/6（Margherita発見直後、DISCOVEREDフェーズ中にDexを開いた状態）

- 発見数表示: `🍕 発見 1 / 6`、補助文 `あと5種類！`
- NEW: `マルゲリータ`カードに`NEW`バッジ表示を実測（`.dex-card--new h3`のtextContentに`NEW`含む）
- 残り5件: `.dex-card--locked`が5件（`🔒 ？？？` / `まだ見ぬピザ`）
- footer CTA文言: `次のピザを作る`
- スクリーンショット: `A_1of6.png`（送付済み）

### B. 中間状態（3/6）

- 発見数表示: `🍕 発見 3 / 6`、補助文 `あと3種類！`
- discovered 3件（Margherita / Quattro Formaggi / Bismarck※undiscovered-priority順）・
  locked 3件が混在し、layout破綻なし
- スクリーンショット: `B_mid_3of6.png`（送付済み）

### C. 6/6

- 発見数表示: `🏆 6 / 6`、補助文 `コンプリート！`
- `.dex-card--locked`件数: 0
- 全6レシピ（Margherita / Marinara / Quattro Formaggi / Genovese / Bismarck / Funghi）が
  discovered cardとして表示
- footer CTA文言: `もう一枚作る`（クリックでDexが閉じることを確認）
- horizontal overflow: なし（`scrollWidth`(390) === `clientWidth`(390)）
- スクリーンショット: `C_6of6.png`（送付済み）

### D. Regression

- Dex close（footer CTA経由の`onClose`）: 閉じることを確認、`isDexOpen`以外の副作用なし
  （閉じた直後もDISCOVEREDフェーズの`もう一度作る`ボタンが引き続き表示されている）
- Dex close（既存header `閉じる`ボタン）: 引き続き正常に動作
- PLAY AGAIN（`もう一度作る`）: 6/6到達後も正常に次の注文へ進むことを確認
- NEW semantics: `もう一度作る`で次の注文へ進み`justDiscovered`がリセットされた後にDexを開くと
  `NEW`バッジが0件になることを確認（既存semantics通り、justDiscoveredの間だけ表示）
- order progression: undiscovered-priority selectionは無変更（`orders.ts`未変更）。
  6/6後の7周目も注文選択が正常に継続することを確認
- console error: 全ラウンド通じて **0件**（`console` type `error` / `pageerror`とも0）
- horizontal overflow: 全状態（A/B/C）で確認、なし

## P0 / P1 / P2

- P0: なし
- P1: なし
- P2: なし（undiscoveredのhintは「まだ見ぬピザ」の最小表示に留めた。将来的に安全なcategory hintを
  追加する場合はPhase外でRecipe schema拡張の検討が必要）

## Checks

- `npm run build`（`tsc -b && vite build`）: ✅ pass
- `npm run lint`（oxlint）: ✅ pass, exit code 0
- `git diff --check`: ✅ no whitespace errors
- 新しいtest frameworkの追加: なし（指示通り）

## Changed files

- `src/components/DexOverlay.tsx`
- `src/App.css`
- `docs/reports/PIZZA_GAME_Phase3B2_Dex-Progression_Result.md`（本レポート）

## Scope

今回追加していないもの（指示通り）: 新recipe、新ingredient、`Recipe.category`、
category UI、hidden category system、persistence/localStorage、achievements、
ranking、rewards/economy、character dialogue rotation、Blue evaluation expansion、
audio/haptics、shop management、backend、`gameReducer` / state machine変更。
Phase 3B-1のrecipe dataも無変更。

過去のlocal-only report/design/screenshotsの誤commitはなし（本レポートと
`DexOverlay.tsx` / `App.css`の変更のみをcommit対象とした）。

## Commit / PR

- Commit SHA: `1a282f9`（実装コミット。本レポートのSHA追記のみを行うfollow-upコミットは
  この後に別途追加）
- PR URL: https://github.com/perusonao/teto-pizza-game/pull/12
- PRは**未マージ**のまま残す（auto-mergeは使用していない）。
