# Ingredient Icons 2.0 — #733 / #739 の候補 SVG（比較用。牛肉 B・ピーマン R1 を採用）

Status: **比較用の候補。** Owner 決定（2026-11-05、Issue #733 comment 6650361079）で `beef-b-seared-chunks.svg`（牛肉）と `green-pepper-r1-rings.svg`（ピーマン）を採用し、#733 の実装 PR で `src` に移植した（visual ID は据え置き）。他の案は採用されていない。
比較と推奨: 調査ブランチ `claude/teto-pizza-ingredient-icons-q7c1je`（commit `be64b35`）の `docs/reports/TETO_INGREDIENT-ICONS_733-739_Design-Comparison_Result.md`。実装の Result: [`docs/reports/TETO_ISSUE-733_ICONS_Result.md`](../../../reports/TETO_ISSUE-733_ICONS_Result.md)
Parent: #417。対象: #733（牛肉・ピーマン）、#739（梅肉・しらす）。

## 共通仕様（Style Lock v2 §2）
- `viewBox="0 0 64 64"`、透明背景、接地影の楕円つき
- `id` / gradient / `<defs>` / `url(#` は使わない（確認済み）
- 輪郭は 2〜2.8、2 トーン。`*-current.svg` は main の描画をそのまま書き出したもの（比較の基準）

## ファイル

| ファイル | 食材 | 案 | 狙い |
|---|---|---|---|
| `svg/beef-current.svg` | 牛肉 | 現行（main `beef-slices`） | 基準。赤茶の帯 2 本＋白い脂の線（ベーコン 🥓 と同じ語彙） |
| `svg/beef-a-marbled-sheet.svg` | 牛肉 | A 霜降りの薄切り | 1 枚の肉に白い網目の霜降り |
| `svg/beef-b-seared-chunks.svg` | 牛肉 | B 角切り＋断面 | 焼けた外側と赤い断面の角切り 3 個。帯と円のどちらとも違う形 |
| `svg/beef-c-seared-strips.svg` | 牛肉 | C 細切り＋焼き目 | 現行の形のまま、脂の線をやめて焼き色・網目・黒こしょうにする |
| `svg/green-pepper-current.svg` | ピーマン | 現行（main `green-pepper-strips`、GP-A2） | 基準。緑の弧 3 本 |
| `svg/green-pepper-r1-rings.svg` | ピーマン | R1 輪切り×2 | 4 つのふくらみがある輪切り 2 枚。中が空いているので、生地が見える |
| `svg/green-pepper-r2-ring-strip.svg` | ピーマン | R2 輪切り＋細切り | 輪切り 1 枚と細切り 1 本（GP-A2 の語彙を残す） |
| `svg/umeboshi-current.svg` | 梅肉 | 現行（main `umeboshi-paste-dab`、#740） | 基準。ペーストに梅の花（scale .42） |
| `svg/umeboshi-u2-big-blossom.svg` | 梅肉 | U2 梅の花を拡大 | 花を .42 から .60 に拡大して、20〜26px でも花と分かるようにする |
| `svg/umeboshi-u3-fruit-and-paste.svg` | 梅肉 | U3 梅干し一粒＋ペースト | しわのある梅干しの実 |
| `svg/whitebait-current.svg` | しらす | 現行（main `whitebait-school`、#740 案 D） | 基準 |
| `svg/whitebait-w2-silver-back.svg` | しらす | W2 背の線を濃く | 背の線を濃く太く、目を大きくする（形と大きさは同じ） |
| `svg/whitebait-w3-four-fish.svg` | しらす | W3 4 匹 | 小さめの 4 匹で「群れ」に見せる |

比較シートと実画面の仮合成は、調査ブランチの `docs/reports/screenshots/ingredient-icons-733-739/` にある。
