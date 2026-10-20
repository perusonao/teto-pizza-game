# PIZZA DB 原典タイミング証跡 — しらすピザ / いくらとサーモンのピザ

Docs/data-only。コード・既存 `shirasu-pizza`・PR #584（HOLD）は変更しない。反映先は
`docs/reports/data/TETO_PIZZADB_172_MASTER-EVIDENCE.json` の `recipeRows[].sourceTimingEvidence`（新規 optional）。

## 確認範囲（誰が何を確認したか）
- **取得者: ChatGPT**（2026-10-20、個別ページ取得）。Owner 本人の確認ではない。
- **Claude Code は ChatGPT 経由で受領しただけ**。pizzadb.jp には到達できず（ENOTFOUND）、独立再取得は未実施。
- `independentlyVerified: false` の意味 = Claude Code も Owner も原典を再取得していない。
- 原文として受領したのは下表の短い引用のみ。それ以外は中継された要約。

## ikura-salmon（https://pizzadb.jp/pizzas/ikura-salmon/）
| 区分 | 内容 |
|---|---|
| 引用 | 「いくらと大葉は焼成後に載せ」（いくら・大葉 = 焼成後） |
| 要約（中継） | サーモンは「載せて焼く」方法と「別に加熱する」方法の両方の記載。単一タイミングではない |
| 原典に明記なし | クリームチーズ: 投入時機の明記を確認できず |
| 未受領 | サーモンの原文、分量・温度・焼成時間 |

## shirasu-pizza（https://pizzadb.jp/pizzas/shirasu-pizza/）
| 区分 | 内容 |
|---|---|
| 引用（質問箱） | 「仕上げにレモンを絞る」— 絞る動作の記述。**レモン piece の POST_BAKE とは同一視しない** |
| 引用 | 「仕上げ数分前にのせる」— しらす。焼成後とは断定されない（焼成末期の可能性） |
| 原典に明記なし | 大葉: 投入時機の明確な指定なし |
| 未受領 | モッツァレラのタイミング、前後の原文、分量・温度・焼成時間 |

## ゲーム側の設計値（原典ではない）
個数・bake・ピース数は GAMEPLAY CALIBRATION。shirasu: mozzarella 2 / lemon 2 / shiso 1 / whitebait 3、
ikura: cream-cheese 2 / salmon 3 / salmon-roe 2 / shiso 1、bake 58–78、8 ピース。
現行ゲームでは両レシピとも全食材が焼成前（ikura は #584 で HOLD、`applicationPhase` なし）。

## 差異と対応案（本 PR では実施しない）
- 既存 shirasu: 大葉は指定なし、レモンは「絞る」のみ、しらすは焼成後と断定されず → 変更根拠なし。維持。
- ikura: いくら・大葉は POST_BAKE の根拠あり。サーモンは両方式、クリームチーズは未記載のため焼成前維持が既定案。
  #584 は FINISH 有効化まで HOLD。再開時の ladder step は main で採番（55 固定しない）。

## 互換性確認
- 追加は 2 行への新規キーと top-level の説明キー 1 つのみ。既存フィールドの削除・変更なし。
- 読み取り側 `tools/progression2_mechanic_matrix.py` は行を名前で参照。再生成結果は変更前後で完全一致（diff 同一）。
- `tools/progression2_full172_deadlock_analysis.py --check` 正常。
- 既知（本 PR 無関係）: `progression2_mechanic_matrix.py --check` は main 時点で既に
  GAME-DESIGN-CANDIDATE_MATRIX.json の再生成差分で FAIL（本変更の有無で結果同一）。
