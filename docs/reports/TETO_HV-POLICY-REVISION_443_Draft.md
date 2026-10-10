# Human Verification Policy 改訂案（Issue #443）— 設計・文書案

Status: **DRAFT / docs-only / 未適用**。`docs/decisions/TETO_HUMAN-VERIFICATION-POLICY.md`（SSOT）は**まだ変更していない**。
#443 は #442（Lunch Rush 到達検証プリセット E）に blocked のため、本書は「SSOT へ入れる文面案」と「#442 完了後に確定・追記する箇所」を分けて置く。
基準: main `44879be`（Batch 6 PR-3 merge 済み）。読んだもの: Policy 全文、`PROJECT_HANDOFF.md`（Preferred workflow）、`CLAUDE.md`、
Issue #442 / #443、`src/devtools/*`（`backup.ts` / `presets.ts` / `marks.ts` / `devtoolsAccess.test.ts`）、`src/preview/previewIsolation.gate.test.ts`、
`e2e/dev-state-editor.spec.ts`、`docs/reports/TETO_BATCH-6_PR-3_Result.md`、`TETO_CONTRACT-2.1_PRODUCTION-POST-ACTIVATION-HV-CHECKLIST.md`。
コード・テスト・設定・PR #445・Issue #442 は変更していない。Production 操作なし。

---

## 1. 現行ルールの整理（変わらないもの）

| # | 現行ルール | 出典 | 本改訂での扱い |
|---|---|---|---|
| 1 | UI/UX/gameplay 変更は automated tests だけで完了にしない。screenshot + video を残す | Policy §1, §12 | **維持**。ただし「video が担う確認」の一部を自動証跡で代替可能にする（§3） |
| 2 | 適用対象/除外（docs-only・内部 refactor・unit のみ・backend のみ・CI のみは不要。backend でも UI 挙動が AC なら対象） | Policy §2 | 維持 |
| 3 | Authority 390×844、Secondary 360×800 | Policy §3 | 維持 |
| 4 | 動画は人間が確認できる速度（各状態 1〜3 秒保持）、「見るだけで変更を確認できる」こと | Policy §4 | 維持。自動 E2E 動画にも同じ基準を課す |
| 5 | MP4/H.264、390×844、30 秒〜2 分。WebM は理由明記で可 | Policy §5 | 維持 |
| 6 | **動画は repository に commit しない**（`artifacts/` は gitignore）。セッション内で直接提出。対話セッションが無い場合のみ Actions Artifact | Policy §6 / HANDOFF | **維持（§0 優先ルール）**。Issue #443 スコープ外でも明記 |
| 7 | Screenshot は `docs/reports/screenshots/<task-name>/` に commit | Policy §6, §9 | 維持 |
| 8 | Result Report に「Human Verification Videos」表と `Video Verification: PASS/FAIL` | Policy §10 | **拡張**（「実機HV要否」欄を追加、§6） |
| 9 | DoD: tests / screenshots / video / validation / download / report | Policy §12 | **拡張**（§7） |
| 10 | CLAUDE.md・HANDOFF は参照のみ。全文複製しない | Policy §11 | 維持（本改訂でも両ファイルは触らない） |

現行 Policy には「**誰が**確認するか」の区分が無い（Owner の実機 HV と、Claude Code が撮る Review Playthrough 動画が同じ語彙）。
実運用では既に分かれている: Owner iPhone HV（HANDOFF に PASS 記録多数、Contract 2.1 Production HV）と、
自動 E2E 録画（`e2e/batch6-pr3-hv.spec.ts`、保存を seed して 1 本の実ブラウザ動画を録る）。本改訂はこの実態を明文化する。

## 2. Owner iPhone 手動操作が必要な条件（提案文面 §15）

次の**いずれか**に該当する検証項目は、自動証跡では代替できず、Owner の実機操作を要する。

1. **操作感・手触り**: drag/swipe/tap の追従、gesture の取りこぼし、慣性 scroll、キーボード表示時のレイアウト（visualViewport）、IME。
   理由: Playwright の合成入力は実指・Safari のタッチ処理を再現しない。
