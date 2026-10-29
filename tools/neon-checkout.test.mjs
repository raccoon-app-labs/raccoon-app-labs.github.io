import test from 'node:test';
import assert from 'node:assert/strict';
import {PRODUCT_IDS,validateCatalog,purchaseRequest,confirmationUrl,validateOrder,createClient} from '../plus/neon-checkout-core.mjs';
const id='be14bd1c-9d0d-49f1-bdb4-5453cc604e91';
const fixture=()=>({currency:'RUB',enabled:true,channel_allowed:true,test:false,seller:{terms_version:'v1',terms_url:'https://raccoon-app-labs.github.io/apps/neon-cyber-wall-kicker/shop/offer/'},products:PRODUCT_IDS.map((id,i)=>({id,ru:id,en:id,price:14900+i,coins:3000,kind:i<2?'bundle':'coins',once:i<2}))});
test('only the published server catalogue can supply the selected product, amount and terms',()=>{
 const c=fixture(),p=purchaseRequest(c,'starter','rustore',true,id);
 assert.equal(p.expected_amount,14900);assert.equal(p.terms_version,'v1');assert.equal(p.channel,'rustore');assert.equal(p.product_id,'starter');
 for(const change of [c=>c.currency='USD',c=>c.products.push(c.products[0]),c=>c.products[0].price=-1,c=>c.products.pop(),c=>c.seller.terms_url='https://other.test/']){const bad=fixture();change(bad);assert.throws(()=>validateCatalog(bad));}
});
test('availability, actual distribution, consent, one-time ownership and request keys are enforced',()=>{
 for(const field of ['enabled','channel_allowed']){const c=fixture();c[field]=false;assert.throws(()=>purchaseRequest(c,'starter','rustore',true,id));}
 const c=fixture();c.test=true;assert.throws(()=>purchaseRequest(c,'starter','rustore',true,id));
 assert.throws(()=>purchaseRequest(fixture(),'starter','preview',true,id));
 assert.throws(()=>purchaseRequest(fixture(),'starter','rustore',false,id));
 assert.throws(()=>purchaseRequest(fixture(),'starter','rustore',true,'bad'));
 assert.throws(()=>purchaseRequest(fixture(),'starter','rustore',true,id,['starter']));
 assert.equal(purchaseRequest(fixture(),'coins_2000','google_play',true,id,['coins_2000']).product_id,'coins_2000');
});
test('payment links and invoices reject substitutions, mismatched totals and test payments',()=>{
 const url='https://auth.robokassa.ru/Merchant/Index.aspx?InvId=123';assert.equal(confirmationUrl(url),url);
 for(const url of ['javascript:alert(1)','http://auth.robokassa.ru/Merchant/Index.aspx','https://auth.robokassa.ru.attacker.test/Merchant/Index.aspx','https://user:password@auth.robokassa.ru/Merchant/Index.aspx','https://auth.robokassa.ru/other'])assert.equal(confirmationUrl(url),'');
 const good={id,state:'pending',amount:14900,test:false,checkout_url:url};assert.equal(validateOrder(good,14900),good);
 for(const change of [{amount:1},{test:true},{id:'bad'},{checkout_url:'https://attacker.test/'},{state:'unknown'}])assert.throws(()=>validateOrder({...good,...change},14900));
});
test('lost invoice responses are not automatically retried and reuse the same submitted request key',async()=>{
 let calls=0,bodies=[];const api=createClient({getSession:()=>({token:'session'}),fetcher:async(url,options)=>{calls++;bodies.push(JSON.parse(options.body));assert.equal(options.credentials,'omit');assert.equal(options.headers.Authorization,'Bearer session');throw Error('timeout');}});
 const body=purchaseRequest(fixture(),'starter','rustore',true,id);
 await assert.rejects(api('/v1/orders',{body,authenticated:true}),e=>e.code==='payment_uncertain');assert.equal(calls,1);
 await assert.rejects(api('/v1/orders',{body,authenticated:true}));assert.equal(bodies[0].request_key,bodies[1].request_key);
 const guest=createClient({getSession:()=>null,fetcher:()=>assert.fail('No unauthenticated orders')});await assert.rejects(guest('/v1/orders',{body,authenticated:true}),e=>e.code==='sign_in_required');
});
