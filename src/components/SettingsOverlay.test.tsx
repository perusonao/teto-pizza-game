import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { GetMyProfileResult, SetDisplayNameResult } from "../firebase";

const getMyProfile = vi.fn<() => Promise<GetMyProfileResult>>();
const setDisplayName = vi.fn<(input: { displayName: string }) => Promise<SetDisplayNameResult>>();

vi.mock("../firebase", () => ({
  getMyProfile: () => getMyProfile(),
  setDisplayName: (input: { displayName: string }) => setDisplayName(input),
  FALLBACK_DISPLAY_NAME: "ななしピザ職人",
}));

afterEach(() => {
  cleanup();
  getMyProfile.mockReset();
  setDisplayName.mockReset();
});

async function renderOverlay() {
  const { SettingsOverlay } = await import("./SettingsOverlay");
  const onClose = vi.fn();
  const onResetGameData = vi.fn(() => true);
  render(<SettingsOverlay onClose={onClose} onResetGameData={onResetGameData} />);
  return { onClose, onResetGameData };
}

describe("SettingsOverlay -- プレイヤー名", () => {
  it("loading: shows a loading status before the profile fetch resolves", async () => {
    let resolveFetch!: (value: GetMyProfileResult) => void;
    getMyProfile.mockReturnValue(new Promise((resolve) => (resolveFetch = resolve)));
    await renderOverlay();
    expect(screen.getByText("読み込み中…")).toBeInTheDocument();
    resolveFetch({ status: "success", profile: null });
  });

  it("fallback: shows the fallback name as placeholder text when no profile exists", async () => {
    getMyProfile.mockResolvedValue({ status: "success", profile: null });
    await renderOverlay();
    await waitFor(() =>
      expect(screen.getByPlaceholderText("ななしピザ職人")).toBeInTheDocument(),
    );
    expect(screen.getByLabelText("現在の名前")).toHaveValue("");
  });

  it("existing name: pre-fills the input with the current profile's displayName", async () => {
    getMyProfile.mockResolvedValue({ status: "success", profile: { displayName: "Alice" } });
    await renderOverlay();
    await waitFor(() => expect(screen.getByLabelText("現在の名前")).toHaveValue("Alice"));
  });

  it("Firebase unavailable: shows an offline message instead of the input", async () => {
    getMyProfile.mockResolvedValue({ status: "unavailable" });
    await renderOverlay();
    await waitFor(() =>
      expect(screen.getByText("オフラインのためプレイヤー名機能を利用できません。")).toBeInTheDocument(),
    );
    expect(screen.queryByLabelText("現在の名前")).not.toBeInTheDocument();
  });

  it("save / success: saving a new name calls setDisplayName and shows the accepted name", async () => {
    const user = userEvent.setup();
    getMyProfile.mockResolvedValue({ status: "success", profile: null });
    setDisplayName.mockResolvedValue({ status: "success", displayName: "Alice" });
    await renderOverlay();

    const input = await screen.findByLabelText("現在の名前");
    await user.type(input, "Alice");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(screen.getByText("保存しました。")).toBeInTheDocument());
    expect(setDisplayName).toHaveBeenCalledWith({ displayName: "Alice" });
    expect(input).toHaveValue("Alice");
  });

  it("save button disables itself while a save is in flight (double-submit guard)", async () => {
    const user = userEvent.setup();
    getMyProfile.mockResolvedValue({ status: "success", profile: null });
    let resolveSave!: (value: SetDisplayNameResult) => void;
    setDisplayName.mockReturnValue(new Promise((resolve) => (resolveSave = resolve)));
    await renderOverlay();

    const input = await screen.findByLabelText("現在の名前");
    await user.type(input, "Alice");
    const saveButton = screen.getByRole("button", { name: "保存" });
    await user.click(saveButton);

    expect(screen.getByRole("button", { name: "保存中…" })).toBeDisabled();
    expect(setDisplayName).toHaveBeenCalledTimes(1);
    resolveSave({ status: "success", displayName: "Alice" });
    await waitFor(() => expect(screen.getByText("保存しました。")).toBeInTheDocument());
  });

  it("validation error (client-side pre-check): an empty name is rejected without calling setDisplayName", async () => {
    const user = userEvent.setup();
    getMyProfile.mockResolvedValue({ status: "success", profile: { displayName: "Alice" } });
    await renderOverlay();

    const input = await screen.findByLabelText("現在の名前");
    await user.clear(input);
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(screen.getByText("名前を入力してください。")).toBeInTheDocument());
    expect(setDisplayName).not.toHaveBeenCalled();
  });

  it("validation error (client-side pre-check): a reserved name is rejected without calling setDisplayName", async () => {
    const user = userEvent.setup();
    getMyProfile.mockResolvedValue({ status: "success", profile: null });
    await renderOverlay();

    const input = await screen.findByLabelText("現在の名前");
    await user.type(input, "あなた");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(screen.getByText("その名前は使用できません。")).toBeInTheDocument());
    expect(setDisplayName).not.toHaveBeenCalled();
  });

  it("validation error (server-side): the server rejecting still surfaces a validation message", async () => {
    const user = userEvent.setup();
    getMyProfile.mockResolvedValue({ status: "success", profile: null });
    setDisplayName.mockResolvedValue({ status: "invalid-argument", message: "server said no" });
    await renderOverlay();

    const input = await screen.findByLabelText("現在の名前");
    await user.type(input, "Alice");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(screen.getByText("入力内容を確認してください。")).toBeInTheDocument());
  });

  it("cooldown: shows a cooldown message when the server rejects a too-soon rename", async () => {
    const user = userEvent.setup();
    getMyProfile.mockResolvedValue({ status: "success", profile: { displayName: "Alice" } });
    setDisplayName.mockResolvedValue({ status: "cooldown", message: "too soon" });
    await renderOverlay();

    const input = await screen.findByLabelText("現在の名前");
    await user.clear(input);
    await user.type(input, "Bob");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(
        screen.getByText("しばらく時間をおいてから変更してください（変更は60秒に1回までです）。"),
      ).toBeInTheDocument(),
    );
  });

  it("server error (any other failure status): shows a generic retry message", async () => {
    const user = userEvent.setup();
    getMyProfile.mockResolvedValue({ status: "success", profile: null });
    setDisplayName.mockResolvedValue({ status: "failed", message: "network down" });
    await renderOverlay();

    const input = await screen.findByLabelText("現在の名前");
    await user.type(input, "Alice");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(screen.getByText("保存に失敗しました。もう一度お試しください。")).toBeInTheDocument(),
    );
  });

  it("editing the input after a validation error clears the previous message", async () => {
    const user = userEvent.setup();
    getMyProfile.mockResolvedValue({ status: "success", profile: null });
    await renderOverlay();

    const input = await screen.findByLabelText("現在の名前");
    await user.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(screen.getByText("名前を入力してください。")).toBeInTheDocument());

    await user.type(input, "A");
    expect(screen.queryByText("名前を入力してください。")).not.toBeInTheDocument();
  });

  it("a long (20 codepoint) name does not overflow / is accepted by client validation", async () => {
    const user = userEvent.setup();
    getMyProfile.mockResolvedValue({ status: "success", profile: null });
    setDisplayName.mockResolvedValue({ status: "success", displayName: "A".repeat(20) });
    await renderOverlay();

    const input = await screen.findByLabelText("現在の名前");
    await user.type(input, "A".repeat(20));
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(screen.getByText("保存しました。")).toBeInTheDocument());
    expect(setDisplayName).toHaveBeenCalledWith({ displayName: "A".repeat(20) });
  });

  it("existing Full Game Reset flow remains functional alongside the new profile section", async () => {
    const user = userEvent.setup();
    getMyProfile.mockResolvedValue({ status: "success", profile: null });
    const { onResetGameData } = await renderOverlay();

    await user.click(screen.getByRole("button", { name: "ゲームデータをリセット" }));
    expect(
      screen.getByRole("heading", { name: "ゲームデータをリセットしますか？" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "最初からやり直す" }));
    expect(onResetGameData).toHaveBeenCalledTimes(1);
  });
});
