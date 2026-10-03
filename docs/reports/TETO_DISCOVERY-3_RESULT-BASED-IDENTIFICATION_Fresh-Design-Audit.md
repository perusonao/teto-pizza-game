# Discovery 3.x — Result-based Identification: Fresh Design Audit（docs-only、実装なし）

> 状態: **監査（Owner 承認済み）。Owner は方式 C-1「種類上限つき項目別 ○×」・K=3 を採用した。** 採用後の authority は
> [`docs/decisions/TETO_ANTI-ORACLE-CONTRACT_2.1.md`](../decisions/TETO_ANTI-ORACLE-CONTRACT_2.1.md)。本書は比較・試算の根拠として残す。
> **実装・src/test 変更・PR・merge・Production flag ON・Production deploy はしていない。**
> audited main: `6d9d1ced98113dc42d8bd1e0688536f362431f61`（#357 merge 後）
> 比較対象 PR #359 HEAD: `ad48bd6919f495a6e61f29ad71c8744f84443a80`（**HOLD**。close / merge / rewrite しない）
> 関連: #346 / #356（Anti-Oracle Contract 2.0）/ #357 / #358 / #360（Hint 重複 Audit）/ #355（無関係）
> **補正（2026-10-03）**: 初版は「複数 sauce を 1 attempt で同時に試せる」と誤って仮定していた。実 code では 1 枚の pizza に載る sauce は 1 種類（`APPLY_SAUCE` / `COMMIT_SAUCE_DISPENSE` が `sauceIds` を 1 要素で置換）。**本書の数値・例は補正済みで、canonical は Contract 2.1 §15**。
> 本書の数値は repo のデータ（`RECIPES` 27 / `INGREDIENTS` 30 / `DISCOVERY_LADDER` 25 step）から算出した使い捨てスクリプトの結果で、スクリプトはコミットしていない。

## 0. 要約

- Owner 案 B（RESULT で使用材料すべてに ○×）を**無制限で入れると「全部乗せ」が最適解になる**。現 Production データ（27 recipe / 30 ingredient）で、
  どの recipe も **2〜3 attempt**（sauce 以外を全部載せて 1 回、sauce は 1 種類ずつ、正解を作って発見）で発見できる。現行 A の期待 321 attempt（27 recipe 合計）→ 64（B 無制限）。
- **「1 attempt で開示する情報量が、載せた材料の数に比例しない」**ことが、この 2 つの目標（遊びやすさ ↔ 全部乗せ耐性）を両立する鍵。
  推奨は中間案 **C-1「種類上限つき項目別 ○×」**: sauce（1 種 / attempt）/ cheese は常に項目別、**topping は『まだ分かっていない種類』が K（推奨 3）以内のときだけ**項目別 ○×、count は出さない。
  27 recipe 合計 **約 97 attempt**（A の 約 1/3.3、B の 約 1.5 倍）、全部乗せは無効化、事前の「調べる食材」選択・LOCK・未使用確認は不要。
- 結論は Owner Decision（§16）。実装はまだ開始しない。

## 1. 現行 A（#359 / #357）のループ

1. Dex の Research Entry →「研究する」（#346 S3、匿名カード①②）で **Research Target** を選ぶ（A でも C でも残る）。
2. PREPARE で **「🔬 今回の調査をえらぶ」→ picker → 1 食材を指定**（最初の工程確定で LOCK、RESET は保持、retry で解除）。
3. その食材を使って作る（未使用なら焼く前に確認）→ BAKE → RESULT。
4. RESULT: 指定した 1 食材だけ「✓ ○○を使う」（保存）／「特定できませんでした」（negative / INCOMPLETE / AMBIGUOUS 同一・保存なし）／「今回の試作に入っていなかったので、調べていません」。
5. 知識（`ing:`）が増える → 次の仮説 → 最終的に exact で NEW PIZZA。

