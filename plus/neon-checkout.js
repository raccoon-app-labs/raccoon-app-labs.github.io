import {PRODUCT_IDS,ShopError,validateCatalog,purchaseRequest,confirmationUrl,validateOrder,createClient} from './neon-checkout-core.mjs?v=4bf04424c4e4';

const root=document.documentElement,panel=document.querySelector('#neon-panel');
if(panel)install();
function install(){
  const key='neon-web-checkout-v1',read=()=>{try{return JSON.parse(sessionStorage.getItem(key))||{};}catch{return {};}};
  let stored=read(),session=stored.session,attempt,pending,login=stored.login;const attempts=stored.attempts||{},orders=stored.orders||{};
  const orderKey=(email,id)=>email+'|'+id;
  const save=()=>{if(attempt)attempts[orderKey(attempt.email,attempt.productId)]=attempt;if(pending)orders[orderKey(pending.email,pending.productId)]=pending;try{sessionStorage.setItem(key,JSON.stringify({session,attempts,orders,login}));}catch{}};
  const finishOrder=()=>{delete attempts[orderKey(session?.email,selected)];delete orders[orderKey(session?.email,selected)];attempt=null;pending=null;save();};
  const api=createClient({getSession:()=>session});
  const ru=()=> (window.HanziLocale?.code||root.lang||'en').startsWith('ru');
  const t=(r,e)=>ru()?r:e;
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>new Intl.NumberFormat(ru()?'ru-RU':'en-US',{style:'currency',currency:'RUB',maximumFractionDigits:2}).format(n/100);
  const dialog=document.createElement('dialog');dialog.className='neon-checkout';dialog.dataset.noL10n='';dialog.setAttribute('aria-labelledby','neon-checkout-title');document.body.append(dialog);
  let selected='',channel='',catalog,wallet,step='channel',email='',busy=false,error='',sentAt=0,poll=0,generation=0,returnFocus;
  const errors={channel_unavailable:['Оплата недоступна для выбранной версии игры или региона.','Payments are unavailable for this game version or region.'],network_error:['Не удалось связаться с кассой. Попробуйте ещё раз.','Could not reach checkout. Please try again.'],payments_unavailable:['Оплата для выбранной версии игры или региона сейчас недоступна.','Payments are currently unavailable for this game version or region.'],channel_required:['Выберите, откуда установлена игра.','Choose where you installed the game.'],catalog_unavailable:['Не удалось проверить каталог и цену. Повторите загрузку.','Could not verify the catalogue and price. Please retry.'],invalid_email:['Проверьте адрес почты.','Check your email address.'],invalid_code:['Код неверный или устарел.','The code is incorrect or expired.'],wait_before_resend:['Новый код можно запросить через минуту.','Please wait a minute before requesting a new code.'],mail_unavailable:['Почта временно недоступна. Попробуйте позже.','Email is temporarily unavailable. Try again later.'],mail_limit_reached:['Отправка кодов временно ограничена. Попробуйте позже.','Code delivery is temporarily limited. Try again later.'],too_many_requests:['Слишком много запросов. Подождите минуту.','Too many requests. Please wait a minute.'],sign_in_required:['Войдите ещё раз.','Please sign in again.'],price_changed:['Цена изменилась. Проверьте её и подтвердите заново.','The price changed. Review it and confirm again.'],terms_changed:['Условия обновились. Проверьте их и подтвердите заново.','The terms changed. Review and accept them again.'],bundle_already_ordered:['Этот набор уже куплен или ожидает подтверждения. Повторная покупка не нужна.','This bundle is already purchased or awaiting confirmation. No repeat purchase is needed.'],payment_uncertain:['Сервер не успел ответить. Кнопка «Продолжить» повторно проверит тот же заказ; новый счёт не создаётся.','The server did not respond in time. Continue checks the same order without creating a new invoice.'],accept_terms_required:['Подтвердите условия покупки.','Accept the purchase terms.'],order_unavailable:['Не удалось проверить заказ. Откройте его снова или обратитесь в поддержку.','Could not verify the order. Reopen it or contact support.']};
  const product=()=>catalog?.products.find(p=>p.id===selected);
  const name=p=>p?.[ru()?'ru':'en']||t('Покупка Neon','Neon purchase');
  function fail(e){error=(errors[e.code]||[t('Не удалось выполнить действие. Попробуйте ещё раз.','The action could not be completed. Please retry.')])[ru()?0:1];if(e.status===401&&e.code!=='invalid_code'){session=null;wallet=null;step='email';save();}}
  function fields(){return `<dl class="neon-order-summary"><div><dt>${t('Покупка','Purchase')}</dt><dd>${escape(name(product()))}</dd></div><div><dt>${t('Монеты','Coins')}</dt><dd>${new Intl.NumberFormat(ru()?'ru-RU':'en-US').format(product()?.coins||0)}</dd></div><div><dt>${t('Итого','Total')}</dt><dd>${product()?money(product().price):'—'}</dd></div></dl>`;}
  function primary(label,action,disabled=false){return `<button class="neon-checkout-primary" ${action?`data-action="${action}"`:'type="submit"'} ${busy||disabled?'disabled':''}>${label}</button>`;}
  function content(){
    if(busy&&!catalog)return `<h2 id="neon-checkout-title" tabindex="-1">${t('Проверяем цену…','Checking the price…')}</h2><p>${t('Проверяем цену и доступность покупки.','Checking the price and purchase availability.')}</p>`;
    if(step==='channel')return `<h2 id="neon-checkout-title" tabindex="-1">${t('В какой версии играешь?','Which version do you play?')}</h2><p>${t('Выбери магазин, из которого установлена игра. Покупка появится в том же аккаунте.','Choose the store you installed the game from. Your purchase will appear in the same account.')}</p><form data-form="channel"><label>${t('Версия игры','Game version')}<select name="channel" required><option value="">${t('Выбрать','Choose')}</option><option value="rustore" ${channel==='rustore'?'selected':''}>RuStore</option><option value="google_play" ${channel==='google_play'?'selected':''}>Google Play</option></select></label>${primary(t('Продолжить','Continue'))}</form><a class="neon-checkout-text" href="https://www.rustore.ru/catalog/app/com.enotessa.neoncyberwallkicker" target="_blank" rel="noopener noreferrer">${t('Игра ещё не установлена','Not installed yet')}</a>`;
    if(step==='email')return `<h2 id="neon-checkout-title" tabindex="-1">${t('Твой игровой аккаунт','Your game account')}</h2><p>${t('Укажи ту же почту, с которой входишь в Neon. На неё придёт код входа.','Use the same email you use in Neon. We will send a sign-in code.')}</p>${fields()}<form data-form="email"><label>Email<input name="email" type="email" autocomplete="email" maxlength="254" required value="${escape(email)}"></label>${primary(t('Получить код','Send code'))}</form>`;
    if(step==='code')return `<h2 id="neon-checkout-title" tabindex="-1">${t('Проверь почту','Check your email')}</h2><p>${escape(email)}</p><form data-form="code"><label>${t('Код из письма','Email code')}<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" required></label>${primary(t('Войти','Sign in'))}</form><div class="neon-checkout-links"><button data-action="resend" ${busy?'disabled':''}>${t('Отправить код снова','Resend code')}</button><button data-action="email" ${busy?'disabled':''}>${t('Другая почта','Another email')}</button></div>`;
    if(step==='review')return `<h2 id="neon-checkout-title" tabindex="-1">${t('Всё верно?','Ready to continue?')}</h2><p>${escape(session?.email)} · ${channel==='rustore'?'RuStore':'Google Play'}</p>${fields()}<p>${t('Разовая покупка. Начисление — после подтверждения оплаты.','One-time purchase. Items are credited after payment is confirmed.')}</p><form data-form="buy"><label class="neon-checkout-consent"><input name="terms" type="checkbox" required><span>${t('Принимаю','I accept the')} <a href="${escape(catalog.seller.terms_url)}" target="_blank" rel="noopener noreferrer">${t('условия покупки','purchase terms')}</a> ${t('и ознакомлен(а) с','and have read the')} <a href="/apps/neon-cyber-wall-kicker/shop/privacy/" target="_blank" rel="noopener noreferrer">${t('политикой конфиденциальности','privacy policy')}</a>.</span></label>${primary(error?t('Продолжить','Continue'):t('Перейти к оплате · ','Continue to payment · ')+money(product().price))}</form><button class="neon-checkout-text" data-action="logout" ${busy?'disabled':''}>${t('Другой аккаунт','Another account')}</button>`;
    if(step==='payment')return `<h2 id="neon-checkout-title" tabindex="-1">${t('Оплата в Робокассе','Pay with Robokassa')}</h2><p>${t('Заверши оплату в новой вкладке, затем вернись сюда или в игру.','Complete payment in a new tab, then return here or to the game.')}</p>${fields()}<a class="neon-checkout-primary" href="${escape(confirmationUrl(pending?.checkout_url))}" target="_blank" rel="noopener noreferrer">${t('Открыть Робокассу','Open Robokassa')} ↗</a><p class="neon-checkout-status" role="status">${t('Ожидаем подтверждение оплаты','Waiting for payment confirmation')}</p><button class="neon-checkout-text" data-action="check" ${busy?'disabled':''}>${t('Проверить оплату','Check payment')}</button><p class="neon-checkout-caption">${t('Заказ','Order')}: ${escape(pending?.id)}</p>`;
    if(step==='owned'||step==='success')return `<p class="neon-checkout-seal" aria-hidden="true">✓</p><h2 id="neon-checkout-title" tabindex="-1">${t(step==='owned'?'Набор уже твой':'Покупка подтверждена',step==='owned'?'You already own this bundle':'Purchase confirmed')}</h2><p>${t('Открой Neon и войди с той же почтой. Купленные предметы находятся в разделе «Стиль».','Open Neon and sign in with the same email. Purchased items are in Style.')}</p><p>${escape(session?.email)}</p>${primary(t('Готово','Done'),'close')}`;
    if(step==='issue')return `<h2 id="neon-checkout-title" tabindex="-1">${t('Проверим заказ','Order review')}</h2><p>${t('Напиши в поддержку и укажи номер заказа.','Contact support with the order number.')}</p><p>${escape(pending?.id)}</p><a href="mailto:raccoon.app.labs@gmail.com">raccoon.app.labs@gmail.com</a>`;
    return `<h2 id="neon-checkout-title" tabindex="-1">${t('Не удалось открыть кассу','Could not open checkout')}</h2>${primary(t('Повторить','Retry'),'retry')}`;
  }
  function render(focus=false){
    dialog.innerHTML=`<div class="neon-checkout-inner"><button class="neon-checkout-close" data-action="close" aria-label="${t('Закрыть','Close')}">×</button><p class="neon-checkout-eyebrow">NEON · ${t('МАГАЗИН','SHOP')}</p>${content()}${error?`<p class="neon-checkout-error" role="alert">${escape(error)}</p>`:''}<p class="neon-checkout-caption">${t('Банковские данные вводятся только на странице Робокассы.','Payment details are entered only on Robokassa.')}</p></div>`;
    if(focus)dialog.querySelector('input,select,#neon-checkout-title')?.focus({preventScroll:true});
  }
  async function loadCatalog(){const turn=generation,data=validateCatalog(await api('/v1/catalog?channel='+encodeURIComponent(channel||'rustore')));if(turn!==generation)throw new ShopError('cancelled');catalog=data;if(!product())throw new ShopError('unknown_product');}
  async function account(){const turn=generation,data=await api('/v1/wallet',{authenticated:true});if(turn!==generation)throw new ShopError('cancelled');wallet=data;attempt=attempts[orderKey(session?.email,selected)];pending=orders[orderKey(session?.email,selected)];if(product().once&&wallet.owned_products?.includes(selected)){step='owned';return;}if(pending&&confirmationUrl(pending.checkout_url)){step='payment';await check();schedulePoll();return;}const held=wallet.pending_orders?.find(p=>p.product_id===selected);if(held&&!pending){error=product().once?t('Для набора уже есть ожидающий заказ. Продолжение откроет существующий счёт.','This bundle already has a pending order. Continue opens the existing invoice.'):t('Для этих монет уже есть другой ожидающий заказ. Новый счёт будет отдельной покупкой; проверь прежний заказ в игре.','There is another pending order for these coins. A new invoice is a separate purchase; check the earlier order in the game.');}step='review';}
  function close(){generation++;clearTimeout(poll);dialog.close();root.classList.remove('neon-checkout-open');returnFocus?.focus({preventScroll:true});}
  async function open(id,button){
    if(!PRODUCT_IDS.includes(id)||panel.dataset.neonCurrency==='USD')return;
    selected=id;returnFocus=button;attempt=attempts[orderKey(session?.email,id)];pending=orders[orderKey(session?.email,id)];channel=attempt?.productId===id?attempt.channel:login?.productId===id?login.channel:'';catalog=null;wallet=null;error='';busy=true;step='channel';generation++;const turn=generation;
    dialog.showModal();root.classList.add('neon-checkout-open');render(true);
    try{await loadCatalog();if(turn!==generation)return;if(channel){if(!catalog.enabled||!catalog.channel_allowed||catalog.test)throw new ShopError('payments_unavailable');if(session?.token){if(pending?.productId===id&&confirmationUrl(pending.checkout_url)){step='payment';await check();schedulePoll();}else await account();}else if(login?.productId===id&&Date.now()-login.sentAt<600000){email=login.email;sentAt=login.sentAt;step='code';}else step='email';}}
    catch(e){if(turn!==generation)return;fail(e);if(!catalog)step='error';}
    finally{if(turn===generation){busy=false;render(true);}}
  }
  async function check(){
    const current=pending,turn=generation;if(!current)return;
    const data=await api('/v1/orders/'+encodeURIComponent(current.id),{authenticated:true});
    if(current!==pending||turn!==generation)return;
    if(Number(data.amount)!==current.amount||data.product_id!==current.productId)throw new ShopError('order_unavailable');
    if(data.state==='paid'){finishOrder();clearTimeout(poll);step='success';}
    else if(['cancelled','refunded','review'].includes(data.state)){clearTimeout(poll);step='issue';error=t('Заказ требует проверки. Не оплачивай его повторно; обратись в поддержку: raccoon.app.labs@gmail.com.','This order requires review. Do not pay again; contact raccoon.app.labs@gmail.com.');}
  }
  function schedulePoll(){clearTimeout(poll);if(dialog.open&&step==='payment'&&!document.hidden)poll=setTimeout(async()=>{try{const before=step;await check();if(dialog.open&&(step!==before||error))render();}catch(e){if(dialog.open){fail(e);render();}}if(step==='payment'&&!error)schedulePoll();},5000);}
  async function run(action,form){
    if(action==='close'){close();return;}if(busy)return;
    if(action==='email'&&!form){step='email';error='';render(true);return;}
    busy=true;error='';const turn=generation;
    const values=form?new FormData(form):null;
    // Keep user-entered values before replacing the form during a request.
    const submittedEmail=values?.get('email'),code=values?.get('code'),accepted=values?.get('terms')==='on';
    if(submittedEmail!==null&&submittedEmail!==undefined)email=String(submittedEmail).trim().toLowerCase();
    if(action==='channel')channel=String(values.get('channel'));
    render();
    try{
      if(action==='retry'){await loadCatalog();step='channel';}
      if(action==='channel'){if(!['rustore','google_play'].includes(channel))throw new ShopError('channel_required');await loadCatalog();if(!catalog.enabled||!catalog.channel_allowed||catalog.test)throw new ShopError('payments_unavailable');if(session?.token)await account();else step='email';}
      if(action==='email'||action==='resend'){if(action==='resend'&&Date.now()-sentAt<60000)throw new ShopError('wait_before_resend');await api('/v1/auth/request',{body:{email}});if(turn!==generation)return;sentAt=Date.now();login={email,sentAt,channel,productId:selected};save();step='code';}
      if(action==='code'){const data=await api('/v1/auth/verify',{body:{email,code:String(code)}});if(typeof data.token!=='string'||data.token.length<20||data.token.length>150)throw new ShopError('sign_in_required');if(turn!==generation)return;session={token:data.token,email};login=null;save();await account();}
      if(action==='logout'){await api('/v1/auth/logout',{body:{},authenticated:true});session=null;wallet=null;save();step='email';}
      if(action==='buy'){
        const old=product().price,terms=catalog.seller.terms_version;await loadCatalog();
        if(product().price!==old)throw new ShopError('price_changed');if(catalog.seller.terms_version!==terms)throw new ShopError('terms_changed');
        if(!attempt||attempt.productId!==selected||attempt.channel!==channel||attempt.email!==session?.email)attempt={productId:selected,channel,email:session.email,requestKey:crypto.randomUUID()};save();
        const body=purchaseRequest(catalog,selected,channel,accepted,attempt.requestKey,wallet?.owned_products||[]);
        const data=validateOrder(await api('/v1/orders',{body,authenticated:true}),product().price);
        if(turn!==generation)return;
        if(data.state==='paid'){finishOrder();step='success';}
        else if(data.state==='pending'){pending={...data,productId:selected,email:session.email};step='payment';schedulePoll();}
        else throw new ShopError('order_unavailable');save();
      }
      if(action==='check'){await check();if(step==='payment')schedulePoll();}
    }catch(e){if(turn===generation)fail(e);}
    finally{if(turn===generation&&dialog.open){busy=false;render(true);}}
  }
  dialog.addEventListener('submit',e=>{e.preventDefault();run(e.target.dataset.form,e.target);});
  dialog.addEventListener('click',e=>{const action=e.target.closest('[data-action]');if(action)run(action.dataset.action);});
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  document.addEventListener('click',e=>{const button=e.target.closest('[data-neon-buy]');if(button){e.preventDefault();open(button.dataset.neonBuy,button);}});
  function shopCopy(){
    const set=(selector,r,e)=>{const n=panel.querySelector(selector);if(n){n.dataset.noL10n='';if(n.textContent!==t(r,e))n.textContent=t(r,e);}};
    set('.availability p','Покупки в игровом аккаунте. Войди с той же почтой, что и в Neon. Перед оплатой касса проверит актуальную цену и доступность для выбранной версии игры.','Purchases for your game account. Use the same email as in Neon. Checkout verifies the current price and availability for your game version.');
    set('#neon-coins>.note','Монеты — внутриигровая единица. Их нельзя вывести в деньги, перевести другому игроку или использовать вне игры. Пакеты монет можно приобретать повторно.','Coins are an in-game unit. They cannot be cashed out, transferred to another player or used outside the game. Coin packs can be purchased repeatedly.');
    set('#neon-how-to-buy .eyebrow','От выбора до награды','From choice to reward');
    set('#neon-how-to-buy .steps li:first-child h3','Выбери покупку','Choose your purchase');
    set('#neon-how-to-buy .steps li:first-child p','Выбери монеты или набор. Укажи версию игры и войди с той же почтой по коду из письма.','Choose coins or a bundle. Select your game version and sign in with the same email using the code sent to your inbox.');
    set('#neon-how-to-buy .steps li:nth-child(2) p','Проверь состав и итоговую цену. Банковские данные вводятся на защищённой странице Робокассы.','Check the contents and total price. Enter payment details on the secure Robokassa page.');
    set('#neon-how-to-buy>.note','Покупки доступны для версии RuStore, а для Google Play — в России после серверной проверки региона. В игре используй ту же почту, что и при покупке на сайте.','Purchases are available for RuStore, and for Google Play in Russia after a server region check. Use the same email in the game as on this website.');
  }
  function buttons(){for(const b of panel.querySelectorAll('[data-neon-buy]')){const usd=panel.dataset.neonCurrency==='USD';b.disabled=usd;b.textContent=usd?t('Скоро в USD','Coming soon in USD'):t('Купить','Buy');const title=b.closest('.bundle,.coin-card')?.querySelector('h3')?.textContent.trim();b.setAttribute('aria-label',b.textContent+(title?': '+title:''));}}
  new MutationObserver(buttons).observe(panel,{attributes:true,attributeFilter:['data-neon-currency']});
  addEventListener('hanzi:languagechange',()=>{shopCopy();buttons();if(dialog.open)render();});
  addEventListener('raccoon:appchange',()=>{if(root.dataset.app!=='neon'&&dialog.open)close();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(poll);else schedulePoll();});
  addEventListener('pagehide',()=>clearTimeout(poll));shopCopy();buttons();
}
