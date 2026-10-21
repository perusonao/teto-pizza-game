# FINISH R8 — 在庫消費とレシピ登録の非原子性 Fresh Audit / 実装前設計

- 対象: Issue #560 のコメント todo #3（`persistence.compat.progress.test.ts` の R8）／ FIN-E3a・E4 系
- 監査対象 SHA: `main` = `e3a7537`（#613）。PR #615（HEAD `f2d98c3`）・#584 は参照のみ
- 種別: **調査・設計のみ**。ゲームコード・セーブ形式・既存テストは未変更
- 実装は Owner 承認待ち。merge／共有 Preview 更新／本番 FINISH 有効化は行わない

## 0. 結論（先に）

1. R8 は **FINISH 固有ではなく、本番で既に起きる**。CUT 対象レシピ（15+9 件、ほぼ全レシピ）は `CONFIRM_BAKE`（在庫消費）→ POST_BAKE(CUT) → CUT 確定時に `REGISTER_TO_DEX` の順で、その間の保存は「在庫のみ減った状態」になる。既存の特性化テスト（fugazza）がこの窓を固定している。
2. 一方 **Free Cooking は現在窓なし**（CUT なし、`CONFIRM_BAKE` と `REGISTER_TO_DEX` が同一ハンドラ内で batch され、保存 effect が 1 回しか走らない）。**FINISH を ON にすると Free／Research に窓が新設され**、窓は「数秒の CUT」から「FINISH 工程の全期間」に広がる。ここが本番 ON 前に塞ぐ理由。
3. 推奨は **D（消費と登録を 1 つの確定として保存する）を「保存側の遅延」で実現**する案。ゲーム内の在庫表示・Stock Gate・Dinner・Lunch Rush の判定は変えず、**セーブ形式も変えない**。A（消費自体の遅延）は影響範囲が広すぎ、B（途中再開）と C（返却）はセーブ形式の追加が要る。
4. 実装は PR-3（N1）が使うファイルと衝突するため、**PR-3 の merge 後**を推奨（§7）。

## 1. 現行の状態遷移

```
ORDER ─▶ PREPARE ─▶ BAKE ──CONFIRM_BAKE──┐   ※ ★ = 在庫が減る（メモリ上）／ 💾 = 保存 effect が走る
                                          │
   ┌──────────────────────────────────────┤
   │ (a) 後工程なし（非CUT・焼成失敗・Free FINISH OFF）
   │     ★ ─▶ RESULT ─(同一ハンドラで REGISTER_TO_DEX)─▶ DISCOVERED
   │          └ React が batch ⇒ 描画 1 回 ⇒ 💾 1 回（在庫+Dex+Pitz が同時）      … 実質アトミック
   │
   │ (b) 後工程あり（CUT、将来 FINISH）
   │     ★ ─▶ POST_BAKE[CUT|FINISH] ──💾 在庫のみ保存──┐   ← **窓**
   │              └ CONFIRM_MAKING_STEP(最後) ─▶ RESULT ─▶ REGISTER_TO_DEX ─▶ 💾 Dex+Pitz
   │              ※ Guided+FINISH は FINISH 確定で FINAL 消費（FINISH で置いた分）も加算
   │              ※ Free+FINISH は bake 時に識別せず（deferFreeCookAtBake）、FINISH 確定で識別・記録
   │
   │ (c) Lunch Rush（isMissionRound）
   │     ★ ─▶ RESULT(MissionServePanel) ──💾 在庫のみ保存──┐   ← **窓（結果画面の滞在時間）**
   │              └「次の注文へ」で MISSION_NEXT_ORDER（Dex BEST は発見済みレシピのみ更新）
   │
   │ (d) Dinner：登録しない（設計）。消費は返却なし（OD、Completion Gate 方針）。
   └─ 保存単位: `persistProgress` は 1 キーへの 1 回の setItem ⇒ **1 回の保存は原子的**。非原子なのは「別々の描画で 2 回保存される」ことだけ。
```

根拠コード: `gameReducer.ts` CONFIRM_BAKE（L1404–）／CONFIRM_MAKING_STEP（L1255–）／REGISTER_TO_DEX（L1518–）／MISSION_NEXT_ORDER、`App.tsx` の保存 effect（L419–）と `handleConfirmBake`／`handleConfirmMakingStep`（L650–）、`finalizeRound.ts`、`finishFreeCook.ts`、`inventory.ts`。
進行中ラウンドは保存されない（リロードで ORDER に戻る）。

