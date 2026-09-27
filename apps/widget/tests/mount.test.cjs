const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');

function fixture(ready=true, exists=true) {
  const listeners={};
  let observe;
  const target={dataset:{agentReady:ready?'true':'',agentInline:'true'},children:[],appendChild(w){this.children.push(w);}};
  const body={children:[],appendChild(w){this.children.push(w);}};
  const source=fs.readFileSync(path.join(__dirname,'../src/core/mount.ts'),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  const scope={exports:{},Event:class {constructor(type){this.type=type;}},
    document:{body,getElementById:()=>exists?target:null},
    window:{addEventListener:(name,fn)=>{listeners[name]=fn;}},
    MutationObserver:class {constructor(fn){observe=fn;} observe(){} disconnect(){}}};
  vm.runInNewContext(code,scope);
  const widget={inline:false,events:[],toggleAttribute(k,v){this.inline=v;},dispatchEvent(e){this.events.push(e.type);}};
  scope.exports.mountWidget(widget,{mountTarget:'stage'});
  return {widget,target,body,listeners,routeChange:()=>observe()};
}

test('inline mount waits for React hydration, then attaches once',()=>{
  const f=fixture(false);
  assert.equal(f.target.children.length,0);
  f.listeners['zello:stage-ready']();
  assert.equal(f.target.children[0],f.widget);
  assert.equal(f.widget.inline,true);
});

test('route switch changes presentation without remounting or losing conversation',()=>{
  const f=fixture();
  f.target.dataset.agentInline='false'; f.routeChange();
  assert.equal(f.widget.inline,false);
  assert.equal(f.target.children.length,1);
  f.target.dataset.agentInline='true'; f.routeChange();
  assert.equal(f.widget.inline,true);
  assert.equal(f.target.children.length,1);
});

test('partner embeds without mount target retain body-mounted floating widget',()=>{
  const f=fixture(true,false);
  assert.equal(f.body.children[0],f.widget);
  assert.equal(f.widget.inline,false);
});
