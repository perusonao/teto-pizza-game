# TETO FULL-EXPANSION 177 — PR #788 merge・Owner 判断 D-1〜D-7 の適用・最初の昇格候補（taco・okonomiyaki）の準備 Result（#780）

2026-11-08 / 基準 main = **`44460cb`**（PR #788 の squash merge `c458bf3` の後に PR #783 Batch 19 が merge された main。本書の数値はすべて `44460cb` 上で再測定。§0.1）。Owner 判断（2026-11-08）: PR #788 の Final Gate を満たせば merge 承認。D-1〜D-7 を適用。taco・okonomiyaki を実装可能な状態まで準備。**HOT ファイルの変更・本番昇格・Production ON・共有 Preview 更新はしていない**（いずれも別途 Owner 承認が必要）。

凡例: 【実測】テスト・スクリプトの出力（golden に固定）、【推論】解釈。判断の適用は staged データを変更しない「記録された状態」で、除外・改名・昇格は何もしていない。

## 0. 結果（実測）

| 項目 | 値 |
|---|---|
| PR #788 | Final Gate 5 条件をすべて確認して merge（`c458bf3`、squash、head `f06ffa8` を指定） |
| 依存（重複計上 24 を除く） | **383** |
| D-1〜D-7 とルールで解決 | **33**（ルール 11・D-4 14・D-5 8） |
| 判断済みで作業だけ残る | 9（新ソース 2・ID 改名 7） |
| **残件** | **350** |
| うち追加の Owner 判断が要る | **116**（D-1 の個別判定 76 件＝39 品、その他 40） |
| うち原典調査・確認待ち | 34（D-2 ソース 22・D-3 唐辛子 12） |
| うち工程・in-flight・生地軸・staged 同士 | 58・9・30・94（判断ではなく実装順・候補選択で解消） |
| **次に昇格可能なレシピ** | **5**（taco・okonomiyaki・pizza-finocchi-salad・pizza-cavolo-carote・black-truffle-pizza）＋ ID 改名だけ残る 1（buffalo-chicken） |
| D-6 で昇格停止 | 26 品 |
| 最初の昇格候補 2 品の確認 | 8 項目すべて合格（§3）。本番昇格の前に Owner 承認が要る項目は §4 |

### 0.1 PR #783（Batch 19）の merge を取り込んだ再測定【実測】

本 PR の作成後に PR #783 が main に merge された（`44460cb`、burrata・pesto-burrata-pizza・pizza-alla-crudaiola が本番カタログに入り、staged 側も #783 で整合済み）。本ブランチに main を merge（履歴の書き換えなし、テキスト競合なし）し、すべて再測定した。変化は Batch 19 の出荷によるものだけ:

| 項目 | 前（`c458bf3` 基準） | 後（`44460cb` 基準） | 理由 |
|---|---|---|---|
| 依存（重複計上を除く） | 383 | 383 | — |
| in-flight 待ち | 10 | 9 | burrata-pizza の burrata 待ちが解消 |
| D-1 の個別判定 | 75 件・38 品 | 76 件・39 品 | burrata-pizza が出荷済みの pesto-burrata-pizza・pizza-alla-crudaiola と重なる |
| 追加の Owner 判断 | 115 | 116 | 同上 |
| D-6 の昇格停止 | 25 品 | 26 品 | burrata-pizza が単独で出荷済みの Research 文字を変える（Research 原因表は #783 で再測定済み、出荷済み 21 品・原因 26 品） |
| 次に昇格可能 | 5＋1 | 5＋1（同じ） | — |
| taco・okonomiyaki の Research 非正準順 | 15 品 | 17 品 | pesto-burrata-pizza・pizza-alla-crudaiola が加わる。**正準順は 0 のまま** |

## 1. PR #788 の Final Gate と merge【実測】

| 条件 | 結果 |
|---|---|
| HEAD | `f06ffa82002b7bd8e34fd9863d071f59b0497fde`（変化なし） |
| CI | 11/11 success（WebKit 360×800 shard 2/3 の `gestures-helper.spec.ts:153` は 1 回目のみ失敗、1 回の再実行で成功。#394 と同系統） |
| Codex（最新 HEAD） | `f06ffa8` で指摘 0（手動依頼の結果に加え、Draft 解除で自動起動したレビューも完了を待ち、指摘なしを確認してから merge） |
| 未解決スレッド | 0（2 件とも解決済み） |
| mergeable | clean |
| 本番のビルド内容 | `vite build` の dist 16 ファイルが main `4348e27` と SHA-256 で一致（別 worktree で main をビルドして比較） |
| merge | `expectedHeadSha=f06ffa8` で squash → `c458bf3` |

PR #783・B20-A・他の PR は merge していない。merge 順序（PR #783 → B20-A → 昇格）は維持。

## 2. D-1〜D-7 の適用（`src/data/staged/stagedOwnerDecisions.ts`、golden `__golden__/decisions.json`）【実測】

