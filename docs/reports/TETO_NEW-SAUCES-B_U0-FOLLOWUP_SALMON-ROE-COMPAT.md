# 新ソース Phase B U0 後続 — salmon-roe の解放後退問題：互換性対策の確定準備（docs-only）

Status: **調査・提案のみ。** `src/**`・テスト・golden・`e2e/**`・データ・workflow は変更していない。U1 / U2 / U3 の実装・claim は開始していない。PR 作成・merge は行っていない。
基準 `origin/main` = `a8ae31d`（#658 の squash merge。`src/` は `d3da198` から変化なし）。追跡 Issue: #578（B-2 以降の claim は未投稿）。
**「推奨」は助言であり Owner Decision ではない。未回答を承認済みとみなさない。**

前提記録: `docs/decisions/TETO_NEW-SAUCES-B_U0-GATE_2026-10-25.md` §3（M0〜M3、OD-U0-7）、`docs/decisions/TETO_PINSA-577_E5-GATES_TRACKING_2026-10-23.md`（O-3 / 案 A）。

## 1. 結論（先に）

| 項目 | 結果 |
|---|---|
| 問題の再現 | **再現した。** E5 後に一度も起動していない（台帳に roe がない）count ≥ 57 の旧セーブは、通常 step を 1 件でも足したビルドで roe を得られない（本番の `buildStartup` → `persistProgress` 経路で確認） |
| 失われるもの | 保存データ・Dex・所持材料は失われない。**まだ台帳に入っていなかった権利が、新ビルドでは入らない**（count が新しい late step 番号に届くまで） |
| 影響を受ける集団 | 「count ≥ 57」かつ「E5 ビルドを一度も起動していない」かつ「roe を購入していない」セーブのみ。E5 の merge は 2026-10-24 21:54 JST（本番デプロイ時刻は未確認）。台帳は起動のたびに App.tsx の保存 effect が書くため、E5 後に 1 回でも起動した人は安全。人数は計測手段がなく不明 |
| 推奨対策 | **M3（互換下限）**: 約 10 行の追加 + 回帰テスト 1 ファイル。保存形式・ladder・DH4・golden に触れない。隔離コピーで既存 32 ファイル / 814 件が通り、新規 10 件も通過 |
| 次の判断 | OD-U0-7 で M3 を承認するか。承認後は、最初の通常 batch の実装 PR の**前**に、独立した小 PR として入れるのが安全 |

## 2. 再現（隔離コピー・本番の起動経路）

方法: `origin/main` を scratchpad にコピー（リポジトリ外、使い捨て）。main のビルドで固定セーブ JSON を生成し、**同じバイト列**を (a) main、(b) 実データ相当の通常 step 追加ビルドで `buildStartup` → `persistProgress`（App.tsx の保存 effect と同じ書き込み）→ `loadSave` に通した。(b) は yuzu 1 件（+1 step）と、yuzu + dengaku + tahini（+3 step）。

| セーブ（固定バイト列） | main（roe = step 57） | +1 step（roe = 58） | +3 step（roe = 60） |
|---|---|---|---|
| **stale57**: count 57、台帳に roe なし | 起動で roe が台帳に入る | **roe が入らない** | **roe が入らない** |
| e5launched57: count 57、台帳に roe あり | 変化なし | roe 保持 | roe 保持 |
| roeOwned57: roe を購入済み | 変化なし | roe 保持 | roe 保持 |
| ikuraDiscovered: ikura 発見済み（count 58） | 変化なし | roe 保持、Dex 保持 | roe 保持、Dex 保持。count 58 で step 57-58 の通常材料が追加解禁 |
| count56: 未到達 | 変化なし | 変化なし | 変化なし |

追加で確認した点:
- 台帳は**縮まない**（起動前の台帳の全 ID が起動後も残る）。
- 台帳に入っている「この版が知らない ID」は起動 + 保存後も残る。
- Dex の件数は不変（ikura の Dex 項目も保持）。
- stale57 は新しい通常材料（yuzu-kosho 等）は受け取る。roe だけが遅れる。
- 遅れの量（再掲、実測）: stale57 は新レシピ（クレジット対象）を発見するたびに count が増え、**最後の新レシピで roe が解禁**される（+1 なら count 58、+3 なら 60）。詰みはない。

## 3. 対策案の比較

