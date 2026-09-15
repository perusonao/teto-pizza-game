/**
 * Renders only when the build sets `VITE_PREVIEW_MODE` -- the production `vite build` (see
 * vite.config.ts) never sets it, so this component and its one caller in App.tsx compile out
 * to nothing observable in production; `import.meta.env.VITE_PREVIEW_MODE` being statically
 * false there lets Vite dead-code-eliminate the whole subtree.
 *
 * perusonao/teto-pizza-game-preview's deploy workflow is the only thing expected to set these
 * three `VITE_PREVIEW_*` build-time env vars, so a reviewer opening the preview URL can always
 * tell which source PR/commit they're looking at without it fighting for attention with the
 * game UI itself.
 */
export function PreviewBadge() {
  if (!import.meta.env.VITE_PREVIEW_MODE) return null;
  const pr = import.meta.env.VITE_PREVIEW_PR;
  const sha = import.meta.env.VITE_PREVIEW_SHA;
  return (
    <div className="preview-badge" aria-hidden="true">
      PREVIEW{pr ? ` · PR#${pr}` : ""}
      {sha ? ` · ${sha}` : ""}
    </div>
  );
}
