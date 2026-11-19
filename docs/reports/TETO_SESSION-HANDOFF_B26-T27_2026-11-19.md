# セッション引き継ぎ — Batch 26（T26）準備と T27 Owner パケット（2026-11-19）

対象 Issue: #866（Batch 26）、#780（claims / 列車）、関連 #867（工程監査）、#853（台帳、HOLD）。基準 main `6954a874`（#873 の merge commit）。
**このセッションは何も実装していません。** 本番 worktree への `apply`、T26 専用 claim の取得、他者 claim の変更、merge、Production ON、共有 Preview 更新、force push はしていません。

## 1. 現在の状態（2026-11-19 03:2x UTC に再取得）
| 項目 | 状態 |
|---|---|
| main | `6954a874`（変化なし）。CI・Deploy・E2E WebKit・Owner Gate は success |
| T26 仕様 | Owner が最終承認済み（nashville: chicken 2 / honey 1 / mozzarella 3 / pickles 2、`ladderCredit:false`・`ladderStep:null`。nduja-pizza: honey 1 / mozzarella 3 / nduja 2、通常 ladder key。nduja: topping / meat / scatter / 🌋 / `#a13517` / サイズ `s` / `nduja-dollops`。両レシピ honey PAINT。承認済みの説明文・注文セリフ4つ）。nduja は **1かたまり=1 use=在庫1**、Shop 表示は「20個」のまま |
| #873（nduja-dollops SVG） | **merge 済み**（`6954a874`）。T26 の `apply` は、この SVG が main にあることを前提にする |
| T26 の実装 | **未着手（repo 無変更）**。専用 claim なし |
| claim 競合 | **6件**: T-FX `session_016YrGi1r2RuC2BKGt8LF145`（#780 `6711787241`、期限 2026-11-21 00:00 UTC）、R-1 `session_016YrGi37Ao1hchMZc25Zvtn`（#780 `6823639362`、期限 2026-11-26 00:00 UTC）、open PR #874・#834・#540・#34。**重なりの件数（T-FX 13、R-1 7）は、最終版の「T26 claim 候補 68パス」に対する実測**（`claims` の出力）。以前の依頼コメント #780 `6949497173` の値（R-1 18、T-FX 11）は、候補が84パスだった時点の測定で、その後の絞り込み（84→54、#780 `6977509961`）と追加（`stagedRecipes.ts` など）で変わった |
| 非live | #815 HOT `…26v8m72wRWfP6p2E3`（#780 `6793893838`、2026-11-18 00:00 失効）、#834 c2 `…3VFaBPeRU1CP45Cae:c2`（#795 `6825109936`、2026-11-19 00:00 失効。同じ #795 に別の `…2Wp4N6czK69McHqiL:c2`〈#830〉もある）。**どちらも release の記録はなく、失効のみ**。docs 準備の claim は本人が release 済み |
| 保有者の回答 | T-FX・R-1・#834 の保有者から、依頼（#780 `6949497173`・`6977509961`・`6977703591`）への回答なし |
| #876（本ハンドオフの docs-only PR、Draft） | CI は head `eaa219de` で success（JSON・patch を含むため docs-only 扱いにならず full の Vitest が走る。以後の head の結果は PR #876 で確認する）。Codex は利用上限に達して**レビュー不可**（`chatgpt-codex-connector[bot]` が上限メッセージ、#876 `7003553749`）。代替として別コンテキストの独立レビューを実施し、その結果は PR #876 のコメントに記録する。merge・Draft 解除は Owner 未承認 |
| #875 | open・Draft・HOLD（別担当、base は #874 のブランチ）。PR の自動 CI は起動しない設計（`ci.yml` は base が `main` の PR のみ）。手動起動で CI success（head `ddc24130` を取得したことをログで確認）、WebKit は3回目の再実行で全6 shard success。初回の失敗は Playwright の WebKit のインストールのタイムアウト（360秒×2、テスト未実行）。**独立レビューと iPhone HV は未実施で、Final Gate GO ではない** |
| 3ライン（最新 main の実測） | レシピ **116**/177（残61）、食材 **137**/170（残33）、調理法・工程 IMPLEMENTED **7**/27（残20）。T26 着地後は 118/177・138/170 の見込み（予定であり実績に数えない） |

## 2. T26 を始める条件と手順（上から順に。失敗したら止まって報告）
**開始条件**: `claims` の競合が 0（T-FX と R-1 の保有者本人の release／縮小、または期限）。open PR との重なりは claim とは別に、実際の merge-base で確認する（現状、T26 が追加する衝突は 0）。

