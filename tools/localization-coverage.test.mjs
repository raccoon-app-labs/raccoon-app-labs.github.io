// Static DOM coverage complements runtime-interaction tests and dictionary parity.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const normalize=value=>String(value).replace(/\s+/gu,' ').trim();
const languages=['en','ru','es','pt','fr','de','ar','hi','id','ja','ko','tr'];
const entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ndash:'–',mdash:'—',hellip:'…',laquo:'«',raquo:'»',rarr:'→',larr:'←',times:'×',copy:'©',euro:'€',shy:'\u00ad'};
const decode=value=>value.replace(/&(#x[\da-f]+|#\d+|\w+);/gi,(all,key)=>key.startsWith('#x')?String.fromCodePoint(parseInt(key.slice(2),16)):key.startsWith('#')?String.fromCodePoint(parseInt(key.slice(1),10)):entities[key]??all);
const attrs=text=>Object.fromEntries([...text.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)].slice(1).map(m=>[m[1].toLowerCase(),decode(m[2]??m[3]??m[4]??'')]));
const voids=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
function* htmlFiles(dir){for(const row of fs.readdirSync(dir,{withFileTypes:true})){if(row.name==='.git')continue;const file=path.join(dir,row.name);if(row.isDirectory())yield*htmlFiles(file);else if(row.name.endsWith('.html'))yield file;}}
function page(file){
  const html=fs.readFileSync(file,'utf8'),result={file:path.relative(root,file).replaceAll('\\','/'),scripts:[],texts:[]},stack=[];
  const tokens=html.matchAll(/<!--[^]*?-->|<(script|style)\b[^>]*>[^]*?<\/\1\s*>|<![^>]*>|<\/?[\w][^>]*>|[^<]+/gi);
  const add=(text,kind,line)=>{text=normalize(decode(text));if(text)result.texts.push({text,kind,line});};
  for(const match of tokens){
    const token=match[0],line=html.slice(0,match.index).split('\n').length;
    if(token.startsWith('<!'))continue;
    if(token.startsWith('</')){const tag=token.match(/^<\/([^\s>]+)/)[1].toLowerCase(),i=stack.findLastIndex(row=>row.tag===tag);if(i>=0)stack.splice(i);continue;}
    if(token.startsWith('<')){
      const tag=token.match(/^<([^\s>]+)/)[1].toLowerCase(),a=attrs(token.slice(0,token.indexOf('>')+1));
      if(tag==='script'&&a.src)result.scripts.push(a);
      // Original bilingual legal notices and Chinese learning glyphs are intentional.
      const skipped=stack.some(row=>row.skipped)||['script','style','noscript'].includes(tag)||Object.hasOwn(a,'data-no-l10n')||a.lang?.startsWith('zh');
      if(!skipped){for(const name of ['aria-label','aria-description','placeholder','title','alt'])if(a[name])add(a[name],name,line);if(tag==='meta'&&a.name==='description')add(a.content||'','meta-description',line);}
      if(!voids.has(tag)&&tag!=='script'&&tag!=='style')stack.push({tag,skipped});
    }else if(!stack.at(-1)?.skipped)add(token,'text',line);
  }
  return result;
}
function load(page){
  const source=page.scripts.find(script=>script['data-locale-source'])?.['data-locale-source'];
  if(!source)return null;
  const context={window:{}};vm.runInNewContext(read(source),context);
  if(page.scripts.some(script=>script.src.split('?')[0]==='/plus/regions-locales.js'))vm.runInNewContext(read('/plus/regions-locales.js'),context);
  return {source,data:context.window.HANZI_SITE_MESSAGES||context.window.HANZI_PLUS_MESSAGES,aliases:context.window.HANZI_SOURCE_ALIASES||{}};
}
function translator({data,aliases},lang){
  // Mirror locale.js matching: full source/alias, then templates, then sentences.
  const templates=Object.keys(data.en).filter(key=>/\{\w+\}/u.test(key)).sort((a,b)=>b.replace(/\{\w+\}/gu,'').length-a.replace(/\{\w+\}/gu,'').length).map(key=>{
    const names=[],escaped=key.split(/(\{\w+\})/u).map(part=>{if(/^\{\w+\}$/u.test(part)){names.push(part.slice(1,-1));return '(.+?)';}return part.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&');}).join('');
    return {key,names,pattern:new RegExp('^'+escaped+'$','u')};
  });
  const t=(key,params={})=>(data[lang]?.[key]??data.en[key]??key).replace(/\{(\w+)\}/gu,(all,name)=>params[name]??all);
  function translate(source,depth=0){
    const raw=normalize(source),value=Object.hasOwn(data.en,raw)?raw:aliases[raw]||raw;
    let result=data[lang]?.[value];
    if(result===undefined)for(const template of templates){const match=value.match(template.pattern);if(match){result=t(template.key,Object.fromEntries(template.names.map((name,i)=>[name,depth<3?translate(match[i+1],depth+1):match[i+1]])));break;}}
    if(result===undefined&&/^Hanzi (Bloom|Keys) Plus · The little app shop$/u.test(value))result=t('Hanzi Plus · The little app shop').replace('Hanzi Plus',value.split(' · ')[0]);
    if(result===undefined&&depth<3){const pieces=source.split(/(?<=[.!?])(\s+)(?=[A-ZА-ЯЁ0-9])/u);if(pieces.length>1)return pieces.map((piece,i)=>i%2?piece:translate(piece,depth+1)).join('');}
    return result===undefined?source:result;
  }
  return translate;
}
const pages=[...htmlFiles(root)].map(page),localized=pages.filter(p=>p.scripts.some(script=>script.src.split('?')[0]==='/plus/locale.js'));

test('every page with a language picker declares its source dictionary',()=>{
  assert.ok(pages.length>=59);assert.ok(localized.length>=30);
  assert.deepEqual(localized.filter(page=>!load(page)).map(page=>page.file),[]);
});

test('new static Russian UI copy and accessible labels are covered by English translations',()=>{
  const omissions=[];
  for(const page of localized){
    const translate=translator(load(page),'en');
    for(const row of page.texts){
      const result=translate(row.text).replaceAll('Покаместова Анастасия Максимовна','');
      // Official operator identification remains in parentheses on EN legal pages.
      if(/[А-Яа-яЁё]/u.test(result))omissions.push(`${page.file}:${row.line} ${row.kind}: ${row.text}`);
    }
  }
  assert.deepEqual(omissions,[],'Add translations for actual source copy, including split text and alt/aria attributes.');
});

test('each source-covered message has a nonempty translation in every supported language',()=>{
  const checked=new Set(),missing=[];
  for(const page of localized){
    const {source,data}=load(page);if(checked.has(source))continue;checked.add(source);
    for(const key of Object.keys(data.en))for(const lang of languages)if(typeof data[lang]?.[key]!=='string'||!data[lang][key].trim())missing.push(`${source}: ${lang}: ${key}`);
  }
  assert.deepEqual(missing,[]);
});
