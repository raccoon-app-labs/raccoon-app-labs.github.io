// Share complete dynamic UI translations without loading unrelated checkout copy.
import fs from 'node:fs';
const data=JSON.parse(fs.readFileSync(new URL('../assets/locales/runtime-messages.json',import.meta.url),'utf8'));
const sources=JSON.parse(fs.readFileSync(new URL('../assets/locales/runtime-sources.json',import.meta.url),'utf8'));
const normalize=value=>String(value).replace(/\s+/gu,' ').trim();

export function runtimeKeys(html,page='index.html'){
  const scripts=new Set([...html.matchAll(/(?:src|data-lazy-src)="([^"]+)"/g)].map(([,url])=>new URL(url,'https://site.test/'+page).pathname.slice(1)));
  return [...new Set(Object.entries(sources).filter(([file])=>scripts.has(file)).flatMap(([,keys])=>keys.map(normalize).filter(Boolean)))];
}

export function mergeRuntimeMessages(messages,aliases,keys){
  for(const key of keys){
    for(const [code,dictionary] of Object.entries(messages)){
      if(typeof data[code]?.[key]!=='string')throw new Error('Missing runtime translation: '+code+' / '+key);
      if(!Object.hasOwn(dictionary,key))dictionary[key]=data[code][key];
    }
    // Retain the source identity when switching again after a form error or notice.
    for(const dictionary of Object.values(data)){
      const value=normalize(dictionary[key]);
      if(!Object.hasOwn(aliases,value))aliases[value]=key;
    }
  }
  return {messages,aliases};
}
