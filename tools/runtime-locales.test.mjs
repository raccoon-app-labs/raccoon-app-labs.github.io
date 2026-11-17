import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {runtimeKeys} from './runtime-locales.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const messages=JSON.parse(read('assets/locales/runtime-messages.json'));
const keys=Object.keys(messages.en);
const tokens=(value,regex)=>[...value.matchAll(regex)].map(match=>match[0]).sort();

test('all twelve runtime dictionaries preserve every key, placeholder and HTML marker',()=>{
  assert.equal(Object.keys(messages).length,12);
  for(const [code,dictionary]of Object.entries(messages)){
    assert.deepEqual(Object.keys(dictionary).sort(),[...keys].sort(),code+' key coverage');
    for(const key of keys){
      assert.equal(typeof dictionary[key],'string',code+' / '+key);
      assert.ok(dictionary[key].trim(),code+' / '+key+' must remain readable');
      assert.deepEqual(tokens(dictionary[key],/\{\w+\}/g),tokens(key,/\{\w+\}/g),code+' placeholders / '+key);
      assert.deepEqual(tokens(dictionary[key],/<\/?[a-z][^>]*>/gi),tokens(key,/<\/?[a-z][^>]*>/gi),code+' markup / '+key);
    }
  }
});

function* pages(dir=root){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(entry.name==='.git')continue;const file=path.join(dir,entry.name);if(entry.isDirectory())yield*pages(file);else if(entry.name.endsWith('.html'))yield file;}}
test('every page ships the dynamic keys used by its own scripts, including shared dictionaries',()=>{
  const loaded=new Map();let checked=0;
  for(const file of pages()){
    const page=path.relative(root,file).split(path.sep).join('/'),html=fs.readFileSync(file,'utf8');
    const needed=runtimeKeys(html,page);if(!needed.length)continue;
    const tag=[...html.matchAll(/<script\b[^>]*>/g)].map(match=>match[0]).find(tag=>tag.includes('data-locale-source='));
    assert.ok(tag,page+' has its locale bundle');
    const src=tag.match(/\ssrc="([^"]+)"/)[1],bundle=new URL(src,'https://site.test/'+page).pathname.slice(1);
    if(!loaded.has(bundle)){
      const window={};vm.runInNewContext(read(bundle),{window,Object});loaded.set(bundle,window);
    }
    const window=loaded.get(bundle),shipped=new Set(window.HANZI_LOCALE_PACKS.runtimeKeys),data=window.HANZI_SITE_MESSAGES||window.HANZI_PLUS_MESSAGES;
    for(const key of needed){
      assert.ok(shipped.has(key),page+' missing runtime key '+key);
      for(const code of ['en','ru'])assert.equal(typeof data[code][key],'string',page+' / '+code+' / '+key);
    }
    checked++;
  }
  assert.ok(checked>=16,'the audit reaches product demos and both shop entry paths');
});
