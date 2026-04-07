AgoraCash v3.9.4 — Performance Optimization Update

Hey everyone! We just shipped v3.9.4 with significant performance improvements under the hood:

- Optimized OrderBook rendering to eliminate redundant calculations — smoother order book updates with large datasets
- Reduced unnecessary component re-renders across the app — faster UI response when interacting with wallet and contexts
- Added smart request deduplication for token data fetching — fewer duplicate API calls, faster page loads

No user-facing changes — just cleaner internals that make the codebase more efficient and the app more responsive going forward.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
