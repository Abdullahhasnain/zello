const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');

function storageFixture() {
  const data = new Map();
  const localStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
  const source = fs.readFileSync(path.join(__dirname, '../src/core/storage.ts'), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const scope = { exports: {}, window: { localStorage } };
  vm.runInNewContext(code, scope);
  return { store: new scope.exports.WidgetStorage('demo'), localStorage };
}

const session = { accessToken: 'test-only', refreshToken: 'test-refresh', customerId: 'c1',
  tenantId: 't1', conversationId: 'conversation1', branding: null };

test('widget and storefront share a guest without losing conversation on token refresh', () => {
  const { store, localStorage } = storageFixture();
  store.setSession(session);
  const shared = JSON.parse(localStorage.getItem('zello.storefront.session.demo'));
  assert.equal(shared.customerId, 'c1');
  localStorage.setItem('zello.storefront.session.demo', JSON.stringify({ ...shared, accessToken: 'refreshed' }));
  assert.equal(store.getSession().accessToken, 'refreshed');
  assert.equal(store.getSession().conversationId, 'conversation1');
});

test('legacy separate guest adopts storefront identity, not the old conversation', () => {
  const { store, localStorage } = storageFixture();
  store.setSession(session);
  store.setMessages([{ content: 'old local display cache' }]);
  localStorage.setItem('zello.storefront.session.demo', JSON.stringify({ ...session, customerId: 'c2' }));
  assert.equal(store.getSession().customerId, 'c2');
  assert.equal(store.getSession().conversationId, null);
  assert.equal(store.getMessages().length, 0);
});

test('sessions remain tenant scoped and logout clears the matching cart only', () => {
  const { store, localStorage } = storageFixture();
  store.setSession(session);
  localStorage.setItem('zello.storefront.session.other', 'untouched');
  localStorage.setItem('zello.storefront.cart.demo', 'cart1');
  store.clearSession();
  assert.equal(localStorage.getItem('zello.storefront.session.demo'), null);
  assert.equal(localStorage.getItem('zello.storefront.cart.demo'), null);
  assert.equal(localStorage.getItem('zello.storefront.session.other'), 'untouched');
});
