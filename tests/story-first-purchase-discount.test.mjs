import assert from 'node:assert/strict';
import test from 'node:test';
import {PRICING_VERSION, offerPath, validateOffer, purchaseRequest, createApi} from '../assets/commerce/story-checkout-core.mjs';

const available = () => ({
  available:true, paymentProvider:'robokassa', currency:'RUB', termsVersion:'1', autoRenew:true,
  bookStoryIds:[4,5], amount:15920, bookAmount:2320, regularAmount:19900, regularBookAmount:2900,
  renewalAmount:19900, premiumDiscountPercent:20, bookDiscountPercent:20,
  firstPurchaseDiscountEligible:true, firstPurchaseDiscountState:'available', pricingVersion:PRICING_VERSION
});
const used = () => ({...available(), amount:19900, bookAmount:2900, premiumDiscountPercent:0,
  bookDiscountPercent:0, firstPurchaseDiscountEligible:false, firstPurchaseDiscountState:'used'});
const rejects = (code, callback) => assert.throws(callback, error => error.code === code);

test('quotes request the version and selected book without accepting arbitrary URL input', () => {
  assert.equal(offerPath(4), '/api/premium/offer?pricingVersion=first_purchase_v1&storyId=4');
  assert.equal(offerPath(), '/api/premium/offer?pricingVersion=first_purchase_v1');
  assert.equal(offerPath('4&user=other'), offerPath());
});

test('first purchase sends the exact displayed discounted amount and pricing contract', () => {
  assert.deepEqual(purchaseRequest('book', {id:4}, available(), true), {
    path:'/api/books/4/create',
    body:{termsVersion:'1', amount:2320, termsAccepted:true, pricingVersion:PRICING_VERSION}
  });
  assert.deepEqual(purchaseRequest('premium', null, available(), true), {
    path:'/api/subscription/create',
    body:{termsVersion:'1', amount:15920, autoRenewConsent:true, pricingVersion:PRICING_VERSION}
  });
  assert.equal(available().renewalAmount, 19900);
});

test('used accounts and immutable reserved quotes preserve their actual prices', () => {
  assert.equal(purchaseRequest('premium', null, used(), true).body.amount, 19900);
  const frozen = {...available(), firstPurchaseDiscountState:'reserved', firstPurchaseDiscountEligible:false};
  assert.equal(purchaseRequest('book', {id:4}, frozen, true).body.amount, 2320);
  assert.equal(frozen.regularBookAmount, 2900);
});

test('manual monthly access does not invent automatic-renewal consent', () => {
  assert.equal(purchaseRequest('premium', null, {...available(), autoRenew:false}, true).body.autoRenewConsent, false);
});

test('old backend remains a full-price checkout without inventing a discount', () => {
  const legacy = {available:true, paymentProvider:'robokassa', currency:'RUB', termsVersion:'1',
    autoRenew:false, bookStoryIds:[4], amount:19900, bookAmount:2900};
  const request = purchaseRequest('book', {id:4}, legacy, true);
  assert.equal(request.body.amount, 2900);
  assert.equal(Object.hasOwn(request.body, 'pricingVersion'), false);
});

test('personal offers are rejected when amounts or discount metadata are inconsistent', () => {
  for (const patch of [
    {pricingVersion:'future-version'}, {regularAmount:undefined}, {renewalAmount:0},
    {premiumDiscountPercent:30}, {amount:1}, {bookAmount:2321},
    {firstPurchaseDiscountState:'unknown'}, {firstPurchaseDiscountEligible:false},
    {regularBookAmount:100}, {amount:Number.MAX_SAFE_INTEGER + 1}
  ]) rejects('offer_unavailable', () => validateOffer({...available(), ...patch}));
});

test('a zero-price purchase can never be constructed, even for very small list prices', () => {
  const tiny = {...available(), amount:1, regularAmount:1, renewalAmount:1, bookAmount:1, regularBookAmount:1};
  assert.equal(validateOffer(tiny).amount, 1);
  rejects('offer_unavailable', () => validateOffer({...tiny, amount:0}));
});

test('anonymous quotes and unaccepted terms cannot submit a purchase', () => {
  const anonymous = {...used(), firstPurchaseDiscountState:'sign_in_required'};
  rejects('login_required', () => purchaseRequest('premium', null, anonymous, true));
  rejects('consent_required', () => purchaseRequest('book', {id:4}, available(), false));
  rejects('story_not_for_sale', () => purchaseRequest('book', {id:7}, available(), true));
});

