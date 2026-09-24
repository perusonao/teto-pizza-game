# Progression 2.0 W1 — Ingredient Visual Preview Gate

## 結論

- 基準: `main` `dff233c`、Evidence / Owner Decision authority `abb0a3d`（branch `claude/w1-evidence-owner-decision-xjwh1v`）、W1 authority PR #220 `e49dab9`、PR #221 HEAD `d028844`（2026-09-24 に GitHub で確認。abb0a3d が pin している SHA と一致）。#220 / #221 / #215 / #222 / #223 はどれも変更していない。
- この Gate は **Visual Evidence Gate** であり、production authoring ではない。`src/**` と `e2e/**` は変更していない。Preview は `visual-gate/w1/`（独立した Vite root）にだけ置いた。
- **PASS 0 件**。Human の実機確認はまだ行っていない。画面は Chromium + Noto Color Emoji で描画したもので、判定はその描画を AI が見た観察にとどまる。

| ingredient | ledger | candidate | status |
|---|---|---|---|
| capers | ING-02 | 🟢 | **DEDICATED_VISUAL_REQUIRED** |
| clam | ING-07 | 🦪（第1候補）/ 🐚（FAIL） | HUMAN_VERIFICATION_REQUIRED |
| corn | ING-08 | 🌽 | HUMAN_VERIFICATION_REQUIRED |
| eggplant | ING-03 | 🍆 | HUMAN_VERIFICATION_REQUIRED |
| fresh-tomato | ING-09 | 🍅（cherry-tomato / tomato-sauce と共有） | **DEDICATED_VISUAL_REQUIRED** |
| pineapple | ING-10 | 🍍 | HUMAN_VERIFICATION_REQUIRED |
| potato | ING-11 | 🥔 | HUMAN_VERIFICATION_REQUIRED |

- READY / REVIEW / BLOCKED は **0 / 10 / 0 のまま**。
- REC-01〜04、RT-01、recipe quantity、OD-S1 = A、ingredient identity はいずれも変更していない。fresh-tomato は cherry-tomato へ alias しておらず、独立した id のまま。

## Fresh Audit（変更前）

| # | 対象 | 所見 |
|---|---|---|
| 1 | production の ingredient 描画 | `IngredientPieceVisual`：cheese 以外は emoji だけで描かれ、`color` は piece に使われない。emoji を描画している箇所は 8 つある（piece、tray chip、drag preview、RESULT の材料リスト、PizzaThumbnail、Inventory、Shop、Dex） |
| 2 | tray | `IngredientTray` は free-cook で OWNED の全 ingredient を表示し、1 page 6 枠でページを切り替える。並びは `INGREDIENTS` の順 |
| 3 | pizza 上の topping | `PizzaStage` の `.pizza-topping` → `IngredientPieceVisual`。大きさは 28px。thumbnail では約 16〜19px |
| 4 | raw / baked | BAKE と RESULT のときだけ `toppingVisualFrame(heat)` を使い、brightness / saturate / sepia を連続的に変える。変化は cheese より弱い。herb（`bakeRoastResistant`）はさらに弱い。形は変わらない |
| 5 | emoji と color の対応 | 🍅 は tomato-sauce と cherry-tomato がすでに共有している。丸い glyph は ⚫ black-olive と 🔴 pepperoni |
| 6〜9 | cherry-tomato / tomato-sauce / black-olive / pepperoni | 上の 5 のとおり。tomato-sauce は pizza 上では塗り面として描かれ、🍅 が見えるのは tray chip と RESULT の材料リストだけ |
| 10 | mobile 1-screen | `e2e/viewport-1screen.spec.ts` と `e2e/free-cooking-phase3-2.spec.ts` の `expectOneScreen` 方式を流用した |

既存の仕組みの再利用: `e2e/gestures.ts`（dough / sauce / tap の操作）、save seed を `addInitScript` で注入する方式、`bakeToTarget` の virtual clock、Policy の screenshot 置き場。新しく足したのは candidate row を注入する小さな entry と QA board だけ。

## Preview の作り方（preview 専用。main へ merge できる機能ではない）

