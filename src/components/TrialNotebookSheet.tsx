import { useEffect, useId, useRef } from "react";
import { getIngredient } from "../data/ingredients";
import type { TrialEntryView } from "../logic/discovery/trialNotebook";
import { diffsForView, type TrialDiff } from "../logic/discovery/trialNotebookDiff";
import { IngredientGlyph } from "./IngredientGlyph";
import { NOTEBOOK_COPY } from "./trialNotebookCopy";

/**
 * Discovery 3.0 Notebook N1: the read-only 試作ノート, opened from the Hint sheet and closed back onto it.
 *
 * It renders the model's display-view rows exactly as the pure model orders them (most recent activity first) and nothing
 * else: the player's own combination (sauce / toppings), the `#n`, how many times that same combination was made,
 * and the P2 line the player was shown for it (`textJa` only -- the line's `kind` is never rendered, not even as a
 * data attribute). The view has no recipe, candidate, count, distance or "was it right" field, so none can reach
 * the DOM; every string here is the same for every target and for every pool size.
 *
 * Session-only (N1 accepted limitation): the notebook is not saved, so it is empty again after a reload. The
 * footer says so. Nothing here dispatches, stores or reads storage.
 */


function retryLine(retryCount: number): string | null {
  return retryCount > 0 ? `同じ組み合わせを ${retryCount + 1} 回作ったよ` : null;
}

function IngredientChips({ ids, emptyText }: { ids: readonly string[]; emptyText: string }) {
  if (ids.length === 0) return <span className="trial-notebook__none">{emptyText}</span>;
  return (
    <>
      {ids.map((id) => {
        const ingredient = getIngredient(id);
        return (
          <span key={id} className="hint-sheet__chip">
            {ingredient && (
              <span className="hint-sheet__glyph" aria-hidden="true">
                <IngredientGlyph ingredient={ingredient} />
              </span>
            )}
            {ingredient?.nameJa ?? id}
          </span>
        );
      })}
    </>
  );
}

function nameOf(id: string): string {
  return getIngredient(id)?.nameJa ?? id;
}

function names(ids: readonly string[]): string {
  return ids.map(nameOf).join("、");
}

/** Only what changed: no empty rows and no "unchanged" lines. */
function DiffBlock({ diff }: { diff: TrialDiff }) {
  return (
    <div className="trial-notebook__diff" data-trial-diff="">
      <p className="trial-notebook__diff-title">{NOTEBOOK_COPY.diffTitle}</p>
      <ul className="trial-notebook__diff-list">
        {diff.added.map((id) => (
          <li key={`+${id}`}>＋ {nameOf(id)}</li>
        ))}
        {diff.removed.map((id) => (
          <li key={`-${id}`}>− {nameOf(id)}</li>
        ))}
        {/* INV-D7 (OD-TQ1D-4): a change to or from "no sauce" is shown as an ordinary ＋ / − of the sauce that
            changed -- never as a 「ソース：… → なし」 absence. Only a sauce-to-sauce change keeps the arrow. */}
        {diff.sauce && diff.sauce.before.length > 0 && diff.sauce.after.length > 0 && (
          <li>
            {NOTEBOOK_COPY.diffSauce}：{names(diff.sauce.before)} → {names(diff.sauce.after)}
          </li>
        )}
        {diff.sauce && diff.sauce.before.length === 0 && diff.sauce.after.length > 0 && <li>＋ {names(diff.sauce.after)}</li>}
        {diff.sauce && diff.sauce.before.length > 0 && diff.sauce.after.length === 0 && <li>− {names(diff.sauce.before)}</li>}
      </ul>
    </div>
  );
}

export function TrialNotebookSheet({
  entries,
  onBack,
  backLabel = NOTEBOOK_COPY.back,
  researchLabelJa = null,
}: {
  entries: readonly TrialEntryView[];
  onBack: () => void;
  /** Where 「もどる」 leads: the Hint sheet (default) or the RESULT. */
  backLabel?: string;
  /** #346 S4: the current Research Target's anonymous label (「？？？ピザ ①」), shown once as a header band for
   *  the whole notebook. Never per row: a row carries no target (the notebook has no recipe field). */
  researchLabelJa?: string | null;
}) {
  const titleId = useId();
  const backRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    backRef.current?.focus();
  }, []);

  const diffs = diffsForView(entries);
  return (
    <div className="trial-notebook__backdrop" role="presentation"
      onClick={(event) => {
        // The notebook sits inside the Hint sheet's backdrop: a backdrop tap goes back to the Hint, never closes it.
        event.stopPropagation();
        onBack();
      }}
    >
      <section
        className="trial-notebook"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-trial-notebook=""
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onBack();
          }
        }}
      >
        <div className="hint-sheet__header">
          <h2 id={titleId} className="hint-sheet__title">
            {NOTEBOOK_COPY.title}
          </h2>
          <button ref={backRef} type="button" className="hint-sheet__close trial-notebook__back" onClick={onBack}>
            {"\u{2190}"} {backLabel}
          </button>
        </div>
        {researchLabelJa && (
          <p className="trial-notebook__research" data-trial-research="">
            {NOTEBOOK_COPY.researchContext}：{"\u{1F50E}"} {researchLabelJa}
          </p>
        )}
        {entries.length === 0 ? (
          <div className="trial-notebook__empty" data-trial-notebook-empty="">
            <p className="trial-notebook__empty-title">{NOTEBOOK_COPY.empty}</p>
            <p className="trial-notebook__empty-body">{NOTEBOOK_COPY.emptyHint}</p>
          </div>
        ) : (
          <div className="trial-notebook__body">
            <p className="hint-sheet__caption">{NOTEBOOK_COPY.order}</p>
            <ul className="trial-notebook__list">
              {entries.map((entry, index) => {
                const toppings = entry.combination.ingredientSet.filter((id) => !entry.combination.sauceBase.includes(id));
                const retry = retryLine(entry.retryCount);
                const diff = diffs[index];
                return (
                  <li key={entry.number} className="trial-notebook__entry" data-trial-entry={entry.number}>
                    <p className="trial-notebook__entry-title">試作 #{entry.number}</p>
                    {/* INV-D7 (OD-TQ1D-4): an attempt made without a sauce has NO sauce row (no 「ソース: なし」 chip). */}
                    {entry.combination.sauceBase.length > 0 && (
                      <div className="hint-sheet__row">
                        <span className="hint-sheet__row-label">{NOTEBOOK_COPY.sauce}</span>
                        <span className="hint-sheet__chips">
                          <IngredientChips ids={entry.combination.sauceBase} emptyText="" />
                        </span>
                      </div>
                    )}
                    <div className="hint-sheet__row">
                      <span className="hint-sheet__row-label">{NOTEBOOK_COPY.toppings}</span>
                      <span className="hint-sheet__chips">
                        <IngredientChips ids={toppings} emptyText={NOTEBOOK_COPY.noToppings} />
                      </span>
                    </div>
                    {diff && <DiffBlock diff={diff} />}
                    {retry && <p className="trial-notebook__retry">{"\u{1F501}"} {retry}</p>}
                    {entry.feedback && <p className="trial-notebook__feedback">{entry.feedback.textJa}</p>}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <p className="trial-notebook__session-note">{NOTEBOOK_COPY.sessionOnly}</p>
      </section>
    </div>
  );
}
