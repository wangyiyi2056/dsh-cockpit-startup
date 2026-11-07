import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createAmbientVideo } from '../src/media.js';
import { mountWorkspaceBackground } from '../src/background.js';

const flush = () => new Promise(resolve => setImmediate(resolve));
function mediaHarness(options = {}, failFirst = false) {
  const events = new Map(), documentEvents = new Map(), attrs = new Map(), timers = new Map(), revoked = [];
  let plays = 0, pauses = 0, created = 0;
  const video = { dataset: {}, setAttribute: (name, value) => attrs.set(name, value), getAttribute: name => attrs.get(name), removeAttribute: name => attrs.delete(name),
    set src(value) { attrs.set('src', value); }, get src() { return attrs.get('src'); },
    load() {}, pause() { pauses++; }, play() { plays++; return failFirst && plays === 1 ? Promise.reject(new Error('AbortError')) : Promise.resolve(); },
    addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name) };
  const document = { hidden: false, addEventListener: (name, fn) => documentEvents.set(name, fn), removeEventListener: name => documentEvents.delete(name) };
  const scope = { video, options, document, Uint8Array, Blob, atob, URL: { createObjectURL: () => 'blob:fixture-' + ++created, revokeObjectURL: url => revoked.push(url) }, setTimeout: fn => { timers.set(1, fn); return 1; }, clearTimeout: id => timers.delete(id) };
  vm.createContext(scope);
  const controller = vm.runInContext('(' + createAmbientVideo.toString() + ')(video,options)', scope);
  return { controller, video, document, events, documentEvents, attrs, timers, revoked, plays: () => plays, pauses: () => pauses };
}
test('embedded MP4 uses a Blob; an initial rejected play can recover and resumes after visibility changes', async () => {
  const h = mediaHarness({ source: 'data:video/mp4;base64,MDAw', poster: 'poster.webp' }, true);
  assert.equal(h.video.src, 'blob:fixture-1'); h.controller.play(); await flush();
  assert.equal(h.video.dataset.playback, 'waiting');
  h.events.get('canplay')(); await flush(); assert.equal(h.plays(), 2); assert.equal(h.video.dataset.playback, 'playing');
  h.document.hidden = true; h.documentEvents.get('visibilitychange')(); assert.equal(h.pauses(), 1);
  h.document.hidden = false; h.documentEvents.get('visibilitychange')(); await flush(); assert.equal(h.plays(), 3);
  h.controller.dispose(); assert.deepEqual(h.revoked, ['blob:fixture-1']); assert.equal(h.documentEvents.size, 0); assert.equal(h.events.size, 0);
});
test('failed custom video recovers to the bundled video, with a direct-data fallback when Blob loading fails', async () => {
  const bundled = 'data:video/mp4;base64,MDAw';
  const h = mediaHarness({ source: 'https://example.com/missing.mp4', fallback: bundled });
  h.controller.play(); await flush(); h.events.get('error')(); await flush(); assert.equal(h.video.src, 'blob:fixture-1');
  h.events.get('error')(); await flush(); assert.equal(h.video.src, bundled); assert.deepEqual(h.revoked, ['blob:fixture-1']);
  h.controller.dispose();
});
test('an explicit image background never starts a hidden video', async () => {
  const h = mediaHarness({ source: '', poster: 'https://example.com/image.webp' });
  h.controller.play(); await flush(); assert.equal(h.plays(), 0); assert.equal(h.video.poster, 'https://example.com/image.webp'); h.controller.dispose();
});
test('workspace theme is scoped and restores the previous theme marker on unload', () => {
  const attributes = new Map([['data-dsh-cockpit-theme', 'previous']]);
  const elements = [];
  const body = { hasAttribute: key => attributes.has(key), getAttribute: key => attributes.get(key), setAttribute: (key, value) => attributes.set(key, value), removeAttribute: key => attributes.delete(key), appendChild: node => elements.push(node) };
  const document = { body, head: { appendChild: node => elements.push(node) }, createElement: tag => ({ tag, style: {}, setAttribute() {}, appendChild(child) { this.child = child; }, remove() { this.removed = true; } }) };
  let played = 0, disposed = 0;
  const scope = { window: { matchMedia: () => ({ matches: false }) }, document, media: { source: 'video', poster: 'poster', fallback: 'video' }, create: () => ({ play() { played++; }, dispose() { disposed++; } }) };
  vm.createContext(scope);
  const theme = vm.runInContext('(' + mountWorkspaceBackground.toString() + ')(media,{},create)', scope);
  assert.equal(attributes.get('data-dsh-cockpit-theme'), 'active'); assert.equal(played, 0);
  theme.reveal(); assert.equal(played, 1); assert.equal(theme.element.style.opacity, '1');
  theme.dispose(); assert.equal(disposed, 1); assert.equal(attributes.get('data-dsh-cockpit-theme'), 'previous');
  assert.equal(elements.every(element => element.removed), true);
});
