import { useMemo, useState } from "react";
import { deriveResearchEntries } from "../logic/discovery/researchEntry";
import { SAVE_STORAGE_KEY, type StorageLike } from "../state/persistence";
import { inspectStoredSave, type SaveInspection } from "./apply";
import { BACKUP_SLOTS, readBackup, type BackupRead, type BackupSlot } from "./backup";
import { BackupPanel } from "./BackupPanel";
import { productionCatalog, type EditorCatalog } from "./editorCatalog";
import { clearHints, diffEditable, hintCounts, ingredientName, lastAcquiredFinite, moveOwned, recipeName, setPitz, setStock, toggleOwned } from "./editorModel";
import { IngredientsPanel } from "./IngredientsPanel";
import { DEV_STATE_EDITOR_MARK, DEV_STATE_EDITOR_TITLE } from "./marks";
import { NumberField } from "./NumberField";
import { type AnyPresetId, buildPreset, PRESETS, STAR_PRESETS } from "./presets";
import { ReviewPanel } from "./ReviewPanel";
import { freshEditableState, normalizeEditableState, type EditableState } from "./stateModel";
import "./stateEditorShell.css";

/**
 * DEV State Editor (Issue #403) S4: the editor. DEV / Preview only, reached only through `?dev=state`
 * (src/main.tsx); a production build contains none of this (src/preview/previewIsolation.gate.test.ts).
 *
 * It replaces <App /> (no player state is loaded, nothing the game persists runs). It edits a DRAFT in memory:
 * opening the page, switching tabs, picking a preset or editing a field never touches storage (Owner Contract 7).
 * Storage is written only by the three explicit actions: 「適用する」 (./ReviewPanel.tsx), 「復元する」 and
 * 「破棄する」 (./BackupPanel.tsx), each behind its own confirmation.
 */

type TabId = "status" | "presets" | "ingredients" | "pitz-hint" | "apply" | "backup";
const TABS: readonly { id: TabId; label: string }[] = [
  { id: "status", label: "状態" },
  { id: "presets", label: "プリセット" },
  { id: "ingredients", label: "材料" },
  { id: "pitz-hint", label: "Pitz・Hint" },
  { id: "apply", label: "適用" },
  { id: "backup", label: "バックアップ" },
];

interface Stored {
  inspection: SaveInspection;
  backups: { slot: BackupSlot; read: BackupRead }[];
}

function readStored(storage: StorageLike | null): Stored {
  return {
    inspection: inspectStoredSave(storage),
    backups: BACKUP_SLOTS.map((slot) => ({ slot, read: storage ? readBackup(storage, slot) : ({ kind: "error" } as const) })),
  };
}

/** The state the game reads from the stored save (a save it cannot read reads as the default save). */
function storedState(inspection: SaveInspection, catalog: EditorCatalog): EditableState {
  const state = inspection.kind === "empty" || inspection.kind === "readable" ? inspection.state : freshEditableState();
  return normalizeEditableState(state, catalog);
}

function describeSave(inspection: SaveInspection): string {
  switch (inspection.kind) {
    case "empty":
      return "セーブなし（新規）";
    case "readable":
      return `読み取り可 — Dex ${inspection.state.dex.length} / 所有 ${inspection.state.ownedIngredientIds.length} / Pitz ${inspection.state.pitzBalance}`;
    case "corrupt":
      return "壊れている（JSON として読めない）";
    case "unknown-schema":
      return "未知の schema（このビルドでは読めない）";
    case "storage-error":
      return "storage を読めない";
  }
}

export interface StateEditorProps {
  storage: StorageLike | null;
  /** The real catalog by default; a test may pass another. */
  catalog?: EditorCatalog;
  now?: () => Date;
}

