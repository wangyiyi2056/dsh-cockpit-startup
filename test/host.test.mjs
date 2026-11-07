import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { apply, inject, name } from '../lib/index.js';
import { normalize } from '../lib/config.js';

test('configuration rejects unsafe media and clamps untrusted values', () => {
  const cfg = normalize({ enabled: 'false', sound: false, language: 'other', duration: 999, welcomeDuration: -2, identity: ' A '.repeat(50), backgroundVideo: 'javascript:alert(1)', backgroundImage: '//evil.example/image' });
  assert.equal(cfg.enabled, true); assert.equal(cfg.sound, false); assert.equal(cfg.language, 'en');
  assert.equal(cfg.duration, 16); assert.equal(cfg.welcomeDuration, 10); assert.equal(cfg.identity.length, 40);
  assert.equal(cfg.backgroundVideo, ''); assert.equal(cfg.backgroundImage, '');
  assert.equal(normalize({ backgroundImage: '/my/cockpit.webp', backgroundVideo: 'https://example.com/a.mp4' }).backgroundImage, '/my/cockpit.webp');
  assert.equal(normalize({ backgroundImage: 'file:///etc/passwd' }).backgroundImage, '');
});

test('legacy desktop poster paths no longer suppress the bundled video, and loading is two seconds faster', () => {
  const legacy = normalize({ duration: 11, backgroundImage: '/Users/example/plugin/assets/cockpit-ambient-poster.webp' });
  assert.equal(legacy.duration, 9); assert.equal(legacy.backgroundImage, ''); assert.equal(legacy.workspaceBackground, true); assert.equal(legacy.configVersion, 2);
  assert.equal(normalize({ configVersion: 2, duration: 11 }).duration, 11, 'A new explicit duration remains configurable');
  assert.equal(normalize({ backgroundImage: 'C:\\Users\\example\\poster.webp' }).backgroundImage, '');
});

test('real HTTP routes, trust boundary, index hook, persistence and disposal', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-cockpit-test-'));
  const old = process.env.DSH_HOME; process.env.DSH_HOME = home;
  const routes = [], transforms = [], effects = [];
  const ctx = { webServer: {
    register(route) { routes.push(route); return () => routes.splice(routes.indexOf(route), 1); },
    tapIndex(callback) { transforms.push(callback); return () => transforms.splice(transforms.indexOf(callback), 1); }
  }, connection: { requestRejection(req) { if (req.headers['x-reject']) return 401; } }, effect(callback) { effects.push(callback()); } };
  apply(ctx);
  assert.equal(name, 'dsh-cockpit-startup'); assert.deepEqual(inject, ['webServer', 'connection']);
  const server = http.createServer((req, res) => {
    const route = routes.find(route => route.path === req.url);
    if (route) route.handler(req, res); else { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port + '/dsh-cockpit';
  const post = body => fetch(base + '/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    const defaults = await (await fetch(base + '/config')).json(); assert.equal(defaults.config.language, 'en');
    assert.equal((await fetch(base + '/config', { headers: { 'x-reject': '1' } })).status, 401);
    assert.equal((await fetch(base + '/boot.js', { headers: { 'x-reject': '1' } })).status, 401);
    const saved = await (await post({ patch: { language: 'zh', identity: '</script><img src=x>', duration: 20 } })).json();
    assert.equal(saved.config.duration, 16); assert.equal(saved.config.language, 'zh');
    assert.equal(JSON.parse(await fs.readFile(path.join(home, 'dsh-cockpit.json'))).language, 'zh');
    const injected = transforms[0]('<HTML><HEAD></HEAD><BODY class="app"><main>Workspace</main></BODY></HTML>');
    assert.match(injected, /<BODY class="app"><div id="dsh-cockpit-root">/);
    assert.equal(injected.includes('</script><img src=x>'), false); assert.match(injected, /\\u003c\/script>/);
    assert.equal(transforms[0](injected), injected);
    const boot = await fetch(base + '/boot.js'); assert.equal(boot.status, 200); assert.match(await boot.text(), /mountCockpit/);
    assert.equal((await fetch(base + '/config', { method: 'DELETE' })).status, 405);
    assert.equal((await fetch(base + '/config', { method: 'POST', body: '{}' })).status, 415);
    assert.equal((await fetch(base + '/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' })).status, 400);
    assert.equal((await post({ patch: { identity: 'x'.repeat(20000) } })).status, 413);
    await post({ patch: { enabled: false } }); assert.equal(transforms[0]('<body>app</body>'), '<body>app</body>');
    const reset = await (await post({ action: 'reset' })).json(); assert.equal(reset.config.language, 'en'); assert.equal(reset.config.enabled, true);
    ctx.connection.requestRejection = () => { throw new Error('unavailable'); };
    assert.equal((await fetch(base + '/config')).status, 403);
  } finally {
    effects.forEach(dispose => dispose()); assert.equal(routes.length, 0); assert.equal(transforms.length, 0);
    await new Promise(resolve => server.close(resolve));
    if (old === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = old;
    await fs.rm(home, { recursive: true, force: true });
  }
});

test('no HTTP service is a graceful client fallback', () => {
  assert.doesNotThrow(() => apply({ logger: { warn() {} } }));
});
