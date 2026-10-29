# Sfincione — Stage 1a 詳細設計（docs-only）

Date: 2026-10-29 / Audited main: `3bc4ba63da4f7d38ea45ae1b477db18ab40f2b1f`（PR #697 の squash merge）
Branch: `claude/sfincione-stage-1a-design-p242j2`（本書のみ追加。既存設計ブランチ・#697 ブランチは未変更）

> **範囲:** 詳細設計に限る。実装・Design Lock 解除・本番公開は承認されていない。`src` / `e2e` / CSS / 設定は未変更。
> 本書の数値・配置・窓は **GAMEPLAY ASSUMPTION / CALIBRATION（原典の事実ではない）**。Owner 最終承認前の暫定案。
> **privacy sweep は実行していない。** よって DH4 / Hint 5.0 の安全性は **確定していない**（§5.3）。

## 0. Fresh State

| 項目 | 結果 |
|---|---|
| main | `3bc4ba6`（2026-10-29 21:36 +09:00）。作業ブランチはこの SHA から分岐 |
| PR #697 | **MERGED**（head `8ba2b5b`、squash → `3bc4ba6`）。Cooking Prep の変更のみ。recipes / hints / discovery を触らない |
| Fresh Plan | 設計ブランチ `claude/teto-pizza-expansion-plan-509mh8` @ `ea6cb9c`（読み取りのみ。fetch しただけで変更なし）。**main には未取り込み** |
| sfincione の既存実装 | なし（`src/` に 0 件） |
| sfincione 関連の open PR / Issue / claim | 0 件（`sfincione` 検索）。open PR 29 件のうち #540（HOLD Draft、グランマ丸生地版）のみ `recipes.ts` 等を触るが sfincione とは無関係 |
| 現在の公式状態 | Multi-Sauce Design Lock §0.2 / §8-7 と Square Dough Addendum §7: **「Sfincione stays on hold」**（原典確認まで保留）。**解除は未承認** |
| 原典 | PIZZA DB 行 `sfincione-pizzadb`（172 matrix #15、READY_WITH_REVIEW）。sauce = トマトソース（**Derived**）、doughStyle = unknown、チーズ記載なし。**live ページは本環境から未確認** |

## 1. 参照した資料

`CLAUDE.md` / `docs/PROJECT_HANDOFF.md`（冒頭〜2026-10 addenda）/ `docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md` / `TETO_SESSION-OPERATIONS_1.0.md` / `TETO_HINT-5_BASE-RUNG_OWNER-DECISIONS.md` /
`docs/reports/TETO_MULTI-SAUCE-RECIPES_Design-Lock.md`（§0 §5 §6 §8）/ `TETO_SQUARE-DOUGH_Design-Lock-Addendum.md` / `TETO_MULTI-SAUCE-RECIPES_Fresh-Audit-and-Plan.md` /
`docs/design/TETO_RECIPE_172_MECHANIC-MATRIX_ROWS.md` / Fresh Plan（上記ブランチ、§0.2.4・§6・§8 Stage 1）/
コード: `data/recipes.ts`（fugazza / grandma-pizza / pescatore / napoletana）、`recipeSauceProfiles.ts`、`recipeHintRoles.ts`、`hints.ts`、`referencePizza.ts`（FUGAZZA / GRANDMA / PUTTANESCA）、`discoveryLadder.ts`、`cookingProfiles.ts`、`freeCook.ts`、
`logic/discovery/{hint5Ladder,deductionGuard,nearMiss,deductionProduction.gate.test}.ts`、`mission/dinner/dinnerResultDetection.test.ts`。

## 2. 事実の整理（設計の前提）

- sfincione = `{tomato-sauce, olive-oil, onion, anchovy, oregano}`。fugazza = `{olive-oil, onion, oregano}` ⊂ sfincione（差は tomato-sauce・anchovy）。
- 現行 72 レシピとの材料集合の対称差（本書で再計算）: fugazza **2**、napoletana 3、brazilian-calabresa 4、marinara 4、grandma-pizza 5。**ほか全て 5 以上**。`tomato-sauce`+`olive-oil` を両方持つ既存レシピは grandma-pizza のみ（pan = tray）。`anchovy` を持つのは napoletana・puttanesca-pizza。
- matcher は完全一致（材料集合 + sauceBase + identity dimensions）。上位集合だけでは衝突しない。**ただし** fugazza＋1 品（tomato または anchovy）の試作は距離 1 の near-miss 対象になる（§5.2）。
- 全材料は既存（新規食材ゼロ）。ladder 上は oregano=step 11、onion=step 12、olive-oil=step 13、anchovy=step 15（key: napoletana）。**全材料が揃うのは step 15**。
- 計算上、現行 `FREE_COOK_BAKE_TARGET` は 58–78（72 レシピの start / end の中央値。中央付近は start=58 が 5 件連続）。

