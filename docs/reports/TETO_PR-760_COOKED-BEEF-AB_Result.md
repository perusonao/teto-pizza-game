# PR #760 OD-A 炒め済み牛肉の色 A/B 比較 Result Report

Status: **比較だけ完了。Owner の採用判断待ち（HOLD）。** PR #760 の HEAD `b0535b0` は変更していない。
- 方針: Issue #733 comment 6656697974（2026-11-05）
- 方法: 一時 worktree の描画変更で比較した。一時 worktree は PR head から作り、push もコミットもしていない
- Chromium の結果なので、iPhone Safari 実機 PASS としては扱わない
- merge・Production ON・共有 Preview の更新はしていない

## 1. 比較した色

色の役割は `src/logic/prep/beefDoneness.ts` の `BEEF_COOKED_COLORS` のキーに対応する（外側 = `lean2`、輪郭 = `edge`、断面 = `lean`、芯 = `fat` / `fat2`）。

| 案 | 外側 | 輪郭 | 断面 | 芯 | 位置づけ |
|---|---|---|---|---|---|
| A | `#5f331f` | `#2e1a10` | `#7a4226` | `#9a5a3c` | PR #760 の現行 |
| B | `#6e3c22` | `#3a2114` | `#8a4e2c` | `#7f4628` | Owner 指定の改善候補 |
| B′（参考） | `#66361e` | `#34190e` | `#8a4729` | `#7f4628` | B を既存の単調性テストに合わせた版（§3 を参照）。Owner 指定外の追加列 |

生の色（`BEEF_RAW_COLORS`）と焦げの色（`BEEF_BURNT_COLORS`）、生の牛肉・ピーマンの絵、`App.css`、`ingredients.ts`、保存、採点、Production ガードは、どの案でも変更していない。

## 2. 撮影

- 対象: 390×844 と 360×800。Chromium、DPR 2。
- 流れ: `?cookPrep=on` で牛肉を 3 個置く → フライパン 0.1 s（生）/ 2.3 s・2.7 s（炒め途中）/ 3.15 s（best の中央 = 炒め完了の目標色そのもの）→ 取り出す（best）→ 生地上の炒め済み → 焼成 → 結果。
- 静止画は時計を止めて撮った。動画は実時間で撮った。
- 全ての段階で、縦スクロール・横スクロールは 0 だった（3 案 × 2 viewport）。

| シート | 内容 |
|---|---|
| `ab-stages-{390x844,360x800}.png` | 生 → 炒め途中 ×2 → 炒め完了 → 生地上 → 焼成後（1 個の拡大） |
| `ab-actual-size-{390x844,360x800}.png` | DPR 1 に縮小してから画素を 4 倍に拡大したもの（生地上の約 28px と焼成後の約 20px の実寸の見え方） |
| `ab-dough-{390x844,360x800}.png` | 生地全体（生 / 炒め済み / 焼成後） |
| `ab-full-{390x844,360x800}.png` | 全画面（炒め済みの生地 / 焼成後の結果） |

保存先: `docs/reports/screenshots/pr-760-cooked-beef-ab/`。

動画はリポジトリに入れず、セッション内で直接提出した。

| Video | 解像度 | 長さ | サイズ |
|---|---|---:|---:|
| `pr760-beef-AB-side-by-side.mp4`（A / B / B′ の 3 本を横に並べたもの） | 1180×900 | 20.1 s | 1.34 MB |
| `pr760-beef-A-390x844.mp4` | 390×844 | 20.1 s | 0.48 MB |
| `pr760-beef-B-390x844.mp4` | 390×844 | 20.1 s | 0.47 MB |
| `pr760-beef-Bprime-390x844.mp4` | 390×844 | 20.2 s | 0.47 MB |

- すべて H.264 / yuv420p / 30 fps。全フレームをデコードできることを確認した。
- 4 本とも同じ流れで、生 → 🍳 炒める → 実時間で約 3.1 s 後に取り出す（best）→ ✓ 炒め済み → 焼成 → 結果。

Video Verification: **PASS**

## 3. 既存の色変化テストへの影響

| テスト | A | B | B′ |
|---|---|---|---|
| `beefDoneness.test.tsx`「monotonically」（R+G+B の合計が生 → 炒め済みで増えない） | pass | **fail**: 外側 `lean2` 193 > 188。外側（204 > 188）と輪郭（111 > 94）は、炒め済みが生より明るい | pass |
| `beefDoneness.test.tsx`「the lean ribbon only ever gets darker」（断面の輝度がフライパンの時間で増えない） | pass | **fail**: +2300 ms で 97.44 > 97.26。断面の G が 71 → 78 に上がるため | pass（B′ は断面の G を 71 にした） |
| vitest の対象 3 ファイル（`beefDoneness` / `PizzaStage.CookingPrep` / `CookingPrepLayer`） | 56/56 | 54/56 | 56/56 |
| `e2e/cooking-prep.spec.ts`（Chromium、2 viewport） | 50/50 | 46/50 → 期待値の更新後 50/50 | 46/50 → 期待値の更新後 50/50 |

