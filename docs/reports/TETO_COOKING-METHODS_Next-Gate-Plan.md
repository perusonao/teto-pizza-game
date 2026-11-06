# Cooking Methods — Fresh 再確認・#738 Gate 計画・FRY F2 設計・統合順序（docs-only）

作成: 2026-11-06（UTC 約 15:00）/ 基準 `origin/main` = `785d7956b42eac97e42dbd138818262a16c0a91c`（変化なし）/ ブランチ `claude/teto-cooking-methods-audit-ku35ki`
親資料: `TETO_COOKING-METHODS_FRY-STEAM_Fresh-Audit.md`、`…_Evidence-Supplement.md`。本書は**差分のみ**。Owner 手順書（H1・H2・H3・H9・H11）は別ファイル `TETO_COOKING-STEAM_S4_iPhone-HV_Minimal-Procedure.md`。
性質: 調査・設計・docs-only。`src/`・`e2e/`・CSS・SVG・JSON・設定は未変更。PR 作成・merge・Production ON・共有 Preview 更新・既存 PR への push・claim の変更・GitHub への投稿は**していない**。
表記: 【実測】= 今回確認／【推論】／【未確認】。
採用した Owner 方針（今回の指示）: STEAM は A を暫定本線／V3 は独立 Lab のまま比較対象／S4 の実機 HV は H1・H2・H3・H9・H11 重点／FRY F2 は amount 保存とゲーム性を分離し β 案を第一候補／Production フラグは OFF 維持。

---

## 0. 結論（先に）

1. **共有 Preview の現在の配備元は #756 `8dfca29`で、#738 ではない**【実測】。#738 `2ac9820` は 11/4 23:25Z に配備後、11/5 00:32Z に #756 で上書きされた。**`?cookSteamHv=1` は今の共有 Preview では使えない。** 前回の補足資料は「配備結果は未確認」としていたが、**未配備（上書き済み）が事実**。
2. **#738 と main の差分に重複ファイルはゼロ**【実測】（#738 の 110 ファイル × main の 334 ファイル）。merge は clean。ただし **CI・Codex・HV はいずれも旧 base（`49e2add`）／旧 HEAD の証拠**で、最新 main を取り込むと**新しい HEAD になり、CI 11 件・Codex・HV をその HEAD でやり直す**必要がある（SESSION-OPERATIONS §2・§3）。
3. **FRY F2 は「amount 保存（reducer）」と「β のゲーム性（F1 の純ロジック追加＋F3 の UI）」を完全に分離できる。** ただし**新しい制約を発見**: reducer の承認経路は `canFryIngredient()` が本物のカタログを見るため、**eggplant に絵が無い間は承認経路をテストできない**（§4.4）。F2 のテストは「絵の登録（G2a）の後」か「カタログのモック」のどちらか。
4. **新しい open PR: #769（Batch 19 の docs 取り込み、docs＋JSON）。** #753 と同時に merge しても衝突しない【実測】。**#748 の claim は解放されていない**（#769 本文）。
5. **#726 の S3 claim は 2026-11-10 00:00 UTC に失効。** 残り約 **3 日 9 時間**（今 11/6 15:00 UTC）。更新コメントはない【実測】。

---

## 1. Fresh Audit（#738・main・claim）

