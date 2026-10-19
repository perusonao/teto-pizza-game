import { useCallback, useEffect, useRef, useState } from "react";
import type { ResetSaveResult } from "../state/persistence";
import type { SaveHealth, SaveNotice } from "../state/saveHealth";
import { DevEditorLink } from "../devtools/DevEditorLink";
import { getMyProfile, FALLBACK_DISPLAY_NAME, setDisplayName as callSetDisplayName } from "../firebase";
import {
  DisplayNameValidationError,
  normalizeAndValidateDisplayName,
} from "../shared/displayNameValidation";

/**
 * Settings overlay (Issue #89 Reset 1A; Player Profile 1.0 Phase 1A, Issue #129, added the
 * "プレイヤー名" section). HOME's ⚙️ button was decorative until now (no settings existed to
 * open -- see HomeScreen.tsx's own former doc comment); this is the first thing it opens, and
 * today it holds Full Game Reset plus the player's own display name. Follows the same shell
 * (`dex-overlay`/`dex-overlay__panel`) DexOverlay/ShopOverlay/InventoryOverlay already use, so
 * it stacks, sizes, and dismisses identically to every other HOME overlay -- no new overlay
 * convention is invented here.
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
 *
 * The player-name section instead reads/writes Firebase directly through `../firebase`
 * (`getMyProfile`/`setDisplayName`), matching WeeklyRankingOverlay's own "overlays call
 * `../firebase` directly, no prop-drilled Firebase access" precedent -- unlike Full Game Reset,
 * this has nothing to do with local save and needs no App.tsx seam. Full Game Reset itself is
 * untouched by Player Profile 1.0: it clears only `PersistentSaveV2` (local save), never the
 * player's Firebase profile (design doc section 9) -- Firebase profile deletion is explicitly
 * out of Phase 1A's scope.
 */

interface SettingsOverlayProps {
  onClose: () => void;
  /** Performs the real reset (clearSave + verify + reload) and reports success. A `false`
   *  return means storage removal could not be verified -- the overlay shows an error and
   *  lets the player retry instead of pretending the reset (and the reload that would follow
   *  it) happened. */
  onResetGameData: () => boolean | ResetSaveResult;
  /** Save Protection PR-2 (#560): the state of the save, read from storage by App. Absent = a healthy save and no backup
   *  (every pre-PR-2 call site). */
  saveHealth?: SaveHealth;
  /** Deletes the quarantined (backed-up) data and reports whether it is verifiably gone. Wired ONLY to the separate
   *  「バックアップを削除」 confirmation below; Full Game Reset never calls it. */
  onDiscardQuarantine?: () => boolean;
}

type ResetFailureReason = Extract<ResetSaveResult, { ok: false }>["reason"];

/** The reset dialog's lead paragraph: what happens to the player's CURRENT data, which depends on what the save is. */
function resetBody(notice: SaveNotice | null): string {
  if (notice?.kind === "future-version") {
    return "この端末には、新しいバージョンで保存されたデータがあります。リセットしても、そのデータは削除されず端末内に退避され、はじめからやり直します。";
  }
  if (notice?.kind === "corrupt") {
    return "この端末の保存データは壊れていて読み込めません。リセットしても、そのデータは削除されず端末内に退避され、はじめからやり直します。";
  }
  return "Pitz・材料・レシピ解放・ピザ図鑑・ベスト記録など、すべての進行状況を最初からやり直します。";
}

function resetFailureMessage(reason: ResetFailureReason | null): string {
  switch (reason) {
    case "quarantine-failed":
      return "データを退避できなかったため、守るためにリセットしませんでした。データはそのまま残っています。";
    case "quarantine-too-large":
      return "データが大きすぎて退避できないため、守るためにリセットしませんでした。データはそのまま残っています。";
    case "storage-error":
      return "保存先を読み取れないため、リセットしませんでした。";
    default:
      return "リセットに失敗しました。もう一度お試しください。";
  }
}

type ProfileLoadState =
  | { phase: "loading" }
  | { phase: "unavailable" }
  | { phase: "error" }
  /** `displayName: null` means no `users/{uid}` document exists yet -- a normal, permanent
   *  state (design doc section 2.3), rendered with the fallback name as placeholder text. */
  | { phase: "loaded"; displayName: string | null };

type SaveState =
  | { phase: "idle" }
  | { phase: "saving" }
  | { phase: "success" }
  | { phase: "validation-error"; message: string }
  | { phase: "cooldown" }
  | { phase: "error" };

/** Client-side pre-check only, for immediate feedback -- the server (`setDisplayName` Cloud
 *  Function) independently re-validates every call and is the sole security authority (design
 *  doc section 4's own "client validationを追加してもよいが、security authorityにはしない").
 *  Each code maps to its own Japanese message, mirroring the validation module's own
 *  "distinct, deterministic branch per rejection" contract. */
