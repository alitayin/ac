import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrderList } from '@/components/ui/orderlist';
import { fetchTokenDetails, getTokenDecimalsFromDetails } from '@/lib/chronik';

vi.mock('@/lib/chronik', () => ({
  fetchTokenDetails: vi.fn(),
  getTokenDecimalsFromDetails: vi.fn(),
}));

vi.mock('@/config/tokens', () => ({
  tokens: {
    token1: {
      tokenId: 'token1-id',
      name: 'Token 1',
      symbol: 'TK1',
      decimals: 2,
    },
    token2: {
      tokenId: 'token2-id',
      name: 'Token 2',
      symbol: 'TK2',
      decimals: 2,
    },
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

const mockFetchTokenDetails = fetchTokenDetails as ReturnType<typeof vi.fn>;
const mockGetTokenDecimalsFromDetails = getTokenDecimalsFromDetails as ReturnType<typeof vi.fn>;

describe('OrderList UI', () => {
  const mockAddress = 'ecash:qp3wjpa3tjlj042z2wv7hahsldgwhwy0rq9sywjpyy';

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockFetchTokenDetails.mockResolvedValue({} as any);
    mockGetTokenDecimalsFromDetails.mockImplementation((detail, fallback) => fallback);
  });

  it('sorts latest orders to the top by createdAt', async () => {
    localStorage.setItem('swap_orders', JSON.stringify({
      [`token2-id|${mockAddress}|100`]: {
        remainingAmount: 100,
        maxPrice: 100,
        status: 'pending',
        transactions: [],
        orderType: 'online',
        createdAt: '2026-04-19T08:00:00.000Z',
      },
      [`token1-id|${mockAddress}|100`]: {
        remainingAmount: 100,
        maxPrice: 100,
        status: 'pending',
        transactions: [],
        orderType: 'online',
        createdAt: '2026-04-20T08:00:00.000Z',
      },
    }));

    const { container } = render(<OrderList ecashAddress={mockAddress} balance={10000} />);

    await waitFor(() => {
      expect(screen.getByText('Token 1')).toBeInTheDocument();
      expect(screen.getByText('Token 2')).toBeInTheDocument();
    });

    const cards = Array.from(
      container.querySelectorAll('[data-testid^="order-card-"]'),
    );

    expect(cards).toHaveLength(2);
    expect(within(cards[0]!).getByText('Token 1')).toBeInTheDocument();
    expect(within(cards[1]!).getByText('Token 2')).toBeInTheDocument();
  });

  it('shows created time on the left and icon-only actions on the right', async () => {
    localStorage.setItem('swap_orders', JSON.stringify({
      [`token1-id|${mockAddress}|100`]: {
        remainingAmount: 100,
        maxPrice: 100,
        status: 'partial',
        transactions: [
          {
            txid: 'abc123456789',
            amount: 10,
          },
        ],
        orderType: 'online',
        createdAt: '2026-04-20T08:00:00.000Z',
      },
    }));

    render(<OrderList ecashAddress={mockAddress} balance={10000} />);

    await waitFor(() => {
      expect(screen.getByTestId(`order-time-token1-id|${mockAddress}|100`)).toBeInTheDocument();
    });

    expect(screen.getByLabelText('View Transactions')).toBeInTheDocument();
    expect(screen.getByLabelText('Cancel Order')).toBeInTheDocument();
    expect(screen.getByTestId(`order-time-token1-id|${mockAddress}|100`).textContent).not.toBe('Unknown time');
  });
});
