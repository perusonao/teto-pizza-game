# 大葉（shiso-leaf）A+D 実装準備 — 変更範囲・受入条件・iPhone HV・競合監査（docs-only、実装なし）

- 日付: 2026-11-06 / 基準 main `785d7956b42eac97e42dbd138818262a16c0a91c`（再確認。直近の監査から変化なし）
- 前提資料: `docs/reports/TETO_INGREDIENT-ICONS_733-758_Fresh-Audit.md`（本ブランチ `claude/teto-ingredient-icons-audit-du85eg`）
- 状態: **準備のみ。実装・PR 作成・merge・Production ON・共有 Preview 更新は行っていない。** claim も投稿していない（§7 に下書き）。
- Owner 方針（今回の指示）: 牛肉・ピーマンは現状維持 / 大葉は SVG の葉脈・輪郭の改善（A+D）を第一候補 / **1.35em は維持**、**CSS と `PizzaStage.tsx` は変更しない**

> **訂正（2026-11-06）:** #733 の claim のうち `IngredientGlyph.tsx` を含むのは、元セッション A（`session_013m8Cb3EYN655PaiWrWXo7E`）の最新 claim `6651022526` のみ。セッション B（`…6oQ84…`）の `6657071151` は含まない。着手条件・最終版のコメント案は `TETO_INGREDIENT-ICONS_758-SHISO-AD1_Pre-Start-Package.md` を優先する。

## 1. #733 の完了条件と claim の状況

### 1.1 完了条件の充足（GitHub で再確認）

| 条件（#733 Owner 決定・Result より） | 状態 |
|---|---|
| OD-1 牛肉＝B 角切り＋断面 / OD-2 ピーマン＝R1 輪切り×2 / OD-3 visual ID 維持 | ✅ **PR #760 が 2026-11-06 04:04 UTC に merge**（`537ed09`）。main のコードで確認済み |
| OD-6 識別テスト（beef vs bacon/ham 等、pepper vs okra 等） | ✅ #760 に含まれる（`IngredientGlyph.test.tsx`、`e2e/issue-733-icons.spec.ts`）。本監査で E2E 4/4 を再実行して pass |
| OD-A 炒め済み牛肉の色 B′ | ✅ main の `BEEF_COOKED_COLORS` が承認値（`#8a4729 / #66361e / #7f4628 / #7f4628 / #34190e`）と一致 |
| iPhone Safari HV（beef・green-pepper の見た目） | ✅ **Owner が PASS を報告**（#760 コメント、2026-11-06）。ただし **統合ビルド（main `d85b957` + #760 + #761 + #765）での確認で、#760 単独 HEAD ではない**。炒め済み牛肉の最終色の承認は別（Owner コメントは見た目のみ） |
| OD-4 梅肉・しらすは維持 | ✅ 変更なし |
| OD-5 大葉は別 Issue | ✅ #758 / #761 |
| Style Lock V2 / references README への反映 | ⏳ **未了**（#753 の merge 後に docs-only。#753 は open のまま） |
| visual ID の改名（`green-pepper-strips` / `beef-slices`） | ⏳ 別 Gate（#748 claim 終了後、OD-3） |
| #733 本体の close | ⏳ open のまま。**close する条件は Owner 判断**（§8 OD-P1） |

注意: `docs/reports/TETO_ISSUE-733_ICONS_Result.md` の「iPhone 実機 HV は未実施」は #760 merge 前の記述で、**現在は Owner の PASS 報告と食い違う（古い）**。更新するなら別の docs-only 作業。

### 1.2 claim の解放状況

| claim | セッション | 対象 | 期限 | 解放の記録 |
|---|---|---|---|---|
| #733 `6650393214`（初回） | `session_013m8Cb3EYN655PaiWrWXo7E` | IngredientGlyph.tsx 等 | 2026-11-08 06:00Z | **なし** |
| #733 `6650986065` | 同上 | + beefDoneness / CookingPrep.css / cooking-prep spec | 同上 | **なし** |
| #733 `6651022526`（pr=760） | 同上 | + docs/design/candidates | 同上 | **なし** |
| #733 `6657071151`（OD-A） | `session_013m8Cb6oQ84jbLXhXw1sFbm`（別セッション） | `beefDoneness.ts`、`cooking-prep.spec.ts` 等 | 2026-11-08 12:00Z | **なし** |

→ **PR #760 は merge 済みだが、#733 の claim は release コメントが無い**（期限 2026-11-08 まで有効扱い）。**`src/components/IngredientGlyph.tsx` は #733 claim の対象に含まれている**ため、大葉の実装（同じファイル）は、**期限切れまたは release の確認が取れるまで claim 上は重複**になる。claim は警告のみでロックではない（SESSION-OPERATIONS §1）が、他担当の claim は変更しない方針なので、**release は元セッションまたは Owner の判断**（§8 OD-P2）。

