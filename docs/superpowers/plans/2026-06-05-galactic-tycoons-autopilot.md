# Galactic Tycoons 自动脚本第一版实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 交付一个可直接使用的 Galactic Tycoons 自动脚本第一版，支持单基地、单飞船、按钮式控制、出货链、补货链、状态机、按基地配置与运行历史，并最终推送到私有仓库。

**架构：** 采用单文件用户脚本作为运行入口，但内部拆成纯逻辑核心、Local API 适配、页面动作适配、状态机、配置存储和历史记录六个边界。纯逻辑先用 Node 测试固定行为，浏览器侧再接入页面按钮与游戏内置流程，确保稳定性优先于抽象完美。

**技术栈：** `JavaScript`、`Node.js`、`node --test`、浏览器用户脚本、`localStorage`、游戏页面 DOM。

> 说明：这是一份历史实施计划。当前实现进度与待办请参考 [状态总览](/Users/dango/Documents/yinhe-skill/docs/superpowers/status/2026-06-08-galactic-tycoons-autopilot-status.md)。

---

### Task 1: 建立可测试核心接口

**文件：**
- 创建：`gt-autopilot.user.js`
- 创建：`tests/gt-autopilot.test.js`
- 创建：`package.json`

- [ ] **Step 1: 先写失败测试**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const createGtAutopilot = require('../gt-autopilot.user.js');

test('normalizeText 会压缩空白并去掉首尾空格', () => {
  const api = createGtAutopilot();
  assert.equal(api.normalizeText('  a   b  '), 'a b');
});

test('reduceResupplyDays 会在超限时降低天数', () => {
  const api = createGtAutopilot();
  const result = api.reduceResupplyDays({
    targetDays: 7,
    maxDays: 7,
    minDays: 1,
    estimate: (days) => ({ weight: days * 100, price: days * 10 }),
    limits: { maxWeight: 450, maxPrice: 45 }
  });
  assert.equal(result.days, 4);
});
```

- [ ] **Step 2: 运行测试确认失败**

运行：`node --test tests/gt-autopilot.test.js`

预期：失败，原因是 `createGtAutopilot` 还没有实现。

- [ ] **Step 3: 写最小实现**

在 `gt-autopilot.user.js` 里先只导出 `normalizeText` 和 `reduceResupplyDays`，不接入页面逻辑。

- [ ] **Step 4: 运行测试确认通过**

运行：`node --test tests/gt-autopilot.test.js`

预期：通过。

- [ ] **Step 5: 提交**

```bash
git add package.json gt-autopilot.user.js tests/gt-autopilot.test.js
git commit -m "test: add core behavior tests"
```

### Task 2: 实现状态机、配置和面板

**文件：**
- 修改：`gt-autopilot.user.js`

- [ ] **Step 1: 先补状态机测试**

```js
test('state machine 会根据飞船位置选择正确链路', () => {
  const api = createGtAutopilot();
  const next = api.pickInitialChain({ shipLocation: 'base' });
  assert.equal(next, 'sell_chain');
});
```

- [ ] **Step 2: 运行测试确认失败**

运行：`node --test tests/gt-autopilot.test.js`

预期：失败，原因是 `pickInitialChain` 还没有实现。

- [ ] **Step 3: 实现最小状态机和面板**

把下列能力接进同一个脚本：
- 按基地保存 `白名单`、`最小出货量`、`默认补齐天数`
- `卖货`、`补货`、`检查`、`等待`、`停止` 五个按钮
- `sell_chain` 和 `resupply_chain`
- 运行历史摘要与步骤详情
- `localStorage` 读写

- [ ] **Step 4: 运行测试确认通过**

运行：`node --test tests/gt-autopilot.test.js`

预期：通过。

- [ ] **Step 5: 提交**

```bash
git add gt-autopilot.user.js tests/gt-autopilot.test.js
git commit -m "feat: add state machine and panel"
```

### Task 3: 本地验证与推送

**文件：**
- 修改：`README.md`（如有必要，补充安装与使用说明）

- [ ] **Step 1: 语法检查**

运行：`node --check gt-autopilot.user.js`

预期：无语法错误。

- [ ] **Step 2: 运行测试**

运行：`node --test tests/gt-autopilot.test.js`

预期：全部通过。

- [ ] **Step 3: 检查仓库状态**

运行：`git status --short --branch`

预期：只有预期文件变更。

- [ ] **Step 4: 提交并推送**

```bash
git add README.md gt-autopilot.user.js tests/gt-autopilot.test.js
git commit -m "feat: ship first galactic tycoons autopilot"
git push origin main
```
