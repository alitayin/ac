# Changelog

记录每次代码改动的详细信息（给用户看的）

---

## 2026-08-13

### 🎨 UI 改进

**主要改动：**
- 合并 "Buy orders" 和 "My listing" 标签页到统一的 "Orders" 标签页
- 在 Orders 页面内添加切换按钮来查看买单或卖单
- 减少顶层标签页数量，界面更简洁
- 添加无障碍属性（aria-pressed, aria-label）提升可访问性
- 添加空值检查避免潜在的运行时错误
- My Listings 现在只在有卖单时才显示筛选器（与 Buy Orders 行为一致）

**验证：**
- ✅ `npm run build` 构建成功
- ✅ Subagent 代码审查通过

---

## 2026-05-10

### 🎉 v4.3.10 发布

**主要改动：**
- Enabled real ESLint scanning by removing the global `eslintIgnore: ["**/*"]`
- Cleared all `react-hooks/exhaustive-deps` warnings across swap, promote, token detail, TokenTable, wallet, order/listing, and related UI paths
- Stabilized hook dependencies and cleanup refs to avoid stale callbacks and timer cleanup drift

**验证：**
- ✅ `npm run lint` 通过（剩余 3 个 `<img>` 优化 warning）
- ✅ `npm test -- __tests__/unit/OrderBook.test.tsx __tests__/unit/orderlist-ui.test.tsx __tests__/unit/orderlist-token-loading.test.tsx __tests__/unit/SwapPanel.behavior.test.tsx __tests__/unit/TokenTable.test.tsx __tests__/unit/token-page.test.tsx __tests__/unit/WalletContext.test.tsx` 通过
- ✅ `git diff --check` 通过

---

### 🎉 v4.3.9 发布

**主要改动：**
- Fixed Agora token WebSocket subscriptions so token watches are deduped and unsubscribed when the last watcher leaves
- Added safe external URL filtering for Project Info links, token lookup URLs, and wallet token metadata URLs
- Synced the displayed app version with the package version

**验证：**
- ✅ `npm test -- __tests__/unit/agora-ws.test.ts __tests__/unit/safe-url.test.ts __tests__/unit/TokenProjectInfoCard.test.tsx __tests__/unit/TokenTable.test.tsx __tests__/unit/header-analytics.test.tsx` 通过
- ✅ `git diff --check` 通过

---

### 🎉 v4.3.8 发布

**主要改动：**
- Sweep buy now uses the actual quote token cost as the hard spend cap instead of `receiveAmount * maxMatchedPrice`
- Sweep orders persist a `tokenCostCapXec` so execution cannot overspend the quoted ladder cost while still using max matched price as protection
- Listing cancellation now uses the raw offer atom amount, fixing tokens with decimals

**验证：**
- ✅ `npm test -- __tests__/unit/SwapPanel.behavior.test.tsx __tests__/unit/agora-orders.test.ts __tests__/unit/Buy.test.js __tests__/unit/Auto.test.js` 通过

---

### 🎉 v4.3.7 发布

**主要改动：**
- Removed hidden 0.2% buy execution cushion so saved max price is enforced exactly
- Buy execution now tries matching Agora offers cheapest-first to align execution with quote simulation
- Added unit coverage for exact max price execution and cheapest-first offer execution

**验证：**
- ✅ `npm test -- __tests__/unit/Auto.test.js __tests__/unit/Buy.test.js` 通过
- ✅ `npm run lint` 通过

---

## 2026-05-08

### 🎉 v4.3.6 发布

**主要改动：**
- Added Buy entry in Project Info header with `/swap` token prefill
- Added Project Info disclaimers and removed legacy token-page swap logic
- Increased Project Info height so Basics display fully

**验证：**
- ✅ `pnpm vitest run __tests__/unit/TokenProjectInfoCard.test.tsx __tests__/unit/token-page.test.tsx __tests__/unit/SwapPanel.behavior.test.tsx` 通过
- ✅ `pnpm build` 通过

---

## 2026-05-08

