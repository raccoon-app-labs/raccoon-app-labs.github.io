import {API_BASE, ShopError, validateOffer, offerPath, purchasableStories, purchaseRequest, confirmationUrl, createApi} from './story-checkout-core.mjs?v=first-purchase-v1';
import {installBookCoverTilt} from './story-book-tilt.mjs?v=46e546adac41';
import {installBookPortal} from './story-book-portal.mjs?v=first-purchase-v1';

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
  let accountEpoch = 0, reviewed = null, busyOperation = null;
  const setSession = (value, newLogin = false) => {
    const changed = !!session?.accessToken !== !!value?.accessToken ||
      (session?.userId && value?.userId ? session.userId !== value.userId :
        session?.email && value?.email ? session.email.toLowerCase() !== value.email.toLowerCase() : false);
    if (newLogin || changed) { accountEpoch++; reviewed = null; }
    session = value; write(storageKey, value);
  };
  const api = createApi({getSession:() => session, setSession, getSessionEpoch:() => accountEpoch, deviceId});
  let offer, stories = [], selected = null, product = 'premium', step = 'choose', busy = false;
  let email = '', sentAt = 0, error = '', notice = '', catalogError = false, catalogLoaded = false;
  let account = null, owned = new Set(), returnFocus, pollTimer, resendTimer, pollCount = 0, generation = 0, closing = false, renderedStep;
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches || root.dataset.motion === 'reduced';
  const ru = () => (window.HanziLocale?.code || root.lang).startsWith('ru');
  const t = (r, e) => ru() ? r : e;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const price = amount => new Intl.NumberFormat(ru() ? 'ru-RU' : 'en-US', {style:'currency', currency:'RUB', maximumFractionDigits:2}).format(amount / 100);
  const fetchOffer = async (storyId = selected?.id) => validateOffer(await api(offerPath(storyId), {authenticated:!!session?.accessToken}));
  const scope = () => ({generation, accountEpoch, product, storyId:selected?.id || 0});
  const current = value => dialog.open && value.generation === generation && value.accountEpoch === accountEpoch && value.product === product && value.storyId === (selected?.id || 0);
  function freezeReview(context) {
    if (!current(context) || !offer || !session) return;
    const quote = structuredClone(offer); quote.bookStoryIds = Object.freeze(quote.bookStoryIds);
    reviewed = Object.freeze({...context, offer:Object.freeze(quote), product:context.product, story:selected ? Object.freeze(structuredClone(selected)) : null, email:session.email});
    step = 'review';
  }
  const reserved = value => value?.firstPurchaseDiscountReserved === true;
  function priceMarkup(kind = product, quoted = offer) {
    if (!quoted) return '…';
    const amount = kind === 'book' ? quoted.bookAmount : quoted.amount;
    const regular = kind === 'book' ? quoted.regularBookAmount : quoted.regularAmount;
    const discount = kind === 'book' ? quoted.bookDiscountPercent : quoted.premiumDiscountPercent;
    return discount === 20 ? `<s>${price(regular)}</s> ${price(amount)} <small>−20%</small>` : price(amount);
  }
  function offerNote(quoted = offer, kind = product) {
    if (quoted?.firstPurchaseDiscountState === 'sign_in_required') return `<p class="magic-caption">${t('Войдите по почте, чтобы проверить скидку 20% на первую покупку книги или Premium.','Sign in by email to check your 20% first-purchase discount for a book or Premium.')}</p>`;
    const discount = kind === 'book' ? quoted?.bookDiscountPercent : quoted?.premiumDiscountPercent;
    if (discount === 20) return `<p class="magic-caption">${kind === 'book' ? t('Скидка 20% на первую покупку. Один платёж.','20% off your first purchase. One payment.') : `${t('Первый месяц со скидкой 20%, затем','First month 20% off, then')} ${price(quoted.renewalAmount)} ${quoted.autoRenew ? t('за календарный месяц.','per calendar month.') : t('при следующей покупке месяца Premium. Автопродления нет.','when you next buy a month of Premium. No automatic renewal.')}`}</p>`;
    if (quoted?.firstPurchaseDiscountState === 'reserved') return `<p class="magic-caption">${t('За вашим аккаунтом закреплён незавершённый счёт. Проверьте его перед новой покупкой.','Your account has an unfinished invoice. Check it before starting a new purchase.')}</p>`;
    return '';
  }
  async function openSelectedBook() {
    const context = scope();
    await run(async captured => { const value = await fetchOffer(captured.storyId); if (current(captured)) offer = value; });
    if (!current(context)) return;
    const button = dialog.querySelector(`[data-story-id="${selected?.id}"]`);
    if (!error && selected && button && offer) bookPortal.open({story:selected, amount:offer.bookAmount, regularAmount:offer.regularBookAmount, discountPercent:offer.bookDiscountPercent, discountState:offer.firstPurchaseDiscountState, available:offer.available && offer.paymentProvider === 'robokassa' && !catalogError, source:button});
  }
  const dialog = document.createElement('dialog');
  dialog.className = 'magic-checkout'; dialog.dataset.noL10n = ''; dialog.setAttribute('aria-labelledby', 'magic-checkout-title');
  document.body.append(dialog);
  const coverTilt = installBookCoverTilt(dialog);
  const bookPortal = installBookPortal({host:dialog, translate:t, escape, price, resetTilt:() => coverTilt.reset(), onContinue:() => action('continue')});

  function clearTimers() { clearTimeout(pollTimer); clearInterval(resendTimer); }
  function close() {
    if (closing) return;
    bookPortal.close({immediate:true,restoreFocus:false});
    coverTilt.reset();
    closing = true; generation++; reviewed = null; busyOperation = null; busy = false; clearTimers();
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
  function primary(label, attrs = '') { return `<button class="magic-primary" aria-busy="${busy}" ${attrs} ${busy ? 'disabled' : ''}><span>${label}</span><span aria-hidden="true">${busy ? '◌' : '↗'}</span></button>`; }
  function providers() {
    return `<fieldset class="magic-providers"><legend>${t('Через что оплатить','Payment method')}</legend><label class="magic-provider"><input type="radio" name="magic-provider" value="robokassa" checked><span class="magic-provider-mark" aria-hidden="true">R</span><span><strong>Robokassa</strong><small>${t('Для России','For Russia')}</small></span><span class="magic-provider-check" aria-hidden="true">✓</span></label><label class="magic-provider magic-provider-soon"><input type="radio" name="magic-provider" value="lava" disabled><span class="magic-provider-mark" aria-hidden="true">L</span><span><strong>Lava.top</strong><small>${t('Для всех','For everyone')}</small></span><span class="magic-soon">${t('Скоро','Coming soon')}</span></label></fieldset>`;
  }
  function premiumArt() {
    return `<div class="magic-orbit" aria-hidden="true"><i class="magic-orbit-ring"></i><i class="magic-orbit-ring"></i><span class="magic-orbit-star">✦</span><span class="magic-orbit-star">✧</span><span class="magic-orbit-moon">☾</span><div class="magic-orbit-book"><span>✦</span><b>MAGIC<br>STORIES</b><small>PREMIUM</small></div></div>`;
  }
  function summary(snapshot = null) {
    const quoted = snapshot?.offer || offer, kind = snapshot?.product || product, story = snapshot?.story || selected;
    return `<div class="magic-summary">${kind === 'book' && story?.cover ? `<img src="${escape(story.cover)}" alt="" width="56" height="72">` : '<span class="magic-summary-star" aria-hidden="true">✦</span>'}<div><strong>${escape(kind === 'book' ? story?.title : t('Месяц Premium','One month of Premium'))}</strong><small>${kind === 'book' ? t('Ваша навсегда · один платёж','Yours forever · one payment') : quoted?.autoRenew ? t('Ежемесячная подписка','Monthly subscription') : t('Календарный месяц · без автопродления','One calendar month · no automatic renewal')}</small></div><b>${priceMarkup(kind, quoted)}</b></div>`;
  }
  function render({animate = false, focus = false} = {}) {
    coverTilt.reset();
    clearInterval(resendTimer);
    const stage = ({email:1, code:1, review:2, pending:2, success:2, owned:2})[step] || 0;
    dialog.innerHTML = `<div class="magic-shell" data-step="${step}" lang="${ru() ? 'ru' : 'en'}"><header class="magic-header"><a class="magic-shop-brand" href="/plus/?app=stories"><img src="/assets/apps/stories-icon.webp" alt="" width="34" height="34"><span>${t('Волшебные истории','Magical Stories')}<small>${t('Маленький магазин чудес','A little shop of wonders')}</small></span></a><button class="magic-close" data-action="close" aria-label="${t('Закрыть','Close')}">×</button></header><div class="magic-progress" aria-label="${t('Этапы покупки','Purchase steps')}">${[t('Выбираем чудо','Choose your magic'),t('Ваша почта','Your email'),t('Забираем с собой','Make it yours')].map((label, i) => `<span ${i === stage ? 'aria-current="step"' : ''}><b>${String(i+1).padStart(2,'0')}</b>${label}</span>`).join('')}</div><div class="magic-content">${content()}</div><p class="magic-error" role="alert" ${error ? '' : 'hidden'}>${error ? escape(errorText()) : ''}</p><footer class="magic-footer"><span aria-hidden="true">✧</span>${t('Покупка привязана к вашей почте и появится в приложении.','Your purchase is linked to your email and will appear in the app.')}<a href="mailto:raccoon.app.labs@gmail.com">${t('Помощь','Help')}</a></footer></div>`;
    coverTilt.refresh();
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
      openSelectedBook();
    }));
    dialog.querySelector('[data-book-search]')?.addEventListener('input', event => {
      coverTilt.reset();
      const query = event.target.value.trim().toLocaleLowerCase(); let count = 0;
      dialog.querySelectorAll('[data-story-id]').forEach(node => { const hidden = !node.dataset.search.includes(query); if (node.hidden !== hidden) node.hidden = hidden; if (!hidden) count++; });
      const empty = dialog.querySelector('[data-search-empty]'); if (empty.hidden !== (count !== 0)) empty.hidden = count !== 0;
    });
    dialog.querySelector('[data-email-form]')?.addEventListener('submit', event => { event.preventDefault(); email = new FormData(event.target).get('email').trim(); sendCode(); });
    dialog.querySelector('[data-code-form]')?.addEventListener('submit', event => { event.preventDefault(); confirmCode(new FormData(event.target).get('code')); });
    const displayedReview = reviewed;
    dialog.querySelector('[data-review-form]')?.addEventListener('submit', event => { event.preventDefault(); buy(new FormData(event.target).get('consent') === 'on', displayedReview); });
    dialog.querySelector('[data-open-payment]')?.addEventListener('click', () => { pollCount = 0; schedulePoll(); });
    if (step === 'code') { updateResend(); resendTimer = setInterval(updateResend, 1000); }
    if (animate && !reduced()) dialog.querySelector('.magic-content').animate([{opacity:.15, transform:'perspective(900px) rotateY(-6deg) translateY(12px)'},{opacity:1,transform:'perspective(900px) rotateY(0) translateY(0)'}], {duration:420,easing:'cubic-bezier(.16,1,.3,1)'});
    if (focus) (dialog.querySelector('input:not([type=radio]):not([type=checkbox])') || dialog.querySelector('h1'))?.focus({preventScroll:true});
  }
  function reviewContent() {
    const snapshot = reviewed;
    if (!snapshot || !current(snapshot)) return `<p class="magic-lead">${t('Проверьте актуальное предложение перед оплатой.','Review the current offer before paying.')}</p>${primary(t('Проверить предложение','Review offer'),'data-action="continue"')}`;
    const {offer, product, story:selected} = snapshot;
    return `<p class="magic-eyebrow">${t('ПОЧТИ В ВАШЕЙ БИБЛИОТЕКЕ','ALMOST IN YOUR LIBRARY')}</p><h1 id="magic-checkout-title" tabindex="-1">${t('Остался один шаг','Just one more step')}</h1>${summary(snapshot)}${offerNote(offer, product)}<div class="magic-account"><span>✉ ${escape(snapshot.email)}</span><button class="magic-text-button" data-action="logout">${t('Сменить','Change')}</button></div>${providers()}<form data-review-form class="magic-form"><label class="magic-consent"><input type="checkbox" name="consent" required><span>${offer.autoRenew && product === 'premium' ? t('Согласен с ежемесячным автопродлением и','I agree to monthly automatic renewal and the') : t('Принимаю','I accept the')} <a href="${API_BASE}/legal/premium-terms.html" target="_blank" rel="noopener noreferrer">${t('условия покупки','purchase terms')}</a> ${t('и','and')} <a href="${API_BASE}/legal/privacy.html" target="_blank" rel="noopener noreferrer">${t('политику конфиденциальности','privacy policy')}</a>. ${product === 'book' || !offer.autoRenew ? t('Один платёж, без автопродления.','One payment, no automatic renewal.') : `${t('Сейчас','Today')} ${price(offer.amount)}, ${t('затем','then')} ${price(offer.renewalAmount || offer.amount)} ${t('каждый календарный месяц.','each calendar month.')}`}</span></label>${primary(`${t('Оплатить','Pay')} ${price(product === 'book' ? offer.bookAmount : offer.amount)}`)}<p class="magic-caption">${t('Оплата откроется на защищённой странице Robokassa. Данные карты здесь не вводятся.','Payment opens on Robokassa’s secure page. No card details are entered here.')}</p></form><button class="magic-text-button" data-action="choose">← ${t('Изменить выбор','Change selection')}</button>`;
  }
  function content() {
    if (step === 'loading') return `<div class="magic-loading" role="status">${premiumArt()}<h1 id="magic-checkout-title" tabindex="-1">${t('Собираем немного волшебства…','Gathering a little magic…')}</h1></div>`;
    if (step === 'unavailable') return `<h1 id="magic-checkout-title" tabindex="-1">${t('Чуду нужна минутка','Magic needs a moment')}</h1><p class="magic-lead">${t('Не удалось получить актуальные условия с сервера.','We could not get the latest offer from the server.')}</p>${primary(t('Попробовать снова','Try again'),'data-action="reload"')}`;
    if (step === 'choose') return `<p class="magic-eyebrow">${t('ИСТОРИИ, КОТОРЫЕ ОСТАЮТСЯ','STORIES THAT STAY WITH YOU')}</p><h1 id="magic-checkout-title" tabindex="-1">${t('Какое чудо выберем?','Which magic will you choose?')}</h1><div class="magic-product-tabs" aria-label="${t('Что купить','Choose a product')}"><button data-product="premium" aria-pressed="${product === 'premium'}">✦ ${t('Подписка Premium','Premium subscription')}</button><button data-product="book" aria-pressed="${product === 'book'}">♡ ${t('Книга навсегда','A book to keep')}</button></div>${product === 'premium' ? `<div class="magic-premium-grid">${premiumArt()}<div><span class="magic-eyebrow">${t('ВСЯ БИБЛИОТЕКА · ОДИН МЕСЯЦ','THE WHOLE LIBRARY · ONE MONTH')}</span><h2>${t('Больше сказок.<br>Ближе друг к другу.','More stories.<br>Closer together.')}</h2><p class="magic-lead">${t('Читайте, слушайте и записывайте сказки голосами вашей семьи.','Read, listen and record stories in your family’s voices.')}</p><ul class="magic-benefits"><li>${t('Вся библиотека сказок','The entire story library')}</li><li>${t('Без рекламы','No ads')}</li><li>${t('Ваши семейные озвучки','Your family’s narrations')}</li></ul><p class="magic-big-price">${priceMarkup('premium')}<small> / ${t('месяц','month')}</small></p><p class="magic-caption">${offer.autoRenew ? t('Ежемесячное продление. Можно отключить в приложении.','Renews monthly. Cancel in the app.') : t('Один платёж. Без автоматического продления.','One payment. No automatic renewal.')}</p></div></div>` : booksContent()}${offerNote()}${product === 'premium' ? providers() : ''}${!offer.available || offer.paymentProvider !== 'robokassa' ? `<p class="magic-notice">${t('Покупки сейчас недоступны. Загляните чуть позже.','Purchases are unavailable right now. Please come back later.')}</p>` : ''}<div class="magic-bottom"><span class="magic-selection">${product === 'book' ? escape(selected?.title || t('Выберите свою сказку','Choose your story')) : t('Пусть сегодня будет сказка','Make today a story day')}</span>${primary(t('Продолжить','Continue'),`data-action="${product === 'book' ? 'open-book' : 'continue'}" ${!offer.available || offer.paymentProvider !== 'robokassa' || (product === 'book' && (!selected || catalogError)) ? 'disabled' : ''}`)}</div>`;
    if (step === 'email') return `${summary()}<p class="magic-eyebrow">${t('ВАШ БИЛЕТ В СКАЗКУ','YOUR TICKET TO A STORY')}</p><h1 id="magic-checkout-title" tabindex="-1">${t('Куда отправим чудо?','Where shall we send the magic?')}</h1><p class="magic-lead">${t('Укажите ту же почту, что используете в приложении. Пришлём код для входа — пароль не нужен.','Use the same email as in the app. We’ll send you a sign-in code — no password needed.')}</p><form data-email-form class="magic-form"><label for="magic-email">Email</label><input id="magic-email" name="email" type="email" autocomplete="email" maxlength="254" placeholder="you@example.com" value="${escape(email)}" required ${busy ? 'disabled' : ''}><p class="magic-caption">${t('На эту почту будут привязаны покупка и чек.','Your purchase and receipt will be linked to this email.')}</p>${primary(t('Получить код','Get a code'))}</form><button class="magic-text-button" data-action="choose">← ${t('Вернуться к выбору','Back to choosing')}</button>`;
    if (step === 'code') return `<div class="magic-envelope" aria-hidden="true">✉<span>✦</span></div><h1 id="magic-checkout-title" tabindex="-1">${t('Вам волшебное письмо','A little magic in your inbox')}</h1><p class="magic-lead">${t('Введите 6 цифр из письма на','Enter the 6-digit code sent to')} <strong>${escape(email)}</strong></p><form data-code-form class="magic-form"><label for="magic-code">${t('Код из письма','Email code')}</label><input id="magic-code" class="magic-code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" placeholder="······" required ${busy ? 'disabled' : ''}>${primary(t('Войти и продолжить','Sign in and continue'))}</form><div class="magic-inline-actions"><button class="magic-text-button" data-action="resend" disabled></button><button class="magic-text-button" data-action="email">${t('Другая почта','Use another email')}</button></div>`;
    if (step === 'review') return reviewContent();
    if (step === 'pending') {
      if (pending?.status === 'canceled' && reserved(pending)) return `<div class="magic-payment-orb" aria-hidden="true">✧</div><h1 id="magic-checkout-title" tabindex="-1">${t('Проверим первый счёт','Let’s check the first invoice')}</h1><p class="magic-lead">${t('Скидка 20% закреплена за этим счётом. Отмена в браузере не подтверждает, что деньги не были списаны. Проверьте оплату; если статус не меняется, напишите в поддержку. Новый счёт со скидкой пока не создаётся.','Your 20% discount is reserved for this invoice. Canceling in the browser does not confirm that no charge occurred. Check the payment; if its status stays unchanged, contact support. Another discounted invoice cannot be created yet.')}</p><button class="magic-text-button" data-action="check" ${busy ? 'disabled' : ''}>${t('Проверить оплату','Check payment')}</button><a class="magic-text-button" href="mailto:raccoon.app.labs@gmail.com">${t('Написать в поддержку','Contact support')}</a>`;
      if (pending?.status === 'REVIEW') return `<div class="magic-payment-orb" aria-hidden="true">✧</div><h1 id="magic-checkout-title" tabindex="-1">${t('Уточняем статус оплаты','Reviewing your payment')}</h1><p class="magic-lead">${t('Сервер уточняет результат этого платежа. Не оплачивайте повторно. Если ожидание затянулось, напишите в поддержку.','The server is reviewing this payment. Please do not pay again. Contact support if it takes too long.')}</p><button class="magic-text-button" data-action="check">${t('Проверить оплату','Check payment')}</button>`;
      const url = confirmationUrl(pending?.confirmationUrl);
      return `<div class="magic-payment-orb" aria-hidden="true">✦</div><p class="magic-eyebrow">${t('ВАШЕ ЧУДО ЖДЁТ','YOUR MAGIC IS WAITING')}</p><h1 id="magic-checkout-title" tabindex="-1">${t('Продолжим в Robokassa','Continue with Robokassa')}</h1><p class="magic-lead">${t('Завершите оплату в новой вкладке. Эта страница проверит результат на сервере.','Complete payment in a new tab. This page will check the result with the server.')}</p><p class="magic-caption">${escape(session?.email)}</p>${pending?.type === 'BOOK' ? `<p class="magic-caption">${escape(stories.find(s => s.id === pending.storyId)?.title || t('Покупка книги','Book purchase'))}</p>` : ''}${url ? `<a class="magic-primary" href="${escape(url)}" target="_blank" rel="noopener noreferrer" data-open-payment><span>${t('Перейти к оплате','Open payment')}</span><span aria-hidden="true">↗</span></a>` : ''}<div class="magic-payment-status" role="status"><span class="magic-status-dot"></span>${t('Ожидаем подтверждение оплаты','Waiting for payment confirmation')}</div>${notice ? `<p class="magic-notice">${escape(notice)}</p>` : ''}<div class="magic-inline-actions"><button class="magic-text-button" data-action="check" ${busy ? 'disabled' : ''}>${t('Проверить оплату','Check payment')}</button><button class="magic-text-button" data-action="abandon" ${busy ? 'disabled' : ''}>${t('Отменить этот счёт','Cancel this invoice')}</button></div>`;
    }
    if (step === 'success' || step === 'owned') return `<div class="magic-success-seal" aria-hidden="true"><span>✦</span>✓<span>✧</span></div><p class="magic-eyebrow">${t('ЧУДО УЖЕ ВАШЕ','THE MAGIC IS YOURS')}</p><h1 id="magic-checkout-title" tabindex="-1">${t(step === 'success' ? 'Сказка начинается!' : 'У вас уже есть доступ',step === 'success' ? 'Your story starts here!' : 'You already have access')}</h1><p class="magic-lead">${t('Откройте «Волшебные истории» и войдите с почтой','Open Magical Stories and sign in with')} <strong>${escape(session?.email)}</strong>. ${t('Покупка появится в вашей библиотеке.','Your purchase will appear in your library.')}</p><a class="magic-primary" href="com.volshebnye.istorii.payment://payment/result"><span>${t('Открыть приложение','Open the app')}</span><span aria-hidden="true">↗</span></a><button class="magic-text-button" data-action="choose">${t('Вернуться в магазин','Back to the shop')}</button>`;
    return '';
  }
  function booksContent() {
    if (!catalogLoaded && !catalogError) return `<div class="magic-shelf-loading" role="status"><i></i><i></i><i></i><span>${t('Книги спешат на полку…','The books are finding their shelves…')}</span></div>`;
    if (catalogError) return `<div class="magic-notice"><p>${t('Не удалось загрузить книги с сервера.','Could not load the books from the server.')}</p><button class="magic-text-button" data-action="catalog">${t('Попробовать ещё раз','Try again')}</button></div>`;
    return `<div class="magic-shelf-heading"><p class="magic-lead">${t('Одна история. Сколько угодно тёплых вечеров.','One story. So many cozy evenings.')} <strong>${priceMarkup('book')}</strong></p><label class="magic-search"><span aria-hidden="true">⌕</span><input type="search" data-book-search placeholder="${t('Найти свою сказку','Find your story')}" aria-label="${t('Поиск книг','Search books')}"></label></div><div class="magic-books">${stories.map(story => `<button class="magic-book" data-story-id="${story.id}" data-search="${escape((story.title+' '+(story.category || '')).toLocaleLowerCase())}" aria-pressed="${selected?.id === story.id}" ${owned.has(story.id) ? 'disabled' : ''}><span class="magic-book-art"><span class="magic-book-glare" aria-hidden="true"><span class="magic-book-light"></span></span>${story.cover ? `<img src="${escape(story.cover)}" alt="" width="200" height="260" loading="lazy" decoding="async">` : `<span class="magic-book-fallback" aria-hidden="true">${escape(story.emoji || '✦')}</span>`}<i aria-hidden="true">✓</i><small>${escape(story.age || '')}</small></span><strong>${escape(story.title)}</strong><span>${owned.has(story.id) ? t('Уже ваша','Already yours') : escape(story.category || t('Сказка навсегда','A story to keep'))}</span></button>`).join('')}</div><p class="magic-empty" data-search-empty ${stories.length ? 'hidden' : ''}>${t('Книг не найдено. Попробуйте другой запрос или загляните позже.','No books found. Try another search or come back later.')}</p>`;
  }
  function updateResend() {
    const button = dialog.querySelector('[data-action="resend"]'); if (!button) return;
    const seconds = Math.max(0, Math.ceil((sentAt + 60000 - Date.now())/1000));
    button.disabled = busy || seconds > 0;
    button.textContent = seconds ? `${t('Новый код через','New code in')} ${seconds} ${t('с','s')}` : t('Отправить код ещё раз','Resend code');
  }
  async function run(work) {
    if (busy) return;
    const context = scope(), operation = {}; busyOperation = operation; busy = true; error = ''; render();
    try { await work(context); } catch (caught) {
      if (!current(context)) return;
      error = caught.code || 'network_error';
      if (caught.status === 401) {
        setSession(null); context.accountEpoch = accountEpoch; offer = null; reviewed = null; pending = null; write(pendingKey,null); owned = new Set(); account = null; step = 'email';
        try { const value = await fetchOffer(context.storyId); if (current(context)) offer = value; } catch { if (current(context)) step = 'unavailable'; }
      }
      if (error === 'offer_changed') {
        try { const value = await fetchOffer(context.storyId); if (!current(context)) return; offer = value; if (step === 'review') freezeReview(context); } catch { if (current(context)) step = 'unavailable'; }
      }
      if (error === 'payment_pending' || error === 'payment_uncertain') {
        step = 'pending';
        try { if (await restorePending(context)) return; } catch { /* Do not create another invoice automatically. */ }
      }
      if (current(context) && ['already_owned','premium_active','already_active'].includes(error)) { step = 'owned'; reviewed = null; error = ''; }
    } finally {
      if (busyOperation === operation) { busyOperation = null; busy = false; if (current(context)) render({animate:true, focus:true}); }
    }
  }
  async function loadCatalog() {
    if (catalogLoaded || !offer) return;
    const context = scope(), catalogOffer = offer; catalogError = false;
    try {
      const [catalog, covers] = await Promise.all([api('/v1/catalog/ru'), api('/v1/catalog/covers').catch(() => ({covers:{}}))]);
      if (!current(context)) return;
      stories = purchasableStories(catalog, catalogOffer, covers.covers); catalogLoaded = true;
    } catch { if (!current(context)) return; catalogError = true; }
    if (step === 'choose' && dialog.open) render();
  }
  async function open(nextProduct = 'premium') {
    if (dialog.open) return;
    generation++; busyOperation = null; busy = false; reviewed = null; returnFocus = document.activeElement; product = nextProduct; step = 'loading'; error = ''; notice = '';
    dialog.showModal(); root.classList.add('magic-checkout-open'); render();
    if (!reduced()) dialog.animate([{opacity:0,transform:'translateY(38px) scale(.94)'},{opacity:1,transform:'translateY(0) scale(1)'}], {duration:420,easing:'cubic-bezier(.16,1,.3,1)'});
    const context = scope();
    try {
      const value = await fetchOffer(context.storyId);
      if (!current(context)) return;
      offer = value; step = 'choose'; render({focus:true});
      if (product === 'book') loadCatalog();
      if (session && pending) await run(async captured => { await restorePending(captured); });
    } catch { if (current(context)) { step = 'unavailable'; error = 'offer_unavailable'; render(); } }
  }
  async function sendCode() {
    await run(async context => { await api('/api/auth/request-code',{method:'POST',body:{email}}); if (!current(context)) return; sentAt = Date.now(); step = 'code'; });
  }
  async function confirmCode(code) {
    await run(async context => {
      const result = await api('/api/auth/confirm-code',{method:'POST',body:{email,code,deviceId,deviceName:'Магазин · браузер'}});
      if (!current(context)) return;
      setSession(result, true); context.accountEpoch = accountEpoch; await reviewAccount(context);
    });
  }
  async function restorePending(context = scope()) {
    const paymentId = pending?.paymentId;
    try {
      if (paymentId) {
        try {
          const saved = await api(`/api/payments/${encodeURIComponent(paymentId)}`,{authenticated:true});
          if (!current(context) || pending?.paymentId !== paymentId) return false;
          if (saved.status === 'succeeded') { pending = null; write(pendingKey,null); reviewed = null; step = 'success'; return true; }
          if (reserved(saved) || !['canceled','REFUNDED'].includes(saved.status)) {
            pending = {...pending,...saved}; write(pendingKey,pending); reviewed = null; step = 'pending';
            if (saved.status !== 'REVIEW') schedulePoll();
            return true;
          }
        } catch (caught) { if (!current(context) || pending?.paymentId !== paymentId) return false; if (caught.code !== 'payment_not_found' && caught.status !== 404) throw caught; }
        if (!current(context) || pending?.paymentId !== paymentId) return false;
        pending = null; write(pendingKey,null);
      }
      const value = await api('/api/payments/pending',{authenticated:true});
      if (!current(context) || pending) return false;
      if (!reserved(value) && ['succeeded','canceled','REFUNDED'].includes(value.status)) {
        if (value.status === 'succeeded') { reviewed = null; step = 'success'; return true; }
        return false;
      }
      pending = value; write(pendingKey,value); reviewed = null; step = 'pending'; if (value.status !== 'REVIEW') schedulePoll(); return true;
    } catch (caught) {
      if (!current(context)) return false;
      if (caught.code === 'payment_not_found' || caught.status === 404) return false;
      throw caught;
    }
  }
  async function reviewAccount(context = scope()) {
    const [status, books, personalOffer] = await Promise.all([api('/api/subscription',{authenticated:true}),api('/api/books',{authenticated:true}),fetchOffer(context.storyId)]);
    if (!current(context)) return;
    account = status; owned = new Set(books.storyIds || []); offer = personalOffer;
    if (await restorePending(context) || !current(context)) return;
    if (account.premium || (context.product === 'book' && owned.has(context.storyId))) { reviewed = null; step = 'owned'; }
    else freezeReview(context);
  }
  async function buy(accepted, snapshot = reviewed) {
    await run(async context => {
      if (!snapshot || snapshot !== reviewed || !current(snapshot)) throw new ShopError('offer_changed');
      const request = purchaseRequest(snapshot.product, snapshot.story, snapshot.offer, accepted);
      const value = await api(request.path,{method:'POST',body:request.body,authenticated:true});
      if (!current(context)) return;
      pending = {...value,type:snapshot.product === 'book' ? 'BOOK' : 'INITIAL',storyId:snapshot.story?.id || 0}; write(pendingKey,pending); reviewed = null;
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
    const check = async context => {
      const paymentId = pending?.paymentId;
      if (!paymentId) { if (!await restorePending(context) && current(context)) await reviewAccount(context); return; }
      const value = await api(`/api/payments/${encodeURIComponent(paymentId)}`,{authenticated:true});
      if (!current(context) || pending?.paymentId !== paymentId) return;
      pending = {...pending,...value}; write(pendingKey,pending);
      if (value.status === 'succeeded') { reviewed = null; step = 'success'; pending = null; write(pendingKey,null); clearTimeout(pollTimer); render({animate:true,focus:true}); }
      else if (['canceled','REFUNDED'].includes(value.status) && !reserved(value)) {
        pending = null; write(pendingKey,null); const quote = await fetchOffer(context.storyId);
        if (!current(context) || pending) return;
        offer = quote; error = ''; notice = '';
        if (context.product === 'book' && !selected) { reviewed = null; step = 'choose'; } else freezeReview(context);
        render();
      }
      else if (reserved(value) && value.status === 'canceled') { clearTimeout(pollTimer); render(); }
      else if (value.status === 'REVIEW') { clearTimeout(pollTimer); notice = t('Сервер уточняет статус. Не оплачивайте повторно. Если ожидание затянулось, напишите в поддержку.','The server is reviewing this payment. Please do not pay again. Contact support if it takes too long.'); render(); }
      else { if (manual) notice = t('Подтверждение ещё не пришло. Если вы уже оплатили, подождите немного.','Confirmation has not arrived yet. If you paid, please wait a little.'); schedulePoll(); }
    };
    if (manual) await run(check);
    else { const context = scope(); try { await check(context); } catch { if (current(context)) schedulePoll(); } }
  }
  function action(name) {
    if (name === 'close') return close();
    if (busy) return;
    if (name === 'open-book') {
      if (selected && offer) return openSelectedBook();
      return;
    }
    if (name === 'reload') { dialog.close(); root.classList.remove('magic-checkout-open'); return open(product); }
    if (name === 'catalog') { catalogError = false; render(); return loadCatalog(); }
    if (name === 'continue') { if (product === 'book' && !selected) return; return run(async context => { if (session) await reviewAccount(context); else step = 'email'; }); }
    if (name === 'resend') return sendCode();
    if (name === 'check') return checkPayment();
    if (name === 'abandon' && pending?.paymentId) return run(async context => {
      const paymentId = pending.paymentId;
      const value = await api(`/api/payments/${encodeURIComponent(paymentId)}/abandon`,{method:'POST',authenticated:true});
      if (!current(context) || pending?.paymentId !== paymentId) return;
      clearTimeout(pollTimer); reviewed = null;
      if (reserved(value)) { pending = {...pending,...value}; write(pendingKey,pending); step = 'pending'; }
      else {
        step = value.status === 'succeeded' ? 'success' : 'choose'; pending = null; write(pendingKey,null);
        const quote = await fetchOffer(context.storyId); if (current(context) && !pending) offer = quote;
      }
    });
    if (name === 'logout') return run(async context => {
      await api('/api/auth/logout',{method:'POST',body:{refreshToken:session.refreshToken},authenticated:true});
      if (!current(context)) return;
      setSession(null); context.accountEpoch = accountEpoch; offer = null; reviewed = null; pending = null; write(pendingKey,null); owned = new Set(); account = null; email = ''; step = 'email';
      const quote = await fetchOffer(context.storyId); if (current(context)) offer = quote;
    });
    if (name === 'choose') return run(async context => {
      const quote = await fetchOffer(context.storyId); if (!current(context)) return;
      offer = quote; reviewed = null; step = 'choose'; notice = ''; if (product === 'book') loadCatalog();
    });
    if (name === 'email') { step = name; error = ''; notice = ''; render({animate:true,focus:true}); if (name === 'choose' && product === 'book') loadCatalog(); }
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
