const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const release = require('../scripts/release-local.js');

test('validateSourceVersions 会要求 userscript 版本与 APP_VERSION 一致', () => {
  const source = [
    '// ==UserScript==',
    '// @version      0.1.22',
    '// ==/UserScript==',
    "var APP_VERSION = '0.1.22';",
  ].join('\n');

  assert.equal(release.validateSourceVersions(source).version, '0.1.22');
});

test('validateSourceVersions 会拒绝版本号不一致的脚本', () => {
  const source = [
    '// ==UserScript==',
    '// @version      0.1.22',
    '// ==/UserScript==',
    "var APP_VERSION = '0.1.21';",
  ].join('\n');

  assert.throws(
    () => release.validateSourceVersions(source),
    /版本不一致/
  );
});

test('syncDownloadCopy 会创建目标目录并复制脚本', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-release-'));
  const sourcePath = path.join(tmp, 'gt-autopilot.user.js');
  const targetPath = path.join(tmp, 'Downloads', 'gt-autopilot (2).user.js');
  fs.writeFileSync(sourcePath, 'hello release', 'utf8');

  release.syncDownloadCopy(sourcePath, targetPath);

  assert.equal(fs.readFileSync(targetPath, 'utf8'), 'hello release');
});

test('buildClickUpdateButtonJavaScript 只点击 Tampermonkey 的确认更新按钮', () => {
  const js = release.buildClickUpdateButtonJavaScript();

  assert.match(js, /Overwrite/);
  assert.match(js, /Update/);
  assert.match(js, /取消/);
  assert.match(js, /Cancel/);
  assert.doesNotMatch(js, /querySelectorAll\('a/);
});

test('buildOpenChromeUpdateTabAppleScript 使用最后一个标签页作为活动标签', () => {
  const lines = release.buildOpenChromeUpdateTabAppleScript('http://127.0.0.1:18793/gt-autopilot.user.js');
  const script = lines.join('\n');

  assert.match(script, /make new tab at end of tabs/);
  assert.match(script, /active tab index.*count of tabs/);
  assert.doesNotMatch(script, /index of newTab/);
});