### 🎉 v4.3.5 发布

**主要改动：**
- Removed card shadows from token detail charts, trading, and homepage TokenTable
- Kept card borders and rounded corners for a flatter interface

**验证：**
- ✅ `pnpm vitest run __tests__/unit/token-page.test.tsx __tests__/unit/TokenProjectInfoCard.test.tsx __tests__/unit/token-charts.test.tsx __tests__/unit/TokenTable.test.tsx` 通过
- ✅ `pnpm build` 通过

---

## 2026-05-08

### 🎉 v4.3.4 发布

**主要改动：**
- Token detail Stats now uses a compact standalone card beside Project Info
- Project Info editing remains available for token creators

**验证：**
- ✅ `pnpm vitest run __tests__/unit/token-page.test.tsx __tests__/unit/TokenProjectInfoCard.test.tsx` 通过
- ✅ `pnpm build` 通过

---

## 2026-05-08

### 🎉 v4.3.3 发布

**主要改动：**
- Token 详情页右栏发布 Project Info 卡片，替代原 swap 卡片并合并基础 token 信息
- Project Info 支持 token creator 编辑，展示基础链接、creator 地址、创建时间和区块
- 编辑 Project Info 时自动为 Website / X / Telegram 补全 `https://`，避免后端 URL 校验拒绝
- TokenTable 的 Score 星星改为按 10 分制比例动态填充，10 分显示全亮星星，5 分显示半数填充

**验证：**
- ✅ `pnpm vitest run __tests__/unit/token-page.test.tsx __tests__/unit/TokenProjectInfoCard.test.tsx` 通过
- ✅ `pnpm vitest run __tests__/unit/review-score.test.ts __tests__/unit/TokenTable.test.tsx` 通过

---

## 2026-05-05

### 🎉 v4.2.2 发布

**主要改动：**
- TokenTable 未评分状态显示为 `Unrated`，不再显示默认 `1.0`
- 未评分 token 使用灰色星星和 muted chip，并在提示中标记为 `still unproven`
- 评分排序中未评分按 `0` 处理，排在有评分 token 后面
- 评分弹窗的当前平均分同步使用未评分状态，避免金色星星误导

**验证：**
- ✅ `npm test -- __tests__/unit/review-score.test.ts __tests__/unit/TokenTable.test.tsx` 通过
- ✅ `pnpm build` 通过
- ✅ `git diff --check` 通过

---

## 2026-05-04

### 🎉 v4.2.1 发布

**主要改动：**
- TokenTable 的评分改为独立 `Score` 列，位置在 `Name` 后、`Price` 前
- 新增按评分排序能力，交互方式与现有可排序列保持一致
- 评分显示统一为中性灰风格，未评分默认显示 `1.0`，星星颜色固定为金色

**验证：**
- ✅ `npm test -- __tests__/unit/review-score.test.ts __tests__/unit/TokenTable.test.tsx` 通过
- ✅ `pnpm build` 通过
- ✅ `git diff --check` 通过

---

## 2026-05-03

### 🎉 v4.2.0 发布

**主要改动：**
- 新增 paid token reviews 流程，支持 `1-10` 分评分、可选评论、支付后自动提交 txid 并等待后端验证
- `TokenTable` 评分能力接入 etokendb summary 字段，token 详情页新增 `Comments` 面板，并支持主区/右侧栏切换展示
- 评论提交改为仅允许 mnemonic-backed wallet，移除登录抽屉里的 `Connect with Cashtab` 入口，避免 address-only 会话误导用户进入不可支付流程
- 调整 token 详情页右侧栏顺序为 `Swap -> Comments -> Order Book -> Info`，将 `Info` 固定到底部
- 收紧 paid review 弹窗的 light mode 样式，改为纯白面板并压缩上下留白

**验证：**
- ✅ `npm test -- __tests__/unit/token-page.test.tsx __tests__/unit/wallet-connect-drawer-inner.test.tsx __tests__/unit/WalletContext.test.tsx` 通过
- ✅ `pnpm build` 通过
- ✅ `git diff --check` 通过

