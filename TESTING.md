# AgoraCash 测试文档

## 测试框架

- **测试框架**: Vitest 4.1.2
- **UI 测试**: @testing-library/react
- **覆盖率工具**: @vitest/coverage-v8

## 测试命令

```bash
# 运行所有测试
pnpm test

# 运行测试并生成覆盖率报告
pnpm run test:coverage

# 打开测试 UI 界面
pnpm run test:ui
```

> 注：本仓库使用 pnpm 管理（见 `package.json` 的 `packageManager` 字段），`package.json` 中测试脚本定义为 `"test": "vitest"`，因此用 `pnpm test` 运行。

## 测试结构

```
__tests__/
├── setup.ts                           # 测试环境配置
├── fixtures/                          # Chronik / Agora / UTXO 测试数据
│   ├── chronik.ts                     # Chronik 交易和分页场景
│   ├── agora.ts                       # Agora offer 和 orderbook 场景
│   ├── auto.ts                        # Auto 订单验证场景
│   └── utxos.ts                       # UTXO 数组场景
├── helpers/
│   ├── mocks.ts                       # Mock 数据和函数
│   └── test-utils.tsx                 # React 测试工具函数
├── integration/
│   └── storage-migration.test.ts      # 本地存储迁移集成测试
└── unit/
    ├── 数据与业务逻辑测试              # chronik / etokendb / stats / fee / storage / firma
    ├── UI 组件测试                     # OrderBook / token-selector / swap cards
    ├── SwapPanel 行为测试              # debounce / polling / memoization / cache
    └── Context 与遗留模块测试          # WalletContext / Auto / Buy
```

## 已实现的测试

当前测试套件共 **51 个测试文件**（50 个 unit + 1 个 integration），主要分为以下几类：

> 说明：本仓库经历了多次重构与合并，早期拆分出的多个专项测试文件
> （如 `SwapPanel-debounce.test.tsx`、`SwapPanel-polling.test.tsx`、
> `SwapPanel-memoization.test.tsx`、`SwapPanel-orderbook-cache.test.tsx`、
> `AllEtokensView-batch.test.ts` 等）已合并或重命名，现以
> `SwapPanel.behavior.test.tsx`、`token-page.test.tsx` 等聚合文件的形式存在。
> 具体以 `__tests__/unit/` 下的实际文件为准。

### 1. 数据与区块链逻辑

- `chronik-transactions.test.ts` 覆盖 Agora 交易识别、取消检测、时间戳和 token 输出边界情况
- `agora-orders.test.ts` 覆盖订单获取和错误处理
- `agora-stats.test.ts` 覆盖统计聚合与 API 路由逻辑
- `etokendb.test.ts` 覆盖 token 查询、状态读取和失败回退
- `token-stats.test.ts`、`token-page-stats.test.ts` 覆盖统计、缓存和页面聚合
- `networkFee.test.ts`、`formatters.test.ts`、`time-utils.test.ts` 覆盖基础工具函数
- `firma.test.ts`、`firma-depeg-alert.test.tsx`、`firma-history-filter.test.ts`、`firma-bid-route.test.ts` 覆盖 Firma/XEC 报价与交易保护

### 2. UI 与交互测试

- `token-selector.test.tsx` 覆盖 token 过滤、余额显示和选择行为
- `swap-cards.test.tsx` 覆盖 `PriceCard`、`SpendCard`、`BuyCard`
- `OrderBook.test.tsx`、`orderlist-token-loading.test.tsx`、`orderlist-ui.test.tsx` 覆盖主要列表与表格交互
- `SwapPanel.behavior.test.tsx` 覆盖核心面板行为（debounce / polling / memoization / 订单簿缓存）
- `token-page.test.tsx`、`TokenProjectInfoCard.test.tsx`、`TokenTable.test.tsx` 覆盖 token 详情页与列表

### 3. Context、存储与迁移

- `WalletContext.test.tsx` 覆盖钱包状态与本地存储交互
- `AutoExecutionContext.test.tsx` 覆盖订单自动执行上下文
- `storage-manager.test.ts` 覆盖 schema、TTL 和版本迁移逻辑
- `storage-migration.test.ts` 覆盖跨版本存储迁移集成流程

### 4. 遗留 JS 模块

- `Auto.test.js` 和 `Buy.test.js` 维持对遗留 JS 逻辑（`lib/Auto.js`、`lib/Buy.js`）的回归保护

## 测试覆盖率

覆盖率数据需运行 `pnpm run test:coverage` 生成，此处不再维护过期的静态快照（历史快照已与当前 51 个测试文件的规模严重脱节）。

若需要，运行后从 `coverage/` 生成的报告中读取最新的语句/分支/函数/行覆盖率。

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
pnpm test

# 生成覆盖率报告
pnpm run test:coverage
```

> 具体「测试通过数」以运行时输出为准（历史上从 300+ 增长到 480+，随功能持续增长，文档不再硬编码该数值）。

## 下一步扩展

### 优先补强
- `websocket-client.ts`、`chronik.ts` 的单元测试
- `AutoExecutionContext` 的集成测试
- 价格图表与 WebSocket 订阅链路的行为测试

### 端到端测试
- 使用 Playwright 覆盖连接钱包、下单、撤单、查看订单簿等核心流程

## 注意事项

1. **提交前验证**: 每次 commit 前至少运行 `pnpm test` 和 `pnpm build`
2. **测试隔离**: 每个测试用例独立运行，使用 `beforeEach` 清理状态
3. **Mock 数据**: 使用 `__tests__/helpers/mocks.ts` 中的工厂函数创建测试数据
4. **覆盖率目标**: 核心业务逻辑目标 70%+ 覆盖率

## 配置文件

- `vitest.config.ts` - Vitest 配置
- `__tests__/setup.ts` - 测试环境初始化
- `package.json` - 测试脚本定义
