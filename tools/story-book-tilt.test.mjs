import test from 'node:test';
import assert from 'node:assert/strict';
import {installBookCoverTilt} from '../assets/commerce/story-book-tilt.mjs';

function fixture(t) {
  const listeners = () => {
    const handlers = new Map();
    return {addEventListener(name, callback) { if (!handlers.has(name)) handlers.set(name, []); handlers.get(name).push(callback); }, emit(name, event = {}) { for (const callback of handlers.get(name) || []) callback(event); }};
  };
  const style = () => ({removeProperty(name) { delete this[name.replace(/-([a-z])/g, (_, char) => char.toUpperCase())]; }});
  const root = {dataset:{app:'stories'}}, doc = {...listeners(), documentElement:root, hidden:false};
  const raf = new Map(), mutations = []; let serial = 0, now = 0, reads = 0;
  const lightNode = {style:style()}, glare = {style:style(), querySelector:() => lightNode};
  const art = {style:style(), dataset:{}, querySelector:() => glare};
  const book = {isConnected:true, disabled:false, hidden:false, top:100, querySelector:() => art, getBoundingClientRect() { reads++; return {left:100, top:this.top}; }};
  for (const [name, value] of Object.entries({clientLeft:1, clientTop:1})) Object.defineProperty(book, name, {get() { reads++; return value; }});
  for (const [name, value] of Object.entries({offsetLeft:7, offsetTop:7, offsetWidth:180, offsetHeight:240})) Object.defineProperty(art, name, {get() { reads++; return value; }});
  const dialog = {...listeners(), open:true, contains:node => node === book, querySelector:() => ({})};
  const globals = {document:doc, matchMedia:query => ({matches:query.includes('pointer: fine'), addEventListener() {}}), addEventListener() {},
    requestAnimationFrame:callback => { raf.set(++serial, callback); return serial; }, cancelAnimationFrame:id => raf.delete(id),
    ResizeObserver:class { observe() {} unobserve() {} }, MutationObserver:class { constructor(callback) { mutations.push(callback); } observe() {} }};
  const saved = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, {configurable:true, writable:true, value});
  const controller = installBookCoverTilt(dialog);
  t.after(() => { controller.reset(); for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } });
  const move = (x, y, pointerType = 'mouse') => dialog.emit('pointermove', {target:{closest:() => book}, clientX:x, clientY:y, pointerType});
  const pump = (count = 180) => { for (let i = 0; i < count && raf.size; i++) { now += 16.667; const batch = [...raf.values()]; raf.clear(); for (const callback of batch) callback(now); } };
  return {dialog, book, art, root, doc, controller, mutations, move, pump, reads:() => reads, pending:() => raf.size};
}

test('cover movement reuses geometry and becomes idle after the tilt settles', t => {
  const f = fixture(t);
  f.move(118, 118); f.pump();
  assert.equal(f.reads(), 7, 'one hit-box measurement on entering the cover');
  assert.match(f.art.style.transform, /rotateY\(-/);
  f.move(278, 328); f.pump();
  assert.equal(f.reads(), 7, 'changing pointer position must not measure layout on every frame');
  assert.doesNotMatch(f.art.style.transform, /rotateY\(-/);
  assert.equal(f.pending(), 0, 'a settled hover must not keep an idle animation loop alive');
});

test('scrolling returns the cover smoothly, invalidates its hit box and respects reduced motion', t => {
  const f = fixture(t);
  f.move(118, 118); f.pump();
  const tilted = f.art.style.transform;
  f.dialog.emit('scroll'); f.pump(1);
  assert.equal(f.art.dataset.coverTilt, 'returning');
  assert.ok(f.art.style.transform, 'the first scroll frame must not abruptly remove the tilt');
  assert.notEqual(f.art.style.transform, tilted);
  f.pump();
  assert.equal(f.art.dataset.coverTilt, undefined);
  assert.equal(f.art.style.transform, undefined);
  assert.equal(f.reads(), 7, 'returning covers need no geometry measurements');
  f.dialog.emit('scrollend'); f.book.top = 50;
  f.move(118, 65); f.pump();
  assert.equal(f.reads(), 14, 'the new scroll position must be measured before the next tilt');
  f.root.dataset.motion = 'reduced'; f.mutations[0]();
  assert.equal(f.art.style.transform, undefined);
  assert.equal(f.pending(), 0);
  f.move(278, 260); f.pump();
  assert.equal(f.reads(), 14, 'reduced motion must not start work again');
});
