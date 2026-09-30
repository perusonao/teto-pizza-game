# Discovery 3.0 S0 — SSOT 更新案、S1 の範囲と受け入れ条件、S2 の blocker

- **種別:** 提案のみ。`PROJECT_HANDOFF.md`・`CLAUDE.md`・Issue #22・#288・他の Issue には**何も適用していない**。production code の変更なし。PR #295 / #296 / #321 は merge していない。
- **audited main:** `5c8190ff8e0e094baab6e563e06e1a11c16c4a57`
- **関連:** `docs/decisions/TETO_DISCOVERY-3_OWNER-DECISIONS.md`（決定の記録）、`docs/ROADMAP.md`（初稿、98 行）、`docs/reports/TETO_ROADMAP-SSOT_FRESH-AUDIT_2026-10-01.md`（分類の根拠）。

## 1. 今回追加したファイル（audit branch のみ）

| ファイル | 内容 |
|---|---|
| `docs/decisions/TETO_DISCOVERY-3_OWNER-DECISIONS.md` | S0 の Owner Decisions の記録と、未決の一覧 |
| `docs/ROADMAP.md` | canonical roadmap の初稿（DRAFT の帯つき） |
| `docs/reports/TETO_DISCOVERY-3_S0_SSOT-UPDATE-PROPOSAL.md`（本書） | 更新 diff 案、superseded の特定、S1 / S2 |

## 2. exact update diff proposal

行番号は main `5c8190f` の `docs/PROJECT_HANDOFF.md`（985 行）と `CLAUDE.md` のもの。**適用は Owner の承認後、ROADMAP.md が main に入った後。**

### 2.1 `CLAUDE.md`

```diff
 ## Read first
 
-- `docs/PROJECT_HANDOFF.md` — project handoff / roadmap SSOT. Read this and the current execution
-  issue before doing any implementation work (see its own "New-session startup checklist").
+- `docs/ROADMAP.md` — current priority, active lanes, next slices and paused lanes. Read this first.
+- `docs/PROJECT_HANDOFF.md` — architecture / operational handoff / historical context. Read the
+  section of the lane you are working on; its priority is decided by `docs/ROADMAP.md`.
```

「CLAUDE.md は短く保つ」方針（ファイル冒頭の文）と整合する。

### 2.2 `docs/PROJECT_HANDOFF.md`

**(a) 冒頭（1〜2 行目の後）に帯を挿入する。**

```diff
 # Teto Pizza Game — Project Handoff / Roadmap SSOT
 
+> **Priority and "what next" live in `docs/ROADMAP.md`** (current priority, active lanes, next
+> slices, paused lanes). This file is architecture / operational handoff / historical context.
+> Sections marked **SUPERSEDED** below are kept for history and must not be read as the current
+> priority. Fresh GitHub / main state outranks both files.
+
 Updated: 2026-09-18 (**Sauce Free Boundary MERGED via PR #66**, ...
```

タイトルの「/ Roadmap SSOT」は、Owner 承認後に「Project Handoff」に短縮する案（任意）。

**(b) Product goal（448〜462 行）に Owner Direction を 1 ブロック足す。** 既存の文は消さない。

```diff
 > See the ordered/reference pizza, recreate it physically by hand, bake it, and score higher the closer/better it is made.
 
+> **Discovery direction (Owner, 2026-10-01):** the central experience is *discovering a new recipe by
+> reasoning about it yourself*. Making (this section's goal above) is how the player tests a
+> hypothesis. Details and priority: `docs/ROADMAP.md`;
+> decisions: `docs/decisions/TETO_DISCOVERY-3_OWNER-DECISIONS.md`.
+
 Making Game 2.0 target: `DOUGH → SAUCE → CHEESE → TOPPING → BAKE → FINISH → RESULT`.
```

**(c) SUPERSEDED の帯（見出しの直前に 1 行ずつ）。**

