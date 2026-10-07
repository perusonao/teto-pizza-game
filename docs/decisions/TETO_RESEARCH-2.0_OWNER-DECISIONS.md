# Research 2.0 — Owner Decisions（Design Gate 確定）

Status: **Owner 承認済みの設計 authority。** **Phase 0〜4 はすべて main に実装済み**（Status Sync: 2026-10-07、
実装の詳細は [`TETO_RESEARCH-2.0_PHASE2-4_Result.md`](../reports/TETO_RESEARCH-2.0_PHASE2-4_Result.md)）。
以降、本書は設計 authority（決定・不変条件）として残り、実装状態は §8 の表を正とする。
※下記の「基準 main」「本 PR」は承認時点の記述（履歴）。
Path: `docs/decisions/TETO_RESEARCH-2.0_OWNER-DECISIONS.md`
承認日: 2026-10-05（Owner Review）。実装 Issue: #400。
基準: main `d144f0890a881e766da23bb788743863dfccea87`（#398 TQ-1D 後）。
根拠: Post-#398 Research / Discovery UX Fresh Audit（P0 なし、P1 = R-1 / R-2 / R-3）と Research 2.0 Design Gate（R-2 → R-1 → R-3）。
関連 authority: [`TETO_ANTI-ORACLE-CONTRACT_2.1.md`](./TETO_ANTI-ORACLE-CONTRACT_2.1.md)（本書が上書きする点は §6 に列挙）、
[`TETO_HUMAN-VERIFICATION-POLICY.md`](./TETO_HUMAN-VERIFICATION-POLICY.md)。

## 1. 問題（R-2 / R-1 / R-3）

| ID | 問題 | 根本原因 |
|---|---|---|
| R-2 | Research Entry の番号（① ② ③）が不安定。①を発見すると②が①に繰り上がり、Notebook に保存済みの旧①が現在の①と別 target を指し得る | ラベルが「いまの entry 配列の index」由来（`researchEntryLabel(index, count)`）で、Notebook は保存時の文字列を固定で持つ（OD-RB-14） |
| R-1 | ○は保存されるが×は session 中心で散逸する。target ごとの「確定○ / 除外×」一覧がなく、推理がプレイヤーの記憶に依存する | ×は RESULT と session-only Notebook のみ（OD-RB-7） |
| R-3 | 焼き FAILED でも在庫は消費されるが、○× と Notebook 記録を得られない | FAILED は REGISTER_TO_DEX の research 記録経路を通らない |

依存: **R-2 → R-1**。R-1 / R-3 は研究記録経路（`researchAttemptResult` / `trialRecord`）を共有するため**並行実装しない**。

## 2. Owner Decisions

| ID | 決定 | 実装 Phase |
|---|---|---|
| **OD-R2-1** | **YES。D+ / Cohort Letter を採用する。** | Phase 1（実装済み: #402） |
| **OD-R2-2** | **NO。Research 表示識別子は save しない。** 現行 catalog から導出する。 | Phase 1 |
| **OD-R2-3** | **NO（再利用しない）。** 発見済み兄弟の letter 枠は保持し、残存 entry へ再利用しない。 | Phase 1 |
| **OD-R2-4** | **YES。** 現在の①②③形式を廃止し、`？？？ピザ A（たまねぎ）` / `？？？ピザ B（たまねぎ）` / `？？？ピザ C（たまねぎ）` 形式へ統一する。単独 cohort は letter なし（`？？？ピザ（チキン）`）。 | Phase 1 |
| **OD-R2-5** | **OD-RB-14 は存置する。**（Notebook は表示文字列を保存時のまま持ち、再計算しない。） | Phase 1 |
| **OD-R1-1** | **YES。** Research Board を今後導入する。 | Phase 2 / 3（実装済み: ×ledger + Board read model + Notebook UI） |
| **OD-R1-2** | **YES。** プレイヤーへ実際に開示済みの NEGATIVE / × fact **だけ**を、専用の加算 ledger として save する方針を承認する。Phase 1 では実装しない。 | Phase 2（実装済み） |
| **OD-R1-3** | Board は **Trial Notebook sheet 上部の「わかったこと」section** を第一配置とする。 | Phase 3（実装済み） |
| **OD-R1-4** | 試作回数・最終試作・Technique・残り候補等は Board へ**追加しない**。 | Phase 2 / 3 |
| **OD-R3-1** | **YES。** 材料が 1 個以上ある Research trial なら、焼き FAILED でも通常と**同一**の membership ○× を開示する。Phase 1 では実装しない。 | Phase 4（実装済み） |
| **OD-R3-2** | **YES。** FAILED でも在庫は従来どおり消費する。 | Phase 4（実装済み。在庫は従来どおり消費） |
| **OD-R3-3** | **YES。** FAILED trial も Notebook へ記録する。 | Phase 4（実装済み） |
| **OD-C-1** | **YES。** 必要な Research 契約改訂を承認する（§6）。 | Phase 0（本書） |

