# Galactic Tycoons 自动脚本当前状态

> 更新日期：2026-06-10

## 项目定位

当前仓库是 `Galactic Tycoons` 的单基地、单飞船自动脚本私有工作区，目标不是通用机器人，而是围绕固定业务链路把出货、补货、等待、恢复做稳。

## 已落地内容

- 主脚本已具备按钮式控制：`卖货`、`补货`、`自动`、`检查`、`等待`、`停止`
- 已支持单基地、单飞船场景
- 已支持基地级配置保存：`API Key`、`补齐天数`、`卖货白名单`、`一键卖货黑名单`、`最小发货量`
- 物资配置已按完整条目保存，包含 `id`、名称、启用状态、图标字段
- 已有运行历史与日志面板，日志区域支持拖拽调整高度
- 已实现本地交互式 harness，可模拟基地、交易所、运输中等场景
- 已拆出补货回运原子功能面板，包含：
  - `读取当前基地`
  - `清空基地 wishlist`
  - `检查飞船在交易所`
  - `创建补给 wishlist`
  - `购买 wishlist`
  - `转移到飞船`
  - `飞船补油修理`
  - `一键补修理包、油`
  - `发船回基地`
- 已有 `scripts/hot-reload-chrome.js`，用于自动定位 Chrome 中已打开的游戏标签页并热重载脚本

## 当前验证状态

截至 2026-06-10，当前脚本版本为 `v0.1.66`，`node --test tests/release-local.test.js tests/hot-reload-chrome.test.js tests/gt-autopilot.test.js` 的结果为 `132/132` 通过。

本轮已完成：

- `清空基地 wishlist` 会读取当前基地 `Resupply` 页面的 `View Wishlist(n)` 数量
- 当数量为 `0` 时，不进入交易所
- 当数量大于 `0` 时，点击进入交易所对应 wishlist
- 点击编辑按钮后执行 `Clear Wishlist`
- 清空后点击游戏内 `Base` 按钮切回基地页面，不设置 `location.href`，避免刷新页面
- 历史版本 `v0.1.36` 已完成清空 wishlist 回基地逻辑：点击游戏内 `Base`，不设置 `location.href`
- 01 `读取当前基地` 已完成玩家实测验证，按钮状态已从 `待接入` 改为 `已验证`，按钮样式已同步为绿色
- 02 `清空基地 wishlist` 已完成玩家实测验证，按钮状态已从 `可测试` 改为 `已验证`，按钮样式已同步为绿色
- 03 `检查飞船在交易所` 已确认职责正确并完成玩家实测验证，按钮状态已从 `待接入` 改为 `已验证`，按钮样式已同步为绿色
- 04 `创建补给 wishlist` 已按玩家点击流程重写：确认或切回 Base 页面、选中当前基地、切到 `Resupply`、全选物资、按页面 `TOTAL WEIGHT` 与飞船容量以 `0.5` 天为单位下调补齐天数，确认不超载后再点击 `Add to Wishlist`
- 已修复 04 天数未真实写入游戏控件的问题：真实游戏使用 `#days` 输入框，脚本现在只写入 `#days` 并触发输入事件，避免日志显示已调整但页面仍停在旧天数
- 已修复 `scripts/release-local.js` 对 Tampermonkey 中间跳转页的等待逻辑，避免过早判定没有进入更新页
- 已修复 `scripts/hot-reload-chrome.js` 只注入 Chrome 当前活动页的问题；现在会自动跳过 Tampermonkey 更新页，定位已打开的 Galactic Tycoons 游戏页后再热注入，避免当前页面继续运行旧版本导致按钮颜色不更新
- 04 `创建补给 wishlist` 针对 200000 吨飞船补给天数异常做了二次修正：
  - 优先从飞船名称开头解析容量，例如 `200000 反物质-09` 解析为 `200000`
  - 天数只写真实游戏 `#days` 输入框，不再写 `#resupplySlider`，避免游戏滑条把 `0.5` 倍数改成 `0.6`
  - 每次调整天数后重新全选 Resupply 物资，避免页面重算后复选框被清空
  - 若按比例下调后页面 `TOTAL WEIGHT` 仍超过飞船容量，则继续以 `0.5` 天为单位递减并重新读取重量
  - 若降到 `0.5` 天仍超重，则直接失败并停止，不点击 `Add to Wishlist`
  - 真实页面模式下控件缺失会直接失败，不再回退到估算结果伪装成功
