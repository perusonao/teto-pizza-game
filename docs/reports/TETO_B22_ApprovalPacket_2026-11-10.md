# B22（#807）承認パケット — Research 35 ID の before→after と影響分類、承認の記録、CI・レビューの整理（2026-11-10、docs のみ、Refs #780）

Owner の 2026-11-10 の判断（step 順 72=buffalo-chicken／73=speck-e-brie、radicchio-noci のソース順、replayAudit の 7 分割は承認。ショップパック 20→30 は既存の購入・在庫テスト成功を条件に承認。**Research 35 ID は個別承認がまだ。承認前の merge は禁止**）を反映する。コード・テスト・golden は変更していない。

凡例: 【実測】コード・ログの読取りと実行、【未確認】測っていない。

## 1. 承認の記録と、その条件の確認

| 項目 | Owner の判断 | 状態 |
|---|---|---|
| step の順（72=buffalo-chicken／73=speck-e-brie） | 承認 | 実装済み（変更なし） |
| radicchio-noci のソース順（olive-oil → balsamic） | 承認 | 実装済み |
| replayAudit の 7 分割 | 承認 | 実装済み（同じ 36 回のシミュレーション・同じアサーション・同じ 600 秒） |
| parmigiano・gorgonzola のショップパック 20→30 | **条件付き承認**（既存の購入・在庫テストの成功） | **条件を確認**【実測】: `materialShop.test.ts`・`ShopOverlay.test.tsx`・`w1LadderEconomy.test.ts` と `src/state` の shop／purchase／stock／inventory／material／economy 系を合わせた **16 ファイル・559 件が全て成功**（HEAD `c54e9fae`、ローカル）。全 Vitest は CI の `build` でも成功。価格（60／100 Pitz）は不変、1 パックの個数だけ増える |
| Research 非正準 35 ID | **未承認（個別承認待ち）** | §2 |
| 長い名前（逸脱 7）・その他の逸脱 | 今回の判断に含まれていない | 引き続き確認待ち |
| **新規の逸脱 10**: `resultNearMiss.p2.test.ts` の「truthfulness」の 1 本を 6 本に分割 | 未確認（Owner 判断待ち。replayAudit の分割と同じ方式） | §3 |

## 2. Research の非正準文字変更 35 ID（個別承認が必要）

**前提【実測】**: 正準順（ladder の順）で文字が変わる出荷済みレシピは **0**（全 prefix）。Research の文字は所持順から毎回導出され、**保存されない**（`researchEntry.ts` の注記「Nothing about it is saved」）ため、保存データの互換性への影響は無い。変わるのは、プレイヤーが ladder と違う順で食材を入手したときの表示ラベルだけ。
測定条件: 実カタログ、既定の 40 本の seeded random 順（`expansionBatch22.test.ts` に固定、`PENDING_OWNER_APPROVAL`）。1 つの ID に複数の「X→Y」があるのは、順の違いごとに別の状態が現れるため。

### 影響分類
- **分類 1: ラベル新設のみ（それまで文字が無かった段に A が付くだけ。既存の文字は動かない）** — 14 ID
- **分類 2: 新設＋既存の文字の移動** — 19 ID
- **分類 3: 既存の文字の移動のみ** — 2 ID

影響の大きさの目安: 分類 1 が最小（文字が 1 つ付く）。分類 3 は既存ラベルの付け替えだけ。分類 2 は両方を含み、最大は `baba-ganoush-pizza`・`pesto-burrata-pizza`・`pizza-feta-eliniki`・`pizza-bianca-ricotta`・`vongole`（変化 8〜11 件）。

