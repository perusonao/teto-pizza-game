# Progression 2.0 W1 — Human Visual Verification / Owner Decision Sync（Phase A）

## 結論

- W1 の新 ingredient 7 つについて、Visual Gate を **7/7 HUMAN_PASS** として正式に記録した。対象は fresh-tomato dedicated B、capers dedicated、clam dedicated B、eggplant 🍆、corn 🌽、pineapple 🍍、potato 🥔。
- Owner Decision を確定した。
  - **OD-CLAM-GLYPH = DEDICATED_CLAM_B**: 以前の DEFER_TO_VISUAL_GATE を置き換える（supersedes）。🦪 と 🐚 は不採用。
  - **OD-TOMATO-REPRESENTATION = DEDICATED_FRESH_TOMATO_B**: 以前の TEMPORARY_SHARED_GLYPH を置き換える。🍅 の共有と candidate A は不採用。ingredient ID は `fresh-tomato` のまま、cherry-tomato への alias は禁止。
  - **OD-CAPERS-VISUAL = DEDICATED_CAPER_CLUSTER**: 新設。🟢 は不採用。
- ledger の **ING-02/03/07/08/09/10/11 は RESOLVED_BY_HUMAN_VISUAL_VERIFICATION** になった。W1 の resolved は 12 行で、unresolved の行はもうない（REC-01〜04 と RT-01 は解決対象ではなく `unchanged`（変更なし）の区分）。
- READY / REVIEW / BLOCKED は、すべての dependency から計算し直した。結果は **0 / 10 / 0** で変わらない。
  - 10 recipe すべてが、未解決のまま残っている global の REC-01〜04 を引き継いでいる。
  - parmigiana、portuguesa、puttanesca には RT-01 も残る。
  - recipe 固有の dependency がなくなった recipe は 1 件から **7 件**に増えた: new-haven-apizza、hawaiian、bambino、pesto-caprese、pesto-tonno、pesto-patate、melanzane-pizza。
- `src/**`、`e2e/**`、`.github/**`、#220、#221、#222 は変更していない。RT-01、REC-01〜04、OD-S1 = A、quantity / Completion Gate、recipe の数、W1 の recipe set にも触れていない。

## Authority（作業開始時に GitHub で確認）

| 対象 | SHA | 判断 |
|---|---|---|
| main | `1e53baa88f390bf6d8f52647e7c65cc279eb2567` | 前回 pin した `dff233c` との差は #223 だけで、変更は CI のみ（`.github/workflows/e2e-webkit.yml`、`scripts/ci/*`）。generator が pin している src とデータのファイルは同一。W1 authority の意味は変わっていない |
| #220 | `e49dab96bd9b26dc0f520349cf09d1160c3519f5` | 変更なし |
| #221 | `070afc0827f382bec8bc813d62e7fafe663a0991` | Final Codex Gate は PASS 済み。前回 pin した `d028844` と比べて、W1 の入力 3 ファイルは byte 単位で同一 |

generator は pin を `1e53baa` と `070afc0` に更新した。そのうえで次の 2 点を検証し、崩れていれば失敗するようにした。

- 前回の pin からの **同一性**: main で pin しているパスと、#221 の W1 入力が変わっていないこと。
- #221 の audit checker（`tools/progression2_w1_authoring_audit.py --check`）を `070afc0` の一時 worktree で read-only に実行した結果が PASS であること（READY 0 / REVIEW 10 / BLOCKED 0、authority drift 0、ledger orphans 0）。

## Evidence の区別

| class | 中身 | 今回の扱い |
|---|---|---|
| PIZZA_DB_EVIDENCE | PIZZA DB の token と canonicalizer の disposition | 変更しない。`TOKEN_PROVENANCE` は byte 単位で同一 |
| GAME_NORMALIZATION_DECISION | OD-OLIVE と OD-PARM（それぞれ canonicalization rule を持つ） | 変更しない |
| VISUAL_DECISION_FINAL | OD-CLAM-GLYPH、OD-TOMATO-REPRESENTATION、OD-CAPERS-VISUAL | 確定した。変更前の値は `supersedes` に残した。これらの OD だけでは evidence の行を解決しない（`resolves: []`） |
| **HUMAN_VISUAL_VERIFICATION** | 新しく作った `TETO_PROGRESS2_W1_HUMAN_VISUAL_VERIFICATION.json` | ING の行は、この class だけを根拠に解決する。PIZZA DB evidence としても game の判断としても記録しない |