test('authenticated personal quotes send the bearer token and prohibit browser caching', async () => {
  let session = {accessToken:'account-token'};
  const calls = [];
  const api = createApi({
    getSession:() => session, setSession:value => { session = value; }, deviceId:'test-device',
    fetcher:async (url, options) => { calls.push({url, options}); return {ok:true, status:200, json:async () => available()}; }
  });
  assert.equal((await api(offerPath(4), {authenticated:true})).bookAmount, 2320);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer account-token');
  assert.equal(calls[0].options.cache, 'no-store');
  assert.equal(calls[0].options.credentials, 'omit');
  await api(offerPath(4));
  assert.equal(Object.hasOwn(calls[1].options.headers, 'Authorization'), false);
});

test('expired personal quotes refresh authentication before retrying the same quote path', async () => {
  let session = {accessToken:'old-token', refreshToken:'refresh-token'};
  const calls = [];
  const api = createApi({
    getSession:() => session, setSession:value => { session = value; }, deviceId:'test-device',
    fetcher:async (url, options) => {
      calls.push({url, options});
      if (url.endsWith('/api/auth/refresh')) return {ok:true, status:200, json:async () => ({accessToken:'new-token',refreshToken:'next-refresh'})};
      if (options.headers.Authorization === 'Bearer old-token') return {ok:false, status:401, json:async () => ({error:'login_required'})};
      return {ok:true, status:200, json:async () => available()};
    }
  });
  assert.equal((await api(offerPath(5), {authenticated:true})).pricingVersion, PRICING_VERSION);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].url, calls[2].url);
  assert.equal(calls[2].options.headers.Authorization, 'Bearer new-token');
});

