import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TokenSelector } from '@/components/ui/token-selector'

const { mockFetchTokenDetails, mockGetTokenDecimalsFromDetails } = vi.hoisted(() => ({
  mockFetchTokenDetails: vi.fn(),
  mockGetTokenDecimalsFromDetails: vi.fn(),
}))

vi.mock('@/lib/chronik', () => ({
  fetchTokenDetails: mockFetchTokenDetails,
  getTokenDecimalsFromDetails: mockGetTokenDecimalsFromDetails,
}))

describe('TokenSelector', () => {
  const mockOnTokenSelect = vi.fn()
  const mockOnTokenMetaChange = vi.fn()

  const defaultProps = {
    selectedToken: { id: 'token-1', name: 'Token One' },
    userTokens: {
      'token-1': '100000',
      'token-2': '0',
    },
    onTokenSelect: mockOnTokenSelect,
    onTokenMetaChange: mockOnTokenMetaChange,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()

    mockOnTokenSelect.mockReset()
    mockOnTokenMetaChange.mockReset()

    mockGetTokenDecimalsFromDetails.mockImplementation((detail, fallback = 0) => {
      return detail?.genesisInfo?.decimals ?? fallback
    })

    mockFetchTokenDetails.mockImplementation(async (tokenId: string) => {
      const decimalsByTokenId: Record<string, number> = {
        'token-1': 2,
        'token-2': 4,
        'token-3': 6,
      }

      return {
        genesisInfo: {
          tokenName:
            tokenId === 'token-1' ? 'Token One' : tokenId === 'token-2' ? 'Token Two' : 'Token Three',
          tokenTicker:
            tokenId === 'token-1' ? 'ONE' : tokenId === 'token-2' ? 'TWO' : 'THREE',
          decimals: decimalsByTokenId[tokenId] ?? 0,
        },
      }
    })
  })

  it('should render selected token', () => {
    render(<TokenSelector {...defaultProps} />)
    expect(screen.getByText('Token One')).toBeInTheDocument()
  })

  it('should only show wallet tokens with balance', async () => {
    render(
      <TokenSelector {...defaultProps} />
    )

    fireEvent.click(screen.getByText('Token One'))

    await waitFor(() => {
      expect(screen.queryByText('Token Two')).not.toBeInTheDocument()
    })
  })

  it('should only show wallet tokens even when zero-balance tokens exist', async () => {
    render(<TokenSelector {...defaultProps} />)

    fireEvent.click(screen.getByText('Token One'))

    await waitFor(() => {
      expect(screen.queryByText('Token Two')).not.toBeInTheDocument()
    })
  })

  it('should call onTokenSelect when token is clicked', async () => {
    render(
      <TokenSelector
        {...defaultProps}
        userTokens={{
          'token-1': '100000',
          'token-2': '250000',
        }}
      />
    )

    fireEvent.click(screen.getByText('Token One'))

    fireEvent.click(await screen.findByText('Token Two'))

    expect(mockOnTokenSelect).toHaveBeenCalledWith('token-2', 'Token Two')
  })

  it('should display token balance correctly', async () => {
    render(<TokenSelector {...defaultProps} />)

    fireEvent.click(screen.getByText('Token One'))

    await waitFor(() => {
      expect(screen.getByText(/Balance: 1,000/)).toBeInTheDocument()
    })
  })

  it('should show an empty wallet state when the user has no token balances', async () => {
    render(
      <TokenSelector
        {...defaultProps}
        selectedToken={{ id: '', name: '' }}
        userTokens={{}}
      />
    )

    expect(screen.getByRole('button')).toBeDisabled()
    expect(screen.getByText('No tokens')).toBeInTheDocument()
  })

  it('should call onTokenMetaChange when token decimals are loaded', async () => {
    render(<TokenSelector {...defaultProps} />)

    await waitFor(() => {
      expect(mockOnTokenMetaChange).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenId: 'token-1',
          decimals: 2,
        })
      )
    })
  })

  it('should load token details in parallel and batch selected token meta updates', async () => {
    const callOrder: string[] = []
    const resolvers = new Map<string, () => void>()

    mockFetchTokenDetails.mockImplementation(
      (tokenId: string) =>
        new Promise((resolve) => {
          callOrder.push(`start-${tokenId}`)
          resolvers.set(tokenId, () => {
            callOrder.push(`end-${tokenId}`)
            resolve({
              genesisInfo: {
                decimals: tokenId === 'token-1' ? 2 : tokenId === 'token-2' ? 4 : 6,
              },
            })
          })
        })
    )

    render(
      <TokenSelector
        {...defaultProps}
        userTokens={{
          'token-1': '100000',
          'token-2': '200000',
          'token-3': '300000',
        }}
      />
    )

    await waitFor(() => {
      expect(mockFetchTokenDetails).toHaveBeenCalledTimes(3)
    })

    resolvers.get('token-1')?.()
    await Promise.resolve()

    const firstEndIndex = callOrder.findIndex((call) => call.startsWith('end-'))
    expect(firstEndIndex).toBe(3)
    expect(callOrder.slice(0, firstEndIndex)).toEqual([
      'start-token-1',
      'start-token-2',
      'start-token-3',
    ])

    expect(mockOnTokenMetaChange).not.toHaveBeenCalledWith(
      expect.objectContaining({
        tokenId: 'token-1',
        decimals: 2,
      })
    )

    resolvers.get('token-2')?.()
    resolvers.get('token-3')?.()

    await waitFor(() => {
      expect(mockOnTokenMetaChange).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenId: 'token-1',
          decimals: 2,
        })
      )
    })
  })

  it('should skip fetching token details already available in local cache', async () => {
    localStorage.setItem('token_details_cache', JSON.stringify({
      'token-1': {
        genesisInfo: {
          decimals: 2,
        },
      },
    }))

    render(
      <TokenSelector
        {...defaultProps}
        userTokens={{
          'token-1': '100000',
          'token-2': '200000',
        }}
      />
    )

    await waitFor(() => {
      expect(mockFetchTokenDetails).toHaveBeenCalledTimes(1)
    })

    expect(mockFetchTokenDetails.mock.calls.map((call) => call[0])).toEqual(['token-2'])

    await waitFor(() => {
      expect(mockOnTokenMetaChange).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenId: 'token-1',
          decimals: 2,
        })
      )
    })
  })
})
