const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../src/ui/voice-widget-element.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const scope = { exports: {}, require: () => ({ ZelloWidgetElement: class {} }) };
vm.runInNewContext(code, scope);
const proto = scope.exports.ZelloVoiceWidgetElement.prototype;

test('auto-open entry tries greeting without opening microphone', () => {
  const calls = [];
  const widget = { autoOpen: true, messages: [{role: 'assistant', content: 'Salam'}],
    voicePrefs: {voiceEnabled: true, muted: false},
    showGreetingButton: () => calls.push('fallback-button'),
    startVoiceGreeting: (listen) => calls.push(['greet', listen]) };
  proto.onBootstrapped.call(widget);
  assert.equal(widget.greetingText, 'Salam');
  assert.deepEqual(calls, ['fallback-button', ['greet', false]]);
});

test('automatic greeting respects saved mute and voice off', () => {
  for (const voicePrefs of [{voiceEnabled: true, muted: true}, {voiceEnabled: false, muted: false}]) {
    proto.onBootstrapped.call({autoOpen: true, messages: [{role:'assistant',content:'Salam'}], voicePrefs,
      showGreetingButton: () => assert.fail('must remain silent')});
  }
});

test('gesture does not restart greeting after panel is closed or already greeted', () => {
  for (const override of [{isOpen:false}, {greetingStarted:true}]) {
    proto.tryAutoGreet.call({autoOpen:true, isOpen:true, greetingStarted:false, audioUnlocked:true,
      greetingText:'Salam', voicePrefs:{voiceEnabled:true, muted:false},
      startVoiceGreeting: () => assert.fail('must not restart'), ...override});
  }
});
