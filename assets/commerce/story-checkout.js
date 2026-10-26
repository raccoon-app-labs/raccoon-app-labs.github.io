import {API_BASE, ShopError, validateOffer, purchasableStories, purchaseRequest, confirmationUrl, createApi} from './story-checkout-core.mjs?v=20261026';

const root = document.documentElement;
const sourcePanel = document.querySelector('#stories-panel') || document.querySelector('.commerce-stories');
const standalone = document.body.hasAttribute('data-story-checkout');
if (sourcePanel || standalone) install();

function install() {
  const storageKey = 'magic-stories-shop-session-v1';
  const pendingKey = 'magic-stories-shop-payment-v1';
  const deviceKey = 'magic-stories-shop-device-v1';
  const read = key => { try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; } };
  const write = (key, value) => { try { value === null ? sessionStorage.removeItem(key) : sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* Memory-only checkout still works. */ } };
  let session = read(storageKey), pending = read(pendingKey);
  const deviceId = read(deviceKey) || crypto.randomUUID(); write(deviceKey, deviceId);
  const setSession = value => { session = value; write(storageKey, value); };
  const api = createApi({getSession:() => session, setSession, deviceId});
  let offer, stories = [], selected = null, product = 'premium', step = 'choose', busy = false;
  let email = '', sentAt = 0, error = '', notice = '', catalogError = false, catalogLoaded = false;
  let account = null, owned = new Set(), returnFocus, pollTimer, resendTimer, pollCount = 0, generation = 0, closing = false, renderedStep;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches || root.dataset.motion === 'reduced';
  const ru = () => (window.HanziLocale?.code || root.lang).startsWith('ru');
  const t = (r, e) => ru() ? r : e;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const price = amount => new Intl.NumberFormat(ru() ? 'ru-RU' : 'en-US', {style:'currency', currency:'RUB', maximumFractionDigits:2}).format(amount / 100);
  const dialog = document.createElement('dialog');
  dialog.className = 'magic-checkout'; dialog.dataset.noL10n = ''; dialog.setAttribute('aria-labelledby', 'magic-checkout-title');
  document.body.append(dialog);

  function clearTimers() { clearTimeout(pollTimer); clearInterval(resendTimer); }
  function close() {
    if (closing) return;
    closing = true; generation++; clearTimers();
    const finish = () => { dialog.close(); root.classList.remove('magic-checkout-open'); closing = false; returnFocus?.focus({preventScroll:true}); };
    if (reduced()) finish();
    else dialog.animate([{opacity:1, transform:'translateY(0) scale(1)'}, {opacity:0, transform:'translateY(24px) scale(.97)'}], {duration:190, easing:'ease-in'}).finished.then(finish, finish);
  }
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close(); } });

  const errors = {
    network_error:['Не удалось связаться с сервером. Проверьте интернет и попробуйте ещё раз.','Could not reach the server. Check your connection and try again.'],
    offer_unavailable:['Предложение пока недоступно. Попробуйте обновить.','The offer is unavailable. Please retry.'],
    catalog_unavailable:['Не удалось загрузить книги. Попробуйте ещё раз.','Could not load the books. Please retry.'],
    sales_unavailable:['Покупки временно недоступны. Попробуйте позже.','Purchases are temporarily unavailable. Please try later.'],
    offer_changed:['Цена или условия изменились. Проверьте обновлённое предложение и подтвердите его снова.','The price or terms changed. Review the new offer and confirm again.'],
    payment_pending:['У вас уже есть незавершённая оплата. Сначала проверьте её.','You already have a pending payment. Check it first.'],
    payment_uncertain:['Сервер мог создать счёт. Нажмите «Проверить оплату», прежде чем пробовать снова.','An invoice may have been created. Check payment before trying again.'],
    already_owned:['Эта книга уже ваша. Войдите с той же почтой в приложении.','You already own this book. Sign in to the app with the same email.'],
    premium_active:['Premium уже действует. Все сказки доступны в приложении.','Premium is already active. All stories are available in the app.'],
    already_active:['Premium уже действует. Новая покупка не нужна.','Premium is already active. No new purchase is needed.'],
    story_not_for_sale:['Эта сказка сейчас недоступна для отдельной покупки. Выберите другую.','This story cannot currently be purchased separately. Choose another.'],
    consent_required:['Подтвердите условия покупки.','Please accept the purchase terms.'],
    invalid_code:['Код неверный или истёк. Проверьте письмо или запросите новый.','The code is incorrect or expired. Check the email or request a new one.'],
    login_required:['Войдите по почте, чтобы продолжить.','Sign in with your email to continue.'],
    rate_limited:['Слишком много попыток. Подождите немного и попробуйте снова.','Too many attempts. Wait a little and try again.']
  };
  function errorText() { const code = error === 'try_later' ? 'rate_limited' : error; return errors[code] ? t(...errors[code]) : t('Не удалось выполнить действие. Попробуйте ещё раз.','Something went wrong. Please try again.'); }
  function primary(label, attrs = '') { return `<button class="magic-primary" ${attrs} ${busy ? 'disabled' : ''}><span>${label}</span><span aria-hidden="true">${busy ? '◌' : '↗'}</span></button>`; }
  function providers() {
    return `<fieldset class="magic-providers"><legend>${t('Через что оплатить','Payment method')}</legend><label class="magic-provider"><input type="radio" name="magic-provider" value="robokassa" checked><span class="magic-provider-mark" aria-hidden="true">R</span><span><strong>Robokassa</strong><small>${t('Для России','For Russia')}</small></span><span class="magic-provider-check" aria-hidden="true">✓</span></label><label class="magic-provider magic-provider-soon"><input type="radio" name="magic-provider" value="lava" disabled><span class="magic-provider-mark" aria-hidden="true">L</span><span><strong>Lava.top</strong><small>${t('Для всех','For everyone')}</small></span><span class="magic-soon">${t('Скоро','Coming soon')}</span></label></fieldset>`;
  }
  function premiumArt() {
    return `<div class="magic-orbit" aria-hidden="true"><i class="magic-orbit-ring"></i><i class="magic-orbit-ring"></i><span class="magic-orbit-star">✦</span><span class="magic-orbit-star">✧</span><span class="magic-orbit-moon">☾</span><div class="magic-orbit-book"><span>✦</span><b>MAGIC<br>STORIES</b><small>PREMIUM</small></div></div>`;
  }
  function summary() {
    return `<div class="magic-summary">${product === 'book' && selected?.cover ? `<img src="${escape(selected.cover)}" alt="" width="56" height="72">` : '<span class="magic-summary-star" aria-hidden="true">✦</span>'}<div><strong>${escape(product === 'book' ? selected?.title : t('Месяц Premium','One month of Premium'))}</strong><small>${product === 'book' ? t('Ваша навсегда · один платёж','Yours forever · one payment') : offer?.autoRenew ? t('Ежемесячная подписка','Monthly subscription') : t('Календарный месяц · без автопродления','One calendar month · no automatic renewal')}</small></div><b>${offer ? price(product === 'book' ? offer.bookAmount : offer.amount) : '…'}</b></div>`;
  }
  function render({animate = false, focus = false} = {}) {
    clearInterval(resendTimer);
    const stage = ({email:1, code:1, review:2, pending:2, success:2, owned:2})[step] || 0;
    dialog.innerHTML = `<div class="magic-shell" data-step="${step}" lang="${ru() ? 'ru' : 'en'}"><header class="magic-header"><a class="magic-shop-brand" href="/plus/?app=stories"><img src="/assets/apps/stories-icon.webp" alt="" width="34" height="34"><span>${t('Волшебные истории','Magical Stories')}<small>${t('Маленький магазин чудес','A little shop of wonders')}</small></span></a><button class="magic-close" data-action="close" aria-label="${t('Закрыть','Close')}">×</button></header><div class="magic-progress" aria-label="${t('Этапы покупки','Purchase steps')}">${[t('Выбираем чудо','Choose your magic'),t('Ваша почта','Your email'),t('Забираем с собой','Make it yours')].map((label, i) => `<span ${i === stage ? 'aria-current="step"' : ''}><b>${String(i+1).padStart(2,'0')}</b>${label}</span>`).join('')}</div><div class="magic-content">${content()}</div><p class="magic-error" role="alert" ${error ? '' : 'hidden'}>${error ? escape(errorText()) : ''}</p><footer class="magic-footer"><span aria-hidden="true">✧</span>${t('Покупка привязана к вашей почте и появится в приложении.','Your purchase is linked to your email and will appear in the app.')}<a href="mailto:raccoon.app.labs@gmail.com">${t('Помощь','Help')}</a></footer></div>`;
    if (renderedStep !== step) dialog.scrollTop = 0;
    renderedStep = step;
    const abandon = dialog.querySelector('[data-action="abandon"]'); if (abandon) abandon.hidden = !pending?.paymentId;
    dialog.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => action(button.dataset.action)));
    dialog.querySelectorAll('[data-product]').forEach(button => button.addEventListener('click', () => {
      if (busy || product === button.dataset.product) return;
      product = button.dataset.product; error = ''; render({animate:true});
      if (product === 'book') loadCatalog();
    }));
    dialog.querySelectorAll('[data-story-id]').forEach(button => button.addEventListener('click', () => {
      if (busy) return;
      selected = stories.find(story => story.id === Number(button.dataset.storyId));
      dialog.querySelectorAll('[data-story-id]').forEach(node => node.setAttribute('aria-pressed', String(node === button)));
      const selection = dialog.querySelector('.magic-selection'); if (selection) selection.textContent = selected.title;
      dialog.querySelector('[data-action="continue"]').disabled = !offer?.available;
      if (!reduced()) button.animate([{transform:'translateY(-4px) rotate(-2deg)'},{transform:'translateY(-7px) rotate(1deg)'},{transform:'translateY(-4px) rotate(0)'}], {duration:400, easing:'ease-out'});
    }));
    dialog.querySelector('[data-book-search]')?.addEventListener('input', event => {
      const query = event.target.value.trim().toLocaleLowerCase(); let count = 0;
      dialog.querySelectorAll('[data-story-id]').forEach(node => { node.hidden = !node.dataset.search.includes(query); if (!node.hidden) count++; });
      dialog.querySelector('[data-search-empty]').hidden = count !== 0;
    });
    dialog.querySelector('[data-email-form]')?.addEventListener('submit', event => { event.preventDefault(); email = new FormData(event.target).get('email').trim(); sendCode(); });
    dialog.querySelector('[data-code-form]')?.addEventListener('submit', event => { event.preventDefault(); confirmCode(new FormData(event.target).get('code')); });
    dialog.querySelector('[data-review-form]')?.addEventListener('submit', event => { event.preventDefault(); buy(new FormData(event.target).get('consent') === 'on'); });
    dialog.querySelector('[data-open-payment]')?.addEventListener('click', () => { pollCount = 0; schedulePoll(); });
    if (step === 'code') { updateResend(); resendTimer = setInterval(updateResend, 1000); }
    if (animate && !reduced()) dialog.querySelector('.magic-content').animate([{opacity:.15, transform:'perspective(900px) rotateY(-6deg) translateY(12px)'},{opacity:1,transform:'perspective(900px) rotateY(0) translateY(0)'}], {duration:420,easing:'cubic-bezier(.16,1,.3,1)'});
    if (focus) (dialog.querySelector('input:not([type=radio]):not([type=checkbox])') || dialog.querySelector('h1'))?.focus({preventScroll:true});
  }
  function content() {
    if (step === 'loading') return `<div class="magic-loading" role="status">${premiumArt()}<h1 id="magic-checkout-title" tabindex="-1">${t('Собираем немного волшебства…','Gathering a little magic…')}</h1></div>`;
    if (step === 'unavailable') return `<h1 id="magic-checkout-title" tabindex="-1">${t('Чуду нужна минутка','Magic needs a moment')}</h1><p class="magic-lead">${t('Не удалось получить актуальные условия с сервера.','We could not get the latest offer from the server.')}</p>${primary(t('Попробовать снова','Try again'),'data-action="reload"')}`;
    if (step === 'choose') return `<p class="magic-eyebrow">${t('ИСТОРИИ, КОТОРЫЕ ОСТАЮТСЯ','STORIES THAT STAY WITH YOU')}</p><h1 id="magic-checkout-title" tabindex="-1">${t('Какое чудо выберем?','Which magic will you choose?')}</h1><div class="magic-product-tabs" aria-label="${t('Что купить','Choose a product')}"><button data-product="premium" aria-pressed="${product === 'premium'}">✦ ${t('Подписка Premium','Premium subscription')}</button><button data-product="book" aria-pressed="${product === 'book'}">♡ ${t('Книга навсегда','A book to keep')}</button></div>${product === 'premium' ? `<div class="magic-premium-grid">${premiumArt()}<div><span class="magic-eyebrow">${t('ВСЯ БИБЛИОТЕКА · ОДИН МЕСЯЦ','THE WHOLE LIBRARY · ONE MONTH')}</span><h2>${t('Больше сказок.<br>Ближе друг к другу.','More stories.<br>Closer together.')}</h2><p class="magic-lead">${t('Читайте, слушайте и записывайте сказки голосами вашей семьи.','Read, listen and record stories in your family’s voices.')}</p><ul class="magic-benefits"><li>${t('Вся библиотека сказок','The entire story library')}</li><li>${t('Без рекламы','No ads')}</li><li>${t('Ваши семейные озвучки','Your family’s narrations')}</li></ul><p class="magic-big-price">${price(offer.amount)}<small> / ${t('месяц','month')}</small></p><p class="magic-caption">${offer.autoRenew ? t('Ежемесячное продление. Можно отключить в приложении.','Renews monthly. Cancel in the app.') : t('Один платёж. Без автоматического продления.','One payment. No automatic renewal.')}</p></div></div>` : booksContent()}${providers()}${!offer.available || offer.paymentProvider !== 'robokassa' ? `<p class="magic-notice">${t('Покупки сейчас недоступны. Загляните чуть позже.','Purchases are unavailable right now. Please come back later.')}</p>` : ''}<div class="magic-bottom"><span class="magic-selection">${product === 'book' ? escape(selected?.title || t('Выберите свою сказку','Choose your story')) : t('Пусть сегодня будет сказка','Make today a story day')}</span>${primary(t('Продолжить','Continue'),`data-action="continue" ${!offer.available || offer.paymentProvider !== 'robokassa' || (product === 'book' && (!selected || catalogError)) ? 'disabled' : ''}`)}</div>`;
    if (step === 'email') return `${summary()}<p class="magic-eyebrow">${t('ВАШ БИЛЕТ В СКАЗКУ','YOUR TICKET TO A STORY')}</p><h1 id="magic-checkout-title" tabindex="-1">${t('Куда отправим чудо?','Where shall we send the magic?')}</h1><p class="magic-lead">${t('Укажите ту же почту, что используете в приложении. Пришлём код для входа — пароль не нужен.','Use the same email as in the app. We’ll send you a sign-in code — no password needed.')}</p><form data-email-form class="magic-form"><label for="magic-email">Email</label><input id="magic-email" name="email" type="email" autocomplete="email" maxlength="254" placeholder="you@example.com" value="${escape(email)}" required ${busy ? 'disabled' : ''}><p class="magic-caption">${t('На эту почту будут привязаны покупка и чек.','Your purchase and receipt will be linked to this email.')}</p>${primary(t('Получить код','Get a code'))}</form><button class="magic-text-button" data-action="choose">← ${t('Вернуться к выбору','Back to choosing')}</button>`;
    if (step === 'code') return `<div class="magic-envelope" aria-hidden="true">✉<span>✦</span></div><h1 id="magic-checkout-title" tabindex="-1">${t('Вам волшебное письмо','A little magic in your inbox')}</h1><p class="magic-lead">${t('Введите 6 цифр из письма на','Enter the 6-digit code sent to')} <strong>${escape(email)}</strong></p><form data-code-form class="magic-form"><label for="magic-code">${t('Код из письма','Email code')}</label><input id="magic-code" class="magic-code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" placeholder="······" required ${busy ? 'disabled' : ''}>${primary(t('Войти и продолжить','Sign in and continue'))}</form><div class="magic-inline-actions"><button class="magic-text-button" data-action="resend" disabled></button><button class="magic-text-button" data-action="email">${t('Другая почта','Use another email')}</button></div>`;
    if (step === 'review') return `<p class="magic-eyebrow">${t('ПОЧТИ В ВАШЕЙ БИБЛИОТЕКЕ','ALMOST IN YOUR LIBRARY')}</p><h1 id="magic-checkout-title" tabindex="-1">${t('Остался один шаг','Just one more step')}</h1>${summary()}<div class="magic-account"><span>✉ ${escape(session.email)}</span><button class="magic-text-button" data-action="logout">${t('Сменить','Change')}</button></div>${providers()}<form data-review-form class="magic-form"><label class="magic-consent"><input type="checkbox" name="consent" required><span>${offer.autoRenew && product === 'premium' ? t('Согласен с ежемесячным автопродлением и','I agree to monthly automatic renewal and the') : t('Принимаю','I accept the')} <a href="${API_BASE}/legal/premium-terms.html" target="_blank" rel="noopener noreferrer">${t('условия покупки','purchase terms')}</a> ${t('и','and')} <a href="${API_BASE}/legal/privacy.html" target="_blank" rel="noopener noreferrer">${t('политику конфиденциальности','privacy policy')}</a>. ${product === 'book' || !offer.autoRenew ? t('Один платёж, без автопродления.','One payment, no automatic renewal.') : `${price(offer.amount)} ${t('каждый календарный месяц.','each calendar month.')}`}</span></label>${primary(`${t('Оплатить','Pay')} ${price(product === 'book' ? offer.bookAmount : offer.amount)}`)}<p class="magic-caption">${t('Оплата откроется на защищённой странице Robokassa. Данные карты здесь не вводятся.','Payment opens on Robokassa’s secure page. No card details are entered here.')}</p></form><button class="magic-text-button" data-action="choose">← ${t('Изменить выбор','Change selection')}</button>`;
    if (step === 'pending') {
      const url = confirmationUrl(pending?.confirmationUrl);
      return `<div class="magic-payment-orb" aria-hidden="true">✦</div><p class="magic-eyebrow">${t('ВАШЕ ЧУДО ЖДЁТ','YOUR MAGIC IS WAITING')}</p><h1 id="magic-checkout-title" tabindex="-1">${t('Продолжим в Robokassa','Continue with Robokassa')}</h1><p class="magic-lead">${t('Завершите оплату в новой вкладке. Эта страница проверит результат на сервере.','Complete payment in a new tab. This page will check the result with the server.')}</p><p class="magic-caption">${escape(session?.email)}</p>${pending?.type === 'BOOK' ? `<p class="magic-caption">${escape(stories.find(s => s.id === pending.storyId)?.title || t('Покупка книги','Book purchase'))}</p>` : ''}${url ? `<a class="magic-primary" href="${escape(url)}" target="_blank" rel="noopener noreferrer" data-open-payment><span>${t('Перейти к оплате','Open payment')}</span><span aria-hidden="true">↗</span></a>` : ''}<div class="magic-payment-status" role="status"><span class="magic-status-dot"></span>${t('Ожидаем подтверждение оплаты','Waiting for payment confirmation')}</div>${notice ? `<p class="magic-notice">${escape(notice)}</p>` : ''}<div class="magic-inline-actions"><button class="magic-text-button" data-action="check" ${busy ? 'disabled' : ''}>${t('Проверить оплату','Check payment')}</button><button class="magic-text-button" data-action="abandon" ${busy ? 'disabled' : ''}>${t('Отменить этот счёт','Cancel this invoice')}</button></div>`;
    }
    if (step === 'success' || step === 'owned') return `<div class="magic-success-seal" aria-hidden="true"><span>✦</span>✓<span>✧</span></div><p class="magic-eyebrow">${t('ЧУДО УЖЕ ВАШЕ','THE MAGIC IS YOURS')}</p><h1 id="magic-checkout-title" tabindex="-1">${t(step === 'success' ? 'Сказка начинается!' : 'У вас уже есть доступ',step === 'success' ? 'Your story starts here!' : 'You already have access')}</h1><p class="magic-lead">${t('Откройте «Волшебные истории» и войдите с почтой','Open Magical Stories and sign in with')} <strong>${escape(session?.email)}</strong>. ${t('Покупка появится в вашей библиотеке.','Your purchase will appear in your library.')}</p><a class="magic-primary" href="com.volshebnye.istorii.payment://payment/result"><span>${t('Открыть приложение','Open the app')}</span><span aria-hidden="true">↗</span></a><button class="magic-text-button" data-action="choose">${t('Вернуться в магазин','Back to the shop')}</button>`;
    return '';
  }
  function booksContent() {
    if (!catalogLoaded && !catalogError) return `<div class="magic-shelf-loading" role="status"><i></i><i></i><i></i><span>${t('Книги спешат на полку…','The books are finding their shelves…')}</span></div>`;
    if (catalogError) return `<div class="magic-notice"><p>${t('Не удалось загрузить книги с сервера.','Could not load the books from the server.')}</p><button class="magic-text-button" data-action="catalog">${t('Попробовать ещё раз','Try again')}</button></div>`;
    return `<div class="magic-shelf-heading"><p class="magic-lead">${t('Одна история. Сколько угодно тёплых вечеров.','One story. So many cozy evenings.')} <strong>${price(offer.bookAmount)}</strong></p><label class="magic-search"><span aria-hidden="true">⌕</span><input type="search" data-book-search placeholder="${t('Найти свою сказку','Find your story')}" aria-label="${t('Поиск книг','Search books')}"></label></div><div class="magic-books">${stories.map(story => `<button class="magic-book" data-story-id="${story.id}" data-search="${escape((story.title+' '+(story.category || '')).toLocaleLowerCase())}" aria-pressed="${selected?.id === story.id}" ${owned.has(story.id) ? 'disabled' : ''}><span class="magic-book-art">${story.cover ? `<img src="${escape(story.cover)}" alt="" width="200" height="260" loading="lazy" decoding="async">` : `<span class="magic-book-fallback" aria-hidden="true">${escape(story.emoji || '✦')}</span>`}<i aria-hidden="true">✓</i><small>${escape(story.age || '')}</small></span><strong>${escape(story.title)}</strong><span>${owned.has(story.id) ? t('Уже ваша','Already yours') : escape(story.category || t('Сказка навсегда','A story to keep'))}</span></button>`).join('')}</div><p class="magic-empty" data-search-empty ${stories.length ? 'hidden' : ''}>${t('Книг не найдено. Попробуйте другой запрос или загляните позже.','No books found. Try another search or come back later.')}</p>`;
  }
  function updateResend() {
    const button = dialog.querySelector('[data-action="resend"]'); if (!button) return;
    const seconds = Math.max(0, Math.ceil((sentAt + 60000 - Date.now())/1000));
    button.disabled = busy || seconds > 0;
    button.textContent = seconds ? `${t('Новый код через','New code in')} ${seconds} ${t('с','s')}` : t('Отправить код ещё раз','Resend code');
  }
  async function run(work) {
    if (busy) return; busy = true; error = ''; render(); const currentGeneration = generation;
    try { await work(); } catch (caught) {
      if (currentGeneration !== generation) return;
      error = caught.code || 'network_error';
      if (caught.status === 401) { setSession(null); step = 'email'; }
      if (error === 'offer_changed') { try { offer = validateOffer(await api('/api/premium/offer')); } catch { step = 'unavailable'; } }
      if (error === 'payment_pending' || error === 'payment_uncertain') {
        step = 'pending';
        try { if (await restorePending()) return; } catch { /* Keep the uncertainty visible; do not create another invoice automatically. */ }
      }
      if (['already_owned','premium_active','already_active'].includes(error)) { step = 'owned'; error = ''; }
    } finally { busy = false; if (currentGeneration === generation && dialog.open) render({animate:true, focus:true}); }
  }
  async function loadCatalog() {
    if (catalogLoaded || !offer) return;
    const currentGeneration = generation; catalogError = false;
    try {
      const [catalog, covers] = await Promise.all([api('/v1/catalog/ru'), api('/v1/catalog/covers').catch(() => ({covers:{}}))]);
      if (currentGeneration !== generation) return;
      stories = purchasableStories(catalog, offer, covers.covers); catalogLoaded = true;
    } catch { if (currentGeneration !== generation) return; catalogError = true; }
    if (step === 'choose' && dialog.open) render();
  }
  async function open(nextProduct = 'premium') {
    if (dialog.open) return;
    generation++; returnFocus = document.activeElement; product = nextProduct; step = 'loading'; error = ''; notice = '';
    dialog.showModal(); root.classList.add('magic-checkout-open'); render();
    if (!reduced()) dialog.animate([{opacity:0,transform:'translateY(38px) scale(.94)'},{opacity:1,transform:'translateY(0) scale(1)'}], {duration:420,easing:'cubic-bezier(.16,1,.3,1)'});
    const currentGeneration = generation;
    try {
      offer = validateOffer(await api('/api/premium/offer'));
      if (currentGeneration !== generation) return;
      step = 'choose'; render({focus:true});
      if (product === 'book') loadCatalog();
      if (session && pending) await run(async () => { await restorePending(); });
    } catch { if (currentGeneration === generation) { step = 'unavailable'; error = 'offer_unavailable'; render(); } }
  }
  async function sendCode() {
    await run(async () => { const currentGeneration = generation; await api('/api/auth/request-code',{method:'POST',body:{email}}); if (currentGeneration !== generation) return; sentAt = Date.now(); step = 'code'; });
  }
  async function confirmCode(code) {
    await run(async () => {
      const result = await api('/api/auth/confirm-code',{method:'POST',body:{email,code,deviceId,deviceName:'Магазин · браузер'}});
      setSession(result); await reviewAccount();
    });
  }
  async function restorePending() {
    try {
      const value = await api('/api/payments/pending',{authenticated:true});
      if (['succeeded','canceled','REFUNDED','REVIEW'].includes(value.status)) {
        if (value.status === 'succeeded') { pending = null; write(pendingKey,null); step = 'success'; return true; }
        pending = null; write(pendingKey,null); return false;
      }
      pending = value; write(pendingKey,value); step = 'pending'; schedulePoll(); return true;
    } catch (caught) { if (caught.code === 'payment_not_found' || caught.status === 404) { pending = null; write(pendingKey,null); return false; } throw caught; }
  }
  async function reviewAccount() {
    const currentGeneration = generation;
    const [status, books] = await Promise.all([api('/api/subscription',{authenticated:true}),api('/api/books',{authenticated:true})]);
    if (currentGeneration !== generation) return;
    account = status; owned = new Set(books.storyIds || []);
    if (await restorePending()) return;
    step = account.premium || (product === 'book' && owned.has(selected?.id)) ? 'owned' : 'review';
  }
  async function buy(accepted) {
    await run(async () => {
      const request = purchaseRequest(product, selected, offer, accepted);
      const value = await api(request.path,{method:'POST',body:request.body,authenticated:true});
      pending = {...value,type:product === 'book' ? 'BOOK' : 'INITIAL',storyId:selected?.id || 0}; write(pendingKey,pending);
      if (value.status === 'succeeded') { step = 'success'; pending = null; write(pendingKey,null); }
      else { step = 'pending'; schedulePoll(); }
    });
  }
  function schedulePoll() {
    clearTimeout(pollTimer);
    if (!dialog.open || step !== 'pending' || document.hidden || pollCount >= 60) return;
    pollTimer = setTimeout(() => { pollCount++; checkPayment(false); }, 5000);
  }
  async function checkPayment(manual = true) {
    if (busy) { schedulePoll(); return; }
    const check = async () => {
      const currentGeneration = generation;
      if (!pending?.paymentId) { if (!await restorePending()) { step = 'review'; notice = ''; } return; }
      const value = await api(`/api/payments/${encodeURIComponent(pending.paymentId)}`,{authenticated:true});
      if (currentGeneration !== generation) return;
      pending = {...pending,...value}; write(pendingKey,pending);
      if (value.status === 'succeeded') { step = 'success'; pending = null; write(pendingKey,null); clearTimeout(pollTimer); render({animate:true,focus:true}); }
      else if (['canceled','REFUNDED'].includes(value.status)) { pending = null; write(pendingKey,null); step = product === 'book' && !selected ? 'choose' : 'review'; error = ''; notice = ''; render(); }
      else if (value.status === 'REVIEW') { clearTimeout(pollTimer); notice = t('Сервер уточняет статус. Не оплачивайте повторно. Если ожидание затянулось, напишите в поддержку.','The server is reviewing this payment. Please do not pay again. Contact support if it takes too long.'); render(); }
      else { if (manual) notice = t('Подтверждение ещё не пришло. Если вы уже оплатили, подождите немного.','Confirmation has not arrived yet. If you paid, please wait a little.'); schedulePoll(); }
    };
    if (manual) await run(check);
    else { try { await check(); } catch { /* Background checks never overwrite a visible form or create a new payment. */ schedulePoll(); } }
  }
  function action(name) {
    if (name === 'close') return close();
    if (busy) return;
    if (name === 'reload') { dialog.close(); root.classList.remove('magic-checkout-open'); return open(product); }
    if (name === 'catalog') { catalogError = false; render(); return loadCatalog(); }
    if (name === 'continue') { if (product === 'book' && !selected) return; return run(async () => { if (session) await reviewAccount(); else step = 'email'; }); }
    if (name === 'resend') return sendCode();
    if (name === 'check') return checkPayment();
    if (name === 'abandon' && pending?.paymentId) return run(async () => {
      const value = await api(`/api/payments/${encodeURIComponent(pending.paymentId)}/abandon`,{method:'POST',authenticated:true});
      if (value.status === 'succeeded') step = 'success'; else step = 'choose';
      pending = null; write(pendingKey,null); clearTimeout(pollTimer);
    });
    if (name === 'logout') return run(async () => {
      await api('/api/auth/logout',{method:'POST',body:{refreshToken:session.refreshToken},authenticated:true});
      setSession(null); owned = new Set(); account = null; email = ''; step = 'email';
    });
    if (name === 'choose' || name === 'email') { step = name; error = ''; notice = ''; render({animate:true,focus:true}); if (name === 'choose' && product === 'book') loadCatalog(); }
  }
  function localizeSource() {
    sourcePanel?.querySelectorAll('[data-story-purchase]').forEach(link => {
      link.dataset.noL10n = ''; link.querySelector('span').textContent = link.dataset.storyPurchase === 'premium' ? t('Купить Premium','Buy Premium') : t('Выбрать книгу','Choose a book');
    });
    sourcePanel?.querySelectorAll('[data-story-copy]').forEach(node => {
      node.dataset.noL10n = '';
      const copies = {
        note:t('Актуальные цены и доступные книги загружаются с сервера перед покупкой.','Current prices and available books load from the server before purchase.'),
        book:t('Выберите сказку из каталога. Она останется с вами и после окончания Premium.','Choose a story from the catalog. It stays with you even after Premium ends.'),
        how:t('Выберите подписку или книгу, войдите по почте и оплатите через Robokassa. Покупка появится в приложении с той же почтой.','Choose a subscription or a book, sign in by email and pay with Robokassa. Your purchase appears in the app with the same email.'),
        payments:t('Robokassa — для России. Lava.top — для всех, скоро.','Robokassa — for Russia. Lava.top — for everyone, coming soon.'),
        step1:t('Выберите подписку или книгу','Choose a subscription or book'),step2:t('Войдите по почте','Sign in by email'),step3:t('Оплатите через Robokassa','Pay with Robokassa'),
        where:t('После оплаты войдите в приложении с той же почтой — подписка или купленная книга появится в библиотеке.','After payment, sign in to the app with the same email. Your subscription or purchased book appears in the library.')
      };
      node.textContent = copies[node.dataset.storyCopy] || node.textContent;
    });
  }
  document.addEventListener('click', event => {
    const link = event.target.closest('[data-story-purchase]'); if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); open(link.dataset.storyPurchase);
  });
  addEventListener('hanzi:languagechange', () => { localizeSource(); if (dialog.open) render(); });
  addEventListener('raccoon:appchange', () => { if (dialog.open && root.dataset.app !== 'stories') close(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(pollTimer); else if (dialog.open && step === 'pending') checkPayment(false); });
  addEventListener('pagehide', clearTimers);
  localizeSource();
  if (standalone) open(new URLSearchParams(location.search).get('product') === 'book' ? 'book' : 'premium');
}