2. **実機固有の見た目**: iOS Safari / standalone（PWA）での safe-area、フォント描画、アイコン可読性（例: 20px での判別性）、色味。
3. **新規 UI の初回承認**: 新しい画面・導線・文言・演出・アニメーションの「よい/悪い」の主観判断（Human Feel）。
4. **Production 切替直後の smoke**（flag 有効化・Production activation）: 実 Production URL・実セーブでの最小確認（既存 Contract 2.1 / LC-R6-e の運用）。
5. **自動証跡が採用要件（§3）を満たせない項目**、または自動証跡と実機で差が出うると Owner/レビューが判断した項目。
6. **Owner が Issue/タスクで明示的に実機確認を指定**した項目（常に優先。自動証跡の存在は免除理由にならない）。

実機 HV の方法は従来どおり: Preview（`PREVIEW · PR#… · <sha>` バッジ確認）、390×844 主、必要時 360×800。
Preview 上の特定進行状態は §4 のプリセットで投入し、**Owner の手動プレイ量を最小化**する（Owner が実機で確認するのは上記 1〜3 に限る）。

## 3. 自動証跡を Owner HV として採用する条件（提案文面 §16）

### 3.1 区分

| 区分 | 内容 | 例 |
|---|---|---|
| **A. 自動証跡で足りる** | 数値境界、解放の有無、状態遷移、重複なし（一度だけ）、永続化の有無、catalog/ladder 整合 | ⭐119→120 で goat-cheese が `unlockedForShopIngredientIds` に入る／best 未満なら変わらない／通知が 1 回だけ |
| **B. 実機確認が必要** | 操作感・見た目・gesture・scroll・演出（§2） | 解禁通知の見え方・位置・読みやすさ、Shop「⭐あと○個」の収まり、Lunch Rush 中の手触り |

1 つの変更に A と B が混在するのが普通。**項目単位で**区分し、Result Report に表で出す（§6）。

### 3.2 自動証跡を採用してよい要件（すべて満たすこと）

1. 対象項目が区分 A である。
2. **該当テスト名を特定**して列挙する（unit の `describe/it` 名、E2E の spec ファイルと test 名）。「テストが通った」だけは不可。
3. テストが**境界の両側**を固定している（下の ⭐ 例）。mutation または反例で効くことが示せるなら尚可。
4. 本番と同じ経路で実行している: 実ブラウザ（Chromium 390×844、必要なら WebKit）、実ビルド。モックで結果を直書きしていない。
   seed/注入は「開始セーブ」または既存のテスト専用フック（`TETO_TEST_HOOKS`、production build 非搭載）に限る。
5. **動画（390×844、MP4）** が項目の到達を人間が追える速度で映している（Policy §4, §8 を満たす）。動画は commit しない（§5）。
6. CI（および該当時は WebKit Gate）が当該 commit で green。skip / 弱体化したテストを根拠にしない。
7. Result Report の「実機HV要否」欄に「自動証跡で代替」と**明示**し、根拠（1〜6）を書く。

### 3.3 ⭐境界の例（Issue #443 の受け入れ条件）

**採用してよい例**（区分 A）
- 「⭐119 の Dex に best を 1⭐超える score を登録 → Dex ⭐合計 120 以上 → goat-cheese が Shop 解放に加わる」
  = unit（`MISSION_NEXT_ORDER` 経由）＋ E2E（Preview ビルドにプリセット投入 → Lunch Rush 実プレイ → 120 以上 → Shop 解放）＋動画 1 本。
  境界の下側（best 未満・119 のまま・解放なし）も同じ unit で固定する。
- 「step 50 / ⭐120 で読み込み時に静かに retroactive unlock（通知なし）」「同じ解禁通知が 2 回出ない」＝状態遷移・重複なし。
- 「step 51 は ⭐130 かつ step 51 の両方が要る」＝解放条件の AND（片方だけでは解放されない）。

**採用してはいけない例**（区分 B、または要件不足）
- 「解禁通知（🆕 新しい材料が入荷）の見た目が読みやすい」「Shop の「⭐あと1個」が 390 幅で崩れない」を、E2E が通った／DOM に文字列がある、で代替する。
  → 文字列の存在は見た目・読みやすさを証明しない。Owner 実機（または少なくとも screenshot + 動画の人間確認）が必要。
- 「Lunch Rush で 120 に届く**手触り**が自然」を unit で代替する。
- 固定 score 注入だけで「Lunch Rush が実際に 120 へ届く」と主張する（実プレイ経路を通っていない）。注入は「決定的に進める手段」であって、
  到達自体の証跡は実 serve → 実 Dex 更新を通ったものに限る。
