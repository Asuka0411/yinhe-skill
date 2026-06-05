// ==UserScript==
// @name         Galactic Tycoons Autopilot
// @namespace    https://g2.galactictycoons.com/
// @version      0.1.0
// @description  Galactic Tycoons 单基地单飞船自动化面板：卖货、补货、检查、等待、停止
// @match        https://galactictycoons.com/*
// @match        https://g2.galactictycoons.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==
/*
 * Galactic Tycoons Autopilot
 * 目标：单基地、单飞船、按钮式控制、卖货链、补货链、状态机、按基地配置与运行历史
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory;
  }

  root.createGalacticTycoonsAutopilot = factory;

  if (root && root.document && root.location && /galactictycoons\.com$/i.test(root.location.hostname || '')) {
    var existing = root.__GT_AUTOPILOT_APP__;
    if (!existing) {
      root.__GT_AUTOPILOT_APP__ = factory(root).start();
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : window, function createGalacticTycoonsAutopilot(root) {
  root = root || {};

  var DEFAULTS = {
    resupplyDays: 7,
    minOutboundAmount: 1,
    historyLimit: 20,
    pollIntervalMs: 15000,
    transportWaitIntervalMs: 30000,
    wikiApiKey: 'S4K6lDzaRcS4',
    outboundWhitelist: [
      { id: 172, enabled: true, minAmount: 1 },
      { id: 136, enabled: true, minAmount: 1 },
    ],
  };

  var SALE_BUTTON_TEXTS = ['卖出', '出售', 'Sell', 'sell'];
  var BUY_BUTTON_TEXTS = ['购买', 'Buy', 'buy'];
  var CONFIRM_BUTTON_TEXTS = ['确认', '确定', 'Confirm', 'OK'];
  var RESUPPLY_BUTTON_TEXTS = ['Resupply', '补给', '补货', '重新补给'];
  var WISHLIST_BUTTON_TEXTS = ['Add to Wishlist', '加入愿望单', '加入心愿单', 'Add Wishlist'];
  var BASE_BUTTON_TEXTS = ['Base', '基地'];
  var OVERVIEW_BUTTON_TEXTS = ['Overview', '概览'];
  var WAREHOUSE_BUTTON_TEXTS = ['Warehouse', '仓库'];
  var EXCHANGE_BUTTON_TEXTS = ['Exchange', '交易所'];
  var VIEW_WISHLIST_BUTTON_TEXTS = ['View Wishlist', '查看愿望单', '查看心愿单'];
  var CLEAR_BUTTON_TEXTS = ['Clear', '清空', '删除全部'];
  var START_FLIGHT_BUTTON_TEXTS = ['Start flight', 'Start Flight', '开始飞行', '起飞'];
  var DESTINATION_INPUT_HINTS = ['destination', 'Destination', '目的地'];
  var SELL_FORM_BUTTON_TEXTS = ['Sell', 'sell', '卖出', '出售'];
  var STOP_REASON = 'stopped';

  function normalizeText(value) {
    return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
  }

  function parseNumber(value, fallback) {
    var n = Number(String(value).replace(/[^\d.-]/g, ''));
    return Number.isFinite(n) ? n : (fallback == null ? 0 : fallback);
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function createMemoryStorage() {
    var data = Object.create(null);
    return {
      getItem: function (key) {
        return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
      },
      setItem: function (key, value) {
        data[key] = String(value);
      },
      removeItem: function (key) {
        delete data[key];
      },
    };
  }

  function resolveStorage() {
    try {
      if (root.localStorage) {
        return root.localStorage;
      }
    } catch (error) {
      // ignore
    }
    return createMemoryStorage();
  }

  function loadJSON(storage, key, fallback) {
    try {
      var raw = storage.getItem(key);
      if (!raw) {
        return deepClone(fallback);
      }
      return JSON.parse(raw);
    } catch (error) {
      return deepClone(fallback);
    }
  }

  function saveJSON(storage, key, value) {
    storage.setItem(key, JSON.stringify(value));
  }

  function baseKey(baseId, suffix) {
    return 'gtap:' + String(baseId || 'global') + ':' + suffix;
  }

  function createBaseStore(storage, baseId) {
    var defaults = {
      outboundWhitelist: deepClone(DEFAULTS.outboundWhitelist),
      minOutboundAmount: {},
      resupplyDays: DEFAULTS.resupplyDays,
      apiKey: DEFAULTS.wikiApiKey,
      wikiApiKey: DEFAULTS.wikiApiKey,
      history: [],
      workflow: {
        autoMode: false,
      },
    };

    var key = baseKey(baseId, 'config');

    function read() {
      return loadJSON(storage, key, defaults);
    }

    function write(value) {
      saveJSON(storage, key, value);
      return value;
    }

    function patch(mutator) {
      var current = read();
      var next = mutator(deepClone(current)) || current;
      return write(next);
    }

    return {
      read: read,
      write: write,
      patch: patch,
      defaults: deepClone(defaults),
    };
  }

  function createHistoryStore(storage, baseId, limit) {
    var key = baseKey(baseId, 'history');
    var maxCount = limit || DEFAULTS.historyLimit;

    function read() {
      return loadJSON(storage, key, []);
    }

    function push(entry) {
      var next = read().concat([entry]).slice(-maxCount);
      saveJSON(storage, key, next);
      return next;
    }

    function replace(entries) {
      var next = (entries || []).slice(-maxCount);
      saveJSON(storage, key, next);
      return next;
    }

    return {
      read: read,
      push: push,
      replace: replace,
    };
  }

  function pickInitialChain(snapshot) {
    var location = snapshot && snapshot.shipLocation;
    if (location === 'base') {
      return 'sell_chain';
    }
    if (location === 'exchange') {
      return 'resupply_chain';
    }
    return 'wait';
  }

  function reduceResupplyDays(options) {
    var targetDays = Math.max(1, parseInt(options.targetDays, 10) || 1);
    var maxDays = Math.max(1, parseInt(options.maxDays, 10) || targetDays);
    var minDays = Math.max(1, parseInt(options.minDays, 10) || 1);
    var estimate = options.estimate;
    var limits = options.limits || {};
    var maxWeight = Number(limits.maxWeight || Infinity);
    var maxPrice = Number(limits.maxPrice || Infinity);
    var days = Math.min(targetDays, maxDays);
    var safety = 0;

    function fits(currentDays) {
      var result = estimate(currentDays) || {};
      var weight = Number(result.weight || 0);
      var price = Number(result.price || 0);
      return weight <= maxWeight && price <= maxPrice;
    }

    if (fits(days)) {
      return { days: days, weight: estimate(days).weight, price: estimate(days).price, limited: false };
    }

    while (days > minDays && safety < 100) {
      var result = estimate(days) || {};
      var weight = Number(result.weight || 0);
      var price = Number(result.price || 0);
      if (weight <= maxWeight && price <= maxPrice) {
        return { days: days, weight: weight, price: price, limited: days !== targetDays };
      }
      if (days === minDays) {
        break;
      }
      if (days > 1) {
        var ratioWeight = maxWeight === Infinity ? 1 : Math.max(0.1, maxWeight / Math.max(1, weight));
        var ratioPrice = maxPrice === Infinity ? 1 : Math.max(0.1, maxPrice / Math.max(1, price));
        var ratio = Math.min(ratioWeight, ratioPrice, 1);
        if (ratio < 1) {
          days = Math.max(minDays, Math.floor(days * ratio));
          if (days === 0) {
            days = minDays;
          }
        } else {
          days -= 1;
        }
      } else {
        break;
      }
      safety += 1;
    }

    var final = estimate(days) || {};
    return {
      days: days,
      weight: Number(final.weight || 0),
      price: Number(final.price || 0),
      limited: true,
      exhausted: days === minDays && !fits(days),
    };
  }

  function materialIdOf(item) {
    return Number(item && (item.id != null ? item.id : item.i));
  }

  function amountOf(item) {
    return Number(item && (item.am != null ? item.am : item.a != null ? item.a : item.amount != null ? item.amount : 0));
  }

  function mapById(list) {
    var map = new Map();
    (list || []).forEach(function (item) {
      map.set(Number(item.id), item);
    });
    return map;
  }

  function normalizeOutboundWhitelist(entries, materialNames) {
    var names = materialNames || {};
    var seen = new Set();
    return (entries || []).map(function (entry) {
      var id = Number(entry && entry.id);
      var minAmount = Math.max(1, parseInt(entry && entry.minAmount, 10) || 1);
      if (!Number.isFinite(id) || id <= 0 || seen.has(id)) {
        return null;
      }
      seen.add(id);
      return {
        id: id,
        enabled: entry && entry.enabled !== false,
        minAmount: minAmount,
        name: names[id] || entry.name || ('物资 ' + id),
      };
    }).filter(Boolean);
  }

  function createApiClient(win) {
    var requestCounter = 0;
    var API_TYPE_REQUEST = 'GT_LAPI_REQUEST';
    var API_TYPE_RESPONSE = 'GT_LAPI_RESPONSE';

    function request(action, params) {
      return new Promise(function (resolve, reject) {
        var requestId = 'gt-auto-' + Date.now() + '-' + (++requestCounter);
        var timeout = win.setTimeout(function () {
          win.removeEventListener('message', onMessage);
          reject(new Error('GTLocalAPI timeout for ' + action));
        }, 5000);

        function onMessage(event) {
          if (event.source !== win) {
            return;
          }
          if (!event.data || event.data.type !== API_TYPE_RESPONSE) {
            return;
          }
          if (event.data.requestId !== requestId) {
            return;
          }
          win.clearTimeout(timeout);
          win.removeEventListener('message', onMessage);
          if (!event.data.success) {
            reject(new Error(event.data.error || 'GTLocalAPI failed for ' + action));
            return;
          }
          try {
            resolve(JSON.parse(event.data.data));
          } catch (error) {
            reject(error);
          }
        }

        win.addEventListener('message', onMessage);
        win.postMessage({ type: API_TYPE_REQUEST, requestId: requestId, action: action, params: params }, win.location.origin);
      });
    }

    return { request: request };
  }

  function defaultMaterialNames() {
    return {
      1: 'Iron Ore',
      2: 'Iron Bar',
      3: 'Concrete',
      4: 'Grain',
      5: 'Copper Ore',
      6: 'Copper Bar',
      7: 'Oxygen',
      8: 'Silica',
      9: 'Milk',
      10: 'Ale',
      11: 'Water',
      12: 'Basic Rations',
      13: 'Fine Rations',
      14: 'Laboratory Suit',
      15: 'Exosuit',
      16: 'Drinking Water',
      17: 'Basic Tools',
      18: 'Advanced Tools',
      19: 'Welding Kit 2',
      20: 'Robot',
      21: 'Coffee',
      22: 'Bioxene',
      23: 'Tesserite',
      24: 'Hydrogen',
      25: 'Polyethylene',
      26: 'Basic Construction Kit',
      27: 'Construction Tools',
      28: 'Fruits',
      29: 'Vegetables',
      30: 'Neoplast',
      31: 'Carbon',
      32: 'Nitrogen',
      33: 'Glass',
      34: 'Limestone',
      35: 'Steel',
      36: 'Fertilizer',
      37: 'Cow',
      38: 'Meat',
      39: 'Cotton',
      40: 'Uranium Ore',
      41: 'Flux',
      42: 'Aluminium Ore',
      43: 'Aluminium',
      44: 'Workwear',
      45: 'Titanium Ore',
      46: 'Titanium',
      47: 'Furniture',
      48: 'Wood',
      49: 'Leather',
      50: 'Fabric',
      51: 'Coffee Beans',
      52: 'Construction Vehicle',
      53: 'Rubber',
      54: 'Combustion Engine',
      55: 'Motor',
      56: 'Battery',
      57: 'Gasoline',
      58: 'Lubricant',
      59: 'Electronic Circuit',
      60: 'Lithium',
      61: 'Sulfuric Acid',
      62: 'Copper Wiring',
      63: 'Electronics',
      64: 'Research Data',
      65: 'Advanced Research Data',
      66: 'Office Supplies',
    };
  }

  function collectBaseMaterials(base, materialNames) {
    var warehouse = base && base.warehouse;
    var mats = warehouse && Array.isArray(warehouse.mats) ? warehouse.mats : [];
    return mats
      .map(function (item) {
        var id = materialIdOf(item);
        return {
          id: id,
          name: materialNames[id] || ('Material ' + id),
          amount: amountOf(item),
        };
      })
      .filter(function (item) {
        return item.amount > 0;
      });
  }

  function collectOutboundBatch(base, config) {
    var whitelist = (config && config.outboundWhitelist) || [];
    var byId = mapById((base && base.warehouse && base.warehouse.mats) || []);
    return whitelist
      .filter(function (entry) {
        return entry && entry.enabled;
      })
      .map(function (entry) {
        var current = byId.get(Number(entry.id));
        var amount = amountOf(current);
        return {
          id: Number(entry.id),
          name: entry.name || ('Material ' + entry.id),
          current: amount,
          minAmount: Number(entry.minAmount || 1),
          canSend: amount >= Number(entry.minAmount || 1),
        };
      })
      .filter(function (item) {
        return item.canSend;
      });
  }

  function inferShipLocation(company, base) {
    var baseWarehouseId = base && base.warehouseId;
    var ship = null;
    var ships = company && Array.isArray(company.ships) ? company.ships : [];
    var i;

    if (ships.length === 0) {
      return { location: 'unknown', ship: null };
    }

    ship = ships[0];
    for (i = 0; i < ships.length; i += 1) {
      if (baseWarehouseId != null && Number(ships[i].warehouseId) === Number(baseWarehouseId)) {
        ship = ships[i];
        break;
      }
      if (ships[i].baseId && base && Number(ships[i].baseId) === Number(base.id)) {
        ship = ships[i];
        break;
      }
      if (ships[i].location && /exchange/i.test(String(ships[i].location))) {
        ship = ships[i];
      }
    }

    if (ship && baseWarehouseId != null && Number(ship.warehouseId) === Number(baseWarehouseId)) {
      return { location: 'base', ship: ship };
    }
    if (ship && ship.location && /exchange/i.test(String(ship.location))) {
      return { location: 'exchange', ship: ship };
    }
    if (ship && ship.status && /transit|travel/i.test(String(ship.status))) {
      return { location: 'transit', ship: ship };
    }
    if (ship && ship.destination && /exchange/i.test(String(ship.destination))) {
      return { location: 'transit', ship: ship };
    }
    return { location: 'unknown', ship: ship };
  }

  function wait(ms) {
    return new Promise(function (resolve) {
      root.setTimeout(resolve, ms);
    });
  }

  function textIncludesAny(value, texts) {
    var haystack = normalizeText(value).toLowerCase();
    return (texts || []).some(function (text) {
      return haystack.indexOf(normalizeText(text).toLowerCase()) >= 0;
    });
  }

  function findButtonsByTexts(doc, texts) {
    if (!doc) {
      return [];
    }
    return Array.prototype.slice.call(doc.querySelectorAll('button, a, [role="button"], [role="tab"]')).filter(function (node) {
      return textIncludesAny(node.textContent || node.innerText || '', texts);
    });
  }

  function findUniqueButtonByTexts(doc, texts) {
    var matches = findButtonsByTexts(doc, texts).filter(function (node) {
      return node && node.getClientRects && node.getClientRects().length;
    });
    return matches.length ? matches[0] : null;
  }

  function clickElement(element) {
    if (!element) {
      return false;
    }
    if (element.scrollIntoView) {
      element.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    if (element.click) {
      element.click();
      return true;
    }
    return false;
  }

  function setInputValue(input, value) {
    if (!input) {
      return false;
    }
    input.focus();
    input.value = value;
    if (typeof input.dispatchEvent === 'function' && root.Event) {
      input.dispatchEvent(new root.Event('input', { bubbles: true }));
      input.dispatchEvent(new root.Event('change', { bubbles: true }));
      input.dispatchEvent(new root.Event('blur', { bubbles: true }));
    }
    return true;
  }

  function findVisibleCheckboxes(doc) {
    if (!doc) {
      return [];
    }
    return Array.prototype.slice.call(doc.querySelectorAll('input[type="checkbox"]')).filter(function (node) {
      return node && node.getClientRects && node.getClientRects().length;
    });
  }

  function findVisibleInputs(doc) {
    if (!doc) {
      return [];
    }
    return Array.prototype.slice.call(doc.querySelectorAll('input, textarea')).filter(function (node) {
      return node && node.getClientRects && node.getClientRects().length;
    });
  }

  function createApp(env) {
    var win = env && env.window ? env.window : root;
    var doc = env && env.document ? env.document : root.document;
    var storage = resolveStorage();
    var api = createApiClient(win);
    var materialNames = defaultMaterialNames();
    var storesByBaseId = new Map();
    var panelLogHeightKey = 'gtap:panel:logHeight';
    var state = {
      running: false,
      stopped: false,
      currentChain: null,
      currentRun: null,
      lastSnapshot: null,
      lastError: null,
      currentBaseId: null,
      baseStore: null,
      historyStore: null,
    };

    function resolveStores(baseId) {
      var key = String(baseId || 'global');
      if (!storesByBaseId.has(key)) {
        storesByBaseId.set(key, {
          baseStore: createBaseStore(storage, baseId),
          historyStore: createHistoryStore(storage, baseId, DEFAULTS.historyLimit),
        });
      }
      return storesByBaseId.get(key);
    }

    function log(message) {
      var panel = doc && doc.getElementById('gtap-log');
      var line = normalizeText(message);
      if (!line) {
        return;
      }
      if (panel) {
        panel.textContent = (panel.textContent ? panel.textContent + '\n' : '') + line;
        panel.scrollTop = panel.scrollHeight;
      }
      if (root.console && root.console.log) {
        root.console.log('[GTAuto]', line);
      }
    }

    function ensurePanel() {
      if (!doc || doc.getElementById('gtap-panel')) {
        return;
      }

      var panel = doc.createElement('div');
      panel.id = 'gtap-panel';
      panel.style.cssText = [
        'position:fixed',
        'right:16px',
        'bottom:16px',
        'width:380px',
        'z-index:999999',
        'background:rgba(20,24,32,0.96)',
        'border:1px solid rgba(255,255,255,0.14)',
        'border-radius:14px',
        'padding:12px',
        'color:#eef5ff',
        'font:12px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif',
        'box-shadow:0 16px 40px rgba(0,0,0,0.35)',
      ].join(';');

      panel.innerHTML = [
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">',
        '<strong>GT Autopilot</strong>',
        '<span id="gtap-status">就绪</span>',
        '</div>',
        '<div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end;margin-bottom:10px;">',
        '<label style="display:flex;flex-direction:column;gap:4px;min-width:0;">',
        '<span style="opacity:.8;">API Key</span>',
        '<input id="gtap-api-key" type="text" spellcheck="false" style="width:100%;box-sizing:border-box;border-radius:10px;border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.06);color:#eef5ff;padding:8px 10px;">',
        '</label>',
        '<button data-action="save-config" style="height:38px;">保存</button>',
        '</div>',
        '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:10px;">',
        '<button data-action="sell">卖货</button>',
        '<button data-action="resupply">补货</button>',
        '<button data-action="check">检查</button>',
        '<button data-action="wait">等待</button>',
        '<button data-action="stop" style="grid-column:1/-1;">停止</button>',
        '</div>',
        '<div id="gtap-config" style="margin-bottom:10px;padding:10px;border-radius:10px;background:rgba(255,255,255,0.04);"></div>',
        '<div id="gtap-history" style="margin-bottom:10px;padding:10px;border-radius:10px;background:rgba(255,255,255,0.04);max-height:180px;overflow:auto;"></div>',
        '<div id="gtap-log" title="拖动右下角可调整日志高度" style="white-space:pre-wrap;height:220px;min-height:120px;max-height:520px;resize:vertical;overflow:auto;background:rgba(255,255,255,0.04);border-radius:10px;padding:10px;box-sizing:border-box;"></div>',
      ].join('');

      panel.addEventListener('click', function (event) {
        var configButton = event.target && event.target.closest ? event.target.closest('button[data-config-action]') : null;
        if (configButton) {
          event.preventDefault();
          handleConfigAction(configButton);
          return;
        }
        var button = event.target && event.target.closest ? event.target.closest('button[data-action]') : null;
        if (!button) {
          return;
        }
        event.preventDefault();
        handleAction(button.getAttribute('data-action'));
      });

      (doc.body || doc.documentElement).appendChild(panel);
      attachLogHeightPersistence();
      renderConfig(null);
      renderHistory();
      syncPanelConfig({
        apiKey: DEFAULTS.wikiApiKey,
        wikiApiKey: DEFAULTS.wikiApiKey,
        resupplyDays: DEFAULTS.resupplyDays,
        outboundWhitelist: DEFAULTS.outboundWhitelist
      });
      attachPanelDrag(panel);
      log('面板已就绪');
    }

    function attachPanelDrag(panel) {
      var header = panel && panel.firstElementChild;
      if (!panel || !header) {
        return;
      }
      var dragging = false;
      var startX = 0;
      var startY = 0;
      var startLeft = 0;
      var startTop = 0;

      header.style.cursor = 'move';
      header.addEventListener('mousedown', function (event) {
        if (event.target && event.target.closest && event.target.closest('button,input,textarea,select')) {
          return;
        }
        dragging = true;
        startX = event.clientX;
        startY = event.clientY;
        startLeft = panel.offsetLeft;
        startTop = panel.offsetTop;
        panel.style.left = startLeft + 'px';
        panel.style.top = startTop + 'px';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
      });

      win.addEventListener('mousemove', function (event) {
        if (!dragging) {
          return;
        }
        var nextLeft = startLeft + (event.clientX - startX);
        var nextTop = startTop + (event.clientY - startY);
        panel.style.left = Math.max(0, nextLeft) + 'px';
        panel.style.top = Math.max(0, nextTop) + 'px';
      });

      win.addEventListener('mouseup', function () {
        dragging = false;
      });
    }

    function attachLogHeightPersistence() {
      var logPanel = doc && doc.getElementById('gtap-log');
      if (!logPanel) {
        return;
      }

      var savedHeight = parseInt(storage.getItem(panelLogHeightKey) || '220', 10);
      if (Number.isFinite(savedHeight) && savedHeight > 80) {
        logPanel.style.height = savedHeight + 'px';
      } else {
        logPanel.style.height = '220px';
      }

      function saveHeight() {
        var height = Math.round(logPanel.getBoundingClientRect().height);
        if (height > 0) {
          storage.setItem(panelLogHeightKey, String(height));
        }
      }

      if (typeof win.ResizeObserver === 'function') {
        var observer = new win.ResizeObserver(function () {
          saveHeight();
        });
        observer.observe(logPanel);
      } else {
        logPanel.addEventListener('mouseup', saveHeight);
        logPanel.addEventListener('mouseleave', saveHeight);
      }
    }

    function updateStatus(text) {
      var el = doc && doc.getElementById('gtap-status');
      if (el) {
        el.textContent = text;
      }
    }

    function readBaseContext() {
      var company;
      var base;
      var snapshot;
      var baseId;
      var baseConfig;

      return api.request('getMyCompany').then(function (companyData) {
        company = companyData || {};
        baseId = getCurrentBaseId();
        base = (company.bases || []).find(function (item) {
          return Number(item.id) === Number(baseId);
        }) || (company.bases || [])[0] || null;
        state.currentBaseId = base && base.id != null ? Number(base.id) : null;
        var stores = resolveStores(state.currentBaseId);
        state.baseStore = stores.baseStore;
        state.historyStore = stores.historyStore;
        baseConfig = state.baseStore.read();
        return api.request('getPrices').then(function (prices) {
          snapshot = {
            capturedAt: new Date().toISOString(),
            location: win.location.href,
            company: company,
            base: base,
            prices: prices || [],
            config: baseConfig,
            shipInfo: inferShipLocation(company, base || {}),
          };
          state.lastSnapshot = snapshot;
          return snapshot;
        });
      });
    }

    function getCurrentBaseId() {
      var match = String(win.location.pathname || '').match(/\/base\/(\d+)/i);
      if (match) {
        return Number(match[1]);
      }
      var params = new URLSearchParams(String(win.location.search || ''));
      if (params.get('baseId')) {
        return Number(params.get('baseId'));
      }
      return 0;
    }

    function setRunning(value) {
      state.running = !!value;
      updateStatus(state.running ? '运行中' : '就绪');
    }

    function startRun(chain) {
      state.currentChain = chain;
      state.stopped = false;
      state.currentRun = {
        id: 'run-' + Date.now(),
        chain: chain,
        startedAt: new Date().toISOString(),
        steps: [],
        status: 'running',
      };
      setRunning(true);
    }

    function finishRun(status, summary) {
      if (!state.currentRun) {
        return;
      }
      state.currentRun.status = status;
      state.currentRun.endedAt = new Date().toISOString();
      state.currentRun.summary = summary || {};
      if (state.historyStore) {
        state.historyStore.push(deepClone(state.currentRun));
      }
      renderHistory();
      state.currentRun = null;
      state.currentChain = null;
      setRunning(false);
    }

    function pushStep(name, detail) {
      if (state.currentRun) {
        state.currentRun.steps.push({
          at: new Date().toISOString(),
          step: name,
          detail: detail || '',
        });
      }
      log(name + (detail ? '：' + detail : ''));
    }

    function stop() {
      state.stopped = true;
      pushStep('停止', '用户要求停止');
      finishRun('stopped', { reason: STOP_REASON });
    }

    function getShipSnapshot(snapshot) {
      return snapshot && snapshot.shipInfo ? snapshot.shipInfo : { location: 'unknown', ship: null };
    }

    function runSellChain(snapshot) {
      var shipInfo = getShipSnapshot(snapshot);
      var base = snapshot.base || {};
      var config = snapshot.config || (state.baseStore ? state.baseStore.defaults : deepClone(DEFAULTS));
      var batch = collectOutboundBatch(base, config);

      pushStep('出货链', '位置=' + shipInfo.location);
      if (!shipInfo.ship) {
        throw new Error('未找到可用飞船');
      }

      if (shipInfo.location === 'transit') {
        pushStep('等待', '飞船运输中');
        return Promise.resolve({ next: 'wait', snapshot: snapshot });
      }

      if (shipInfo.location !== 'base') {
        pushStep('跳过出货', '飞船不在基地');
        return Promise.resolve({ next: 'wait', snapshot: snapshot });
      }

      pushStep('待出货物资', batch.length ? batch.map(function (item) { return item.name + ' x ' + item.current; }).join('，') : '无');
      return navigateToBaseAndOpenWarehouse().then(function () {
        pushStep('页面', '已切到基地仓库');
        return moveShipToDestination(shipInfo.ship, 'Exchange Station').then(function () {
          pushStep('运输', '已尝试发船到交易所');
          return navigateToExchangePage();
        }).then(function () {
          return sellBatchOnExchange(batch);
        }).then(function (sellSummary) {
          return {
            next: 'done',
            batch: batch,
            sold: sellSummary,
            ship: shipInfo.ship,
          };
        });
      });
    }

    function runResupplyChain(snapshot) {
      var shipInfo = getShipSnapshot(snapshot);
      var base = snapshot.base || {};
      var config = snapshot.config || (state.baseStore ? state.baseStore.defaults : deepClone(DEFAULTS));

      pushStep('补货链', '位置=' + shipInfo.location);
      if (!shipInfo.ship) {
        throw new Error('未找到可用飞船');
      }

      if (shipInfo.location === 'transit') {
        pushStep('等待', '飞船运输中');
        return Promise.resolve({ next: 'wait', snapshot: snapshot });
      }

      if (shipInfo.location !== 'exchange') {
        pushStep('跳过补货', '飞船不在交易所');
        return Promise.resolve({ next: 'wait', snapshot: snapshot });
      }

      return openResupplyPage(config.resupplyDays).then(function () {
        pushStep('页面', '已切到 Resupply');
        return buildResupplyWishlist(base, config);
      }).then(function (wishlistResult) {
        return navigateToExchangePage().then(function () {
          return buyWishlistItemsFromUi(wishlistResult.wishlist);
        }).then(function (buySummary) {
          return moveShipToDestination(shipInfo.ship, base && base.name ? base.name : 'Base').then(function () {
            pushStep('运输', '已尝试发船回基地');
            return {
              next: 'done',
              wishlist: wishlistResult.wishlist,
              reduceResult: wishlistResult.reduceResult,
              buySummary: buySummary,
              ship: shipInfo.ship,
            };
          });
        });
      });
    }

    function buildResupplyWishlist(base, config) {
      if (doc) {
        return buildResupplyWishlistFromUi(config).catch(function () {
          return buildResupplyWishlistFromEstimate(base, config);
        });
      }
      return buildResupplyWishlistFromEstimate(base, config);
    }

    function buildResupplyWishlistFromEstimate(base, config) {
      var targetDays = Number(config.resupplyDays || DEFAULTS.resupplyDays);
      var estimate = function (days) {
        var totalWeight = 0;
        var totalPrice = 0;
        var rows = [];
        var materials = collectBaseMaterials(base, materialNames);
        var limit = Math.min(materials.length, 20);
        var i;

        for (i = 0; i < limit; i += 1) {
          var material = materials[i];
          var amount = Math.max(1, Math.floor(material.amount * Math.min(days / Math.max(1, targetDays), 1)));
          rows.push({ id: material.id, name: material.name, amount: amount });
          totalWeight += amount;
          totalPrice += amount * 100;
        }

        return { weight: totalWeight, price: totalPrice, rows: rows };
      };

      var reduceResult = reduceResupplyDays({
        targetDays: targetDays,
        maxDays: targetDays,
        minDays: 1,
        estimate: function (days) {
          var result = estimate(days);
          return { weight: result.weight, price: result.price };
        },
        limits: {
          maxWeight: snapshotShipCapacity(base) * 0.95,
          maxPrice: snapshotCredits(),
        },
      });

      return Promise.resolve({
        reduceResult: reduceResult,
        wishlist: estimate(reduceResult.days).rows,
      });
    }

    function buildResupplyWishlistFromUi(config) {
      var targetDays = Number(config.resupplyDays || DEFAULTS.resupplyDays);
      return rebuildWishlistAtDays(targetDays).then(function (firstPass) {
        var reduceResult = reduceResupplyDays({
          targetDays: targetDays,
          maxDays: targetDays,
          minDays: 1,
          estimate: function (days) {
            if (days === targetDays) {
              return { weight: firstPass.weight, price: firstPass.price };
            }
            return estimateResupplyTotalsByScale(firstPass.rows, days, targetDays);
          },
          limits: {
            maxWeight: snapshotShipCapacity() * 0.95,
            maxPrice: snapshotCredits(),
          },
        });

        if (reduceResult.days === targetDays) {
          return {
            reduceResult: {
              days: targetDays,
              weight: firstPass.weight,
              price: firstPass.price,
              limited: false,
            },
            wishlist: firstPass.rows,
          };
        }

        return rebuildWishlistAtDays(reduceResult.days).then(function (nextPass) {
          return {
            reduceResult: {
              days: reduceResult.days,
              weight: nextPass.weight,
              price: nextPass.price,
              limited: true,
            },
            wishlist: nextPass.rows,
          };
        });
      });
    }

    function estimateResupplyTotalsByScale(rows, days, baseDays) {
      var weight = 0;
      var price = 0;
      var divisor = Math.max(1, baseDays || 1);
      (rows || []).forEach(function (row) {
        var ratio = Math.min(1, days / divisor);
        weight += Number(row.weight || 0) * ratio;
        price += Number(row.cost || 0) * ratio;
      });
      return { weight: weight, price: price };
    }

    function rebuildWishlistAtDays(days) {
      pushStep('补货天数', String(days));
      applyResupplyDays(days);
      return wait(500)
        .then(clearWishlistFromUi)
        .then(function () {
          return wait(300);
        })
        .then(selectAllResupplyRows)
        .then(function () {
          return wait(300);
        })
        .then(clickAddToWishlistOnUi)
        .then(function () {
          return wait(500);
        })
        .then(readResupplyRowsFromPage);
    }

    function readResupplyRowsFromPage() {
      if (!doc) {
        return Promise.resolve({ weight: 0, price: 0, rows: [] });
      }
      var rows = Array.prototype.slice.call(doc.querySelectorAll('tr')).map(function (row) {
        var cells = Array.prototype.slice.call(row.querySelectorAll('td'));
        if (cells.length < 6) {
          return null;
        }
        var name = normalizeText(cells[0].textContent);
        var resupply = parseNumber(cells[3].textContent, 0);
        var weight = parseNumber(cells[4].textContent, 0);
        var cost = parseNumber(cells[5].textContent, 0);
        if (!name || !resupply) {
          return null;
        }
        return {
          id: 0,
          name: name,
          amount: resupply,
          weight: weight,
          cost: cost,
        };
      }).filter(Boolean);

      var totals = readResupplyTotalsFromPage();
      return Promise.resolve({
        weight: totals.weight,
        price: totals.price,
        rows: rows,
      });
    }

    function readResupplyTotalsFromPage() {
      var text = normalizeText(doc && doc.body ? doc.body.textContent : '');
      var weightMatch = text.match(/TOTAL WEIGHT\s*([0-9,.\-]+)/i) || text.match(/总重量\s*([0-9,.\-]+)/i);
      var costMatch = text.match(/TOTAL COST\s*([0-9,.\-$]+)/i) || text.match(/总成本\s*([0-9,.\-$]+)/i);
      return {
        weight: parseNumber(weightMatch && weightMatch[1], 0),
        price: parseNumber(costMatch && costMatch[1], 0),
      };
    }

    function clearWishlistFromUi() {
      var viewButton = findUniqueButtonByTexts(doc, VIEW_WISHLIST_BUTTON_TEXTS);
      if (viewButton) {
        clickElement(viewButton);
      }
      return wait(400).then(function () {
        var clearButton = findUniqueButtonByTexts(doc, CLEAR_BUTTON_TEXTS);
        if (clearButton) {
          clickElement(clearButton);
        }
        var confirmButton = findUniqueButtonByTexts(doc, CONFIRM_BUTTON_TEXTS);
        if (confirmButton) {
          clickElement(confirmButton);
        }
        return true;
      });
    }

    function selectAllResupplyRows() {
      var checkboxes = findVisibleCheckboxes(doc);
      if (!checkboxes.length) {
        return Promise.resolve(false);
      }
      checkboxes.forEach(function (checkbox) {
        if (!checkbox.checked) {
          clickElement(checkbox);
        }
      });
      return Promise.resolve(true);
    }

    function clickAddToWishlistOnUi() {
      var addButton = findUniqueButtonByTexts(doc, WISHLIST_BUTTON_TEXTS);
      if (!addButton) {
        throw new Error('未找到 Add to Wishlist 按钮');
      }
      clickElement(addButton);
      return Promise.resolve(true);
    }

    function snapshotShipCapacity(base) {
      var company = state.lastSnapshot && state.lastSnapshot.company;
      var shipInfo = state.lastSnapshot && state.lastSnapshot.shipInfo;
      var ship = shipInfo && shipInfo.ship;
      var capacity = ship && (ship.capacity || ship.cargo || ship.maxCargo || ship.maxCapacity || 0);
      return Number(capacity || 0) || 1000;
    }

    function snapshotCredits() {
      var company = state.lastSnapshot && state.lastSnapshot.company;
      return Number((company && (company.credits || company.money || company.cash)) || 0) || 1000000000;
    }

    function navigateToExchangePage() {
      if (!doc) {
        return Promise.resolve(false);
      }
      if (/\/exchange/i.test(String(win.location.pathname || ''))) {
        return Promise.resolve(true);
      }
      var button = findUniqueButtonByTexts(doc, EXCHANGE_BUTTON_TEXTS);
      if (button) {
        clickElement(button);
        return wait(1200).then(function () { return true; });
      }
      win.location.href = 'https://g2.galactictycoons.com/exchange';
      return wait(1600).then(function () { return true; });
    }

    function findDestinationInput() {
      var inputs = findVisibleInputs(doc);
      for (var i = 0; i < inputs.length; i += 1) {
        var input = inputs[i];
        var placeholder = normalizeText(input.getAttribute('placeholder') || '');
        var aria = normalizeText(input.getAttribute('aria-label') || '');
        if (textIncludesAny(placeholder, DESTINATION_INPUT_HINTS) || textIncludesAny(aria, DESTINATION_INPUT_HINTS)) {
          return input;
        }
      }
      return null;
    }

    function moveShipToDestination(ship, destinationName) {
      if (!doc || !ship || !destinationName) {
        return Promise.resolve(false);
      }
      var shipCard = findShipCard(ship);
      if (shipCard) {
        clickElement(shipCard);
      }
      return wait(400).then(function () {
        var input = findDestinationInput();
        if (input) {
          setInputValue(input, destinationName);
        }
        return wait(400);
      }).then(function () {
        var suggestion = findSuggestionByText(destinationName);
        if (suggestion) {
          clickElement(suggestion);
        }
        return wait(400);
      }).then(function () {
        var startButton = findUniqueButtonByTexts(doc, START_FLIGHT_BUTTON_TEXTS);
        if (startButton) {
          clickElement(startButton);
        }
        return true;
      });
    }

    function findShipCard(ship) {
      if (!doc || !ship) {
        return null;
      }
      var shipName = normalizeText(ship.name || '');
      var cards = Array.prototype.slice.call(doc.querySelectorAll('div,button,a,li')).filter(function (node) {
        return node && node.getClientRects && node.getClientRects().length;
      });
      for (var i = 0; i < cards.length; i += 1) {
        var text = normalizeText(cards[i].textContent || '');
        if (shipName && text.indexOf(shipName) >= 0) {
          return cards[i];
        }
      }
      return null;
    }

    function findSuggestionByText(text) {
      if (!doc || !text) {
        return null;
      }
      var nodes = Array.prototype.slice.call(doc.querySelectorAll('div,li,button,a')).filter(function (node) {
        return node && node.getClientRects && node.getClientRects().length;
      });
      for (var i = 0; i < nodes.length; i += 1) {
        if (textIncludesAny(nodes[i].textContent || '', [text])) {
          return nodes[i];
        }
      }
      return null;
    }

    function searchExchangeMaterial(materialName) {
      var inputs = findVisibleInputs(doc);
      for (var i = 0; i < inputs.length; i += 1) {
        var placeholder = normalizeText(inputs[i].getAttribute('placeholder') || '');
        var aria = normalizeText(inputs[i].getAttribute('aria-label') || '');
        if (textIncludesAny(placeholder, ['search', '搜索', '物资']) || textIncludesAny(aria, ['search', '搜索', '物资'])) {
          setInputValue(inputs[i], materialName);
          return true;
        }
      }
      return false;
    }

    function clickExchangeMaterialRow(materialName) {
      if (!doc) {
        return false;
      }
      var rows = Array.prototype.slice.call(doc.querySelectorAll('tr, [role="row"], .mat-row, .mat-item'));
      for (var i = 0; i < rows.length; i += 1) {
        var text = normalizeText(rows[i].textContent || '');
        if (text.indexOf(normalizeText(materialName)) >= 0) {
          clickElement(rows[i]);
          return true;
        }
      }
      return false;
    }

    function setTradeAmount(amount) {
      var inputs = Array.prototype.slice.call(doc.querySelectorAll('input[type="number"], input'));
      for (var i = 0; i < inputs.length; i += 1) {
        var input = inputs[i];
        var placeholder = normalizeText(input.getAttribute('placeholder') || '');
        var aria = normalizeText(input.getAttribute('aria-label') || '');
        if (input.type === 'number' || textIncludesAny(placeholder, ['amount', '数量']) || textIncludesAny(aria, ['amount', '数量'])) {
          return setInputValue(input, String(amount));
        }
      }
      return false;
    }

    function clickTradeAction(texts) {
      var button = findUniqueButtonByTexts(doc, texts);
      if (!button) {
        return false;
      }
      clickElement(button);
      var confirm = findUniqueButtonByTexts(doc, CONFIRM_BUTTON_TEXTS);
      if (confirm) {
        clickElement(confirm);
      }
      return true;
    }

    function buyWishlistItemsFromUi(wishlist) {
      var summary = [];
      return (wishlist || []).reduce(function (promise, item) {
        return promise.then(function () {
          if (!item || !item.name || !item.amount) {
            return;
          }
          pushStep('购买物资', item.name + ' x ' + item.amount);
          searchExchangeMaterial(item.name);
          return wait(300).then(function () {
            clickExchangeMaterialRow(item.name);
            return wait(300);
          }).then(function () {
            setTradeAmount(item.amount);
            return wait(200);
          }).then(function () {
            clickTradeAction(BUY_BUTTON_TEXTS);
            summary.push({ name: item.name, amount: item.amount });
          });
        });
      }, Promise.resolve()).then(function () {
        return summary;
      });
    }

    function sellBatchOnExchange(batch) {
      var summary = [];
      return (batch || []).reduce(function (promise, item) {
        return promise.then(function () {
          if (!item || !item.name || !item.current) {
            return;
          }
          pushStep('卖出物资', item.name + ' x ' + item.current);
          searchExchangeMaterial(item.name);
          return wait(300).then(function () {
            clickExchangeMaterialRow(item.name);
            return wait(300);
          }).then(function () {
            setTradeAmount(item.current);
            return wait(200);
          }).then(function () {
            clickTradeAction(SELL_FORM_BUTTON_TEXTS);
            summary.push({ name: item.name, amount: item.current });
          });
        });
      }, Promise.resolve()).then(function () {
        return summary;
      });
    }

    function navigateToBaseAndOpenWarehouse() {
      if (!doc) {
        return Promise.resolve(false);
      }
      var baseButton = findUniqueButtonByTexts(doc, BASE_BUTTON_TEXTS);
      if (baseButton) {
        clickElement(baseButton);
      }
      return wait(700).then(function () {
        var warehouseButton = findUniqueButtonByTexts(doc, WAREHOUSE_BUTTON_TEXTS);
        if (warehouseButton) {
          clickElement(warehouseButton);
          return wait(700).then(function () { return true; });
        }
        return true;
      });
    }

    function openResupplyPage(days) {
      if (!doc) {
        return Promise.resolve(false);
      }
      var baseButton = findUniqueButtonByTexts(doc, BASE_BUTTON_TEXTS);
      if (baseButton) {
        clickElement(baseButton);
      }
      return wait(700).then(function () {
        var resupplyButton = findUniqueButtonByTexts(doc, RESUPPLY_BUTTON_TEXTS);
        if (resupplyButton) {
          clickElement(resupplyButton);
        }
        return wait(700);
      }).then(function () {
        applyResupplyDays(days);
        return true;
      });
    }

    function applyResupplyDays(days) {
      if (!doc) {
        return false;
      }
      var numberInputs = Array.prototype.slice.call(doc.querySelectorAll('input[type="number"], input'));
      for (var i = 0; i < numberInputs.length; i += 1) {
        var input = numberInputs[i];
        var placeholder = normalizeText(input.getAttribute('placeholder') || '');
        var aria = normalizeText(input.getAttribute('aria-label') || '');
        if (textIncludesAny(placeholder, ['day', 'days', '天']) || textIncludesAny(aria, ['day', 'days', '天'])) {
          return setInputValue(input, String(days));
        }
      }
      return false;
    }

    function renderConfig(config) {
      var container = doc && doc.getElementById('gtap-config');
      if (!container) {
        return;
      }
      if (!config) {
        container.innerHTML = [
          '<div style="display:flex;justify-content:space-between;align-items:center;">',
          '<strong>基地配置</strong>',
          '<span style="opacity:.7;">等待加载</span>',
          '</div>',
          '<div style="margin-top:6px;opacity:.7;">点击“检查”后加载当前基地配置。</div>'
        ].join('');
        return;
      }
      var whitelist = normalizeOutboundWhitelist((config && config.outboundWhitelist) || [], materialNames);
      var materialOptions = Object.keys(materialNames).map(function (id) {
        return { id: Number(id), name: materialNames[id] };
      }).sort(function (a, b) {
        return a.id - b.id;
      }).map(function (item) {
        return '<option value="' + item.id + '">' + escapeHtml(item.name) + ' (#' + item.id + ')</option>';
      }).join('');
      var rows = whitelist.map(function (entry) {
        return [
          '<div data-whitelist-row="' + entry.id + '" style="display:grid;grid-template-columns:auto 1fr 88px auto;gap:8px;align-items:center;margin-top:8px;">',
          '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;">',
          '<input class="gtap-whitelist-enabled" data-entry-id="' + entry.id + '" type="checkbox"' + (entry.enabled ? ' checked' : '') + '>',
          '<span style="opacity:.85;">启用</span>',
          '</label>',
          '<select class="gtap-whitelist-material" data-entry-id="' + entry.id + '" style="min-width:0;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#eef5ff;padding:6px 8px;">',
          materialOptions.replace('value="' + entry.id + '"', 'value="' + entry.id + '" selected'),
          '</select>',
          '<input class="gtap-whitelist-min" data-entry-id="' + entry.id + '" type="number" min="1" step="1" value="' + Number(entry.minAmount || 1) + '" style="width:100%;box-sizing:border-box;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#eef5ff;padding:6px 8px;">',
          '<button data-config-action="remove-whitelist-row" data-entry-id="' + entry.id + '" style="padding:6px 8px;">删除</button>',
          '</div>'
        ].join('');
      }).join('');
      container.innerHTML = [
        '<div style="display:flex;justify-content:space-between;align-items:center;">',
        '<strong>基地配置</strong>',
        '<span>' + escapeHtml(normalizeText((state.lastSnapshot && state.lastSnapshot.base && state.lastSnapshot.base.name) || '当前基地')) + '</span>',
        '</div>',
        '<div style="display:grid;grid-template-columns:1fr 96px;gap:8px;align-items:end;margin-top:8px;">',
        '<label style="display:flex;flex-direction:column;gap:4px;">',
        '<span style="opacity:.8;">补齐天数</span>',
        '<input id="gtap-resupply-days" type="number" min="1" step="1" value="' + Number((config && config.resupplyDays) || DEFAULTS.resupplyDays) + '" style="width:100%;box-sizing:border-box;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#eef5ff;padding:8px 10px;">',
        '</label>',
        '<div style="opacity:.7;font-size:11px;align-self:center;">超重或超预算时会自动集体缩减</div>',
        '</div>',
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">',
        '<strong style="font-size:12px;">卖货白名单</strong>',
        '<button data-config-action="add-whitelist-row" style="padding:6px 8px;">新增</button>',
        '</div>',
        rows || '<div style="margin-top:8px;opacity:.7;">暂无白名单，点击“新增”添加。</div>',
        '<div style="display:grid;grid-template-columns:1fr 88px auto;gap:8px;margin-top:8px;opacity:.7;font-size:11px;">',
        '<span>物资</span>',
        '<span>最小量</span>',
        '<span>操作</span>',
        '</div>'
      ].join('');
    }

    function readPanelWhitelistEntries() {
      if (!doc) {
        return [];
      }
      var rows = Array.prototype.slice.call(doc.querySelectorAll('[data-whitelist-row]'));
      return rows.map(function (row) {
        var id = Number(row.getAttribute('data-whitelist-row'));
        var enabledInput = row.querySelector('.gtap-whitelist-enabled');
        var materialSelect = row.querySelector('.gtap-whitelist-material');
        var minInput = row.querySelector('.gtap-whitelist-min');
        return {
          id: Number(materialSelect && materialSelect.value || id),
          enabled: !!(enabledInput && enabledInput.checked),
          minAmount: Math.max(1, parseInt(minInput && minInput.value, 10) || 1),
        };
      });
    }

    function readPanelDraftConfig(fallbackConfig) {
      var baseConfig = deepClone(fallbackConfig || (state.baseStore ? state.baseStore.read() : createBaseStore(storage, 'global').defaults));
      var resupplyDaysInput = doc && doc.getElementById('gtap-resupply-days');
      var whitelistRows = readPanelWhitelistEntries();
      if (resupplyDaysInput) {
        baseConfig.resupplyDays = Math.max(1, parseInt(resupplyDaysInput.value, 10) || DEFAULTS.resupplyDays);
      }
      if (whitelistRows.length) {
        baseConfig.outboundWhitelist = normalizeOutboundWhitelist(whitelistRows, materialNames);
      }
      return baseConfig;
    }

    function addWhitelistRow() {
      var next = readPanelDraftConfig();
      var whitelist = normalizeOutboundWhitelist(next.outboundWhitelist || [], materialNames);
      var used = new Set(whitelist.map(function (entry) { return Number(entry.id); }));
      var candidateIds = Object.keys(materialNames).map(function (id) { return Number(id); }).sort(function (a, b) { return a - b; });
      var nextId = candidateIds.find(function (id) {
        return !used.has(id);
      }) || candidateIds[0] || 1;
      whitelist.push({
        id: nextId,
        enabled: true,
        minAmount: 1,
        name: materialNames[nextId] || ('物资 ' + nextId),
      });
      next.outboundWhitelist = whitelist;
      renderConfig(next);
    }

    function removeWhitelistRow(entryId) {
      var next = readPanelDraftConfig();
      next.outboundWhitelist = normalizeOutboundWhitelist(next.outboundWhitelist || [], materialNames).filter(function (entry) {
        return Number(entry.id) !== Number(entryId);
      });
      renderConfig(next);
    }

    function handleConfigAction(button) {
      var action = button && button.getAttribute('data-config-action');
      var entryId = Number(button && button.getAttribute('data-entry-id'));
      if (action === 'add-whitelist-row') {
        addWhitelistRow();
        return;
      }
      if (action === 'remove-whitelist-row') {
        removeWhitelistRow(entryId);
      }
    }

    function renderHistory() {
      var container = doc && doc.getElementById('gtap-history');
      if (!container) {
        return;
      }
      var list = state.historyStore ? state.historyStore.read() : [];
      if (!list.length) {
        container.innerHTML = '<strong>运行历史</strong><div style="margin-top:6px;opacity:.7;">暂无运行记录</div>';
        return;
      }
      var html = '<strong>运行历史</strong>';
      html += list.slice().reverse().map(function (entry) {
        var summary = entry.summary || {};
        var steps = (entry.steps || []).map(function (step) {
          return '<div style="margin-top:4px;opacity:.82;">' + normalizeText(step.step) + (step.detail ? '：' + normalizeText(step.detail) : '') + '</div>';
        }).join('');
        return [
          '<details style="margin-top:8px;border-top:1px solid rgba(255,255,255,0.08);padding-top:8px;">',
          '<summary style="cursor:pointer;">',
          normalizeText(entry.chain || entry.status || 'run'),
          ' / ',
          normalizeText(entry.status || ''),
          ' / ',
          normalizeText(entry.startedAt || ''),
          '</summary>',
          '<div style="margin-top:6px;font-size:12px;opacity:.88;">',
          '摘要：' + normalizeText(JSON.stringify(summary)),
          steps,
          '</div>',
          '</details>'
        ].join('');
      }).join('');
      container.innerHTML = html;
    }

    function handleAction(action) {
      if (action === 'stop') {
        stop();
        return;
      }

      if (state.running) {
        pushStep('忙碌', '已有任务在运行');
        return;
      }

      readBaseContext().then(function (snapshot) {
        if (action === 'check') {
          startRun('check');
          pushStep('检查', snapshot.base ? (snapshot.base.name || ('Base ' + snapshot.base.id)) : '未识别基地');
          pushStep('飞船位置', snapshot.shipInfo.location);
          syncPanelConfig(snapshot.config);
          renderConfig(snapshot.config);
          finishRun('success', { location: snapshot.shipInfo.location });
          return;
        }

        if (action === 'wait') {
          startRun('wait');
          pushStep('等待', '轮询中');
          syncPanelConfig(snapshot.config);
          renderConfig(snapshot.config);
          finishRun('success', { waited: true });
          return;
        }

        if (action === 'sell') {
          startRun('sell_chain');
          syncPanelConfig(snapshot.config);
          renderConfig(snapshot.config);
          return runSellChain(snapshot).then(function (result) {
            if (result && result.next === 'wait') {
              finishRun('waiting', { chain: 'sell_chain' });
              return;
            }
            pushStep('出货完成', (result.sold || []).length ? ('已卖出 ' + result.sold.length + ' 种物资') : '未卖出物资');
            finishRun('success', { chain: 'sell_chain', sold: result.sold || [] });
          }).catch(function (error) {
            state.lastError = String(error && error.message ? error.message : error);
            pushStep('失败', state.lastError);
            finishRun('failed', { error: state.lastError });
          });
        }

        if (action === 'resupply') {
          startRun('resupply_chain');
          syncPanelConfig(snapshot.config);
          renderConfig(snapshot.config);
          return runResupplyChain(snapshot).then(function (result) {
            if (result && result.next === 'wait') {
              finishRun('waiting', { chain: 'resupply_chain' });
              return;
            }
            pushStep('补货完成', (result.buySummary || []).length ? ('已购买 ' + result.buySummary.length + ' 种物资') : '未购买物资');
            finishRun('success', {
              chain: 'resupply_chain',
              days: result && result.reduceResult ? result.reduceResult.days : null,
              bought: result.buySummary || []
            });
          }).catch(function (error) {
            state.lastError = String(error && error.message ? error.message : error);
            pushStep('失败', state.lastError);
            finishRun('failed', { error: state.lastError });
          });
        }

        if (action === 'save-config') {
          startRun('save_config');
          savePanelConfig(snapshot);
          renderConfig(state.baseStore.read());
          pushStep('保存配置', '已保存 API Key 与补齐天数');
          finishRun('success', { saved: true });
        }
      }).catch(function (error) {
        state.lastError = String(error && error.message ? error.message : error);
        pushStep('检查失败', state.lastError);
        finishRun('failed', { error: state.lastError });
      });
    }

    function syncPanelConfig(config) {
      if (!doc) {
        return;
      }
      var apiKeyInput = doc.getElementById('gtap-api-key');
      if (apiKeyInput && config) {
        apiKeyInput.value = config.apiKey || config.wikiApiKey || DEFAULTS.wikiApiKey;
      }
      if (config) {
        renderConfig(config);
      }
    }

    function savePanelConfig(snapshot) {
      if (!state.baseStore) {
        resolveStores((snapshot && snapshot.base && snapshot.base.id) || state.currentBaseId || 'global');
      }
      var config = state.baseStore.read();
      var apiKeyInput = doc && doc.getElementById('gtap-api-key');
      var next = readPanelDraftConfig(config);
      next.apiKey = normalizeText(apiKeyInput && apiKeyInput.value) || DEFAULTS.wikiApiKey;
      next.wikiApiKey = next.apiKey;
      state.baseStore.write(next);
      syncPanelConfig(next);
    }

    function start() {
      ensurePanel();
      updateStatus('就绪');
      return api;
    }

    var api = {
      normalizeText: normalizeText,
      parseNumber: parseNumber,
      pickInitialChain: pickInitialChain,
      reduceResupplyDays: reduceResupplyDays,
      createMemoryStorage: createMemoryStorage,
      createBaseStore: createBaseStore,
      createHistoryStore: createHistoryStore,
      createApiClient: createApiClient,
      collectOutboundBatch: collectOutboundBatch,
      normalizeOutboundWhitelist: normalizeOutboundWhitelist,
      createApp: createApp,
      start: function () {
        ensurePanel();
        updateStatus('就绪');
        return api;
      },
      constants: {
        defaults: deepClone(DEFAULTS),
        saleButtonTexts: deepClone(SALE_BUTTON_TEXTS),
        buyButtonTexts: deepClone(BUY_BUTTON_TEXTS),
        confirmButtonTexts: deepClone(CONFIRM_BUTTON_TEXTS),
        resupplyButtonTexts: deepClone(RESUPPLY_BUTTON_TEXTS),
        wishlistButtonTexts: deepClone(WISHLIST_BUTTON_TEXTS),
      },
    };

    return api;
  }

  return createApp(root);
});
