# yinhe-skill

当前 Galactic Tycoons 自动脚本私有工作区。

## 目录结构

- `gt-autopilot.user.js`：主用户脚本
- `references/`：参考脚本与参考记录
- `scripts/`：本地发布、Chrome 调试与辅助脚本
- `tests/`：Node 单测与本地调试页
- `docs/superpowers/specs/`：需求设计
- `docs/superpowers/plans/`：执行计划
- `docs/superpowers/status/`：当前进度与状态总览

## 首次安装

1. 安装 `Tampermonkey` 或 `Violentmonkey`
2. 启动本地静态服务：`python3 -m http.server 18793`
3. 在 Chrome 打开 `http://127.0.0.1:18793/gt-autopilot.user.js`
4. 在 Tampermonkey 页面确认安装
5. 打开 `https://g2.galactictycoons.com/` 或 `https://galactictycoons.com/`

## 日常更新

脚本变更后必须执行：

```bash
npm run release:local
```

该命令会自动完成：

- 校验 [gt-autopilot.user.js](/Users/dango/Documents/yinhe-skill/gt-autopilot.user.js:1) 的 `@version` 与 `APP_VERSION` 一致
- 执行 `node --check` 与全部 Node 单测
- 同步下载副本 `/Users/dango/Downloads/gt-autopilot (2).user.js`
- 校验 `http://127.0.0.1:18793/gt-autopilot.user.js` 返回的是当前版本
- 打开 Tampermonkey 更新页并自动点击确认更新按钮

如果 Tampermonkey 页面按钮文案变化导致自动点击失败，命令会输出当前页面 URL、标题和按钮列表，后续应优先校准 [scripts/release-local.js](/Users/dango/Documents/yinhe-skill/scripts/release-local.js:1)，不要回退到手动复制脚本。

## Chrome 热更新

如果只是把当前工作区里的最新代码注入到 Chrome 已打开的 Galactic Tycoons 页面，可以执行：

```bash
node scripts/hot-reload-chrome.js
```

该脚本会通过 AppleScript 自动查找 `https://g2.galactictycoons.com/` 或 `https://galactictycoons.com/` 标签页，把 [gt-autopilot.user.js](/Users/dango/Documents/yinhe-skill/gt-autopilot.user.js:1) 注入到该游戏标签页，移除旧面板并重新启动 `GT Autopilot`。

使用前需要确认 Chrome 中至少打开了一个 `https://g2.galactictycoons.com/` 或 `https://galactictycoons.com/` 的已登录页面。该方式只更新当前页面内存中的脚本，不会更新 Tampermonkey 持久安装版本；需要持久更新时仍执行 `npm run release:local`。

注意：热更新刷新页面后会回退到 Tampermonkey 已安装版本。只要需要刷新后仍保留新代码，必须使用 `npm run release:local`。

## 当前能力

- 按钮式控制：`卖货`、`补货`、`自动`、`检查`、`等待`、`停止`
- 单基地、单飞船
- 基地级配置：`API Key`、`补齐天数`、`卖货白名单`、`一键卖货黑名单`、`最小发货量`
- 物资配置项展示并保存 `id`、名称、启用状态、图标字段；后续新增配置字段时必须同步读写保存
- 运行历史与日志面板
- 日志区域支持拖拽调整高度
- 自动模式基础轮询与恢复
- 本地交互式 harness，可模拟基地/交易所/运输中场景
- 补货回运原子功能面板已拆分完成，包含读取基地、清空 wishlist、检查飞船、创建 wishlist、购买、装船、补油、修理和发船；其中“打开交易所”和“读取 wishlist”作为购买步骤内部动作，不再单独展示为原子步骤
- `购买 wishlist` 会从当前基地 `Resupply` 页面点击 `View Wishlist` 进入交易所对应 wishlist，按 wishlist 行逐项点击并确认数量后购买；购买完成后会保存本轮购买清单，供 `转移到飞船` 使用
- 提供 `scripts/hot-reload-chrome.js`，方便在 Chrome 当前页面内热重载脚本

