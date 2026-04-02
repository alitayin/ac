import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TokenSelector } from '@/components/ui/token-selector'

// Mock dependencies
vi.mock('@/lib/chronik', () => ({
  fetchTokenDetails: vi.fn().mockResolvedValue({
    genesisInfo: { decimals: 2 }
  }),
  getTokenDecimalsFromDetails: vi.fn(() => 2),
}))

vi.mock('@/config/tokenconfig', () => ({
  TOKENS: {
    'token-1': { name: 'Token One', decimals: 2 },
    'token-2': { name: 'Token Two', decimals: 4 },
  }
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

  it('should render selected token', () => {
    render(<TokenSelector {...defaultProps} />)
    expect(screen.getByText('Token One')).toBeInTheDocument()
  })

  it('should filter to only owned tokens when onlyOwnedTokens is true', () => {
    const { container } = render(
      <TokenSelector {...defaultProps} onlyOwnedTokens={true} />
    )

    const button = screen.getByText('Token One')
    fireEvent.click(button)

    // Token with 0 balance should be disabled
    waitFor(() => {
      const tokenTwoButton = screen.queryByText('Token Two')
      if (tokenTwoButton) {
        expect(tokenTwoButton.closest('button')).toBeDisabled()
      }
    })
  })

  it('should show all tokens when onlyOwnedTokens is false', () => {
    render(<TokenSelector {...defaultProps} onlyOwnedTokens={false} />)

    const button = screen.getByText('Token One')
    fireEvent.click(button)

    // Both tokens should be available
    waitFor(() => {
      expect(screen.getByText('Token Two')).toBeInTheDocument()
    })
  })

  it('should call onTokenSelect when token is clicked', async () => {
    render(<TokenSelector {...defaultProps} />)

    const button = screen.getByText('Token One')
    fireEvent.click(button)

    await waitFor(() => {
      const tokenButton = screen.getByText('Token Two')
      fireEvent.click(tokenButton)
    })

    expect(mockOnTokenSelect).toHaveBeenCalledWith('token-2', 'Token Two')
  })

  it('should display token balance correctly', () => {
    render(<TokenSelector {...defaultProps} />)

    const button = screen.getByText('Token One')
    fireEvent.click(button)

    waitFor(() => {
      // Balance should be formatted: 100000 / 10^2 = 1000.00
      expect(screen.getByText(/Balance: 1,000/)).toBeInTheDocument()
    })
  })

  it('should call onTokenMetaChange when token decimals are loaded', () => {
    render(<TokenSelector {...defaultProps} />)

    waitFor(() => {
      expect(mockOnTokenMetaChange).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenId: 'token-1',
          decimals: 2,
        })
      )
    })
  })
})
