# Temporary Review Notes

临时记录，后续逐项确认要不要改。

## 已处理

- Remove hidden 0.2% buy execution cushion.
  - `Auto.js` 之前会把 order `maxPrice` 放宽成 `maxPrice * 1.002`。
  - 已改为执行时使用用户确认/订单保存的原始 `maxPrice`。

- Execute matching buy offers cheapest-first.
  - UI quote 已经按 sell order 价格升序模拟。
  - 执行路径也应按 `pricePerToken` 升序尝试 offers，避免执行顺序和 quote 不一致。

## 已处理（原「待确认」项中已在 CHANGELOG 落实的）

- Sweep spend cap. ✅ v4.3.8
  - 已改为使用 sweep quote 真实 `tokenCostCapXec` 作为硬性花费上限，不再用 `receiveAmount * maxMatchedPrice` 近似。

- TokenTable batch row updates. ✅ v4.0.6
  - 已改为按页并发加载 token 详情并批量更新列表状态。

- WebSocket subscription stable key/ref-count. ✅ v4.3.9
  - Agora token WebSocket 订阅已去重，并在最后一个 watcher 离开时 unsubscribe，token id 列表未变时不重订阅。

- Quality gates. ✅ v4.3.10
  - 已移除全局 `eslintIgnore: ["**/*"]` 开启真实 ESLint 扫描，并清理了 `react-hooks/exhaustive-deps` 告警。

- WebSocket token subscription leak. ✅ v4.3.9
  - 已修复 watcher 退出时未清理全局 watched token ids 导致的集合膨胀。

- External URL allowlist. ✅ v4.3.9
  - 已对 Project Info 链接、token lookup URL、钱包 token metadata URL 增加外部 URL 过滤，仅允许安全协议。

- Listing cancel decimals. ✅ v4.3.8
  - 撤单已改用原始 offer atom amount，修复带 decimals token 的撤单金额不准问题。

## 待确认

- TokenTable etokendb short cache.
  - 给 `/api/etokendb/tokens`、status、detail 加短 CDN/server cache，例如 `s-maxage=30, stale-while-revalidate=120`。
  - 目标：减少每个用户冷启动都打远端 etokendb，提高列表首屏稳定性。

- TokenTable local cache first.
  - 页面打开先展示浏览器本地缓存的旧 token stats，再后台检查 etokendb availability 和刷新。
  - 目标：etokendb 慢或短暂不可用时，不让用户先等几秒空状态。

- Amount math as BigInt sats/atoms.
  - 一些交易路径仍用 JS `number` / `parseFloat` / `Math.floor(amount * 10^decimals)`。
  - 待改点：交易金额从字符串直接解析为 BigInt atoms/sats，显示时才转 number/string。

- Mnemonic storage.
  - 当前 mnemonic 会存在本地 storage 并在 app state/执行路径使用。
  - 这是安全风险项，是否改取决于当前产品对内置钱包的取舍。