- 当前脚本版本为 `v0.1.66`
- 04 `创建补给 wishlist` 已完成玩家实测验证，按钮状态已从 `可测试` 改为 `已验证`，按钮样式已同步为绿色
- 05 `打开交易所` 与 06 `读取 wishlist` 已从补货回运原子步骤面板删除；对应能力保留在 `购买 wishlist` 内部流程中
- 05 `购买 wishlist` 已改为玩家点击流程：先在当前基地 `Resupply` 页面点击 `View Wishlist`，进入交易所 wishlist 后逐项点击 wishlist 物资行，确认右侧购买数量后点击最终 `Buy`
- 已修复 05 未真实点击游戏 `Buy` 的问题：脚本之前会误点右侧 GT Autopilot 面板里的 `购买 wishlist` 按钮，表现为日志出现多条 `忙碌：已有任务在运行`，但交易所仓库没有增加、wishlist 未移除
- 05 现在优先点击游戏真实 `#exBuyButton`，并排除 `#gtap-panel` 内按钮
- 05 在点击 Buy 前会核对右侧购买面板物资名与 wishlist 物资一致，并核对 `#inputQuantity` 等于 wishlist 数量
- 已修复 05 物资名核对范围过宽的问题：核对逻辑限定在游戏 `#exchangeTradeMatCard` 内读取物资标题，避免把页面顶栏 `Exchange My Offers Contracts` 误判为当前购买物资
- 05 点击 Buy 后会等待该物资 wishlist 行从页面移除；未移除时失败，不再写入“已购买”
- 05 购买成功后会保存本轮购买清单；06 `转移到飞船` 优先使用该清单，避免真实购买后 wishlist 被游戏移除导致 06 读不到装船物资
- 05 `购买 wishlist` 已完成玩家实测验证，按钮状态已从 `可测试` 改为 `已验证`，按钮样式已同步为绿色
- 06 `转移到飞船` 已按玩家点击流程改为逐项转移：先点击目标飞船标签，再按本轮购买清单点击非黑名单物资行右箭头，并在每个转移弹窗中点击确认勾
- 06 `转移到飞船` 因发现选船核对缺陷，按钮状态已从 `已验证` 回退为 `可测试`
- 已修复 06 转移前未核对当前真实选中飞船的问题：点击目标飞船标签后会读取 `input[id^="btnradio-whwt"].checked` 对应标签或 active 标签，确认当前选中飞船等于目标飞船；如果仍选中其他飞船，立即失败且不会点击任何物资转移按钮
- 06 `转移到飞船` 新增 `转移黑名单` 配置，位置在 `一键购买 wishlist` 展开面板内，默认保护 `Ship Repair Kit (#113)` 与 `Antimatter (#149)`
- 06 不再点击 `Exchange Warehouse` 一键转移总箭头；启用的黑名单物资行不会被点击，禁用的黑名单项会按普通物资转移
- 已修复 06 入口未透传 `转移黑名单` 配置的问题，并进一步改为转移前过滤黑名单，避免黑名单物资先进入飞船后再尝试移回
- 已修复 06 逐项转移后没有点击确认勾的问题，避免第一个物资转移弹窗停留导致后续物资无法真正转移
- 已修复 06 在交易所仓库页报 `飞船不在交易所：当前位置=unknown` 的问题：当当前页面只有 `btnradio-whwt` 飞船仓库标签、没有 Ships 列表时，脚本会从已选飞船仓库标签推断飞船在 `Exchange Station`
- 已修复 06 对 10 号船误判 `transit` 的问题：当页面已选中目标飞船的 Exchange 货仓标签且显示 `Exchange Station` 时，页面真实状态会覆盖 Local API 中可能滞后的 flight 状态
- `v0.1.65` 进一步修复 06 入口使用旧快照的问题：转移前会重新根据当前 DOM 推断实时飞船位置；仅当实时选中的 Exchange 货仓飞船匹配目标船名或当前基地编号时，才覆盖 `readBaseContext` 中可能滞后的 `transit` 状态
- 已增加回归测试：`snapshot.shipInfo.location = transit` 且真实页面选中 `200000 反物质-10` Exchange 货仓时，06 不再在计划阶段报 `飞船不在交易所：当前位置=transit`
- `v0.1.66` 修复交易所页基地上下文丢失后的 10 号船误判：当当前 URL 为 `/exchange/`、`readBaseContext` 退回公司第一个基地导致旧快照目标船不等于当前货仓选中船时，06 会直接读取并信任当前 `btnradio-whwt` 真实选中的 Exchange 货仓飞船
- 已增加回归测试：旧快照误指向 09 号且状态为 `transit`、真实页面选中 `200000 反物质-10` 时，06 以 10 号为目标继续逐项装船
- 07 `飞船补油修理` 已接入可测试流程：逐个点击候选飞船标签切换当前飞船，读取当前飞船详情位置；不在 `Exchange Station` 的飞船会记录跳过并继续下一艘，不会停止整步
- 07 对位于交易所的飞船会依次点击可见的 `Refuel` 与 `Repair` 按钮，等待维护弹层打开后填入游戏允许的最大数量并确认
- 07 在只有交易所仓库飞船标签、没有 Ships 列表时，会逐个点击对应 `btnradio-whwt` 飞船标签作为入口，再判断当前位置并执行或跳过
- 已修复 07 点击 `Repair` 后误把 tooltip 或其他无数量输入框 `.popover` 当作维护弹层的问题；现在只接受包含可见输入框的维护弹层，否则继续等待
- 已修复 07 修理阶段误复用补油后残留 `Refuel` 弹层的问题；现在 `Repair` 只接受文本匹配修理语义的维护弹层，避免补油弹层关闭动画期间被当成修理弹层
- 已修复 07 没有真实切换飞船详情的问题：飞船详情面板顶部列出所有船名时，脚本会点击精确匹配目标船名的标签，不能仅因页面文本包含目标船名就继续维护当前船
- 已修复 07 在交易所仓库飞船货仓页误判为维护详情的问题：只有飞船名、`Exchange Station` 和货物表时不能认为已进入维护详情，必须点击飞船名打开包含 `Refuel` / `Repair` / `Start flight` 等控件的飞船详情
- 已修复 07 在交易所仓库飞船货仓页误点 `btnradio-whwt` 货仓标签的问题：当标题存在蓝色飞船名字时，脚本会点击飞船名字打开维护详情，而不是只切换货仓标签
- 08 已改名为 `一键补修理包、油`，并改为复用现有补飞船修理材料逻辑：按交易所仓库现有数量把 `Antimatter (#149)` 与 `Ship Repair Kit (#113)` 补到目标库存 `2000`
- `navigateToExchangePage` 已移除直接设置 `location.href` 的兜底；找不到游戏内 `Exchange` 按钮时直接失败，正常游戏操作不强跳页面
- 已修复一键卖货在点击 `Exchange` 后没有确认进入交易所的问题：现在会等待交易所路径或 `Exchange Warehouse`、`My Offers`、`Contracts`、交易所仓库卖货入口等页面特征；如果仍停在基地仓库页，会报 `未进入交易所页面` 并停止，不会在基地仓库误找卖货按钮
- 已修复一键卖货找不到 `Basic Construction Kit` 与 `Basic Rations` 卖货按钮的问题：真实交易所仓库行分别显示为 `Construction Kit` 与 `Rations`，脚本现在会精确映射到对应行并点击钱袋图标；该兼容不扩大到其它物资名
- 已加固 `scripts/hot-reload-chrome.js`：当 Chrome 返回 `missing value` 或页面返回注入异常时，会输出明确错误，不再只暴露 JSON 解析失败
- 已执行 `npm run release:local`，持久安装更新目标为 `v0.1.66`
- 已执行 `node scripts/hot-reload-chrome.js`，当前已打开的游戏页内存版本为 `v0.1.66`
- 已加固 `scripts/hot-reload-chrome.js` 的注入结果校验：热更新后必须确认实际 `location.href` 仍是 `galactictycoons.com` 游戏页，避免 Chrome 错误页带着旧面板被误判为成功
- 已通过只读查询确认当前游戏页补货回运原子步骤数量为 9，且不存在 05 `打开交易所` 与 06 `读取 wishlist`
- 已通过只读查询确认当前游戏页中 01、02、03、04、05 原子按钮状态均为 `done` 且显示绿色
- 本次发布与验证未刷新游戏页面，未点击 05

## 已验证链路

- `检查`：可读取基地与飞船位置，并写入日志与运行历史
- `卖货`：在 `seed=sell` 场景下，可识别白名单货物、切到基地仓库、发船到交易所，并以 `waiting` 结束本轮
- `补货`：在 `seed=resupply` 场景下，可进入 `Resupply`、生成 wishlist、执行购买、发船回基地，并以 `waiting` 结束本轮
- `自动`：在 `seed=sell` 场景下，可启动自动轮询、执行出货链，并在等待阶段保持状态栏显示为 `自动中`

## 当前待办

1. 在真实登录态 Chrome 中做小额、可控验证
2. 后续发布继续使用 `npm run release:local`；`node scripts/hot-reload-chrome.js` 仅用于临时调试，不作为持久更新方式

## 相关文档

- [项目总览与使用说明](/Users/dango/Documents/yinhe-skill/README.md)
- [补货回运原子功能 PRD](/Users/dango/Documents/yinhe-skill/docs/superpowers/specs/2026-06-08-wishlist-resupply-atomic-prd.md)
- [历史实施计划](/Users/dango/Documents/yinhe-skill/docs/superpowers/plans/2026-06-05-galactic-tycoons-autopilot.md)