- `visual-gate/w1/candidates.ts`：#221 matrix（d028844）の 7 row をそのまま写したもの。clam の glyph は `?clam=oyster|spiral` で切り替え、OD-CLAM-GLYPH どおりどちらにも確定しない。
- `visual-gate/w1/inject.ts`：`INGREDIENTS` を snapshot する module より先に 7 row を runtime で追加する。production のデータファイルは変更しない。id が既存と重なった場合は throw する。
- `visual-gate/w1/index.html`：**本物のゲーム**に 7 row を足したもの。画面の隅に `W1 VISUAL GATE PREVIEW · clam=…` の ribbon を常に表示する。
- `visual-gate/w1/board.html`：QA board。production の `IngredientPieceVisual` / `IngredientTray` / `toppingVisualFrame` / `doughVisualColors` を使い、次を1枚で比較する: raw・heat 1.0・heat 1.6、28px と 16px、grayscale と deuteranopia / protanopia のシミュレーション。
- `visual-gate/w1/playwright.config.ts` と `e2e/w1-visual-gate.spec.ts`：root の `playwright.config.ts`（`./e2e`）とは分けているので、CI と既存 e2e には入らない。
- `npm run build` の `dist/` には preview のコードが一切入らないことを確認した（ribbon 文字列を grep して 0 件）。

実行: `npx playwright test -c visual-gate/w1/playwright.config.ts`（`W1_GATE_SCREENSHOTS=1` で screenshot を保存、`W1_GATE_VIDEO=1` で人が見る速度の動画を記録）。

in-game シナリオ（390×844 と 360×800 の両方）: `tomato`、`capers`、`eggplant`、`clam-oyster`、`clam-spiral`、`yellow`、`full-tray`（topping 15 種、3 page）。各シナリオで tray → 配置（raw）→ BAKE → RESULT を撮る。BAKE は needle を free-cook の target 中心（heat 1.0）で止めて撮影する。

## 重点 4 ingredient

### fresh-tomato — DEDICATED_VISUAL_REQUIRED

- pizza 上: fresh-tomato ×3 と cherry-tomato ×3 は raw でも baked でも **pixel 単位で同一**。codepoint が同じなので、どの端末でも同じ描画になる。
- tray: 区別できるのは label（トマト / チェリートマト）だけ。OWNED が多いと別ページに分かれる（full-tray では cherry-tomato が 1 page、fresh-tomato が 3 page）。
- RESULT: 材料リストに `🍅 トマトソース` と `🍅 トマト` が並ぶ。
- recipe 誤認: cherry-tomato で作った Pesto Caprese は見た目が同じなのに **NO_MATCH** になる（W1 discovery fixtures）。失敗の理由を見た目から知る手段がない。
- 結論: 🍅 の共有は OD-TOMATO-REPRESENTATION が許可した **Preview 限定の暫定 glyph としてだけ**使える。W1 本実装では専用 visual が必要。
- Evidence: `tomato-1-tray` / `-2-raw(-stage)` / `-3-baked(-stage)` / `-4-result`、`full-tray-1-tray(-page3)`、`board-tomato`

### clam — HUMAN_VERIFICATION_REQUIRED（🦪 が第1候補、🐚 は FAIL）

| | 🦪 OYSTER | 🐚 SPIRAL SHELL |
|---|---|---|
| 貝として読めるか | 二枚貝として読める（ただし牡蠣であり、あさりではない） | 巻貝 / 法螺貝として読める |
| olive oil + parmigiano 上 | 殻の暗い輪郭があり、はっきり分かる | 白〜淡いピンクで、parmigiano と同じ明るさに沈む |
| 🧄 garlic との混同 | しない | 16px では 4 種の中で最も garlic と紛らわしい |
| baked（heat 1.0 / 1.6） | 変わらない | 変わらない（低コントラストのまま） |

- 結論: 🐚 は不適切（FAIL）。🦪 は視認性・識別性の面では使えるが、「あさりとして正確か」は満たしていない。label の「あさり」で補えばよいかは Owner / Human の判断になる。
- このため **glyph は確定しない**（OD-CLAM-GLYPH = DEFER_TO_VISUAL_GATE を維持）。実機で 🦪 が却下されたら DEDICATED_VISUAL_REQUIRED へ移す。
- Evidence: `clam-oyster-*` / `clam-spiral-*`（tray / raw / baked / result）、`board-clam`

### capers — DEDICATED_VISUAL_REQUIRED