| 判断 | 適用 | 結果 |
|---|---|---|
| D-1 一括除外の禁止・個別判定の準備 | 例外 39 品は除外せず、品ごとに「出荷済みとの重なりの種類と相手」「区別に使える工程差（M1〜M6・後乗せ）」を並べた資料を作成 | 39 品のうち工程差あり 21・工程差なし 18。D-6 でも止まっている品 19（資料は golden の `d1Dossier.rows`） |
| D-2 ソース 22 品は原典調査 | R-1 の 22 件を SOURCE_RESEARCH に。NO_SAUCE の確定は 0 件（テストで固定） | 22 件が原典調査待ち |
| D-3 唐辛子 7 件を共通候補に | 7 トークン（唐辛子 5・赤唐辛子 1・青唐辛子 1）と、それだけが残っていた R-7 の 5 件を 1 つの候補「chili-pepper（未確定）」にまとめた。`chili-oil` は使っていない（テストで固定） | 12 件が確認待ち |
| D-4 PIZZA DB 版を暫定基準、ID は参照整合性の検証後 | R-5 の 14 件を暫定解決。接尾辞を外した ID 7 件を検証: 出荷済み・staged・in-flight の ID と衝突なし、staged 以外のソースからの参照なし（`src/` を検索） | R-5 14 件解決、ID 7 件は「改名可（作業残り）」。改名はまだしていない |
| D-5 生の葉物・柑橘は原則後乗せ | 後乗せ解釈（R-6）のサラダ系で、葉物（lettuce・arugula・spinach・chicory・puntarelle・radicchio・cabbage・red-cabbage）と柑橘（lemon・orange・lime）を後乗せに。材料そのものの調理法（PREP・FRY・焼成中）がある場合はそちらを優先 | 8 品で解決（asparagi-limone・carciofi-salad・finocchi-salad・cavolo-carote・zucchine-menta・cicoria-limone・puntarelle・radicchio-noci）。lahmacun は葉物・柑橘が無く Owner 判断のまま |
| D-6 Research 正準順の変化は未承認 | 原因の品を「昇格停止」に（Batch 19 の出荷後は出荷済み 21 品・原因 26 品） | 26 品は他の依存が全部解けても昇格対象にしない |
| D-7 taco・okonomiyaki が最初の候補 | §3 の準備 | 2 品とも昇格可能（Owner 承認待ち） |

**残件の内訳（350）:** EXCEPTION_REVIEW 76・OWNER_DECISION 40・SOURCE_RESEARCH 22・CANDIDATE_PENDING 12・WORK 9・WAITS_MECHANIC 58・WAITS_IN_FLIGHT 9・AXIS_WITH_M1 30・STAGED_PAIR 94。
OWNER_DECISION 40 の内訳: R-7（唐辛子以外の未解決食材）11・未解決トークン 12・R-8 8・R-3 HOLD の重複 6・R-3 HOLD 2・R-6（lahmacun）1。

**次に昇格可能なレシピ（D-6 で止まっていない、全依存が解決済み）:** taco-pizza・okonomiyaki-style-pizza・pizza-finocchi-salad（orange を後乗せ、D-5）・pizza-cavolo-carote（lemon・red-cabbage を後乗せ、D-5）・black-truffle-pizza（D-4 で PIZZA DB 版）。改名だけ残る buffalo-chicken-pizzadb（→ buffalo-chicken）。後ろの 4 品は §3 と同じ確認（Research の非正準順・Hint・保存・アイコン）をまだしていない。black-truffle は truffle の形（スライス／オイル）が未決（食材監査の注記）。

## 3. taco・okonomiyaki の準備（`src/data/staged/stagedPromotionCandidates.ts`、テスト `stagedPromotion.firstTrain.test.ts`）【実測】

置き場所: **late カタログ**。taco は後乗せの付け合わせがあり、okonomiyaki は late カタログにしかない `nori` を使う（通常のレシピは late 専用の食材を要求できず、late のレシピは後乗せの材料が必須。`validateLateCatalog`）。前例は bbq-chicken-pizza と tarako-cream-pizza（nori を後乗せ）。

