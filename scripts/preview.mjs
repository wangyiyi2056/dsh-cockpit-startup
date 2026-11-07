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
    if (pathname === '/welcome-preview') {
      // Development-only route. Production still uses both confirmation gates.
      const html = (await fs.readFile(new URL('../lib/scene.html', import.meta.url), 'utf8'))
        .replace('/*__COCKPIT_CONFIG__*/', 'window.__DSH_COCKPIT_FRAME__={sound:false};')
        .replace('observer.disconnect();beginAccess();', 'observer.disconnect();reviewProgress(100);enterHome();');
      res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); return;
    }
    if (pathname === '/layout-preview') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(`<!doctype html><html><head><meta charset="utf-8"><title>Cockpit viewport review</title>
      <style>body{margin:0;background:#17202c;color:#d2e5f6;font:14px system-ui}header{padding:14px;display:flex;gap:12px;align-items:center}button,select{font:inherit;padding:7px}#stage{margin:0 14px;overflow:hidden}iframe{border:0;display:block;transform-origin:top left}</style></head>
      <body><header><label>Preview size <select aria-label="Preview size"><option value="1920,1080">1920 × 1080</option><option value="3840,2160">3840 × 2160 · 4K</option><option value="3440,1440">3440 × 1440 · Ultrawide</option><option value="1024,768">1024 × 768</option><option value="375,812">375 × 812 · Mobile</option></select></label><button data-time="3">Whale · 3 s</button><button data-time="7.5">Dispersal · 7.5 s</button><button data-time="11">Stars · 11 s</button><button id="play">Play</button></header>
      <div id="stage"><iframe title="Welcome layout" src="/welcome-preview"></iframe></div>
      <script>const frame=document.querySelector('iframe'),select=document.querySelector('select'),stage=document.querySelector('#stage');function fit(){const [w,h]=select.value.split(',').map(Number),scale=Math.min((innerWidth-28)/w,(innerHeight-80)/h,1);frame.style.width=w+'px';frame.style.height=h+'px';frame.style.transform='scale('+scale+')';stage.style.width=w*scale+'px';stage.style.height=h*scale+'px'}select.onchange=fit;window.onresize=fit;fit();for(const button of document.querySelectorAll('[data-time]'))button.onclick=()=>{const video=frame.contentDocument.querySelector('.dc-home-video');video.playbackRate=0;video.currentTime=Number(button.dataset.time)};document.querySelector('#play').onclick=()=>{const video=frame.contentDocument.querySelector('.dc-home-video');video.playbackRate=1;video.play()};</script></body></html>`); return;
    }
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
