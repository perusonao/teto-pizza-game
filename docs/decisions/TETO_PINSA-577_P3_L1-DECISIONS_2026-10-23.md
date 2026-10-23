# #577 Pinsa Romana P3 — L1 採用と段階実装の決定記録（docs-only）

Status: **決定の記録のみ。** ゲームコード・テスト・データ・CSS・本番スイッチ・共有 Preview は変更していない。**P3-b（Pinsa のデータ本体）は HOLD のまま。** 本番の FINISH（`FREE_COOK_FINISH_PRODUCTION`）と Late Catalog（`LATE_CATALOG_PRODUCTION`）は OFF のまま。
基準 `main` = `a6c1463`。記録日 2026-10-23。Issue #577。出典は #577 の Owner コメント（2026-10-23）。

**この文書が P3 の最新の決定 SSOT。** 追跡文書 `TETO_PINSA-577_E5-GATES_TRACKING_2026-10-23.md`（PR #633、未 merge）の L2・後乗せ 5 ピースに関する記述は、本書の L1 で置き換わる（#633 のブランチは変更しない。#633 が merge される場合は本書を優先し、必要なら冒頭に「L2 は superseded（本書）」の注記を足す）。設計書 `TETO_DOUGH-KIND_PINSA_DETAILED-DESIGN.md` §7 は L2 前の記述（4 食材すべて焼成前）のままで、P3-b の実装 PR が更新する。

## 1. 決定（Owner、2026-10-23）

| ID | 決定 | 備考 |
|---|---|---|
| L1 | 生ハムは**焼成前**、**ルッコラのみ** POST_BAKE（FINISH で後乗せ）。L2（生ハム・ルッコラ両方後乗せ）は**不採用** | 原典 F3「生ハムは前後どちらも可」と矛盾しない。ルッコラの後乗せ（F4「最後に加えると風味を保ちやすい」）は原典の確定ではなく**ゲーム設計の選択** |
| D1 | `ladderCredit:false` の後乗せレシピは、late ladder step の key であることを免除する（**データ由来**の例外）。**厳格な検証**を同時に課す | §2 |
| D2 | **J-a**: 標準生地＋ルッコラ後乗せ（と標準生地＋生ハム後乗せ）は **ORIGINAL**。ジャモンの target（`late: []`）は変更しない。**既存ジャモンの発見データは変更しない** | #636 の組合せ表の「OBSERVED_UNAPPROVED」6 行が、この決定で承認済みの仕様になる |
| D3 | `late-addition` の riddle が step 33 に前倒しされることを**許容**する。ただし情報漏えいを防ぐ | §3 |
| D4 | 個数・焼成は**検証用の暫定値**: tomato-sauce 1 / mozzarella 2 / prosciutto-crudo 3 / arugula 2（POST_BAKE）/ bake 58–78。実測前に正式確定しない | 非ソース 7、うち後乗せ 2（ikura の実測済み 3 以内） |
| D5 | Guided 開始時の `PizzaState.dough`（レシピの `doughKind`）設定を P3 に含める | `buildOrderState` と `RESET_PIZZA` の 2 か所。**P3-a1** |
| D6 | G-3（late step 番号）は**自動導出**（案 A）。Pinsa は late step を持たない | ikura の step は「通常 ladder の長さ + 1」。固定しない |
| D7 | 章 4 の表示（K2。✓ が付くが数は満了でない表示）の最終判断は **E5 の実機 HV** で行う | K2 は #637 で実装済み |
| D8 | 原典の未確認事項は継続調査 | §5 |

## 2. D1: `validateLateCatalog` の例外と検証

現行の `validateLateCatalog` は、後乗せレシピが必ず late ladder step の key であることを要求する（`late recipe is the key of no late ladder step`）。Pinsa は新素材を足さず step を持てないため、この例外が要る。

- 免除の条件（データ由来）: レシピが `ladderCredit: false` を持つこと。id の allowlist は使わない。
- 同時に課す検証（どれも違反なら ON ビルドがビルド時に失敗）:
  1. その後乗せレシピが、**後乗せ専用の素材を要求しない**（通常素材のみ。通常 ladder で到達できることの保証）。
  2. `ladderCredit: false` のレシピが late ladder step の key になっていない。
  3. 既存のルール（POST_BAKE の要求を含む、`lunchRush:false`、レシピ id・discovery target id の一意）は免除しない。
- `ladderCredit` を持たない（または true の）後乗せレシピには従来どおり step の key が必要（否定テストで固定）。
- 本番 OFF では後乗せカタログを読まないため、この変更は本番の挙動に影響しない。

## 3. D3: 情報漏えいの防止

`late-addition` の riddle は、ON のとき Pinsa target（arugula = step 33）によって、現行の ikura 由来（ladder 長 + 1）より早く開く。時機が動くことは許容するが、次を**テストで固定**する（P3-b 以降の実装 PR で、Pinsa データを入れた ON ビルドを対象に行う。P3-a2 までは、合成 fixture で riddle・affordance の導出規則を固定する）。

| # | 固定する性質 |
|---|---|
| T1 | riddle の文字列は全プレイヤー共通の固定文字列で、レシピ名・食材名（ピンサ / ルッコラ / 生ハム 等）・時機（焼成後）を含まない |
| T2 | Dex の riddle の出現は Dex 進捗だけの関数。Research・所持・購入ヒント・食材一致で変わらない |
| T3 | Hint 5.0・Research・Trial Notebook・○× パネルは、技法の状態を読まず、状態で表示が変わらない（DH4 の掃引に dough × late の状態を加えて再実行） |
| T4 | RESULT の技法ステージは、usage 経路でもレシピ経路でも同じ形式 |
| T5 | 生の技法 id を DOM・data 属性・aria に出さない（設計書 §5.7 R6） |
| T6 | G2 の固定文言は不変 |

