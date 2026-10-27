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

test('catalog placeholders are instant and defer nearby previews without full-size requests',()=>{
  const source=read('index.html'),images=[...source.matchAll(/<img\b[^>]*data-store-screen=[^>]*>/g)].map(m=>attrs(m[0]));
  assert.equal(images.length,14);
  for(const image of images){assert.equal(image.loading,'lazy');assert.match(image.src,/^data:image\/webp;base64,/);assert.match(image['data-screen-src'],/^\/assets\/screens\//);assert.doesNotMatch(image['data-screen-src'],/-hq\.webp/);assert.equal(image.srcset,undefined);assert.ok(Number(image.width)>0&&Number(image.height)>0);}
  assert.equal((source.match(/class="screenshot-original"/g)||[]).length,14);
});

test('both language versions include every current store screenshot',()=>{
  for(const [slug,app] of Object.entries(manifest.apps))for(const prefix of ['apps','en/apps']){
    const source=read(`${prefix}/${slug}/index.html`),gallery=source.match(/<div class="gallery"[^>]*>(.*?)<\/div>/s)?.[1];
    assert.ok(gallery,slug);const images=[...gallery.matchAll(/<img\b[^>]*>/g)].map(m=>attrs(m[0]));
    assert.equal(images.length,app.screens.length,`${prefix}/${slug}`);
    images.forEach((image,i)=>{assert.equal(image['data-screen-src'],app.screens[i].variants[0].src);assert.equal(image.srcset,undefined);assert.match(image.src,/^data:image\/webp;base64,/);assert.equal(Number(image['data-store-screen']),i+1);});
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


function loader(count=5){
  const buttons=[],images=[],observations=[];
  for(let i=0;i<count;i++){
    const listeners={};let resolveDecode;
    const figure={append:button=>buttons.push(button)};
    images.push({dataset:{screenSrc:`small-${i}.webp`},naturalWidth:0,complete:false,
      closest:()=>figure,getAttribute:()=>'',getBoundingClientRect:()=>({top:100+i*20,height:100,left:0,right:100}),
      addEventListener:(event,fn)=>listeners[event]=fn,
      decode:()=>new Promise(resolve=>{resolveDecode=resolve;}),
      receive(){this.naturalWidth=320;listeners.load();},decodeDone(){resolveDecode();},fail(){listeners.error();}});
  }
  const sandbox={window:{IntersectionObserver:true,innerHeight:800,innerWidth:1200},
    IntersectionObserver:class{constructor(callback){observations.push(callback);}observe(){}unobserve(){}},
    document:{documentElement:{lang:'ru'},querySelectorAll:selector=>selector==='img[data-store-screen]'?images:[],createElement:()=>({dataset:{},addEventListener(event,fn){this[event]=fn;},remove(){}})}};
  vm.runInNewContext(read('assets/screenshot-loading.js'),sandbox);
  return {images,buttons,nearby:()=>observations[0](images.map(target=>({target,isIntersecting:true})))};
}

test('only two nearby screenshot requests run together and incomplete decodes stay hidden',async()=>{
  const {images,nearby}=loader();assert.ok(images.every(i=>i.dataset.imageState==='waiting'));
  nearby();assert.equal(images.filter(i=>i.dataset.imageState==='loading').length,2);
  assert.equal(images.filter(i=>i.dataset.imageState==='queued').length,3);
  images[0].receive();assert.equal(images[0].dataset.imageState,'loading','the full bitmap must decode before reveal');
  images[0].decodeDone();await new Promise(setImmediate);
  assert.equal(images[0].dataset.imageState,'ready');assert.ok(images.slice(2).some(i=>i.dataset.imageState==='loading'));
  assert.equal(images.filter(i=>i.dataset.imageState==='loading').length,2);
});

test('a failed image releases the queue, retains the complete placeholder and can retry',async()=>{
  const {images,buttons,nearby}=loader(3);nearby();images[0].fail();
  assert.equal(images[0].dataset.imageState,'error');assert.equal(images[2].dataset.imageState,'loading');assert.equal(buttons.length,1);
  buttons[0].click();assert.equal(images[0].dataset.imageState,'queued');
  images[1].receive();images[1].decodeDone();await new Promise(setImmediate);
  assert.match(images[0].src,/small-0\.webp\?retry=1/);
  images[0].receive();images[0].decodeDone();await new Promise(setImmediate);assert.equal(images[0].dataset.imageState,'ready');
});

test('product pages use a local font and keep gallery originals behind explicit links',()=>{
  for(const slug of Object.keys(manifest.apps))for(const prefix of ['apps','en/apps']){
    const source=read(`${prefix}/${slug}/index.html`);
    assert.match(source,/href="\/assets\/fonts\/manrope\.css/);
    assert.doesNotMatch(source,/<img[^>]+src="[^"]*-hq\.webp/);
    assert.doesNotMatch(source,/<img[^>]+srcset=/);
  }
  assert.doesNotMatch(read('assets/product-pages.css'),/fonts\.googleapis/);
  assert.doesNotMatch(read('index.html'),/@import[^;]*fonts\.googleapis/);
});
