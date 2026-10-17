# Issue #520 — Free Cooking / レシピを探す に 5 段階焼き加減とジャスト帯を採用 Result

Draft PR。merge・本番 deploy・Preview 切替は未実施で、Owner HV（390×844 動画 + 実機）後の別途明示承認が必要。

## Owner Decision（#520、2026-10-17）
**#481 の Owner Decision 項目2（「FREE Cooking: no JUST band; keep 3-level result badges」）および #469 Owner D2（結果の 5 段階は guided のみ）を変更する。** Free Cooking（ORIGINAL / MATCHED、Research を含む）でも BAKE ゲージにジャスト帯、RESULT に 5 段階の焼き加減バッジを出す。他の #481 項目（±3pt、near-miss のセリフ抑制、新規セリフなし）は維持。

## 変更（src）
- `GameScreen.tsx`: `resultBakeLevel5` を FREE でも算出。FREE は `FREE_COOK_BAKE_TARGET`（58–78、#482）で `classifyBake5` する（照合したレシピの固有窓は読まない）。`BakeOverlay` の `showJustBand` を常時有効に。結果見出しの `isNearMiss`（「完璧」を含む台詞の除外）は既存ルールがそのまま FREE に効く。
- `BakeOverlay.tsx`: prop コメントのみ。`classifyBake5` / `justBand` / `JUST_HALF_WIDTH_PT` は変更なし。
- 変更していない: Scoring 2.0、星、Pitz、Completion Gate、Dex、保存、焼成時間、`dialogue.ts`、`classifyBake`。5 段階は表示専用のまま。

## 挙動（FREE の窓 58–78、中心 68）
| 針 | バッジ |
|---|---|
| < 58 | 生焼け（FAILED） |
| 58 – 64.99 | 惜しい（焼き不足） |
| 65 – 71 | ジャスト（ジャスト帯 left 65 / width 6） |
| 71.01 – 78 | 惜しい（焼きすぎ） |
| > 78 | 焦げ（FAILED） |

マルゲリータ照合時（固有窓 60–80）でも FREE は上表。例: 59 は FREE で「惜しい（焼き不足）」（固有窓なら生焼け）、72 は「惜しい（焼きすぎ）」（固有窓ならジャスト）。NEW PIZZA の結果画面は従来どおり焼き加減バッジを出さない（`!isDiscoveryResult`）。

## テスト
- Vitest 全件 432 ファイル / 8263 件通過、`tsc -b` / `vite build` 通過。内訳: `bake5.test.ts`（FREE 窓の境界 57.99/58/64.99/65/68/71/71.01/78/78.01、`justBand` = 65–71）、`GameScreen.bakeBadge.test.tsx`（FREE MATCHED / ORIGINAL の 5 段階、固有窓との乖離点 59 / 72、生焼け・焦げ、FREE BAKE のバンド位置、FREE 近接ミスで「完璧」なし。FREE を 3 段階とした旧テストを更新）。
- E2E 新規 `e2e/bake-free-just-520.spec.ts`（iphone-390x844 / 360x800）: FREE BAKE のジャスト帯が窓内・ゲージ内・CTA と非重複・横スクロールなし・1.2s で消える／RESULT のジャスト・惜しい・「完璧」なし。WebKit はローカル未実行（CI 参照）。
- スクリーンショット: `docs/reports/screenshots/free-bake-5level-520/{before,after}/`（390×844・360×800）。

## Human Verification（Policy §4 / §7）
- 動画: `free-bake-5level-520_390x844.mp4`（セッション内で Owner へ直接提出・repo 非 commit）、390×844、約 40 秒、H.264、約 0.7MB。Free Cooking で BAKE のジャスト帯 → ジャスト結果 → 惜しい（焼き不足）→ 惜しい（焼きすぎ）を実時間で確認。
- Owner iPhone HV と WebKit（CI）は未実施。HV PASS 前に merge しない。
