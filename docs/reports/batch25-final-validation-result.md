# Batch 25 — 最終検証 Result Report（証跡保存）

> 検証対象のコード SHA: `cfe7ebece2924a3d200478174941e424ba742d57`。この文書を保存する docs-only commit の SHA とは異なる。実行者の Result Report を転記した証跡であり、GitHub PR の required checks または独立 Codex による全件再現を意味しない。

## 対象・位置付け

- リポジトリ: `perusonao/teto-pizza-game`
- 検証ブランチ: `claude/teto-pizza-batch25-m2-dk6bpl`、検証前後とも `cfe7ebece2924a3d200478174941e424ba742d57`、worktree clean（実行者報告）。
- 比較起点: `dba7d73`、追加コード差分の起点: PR #857 `dabfa4c`。
- #856 HEAD `0f3f9a23bedeef44aaa90dde5589381578fa5e81`、#857 HEAD `dabfa4c3057daa08c1288f8fbcdf1a15ddd917d4`、#858 HEAD `871616c4a5b529f1f473a6f6127db16320a72dac`。**検証 SHA はいずれのPR HEADでもない。**
- 当時のmain: `17603034f159bd625374e6e8cf5a7deb07389369`（#861）。

## 検証結果（実行者報告）

| 検証 | 結果 | 留意事項 |
|---|---|---|
| Chromium 390×844 | Batch25対象3 spec、11/11 PASS | `t25`、`t25i7`、`t25i7-yogurt-gestures` |
| Chromium 360×800 | 11/11 PASS | pin済みPlaywright 1.56.1が要求するchromium-1194がなく、既存1243をscratchpad configで指定して再実行。設定ファイル変更なし |
| WebKit 390×844 | 11/11 PASS | host依存ライブラリ追加後 |
| WebKit 360×800 | 11/11 PASS | host依存ライブラリ追加後 |
| 全Vitest | 12,682中、12,659 PASS / **FAIL 1** / skip 20 / todo 2 | FAILは`DexOverlay.discovery.test.tsx`の30秒タイムアウト。全件PASSとは扱わない |
| タイムアウト対象単独再実行 | 5/5 PASS（22.8秒） | 全体実行時のFAILを取り消すものではない |
| `tsc -b` | PASS | エラー出力なし |
| lint | エラー0、既存warningあり | 未使用変数など |
| build | PASS | チャンクサイズ通知のみ |
| jsdom canvas | `getContext not implemented` 3,594回 | PASSとは別の警告 |

### skip / todo の内訳

- skip 20: pinsaゲートOFF側 8、trainKit実行モード 6、doughPrivacy 3、preflight 1、cheesePool報告 1、hintEconomy sim 1。今回の変更による追加skipなし（実行者報告）。
- todo 2: `persistence.compat.progress.test.ts` Phase B保留。今回の変更による追加todoなし。
- `matcher.test.ts` のM-2承認4行に関する旧FAILは今回PASS。以前の「4行未承認のためFAIL」は **現在の失敗原因ではない**。

## Owner承認・不変条件

- B25-M2-D1: swedish-kebab、肉と未特定ホットソース下地を省略。
- B25-M2-D2: banh-mi、NO_SAUCE、liver-pateは複合topping、lateかつPOST_BAKEなし。
- B25-M2-D3: mexican-elote、sour-cream下地、cotija→feta、chili-powder→paprika-powder。
- B25-M2-D4: pizza-asparagi-limone、crudiをPOST_BAKE FINISHと解釈。
- 上記は各recipe限定のOwner承認。buffalo-cauliflowerは別のD-2条件付き解除。
- B-1 kebab-sauce `#d86a35` のΔE例外は tomato-sauce、buffalo-sauce、curry-ketchup、peanut-sauce、miso-sauce の**5ペアのみ**。他は閾値25維持。
- B-2 buffalo-chicken / buffalo-cauliflower のJaccard 0.6、対称差2の**1ペアのみ**。閾値緩和なし。
- ordinary 81、late 97〜101、step 98でdaikonとliver-pate同時解放、canonical Research差分0、non-canonical 42 ID、既存late +1を維持。
- Shop→購入→Research→配置→焼成→NEW DISCOVERY→図鑑登録を対象E2Eで確認。FINISH付き4recipeも対象。

## 最新main・PRの未解決事項

- 当時のmain `17603034` との差分としてCI関連3ファイル（`.github/workflows/ci.yml`、`.github/workflows/e2e-webkit.yml`、`scripts/ci/test-ci-docs-only.sh`）が報告された。実行者の`git merge-tree`では競合なし。**mainのmerge/rebaseは未実施**。
- Issue #780の独立Codexレビュー: https://github.com/perusonao/teto-pizza-game/issues/780#issuecomment-6907541152 。Batch25対象12ファイル580/580 PASS、ただし全Vitestの独立再現は未達。
- **PR #857の現行CIでbuild/WebKit失敗、PR #858はdirty・checksなし**（独立レビュー時点）。この検証で解消したとは扱わない。
- `cfe7ebece2924a3d200478174941e424ba742d57` は最新mainに統合したFinal Gate用HEADではない。PR headごとの同一SHA CI/WebKit GREENは未達。
- iPhone Safari実機HV未実施。専用PreviewのBatch25用branch未確認、390×844 HV動画未用意。共有Preview・Productionは未変更。
- #856・#857・#858はいずれもDraft/HOLD、mergeなし。Owner最終承認なし。

## 結論

**Final Gate: HOLD。** 本レポートは過去の固定SHAでの検証記録であり、PRのmerge可否を保証しない。最新main基準の統合候補、#857/#858のブロッカー解消、同一SHAのCI/WebKit、独立Codex再レビュー、iPhone HV、Owner最終承認が必要。

原資料: `docs/reports/batch25-owner-decision-materials.md`、`batch25-m2-hold-spec-decision-materials.md`、`batch25-vitest-triage.md`、`batch25-iphone-hv-materials.md`。
