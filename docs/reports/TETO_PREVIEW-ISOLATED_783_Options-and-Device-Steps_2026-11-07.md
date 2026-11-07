# Batch 19（PR #783）を iPhone Safari で確認するための検証環境の選択肢と実機手順（docs-only）

2026-11-07、main `06cfc066`、対象 PR #783 HEAD `abb3da5a1021b160b2ee75acbe5a00866a8a0eaf`（Draft / Gate HOLD）。branch `claude/teto-pizza-parallel-tasks-ylyfe5`。
**調査・設計のみ。** コード・workflow・Pages 設定・共有 Preview・Cloudflare 等の外部サービスは一切変更・作成していない。PR 作成・merge・Production ON なし。
ラベル: 【実測】= 今回 repo / GitHub で確認、【先行】= 既存の docs の記述、【推論】、【未確認】。
先行資料（重複させない）: `TETO_PHASE-1B_PER-PR-PREVIEW_Fresh-Audit.md`（方式比較 A〜I）、`TETO_PHASE-1B_CLOUDFLARE-PREVIEW_Phase1-Implementation-Plan.md`、`TETO_R8_IPHONE-SAFARI-HV-PREP_Result.md`、`docs/decisions/TETO_VISUAL-HV_PREVIEW-WORKFLOW_2026-10-30.md`、`TETO_EXPANSION-BATCH-19_Result.md` §9（#783 ブランチ）。本書は **#783 に当てはめた差分**だけを扱う。

## 0. 結論

1. **共有 Preview は使えない【実測】。** 現在の公開は PR #738（STEAM S3）の `78de12a`（Built 2026-11-06T16:00:50Z、Preview repo README）。#738 は iPhone Safari HV が未実施で、上書きすると #738 の HV 前提が壊れる。さらに Owner 方針で共有 Preview の更新は禁止。
2. **「共有 Preview を上書きしない」かつ「新規外部サービス・repo・アカウントを作らない」で、#783 を iPhone に載せる経路は現状ない【推論】。** 実現可能な経路はすべて、次の Owner 承認のどれかが先に要る（§2）。
3. **推奨: 案 P1（Cloudflare Pages の direct upload、既存の設計済み Phase 1 の最小構成）。** 本番 origin から分離され、PR / デプロイ単位で保存が混ざらず、共有 Preview も #738 も動かさない。Owner が先に行う操作（アカウント・トークン）は Phase 1 計画 §8 のとおり。
4. **#783 には HV 用の保存シード（`?hv=b19-…`）がない【実測】。** `git diff origin/main...#783` に `src/preview/**` の変更はない。B18 には `b18HvSeeds.ts` があり、同型の B19 シードを足すのが最短だが、それは**コード変更なので別途 Owner 承認**。シードなしの代替手順（`?dev=state`）は §4.2。
5. 暫定の最小経路（外部サービス不要・ただし Owner の PC が要る）は案 L（§2）。iPhone 単独運用の原則（Visual-HV ワークフロー）とは合わない。

## 1. 制約の整理

| 制約 | 出所 | 影響 |
|---|---|---|
| 共有 Preview を上書きしない | Owner 指示（本タスク）、Session Operations §5 | `deploy-from-source.yml` の実行不可 |
| 現在の公開は #738 の `78de12a` | Preview repo README【実測】 | 上書き＝#738 の HV を壊す |
| Preview 全ビルドが保存キー `teto-pizza-preview-save-v1` を共有、origin は本番と同じ `perusonao.github.io` | `persistence.ts:95-97`【実測】、Session Operations §5 | 同じ origin 系の Preview を使うと #738 や過去ビルドの保存が混ざる／`localStorage.clear()` が本番に及ぶ |
| Preview repo は単一スロット（`site/` を丸ごと置換） | Fresh Audit §2【先行】 | 並存不可 |
| 新規アカウント・組織・外部ホスティング・ドメイン・repo は未承認 | Fresh Audit 冒頭【先行】。Cloudflare を採用する Owner 決定は repo の decisions / HANDOFF に**見当たらない**【実測: grep】 | P1 は承認待ち |
| 実機 HV の PASS/FAIL は Owner、Chromium は PASS にならない | HV Policy、Session Operations §3 | 手順書は撮影計画までで、判定は書かない |
| #783 は Draft / Gate HOLD、HEAD が変わると HV は無効 | Session Operations §3 | HV は exact HEAD に紐づける |

## 2. 選択肢（#783 向けに評価）

