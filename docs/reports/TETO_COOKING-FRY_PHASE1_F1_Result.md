# Cooking Fry Phase 1 — F1 Result（純粋ロジックのみ・未配線・本番 OFF）

作成: 2026-11-04 / 基準 `main` = `0016222` / ブランチ `claude/teto-next-cooking-method-cgnsh4` / 管理 Issue **#749**
設計: `TETO_COOKING-METHODS-AFTER-STEAM_Design-Audit.md`（同じ PR に含む）
Owner 承認範囲: **F0 / F1 のみ。F2 以降は HOLD。Production ON 禁止。** reducer の一般化なし。対象は eggplant のみ（shrimp / hot-dog は対象外）。

## 1. 結論
F1 は新規ファイルだけで完了した。どこからも import されず、UI・reducer・採点・保存・在庫・Dex・Pitz には接続していない。`FRY_EXPERIENCE_PRODUCTION = false`。HV 動画は対象外（UI/操作が変化しない純粋ロジックのみ。`TETO_HUMAN-VERIFICATION-POLICY.md` §2 の「見た目/操作が変化しない unit test 追加」に相当）。

**重要な事実（Owner 判断 O-A）:** eggplant には専用の絵（`pieceVisual`）が無い。対象規則は炒め・炙り・蒸すと同じ「対象リスト **かつ** 絵あり」のため、**F1 時点で `canFryIngredient("eggplant")` は false（休眠）**。絵の追加は `ingredients.ts`（Batch 18 / #748 の claim 範囲）を編集するため本 PR では行わない。絵の判断が出るまで、F3 で画面に出ても何も起きない。

## 2. 追加ファイル（すべて新規、既存ファイルの変更ゼロ）
| ファイル | 役割 |
|---|---|
| `src/data/fryIngredients.ts`(+test) | 対象規則。`["eggplant"]`＋絵あり。カタログ参照は注入可（絵が付いた後の挙動をテストするため） |
| `src/data/fryExperienceGate.ts` | `FRY_EXPERIENCE_PRODUCTION = false`、`fryExperienceEnabled()` |
| `src/preview/fryPreview.ts`(+test) | Preview/DEV 限定の query 解釈（`?cookFry=on|off`、`?cookFryVariant=tap|drag|both`、`?cookFryTime=short|standard|long`）。タブ単位の記憶キー `teto:cookFry`。本番では読まない（`import.meta.env.DEV || VITE_PREVIEW_MODE` 内）。未配線 |
| `src/logic/fry/fryPot.ts`(+test) | 泡の段階・見た目・`amount`・文言（共通） |
| `src/logic/fry/fryTap.ts`(+test) | 操作 A の状態機械 |
| `src/logic/fry/fryDrag.ts`(+test) | 操作 B の状態機械（タップ代替を含む） |
| `src/logic/fry/friedLook.ts`(+test) | 置いたピースの CSS 変数（`filter` のみ） |
| `src/logic/fry/fryOffer.ts`(+test) | ピルを出す条件（純粋。現状は常に null） |
| `src/logic/fry/fry.architecture.test.ts` | 独立性・未配線・非読取りの固定 |
| `docs/reports/TETO_COOKING-FRY_PHASE1_F1_Result.md` | 本書 |
併せて同ブランチの設計資料 `TETO_COOKING-METHODS-AFTER-STEAM_Design-Audit.md`（新規）と `TETO_COOKING-METHODS-NEXT_Research.md`（後続ポインタ 4 行）を含む。

## 3. 仕様（数値はすべて PROVISIONAL、iPhone HV で調整）
### 3.1 泡の段階（`fryPot.ts`）
手掛かりは色ではなく泡。入力は「油に入っていた時間 `submergedMs`」のみ。乱数・実時間を使わない（同じ入力は同じ結果）。

| 段階 | 区間 (ms) | 泡の大きさ / 勢い | 画面の短い語 | 見た目 |
|---|---|---|---|---|
| big | 0〜2000 | 1 / 1 | ジュワワワッ！ | raw |
| medium | 2000〜3500 | 0.7 / 0.75 | ジュワ… | raw |
| fine | 3500〜6500 | 0.4 / 0.5 | ぷつぷつ | crisp |
| calm | 6500〜8500 | 0.25 / 0.25 | ぷち… | crisp |
| still | 8500〜 | 0.1 / 0.05 | シーン… | over |

- 見た目の名前（採点に入れない）: raw「まだ生っぽい」／crisp「カリッと揚がった」／over「揚げすぎて濃い色になった」。ゲージ・数値・残り時間・評価語なし。**失敗状態なし。**
- 境界は後の段階に属する（2000 ちょうどは medium）。非有限・負の時間は 0 扱い。
- `amount`: 時間とともに単調増加、over 以外は 0.95 以下、over は厳密に 1（`amount` だけで crisp と over を区別できる）。`fryLookOfAmount` で逆引き可能（全域でラウンドトリップをテスト）。
- 比較用の時間スケール `short 0.75 / standard 1 / long 1.35`（境界に掛ける）。不正値は 1。境界ちょうどが浮動小数で外れないよう 1e-6 ms に丸める。

