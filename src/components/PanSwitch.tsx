import type { PanChoice } from "../state/panSelection";

/**
 * Square Dough F4-b (Issue #538): the DOUGH step's ○/□ switch. Shapes only -- no technique name, recipe name or hint -- so what it
 * shows is the same for every player whose switch is open (Anti-Oracle). Two 44px radio targets; the chosen one is `aria-checked`.
 * Rendered by GameScreen only where `panSwitchOffered` says so.
 */
export function PanSwitch({ selected, onSelect }: { selected: PanChoice; onSelect: (pan: PanChoice) => void }) {
  return (
    <div className="pan-switch" role="radiogroup" aria-label="生地の形" data-testid="pan-switch">
      <button
        type="button"
        role="radio"
        aria-checked={selected === "round"}
        aria-label="丸い生地"
        className="pan-switch__option"
        data-pan="round"
        onClick={() => onSelect("round")}
      >
        <span className="pan-switch__icon pan-switch__icon--round" aria-hidden="true" />
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={selected === "tray"}
        aria-label="四角い生地"
        className="pan-switch__option"
        data-pan="tray"
        onClick={() => onSelect("tray")}
      >
        <span className="pan-switch__icon pan-switch__icon--square" aria-hidden="true" />
      </button>
    </div>
  );
}