| 案 | 内容 | 共有 Preview | 本番 origin からの分離 | 保存の混在 | Owner 承認が要るもの | コード変更 |
|---|---|---|---|---|---|---|
| **P1** | Cloudflare Pages direct upload（Phase 1 計画のとおり。`pr-783` エイリアス＋デプロイ固有 URL） | 触らない | ✓ | ✓ 構造的に分離。ハッシュ URL は毎回空の保存 | ホスティング採用、アカウント・トークン作成、Preview repo への workflow 追加、初回デプロイ | 不要（`--base=/`＋manifest 書換え） |
| P2 | 別 Org / 別アカウントの GitHub Pages（Fresh Audit の案 C） | 触らない | ✓ | PR 間は単一スロット | Org 作成、Pages 設定 | 不要 |
| P3 | 既存 Preview repo の `site/` に**サブパス**（`/teto-pizza-game-preview/pr-783/`）を追加し、ルートは #738 のまま残す | ルートの URL は不変だが **repo の main に push するので「共有 Preview の更新」に当たる**【推論】 | ✗（同一 origin） | ✗ 同じ保存キー。Safari のプライベートタブで回避可（タブ内のみ・閉じると消える、挙動は実機で確認【未確認】） | Preview repo への push、workflow 改造（既存 2 本を変える） | 不要。ただし base パスが違うので別ビルド |
| P4 | Preview repo に **別ブランチ＋別 Pages** は不可（1 repo 1 サイト） | ― | ― | ― | ― | ― |
| L | Owner の PC で `npm run dev -- --host`（または `vite preview`）を起動し、同一 LAN の iPhone から開く | 触らない | ✓（別 origin: `http://<LAN-IP>:<port>`） | ✓ | PC 作業（Owner）。Pinsa HV の LAN 用キット（`docs/reports/screenshots/pinsa-hv/kit/owner-lan-server.mjs.txt`、#650 の LAN 安全監査は main 未取り込みのため未確認）を参照 | 不要 |
| T | クラウド環境から公開トンネル | ― | ― | ― | **不可**: この環境は外向き HTTPS のプロキシのみで、公開用の受信口がない【実測: 環境説明】。トンネル系ツールの可否は【未確認】 | ― |
| X | Actions の artifact（`dist`）を iPhone で開く | 触らない | ― | ― | ― | **不可**: iPhone Safari は zip の静的サイトを実行できない【推論】 |

評価: 「共有を触らない」「#783 の exact HEAD をビルドできる」「保存が混ざらない」を満たす恒久策は **P1 と P2**。P1 は `pr-<n>` エイリアスで今後の PR にも再利用でき、Phase 1 計画に受け入れ条件 14 項目（§5）と中止条件がすでにある。P3 は運用が軽いが、#738 の HV と同居し、共有 Preview の更新扱いになるため非推奨。L は承認が最小（外部作成なし）だが PC が要る。

## 3. 推奨の進め方（Owner が選ぶ）

1. **P1 を採用する場合**（推奨）: Phase 1 計画 §8 の Owner 操作 → スモーク（`main` を `phase1b-smoke` として 1 回）→ 受け入れ条件 (a)〜(f) を確認 → `ref=abb3da5a…`、`pr_number=783` でデプロイ。HV 対象は**固有 URL（ハッシュ）**を使う（毎回空の保存＝再現性）。#783 の HEAD が動いたら再デプロイし、HV はやり直し。
2. **承認を待たずに進めたい場合**: 案 L。Owner が PC で #783 の HEAD をチェックアウトして起動する。この場合も §4 の保存・シード方針は同じ。
3. どの案でも、**Owner が承認する前にセッションが workflow を実行したり、外部サービスに登録したりしない**。

## 4. 実機確認の手順（390×844、iPhone Safari。判定は Owner）

### 4.1 事前

| 項目 | 内容 |
|---|---|
| 対象 | PR #783、exact HEAD `abb3da5a1021b160b2ee75acbe5a00866a8a0eaf`（Draft / Gate HOLD）。HEAD が変わったら無効 |
| 確認 | Codex（`abb3da5`）指摘 0、CI 11/11 success は PR コメント 6705272331 の記載【先行・今回 CI の再取得はしていない】 |
| ビルドの特定 | 画面のバッジの short SHA が `abb3da5` であること（P1 なら `/preview-info.json` も） |
| ブラウザ | 通常の Safari タブ。ホーム画面追加は保存領域が別になりうるので別検証 |
| 禁止 | 共有 Preview（`perusonao.github.io` 系）で `localStorage.clear()`／サイトデータ消去。本番 URL では一切操作しない |
| 中止条件 | 起動しない／バッジの SHA が違う／本番の保存に触れた疑いがある／ビルドが #783 でない |