## 本地验证

```bash
node --check gt-autopilot.user.js
node --test tests/gt-autopilot.test.js
```

## 本地预演

```bash
python3 -m http.server 18793
```

然后打开：

- [tests/gt-autopilot-harness.html](http://127.0.0.1:18793/tests/gt-autopilot-harness.html)

该页面会模拟：

- `GT Local API`
- 基地仓库 / 交易所仓库
- 飞船位置切换
- `Resupply -> Add to Wishlist`
- 基础买卖与发船动作

用途：

- 本地预演 `检查`
- 本地预演 `卖货` 到 `waiting`
- 本地检查自动模式、日志、历史、配置面板行为

推荐直接使用场景参数：

- `http://127.0.0.1:18793/tests/gt-autopilot-harness.html?seed=sell`
- `http://127.0.0.1:18793/tests/gt-autopilot-harness.html?seed=resupply`
- `http://127.0.0.1:18793/tests/gt-autopilot-harness.html?seed=transit`

## 已验证场景

当前已在本地 harness 中实跑验证：

- `检查`：可读取基地与飞船位置，并写入日志与运行历史
- `卖货`：在 `seed=sell` 场景下，可识别白名单货物、切到基地仓库、发船到交易所，并以 `waiting` 结束本轮
- `补货`：在 `seed=resupply` 场景下，可进入 `Resupply`、生成 wishlist、执行购买、发船回基地，并以 `waiting` 结束本轮
- `自动`：在 `seed=sell` 场景下，可启动自动轮询、执行出货链，并在等待阶段保持状态栏显示为 `自动中`

## 当前状态

截至 `2026-06-10`，当前脚本版本为 `v0.1.66`，完整本地 Node 单测 `132/132` 通过。

清空 wishlist 已支持按 `View Wishlist` 数量判断：数量为 `0` 时不进入交易所，数量大于 `0` 时进入对应 wishlist、点击编辑、执行 `Clear Wishlist`，完成后回到原基地页面。相关进度已整理到 [状态总览](/Users/dango/Documents/yinhe-skill/docs/superpowers/status/2026-06-08-galactic-tycoons-autopilot-status.md)。

补货回运原子步骤中，01 `读取当前基地`、02 `清空基地 wishlist`、03 `检查飞船在交易所`、04 `创建补给 wishlist` 与 05 `购买 wishlist` 已完成玩家实测验证，按钮状态为 `已验证` 并显示绿色样式。06 `转移到飞船` 因发现选船核对缺陷已回退为 `可测试`，修复后会在转移前核对当前真实选中的飞船，确认目标船一致才允许继续。04 当前按玩家点击流程执行：回到 Base、选中当前基地、进入 Resupply、全选物资、优先从飞船名解析容量、按飞船容量以 `0.5` 天为单位下调补齐天数，只写真实游戏 `#days` 天数输入框且不写 `#resupplySlider`，每次调整天数后重新全选物资；若调整到 `0.5` 天仍超重，则失败并停止，不点击 `Add to Wishlist`。

05 `购买 wishlist` 已完成玩家实测验证：会先在 `Resupply` 页面点击 `View Wishlist`，进入交易所 wishlist 后逐项点击 wishlist 物资行，确认右侧 `#exchangeTradeMatCard` 购买面板物资名与购买数量后点击游戏真实 `#exBuyButton`。点击后必须确认该物资的 wishlist 行已从页面移除，才会记录为已购买。购买后 wishlist 会被游戏移除，因此脚本会保存本轮购买清单，06 `转移到飞船` 优先使用该清单，不再依赖已清空的 wishlist。

06 `转移到飞船` 当前为可测试：进入交易所仓库后先读取当前真实选中的 `btnradio-whwt` 飞船货仓标签，并以该飞船作为本次装船目标；随后点击该目标飞船标签，再读取 `input[id^="btnradio-whwt"].checked` 对应的标签或 active 标签，核对当前真实选中飞船必须等于目标飞船。如果点击后仍选中其他飞船，立即失败并且不会点击任何物资转移按钮。核对通过后，脚本按本轮购买清单逐项点击非黑名单物资行的右箭头，并在每个转移弹窗里点击确认勾。`一键购买 wishlist` 展开面板内新增 `转移黑名单` 配置，默认保护 `Ship Repair Kit (#113)` 与 `Antimatter (#149)`；启用的黑名单物资不会被点击转移。`v0.1.66` 修复交易所页丢失当前基地上下文的问题：当 `readBaseContext` 因当前 URL 为 `/exchange/` 而退回公司第一个基地，导致旧快照目标船与当前货仓选中船不一致时，06 会直接信任当前 Exchange 货仓真实选中飞船，而不是继续使用旧快照里的 `transit` 状态。

06 `转移到飞船` 已补充两类 10 号船回归测试：旧快照显示 `200000 反物质-10` 仍在 `transit` 时会用实时选中货仓修正；交易所页基地上下文丢失、旧快照误指向 09 号但页面真实选中 10 号时，也会以 10 号货仓作为本次目标继续按玩家点击流程装船。

07 `飞船补油修理` 已接入可测试流程：逐个点击候选飞船标签切换当前飞船，读取当前飞船详情位置；不在 `Exchange Station` 的飞船会记录跳过并继续下一艘，不会停止整步。位于交易所的飞船会依次点击可见的 `Refuel` 与 `Repair` 按钮，等待真正的维护弹层打开后填入游戏允许的最大数量并确认；若先出现 tooltip 或其他没有数量输入框的 `.popover`，脚本会忽略并继续等待维护弹层。修理阶段还会拒绝复用补油后残留的 `Refuel` 弹层，必须等到文本匹配 `Repair` / `Condition` / `Kit` 的修理弹层。切换飞船时必须点击飞船详情面板顶部精确匹配目标船名的标签，不能因为详情区域顶部列表包含目标船名就认为已经切换成功；在交易所仓库飞船货仓页，只有飞船名与货物表、没有 `Refuel` / `Repair` / `Start flight` 等维护控件时，必须点击蓝色飞船名字进入真正的飞船维护详情，不能把 `btnradio-whwt` 货仓标签当成维护详情入口。

08 `一键补修理包、油` 已改为补交易所库存：复用现有补飞船修理材料逻辑，按交易所仓库现有数量把 `Antimatter (#149)` 与 `Ship Repair Kit (#113)` 补到目标库存 `2000`，购买前会计算差额，库存已达标时不购买。

常规游戏操作应模拟玩家点击页面控件，不主动刷新页面。只有验证 Tampermonkey 持久安装是否生效时，才刷新页面确认版本。

一键卖货已加固交易所导航校验：点击游戏内 `Exchange` 后必须确认地址进入交易所，或页面出现 `Exchange Warehouse`、`My Offers`、`Contracts`、交易所仓库卖货入口等交易所特征；如果仍停留在基地仓库页，会报 `未进入交易所页面` 并停止，不会继续查找或点击卖货按钮。

一键卖货已兼容交易所仓库真实页面物资简写：脚本计划里的 `Basic Construction Kit` 会匹配页面行 `Construction Kit`，`Basic Rations` 会匹配页面行 `Rations`，并点击对应行的钱袋卖货按钮；该兼容只针对这些物资，不放宽其它物资名匹配，避免误点相邻物资。

Chrome 热更新脚本已加固诊断：如果注入阶段返回 `missing value` 或页面返回注入异常，会输出明确的热更新失败原因，避免只看到 JSON 解析错误。

## 说明

- 当前已完成本地逻辑与面板验证。
- 真实游戏页面的选择器与完整链路，仍需在你的登录态 Chrome 配置里继续实机校准。
