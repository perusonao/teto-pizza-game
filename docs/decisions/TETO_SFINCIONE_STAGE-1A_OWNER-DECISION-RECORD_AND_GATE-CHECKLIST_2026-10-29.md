# Sfincione Stage 1a — Owner Decision Record & Gate Checklist

Date: 2026-10-29 / Audited main: `3bc4ba63da4f7d38ea45ae1b477db18ab40f2b1f`（PR #697 merged 後）
Branch: `claude/sfincione-stage-1a-design-p242j2`（前回の設計書 commit `b4e1cb5` の上に docs を追加。設計書本体は未改変）
Design 資料: `docs/design/TETO_SFINCIONE_STAGE-1A_DETAILED-DESIGN_2026-10-29.md`

> **この記録は、実装開始承認・Design Lock 解除・privacy 安全性の承認のいずれでもない。**
> Stage 1a の評価は **CONDITIONAL のまま**。実装なし、PR / Issue / Monitor なし、`src` / `e2e` / CSS / 設定は未変更。

## 1. Owner 暫定方針（設計候補としての記録）

| 項目 | 候補値 | 区分 |
|---|---|---|
| 材料 | tomato-sauce ×1 / olive-oil ×1 / onion ×4 / anchovy ×2 / oregano ×1 | GAMEPLAY CALIBRATION（原典の数量ではない） |
| 主・副ソース | tomato-sauce = 主（PAINT、Reference 対象）／ olive-oil = 副（PAINT_TEMPORARY、在否のみ採点） | olive-oil の焼成前塗布は **GAMEPLAY ASSUMPTION** |
| ソース順 | tomato-sauce → olive-oil を推奨。**逆順でも採点・matcher の結果は変えない**（両順序テストが必須） | 推奨（案内順であり操作の強制ではない） |
| 形状・工程 | 標準丸型生地 / CUT なし / 焼成後工程なし | 暫定（原典の厚い角型からの簡略化） |
| 焼成窓 | 60〜80（`FREE_COOK_BAKE_TARGET`＝全レシピ中央値 58–78 を動かさない範囲） | 暫定 |
| 報酬 | 初回 100 Pitz（FREE のみ・1 回） | 既存規則 |
| 解禁 | ladder Step 15（anchovy）以降。新 step なし | 既存 ladder 派生 |
| フラグ | `ladderCredit:false` / `lunchRush:false` / key-free | 暫定 |
| ソースヒント | DH4 / Hint 5.0 は **案 B（SAUCE 段に tomato-sauce と olive-oil の両方）を検証候補**とする | **検証候補であり承認ではない** |

承認状況（上記すべて）: **未承認**。grandma-pizza の既存承認（OD-544-3 等）は sfincione に拡張しない。

## 2. 原典・Design Lock Gate

### 2.1 Design Lock「Sfincione: stays on hold」の原文と理由

- `TETO_MULTI-SAUCE-RECIPES_Design-Lock.md` §0 項目 2: 「**スフィンチョーネ**: on hold until its evidence is confirmed.」
- 同 §8 項目 7: 「Sfincione: stays on hold (no action).」／§8 per-item 表 8-7: 「Recorded as decided in #521（not re-verified）」（#521 コメント 6247267082）。
- Square Dough Addendum §7「Sfincione stays on hold.」。
- 理由（原文の根拠）: Fresh Audit and Plan の Owner 判断欄「sfincione: go / hold（**tomato is family-derived; dough style unrecorded**）」。すなわち **①トマトソースは `sauceFamily` からの派生で原典に明記されていない ②生地の種類が未記録**。加えて原典（pizzadb.jp）が本環境から確認できていない。
- Owner の #521 コメント（2026-10-18）の確定欄: 「スフィンチョーネは保留」。**以降、解除の記録はない**（#521 コメント全文・Design Lock・Addendum を確認）。

### 2.2 原典確認が必要な項目