実装物: `researchTest` / `researchTestLocked` / `SET_RESEARCH_TEST` / `ResearchTestPicker` / `BakeUnusedConfirm` / 状態 pill、`researchIdentify.ts`（1 食材の純関数）。
**操作が多い**（選ぶ → 作る → 未使用なら確認 → LOCK の理解）ことが Owner HV で顕在化した主因。

## 2. Owner 案 B のループ

作る → 焼く → RESULT「🧪 今回の試作結果」で **使った全材料** を項目別 ○×（ソース / チーズ / トッピングの種類 N ○× / トッピング各 ○×）→ ×を入れ替えて再試作 → 正解 → NEW PIZZA。
事前選択・LOCK・未使用確認は不要。**前提: ○× の基準になる hidden recipe が必要**。
「普通に未知のピザを作る」（targetless）では基準が無く、最も近い recipe を基準にすると **Near/Far そのもの（#346 で除去済みの oracle）** になる。
よって B / C いずれも **Research Target（Dex の研究カード）を 1 回選ぶ**部分は残す必要がある（per-attempt の選択だけが不要になる）。

## 3. 中間案 C（複数案）

| 案 | 内容 | 1 attempt の開示量 | 全部乗せ |
|---|---|---|---|
| **C-1 種類上限（推奨）** | sauce / cheese は項目別 ○×（カテゴリが小さい: sauce 3 / cheese 4）。topping は **未知の topping 種類が K 以内**なら項目別 ○×、超えたら topping 行は「K 種類までなら結果が見られるよ」だけ。既知（✓）は上限に数えない。count なし | ≤ K 個の topping + sauce/cheese | 無効（超えると何も出ない） |
| C-2 事後 1 タップ（D） | RESULT で使った材料のうち **1 つだけ**「確かめる」をタップ（1 attempt 1 回）。事前選択・LOCK・未使用確認が消える | 1 材料 | 無効（1 つだけ）。ただし brute force は A と同じ |
| C-3 1 attempt 1 つだけ自動開示 | 載せた中で正解の 1 つだけを ○（順序は固定 / 乱数） | 1 材料（○ のみ） | 部分的に有効（全部乗せで 1 attempt 1 個ずつ = 正解数 + 1 回で完了） |
| C-4 カテゴリ一致のみ | 「ソース ○ / チーズ ○ / トッピング ×」（集合が完全一致か 1 bit） | 3 bit | 無効だが × が何も教えず、Mastermind 的で苦しい |
| C-5 課金 / 在庫コスト | 開示 1 項目ごとに Pitz | 任意 | 抑制（#356 OD-I-16 で Phase 1 は不採用。操作も複雑になる） |

C-1 が Owner の目標（作る→見る→直す→また作る、説明不要）に最も近い。C-2 は UI が最も単純だが推理の手応えが A と同じ。C-3 / C-4 / C-5 は §6 の理由で非推奨。

## 4. 具体的な 1 プレイ例（pesto-pollo = pesto + mozzarella + fresh-tomato + chicken、Dex 25・所持 30、unlock fact = chicken）

**A**: 研究する → 「今回の調査」で basil を指定 → basil を載せて焼く →「basil は特定できませんでした」→ 次は egg … 期待 約 22 attempt（最悪 29）。
**B（無制限）**: 研究する → 1 つの sauce（例: pesto）と、他の cheese / topping を全部載せて焼く → 「pesto ○ mozzarella ○ fresh-tomato ○（chicken は既知）、他は全部 ×」→ 4 つだけ載せて焼く → NEW PIZZA。**2 attempt**（最初に選ぶ sauce が外れなら、sauce を替えて 3 attempt）。
**C-1（K=3）**:
1. tomato-sauce + mozzarella + basil + egg + mushroom → 「ソース: トマトソース×／チーズ: モッツァレラ○／トッピング: basil× egg× mushroom×」（sauce は 1 種類しか載らない）
2. pesto + mozzarella + 未知 3 つ（例: ham, onion, fresh-tomato）→ 「ソース: ペスト○／トッピング: ham× onion× fresh-tomato○」
3. （○ の固まり pesto + mozzarella + fresh-tomato + chicken）→ NEW PIZZA。期待 約 5 attempt（3〜8）。
**C-2**: A と同じ 1 材料/attempt（22 attempt）。ただし事前選択なしで「焼いた後に 1 つ確かめる」。

