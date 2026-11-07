# PR #783（Batch 19）iPhone Safari 実機 HV：LAN 手順と B19 保存シード（Owner 向け・短縮版）

2026-11-07。対象: PR #783 HEAD `abb3da5a1021b160b2ee75acbe5a00866a8a0eaf`（変更していない）。シード実装は **独立ブランチ** `claude/teto-pizza-parallel-tasks-ylyfe5`（`abb3da5a` を取り込み＋シード用の差分のみ）。PR・merge・Production ON・共有 Preview 更新なし。実機 HV は **0 PASS**（判定は Owner）。

## 何を足したか（Preview ビルド専用）
- `src/preview/b19HvSeeds.ts`（新規）、`b19HvSeeds.test.ts`（新規）。`hvSeeds.ts`（5 行の分岐追加）と `previewIsolation.gate.test.ts`（ID を本番除外の検査に追加）のみ既存ファイルを編集。
- `?hv=b19-pesto-burrata` / `?hv=b19-crudaiola`（同じ保存）: step 69 までの素材を所持・在庫あり、作れる既存レシピは発見済み、**burrata 未所持（Shop に NEW）**、新 2 レシピ未発見、Pitz 999。
- 書き込み先は Preview 用キー `teto-pizza-preview-save-v1` のみ。本番キー・Firebase は読まない・書かない。再読込（reload）では再シードしない。

## 検証済み
- `src/preview` 32 ファイル 246 テスト全通過（新規 10 を含む）。`tsc -b`・oxlint 通過。全 Vitest・WebKit E2E・CI は未実施。
- 本番ビルドに `b19-*` の文字列が **0 件**（`previewIsolation.gate.test.ts` 通過＋ビルド成果物の grep）。
- Preview ビルドを Chromium 390×844 で開いて確認: 本番キーはダミー値のまま不変、Preview キーに 999 Pitz・burrata 未所持・新 2 レシピ未発見、バッジ `PREVIEW · PR#783`、reload で保存維持。**Chromium であり iPhone Safari の PASS ではない。**

## LAN 手順（Owner の PC。iPhone と同じ Wi-Fi）
```
git fetch origin claude/teto-pizza-parallel-tasks-ylyfe5
git checkout claude/teto-pizza-parallel-tasks-ylyfe5 && npm ci
VITE_PREVIEW_MODE=1 VITE_PREVIEW_PR=783 VITE_PREVIEW_SHA=$(git rev-parse --short HEAD) npx vite build --base=/ --outDir dist-lan
npx vite preview --outDir dist-lan --host 0.0.0.0 --port 4173
```
1. PC の LAN IP を確認し、iPhone の**通常の Safari タブ**で `http://<LAN-IP>:4173/?hv=b19-pesto-burrata` を開く（origin が本番と違うため保存は混ざらない）。
2. バッジが `PREVIEW · PR#783 · <short SHA>` であること。短い SHA は `git rev-parse --short HEAD` と一致させて記録。ゲームのコードは #783 の `abb3da5a` と同一で、差分は Preview 専用のシードのみ。
3. 終わったら PC のサーバーを止める。同じ Wi-Fi の他の端末に公開される点に注意（Pinsa HV キット `docs/reports/screenshots/pinsa-hv/kit/owner-lan-server.mjs.txt` を使う場合は、その手順の制限に従う）。
4. 2 本目は `?hv=b19-crudaiola`（別 URL を開く＝新規ナビゲーションで再シード）。やり直しは同じ URL を開き直す。

## 確認項目（#783 Result §9 と同じ。各レシピで）
Shop の「ブッラータ」NEW／購入 → 図鑑の Research 名が「？？？ピザ A／B（ブッラータ）」で材料名・レシピ名なし／1 本目ソース → オリーブオイルの 2 層／ブッラータとモッツァレラの絵の区別（トレイ・盤面・焼成後・RESULT・Shop・図鑑）／焼成 → NEW DISCOVERY／横スクロールなし・文字切れなし／ヒント（SAUCE 段または CHEESE 段、各 10 Pitz）で 2 レシピを取り違えない。動画は 390×844、Owner 保管（repo に入れない）。結果語（PASS / FAIL / waived）は Owner が日付と SHA つきで記録。

## 制約・未確認
- シード付きの build は #783 の HEAD そのものではなく、その上に 1 コミット載った別 SHA。HV 証跡には両方の SHA を書く。シードを #783 に入れるかは Owner 判断（入れる場合は #783 の HEAD が変わり Codex・CI が再実行）。
- http（LAN）での iPhone Safari の挙動（保存・動画）は未確認。
