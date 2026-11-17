import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import vm from 'node:vm';

const source=readFileSync(process.env.LANGUAGE_BOOTSTRAP_SOURCE || new URL('../assets/locales/bootstrap.js',import.meta.url),'utf8');
const canonical='hanzi-plus-language',legacy='ral-language';

function boot({stored={},languages,language='en-US',url='https://site.test/',denyRead=false,denyWrite=false,forbidDevice=false}={}){
  const values=stored instanceof Map?stored:new Map(Object.entries(stored));
  const reads={languages:0,language:0},writes=[];
  const location=new URL(url),navigator={};
  Object.defineProperties(navigator,{
    languages:{get(){reads.languages++;assert.ok(!forbidDevice,'known preference must not inspect device languages');return languages;}},
    language:{get(){reads.language++;assert.ok(!forbidDevice,'known preference must not inspect device language');return language;}}
  });
  const localStorage={
    getItem(key){if(denyRead)throw new Error('Storage access blocked');return values.get(key)??null;},
    setItem(key,value){if(denyWrite)throw new Error('Storage access blocked');values.set(key,String(value));writes.push([key,String(value)]);}
  };
  const window={};
  const context={window,location,navigator,localStorage,URLSearchParams,Object};
  vm.runInNewContext(source,context);
  const preference=window.HanziLanguagePreference;
  assert.ok(preference,'the shared preference service is installed');
  return {preference,initial:window.HANZI_INITIAL_LOCALE,values,reads,writes,location,runAgain(){vm.runInNewContext(source,context);return window.HanziLanguagePreference;}};
}

test('first visit recognizes all supported device languages with regional and case variants',()=>{
  for(const [tag,expected]of [['en-GB','en'],['ru-RU','ru'],[' ES-mx ','es'],['pt_BR','pt'],['fr-CA','fr'],['de-AT','de'],['ar-SA','ar'],['hi-IN','hi'],['id-ID','id'],['ja-JP','ja'],['ko-KR','ko'],['tr-TR','tr']]){
    const f=boot({languages:[tag]});
    assert.equal(f.initial.code,expected,tag);
    assert.equal(f.values.get(canonical),expected,tag+' persists the full preference');
    assert.equal(f.values.get(legacy),expected==='ru'?'ru':'en',tag+' leaves a safe source language for old demos');
  }
});

test('unsupported primary device language uses English even when a secondary preference is supported',()=>{
  for(const tag of ['zh-Hans-CN','it-IT','uk-UA']){
    const f=boot({languages:[tag,'ru-RU'],language:'de-DE'});
    assert.equal(f.initial.code,'en');assert.equal(f.values.get(canonical),'en');
  }
  for(const languages of [[],undefined,['']]){
    const f=boot({languages,language:'ja-JP'});assert.equal(f.initial.code,'ja');
  }
  const missing=boot({languages:undefined,language:null});assert.equal(missing.initial.code,'en');
});

test('saved preference and explicit links skip device detection, with query taking priority',()=>{
  const saved=boot({stored:{[canonical]:'fr',[legacy]:'ru'},forbidDevice:true});
  assert.equal(saved.initial.code,'fr');assert.equal(saved.preference.resolve(),'fr');
  assert.deepEqual(saved.reads,{languages:0,language:0});
  const url='https://site.test/en/apps/muropolis/?order=123&lang=PT-br#details';
  const explicit=boot({stored:{[canonical]:'ru'},url,forbidDevice:true});
  assert.equal(explicit.initial.code,'pt');assert.equal(explicit.values.get(canonical),'pt');
  assert.deepEqual(explicit.reads,{languages:0,language:0});
  assert.equal(explicit.location.href,url,'locale choice does not rewrite routes, payment data or hashes');
  const invalid=boot({stored:{[canonical]:'de'},url:'https://site.test/?lang=zz',forbidDevice:true});
  assert.equal(invalid.initial.code,'de');assert.equal(invalid.preference.resolve(),'de');
});

test('old RU/EN preference migrates once and later source-language writes cannot replace it',()=>{
  for(const code of ['ru','en']){
    const f=boot({stored:{[legacy]:code},forbidDevice:true});
    assert.equal(f.initial.legacy,code);assert.equal(f.initial.code,code);assert.equal(f.values.get(canonical),code);
    assert.deepEqual(f.reads,{languages:0,language:0});
    f.values.set(legacy,code==='ru'?'en':'ru');assert.equal(f.preference.resolve(),code);
  }
  const invalid=boot({stored:{[canonical]:'bad',[legacy]:'bad'},languages:['ko-KR']});
  assert.equal(invalid.initial.code,'ko');assert.equal(invalid.values.get(canonical),'ko');
});

