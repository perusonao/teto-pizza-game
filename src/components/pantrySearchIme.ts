/**
 * Large Catalog UX LC-R5-b (pure): the pantry search field's IME contract (PreAudit §18.5).
 *
 * The field keeps two strings: `value` (what the input shows, including an unconfirmed IME composition) and
 * `applied` (what the list is filtered by). While a composition is in progress `applied` is NOT updated, so the
 * list keeps its previous result and never flashes an empty state for an intermediate string such as 「たまねき」
 * or a kanji candidate. `compositionend` applies the confirmed string; applying it again from the input event
 * that follows (Safari orders `compositionend` and `input` the other way round) is idempotent. Input that is not
 * part of a composition (paste, delete, latin, clear, dictation) applies immediately. A composition that is cut
 * short by a blur / close is settled by `onBlur`, so the flag can never stick.
 *
 * Nothing here reads the DOM, timers or storage; the search text is never persisted, logged or dispatched.
 */
export interface SearchInputState {
  value: string;
  applied: string;
  composing: boolean;
}

export const INITIAL_SEARCH_INPUT: SearchInputState = { value: "", applied: "", composing: false };

/** An `input` event. `isComposing` is the event's own flag (Chromium / Safari set it during a composition). */
export function onSearchInput(state: SearchInputState, value: string, eventIsComposing: boolean): SearchInputState {
  const composing = state.composing || eventIsComposing;
  return composing ? { ...state, value } : { value, applied: value, composing: false };
}

export function onSearchCompositionStart(state: SearchInputState): SearchInputState {
  return { ...state, composing: true };
}

/** `compositionend`: settle with the confirmed string (idempotent with a following `input`). */
export function onSearchCompositionEnd(_state: SearchInputState, value: string): SearchInputState {
  return { value, applied: value, composing: false };
}

/** A blur (or close) settles an interrupted composition with whatever the field currently shows. */
export function onSearchBlur(state: SearchInputState): SearchInputState {
  return state.composing ? { value: state.value, applied: state.value, composing: false } : state;
}

/** ✕: clears immediately, whatever the composition state was. */
export function onSearchClear(): SearchInputState {
  return INITIAL_SEARCH_INPUT;
}

/** Safari fires `compositionend` before the confirming Enter's keydown, which then reports `isComposing === false`
 *  and `keyCode === 229`; both are covered, plus a short window after the end of a composition. */
export const CONFIRM_ENTER_WINDOW_MS = 50;

export function isConfirmEnter(input: {
  eventIsComposing: boolean;
  keyCode: number;
  composing: boolean;
  msSinceCompositionEnd: number | null;
}): boolean {
  return (
    input.eventIsComposing ||
    input.keyCode === 229 ||
    input.composing ||
    (input.msSinceCompositionEnd !== null && input.msSinceCompositionEnd >= 0 && input.msSinceCompositionEnd < CONFIRM_ENTER_WINDOW_MS)
  );
}
