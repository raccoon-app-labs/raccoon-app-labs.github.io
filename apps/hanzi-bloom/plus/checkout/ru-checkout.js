'use strict';
(() => {
  const el = id => document.getElementById(id);
  const STORAGE = 'hanzi-plus-ru-web-checkout-v1';
  const APPS = ['com.enotessa.hanzi', 'com.enotessa.chinesekeys'];
  const sourceApp = new URLSearchParams(location.search).get('app') === 'keys' ? APPS[1] : APPS[0];
  const isKeys = sourceApp === APPS[1];
  document.documentElement.dataset.app = isKeys ? 'keys' : 'bloom';
  // Presentation must not break login if a browser still has older cached HTML.
  const storeLink = el('checkout-store-link'), includedLink = el('checkout-included-link');
  if (storeLink) storeLink.href = '/plus/?app=' + (isKeys ? 'keys' : 'bloom');
  if (includedLink) includedLink.href = '/plus/?app=' + (isKeys ? 'keys' : 'bloom') + '#included';
  if (isKeys) {
    const appIcon = el('checkout-app-icon');
    if (appIcon) appIcon.src = '/plus/assets/keys-icon-128.webp';
    const accent = document.createElement('em'); accent.textContent = 'Big discoveries.';
    el('product-title').replaceChildren(document.createTextNode('Small pieces.'), document.createElement('br'), accent);
    const panda = document.querySelector('.garden-art img');
    panda.sizes = '(max-width:760px) 160px, 390px';
    panda.srcset = '/plus/assets/keys-panda-384.webp 384w, /plus/assets/keys-panda-640.webp 640w, /plus/assets/keys-panda-960.webp 960w';
    panda.src = '/plus/assets/keys-panda-960.webp'; panda.width = 960; panda.height = 640;
  }
  const api='https://api1.hanzibloom.ru';
  let selectedPlan=new URLSearchParams(location.search).get('plan')==='rub_year'?'rub_year':'rub_month';
  let state = {}, catalog = null, challenge = null, busy = false, resendAt = 0;
  let returnContract = new URLSearchParams(location.search).get('invoiceId');
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  class Failure extends Error { constructor(status) { super('Request failed'); this.status = status; } }
  const save = () => { try { sessionStorage.setItem(STORAGE, JSON.stringify(state)); } catch { throw new Failure(507); } };
  function message(text, error = false) { el('message').textContent = text; el('message').classList.toggle('error', error); }
  function expiryDescription() {
    const timestamp = Number(el('plus-description').dataset.expiresAt);
    if (!timestamp) return;
    el('plus-description').textContent = 'Until ' + new Date(timestamp * 1000).toLocaleDateString(document.documentElement.lang || 'en-GB')
      + '. Open Hanzi Bloom or Hanzi Keys, sign in to your Russian account with this email and check your Plus.';
  }
  window.addEventListener('hanzi:languagechange', expiryDescription);
  function controls() {
    for (const button of document.querySelectorAll('button:not([data-language-control])')) button.disabled = busy;
    el('send-code').disabled = busy || !catalog;
    el('pay').disabled = busy || !catalog?.checkoutEnabled || !el('terms').checked || !!state.requestId;
    el('retry-order').disabled=busy || !catalog?.checkoutEnabled || !el('terms').checked;
    for(const radio of document.querySelectorAll('[name=plan]'))radio.disabled=busy || !!state.requestId;
    el('resend').disabled = busy || Date.now() < resendAt;
  }
  function view(stage) {
    for (const name of ['email', 'code', 'account']) el(name === 'account' ? name : name + '-form').hidden = name !== stage;
    const index = {email:0, code:1, account:2}[stage];
    ['email', 'code', 'plus'].forEach((name, i) => {
      const item = el('step-' + name); item.classList.toggle('done', i < index);
      if (i === index) item.setAttribute('aria-current', 'step'); else item.removeAttribute('aria-current');
    });
    el('step-title').textContent = {email:'Where should Plus grow?', code:'Your code is on its way', account:'Welcome home'}[stage];
    el('step-description').textContent = {email:'Use the same email as your Russian account in the apps.',
      code:'Enter the six digits from your latest email.', account:'This email connects your Plus in both apps.'}[stage];
    if (stage === 'account') el('account-email').textContent = state.email;
    else { el('plus-result').hidden = true; el('order-panel').hidden = true; }
  }
  function clearReturnParameters() {
    const url = new URL(location.href);
    url.searchParams.delete('invoiceId'); url.searchParams.delete('status');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
  async function run(action) {
    if (busy) return;
    busy = true; controls(); message('');
    try { await action(); }
    catch (error) {
      if (error.status === 401 && state.token) {
        state = {}; try { sessionStorage.removeItem(STORAGE); } catch {}
        view('email');paintPlan(); message('Your session expired. Sign in again with an email code.', true);
      } else message(({401:'That code is incorrect or expired. Use the code from your latest email.',
        409:'Prices or terms changed. Review them and confirm again.',
        429:'Too many attempts. Please wait a little before trying again.',
        507:'Allow session storage in this browser before continuing.',
        400:'Check your email address or six-digit code.',
        404:'Order not found. Check your account email. If you were charged, contact support.'})[error.status]
        || 'We could not confirm the result. Check your Plus again later; do not pay twice.', true);
    } finally { busy = false; controls(); }
  }
  async function call(route, data, token = state.token) {
    if (!api) throw new Failure(503);
    const headers = {Accept:'application/json', 'X-Hanzi-Region':'ru'};
    if (token) headers['X-Hanzi-Session'] = token;
    if (data !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetch(api + route, {method:data === undefined ? 'GET' : 'POST', headers,
      body:data === undefined ? undefined : JSON.stringify(data), credentials:'omit', cache:'no-store',
      redirect:'error', signal:AbortSignal.timeout(30000)});
    if (!response.ok) throw new Failure(response.status);
    const result = await response.json();
    if (!result || typeof result !== 'object') throw new Failure(503);
    return result;
  }
  async function sendCode() {
    challenge = await call('/v1/auth/request-code', {email:el('email').value.trim()});
    if (typeof challenge.challengeId !== 'string' || challenge.homeRegion !== 'ru') throw new Failure(503);
    resendAt = Date.now() + 60000; el('code').value = ''; view('code'); el('code').focus();
    message('Check your inbox and spam folder.');
  }
  function orderView(order) {
    if (order.environment !== 'production') throw new Failure(503);
    state.order = order; save();el('order-id').textContent=order.invoiceId?'№ '+order.invoiceId:'';
    el('purchase-panel').hidden = true; el('order-panel').hidden = false;
    el('continue-payment').hidden = true; el('new-order').hidden = true;el('retry-order').hidden=order.status!=='creating';
    el('order-message').textContent = ({creating:'Checking your order. Do not pay again. Contact support if the wait continues.',
      pending:'Your order is awaiting payment. If you already paid, tap “Check my Plus” after a short wait.',
      paid:'Payment confirmed by the server. Checking your account access.',
      failed:'This order was not paid. You can make a new purchase.'})[order.status] || 'Checking your order status.';
    if (order.status === 'pending' && order.checkoutUrl) {
      const url = new URL(order.checkoutUrl);
      if (url.origin!==api || url.pathname!=='/payments/robokassa/start' || url.username || url.password || !/^[1-9]\d{0,14}$/.test(url.searchParams.get('invoice')) || !/^[0-9a-f]{64}$/.test(url.searchParams.get('token')))throw new Failure(503);
      el('continue-payment').href = url.href; el('continue-payment').hidden = false;
    }
    el('new-order').hidden = !['paid', 'failed'].includes(order.status);
  }
  async function refresh() {
    if (state.requestId) {
      try { orderView(await call('/v1/web/robokassa/lookup', {idempotencyKey:state.requestId})); }
      catch (error) { if (error.status !== 404) throw error; orderView({environment:'production', status:'creating'}); }
    } else if (returnContract && /^[1-9]\d{0,14}$/.test(returnContract)) {
      orderView(await call('/v1/web/robokassa/status', {invoiceId:returnContract}));
    }
    const plus = await call('/v1/plus');
    if (plus.environment !== 'production') throw new Failure(503);
    const active = plus.active === true && plus.reviewRequired === false
      && Number.isFinite(plus.expiresAt) && plus.expiresAt * 1000 > Date.now();
    el('plus-result').hidden = false;
    el('plus-heading').textContent = active ? 'Your Plus is in bloom!' : plus.reviewRequired ? 'Support needs to check this payment' : 'Plus is not active yet';
    el('plus-description').dataset.expiresAt = active ? String(plus.expiresAt) : '';
    el('plus-description').textContent = active
      ? 'Until ' + new Date(plus.expiresAt * 1000).toLocaleDateString('en-GB')
        + '. Open Hanzi Bloom or Hanzi Keys, sign in to your Russian account with this email and check your Plus.'
      : plus.reviewRequired ? 'Contact raccoon.app.labs@gmail.com with your order number.'
      : 'Paid access appears after the payment is confirmed. Your learning progress stays with you.';
    expiryDescription();
    if (plus.reviewRequired) { el('purchase-panel').hidden = true; el('continue-payment').hidden = true; el('new-order').hidden = true;el('retry-order').hidden=order.status!=='creating'; }
    else if (!state.order && !state.requestId) el('purchase-panel').hidden = false;
    message('Account access checked.');
  }
  el('email-form').addEventListener('submit', event => { event.preventDefault(); run(sendCode); });
  el('code-form').addEventListener('submit', event => { event.preventDefault(); run(async () => {
    const session = await call('/v1/auth/verify-code', {challengeId:challenge?.challengeId, code:el('code').value.trim()});
    if (session.homeRegion !== 'ru' || typeof session.token !== 'string'
        || !(session.expiresAt * 1000 > Date.now())) throw new Failure(503);
    state = {token:session.token, expiresAt:session.expiresAt};paintPlan();
    const account = await call('/v1/me');
    if (account.homeRegion !== 'ru') throw new Failure(503);
    state.email = account.email; save(); el('code').value = ''; view('account'); await refresh();
  }); });
  el('resend').addEventListener('click', () => run(sendCode));
  el('change-email').addEventListener('click', () => { challenge = null; view('email'); el('email').focus(); message(''); });
  el('terms').addEventListener('change', controls);
  el('check-plus').addEventListener('click', () => run(refresh));
  function paintPlan(){
    const plan=state.requestPlan || selectedPlan;
    for(const radio of document.querySelectorAll('[name=plan]'))radio.checked=radio.value===plan;
    for(const item of catalog?.plans || [])document.querySelector('[data-plan-price="'+item.id+'"]').textContent=new Intl.NumberFormat(document.documentElement.lang,{style:'currency',currency:'RUB',maximumFractionDigits:0}).format(item.amountMinor/100);
    el('pay-amount').textContent=document.querySelector('[data-plan-price="'+plan+'"]').textContent;
  }
  function validCatalog(config){return config.environment==='production' && config.homeRegion==='ru' && config.autoRenew===false && config.termsVersion==='2026-10-26-web-1' && APPS.every(app=>config.sharedApps?.includes(app)) && ['rub_month','rub_year'].every((id,i)=>config.plans?.some(p=>p.id===id && p.currency==='RUB' && p.months===(i?12:1) && Number.isSafeInteger(p.amountMinor) && p.amountMinor>0));}
  async function purchase(){
    if(!catalog?.checkoutEnabled || !el('terms').checked)return;
    const fresh=await call('/v1/web/robokassa/catalog');if(!validCatalog(fresh))throw new Failure(503);
    if(!fresh.checkoutEnabled)throw new Failure(503);
    if(JSON.stringify(fresh)!==JSON.stringify(catalog)){catalog=fresh;paintPlan();el('terms').checked=false;throw new Failure(409);}
    if(state.requestTerms && state.requestTerms!==fresh.termsVersion)throw new Failure(409);
    state.requestId ||= crypto.randomUUID();state.requestPlan ||= selectedPlan;state.requestTerms ||= fresh.termsVersion;
    save();orderView({environment:'production',status:'creating'});
    const order=await call('/v1/web/robokassa/orders',{planId:state.requestPlan,idempotencyKey:state.requestId,applicationId:sourceApp,acceptedTerms:true,termsVersion:state.requestTerms});
    orderView(order);if(order.status==='pending' && !el('continue-payment').hidden)location.assign(el('continue-payment').href);
  }
  for(const radio of document.querySelectorAll('[name=plan]'))radio.addEventListener('change',()=>{selectedPlan=radio.value;el('terms').checked=false;paintPlan();controls();});
  window.addEventListener('hanzi:languagechange',paintPlan);
  el('pay').addEventListener('click',()=>run(purchase));el('retry-order').addEventListener('click',()=>run(purchase));
  el('new-order').addEventListener('click', () => {
    if (!['paid', 'failed'].includes(state.order?.status)) return;
    delete state.requestId;delete state.requestPlan;delete state.requestTerms;delete state.order;
    try { save(); } catch { message('Could not save your session.', true); return; }
    clearReturnParameters(); returnContract = null; el('terms').checked = false;
    el('order-panel').hidden = true; el('purchase-panel').hidden = false;paintPlan(); controls();
  });
  el('logout').addEventListener('click', () => run(async () => {
    const token = state.token; state = {}; sessionStorage.removeItem(STORAGE); el('terms').checked = false;
    view('email');paintPlan(); clearReturnParameters(); returnContract = null;
    try { await call('/v1/auth/logout', {}, token); message('You are signed out.'); }
    catch { message('Signed out on this device. The server has not yet confirmed the session ended.', true); }
  }));
  setInterval(() => {
    const remaining = Math.max(0, Math.ceil((resendAt - Date.now()) / 1000));
    el('resend').textContent = remaining ? 'New code · ' + remaining + 's' : 'New code'; controls();
  }, 1000);
  run(async () => {
    try {
      const health = await call('/health/ready');
      if (health.homeRegion !== 'ru' || health.environment !== 'production') throw new Failure(503);
      const config=await call('/v1/web/robokassa/catalog');if(!validCatalog(config))throw new Failure(503);
      catalog=config;paintPlan();
      el('availability').textContent=catalog.checkoutEnabled?'Russian account':'Purchases are not open yet. You can check existing Plus access below.';
    }catch{catalog=null;el('availability').textContent='Payments are temporarily unavailable. Please try again later.';view('email');return;}
    try { const saved = JSON.parse(sessionStorage.getItem(STORAGE) || '{}');
      if (saved.token && saved.expiresAt * 1000 > Date.now()) state = saved;
      else sessionStorage.removeItem(STORAGE);
    } catch { /* Saving must succeed before any invoice request. */ }
    if (state.token) {
      const account = await call('/v1/me');
      if (account.homeRegion !== 'ru') throw new Failure(503);
      state.email = account.email; save();paintPlan(); view('account'); await refresh();
    } else view('email');
  });
})();
