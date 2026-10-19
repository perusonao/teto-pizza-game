// Who may write the facts the Owner Gate trusts. The repository is public, so a comment that merely
// LOOKS like a Codex receipt or a session claim proves nothing: authorship is checked, never the text alone.

export const CODEX_LOGIN = "chatgpt-codex-connector[bot]";
export const TRUSTED_ASSOCIATIONS = new Set(["OWNER", "MEMBER", "COLLABORATOR"]);

/** GitHub REST comment/user shape: { user: { login, type }, author_association }. */
export function isCodexAuthor(comment) {
  return comment?.user?.login === CODEX_LOGIN && comment?.user?.type === "Bot";
}

/** Session claims are written by the Owner's account (sessions act as the Owner); outsiders are ignored. */
export function isTrustedAuthor(comment) {
  return TRUSTED_ASSOCIATIONS.has(comment?.author_association);
}