- 🟢 と 🔴 pepperoni は**同じ丸い glyph の形**で、⚫ black-olive は小さく暗いことで区別できる。
- grayscale: 🟢 と 🔴 は同じ形の灰色の円 2 つになり、違いは明るさの差だけ。deuteranopia のシミュレーションでは両方ともカーキ色でほぼ同じ。protanopia のシミュレーションでも明るさでしか区別できない。
- baked（heat 1.6）では、焼き色の変化が 🟢 と 🔴 をさらに近い色にする。
- **識別の手がかりが色しかない**。形の手がかりはない。🟢 はケッパーとしても読めない。
- 専用 visual の案: 丸でない輪郭のもの。例: オリーブグリーンの小さな蕾 2〜3 個の塊で、先端を明るくする。cheese の branch と同じように CSS の物理 piece として描く。
- Evidence: `capers-*`、`board-capers`（normal / grayscale / deutan / protan）

### eggplant — HUMAN_VERIFICATION_REQUIRED（🍆 は維持できる見込み）

- tomato sauce 上でも cheese 上でも、raw では紫の本体と緑のヘタがはっきり分かり、sauce に沈まない。
- baked: heat 1.0 ではほとんど変化しない。heat 1.6 では紫が少し暗くなるが、形とヘタは読める。16px でも識別できる。
- 未確認のリスク: Apple の 🍆 は Noto より暗い紫。赤い sauce の上で焼いた後に沈まないかは実機でしか確認できない。
- Evidence: `eggplant-*`、`board-eggplant`

## corn / pineapple / potato — HUMAN_VERIFICATION_REQUIRED

- corn 🌽: cheese 上ではっきり見える。緑の皮があるので 🥚 egg と混同しない。raw / baked / 16px のどれでも問題ない。
- pineapple 🍍: 黄色の本体と緑の冠があり、cheese 上ではっきり見える。🌽 より小さく見える。baked でも問題ない。
- potato 🥔: pesto 上でも cheese 上でも読める。heat 1.6 で生地がむき出しの部分に置くと、7 種の中で最もコントラストが低い（実機確認で注意する点）。
- Evidence: `yellow-*`、`full-tray-*`、`board-yellow`、`board-all`

## Viewport

| 確認項目 | 390×844 | 360×800 |
|---|---|---|
| horizontal overflow なし（PREPARE / RESULT / board） | automated OK | automated OK |
| TOPPING で `.game-screen` の縦スクロールなし | automated OK | automated OK |
| 焼く! バーが画面内 | automated OK | automated OK |
| 3 page tray の崩れなし（15 種） | automated OK | automated OK |
| pizza 操作領域を邪魔しない（tray は pizza の下に収まる） | screenshot 確認 | screenshot 確認 |
| RESULT に到達（焦げでない、page error 0） | automated OK | automated OK |
| **visual 判定** | 上表のとおり（PASS なし） | 同じ |

WebKit: この環境には WebKit の実行ファイルがない（`/opt/pw-browsers` は Chromium のみ）。`src/**` と `e2e/**` を変更しておらず Safari の runtime 経路に影響しないため、WebKit Final Gate は不要と判断した。実機 Safari での確認は Human Verification に含まれる。

## Discovery regression

- `progression2_w1_evidence_resolution.py --check`: PASS。production matcher で discovery probe を再実行した結果、5 出力が byte 単位で一致した。collision 0、W1 の 10 件すべてが UNIQUE_MATCH、1 ingredient 差の近傍に AMBIGUOUS 0。
- REC-08 の解決状態を維持（Melanzane ⊂ Parmigiana、signature は別）。
- fresh-tomato ≠ cherry-tomato を維持: `pesto-caprese:fresh-tomato->cherry-tomato` = NO_MATCH は変わらない。Preview でも pizza 上の piece は `pizza-topping--fresh-tomato` ×3 と `--cherry-tomato` ×3 として別々に数えられ、7 candidate すべてが自分の id のまま置かれた（e2e で assert）。

## Validation