## 5. 全部乗せ / brute-force シミュレーション（現 Production: 27 recipe / 30 ingredient）

方法: 各 recipe を、その recipe が研究可能になる ladder step の**所持集合**（unlock = 最後に所有した食材は既知）で、**事前知識なしの blind scan**（候補を無作為順に確かめる）を仮定。
A は期待位置 `m(c+1)/(m+1)`（c = 候補数、m = 未知の正解数）、C は topping 候補を K ずつ走査（4000 回 Monte Carlo）+ 最終の exact 1 回。sauce は 1 枚の pizza に 1 種類しか載らないため attempt ごとに 1 種類を順に試し、cheese は全件、topping は未知 K 種ずつ並行して走査する。
**注意**: 人間は事前知識（定番の組み合わせ）で速くなる。数値は「何も考えない」基準の上限側の目安。

| 方式 | 27 recipe 合計（期待） | 平均 / recipe | step 25（pesto-pollo） | 全部乗せ |
|---|---|---|---|---|
| A（#359） | **321**（最悪 409） | 11.9 | 22.5（最悪 29） | 効かない（1 材料） |
| B 無制限 | **64** | 2.4 | 3 | **最適解**（2〜3） |
| C-1 K=4 | 85 | 3.2 | 4.5 | 無効 |
| **C-1 K=3** | **97** | 3.6 | 5.4 | 無効 |
| C-1 K=2 | 121 | 4.5 | 7.0 | 無効 |
| C-3 1 開示/attempt | 約 108（概算、sauce 制約の再計算なし） | 4.0 | 4 | 正解数 + 1 回（定数的） |
| C-2 事後 1 タップ | 321 | 11.9 | 22.5 | 効かない |

recipe 個別（抜粋、A / C K=3）: margherita 2.0/2.0、funghi 4.0/2.0、capricciosa 12.5/4.4、pizza-portuguesa 13.3/4.5、puttanesca-pizza 21.6/6.8、pesto-pollo 22.5/5.4。
注: recipe は構造的に偏っている（多くが tomato-sauce + mozzarella + topping 1〜4 種）。**情報は topping に集中**するため、sauce / cheese を項目別にしても漏れは小さい（cheese 4 種は 1 attempt で網羅できる。sauce は 1 attempt 1 種類。これは許容してよい）。

## 6. 論点別の監査