| 見出し（行） | 挿入する帯 |
|---|---|
| `## Current roadmap issues`（464） | `> **SUPERSEDED (2026-10-01) — historical.** Issue status below is as of 2026-09; current priority is in docs/ROADMAP.md.` |
| `## Re-prioritized ordered roadmap`（654） | `> **SUPERSEDED (2026-10-01) — historical.** This order (HOME → Scoring → Making Game 2.0 → …) is complete or replaced. Do not use it as the current priority. See docs/ROADMAP.md.` |
| `## Parallel / non-blocking`（862） | `> **SUPERSEDED (2026-10-01).** See docs/ROADMAP.md §2 (independent / parallel lanes).` |
| `## New-session startup checklist`（949） | `> **SUPERSEDED (2026-10-01).** Use docs/ROADMAP.md §6 (reading order). The numbered items below describe the 2026-09-18 state.` |

行 848 `## Screen implementation timing` は内容の位置づけが不明（audit の分類 E）。帯を付けず、Owner が判断する。

**(d) lane の節に priority の 1 行を足す。** 対象は 306（Hint 5.0）、351（Category Tabs）、376（Large Catalog）、415（Cooking Techniques）の各見出しの直下。

```diff
 ## Discovery Hint 5.0 — Sub-topping Classification Ladder (Issue #292, H5-0)
 
+> Priority and the Discovery 3.0 direction (key-topping and the fixed ladder are being
+> re-evaluated; production is unchanged until S1/migration): docs/ROADMAP.md,
+> docs/decisions/TETO_DISCOVERY-3_OWNER-DECISIONS.md.
+
```

Category Tabs・Large Catalog・Techniques には `> Priority: docs/ROADMAP.md.` の 1 行だけを足す。

**(e) 冒頭 addendum 群（3〜303 行）に、先頭へ 1 行。**

```diff
+> **Historical addenda (2026-09-18 … 09-23).** The facts below were correct at their SHAs; several assume
+> 7 or 15 recipes. The runtime has 25 recipes (W1). Do not read this block as the current state.
 Updated: 2026-09-18 (...
```

（(a) の帯の下に入れる。行の移動はしない。`docs/archive/` への移設は Owner 判断の別案で、既存報告の行番号参照を壊さないよう、今回の案には含めない。）

### 2.3 Issue #22（適用しない。手順と新本文の案）

**手順案.** (1) 現本文を、そのままコメントとして投稿して保存する。(2) 本文を下の内容に置き換える。(3) 本文の「current main」は更新時の SHA に直す。

```markdown
[SSOT index] Teto Pizza Game — roadmap index

**The priority roadmap lives in the repo: `docs/ROADMAP.md`. This issue is only an index.**
Fresh GitHub / main state wins over this text.

- Current main: `<SHA at update time>` (re-fetch before trusting)
- Current priority: **P0 Recipe Discovery 3.0** — S0 Owner Decisions (done) → S1 Measurement / Migration Gate → S2 first branching validation
- Architecture / operational handoff: `docs/PROJECT_HANDOFF.md`
- Decisions: `docs/decisions/TETO_DISCOVERY-3_OWNER-DECISIONS.md`

| Lane | Issue / PR | Note |
|---|---|---|
| Discovery 3.0 / Hint | #292 | production Hint 5.0 is unchanged until S1 |
| Cooking Steps / Techniques | #294, PR #295 | PR open, Owner review |
| Large Catalog | #269, PR #319 | not a blocker for Discovery |
| Progression 2.0 | #216, #182 | umbrella |
| Dough Guide Leak Fix | PR #321 | independent gate |
| CUT / Scoring | #288 | CUT-S2 frozen |
| Dinner | #257 | lower priority |

Previous body (2026-09-18, 7 recipes, Bake as priority) is preserved in the first comment.
```

### 2.4 Issue #288（適用しない。コメント案）

```markdown
Owner Direction update (2026-10-01): CUT-S2 is frozen. The future goal of CUT is a quality component of
the total pizza score, not a standalone CUT score. The option "show CUT independently and keep it out of the
stars" in the body is withdrawn. trajectory / CUT-S3 is not a current priority. See docs/ROADMAP.md.
```

### 2.5 適用の順序

1. Owner が `docs/ROADMAP.md` と本書を承認。2. audit branch を main へ merge する PR を Owner が指示（今回は作らない）。3. 2.1〜2.2 を別の docs PR で適用。4. 2.3 / 2.4 を Owner が GitHub 上で実行（または指示）。

## 3. obsolete / superseded な箇所

**「superseded」は 2 種類に分ける。(i) priority / 状態の記述が古い（帯を付けて履歴にする）。(ii) 方向が変わったが、production はまだ旧仕様（S1 の評価が済むまで production の authority）。**