## 2. 中断ケース別の影響

窓あり＝(b)(c)。窓なし＝(a)。

| ケース | (a) 窓なし | (b) CUT／FINISH 中 | (c) Lunch Rush 結果画面 |
|---|---|---|---|
| 焼成直後のリロード | 損失なし（在庫・Dex とも未保存 or 両方保存） | 在庫だけ減る。**発見・BEST・Pitz（FREE）が消える** | 在庫だけ減る。BEST のみ喪失（新発見はもともとなし）。※run 自体がメモリのみで消える |
| FINISH 中のアプリ終了 | — | Guided: 事前消費分が減り登録なし。Free: さらに識別・ヒントカウンタ・Research 試行記録も未実施（ORIGINAL 発見の機会ごと喪失）。FINISH で置いた分は未消費 | — |
| FINISH 確定の直前 | — | 確定前なら上と同じ。確定は (CUT なし) `CONFIRM_MAKING_STEP`+`REGISTER_TO_DEX` が同一ハンドラ＝アトミック。**Guided+CUT** は FINISH→CUT の間に窓が残り、FINAL 消費が先に保存される | — |
| 保存失敗（容量／ブロック） | 両方未保存＝一貫（タブが生きていれば次の effect が全スナップショットで再試行） | 1 回目（在庫）成功・2 回目（登録）失敗で「在庫のみ」が確定し得る | 同左 |
| 別タブの書き込み | `persistProgress` は dex／pitz／inventory をスナップショットで置換（`persistence.ts` L1119–1131）。古いタブが他タブの消費・登録を巻き戻す（**#282／PR-3 N1 の範囲**） | 同左。さらに窓中の古いタブ書き込みで在庫が戻る＝偶発的な返却 | 同左 |

損失の大きさ: 1 ラウンド分の有限在庫（`unlockCondition` を持つ購入系食材のみ。Starter は無限）＋その回の登録。再調理で回復可能で、進行不能にはならない。ただし初回発見の損失はプレイヤーに「バグ」と見える。

## 3. Duplicate Gate

- 公開 Issue／PR に R8 の実装・設計はなし。`search_issues`（R8／原子性／在庫消費×登録）0 件、open PR 一覧（#615, #614, #612, #587, #584, #581 …）に該当なし。
- 関連記録は #560 のコメント（Phase A の `it.todo`、「本番コード変更が必要・Owner 承認まで実装しない」）のみ。#560 のクレーム（PR-3 / N1）は R8 を**範囲外**と明記。
- 過去の方針: SAVE-V2 監査「消費は `CONFIRM_BAKE` のみ」「返却しない」、Completion Gate Phase 1「FAILED も消費・返却なし」、Dinner「返却なし」。**C（返却）はこれらと衝突**。
- 本ブランチ `claude/finish-r8-atomicity-audit-adt3gx` は origin に既存だが、本書が最初の成果物。

## 4. 対策方式の比較

| | A. 消費を FINISH 完了まで遅延 | B. 途中状態を保存し再開 | C. 中断時に返却 | D. 消費＋登録を 1 確定に（保存側） |
|---|---|---|---|---|
| 窓の閉じ方 | 消費自体を登録時点へ | 窓は残るが再開で回収 | 次回起動時に差分を戻す | 保存だけを確定時点まで遅延 |
| セーブ形式 | 変更なし | **新キー／v3 級**（pizza 全状態・sauce 堆積・timing・dough 形） | **journal 追加が必須**（クラッシュを検知できないため） | **変更なし** |
| 既存仕様への影響 | EP2「消費は CONFIRM_BAKE のみ」を覆す。FINISH の Stock Gate（`canPlacePostBakeIngredient` は「post 分だけ数える」前提）、Dinner の `preConsumptionInventory`、Lunch Rush の `cookableMissionRecipeIds`／売切れ判定（#212）が全て組み直し | 中断復元で Pitz／発見の二重付与（#38 の exactly-once）を再設計 | 返却なし方針（SAVE-V2／Completion Gate／Dinner）と衝突。放棄＝返却の悪用 | メモリ上の在庫・判定は**不変**。App の保存スナップショット 1 か所＋reducer の遷移 |
| PR-3 との整合 | 触るファイルが広い | **PR-3 の forward-compat／書込ガードと直接干渉** | 同左（journal） | 書込ガードで拒否されれば両方未保存＝一貫 |
| 規模／リスク | 大／高 | 最大／高 | 中／中（不正利用） | 小〜中／低 |
| 判定 | 不採用 | 不採用（再開 UX は別機能として別途） | 不採用 | **推奨** |

