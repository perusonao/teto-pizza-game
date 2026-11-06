# 大葉（shiso-leaf）A+D — 候補値の選定と実装仕様の最終確定（docs-only、実装なし）

- 日付: 2026-11-06 / 基準 main `785d7956b42eac97e42dbd138818262a16c0a91c`（再確認。変化なし）
- 前提: `TETO_INGREDIENT-ICONS_733-758_Fresh-Audit.md`、`TETO_INGREDIENT-ICONS_758-SHISO-A-D_Implementation-Prep.md`
- Owner 方針（2026-11-06）: A+D を採用する方向 / 1.35em 維持 / `App.css`・`PizzaStage.tsx`・`ingredients.ts` は変更しない / 参照 SVG と README は同一 PR に含めてよい / #733 の未解放 claim は無断で失効扱いにしない / Batch 19 とハーブ 4 種の共通ファイル変更は後続
- 状態: **調査・設計のみ。実装・PR・merge・Production ON・共有 Preview 更新・GitHub へのコメント投稿・claim の変更はしていない。**

## 1. 結論

| 項目 | 内容 |
|---|---|
| **推奨する候補値** | **AD1 = 輪郭 `#1b4a22` / 2.4（色のみ濃く、太さは現行のまま）＋ 葉脈 2.2 / opacity .85（色は輪郭と同じ）**。葉の面の色・path の形・stem は変更しない |
| 比較用（HV で並べる） | **AD3**（輪郭 `#143a19` / 2.6、葉脈 2.2 / .85）＝より強い輪郭、**D1**（輪郭のみ `#1b4a22` / 2.4）＝最小変更の保険 |
| 非推奨 | **AD2 / AD4**（葉脈 2.6）: 葉の明るい面が現行の約 7 割まで減り、14.7px 級で潰れ始める。**D3 単独以上の太い輪郭**は黒い塊に寄る |
| サイズ | 1.35em / margin −0.175em のまま（CSS 変更なし） |

選定理由（§3 の実測）: iPhone 実機（DPR 3）の 19.8px で **輪郭 4.5:1（現行 3.4:1）**、**葉脈の信号が現行の 1.43 倍**、**明るい面の残りが 86%（14.7px でも 82%）**。面の残りが 80% を割る案は「線で潰れる」ので除いた。

## 2. 提案モックの比較（14.7px 相当）

画像（**提案モック・未実装**）: `docs/reports/screenshots/ingredient-icons-733-758-audit/sheets/PROPOSAL-MOCK-shiso-candidates-14.7px.png`
10 候補 × 〔14.7px 焼き色の生地 DPR1（実ピクセルを 3 倍に拡大）／同 DPR3／19.8px DPR3／14.7px 白いチーズ上 DPR3／14.7px 生の生地 DPR3〕。

- 「14.7px 相当」の扱い: 結果画面の大葉は font 14.7px × 1.35 ＝ **glyph 箱 19.8px**（実測）。依頼の 14.7px は**それより小さい箱**なので、**箱 14.7px を過酷側のストレステスト**とし、実際の 19.8px と焼成前の 26.5px も並べた。
- **静的な描画**で、ゲーム内の drop-shadow・焼成フィルタ・生地の模様は含まない。ゲーム内の実測は実装後の before/after で行う（AC-3）。
- DPR 1 は PC・低 DPR 端末の最悪ケース、DPR 3 は iPhone 実機。**DPR 1 では候補によらず 14.7px の葉脈は潰れる**（現行も同じ）。今回は DPR 3 で読めることを基準にした。

### 候補一覧と実測（焼き色の生地 `#dfa24f` の上、`shiso-candidate-metrics/metrics.json`）

「輪郭 CR」= 輪郭（最暗 10%）と背景の WCAG コントラスト。「葉脈信号」= 葉脈ありと無しの輝度差（RMS）の、現行比。「面の残り」= 明るい面の色が見えているピクセル数の、現行比。

