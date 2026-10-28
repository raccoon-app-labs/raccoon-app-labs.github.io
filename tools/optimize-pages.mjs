/* Repeatable delivery optimizations; keep canonical artwork, text and source styles intact. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8').replaceAll('\r\n','\n');
const write=(name,source)=>{const target=path.join(root,name);if(!fs.existsSync(target)||read(name)!==source)fs.writeFileSync(target,source);};
const hash=source=>crypto.createHash('sha256').update(source).digest('hex').slice(0,12);
const sri=source=>'sha256-'+crypto.createHash('sha256').update(source).digest('base64');
const display=JSON.parse(read('assets/display/manifest.json'));
const core=['product-pages','native-demos','dark-worlds','mobile-layout','native-mechanics'];
const styles=core.map(name=>'/* '+name+'.css */\n'+read('assets/'+name+'.css').replace(/@charset[^;]+;/g,''));
const css=styles.join('\n');write('assets/product-core.css',css);
const cssUrl='/assets/product-core.css?v='+hash(css),lazyUrl='/assets/lazy-scripts.js?v='+hash(read('assets/lazy-scripts.js'));
const motionSource=read('assets/appearance/motion.js'),motionUrl='/assets/appearance/motion.js?v='+hash(motionSource);
const changed=new Set(execFileSync('git',['diff','--name-only','HEAD'],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim().split(/\r?\n/));
function updateTag(tag){
 const url=tag.match(/(?:\s|^)(?:src|href|data-lazy-src)="(\/[^"?]+)(?:\?[^"<>]*)?"/);
 if(!url||!fs.existsSync(path.join(root,url[1])))return tag;
 const source=read(url[1]);
 const integrity=tag.match(/integrity="([^"]*)"/)?.[1];
 if(!changed.has(url[1].slice(1))&&(!integrity||integrity===sri(source)))return tag;
 tag=tag.replace(url[0],url[0].replace(/="[^"]*"/,`="${url[1]}?v=${hash(source)}"`));
 return tag.replace(/integrity="[^"]*"/,`integrity="${sri(source)}"`);
}
function* pages(dir=root){for(const item of fs.readdirSync(dir,{withFileTypes:true})){if(item.name==='.git')continue;const file=path.join(dir,item.name);if(item.isDirectory())yield* pages(file);else if(item.name.endsWith('.html'))yield file;}}
let productCount=0;
for(const file of pages()){
 let html=fs.readFileSync(file,'utf8').replaceAll('\r\n','\n');
 html=html.replace(/<img\b[^>]*>/g,tag=>{
  for(const [src,spec] of Object.entries(display))tag=tag.replace(new RegExp('(?<![\\w-])src="'+src.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:\\?[^"<>]*)?"','g'),'src="'+spec.src+'"');
  return tag;
 });
 if(/<body[^>]+data-product=/.test(html)){
  productCount++;
  let bundled=false;
  html=html.replace(/<link\b[^>]*rel="stylesheet"[^>]*>/g,tag=>{
   const isCore=core.some(name=>tag.includes('/assets/'+name+'.css?'))||tag.includes('/assets/product-core.css?');
   if(!isCore)return tag;if(bundled)return '';bundled=true;return `<link rel="stylesheet" href="${cssUrl}">`;
  });
  html=html.replace(/<script\b[^>]+(?:src|data-lazy-src)="\/assets\/(?:native-mechanics|neon-current-demo|demo\/neon-comic\/art)\.js[^>]*><\/script>/g,tag=>{
   tag=tag.replace(/(?<![\w-])src=/,'data-lazy-src=');
   if(!tag.includes('data-lazy-target='))tag=tag.replace('>',' data-lazy-target="#try">');return tag;
  });
  if(!html.includes('/assets/lazy-scripts.js?'))html=html.replace('</head>',`<script src="${lazyUrl}" defer></script></head>`);
  const begin=html.indexOf('<section class="experience'),end=html.indexOf('<section class="benefits',begin);
  if(begin>=0&&end>begin){const demo=html.slice(begin,end).replace(/<img\b[^>]*>/g,tag=>{
    if(!tag.includes('loading='))tag=tag.replace('<img','<img loading="lazy"');
    if(!tag.includes('decoding='))tag=tag.replace('<img','<img decoding="async"');return tag;
   });html=html.slice(0,begin)+demo+html.slice(end);}
 }
 if(html.includes('/plus/theme.js?')){
  html=html.replace(/<script\b[^>]*src="\/assets\/appearance\/motion\.js[^>]*><\/script>/g,'');
  html=html.replace('</head>',`<script src="${motionUrl}" integrity="${sri(motionSource)}" defer></script></head>`);
 }
 html=html.replace(/<(?:script|link)\b[^>]+>/g,updateTag);
 write(path.relative(root,file),html);
}
console.log(`Optimized delivery for ${productCount} product pages; shared CSS, nearby demos, cached display assets.`);
