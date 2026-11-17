import {mergeRuntimeMessages} from './runtime-locales.mjs';
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
  const extraAliases=old.window.HANZI_SOURCE_ALIASES||{};mergeRuntimeMessages(original,extraAliases,current.window.HANZI_LOCALE_PACKS.runtimeKeys||[]);
  old.window.HANZI_SOURCE_ALIASES=extraAliases;
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

test('the home page renders its source language before deferred dictionaries and loads the chosen extra language',async()=>{
 const html=read('index.html');
 const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].map(match=>({tag:match[1],body:match[2],index:match.index,src:match[1].match(/\bsrc="([^"]+)"/)?.[1]}));
 const bootstrap=scripts.find(script=>script.src?.startsWith('/assets/locales/bootstrap.js'));
 const base=scripts.find(script=>script.src?.includes('/assets/locales/optimized/')&&script.src.includes('.base.js'));
 const load=scripts.find(script=>script.src?.startsWith('/assets/locales/load.js'));
 const locale=scripts.find(script=>script.src?.startsWith('/plus/locale.js'));
 assert.doesNotMatch(bootstrap.tag,/\b(?:defer|async)\b/,'device preference precedes the source-language script');
 assert.ok(bootstrap.index<base.index&&base.index<load.index&&load.index<locale.index,'deferred consumers run after their dictionaries');
 for(const script of [base,load,locale]){assert.match(script.tag,/\bdefer\b/);assert.doesNotMatch(script.tag,/\basync\b/);}
 const inline=scripts.find(script=>!script.src&&script.body.includes('const translations='));
 const source=inline.body.slice(0,inline.body.indexOf('    let raf='));
 assert.ok(source.includes('applyLanguage(activeLanguage,false)'));
 for(const [device,expected]of [['ru-RU','ru'],['en-US','en'],['fr-CA','en'],['it-IT','en']]){
  const values=new Map(),requests=[],heading={dataset:{i18nHtml:'heroTitle'}},copyNode={dataset:{i18n:'heroCopy'}},description={};
  const buttons=['ru','en'].map(lang=>({dataset:{lang},setAttribute(){}}));
  const switcher={style:{setProperty(){}},querySelectorAll:()=>buttons,addEventListener(){}};
  const document={documentElement:{},head:{append:script=>requests.push(script)},createElement:()=>({remove(){}}),
   querySelector:selector=>selector==='.language-switch'?switcher:selector==='meta[name=description]'?description:null,
   querySelectorAll:selector=>selector==='[data-i18n]'?[copyNode]:selector==='[data-i18n-html]'?[heading]:[]};
  const window={},context={window,document,localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)},navigator:{languages:[device]},location:new URL('https://site.test/'),URLSearchParams};
  vm.runInNewContext(read(new URL(bootstrap.src,'https://site.test/').pathname),context);
  vm.runInNewContext(source,context);
  assert.equal(window.HANZI_SITE_MESSAGES,undefined,'first source text does not need the deferred dictionary');
  assert.equal(document.documentElement.lang,expected,device+' source language');
  assert.match(heading.innerHTML,expected==='ru'?/Мобильные приложения/:/Mobile apps/);
  assert.ok(copyNode.textContent&&description.content,'source text and metadata are ready without a dictionary');
  vm.runInNewContext(read(new URL(base.src,'https://site.test/').pathname),context);
  vm.runInNewContext(read(new URL(load.src,'https://site.test/').pathname),context);
  const code=window.HANZI_INITIAL_LOCALE.code,pending=window.HanziLanguageLoader.load(code);
  if(code==='fr'){
   assert.equal(requests.length,1,'only the selected extra language is fetched');
   vm.runInNewContext(read(requests[0].src),context);requests[0].onload();
   assert.ok(Object.keys(window.HANZI_SITE_MESSAGES.fr).length>0);
  }else assert.equal(requests.length,0,'RU/EN and unsupported-device fallback need no extra transfer');
  await pending;assert.equal(window.HanziLanguageLoader.ready(code),true);
 }
});