1. **使用材料すべてに ○× → 何 attempt で特定できるか**: 無制限なら全部乗せで 1 回（+ 構築 1 回 = 2）。通常のプレイ（推理して作る）でも 3〜5 attempt が現実的。
2. **全部乗せ**: B 無制限では最適解。C-1（種類上限）なら、上限を超えると topping 行は何も出ないので最適戦略は「未知 K 個ずつ走査」になり、attempt は topping 候補 ÷ K に比例。
3. **粒度**: sauce / cheese = 項目別 ○×（カテゴリが小さく漏れが小さい。matcher の `sauceBase` と同じ単位）。topping = 項目別 ○× だが **開示数に上限**。カテゴリ一致 1 bit（C-4）は ×が何も教えず不満が大きい。
4. **count（「トッピングの種類 3 種類 ×」）**: **Hint 5.0 STRUCTURE rung（5 Pitz、「全部で N 種類」）と競合する**。count 一致の 1 bit を数回引けば N が分かり、有料ヒントの価値が消える。さらに INCOMPLETE（exact だが量 / 焼き不足）で「全 ○ + count ○」が出ると **「構成は正解」= PR-1 で除去した oracle**（#346 / OD-D3-20）が復活する。**count は出さない**（STRUCTURE 購入後のみ、は可）。count を出さなければ「全 ○ なのに発見されない」は「欠けている材料がある」か「実行の失敗」の区別がつかず、INV-3 の parity が保たれる。
5. **○× の保存 vs RESULT のみ**: ○ は既存 `discoveryHintFacts` の `ing:` に保存（#357 INV-6 と同じ、価値が永続・reload 後も残る）。× を永続保存すると negative membership の台帳ができ、brute-force の記憶装置になる（#356 OD-I-6 / Non-Goal）→ **× は RESULT と Notebook（session-only）のみ**。
6. **Trial Notebook**: schema 変更なしで足りる。entry の feedback は `{kind, textJa ≤ 200字}` なので、**RESULT で開示した判定（○ / ×）だけ**を 1 行で記録できる（kind `RESEARCH_ROWS`）。既知 ✓・over-cap の非開示・hidden membership は記録しない。最悪ケースは現カタログで 126 字（判定部分のみ約 115 字）で 200 字に収まり、truncate は行わない（Contract 2.1 §7、OD-RB-13 / 14）。Notebook は session-only で、× を覚える負担が Notebook に移る（B/C の遊びやすさに直結）。
7. **Hint 5.0 の価値**: A でも `ing:` で既知の rung は 0 Pitz になる（OD-I-14）が、B / C では **sauce / cheese / key topping の rung はほぼ無価値**（RESULT が無料で同じ情報を出す）。残るのは **STRUCTURE（total）と SUB_CLASS（分類）**。C-1 は count を出さないのでこの 2 つの価値が残る。B 無制限は Hint 5.0 全体を無価値化する。
8. **Dex / Research Entry**: Research Entry は「RESULT の ○× の基準になる匿名ターゲット」として**必須で残る**（per-attempt の調査選択だけが不要）。Dex カードの「わかっていること ✓」は ○ の保存結果になる。targetless の free cook には従来どおり ○× を出さない。
9. **W1 / progression / ladderCredit**: ladder は「key recipe の発見」で材料が解禁される（25 step）ので、**発見までの attempt 数 = 進行速度**。A: 27 recipe で期待 321 attempt、B 無制限: 64（約 5 倍速）、C-1 K=3: 97（約 3.3 倍速）。コード変更は不要だが、**Pitz 経済（初回発見ボーナス、Hint / 補充の sink）とペース設計の再確認が必要**。finite 食材（1 pack = 10 pizza）の在庫消費は A / C で同程度（1 attempt = 載せた材料 × 1）。B 無制限の全部乗せは、sauce 1 種 + 購入済みの cheese / topping だけが対象で、購入済みの所持集合が上限になる。
10. **cross-recipe exact match**: 変更なし。B / C でも hidden target A 中に別 recipe B を exact 再現したら B は DISCOVERED、A への ○× パネルは出さない（OD-I-8）。
11. **INCOMPLETE / AMBIGUOUS**: ○× パネルは ORIGINAL / INCOMPLETE / AMBIGUOUS で**同一の見え方**（count を出さない前提）。FAILED（量 / 焼き）は matcher 一致後の話で ORIGINAL には来ない。
12. **recipe identity ではない失敗との分離**: ○× は**材料の membership だけ**。quantity / 焼き加減 / 配置 / ソース量は ○× に影響させず、既存の recipe 非依存アドバイス（`executionAdvice`、OD-D3-23）に任せる。「× = 量が足りない」と読まれない文言が必要。
13. **現 Production の brute-force 容易さ**: A でも最悪 29 attempt で完走可能（#356 の R-1 実測）。B 無制限は 2〜3 attempt。C-1 K=3 は期待 3〜7 attempt。**cheese は 1 attempt で確定**（4 種のみ）、sauce は 1 attempt 1 種類（3 種のみ）。topping が主戦場（23 種）。
14. **将来スケール**: 初版の見積り（53 recipe / 172 recipe）は sauce 複数投入の前提を含みうるため**撤回**し、数値は authority にしない。再監査 trigger は Contract 2.1 §13.1（Expansion Gate）。定性的には、**A / C は候補数に比例して重くなる**ので K を固定にするか動かすかは別途 balance audit（固定の方が説明不要）。

