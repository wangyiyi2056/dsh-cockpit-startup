// Scoped theme: it survives the startup overlay and disappears when the plugin unloads.
export function mountWorkspaceBackground(media, config, createAmbientVideo) {
  const old = window.__DSH_COCKPIT_BACKGROUND__;
  if (old) return old;
  const layer = document.createElement('div'); layer.id = 'dsh-cockpit-workspace-background';
  layer.setAttribute('aria-hidden', 'true'); layer.inert = true;
  const video = document.createElement('video'); video.className = 'dsh-cockpit-workspace-video';
  const style = document.createElement('style'); style.id = 'dsh-cockpit-workspace-style';
  style.textContent = `
    #dsh-cockpit-workspace-background{position:fixed;inset:0;z-index:-1;pointer-events:none;overflow:hidden;background:#030710;opacity:0;transition:opacity .6s;isolation:isolate}
    #dsh-cockpit-workspace-background video{width:100%;height:100%;object-fit:cover;filter:brightness(.78) saturate(.95)}
    #dsh-cockpit-workspace-background:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,#03081299,#03081255 55%,#03081277),linear-gradient(0deg,#03081255,transparent 70%)}
    body[data-dsh-cockpit-theme]{isolation:isolate;background:transparent!important;--dsw-alias-bg-base:transparent!important;--dsw-specific-sidebar-fill:#051020aa!important;--dsw-alias-bg-layer-1:#061322cc!important;--dsw-alias-bg-layer-2:#0a1b2ddd!important;--dsw-alias-bg-layer-3:#11253be6!important;--dsw-alias-label-primary:#e4f2ff!important;--dsw-alias-label-secondary:#bed1e4!important;--dsw-alias-label-tertiary:#91acc5!important}
    body[data-dsh-cockpit-theme]>#root,body[data-dsh-cockpit-theme] [data-slot="root"],body[data-dsh-cockpit-theme] :has(>[data-shell-overlay]){background:transparent!important}
  `;
  document.head.appendChild(style); layer.appendChild(video); document.body.appendChild(layer);
  const hadTheme = document.body.hasAttribute('data-dsh-cockpit-theme');
  const previousTheme = document.body.getAttribute('data-dsh-cockpit-theme');
  document.body.setAttribute('data-dsh-cockpit-theme', 'active');
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  const controller = createAmbientVideo(video, { source: media.source, fallback: media.fallback, poster: media.poster, reduced });
  let disposed = false;
  const api = { element: layer, video, reveal(time = 0) {
    if (disposed) return;
    if (Number.isFinite(time) && time > 0) { try { video.currentTime = time; } catch {} }
    layer.style.opacity = '1'; controller.play();
  }, dispose() {
    if (disposed) return; disposed = true; controller.dispose(); layer.remove(); style.remove();
    if (hadTheme) document.body.setAttribute('data-dsh-cockpit-theme', previousTheme); else document.body.removeAttribute('data-dsh-cockpit-theme');
    delete window.__DSH_COCKPIT_BACKGROUND__;
  } };
  window.__DSH_COCKPIT_BACKGROUND__ = api; return api;
}
