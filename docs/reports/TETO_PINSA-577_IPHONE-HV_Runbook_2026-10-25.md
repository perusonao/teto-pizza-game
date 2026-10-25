# Pinsa Romana — iPhone Safari 実機 HV の準備（検証環境・最短手順・原典の記録）

> **【2026-10-25 追記】** Pinsa の本番 ON 用 PR（`PINSA_PRODUCTION = true`）が出たため、`pinsa-literal.patch.txt` は、その PR を含む `main` には当たらない（リテラルが既に `true`）。本書の手順は、公開前の HV（ゲートが `false` の `main` d3da198 に対するもの）の記録として残す。公開後の再検証は、通常の `main` を `VITE_PREVIEW_MODE=1` でビルドするだけでよい。

Status: **準備のみ。接続・公開・実機の確認は Owner の操作。** 本番の `PINSA_PRODUCTION = false`、Production・共有 Preview・Firebase・E5・Grandma Pizza は変更していない。本番 ON 用の PR は作っていない。**実機の結果（PASS / FAIL）は Owner の言葉でのみ記録する。**
基準 `main` = `d3da198`（#657 merge 後）。検証キット: `docs/reports/screenshots/pinsa-hv/kit/`（リハーサルの画像は同ディレクトリ）。

## 1. 検証環境（承認済みの V1-LAN A1 に Pinsa の 1 行を足したもの）
**このクラウド上のセッションは iPhone から到達できない**ので、「HV 用の公開 URL」は存在しない（作らない）。URL は Owner の PC がホットスポット上で配信する **`http://<PC のホットスポット IP>:4173/teto-pizza-game/`**（例 `http://172.20.10.2:4173/teto-pizza-game/`）。公開 URL を作らないことが、共有 Preview・Production の保存データと Firebase を使わない条件そのもの。

| 項目 | 内容 |
|---|---|
| 方式 | FINISH E5 で承認済みの V1-LAN A1: iPhone のホットスポットに PC を接続し、限定サーバ（`owner-lan-server.mjs`、E5 キットと**同一ファイル**・SHA-256 `e0bd9b45…2d17`）を PC のホットスポット IP だけに束縛、iPhone の IP だけ許可、60 分で自動終了、CSP で外部通信を遮断、アクセスログあり |
| ビルド | `main` の commit に、**Pinsa のリテラル 1 行**（`pinsa-literal.patch.txt`: `PINSA_PRODUCTION` を `true`）だけを `git apply`（commit しない）し、`VITE_PREVIEW_MODE=1 npm run build`。`VITE_FIREBASE_*` は渡さない。E5 は本番で ON 済みなので E5 のパッチは不要 |
| 保存データ | origin が `http://<IP>:4173` で、`perusonao.github.io`（本番・共有 Preview）とは別。保存キーは Preview 用の `teto-pizza-preview-save-v1` で、この origin では空から始まる。`seed.html` は github.io / https の公開ホストでは書き込みを拒否する |
| Firebase | 使わない（ビルドに変数なし。サーバが dist の `AIza…` と Preview 以外のビルドを拒否） |
| 本番への影響 | なし。`main` の `pinsaGate.ts` は `false` のまま。パッチは Owner の PC の使い捨てツリーだけ |

リハーサル（このセッション、Chromium 390×844、Linux）: Pinsa ON の Preview ビルドを、限定サーバ（`127.0.0.2` に束縛・`127.0.0.1` のみ許可）の CSP の下で、seed → 図鑑 → 研究 → 生地選択 → 後乗せ → 発見 → 図鑑まで通した。サーバ集計は `total 7 / denied 0 / csp 0 / clients 127.0.0.1 のみ`。**WebKit・iPhone では未実施**（この環境に無い）。

## 2. Owner の操作（最短）
**A. PC（通常回線でビルド）**
```
git clone https://github.com/perusonao/teto-pizza-game.git pinsa-hv && cd pinsa-hv
git checkout origin/claude/pinsa-romana-pre-impl-inuu7e      # この runbook とキットを含むブランチ（main d3da198 + docs のみ）
git apply docs/reports/screenshots/pinsa-hv/kit/pinsa-literal.patch.txt   # src/data/pinsaGate.ts の 1 行だけ。commit しない
git status --short                                           # src/data/pinsaGate.ts だけ。他にあれば中止
npm ci
VITE_PREVIEW_MODE=1 npm run build                            # PowerShell: $env:VITE_PREVIEW_MODE="1"; npm run build
cp docs/reports/screenshots/pinsa-hv/kit/pinsa-seed.html.txt dist/seed.html
cp docs/reports/screenshots/pinsa-hv/kit/owner-lan-server.mjs.txt owner-lan-server.mjs     # PowerShell は Copy-Item
```
**B. ホットスポットへ切替**（E5 Runbook §3 B と同じ）: iPhone のインターネット共有をオンにして「接続中のデバイス」を PC 1 台にし、PC を接続。PC のホットスポット側 IP とゲートウェイ（= iPhone の IP）を確認（通常 `172.20.10.2` と `172.20.10.1`）。

**C. サーバ起動（PC）**
```
node owner-lan-server.mjs --dist dist --bind <PC のホットスポット IP> --allow <ゲートウェイ = iPhone の IP> --port 4173 --ttl-minutes 60 --log lan-access.jsonl
```
`listening ONLY on http://<PC の IP>:4173/teto-pizza-game/` と `allowed client(s)` が iPhone の IP であることを確認。`REFUSED: …` が出たら起動しない。