function describeValidationError(code: DisplayNameValidationError["code"]): string {
  switch (code) {
    case "not-a-string":
    case "too-long-raw":
      return "入力が長すぎます。";
    case "empty":
      return "名前を入力してください。";
    case "too-long":
      return "名前は20文字以内で入力してください。";
    case "control-characters":
    case "invisible-characters":
      return "使用できない文字が含まれています。";
    case "emoji":
      return "絵文字は使用できません。";
    case "reserved":
      return "その名前は使用できません。";
    default:
      return "入力内容を確認してください。";
  }
}

export function SettingsOverlay({ onClose, onResetGameData, saveHealth, onDiscardQuarantine }: SettingsOverlayProps) {
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [isResetting, setResetting] = useState(false);
  const [resetFailed, setResetFailed] = useState(false);
  const [resetFailureReason, setResetFailureReason] = useState<ResetFailureReason | null>(null);
  const notice = saveHealth?.notice ?? null;
  const hasBackup = (saveHealth?.quarantineCount ?? 0) > 0;
  // Deleting the backup: its own two-step confirmation (dialog + an explicit acknowledgement), never part of Reset.
  const [isDiscardOpen, setDiscardOpen] = useState(false);
  const [discardAcknowledged, setDiscardAcknowledged] = useState(false);
  const [discardFailed, setDiscardFailed] = useState(false);
  const [discardDone, setDiscardDone] = useState(false);
  // Synchronous double-tap guard: two rapid clicks can both fire before React re-renders with
  // `isResetting`/`disabled` applied, so a plain state check alone isn't enough.
  const resetInFlightRef = useRef(false);

  const [profileState, setProfileState] = useState<ProfileLoadState>({ phase: "loading" });
  const [nameInput, setNameInput] = useState("");
  const [saveState, setSaveState] = useState<SaveState>({ phase: "idle" });
  // Same synchronous double-tap guard pattern as `resetInFlightRef` above.
  const saveInFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void getMyProfile().then((result) => {
      if (cancelled) return;
      if (result.status === "unavailable") {
        setProfileState({ phase: "unavailable" });
      } else if (result.status === "error") {
        setProfileState({ phase: "error" });
      } else {
        const displayName = result.profile?.displayName ?? null;
        setProfileState({ phase: "loaded", displayName });
        setNameInput(displayName ?? "");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleNameInputChange = useCallback((value: string) => {
    setNameInput(value);
    setSaveState((current) => (current.phase === "idle" ? current : { phase: "idle" }));
  }, []);

  const handleSaveName = useCallback(async () => {
    if (saveInFlightRef.current) return;

    let normalized: string;
    try {
      normalized = normalizeAndValidateDisplayName(nameInput);
    } catch (error) {
      if (error instanceof DisplayNameValidationError) {
        setSaveState({ phase: "validation-error", message: describeValidationError(error.code) });
        return;
      }
      throw error;
    }

    saveInFlightRef.current = true;
    setSaveState({ phase: "saving" });
    const result = await callSetDisplayName({ displayName: normalized });
    saveInFlightRef.current = false;

    if (result.status === "success") {
      setNameInput(result.displayName);
      setProfileState({ phase: "loaded", displayName: result.displayName });
      setSaveState({ phase: "success" });
    } else if (result.status === "invalid-argument") {
      // The server independently re-validated and rejected -- shown generically (its own
      // message is English/debug-oriented, never surfaced verbatim to the player) since the
      // client-side pre-check above already covers every Phase 1A rejection case.
      setSaveState({ phase: "validation-error", message: "入力内容を確認してください。" });
    } else if (result.status === "cooldown") {
      setSaveState({ phase: "cooldown" });
    } else {
      setSaveState({ phase: "error" });
    }
  }, [nameInput]);

  function openDiscard() {
    setDiscardAcknowledged(false);
    setDiscardFailed(false);
    setDiscardOpen(true);
  }

  function cancelDiscard() {
    setDiscardOpen(false);
  }

  function confirmDiscard() {
    if (!discardAcknowledged || !onDiscardQuarantine) return;
    if (onDiscardQuarantine()) {
      setDiscardOpen(false);
      setDiscardDone(true);
    } else {
      setDiscardFailed(true);
    }
  }

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
    const outcome = onResetGameData();
    const succeeded = typeof outcome === "boolean" ? outcome : outcome.ok;
    if (!succeeded) {
      resetInFlightRef.current = false;
      setResetting(false);
      setResetFailureReason(typeof outcome === "boolean" || outcome.ok ? null : outcome.reason);
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
            <h3 className="settings-overlay__section-title">プレイヤー名</h3>
            {profileState.phase === "unavailable" ? (
              <p className="settings-overlay__profile-status" role="status">
                オフラインのためプレイヤー名機能を利用できません。
              </p>
            ) : (
              <>
                <p className="settings-overlay__section-desc">
                  ランキングなどで表示される名前です。（表示は今後のアップデートで追加されます）
                </p>
                <label className="settings-overlay__profile-label" htmlFor="settings-profile-name-input">
                  現在の名前
                </label>
                <div className="settings-overlay__profile-row">
                  <input
                    id="settings-profile-name-input"
                    type="text"
                    className="settings-overlay__profile-input"
                    value={nameInput}
                    placeholder={
                      profileState.phase === "loaded" && profileState.displayName === null
                        ? FALLBACK_DISPLAY_NAME
                        : undefined
                    }
                    onChange={(event) => handleNameInputChange(event.target.value)}
                    disabled={profileState.phase === "loading" || saveState.phase === "saving"}
                  />
                  <button
                    type="button"
                    className="settings-overlay__profile-save"
                    onClick={() => void handleSaveName()}
                    disabled={profileState.phase === "loading" || saveState.phase === "saving"}
                  >
                    {saveState.phase === "saving" ? "保存中…" : "保存"}
                  </button>
                </div>

                {profileState.phase === "loading" && (
                  <p className="settings-overlay__profile-status" role="status">
                    読み込み中…
                  </p>
                )}
                {profileState.phase === "error" && (
                  <p className="settings-overlay__profile-status" role="alert">
                    名前の読み込みに失敗しました。
                  </p>
                )}
                {saveState.phase === "success" && (
                  <p
                    className="settings-overlay__profile-status settings-overlay__profile-status--success"
                    role="status"
                  >
                    保存しました。
                  </p>
                )}
                {saveState.phase === "validation-error" && (
                  <p className="settings-overlay__profile-status" role="alert">
                    {saveState.message}
                  </p>
                )}
                {saveState.phase === "cooldown" && (
                  <p className="settings-overlay__profile-status" role="alert">
                    しばらく時間をおいてから変更してください（変更は60秒に1回までです）。
                  </p>
                )}
                {saveState.phase === "error" && (
                  <p className="settings-overlay__profile-status" role="alert">
                    保存に失敗しました。もう一度お試しください。
                  </p>
                )}
              </>
            )}
          </section>

          <section className="settings-overlay__section">
            <h3 className="settings-overlay__section-title">ゲームデータ</h3>
            <p className="settings-overlay__section-desc">
              Pitz・材料・レシピ解放・ピザ図鑑・ベスト記録など、すべての進行状況を削除し、はじめからやり直します。
            </p>
            <button type="button" className="settings-overlay__reset-trigger" onClick={openConfirm}>
              ゲームデータをリセット
            </button>
          </section>

          {(hasBackup || discardDone) && onDiscardQuarantine && (
            <section className="settings-overlay__section" data-testid="settings-backup-section">
              <h3 className="settings-overlay__section-title">退避データ</h3>
              {hasBackup ? (
                <>
                  <p className="settings-overlay__section-desc">
                    読み込めなかった保存データを、消さずに端末内へ退避してあります。リセットしても、この退避データは削除されません。
                    削除すると元に戻せません。
                  </p>
                  <button type="button" className="settings-overlay__reset-trigger" onClick={openDiscard}>
                    退避データを削除…
                  </button>
                </>
              ) : (
                <p className="settings-overlay__section-desc" role="status">
                  退避データを削除しました。
                </p>
              )}
            </section>
          )}

          {(import.meta.env.DEV || import.meta.env.VITE_PREVIEW_MODE) && <DevEditorLink />}
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
              {resetBody(notice)}
            </p>
            {hasBackup && (
              <p className="settings-reset-confirm__body">退避データは、リセットしても削除されません。</p>
            )}

            {resetFailed && (
              <p className="settings-reset-confirm__error" role="alert">
                {resetFailureMessage(resetFailureReason)}
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

      {isDiscardOpen && (
        <div className="settings-reset-confirm">
          <div
            className="settings-reset-confirm__panel"
            role="alertdialog"
            aria-labelledby="settings-discard-confirm-title"
            aria-describedby="settings-discard-confirm-body"
          >
            <h2 id="settings-discard-confirm-title" className="settings-reset-confirm__title">
              退避データを削除しますか？
            </h2>
            <p id="settings-discard-confirm-body" className="settings-reset-confirm__body">
              退避してある保存データを端末から完全に削除します。削除すると、そのデータを取り戻す方法はなくなります。
              今のゲームの進行状況は変わりません。
            </p>
            <label className="settings-reset-confirm__check">
              <input
                type="checkbox"
                checked={discardAcknowledged}
                onChange={(event) => setDiscardAcknowledged(event.target.checked)}
              />
              <span>元に戻せないことを理解しました</span>
            </label>

            {discardFailed && (
              <p className="settings-reset-confirm__error" role="alert">
                削除を確認できませんでした。もう一度お試しください。
              </p>
            )}

            <div className="settings-reset-confirm__actions">
              <button type="button" className="settings-reset-confirm__cancel" onClick={cancelDiscard}>
                キャンセル
              </button>
              <button
                type="button"
                className="settings-reset-confirm__confirm"
                onClick={confirmDiscard}
                disabled={!discardAcknowledged}
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
