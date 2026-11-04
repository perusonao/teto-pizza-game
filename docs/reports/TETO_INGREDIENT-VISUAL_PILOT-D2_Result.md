# Pilot D2（Issue #703）クリームチーズ C1 — Result

基準 main `51c24bda`（PR #701 の squash merge）。ブランチ `claude/pilot-d2-cream-cheese-c1`。Owner 承認（2026-10-30）: クリームチーズの C1 最終案（設計案 `claude/teto-ingredient-visual-audit-a401jy` の `docs/reports/TETO_INGREDIENT-VISUAL_PILOT-D2_C1_Design-Proposal.md`）。サーモンは変更していない。

## 変更
| ファイル | 内容 |
|---|---|
| `src/components/IngredientGlyph.tsx` | `CreamCheeseBlock` の描画のみ: 温かい白の本体＋下半分だけ銀紙（ぎざぎざの上端）。`id` / gradient / `<defs>` なし。`pieceVisual` `cream-cheese-block`、食材 id、viewBox（64）、`.ingredient-glyph--cream-cheese-block` の 1.2em は不変 |
| `src/components/IngredientGlyph.test.tsx` | 色の期待値を C1 に更新（旧 `#c9d3dd` が無いことも検査） |
| `docs/decisions/TETO_INGREDIENT-ICON-2.0_STYLE-LOCK-V2.md` | cream-cheese を A → C1 に更新（§1b の表、§10.3b に決定記録） |

触れていない: `ingredients.ts`、保存 schema、レシピ、在庫、採点、Dex、`App.css`、`lateCatalog.offSurface.json`（`pieceVisual` が同じなので digest は不変）、#468、共有 Preview。

## 承認案からの 1 点の調整（Owner に確認してほしい）
承認案の本体色 `#fff1d2`（上面 `#fffaf0`）は、**ゲーム内の焼成後**に、チーズ用フィルタ（`brightness(1.06) saturate(1.12) sepia(.14)`）でレモン色（実測 H≈60°）に寄り、**バターに見えた**（`ingredient-visual-pilot-d2/V4_small-size-butter-check_chromium_390.png` の「承認案の色」行）。そこで本体を **`#fff4e2`、上面を `#fffcf4`** に変えた（形・箔・輪郭・配置は承認案のまま）。戻す場合は 2 つの色の値を変えるだけ（`fill` と、テストの期待値、Style Lock の 1 行）。

## 検証
- `tsc -b` エラー 0 / `oxlint`（変更ファイル）警告なし / `npm run build` 成功。
- focused unit（`IngredientGlyph` / `IngredientPieceVisual` / `ingredients` / `lateCatalog.offGolden`）: 249 pass。`src/components src/data src/state src/logic/catalog`: 298 files、6183 pass。5 件（`HintSheet.hint5` / `HintSheet` / `ShopOverlay` / `gameReducer.deductionHint` / `gameReducer.dinner`）が撮影との並行実行の負荷で失敗したが、**単独再実行ではすべて pass**（248 tests）。変更とは無関係。
- Chromium E2E（`cooking-tray-family-filter` / `ingredient-shelf-inventory` / `finished-pizza-visual-2.0`、390×844 と 360×800）: 26 pass、6 skip（viewport 指定）、0 fail。E2E が書き出す画像は破棄した。
- WebKit の E2E は CI に任せる（ローカルで Playwright 公式 WebKit は取得不可）。

## 自動 Visual HV（iPhone Safari 実機ではない）
撮影: Chromium（Playwright）と WebKitGTK（apt の WebKit エンジン + WebDriver。公式 WebKit が取得できないための代替）、390×844 と 360×800、実ゲーム画面。**C0 は変更前の同じ手順の既存撮影（main = 旧 PR #701 の HEAD）、C1 は今回の新規撮影。** 画像: `docs/reports/screenshots/ingredient-visual-pilot-d2/`。動画（14 本、Chromium）は HV 方針により commit せず、Owner へ直接提出。

| 画像 | 内容 |
|---|---|
| `V1_game_C0-vs-C1_chromium_{390,360}` | 調理中（配置後）、焼成後、RESULT、焼き過ぎ、白いチーズとの隣接 |
| `V2_tray_C0-vs-C1_chromium_*` | トレイ（チーズのページ） |
| `V3_overlap_C1_chromium_*` | C1 の自然配置と、**合成**の強制重ね（クリームチーズとフェタ・リコッタ） |
| `V4_small-size-butter-check_chromium_390` | 実ゲームの画素を 20 / 24 / 28 / 34px に縮小。C0・承認案の色・調整後の色 × 通常・焼き過ぎ |
| `V5_game_C0-vs-C1_webkit_*` | WebKitGTK の C0 と C1 |
| `V6_C1_chromium-vs-webkit_*`、`V7_tray_C1_chromium-vs-webkit_*` | C1 の Chromium 対 WebKitGTK |

### 判定（目視）
| 観点 | 判定 | 根拠 |
|---|---|---|
| 金属の缶・箱に見えない | **PASS** | V1 / V5。本体の温かい白が先に目に入り、箔は下側の帯だけ |
| 白いチーズとの識別（feta・ricotta・mozzarella・CSS の白円） | **PASS** | V1 隣接 / V2 / V3。箱型＋下の銀帯で、角切り・山・円と別。グレースケールでも箔の帯が目印 |
| トレイ・Inventory のチップ | **PASS** | V2 / V7。チップの大きさ・ページャーは変わらない |
| 調理中・焼成後・RESULT | **PASS** | V1 / V5 / V6。Chromium と WebKitGTK で形・色・サイズが一致 |
| 焼き過ぎ | **PASS** | 暗い生地の上でも本体の形と箔の帯が分かる（茶灰に寄る） |
| 20〜24px でバターに見えない | **要確認** | V4。調整後は本体がほぼ白で、レモン色は消えた。ただし 20〜24px では「淡色の箱＋銀の帯」で、バターの塊にも見えうる。名前・「チーズ」のタブで補える |
| 黄みが強すぎない | **PASS（調整後）** | 承認案の色は焼成後にレモン色（H≈60°）に寄ったため調整。調整後は ricotta と同程度の淡い暖色 |
| 重なり | **PASS**（上にある側）／合成のみ | 自然配置では重ならない（`findOpenSpot`）。合成の強制重ねは、上にある側が読め、下は隠れる（ゲームでは発生しない） |

## 未確認・Owner 判断
- iPhone Safari 実機（20〜24px でのバター感、色）。**Owner の実機 HV の PASS は代筆していない。**
- 本体色の調整（`#fff1d2` → `#fff4e2`）の可否。
- 共有 Preview は更新していない（更新は Owner の明示承認が必要。操作確認用の検証データは、既存の `?cookPrepHv=1`（全 ladder 素材を所持した使い捨てのメモリ保存）が使える）。merge は Owner の HV と承認まで行わない。
