# Production Visual P1 — IngredientGlyph abstraction：Result

## 結論

- **P1 の SHA: `39ce35cc80b17574ed85e60c71f989acb1b41237`**（`src/**` だけを変更した独立した commit）。
- production に ingredient visual の抽象化（`Ingredient.pieceVisual` と `IngredientGlyph`）を入れた。**既存 22 材料の見た目と挙動は変わっていない**。BEFORE（main）と AFTER（P1）の production build を画素単位で比べ、22 capture × 2 viewport のすべてで、チャンネルあたり 2 を超えて変化した画素は 0 だった。
- 7 つの新材料は登録していない。W1 recipe、REC-04、価格・unlock・star gate、scoring、save も変えていない。
- 判定: **Production Visual P1 = READY、Human Verification = PASS → FINAL PASS**（2026-09-25、ユーザーが Human Verification 動画を確認して確定）。WebKit の Final Gate は run 36099775804 で PASS。

## Authority（作業開始時）

| 対象 | 値 |
|---|---|
| main | `1e53baa`（Phase A / B から変わっていない。P1 に影響する変更はない） |
| Phase A / Phase B plan | `3fc02a0` / `80ce35e` |
| #220 / #221 | `e49dab9` / `070afc0827f382bec8bc813d62e7fafe663a0991`（変更していない） |
| Human Visual Gate | 7/7 HUMAN PASS |

## Commit の構成（branch `claude/w1-ingredient-visual-preview-mt4uxw`）

| commit | 内容 | `src/**` |
|---|---|---|
| `589b324` | tools: W1 evidence generator が visual だけの src drift を許すようにした。承認されていない `pieceVisual` を拒否する guard も追加 | 変更なし |
| **`39ce35c`** | **P1 本体** | **変更あり（ここだけ）** |
| `d323d36` | test: P1 の BEFORE / AFTER 画素比較 harness（`tools/p1_visual_regression`） | 変更なし |
| `e83bee4` | test: P1 の Human Verification 動画の台本 | 変更なし |
| （この report） | docs と screenshots | 変更なし |

## 変更したファイル（P1 `39ce35c`）

- `src/data/ingredients.ts`: `DedicatedIngredientVisual` 型（`"tomato-slice" | "caper-cluster" | "clam-valve"`）と、optional の `Ingredient.pieceVisual` を追加した。**row はどれも変更していない**。
- `src/components/IngredientGlyph.tsx`（新規）
  - `pieceVisual` が無いとき: emoji を素の text node として描く。以前の DOM と同一。
  - `pieceVisual` があるとき: Human PASS した SVG を描く。1em、`aria-hidden`、`id` なし。
  - どちらを描くかは宣言された visual だけで決まり、ingredient の id は見ない。
- 8 つの render site を移行した（下の表）。
- `src/App.css`: `.ingredient-glyph` と `.ingredient-glyph--tomato-slice` を追加。現時点ではどの要素にも当たらない。
- `src/components/IngredientGlyph.test.tsx`（新規、49 test）

## 1. 8 つの render site の移行

| # | site | 結果 |
|---|---|---|
| 1 | `IngredientPieceVisual.tsx`（pizza 上の piece と reference の 3 view） | IngredientGlyph |
| 2 | `IngredientTray.tsx` の tray chip | IngredientGlyph |
| 3 | `IngredientTray.tsx` のドラッグプレビュー | IngredientGlyph |
| 4 | `ResultPanel.tsx` の「使った材料」 | IngredientGlyph と名前。textContent は `${emoji} ${nameJa}` のまま |
| 5 | `PizzaThumbnail.tsx`（Pizza Select） | IngredientGlyph |
| 6 | `InventoryOverlay.tsx` | IngredientGlyph |
| 7 | `ShopOverlay.tsx` | IngredientGlyph |
| 8 | `DexOverlay.tsx` | IngredientGlyph と名前 |

漏れを防ぐ checker（`IngredientGlyph.test.tsx`）:

- `import.meta.glob` で `src/` のすべての production ファイルを読み、コメントを除いたうえで、**`IngredientGlyph.tsx` 以外に `.emoji` を読むファイルが 0 件**であることを確かめる。
- 監査済みの 8 箇所それぞれが `<IngredientGlyph` を正しい個数だけ使っていることを確かめる。
- この checker が実際に機能することも確かめた。Shop と Dex の 1 箇所をわざと `{ingredient.emoji}` に戻すと、checker が 2 件 FAIL した（確認後に元へ戻した）。

## 2. 既存 22 材料の regression

