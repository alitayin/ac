# Temporary Review Notes

临时记录，后续逐项确认要不要改。

## 已处理

- Remove hidden 0.2% buy execution cushion.
  - `Auto.js` 之前会把 order `maxPrice` 放宽成 `maxPrice * 1.002`。
  - 已改为执行时使用用户确认/订单保存的原始 `maxPrice`。

- Execute matching buy offers cheapest-first.
  - UI quote 已经按 sell order 价格升序模拟。
  - 执行路径也应按 `pricePerToken` 升序尝试 offers，避免执行顺序和 quote 不一致。

## 待确认

- Sweep spend cap.
  - 你的语义：用户输入例如 `50000 XEC`，系统按当前卖盘模拟市价买入，算出能买多少 token，并把 `maxPrice` 标到这次模拟中实际匹配到的最高价。
  - 待改点：确认/余额校验应使用 sweep quote 的真实 `totalCostXec`，不要用 `receiveAmount * maxMatchedPrice` 近似。

- TokenTable etokendb short cache.
  - 给 `/api/etokendb/tokens`、status、detail 加短 CDN/server cache，例如 `s-maxage=30, stale-while-revalidate=120`。
  - 目标：减少每个用户冷启动都打远端 etokendb，提高列表首屏稳定性。

- TokenTable local cache first.
  - 页面打开先展示浏览器本地缓存的旧 token stats，再后台检查 etokendb availability 和刷新。
  - 目标：etokendb 慢或短暂不可用时，不让用户先等几秒空状态。

- TokenTable batch row updates.
  - 当前 hydrate token info 时可能每个 token 调一次 `setData`。
  - 待改点：收集一批 token patch 后一次性更新，减少反复 render/sort/filter。

- WebSocket subscription stable key/ref-count.
  - 当前 token table 数据变化可能反复 watch token ids。
  - 待改点：token id 列表没变就不重订阅；多个组件订阅同 token 时用 ref-count，最后一个取消时才 unsubscribe。

- Quality gates.
  - 当前 `package.json` 里 `eslintIgnore: ["**/*"]` 等于 lint 没检查文件。
  - `next.config.mjs` 也设置 build 忽略 lint。
  - 待确认是否逐步打开 lint/typecheck。

- WebSocket token subscription leak.
  - `watchAgoraTokens` cleanup 只删 handler，不删全局 watched token ids。
  - 可能导致长期使用后 watch 集合越来越大。

- External URL allowlist.
  - token/project metadata URL 目前有些地方直接渲染到 `<a href>`。
  - 待改点：统一只允许 `http:`/`https:`，拒绝 `javascript:`、`data:` 等协议。

- Amount math as BigInt sats/atoms.
  - 一些交易路径仍用 JS `number` / `parseFloat` / `Math.floor(amount * 10^decimals)`。
  - 待改点：交易金额从字符串直接解析为 BigInt atoms/sats，显示时才转 number/string。

- Listing cancel decimals.
  - `listinglist.tsx` cancel path 里 `Math.pow(10, 0)` 硬编码 decimals 为 0。
  - 对有 decimals 的 token，cancel 包装出的 amount 可能不准。

- Mnemonic storage.
  - 当前 mnemonic 会存在本地 storage 并在 app state/执行路径使用。
  - 这是安全风险项，是否改取决于当前产品对内置钱包的取舍。