| 項目 | 結果【実測】 |
|---|---|
| main | `785d795`（#759 B18 の Squash merge）。前回から変化なし |
| #738 | HEAD `2ac98201`（変化なし）、open・non-draft。CI 11/11 success（`2ac9820`、旧 base）、Codex 指摘 0（receipt `6637642549`、`2ac98201e7`）、review thread 0 |
| #738 と main の差分 | main は base（`49e2add`）より **15 commit 先**。変更ファイル: #738 = 110、main = 334、**共通 0**。`git merge-tree` で conflict なし |
| main の変更の中身 | B16〜B18 のデータ・テスト・golden、#760/#761/#739 のアイコン（`IngredientGlyph.tsx`・`App.css` の 1.35em 補正）、#765 の 360px chip 補正（`App.css` に `@media (max-width: 389px)`）、WebKit 診断（`e2e/support/diag.ts`・`failureEvidence.ts`・`handPick.ts`、`e2e/gestures.ts` は `page.mouse` を診断ラッパー `diagMouse` に置換、**API は同じ**）、`hvSeeds.ts`（B18 の HV seed）、FRY F1 のファイル |
| 意味的な相互作用の候補 | ①`main.tsx` の HV 入口: #738 の `activateCookSteamHv` は炒め・炙りの印を見て譲る設計（3 つが排他）。main の `applyPreviewHvSeed`（`?hv=`）は従来から別枠で、B18 は seed の中身を足しただけ【推論: 取り込みで排他の意味は変わらない】 ②`App.css` の #765 chip 補正（`.prepare-dock .ingredient-chip`）は蒸し画面（ステージ内）とは別だが、**360×800 の画面全体の見え方は変わる** ③`e2e/gestures.ts` を #738 の `cooking-steam.spec.ts` が `tapDoughPercent` で使用（シグネチャ同一）。**取り込み後の CI で確認する項目**として §3 に載せた |
| 共有 Preview の配備元 | **#756 `8dfca29c0fcfaeae6efbd9e4199f6b112bc51886`**（`Built 2026-11-05T00:32:32Z`）。直前の配備: #738 `2ac9820`（11/4 23:25Z）、`85b4a07`（11/4 14:50Z）|
| claim（#726 S3） | `2026-11-10T00:00:00Z` に失効。**残り約 3 日 9 時間**。#726 のコメントは 5 件（最後は 11/3 の S3 claim）、更新なし |
| claim（#749） | 〜11/18（F1 の新規ファイル範囲。F2 以降は**範囲外**、新しい claim が要る） |
| claim（#748） | 〜11/19。**未解放**（#769 本文が明記）。B18 は merge 済みで実質終了 |
| 新しい open PR | **#769**（`claude/teto-pizza-batch-19-docs-import-prep`、HEAD `186cc57`、2026-11-06T14:21Z、**docs 3 ファイル＋JSON 1 ファイル**、`mergeable_state: unstable`＝CI 実行中）。Batch 19 Prep Rev 5・R2 Owner 決定記録・実装前 Fresh Audit を main に取り込む |
| その他の open PR | #763/#762/#757/#756/#753/#751/#747/#746 は 11/5 以前の更新で変化なし |

---

## 2. H1・H2・H3・H9・H11 — 既存証拠と不足する撮影

詳細な表（各項目の既存証拠・実機でしか分からない理由・不足する撮影）は **Owner 手順書 §1** に置いた（重複させない）。要点:

| ID | 実機でしか分からないこと | 不足する撮影（Owner が iPhone で） |
|---|---|---|
| H1 | Safari の動的ツールバー・safe-area | スクショ 2 枚（展開／折りたたみ） |
| H2 | 片手の届きやすさ（幾何は E2E で実測済み） | スクショ 1 枚＋片手到達のメモ |
| H3 | 実機タッチの ghost click（Chromium では再現しない種類の不具合が過去に実在） | 画面録画 1 本（ピルをタップ → 2 秒待機） |
| H9 | iOS のアプリ切替・ロックからの復帰 | 画面録画またはメモ（復帰後の状態） |
| H11 | 実寸 24px の知覚・iOS Safari の疑似要素描画 | スクショ 1 枚（蒸した貝と生の貝を同じピザに） |

セッション側（実機以外）で用意できるもの: なし（上記はすべて実機で Owner が撮る）。**用意できるのは手順書と記録シートだけ**で、それは完了している。

---

## 3. #738 の Gate 計画（最新 main 取り込み後）

