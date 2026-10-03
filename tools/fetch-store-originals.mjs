import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const sharp=require(process.argv[2] || 'sharp');
const root=path.resolve(import.meta.dirname,'..');
const source=fs.readFileSync(path.join(root,'tools/fetch-store-screenshots.ps1'),'utf8');
const jobs=[];
for(const match of source.matchAll(/'([^']+\/(?:ru|en))'\s*=\s*@\(([\s\S]*?)\n\s*\)/g)){
  const urls=[...match[2].matchAll(/'(https:[^']+)'/g)].map(m=>m[1]);
  urls.forEach((url,index)=>jobs.push({set:match[1],index:index+1,url}));
}
const reports=[];
async function download(job){
  // Use the original RuStore upload, not the web_scr_prt_162 / web_scr_lnd_335 thumbnail.
  const url=job.url.includes('/plain/')?job.url.split('/plain/')[1].replace(/@webp$/,''):job.url.replace(/=w\d+-h\d+-rw$/,'=s0');
  const response=await fetch(url,{signal:AbortSignal.timeout(45000)});
  if(!response.ok)throw new Error(`${job.set}/${job.index}: HTTP ${response.status}`);
  const buffer=Buffer.from(await response.arrayBuffer());
  const original=await sharp(buffer).metadata();
  const previewPath=path.join(root,'assets/screens',job.set,String(job.index).padStart(2,'0')+'.webp');
  const preview=await sharp(previewPath).metadata();
  if(!original.width||!original.height||original.width<preview.width||original.height<preview.height)throw new Error(`Original smaller than preview: ${job.set}/${job.index}`);
  const target=previewPath.replace(/\.webp$/,'-hq.webp');
  await sharp(buffer).webp({quality:96,effort:5,smartSubsample:true}).toFile(target);
  reports.push({set:job.set,index:job.index,previous:[preview.width,preview.height],original:[original.width,original.height],bytes:fs.statSync(target).size});
  console.log(`${job.set}/${job.index}: ${preview.width}x${preview.height} -> ${original.width}x${original.height}`);
}
let cursor=0;
await Promise.all(Array.from({length:4},async()=>{while(cursor<jobs.length)await download(jobs[cursor++]);}));
console.log(JSON.stringify({downloaded:reports.length,totalBytes:reports.reduce((sum,r)=>sum+r.bytes,0),reports},null,2));