### 1.3 #758 の claim

- コメント `6679761024`（2026-11-06 07:35）に `"released": true` を確認。対象は `src/App.css`、`e2e/issue-758-shiso.spec.ts`、`docs/reports/TETO_ISSUE-758_*`、`docs/reports/screenshots/issue-758-shiso/**`。**解放済み**。
- #758 は open のまま（#761 は merge 済み）。**今回の A+D は `App.css` を触らない**ので、この claim 対象とも重ならない。

## 2. 競合 Fresh Audit

### 2.1 claim・open PR・関連ブランチ

| 項目 | 状態 | 大葉 A+D への影響 |
|---|---|---|
| **#748 claim**（recipes / ingredients / lateCatalog / ladder / referencePizza / taxonomy / toppingSizeClass / golden / b18 e2e） | 期限 2026-11-19。PR #759 は merge 済みだが **release コメントなし** | **重ならない**（大葉 A+D は `ingredients.ts` を触らない） |
| **Batch 19（burrata）** | **#748 のコメント `6673566588`（2026-11-06 00:48、Owner R2 決定）で確認できた**。burrata の専用 SVG は **C（上が割れてクリームが見える）**、pesto-burrata と pizza-alla-crudaiola の 2 レシピ（crudaiola は Jaccard 0.429 の例外を承認）。**Issue・PR・claim は未起票**。資料はブランチ `claude/burrata-preflight-docs-8auzii`（`d39a680`、docs-only） | 実装時に **`IngredientGlyph.tsx` と `ingredients.ts` を編集**する予定。大葉と同じファイルだが **別の関数・別の行**（§2.2）。着手の前提（#759・#765・#760 の merge）は **3 つとも満たされた**。残りは「claim が解消され、Owner が実装を承認」 |
| **Icons R2（rosemary / oregano / spinach / artichoke）** | #748 の同コメントで Owner が設計候補を承認（rosemary B、oregano B、spinach A2、artichoke A2、1.2em 基準）。資料は `claude/herb-icons-compare-docs-8auzii`（`c9351e4`、docs-only）。**実装は未起票** | **`IngredientGlyph.tsx`・`ingredients.ts`（、必要なら `App.css`）**を編集予定。大葉とは別関数だが、**同じファイルの先頭の対応表（visual の union・viewBox 表・分岐）に 4 行ずつ足す**可能性が高い |
| #738 Steam S3（PR） | open。`PizzaStage.tsx` +15 −2、`GameScreen.tsx`、`App.tsx`、`main.tsx`、`Steam.css`、新規ファイル | **重ならない**（大葉は `PizzaStage.tsx` を触らない） |
| #749 Fry | open。eggplant の `pieceVisual` は #753 の G2（#748 claim 解除・#738 merge 後） | 独立。ただし eggplant の追加も **`IngredientGlyph.tsx` の先頭の対応表**に触れる |
| #753（Style Lock V2 §12、docs-only） | open、clean。Style Lock と references README を編集 | **README の 1 行が重なりうる**（§2.3）。Style Lock の §10.2 は #753 merge 後 |
| #756 / #757 / #762 / #763（Steam Lab） | open draft。#763 は 53 ファイルで `src/preview/**`・`src/logic/steam/**`・`main.tsx` 中心（`IngredientGlyph.tsx` / `PizzaStage.tsx` / `App.css` なし。確認済み）。他 3 件は題名からの推定 | 重ならない |
| #746 DRIZZLE Lab / #747 / #751 / #468 | #468 は `App.css` の mozzarella のみ。他は docs・preview | 重ならない（大葉は `App.css` を触らない） |
| #765（360px 幅のはみ出し修正） | **merged**。トレイのチップ名 10px・余白 3px | 受入条件の 360×800 検証に影響（撮影はすでに #765 込み） |
| #761 | **merged**。PROVISIONAL 除去済み | 大葉のサイズ 1.35em は確定 |

### 2.2 同じファイルでの衝突の見込み（`src/components/IngredientGlyph.tsx`）

| 編集者 | 編集箇所 | 重なり |
|---|---|---|
| **大葉 A+D** | `ShisoLeaf` 関数（約 446〜461 行）の stroke 色・太さ・不透明度（**path の形は変更しない**） | — |
| Burrata（C） | 先頭の visual 対応表（約 30〜105 行）に追加、新しい関数を追加 | 行は離れている。**先頭の対応表の末尾追加は Burrata・R2・Fry で互いに衝突しうる**（大葉は触れない） |
| R2 herb 4 種 | 同上＋新関数 | 同上 |