前提: **最新 main の取り込みは #738 のブランチへの push（merge commit、履歴の書き換えなし）**で、Owner の承認が要る（過去に `85b4a07` で承認された手順と同じ。SESSION-OPERATIONS §2 の `BEHIND_BASE` も「merge base into the branch」）。**本書は push しない。**

### 3.1 手順と通過条件

| Gate | 内容 | 通過条件 | 備考 |
|---|---|---|---|
| **G0** 承認 | ①#738 への main 取り込み push の承認、②#726 claim の延長（または新しい claim）の承認、③S4 の HV 範囲（H1・H2・H3・H9・H11 重点）の確定 | Owner の記録 | claim は 11/10 00:00 UTC まで。延長しなくても CI までは進めるが、**失効後は他セッションが HOT 3 ファイルに入れる**状態になる |
| **G1** 取り込み | `git merge origin/main` を #738 ブランチに作り、conflict なしを確認（事前実測: conflict なし） | merge commit 1 つ、conflict 0、force push なし | 取り込みの際に履歴を書き換えない。新 HEAD `H'` が生まれる |
| **G2** ローカル検証（push 前） | **焦点を絞って**実行: `steam` 関連 Vitest（S3 時点 14 ファイル／213 件）、`previewIsolation.gate.test.ts`、`steam.gate.test.ts`（本番バンドルに `cookSteam*` が無い）、`tsc -b`、oxlint、`npm run build`。必要なら Chromium E2E（蒸し `cooking-steam.spec.ts` 30/30、`dynamic-cooking-steps`、`viewport-1screen`）を 390×844・360×800 で | 失敗 0。**全 Vitest の一括実行は不要**（SESSION-OPERATIONS §8.6: テストは変更に見合う範囲） | この環境には `node_modules` が無かった【未実行】。実行するセッションは `npm ci` から |
| **G3** CI | 新 HEAD `H'` で **11 件**（classify・build・layout-chromium・Layout Contract Gate・WebKit 390×844 の 3 shard・WebKit 360×800 の 3 shard・WebKit Gate）が success | 11/11 success。**src を含むため WebKit は必ず走る**（`classify-webkit.mjs` は docs 以外を fail-safe で `webkit_required=true`）。WebKit は 1 shard 最長 約 15 分、job 上限 35 分 | **同じ HEAD の再実行はしない**。失敗した job だけ、失敗記録（テスト名＋run URL）を残した上で再実行（§8.6・§2）。既知の間欠失敗: #394・#680。#763 では `cooking-prep.spec.ts:478`（30.5 秒 / 30 秒枠）と `cooking-tray-family-expanded.spec.ts:251`（timeout）が一度落ち、別 HEAD で緑。**#738 に取り込む main 側はこの 2 spec と WebKit 診断を更新済み**なので、同種の落ち方が出る可能性を事前に見込む |
| **G4** Codex | `H'` に対する Codex レビュー（`@codex review` を Owner またはセッションが投稿） | 「Didn't find any major issues」の receipt が `H'` に対して出る、または summary が `status: completed` かつ `has_unresolved_findings: false`。**旧 HEAD `2ac9820` の receipt は流用不可**（§2・§8.7） | 受信前に追加 push しない（push すると receipt が古くなる） |
| **G5** Owner Gate（dry-run） | Actions → `Owner Gate (dry-run)` を default branch で実行 | #738 の状態が `READY_FOR_OWNER_REVIEW`（`CI_PENDING`・`CODEX_NEEDED`・`THREADS_OPEN` などが無い） | Gate は HV・merge 承認を判定しない（`NOT_ASSESSED`） |
| **G6** 配備 | **Owner 承認後**、preview リポの `Build & deploy a source PR/branch` を `ref=H'`、`pr_number=738` で実行 | workflow success、README の `Source commit` = `H'`、画面バッジ = `#738` と `H'` の短縮 SHA の**3 点一致** | **現在の配備元 #756 `8dfca29` を復元用に記録済み**。復元は同 workflow を `ref=8dfca29c0fcfaeae6efbd9e4199f6b112bc51886`、`pr_number=756` で再実行（これも Owner 承認） |
| **G7** 実機 HV | Owner 手順書（5 項目、約 5 分） | Owner が PASS／NEEDS FIX／FAIL を記録 | HV は `H'` に属する。以降 push があれば HV はやり直し（§3.1） |
| **G8** 最終 Gate（read-only） | merge 直前に、①対象 PR の最新 HEAD が Codex・CI・HV で見た HEAD と**一致**、②review thread 0、③`STEAM_EXPERIENCE_PRODUCTION = false`（`steamExperienceGate.ts`）、④本番バンドル gate が green、⑤Owner の merge 承認が別に記録 | すべて満たす。**HEAD が変わっていたら停止**（§8.9） | merge は別承認。Production ON はさらに別 Gate |