Human Verification の metadata は材料ごとに機械可読で残した。

- `evidenceClass` / `verificationResult: HUMAN_PASS` / `deviceClass: iPhone Safari`
- `previewUrl`: https://perusonao.github.io/teto-pizza-game-preview/w1-visual-gate/
- `previewSourceSha` と `previewRepoSha`:
  - HVG-1（6 材料）: source `ea8ae74b898698b7550bc8cf6ddd7f9382bc044b`、preview repo `a0f34c150d45d1b8ba0e374619f56c2b816a47ee`
  - HVG-2（fresh-tomato B）: source `fe80e3c2ee4f0d7d3967cbe35780d819e7f842e7`、preview repo `0e1e6028ad3a0f89949a8be5c15fe2bf6c215097`、Human Verification MP4 の sha256 は `bf545dce…34a0`。動画は repo に commit していない
- `approvedVisual`、比較した対象、確認した文脈（raw / baked / deep / Result / 16px / grayscale など）

## 生成物の変化

| file | 変化 |
|---|---|
| `TETO_PROGRESS2_W1_EVIDENCE_RESOLUTION_LEDGER.json` | ING 7 行を RESOLVED にした（`evidence` には HUMAN_VISUAL_VERIFICATION だけを持つ）。recipe ごとに `implementationPrerequisites` を追加した（例: dedicated visual: clam (asari-valve) など）。これは production の実装作業であり、未解決の evidence ではないので readiness の計算には入れない |
| `TETO_PROGRESS2_W1_OWNER_DECISIONS.json` | 上の 3 つの visual OD と、その `supersedes` の履歴 |
| `TETO_PROGRESS2_W1_VISUAL_EVIDENCE_REQUIREMENTS.json` | verdict を HUMAN_PASS にし、`approvedVisual` と `productionRenderRequirement` を追加。Gate の引き継ぎ欄は COMPLETED |
| `TETO_PROGRESS2_W1_HUMAN_VISUAL_VERIFICATION.json` | 新規 |
| `TOKEN_PROVENANCE` と `DISCOVERY_REGRESSION_FIXTURES` | **byte 単位で同一**（identity と discovery は変わっていない） |
| slice 1〜3 の Visual Gate の result | 過去の記録として、evidence の入力を `abb0a3d` 時点から読むように固定した。出力は byte 単位で同一 |

## 検証

| check | result |
|---|---|
| `progression2_w1_evidence_resolution.py --check` | PASS（6 ファイルを再現。discovery probe を production matcher で再実行: collision 0、W1 の 10 件すべてが UNIQUE_MATCH、REC-08 を維持） |
| `--self-test` | **40/40** の mutation を検出した。新たに追加したのは次の検出: Human PASS を PIZZA DB evidence として記録する / 🦪 を採用する / DEFER に戻す / 🍅 共有や candidate A を承認する / HVG-1 の SHA で fresh-tomato を PASS にする / supersedes の履歴を消す / visual の OD 単独で evidence 行を解決する / visual の PASS だけで READY にする |
| `validate_recipe_catalog.py` | PASS |
| `progression2_evidence_invariants.py` | 4/4 |
| canonicalizer の self-test | 36/36 |
| #221 の audit checker（`070afc0`、read-only） | PASS |
| slice 1〜3 の result の `--check` / `--self-test` | PASS / 12・14・15 |
| 未解決の visual requirement | 0（7 材料すべて HUMAN_PASS。validator が強制する） |
| fresh-tomato ≠ cherry-tomato | 維持。authored の quantity に置き換えがなく、alias は null、`forbiddenAliases` は ["cherry-tomato"]。`fresh-tomato->cherry-tomato` の置き換えは NO_MATCH |
