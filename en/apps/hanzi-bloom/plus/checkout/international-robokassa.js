'use strict';
(() => {
  const el=id=>document.getElementById(id);
  const STORAGE='hanzi-plus-international-robokassa-v1';
  const APPS=['com.enotessa.hanzi','com.enotessa.chinesekeys'];
  const sourceApp=new URLSearchParams(location.search).get('app')==='keys'?APPS[1]:APPS[0];
  document.documentElement.dataset.app=sourceApp===APPS[1]?'keys':'bloom';
  const app=sourceApp===APPS[1]?'keys':'bloom';
  if(el('checkout-store-link'))el('checkout-store-link').href='/plus/?app='+app+'&region=ru';
  if(el('checkout-included-link'))el('checkout-included-link').href='/plus/?app='+app+'&region=ru#plus';
  if(app==='keys') {
    if(el('checkout-app-icon'))el('checkout-app-icon').src='/plus/assets/keys-icon-128.webp';
    const accent=document.createElement('em');accent.textContent='Big discoveries.';
    el('product-title').replaceChildren(document.createTextNode('Small pieces.'),document.createElement('br'),accent);
    const panda=document.querySelector('.garden-art img');
    panda.sizes='(max-width:760px) 160px, 390px';panda.width=960;panda.height=640;
    panda.srcset='/plus/assets/keys-panda-384.webp 384w, /plus/assets/keys-panda-640.webp 640w, /plus/assets/keys-panda-960.webp 960w';
    panda.src='/plus/assets/keys-panda-960.webp';
  }
  let api=null;
  try {
    const url=new URL(document.querySelector('meta[name="hanzi-robokassa-api"]').content);
    if(url.protocol==='https:'&&url.hostname==='api1.hanzibloom.ru'&&['','443'].includes(url.port)
      &&!url.username&&!url.password&&!url.search&&!url.hash&&['/international','/international/'].includes(url.pathname))
      api=url.origin+'/international';
  }catch{/* Missing or incorrect gateway stays closed; never fall back to the RU root. */}
  const termsVersion=document.querySelector('meta[name="hanzi-terms-version"]').content;
  const invoicePattern=/^[1-9]\d{0,9}$/;
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const uncertain='We could not confirm the result. Check your Plus again later; do not pay twice.';
  let state={},catalog=null,challenge=null,busy=false,ready=false,resendAt=0,revision=0,recoverWhenIdle=false;
  let selectedPlan=new URLSearchParams(location.search).get('plan')==='rub_year'?'rub_year':'rub_month';
  let returnInvoice=new URLSearchParams(location.search).get('invoiceId');
  class Failure extends Error{constructor(status){super('Request failed');this.status=status;}}
  function save(){try{sessionStorage.setItem(STORAGE,JSON.stringify(state));}catch{throw new Failure(507);}}
  function message(text,error=false){el('message').textContent=text;el('message').classList.toggle('error',error);}
  const pending=()=>state.order&&!['paid','failed','cancelled','closed'].includes(state.order.status);
  function controls(){
    for(const button of document.querySelectorAll('button:not([data-language-control])'))button.disabled=busy;
    el('send-code').disabled=busy||!ready;
    el('pay').disabled=busy||!catalog?.checkoutEnabled||!el('terms').checked||!!state.requestId||!!pending();
    el('continue-payment').disabled=busy||!catalog?.checkoutEnabled||!!state.order?.fulfillmentPending;
    el('retry-order').disabled=busy;
    for(const radio of document.querySelectorAll('[name=plan]'))radio.disabled=busy||!!state.requestId||!!pending();
    el('resend').disabled=busy||Date.now()<resendAt;
  }
  function closePayments(keepAccount=false){
    catalog=null;if(!keepAccount)ready=false;
    el('continue-payment').hidden=true;el('continue-payment').removeAttribute('href');
    el('availability').textContent='Payments are temporarily unavailable. Please try again later.';controls();
  }
  function view(stage){
    for(const name of ['email','code','account'])el(name==='account'?name:name+'-form').hidden=name!==stage;
    const at={email:0,code:1,account:2}[stage];
    ['email','code','plus'].forEach((name,i)=>{const item=el('step-'+name);item.classList.toggle('done',i<at);
      if(i===at)item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');});
    el('step-title').textContent={email:'Where should Plus grow?',code:'Your code is on its way',account:'Welcome home'}[stage];
    el('step-description').textContent={email:'Use the same email as your Russian account in the apps.',
      code:'Enter the six digits from your latest email.',account:'This email connects your Plus in both apps.'}[stage];
    if(stage==='account')el('account-email').textContent=state.email;
    else{el('plus-result').hidden=true;el('order-panel').hidden=true;}
  }
  async function run(action){
    if(busy)return;busy=true;controls();message('');
    try{await action();}catch(error){
      if(!error.status||error.status>=500)closePayments();
      if(error.status===401&&state.token){state={};try{sessionStorage.removeItem(STORAGE);}catch{}
        view('email');paintPlan();message('Your session expired. Sign in again with an email code.',true);}
      else message(({401:'That code is incorrect or expired. Use the code from your latest email.',
        409:'Prices or terms changed. Review them and confirm again.',429:'Too many attempts. Please wait a little before trying again.',
        507:'Allow session storage in this browser before continuing.',400:'Check your email address or six-digit code.',
        404:'Order not found. Check your account email. If you were charged, contact support.'})[error.status]||uncertain,true);
    }finally{busy=false;controls();if(recoverWhenIdle){recoverWhenIdle=false;recoverAvailability();}}
  }
  async function request(route,data,token){
    if(!api)throw new Failure(503);
    const headers={Accept:'application/json','X-Hanzi-Region':'ru'};
    if(token)headers['X-Hanzi-Session']=token;
    if(data!==undefined)headers['Content-Type']='application/json';
    const response=await fetch(api+route,{method:data===undefined?'GET':'POST',headers,
      body:data===undefined?undefined:JSON.stringify(data),credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw new Failure(response.status);
    const result=await response.json();if(!result||typeof result!=='object')throw new Failure(503);return result;
  }
  async function checkService(){
    try{
      if(!navigator.onLine||navigator.serviceWorker?.controller)throw new Failure(503);
      const health=await request('/health/ready',undefined,null);
      if(health.status!=='ok'||health.environment!=='production'||health.homeRegion!=='ru'
        ||health.service!=='international_robokassa'||health.provider!=='robokassa'||health.currency!=='RUB')throw new Failure(503);
      ready=true;return health;
    }catch{closePayments();throw new Failure(503);}
  }
  async function call(route,data,token=state.token){
    // Even a health 401 must not erase a valid purchase account session.
    if(route!=='/health/ready'&&(token||data!==undefined))await checkService();
    return request(route,data,token);
  }
  function validCatalog(config){return config.environment==='production'&&config.homeRegion==='ru'
    &&typeof config.checkoutEnabled==='boolean'&&config.autoRenew===false&&config.termsVersion===termsVersion
    &&APPS.every(id=>config.sharedApps?.includes(id))&&['rub_month','rub_year'].every((id,i)=>
      config.plans?.some(plan=>plan.id===id&&plan.currency==='RUB'&&plan.months===(i?12:1)
        &&Number.isSafeInteger(plan.amountMinor)&&plan.amountMinor>0));}
  function plan(config,id){return config?.plans?.find(value=>value.id===id);}
  function sameQuote(left,right){return left&&right&&left.id===right.id&&left.currency===right.currency
    &&left.amountMinor===right.amountMinor&&left.months===right.months;}
  function amountText(amount){return new Intl.NumberFormat(document.documentElement.lang||'en',{style:'currency',currency:'RUB',currencyDisplay:'narrowSymbol',
    minimumFractionDigits:amount%100?2:0,maximumFractionDigits:2}).format(amount/100);}
  function acceptedOrder(order){return !state.requestId||(order.amountMinor===state.requestAmountMinor
    &&order.planId===state.requestPlan&&state.requestTerms===termsVersion);}
  function paintPlan(){
    const id=state.requestPlan||state.order?.planId||selectedPlan;
    for(const radio of document.querySelectorAll('[name=plan]'))radio.checked=radio.value===id;
    for(const value of catalog?.plans||[]){const target=document.querySelector('[data-plan-price="'+value.id+'"]');
      if(target)target.textContent=amountText(value.amountMinor);}
    el('pay-amount').textContent=document.querySelector('[data-plan-price="'+id+'"]')?.textContent||'';
  }
  async function availability(requirePurchase=false){
    const health=await checkService();
    try{
      const fresh=await call('/v1/web/robokassa/catalog');if(!validCatalog(fresh))throw new Failure(503);
      catalog={...fresh,checkoutEnabled:fresh.checkoutEnabled&&health.checkoutEnabled===true};paintPlan();
      el('availability').textContent=catalog.checkoutEnabled?'RUB purchase account · Robokassa'
        :'Purchases are not open yet. You can check existing Plus access below.';
      if(requirePurchase&&!catalog.checkoutEnabled)throw new Failure(503);return catalog;
    }catch(error){closePayments(true);if(requirePurchase)throw error;return null;}
  }
  function paymentUrl(order){
    if(order.environment!=='production'||order.status!=='pending'||order.fulfillmentPending||order.currency!=='RUB'
      ||!invoicePattern.test(order.invoiceId||'')||Number(order.invoiceId)>2147483647
      ||!Number.isSafeInteger(order.amountMinor)||order.amountMinor<=0)throw new Failure(503);
    const url=new URL(order.checkoutUrl);
    if(url.protocol!=='https:'||url.hostname!=='api1.hanzibloom.ru'||!['','443'].includes(url.port)
      ||url.username||url.password||url.hash||!['/payments/robokassa/start','/international/payments/robokassa/start'].includes(url.pathname)
      ||url.searchParams.get('invoice')!==order.invoiceId||!/^[0-9a-f]{64}$/.test(url.searchParams.get('token')||'')
      ||[...url.searchParams.keys()].length!==2)throw new Failure(503);
    return url.href;
  }
  function orderView(order){
    if(order.environment!=='production'||!['creating','pending','paid','failed','cancelled','closed'].includes(order.status))throw new Failure(503);
    state.order=order;save();el('order-id').textContent=order.invoiceId?'№ '+order.invoiceId
      +(order.currency==='RUB'&&Number.isSafeInteger(order.amountMinor)?' · '+amountText(order.amountMinor):''):'';
    el('purchase-panel').hidden=true;el('order-panel').hidden=false;el('continue-payment').hidden=true;
    el('continue-payment').removeAttribute('href');el('retry-order').hidden=order.status!=='creating';
    el('new-order').hidden=!['paid','failed','cancelled','closed'].includes(order.status);
    el('order-message').textContent=({creating:'Checking your order. Do not pay again. Contact support if the wait continues.',
      pending:'Your order is awaiting payment. If you already paid, tap “Check my Plus” after a short wait.',
      paid:'Payment confirmed by the server. Checking your account access.',failed:'This order was not paid. You can make a new purchase.'})[order.status]
      ||'Checking your order status.';
    if(order.fulfillmentPending)el('order-message').textContent='Checking your order. Do not pay again. Contact support if the wait continues.';
    else if(order.status==='pending'&&!acceptedOrder(order)){
      el('terms').checked=false;el('order-message').textContent='Prices or terms changed. Review them and confirm again.';
    }else if(order.status==='pending'&&order.checkoutUrl){paymentUrl(order);el('continue-payment').hidden=!catalog?.checkoutEnabled;}
    paintPlan();
  }
  function expiryDescription(){const timestamp=Number(el('plus-description').dataset.expiresAt);if(timestamp)
    el('plus-description').textContent='Until '+new Date(timestamp*1000).toLocaleDateString(document.documentElement.lang||'en-GB')
      +'. Open Hanzi Bloom or Hanzi Keys, sign in to your Russian account with this email and check your Plus.';}
  async function refresh(){
    if(state.requestId){
      try{orderView(await call('/v1/web/robokassa/lookup',{idempotencyKey:state.requestId,pricingVersion:state.requestPricingVersion}));}
      catch(error){if(error.status!==404)throw error;orderView({environment:'production',status:'creating'});}
    }else{const invoice=state.order?.invoiceId||returnInvoice;if(invoicePattern.test(invoice||''))
      orderView(await call('/v1/web/robokassa/status',{invoiceId:invoice}));}
    const plus=await call('/v1/plus');if(plus.environment!=='production')throw new Failure(503);
    const active=plus.active===true&&plus.reviewRequired===false&&Number.isFinite(plus.expiresAt)&&plus.expiresAt*1000>Date.now();
    if(!state.requestId&&(!state.order||state.order.status==='creating')&&plus.pendingOrder)orderView(plus.pendingOrder);
    else if(plus.fulfillmentPending===true&&!state.order)orderView({environment:'production',status:'creating',fulfillmentPending:true});
    el('plus-result').hidden=false;
    el('plus-heading').textContent=active?'Your Plus is in bloom!':plus.reviewRequired?'Support needs to check this payment':'Plus is not active yet';
    el('plus-description').dataset.expiresAt=active?String(plus.expiresAt):'';
    el('plus-description').textContent=plus.reviewRequired?'Contact raccoon.app.labs@gmail.com with your order number.'
      :'Paid access appears after the payment is confirmed. Your learning progress stays with you.';expiryDescription();
    if(plus.reviewRequired){el('purchase-panel').hidden=true;el('continue-payment').hidden=true;el('new-order').hidden=true;el('retry-order').hidden=true;}
    else if(!state.order&&!state.requestId)el('purchase-panel').hidden=false;
    message('Account access checked.');
  }
  async function restoreAccount(){const account=await call('/v1/me');if(account.homeRegion!=='ru')throw new Failure(503);
    state.email=account.email;save();view('account');await refresh();}
  async function continuePayment(){
    const at=revision,invoice=state.order?.invoiceId;const old=state.order;
    const fresh=await availability(true);if(at!==revision||document.hidden)return;
    let order;if(state.requestId)order=await call('/v1/web/robokassa/lookup',{idempotencyKey:state.requestId,pricingVersion:state.requestPricingVersion});
    else if(invoicePattern.test(invoice||''))order=await call('/v1/web/robokassa/status',{invoiceId:invoice});else throw new Failure(404);
    if(order.status==='pending'&&(order.invoiceId!==invoice||order.amountMinor!==old.amountMinor||order.currency!=='RUB'))throw new Failure(503);
    orderView(order);if(at!==revision||document.hidden)return;
    if(order.status==='pending'&&!acceptedOrder(order))throw new Failure(409);
    if(order.status==='pending'&&!el('continue-payment').hidden){
      const current=plan(fresh,order.planId||state.requestPlan);
      if(!current||current.amountMinor!==order.amountMinor){el('terms').checked=false;throw new Failure(409);}
      location.assign(paymentUrl(order));
    }else if(order.status==='paid')await refresh();
  }
  async function purchase(){
    if(state.requestId||pending()){await refresh();return;}
    if(!catalog?.checkoutEnabled||!el('terms').checked)return;
    const at=revision,id=selectedPlan,accepted=plan(catalog,id),acceptedTerms=catalog.termsVersion;
    const fresh=await availability(true);if(at!==revision||document.hidden)return;
    const quote=plan(fresh,id);
    if(!sameQuote(accepted,quote)||acceptedTerms!==fresh.termsVersion){el('terms').checked=false;throw new Failure(409);}
    state.requestId=crypto.randomUUID();state.requestPlan=id;state.requestTerms=fresh.termsVersion;
    state.requestPricingVersion=fresh.pricingVersion;state.requestAmountMinor=quote.amountMinor;
    save();orderView({environment:'production',status:'creating'});
    const order=await call('/v1/web/robokassa/orders',{planId:id,idempotencyKey:state.requestId,applicationId:sourceApp,
      acceptedTerms:true,termsVersion:state.requestTerms,pricingVersion:state.requestPricingVersion,
      quotedAmountMinor:state.requestAmountMinor,currency:'RUB'});
    if(order.status==='pending'&&order.amountMinor!==state.requestAmountMinor)throw new Failure(503);
    orderView(order);if(at===revision&&!document.hidden&&order.status==='pending'&&!el('continue-payment').hidden)await continuePayment();
  }
  function recoverAvailability(){if(busy){recoverWhenIdle=true;return;}run(async()=>{await availability();if(state.token)await restoreAccount();else view('email');});}
  function clearReturn(){const url=new URL(location.href);url.searchParams.delete('invoiceId');url.searchParams.delete('status');
    history.replaceState(null,'',url.pathname+url.search+url.hash);returnInvoice=null;}
  async function sendCode(){await availability();challenge=await call('/v1/auth/request-code',{email:el('email').value.trim()});
    if(typeof challenge.challengeId!=='string'||challenge.homeRegion!=='ru')throw new Failure(503);
    resendAt=Date.now()+60000;el('code').value='';view('code');el('code').focus();message('Check your inbox and spam folder.');}
  el('email-form').addEventListener('submit',event=>{event.preventDefault();run(sendCode);});
  el('code-form').addEventListener('submit',event=>{event.preventDefault();run(async()=>{
    const session=await call('/v1/auth/verify-code',{challengeId:challenge?.challengeId,code:el('code').value.trim()});
    if(session.homeRegion!=='ru'||typeof session.token!=='string'||!(session.expiresAt*1000>Date.now()))throw new Failure(503);
    state={token:session.token,expiresAt:session.expiresAt};paintPlan();el('code').value='';await restoreAccount();
  });});
  el('resend').addEventListener('click',()=>run(sendCode));
  el('change-email').addEventListener('click',()=>{challenge=null;view('email');message('');});
  el('terms').addEventListener('change',controls);el('check-plus').addEventListener('click',()=>run(refresh));
  el('pay').addEventListener('click',()=>run(purchase));el('retry-order').addEventListener('click',()=>run(refresh));
  el('continue-payment').addEventListener('click',event=>{event.preventDefault();run(continuePayment);});
  for(const radio of document.querySelectorAll('[name=plan]'))radio.addEventListener('change',()=>{selectedPlan=radio.value;el('terms').checked=false;paintPlan();controls();});
  el('new-order').addEventListener('click',()=>{
    if(!['paid','failed','cancelled','closed'].includes(state.order?.status))return;
    for(const key of ['requestId','requestPlan','requestTerms','requestPricingVersion','requestAmountMinor','order'])delete state[key];
    try{save();}catch{message('Could not save your session.',true);return;}
    clearReturn();el('terms').checked=false;el('order-panel').hidden=true;el('purchase-panel').hidden=false;paintPlan();controls();
  });
  el('logout').addEventListener('click',()=>run(async()=>{const token=state.token;state={};sessionStorage.removeItem(STORAGE);
    el('terms').checked=false;view('email');paintPlan();clearReturn();
    try{await call('/v1/auth/logout',{},token);message('You are signed out.');}
    catch{message('Signed out on this device. The server has not yet confirmed the session ended.',true);}
  }));
  window.addEventListener('hanzi:languagechange',()=>{paintPlan();expiryDescription();});
  window.addEventListener('offline',()=>{revision++;closePayments();});
  window.addEventListener('pagehide',()=>{revision++;closePayments();});
  window.addEventListener('online',recoverAvailability);
  window.addEventListener('pageshow',event=>{if(event.persisted){revision++;closePayments();recoverAvailability();}});
  setInterval(()=>{const remaining=Math.max(0,Math.ceil((resendAt-Date.now())/1000));el('resend').textContent=remaining?'New code · '+remaining+'s':'New code';controls();},1000);
  run(async()=>{
    try{const saved=JSON.parse(sessionStorage.getItem(STORAGE)||'{}');if(saved.token&&saved.expiresAt*1000>Date.now())state=saved;else sessionStorage.removeItem(STORAGE);}catch{}
    try{await availability();}catch{view('email');return;}
    if(state.token)await restoreAccount();else view('email');
  });
})();
