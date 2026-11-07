import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { apply } from '../lib/index.js';
process.env.DSH_HOME ||= await fs.mkdtemp(path.join(os.tmpdir(), 'dsh-cockpit-preview-'));
const routes = [], transforms = [], disposers = [];
apply({
  webServer: {
    register(route) { routes.push(route); return () => routes.splice(routes.indexOf(route), 1); },
    tapIndex(transform) { transforms.push(transform); return () => transforms.splice(transforms.indexOf(transform), 1); }
  },
  connection: { requestRejection: () => false }, effect: callback => disposers.push(callback())
});
const index = '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DeepSeek Cockpit · Plugin Preview</title></head><body style="margin:0;background:#0b1320;color:#d2e5f6;font:16px system-ui"><main style="max-width:760px;margin:16vh auto;padding:24px"><h1>Harness workspace placeholder</h1><p>The startup plugin has released the workspace.</p><p>This preview runs the real Host index hook and routes. It does not launch DeepSeek Harness.</p><button onclick="location.reload()">Reload preview</button></main></body></html>';
const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname === '/mobile-preview') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('<!doctype html><html><head><meta charset="utf-8"><title>Mobile cockpit preview</title></head><body style="margin:0;background:#202938;display:flex;justify-content:center"><iframe title="Mobile preview" src="/" style="width:375px;height:812px;border:0"></iframe></body></html>'); return;
    }
    if (pathname === '/client-preview') {
      // Minimal documented ModuleLoader/slots contract to exercise the real client bundle.
      const shell = index.replace('</head>', '<script>window.__ModuleLoader__={load:function(entry){var plugin=entry.factory(function(id){if(id==="react")return {createElement:function(){return null}};throw Error(id)});plugin.apply({slots:{inject:function(){},register:function(){}},effect:function(cb){window.addEventListener("pagehide",cb())}})}};</script><script defer src="/client.js"></script></head>');
      res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(shell); return;
    }
    if (pathname === '/client.js') { res.setHeader('Content-Type', 'application/javascript'); res.end(await fs.readFile(new URL('../lib/client.js', import.meta.url))); return; }
    if (pathname === '/frame') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(await fs.readFile(new URL('../lib/scene.html', import.meta.url))); return; }
    const route = routes.find(route => route.path === pathname);
    if (route) { await route.handler(req, res); return; }
    if (pathname === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(transforms.reduce((html, transform) => transform(html), index)); return; }
    res.writeHead(404); res.end('Not found');
  } catch { res.writeHead(500); res.end('Preview error'); }
});
const port = Number(process.env.PORT || 4173);
server.listen(port, '127.0.0.1', () => console.log('Plugin preview: http://127.0.0.1:' + port));
process.on('SIGINT', () => { disposers.forEach(dispose => dispose?.()); server.close(() => process.exit()); });
