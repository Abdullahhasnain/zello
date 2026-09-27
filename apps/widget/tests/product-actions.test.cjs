const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');

function fixture() {
  const document = { createElement: (tag) => ({tag, children:[], attributes:{}, events:{}, classList:{add(){}},
    appendChild(child) { this.children.push(child); },
    setAttribute(k,v) { this.attributes[k]=v; },
    addEventListener(k,v) { this.events[k]=v; }
  })};
  const source = fs.readFileSync(path.join(__dirname, '../src/ui/product-card.ts'), 'utf8');
  const code = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  const scope = {exports:{}, document};
  vm.runInNewContext(code, scope);
  return scope.exports.buildProductRow;
}
const product = {id:'real-id',title:'DEMO shoes size 42',price:2490,currency:'PKR',images:[],stockQty:3,status:'active'};

test('add action uses real selected product and only fires on click', () => {
  const calls=[];
  const row=fixture()([product], p=>calls.push(p.id));
  assert.equal(calls.length,0);
  const card=row.children[0];
  assert.equal(card.children.find(c=>c.className==='zello-product-price').textContent,'PKR 2,490');
  const button=card.children.find(c=>c.tag==='button');
  assert.equal(button.disabled,false);
  button.events.click();
  assert.deepEqual(calls,['real-id']);
});

test('out-of-stock card cannot be added', () => {
  const row=fixture()([{...product,stockQty:0,status:'out_of_stock'}],()=>assert.fail());
  assert.equal(row.children[0].children.find(c=>c.tag==='button').disabled,true);
});

test('historical read-only product cards do not have cart actions', () => {
  const row=fixture()([product]);
  assert.equal(row.children[0].children.some(c=>c.tag==='button'),false);
});
