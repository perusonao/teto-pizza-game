# B案再構成 Phase 3c — 研究ポイント（貯める・見える）Result Report（2026-11-27）

- 親 Issue: #901／設計: `docs/design/TETO_SHOP-GROWTH-RESTRUCTURE_PHASE0-1_DESIGN_2026-11-25.md` §4（Phase 3c）・§6（研究ポイントの Owner 決定 6 件）、`docs/design/TETO_SHOP-GROWTH_R4_DISCOVERY-DEPENDENCY_READTHROUGH_2026-11-26.md`
- 基準: `main` = `ea379da`（Phase 3b PR #915 がマージ済み）
- PR: #916（**Draft。マージと Draft 解除は Owner 承認待ち**）
- 対象は **shop モード（`?progression=shop`、Preview / DEV）だけ**。本番既定の legacy の挙動・表示・セーブの形は変えていない

## 1. やったこと

### 1-1. 獲得（step 2）

- **自由調理（メニュー開発）の試作で、結果が出たとき 1 回だけ**獲得する。レシピに一致した試作・オリジナルピザ・**焦げて失敗した試作**のどれも対象
- 焼く前にやめた試作（途中キャンセル）は結果が出ないので獲得しない。注文・練習（Pizza Select）・Lunch Rush・Dinner は獲得しない
- どのピザの試作でも貯まる（研究対象に限らない）。全体共通プール
- 獲得量＝試作の段階の値。段階の決め方：**研究対象が設定されていればそのレシピの段階 → レシピに完全一致した採用レシピの段階 → どちらでもなければ第1段階**（採用外のレシピへの一致も第1段階）。段階前の完全一致（3b の「判明」）もそのレシピの段階で数える
- 獲得量は仮置きで、1 つの定数表にまとめた：`RESEARCH_POINTS_BY_STAGE = [1, 2, 3, 4, 5]`（`src/logic/progression/researchPoints.ts`。3f はここだけ変える）
- 実装：`REGISTER_TO_DEX`（すべての試作が結果を確定する唯一の遷移。保存ジャーナルの精算＝再起動時・焼いた後に HOME へ戻ったときも同じ遷移）の直後に `registerToDexWithResearch` が加算する。`REGISTER_TO_DEX` の本体は動かしていない（`gameReducer` の末尾で包む）
- 二重取りの防止：結果画面（RESULT）にいる間だけ加算し、加算した回は `lastResearchPointGain` を持つので、同じ回への再ディスパッチは何もしない（失敗した回は RESULT に留まるので、この印で止める）。リロードは「保存済みのジャーナルは再精算しない」既存の仕組みと、保存の max マージで止まる

### 1-2. 保存（step 1）

- `shopProgress.researchPointsEarned`（save v2、schema bump なし）：**累計獲得**（増えるだけ）。マージは max（評判と同じ）
- 0 のときは書かない：旧セーブ・3b までの `shopProgress`・legacy のセーブは形が変わらない。キーがなければ 0 として読む。不正値（負・NaN・文字列）は 0、小数は切り捨て
- 残高は `researchPointBalanceOf(shop)` の 1 か所から読む（3c は累計そのもの）

### 1-3. 表示（step 3）

| 場所 | 表示 |
|---|---|
| HOME | Pitz の隣に「🔬 N」（読み上げ：「研究ポイント N（ヒントと交換できるようになるのは、もう少し先です）」）。残高 0 でも出す |
| 結果画面（一致・オリジナル・失敗のどのカードにも） | 「🔬 研究ポイント +N（所持 M）」＋「ヒントと交換できるようになるのは、もう少し先です」 |
| ヒント画面（自由調理のとき） | 「🔬 研究ポイント N」＋同じ注記。ボタンなし。ヒントの価格は Pitz のまま（3d まで触らない） |

legacy ではどれも出ない（App / GameScreen が `SHOP_MODEL_ACTIVE` のときだけ値を渡す）。