| 箇所 | 種類 | 置き換える先 |
|---|---|---|
| Issue #22 の本文全体（7 レシピ、main `398d484`、Bake が最優先、次の 5 slice） | (i) | `docs/ROADMAP.md` + 新しい索引（§2.3） |
| `PROJECT_HANDOFF.md` 3〜303 行（2026-09-18〜23 の addendum 群） | (i) 歴史 | 事実は正しいが「現在」ではない。帯（§2.2 e） |
| 同 448〜462（Product goal） | (i) 一部 | Discovery の方向を追記（§2.2 b）。既存の文は残す |
| 同 464〜608（Current roadmap issues） | (i) | `docs/ROADMAP.md` §2 |
| 同 654〜847（Re-prioritized ordered roadmap） | (i) | `docs/ROADMAP.md` §2。**「CUT / Scoring / Cooking Interaction を先に進める」順序の出所** |
| 同 862〜868（Parallel / non-blocking） | (i) | `docs/ROADMAP.md` §2 |
| 同 949〜985（startup checklist） | (i) | `docs/ROADMAP.md` §6 |
| `CLAUDE.md` の Read first | (i) | §2.1 |
| Issue #288 本文（独立表示案、S0 から始める記述） | (i) + 方針変更 | §2.4 のコメント |
| Hint 5.0 の固定 ladder（`docs/design/TETO_DISCOVERY-HINT-5_H5-0_FINAL-DESIGN.md` §5）と `hintKeyToppingId`（§6.1、OD-H5-C1 / C1a / C1b / C1-P）、`PROJECT_HANDOFF.md` 306〜349 | (ii) | OD-D3-1 / 2。**production は現状のまま。S1 の migration 評価と Owner 判断の後に置き換える** |
| Hint 5.0 の P4-CHEESE / P4b（cheese なし・key なしを有料の回答にする）（同 §5.3、round 6） | (ii) | OD-D3-1（存在しない要素を出さない方向） |
| near/far（`resultNearMiss.ts`、P2、OD-P2-2）と Notebook が文言をそのまま保存する仕様（OD-P3-4 / P3-18） | (ii) | OD-D3-7 と Notebook の方向 |
| 「あと少し」（`originalResultCopy.ts` の INCOMPLETE_MATCH、OD-P2-1） | (ii) | OD-D3-8（再現テストの後） |
| Issue #238（Hint 3.0）・#253（Hint 4.0） | (i) | #292 で置き換え済み（audit §11.2） |
| `docs/design/TETO_PROGRESSION2_PHASE2_DESIGN.md` の ⭐ curve | (i)/E | production の ladder は OD-REC04-1（★は材料解放に使わない）。authority は `discoveryLadder.ts` |
| `TETO_ROADMAP-SSOT_FRESH-SYNC_2026-09-18.md` | (i) | 歴史 |

**影響を受けないもの:** W1 ladder（OD-D3-5 により維持）、matcher の完全一致、TQ-1A/1B/1C、Large Catalog の決定（OD-1〜OD-R5e）、Dinner Mission の完了記録。

## 4. S1 Measurement / Migration Gate

**S1 は「測って、移行の影響を示し、再現して確かめる」gate で、production の挙動を変えない。** 成果物は tools・data・報告・テストのみ。brazilian-calabresa は **合成 fixture として評価する**（`RECIPES` には足さない）。

### 4.1 範囲（exact scope）