export function StateEditor({ storage, catalog: catalogProp, now }: StateEditorProps) {
  const catalog = useMemo(() => catalogProp ?? productionCatalog(), [catalogProp]);
  const [stored, setStored] = useState<Stored>(() => readStored(storage));
  const [base, setBase] = useState<EditableState>(() => storedState(stored.inspection, catalog));
  const [draft, setDraft] = useState<EditableState>(base);
  const [tab, setTab] = useState<TabId>("status");
  const [notice, setNotice] = useState<string>("");
  const mode = import.meta.env.DEV ? "DEV" : "PREVIEW";

  const effective = useMemo(() => normalizeEditableState(draft, catalog), [draft, catalog]);
  const diff = useMemo(() => diffEditable(base, effective, catalog), [base, effective, catalog]);

  /** Re-reads what is stored; `resetDraft` also makes the stored state the new base and draft. */
  function refresh(resetDraft: boolean) {
    const next = readStored(storage);
    setStored(next);
    if (resetDraft) {
      const state = storedState(next.inspection, catalog);
      setBase(state);
      setDraft(state);
    }
  }

  /** A notice belongs to the tab where it was raised: switching tabs clears it. */
  function selectTab(next: TabId) {
    setNotice("");
    setTab(next);
  }

  const edit = (fn: (s: EditableState) => EditableState) => setDraft((s) => fn(s));
  const originalBackupExists = stored.backups.some((b) => b.slot === "original" && b.read.kind === "ok");

  const researchEntries = useMemo(() => {
    if (catalogProp !== undefined) return null;
    try {
      return deriveResearchEntries({ dex: effective.dex, ownedIngredientIds: effective.ownedIngredientIds, discoveryHintFacts: effective.discoveryHintFacts }).entries;
    } catch {
      return null;
    }
  }, [catalogProp, effective]);

  const lastFinite = lastAcquiredFinite(effective, catalog);
  const finiteTotal = catalog.ingredients.filter((i) => i.unlockCondition !== undefined).length;
  const finiteOwned = effective.ownedIngredientIds.filter((id) => !catalog.starterIds.includes(id)).length;
  const hints = hintCounts(effective);

  function loadPreset(id: AnyPresetId, label: string) {
    setDraft(buildPreset(id, catalog));
    setNotice(`プリセット「${label}」を下書きに読み込みました（まだ適用されていません。「適用」タブで確認してください）。`);
  }

  return (
    <main className="dse" data-dev-state-editor={DEV_STATE_EDITOR_MARK} aria-labelledby="dse-title">
      <header className="dse__head">
        <h1 id="dse-title" className="dse__title">
          {DEV_STATE_EDITOR_TITLE}
        </h1>
        <span className="dse__badge">{mode}</span>
      </header>
      <p className="dse__note">開発・Human Verification 専用です。このページを開いただけでは save は変更されません。編集は下書きで、「適用」タブで確認して適用したときだけ書き込みます。</p>

      <div className="dse-tabs" role="tablist" aria-label="DEV State Editor">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" id={`dse-tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`dse-panel-${t.id}`} className="dse-btn dse-tab" onClick={() => selectTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {notice && (
        <p className="dse-note dse-note--notice" role="status">
          {notice}
        </p>
      )}

      <section className="dse__card" role="tabpanel" id={`dse-panel-${tab}`} aria-labelledby={`dse-tab-${tab}`}>
        {tab === "status" && (
          <div>
            <h2 className="dse__h2">状態</h2>
            <p className="dse__row">
              保存先 key: <code>{SAVE_STORAGE_KEY}</code>
            </p>
            <p className="dse__row">現在の save: {describeSave(stored.inspection)}</p>
            <h3 className="dse__h3">下書き（適用前）</h3>
            <ul className="dse__list" aria-label="下書きの要約">
              <li>
                Dex: {effective.dex.filter((e) => e.discovered).length} / {catalog.recipes.length} 発見済み
              </li>
              <li>
                所有材料: {finiteOwned} / {finiteTotal}（finite）
              </li>
              <li>最後に取得した材料: {lastFinite ? ingredientName(catalog, lastFinite) : "なし"}</li>
              <li>Pitz: {effective.pitzBalance}</li>
              <li>
                Hint: {hints.factRecipes} レシピ（{hints.factIds} facts）／ 購入履歴 {hints.purchaseRecipes} レシピ
              </li>
              {researchEntries && (
                <li data-research-entries={researchEntries.length}>
                  Research Entry: {researchEntries.length} 件{researchEntries.length > 0 ? `（${researchEntries.map((e) => recipeName(catalog, e.recipeId)).join("・")}、unlock: ${[...new Set(researchEntries.map((e) => ingredientName(catalog, e.unlockIngredientId)))].join("・")}）` : ""}
                </li>
              )}
              <li>変更: {diff.length} 件</li>
            </ul>
          </div>
        )}

        {tab === "presets" && (
          <div>
            <h2 className="dse__h2">プリセット</h2>
            <p className="dse-note">選ぶと下書きが置き換わります（保存はされません）。</p>
            <ul className="dse-list">
              {[...PRESETS, ...STAR_PRESETS].map((p) => (
                <li key={p.id}>
                  <button type="button" className="dse-btn dse-preset" data-preset-id={p.id} onClick={() => loadPreset(p.id, p.labelJa)}>
                    <b>{p.labelJa}</b>
                    <span className="dse-preset__desc">{p.descriptionJa}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === "ingredients" && (
          <IngredientsPanel
            draft={draft}
            catalog={catalog}
            onToggleOwned={(id) => edit((s) => toggleOwned(s, id, catalog))}
            onSetStock={(id, qty) => edit((s) => setStock(s, id, qty, catalog))}
            onMove={(id, direction) => edit((s) => moveOwned(s, id, direction, catalog))}
          />
        )}

        {tab === "pitz-hint" && (
          <div>
            <h2 className="dse__h2">Pitz</h2>
            <p className="dse-field">Pitz 残高（0 以上の整数）</p>
            <NumberField label="Pitz 残高" value={draft.pitzBalance} onCommit={(n) => edit((s) => setPitz(s, n))} className="dse-input--wide" />
            <h2 className="dse__h2">Research Hint</h2>
            <p className="dse-note">
              いま: facts {hintCounts(draft).factRecipes} レシピ（{hintCounts(draft).factIds} facts）／ 購入履歴 {hintCounts(draft).purchaseRecipes} レシピ
            </p>
            <button type="button" className="dse-btn" onClick={() => edit(clearHints)} disabled={hintCounts(draft).factRecipes + hintCounts(draft).purchaseRecipes === 0}>
              Hint を初期化（facts と購入履歴）
            </button>
            <p className="dse-note">Trial Notebook と Research target はセッション限りで保存されないため、適用後にゲームを開き直せば初期化されています。</p>
          </div>
        )}

        {tab === "apply" && (
          <ReviewPanel storage={storage} catalog={catalog} base={base} draft={effective} inspection={stored.inspection} originalBackupExists={originalBackupExists} now={now} onApplied={() => refresh(true)} />
        )}

        {tab === "backup" && (
          <BackupPanel
            storage={storage}
            backups={stored.backups}
            onRestored={(text) => {
              refresh(true);
              setNotice(text);
            }}
            onDiscarded={(text) => {
              refresh(false);
              setNotice(text);
            }}
          />
        )}
      </section>

      <div className="dse-bar" role="group" aria-label="下書き">
        <span className="dse-bar__count" aria-live="polite">
          変更 {diff.length} 件
        </span>
        <button type="button" className="dse-btn" disabled={diff.length === 0 && draft === base} onClick={() => {
          setDraft(base);
          setNotice("下書きを現在の save の状態に戻しました。");
        }}>
          下書きを破棄
        </button>
        <button type="button" className="dse-btn dse-btn--primary" onClick={() => selectTab("apply")}>
          確認して適用へ
        </button>
      </div>

      <p className="dse__row">
        <a className="dse__link" href={import.meta.env.BASE_URL}>
          ゲームへ戻る
        </a>
      </p>
    </main>
  );
}
