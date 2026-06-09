#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_SOURCE_PATH = path.join(REPO_ROOT, 'gt-autopilot.user.js');
const GAME_HOST_RE = /^https:\/\/(?:g2\.)?galactictycoons\.com\//;
const TAB_FIELD_SEPARATOR = '|||';

function runAppleScript(lines) {
  const result = spawnSync('osascript', lines.flatMap((line) => ['-e', line]), {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `osascript failed: ${result.status}`);
  }
  return result.stdout.trim();
}

function executeJavaScriptInChromeTab(target, js) {
  return runAppleScript([
    'tell application "Google Chrome"',
    `  tell tab ${target.tabIndex} of window ${target.windowIndex} to execute javascript ${JSON.stringify(js)}`,
    'end tell',
  ]);
}

function listChromeTabs() {
  const raw = runAppleScript([
    'tell application "Google Chrome"',
    `  set fieldSeparator to "${TAB_FIELD_SEPARATOR}"`,
    '  set tabLines to {}',
    '  repeat with windowIndex from 1 to count of windows',
    '    set tabIndex to 0',
    '    repeat with chromeTab in tabs of window windowIndex',
    '      set tabIndex to tabIndex + 1',
    '      set end of tabLines to (windowIndex as text) & fieldSeparator & (tabIndex as text) & fieldSeparator & (URL of chromeTab as text) & fieldSeparator & (title of chromeTab as text)',
    '    end repeat',
    '  end repeat',
    '  set AppleScript\'s text item delimiters to linefeed',
    '  set tabText to tabLines as text',
    '  set AppleScript\'s text item delimiters to ""',
    '  return tabText',
    'end tell',
  ]);
  if (!raw) {
    return [];
  }
  return parseChromeTabs(raw);
}

function parseChromeTabs(raw) {
  if (!raw) {
    return [];
  }
  return raw.split(/\r?\n/).map((line) => {
    const [windowIndex, tabIndex, url, ...titleParts] = line.split(TAB_FIELD_SEPARATOR);
    return {
      windowIndex: Number(windowIndex),
      tabIndex: Number(tabIndex),
      url: url || '',
      title: titleParts.join(TAB_FIELD_SEPARATOR),
    };
  }).filter((tab) => tab.windowIndex && tab.tabIndex);
}

function findGameTab(tabs) {
  return tabs.find((tab) => /^https:\/\/g2\.galactictycoons\.com\//.test(tab.url)) ||
    tabs.find((tab) => /^https:\/\/galactictycoons\.com\//.test(tab.url)) ||
    null;
}

function clearExistingPanel(target) {
  executeJavaScriptInChromeTab(target, [
    'window.__GT_HOT_RELOAD_PARTS=[];',
    'document.getElementById("gtap-panel")?.remove();',
    'window.__GT_AUTOPILOT_APP__=null;',
  ].join(' '));
}

function pushSourceChunks(target, source) {
  const chunks = source.match(/[\s\S]{1,12000}/g) || [];
  for (const chunk of chunks) {
    executeJavaScriptInChromeTab(target, `window.__GT_HOT_RELOAD_PARTS.push(${JSON.stringify(chunk)});`);
  }
}

function runInjectedScript(target) {
  const rawResult = executeJavaScriptInChromeTab(target, `
    (function () {
      var code = window.__GT_HOT_RELOAD_PARTS.join('');
      delete window.__GT_HOT_RELOAD_PARTS;
      (0, eval)(code);
      if (!window.__GT_AUTOPILOT_APP__ && window.createGalacticTycoonsAutopilot) {
        window.__GT_AUTOPILOT_APP__ = window.createGalacticTycoonsAutopilot(window).start();
      }
      var clearButton = document.querySelector('button[data-atomic-action="wishlist_clear_base_wishlist"]');
      return JSON.stringify({
        url: location.href,
        version: window.__GT_AUTOPILOT_APP__ && window.__GT_AUTOPILOT_APP__.version,
        panel: document.getElementById('gtap-panel') && document.getElementById('gtap-panel').innerText.slice(0, 120),
        clearButton: clearButton && {
          text: clearButton.innerText,
          status: clearButton.getAttribute('data-atomic-status'),
          style: clearButton.getAttribute('style'),
          background: getComputedStyle(clearButton).backgroundImage || getComputedStyle(clearButton).backgroundColor,
          color: getComputedStyle(clearButton).color
        }
      });
    })()
  `);
  return JSON.parse(rawResult);
}

function validateInjectionResult(result, options = {}) {
  const expectedVersion = options.expectedVersion;
  if (!result || !GAME_HOST_RE.test(result.url || '')) {
    throw new Error(`热更新目标实际页面不是 Galactic Tycoons：${result && result.url ? result.url : '未知页面'}`);
  }
  if (expectedVersion && result.version !== expectedVersion) {
    throw new Error(`热更新版本不匹配：期望 ${expectedVersion}，实际 ${result.version || '未知'}`);
  }
  if (!result.panel) {
    throw new Error('热更新后未找到 GT Autopilot 面板');
  }
  return result;
}

function parseSourceVersion(source) {
  const match = String(source || '').match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);
  return match ? match[1] : '';
}

function hotReloadChrome(options = {}) {
  const sourcePath = options.sourcePath || DEFAULT_SOURCE_PATH;
  const source = fs.readFileSync(sourcePath, 'utf8');
  const tabs = listChromeTabs();
  const target = options.target || findGameTab(tabs);
  if (!target) {
    throw new Error('没有找到已打开的 Galactic Tycoons 标签页，请先打开 https://g2.galactictycoons.com/');
  }
  if (!GAME_HOST_RE.test(target.url)) {
    throw new Error(`目标标签页不是 Galactic Tycoons：${target.url}`);
  }

  clearExistingPanel(target);
  pushSourceChunks(target, source);
  return validateInjectionResult(runInjectedScript(target), {
    expectedVersion: parseSourceVersion(source),
  });
}

function main(argv = process.argv.slice(2)) {
  const sourcePath = argv[0] ? path.resolve(argv[0]) : DEFAULT_SOURCE_PATH;
  const result = hotReloadChrome({ sourcePath });
  console.log(JSON.stringify(result, null, 2));
  return result;
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
  findGameTab,
  hotReloadChrome,
  listChromeTabs,
  parseChromeTabs,
  validateInjectionResult,
};
