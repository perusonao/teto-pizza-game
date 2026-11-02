/**
 * Cooking Sear Phase 1 (Issue #724): the long-press rule (pure). The PLAYER'S hand sets the amount -- the colour moves only while the finger is down and
 * the release keeps whatever it reached. There is no target window, no pass / fail, no time-out and no gauge; that is the difference from the 炒める prep
 * (../prep/panDoneness.ts), where the system's clock decides a best window.
 *
 *   amount (0..1) = held time / SEAR_FULL_MS, clamped. A hold shorter than SEAR_MIN_HOLD_MS is a tap: nothing is kept.
 *
 * The numbers are initial design values, tuned in the iPhone HV (one place, here).
 */

/** Held time at which the colour reaches its end. Past it the pan goes on holding the same (fully seared) look. */
export const SEAR_FULL_MS = 4000;
/** A hold shorter than this is a tap and keeps nothing (a stray touch must not mark the sausage). */
export const SEAR_MIN_HOLD_MS = 350;

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/** How seared it is after being held `heldMs` (non-finite / negative -> 0). */
export function searAmountAt(heldMs: number, fullMs: number = SEAR_FULL_MS): number {
  return clamp01(heldMs / fullMs);
}

/** Look names for the words after release and for the still-frame cues. Descriptive, never a grade: every one of them is a fine result. */
export type SearLook = "light" | "golden" | "deep" | "charred";

export function searLookOf(amount: number): SearLook {
  const a = clamp01(amount);
  if (a < 0.3) return "light";
  if (a < 0.62) return "golden";
  if (a < 0.9) return "deep";
  return "charred";
}

export const SEAR_LOOK_COPY: Record<SearLook, string> = {
  light: "ほんのり焼き目",
  golden: "こんがり焼き目",
  deep: "しっかり焼き目",
  charred: "まっくろ焦げ目",
};

export type SearHold =
  | { status: "idle"; tooShort?: boolean }
  | { status: "holding"; startedAt: number }
  | { status: "released"; amount: number; heldMs: number };

/** `fullMs` (RELEASE): the hold length that reaches the fully seared look; absent = SEAR_FULL_MS. Only the Preview / DEV comparison (?cookSearMs=) sets it. */
export type SearHoldAction = { type: "PRESS"; now: number } | { type: "RELEASE"; now: number; fullMs?: number } | { type: "CANCEL" };

export const SEAR_IDLE: SearHold = { status: "idle" };

/**
 * PRESS starts a hold (ignored unless idle); RELEASE ends it (a tap -> idle with `tooShort`, a hold -> released with the amount); CANCEL (the finger was
 * taken away by the system, the page lost focus, ×) drops everything and keeps nothing. A clock that runs backwards counts as a tap.
 */
export function searHoldReducer(state: SearHold, action: SearHoldAction): SearHold {
  switch (action.type) {
    case "PRESS":
      return state.status === "idle" && Number.isFinite(action.now) ? { status: "holding", startedAt: action.now } : state;
    case "RELEASE": {
      if (state.status !== "holding") return state;
      const heldMs = action.now - state.startedAt;
      if (!Number.isFinite(heldMs) || heldMs < SEAR_MIN_HOLD_MS) return { status: "idle", tooShort: true };
      return { status: "released", amount: searAmountAt(heldMs, action.fullMs), heldMs };
    }
    case "CANCEL":
      return SEAR_IDLE;
  }
}