| # | 出荷済みレシピ | 分類 | 変化（before→after、非正準順） |
|---|---|---|---|
| 1 | `baba-ganoush-pizza` | 2 | (なし)→B B→C F→G G→I I→K J→L K→M L→N L→O |
| 2 | `bacalhau` | 1 | (なし)→A |
| 3 | `bbq-chicken-pizza` | 1 | (なし)→A |
| 4 | `boscaiola` | 2 | (なし)→A (なし)→B A→B B→C D→E E→F F→G |
| 5 | `brazilian-calabresa` | 1 | (なし)→A |
| 6 | `calabresa-argentina` | 1 | (なし)→A |
| 7 | `capricciosa` | 1 | (なし)→A |
| 8 | `curry-pizza-japan` | 2 | (なし)→B B→C C→D D→E E→F |
| 9 | `eggplant-ricotta-pizza` | 2 | (なし)→A (なし)→B B→C F→G H→I |
| 10 | `frango-catupiry` | 2 | (なし)→B B→C C→D D→E E→F F→G |
| 11 | `fugazza` | 2 | (なし)→A (なし)→B A→B B→C C→D D→E E→F |
| 12 | `grandma-pizza` | 2 | (なし)→A (なし)→B A→B B→C C→D E→F G→H |
| 13 | `jamaican-jerk-chicken-pizza` | 2 | (なし)→B A→B C→D |
| 14 | `new-haven-apizza` | 1 | (なし)→A |
| 15 | `palmito-pizza` | 1 | (なし)→A |
| 16 | `parmigiana-pizza` | 2 | (なし)→B B→C D→E |
| 17 | `pesto-burrata-pizza` | 2 | (なし)→A (なし)→B B→C D→E G→I H→I I→K J→K J→L |
| 18 | `pesto-noci-pizza` | 2 | (なし)→A (なし)→B B→C |
| 19 | `pesto-pollo` | 2 | (なし)→B A→B B→C C→D D→E |
| 20 | `pesto-salmone` | 2 | (なし)→B B→C |
| 21 | `pesto-tonno` | 1 | (なし)→A |
| 22 | `pizza-alla-crudaiola` | 2 | (なし)→A (なし)→B A→B B→C C→D |
| 23 | `pizza-bianca` | 2 | (なし)→A (なし)→B A→B B→C C→D D→E |
| 24 | `pizza-bianca-ricotta` | 3 | B→C C→D D→E E→F F→H H→J I→J I→K J→L K→M K→N |
| 25 | `pizza-feta-eliniki` | 2 | (なし)→A (なし)→B B→C F→H G→H H→I H→J I→J I→K |
| 26 | `pizza-portuguesa` | 1 | (なし)→A |
| 27 | `prosciutto-funghi` | 1 | (なし)→A |
| 28 | `puttanesca-pizza` | 1 | (なし)→A |
| 29 | `quattro-formaggi` | 2 | (なし)→A (なし)→B A→B B→C |
| 30 | `reina-pepiada-pizza` | 1 | (なし)→A |
| 31 | `shirasu-pizza` | 2 | (なし)→B A→B |
| 32 | `spinach-artichoke-pizza` | 2 | (なし)→B A→B B→C C→D |
| 33 | `supreme-pizza` | 1 | (なし)→A |
| 34 | `veggie-supreme-pizza` | 1 | (なし)→A |
| 35 | `vongole` | 3 | B→C C→D F→G H→J J→L L→N M→O M→P |

### 承認の方法（案）
- 一括で「35 ID 全て承認」、または分類ごと（1／2／3）、または ID を挙げて「承認」「不承認」を返してください。
- **不承認の ID がある場合**は、その ID の文字が動かないようにするには B22 の食材・レシピの構成（ladder の位置・材料）を変える設計変更が必要で、部分的に外せる設定は無い。その場合は停止して代案を提示する。
- 承認の範囲外の変化が 1 件でも出れば停止する（B21 の方式。テストは 35 ID の集合を固定している）。

## 3. #807 の CI と独立レビューの整理（最新 HEAD は PR で確認）

