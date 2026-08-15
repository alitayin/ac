import { beforeEach, describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PriceCard } from '@/components/swap/PriceCard'
import { SpendCard } from '@/components/swap/SpendCard'
import { BuyCard } from '@/components/swap/BuyCard'

// Mock TokenSelector
vi.mock('@/components/ui/token-selector', () => ({
  TokenSelector: ({ selectedToken }: any) => (
    <div data-testid="token-selector">{selectedToken.name}</div>
  ),
}))

describe('Swap Cards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('PriceCard', () => {
    const mockProps = {
      selectedToken: { id: 'token-1', name: 'TestToken' },
      userTokens: {},
      tokenPriceInput: '1.50',
      onTokenPriceInputChange: vi.fn(),
      onTokenPriceBlur: vi.fn(),
      useBestOrderPrice: true,
      setUseBestOrderPrice: vi.fn(),
      showUsdPrice: false,
      setShowUsdPrice: vi.fn(),
      onMarketClick: vi.fn(),
      onOneDollarClick: vi.fn(),
      showUsdPriceValue: false,
      usdPriceText: '0.045',
      onTokenSelect: vi.fn(),
      onTokenMetaChange: vi.fn(),
    }

    it('should render price input with correct value', () => {
      render(<PriceCard {...mockProps} />)
      const input = screen.getByPlaceholderText('0.00') as HTMLInputElement
      expect(input.value).toBe('1.50')
    })

    it('should call onTokenPriceInputChange when input changes', () => {
      render(<PriceCard {...mockProps} />)
      const input = screen.getByPlaceholderText('0.00')
      fireEvent.change(input, { target: { value: '2.00' } })
      expect(mockProps.onTokenPriceInputChange).toHaveBeenCalledWith('2.00')
    })

    it('should call onMarketClick when Market button is clicked', () => {
      render(<PriceCard {...mockProps} />)
      const marketButton = screen.getByText('Market')
      fireEvent.click(marketButton)
      expect(mockProps.onMarketClick).toHaveBeenCalled()
    })

    it('should support separately labeled Binance and Firma buyback price buttons', () => {
      const onFirmaBuybackPriceClick = vi.fn()
      render(
        <PriceCard
          {...mockProps}
          marketButtonLabel="Binance Price"
          onSecondaryMarketClick={onFirmaBuybackPriceClick}
          secondaryMarketButtonLabel="Firma buyback price"
        />,
      )

      fireEvent.click(screen.getByRole('button', { name: 'Binance Price' }))
      fireEvent.click(screen.getByRole('button', { name: 'Firma buyback price' }))

      expect(mockProps.onMarketClick).toHaveBeenCalled()
      expect(onFirmaBuybackPriceClick).toHaveBeenCalled()
    })

    it('should call onOneDollarClick when 1.00 $ button is clicked', () => {
      render(<PriceCard {...mockProps} />)
      const dollarButton = screen.getByText('1.00 $')
      fireEvent.click(dollarButton)
      expect(mockProps.onOneDollarClick).toHaveBeenCalled()
    })

    it('should show USD price when showUsdPriceValue is true', () => {
      render(<PriceCard {...mockProps} showUsdPriceValue={true} />)
      expect(screen.getByText('$0.045')).toBeInTheDocument()
    })

    it('should not show token selector when showTokenSelector is false', () => {
      render(<PriceCard {...mockProps} showTokenSelector={false} />)
      expect(screen.queryByTestId('token-selector')).not.toBeInTheDocument()
    })

    it('should show stacked reference prices and a static input unit', () => {
      render(
        <PriceCard
          {...mockProps}
          showTokenSelector={false}
          inputUnitLabel="$/XEC"
          referencePrices={[
            { label: 'Binance XEC:', value: '$0.00000681/XEC' },
            {
              label: '= Firma/USDT:',
              value: '0.996',
              indicator: 'down',
              indicatorTitle: 'Firma/USDT is below 0.997',
            },
            {
              label: 'Lowest Firma ask:',
              value: '1.066/USDT',
              indicator: 'up',
              indicatorTitle: 'Lowest Firma ask is above 1.010 USDT',
            },
          ]}
        />,
      )

      expect(screen.getByText('$/XEC')).toBeInTheDocument()
      expect(screen.getByText('$0.00000681/XEC')).toBeInTheDocument()
      expect(screen.getByText('0.996')).toBeInTheDocument()
      expect(screen.getByText('1.066/USDT')).toBeInTheDocument()
      expect(screen.getByLabelText('Firma/USDT is below 0.997')).toBeInTheDocument()
      expect(screen.getByLabelText('Lowest Firma ask is above 1.010 USDT')).toBeInTheDocument()
    })
  })

  describe('SpendCard', () => {
    const mockToast = vi.fn()
    const mockProps = {
      spendAmount: '100',
      setSpendAmount: vi.fn(),
      calculateReceiveAmount: vi.fn(),
      isWalletConnected: true,
      balance: '1000',
      networkFee: 20,
      swapFee: 5.46,
      totalFees: 25.46,
      minimumTotalFees: 25.46,
      toast: mockToast,
    }

    it('should render spend amount correctly', () => {
      render(<SpendCard {...mockProps} />)
      const input = screen.getByPlaceholderText('0') as HTMLInputElement
      expect(input.value).toBe('100')
    })

    it('should render ecash as a static label instead of a button', () => {
      render(<SpendCard {...mockProps} />)
      expect(screen.getByText('ecash')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /ecash/i })).not.toBeInTheDocument()
    })

    it('should only accept numeric input', () => {
      render(<SpendCard {...mockProps} />)
      const input = screen.getByPlaceholderText('0')

      fireEvent.change(input, { target: { value: 'abc' } })
      expect(mockProps.setSpendAmount).not.toHaveBeenCalledWith('abc')

      fireEvent.change(input, { target: { value: '123.45' } })
      expect(mockProps.setSpendAmount).toHaveBeenCalledWith('123.45')
    })

    it('should display wallet balance when connected', () => {
      render(<SpendCard {...mockProps} />)
      expect(screen.getByText('Balance: 1000 XEC')).toBeInTheDocument()
    })

    it('should display total fee summary', () => {
      render(<SpendCard {...mockProps} />)
      expect(screen.getByText('Estimated fees')).toBeInTheDocument()
      expect(screen.getByText('25.46 XEC')).toBeInTheDocument()
    })

    it('should display 0 balance when wallet not connected', () => {
      render(<SpendCard {...mockProps} isWalletConnected={false} />)
      expect(screen.getByText('Balance: 0 XEC')).toBeInTheDocument()
    })

    it('should set max balance when Max button is clicked', () => {
      render(<SpendCard {...mockProps} />)
      const maxButton = screen.getByText('Max')
      fireEvent.click(maxButton)
      expect(mockProps.setSpendAmount).toHaveBeenCalledWith('1000')
      expect(mockProps.calculateReceiveAmount).toHaveBeenCalledWith('1000')
    })

    it('should show error toast when balance is less than network fee', () => {
      render(<SpendCard {...mockProps} balance="10" />)
      const maxButton = screen.getByText('Max')
      fireEvent.click(maxButton)
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Insufficient balance',
          variant: 'destructive',
        })
      )
    })

    it('should disable Max button when wallet not connected', () => {
      render(<SpendCard {...mockProps} isWalletConnected={false} />)
      const maxButton = screen.getByText('Max')
      expect(maxButton).toBeDisabled()
    })

    it('should normalize spend input to two decimals on blur when needed', () => {
      render(<SpendCard {...mockProps} spendAmount="123.456" />)
      const input = screen.getByPlaceholderText('0')

      fireEvent.blur(input, { target: { value: '123.456' } })

      expect(mockProps.setSpendAmount).toHaveBeenCalledWith('123.46')
      expect(mockProps.calculateReceiveAmount).toHaveBeenCalledWith('123.456')
    })
  })

  describe('BuyCard', () => {
    const mockProps = {
      receiveAmount: '50',
      setReceiveAmount: vi.fn(),
      calculateSpendAmount: vi.fn(),
      selectedToken: { id: 'token-1', name: 'TestToken' },
      userTokens: { 'token-1': '10000000' },
      onTokenSelect: vi.fn(),
      onTokenMetaChange: vi.fn(),
      selectedTokenDecimals: 2,
    }

    it('should render receive amount correctly', () => {
      render(<BuyCard {...mockProps} />)
      const input = screen.getByPlaceholderText('0') as HTMLInputElement
      expect(input.value).toBe('50')
    })

    it('should format amount on blur with correct decimals', () => {
      render(<BuyCard {...mockProps} />)
      const input = screen.getByPlaceholderText('0')

      fireEvent.change(input, { target: { value: '50' } })
      fireEvent.blur(input)

      // On blur, the component formats to fixed decimals: 50 -> 50.00 (2 decimals)
      expect(mockProps.setReceiveAmount).toHaveBeenLastCalledWith('50.00')
    })

    it('should show token selector by default', () => {
      render(<BuyCard {...mockProps} />)
      expect(screen.getByTestId('token-selector')).toBeInTheDocument()
    })

    it('should hide token selector when showTokenSelector is false', () => {
      render(<BuyCard {...mockProps} showTokenSelector={false} />)
      expect(screen.queryByTestId('token-selector')).not.toBeInTheDocument()
    })

    it('should show max balance when showMaxBalance is true', () => {
      render(<BuyCard {...mockProps} showMaxBalance={true} />)
      expect(screen.getByText('Max')).toBeInTheDocument()
      expect(screen.getByText(/Balance:\s*100,000/)).toBeInTheDocument()
    })

    it('should show the optional USD balance value in smaller text', () => {
      render(<BuyCard {...mockProps} showMaxBalance={true} balanceUsd={0.973} />)
      expect(screen.getByText('(0.973$)')).toBeInTheDocument()
    })

    it('should set max balance when Max button is clicked', () => {
      render(<BuyCard {...mockProps} showMaxBalance={true} />)
      const maxButton = screen.getByText('Max')
      fireEvent.click(maxButton)

      // 10000000 / 10^2 = 100000.00
      expect(mockProps.setReceiveAmount).toHaveBeenCalledWith('100000.00')
    })

    it('should keep the balance row visible when the balance is zero', () => {
      render(
        <BuyCard
          {...mockProps}
          userTokens={{}}
          showMaxBalance={true}
        />,
      )

      expect(screen.getByText('Balance: 0')).toBeInTheDocument()
      expect(screen.getByText('Max')).toBeDisabled()
    })

    it('should use custom label when provided', () => {
      render(<BuyCard {...mockProps} label="Sell Amount" />)
      expect(screen.getByText('Sell Amount')).toBeInTheDocument()
    })

    it('should render token selector for wallet-based token selection', () => {
      render(<BuyCard {...mockProps} />)
      expect(screen.getByTestId('token-selector')).toBeInTheDocument()
    })

    it('should ignore manual edits when the amount is read-only', () => {
      render(<BuyCard {...mockProps} readOnly={true} />)
      const input = screen.getByPlaceholderText('0')

      fireEvent.change(input, { target: { value: '75' } })
      fireEvent.blur(input, { target: { value: '75' } })

      expect(mockProps.setReceiveAmount).not.toHaveBeenCalled()
      expect(mockProps.calculateSpendAmount).not.toHaveBeenCalled()
    })

    it('should show a static asset label when the selector is hidden', () => {
      render(
        <BuyCard
          {...mockProps}
          label="Spend"
          showTokenSelector={false}
          staticTokenLabel="FIRMA"
        />,
      )

      expect(screen.getByText('FIRMA')).toBeInTheDocument()
      expect(screen.getByLabelText('Spend amount')).toBeInTheDocument()
    })
  })
})