| # | 項目 | 内容 |
|---|---|---|
| A | authoritative data との一致 | brazilian-calabresa の identity（tomato-sauce, sausage, onion, black-olive, oregano）を、172 matrix・PIZZA DB evidence（`TETO_PIZZADB_172_MASTER-EVIDENCE.json`）・master catalog と突き合わせる。`calabrese`（mozzarella, nduja, tomato-sauce）、`calabresa-argentina`（salami を含む）との混同・naming cluster NC-4 を記録 |
| B | 既存食材の再利用だけで成立 | 5 食材がすべて runtime の `INGREDIENTS` にあり、ladder の中にあることを機械的に確認（新食材 0、ladder step 追加 0） |
| C | onion 解放時の pool = 2 | 凍結 ladder と entitlement / inventory を通して、step 12（onion）の解放後に DISCOVERABLE が pizza-portuguesa と brazilian-calabresa の 2 件になることを、実際の `recipeDiscoveryState` で再現（fixture の catalog で） |
| D | discovery-count ladder の加速 | calabresa を足したときの、各 step の到達タイミングの変化を、複数のプレイヤー像（標準経路、calabresa を先に発見、calabresa を発見しない、全部発見）で測る。OD-D3-5 の解決方式の候補 (a)〜(d) を比較する（例: ladder の件数に post-W1 を数えない / W1 の 25 件だけを数える / 加速を許容して経済を調整）。**候補ごとに、既存 save の互換性**（`discoveredRecipeCount` を使う箇所、保存済みの entitlement の再ロックなし）を確認 |
| E | Hint candidate reduction | 25 レシピ + calabresa で、ヒント段階ごとの候補削減（closed world と、プレイヤー視点の組合せ数 R）。「適用可能なヒント」をレシピ構造から導く規則（OD-D3-1）の案を、25 件 + calabresa で列挙。R の分布を、direct answer / 適切 / 広すぎる の 3 区分で示す（**閾値は OD-D3-15 で Owner が決める。S1 は候補値を示す**） |
| F | direct answer の個別列挙 | OD-D3-3 の要求。ヒント構成（現行 Hint 5.0 の全 rung、key なし案、その他の案）ごとに、direct answer になるレシピを 1 件ずつ列挙（ID と、なぜそうなるか: owned が少ない / family の飽和 など） |
| G | Hint 5.0 の migration impact | `RECIPE_HINT_ROLES`（型が `Record<RecipeId, …>` なので新レシピには key の記述を強制する）、`hint5Ladder.ts`、`hint5Taxonomy.gate.test.ts`、`hintFactMigration.ts`、save 内の購入済み facts（`ing:` / `h5:sauce` / `h5:cheese` / `h5:key` / `h5:structure` / `cls:`）、購入済みヒントの Pitz 価値、HintSheet / Dex の表示、`deductionProduction.gate.test.ts`（TQ-1D の tripwire）を列挙し、key-topping 廃止の案ごとに「何が壊れ、何を移行する必要があるか」を示す。**migration 案を 2 つ以上**（例: 旧 facts を読み続けて新規購入だけ新方式 / 旧 facts を新方式の等価物に変換）と、それぞれの rollback |
| H | near/far の漏洩量の再評価 | audit の `feedback_sim` を最新の前提で再実行（25 件 + calabresa、step 12 以降）。near/far（A）の「あと 1 つ」の向きが、総当たりをどれだけ縮めるかを数値化し、OD-D3-16（「総当たり solver になりにくい」の定義）の提案を出す |
| I | 「あと少し」の browser reproduction | 実ブラウザ（Chromium、390×844 と 360×800、実ポインタ操作）で、**ソース量だけ**（と、必要なら焼き）を意図的に落とし、INCOMPLETE_MATCH の文言が「材料集合の正誤」の判定に使えるかを確認する。正解の材料集合と、1 材料違いの集合とで、文言が区別できるかを 2 つ以上のレシピで確認。結果（再現した / しない）と、trigger 条件の一覧（ソース量・焼き・量）を記録。**再現した場合は、文言ではなく trigger の再設計案を S1 の出力に含める** |
| J | Notebook の挙動 | calabresa と portuguesa の試作を交互に行ったときの Notebook の記録（重複検知、`#n`、retry）を、reducer 層で確認。差分と整合表示（取得済みヒントとの照合）を、**pure function の試作（テスト内）**で検討し、Notebook が新しい hidden fact を生成しないことを確認。near/far 文言の保存をやめる場合の保存項目の案 |
| K | matcher collision | calabresa の identity（items + sauceBase）が、25 件と衝突しないこと。collision が 0 件であることの確認と、near-miss の「到達不能 target」規則への影響 |
| L | economy / inventory | calabresa を 1 件足したときの、Shop の pack 量（`10 × k`）、在庫消費、Pitz の獲得（FREE 報酬は基本報酬 100）、初期 Pitz からの到達性。ladder 加速（D）の各方式での経済への影響 |

### 4.2 受け入れ条件（Acceptance Criteria）

