'use strict';
(() => {
  const API = 'https://functions.yandexcloud.net/d4eqa0fgcps7prk24iv8?route=';
  const STORAGE = 'hanzi-plus-checkout-v1';
  const el = id => document.getElementById(id);
  let state = {}, catalog = null, challenge = null, busy = false, resendAt = 0;
  let returnContract = new URLSearchParams(location.search).get('invoiceId');
  const contractPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  class Failure extends Error { constructor(status) { super('Request failed'); this.status = status; } }
  function save() {
    try { sessionStorage.setItem(STORAGE, JSON.stringify(state)); }
    catch { throw new Failure(507); }
  }
  function message(text, error = false) { el('message').textContent = text; el('message').classList.toggle('error', error); }
  function controls() {
    for (const button of document.querySelectorAll('button')) button.disabled = busy;
    el('pay').disabled = busy || !catalog?.checkoutEnabled || !el('terms').checked || !!state.requestId;
    el('resend').disabled = busy || Date.now() < resendAt;
  }
  async function run(action) {
    if (busy) return;
    busy = true; controls(); message('');
    try { await action(); }
    catch (error) {
      if (error.status === 401 && state.token) {
        state = {}; try { sessionStorage.removeItem(STORAGE); } catch {}
        view('email');
        message('Сессия закончилась. Войди снова по коду.', true);
      } else {
        message(({401:'Код не подошёл или устарел. Возьми код из последнего письма.',
          429:'Слишком много попыток. Подожди немного и попробуй снова.',
          507:'Браузер запретил хранение сеанса. Разреши его для этого сайта, чтобы продолжить.',
          400:'Проверь почту или шестизначный код.',
          404:'Заказ пока не найден. Проверь почту аккаунта; если деньги списались, напиши в поддержку.'})[error.status]
          || 'Не удалось получить подтверждение. Попробуй проверить доступ чуть позже.', true);
      }
    } finally { busy = false; controls(); }
  }
  async function call(route, data) {
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 30000);
    try {
      const headers = {Accept:'application/json'};
      if (state.token) headers['X-Hanzi-Session'] = state.token;
      if (data !== undefined) headers['Content-Type'] = 'application/json';
      const response = await fetch(API + encodeURIComponent(route), {method:data === undefined ? 'GET' : 'POST',
        headers, body:data === undefined ? undefined : JSON.stringify(data),
        credentials:'omit', cache:'no-store', redirect:'error', signal:abort.signal});
      if (!response.ok) throw new Failure(response.status);
      const result = await response.json();
      if (!result || typeof result !== 'object') throw new Failure(503);
      return result;
    } finally { clearTimeout(timer); }
  }
  function view(stage) {
    for (const name of ['email','code','account']) el(name === 'account' ? name : name + '-form').hidden = name !== stage;
    const index = {email:0, code:1, account:2}[stage];
    ['email','code','plus'].forEach((name,i) => {
      const item = el('step-' + name); item.classList.toggle('done', i < index);
      if (i === index) item.setAttribute('aria-current','step'); else item.removeAttribute('aria-current');
    });
    el('step-title').textContent = {email:'Куда посадим Plus?', code:'Письмо уже летит', account:'Ты дома'}[stage];
    el('step-description').textContent = {email:'Укажи почту, с которой входишь в приложение.',
      code:'Шесть цифр — и мы узнаем твой аккаунт.', account:'Эта же почта откроет Plus в приложении.'}[stage];
    if (stage === 'account') el('account-email').textContent = state.email;
    else { el('plus-result').hidden = true; el('order-panel').hidden = true; }
  }
  async function sendCode() {
    challenge = await call('/v1/auth/request-code', {email:el('email').value.trim()});
    if (typeof challenge.challengeId !== 'string') throw new Failure(503);
    resendAt = Date.now() + 60000;
    el('code').value = ''; view('code'); el('code').focus();
    message('Проверь входящие и папку «Спам».');
  }
  function orderView(order) {
    if (order.environment !== 'production') throw new Failure(503);
    state.order = order; save();
    el('purchase-panel').hidden = true; el('order-panel').hidden = false;
    el('continue-payment').hidden = true; el('new-order').hidden = true;
    el('order-message').textContent = ({creating:'Проверяем созданный заказ. Не оплачивай повторно: если ожидание затянулось, напиши в поддержку.',
      pending:'Заказ ждёт оплаты. Если уже оплатила, нажми «Проверить мой Plus»: подтверждение может прийти чуть позже.',
      paid:'Оплата подтверждена сервером. Проверяем доступ в аккаунте.',
      failed:'Этот заказ не оплачен. Можно оформить новую покупку.'})[order.status] || 'Уточняем статус заказа.';
    if (order.status === 'pending' && order.checkoutUrl) {
      const url = new URL(order.checkoutUrl);
      if (url.protocol !== 'https:' || url.username || url.password) throw new Failure(503);
      el('continue-payment').href = url.href; el('continue-payment').hidden = false;
    }
    if (['paid','failed'].includes(order.status)) el('new-order').hidden = false;
  }
  async function refresh() {
    if (state.requestId) {
      try { orderView(await call('/v1/orders/lava/lookup', {idempotencyKey:state.requestId})); }
      catch (error) { if (error.status !== 404) throw error;
        // A lost response is ambiguous. Never replace the key or repeat POST automatically.
        orderView({environment:'production',status:'creating'});
      }
    } else if (returnContract && contractPattern.test(returnContract)) {
      const order = await call('/v1/orders/lava/status', {contractId:returnContract});
      orderView(order);
    }
    const plus = await call('/v1/plus');
    if (plus.environment !== 'production') throw new Failure(503);
    el('plus-result').hidden = false;
    const active = plus.active === true && plus.reviewRequired === false
      && Number.isFinite(plus.expiresAt) && plus.expiresAt * 1000 > Date.now();
    el('plus-heading').textContent = active ? 'Plus расцвёл!' : plus.reviewRequired ? 'Нужна проверка поддержки' : 'Plus пока не подключён';
    el('plus-description').textContent = active
      ? 'До ' + new Date(plus.expiresAt * 1000).toLocaleDateString('ru-RU') + '. Открой Hanzi Bloom, войди с этой почтой и нажми «Проверить мой Plus».'
      : plus.reviewRequired ? 'Есть вопрос по возврату или платежу. Напиши на raccoon.app.labs@gmail.com с номером заказа.'
      : 'Твой прогресс остаётся с тобой. Оплаченный доступ появится после подтверждения платежа.';
    if (plus.reviewRequired) { el('purchase-panel').hidden = true; el('continue-payment').hidden = true; el('new-order').hidden = true; }
    else if (!state.order && !state.requestId) el('purchase-panel').hidden = false;
    message('Проверка доступа завершена.');
  }
  el('email-form').addEventListener('submit', event => { event.preventDefault(); run(sendCode); });
  el('code-form').addEventListener('submit', event => { event.preventDefault(); run(async () => {
    const session = await call('/v1/auth/verify-code', {challengeId:challenge?.challengeId, code:el('code').value.trim()});
    if (typeof session.token !== 'string' || !(session.expiresAt * 1000 > Date.now())) throw new Failure(503);
    state = {token:session.token, expiresAt:session.expiresAt};
    const account = await call('/v1/me'); state.email = account.email; save();
    el('code').value = ''; view('account'); await refresh();
  }); });
  el('resend').addEventListener('click', () => run(sendCode));
  el('change-email').addEventListener('click', () => { challenge = null; view('email'); el('email').focus(); message(''); });
  el('terms').addEventListener('change', controls);
  el('check-plus').addEventListener('click', () => run(refresh));
  el('pay').addEventListener('click', () => run(async () => {
    if (!catalog?.checkoutEnabled || !el('terms').checked || state.requestId) return;
    state.requestId = crypto.randomUUID(); save();
    el('purchase-panel').hidden = true;
    orderView({environment:'production',status:'creating'});
    const order = await call('/v1/orders/lava', {planId:'usd_month', idempotencyKey:state.requestId,
      acceptedTerms:true, termsVersion:catalog.termsVersion});
    orderView(order);
    if (order.status === 'pending' && !el('continue-payment').hidden) location.assign(el('continue-payment').href);
  }));
  el('new-order').addEventListener('click', () => {
    if (!['paid','failed'].includes(state.order?.status)) return;
    delete state.requestId; delete state.order;
    try { save(); } catch { message('Не удалось сохранить сеанс.', true); return; }
    history.replaceState(null,'',location.pathname); returnContract = null; el('terms').checked = false;
    el('order-panel').hidden = true; el('new-order').hidden = true; el('purchase-panel').hidden = false; controls();
  });
  el('logout').addEventListener('click', () => run(async () => {
    const token = state.token; state = {}; sessionStorage.removeItem(STORAGE);
    el('terms').checked = false; view('email');
    history.replaceState(null,'',location.pathname); returnContract = null;
    try {
      const response = await fetch(API + encodeURIComponent('/v1/auth/logout'), {method:'POST',
        headers:{'X-Hanzi-Session':token,'Content-Type':'application/json'},body:'{}',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(15000)});
      if (!response.ok && response.status !== 401) throw new Failure(response.status);
      message('Ты вышла из аккаунта.');
    } catch { message('На этом устройстве ты вышла. Сервер пока не подтвердил завершение сессии.', true); }
  }));
  setInterval(() => {
    const remaining = Math.max(0, Math.ceil((resendAt - Date.now())/1000));
    el('resend').textContent = remaining ? 'Новый код · ' + remaining + ' с' : 'Новый код'; controls();
  },1000);
  run(async () => {
    try { const saved = JSON.parse(sessionStorage.getItem(STORAGE) || '{}');
      if (saved.token && saved.expiresAt * 1000 > Date.now()) state = saved;
      else sessionStorage.removeItem(STORAGE);
    } catch { /* Login remains usable; a purchase will require storage before any invoice POST. */ }
    try {
      catalog = await call('/v1/checkout');
      if (catalog.environment !== 'production' || catalog.plan?.id !== 'usd_month'
        || catalog.plan.currency !== 'USD' || catalog.plan.amountMinor !== 599 || catalog.plan.months !== 1
        || catalog.autoRenew !== false || catalog.termsVersion !== '2026-10-08') throw new Failure(503);
      el('availability').textContent = catalog.checkoutEnabled ? 'Оплата доступна · $5.99 за календарный месяц' : 'Оплата скоро. Уже купленный Plus можно проверить ниже.';
    } catch { catalog = null; el('availability').textContent = 'Оплата пока недоступна. Попробуй вернуться чуть позже.'; }
    if (state.token) { const account = await call('/v1/me'); state.email = account.email; save(); view('account'); await refresh(); }
    else view('email');
  });
})();