### 3.2 停止条件
- G2 で既存テストが落ちる、または `main.tsx` の取り込みで HV 入口の排他が崩れる → **push せず** 報告（Owner 承認が要る修正は提案のみ）。
- G3 で WebKit が失敗 → 失敗記録（テスト・run URL・既知 flake か）を残し、**原因が #738 由来か main 由来かを切り分けてから**再実行。緩和（timeout 延長・skip）はしない。
- G4 の Codex が指摘 → 修正は **新しい HEAD になり G3 以降をやり直す**。
- claim が失効しても作業は止めないが、他セッションの HOT 3 ファイル編集が始まったら #738 の先行 merge を優先するかを Owner に相談。

### 3.3 CI／HV の負荷見積もり
- CI: 1 回で約 30〜40 分（build 約 15〜25 分、WebKit 各 shard 約 13〜20 分、並列）【過去の run の開始〜完了時刻から】。
- HV: 約 5 分（手順書）。
- **HEAD を増やすほど CI・Codex・HV のやり直しが増える**。取り込みと H11 のような追加修正は、**1 本にまとめて 1 つの HEAD にする**のが最も負荷が低い。

---

## 4. FRY F2 — amount 保存とゲーム性の分離設計

### 4.1 層の分け方

| 層 | 責務 | 変更するもの | 保存するもの | ゲート |
|---|---|---|---|---|
| **層 1: amount 保存（F2）** | 揚げた結果の**数値 1 個**を、transient な state に保存する。意味づけ・演出・名前は持たない | `gameReducer.ts`（追加のみ）、F1 の architecture test の `LATER_SLICES`、reducer のテスト | `fryLook[ingredientId] = amount`（0〜1）。**これだけ** | Owner の F2 HOLD 解除、新しい claim |
| **層 2: β のゲーム性（F1 追加＋F3）** | 泡を読んで引き上げ時刻を選ぶ判断、確定前のやり直し、フィードバック（言葉・演出） | `src/logic/fry/**`（純ロジックの追加）、UI（F3: `FryLayer.tsx`・`Fry.css` 新規＋HOT の追加） | **なし**（`amount` から導出する） | F2 の後、#738 の merge 後（F3 は HOT 3 ファイル） |
| 境界の約束 | **層 2 → 層 1 の受け渡しは `amount` ただ 1 つ。** 層 1 は評価・名前・星・演出を知らない。層 2 の結果の読み出しは `fryLookOfAmount(amount)`（F1、全域で逆引きをテスト済み）だけ | | | |

この分離により、**α／β／γ のどれを選んでも層 1 は同一**で、ゲーム性の議論が reducer の形を止めない。

### 4.2 層 1（F2）の仕様案
S2（`STEAM_INGREDIENT`）と同形【実測: `gameReducer.ts:1235-1245`、`RESET_PIZZA` の分割代入 :1289】。