**production の安全性**
- [ ] `git diff origin/main..HEAD -- src` で、テストファイルとテスト support 以外の差分が 0 件（production の挙動の変更なし）。
- [ ] `RECIPES`・`INGREDIENTS`・`DISCOVERY_LADDER`・`RECIPE_HINT_ROLES`・save schema が変わっていない。brazilian-calabresa は production に存在しない。
- [ ] 既存の全 unit test、`tsc -b`、`oxlint`、`vite build` が通る（既存の 2 件の warning を除き新規なし）。

**計測の再現性**
- [ ] すべての数値が `tools/` のスクリプトから決定的に再現できる（固定 seed、`--check` で差分検出）。手書きの数値なし。
- [ ] 入力は production のデータファイルと、172 matrix・master catalog。

**個別項目**
- [ ] (A) 172 matrix・PIZZA DB evidence・master catalog との一致 / 不一致の表。naming cluster NC-4 と `calabrese` の扱いの選択肢が明示されている。
- [ ] (B) 5 食材すべてが `INGREDIENTS` と ladder にあり、新食材 0、step 追加 0 が機械的に確認されている。
- [ ] (C) step 12 の解放後に DISCOVERABLE が 2 件（portuguesa、calabresa）になることが、実コードの `recipeDiscoveryState` で再現されている。step 11 以前では 0 または 1 件。
- [ ] (D) 4 つ以上のプレイヤー像で ladder の到達タイミングの変化が測られ、OD-D3-5 の解決方式の候補 (a)〜(d) が、既存 save の互換性・経済への影響つきで比較されている。**推奨は示すが、選ぶのは Owner。**
- [ ] (E) 25 + calabresa の全件について、ヒント段階ごとの candidate reduction が出ている。direct answer / 適切 / 広すぎる に分類できる形（閾値は未決のため、閾値を変えても再集計できる）。
- [ ] (F) direct answer になるレシピが、ヒント構成ごとに 1 件ずつ列挙されている。
- [ ] (G) key-topping 廃止の migration 案が 2 つ以上あり、各案について、壊れるもの・移行するもの・rollback・購入済みヒントの扱いが書かれている。production Hint 5.0 の挙動は変えていない。
- [ ] (H) near/far の漏洩量が数値で示され、OD-D3-16 の定義の提案がある。
- [ ] (I) browser reproduction の結果（再現した / しない）が、操作手順・生の観測値・スクリーンショット（`docs/reports/screenshots/<task-name>/`）つきで記録されている。再現した場合は trigger の再設計案が添えられている。
- [ ] (J) Notebook の挙動が reducer 層のテストで確認され、Notebook が recipe 名・target・hidden fact を保存しないことが確認されている。
- [ ] (K) collision が 0 件であることがテストで確認されている。
- [ ] (L) 経済・在庫への影響が、ladder 加速の各方式について数値で示されている。

**報告**
- [ ] 最終報告に「S2 に進めるか」の判定と、S2 の blocker の更新がある。
- [ ] Owner Decision が必要な項目（OD-D3-15 / 16 / 17 / 18 ほか）に、選択肢と推奨が添えられている。
- [ ] Human Verification は、UI を変えないため対象外と明記（ただし (I) の実ブラウザ再現は、検証のための操作であり、成果物の動画は提出しない。スクリーンショットのみ commit）。

### 4.3 S1 に含めないこと

- production へのレシピ追加、ヒント・フィードバック・Notebook の挙動変更、ladder の変更、save の変更。
- 新しい Hint の UI（linear / menu の最終選択）。
- brazilian-calabresa の Reference fixture（Scoring 2.0 の参照形状）の実作成。
- 新食材（honey / bell-pepper / zucchini）と、ソースなしのレシピ（TQ-1D が前提）。

## 5. S2（brazilian-calabresa の追加）に進むための blocker