### 3.2 操作 A: 2 タップ（`fryTap.ts`）
`START(now)`→ 揚げ中、`LIFT(now, timeScale?)` → 引き上げて結果を保持。0.6 秒未満の引き上げは誤タップとして `idle{tooShort}`（何も保持しない）。タイムアウトなし。`CANCEL`（全消去）、`INTERRUPT`（ボタンのフォーカス喪失で揚げ中のみ破棄、保持済み結果は残す）。無効な操作は同一オブジェクトを返す。

### 3.3 操作 B: 縦ドラッグ（`fryDrag.ts`）
`depth` は 0（皿）〜1（油の底）。UI が座標から変換する（F3）。
1. `GRAB`（皿の具）→ `MOVE` で下へ運ぶ（carrying）。**油面 0.55 を越えた瞬間に揚げ開始**（時計もここから）。
2. 指を離しても**油に残る**（指で泡が隠れない）。油面より上で離すと何も入らない。
3. もう一度 `GRAB` して **0.4 より上**へ `MOVE` すると引き上げ（0.55 と 0.4 の間は揺れで外れない隙間）。0.6 秒未満は誤ドラッグ（`idle{tooShort}`）。
4. **必須の代替:** `TAP_DOWN` / `TAP_UP`（ボタン・矢印キー ↓／↑）。同じ時間なら結果はドラッグと一致（テスト）。ドラッグとタップは混在可。
5. `POINTER_CANCEL`（運搬中は破棄、油中は掴みを離すだけ）／`INTERRUPT`／`CANCEL`。時計の逆行・非有限値・範囲外 depth（クランプ）に耐える。

### 3.4 `friedLook`（一時状態の見た目）
`friedPieceStyle(amount)`: `--fry-bright / --fry-sat / --fry-sepia / --fry-sheen` のみ（`filter` 用。`transform` は触らない）。未調理・不正値は `undefined`/`null`（既存ピースとバイト同一）。raw=無加工、crisp=黄金色＋つや、over=暗く鈍く。他 3 法の変数・クラスと衝突しない。保持する状態はラウンド内の transient（`friedLook` の置き場は F2 の reducer で定義するが、本 PR では状態を持つ場所自体が無い）。

### 3.5 Production OFF
`FRY_EXPERIENCE_PRODUCTION = false`。ON になる唯一の経路は Preview/DEV の `?cookFry=on` で、F3 の配線までは誰も読まない。実ビルド（`npm run build`）の `dist/` に `cookFry` / `fryExperience` / `friedLook` の文字列が**無い**ことを確認した。

## 4. 影響しないこと（architecture test で固定）
- reducer・`GameScreen`・`PizzaStage`・`App`・`main`・カタログ・採点（Scoring 2.0 / Pitz）・識別・Hint・Research・Dex・保存・`pendingRound`・在庫は fry を一切 import / 言及しない（`LATER_SLICES` は空。F2/F3 で配線するときに、その PR が意図的に追加する）。
- 炒め・炙り・蒸すと**コードを共有しない**（fry の import は自分自身・カタログ読取り・`RoundKind` 型・`CSSProperties` 型のみ。双方向に他 3 法の名前を含まない）。
- fry のロジックに `Date` / `performance` / `Math.random` / タイマー / `localStorage` 系なし。

## 5. 検証結果
| 項目 | 結果 |
|---|---|
| fry 専用（8 ファイル） | 75 tests pass |
| 全 Vitest | 下記 §5.1 |
| `tsc -b` | エラーなし |
| `oxlint` | fry ファイルへの警告 0（既存の警告のみ） |
| `npm run build` | 成功。`dist/` に fry の文字列なし |
| 既存ファイルの変更 | なし（`git diff origin/main --name-status` の M は `TETO_COOKING-METHODS-NEXT_Research.md` の追記 4 行のみ） |
| 他セッションの範囲 | Steam #738 / #747、DRIZZLE #746、Batch 18 #748 のファイルに触れていない（F1 は新規ファイルのみ。`ingredients.ts` / `recipes.ts` / `gameReducer.ts` / `GameScreen.tsx` / `PizzaStage.tsx` / `App.tsx` は無変更） |

### 5.1 全 Vitest
（下記に記入）

## 6. F2 への依存関係（HOLD 中）
- F2（reducer `FRY_INGREDIENT`、`gameReducer.ts` は HOT）は **#738（Steam S3）の merge 後**に限る。#738 は `PizzaStage` / `GameScreen` / `App` / `main` を追加編集しており、F3 も同じ 3 ファイルに触る。
- eggplant の絵（別 Gate）が無い限り、F2/F3 を入れても画面には何も出ない。F3 の HV には絵が必須。絵の追加は `ingredients.ts`（Batch 18 の claim は〜2026-11-18）を触る。
- 4 つ目の独立実装（一般化しない）は Owner 承認済み。

## 7. Owner 判断事項
1. **eggplant の専用絵（`pieceVisual`）をいつ・どの Gate で作るか。** 絵が無い限り fry は休眠。Batch 18 の claim 失効後が衝突しない。仮の描画（絵文字のまま）で HV する選択肢は対象規則（絵あり）を変える判断になるため、Owner が決める。
2. 時間境界（3.5 秒で crisp、8.5 秒で over）と時間スケール 3 段が HV の出発点でよいか。
3. F2 の着手条件（#738 merge 後でよいか）。
4. 技法（Technique）として Dex に出すか（Phase 1 は出さない前提のまま）。
