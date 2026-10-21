import type { DoughKind } from "../logic/dough/doughKind";

/**
 * Dough Kind P2 (Issue #577): the DOUGH step's dough-kind chips. A separate radiogroup from `PanSwitch` (○/□); neither reads the other.
 *
 * Labels (Owner, 2026-10-20): the screen text and the aria-label are the same string. Before the dough technique is discovered the chips
 * read 「ふつうの生地」 / 「ほかの生地」 -- neutral, the same for every player whose chips are open. Once the technique is discovered the
 * second chip reads its name, 「ピンサ生地」, whether or not it is selected; merely selecting a chip never shows the name. The raw
 * dough-kind value and the technique id are never rendered (`data-dough-choice` is a neutral "plain" / "other").
 * Rendered by GameScreen only where `doughSwitchOffered` says so.
 */
export const DOUGH_CHIP_PLAIN_JA = "ふつうの生地";
export const DOUGH_CHIP_OTHER_JA = "ほかの生地";

export function DoughKindSwitch({
  selected,
  otherLabel,
  onSelect,
}: {
  selected: DoughKind;
  /** The second chip's text: the neutral 「ほかの生地」, or the technique's own name once it is discovered. */
  otherLabel: string;
  onSelect: (dough: DoughKind) => void;
}) {
  const options: { kind: DoughKind; choice: "plain" | "other"; label: string }[] = [
    { kind: "standard", choice: "plain", label: DOUGH_CHIP_PLAIN_JA },
    { kind: "material-multigrain-long-ferment", choice: "other", label: otherLabel },
  ];
  return (
    <div className="dough-kind-switch" role="radiogroup" aria-label="生地の種類" data-testid="dough-kind-switch">
      {options.map((o) => (
        <button
          key={o.choice}
          type="button"
          role="radio"
          aria-checked={selected === o.kind}
          aria-label={o.label}
          className="dough-kind-switch__option"
          data-dough-choice={o.choice}
          onClick={() => onSelect(o.kind)}
        >
          <span className={`dough-kind-switch__icon dough-kind-switch__icon--${o.choice}`} aria-hidden="true" />
          <span className="dough-kind-switch__label">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