## 5. 推奨実装案（D：保存側の確定バリア）

**原則**: ゲーム内の `state.inventory` は今まで通り `CONFIRM_BAKE`（FINAL は FINISH 確定）で減らす。**保存される在庫だけ**を、登録（または確定）と同じ描画まで遅らせる。

1. `GameState` に一時フィールド `pendingConsumption: Record<id, number>`（セーブ対象外。`ProgressionCarry` に**含めない**）。
2. 設定: `CONFIRM_BAKE` が POST_BAKE に入る、または Lunch Rush の RESULT に入るとき、`consumePizzaInventory` の差分を格納。`CONFIRM_MAKING_STEP` の FINAL 消費は差分を加算。
3. 保存スナップショット: 新規 `src/state/roundCommit.ts` の `persistedInventory(state) = state.inventory + pendingConsumption`（有限食材のみ足し戻す）。`App.tsx` の保存 effect は `inventory:` の 1 式を差し替え、依存配列に `pendingConsumption` を追加するのみ（`persistProgress` のシグネチャは不変）。窓中の補充（RESTOCK）とは「差分の足し戻し」なので合成できる。
4. 確定（クリア）: phase が POST_BAKE／Lunch Rush の結果待ちを**出た時点**で必ずクリア。非ミッションの RESULT 到達は `REGISTER_TO_DEX` と同一ハンドラ（現行どおり batch）なので、消費＋Dex＋Pitz が 1 回の保存になる。焼成失敗・FAILED で駐車される結果は、到達時にクリア（消費は確定、返却しない＝既存方針）。
5. **フェイルセーフ**: 持ち越しに含めないため、`buildOrderState`／`startPreparingRecipe`／`PLAY_AGAIN`／`RETRY_SAME_RECIPE`／`MISSION_*` のどの経路でも、クリア漏れは「消費が確定する」方向にしか倒れない（無料返却にならない）。
6. Dinner は対象外（登録しない設計、返却なし。run 状態はメモリのみ）。変更しない。

効果: 窓中の中断は「在庫も登録も保存されない」＝§0 の安全要件（「一緒に保存される、または保存されない」）を満たす。セーブ形式・schemaVersion・保存キーは不変、既存セーブとの往復互換も不変。

## 6. 既存機能への影響

- **Lunch Rush**: 在庫判定（`cookableMissionRecipeIds`、売切れ #212）はメモリ上の `inventory` のまま＝不変。保存だけが `MISSION_NEXT_ORDER`／結果画面離脱まで遅れる。run の報酬（`CLAIM_MISSION_REWARD`）・missionBest は別 effect で不変。Mission の CUT 有無は未確認（実装時に確認）。
- **Dinner**: 不変。
- **Free Cooking／Research**: FINISH OFF では窓なし＝保存バイト不変。ON で窓が新設されるが D により閉じる。識別・ヒントカウンタ・Research 試行は FINAL で同一ハンドラ内に確定（現行どおり）。
- **レシピ発見**: 中断しても発見は消えず、在庫も減らない。再調理で取り戻せる。
- **Pitz 経済**: クレジットは `REGISTER_TO_DEX` 内（FREE のみ、exactly-once）で不変。中断時は Pitz も在庫も動かない。
- **経済上の副作用（要 Owner 判断）**: 窓中に焼き結果が見えている場合、離脱すれば有限在庫が戻る＝「見てからやり直し」が無料になる。対象は購入系の有限食材のみ。

## 7. セーブデータ保護 PR-3 との整合

