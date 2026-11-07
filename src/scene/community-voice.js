/*
 * English voice selection adapted from QIFANAI/dsh-startup-screen (MIT).
 * Copyright (c) 2026 沈宏宏 and dsh-startup-screen contributors.
 * Full permission notice is included in the package LICENSE.
 */
function createCommunityVoice({ settings, enabled, onStatus, onVoices, playCue }) {
  const synth = window.speechSynthesis;
  const supported = !!synth && typeof window.SpeechSynthesisUtterance === 'function';
  const naturalHints = ['natural', 'neural', 'online', 'premium', 'enhanced', 'siri', 'google'];
  const femaleHints = ['aria', 'jenny', 'michelle', 'emma', 'ava', 'libby', 'sonia', 'maisie',
    'zira', 'samantha', 'karen', 'moira', 'tessa', 'victoria', 'serena', 'allison',
    'susan', 'fiona', 'hazel', 'female', 'woman'];
  const maleHints = ['david', 'mark', 'guy', 'ryan', 'george', 'daniel', 'alex', 'fred', 'male'];
  let voices = [], generation = 0, tail = Promise.resolve(), warmed = false;
  const jobs = new Set();

  function score(voice) {
    const name = voice.name.toLowerCase();
    let value = 25;
    if (naturalHints.some(hint => name.includes(hint))) value += 60;
    if (femaleHints.some(hint => name.includes(hint))) value += 40;
    if (maleHints.some(hint => name.includes(hint))) value -= 45;
    if (voice.localService) value += 4;
    if (voice.default) value += 3;
    return value;
  }
  function load() {
    if (!supported) return;
    try { voices = synth.getVoices().filter(v => /^en(?:[-_]|$)/i.test(v.lang)).sort((a,b) => score(b)-score(a)); }
    catch (_) { voices = []; }
    onVoices?.();
  }
  function selected() {
    return voices.find(voice => voice.name === settings.voiceName) || voices[0] || null;
  }
  function status(state, text = '', detail = '') {
    onStatus({ state, text, detail, voiceName: selected()?.name || 'English / Auto' });
  }
  function unlock() {
    if (!supported) return;
    load();
    try {
      synth.resume();
      if (warmed) return;
      warmed = true;
      const warmup = new window.SpeechSynthesisUtterance(' '), voice = selected();
      warmup.volume = 0;
      if (voice) { warmup.voice = voice; warmup.lang = voice.lang; }
      synth.speak(warmup);
    } catch (_) {}
  }
  async function waitForVoices() {
    load();
    if (!supported || voices.length) return;
    await new Promise(resolve => {
      const timer = setTimeout(done, 1200);
      function done() { clearTimeout(timer); synth.removeEventListener?.('voiceschanged', done); resolve(); }
      synth.addEventListener?.('voiceschanged', done, { once:true });
    });
    load();
  }
  function stop() {
    generation++;
    for (const job of [...jobs]) job.finish('cancelled');
    try { synth?.cancel(); } catch (_) {}
    tail = Promise.resolve();
  }
  async function run(text, requestGeneration) {
    if (requestGeneration !== generation) return 'cancelled';
    if (!enabled()) return 'disabled';
    if (!supported) { status('unavailable', '', '当前浏览器未提供英文语音'); return 'unavailable'; }
    status('loading', text);
    await waitForVoices();
    if (!enabled() || requestGeneration !== generation) return 'cancelled';
    return new Promise(resolve => {
      const utterance = new window.SpeechSynthesisUtterance(text);
      const voice = selected();
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang || 'en-US';
      utterance.rate = settings.voiceRate;
      utterance.pitch = settings.voicePitch;
      utterance.volume = settings.voiceVolume;
      let timer = 0, lead = 0, settled = false;
      const job = { finish(result) {
        if (settled) return;
        settled = true; clearTimeout(timer); clearTimeout(lead); jobs.delete(job);
        if (requestGeneration === generation && result !== 'cancelled') {
          status(result === 'ended' ? 'complete' : result === 'not-allowed' ? 'blocked' : 'error', text, result);
        }
        resolve(result);
      }};
      jobs.add(job);
      utterance.onstart = () => {
        if (requestGeneration !== generation || !enabled()) { job.finish('cancelled'); return; }
        status('speaking', text);
      };
      utterance.onend = () => job.finish('ended');
      utterance.onerror = event => job.finish(event.error || 'error');
      const timeout = Math.min(16000, Math.max(4500, text.length / 13 / settings.voiceRate * 1000 + 2600));
      timer = setTimeout(() => {
        job.finish('timeout');
        if (requestGeneration === generation) { try { synth.cancel(); } catch (_) {} }
      }, timeout);
      playCue?.();
      lead = setTimeout(() => {
        if (requestGeneration !== generation || !enabled()) { job.finish('cancelled'); return; }
        try { synth.resume(); synth.speak(utterance); } catch (_) { job.finish('error'); }
      }, settings.voiceLead);
    });
  }
  function say(text) {
    const requestGeneration = generation;
    const task = tail.then(() => run(text, requestGeneration)).catch(() => {
      if (requestGeneration === generation) status('error', text, 'speech-error');
      return 'error';
    });
    tail = task;
    return task;
  }
  if (supported) synth.addEventListener?.('voiceschanged', load);
  load();
  return { say, stop, load, unlock, supported, name: () => selected()?.name || 'English / Auto',
    choices: () => voices.filter(v => !/bad news|good news|bahh|bells|boing|bubbles|cellos|jester|organ|superstar|trinoids|whisper|zarvox|wobble|hysterical/i.test(v.name))
      .slice(0,10).map(v => ({ label:v.name.replace(/\s*[(（].*$/,'') + ' · ' + v.lang, value:v.name })) };
}
