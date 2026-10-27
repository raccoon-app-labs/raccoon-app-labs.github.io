import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8').replaceAll('\r\n','\n');
const copy=value=>JSON.parse(JSON.stringify(value));
const normalize=value=>String(value).replace(/\s+/gu,' ').trim();
function sources(){return [...fs.readdirSync(path.join(root,'assets/locales')).filter(n=>/^p-.*\.js$/.test(n)).map(n=>'assets/locales/'+n),'plus/locale-data.js'];}

test('all 25 dictionaries retain every translation and source alias when split',()=>{
 let count=0;
 for(const source of sources()){
  const base='assets/locales/optimized/'+path.basename(source,'.js')+'.base.js';if(!fs.existsSync(path.join(root,base)))continue;
  count++;
  const old={window:{}},current={window:{}};vm.runInNewContext(read(source),old);vm.runInNewContext(read(base),current);
  const key=old.window.HANZI_SITE_MESSAGES?'HANZI_SITE_MESSAGES':'HANZI_PLUS_MESSAGES';
  const original=old.window[key],data=current.window[key];
  assert.deepEqual(copy(data.en),copy(original.en));assert.deepEqual(copy(data.ru),copy(original.ru));
  for(const value of [...Object.values(original.en),...Object.values(original.ru)]){
   const alias=normalize(value);if(old.window.HANZI_SOURCE_ALIASES?.[alias])assert.equal(current.window.HANZI_SOURCE_ALIASES[alias],old.window.HANZI_SOURCE_ALIASES[alias]);
  }
  for(const [code,spec] of Object.entries(current.window.HANZI_LOCALE_PACKS.languages)){
   assert.equal(Object.keys(data[code]).length,0);
   const chunk=read(spec.src);
   assert.equal(spec.integrity,'sha256-'+crypto.createHash('sha256').update(chunk).digest('base64'));
   vm.runInNewContext(chunk,current);assert.deepEqual(copy(data[code]),copy(original[code]),source+': '+code);
  }
  assert.deepEqual(copy(current.window.HANZI_SOURCE_ALIASES),copy(old.window.HANZI_SOURCE_ALIASES||{}));
 }
 assert.equal(count,25);
});

test('late language chunks preserve store-specific overrides',()=>{
 const context={window:{}};vm.runInNewContext(read('assets/locales/optimized/locale-data.base.js'),context);
 context.window.HANZI_PLUS_MESSAGES.fr['Account email']='Store override';
 const spec=context.window.HANZI_LOCALE_PACKS.languages.fr;vm.runInNewContext(read(spec.src),context);
 assert.equal(context.window.HANZI_PLUS_MESSAGES.fr['Account email'],'Store override');
});

function loader(){
 const scripts=[],window={HANZI_LOCALE_PACKS:{initial:['en','ru'],languages:{fr:{src:'fr.js',integrity:'sha256-test'}}}};
 const document={head:{append:script=>scripts.push(script)},createElement:()=>({remove(){}})};
 vm.runInNewContext(read('assets/locales/load.js'),{window,document});return {load:window.HanziLanguageLoader,scripts};
}
test('RU/EN need no extra request and concurrent requests for another language are shared',async()=>{
 const {load,scripts}=loader();await load.load('ru');await load.load('en');assert.equal(scripts.length,0);
 const first=load.load('fr'),second=load.load('fr');assert.equal(first,second);assert.equal(scripts.length,1);assert.equal(scripts[0].integrity,'sha256-test');
 scripts[0].onload();await first;assert.equal(load.ready('fr'),true);await load.load('fr');assert.equal(scripts.length,1);
});
test('a language transfer failure keeps the current language usable and can be retried',async()=>{
 const {load,scripts}=loader();const first=load.load('fr');scripts[0].onerror();await assert.rejects(first);
 assert.equal(load.ready('ru'),true);const retry=load.load('fr');assert.equal(scripts.length,2);scripts[1].onload();await retry;
});
