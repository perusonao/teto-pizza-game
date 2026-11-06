# Steam S4 — iPhone Safari 実機 HV Result と Final Gate（#738、docs-only）

記録日: 2026-11-06（UTC 約 16:20）/ 対象 PR #738 / HEAD `78de12a91a92e9a4c58295324246d8e8d0c44988` / main `ed159e9e501622aa0971fcf4ec6840c91d25d5d0`
手順書: `TETO_COOKING-STEAM_S4_iPhone-HV_Minimal-Procedure.md`（同ブランチ）。設計・既存証拠: `TETO_COOKING-STEAM_PHASE1_S3_Result.md`・`TETO_COOKING-STEAM_S3_H11_Result.md`（#738 ブランチ）。
本書は **#738 のブランチには入れない**（push すると HEAD が変わり、CI・Codex・HV の対象 HEAD がずれるため）。監査ブランチ `claude/teto-cooking-methods-audit-ku35ki` の docs。
**PASS／NEEDS FIX／FAIL を決めるのは Owner だけ**（SESSION-OPERATIONS §3.3）。§1 は Owner が口頭で報告した結果を**そのまま転記**したもので、本セッションの判定ではない。§3 の「免除可」も**免除の根拠があるという整理で、免除は Owner の明示承認が必要**。

---

## 1. 実機 HV の結果（Owner の報告、転記）

| 項目 | 内容 |
|---|---|
| 日付 | 2026-11-06（配備 16:02Z 以降） |
| 対象ビルド | 共有 Preview。**画面の PREVIEW バッジ `PR#738`・`78de12a` が、配備した HEAD と一致**（Owner 確認） |
| URL | `?cookSteamHv=1&cookSteamVariant=lid`（A のみ。`hv=` なし） |
| 端末・iOS・Safari のバージョン、ビューポート、添付ファイル名 | **未記録**（Owner の報告に含まれていない）。必要なら Owner が追記 |

| ID | 結果（Owner 報告） | 手順書の期待 |
|---|---|---|
| H1 | **PASS** | ツールバーの展開／折りたたみでボタン・ピルが収まり押せる |
| H2 | **PASS** | ピルが生地に重ならず片手で届く |
| H3 | **PASS** | ピルをタップして蒸し画面を開いた直後に勝手に蒸し始めない（ghost click なし） |
| H9 | **PASS** | 背面に回る（アプリ切替・ロック）と蒸し画面ごと閉じて蒸しを破棄する |
| H11 | **PASS** | 蒸した貝と生の貝が、24px の通常の見え方で識別できる |

既に実機 PASS 済み: **H13・H14**（B のみ、2026-11-05、PR #738 HEAD `85b4a07` に対して。#738 comment `6635737959`）。

---

## 2. Final Gate の再確認（read-only、2026-11-06T16:12Z）【実測】

| 項目 | 結果 |
|---|---|
| PR の HEAD | `78de12a91a92e9a4c58295324246d8e8d0c44988`（**配備した HEAD、CI・Codex・HV が見た HEAD と一致**）。取り込み push 以降、新しい push なし |
| base | main `ed159e9e`（変化なし）。**main に対して 0 commit 遅れ**。`mergeable_state: clean` |
| CI | **11/11 success**（classify・build・layout-chromium・Layout Contract Gate・WebKit 390×844 ×3・360×800 ×3・WebKit Gate）。再実行なし |
| Codex | 新 HEAD の受領記録 `Didn't find any major issues`（comment `6688513577`、15:29Z、`78de12a91a`）、summary は `status: completed`／`has_unresolved_findings: false`。旧 HEAD の記録は流用していない |
| review thread | 0 件 |
| コメント | 取り込み前後で新しい指摘・Owner の変更要求なし |
| 本番フラグ | `STEAM_EXPERIENCE_PRODUCTION = false`、`FRY_EXPERIENCE_PRODUCTION = false`（HEAD の `src/data/*ExperienceGate.ts`） |
| 本番バンドル | CI の `build`（Vitest の gate テストを含む）success。ローカルでも `dist/` に `cookSteam*`・`steamGameLab` の文字列なし |
| claim | #726 の S3 claim は 11/13 00:00 UTC まで更新済み（comment `6688326470`） |
| 共有 Preview | 現在 **#738 `78de12a`**（11/6 16:02Z 配備）。**復元は未実施**（元は #756 `8dfca29c0fcfaeae6efbd9e4199f6b112bc51886`） |

