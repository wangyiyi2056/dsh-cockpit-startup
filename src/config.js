// Self-contained so the desktop client's local fallback uses this exact migration.
export function normalize(input) {
  const defaults = { configVersion: 2, enabled: true, mode: 'session', language: 'en', sound: true,
    identity: '', duration: 9, welcomeDuration: 12, workspaceBackground: true,
    backgroundImage: '', backgroundVideo: '' };
  function mediaUrl(value) {
    if (typeof value !== 'string' || value.length > 2048 || !value.trim()) return '';
    const text = value.trim();
    // A filesystem path is not a URL served by Harness. In v1.0 it disabled the bundled video.
    if (/^\/(?:Users|home|Volumes|Applications|private|tmp|var|mnt|media)(?:\/|$)/i.test(text)) return '';
    if (text.startsWith('/') && !text.startsWith('//') && !text.includes('\\')) return text;
    try { return new URL(text).protocol === 'https:' ? text : ''; } catch { return ''; }
  }
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const result = { ...defaults };
  for (const key of ['enabled', 'sound', 'workspaceBackground']) if (typeof source[key] === 'boolean') result[key] = source[key];
  if (['always', 'session', 'daily'].includes(source.mode)) result.mode = source.mode;
  if (['en', 'zh'].includes(source.language)) result.language = source.language;
  if (typeof source.identity === 'string') result.identity = source.identity.trim().slice(0, 40);
  for (const [key, min, max] of [['duration', 8, 16], ['welcomeDuration', 10, 30]]) {
    if (source[key] !== '' && Number.isFinite(Number(source[key]))) result[key] = Math.min(max, Math.max(min, Number(source[key])));
  }
  if (source.configVersion !== 2 && source.duration === 11) result.duration = 9;
  result.backgroundImage = mediaUrl(source.backgroundImage);
  result.backgroundVideo = mediaUrl(source.backgroundVideo);
  return result;
}

export const DEFAULTS = Object.freeze(normalize());