1. 材料一覧が `onion / anchovy / oregano / olive-oil` のまま変わらないこと（チーズの有無を含む）。
2. **トマトソースが原典のベースに含まれるか**（現状は family-derived）。
3. **olive-oil が焼成前か仕上げか**（grandma と同種の未記録事項）。
4. **生地の形状・種類**（厚い角型か。丸型簡略化の可否、pan 軸を使うか）。
5. 名称・別名（`siciliana` / `sfincione-pizzadb` の三者関係が Phase 0B で「別物として維持」とされている点）。

### 2.3 現行 matrix と原典の差分

| 項目 | repo 内の記録 | 原典（live） |
|---|---|---|
| 行 | `sfincione-pizzadb`（172 matrix #15、`READY_WITH_REVIEW`、blockers なし、`MULTI_SPREAD_LAYER`→MAJOR） | **未確認** |
| 材料 | `onion, anchovy, oregano, olive-oil`（comparison table の canonical。`ingredientsJa: null`） | 未確認 |
| ソース | `sauceFamily: トマトソース`、matrix 上 `sauceStatus: family_derived`（tomato-sauce は **Derived**） | 未確認 |
| 生地 | `doughStyle: null`、`origin: null`。matrix: `shape: round / open-round`、`pan: null`、CUT optional | 未確認 |
| 後乗せ | `lateAdditions: []`（記載なし。「なし」の確認ではない） | 未確認 |
| 証跡の種別 | `comparison_table_sample`、**corroboration 1**（compare 一覧 page 4）、`verifiedAt` 2026-09-22 **Phase 0B relay**（中継） | 個別ページ未取得 |

差分として確認できた点: 設計書の「丸型」「トマトソースあり」は **matrix の派生値に依拠**しており、原典の事実ではない。matrix は原典との差を検出できる状態にない（独立再取得 0 件）。

### 2.4 grandma-pizza との承認範囲の違い

| 項目 | grandma-pizza | sfincione |
|---|---|---|
| Design Lock §8-3（SAUCE 段が両ソース） | **承認（OD-544-3）、grandma 限定** | **未承認**。拡張しない |
| 例外 allowlist（OD-544-2） | 「複数ソース例外は `grandma-pizza` **に限定**」 | 追加には**新たな Owner 判断**が要る |
| id / 名称 | 確定 | 未確定（`sfincione` / スフィンチョーネは提案） |
| `ladderCredit:false`, TQ-3 先行 | 確定 | 未確認（個別承認なし） |
| 生地・pan | `panShape: square` + `pan: tray`（Owner 決定、丸い先行公開は禁止） | 丸型簡略化は**未承認** |
| 原典確認（§8-1） | **未完了で E をブロック**（grandma も同様） | 未完了。かつ保留理由そのもの |
| 位置づけ | 実装済み（main に存在） | 実装なし・保留 |

### 2.5 HOLD 解除に必要な証跡

1. pizzadb.jp の個別ページ（またはそれに準ずる原典）で §2.2 の 5 項目を確認し、取得者・取得日・URL・引用 / 要約の別を記録（#587 の方式。中継のみなら `independentlyVerified: false` と明記）。
2. 確認後の matrix 差分の反映（`sauceStatus`、`doughStyle`）。**確認なしに READY へ変更しない。**
3. Owner による保留解除の明示的な決定（Design Lock §8-7 / Addendum §7 を更新する docs の根拠）。
4. §3 / §4 の Gate を満たす計画の承認。

### 2.6 live 確認の試行結果（2026-10-29）

`https://pizzadb.jp/compare/world-pizzas/page/4/` を本環境から取得しようとして **プロキシが CONNECT 403** を返した（`curl`、サイト全体も同様）。過去の複数セッション（#521、#612）の記録とも一致する。**原典は未確認**であり、推測で READY にしない。確認先: 上記 URL と、比較表から特定する個別ページ。到達できる環境、または Owner / ChatGPT 経由での取得が必要。

### 2.7 Owner が最終承認すべき項目

保留解除／材料構成（個数）／丸型・CUT なし／焼成窓／`ladderCredit` と `lunchRush`／id・名称／**複数ソース例外の個別追加**／**SAUCE 段の案 B**／Dinner Mission の扱い／privacy sweep の結果の受け入れ。

