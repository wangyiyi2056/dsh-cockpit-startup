import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULTS, normalize } from './config.js';

export const name = 'dsh-cockpit-startup';
export const inject = ['webServer', 'connection'];
const base = '/dsh-cockpit';
const lib = path.dirname(fileURLToPath(import.meta.url));
const version = JSON.parse(fs.readFileSync(path.join(lib, '../package.json'), 'utf8')).version;
const configFile = () => path.join(process.env.DSH_HOME || path.join(os.homedir(), '.dsh'), 'dsh-cockpit.json');
const safeJson = value => JSON.stringify(value).replace(/</g, '\\u003c');
function readConfig() { try { return normalize(JSON.parse(fs.readFileSync(configFile(), 'utf8'))); } catch { return { ...DEFAULTS }; } }
function writeConfig(input) {
  const result = normalize(input), file = configFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + '.tmp', JSON.stringify(result, null, 2), { mode: 0o600 });
  fs.renameSync(file + '.tmp', file); return result;
}
function service(ctx, key) { try { return ctx.get?.(key) || ctx[key]; } catch { return ctx[key]; } }
function send(res, status, body, type = 'application/json; charset=utf-8') {
  const bytes = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  res.writeHead(status, { 'Content-Type': type, 'Content-Length': bytes.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(bytes);
}
async function bodyJson(req) {
  const parts = []; let size = 0;
  for await (const part of req) {
    size += Buffer.byteLength(part);
    if (size > 16 * 1024) throw Object.assign(new Error('Request body too large'), { status: 413 });
    parts.push(Buffer.from(part));
  }
  try { return JSON.parse(Buffer.concat(parts).toString('utf8')); } catch { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
}

export function apply(ctx) {
  const server = service(ctx, 'webServer');
  if (!server?.register || !server?.tapIndex) {
    ctx.logger?.warn?.('[dsh-cockpit-startup] No webServer; client bundle will use local defaults.'); return;
  }
  const disposers = [];
  function guard(handler) {
    return async (req, res) => {
      // Same connection trust boundary as the community plugin. Fail closed on service errors.
      let rejection;
      try { rejection = service(ctx, 'connection')?.requestRejection?.(req); } catch { rejection = 403; }
      if (rejection !== undefined && rejection !== null && rejection !== false) { res.statusCode = typeof rejection === 'number' ? rejection : 403; res.end(); return; }
      try { await handler(req, res); } catch (error) { send(res, error.status || 500, { ok: false, error: error.status ? error.message : 'Unable to save cockpit configuration' }); }
    };
  }
  function register(route) { disposers.push(server.register({ ...route, handler: guard(route.handler) })); }
  register({ kind: 'exact', path: base + '/boot.js', handler: (req, res) => send(res, 200, fs.readFileSync(path.join(lib, 'boot.js'), 'utf8'), 'application/javascript; charset=utf-8') });
  register({ kind: 'exact', path: base + '/config', handler: async (req, res) => {
    if (req.method === 'GET' || !req.method) { send(res, 200, { ok: true, version, config: readConfig(), defaults: DEFAULTS }); return; }
    if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); send(res, 405, { ok: false, error: 'Method not allowed' }); return; }
    const contentType = String(req.headers?.['content-type'] || '').toLowerCase();
    if (!contentType.startsWith('application/json')) { send(res, 415, { ok: false, error: 'Use application/json' }); return; }
    const payload = await bodyJson(req);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) { send(res, 400, { ok: false, error: 'Expected a JSON object' }); return; }
    const patch = payload.patch && typeof payload.patch === 'object' && !Array.isArray(payload.patch) ? payload.patch : payload;
    const config = writeConfig(payload.action === 'reset' ? DEFAULTS : { ...readConfig(), ...patch });
    send(res, 200, { ok: true, version, config, defaults: DEFAULTS });
  } });
  disposers.push(server.tapIndex(html => {
    if (!html || html.includes('id="dsh-cockpit-root"') || html.includes(base + '/boot.js')) return html;
    const config = readConfig(); if (!config.enabled) return html;
    const critical = '<style id="dsh-cockpit-critical">#dsh-cockpit-root{position:fixed;inset:0;background:#030710;z-index:2147483000}</style>';
    const bootstrap = '<div id="dsh-cockpit-root"></div><script>window.__DSH_COCKPIT_CONFIG__=' + safeJson(config) + ';setTimeout(function(){var r=document.getElementById("dsh-cockpit-root");if(r&&!window.__DSH_COCKPIT_RUNTIME__)r.remove();},17000);</script><script defer src="' + base + '/boot.js"></script>';
    let out = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, critical + '</head>') : critical + html;
    out = /<body\b[^>]*>/i.test(out) ? out.replace(/<body\b[^>]*>/i, match => match + bootstrap) : out + bootstrap;
    return out;
  }));
  const cleanup = () => { for (const dispose of disposers.splice(0).reverse()) { try { dispose?.(); } catch {} } };
  ctx.effect(() => cleanup);
}
