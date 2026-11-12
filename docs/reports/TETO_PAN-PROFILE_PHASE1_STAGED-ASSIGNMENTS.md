# PAN_PROFILE Phase 1 — staged 6品 profile割当表

Status: authoring-only proposal. Production未配線。PAN_PROFILEとDOUGH_SHAPE_TARGETは独立registryであり、この表は両IDを並べるだけで一方から他方を推論しない。

| staged recipe / evidence id | PanProfileId | DoughShapeTargetId | 根拠・扱い |
|---|---|---|---|
| `grandma-pizza-pizzadb` | `tray` | `square` | 既存runtimeの `pan: tray` / `panShape: square` parity |
| `detroit-style-pizza-pizzadb-p5` | `tray` | `rectangle` | matrixの角型・PAN_BAKE + DOUGH_SHAPE_TARGET |
| `siciliana-pizzadb` | `tray` | `square` | matrixの角型・厚底パン。深さの再判断が必要ならprofileだけを差し替える |
| `pizza-al-taglio-romana-pizzadb-p9` | `tray` | `rectangle` | 天板・長方形候補 |
| `chicago-deep-dish-pizzadb-p4` | `deep-pan` | `round` | matrixのround deep pan |
| `turkish-pide-pizzadb-p5` | `griddle` | `boat` | 非panの舟形。PAN_PROFILEを形状そのものとして扱わない代表例 |

`pinsa-romana` はparity対象だがこの6品のM-PAN割当対象ではない。Phase 1では `legacy-round` のままで、既存のDoughKind軸と混同しない。

全27工程候補の目標は変更しない。本PRは候補matrix、Recipe catalog、工程優先順位を編集しない。
