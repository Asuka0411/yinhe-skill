const test = require('node:test');
const assert = require('node:assert/strict');

const hotReload = require('../scripts/hot-reload-chrome.js');

test('parseChromeTabs 会解析 AppleScript 返回的标签页列表', () => {
  const tabs = hotReload.parseChromeTabs([
    '1|||1|||chrome-extension://tampermonkey/update.html|||Tampermonkey',
    '1|||2|||https://g2.galactictycoons.com/base/16731|||Galactic Tycoons',
  ].join('\n'));

  assert.deepEqual(tabs, [
    { windowIndex: 1, tabIndex: 1, url: 'chrome-extension://tampermonkey/update.html', title: 'Tampermonkey' },
    { windowIndex: 1, tabIndex: 2, url: 'https://g2.galactictycoons.com/base/16731', title: 'Galactic Tycoons' },
  ]);
});

test('findGameTab 会优先选择 g2 Galactic Tycoons 标签页', () => {
  const tab = hotReload.findGameTab([
    { windowIndex: 1, tabIndex: 1, url: 'chrome-extension://tampermonkey/update.html', title: 'Tampermonkey' },
    { windowIndex: 1, tabIndex: 2, url: 'https://galactictycoons.com/base/1', title: 'Galactic Tycoons' },
    { windowIndex: 1, tabIndex: 3, url: 'https://g2.galactictycoons.com/base/16731', title: 'Galactic Tycoons' },
  ]);

  assert.deepEqual(tab, {
    windowIndex: 1,
    tabIndex: 3,
    url: 'https://g2.galactictycoons.com/base/16731',
    title: 'Galactic Tycoons',
  });
});

test('findGameTab 不会把 Tampermonkey 更新页当成热更新目标', () => {
  const tab = hotReload.findGameTab([
    { windowIndex: 1, tabIndex: 1, url: 'chrome-extension://tampermonkey/update.html', title: 'Tampermonkey' },
    { windowIndex: 1, tabIndex: 2, url: 'http://127.0.0.1:18793/gt-autopilot.user.js', title: 'gt-autopilot.user.js' },
  ]);

  assert.equal(tab, null);
});

test('validateInjectionResult 会拒绝 Chrome 错误页伪成功', () => {
  assert.throws(
    () => hotReload.validateInjectionResult({
      url: 'chrome-error://chromewebdata/',
      version: '0.1.41',
      panel: 'GT Autopilot v0.1.41',
    }, { expectedVersion: '0.1.41' }),
    /热更新目标实际页面不是 Galactic Tycoons/
  );
});

test('parseInjectedScriptResult 会拒绝 Chrome missing value', () => {
  assert.throws(
    () => hotReload.parseInjectedScriptResult('missing value'),
    /Chrome 没有返回热更新结果/
  );
});

test('parseInjectedScriptResult 会输出页面注入错误', () => {
  assert.throws(
    () => hotReload.parseInjectedScriptResult(JSON.stringify({
      ok: false,
      error: 'Unexpected end of input',
    })),
    /热更新注入失败：Unexpected end of input/
  );
});
