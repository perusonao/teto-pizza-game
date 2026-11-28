# Cooking Steam S3 — H11「蒸した貝がピース実寸で判別しにくい」修正 Result（#738, Refs #726）

対象: PR #738（HEAD `85b4a07` から 1 コミット追加）。採用操作は **A「ふたをタップ」**、B「鍋をゆする」は Preview/DEV 限定の比較機能のまま。`STEAM_EXPERIENCE_PRODUCTION=false` 不変。

## 1. 採用案と理由（案 B「少し開いた貝殻」）

| | 案 A（色・縁の強調） | 案 B（開いた貝殻） |
|---|---|---|
| 24px 判別 | 明度・彩度を上げるとあさりが黄色く「別の食材」に見え、ムール貝は黄橙に変色。縁だけでは足りない | あさり=下縁に橙の身が覗く／ムール貝=身が濃い橙に膨らむ。**実寸（DPR1・DPR3）で生と区別できる** |
| 自然さ | 不自然（Style Lock の色から外れる） | 蒸し画面で殻が開く表現と一致 |
| 既存食材との識別 | あさり=淡い円形・ムール貝=濃紺細長、のまま | 同じ（外形不変） |

→ **案 B を採用**、案 A は破棄。ピースの `::after` 疑似要素（CSS のみ）で描くため `IngredientGlyph.tsx`・`PizzaStage.tsx`・`ingredients.ts` は **無変更**（#748 / #417 / #749・#751 と競合しない）。生の食材 SVG（Tray / Shop / Dex / Research / Hint / Notebook / Reference）は無変更。

## 2. 変更

- `src/components/Steam.css`（+25）: `.ingredient-piece--steamed:has(.ingredient-glyph--clam-valve|mussel-shell)::after`（絶対配置・`pointer-events:none`・外枠のサイズ/配置/CUT 判定は不変、`transform`/`filter` は触らない）。不透明度は蒸し量（`--steam-sheen`）に追従。焼成 filter は外側ラッパーに掛かるので疑似要素にも同じ焼き色が乗る。`:has()` 非対応環境では従来の艶のみ（劣化しても無害）。
- `src/components/PizzaStage.SteamLook.test.tsx`（+19）: 疑似要素が steamed 配下だけ・非操作・transform/filter なし／`IngredientGlyph.tsx` に steam 配線がないことの構造テスト。
- 画像: `docs/reports/screenshots/steam-h11-clam-visibility/`（after）。before は既存 `cooking-steam-phase1/`（同名ファイル）。

## 3. 検証（Playwright Chromium。**実機 iPhone Safari ではない**）

- 蒸し E2E（390×844 / 360×800）30/30 pass（ghost click・案 A/B 操作・H13/H14 の既存テスト含む）。Steam 関連 Vitest 14 files / 213 tests pass、`tsc -b` エラーなし、oxlint 新規警告なし。全 Vitest・build は §6 参照。
- 24px: `24px-raw-vs-steamed-sheet.png`（DPR3 と DPR1 実ピクセル）。生（左列）と蒸し後（他）の差が実寸で分かる。**判定: 24px で判別可（Chromium 上）**。
- 焼成中・焼成後・仕上げ・RESULT でも橙の身が保たれ、表示崩れ・スクロール・ボタン欠けなし（`*-RESULT-final.png`）。
- Steam OFF では steamed クラスが付かず DOM/CSS は従来と同一（`steamIngredient.flagOff` / `unaffected` テスト pass）。保存・採点・在庫・ladder は未変更。

## Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| steam-h11_A_390x844.mp4（H.264） | 390×844 | 49.6 s | 796 KB | PASS |
| steam-h11_A_360x800.mp4（H.264） | 360×800 | 49.4 s | 756 KB | PASS |
| steam-h11_B-regression_390x844.mp4（H.264） | 390×844 | 27.3 s | 364 KB | PASS |

内容: 入口 → ピル → あさり配置 → 案 A でふたをタップ→殻が開く→離す → ピザ上（橙の唇）→ ムール貝も蒸す → 焼く → 仕上げ → RESULT。B はゆすり→ピザ上。
Download: セッション内で直接提出（repo には commit しない。`artifacts/review/steam-h11/` は gitignore 済み）。

Video Verification: PASS（ffprobe で h264・解像度・長さ確認、コンタクトシートで目視、RESULT 到達）。

## 4. 残る Owner 確認（実機 iPhone Safari）
H11（実機で実寸 24px の判別・自然さ）、H1–H12 の未報告分。**Playwright 結果を実機確認として扱わない。** merge / Production ON / 共有 Preview 更新は未実施。
