const API_ORIGIN = 'https://api.neonwallkicker.ru';
const KEY = 'neon-website-purchases-v1';
const BUNDLE_RIGHTS = {
  starter: ['death:rift_bloom', 'skin:rift_fox', 'trail:rift_stitch'],
  supporter: ['death:eclipse_finale', 'skin:eclipse_maestro', 'trail:event_horizon'],
};

export function compatibleCatalog(catalog) {
  return catalog.currency === 'RUB' && Array.isArray(catalog.products) && catalog.products.length > 0 && catalog.products.every(product =>
    typeof product.id === 'string' && Number.isSafeInteger(product.price) && product.price > 0 && product.price <= 100000000
    && Number.isSafeInteger(product.coins) && product.coins > 0 && /^[0-9a-f]{64}$/i.test(product.offer_version ?? '')
    && Number.isSafeInteger(product.euro?.cents) && product.euro.cents >= 100
    && (product.kind === 'coins' || (product.kind === 'bundle' && Array.isArray(product.rights)
      && JSON.stringify([...product.rights].sort()) === JSON.stringify(BUNDLE_RIGHTS[product.id]))));
}
const text = {
  ru: { title: 'Покупка', intro: 'Войди с почтой из игры — покупка появится в этом аккаунте.',
    email: 'Почта из игры', code: 'Код из письма', send: 'Получить код', verify: 'Подтвердить почту', back: 'Другая почта', logout: 'Выйти',
    refresh: 'Обновить покупки', loading: 'Проверяем доступность сервера…', offline: 'Сервис покупок недоступен. Оплата заблокирована. Попробуй позже.',
    ready: '', choose: 'Выбери монеты или набор в каталоге выше.', buy: 'Выбрать покупку',
    consent: 'Принимаю', terms: 'условия покупки', privacy: 'Конфиденциальность', pay: 'Перейти к оплате',
    details: 'Об оплате и зачислении', edit: 'Изменить', codeIntro: 'Введи код, отправленный на ',
    checking: 'Проверяем аккаунт и сохраняем заказ…', changed: 'Предложение обновилось. Проверь состав и цену и подтверди условия заново.',
    sent: 'Нет письма? Проверь папку «Спам».', account: 'Получатель покупки: ', coins: ' монет',
    rate: 'Цена в евро — ориентир по курсу ЦБ. Заказ выставляется в рублях; окончательную сумму в евро покажет Робокасса.',
    pending: 'Есть незавершённый заказ. Сначала проверь его или отмени. Повторно платить не нужно.',
    check: 'Проверить заказ', resume: 'Продолжить этот заказ', cancel: 'Отменить неоплаченный заказ',
    paid: 'Покупка начислена. Вернись в игру и нажми «Обновить покупки».', review: 'Платёж проверяется. Повторно платить не нужно. Обратись в поддержку с номером заказа.',
    cancelled: 'Заказ отменён. Не оплачивай старую ссылку.', refunded: 'Возврат подтверждён.', id: 'Заказ: ',
    storage: 'Браузер не позволяет сохранить сеанс. Разреши хранение данных сайта или используй обычную вкладку.',
    expiry: 'Оплата — на защищённой странице Робокассы. Ссылка действует 5 минут. Заказ можно проверить и продолжить здесь.',
    delay: 'Если связь пропадёт после оплаты, заказ сохранится. После восстановления сервиса проверка начислит покупку один раз. Если покупка не появилась в течение 24 часов, напиши в поддержку.',
    error: 'Не удалось выполнить действие. Обнови покупки и попробуй ещё раз.', codeError: 'Код неверный или устарел.', wait: 'Подожди минуту перед повторной отправкой кода.',
    history: 'Последние покупки', minimum: 'Сумма старого заказа ниже €1. Отмени его и выбери новую покупку.', paused: 'Покупки временно недоступны. Оплата заблокирована.' },
  en: { title: 'Checkout', intro: 'Use your in-game email. Your purchase will appear in that account.',
    email: 'In-game email', code: 'Email code', send: 'Send code', verify: 'Confirm email', back: 'Another email', logout: 'Sign out',
    refresh: 'Refresh purchases', loading: 'Checking the purchase service…', offline: 'The purchase service is unavailable. Payment is blocked. Please try later.',
    ready: '', choose: 'Choose a coin pack or bundle from the catalogue above.', buy: 'Choose purchase',
    consent: 'I accept the', terms: 'purchase terms', privacy: 'Privacy', pay: 'Continue to payment',
    details: 'Payment & delivery', edit: 'Change', codeIntro: 'Enter the code sent to ',
    checking: 'Checking your account and saving the order…', changed: 'The offer changed. Review the contents and price, then accept the terms again.',
    sent: 'No email? Check your spam folder.', account: 'Purchase recipient: ', coins: ' coins',
    rate: 'Euros are an estimate at the CBR rate. The exact order total is in RUB; Robokassa confirms the final euro charge.',
    pending: 'You have an unfinished order. Check or cancel it first. Do not pay again.',
    check: 'Check order', resume: 'Continue this order', cancel: 'Cancel unpaid order',
    paid: 'Your purchase was granted. Return to the game and refresh purchases.', review: 'The payment is under review. Do not pay again. Contact support with your order number.',
    cancelled: 'Order cancelled. Do not pay the old link.', refunded: 'Refund confirmed.', id: 'Order: ',
    storage: 'Your browser cannot save this session. Allow site storage or use a regular browser tab.',
    expiry: 'Pay on Robokassa’s secure page. The payment link lasts 5 minutes. You can check and resume your order here.',
    delay: 'If connection is lost after payment, the saved order remains. Once service returns, verification grants the purchase once. If it has not arrived within 24 hours, contact support.',
    error: 'The action could not be completed. Refresh purchases and try again.', codeError: 'The code is invalid or expired.', wait: 'Wait a minute before requesting another code.',
    history: 'Recent purchases', minimum: 'The old order is below €1. Cancel it and choose a new purchase.', paused: 'Purchases are temporarily unavailable. Payment is blocked.' },
};

