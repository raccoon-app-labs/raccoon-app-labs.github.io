/* The selected cover leaves its shelf and opens into a real, keyboard-accessible modal book. */
export function installBookPortal({host, translate:t, escape, price, onContinue, resetTilt}) {
  const portal = document.createElement('dialog');
  portal.className = 'magic-book-portal'; portal.dataset.noL10n = '';
  portal.setAttribute('aria-labelledby', 'magic-book-title'); document.body.append(portal);
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => motion.matches || document.documentElement.dataset.motion === 'reduced';
  let source, sourceCover, flight, animations = [], revision = 0, closing = false;
  function animate(element, frames, options) {
    const animation = element.animate(frames, options); animations.push(animation);
    return animation.finished.catch(() => {});
  }
  function stop() {
    revision++;
    for (const animation of animations) animation.cancel();
    animations = []; flight?.remove(); flight = null;
    if (sourceCover) sourceCover.style.visibility = '';
  }
  function finish(restoreFocus) {
    stop(); portal.close(); portal.replaceChildren(); closing = false;
    if (restoreFocus && host.open && source?.isConnected) source.focus({preventScroll:true});
  }
  async function close({immediate = false, restoreFocus = true} = {}) {
    if (!portal.open || closing) return;
    closing = true; stop();
    if (!immediate && !reduced()) {
      const cover = portal.querySelector('.magic-portal-cover');
      cover.hidden = false;
      await animate(cover, [{transform:'rotateY(-178deg)',opacity:0},{transform:'rotateY(-150deg)',opacity:1,offset:.12},{transform:'rotateY(0deg)',opacity:1}], {duration:330,easing:'ease-in-out',fill:'both'});
      await animate(portal.querySelector('.magic-open-book'), [
        {opacity:1, transform:'translateY(0) scale(1)'},
        {opacity:0, transform:'translateY(24px) scale(.94)'}
      ], {duration:150, easing:'ease-in', fill:'both'});
    }
    finish(restoreFocus);
  }
  async function open({story, amount, available, source:button}) {
    if (portal.open) return;
    delete portal.dataset.bookReady;
    resetTilt(); source = button; sourceCover = source.querySelector('.magic-book-art');
    const origin = sourceCover?.getBoundingClientRect();
    const art = story.cover ? `<img src="${escape(story.cover)}" alt="" decoding="async">` : `<span class="magic-portal-fallback">${escape(story.emoji || '✦')}</span>`;
    const title = escape(story.title);
    portal.innerHTML = `<div class="magic-book-stage"><button class="magic-book-dismiss" aria-label="${t('Вернуться к книгам','Back to the books')}">×</button><p class="magic-book-invitation">${t('Ваша следующая любимая сказка','Your next favourite story')}</p><article class="magic-open-book"><section class="magic-book-leaf magic-book-leaf-art" aria-label="${t('Выбранная книга','Selected book')}"><div class="magic-page-ornament" aria-hidden="true">✧ ─── ✧</div><div class="magic-portal-illustration">${art}</div><div class="magic-portal-story"><p>${escape(story.category || t('Маленькое большое чудо','A little great wonder'))}${story.age ? ` · ${escape(story.age)}` : ''}</p><h1 id="magic-book-title" tabindex="-1">${title}</h1><span>${t('Ещё одна история в вашей семейной библиотеке','Another story for your family library')}</span></div><span class="magic-page-number" aria-hidden="true">01</span></section><section class="magic-book-leaf magic-book-leaf-payment"><div class="magic-book-ribbon" aria-hidden="true">♡</div><p class="magic-book-chapter">${t('ГЛАВА ПЕРВАЯ · СКАЗКА СТАНОВИТСЯ ВАШЕЙ','CHAPTER ONE · MAKE IT YOURS')}</p><h2>${t('Заберём домой?','Shall we take it home?')}</h2><p class="magic-book-promise">${t('Книга останется с вами навсегда. Для всех ваших «почитай ещё».','Keep this book forever. For every “one more story”.')}</p><div class="magic-book-price"><strong>${price(amount)}</strong><span>${t('Один платёж<br>Без автопродления','One payment<br>No automatic renewal')}</span></div><fieldset class="magic-book-payments"><legend>${t('Выберите способ оплаты','Choose a payment method')}</legend><label class="magic-book-payment"><input type="radio" name="magic-book-provider" value="robokassa" checked><span class="magic-payment-monogram" aria-hidden="true">R</span><span><strong>Robokassa</strong><small>${t('Для России · RUB','For Russia · RUB')}</small></span><span class="magic-payment-tick" aria-hidden="true">✓</span></label><label class="magic-book-payment magic-book-payment-soon"><input type="radio" name="magic-book-provider" value="lava" disabled><span class="magic-payment-monogram" aria-hidden="true">L</span><span><strong>Lava.top</strong><small>${t('Для всех','For everyone')}</small></span><span class="magic-book-soon">${t('Скоро','Soon')}</span></label></fieldset>${!available ? `<p class="magic-book-unavailable" role="status">${t('Покупки временно недоступны. Попробуйте позже.','Purchases are temporarily unavailable. Please try later.')}</p>` : ''}<button class="magic-book-next" ${available ? '' : 'disabled'}><span>${t('Продолжить с Robokassa','Continue with Robokassa')}</span><span aria-hidden="true">↗</span></button><p class="magic-book-footnote">${t('Дальше — вход по почте и подтверждение покупки. Сейчас ничего не списывается.','Next: sign in by email and confirm your purchase. Nothing is charged now.')}</p><span class="magic-page-number" aria-hidden="true">02</span></section><div class="magic-book-spine" aria-hidden="true"></div><div class="magic-portal-cover" aria-hidden="true"><div class="magic-portal-cover-front">${art}<span>${title}</span></div><div class="magic-portal-cover-back"><span>✦</span></div></div></article><p class="magic-book-return">${t('Закройте книгу, чтобы выбрать другую','Close this book to choose another')}</p><div class="magic-book-sparks" aria-hidden="true">${Array.from({length:9},(_,i)=>`<i class="magic-book-spark magic-book-spark-${i}">✧</i>`).join('')}</div></div>`;
    portal.querySelector('.magic-book-dismiss').addEventListener('click', () => close());
    portal.querySelector('.magic-book-next').addEventListener('click', () => {
      if (!available || closing) return;
      close({immediate:true, restoreFocus:false}); onContinue();
    });
    portal.showModal(); portal.querySelector('#magic-book-title').focus({preventScroll:true});
    const book = portal.querySelector('.magic-open-book');
    const cover = portal.querySelector('.magic-portal-cover');
    if (reduced()) { cover.hidden = true; portal.dataset.bookReady = 'true'; return; }
    const current = ++revision;
    const closedTransform = matchMedia('(max-width:540px)').matches ? 'translateX(0) rotateY(-5deg) scale(.94)' : 'translateX(-25%) rotateY(-8deg) scale(.94)';
    book.style.transform = closedTransform;
    const landing = cover.getBoundingClientRect();
    if (origin?.width && origin.height && landing.width) {
      flight = document.createElement('div'); flight.className = 'magic-book-flight'; flight.innerHTML = art; portal.append(flight);
      Object.assign(flight.style, {left:`${landing.left}px`,top:`${landing.top}px`,width:`${landing.width}px`,height:`${landing.height}px`});
      if (sourceCover) sourceCover.style.visibility = 'hidden';
      book.style.visibility = 'hidden';
      await animate(flight, [
        {transform:`translate(${origin.left-landing.left}px,${origin.top-landing.top}px) scale(${origin.width/landing.width},${origin.height/landing.height}) rotate(-3deg)`,opacity:1},
        {transform:'translate(0,0) scale(1) rotate(0)',opacity:1}
      ], {duration:540,easing:'cubic-bezier(.22,.8,.2,1)',fill:'both'});
      if (current !== revision || !portal.open) return;
      flight.remove(); flight = null; book.style.visibility = '';
    }
    const opening = animate(cover, [{transform:'rotateY(0deg)',opacity:1},{transform:'rotateY(-178deg)',opacity:1,offset:.82},{transform:'rotateY(-178deg)',opacity:0}], {duration:850,easing:'cubic-bezier(.25,.65,.2,1)',fill:'both'});
    animate(book, [{transform:closedTransform},{transform:'translateX(0) rotateY(0) scale(1)'}], {duration:850,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'});
    animate(portal.querySelector('.magic-book-leaf-art'),[{opacity:0},{opacity:1}],{duration:430,delay:180,easing:'ease-out',fill:'both'});
    const reveal = [...portal.querySelectorAll('.magic-book-leaf-payment > :not(.magic-page-number),.magic-portal-story,.magic-page-ornament')].map((el,i) => animate(el,[{opacity:0,transform:'translateY(14px)'},{opacity:1,transform:'translateY(0)'}],{duration:460,delay:260+i*45,easing:'ease-out',fill:'both'}));
    portal.querySelectorAll('.magic-book-spark').forEach((el,i) => animate(el,[{opacity:0,transform:'translateY(35px) scale(.3)'},{opacity:.8,offset:.3},{opacity:0,transform:`translateY(${-30-i*7}px) rotate(${i*13}deg) scale(1.1)`}],{duration:1400,delay:300+i*60,easing:'ease-out',fill:'both'}));
    await Promise.all([opening, ...reveal]);
    if (current === revision) {
      cover.hidden = true; book.style.transform = '';
      portal.dataset.bookReady = 'true';
      if (document.activeElement === portal || document.activeElement === document.body) portal.querySelector('#magic-book-title').focus({preventScroll:true});
    }
  }
  portal.addEventListener('cancel', event => { event.preventDefault(); close(); });
  portal.addEventListener('click', event => { if (event.target === portal || event.target.classList.contains('magic-book-stage')) close(); });
  function settleReducedMotion() {
    if (!portal.open || closing || !reduced()) return;
    stop();
    const book = portal.querySelector('.magic-open-book');
    book.style.visibility = ''; book.style.transform = '';
    portal.querySelector('.magic-portal-cover').hidden = true;
    portal.dataset.bookReady = 'true';
  }
  motion.addEventListener('change', settleReducedMotion);
  new MutationObserver(settleReducedMotion).observe(document.documentElement, {attributes:true,attributeFilter:['data-motion']});
  host.addEventListener('close', () => close({immediate:true,restoreFocus:false}));
  addEventListener('pagehide', () => close({immediate:true,restoreFocus:false}));
  return {open, close};
}