→ **大葉 A+D は他のどの PR とも同じ行を編集しない**見込み（git の自動マージで解決できる範囲）。**テスト `IngredientGlyph.test.tsx` も別の `describe`**（大葉は #739 の「shiso unchanged」テストの更新が必要）で、dedicated 集合の追加（Burrata・R2・Fry）とは別の行。

### 2.3 docs の重なり

- `docs/design/references/ingredient-icons-2.0/README.md`: #753（1 段落）と大葉の参照 SVG 更新（#740 の前例どおり 1〜2 行）が **同じファイルを編集**。どちらが先でも後の側が rebase（小さな衝突）。
- `docs/design/references/ingredient-icons-2.0/shiso.svg`: 大葉専用。他の PR は触らない。
- Style Lock V2 §10.2: **#753 merge 後に別の docs-only**（#758 の既定方針。今回の A+D でも、記述を「1.35em・縁 #1b4a22 ／ 約 19.8px」へ更新する作業が増える）。

### 2.4 結論

- **大葉 A+D は、`IngredientGlyph.tsx` の `ShisoLeaf` ＋テスト＋参照 SVG だけで完結し、Burrata・R2・Fry・Steam のどれとも並行できる。** merge の待ち順は不要。
- ただし **同じファイルの先頭の対応表を触る後続（Burrata・R2・Fry）は、先に merge された側へ rebase** する。**変更量の最も小さい大葉を先に出す**のが、衝突を最小にする順序。
- **実装前に必要なのは claim の整理**（§1.2 の #733 claim が `IngredientGlyph.tsx` を持っている）と Owner 承認。

## 3. 大葉の変更範囲（案。承認後の実装）

### 3.1 変更するもの