- e2e の失敗は、どちらの案も「炒め済みの断面 = `rgb(122, 66, 38)`」という固定の期待値 2 か所 × 2 viewport だけだった。新しい色に書き換えると 50/50 になる（B は `rgb(138, 78, 44)`、B′ は `rgb(138, 71, 41)`）。
- B をそのまま採用すると、外側と輪郭が「炒めると生より明るくなる」ことになる。生の絵の外側 `#6a3220` と輪郭 `#3a160e` がすでに暗いためである。採用するには、単調性テスト 2 件の不変条件を緩める必要があり、「最小修正」にはならない。

## 4. 評価

| 観点 | A | B | B′ |
|---|---|---|---|
| 黒く沈まないか | △: 外側の輝度 0.049 で、こげ茶〜黒に近い。焼成後はさらに沈む | ○: 外側 0.067（A 比 +37%）、断面 0.110（+34%）。いちばん暖かい茶 | ○−: 外側 0.056（+14%）、断面 0.101（+23%）。A より明らかに暖かいが、B ほど明るくない |
| 自然な焼き色か | △: 芯 `#9a5a3c` が断面より明るく、ツヤやハイライトに見える | ○: 芯が断面より少し暗い。「焼き目の枠＋火の通った断面」に読める | ○: B と同じ傾向 |
| 20〜28px で角切りが分かるか | ○: 3 個の角は、どの案でも輪郭で読める | ○ | ○ |
| 20〜28px で断面が分かるか | ○: 断面と芯の 2 段が見えるが、芯はハイライトに見える。断面/外側のコントラスト比 1.33 | △〜○: 断面/外側 1.37。芯/断面 1.14 で芯はほぼ消え、「枠＋断面」の 2 段になる | △〜○: 断面/外側 1.43（3 案で最大）。芯/断面 1.07 |
| 焼成後 | 3 案とも bake の filter（brightness 0.97、sepia 0.08 など）は同じ。生地が橙になると、A がいちばん暗く見え、B がいちばん溶け込む | | |
| 既存テスト | pass | **unit 2 件が fail**（不変条件と衝突） | 期待値 2 か所の更新だけで pass |

**結論:**
- B は「黒く沈む」の解消には効いている。ただし生地全体のスケールでは差は小さく、芯が消えて断面の情報も少し減る。加えて既存の単調性の不変条件と衝突する。**このため、B をそのまま採用することは推奨しない。**
- B′ は、B の方向（暖かく、芯がハイライトに見えない）を保ったまま、既存の不変条件を満たす。改善は「明確だが小さい」。
- 判断の選択肢:
  1. **B′ を採用する**（最小修正。§5）
  2. **A のまま**、iPhone 実機 HV（OD-B）で改めて決める
  3. B を厳密に採用する（単調性テストの不変条件を緩める変更を伴う）

## 5. B′ を採用する場合の最小修正案（未適用。Owner の判断待ち）

本体の変更は 1 ファイル 1 行で、加えて e2e の期待値 2 か所を更新する。一時 worktree で、vitest 56/56 と e2e 50/50 を確認済み。

```diff
--- a/src/logic/prep/beefDoneness.ts
+++ b/src/logic/prep/beefDoneness.ts
-export const BEEF_COOKED_COLORS: BeefColors = { lean: "#7a4226", lean2: "#5f331f", fat: "#9a5a3c", fat2: "#9a5a3c", edge: "#2e1a10" };
+export const BEEF_COOKED_COLORS: BeefColors = { lean: "#8a4729", lean2: "#66361e", fat: "#7f4628", fat2: "#7f4628", edge: "#34190e" };
--- a/e2e/cooking-prep.spec.ts
+++ b/e2e/cooking-prep.spec.ts
-    expect(looks[1]).toBe("rgb(122, 66, 38)"); // the middle of best is the cooked target
+    expect(looks[1]).toBe("rgb(138, 71, 41)"); // the middle of best is the cooked target
-    expect(await beefFill(page)).toBe("rgb(122, 66, 38)");
+    expect(await beefFill(page)).toBe("rgb(138, 71, 41)");
```

- `beefDoneness.test.tsx` と `PizzaStage.CookingPrep.test.tsx` は定数を import して比較しているので、変更はいらない。
- 焦げの色（`BEEF_BURNT_COLORS`）は変えない。「best と焦げの輝度差 > 10」は満たしている（断面 87.8 と 40.0）。

## 6. 範囲外・注意

- 炒めは Preview/DEV 限定の機能（`PREP_EXPERIENCE_PRODUCTION = false`）なので、どの案も Production の見た目には影響しない。
- spec `docs/design/TETO_COOKING-PREP_PHASE1_SPEC_2026-10-28.md` §18.3 の色の表は、旧いリボンの値のままである（PR #760 の Result §7 で既に指摘済み）。
- 結果チップのピーマンが文字に重なる件（main と同じで、既存の問題）は、Owner 指示どおり別に追跡する。
- iPhone Safari 実機 HV（OD-B）は未実施。
