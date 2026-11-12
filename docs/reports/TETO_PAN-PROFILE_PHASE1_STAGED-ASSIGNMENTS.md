# PAN_PROFILE Phase 1 — staged 6品 profile割当表

Status: authoring-only proposal. Production未配線。PAN_PROFILEとDOUGH_SHAPE_TARGETは独立registryであり、この表は両IDを並べるだけで一方から他方を推論しない。

| staged recipe / evidence id | PanProfileId | DoughShapeTargetId | 根拠・扱い |
|---|---|---|---|
| `greek-style-pizzadb` | `pan` | `round` | staged sourceの `pan: pan`。shapeはround |
| `chicago-deep-dish-pizzadb` | `deep-pan` | `round` | staged sourceの `pan: deep-pan` |
| `siciliana-pizzadb` | `pan` | `square` | staged sourceの `pan: pan` / `shape: square` |
| `detroit-style-pizza-pizzadb-p5` | `steel-pan` | `square` | staged sourceの `pan: steel-pan` / `shape: square` |
| `new-england-bar-pizza-pizzadb-p6` | `shallow-pan` | `round` | staged sourceの `pan: shallow-pan` |
| `montreal-style-pizza-pizzadb-p13` | `deep-pan` | `round` | staged sourceの `pan: deep-pan` |

`grandma-pizza` と `pinsa-romana` はparity対象だがこのstaged 6品の割当対象ではない。grandmaは既存adapterで`tray`、pinsaは`legacy-round`のまま。`turkish-pide-pizzadb-p5`はshape `boat`だがsourceのpanは`null`であり、PAN_PROFILEを割り当てない。

全27工程候補の目標は変更しない。本PRは候補matrix、Recipe catalog、工程優先順位を編集しない。