- **unit test**:
  - 22 材料すべてで、`<IngredientGlyph>` の出力が以前の `{ingredient.emoji}` と **markup として完全に一致**する。
  - site ごとに、tray（全ページ）、piece、RESULT（22 材料の `${emoji} ${nameJa}`）、Inventory、Shop、Pizza Select の thumbnail（全 recipe）、Dex の chip（全 recipe）について、以前と同じテキストで、SVG が無いことを確かめた。
- **画素比較**（`tools/p1_visual_regression/before-after.spec.ts`）
  - 比べた build: BEFORE は main の src（tree `bf162ec`）、AFTER は `39ce35c`。どちらも `vite build` の production build。
  - 同じ決定的な台本で操作した。save は固定（22 材料すべて所持、全 recipe 発見済み）、`Math.random` は固定、CSS animation は無効、bake は fake clock を絶対時刻に固定。
  - 撮った 22 capture: HOME、Pizza Select（3 画面）、tray（sauce / cheese / topping 3 ページ）、全 topping を載せた pizza raw、bake、RESULT、Inventory（2 画面）、Shop（3 画面）、Dex（5 画面）。

| viewport | capture | チャンネルあたり 2 を超えて変化した画素 | 完全一致しなかった画素 |
|---|---|---|---|
| 390×844 | 22 | **0** | 07-bake の 4 px だけ |
| 360×800 | 22 | **0** | 07-bake の 3 px だけ |

完全一致しなかった 3〜4 px は、bake gauge の rail の左端にあり、どれも値が ±1 違うだけだった。同じ build 同士（BEFORE 対 BEFORE）を比べる control でも、3 回中 1 回で同じ位置に同じ差が出たので、renderer の antialias の揺れであり、P1 による差ではない。

Screenshots（policy どおり commit した）: `docs/reports/screenshots/production-visual-p1/{390x844,360x800}/` に、9 つの文脈の BEFORE / AFTER と `pixel-report.json` がある。commit した PNG は palette 圧縮したもので、画素比較は圧縮前の原画像で行った。

## 3. 専用 visual の fixture 結果

- 3 種（`tomato-slice` / `caper-cluster` / `clam-valve`）それぞれで次を確かめた:
  - SVG を描き、`data-ingredient-visual`、class、`aria-hidden`、`focusable=false`、1em の各属性を持つ。
  - emoji のテキストを描かない。
  - 内部に `id` を持たない。
- 描く visual は id に依存しない。同じ visual を持つ fixture 同士は、id が違っても同じ markup になる。`fresh-tomato` という id を持っていても、`pieceVisual` が無ければ emoji を描く。
- `IngredientPieceVisual` の中では、bake の `filter` が SVG を包む span にかかる。
- `INGREDIENTS` に fixture の row を一時的に追加して、site ごとに確かめた。tray chip（accessible name は nameJa のまま）、RESULT、Inventory、Shop、Pizza Select の thumbnail が、emoji の代わりに SVG を描いた。

## 4. Identity と discovery

- W1 evidence generator の `--check` は PASS（discovery probe を production matcher で再実行。6 つの出力が byte 単位で一致し、collision 0、REC-08 を維持）。`--self-test` は 40/40。
- generator に新しい guard を入れた: production の ingredient が `pieceVisual` を持てるのは、Human Gate がその id にその visual を承認した場合だけ。現時点で `pieceVisual` を持つ ingredient は 0。
- `matcher.test.ts` は変更なしで PASS。7 つの新材料は登録していない（`getIngredient` が undefined を返すことを test で確認）。cherry-tomato は 🍅 で `pieceVisual` を持たない。**fresh-tomato ≠ cherry-tomato** を維持した。

## 5. Save の互換性

- `pieceVisual` は静的なデータで、save には含まれない（`createDefaultSave()` を JSON にしても `pieceVisual` が出てこないことを test で確認）。
- save key は `teto-pizza-save-v1` のまま、schema も変えていない。`persistence.test.ts` は変更なしで PASS。

## 6. 検証結果

