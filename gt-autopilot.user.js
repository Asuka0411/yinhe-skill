// ==UserScript==
// @name         Galactic Tycoons Autopilot
// @namespace    https://g2.galactictycoons.com/
// @version      0.1.22
// @updateURL    http://127.0.0.1:18793/gt-autopilot.user.js
// @downloadURL  http://127.0.0.1:18793/gt-autopilot.user.js
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
      { id: 80, enabled: true, minAmount: 1, name: 'Graphenium Wire' },
    ],
    sellBlacklist: [
      { id: 113, enabled: true, name: 'Ship Repair Kit' },
      { id: 149, enabled: true, name: 'Antimatter' },
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
  var APP_VERSION = '0.1.22';
  var MATERIAL_ATLAS_HREF = '/assets/atlas-_p6d2Xs0.svg';
  var ATOMIC_ACTIONS = [
    { action: 'sell_exchange_inventory', label: '一键卖货', status: 'done' },
    { action: 'buy_wishlist', label: '一键购买 wishlist' },
    { action: 'fuel_ship', label: '一键加油' },
    { action: 'repair_ship', label: '一键修飞船' },
    { action: 'repair_base_buildings', label: '一键修基地建筑' },
    { action: 'restock_ship_repair_materials', label: '一键补飞船修理材料' },
  ];
  var WISHLIST_RESUPPLY_ATOMIC_STEPS = [
    { action: 'wishlist_read_current_base', label: '读取当前基地', status: 'pending' },
    { action: 'wishlist_clear_base_wishlist', label: '清空基地 wishlist', status: 'pending' },
    { action: 'wishlist_check_ship_at_exchange', label: '检查飞船在交易所', status: 'pending' },
    { action: 'wishlist_create_resupply_wishlist', label: '创建补给 wishlist', status: 'pending' },
    { action: 'wishlist_open_exchange', label: '打开交易所', status: 'pending' },
    { action: 'wishlist_read_wishlist', label: '读取 wishlist', status: 'pending' },
    { action: 'wishlist_buy_wishlist', label: '购买 wishlist', status: 'pending' },
    { action: 'wishlist_transfer_to_ship', label: '转移到飞船', status: 'pending' },
    { action: 'wishlist_fuel_ship', label: '飞船补油', status: 'pending' },
    { action: 'wishlist_repair_ship', label: '修理飞船', status: 'pending' },
    { action: 'wishlist_send_ship_home', label: '发船回基地', status: 'pending' },
  ];
  var SHIP_SUPPORT_MATERIALS = [
    { id: 149, name: 'Antimatter', targetAmount: 2000, role: 'fuel' },
    { id: 113, name: 'Ship Repair Kit', targetAmount: 2000, role: 'repair' },
  ];

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

  function getAtomicActions() {
    return deepClone(ATOMIC_ACTIONS);
  }

  function getWishlistResupplyAtomicSteps() {
    return deepClone(WISHLIST_RESUPPLY_ATOMIC_STEPS);
  }

  function findAtomicAction(action) {
    var name = normalizeText(action);
    for (var i = 0; i < ATOMIC_ACTIONS.length; i += 1) {
      if (ATOMIC_ACTIONS[i].action === name) {
        return ATOMIC_ACTIONS[i];
      }
    }
    for (var j = 0; j < WISHLIST_RESUPPLY_ATOMIC_STEPS.length; j += 1) {
      if (WISHLIST_RESUPPLY_ATOMIC_STEPS[j].action === name) {
        return WISHLIST_RESUPPLY_ATOMIC_STEPS[j];
      }
    }
    return null;
  }

  function runAtomicAction(action) {
    var entry = findAtomicAction(action);
    if (!entry) {
      return {
        action: normalizeText(action),
        label: '未知原子功能',
        status: 'failed',
        message: '未知原子功能：' + normalizeText(action),
      };
    }
    return {
      action: entry.action,
      label: entry.label,
      status: 'pending',
      message: entry.label + '：真实流程待接入',
    };
  }

  function getShipSupportMaterials() {
    return deepClone(SHIP_SUPPORT_MATERIALS);
  }

  function planShipSupportMaterialRestock(exchangeWarehouse) {
    var byId = mapById((exchangeWarehouse && exchangeWarehouse.mats) || []);
    return SHIP_SUPPORT_MATERIALS.map(function (material) {
      var current = amountOf(byId.get(Number(material.id)));
      var missing = Math.max(0, Number(material.targetAmount || 0) - current);
      if (!missing) {
        return null;
      }
      return {
        id: material.id,
        name: material.name,
        amount: missing,
        current: current,
        targetAmount: material.targetAmount,
        role: material.role,
      };
    }).filter(Boolean);
  }

  function normalizeMaterialBlocklist(entries, materialNames) {
    var names = materialNames || {};
    var seen = new Set();
    return (entries || []).map(function (entry) {
      var id = Number(entry && entry.id);
      if (!Number.isFinite(id) || id <= 0 || seen.has(id)) {
        return null;
      }
      seen.add(id);
      var icon = getMaterialIconMeta(id, names, entry);
      return {
        id: id,
        enabled: entry && entry.enabled !== false,
        name: names[id] || entry.name || ('物资 ' + id),
        iconId: icon.iconId,
        iconHref: icon.iconHref,
      };
    }).filter(Boolean);
  }

  function planExchangeInventorySellBatch(exchangeWarehouse, config) {
    var names = defaultMaterialNames();
    var blacklist = config && Array.isArray(config.sellBlacklist) ? config.sellBlacklist : DEFAULTS.sellBlacklist;
    var blocked = new Set(normalizeMaterialBlocklist(blacklist, names)
      .filter(function (entry) { return entry.enabled; })
      .map(function (entry) { return Number(entry.id); }));
    return ((exchangeWarehouse && exchangeWarehouse.mats) || []).map(function (item) {
      var id = materialIdOf(item);
      var amount = amountOf(item);
      if (!Number.isFinite(id) || blocked.has(Number(id)) || amount <= 0) {
        return null;
      }
      return {
        id: id,
        name: names[id] || ('Material ' + id),
        current: amount,
      };
    }).filter(Boolean);
  }

  function calculateSellOfferPrice(lowestPrice) {
    var price = Number(lowestPrice || 0);
    if (!Number.isFinite(price) || price <= 0) {
      return 0;
    }
    return price;
  }

  function validateSellOfferBeforeSubmit(options) {
    var expectedAmount = Number(options && options.expectedAmount || 0);
    var actualAmount = Number(options && options.actualAmount || 0);
    var actualPrice = Number(options && options.actualPrice || 0);
    if (!expectedAmount || actualAmount !== expectedAmount) {
      return {
        ok: false,
        reason: '卖货数量异常：期望 ' + expectedAmount + '，实际 ' + actualAmount,
      };
    }
    if (!actualPrice) {
      return {
        ok: false,
        reason: '卖货价格为空或无效：实际 ' + actualPrice,
      };
    }
    return { ok: true, reason: '' };
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
      sellBlacklist: deepClone(DEFAULTS.sellBlacklist),
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

    function normalizeConfig(value) {
      var next = Object.assign({}, deepClone(defaults), value || {});
      next.workflow = Object.assign({}, deepClone(defaults.workflow), (value && value.workflow) || {});
      next.resupplyDays = Math.max(1, parseInt(next.resupplyDays, 10) || DEFAULTS.resupplyDays);
      next.apiKey = normalizeText(next.apiKey || next.wikiApiKey || DEFAULTS.wikiApiKey) || DEFAULTS.wikiApiKey;
      next.wikiApiKey = next.apiKey;
      next.outboundWhitelist = normalizeOutboundWhitelist(next.outboundWhitelist || defaults.outboundWhitelist, defaultMaterialNames());
      next.sellBlacklist = normalizeMaterialBlocklist(next.sellBlacklist || defaults.sellBlacklist, defaultMaterialNames());
      if (!next.sellBlacklist.length) {
        next.sellBlacklist = normalizeMaterialBlocklist(defaults.sellBlacklist, defaultMaterialNames());
      }
      return next;
    }

    function read() {
      var current = loadJSON(storage, key, defaults);
      var normalized = normalizeConfig(current);
      if (JSON.stringify(current) !== JSON.stringify(normalized)) {
        saveJSON(storage, key, normalized);
      }
      return normalized;
    }

    function write(value) {
      var normalized = normalizeConfig(value);
      saveJSON(storage, key, normalized);
      return normalized;
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
    var location = snapshot && (snapshot.shipLocation || (snapshot.shipInfo && snapshot.shipInfo.location));
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
    return Number(item && (item.matId != null ? item.matId : item.id != null ? item.id : item.i));
  }

  function amountOf(item) {
    if (!item) {
      return 0;
    }
    var amount = Number(item.am != null ? item.am : item.a != null ? item.a : item.amount != null ? item.amount : 0);
    return Number.isFinite(amount) ? amount : 0;
  }

  function mapById(list) {
    var map = new Map();
    (list || []).forEach(function (item) {
      var id = materialIdOf(item);
      if (Number.isFinite(id)) {
        map.set(id, item);
      }
    });
    return map;
  }

  function findPriceForMaterial(prices, materialId) {
    var id = Number(materialId);
    var list = Array.isArray(prices) ? prices : [];
    for (var i = 0; i < list.length; i += 1) {
      if (Number(list[i] && (list[i].matId != null ? list[i].matId : list[i].id)) === id) {
        return list[i];
      }
    }
    return null;
  }

  function materialIconIdFromName(name) {
    return normalizeText(name).replace(/[^a-zA-Z0-9]+/g, '');
  }

  function defaultMaterialIconIds() {
    return {
      80: 'Superconductors',
      113: 'ShipRepairKit',
      136: 'TiridiumAlloy',
      149: 'Antimatter',
      172: 'Graphenium',
    };
  }

  function getMaterialIconMeta(materialId, materialNames, entry) {
    var id = Number(materialId);
    var iconId = normalizeText(entry && entry.iconId);
    var iconHref = normalizeText(entry && entry.iconHref);
    if (!iconId) {
      iconId = defaultMaterialIconIds()[id] || materialIconIdFromName((materialNames && materialNames[id]) || '');
    }
    if (!iconId) {
      iconId = 'Material' + id;
    }
    if (!iconHref) {
      iconHref = MATERIAL_ATLAS_HREF + '#' + iconId;
    }
    return {
      iconId: iconId,
      iconHref: iconHref,
    };
  }

  function materialIconHtml(entry, materialNames) {
    var icon = getMaterialIconMeta(entry && entry.id, materialNames, entry);
    return [
      '<span class="gtap-material-icon" data-icon-id="' + escapeHtml(icon.iconId) + '" data-icon-href="' + escapeHtml(icon.iconHref) + '" style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:7px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.10);">',
      '<svg aria-hidden="true" style="width:18px;height:18px;fill:currentColor;color:#dbe7f7;">',
      '<use href="' + escapeHtml(icon.iconHref) + '" xlink:href="' + escapeHtml(icon.iconHref) + '"></use>',
      '</svg>',
      '</span>'
    ].join('');
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
      var icon = getMaterialIconMeta(id, names, entry);
      return {
        id: id,
        enabled: entry && entry.enabled !== false,
        minAmount: minAmount,
        name: names[id] || entry.name || ('物资 ' + id),
        iconId: icon.iconId,
        iconHref: icon.iconHref,
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
      67: 'Aeridium Ore',
      68: 'Pipes',
      69: 'Argon',
      70: 'Kryon',
      71: 'Coolant',
      72: 'Epoxy',
      73: 'Fission Fuel',
      74: 'Kevlar',
      75: 'Platinum Ore',
      76: 'Platinum',
      77: 'Graphene',
      78: 'Carbon Nanotubes',
      79: 'Aerogel',
      80: 'Graphenium Wire',
      81: 'Radiation Shielding',
      82: 'Life Support System',
      83: 'Reinforced Glass',
      84: 'Color Compound',
      85: 'Spectra Modulator',
      86: 'Mining Vehicle',
      87: 'Drill',
      88: 'Chicken',
      89: 'Insulation Panels',
      90: 'Pressure Sealant Kit',
      91: 'Structural Elements',
      92: 'Basic Prefab Kit',
      93: 'Basic Amenities',
      94: 'Advanced Construction Kit',
      95: 'Apex Structural Elements',
      96: 'Advanced Prefab Kit',
      97: 'Advanced Amenities',
      98: 'Reinforced Truss',
      99: 'Composite Truss',
      100: 'Advanced Drill',
      101: 'Hydrogen Generator',
      102: 'Control Console',
      103: 'Ship Interior Kit',
      104: 'Basic Hull Plate',
      105: 'Cargo Bay Segment',
      106: 'Fuel Tank Segment',
      107: 'Basic Pump',
      108: 'Welding Kit',
      109: 'Basic FTL Emitter',
      110: 'Hydrogen Fuel Cell',
      111: 'Heat Shielding',
      112: 'Advanced Circuit Board',
      113: 'Ship Repair Kit',
      114: 'Quadranium Hull Plate',
      115: 'FTL Field Controller',
      116: 'Sensor Array',
      117: 'Cooling System',
      118: 'Basic Ship Bridge',
      119: 'VR Headset',
      120: 'Composite Shielding',
      121: 'Nanoweave Shielding',
      122: 'Durablend',
      123: 'Neoplast Sheet',
      124: 'Transistor',
      125: 'Chip',
      126: 'Silicon Wafer',
      127: 'Apex Research Data',
      128: 'Honeycaps',
      129: 'Sugar',
      130: 'Pie',
      131: 'Eggs',
      132: 'Modern Prefab Kit',
      133: 'Fission Reactor',
      134: 'Advanced FTL Emitter',
      135: 'Aeridium',
      136: 'Tiridium Alloy',
      137: 'Tiridium Hull Plate',
      138: 'AI Core',
      139: 'Advanced Ship Bridge',
      140: 'Mainframe',
      141: 'Nanopolyne',
      142: 'Nanoweave',
      143: 'Drone',
      144: 'Apex Prefab Kit',
      145: 'Cohesilite',
      146: 'Operating System',
      147: 'AI',
      148: 'AI Training Data',
      149: 'Antimatter',
      150: 'Antimatter Reactor',
      151: 'Antimatter Containment',
      152: 'Hyper Coil',
      153: 'Gourmet Rations',
      154: 'Exotic Spices',
      155: 'Lobster',
      156: 'Herbs',
      157: 'Rejuvaline',
      158: 'Vitaqua',
      159: 'Quadranium',
      160: 'Superior FTL Emitter',
      161: 'Industrial Machinery',
      162: 'Biopolyne',
      163: 'Nanobots',
      164: 'Quantum Research Data',
      165: 'Filtration System',
      166: 'T4 Ship Bridge',
      167: 'Neural Interface',
      168: 'T3 Repair Kit',
      169: 'APU',
      170: 'Starglass',
      171: 'T4 Ship Elements',
      172: 'Graphenium',
      173: 'Quantum Mainframe',
      174: 'Field Cooling',
      175: 'Nutrient Blend',
      176: 'Pack Medicine',
      177: 'Pack Food',
      178: 'Pack Ship Parts',
      179: 'Pack Defense',
      180: 'Pack Habitats',
      181: 'Pack Scientific',
      182: 'Pack Gifts',
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
    return collectBatchFromWarehouse((base && base.warehouse) || null, config);
  }

  function collectBatchFromWarehouse(warehouse, config) {
    var whitelist = (config && config.outboundWhitelist) || [];
    var byId = mapById((warehouse && warehouse.mats) || []);
    var fallbackNames = defaultMaterialNames();
    return whitelist
      .filter(function (entry) {
        return entry && entry.enabled;
      })
      .map(function (entry) {
        var current = byId.get(Number(entry.id));
        var amount = amountOf(current);
        return {
          id: Number(entry.id),
          name: fallbackNames[Number(entry.id)] || entry.name || ('Material ' + entry.id),
          current: amount,
          minAmount: Number(entry.minAmount || 1),
          canSend: amount >= Number(entry.minAmount || 1),
        };
      })
      .filter(function (item) {
        return item.canSend;
      });
  }

  function readShipsFromPage(doc) {
    if (!doc || typeof doc.querySelectorAll !== 'function') {
      return [];
    }
    return Array.prototype.slice.call(doc.querySelectorAll('li.list-group-item.list-group-item-hover.list-group-item-dark'))
      .map(function (node) {
        var nameNode = node && typeof node.querySelector === 'function'
          ? node.querySelector('span.link-primary.cursor-pointer.text-truncate')
          : null;
        var locationNode = node && typeof node.querySelector === 'function'
          ? (
            node.querySelector('div.text-body-secondary.small span.cursor-pointer.link-light') ||
            node.querySelector('div.text-body-secondary.small')
          )
          : null;
        var name = normalizeText(nameNode && (nameNode.textContent || nameNode.innerText));
        var locationText = normalizeText(locationNode && (locationNode.textContent || locationNode.innerText));
        if (!name || !locationText) {
          return null;
        }
        return {
          name: name,
          locationText: locationText,
        };
      })
      .filter(Boolean);
  }

  function extractTrailingToken(value) {
    var text = normalizeText(value);
    var hyphenMatch = text.match(/-([^- ]+)$/);
    if (hyphenMatch) {
      return hyphenMatch[1];
    }
    var numberMatch = text.match(/(\d+)(?!.*\d)/);
    return numberMatch ? numberMatch[1] : '';
  }

  function sameRouteToken(left, right) {
    var a = normalizeText(left);
    var b = normalizeText(right);
    if (!a || !b) {
      return false;
    }
    return String(parseInt(a, 10)) === String(parseInt(b, 10)) || a === b;
  }

  function shipMatchesBase(ship, base) {
    var shipToken = extractTrailingToken(ship && ship.name);
    var baseToken = extractTrailingToken(base && base.name);
    if (!shipToken || !baseToken) {
      return false;
    }
    return sameRouteToken(shipToken, baseToken);
  }

  function findShipByBaseHint(ships, base) {
    var list = Array.isArray(ships) ? ships : [];
    for (var i = 0; i < list.length; i += 1) {
      if (shipMatchesBase(list[i], base)) {
        return list[i];
      }
    }
    return null;
  }

  function isExchangeLocationText(value) {
    return /exchange station/i.test(normalizeText(value));
  }

  function isTransitLocationText(value) {
    return /(arriv|transit|travel|flight|en route|boosted)/i.test(normalizeText(value));
  }

  function inferShipLocationFromPage(doc, base) {
    var ships = readShipsFromPage(doc);
    var baseName = normalizeText(base && base.name);
    var hintedShip = findShipByBaseHint(ships, base);
    var baseShip = null;
    var exchangeShip = null;
    var transitShip = null;
    var i;

    if (!ships.length) {
      return null;
    }

    for (i = 0; i < ships.length; i += 1) {
      if (baseName && normalizeText(ships[i].locationText) === baseName) {
        baseShip = ships[i];
        break;
      }
      if (!exchangeShip && isExchangeLocationText(ships[i].locationText)) {
        exchangeShip = ships[i];
      }
      if (!transitShip && isTransitLocationText(ships[i].locationText)) {
        transitShip = ships[i];
      }
    }

    if (baseShip) {
      return { location: 'base', ship: baseShip };
    }
    if (hintedShip) {
      if (isExchangeLocationText(hintedShip.locationText)) {
        return { location: 'exchange', ship: hintedShip };
      }
      if (isTransitLocationText(hintedShip.locationText)) {
        return { location: 'transit', ship: hintedShip };
      }
    }
    if (exchangeShip) {
      return { location: 'exchange', ship: exchangeShip };
    }
    if (transitShip) {
      return { location: 'transit', ship: transitShip };
    }
    return null;
  }

  function inferShipLocation(company, base, doc) {
    var baseWarehouseId = base && base.warehouseId;
    var basePlanetId = base && base.planetId;
    var exchangeWarehouseId = company && company.exWhId;
    var ship = null;
    var exchangeShip = null;
    var transitShip = null;
    var ships = company && Array.isArray(company.ships) ? company.ships : [];
    var hintedShip = findShipByBaseHint(ships, base);
    var i;

    if (ships.length === 0) {
      return inferShipLocationFromPage(doc, base) || { location: 'unknown', ship: null };
    }

    ship = hintedShip || ships[0];
    for (i = 0; i < ships.length; i += 1) {
      if (baseWarehouseId != null && Number(ships[i].warehouseId) === Number(baseWarehouseId)) {
        ship = ships[i];
        break;
      }
      if (basePlanetId != null && Number(ships[i].pId) === Number(basePlanetId)) {
        ship = ships[i];
        break;
      }
      if (exchangeWarehouseId != null && Number(ships[i].warehouseId) === Number(exchangeWarehouseId)) {
        exchangeShip = exchangeShip || ships[i];
        continue;
      }
      if (ships[i].flight) {
        transitShip = transitShip || ships[i];
      }
    }

    if (ship === ships[0]) {
      ship = exchangeShip || transitShip || ship;
    }

    if (ship && ship.flight && ship.flight.aDate) {
      return { location: 'transit', ship: ship };
    }
    if (ship && baseWarehouseId != null && Number(ship.warehouseId) === Number(baseWarehouseId)) {
      return { location: 'base', ship: ship };
    }
    if (ship && basePlanetId != null && Number(ship.pId) === Number(basePlanetId)) {
      return { location: 'base', ship: ship };
    }
    if (ship && exchangeWarehouseId != null && Number(ship.warehouseId) === Number(exchangeWarehouseId)) {
      return { location: 'exchange', ship: ship };
    }
    if (ship && ship.flight) {
      return { location: 'transit', ship: ship };
    }
    return inferShipLocationFromPage(doc, base) || { location: 'unknown', ship: ship };
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

  function findButtonByIconHref(docRef, iconToken) {
    if (!docRef || !iconToken || typeof docRef.querySelectorAll !== 'function') {
      return null;
    }
    var buttons = Array.prototype.slice.call(docRef.querySelectorAll('button'));
    for (var i = 0; i < buttons.length; i += 1) {
      if (String(buttons[i].innerHTML || '').indexOf(iconToken) >= 0) {
        return buttons[i];
      }
    }
    return null;
  }

  function setInputValue(input, value) {
    if (!input) {
      return false;
    }
    input.focus();
    var textValue = String(value);
    try {
      var proto = root.HTMLInputElement && input instanceof root.HTMLInputElement
        ? root.HTMLInputElement.prototype
        : null;
      var descriptor = proto && Object.getOwnPropertyDescriptor(proto, 'value');
      if (descriptor && typeof descriptor.set === 'function') {
        descriptor.set.call(input, textValue);
      } else {
        input.value = textValue;
      }
    } catch (error) {
      input.value = textValue;
    }
    if (typeof input.dispatchEvent === 'function' && root.Event) {
      input.dispatchEvent(new root.Event('input', { bubbles: true }));
      input.dispatchEvent(new root.Event('change', { bubbles: true }));
      input.dispatchEvent(new root.Event('blur', { bubbles: true }));
    }
    return true;
  }

  function setCheckboxValue(input, checked) {
    if (!input) {
      return false;
    }
    if (!!input.checked === !!checked) {
      return true;
    }
    input.checked = !!checked;
    if (typeof input.dispatchEvent === 'function' && root.Event) {
      input.dispatchEvent(new root.Event('input', { bubbles: true }));
      input.dispatchEvent(new root.Event('change', { bubbles: true }));
      input.dispatchEvent(new root.Event('click', { bubbles: true }));
    } else if (typeof input.click === 'function') {
      input.click();
    }
    return !!input.checked === !!checked;
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
    var apiClient = createApiClient(win);
    var materialNames = defaultMaterialNames();
    var storesByBaseId = new Map();
    var panelLogHeightKey = 'gtap:panel:logHeight';
    var state = {
      running: false,
      stopped: false,
      autoLoopEnabled: false,
      autoLoopTimer: null,
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

    function ensureCurrentStores() {
      var baseId = state.currentBaseId;
      if (baseId == null) {
        baseId = getCurrentBaseId();
        state.currentBaseId = baseId || null;
      }
      if (!state.baseStore || !state.historyStore) {
        var stores = resolveStores(baseId || 'global');
        state.baseStore = stores.baseStore;
        state.historyStore = stores.historyStore;
      }
      return {
        baseStore: state.baseStore,
        historyStore: state.historyStore,
      };
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

    function buildWishlistResupplyStepsHtml() {
      return [
        '<div data-wishlist-resupply-steps style="display:grid;grid-template-columns:1fr;gap:6px;">',
        '<div style="opacity:.78;line-height:1.45;">补货回运流程拆分测试。当前阶段只验证按钮入口，不执行真实购买、装船或发船。</div>',
        WISHLIST_RESUPPLY_ATOMIC_STEPS.map(function (step, index) {
          var status = step.status || 'pending';
          var statusText = status === 'done' ? '已验证' : (status === 'ready' ? '可测试' : '待接入');
          var stepNo = String(index + 1).padStart(2, '0');
          return [
            '<div data-wishlist-resupply-step="' + escapeHtml(step.action) + '" style="display:grid;grid-template-columns:34px 1fr 54px;gap:6px;align-items:center;">',
            '<span style="opacity:.62;font-variant-numeric:tabular-nums;">' + escapeHtml(stepNo) + '</span>',
            '<button data-atomic-action="' + escapeHtml(step.action) + '" data-atomic-status="' + escapeHtml(status) + '" title="' + escapeHtml(statusText) + '">' + escapeHtml(step.label) + '</button>',
            '<span style="font-size:11px;opacity:.68;text-align:right;">' + escapeHtml(statusText) + '</span>',
            '</div>'
          ].join('');
        }).join(''),
        '</div>'
      ].join('');
    }

    function buildAtomicConfigPanelHtml(entry) {
      if (entry.action === 'sell_exchange_inventory') {
        return '<div id="gtap-sell-config"></div>';
      }
      if (entry.action === 'buy_wishlist') {
        return buildWishlistResupplyStepsHtml();
      }
      return '<div style="opacity:.72;">该功能待接入，暂无配置。</div>';
    }

    function buildAtomicActionRowHtml(entry) {
      var done = entry.status === 'done';
      var style = done
        ? 'background:linear-gradient(135deg,#14b86f,#0d8f78);border-color:rgba(91,255,190,0.75);color:#ffffff;font-weight:700;box-shadow:0 0 0 1px rgba(91,255,190,0.18),0 8px 18px rgba(20,184,111,0.22);'
        : '';
      var title = done ? '已完成并可用' : '待接入/待验证';
      var expanded = entry.action === 'sell_exchange_inventory';
      return [
        '<div data-atomic-row="' + escapeHtml(entry.action) + '" style="display:grid;grid-template-columns:1fr 58px;gap:6px;align-items:center;">',
        '<button data-atomic-action="' + escapeHtml(entry.action) + '" data-atomic-status="' + escapeHtml(entry.status || 'pending') + '" title="' + escapeHtml(title) + '" style="' + style + '">' + escapeHtml(entry.label) + '</button>',
        '<button data-atomic-config-toggle="' + escapeHtml(entry.action) + '" style="padding:6px 8px;">' + (expanded ? '收起' : '展开') + '</button>',
        '<div data-atomic-config-panel="' + escapeHtml(entry.action) + '" style="grid-column:1/-1;display:' + (expanded ? 'block' : 'none') + ';margin:2px 0 4px 0;padding:8px;border-radius:9px;background:rgba(0,0,0,0.16);border:1px solid rgba(255,255,255,0.08);">',
        buildAtomicConfigPanelHtml(entry),
        '</div>',
        '</div>'
      ].join('');
    }

    function buildWorkflowActionRowsHtml() {
      return [
        '<div style="height:1px;background:rgba(255,255,255,0.10);margin:4px 0;"></div>',
        '<div data-workflow-actions style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;">',
        '<div style="display:grid;grid-template-columns:1fr 58px;gap:6px;">',
        '<button data-action="sell">卖货</button>',
        '<button data-main-config-toggle="sell" style="padding:6px 8px;">展开</button>',
        '<div data-main-config-panel="sell" style="grid-column:1/-1;display:none;margin:2px 0 4px 0;padding:8px;border-radius:9px;background:rgba(0,0,0,0.16);border:1px solid rgba(255,255,255,0.08);">',
        '<div id="gtap-old-sell-config"></div>',
        '</div>',
        '</div>',
        '<button data-action="resupply">补货</button>',
        '<button data-action="auto">自动</button>',
        '<button data-action="check">检查</button>',
        '<button data-action="wait">等待</button>',
        '<button data-action="stop" style="grid-column:1/-1;">停止</button>',
        '</div>'
      ].join('');
    }

    function buildAtomicActionsHtml() {
      return ATOMIC_ACTIONS.map(buildAtomicActionRowHtml).join('') + buildWorkflowActionRowsHtml();
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

      var atomicButtonsHtml = buildAtomicActionsHtml();

      panel.innerHTML = [
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">',
        '<div style="display:flex;align-items:baseline;gap:8px;">',
        '<strong>GT Autopilot</strong>',
        '<span style="opacity:.72;font-size:11px;">v' + escapeHtml(APP_VERSION) + '</span>',
        '</div>',
        '<span id="gtap-status">就绪</span>',
        '</div>',
        '<div id="gtap-panel-body">',
        '<div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end;margin-bottom:10px;">',
        '<label style="display:flex;flex-direction:column;gap:4px;min-width:0;">',
        '<span style="opacity:.8;">API Key</span>',
        '<input id="gtap-api-key" type="text" spellcheck="false" style="width:100%;box-sizing:border-box;border-radius:10px;border:1px solid rgba(255,255,255,0.14);background:rgba(255,255,255,0.06);color:#eef5ff;padding:8px 10px;">',
        '</label>',
        '<button data-action="save-config" style="height:38px;">保存</button>',
        '</div>',
        '<div id="gtap-atomic-actions" style="margin-bottom:8px;padding:8px;border-radius:10px;background:rgba(255,255,255,0.04);">',
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">',
        '<strong>原子功能测试</strong>',
        '<span style="opacity:.65;font-size:11px;">先验证入口</span>',
        '</div>',
        '<div style="display:grid;grid-template-columns:1fr;gap:6px;">',
        atomicButtonsHtml,
        '</div>',
        '</div>',
        '<div id="gtap-config" style="margin-bottom:10px;padding:10px;border-radius:10px;background:rgba(255,255,255,0.04);"></div>',
        '<div id="gtap-history" style="margin-bottom:10px;padding:10px;border-radius:10px;background:rgba(255,255,255,0.04);max-height:180px;overflow:auto;"></div>',
        '<div id="gtap-log" title="拖动右下角可调整日志高度" style="white-space:pre-wrap;height:220px;min-height:120px;max-height:520px;resize:vertical;overflow:auto;background:rgba(255,255,255,0.04);border-radius:10px;padding:10px;box-sizing:border-box;"></div>',
        '</div>',
      ].join('');

      panel.addEventListener('click', function (event) {
        var atomicConfigButton = event.target && event.target.closest ? event.target.closest('button[data-atomic-config-toggle]') : null;
        if (atomicConfigButton) {
          event.preventDefault();
          toggleAtomicConfig(atomicConfigButton.getAttribute('data-atomic-config-toggle'));
          return;
        }
        var mainConfigButton = event.target && event.target.closest ? event.target.closest('button[data-main-config-toggle]') : null;
        if (mainConfigButton) {
          event.preventDefault();
          toggleMainConfig(mainConfigButton.getAttribute('data-main-config-toggle'));
          return;
        }
        var atomicButton = event.target && event.target.closest ? event.target.closest('button[data-atomic-action]') : null;
        if (atomicButton) {
          event.preventDefault();
          handleAtomicAction(atomicButton.getAttribute('data-atomic-action'));
          return;
        }
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
        outboundWhitelist: DEFAULTS.outboundWhitelist,
        sellBlacklist: DEFAULTS.sellBlacklist
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

    function toggleAtomicConfig(action) {
      if (!doc || !action) {
        return;
      }
      var panel = doc.querySelector('[data-atomic-config-panel="' + action + '"]');
      var button = doc.querySelector('[data-atomic-config-toggle="' + action + '"]');
      if (!panel) {
        return;
      }
      var collapsed = panel.style.display === 'none';
      panel.style.display = collapsed ? 'block' : 'none';
      if (button) {
        button.textContent = collapsed ? '收起' : '展开';
      }
    }

    function toggleMainConfig(action) {
      if (!doc || !action) {
        return;
      }
      var panel = doc.querySelector('[data-main-config-panel="' + action + '"]');
      var button = doc.querySelector('[data-main-config-toggle="' + action + '"]');
      if (!panel) {
        return;
      }
      var collapsed = panel.style.display === 'none';
      panel.style.display = collapsed ? 'block' : 'none';
      if (button) {
        button.textContent = collapsed ? '收起' : '展开';
      }
    }

    function updateStatus(text) {
      var el = doc && doc.getElementById('gtap-status');
      if (el) {
        el.textContent = text;
      }
    }

    function resolveStatusText(runtimeState) {
      if (runtimeState && runtimeState.running) {
        return '运行中';
      }
      if (runtimeState && runtimeState.autoLoopEnabled) {
        return '自动中';
      }
      return '就绪';
    }

    function clearAutoLoopTimer() {
      if (state.autoLoopTimer) {
        win.clearTimeout(state.autoLoopTimer);
        state.autoLoopTimer = null;
      }
    }

    function setAutoLoopEnabled(enabled) {
      ensureCurrentStores();
      state.autoLoopEnabled = !!enabled;
      clearAutoLoopTimer();
      if (state.baseStore) {
        state.baseStore.patch(function (next) {
          next.workflow = next.workflow || {};
          next.workflow.autoMode = !!enabled;
          return next;
        });
      }
      updateStatus(resolveStatusText(state));
    }

    function resolveAutoWaitMs(snapshot) {
      var location = snapshot && snapshot.shipInfo && snapshot.shipInfo.location;
      return location === 'transit' ? DEFAULTS.transportWaitIntervalMs : DEFAULTS.pollIntervalMs;
    }

    function resolveLoopWaitMs(snapshot, result) {
      if (result && Number(result.waitMs) > 0) {
        return Number(result.waitMs);
      }
      return resolveAutoWaitMs(snapshot);
    }

    function scheduleAutoLoop(waitMs) {
      if (!state.autoLoopEnabled) {
        return;
      }
      clearAutoLoopTimer();
      state.autoLoopTimer = win.setTimeout(function () {
        state.autoLoopTimer = null;
        runAutoLoop().catch(function (error) {
          state.lastError = String(error && error.message ? error.message : error);
          log('自动模式失败：' + state.lastError);
          setAutoLoopEnabled(false);
        });
      }, Math.max(1000, Number(waitMs || DEFAULTS.pollIntervalMs)));
    }

    function readBaseContext() {
      var company;
      var baseSummary;
      var base;
      var exchangeWarehouse;
      var snapshot;
      var baseId;
      var baseConfig;

      return apiClient.request('getMyCompany').then(function (companyData) {
        company = companyData || {};
        baseId = getCurrentBaseId();
        baseSummary = (company.bases || []).find(function (item) {
          return Number(item.id) === Number(baseId);
        }) || (company.bases || [])[0] || null;
        state.currentBaseId = baseSummary && baseSummary.id != null ? Number(baseSummary.id) : null;
        var stores = resolveStores(state.currentBaseId);
        state.baseStore = stores.baseStore;
        state.historyStore = stores.historyStore;
        baseConfig = state.baseStore.read();
        var basePromise = state.currentBaseId ? apiClient.request('getBase', { baseId: state.currentBaseId }).catch(function () {
          return baseSummary;
        }) : Promise.resolve(baseSummary);
        return basePromise.then(function (baseData) {
          base = baseData || baseSummary;
          return apiClient.request('getPrices').then(function (prices) {
          var exchangePromise = company && company.exWhId ? apiClient.request('getWarehouse', { warehouseId: company.exWhId }).catch(function () {
            return null;
          }) : Promise.resolve(null);
          return exchangePromise.then(function (exchangeWarehouseData) {
            exchangeWarehouse = exchangeWarehouseData;
            snapshot = {
              capturedAt: new Date().toISOString(),
              location: win.location.href,
              company: company,
              base: base,
              prices: prices || [],
              exchangeWarehouse: exchangeWarehouse,
              config: baseConfig,
              shipInfo: inferShipLocation(company, base || {}, doc),
            };
            state.lastSnapshot = snapshot;
            return snapshot;
          });
        });
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
      updateStatus(resolveStatusText(state));
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
      setAutoLoopEnabled(false);
      pushStep('停止', '用户要求停止');
      finishRun('stopped', { reason: STOP_REASON });
    }

    function runRestockShipRepairMaterials(snapshot) {
      var exchangeWarehouse = snapshot && snapshot.exchangeWarehouse;
      var plan = planShipSupportMaterialRestock(exchangeWarehouse);
      pushStep('检查交易所库存', SHIP_SUPPORT_MATERIALS.map(function (material) {
        var current = 0;
        if (exchangeWarehouse && Array.isArray(exchangeWarehouse.mats)) {
          var match = mapById(exchangeWarehouse.mats).get(Number(material.id));
          current = amountOf(match);
        }
        return material.name + ' ' + current + '/' + material.targetAmount;
      }).join('，'));
      if (!plan.length) {
        pushStep('补修理材料', '库存已达到 2000，无需购买');
        return Promise.resolve({ bought: [], plan: [] });
      }
      pushStep('待购买', plan.map(function (item) { return item.name + ' x ' + item.amount; }).join('，'));
      return navigateToExchangePage().then(function () {
        return buyWishlistItemsFromUi(plan);
      }).then(function (buySummary) {
        pushStep('补修理材料完成', buySummary.length ? ('已购买 ' + buySummary.length + ' 种物资') : '未购买物资');
        return { bought: buySummary, plan: plan };
      });
    }

    function runSellExchangeInventory(snapshot) {
      var config = snapshot && snapshot.config || (state.baseStore ? state.baseStore.defaults : deepClone(DEFAULTS));
      var plan = planExchangeInventorySellBatch(snapshot && snapshot.exchangeWarehouse, config);
      pushStep('检查交易所库存', plan.length ? plan.map(function (item) {
        return item.name + ' x ' + item.current;
      }).join('，') : '黑名单过滤后无可卖库存');
      if (!plan.length) {
        return Promise.resolve({ sold: [], plan: [] });
      }
      return navigateToExchangePage().then(function () {
        return sellBatchOnExchange(plan);
      }).then(function (sellSummary) {
        pushStep('一键卖货完成', sellSummary.length ? ('已创建 ' + sellSummary.length + ' 个卖单') : '未创建卖单');
        return { sold: sellSummary, plan: plan };
      });
    }

    function handleAtomicAction(action) {
      var result = runAtomicAction(action);
      if (result.action === 'sell_exchange_inventory') {
        if (state.running) {
          pushStep('忙碌', '已有任务在运行');
          return;
        }
        readBaseContext().then(function (snapshot) {
          startRun('atomic_' + result.action);
          pushStep('原子功能', result.label);
          savePanelConfig(snapshot);
          snapshot.config = state.baseStore ? state.baseStore.read() : snapshot.config;
          return runSellExchangeInventory(snapshot).then(function (summary) {
            finishRun('success', {
              action: result.action,
              label: result.label,
              sold: summary.sold,
              plan: summary.plan,
            });
          });
        }).catch(function (error) {
          state.lastError = String(error && error.message ? error.message : error);
          pushStep('原子功能失败', state.lastError);
          finishRun('failed', { action: result.action, label: result.label, error: state.lastError });
        });
        return;
      }
      if (result.action === 'restock_ship_repair_materials') {
        if (state.running) {
          pushStep('忙碌', '已有任务在运行');
          return;
        }
        readBaseContext().then(function (snapshot) {
          startRun('atomic_' + result.action);
          pushStep('原子功能', result.label);
          return runRestockShipRepairMaterials(snapshot).then(function (summary) {
            finishRun('success', {
              action: result.action,
              label: result.label,
              bought: summary.bought,
              plan: summary.plan,
            });
          });
        }).catch(function (error) {
          state.lastError = String(error && error.message ? error.message : error);
          pushStep('原子功能失败', state.lastError);
          finishRun('failed', { action: result.action, label: result.label, error: state.lastError });
        });
        return;
      }
      startRun('atomic_' + normalizeText(result.action || action));
      pushStep('原子功能', result.message);
      finishRun(result.status === 'failed' ? 'failed' : 'pending', {
        action: result.action,
        label: result.label,
        status: result.status,
      });
    }

    function getShipSnapshot(snapshot) {
      return snapshot && snapshot.shipInfo ? snapshot.shipInfo : { location: 'unknown', ship: null };
    }

    function runSellChain(snapshot) {
      var shipInfo = getShipSnapshot(snapshot);
      var base = snapshot.base || {};
      var config = snapshot.config || (state.baseStore ? state.baseStore.defaults : deepClone(DEFAULTS));
      var batch = collectOutboundBatch(base, config);
      var exchangeBatch = collectBatchFromWarehouse(snapshot.exchangeWarehouse, config);

      pushStep('出货链', '位置=' + shipInfo.location);
      if (!shipInfo.ship) {
        throw new Error('未找到可用飞船');
      }

      if (shipInfo.location === 'transit') {
        pushStep('等待', '飞船运输中');
        return Promise.resolve({ next: 'wait', snapshot: snapshot });
      }

      if (shipInfo.location !== 'base') {
        if (shipInfo.location === 'exchange') {
          pushStep('交易所库存', exchangeBatch.length ? exchangeBatch.map(function (item) { return item.name + ' x ' + item.current; }).join('，') : '无');
          if (!exchangeBatch.length) {
            return Promise.resolve({ next: 'done', sold: [] });
          }
          return navigateToExchangePage().then(function () {
            return sellBatchOnExchange(exchangeBatch);
          }).then(function (sellSummary) {
            return {
              next: 'done',
              batch: exchangeBatch,
              sold: sellSummary,
              ship: shipInfo.ship,
            };
          });
        }
        pushStep('跳过出货', '飞船不在基地');
        return Promise.resolve({ next: 'wait', snapshot: snapshot });
      }

      pushStep('待出货物资', batch.length ? batch.map(function (item) { return item.name + ' x ' + item.current; }).join('，') : '无');
      if (!batch.length) {
        return Promise.resolve({ next: 'done', sold: [] });
      }
      return navigateToBaseAndOpenWarehouse(base).then(function () {
        pushStep('页面', '已切到基地仓库');
        return loadBatchOntoShip(batch, shipInfo.ship);
      }).then(function (loadSummary) {
        pushStep('装货', loadSummary.length ? loadSummary.map(function (item) { return item.name + ' x ' + item.amount; }).join('，') : '无');
        return moveShipToDestination(shipInfo.ship, 'Exchange Station').then(function () {
          pushStep('运输', '已尝试发船到交易所');
          return {
            next: 'wait',
            batch: batch,
            loaded: loadSummary,
            sold: [],
            ship: shipInfo.ship,
            waitMs: DEFAULTS.transportWaitIntervalMs,
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
              next: 'wait',
              wishlist: wishlistResult.wishlist,
              reduceResult: wishlistResult.reduceResult,
              buySummary: buySummary,
              ship: shipInfo.ship,
              waitMs: DEFAULTS.transportWaitIntervalMs,
            };
          });
        });
      });
    }

    function runSelectedChain(chain, snapshot) {
      if (chain === 'sell_chain') {
        startRun('sell_chain');
        syncPanelConfig(snapshot.config);
        renderConfig(snapshot.config);
        return runSellChain(snapshot).then(function (result) {
          if (result && result.next === 'wait') {
            finishRun('waiting', { chain: 'sell_chain' });
            return result;
          }
          pushStep('出货完成', (result.sold || []).length ? ('已卖出 ' + result.sold.length + ' 种物资') : '未卖出物资');
          finishRun('success', { chain: 'sell_chain', sold: result.sold || [] });
          return result;
        });
      }

      if (chain === 'resupply_chain') {
        startRun('resupply_chain');
        syncPanelConfig(snapshot.config);
        renderConfig(snapshot.config);
        return runResupplyChain(snapshot).then(function (result) {
          if (result && result.next === 'wait') {
            finishRun('waiting', { chain: 'resupply_chain' });
            return result;
          }
          pushStep('补货完成', (result.buySummary || []).length ? ('已购买 ' + result.buySummary.length + ' 种物资') : '未购买物资');
          finishRun('success', {
            chain: 'resupply_chain',
            days: result && result.reduceResult ? result.reduceResult.days : null,
            bought: result.buySummary || []
          });
          return result;
        });
      }

      return Promise.resolve({ next: 'wait', snapshot: snapshot });
    }

    function runAutoLoop() {
      if (state.running) {
        scheduleAutoLoop(DEFAULTS.pollIntervalMs);
        return Promise.resolve();
      }

      return readBaseContext().then(function (snapshot) {
        var config = snapshot.config || {};
        var workflow = config.workflow || {};
        var nextChain = pickInitialChain(snapshot);
        syncPanelConfig(snapshot.config);
        renderConfig(snapshot.config);

        if (!state.autoLoopEnabled && workflow.autoMode) {
          state.autoLoopEnabled = true;
        }
        if (!state.autoLoopEnabled) {
          return;
        }

        if (nextChain === 'wait') {
          startRun('auto_wait');
          pushStep('自动模式', '飞船位置=' + snapshot.shipInfo.location + '，继续等待');
          finishRun('waiting', { chain: 'auto_wait', location: snapshot.shipInfo.location });
          scheduleAutoLoop(resolveAutoWaitMs(snapshot));
          return;
        }

        return runSelectedChain(nextChain, snapshot).then(function (result) {
          if (!state.autoLoopEnabled) {
            return;
          }
          if (result && result.next === 'wait') {
            scheduleAutoLoop(resolveLoopWaitMs(snapshot, result));
            return;
          }
          scheduleAutoLoop(DEFAULTS.pollIntervalMs);
        });
      }).catch(function (error) {
        state.lastError = String(error && error.message ? error.message : error);
        if (state.currentRun) {
          pushStep('自动模式失败', state.lastError);
          finishRun('failed', { error: state.lastError });
        } else {
          log('自动模式失败：' + state.lastError);
        }
        scheduleAutoLoop(DEFAULTS.pollIntervalMs);
      });
    }

    function buildResupplyWishlist(base, config) {
      if (doc) {
        return buildResupplyWishlistFromUi(base, config).catch(function () {
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

    function buildResupplyWishlistFromUi(base, config) {
      var targetDays = Number(config.resupplyDays || DEFAULTS.resupplyDays);
      return rebuildWishlistAtDays(base, targetDays).then(function (firstPass) {
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

        return rebuildWishlistAtDays(base, reduceResult.days).then(function (nextPass) {
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

    function rebuildWishlistAtDays(base, days) {
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
        .then(function () {
          return readResupplyRows(base);
        });
    }

    function readResupplyRows(base) {
      var totals = readResupplyTotalsFromPage();
      return readWishlistRowsFromApi(base).then(function (rows) {
        return {
          weight: totals.weight,
          price: totals.price,
          rows: rows,
        };
      });
    }

    function resolveWishlistIdForBase(base) {
      var directPlanetId = Number((base && (base.planetId || base.pId || (base.planet && base.planet.id))) || 0);
      if (directPlanetId > 0) {
        return Promise.resolve(directPlanetId);
      }
      return apiClient.request('getWishlists').then(function (wishlists) {
        var list = Array.isArray(wishlists) ? wishlists : [];
        var baseName = normalizeText(base && base.name);
        var match = list.find(function (item) {
          return normalizeText(item && item.title).indexOf(baseName) >= 0;
        });
        return match ? Number(match.id) : 0;
      }).catch(function () {
        return 0;
      });
    }

    function readWishlistRowsFromApi(base) {
      return resolveWishlistIdForBase(base).then(function (wishlistId) {
        if (!wishlistId) {
          return [];
        }
        return apiClient.request('getWishlist', { wishlistId: wishlistId }).then(function (wishlist) {
          var mats = Array.isArray(wishlist && wishlist.mats) ? wishlist.mats : [];
          return mats.map(function (item) {
            var id = Number(item.matId || item.id || item.i || 0);
            var amount = Number(item.amount || item.am || item.a || 0);
            var price = findPriceForMaterial((state.lastSnapshot && state.lastSnapshot.prices) || [], id) || {};
            var unitPrice = Number(price.price || price.sellPrice || price.buyPrice || price.avgPrice || 0);
            if (!id || !amount) {
              return null;
            }
            return {
              id: id,
              name: materialNames[id] || ('Material ' + id),
              amount: amount,
              weight: 0,
              cost: amount * unitPrice,
            };
          }).filter(Boolean);
        });
      }).catch(function () {
        return [];
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

    function findBaseListButtonByName(baseName) {
      if (!doc || !baseName) {
        return null;
      }
      var nodes = Array.prototype.slice.call(doc.querySelectorAll('button.list-group-item, a.list-group-item, [role="button"].list-group-item'));
      for (var i = 0; i < nodes.length; i += 1) {
        if (textIncludesAny(nodes[i].textContent || '', [baseName])) {
          return nodes[i];
        }
      }
      return null;
    }

    function findShipTabLabel(shipName, prefixes) {
      if (!doc || !shipName || !prefixes || !prefixes.length) {
        return null;
      }
      var selector = prefixes.map(function (prefix) {
        return 'label[for^="' + prefix + '"]';
      }).join(', ');
      var labels = Array.prototype.slice.call(doc.querySelectorAll(selector));
      for (var i = 0; i < labels.length; i += 1) {
        if (normalizeText(labels[i].textContent || '') === normalizeText(shipName)) {
          return labels[i];
        }
      }
      return null;
    }

    function selectShipWarehouseTab(ship) {
      var label = findShipTabLabel(ship && ship.name, ['btnradio-whwt']);
      if (!label) {
        return false;
      }
      clickElement(label);
      return true;
    }

    function selectShipInfoTab(ship) {
      var label = findShipTabLabel(ship && ship.name, ['btnradioinfo']);
      if (!label) {
        return false;
      }
      clickElement(label);
      return true;
    }

    function findDestinationInput() {
      var direct = doc && doc.getElementById ? doc.getElementById('daInputField') : null;
      if (direct && direct.getClientRects && direct.getClientRects().length) {
        return direct;
      }
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

    function findDestinationSuggestionByText(docRef, text) {
      if (!docRef || !text) {
        return null;
      }
      var dropdownNodes = Array.prototype.slice.call(docRef.querySelectorAll('#daInputField + ul.dropdown-menu.show li.dropdown-item, #daInputField + ul.dropdown-menu.show li[role="button"]'));
      for (var i = 0; i < dropdownNodes.length; i += 1) {
        if (textIncludesAny(dropdownNodes[i].textContent || '', [text])) {
          return dropdownNodes[i];
        }
      }
      return findSuggestionByText(text);
    }

    function findUnloadOnArrivalCheckbox(docRef) {
      if (!docRef) {
        return null;
      }
      if (typeof docRef.getElementById === 'function') {
        var direct = docRef.getElementById('showUOA');
        if (direct) {
          return direct;
        }
      }
      var checkboxes = typeof docRef.querySelectorAll === 'function'
        ? Array.prototype.slice.call(docRef.querySelectorAll('input[type="checkbox"]'))
        : [];
      for (var i = 0; i < checkboxes.length; i += 1) {
        var checkbox = checkboxes[i];
        var row = checkbox.closest ? checkbox.closest('.row') : null;
        if (row && textIncludesAny(row.textContent || '', ['Unload On Arrival'])) {
          return checkbox;
        }
      }
      return null;
    }

    function openShipFlightPanel(ship) {
      if (!doc || !ship || !ship.name) {
        return false;
      }
      var links = Array.prototype.slice.call(doc.querySelectorAll('span.link-primary.fw-bold.me-2, span.link-primary.cursor-pointer.text-truncate'));
      for (var i = 0; i < links.length; i += 1) {
        if (normalizeText(links[i].textContent || '') === normalizeText(ship.name)) {
          clickElement(links[i]);
          return true;
        }
      }
      return false;
    }

    function findStartFlightButton() {
      if (!doc) {
        return null;
      }
      return doc.querySelector('button[data-btn-start-flight]') || findUniqueButtonByTexts(doc, START_FLIGHT_BUTTON_TEXTS);
    }

    function moveShipToDestination(ship, destinationName) {
      if (!doc || !ship || !destinationName) {
        return Promise.resolve(false);
      }
      selectShipWarehouseTab(ship);
      return wait(300).then(function () {
        if (!openShipFlightPanel(ship)) {
          throw new Error('未找到飞船出发面板');
        }
        return wait(500);
      }).then(function () {
        selectShipInfoTab(ship);
        return wait(200);
      }).then(function () {
        var input = findDestinationInput();
        if (!input) {
          throw new Error('未找到目的地输入框');
        }
        setInputValue(input, destinationName);
        return wait(300);
      }).then(function () {
        var suggestion = findDestinationSuggestionByText(doc, destinationName);
        if (!suggestion) {
          throw new Error('未找到目的地候选：' + destinationName);
        }
        clickElement(suggestion);
        return wait(400);
      }).then(function () {
        var unloadCheckbox = findUnloadOnArrivalCheckbox(doc);
        if (!unloadCheckbox) {
          throw new Error('未找到自动卸货开关');
        }
        if (!setCheckboxValue(unloadCheckbox, true) && !unloadCheckbox.checked) {
          throw new Error('自动卸货开关未能开启');
        }
        return wait(200);
      }).then(function () {
        var startButton = findStartFlightButton();
        if (!startButton) {
          throw new Error('未找到 Start flight 按钮');
        }
        clickElement(startButton);
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

    function matchesWarehouseRowMaterial(rowText, materialName) {
      var name = normalizeText(materialName);
      var text = normalizeText(rowText);
      if (!name || !text) {
        return false;
      }
      var escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var pattern = new RegExp('^' + escaped + '(?:\\s*[✓✗]|\\s+\\d|$)', 'i');
      return pattern.test(text);
    }

    function findWarehouseTransferButton(materialName) {
      if (!doc || !materialName) {
        return null;
      }
      var rows = Array.prototype.slice.call(doc.querySelectorAll('tr, [role="row"]'));
      for (var i = 0; i < rows.length; i += 1) {
        var rowText = normalizeText(rows[i].textContent || '');
        if (!matchesWarehouseRowMaterial(rowText, materialName)) {
          continue;
        }
        var buttons = Array.prototype.slice.call(rows[i].querySelectorAll('button'));
        for (var j = 0; j < buttons.length; j += 1) {
          if (String(buttons[j].innerHTML || '').indexOf('#arrow-right') >= 0) {
            return buttons[j];
          }
        }
      }
      return null;
    }

    function loadBatchOntoShip(batch, ship) {
      if (!doc || !ship) {
        return Promise.resolve([]);
      }
      if (!selectShipWarehouseTab(ship)) {
        throw new Error('未找到货舱飞船标签：' + normalizeText(ship.name || ''));
      }
      return wait(300).then(function () {
        var summary = [];
        return (batch || []).reduce(function (promise, item) {
          return promise.then(function () {
            if (!item || !item.name || !item.current) {
              return;
            }
            var button = findWarehouseTransferButton(item.name);
            if (!button) {
              throw new Error('未找到装货按钮：' + item.name);
            }
            clickElement(button);
            summary.push({ name: item.name, amount: item.current });
            return wait(350);
          });
        }, Promise.resolve()).then(function () {
          if (!summary.length) {
            return summary;
          }
          var confirmButton = findButtonByIconHref(doc, '#check');
          if (!confirmButton) {
            throw new Error('未找到装货确认按钮');
          }
          clickElement(confirmButton);
          return wait(500).then(function () {
            return summary;
          });
        }).then(function () {
          return summary;
        });
      });
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

    function exchangeRowMatchesMaterial(rowText, materialName) {
      var name = normalizeText(materialName);
      var text = normalizeText(rowText);
      if (!name || !text) {
        return false;
      }
      if (text === name) {
        return true;
      }
      if (text.indexOf(name) !== 0) {
        return false;
      }
      var rest = text.slice(name.length).replace(/^\s+/, '');
      var nextChar = rest.charAt(0);
      return !nextChar || !/[A-Za-z]/.test(nextChar);
    }

    function clickExchangeMaterialRowInDocument(docRef, materialName) {
      if (!docRef) {
        return false;
      }
      var rows = Array.prototype.slice.call(docRef.querySelectorAll('tr, [role="row"], .mat-row, .mat-item'));
      for (var i = 0; i < rows.length; i += 1) {
        var text = normalizeText(rows[i].textContent || '');
        if (exchangeRowMatchesMaterial(text, materialName)) {
          clickElement(rows[i]);
          return true;
        }
      }
      return false;
    }

    function clickExchangeMaterialRow(materialName) {
      return clickExchangeMaterialRowInDocument(doc, materialName);
    }

    function buttonLooksLikeSellWarehouseAction(button) {
      var html = String(button && button.innerHTML || '').toLowerCase();
      var text = normalizeText(button && (button.textContent || button.innerText || ''));
      if (!button) {
        return false;
      }
      if (
        html.indexOf('sack-dollar') >= 0 ||
        html.indexOf('arrow-up-from-line') >= 0 ||
        html.indexOf('arrow-up-to-line') >= 0 ||
        html.indexOf('#upload') >= 0 ||
        html.indexOf('upload') >= 0
      ) {
        return true;
      }
      if (
        html.indexOf('arrow-down-to-line') >= 0 ||
        html.indexOf('download') >= 0
      ) {
        return false;
      }
      return textIncludesAny(text, SELL_FORM_BUTTON_TEXTS);
    }

    function clickExchangeWarehouseSellButtonInDocument(docRef, materialName) {
      if (!docRef || !materialName) {
        return false;
      }
      var rows = Array.prototype.slice.call(docRef.querySelectorAll('tr, [role="row"], .mat-row, .mat-item'));
      for (var i = 0; i < rows.length; i += 1) {
        var rowText = normalizeText(rows[i].textContent || '');
        if (!matchesWarehouseRowMaterial(rowText, materialName) && !exchangeRowMatchesMaterial(rowText, materialName)) {
          continue;
        }
        var buttons = Array.prototype.slice.call(rows[i].querySelectorAll ? rows[i].querySelectorAll('button') : []);
        for (var j = 0; j < buttons.length; j += 1) {
          if (buttonLooksLikeSellWarehouseAction(buttons[j])) {
            return clickElement(buttons[j]);
          }
        }
      }
      return false;
    }

    function clickExchangeWarehouseSellButton(materialName) {
      return clickExchangeWarehouseSellButtonInDocument(doc, materialName);
    }

    function setTradeAmountInDocument(docRef, amount) {
      var inputs = Array.prototype.slice.call(docRef.querySelectorAll('input[type="number"], input'));
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

    function setTradeAmount(amount) {
      return setTradeAmountInDocument(doc, amount);
    }

    function inputTextHints(input) {
      if (!input) {
        return '';
      }
      return [
        input.getAttribute && input.getAttribute('placeholder'),
        input.getAttribute && input.getAttribute('aria-label'),
        input.name,
        input.id,
      ].map(normalizeText).join(' ');
    }

    function visibleFormInputs(docRef) {
      return Array.prototype.slice.call(docRef.querySelectorAll('input[type="number"], input')).filter(function (input) {
        return input && (!input.getClientRects || input.getClientRects().length);
      });
    }

    function setSellOfferAmountInDocument(docRef, amount) {
      if (!docRef) {
        return false;
      }
      var inputs = visibleFormInputs(docRef);
      for (var i = 0; i < inputs.length; i += 1) {
        if (textIncludesAny(inputTextHints(inputs[i]), ['amount', 'quantity', '数量'])) {
          return setInputValue(inputs[i], String(amount));
        }
      }
      return inputs.length ? setInputValue(inputs[0], String(amount)) : false;
    }

    function findSellOfferAmountInputInDocument(docRef) {
      if (!docRef) {
        return null;
      }
      var inputs = visibleFormInputs(docRef);
      for (var i = 0; i < inputs.length; i += 1) {
        if (textIncludesAny(inputTextHints(inputs[i]), ['amount', 'quantity', '数量'])) {
          return inputs[i];
        }
      }
      return inputs.length ? inputs[0] : null;
    }

    function readSellOfferAmountInDocument(docRef) {
      var input = findSellOfferAmountInputInDocument(docRef);
      return parseNumber(input && input.value, 0);
    }

    function setSellOfferPriceInDocument(docRef, price) {
      if (!docRef) {
        return false;
      }
      var inputs = visibleFormInputs(docRef);
      for (var i = 0; i < inputs.length; i += 1) {
        if (textIncludesAny(inputTextHints(inputs[i]), ['price', 'unit', '价格', '单价'])) {
          return setInputValue(inputs[i], String(price));
        }
      }
      return inputs.length > 1 ? setInputValue(inputs[inputs.length - 1], String(price)) : false;
    }

    function findSellOfferPriceInputInDocument(docRef) {
      if (!docRef) {
        return null;
      }
      var inputs = visibleFormInputs(docRef);
      for (var i = 0; i < inputs.length; i += 1) {
        if (textIncludesAny(inputTextHints(inputs[i]), ['price', 'unit', '价格', '单价'])) {
          return inputs[i];
        }
      }
      return inputs.length > 1 ? inputs[inputs.length - 1] : null;
    }

    function readSellOfferPriceInDocument(docRef) {
      var input = findSellOfferPriceInputInDocument(docRef);
      return parseNumber(input && input.value, 0);
    }

    function readInputMinValue(input) {
      if (!input) {
        return 0;
      }
      return parseNumber(
        input.getAttribute && input.getAttribute('min') != null ? input.getAttribute('min') : input.min,
        0
      );
    }

    function findPriceStepDownButton(input) {
      var scope = input && input.parentElement;
      if (!scope || typeof scope.querySelectorAll !== 'function') {
        return null;
      }
      var buttons = Array.prototype.slice.call(scope.querySelectorAll('button'));
      for (var i = 0; i < buttons.length; i += 1) {
        var html = String(buttons[i].innerHTML || '').toLowerCase();
        if (html.indexOf('sort-down') >= 0) {
          return buttons[i];
        }
      }
      return null;
    }

    function stepDownSellOfferPriceInDocument(docRef) {
      var input = findSellOfferPriceInputInDocument(docRef);
      if (!input) {
        return false;
      }
      var before = parseNumber(input.value, 0);
      var min = readInputMinValue(input);
      var stepButton = findPriceStepDownButton(input);
      if (stepButton) {
        clickElement(stepButton);
      } else if (typeof input.stepDown === 'function') {
        input.stepDown();
      } else {
        setInputValue(input, String(before > 100 ? before - 100 : Math.max(1, before - 1)));
      }
      var after = parseNumber(input.value, 0);
      if (min > 0 && (!after || after < min)) {
        setInputValue(input, String(min));
      } else if (!after && before) {
        setInputValue(input, String(before));
      } else if (typeof input.dispatchEvent === 'function' && root.Event) {
        input.dispatchEvent(new root.Event('input', { bubbles: true }));
        input.dispatchEvent(new root.Event('change', { bubbles: true }));
        input.dispatchEvent(new root.Event('blur', { bubbles: true }));
      }
      return true;
    }

    function clickSellTabInDocument(docRef) {
      var button = findUniqueButtonByTexts(docRef, SELL_FORM_BUTTON_TEXTS);
      if (!button) {
        return false;
      }
      return clickElement(button);
    }

    function readLowestOfferPriceInDocument(docRef) {
      if (!docRef) {
        return 0;
      }
      var nodes = Array.prototype.slice.call(docRef.querySelectorAll('tr, [role="row"], .list-group-item, .card, .d-flex'));
      var prices = [];
      nodes.forEach(function (node) {
        if (!rowLooksLikeExternalOffer(node)) {
          return;
        }
        var text = normalizeText(node && (node.textContent || node.innerText || ''));
        var matches = text.match(/(?:[$]\s*[0-9][0-9,]*(?:\.\d+)?)|(?:[0-9][0-9,]*(?:\.\d+)?\s*[$])/g) || [];
        matches.forEach(function (match) {
          var price = parseNumber(match, 0);
          if (price > 0) {
            prices.push(price);
          }
        });
      });
      if (!prices.length) {
        return 0;
      }
      return Math.min.apply(Math, prices);
    }

    function rowLooksLikeExternalOffer(row) {
      var text = normalizeText(row && (row.textContent || row.innerText || ''));
      var className = String(row && row.className || '');
      if (!text || /new offer/i.test(text) || /^offers/i.test(text)) {
        return false;
      }
      return /cursor-pointer/.test(className) && /\d[\d,]*(?:\.\d+)?\s*[$]/.test(text);
    }

    function clickLowestSellOfferRowInDocument(docRef) {
      if (!docRef) {
        return false;
      }
      var rows = Array.prototype.slice.call(docRef.querySelectorAll('tr, [role="row"], .list-group-item, .card, .d-flex'));
      var seenNewOffer = false;
      for (var i = 0; i < rows.length; i += 1) {
        var row = rows[i];
        var text = normalizeText(row && (row.textContent || row.innerText || ''));
        if (/new offer/i.test(text)) {
          seenNewOffer = true;
          continue;
        }
        if (!seenNewOffer) {
          continue;
        }
        if (!rowLooksLikeExternalOffer(row)) {
          continue;
        }
        return clickElement(row);
      }
      return false;
    }

    function clickCreateOfferButtonInDocument(docRef) {
      var button = findUniqueButtonByTexts(docRef, ['Create offer', 'Create Offer', '创建订单', '创建报价', '发布']);
      if (!button) {
        return false;
      }
      return clickElement(button);
    }

    function clickFinalBuyButtonInDocument(docRef) {
      if (!docRef) {
        return false;
      }
      var buttons = Array.prototype.slice.call(docRef.querySelectorAll('button')).filter(function (node) {
        return node && node.getClientRects && node.getClientRects().length && textIncludesAny(node.textContent || node.innerText || '', BUY_BUTTON_TEXTS);
      });
      for (var i = buttons.length - 1; i >= 0; i -= 1) {
        var html = String(buttons[i].innerHTML || '');
        if (
          html.indexOf('#arrow-down-to-line') >= 0 ||
          html.indexOf('arrow-down-to-line') >= 0 ||
          html.indexOf('#download') >= 0 ||
          html.indexOf('download') >= 0 ||
          i === buttons.length - 1
        ) {
          return clickElement(buttons[i]);
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
            if (!setTradeAmount(item.amount)) {
              throw new Error('未找到购买数量输入框：' + item.name);
            }
            return wait(200);
          }).then(function () {
            if (!clickFinalBuyButtonInDocument(doc)) {
              throw new Error('未找到最终购买按钮：' + item.name);
            }
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
          if (!clickExchangeWarehouseSellButton(item.name)) {
            throw new Error('未找到交易所仓库卖货按钮：' + item.name);
          }
          return wait(500).then(function () {
            clickSellTabInDocument(doc);
            return wait(200);
          }).then(function () {
            if (!setSellOfferAmountInDocument(doc, item.current)) {
              throw new Error('未找到卖货数量输入框：' + item.name);
            }
            if (!clickLowestSellOfferRowInDocument(doc)) {
              throw new Error('未找到可点击的最低报价行：' + item.name);
            }
            return wait(200);
          }).then(function () {
            var validation = validateSellOfferBeforeSubmit({
              expectedAmount: item.current,
              actualAmount: readSellOfferAmountInDocument(doc),
              actualPrice: readSellOfferPriceInDocument(doc),
            });
            if (!validation.ok) {
              throw new Error(validation.reason + '：' + item.name);
            }
            if (!clickCreateOfferButtonInDocument(doc)) {
              throw new Error('未找到 Create offer 按钮：' + item.name);
            }
            summary.push({ name: item.name, amount: item.current });
          });
        });
      }, Promise.resolve()).then(function () {
        return summary;
      });
    }

    function navigateToBaseAndOpenWarehouse(base) {
      if (!doc) {
        return Promise.resolve(false);
      }
      var currentBaseId = getCurrentBaseId();
      if (base && base.id != null && Number(currentBaseId) !== Number(base.id)) {
        var baseItem = findBaseListButtonByName(base.name || ('Base ' + base.id));
        if (baseItem) {
          clickElement(baseItem);
        }
      }
      var baseButton = findUniqueButtonByTexts(doc, BASE_BUTTON_TEXTS);
      if (baseButton) {
        clickElement(baseButton);
      }
      return wait(base && base.id != null && Number(currentBaseId) !== Number(base.id) ? 1200 : 700).then(function () {
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
      var oldSellContainer = doc && doc.getElementById('gtap-old-sell-config');
      var sellContainer = doc && doc.getElementById('gtap-sell-config');
      if (!container && !oldSellContainer && !sellContainer) {
        return;
      }
      if (!config) {
        if (container) {
          container.innerHTML = [
            '<div style="display:flex;justify-content:space-between;align-items:center;">',
            '<strong>基地配置</strong>',
            '<span style="opacity:.7;">等待加载</span>',
            '</div>',
            '<div style="margin-top:6px;opacity:.7;">点击“检查”后加载当前基地配置。</div>'
          ].join('');
        }
        if (sellContainer) {
          sellContainer.innerHTML = '<div style="opacity:.7;">点击“检查”后加载一键卖货配置。</div>';
        }
        if (oldSellContainer) {
          oldSellContainer.innerHTML = '<div style="opacity:.7;">点击“检查”后加载卖货配置。</div>';
        }
        return;
      }
      var effectiveConfig = Object.assign({}, config);
      if (!Array.isArray(effectiveConfig.sellBlacklist) || !effectiveConfig.sellBlacklist.length) {
        effectiveConfig.sellBlacklist = deepClone(DEFAULTS.sellBlacklist);
      }
      var whitelist = normalizeOutboundWhitelist((effectiveConfig && effectiveConfig.outboundWhitelist) || [], materialNames);
      var blacklist = normalizeMaterialBlocklist((effectiveConfig && effectiveConfig.sellBlacklist) || DEFAULTS.sellBlacklist, materialNames);
      var materialOptions = Object.keys(materialNames).map(function (id) {
        return { id: Number(id), name: materialNames[id] };
      }).sort(function (a, b) {
        return a.id - b.id;
      }).map(function (item) {
        return '<option value="' + item.id + '">' + escapeHtml(item.name) + ' (#' + item.id + ')</option>';
      }).join('');
      var rows = whitelist.map(function (entry) {
        return [
          '<div data-whitelist-row="' + entry.id + '" data-icon-id="' + escapeHtml(entry.iconId || '') + '" data-icon-href="' + escapeHtml(entry.iconHref || '') + '" style="display:grid;grid-template-columns:auto 24px minmax(0,1fr) 64px auto;gap:6px;align-items:center;margin-top:6px;">',
          '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;">',
          '<input class="gtap-whitelist-enabled" data-entry-id="' + entry.id + '" type="checkbox"' + (entry.enabled ? ' checked' : '') + '>',
          '<span style="opacity:.85;">启用</span>',
          '</label>',
          materialIconHtml(entry, materialNames),
          '<select class="gtap-whitelist-material" data-entry-id="' + entry.id + '" style="min-width:0;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#eef5ff;padding:5px 6px;">',
          materialOptions.replace('value="' + entry.id + '"', 'value="' + entry.id + '" selected'),
          '</select>',
          '<input class="gtap-whitelist-min" data-entry-id="' + entry.id + '" type="number" min="1" step="1" value="' + Number(entry.minAmount || 1) + '" style="width:100%;box-sizing:border-box;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#eef5ff;padding:5px 6px;">',
          '<button data-config-action="remove-whitelist-row" data-entry-id="' + entry.id + '" style="padding:5px 7px;">删除</button>',
          '</div>'
        ].join('');
      }).join('');
      var blacklistRows = blacklist.map(function (entry) {
        return [
          '<div data-sell-blacklist-row="' + entry.id + '" data-icon-id="' + escapeHtml(entry.iconId || '') + '" data-icon-href="' + escapeHtml(entry.iconHref || '') + '" style="display:grid;grid-template-columns:auto 24px minmax(0,1fr) auto;gap:6px;align-items:center;margin-top:6px;">',
          '<label style="display:flex;align-items:center;gap:4px;cursor:pointer;">',
          '<input class="gtap-sell-blacklist-enabled" data-entry-id="' + entry.id + '" type="checkbox"' + (entry.enabled ? ' checked' : '') + '>',
          '<span style="opacity:.85;">启用</span>',
          '</label>',
          materialIconHtml(entry, materialNames),
          '<select class="gtap-sell-blacklist-material" data-entry-id="' + entry.id + '" style="min-width:0;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#eef5ff;padding:5px 6px;">',
          materialOptions.replace('value="' + entry.id + '"', 'value="' + entry.id + '" selected'),
          '</select>',
          '<button data-config-action="remove-sell-blacklist-row" data-entry-id="' + entry.id + '" style="padding:5px 7px;">删除</button>',
          '</div>'
        ].join('');
      }).join('');
      if (container) {
        container.innerHTML = [
          '<div style="display:flex;justify-content:space-between;align-items:center;">',
          '<strong>基地配置</strong>',
          '<span>' + escapeHtml(normalizeText((state.lastSnapshot && state.lastSnapshot.base && state.lastSnapshot.base.name) || '当前基地')) + '</span>',
          '</div>',
          '<div style="display:grid;grid-template-columns:1fr 96px;gap:8px;align-items:end;margin-top:8px;">',
          '<label style="display:flex;flex-direction:column;gap:4px;">',
          '<span style="opacity:.8;">补齐天数</span>',
          '<input id="gtap-resupply-days" type="number" min="1" step="1" value="' + Number((effectiveConfig && effectiveConfig.resupplyDays) || DEFAULTS.resupplyDays) + '" style="width:100%;box-sizing:border-box;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#eef5ff;padding:8px 10px;">',
          '</label>',
          '<div style="opacity:.7;font-size:11px;align-self:center;">超重或超预算时自动缩减</div>',
          '</div>',
          '<label style="display:flex;align-items:center;gap:8px;margin-top:8px;cursor:pointer;">',
          '<input id="gtap-auto-mode" type="checkbox"' + (((effectiveConfig && effectiveConfig.workflow && effectiveConfig.workflow.autoMode) || false) ? ' checked' : '') + '>',
          '<span>启用自动模式</span>',
          '</label>'
        ].join('');
      }
      if (oldSellContainer) {
        oldSellContainer.innerHTML = [
          '<div style="display:flex;justify-content:space-between;align-items:center;">',
          '<strong style="font-size:12px;">卖货白名单</strong>',
          '<button data-config-action="add-whitelist-row" style="padding:5px 7px;">新增</button>',
          '</div>',
          rows || '<div style="margin-top:6px;opacity:.7;">暂无白名单，点击“新增”添加。</div>',
          '<div style="display:grid;grid-template-columns:24px 1fr 64px auto;gap:6px;margin-top:6px;opacity:.7;font-size:11px;">',
          '<span>图标</span>',
          '<span>物资</span>',
          '<span>最小量</span>',
          '<span>操作</span>',
          '</div>'
        ].join('');
      }
      if (sellContainer) {
        sellContainer.innerHTML = [
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">',
          '<strong style="font-size:12px;">卖货黑名单</strong>',
          '<button data-config-action="add-sell-blacklist-row" style="padding:5px 7px;">新增</button>',
          '</div>',
          '<div data-sell-blacklist-list>',
          blacklistRows || '<div style="margin-top:6px;opacity:.7;">暂无黑名单，一键卖货会尝试卖出全部交易所库存。</div>',
          '</div>',
          '<div style="display:grid;grid-template-columns:24px 1fr auto;gap:6px;margin-top:6px;opacity:.7;font-size:11px;">',
          '<span>图标</span>',
          '<span>启用后该物资不会被“一键卖货”卖出。</span>',
          '<span>操作</span>',
          '</div>'
        ].join('');
      }
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
        var selectedId = Number(materialSelect && materialSelect.value || id);
        var icon = Number(id) === Number(selectedId)
          ? {
            iconId: normalizeText(row.getAttribute('data-icon-id') || ''),
            iconHref: normalizeText(row.getAttribute('data-icon-href') || ''),
          }
          : getMaterialIconMeta(selectedId, materialNames);
        return {
          id: selectedId,
          enabled: !!(enabledInput && enabledInput.checked),
          minAmount: Math.max(1, parseInt(minInput && minInput.value, 10) || 1),
          name: materialNames[selectedId] || ('物资 ' + selectedId),
          iconId: icon.iconId,
          iconHref: icon.iconHref,
        };
      });
    }

    function readPanelSellBlacklistEntries() {
      if (!doc) {
        return [];
      }
      var rows = Array.prototype.slice.call(doc.querySelectorAll('[data-sell-blacklist-row]'));
      return rows.map(function (row) {
        var id = Number(row.getAttribute('data-sell-blacklist-row'));
        var enabledInput = row.querySelector('.gtap-sell-blacklist-enabled');
        var materialSelect = row.querySelector('.gtap-sell-blacklist-material');
        var selectedId = Number(materialSelect && materialSelect.value || id);
        var icon = Number(id) === Number(selectedId)
          ? {
            iconId: normalizeText(row.getAttribute('data-icon-id') || ''),
            iconHref: normalizeText(row.getAttribute('data-icon-href') || ''),
          }
          : getMaterialIconMeta(selectedId, materialNames);
        return {
          id: selectedId,
          enabled: !!(enabledInput && enabledInput.checked),
          name: materialNames[selectedId] || ('物资 ' + selectedId),
          iconId: icon.iconId,
          iconHref: icon.iconHref,
        };
      });
    }

    function readPanelDraftConfig(fallbackConfig) {
      var baseConfig = deepClone(fallbackConfig || (state.baseStore ? state.baseStore.read() : createBaseStore(storage, 'global').defaults));
      var resupplyDaysInput = doc && doc.getElementById('gtap-resupply-days');
      var whitelistRows = readPanelWhitelistEntries();
      var blacklistList = doc && doc.querySelector('[data-sell-blacklist-list]');
      var blacklistRows = readPanelSellBlacklistEntries();
      if (resupplyDaysInput) {
        baseConfig.resupplyDays = Math.max(1, parseInt(resupplyDaysInput.value, 10) || DEFAULTS.resupplyDays);
      }
      var autoModeInput = doc && doc.getElementById('gtap-auto-mode');
      baseConfig.workflow = baseConfig.workflow || {};
      baseConfig.workflow.autoMode = !!(autoModeInput && autoModeInput.checked);
      if (whitelistRows.length) {
        baseConfig.outboundWhitelist = normalizeOutboundWhitelist(whitelistRows, materialNames);
      }
      if (blacklistList) {
        baseConfig.sellBlacklist = normalizeMaterialBlocklist(blacklistRows, materialNames);
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
        iconId: getMaterialIconMeta(nextId, materialNames).iconId,
        iconHref: getMaterialIconMeta(nextId, materialNames).iconHref,
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

    function addSellBlacklistRow() {
      var next = readPanelDraftConfig();
      var blacklist = normalizeMaterialBlocklist(next.sellBlacklist || [], materialNames);
      var used = new Set(blacklist.map(function (entry) { return Number(entry.id); }));
      var candidateIds = Object.keys(materialNames).map(function (id) { return Number(id); }).sort(function (a, b) { return a - b; });
      var nextId = candidateIds.find(function (id) {
        return !used.has(id);
      }) || candidateIds[0] || 1;
      blacklist.push({
        id: nextId,
        enabled: true,
        name: materialNames[nextId] || ('物资 ' + nextId),
        iconId: getMaterialIconMeta(nextId, materialNames).iconId,
        iconHref: getMaterialIconMeta(nextId, materialNames).iconHref,
      });
      next.sellBlacklist = blacklist;
      renderConfig(next);
    }

    function removeSellBlacklistRow(entryId) {
      var next = readPanelDraftConfig();
      next.sellBlacklist = normalizeMaterialBlocklist(next.sellBlacklist || [], materialNames).filter(function (entry) {
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
      if (action === 'add-sell-blacklist-row') {
        addSellBlacklistRow();
        return;
      }
      if (action === 'remove-sell-blacklist-row') {
        removeSellBlacklistRow(entryId);
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

        if (action === 'auto') {
          savePanelConfig(snapshot);
          setAutoLoopEnabled(true);
          startRun('auto');
          pushStep('自动模式', '已启动自动轮询');
          finishRun('success', { autoMode: true });
          runAutoLoop();
          return;
        }

        if (action === 'sell') {
          return runSelectedChain('sell_chain', snapshot).catch(function (error) {
            state.lastError = String(error && error.message ? error.message : error);
            pushStep('失败', state.lastError);
            finishRun('failed', { error: state.lastError });
          });
        }

        if (action === 'resupply') {
          return runSelectedChain('resupply_chain', snapshot).catch(function (error) {
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
      var autoModeInput = doc.getElementById('gtap-auto-mode');
      if (autoModeInput && config) {
        autoModeInput.checked = !!(config.workflow && config.workflow.autoMode);
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
      state.autoLoopEnabled = !!(next.workflow && next.workflow.autoMode) && state.autoLoopEnabled;
      syncPanelConfig(next);
    }

    function start() {
      ensureCurrentStores();
      ensurePanel();
      var config = state.baseStore ? state.baseStore.read() : null;
      updateStatus(resolveStatusText(state));
      if (config && config.workflow && config.workflow.autoMode) {
        setAutoLoopEnabled(true);
        scheduleAutoLoop(DEFAULTS.pollIntervalMs);
      }
      return api;
    }

    var api = {
      version: APP_VERSION,
      normalizeText: normalizeText,
      parseNumber: parseNumber,
      pickInitialChain: pickInitialChain,
      reduceResupplyDays: reduceResupplyDays,
      getAtomicActions: getAtomicActions,
      getWishlistResupplyAtomicSteps: getWishlistResupplyAtomicSteps,
      runAtomicAction: runAtomicAction,
      getShipSupportMaterials: getShipSupportMaterials,
      planShipSupportMaterialRestock: planShipSupportMaterialRestock,
      planExchangeInventorySellBatch: planExchangeInventorySellBatch,
      calculateSellOfferPrice: calculateSellOfferPrice,
      validateSellOfferBeforeSubmit: validateSellOfferBeforeSubmit,
      createMemoryStorage: createMemoryStorage,
      createBaseStore: createBaseStore,
      createHistoryStore: createHistoryStore,
      createApiClient: createApiClient,
      collectOutboundBatch: collectOutboundBatch,
      collectBatchFromWarehouse: collectBatchFromWarehouse,
      inferShipLocation: inferShipLocation,
      findDestinationSuggestionByText: function (docRef, text) {
        return findDestinationSuggestionByText(docRef, text);
      },
      findUnloadOnArrivalCheckbox: function (docRef) {
        return findUnloadOnArrivalCheckbox(docRef);
      },
      findButtonByIconHref: findButtonByIconHref,
      clickExchangeMaterialRowInDocument: clickExchangeMaterialRowInDocument,
      clickExchangeWarehouseSellButtonInDocument: clickExchangeWarehouseSellButtonInDocument,
      setTradeAmountInDocument: setTradeAmountInDocument,
      clickFinalBuyButtonInDocument: clickFinalBuyButtonInDocument,
      clickSellTabInDocument: clickSellTabInDocument,
      readLowestOfferPriceInDocument: readLowestOfferPriceInDocument,
      clickLowestSellOfferRowInDocument: clickLowestSellOfferRowInDocument,
      setSellOfferAmountInDocument: setSellOfferAmountInDocument,
      readSellOfferAmountInDocument: readSellOfferAmountInDocument,
      setSellOfferPriceInDocument: setSellOfferPriceInDocument,
      readSellOfferPriceInDocument: readSellOfferPriceInDocument,
      stepDownSellOfferPriceInDocument: stepDownSellOfferPriceInDocument,
      clickCreateOfferButtonInDocument: clickCreateOfferButtonInDocument,
      _testSellBatchOnExchange: sellBatchOnExchange,
      _testRenderConfig: renderConfig,
      _testBuildAtomicActionsHtml: buildAtomicActionsHtml,
      findPriceForMaterial: findPriceForMaterial,
      getMaterialIconMeta: function (materialId, entry) {
        return getMaterialIconMeta(materialId, defaultMaterialNames(), entry);
      },
      normalizeOutboundWhitelist: normalizeOutboundWhitelist,
      normalizeMaterialBlocklist: normalizeMaterialBlocklist,
      resolveStatusText: resolveStatusText,
      resolveAutoWaitMs: resolveAutoWaitMs,
      resolveLoopWaitMs: resolveLoopWaitMs,
      ensureCurrentStores: ensureCurrentStores,
      createApp: createApp,
      start: function () {
        return start();
      },
      constants: {
        appVersion: APP_VERSION,
        materialAtlasHref: MATERIAL_ATLAS_HREF,
        materialNames: defaultMaterialNames(),
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