- テスト名が特定できない・skip されている・CI が当該 commit で red の状態での「自動証跡あり」。
- 119 のプリセットで通ったが、120 ちょうど／119→119 の側のアサーションが無い（片側だけの境界証跡）。

## 4. Preview 専用 State Editor の安全な利用（提案文面 §17）

実装の事実（読み取り結果）:

- 入口は `?dev=state`。`src/main.tsx` が `import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE` の**静的ゲート**を通った時だけ、動的 import で
  `devtools/StateEditorShell` を読む。Production ビルドでは `?dev=state` は無効（DOM・a11y ツリー・リクエスト・localStorage にエディタも backup key も無い）。
- 保存キーの分離: Production `teto-pizza-save-v1` / Preview `teto-pizza-preview-save-v1`。エディタは**そのビルドの保存キー**にだけ書く。
  backup は `<保存キー>.dev-backup-v1.<slot>`（Preview ビルドなら Preview キー側）。Production キーに backup は存在しない。
- ゲート: `src/devtools/devtoolsAccess.test.ts`（ソース参照・動的 import・Firebase/ranking/profile 非参照・保存書込は apply/backup 経由のみ）、
  `src/preview/previewIsolation.gate.test.ts`（本物の production `vite build` の bundle に editor の mark / title / backup suffix / preset ラベルが無い）、
  `e2e/dev-state-editor.spec.ts`（本番/Preview 実ビルドを同一 origin・実 base path で配信し、`?dev=state` の無効化と「開くだけでは何も書かない」を確認）。
- backup は raw 文字列を byte 単位で保持。`original` は初回 apply で 1 回だけ書かれ、復元/破棄まで保持。`previous` は apply 毎に上書き。
  書込は read-back 一致で初めて成功扱い（失敗時は apply しない）。Full Game Reset は保存キーのみ削除し backup に触れない。
  復元・破棄は 2 段階確認。復元後は再検証し、不一致なら backup を残す。
- 注意（要 Owner 認識、§8 U-3）: Production と Preview は同一 origin（`perusonao.github.io`）の別 path。localStorage は origin 共有で、**分離はキー名のみ**。

### 4.1 利用手順（提案）

1. **前提確認**: URL が Preview（`/teto-pizza-game-preview/`、画面に `PREVIEW · …` バッジ）。Production URL では使わない（`?dev=state` は無効だが、念のため開かない）。
2. **開く**: `…/teto-pizza-game-preview/?dev=state`。開くだけで保存は変わらない。
3. **適用前の確認**: プリセットを選び「適用前の確認（DEV）」で差分を見る。**初回 apply で `original` backup が自動作成される**。
   「backup 作成 OK」表示を確認してから適用する（失敗表示なら適用しない）。
4. **適用 → ゲームへ戻る**: 検証したい進行状態で Review Playthrough / Owner HV を行う。
5. **復元**: 検証後、同じエディタの `DEV backup / restore` で `original` を**復元**（2 段階確認）。「元の文字列を完全に戻しました」を確認。
   これ以降 `original` を破棄しない限り Owner の Preview セーブは検証前と byte 同一。
6. **復元確認**: 復元後にゲームを開き、Pitz・Dex 件数・所持材料が検証前と同じであることを目視（または Result Report に記録）。
7. **禁止**: Production URL での操作／`original` backup 未確認での apply／復元前の `original` 破棄／Full Game Reset による「復元代わり」（backup は戻らない）。

### 4.2 Production 保存保護の保証（Result Report に書く根拠）

「保存キー分離」「bundle gate」「静的 env ゲート」の 3 点を、上記ゲート 3 本が green であることで示す。新規プリセット（#442 のプリセット E 等）追加時も
`previewIsolation.gate.test.ts` の対象一覧（`PRESETS` の label 走査）に自動で含まれるため、追加プリセットが production bundle に混入すれば落ちる。

### 4.3 自動 E2E でのプリセット利用との違い

- Owner 実機・手動: §4.1 の手順（backup → 適用 → 検証 → 復元）。
- 自動 E2E: 使い捨ての browser context に seed（既存 `e2e/support/starGateSave.ts` 流儀）。Owner の保存に触れないため backup/復元は不要。
  Production ビルドに対して実行する E2E は seed 対象を e2e dev server の開始セーブに限り、Production URL へは接続しない。