## 3. D+ Cohort Letter（Phase 1 の契約）

**cohort**: 同じ unlock ingredient（そのレシピの有限材料のうち**最後に取得**したもの）によって**同時に登録可能になった** recipe の兄弟集合。
- 登録可能 = 有限材料がすべて `ownedIngredientIds` にある。Dex は**見ない**。**発見済みの兄弟も cohort から除外しない**。
- 兄弟は登録済み entry か発見済み recipe のどちらかなので、プレイヤーには既に見えている。未登録 recipe は cohort に入らない（件数・存在が漏れない）。

**letter**: cohort 内を既存の `opaqueHash(recipeId)`（FNV-1a、recipe の構造と無関係）で、同点は recipe id で安定 sort し、`A, B, C …`。
26 を超えたら `AA, AB …`（スプレッドシート方式）。cohort が 1 件なら letter なし。

**label**（Dex / PREPARE / RESULT / Hint / Notebook で**同一の authority**、`researchEntryLabel`）:
- 兄弟あり: `？？？ピザ B（たまねぎ）`
- 単独: `？？？ピザ（チキン）`
- ①②③は廃止。label は **unlock ingredient 名と cohort letter 以外の hidden recipe 情報を出さない**。

**Production 実例**（ladder step 12 / 28、hash 順で確定）:

| step | cohort（unlock） | A | B | C |
|---|---|---|---|---|
| 12 | たまねぎ | Aussie | Brazilian Calabresa | Pizza Portuguesa |
| 28 | ズッキーニ | Ratatouille Pizza | Pesto Vegetariana | — |

（recipe 名は本書と実装テストの内部確認用であり、**player-facing の DOM / aria / 保存には出さない**。）

**不変条件**（現行 catalog の範囲）: reload / sibling discovery / target 切替 / new cohort 追加で letter は変わらない。
B を先に発見しても A は A、C は C のまま。Notebook に保存済みの旧 B 行は B のまま、どの現行 entry も旧 B の label を持たない。

## 4. Catalog-local stability（Owner 追加契約）

letter は**「永久不変の Research ID」ではない**。**同一 catalog authority 内で安定する、公開表示用の Research identifier** として扱う。

- 将来、**既存 cohort へ新しい recipe が追加される catalog revision** では、その cohort の letter が変わり得る（hash 順の再 sort）。これは許容する。
- **53 / 172 population を導入する前に、Research identifier compatibility を Fresh Gate で再監査する**（§7 の trigger）。
- **これを解決するために save mapping を追加してはならない**（OD-R2-2）。letter の保存・recipeId→ID の対応表・保存済み counter は禁止。
- 影響範囲は表示のみ: Notebook は reload で消える session-only、Phase 2 の×ledger は recipe id キーで label を持たない。

## 5. Phase 2〜4 が参照する不変条件（INV-B1〜B9）

Phase 2〜4 の実装・テストは以下を固定する。**INV-B7 は Phase 1 の必須 Gate**（Phase 1 = #402 で実装・テスト済み）。それ以外は承認済みの契約として将来 Phase が参照する。