| 項目 | 結果 |
|---|---|
| CI（HEAD `c54e9fae`、コメントのみの変更） | **11/11 成功**（`build`＝全 Vitest 込み、WebKit 390×844・360×800 の各 3 shard、WebKit Gate、Layout Contract Gate、layout-chromium、classify）。ただし `webkit-360x800 shard 3/3` は 1 回目に `e2e/sauce-edge-475.spec.ts:124` で失敗（60 秒、`mouse.move: Page closed`）し、**失敗した job の 1 回の再実行で成功**した。B22 はこのテストの経路に触れていない。原因は未確定（§4） |
| CI（HEAD `867ebeb8`、実装の確認点） | 11/11 成功 |
| ローカルの全 Vitest（`867ebeb8`） | 12,066 件成功／13 件 skip／失敗 0。E2E `b22.spec.ts` は Chromium 390×844・360×800 とも 6/6 |
| 独立レビュー | 別セッションによる**読取り専用**のレビュー（PR コメント 6752504312）。ブロッカー無し、指摘は古いコメントの修正のみで `c54e9fae` で反映済み。**実行していない範囲**: replayAudit、E2E／WebKit、`src/**` の残り |
| **CI の失敗（HEAD `eb37889b`）と対応** | `build` の全 Vitest で `src/state/resultNearMiss.p2.test.ts` の 1 本（"ADD_ONE / REMOVE_ONE / SAUCE_ONLY / CLOSE lines never point at an unreachable recipe"）が **60 秒の上限を超えて失敗**（他の 12,065 件は成功）。**ローカルでも再現**: B22 の HEAD で 60.7 秒、B21 までの main では同ファイルが 42 秒。原因【実測】: このテストは「各レシピから 1 編集離れた全ピザ」（B22 で 11,565 通り）ごとに旧版の近さ判定（本番の呼出し元が無い `legacyResultNearMiss`、1 回約 4 ms、合計約 47.7 秒）を呼ぶため、レシピ数×食材数×レシピ数で増える。B22 の追加（レシピ +6・食材 +10）で上限を越えた。以前の CI／ローカルでは上限の手前で通っていた。**対応（テストのみ、本番コードは変更なし）**: 同じピザ集合・同じアサーション・同じ 60 秒の上限のまま、**6 本の部分（round-robin）に分割**し、「合計で 200 超を確認」の下限を別の 1 本で残した（分割後は各部分が約 8〜9 秒、ファイル全体 23/23 成功、約 51 秒）。あわせて、同じピザの判定結果を保存する（`outcomeOf` の memo、署名は位置に依存しないため安全）。skip・上限の延長・アサーションの弱化なし。replayAudit の分割（承認済み）と同じ方式 |
| **Codex レビュー** | **未実施**（利用上限）。**レビュー済みとは扱わない** |
| iPhone Safari HV | 専用 PR ページを公開（URL は PR コメント）。Owner の実機結果待ち |

## 4. 残るブロッカー

1. Research 35 ID の個別承認（§2）。
2. 逸脱 7（長い名前）の可否、および Result Report §3 の他の逸脱（2・5・6・8・9）の確認。
3. iPhone Safari 実機 HV（8 種の SVG、🦬・🏺 のチップ、2 層ソース、長い名前）。
4. Codex レビューが受けられない場合の扱い（独立レビューを Codex の代わりとはしない）。
5. 5 件目の WebKit flake（`sauce-edge-475.spec.ts:124`、#806／#394 に記録）は原因未確定。再発したら停止して報告する。
6. #807 は Draft・merge HOLD を維持。

## 5. 進捗（食材・レシピ・調理法。目標 170／177／27、縮小なし）

| 区分 | 出荷済み（Production） | #807 が merge された場合 | 残り |
|---|---|---|---|
| 食材 | B21 の 6 | +10 → 16／70 | 54（新規 49＋再利用／統合 5） |
| レシピ | B21 の 2 | +6 → 8／84 | 76 |
| 調理法 | 0（DRIZZLE D1 のロジックは merge 済みだが未配線・OFF） | +0 → 0／27 | 27 |