1. `CLAUDE.md` → `docs/PROJECT_HANDOFF.md` → `docs/decisions/TETO_SESSION-OPERATIONS_1.0.md` → `tools/train-kit/README.md` を読み、`git fetch origin main`。
2. claim を再収集（#780・#866・#815・#795・#834 の全コメント）。**期限が来たことだけで第三者の claim を変更・release しない**。更新ブロックと release の有無で live を判定する（`scripts/ops/lib/claims.mjs` の `parseClaims`）。
3. 承認 spec は `docs/reports/data/TETO_T24-T26_PREP/T26-R1.spec.md` の JSON。`node tools/content-train/preflight.mjs <spec> --out <dir>` → **STOP 0／canonical 0／非canonical 11（承認9＋T24追補2、表外 0）／終了コード 0**。
4. `node tools/train-kit/cli.mjs scaffold <spec> --tag t26 --label "Expansion Batch 26" --out <impl>`。`TODO` を承認値で埋める（nashville / nduja-pizza の説明文と注文セリフ、nduja の `color #a13517`・`emoji 🌋`・`sizeClass s`・`pieceVisual nduja-dollops`・`glyphHost StagedGlyph`）。
5. `apply --dry-run`（編集13＋生成4）→ `plan` → 68パスの `claims`（`--prs` に open PR の変更ファイル一覧を渡す）。**0 を確認できた場合のみ**、T26 専用 claim を**具体パス**で #780 か #866 に投稿（`docs/reports/TETO_T26_EXPANSION-BATCH-26_Result.md`、`docs/reports/screenshots/t26/**` を含める。ワイルドカード `TETO_T26_*` は避ける）。
6. `apply` → 追従 → `npx tsc -b` → `npx oxlint` → `npx vitest run`（全件。約30〜60分）→ 生成 E2E（`npx playwright test e2e/t26.spec.ts --project iphone-390x844 --project iphone-360x800 --trace off`）→ スクリーンショット（`docs/reports/screenshots/t26/`）。HV 動画（390×844）は Owner に直接渡し、repo には commit しない。
7. Draft PR → CI（PR の base が `main` なら自動）→ 独立 Codex レビュー → Owner の iPhone HV → Owner Final Gate。**merge は Owner の別承認**。完了したら同じターンで自分の claim を release。

### 2-1. 手動で足す追従（`apply` が足さないもの）
- `src/data/recipeSauceProfiles.ts` の `RecipeSauceProfile.ingredientId` の型 union に `"honey"` を1語（Owner 承認済み。**#815 の claim 解消後に限る＝満たされた**）。
- `src/data/staged/testSupport/stagedRecipes.ts` から `nashville-hot-chicken-pizza`・`nduja-pizza` の2行を削除（staged から昇格）。
- `src/logic/catalog/testSupport/recipeBatchManifest.ts` の 23 個の `followedBy` に2レシピを末尾へ追加（`researchLabelAudit.ts` も確認）。
- 新規テスト: `src/data/expansionBatch26.test.tsx`（内容契約・Research 承認の固定）と `src/state/ndujaInventory.contract.test.ts`（在庫契約）。下書きは `docs/reports/data/TETO_T26-T27_HANDOFF/draft-tests/*.txt`（scratch で14件合格。拡張子を `.test.tsx`／`.test.ts` に戻して `src/` に置く）。
- `StagedGlyphs.test.tsx` の「未配線」契約を「配線済み」へ（WIRED 一覧に `nduja-dollops` を追加、未配線テストを反転）。
- 過去 batch の Research 測定（`expansionBatch22`・`23`・`23b`・`24`）は、測定対象から T26 の2レシピと材料 `nduja` を**除外するリストへ追記**（T25 と同じ手法。**承認済み43件の一覧と許容する letter の形は変更しない**）。ordinary ladder の長さは 81→82、全体は 101→102。
- 失敗の全体像は `docs/reports/data/TETO_T26-T27_HANDOFF/T26-failure-map.md`（67件・36ファイル、原因と修正対象の対応）。WIP の差分は `t26-scratch-followups-wip.patch`（scratch で 67→45件まで減らした状態。**そのまま適用せず、参考にして最新 main で作り直す**）。

### 2-2. golden（Owner 条件付き承認: 正式な更新手順で再生成し、全差分の原因を確認）
`npx vitest run -u <各 golden のテスト>`（staged 系は what-if が重いので1ファイルずつ指定する）。検証済みの結論: `hint5.ladders55.json` は +362行の挿入のみ。`hint5.alphaFamilyOnly.json` は既存の値が増えるだけ（`nduja` をプールから外すと旧値と一致、減少0）。`DH4-1_AUDIT.json` は `catalogComparisonCandidates` の family／group／category が25値、すべて +1。staged 系（decisions／rejudge／whatIf.hint5）は昇格した2レシピの行の削除と件数の減少。`whatIf.research.json` は ID の集合が +2、非canonical の14件は**観測 letter が減るだけ（情報用サンプリング差分。原因は証明していない）**で、条件は `docs/reports/data/TETO_T26-T27_HANDOFF/whatif-research-14.md` と #866 `6994762309`。説明できない差分が出たら HOLD。