| ファイル | 内容 |
|---|---|
| `src/components/IngredientGlyph.tsx`（`ShisoLeaf` のみ） | 輪郭・葉脈の stroke（§4）。**path の座標（`SHISO_LEAF` / `SHISO_LEAF_LIGHT_HALF` / `SHISO_VEINS`）は変更しない**ことを基本とする。64×64 の viewBox、`id`・gradient・`<defs>` なし、決定的、を維持 |
| `src/components/IngredientGlyph.test.tsx` | **既存の「shiso (out of scope for #739) is unchanged」テスト（1337 行付近）が `stroke="#245f2c"` を固定している**ので、新しい輪郭色に更新する（弱めない: 新しい色・太さ・葉脈の値を固定する形に置き換える）。Batch 8b の共通テスト（viewBox・`id=` なし・`url(#` なし）はそのまま |
| `docs/design/references/ingredient-icons-2.0/shiso.svg` ＋ README 1〜2 行 | 参照 SVG をコードに合わせる（#740 の whitebait の前例）。Style Lock V2 本文は #753 merge 後 |
| `docs/reports/TETO_ISSUE-758_SHISO-A-D_Result.md`、`docs/reports/screenshots/issue-758-shiso-ad/**` | Result・before/after 画像・実測 |

### 3.2 変更しないもの（指示どおり）

`src/App.css`（サイズ 1.35em / margin −0.175em を含む）、`src/components/PizzaStage.tsx`、`src/data/ingredients.ts`、`toppingSizeClass.ts`、`IngredientGlyph.tsx` の他の関数、`CookingPrep.css`、牛肉・ピーマンの SVG、食材 ID・レシピ・採点・セーブ・Dex・Research・Inventory・Economy、`e2e/issue-758-shiso.spec.ts`（em 比の回帰テストとしてそのまま使う）、Style Lock V2 本文（#753 後）。

### 3.3 候補パラメータ（提案。Owner 承認前に確定しない）

| 要素 | 現行 | 候補 | 根拠 |
|---|---|---|---|
| 輪郭 `stroke` | `#245f2c` / 2.4 | `#1b4a22` / 2.8 | しらす #739 の前例（輪郭を濃く・太く）。現行は生地の上で縁 2.6〜2.9:1（3:1 未満）、目標 4:1 以上 |
| 葉脈 `stroke` | `#245f2c` / 1.8 / opacity .75 | 2.6 / opacity .9（色は輪郭に合わせる） | 結果画面の glyph 箱 19.8px では、1.8 / 64 ≒ 0.56px で 1x ではほぼ見えない |
| 葉の面 | `#5aa84f` / `#7cc46a` | **変更しない**（他の緑食材との識別を保つ） | 面の色を動かすと、バジル・パクチー等との差が変わる |
| 形（path） | — | **変更しない** | 鋸歯の形の変更は「別の食材に見える」リスクがあり、A+D の範囲外 |

提案モック（**実装ではない**）: `docs/reports/screenshots/ingredient-icons-733-758-audit/sheets/PROPOSAL-MOCK-shiso-A-D-dsf1.png`（実寸 DPR 1）、`-dsf3.png`（DPR 3）。現行 / A（葉脈のみ）/ D（縁のみ）/ A+D を 14.7 / 19.8 / 26.5 / 35.1px、焼き色の生地と生の生地の上で並べた。**懸念:** 14.7px 級では A+D の線が太く、葉の内側の明るい面が詰まって見える可能性がある（HV で判断。A のみ・D のみの縮小案も同じシートにある）。

## 4. 受入条件（AC）

| # | 条件 | 検証 |
|---|---|---|
| AC-1 | 表示サイズは変えない: em 比 1.35（トレイ 35.1px・ピザ上 26.5px・結果 19.8px）、占有 1em | `e2e/issue-758-shiso.spec.ts`（既存・無変更）が両 viewport で pass |
| AC-2 | トレイ chip は 118×64 / 108×64 のまま、glyph が chip 内、全画面で横スクロールなし | 同上 |
| AC-3 | 焼き色の生地の上の**縁のコントラスト 4:1 以上**（現行 約 2.6〜2.9:1）。結果画面（font 14.7px）で葉脈が 2x の画像で読める | 本監査と同じ方法（`measurements-contrast.json` 相当）で before/after を測る。**白いチーズの上の個体は除く** |
| AC-4 | 識別性の維持: バジル・パセリ・パクチー・青ねぎ・ピーマン・ズッキーニ・ハラペーニョと並べて、カラー・グレースケールの両方で区別できる | 本監査の `greens` ラインナップを再撮影（390×844 / 360×800） |
| AC-5 | しらすとの重なりが悪化しない: ume-shiso-pizza の配置で 0、密集配置は 1.35em 時（22.0〜23.5% / RESULT）と同じ | `issue-758-shiso.spec.ts` の重なり assert（SVG の外形は変えないので変わらない想定） |
| AC-6 | SVG の共通仕様（64×64、`id` / gradient / `<defs>` なし、決定的）。Batch 8b の共通テスト pass | `IngredientGlyph.test.tsx` |
| AC-7 | 変更ファイルが §3.1 の範囲のみ（`git diff --stat` を allowlist と照合）。`App.css`・`PizzaStage.tsx`・`ingredients.ts` の差分 0 | Result に差分一覧を記載 |
| AC-8 | focused Vitest、`tsc -b`、`npm run lint`、`npm run build`、Chromium E2E（`issue-758-shiso`、`expansion-batch8b`、`issue-733-icons`、`pilot-e-ingredient-icons`、`viewport-1screen`）pass。CI 11 checks と Codex（新 HEAD）を**新 HEAD で**評価 | Result |
| AC-9 | before/after 画像を repo に commit（390×844 / 360×800: トレイ・ピザ上・焼成後・密集・後乗せ FINISH・ショップ/図鑑/ヒント）。**390×844 の動画は repo に入れず Owner へ直接**（HV ポリシー） | Result + 動画 |
| AC-10 | iPhone Safari 実機 HV は **Owner のみが PASS を記録**。Chromium の結果を実機 PASS として扱わない | §5 |

## 5. iPhone Safari HV の確認項目（Owner）

環境は **別の隔離したテスト origin を優先**（共有 Preview の上書きは Owner 承認が別途必要）。390×844 と 360×800 の Safari（可能な範囲）。

1. **トレイ**: 大葉 chip がしらす・青ねぎと同じ大きさで並び、葉の輪郭と葉脈が読めるか。
2. **生地の上（焼成前）**: 梅しそピザ（大葉 2・しらす 4、Batch 16 の消費量）で、大葉が「葉」と読めるか。しらすの魚と混ざらないか。
3. **焼成後 RESULT（最重要）**: 19.8px の大葉の縁が焼き色の生地から浮くか、葉脈が見えるか。線が太すぎて「黒い塊」に見えないか（A+D の主なリスク）。
4. **他の緑食材との識別**: バジル・パクチー・青ねぎ・ピーマンと並べた時（グレースケール相当の明暗も）。
5. **密集配置**: しらすの真横でも葉が潰れない。
6. **後乗せ（FINISH）**: たらこクリームピザの大葉の後乗せ（`.pizza-post-layer`）と RESULT。
7. **ショップ・図鑑・ヒント**の小さい glyph（約 15〜22px）で、輪郭が潰れて汚く見えないか。
8. 横スクロール・chip の崩れがない（360×800 含む）。
9. 総合判定: 「現行 1.35em より良い／同じ／悪い」の 3 択（悪い場合は D のみ・A のみの縮小案へ）。

## 6. 実装手順（承認後。今回は未実施）

1. 最新 main・`CLAUDE.md`・`PROJECT_HANDOFF.md`・HV ポリシー・SESSION-OPERATIONS を再確認。Owner Gate（dry-run）で claim と open PR の重なりを確認。
2. 新しい独立ブランチ＋有効な claim を、**この作業のセッション自身が**投稿（§7）。#733 の未解放 claim が `IngredientGlyph.tsx` を持つことをコメントで明記。
3. `ShisoLeaf` の stroke のみを変更（形は不変）。`IngredientGlyph.test.tsx` を更新。参照 SVG・README を同期。
4. before（main）/after を同じ E2E（`issue-758-shiso.spec.ts`）で撮影、コントラスト・見かけの大きさを実測、greens ラインナップを再撮影。
5. focused テスト → `tsc` / lint / build → Chromium E2E → PR（**作成は可。merge・Production・共有 Preview は別承認**）。新 HEAD で CI・Codex。
6. Owner の iPhone HV → 採用確定。Style Lock V2 §10.2 の更新は #753 merge 後に docs-only。

## 7. claim 下書き（**未投稿**）

```
<!-- teto-claim:v1 {"session":"<new session>","issue":758,"pr":null,"branch":"claude/issue-758-shiso-a-d",
  "files":["src/components/IngredientGlyph.tsx","src/components/IngredientGlyph.test.tsx",
  "docs/design/references/ingredient-icons-2.0/shiso.svg","docs/design/references/ingredient-icons-2.0/README.md",
  "docs/reports/TETO_ISSUE-758_SHISO-A-D_*","docs/reports/screenshots/issue-758-shiso-ad/**"],
  "dependsOn":[],"expires":"2026-11-13T00:00:00Z"} -->
```

注: 実際に投稿する場合、`IngredientGlyph.tsx` は #733 の未解放 claim と重なる（§1.2）。HOT ファイルではない。

## 8. Owner 判断が必要な事項

| # | 判断 | 推奨 |
|---|---|---|
| OD-P1 | **A+D の実装に進むか**（大葉の SVG のみ・1.35em 維持・CSS/`PizzaStage.tsx` 不変）。または E のまま | 進める（P2）。ただし §3.3 の候補値は、**実装前に Owner が提案モックを見て確定**（特に 14.7px で潰れないか） |
| OD-P2 | **#733 の未解放 claim の扱い**（`IngredientGlyph.tsx` を含み、期限 2026-11-08）。元セッションの release、Owner による期限前の失効扱い、または重複を承知で進める | release を依頼（または「#760 merge 済みのため失効扱い」を Owner が明示） |
| OD-P3 | #733 を close する条件（Style Lock V2 反映 #753 後・visual ID 改名の別 Gate を別 Issue に切り出して close するか、open のまま追跡するか） | 残件を別 Issue に切り出して close。炒め済み牛肉の最終色の承認と、旧 Result の「iPhone HV 未実施」の更新も整理 |
| OD-P4 | #748 の claim（期限 11-19、#759 merge 済みで未 release）。Burrata・R2 の実装前提は claim の整理 | #748 側の release を依頼。大葉 A+D は `ingredients.ts` に触れないので、**待たずに進めてよい** |
| OD-P5 | **着手順序**: 大葉 A+D を先に出す（変更が最小、`ShisoLeaf` のみ）。Burrata・R2 は後で rebase | 大葉 A+D → Burrata / R2 の順 |
| OD-P6 | 参照 SVG（`shiso.svg`）と README を同じ PR で更新してよいか（#740 の前例）。Style Lock V2 本文は #753 後 | 同じ PR で更新 |
| OD-P7 | iPhone HV の環境（隔離した別 origin。共有 Preview 更新は別承認） | 別 origin を優先 |
| OD-P8 | A のみ・D のみへの縮小案を、A+D と並べて HV で比較するか | 並べる（実機で線の太さを判断） |

## 9. 今回やっていないこと

実装、PR 作成、merge、Production ON、共有 Preview 更新、GitHub へのコメント投稿（claim・release を含む）、他担当の claim・ブランチの変更、CI の再実行。調査用に他ブランチ（`claude/herb-icons-compare-docs-8auzii`、`claude/burrata-preflight-docs-8auzii`）を **fetch して読んだだけ**（作業ツリーは変更していない）。
