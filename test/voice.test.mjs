import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../src/scene/community-voice.js', import.meta.url), 'utf8');
test('short commands keep community voice priority, cue lead and uninterrupted queue', async () => {
  const spoken = [], cues = [], timers = new Set();
  let enabled = true, cancellations = 0;
  const synth = {
    getVoices: () => [{ name: 'Daniel', lang: 'en-GB', localService: true, default: true }, { name: 'Samantha', lang: 'en-US', localService: true }, { name: 'Microsoft Aria Online (Natural)', lang: 'en-US' }],
    addEventListener() {}, resume() {},
    speak(utterance) {
      if (!utterance.text.trim()) return;
      spoken.push({ utterance, at: Date.now() }); utterance.onstart?.();
      const timer = setTimeout(() => { timers.delete(timer); utterance.onend?.(); }, 40); timers.add(timer);
    },
    cancel() { cancellations++; for (const timer of timers) clearTimeout(timer); timers.clear(); }
  };
  const scope = { setTimeout, clearTimeout, window: { speechSynthesis: synth, SpeechSynthesisUtterance: function(text) { this.text = text; } } };
  vm.createContext(scope); vm.runInContext(source, scope);
  const voice = scope.createCommunityVoice({ settings: { voiceName: 'auto', voiceRate: .88, voicePitch: .85, voiceVolume: .9, voiceLead: 25 }, enabled: () => enabled, onStatus() {}, playCue: () => cues.push(Date.now()) });
  voice.unlock(); assert.equal(voice.name(), 'Microsoft Aria Online (Natural)');
  const results = await Promise.all([voice.say('Confirm ID.'), voice.say('ID confirmed.')]);
  assert.deepEqual(results, ['ended', 'ended']); assert.equal(cancellations, 0);
  assert.deepEqual(spoken.map(item => item.utterance.text), ['Confirm ID.', 'ID confirmed.']);
  spoken.forEach((item, index) => { assert.equal(item.utterance.rate, .88); assert.equal(item.utterance.pitch, .85); assert.ok(item.at - cues[index] >= 20); });
  const active = voice.say('Access granted.'), queued = voice.say('Confirm ID.');
  await new Promise(resolve => setTimeout(resolve, 30)); voice.stop();
  assert.equal(await active, 'cancelled'); assert.equal(await queued, 'cancelled');
  enabled = false; assert.equal(await voice.say('Confirm ID.'), 'disabled');
});