- state: `fryLook?: Readonly<Record<string, number>>`（transient。保存・採点・在庫・Dex・Pitz・識別に読まれない）。
- action: `{ type: "FRY_INGREDIENT"; ingredientId: string; amount: number }`。
- 拒否（**同じ state 参照を返す**）: `fryExperienceEnabled()` が false／`phase !== "PREPARE"` または `makingStep !== "TOPPING"`／`roundKind` が GUIDED・FREE_COOK 以外／`!canFryIngredient(id)`／`!ownedIngredientIds.includes(id)`／`fryLook?.[id] !== undefined`（**最初の確定のみ有効**）／`!Number.isFinite(amount)`。
- 受理: `amount` を 0〜1 にクランプして保存。**意味（crisp／over）は `fryPot.ts` が持つ**（reducer はクランプだけ）。
- `RESET_PIZZA`: 分割代入に `fryLook: _discardedFry` を 1 語足す（プロパティは `undefined` を入れず除去）。
- テスト（steam と同じ 4 本構成の複製。コードは共有しない）: reducer・flagOff（フラグ OFF で状態不変）・coexist（炒め・炙り・蒸すと共存）・unaffected（採点・在庫・保存・Dex が不変）。architecture test の `LATER_SLICES` に `gameReducer.ts` を**意図して**追加。

### 4.3 層 2（β）の仕様案
**β 案（判断の可視化＋確定前のやり直し、非採点）。** F1 の既存部品を使い、追加は小さい。

| 要素 | 内容 | 既存／追加 |
|---|---|---|
| 判断 | 泡の大きさ・勢い（big→medium→fine→calm→still）を見て引き上げ時刻を選ぶ。A は 2 タップ、B は縦ドラッグ（タップ代替・↓↑キー必須） | F1 既存 |
| 結果の保持 | 引き上げた結果を画面に**保持**（F1 の `LIFT` が保持する）。**まだ reducer には送らない** | F1 既存 |
| 確定前のやり直し | 結果を見て「**もう一度**」→ 具が皿に戻る（F1 の `CANCEL` 相当。**在庫消費なし・何も保存しない**）／「**これで決定**」→ `FRY_INGREDIENT`（層 1）を 1 回 dispatch | 追加（UI と、結果保持後の `CANCEL` の扱いの確認） |
| フィードバック（採点・保存に出ない） | ①引き上げ直後の見た目（crisp なら黄金のつや）、②擬音の短い語（既存の `fryPot` の語）、③**ミトの一言**を `fryLookOfAmount` から導出（例: raw=「もう少し泡が細かくなってから」／crisp=「いい音！」／over=「ちょっと濃くなったね」。**文言は提案で Owner 確認事項**） | 追加（導出のみ、新しい state なし） |
| 禁止 | ゲージ・数値・残り時間、失敗状態、星、記録の保存、Pitz・Dex・Technique への反映（Owner の既存判断 #749） | 維持 |
| 回数 | やり直しは**回数制限なし・無料**が初期案。緊張感が薄れる場合は HV で調整（例: 2 回目以降は具が戻る演出を長くする） | 初期値（HV で調整） |
| 所要時間 | 1 回 8〜14 秒（やり直し 1 回込み）【見込み】 | HV で実測 |

**γ（V3 型の複数枚・油温切替）は別 Gate の独立 Lab で先行検証**（#763 と同じ進め方）。**α は最低限のフォールバック**（β からやり直し UI を外すだけで α になる）。

### 4.4 重要な発見 — F2 の承認経路のテスト可能性（前回の補足資料への追記）
`canFryIngredient(id)` は production 呼び出しでは `getIngredient(id)?.pieceVisual` を見る（`pieceVisualOf` はテスト用の引数で、reducer は渡さない）【実測: `fryIngredients.ts`、`gameReducer.ts` の steam 同形】。**eggplant に `pieceVisual` が無い今、reducer の「受理」経路は実カタログでは通らない**。

