import { useRef, useState } from "react";

/**
 * Settings overlay (Issue #89 Reset 1A). HOME's ⚙️ button was decorative until now (no
 * settings existed to open -- see HomeScreen.tsx's own former doc comment); this is the
 * first thing it opens, and today it holds exactly one control: Full Game Reset. Follows the
 * same shell (`dex-overlay`/`dex-overlay__panel`) DexOverlay/ShopOverlay/InventoryOverlay
 * already use, so it stacks, sizes, and dismisses identically to every other HOME overlay --
 * no new overlay convention is invented here.
 *
 * The reset flow itself is a two-stage confirmation (trigger -> modal -> confirm), per #89's
 * own required copy and safety properties: cancel never mutates anything, the backdrop has no
 * click handler at all (matching this codebase's existing overlay convention -- see
 * `.dex-overlay` in App.css -- so an outside tap can neither close *nor* confirm), and the
 * destructive button disables itself the instant it's pressed (`resetInFlightRef` blocks a
 * second call synchronously, before React even re-renders with `isResetting`) so a double-tap
 * can never fire two resets. `onResetGameData` is the one seam into App.tsx's actual
 * `clearSave()` + reload call -- this component has no `localStorage`/`window` access of its
 * own, mirroring InventoryOverlay's "props in, no direct side effects" discipline.
 */

interface SettingsOverlayProps {
  onClose: () => void;
  /** Performs the real reset (clearSave + verify + reload) and reports success. A `false`
   *  return means storage removal could not be verified -- the overlay shows an error and
   *  lets the player retry instead of pretending the reset (and the reload that would follow
   *  it) happened. */
  onResetGameData: () => boolean;
}

export function SettingsOverlay({ onClose, onResetGameData }: SettingsOverlayProps) {
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [isResetting, setResetting] = useState(false);
  const [resetFailed, setResetFailed] = useState(false);
  // Synchronous double-tap guard: two rapid clicks can both fire before React re-renders with
  // `isResetting`/`disabled` applied, so a plain state check alone isn't enough.
  const resetInFlightRef = useRef(false);

  function openConfirm() {
    setResetFailed(false);
    setConfirmOpen(true);
  }

  function cancelConfirm() {
    if (isResetting) return;
    setConfirmOpen(false);
    setResetFailed(false);
  }

  function confirmReset() {
    if (resetInFlightRef.current) return;
    resetInFlightRef.current = true;
    setResetting(true);
    setResetFailed(false);
    const succeeded = onResetGameData();
    if (!succeeded) {
      resetInFlightRef.current = false;
      setResetting(false);
      setResetFailed(true);
    }
    // On success a full reload is already in flight (App.tsx's onResetGameData), so this
    // component is about to be torn down -- no further local state change is needed.
  }

  return (
    <div className="dex-overlay">
      <div className="dex-overlay__panel settings-overlay__panel">
        <div className="dex-overlay__header">
          <h2>{"⚙️"} 設定</h2>
          <button type="button" className="dex-overlay__close" onClick={onClose}>
            閉じる
          </button>
        </div>

        <div className="dex-overlay__body">
          <section className="settings-overlay__section">
            <h3 className="settings-overlay__section-title">ゲームデータ</h3>
            <p className="settings-overlay__section-desc">
              Pitz・材料・レシピ解放・ピザ図鑑・ベスト記録など、すべての進行状況を削除し、はじめからやり直します。
            </p>
            <button type="button" className="settings-overlay__reset-trigger" onClick={openConfirm}>
              ゲームデータをリセット
            </button>
          </section>
        </div>
      </div>

      {isConfirmOpen && (
        <div className="settings-reset-confirm">
          <div
            className="settings-reset-confirm__panel"
            role="alertdialog"
            aria-labelledby="settings-reset-confirm-title"
            aria-describedby="settings-reset-confirm-body"
          >
            <h2 id="settings-reset-confirm-title" className="settings-reset-confirm__title">
              ゲームデータをリセットしますか？
            </h2>
            <p id="settings-reset-confirm-body" className="settings-reset-confirm__body">
              Pitz・材料・レシピ解放・ピザ図鑑・ベスト記録など、
              すべての進行状況を最初からやり直します。
            </p>

            {resetFailed && (
              <p className="settings-reset-confirm__error" role="alert">
                リセットに失敗しました。もう一度お試しください。
              </p>
            )}

            <div className="settings-reset-confirm__actions">
              <button
                type="button"
                className="settings-reset-confirm__cancel"
                onClick={cancelConfirm}
                disabled={isResetting}
              >
                キャンセル
              </button>
              <button
                type="button"
                className="settings-reset-confirm__confirm"
                onClick={confirmReset}
                disabled={isResetting}
              >
                {isResetting ? "リセット中…" : "最初からやり直す"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