| # | blocker | 種類 | 解消の方法 |
|---|---|---|---|
| 1 | **S1 が未完** | 前提 | S1 の受け入れ条件を満たす |
| 2 | **ladder 加速の解決方式が未決**（OD-D3-17） | Owner Decision。OD-D3-5 が「実装前に必ず解決」と規定 | S1 (D) の比較から Owner が選ぶ |
| 3 | **id と表示名が未決**（OD-D3-18）。`brazilian-calabresa` は READY_WITH_REVIEW で、naming cluster NC-4（calabresa の 2 件）の review が残る。master catalog の `calabrese` とは別レシピ | Owner Decision | S1 (A) の表から Owner が選ぶ |
| 4 | **ヒントの役割データ（key）の扱い** | 設計の衝突 | `RECIPE_HINT_ROLES` は `Record<RecipeId, …>` で、新レシピに `hintKeyToppingId` の記述を**型で強制**する。OD-D3-2（key 廃止の方向）と衝突する。S1 (G) の migration 案が決まるまで、追加の形を決められない |
| 5 | **「あと少し」の oracle の結果**（OD-D3-8） | 前提 | 再現した場合は trigger 条件の再設計が先。新レシピが同じ oracle を増やす |
| 6 | **near/far の再評価**（OD-D3-7） | 前提 | S1 (H)。新しい分岐の試作で near/far がどう効くかを見てから追加する |
| 7 | **production データの追加が多岐にわたる** | 作業の見積り | 少なくとも次が要る: `RECIPES` の項目、`RECIPE_DISCOVERY_TARGET_IDS`（`Record<RecipeId, …>`）、`RECIPE_SAUCE_PROFILES`（同）、`RECIPE_HINT_ROLES`（同）、Reference fixture（`getReferencePizza`。Completion Gate のソース量と Scoring 2.0 が読む）、`CUT_ELIGIBLE_RECIPE_IDS` への追加判断、`playerReference`、W1 の 10 件は `unlockCondition` なし。ladder のテスト（`discoveryLadder.appendOnly.test.ts`、`validateLadderProgression`、`discoveryCatalog.test.ts` の 172 JSON との pin）が「全レシピは starter + W1 材料で makeable」「`POST_W1_APPENDED_STEPS` は空」を前提にしていないかの確認 |
| 8 | **ハードコードされた件数**（25 / 24）の有無 | 未確認 | S1 で grep して洗い出す（Dex の合計、HOME の表示、ranking の ruleset 等） |
| 9 | **Human Verification** | policy | Dex に新しい「？？？」が増え、FREE の発見が変わるため、`TETO_HUMAN-VERIFICATION-POLICY.md` の対象。390×844 の動画と before / after のスクリーンショットが必要 |
| 10 | **review status** | データの確度 | brazilian-calabresa は `READY_WITH_REVIEW`（naming cluster）。review が閉じていること |
| 11 | **既存 open PR との衝突確認** | 運用 | PR #295（`cookingProfiles.ts` ほか）、#319（`handPolicy.ts`）、#321（`PizzaStage.tsx`）と、追加するファイルの重なりを S2 の開始時に確認 |

S2 の「最小」は、新食材 0・ladder step 追加 0 のレシピ 1 件だが、**上の 2〜6 が決まるまでは実装に進まない。**

## 6. 未決の Owner Decision

| ID | 内容 | いつ必要か |
|---|---|---|
| OD-D3-15 | direct answer / 適切 / 広すぎる の閾値 | S1 の報告後 |
| OD-D3-16 | 「総当たり solver になりにくい」の定量的な定義 | S1 (H) の後 |
| **OD-D3-17** | ladder 加速の解決方式 | S2 の前（S1 (D) の後） |
| **OD-D3-18** | brazilian-calabresa の id / 表示名 | S2 の前（S1 (A) の後） |
| OD-D3-4 / 9 / 11 / 12 / 13 / 14 | 「なし」の価格、Notebook の場所と永続化、pack と新食材、TQ-1D の時期、hand capacity、ヒント価格 | それぞれ後続の slice の前 |
| 新（運用） | `docs/ROADMAP.md` と本書の採用、audit branch の main への取り込み、Issue #22 / #288 への適用 | 本書 §2 の順序 |
| 新（運用） | PR #295 / #296 / #321 の扱い | Owner の判断（今回は触らない） |

## 7. 次に実行すべき 1 つの task

**S1 Measurement / Migration Gate を開始する**（§4。production は変えない）。ただし、着手前に Owner が次の 2 点だけ確認すれば、S1 が迷わずに進められる: (1) `docs/ROADMAP.md` と本書の方針の採用、(2) S1 の (I) browser reproduction をこの slice に含めること（別 slice にしない）。
