const test = require('node:test');
const assert = require('node:assert/strict');

const createGtAutopilot = require('../gt-autopilot.user.js');

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

  assert.deepEqual(whitelist, [
    {
      id: 172,
      enabled: true,
      minAmount: 1,
      name: 'Graphenium'
    },
    {
      id: 136,
      enabled: false,
      minAmount: 3,
      name: 'Tiridium Alloy'
    }
  ]);
});
