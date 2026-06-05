# yinhe-skill

当前 Galactic Tycoons 自动脚本私有工作区。

## 目录结构

- `gt-autopilot.user.js`：主用户脚本
- `references/`：参考脚本与参考记录
- `tests/`：Node 单测与本地调试页
- `docs/superpowers/specs/`：需求设计
- `docs/superpowers/plans/`：执行计划

## 安装

1. 安装 `Tampermonkey` 或 `Violentmonkey`
2. 新建脚本
3. 将 [gt-autopilot.user.js](/Users/dango/Documents/yinhe-skill/gt-autopilot.user.js:1) 全部内容粘贴进去并保存
4. 打开 `https://g2.galactictycoons.com/` 或 `https://galactictycoons.com/`

## 当前能力

- 按钮式控制：`卖货`、`补货`、`检查`、`等待`、`停止`
- 单基地、单飞船
- 基地级配置：`API Key`、`补齐天数`、`卖货白名单`、`最小发货量`
- 运行历史与日志面板
- 日志区域支持拖拽调整高度

## 本地验证

```bash
node --check gt-autopilot.user.js
node --test tests/gt-autopilot.test.js
```

## 说明

- 当前已完成本地逻辑与面板验证。
- 真实游戏页面的选择器与完整链路，仍需在你的登录态 Chrome 配置里继续实机校准。