export function paymentUrl(order, offer, terms, now = Date.now()) {
  const url = new URL(order.checkout_url);
  const sum = url.searchParams.get('OutSum') ?? '';
  const parts = /^([0-9]{1,8})\.([0-9]{2})$/.exec(sum);
  const providerAmount = parts ? Number(parts[1]) * 100 + Number(parts[2]) : -1;
  if (url.protocol !== 'https:' || url.hostname !== 'auth.robokassa.ru' || url.username || url.password
      || url.pathname.toLowerCase() !== '/merchant/index.aspx' || order.amount !== offer.price
      || url.searchParams.getAll('OutSum').length !== 1 || providerAmount !== order.amount
      || url.searchParams.get('ExpirationDate') !== order.checkout_expires_at
      || order.offer_version !== offer.offer_version || order.terms_version !== terms.terms_version
      || order.terms_url !== terms.terms_url || Date.parse(order.checkout_expires_at) <= now
      || Date.parse(order.checkout_expires_at) > now + 301000 || !Number.isFinite(Date.parse(order.checkout_expires_at))) throw new Error('invalid_checkout');
  return url.href;
}

export function mountCheckout(root, options = {}) {
  const document = root.ownerDocument;
  const win = document.defaultView;
  // Reuse the site's working HTTPS connection instead of opening a second
  // cross-origin connection for checkout. Other hosts retain the public API.
  const apiOrigin = options.apiOrigin ?? (win.location?.origin === 'https://neonwallkicker.ru' ? '/services/neon' : API_ORIGIN);
  const navigate = options.navigate ?? (url => win.location.assign(url));
  let language = (document.documentElement.lang || win.navigator.language).startsWith('ru') ? 'ru' : 'en';
  let saved = {}, durable = true;
  try { saved = JSON.parse(win.sessionStorage.getItem(KEY) || '{}'); } catch { durable = false; }
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
  const state = { token: typeof saved.token === 'string' ? saved.token : '', email: typeof saved.email === 'string' ? saved.email : '',
    pending: saved.pending && typeof saved.pending === 'object' ? saved.pending : null, catalog: null, wallet: null, selected: null, busy: false, ready: false, codeSent: Boolean(saved.codeSent), lastOutcome: '' };
  root.innerHTML = `<div class="neon-checkout-head"><h2 data-copy="title"></h2><div class="neon-checkout-languages" role="group" aria-label="RU / EN"><button type="button" data-lang="ru" lang="ru">RU</button><button type="button" data-lang="en" lang="en">EN</button></div></div>
    <div class="neon-selected" hidden><div class="neon-selected-heading"><div><h3></h3><p class="neon-selected-contents"></p></div><p class="neon-selected-price"></p></div><a class="neon-edit" href="#coins" data-copy="edit"></a></div>
    <p class="neon-choose" data-copy="choose"></p>
    <p class="neon-checkout-status" role="status" aria-live="polite"></p>
    <p class="neon-intro" data-copy="intro"></p>
    <form class="neon-auth"><label class="neon-email-label"><span data-copy="email"></span><input name="email" type="email" autocomplete="email" required maxlength="254" placeholder="you@example.com"></label>
    <label class="neon-code"><span data-copy="code"></span><input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6"></label>
    <button class="button" type="submit" data-auth-submit></button><button class="button secondary" type="button" data-auth-back data-copy="back"></button></form>
    <div class="neon-account" hidden><p class="neon-recipient"></p><div class="neon-account-actions"><button class="button secondary" type="button" data-refresh data-copy="refresh"></button><button class="button secondary" type="button" data-logout data-copy="logout"></button></div></div>
    <div class="neon-payment" hidden><label class="neon-consent"><input type="checkbox" data-consent><span><span data-copy="consent"></span> <a data-terms target="_blank" rel="noopener" data-copy="terms"></a></span></label><button class="button" type="button" data-pay data-copy="pay" disabled></button></div>
    <section class="neon-pending" hidden><h3 data-copy="pending"></h3><p class="neon-order-id"></p><p class="neon-order-summary"></p>
    <div class="neon-account-actions"><button class="button secondary" type="button" data-check data-copy="check"></button><button class="button secondary" type="button" data-resume data-copy="resume"></button><button class="button secondary" type="button" data-cancel data-copy="cancel"></button></div></section>
    <details class="neon-checkout-details"><summary data-copy="details"></summary><div><p class="neon-rate" data-copy="rate"></p><p data-copy="expiry"></p><p data-copy="delay"></p><a href="/apps/neon-cyber-wall-kicker/shop/privacy/" target="_blank" rel="noopener" data-copy="privacy"></a></div></details>
    <section class="neon-history" hidden><h3 data-copy="history"></h3><div></div></section>`;
  const el = selector => root.querySelector(selector);
  const copy = key => text[language][key] ?? text[language].error;
  let statusKey = 'loading', statusBad = false;
  const status = (key, bad = false) => { statusKey = key; statusBad = bad; const node = el('.neon-checkout-status'); node.textContent = copy(key); node.dataset.error = String(bad); node.hidden = key === 'ready'; };
  const money = (minor, currency) => new Intl.NumberFormat(language, { style: 'currency', currency }).format(minor / 100);
  function price(product, target) {
    target.replaceChildren();
    const primary = document.createElement('strong');
    primary.textContent = state.catalog?.display_currency === 'EUR' && product.euro?.cents > 0 ? '≈ ' + money(product.euro.cents, 'EUR') : money(product.price, 'RUB');
    target.append(primary);
    if (state.catalog?.display_currency === 'EUR') { const rub = document.createElement('small'); rub.textContent = money(product.price, 'RUB'); target.append(rub); }
  }
  function persist() {
    try { win.sessionStorage.setItem(KEY, JSON.stringify({ token: state.token, email: state.email, pending: state.pending, codeSent: state.codeSent })); durable = true; return true; }
    catch { durable = false; status('storage', true); return false; }
  }
  function controls() {
    root.querySelectorAll('button').forEach(button => { button.disabled = state.busy; });
    const matchesPending = !state.pending?.id || (state.pending.state === 'pending' && state.selected?.offer_version === state.pending.offer?.offer_version && state.selected?.id === state.pending.offer?.id);
    el('[data-pay]').disabled = state.busy || !state.ready || !state.token || !state.selected || !el('[data-consent]').checked || !durable || !matchesPending;
    el('[data-resume]').disabled = state.busy || !state.ready || !state.pending?.offer || state.pending.state !== 'pending';
    el('[data-cancel]').disabled = state.busy || state.pending?.state !== 'pending';
    el('[data-auth-submit]').disabled = state.busy || !state.ready;
    document.querySelectorAll('[data-neon-buy]').forEach(button => { button.disabled = state.busy || !state.ready || state.wallet?.owned_products?.includes(button.dataset.neonBuy); });
  }
  function render() {
    root.lang = language;
    status(statusKey, statusBad);
    root.querySelectorAll('[data-copy]').forEach(node => { node.textContent = copy(node.dataset.copy); });
    root.querySelectorAll('[data-lang]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.lang === language)));
    el('.neon-auth').hidden = Boolean(state.token) || !state.selected;
    el('.neon-account').hidden = !state.token;
    el('.neon-intro').hidden = Boolean(state.token) || !state.selected;
    if (state.codeSent) el('.neon-intro').textContent = copy('codeIntro') + state.email;
    el('.neon-email-label').hidden = state.codeSent;
    el('.neon-code').hidden = !state.codeSent;
    el('input[name=email]').value = state.email;
    el('input[name=email]').readOnly = state.codeSent;
    el('input[name=code]').required = state.codeSent;
    el('[data-auth-back]').hidden = !state.codeSent;
    el('[data-auth-submit]').textContent = copy(state.codeSent ? 'verify' : 'send');
    el('.neon-recipient').textContent = copy('account') + state.email;
    el('.neon-selected').hidden = !state.selected;
    el('.neon-payment').hidden = !state.selected || !state.token;
    el('.neon-choose').hidden = Boolean(state.selected);
    el('.neon-rate').hidden = state.catalog?.display_currency !== 'EUR';
    el('[data-retry-service]')?.toggleAttribute('hidden', state.ready);
    if (state.selected) {
      el('.neon-edit').href = state.selected.kind === 'bundle' ? '#bundles' : '#coins';
      el('.neon-selected h3').textContent = state.selected[language] || state.selected.en;
      el('.neon-selected-contents').textContent = new Intl.NumberFormat(language).format(state.selected.coins) + copy('coins');
      if (state.selected.kind === 'bundle') {
        const names = language === 'ru' ? { starter: 'Рифт-лис · Шов реальности · Осколки измерения', supporter: 'Маэстро затмения · Горизонт событий · Последнее солнце' }
          : { starter: 'Rift Fox · Rift Stitch · Rift Bloom', supporter: 'Eclipse Maestro · Event Horizon · Eclipse Finale' };
        el('.neon-selected-contents').textContent += ' · ' + names[state.selected.id];
      }
      price(state.selected, el('.neon-selected-price'));
      const terms = state.pending?.terms ?? state.catalog?.seller;
      const link = terms?.terms_url ? new URL(terms.terms_url) : null;
      el('[data-terms]').removeAttribute('href');
      if (link && ['https://neonwallkicker.ru', 'https://raccoon-app-labs.github.io'].includes(link.origin)) el('[data-terms]').href = link.href;
    }
    el('.neon-pending').hidden = !state.pending?.id;
    el('.neon-order-id').textContent = copy('id') + (state.pending?.id || '');
    el('.neon-order-summary').textContent = state.pending?.offer ? (state.pending.offer[language] || state.pending.offer.en) + ' · ' + money(state.pending.offer.price, 'RUB') : '';
    for (const card of document.querySelectorAll('[data-neon-product]')) {
      const product = state.catalog?.products.find(p => p.id === card.dataset.neonProduct);
      const target = card.querySelector('[data-neon-price]');
      if (product && target) price(product, target);
      const coins = card.querySelector('[data-neon-coins]');
      if (product && coins) coins.textContent = new Intl.NumberFormat(language).format(product.coins);
      const button = card.querySelector('[data-neon-buy]');
      if (button) button.textContent = copy('buy');
    }
    controls();
  }
  async function api(path, body) {
    const response = await win.fetch(apiOrigin + path, { method: body ? 'POST' : 'GET', cache: 'no-store', credentials: 'omit', redirect: 'error',
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(state.token ? { Authorization: 'Bearer ' + state.token } : {}) },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(12000) });
    const data = await response.json();
    if (!response.ok) { const error = new Error(data.error || 'service_error'); error.status = response.status; error.details = data; throw error; }
    return data;
  }
  async function guard(action) {
    if (state.busy) return;
    state.busy = true; controls();
    try { await action(); }
    catch (error) {
      if (error.status === 401) { state.token = ''; persist(); }
      if (['price_changed','offer_changed','terms_changed'].includes(error.message)) {
        if (error.details?.no_order_for_request_key === true && !state.pending?.id) state.pending = null;
        el('[data-consent]').checked = false; await synchronize().catch(() => {}); status('changed', true);
      } else if (error.message === 'invalid_code') status('codeError', true);
      else if (error.message === 'wait_before_resend') { state.codeSent = true; persist(); status('wait', true); }
      else if (error.message === 'minimum_payment') status('minimum', true);
      else if (error.message === 'storage') status('storage', true);
      else { state.ready = false; status('offline', true); }
    } finally { state.busy = false; render(); }
  }
  async function synchronize() {
    state.ready = false;
    if (!(await api('/v1/catalog?channel=website&ready=1')).ok) throw new Error('not_ready');
    state.catalog = await api('/v1/catalog?channel=website&pricing=first_purchase_20');
    if (!state.catalog.enabled || !state.catalog.website_checkout_available || !state.catalog.pricing_available) { status('paused', true); render(); return; }
    if (!compatibleCatalog(state.catalog)) throw new Error('incompatible_catalog');
    if (state.token) {
      state.wallet = await api('/v1/wallet');
      if (!state.wallet.pricing_available) throw new Error('exchange_rate_unavailable');
      if (!state.pending?.id && state.wallet.unresolved_orders?.length) state.pending = { id: state.wallet.unresolved_orders[0].id };
      if (state.pending?.id) await inspectPending();
    }
    if (state.selected && !state.pending?.id) { state.selected = state.catalog.products.find(p => p.id === state.selected.id) ?? null; el('[data-consent]').checked = false; }
    state.ready = true;
    if (persist()) status(state.lastOutcome || (state.pending?.id ? 'pending' : 'ready'));
    render();
  }
  async function inspectPending() {
    const row = await api('/v1/orders/' + encodeURIComponent(state.pending.id));
    if (row.state === 'paid' || row.state === 'refunded' || row.state === 'cancelled') {
      state.lastOutcome = row.state; state.pending = null; persist(); status(row.state, false); return row;
    }
    if (row.state === 'review') state.lastOutcome = 'review';
    state.pending = { ...state.pending, state: row.state, id: row.id, request_key: row.request_key, offer: row.product,
      terms: { terms_version: row.terms_version, terms_url: row.terms_url } }; persist(); return row;
  }
  async function checkout() {
    if (!state.selected || !state.token || !el('[data-consent]').checked) return;
    status('checking');
    const offer = state.selected;
    const terms = state.pending?.terms ?? state.catalog.seller;
    const pending = state.pending ?? { request_key: win.crypto.randomUUID(), offer, terms };
    state.pending = pending;
    if (!persist()) throw new Error('storage');
    if (!(await api('/v1/catalog?channel=website&ready=1')).ok) throw new Error('not_ready');
    await api('/v1/wallet');
    const body = { channel: 'website', language, product_id: offer.id, request_key: pending.request_key,
      accept_terms: true, expected_amount: offer.price, expected_offer_version: offer.offer_version, terms_version: terms.terms_version };
    const preflight = await api('/v1/orders', { ...body, preflight: true });
    if (!preflight.ready || preflight.order_created !== false || Date.parse(preflight.expires_at) <= Date.now()) throw new Error('preflight_unavailable');
    const order = await api('/v1/orders', { ...body, checkout_ticket: preflight.checkout_ticket });
    state.pending = { ...pending, state: order.state, id: order.id }; if (!persist()) throw new Error('storage');
    if (order.state === 'paid') { await inspectPending(); return; }
    const url = paymentUrl(order, offer, terms);
    // A second, authenticated check is performed immediately before leaving
    // the site. No provider URL is cached or offered when this check fails.
    if (!(await api('/v1/catalog?channel=website&ready=1')).ok) throw new Error('not_ready');
    const current = await api('/v1/orders/' + encodeURIComponent(order.id));
    if (current.state === 'paid') { await inspectPending(); return; }
    if (current.state !== 'pending' || current.amount !== offer.price || current.offer_version !== offer.offer_version) throw new Error('order_changed');
    navigate(url);
  }
  function choose(id) {
    state.lastOutcome = '';
    state.selected = state.catalog?.products.find(product => product.id === id) ?? null;
    el('[data-consent]').checked = false; render(); root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (!state.token) el('input[name=email]').focus({ preventScroll: true });
  }
  document.querySelectorAll('[data-neon-buy]').forEach(button => button.addEventListener('click', () => choose(button.dataset.neonBuy)));
  root.querySelectorAll('[data-lang]').forEach(button => button.addEventListener('click', () => { language = button.dataset.lang; render(); }));
  el('input[name=email]').addEventListener('input', event => { state.email = event.target.value; });
  el('.neon-auth').addEventListener('submit', event => { event.preventDefault(); guard(async () => {
    if (!state.codeSent) { state.email = el('input[name=email]').value.trim().toLowerCase(); await api('/v1/auth/request', { email: state.email }); state.codeSent = true; persist(); status('sent'); render(); el('input[name=code]').focus(); }
    else { const data = await api('/v1/auth/verify', { email: state.email, code: el('input[name=code]').value }); state.token = data.token; state.codeSent = false; persist(); await synchronize(); }
  }); });
  el('[data-auth-back]').addEventListener('click', () => {
    state.codeSent = false; el('input[name=code]').value = '';
    if (persist()) status(state.ready ? 'ready' : 'offline', !state.ready);
    render(); el('input[name=email]').focus();
  });
  el('[data-refresh]').addEventListener('click', () => guard(async () => { await synchronize(); if (state.token) await history(); }));
  el('[data-logout]').addEventListener('click', () => guard(async () => { await api('/v1/auth/logout', {}); state.token = ''; state.pending = null; state.wallet = null; state.selected = null; persist(); await synchronize(); }));
  el('[data-consent]').addEventListener('change', controls);
  el('[data-pay]').addEventListener('click', () => guard(checkout));
  el('[data-check]').addEventListener('click', () => guard(async () => { await inspectPending(); state.ready = true; }));
  el('[data-resume]').addEventListener('click', () => { if (!state.pending?.offer) return; state.selected = state.pending.offer; el('[data-consent]').checked = false; render(); });
  el('[data-cancel]').addEventListener('click', () => guard(async () => { await api('/v1/orders/' + encodeURIComponent(state.pending.id) + '/cancel', {}); state.pending = null; state.selected = null; persist(); await synchronize(); status('cancelled'); }));
  async function history() {
    const data = await api('/v1/orders?limit=10');
    const list = el('.neon-history div'); list.replaceChildren(); el('.neon-history').hidden = false;
    for (const row of data.orders || []) { const item = document.createElement('p'); item.textContent = row.id + ' · ' + row.state + ' · ' + money(row.amount, 'RUB'); list.append(item); }
  }
  const refresh = document.createElement('button'); refresh.type = 'button'; refresh.className = 'button secondary';
  refresh.textContent = copy('refresh'); refresh.dataset.copy = 'refresh'; refresh.dataset.retryService = ''; refresh.addEventListener('click', () => guard(synchronize)); root.append(refresh);
  render(); status('loading'); guard(synchronize);
  return { refresh: () => guard(synchronize), state };
}

if (typeof document !== 'undefined') {
  const root = document.querySelector('[data-neon-web-checkout]');
  if (root) mountCheckout(root);
}
