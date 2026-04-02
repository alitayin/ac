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
├── setup.ts                          # 测试环境配置
├── helpers/
│   ├── mocks.ts                      # Mock 数据和函数
│   └── test-utils.tsx                # 测试工具函数
└── unit/
    ├── chronik-transactions.test.ts  # 区块链交易处理测试
    ├── token-stats.test.ts           # Token 统计计算测试
    └── agora-orders.test.ts          # Agora 订单簿测试
```

## 已实现的测试

### 1. chronik-transactions.test.ts (21 个测试)

测试核心区块链交易处理逻辑：

**isAgoraCanceled()**
- ✅ 检测已取消交易（OP_0）
- ✅ 识别正常交易
- ✅ 处理空脚本
- ✅ 处理 OP_PUSHDATA1/2 操作码
- ✅ 检测复杂脚本中的独立 OP_0

**detectAgoraTokenId()**
- ✅ 检测有效 Agora 交易并返回 tokenId
- ✅ 过滤无效标记的交易
- ✅ 过滤已取消交易
- ✅ 处理缺失 token 输出
- ✅ 处理零 token 数量
- ✅ 处理缺失 inputs/outputs
- ✅ 处理 null 交易
- ✅ 从 output[2] 检测 tokenId
- ✅ 支持 tokenIdHex 和 tokenIdStr 字段

### 2. token-stats.test.ts (13 个测试)

测试 Token 统计和缓存逻辑：

**calculateStats()**
- ✅ 空交易返回零统计
- ✅ 单笔交易统计计算
- ✅ 24 小时价格变化计算
- ✅ 30 天交易量（基于区块高度）
- ✅ 处理无 blockHeight 的交易

**pruneRecentTransactions()**
- ✅ 按区块高度过滤 30 天内交易
- ✅ 按时间戳过滤（无区块高度阈值时）
- ✅ 排除无 blockHeight 的交易

**compute24hStats()**
- ✅ 空交易返回零统计
- ✅ 计算最早到最新的价格变化
- ✅ 计算总 XEC 交易量

**缓存函数**
- ✅ 保存和检索缓存数据
- ✅ 不存在的缓存返回 null
- ✅ 无效缓存数据返回 null
- ✅ 清除所有 token 缓存
- ✅ 使特定 token 缓存失效

### 3. agora-orders.test.ts (2 个测试)

测试 Agora 订单簿逻辑：

- ✅ 缺失 tokenId 返回错误
- ✅ 优雅处理错误

## 测试覆盖率

当前测试覆盖核心业务逻辑：

- **lib/chronik-transactions.ts**: 高覆盖率（isAgoraCanceled, detectAgoraTokenId）
- **lib/token-stats.ts**: 高覆盖率（统计计算、缓存函数）
- **lib/agora-orders.ts**: 基础覆盖（错误处理）

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
✓ __tests__/unit/chronik-transactions.test.ts (21 tests)
✓ __tests__/unit/token-stats.test.ts (13 tests)
✓ __tests__/unit/agora-orders.test.ts (2 tests)

Test Files  3 passed (3)
Tests  35 passed (35)
```

## 下一步扩展

### Phase 2: 集成测试
- WalletContext 测试
- OrderProcessingContext 测试
- AutoExecutionContext 测试

### Phase 3: 组件测试
- BuyCard 组件测试
- OrderBook 组件测试
- TokenTable 组件测试

### Phase 4: E2E 测试
- 使用 Playwright 测试完整用户流程

## 注意事项

1. **构建前测试**: 按照 CLAUDE.md 规范，每次 commit 前必须运行 `npm run build` 确保无错误
2. **测试隔离**: 每个测试用例独立运行，使用 `beforeEach` 清理状态
3. **Mock 数据**: 使用 `__tests__/helpers/mocks.ts` 中的工厂函数创建测试数据
4. **覆盖率目标**: 核心业务逻辑目标 70%+ 覆盖率

## 配置文件

- `vitest.config.ts` - Vitest 配置
- `__tests__/setup.ts` - 测试环境初始化
- `package.json` - 测试脚本定义
