// ModuleLoader factory, serialized by build.mjs; no client-side node imports.
export function clientFactory(require, mountCockpit, sceneHtml, defaults, version, installBackground, createAmbientVideo, normalizeConfig) {
  const React = require('react'), h = React.createElement;
  const storageKey = 'dsh-cockpit-startup:config', preferencesKey = 'dsh-cockpit-startup:preferences';
  const API = '/dsh-cockpit/config';
  const readLocal = () => { try { return normalizeConfig(JSON.parse(localStorage.getItem(storageKey) || '{}')); } catch { return { ...defaults }; } };
  let alive = true, currentRuntime = null;
  const pending = new Set();
  async function request(method, payload) {
    const controller = new AbortController(); pending.add(controller);
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(API, { method, signal: controller.signal, headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, ...(payload ? { body: JSON.stringify(payload) } : {}) });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const json = await response.json(); if (!json.ok) throw new Error(json.error || 'Configuration unavailable');
      return json.config;
    } finally { clearTimeout(timeout); pending.delete(controller); }
  }
  const STYLE = '.dshcp-panel{max-width:620px;display:grid;gap:18px;font-size:13px;color:var(--dsw-alias-label-primary)}.dshcp-panel label{display:grid;gap:7px}.dshcp-panel input:not([type=checkbox]),.dshcp-panel select{font:inherit;color:inherit;background:var(--dsw-alias-bg-layer-3,#18212e);border:1px solid var(--dsw-alias-border-l2,#425167);border-radius:7px;padding:8px;width:100%;box-sizing:border-box}.dshcp-panel .dshcp-check{display:flex;gap:9px;align-items:center}.dshcp-panel small{opacity:.7;line-height:1.6}.dshcp-panel button{font:inherit;padding:8px 16px;border:1px solid var(--dsw-alias-border-l2,#425167);background:var(--dsw-alias-bg-layer-3,#18212e);color:inherit;border-radius:7px;cursor:pointer}.dshcp-panel [role=status]{line-height:1.6}.dshcp-panel .dshcp-actions{display:flex;gap:10px}';
  const style = document.createElement('style'); style.dataset.plugin = 'dsh-cockpit-startup'; style.textContent = STYLE;
  document.head.appendChild(style);

  function Panel() {
    const [draft, setDraft] = React.useState(null), [localOnly, setLocalOnly] = React.useState(false);
    const [status, setStatus] = React.useState(''), [busy, setBusy] = React.useState(false);
    const zh = (draft?.language || defaults.language) === 'zh';
    const t = (en, cn) => zh ? cn : en;
    React.useEffect(() => {
      let active = true;
      request('GET').then(config => { if (active) setDraft(config); }).catch(() => { if (active) { setDraft(readLocal()); setLocalOnly(true); } });
      return () => { active = false; };
    }, []);
    const set = (key, value) => { setDraft(old => ({ ...old, [key]: value })); setStatus(''); };
    async function save(reset = false) {
      setBusy(true); setStatus('');
      try {
        const next = reset ? { ...defaults } : draft;
        const saved = localOnly ? next : await request('POST', reset ? { action: 'reset' } : { patch: next });
        localStorage.setItem(storageKey, JSON.stringify(saved)); localStorage.removeItem(preferencesKey);
        setDraft(saved); setStatus(t('Saved. Applies on next startup.', '已保存，下次启动生效。'));
      } catch (error) { setStatus(t('Save failed: ', '保存失败：') + error.message); }
      finally { setBusy(false); }
    }
    if (!draft) return h('p', null, 'DeepSeek Cockpit v' + version + ' …');
    function check(key, label) { return h('label', { className: 'dshcp-check' }, h('input', { type: 'checkbox', checked: draft[key], onChange: event => set(key, event.target.checked) }), label); }
    function field(key, label, options) {
      return h('label', null, label, options ? h('select', { value: draft[key], onChange: event => set(key, event.target.value) }, options.map(([value, name]) => h('option', { value, key: value }, name))) : h('input', { type: 'text', value: draft[key], maxLength: key === 'identity' ? 40 : 2048, onChange: event => set(key, event.target.value) }));
    }
    function range(key, label, min, max) { return h('label', null, label + ' · ' + draft[key] + ' s', h('input', { type: 'range', min, max, value: draft[key], onChange: event => set(key, Number(event.target.value)) })); }
    return h('div', { className: 'dshcp-panel' },
      h('strong', null, 'DeepSeek Cockpit · v' + version),
      check('enabled', t('Enable cockpit startup', '启用驾驶舱启动画面')),
      field('language', t('Language', '界面语言'), [['en', 'English'], ['zh', '中文']]),
      field('mode', t('Show startup', '播放时机'), [['session', t('Once per browser session', '每个浏览器会话一次')], ['always', t('Every page load', '每次打开')], ['daily', t('Once per day', '每天一次')]]),
      field('identity', t('Identity name (empty = Explorer 01)', '身份名称（留空使用默认探索者）')),
      check('sound', t('Narration and interface sounds', '语音播报与界面音效')),
      check('workspaceBackground', t('Keep cockpit video as workspace wallpaper', '进入控制台后继续使用驾驶舱动态背景')),
      range('duration', t('Loading duration', '加载时长'), 8, 16),
      range('welcomeDuration', t('Welcome screen duration', '欢迎画面停留'), 10, 30),
      field('backgroundImage', t('Background image URL (optional)', '背景图片地址（可选）')),
      field('backgroundVideo', t('Background video URL (optional)', '背景视频地址（可选）')),
      h('small', null, t('Use an HTTPS URL or a URL served by Harness. A computer file path is not a web URL. Leave empty for the bundled video.', '使用 HTTPS 地址或 Harness 提供的网页路径，不能填写电脑上的文件路径。留空使用内置动态背景。')),
      localOnly ? h('small', null, t('Client fallback: settings are saved in this browser.', '客户端回退模式：设置保存在当前浏览器。')) : null,
      h('div', { className: 'dshcp-actions' }, h('button', { disabled: busy, onClick: () => save() }, t('Save', '保存')), h('button', { disabled: busy, onClick: () => save(true) }, t('Restore defaults', '恢复默认'))),
      h('div', { role: 'status' }, status)
    );
  }
  return {
    inject: ['slots'],
    apply(ctx) {
      if (!window.__DSH_COCKPIT_RUNTIME__ && !document.getElementById('dsh-cockpit-root')) {
        request('GET').catch(readLocal).then(config => { if (alive) currentRuntime = mountCockpit(sceneHtml, normalizeConfig(config), installBackground, createAmbientVideo); });
      }
      ctx.slots.inject('settings.section', () => ctx.slots.register({ name: 'settings.section', id: 'cockpit-startup', order: 26, label: 'DeepSeek Cockpit' }, () => h(Panel)));
      ctx.effect(() => () => {
        alive = false; for (const controller of pending) controller.abort(); pending.clear();
        (currentRuntime || window.__DSH_COCKPIT_RUNTIME__)?.dispose(true); style.remove();
      });
    }
  };
}
