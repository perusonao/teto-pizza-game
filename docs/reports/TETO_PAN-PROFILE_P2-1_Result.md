# PAN_PROFILE Phase 2 / P2-1 — Recipe authoring schema Result

Issue: #849  
Branch: `codex/pan-profile-p2-1-authoring`  
Base: `a5a228d8` (`main`, PR #840 merge)

## Result

`Recipe` に任意の `panProfileId` / `doughShapeTargetId` をauthoring metadataとして追加した。両フィールドは未指定可能で、Production catalogの既存レシピおよびstaged 6品への値設定は行っていない。

`validateRecipePanAuthoring()` は両IDをそれぞれのregistry ID集合に対して検証し、両方が既知の場合だけPhase 1の明示的compatibility contractを検証する。unknown、型不正、prototype-chain由来の名前、既知だが非互換な組合せはissueを返し、例外やfallbackを発生させない。どちらか一方だけのauthoringも許容する。

## Scope guard

- Production runtimeへのimport・call site追加なし。
- staged 6品のProduction catalog追加・割当なし。
- `PizzaState`、Save v2、scoring、`bakeTarget`、`CookingProfile.steps`、UIは変更なし。
- P2-2 runtime adapter、P2-3以降、Production ON、共有Previewは対象外。

## Verification

| Gate | Result |
|---|---|
| Focused Vitest | PASS — 4 files / 41 tests（architecture gate含む） |
| Existing recipes unspecified parity | PASS — 全`RECIPES` entryが両field未指定かつvalidator PASS |
| Unknown / unsupported inputs | PASS — unknown、型不正、prototype-chain ID、incompatible pair |
| TypeScript (`tsc -b --force`) | PASS |
| Lint | PASS（既存warningのみ） |
| `git diff --check` | PASS |
| Full Vitest first CI | 668 files / 12,342 tests PASS、architecture gate 1件FAIL。P2-1のtype-only Recipe importをruntime wiringと誤判定したためgateを型import許容へ修正 |
| WebKit / CI | Draft PRで確認 |

## Remaining gate

Draft PRのCI、WebKit、独立reviewを完了し、Owner承認までDraft解除・mergeしない。Production配線は別Gate。