## 3. A. 材料構成（推奨案）

| 材料 | 個数 | 役割 |
|---|---|---|
| `tomato-sauce` | 1（PAINT） | **主ソース**。`RECIPE_SAUCE_PROFILES["sfincione"] = { tomato-sauce, PAINT }`。量・被覆の Reference 対象 |
| `olive-oil` | 1（PAINT_TEMPORARY） | **副ソース**。プロファイル無し・**在否のみ採点**（grandma-pizza と同一規則、Design Lock §5.3） |
| `onion` | 4 | fugazza と同数（fugazza からの差が「足す 2 品」だけになり、学習が素直） |
| `anchovy` | 2 | 新要素。napoletana は 3、puttanesca は 3。2 にして 7 ピースに収める |
| `oregano` | 1 | 最後に散らす薬味（fugazza と同じ扱い） |
| 新規食材 | **なし** | |

- 非ソースのピース = 4+2+1 = **7（8 スロットのリング以内、余裕 1）**。トレイ表示は Guided＝必要食材のみ（5 種）で既存 390×844 / 360×800 の 6 タブ・ピル制約に収まる（新 UI なし）。代替 B: onion 3 / anchovy 2 / oregano 1 = 6（窮屈なら降格）。
- 追加順序（案内順・ヒント順。**プレイヤーの実際の順序は拘束しない**）: DOUGH → SAUCE（tomato → olive-oil）→ （CHEESE は対象なし）→ TOPPING（onion → anchovy → oregano）→ BAKE。`deriveCoreSteps` は DOUGH, SAUCE, TOPPING（CHEESE は材料なしで省かれるかを実装時に確認。grandma は CHEESE あり）。
- 配置（RT-01 の 8 スロット・リングを `requiredIngredients` 順に消費する通例に従う。座標は実装時の校正値で、ここでは役割のみ固定）: onion = 4 方向に分散、anchovy = 上下の 2 点（puttanesca の y=22 / 78 に倣う、重ならない縦向き）、oregano = 中央付近 1 点（fugazza の (51,46) に倣う）。tolerance は標準 8/22。
- **fugazza との差別化**: ① 赤いソース層がある ② 小魚（anchovy）が見える ③ ソース 2 層。ピース配置は fugazza と同系統なので、**色（赤）で識別**でき、形状の新規作成は不要。

## 4. B. ソース 2 層の比較

olive-oil は焼成前 `PAINT_TEMPORARY`（**GAMEPLAY ASSUMPTION。原典の工程は未確認**。説明文はタイミングに言及しない）。

| 観点 | 案 1: tomato → olive-oil | 案 2: olive-oil → tomato |
|---|---|---|
| 描画 | 油が赤の上に載る。#519 の見え方問題（油が赤を隠す）を S1（`SAUCE_OIL_OVERLAP_ALPHA_FACTOR = 0.3`）で解消済み。回帰条件（rendered-pixel E2E）は **この順序**を対象にしている | 赤が上に来て油が下に隠れ、**油の存在が視覚的に伝わりにくい**。#519 のケースは「安全側」だが油の役割が見えない |
| 操作 | 「主ソース→仕上げ油」という grandma と同じ手順。tray の並び＝要求順 | 手順が grandma と逆。プレイヤーの学習が割れる |
| 採点 | 順序非依存（presence）。差なし | 同左 |
| Multi-Sauce 仕様 | `buildHintLine`（S2）は `requiredIngredients` 順で最初の不足ソースを案内 → **tomato→oil の順で自然に誘導**。grandma の既存テスト・文言と同形 | 要求順を逆にする＝プロファイル（主ソース）と先頭ソースがずれる |
| 既存回帰 | 既存の E2E / 単体を再利用できる | 新規に追加・校正が必要 |

