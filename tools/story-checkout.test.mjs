import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogTitle, validateOffer, purchasableStories, purchaseRequest, confirmationUrl, createApi, API_BASE} from '../assets/commerce/story-checkout-core.mjs';

const offer = {available:true,amount:19900,bookAmount:2900,currency:'RUB',termsVersion:'2',autoRenew:false,bookStoryIds:[4,5,7],paymentProvider:'robokassa'};

test('personalization tokens are resolved for a public catalog without a child name', () => {
  assert.equal(catalogTitle('{m:Лягушонок|Лягушечка} {child}'),'Лягушонок');
  assert.equal(catalogTitle('Лесная почта'),'Лесная почта');
});

test('catalog is restricted by server eligibility, paid status and visibility, with no duplicates', () => {
  const catalog = {stories:[{id:4,title:'Лесная почта',free:false},{id:4,title:'Duplicate',free:false},{id:5,title:'Free',free:true},{id:7,title:'Hidden',free:false,hidden:true},{id:8,title:'Not separately purchasable',free:false}]};
  const result = purchasableStories(catalog,offer,{'4':'assets/covers/4/cover.webp'});
  assert.deepEqual(result.map(book => book.id),[4]);
  assert.equal(result[0].cover,`${API_BASE}/v1/assets/assets/covers/4/cover.webp`);
});
test('malformed offer/catalog and unsafe remote cover paths fail closed', () => {
  assert.throws(() => validateOffer({...offer,amount:-1}));
  assert.throws(() => validateOffer({...offer,bookStoryIds:undefined}));
  assert.throws(() => purchasableStories({},offer));
  const catalog={stories:[{id:4,title:'Book',free:false}]};
  for(const path of ['https://evil.test/cover.webp','assets/covers/../secret.webp']) assert.equal(purchasableStories(catalog,offer,{'4':path})[0].cover,'');
});
test('subscription uses the authoritative amount and supports explicit recurring consent', () => {
  assert.deepEqual(purchaseRequest('premium',null,offer,true),{path:'/api/subscription/create',body:{termsVersion:'2',amount:19900,autoRenewConsent:false}});
  assert.equal(purchaseRequest('premium',null,{...offer,autoRenew:true},true).body.autoRenewConsent,true);
  assert.throws(() => purchaseRequest('premium',null,offer,false));
});
test('book and payment provider cannot be substituted by UI inputs', () => {
  assert.deepEqual(purchaseRequest('book',{id:4},offer,true),{path:'/api/books/4/create',body:{termsVersion:'2',amount:2900,termsAccepted:true}});
  assert.throws(() => purchaseRequest('book',{id:8},offer,true));
  assert.throws(() => purchaseRequest('book',{id:4},offer,true,'lava'));
  assert.throws(() => purchaseRequest('premium',null,{...offer,available:false},true));
  assert.throws(() => purchaseRequest('premium',null,{...offer,paymentProvider:'lava'},true));
});
test('only trusted HTTPS Robokassa destinations can receive the buyer', () => {
  assert.ok(confirmationUrl(`${API_BASE}/api/payments/robokassa/start/abc-123?token=signed`));
  assert.ok(confirmationUrl('https://auth.robokassa.ru/Merchant/Index.aspx?InvId=1'));
  for(const url of ['javascript:alert(1)','https://evil.test/pay','https://auth.robokassa.ru.evil.test/Merchant/Index.aspx','http://auth.robokassa.ru/Merchant/Index.aspx','https://user:pass@auth.robokassa.ru/Merchant/Index.aspx',`${API_BASE}/internal/admin`]) assert.equal(confirmationUrl(url),'');
});
test('concurrent expired requests refresh the session once, then retry with the new token', async () => {
  let session={accessToken:'expired',refreshToken:'refresh'}; let refreshes=0;
  const fetcher=async(url,options)=>{
    if(url.endsWith('/api/auth/refresh')){refreshes++; await new Promise(resolve=>setTimeout(resolve,5)); return Response.json({accessToken:'new',refreshToken:'next'});}
    return options.headers.Authorization==='Bearer new'?Response.json({ok:true}):Response.json({error:'unauthorized'},{status:401});
  };
  const api=createApi({fetcher,getSession:()=>session,setSession:value=>session=value,deviceId:'web'});
  assert.deepEqual(await Promise.all([api('/api/books',{authenticated:true}),api('/api/subscription',{authenticated:true})]),[{ok:true},{ok:true}]);
  assert.equal(refreshes,1); assert.equal(session.accessToken,'new');
});
test('an ambiguous invoice timeout is never silently retried',async()=>{
  let count=0;
  const api=createApi({fetcher:async()=>{count++;throw new Error('timeout');},getSession:()=>({accessToken:'a'}),setSession:()=>{},deviceId:'web'});
  await assert.rejects(api('/api/subscription/create',{method:'POST',authenticated:true,body:{}}),error=>error.code==='payment_uncertain');
  assert.equal(count,1);
});
test('a lost refresh response reuses the persisted idempotency key',async()=>{
  let session={accessToken:'expired',refreshToken:'refresh'};const ids=[];
  const fetcher=async(url,options)=>{
    if(url.endsWith('/api/auth/refresh')){
      ids.push(JSON.parse(options.body).requestId);
      if(ids.length===1)throw new Error('lost response');
      return Response.json({accessToken:'new',refreshToken:'next'});
    }
    return options.headers.Authorization==='Bearer new'?Response.json({ok:true}):Response.json({error:'unauthorized'},{status:401});
  };
  const api=createApi({fetcher,getSession:()=>session,setSession:value=>session=value,deviceId:'web'});
  await assert.rejects(api('/api/books',{authenticated:true}),error=>error.code==='network_error');
  assert.deepEqual(await api('/api/books',{authenticated:true}),{ok:true});
  assert.equal(ids.length,2);assert.equal(ids[0],ids[1]);
});
test('authentication is required before calling private endpoints',async()=>{
  const api=createApi({fetcher:()=>assert.fail('must not fetch'),getSession:()=>null,setSession:()=>{},deviceId:'web'});
  await assert.rejects(api('/api/books',{authenticated:true}),error=>error.status===401);
});
