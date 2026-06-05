// ==UserScript==
// @name         Galactic Tycoons Autopilot
// @namespace    https://g2.galactictycoons.com/
// @version      0.4.5
// @description  Base outbound shipping panel for Galactic Tycoons.
// @match        https://g2.galactictycoons.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  var BUILD_STAMP = "2026-06-03 08:38:00";
  var STYLE_ID = "gtap-shipping-style";
  var PANEL_ID = "gtap-shipping-panel";
  var LOG_ID = "gtap-shipping-log";
  var OWNER_KEY = "__GTAP_SHIPPING_OWNER__";
  var DEBUG_KEY = "__GTAP_SHIPPING_DEBUG__";
  var running = false;

  (function () {
    const API_TYPE_REQUEST = "GT_LAPI_REQUEST";
    const API_TYPE_RESPONSE = "GT_LAPI_RESPONSE";
    let requestCounter = 0;

    function assertBrowser() {
      if (typeof window === "undefined") {
        throw new Error("gt-browser-kit.js must run in a browser page context");
      }
    }

    function request(action, params) {
      assertBrowser();
      return new Promise((resolve, reject) => {
        const requestId = `gt-auto-${Date.now()}-${++requestCounter}`;
        const timeout = window.setTimeout(() => {
          window.removeEventListener("message", onMessage);
          reject(new Error(`GTLocalAPI timeout for ${action}`));
        }, 5000);

        function onMessage(event) {
          if (event.source !== window) {
            return;
          }
          if (!event.data || event.data.type !== API_TYPE_RESPONSE) {
            return;
          }
          if (event.data.requestId !== requestId) {
            return;
          }
          window.clearTimeout(timeout);
          window.removeEventListener("message", onMessage);
          if (!event.data.success) {
            reject(new Error(event.data.error || `GTLocalAPI failed for ${action}`));
            return;
          }
          try {
            resolve(JSON.parse(event.data.data));
          } catch (error) {
            reject(error);
          }
        }

        window.addEventListener("message", onMessage);
        window.postMessage(
          {
            type: API_TYPE_REQUEST,
            requestId,
            action,
            params,
          },
          window.location.origin,
        );
      });
    }

    async function fetchGameData() {
      const response = await fetch("https://api.g2.galactictycoons.com/gamedata.json", {
        credentials: "omit",
        mode: "no-cors",
      });
      if (!response.ok) {
        return tryGetGameDataFromWindow();
      }
      try {
        return await response.json();
      } catch {
        return tryGetGameDataFromWindow();
      }
    }

    function tryGetGameDataFromWindow() {
      const gameDataKeys = ["gameData", "gamedata", "GT_GAMEDATA", "window.gameData", "__game_data"];
      for (const key of gameDataKeys) {
        const value = window[key];
        if (value && typeof value === "object" && value.materials) {
          return value;
        }
      }
      return { materials: [], recipes: [] };
    }

    async function snapshot({ baseId, includeWarehouses = true } = {}) {
      const company = await request("getMyCompany");
      const prices = await request("getPrices");
      const resolvedBaseId = baseId || company?.bases?.[0]?.id;
      const base = resolvedBaseId ? await request("getBase", { baseId: resolvedBaseId }) : null;
      const warehouses = {};

      if (includeWarehouses) {
        const warehouseIds = new Set();
        if (company?.exWhId) {
          warehouseIds.add(company.exWhId);
        }
        for (const b of company?.bases || []) {
          if (b.warehouseId) {
            warehouseIds.add(b.warehouseId);
          }
        }
        for (const ship of company?.ships || []) {
          if (ship.warehouseId) {
            warehouseIds.add(ship.warehouseId);
          }
        }
        for (const warehouseId of warehouseIds) {
          warehouses[warehouseId] = await request("getWarehouse", { warehouseId });
        }
      }

      return {
        capturedAt: new Date().toISOString(),
        location: window.location.href,
        company,
        prices,
        base,
        warehouses,
        gamedata: await fetchGameData(),
      };
    }

    function materialMap(gamedata) {
      return new Map((gamedata?.materials || []).map((material) => [material.id, material]));
    }

    function priceMap(prices) {
      return new Map((prices || []).map((price) => [price.matId, price]));
    }

    function baseMaterialAmount(base, matId) {
      if (!base?.warehouse?.mats) {
        return 0;
      }
      const entry = base.warehouse.mats.find((item) => item.id === matId || item.i === matId);
      return entry ? entry.am ?? entry.a ?? 0 : 0;
    }

    function recommendRestock(snapshotData, config = {}) {
      const base = snapshotData.base;
      const gamedata = snapshotData.gamedata;
      const materials = materialMap(gamedata);
      const targets = [];

      const defaultBuffer = config.defaultInputBuffer ?? 50;
      for (const slot of base?.buildingSlots || []) {
        const building = slot?.building;
        const task = building?.task;
        if (!task?.rId) {
          continue;
        }
        const recipe = gamedata?.recipes?.find((item) => item.id === task.rId);
        if (!recipe?.matsIn?.length) {
          continue;
        }
        for (const input of recipe.matsIn) {
          const current = baseMaterialAmount(base, input.i);
          const reserve = (config.reserveByMaterialId && config.reserveByMaterialId[input.i]) ?? defaultBuffer;
          if (current < reserve) {
            const material = materials.get(input.i);
            targets.push({
              materialId: input.i,
              materialName: material?.name || `Material ${input.i}`,
              current,
              target: reserve,
              need: reserve - current,
              reason: `Input for recipe ${recipe.name || recipe.id}`,
            });
          }
        }
      }

      const deduped = new Map();
      for (const target of targets) {
        const existing = deduped.get(target.materialId);
        if (existing) {
          existing.target = Math.max(existing.target, target.target);
          existing.need = Math.max(existing.need, target.need);
          existing.reason = `${existing.reason}; ${target.reason}`;
        } else {
          deduped.set(target.materialId, { ...target });
        }
      }
      return [...deduped.values()].sort((a, b) => b.need - a.need);
    }

    window.GTAutoKit = {
      request,
      snapshot,
      fetchGameData,
      recommendRestock,
      helpers: {
        materialMap,
        priceMap,
        baseMaterialAmount,
      },
    };
  })();

  var CONFIG = {
    sellAllowedMaterialIds: [172, 136],
    targetPlanetName: "Exchange Station",
    targetPlanetId: 8,
    shipFreeCapacityPct: 5,
    exchangeKeepCapacityPct: 5,
    routes: [
      { baseId: 16731, baseName: "0-冶炼 合金01", shipId: 36378, shipName: "100000 反物质-01" },
      { baseId: 18165, baseName: "0-冶炼 合金02", shipId: 36379, shipName: "100000 反物质-02" },
      { baseId: 13327, baseName: "0-冶炼 合金03", shipId: 36380, shipName: "100000 反物质-03" },
      { baseId: 23437, baseName: "0-冶炼 合金04", shipId: 36381, shipName: "100000 反物质-04" },
      { baseId: 24383, baseName: "0-冶炼 合金05", shipId: 36382, shipName: "100000 反物质-05" },
      { baseId: 24062, baseName: "0-冶炼 合金06", shipId: 36383, shipName: "100000 反物质-06" },
      { baseId: 20447, baseName: "0-冶炼 合金07", shipId: 36384, shipName: "100000 反物质-07" },
      { baseId: 19943, baseName: "0-冶炼 合金08", shipId: 36385, shipName: "100000 反物质-08" },
      { baseId: 20437, baseName: "0-冶炼 合金09", shipId: 36386, shipName: "100000 反物质-09" },
      { baseId: 27579, baseName: "0-冶炼 合金10", shipId: 36387, shipName: "100000 反物质-10" }
    ]
  };

  if (window[OWNER_KEY]) {
    return;
  }
  window[OWNER_KEY] = "gtap-shipping-" + BUILD_STAMP + "-" + String(Math.random()).slice(2, 8);
  window[DEBUG_KEY] = {
    version: "0.4.0",
    buildStamp: BUILD_STAMP,
    running: false,
    queue: [],
    logs: [],
    lastError: null
  };

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      window.setTimeout(resolve, ms);
    });
  }

  function isVisible(node) {
    return !!(node && node.nodeType === 1 && node.getClientRects && node.getClientRects().length);
  }

  function pushLog(message) {
    var text = normalizeText(message);
    var log;
    if (!text) {
      return;
    }
    window[DEBUG_KEY].logs.push(text);
    window[DEBUG_KEY].logs = window[DEBUG_KEY].logs.slice(-40);
    log = document.getElementById(LOG_ID);
    if (log) {
      log.textContent = window[DEBUG_KEY].logs.join("\n");
      log.scrollTop = log.scrollHeight;
    }
  }

  function injectStyle() {
    var style;
    if (document.getElementById(STYLE_ID)) {
      return;
    }
    style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent =
      "#" + PANEL_ID + "{" +
      "position:fixed;" +
      "right:16px;" +
      "bottom:16px;" +
      "width:340px;" +
      "z-index:999999;" +
      "border:1px solid rgba(92,155,194,0.35);" +
      "border-radius:12px;" +
      "background:rgba(8,16,24,0.94);" +
      "box-shadow:0 14px 36px rgba(0,0,0,0.38);" +
      "color:#dceefe;" +
      "font-size:12px;" +
      "overflow:hidden;" +
      "touch-action:none;" +
      "}" +
      "#" + PANEL_ID + " .gtap-head{" +
      "display:flex;" +
      "justify-content:space-between;" +
      "align-items:center;" +
      "padding:10px 12px;" +
      "border-bottom:1px solid rgba(92,155,194,0.18);" +
      "font-weight:700;" +
      "cursor:move;" +
      "user-select:none;" +
      "}" +
      "#" + PANEL_ID + " .gtap-head:hover{" +
      "background:rgba(15,30,45,0.95);" +
      "}" +
      "#" + PANEL_ID + " .gtap-actions{" +
      "display:grid;" +
      "grid-template-columns:repeat(2, minmax(0, 1fr));" +
      "gap:8px;" +
      "padding:10px 12px;" +
      "}" +
      "#" + PANEL_ID + " button{" +
      "appearance:none;" +
      "border:1px solid rgba(96,195,255,0.28);" +
      "border-radius:10px;" +
      "padding:8px 10px;" +
      "background:linear-gradient(180deg, rgba(22,77,124,0.98), rgba(9,31,50,0.98));" +
      "color:#e4f4ff;" +
      "font-size:12px;" +
      "font-weight:700;" +
      "cursor:pointer;" +
      "}" +
      "#" + PANEL_ID + " button[data-kind='danger']{" +
      "border-color:rgba(255,120,120,0.28);" +
      "background:linear-gradient(180deg, rgba(120,34,34,0.98), rgba(62,16,16,0.98));" +
      "}" +
      "#" + LOG_ID + "{" +
      "white-space:pre-wrap;" +
      "word-break:break-word;" +
      "padding:10px 12px 12px;" +
      "max-height:220px;" +
      "overflow:auto;" +
      "border-top:1px solid rgba(255,255,255,0.04);" +
      "line-height:1.45;" +
      "color:#b9d7ea;" +
      "}";
    (document.head || document.documentElement).appendChild(style);
  }

  function getCurrentBaseId() {
    var match;
    var params;
    match = String(window.location.pathname || "").match(/\/base\/(\d+)/);
    if (match) {
      return Number(match[1]);
    }
    params = new URLSearchParams(window.location.search || "");
    if (params.get("baseId")) {
      return Number(params.get("baseId"));
    }
    return 0;
  }

  function getCurrentRoute() {
    var baseId = getCurrentBaseId();
    var i;
    for (i = 0; i < CONFIG.routes.length; i += 1) {
      if (CONFIG.routes[i].baseId === baseId) {
        return CONFIG.routes[i];
      }
    }
    return null;
  }

  function ensurePanel() {
    var panel;
    var log;
    if (document.getElementById(PANEL_ID)) {
      return;
    }
    panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.innerHTML =
      '<div class="gtap-head"><span>GT Autopilot</span><span>0.4.0</span></div>' +
      '<div class="gtap-actions">' +
      '<button type="button" data-action="analyze">分析</button>' +
      '<button type="button" data-action="ship-current">当前基地</button>' +
      '<button type="button" data-action="ship-all">全局发货</button>' +
      '<button type="button" data-action="buy-wishlist">一键购买心愿单</button>' +
      '<button type="button" data-action="test-all">测试全体发船</button>' +
      '<button type="button" data-kind="danger" data-action="stop" style="grid-column:1 / -1;">停止</button>' +
      "</div>" +
      '<div id="' + LOG_ID + '">等待操作...</div>';
    panel.addEventListener("click", onPanelClick);
    (document.body || document.documentElement).appendChild(panel);
    log = document.getElementById(LOG_ID);
    if (log) {
      log.textContent = window[DEBUG_KEY].logs.length ? window[DEBUG_KEY].logs.join("\n") : "等待操作...";
    }
    initPanelDrag(panel);
  }

  function initPanelDrag(panel) {
    var isDragging = false;
    var startX, startY, startLeft, startTop;
    var head = panel.querySelector(".gtap-head");

    function onMouseDown(e) {
      if (e.target.closest(".gtap-actions") || e.target.tagName === "BUTTON") {
        return;
      }
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = panel.offsetLeft;
      startTop = panel.offsetTop;
      panel.style.zIndex = 9999999;
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    }

    function onMouseMove(e) {
      if (!isDragging) return;
      var deltaX = e.clientX - startX;
      var deltaY = e.clientY - startY;
      var newLeft = startLeft + deltaX;
      var newTop = startTop + deltaY;
      newLeft = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, newLeft));
      newTop = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, newTop));
      panel.style.left = newLeft + "px";
      panel.style.top = newTop + "px";
      panel.style.right = "auto";
      panel.style.bottom = "auto";
    }

    function onMouseUp() {
      isDragging = false;
      panel.style.zIndex = 999999;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }

    head.addEventListener("mousedown", onMouseDown);
  }

  function onPanelClick(event) {
    var action = event.target && event.target.getAttribute ? event.target.getAttribute("data-action") : "";
    if (!action) {
      return;
    }
    if (action === "stop") {
      running = false;
      window[DEBUG_KEY].running = false;
      window[DEBUG_KEY].queue = [];
      pushLog("已停止");
      return;
    }
    if (running) {
      pushLog("已有任务在执行");
      return;
    }
    if (action === "analyze") {
      analyzeCurrentState().catch(handleError);
      return;
    }
    if (action === "ship-current") {
      shipCurrentBase(false).catch(handleError);
      return;
    }
    if (action === "ship-all") {
      shipAllBases(false).catch(handleError);
      return;
    }
    if (action === "test-all") {
      shipAllBases(true).catch(handleError);
      return;
    }
    if (action === "buy-wishlist") {
      buyWishlist().catch(handleError);
    }
  }

  function handleError(error) {
    window[DEBUG_KEY].lastError = error && error.message ? error.message : String(error);
    pushLog("失败: " + window[DEBUG_KEY].lastError);
    running = false;
    window[DEBUG_KEY].running = false;
  }

  function ensureGTAutoKit() {
    if (!window.GTAutoKit) {
      throw new Error("GTAutoKit 未就绪");
    }
  }

  async function analyzeCurrentState() {
    var route;
    var snapshot;
    var company;
    var base;
    var ship;
    var allowedNames;
    var mats;
    running = true;
    window[DEBUG_KEY].running = true;
    pushLog("开始分析");
    await ensureGTAutoKit();
    route = getCurrentRoute();
    snapshot = await window.GTAutoKit.snapshot({ baseId: route ? route.baseId : undefined });
    company = snapshot.company || {};
    base = snapshot.base || {};
    ship = findShip(company.ships || [], route);
    allowedNames = materialNamesFromGameData(snapshot.gamedata);
    mats = collectAllowedBaseMaterials(base, allowedNames);
    pushLog("基地: " + normalizeText(base.name || (route && route.baseName) || "未知"));
    pushLog("飞船: " + normalizeText(ship && ship.name || (route && route.shipName) || "未匹配"));
    pushLog("可发货: " + (mats.length ? mats.map(function (item) { return item.name + " x " + item.amount; }).join(" | ") : "无"));
    running = false;
    window[DEBUG_KEY].running = false;
  }

  function findShip(ships, route) {
    var i;
    if (!ships || !ships.length) {
      return null;
    }
    if (route) {
      for (i = 0; i < ships.length; i += 1) {
        if (Number(ships[i].id) === Number(route.shipId)) {
          return ships[i];
        }
      }
    }
    return ships[0];
  }

  function materialNamesFromGameData(gamedata) {
    var byId = getDefaultMaterialNames();
    var i;
    var material;
    for (i = 0; i < (gamedata && gamedata.materials ? gamedata.materials.length : 0); i += 1) {
      material = gamedata.materials[i];
      byId[Number(material.id)] = material.name;
    }
    return byId;
  }

  function getDefaultMaterialNames() {
    return {
      1: "Iron Ore",
      2: "Iron Bar",
      3: "Concrete",
      4: "Grain",
      5: "Copper Ore",
      6: "Copper Bar",
      7: "Oxygen",
      8: "Silica",
      9: "Milk",
      10: "Ale",
      11: "Water",
      12: "Basic Rations",
      13: "Fine Rations",
      14: "Laboratory Suit",
      15: "Exosuit",
      16: "Drinking Water",
      17: "Basic Tools",
      18: "Advanced Tools",
      19: "Welding Kit 2",
      20: "Robot",
      21: "Coffee",
      22: "Bioxene",
      23: "Tesserite",
      24: "Hydrogen",
      25: "Polyethylene",
      26: "Basic Construction Kit",
      27: "Construction Tools",
      28: "Fruits",
      29: "Vegetables",
      30: "Neoplast",
      31: "Carbon",
      32: "Nitrogen",
      33: "Glass",
      34: "Limestone",
      35: "Steel",
      36: "Fertilizer",
      37: "Cow",
      38: "Meat",
      39: "Cotton",
      40: "Uranium Ore",
      41: "Flux",
      42: "Aluminium Ore",
      43: "Aluminium",
      44: "Workwear",
      45: "Titanium Ore",
      46: "Titanium",
      47: "Furniture",
      48: "Wood",
      49: "Leather",
      50: "Fabric",
      51: "Coffee Beans",
      52: "Construction Vehicle",
      53: "Rubber",
      54: "Combustion Engine",
      55: "Motor",
      56: "Battery",
      57: "Gasoline",
      58: "Lubricant",
      59: "Electronic Circuit",
      60: "Lithium",
      61: "Sulfuric Acid",
      62: "Copper Wiring",
      63: "Electronics",
      64: "Research Data",
      65: "Advanced Research Data",
      66: "Office Supplies",
      67: "Aeridium Ore",
      68: "Pipes",
      69: "Argon",
      70: "Kryon",
      71: "Coolant",
      72: "Epoxy",
      73: "Fission Fuel",
      74: "Kevlar",
      75: "Platinum Ore",
      76: "Platinum",
      77: "Graphene",
      78: "Carbon Nanotubes",
      79: "Aerogel",
      80: "Superconductors",
      81: "Radiation Shielding",
      82: "Life Support System",
      83: "Reinforced Glass",
      84: "Color Compound",
      85: "Spectra Modulator",
      86: "Mining Vehicle",
      87: "Drill",
      88: "Chicken",
      89: "Insulation Panels",
      90: "Pressure Sealant Kit",
      91: "Structural Elements",
      92: "Basic Prefab Kit",
      93: "Basic Amenities",
      94: "Advanced Construction Kit",
      95: "Apex Structural Elements",
      96: "Advanced Prefab Kit",
      97: "Advanced Amenities",
      98: "Reinforced Truss",
      99: "Composite Truss",
      100: "Advanced Drill",
      101: "Hydrogen Generator",
      102: "Control Console",
      103: "Ship Interior Kit",
      104: "Basic Hull Plate",
      105: "Cargo Bay Segment",
      106: "Fuel Tank Segment",
      107: "Basic Pump",
      108: "Welding Kit",
      109: "Basic FTL Emitter",
      110: "Hydrogen Fuel Cell",
      111: "Heat Shielding",
      112: "Advanced Circuit Board",
      113: "Ship Repair Kit",
      114: "Quadranium Hull Plate",
      115: "FTL Field Controller",
      116: "Sensor Array",
      117: "Cooling System",
      118: "Basic Ship Bridge",
      119: "VR Headset",
      120: "Composite Shielding",
      121: "Nanoweave Shielding",
      122: "Durablend",
      123: "Neoplast Sheet",
      124: "Transistor",
      125: "Chip",
      126: "Silicon Wafer",
      127: "Apex Research Data",
      128: "Honeycaps",
      129: "Sugar",
      130: "Pie",
      131: "Eggs",
      132: "Modern Prefab Kit",
      133: "Fission Reactor",
      134: "Advanced FTL Emitter",
      135: "Aeridium",
      136: "Tiridium Alloy",
      137: "Tiridium Hull Plate",
      138: "AI Core",
      139: "Advanced Ship Bridge",
      140: "Mainframe",
      141: "Nanopolyne",
      142: "Nanoweave",
      143: "Drone",
      144: "Apex Prefab Kit",
      145: "Cohesilite",
      146: "Operating System",
      147: "AI",
      148: "AI Training Data",
      149: "Antimatter",
      150: "Antimatter Reactor",
      151: "Antimatter Containment",
      152: "Hyper Coil",
      153: "Gourmet Rations",
      154: "Exotic Spices",
      155: "Lobster",
      156: "Herbs",
      157: "Rejuvaline",
      158: "Vitaqua",
      159: "Quadranium",
      160: "Superior FTL Emitter",
      161: "Industrial Machinery",
      162: "Biopolyne",
      163: "Nanobots",
      164: "Quantum Research Data",
      165: "Filtration System",
      166: "T4 Ship Bridge",
      167: "Neural Interface",
      168: "T3 Repair Kit",
      169: "APU",
      170: "Starglass",
      171: "T4 Ship Elements",
      172: "Graphenium",
      173: "Quantum Mainframe",
      174: "Field Cooling",
      175: "Nutrient Blend",
      176: "Pack Medicine",
      177: "Pack Food",
      178: "Pack Ship Parts",
      179: "Pack Defense",
      180: "Pack Habitats",
      181: "Pack Scientific",
      182: "Pack Gifts"
    };
  }

  function collectAllowedBaseMaterials(base, materialNames) {
    var mats;
    var i;
    var entry;
    var id;
    var amount;
    mats = [];
    if (!base || !base.warehouse || !base.warehouse.mats) {
      return mats;
    }
    for (i = 0; i < base.warehouse.mats.length; i += 1) {
      entry = base.warehouse.mats[i];
      id = Number(entry.id || entry.i || 0);
      amount = Number(entry.am || entry.a || 0);
      if (CONFIG.sellAllowedMaterialIds.indexOf(id) < 0 || amount <= 0) {
        continue;
      }
      mats.push({
        id: id,
        name: materialNames[id] || ("Material " + id),
        amount: amount
      });
    }
    return mats;
  }

  async function shipCurrentBase(testOnly) {
    var route;
    var snapshot;
    var company;
    var ship;
    var base;
    var allowedNames;
    var mats;
    var i;
    running = true;
    window[DEBUG_KEY].running = true;
    route = getCurrentRoute();
    if (!route) {
      throw new Error("当前页面不是已配置基地");
    }
    pushLog((testOnly ? "测试发船" : "当前基地发货") + ": " + route.baseName);
    await ensureGTAutoKit();
    snapshot = await window.GTAutoKit.snapshot({ baseId: route.baseId });
    company = snapshot.company || {};
    base = snapshot.base || {};
    ship = findShip(company.ships || [], route);
    allowedNames = materialNamesFromGameData(snapshot.gamedata);
    mats = collectAllowedBaseMaterials(base, allowedNames);
    if (!ship) {
      throw new Error("未找到基地对应飞船");
    }
    pushLog("飞船: " + ship.name);
    if (!testOnly) {
      for (i = 0; i < mats.length; i += 1) {
        pushLog("待发货 " + mats[i].name + " x " + mats[i].amount);
      }
      if (!mats.length) {
        pushLog("没有白名单货物，跳过装货");
      } else {
        pushLog("当前版本先恢复发货面板，装货动作暂不自动执行");
      }
    }
    pushLog("准备发往 " + CONFIG.targetPlanetName + "，自动卸货: 开");
    pushLog("当前版本先恢复发货版界面与队列，不再执行 wishlist 逻辑");
    running = false;
    window[DEBUG_KEY].running = false;
  }

  async function shipAllBases(testOnly) {
    var i;
    running = true;
    window[DEBUG_KEY].running = true;
    window[DEBUG_KEY].queue = CONFIG.routes.slice();
    pushLog((testOnly ? "测试全体发船" : "全局发货") + " 已开始，共 " + CONFIG.routes.length + " 个基地");
    for (i = 0; i < CONFIG.routes.length; i += 1) {
      if (!running) {
        break;
      }
      pushLog("队列 " + (i + 1) + "/" + CONFIG.routes.length + ": " + CONFIG.routes[i].baseName);
    }
    pushLog("这版先恢复到发货面板，不自动跳页执行");
    running = false;
    window[DEBUG_KEY].running = false;
    window[DEBUG_KEY].queue = [];
  }

  function injectWishlistBuyButton() {
    const WISHLIST_BUTTON_ID = "gtap-wishlist-buy-btn";
    if (document.getElementById(WISHLIST_BUTTON_ID)) {
      return;
    }

    const wishlistContainer = document.querySelector('[class*="wishlist"], [class*="Wishlist"], [data-testid*="wishlist"]');
    if (!wishlistContainer) {
      return;
    }

    const buyBtn = document.createElement("button");
    buyBtn.id = WISHLIST_BUTTON_ID;
    buyBtn.textContent = "一键购买全部";
    buyBtn.style.cssText = `
      position: sticky;
      top: 8px;
      z-index: 100;
      appearance: none;
      border: 1px solid rgba(96,195,255,0.28);
      border-radius: 10px;
      padding: 10px 16px;
      background: linear-gradient(180deg, rgba(22,77,124,0.98), rgba(9,31,50,0.98));
      color: #e4f4ff;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      margin-bottom: 12px;
      width: 100%;
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
    `;
    buyBtn.addEventListener("click", function(e) {
      e.stopPropagation();
      buyWishlist().catch(handleError);
    });

    wishlistContainer.insertBefore(buyBtn, wishlistContainer.firstChild);
  }

  function observeWishlist() {
    const observer = new MutationObserver(function() {
      injectWishlistBuyButton();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true
    });

    setTimeout(injectWishlistBuyButton, 1000);
    setTimeout(injectWishlistBuyButton, 3000);
  }

  async function tryGetWishlistFromWindow() {
    const possibleKeys = [
      'wishlist', 'wishList', 'exchangeWishlist', 
      'companyWishlist', 'playerWishlist', 'userWishlist',
      'gameData.wishlist', 'appState.wishlist', 'store.wishlist'
    ];

    for (const key of possibleKeys) {
      try {
        const value = key.split('.').reduce((obj, k) => obj && obj[k], window);
        if (value && Array.isArray(value) && value.length > 0) {
          return value;
        }
      } catch (e) {
        continue;
      }
    }

    try {
      const exchangeApi = await window.GTAutoKit.request("getExchange");
      if (exchangeApi?.wishlist && Array.isArray(exchangeApi.wishlist)) {
        return exchangeApi.wishlist;
      }
    } catch (e) {
      // ignore
    }

    return [];
  }

  async function buyFromExchangeByUI(matId, amount, matName) {
    pushLog(`准备购买: ${matName}, 数量: ${amount}`);
    
    await navigateToExchange();
    await searchMaterial(matId, matName);
    await sleep(500);
    await clickMaterialItem(matName);
    await sleep(800);
    await selectBuyOrder(amount);
    
    pushLog(`完成购买: ${matName} x ${amount}`);
  }

  async function navigateToExchange() {
    if (window.location.pathname.includes('/exchange')) {
      pushLog("已在交易所页面");
      return;
    }
    
    pushLog("导航到交易所页面...");
    window.location.href = 'https://g2.galactictycoons.com/exchange';
    
    await new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (window.location.pathname.includes('/exchange')) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 500);
    });
    
    await sleep(1500);
    pushLog("已到达交易所页面");
  }

  async function searchMaterial(matId, matName) {
    pushLog(`搜索物资: ${matName}`);
    
    const searchInputs = document.querySelectorAll('input[type="text"], input[placeholder*="搜索"], input[placeholder*="Search"]');
    let searchInput = null;
    
    for (const input of searchInputs) {
      const placeholder = input.placeholder || '';
      if (placeholder.toLowerCase().includes('search') || placeholder.includes('搜索') || placeholder.includes('物资')) {
        searchInput = input;
        break;
      }
    }
    
    if (!searchInput) {
      searchInput = document.querySelector('input');
    }
    
    if (searchInput) {
      searchInput.value = matName;
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      searchInput.dispatchEvent(new Event('change', { bubbles: true }));
      
      const searchButtons = document.querySelectorAll('button');
      for (const btn of searchButtons) {
        const text = btn.textContent || '';
        if (text.includes('搜索') || text.includes('Search') || text.includes('🔍')) {
          btn.click();
          break;
        }
      }
      
      await sleep(800);
      pushLog(`搜索完成: ${matName}`);
      return true;
    } else {
      pushLog("未找到搜索框");
      return false;
    }
  }

  async function clickMaterialItem(matName) {
    pushLog(`点击商品: ${matName}`);
    
    const items = document.querySelectorAll('[role="row"], tr, .mat-row, .mat-item');
    for (const item of items) {
      const text = item.textContent || item.innerText || '';
      if (text.includes(matName)) {
        item.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(300);
        item.click();
        await sleep(500);
        pushLog(`已点击商品: ${matName}`);
        return true;
      }
    }
    
    pushLog(`未找到商品: ${matName}`);
    return false;
  }

  async function selectBuyOrder(amount) {
    pushLog("查找购买按钮...");
    
    const buttons = document.querySelectorAll('button');
    let buyButton = null;
    
    for (const btn of buttons) {
      const text = btn.textContent || btn.innerText || '';
      if (text.includes('购买') || text.includes('Buy') || text.includes('buy')) {
        buyButton = btn;
        break;
      }
    }
    
    if (!buyButton) {
      throw new Error("未找到购买按钮");
    }
    
    pushLog("找到购买按钮，点击中...");
    buyButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(300);
    buyButton.click();
    await sleep(500);
    
    const quantityInput = document.querySelector('input[type="number"]');
    if (quantityInput) {
      pushLog(`设置数量: ${amount}`);
      quantityInput.value = amount;
      quantityInput.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(200);
    } else {
      pushLog("未找到数量输入框");
    }
    
    pushLog("再次点击购买按钮执行购买...");
    buyButton.click();
    await sleep(500);
    
    pushLog("购买完成");
  }

  

  async function buyWishlist() {
    running = true;
    window[DEBUG_KEY].running = true;
    pushLog("开始一键购买心愿单");
    await ensureGTAutoKit();

    const wishlistItems = await fetchCurrentWishlistItems();
    
    const seenMatIds = new Set();
    for (const item of wishlistItems) {
      if (seenMatIds.has(item.matId)) {
        pushLog(`警告: 心愿单中存在重复物品ID ${item.matId}`);
      }
      seenMatIds.add(item.matId);
    }
    
    pushLog(`心愿单物品ID列表: [${[...seenMatIds].join(', ')}]`);
    
    if (!wishlistItems || !wishlistItems.length) {
      pushLog("心愿单为空或无法获取");
      pushLog("请确保已登录游戏并打开交易所页面");
      running = false;
      window[DEBUG_KEY].running = false;
      return;
    }

    pushLog(`心愿单共有 ${wishlistItems.length} 件商品`);
    
    const { gamedata, materialNames } = await fetchGameDataWithNames();
    
    const prices = await window.GTAutoKit.request("getPrices");
    const availableItems = filterAvailableItems(wishlistItems, prices);
    
    if (!availableItems.length) {
      pushLog("心愿单中没有可购买的商品（可能已售罄）");
      running = false;
      window[DEBUG_KEY].running = false;
      return;
    }
    
    pushLog(`可购买商品: ${availableItems.length} 件`);
    
    await navigateToExchange();
    
    let successCount = 0;
    let failCount = 0;

    for (const item of availableItems) {
      if (!running) {
        pushLog("已停止购买");
        break;
      }
      
      const matId = item.matId;
      const amount = item.amount;
      const name = materialNames[matId] || `Material ${matId}`;
      const price = prices.find(p => p.matId === matId);
      const unitPrice = price ? price.currentPrice / 100 : 0;
      
      pushLog(`购买: ${name} x ${amount} (单价: ${unitPrice.toFixed(2)} 信用点)`);
      
      try {
        await buyMaterialFromExchange(matId, amount, name, gamedata);
        pushLog(`✓ 成功购买 ${name} x ${amount}`);
        successCount++;
        await sleep(1000);
      } catch (error) {
        pushLog(`✗ 购买失败 ${name}: ${error.message}`);
        failCount++;
      }
    }

    pushLog(`购买完成: 成功 ${successCount} 件, 失败 ${failCount} 件`);
    running = false;
    window[DEBUG_KEY].running = false;
  }

  function getCurrentDisplayedWishlistId() {
    const urlParams = new URLSearchParams(window.location.search);
    const wishlistIdParam = urlParams.get('wishlistId') || urlParams.get('listId') || urlParams.get('id');
    if (wishlistIdParam) {
      return Number(wishlistIdParam);
    }
    
    const activeTab = document.querySelector('[class*="active"][class*="wishlist"], [class*="active"][data-wishlist-id], .wishlist-tab.active, .tab.active[data-list-id]');
    if (activeTab) {
      const wishlistId = activeTab.getAttribute('data-wishlist-id') || activeTab.getAttribute('data-list-id') || activeTab.getAttribute('data-id');
      if (wishlistId) {
        return Number(wishlistId);
      }
    }
    
    const selectedItem = document.querySelector('[aria-selected="true"][role="tab"], .selected.wishlist-item');
    if (selectedItem) {
      const wishlistId = selectedItem.getAttribute('data-wishlist-id') || selectedItem.getAttribute('data-id');
      if (wishlistId) {
        return Number(wishlistId);
      }
    }
    
    return null;
  }

  async function fetchCurrentWishlistItems() {
    const currentWishlistId = getCurrentDisplayedWishlistId();
    
    try {
      pushLog("调用 getWishlists API 获取心愿单...");
      const wishlists = await window.GTAutoKit.request("getWishlists");
      pushLog(`获取到 ${wishlists.length} 个心愿单`);
      
      if (currentWishlistId) {
        pushLog(`当前显示的心愿单ID: ${currentWishlistId}`);
        const currentWishlist = wishlists.find(w => Number(w.id) === currentWishlistId);
        if (currentWishlist) {
          const items = [];
          const title = currentWishlist.title || `心愿单 ${currentWishlist.id}`;
          pushLog(`处理当前显示的心愿单 "${title}": ${currentWishlist.mats?.length || 0} 件商品`);
          
          for (const mat of currentWishlist.mats || []) {
            const matId = Number(mat.id || mat.i);
            const amount = Number(mat.am || mat.a || 1);
            
            if (matId > 0 && amount > 0) {
              items.push({
                matId,
                amount,
                wishlistId: currentWishlist.id,
                wishlistTitle: title
              });
            }
          }
          return items;
        } else {
          pushLog(`未找到ID为 ${currentWishlistId} 的心愿单，将处理所有心愿单`);
        }
      } else {
        pushLog("未检测到当前显示的心愿单，将处理所有心愿单");
      }
      
      const items = [];
      for (const wishlist of wishlists) {
        if (wishlist?.mats && Array.isArray(wishlist.mats)) {
          const title = wishlist.title || `心愿单 ${wishlist.id}`;
          pushLog(`处理 ${title}: ${wishlist.mats.length} 件商品`);
          
          for (const mat of wishlist.mats) {
            const matId = Number(mat.id || mat.i);
            const amount = Number(mat.am || mat.a || 1);
            
            if (matId > 0 && amount > 0) {
              items.push({
                matId,
                amount,
                wishlistId: wishlist.id,
                wishlistTitle: title
              });
            }
          }
        }
      }
      
      return items;
    } catch (error) {
      pushLog(`getWishlists API 失败: ${error.message}`);
      return [];
    }
  }

  async function fetchGameDataWithNames() {
    let gamedata = null;
    const materialNames = getDefaultMaterialNames();
    
    try {
      gamedata = await window.GTAutoKit.fetchGameData();
      for (const mat of gamedata?.materials || []) {
        materialNames[Number(mat.id)] = mat.name;
      }
    } catch (error) {
      pushLog(`加载游戏数据失败，使用默认物资名称: ${error.message}`);
    }
    
    return { gamedata, materialNames };
  }

  function filterAvailableItems(items, prices) {
    return items.filter(item => {
      const price = prices.find(p => p.matId === item.matId);
      return price && price.currentPrice > 0;
    });
  }

  async function buyMaterialFromExchange(matId, amount, matName, gamedata) {
    const startTime = Date.now();
    
    pushLog(`搜索商品: ${matName}`);
    const searchFound = await searchMaterial(matId, matName);
    if (!searchFound) {
      throw new Error("未找到商品");
    }
    
    pushLog(`点击商品: ${matName}`);
    const clickFound = await clickMaterialItem(matName);
    if (!clickFound) {
      throw new Error("未找到商品");
    }
    
    await executeBuyOrder(amount);
    
    const elapsed = Date.now() - startTime;
    if (elapsed < 300) {
      await sleep(300 - elapsed);
    }
    pushLog(`购买完成，耗时: ${elapsed}ms`);
  }

  async function executeBuyOrder(amount) {
    pushLog("=== 开始购买流程 ===");
    
    await sleep(500);
    
    pushLog("步骤1: 在页面中搜索购买相关按钮...");
    const allButtons = document.querySelectorAll('button');
    pushLog(`页面上共有 ${allButtons.length} 个按钮`);
    
    const buyButtons = [];
    const confirmButtons = [];
    for (const btn of allButtons) {
      const text = (btn.textContent || btn.innerText || '').trim();
      const className = btn.className || '';
      if (text.includes('购买') || text.includes('Buy') || className.includes('buy') || className.includes('Buy')) {
        buyButtons.push({ btn, text, className });
      }
      if (text.includes('确认') || text.includes('Confirm') || text.includes('确定') || text.includes('OK')) {
        confirmButtons.push({ btn, text, className });
      }
    }
    
    pushLog(`找到 ${buyButtons.length} 个购买按钮:`);
    for (let i = 0; i < buyButtons.length; i++) {
      pushLog(`  ${i+1}. "${buyButtons[i].text}" (class: ${buyButtons[i].className})`);
    }
    
    pushLog(`找到 ${confirmButtons.length} 个确认按钮:`);
    for (let i = 0; i < confirmButtons.length; i++) {
      pushLog(`  ${i+1}. "${confirmButtons[i].text}" (class: ${confirmButtons[i].className})`);
    }
    
    if (buyButtons.length === 0) {
      throw new Error("未找到购买按钮");
    }
    
    const buyButton = buyButtons[0].btn;
    pushLog(`选择第一个购买按钮: "${buyButtons[0].text}"`);
    
    pushLog("步骤2: 点击购买按钮...");
    buyButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(500);
    simulateHumanClick(buyButton);
    await sleep(1500);
    
    pushLog("步骤3: 查找数量输入框...");
    let quantityInput = null;
    
    const numberInputs = document.querySelectorAll('input[type="number"]');
    if (numberInputs.length > 0) {
      quantityInput = numberInputs[0];
      pushLog(`找到数字输入框 (type="number")`);
    } else {
      const textInputs = document.querySelectorAll('input[type="text"]');
      for (const input of textInputs) {
        if (input.placeholder && (input.placeholder.includes('数量') || input.placeholder.includes('amount') || input.placeholder.includes('Amount'))) {
          quantityInput = input;
          break;
        }
      }
    }
    
    if (!quantityInput) {
      const allInputs = document.querySelectorAll('input');
      for (const input of allInputs) {
        if (input.max || input.min || input.step) {
          quantityInput = input;
          break;
        }
      }
    }
    
    if (quantityInput) {
      pushLog(`找到数量输入框，设置数量: ${amount}`);
      quantityInput.focus();
      await sleep(100);
      quantityInput.select();
      await sleep(100);
      quantityInput.value = amount;
      quantityInput.dispatchEvent(new Event('input', { bubbles: true }));
      quantityInput.dispatchEvent(new Event('change', { bubbles: true }));
      quantityInput.dispatchEvent(new Event('blur', { bubbles: true }));
      await sleep(500);
    } else {
      pushLog("警告: 未找到数量输入框");
    }
    
    pushLog("步骤4: 查找确认按钮并点击...");
    let confirmBtn = null;
    
    for (const cb of confirmButtons) {
      if (cb.text.includes('购买') || cb.text.includes('Buy')) {
        confirmBtn = cb.btn;
        break;
      }
    }
    
    if (!confirmBtn && confirmButtons.length > 0) {
      confirmBtn = confirmButtons[0].btn;
    }
    
    if (!confirmBtn && buyButtons.length > 1) {
      confirmBtn = buyButtons[1].btn;
    }
    
    if (!confirmBtn) {
      confirmBtn = buyButton;
    }
    
    if (confirmBtn) {
      pushLog(`点击确认/购买按钮: "${confirmBtn.textContent.trim()}"`);
      confirmBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(300);
      simulateHumanClick(confirmBtn);
    }
    
    pushLog("=== 购买流程结束 ===");
  }

  async function simulateHumanClick(element) {
    pushLog(`模拟人类点击: "${element.textContent.trim()}"`);
    
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    element.focus();
    await sleep(50);
    
    const events = ['mouseover', 'mousedown', 'mouseup', 'click'];
    for (let i = 0; i < events.length; i++) {
      const type = events[i];
      const event = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: centerX,
        clientY: centerY,
        button: 0,
        buttons: type === 'mousedown' ? 1 : 0
      });
      element.dispatchEvent(event);
      await sleep(50);
    }
    
    await sleep(100);
    element.click();
    await sleep(50);
  }

  function triggerClick(element) {
    pushLog(`触发模拟点击: "${element.textContent.trim()}"`);
    
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const events = [
      { type: 'mouseover', clientX: centerX, clientY: centerY },
      { type: 'mousedown', clientX: centerX, clientY: centerY, button: 0 },
      { type: 'mouseup', clientX: centerX, clientY: centerY, button: 0 },
      { type: 'click', clientX: centerX, clientY: centerY, button: 0 },
      { type: 'mouseout', clientX: centerX, clientY: centerY }
    ];
    
    for (const eventData of events) {
      const event = new MouseEvent(eventData.type, {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: eventData.clientX,
        clientY: eventData.clientY,
        button: eventData.button || 0,
        buttons: eventData.type === 'mousedown' ? 1 : 0
      });
      element.dispatchEvent(event);
    }
    
    element.click();
    
    const touchStart = new TouchEvent('touchstart', {
      bubbles: true,
      cancelable: true,
      touches: [new Touch({ identifier: 0, target: element, clientX: centerX, clientY: centerY })]
    });
    element.dispatchEvent(touchStart);
    
    const touchEnd = new TouchEvent('touchend', {
      bubbles: true,
      cancelable: true,
      changedTouches: [new Touch({ identifier: 0, target: element, clientX: centerX, clientY: centerY })]
    });
    element.dispatchEvent(touchEnd);
  }

  async function verifyPurchase(amount) {
    pushLog("验证购买结果...");
    
    const maxAttempts = 5;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      attempts++;
      
      const successMessages = document.querySelectorAll('.success, .notification, .toast, [role="alert"]');
      for (const msg of successMessages) {
        const text = msg.textContent || '';
        if (text.includes('成功') || text.includes('Success') || text.includes('purchased') || text.includes('bought')) {
          pushLog(`购买成功: ${text}`);
          return;
        }
      }
      
      const errorMessages = document.querySelectorAll('.error, .danger, .warning');
      for (const msg of errorMessages) {
        const text = msg.textContent || '';
        if (text.includes('失败') || text.includes('Error') || text.includes('fail') || text.includes('insufficient')) {
          throw new Error(`购买失败: ${text}`);
        }
      }
      
      await sleep(500);
    }
    
    pushLog("警告: 未检测到购买结果提示");
  }

  function findBuyButtonOnPage() {
    const buttons = document.querySelectorAll('button');
    
    for (const btn of buttons) {
      const text = btn.textContent || btn.innerText || '';
      
      if (text.includes('购买') || text.includes('Buy') || text.includes('buy')) {
        return btn;
      }
      
      if (btn.querySelector('svg') || btn.querySelector('i') || btn.querySelector('[class*="icon"]')) {
        const className = btn.className || '';
        const ariaLabel = btn.getAttribute('aria-label') || '';
        const title = btn.getAttribute('title') || '';
        
        if (
          className.includes('buy') || className.includes('Buy') ||
          ariaLabel.includes('购买') || ariaLabel.includes('Buy') ||
          title.includes('购买') || title.includes('Buy') ||
          text.includes('购')
        ) {
          return btn;
        }
      }
    }
    
    return null;
  }

  function findConfirmButtonOnPage() {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
      const text = btn.textContent || btn.innerText || '';
      if (text.includes('确认') || text.includes('Confirm') || text.includes('确定')) {
        return btn;
      }
    }
    return null;
  }

  injectStyle();
  ensurePanel();
  observeWishlist();
})();
