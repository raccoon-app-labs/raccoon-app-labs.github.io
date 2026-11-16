import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const oldOrigin='https://raccoon-app-labs.github.io',newOrigin='https://neonwallkicker.ru';
const digest=value=>crypto.createHash('sha256').update(value).digest('hex').slice(0,12);
const bytes=file=>Buffer.from(fs.readFileSync(file,'utf8').replaceAll('\r\n','\n'));
function* files(dir=root){for(const item of fs.readdirSync(dir,{withFileTypes:true})){if(item.name==='.git')continue;const p=path.join(dir,item.name);if(item.isDirectory())yield* files(p);else yield p;}}
const archive=relative=>relative.startsWith('yandex_')||relative.includes('/archive-')||relative==='apps/neon-cyber-wall-kicker/shop/offer/index.html'||relative==='apps/neon-cyber-wall-kicker/shop/offer/2026-11-16/index.html';
let changed=0;
for(const file of files()){
  const relative=path.relative(root,file).replaceAll('\\','/');
  if(relative.startsWith('ops/')||relative.startsWith('tools/')||relative.startsWith('assets/locales/')||archive(relative)||! /\.(html|js|mjs|json|xml|txt)$/.test(file))continue;
  let text=fs.readFileSync(file,'utf8').replaceAll('\r\n','\n'),original=text;
  // Keep the explicitly named legacy host in compatibility code.
  if(relative!=='assets/vps-redirect.js'&&relative!=='apps/neon-cyber-wall-kicker/shop/checkout.js')text=text.replaceAll(oldOrigin,newOrigin);
  if(relative==='assets/commerce/story-checkout-core.mjs')text=text.replace("fetcher(API_BASE + path", "fetcher((globalThis.location?.origin === 'https://neonwallkicker.ru' ? '/services/stories' : API_BASE) + path");
  if(relative==='apps/hanzi-bloom/plus/checkout/ru-checkout.js')text=text.replace('fetch(api + route',"fetch((location.origin === 'https://neonwallkicker.ru' ? '/services/hanzi-ru' : api) + route");
  if(relative.endsWith('.html')&&!text.includes('/assets/vps-redirect.js?'))text=text.replace('</head>','<script src="/assets/vps-redirect.js?v='+digest(bytes(path.join(root,'assets/vps-redirect.js')))+'"></script></head>');
  if(text!==original){fs.writeFileSync(file,text);changed++;}
}
// Refresh local module imports and HTML cache/SRI references after migration.
for(let round=0;round<3;round++)for(const file of files()){
  if(!/\.(html|js|mjs)$/.test(file)||archive(path.relative(root,file).replaceAll('\\','/')))continue;
  let source=fs.readFileSync(file,'utf8').replaceAll('\r\n','\n');
  source=source.replace(/((?:from\s*|import\s*)['"])([^'"?]+\.m?js)\?[^'"]+(['"])/g,(all,start,url,end)=>{const p=url.startsWith('/')?path.join(root,url):path.resolve(path.dirname(file),url);return fs.existsSync(p)?start+url+'?v='+digest(bytes(p))+end:all;});
  if(file.endsWith('.html'))source=source.replace(/<(?:script|link)\b[^>]+>/g,tag=>{
    const attr=tag.match(/(?:src|href|data-lazy-src)="([^"?]+)(?:\?[^"<>]*)?"/);if(!attr||/^(?:https?:|data:)/.test(attr[1]))return tag;
    const p=attr[1].startsWith('/')?path.join(root,attr[1]):path.resolve(path.dirname(file),attr[1]);if(!fs.existsSync(p)||!fs.statSync(p).isFile()||! /\.(?:js|mjs|css)$/.test(p))return tag;
    const content=bytes(p);tag=tag.replace(attr[0],attr[0].replace(/="[^"]*"/,'="'+attr[1]+'?v='+digest(content)+'"'));
    return tag.replace(/integrity="[^"]*"/,'integrity="sha256-'+crypto.createHash('sha256').update(content).digest('base64')+'"');
  });
  if(source!==fs.readFileSync(file,'utf8').replaceAll('\r\n','\n'))fs.writeFileSync(file,source);
}
console.log(JSON.stringify({origin:newOrigin,changed}));
