import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const manifest=JSON.parse(read('assets/screens/manifest.json'));
const attrs=tag=>Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));

test('every official screenshot has valid local lossless previews and an original',()=>{
  assert.equal(Object.keys(manifest.apps).length,7);
  for(const app of Object.values(manifest.apps))for(const screen of app.screens){
    assert.match(screen.source,/^https:\/\/static\.rustore\.ru\//);
    assert.match(screen.placeholder,/^data:image\/webp;base64,/);
    for(const url of [screen.original,...screen.variants.map(v=>v.src)]){
      const parsed=new URL(url,'https://example.test'),bytes=fs.readFileSync(path.join(root,parsed.pathname));
      assert.equal(crypto.createHash('sha256').update(bytes).digest('hex').slice(0,12),parsed.searchParams.get('v'));
      assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
      let lossless=false;
      for(let offset=12;offset+8<=bytes.length;){const size=bytes.readUInt32LE(offset+4);if(bytes.toString('ascii',offset,offset+4)==='VP8L')lossless=true;offset+=8+size+(size%2);}
      assert.ok(lossless,`${url} must retain lossless UI pixels`);
    }
  }
});

test('all catalog previews start immediately and never request the full-size file',()=>{
  const source=read('index.html'),images=[...source.matchAll(/<img\b[^>]*data-store-screen=[^>]*>/g)].map(m=>attrs(m[0]));
  assert.equal(images.length,14);
  for(const image of images){assert.equal(image.loading,'eager');assert.doesNotMatch(image.src,/-hq\.webp/);assert.equal(image.srcset,undefined);assert.ok(Number(image.width)>0&&Number(image.height)>0);}
  assert.equal((source.match(/class="screenshot-original"/g)||[]).length,14);
});

test('both language versions include every current store screenshot',()=>{
  for(const [slug,app] of Object.entries(manifest.apps))for(const prefix of ['apps','en/apps']){
    const source=read(`${prefix}/${slug}/index.html`),gallery=source.match(/<div class="gallery"[^>]*>(.*?)<\/div>/s)?.[1];
    assert.ok(gallery,slug);const images=[...gallery.matchAll(/<img\b[^>]*>/g)].map(m=>attrs(m[0]));
    assert.equal(images.length,app.screens.length,`${prefix}/${slug}`);
    images.forEach((image,i)=>{assert.equal(image.src,app.screens[i].variants[0].src);assert.doesNotMatch(image.srcset,/-hq\.webp/);assert.equal(Number(image['data-store-screen']),i+1);});
    assert.doesNotMatch(source,/<a\b[^>]*class="screenshot-original"[^>]*>\s*<a\b/);
  }
});

test('switching page language preserves screenshot URLs and responsive candidates',()=>{
  const source=read('index.html'),start=source.indexOf('function applyLanguage('),end=source.indexOf('\n    switcher.addEventListener',start);
  assert.ok(start>0&&end>start);
  const images=[{src:'preview.webp?v=abc',srcset:'preview.webp?v=abc 320w'}];
  const sandbox={root:{},activeLanguage:'ru',detailPages:{neon:'apps/neon-cyber-wall-kicker/'},translations:{ru:{title:'RU',description:'RU'},en:{title:'EN',description:'EN'}},
    document:{querySelector:()=>({}),querySelectorAll:selector=>selector.includes('.app-gallery')?images:[]},switcher:{style:{setProperty(){}},querySelectorAll:()=>[]},localStorage:{setItem(){}}};
  vm.runInNewContext(source.slice(start,end)+";applyLanguage('en',false);applyLanguage('ru',false);",sandbox);
  assert.deepEqual(images,[{src:'preview.webp?v=abc',srcset:'preview.webp?v=abc 320w'}]);assert.equal(sandbox.root.lang,'ru');
});

test('a failed responsive request falls back to the small local preview and becomes ready',()=>{
  const listeners={},attributes={src:'small.webp',srcset:'small.webp 320w, medium.webp 640w'};
  const image={dataset:{screenFallback:'small.webp'},naturalWidth:0,closest:()=>null,getAttribute:name=>attributes[name],removeAttribute:name=>delete attributes[name],addEventListener:(name,fn)=>listeners[name]=fn};
  vm.runInNewContext(read('assets/screenshot-loading.js'),{window:{},document:{documentElement:{lang:'ru'},querySelectorAll:selector=>selector.startsWith('img')?[image]:[]}});
  listeners.error();assert.equal(image.src,'small.webp');assert.equal(image.loading,'eager');assert.equal(attributes.srcset,undefined);
  image.naturalWidth=320;listeners.load();assert.equal(image.dataset.imageState,'ready');
});
