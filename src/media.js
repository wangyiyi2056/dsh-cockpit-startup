// Shared by the isolated startup document and the persistent Harness wallpaper.
export function createAmbientVideo(video, options = {}) {
  let wanted = false, disposed = false, pending = false, objectUrl = '', retry = 0, fallbackUsed = false, directUsed = false, attempts = 0;
  const original = Object.hasOwn(options, 'source') ? options.source : video.getAttribute('src') || '';
  const fallback = options.fallback || original;
  const reduced = options.reduced === true;
  const report = state => { video.dataset.playback = state; options.onState?.(state); };
  function sourceUrl(source) {
    if (!source.startsWith('data:video/') || !globalThis.URL?.createObjectURL) return source;
    try {
      const comma = source.indexOf(','), bytes = atob(source.slice(comma + 1));
      const buffer = Uint8Array.from(bytes, character => character.charCodeAt(0));
      objectUrl = URL.createObjectURL(new Blob([buffer], { type: source.slice(5, source.indexOf(';')) }));
      return objectUrl;
    } catch { return source; }
  }
  function setSource(source, direct = false) {
    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = ''; }
    pending = false; video.src = direct ? source : sourceUrl(source); video.load();
  }
  video.muted = true; video.defaultMuted = true; video.loop = true; video.playsInline = true; video.preload = 'auto';
  video.setAttribute('muted', ''); video.setAttribute('playsinline', '');
  if (options.poster) video.poster = options.poster;
  if (original) setSource(original); else { video.removeAttribute('src'); video.load(); }
  function attempt() {
    if (disposed || !wanted || reduced || document.hidden || pending || !video.getAttribute('src')) return;
    pending = true; attempts++;
    try {
      Promise.resolve(video.play()).then(() => { pending = false; if (!disposed) report('playing'); }).catch(() => {
        pending = false;
        if (!disposed) { report('waiting'); clearTimeout(retry); if (attempts < 3) retry = setTimeout(attempt, 700); }
      });
    } catch { pending = false; report('waiting'); }
  }
  function onError() {
    pending = false;
    if (!fallbackUsed && fallback && fallback !== original) { fallbackUsed = true; attempts = 0; setSource(fallback); attempt(); }
    else if (objectUrl && !directUsed) { directUsed = true; attempts = 0; setSource(fallback || original, true); attempt(); }
    else report('poster');
  }
  function onVisibility() { if (document.hidden) { video.pause(); pending = false; } else attempt(); }
  function play() { wanted = true; attempt(); }
  function pause() { wanted = false; clearTimeout(retry); video.pause(); pending = false; }
  video.addEventListener('canplay', attempt); video.addEventListener('playing', onPlaying); video.addEventListener('error', onError);
  function onPlaying() { report('playing'); }
  document.addEventListener('visibilitychange', onVisibility);
  document.addEventListener('pointerdown', attempt, { capture: true }); document.addEventListener('keydown', attempt, { capture: true });
  return { play, pause, dispose() {
    if (disposed) return; disposed = true; pause();
    video.removeEventListener('canplay', attempt); video.removeEventListener('playing', onPlaying); video.removeEventListener('error', onError);
    document.removeEventListener('visibilitychange', onVisibility);
    document.removeEventListener('pointerdown', attempt, { capture: true }); document.removeEventListener('keydown', attempt, { capture: true });
    video.removeAttribute('src'); video.load(); if (objectUrl) URL.revokeObjectURL(objectUrl);
  } };
}
