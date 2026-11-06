# #773 統合判断書 — 2 本の比較の突き合わせ、claim 一本化案、#577 PD-1 の分割（docs-only）

作成: 2026-11-06 / 基準 `main` = `ed159e9` / ブランチ `claude/teto-pizza-issue-773-61yp79`
統合対象: (A) 本ブランチ `docs/reports/TETO_NEW-PROCESS_CANDIDATE-COMPARISON_773.md`（commit `f9b1ab6`）、(B) `claude/teto-pizza-issue-773-nlyntr` の `docs/reports/TETO_NEW-PROCESS_Candidate-Comparison_2026-11-06.md`（commit `b494e16`、**コピーせず参照のみ。当該ブランチ・claim には触れていない**）。
性質: **判断の整理のみ。** `src/**`・既存 PR・claim の解除・共有 Preview・Production は変更していない。**PD-1 は未承認のため実装していない。** 「推奨」は助言で Owner Decision ではない。数値は【実測】【推論】【未確認】を区別する。
Owner 方針（本依頼）: 新レシピ拡張を優先し #577 Dough Kind 3 値目を第一候補／#579 DRIZZLE は新しい調理操作の候補として維持／ピアディーナは原典未確認のため出荷確定しない／Dough Kind は「新調理方法 2 種」に数えない／STEAM・FRY と競合するファイルは編集しない。

---

## 1. 2 本の違いの整理

### 1.1 結論の違い
| | (A) 61yp79 | (B) nlyntr |
|---|---|---|
| 推奨 | Dough Kind 3 値目（59 点） | DRIZZLE（59 点、参考の Dough Kind は 61 点） |
| 目的の置き方 | 「解放できるレシピ」を最重視 | 「新しい工程」として DRIZZLE、レシピ数なら #577 と明記 |
| Dough Kind の扱い | 新工程の 1 枠として数えるか Owner 判断（O-2） | 既存工程のデータ差のため新工程から**除外**、参考採点のみ |

**実質は同じ結論**: どちらも「レシピ数なら Dough Kind、新しい遊びなら DRIZZLE」と書いており、割れていたのは**目的の定義だけ**。本依頼の方針（Dough Kind は新工程に数えない／新レシピ拡張は Dough Kind 優先／DRIZZLE は新操作候補として維持）は (B) の整理に (A) の「新レシピ解放」の線を足した形で、**二重の推奨にならない**。

### 1.2 評価基準・重みの違い（点数が大きく違った原因）
| 基準 | (A) 重み | (B) 重み |
|---|---|---|
| 解放レシピ | **25** | 10 |
| 実装しやすさ | 20 | 25 |
| 操作・楽しさ | 15 | **25** |
| 干渉の少なさ | 15 | 15 |
| Owner 判断の少なさ／安全 | 15／10 | —／10 |
| 実ピザ整合 | （別枠で定性） | 15 |

DRIZZLE の点が (A) 27 点 vs (B) 59 点と離れたのは、(A) が解放レシピに 25 点を置き（DRIZZLE は 0）、(B) が操作・楽しさに 25 点を置いたため。**事実の食い違いではなく重みの違い**。点数の優劣は目的（OD-N1 / O-1）で決まるので、本書は**点を再計算せず**、目的別に並べる（§2）。

### 1.3 数値の突き合わせ【実測 + 概算、同じマトリクス `rows` 172 件】
| 項目 | (A) | (B) | 判定 |
|---|---|---|---|
| 未出荷行 | 94 | 約 94（補正前 97） | **一致**（id 一致の概算。別名の取りこぼしは両者に残る） |
| DOUGH_VARIANT の clean 行（新食材 0・ブロッカー 0） | 5（ny-style, argentine-napolitana, cauliflower-crust, piadina, fathead） | 同じ 5 | **一致** |
| ZONED | 1（quattro-stagioni） | 1 | 一致 |
| MULTI_SPREAD_LAYER の clean | 1（sfincione） | 1 | 一致。burrata を足せば +3 は (B) のみの追加情報 |
| DRIZZLE が必須の行 | 0（#579 監査の引用） | 0 | 一致 |
| PAN_BAKE の clean | **3**（`blockers` が 0 の行: new-england-bar, montreal, al-taglio） | **0**（NOT_REPRESENTABLE を除外） | **定義の違い**。(B) の基準（表現可能性込み）が厳しい。→ 採用は (B)（3 行は DOUGH_VARIANT などと併用で単独では解放されない） |
| grandma-pizza | #521 は #532 の完了待ち、と記述 | **main に定義あり**（`panShape: "square"`）と実測 | **(A) の記述は古かった。本書で訂正**。`recipes.ts:1265` に `grandma-pizza` がある【実測、本ブランチで再確認】。PAN_BAKE・MULTI_SAUCE は「進行中の Epic」ではなく「機構は出荷済み、残りは別形状・データ」として扱う（#532/#540 の open 状態との突合は**未確認**） |