## 3. DH4 / Hint 5.0 Gate 準備

> 注: 前回設計書は allowlist を `multiSauceRecipeIds()` と書いたが、実在する名前は **`MULTI_SAUCE_RECIPE_IDS`**（`src/logic/testSupport/requiredSauces.ts`、現在 `["grandma-pizza"]`）。設計書は改変せず、ここで訂正する。

### 3.1 各 Gate の条件と手順

| 項目 | 条件・手順 |
|---|---|
| **Multi-Sauce 許可リスト追加条件** | (1) OD-544-2 の「grandma 限定」を解く Owner 判断。(2) sfincione は丸型（tray でない）ため **`MULTI_SAUCE_RECIPE_IDS` にのみ追加**し、`PAN_TRAY_RECIPE_IDS`（技法要求の集合）には**入れない**。(3) 追加は DH4 / Hint 5.0 の privacy 再実行と Anti-Oracle §15 の再計算とセットで行う意図的な作業（コード中のコメントの定め）。blanket 削除は不可 |
| **Hint 5.0 SAUCE 段の個別承認条件** | key-free ladder の SAUCE 段は「全ソース」を返す（`hint5Ladder.ts`）。案 B は同規則のままで `src` 変更不要。承認条件: (a) sfincione 個別の Owner 承認（OD-544-3 は自動拡張しない）、(b) 2 ソースのレシピが grandma と sfincione の 2 件になり、SAUCE 段（10 Pitz）だけで 2 候補に絞れることの受容（STRUCTURE の総数 4 vs 5 で 1 件に確定）、(c) privacy sweep の結果。許容できない場合は「案 A」ではなく**保留継続**を第一選択（A は ladder の新セマンティクスと golden 更新を要する） |
| **DH4 guard の k≥2 条件** | `deductionGuard.ts`: DH4-1 の回答は、仮説集合 H の各回答クラスが**各カテゴリ側（sauce / cheese / topping）で ≥ 2 メンバー**のときのみ使う（`partitionAllowsDh41`）。TC-G（`toppingClauseAllowedForParts`）も各 side ≥ 2。**Hint 5.0 自体に k≥2 規則はない**（OD-H5-P1/P2）。sfincione の追加で H・分割が変わるため、**実行なしには判定できない**（未判定） |
| **near-miss の tie 条件** | `nearMiss.ts`: 距離最小の候補を採用し、`<` 比較のため**同距離は `compareHintCandidates` の順序で先勝ち**。同一 identity key の target は `colliding` として**候補から除外**（matcher が AMBIGUOUS になるため）。pan 軸が異なる target は候補外（grandma は tray なので丸型 sfincione と相互に候補にならない）。sfincione 追加後に確認: (a) fugazza(距離 2)・fugazza+1 品(距離 1)の挙動、(b) 同距離の複数 target（napoletana / puttanesca 等）が混在する状態での選択の決定性、(c) 本番の中和（汎用 1 行）が維持されること（方向性の漏れなし） |
| **production gate の実行手順（実装 PR 時）** | `deductionProduction.gate.test.ts` と `hint5Production.gate.test.ts` を、`MULTI_SAUCE_RECIPE_IDS` に sfincione を追加した状態で全実行。「ソースは 1 つ（NO_SAUCE と allowlist を除く）」「技法要求集合 = NO_SAUCE ∪ PAN_TRAY ∪ …」の双方向一致が保たれること。`GATE_STATES` は sfincione を含めて再生成され、状態数（現行 `> 2000`、全レシピ − margherita）を Result に記録 |
| **privacy sweep の実行手順（実装 PR 時）** | 上記 gate 内の seeded / 全順列スイープ（`meta:ingredient-total`、`attr:category` fact、sauce-side guard、`preExistingPublic` の決定論的列挙、attacker speed-up）を sfincione 入りで実行。新規リーク 0、既存の許容集合が増えないことを確認。さらに **Anti-Oracle §15 の複数ソース前提での再計算**（OD-544-8：E の Final Gate 前必須・**未実施**）を、2 ソースのレシピが 2 件の状態で行う |
| **golden 更新時の確認事項** | hint5 ladder golden は append-only（既存エントリの変更 0、sfincione は追記のみ）／件数固定テスト（recipes 72→73、`catalogLedger`、`recipeBatchManifest`）のみ再生成／B1 consume-hash 等の「finite set」系は理由を Result に記載／Research cohort の文字（A/B/C）ドリフト 0（OD-544-4/5/6：既存レシピの文字が意図せず変わらない。変わる場合は明示 allowlist と Owner 承認）／ladder に新 step を足さない |
| **既存レシピ回帰条件** | 既存 72 レシピの採点・一致・Hint 5.0 ladder・near-miss が**バイト同一**（sfincione 追加分を除く）。fugazza↔sfincione の識別（双方向）、fugazza＋tomato / ＋anchovy の近接挙動、grandma の tray 識別が不変、両順序（tomato→oil / oil→tomato）で結果同一、`FREE_COOK_BAKE_TARGET` 不変、Dinner Mission の識別・出題への影響（丸型なので識別対象になる。未検証） |

