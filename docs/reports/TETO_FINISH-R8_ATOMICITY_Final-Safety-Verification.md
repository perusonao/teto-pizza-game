# FINISH R8 — J-B（pendingRound）実装前の最終安全性検証

- 前提: `TETO_FINISH-R8_ATOMICITY_Fresh-Audit.md` / `..._Design-Verification.md`、Issue #560、PR #616（= Save Protection PR-3、open・未 merge）
- 検証時点: `main` = `e3a7537`、PR #616 head = `07a9086`（Codex レビュー指摘なし、Owner 承認待ち）
- 種別: **安全性検証のみ**。`src`・テスト・保存形式は未変更。検証プローブはリポジトリ外（scratchpad）で実行し、コミットしていない
- 触らないもの: PR-3（#616）・#615・#584 のブランチ。merge・共有 Preview 更新・本番 FINISH 有効化は行わない

## 0. Owner 方針（確定事項）

通常調理は J-B（`pendingRound`）／`schemaVersion` 2 維持は互換性検証が条件／中断時は既存の採点・登録で自動完了／効率ボーナスなし／アプリ内 HOME 離脱も中断と同じ確定結果／Lunch Rush は L-1 を基本／自動完了後は次回起動時に結果を通知／サイズ超過時に黙って現行挙動へ戻さない／PR-3 merge 後に実装／R8 専用 Issue を #560 から分割。

## 1. 前回報告の訂正（重要）

Design-Verification §4 で「古いビルドが書き込むと `pendingRound` は落ちる可能性が高い」と書いたが、**誤り**。実測（現 main の `loadSave` → `persistProgress` を 2 回書込）で、**未知のトップレベルキーは現行ビルドの書込で保持される**（`persistence.ts` の `extras.topLevel`、`KNOWN_SAVE_KEYS` にないキーは丸ごと書き戻される）。

| 観測（現 main） | 結果 |
|---|---|
| `pendingRound` 付きセーブを `loadSave` | 例外なし。戻り値のキーに `pendingRound` は出ない（無視） |
| Pitz だけ変える書込 | `pendingRound` は**そのまま残る** |
| Dex・在庫を変える書込 | **そのまま残る**。`schemaVersion` は 2 のまま |

影響: 古い（forward-compat 対応済みの）ビルドが間に挟まっても journal は消えない。消えない代わりに、**古いビルドはその journal を解決できず、古い journal が残り続ける**。これを前提に §6 の状態機械を設計した。P3-4B より古いビルドの挙動は未検証（本番に残っているかは未確認）。

## 2. Duplicate Gate

- R8 専用の Issue／PR は存在しない（`search_issues` 0 件。open PR 28 件に該当なし。#616 は R8 を範囲外と明記）。
- #560 のコメントは、Phase A の `it.todo` 記録（R8 = 3 件目）と PR-3 のクレームのみ。
- PR-3 は #616 として open。本検証は #616 のコードを読み取り専用で参照（`refs/pull/616/head` をローカル ref に取得。ブランチは変更していない）。
- 結論: 重複なし。R8 専用 Issue を新規作成する（§10）。

## 3. pendingRound の最小フィールド

登録・再採点に必要なものだけ。**スコア・効率ボーナス用の時間・UI 状態は保存しない**（スコアは復元したピザから再計算する）。

```
pendingRound: {
  v: 1,
  id: string,                    // ラウンド ID（焼成時に生成。通知・二重完了の識別用）
  status: "pending" | "settled", // §6 の状態機械
  kind: "GUIDED" | "FREE_COOK",  // Lunch Rush / Dinner は対象外（§8）
  recipeId?: string,             // GUIDED のみ。FREE_COOK は識別が確定時なので持たない
  bakeValue: number,
  createdAt: number,
  pizza: {                       // JSON 往復で完全一致（§4 のパリティ検証）
    toppings: [{ id, ingredientId, x, y, stage? }],
    sauceIds: string[], sauceOrigin: {x,y}|null, sauceDeposits: [{x,y,amount,ingredientId?}],
    doughShape: { radii: number[] }, pan?: "tray"|null, dough?: string, squareDough?: { thickness: number[] }
  },
  research?: { targetId: string|null, validAtStart: boolean },  // FREE_COOK のみ
  settled?: { outcome, recipeId|null, stars|null, pitz, newMaterialIds[], newTechniqueIds[], discovered: boolean }  // status="settled" の要約（通知用）
}
```

