# #577 P3-a2 — 後乗せカタログの型・validator 例外・`discoveryIdentityOf` の生地対応 Result

Refs #577。基準 `main` `a6c1463`。Owner 決定 L1 / D1 / D2 / D3 / D6（2026-10-23）。決定記録は `docs/decisions/TETO_PINSA-577_P3_L1-DECISIONS_2026-10-23.md`（P3-0、#638）。**Pinsa のデータ本体（P3-b）は HOLD で、追加していない。** 本番 FINISH / Late Catalog は OFF のまま。

## 変更
- `src/data/lateCatalog.ts`
  - `LateRecipeEntry` に `doughKind?: DoughKind` と `ladderCredit?: false` を追加。`LateRecipeShape`（検証が読む形）にも `ladderCredit?` / `doughKind?` を `unknown` で追加し、データが運びうる不正値を検証が捕まえられるようにした。
  - `validateLateCatalog`（D1）:
    - **免除**: `ladderCredit: false` の後乗せレシピは、late ladder step の key でなくてよい（データ由来。id の allowlist は使わない）。
    - **厳格な検証**: ①`ladderCredit` が `false` 以外（true・文字列・0・null）なら違反。②`ladderCredit:false` のレシピが後乗せ専用の素材を要求したら違反（到達可能性は通常 ladder だけで保証する）。③`ladderCredit:false` のレシピが late step の key になっていたら違反。④`doughKind` が既知でなければ違反。
    - 免除しないもの: POST_BAKE の要求、`lunchRush:false`、レシピ id・discovery target id の一意と存在、未知の素材、後乗せ素材が step に名指しされること。
  - `isDoughKind` を値として import（`doughKind.ts` は import を持たない leaf。先頭コメントを更新）。
- `src/data/discoveryCatalog.ts`: `discoveryIdentityOf` が `resolveDoughKind` でレシピの生地を読み、標準でないとき `dough` 軸と `DOUGH_VARIANT` を足す。late のみの出力（`LATE_ADDITION`）は従来と同一。通常レシピは従来どおり**同じ** `DEFAULT_IDENTITY_DIMENSIONS` オブジェクトと空の capabilities を返す。
- `src/data/lateCatalog.ts` の実データ（`LATE_RECIPES` ほか）、`recipes.ts`、`matcher.ts`、`signature.ts`、採点、保存、本番スイッチは**変更していない**。

## 本番での挙動
後乗せカタログは OFF では読まれず、通常レシピは `doughKind` を持たない。**本番の挙動は変わらない**（`lateCatalog.offGolden` / `offSurface` golden、DH4 gate は無修正で通る）。

## テスト
- `src/data/lateCatalog.ladderCredit.test.ts`（11 件、合成 fixture）: 免除の受理、**否定テスト**（credited の後乗せには従来どおり key が要る／`ladderCredit` が false 以外は拒否され免除にもならない／後乗せ専用素材の要求・late step の key・POST_BAKE なし・lunchRush・id 重複・未知素材・target id の欠落/重複/余りは免除されない／未知の doughKind）、`ladderCredit` を持たない従来のカタログの挙動不変。
- `src/data/discoveryCatalog.doughIdentity.test.ts`（34 件）:
  - `discoveryIdentityOf`: 全出荷レシピと実カタログが同じ default オブジェクト・空 capabilities／未知・標準の `doughKind` は default／late のみは従来どおり／dough のみ／L1（dough ＋ ルッコラのみ後乗せ、`["DOUGH_VARIANT","LATE_ADDITION"]`）／late id の整列と重複除去。
  - **L1 の判定表**（ジャモンの食材 × 生地 2 × 後乗せ 4 × 天板 2 = 16 行）を、実カタログ＋**合成 Pinsa target**（同じ関数で構築）で全行テスト。D2（標準生地＋ルッコラ後乗せ＝ORIGINAL、本番カタログでも）、L1（Pinsa 生地＋生ハム後乗せ＝ORIGINAL）、本番カタログでジャモンが発見されるのは 16 行中 1 行のみ、発見済みジャモンは `ALREADY_DISCOVERED` のまま・発見リストを変更しない、ジャモンの target が不変。
  - **D3**: 技法の affordance は Pinsa/後乗せ target が無いと null（INV-TQ-4）／ikura のみ＝後乗せの step（ここでは 56）、Pinsa あり＝33（許容した前倒し）／T1 riddle が固定文字列で固有語を含まない／T2 Dex は step 33 未満で riddle なし、33 以降は固定の riddle 2 つのみ（名前・説明・id 以外のキーなし）／Pinsa target が足すのは dough の riddle だけ／レシピ経路は両技法を記録／usage 経路は各 affordance が開いたときだけ記録。
- **変異確認**: `discoveryIdentityOf` を元に戻すと 8 件、免除を全後乗せに広げると 3 件、後乗せ専用素材の検査を外すと 1 件が失敗する（テストが実際に縛っている）。

## 検証
- 全 Vitest: 511 files passed, 1 skipped（9459 passed, 2 skipped, 4 todo）。
- `npx tsc -b`、`npm run build`、`npx oxlint`（既存 warning のみ）。
- Playwright（Chromium・iphone-390x844）: `e2e/dough-kind-chips-p2.spec.ts` と `e2e/free-finish-e3b.spec.ts`（FINISH が OFF のままであること）の計 17 件 pass。本 PR は表示・操作に影響しない（型・検証・識別の導出のみ）ため関連 E2E に絞った。WebKit は CI で確認。

## 範囲外・未実施
- Pinsa のレシピ・食材・order・sauce profile・hint role・Reference・discovery target id（P3-b、HOLD）。ON ビルドでの実カタログのテスト（DH4 掃引の `dough × late` 状態の追加、T3〜T6 の実データ版）は P3-b で行う。本 PR の T1 / T2 は合成 target による導出規則の固定。
- Guided の dough 設定は P3-a1（#639）。
- HV: 本番で見た目・操作が変わらないため不要（`TETO_HUMAN-VERIFICATION-POLICY.md` §2）。