## 7. 評価軸の比較（trade-off、点数化しない）

| 軸 | A（#359） | B（無制限） | C-1（K=3） | C-2（事後 1 タップ） |
|---|---|---|---|---|
| 初見の分かりやすさ | 「調べる食材をえらぶ」の意味が最大の壁（HV で顕在化） | 最も直感的（作る→見る） | 直感的。K 超過時のみ 1 行の説明 | 結果画面に 1 操作増える |
| 操作数 | 多い（選ぶ / LOCK / 未使用確認） | 最小 | 最小（超過時だけ説明） | 最小 + RESULT で 1 タップ |
| 推理の楽しさ | 1 bit/attempt、遅い | 全部乗せで 1 回、推理が消える | 3 bit/attempt、入れ替えで遊べる | A と同じ |
| brute-force 耐性 | 中（29 attempt） | **なし**（2） | 中（≈ 5） | 中（29） |
| 全部乗せ耐性 | 高 | **なし** | 高（超過で無効） | 高 |
| Hint の価値 | 中（sauce / cheese は ALREADY_KNOWN 化） | **全面無価値** | 残る（STRUCTURE / SUB_CLASS） | 中 |
| Notebook の価値 | 低（×を覚えない） | 高（×の履歴） | 高 | 低〜中 |
| progression 互換 | 現ペース | 約 5 倍速（要再設計） | 約 3.3 倍速（要確認） | 現ペース |
| mobile UI 複雑度 | picker + 状態 pill + 確認ダイアログ | RESULT に行が増える | RESULT に 3 行（sauce / cheese / topping） | RESULT に確認ボタン |
| 実装複雑度 | 実装済み（#359） | 純関数の一般化 + RESULT 行 | B + 上限ロジック + 既知の扱い | A の UI 差し替え |
| save migration | なし | なし | なし | なし |
| privacy / hidden identity | OK | OK（ただし全 membership が漏れる） | OK（開示量が上限付き） | OK |
| 既存テストへの影響 | 追加済み | 大（A の 37+ 件を置換） | 大（同上） | 中 |

## 8. Anti-Oracle Contract の改訂案（C-1 を前提）

**維持（変更しない）**: correct count / distance / similarity / missing list / remaining / candidate count / Near・Far、STRUCTURE 購入前の「全部で N」、**negative の永続化**（INV-6）、matcher 非依存（INV-4）、class leak なし（INV-5）、Notebook schema 不変（INV-7）、hidden recipe name / id 非表示。
**改訂**:
- INV-1「Declaration-first」と INV-2「One bit, one ingredient」を廃止 → **INV-2'「Bounded reveal」**: 1 attempt で開示する topping membership は「未知の種類 K 以内」。**載せた材料の数で開示量が増えない**こと（全部乗せ耐性）をテストで固定。
- 禁止リストの「全使用食材の一括 membership 判定」「指定していない食材の判定」を**条件付き許可**（sauce / cheese は全件、topping は上限内）。
- **INV-3 の parity を再定義**: ○× パネルは ORIGINAL / INCOMPLETE / AMBIGUOUS で DOM が同一。count を出さないことが前提。
- ○ の保存は `ing:` のみ（既存）。× は RESULT と session-only Notebook（見せた 1 行）に限る。
- 新規 invariant: **「パネルの有無は player 自身の pizza だけで決まる」**（recipe の中身で変わらない）。

## 9. #359 / #357 のコードの扱い

