# HV Ops (1/3) #441 — DEV State Editor ⭐状態プリセット Result

Issue #441（#442 / #443 は未着手）。既存 DEV State Editor（#403）の拡張。保存形式・進行ロジック・`persistence.ts`・reducer・data は変更なし。PR #440（`starGateSave.ts` 含む）には触れていない。

## 追加したもの

| 項目 | 内容 |
|---|---|
| `src/devtools/starStates.ts`（新） | `starGatesOf` / `starTargetsOf`（`DISCOVERY_LADDER` の `starGates` から閾値を導出）、`distributeStars`（決定的な均等配分）、`buildStarState`、`starSaveObject`（共有セーブビルダー） |
| `src/devtools/presets.ts` | `STAR_PRESETS` / `starPresetsOf`（`stars-119` / `-120` / `-129` / `-130`。固定の `PRESETS` とは別リスト）、`buildPreset` / `buildPresetById` が星プリセットを解決 |
| `src/devtools/StateEditor.tsx` | プリセット一覧に星プリセットを表示（既存の「選ぶ → 適用 → 復元」フローのまま） |
| `e2e/support/starSaves.ts`（新） | E2E 用の共有ビルダー。Vite SSR loader 経由で `starSaveObject` を呼ぶ（Playwright の Node 実行では `persistence.ts` の `import.meta.env` が使えないため） |
| テスト | `starStates.test.ts`（新）、`e2e/dev-state-star-presets.spec.ts`（新）、`devtoolsAccess.test.ts`（ファイル一覧に1件追加）、`previewIsolation.gate.test.ts`（星プリセットの固定文言と導出ID/ラベルの不在を追加） |

## 設計

- 閾値は ladder の `starGates` から導出（現在 120 = step 50 / 130 = step 51）。各 gate `g` に対し `g-1` と `g` の2状態。gate が増えれば自動で増える。数値・材料ID・レシピIDの直書きなし。
- Dex は onboarding + 該当 step より前の key recipe（既存 `stepContext` と同方式）。加算対象レシピ数が step 以上であることを実行時に検証し、満たさなければ例外。
- 星配分: 全レシピ 1⭐ から、カタログ順に 1 ずつ均等加算（上限 5）。合計はちょうど target、決定的。`bestScore` は `starsFromTotal` の帯に整合（テストで固定）。
- ⭐条件付き材料は「Shop 解放・未購入」（NEW）になる。ledger の導出は `normalizeEditableState` → ゲーム本体の `resolveShopEntitlement`。解放台帳の非縮小仕様はゲーム側のまま（変更なし）。
- 注意: プリセットの適用は「状態を丸ごと置き換える」ので、台帳もプリセットの値になる（例: 130 → 119 を続けて適用すると 119 側の台帳）。元のセーブは `original` バックアップから復元できる。部分編集では台帳は縮まない（テストで固定）。

## レビュー対応の監査（Codex P2 × 3、カタログ依存の取りこぼし）

- `starTargetsOf` は、同じ星数が表すすべての gate を保持する（`StarTarget.gates`）。必要な step は保持した gate の最大 step。最大 step に届いても、星数が足りない gate の材料は解放されない（ゲーム側の解放判定は不変。テストで「解放 ⟺ step 到達 かつ 閾値到達」を同値・隣接・非隣接・先頭・末尾の ladder で確認）。
- 星数が Dex の保持範囲（1〜5⭐×必要レシピ数）外、または step に届かない target は、一覧に出さず、build は理由つきで失敗する（`planStarState` / `buildableStarTargets`）。
- 説明文は、1つの星数が複数の役割（ちょうど／1つ手前）を兼ねる場合に両方を述べる。production の4説明文は不変。
- 観察（変更せず）: 129 / 130 の Dex には step 50 の key recipe（california-style-pizza）が入るが、その必須材料 goat-cheese は未所有（Shop で NEW）。実プレイでは起きない状態だが、production プリセットの挙動と Shop の NEW 表示を変えないため、そのままにしている。

## 検証

- 全体 Vitest: 368 ファイル / 6885 PASS（skip 1 は既存）。`tsc -b` クリーン、`npm run build` OK、oxlint エラー 0（既存の warning のみ）。
- 星プリセットの unit: 合計 119/120/129/130、**loader（`loadSave`）経由**の step 到達・`resolveShopEntitlement`（119 = goat-cheese 未解放 / 120 = 解放 / 129 = spinach 未解放 / 130 = 解放）、`roundTripIssues` 空、172 レシピ合成カタログ＋独自 gate、台帳の非縮小。
- E2E（Preview / production の実ビルド、390×844 と 360×800）: 4 プリセットを UI から適用 → 保存が共有ビルダーの出力と一致 → ゲームの Shop が gate どおり（NEW 表示）→ production 保存は不変 → Owner 保存を `original` バックアップから byte 単位で復元。production の `?dev=state` は不活性、通常 Preview に導線なし。
- 既存 `dev-state-editor*.spec.ts`（24 件）PASS。

## Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| hv-ops-441-star-presets-390x844.mp4（H.264） | 390×844 | 39.2s | 1.1MB | PASS |

Download: セッション内直接提出（repository には commit しない）。

確認できること: ① ⭐119 / 120 / 129 / 130 を順に選ぶ → 適用前の確認 → 適用 ② 各適用後にゲームの Shop を開き、ヤギのチーズ（120〜）とほうれん草（130〜）が gate どおり NEW になる ③ バックアップ（original）から Owner の保存を復元。

Video Verification: PASS（ffprobe: h264 / 390×844 / 39.2s、フレーム抽出で操作を確認）

Screenshots: `docs/reports/screenshots/hv-ops-star-presets/`（390×844 一式、360×800 は代表 2 枚）。
