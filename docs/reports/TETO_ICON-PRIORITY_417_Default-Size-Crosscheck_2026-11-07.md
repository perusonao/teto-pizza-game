# T7 追補 — 「補正なし（既定 1em）」の完全突き合わせと、食材アイコン改善の優先順位（再整理）（docs-only、Refs #417）

2026-11-07、main `06cfc066`、branch `claude/teto-pizza-parallel-tasks-ylyfe5`。**読み取りのみ。** `src/`・CSS・golden・既存 docs は未変更。実装・PR・merge・Production ON・共有 Preview 更新なし。HV 対象外（docs-only、`TETO_HUMAN-VERIFICATION-POLICY.md`）。
ラベル: 【実測】= 今回 main のコードで確認、【引用】= 既存 docs、【推論】、【未確認】。

## 0. なぜこの文書か（重複させない）

T7 本体は別セッション（claim: #417 コメント 6703658614、`TETO_ICON-AUDIT_T7_*`、branch `claude/teto-pizza-t7-t9-audit-12by6f`）が完了済み: 監査（優先順位 P1〜P5 を含む）、補正値一覧、実機計測計画、HV チェックリスト。**その claim の名前空間は編集せず、別名で追補する。** 本書は、同セッションの `Size-Correction-Inventory` §6-2 が「着手時に確定」と残していた **既定 1em の完全突き合わせ**（未実施だった部分）だけを行い、優先順位を一画面に再掲する。

## 1. 突き合わせの結果【実測】

方法: `src/data/ingredients.ts` と `src/data/lateCatalog.ts` の `pieceVisual` を全抽出し、`src/App.css` の `.ingredient-glyph--<visual>` と照合。サイズクラスは `toppingSizeClass.ts`（ベース表＋late 表）。

- `ingredients.ts` の専用 SVG: **33 種**。`lateCatalog.ts`（Production OFF のレイトカタログ）の専用 SVG: **6 種**（cod-roe-mass, nori-strips, pomegranate-aril, salmon-roe-grains, sesame-seeds, wasabi-dab）。**6 種はすべて CSS に個別補正あり**。
- **CSS に個別の箱補正が無く、既定の 1em のまま描画される専用 SVG は 8 種**:

| 食材 id | visual | クラス | 箱（既定 1em） | ピザ上 px（28×rank） | RESULT px（×0.75） | 備考 |
|---|---|---|---|---|---|---|
| capers | caper-cluster | xs | 1.0em | 19.6 | **14.7** | xs の SVG で唯一 14.7px。T7 本体の「xs 実質 corn／parsley／mint」の記述に **capers も入る** |
| mayo | mayo-drop | s | 1.0em | 23.8 | 17.9 | |
| clam | clam-valve | s | 1.0em | 23.8 | 17.9 | |
| sausage | sausage-slices | m | 1.0em | 28.0 | 21.0 | |
| feta | feta-cubes | l | 1.0em | 32.2 | 24.2 | |
| ricotta | ricotta-mound | l | 1.0em | 32.2 | 24.2 | |
| ricotta-salata | ricotta-salata-shavings | l | 1.0em | 32.2 | 24.2 | |
| hot-dog | hot-dog-slices | l | 1.0em | 32.2 | 24.2 | |

- 箱 em は 64×64 の viewBox のうち絵が占める割合を反映しない。**8 種の充填率は未計測【未確認】**。箱の算出値だけで「小さい」とは言えない。
- 以上から、**補正済み＝本体 CSS に個別ルールあり**が 25 種（`ingredients.ts` の 33 − 8）、late 6 種を加えて 31 種。T7 本体の「`pieceVisual` を持つ 33 種のうち CSS に個別ルールがないものは既定」の完全一覧が上の 8 種。
- 【引用】T7 の算出式（`28px × rank × (RESULT 0.75) × 箱`）と、rank 倍率（xs 0.7 / s 0.85 / m 1 / l 1.15 / xl 1.3、`TOPPING_RANK_SCALE`）は変更なし。

## 2. T7 本体との差分・訂正候補

| # | 内容 |
|---|---|
| 1 | T7 監査 §3.1 は xs の未対応を「corn／parsley／mint（絵文字）」とするが、**SVG のまま 14.7px の capers も同じ水準**【実測】。優先順位 P2（I-2）の対象に capers を含めて判断すべき |
| 2 | 既定 1em の 8 種のうち、**xs は capers のみ、s は mayo・clam**。l の 4 種は箱が大きく、現時点で小ささの懸念は見えない【推論】 |
| 3 | 新規食材（walnut #777 の SVG 等）は未配線で、この表に入らない。B20-A で配線する際は **配線 PR で箱補正の要否を決める**（`walnutGlyph` は 64 箱で、xs/s/m のどのクラスになるかは B20-A の Owner 判断 4 に依存） |
| 4 | 新規食材追加時のチェック（Issue #417 Phase 7）に「`App.css` に箱補正が要るか」を加える提案。**提案のみ**で Style Lock は #770 が担当 |

## 3. 優先順位（T7 本体 §5 を再掲し、上記を反映。助言であり Owner 決定ではない）

| 順位 | 内容 | 変更点 |
|---|---|---|
| P1 | 実機計測の一括実施（コード変更なし。contact sheet を iPhone で判定） | 対象に **capers／mayo／clam の既定 1em を追加**。xs の RESULT 14.7px を 4 種（corn／parsley／mint／capers）で比較 |
| P2 | xs 絵文字 3 種＋capers の扱い（SVG 化・箱補正・xs 再分類のどれか） | capers を追加。判断は P1 の後 |
| P3 | 淡色 SVG の焼成後コントラスト | 変更なし。ricotta／feta は既定 1em の淡色で、箱補正と焼成の両面から P1 で見る |
| P4 | #771 ピーマン 1.45em の実機確認 | 変更なし |
| P5 | 補正の一覧表（本書＋ Inventory）と `--glyph-scale` 変数方式の設計メモ | 本書で一覧が完成。変数方式は HOT の `App.css` に触れるため別 claim |
| 保留 | チーズ SVG 化、mozzarella Canvas、全面置換 | Owner 判断待ち |

## 4. 実機計測の状況【引用】

Owner は iPhone Safari の計測を実施する意向（#417 コメント 6705391272: 空の保存の適用・復元が可逆と確認できるまで State Editor を使わない、herb SVG は現 Preview に無いので「利用不可」、#771 の結果チップに到達できなければ「未確認」）。**実機 HV は 0 PASS。** 本書の数値はすべて算出値。

## 5. Owner 判断事項

1. capers を P2（xs の扱い）の対象に含めてよいか — **推奨: はい**（P1 の contact sheet に追加するだけで、コスト小）。
2. P1 の contact sheet に既定 1em の 8 種を含めるか — **推奨: 含める**（箱補正の要否を同じ条件で比較できる）。
3. 新規食材追加チェックに「箱補正の要否」を加える提案を #770 に回すか — 推奨: 回す。
