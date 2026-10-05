import { useState } from "react";

/**
 * A small non-negative integer field. It keeps what is typed (so clearing a field to retype it works) and
 * commits only a valid whole number; losing focus restores the committed value.
 */
export function NumberField({ label, value, onCommit, disabled, className }: { label: string; value: number; onCommit: (n: number) => void; disabled?: boolean; className?: string }) {
  const [text, setText] = useState(String(value));
  // Follow the committed value when it changes from outside (a preset, a +/- button): state derived while rendering.
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setText(String(value));
  }
  const valid = /^\d{1,9}$/.test(text);
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      className={`dse-input${className ? ` ${className}` : ""}`}
      aria-label={label}
      aria-invalid={!valid}
      disabled={disabled}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        if (/^\d{1,9}$/.test(e.target.value)) onCommit(Number(e.target.value));
      }}
      onBlur={() => setText(String(value))}
    />
  );
}