| check | result |
|---|---|
| `progression2_w1_evidence_resolution.py --check` | PASS（READY 0 / REVIEW 10 / BLOCKED 0） |
| `progression2_w1_evidence_resolution.py --self-test` | PASS 27/27 |
| `validate_recipe_catalog.py` | PASS（53 / 62 / 11） |
| `progression2_evidence_invariants.py` | 4/4 PASS |
| canonicalizer の self-test（`progression2_ingredient_canonicalizer.py`、引数なし） | PASS 36/36 |
| W1 discovery regression probe（`--check` 経由） | PASS |
| `tools/w1_visual_gate_result.py --check` / `--self-test` | PASS / 12/12 |
| 関連する UI の vitest（IngredientPieceVisual / IngredientTray ×2 / PizzaStage.bakeVisual / PizzaThumbnail / freeCookTrayPaging / ingredients / matcher） | 124/124 |
| `npm test`（全体） | 2416/2416（125 files） |
| `tsc -b`、`tsc -p visual-gate/w1/tsconfig.json` | PASS |
| `npm run lint`（oxlint） | PASS（0 件） |
| `npm run build` | PASS（dist に preview のコードなし） |
| W1 Gate の Chromium E2E（390×844 / 360×800） | 16/16 |
| 既存の Chromium E2E（free-cooking / viewport-1screen、両 viewport） | 34/34 |

## Human Verification Videos

| Video | Viewport | Duration | Size | Codec | Verification |
|---|---|---:|---:|---|---|
| `w1-ingredient-visual-gate-390x844.mp4` | 390×844 | 1:51.8 | 2.46 MB（2,457,091 B） | H.264 High / yuv420p / 30fps | PASS |

Download: セッション内で直接提出した（repo には commit していない。`artifacts/review/` は gitignore 済み）。

Video Verification: PASS（ffmpeg で最後まで decode してエラー 0。390×844 全体が映っていることと、各シナリオが写っていることを抽出フレームで確認）

動画で確認すること:

- tomato: tray の チェリートマト / トマト → 両方を pizza に置く → 焼成中（heat 1.0）→ RESULT。左右の列が見分けられないこと
- capers: 🟢 / ⚫ / 🔴 / 🧄 を同じ pizza に置いた状態（raw → baked）
- eggplant: 左の列は sauce の上、右の列は cheese の上。raw → baked
- clam 🦪 → clam 🐚: 同じ配置・同じ条件で連続して表示（ribbon に使用中の glyph を表示）
- yellow（corn / pineapple / potato / egg / ham）
- full-tray: 3 page の tray を送る → 7 種を 1 枚に置く → RESULT
- 最後に QA board を section ごとに保持して表示（CVD シミュレーションを含む）

注: 動画は Chromium と Noto の描画である。iOS の Apple Color Emoji ではないため、実機 Human PASS の代わりにはならない。

## 反映と影響

- Ledger へ状態変更として反映できる候補: **ING-02 → DEDICATED_VISUAL_REQUIRED**、**ING-09 → DEDICATED_VISUAL_REQUIRED**。evidence の追加だけ: ING-03 / 07 / 08 / 10 / 11。**解決できるものはない**。この Gate では evidence ledger 本体を編集していない。
- READY / REVIEW / BLOCKED: 0 / 10 / 0 で変わらない。puttanesca-pizza（ING-02）と pesto-caprese（ING-09）は、残りが「実機確認」から「専用 visual」に変わる。実装すれば解消できるので REVIEW のままで、BLOCKED にはならない。
- fresh-tomato の専用 visual は、OD-TOMATO-REPRESENTATION の定めどおり**新しい runtime dependency の候補**になる。登録は次の slice で行う（ここでは提案だけ。RT-01 には触れていない）。

## 次の最小 slice

1. **Human Verification session（実機、iPhone Safari 390×844）**: この Preview を Preview deploy し、HVR の 5 件（clam 🦪 / corn / eggplant / pineapple / potato）を確認する。clam は 🦪 を採用するかを Owner が判断する。
2. **Dedicated Visual slice（preview 限定のまま）**: fresh-tomato（輪切りの断面）と capers（蕾の塊）を、emoji ではない piece 表現として QA board と in-game Preview に追加し、この Gate を再実行する。production の emoji 描画 8 箇所への展開は、Gate を通過してからの W1 authoring slice で行う。

## 成果物

- `docs/reports/data/TETO_PROGRESS2_W1_VISUAL_GATE_RESULT.json`（生成元は `tools/w1_visual_gate_result.py`。`--check` / `--self-test` あり）
- `docs/reports/screenshots/w1-ingredient-visual-gate/{390x844,360x800}/`: 各 viewport 50 枚。シナリオごとに `*-1-tray`、`*-2-raw(-stage)`、`*-3-baked(-stage)`、`*-4-result`、`full-tray-1-tray-page2/3`、`board-*`
- `visual-gate/w1/**`（preview 専用の harness）