**不要になる**（C-1 / B 採用時）: `researchTest` / `researchTestLocked`（状態と reducer ガード）、`SET_RESEARCH_TEST`、`ResearchTestPicker`、`BakeUnusedConfirm`、「調査中 / 今回は食材調査なし」pill と selector ボタン、`onBakeConfirmChange` と `cookingInputPaused` の確認ダイアログ分、Slice 2 / 3 / 4 の該当テスト・e2e、NOT_USED 文言（未使用という概念が消える）。
**再利用できる**: `isCanonicalRecipeIngredient` / `pizzaUsesIngredient`（1 食材 → N 食材へ一般化）、`ing:` 保存の write point（REGISTER_TO_DEX の free-cook 非 MATCHED 分岐）と verdict parity（NOT_IDENTIFIED の考え方）、`lastIngredientTest`（→ 行リスト）、flag（`RESEARCH_IDENTIFY_ENABLED`）、**Slice 1（Research context を BAKE / retry 後も維持する修正、58c115d）**、**Slice 5（発見成功 RESULT の CTA 整理、a4dfec4）と Layout Contract 更新（aac83b9）**、研究 card の「わかっていること + 工程 instruction」配置、e2e / screenshot の仕組み、Codex 指摘の教訓（確認ダイアログ中の入力 / タイマー、ただし C-1 では確認ダイアログ自体が不要）。
**PR #359 の扱い（Owner 判断）**: 全体を close して Slice 1 + Slice 5 + Layout Contract を新 PR に cherry-pick する、が最小コスト案。今は何もしない（HOLD）。

## 10. 推奨する最小ルールセット（C-1 案）

1. 「研究する」で Research Target を選ぶのは従来どおり（Dex 研究カード）。**attempt ごとの選択 / LOCK / 未使用確認 / picker は廃止**。
2. Research Target ありの ORIGINAL / INCOMPLETE / AMBIGUOUS の RESULT に「🧪 今回の試作結果」を出す（exact な別 recipe 発見時・targetless・FAILED では出さない）。
3. **ソース / チーズ**: **使った材料の全件**に ○×（○ は `ing:` 保存）。上限なし（Q-2a で確定）。「チーズなし」等は直接表示しない。
4. **トッピング**: 載せた**未知**の種類が **K = 3 以内**なら各 ○×。超えたら topping 行は「3種類までなら結果が見られるよ」のみ（sauce / cheese は表示）。既知（✓）の topping は上限に数えず、パネルにも Notebook にも出さない（Contract OD-RB-13/15, §3）。
5. **count は出さない**（STRUCTURE は Hint 5.0 の購入のみ）。× は RESULT と session-only Notebook（開示した判定だけの 1 行）に限り、永続化しない。○ は ORIGINAL / AMBIGUOUS / INCOMPLETE_MATCH の 3 outcome すべてで保存する（Q-1）。
6. Hint 5.0 は価格・順序とも不変。Dex の「わかっていること」は ○ の保存結果を表示。cross-recipe exact は従来どおり。
7. save schema / Trial Notebook schema / matcher / membership authority は不変。flag は default OFF のまま。

## 11. Owner Decision が必要な点（2026-10-03 時点の状況は §13）

1. **方式**: A 維持 / B 無制限 / **C-1（推奨）** / C-2 / その他。
2. **K の値**（2 / 3 / 4）と、固定か規模に応じて動かすか（53 / 172 recipe への備え）。
3. sauce / cheese を**常に全件 ○×** にしてよいか（cheese は 1 attempt で確定、sauce は 1 attempt 1 種類）。
4. **× を RESULT に出す**ことの承認（#356 は「✗ は保存しない、今回だけの中立表示は可」。複数 × の表示は新しい開示）。
5. count 非表示（STRUCTURE は有料のまま）の承認。
6. **targetless では ○× を出さない**（Research Target は必須）の承認。
7. **進行ペースの再設計**（約 3.3 倍速）と Pitz 経済（Hint / 補充の sink 縮小）の許容。
8. Hint 5.0 の位置づけ（STRUCTURE / SUB_CLASS 中心へ）と #360（重複 Audit）の扱い。
9. **#359 の扱い**（close + cherry-pick か、保持か）と、#357 の merge 済みコード（picker 等）の撤去時期。
10. Anti-Oracle Contract 2.0 → 2.1 改訂（§8）の承認と、flag を Preview ON のまま比較するか。

