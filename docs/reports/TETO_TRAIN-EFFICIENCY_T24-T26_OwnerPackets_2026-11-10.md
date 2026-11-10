# T24〜T26 Owner 承認パケット — 実装前の判断事項一覧（#780、docs のみ）

2026-11-10 / 基準 main `577dcfd7`（レシピ 102／食材 117／ladder 87 step）。Owner 判断 E-1・E-2（2026-11-10）に基づく先行作成。**実装・HOT 編集・merge はしていない。** 各列車の全文パケット（機械生成、編集不可）とスペックは `docs/reports/data/TETO_TRAIN-EFFICIENCY/T2x.{spec.json,preflight.md}`。

- 暫定仕様・原典（pizzadb.jp）未確認。id・名前・数量・family は staged の暫定値（GAMEPLAY ASSUMPTION）。色・絵文字・Reference 配置・step 番号は実装 PR で決める（パケット §6）。
- #815（B23-b）merge 後に同じスペックで再実行し、差分があればこの表を更新する（cream-cheese・spice 系を共有する品は無いので、変化は見込んでいない【推論】）。
- **Research（R-RES-1、条件付き承認）**: 3 列車とも**正準順の変化は 0**。非正準は各パケット §4 に、ID・段（最後に入手する共有食材）・方向・最大ずれ幅を 1 行ずつ明示した。表に無い ID・段・方向、表より大きいずれは承認外で、実装 PR のテストが失敗して停止する。

## 判断件数

| 列車 | レシピ／新食材 | STOP | 判断件数 | 内訳 |
|---|---|---|---|---|
| T24 | 7／9 | 0 | **8** | 重複例外 5、複合食材 1、パック 1、Research 表 1（58 ID） |
| T25 | 6／8（cucumber は T24 と共有） | 0 | **10** | NO_SAUCE 4、late 配置 3、重複例外 2、Research 表 1（42 ID） |
| T26 | 3／0 | 0 | **8** | 新食材なしの扱い 3、NO_SAUCE 1、重複例外 2、パック 1、Research 表 1（33 ID） |
| 計 | 16／16 | 0 | **26** | ＋共通 1（暫定仕様値を B21〜B23 と同じ扱いにする） |

## T24 — 新食材つき・ソースあり（7 品、通常カタログ）

| # | 対象 | 判断 | 推奨 |
|---|---|---|---|
| 24-1 | `thai-chicken-pizza`（peanut-sauce） | 重複例外: bbq-chicken-pizza と Jaccard 0.5、reina-pepiada-pizza と 0.429 | 承認（ベースソースが別） |
| 24-2 | `pizza-asparagi-limone`（asparagus） | 重複例外: quattro-formaggi と 0.429 | 承認 |
| 24-3 | `frutti-di-mare-pizzadb`（squid） | 重複例外: pescatore と 0.5。id の `-pizzadb` を外すか | 承認。id は `frutti-di-mare`（D-4 の改名と同じ扱い） |
| 24-4 | `diavola-pizza`（spicy-salami） | 重複例外: bismarck・funghi・margherita・pepperoni・salsiccia と 1 材料差 | 判断（spicy-salami が新食材なので区別はつく。pepperoni との近さをどう見るか） |
| 24-5 | `south-african-boerewors`（chutney） | 重複例外: polish-kielbasa・spanish-chorizo-pizza と 1 材料差 | 承認（chutney が新ソース） |
| 24-6 | `peking-duck-pizza`（cucumber・peking-duck・sweet-bean-sauce） | 調理済み複合食材 peking-duck を 1 食材として出荷するか（I-3）。1 step で 3 食材を解放 | I-3 の暫定ルールどおり 1 食材 |
| 24-7 | mussel | ショップのパック 10→20（frutti-di-mare が 2 個使う）。価格は不変 | 承認（B22／B23-a と同じ条件: 購入・在庫テストの成功） |
| 24-8 | Research 非正準 58 ID | `T24.preflight.md` §4 の表（新設のみ 24、後ろへ最大 1〜2 が 34） | 表どおり承認 |

