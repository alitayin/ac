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
    ├── chronik-transactions.test.ts  # 区块链交易处理测试 (31 tests)
    ├── token-stats.test.ts           # Token 统计计算测试 (30 tests)
    ├── agora-orders.test.ts          # Agora 订单簿测试 (2 tests)
    ├── formatters.test.ts            # 格式化函数测试 (46 tests)
    ├── time-utils.test.ts            # 时间工具测试 (24 tests)
    └── price-data-utils.test.ts      # 价格数据处理测试 (待实现)
```

## 已实现的测试

### 1. chronik-transactions.test.ts (31 个测试)

测试核心区块链交易处理逻辑：

**isAgoraCanceled()**
- ✅ 检测已取消交易（OP_0）
- ✅ 识别正常交易
- ✅ 处理空脚本
- ✅ 处理 OP_PUSHDATA1/2/4 操作码
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

**交易处理边界情况**
- ✅ 缺失 XEC 输出
- ✅ sats vs value 字段处理
- ✅ 时间戳选择逻辑
- ✅ 未来时间戳处理
- ✅ 缺失 txid/hash
- ✅ 零/极大 token 数量
- ✅ 多输入交易

### 2. token-stats.test.ts (30 个测试)

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

**Summary 缓存函数**
- ✅ getCachedTokenSummary / setCachedTokenSummary
- ✅ deleteSummaryCache
- ✅ refreshSummaryCacheTimestamps
- ✅ 处理缺失字段

**边界情况**
- ✅ 零价格交易
- ✅ 相同价格交易
- ✅ 极大/极小价格值
- ✅ 24h 边界交易
- ✅ 空数组处理
- ✅ 阈值边界交易

### 3. agora-orders.test.ts (2 个测试)

测试 Agora 订单簿逻辑：

- ✅ 缺失 tokenId 返回错误
- ✅ 优雅处理错误

### 4. formatters.test.ts (46 个测试) ⭐ 新增

测试所有格式化函数：

**formatNumber()**
- ✅ null/undefined 处理
- ✅ 十亿/百万/千位格式化（B/M/K）
- ✅ 小数字格式化
- ✅ noDecimals 标志
- ✅ 负数处理
- ✅ 零值处理

**formatPrice()**
- ✅ null/undefined 处理
- ✅ 不同价格范围精度（>=1, >=0.1, >=0.01, <0.01）
- ✅ 边界值处理
- ✅ 精度舍入
- ✅ 尾随零移除
- ✅ 负数处理

**convertPrice()**
- ✅ XEC 模式格式化
- ✅ USD 模式转换
- ✅ 不同价格范围
- ✅ 尾随零处理
- ✅ 最小小数位数保持

**shortenAddress()**
- ✅ 默认 3 字符截取
- ✅ 自定义字符数

**getChartColor()**
- ✅ 5 色循环
- ✅ 透明度处理

### 5. time-utils.test.ts (24 个测试) ⭐ 新增

测试所有时间工具函数：

**getRelativeTime()**
- ✅ "just now" (<60s)
- ✅ 分钟前 (60s-1h)
- ✅ 小时前 (1h-24h)
- ✅ 天前 (>24h)
- ✅ 边界值处理

**formatTime()**
- ✅ M/D, HH:MM 格式
- ✅ 零填充
- ✅ 午夜/正午处理
- ✅ 月份边界

**getLastNDays()**
- ✅ 不同天数
- ✅ 日期顺序
- ✅ 升序排列

**parseUTCDate()**
- ✅ UTC 时区解析
- ✅ 自动添加 Z

**formatDateShort()**
- ✅ 短日期格式
- ✅ 不同月份

## 测试覆盖率

**当前覆盖率 (v3.8.3):**

| 文件 | 语句 | 分支 | 函数 | 行数 |
|------|------|------|------|------|
| **总体** | **59.76%** | **49.19%** | **57.83%** | **61.23%** |
| formatters.ts | **96.49%** ✅ | 96.29% | 100% | 96% |
| time-utils.ts | **100%** ✅ | 100% | 100% | 100% |
| token-stats.ts | **94.57%** ✅ | 74.41% | 96.29% | 95.61% |
| chronik-transactions.ts | 36.12% | 31.28% | 30% | 37.41% |
| agora-orders.ts | 33.33% | 25% | 25% | 38.23% |

**改进对比:**

| 指标 | v3.8.2 | v3.8.3 | 提升 |
|------|--------|--------|------|
| 总体覆盖率 | 47.18% | 59.76% | +12.58% |
| 测试数量 | 35 | 164 | +129 |
| 测试文件 | 3 | 5 | +2 |

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
✓ __tests__/unit/chronik-transactions.test.ts (31 tests)
✓ __tests__/unit/token-stats.test.ts (30 tests)
✓ __tests__/unit/agora-orders.test.ts (2 tests)
✓ __tests__/unit/formatters.test.ts (46 tests)
✓ __tests__/unit/time-utils.test.ts (24 tests)

Test Files  5 passed (5)
Tests  164 passed (164)
```

## 下一步扩展

### Phase 2: 继续增强现有测试
- agora-orders.test.ts - 添加 formatOffer, calculateStats 测试
- chronik-transactions.test.ts - 添加 fetchAgoraTransactionsFromChronik 测试

### Phase 3: 新增测试文件
- price-data-utils.test.ts - 图表数据处理测试

### Phase 4: 集成测试
- WalletContext 测试
- OrderProcessingContext 测试
- AutoExecutionContext 测试

### Phase 5: 组件测试
- BuyCard 组件测试
- OrderBook 组件测试
- TokenTable 组件测试

### Phase 6: E2E 测试
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
