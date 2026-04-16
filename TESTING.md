# AgoraCash 测试文档

## 测试框架

- **测试框架**: Vitest 4.1.2
- **UI 测试**: @testing-library/react
- **覆盖率工具**: @vitest/coverage-v8

## 测试命令

```bash
# 运行所有测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 打开测试 UI 界面
npm run test:ui
```

## 测试结构

```
__tests__/
├── setup.ts                           # 测试环境配置
├── fixtures/                          # Chronik / Agora / UTXO 测试数据
├── helpers/
│   ├── mocks.ts                       # Mock 数据和函数
│   └── test-utils.tsx                 # React 测试工具函数
├── integration/
│   └── storage-migration.test.ts      # 本地存储迁移集成测试
└── unit/
    ├── 数据与业务逻辑测试              # chronik / etokendb / stats / fee / storage
    ├── UI 组件测试                     # OrderBook / token-selector / swap cards
    ├── SwapPanel 行为测试              # debounce / polling / memoization / cache
    └── Context 与遗留模块测试          # WalletContext / Auto / Buy
```

## 已实现的测试

当前测试套件覆盖 25 个测试文件、363 个测试，主要分为以下几类：

### 1. 数据与区块链逻辑

- ✅ `chronik-transactions.test.ts` 覆盖 Agora 交易识别、取消检测、时间戳和 token 输出边界情况
- ✅ `agora-orders.test.ts` 覆盖订单获取和错误处理
- ✅ `agora-stats.test.ts` 覆盖统计聚合与 API 路由逻辑
- ✅ `etokendb.test.ts` 覆盖 token 查询、状态读取和失败回退
- ✅ `token-stats.test.ts`、`token-page-stats.test.ts` 覆盖统计、缓存和页面聚合
- ✅ `networkFee.test.ts`、`formatters.test.ts`、`time-utils.test.ts` 覆盖基础工具函数

### 2. UI 与交互测试

- ✅ `token-selector.test.tsx` 覆盖 token 过滤、余额显示和选择行为
- ✅ `swap-cards.test.tsx` 覆盖 `PriceCard`、`SpendCard`、`BuyCard`
- ✅ `OrderBook.test.tsx`、`orderlist-token-loading.test.tsx`、`AllEtokensView-batch.test.ts` 覆盖主要列表与表格交互
- ✅ `SwapPanel-debounce.test.tsx`、`SwapPanel-polling.test.tsx`、`SwapPanel-memoization.test.tsx`、`SwapPanel-orderbook-cache.test.tsx` 覆盖核心面板行为

### 3. Context、存储与迁移

- ✅ `WalletContext.test.tsx` 覆盖钱包状态与本地存储交互
- ✅ `storage-manager.test.ts` 覆盖 schema、TTL 和版本迁移逻辑
- ✅ `storage-migration.test.ts` 覆盖跨版本存储迁移集成流程

### 4. 遗留 JS 模块

- ✅ `Auto.test.js` 和 `Buy.test.js` 维持对遗留 JS 逻辑的回归保护

## 测试覆盖率

以下数据来自 `npm run test:coverage`：

| 文件 | 语句 | 分支 | 函数 | 行数 |
|------|------|------|------|------|
| **总体** | **53.64%** | **49.45%** | **56.74%** | **53.68%** |
| `app/api/agora-stats/route.ts` | 85.18% | 83.33% | 100% | 85.18% |
| `lib/chronik-transactions.ts` | 91.35% | 79.88% | 95% | 94.52% |
| `lib/etokendb.ts` | 89.76% | 81.48% | 90.9% | 91.73% |
| `lib/formatters.ts` | 96.82% | 96.66% | 100% | 96.42% |
| `lib/storage-manager.ts` | 73.94% | 69.33% | 100% | 77.95% |
| `lib/time-utils.ts` | 100% | 100% | 100% | 100% |
| `lib/token-page-stats.ts` | 86.66% | 52.45% | 75% | 87.71% |
| `lib/token-stats.ts` | 94.26% | 79.01% | 100% | 95.41% |
| `app/swap/SwapPanel.tsx` | 26.93% | 20.27% | 30.98% | 27.07% |

**当前统计：**

- 测试文件: 25
- 测试用例: 363
- 已覆盖领域: 数据获取、订单簿、SwapPanel 关键行为、钱包状态、本地存储迁移
- 主要薄弱点: `offlinebuy.js`、`websocket-client.ts`、`app/swap/SwapPanel.tsx`

## Mock 策略

### localStorage Mock
在 `setup.ts` 中实现了完整的 localStorage mock，支持实际存储操作。

### 外部依赖 Mock
- `chronik-client` - 区块链 API
- `ecash-agora` - Agora 协议客户端
- `ecashaddrjs` - 地址编码
- `ecash-lib` - 加密函数

## 运行测试

```bash
# 运行所有测试
npm test

# 查看测试结果
Test Files  25 passed (25)
Tests      363 passed (363)
```

## 下一步扩展

### 优先补强
- `offlinebuy.js`、`websocket-client.ts`、`chronik.ts` 的单元测试
- `OrderProcessingContext`、`AutoExecutionContext` 的集成测试
- 价格图表与 WebSocket 订阅链路的行为测试

### 端到端测试
- 使用 Playwright 覆盖连接钱包、下单、撤单、查看订单簿等核心流程

## 注意事项

1. **提交前验证**: 每次 commit 前至少运行 `npm test` 和 `npm run build`
2. **测试隔离**: 每个测试用例独立运行，使用 `beforeEach` 清理状态
3. **Mock 数据**: 使用 `__tests__/helpers/mocks.ts` 中的工厂函数创建测试数据
4. **覆盖率目标**: 核心业务逻辑目标 70%+ 覆盖率

## 配置文件

- `vitest.config.ts` - Vitest 配置
- `__tests__/setup.ts` - 测试环境初始化
- `package.json` - 测试脚本定义
