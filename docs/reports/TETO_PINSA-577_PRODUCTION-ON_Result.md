# Pinsa Romana 本番 ON（#577）— 最小差分・互換性・ロールバック・公開後の follow-up

Status: **公開 PR。merge は Owner の最終承認待ち（自動 merge しない）。** 基準 `main` = `d3da198`。
Owner 決定（2026-10-25、iPhone Claude Artifact 実機 HV を受けて）: 丸い生地のままで公開可／ルッコラの現行表示で公開可／見た目の改善は公開後の follow-up で、今回の公開 Gate に追加しない。
実機 HV（Owner）: Artifact 起動・PREVIEW 表示 PASS／生地切替・ドラッグ PASS／Pinsa 発見・図鑑 No.30 登録 PASS／「ピンサ生地」「後乗せ」発見 PASS／Research A/B の 2 件表示 PASS／ORIGINAL 負の確認 2 件 暫定 PASS。

## 1. 最小差分（製品コードは 1 リテラル）
| 区分 | 内容 |
|---|---|
| **Production に必要な変更（これだけ）** | `src/data/pinsaGate.ts`: `PINSA_PRODUCTION = false` → `true`（コメントを現状に更新） |
| テスト基盤 | `vitest.config.ts`: P1 のリハーサル用 plugin（ゲートを開く）を、**ロールバック用 plugin（ゲートを閉じる、`TETO_PINSA_OFF=1`）**に置換。`npm run test:pinsa-off`。出荷（true）の状態は通常の `npm test`。`HAND_ENFORCEMENT` の rollback と同じ fail-closed 方式 |
| テスト | `pinsaGate.test.ts`（出荷テキストが `true`／ロールバック時だけ OFF の漏えい検査を実行）、`pinsa.production.test.ts`（新規。下記 §3〜§4） |
| **Production に持ち込まないもの** | Artifact 固有の差異はいずれも repo にも bundle にも入っていない: `window.confirm` の差し替え、単一 HTML 化、Artifact 起動パネル（seed 投入）、PREVIEW ビルド。これらは Artifact 用の使い捨てビルドだけにあり、この PR の差分に無い |
| 変更していないもの | Firebase、FINISH E5（`LATE_CATALOG_PRODUCTION` / `FREE_COOK_FINISH_PRODUCTION` は true のまま）、Grandma Pizza、新ソース Phase B、DH4 gate（緩和なし。許可リストは P1 でゲート連動の共有 1 か所にしたものが、そのまま有効になる） |

## 2. プレイヤーに起きる変化（本番 ON で見える差）
- 新レシピ「ピンサ・ロマーナ」（No.30、第 4 章）。発見条件: 材料一式 ∧ 生地チップで「ほかの生地」 ∧ ルッコラを焼成後（FINISH）に置く。Lunch Rush・Dinner・CUT の対象外、ladder に step を足さない（非 credit）。
- 生地チップ（「ふつうの生地」「ほかの生地」）が、ladder の credited 33 以上のプレイヤーに Free Cooking / Research の DOUGH 工程で出る。生地を選んだだけでは正式名称を出さない。
- Research: ルッコラのコホートが 2 件になる。ジャモン未発見ならジャモンの表示が「？？？ピザ B（ルッコラ）」（Pinsa が A）に変わり、HOME の「レシピ発見」直行が選択画面になる。
- 技法: 「後乗せ」の riddle が ikura の step（通常 ladder の長さ + 1）から arugula の step（33）に早まる。「ピンサ生地」の riddle が同じ step で出る。
- 章 4 の総数が +1（K2 により、既にクリア済みの章の ✓ は維持）。
- 星ゲート: 一様 ★2 の Dex が 1 レシピ増え、spinach の 130★ ゲートに届く（カタログ増加による改善。ゲート値は不変）。

## 3. 既存セーブの互換性（テストで固定）
- 旧セーブ（Pinsa 未発見）: Dex・Pitz・所持材料・在庫・技法台帳が変わらず、隔離（quarantine）のコピーも作られない。pre-Pinsa で完了していた全ての章は完了のまま（Pinsa は総数にだけ加わる）。
- Pinsa を発見したセーブ: Dex と技法台帳が保存され、読み戻せる。
- **ロールバック安全**: ゲートを閉じたビルドは Pinsa を知らず表示もしないが、そのビルドの書き込みは Dex の `pinsa-romana`（未知 id の前方互換）を消さない。再び開けば発見は戻る（`pinsa.production.test.ts`）。

## 4. ORIGINAL の負の確認（自動テスト）
実 reducer の Research ラウンド（チップは credited 33 以上でのみ開く）で次を固定: ① 標準生地＋ルッコラ焼成後 → ORIGINAL（Pinsa 未発見・生地技法は記録されない）、② ほかの生地＋ルッコラ焼成前 → ORIGINAL、③ 正例（ほかの生地＋ルッコラ焼成後）→ Pinsa 発見・「ピンサ生地」「後乗せ」を記録・ジャモンを含む既存の Dex は不変。

## 5. テスト
- 出荷の状態（ゲート true）: `npm test` 522 files / 9,632 tests passed。
- ロールバック（ゲート false）: `npm run test:pinsa-off` 522 files / 9,624 tests passed（OFF 専用の漏えい検査を含む）。
- `tsc -b`・oxlint クリーン。required CI・WebKit Gate は PR の最終 HEAD で確認（PR 本文）。

## 6. ロールバック手順
`src/data/pinsaGate.ts` の 1 リテラルを `false` に戻す PR を 1 本出す（`npm run test:pinsa-off` が、その状態の全体を既に証明している）。発見済みの Pinsa の保存は消えない（§3）。

## 7. 公開後の follow-up（今回の公開 Gate に含めない）
1. **生地の形**: 原典は楕円。丸い描画はゲーム上の簡略化（Owner 承認）。楕円の描画・CUT・採点は別 Epic 規模。
2. **ルッコラの見た目・Reference 配置（R4）**: 現行表示で公開可（Owner）。Reference の位置は jamon と同じ暫定配置。実機で見づらい場合の調整は公開後。
3. **Artifact で見えた差**: ゲーム内「ホーム」の確認ダイアログ（`confirm()`）は Artifact の枠では出ない。本番のブラウザでは従来どおり出る（差し替えは持ち込んでいない）。
4. **原典の残り確認**（PK-0）: 説明文の妥当性（項目 4）と Piadina との区別（項目 5）。生地の記述（項目 2）は Di Marco の記述と整合（独立の確認は未了）。
5. **Q8 の正式化**: 個数・bake は暫定値（D4）。後乗せ 2 ピースの実測後に正式化。
6. **D7 / 章 4 の表示**: 「No.30（第 4 章 29/30）」の見え方の最終判断（K2 は実装済み）。
7. **Hint / Research の導線**: ジャモンと材料が同一のため、生地チップと後乗せに気づかない探索が起こりうる。追加の誘導は Anti-Oracle に反するので、調理法欄の riddle のみ。実プレイの様子を見て判断。
8. **CI にロールバック run を足すか**: 現状は `npm run test:pinsa-off` を手元で実行（workflow は変更していない）。
