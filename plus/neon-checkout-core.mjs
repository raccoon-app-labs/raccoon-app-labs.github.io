export const API_BASE='https://api.neonwallkicker.ru';
export const PRODUCT_IDS=Object.freeze(['starter','supporter','coins_2000','coins_6000','coins_14000','coins_32000']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export class ShopError extends Error{constructor(code,status=0){super(code);this.code=code;this.status=status;}}
export function validateCatalog(data){
  if(data?.currency!=='RUB' || typeof data.enabled!=='boolean' || typeof data.channel_allowed!=='boolean' || typeof data.test!=='boolean' || !Array.isArray(data.products))throw new ShopError('catalog_unavailable');
  const seen=new Set();
  const products=data.products.filter(p=>PRODUCT_IDS.includes(p.id));
  for(const p of products){
    if(seen.has(p.id)||!Number.isSafeInteger(p.price)||p.price<=0||!Number.isSafeInteger(p.coins)||p.coins<=0||!['bundle','coins'].includes(p.kind)||typeof p.ru!=='string'||typeof p.en!=='string')throw new ShopError('catalog_unavailable');
    seen.add(p.id);
  }
  if(seen.size!==PRODUCT_IDS.length || !data.seller?.terms_version || data.seller.terms_url!=='https://raccoon-app-labs.github.io/apps/neon-cyber-wall-kicker/shop/offer/')throw new ShopError('catalog_unavailable');
  return {...data,products};
}
export function purchaseRequest(catalog,productId,channel,accepted,requestKey,owned=[]){
  validateCatalog(catalog);
  if(!catalog.enabled||!catalog.channel_allowed||catalog.test)throw new ShopError('payments_unavailable');
  if(!['rustore','google_play'].includes(channel))throw new ShopError('channel_required');
  const product=catalog.products.find(p=>p.id===productId);
  if(!product)throw new ShopError('unknown_product');
  if(product.once&&owned.includes(productId))throw new ShopError('bundle_already_ordered');
  if(!accepted)throw new ShopError('accept_terms_required');
  if(!uuid.test(requestKey))throw new ShopError('invalid_request_key');
  return {product_id:product.id,channel,accept_terms:true,terms_version:catalog.seller.terms_version,expected_amount:product.price,request_key:requestKey};
}
export function confirmationUrl(raw){
  try{const u=new URL(raw);if(u.protocol==='https:' && u.hostname==='auth.robokassa.ru' && !u.username && !u.password && !u.port && /^\/Merchant\/Index\.aspx$/i.test(u.pathname))return u.href;}catch{}
  return '';
}
export function validateOrder(data,amount){
  if(!uuid.test(data?.id)||!['pending','paid','review','cancelled','refunded'].includes(data.state)||Number(data.amount)!==amount||data.test===true)throw new ShopError('order_unavailable');
  if(data.state==='pending'&&!confirmationUrl(data.checkout_url))throw new ShopError('order_unavailable');
  return data;
}
export function createClient({getSession,fetcher=globalThis.fetch}){
  return async function request(path,{body,authenticated=false}={}){
    const token=getSession()?.token;if(authenticated&&!token)throw new ShopError('sign_in_required',401);
    let response;
    try{response=await fetcher(API_BASE+path,{method:body?'POST':'GET',mode:'cors',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',headers:{...(body?{'Content-Type':'application/json'}:{}),...(authenticated?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});}catch{throw new ShopError(path==='/v1/orders'?'payment_uncertain':'network_error');}
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new ShopError(data.error||'network_error',response.status);
    return data;
  };
}