### 1.4 前提条件の違い
- (B) は #579 の設計資料 3 本（別ブランチ `claude/drizzle-579-design-gate-20261104`）を読み、DRIZZLE の D1〜D6 と OD-DZ-1〜7 を作成。(A) は #579 の価値監査コメントと #746 の Lab 状態までで、設計資料は未読。→ **DRIZZLE の詳細は (B) を正とする。**
- (A) は #577 の Piadina Design Gate（14 ファイル表・D-P1〜P7）を読み、(B) は Piadina を「除外」として詳細を読んでいない。→ **Dough Kind の詳細は (A) を正とする。**
- 両者とも pizzadb.jp 原典は未確認、実機未実施、`node_modules` なし。

---

## 2. 統合した位置づけ（Owner 方針の反映）

| 枠 | 候補 | 位置づけ | 理由 |
|---|---|---|---|
| **新レシピ拡張・第一候補** | **#577 Dough Kind 3 値目 + 一般化** | 優先して進める | clean 5 行（新食材 0、ブロッカー 0）、Pinsa の型あり、最初の工程は本番影響なし |
| **新調理操作の候補（維持）** | **#579 DRIZZLE** | Owner の枠・HV 判断を待って D1 から | 解放レシピ 0、ただし STEAM・FRY・炙り・炒めと入力語彙が違う。#746 Lab が先行 |
| 新調理方法の達成数 | STEAM・FRY（既存）＋ **DRIZZLE が 3 つ目の候補** | **Dough Kind は数えない**（Owner 方針） | 操作が変わらないデータ差 |
| 並行・既存線 | ZONED（保留）、PAN_BAKE・MULTI_SAUCE（機構は出荷済みでデータ待ち）、炒め本番化、FRY F2〜 | 本書では動かさない | 重複回避 |

「第一候補」は**レシピ数を増やす目的のとき**の第一候補であり、「新調理方法」の目的では DRIZZLE が先頭候補。両方とも起票せず、#577・#579 の既存 Issue に紐づける（新規 Issue 数 = 0）。

---

## 3. #773 主担当の一本化と重複 claim の解消案

### 3.1 現状（#773 のコメントを再確認）
| session | branch | files | 状態 |
|---|---|---|---|
| `session_013m8Cb6…`（S6 計画） | `claude/teto-pizza-parallel-plan-sh894e` | `docs/reports/TETO_NEW-PROCESS_*` | **ブランチは origin に無い**。成果物なし。期限 11/20 |
| `session_016YrGbyeQ…` | `claude/teto-pizza-issue-773-nlyntr` | `…Candidate-Comparison_2026-11-06.md` | 成果物あり（commit `b494e16`）。PR なし |
| `session_016YrGhzbs…`（本セッション） | `claude/teto-pizza-issue-773-61yp79` | `…CANDIDATE-COMPARISON_773.md`（＋本書） | 成果物あり。PR なし |

### 3.2 案（Owner に選んでもらう。**私は他セッションの claim を解除しない**）
- **推奨案 K1: 主担当 = 本ブランチ `61yp79`。** 理由: 本書が両方の結論を統合し、PD-1 の分割まで含むため、後続（#577 の実装 PR）が参照する先が一本になる。
  - (B) は**資料として保持**（コピーせず commit `b494e16` で参照）。(B) の claim は、投稿者のセッションまたは Owner が `"released": true` の claim で解除する。
  - 先行 claim（`013m8Cb6…`）は成果物がなくブランチも無いため、Owner が release するのが安全（投稿者以外は解除しない）。