**推奨: 案 1（tomato-sauce → olive-oil）**。`requiredIngredients` を `[tomato-sauce, olive-oil, onion, anchovy, oregano]` の順にする。描画・誘導・回帰資産が grandma と共通で、追加の新機構が不要。**プレイヤーが逆順で塗っても採点・マッチは同一**であること（両順序テスト）を G-S6 の必須項目とする。
- 文言案: `empty`「指でなぞってトマトソースを塗ろう！」/ `missing["olive-oil"]`「オリーブオイルも塗ってみよう！」/ 説明文は「トマトソースとオリーブオイルに、たまねぎとアンチョビ、オレガノをのせた、素朴な一枚。」（タイミング・原産・生地に言及しない）。

## 5. C. DH4 / Hint 5.0

### 5.1 前提（実装から確認した事実）

- key-free ladder の SAUCE 段は **「そのレシピの全ソース」** を返す（`hint5Ladder.ts` の `inCategory("sauce")`）。部分開示の仕組みは無い。
- Hint 5.0 自体に **k≥2 ルールは無い**（OD-H5-P1 / P2、`hint5Ladder.ts` 冒頭）。k≥2 は **DH4 の `deductionGuard`**（分割の各クラスが各カテゴリ側で ≥ 2 メンバー）に存在する。
- near-miss は本番では「近い／遠い」の汎用 1 行に中和済み（方向は漏れない）。ただし **「近い判定が出るか否か」自体は出る**。
- BASE 段（BASE-RUNG Owner Decisions）は **フラグ OFF（PR-D/E 未）**。本書は現行 ladder（SAUCE→CHEESE→STRUCTURE→SUB_CLASS）を前提にし、BASE ON の場合は再評価が必要。
- grandma の承認（OD-544-3）は **`grandma-pizza` 限定**。sfincione へ自動拡張しない。

### 5.2 案 A / 案 B の比較

| 観点 | 案 A: tomato-sauce のみ明示 | 案 B: tomato-sauce と olive-oil の両方を明示 |
|---|---|---|
| grandma との整合 | **不整合**（grandma は両方明示で承認済み） | 整合（同一規則）。ただし承認は sfincione へ**未拡張** → 新規 Owner 承認が要る |
| 実装コスト | SAUCE 段の「一部のみ」開示という **新しい ladder セマンティクス**（`hint5Ladder` の変更、golden・production gate の更新）。`src` 変更が必須 | 既存規則そのまま（データ追加のみ）。`keyFree: true` |
| 段階的開示 | 「ソース」ラベルで片方だけ→不完全。購入後に olive-oil が必要と分かるのは試作失敗後 | 「ソース＝全ソース」で一貫。段の意味が変わらない |
| near-miss | 影響は同じ（matcher 側）。A でもプレイヤーが tomato だけ塗れば `MISSING olive-oil` の距離 1 → 汎用「近い」。ヒントの不完全さが近い判定の原因になり**混乱しやすい** | 同左だが整合した導線 |
| 種別（family） | SUB_CLASS 3 段: onion=vegetable、anchovy=seafood、oregano=herb。**全て別 family**（同 family の重複なし） | 同左（ソース段の選択と無関係） |
| k≥2 | Hint 5.0 には無し。DH4 は**スイープ未実行のため判定不能** | 同左 |
| 未発見レシピの漏えい | olive-oil は既存 11 レシピ共有で秘匿価値は低い。A の「保護」は小さい | SAUCE 段（10 Pitz）で `{tomato, oil}` と分かる → 2 ソースのレシピは **grandma-pizza と sfincione の 2 件**に絞れる。さらに STRUCTURE（総数 4 vs 5）で 1 件に確定。grandma 単独時は SAUCE 段だけで確定していたため**漏えいの形が変わる**（k=2 になる反面、sfincione 側にも同種の漏えいが生まれる）。所持材料（anchovy 未所持 = step 15 未満なら sfincione 不成立）でさらに絞られる可能性 |
| production gate / privacy sweep | 必要（ladder 変更のためより広範） | 必要（`GATE_STATES` に sfincione を入れた全スイープ、`hint5Production.gate`） |

**推奨: 案 B（条件付き）**。理由: ① grandma と同一規則で、ladder 側の `src` 変更が不要 ② 案 A は新セマンティクスと golden 更新を要し、保護効果が小さい ③ SAUCE 段の「全ソース」不変条件を守れる。**ただし**次の条件が満たされるまで安全とは確定しない: (a) Owner の G-S3 承認（grandma 承認の拡張ではなく sfincione 個別）、(b) DH4 / Hint 5.0 の privacy sweep を `GATE_STATES` に sfincione を加えて実行し、新規リークが 0 であること。**スイープで 2 候補への絞り込みが許容できないと判明した場合は、案 A ではなく sfincione の保留継続を第一選択とする**（A は別の ladder 変更になるため）。

