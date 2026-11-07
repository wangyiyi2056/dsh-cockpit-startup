import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { clientFactory } from '../src/client.js';
import { DEFAULTS, normalize } from '../src/config.js';

test('generated client registers the exact package name with ModuleLoader', () => {
  let entry;
  vm.runInNewContext(fs.readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8'), { window: { __ModuleLoader__: { load(value) { entry = value; } } } });
  assert.equal(entry.id, 'dsh-cockpit-startup'); assert.equal(typeof entry.factory, 'function');
});

test('client-only fallback mounts once and registers settings; disposal aborts/cleans up', async () => {
  const styles = [], effects = [], mounted = [], sections = [];
  let disposed = false;
  const scope = {
    window: {}, localStorage: { getItem: () => null }, AbortController, setTimeout, clearTimeout,
    document: { getElementById: () => null, head: { appendChild: style => styles.push(style) }, createElement: () => ({ dataset: {}, remove() { this.removed = true; } }) },
    fetch: async () => { throw new Error('No HTTP in file:// desktop'); },
    require: () => ({ createElement() {} }),
    mount: (html, cfg) => { mounted.push(cfg); return { dispose: () => { disposed = true; } }; }, defaults: DEFAULTS, normalizeConfig: normalize
  };
  vm.createContext(scope);
  const plugin = vm.runInContext('(' + clientFactory.toString() + ')(require,mount,"scene",defaults,"1.1.0",null,null,normalizeConfig)', scope);
  plugin.apply({ slots: { inject(name, render) { render(); }, register(meta) { sections.push(meta); } }, effect(callback) { effects.push(callback()); } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(mounted.length, 1); assert.equal(mounted[0].sound, true); assert.equal(mounted[0].language, 'en');
  assert.equal(mounted[0].duration, 9); assert.equal(mounted[0].workspaceBackground, true);
  assert.equal(sections[0].name, 'settings.section'); assert.equal(sections[0].id, 'cockpit-startup');
  effects.forEach(dispose => dispose()); assert.equal(disposed, true); assert.equal(styles[0].removed, true);
});
