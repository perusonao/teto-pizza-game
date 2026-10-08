# #417 残り18種 デザイン比較 — 報告（候補 / Owner 判断待ち）

Status: **Owner 採用済み（A: fontina / cashew-cheese / cream-cheese / catupiry / pepperoni / bacon / ham / chicken / anchovy / tuna / shrimp / salmon、B: salami / prosciutto-crudo / pork / sardine / salt-cod、clam 既存維持）。Style Lock 記録は `docs/decisions/TETO_INGREDIENT-ICON-2.0_STYLE-LOCK-V2.md` §1b。この文書は比較時点の履歴。** 採用 SVG は `docs/design/references/ingredient-icons-2.0/` へ移動（ファイル名 = ingredient id）、不採用は `svg-not-adopted/`。

（以下は比較時点の報告。） Production コード・確定 8 種・既存 32×32 3 種・#418 は未変更。

- 比較シート: [`sheet1.png`](./sheet1.png)（候補一覧: 64 / 28·24·20px × 淡色・赤・グレースケール）、[`sheet2.png`](./sheet2.png)（似た食材 6 グループの識別比較）
- 候補 SVG（64×64・透明背景・id/gradient/defs なし・Style Lock v2 の線幅 2.4 / 接地影 / 2 トーン）: [`svg/`](./svg/)
- 比較用に確定済み 8 種は `../../references/ingredient-icons-2.0/` を参照（未変更）。

## 1. 残り 18 種の特定

26 種 = チーズ 10 / 肉 9 / 魚介 7（`ingredientTaxonomy` / `ingredients.ts` の現行カタログ）から確定 8 種を除く。

| 系統 | 残り | id |
|---|---|---|
| チーズ 4 | | fontina, cashew-cheese, cream-cheese, catupiry |
| 肉 7 | | pepperoni, bacon, ham, prosciutto-crudo, pork, chicken, salami |
| 魚介 7 | | anchovy, sardine, tuna, shrimp, salmon, salt-cod, **clam** |

**注意:** 18 種のうち `clam` は既存 32×32（`clam-valve`、変更禁止）。新規デザインは **17 種**。clam は比較シートに既存のまま参考掲載しただけ。

> 補足: Style Lock v2 の docs（決定書・参照 SVG）は main 未マージで `origin/claude/ingredient-icon-comparison-qqjfch` にあったため、docs / 参照 SVG のみこのブランチへ取り込んだ（コード変更なし）。

## 2. 候補と推奨

A が推奨。B は代替案（識別が割れる 6 種のみ）。

| id | 推奨 | 候補 | 意図 / 懸念 |
|---|---|---|---|
| fontina | A | A | 穴あきの黄色い扇形 + 橙の皮。gorgonzola（青筋・くさび）と色/穴で区別 |
| cashew-cheese | A | A | 小さな丸塊 + カシュー 2 粒。ナッツが識別点 |
| cream-cheese | A | A | 青みのある銀紙包みの角丸ブロック。feta（白い角切り）とは銀紙・青みで区別 |
| catupiry | A | A | 渦巻き状に盛った滑らかなクリーム。ricotta（粒の山）と形で区別 |
| pepperoni | A | A | 明るい赤橙の円 2 枚 + 脂の斑点 |
| salami | A | A / B(ログ+スライス) | 暗い赤紫 + 白い脂粒。**pepperoni との差は主に色**。グレースケール 20px では A 同士がほぼ同じ → 懸念。B は形で区別できるが 20px でブロックに見える |
| bacon | A | A | 赤 + クリーム縞の波打つ帯 2 本 |
| ham | A | A 骨付きもも / B 折りスライス | A は骨で識別。B は薄く bacon と近い |
| prosciutto-crudo | **B** | A 渦巻き / B ひだ状リボン | A は pork-B（渦巻き）と衝突するため B を推奨 |
| pork | **B** | A チョップ / B ポルケッタ断面 | A は ham-A と淡い塊で近い。B は渦巻きで区別でき、recipe（porchetta）とも一致 |
| chicken | A | A | ドラムスティック。肉系で最も識別しやすい |
| anchovy | A | A | 細い S 字の茶色いフィレ 2 本。**グレースケールでは bacon と似る**（色・尾で区別） |
| sardine | A | A 2 匹 / B 1 匹 | 青背の銀魚。2 匹の方が 20px で「魚」と読める |
| tuna | A | A 赤身ブロック / B 缶 | A は色で識別。B は缶と一目でわかるが salt-cod-B と丸く似る |
| shrimp | A | A | 橙の丸まった海老（節・尾・目）。最も識別しやすい |
| salmon | A | A | 橙 + 白い脂の縞 + 銀の皮。tuna / ham と色・縞で区別 |
| salt-cod | A | A 干し魚 / B 切り身 | A は魚型で anchovy・sardine と区別できるが 20px でかなり小さい。B は白で feta / cream-cheese と近い |

## 3. 識別性の所見（sheet2）

- 丸スライス（pepperoni / salami / hot-dog / sausage）: 色相差で区別可。**pepperoni↔salami はグレースケール 20px が最弱**。
- 淡ピンク肉（ham / pork / prosciutto）: 形（骨・渦・ひだ）で分離する構成が最も安全 → ham-A + pork-B + prosciutto-B。
- 白系（fontina / cashew / cream-cheese / catupiry vs 確定 mozzarella / ricotta / feta / grana）: 形が全て異なり、20px 赤背景でも混同なし。
- 魚: sardine（魚型・青）/ anchovy（帯状・茶）/ salt-cod（魚型・淡色）/ clam（殻）は区別可。anchovy↔bacon のみ要注意。

## 4. Owner に決めてほしい点

1. salami: A（色頼み）か B（形で区別）か、または色味をさらに離すか。
2. prosciutto-crudo B / pork B の組合せ採用で良いか。
3. tuna: A（ブロック）か B（缶）か。
4. clam は既存 32×32 のまま据え置きで良いか（新規デザイン対象は 17 種）。

STOP: Owner 承認まで Style Lock・実装は行わない。
