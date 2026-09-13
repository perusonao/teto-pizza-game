# PIZZA GAME Phase 3A 実装結果 — Sauce Painting

Status: 実装完了・レビュー待ち

## 0. 前提確認

- 依頼文が参照していた `docs/reports/PIZZA_GAME_Phase3A_Sauce-Painting_Detailed-Design.md`
  はリポジトリ内に存在しなかった（このリモートセッションのファイルシステム上で確認）。
  Phase 2B/2C でも同様のパターンが記録されており、ユーザーのローカル環境にのみ存在する
  ファイルだと判断し、依頼文本文に記載された Detailed Design 方針（SVG描画・pizza-dough
  local %座標・10px threshold・release時中心のdispatch・APPLY_SAUCE shape不変）を
  一次情報としてそのまま採用した。
- Phase 2 Final First-Fun Gate（B判定・4 pizzas完了・First Fun 18.5/25・P0/P1=0）を
  前提に、Phase 3Aへ進行した。

## 1. Base

- リポジトリ: `perusonao/teto-pizza-game`
- 着手前 `origin/main` SHA: `49af70ebde6369e91100f3029202690579f03350`
  （`Phase 2C: Sauce/Topping Feedback + Raw-Perfect Visual Polish (#7)`、
  依頼文記載の Expected starting SHA と一致）
- 作業ブランチ: `claude/phase-3a-sauce-painting-2n9ge1`（`origin/main` から分岐済み）

## 2. スコープ

Phase 3Aの唯一の目的は **Sauce Painting**（ピザを指でなぞってソースを塗る感覚の追加）。
禁止事項（Topping Drag、Placement/Coverage Scoring、経済・永続化要素、新レシピ、
Dex再設計、大規模キャラクター変更、新規依存関係）はいずれも実施していない。

## 3. 実装内容

### 3.1 座標系の一本化（`src/logic/pizzaCoordinates.ts` 新規）

Phase 2Cで発生していた「`.pizza-dough` 本体 vs inset された `.pizza-sauce-layer`」の
座標ズレを再発させないため、以下を1ファイルに集約した。

- `DOUGH_CENTER` / `DOUGH_RADIUS`（`pizza-dough` local %、これまで `pizzaState.ts` に
  重複定義されていた定数を統合し、`pizzaState.ts` はここから import するよう整理）
- `clientPointToDoughPercent()` — pointer/mouse clientX/Y → dough-local % への変換
- `isInsideDough()` / `clampToDough()` — 円内判定と、円外の点を同じ方向を保ったまま
  縁に投影するクランプ（release時の"outside release"対応に使用）
- `toSauceLayerPercent()` — 既存の sauce-layer inset(6%) 補正ロジックを
  `PizzaStage.tsx` から移設

`PizzaStage.tsx` と `pizzaState.ts` の両方がこの1ファイルだけを canonical な座標定義
として参照する構成にした。

### 3.2 ポインタ操作（`src/components/PizzaStage.tsx`）

- `onClick` を `onPointerDown` / `onPointerMove` / `onPointerUp` / `onPointerCancel`
  に置き換え、Pointer Events で mouse/touchを統一。
- ジェスチャ状態（pointerId・開始位置・dough-local開始座標・drag中フラグ・SVGパス
  文字列・最後に円内にあった座標）はすべて `useRef` で保持し、`pointermove` 中は
  Reactの state / dispatch を一切呼ばない。SVGの `<path>` 要素へ `ref.setAttribute("d", …)`
  で直接書き込む「ref + imperative visual update」方式。
- **Tap/drag threshold**: 画面px換算で10px未満なら既存Phase 2Cの一括spreadタップと
  完全に同じ経路（`onTap(startDough.x, startDough.y)`）を通す。挙動・座標算出方法とも
  変更なし。
- **Drag painting**: 10px以上動いたらSVGトレイル（`viewBox="0 0 100 100"`、
  `pizza-dough` と同じ0-100%ローカル座標）に軌跡を描画。`clip-path: circle(48% at 50% 50%)`
  で `pizza-dough` の当たり判定と同じ円にクリップし、クラスト外にはみ出さない。
  `PointerEvent.getCoalescedEvents()` が使える場合はそれも取り込み、高速dragでも
  線が大きく途切れないようにした（未対応環境ではフォールバックして単発イベントのみ使用）。
