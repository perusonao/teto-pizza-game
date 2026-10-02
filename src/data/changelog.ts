/**
 * Player-facing 更新情報 (changelog). Static, data-driven: a future release adds ONE entry at the
 * FRONT of `CHANGELOG` (newest first) and nothing else changes. Nothing here is persisted, read
 * from or written to the save -- the overlay is a pure view over this list.
 *
 * Version authority: the repo has none (package.json is the unused `0.0.0` scaffold, no release
 * tags), so `version` / `date` are optional and are NOT invented. Set them only once a real
 * release label / date exists; the overlay hides whichever is absent.
 *
 * Copy rule: player wording only -- no PR/Issue numbers, SHAs, phase names, internal state names.
 */
export interface ChangelogEntry {
  /** Official release label, if one exists. Omitted rather than guessed. */
  version?: string;
  /** Release date as shown to players (e.g. "2026年10月3日"), if one exists. */
  date?: string;
  title: string;
  changes: readonly string[];
}

export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    title: "レシピ発見アップデート",
    changes: [
      "「レシピ発見」が新しくなりました",
      "新しい食材から、図鑑に「研究中のピザ」が見つかるようになりました",
      "研究するピザを選んで試作できるようになりました",
      "試作ノートで、作ったピザを振り返れるようになりました",
      "ヒントから、レシピの手がかりを集められるようになりました",
      "発見したピザは図鑑に登録されます",
    ],
  },
];