test('automatic and manual selections survive changed devices and page paths without redetection',()=>{
  const first=boot({languages:['ar-EG']});
  const revisit=boot({stored:first.values,languages:['ru-RU'],url:'https://site.test/en/apps/hanzi-bloom/',forbidDevice:true});
  assert.equal(revisit.initial.code,'ar');assert.equal(revisit.preference.resolve(),'ar');
  revisit.preference.remember('fr');assert.equal(revisit.values.get(canonical),'fr');assert.equal(revisit.values.get(legacy),'en');
  revisit.values.set(legacy,'ru');assert.equal(revisit.preference.resolve(),'fr');
  const next=boot({stored:revisit.values,forbidDevice:true,url:'https://site.test/apps/neon-cyber-wall-kicker/shop/'});
  assert.equal(next.initial.code,'fr');assert.deepEqual(next.reads,{languages:0,language:0});
});

test('device language is reconsidered only when explicitly requested and can be saved again',()=>{
  const f=boot({stored:{[canonical]:'fr'},languages:['ko-KR']});
  assert.deepEqual(f.reads,{languages:0,language:0});
  f.preference.remember(f.preference.device());
  assert.equal(f.preference.resolve(),'ko');assert.equal(f.values.get(canonical),'ko');
  assert.ok(f.reads.languages>0);
});

test('blocked storage retains the selected language in memory without repeated device reads',()=>{
  for(const options of [{denyRead:true},{denyWrite:true},{denyRead:true,denyWrite:true}]){
    const f=boot({...options,languages:['es-ES']});assert.equal(f.initial.code,'es');
    const reads={...f.reads};assert.equal(f.preference.resolve(),'es');assert.deepEqual(f.reads,reads);
    f.preference.remember('ja');assert.equal(f.preference.resolve(),'ja');assert.deepEqual(f.reads,reads);
  }
  const explicit=boot({denyRead:true,denyWrite:true,forbidDevice:true,url:'https://site.test/?lang=de'});
  assert.equal(explicit.initial.code,'de');assert.equal(explicit.preference.resolve(),'de');
});

test('repeated installation preserves the live preference without duplicate writes or device access',()=>{
  const f=boot({languages:['hi-IN']});f.preference.remember('pt');
  const writes=f.writes.length,reads={...f.reads};
  assert.equal(f.runAgain(),f.preference);assert.equal(f.writes.length,writes);assert.deepEqual(f.reads,reads);
  assert.equal(f.preference.resolve(),'pt');
  f.preference.remember('not-a-language');assert.equal(f.preference.resolve(),'pt');assert.equal(f.values.get(canonical),'pt');
});

test('every localized page loads preference bootstrap first and ships matching cache versions and integrity',()=>{
  const root=process.env.LANGUAGE_SITE_ROOT||fileURLToPath(new URL('../',import.meta.url));
  function* pages(directory){for(const entry of readdirSync(directory,{withFileTypes:true})){if(entry.name==='.git')continue;const file=path.join(directory,entry.name);if(entry.isDirectory())yield*pages(file);else if(entry.name.endsWith('.html'))yield file;}}
  const signatures=new Map();
  for(const asset of ['/assets/locales/bootstrap.js','/plus/locale.js']){
    const body=readFileSync(path.join(root,asset),'utf8').replaceAll('\r\n','\n'),hash=createHash('sha256').update(body).digest();
    signatures.set(asset,{version:hash.toString('hex').slice(0,12),integrity:'sha256-'+hash.toString('base64')});
  }
  let checked=0;
  for(const file of pages(root)){
    const html=readFileSync(file,'utf8'),tags=[...html.matchAll(/<script\b[^>]*\ssrc="[^"]+"[^>]*>/g)].map(match=>({tag:match[0],index:match.index,src:match[0].match(/\ssrc="([^"]+)"/)[1]}));
    const locale=tags.find(script=>script.src.split('?')[0]==='/plus/locale.js');if(!locale)continue;
    const bootstrap=tags.find(script=>script.src.split('?')[0]==='/assets/locales/bootstrap.js');
    assert.ok(bootstrap,path.relative(root,file)+' includes first-visit preference detection');
    assert.ok(bootstrap.index<locale.index,path.relative(root,file)+' establishes the preference before translation');
    assert.doesNotMatch(bootstrap.tag,/\s(?:defer|async)(?:\s|=|>)/,path.relative(root,file)+' resolves the source language synchronously');
    for(const script of [bootstrap,locale]){
      const url=new URL(script.src,'https://site.test/'),signature=signatures.get(url.pathname);
      assert.equal(url.searchParams.get('v'),signature.version,path.relative(root,file)+' cache version / '+url.pathname);
      assert.equal(script.tag.match(/\sintegrity="([^"]+)"/)?.[1],signature.integrity,path.relative(root,file)+' SRI / '+url.pathname);
    }
    checked++;
  }
  assert.ok(checked>=30,'coverage reaches the studio, product, shop and checkout pages');
});
