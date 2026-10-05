import { useMemo, useState } from "react";
import type { EditorCatalog } from "./editorCatalog";
import { ingredientRows, type OwnedFilter } from "./editorModel";
import { NumberField } from "./NumberField";
import type { EditableState } from "./stateModel";

/**
 * DEV State Editor (Issue #403) S4: the ingredient list. Search (id or name), an OWNED filter, the OWNED switch,
 * the stock stepper / field and the acquisition order ↑↓ (OD-9: buttons, no dragging). It edits the DRAFT only.
 */
export interface IngredientsPanelProps {
  draft: EditableState;
  catalog: EditorCatalog;
  onToggleOwned: (id: string) => void;
  onSetStock: (id: string, qty: number) => void;
  onMove: (id: string, direction: "earlier" | "later") => void;
}

const FILTERS: readonly { id: OwnedFilter; label: string }[] = [
  { id: "all", label: "すべて" },
  { id: "owned", label: "OWNED" },
  { id: "not-owned", label: "未所有" },
];

export function IngredientsPanel({ draft, catalog, onToggleOwned, onSetStock, onMove }: IngredientsPanelProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<OwnedFilter>("all");
  const rows = useMemo(() => ingredientRows(draft, catalog, query, filter), [draft, catalog, query, filter]);
  return (
    <div>
      <label className="dse-field" htmlFor="dse-search">
        材料を検索（名前 / id）
      </label>
      <input id="dse-search" type="search" className="dse-input dse-input--wide" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="例: 玉ねぎ" autoComplete="off" />
      <div className="dse-seg" role="group" aria-label="OWNED の絞り込み">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" className="dse-btn dse-seg__btn" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>
      <p className="dse-note" role="status">
        {rows.length} / {catalog.ingredients.length} 件
      </p>
      <p className="dse-note">取得順の ↑↓ は、所有している材料全体の並びで 1 つ入れ替えます（絞り込み中も全体の並びが対象）。starter は固定です。</p>
      <ul className="dse-list">
        {rows.map((row) => (
          <li key={row.id} className="dse-ing" data-ingredient-id={row.id}>
            <div className="dse-ing__main">
              <span className="dse-ing__name">{row.nameJa}</span>
              <code className="dse-code">{row.id}</code>
              {row.order !== null && <span className="dse-badge" aria-label={`取得順 ${row.order} 番目`}>#{row.order}</span>}
              {row.starter && <span className="dse-badge dse-badge--muted">starter 固定</span>}
            </div>
            {!row.starter && (
              <>
                <div className="dse-ing__row">
                  <button type="button" role="switch" aria-checked={row.owned} aria-label={`${row.nameJa} OWNED`} className="dse-btn dse-switch" onClick={() => onToggleOwned(row.id)}>
                    {row.owned ? "OWNED" : "未所有"}
                  </button>
                  <span className="dse-stepper">
                    <button type="button" className="dse-btn dse-btn--icon" aria-label={`${row.nameJa} の在庫を 1 減らす`} disabled={!row.owned || (row.stock ?? 0) <= 0} onClick={() => onSetStock(row.id, (row.stock ?? 0) - 1)}>
                      −
                    </button>
                    <NumberField label={`${row.nameJa} の在庫`} value={row.stock ?? 0} disabled={!row.owned} onCommit={(n) => onSetStock(row.id, n)} />
                    <button type="button" className="dse-btn dse-btn--icon" aria-label={`${row.nameJa} の在庫を 1 増やす`} disabled={!row.owned} onClick={() => onSetStock(row.id, (row.stock ?? 0) + 1)}>
                      ＋
                    </button>
                  </span>
                </div>
                <div className="dse-ing__row">
                  <button type="button" className="dse-btn dse-btn--icon" aria-label={`${row.nameJa} を取得順で 1 つ前へ`} disabled={!row.canMoveEarlier} onClick={() => onMove(row.id, "earlier")}>
                    ↑
                  </button>
                  <button type="button" className="dse-btn dse-btn--icon" aria-label={`${row.nameJa} を取得順で 1 つ後ろへ`} disabled={!row.canMoveLater} onClick={() => onMove(row.id, "later")}>
                    ↓
                  </button>
                  <span className="dse-note dse-note--inline">{row.owned ? "取得順を入れ替え" : "OWNED にすると取得順の最後に入ります"}</span>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