- 省くもの: `score`/`completion`（再計算）、`cookingTiming`（効率ボーナスなし）、`cutState`、`hint`、`dex`（復元時の現在値を使う）、`inventory`（保存済みの消費後の値をそのまま使う）。
- **settle は在庫を一切変更しない**。再採点の結果の在庫は捨て、保存済みの在庫を維持する（プローブで、焼成前の在庫から再実行すると二重消費になることを確認した設計根拠）。
- FINISH の仕上げ配置（`stage:"post"`）は焼成時の journal に含まれない。仕上げ中の中断では、それまでの配置は失われ、その分の在庫も未消費のまま（FINAL 消費は FINISH 確定時）。Guided+FINISH+CUT で FINISH を確定済みの場合は、確定時に journal を**再書込**する（§5）。そうしないと「FINISH の部品を消費したのに登録には含まれない」不整合になる。

## 4. 保存データサイズの実測と上限

実測（合成ピザ、座標は 17 桁の浮動小数）。

| ケース | journal 部分（JSON） |
|---|---|
| 典型（トッピング 20、ソース堆積 70） | **約 6.7 KB** |
| 最悪（トッピング 150、ソース 2 種 200 点） | 約 34 KB |
| 最悪＋天板（`squareDough` 256 セル） | 約 39 KB |
| 参考: journal なしの通常セーブ（61 レシピ想定） | 約 6 KB |

上限の根拠（コード）:
- **ソース堆積**: 1 点あたり ≤ `SAUCE_RATE_PER_TICK`（0.02）。1 種 ≤ `SAUCE_MAX_QUANTITY`（1.0）、合計 ≤ `SAUCE_TOTAL_MAX_QUANTITY`（2.0）。`tickDepositAmount = min(0.02, 残り)` で漸減しない（Zeno 型の増殖なし）。よって **1 種 ≈ 50 点、合計 ≈ 100 点 + 端数 1**。上の最悪値（200 点）は 2 倍の余裕を含む。
- **トッピング**: `MIN_TOPPING_DISTANCE`（9）で最密充填すると生地半径 58 で約 150 個。
- **天板**: 16×16 = 256 セルの厚み配列。
- 実際の最大は約 30 KB と見込まれる。座標は丸めない（丸めると再採点が非クラッシュ時と変わる。§7 のパリティ検証は丸めなしで成立）。

方針: **ハード上限 64 KB**（最悪の約 1.7 倍）。超えたら **journal を書かず、焼成の確定そのものを止めて理由を表示**（黙って現行挙動へ戻さない）。上限は実装時に実データで再確認する。

## 5. 焼成時の保存失敗の検知と、次工程への遷移停止

**現状の確認（コード）**: `persistProgress` は `setItem` の例外を握りつぶす（`catch { /* Storage full… gameplay continues */ }`）。戻り値は `blocked`（保護による拒否）しか返さず、**容量超過・無効化・書込が落ちたこと（読み戻し不一致）は検知できない**。保存は `useEffect` で描画後に走るため、焼成の遷移はそれを待たない。

**設計**:
1. 新しい同期コミット関数（例 `commitRoundSave`）。`CONFIRM_BAKE`（と、窓が残る場合の FINISH 確定）で、**dispatch の前に**、reducer を純関数として先に評価し、その結果のスナップショット（消費後の在庫＋`pendingRound`）を `setItem` → **読み戻しで一致確認**。結果は型付き: `ok` ／ `blocked(理由)` ／ `failed(quota|unavailable|dropped|oversize)`。
2. `ok` のときだけ `CONFIRM_BAKE` を dispatch。`failed` のときは **BAKE のまま止め**、「保存できないため焼成を確定しません」を表示して再試行を促す（HOME に戻れば何も消費されない）。
3. `blocked`（PR-1/2/3 の保護：`load-failed`／`stale-save`／未来版／破損）は**現行方針どおり進行を止めない**。この状態ではそのページから何も書かれない（`load-failed` は sticky、`stale-save` はリロードまで）ため、半端な状態は永続化されない。
4. **不変条件**: 「消費後の在庫」と `pendingRound`（登録後は Dex）は**同じスナップショットから書く**。`pendingRound` はセッション状態（`GameState`）にも持ち、保存 effect のスナップショットに常に含める。これにより、後から保護が解除されて保存が再開しても、在庫だけが書かれることは構造上ない。
5. 「保存せずに続ける」は提供しない（提供すると、その後に保存が回復したとき在庫のみ書かれる半端な状態になり得る）。保存できないなら焼成しない。

PR-3 との関係: コミット関数は PR-3 の `noteSaveWritten`／ガード照合を通る。ガードが拒否すれば `blocked` として返る。

## 6. pendingRound の寿命と状態機械（旧ビルド・複数タブ・ON→OFF→ON）

状態: `pending` → `settled` → （通知確認で）削除。