- `?hv=<scenario>`（`src/preview/hvSeeds.ts`）は backup を取らず Preview セーブを**上書き**する（fresh navigation のみ）。Owner の Preview セーブを残したい場合は
  State Editor を使う。→ §8 U-4。

## 5. 動画の提出方法・証跡の保管・PR Final Gate との関係（提案文面 §18）

| 証跡 | 保管/提出 | 備考 |
|---|---|---|
| 動画（実機 Owner 撮影 / 自動 E2E 録画 とも） | **commit しない**。インタラクティブセッション内でユーザーへ直接提出。対話セッション不在時のみ Actions Artifact（run URL を報告） | Policy §6 を変更しない |
| Screenshot（before/after） | `docs/reports/screenshots/<task-name>/` に commit | 変更なし |
| テスト名・spec・コマンド・commit SHA | Result Report（`docs/reports/`）に記載 | 動画が無くても再現できる形で |
| Owner 実機 HV の結果 | Result Report と PR/Issue コメントに PASS/FAIL と観察事項。Owner 提供の screenshot は Owner が commit を求めた時のみ | 既存運用（H5-5 等「screenshots are not committed」） |
| Download 手段 | 動画ごとに「セッション内直接提出」or「Actions run URL」を記載（Policy §7） | 変更なし |

**PR Final Gate との関係**（現行 HANDOFF の Preferred workflow に沿う）:
- Final Gate の入力 = (a) CI green（lint / Vitest / build / WebKit Gate）、(b) Preview 動画 + Video Verification PASS、(c) Result Report の「実機HV要否」欄、
  (d) 実機 HV 必要項目があれば Owner の PASS。
- 「実機 HV 要」と判定した項目が 1 つでも未完了なら、merge 可否は Owner が決める（自動証跡の PASS で肩代わりしない）。
- 「全項目が自動証跡で代替」と主張できるのは、§3.2 の要件を全項目が満たし、かつ Owner が Issue/タスクで実機確認を指定していない場合に限る。
  その場合も Final Gate は (a)(b)(c) を確認し、判断（merge）は引き続き Owner。
- 自動証跡を採用したことは Claude Code が一方的に宣言せず、Result Report で根拠を提示し Final Gate で Owner が受理する（§8 U-1）。

## 6. Result Report への追加（Policy §10 への追記案）

```markdown
## 実機HV要否

| 項目 | 区分 | 判定 | 根拠 / 証跡 |
|---|---|---|---|
| ⭐119→120 で goat-cheese 解放 | A 数値境界・解放 | 自動証跡で代替 | unit: `<test名>` / E2E: `<spec> › <test名>` / 動画: `<filename>` / CI run `<url>` |
| 解禁通知の見た目 | B 見た目 | **実機HV要** | Owner iPhone Preview（結果待ち / PASS / FAIL） |

State Editor 利用: なし / あり（preset: `<id>`、original backup 作成: OK、復元確認: OK / 未実施）
```

「判定」の語彙は 3 つに固定: **自動証跡で代替** / **実機HV要** / **対象外**。

## 7. Definition of Done への追記案（Policy §12）

既存 6 項目に加え:
- [ ] 実機HV要否の表が埋まっている（全項目に判定がある）
- [ ] 「自動証跡で代替」項目はテスト名・動画・CI を併記（§3.2）
- [ ] 「実機HV要」項目は Owner の結果が記録済み、または未実施として Final Gate に明示
- [ ] State Editor を使った場合は復元確認済み

## 8. #442 完了後に必要な追記箇所

| 箇所 | 追記内容 | 理由 |
|---|---|---|
| Policy §17（新）4.1 手順 | **プリセット E の正式名・id**（`PresetId` と `PRESETS` の `labelJa`）と適用手順（「⭐119 / step 50 到達済み / goat-cheese 未解放 / Lunch Rush 成立在庫」） | #442 で決まる。現時点では未命名 |
| Policy §16 ⭐例 | 実在するテスト名・spec ファイル名（unit: `MISSION_NEXT_ORDER` 系、E2E: プリセット E → Lunch Rush 実プレイ）への置換 | 現状は記述的な例。#442 の AC で名前が確定 |
| §16 3.2 項 4 | 決定的に進める手段の確定形（`TETO_TEST_HOOKS` / `cutInjection` 系のどれか、score 注入の範囲）と「実到達の証跡に注入を使ってよい範囲」 | #442 §3 で設計予定 |
| §17 4.2 | `previewIsolation.gate.test.ts` の gate が新プリセットを含むことの確認結果 | #442 の安全条件 |
| Changelog | 日付付き 1 行（#441 / #442 / #443 の依存順を併記） | Issue #443 スコープ 6 |
| 参照のみ | `CLAUDE.md` / `PROJECT_HANDOFF.md` は変更しない（HANDOFF の Preferred workflow 参照 1 行はそのまま） | Issue スコープ 5 |
| 要確認 | #441（共有ビルダー / `distributeStars`）の名前・配置。#441 は PR #445 で進行中のため未参照 | 文書化精度のため。本作業では触れない |

