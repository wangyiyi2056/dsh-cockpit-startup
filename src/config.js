export const DEFAULTS = Object.freeze({
  enabled: true, mode: 'session', language: 'en', sound: true,
  identity: '', duration: 11, welcomeDuration: 12,
  backgroundImage: '', backgroundVideo: ''
});

function mediaUrl(value) {
  if (typeof value !== 'string' || value.length > 2048 || !value.trim()) return '';
  const text = value.trim();
  if (text.startsWith('/') && !text.startsWith('//') && !text.includes('\\')) return text;
  try { return new URL(text).protocol === 'https:' ? text : ''; } catch { return ''; }
}

export function normalize(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const result = { ...DEFAULTS };
  for (const key of ['enabled', 'sound']) if (typeof source[key] === 'boolean') result[key] = source[key];
  if (['always', 'session', 'daily'].includes(source.mode)) result.mode = source.mode;
  if (['en', 'zh'].includes(source.language)) result.language = source.language;
  if (typeof source.identity === 'string') result.identity = source.identity.trim().slice(0, 40);
  for (const [key, min, max] of [['duration', 8, 16], ['welcomeDuration', 10, 30]]) {
    if (source[key] !== '' && Number.isFinite(Number(source[key]))) result[key] = Math.min(max, Math.max(min, Number(source[key])));
  }
  result.backgroundImage = mediaUrl(source.backgroundImage);
  result.backgroundVideo = mediaUrl(source.backgroundVideo);
  return result;
}