| 候補 | 輪郭 / 葉脈 | 輪郭 CR（DPR3：14.7 / 19.8 / 26.5px） | 輪郭 CR（DPR1：同） | 葉脈信号（DPR3、現行比） | 面の残り（DPR3：14.7 / 19.8 / 26.5px） |
|---|---|---|---|---|---|
| C0 現行 | `#245f2c` 2.4 / 1.8 .75 | 3.2 / 3.4 / 3.4 | 2.1 / 2.3 / 2.7 | 1.00 | 100 / 100 / 100% |
| A1 葉脈のみ弱 | 現行 / 2.2 .85 | 3.2 / 3.4 / 3.4 | 2.2 / 2.4 / 2.8 | 1.25 | 86 / 92 / 91% |
| A2 葉脈のみ強 | 現行 / 2.6 .9 | 3.3 / 3.4 / 3.4 | 2.4 / 2.5 / 3.0 | 1.42 | 81 / 84 / 86% |
| **D1 輪郭のみ** | `#1b4a22` 2.4 / 現行 | **4.3 / 4.5 / 4.6** | 2.4 / 2.8 / 3.3 | 1.16 | 91 / 95 / 96% |
| D2 輪郭のみ太 | `#1b4a22` 2.8 / 現行 | 4.5 / 4.6 / 4.6 | 2.6 / 3.1 / 3.8 | 1.15 | 90 / 94 / 95% |
| D3 輪郭のみ濃 | `#143a19` 2.6 / 現行 | 5.4 / 5.7 / 5.7 | 2.8 / 3.4 / 4.5 | 1.26 | 85 / 93 / 94% |
| **AD1 D1+A1（推奨）** | `#1b4a22` 2.4 / 2.2 .85 | **4.3 / 4.5 / 4.6** | 2.6 / 2.9 / 3.5 | **1.43** | **82 / 86 / 89%** |
| AD2 D2+A2 | `#1b4a22` 2.8 / 2.6 .9 | 4.5 / 4.6 / 4.6 | 3.0 / 3.3 / 4.0 | 1.60 | 77 / 78 / 83%（**潰れ気味**） |
| AD3 D3+A1（比較用） | `#143a19` 2.6 / 2.2 .85 | 5.5 / 5.7 / 5.7 | 3.0 / 3.6 / 4.7 | 1.54 | 79 / 84 / 86% |
| AD4 D1+A2 | `#1b4a22` 2.4 / 2.6 .9 | 4.3 / 4.5 / 4.6 | 2.9 / 3.1 / 3.8 | 1.62 | 78 / 79 / 84%（**潰れ気味**） |

目視（シート）: AD1 は 14.7px の DPR3 でも中央脈と 2〜3 対の側脈が読め、葉の面が残る。AD3 は輪郭が黒に近く、小さいと葉脈と輪郭が一体に見え始める。AD2 / AD4 は葉脈が太く、明るい面が細切れになる。

### 採用基準

1. 実機相当（DPR 3）の 19.8px で輪郭 ≥ 4:1（現行 3.4:1）
2. 葉脈の信号が現行比 +30% 以上
3. 明るい面の残りが現行比 80% 以上（線で潰れない）
4. 面の色・path の形を変えない（他の緑食材との識別を保つ）

→ **AD1 のみ 4 つを全て満たす**（D1 は 2 を満たさない／AD3 は 14.7px で 3 に届かない／AD2・AD4 は 3 を満たさない）。

## 3. claim と競合の再確認（GitHub、2026-11-06）

