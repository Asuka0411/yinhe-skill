#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_SOURCE_PATH = path.join(REPO_ROOT, 'gt-autopilot.user.js');
const DEFAULT_DOWNLOAD_COPY_PATH = path.join(
  process.env.HOME || '',
  'Downloads',
  'gt-autopilot (2).user.js'
);
const DEFAULT_UPDATE_URL = 'http://127.0.0.1:18793/gt-autopilot.user.js';

function parseUserscriptVersion(source) {
  const match = source.match(/^\s*\/\/\s*@version\s+([^\s]+)/m);
  return match ? match[1] : null;
}

function parseAppVersion(source) {
  const match = source.match(/\bAPP_VERSION\s*=\s*['"]([^'"]+)['"]/);
  return match ? match[1] : null;
}

function validateSourceVersions(source) {
  const userscriptVersion = parseUserscriptVersion(source);
  const appVersion = parseAppVersion(source);
  if (!userscriptVersion || !appVersion) {
    throw new Error('无法解析脚本版本：需要同时存在 @version 与 APP_VERSION');
  }
  if (userscriptVersion !== appVersion) {
    throw new Error(`版本不一致：@version=${userscriptVersion}，APP_VERSION=${appVersion}`);
  }
  return { version: userscriptVersion };
}

function syncDownloadCopy(sourcePath, targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || REPO_ROOT,
    encoding: 'utf8',
    stdio: options.stdio || 'pipe',
  });
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
    throw new Error(output || `${command} ${args.join(' ')} 执行失败，退出码 ${result.status}`);
  }
  return result.stdout || '';
}

function runCheck(sourcePath) {
  run('node', ['--check', sourcePath], { stdio: 'inherit' });
}

function runTests() {
  run('node', ['--test'], { stdio: 'inherit' });
}

function verifyUpdateSource(updateUrl, expectedVersion) {
  const output = run('curl', ['-fsS', updateUrl]);
  const actual = parseUserscriptVersion(output);
  if (actual !== expectedVersion) {
    throw new Error(`本地更新源版本不匹配：期望 ${expectedVersion}，实际 ${actual || '未解析到'}`);
  }
  return { version: actual };
}

function escapeAppleScriptString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function runAppleScript(lines) {
  return run('osascript', lines.flatMap((line) => ['-e', line]));
}

function buildOpenChromeUpdateTabAppleScript(updateUrl) {
  const escapedUrl = escapeAppleScriptString(updateUrl);
  return [
    'tell application "Google Chrome"',
    '  activate',
    `  make new tab at end of tabs of front window with properties {URL:"${escapedUrl}"}`,
    '  set active tab index of front window to count of tabs of front window',
    'end tell',
  ];
}

function openChromeUpdateTab(updateUrl) {
  runAppleScript(buildOpenChromeUpdateTabAppleScript(updateUrl));
}

function executeJavaScriptInActiveChromeTab(js) {
  return runAppleScript([
    'tell application "Google Chrome"',
    `  tell active tab of front window to execute javascript ${JSON.stringify(js)}`,
    'end tell',
  ]).trim();
}

function wait(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function readActiveTampermonkeyPageInfo() {
  const raw = executeJavaScriptInActiveChromeTab(`
    JSON.stringify({
      url: location.href,
      title: document.title,
      text: (document.body && document.body.innerText || '').slice(0, 1200),
      buttons: Array.from(document.querySelectorAll('button,input[type="button"],input[type="submit"]')).map(function (el, index) {
        return {
          index: index,
          tag: el.tagName,
          text: el.innerText || el.value || el.getAttribute('aria-label') || '',
          id: el.id || '',
          className: String(el.className || '')
        };
      })
    })
  `);
  return JSON.parse(raw);
}

function buildClickUpdateButtonJavaScript() {
  return `
    (function () {
      var positive = ['Overwrite', 'Update', 'Install', '更新', '安装', '覆盖'];
      var negative = ['取消', 'Cancel', 'Close', '关闭'];
      var controls = Array.from(document.querySelectorAll('button,input[type="button"],input[type="submit"]'));
      function labelOf(el) {
        return String(el.innerText || el.value || el.getAttribute('aria-label') || '').trim();
      }
      var target = controls.find(function (el) {
        var label = labelOf(el);
        return positive.some(function (word) { return label.indexOf(word) >= 0; }) &&
          !negative.some(function (word) { return label.indexOf(word) >= 0; });
      });
      if (!target) {
        return JSON.stringify({ ok: false, reason: '没有找到确认更新按钮', buttons: controls.map(labelOf) });
      }
      target.click();
      return JSON.stringify({ ok: true, label: labelOf(target) });
    })()
  `;
}

function clickTampermonkeyUpdateButton() {
  const raw = executeJavaScriptInActiveChromeTab(buildClickUpdateButtonJavaScript());
  return JSON.parse(raw);
}

function updateTampermonkey(updateUrl, options = {}) {
  openChromeUpdateTab(updateUrl);
  wait(options.initialWaitMs || 2000);
  const pageInfo = readActiveTampermonkeyPageInfo();
  if (!/^chrome-extension:\/\//.test(pageInfo.url) || !/Tampermonkey|用户脚本|script/i.test(pageInfo.text)) {
    throw new Error(`没有进入 Tampermonkey 更新页：${pageInfo.url}`);
  }
  const clickResult = clickTampermonkeyUpdateButton();
  if (!clickResult.ok) {
    throw new Error(`Tampermonkey 更新按钮点击失败：${JSON.stringify({ clickResult, pageInfo })}`);
  }
  return { pageInfo, clickResult };
}

function parseArgs(argv) {
  const args = {
    sourcePath: DEFAULT_SOURCE_PATH,
    downloadCopyPath: DEFAULT_DOWNLOAD_COPY_PATH,
    updateUrl: DEFAULT_UPDATE_URL,
    skipChrome: false,
    skipTests: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--source') {
      args.sourcePath = path.resolve(argv[++index]);
    } else if (arg === '--download-copy') {
      args.downloadCopyPath = path.resolve(argv[++index]);
    } else if (arg === '--update-url') {
      args.updateUrl = argv[++index];
    } else if (arg === '--skip-chrome') {
      args.skipChrome = true;
    } else if (arg === '--skip-tests') {
      args.skipTests = true;
    } else {
      throw new Error(`未知参数：${arg}`);
    }
  }
  return args;
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const source = fs.readFileSync(args.sourcePath, 'utf8');
  const version = validateSourceVersions(source).version;

  if (!args.skipTests) {
    runCheck(args.sourcePath);
    runTests();
  }

  syncDownloadCopy(args.sourcePath, args.downloadCopyPath);
  verifyUpdateSource(args.updateUrl, version);

  if (!args.skipChrome) {
    updateTampermonkey(args.updateUrl);
  }

  console.log(`本地发布完成：v${version}`);
  console.log(`已同步下载副本：${args.downloadCopyPath}`);
  if (!args.skipChrome) {
    console.log('已触发 Tampermonkey 持久安装版本更新');
  }
  return { version };
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error && error.message ? error.message : error);
    process.exit(1);
  }
}

module.exports = {
  buildClickUpdateButtonJavaScript,
  buildOpenChromeUpdateTabAppleScript,
  main,
  parseAppVersion,
  parseUserscriptVersion,
  syncDownloadCopy,
  validateSourceVersions,
};
