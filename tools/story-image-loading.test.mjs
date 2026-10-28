import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';

const boot = readFileSync(new URL('../plus/hub-start.js', import.meta.url), 'utf8');
function start(search, hash = '') {
  const links = [], root = {dataset:{}};
  runInNewContext(boot, {URLSearchParams, location:{search, hash}, document:{documentElement:root, head:{append:link => links.push(link)}, createElement:() => ({dataset:{}})}});
  return {links, root};
}

test('Stories landing page prioritizes the cover and warms inside pages before rendering', () => {
  const {links, root} = start('?app=stories&lang=ru');
  assert.equal(root.dataset.app, 'stories');
  assert.equal(root.dataset.accountRegion, 'global', 'image loading must not change the payment region');
  assert.deepEqual(links.map(link => [link.rel, link.as, link.href, link.fetchPriority]), [
    ['preload', 'image', '/assets/demo/bunny-page-1.webp', 'high'],
    ['preload', 'image', '/assets/demo/bunny-page-2.webp', 'low'],
    ['preload', 'image', '/assets/demo/bunny-page-3.webp', 'low'],
    ['preload', 'image', '/assets/demo/bunny-page-6.webp', 'low'],
    ['preload', 'image', '/assets/demo/bunny-page-8.webp', 'low'],
    ['preload', 'image', '/assets/demo/bunny-page-9.webp', 'low']
  ]);
});

test('other apps and links directly to offers do not compete with the book cover preload', () => {
  for (const app of ['', 'bloom', 'keys', 'neon']) assert.equal(start('?app=' + app).links.length, 0);
  assert.equal(start('?app=stories', '#plus').links.length, 0);
});

test('both shop entry pages discover the image preloads before blocking stylesheets', () => {
  for (const file of ['../plus/index.html', '../en/apps/hanzi-bloom/plus/index.html']) {
    const html = readFileSync(new URL(file, import.meta.url), 'utf8');
    const script = html.indexOf('/plus/hub-start.js?');
    assert.ok(script > 0 && script < html.indexOf('rel="stylesheet"'), file);
    assert.equal((html.match(/src="\/plus\/hub-start\.js\?/g) || []).length, 1);
  }
});

test('every physical book face has a distinct illustration in every Stories entry page', () => {
  for (const file of [
    '../plus/index.html', '../en/apps/hanzi-bloom/plus/index.html',
    '../apps/magical-stories/index.html', '../en/apps/magical-stories/index.html',
    '../apps/magical-stories/shop/index.html'
  ]) {
    const html = readFileSync(new URL(file, import.meta.url), 'utf8');
    const book = html.slice(html.indexOf('<div class="scroll-book">'), html.indexOf('<div class="book-spine">'));
    const images = [...book.matchAll(/<img\b[^>]*src="([^"]+)"/g)].map(match => match[1]);
    assert.equal(images.length, 6, file);
    assert.equal(new Set(images).size, 6, file + ': repeated image URL');
    const hashes = images.map(src => createHash('sha256').update(readFileSync(new URL('..' + src, import.meta.url))).digest('hex'));
    assert.equal(new Set(hashes).size, 6, file + ': duplicated illustration under another filename');
  }
});
