import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const flow = fs.readFileSync(new URL('../src/scene/access-flow.js', import.meta.url), 'utf8');
const handler = flow.slice(flow.indexOf('async function handleStartupKey('), flow.indexOf("document.addEventListener('keydown',handleStartupKey)"));
function keyboard(mode = 'permission', welcomeSpeech = Promise.resolve()) {
  const calls = [], state = { mode, audioUnlocked: true, welcomeSpeech };
  const scope = { state, root: {},
    confirmPermission() { calls.push('permission'); state.mode = 'permitting'; },
    confirmIdentity() { calls.push('identity'); state.mode = 'verifying'; },
    enterHome() { calls.push('home'); state.mode = 'entering'; },
    unlockOnInteraction() { calls.push('unlock'); state.audioUnlocked = true; },
    stopAudio() {}, notify(type) { calls.push(type); },
  };
  vm.createContext(scope); vm.runInContext(handler, scope);
  const press = (overrides = {}) => {
    const event = { key: 'Enter', target: { closest: () => null }, preventDefault() { this.prevented = true; }, ...overrides };
    return { event, done: scope.handleStartupKey(event) };
  };
  return { press, state, calls };
}

test('Enter confirms the current gate from the page body and only once per key press', async () => {
  const h = keyboard();
  const first = h.press(); await first.done;
  assert.equal(first.event.prevented, true); assert.deepEqual(h.calls, ['permission']);
  await h.press().done; assert.deepEqual(h.calls, ['permission']);
  h.state.mode = 'identity'; await h.press({ repeat: true }).done;
  assert.deepEqual(h.calls, ['permission'], 'holding Enter must not accept the next gate');
  await h.press().done; assert.deepEqual(h.calls, ['permission', 'identity']);
  h.state.mode = 'granted'; await h.press().done;
  assert.deepEqual(h.calls, ['permission', 'identity', 'home']);
});

test('Enter preserves language/audio controls, text editing and IME/modifier shortcuts', async () => {
  const h = keyboard();
  const control = { matches: () => false };
  const button = h.press({ target: { closest: selector => selector === 'button' ? control : null } });
  await button.done; assert.equal(button.event.prevented, undefined);
  for (const overrides of [{ isComposing: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }, { defaultPrevented: true }, { target: { closest: () => ({}) } }]) await h.press(overrides).done;
  assert.deepEqual(h.calls, []);
  h.state.audioUnlocked = false; await h.press().done;
  assert.deepEqual(h.calls, ['unlock', 'permission']);
});

test('Enter on the welcome screen still waits for the complete welcome narration', async () => {
  let finish;
  const speech = new Promise(resolve => { finish = resolve; });
  const h = keyboard('entered', speech), key = h.press();
  assert.deepEqual(h.calls, []);
  finish(); await key.done; assert.deepEqual(h.calls, ['exit']);
});