| 選択肢 | 内容 | 利点／注意 |
|---|---|---|
| **a. G2a（絵の登録）の後に F2** | eggplant に `pieceVisual` が付いてから reducer を書く | 実カタログでテストできて素直。F2 が G2a に依存（#753・#748 claim・アイコン系の順序） |
| **b. カタログをモック** | F2 のテストで `vi.mock` などで eggplant に `pieceVisual` を持たせる | G2a を待たずに F2 を進められる。**モックが本物のカタログと乖離する**リスクがあり、G2a の後に実カタログでの再確認テストを 1 本足す必要 |
| c. reducer にシームを足す | `canFryIngredient` に注入点を渡す | steam・sear との**同形性が崩れる**ので非推奨 |

**推奨は a**（順序が自然で、モックの乖離を避けられる）。ただし **F2 の拒否経路（フラグ OFF・対象外食材・所有なし・二重確定・非有限値）は絵が無くてもテストできる**ので、b なら受理経路だけがモック依存になる。→ 前回補足資料 §4.4 の「F2 は案に依存しない」は **ゲーム性案との関係では正しいまま**だが、「**G2 を待たず安全に進められる**」とまでは言えなかった。**訂正:** F2 は**ゲーム性の議論には依存しない**が、**テスト戦略（a か b）には依存する**。

### 4.5 受入条件（案）
- 層 1: フラグ OFF／対象外食材／Lunch Rush／Dinner／未所有／二重確定／非有限値で**同一 state 参照**を返す。炒め・炙り・蒸すと共存。`RESET_PIZZA` で消える。保存・採点・在庫・Dex・Pitz・識別に読まれない（architecture test）。`FRY_EXPERIENCE_PRODUCTION = false` 不変。
- 層 2（β）: 結果の保持から「もう一度」で**何も残らない**。「これで決定」で `FRY_INGREDIENT` が 1 回だけ飛ぶ。A・B・キーボードで完走可。390×844・360×800・390×664 で 1 画面に収まる。HV で「泡だけで揚がり具合が分かるか」「炒めと同じに感じないか」を Owner が判定。

---

## 5. #753・Batch 19・ハーブ 4 種の競合と統合順序

### 5.1 競合の再確認【実測】
- **docs 同士:** #753（Style Lock §12 追記＋eggplant 参照 SVG＋候補＋Design-Result＋スクショ）と #769（Batch 19 Prep／R2 決定記録／Fresh Audit／jaccard.json）は、**merge しても衝突しない**（#769 に #753 を merge して conflict なし）。
- **#769 の CI:** JSON を含むため `classify-ci-docs-only` が `docs_only=false` → `ci.yml` の lint／Vitest／build が走る。WebKit は `docs/**` のためスキップ見込み（#769 本文）。
- **#748 の claim:** 未解放（#769 本文）。解放は**担当セッション**が行う。Batch 19・ハーブ・G2 の実装は、この claim と**Owner の明示 GO**が前提（Batch 19 は R2 決定どおり）。Batch 19 の前提 3 件（#765・#759・#760）は main に merge 済み。
- **実装時のファイル競合（再掲＋更新）:** `ingredients.ts`（`DedicatedIngredientVisual` の union と各食材）・`IngredientGlyph.tsx`（viewBox 表・描画分岐）・`IngredientGlyph.test.tsx`（dedicated 表）・`App.css`（サイズ補正群）は、**ハーブ 4 種・eggplant G2a・burrata（Batch 19 の PR に専用 SVG が入る）が同じ追記箇所**。burrata は加えて `recipes.ts`・`discoveryLadder.ts`・`recipeSauceProfiles.ts`・`referencePizza.ts`・`orders.ts`・dialogue・golden・`ingredientTaxonomy.ts`・`toppingSizeClass.ts` を触る。
- **open PR との重なり:** 確認した open PR（#478・#540・#468・#581・#391・#321・#746・#756・#757・#763・#751）で `gameReducer.ts`・`IngredientGlyph.tsx`・`ingredients.ts`・`PizzaStage.tsx`・`App.css` を触るものはなかった【実測。ただし古い PR は fetch 結果の網羅性を一部確認できていない】。
- **Batch 19 の文書上の注意（#769 の Fresh Audit より）:** R2 決定記録の D 番号と Prep の D 番号が別物（X1）、Prep の D1・D3・D4・D7・D9 は GitHub 上の Owner 決定コメントで確認できていない（X2）、**将来 `burrata-pizza` を足すと crudaiola の Jaccard 例外（0.429）の「近傍 5 件目」に当たり再判断**（§4.4）。実装前に Owner が確認すべき項目で、本書では判断しない。