## 2. 範囲外（変えていないもの）

- ヒントの購入 UI・価格ラダー・判明情報の表示、Hint 5.0 の Pitz 課金の移行（3d）
- 特別注文の読み替え（3e）、獲得量の確定（3f）、本番の shop 切り替え（Phase 4）、legacy の撤去（Phase 5）
- レシピデータ、価格、評判の数値、legacy の挙動と文言

## 3. 論点（Owner 判断）

1. **保存は「残高」ではなく「累計獲得」**：shopProgress は複数タブ・ロールバック対策で max / union マージ。残高は 3d で減るので max が使えない。累計獲得（増えるだけ）を保存し、3d で「累計使用」（これも増えるだけ）を足して 残高＝獲得−使用 とする想定。どちらも max マージで二重取り・二重払いが起きない。2 つのタブで同時に試作すると片方の獲得が max で潰れることがあるのは評判と同じ性質
2. **焼いた後に HOME へ戻った／再起動した試作**：焼き上げ後の仕上げ（FINISH）の途中で HOME に戻ると、既存の保存ジャーナルが試作を確定させる（Pitz・図鑑もこのとき入る）。焼きまで完了して結果が確定しているので、研究ポイントも獲得する扱いにした（「途中キャンセル」は焼く前にやめた試作と解釈）
3. HOME の「前回の試作を記録しました」通知（ジャーナル精算の通知）には研究ポイントを出していない。必要なら 3d で足す
4. 研究対象が設定された試作は、別のピザを作っても研究対象の段階で数える（指示どおり）。研究対象を高い段階にしておき、簡単なピザで試作を重ねると多めに貯まる。3f の数値調整で見る点として記録する
5. 注記の文言は「ヒントと交換できるようになるのは、もう少し先です」（既存の「練習なので、Pitz・評判は入りません」と同じ丁寧体）。最終文言は Owner 判断

## 4. テスト

| ファイル | 件数 | 内容 |
|---|---:|---|
| `src/logic/progression/researchPoints.test.ts`（新） | 9 | 定数表が 1／2／3／4／5、段階ごとの獲得量、段階の決め方（研究対象 → 完全一致 → 第1段階、採用外は通り抜け） |
| `src/logic/progression/shopProgress.test.ts`（追加 7） | 7 | 3c 以前の形を保つ・0 は既定値・往復・不正値は 0・max マージ・比較・保存済みの値との max と未知サブキーの保持 |
| `src/state/persistence.compat.researchPoints.golden.test.ts`（新） | 既存 era 数＋5 | 既存の全 era と 3b までの shopProgress は残高 0・キー追加なし／読み込みで書かない／新しいビルドのサブキー保持／**commit → 再起動で残高維持**／古いスナップショットで減らない |
| `src/state/gameReducer.shopResearchPoints3c.test.ts`（新） | 16 | 段階 1〜5 の獲得量が表どおり・判明も段階で・研究対象が優先・オリジナル／採用外は第1段階・プール共通／**失敗（焦げ）も獲得し再ディスパッチで増えない**／**注文・練習・Lunch Rush・焼く前は獲得しない**／次の回は表示が消える／**実際の焼き→保存→リロード（二重取りなし・次の試作は上乗せ）、焦げ、焼く前に HOME（0）、ジャーナル精算（再起動・HOME）で 1 回だけ** |
| `src/state/gameReducer.shopResearchPoints3c.legacy.test.ts`（新） | 4 | legacy は獲得しない・失敗の回は同じオブジェクトを返す（従来どおり）・実際の保存経路で `shopProgress` を作らない |
| `src/components/shopModelUi.phase3c.test.tsx`（新） | 11 | HOME の 🔬 N（Pitz の隣・0 でも出る・null なら出ない）、結果画面の 3 種類のカードの +N・所持・注記、ヒント画面の残高と注記（ボタンなし） |
| `src/components/shopModelUi.phase3c.legacy.test.tsx`（新） | 1 | legacy では shop モデルが無効（表示の値が渡らない） |
| `e2e/shop-research-points-3c.spec.ts`（新） | 3 | 実ブラウザ：HOME 🔬0 → 第2段階の試作で +2（所持 2）→ HOME 🔬2 → リロードで 2 のまま → ヒント画面 → 焼く前に戻っても 2／注文では獲得しない／legacy では何も出ずセーブに shopProgress ができない |

