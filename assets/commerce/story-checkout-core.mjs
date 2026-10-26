export const API_BASE = 'https://reserve.volshebnye-istorii.ru';
export const PROVIDERS = Object.freeze([
  {id:'robokassa', name:'Robokassa', available:true},
  {id:'lava', name:'Lava.top', available:false}
]);

export class ShopError extends Error {
  constructor(code, status = 0) { super(code); this.code = code; this.status = status; }
}

export function catalogTitle(raw) {
  return String(raw).replace(/\{m:([^|}]+)\|[^}]+\}/g, '$1')
    .replace(/\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim();
}

export function validateOffer(value) {
  if (!value || value.currency !== 'RUB' || !Number.isSafeInteger(value.amount) || value.amount <= 0 ||
      !Number.isSafeInteger(value.bookAmount) || value.bookAmount <= 0 ||
      typeof value.termsVersion !== 'string' || !value.termsVersion || typeof value.autoRenew !== 'boolean' ||
      !Array.isArray(value.bookStoryIds) || value.bookStoryIds.some(id => !Number.isSafeInteger(id) || id <= 0)) {
    throw new ShopError('offer_unavailable');
  }
  return value;
}

export function purchasableStories(catalog, offer, covers = {}) {
  if (!Array.isArray(catalog?.stories)) throw new ShopError('catalog_unavailable');
  const eligible = new Set(offer.bookStoryIds);
  const seen = new Set();
  return catalog.stories.filter(story => {
    if (!eligible.has(story.id) || seen.has(story.id) || story.free !== false || story.hidden === true ||
        typeof story.title !== 'string' || !story.title.trim()) return false;
    seen.add(story.id); return true;
  }).map(story => {
    const path = covers[String(story.id)];
    return {...story, title:catalogTitle(story.title), cover:typeof path === 'string' && /^assets\/covers\/[a-zA-Z0-9_./-]+\.webp$/.test(path) &&
      !path.includes('..') ? `${API_BASE}/v1/assets/${path}` : ''};
  });
}

export function purchaseRequest(product, story, offer, accepted, provider = 'robokassa') {
  validateOffer(offer);
  if (provider !== 'robokassa' || offer.paymentProvider !== provider || !offer.available) throw new ShopError('sales_unavailable');
  if (!accepted) throw new ShopError('consent_required');
  if (product === 'book') {
    if (!story || !offer.bookStoryIds.includes(story.id)) throw new ShopError('story_not_for_sale');
    return {path:`/api/books/${story.id}/create`, body:{termsVersion:offer.termsVersion, amount:offer.bookAmount, termsAccepted:true}};
  }
  if (product !== 'premium') throw new ShopError('invalid_product');
  return {path:'/api/subscription/create', body:{termsVersion:offer.termsVersion, amount:offer.amount, autoRenewConsent:offer.autoRenew && accepted}};
}

export function confirmationUrl(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return '';
    if (url.origin === API_BASE && /^\/api\/payments\/robokassa\/start\/[a-zA-Z0-9-]+$/.test(url.pathname)) return url.href;
    if (url.hostname === 'auth.robokassa.ru' && /^\/Merchant\//i.test(url.pathname)) return url.href;
  } catch { /* An absent or malformed URL must never become a payment link. */ }
  return '';
}

export function createApi({fetcher = globalThis.fetch, getSession, setSession, deviceId}) {
  let refresh;
  async function request(path, {method = 'GET', body, authenticated = false, retry = true} = {}) {
    const session = getSession();
    if (authenticated && !session?.accessToken) throw new ShopError('login_required', 401);
    let response;
    try {
      response = await fetcher(API_BASE + path, {
        method, mode:'cors', credentials:'omit', cache:'no-store', referrerPolicy:'no-referrer',
        headers:{...(body ? {'Content-Type':'application/json'} : {}), ...(authenticated ? {Authorization:`Bearer ${session.accessToken}`} : {})},
        ...(body ? {body:JSON.stringify(body)} : {}), signal:AbortSignal.timeout(25000)
      });
    } catch { throw new ShopError(method === 'POST' && path.includes('/create') ? 'payment_uncertain' : 'network_error'); }
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && authenticated && retry && session.refreshToken) {
      if (getSession()?.accessToken !== session.accessToken) return request(path, {method, body, authenticated, retry:false});
      if (!refresh) {
        const latest = getSession();
        const requestId = latest.refreshRequestId || crypto.randomUUID();
        setSession({...latest, refreshRequestId:requestId});
        refresh = request('/api/auth/refresh', {method:'POST', body:{refreshToken:latest.refreshToken, requestId, deviceId, deviceName:'Магазин · браузер'}})
          .then(value => { setSession(value); return value; }).catch(error => {
            if (error.status === 401 || error.status === 400) setSession(null);
            throw error;
          }).finally(() => { refresh = null; });
      }
      await refresh;
      return request(path, {method, body, authenticated, retry:false});
    }
    if (!response.ok) throw new ShopError(data.error || data.message || data.reason || `http_${response.status}`, response.status);
    return data;
  }
  return request;
}
