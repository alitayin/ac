# AgoraCash

A comprehensive marketplace monitoring and trading platform for eCash (XEC) eTokens built on the Agora protocol.

## Overview

AgoraCash provides real-time market analysis, order book monitoring, and decentralized trading services for the eCash community. The platform enables users to discover, track, and trade eTokens on the Agora marketplace with advanced features like automated order execution, price alerts, and detailed market analytics.

## Features

### 🔍 Market Monitoring
- Real-time eToken price tracking and statistics
- Live order book visualization
- Token transaction history and flow analysis
- Market depth charts and volume analytics
- Address distribution tracking

### 💱 Trading & Swapping
- Decentralized token swapping via Agora protocol
- Guest mode (temporary wallet) and Cashtab Connect integration
- Automated order execution with customizable parameters
- Price slippage protection
- Multi-token support with instant price discovery

### 📊 Analytics Dashboard
- Agora marketplace statistics
- Real-time eToken flow visualization
- Price charts with historical data
- Volume tracking and trends
- Token supply and holder distribution

### 🎯 Token Listing
- **Activate Swap**: Enable trading functionality for your token (1,000,000 SS)
- **Regular Recommendation**: Featured placement in all eTokens tab (15,000 SC)

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **Blockchain**: 
  - `ecash-lib` - eCash blockchain interactions
  - `ecash-agora` - Agora protocol integration
  - `chronik-client` - Blockchain indexer
  - `cashtab-connect` - Wallet connectivity
- **Charts**: Recharts, Lightweight Charts
- **Testing**: Vitest + React Testing Library
- **Animations**: Framer Motion

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm/yarn/pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/agoracash.git
cd agoracash

# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Build for Production

```bash
# Build the application
npm run build

# Start production server
npm start
```

**Important**: Always run `npm run build` locally before pushing to ensure there are no TypeScript or build errors.

## Testing

```bash
# Run tests
npm test

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage
```

## Project Structure

```
agoracash/
├── app/                    # Next.js app router pages
│   ├── page.tsx           # Home page (token table & stats)
│   ├── swap/              # Swap interface
│   ├── list/              # Token listing page
│   └── about/             # About page
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── swap/             # Swap-specific components
│   └── magicui/          # Animation components
├── lib/                   # Utilities and business logic
│   ├── agora-orders.ts   # Agora order book fetching
│   ├── chronik.ts        # Blockchain queries
│   ├── context/          # React contexts
│   └── types.ts          # TypeScript definitions
├── config/               # Configuration files
│   └── tokenconfig.ts    # Token definitions
└── __tests__/            # Test files
```

## Key Components

### Swap Panel
The main trading interface supporting:
- Buy/Sell order creation
- Price calculation with slippage
- Order book integration
- Wallet management (guest mode + Cashtab)
- Automated order execution

### Token Table
Displays all available eTokens with:
- Real-time prices and 24h changes
- Volume and market cap
- Quick access to token details
- Sorting and filtering

### Order Book
Live order book visualization showing:
- Active buy/sell orders
- Price levels and depths
- Order execution simulation

## Configuration

### Token Configuration
Edit `config/tokenconfig.ts` to add or modify supported tokens.

### Environment Variables
Create a `.env.local` file for any required environment variables (if applicable).

## Version Management

Version is tracked in two files:
- `package.json` → `"version"`
- `version.json` → `"version"`

Both must be updated together for each release.

## Contributing

Contributions are welcome! Please ensure:
1. All tests pass (`npm test`)
2. Build succeeds without errors (`npm run build`)
3. Code follows existing patterns and conventions
4. No TypeScript errors (avoid using `@ts-ignore` without justification)

## Community

- **Telegram**: [Join our community](https://t.me/agoraUI)
- **Email**: alitaweb3@gmail.com

## About Star Shard (SS) and Star Crystal (SC)

These tokens were created by the original owner for development funding. AgoraCash honors these tokens as payment for services at rates equal to or greater than their original sale prices:
- Star Shard (SS): Originally 5 XEC
- Star Crystal (SC): Originally 300 XEC

## License

This project is maintained by alitayin and the eCash community.

## Acknowledgments

Built on the eCash blockchain and Agora protocol, serving the eCash community with decentralized trading infrastructure.

---

**Current Version**: 3.9.1

For support or inquiries, contact alitaweb3@gmail.com or join our Telegram community.