### 5.3 privacy sweep の実施状況

**未実施。** 理由: スイープ（`deductionProduction.gate.test.ts`、`hint5Production.gate.test.ts` 等）は対象レシピが `RECIPES` / discovery catalog / `recipeHintRoles` に存在して初めて意味を持ち、そのためには `src` の変更が必要（今回は禁止）。この環境では依存も未導入。**本書の漏えい評価は集合論的な机上評価であり、安全性の確定ではない。** 追加で `deductionProduction.gate.test.ts` の「ソースは 1 つのみ（NO_SAUCE 除く）」系アサーションは、grandma 用の allowlist（`multiSauceRecipeIds()`）に sfincione を追加する形で更新が要る（全削除は不可、Design Lock §5.4）。

## 6. D. 焼成・報酬

| 項目 | 推奨（暫定） | 根拠・注意 |
|---|---|---|
| 焼成窓 | **60–80**（幅 20、JUST は既存 `classifyBake5` に従う） | 参照: fugazza 63–83 / grandma 56–76 / generic 58–78。厚みのあるパン系なので長め。**start ≥ 58 かつ end ≥ 78** なので、`FREE_COOK_BAKE_TARGET`（全レシピ中央値）は **動かない**（計算で確認済み。56–76 にすると中央値 start が 58→56 に動き `bake5.test` 等が壊れる前例あり＝Batch 8b）。ゼロリスク案は 58–78 |
| 焼きすぎ | 窓の end 超過は焦げ＝Completion Gate 失敗（#482：margin 0、★・Pitz・Dex 無し） | 既存規則。sfincione 固有の例外なし |
| 報酬 | `baseRewardPitz: 100`（共通）。FREE のみ・初回 1 回（Pitz Reward V1） | 既存 |
| Dex | 一致時に既存経路で登録。新規食材なし → taxonomy 行・材料追加なし | |
| FREE 解禁 | 専用 `unlockCondition` なし。**全材料が揃う ladder step 15（anchovy）以降に作成可能**。新 ladder step を作らない。`mysteryLock` は付けない（既存の匿名枠規則は Owner 判断） | grandma と同方式 |
| `ladderCredit: false` | **妥当**。新素材ゼロ＝ladder step を足す根拠がなく、credited を増やすと #561 の slack ゲート（`ACCEPTED_MIN_SLACK = 1`）に影響する。前例: grandma / brazilian-calabresa | credited にする案は新 step が必要で却下 |
| `lunchRush: false` | **妥当（暫定）**。Design Lock §0.5「Lunch Rush は当面除外」の対象＝複数ソース。`participatesInLunchRush` はこの 1 フラグのみ参照 | **Dinner Mission は別経路の可能性が未検証**。grandma は tray のため Dinner で識別不能（テスト有）だが、sfincione は丸型なので **Dinner の識別対象になる**。→ G-S6 で Dinner の出題・識別への影響を確認（未検証） |

## 7. E. 形状・CUT

| 観点 | 標準丸型・CUT なし（第一候補） | 角型 tray（比較） |
|---|---|---|
| 原典再現性 | 低〜中。実在の sfincione は厚い角型のパン生地とされるが（一般知識。PIZZA DB の doughStyle は unknown で**根拠にできない**）、ゲームでは丸型へ簡略化 | 高い（厚い角型に近い）。ただし doughStyle は未記録で根拠不足 |
| 実装の簡潔さ | 高い。既存の丸 Reference・tolerance を流用、pan 軸を使わない | 低い。pan 軸の同定・Square Dough（#533/#538）依存、Dinner 識別不可、tray 所持前提 |
| matcher | 識別＝材料集合のみ。fugazza とは**集合差で分離**（上位集合だが完全一致なので衝突しない） | pan 軸が fugazza との分離を追加で与える（利点）。ただし 2 ソース tray は grandma と同形で **tomato+oil+tray の曖昧さ**が生じうる |
| CUT | 非対象（`CUT_ELIGIBLE_RECIPE_IDS` に入れない＝既定）。焼成後工程なし。Multi-Sauce の CUT は初期スコープ外（Design Lock §0.7） | 同左 |

