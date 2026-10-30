# Pilot D（PR #701）改善案の調査 — サーモン / クリームチーズ

対象: PR #701、HEAD `3a2149c4d2c8e2f3e2b4fd098b9c779c0762721e`。**調査のみ。PR #701 のコード・共有 Preview・#468 は変更していない。** 候補は docs 用の SVG で、本番コードではない。iPhone Safari 実機 HV の合否は Owner が判断する。

比較画像（20 / 24 / 28 / RESULT≈29px、焼成後・焼き過ぎ・トレイのチップ・グレースケール、DPR 3）:
- `docs/reports/screenshots/ingredient-visual-pilot-d-improvement/compare_salmon_20-24-28-result.png`
- `…/compare_cream-cheese_20-24-28-result.png`
- 候補 SVG: `…/candidates/`
焼き過ぎ列は実装の焦げフィルタ（topping: brightness .78 / saturate .8 / sepia .2、cheese: brightness .6 / saturate .75 / sepia .25）を再現。実ゲームの焦げ生地・ソースの色は近似。

## Style Lock 上の区分（§0-7(c)、§1c、§10.3-1）
Pilot D は「デザインを変更しない」前提で承認済み。**形・色の変更は Owner の明示承認が必要**（§1c）。

| 区分 | 内容 |
|---|---|
| Lock 範囲内 | 美術（SVG）を変えない調整。S1 のみ |
| Owner 承認が必要 | SVG の形・色を変える案すべて（S2 / S3 / S4、C1 / C2 / C3） |

## サーモン
現行（S0）: 20〜29px で切り身に読め、いくらとも別物。弱点は**焼き過ぎ**（暗い茶の輪郭が焦げ生地に埋もれ、縞が薄くなる）と、形が楕円で「握りのネタ」にも見えること。

| 案 | 内容 | 区分 | 所見 |
|---|---|---|---|
| S1 | 美術は不変。焼き過ぎのときだけ、`.pizza-dough--burnt .ingredient-glyph--salmon-fillet` に淡い光彩（drop-shadow）を CSS で足す | Lock 範囲内（見た目の変化はあるため Owner への事前共有を推奨） | 焼き過ぎで輪郭が分離する。通常の見た目は変わらない。光彩がやや滲んで見える。`App.css` 1 規則。ピースが `.pizza-dough` の子で `--burnt` が付くことは DOM の構造から読めるが、実描画での確認はしていない |
| S2 | 外周に淡い縁取り（#fff1e4、太さ 6.6）を足す | 要承認 | 焼き過ぎの視認性が最も上がる。ただし通常の焼成後にも白い縁が出て「シール」風になり、他のアイコンと語彙が合わない |
| S3 | 切り身のスラブ形に変更（台形に近い厚み、下辺に銀の皮、斜めの脂の縞） | 要承認 | 握りのネタから離れ、切り身 / ステーキに読める。焼き過ぎでの視認性は現行と同程度 |
| S4 | 縞を太く・明るく（#fff3ea）、肌色を少し明るく | 要承認 | 改善は小さい |

**推奨:** まず現行のまま実機 HV に進む。焼き過ぎ（失敗カード）の視認性を直したい場合は **S1**（承認の負担が小さい）。形を直したい場合は **S3 に細い縁取りを足す案**を、別 PR の Pilot D2 として Owner が判断する。S2 単独は語彙が合わないため非推奨。

## クリームチーズ
現行（C0）: 青みのある銀紙の箱。ブロックとして読めるが、小さいとグレーの「缶 / 箱」に見え、食品らしさが弱い。

| 案 | 内容 | 区分 | 所見 |
|---|---|---|---|
| C1 | 温かい白のブロック＋下半分だけ銀紙（むきかけ） | 要承認 | 「箔に包まれたチーズ」と読めて食品らしい。形は現行に近い。ピザ上・トレイのチップ・グレースケールのいずれでも feta / ricotta と別 |
| C2 | 温かい白のブロック＋切り身 | 要承認 | 最も食品らしいが、20px で切り身が潰れ、feta（角切り）に近づく |
| C3 | 形は現行のまま、色だけ温かい白に | 要承認（変更は最小） | 缶感は消える。トレイのチップ（クリーム背景）では地との差が小さく、輪郭だけが頼り |