| 項目 | 結果 |
|---|---|
| main | `785d7956`（変化なし） |
| **#758 claim** | コメント `6679761024`（2026-11-06 07:35Z）が `"released": true`。**解放済み**。#758 は open。以降の新しいコメントなし |
| **#733 claim** | 4 件（`6650393214` / `6650986065` / `6651022526` / `6657071151`）とも release なし。最終コメントは 2026-11-05 11:40Z から変化なし。**無断で失効扱いにしない**（元セッションへの release 依頼案を別資料に作成、未投稿） |
| #748 claim | 期限 2026-11-19、release なし。大葉 A+D は `ingredients.ts` に触れないので影響なし |
| open PR | #738 / #746 / #747 / #751 / #753 / #756 / #757 / #762 / #763 ほか。前回監査から更新なし。**`IngredientGlyph.tsx` を変更する open PR はない**（#763 は確認済み、#738 は `PizzaStage.tsx` 等で `IngredientGlyph.tsx` は変更しない旨を PR 本文・Result で確認） |
| 新たに merge された PR | 前回監査以降なし（#759 / #760 / #761 / #765 / #768 のみ） |
| #753 | open・clean。`references/README.md` の編集が大葉の README 更新と同じファイル（小さな rebase） |
| Burrata（Batch 19）／ハーブ 4 種 | 後続。**`IngredientGlyph.tsx` の先頭の対応表（visual の union・viewBox 表・分岐）と `ingredients.ts` を編集予定**。大葉は `ShisoLeaf` の関数内のみで、行が重ならない。先に大葉が merge されれば、後続が rebase する |
| Fry（#749）eggplant | G2 は #748 claim 終了・#738 merge 後。同じく先頭の対応表に触れる後続 |

## 4. 変更ファイル・テスト・HV の最終確定

### 4.1 変更ファイル（allowlist）

