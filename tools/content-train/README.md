# Content Train — spec と事前検査（#780）

食材・レシピの列車（release train）を、HOT カタログを編集する**前に**実カタログで検査し、Owner への判断事項を 1 枚にまとめる読み取り専用ツール。カタログ・golden・既存テストは変更しない。設計と根拠: `docs/reports/TETO_TRAIN-EFFICIENCY_Plan_2026-11-10.md`。

```
# 1. staged から列車スペックを作る（Owner 決定の上書きは --family / --placement）
node tools/content-train/make-spec.mjs --train T24 --ids peruvian-aji-amarillo,thai-chicken-pizza --out /tmp/T24.spec.json
node tools/content-train/make-spec.mjs --train survey --no-mechanic --exclude <出荷中の id> --out /tmp/survey.spec.json

# 2. 事前検査（約 3〜40 秒）。<dir>/<train>.preflight.md が Owner パケット
node tools/content-train/preflight.mjs /tmp/T24.spec.json --out /tmp/T24
```

終了コード: `0` STOP なし／`1` STOP あり（スペックを直す）／`2` 実行失敗（スペック不正、または決定的上界と標本監査の不一致）。

| ファイル | 役割 |
|---|---|
| `make-spec.mjs` | `src/data/staged/testSupport/*.ts` の行（1 行 1 JSON）を**テキストとして**読み、自己完結のスペック JSON を作る（staged を import しない＝`stagedIsolation.test.ts` を守る） |
| `preflight.mjs`／`launch.mjs` | `src/contentTrain/trainPreflight.run.test.ts` を環境変数つきで起動し、判定を表示。起動は `process.execPath` + vitest 自身の `vitest.mjs`（`npx` は使わない: Windows で `npx.cmd` を解決できず無言で失敗するため）。`launcher.test.ts` が起動方法と実プロセスの終了コードを検査 |
| `src/contentTrain/trainSpec.ts` | 純粋ロジック（スペック検証・重複ゲート・Research の決定的上界・構造的な Gate 予測・パケット描画）。合成データの単体テストのみで、カタログの値を固定しない |
| `src/contentTrain/trainPreflight.run.test.ts` | 実カタログでの測定。`TETO_TRAIN_SPEC` が無い通常のテスト実行では skip |

検査する Gate と、検査しない項目はパケットの §2〜§6 に出る。事前検査は実装 PR のテスト・CI・Codex・HV を**置き換えない**（先に衝突を見つけて、Owner の往復を減らすためのもの）。