**結論: 標準丸型・CUT なしは暫定案として妥当**（簡潔さと既存回帰資産を優先、原典再現性の低下は「ゲーム上の簡略化」と明記）。角型は Square Dough の Gate 解消後の将来案として Owner 判断事項に残す。

## 8. 設計 Gate G-S1〜G-S8

| Gate | 現状 | 次に必要な作業 |
|---|---|---|
| **G-S1** Design Lock 解除 | **未解除**（保留中。Owner 未承認） | (1) PIZZA DB の sfincione 行を Owner が live 確認（材料不変・焼成前の油と矛盾しない・生地）。(2) Owner の明示解除。(3) Multi-Sauce Design Lock §8-7 / Addendum §7 の更新（docs） |
| **G-S2** 材料構成・配置の Owner 承認 | **未承認**（§3 は提案） | Owner が個数（4/2/1）・順序・差別化・丸型を承認 |
| **G-S3** Multi-Sauce ヒント仕様承認 | **未承認**。OD-544-3 は grandma 限定で**未拡張** | Owner が案 B（SAUCE 段に両ソース）を sfincione 個別に承認（または保留継続）。2 候補への絞り込み（§5.2）の可否を判断 |
| **G-S4** DH4 / Hint 5.0 production gate | **未実施**（sfincione が catalog に無く実行不能） | 実装時に `GATE_STATES` へ追加して全 gate を実行。`multiSauceRecipeIds()` allowlist への追加（blanket 削除は不可）。BASE 段（OFF）併用時は再評価 |
| **G-S5** privacy sweep | **未実施。安全性は未確定** | G-S4 と同時に seeded / 全順列スイープ。`meta:ingredient-total`・`attr:category`・sauce-side guard・`preExistingPublic` を確認。結果が出るまで「安全」と書かない |
| **G-S6** matcher / near-miss / golden 回帰 | **未実施** | (a) fugazza↔sfincione の識別テスト（双方向、距離 2）。(b) fugazza＋tomato / ＋anchovy の near-miss 変化（距離 1）が既存レシピの挙動を変えないこと。(c) tomato→oil / oil→tomato 両順序で採点・一致が同一。(d) 数値 pin の再生成（recipes 72→73、catalogLedger、recipeBatchManifest、hint5 golden は append-only、ladder は step 追加なし）。(e) `FREE_COOK_BAKE_TARGET` 不変（start ≥ 58 / end ≥ 78）。(f) Dinner Mission の識別・出題への影響。(g) Research cohort 文字ドリフト 0（fugazza の cohort との関係を確認）。(h) 既存 72 レシピの採点バイト同一 |
| **G-S7** iPhone Safari HV | **未実施（対象外：docs-only）** | 実装 PR で HV Policy に従う（390×844 動画＝直接提出、before/after スクショ＝`docs/reports/screenshots/sfincione-stage-1a/`）。tomato→oil の実機描画（#519 条件）を必ず含める |
| **G-S8** 本番公開前確認 | **未実施** | 本番フラグ・公開は別の明示承認。Preview 検証、save 互換（新 recipe id の追加のみ・schema v2 不変・旧ビルドで再保存可）、最終 Owner Gate |

## 9. Owner 判断が必要な項目

1. 保留中の sfincione の **Design Lock 解除**と、PIZZA DB 行の live 確認（G-S1）。
2. 材料構成: onion 4 / anchovy 2 / oregano 1（7 ピース）か、窮屈回避の 6 ピース案か（G-S2）。
3. **SAUCE 段に 2 ソースを出す案 B** の個別承認（grandma 承認の拡張ではない）。許容できなければ保留継続（G-S3）。
4. 丸型・CUT なし（暫定）で進めるか、角型（Square Dough 待ち）に倒すか。
5. 焼成窓 60–80（中央値不変）か 58–78（ゼロリスク）か。
6. `ladderCredit: false` / `lunchRush: false` の確定、Dinner Mission の扱い。
7. 説明文・id・表示名（`sfincione` / スフィンチョーネ）。

## 10. Stage 1a 評価

**CONDITIONAL。** 設計案（§3〜7）は新規食材ゼロ・既存規則の再利用で完結し、衝突の構造的リスクは低い（fugazza との集合差 2、完全一致 matcher）。ただし G-S1〜G-S3 は Owner 承認待ちで、G-S4〜G-S6 は実装前に実行できないため、**DH4 / Hint 5.0 の安全性は未確定**。BLOCKED ではない（案 B は新機構なし）が、privacy sweep の結果次第で保留継続もあり得る。
