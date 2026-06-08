const test = require('node:test');
const assert = require('node:assert/strict');

const createGtAutopilot = require('../gt-autopilot.user.js');

function createShipListDoc(entries) {
  return {
    querySelectorAll(selector) {
      if (selector !== 'li.list-group-item.list-group-item-hover.list-group-item-dark') {
        return [];
      }
      return entries.map((entry) => ({
        querySelector(childSelector) {
          if (childSelector === 'span.link-primary.cursor-pointer.text-truncate') {
            return { textContent: entry.name };
          }
          if (childSelector === 'div.text-body-secondary.small span.cursor-pointer.link-light') {
            return entry.location ? { textContent: entry.location } : null;
          }
          if (childSelector === 'div.text-body-secondary.small') {
            return entry.location ? { textContent: entry.location } : null;
          }
          return null;
        }
      }));
    }
  };
}

function createQueryDoc(map) {
  return {
    querySelectorAll(selector) {
      return map[selector] || [];
    }
  };
}

function createTradePanelDoc() {
  const quantityInput = {
    type: 'number',
    value: '1',
    getAttribute(name) {
      return name === 'aria-label' ? 'Quantity' : '';
    },
    focus() {},
    dispatchEvent() {}
  };
  const topBuyButton = {
    textContent: 'Buy',
    innerText: 'Buy',
    innerHTML: '<button>Buy</button>',
    clicked: false,
    getClientRects() {
      return [{}];
    },
    click() {
      this.clicked = true;
    }
  };
  const finalBuyButton = {
    textContent: 'Buy',
    innerText: 'Buy',
    innerHTML: '<svg><use href="#arrow-down-to-line"></use></svg> Buy',
    clicked: false,
    getClientRects() {
      return [{}];
    },
    click() {
      this.clicked = true;
    }
  };
  return {
    quantityInput,
    topBuyButton,
    finalBuyButton,
    querySelectorAll(selector) {
      if (selector === 'input[type="number"], input') {
        return [quantityInput];
      }
      if (selector === 'button') {
        return [topBuyButton, finalBuyButton];
      }
      return [];
    }
  };
}

function createWishlistBuyOrderDoc(order) {
  const searchInput = {
    type: 'search',
    value: '',
    getAttribute(name) {
      if (name === 'placeholder') {
        return 'Search material';
      }
      if (name === 'aria-label') {
        return 'Search';
      }
      return '';
    },
    getClientRects() {
      return [{}];
    },
    focus() {},
    dispatchEvent(event) {
      if (!event || event.type === 'input') {
        order.push('search:' + this.value);
      }
    }
  };
  const quantityInput = {
    type: 'number',
    value: '',
    getAttribute() {
      return '';
    },
    getClientRects() {
      return [{}];
    },
    focus() {},
    dispatchEvent(event) {
      if (!event || event.type === 'input') {
        order.push('amount:' + this.value);
      }
    }
  };
  const finalBuyButton = {
    textContent: 'Buy',
    innerText: 'Buy',
    innerHTML: '<svg><use href="#arrow-down-to-line"></use></svg> Buy',
    getClientRects() {
      return [{}];
    },
    click() {
      order.push('buy');
    }
  };
  return {
    searchInput,
    quantityInput,
    getElementById(id) {
      return id === 'matSearch' ? searchInput : null;
    },
    querySelectorAll(selector) {
      if (selector === 'input, textarea') {
        return [searchInput, quantityInput];
      }
      if (selector === 'tr, [role="row"], .mat-row, .mat-item') {
        return [{
          textContent: searchInput.value,
          innerText: searchInput.value,
          getClientRects() {
            return [{}];
          },
          click() {
            order.push('row:' + searchInput.value);
          }
        }];
      }
      if (selector === 'input[type="number"], input') {
        return [quantityInput];
      }
      if (selector === 'button') {
        return [finalBuyButton];
      }
      return [];
    },
    querySelector(selector) {
      if (selector === 'input[type="search"], input[placeholder*="Search"], input[placeholder*="搜索"]') {
        return searchInput;
      }
      return null;
    }
  };
}

function createExchangeRowsDoc() {
  const containmentRow = {
    textContent: 'Antimatter Containment 6,400.00$',
    clicked: false,
    getClientRects() {
      return [{}];
    },
    click() {
      this.clicked = true;
    }
  };
  const antimatterRow = {
    textContent: 'Antimatter 26,500.00$',
    clicked: false,
    getClientRects() {
      return [{}];
    },
    click() {
      this.clicked = true;
    }
  };
  return {
    containmentRow,
    antimatterRow,
    querySelectorAll(selector) {
      if (selector === 'tr, [role="row"], .mat-row, .mat-item') {
        return [containmentRow, antimatterRow];
      }
      return [];
    }
  };
}

function createExchangeWarehouseSellDoc() {
  const repairBuyButton = {
    textContent: '',
    innerHTML: '<svg><use href="#arrow-down-to-line"></use></svg>',
    clicked: false,
    getClientRects() {
      return [{}];
    },
    click() {
      this.clicked = true;
    }
  };
  const containmentBuyButton = {
    textContent: '',
    innerHTML: '<svg><use href="#arrow-down-to-line"></use></svg>',
    clicked: false,
    getClientRects() {
      return [{}];
    },
    click() {
      this.clicked = true;
    }
  };
  const containmentSellButton = {
    textContent: '',
    innerHTML: '<svg><use href="#sack-dollar"></use></svg>',
    clicked: false,
    getClientRects() {
      return [{}];
    },
    click() {
      this.clicked = true;
    }
  };
  const repairRow = {
    textContent: 'Ship Repair Kit 2,000',
    querySelectorAll(selector) {
      return selector === 'button' ? [repairBuyButton] : [];
    }
  };
  const containmentRow = {
    textContent: 'Antimatter Containment 2,000',
    querySelectorAll(selector) {
      return selector === 'button' ? [containmentBuyButton, containmentSellButton] : [];
    }
  };
  return {
    repairBuyButton,
    containmentBuyButton,
    containmentSellButton,
    querySelectorAll(selector) {
      if (selector === 'tr, [role="row"], .mat-row, .mat-item') {
        return [repairRow, containmentRow];
      }
      return [];
    }
  };
}

function createSellOfferPanelDoc() {
  const amountInput = {
    type: 'number',
    value: '',
    getAttribute(name) {
      return name === 'aria-label' ? 'Amount' : '';
    },
    focus() {},
    dispatchEvent() {}
  };
  const priceInput = {
    type: 'number',
    value: '',
    stepDownCalled: 0,
    min: '3200',
    getAttribute(name) {
      if (name === 'aria-label') {
        return 'Unit price';
      }
      if (name === 'min') {
        return this.min;
      }
      return '';
    },
    focus() {},
    dispatchEvent() {},
    stepDown() {
      this.stepDownCalled += 1;
      this.value = '6300';
    }
  };
  const createButton = {
    textContent: 'Create offer',
    innerText: 'Create offer',
    clicked: false,
    getClientRects() {
      return [{}];
    },
    click() {
      this.clicked = true;
    }
  };
  const sellTab = {
    textContent: 'Sell',
    innerText: 'Sell',
    clicked: false,
    getClientRects() {
      return [{}];
    },
    click() {
      this.clicked = true;
    }
  };
  const rows = [
    { textContent: 'Best offer 6,400.00$', className: 'cursor-pointer' },
    { textContent: 'Other offer 6,500.00$', className: 'cursor-pointer' },
    { textContent: '库存 2,000' }
  ];
  return {
    amountInput,
    priceInput,
    createButton,
    sellTab,
    querySelectorAll(selector) {
      if (selector === 'input[type="number"], input') {
        return [amountInput, priceInput];
      }
      if (selector === 'button, a, [role="button"], [role="tab"]') {
        return [sellTab, createButton];
      }
      if (selector === 'button') {
        return [createButton];
      }
      if (selector === 'tr, [role="row"], .list-group-item, .card, .d-flex') {
        return rows;
      }
      return [];
    }
  };
}