---

## 3. H4・H8・H10・H12 の個別判定（免除の根拠）

必須 5 項目（H1・H2・H3・H9・H11）以外は、Owner が「必須から外す」と決めた範囲。**証拠が足りない項目はない**と判断したが、**免除は Owner の明示承認が必要**。

| ID | 内容 | 根拠【実測】 | 残る不確実性 | 判定 |
|---|---|---|---|---|
| **H4** | 素早い連打・キャンセルで二重確定や固まったオーバーレイが起きない | ①`e2e/cooking-steam.spec.ts:302`（タッチで開く → 待機のまま → 120ms 後の明示タップで蒸し開始。lid／shake、通常／短い画面の 4 通り）、`:338`（2 回続けたタップ）、`:226`（× で何も残らない）。②`steamGhostClick.test.ts`（60〜120ms の再タップが有効）、`SteamLayer.test.tsx`。③**同じ HEAD で CI の WebKit（390×844・360×800）全 shard が success**（e2e-webkit.yml は全 spec を実行し、全件実行の証跡がないと Gate が通らない設計）。④**実機の H3 PASS**（ghost click という、実機のタッチでだけ現れた種類の不具合が出ないことを、同じ HEAD で確認） | 実機での「素早い連打」自体は未実施 | **免除可**（Owner の承認が必要） |
| **H8** | A↔B の切替で前の操作を引き継がない | ①HV の URL は `cookSteamVariant=lid` で、**切替 UI は `choice === "both"` のときしか出ない**（`SteamLayer.tsx:340`）ため、**今回の HV の構成では切替自体が存在しない**。②`both` でも、蒸している間は切替が無効（`:226`、単体テスト「the switch is locked while steaming」）。③B を Preview 限定の実験にする方針（Owner、2026-11-05） | なし（構造上起きない） | **対象外（免除可）** |
| **H10** | 焼成 → RESULT まで完走し、貝の見た目・他の技法が崩れない | ①`:245`（蒸し → 焼成 → RESULT、蒸し filter と焼成 filter の共存、採点・流れは通常どおり）。②炙り・炒め・`dynamic-cooking-steps`・`viewport-1screen`・`cooking-screen-sideways` の回帰（merge 済みツリーで Chromium 55 pass・3 skip、prep／B18 HV 30 pass）。③CI の WebKit 全 shard success。④H11 Result に焼成・仕上げ・RESULT の画像（Chromium）。⑤`steamedLook` は transient で採点・保存に読まれない（`steamIngredient.unaffected.test.ts`） | **実機での焼成 → RESULT は Owner の報告に含まれていない**（H11 の確認でピザ上の貝は見ているが、焼成後は未報告） | **免除可**（Owner の承認が必要）。ただし、Owner が HV の通しで焼成まで進めて崩れがなかったなら、その旨を追記すれば PASS として記録できる |
| **H12** | 保存が汚れない・本番 OFF | ①`:76`（実際のセーブに触れない）、`:278`（リロードで最初から）。②`steam.gate.test.ts`（本番バンドルに `cookSteam*`・HV の印が無く、Preview バンドルには全部ある）。③`steamIngredient.flagOff.test.ts`・`unaffected.test.ts`（フラグ OFF で状態不変、保存・採点・在庫・journal がバイト同一）。④CI の `build` ジョブ（gate テストを含む）success。⑤HEAD で `STEAM_EXPERIENCE_PRODUCTION = false`。⑥ローカルで `dist/` に蒸しの文字列なし | 実機でしか見えない要素はほぼない（Preview の保存キーは全 PR 共有のため、HV 前後の Preview の保存は使い捨て扱い） | **免除可**（最も根拠が強い） |
| **H5〜H7** | B（鍋をゆする）の操作・疲労・誤爆 | B は Preview 限定の実験（A を既定、Owner 選択）。**H13・H14 は実機 PASS 済み**で、**B のコード（`SteamLayer.tsx`・`steamShake.ts`・`steamLid.ts`・`steamGhostClick.ts`）は `85b4a07` から 78de12a まで変更なし**（差分が空）。`85b4a07 → 2ac9820` の変更は `Steam.css`・テスト 1 件・docs のみ | B を最終 HV の範囲に戻す場合のみ実機が必要 | **対象外（免除可）** |

