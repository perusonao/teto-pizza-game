# Large Catalog UX — LC-R6-b Preview Activation Infrastructure（Result）

**production behavior 変更なし・`HAND_ENFORCEMENT_PRODUCTION = false` のまま・capacity 9 / 12 は決めない・P3 / Dinner / CUT に触れない・R6-c（Hand/Pin UI 本格 activation）未着手。**

Authority: R6-a Owner Decisions（OD-R6a-1 = A2、OD-R6a-2 / 3 / 6 / 7）。R6-a Fresh Audit は commit `4d2d6ae` / `7727cdc`（main 未着地。本 PR には載せていない → Final Gate で扱いを Owner が決める）。

## 1. Fresh Gate

| 項目 | 結果 |
|---|---|
| origin/main | `6abddc71f2b71fbd7a04844db390986d709f69e3` |
| R5-e merge（PR #318）が main に存在 | 確認済み（ancestor） |
| R6-a authority artifacts が main に存在 | **存在しない**（`4d2d6ae` / `7727cdc` は R5-e PR から revert 済み `89a23ee`） |
| rejected draft（`backup/r6a-runtime-url-draft-unpushed` / `1909082`） | repo 内に object なし。URL / localStorage 方式は不採用 |
| 既存の runtime reader | なし（URL / storage / global から flag・capacity を読む code は元々存在しない） |

## 2. Design（A2）

- `src/preview/lcHandPreview.ts`: `LC_HAND_PREVIEW_CAPACITY: 9 | 12 | null` — **main は `null`**。HV 専用 disposable commit だけが 9 / 12 に変える 1 行。`LC_HAND_PREVIEW_MARK = "lc-hand-preview-v1"`、`lcHandPreviewBadgeLabel()`。
- `src/logic/catalog/handPolicy.ts`:
  - `HAND_ENFORCEMENT_PRODUCTION = false`（production の唯一の switch、literal。R6-e で決定）
  - `DEFAULT_HAND_CAPACITY_PRODUCTION = 12`（**候補値・未決定**、literal）
  - `previewVariant = import.meta.env.VITE_PREVIEW_MODE ? (候補値なら variant : null) : null`（不正値は fail closed で OFF）
  - `HAND_ENFORCEMENT_ENABLED = PRODUCTION || previewVariant !== null`、`DEFAULT_HAND_CAPACITY_CANDIDATE = previewVariant ?? PRODUCTION`
  - 3 つの consumer（`handCapacityFor` / `resolveTrayHandIds` / `GameScreen` の `handEditing`）は無変更。
- `PreviewBadge`: variant が 9 / 12 のとき `PREVIEW · PR# · sha · HAND 9|12`（`data-lc-hand-preview` 付き）。variant `null`（通常 Preview）は従来どおり。production は badge 自体が出ない。
- hand-on Vitest transform（`vitest.config.ts`）は `*_PRODUCTION` の literal 行を対象に更新（各 1 行でなければ throw = fail closed のまま）。`mutation-check.mjs` / `r5e-activation-mutants.mjs` も同名に追従。`catalogBoundary` は `handPolicy → lcHandPreview` のみを明示許可。
- **禁止事項の遵守**: query parameter / localStorage / sessionStorage / production runtime switch なし。variant commit は merge しない（PR head は常に `null`）。

## 3. Fail-closed proof

