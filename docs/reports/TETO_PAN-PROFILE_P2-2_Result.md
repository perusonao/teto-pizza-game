# PAN_PROFILE Phase 2 / P2-2 — Runtime compatibility adapter Result

Issue: #849  
Branch: `codex/pan-profile-p2-2-runtime-adapter`  
Base: `a5a228d8` (`main`, PR #840 merge)

## Result

Recipe-like authoring inputと既存pan情報から`EffectivePanRuntime`を解決する純粋関数 `resolveEffectivePanRuntime()` を追加した。既存`effectivePanShape()`は変更・削除せず、Production call siteにも接続していない。

- 未指定 / legacy roundは`legacy-round` + `round`へlosslessに解決する。
- legacy trayまたは既存`panShape: square`は`tray` + `square`へlosslessに解決する。
- 明示profileとshapeはregistry存在・compatibilityを検証する。
- `pan` / `shallow-pan` / `deep-pan` / `steel-pan`は既存runtimeへlosslessに表現できないため`UNSUPPORTED_PROFILE`でfail-closedする。
- unknown、型不正、prototype-chain ID、非互換shape、未知legacy値はdiscriminated failureを返す。
- deep / shallow / steelをround / squareへ暗黙変換しない。

## Scope guard

- `effectivePanShape()`および全Production readerは変更なし。
- Production import / wiringなし。barrel exportにも追加せず、moduleは独立。
- Recipe catalog、staged 6品、Save v2、scoring、`bakeTarget`、`CookingProfile.steps`、UIは変更なし。
- directHeatContactのProduction効果、P2-3以降は別Gate。

## Verification

| Gate | Result |
|---|---|
| Focused Vitest | PASS — 3 files / 46 tests |
| Existing round / tray parity | PASS — `effectivePanShape()`との比較を含む |
| Unknown / unsupported inputs | PASS — fail-closed reasonを固定 |
| TypeScript (`tsc -b --force`) | PASS |
| Lint | PASS（既存warningのみ） |
| Vite build | PASS — 372 modules |
| `git diff --check` | PASS |
| Full Vitest local | P2-1と同一環境で既存heavy suitesがresource timeoutしたため再実行せず、PR CIをauthorityとする |
| WebKit / CI | Draft PRで確認 |

## Remaining gate

Draft PRのCI、WebKit、独立reviewを完了し、Owner承認までDraft解除・mergeしない。P2-1 merge後の型接続やProduction配線は本PRの対象外。