- 代替案 K2: 主担当 = `nlyntr`。DRIZZLE の設計が最も詳しい。ただし Dough Kind の PD-1 分割と本書の突合は別途取り込みが必要。
- **本セッションの対応**: 自分の claim は更新して範囲に本書を追加するのみ（同じ session + issue の更新、§8）。解除は Owner の選択後。
- docs は PR にまとめない前提（`SESSION-OPERATIONS` §8-4: docs だけの PR は作らない）。**後続の実装 PR（PD-1a 等）の本文に本書の結論を取り込む**か、Owner が docs-only PR を明示的に求めたときだけ作る。

---

## 4. #577 Dough Kind — 開始条件と PD-1 の分割

### 4.1 現状【実測、main `ed159e9`】
- `DoughKind = "standard" | "material-multigrain-long-ferment"`、`isDoughKind` は 2 リテラルの直接比較（`src/logic/dough/doughKind.ts`）。Pinsa は `PINSA_PRODUCTION = true`、Piadina は `src/` に存在しない（`rg -i piadina src` → 0）。
- `doughKind.ts` 冒頭コメント（「no RECIPES entry sets doughKind」「first recipe is P3」）は**古い**（Pinsa は出荷済み、`grandma-pizza` 等の存在）。PD-1a で併せて直す候補。
- #577 の既存 claim はすべて**失効済み**（P1/P2: 〜10/27、A/B: 〜10/27、P3-0/a1/a2: 〜10/30）。本日（11/06）時点で #577 に有効な claim は無い【コメント全件確認】。P1/P2/P3 系 PR（#583・#585・#636〜#640 ほか）の merge 状態は、clone が浅く `git log` で確認できないため**未確認**（コード側に P1/P2/Pinsa が存在することは実測）。
- #577 の Pinsa の残件: E5（後乗せ本番 ON、#621）、AC-8、K2、Q7 の副作用承認。これらは Piadina の可否とは独立。

### 4.2 #577 の開始条件（PD-1 を始めてよい条件）
1. **Owner が PD-1 の分割（§4.3）に GO**（本書は未承認の提案）。
2. #577 に新しい claim を投稿し、既存 claim（失効済み）・open PR と重ならないことを再確認（`SESSION-OPERATIONS` §1）。分割単位ごとに 1 claim、期限 14 日以内。
3. 競合チェック（着手時に `git diff --name-only` で再確認）: PD-1a〜c が触るファイルは #738（`App.tsx`・`PizzaStage.tsx`・Steam 一式）、#749 F1（`src/logic/fry/**` ほか）、#746（`src/main.tsx`・`src/preview/*`）、#696、#581、#478 のいずれとも**重ならない**（§4.3 のファイル一覧と open PR の変更ファイルで確認済みの範囲。#540 は HOLD の古い base のため、着手時に再確認）。
4. **ピアディーナの値・レシピ・データは入れない**（§5）。PD-1 は値を増やさない。
5. Owner 判断（§6）のうち D-P1〜D-P2 は PD-1b/PD-2 の前に必要。PD-1a/PD-1c は不要。

### 4.3 PD-1 を 3 つの独立タスクに分割（いずれも**挙動バイト同一**、3 値目を追加しない）
元の Design Gate の PD-1 は 14 ファイルに跨る。ファイル集合が交わらない 3 つに割ると、順序依存と競合がなくなる。