- **焼成確定の保存**: 消費後の在庫と `pending` を同一 `setItem` で書く。
- **登録（通常フロー）**: Dex・Pitz・（FINAL の消費）と **`pendingRound` の削除**を同一 `setItem`。
- **起動時**: `pending` があれば、初期状態を純関数で組み立て（保存は書かない）、マウント時の 1 回の保存で `settled`＋要約・Dex・Pitz を**同一 `setItem`** で書く。`settled` は二重実行を構造的に拒否する（再実行しない）。要約は通知用。通知の確認で削除（確認前に再度落ちても通知が消えない）。
- StrictMode の二重初期化: 初期化は純関数のため安全。保存は 2 回目が「変更なし」でスキップ（プローブで、journal を消さずに再実行すると `timesMade` が 1→2 になることを確認＝**状態機械が必須**の根拠）。

| 状況 | 挙動 | 根拠 |
|---|---|---|
| 旧ビルド（P3-4B 以降）が間に挟まる | journal は**保持される**（§1）。旧ビルドは解決しない。新ビルドが戻れば settle | 実測 |
| 旧ビルドが journal を残したまま Dex を進めた | settle は BEST（max）・`timesMade`＋1・Pitz は今回分の 1 回。journal の登録は未実施なので正当 | 登録は journal 1 件につき 1 回 |
| 複数タブ：タブ A が窓中、タブ B を開く | B が settle して保存。**A の次の保存は PR-3 の基準値ガードで `stale-save` として拒否**され、通知が出る。登録は B の 1 回のみ | PR-3 のコード（`checkSaveSession`） |
| 複数タブ：A が先に登録 | journal は消えている。B は何もしない | 同一 `setItem` |
| FINISH ON → OFF（プレビュー opt-in の撤回） | settle は**ゲートに依存しない**（`finalization:"FINAL"` を明示、在庫は不変）。Free の journal も OFF ビルドで完了できる | 設計 |
| ON → OFF → ON、後乗せカタログが ON のときだけ存在する食材・レシピ | OFF ビルドでは解決不能。**journal は削除せず検証済みの原文のまま保持**し、通知「新しい版で開くと完了します」。ON に戻れば settle | 未知キー保持＋設計 |
| journal が壊れている／サイズ超過／`v` が未知 | 破棄せず保持。通知で明示（黙って現行挙動へ戻さない） | 方針 |
| Full Reset | セーブごと消える | `resetSave` |

PR-3 で「基準値」を持つため、settle の書込は基準値を更新しながら通る。`load-failed`／`stale-save` の間は settle も書込まれず、メモリ上の結果表示のみ（要約は保存されない）。リロードで再試行される（journal は保存に残る）。

## 7. 自動完了の冪等性と二重登録の検証

プローブ（fugazza、CUT あり）:
- **パリティ**: 非クラッシュ（焼成→CUT→登録）と、ピザを JSON 往復して再採点した結果は、Dex（`bestScore` 77.75098511426721, `bestStars` 4, `timesMade` 1）・Pitz（140）・スコアが**完全一致**。座標を丸めないことが条件。
- **二重実行**: journal を消さずに settle を 2 回走らせると `timesMade` が 2 になる → 消去／`settled` を同一 `setItem` にする設計が必須。
- **在庫**: settle は在庫を変更しない（15 のまま）。

登録で動くものの二重登録リスク（コード調査）:

| 対象 | 永続？ | 二重実行の安全性 |
|---|---|---|
| Dex（BEST／`timesMade`／発見） | 永続 | `pending` → 登録＋削除が同一 `setItem`。再実行は `settled` で拒否 |
| Pitz（品質クレジット） | 永続 | 同上（Dex と同じ保存に含まれる）。効率ボーナスは付けない |
| 素材解放（`ownedIngredientIds`／`unlockedForShop`／スターター付与） | 永続 | 台帳（union／既存の exactly-once 設計）。冪等 |
| 技法（`discoveredTechniqueIds`） | 永続 | union。冪等 |
| ヒント事実（`discoveryHintFacts`）、Research 除外（`researchExclusions`） | 永続 | union。冪等 |
| ヒント試行カウンタ（`preDiscoveryFreeCookAttempts`）、Trial Notebook、`lastResearchRows`、`lastPitzCredit`、`justDiscovered` | **セッションのみ** | 保存されないので二重登録にならない。ただし中断後は復元されない（通知の要約で補う） |

## 8. Lunch Rush（L-1）で無料やり直しが成立するか

L-1 の定義: 提供（`MISSION_NEXT_ORDER`）が受理されるまで、そのピザの消費は**永続しない**。提供以外の退出（期限切れ・HOME・リロード）は「作られなかった」ものとして、**保存もメモリも焼成前の在庫に戻す**（HOME とリロードの一致のため）。

