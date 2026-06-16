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

function createExchangeShipWarehouseTabsDoc(entries) {
  const selected = entries.find((entry) => entry.checked) || entries[0];
  return {
    querySelectorAll(selector) {
      if (selector === 'li.list-group-item.list-group-item-hover.list-group-item-dark') {
        return [];
      }
      if (selector === 'input[id^="btnradio-whwt"]') {
        return entries.map((entry) => ({
          id: entry.id,
          checked: entry === selected,
        }));
      }
      if (selector === 'label[for^="btnradio-whwt"]') {
        return entries.map((entry) => ({
          textContent: entry.name,
          innerText: entry.name,
          getAttribute(name) {
            return name === 'for' ? entry.id : '';
          },
          getClientRects() {
            return [{}];
          }
        }));
      }
      return [];
    },
    getElementById(id) {
      const match = entries.find((entry) => entry.id === id);
      return match ? { id: match.id, checked: match === selected } : null;
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

function createVisibleButton(text, onClick, html) {
  return {
    textContent: text || '',
    innerText: text || '',
    innerHTML: html || text || '',
    getClientRects() {
      return [{}];
    },
    scrollIntoView() {},
    click() {
      if (onClick) {
        onClick();
      }
    }
  };
}

function createResupplyWorkflowDoc(order, options = {}) {
  const state = {
    page: options.page || 'exchange',
    selectedBase: !!options.selectedBase,
    days: options.days || 7,
    added: false,
    checkedCount: 0,
  };
  const baseButton = createVisibleButton('Base', () => {
    order.push('base');
    state.page = 'base';
  });
  const baseListButton = {
    className: 'list-group-item',
    textContent: options.baseName || '0-冶炼 合金09',
    innerText: options.baseName || '0-冶炼 合金09',
    getClientRects() {
      return [{}];
    },
    scrollIntoView() {},
    click() {
      order.push('select-base');
      state.selectedBase = true;
      state.page = 'base';
    }
  };
  const resupplyButton = createVisibleButton('Resupply', () => {
    order.push('resupply');
    state.page = 'resupply';
  });
  const addButton = createVisibleButton('Add to Wishlist', () => {
    order.push('add:' + state.days);
    state.added = true;
  });
  const daysInput = {
    id: options.daysInputId || '',
    type: 'number',
    value: String(state.days),
    min: options.daysMin || '',
    max: options.daysMax || '',
    step: options.daysStep || '',
    getAttribute(name) {
      if (options.noDaysHint) {
        return '';
      }
      return name === 'aria-label' ? 'days' : '';
    },
    focus() {},
    dispatchEvent() {},
  };
  const checkboxes = [0, 1, 2].map((index) => ({
    checked: !!options.initiallyChecked,
    getClientRects() {
      return [{}];
    },
    scrollIntoView() {},
    click() {
      order.push('check:' + index);
      this.checked = true;
      state.checkedCount += 1;
    }
  }));
  const slider = {
    id: 'resupplySlider',
    type: 'range',
    min: '0',
    max: '100',
    step: '1',
    value: String(state.days * 10),
    getAttribute() {
      return '';
    },
    focus() {},
    dispatchEvent() {},
  };

  Object.defineProperty(daysInput, 'value', {
    get() {
      return String(state.days);
    },
    set(value) {
      state.days = Number(value);
      if (options.uncheckOnDaysChange) {
        checkboxes.forEach((checkbox) => {
          checkbox.checked = false;
        });
      }
      order.push('days:' + state.days);
    }
  });
  Object.defineProperty(slider, 'value', {
    get() {
      return String(state.days * 10);
    },
    set(value) {
      order.push('slider:' + value);
      if (options.sliderMutatesDays) {
        state.days = Number(value) / 10 + 0.1;
        order.push('slider-days:' + state.days);
      }
    }
  });

  return {
    state,
    body: {
      get textContent() {
        const configuredWeight = options.weightByDays && Object.prototype.hasOwnProperty.call(options.weightByDays, String(state.days))
          ? options.weightByDays[String(state.days)]
          : state.days * (options.weightPerDay || 30);
        const totalWeight = Math.ceil(configuredWeight);
        return 'TOTAL WEIGHT ' + totalWeight + ' TOTAL COST ' + Math.ceil(state.days * 100);
      }
    },
    getElementById(id) {
      if (id === 'days' && options.daysInputId === 'days' && state.page === 'resupply') {
        return daysInput;
      }
      if (id === 'resupplySlider' && options.includeSlider && state.page === 'resupply') {
        return slider;
      }
      return null;
    },
    querySelectorAll(selector) {
      if (selector === 'button, a, [role="button"], [role="tab"]') {
        const buttons = [];
        if (state.page !== 'base') {
          buttons.push(baseButton);
        }
        if (state.page === 'base' || state.page === 'resupply') {
          buttons.push(baseButton);
          if (!options.hideResupplyButton) {
            buttons.push(resupplyButton);
          }
        }
        if (state.page === 'resupply') {
          buttons.push(addButton);
        }
        return buttons;
      }
      if (selector === 'button.list-group-item, a.list-group-item, [role="button"].list-group-item') {
        return state.selectedBase ? [] : [baseListButton];
      }
      if (selector === 'input[type="checkbox"]') {
        return state.page === 'resupply' ? checkboxes : [];
      }
      if (selector === 'input[type="number"], input') {
        return state.page === 'resupply' ? (options.includeSlider ? [slider, daysInput] : [daysInput]) : [];
      }
      return [];
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

function createWishlistPageBuyDoc(order, options = {}) {
  const state = {
    page: options.page || 'resupply',
    selectedMaterial: null,
    panelTitle: '',
    rows: (options.rows || [
      { name: 'Bioxene', amount: 16616 },
      { name: 'Kryon', amount: 83080 }
    ]).map((row) => ({ ...row })),
  };
  const location = options.location || {
    href: 'https://g2.galactictycoons.com/base/16731?tab=info&otab=resupply&bt=14',
    pathname: '/base/16731'
  };
  const viewWishlistButton = createVisibleButton('View Wishlist (' + state.rows.length + ')', () => {
    order.push('view-wishlist');
    state.page = 'exchange-wishlist';
    location.href = 'https://g2.galactictycoons.com/exchange/22?tab=exchange&mtab=wishlist&wishlistId=877';
    location.pathname = '/exchange/22';
  });
  const quantityInput = {
    id: 'inputQuantity',
    type: 'number',
    value: '',
    getAttribute(name) {
      return name === 'aria-label' ? 'Quantity' : '';
    },
    getClientRects() {
      return state.selectedMaterial ? [{}] : [];
    },
    focus() {},
    dispatchEvent(event) {
      if (!event || event.type === 'input') {
        order.push('amount:' + this.value);
      }
    }
  };
  const buyButton = createVisibleButton('Buy', () => {
    const selected = state.rows.find((row) => row.name === state.selectedMaterial);
    order.push('buy:' + state.selectedMaterial + ':' + quantityInput.value);
    if (!options.keepRowsAfterBuy) {
      state.rows = state.rows.filter((row) => row.name !== state.selectedMaterial);
    }
    state.selectedMaterial = null;
    state.panelTitle = '';
    quantityInput.value = '';
    if (!selected) {
      throw new Error('unexpected buy');
    }
  }, '<svg><use href="#down-to-bracket"></use></svg> Buy');
  buyButton.id = 'exBuyButton';

  function createWishlistRow(row) {
    return {
      textContent: row.name + ' ' + row.amount + ' 255.00$',
      innerText: row.name + ' ' + row.amount + ' 255.00$',
      getClientRects() {
        return [{}];
      },
      querySelectorAll(selector) {
        if (selector === 'input[type="number"], input') {
          return [{
            type: 'number',
            value: String(row.amount),
            getClientRects() {
              return [{}];
            }
          }];
        }
        return [];
      },
      click() {
        order.push('wishlist-row:' + row.name);
        state.selectedMaterial = row.name;
        state.panelTitle = (options.panelTitleByName && options.panelTitleByName[row.name]) || row.name;
        quantityInput.value = String(row.amount);
      }
    };
  }
  const titleNode = {
    get textContent() {
      return state.panelTitle ? state.panelTitle + ' Buy Sell' : '';
    },
    get innerText() {
      return state.panelTitle ? state.panelTitle + ' Buy Sell' : '';
    },
    getClientRects() {
      return state.panelTitle ? [{}] : [];
    },
    closest() {
      return null;
    }
  };
  const tradeCard = {
    id: 'exchangeTradeMatCard',
    get textContent() {
      return state.panelTitle ? state.panelTitle + ' Buy Sell Quantity Price Weight Buy' : '';
    },
    get innerText() {
      return this.textContent;
    },
    getClientRects() {
      return state.selectedMaterial ? [{}] : [];
    },
    querySelectorAll(selector) {
      if (selector === 'h1,h2,h3,h4,h5,.card-header,.card-title,.text-uppercase,.fw-bold') {
        return state.selectedMaterial ? [titleNode] : [];
      }
      return [];
    }
  };

  return {
    state,
    body: { textContent: '' },
    getElementById(id) {
      if (id === 'inputQuantity') {
        return quantityInput;
      }
      if (id === 'exBuyButton' && state.selectedMaterial) {
        return buyButton;
      }
      if (id === 'exchangeTradeMatCard' && state.selectedMaterial) {
        return tradeCard;
      }
      return null;
    },
    querySelectorAll(selector) {
      if (selector === 'button, a, [role="button"], [role="tab"]') {
        return state.page === 'resupply' ? [viewWishlistButton] : [buyButton];
      }
      if (selector === 'tr, [role="row"], .mat-row, .mat-item') {
        return state.page === 'exchange-wishlist' ? state.rows.map(createWishlistRow) : [];
      }
      if (selector === 'input[type="number"], input') {
        return state.selectedMaterial ? [quantityInput] : [];
      }
      if (selector === 'button') {
        return state.selectedMaterial ? [buyButton] : [];
      }
      if (selector === 'h1,h2,h3,h4,h5,.card-header,.card-title,.text-uppercase,.fw-bold') {
        return state.selectedMaterial ? [titleNode] : [];
      }
      return [];
    },
    querySelector() {
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
  const constructionSellButton = {
    textContent: '',
    innerHTML: '<svg class="iu"><use xlink:href="/assets/atlas-CfGX3EZO.svg#sack-dollar"></use></svg>',
    clicked: false,
    getClientRects() {
      return [{}];
    },
    click() {
      this.clicked = true;
    }
  };
  const rationsSellButton = {
    textContent: '',
    innerHTML: '<svg class="iu"><use xlink:href="/assets/atlas-CfGX3EZO.svg#sack-dollar"></use></svg>',
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
  const constructionRow = {
    textContent: 'Construction Kit 3,595 7,190t $5.4m',
    querySelectorAll(selector) {
      return selector === 'button' ? [constructionSellButton] : [];
    }
  };
  const rationsRow = {
    textContent: 'Rations 125,722 12,572t $6.3m',
    querySelectorAll(selector) {
      return selector === 'button' ? [rationsSellButton] : [];
    }
  };
  return {
    repairBuyButton,
    containmentBuyButton,
    containmentSellButton,
    constructionSellButton,
    rationsSellButton,
    querySelectorAll(selector) {
      if (selector === 'tr, [role="row"], .mat-row, .mat-item') {
        return [repairRow, containmentRow, constructionRow, rationsRow];
      }
      return [];
    }
  };
}

function createExchangeWarehouseTransferAllDoc(order, options = {}) {
  const state = {
    selectedShip: options.initialShip || '200000 反物质-01',
    stuckSelectedShip: options.stuckSelectedShip || '',
    totalTransferClicked: false,
    rowTransferClicked: false,
    returnClicked: [],
    rowTransferClickedNames: [],
    pendingConfirm: null,
    confirmClickedNames: [],
  };
  const shipNames = options.shipNames || ['200000 反物质-01', '200000 反物质-09'];
  function shipInputId(name) {
    return 'btnradio-whwt-' + name;
  }
  function createShipLabel(name) {
    return {
      textContent: name,
      innerText: name,
      className: state.selectedShip === name ? 'btn active' : 'btn',
      getClientRects() {
        return [{}];
      },
      getAttribute(nameAttr) {
        return nameAttr === 'for' ? shipInputId(name) : '';
      },
      scrollIntoView() {},
      click() {
        order.push('ship:' + name);
        if (!state.stuckSelectedShip) {
          state.selectedShip = name;
        }
      }
    };
  }
  function createShipInput(name) {
    return {
      id: shipInputId(name),
      checked: state.selectedShip === name,
    };
  }
  const totalTransferButton = createVisibleButton('', () => {
    order.push('transfer-all:' + state.selectedShip);
    state.totalTransferClicked = true;
  }, '<svg><use href="/assets/atlas.svg#arrow-right"></use></svg>');
  totalTransferButton.parentElement = {
    textContent: '197,893 / 393,000t',
    innerText: '197,893 / 393,000t',
    parentElement: null
  };
  totalTransferButton.closest = (selector) => {
    if (selector === 'tr,[role="row"],.mat-row,.mat-item') {
      return null;
    }
    return null;
  };
  function createExchangeRow(row) {
    const rowTransferButton = createVisibleButton('', () => {
      order.push('row-transfer:' + row.name);
      state.rowTransferClicked = true;
      state.rowTransferClickedNames.push(row.name);
      state.pendingConfirm = row.name;
    }, '<svg><use href="/assets/atlas.svg#arrow-right"></use></svg>');
    const exchangeRow = {
      textContent: row.name + ' ' + row.amount + ' ' + row.weight + 't',
      innerText: row.name + ' ' + row.amount + ' ' + row.weight + 't',
      getClientRects() {
        return [{}];
      },
      querySelectorAll(selector) {
        return selector === 'button' ? [rowTransferButton] : [];
      }
    };
    rowTransferButton.closest = (selector) => {
      if (selector === 'tr,[role="row"],.mat-row,.mat-item') {
        return exchangeRow;
      }
      return null;
    };
    return exchangeRow;
  }
  function createShipRow(row) {
    const returnButton = createVisibleButton('', () => {
      order.push('return:' + row.name);
      state.returnClicked.push(row.name);
    }, '<svg><use href="/assets/atlas.svg#arrow-left"></use></svg>');
    return {
      textContent: row.name + ' ' + row.amount + ' ' + row.weight + 't',
      innerText: row.name + ' ' + row.amount + ' ' + row.weight + 't',
      getClientRects() {
        return [{}];
      },
      querySelectorAll(selector) {
        return selector === 'button' ? [returnButton] : [];
      }
    };
  }
  const exchangeRows = (options.exchangeRows || [
    { name: 'Ship Repair Kit', amount: '2,000', weight: '1,500' },
    { name: 'Antimatter', amount: '2,994', weight: '8,982' },
    { name: 'Workwear', amount: '17,808', weight: '1,781' },
    { name: 'Kryon', amount: '83,080', weight: '62,310' },
    { name: 'Bioxene', amount: '16,616', weight: '16,616' }
  ]).map(createExchangeRow);
  const shipRows = (options.shipRows || [
    { name: 'Ship Repair Kit', amount: '2,000', weight: '1,500' },
    { name: 'Antimatter', amount: '2,994', weight: '8,982' },
    { name: 'Bioxene', amount: '16,616', weight: '16,616' }
  ]).map(createShipRow);
  const confirmButton = createVisibleButton('', () => {
    order.push('confirm:' + state.pendingConfirm);
    state.confirmClickedNames.push(state.pendingConfirm);
    state.pendingConfirm = null;
  }, '<svg><use href="/assets/atlas.svg#check"></use></svg>');
  return {
    state,
    getElementById() {
      return null;
    },
    querySelectorAll(selector) {
      if (selector === 'input[id^="btnradio-whwt"]') {
        return shipNames.map(createShipInput);
      }
      if (selector === 'label[for^="btnradio-whwt"]') {
        return shipNames.map(createShipLabel);
      }
      if (selector === 'button') {
        return [totalTransferButton]
          .concat(exchangeRows.flatMap((row) => row.querySelectorAll('button')))
          .concat(state.pendingConfirm ? [confirmButton] : []);
      }
      if (selector === 'tr, [role="row"]' || selector === 'tr, [role="row"], .mat-row, .mat-item') {
        return exchangeRows.concat(shipRows);
      }
      return [];
    },
    getElementById(id) {
      const name = shipNames.find((shipName) => shipInputId(shipName) === id);
      return name ? createShipInput(name) : null;
    },
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

function createDelayedShipMaintenanceDoc(options = {}) {
  const events = [];
  let popupOpen = false;
  let popupQueries = 0;
  const triggerText = options.mode === 'repair' ? 'Repair' : 'Refuel';
  const amountInput = {
    type: 'number',
    value: '',
    max: options.max || (options.mode === 'repair' ? '1900' : '2956'),
    getAttribute(name) {
      return name === 'max' ? this.max : '';
    },
    focus() {},
    dispatchEvent() {}
  };
  const trigger = {
    textContent: triggerText,
    innerText: triggerText,
    clicked: false,
    getClientRects() {
      return [{}];
    },
    click() {
      this.clicked = true;
      events.push('click:' + triggerText);
    }
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
      events.push('confirm:' + amountInput.value);
    }
  };
  const popup = {
    textContent: options.mode === 'repair' ? 'Repair ship Warehouse1,900' : 'Refuel ship Warehouse2,956',
    innerText: options.mode === 'repair' ? 'Repair ship Warehouse1,900' : 'Refuel ship Warehouse2,956',
    querySelectorAll(selector) {
      if (selector === 'input[type="number"], input') {
        return [amountInput];
      }
      if (selector === 'button') {
        return [confirmButton];
      }
      return [];
    }
  };
  const unrelatedPopup = {
    textContent: 'Ship detail tooltip',
    innerText: 'Ship detail tooltip',
    querySelectorAll() {
      return [];
    }
  };
  return {
    events,
    trigger,
    amountInput,
    confirmButton,
    querySelectorAll(selector) {
      if (selector === 'button[data-popup-id="shipRefuel"]' || selector === 'button[data-popup-id="shipRepair"]') {
        return [];
      }
      if (selector === '.modal.show, .modal') {
        return [{ textContent: 'Ship info ' + triggerText, querySelectorAll: this.querySelectorAll.bind(this) }];
      }
      if (selector === 'button') {
        return [trigger];
      }
      if (selector === '.popover') {
        popupQueries += 1;
        if (options.unrelatedPopoverFirst && popupQueries === 1) {
          return [unrelatedPopup];
        }
        if (!popupOpen && popupQueries >= 2) {
          popupOpen = true;
        }
        return popupOpen ? [popup] : [];
      }
      return [];
    }
  };
}

function createRepairWithStaleFuelPopoverDoc() {
  const events = [];
  let repairClicked = false;
  let popupQueries = 0;
  const staleFuelInput = {
    type: 'number',
    value: '',
    max: '2923',
    getAttribute(name) {
      return name === 'max' ? this.max : '';
    },
    getClientRects() {
      return [{}];
    },
    focus() {},
    dispatchEvent() {}
  };
  const repairInput = {
    type: 'number',
    value: '',
    max: '1900',
    getAttribute(name) {
      return name === 'max' ? this.max : '';
    },
    getClientRects() {
      return [{}];
    },
    focus() {},
    dispatchEvent() {}
  };
  const staleFuelPopup = {
    textContent: 'Refuel ship Tank173 / 210 Warehouse2,923',
    innerText: 'Refuel ship Tank173 / 210 Warehouse2,923',
    querySelectorAll(selector) {
      if (selector === 'input[type="number"], input') {
        return [staleFuelInput];
      }
      if (selector === 'button') {
        return [{
          textContent: '',
          innerText: '',
          className: 'btn btn-primary',
          getClientRects() {
            return [{}];
          },
          click() {
            events.push('confirm:stale-fuel:' + staleFuelInput.value);
          }
        }];
      }
      return [];
    }
  };
  const repairPopup = {
    textContent: 'Repair ship Condition98.7% 100.0% Kits to full100 Warehouse1,900',
    innerText: 'Repair ship Condition98.7% 100.0% Kits to full100 Warehouse1,900',
    querySelectorAll(selector) {
      if (selector === 'input[type="number"], input') {
        return [repairInput];
      }
      if (selector === 'button') {
        return [{
          textContent: '',
          innerText: '',
          className: 'btn btn-primary',
          getClientRects() {
            return [{}];
          },
          click() {
            events.push('confirm:repair:' + repairInput.value);
          }
        }];
      }
      return [];
    }
  };
  const repairButton = {
    textContent: 'Repair',
    innerText: 'Repair',
    getClientRects() {
      return [{}];
    },
    click() {
      repairClicked = true;
      events.push('click:Repair');
    }
  };
  return {
    events,
    querySelectorAll(selector) {
      if (selector === 'button[data-popup-id="shipRefuel"]' || selector === 'button[data-popup-id="shipRepair"]') {
        return [];
      }
      if (selector === '.modal.show, .modal') {
        return [{ textContent: 'Ship info Repair', querySelectorAll: this.querySelectorAll.bind(this) }];
      }
      if (selector === 'button') {
        return [repairButton];
      }
      if (selector === '.popover') {
        popupQueries += 1;
        if (!repairClicked || popupQueries <= 1) {
          return [staleFuelPopup];
        }
        return [staleFuelPopup, repairPopup];
      }
      return [];
    }
  };
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

function createShipDetailTabsDoc() {
  const events = [];
  const state = {
    selectedShip: '200000 反物质-01',
  };
  const names = ['200000 反物质-01', '200000 反物质-02'];
  const tabButtons = names.map((name) => ({
    textContent: name,
    innerText: name,
    getClientRects() {
      return [{}];
    },
    click() {
      state.selectedShip = name;
      events.push('tab:' + name);
    }
  }));
  const detailPanel = {
    get textContent() {
      return state.selectedShip + ' Exchange Station Refuel Repair Start flight';
    },
    get innerText() {
      return this.textContent;
    },
    querySelectorAll(selector) {
      if (selector === 'button, a, label, [role="tab"], [role="button"], .nav-link, .btn') {
        return tabButtons;
      }
      return [];
    }
  };
  const modal = {
    get textContent() {
      return names.join(' ') + ' ' + detailPanel.textContent;
    },
    get innerText() {
      return this.textContent;
    },
    querySelectorAll(selector) {
      if (selector === '.modal.show, .modal, [role="dialog"], .offcanvas.show, .card, .panel') {
        return [detailPanel];
      }
      if (selector === 'button, a, label, [role="tab"], [role="button"], .nav-link, .btn') {
        return tabButtons;
      }
      return [];
    }
  };
  return {
    events,
    querySelectorAll(selector) {
      if (selector === '.modal.show, .modal') {
        return [modal];
      }
      if (selector === '.modal.show, .modal, [role="dialog"], .offcanvas.show, .card, .panel') {
        return [modal, detailPanel];
      }
      if (selector === 'span.link-primary, .link-primary') {
        return [];
      }
      if (selector === 'label[for^="btnradio-whwt"]') {
        return [];
      }
      return [];
    }
  };
}

function createShipWarehouseCargoPanelDoc() {
  const events = [];
  const warehouseTab = {
    textContent: '200000 反物质-01',
    innerText: '200000 反物质-01',
    getClientRects() {
      return [{}];
    },
    getAttribute(name) {
      return name === 'for' ? 'btnradio-whwt16159' : '';
    },
    click() {
      events.push('warehouse-tab:200000 反物质-01');
    }
  };
  const shipNameLink = {
    textContent: '200000 反物质-01',
    innerText: '200000 反物质-01',
    className: 'link-primary fw-bold me-2',
    getAttribute(name) {
      return name === 'role' ? 'button' : '';
    },
    getClientRects() {
      return [{}];
    },
    click() {
      events.push('ship-link:200000 反物质-01');
    }
  };
  const warehousePanel = {
    textContent: '200000 反物质-01 Exchange Station 187,411 / 200,000t MATERIAL QUANTITY WEIGHT VALUE Advanced Tools Bioxene',
    innerText: '200000 反物质-01 Exchange Station 187,411 / 200,000t MATERIAL QUANTITY WEIGHT VALUE Advanced Tools Bioxene',
    querySelectorAll(selector) {
      if (selector === 'button, a, label, [role="tab"], [role="button"], .nav-link, .btn') {
        return [warehouseTab, shipNameLink];
      }
      return [];
    }
  };
  return {
    events,
    querySelectorAll(selector) {
      if (selector === '.modal.show, .modal') {
        return [warehousePanel];
      }
      if (selector === '[role="dialog"]' || selector === '.offcanvas.show' || selector === '.panel') {
        return [];
      }
      if (selector === '.card') {
        return [warehousePanel];
      }
      if (selector === 'span.link-primary, .link-primary') {
        return [shipNameLink];
      }
      if (selector === 'label[for^="btnradio-whwt"]') {
        return [warehouseTab];
      }
      return [];
    }
  };
}

function createMultiShipMaintenanceDoc(entries) {
  const events = [];
  const state = {
    currentShip: '',
    currentLocation: '',
    popupOpen: false,
    mode: '',
  };
  const ships = entries.map((entry) => ({
    name: entry.name,
    location: entry.location || 'Exchange Station',
    link: {
      textContent: entry.name,
      innerText: entry.name,
      getClientRects() {
        return [{}];
      },
      click() {
        state.currentShip = entry.name;
        state.currentLocation = entry.location || '';
        state.popupOpen = false;
        events.push('open:' + entry.name);
      }
    }
  }));
  const shipWarehouseLabels = ships.map((ship) => ({
    textContent: ship.name,
    innerText: ship.name,
    getClientRects() {
      return [{}];
    },
    click() {
      state.currentShip = ship.name;
      state.currentLocation = ship.location || '';
      state.popupOpen = false;
      events.push('warehouse-tab:' + ship.name);
    }
  }));
  const amountInput = {
    type: 'number',
    value: '',
    get max() {
      return state.mode === 'repair' ? '1900' : '2956';
    },
    getAttribute(name) {
      return name === 'max' ? this.max : '';
    },
    focus() {},
    dispatchEvent() {}
  };
  const confirmButton = {
    textContent: '',
    innerText: '',
    className: 'btn btn-primary',
    getClientRects() {
      return [{}];
    },
    click() {
      events.push('confirm:' + state.currentShip + ':' + state.mode + ':' + amountInput.value);
      state.popupOpen = false;
    }
  };
  const fuelButton = {
    textContent: 'Refuel',
    innerText: 'Refuel',
    getClientRects() {
      return [{}];
    },
    click() {
      state.mode = 'fuel';
      state.popupOpen = true;
      amountInput.value = '';
      events.push('trigger:' + state.currentShip + ':fuel');
    }
  };
  const repairButton = {
    textContent: 'Repair',
    innerText: 'Repair',
    getClientRects() {
      return [{}];
    },
    click() {
      state.mode = 'repair';
      state.popupOpen = true;
      amountInput.value = '';
      events.push('trigger:' + state.currentShip + ':repair');
    }
  };
  const popup = {
    get textContent() {
      return state.mode === 'repair'
        ? 'Repair ship Warehouse1,900'
        : 'Refuel ship Warehouse2,956';
    },
    get innerText() {
      return this.textContent;
    },
    querySelectorAll(selector) {
      if (selector === 'input[type="number"], input') {
        return [amountInput];
      }
      if (selector === 'button') {
        return [confirmButton];
      }
      return [];
    }
  };
  return {
    events,
    getElementById() {
      return null;
    },
    querySelectorAll(selector) {
      if (selector === 'li.list-group-item.list-group-item-hover.list-group-item-dark') {
        return ships.map((ship) => ({
          querySelector(childSelector) {
            if (childSelector === 'span.link-primary.cursor-pointer.text-truncate') {
              return { textContent: ship.name };
            }
            if (childSelector === 'div.text-body-secondary.small span.cursor-pointer.link-light') {
              return { textContent: ship.location };
            }
            if (childSelector === 'div.text-body-secondary.small') {
              return { textContent: ship.location };
            }
            return null;
          }
        }));
      }
      if (selector === '.modal.show, .modal') {
        return state.currentShip ? [{ textContent: 'Ships ' + state.currentShip + ' ' + state.currentLocation + ' Refuel Repair' + (entries.some((entry) => entry.includeStartFlightText) ? ' Start flight' : '') }] : [];
      }
      if (selector === 'span.link-primary, .link-primary') {
        return entries.some((entry) => entry.hideShipLink) ? [] : ships.map((ship) => ship.link);
      }
      if (selector === 'label[for^="btnradio-whwt"]') {
        return shipWarehouseLabels;
      }
      if (selector === 'button[data-popup-id="shipRefuel"]') {
        return state.currentShip ? [fuelButton] : [];
      }
      if (selector === 'button[data-popup-id="shipRepair"]') {
        return state.currentShip ? [repairButton] : [];
      }
      if (selector === '.popover') {
        return state.popupOpen ? [popup] : [];
      }
      return [];
    }
  };
}

function createShipFlightDoc(options = {}) {
  const events = [];
  const shipWarehouseLabel = {
    textContent: options.shipName || 'Demo Hauler',
    getClientRects() {
      return [{}];
    },
    click() {
      events.push('warehouse-tab');
    }
  };
  const shipInfoLabel = {
    textContent: options.shipName || 'Demo Hauler',
    getClientRects() {
      return [{}];
    },
    click() {
      events.push('info-tab');
    }
  };
  const shipLink = {
    textContent: options.shipName || 'Demo Hauler',
    getClientRects() {
      return [{}];
    },
    click() {
      events.push('ship-panel');
    }
  };
  const destinationInput = {
    id: 'daInputField',
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
        events.push('destination:' + this.value);
      }
    }
  };
  const correctSuggestion = {
    textContent: options.destinationName || '0-冶炼 合金09',
    getClientRects() {
      return [{}];
    },
    click() {
      events.push('suggestion:' + this.textContent);
    }
  };
  const wrongSuggestion = {
    textContent: 'Exchange Station',
    getClientRects() {
      return [{}];
    },
    click() {
      events.push('wrong-suggestion');
    }
  };
  const unloadCheckbox = {
    id: 'showUOA',
    checked: false,
    getAttribute() {
      return '';
    },
    focus() {},
    dispatchEvent(event) {
      if (!event || event.type === 'change') {
        events.push('auto-unload:' + this.checked);
      }
    },
    click() {
      this.checked = !this.checked;
      events.push('auto-unload-click:' + this.checked);
    }
  };
  const startButton = {
    textContent: 'Start flight',
    innerText: 'Start flight',
    getClientRects() {
      return [{}];
    },
    click() {
      events.push('start-flight');
    }
  };
  return {
    events,
    destinationInput,
    unloadCheckbox,
    startButton,
    getElementById(id) {
      if (id === 'daInputField') {
        return options.missingDestinationInput ? null : destinationInput;
      }
      if (id === 'showUOA') {
        return options.missingUnload ? null : unloadCheckbox;
      }
      return null;
    },
    querySelector(selector) {
      if (selector === 'button[data-btn-start-flight]') {
        return options.missingStart ? null : startButton;
      }
      return null;
    },
    querySelectorAll(selector) {
      if (selector === 'label[for^="btnradio-whwt"]') {
        return [shipWarehouseLabel];
      }
      if (selector === 'label[for^="btnradioinfo"]') {
        return [shipInfoLabel];
      }
      if (selector === 'span.link-primary.fw-bold.me-2, span.link-primary.cursor-pointer.text-truncate') {
        return options.missingShipPanel ? [] : [shipLink];
      }
      if (selector === '#daInputField + ul.dropdown-menu.show li.dropdown-item, #daInputField + ul.dropdown-menu.show li[role="button"]') {
        return options.missingSuggestion ? [wrongSuggestion] : [wrongSuggestion, correctSuggestion];
      }
      if (selector === 'input[type="checkbox"]') {
        return options.missingUnload ? [] : [unloadCheckbox];
      }
      if (selector === 'button, a, [role="button"], [role="tab"]') {
        return options.missingStart ? [] : [startButton];
      }
      if (selector === 'input, textarea') {
        return [destinationInput];
      }
      return [];
    }
  };
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
  assert.equal(api.version, '0.1.71');
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

test('一键购买 wishlist 展开面板包含转移黑名单配置并默认保护维修包和反物质', () => {
  const api = createGtAutopilot();
  const html = api._testBuildAtomicActionsHtml();

  assert.match(html, /转移黑名单/);
  assert.ok(html.indexOf('转移黑名单') > html.indexOf('data-atomic-config-panel="buy_wishlist"'));
  assert.ok(html.indexOf('转移黑名单') < html.indexOf('data-wishlist-resupply-steps'));
  assert.match(html, /data-wishlist-transfer-blacklist-row="113"/);
  assert.match(html, /data-wishlist-transfer-blacklist-row="149"/);
  assert.match(html, /Ship Repair Kit \(#113\)/);
  assert.match(html, /Antimatter \(#149\)/);
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

test('原子功能按钮定义合并加油修理并保留修建筑、补材料', () => {
  const api = createGtAutopilot();
  assert.deepEqual(api.getAtomicActions(), [
    { action: 'sell_exchange_inventory', label: '一键卖货', status: 'done' },
    { action: 'buy_wishlist', label: '一键购买 wishlist', status: 'ready' },
    { action: 'fuel_and_repair_ship', label: '一键加油、修理', status: 'ready' },
    { action: 'repair_base_buildings', label: '一键修基地建筑', status: 'ready' },
    { action: 'restock_ship_repair_materials', label: '一键补飞船修理材料', status: 'ready' }
  ]);
});

test('补货回运原子步骤定义按真实流程排序', () => {
  const api = createGtAutopilot();
  assert.deepEqual(api.getWishlistResupplyAtomicSteps(), [
    { action: 'wishlist_read_current_base', label: '读取当前基地', status: 'done' },
    { action: 'wishlist_clear_base_wishlist', label: '清空基地 wishlist', status: 'done' },
    { action: 'wishlist_check_ship_at_exchange', label: '检查飞船在交易所', status: 'done' },
    { action: 'wishlist_create_resupply_wishlist', label: '创建补给 wishlist', status: 'done' },
    { action: 'wishlist_buy_wishlist', label: '购买 wishlist', status: 'done' },
    { action: 'wishlist_transfer_to_ship', label: '转移到飞船', status: 'ready' },
    { action: 'wishlist_fuel_ship', label: '飞船补油修理', status: 'ready' },
    { action: 'wishlist_repair_ship', label: '一键补修理包、油', status: 'ready' },
    { action: 'wishlist_send_ship_home', label: '发船回基地', status: 'ready' }
  ]);
});

test('读取当前基地、清空基地 wishlist、检查飞船在交易所、创建补给 wishlist 和购买 wishlist 标记为已验证，转移到飞船可测试', () => {
  const api = createGtAutopilot();
  const steps = api.getWishlistResupplyAtomicSteps();
  const byAction = Object.fromEntries(steps.map((entry) => [entry.action, entry.status]));

  assert.equal(byAction.wishlist_read_current_base, 'done');
  assert.equal(byAction.wishlist_clear_base_wishlist, 'done');
  assert.equal(byAction.wishlist_check_ship_at_exchange, 'done');
  assert.equal(byAction.wishlist_create_resupply_wishlist, 'done');
  assert.equal(byAction.wishlist_buy_wishlist, 'done');
  assert.equal(byAction.wishlist_open_exchange, undefined);
  assert.equal(byAction.wishlist_read_wishlist, undefined);
  assert.equal(byAction.wishlist_transfer_to_ship, 'ready');
  assert.equal(byAction.wishlist_fuel_ship, 'ready');
  assert.equal(byAction.wishlist_repair_ship, 'ready');
  assert.equal(byAction.wishlist_send_ship_home, 'ready');
});

test('补货回运已验证原子步骤按钮会使用绿色样式', () => {
  const api = createGtAutopilot();
  const html = api._testBuildAtomicActionsHtml();

  assert.match(
    html,
    /data-atomic-action="wishlist_read_current_base"[^>]*data-atomic-status="done"[^>]*style="[^"]*#14b86f/
  );
  assert.match(
    html,
    /data-atomic-action="wishlist_clear_base_wishlist"[^>]*data-atomic-status="done"[^>]*style="[^"]*#14b86f/
  );
  assert.match(
    html,
    /data-atomic-action="wishlist_check_ship_at_exchange"[^>]*data-atomic-status="done"[^>]*style="[^"]*#14b86f/
  );
  assert.match(
    html,
    /data-atomic-action="wishlist_create_resupply_wishlist"[^>]*data-atomic-status="done"[^>]*style="[^"]*#14b86f/
  );
  assert.match(
    html,
    /data-atomic-action="wishlist_buy_wishlist"[^>]*data-atomic-status="done"[^>]*style="[^"]*#14b86f/
  );
  assert.match(html, /读取当前基地[\s\S]*已验证/);
  assert.match(html, /清空基地 wishlist[\s\S]*已验证/);
  assert.match(html, /检查飞船在交易所[\s\S]*已验证/);
  assert.match(html, /创建补给 wishlist[\s\S]*已验证/);
  assert.match(html, /购买 wishlist[\s\S]*已验证/);
  assert.match(html, /转移到飞船[\s\S]*可测试/);
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

test('一键补货回运主流程按 9 个原子步骤完整编排', () => {
  const api = createGtAutopilot();
  assert.deepEqual(api.getWishlistResupplyWorkflowSteps(), api.getWishlistResupplyAtomicSteps().map((entry) => entry.action));
  assert.equal(api.getWishlistResupplyWorkflowSteps().length, 9);
  assert.ok(!api.getWishlistResupplyWorkflowSteps().includes('wishlist_open_exchange'));
  assert.ok(!api.getWishlistResupplyWorkflowSteps().includes('wishlist_read_wishlist'));
});

test('读取当前基地原子步骤入口返回已验证状态', () => {
  const api = createGtAutopilot();
  const result = api.runAtomicAction('wishlist_read_current_base');
  assert.deepEqual(result, {
    action: 'wishlist_read_current_base',
    label: '读取当前基地',
    status: 'done',
    message: '读取当前基地：已验证'
  });
});

test('已验证补货原子步骤入口返回已验证状态，其余可执行步骤返回可测试状态', () => {
  const api = createGtAutopilot();

  assert.deepEqual(api.runAtomicAction('wishlist_clear_base_wishlist'), {
    action: 'wishlist_clear_base_wishlist',
    label: '清空基地 wishlist',
    status: 'done',
    message: '清空基地 wishlist：已验证'
  });
  assert.deepEqual(api.runAtomicAction('wishlist_check_ship_at_exchange'), {
    action: 'wishlist_check_ship_at_exchange',
    label: '检查飞船在交易所',
    status: 'done',
    message: '检查飞船在交易所：已验证'
  });
  assert.deepEqual(api.runAtomicAction('wishlist_create_resupply_wishlist'), {
    action: 'wishlist_create_resupply_wishlist',
    label: '创建补给 wishlist',
    status: 'done',
    message: '创建补给 wishlist：已验证'
  });
  assert.deepEqual(api.runAtomicAction('wishlist_open_exchange'), {
    action: 'wishlist_open_exchange',
    label: '未知原子功能',
    status: 'failed',
    message: '未知原子功能：wishlist_open_exchange'
  });
  assert.deepEqual(api.runAtomicAction('wishlist_read_wishlist'), {
    action: 'wishlist_read_wishlist',
    label: '未知原子功能',
    status: 'failed',
    message: '未知原子功能：wishlist_read_wishlist'
  });
  assert.deepEqual(api.runAtomicAction('wishlist_buy_wishlist'), {
    action: 'wishlist_buy_wishlist',
    label: '购买 wishlist',
    status: 'done',
    message: '购买 wishlist：已验证'
  });
  assert.deepEqual(api.runAtomicAction('wishlist_transfer_to_ship'), {
    action: 'wishlist_transfer_to_ship',
    label: '转移到飞船',
    status: 'ready',
    message: '转移到飞船：可测试'
  });
  assert.deepEqual(api.runAtomicAction('wishlist_fuel_ship'), {
    action: 'wishlist_fuel_ship',
    label: '飞船补油修理',
    status: 'ready',
    message: '飞船补油修理：可测试'
  });
  assert.deepEqual(api.runAtomicAction('wishlist_repair_ship'), {
    action: 'wishlist_repair_ship',
    label: '一键补修理包、油',
    status: 'ready',
    message: '一键补修理包、油：可测试'
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

test('03 检查飞船在交易所标记为已验证并保持检查职责', () => {
  const api = createGtAutopilot();
  const steps = api.getWishlistResupplyAtomicSteps();
  const byAction = Object.fromEntries(steps.map((entry) => [entry.action, entry]));

  assert.deepEqual(byAction.wishlist_check_ship_at_exchange, {
    action: 'wishlist_check_ship_at_exchange',
    label: '检查飞船在交易所',
    status: 'done'
  });
  assert.deepEqual(api.runAtomicAction('wishlist_check_ship_at_exchange'), {
    action: 'wishlist_check_ship_at_exchange',
    label: '检查飞船在交易所',
    status: 'done',
    message: '检查飞船在交易所：已验证'
  });
  assert.throws(
    () => api.planWishlistShipAtExchange({ shipInfo: { location: 'base', ship: { name: 'ship' } } }),
    /飞船不在交易所/
  );
});

test('04 创建补给 wishlist 会回到基地、进 Resupply、全选并按飞船容量下调天数后再添加', async () => {
  const order = [];
  const doc = createResupplyWorkflowDoc(order, {
    page: 'exchange',
    selectedBase: false,
    baseName: '0-冶炼 合金09',
    days: 7,
    weightPerDay: 30
  });
  const api = createGtAutopilot({
    document: doc,
    location: { pathname: '/exchange', href: 'https://g2.galactictycoons.com/exchange' },
    Event: class TestEvent {
      constructor(type) {
        this.type = type;
      }
    },
    setTimeout(resolve) {
      resolve();
    }
  });

  const result = await api._testRunWishlistCreateResupplyWishlist({
    base: { id: 20437, name: '0-冶炼 合金09', planetId: 501 },
    config: { resupplyDays: 7 },
    shipInfo: { location: 'exchange', ship: { name: 'ship', capacity: 100 } },
    company: { cash: 1000000 }
  });

  assert.equal(doc.state.added, true);
  assert.equal(result.reduceResult.days, 3);
  assert.equal(result.reduceResult.weight, 90);
  assert.equal(result.reduceResult.limited, true);
  assert.deepEqual(order, [
    'base',
    'select-base',
    'resupply',
    'days:7',
    'check:0',
    'check:1',
    'check:2',
    'days:3',
    'add:3'
  ]);
});

test('04 创建补给 wishlist 会设置真实游戏的 days 输入框后再添加', async () => {
  const order = [];
  const doc = createResupplyWorkflowDoc(order, {
    page: 'base',
    selectedBase: true,
    baseName: '0-冶炼 合金09',
    days: 5,
    weightPerDay: 535464,
    daysInputId: 'days',
    daysMin: '0.1',
    daysMax: '99',
    daysStep: '0.1',
    noDaysHint: true,
    includeSlider: true
  });
  const api = createGtAutopilot({
    document: doc,
    location: { pathname: '/base/16731', href: 'https://g2.galactictycoons.com/base/16731?tab=info&otab=resupply&bt=14' },
    Event: class TestEvent {
      constructor(type) {
        this.type = type;
      }
    },
    setTimeout(resolve) {
      resolve();
    }
  });

  const result = await api._testRunWishlistCreateResupplyWishlist({
    base: { id: 16731, name: '0-冶炼 合金09', planetId: 876 },
    config: { resupplyDays: 5 },
    shipInfo: { location: 'exchange', ship: { name: 'ship', capacity: 300000 } },
    company: { cash: 1000000 }
  });

  assert.equal(result.reduceResult.days, 0.5);
  assert.equal(doc.state.added, true);
  assert.ok(order.includes('days:0.5'));
  assert.ok(order.indexOf('days:0.5') < order.indexOf('add:0.5'));
});

test('04 创建补给 wishlist 会按飞船名称容量计算半天倍数并在调天数后重新全选', async () => {
  const order = [];
  const doc = createResupplyWorkflowDoc(order, {
    page: 'base',
    selectedBase: true,
    baseName: '0-冶炼 合金09',
    days: 5,
    weightPerDay: 53546.4,
    daysInputId: 'days',
    noDaysHint: true,
    includeSlider: true,
    sliderMutatesDays: true,
    uncheckOnDaysChange: true
  });
  const api = createGtAutopilot({
    document: doc,
    location: { pathname: '/base/16731', href: 'https://g2.galactictycoons.com/base/16731?tab=info&otab=resupply&bt=14' },
    Event: class TestEvent {
      constructor(type) {
        this.type = type;
      }
    },
    setTimeout(resolve) {
      resolve();
    }
  });

  const result = await api._testRunWishlistCreateResupplyWishlist({
    base: { id: 16731, name: '0-冶炼 合金09', planetId: 876 },
    config: { resupplyDays: 5 },
    shipInfo: { location: 'exchange', ship: { name: '200000 反物质-09', capacity: 50000 } },
    company: { cash: 1000000 }
  });

  assert.equal(result.reduceResult.days, 3.5);
  assert.equal(result.reduceResult.weight, 187413);
  assert.equal(doc.state.added, true);
  assert.ok(!order.some((entry) => entry.startsWith('slider:')), '不应写入 slider，避免游戏把 0.5 倍数改成 0.6');
  assert.deepEqual(order.slice(-4), ['check:0', 'check:1', 'check:2', 'add:3.5']);
});

test('04 创建补给 wishlist 会持续按半天递减直到重量不超过飞船容量', async () => {
  const order = [];
  const doc = createResupplyWorkflowDoc(order, {
    page: 'base',
    selectedBase: true,
    baseName: '0-冶炼 合金09',
    days: 5,
    weightByDays: {
      5: 500000,
      2: 250000,
      1.5: 190000
    },
    daysInputId: 'days',
    noDaysHint: true,
    uncheckOnDaysChange: true
  });
  const api = createGtAutopilot({
    document: doc,
    location: { pathname: '/base/16731', href: 'https://g2.galactictycoons.com/base/16731?tab=info&otab=resupply&bt=14' },
    Event: class TestEvent {
      constructor(type) {
        this.type = type;
      }
    },
    setTimeout(resolve) {
      resolve();
    }
  });

  const result = await api._testRunWishlistCreateResupplyWishlist({
    base: { id: 16731, name: '0-冶炼 合金09', planetId: 876 },
    config: { resupplyDays: 5 },
    shipInfo: { location: 'exchange', ship: { name: '200000 反物质-09', capacity: 50000 } },
    company: { cash: 1000000 }
  });

  assert.equal(result.reduceResult.days, 1.5);
  assert.equal(result.reduceResult.weight, 190000);
  assert.equal(result.reduceResult.exhausted, false);
  assert.equal(doc.state.added, true);
  assert.deepEqual(order.slice(-8, -1), ['check:0', 'check:1', 'check:2', 'days:1.5', 'check:0', 'check:1', 'check:2']);
  assert.equal(order.at(-1), 'add:1.5');
});

test('04 创建补给 wishlist 在真实 Resupply 控件缺失时不会回退到估算成功', async () => {
  const order = [];
  const doc = createResupplyWorkflowDoc(order, {
    page: 'base',
    selectedBase: true,
    baseName: '0-冶炼 合金09',
    hideResupplyButton: true
  });
  const api = createGtAutopilot({
    document: doc,
    location: { pathname: '/base/16731', href: 'https://g2.galactictycoons.com/base/16731' },
    Event: class TestEvent {
      constructor(type) {
        this.type = type;
      }
    },
    setTimeout(resolve) {
      resolve();
    }
  });

  await assert.rejects(
    () => api._testRunWishlistCreateResupplyWishlist({
      base: { id: 16731, name: '0-冶炼 合金09', planetId: 876 },
      config: { resupplyDays: 5 },
      shipInfo: { location: 'exchange', ship: { name: '200000 反物质-09', capacity: 50000 } },
      company: { cash: 1000000 }
    }),
    /未找到 Resupply 按钮/
  );
  assert.equal(doc.state.added, false);
});

test('04 创建补给 wishlist 降到半天仍超重时不会点击添加', async () => {
  const order = [];
  const doc = createResupplyWorkflowDoc(order, {
    page: 'base',
    selectedBase: true,
    baseName: '0-冶炼 合金09',
    days: 5,
    weightByDays: {
      5: 500000,
      2: 250000,
      1.5: 230000,
      1: 220000,
      0.5: 210000
    },
    daysInputId: 'days',
    noDaysHint: true,
    uncheckOnDaysChange: true
  });
  const api = createGtAutopilot({
    document: doc,
    location: { pathname: '/base/16731', href: 'https://g2.galactictycoons.com/base/16731?tab=info&otab=resupply&bt=14' },
    Event: class TestEvent {
      constructor(type) {
        this.type = type;
      }
    },
    setTimeout(resolve) {
      resolve();
    }
  });

  await assert.rejects(
    () => api._testRunWishlistCreateResupplyWishlist({
      base: { id: 16731, name: '0-冶炼 合金09', planetId: 876 },
      config: { resupplyDays: 5 },
      shipInfo: { location: 'exchange', ship: { name: '200000 反物质-09', capacity: 50000 } },
      company: { cash: 1000000 }
    }),
    /超过飞船容量 200000/
  );
  assert.equal(doc.state.added, false);
  assert.ok(order.includes('days:0.5'));
  assert.ok(!order.some((entry) => entry.startsWith('add:')));
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

test('清空基地 wishlist 按 View Wishlist 数量进入交易所编辑并 Clear 后点击 Base 回到基地', async () => {
  const order = [];
  const baseUrl = 'https://g2.galactictycoons.com/base/16731?tab=info&otab=resupply&bt=14';
  const location = {
    _href: baseUrl,
    pathname: '/base/16731',
    hrefSetCount: 0
  };
  const doc = {
    page: 'base',
    wishlistCount: 15,
    querySelectorAll(selector) {
      if (selector !== 'button, a, [role="button"], [role="tab"]' && selector !== 'button') {
        return [];
      }
      if (this.page === 'base') {
        return [
          createVisibleButton('View Wishlist (' + this.wishlistCount + ')', () => {
            order.push('view-wishlist');
            this.page = 'exchange-wishlist';
            location._href = 'https://g2.galactictycoons.com/exchange?tab=wishlist';
            location.pathname = '/exchange';
          })
        ];
      }
      if (this.page === 'exchange-wishlist') {
        return [
          createVisibleButton('', () => {
            order.push('edit-wishlist');
            this.page = 'exchange-wishlist-edit';
          }, '<svg><use href="/assets/atlas.svg#pencil"></use></svg>')
        ];
      }
      if (this.page === 'exchange-wishlist-edit') {
        return [
          createVisibleButton('Clear Wishlist', () => {
            order.push('clear-wishlist');
            this.wishlistCount = 0;
          }),
          createVisibleButton('Base', () => {
            order.push('base-click');
            location._href = baseUrl;
            location.pathname = '/base/16731';
            this.page = 'base';
          })
        ];
      }
      return [];
    }
  };
  Object.defineProperty(location, 'href', {
    get() {
      return this._href;
    },
    set(value) {
      this.hrefSetCount += 1;
      order.push('href-set');
      this._href = value;
      this.pathname = '/base/16731';
      doc.page = 'base';
    }
  });

  const api = createGtAutopilot({
    document: doc,
    window: { location },
    setTimeout(resolve) {
      resolve();
    }
  });

  await api._testClearWishlistFromUi();

  assert.deepEqual(order, ['view-wishlist', 'edit-wishlist', 'clear-wishlist', 'base-click']);
  assert.equal(location.href, baseUrl);
  assert.equal(location.hrefSetCount, 0);
});

test('清空基地 wishlist 在 View Wishlist 数量为 0 时不进入交易所', async () => {
  const order = [];
  const doc = {
    querySelectorAll(selector) {
      if (selector !== 'button, a, [role="button"], [role="tab"]' && selector !== 'button') {
        return [];
      }
      return [
        createVisibleButton('View Wishlist (0)', () => {
          order.push('view-wishlist');
        })
      ];
    }
  };
  const api = createGtAutopilot({
    document: doc,
    window: { location: { href: 'https://g2.galactictycoons.com/base/16731', pathname: '/base/16731' } },
    setTimeout(resolve) {
      resolve();
    }
  });

  await api._testClearWishlistFromUi();

  assert.deepEqual(order, []);
});

test('清空基地 wishlist 找不到 View Wishlist 时不会点击其它 Clear 按钮', async () => {
  const order = [];
  const doc = {
    querySelectorAll(selector) {
      if (selector !== 'button, a, [role="button"], [role="tab"]' && selector !== 'button') {
        return [];
      }
      return [
        createVisibleButton('Clear', () => {
          order.push('wrong-clear');
        })
      ];
    }
  };
  const api = createGtAutopilot({
    document: doc,
    window: { location: { href: 'https://g2.galactictycoons.com/base/16731', pathname: '/base/16731' } },
    setTimeout(resolve) {
      resolve();
    }
  });

  await api._testClearWishlistFromUi();

  assert.deepEqual(order, []);
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

test('05 购买 wishlist 会先从 Resupply 点击 View Wishlist 再逐行购买 wishlist 条目', async () => {
  const order = [];
  const location = {
    href: 'https://g2.galactictycoons.com/base/16731?tab=info&otab=resupply&bt=14',
    pathname: '/base/16731'
  };
  const doc = createWishlistPageBuyDoc(order, {
    location,
    rows: [
      { name: 'Bioxene', amount: 16616 },
      { name: 'Kryon', amount: 83080 }
    ]
  });
  const api = createGtAutopilot({
    document: doc,
    window: { location },
    Event: class TestEvent {
      constructor(type) {
        this.type = type;
      }
    },
    setTimeout(resolve) {
      resolve();
    },
    __testHooks: {
      readWishlistRowsFromApi: () => Promise.resolve([
        { id: 1, name: 'Bioxene', amount: 16616, cost: 255 },
        { id: 2, name: 'Kryon', amount: 83080, cost: 160 }
      ])
    }
  });

  const result = await api._testRunWishlistBuyWishlist({
    base: { id: 16731, name: '0-冶炼 合金09', planetId: 877 },
    company: { cash: 100000000 },
    shipInfo: { location: 'exchange', ship: { name: '200000 反物质-09' } }
  });

  assert.deepEqual(result.bought, [
    { name: 'Bioxene', amount: 16616 },
    { name: 'Kryon', amount: 83080 }
  ]);
  assert.equal(doc.state.rows.length, 0);
  assert.deepEqual(order, [
    'view-wishlist',
    'wishlist-row:Bioxene',
    'buy:Bioxene:16616',
    'wishlist-row:Kryon',
    'buy:Kryon:83080'
  ]);
});

test('05 购买 wishlist 最终 Buy 必须点击游戏 exBuyButton 而不是右侧面板按钮', async () => {
  const order = [];
  const location = {
    href: 'https://g2.galactictycoons.com/exchange/13?tab=exchange&mtab=wishlist&mode=100&wishlistId=876',
    pathname: '/exchange/13'
  };
  const doc = createWishlistPageBuyDoc(order, {
    page: 'exchange-wishlist',
    location,
    rows: [{ name: 'Fine Rations', amount: 67520 }]
  });
  const panelButton = createVisibleButton('购买 wishlist', () => {
    order.push('panel-buy-wishlist');
  });
  const originalQuerySelectorAll = doc.querySelectorAll.bind(doc);
  doc.querySelectorAll = (selector) => {
    const nodes = originalQuerySelectorAll(selector);
    if (selector === 'button') {
      return nodes.concat([panelButton]);
    }
    if (selector === 'button, a, [role="button"], [role="tab"]') {
      return nodes.concat([panelButton]);
    }
    return nodes;
  };
  const api = createGtAutopilot({
    document: doc,
    window: { location },
    Event: class TestEvent {
      constructor(type) {
        this.type = type;
      }
    },
    setTimeout(resolve) {
      resolve();
    }
  });

  const result = await api._testBuyWishlistItemsFromWishlistPage([
    { id: 8, name: 'Fine Rations', amount: 67520 }
  ]);

  assert.deepEqual(result, [{ name: 'Fine Rations', amount: 67520 }]);
  assert.deepEqual(order, [
    'wishlist-row:Fine Rations',
    'buy:Fine Rations:67520'
  ]);
});

test('05 购买 wishlist 在 Buy 前会核对右侧面板物资名', async () => {
  const order = [];
  const location = {
    href: 'https://g2.galactictycoons.com/exchange/13?tab=exchange&mtab=wishlist&mode=100&wishlistId=876',
    pathname: '/exchange/13'
  };
  const doc = createWishlistPageBuyDoc(order, {
    page: 'exchange-wishlist',
    location,
    rows: [{ name: 'Fine Rations', amount: 67520 }],
    panelTitleByName: { 'Fine Rations': 'Drinking Water' }
  });
  const api = createGtAutopilot({
    document: doc,
    window: { location },
    Event: class TestEvent {
      constructor(type) {
        this.type = type;
      }
    },
    setTimeout(resolve) {
      resolve();
    }
  });

  await assert.rejects(
    () => api._testBuyWishlistItemsFromWishlistPage([
      { id: 8, name: 'Fine Rations', amount: 67520 }
    ]),
    /购买面板物资不匹配/
  );
  assert.deepEqual(order, ['wishlist-row:Fine Rations']);
});

test('05 购买 wishlist 点击 Buy 后必须确认 wishlist 行移除才记录已购买', async () => {
  const order = [];
  const location = {
    href: 'https://g2.galactictycoons.com/exchange/13?tab=exchange&mtab=wishlist&mode=100&wishlistId=876',
    pathname: '/exchange/13'
  };
  const doc = createWishlistPageBuyDoc(order, {
    page: 'exchange-wishlist',
    location,
    rows: [{ name: 'Fine Rations', amount: 67520 }],
    keepRowsAfterBuy: true
  });
  const api = createGtAutopilot({
    document: doc,
    window: { location },
    Event: class TestEvent {
      constructor(type) {
        this.type = type;
      }
    },
    setTimeout(resolve) {
      resolve();
    }
  });

  await assert.rejects(
    () => api._testBuyWishlistItemsFromWishlistPage([
      { id: 8, name: 'Fine Rations', amount: 67520 }
    ]),
    /购买后 wishlist 仍存在/
  );
  assert.deepEqual(order, [
    'wishlist-row:Fine Rations',
    'buy:Fine Rations:67520'
  ]);
});

test('06 转移到飞船会优先使用 05 保存的购买清单而不是已清空 wishlist', async () => {
  const buyOrder = [];
  const transferOrder = [];
  const location = {
    href: 'https://g2.galactictycoons.com/base/16731?tab=info&otab=resupply&bt=14',
    pathname: '/base/16731'
  };
  const doc = createWishlistPageBuyDoc(buyOrder, {
    location,
    rows: [
      { name: 'Bioxene', amount: 16616 },
      { name: 'Kryon', amount: 83080 }
    ]
  });
  let readCount = 0;
  const api = createGtAutopilot({
    document: doc,
    window: { location },
    Event: class TestEvent {
      constructor(type) {
        this.type = type;
      }
    },
    setTimeout(resolve) {
      resolve();
    },
    __testHooks: {
      readWishlistRowsFromApi: () => {
        readCount += 1;
        if (readCount === 1) {
          return Promise.resolve([
            { id: 1, name: 'Bioxene', amount: 16616, cost: 255 },
            { id: 2, name: 'Kryon', amount: 83080, cost: 160 }
          ]);
        }
        return Promise.resolve([]);
      },
      loadBatchOntoShip: (batch, ship) => {
        transferOrder.push(ship.name);
        transferOrder.push(...batch.map((item) => item.name + ':' + item.current));
        return Promise.resolve(batch.map((item) => ({ name: item.name, amount: item.current })));
      }
    }
  });
  const snapshot = {
    base: { id: 16731, name: '0-冶炼 合金09', planetId: 877 },
    company: { cash: 100000000 },
    shipInfo: { location: 'exchange', ship: { name: '200000 反物质-09' } }
  };

  await api._testRunWishlistBuyWishlist(snapshot);
  const transfer = await api._testRunWishlistTransferToShip(snapshot);

  assert.deepEqual(transfer.transferSummary, [
    { name: 'Bioxene', amount: 16616 },
    { name: 'Kryon', amount: 83080 }
  ]);
  assert.deepEqual(transferOrder, [
    '200000 反物质-09',
    'Bioxene:16616',
    'Kryon:83080'
  ]);
  assert.equal(readCount, 1);
});

test('06 转移到飞船入口会使用配置的转移黑名单', async () => {
  const order = [];
  const doc = createExchangeWarehouseTransferAllDoc(order);
  const api = createGtAutopilot({
    document: doc,
    setTimeout(resolve) {
      resolve();
    },
    __testHooks: {
      readWishlistRowsFromApi: () => Promise.resolve([
        { id: 113, name: 'Ship Repair Kit', amount: 2000, weight: 1 },
        { id: 149, name: 'Antimatter', amount: 2994, weight: 3 },
        { id: 12, name: 'Bioxene', amount: 16616, weight: 1 }
      ])
    }
  });

  const transfer = await api._testRunWishlistTransferToShip({
    base: { id: 16731, name: '0-冶炼 合金09', planetId: 877 },
    config: {
      wishlistTransferBlacklist: [
        { id: 113, name: 'Ship Repair Kit', enabled: true },
        { id: 149, name: 'Antimatter', enabled: false }
      ]
    },
    shipInfo: {
      location: 'exchange',
      ship: { name: '200000 反物质-09', capacity: 200000 }
    }
  });

  assert.deepEqual(order, [
    'ship:200000 反物质-09',
    'row-transfer:Antimatter',
    'confirm:Antimatter',
    'row-transfer:Workwear',
    'confirm:Workwear',
    'row-transfer:Kryon',
    'confirm:Kryon',
    'row-transfer:Bioxene',
    'confirm:Bioxene'
  ]);
  assert.equal(doc.state.totalTransferClicked, false);
  assert.deepEqual(doc.state.returnClicked, []);
  assert.deepEqual(transfer.transferSummary, [
    { name: 'Antimatter', amount: 2994 },
    { name: 'Workwear', amount: 17808 },
    { name: 'Kryon', amount: 83080 },
    { name: 'Bioxene', amount: 16616 }
  ]);
});

test('06 转移到飞船会用实时选中的 Exchange 货仓修正旧 transit 快照', async () => {
  const order = [];
  const doc = createExchangeWarehouseTransferAllDoc(order, {
    initialShip: '200000 反物质-10',
    shipNames: ['200000 反物质-09', '200000 反物质-10']
  });
  const api = createGtAutopilot({
    document: doc,
    setTimeout(resolve) {
      resolve();
    },
    __testHooks: {
      readWishlistRowsFromApi: () => Promise.resolve([
        { id: 12, name: 'Bioxene', amount: 16616, weight: 1 }
      ])
    }
  });

  const transfer = await api._testRunWishlistTransferToShip({
    base: { id: 10, name: '0-冶炼 合金10', planetId: 877 },
    company: {
      exWhId: 202,
      ships: [
        {
          id: 10,
          name: '200000 反物质-10',
          warehouseId: 0,
          pId: 0,
          flight: { aDate: '2026-06-09T12:00:00Z' }
        }
      ]
    },
    shipInfo: {
      location: 'transit',
      ship: {
        id: 10,
        name: '200000 反物质-10',
        warehouseId: 0,
        pId: 0,
        flight: { aDate: '2026-06-09T12:00:00Z' }
      }
    }
  });

  assert.deepEqual(order, [
    'ship:200000 反物质-10',
    'row-transfer:Workwear',
    'confirm:Workwear',
    'row-transfer:Kryon',
    'confirm:Kryon',
    'row-transfer:Bioxene',
    'confirm:Bioxene'
  ]);
  assert.deepEqual(transfer.transferSummary, [
    { name: 'Workwear', amount: 17808 },
    { name: 'Kryon', amount: 83080 },
    { name: 'Bioxene', amount: 16616 }
  ]);
});

test('06 转移到飞船在交易所页基地上下文丢失时信任实时选中货仓', async () => {
  const order = [];
  const doc = createExchangeWarehouseTransferAllDoc(order, {
    initialShip: '200000 反物质-10',
    shipNames: ['200000 反物质-09', '200000 反物质-10']
  });
  const api = createGtAutopilot({
    document: doc,
    setTimeout(resolve) {
      resolve();
    },
    __testHooks: {
      readWishlistRowsFromApi: () => Promise.resolve([
        { id: 12, name: 'Bioxene', amount: 16616, weight: 1 }
      ])
    }
  });

  const transfer = await api._testRunWishlistTransferToShip({
    location: 'https://g2.galactictycoons.com/exchange/?tab=exchange',
    base: { id: 9, name: '0-冶炼 合金09', planetId: 877 },
    company: {
      exWhId: 202,
      ships: [
        {
          id: 9,
          name: '200000 反物质-09',
          warehouseId: 0,
          pId: 0,
          flight: { aDate: '2026-06-09T12:00:00Z' }
        },
        {
          id: 10,
          name: '200000 反物质-10',
          warehouseId: 0,
          pId: 0,
          flight: { aDate: '2026-06-09T12:00:00Z' }
        }
      ]
    },
    shipInfo: {
      location: 'transit',
      ship: {
        id: 9,
        name: '200000 反物质-09',
        warehouseId: 0,
        pId: 0,
        flight: { aDate: '2026-06-09T12:00:00Z' }
      }
    }
  });

  assert.deepEqual(order, [
    'ship:200000 反物质-10',
    'row-transfer:Workwear',
    'confirm:Workwear',
    'row-transfer:Kryon',
    'confirm:Kryon',
    'row-transfer:Bioxene',
    'confirm:Bioxene'
  ]);
  assert.deepEqual(transfer.ship, { name: '200000 反物质-10', locationText: 'Exchange Station' });
});

test('06 转移到飞船没有购买缓存时不再校验空 wishlist 而是读取交易所仓库行', async () => {
  const order = [];
  const doc = createExchangeWarehouseTransferAllDoc(order, {
    exchangeRows: [
      { name: 'Ship Repair Kit', amount: '2,000', weight: '1,500' },
      { name: 'Antimatter', amount: '2,994', weight: '8,982' },
      { name: 'Bioxene', amount: '16,616', weight: '16,616' },
      { name: 'Kryon', amount: '83,080', weight: '62,310' }
    ]
  });
  let readWishlistCalled = false;
  const api = createGtAutopilot({
    document: doc,
    setTimeout(resolve) {
      resolve();
    },
    __testHooks: {
      readWishlistRowsFromApi: () => {
        readWishlistCalled = true;
        return Promise.resolve([]);
      }
    }
  });

  const transfer = await api._testRunWishlistTransferToShip({
    base: { id: 9, name: '0-冶炼 合金09', planetId: 877 },
    config: {
      wishlistTransferBlacklist: [
        { id: 113, name: 'Ship Repair Kit', enabled: true },
        { id: 149, name: 'Antimatter', enabled: true }
      ]
    },
    shipInfo: {
      location: 'exchange',
      ship: { name: '200000 反物质-09', capacity: 200000 }
    }
  });

  assert.equal(readWishlistCalled, false);
  assert.deepEqual(order, [
    'ship:200000 反物质-09',
    'row-transfer:Bioxene',
    'confirm:Bioxene',
    'row-transfer:Kryon',
    'confirm:Kryon'
  ]);
  assert.deepEqual(transfer.transferSummary, [
    { name: 'Bioxene', amount: 16616 },
    { name: 'Kryon', amount: 83080 }
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

test('06 转移到飞船会先选中目标飞船再逐项点击非黑名单物资并确认', async () => {
  const order = [];
  const doc = createExchangeWarehouseTransferAllDoc(order);
  const api = createGtAutopilot({
    document: doc,
    setTimeout(resolve) {
      resolve();
    }
  });

  const result = await api._testTransferExchangeWarehouseToShip([
    { name: 'Bioxene', current: 16616 },
    { name: 'Kryon', current: 83080 }
  ], { name: '200000 反物质-09' });

  assert.deepEqual(order, [
    'ship:200000 反物质-09',
    'row-transfer:Bioxene',
    'confirm:Bioxene',
    'row-transfer:Kryon',
    'confirm:Kryon'
  ]);
  assert.equal(doc.state.totalTransferClicked, false);
  assert.equal(doc.state.rowTransferClicked, true);
  assert.deepEqual(doc.state.rowTransferClickedNames, ['Bioxene', 'Kryon']);
  assert.deepEqual(doc.state.confirmClickedNames, ['Bioxene', 'Kryon']);
  assert.deepEqual(result, [
    { name: 'Bioxene', amount: 16616 },
    { name: 'Kryon', amount: 83080 }
  ]);
});

test('06 转移到飞船在当前选中飞船不是目标时会失败且不转移', async () => {
  const order = [];
  const doc = createExchangeWarehouseTransferAllDoc(order, {
    initialShip: '200000 反物质-01',
    stuckSelectedShip: '200000 反物质-01'
  });
  const api = createGtAutopilot({
    document: doc,
    setTimeout(resolve) {
      resolve();
    }
  });

  await assert.rejects(
    () => api._testTransferExchangeWarehouseToShip([
      { name: 'Bioxene', current: 16616 }
    ], { name: '200000 反物质-09' }),
    /当前选中飞船不是目标飞船/
  );

  assert.deepEqual(order, ['ship:200000 反物质-09']);
  assert.equal(doc.state.rowTransferClicked, false);
  assert.deepEqual(doc.state.rowTransferClickedNames, []);
});

test('06 转移到飞船不会点击转移黑名单物资行', async () => {
  const order = [];
  const doc = createExchangeWarehouseTransferAllDoc(order);
  const api = createGtAutopilot({
    document: doc,
    setTimeout(resolve) {
      resolve();
    }
  });

  const result = await api._testTransferExchangeWarehouseToShip([
    { id: 113, name: 'Ship Repair Kit', current: 2000 },
    { id: 149, name: 'Antimatter', current: 2994 },
    { id: 12, name: 'Bioxene', current: 16616 }
  ], { name: '200000 反物质-09' }, [
    { id: 113, name: 'Ship Repair Kit', enabled: true },
    { id: 149, name: 'Antimatter', enabled: true }
  ]);

  assert.deepEqual(order, [
    'ship:200000 反物质-09',
    'row-transfer:Bioxene',
    'confirm:Bioxene'
  ]);
  assert.equal(doc.state.totalTransferClicked, false);
  assert.deepEqual(result, [
    { name: 'Bioxene', amount: 16616 }
  ]);
  assert.deepEqual(doc.state.rowTransferClickedNames, ['Bioxene']);
  assert.deepEqual(doc.state.confirmClickedNames, ['Bioxene']);
  assert.deepEqual(doc.state.returnClicked, []);
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

test('飞船维护 helper 会点击可见 Refuel 按钮并等待维护弹层打开', async () => {
  const waits = [];
  const api = createGtAutopilot({
    setTimeout(callback, ms) {
      waits.push(ms);
      callback();
    }
  });
  const doc = createDelayedShipMaintenanceDoc({ mode: 'fuel', max: '2956' });

  const result = await api.performShipMaintenanceInDocumentAsync(doc, 'fuel');

  assert.deepEqual(result, {
    mode: 'fuel',
    popupId: 'shipRefuel',
    amount: 2956
  });
  assert.deepEqual(doc.events, ['click:Refuel', 'confirm:2956']);
  assert.deepEqual(waits, [150]);
});

test('飞船维护 helper 会点击可见 Repair 按钮并等待维护弹层打开', async () => {
  const waits = [];
  const api = createGtAutopilot({
    setTimeout(callback, ms) {
      waits.push(ms);
      callback();
    }
  });
  const doc = createDelayedShipMaintenanceDoc({ mode: 'repair', max: '1900' });

  const result = await api.performShipMaintenanceInDocumentAsync(doc, 'repair');

  assert.deepEqual(result, {
    mode: 'repair',
    popupId: 'shipRepair',
    amount: 1900
  });
  assert.deepEqual(doc.events, ['click:Repair', 'confirm:1900']);
  assert.deepEqual(waits, [150]);
});

test('飞船维护 helper 会忽略没有数量输入框的非维护 popover', async () => {
  const waits = [];
  const api = createGtAutopilot({
    setTimeout(callback, ms) {
      waits.push(ms);
      callback();
    }
  });
  const doc = createDelayedShipMaintenanceDoc({
    mode: 'repair',
    max: '1900',
    unrelatedPopoverFirst: true
  });

  const result = await api.performShipMaintenanceInDocumentAsync(doc, 'repair');

  assert.deepEqual(result, {
    mode: 'repair',
    popupId: 'shipRepair',
    amount: 1900
  });
  assert.deepEqual(doc.events, ['click:Repair', 'confirm:1900']);
  assert.ok(waits.length >= 1);
});

test('修理飞船 helper 不会复用补油后的旧弹层', async () => {
  const api = createGtAutopilot({
    setTimeout(callback) {
      callback();
    }
  });
  const doc = createRepairWithStaleFuelPopoverDoc();

  const result = await api.performShipMaintenanceInDocumentAsync(doc, 'repair');

  assert.deepEqual(result, {
    mode: 'repair',
    popupId: 'shipRepair',
    amount: 1900
  });
  assert.deepEqual(doc.events, ['click:Repair', 'confirm:repair:1900']);
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

test('飞船补油修理原子功能会处理所有交易所飞船', async () => {
  const doc = createMultiShipMaintenanceDoc([
    { name: '200000 反物质-09', location: 'Exchange Station' },
    { name: '100000 冰-10', location: '0-冰10' },
    { name: '200000 食品-11', location: 'Exchange Station' },
  ]);
  const api = createGtAutopilot({
    document: doc,
    setTimeout(callback) {
      callback();
    }
  });

  const result = await api._testRunWishlistShipMaintenance({
    shipInfo: { location: 'exchange', ship: { name: '200000 反物质-09' } }
  }, 'fuel_and_repair');

  assert.deepEqual(result.results.map((entry) => entry.ship.name), ['200000 反物质-09', '200000 食品-11']);
  assert.deepEqual(result.skipped.map((entry) => ({ name: entry.ship.name, locationText: entry.locationText })), [
    { name: '100000 冰-10', locationText: '0-冰10' },
  ]);
  assert.deepEqual(result.results.map((entry) => ({
    ship: entry.ship.name,
    modes: entry.maintenance.map((item) => item.mode),
  })), [
    { ship: '200000 反物质-09', modes: ['fuel', 'repair'] },
    { ship: '200000 食品-11', modes: ['fuel', 'repair'] },
  ]);
  assert.deepEqual(doc.events, [
    'open:200000 反物质-09',
    'trigger:200000 反物质-09:fuel',
    'confirm:200000 反物质-09:fuel:2956',
    'trigger:200000 反物质-09:repair',
    'confirm:200000 反物质-09:repair:1900',
    'open:100000 冰-10',
    'open:200000 食品-11',
    'trigger:200000 食品-11:fuel',
    'confirm:200000 食品-11:fuel:2956',
    'trigger:200000 食品-11:repair',
    'confirm:200000 食品-11:repair:1900',
  ]);
});

test('一键加油、修理复用 07 处理所有交易所飞船', async () => {
  const doc = createMultiShipMaintenanceDoc([
    { name: '200000 反物质-09', location: 'Exchange Station' }
  ]);
  const api = createGtAutopilot({
    document: doc,
    setTimeout(callback) {
      callback();
    }
  });

  const result = await api._testRunWishlistAtomicAction('fuel_and_repair_ship', {
    shipInfo: { location: 'exchange', ship: { name: '200000 反物质-09' } }
  });

  assert.deepEqual(result.results.map((entry) => entry.ship.name), ['200000 反物质-09']);
  assert.deepEqual(result.results[0].maintenance.map((entry) => entry.mode), ['fuel', 'repair']);
  assert.deepEqual(doc.events, [
    'open:200000 反物质-09',
    'trigger:200000 反物质-09:fuel',
    'confirm:200000 反物质-09:fuel:2956',
    'trigger:200000 反物质-09:repair',
    'confirm:200000 反物质-09:repair:1900'
  ]);
});

test('飞船补油修理原子功能在只有交易所仓库飞船标签时会先选中飞船', async () => {
  const doc = createMultiShipMaintenanceDoc([
    { name: '200000 反物质-09', hideShipLink: true },
    { name: '200000 食品-11', hideShipLink: true },
  ]);
  const api = createGtAutopilot({
    document: doc,
    setTimeout(callback) {
      callback();
    }
  });

  const result = await api._testRunWishlistShipMaintenance({}, 'fuel_and_repair');

  assert.deepEqual(result.ships.map((ship) => ship.name), ['200000 反物质-09', '200000 食品-11']);
  assert.deepEqual(doc.events, [
    'warehouse-tab:200000 反物质-09',
    'trigger:200000 反物质-09:fuel',
    'confirm:200000 反物质-09:fuel:2956',
    'trigger:200000 反物质-09:repair',
    'confirm:200000 反物质-09:repair:1900',
    'warehouse-tab:200000 食品-11',
    'trigger:200000 食品-11:fuel',
    'confirm:200000 食品-11:fuel:2956',
    'trigger:200000 食品-11:repair',
    'confirm:200000 食品-11:repair:1900',
  ]);
});

test('飞船补油修理原子功能会在选船和每次维护后等待游戏界面', async () => {
  const waits = [];
  const doc = createMultiShipMaintenanceDoc([
    { name: '200000 反物质-09', location: 'Exchange Station' },
  ]);
  const api = createGtAutopilot({
    document: doc,
    setTimeout(callback, ms) {
      waits.push(ms);
      callback();
    }
  });

  await api._testRunWishlistShipMaintenance({}, 'fuel_and_repair');

  assert.deepEqual(waits, [300, 200, 200]);
});

test('飞船补油修理原子功能会逐个切换飞船并跳过不在交易所的飞船', async () => {
  const doc = createMultiShipMaintenanceDoc([
    { name: '200000 反物质-01', location: 'Exchange Station' },
    { name: '200000 反物质-02', location: '0-冶炼 合金09' },
    { name: '200000 反物质-03', location: 'Arriving in 1h' },
    { name: '200000 反物质-04', location: 'Exchange Station' },
  ]);
  const api = createGtAutopilot({
    document: doc,
    setTimeout(callback) {
      callback();
    }
  });

  const result = await api._testRunWishlistShipMaintenance({}, 'fuel_and_repair');

  assert.deepEqual(result.results.map((entry) => entry.ship.name), ['200000 反物质-01', '200000 反物质-04']);
  assert.deepEqual(result.skipped.map((entry) => ({ name: entry.ship.name, locationText: entry.locationText })), [
    { name: '200000 反物质-02', locationText: '0-冶炼 合金09' },
    { name: '200000 反物质-03', locationText: 'transit' },
  ]);
  assert.deepEqual(doc.events, [
    'open:200000 反物质-01',
    'trigger:200000 反物质-01:fuel',
    'confirm:200000 反物质-01:fuel:2956',
    'trigger:200000 反物质-01:repair',
    'confirm:200000 反物质-01:repair:1900',
    'open:200000 反物质-02',
    'open:200000 反物质-03',
    'open:200000 反物质-04',
    'trigger:200000 反物质-04:fuel',
    'confirm:200000 反物质-04:fuel:2956',
    'trigger:200000 反物质-04:repair',
    'confirm:200000 反物质-04:repair:1900',
  ]);
});

test('飞船补油修理读取当前位置时不会把 Start flight 按钮误判为 transit', async () => {
  const doc = createMultiShipMaintenanceDoc([
    { name: '200000 反物质-09', location: '0-冶炼 合金09', includeStartFlightText: true },
  ]);
  const api = createGtAutopilot({
    document: doc,
    setTimeout(callback) {
      callback();
    }
  });

  const result = await api._testRunWishlistShipMaintenance({}, 'fuel_and_repair');

  assert.deepEqual(result.results, []);
  assert.deepEqual(result.skipped.map((entry) => ({ name: entry.ship.name, locationText: entry.locationText })), [
    { name: '200000 反物质-09', locationText: '0-冶炼 合金09' },
  ]);
});

test('飞船补油修理计划要求至少有一艘有效交易所飞船', () => {
  const api = createGtAutopilot();

  assert.throws(
    () => api.planWishlistAllExchangeShipMaintenance([{ name: '', locationText: 'Exchange Station' }]),
    /未找到交易所飞船/
  );
});

test('补修理包、油原子功能复用交易所补材料逻辑', async () => {
  const boughtPlan = [];
  const api = createGtAutopilot({
    setTimeout(callback) {
      callback();
    },
    __testHooks: {
      navigateToExchangePage() {
        return Promise.resolve(true);
      },
      buyWishlistItemsFromUi(plan) {
        boughtPlan.push(...plan);
        return Promise.resolve(plan.map((item) => ({ name: item.name, amount: item.amount })));
      }
    }
  });

  const result = await api._testRunWishlistAtomicAction('wishlist_repair_ship', {
    exchangeWarehouse: {
      mats: [
        { id: 149, am: 500 },
        { id: 113, am: 1800 },
      ]
    }
  });

  assert.deepEqual(result.plan, [
    { id: 149, name: 'Antimatter', amount: 1500, current: 500, targetAmount: 2000, role: 'fuel' },
    { id: 113, name: 'Ship Repair Kit', amount: 200, current: 1800, targetAmount: 2000, role: 'repair' },
  ]);
  assert.deepEqual(boughtPlan, result.plan);
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

test('飞船信息弹窗顶部包含目标船名时仍会点击标签切换当前飞船', () => {
  const api = createGtAutopilot();
  const doc = createShipDetailTabsDoc();

  assert.equal(api.openShipInfoModalInDocument(doc, { name: '200000 反物质-02' }), true);
  assert.deepEqual(doc.events, ['tab:200000 反物质-02']);
});

test('交易所仓库飞船货仓不能被误判为飞船维护详情', () => {
  const api = createGtAutopilot();
  const doc = createShipWarehouseCargoPanelDoc();

  assert.equal(api.openShipInfoModalInDocument(doc, { name: '200000 反物质-01' }), true);
  assert.deepEqual(doc.events, ['ship-link:200000 反物质-01']);
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

test('发船 helper 会选择目标基地、开启自动卸货并点击起飞', async () => {
  const doc = createShipFlightDoc({ shipName: 'Demo Hauler', destinationName: '0-冶炼 合金09' });
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

  const result = await api._testMoveShipToDestination({ name: 'Demo Hauler' }, '0-冶炼 合金09');

  assert.equal(result, true);
  assert.deepEqual(doc.events, [
    'warehouse-tab',
    'ship-panel',
    'info-tab',
    'destination:0-冶炼 合金09',
    'suggestion:0-冶炼 合金09',
    'auto-unload:true',
    'start-flight'
  ]);
  assert.equal(doc.unloadCheckbox.checked, true);
});

test('发船 helper 找不到目标基地候选时不会点击起飞', async () => {
  const doc = createShipFlightDoc({ shipName: 'Demo Hauler', destinationName: '0-冶炼 合金09', missingSuggestion: true });
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

  await assert.rejects(
    api._testMoveShipToDestination({ name: 'Demo Hauler' }, '0-冶炼 合金09'),
    /未找到目的地候选/
  );
  assert.equal(doc.events.includes('start-flight'), false);
});

test('原子功能当前只有一键卖货标记为已完成', () => {
  const api = createGtAutopilot();
  const doneActions = api.getAtomicActions()
    .filter((entry) => entry.status === 'done')
    .map((entry) => entry.action);

  assert.deepEqual(doneActions, ['sell_exchange_inventory']);
});

test('一键加油、修理入口复用 07 飞船补油修理流程', () => {
  const api = createGtAutopilot();
  const result = api.runAtomicAction('fuel_and_repair_ship');
  assert.deepEqual(result, {
    action: 'fuel_and_repair_ship',
    label: '一键加油、修理',
    status: 'ready',
    message: '一键加油、修理：可测试'
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

test('交易所仓库卖货 helper 会兼容 Construction Kit 的真实页面简写', () => {
  const api = createGtAutopilot();
  const doc = createExchangeWarehouseSellDoc();

  assert.equal(api.clickExchangeWarehouseSellButtonInDocument(doc, 'Basic Construction Kit'), true);
  assert.equal(doc.containmentSellButton.clicked, false);
  assert.equal(doc.constructionSellButton.clicked, true);
});

test('交易所仓库卖货 helper 会兼容 Rations 的真实页面简写', () => {
  const api = createGtAutopilot();
  const doc = createExchangeWarehouseSellDoc();

  assert.equal(api.clickExchangeWarehouseSellButtonInDocument(doc, 'Basic Rations'), true);
  assert.equal(doc.containmentSellButton.clicked, false);
  assert.equal(doc.rationsSellButton.clicked, true);
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

test('planBaseBuildingRepair 选出耐久低于阈值的建筑并按耐久升序排列', () => {
  const api = createGtAutopilot();
  const plan = api.planBaseBuildingRepair({
    buildingSlots: [
      { id: 1, status: 2, building: { id: 11, type: 1, level: 3, cond: 0.95 } },
      { id: 2, status: 2, building: { id: 12, type: 2, level: 1, cond: 0.4 } },
      { id: 3, status: 2, building: { id: 13, type: 9, level: 5, cond: 0.7 } }
    ]
  });

  assert.deepEqual(plan, [
    { slotId: 2, buildingId: 12, type: 2, level: 1, cond: 0.4 },
    { slotId: 3, buildingId: 13, type: 9, level: 5, cond: 0.7 }
  ]);
});

test('planBaseBuildingRepair 跳过空槽与无建筑的槽', () => {
  const api = createGtAutopilot();
  const plan = api.planBaseBuildingRepair({
    buildingSlots: [
      { id: 1, status: 1, building: null },
      { id: 2, status: 3 },
      { id: 3, status: 2, building: { id: 30, type: 5, level: 1, cond: 0.2 } }
    ]
  });

  assert.deepEqual(plan, [
    { slotId: 3, buildingId: 30, type: 5, level: 1, cond: 0.2 }
  ]);
});

test('planBaseBuildingRepair 兼容 condition 字段并支持自定义阈值', () => {
  const api = createGtAutopilot();
  const plan = api.planBaseBuildingRepair({
    buildingSlots: [
      { id: 1, status: 2, building: { id: 41, type: 1, level: 1, condition: 0.5 } },
      { id: 2, status: 2, building: { id: 42, type: 1, level: 1, condition: 0.85 } }
    ]
  }, { threshold: 0.6 });

  assert.deepEqual(plan, [
    { slotId: 1, buildingId: 41, type: 1, level: 1, cond: 0.5 }
  ]);
});

test('planBaseBuildingRepair 在没有建筑数据时返回空数组', () => {
  const api = createGtAutopilot();
  assert.deepEqual(api.planBaseBuildingRepair({}), []);
  assert.deepEqual(api.planBaseBuildingRepair(null), []);
});

function createBaseBuildingRepairDoc(options = {}) {
  const buildingCount = options.buildings == null ? 2 : options.buildings;
  const clicks = [];
  const allButtons = [];
  for (let i = 0; i < buildingCount; i += 1) {
    const label = 'building-' + i;
    allButtons.push({
      textContent: 'Repair',
      innerText: 'Repair',
      getClientRects() {
        return [{}];
      },
      getAttribute() {
        return '';
      },
      click() {
        clicks.push(label);
      }
    });
  }
  if (options.includeShipRepair) {
    allButtons.push({
      textContent: 'Repair',
      innerText: 'Repair',
      getClientRects() {
        return [{}];
      },
      getAttribute(name) {
        return name === 'data-popup-id' ? 'shipRepair' : '';
      },
      click() {
        clicks.push('ship-repair');
      }
    });
  }
  const popup = options.withConfirmPopup ? {
    querySelectorAll(selector) {
      if (selector !== 'button') {
        return [];
      }
      return [{
        textContent: 'Confirm',
        innerText: 'Confirm',
        getClientRects() {
          return [{}];
        },
        click() {
          clicks.push('confirm');
        }
      }];
    }
  } : null;
  return {
    clicks,
    querySelectorAll(selector) {
      if (selector === 'button') {
        return allButtons;
      }
      if (selector === '.popover') {
        return popup ? [popup] : [];
      }
      return [];
    }
  };
}

test('修基地建筑 helper 会点击所有建筑 Repair 按钮', async () => {
  const api = createGtAutopilot({
    setTimeout(callback) {
      callback();
    }
  });
  const doc = createBaseBuildingRepairDoc({ buildings: 3 });

  const result = await api.repairBaseBuildingsInDocumentAsync(doc);

  assert.deepEqual(result, { repaired: 3, total: 3 });
  assert.deepEqual(doc.clicks, ['building-0', 'building-1', 'building-2']);
});

test('修基地建筑 helper 会在每次修理后点击确认弹层', async () => {
  const api = createGtAutopilot({
    setTimeout(callback) {
      callback();
    }
  });
  const doc = createBaseBuildingRepairDoc({ buildings: 2, withConfirmPopup: true });

  const result = await api.repairBaseBuildingsInDocumentAsync(doc);

  assert.deepEqual(result, { repaired: 2, total: 2 });
  assert.deepEqual(doc.clicks, ['building-0', 'confirm', 'building-1', 'confirm']);
});

test('修基地建筑 helper 不会点击飞船维护 Repair 按钮', async () => {
  const api = createGtAutopilot({
    setTimeout(callback) {
      callback();
    }
  });
  const doc = createBaseBuildingRepairDoc({ buildings: 1, includeShipRepair: true });

  const result = await api.repairBaseBuildingsInDocumentAsync(doc);

  assert.deepEqual(result, { repaired: 1, total: 1 });
  assert.deepEqual(doc.clicks, ['building-0']);
});

test('修基地建筑 helper 在没有 Repair 按钮时返回 0', async () => {
  const api = createGtAutopilot({
    setTimeout(callback) {
      callback();
    }
  });
  const doc = createBaseBuildingRepairDoc({ buildings: 0 });

  const result = await api.repairBaseBuildingsInDocumentAsync(doc);

  assert.deepEqual(result, { repaired: 0, total: 0 });
  assert.deepEqual(doc.clicks, []);
});

test('runRepairBaseBuildings 在有低耐久建筑时会按计划逐个修理', async () => {
  let repairCalled = false;
  const api = createGtAutopilot({
    setTimeout(callback) {
      callback();
    },
    __testHooks: {
      repairBaseBuildingsInDocumentAsync() {
        repairCalled = true;
        return Promise.resolve({ repaired: 2, total: 2 });
      }
    }
  });

  const result = await api._testRunRepairBaseBuildings({
    base: {
      buildingSlots: [
        { id: 1, building: { id: 11, type: 1, level: 1, cond: 0.4 } },
        { id: 2, building: { id: 12, type: 2, level: 1, cond: 0.95 } },
        { id: 3, building: { id: 13, type: 3, level: 1, cond: 0.7 } }
      ]
    }
  });

  assert.equal(repairCalled, true);
  assert.equal(result.repaired, 2);
  assert.deepEqual(result.plan.map((item) => item.buildingId), [11, 13]);
});

test('runRepairBaseBuildings 在所有建筑耐久充足时不会修理', async () => {
  let repairCalled = false;
  const api = createGtAutopilot({
    setTimeout(callback) {
      callback();
    },
    __testHooks: {
      repairBaseBuildingsInDocumentAsync() {
        repairCalled = true;
        return Promise.resolve({ repaired: 0, total: 0 });
      }
    }
  });

  const result = await api._testRunRepairBaseBuildings({
    base: {
      buildingSlots: [
        { id: 1, building: { id: 11, type: 1, level: 1, cond: 0.95 } }
      ]
    }
  });

  assert.deepEqual(result, { repaired: 0, plan: [] });
  assert.equal(repairCalled, false);
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

test('切换交易所 helper 找不到游戏按钮时不会设置 location.href', async () => {
  const order = [];
  const location = {
    pathname: '/base/16731',
    hrefSetCount: 0,
    _href: 'https://g2.galactictycoons.com/base/16731'
  };
  Object.defineProperty(location, 'href', {
    get() {
      return this._href;
    },
    set(value) {
      this.hrefSetCount += 1;
      order.push('href-set:' + value);
      this._href = value;
    }
  });
  const api = createGtAutopilot({
    document: {
      querySelectorAll() {
        return [];
      }
    },
    window: { location },
    setTimeout(resolve) {
      resolve();
    }
  });

  await assert.rejects(
    () => api._testNavigateToExchangePage(),
    /未找到 Exchange 按钮/
  );
  assert.equal(location.hrefSetCount, 0);
  assert.deepEqual(order, []);
});

test('切换交易所 helper 点击后仍停在基地仓库时会失败', async () => {
  const order = [];
  const location = {
    pathname: '/base/13327',
    href: 'https://g2.galactictycoons.com/base/13327?tab=warehouse&bt=14'
  };
  const exchangeButton = {
    textContent: 'Exchange',
    innerText: 'Exchange',
    getClientRects() {
      return [{}];
    },
    click() {
      order.push('exchange-click');
    }
  };
  const baseWarehouseRow = {
    textContent: 'Basic Construction Kit 3,595 1,438t $3.3m',
    innerText: 'Basic Construction Kit 3,595 1,438t $3.3m',
    querySelectorAll(selector) {
      if (selector === 'button') {
        return [{ innerHTML: '<svg><use href="#arrow-right"></use></svg>', disabled: true }];
      }
      return [];
    }
  };
  const api = createGtAutopilot({
    document: {
      querySelectorAll(selector) {
        if (selector === 'button, a, [role="button"], [role="tab"]') {
          return [exchangeButton];
        }
        if (selector === 'tr, [role="row"], .mat-row, .mat-item') {
          return [baseWarehouseRow];
        }
        if (selector === 'button') {
          return [exchangeButton];
        }
        return [];
      }
    },
    window: { location },
    setTimeout(resolve) {
      resolve();
    }
  });

  await assert.rejects(
    () => api._testNavigateToExchangePage(),
    /未进入交易所页面/
  );
  assert.deepEqual(order, ['exchange-click']);
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

test('inferShipLocation 在 Exchange 仓库页会从已选飞船仓库标签推断交易所位置', () => {
  const api = createGtAutopilot();
  const base = { id: 9, name: '0-冶炼 合金09', warehouseId: 101, planetId: 501 };
  const doc = createExchangeShipWarehouseTabsDoc([
    { id: 'btnradio-whwt16159', name: '200000 反物质-01', checked: true },
    { id: 'btnradio-whwt36386', name: '200000 反物质-09' }
  ]);

  const result = api.inferShipLocation({ exWhId: 202, ships: [] }, base, doc);

  assert.equal(result.location, 'exchange');
  assert.deepEqual(result.ship, { name: '200000 反物质-01', locationText: 'Exchange Station' });
});

test('inferShipLocation 在页面已选 Exchange 货仓时会覆盖公司 flight 旧状态', () => {
  const api = createGtAutopilot();
  const base = { id: 10, name: '0-冶炼 合金10', warehouseId: 101, planetId: 501 };
  const doc = createExchangeShipWarehouseTabsDoc([
    { id: 'btnradio-whwt36386', name: '200000 反物质-09' },
    { id: 'btnradio-whwt39889', name: '200000 反物质-10', checked: true }
  ]);
  const company = {
    exWhId: 202,
    ships: [
      {
        id: 10,
        name: '200000 反物质-10',
        warehouseId: 0,
        pId: 0,
        flight: { aDate: '2026-06-09T12:00:00Z' }
      }
    ]
  };

  const result = api.inferShipLocation(company, base, doc);

  assert.equal(result.location, 'exchange');
  assert.deepEqual(result.ship, { name: '200000 反物质-10', locationText: 'Exchange Station' });
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

function createCheckEnv(readBaseContext) {
  const logPanel = { textContent: '', scrollTop: 0, scrollHeight: 0 };
  const doc = {
    getElementById(id) {
      return id === 'gtap-log' ? logPanel : null;
    },
    querySelectorAll() {
      return [];
    }
  };
  const chainCalls = [];
  const env = {
    document: doc,
    window: { location: { href: 'https://g2.galactictycoons.com/', pathname: '/' } },
    setTimeout(callback) {
      callback();
    },
    __testHooks: {
      readBaseContext: readBaseContext,
      runSelectedChain(chain, snapshot) {
        chainCalls.push(chain);
        return Promise.resolve({ chain: chain, next: 'done', snapshot: snapshot });
      }
    }
  };
  return { env: env, logPanel: logPanel, chainCalls: chainCalls };
}

test('检查会按飞船在基地分发到卖货链', async () => {
  const ctx = createCheckEnv(() => Promise.resolve({
    base: { id: 9, name: '0-冶炼 合金09' },
    config: {},
    shipInfo: { location: 'base', ship: { name: '200000 反物质-09' } }
  }));
  const api = createGtAutopilot(ctx.env);

  await api._testRunCheck();

  assert.deepEqual(ctx.chainCalls, ['sell_chain']);
  assert.match(ctx.logPanel.textContent, /检查：开始读取基地与飞船状态/);
  assert.match(ctx.logPanel.textContent, /飞船位置：base/);
  assert.match(ctx.logPanel.textContent, /执行卖货到交易所/);
});

test('检查会按飞船在交易所分发到补货回运链', async () => {
  const ctx = createCheckEnv(() => Promise.resolve({
    base: { id: 9, name: '0-冶炼 合金09' },
    config: {},
    shipInfo: { location: 'exchange', ship: { name: '200000 反物质-09' } }
  }));
  const api = createGtAutopilot(ctx.env);

  await api._testRunCheck();

  assert.deepEqual(ctx.chainCalls, ['resupply_chain']);
  assert.match(ctx.logPanel.textContent, /转移货物到飞船并发船回基地/);
});

test('检查在飞船运输中时只等待不执行链路', async () => {
  const ctx = createCheckEnv(() => Promise.resolve({
    base: { id: 9, name: '0-冶炼 合金09' },
    config: {},
    shipInfo: { location: 'transit', ship: { name: '200000 反物质-09' } }
  }));
  const api = createGtAutopilot(ctx.env);

  await api._testRunCheck();

  assert.deepEqual(ctx.chainCalls, []);
  assert.match(ctx.logPanel.textContent, /飞船运输中，等待到达基地/);
});

test('检查在读取基地失败时仍写入失败日志而不是静默', async () => {
  const ctx = createCheckEnv(() => Promise.reject(new Error('GTLocalAPI timeout for getMyCompany')));
  const api = createGtAutopilot(ctx.env);

  await api._testRunCheck();

  assert.deepEqual(ctx.chainCalls, []);
  assert.match(ctx.logPanel.textContent, /检查：开始读取基地与飞船状态/);
  assert.match(ctx.logPanel.textContent, /检查失败：GTLocalAPI timeout for getMyCompany/);
});