| タスク | 内容 | 触るファイル（予定） | 本番影響 | 他との重なり |
|---|---|---|---|---|
| **PD-1a 語彙の一般化** | `isDoughKind` を `DOUGH_KINDS` 参照にし、値の追加が 1 か所で済むようにする。`doughKind.test.ts` の pin を「値の一覧 = `DOUGH_KINDS`」に一般化。古いコメントを現況に直す。値は増やさない | `src/logic/dough/doughKind.ts`、`doughKind.test.ts` | **なし**（同入力で同出力） | なし |
| **PD-1b 技法の対応表化** | `PINSA_DOUGH` リテラルと `usesPinsaDough`／`requiresPinsaDough`、`DOUGH_TECHNIQUE_ID` 単一定数を「生地値 → 技法 id」の対応表にする。対応表は Pinsa の 1 行のみ。`detectTechniquesUsed`／`requiredTechniquesOf` の結果は同一 | `src/logic/techniques/detection.ts`、`doughSwitch.ts`（＋既存テスト） | **なし** | `data/techniques.ts` は触らない（技法定義の追加は PD-3）。#540（HOLD）が `detection.ts` を触っていないか着手時に確認 |
| **PD-1c シミュレータの一般化** | 生地を 1 値で扱うテスト支援を `DOUGH_KINDS` 反復に一般化（現状の値だけで結果が同一であることを固定） | `src/logic/testSupport/lateFinishSim.ts`、`researchAttemptSim.ts`（＋その test） | **なし**（テストのみ） | なし |

- 3 つは**互いに独立**で、どの順でも・並行でも merge できる。同時実装の上限 2 件（#696 コメント 11/04）を守るなら、**最初は PD-1a（最小）**、次に PD-1b/c。
- 参照のみ（変更しない）: `signature.ts`、`discoveryCatalog.ts`、`identityKeys.ts`、`doughSelection.ts`、`lateCatalog.ts`、`doughOutline.ts`。PD-1 では「3 値でも同じ」ことを後続 PD-3 のテストで固定する。
- **PD-2（チップ UI。`DoughKindSwitch.tsx`・`GameScreen.tsx`・`pendingRound.ts`）は PD-1 に含めない。** `GameScreen.tsx` は HOT、`pendingRound.ts` は保存互換（D-P4）で Owner 判断が要るため、#738 の merge と D-P1/D-P4 の後。
- PD-3（データ）は §5 の条件が揃うまで着手しない。

### 4.4 最初の実装 PR の範囲（推奨）
**PD-1a のみ**を最初の PR にする。
- 目的: 生地値の追加を 1 か所にし、`isDoughKind` の直接比較を無くす。**値は増やさない・どのレシピも変えない。**
- 変更: `src/logic/dough/doughKind.ts`（`isDoughKind` を `DOUGH_KINDS.includes` 相当に、コメントを現況に更新）、`src/logic/dough/doughKind.test.ts`。**新規ファイルなし・他の既存ファイル変更なし。**
- 受入条件:
  1. `DOUGH_KINDS` と `DoughKind` 型が同一（型レベル・テストで固定）。`isDoughKind` は `DOUGH_KINDS` の要素だけを真にし、未知値・`null`・非文字列を偽にする（既存挙動と同一）。
  2. `resolveDoughKind` の戻り値が全入力で変更前と同一（現行値 2 つに対する全分岐テスト）。
  3. 他の既存ファイルの diff なし。`tsc -b`・oxlint・Vitest（`logic/dough/**` と、`doughKind` を import する既存テスト）が通る。本番バンドルの挙動に差が出ない。
  4. UI／操作が変わらない純粋ロジックのため HV 対象外（HV Policy §2）。Result は PR 本文（追加の Result 文書は作らない、`SESSION-OPERATIONS` §8-4）。
  5. merge・共有 Preview 更新・Production ON はしない。Codex レビューは最新 head のみ有効。
- **これは提案であり未承認。実装していない。**

---

## 5. ピアディーナの扱い（出荷対象として確定しない）
- 原典 pizzadb.jp は**未確認**（両資料とも環境から到達不可）。Design Gate §8 の項目は全て未確認。**ピアディーナを出荷対象として確定せず、PD-3 以降の「例」として扱う**。
- PD-1（a〜c）は**値もレシピも持たない**ので、原典の結果に依存しない。原典が取れなかった場合も PD-1 は無駄にならない（別の生地種や Pinsa 周辺でも使える一般化）。
- 原典が取れたとき、または Owner が暫定仕様を承認したとき（OD-B9-17 パターン）だけ、PD-3 を検討する。工程は案 F（late catalog）を暫定の第一案とするが、**暫定仕様であることを明記**し、確定扱いしない。
- 原典の取得手順: 担当セッションが先に試す→取れなければ URL とエラーを渡して ChatGPT 側へ（`SESSION-OPERATIONS` §8-2）。Owner に取得や貼り付けを求めない。

