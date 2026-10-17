import { DEV_SETTINGS_LINK_LABEL, DEV_SETTINGS_SECTION_TITLE, DEV_STATE_EDITOR_QUERY } from "./marks";

/**
 * The settings overlay's 「開発・テスト」 section: a plain link to the existing DEV State Editor (`?dev=state`, src/main.tsx).
 * SettingsOverlay renders it only behind the static `import.meta.env.DEV || VITE_PREVIEW_MODE` check, so a production
 * build drops it (src/preview/previewIsolation.gate.test.ts). Navigation is a normal page load: it reads / writes nothing.
 */
export function DevEditorLink() {
  return (
    <section className="settings-overlay__section" data-testid="settings-dev-section">
      <h3 className="settings-overlay__section-title">{DEV_SETTINGS_SECTION_TITLE}</h3>
      <p className="settings-overlay__section-desc">
        Preview / DEV 専用です。材料の所持数や Pitz を編集できます。エディタの「ゲームへ戻る」でゲームに戻れます。
      </p>
      <a className="settings-overlay__dev-link" href={`${import.meta.env.BASE_URL}${DEV_STATE_EDITOR_QUERY}`}>
        {DEV_SETTINGS_LINK_LABEL}
      </a>
    </section>
  );
}