### 4.2 保存データの用意（#783 の Result §9 項目 2 の構成）

要件: step 69 までの素材を所持、`pesto-burrata-pizza` と `pizza-alla-crudaiola` が未発見で他は発見済み、Pitz に余裕（`e2e/b19.spec.ts` の `saveJson` と同じ構成）。

| 方法 | 手順 | 状態 |
|---|---|---|
| **B19 シード**（推奨） | B18 の `?hv=b18-*`（`src/preview/b18HvSeeds.ts`）と同型の `?hv=b19-…` を追加 | **未実装【実測】**。コード変更なので別途 Owner 承認が必要。シードは Preview 専用キーにのみ書き、本番 bundle から除外される設計が B18 にある |
| `?dev=state`（State Editor） | 分離したブラウザコンテキスト（P1 の固有 URL なら本番と別 origin）で開き、上の保存構成を入力 | 実機での可否は **T7 の Owner 決定（#417 コメント 6705391272）のとおり、先に「空の保存の適用・復元が可逆」であることを確認**。確認できなければ State Editor は使わない。共有 origin では使わない |
| 手でプレイ | step 69 まで進める | 現実的でない（Visual-HV ワークフローの原則に反する） |

### 4.3 確認項目と撮影（#783 Result §9 項目 3〜4 に準拠。**結果は Owner が記録**）

各レシピ（`pesto-burrata-pizza`、`pizza-alla-crudaiola`）で次を撮影する。

1. Shop に「ブッラータ」が NEW で出る／購入で在庫が増える。検索 alias `ブラータ`（承認済み）で見つかる。
2. 図鑑の Research 項目が「？？？ピザ A／B（ブッラータ）」で、材料名・レシピ名が出ない（Anti-Oracle）。
3. 2 層ソース: 1 本目（ジェノベーゼ／トマト）→ オリーブオイルが塗れ、2 層の見え方が分かる。
4. チーズ: ブッラータの絵がモッツァレラの白い円盤と形で区別できる（トレイ・盤面・焼成後・RESULT・ショップ・図鑑）。
5. 焼成 → NEW DISCOVERY → 図鑑。横スクロールなし、文字が切れない（「ピッツァ・アッラ・クルダイオーラ」）。
6. ヒント（SAUCE 段または CHEESE 段、各 10 Pitz）で 2 レシピを取り違えない。

撮影: 人の速さの動画を **Owner が直接保管**（repo に入れない、HV Policy §7）。スクリーンショットは `docs/reports/screenshots/batch19/`（既存）に追加する場合のみ。結果語（PASS / FAIL / waived）は Owner が日付と HEAD SHA つきで記録。Chromium の動画（Owner へ渡し済み）は**実機 PASS ではない**。

## 5. 残課題・Owner 判断（推奨つき）

| # | 判断 | 推奨 |
|---|---|---|
| 1 | 検証環境の方式（P1 / P2 / L） | **P1**。承認を待てないなら L を暫定で |
| 2 | 外部サービスのアカウント・トークンの作成者とタイミング（セッションは secret を扱わない） | Owner 操作（Phase 1 計画 §8） |
| 3 | `?hv=b19-…` シードを #783 に足してよいか（コード変更） | GO を推奨。B18 に前例があり、実機 HV の準備コストを大きく下げる。無承認なら §4.2 の `?dev=state` |
| 4 | #738（STEAM S3）の iPhone HV を先に終えて共有 Preview を空けるか | 空けるなら共有 Preview の更新は Owner 承認が毎回要る。#783 を急ぐなら P1 が独立 |
| 5 | 固有 URL（再現性）と PR エイリアス（更新をまたぐ保存）の使い分け | HV はハッシュ URL |

## 6. 未確認・限界

- Cloudflare 等の外部サービスの仕様・無料枠は既存資料のとおり**一次資料未確認**。本書は新たに確認していない。
- #783 の CI・Codex の現在値は PR コメントの転記で、今回 `get_check_runs` 等では再取得していない。
- `?dev=state` や Safari のプライベートタブの実機での挙動は未確認。
- 実機の見え方・判定はすべて未検証（実機 HV 0 PASS）。