| 案 | 内容 | 保存形式 | コード | 既存セーブへの効果 | リスク |
|---|---|---|---|---|---|
| M0 受容 | 何もしない（O-3 案 A のまま） | 変更なし | なし | stale57 は roe が数レシピ分遅れる | 該当人数が不明。E5 merge から約 18 時間で、未起動のセーブは多い可能性がある（デプロイ時刻未確認）。batch が進むほど遅れが伸びる |
| M1 運用 | 最初の通常 batch を E5 公開から時間を空けて出す | 変更なし | なし | 未起動セーブが減るだけ。ゼロにはならない | 「どれだけ空ければよいか」の根拠がない（起動率の計測手段なし） |
| **M3 互換下限** | late 材料ごとに「E5 時点の count」を固定の下限として持ち、`resolveShopEntitlement` でその count 以上なら権利に含める | **変更なし**（台帳に入るだけ） | 小（下記） | stale57 を含め、E5 時点で roe を得られた全セーブが従来どおり count 57 で得る | step 番号 = 解禁 count という前提に例外が 1 つ入る（後述 §4.3）。late 材料を増やすたびに下限を 1 行決める運用が要る |
| M2 番号帯の予約 | late step に固定の解禁 count を持たせる（ladder の純粋層） | 変更なし | 中（`ProgressionStep` / `appendLadderSteps` / `reachedLadderSteps` / validator / テスト） | M3 と同等 + 到達性解析にも反映 | ladder の純粋層・hint / cohort の step 番号前提に触れる。**別 Issue 扱い**（E5 追跡文書の案 C の評価と同じ） |

M3 を ladder 層（M2 型）ではなく**権利ブリッジ**（`resolveShopEntitlement`）に置く理由: 本番で ladder の解禁を呼ぶのはこの関数だけ（`gameReducer.ts` 2 箇所、`startup.ts`、dev ツール。grep で確認）。ここだけの変更なら ladder の導出・hint5 golden・到達性解析・DH4 を動かさない。到達性解析（ladder 層）は下限を見ないため、**常に保守側**（M3 後でも解析結果は安全側にしか誤らない）。

## 4. 推奨案 M3 の詳細

### 4.1 変更の形（提案。今回は適用しない）

1. `src/data/lateCatalog.ts`: 固定表を 1 つ追加。値は E5 出荷時に導出されていた番号（通常 56 step + 1）。
   ```ts
   export const LATE_ENTITLEMENT_FLOORS: Readonly<Record<string, number>> = { "salmon-roe": 57 };
   ```
2. `src/state/materialEntitlement.ts` の `resolveShopEntitlement`: ladder 解禁の後に、`discoveredCount >= floor` かつ **渡された ladder がその材料を売っている**（OFF / dev 用 ladder は不変）かつ未解禁の ID を、解禁済み・新規解禁の両方に追加する（NEW MATERIAL は他の ladder 解禁と同じく 1 回だけ告知される）。既存の台帳の順序は変えない。
3. 回帰テスト（§6）。

差分は実装 10 行程度（隔離コピーで作成し、`tsc -b` も通過）。

### 4.2 隔離コピーでの検証結果（リポジトリには入れていない）

- 新規回帰テスト 10 件通過。
- 既存: `materialEntitlement` / `persistence*` / `lateCatalog*` / `e5.ikuraProduction` / `ladderReachability.starGate` / `discoveryLadder*` / `materialShop` / `gameReducer.materialShop` / `inventory*` の **32 ファイル 814 件通過**（4 todo は従来どおり）。
- §2 の再現を M3 で再実行: stale57 が +1 / +3 のどちらでも roe を受け取る（`newlyInLedger=[yuzu-kosho, salmon-roe]`）。他のセーブは M3 なしと同一。
- 未実行: 全体 Vitest、E2E、実機。

### 4.3 影響の整理

| 観点 | 影響 |
|---|---|
| salmon-roe の既存解放状態 | 台帳にある / 所持している場合は変化なし（重複追加なし）。ない場合のみ count ≥ 57 で追加 |
| 未知 ID の保持 | 変更なし。台帳の他 ID は温存（テストで確認） |
| Dex | 触らない。ikura 発見済みのセーブでも Dex 件数は不変 |
| Research | 権利（Shop で買えるか）が変わるだけ。Research の登録と cohort 文字は**所持材料**から導出されるため、権利の追加では動かない（コード読解。画面の実行検証は未実施） |
| ladderCredit | ikura は credited（count に数える）。roe が count 57 で買えるため ikura を早く作れ、count が進むので次の通常 step も早く解禁される。**後退する方向には働かない**。`ladderCredit:false`（Pinsa・grandma 等）は無関係 |
| ★ゲート | 星は Dex から毎回導出。下限は count しか見ない |
| 新規プレイヤー | roe は従来どおり count 57。通常 batch が増えても、roe は「最初の新通常材料と同じ count」で解禁される（番号上の late step より前になる）。ikura の key 材料が他の ladder 材料より先に買えることになるが、key-free のため hint 側の前提は変わらない（読解） |
| 将来の late 材料 | 追加するたびに下限を決める必要がある（出荷時の導出番号）。表に無い late 材料は従来どおり導出のまま |
| OFF ビルド / dev ツール | ladder が売らない材料には下限を適用しないため不変 |