### 3.2 今回実行しないこと（理由つき）

- 上記テストの実行は、sfincione を `RECIPES` / catalog / `RECIPE_HINT_ROLES` に入れる `src` 変更が前提のため**実行していない**（依存の導入もなし）。
- **privacy sweep 実施: なし。DH4 / Hint 5.0 の安全性は未確認。Gate は未完了と記録する。**

## 4. Gate Checklist（G-S1〜G-S8）

| Gate | 現状 | 次に必要な作業 | 完了条件 |
|---|---|---|---|
| G-S1 保留解除 | 未完了（保留中） | 原典確認（§2.2、取得者・日付を記録）→ Owner の解除決定 → Design Lock §8-7 / Addendum §7 の docs 更新 | 証跡 + Owner の明示記録 |
| G-S2 構成・配置承認 | 未承認（§1 は暫定） | Owner が個数・順序・丸型・焼成窓・フラグを承認 | Owner 記録 |
| G-S3 ヒント仕様承認 | 未承認（案 B は検証候補） | sfincione 個別の承認、2 候補絞り込みの受容判断 | Owner 記録 |
| G-S4 production gate | 未実施 | 実装 PR で allowlist 追加と全 gate 実行 | 全 gate green、状態数を記録 |
| G-S5 privacy sweep | **未実施・安全性未確認** | G-S4 と同時に sweep、Anti-Oracle §15 再計算 | リーク 0 の Result |
| G-S6 回帰（matcher / near-miss / golden） | 未実施 | §3.1 の回帰条件を実装 PR で実行 | 既存 72 レシピ不変 |
| G-S7 iPhone Safari HV | 対象外（docs-only） | 実装 PR で HV Policy に従う（390×844 動画は直接提出、before/after スクショ、tomato→oil の実機描画 #519 条件を含む） | Owner の HV PASS |
| G-S8 本番公開前確認 | 未実施 | 本番フラグ・公開は別の明示承認、save 互換（新 recipe id の追加のみ） | Owner 承認 |

## 5. Owner の追加判断事項

1. **保留解除の可否**と、原典確認の方法（Owner / ChatGPT 経由での取得、取得日と引用の記録）。
2. 原典で「トマトソースが明記されない」場合の扱い（family-derived のまま採用するか、保留継続か）。
3. **複数ソース例外を grandma 限定から sfincione へ広げる**か（OD-544-2 の改訂）。
4. 案 B（両ソース明示）で 2 候補に絞れる点の受容。不可なら保留継続。
5. 生地: 丸型簡略化（暫定）か、原典が厚い角型と判明した場合に Square Dough 待ちへ回すか。
6. Dinner Mission での扱い（丸型は識別対象になる）。
7. id・表示名・説明文。

## 6. 評価

**Stage 1a: CONDITIONAL（維持）。** 設計案は既存機構の再利用で閉じるが、保留理由（原典の裏付け）が未解消で、G-S1〜G-S3 は Owner 待ち、G-S4〜G-S6 は実装前に実行不能。privacy sweep は未実施。READY にしない。