## 9. Policy 本体へ入れる際の構成案

- 既存 §0 に 1 段落: 「本改訂は§6（動画を commit しない）と§3（390×844 authority）を変更しない。自動証跡の採用は§2・§4・§8 を満たす場合に限る」。
- 新 §15 実機HVが必要な条件（本書 §2）／§16 自動証跡の採用条件と⭐例（§3）／§17 Preview State Editor（§4）／§18 提出・保管・Final Gate（§5）。
- §10 に「実機HV要否」追記（§6）、§12 に DoD 追記（§7）、§14 Changelog に 1 行。
- 既存§番号は動かさない（他文書からの参照を壊さない）。§15 以降は追加のみ。

## 10. 未確定事項一覧

| ID | 内容 | 推奨 | 決める人 |
|---|---|---|---|
| U-1 | 「自動証跡で代替」の最終受理者は Owner か（Claude Code が自己宣言できる範囲があるか） | Final Gate で Owner が受理。自己宣言は不可 | Owner |
| U-2 | 自動証跡を採用してよい**区分 A の外縁**: 「Shop に materials が出る」等の画面表示を含むか（文字列存在 ≠ 見た目、としたが線引き） | 表示の有無は A、見た目は B | Owner |
| U-3 | Production と Preview が同一 origin で localStorage 共有（分離はキー名のみ）。Owner の iPhone で Production の保存が Preview 操作で触れうる経路が本当に無いかの確認方法を Policy に書くか | 現行 3 gate で十分とし、注記のみ | Owner |
| U-4 | `?hv=<scenario>` は backup なしで Preview セーブを上書きする。State Editor に一本化／併存／`?hv` に注意書き、どれにするか | 併存＋「Owner の Preview 進行を残したい時は Editor」と明記 | Owner |
| U-5 | 実機 HV を**免除してよい**最小条件（全項目 A かつ Owner 実機指定なし）を Policy に明記してよいか。Owner の「実機操作を最小化」方針の解釈 | 明記する（§5 Final Gate 参照） | Owner |
| U-6 | 自動 E2E 動画の WebKit 版を要件にするか（現状 Chromium 390×844 が主、WebKit は CI Gate） | 動画は Chromium 可、挙動の根拠は WebKit Gate green を併記 | Owner |
| U-7 | 復元確認の最小基準（目視 3 項目 Pitz / Dex 件数 / 所持材料 で足りるか、byte 一致を表示する機能があるか） | まず目視 3 項目。byte 一致は editor 側の既存「元の文字列を完全に戻しました」表示で代替 | Owner |
| U-8 | Preview 上で Firebase / ランキング書込が Preview ビルドで有効かの未確認（editor 自体は非参照だが、プレイ中の Lunch Rush 結果送信の扱い） | 調査未実施。#442 の E2E 設計時に確認し、Policy §17 に注記 | #442 実装時 |
| U-9 | プリセット E の名称・id・星配分（#442 領域） | #442 で決定 | #442 |
| U-10 | #441 の成果物名（共有ビルダー）を Policy で参照するか。参照すると #441 のリネームで文書が陳腐化 | 参照せず「プリセット」の一般名で書く | Owner |
| U-11 | Owner 実機 HV の screenshot を commit するか（現状「Owner-reported、commit しない」が多数） | 現状維持 | Owner |
| U-12 | 区分 B の項目に対し、自動動画を「Owner 実機の前段」として必須にするか（Owner の手間削減との関係） | 必須（現行 §4）。実機は最終確認のみ | Owner |

## 11. 本作業の制約遵守

docs-only（本ファイル 1 本追加）／`src`・`e2e`・設定・CLAUDE.md・HANDOFF・Policy SSOT 変更なし／PR・merge なし／PR #445・Issue #442 未変更／Production 操作なし。