| | taco-pizza | okonomiyaki-style-pizza |
|---|---|---|
| 材料と数量（暫定。原典 pizzadb.jp 未確認） | tomato-sauce 1（塗る）／cheddar 2／beef 3／fresh-tomato 2／lettuce 2（後乗せ）／tortilla-chips 2（後乗せ） | okonomiyaki-sauce 1（塗る）／cabbage 3／pork 3／mayo 1／bonito-flakes 2／nori 1（後乗せ） |
| 根拠 | matrix の行（salsa→tomato-sauce、ground-beef→beef は I-1、後乗せは matrix の post_bake の証拠） | matrix の行。「青のり」→ nori（R-7）。キャベツは料理の中で焼くので後乗せにしない（D-5 の「固有調理法」）。チーズは行に無いので足さない |
| 調理工程 | 生地 → ソース → チーズ → 具材 → 焼く → 仕上げ（後乗せ） | 生地 → ソース → 具材 → 焼く → 仕上げ（後乗せ） |
| 焼き・報酬・その他 | 58〜78、100 Pitz、Lunch Rush なし、CUT なし、late の 1 段 | 同左 |
| 新しい食材 | cheddar（チーズ）・lettuce・tortilla-chips | okonomiyaki-sauce（ソース）・cabbage・bonito-flakes |
| アイコン | 文字の代替表示: 🔶・🪴・🔺（他の食材と重複なし）。専用 SVG はまだ無い（#417 の線） | 🍶・🥬・🪶（重複なし）。専用 SVG なし |
| Hint 5.0 | key-free。段: ソース・チーズ・構成・分類×4 | key-free。段: ソース・構成・分類×5（チーズの段なし） |

確認（本番の関数をテスト内の mock で「出荷済み＋この 2 品だけ」に対して実行）:

| 確認 | 結果 |
|---|---|
| 出荷済みの late カタログと合わせた構造（`validateLateCatalog`） | 問題 0 |
| 材料の参照・後乗せはトッピングだけ・数量が出荷済みの範囲内・ソース 1 つ・新食材がすべて使われる | 合格 |
| アイコンの代替表示の重複（G18） | 6 種とも重複なし |
| 重複ゲート（同一・部分・上位集合・1 材料差・Jaccard > 0.4） | 出荷済みとも、2 品どうしも **0 件** |
| Research 正準順（既存の ladder ＋ 2 つの新しい段） | 出荷済みの文字の変化 **0**（停止条件に当たらない） |
| Research 非正準順（Batch 18/19 と同じシナリオ） | 出荷済み 17 品で変化あり（§4 Q-2） |
| Hint 5.0 | 2 品とも対象。出荷済みの ladder への影響なし（key-free で他のレシピを参照しない） |
| 保存安全性 | 昇格後は新しい ID の図鑑・所持・在庫が読み込みで保持される。既存の保存はそのまま読める。読み込みで書き込みなし |

## 4. 本番昇格の前に Owner 承認が必要なこと（まとめて、推奨つき）

| ID | 内容 | 推奨 |
|---|---|---|
| Q-1 | 2 品を late カタログに置く（okonomiyaki は nori を後乗せ）。代案は nori を通常食材へ昇格（Batch 18 の cilantro の前例） | late カタログ（変更が late の表だけで済む） |
| Q-2 | Research 非正準順で文字が変わる出荷済み 17 品（baingan-bharta・california-style・chilean-napolitana・cuban・goulash・nigerian-suya・pesto-burrata・pesto-caprese・pizza-alla-crudaiola・pizza-feta-eliniki・porchetta・potato-mayo・reina-pepiada・rendang・tarako-cream・veggie-supreme・wasabi-beef）の ID ごとの承認（Batch 19 の AC-8 と同じ扱い） | 正準順は 0 なので承認（全件 `__golden__/firstTrain.research.json`） |
| Q-3 | 暫定の数量・名前・説明・色・代替表示（§3 の表） | 承認。専用 SVG は #417 の線で後から |
| Q-4 | 昇格 PR で編集するファイル（`PROMOTION_TOUCHES`: `lateCatalog.ts`・`recipeHintRoles.ts`・`recipeSauceProfiles.ts`・`referencePizza.ts`・`catalogLedger.test.ts`・golden、必要なら HOT の `recipes.ts`） | PR #783 → B20-A の merge 後に 1 本の PR で。H-1 どおり全品自動テスト＋代表の実機 HV |
| Q-5 | 次の候補（finocchi-salad・cavolo-carote・black-truffle、改名後の buffalo-chicken）に同じ確認を進めるか | 進める（truffle の形は先に決める） |

## 5. テスト（実測）

- `src/data/staged`: 10 ファイル。staged・FRY・Pinsa ガードを合わせて 20 ファイル 158 件合格・3 skip。Pinsa OFF 版: 25 合格・5 skip（golden は Pinsa ON で測定）。
- `tsc -b`・`oxlint`: エラー 0。
- 全 Vitest・`vite build` の dist 比較: PR 本文に記載。

## 6. 状況

- **完了**: PR #788 の Final Gate 確認と merge、D-1〜D-7 の適用（データ変更なし）、残件の再集計、taco・okonomiyaki の昇格形の準備と 8 項目の確認。
- **未完了**: 本番昇格（承認待ち）。D-2 の原典調査。D-1 の個別判定（39 品、資料は準備済み）。次の候補 4 品の詳細確認。
- **ブロッカー**: §4 の Q-1〜Q-5。HOT ファイルを触る昇格は B20-A の merge 後（PR #783 は merge 済み）。
- **次の行動**: Owner 承認を受けて、PR #783 → B20-A の後に taco・okonomiyaki の昇格 PR を作る。
