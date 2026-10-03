import fs from 'node:fs';
import {apps} from './app-content.mjs';
let pages=0;
const errors=[];
for(const a of apps)for(const lang of ['ru','en']){
  const file=`${lang==='en'?'en/':''}apps/${a.slug}/index.html`;
  const html=fs.readFileSync(file,'utf8');
  const check=(condition,message)=>{if(!condition)errors.push(`${file}: ${message}`);};
  check(html.includes(`<html lang="${lang}">`),'language');
  check((html.match(/<h1>/g)||[]).length===1,'one H1');
  check(html.includes('rel="canonical"'),'canonical');
  check(html.includes('hreflang="en"')&&html.includes('hreflang="ru"'),'alternates');
  try{JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);}catch{errors.push(`${file}: invalid JSON-LD`);}
  for(const match of html.matchAll(/(?:src|href)="(\/assets\/[^"?]+)/g))check(fs.existsSync('.'+match[1]),`missing ${match[1]}`);
  const count=lang==='en'&&a.enCount?a.enCount:a.ruCount;
  check((html.match(/<figure class="shot /g)||[]).length===count,'gallery count');
  pages++;
}
console.log(JSON.stringify({pages,errors},null,2));
if(errors.length)process.exitCode=1;