| ファイル | 内容 |
|---|---|
| `src/components/IngredientGlyph.tsx` | **`ShisoLeaf` の関数内のみ**: 輪郭 `stroke` を `#245f2c` → `#1b4a22`（太さ 2.4 のまま）、葉脈 `strokeWidth` 1.8 → 2.2、`opacity` .75 → .85、葉脈の色を輪郭と同じ `#1b4a22`、stem（`M32 49 L32 57`）の色も輪郭に合わせる。`SHISO_LEAF` / `SHISO_LEAF_LIGHT_HALF` / `SHISO_VEINS` の座標、面の色 `#5aa84f` / `#7cc46a`、接地影は不変 |
| `src/components/IngredientGlyph.test.tsx` | 「shiso (out of scope for #739) is unchanged」（1337 行付近）が `stroke="#245f2c"` を固定している。**新しい値（`#1b4a22`、葉脈 2.2 / .85、面の色 `#5aa84f`・`#7cc46a` 不変、座標不変）を固定するテストに置き換える**（テストを弱めない）。コメントの「out of scope for #739」は #758 A+D に直す |
| `docs/design/references/ingredient-icons-2.0/shiso.svg` | コードに合わせる（#740 の whitebait の前例） |
| `docs/design/references/ingredient-icons-2.0/README.md` | 1〜2 行（#753 と同じファイル。後の側が rebase） |
| `docs/reports/TETO_ISSUE-758_SHISO-A-D_Result.md`、`docs/reports/screenshots/issue-758-shiso-ad/**` | Result・before/after 画像・実測 |

**変更しない（差分 0 を Result で示す）:** `src/App.css`、`src/components/PizzaStage.tsx`、`src/data/ingredients.ts`、`toppingSizeClass.ts`、`IngredientGlyph.tsx` の `ShisoLeaf` 以外、`CookingPrep.css`、`e2e/issue-758-shiso.spec.ts`（em 比・重なり・chip の回帰テストとしてそのまま使う）、Style Lock V2 本文（#753 後に別の docs-only）。

注意: `e2e/expansion-batch8b.spec.ts` は shiso の DOM（`svg[data-ingredient-visual="shiso-leaf"]`）を数えるだけで色には依存しない。`IngredientGlyph.test.tsx` の他の shiso 参照（45・81・1403 行）は ID／配列で色に依存しない。

### 4.2 テスト（承認後の実装時）

1. focused Vitest: `IngredientGlyph.test.tsx`、`App.css` を読む既存の 11 ファイル、`expansionBatch16.test.ts`
2. `tsc -b`、`npm run lint`、`npm run build`
3. Chromium E2E（390×844 / 360×800）: `issue-758-shiso`（**無変更**、before = main で 6/6 を確認済み。after も 6/6）、`expansion-batch8b`、`issue-733-icons`、`pilot-e-ingredient-icons`、`viewport-1screen`
4. 実測（本監査と同じ方法）: コントラスト・見かけの大きさを before/after（白いチーズ上の個体は除外。生地の上だけで集計）
5. 識別の再撮影: `greens`（バジル・パセリ・パクチー・青ねぎ・ピーマン・ズッキーニ・ハラペーニョ）のカラー／グレースケール（`capture-script/audit.spec.ts.txt` を流用）
6. CI 11 checks と Codex は**新 HEAD で**評価

### 4.3 受入条件（最終）

AC-1〜AC-10 は `…Implementation-Prep.md` §4 のとおり。**数値の更新:**

| AC | 更新 |
|---|---|
| AC-3 | ゲーム内（DSF 2 の撮影）で、焼き色の生地の上の縁コントラストが **現行 2.6〜2.9:1 → 3.5:1 以上**（静的モックで DPR3 の 4.5:1 だったのに対し、ゲーム内は縁に焼成フィルタ・drop-shadow が乗る分を見込む）。**判定は before/after の差（+0.7 以上）と目視を併用** |
| AC-11（新規） | 結果画面の葉の「明るい面」が潰れない（目視で、14.7px font の 2x 画像で面が読める）。モックの面の残り 80% 以上を満たす値のみ採用 |
| AC-12（新規） | AD1 / AD3 / D1 を実機で並べて判断できるよう、**HV 用の比較は本実装（AD1）の before/after を基本**とし、AD3 / D1 の比較が必要な場合は **別の隔離ビルド**で用意（本 PR には 1 つだけ入れる） |

### 4.4 iPhone HV（Owner）

`…Implementation-Prep.md` §5 の 9 項目に、次を追加する:

- 10. **AD1 が現行より良いか**（良い／同じ／悪い）。悪い場合、または線が重いと感じたら D1（輪郭のみ）に縮小。
- 11. 結果画面で、**葉脈と輪郭が一体の黒い塊に見えないか**（AD3 を選ばなかった理由の確認）。
- 環境: **隔離した別の test origin を優先**。共有 Preview の更新は別承認。Chromium の結果を iPhone PASS として扱わない。

## 5. Owner 判断事項

| # | 判断 | 推奨 |
|---|---|---|
| OD-Q1 | **候補値は AD1 で確定してよいか**（輪郭 `#1b4a22` / 2.4、葉脈 2.2 / .85）。比較用に AD3 / D1 を別ビルドで用意するか | AD1 で確定。比較ビルドは Owner が必要と判断した時のみ |
| OD-Q2 | ゲーム内の受入閾値（AC-3: 3.5:1 以上かつ +0.7）でよいか | よい（静的モックの 4.5:1 より控えめ） |
| OD-Q3 | #733 の claim の release 依頼コメント（案: `…Claim-Release-and-733-Split_Drafts.md` §1）を投稿してよいか。**投稿者・タイミング（元セッション宛）は Owner 判断**。未 release のまま着手する場合は「重複を承知」の記載を claim に入れる | 投稿を承認。大葉の claim は release 確認後、または Owner の明示的な許可後 |
| OD-Q4 | #733 の残件を別 Issue に切り出す案（同 §2）を起票してよいか | 起票して #733 は close |
| OD-Q5 | 大葉 A+D の実装を開始してよいか（OD-Q1・Q3 の後） | 承認後に着手。PR 作成まで。merge・Production・共有 Preview は別承認 |

## 6. 今回やっていないこと

実装、PR 作成、merge、Production ON、共有 Preview 更新、GitHub へのコメント・Issue の投稿、他担当の claim の変更、CI の再実行。製品コード・CSS・SVG（参照 SVG を含む）・テストは未変更。モックは `docs/reports/screenshots/…/sheets/` と `shiso-candidate-metrics/`（生成スクリプトは `.txt`）にのみ保存した。