- **マルチタッチ**: `gestureRef.current.pointerId` が埋まっている間は新規
  `pointerdown` を無視。最初の指のジェスチャのみ有効。
- **setPointerCapture**: `pointerdown` で `try/catch` 付きで取得し、
  `pointerup`/`pointercancel` の双方で `try/catch` 付きで解放。取得に失敗しても
  （一部ブラウザ）通常のバブリングで動作を継続する。
- **outside release**: ドラッグ中に円内にいた最後の座標を `clampToDough()` で縁に
  投影してから `onTap()` を呼ぶ。円の外でpointerupしても「失敗」にはならず、必ず
  ソースが確定する。
- **pointercancel**: トレイルを即座にクリアし、`APPLY_SAUCE` は一切dispatchしない。
  以降のジェスチャに影響が残らないことを確認済み（9番のテストで検証）。
- **Topping Drag防止**: `activeIngredient.placement !== "spread"`（トッピング選択時）
  はドラッグ距離に関わらず、release時の1点だけを使って既存の `onTap()` を呼ぶ
  ―― 旧 `onClick` の挙動（mouseup位置で1回だけ発火）と完全に一致させ、
  Topping Dragを実装しない。
- **release時の視覚遷移**: sauceを確定させた瞬間にトレイルへ
  `pizza-paint-trail__stroke--fade` クラスを付与し260ms（`opacity`のCSS transition）
  でフェードアウトさせつつ、同時に既存の `sauce-spread` keyframes（380ms、
  `sauceToken` bump で再マウントされ再生される）が走る。トレイルの色は選択中の
  ソース ingredient の `color` を使うため、色が完全に一致した状態でフェードし、
  「描いたものが消えた」ではなく「塗ったソースがピザ全体になじんだ」印象になる
  （スクリーンショットで目視確認済み、4章参照）。

### 3.3 CSS（`src/App.css`）

- `.pizza-dough--interactive` に `touch-action: none` を追加（pizza dough自身にのみ
  スコープし、`body` / `.app-frame` には触れていないため、ページ全体のスクロールは
  従来通り機能する。3.5節で自動検証済み）。
- `.pizza-paint-trail` / `.pizza-paint-trail__stroke` / `--fade` を新規追加。

### 3.4 UX discovery（Mito hint）

3レシピすべての `empty` ヒント（`src/data/hints.ts`）に「ピザを指でなぞると塗れるよ」
「指でくるくるなぞって塗ってみて」等、既存ミトの口調に合わせた一文を追加。大型
チュートリアルは実装していない。

### 3.5 Teto minimal polish

BAKE中の無記名caption（`BakeOverlay.tsx` の `bake-oven__caption`）に、既存の
`teto.webp` を22px丸アイコンとして添えるだけの変更を実施。新規画像・新規dialogue
system・新規stateはいずれも追加していない（`tetoImg` のimportとJSX/CSSの数行のみ）。
Sauce Paintingの実装を遅らせる規模ではないため実施した。Character Phase相当の
大規模変更（新規セリフバリエーション等）はPhase 3B/3Cへdeferする。

## 4. 検証

### 4.1 自動検証（Playwright, Chromium, 390×844）

一時スクリプトで以下17項目をすべて自動実行し、**console error 0** / **PASS 17/17**
を確認した（永続的なE2E基盤は追加していない。スクリプトはリポジトリ外の
scratchpadに置き、commitしていない）。

1. center tap — ソース適用
2. near-rim tap（中心から距離44、半径48以内）— ソース適用
3. short drag（10pxをわずかに超える移動）— トレイル描画→確定
4. long drag — トレイル描画→確定
5. curved drag（縁沿いの半円軌跡）— トレイル描画→確定
6. fast drag（中間点が少ない粗い移動）— 途切れず確定
7. outside release（ドーム内で開始し、四角形バウンディングボックス外でmouseup）
   — `clampToDough()` 経由で確定、失敗にならない
8. pointercancel（合成PointerEventで発火）— トレイル即クリア、dispatchなし、
   以降のジェスチャに悪影響なし