残るリスク: step 33 で `dough-pinsa-romana` と `late-addition` の riddle が同時に現れる点は、E5 の実機 HV で確認する。

## 4. 実装の段階（Owner 承認済み）

| PR | 内容 | 状態 |
|---|---|---|
| P3-0 | 本書（docs-only） | 本 PR |
| P3-a1 | Guided 開始時の `dough` 設定（`SELECT_RECIPE` / `RETRY_SAME_RECIPE` / `RESET_PIZZA` / 保存復元のテスト） | 別 PR |
| P3-a2 | 後乗せカタログの型（`doughKind?` / `ladderCredit?`）・validator の例外（§2）・`discoveryIdentityOf` が `doughKind` を読む | 別 PR |
| **P3-b** | Pinsa のデータ本体（レシピ・order・sauce profile・hint role・Reference・discovery target id、ON ビルドのテスト、#636 の fixture の L1 化） | **HOLD** |

P3-a1・P3-a2 は Pinsa を含まず、本番で挙動が変わらない（どのレシピも `doughKind` / `ladderCredit` を後乗せカタログに持たない）。

## 5. 未決・未完了（承認済みとみなさない）

**Owner 判断が残るもの**
- P3-b の着手（HOLD の解除）。
- レシピの表示名（「ピンサ・ロマーナ」）と説明文（時機を示さない文言）。
- PK-0（原典確認）の項目 2・4・5 が未確認のまま P3-b のデータ追加（本番 OFF）に進むか。ON 化（E5）の条件に項目 2・4・5 の確認を残す案を推奨。
- Reference 配置（ルッコラの位置）の calibration は実装側に任せ、実機 HV で調整するか。

**原典（Owner 取得・中継。このセッションは pizzadb.jp に到達できず、独立検証なし）**
- F1〜F6 の原文転記、食材欄・個数の原文転記は未提出。
- 項目 2（生地の記述）、項目 4（説明文の妥当性）、項目 5（Piadina との区別）は未確認。
- F5（楕円）は M0（丸のまま・CUT なし）で未表現。Result に「原典は楕円、本 slice では未表現」と明記する条件。

**E5（本番 ON）の前に必要なもの（Pinsa の有効化は E5 と同時）**
- AC-8（ON ビルドで `salmon-roe` を 3 状態再測定、動画を #621 に添付し、対象 commit SHA・撮影環境・SHA-256・結果を記録するまで PASS にしない）。
- 後乗せ 2 ピース（Pinsa）の実測と Q-5 の正式化、Q8 の正式値。
- iPhone Safari 実機 HV（Chromium の録画は代替にならない）。
- G-4（ON ビルドの置き場。専用の一時検証環境 V1、共有 Preview は使わない）。
- 章 4 の表示（D7）の最終判断。
- ON のときだけ起きる変化の確認: riddle の前倒し（§3）、Research の候補が 1 件から 2 件になること、コホート文字（実装時に導出して確定）と `acceptedLetterShifts` の扱い。

## 6. 事実の訂正（現 main）

- 通常 ladder は **55 step**（#634 で step 55 = flammkuchen）。先行文書の「54 step」は #634 より前の数値。
- ikura の late step 番号は ON で「通常 ladder の長さ + 1」＝ 56 と導出される（コードは番号を固定しない）。
- 通常レシピは 62 件。章 4 の件数（先行文書の 26→27 など）は再導出していない。章 4 は step 30 以降の T4 全体で、flammkuchen・ikura・Pinsa はすべて章 4 に入る見込み。

## 7. 範囲外
ゲームコード、Pinsa データ、共有 Preview、本番スイッチ、`PROJECT_HANDOFF.md`（HOT。P3 の merge 時にまとめて追記）、#633 / #584 / #627 のブランチ。

## 8. 更新（P3-b-0、2026-10-23）
Owner 判断により §5 の未決のうち次が確定した: **R3**（PK-0 項目 2・4・5 は本番 OFF のデータ追加準備に限り未確認で許容。**本番 ON 化の前に必ず原典を確認**）、**R2**（表示名「ピンサ・ロマーナ」、説明文「独特の生地とルッコラの風味が楽しめる、ローマ生まれのピザ。」）、**R1 の一部**（P3-b-1 データと P3-b-2 ON 判定テストは別 PR）。実装計画と受入条件は `docs/design/TETO_PINSA-577_P3B_IMPLEMENTATION-PLAN_2026-10-23.md`、設計書の上書き一覧は `TETO_DOUGH-KIND_PINSA_DETAILED-DESIGN.md` 冒頭の「L1 と P3 の決定による更新」。さらに **CUT = 暫定「なし」／Q5 = RESULT に生地行を追加しない／Q8 = 暫定値を維持／R4 = Reference 配置は P3-b-1 で調整**が確定した。**Q7 は P3-b-1 着手前に確定する（現時点では未決）**。残る未確定（Q7・Q8 の正式値・D7・E5 の条件）は計画書 §5。P3-b の着手は引き続き HOLD（#639・#640 の merge と Owner の着手指示まで）。