### 4.4 M3 のリスク（残るもの）

1. 例外の持ち込み: 「材料は ladder の step 番号で解禁」という説明に、late 材料だけ例外が付く。表と理由をコードコメントとテストで固定する（提案どおり）。
2. 下限値の誤り: 57 は E5 出荷時の導出値（通常 56 step + 1）。誤ると過剰または不足。テストで「下限 ≤ 現在の導出番号」「表のキーは本番カタログの late 材料」を検査する（提案テストの 1 番目）。
3. 到達性解析との乖離: 解析は下限を見ない（保守側）。将来 ladder 層で M2 を採るなら置き換わる。
4. 隔離コピーでの確認のみ。本番ビルドでの E2E は実装 PR で行う。

## 5. 選択肢ごとの判断材料

- 「E5 後に未起動のセーブが多いか」は計測できない。多い可能性を排除できないため、**一度出した解禁を実質的に遅らせる変更**である M0 / M1 は、互換性を優先する今回の方針と合わない。
- M3 は保存形式・golden・DH4 に触れず、効果は台帳に roe が**早く入るだけ**（台帳は縮まないので、仮に後から取り下げても失うものがない）。取り下げも 1 コミットで戻せる。
- M2 は正攻法だが ladder 純粋層に触れる。U1 の前に入れるには大きい。M3 の後に、必要なら別 Issue で。

## 6. 必要な回帰テスト（提案。隔離コピーで 10 件通過を確認済み）

新規 `src/state/materialEntitlement.lateFloor.test.ts`:

| # | テスト | 目的 |
|---|---|---|
| 1 | 下限表のキーは本番カタログの late 材料で、値は現在の導出 step 番号以下 | 下限値の誤り・将来の取り違えを防ぐ |
| 2〜5 | 通常 step を 0 / 1 / 2 / 3 件追加した ladder で、count 57 の未起動セーブが roe を得る（NEW MATERIAL に含まれ、既存台帳の順序は不変） | 本問題の直接の回帰 |
| 6 | count 56 では何も得ない | 早すぎる付与の防止 |
| 7 | 2 回目の解決は何も告知せず、台帳を参照同一で返す。Dex が小さくなっても再ロックしない | 冪等・非後退 |
| 8 | 台帳または所持に既にあるセーブは重複しない | 既存セーブ不変 |
| 9 | ladder が材料を売らない場合（late OFF 形）は不変 | OFF ビルド不変 |
| 10 | 未知 ID が台帳に残る | 前方互換 |

実装 PR では加えて次を再実行する: `lateCatalog.ikura.test`（+1 の番号移動テスト）、`e5.ikuraProduction.test`、`persistence.compat.*` / `forwardCompat`、`ladderReachability.starGate`、`materialShop` 系、`catalogLedger`、`tsc -b`、`oxlint`、build。`deductionProduction.gate` / `deductionGuard.gate` は影響しない見込みだが、再実行して結果を PR に書く。

## 7. Owner 判断事項

| # | 判断 | 選択肢 | 回答 |
|---|---|---|---|
| OD-U0-7（再掲・具体化） | 既存セーブの roe 対策 | M0 受容 / M1 運用 / **M3 互換下限（推奨）** / M2 別 Issue | （未回答） |
| OD-U0-7a | M3 を採る場合の入れ方 | (i) U1 より前の独立した小 PR / (ii) 最初の通常 batch の実装 PR に同梱 | （未回答） |
| OD-U0-7b | 下限値 57 の確認 | E5 出荷時の導出値（通常 56 step + 1）。異なる値にする理由が無ければ 57 | （未回答） |
| OD-U0-7c | 将来の late 材料の運用 | 追加時に下限を 1 行決める運用でよいか | （未回答） |
| OD-U0-7d | E5 の本番デプロイ時刻・起動率の確認 | 判断材料。Owner 側で分かれば共有（Claude Code は計測手段なし） | （未回答） |

U1 / U2 / U3 の実装開始は引き続き未承認。原典確認（OD-U0-1）も未回答のまま。

## 8. この報告で変更・実施していないもの

`src/**`・テスト・golden・`e2e/**`・データ・workflow・DH4 gate、Pinsa（#659 は別セッション）、FINISH E5、Grandma、Production・Firebase・Preview。調査はリポジトリ外の隔離コピー（scratchpad）で行い、リポジトリへは持ち込んでいない。
