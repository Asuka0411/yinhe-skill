# yinhe-skill

当前 Galactic Tycoons 自动脚本私有工作区。

## 目录结构

- `gt-autopilot.user.js`：主用户脚本
- `references/`：参考脚本与参考记录
- `scripts/`：本地发布、Chrome 调试与辅助脚本
- `tests/`：Node 单测与本地调试页
- `docs/superpowers/specs/`：需求设计
- `docs/superpowers/plans/`：执行计划

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

## 当前能力

- 按钮式控制：`卖货`、`补货`、`自动`、`检查`、`等待`、`停止`
- 单基地、单飞船
- 基地级配置：`API Key`、`补齐天数`、`卖货白名单`、`一键卖货黑名单`、`最小发货量`
- 物资配置项展示并保存 `id`、名称、启用状态、图标字段；后续新增配置字段时必须同步读写保存
- 运行历史与日志面板
- 日志区域支持拖拽调整高度
- 自动模式基础轮询与恢复
- 本地交互式 harness，可模拟基地/交易所/运输中场景

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

## 说明

- 当前已完成本地逻辑与面板验证。
- 真实游戏页面的选择器与完整链路，仍需在你的登录态 Chrome 配置里继续实机校准。
