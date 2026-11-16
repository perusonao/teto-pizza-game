# Batch 25 — iPhone HV 用の資料（比較画像・専用 Preview 情報）

状態: **共有 Preview は更新していません（禁止）。PR 専用 HV ページも作っていません。** 以下は、Owner が手元（ローカル）か、Owner の指示で用意する専用 Preview で確認するための情報です。HV の動画（390×844）は、HV Policy に従って Owner に直接渡す成果物で、リポジトリには入れません（このセッションでは撮影できません）。

## 1. 専用 Preview の入口（HV シード）
- 仕組み: `?hv=<id>` で、対象 recipe の材料だけ未購入の保存を作り、Shop が NEW を出す状態から始める。**Preview ビルド（`VITE_PREVIEW_MODE`）か dev のときだけ**有効。本番ビルドには含まれない（`previewIsolation.gate.test.ts` が検査）。保存は Preview 用のキーに限られ、本番の保存と Firebase には触れない。
- ローカルでの起動（確認済み）: `VITE_PREVIEW_MODE=1 npx vite --port 5190`、iPhone 幅 390×844 で開く。

| シード | 対象 | 開始状態（実測） |
|---|---|---|
| `?hv=t25-buffalo-cauliflower-pizza` | T25-1 バッファローカリフラワーピザ | Shop に NEW が 1 件（カリフラワー）、2000 Pitz、図鑑 115/116 |
| `?hv=t25-swedish-kebab-pizza` | T25-2 スウェディッシュケバブピザ | kebab-sauce から |
| `?hv=t25-banh-mi-pizza` | T25-3 バインミーピザ（**HOLD 中の行**） | 大根・レバーパテから |
| `?hv=t25-mexican-elote-pizza` | T25-4 メキシカンエロテピザ（**HOLD 中の行**） | ライムから |
| `?hv=t25-pizza-asparagi-limone` | T25-5 ピッツァ・コン・アスパラージ・クルーディ・エ・リモーネ（**HOLD 中の行**） | アスパラガスから |
| `?hv=t25i7-pizza-salad` | T25I7-1 ピザサラダ | Shop に NEW が 1 件（ヨーグルトソース）、2000 Pitz、図鑑 115/116 |

注意: swedish-kebab・banh-mi・elote・asparagi は M-2 で未承認（HOLD）。HV で見た目と操作を確認することはできるが、**HV の結果は、その行の承認の代わりにはならない**。

## 2. 比較画像（リポジトリ内、実画面または実描画）
| 目的 | ファイル |
|---|---|
| D-2: cauliflower と chicken の選択用／配置用の描画 | `docs/reports/screenshots/b25-d2-cauliflower-vs-chicken/cauliflower-vs-chicken.png` |
| B-1: kebab-sauce の色と、近い既存 sauce との比較 | `docs/reports/screenshots/b25-kebab-sauce-color/kebab-sauce-color-options.png` |
| 実画面（WebKit 390×844）: Shop の NEW、Research 入口、トレイ、ソース塗り後、具材、焼成後の FINISH、NEW DISCOVERY、図鑑 | `docs/reports/screenshots/batch25-hv/`（cauliflower・swedish-kebab・pizza-salad、各 9〜12 枚） |
| 専用 Preview のシード起動直後の Shop | `docs/reports/screenshots/batch25-hv/preview-seed-*-shop-390x844.png` |
| トレイのチップと、ピザ上の駒の拡大 | `docs/reports/screenshots/batch25-hv/compare-parts/` |

## 3. iPhone 実機で見てほしい点（自動検証では判断できないもの）
1. **ヨーグルトソースの 1 回タップの見え方**: 1 タップ・0.02 の「点」は、クリーム色の生地の上で、画面上ほぼ見えない（`t25i7-pizza-salad-sauce-painted` の画像で確認）。ソース工程が完了したことが、プレイヤーに伝わるか（チップの状態・ヒントの文言「モッツァレラをのせてみよう！」で足りるか）。
2. **D-2 の差別化**: トレイ上とピザ上で、カリフラワーの floret が、チキン（絵文字）と取り違えにくいか。落下形状・配置位置はチキンと同じ（`HEAVY_SQUASH`、同じ 2 か所）。
3. **kebab-sauce の色**: tomato／buffalo／curry-ketchup と並べたときの識別（ΔE 約 20〜21）。ソースを塗った後の皿の上で区別できるか。
4. 長押し・ドラッグ・再タップで、ヨーグルトが増えない／塗り広がらないこと（自動検証済み。手の感触の確認）。
5. 360×800 でのはみ出し（自動検証済み。実機での確認）。
