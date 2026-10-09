// #422 PR-A: display copy for AnonymousLockFrame (kept out of the component file for fast refresh).

/** The fixed, recipe-agnostic hint lines a locked slot may show (closed set -- never a name). */
export const ANONYMOUS_LOCK_HINTS = {
  /** An undiscovered slot with nothing special to say. */
  UNKNOWN: "まだ見ぬピザ",
  /** Cookable now from owned ingredients (Dex 🎨 tag). */
  DISCOVERABLE: "\u{1F3A8} 今の材料で作れるかも",
  /** Cookable once the Shop's materials are bought (Dex 🏪 tag). */
  SHOP: "\u{1F3EA} ショップの材料で作れるかも",
  /** The D-2 aggregated card: there is still a pizza to find, no number, no slot. */
  AGGREGATED: "\u{1F3A8} まだ発見できるピザがあるよ",
} as const;

export type AnonymousLockHint = (typeof ANONYMOUS_LOCK_HINTS)[keyof typeof ANONYMOUS_LOCK_HINTS];
