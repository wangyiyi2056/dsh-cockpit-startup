// Self-contained: this function is serialized into both host and client bundles.
export function mountCockpit(sceneHtml, input, installBackground, createAmbientVideo) {
  const key = 'dsh-cockpit-startup';
  if (window.__DSH_COCKPIT_RUNTIME__) return window.__DSH_COCKPIT_RUNTIME__;
  const cfg = { enabled: true, mode: 'session', language: 'en', sound: true, workspaceBackground: true, welcomeDuration: 12, ...input };
  const read = (store, name) => { try { return window[store].getItem(key + ':' + name); } catch { return null; } };
  const write = (store, name, value) => { try { window[store].setItem(key + ':' + name, value); } catch {} };
  const today = new Date().toLocaleDateString('en-CA');
  const placeholder = document.getElementById('dsh-cockpit-root');
  const critical = document.getElementById('dsh-cockpit-critical');
  const bundledVideo = sceneHtml.match(/class="dc-home-video" src="([^"]+)"/)?.[1] || '';
  const bundledPoster = sceneHtml.match(/class="dc-home-video"[^>]*poster="([^"]+)"/)?.[1] || '';
  const media = { source: cfg.backgroundVideo || (cfg.backgroundImage ? '' : bundledVideo), fallback: bundledVideo, poster: cfg.backgroundImage || bundledPoster };
  const background = cfg.enabled && cfg.workspaceBackground ? installBackground?.(media, cfg, createAmbientVideo) : null;
  if (!cfg.enabled || (cfg.mode === 'session' && read('sessionStorage', 'shown') === '1') || (cfg.mode === 'daily' && read('localStorage', 'day') === today)) {
    placeholder?.remove(); critical?.remove(); background?.reveal();
    if (!background) return null;
    const api = { dispose() { background.dispose(); delete window.__DSH_COCKPIT_RUNTIME__; }, ready: false };
    window.__DSH_COCKPIT_RUNTIME__ = api; return api;
  }
  try {
    const preferences = JSON.parse(read('localStorage', 'preferences') || '{}');
    if (['en', 'zh'].includes(preferences.language)) cfg.language = preferences.language;
    if (typeof preferences.sound === 'boolean') cfg.sound = preferences.sound;
  } catch {}
  const root = placeholder || document.createElement('div');
  root.id = 'dsh-cockpit-root';
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', 'DeepSeek Harness startup');
  root.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:#030710;opacity:1;transition:opacity .45s ease;';
  if (!root.parentNode) document.body.appendChild(root);
  const previousFocus = document.activeElement;
  const previousOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = 'hidden';
  const inertRecords = new Map();
  function isolate() {
    for (const element of document.body.children) {
      if (element !== root && !['SCRIPT', 'STYLE', 'LINK'].includes(element.tagName) && !inertRecords.has(element)) {
        inertRecords.set(element, element.inert); element.inert = true;
      }
    }
  }
  isolate();
  const observer = new MutationObserver(isolate); observer.observe(document.body, { childList: true });
  const frame = document.createElement('iframe');
  frame.title = 'DeepSeek Harness cockpit'; frame.allow = 'autoplay';
  frame.style.cssText = 'border:0;width:100%;height:100%;display:block;background:#030710;';
  frame.style.visibility = 'hidden';
  const channel = crypto.randomUUID();
  let disposed = false, ready = false, closing = false, welcomeTimer = 0, removeTimer = 0, welcomeTimeDone = false, welcomeVoiceDone = true;
  function finalize() {
    if (disposed) return; disposed = true; clearTimeout(removeTimer); clearTimeout(watchdog); clearTimeout(welcomeTimer);
    observer.disconnect(); window.removeEventListener('message', onMessage); window.removeEventListener('pagehide', onPageHide); window.removeEventListener('keydown', onKeyDown, true);
    root.remove(); critical?.remove();
    background?.reveal();
    document.documentElement.style.overflow = previousOverflow;
    // Only undo the state this overlay owns. Another host overlay may have
    // released an element that was already inert when we first saw it.
    for (const [element, wasInert] of inertRecords) if (!wasInert) element.inert = false;
    if (previousFocus?.isConnected && !previousFocus.inert) previousFocus.focus?.({ preventScroll: true });
  }
  function dispose(immediate = false) {
    if (disposed) return;
    if (closing) { if (immediate) finalize(); return; }
    closing = true;
    frame.contentWindow?.postMessage({ channel, type: 'dispose' }, '*');
    if (immediate) { finalize(); return; }
    root.style.opacity = '0'; root.style.pointerEvents = 'none';
    removeTimer = setTimeout(finalize, 480);
  }
  function onMessage(event) {
    const message = event.data;
    if (event.source !== frame.contentWindow || !message || message.channel !== channel || disposed || closing) return;
    if (message.type === 'ready') {
      ready = true; clearTimeout(watchdog);
      write('sessionStorage', 'shown', '1'); write('localStorage', 'day', today);
      root.dataset.ready = 'true'; critical?.remove();
      frame.style.visibility = 'visible'; frame.focus();
    } else if (message.type === 'preferences') {
      const next = message.preferences;
      if (next && ['en', 'zh'].includes(next.language) && typeof next.sound === 'boolean') write('localStorage', 'preferences', JSON.stringify({ language: next.language, sound: next.sound }));
    } else if (message.type === 'home') {
      root.dataset.home = 'true'; clearTimeout(welcomeTimer);
      welcomeVoiceDone = message.voicePending !== true;
      welcomeTimer = setTimeout(() => { welcomeTimeDone = true; if (welcomeVoiceDone) dispose(); }, message.reduced ? 2000 : Math.min(30, Math.max(10, Number(cfg.welcomeDuration) || 12)) * 1000);
    } else if (message.type === 'welcomeComplete') {
      welcomeVoiceDone = true; if (welcomeTimeDone) dispose();
    } else if (message.type === 'exit' || message.type === 'error') dispose(message.type === 'error');
  }
  const watchdog = setTimeout(() => { if (!ready) dispose(true); }, 15000);
  function onPageHide() { dispose(true); background?.dispose(); }
  function onKeyDown(event) {
    if (!ready || disposed || closing || event.defaultPrevented || event.isComposing || event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !['Enter', 'Escape'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    frame.contentWindow?.postMessage({ channel, type: 'keyboard', key: event.key }, '*');
  }
  window.addEventListener('message', onMessage); window.addEventListener('pagehide', onPageHide);
  window.addEventListener('keydown', onKeyDown, true);
  const json = JSON.stringify({ ...cfg, _channel: channel }).replace(/</g, '\\u003c');
  frame.srcdoc = sceneHtml.replace('/*__COCKPIT_CONFIG__*/', 'window.__DSH_COCKPIT_FRAME__=' + json + ';');
  root.replaceChildren(frame);
  frame.focus();
  const api = { dispose(immediate = false) { dispose(immediate); if (immediate) { background?.dispose(); delete window.__DSH_COCKPIT_RUNTIME__; } }, get ready() { return ready; } };
  window.__DSH_COCKPIT_RUNTIME__ = api;
  return api;
}
