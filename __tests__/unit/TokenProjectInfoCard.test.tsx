import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  createInvoiceMock,
  fetchProjectInfoMock,
  fetchInvoiceMock,
  quickSendXecMock,
  submitInvoiceTxMock,
  walletMock,
  toastMock,
} = vi.hoisted(() => ({
  createInvoiceMock: vi.fn(),
  fetchProjectInfoMock: vi.fn(),
  fetchInvoiceMock: vi.fn(),
  quickSendXecMock: vi.fn(),
  submitInvoiceTxMock: vi.fn(),
  walletMock: vi.fn(),
  toastMock: vi.fn(),
}))

vi.mock("ecash-quicksend", () => ({
  default: {
    sendXec: (...args: unknown[]) => quickSendXecMock(...args),
  },
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: toastMock,
  }),
}))

vi.mock("@/lib/context/WalletContext", () => ({
  useWallet: () => walletMock(),
}))

vi.mock("@/lib/etokendb", () => ({
  createEtokenDbProjectInfoInvoice: (...args: unknown[]) => createInvoiceMock(...args),
  fetchEtokenDbProjectInfoInvoice: (...args: unknown[]) => fetchInvoiceMock(...args),
  fetchEtokenDbTokenProjectInfo: (...args: unknown[]) => fetchProjectInfoMock(...args),
  submitEtokenDbProjectInfoInvoiceTx: (...args: unknown[]) => submitInvoiceTxMock(...args),
}))

import TokenProjectInfoCard from "@/components/ui/TokenProjectInfoCard"

const TEST_TOKEN_ID =
  "5cb20c6cdeaee3abf53f7dcaaa1092ad10a0e2e9dcd94ee07272b631e65d7371"
const AUTH_PUBKEY =
  "0334b744e6338ad438c92900c0ed1869c3fd2c0f35a4a9b97a88447b6e2b145f10"

describe("TokenProjectInfoCard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    fetchProjectInfoMock.mockResolvedValue(null)
    fetchInvoiceMock.mockResolvedValue({
      invoiceId: "invoice-1",
      tokenId: TEST_TOKEN_ID,
      status: "published",
      description: "ac test",
      websiteUrl: "https://agora.cash",
      xUrl: "https://x.com/agoracash",
      telegramUrl: "https://t.me/agoraui",
      paymentAddress: "ecash:payment",
      expectedPaidSats: 10000,
      expectedPaidXec: "100",
      paymentTxid: "txid-1",
    })
    quickSendXecMock.mockResolvedValue({ txid: "txid-1" })
    submitInvoiceTxMock.mockResolvedValue({
      invoiceId: "invoice-1",
      tokenId: TEST_TOKEN_ID,
      status: "published",
      description: "ac test",
      websiteUrl: "https://agora.cash",
      xUrl: "https://x.com/agoracash",
      telegramUrl: "https://t.me/agoraui",
      paymentAddress: "ecash:payment",
      expectedPaidSats: 10000,
      expectedPaidXec: "100",
      paymentTxid: "txid-1",
    })
    walletMock.mockReturnValue({
      isWalletConnected: true,
      ecashAddress: "ecash:test-address",
      mnemonic: "test mnemonic",
      isGuestMode: false,
      publicKeyHex: AUTH_PUBKEY,
      refreshBalance: vi.fn(),
    })
  })

  it("shows the 100 XEC test-token project info fee before invoice creation", async () => {
    render(
      <TokenProjectInfoCard
        tokenId={TEST_TOKEN_ID}
        tokenName="Test Token"
        authPubkey={AUTH_PUBKEY}
      />,
    )

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Initialize" })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: "Initialize" }))

    expect(await screen.findByText("Fee: 100 XEC")).toBeInTheDocument()
  })

  it("shows project info source and moderation disclaimers", async () => {
    render(
      <TokenProjectInfoCard
        tokenId={TEST_TOKEN_ID}
        tokenName="Test Token"
        authPubkey={AUTH_PUBKEY}
      />,
    )

    expect(
      await screen.findByText(
        "The token creator has not added project information yet. (Project information is submitted and edited by the token holder.)",
      ),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Initialize" }))

    expect(
      await screen.findByText(
        "We may remove content we consider inappropriate at any time, without providing a reason or refund.",
      ),
    ).toBeInTheDocument()
  })

  it("renders the buy link in the project info header", async () => {
    render(
      <TokenProjectInfoCard
        tokenId={TEST_TOKEN_ID}
        tokenName="Test Token"
        authPubkey={AUTH_PUBKEY}
        buyHref={`/swap?tokenId=${TEST_TOKEN_ID}&tokenName=Test%20Token`}
      />,
    )

    expect(await screen.findByRole("link", { name: "Buy" })).toHaveAttribute(
      "href",
      `/swap?tokenId=${TEST_TOKEN_ID}&tokenName=Test%20Token`,
    )
  })

  it("adds https to project info URLs before creating an invoice", async () => {
    createInvoiceMock.mockResolvedValue({
      invoiceId: "invoice-1",
      tokenId: TEST_TOKEN_ID,
      status: "published",
      description: "ac test",
      websiteUrl: "https://agora.cash",
      xUrl: "https://x.com/agoracash",
      telegramUrl: "https://t.me/agoraui",
      paymentAddress: "ecash:payment",
      expectedPaidSats: 10000,
      expectedPaidXec: "100",
      paymentTxid: null,
    })

    render(
      <TokenProjectInfoCard
        tokenId={TEST_TOKEN_ID}
        tokenName="Test Token"
        authPubkey={AUTH_PUBKEY}
      />,
    )

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Initialize" })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole("button", { name: "Initialize" }))
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "ac test" },
    })
    fireEvent.change(screen.getByLabelText("Website"), {
      target: { value: "agora.cash" },
    })
    fireEvent.change(screen.getByLabelText("X"), {
      target: { value: "x.com/agoracash" },
    })
    fireEvent.change(screen.getByLabelText("Telegram"), {
      target: { value: "t.me/agoraui" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Initialize" }))

    await waitFor(() => {
      expect(createInvoiceMock).toHaveBeenCalledWith(
        TEST_TOKEN_ID,
        expect.objectContaining({
          description: "ac test",
          websiteUrl: "https://agora.cash",
          xUrl: "https://x.com/agoracash",
          telegramUrl: "https://t.me/agoraui",
        }),
      )
    })
  })
})
