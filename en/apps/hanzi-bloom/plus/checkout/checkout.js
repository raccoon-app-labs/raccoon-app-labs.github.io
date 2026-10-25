'use strict';
(() => {
  const el = id => document.getElementById(id);
  const STORAGE = 'hanzi-plus-global-checkout-v2';
  const APPS = ['com.enotessa.hanzi', 'com.enotessa.chinesekeys'];
  const sourceApp = new URLSearchParams(location.search).get('app') === 'keys' ? APPS[1] : APPS[0];
  const configuredApi = document.querySelector('meta[name="hanzi-global-api"]').content;
  let api = null;
  try {
    const url = new URL(configuredApi);
    if (url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash
        && url.pathname === '/' && !['api1.hanzibloom.ru', 'functions.yandexcloud.net'].includes(url.hostname)) api = url.origin;
  } catch { /* An unconfigured page stays closed, without contacting legacy/RU account storage. */ }
  let state = {}, catalog = null, challenge = null, busy = false, resendAt = 0;
  let returnContract = new URLSearchParams(location.search).get('invoiceId');
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  class Failure extends Error { constructor(status) { super('Request failed'); this.status = status; } }
  const save = () => { try { sessionStorage.setItem(STORAGE, JSON.stringify(state)); } catch { throw new Failure(507); } };
  function message(text, error = false) { el('message').textContent = text; el('message').classList.toggle('error', error); }
  function controls() {
    for (const button of document.querySelectorAll('button')) button.disabled = busy;
    el('send-code').disabled = busy || !catalog;
    el('pay').disabled = busy || !catalog?.checkoutEnabled || !el('terms').checked || !!state.requestId;
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
    el('step-description').textContent = {email:'Use the same email as your international account in the apps.',
      code:'Enter the six digits from your latest email.', account:'This email connects your Plus in both apps.'}[stage];
    if (stage === 'account') el('account-email').textContent = state.email;
    else { el('plus-result').hidden = true; el('order-panel').hidden = true; }
  }
  async function run(action) {
    if (busy) return;
    busy = true; controls(); message('');
    try { await action(); }
    catch (error) {
      if (error.status === 401 && state.token) {
        state = {}; try { sessionStorage.removeItem(STORAGE); } catch {}
        view('email'); message('Your session expired. Sign in again with an email code.', true);
      } else message(({401:'That code is incorrect or expired. Use the code from your latest email.',
        429:'Too many attempts. Please wait a little before trying again.',
        507:'Allow session storage in this browser before continuing.',
        400:'Check your email address or six-digit code.',
        404:'Order not found. Check your account email. If you were charged, contact support.'})[error.status]
        || 'We could not confirm the result. Check your Plus again later; do not pay twice.', true);
    } finally { busy = false; controls(); }
  }
  async function call(route, data, token = state.token) {
    if (!api) throw new Failure(503);
    const headers = {Accept:'application/json', 'X-Hanzi-Region':'global'};
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
    if (typeof challenge.challengeId !== 'string' || challenge.homeRegion !== 'global') throw new Failure(503);
    resendAt = Date.now() + 60000; el('code').value = ''; view('code'); el('code').focus();
    message('Check your inbox and spam folder.');
  }
  function orderView(order) {
    if (order.environment !== 'production') throw new Failure(503);
    state.order = order; save();
    el('purchase-panel').hidden = true; el('order-panel').hidden = false;
    el('continue-payment').hidden = true; el('new-order').hidden = true;
    el('order-message').textContent = ({creating:'Checking your order. Do not pay again. Contact support if the wait continues.',
      pending:'Your order is awaiting payment. If you already paid, tap “Check my Plus” after a short wait.',
      paid:'Payment confirmed by the server. Checking your account access.',
      failed:'This order was not paid. You can make a new purchase.'})[order.status] || 'Checking your order status.';
    if (order.status === 'pending' && order.checkoutUrl) {
      const url = new URL(order.checkoutUrl);
      if (url.protocol !== 'https:' || url.username || url.password) throw new Failure(503);
      el('continue-payment').href = url.href; el('continue-payment').hidden = false;
    }
    el('new-order').hidden = !['paid', 'failed'].includes(order.status);
  }
  async function refresh() {
    if (state.requestId) {
      try { orderView(await call('/v1/orders/lava/lookup', {idempotencyKey:state.requestId})); }
      catch (error) { if (error.status !== 404) throw error; orderView({environment:'production', status:'creating'}); }
    } else if (returnContract && uuid.test(returnContract)) {
      orderView(await call('/v1/orders/lava/status', {contractId:returnContract}));
    }
    const plus = await call('/v1/plus');
    if (plus.environment !== 'production') throw new Failure(503);
    const active = plus.active === true && plus.reviewRequired === false
      && Number.isFinite(plus.expiresAt) && plus.expiresAt * 1000 > Date.now();
    el('plus-result').hidden = false;
    el('plus-heading').textContent = active ? 'Your Plus is in bloom!' : plus.reviewRequired ? 'Support needs to check this payment' : 'Plus is not active yet';
    el('plus-description').textContent = active
      ? 'Until ' + new Date(plus.expiresAt * 1000).toLocaleDateString('en-GB')
        + '. Open Hanzi Bloom or Hanzi Keys, sign in to your international account with this email and check your Plus.'
      : plus.reviewRequired ? 'Contact raccoon.app.labs@gmail.com with your order number.'
      : 'Paid access appears after the payment is confirmed. Your learning progress stays with you.';
    if (plus.reviewRequired) { el('purchase-panel').hidden = true; el('continue-payment').hidden = true; el('new-order').hidden = true; }
    else if (!state.order && !state.requestId) el('purchase-panel').hidden = false;
    message('Account access checked.');
  }
  el('email-form').addEventListener('submit', event => { event.preventDefault(); run(sendCode); });
  el('code-form').addEventListener('submit', event => { event.preventDefault(); run(async () => {
    const session = await call('/v1/auth/verify-code', {challengeId:challenge?.challengeId, code:el('code').value.trim()});
    if (session.homeRegion !== 'global' || typeof session.token !== 'string'
        || !(session.expiresAt * 1000 > Date.now())) throw new Failure(503);
    state = {token:session.token, expiresAt:session.expiresAt};
    const account = await call('/v1/me');
    if (account.homeRegion !== 'global') throw new Failure(503);
    state.email = account.email; save(); el('code').value = ''; view('account'); await refresh();
  }); });
  el('resend').addEventListener('click', () => run(sendCode));
  el('change-email').addEventListener('click', () => { challenge = null; view('email'); el('email').focus(); message(''); });
  el('terms').addEventListener('change', controls);
  el('check-plus').addEventListener('click', () => run(refresh));
  el('pay').addEventListener('click', () => run(async () => {
    if (!catalog?.checkoutEnabled || !el('terms').checked || state.requestId) return;
    state.requestId = crypto.randomUUID(); save(); orderView({environment:'production', status:'creating'});
    const order = await call('/v1/orders/lava', {planId:'usd_month', idempotencyKey:state.requestId,
      applicationId:sourceApp, acceptedTerms:true, termsVersion:catalog.termsVersion});
    orderView(order);
    if (order.status === 'pending' && !el('continue-payment').hidden) location.assign(el('continue-payment').href);
  }));
  el('new-order').addEventListener('click', () => {
    if (!['paid', 'failed'].includes(state.order?.status)) return;
    delete state.requestId; delete state.order;
    try { save(); } catch { message('Could not save your session.', true); return; }
    history.replaceState(null, '', location.pathname); returnContract = null; el('terms').checked = false;
    el('order-panel').hidden = true; el('purchase-panel').hidden = false; controls();
  });
  el('logout').addEventListener('click', () => run(async () => {
    const token = state.token; state = {}; sessionStorage.removeItem(STORAGE); el('terms').checked = false;
    view('email'); history.replaceState(null, '', location.pathname); returnContract = null;
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
      if (health.homeRegion !== 'global' || health.environment !== 'production') throw new Failure(503);
      const config = await call('/v1/checkout');
      if (config.environment !== 'production' || config.homeRegion !== 'global'
          || config.plan?.id !== 'usd_month' || config.plan.currency !== 'USD'
          || config.plan.amountMinor !== 599 || config.plan.months !== 1 || config.autoRenew !== false
          || config.termsVersion !== '2026-10-26' || !APPS.every(app => config.sharedApps?.includes(app))) throw new Failure(503);
      catalog = config;
      el('availability').textContent = catalog.checkoutEnabled ? 'Payments open · $5.99 for one calendar month'
        : 'Purchases are not open yet. You can check existing Plus access below.';
    } catch { catalog = null; el('availability').textContent = 'International checkout is not open yet. Please check back later.'; view('email'); return; }
    try { const saved = JSON.parse(sessionStorage.getItem(STORAGE) || '{}');
      if (saved.token && saved.expiresAt * 1000 > Date.now()) state = saved;
      else sessionStorage.removeItem(STORAGE);
    } catch { /* Saving must succeed before any invoice request. */ }
    if (state.token) {
      const account = await call('/v1/me');
      if (account.homeRegion !== 'global') throw new Failure(503);
      state.email = account.email; save(); view('account'); await refresh();
    } else view('email');
  });
})();