test('checkout handlers refresh the personal price after login and keep a canceled reservation', async () => {
  const {readFileSync} = await import('node:fs');
  const vm = await import('node:vm');
  const core = await import('../assets/commerce/story-checkout-core.mjs');
  const calls = [], storage = new Map();
  let invoice = null, consumed = false, creates = 0;
  const ok = value => ({ok:true,status:200,json:async () => structuredClone(value)});
  const missing = () => ({ok:false,status:404,json:async () => ({error:'payment_not_found'})});
  const fetcher = async (raw, options) => {
    const url = new URL(raw), body = options.body ? JSON.parse(options.body) : {};
    calls.push({path:url.pathname, query:url.searchParams, options, body});
    if (url.pathname === '/api/premium/offer') {
      assert.equal(url.searchParams.get('pricingVersion'), PRICING_VERSION);
      if (!options.headers.Authorization) return ok({...used(), firstPurchaseDiscountState:'sign_in_required'});
      if (consumed) return ok(used());
      if (invoice) return ok({...available(), firstPurchaseDiscountState:'reserved',firstPurchaseDiscountEligible:false});
      return ok(available());
    }
    if (url.pathname === '/api/auth/confirm-code') return ok({accessToken:'account-token',refreshToken:'refresh-token',email:'parent@example.org'});
    if (url.pathname === '/api/auth/logout') return ok({});
    if (url.pathname === '/api/subscription') return ok({premium:false});
    if (url.pathname === '/api/books') return ok({storyIds:[]});
    if (url.pathname === '/api/payments/pending') return invoice ? ok(invoice) : missing();
    if (url.pathname === '/api/subscription/create') {
      creates++;
      assert.equal(body.amount, 15920);
      assert.equal(body.pricingVersion, PRICING_VERSION);
      invoice = {paymentId:'first-invoice',type:'INITIAL',status:'pending',amount:15920,regularAmount:19900,
        renewalAmount:19900,discountPercent:20,currency:'RUB',pricingVersion:PRICING_VERSION,firstPurchaseDiscountReserved:true};
      return ok(invoice);
    }
    if (url.pathname === '/api/payments/first-invoice/abandon') {
      invoice = {...invoice,status:'canceled',confirmationUrl:'',firstPurchaseDiscountReserved:true};
      return ok(invoice);
    }
    if (url.pathname === '/api/payments/first-invoice') return invoice ? ok(invoice) : missing();
    throw new Error('Unexpected API route: ' + raw);
  };
  const none = () => null;
  const dialog = {open:false,innerHTML:'',classList:{add(){},remove(){}},dataset:{},setAttribute(){},
    addEventListener(){},querySelector:none,querySelectorAll:() => [],showModal(){this.open=true;},close(){this.open=false;}};
  const source = {querySelectorAll:() => []};
  const context = {
    ...core, URLSearchParams, URL, Intl, crypto, structuredClone,
    createApi:options => core.createApi({...options,fetcher}),
    installBookCoverTilt:() => ({reset(){},refresh(){}}),
    installBookPortal:() => ({open(){},close(){}}),
    sessionStorage:{getItem:key => storage.get(key) ?? null,setItem:(key,value) => storage.set(key,value),removeItem:key => storage.delete(key)},
    window:{HanziLocale:{code:'ru'}},
    document:{documentElement:{lang:'ru',dataset:{},classList:{add(){},remove(){}}},body:{hasAttribute:() => false,append(){}},
      querySelector:selector => selector === '#stories-panel' ? source : null,createElement:() => dialog,addEventListener(){},hidden:false},
    matchMedia:() => ({matches:true}),addEventListener(){},setTimeout:() => 0,clearTimeout(){},setInterval:() => 0,clearInterval(){},
    location:{search:''}
  };
  let script = readFileSync(new URL('../assets/commerce/story-checkout.js', import.meta.url),'utf8')
    .replace(/^import .*;\n/gm,'');
  script = script.replace('  localizeSource();\n  if (standalone)', "  globalThis.checkoutTest = {open,confirmCode,buy,action,restorePending,checkPayment,state:() => ({offer,pending,step,session,error})};\n  localizeSource();\n  if (standalone)");
  vm.runInNewContext(script, context);
  const checkout = context.checkoutTest;
  assert.ok(checkout, 'real checkout handlers were loaded');
  await checkout.open('premium');
  assert.equal(checkout.state().offer.firstPurchaseDiscountState, 'sign_in_required');
  assert.equal(checkout.state().offer.amount, 19900);
  await checkout.confirmCode('123456');
  assert.equal(checkout.state().step, 'review');
  assert.equal(checkout.state().offer.amount, 15920);
  assert.match(dialog.innerHTML, /−20%/);
  assert.match(dialog.innerHTML, /199/);
  assert.equal(calls.filter(c => c.path === '/api/premium/offer').at(-1).options.headers.Authorization,'Bearer account-token');
  await checkout.buy(true);
  assert.equal(creates,1);
  assert.equal(checkout.state().step,'pending');
  await checkout.action('abandon');
  assert.equal(checkout.state().step,'pending');
  assert.equal(checkout.state().pending.paymentId,'first-invoice');
  assert.match(dialog.innerHTML,/Скидка 20% закреплена за этим счётом/);
  assert.equal(await checkout.restorePending(),true);
  await checkout.checkPayment();
  assert.equal(creates,1,'a canceled reservation cannot cause a second create');
  assert.equal(checkout.state().pending.paymentId,'first-invoice');
  invoice = {...invoice,status:'succeeded',firstPurchaseDiscountReserved:false}; consumed = true;
  await checkout.checkPayment();
  assert.equal(checkout.state().step,'success');
  assert.equal(checkout.state().pending,null);
  await checkout.action('choose');
  assert.equal(checkout.state().offer.amount,19900,'returning from success refreshes consumed eligibility');
  await checkout.action('logout');
  assert.equal(checkout.state().session,null);
  assert.equal(checkout.state().offer.firstPurchaseDiscountState,'sign_in_required');
  assert.equal(checkout.state().offer.amount,19900);
});

test('personal quote changes remain explicit instead of silently accepting another price', () => {
  const stale = {...used(), amount:15920, premiumDiscountPercent:0};
  rejects('offer_unavailable', () => purchaseRequest('premium', null, stale, true));
});

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes,no) => { resolve = yes; reject = no; });
  return {promise,resolve,reject};
}
const response = (value, status = 200) => ({ok:status < 400,status,json:async () => structuredClone(value)});
const notFound = () => response({error:'payment_not_found'},404);

test('401 never retries an old account purchase using another account token', async () => {
  let session = {accessToken:'A',refreshToken:'refresh-A'};
  const waiting = deferred(), calls = [];
  const api = createApi({getSession:() => session,setSession:value => {session=value;},deviceId:'test',
    fetcher:async (url, options) => { calls.push(options.headers.Authorization); return waiting.promise; }});
  const payment = api('/api/subscription/create',{method:'POST',body:{amount:15920},authenticated:true});
  session = {accessToken:'B',refreshToken:'refresh-B'};
  waiting.resolve(response({error:'login_required'},401));
  await assert.rejects(payment,error => error.code === 'account_changed');
  assert.deepEqual(calls,['Bearer A']);
  assert.equal(session.accessToken,'B');
});