判断不要: `peruvian-aji-amarillo`（aji-amarillo はソース扱い）。

## T25 — late 配置・NO_SAUCE（チーズあり）（6 品）

| # | 対象 | 判断 | 推奨 |
|---|---|---|---|
| 25-1 | `banh-mi-pizza`（daikon・liver-pate） | NO_SAUCE（mozzarella あり）。原典のソースは未指定 | 原典調査の結果で決定。無ければ Owner の GAMEPLAY 判断 |
| 25-2 | `buffalo-cauliflower-pizza`（cauliflower） | NO_SAUCE（チーズあり）。buffalo-sauce（B22 で出荷済み）を使う案もある | buffalo-sauce をベースにする（NO_SAUCE を避けられる） |
| 25-3 | `mexican-elote-pizza`（lime） | NO_SAUCE（feta あり、mayo はトッピング） | NO_SAUCE（apple-cinnamon と同じ形） |
| 25-4 | `chicken-tikka-pizza`（chicken-tikka） | NO_SAUCE（チーズあり）。原典は未指定 | 原典調査の結果で決定 |
| 25-5 | `swedish-kebab-pizza`（kebab-sauce） | late 食材を使うので late カタログに置く | 承認（late） |
| 25-6 | `pizza-salad`（cucumber・yogurt-sauce） | 同上。cucumber は T24 の peking-duck が先に出荷 | 承認（late、T24 の後） |
| 25-7 | `banh-mi-pizza` | 同上（late 食材 carrot） | 承認（late） |
| 25-8 | `pizza-salad` | 重複例外: bambino と Jaccard 0.429 | 承認 |
| 25-9 | `chicken-tikka-pizza` | 重複例外: bbq-chicken-pizza 0.429、spanish-chorizo-pizza 0.5 | 承認（chicken-tikka が新食材） |
| 25-10 | Research 非正準 42 ID | `T25.preflight.md` §4 の表（新設のみ 28、後ろへ最大 1〜2 が 14） | 表どおり承認 |

25-1・25-4 は L3（原典調査）を先に走らせる。調査が間に合わない品は T25 から外して後続列車へ回す（上界が加法的なので、外しても残りの承認はそのまま有効）。

## T26 — 新食材なし（3 品、通常カタログ）

| # | 対象 | 判断 | 推奨 |
|---|---|---|---|
| 26-1〜3 | `nashville-hot-chicken-pizza`・`keema-pizza`・`nduja-pizza` | 新食材が無いので ladder の key レシピになれない（OD-REC04-1）。`ladderCredit: false` の追加レシピとして出すか | 承認（正準順の Research 変化は 3 品とも 0） |
| 26-4 | `keema-pizza` | NO_SAUCE（チーズあり）。原典は未指定 | 原典調査の結果で決定 |
| 26-5 | `keema-pizza` | 出荷済み 15 品の**部分集合**（curry 系ほか）。R-2 では原則不採用（D-DUP-1） | 判断（除外は目標の縮小になる。区別できる材料を足すか、例外承認か） |
| 26-6 | `nduja-pizza` | salsiccia・salsiccia-e-friarielli と 1 材料差（honey が違い） | 判断（nduja を sausage で代用している点も含む: NAME_SPECIFICITY_GAP） |
| 26-7 | pickles | ショップのパック 10→20（nashville が 2 個使う）。価格は不変 | 承認 |
| 26-8 | Research 非正準 33 ID | `T26.preflight.md` §4 の表（新設のみ 17、後ろへ最大 1〜2 が 16） | 表どおり承認 |

## 回答の形（1 回で返せるように）

「T24: 24-1〜24-8 を推奨どおり（24-4 は〔承認／外す〕）。T25: 25-2 は buffalo-sauce、25-3 は NO_SAUCE、25-5〜25-10 は承認、25-1・25-4 は原典調査後。T26: 26-1〜3・26-7・26-8 は承認、26-5・26-6 は〔承認／外す／材料を足す〕。」

承認された品だけでスペックを確定し、L1（HOT 保有 session）が #815 の merge・release の後に実装する。
