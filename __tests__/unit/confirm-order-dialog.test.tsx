import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConfirmOrderDialog } from "@/components/swap/ConfirmOrderDialog";

describe("ConfirmOrderDialog", () => {
  const baseProps = {
    open: true,
    onOpenChange: vi.fn(),
    selectedToken: {
      id: "token-id-1",
      name: "StarShard",
    },
    receiveAmount: "2515",
    spendAmount: "9999.93",
    tokenPrice: 3.95000005,
    networkFee: 16,
    swapFee: 49.68,
    totalFees: 65.68,
    tokenCost: 9934.25,
    feeDescription: "0.5% swap fee (min 5.46 XEC)",
    formatTokenPrice: (price: number) => price.toFixed(8),
    onClose: vi.fn(),
    onConfirm: vi.fn(),
  };

  it("renders grouped summary sections with formatted values", () => {
    render(<ConfirmOrderDialog {...baseProps} />);

    expect(screen.getByText("Spend up to")).toBeInTheDocument();
    expect(screen.getByText("Receive up to")).toBeInTheDocument();
    expect(screen.getByText("Max spend")).toBeInTheDocument();
    expect(screen.getByText("9,999.93")).toBeInTheDocument();
    expect(screen.getByText(/2,515\s+StarShard/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^confirm order$/i })).toBeInTheDocument();
  });

  it("shows the self-custody badge", () => {
    render(<ConfirmOrderDialog {...baseProps} />);

    expect(screen.getAllByText("Self-Custody").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /^confirm order$/i })).toBeInTheDocument();
  });

  it("wires the close and confirm actions to the provided callbacks", () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();

    render(
      <ConfirmOrderDialog
        {...baseProps}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /close confirm order dialog/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /^confirm order$/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("falls back to the entered spend amount when there is no priced receive quote", () => {
    render(
      <ConfirmOrderDialog
        {...baseProps}
        receiveAmount=""
        tokenPrice={0}
        spendAmount="125.5"
      />,
    );

    expect(screen.getAllByText("125.50").length).toBeGreaterThan(0);
    expect(screen.getByText("Max spend")).toBeInTheDocument();
  });
});
