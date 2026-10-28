import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(file,'utf8').replaceAll('\r\n','\n');
function* pages(dir=root){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(entry.name==='.git')continue;const file=path.join(dir,entry.name);if(entry.isDirectory())yield* pages(file);else if(entry.name.endsWith('.html'))yield file;}}
const attrs=tag=>Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
const local=(page,url)=>{const u=new URL(url,'https://site.test/'+path.relative(root,page).split(path.sep).join('/'));return u.origin==='https://site.test'?path.join(root,decodeURIComponent(u.pathname)):null;};

test('all page assets exist and every script integrity hash matches the shipped bytes',()=>{
 let count=0;
 for(const page of pages()){
  count++;
  for(const [tag] of read(page).matchAll(/<(?:script|link|img)\b[^>]*>/g)){
   const a=attrs(tag),url=a.src||a['data-lazy-src']||a.href;
   if(!url)continue;
   const file=local(page,url);if(!file)continue;
   assert.ok(fs.existsSync(file),`${path.relative(root,page)}: ${url}`);
   if(a.integrity){const expected='sha256-'+crypto.createHash('sha256').update(read(file)).digest('base64');assert.equal(a.integrity,expected,`${page}: ${url}`);}
  }
 }
 assert.equal(count,39);
});

test('product CSS preserves the original cascade and demos are initialized only by the nearby loader',()=>{
 const core=['product-pages','native-demos','dark-worlds','mobile-layout','native-mechanics'];
 assert.equal(read(path.join(root,'assets/product-core.css')),core.map(name=>'/* '+name+'.css */\n'+read(path.join(root,'assets/'+name+'.css')).replace(/@charset[^;]+;/g,'')).join('\n'));
 let count=0;
 for(const page of pages()){
  const html=read(page);if(!/<body[^>]+data-product=/.test(html))continue;count++;
  assert.equal((html.match(/href="\/assets\/product-core.css\?/g)||[]).length,1);
  assert.equal((html.match(/\ssrc="\/assets\/lazy-scripts.js\?/g)||[]).length,1);
  assert.ok(!/\ssrc="\/assets\/(?:native-mechanics|neon-current-demo|demo\/neon-comic\/art)\.js/.test(html),page);
  assert.ok(html.includes('data-lazy-target="#try"'),page);
 }
 assert.equal(count,14);
});

test('localized pages use one base dictionary and one on-demand language loader',()=>{
 let count=0;
 for(const page of pages()){
  const html=read(page);if(!html.includes('data-locale-source='))continue;count++;
  assert.equal((html.match(/data-locale-source=/g)||[]).length,1,page);
  assert.equal((html.match(/\ssrc="\/assets\/locales\/load.js\?/g)||[]).length,1,page);
  assert.ok(!/\ssrc="\/(?:assets\/locales\/p-[\w-]+|plus\/locale-data)\.js/.test(html),page);
 }
 assert.equal(count,37);
});

test('every themed page installs exactly one shared scroll activity controller',()=>{
 let count=0;for(const page of pages()){const html=read(page);if(!html.includes('/plus/theme.js?'))continue;count++;assert.equal((html.match(/src="\/assets\/appearance\/motion.js\?/g)||[]).length,1,page);}assert.equal(count,38);
});