---

## 付録 A. 承認の時系列（追記専用。上の本文は merge 時点の記載のまま、改変しない）【実測：PR・Owner の連絡】

上の本文の「未承認」「個別承認待ち」は、**書いた時点（2026-11-10 の merge 前）の状態**を示す。その後の経過は次のとおり。

| 時刻（UTC） | 出来事 | 出典 |
|---|---|---|
| 2026-11-10（本パケット作成時） | Owner 判断: step 順（72=buffalo-chicken／73=speck-e-brie）・radicchio のソース順・replayAudit の 7 分割は承認。ショップパック 20→30 は「既存の購入・在庫テスト成功」を条件に承認（条件は §1 のとおり確認済み）。Research 35 ID は**未承認** | Owner の連絡、PR #807 コメント |
| 2026-11-10（`bcd9aaf9` の作成後） | Owner 判断: 逸脱 10（`resultNearMiss.p2.test.ts` の 6 分割。条件: 同じ入力集合・同じアサーション・同じ 60 秒の上限）を承認。逸脱 7（長いレシピ名）は暫定承認（iPhone Safari HV で確認） | Owner の連絡、PR #807 コメント 6756802345 |
| 2026-11-10 02:03 | Codex レビュー（`bcd9aaf9`）: 指摘なし | PR #807 のコメント |
| 2026-11-10 02:24:48〜49 | **Owner のアカウントが Draft を ready にし、squash merge した**（main `d3d4ec05`）。この時点で PR のタイトルには「Research 35 ID の Owner 個別承認待ち」が残り、PR 上に Research 35 ID の承認の記録は無かった | GitHub の PR 履歴 |
| 2026-11-10（merge の後） | **Owner が確定**: ① Research 非正準 35 ID は本パケット §2 の ID 別 before→after を**すべて承認済み**（`jamon-serrano-pizza` は対象外）。② `resultNearMiss` テストの 6 分割は承認済み。③ iPhone Safari HV は **6/6 PASS、備考なし**。④ #807 の squash merge は Owner 承認済みで実施済み | Owner の連絡（merge の後、時刻の指定なし） |

### 記録の扱い
- 承認の**効力**は Owner の確定の連絡による。**PR 上の記録は merge の後**になった（merge 時点の PR には承認の記載が無かった）。この付録でその順序を明確にしておく。
- merge 済みの履歴（コミット・PR のタイトルと本文）は改変していない。PR のタイトルの「個別承認待ち」は merge 時点の記載のまま残る。
- **承認された 35 ID**: §2 の表の 35 行（分類 1 = 14、分類 2 = 19、分類 3 = 2）。表の ID 以外（例: `jamon-serrano-pizza`）は承認の対象に含まれず、`PENDING_OWNER_APPROVAL` の固定集合にも入っていない（Codex の並行監査: 旧 36 との差はこの 1 ID のみで、旧測定は再現できないため不採用）。
- **iPhone Safari HV**: 6 シナリオ（`b22-speck-e-brie`／`b22-buffalo-chicken`／`b22-finocchi`／`b22-cavolo`／`b22-radicchio`／`b22-truffle`）が 6/6 PASS、備考なし。逸脱 7（長いレシピ名）は HV で確認され、備考は出なかった。
- **個別の明示承認の記録が無いまま merge に含まれた項目**（Result Report §3 の 5・6・8・9）: mint の着地 LIGHT_LEAF、black-truffle-pizza の NO_SAUCE 扱い、過去バッチの Research 監査から B22 を除く形、`hint5Production.gate` の合成カタログの調整（DH4-2A の旧計測値 321→291）。独立レビューでブロッカー無し・Codex 指摘なしだが、Owner の項目別の承認の記録は無い。Owner が必要と判断すれば確認する。