| ID | 不変条件 | 主な Phase |
|---|---|---|
| **INV-B1** | Board ledger への書き込み = 画面に表示された NEGATIVE 行のみ（「開示 = 保存」。INV-D2 の × への拡張）。 | 2 |
| **INV-B2** | 試していない材料、K=3 超過の topping（非開示）、既知（✓）の材料は書かない。 | 2 |
| **INV-B3** | カテゴリ単位の結論（「ソース: すべて除外」「ソース未確認」「チーズなし」）、空カテゴリ注記、「なし」表現が DOM / aria / Notebook / save のどこにもない（INV-D7 / OD-TQ1D-4 の維持）。 | 2 / 3 |
| **INV-B4** | Board / ledger に Technique が一切出ない（未発見 Technique の漏洩ゼロ）。 | 2 / 3 |
| **INV-B5** | Hint の価格・可否・ALREADY_KNOWN は×の有無に依存しない。Hint は×を生成しない。 | 2 |
| **INV-B6** | 焼き FAILED でも○×パネルの byte は、同一 pizza・同一 known(T) の ORIGINAL と同一（INV-D6 の FAILED への拡張）。{完成, 焼き失敗} × {完全一致, 部分一致} で同一。 | 4 |
| **INV-B7** | label は **unlock ingredient と cohort letter 以外の hidden recipe 情報を出さない**。recipe 名 / id、No.xx、cohort size、hash 値、件数を DOM / aria / persistence へ出さない。 | **1（必須 Gate）** |
| **INV-B8** | Notebook は Board を参照しない。feedback は `{kind, textJa}`（schema 不変）。 | 2 / 3 |
| **INV-B9** | save の差分は×ledger の追加のみ。×が `discoveryHintFacts` に入らない。 | 2 |

**Phase 2〜4 の前提（承認済みの方針。いずれも実装済み。§8 参照）**:
- **×ledger（OD-R1-2）**: 新しい top-level key の**加算 ledger**（例 `researchExclusions: { [recipeId]: string[] }`）。`schemaVersion` は 2 のまま、`KNOWN_SAVE_KEYS` に追加、旧ビルドは未知 key を持ち回る。unknown recipe / ingredient id は forward-compat で持ち回る。merge は recipe ごとの集合 union（削除しない）。全リセットで消す。stale な×（現 recipe 定義と矛盾）は表示時に静かに外す。Notebook の試作履歴は session-only のまま。
- **Board の内容（OD-R1-1 / 1-3 / 1-4）**: 確定○（unlock + `ing:`）、除外×（表示済み NEGATIVE のみ）、購入済み `cls:` / 総数。試作回数・最終試作・Technique・残り候補は入れない。
- **FAILED（OD-R3-1〜3）**: 材料 1 個以上の Research trial は、焼き FAILED でも ORIGINAL と同一の○×を開示し、Notebook に記録する。在庫は従来どおり消費。**Technique・recipe 発見・Pitz は FAILED では付与しない**（完成した焼きが必要）。実装位置は `CONFIRM_BAKE` の非 MATCHED 分岐（BAKE→RESULT の遷移は phase guard で 1 回きり。REGISTER_TO_DEX の FAILED は RESULT に居座るので exactly-once にならない）。
- **Hint との関係**: Board は×を保存・再表示するだけで、Hint の価格・ladder・ALREADY_KNOWN を変えない（INV-B5）。Hint の価値（総数・分類・確定名）は残る。

## 6. 既存 authority との整合（矛盾監査）

本書が **上書きする点**（上書き以外は Contract 2.1 のまま）:

| 既存 authority | 内容 | 本書の扱い | 状態 |
|---|---|---|---|
| Contract 2.1 §3 / OD-RB-14 / §7 の label 例 `？？？ピザ ①（チキン）` | label は「Research Entry 番号 + unlock 名」 | **label は `？？？ピザ [letter]（unlock 名）`**。番号は廃止。OD-RB-14 自体（公開情報のみで識別、保存時の表示を固定、再計算しない）は**存置** | **Phase 1 で有効** |
| Contract 2.1 §7「Research Entry の増減で番号が変わっても…番号のずれは unlock 名が補う」 | 番号のずれを unlock 名で補う | letter が兄弟の増減で動かないため、ずれ自体が起きない（現 catalog 内）。保存文字列を固定する規則は不変 | **Phase 1 で有効** |
| Contract 2.1 OD-RB-7 / INV-6'「× は永続保存しない」 | × は session のみ | **OD-R1-2 により、開示済みの NEGATIVE を専用の加算 ledger として save する方針を承認**。`discoveryHintFacts` の `ing:` には×を入れない（INV-B9） | **Phase 2 で実装済み**（開示済み NEGATIVE を `researchExclusions` ledger へ加算保存。Contract 2.1 の「× は session のみ」は現行挙動ではない） |
| Contract 2.1 INV-D2「Disclosure = Persist(○) = Notebook」 | ○ の保存 = 表示 = Notebook | ×ledger を加えて **Disclosure = Persist(○, ×) = Notebook**（INV-B1）に拡張 | Phase 2（実装済み） |
| Contract 2.1 INV-D6 / D3「品質・outcome から独立」 | ORIGINAL / AMBIGUOUS / INCOMPLETE_MATCH で同一 | 焼き FAILED（材料 1 個以上）にも拡張（INV-B6）。Technique・発見・Pitz は対象外 | Phase 4（実装済み） |
| OD-P3-16 / OD-D3-23（Notebook は ORIGINAL / AMBIGUOUS / INCOMPLETE_MATCH を記録） | FAILED は記録しない | **OD-R3-3 により FAILED も記録**。重複通知 `#n` は composition でなく焼き結果のみで決まるため、composition の正誤を漏らさない | Phase 4（実装済み） |
| Contract 2.1 §14 Non-Goals「negative の永続化」 | 非目標 | OD-R1-2 で**この項目のみ**を Non-Goal から外す（Phase 2 以降）。他の Non-Goal（count / distance / Near・Far / Notebook schema 変更 等）は維持 | Phase 2（実装済み） |
| INV-D7 / OD-TQ1D-4 / Technique privacy | 直接の「なし」を出さない | **変更なし**。label・Board・FAILED のいずれも維持（INV-B3 / B4） | 全 Phase |
| `save`（schemaVersion 2、forward-compat union） | 追加 key のみ許容 | Phase 1 は save 変更なし。Phase 2 は加算 key のみ | 1 / 2 |
| Hint 5.0（ladder / 価格 / ALREADY_KNOWN） | | **変更なし**（INV-B5） | 全 Phase |
| progression / ladder / Pitz / Dex | | **変更なし** | 全 Phase |

矛盾の有無: 上表の上書き以外に矛盾は無い。OD-R2-5（OD-RB-14 存置）と OD-R2-2（保存しない）は、label を**導出で不変**にすることで両立している（保存文字列を固定する規則と、label が動かないことが矛盾しない）。

## 7. Fresh Gate の再監査 trigger（53 / 172）

次のいずれかの**前**に、Research identifier compatibility を Fresh Gate で再監査する（save mapping は追加しない）:
- 53 recipe population の導入、または 172 recipe population の導入。
- 既存 cohort（同じ unlock 材料を最後に取得する recipe 群）へ新しい recipe を追加する catalog revision。
- cohort が 26 件を超え得る population（`AA`, `AB` …の運用確認）。

再監査で見るもの: 既存 cohort の letter の変動範囲、同一 session 内での Notebook 行との整合、172 マトリクスの unlock 名の情報量
（材料 168 個のうち 98 個が 1 recipe 専用）、Dex の縦リスト・Notebook の target 絞り込み（Future）。

## 8. 実装 Phase

| Phase | 内容 | 状態 |
|---|---|---|
| 0 | 本書 + Contract 2.1 / PROJECT_HANDOFF への参照・注記（docs のみ） | **実装済み**（#402。PROJECT_HANDOFF の Phase 2〜4 addendum は #410 merge 後に同期） |
| 1 | Stable Research Identity（D+ Cohort Letter）。導出のみ、save / schema 変更なし | **実装済み**（#402） |
| 2 | Research Board domain / storage（×ledger） | **実装済み**（S1〜S3, `3ceb7d1`） |
| 3 | Research Board UI（Notebook sheet 上部「わかったこと」） | **実装済み**（S4, #405。対象は現在の Research Target 1 件のみ） |
| 4 | FAILED behavior（○× 開示 + Notebook 記録、在庫消費は維持） | **実装済み**（`fbbed9c`） |

Phase 2〜4 は直列（R-1 と R-3 は研究記録経路を共有）だった。各 Phase の前に、その時点の main で Gate を行った。

**未実装（Owner 判断待ち / 別 Gate）**: Board の複数 target 表示（OD-RBF-1 の B 案）、× 入り DEV preset（OD-RBF-3）、
Issue #358（Discovery 3.2）、53 / 172 population 前の Research identifier Fresh Gate（§7）。
詳細は [`TETO_RESEARCH-2.0_PHASE2-4_Result.md`](../reports/TETO_RESEARCH-2.0_PHASE2-4_Result.md) §5。
