/**
 * Player Profile 1.0 Phase 1A (Issue #129). The `displayName` validation contract from
 * docs/design/TETO_PLAYER-PROFILE_1.0.md section 3, deliberately framework/Firebase-free (no
 * `firebase/*`, no `firebase-admin`) so both sides can import it verbatim with zero adapter
 * code -- ../../functions/src/setDisplayName.ts bundles this exact file in as the actual
 * security authority, and src/components/SettingsOverlay.tsx imports it too, purely for
 * immediate UX feedback (never as a security boundary -- the server always re-validates every
 * call independently). This mirrors ./lunchRushScoring.ts's own client/server dual-import
 * precedent exactly.
 */

/** Player Profile 1.0 Phase 1B (Issue #129). Every reader of a player's name -- Settings' own
 *  current-name display (Phase 1A) and the weekly ranking's denormalized snapshot (Phase 1B,
 *  functions/src/submitLunchRushScore.ts + src/firebase/getWeeklyLeaderboard.ts) -- falls back
 *  to this exact string for a player with no `users/{uid}` document, an empty/missing
 *  `displayName`, or (defensively, on the ranking read path) a legacy/malformed value that no
 *  longer passes this file's own validation contract. Lives here (not src/firebase/) so
 *  functions/src/submitLunchRushScore.ts can import it without pulling in any Firebase SDK, the
 *  same reason the validation contract itself lives here. */
export const FALLBACK_DISPLAY_NAME = "ななしピザ職人";

export const DISPLAY_NAME_MIN_CODEPOINTS = 1;
export const DISPLAY_NAME_MAX_CODEPOINTS = 20;
/** A cheap bound on the raw, unnormalized input, checked before any other (more expensive)
 *  processing -- mirrors ../../functions/src/submitLunchRushScore.ts's own
 *  `MAX_SERVES_ARRAY_LENGTH` "cheap bound first" pattern. Measured in UTF-16 code units
 *  (`string.length`), not Unicode codepoints. */
export const DISPLAY_NAME_RAW_MAX_UTF16_LENGTH = 200;

export type DisplayNameValidationErrorCode =
  | "not-a-string"
  | "too-long-raw"
  | "empty"
  | "too-long"
  | "control-characters"
  | "invisible-characters"
  | "emoji"
  | "reserved";

export class DisplayNameValidationError extends Error {
  readonly code: DisplayNameValidationErrorCode;

  constructor(code: DisplayNameValidationErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "DisplayNameValidationError";
  }
}

function invalid(code: DisplayNameValidationErrorCode, message: string): never {
  throw new DisplayNameValidationError(code, message);
}

// U+0000-001F, U+007F-009F -- includes every line-break codepoint (\n, \r, ...), so no
// separate line-break rule is needed.
// eslint-disable-next-line no-control-regex -- matching control characters is the point here.
const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F-\u009F]/;
// Unicode General Category "Format" (Cf) -- covers zero-width space (U+200B), zero-width
// non-joiner/joiner (U+200C/U+200D), the byte-order-mark (U+FEFF), and every other invisible
// format character in one rule, rather than an explicit codepoint list.
const FORMAT_CHAR_PATTERN = /\p{Cf}/u;
// Unicode's own emoji-presentation property -- deliberately broad (Phase 1 rejects all
// emoji/pictographic symbols outright, see the design doc's own rationale).
const EMOJI_PATTERN = /\p{Extended_Pictographic}/u;
const WHITESPACE_RUN_PATTERN = /\p{White_Space}+/gu;

/** Exact strings `あなた`/`Anata`/`You` -- case-insensitive on the ASCII variants (Japanese has
 *  no case, so `あなた` needs no folding of its own). This is the own-row badge text
 *  WeeklyRankingOverlay renders (Phase 1B), so a player literally named this would be
 *  indistinguishable from the badge on someone else's screen. */
const RESERVED_NAMES = new Set(["あなた", "anata", "you"]);

/**
 * Normalizes and validates a raw `displayName` input per the Phase 1A contract, returning the
 * accepted, normalized string or throwing `DisplayNameValidationError`. Every rejection is a
 * distinct, deterministic branch (Issue #129's own "無効な名前は決定的に拒否される"
 * requirement) -- callers should treat each `DisplayNameValidationErrorCode` as its own
 * user-facing case rather than a single generic "invalid" message.
 */
export function normalizeAndValidateDisplayName(raw: unknown): string {
  if (typeof raw !== "string") {
    invalid("not-a-string", "displayName must be a string.");
  }
  if (raw.length > DISPLAY_NAME_RAW_MAX_UTF16_LENGTH) {
    invalid("too-long-raw", "displayName is too long.");
  }

  // Control/format/emoji rejection runs on the *raw* input, before trimming -- `String.
  // prototype.trim()` follows ECMAScript's own WhiteSpace production, which (unlike Unicode's
  // White_Space property) explicitly treats U+FEFF (ZWNBSP) as trimmable whitespace. Checking
  // after trim would let a leading/trailing U+FEFF silently disappear instead of being
  // rejected -- these are hard rejects regardless of position (leading, trailing, or
  // internal), so they must be checked before anything can strip or launder them.
  if (CONTROL_CHAR_PATTERN.test(raw)) {
    invalid("control-characters", "displayName contains control characters.");
  }
  if (FORMAT_CHAR_PATTERN.test(raw)) {
    invalid("invisible-characters", "displayName contains invisible/format characters.");
  }
  if (EMOJI_PATTERN.test(raw)) {
    invalid("emoji", "displayName must not contain emoji.");
  }

  const trimmed = raw.trim();
  const normalized = trimmed.replace(WHITESPACE_RUN_PATTERN, " ");

  if (normalized.length === 0) {
    invalid("empty", "displayName must not be empty.");
  }

  const codepointLength = Array.from(normalized).length;
  if (codepointLength < DISPLAY_NAME_MIN_CODEPOINTS || codepointLength > DISPLAY_NAME_MAX_CODEPOINTS) {
    invalid(
      "too-long",
      `displayName must be between ${DISPLAY_NAME_MIN_CODEPOINTS} and ${DISPLAY_NAME_MAX_CODEPOINTS} characters.`,
    );
  }

  if (RESERVED_NAMES.has(normalized.toLowerCase())) {
    invalid("reserved", "displayName is reserved.");
  }

  return normalized;
}
