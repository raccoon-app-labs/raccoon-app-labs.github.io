import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';

// Exercise the shipped module against a small DOM, without a browser or real API.
const source=fs.readFileSync(new URL('../apps/neon-cyber-wall-kicker/shop/checkout.js',import.meta.url),'utf8');
const {mountCheckout}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
class Element {
  constructor(tag,document){this.tagName=tag;this.ownerDocument=document;this.children=[];this.dataset={};this.attributes={};this.events={};this.hidden=false;this.disabled=false;this.checked=false;this.value='';this.open=false;this._text='';}
  setAttribute(name,value=''){this.attributes[name]=String(value);if(name==='class')this.className=value;if(name==='hidden')this.hidden=true;if(name==='disabled')this.disabled=true;if(name==='open')this.open=true;if(name.startsWith('data-'))this.dataset[name.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(value);}
  getAttribute(name){return this.attributes[name]??null;}
  removeAttribute(name){delete this.attributes[name];if(name==='hidden')this.hidden=false;}
  toggleAttribute(name,force){const yes=force??!(name in this.attributes);if(yes)this.setAttribute(name);else this.removeAttribute(name);return yes;}
  append(...nodes){for(const node of nodes){node.parentElement=this;this.children.push(node);}}
  replaceChildren(...nodes){this.children=[];this._text='';this.append(...nodes);}
  set textContent(value){this._text=String(value);this.children=[];}
  get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
  set innerHTML(value){this.replaceChildren();const stack=[this];for(const token of value.matchAll(/<\/?[a-z][^>]*>|[^<]+/gi)){const part=token[0];if(part.startsWith('</')){stack.pop();continue;}if(!part.startsWith('<')){stack.at(-1)._text+=part;continue;}const tag=/^<([\w-]+)/.exec(part)[1],node=new Element(tag,this.ownerDocument);for(const match of part.matchAll(/\s([\w-]+)(?:="([^"]*)")?/g))node.setAttribute(match[1],match[2]??'');stack.at(-1).append(node);if(!['input','br','img','hr'].includes(tag))stack.push(node);}}
  matches(selector){const tag=/^[\w-]+/.exec(selector)?.[0];if(tag&&this.tagName!==tag)return false;for(const match of selector.matchAll(/\.([\w-]+)/g))if(!(this.className||'').split(' ').includes(match[1]))return false;for(const match of selector.matchAll(/\[([\w-]+)(?:=["']?([^\]"']+)["']?)?\]/g))if(!(match[1] in this.attributes)||(match[2]!==undefined&&this.attributes[match[1]]!==match[2]))return false;return true;}
  querySelectorAll(selector){const parts=selector.split(/\s+/),found=[];const visit=node=>{for(const child of node.children){if(child.matches(parts.at(-1))){let parent=child.parentElement,index=parts.length-2;while(parent&&index>=0){if(parent.matches(parts[index]))index--;parent=parent.parentElement;}if(index<0)found.push(child);}visit(child);}};visit(this);return found;}
  querySelector(selector){return this.querySelectorAll(selector)[0]??null;}
  closest(selector){for(let node=this;node;node=node.parentElement)if(node.matches(selector))return node;return null;}
  addEventListener(name,callback){(this.events[name]??=[]).push(callback);}
  emit(name){for(const callback of this.events[name]||[])callback({target:this,preventDefault(){}});}
  click(){if(!this.disabled)this.emit('click');}
  focus(){this.ownerDocument.activeElement=this;}
  scrollIntoView(){}
}
const product=()=>({id:'coins_2000',kind:'coins',ru:'Горсть монет',en:'Pocket change',coins:3000,price:14900,euro:{cents:164},offer_version:'a'.repeat(64)});
const catalog=()=>({enabled:true,website_checkout_available:true,pricing_available:true,currency:'RUB',display_currency:'EUR',products:[product()],seller:{terms_version:'v1',terms_url:'https://neonwallkicker.ru/apps/neon-cyber-wall-kicker/shop/offer/'}});
async function settled(controller){for(let count=0;controller.state.busy&&count<30;count++)await new Promise(resolve=>setImmediate(resolve));assert.equal(controller.state.busy,false,'checkout action settled');}
async function fixture({signedIn=false,offline=false,paused=false,origin='https://neonwallkicker.ru',apiOrigin,authRequestFails=false,language='en',globalLanguage=false}={}){
  const calls=[],navigation=[],storage=new Map();let available=!offline,offerChanged=false,badCode=false,currentCatalog=catalog();
  if(paused)currentCatalog.website_checkout_available=false;
  if(signedIn)storage.set('neon-website-purchases-v1',JSON.stringify({token:'session',email:'player@example.invalid'}));
  const document={documentElement:{lang:language},createElement:tag=>new Element(tag,document)};
  const page=new Element('main',document);page.innerHTML='<article data-neon-product="coins_2000"><span data-neon-price></span><span data-neon-coins></span><button data-neon-buy="coins_2000"></button></article><section data-neon-web-checkout></section>';
  document.querySelector=selector=>page.querySelector(selector);document.querySelectorAll=selector=>page.querySelectorAll(selector);
  const location=new URL(origin+'/apps/neon-cyber-wall-kicker/shop/');
  document.defaultView={location,navigator:{language:'en'},crypto:{randomUUID},sessionStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},fetch:async(url,options)=>{
    const requested=new URL(url,location),path=requested.pathname.replace(/^\/services\/neon(?=\/)/,''),body=options.body?JSON.parse(options.body):null;calls.push({path,url,resolvedUrl:requested.href,body,method:options.method,headers:options.headers});assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');
    let data,status=200;
    if(path==='/v1/catalog'){if(!available)throw Error('offline');data=url.includes('ready=1')?{ok:true}:structuredClone(currentCatalog);}
    else if(path==='/v1/wallet')data={pricing_available:true,owned_products:[],unresolved_orders:[]};
    else if(path==='/v1/auth/request'){if(authRequestFails)throw Error('offline');data={ok:true};}
    else if(path==='/v1/auth/verify'){data=badCode?{error:'invalid_code'}:{token:'session'};if(badCode)status=400;}
    else if(path==='/v1/orders'&&offerChanged){data={error:'offer_changed',no_order_for_request_key:true};status=409;}
    else throw Error('Unexpected test API call: '+path);
    return {ok:status===200,status,json:async()=>data};
  }};
  if(globalLanguage){
    const listeners=[],messages={es:{'Choose purchase':'Elegir compra','Checkout':'Comprar','In-game email':'Correo del juego','Pocket change':'Monedas sueltas'}};
    document.defaultView.addEventListener=(name,fn)=>{if(name==='hanzi:languagechange')listeners.push(fn);};
    document.defaultView.HanziLocale={code:language,translate(value){return messages[this.code]?.[value]??value;},set(next){this.code=next;document.documentElement.lang=next;for(const fn of listeners)fn({detail:{code:next}});}};
  }
  const root=document.querySelector('[data-neon-web-checkout]'),controller=mountCheckout(root,{apiOrigin,navigate:url=>navigation.push(url)});await settled(controller);
  const el=selector=>{const node=root.querySelector(selector);assert.ok(node,selector);return node;};
  return {root,controller,el,calls,navigation,choose:()=>document.querySelector('[data-neon-buy]').click(),buyButton:document.querySelector('[data-neon-buy]'),setLanguage:next=>document.defaultView.HanziLocale.set(next),setOffline:()=>{available=false;},setBadCode:value=>{badCode=value;},changeOffer:()=>{offerChanged=true;currentCatalog.products[0].price=15900;currentCatalog.products[0].offer_version='b'.repeat(64);}};
}

test('guest selection prioritizes product and both currencies, with payment hidden until sign-in',async()=>{
  const f=await fixture();assert.equal(f.el('.neon-checkout-status').hidden,true);f.choose();
  assert.equal(f.el('.neon-selected').hidden,false);assert.equal(f.el('.neon-payment').hidden,true);assert.equal(f.el('[data-pay]').disabled,true);
  assert.match(f.el('.neon-selected-price strong').textContent,/≈.*€/);assert.match(f.el('.neon-selected-price small').textContent,/149.*00/);
  assert.equal(f.el('.neon-selected-price').closest('details'),null);assert.equal(f.el('.neon-checkout-details').open,false);
  assert.equal(f.calls.some(call=>call.path==='/v1/orders'),false);
});

test('switching checkout language retains the typed email and marks the current language',async()=>{
  const f=await fixture(),input=f.el('input[name=email]');input.value='Player@example.invalid';input.emit('input');f.el('[data-lang=ru]').click();
  assert.equal(input.value,'Player@example.invalid');assert.equal(f.root.lang,'ru');assert.equal(f.el('[data-lang=ru]').getAttribute('aria-pressed'),'true');
  f.el('[data-lang=en]').click();assert.equal(input.value,'Player@example.invalid');
});

test('email code flow exposes one field, supports correction and reveals payment only after verification',async()=>{
  const f=await fixture();f.choose();f.el('input[name=email]').value='Player@example.invalid';f.el('.neon-auth').emit('submit');await settled(f.controller);
  assert.equal(f.el('.neon-email-label').hidden,true);assert.equal(f.el('.neon-code').hidden,false);assert.equal(f.el('[data-auth-back]').hidden,false);
  assert.equal(f.calls.find(call=>call.path==='/v1/auth/request').body.email,'player@example.invalid');
  f.el('[data-auth-back]').click();assert.equal(f.el('.neon-email-label').hidden,false);assert.equal(f.el('.neon-code').hidden,true);
  assert.equal(f.el('.neon-checkout-status').hidden,true);assert.equal(f.el('input[name=code]').value,'');
  f.el('.neon-auth').emit('submit');await settled(f.controller);f.setBadCode(true);f.el('input[name=code]').value='000000';f.el('.neon-auth').emit('submit');await settled(f.controller);
  assert.equal(f.el('.neon-checkout-status').hidden,false);assert.equal(f.el('.neon-code').hidden,false);assert.equal(f.el('.neon-payment').hidden,true);
  f.setBadCode(false);f.el('input[name=code]').value='123456';f.el('.neon-auth').emit('submit');await settled(f.controller);
  assert.equal(f.el('.neon-auth').hidden,true);assert.equal(f.el('.neon-account').hidden,false);assert.equal(f.el('.neon-payment').hidden,false);
  assert.equal(f.el('[data-pay]').disabled,true);assert.equal(f.calls.some(call=>call.path==='/v1/orders'),false);
});

test('unavailable or paused service leaves errors visible and blocks auth, offers and payment',async()=>{
  for(const options of [{offline:true},{paused:true}]){const f=await fixture(options);assert.equal(f.controller.state.ready,false);assert.equal(f.el('.neon-checkout-status').hidden,false);assert.equal(f.el('.neon-checkout-status').dataset.error,'true');assert.equal(f.buyButton.disabled,true);assert.equal(f.el('[data-auth-submit]').disabled,true);assert.equal(f.el('[data-pay]').disabled,true);}
});

test('authenticated checkout cannot create an order without consent or after readiness fails',async()=>{
  const f=await fixture({signedIn:true});f.choose();f.el('[data-pay]').click();assert.equal(f.calls.some(call=>call.path==='/v1/orders'),false);
  f.el('[data-consent]').checked=true;f.el('[data-consent]').emit('change');assert.equal(f.el('[data-pay]').disabled,false);f.setOffline();f.el('[data-pay]').click();await settled(f.controller);
  assert.equal(f.calls.some(call=>call.path==='/v1/orders'),false);assert.equal(f.navigation.length,0);assert.equal(f.el('[data-pay]').disabled,true);assert.equal(f.el('.neon-checkout-status').hidden,false);
});

test('offer changes refresh the visible price and require new consent before retrying',async()=>{
  const f=await fixture({signedIn:true});f.choose();f.el('[data-consent]').checked=true;f.el('[data-consent]').emit('change');f.changeOffer();f.el('[data-pay]').click();await settled(f.controller);
  const orders=f.calls.filter(call=>call.path==='/v1/orders');assert.equal(orders.length,1);assert.equal(orders[0].body.preflight,true);assert.equal(orders[0].body.accept_terms,true);
  assert.equal(f.controller.state.selected.price,15900);assert.match(f.el('.neon-selected-price small').textContent,/159.*00/);assert.equal(f.el('[data-consent]').checked,false);assert.equal(f.el('[data-pay]').disabled,true);assert.equal(f.navigation.length,0);
});

test('the primary HTTPS site reuses its origin and GET requests omit the JSON content type',async()=>{
  const f=await fixture({signedIn:true});
  assert.equal(f.controller.state.ready,true);
  assert.equal(f.calls.length,3,'readiness, catalogue and authenticated wallet remain checked');
  for(const call of f.calls){
    assert.ok(call.url.startsWith('/services/neon/'));
    assert.equal(new URL(call.resolvedUrl).origin,'https://neonwallkicker.ru');
    assert.equal(call.method,'GET');assert.equal(call.headers['Content-Type'],undefined);
    assert.equal(call.headers.Authorization,'Bearer session');
  }
});

test('other page origins retain the fixed public API and explicit test overrides remain supported',async()=>{
  for(const origin of ['http://neonwallkicker.ru','https://www.neonwallkicker.ru','https://neonwallkicker.ru:444','https://raccoon-app-labs.github.io','http://127.0.0.1:8721','https://neonwallkicker.ru.attacker.invalid']){
    const f=await fixture({origin});assert.equal(f.controller.state.ready,true);
    for(const call of f.calls)assert.equal(new URL(call.resolvedUrl).origin,'https://api.neonwallkicker.ru');
  }
  const custom=await fixture({apiOrigin:'https://preview-api.example.invalid'});
  for(const call of custom.calls)assert.equal(new URL(call.resolvedUrl).origin,'https://preview-api.example.invalid');
});

test('same-origin writes retain JSON bodies and a failed auth POST is sent only once',async()=>{
  const f=await fixture({authRequestFails:true});f.choose();f.el('input[name=email]').value='Player@example.invalid';f.el('.neon-auth').emit('submit');await settled(f.controller);
  const writes=f.calls.filter(call=>call.method==='POST');assert.equal(writes.length,1);
  assert.equal(writes[0].url,'/services/neon/v1/auth/request');
  assert.equal(writes[0].headers['Content-Type'],'application/json');
  assert.deepEqual(writes[0].body,{email:'player@example.invalid'});
  assert.equal(f.controller.state.ready,false);assert.equal(f.el('[data-pay]').disabled,true);assert.equal(f.navigation.length,0);
});

test('global language changes update late catalogue controls and preserve email, code and consent',async()=>{
  const f=await fixture({language:'ru',globalLanguage:true,signedIn:true});f.choose();
  const email=f.el('input[name=email]'),code=f.el('input[name=code]');email.value='typing@example.invalid';email.emit('input');code.value='123456';f.el('[data-consent]').checked=true;
  assert.equal(f.buyButton.textContent,'Выбрать покупку');f.setLanguage('en');
  assert.equal(f.buyButton.textContent,'Choose purchase');assert.equal(f.root.lang,'en');assert.equal(email.value,'typing@example.invalid');assert.equal(code.value,'123456');assert.equal(f.el('[data-consent]').checked,true);
  await f.controller.refresh();await settled(f.controller);assert.equal(f.buyButton.textContent,'Choose purchase');
});

test('a third site language reaches isolated checkout copy and product names',async()=>{
  const f=await fixture({language:'es',globalLanguage:true});f.choose();
  assert.equal(f.root.lang,'es');assert.equal(f.buyButton.textContent,'Elegir compra');assert.equal(f.el('.neon-selected h3').textContent,'Monedas sueltas');
  assert.equal(f.el('[data-copy=email]').textContent,'Correo del juego');assert.equal(f.root.getAttribute('aria-label'),'Comprar');
});

test('local checkout language buttons also update the shared site language',async()=>{
  const f=await fixture({globalLanguage:true});f.el('[data-lang=ru]').click();await new Promise(setImmediate);
  assert.equal(f.root.ownerDocument.documentElement.lang,'ru');assert.equal(f.root.lang,'ru');assert.equal(f.buyButton.textContent,'Выбрать покупку');
  f.setLanguage('en');assert.equal(f.buyButton.textContent,'Choose purchase');
});