### 5.2 統合順序（案 C の具体化、すべて別承認）

| 順 | 作業 | 種別 | 並行可否 |
|---|---|---|---|
| 1 | **#753 を merge**（docs-only、clean） | docs | #769 と並行可 |
| 1' | **#769 を merge**（docs＋JSON、CI の build は走る） | docs | #753 と並行可。実装セッションが「SSOT を読む」ときに Batch 19 の Prep・R2 決定が main にあるようにする（X3 の解消） |
| 2 | **#748 の claim 解放**（担当セッション） | claim | 3 以降の前提 |
| 3 | **#738**: G0〜G8（§3） | src（UI・HOT 3 ファイル） | レーン S。**他の src 系レーンと同時に WebKit を走らせない**ことを推奨（WebKit の間欠失敗 #394・#680 は負荷が関与しうる【推論】）。ただし必須ではない |
| 4a | **ハーブ 4 種**（描画のみ、Owner 決定 B/B/A2/A2・1.2em） | src（アイコン） | レーン I の先頭。`#738` と**ファイルが重ならない**ため並行可 |
| 4b | **eggplant G2a**（絵の登録、`PizzaStage.tsx` に触れない） | src（アイコン） | 4a の後（同じ追記箇所）。G4（実機 HV）を Owner が見る（9 レシピの見た目が変わる） |
| 4c | **Batch 19**（burrata 専用 SVG 案 C を同じ PR に含む、レシピ・ladder・golden） | src（データ） | 4b の後。**Owner の明示 GO が必要**。Research ラベルの全数監査（AC-8）を実装時に再実行 |
| 5 | **FRY F2**（`gameReducer.ts` 追加のみ） | src（reducer） | 4b の後が自然（§4.4 の a）。#738 とは重ならないため、b（モック）なら 3 と並行も可。新しい claim が必要 |
| 6 | **FRY G2b＋F3＋F4**（揚げ色の合成、`PizzaStage.tsx`・`GameScreen.tsx`・`App.tsx`・`main.tsx` の追加、HV） | src（UI・HOT） | **#738 の merge 後**（#738 が `PizzaStage.tsx` の class／style の `??` 連鎖を書き換え済みで、同じ行に `fryLook` を足す）。F2 の後 |

### 5.3 並行可と直列の整理
- **並行可:** #753 と #769（docs）／#738 の Gate と ハーブ 4 種（ファイルが重ならない）／F2 の拒否経路テストの準備。
- **直列:** ハーブ → G2a → Batch 19（`IngredientGlyph.tsx`・`ingredients.ts`・テスト・`App.css` の追記箇所が共通）／#738 → F3（HOT 3 ファイル）／G2a → F2 の受理テスト（案 a）。
- **レーンごとの 1 本ずつ主義:** 同じ追記箇所を触る PR は、**1 本ずつ main に入れてから次を main から切り直す**（同時に 2 本進めると毎回 rebase が要る）。

---

## 6. リスクとブロッカー（更新分）