検証（コード）:
- ランの状態（時計・成績・未受領の報酬）はメモリのみ。永続されるのは `missionBest`（ラン終了時）のみ。
- 焼成後、提供前に退出すると、**ラン全体**（提供済みの成績・報酬）を失う。得られるのは 1 枚ぶんの在庫の返却だけ。
- 無料やり直しとして成立するのは **ラン最初の 1 枚のみ**: 「最初の 1 枚を焼く → 結果を見る → 退出 → 新しいランをやり直す」。失うものは数秒。得るものは「その 1 枚の品質を提供前に知ること」と在庫の返却。ただし提供しなかったピザは成績にも Dex にも入らず、新しいランは別の注文になる。**実利は小さく、原則禁止の趣旨（結果を見てから在庫を取り戻す）には形式上該当する**。Owner が L-1 を基本とした判断どおりなら許容範囲だが、Owner 判断事項として明記する。
- 窓中の RESTOCK: UI 上は到達不能（`MissionServePanel` に Shop／Dex の入口なし）。reducer は受理するため、返却は「差分の足し戻し」で合成する（前回の検証どおり、POST_BAKE で onion 15→55 を受理）。

## 9. アプリ内 HOME 離脱とリロードの一致

現状: `handleGoHome` は POST_BAKE で確認ダイアログの後 `PLAY_AGAIN`（破棄）。リロードは（現行）消費のみ。J-B 後は両方が**同じ settle 関数**を通る。

| 退出 | 現行 | J-B 後 |
|---|---|---|
| Guided／Free の POST_BAKE で HOME | `PLAY_AGAIN`＝消費のみ・登録なし | その場で settle（既定で完了）→ 同じ要約を HOME で通知 |
| 同じ状態でリロード／強制終了 | 消費のみ・登録なし | 次回起動時に settle → 同じ要約を通知 |
| BAKE で HOME／リロード | 消費なし | 変更なし（journal もなし） |
| Lunch Rush の結果画面で HOME／期限切れ／リロード | 消費のみ | いずれも「作られなかった」（在庫を戻す。L-1） |
| Dinner | 変更なし | 変更なし |

POST_BAKE から出る UI 経路は HOME のみ（コード確認：`handleGoHome`、結果画面の退出は RESULT 以降）。確認ダイアログ（`GO_HOME_CONFIRM_MESSAGE`）は「報酬を失う」という文言のため、**仕様変更に合わせて文言の更新が必要**（HV 対象）。

## 10. R8 専用 Issue

R8 専用 Issue を **#617** として作成した（実装タスク・受け入れ条件・Owner 判断待ちを記載。#560 には分割の旨をコメント）。

## 11. 結論と Owner 判断事項

### 結論
J-B は、保存形式を `schemaVersion` 2 のまま任意キー 1 つの追加に留められる（互換性は実測で確認：現行ビルドは未知キーを保持）。実装前に**必ず設計に入れるべき追加事項**が 4 つ見つかった。
1. 保存失敗の検知は既存の `persistProgress` では不可能（例外を握りつぶす）。同期コミット＋読み戻し確認が必要。
2. `pendingRound` は状態機械（`pending`→`settled`→削除）が必須。消さずに再実行すると二重登録になる。
3. FINISH 確定後に CUT が続く場合、journal の再書込が必要。
4. Lunch Rush の L-1 は「保存もメモリも戻す」まで含めないと、HOME とリロードの結果が一致しない。

### Owner 判断事項
1. 焼成時の保存失敗は**焼成を止める**（BAKE のまま、再試行）でよいか。「保存せずに続ける」は提供しない前提。
2. ハード上限 64 KB でよいか（実測の最悪値は約 39 KB）。超過時は焼成を止めて理由を表示する。
3. 自動完了後の通知：確認まで保存（`settled`＋要約）する案でよいか。
4. HOME 離脱の通知は、その場で表示してよいか（次回起動を待たない）。
5. L-1 の残る抜け道（ラン最初の 1 枚を見てから退出）を許容するか。
6. 解決不能な journal（後乗せカタログ OFF など）を**保持して通知**する方針でよいか。
7. 確認ダイアログ文言・通知 UI・保存失敗の表示は HV 対象。

## 12. 未確認事項

- P3-4B より古いビルドが利用者の端末に残っているか。
- Free＋FINISH の実機での挙動（プレビュー opt-in 経路。コード読解のみ）。
- 実際のピザの最大サイズ（実装時に実データで再測定）。
- PR-3（#616）の最終 merge 形。本検証は head `07a9086` に基づく。
