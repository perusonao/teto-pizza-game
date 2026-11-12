# MID_BAKE Lab 独立監査の採用 — Result Report（Refs #795）

作業ブランチ: `claude/mid-bake-lab-audit-adoption-m51e68`（PR なし）。**#834 のブランチには push していない**（Owner 判断: 他セッションのブランチへの直接 push 不可）。
#834 の claim 保有セッション（`session_016YrGi3VFaBPeRU1CP45Cae`）へ、commit `bcf22cb` のみの cherry-pick を依頼済み。

## 1. Owner 判断の反映
| 判断 | 状況 |
|---|---|
| #834 を C-2/C-3 の採用軸とする | 反映。移植は #834 仕様（`?dev=midbake`、`lab-*` の testid）に合わせた |
| #832 の有用なテスト観点を #834 へ移植 | 作業ブランチで完了（`bcf22cb`）。#834 への取り込みは claim 保有者待ち |
| #830 の機能要件は参照のみ | 取り出し機能・代用在庫（`stock`）・Lab 全体のタイムアウト knob は**追加していない**（未承認機能） |
| #830/#832 は close せず HOLD | 触っていない |
| #827/#829/#834 の merge・Draft 解除 | 未承認のため実施していない |

## 2. 移植したテスト（`bcf22cb`、ソース変更なし）
- `e2e/mid-bake-lab-regression.spec.ts`（新規）: 通常 BAKE の針が 65 で止まらず 100 に達する／Lab が画面にない／65 付近の通常の取り出しが効く。
- `e2e/mid-bake-lab.spec.ts`（追記）: ラウンド全体＋やり直しで `localStorage`／`sessionStorage` が空、`hv=` 併用でも seed しない、やり直しで新ラウンド、入口排他（空・誤値・大小文字・他 dev 入口・旧 `cookMidBakeHv`）、短い viewport（390×664・360×640、OD-V-6 により engine ごとに 1 project）。
- 検証: `git diff 3474075 bcf22cb` は `e2e/` の 2 ファイルのみ（`src/`・`e2e/support/**`・`playwright.config.ts` の変更なし）。

## 3. 依存関係・merge 順（確認済み）
- `src/logic/midBake/labClock*.ts` は #829 と byte 単位で同一。#829 を先に merge すれば #834 の重複は解消。
- #827 は docs のみ（新規 4 ファイル）で他と衝突なし。
- 推奨順: #827 → #829 → #834（すべて Owner の最終承認が必要）。詳細な再検証条件は `TETO_MID-BAKE_C2-C3_LAB_Result.md` §12。

## 4. Gate 結果（作業ブランチ HEAD `e44364e` ＝ #834 `f69b092`＋最新 main `81974d0`＋移植テスト）
| Gate | 結果 |
|---|---|
| tsc -b | クリーン |
| 全 Vitest | 667 files passed / 3 skipped、12308 tests passed、失敗 0 |
| Chromium E2E（390×844・360×800、`e2e/mid-bake-lab*`） | 28 passed、2 skipped（OD-V-6 の意図的 skip）、失敗 0 |
| #834 の既存 CI（HEAD `c2fabe3`） | 全 11 job success（既存 run は無操作）。**`f69b092` 以降・移植後の HEAD での CI は未実行** |
| WebKit | ローカル不可。CI は移植テストを #834 に取り込んだ後の新 HEAD で必要 |
| Codex 独立レビュー | **未実施**（PR がない作業ブランチには依頼できない。#834 取り込み後の新 HEAD に `@codex review` が必要） |

## 5. Human Verification 成果物
- 動画（Chromium 390×844、エミュレーション。**リポジトリには含めない**、Owner へ直接提出）: ready → 針が 65 で停止 → なっとう 2 回で成功 → やり直し → 1 個で「とじる」→ 取り逃し → 代替操作で成功。通常 URL で Lab が出ないことも収録。
- スクリーンショット: `docs/reports/screenshots/mid-bake-lab-audit-adoption/`（01 実行中、02 停止中・トレイ開、03 成功、04 取り逃し、05 代替操作、06 通常ゲーム＝Lab なし）。この作業は UI を変えない（テストのみ）ため before/after は無し。
- **iPhone Safari 実機の PASS は主張しない。** 実機 HV の URL（PR 専用ページ。公開は Owner 承認待ち、本セッションは未公開）・手順・PASS/FAIL 表（H0〜H9）は `TETO_MID-BAKE_C2-C3_LAB_Result.md` §11 を使う。

## 6. 残課題（Owner の最終判断前）
1. #834 の claim 保有者が `bcf22cb` を cherry-pick → 新 HEAD で Vitest・tsc・E2E・required CI（WebKit 含む）・Codex 再レビュー。
2. PR 専用 HV ページの公開承認 → iPhone Safari HV（Owner）。
3. #827 → #829 → #834 の merge 承認（別途）。#830/#832 は HOLD。
4. 取り出し機能・代用在庫を Lab に足すかは別の Owner 判断。

Production ON・共有 Preview 更新・Draft 解除・force-push・rebase は行っていない。
