import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { mountCockpit } from '../src/runtime.js';

function harness(input = {}) {
  const listeners = new Map(), timers = new Map(), stores = { localStorage: new Map(), sessionStorage: new Map() };
  let id = 0, observerDisconnected = false;
  const body = { children: [], appendChild(node) { node.parentNode = this; this.children.push(node); } };
  function node(tagName) {
    return { tagName, children: [], style: {}, dataset: {}, inert: false, isConnected: true, attrs: {},
      setAttribute(k, v) { this.attrs[k] = v; },
      remove() { this.isConnected = false; if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(item => item !== this); },
      replaceChildren(child) { this.children = [child]; child.parentNode = this; }, focus() { this.focused = true; },
      ...(tagName === 'IFRAME' ? { contentWindow: { postMessage() {} } } : {}) };
  }
  const app = node('MAIN'), wasInert = node('ASIDE'); wasInert.inert = true; body.appendChild(app); body.appendChild(wasInert);
  const document = { body, head: node('HEAD'), activeElement: app, documentElement: { style: { overflow: 'scroll' } }, getElementById: value => body.children.find(item => item.id === value), createElement: node };
  const window = { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  for (const [name, map] of Object.entries(stores)) window[name] = { getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value) };
  const scope = { window, document, crypto: { randomUUID: () => 'test-channel' }, MutationObserver: class { observe() {} disconnect() { observerDisconnected = true; } }, setTimeout: (fn, ms) => { timers.set(++id, { fn, ms }); return id; }, clearTimeout: key => timers.delete(key) };
  vm.createContext(scope);
  const scene = '<script>/*__COCKPIT_CONFIG__*/</script>';
  const run = cfg => vm.runInContext('(' + mountCockpit.toString() + ')(scene,config)', Object.assign(scope, { scene, config: cfg }));
  const api = run({ mode: 'always', ...input });
  const root = document.getElementById('dsh-cockpit-root'), frame = root?.children[0];
  const message = (data, source = frame?.contentWindow) => listeners.get('message')?.({ source, data: { channel: 'test-channel', ...data } });
  const fire = ms => { for (const [key, task] of [...timers]) if (task.ms === ms) { timers.delete(key); task.fn(); } };
  return { api, root, frame, app, wasInert, document, stores, timers, run, fire, message, listeners, isDisconnected: () => observerDisconnected };
}

test('mount isolates host, rejects unrelated messages and fully restores on welcome completion', () => {
  const h = harness({ identity: '</script><img>' });
  assert.equal(h.app.inert, true); assert.equal(h.document.documentElement.style.overflow, 'hidden');
  assert.equal(h.frame.srcdoc.includes('</script><img>'), false);
  assert.equal(h.run({}), h.api, 'Host + client must not mount twice');
  h.message({ type: 'ready' }, {}); assert.equal(h.api.ready, false);
  h.message({ type: 'ready' }); assert.equal(h.api.ready, true);
  assert.equal(h.stores.sessionStorage.get('dsh-cockpit-startup:shown'), '1');
  assert.equal([...h.timers.values()].some(task => task.ms === 15000), false);
  h.message({ type: 'home' }); h.fire(12000); h.fire(480);
  assert.equal(h.root.isConnected, false); assert.equal(h.app.inert, false); assert.equal(h.wasInert.inert, true);
  assert.equal(h.app.focused, true); assert.equal(h.document.documentElement.style.overflow, 'scroll');
  assert.equal(h.listeners.size, 0); assert.equal(h.timers.size, 0); assert.equal(h.isDisconnected(), true);
});
test('failed boot releases app and does not consume session playback', () => {
  const h = harness(); h.fire(15000);
  assert.equal(h.root.isConnected, false); assert.equal(h.app.inert, false);
  assert.equal(h.stores.sessionStorage.size, 0);
});
test('disabled startup does not lock or mount anything', () => {
  const h = harness({ enabled: false }); assert.equal(h.api, null); assert.equal(h.root, undefined); assert.equal(h.app.inert, false);
});
test('escape/error/unload disposal is idempotent', () => {
  const h = harness(); h.message({ type: 'error' }); h.api.dispose(true);
  assert.equal(h.root.isConnected, false); assert.equal(h.timers.size, 0);
});
test('generated package keeps approved visual flow and contains no replay/prototype integrations', () => {
  const html = fs.readFileSync(new URL('../lib/scene.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /dc-replay|Replay sequence|重播启动|window\.openai|globalThis\.Tweak|fonts\.googleapis|data-lucide=/);
  assert.match(html, /Confirm access permission/); assert.match(html, /Confirm identity/); assert.match(html, /Welcome back\./);
  assert.match(html, /data:video\/mp4;base64,/); assert.match(html, /data:font\/ttf;base64,/);
  assert.match(html, /dc-home-product-word">HARNESS/);
});
