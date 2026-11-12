# M-PAN / PAN_PROFILE Phase 1 Result

Issue: #838 (parent #794)  
Branch: `codex/pan-profile-phase1`  
Base: `cf0c8652` (`origin/main`, 2026-11-13)

## Result

Production未配線の純粋基盤として、`PanProfileId` / `PanProfile`、5 profile registry、純粋validator、独立したDOUGH_SHAPE_TARGET registry、両registry間の明示的compatibility契約、legacy adapterを追加した。

- PAN_PROFILEは容器・深さ・熱接触と「許容するshape target ID」だけを持つ。
- DOUGH_SHAPE_TARGETは形状族・aspect ratio・closedだけを持ち、pan IDを持たない。
- compatibilityは`checkPanShapeCompatibility(profileId, targetId)`で明示的に評価し、推論・fallbackを行わない。
- legacy adapterは既存意味だけを投影する: 未指定/round → `legacy-round`、trayまたはsquare → `tray`。逆変換は`legacy-round` → `{ pan: null, panShape: "round" }`、`tray` → `{ pan: "tray", panShape: "square" }`で、既存`PizzaState.pan`に存在しない`"round"`を生成しない。新profileから正確に戻せない場合は`null`。
- 既存`src/logic/pan/panProfile.ts`は改名・変更していない。

## Compatibility / parity

- `grandma-pizza`: 既存tray/square → profile `tray`。
- `pinsa-romana`: DoughKind軸のままprofile `legacy-round`。PAN_PROFILEへ統合しない。
- 既存の非square recipe: 全件`legacy-round`。
- `PizzaState.pan`、`Recipe.bakeTarget`、save、Research/Hint/Dex、scoringは変更なし。
- HOTファイル変更なし。Production importなしをarchitecture testで検証。

## Staged assignments

6品の割当は `TETO_PAN-PROFILE_PHASE1_STAGED-ASSIGNMENTS.md`。全27工程候補の目標を維持し、candidate matrix / catalog / priorityは変更していない。

## Tests

| Gate | Result |
|---|---|
| Focused Vitest (`src/logic/panProfile`, `src/logic/doughShapeTarget`) | PASS — 3 files / 19 tests |
| Architecture test | PASS — focused runに含む |
| Type check (`tsc -b --pretty false`) | PASS |
| Lint (new modules) | PASS |
| Vite production build | PASS — 372 modules |
| Full Vitest local | 実行したが長時間suiteのPTYが失効し最終summaryを回収できず。途中で既存suiteのfailure記号を観測。Draft PR CIをauthorityとして確認する |
| `git diff --check` | PASS |

## HV / deployment

内部refactor・未配線純粋基盤のためHV Policy §2の原則不要に該当。共有Preview、Production deploy、Production ONは実施していない。

## Remaining / Owner gate

- Draft PRのCI結果と独立review findingsを解消する。
- staged割当はauthoring proposal。特にSicilianaのpan深さはProduction配線前にOwner確定が必要。
- Recipe/PizzaState/save/scoringへの配線、UI/HV、Production ON、Draft解除、mergeは別Owner承認が必要。
