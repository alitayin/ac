# Changelog

记录每次代码改动的详细信息（给用户看的）

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
