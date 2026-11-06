# S4 — #738 STEAM H11（24px の貝の視認性）最小修正案と再 HV 範囲（docs-only）

2026-11-06。#738 へは push していない。claim 保有者は `session_013m8Cb5GjssgoY27cSCQ3jk`（#726、〜11-10）。本書は S4 の成果物で、新規ファイルのみ。

## 1. 重要な訂正：H11 の修正は #738 に既に入っている

#738 の head は `2ac9820`（`fix(cooking-steam): H11 …`）で、`85b4a07` の次の 1 コミットが H11 の修正（案 B「少し開いた貝殻」、`Steam.css` の `::after`、CSS のみ）。結果書は #738 のブランチの `docs/reports/TETO_COOKING-STEAM_S3_H11_Result.md`。別セッションの検証（H11 NEEDS FIX）は修正前の `85b4a07` 時点のもの。**新しい修正案は不要で、残りは再 HV**。

## 2. 現状の修正の仕様（コード確認）

- `.ingredient-piece--steamed:has(.ingredient-glyph--clam-valve|--mussel-shell)::after`：1em 角、`pointer-events:none`、`opacity: calc(.4 + .6 * var(--steam-sheen))`、橙の身の SVG（あさり＝下縁の橙、ムール貝＝殻内が濃い橙）。外枠のサイズ・配置・CUT 判定は不変、`IngredientGlyph.tsx`・`PizzaStage.tsx`・`ingredients.ts` は無変更。
- 配置は Chromium で 24px（DPR3／DPR1）と焼成後・RESULT で確認済み（結果書 §3）。**実機 iPhone Safari は未実施**。

## 3. 残るリスクと「最小」の追加案（実機結果が出てから）

| リスク | 内容 | 最小の追加案（要 Owner 承認・保有者の合意） |
|---|---|---|
| R1 `:has()` | iOS Safari 15.4 未満は非対応で、橙の身が出ず艶のみになる（劣化は無害だが H11 は未解決のまま） | 対象 iPhone の iOS を Owner が確認。非対応端末を切り捨てるなら変更なし。必要なら steamed のとき wrapper に直接クラス（`PizzaStage.tsx` の +1 行）を付けて `:has()` を不要にする案。`PizzaStage.tsx` は保有者の claim 範囲 |
| R2 過蒸しで薄い | `--steam-sheen` が低いと opacity 0.4 まで下がる | 下限を 0.55 に引き上げる 1 行（CSS のみ）。実機で薄く見えた場合のみ |
| R3 24px で形が潰れる | DPR3 の実機で縁の太さが不足 | SVG の stroke を 1.3→1.6（data URI の修正 1 点）。実機で判別できなかった場合のみ |
| R4 焼成 filter の重なり | 焼き色が疑似要素にも乗る（意図通り） | 変更なし。焼成後・RESULT で橙が焦げて見えないかを再 HV で確認 |

**今は修正を足さない**（実機で判別できなかった場合にだけ R1〜R3 を最小で適用）。

## 4. 再 HV の範囲（Owner、実機 iPhone Safari。Chromium は代替にならない）

| 項目 | 内容 |
|---|---|
| 端末・画面 | iPhone Safari（390×844 を基準、360×800 相当は可能なら）。iOS のバージョンを記録（R1） |
| H11（本題） | あさり・ムール貝の**生と蒸し後をピース実寸で見分けられるか**（TOPPING 配置後、焼成中、焼成後、CUT、RESULT） |
| 併せて見る | H13/H14（修正済み。ghost click・pointercancel）、案 A（ふたタップ）と B（ゆする）の操作感、ピルの位置（炙りと重ならない） |
| 範囲外 | Production ON、共有 Preview の更新（別承認）、#755 系（V1〜V3） |
| 証跡 | 390×844 の動画（repo に commit しない）、画像は `docs/reports/screenshots/steam-h11-clam-visibility/` の既存 after と並べる。判定は Owner（Chromium の結果は「実機 PASS」として記録しない） |

手順書は PR #747（Draft、docs-only）の A/B 判定手順に H11 の項目を足す形が自然だが、**#747 へは push しない**。足す場合は保有セッションまたは Owner の指示で。

## 5. Final Gate までの流れ（S4 と保有者の分担）

| 手順 | 担当 | 承認 |
|---|---|---|
| 1. 最新 main を #738 に取り込む（base は `49e2add`、現 main は `3a41bb6`。現状は `mergeable_state: clean`） | 保有者（#738 のブランチへの push は保有者のみ） | **Owner の明示承認** |
| 2. 取り込み後の全 Vitest・tsc・build・Chromium E2E・WebKit 全 shard・Codex | S4（使い捨てブランチで先行検証）→ 結果を保有者へ | Codex 依頼は Owner 承認 |
| 3. 共有 Preview への配備と復元 | **未承認（禁止）** | Owner の別承認 |
| 4. 実機 HV（§4） | Owner | — |
| 5. #726 の claim 更新（期限 11-10） | **保有者のみ** | — |
| 6. merge | Owner（私は行わない） | Owner |

S4 は 2 の先行検証までを担当し、結果は本書に追記する形で報告する（#738 へのコメント・push はしない）。

## 6. 先行検証の結果（S4、使い捨て worktree・#738 へは push していない）

2026-11-06、`origin/main`（`3a41bb6`）に `origin/claude/cooking-steam-s3-ui`（`2ac9820`）を**ローカルでマージ**して実行（worktree は削除済み）:

| 項目 | 結果 |
|---|---|
| マージ | **競合なし**（自動マージ成功） |
| `tsc -b` | エラーなし |
| Vitest（`src/components`・`src/logic/steam`・`src/data/steam*`・`src/preview`） | **144 files / 2,278 tests すべて pass** |
| **未実施** | 全 Vitest、build、Chromium E2E、WebKit 全 shard、Codex（#738 の CI は PR 側で別途） |

「全体の取り込み後の検証」は未完了。残りは保有者の push（Owner 承認）後に PR の CI で確認する。