function createSellOfferPanelWithSortDownDoc() {
  const priceInput = {
    type: 'number',
    id: 'inputPrice',
    value: '6400',
    min: '3200',
    stepDownCalled: 0,
    getAttribute(name) {
      if (name === 'aria-label') {
        return '';
      }
      if (name === 'min') {
        return this.min;
      }
      return '';
    },
    focus() {},
    dispatchEvent() {},
    stepDown() {
      this.stepDownCalled += 1;
      this.value = '6300';
    }
  };
  const sortDownButton = {
    textContent: '',
    innerText: '',
    innerHTML: '<svg><use xlink:href="/assets/atlas.svg#sort-down"></use></svg>',
    clicked: false,
    getClientRects() {
      return [{}];
    },
    click() {
      this.clicked = true;
      priceInput.value = '6300';
    }
  };
  const wrapper = {
    textContent: '$/unit',
    querySelectorAll(selector) {
      if (selector === 'button') {
        return [sortDownButton];
      }
      return [];
    }
  };
  priceInput.parentElement = wrapper;
  return {
    priceInput,
    sortDownButton,
    querySelectorAll(selector) {
      if (selector === 'input[type="number"], input') {
        return [priceInput];
      }
      return [];
    }
  };
}

function createSellOfferRowsDoc() {
  const lowestRow = {
    textContent: 'GP AeriCore Industries 1,785 6,400$',
    className: 'cursor-pointer',
    clicked: false,
    getClientRects() {
      return [{}];
    },
    click() {
      this.clicked = true;
    }
  };
  const higherRow = {
    textContent: 'GTF Avalon 37,155 6,500$',
    className: 'cursor-pointer',
    clicked: false,
    getClientRects() {
      return [{}];
    },
    click() {
      this.clicked = true;
    }
  };
  const farRow = {
    textContent: 'R&D Galactic Feeders 8,945 12,000$',
    className: 'cursor-pointer',
    clicked: false,
    getClientRects() {
      return [{}];
    },
    click() {
      this.clicked = true;
    }
  };
  const newOfferRow = {
    textContent: 'New offer 2,000 6,300$',
    className: 'table-success',
    clicked: false,
    getClientRects() {
      return [{}];
    },
    click() {
      this.clicked = true;
    }
  };
  return {
    lowestRow,
    higherRow,
    farRow,
    newOfferRow,
    querySelectorAll(selector) {
      if (selector === 'tr, [role="row"], .list-group-item, .card, .d-flex') {
        return [newOfferRow, lowestRow, higherRow, farRow];
      }
      return [];
    }
  };
}

function createFirstOfferRowOrderDoc() {
  const firstRow = {
    textContent: 'GP AeriCore Industries 1,622 13,000$',
    className: 'cursor-pointer',
    clicked: false,
    getClientRects() {
      return [{}];
    },
    click() {
      this.clicked = true;
    }
  };
  const laterRow = {
    textContent: 'R&D Galactic Feeders 8,945 12,000$',
    className: 'cursor-pointer',
    clicked: false,
    getClientRects() {
      return [{}];
    },
    click() {
      this.clicked = true;
    }
  };
  const newOfferRow = {
    textContent: 'New offer 2,000 6,300$',
    className: 'table-success',
    clicked: false,
    getClientRects() {
      return [{}];
    },
    click() {
      this.clicked = true;
    }
  };
  return {
    firstRow,
    laterRow,
    newOfferRow,
    querySelectorAll(selector) {
      if (selector === 'tr, [role="row"], .list-group-item, .card, .d-flex') {
        return [newOfferRow, firstRow, laterRow];
      }
      return [];
    }
  };
}

function createShipMaintenanceDoc(options = {}) {
  const popupText = options.popupText || 'Refuel ship Tank173 / 210Warehouse2,956';
  const trigger = {
    textContent: options.triggerText || 'Refuel',
    innerText: options.triggerText || 'Refuel',
    clicked: false,
    getClientRects() {
      return [{}];
    },
    click() {
      this.clicked = true;
      doc.popupOpen = true;
    }
  };
  const amountInput = {
    type: 'number',
    value: '',
    max: options.max || '2956',
    getAttribute(name) {
      return name === 'max' ? this.max : '';
    },
    focus() {},
    dispatchEvent() {}
  };
  const rangeInput = {
    type: 'range',
    value: '',
    max: options.max || '2956',
    getAttribute(name) {
      return name === 'max' ? this.max : '';
    },
    focus() {},
    dispatchEvent() {}
  };
  const cancelButton = {
    textContent: '',
    innerText: '',
    className: 'btn btn-secondary me-1',
    getClientRects() {
      return [{}];
    },
    click() {}
  };
  const confirmButton = {
    textContent: '',
    innerText: '',
    className: 'btn btn-primary',
    clicked: false,
    getClientRects() {
      return [{}];
    },
    click() {
      this.clicked = true;
    }
  };
  const popup = {
    textContent: popupText,
    innerText: popupText,
    querySelectorAll(selector) {
      if (selector === 'input[type="number"], input') {
        return [amountInput, rangeInput];
      }
      if (selector === 'button') {
        return [cancelButton, confirmButton];
      }
      return [];
    }
  };
  const doc = {
    popupOpen: false,
    trigger,
    amountInput,
    rangeInput,
    cancelButton,
    confirmButton,
    popup,
    querySelectorAll(selector) {
      if (selector === 'button[data-popup-id="shipRefuel"]' && options.mode !== 'repair' && !options.missingTrigger) {
        return [trigger];
      }
      if (selector === 'button[data-popup-id="shipRepair"]' && options.mode === 'repair' && !options.missingTrigger) {
        return [trigger];
      }
      if (selector === '.popover') {
        return this.popupOpen && !options.missingPopup ? [popup] : [];
      }
      return [];
    }
  };
  return doc;
}

function createShipInfoModalDoc(options = {}) {
  const shipLink = {
    textContent: options.shipName || 'ship-09',
    innerText: options.shipName || 'ship-09',
    clicked: false,
    getClientRects() {
      return [{}];
    },
    click() {
      this.clicked = true;
      doc.modalOpen = true;
    }
  };
  const doc = {
    modalOpen: !!options.modalOpen,
    shipLink,
    querySelectorAll(selector) {
      if (selector === '.modal.show, .modal') {
        return this.modalOpen ? [{ textContent: 'Ships ' + (options.shipName || 'ship-09') + ' Refuel Repair' }] : [];
      }
      if (selector === 'span.link-primary, .link-primary') {
        return options.missingShip ? [] : [shipLink];
      }
      return [];
    }
  };
  return doc;
}

function createMixedPricePageDoc() {
  const inventoryCard = {
    textContent: 'Exchange Warehouse Ship Repair Kit 2,000 1,500t $2.8m Antimatter Containment 2,000 $12.8m',
    className: 'card border-0'
  };
  const priceListRow = {
    textContent: 'Hydrogen 48.00$',
    className: ''
  };
  const averagePrice = {
    textContent: 'AVERAGE PRICE 5,849.79$',
    className: 'd-flex'
  };
  const newOfferRow = {
    textContent: 'New offer 2,000 6,300$',
    className: 'table-success'
  };
  const lowestOfferRow = {
    textContent: 'GP AeriCore Industries 1,622 6,400$',
    className: 'cursor-pointer'
  };
  const higherOfferRow = {
    textContent: 'GTF Avalon 37,155 6,500$',
    className: 'cursor-pointer'
  };
  return {
    querySelectorAll(selector) {
      if (selector === 'tr, [role="row"], .list-group-item, .card, .d-flex') {
        return [inventoryCard, priceListRow, averagePrice, newOfferRow, lowestOfferRow, higherOfferRow];
      }
      return [];
    }
  };
}