---

## 2026-04-24

### 🎉 v4.1.8 发布

**主要改动：**
- 将订单服务与 WebSocket 默认地址切换到 `acws.alitayin.com`，并兼容旧的 `api.agora.cash` 环境变量覆写
- 强化 `Auto.js` 订单同步链路，补充请求失败、响应解析失败和服务端拒绝时的日志与保护逻辑
- 将 Agora 买单 `network fee` 估算改为按可花 XEC UTXO 数量计算，当前公式为 `12 + 7 * UTXO 数量`

**验证：**
- ✅ `npm test -- --run __tests__/unit/Auto.test.js __tests__/unit/networkFee.test.ts __tests__/unit/token-page.test.tsx __tests__/unit/SwapPanel.behavior.test.tsx` 通过

---

### 🎉 v4.1.7 发布

**主要改动：**
- 将 `api.agora.cash/ws` 从全局 provider 链路中移除，避免订单同步连接影响 swap 主流程
- 将订单同步改为后台队列并增加超时控制，`api.agora.cash` 不可用时不再阻塞本地自动执行
- 更新 header 状态语义，明确显示为 `Order sync` 连接状态

**验证：**
- ✅ `npm test -- __tests__/unit/header-analytics.test.tsx __tests__/unit/WalletContext.test.tsx __tests__/unit/Auto.test.js __tests__/unit/token-page.test.tsx __tests__/unit/AutoExecutionContext.test.tsx __tests__/unit/SwapPanel.behavior.test.tsx` 通过

---

## 2026-04-20

### 🎉 v4.0.9 发布

**主要改动：**
- BUY 面板 `Spend` 区域的 XEC 币种显示改为静态 `ecash logo + ecash`，不再伪装成可点击按钮
- 精简并重排确认下单弹窗，只保留关键金额与费用信息，减少重复文案和视觉噪音
- 补充确认弹窗单测，并更新 swap 卡片相关测试

**验证：**
- ✅ `npm test` 通过
- ✅ `npm run build` 通过

---

### 🎉 v4.0.8 发布

**主要改动：**
- 将 Agora swap 手续费地址更新为 `ecash:qpaw7v7sfvlsm4px33saggr63jgsalsx4q49m7n6v4`
- 在 token 页面移除 `Cashtab` 跳转按钮，不再从该页跳转到 Cashtab

**验证：**
- ✅ `npm test` 通过
- ✅ `npm run build` 通过

---

### 🎉 v4.0.7 发布

**主要改动：**
- Agora 买单接入 0.5% swap fee，并在买单界面展示 swap fee、network fee 和 total fees 汇总
- `My orders` 列表改为按创建时间倒序排列，最新订单显示在最上方
- 订单卡片底部左侧新增创建时间，右侧操作区改为 icon-only `ghost` 按钮，统一放置查看交易、退款和删除/取消操作
- 补充订单列表 UI 测试和 swap fee 相关单测

**验证：**
- ✅ `npm test` 通过
- ✅ `npm run build` 通过

---

## 2026-04-17

### 🎉 v4.0.6 发布

**主要改动：**
- `AllEtokensView` 改为按页并发加载 token 详情，并批量更新列表状态
- `SwapPanel` 的 order book 缓存增加并发中的请求去重，减少同 token 重复请求
- `TokenSelector` 优先读取本地 token 详情缓存，只对缺失 token 并发拉取详情
- 移除 `SwapPanel` 中价格警告的镜像 state，直接消费 memo 派生值
- 补充相关单测，覆盖批量加载、缓存命中和 in-flight request deduplication

**验证：**
- ✅ `npm test` 通过
- ✅ `npm run build` 通过

---

### 文档与配置同步整理

**主要改动：**
- 同步 `README.md` 中的构建前检查说明和当前版本号
- 更新 `TESTING.md`，使测试结构、测试数量和覆盖率说明与当前仓库一致
- 删除 `next.config.mjs` 中未使用的 `path` 导入
- 清理 `.gitignore` 中重复的内部文档忽略项