| check | result |
|---|---|
| focused test（IngredientGlyph、IngredientPieceVisual、ReferenceTruth、Tray ×5、GameScreen の physical drag、PizzaStage の bake visual、FreeCook の UI、PizzaThumbnail、Inventory ×2、MissionResult、matcher、persistence、ingredients） | 341/341（IngredientGlyph の 49 を含む） |
| `npm test`（全体） | 126 files / 2465 tests PASS |
| `tsc -b` / `npm run lint`（oxlint） / `npm run build` | PASS |
| evidence generator の `--check` / `--self-test`、catalog、invariants、canonicalizer、slice 1〜3 の result | PASS / 40/40 / PASS / 4/4 / 36/36 / PASS |
| Chromium E2E（repo の `e2e/` 全体、`iphone-390x844` と `iphone-360x800`） | **114/114** |
| Chromium の BEFORE / AFTER 画素比較（390×844 / 360×800） | **PASS / PASS**（22 capture ずつ、変化 0） |
| WebKit の Final Gate（`e2e-webkit.yml` を workflow_dispatch で実行。HEAD `d323d36` に P1 を含む） | **PASS**。run [36099775804](https://github.com/perusonao/teto-pizza-game/actions/runs/36099775804): `webkit-390x844` と `webkit-360x800` の各 2 shard（計 4 本）が success。`WebKit Gate` も success（各 shard の evidence で、一覧にあるすべての test が実行されたことを確認済み） |

## Human Verification Videos

| Video | Viewport | Duration | Size | Codec | Verification |
|---|---|---:|---:|---|---|
| `p1-ingredient-glyph-human-verification-390x844.mp4` | 390×844 | 1:05.3 | 2.02 MB（2,017,895 B） | H.264 High / yuv420p / 30fps | PASS |

Download: セッション内で直接提出した（repo には commit していない）。sha256 は `cdfebc943b3a63fd07a989c0ee52a96adc09b0a1e2b59588acf5d1ca678e7f40`。

Video Verification: PASS（ffmpeg で最後まで decode してエラー 0。390×844。3 秒ごとにフレームを抜き出して、すべての区間が映っていることを確認）。

動画で確認すること:

1. Part 1: P1 の production build（source `39ce35c`、各画面の caption に表示）を、HOME → Free Cooking → tray（cheese と topping の 3 ページ）→ pizza raw → bake → RESULT → Inventory → Shop → Dex の順に見せる。
2. Part 2: BEFORE（main `1e53baa`）と AFTER（P1 `39ce35c`）を交互に表示する。対象は HOME、tray、pizza raw、bake、RESULT、Inventory、Shop、Dex、Pizza Select の 9 画面で、各画面に画素の変化数（すべて 0）を表示する。
3. 最後に HUMAN CHECK のカードと、両方の SHA を表示する。

## before / after の判定

- 自動判定: **差なし**（unit の markup が一致、Chromium の画素比較で 0、既存 E2E が全 PASS）。
- Human の判定: **HUMAN PASS**（2026-09-25、ユーザーが確定。下の「Human Verification の記録」を参照）。

## READY / NOT READY

**Production Visual P1: READY / Human Verification: PASS → FINAL PASS**

- 既存 22 材料の見た目は変わっていない（画素で証明した）。
- 8 つの render site は IngredientGlyph にまとまった（checker で保証）。
- 専用 visual の経路は fixture で動くことを確認した。
- identity、discovery、save は変わっていない。
- Chromium は PASS。WebKit の結果は上の表のとおり。

次の P2（7 材料の登録）は、引き続き REC-04（価格・unlock・star gate）が決まるまで NOT READY。

## Human Verification の記録（2026-09-25）

| 項目 | 値 |
|---|---|
| 対象 | Production Visual P1（IngredientGlyph の抽象化） |
| P1 の実装 SHA | `39ce35cc80b17574ed85e60c71f989acb1b41237`（この記録でも変更していない） |
| 確認した動画 | `p1-ingredient-glyph-human-verification-390x844.mp4`（390×844、H.264、1:05.3、sha256 `cdfebc943b3a63fd07a989c0ee52a96adc09b0a1e2b59588acf5d1ca678e7f40`。repo には commit していない） |
| 確認した範囲 | HOME → Free Cooking → tray → raw → bake → RESULT → Inventory → Shop → Dex、および BEFORE / AFTER の比較 |
| Human の所見 | 既存材料の表示崩れなし。BEFORE / AFTER の比較に問題なし。自動の画素比較（22 capture × 2 viewport で変化 0）の結果とも整合する |
| Human の判定 | **HUMAN PASS**（ユーザーが確定） |
| 自動の gate | Chromium: unit 2465/2465、e2e 114/114、画素比較 PASS。WebKit の Final Gate: run [36099775804](https://github.com/perusonao/teto-pizza-game/actions/runs/36099775804) PASS（4 shard と WebKit Gate） |
| 最終判定 | **Production Visual P1 = READY / Human Verification = PASS → FINAL PASS** |

範囲外であり、この記録でも決めていないこと: 7 新材料の登録（P2）、REC-04、W1 recipe、価格・unlock・star gate。P2 は REC-04 が決まるまで NOT READY のまま。