---

## 6. 必要な Owner 判断（まとめて、各に推奨つき）

| ID | 論点 | いつ要るか | 推奨 |
|---|---|---|---|
| **J-1** | #773 主担当の一本化（§3.2 の K1／K2）と、先行 claim の release の実行者 | 今 | K1（61yp79）。他セッションの claim は投稿者または Owner が release |
| **J-2** | PD-1 の分割（a／b／c）と、最初の PR を PD-1a にする GO | PD-1 着手前 | GO。a → b/c の順 |
| J-3 | 同時実装枠: #738・#746 が HV 待ちの間に PD-1a（小さな純粋 PR）を始めてよいか | PD-1 着手前 | 可（HOT なし・新規ファイルなし・同入力同出力）。枠の上限判断は Owner |
| J-4 | D-P1 チップ設計／D-P2 1 生地 1 技法 | PD-1b の前（PD-2 の前提） | D-P1=「ほかの生地」1 個→開いた先で選ぶ、D-P2=はい（Design Gate §9 の助言） |
| J-5 | D-P4 保存互換（`pendingRound.dough` の未知値の扱い）、D-P6 専用ゲート | PD-2／PD-3 の前 | D-P4 は (a) 受容または (b)、D-P6=はい（Pinsa 踏襲） |
| J-6 | ピアディーナの暫定仕様（案 F）を原典が取れる前に PD-3 に進めてよいか | PD-3 の前 | 原典が取れるまで進めない。取れなければ暫定仕様を Owner が明示承認してから |
| J-7 | DRIZZLE: D0（OD-N1・OD-DZ-1・OD-DZ-2）と D1 の GO、#738/#746 の HV 後か前か | DRIZZLE 着手前 | #746 の実機 HV の結果を見てから。D1 は新規ファイルのみ（(B) §8 の Issue 案が使える） |
| J-8 | Dough Kind を「新調理方法 2 種」に数えない旨の記録（#577／#773 に 1 行） | 今 | 記録する（Owner 方針の確認のみ） |

---

## 7. 次の実装につながる順序
1. J-1・J-2・J-8 の回答 → #577 に claim（PD-1a）→ **PD-1a PR**（§4.4）。
2. PD-1b・PD-1c（J-4 不要の範囲で並行可。枠は上限 2 件）。
3. #738 merge ＋ J-4・J-5 → PD-2（チップ UI、`GameScreen.tsx`）。
4. 原典（または暫定仕様の承認）＋ J-6 → PD-3（データ、専用ゲート OFF）→ PD-4（公開、実機 HV）。
5. DRIZZLE は #746 の実機 HV の結果と J-7 の後に D1（(B) §8）。**STEAM #738・FRY #749 と競合するファイル（`App.tsx`・`PizzaStage.tsx`・`GameScreen.tsx`・`gameReducer.ts`・`src/logic/fry/**`・Steam 一式）は 1〜4 の PD-1 では一切編集しない。**

## 8. 未確認事項
- #577 の P1/P2/P3 系 PR の merge 状態（clone が浅い。コードの存在のみ実測）。
- #532／#540 の open 状態と `grandma-pizza` の公開状況の突合（`recipes.ts` の定義の存在のみ実測）。
- 点数は両資料とも主観で、本書は再計算していない。楽しさ・疲労は実測なし。
- 原典 pizzadb.jp は全て未確認。マトリクスの未出荷 94 行は id 一致の概算。
- PD-1b の `detection.ts` 周辺は、着手時にテスト・他 PR との差分を再確認する（本書は静的読みの範囲）。

## 9. 禁止事項の遵守
重複 claim の解除なし（本セッション自身の claim の更新のみ）／既存 PR（#738・#746・#749 ほか）・他ブランチへの push なし／merge・Production ON・共有 Preview 更新なし／PD-1 の実装なし／`src/**` 変更なし／新規 Issue・PR なし。
