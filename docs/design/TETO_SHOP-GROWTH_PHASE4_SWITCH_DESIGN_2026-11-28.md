# B案 Phase 4a — shop 本番切替の設計メモ

- 状態は設計ドラフト。実装担当は Phase 4b の Claude Code。
- 調査基準は `main` の `f54d39f`（[#920](https://github.com/perusonao/teto-pizza-game/pull/920) マージ直後）。Phase 3f の [#921](https://github.com/perusonao/teto-pizza-game/pull/921) はこの基準に含めない。
- 関連資料は [Phase 0–1 設計 §3.2・§4・§6](TETO_SHOP-GROWTH-RESTRUCTURE_PHASE0-1_DESIGN_2026-11-25.md)、[Phase 3e Result Report「論点」](../reports/TETO_B-PHASE-3E_DINNER-MENU_Result.md#論点)、[Epic #901](https://github.com/perusonao/teto-pizza-game/issues/901)。

## 0. Owner 決定

1. 本番の無指定起動は shop に切り替える。パラメータ指定による legacy 起動は Phase 5 まで維持する。
2. 2026-11-26 決定に従い旧セーブから評判を移行せず、shop の評判は全員 0 から始める。図鑑の発見、購入済みヒント、材料在庫、Pitz 残高、Dinner クリア記録を含む共通記録は現行の読み方のまま引き継ぎ、リセット処理は加えない。保存キーは `teto-pizza-save-v1`、リポジトリと本番 URL は現行のまま。
3. 切替後の初回案内は出さない。案内文、既読キー、表示条件は実装しない。
4. 2026-11-28 の #920 の決着に従い、legacy の未払い特別注文クリア記録は `firstClearRewarded` による請求権を維持する。特別注文で段階を跨いだときの判明ボーナスは特別注文報酬と別に精算し、次の HOME 到達時に専用のメニュー入り案内と一緒に表示する。再起動時には未払い分を回収する。
5. 共有定数を `shop` に反転し、Capacitor を含むネイティブ版も同時に shop にする。環境別の分岐は加えない。Preview はパラメータ・記憶がない初回だけ本番既定に連動する。
6. R8 ジャーナルに起点モードを記録し、切替時・切替後を通じて常に元のモードのルールで精算する。
7. 切替は準備が整い次第実施する。復旧の判断者は Owner、判断条件は §6 の一覧とする。Muse が切替後 1・6・24・48 時間にスモーク確認し、異常時だけ報告する。iOS 実機確認は Owner が担当する。
8. パルミジャーノ形状再設計 [#874](https://github.com/perusonao/teto-pizza-game/pull/874)・[#875](https://github.com/perusonao/teto-pizza-game/pull/875) は対象外。

## 1. 現行の切替機構

行番号はすべて `f54d39f` に固定した。

| 箇所 | 現行の挙動 | 根拠 |
|---|---|---|
| モデル ID と既定値 | ID は `legacy \| shop`。本番既定を定義する箇所は `PROGRESSION_MODEL_PRODUCTION_DEFAULT = "legacy"`。ページのロード時に一度だけ決まり、セーブからは選ばない。 | [progressionModelId.ts:1–2](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/src/logic/progression/progressionModelId.ts#L1-L2)、[progressionModelFlag.ts:20–55](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/src/logic/progression/progressionModelFlag.ts#L20-L55) |
| 本番の `?progression=` | `DEV` と `VITE_PREVIEW_MODE` がともに無効なので、`shop`・`legacy` ともに無視する。Preview の保存済み選択も DEV キーも読まない。 | [progressionModelFlag.ts:27–49](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/src/logic/progression/progressionModelFlag.ts#L27-L49) |
| Preview・DEV の選択順 | URL の有効な `shop` / `legacy` → `teto-pizza-preview-progression-model` の有効値 → DEV のみ `teto.dev.progressionModel` → 本番既定。有効な URL 指定は Preview 用キーに記録される。未知値・空値は指定なし扱い。キーの読み書きが例外なら解決済みの URL 値を返す。ただし `localStorage` の取得自体が例外になる場合は外側の `catch` で既定側へ進む。 | [progressionPreviewOptIn.ts:16–41](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/src/logic/progression/progressionPreviewOptIn.ts#L16-L41)、[progressionModelFlag.ts:27–49](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/src/logic/progression/progressionModelFlag.ts#L27-L49) |
| 同一オリジンの分離 | 本番と共有 Preview は同一オリジン。進行の選択キーはセーブとは別で、本番バンドルに含まれない。セーブのキーは本番 `teto-pizza-save-v1`、Preview `teto-pizza-preview-save-v1`。Preview と DEV の選択処理はビルド時の分岐で隔離される。 | [persistence.ts:95–107](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/src/state/persistence.ts#L95-L107)、[previewIsolation.gate.test.ts:137–143](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/src/preview/previewIsolation.gate.test.ts#L137-L143) |
| `canEnableShopProgression()` | 有限・非負で所定の長さの評判表、非降順の段階しきい値、空でない採用カタログが条件。現行データでは真。実際のモデル選択はこの関数を呼ばず、評判表だけを確認する。未完なら `id: "shop"` を残したまま legacy の計算を使う。カタログが空なら shop 側に暫定カタログへの経路がある。UI と文言もそれぞれ表の完備を確認する。 | [reputationTable.ts:38–74](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/src/logic/progression/reputationTable.ts#L38-L74)、[reputationTable.gate.test.ts:53–66](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/src/logic/progression/reputationTable.gate.test.ts#L53-L66)、[progressionModel.ts:134–155](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/src/logic/progression/progressionModel.ts#L134-L155)、[shopProgression.ts:79–95](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/src/logic/progression/shopProgression.ts#L79-L95)、[shopStatus.ts:12](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/src/logic/progression/shopStatus.ts#L12)、[shopCopy.ts:10–17](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/src/logic/progression/shopCopy.ts#L10-L17) |

## 2. 反転方式

| 候補 | 評価 |
|---|---|
| 既定値の定数を `shop` にする | 無指定の切替だけは成立する。本番では URL が無視されるため、Phase 5 までの legacy 起動要件が残る。 |
| **採用。定数を反転し、本番 Web で `?progression=legacy` を許可する** | 同じ URL のクエリだけで legacy に入れる。指定はそのページロード限り。保存領域やデプロイを増やさず、既定値の復旧は定数一箇所で行える。 |
| デプロイ設定や別ビルドを切替元にする | デプロイごとに制御できる一方、定数と設定の整合確認や別ビルドの運用が増える。同じ本番 URL で legacy に入るには、いずれにしてもページ側の振り分けが要る。 |

### 決定した解決順

| 環境・入力 | 4b の期待値 |
|---|---|
| 本番 Web、無指定・空値・未知値・`?progression=shop` | 準備条件を満たせば既定 shop。`shop` は強制指定として扱わないので、ロールバック時は同じ入力も legacy。 |
| 本番 Web、`?progression=legacy` | legacy。クエリを外して新たに開けば既定に戻る。Preview/DEV のキーに読み書きしない。 |
| 本番 Web、既定 shop だが準備条件を満たさない | 有効 ID を legacy に解決し、文言・注文・特別注文も同じ ID に従わせる。リリース前の CI はこの状態を異常として検出する。 |
| Preview・DEV | URL → 専用キー → DEV キー（DEV のみ）→ 共有する本番既定の優先順を維持する。パラメータ・記憶がない初回だけ shop に変わる。ネイティブ版も共有定数の反転で shop にし、環境別の分岐は加えない。 |

パーサーは `URLSearchParams.get("progression")` の先頭値で統一する。ブラウザーの `location` が無いテスト環境では無指定として扱う。モードはページ内で切り替えず、切替・復旧ともページを開き直して適用する。

### 4b の変更候補ファイル

| ファイル | 変更内容 |
|---|---|
| `src/logic/progression/progressionModelFlag.ts` | 本番 Web 専用の非永続 legacy クエリ判定を追加し、既定選択に `canEnableShopProgression()` を適用する。最後の有効化コミットで既定値を `shop` にする。 |
| `src/logic/progression/progressionModel.ts`、`shopCopy.ts`、`shopStatus.ts`（後二者は同ディレクトリ） | 有効 ID とモデル・文言・画面条件の一致を確認し、独立した既定値を持たせない。本番と Preview の準備条件が異なる設計を選ぶ場合も、判定は選択側に集める。 |
| `src/logic/progression/progressionPreviewOptIn.ts` | Preview の URL と記憶の現行仕様を保持する。本番側と構文解析を共用するなら、副作用のない解析だけを切り出す。 |
| `src/state/pendingRound.ts`、`src/state/pendingRoundSettle.ts`、`src/state/roundCommit.ts`、`src/state/persistence.ts`、`src/state/startup.ts` | R8 ジャーナルに起点モードを記録し、保存・起動時の復帰とも元のモードのルールで精算する。既存形式との互換と Save Protection を維持する。 |
| `src/state/gameReducer.ts`、`src/state/roundCommit.ts`、`src/App.tsx`、必要に応じ `src/state/persistence.ts` | 既存の Dinner 精算と判明精算の境界を接続する。判明の既存計算を再利用し、保存時の Pitz・評判・支払済み記録の整合を検証する（§4）。 |
| §5 のテストファイル | モード前提を固定し、本番 Web ビルドの起動条件と横断回帰を追加する。 |

### 同じ保存キーでの開始と往復

- 本番の通常の旧セーブには `shopProgress` が無く、現行の読取だけで評判 0 になる。旧 Dex・在庫・Pitz・記録から shop の評判や段階を算出する処理は設けない。図鑑の発見、購入済みヒント、材料在庫、Pitz 残高、Dinner クリア記録を含む共通記録は現在の読み方のまま引き継ぎ、リセット処理は加えない。切替後に保存された shop の評判は次回起動で続きから使う。 [startup.ts:23–55](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/src/state/startup.ts#L23-L55)、[shopProgress.ts:59–62](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/src/logic/progression/shopProgress.ts#L59-L62)
- 本番の legacy 指定も同じキーを使う。保存する共通項目は両モードから見える。モデル選択だけで shop の累積項目を初期化せず、書き込みの max／和集合マージと Save Protection を経由する。二つのモードを比較するときは検証用の別ブラウザープロファイルを使う。同一プロファイルでの往復・複数タブは §5 の試験対象とする。 [persistence.ts:998–1017](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/src/state/persistence.ts#L998-L1017)、[persistence.ts:1532–1584](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/src/state/persistence.ts#L1532-L1584)、[saveSession.ts:38–68](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/src/state/saveSession.ts#L38-L68)
- R8 の未精算ラウンドは起動時に reducer で再生される。legacy の未精算ラウンドを shop の報酬で処理すると、最初の HOME 表示前に評判が動く可能性がある。逆方向では shop の注文を legacy の報酬に変えてしまう可能性がある。4b ではジャーナルに起点モードを記録し、切替時・切替後を通じて元のルールで一度だけ精算する。起点モードを持たない既存ジャーナルは切替前の形式なので legacy として扱う。既精算・保留ジャーナルも現行保護をかけたまま確認する。 [startup.ts:63–71](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/src/state/startup.ts#L63-L71)、[pendingRoundSettle.ts:44–100](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/src/state/pendingRoundSettle.ts#L44-L100)

## 3. 初回の案内

案内は出さない（2026-11-28 Owner 決定）。案内文、既読キー、表示条件は設けない。

## 4. 特別注文の二つの精算

### 未払いの legacy クリア記録

2026-11-28 Owner 決定として、`firstClearRewarded` に基づく既存の請求権を維持する。

`dinnerSettle` は `PLAYING → CLEARED` で一度だけ発火する。保存レコードの `firstClearRewarded` が偽なら、支払い可能なテーブルでの次の成功時に `FIRST_CLEAR` が適用される。テーブル未調整時の `UNAVAILABLE` では `clears` が増えても受取済みにならない。保存マージは受取済みを論理和で保持する。shop では `FIRST_CLEAR` のときだけ Dinner の評判 +5 が付く。 [gameReducer.ts:2655–2670](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/src/state/gameReducer.ts#L2655-L2670)、[dinnerSettlement.ts:248–271](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/src/mission/dinner/dinnerSettlement.ts#L248-L271)、[dinnerMissionRecordsSave.ts:93–129](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/src/state/dinnerMissionRecordsSave.ts#L93-L129)、[gameReducer.ts:2705–2753](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/src/state/gameReducer.ts#L2705-L2753)

受入確認には `clears: 1, firstClearRewarded: false` の保存を使う。shop 初回ロードで評判 0、起動時の自動支給なし。メニュー条件と在庫を満たした次の成功で初回 Pitz と評判 +5、再読込後の次の成功で再挑戦額と評判 +0。既払いレコード、破損・保存拒否、期限ちょうどの時間切れ、同一 run の再処理も維持する。表示・Pitz 残高・保存レコードを突き合わせる。Dinner の 6 分、★3、メニュー・在庫ガードは #920 の設定を使う。 [dinnerMission.ts:85–98](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/src/mission/dinner/dinnerMission.ts#L85-L98)、[dinnerShopBalance.ts:4–6](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/src/mission/dinner/dinnerShopBalance.ts#L4-L6)、[App.tsx:450–474](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/src/App.tsx#L450-L474)

### Dinner 中にしきい値を跨いだ判明ボーナス

現行の `dinnerSettle` は Dinner の Pitz、初回評判、レコードを更新する。評判がしきい値に届くとメニュー判定は新しい評判を使うが、判明ボーナスを確定する `settleAwaitingMenu` は通常ラウンドの `REGISTER_TO_DEX` で呼ばれる。Dinner が段階を開いた時点では、そのボーナスが支払われたことにはならない。 [progressionModel.ts:120–130](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/src/logic/progression/progressionModel.ts#L120-L130)、[gameReducer.ts:1897–1925](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/src/state/gameReducer.ts#L1897-L1925)、[gameReducer.ts:2733–2753](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/src/state/gameReducer.ts#L2733-L2753)

**2026-11-28 Owner 決定。** Dinner の結果には Dinner 分だけを表示する。Dinner の記録と支払いが保存で確定した後、次の HOME 到達時に判明分を精算し、専用のメニュー入り案内に表示する。結果画面で終了したプレイヤーも、再起動時に保存済み評判と `awaitingMenuRecipeIds − menuEntryPaidRecipeIds` から未払い分に到達できる。既存 `settleAwaitingMenu` を再利用し、1 品ごとの +50 Pitz・+3 評判と支払済み記録を一緒に保存する。ボーナスによる段階の連鎖も既存ループで処理し、最終評判に基づく入荷とメニューを同じ確定状態から導く。 [shopProgression.ts:330–354](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/src/logic/progression/shopProgression.ts#L330-L354)、[shopProgress.ts:25–35](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/src/logic/progression/shopProgress.ts#L25-L35)

**保存境界。** 現行の `persistProgress` の結果は Dinner レコード拒否の検出に使えるが、空の拒否リストだけでは保存成功を保証しない。4b では書込確認のある経路で Dinner 分を確定し、確定したスナップショットを元に判明分を支払う。R8 の同期 API は Dinner 記録必須を無効にするため、そのまま Dinner 確定用に流用しない。保存拒否時に一時的な +5 で判明分を支払わず、二つの保存の間で中断しても、再起動で判明分だけ一度支払う。競合するタブ・再試行・旧モードの書込みでも、残高と支払済み記録が揃うことを確認する。 [persistence.ts:1366–1379](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/src/state/persistence.ts#L1366-L1379)、[persistence.ts:1417–1466](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/src/state/persistence.ts#L1417-L1466)、[gameReducer.ts:2673–2694](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/src/state/gameReducer.ts#L2673-L2694)

**受入例。** 上限直前の評判 39、次段階の判明待ち 1 品、初回未払いの特別注文を用意できるテスト条件で、Dinner 結果の評判は 44（+5）、HOME の判明精算後は 47（+3）と +50 Pitz。Dinner の初回額はそのまま。未到達・支払済み・再挑戦・時間切れは追加なし。複数品、連鎖、HOME への遷移とリロードの順を入れ替えた場合も判明精算の回数と合計を確認する。

## 5. テストへの影響と付け替え

既存のテストが検証する旧ルールにはモードを明示する。本番既定の検証はモックなしの本番 Web ビルドにも置く。以下の一覧は切替箇所と主要な共有入口からの棚卸しで、4b でフル実行の差分を追記する。

| テスト（基準コミットのパス） | 付け替え方針 |
|---|---|
| `src/logic/progression/progressionModelFlag.test.ts`、`reputationTable.gate.test.ts`（同ディレクトリ）、`src/preview/previewIsolation.gate.test.ts` | 既定定数が一箇所という検査を shop に更新。本番の無指定・legacy 指定・未知値・記憶無視・キー非書込・ゲート不成立を検証する。Preview/DEV の優先順・永続性と本番バンドルの隔離検査を維持。 |
| `src/state/gameReducer.progressionFlagOff.test.ts`、同じディレクトリの `gameReducer.shop{Progress,Service,Practice}.flagOff.test.ts`、`gameReducer.shop{ResearchPoints3c,Hints3d}.legacy.test.ts`、`src/components/shopModelUi.phase{2b,3a,3b,3c}.legacy.test.tsx` | legacy をモジュール初期化前に固定し、既存の等価性・フラグ無効時のアサーションをそのまま実行する。`src/logic/progression/progressionModel.legacyEquivalence.test.ts` のモデル明示のテストは引き続き対照に使う。 |
| `src/App.test.tsx`、`src/App.{homeDiscovery,w1Migration,materialEntitlement,pizzaSelectRouting,lk8Backstop,dexHint,hintSheet,hint5Ladder,techniques}.test.tsx`、`src/screens/HomeScreen.{discovery,ctaLayout}.test.tsx`、`src/components/DexOverlay.*.test.tsx`、`src/components/ShopOverlay*.test.tsx` | 旧発見・章・文言・購入などを期待するテストに legacy を明示。共通記録を引き継いだ評判 0 の shop 起動と HOME の注文導線を shop で検証する。切替専用の初回案内や既読キーが追加されないことも確認する。モデル非依存の操作は同じ契約で実行する。 |
| `src/state/gameReducer.{pitzReward,techniques,dinner,dinnerAmbiguous,dinnerSettlement}.test.ts`、`src/state/{recipeChapters,pizzaSelect}.test.ts`、`src/state/materialEntitlement.*.test.ts`、`src/state/discoveryHint*.test.*`、`src/mission/lunchRush*.test.ts` | 旧章・発見・Hint 5.0・報酬などの旧契約を使うケースを legacy に固定。モードを注入できる純関数では入力を明示。共通の在庫・プライバシー・報酬の契約は shop でも照合する。 |
| `src/state/gameReducer.shop{Service,Practice,Catalog3a,StageGate3b,ResearchPoints3c,Hints3d,Phase3e}.test.ts`、`src/components/shopModelUi.phase{2a,2b,3a,3b,3c,3d}.test.tsx` | 明示 shop の挙動検証を継続。初回メニュー、通常注文、練習無報酬、早期判明、研究ポイント、採用 60 品、ヒントの秘匿、Dinner の境界を本番既定のスモークと照合する。 |
| `src/mission/dinner/dinnerSettlement.test.ts`、`src/state/persistence.dinnerMissionRecords.test.ts`、`src/state/gameReducer.dinnerSettlement.test.ts`、`src/state/gameReducer.shopPhase3e.test.ts`、`src/App.dinner.test.tsx`、`e2e/shop-dinner-3e.spec.ts` | 旧テーブル／旧解放の期待を明示 legacy に。shop の本番既定で未払い→初回→再挑戦を通し、段階跨ぎの別精算、拒否・リロード・同一 run 再実行のケースを §4 の期待値で追加。 |
| `src/state/persistence.compat*.test.ts`、`src/state/persistence.{session,protection}.test.ts`、`src/state/pendingRound*.test.ts`、`src/App.{saveProtectionUi,heldJournalDiscard}.test.tsx`、`src/devtools/mainStartup.devState.test.tsx` | 旧形式・未知形式、Preview 隔離、同一キーの legacy → shop → legacy → shop、未精算／既精算／保留の R8 を試験。新しいジャーナルの起点モードと、起点モードのない既存ジャーナルを legacy で精算する互換を両方向で確認する。 |
| `e2e/progression2-*.spec.ts`、`e2e/discovery*.spec.ts`、`e2e/{free-cooking-phase3-2,home-research-entry-parity,contract-2-1-final,dex-silhouette-422,shop-locked-422,dinner-mission,dinner-settlement-dm4-3,save-dinner-records-dm4-2}.spec.ts` | 旧導線や旧 Dex seed 依存の入口はテスト用 fixture で legacy を明示する。カタログ拡張・技法・調理・レイアウト・セーブ系 spec も、旧 seed 依存かモデル共通かを仕分け、旧契約のケースだけ同じ fixture を適用する。 |
| `e2e/shop-{service-orders-2a,practice-2b,catalog-3a,stage-3b,research-points-3c,hints-3d,dinner-3e}.spec.ts`、`e2e/lunch-rush-*.spec.ts`、`e2e/{r8-pending-round,held-journal-discard,layout-contract}.spec.ts` | 明示 shop/legacy の対照を残し、無指定は専用のクリーンな context で確認する。shop では通常注文・特別注文・Lunch Rush・保存復帰・HOME と結果画面のレイアウトを通す。本番ビルドの入口で URL、共通記録の引き継ぎ、R8 の起点モードを追加する。 |

`playwright.config.ts` の通常入口は Vite DEV サーバーなので、`page.goto("/")` だけでは本番ビルドの証明にならない。本番向けに生成した `dist` をローカルで配信し、別 context に旧セーブと Preview/DEV の選択値を置いて、無指定・明示 legacy・指定を外した再起動の UI とストレージを照合する。既存の Chromium、Vitest 3 シャード、WebKit 390×844 / 360×800 各 3 シャードと Layout Contract Gate の実行範囲を維持する。 [playwright.config.ts:36–87](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/playwright.config.ts#L36-L87)、[ci.yml:22–41](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/.github/workflows/ci.yml#L22-L41)、[e2e-webkit.yml:23–54](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/.github/workflows/e2e-webkit.yml#L23-L54)

## 6. ロールバック手順案

1. **判断**。復旧の判断者は Owner。再現できる起動不能、保存破損・上書き・新規プレイの保存不能、注文進行の停止、特別注文／判明報酬の重複や消失、既存 iOS ホーム画面アイコンからの起動不能を即時判断の候補にする。報告時は公開 SHA、時刻、端末、通常／アイコン起動、入力 URL、再現手順を記録する。環境が限定される事象は、影響と再現性を確認して Owner が判断する。
2. **復旧操作**。Owner 承認後、`PROGRESSION_MODEL_PRODUCTION_DEFAULT` を `legacy` に戻す有効化コミットの revert を `main` へ。有効化コミットは既定値と無指定時の検証期待値に絞り、一緒に戻せる形にしておく。実装側に原因があれば、続いて該当 4b 差分の revert をレビューする。Pages の `main` push で再配信し、Actions の SHA と配信 HTML のアセットを確認する。旧 SHA の成果物を緊急再配信する経路は、利用可否と権限を事前確認できた場合の予備とする。現行 workflow は checkout → build → Pages deploy。 [deploy.yml:1–29](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/.github/workflows/deploy.yml#L1-L29)、[deploy.yml:44–58](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/.github/workflows/deploy.yml#L44-L58)
3. **復旧確認**。本番 URL のパラメータなし再起動で legacy の HOME・セーブを確認し、iOS は既存アイコンからアプリを閉じて開き直す。すでに開いているタブは読み込んだバンドルのままなので、再起動して確認する。済んだ取引は同じキーに残る。セーブを消したり過去の JSON で置換したりせず、shop 再有効化時に累積データと受取済み記録が復帰することを検証する。

判断後の目安は revert 準備・レビュー 5～15 分、既存 CI 15～35 分、Pages build と反映 5～15 分、再起動スモーク 5～10 分で、順に進む場合は **30～75 分**。4a 時点の未実測の計画値で、承認待ち・キュー・端末キャッシュ反映は別途。4b で直近実績とドライランから更新し、復旧経路と担当を確定する。個別の起動確認には `?progression=legacy` を使えるが、全体復旧の完了は無指定 URL で判定する。

## 7. 切替当日の運用案

| 時点 | 実施と完了条件 |
|---|---|
| 切替前 | 特定の時間帯には固定せず、準備が整い次第切り替える。Owner が 4b のレビュー対象 SHA とリリース可否を確認し、現行配信 SHA・Pages run、連絡先を記録する。旧セーブの検証用プロファイルと、更新前から本番 URL を追加済みの iPhone を用意する。4b の HV は 390×844 の動画と前後スクショ、Owner による iPhone 実機の確認結果を対象 SHA に結び付ける。 [Human Verification Policy](../decisions/TETO_HUMAN-VERIFICATION-POLICY.md) |
| T+0 | Owner 承認のマージで `Deploy to GitHub Pages` が走る。Actions の deploy 成功、対象 SHA、公開 URL と配信アセットを照合。本番 Web を対象とし、Firebase の本番デプロイは別 workflow。 [deploy.yml](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/.github/workflows/deploy.yml)、[firebase-production-deploy.yml:1–20](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/.github/workflows/firebase-production-deploy.yml#L1-L20) |
| 反映直後・起動と保存 | 本番の無指定 URL で新規と旧セーブをそれぞれ起動。評判 0、共通記録の引き継ぎ、切替専用案内がないこと、注文後の残高・評判・在庫の保持、legacy 指定 → 無指定の往復を確認。セーブは検証用プロファイルを使う。 |
| 反映直後・プレイ | HOME → 注文 → マルゲリータを提供 → 結果で Pitz と評判を確認 → 再起動。準備済みの別プロファイルで特別注文のロック、メニューと在庫条件を満たした解放、Dinner 初回精算と別の判明精算、再挑戦を確認。時間切れは事前検証の証跡も照合する。 |
| 反映直後・iOS | Owner が既存アイコンを残したままスタンドアロンを終了し、そのアイコンから起動する。HOME、shop の既定、注文保存、再起動を確認。Safari からの起動も別に記録し、ストレージ差異と古いアセット配信を切り分ける。再追加なしで起動・更新できることが合格条件。 [manifest.webmanifest:2–13](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/public/manifest.webmanifest#L2-L13)、[index.html:4–14](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/index.html#L4-L14) |
| T+1・6・24・48 時間 | Muse が Pages の公開状態と SHA、新規・既存の起動／保存、注文不能・報酬差異、特別注文の初回支給・重複をスモーク確認する。正常時の報告は行わず、異常時だけ公開 SHA、時刻、環境、再現手順を Owner に報告する。復旧判断は §6 に従い Owner が行う。 |

## 8. 4b の PR 分解案

1. **起動選択・回帰の土台。** 本番の legacy 指定、準備条件、Preview 隔離のテストを実装。既定を legacy に置いた状態で旧ルールのテストを明示化し、本番ビルドを使う検証入口を用意する。#921 が先に入る場合は、差分のある研究ポイント・ヒント・reducer・E2E の期待値を確認してから進める。
2. **保存境界。** R8 ジャーナルに起点モードを記録し、切替時・切替後の両方向で元のモードによる復帰と Save Protection を shop 有効の検証環境で通す。共通記録を現行どおり引き継ぎ、評判だけが 0 から始まることを固定する。
3. **Dinner と判明の精算。** 未払いレコード経由の初回支給を固定し、判明の独立精算と再起動での回収を追加する。結果表示・保存拒否・再試行を含め、記録と残高の同時更新を検証する。#921 等と `gameReducer.ts` が重なる場合は Epic #901 で着手範囲と順序を調整する。
4. **有効化 PR。** 既定値を変えるコミットを単独で識別できるようにし、必要なテスト期待値と HV の結果を同 PR に載せる。旧セーブ・新規・iPhone 実機、CI、ロールバック準備を Owner が対象 SHA で確認してから §7 へ進む。

## 9. Owner 決定による残論点の決着

2026-11-28 に残論点はすべて決着済み。

| 判断事項 | Owner 決定 |
|---|---|
| Preview の無指定既定とネイティブ `--mode app` | 共有定数をそのまま `shop` に反転し、Capacitor も同時に shop にする。環境別の分岐は加えない。Preview はパラメータ・記憶がない初回だけ本番既定に連動する。 [vite.config.ts:7–13](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/vite.config.ts#L7-L13)、[main.tsx:51–57](https://github.com/perusonao/teto-pizza-game/blob/f54d39f/src/main.tsx#L51-L57) |
| 既存共通セーブ | 図鑑の発見、購入済みヒント、材料在庫、Pitz 残高、Dinner クリア記録を含む共通記録は現行の読み方のまま引き継ぐ。評判だけを全員 0 から開始し、リセット処理は加えない。 |
| R8 のモード跨ぎ | ジャーナルに起点モードを記録し、切替時・切替後を通じて常に元のモードのルールで精算する。起点モードを持たない切替前の既存ジャーナルは legacy として精算する。 |
| 初回案内 | 案内は出さない。案内文、既読キー、表示条件は実装しない。 |
| Dinner の判明ボーナス | #920 の二つの決着をともに採用する。未払いクリア記録は `firstClearRewarded` に基づく請求権を維持する。判明ボーナスは Dinner と別にし、次の HOME 到達時に専用のメニュー入り案内と一緒に精算する。再起動時は未払い分を回収する。 |
| 切替運用 | 時間帯を固定せず、準備が整い次第切り替える。復旧の判断者は Owner、判断条件は §6 の一覧。Muse が切替後 1・6・24・48 時間にスモーク確認し、異常時だけ報告する。iOS 実機確認は Owner が担当する。 |
