import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WalletConnectDrawerInner } from "@/components/swap/WalletConnectDrawerInner";

vi.mock("next/image", () => ({
  default: (props: any) => <img {...props} />,
}));

vi.mock("@/components/ui/drawer", () => ({
  DrawerHeader: ({ children }: any) => <div>{children}</div>,
  DrawerTitle: ({ children }: any) => <div>{children}</div>,
  DrawerDescription: ({ children }: any) => <div>{children}</div>,
  DrawerFooter: ({ children }: any) => <div>{children}</div>,
  DrawerClose: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("@/components/ui/MnemonicActions", () => ({
  MnemonicActions: () => <div data-testid="mnemonic-actions" />,
}));

describe("WalletConnectDrawerInner", () => {
  const baseProps = {
    mnemonicWords: new Array(12).fill(""),
    setMnemonicWords: vi.fn(),
    mnemonicError: "Invalid phrase",
    setMnemonicError: vi.fn(),
    handlePaste: vi.fn(),
    handleGenerateMnemonic: vi.fn(),
    handleSaveMnemonic: vi.fn(),
    handleConnectCashtab: vi.fn(),
  };

  it("lowercases edited words and clears the current error", () => {
    render(<WalletConnectDrawerInner {...baseProps} />);

    fireEvent.change(screen.getByPlaceholderText("Word 1"), {
      target: { value: "HELLO" },
    });

    const nextWords = baseProps.setMnemonicWords.mock.calls[0][0];
    expect(nextWords[0]).toBe("hello");
    expect(baseProps.setMnemonicError).toHaveBeenCalledWith("");
  });

  it("moves focus to the next input when pressing Enter", () => {
    render(<WalletConnectDrawerInner {...baseProps} />);

    const firstInput = screen.getByPlaceholderText("Word 1");
    const secondInput = screen.getByPlaceholderText("Word 2");

    firstInput.focus();
    fireEvent.keyDown(firstInput, { key: "Enter" });

    expect(secondInput).toHaveFocus();
  });

  it("forwards paste and button actions to the provided callbacks", () => {
    render(<WalletConnectDrawerInner {...baseProps} />);

    fireEvent.paste(screen.getByPlaceholderText("Word 2"), {
      clipboardData: {
        getData: () => "alpha beta",
      },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /generate new recovery phrase/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^connect$/i }));
    fireEvent.click(screen.getByRole("button", { name: /connect with cashtab/i }));

    expect(baseProps.handlePaste).toHaveBeenCalled();
    expect(baseProps.handlePaste.mock.calls[0][1]).toBe(1);
    expect(baseProps.handleGenerateMnemonic).toHaveBeenCalledTimes(1);
    expect(baseProps.handleSaveMnemonic).toHaveBeenCalledTimes(1);
    expect(baseProps.handleConnectCashtab).toHaveBeenCalledTimes(1);
  });
});