**D. iPhone（Safari）** — `http://<PC の IP>:4173/teto-pizza-game/seed.html`
1. 画面の origin が PC の IP、「既存セーブ: なし」であること。違えば**中止**。
2. 「**セーブ A**（ジャモン発見済み）」→「ゲームを開く」。右下に **PREVIEW** バッジ。ホームの Pitz **999**。
3. **ピザ図鑑 →「研究中のピザ」→「？？？ピザ A（ルッコラ）」の「このピザを研究する」**。
4. **生地**: ○/□ の右に **「ふつうの生地」「ほかの生地」** の 2 つのチップ（1 行に収まる）。「**ほかの生地**」を選び、生地を広げて「次へ」。
5. **ソース** トマトソースを円状に → 次へ。**チーズ** モッツァレラ ×2 → 次へ。**具材** 生ハム ×3 →「焼く」→ ジャスト帯で取り出す。
6. **仕上げ**: **ルッコラ ×2**（焼成後）を置いて「**完成**」。
7. **期待**: 「🍳 新しい調理法を発見！ **ピンサ生地**・**後乗せ**」と「**ピンサ・ロマーナ を発見しました！**」（No.30・第 4 章）。「ピザ図鑑」に載る。

**追加（任意・各 1 回）**
- **負の確認**: 4. で「ふつうの生地」のまま同じ手順 → 発見にならない（オリジナル）。またはルッコラを**焼成前**に置く → 発見にならない。生地・タイミングのどちらも、画面は答えを言わない。
- **Research の A/B（Q7）**: 「セーブ B」（ジャモン未発見）で 3. を開く → ルッコラのピザが **2 件（A / B）**。ジャモンは B に変わる（OFF では文字なし）。HOME の「レシピ発見」直行が選択画面に変わる点も見る。
- **見え方**: 生地チップの文言・並び、仕上げでルッコラが見分けられるか、ルッコラの位置（R4。Reference の暫定配置は jamon と同じ）、丸い生地のままであること（§4）。

**E. 後片付け**: `seed.html` の「この origin の検証用セーブだけ消す」→ PC で `Ctrl+C`（終了サマリを保存。`clients` が iPhone の IP のみ・`denied` 0）→ ホットスポット OFF・PC を元の回線へ → `pinsa-hv` を削除。Safari の「履歴と Web サイトデータを消去」（全消去）は使わない。

**中止条件**（データを消さず画面と収録を保全して報告）: origin が想定外／PREVIEW バッジなし／起動しない・ループ／本番の保存が変化（本番 URL は開かない）。

**記録様式（Owner）**
```
## iPhone 実機 HV（Pinsa）
端末/iOS/Safari: …   commit: d3da198 + pinsa-literal.patch   接続: （A1 ホットスポット束縛 IP）
生地チップ（文言・1 行）: PASS/FAIL   発見（ほかの生地＋ルッコラ後乗せ）: PASS/FAIL   負の確認: PASS/FAIL
ルッコラの視認性・位置: 見える/見づらい/不可（所見）   Research A/B（セーブ B）: PASS/FAIL   丸い生地の受容: OK/NG
画面収録: （保管先・SHA-256）
```

## 3. 原典の記録（Owner 指示 2026-10-25）
- 参照先: https://pizzadb.jp/en/pizzas/pinsa-romana/ と https://www.dimarco.it/en/the-pinsa 。**このセッションからは両方とも開けなかった**（`getaddrinfo ENOTFOUND`／プロキシ拒否）。pizzadb.jp は Owner の取得・中継（F1〜F6）と 172 matrix の記録に依る。Di Marco は、検索結果の要約（Di Marco 自身のサイトの記述。製造元の主張で、独立の裏付けではない）に依る。
- **確認できた点**: 生地は小麦・米・大豆のブレンド（Di Marco は加えて発酵種を挙げる。比率は非公開）。記録の「小麦・米・大豆をブレンドした長時間発酵生地」と整合する（PK-0 項目 2 を補強）。形は**楕円**（名前は「押す」の pinsere に由来し、押し伸ばして細長い楕円になる）。ピザが一般に丸いのに対し、ピンサは楕円で不規則、と説明している。
- **Owner 決定: 形状は楕円が正しい。現行の丸い描画は、ゲーム上の簡略化として記録する（M0）。** 172 matrix の `round` は簡略化または誤りで、原典の形ではない。楕円の描画・CUT・採点は未実装（別 Epic 規模）。HV では「丸い生地のまま」を既知の簡略化として扱う。
- 現在の材料・工程との相違は、本ブランチ前提の `TETO_PINSA-577_PUBLISH-PREP-P1_Result.md` §5 のとおり。新たな相違は **形（楕円 vs 丸）のみ**。材料・工程（モッツァレラ焼成、生ハムは前後どちらも可、ルッコラは最後）に矛盾は無い。個数・bake は原典に無く暫定。説明文の妥当性（項目 4）と Piadina との区別（項目 5）は未確認のまま。
- 出典 URL（検索結果）: [The Pinsa – Di Marco](https://www.dimarco.it/en/the-pinsa)、[Pinsa romana, everything you need to know – Di Marco](https://www.dimarco.it/en/news/pinsa-all-the-answers)

## 4. 残る別 Gate（本番 ON 用 PR の前）
実機 HV の結果、原典の確認（項目 2・4・5。形は上記で記録済み）、Owner の公開承認。**本番 ON 用 PR は未作成。**
