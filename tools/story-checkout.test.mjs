import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogTitle, validateOffer, purchasableStories, purchaseRequest, confirmationUrl, createApi, API_BASE, LEGAL_BASE, billingDateTime, legalDocumentUrl} from '../assets/commerce/story-checkout-core.mjs';

const offer = {available:true,amount:19900,bookAmount:2900,currency:'RUB',termsVersion:'2',autoRenew:false,bookStoryIds:[4,5,7],paymentProvider:'robokassa'};
const recurring = {...offer, autoRenew:true, renewalAmount:24900, autoRenewConsentVersion:'recurring-v1',
  autoRenewConsentText:'Первый платёж 199 ₽, далее 249 ₽ каждый календарный месяц до отмены.',
  autoRenewConsentTextEn:'First payment 199 RUB, then 249 RUB each calendar month until cancelled.', billingPeriod:'P1M'};

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
  assert.deepEqual(purchaseRequest('premium',null,recurring,true).body,{termsVersion:'2',amount:19900,
    autoRenewConsent:true,autoRenewConsentVersion:'recurring-v1',renewalAmount:24900});
  assert.throws(() => purchaseRequest('premium',null,offer,false));
  assert.throws(() => purchaseRequest('premium',null,recurring,false),error=>error.code==='consent_required');
});
test('recurring checkout requires a complete server consent and monthly renewal quote',()=>{
  for(const field of ['autoRenewConsentVersion','autoRenewConsentText','autoRenewConsentTextEn','renewalAmount','billingPeriod']){
    assert.throws(()=>validateOffer({...recurring,[field]:undefined}),error=>error.code==='offer_unavailable');
  }
  assert.throws(()=>validateOffer({...recurring,renewalAmount:0}));
  assert.throws(()=>validateOffer({...recurring,billingPeriod:'P1Y'}));
});
test('billing dates include server time zone, exact time and offset, independently of the device zone',()=>{
  const result=billingDateTime(Date.parse('2026-12-18T09:00:00Z'),'Europe/Moscow','en-US');
  assert.match(result,/12:00/);assert.match(result,/GMT\+03:00/);assert.match(result,/Europe\/Moscow/);
  assert.equal(billingDateTime(0),'');assert.equal(billingDateTime(-1),'');
  assert.equal(billingDateTime(Date.now(),'invalid-zone'),'');
});
test('legal documents allow HTTPS only and safely fall back for older offers',()=>{
  assert.equal(legalDocumentUrl('https://reserve.volshebnye-istorii.ru/legal/premium-terms.html','premium-terms.html'),`${API_BASE}/legal/premium-terms.html`);
  for(const raw of [undefined,'javascript:alert(1)','http://example.test/offer','https://user:pass@example.test/offer']){
    assert.equal(legalDocumentUrl(raw,'privacy.html'),`${LEGAL_BASE}/privacy.html`);
  }
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
test('a transient catalog connection failure is retried once without retrying mutations',async()=>{
  let reads=0;
  const api=createApi({fetcher:async()=>{if(++reads===1)throw new Error('connection reset');return Response.json({stories:[]});},getSession:()=>null,setSession:()=>{},deviceId:'web'});
  assert.deepEqual(await api('/v1/catalog/ru'),{stories:[]});assert.equal(reads,2);
  reads=0;
  const failing=createApi({fetcher:async()=>{reads++;throw new Error('connection reset');},getSession:()=>null,setSession:()=>{},deviceId:'web'});
  await assert.rejects(failing('/v1/catalog/ru'),error=>error.code==='network_error');assert.equal(reads,2);
});