**影响：**
- 无运行时行为变化
- 改善项目文档一致性和配置可读性

**验证：**
- ✅ `npm test` 通过
- ✅ `npm run build` 通过

---

## 2026-04-15

### 🎉 v4.0.2 发布

**主要改动：**
- 从 tokens.ts 中移除 GRP、BVE、StarCrystal
- 移除所有硬编码的特权标签（official、stablecoin）
- 保留标签显示逻辑，但不再预先指定特权代币

**验证：**
- ✅ `npm run build` 通过，无错误

---

### 🎉 v4.0.1 发布

**主要改动：**
- 从固定列表中移除 SabongCash 和 TridentbyHodlWars
- 将按钮标签从 "Listed Tokens" 改为 "7D Active Tokens"

**验证：**
- ✅ `npx vitest run __tests__/unit/etokendb.test.ts` 通过
- ✅ `pnpm build` 通过，无错误

---

### 🎉 v4.0.0 发布

**主要改动：**
- 全局切换到 Geist 字体系列（Geist Sans + Geist Mono）
- 升级 ecash-quicksend 到 2.2.0
- 移除 All eTokens 视图中的优先级列表
- 新增 CHANGELOG.md 用于跟踪代码改动

**验证：**
- ✅ `npm run build` 通过，无错误

---

## 2026-04-14

### 全局使用 Geist Mono 字体 (Commit: 67482d0)

**改动内容：**
- 将 body 字体从 Inter 改为 Geist Mono
- 将 logo 字体从 Marlin 改为 Geist Mono
- 整个应用统一使用等宽字体

**验证：**
- ✅ `npm run build` 通过，无错误

---

### 全局切换到 Geist 字体 (Commit: 5715204)

**改动内容：**
- 将 Inter 替换为 Geist Sans（可变字体）
- 将 Marlin 替换为 Geist Mono（可变字体）
- 使用本地字体文件（GeistVF.woff, GeistMonoVF.woff）
- 更新 tailwind.config.ts 配置 font-sans 和 font-mono

**验证：**
- ✅ `npm run build` 通过，无错误

---

### 移除 All eTokens 优先列表 (Commit: b65f6a7)

**改动内容：**
- 移除了 `paidTokenIds` 的导入和排序逻辑
- 删除了 "SC Premium" 徽章显示
- 所有代币现在平等显示，不再有优先排序
- 标记 `paidSC.ts` 为已弃用（保留作为历史参考）

**影响：**
- All eTokens 页面不再区分付费代币和普通代币
- 所有代币按区块链返回的顺序显示

---

### 升级 ecash-quicksend 到 2.2.0 (Commit: 825077c)

**改动内容：**
- 从 2.0.2 升级到 2.2.0
- 新功能：支持在 `sendXec()` 中指定 app prefix 和 message
- 向后兼容 - 现有 Agora DEX 功能不受影响
- 依赖更新：
  - ecash-wallet: ^5.2.0
  - ecash-lib: ^4.12.0
  - chronik-client: ^4.1.0

**新增功能：**
- `sendXec()` 支持 `message` 和 `appPrefixHex` 参数
- 新导出：`CASHTAB_PREFIX_HEX`, `XEC_APP_MESSAGE_BYTE_LIMIT`, `validateAppPrefixHex()`, `validateAppMessage()`, `buildXecAppActionOutput()`, `parseXecAppActionOutput()`

**验证：**
- ✅ `npm run build` 通过，无错误

---

### 更新 CLAUDE.md 工作规范

**改动内容：**
- 精简并重组了工作规范文档
- 添加了环境设置部分（代理配置）
- 新增 Git 提交规范（代码变动必须 commit）
- 新增稳定性规则（规避无限循环和资源耗尽）
- 整合了编码原则（简洁优先、手术式修改）
- 创建了本 CHANGELOG.md 文件用于记录改动

**Commit:** 70ddfa7
