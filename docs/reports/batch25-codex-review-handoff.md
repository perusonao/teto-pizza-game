# Batch 25 — 独立 Codex レビュー引き継ぎ（別セッション用）

## レビュー対象（exact）
- リポジトリ: `perusonao/teto-pizza-game`、ブランチ `claude/teto-batch-25-continuation-mcuqyq`。
- **コードの exact HEAD（全テスト実行時点）: `b37947dd`**。これ以降のコミットは docs／画像のみ（`git diff --stat b37947dd..HEAD` で確認できる）。
- レビューの起点: `dabfa4c3`（#857 `codex/t25-content` の HEAD）。#856（`codex/t25-i7-runtime`）の 2 コミットは patch-id が #857 に含まれる。#858 `871616c4` は `dd843b27` で統合済み。
- 差分: `git diff dabfa4c3..b37947dd`（コードとテスト）。**実装（非テスト）の変更は 5 ファイルだけ**:

| ファイル | 変更 | 見てほしい点 |
|---|---|---|
| `src/logic/discovery/researchResultFeedback.ts` | 200 字超のときだけ NEGATIVE を「ほかN件×」に集約（C-1、案 P） | POSITIVE を必ず残すか。200 字以内の行は byte 同一か。Notebook の契約・保存形式を変えていないか。文言が情報を漏らさないか（Anti-Oracle） |
| `src/logic/discovery/trialNotebook.ts` | `MAX_FEEDBACK_TEXT` を `export` しただけ（値は 200 のまま） | 値・検証ロジックが不変か |
| `src/data/lateCatalog.ts` | `ALL_LATE_ORDERS` の T25 late 4 件を smore の後ろ・pizza-salad の前へ移動（D、#858 の仕様） | 文言が byte 同一か。late order の順序依存が他にないか |
| `tools/train-kit/lib/codegen.ts` | #858 の `insertBeforeObjectInArray`（late order の挿入先を配列境界で固定）と presence-dab の生成 | コンフリクト解消（`dd843b27`）が #858 の意図どおりか |
| `tools/train-kit/templates/e2e.spec.ts.tmpl` | #858: secondary sauce を 1 タップ（presence-dab）で塗る生成 | 生成 E2E（`e2e/t25i7.spec.ts`）と一致しているか |

- 追加したテスト（レビュー対象）: `src/state/pizzaSalad.realPlay.test.ts`（実 reducer・実保存・journal）、`src/state/pizzaSalad.hintFlow.test.ts`、`e2e/t25i7-yogurt-gestures.spec.ts`、`src/components/testSupport/leakCheck{,.test}.ts`、`src/logic/discovery/researchResultFeedback.test.ts` の追記、`expansionBatch22/25.test.*` の例外・D-2 条件。
- 期待値の更新（件数・位置・新しい行・golden）: テスト・E2E 56 ファイル、golden／監査 JSON 9 ファイル、testSupport 8 ファイル（`dabfa4c3..b37947dd` の全変更は 81 ファイル）。**どの更新も、基準の緩和・skip・削除ではないことを確認してほしい**（`git diff dabfa4c3..b37947dd -- '*.test.*'`）。

## 不変条件（実測済み。再測定してほしい）
ordinary 81／late 97〜101（既存 late は +1 移動して 82〜96）／step 98 で daikon + liver-pate の 2 食材同時解放／canonical Research 変化 0／non-canonical 42 ID（`expansionBatch25.test.tsx` に固定）。全食材・全レシピ・全調理法／工程の並行追加方針は維持。

## 検証結果（`b37947dd`）
| 項目 | 結果 |
|---|---|
| 全 Vitest | 12,682 件中 PASS 12,659／FAIL 1／skip 20／todo 2（1,716 秒）。FAIL 1 件は `matcher.test.ts:278`＝**HOLD の 4 行（swedish-kebab・banh-mi・elote・asparagi）が未承認のため、意図して失敗**（一時コピーで 4 行だけと確認済み） |
| 型チェック・ビルド | `tsc -b` PASS、`npm run build` PASS |
| 生成 E2E（Chromium 390×844・360×800）／WebKit（同 2 サイズ） | `t25`・`t25i7`・`t25i7-yogurt-gestures`：Chromium 全 PASS、WebKit 22 件 PASS |
| 実プレイ（reducer・journal） | `pizzaSalad.realPlay.test.ts` 8 件 PASS |

## 未承認・HOLD（レビューで承認扱いにしないこと）
- M-2 の 4 行（`docs/reports/batch25-m2-hold-spec-decision-materials.md`）。`ownerApproved` には追加していない。解除したのは buffalo-cauliflower のみ（D-2 を根拠とする条件付き）。
- B-1: kebab-sauce `#d86a35` の ΔE 例外は **5 ペアを値固定で記録**（基準 25 は他の全ペアで維持）。B-2: D-2 のペア限定例外（Jaccard 0.6・差分 2 を固定）と、描画比較テスト。
- 独立レビューの前に Owner が確認する事項: `docs/reports/batch25-owner-decision-materials.md`、`batch25-vitest-triage.md`、`batch25-iphone-hv-materials.md`。

## レビューへの依頼（観点）
1. 上の 5 つの実装ファイルの正しさと、回帰（特に C-1 の文言と、`lateCatalog.ts` の順序）。
2. テストの追従が「実測値への更新」に留まり、ゲートの弱体化になっていないか（snapshot／golden の差分は削除中心・追加中心のどちらか、既存要素の改変がないか）。
3. `leakCheck.ts` が、プライバシー検査を弱めていないか（購入済みの名前の内側から始まる一致だけを許容）。
4. 不変条件の再測定、Research の canonical 変化 0 と 42 ID。
5. #856・#857・#858 の Draft／HOLD 運用に反する変更（merge、Production ON、共有 Preview 更新）が無いこと。

## 再現コマンド
- `npm ci` → `npx tsc -b` → `npx vitest run`（約 30 分、4 コア。`-u` は使わない: `prettier` が無く、インライン snapshot の更新で止まる）。
- E2E: `npx playwright test e2e/t25.spec.ts e2e/t25i7.spec.ts e2e/t25i7-yogurt-gestures.spec.ts --project iphone-390x844 --project iphone-360x800 --trace off`（WebKit は `--project webkit-390x844 --project webkit-360x800`）。