### 既存テストの変更

なし（削除・skip・緩和もしていない）。途中で `REGISTER_TO_DEX` の本体を関数に切り出したところ、既存のゲート `trialRecord.gate.test.ts`（試作ノートの記録位置をソースで固定）が落ちたため、テストは変えずに実装を戻し、本体はそのままで `gameReducer` の末尾で包む形にした。

## 5. Human Verification

- スクリーンショット：`docs/reports/screenshots/b-phase-3c-research-points/`（before 6 枚＝`main` `ea379da`／after 6 枚。390×844）。同じセーブ（評判 45、図鑑に第1段階の肉系レシピ、ミートラヴァーズの材料）で同じ操作（`e2e/shop-research-points-3c.spec.ts`、before は `HV_BEFORE=1`）

| # | 画面 | before | after |
|---|---|---|---|
| 01 | HOME（shop、研究ポイントなしのセーブ） | Pitz・レシピのピルだけ | Pitz の隣に「🔬 0」 |
| 02 | メニュー開発でミートラヴァーズ（第2段階）の結果 | 評判 +3 まで | 評判の下に「🔬 研究ポイント +2（所持 2）」と注記 |
| 03 | HOME | 変化なし | 「🔬 2」 |
| 04 | 次の試作のヒント画面 | 試作の説明まで | 「🔬 研究ポイント 2」と注記 |
| 05・06 | legacy の HOME・結果 | — | 変化なし（研究ポイントは出ない） |

## Human Verification Videos

| Video | Viewport | Duration | Size | Verification |
|---|---|---:|---:|---|
| `B-PHASE-3C_research-points_390x844.mp4`（H.264） | 390×844 | 22.6 s | 0.49 MB | PASS |

Download: セッション内で直接提出しました（リポジトリには commit していません）。

Video Verification: PASS（ffprobe：h264、390×844、22.60 s、485,035 bytes。全フレームをデコードできることを確認）

確認ポイント（動画の順）:
1. shop・評判 45 の HOME：Pitz の隣に「🔬 0」
2. 「メニュー開発」でミートラヴァーズを作る → 結果：新メニュー開発、評判 +3、「🔬 研究ポイント +2（所持 2）」「ヒントと交換できるようになるのは、もう少し先です」
3. HOME：「🔬 2」。リロードしても 2（二重に増えない）
4. もう一度「メニュー開発」→ ヒント画面：「🔬 研究ポイント 2」と注記（購入ボタンはない）
5. 焼かずに HOME へ戻る → 2 のまま

## 6. ローカルの結果

- `tsc -b`／oxlint：OK（oxlint の警告は既存のものだけ）
- e2e（Chromium、390×844 と 360×800）：`e2e/shop-*.spec.ts` の 7 ファイル（`shop-research-points-3c`・`shop-stage-3b`・`shop-catalog-3a`・`shop-service-orders-2a`・`shop-practice-2b`・`shop-locked-422`・`shop-buttons-sticky-tabs-455`）で **46 passed**
- `npm run build`：OK（チャンクサイズの警告は既存のもの）
- Vitest は 3a・3b と同じく、長時間シミュレーション 5 ファイル（`researchAttempt.sim*`・`researchAttempt.replayAudit`）を分けて計測した（コミット `f425398`）
  - フル − その 5 ファイル：**711 files passed／3 skipped、13275 passed／20 skipped（既存）／2 todo、失敗 0**（10 分 24 秒）
  - その 5 ファイル：**124 passed、失敗 0**（22 分 30 秒）