## 12. 方法と限界

- 数値は repo のデータ（`RECIPES` 27 件 / `INGREDIENTS` 30 件 / `DISCOVERY_LADDER` 25 step）から算出（使い捨てのスクリプト、コミットしない）。
- 人間のプレイでは事前知識で attempt はさらに減る。逆に操作時間（A の 1 attempt ≈ 15 操作、全部乗せ ≈ 60 操作）は未実測。
- scale の推定（53 / 172 recipe）は材料数の仮定を含む。
- 実装は開始していない。

## 13. Owner 追補（2026-10-03）と Q-2 data audit

**確定**: 方式 C-1・K=3（OD-RB-1〜10）、Q-1（3 outcome すべてで ○ を保存、INV-D6）、Q-2a（sauce / cheese は使用した全件 ○×、bounded reveal なし）、Q-3（Notebook は開示した判定のみ、truncate なし）、Q-4（Notebook の Target 識別 = Entry 番号 + unlock 名）。authority は Contract 2.1 §1 / §7 / §10。

**Q-2 data audit（27 recipe の実データ、blind scan の期待 attempt 合計）**

| 案 | 合計 | 評価 |
|---|---|---|
| **A. sauce / cheese は使用した全件 ○×（採用）** | 97 | UX が最も単純。Hint の段が空洞化する（accepted consequence、#360） |
| B. sauce 1 種・cheese 1 種までの bounded reveal | 100（+3） | 「なし」の推論が最大 1 attempt 遅れるだけ。ルールが 1 つ増える |
| C. カテゴリごとに 1 件だけ判定 | B と同数 | どれが判定されるか分かりにくい |
| D1. sauce・cheese・topping 合計で未知 3 種まで | 旧 143（取り下げ） | sauce 1 種 / attempt の制約下では割り当てが変わるため再計算せず取り下げ。OD-RB-3 ともずれる |
| D2. sauce / cheese を判定しない | 約 +100〜130（概算） | 推測ゲーム化（sauce × cheese の組み合わせ 258 通り）。非推奨 |

- sauce: 全 recipe がちょうど 1 つ（sauce なしは存在しない）。所有 1 種が 14 recipe（情報増なし）、2〜3 種が 13 recipe（sauce は 1 attempt 1 種類なので、attempt ごとに別の sauce を試して確定する。うち 2 recipe は unlock fact で既知）。
- cheese: 所有 1 種が 5 recipe、2〜4 種が 22 recipe。no-cheese は 6 recipe（marinara / fugazza / pizza-bianca / pesto-tonno / puttanesca-pizza / brazilian-calabresa、いずれも所有 cheese 2 種）。
- cheese 全件投入の節約は 27 recipe 合計で約 3 attempt（平均 0.1、最大 約 1: quattro-formaggi）。Hint 5.0 は production で ON のため、SAUCE（11 recipe）/ CHEESE（22 recipe）rung の価値低下は A / B どちらでも残る → #360。

**Q-6〜Q-10 確定（2026-10-03）**: RESULT はカテゴリごとの compact chip（既知 ✓ はパネルに混ぜない、固定 px は authority にしない）/ `RESEARCH_IDENTIFY_ENABLED` を再利用（旧方式は variant として残さない）/ progression・Pitz は実装 blocker にせず **Production ON Gate の必須条件**（約 3.3 倍速を activation risk として残す）/ Target の有効性は attempt 開始時基準（RESULT 時点の cookability に依存しない）/ #359 は rewrite せず、各 commit を fresh audit して必要な hunk だけ新しい小 PR へ抽出（Slice 2〜4 は再利用しない）。authority は Contract 2.1 §1（OD-RB-15〜19）・§12・§13。