## 3. HOLD 事項（Owner 指示）
- `expansionBatch18` の nashville に関する期待値変更: **実装時に具体的な差分を提示するまで HOLD**（Owner 決定 26-2・C-3 と照合してから判断）。
- `expansionBatch24` の承認済み43件: **変更しない**。
- whatIf の canonical +1（`hot-honey-pepperoni` を単独で足すと、shipped になった nashville の正準 letter が `-->A` に変わる。prefix 52 件）: **将来の letter 変更は未承認**。T27 以降の列車の preflight で ID 別に扱う。
- #540・#34 は T26 に取り込まない（Draft／open を維持）。無断 close・merge・変更は禁止。

## 4. T27（keema-pizza / chicken-tikka-pizza）
Owner が判断資料の先行準備を承認済み（#866 `6998576764`）。資料は `docs/reports/TETO_T27_OWNER-PACKET_keema-chicken-tikka_2026-11-19.md`（現行ソースと根拠、NO_SAUCE の選択肢、Research の ID 別 旧→新、必要食材・工程、claim／PR の重複、個別の Owner 決定表 T27-1〜7）。**暫定値**（T26 未着地）。T26 着地後に再 preflight。catalog-only の残り16レシピの1件ずつの preflight は `T27-candidate-survey.md`（進めるのは2件だけで、残りは canonical Research の変化・M7・TQ1D G7・DH4 などで止まる）。

**Owner の 2026-11-19 の見解（#876 `7003519216`）**: T27-1〜7 の決定表は確認済みだが**正式承認は保留**。keema は既存の `beef-slices` をひき肉の代替として**無条件に採用しない**。NO_SAUCE 対 新素材、重複例外、Research の ID 別変更は、T26 着地後の再 preflight で精査する。**別列車を優先して検討**する。

## 5. 工程ライン（調理法・工程 7/27）
このセッションでは新規実装なし。#867（監査）は完了、実装の担当は #841（STEP_ORDER）・#851（PAN adapter、merge 済み）・#834（MID_BAKE Lab、Draft）・#871（Greek 油塗り、merge 済み）・#860。台帳の再生成は #853（HOLD）の領域で、`TETO_CONTENT-MASTER_methods.csv` の分類（7/7/4/1/6/2）は #867 の最新（IMPLEMENTED 7 / PARTIAL 10 / UNIMPLEMENTED 1 / HOLD 1 / ADOPTION_UNDECIDED 6 / DUPLICATE 2）と食い違う。マスター台帳の生成チェック2件は FAIL のまま（T26 の STOP ではない）。**T26 の nduja は台帳では `spread / use`、ランタイムでは `scatter`・在庫はピース単位**（1ピース=1 use）。台帳の変更は別作業（#853）で、この差を Result Report に記録する、が Owner 決定。

## 6. 注意（このセッションで踏んだ罠）
- `vitest run -u src/data/staged/` に他のパスを併記すると、意図しない広い範囲が走る／staged が走らないことがあった。**ファイルを個別に指定**する。what-if 系は重い（1ファイル10分以上）。全 Vitest は約30〜60分。
- `gh` は読み取り（`gh api`）が使える。書き込み（コメント・workflow 起動）は GitHub MCP（`mcp__github__*`）を使う。PR の base が `main` でない場合、`ci.yml` は自動起動しないので、`workflow_dispatch`（`target_sha`）か、e2e-webkit は PR のブランチを `ref` に指定して起動する。Playwright の WebKit インストールのタイムアウトは、失敗したジョブだけの再実行で復旧した。
- scratch の clone は消える。必要な成果物は `docs/reports/data/TETO_T26-T27_HANDOFF/` に保存済み。

## 7. 未完了と次の Owner 判断
- **未完了**: T26 の実装と全工程（上記）、競合 0 の実測、`expansionBatch18` の差分提示、golden の本実施、#875 の独立レビューと iPhone HV（別担当）、T27 の Owner 決定。
- **Owner の判断が必要**: ①R-1（期限 11/26）の保有者への催促を続けるか、期限まで待つか。②T27-1〜7（上記パケットの決定表）。③`whatIf.research.json` の canonical +1 を台帳に残す記録の置き場（#853 側でよいか）。