9. repeated sauce interaction — cancel後も再度正常に適用できる
10. scroll outside pizza — `pizza-dough` のみ `touch-action: none`、
    `body`/`.app-frame` は `none` ではないことを `getComputedStyle` で確認。
    水平overflowなし
11. Margherita — sauce paint（複数のtap/drag）→トッピング→BAKEまでフルフロー成功
12. Marinara — フルフロー成功
13. Quattro Formaggi — フルフロー成功
14. raw（BAKE開始直後に確定）— スコア・ビジュアルとも既存どおり
15. perfect（bakeTarget内で確定）— 3つ星、既存どおり
16. burnt（bakeTarget超過後に確定）— 焦げ演出・スコアとも既存どおり
17. Dex 3/3 — 3レシピとも `dex-card--locked` が付かず、図鑑に表示される

全工程を通じて **console/page error: 0**、**horizontal overflow: なし**。

### 4.2 目視確認（スクリーンショット、390×844）

`before-paint` / `painting-middle`（短いdrag中のトレイル）/ `painting-near-rim`
（縁沿いcurved dragのトレイル、リセットしたまっさらな生地の上で撮影しトレイル自体が
はっきり見えることを確認）/ `paint-release`（release後、トレイルが既存
sauce-spreadに収束し切った状態）/ `margherita-result`（3つ星・perfect）/
`marinara-result`（2つ星・burnt、焦げ演出あり）/ `quattro-formaggi-result`
（2つ星・raw、生焼け演出あり）をすべて撮影し、drag中とrelease後の見た目が
不自然な断絶なく繋がっていることを確認した。BAKE中Tetoアイコン付きcaptionの
見た目も別途確認済み。

### 4.3 Build / Lint

```
npm run build   # tsc -b && vite build -> success
npm run lint    # oxlint -> no findings
git diff --check
```

いずれも成功。プロジェクトに既存のtest scriptは無いため、新規テスト基盤は追加していない。

## 5. 自己レビュー結果

- **pointer lifecycle**: down→move→up/cancel の全経路で `gestureRef` を必ず
  リセットし、`fadeTimeoutRef` もunmount時・新規down時にクリアするようにした。
  リークなし。
- **iOS Safari risk**: `preventDefault()` は一切呼んでおらず、`touch-action: none`
  （スコープは `pizza-dough--interactive` のみ）でスクロール/ズーム干渉を防止する
  方式にした。Passive listener起因の警告・クラッシュリスクを避けている。
- **coordinate mismatch**: `pizzaCoordinates.ts` に一本化し、`pizzaState.ts` の
  重複定数を除去。sauce-layer inset補正も同ファイルに集約。
- **unnecessary rerenders**: `pointermove` 中はReact stateもdispatchも呼ばない。
  SVGパスはrefへの直接DOM操作のみ。
- **cleanup**: unmount時のtimeoutクリア、cancel時の即時トレイルクリアを実装。
- **tap regression**: 10px未満の移動は旧ロジックと同じ `onTap(startDough)` 経路。
  4.1の1・2番、4.2のスクリーンショットで確認。
- **drag→spread transition**: トレイルの色をソースの色に一致させ、フェード
  （260ms）とsauce-spread（380ms）を同時に走らせることで自然な収束を実現。

P0/P1に該当する指摘なし。

## 6. 既知の制約（Known limitations）

- トレイルのフェード時間（260ms）とsauce-spreadの再生時間（380ms）は目視で
  自然に見える値を手動で選定したものであり、A/Bテストや定量評価は行っていない。
- `getCoalescedEvents()` に対応しないブラウザでは、非常に高速なdragの場合
  トレイルの滑らかさがやや落ちる可能性がある（機能自体は単発イベントに
  フォールバックするため破綻はしない）。
- 自動検証はPlaywrightの使い捨てスクリプト（リポジトリ外）によるものであり、
  恒久的なCI/E2E基盤ではない。今後同種の回帰確認をしたい場合は再作成が必要。
- Teto BAKEキャプション polish は「無記名captionにアイコンを添える」最小限の
  対応に留めており、Character Experience Audit（11/25）の根本改善はPhase 3B/3C
  にdeferしている。
