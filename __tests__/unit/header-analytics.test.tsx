import { act, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import Header from "@/components/ui/header"

const {
  pathnameState,
  setThemeMock,
  toastMock,
  walletState,
  fetchTokenDetailsMock,
} = vi.hoisted(() => ({
  pathnameState: {
    value: "/analytics",
  },
  setThemeMock: vi.fn(),
  toastMock: vi.fn(),
  walletState: {
    value: {
      isWalletConnected: false,
      ecashAddress: "",
      balance: "0",
      userTokens: {},
      disconnectWallet: vi.fn(),
      connectWallet: vi.fn(),
      connectWithCashtab: vi.fn(),
    },
  },
  fetchTokenDetailsMock: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameState.value,
}))

vi.mock("next-themes", () => ({
  useTheme: () => ({
    setTheme: setThemeMock,
    resolvedTheme: "dark",
  }),
}))

vi.mock("next/image", () => ({
  default: (props: any) => <img {...props} />,
}))

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={typeof href === "string" ? href : href?.pathname} {...props}>
      {children}
    </a>
  ),
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({
    toast: toastMock,
  }),
}))

vi.mock("@/lib/websocket-client", () => ({
  useAddressNotifier: () => false,
  useWebSocketStatus: () => "disconnected",
}))

vi.mock("@/lib/context/WalletContext", () => ({
  useWallet: () => walletState.value,
}))

vi.mock("@/lib/price", () => ({
  useXECPrice: () => 0,
}))

vi.mock("@/lib/chronik", () => ({
  fetchTokenDetails: (...args: unknown[]) => fetchTokenDetailsMock(...args),
  getTokenDecimalsFromDetails: vi.fn(() => 0),
}))

vi.mock("canvas-confetti", () => ({
  default: vi.fn(),
}))

vi.mock("@/components/magicui/confetti", () => ({
  ConfettiButton: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}))

vi.mock("@/components/magicui/border-beam", () => ({
  BorderBeam: () => null,
}))

vi.mock("@/components/magicui/flickering-grid", () => ({
  FlickeringGrid: () => null,
}))

vi.mock("@/components/ui/TelegramAgoraBotDialog", () => ({
  default: () => <div>Telegram</div>,
}))

vi.mock("@/components/swap/WalletConnectDrawerInner", () => ({
  WalletConnectDrawerInner: () => <div>Wallet Connect</div>,
}))

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: any) => <div>{children}</div>,
}))

vi.mock("@/components/ui/drawer", () => ({
  Drawer: ({ children }: any) => <div>{children}</div>,
  DrawerTrigger: ({ children }: any) => <div>{children}</div>,
  DrawerContent: ({ children }: any) => <div>{children}</div>,
  DrawerHeader: ({ children }: any) => <div>{children}</div>,
  DrawerTitle: ({ children }: any) => <div>{children}</div>,
  DrawerDescription: ({ children }: any) => <div>{children}</div>,
  DrawerFooter: ({ children }: any) => <div>{children}</div>,
  DrawerClose: ({ children }: any) => <div>{children}</div>,
}))

describe("Header analytics navigation", () => {
  beforeEach(() => {
    pathnameState.value = "/analytics"
    localStorage.clear()
    vi.clearAllMocks()
    fetchTokenDetailsMock.mockReset()
    walletState.value = {
      isWalletConnected: false,
      ecashAddress: "",
      balance: "0",
      userTokens: {},
      disconnectWallet: vi.fn(),
      connectWallet: vi.fn(),
      connectWithCashtab: vi.fn(),
    }
  })

  it("renders Analytics links for desktop and mobile navigation", () => {
    render(<Header />)

    const analyticsLinks = screen.getAllByRole("link", { name: "Analytics" })

    expect(analyticsLinks).toHaveLength(2)
    expect(analyticsLinks[0]).toHaveAttribute("href", "/analytics")
    expect(analyticsLinks[1]).toHaveAttribute("href", "/analytics")
  })

  it("keeps token metadata loading at three concurrent requests and cancels queued work", async () => {
    const tokenIds = ["token-1", "token-2", "token-3", "token-4", "token-5"]
    walletState.value = {
      isWalletConnected: true,
      ecashAddress: "ecash:test",
      balance: "0",
      userTokens: Object.fromEntries(tokenIds.map((tokenId) => [tokenId, "1"])),
      disconnectWallet: vi.fn(),
      connectWallet: vi.fn(),
      connectWithCashtab: vi.fn(),
    }

    let activeRequests = 0
    let maxActiveRequests = 0
    const resolvers = new Map<string, () => void>()
    fetchTokenDetailsMock.mockImplementation((tokenId: string) => {
      return new Promise((resolve) => {
        activeRequests += 1
        maxActiveRequests = Math.max(maxActiveRequests, activeRequests)
        let settled = false
        resolvers.set(tokenId, () => {
          if (settled) return
          settled = true
          activeRequests -= 1
          resolve({
            genesisInfo: {
              tokenName: tokenId,
              tokenTicker: tokenId,
              decimals: 0,
            },
          })
        })
      })
    })

    const view = render(<Header />)

    await waitFor(() => {
      expect(fetchTokenDetailsMock).toHaveBeenCalledTimes(3)
    })
    expect(maxActiveRequests).toBe(3)

    await act(async () => {
      resolvers.get("token-1")?.()
    })
    await waitFor(() => {
      expect(fetchTokenDetailsMock).toHaveBeenCalledTimes(4)
    })
    expect(maxActiveRequests).toBe(3)

    view.unmount()
    await act(async () => {
      for (const resolve of resolvers.values()) resolve()
      await Promise.resolve()
    })

    expect(fetchTokenDetailsMock).toHaveBeenCalledTimes(4)
  })
})
