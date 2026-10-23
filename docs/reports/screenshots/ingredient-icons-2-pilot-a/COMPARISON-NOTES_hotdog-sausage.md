# Pilot A (#438) — hot-dog / sausage 比較シートの注記

Issue #438（親 #417）。画像2枚と本注記だけの追加で、コード・Preview・他 PR には触れていない。
**Human Verification の判定（PASS / FAIL / 補正要）は未記録。Owner の iPhone Safari 実機確認まで記録しない。Pilot B は HOLD のまま。**

## 1. 画像

| ファイル | 内容 | サイズ | sha256 |
|---|---|---|---|
| `compare-hotdog-before-approx-vs-after-390x844.png` | hot-dog（`pizza-overload`）。上段 before（近似）／下段 after（main）。左から 焼成中 / 焼成後 / RESULT | 3022×1118、1,249,341 B | `29aa7ac2aad0ff316e322d7843c344891cf3ca5f5269735999520f4b0443dca9` |
| `compare-sausage-before-approx-vs-after-390x844.png` | sausage（`salsiccia`）。同じ並び | 3022×1118、1,080,601 B | `9be0be5be716d5d0c691f6181bae9448c51b6f6a92b233b6efea9abeac4e4294` |

出所: Claude Artifact `https://claude.ai/artifact/X4qj7WB2E8RQvStHxWbSBh` に埋め込まれていた画像を取り出したもの（元の PNG と同一バイト。元の撮影環境の scratchpad は失われている可能性があり、再撮影はしていない）。
整合性: 2枚とも PNG 署名と全チャンクの CRC が正しく、画像データの展開長が画素数と一致する。

## 2. before は近似であること（重要）

**before は Pilot A 直前の実コミットではない。** リポジトリが shallow で元の親コミットを取得できなかったため、main のコピーで4食材（hot-dog / sausage / feta / ricotta）の `pieceVisual` 行だけを外し、絵文字表示に戻して撮った**近似比較**である。
一方、feta / ricotta の既存シート（`../ingredient-icons-2-pilot-a-feta-ricotta-on-pizza/compare-390x844.png`）の before は実コミット（PR #503 の途中 HEAD `484a3e9`）。両者の before を同じ水準の証跡として扱わないこと。
撮影環境: main `aecf867` のコピー + Playwright Chromium、390×844、deviceScaleFactor 2。

## 3. 「焼成後」と「RESULT」の関係（画像と既存記録からの確認）

- **sausage（`salsiccia`）**: 別の画面状態。`salsiccia` は CUT 対象（`cookingProfiles.ts` の `CUT_ELIGIBLE_RECIPE_IDS`）で、焼成後のパネルは切り分けガイド（破線）つきの縮小表示、RESULT のパネルは切り分け後の大きな表示になっている。
- **hot-dog（`pizza-overload`）**: **視覚的にほぼ同じ状態で、独立した2つの証跡としては扱えない。** このレシピは CUT 対象ではなく（`EXPECTED_NOT_CUT_ELIGIBLE` に含まれ、工程は DOUGH / SAUCE / CHEESE / TOPPING）、切り分け表示で見分けることもできない。2つのパネル（焼成後 / RESULT）は同じ大きさと位置で、ピザ上の具材の位置も同じ。違いは全体にわずかに暗いこと（RGB の平均で約 −2〜−4 / 255）だけ。バイト一致はしない。
- ただし、元の撮影スクリプトと撮影記録は手元になく、2つのパネルが実際に別の画面（焼成後の画面と RESULT 画面）だったかは**この画像だけでは確定できない**。確認が必要なら Owner の実機で見る。
- hot-dog の焼成後・RESULT に関する判断は、Owner の実機確認の項目（「ピザ上 → 焼成後 → RESULT」）に残す。

## 4. 比較証跡として使用しないもの

`before-390x844-cheese-tray.png` と `after-390x844-cheese-tray.png`（同フォルダ）は**同一バイト**（sha256 先頭 `db6b8896d49f957d`）。変更を示す比較証跡として使用しない。チーズトレイで feta / ricotta が SVG になったかを確認するには、実機または撮り直しが要る。

## 5. 画像で確認できないこと（実機が必要）

20〜48px での hot-dog / sausage の区別（赤背景・グレースケール）、チップ幅・タップ領域・family filter 行の操作感、接地影とサイズ補正の要否、Research / Hint / Notebook / Dex への混入、NEW / locked / disabled / selected。チェックリストは Artifact を参照。