---

## 4. 追加の実機 HV が不要な根拠

1. **HV の HEAD が merge する HEAD と一致している。** HV したビルド（バッジ `PR#738`・`78de12a`）＝ PR の HEAD ＝ CI 11/11 と Codex が見た HEAD。取り込み後に push されていない。
2. **必須 5 項目（H1・H2・H3・H9・H11）はすべて実機 PASS**（Owner 報告）。実機でしか判定できないと整理した項目（Safari のツールバー、ピルの片手到達、実機タッチの ghost click、OS の割り込み、24px の知覚）がすべて含まれている。
3. **B 側の実機項目（H13・H14）は、コードが変わっていない**ため、`85b4a07` での PASS が現 HEAD にも当てはまる。H11 修正（`2ac9820`）は CSS のみで、B の操作コードに触れていない。
4. **残る項目（H4・H8・H10・H12）は、実機でなくても判定できるか、構造上起きない。**同じ HEAD の WebKit CI、Chromium E2E、gate テスト、実機の H3 PASS が根拠で、かつ HV の URL の構成（`variant=lid`）では H8 の対象が存在しない。
5. 唯一、**H10 の実機（焼成 → RESULT）は未報告**。ただし、焼成 filter と蒸し filter の共存は単体テスト・E2E（Chromium と WebKit CI）で検証済み、実機の H11 で蒸した貝がピザ上に見えている、`IngredientGlyph.tsx` や焼成のコードを #738 が変えていない（S3 Result §1）ため、**追加 HV を必須にするほどのリスクではない**と判断する。Owner が気になる場合は、同じビルドで焼成まで進める 1〜2 分の確認で足りる。

---

## 5. 最終判定

**GO — #738 は merge 判断に進める状態**（Gate の技術・HV 条件はすべて満たす）。ただし **merge は Owner の別承認**で、本書は merge を承認しない。

| Gate | 状態 |
|---|---|
| HEAD の一貫性（配備＝HV＝CI＝Codex） | ✅ |
| CI 11/11、Codex 指摘 0、thread 0、mergeable clean | ✅ |
| 必須の実機 HV（H1・H2・H3・H9・H11） | ✅ Owner 報告 PASS |
| 本番フラグ OFF・本番バンドルに混入なし | ✅ |
| H4・H8・H10・H12・H5〜H7 | 免除可（**Owner の明示承認が必要**） |
| claim | ✅ 〜11/13 |
| **#738 の merge** | **Owner の別承認待ち** |
| 共有 Preview の復元（#756 `8dfca29`） | **Owner の別承認待ち**（復元前に他の用途がないか確認する） |
| Production ON | **HOLD**（別 Gate。S4 の採否判断を含む） |

### 5.1 残作業
1. Owner が H4・H8・H10・H12・H5〜H7 の免除を明示する（または H10 を実機で追記する）。
2. Owner が #738 の merge を承認する（merge 時は PR の最新 HEAD が `78de12a91a92e9a4c58295324246d8e8d0c44988` であることを確認し、違えば停止）。merge 後の main は、Deploy・WebKit E2E を確認。
3. 共有 Preview の復元または次の配備（V2/V3 の HV など）を、Owner が決める。復元する場合は、同じ build workflow を `ref=8dfca29c0fcfaeae6efbd9e4199f6b112bc51886`、`pr_number=756` で実行し、続けて `pages.yml` を実行（build の push では Pages が自動起動しないため）。
4. #726: S4（実機 HV と採否）の記録を更新。Production ON は別の承認 Gate。
5. FRY F3・V3 の本線化・Batch 19 は HOLD のまま。

---

## 6. 禁止事項の遵守
#738 への新たな push なし（HEAD は `78de12a` のまま）／merge なし／共有 Preview の復元なし／Production ON なし／FRY F3 の実装なし。変更は本書（docs）のみ。