test('a delayed refresh cannot replace or clear a newly signed-in account', async () => {
  for (const status of [200,401]) {
    let session = {userId:'A',accessToken:'A',refreshToken:'refresh-A'};
    const waiting = deferred(), started = deferred();
    const api = createApi({getSession:() => session,setSession:value => {session=value;},deviceId:'test',
      fetcher:async url => {
        if (url.endsWith('/api/auth/refresh')) { started.resolve(); return waiting.promise; }
        return response({error:'login_required'},401);
      }});
    const quote = api(offerPath(),{authenticated:true});
    await started.promise;
    session = {userId:'B',accessToken:'B',refreshToken:'refresh-B'};
    waiting.resolve(response({userId:'A',accessToken:'new-A',refreshToken:'new-refresh-A'},status));
    await assert.rejects(quote,error => error.code === 'account_changed');
    assert.equal(session.accessToken,'B');
  }
});

test('GET network retry stays bound to the account which started it', async () => {
  let session = {accessToken:'A',refreshToken:'refresh-A'}, calls = 0;
  const waiting = deferred();
  const api = createApi({getSession:() => session,setSession:value => {session=value;},deviceId:'test',
    fetcher:async () => { calls++; return waiting.promise; }});
  const quote = api(offerPath(),{authenticated:true});
  session = {accessToken:'B',refreshToken:'refresh-B'}; waiting.reject(new Error('lost connection'));
  await assert.rejects(quote,error => error.code === 'account_changed');
  assert.equal(calls,1);
});

