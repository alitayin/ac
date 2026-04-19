# Changelog

记录每次代码改动的详细信息（给用户看的）

---

## 2026-04-20

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
