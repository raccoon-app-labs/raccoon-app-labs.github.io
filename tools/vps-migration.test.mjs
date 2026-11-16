import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../assets/vps-redirect.js',import.meta.url),'utf8');
async function run({ready=true,network=true,interact=false,hostname='raccoon-app-labs.github.io'}={}){
 const redirected=[],events={};let requests=0;
 const location={hostname,href:'https://'+hostname+'/apps/hanzi-bloom/plus/checkout/?invoiceId=123#order',replace:url=>redirected.push(url)};
 const context={location,URL,AbortSignal,addEventListener:(name,fn)=>events[name]=fn,fetch:async(url,options)=>{
  requests++;assert.equal(url,'https://neonwallkicker.ru/site-migration-ready.json');assert.equal(options.credentials,'omit');assert.equal(options.referrerPolicy,'no-referrer');
  if(interact)events.pointerdown();if(!network)throw Error('offline');return {ok:true,json:async()=>({ready,origin:'https://neonwallkicker.ru'})};
 }};
 vm.runInNewContext(source,context);for(let n=0;n<8;n++)await Promise.resolve();return {redirected,requests};
}
test('legacy app and payment return URLs keep their path, query and hash on the verified primary site',async()=>{
 assert.deepEqual((await run()).redirected,['https://neonwallkicker.ru/apps/hanzi-bloom/plus/checkout/?invoiceId=123#order']);
});
test('an unavailable primary site or active form interaction keeps the old page usable',async()=>{
 for(const options of [{ready:false},{network:false},{interact:true}])assert.deepEqual((await run(options)).redirected,[]);
});
test('the primary site never fetches its own migration probe or redirects recursively',async()=>{
 assert.deepEqual(await run({hostname:'neonwallkicker.ru'}),{redirected:[],requests:0});
});