function createSellBatchDoc() {
  const warehouse = createExchangeWarehouseSellDoc();
  const offer = createSellOfferPanelDoc();
  const offerRows = createSellOfferRowsDoc();
  const doc = {
    containmentSellButton: warehouse.containmentSellButton,
    lowestOfferRow: offerRows.lowestRow,
    amountInput: offer.amountInput,
    priceInput: offer.priceInput,
    createButton: offer.createButton,
    getElementById() {
      return null;
    },
    querySelectorAll(selector) {
      if (selector === 'tr, [role="row"], .mat-row, .mat-item') {
        return warehouse.querySelectorAll(selector);
      }
      if (selector === 'tr, [role="row"], .list-group-item, .card, .d-flex') {
        return offerRows.querySelectorAll(selector);
      }
      return offer.querySelectorAll(selector);
    }
  };
  doc.lowestOfferRow.click = function () {
    this.clicked = true;
    offer.priceInput.value = '6300';
  };
  return doc;
}

test('normalizeText 会压缩空白并去掉首尾空格', () => {
  const api = createGtAutopilot();
  assert.equal(api.normalizeText('  a   b  '), 'a b');
});

test('pickInitialChain 会根据飞船位置选择链路', () => {
  const api = createGtAutopilot();
  assert.equal(api.pickInitialChain({ shipLocation: 'base' }), 'sell_chain');
  assert.equal(api.pickInitialChain({ shipLocation: 'exchange' }), 'resupply_chain');
  assert.equal(api.pickInitialChain({ shipLocation: 'transit' }), 'wait');
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

test('base store 默认包含 wiki API key', () => {
  const api = createGtAutopilot();
  const storage = api.createMemoryStorage();
  const store = api.createBaseStore(storage, 12345);
  const config = store.read();
  assert.equal(config.apiKey, 'S4K6lDzaRcS4');
});

test('脚本会导出当前版本号', () => {
  const api = createGtAutopilot();
  assert.equal(api.version, '0.1.29');
});

test('原子功能测试区域会把旧流程按钮放在最后', () => {
  const api = createGtAutopilot();
  const html = api._testBuildAtomicActionsHtml();

  assert.ok(html.indexOf('data-atomic-action="sell_exchange_inventory"') >= 0);
  assert.ok(html.indexOf('data-atomic-action="buy_wishlist"') > html.indexOf('data-atomic-action="sell_exchange_inventory"'));
  assert.ok(html.indexOf('data-atomic-config-panel="buy_wishlist"') > html.indexOf('data-atomic-action="buy_wishlist"'));
  assert.ok(html.indexOf('data-wishlist-resupply-steps') > html.indexOf('data-atomic-config-panel="buy_wishlist"'));
  assert.ok(html.indexOf('data-atomic-action="restock_ship_repair_materials"') >= 0);
  assert.ok(html.indexOf('data-action="sell"') > html.indexOf('data-atomic-action="restock_ship_repair_materials"'));
  assert.ok(html.indexOf('data-action="stop"') > html.indexOf('data-action="sell"'));
});

test('一键购买 wishlist 展开面板包含补货回运原子步骤按钮', () => {
  const api = createGtAutopilot();
  const html = api._testBuildAtomicActionsHtml();
  const expectedActions = [
    'wishlist_read_current_base',
    'wishlist_clear_base_wishlist',
    'wishlist_check_ship_at_exchange',
    'wishlist_create_resupply_wishlist',
    'wishlist_open_exchange',
    'wishlist_read_wishlist',
    'wishlist_buy_wishlist',
    'wishlist_transfer_to_ship',
    'wishlist_fuel_ship',
    'wishlist_repair_ship',
    'wishlist_send_ship_home'
  ];

  expectedActions.forEach((action) => {
    assert.match(html, new RegExp('data-atomic-action="' + action + '"'));
  });
  assert.ok(html.indexOf('data-atomic-action="wishlist_read_current_base"') < html.indexOf('data-atomic-action="wishlist_send_ship_home"'));
});

test('面板主体内容区域可滚动，日志固定在底部', () => {
  const api = createGtAutopilot();
  const html = api._testBuildPanelBodyHtml();

  assert.match(html, /id="gtap-scroll-body"/);
  assert.match(html, /id="gtap-fixed-log"/);
  assert.ok(html.indexOf('id="gtap-scroll-body"') < html.indexOf('id="gtap-fixed-log"'));
  assert.match(html, /id="gtap-panel-body" style="[^"]*flex:1 1 auto[^"]*overflow:hidden/);
  assert.match(html, /id="gtap-scroll-body" style="[^"]*flex:1 1 auto[^"]*overflow:auto/);
  assert.match(html, /id="gtap-fixed-log" style="[^"]*flex:0 0 auto/);
});

test('老卖货配置只渲染白名单，一键卖货配置只渲染黑名单', () => {
  const containers = {
    'gtap-config': { innerHTML: '' },
    'gtap-old-sell-config': { innerHTML: '' },
    'gtap-sell-config': { innerHTML: '' }
  };
  const api = createGtAutopilot({
    document: {
      getElementById(id) {
        return containers[id] || null;
      }
    }
  });

  api._testRenderConfig({
    resupplyDays: 7,
    outboundWhitelist: [
      { id: 80, enabled: true, minAmount: 1, name: 'Graphenium Wire' }
    ],
    sellBlacklist: [
      { id: 113, enabled: true, name: 'Ship Repair Kit' },
      { id: 149, enabled: true, name: 'Antimatter' }
    ],
    workflow: {}
  });

  assert.match(containers['gtap-old-sell-config'].innerHTML, /卖货白名单/);
  assert.match(containers['gtap-old-sell-config'].innerHTML, /data-whitelist-row="80"/);
  assert.doesNotMatch(containers['gtap-old-sell-config'].innerHTML, /卖货黑名单/);
  assert.doesNotMatch(containers['gtap-old-sell-config'].innerHTML, /data-sell-blacklist-row/);

  assert.match(containers['gtap-sell-config'].innerHTML, /卖货黑名单/);
  assert.match(containers['gtap-sell-config'].innerHTML, /data-sell-blacklist-row="113"/);
  assert.match(containers['gtap-sell-config'].innerHTML, /data-sell-blacklist-row="149"/);
  assert.match(containers['gtap-sell-config'].innerHTML, /data-icon-id="ShipRepairKit"/);
  assert.match(containers['gtap-sell-config'].innerHTML, /data-icon-id="Antimatter"/);
  assert.match(containers['gtap-sell-config'].innerHTML, /<svg/);
  assert.doesNotMatch(containers['gtap-sell-config'].innerHTML, /卖货白名单/);
  assert.doesNotMatch(containers['gtap-sell-config'].innerHTML, /data-whitelist-row/);
});

test('原子功能按钮定义包含加油、修飞船、修建筑、补修理材料', () => {
  const api = createGtAutopilot();
  assert.deepEqual(api.getAtomicActions(), [
    { action: 'sell_exchange_inventory', label: '一键卖货', status: 'done' },
    { action: 'buy_wishlist', label: '一键购买 wishlist', status: 'ready' },
    { action: 'fuel_ship', label: '一键加油' },
    { action: 'repair_ship', label: '一键修飞船' },
    { action: 'repair_base_buildings', label: '一键修基地建筑' },
    { action: 'restock_ship_repair_materials', label: '一键补飞船修理材料' }
  ]);
});

test('补货回运原子步骤定义按真实流程排序', () => {
  const api = createGtAutopilot();
  assert.deepEqual(api.getWishlistResupplyAtomicSteps(), [
    { action: 'wishlist_read_current_base', label: '读取当前基地', status: 'pending' },
    { action: 'wishlist_clear_base_wishlist', label: '清空基地 wishlist', status: 'ready' },
    { action: 'wishlist_check_ship_at_exchange', label: '检查飞船在交易所', status: 'pending' },
    { action: 'wishlist_create_resupply_wishlist', label: '创建补给 wishlist', status: 'ready' },
    { action: 'wishlist_open_exchange', label: '打开交易所', status: 'ready' },
    { action: 'wishlist_read_wishlist', label: '读取 wishlist', status: 'pending' },
    { action: 'wishlist_buy_wishlist', label: '购买 wishlist', status: 'ready' },
    { action: 'wishlist_transfer_to_ship', label: '转移到飞船', status: 'ready' },
    { action: 'wishlist_fuel_ship', label: '飞船补油', status: 'ready' },
    { action: 'wishlist_repair_ship', label: '修理飞船', status: 'ready' },
    { action: 'wishlist_send_ship_home', label: '发船回基地', status: 'ready' }
  ]);
});

test('清空、创建、打开交易所、购买、转移、补油修理和发船原子步骤标记为可测试', () => {
  const api = createGtAutopilot();
  const steps = api.getWishlistResupplyAtomicSteps();
  const byAction = Object.fromEntries(steps.map((entry) => [entry.action, entry.status]));

  assert.equal(byAction.wishlist_clear_base_wishlist, 'ready');
  assert.equal(byAction.wishlist_create_resupply_wishlist, 'ready');
  assert.equal(byAction.wishlist_open_exchange, 'ready');
  assert.equal(byAction.wishlist_buy_wishlist, 'ready');
  assert.equal(byAction.wishlist_transfer_to_ship, 'ready');
  assert.equal(byAction.wishlist_fuel_ship, 'ready');
  assert.equal(byAction.wishlist_repair_ship, 'ready');
  assert.equal(byAction.wishlist_send_ship_home, 'ready');
});

test('一键购买 wishlist 主流程只编排读取基地、读取 wishlist、打开交易所和购买', () => {
  const api = createGtAutopilot();
  assert.deepEqual(api.getBuyWishlistWorkflowSteps(), [
    'wishlist_read_current_base',
    'wishlist_read_wishlist',
    'wishlist_open_exchange',
    'wishlist_buy_wishlist'
  ]);
  assert.deepEqual(api.runAtomicAction('buy_wishlist'), {
    action: 'buy_wishlist',
    label: '一键购买 wishlist',
    status: 'ready',
    message: '一键购买 wishlist：可测试'
  });
});

test('一键补货回运主流程按 11 个原子步骤完整编排', () => {
  const api = createGtAutopilot();
  assert.deepEqual(api.getWishlistResupplyWorkflowSteps(), api.getWishlistResupplyAtomicSteps().map((entry) => entry.action));
});

test('补货回运原子步骤按钮当前返回待接入状态', () => {
  const api = createGtAutopilot();
  const result = api.runAtomicAction('wishlist_read_current_base');
  assert.deepEqual(result, {
    action: 'wishlist_read_current_base',
    label: '读取当前基地',
    status: 'pending',
    message: '读取当前基地：真实流程待接入'
  });
});

test('清空、创建、打开交易所、购买、转移、补油修理和发船原子步骤入口返回可测试状态', () => {
  const api = createGtAutopilot();

  assert.deepEqual(api.runAtomicAction('wishlist_clear_base_wishlist'), {
    action: 'wishlist_clear_base_wishlist',
    label: '清空基地 wishlist',
    status: 'ready',
    message: '清空基地 wishlist：可测试'
  });
  assert.deepEqual(api.runAtomicAction('wishlist_create_resupply_wishlist'), {
    action: 'wishlist_create_resupply_wishlist',
    label: '创建补给 wishlist',
    status: 'ready',
    message: '创建补给 wishlist：可测试'
  });
  assert.deepEqual(api.runAtomicAction('wishlist_open_exchange'), {
    action: 'wishlist_open_exchange',
    label: '打开交易所',
    status: 'ready',
    message: '打开交易所：可测试'
  });
  assert.deepEqual(api.runAtomicAction('wishlist_buy_wishlist'), {
    action: 'wishlist_buy_wishlist',
    label: '购买 wishlist',
    status: 'ready',
    message: '购买 wishlist：可测试'
  });
  assert.deepEqual(api.runAtomicAction('wishlist_transfer_to_ship'), {
    action: 'wishlist_transfer_to_ship',
    label: '转移到飞船',
    status: 'ready',
    message: '转移到飞船：可测试'
  });
  assert.deepEqual(api.runAtomicAction('wishlist_fuel_ship'), {
    action: 'wishlist_fuel_ship',
    label: '飞船补油',
    status: 'ready',
    message: '飞船补油：可测试'
  });
  assert.deepEqual(api.runAtomicAction('wishlist_repair_ship'), {
    action: 'wishlist_repair_ship',
    label: '修理飞船',
    status: 'ready',
    message: '修理飞船：可测试'
  });
  assert.deepEqual(api.runAtomicAction('wishlist_send_ship_home'), {
    action: 'wishlist_send_ship_home',
    label: '发船回基地',
    status: 'ready',
    message: '发船回基地：可测试'
  });
});

test('读取当前基地原子功能会生成基地摘要', () => {
  const api = createGtAutopilot();
  const result = api.planWishlistReadCurrentBase({
    base: { id: 20437, name: '0-冶炼 合金09', planetId: 501 },
    config: { resupplyDays: 7 }
  }, 501);

  assert.deepEqual(result, {
    baseId: 20437,
    baseName: '0-冶炼 合金09',
    wishlistId: 501,
    resupplyDays: 7
  });
});

test('读取当前基地原子功能缺少基地时会失败', () => {
  const api = createGtAutopilot();
  assert.throws(
    () => api.planWishlistReadCurrentBase({}, 0),
    /未读取到当前基地/
  );
});

test('检查飞船在交易所原子功能要求飞船位于交易所', () => {
  const api = createGtAutopilot();
  const result = api.planWishlistShipAtExchange({
    shipInfo: {
      location: 'exchange',
      ship: { name: '200000 反物质-09', locationText: 'Exchange Station' }
    }
  });

  assert.deepEqual(result, {
    shipName: '200000 反物质-09',
    shipLocation: 'exchange',
    locationText: 'Exchange Station'
  });
  assert.throws(
    () => api.planWishlistShipAtExchange({ shipInfo: { location: 'base', ship: { name: '200000 反物质-09' } } }),
    /飞船不在交易所/
  );
});

test('读取 wishlist 原子功能会统计条目数量、总数量和估算价格', () => {
  const api = createGtAutopilot();
  const result = api.planWishlistRowsSummary([
    { id: 12, name: 'Basic Rations', amount: 10, weight: 1, cost: 110 },
    { id: 16, name: 'Drinking Water', amount: 12, weight: 2, cost: 180 }
  ]);

  assert.deepEqual(result, {
    itemCount: 2,
    totalAmount: 22,
    estimatedCost: 290,
    rows: [
      { id: 12, name: 'Basic Rations', amount: 10, weight: 1, cost: 110 },
      { id: 16, name: 'Drinking Water', amount: 12, weight: 2, cost: 180 }
    ]
  });
  assert.throws(
    () => api.planWishlistRowsSummary([]),
    /wishlist 为空/
  );
});

test('购买 wishlist 前会按估算总价校验现金是否足够', () => {
  const api = createGtAutopilot();
  assert.deepEqual(api.assertWishlistPurchaseAffordable({
    company: { cash: 500 },
    wishlistSummary: { estimatedCost: 290 }
  }), {
    availableCash: 500,
    estimatedCost: 290
  });
  assert.throws(
    () => api.assertWishlistPurchaseAffordable({
      company: { cash: 100 },
      wishlistSummary: { estimatedCost: 290 }
    }),
    /资金不足/
  );
});

test('清空基地 wishlist 后仍有残留条目时会失败', async () => {
  const reads = [
    [{ id: 12, name: 'Basic Rations', amount: 10 }],
    [{ id: 12, name: 'Basic Rations', amount: 10 }]
  ];
  const api = createGtAutopilot({
    setTimeout(resolve) {
      resolve();
    },
    __testHooks: {
      resolveWishlistIdForBase: () => Promise.resolve(501),
      readWishlistRowsFromApi: () => Promise.resolve(reads.shift() || []),
      clearWishlistFromUi: () => Promise.resolve(true)
    }
  });

  await assert.rejects(
    api._testRunWishlistClearBaseWishlist({ base: { id: 20437, name: '0-冶炼 合金09', planetId: 501 } }),
    /清空后 wishlist 仍有 1 种物资/
  );
});

test('购买 wishlist 会按 wishlist 条目顺序执行搜索、选择、数量和 Buy', async () => {
  const order = [];
  const doc = createWishlistBuyOrderDoc(order);
  const api = createGtAutopilot({
    document: doc,
    Event: class TestEvent {
      constructor(type) {
        this.type = type;
      }
    },
    setTimeout(resolve) {
      resolve();
    }
  });
  const wishlist = [
    { id: 12, name: 'Basic Rations', amount: 10 },
    { id: 16, name: 'Drinking Water', amount: 20 },
    { id: 113, name: 'Ship Repair Kit', amount: 30 }
  ];

  const summary = await api._testBuyWishlistItemsFromUi(wishlist);

  assert.deepEqual(summary, [
    { name: 'Basic Rations', amount: 10 },
    { name: 'Drinking Water', amount: 20 },
    { name: 'Ship Repair Kit', amount: 30 }
  ]);
  assert.deepEqual(order, [
    'search:Basic Rations',
    'row:Basic Rations',
    'amount:10',
    'buy',
    'search:Drinking Water',
    'row:Drinking Water',
    'amount:20',
    'buy',
    'search:Ship Repair Kit',
    'row:Ship Repair Kit',
    'amount:30',
    'buy'
  ]);
});

test('转移到飞船原子功能会把 wishlist 条目转成装船批次', () => {
  const api = createGtAutopilot();
  const result = api.planWishlistTransferBatch({
    shipInfo: {
      location: 'exchange',
      ship: { name: '200000 反物质-09' }
    }
  }, [
    { id: 12, name: 'Basic Rations', amount: 10 },
    { id: 16, name: 'Drinking Water', amount: 12 }
  ]);

  assert.deepEqual(result, {
    ship: { name: '200000 反物质-09' },
    batch: [
      { id: 12, name: 'Basic Rations', current: 10 },
      { id: 16, name: 'Drinking Water', current: 12 }
    ]
  });
});

test('转移到飞船原子功能要求飞船在交易所且 wishlist 非空', () => {
  const api = createGtAutopilot();
  assert.throws(
    () => api.planWishlistTransferBatch({ shipInfo: { location: 'base', ship: { name: 'ship' } } }, [{ id: 12, name: 'Basic Rations', amount: 10 }]),
    /飞船不在交易所/
  );
  assert.throws(
    () => api.planWishlistTransferBatch({ shipInfo: { location: 'exchange', ship: { name: 'ship' } } }, []),
    /wishlist 为空/
  );
});

test('转移到飞船原子功能会在 wishlist 超出飞船载重时失败', () => {
  const api = createGtAutopilot();

  assert.throws(
    () => api.planWishlistTransferBatch({
      shipInfo: {
        location: 'exchange',
        ship: { name: 'ship', capacity: 100 }
      }
    }, [
      { id: 12, name: 'Basic Rations', amount: 80, weight: 1 },
      { id: 16, name: 'Drinking Water', amount: 30, weight: 1 }
    ]),
    /超出飞船载重/
  );
});

test('补油和修理原子功能会生成安全检查计划', () => {
  const api = createGtAutopilot();
  assert.deepEqual(api.planWishlistShipMaintenance({
    shipInfo: { location: 'exchange', ship: { name: 'ship-09' } }
  }, 'fuel'), {
    ship: { name: 'ship-09' },
    materialName: 'Antimatter',
    mode: 'fuel',
    popupId: 'shipRefuel',
    uiAction: 'ship-maintenance-popup'
  });
  assert.deepEqual(api.planWishlistShipMaintenance({
    shipInfo: { location: 'exchange', ship: { name: 'ship-09' } }
  }, 'repair'), {
    ship: { name: 'ship-09' },
    materialName: 'Ship Repair Kit',
    mode: 'repair',
    popupId: 'shipRepair',
    uiAction: 'ship-maintenance-popup'
  });
});

test('补油和修理原子功能要求飞船在交易所', () => {
  const api = createGtAutopilot();
  assert.throws(
    () => api.planWishlistShipMaintenance({ shipInfo: { location: 'base', ship: { name: 'ship' } } }, 'fuel'),
    /飞船不在交易所/
  );
  assert.throws(
    () => api.planWishlistShipMaintenance({ shipInfo: { location: 'exchange', ship: { name: 'ship' } } }, 'unknown'),
    /未知维护模式/
  );
});

test('飞船补油 helper 会打开 Refuel 弹层、填最大数量并点击确认', () => {
  const api = createGtAutopilot();
  const doc = createShipMaintenanceDoc({ mode: 'fuel', max: '2956' });

  const result = api.performShipMaintenanceInDocument(doc, 'fuel');

  assert.deepEqual(result, {
    mode: 'fuel',
    popupId: 'shipRefuel',
    amount: 2956
  });
  assert.equal(doc.trigger.clicked, true);
  assert.equal(doc.amountInput.value, '2956');
  assert.equal(doc.confirmButton.clicked, true);
});

test('修理飞船 helper 会打开 Repair 弹层、填最大数量并点击确认', () => {
  const api = createGtAutopilot();
  const doc = createShipMaintenanceDoc({ mode: 'repair', max: '1900', triggerText: 'Repair', popupText: 'Repair ship Condition98.7% 100.0%Kits to full100Warehouse1,900' });

  const result = api.performShipMaintenanceInDocument(doc, 'repair');

  assert.deepEqual(result, {
    mode: 'repair',
    popupId: 'shipRepair',
    amount: 1900
  });
  assert.equal(doc.trigger.clicked, true);
  assert.equal(doc.amountInput.value, '1900');
  assert.equal(doc.confirmButton.clicked, true);
});

test('飞船补油和修理 helper 缺入口或库存不足时返回明确失败', () => {
  const api = createGtAutopilot();
  assert.throws(
    () => api.performShipMaintenanceInDocument(createShipMaintenanceDoc({ missingTrigger: true }), 'fuel'),
    /未找到飞船补油入口/
  );
  assert.throws(
    () => api.performShipMaintenanceInDocument(createShipMaintenanceDoc({ max: '0', popupText: 'Refuel ship Tank210 / 210Warehouse0' }), 'fuel'),
    /缺少 Antimatter/
  );
  assert.throws(
    () => api.performShipMaintenanceInDocument(createShipMaintenanceDoc({ mode: 'repair', max: '0', triggerText: 'Repair', popupText: 'Repair ship Condition98.7% 100.0%Kits to full100Warehouse0' }), 'repair'),
    /缺少 Ship Repair Kit/
  );
});

test('飞船维护前会按飞船名打开飞船信息弹窗', () => {
  const api = createGtAutopilot();
  const doc = createShipInfoModalDoc({ shipName: '200000 反物质-09' });

  assert.equal(api.openShipInfoModalInDocument(doc, { name: '200000 反物质-09' }), true);
  assert.equal(doc.shipLink.clicked, true);
});

test('飞船信息弹窗已打开时不会重复点击飞船列表', () => {
  const api = createGtAutopilot();
  const doc = createShipInfoModalDoc({ shipName: '200000 反物质-09', modalOpen: true });

  assert.equal(api.openShipInfoModalInDocument(doc, { name: '200000 反物质-09' }), true);
  assert.equal(doc.shipLink.clicked, false);
});

test('找不到飞船名称时打开飞船信息弹窗会失败', () => {
  const api = createGtAutopilot();
  assert.equal(api.openShipInfoModalInDocument(createShipInfoModalDoc({ missingShip: true }), { name: 'ship-404' }), false);
});

test('发船回基地原子功能会生成返航计划', () => {
  const api = createGtAutopilot();
  const result = api.planWishlistSendShipHome({
    base: { id: 20437, name: '0-冶炼 合金09' },
    shipInfo: {
      location: 'exchange',
      ship: { name: '200000 反物质-09' }
    }
  });

  assert.deepEqual(result, {
    ship: { name: '200000 反物质-09' },
    destinationName: '0-冶炼 合金09',
    autoUnload: true,
    reactorMode: 'normal'
  });
});

test('发船回基地原子功能要求飞船在交易所且基地明确', () => {
  const api = createGtAutopilot();
  assert.throws(
    () => api.planWishlistSendShipHome({ base: { name: '0-冶炼 合金09' }, shipInfo: { location: 'base', ship: { name: 'ship' } } }),
    /飞船不在交易所/
  );
  assert.throws(
    () => api.planWishlistSendShipHome({ base: {}, shipInfo: { location: 'exchange', ship: { name: 'ship' } } }),
    /未读取到当前基地/
  );
});

test('原子功能当前只有一键卖货标记为已完成', () => {
  const api = createGtAutopilot();
  const doneActions = api.getAtomicActions()
    .filter((entry) => entry.status === 'done')
    .map((entry) => entry.action);

  assert.deepEqual(doneActions, ['sell_exchange_inventory']);
});

test('原子功能入口当前返回待接入状态', () => {
  const api = createGtAutopilot();
  const result = api.runAtomicAction('fuel_ship');
  assert.deepEqual(result, {
    action: 'fuel_ship',
    label: '一键加油',
    status: 'pending',
    message: '一键加油：真实流程待接入'
  });
});

test('飞船补给物资定义包含 Antimatter 与 Ship Repair Kit', () => {
  const api = createGtAutopilot();
  assert.deepEqual(api.getShipSupportMaterials(), [
    { id: 149, name: 'Antimatter', targetAmount: 2000, role: 'fuel' },
    { id: 113, name: 'Ship Repair Kit', targetAmount: 2000, role: 'repair' }
  ]);
});

test('base store 默认卖货黑名单保护 Ship Repair Kit 与 Antimatter', () => {
  const api = createGtAutopilot();
  const storage = api.createMemoryStorage();
  const store = api.createBaseStore(storage, 12345);
  const config = store.read();
  assert.deepEqual(config.sellBlacklist.map((entry) => ({
    id: entry.id,
    enabled: entry.enabled,
    name: entry.name,
    iconId: entry.iconId
  })), [
    { id: 113, enabled: true, name: 'Ship Repair Kit', iconId: 'ShipRepairKit' },
    { id: 149, enabled: true, name: 'Antimatter', iconId: 'Antimatter' }
  ]);
});

test('一键卖货计划会跳过卖货黑名单中的交易所库存', () => {
  const api = createGtAutopilot();
  const plan = api.planExchangeInventorySellBatch(
    {
      mats: [
        { matId: 113, am: 2000 },
        { matId: 149, am: 2000 },
        { matId: 151, am: 2000 }
      ]
    },
    {
      sellBlacklist: [
        { id: 113, enabled: true, name: 'Ship Repair Kit' },
        { id: 149, enabled: true, name: 'Antimatter' }
      ]
    }
  );

  assert.deepEqual(plan, [
    { id: 151, name: 'Antimatter Containment', current: 2000 }
  ]);
});

test('一键卖货计划在缺少配置时也会使用默认黑名单', () => {
  const api = createGtAutopilot();
  const plan = api.planExchangeInventorySellBatch({
    mats: [
      { matId: 113, am: 2000 },
      { matId: 149, am: 2000 },
      { matId: 151, am: 2000 }
    ]
  });

  assert.deepEqual(plan, [
    { id: 151, name: 'Antimatter Containment', current: 2000 }
  ]);
});

test('base store 读取空卖货黑名单时会恢复默认保护项', () => {
  const api = createGtAutopilot();
  const storage = api.createMemoryStorage();
  storage.setItem('gtap:12345:config', JSON.stringify({
    sellBlacklist: []
  }));
  const store = api.createBaseStore(storage, 12345);
  const config = store.read();

  assert.deepEqual(config.sellBlacklist.map((entry) => ({
    id: entry.id,
    enabled: entry.enabled,
    name: entry.name,
    iconId: entry.iconId
  })), [
    { id: 113, enabled: true, name: 'Ship Repair Kit', iconId: 'ShipRepairKit' },
    { id: 149, enabled: true, name: 'Antimatter', iconId: 'Antimatter' }
  ]);
});

test('卖货价格计算只负责兜底，不再自行猜测一档价格', () => {
  const api = createGtAutopilot();
  assert.equal(api.calculateSellOfferPrice(6400), 6400);
  assert.equal(api.calculateSellOfferPrice(50), 50);
});

test('交易所仓库卖货 helper 会精确点击库存行的卖货图标', () => {
  const api = createGtAutopilot();
  const doc = createExchangeWarehouseSellDoc();

  assert.equal(api.clickExchangeWarehouseSellButtonInDocument(doc, 'Antimatter Containment'), true);
  assert.equal(doc.repairBuyButton.clicked, false);
  assert.equal(doc.containmentBuyButton.clicked, false);
  assert.equal(doc.containmentSellButton.clicked, true);
});

test('卖货 offer helper 会填最低价后调用价格输入框下调一档', () => {
  const api = createGtAutopilot({ Event: function Event() {} });
  const doc = createSellOfferPanelDoc();

  assert.equal(api.clickSellTabInDocument(doc), true);
  assert.equal(doc.sellTab.clicked, true);
  assert.equal(api.readLowestOfferPriceInDocument(doc), 6400);
  assert.equal(api.setSellOfferAmountInDocument(doc, 2000), true);
  assert.equal(api.setSellOfferPriceInDocument(doc, 6400), true);
  assert.equal(api.stepDownSellOfferPriceInDocument(doc), true);
  assert.equal(doc.amountInput.value, '2000');
  assert.equal(doc.priceInput.value, '6300');
  assert.equal(doc.priceInput.stepDownCalled, 1);
  assert.equal(api.clickCreateOfferButtonInDocument(doc), true);
  assert.equal(doc.createButton.clicked, true);
});

test('卖货价格下调不会低于输入框最低限制', () => {
  const api = createGtAutopilot({ Event: function Event() {} });
  const doc = createSellOfferPanelDoc();
  doc.priceInput.min = '3200';
  doc.priceInput.stepDown = function () {
    this.stepDownCalled += 1;
    this.value = '3100';
  };

  assert.equal(api.setSellOfferPriceInDocument(doc, 3200), true);
  assert.equal(api.stepDownSellOfferPriceInDocument(doc), true);
  assert.equal(doc.priceInput.value, '3200');
  assert.equal(doc.priceInput.stepDownCalled, 1);
});

test('卖货价格下调会优先点击游戏价格框旁边的 sort-down 按钮', () => {
  const api = createGtAutopilot({ Event: function Event() {} });
  const doc = createSellOfferPanelWithSortDownDoc();

  assert.equal(api.stepDownSellOfferPriceInDocument(doc), true);
  assert.equal(doc.sortDownButton.clicked, true);
  assert.equal(doc.priceInput.stepDownCalled, 0);
  assert.equal(doc.priceInput.value, '6300');
});

test('卖货提交前只校验数量和游戏自动填出的价格有效', () => {
  const api = createGtAutopilot();

  assert.equal(api.validateSellOfferBeforeSubmit({
    expectedAmount: 2000,
    actualAmount: 0,
    actualPrice: 6300
  }).ok, false);

  assert.equal(api.validateSellOfferBeforeSubmit({
    expectedAmount: 2000,
    actualAmount: 2000,
    actualPrice: 0
  }).ok, false);

  assert.equal(api.validateSellOfferBeforeSubmit({
    expectedAmount: 2000,
    actualAmount: 2000,
    actualPrice: 12000
  }).ok, true);
});

test('报价行 helper 只读取 Offers 可点击行，忽略库存价值和全局价格表', () => {
  const api = createGtAutopilot();
  const doc = createMixedPricePageDoc();

  assert.equal(api.readLowestOfferPriceInDocument(doc), 6400);
});

test('卖货价格会通过点击 New offer 后第一条报价行让游戏自动生成价格', () => {
  const api = createGtAutopilot();
  const doc = createSellOfferRowsDoc();

  assert.equal(api.clickLowestSellOfferRowInDocument(doc), true);
  assert.equal(doc.lowestRow.clicked, true);
  assert.equal(doc.higherRow.clicked, false);
  assert.equal(doc.farRow.clicked, false);
  assert.equal(doc.newOfferRow.clicked, false);
});

test('报价行点击按 New offer 后的第一条执行，不按行内数字重新排序', () => {
  const api = createGtAutopilot();
  const doc = createFirstOfferRowOrderDoc();

  assert.equal(api.clickLowestSellOfferRowInDocument(doc), true);
  assert.equal(doc.firstRow.clicked, true);
  assert.equal(doc.laterRow.clicked, false);
  assert.equal(doc.newOfferRow.clicked, false);
});

test('一键卖货异步链路会保留最低价用于提交前校验', async () => {
  const doc = createSellBatchDoc();
  const api = createGtAutopilot({
    document: doc,
    setTimeout(callback) {
      callback();
    },
    Event: function Event() {}
  });

  const result = await api._testSellBatchOnExchange([
    { name: 'Antimatter Containment', current: 2000 }
  ]);

  assert.deepEqual(result, [
    { name: 'Antimatter Containment', amount: 2000 }
  ]);
  assert.equal(doc.containmentSellButton.clicked, true);
  assert.equal(doc.amountInput.value, '2000');
  assert.equal(doc.priceInput.value, '6300');
  assert.equal(doc.createButton.clicked, true);
});

test('一键补飞船修理材料会按交易所库存计算购买差额', () => {
  const api = createGtAutopilot();
  const plan = api.planShipSupportMaterialRestock({
    mats: [
      { id: 149, am: 1200 },
      { id: 113, am: 2500 }
    ]
  });

  assert.deepEqual(plan, [
    { id: 149, name: 'Antimatter', amount: 800, current: 1200, targetAmount: 2000, role: 'fuel' }
  ]);
});

test('一键补飞船修理材料支持 GTLocalAPI 的 matId 库存字段', () => {
  const api = createGtAutopilot();
  const plan = api.planShipSupportMaterialRestock({
    mats: [
      { matId: 149, am: 400 },
      { matId: 113, am: 2000 }
    ]
  });

  assert.deepEqual(plan, [
    { id: 149, name: 'Antimatter', amount: 1600, current: 400, targetAmount: 2000, role: 'fuel' }
  ]);
});

test('一键补飞船修理材料在交易所仓库为空时会购买两种物资各 2000', () => {
  const api = createGtAutopilot();
  const plan = api.planShipSupportMaterialRestock({ mats: [] });

  assert.deepEqual(plan, [
    { id: 149, name: 'Antimatter', amount: 2000, current: 0, targetAmount: 2000, role: 'fuel' },
    { id: 113, name: 'Ship Repair Kit', amount: 2000, current: 0, targetAmount: 2000, role: 'repair' }
  ]);
});

test('交易购买 helper 会填目标数量并点击最终 Buy 按钮', () => {
  const api = createGtAutopilot({ Event: function Event() {} });
  const doc = createTradePanelDoc();

  assert.equal(api.setTradeAmountInDocument(doc, 2000), true);
  assert.equal(doc.quantityInput.value, '2000');
  assert.equal(api.clickFinalBuyButtonInDocument(doc), true);
  assert.equal(doc.topBuyButton.clicked, false);
  assert.equal(doc.finalBuyButton.clicked, true);
});

test('交易物资行点击会精确选择 Antimatter 而不是 Antimatter Containment', () => {
  const api = createGtAutopilot();
  const doc = createExchangeRowsDoc();

  assert.equal(api.clickExchangeMaterialRowInDocument(doc, 'Antimatter'), true);
  assert.equal(doc.containmentRow.clicked, false);
  assert.equal(doc.antimatterRow.clicked, true);
});

test('默认卖货白名单为 Graphenium Wire', () => {
  const api = createGtAutopilot();
  const storage = api.createMemoryStorage();
  const store = api.createBaseStore(storage, 12345);
  const config = store.read();
  assert.deepEqual(config.outboundWhitelist.map((entry) => ({
    id: entry.id,
    enabled: entry.enabled,
    minAmount: entry.minAmount,
    name: entry.name,
    iconId: entry.iconId
  })), [
    { id: 80, enabled: true, minAmount: 1, name: 'Graphenium Wire', iconId: 'Superconductors' }
  ]);
});

test('base store 读取旧配置时会自动迁移 id 80 的旧名称', () => {
  const api = createGtAutopilot();
  const storage = api.createMemoryStorage();
  storage.setItem('gtap:12345:config', JSON.stringify({
    outboundWhitelist: [
      { id: 80, enabled: true, minAmount: 1, name: 'Superconductors' }
    ]
  }));
  const store = api.createBaseStore(storage, 12345);
  const config = store.read();
  assert.deepEqual(config.outboundWhitelist.map((entry) => ({
    id: entry.id,
    enabled: entry.enabled,
    minAmount: entry.minAmount,
    name: entry.name,
    iconId: entry.iconId
  })), [
    { id: 80, enabled: true, minAmount: 1, name: 'Graphenium Wire', iconId: 'Superconductors' }
  ]);
});

test('history store 会保留最近的记录', () => {
  const api = createGtAutopilot();
  const storage = api.createMemoryStorage();
  const history = api.createHistoryStore(storage, 9, 2);
  history.push({ id: 'a' });
  history.push({ id: 'b' });
  history.push({ id: 'c' });
  assert.deepEqual(history.read(), [{ id: 'b' }, { id: 'c' }]);
});

test('collectOutboundBatch 会按白名单和最小数量过滤', () => {
  const api = createGtAutopilot();
  const batch = api.collectOutboundBatch(
    {
      warehouse: {
        mats: [
          { id: 172, am: 10 },
          { id: 136, am: 1 },
          { id: 99, am: 500 }
        ]
      }
    },
    {
      outboundWhitelist: [
        { id: 172, enabled: true, minAmount: 5, name: 'Graphenium' },
        { id: 136, enabled: true, minAmount: 2, name: 'Tiridium Alloy' },
        { id: 99, enabled: false, minAmount: 1, name: 'Composite Truss' }
      ]
    }
  );
  assert.deepEqual(batch, [
    {
      id: 172,
      name: 'Graphenium',
      current: 10,
      minAmount: 5,
      canSend: true
    }
  ]);
});

test('normalizeOutboundWhitelist 会去重、过滤非法项并补全名称', () => {
  const api = createGtAutopilot();
  const whitelist = api.normalizeOutboundWhitelist(
    [
      { id: 172, enabled: true, minAmount: 0 },
      { id: '172', enabled: false, minAmount: 8 },
      { id: -1, enabled: true, minAmount: 2 },
      { id: 136, enabled: false, minAmount: '3' },
      { id: 'abc', enabled: true, minAmount: 1 }
    ],
    {
      172: 'Graphenium',
      136: 'Tiridium Alloy'
    }
  );

  assert.deepEqual(whitelist.map((entry) => ({
    id: entry.id,
    enabled: entry.enabled,
    minAmount: entry.minAmount,
    name: entry.name,
    iconId: entry.iconId
  })), [
    {
      id: 172,
      enabled: true,
      minAmount: 1,
      name: 'Graphenium',
      iconId: 'Graphenium'
    },
    {
      id: 136,
      enabled: false,
      minAmount: 3,
      name: 'Tiridium Alloy',
      iconId: 'TiridiumAlloy'
    }
  ]);
});

test('物资配置项会标准化并保存图标字段', () => {
  const api = createGtAutopilot();

  assert.deepEqual(api.getMaterialIconMeta(113), {
    iconId: 'ShipRepairKit',
    iconHref: '/assets/atlas-_p6d2Xs0.svg#ShipRepairKit'
  });
  assert.deepEqual(api.getMaterialIconMeta(149), {
    iconId: 'Antimatter',
    iconHref: '/assets/atlas-_p6d2Xs0.svg#Antimatter'
  });
  assert.deepEqual(api.getMaterialIconMeta(80), {
    iconId: 'Superconductors',
    iconHref: '/assets/atlas-_p6d2Xs0.svg#Superconductors'
  });

  const normalized = api.normalizeMaterialBlocklist([
    { id: 113, enabled: true, name: 'Ship Repair Kit', iconId: 'CustomRepair', iconHref: '/x.svg#CustomRepair' }
  ], api.constants.materialNames);

  assert.deepEqual(normalized, [
    { id: 113, enabled: true, name: 'Ship Repair Kit', iconId: 'CustomRepair', iconHref: '/x.svg#CustomRepair' }
  ]);
});

test('collectBatchFromWarehouse 可从任意仓库按白名单生成批次', () => {
  const api = createGtAutopilot();
  const batch = api.collectBatchFromWarehouse(
    {
      mats: [
        { id: 172, am: 6 },
        { id: 136, am: 10 }
      ]
    },
    {
      outboundWhitelist: [
        { id: 172, enabled: true, minAmount: 5, name: 'Graphenium' },
        { id: 136, enabled: true, minAmount: 12, name: 'Tiridium Alloy' }
      ]
    }
  );

  assert.deepEqual(batch, [
    {
      id: 172,
      name: 'Graphenium',
      current: 6,
      minAmount: 5,
      canSend: true
    }
  ]);
});

test('collectBatchFromWarehouse 会优先使用当前物资表名称覆盖旧白名单名称', () => {
  const api = createGtAutopilot();
  const batch = api.collectBatchFromWarehouse(
    {
      mats: [
        { id: 80, am: 18240 }
      ]
    },
    {
      outboundWhitelist: [
        { id: 80, enabled: true, minAmount: 1, name: 'Superconductors' }
      ]
    }
  );

  assert.deepEqual(batch, [
    {
      id: 80,
      name: 'Graphenium Wire',
      current: 18240,
      minAmount: 1,
      canSend: true
    }
  ]);
});

test('inferShipLocation 会根据仓库、星球与 flight 判断位置', () => {
  const api = createGtAutopilot();
  const base = { id: 9, warehouseId: 101, planetId: 501 };
  const company = {
    exWhId: 202,
    ships: [
      { id: 1, warehouseId: 202, pId: 999 },
      { id: 2, warehouseId: 101, pId: 501 },
      { id: 3, warehouseId: 0, pId: 0, flight: { aDate: '2026-06-05T12:00:00Z' } }
    ]
  };

  assert.equal(api.inferShipLocation(company, base).location, 'base');
  assert.equal(api.inferShipLocation({ exWhId: 202, ships: [{ id: 1, warehouseId: 202, pId: 999 }] }, base).location, 'exchange');
  assert.equal(api.inferShipLocation({ exWhId: 202, ships: [{ id: 3, warehouseId: 0, pId: 0, flight: { aDate: '2026-06-05T12:00:00Z' } }] }, base).location, 'transit');
});

test('inferShipLocation 会在 ships 数据不可用时回退读取页面 Ships 列表', () => {
  const api = createGtAutopilot();
  const base = { id: 9, name: '0-冶炼 合金09', warehouseId: 101, planetId: 501 };
  const doc = createShipListDoc([
    { name: '200000 反物质-08', location: '0-冶炼 合金08' },
    { name: '200000 反物质-09', location: 'Exchange Station' },
    { name: '200000 反物质-10', location: 'Exchange Station' }
  ]);

  const result = api.inferShipLocation({ exWhId: 202, ships: [] }, base, doc);

  assert.equal(result.location, 'exchange');
  assert.deepEqual(result.ship, { name: '200000 反物质-09', locationText: 'Exchange Station' });
});

test('inferShipLocation 的页面回退会优先匹配当前基地名', () => {
  const api = createGtAutopilot();
  const base = { id: 9, name: '0-冶炼 合金09', warehouseId: 101, planetId: 501 };
  const doc = createShipListDoc([
    { name: '200000 反物质-01', location: '0-冶炼 合金09' },
    { name: '200000 反物质-09', location: 'Exchange Station' }
  ]);

  const result = api.inferShipLocation({ exWhId: 202, ships: [] }, base, doc);

  assert.equal(result.location, 'base');
  assert.deepEqual(result.ship, { name: '200000 反物质-01', locationText: '0-冶炼 合金09' });
});

test('inferShipLocation 的页面回退会优先匹配基地对应编号的飞船', () => {
  const api = createGtAutopilot();
  const base = { id: 9, name: '0-冶炼 合金09', warehouseId: 101, planetId: 501 };
  const doc = createShipListDoc([
    { name: '200000 反物质-01', location: '0-冶炼 合金01' },
    { name: '200000 反物质-02', location: 'Exchange Station' },
    { name: '200000 反物质-09', location: 'Exchange Station' }
  ]);

  const result = api.inferShipLocation({ exWhId: 202, ships: [] }, base, doc);

  assert.equal(result.location, 'exchange');
  assert.deepEqual(result.ship, { name: '200000 反物质-09', locationText: 'Exchange Station' });
});

test('findDestinationSuggestionByText 会优先命中飞船弹窗下拉项', () => {
  const api = createGtAutopilot();
  const dropdownItem = { textContent: 'Exchange Station', dataset: { role: 'dropdown' } };
  const shipListItem = { textContent: 'Exchange Station', dataset: { role: 'ship-list' } };
  const doc = createQueryDoc({
    '#daInputField + ul.dropdown-menu.show li.dropdown-item, #daInputField + ul.dropdown-menu.show li[role="button"]': [dropdownItem],
    'div,li,button,a': [shipListItem]
  });

  const result = api.findDestinationSuggestionByText(doc, 'Exchange Station');

  assert.equal(result, dropdownItem);
});

test('findButtonByIconHref 可按图标 href 找到确认按钮', () => {
  const api = createGtAutopilot();
  const cancelButton = { innerHTML: '<use xlink:href="/assets/atlas.svg#xmark"></use>' };
  const confirmButton = { innerHTML: '<use xlink:href="/assets/atlas.svg#check"></use>' };
  const doc = createQueryDoc({
    'button': [cancelButton, confirmButton]
  });

  const result = api.findButtonByIconHref(doc, '#check');

  assert.equal(result, confirmButton);
});

test('findUnloadOnArrivalCheckbox 会优先命中 showUOA 开关', () => {
  const api = createGtAutopilot();
  const checkbox = { id: 'showUOA', checked: false };
  const doc = {
    getElementById(id) {
      return id === 'showUOA' ? checkbox : null;
    },
    querySelectorAll() {
      return [];
    }
  };

  const result = api.findUnloadOnArrivalCheckbox(doc);

  assert.equal(result, checkbox);
});

test('resolveAutoWaitMs 会根据飞船位置选择轮询间隔', () => {
  const api = createGtAutopilot();
  assert.equal(api.resolveAutoWaitMs({ shipInfo: { location: 'transit' } }), 30000);
  assert.equal(api.resolveAutoWaitMs({ shipInfo: { location: 'base' } }), 15000);
  assert.equal(api.resolveAutoWaitMs({ shipInfo: { location: 'exchange' } }), 15000);
});

test('resolveLoopWaitMs 会优先使用链路结果自带的等待时间', () => {
  const api = createGtAutopilot();
  assert.equal(
    api.resolveLoopWaitMs({ shipInfo: { location: 'base' } }, { waitMs: 30000 }),
    30000
  );
  assert.equal(
    api.resolveLoopWaitMs({ shipInfo: { location: 'transit' } }, null),
    30000
  );
  assert.equal(
    api.resolveLoopWaitMs({ shipInfo: { location: 'exchange' } }, {}),
    15000
  );
});

test('resolveStatusText 会在自动模式空闲时保持自动中', () => {
  const api = createGtAutopilot();
  assert.equal(
    api.resolveStatusText({ running: false, autoLoopEnabled: true }),
    '自动中'
  );
  assert.equal(
    api.resolveStatusText({ running: true, autoLoopEnabled: true }),
    '运行中'
  );
  assert.equal(
    api.resolveStatusText({ running: false, autoLoopEnabled: false }),
    '就绪'
  );
});

test('findPriceForMaterial 会优先按 matId 匹配价格', () => {
  const api = createGtAutopilot();
  const prices = [
    { id: 1, matId: 12, price: 110 },
    { id: 2, matId: 172, price: 4200 }
  ];

  assert.deepEqual(api.findPriceForMaterial(prices, 172), { id: 2, matId: 172, price: 4200 });
  assert.equal(api.findPriceForMaterial(prices, 999), null);
});