| # | 内容 | 区分 |
|---|---|---|
| R-1 | **共有 Preview が #738 ではない**（#756 が上書き）。HV の前に Owner 承認の再配備が必要 | ブロッカー（HV） |
| R-2 | #726 claim が 11/10 00:00 UTC に失効（残り約 3 日 9 時間） | ブロッカー（期限） |
| R-3 | 取り込みで #738 の HEAD が変わり、CI・Codex・HV をやり直す必要。**HV は取り込み後の HEAD で行う**のが無駄が少ない | 工程 |
| R-4 | WebKit の間欠失敗（#394・#680、#763 での `cooking-prep.spec.ts:478` 等）。#738 に取り込む main 側は該当 spec と診断を更新済み | 環境リスク |
| R-5 | #748 の claim 未解放。ハーブ・G2a・Batch 19 の実装が止まる | ブロッカー（claim） |
| R-6 | F2 の受理経路のテストが eggplant の絵に依存（§4.4） | 設計制約 |
| R-7 | Batch 19 文書の D 番号の不整合・Owner 決定コメントで確認できない項目（X1・X2）・`burrata-pizza` の将来リスク | 判断待ち（Batch 19 側） |

---

## 7. Owner 判断事項（最大 5 件、優先順）

| # | 判断 | 推奨 | 根拠・期限 |
|---|---|---|---|
| **D1** | **#738 の進め方と claim**: ①#726 の claim を延長するか（11/10 00:00 UTC 失効）、②#738 に最新 main を取り込む push を承認するか、③**取り込み後の最終 HEAD で 1 回だけ HV**（案 A）か、`2ac9820` で先に HV して持ち越しを認める（案 B）か | ①延長、②承認、③**案 A**（HEAD が 1 つで、免除判断が要らない） | 残り約 3 日 9 時間。CI 約 30〜40 分で足りる |
| **D2** | **共有 Preview の再配備の承認**: 現在は #756 `8dfca29`。最終 HEAD を `pr_number=738` で配備し、HV 後に `8dfca29`／#756 へ復元してよいか（復元も別承認） | 承認（HEAD 確定後に 1 回） | 11/5 の承認（`6644912674`）は `2ac9820` への一度きり。毎回承認が必要（SESSION-OPERATIONS §5） |
| **D3** | **S4 の HV 範囲**: H1・H2・H3・H9・H11 を必須とし、H4・H8・H10・H12 を既存証拠で免除、B 専用の H5〜H8 を必須から外す（B は Preview 限定の実験）。H13・H14 は実機 PASS 済み | 承認（手順書どおり約 5 分） | 免除は Owner の判断。自動テストは HV の代替ではない（§3.4） |
| **D4** | **FRY F2**: ①F2（amount 保存のみ、`gameReducer.ts` 追加）の HOLD を解除してよいか、②**β 案を第一候補**として F1／F3 の設計を進めてよいか、③テスト戦略: **a（G2a の後）**か b（モック）か | ①条件付き解除（G2a の後、または b）②承認③**a**。新しい claim が必要 | 層 1 は案に依存しない。受理経路のテストだけ絵に依存（§4.4） |
| **D5** | **docs とアイコン系の順序**: #753・#769 の merge、#748 の claim 解放、ハーブ→G2a→Batch 19 の順（Batch 19 は別途 Owner の明示 GO）。G2 を G2a（絵の登録）と G2b（揚げ色の合成、#738 の後）に分ける案も含む | 承認（Batch 19 の実装 GO はここでは求めない） | docs 同士は衝突なし【実測】。実装は 1 本ずつ |

**今回は判断を求めない（HOLD のまま）:** Production ON（蒸す・揚げる）、V3 の本線化・リリース可否、γ（V3 型）の FRY、新工程の方向（BOIL か `FRY_COOK` か）、技法の Dex 化、Batch 19 の仕様確認事項（X1・X2・`burrata-pizza`）。

---

## 8. 禁止事項の遵守
`src/`・`e2e/`・CSS・SVG・JSON・設定は未変更（本書と Owner 手順書の 2 ファイルのみ追加）／製品コード・テストの実装なし／PR 作成なし／merge なし／Production ON なし／共有 Preview 未更新（配備元の README と commit 履歴を**読んだだけ**）／既存 PR への push なし／他担当の claim は未変更／既存 Owner 判断は未変更／CI の再実行なし。