async function checkoutHarness(fetcher, initialSession = null) {
  const {readFileSync} = await import('node:fs');
  const vm = await import('node:vm');
  const core = await import('../assets/commerce/story-checkout-core.mjs');
  const storage = new Map();
  if (initialSession) storage.set('magic-stories-shop-session-v1',JSON.stringify(initialSession));
  const source = {querySelectorAll:() => []};
  const dialog = {open:false,innerHTML:'',classList:{add(){},remove(){}},dataset:{},setAttribute(){},
    addEventListener(){},querySelector:() => null,querySelectorAll:() => [],showModal(){this.open=true;},close(){this.open=false;}};
  const context = {
    ...core,URLSearchParams,URL,Intl,crypto,structuredClone,
    createApi:options => core.createApi({...options,fetcher}),
    installBookCoverTilt:() => ({reset(){},refresh(){}}),installBookPortal:() => ({open(){},close(){}}),
    sessionStorage:{getItem:key => storage.get(key) ?? null,setItem:(key,value) => storage.set(key,value),removeItem:key => storage.delete(key)},
    window:{HanziLocale:{code:'ru'}},
    document:{documentElement:{lang:'ru',dataset:{},classList:{add(){},remove(){}}},body:{hasAttribute:() => false,append(){}},
      querySelector:selector => selector === '#stories-panel' ? source : null,createElement:() => dialog,addEventListener(){},hidden:false},
    matchMedia:() => ({matches:true}),addEventListener(){},setTimeout:() => 0,clearTimeout(){},setInterval:() => 0,clearInterval(){},location:{search:''}
  };
  let script = readFileSync(new URL('../assets/commerce/story-checkout.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
  script = script.replace('  localizeSource();\n  if (standalone)',"  globalThis.checkoutTest = {open,confirmCode,buy,action,restorePending,checkPayment,state:() => ({offer,pending,step,session,error,reviewed,busy})};\n  localizeSource();\n  if (standalone)");
  vm.runInNewContext(script,context);
  assert.ok(context.checkoutTest);
  return {checkout:context.checkoutTest,dialog};
}
const signedIn = () => ({userId:'A',email:'a@example.org',accessToken:'A',refreshToken:'refresh-A'});
function accountRead(path) {
  if (path === '/api/subscription') return response({premium:false});
  if (path === '/api/books') return response({storyIds:[]});
  if (path === '/api/payments/pending') return notFound();
  throw new Error('Unexpected API route: '+path);
}

test('late quote from a closed dialog cannot replace the price accepted in a new review', async () => {
  const waiting = deferred(), requests = []; let offers = 0;
  const {checkout,dialog} = await checkoutHarness(async (raw,options) => {
    const path = new URL(raw).pathname;
    if (path === '/api/premium/offer') return ++offers === 1 ? waiting.promise : response(available());
    if (path === '/api/subscription/create') {
      requests.push(JSON.parse(options.body));
      return response({paymentId:'new',status:'pending'});
    }
    return accountRead(path);
  },signedIn());
  const firstOpen = checkout.open('premium');
  checkout.action('close');
  await checkout.open('premium');
  await checkout.action('continue');
  const displayed = dialog.innerHTML;
  assert.equal(checkout.state().reviewed.offer.amount,15920);
  waiting.resolve(response(used())); await firstOpen;
  assert.equal(dialog.innerHTML,displayed);
  assert.equal(checkout.state().offer.amount,15920);
  // The accepted snapshot also survives mutation of the independently cached offer.
  checkout.state().offer.amount = 19900;
  await checkout.buy(true);
  assert.equal(requests[0].amount,15920);
  assert.equal(requests[0].pricingVersion,PRICING_VERSION);
});

test('offer_changed replaces the review snapshot and requires consent for the new price', async () => {
  let changed = false; const amounts = [];
  const {checkout} = await checkoutHarness(async (raw,options) => {
    const path = new URL(raw).pathname;
    if (path === '/api/premium/offer') return response(changed ? used() : available());
    if (path === '/api/subscription/create') {
      amounts.push(JSON.parse(options.body).amount);
      if (!changed) { changed = true; return response({error:'offer_changed'},400); }
      return response({paymentId:'new',status:'pending'});
    }
    return accountRead(path);
  },signedIn());
  await checkout.open(); await checkout.action('continue');
  await checkout.buy(true);
  assert.equal(checkout.state().step,'review');
  assert.equal(checkout.state().reviewed.offer.amount,19900);
  await checkout.buy(false);
  assert.equal(checkout.state().error,'consent_required');
  assert.deepEqual(amounts,[15920]);
  await checkout.buy(true);
  assert.deepEqual(amounts,[15920,19900]);
});

test('late background payment read cannot overwrite a newer invoice', async () => {
  const waiting = deferred(); let creates = 0;
  const {checkout} = await checkoutHarness(async (raw,options) => {
    const path = new URL(raw).pathname;
    if (path === '/api/premium/offer') return response(used());
    if (path === '/api/subscription/create') return response({paymentId:'invoice-'+(++creates),status:'pending'});
    if (path === '/api/payments/invoice-1') return waiting.promise;
    if (path === '/api/payments/invoice-1/abandon') return response({paymentId:'invoice-1',status:'canceled',firstPurchaseDiscountReserved:false});
    return accountRead(path);
  },signedIn());
  await checkout.open(); await checkout.action('continue'); await checkout.buy(true);
  const oldCheck = checkout.checkPayment(false);
  await checkout.action('abandon'); await checkout.action('continue'); await checkout.buy(true);
  assert.equal(checkout.state().pending.paymentId,'invoice-2');
  waiting.resolve(response({paymentId:'invoice-1',status:'pending'})); await oldCheck;
  assert.equal(checkout.state().pending.paymentId,'invoice-2');
});

test('late login and stale finally cannot replace or unlock the new account review', async () => {
  const oldLogin = deferred(), newQuote = deferred(), quoteStarted = deferred(); let confirmations = 0;
  const {checkout} = await checkoutHarness(async (raw,options) => {
    const path = new URL(raw).pathname;
    if (path === '/api/premium/offer') {
      if (options.headers.Authorization) { quoteStarted.resolve(); return newQuote.promise; }
      return response({...used(),firstPurchaseDiscountState:'sign_in_required'});
    }
    if (path === '/api/auth/confirm-code') {
      if (++confirmations === 1) return oldLogin.promise;
      return response({userId:'B',email:'b@example.org',accessToken:'B',refreshToken:'refresh-B'});
    }
    return accountRead(path);
  });
  await checkout.open();
  const first = checkout.confirmCode('111111'); checkout.action('close');
  await checkout.open(); const second = checkout.confirmCode('222222');
  await quoteStarted.promise;
  assert.equal(checkout.state().busy,true);
  oldLogin.resolve(response(signedIn())); await first;
  assert.equal(checkout.state().session.userId,'B');
  assert.equal(checkout.state().busy,true,'old operation must not unlock the new one');
  newQuote.resolve(response(available())); await second;
  assert.equal(checkout.state().reviewed.email,'b@example.org');
  assert.equal(checkout.state().step,'review');
});