| Gate | 内容 | 場所 | 結果 |
|---|---|---|---|
| P-1 | production bundle に `lc-hand-preview-v1` / `data-lc-hand-preview` / `HAND ` が無い（Preview bundle には有る = scan が機能） | `src/preview/lcHandPreview.bundle.gate.test.ts`（実 `vite build`） | PASS |
| P-1b | **variant を 9 / 12 に書換えた production bundle が、plain production bundle と byte-identical** | 同上 | PASS |
| P-2 | main は `null` / 読むのは handPolicy と badge のみ / `VITE_PREVIEW_MODE` の後ろ / location・storage・URLSearchParams・globalThis・window・`VITE_LC_*` の出現 0 | `src/preview/lcHandPreview.gate.test.ts` | PASS |
| P-3 | 全 workflow（deploy / ci / e2e-webkit / firebase-production-deploy）に `VITE_PREVIEW*` / `LC_HAND` 無し、tracked `.env*` は `.env.example` のみ、vite.config / npm scripts も同様 | 同上 | PASS |
| P-4 | production build（variant 12 に書換え + query / storage decoy）は Hand OFF（tray 4 page、pin UI 0、badge 0）で production と DOM 同一 | `e2e/lc-hand-preview-activation.spec.ts` | PASS（Chromium） |
| P-5 | **production DOM = R5-e baseline**（main `6abddc7` の source 無変更で採取した golden 13 snapshot と完全一致） | 同上 + `docs/reports/data/TETO_LARGE-CATALOG-UX_LC-R6b_PRODUCTION-DOM-GOLDEN.json` | PASS（Chromium） |
| — | 通常 Preview（variant null）= OFF、DOM が production と同一 | 同上 | PASS |
| — | Preview + variant 12 のみ Hand ON（22 topping で 2 page、pantry に pin UI、badge `HAND 12`）。SAUCE / CHEESE / 6 topping は OFF と同一 | 同上 | PASS |
| unit | `VITE_PREVIEW_MODE` あり/なし × variant `null` / 9 / 12 / 不正値、badge label | `handPolicy.preview.test.ts` / `PreviewBadge.hand.test.tsx` | PASS |

Mutation（`tools/large-catalog-ux/r6b-preview-mutants.mjs`、V1〜V13 + V3b）: **14 / 14 KILLED**（production が variant を読む / main が非 null / URL・localStorage reader / deploy.yml が `VITE_PREVIEW_MODE` を設定 / transform 対象行の消失 / 不正値受理 / variant 無効化 / badge 誤表示 / production badge / env reader 追加 / production switch 反転）。V1 は e2e（P-4）でも別途 KILLED を確認。

## 4. 検証結果

- `npm test`: 286 files / 5410 passed, 1 skipped（hand-on-9 / hand-on-12 含む、既存 test 無修正で pass。変更は上記 3 ファイルの literal 名追従のみ）
- `tsc -b` / `npm run build` clean。`npm run lint` は既存 warning のみ。
- 既存 e2e `hint5-preview` / `large-catalog-pin-dormant`（Chromium 390）pass。
- **WebKit**: この sandbox では Playwright WebKit が起動できない（既知）。新 e2e は engine 非依存の相対比較（production ≡ variant ≡ 通常 Preview）を中心に書いてあり、Chromium のみ committed golden と比較する。WebKit の可否は CI（e2e-webkit）が authority。

## 5. Human Verification

R6-b は production / 通常 Preview の見た目・操作を変えない（P-5 で証明）。見た目が変わるのは HV variant Preview の badge 文字列のみ。R6-a §23 のとおり本格 HV video は R6-c（Hand/Pin UI activation）で行う。今回は before/after screenshot（390×844、`docs/reports/screenshots/lc-r6b-preview-activation/`）のみ:

| file | 内容 |
|---|---|
| `production-variant12-topping-hand-off.png` / `production-variant12-pantry-no-pin-ui.png` | variant 12 を書換えた **production** build: Hand OFF・badge なし・pin UI なし |
| `preview-normal-topping-hand-off-badge-no-hand.png` | 通常 Preview（variant null）: Hand OFF・badge に HAND なし |
| `preview-variant12-topping-hand-on-badge-hand12.png` / `preview-variant12-pantry-pin-ui.png` | Preview + variant 12: Hand ON（1/2 page）・badge `HAND 12`・pin UI |

Human Verification video: **未実施（R6-c で実施）**。variant SHA の実 Preview deploy（Preview repo pipeline）はこのセッションからは行っていない。

## 6. Owner に残る事項（Final Gate）

1. R6-a Fresh Audit / Owner Decisions / probe（`4d2d6ae` / `7727cdc`）を本 PR に再 land するか（このセッションでは cherry-pick が permission で拒否されたため未実施）。
2. variant SHA での Preview deploy と smoke（badge `HAND 9|12`、ON / OFF 判別）。
3. capacity 9 vs 12 は R6-d / R6-e まで未決定（本 PR は決めない）。