**推奨:** **C1**。理由: 銀紙の「包まれたブロック」という Style Lock の意図（A 案）を残しつつ、食品として読める。形がほぼ同じなので、ほかの白いチーズとの区別も保てる。最小の変更で済ませたい場合は C3。

## 共通の注意
- 美術を変えても、`pieceVisual` の名前や食材の id は変わらないため、`lateCatalog.offSurface.json` の digest は変わらない見込み（変更後にテストで確認が必要）。
- PR #701 へ変更を足すと、CI（WebKit 6 シャードを含む）の再実行と、Codex の再レビュー（現在の receipt は HEAD `3a2149c` に対するもの）が必要になる。Preview も #701 の新しい HEAD に更新しないと、実機 HV の対象とずれる。
- 変更するなら、#701 を現行のまま実機 HV で判定してから、別 PR（Pilot D2）で行うほうが安全。

## Codex レビュー（再確認）
- 要約コメントは `status: completed`（2026-10-29 18:42Z）。続けて、受領コメント「Didn't find any major issues」（comment 6505350524、18:42:23Z）がある。再依頼（18:38Z）の後で、HEAD は `3a2149c` のまま変わっていない。
- 注意: 要約コメントの `commit_sha` は null で、受領コメントは SHA を明記していない。SESSION-OPERATIONS §2 の「現在の HEAD に対する receipt」は、時系列（再依頼後・HEAD 不変）から満たすと判断するが、Owner が必要なら、最後に確認してほしい。
- review thread は 0 件、submitted review も 0 件。

## PR #701 本文の古い記述と更新案
| 現在の記述 | 事実 | 更新案 |
|---|---|---|
| 「Owner の iPhone Safari 実機 HV（V1-LAN 方式）と最終承認まで merge しない」 | HV は共有 Preview を #701 `3a2149c` に切り替えて行う（Owner 決定）。V1-LAN は使っていない | 「…実機 HV（共有 Preview `?cookPrepHv=1`）と最終承認まで…」 |
| 「共有 Preview は上書きしていない」（未確認・Owner 判断） | 2026-10-29 18:35Z に Owner 承認のもと #701 へ切り替え済み（直前は #697 `8ba2b5b`）。HV 後も #701 のまま維持する方針 | 「共有 Preview は Owner 承認で #701（`3a2149c`）に切り替え済み。直前は #697（`8ba2b5b`）。維持するかは次回利用時に判断」 |
| 「iPhone Safari の描画（V1-LAN 方式）」 | 同上 | 「iPhone Safari の描画（共有 Preview）」 |
| Codex の記述なし | Codex は完了・指摘なし（上記） | 「Codex: 2026-10-29 18:42Z『Didn't find any major issues』（HEAD `3a2149c`）」 |
| CI の記述は検証欄のみ | HEAD の CI 11 件すべて success、`mergeable_state` は clean | 「CI（HEAD `3a2149c`）11/11 success」 |
| Visual HV の記述なし | 自動撮影の Visual HV を実施（実機ではない） | 「自動撮影 Visual HV: branch `claude/teto-ingredient-visual-audit-a401jy`（`c9ea8135`）。実機 HV の代替ではない。8 項目中 PASS 5、要確認 3（焼き過ぎのサーモン、完全な重なり ほか）」 |

リポジトリの `docs/reports/TETO_INGREDIENT-VISUAL_PILOT-D_Result.md` にも同じ V1-LAN の記述（§5 の 5、§6）が残っている。更新するなら #701 への commit が必要なため、Owner の承認を待つ（CI・Codex への影響は上記）。

## 制約の遵守
PR #701 へのコード変更なし、本番 merge・deploy なし、Preview の再更新なし、#468 変更なし、Monitor 作成なし、HV の PASS の代筆なし。