- PR-3（N1: ロード基準値ガード）の範囲は `persistence.ts`／`saveHealth`／`saveSession*`／`App.tsx`（起動時初期化 1 か所＋通知配線）／`persistence.*.test.ts`。**R8 は範囲外**と明記済み。本調査はそれらを変更していない。
- 推奨案の変更は `gameReducer.ts`／新規 `roundCommit.ts`／`App.tsx` の保存 effect の 1 式。**`persistence.ts` は不変**。ただし `App.tsx`（HOT）の同じ effect 周辺に PR-3 の配線が入るため、**PR-3 merge 後に着手**を推奨。R8 特性化テストは `persistence.compat.progress.test.ts`（PR-3 のクレーム glob 内）にあるため、新テストは別ファイルに置く。
- 整合: PR-3 の書込拒否（読込失敗後・別タブ更新）が起きた場合、確定の書込も拒否され「両方未保存」で一貫。別タブの巻き戻し自体は PR-3／#282 の領域で、D はそれに依存しない（両者は直交）。
- PR #615（`src/data/**` の後乗せ基盤、本番 OFF／データなし）・#584（HOLD）とは別ファイル。#615 の merge 順に依存しない。

## 8. FINISH 本番 ON 前の最小実装と回帰テスト

### 最小実装（§5 の 1〜5）
`roundCommit.ts`（純関数）＋ reducer の 3 箇所（CONFIRM_BAKE の POST_BAKE／Mission 到達、CONFIRM_MAKING_STEP の FINAL 加算とクリア、持ち越し非含有）＋ App 保存 effect の 1 式。

### テスト計画（新規ファイル `persistence.r8.atomicity.test.ts` ほか）
1. 既存 `it.todo`（R8）を満たす行列: {Guided 非CUT, Guided+CUT, Guided+FINISH, Free+FINISH(opt-in), Research, Lunch Rush} × {BAKE 直後, CUT 中, FINISH 中, 確定直前, 確定直後} で「保存後リロード」→ **在庫と Dex が常に同時に旧 or 新**。
2. FINAL 消費の加算（FINISH で置いた分）と、窓中 RESTOCK が足し戻しで合成されること。
3. 失敗系: 2 回目の setItem が throw／容量超過でも「在庫のみ減る」状態が生まれない。書込拒否（PR-2 の blocked 状態）下で両方未保存。
4. クリア漏れの網羅（性質テスト）: round を作り直す全アクションが `pendingConsumption` を持ち越さない。FAILED／焼成失敗で消費が確定し返却されない。
5. 同一ハンドラで `CONFIRM_BAKE`+`REGISTER_TO_DEX` が `persistProgress` を 1 回しか呼ばない（App レベル spy）。
6. 窓が開かない経路（FINISH OFF の Free、非CUT）で保存バイトが現行と**同一**（ゴールデン）。セーブ形式不変の確認（既存互換テスト・各世代 golden が無修正で通る）。
7. E2E（390×844、Chromium＋WebKit）: FINISH opt-in の Free で FINISH 中にリロード→在庫不変・Dex 不変。通常 CUT レシピでも同様。
8. 特性化のみ: 別タブ巻き戻しは本 PR の範囲外であることをコメントで固定（PR-3／#282）。

## 9. Owner 判断事項

1. **方式**: D（保存側の確定バリア、推奨）で進めるか。A／B／C は不採用でよいか。
2. **着手時期**: FINISH 本番 ON（E5）の前提条件に含めるか。CUT の窓は現在も本番にあるため、FINISH と切り離して先行修正するか（推奨: 先行、PR-3 merge 後）。
3. **中断の経済**: 窓中の離脱で有限在庫が戻る（見てからやり直しが無料）ことを許容するか。許容しない場合は「焼成確定を見たら消費を保存する」代替（窓の一部を残す）に切り替える。
4. **Lunch Rush**: 同じバリアを適用するか、現状維持（BEST のみの損失で run 自体がメモリ依存）にするか。
5. **Dinner**: 現状維持（消費は返却なし）でよいか。
6. **PR-3 との順序**: PR-3 merge 後に着手でよいか。#560 に分割 Issue を立てるか（R4／R5 と同様、分割は Owner 判断のまま）。
7. **FINISH 中断 UX**: 途中再開（B 相当）は R8 とは別機能として、必要なら別 Issue でよいか。

## 10. 未確認事項

- Lunch Rush ラウンドの cooking profile に CUT が含まれるか（窓の長さに影響）。
- 窓中に有限食材の RESTOCK が UI 上到達可能か（足し戻し設計は到達可否に依らず安全）。
- POST_BAKE 中に焼成結果（bakeState）がどこまで見えているか（§6 の経済副作用の大きさ）。
- 実機での kill タイミング（本調査はコード読解と既存特性化テストに基づく。テスト・実行は行っていない）。
