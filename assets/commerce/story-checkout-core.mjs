export const API_BASE = 'https://reserve.volshebnye-istorii.ru';
export const PRICING_VERSION = 'first_purchase_v1';
export function offerPath(storyId) {
  const query = new URLSearchParams({pricingVersion:PRICING_VERSION});
  if (Number.isSafeInteger(storyId) && storyId > 0) query.set('storyId', String(storyId));
  return `/api/premium/offer?${query}`;
}
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
  if (value.pricingVersion !== undefined) {
    const validMoney = amount => Number.isSafeInteger(amount) && amount > 0;
    const validPrice = (amount, regular, discount) => validMoney(regular) && amount <= regular &&
      [0,20].includes(discount) && (discount === 20
        ? amount === Number((BigInt(regular) * 80n + 50n) / 100n || 1n)
        : amount === regular);
    if (value.pricingVersion !== PRICING_VERSION || !validMoney(value.renewalAmount) ||
        !validPrice(value.amount, value.regularAmount, value.premiumDiscountPercent) ||
        !validPrice(value.bookAmount, value.regularBookAmount, value.bookDiscountPercent) ||
        !['sign_in_required','available','reserved','used'].includes(value.firstPurchaseDiscountState) ||
        typeof value.firstPurchaseDiscountEligible !== 'boolean' ||
        value.firstPurchaseDiscountEligible !== (value.firstPurchaseDiscountState === 'available')) {
      throw new ShopError('offer_unavailable');
    }
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
  const pricing = offer.pricingVersion === PRICING_VERSION ? {pricingVersion:PRICING_VERSION} : {};
  if (offer.pricingVersion === PRICING_VERSION && offer.firstPurchaseDiscountState === 'sign_in_required') throw new ShopError('login_required');
  if (product === 'book') {
    if (!story || !offer.bookStoryIds.includes(story.id)) throw new ShopError('story_not_for_sale');
    return {path:`/api/books/${story.id}/create`, body:{termsVersion:offer.termsVersion, amount:offer.bookAmount, termsAccepted:true, ...pricing}};
  }
  if (product !== 'premium') throw new ShopError('invalid_product');
  return {path:'/api/subscription/create', body:{termsVersion:offer.termsVersion, amount:offer.amount, autoRenewConsent:offer.autoRenew && accepted, ...pricing}};
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

export function createApi({fetcher = globalThis.fetch, getSession, setSession, deviceId, getSessionEpoch = () => 0}) {
  let refresh, refreshEpoch, observed = fingerprint(getSession()), inferredEpoch = 0;
  function fingerprint(value) { return [value?.userId, value?.email, value?.accessToken, value?.refreshToken].join('\0'); }
  function epoch() {
    const next = fingerprint(getSession());
    if (next !== observed) { inferredEpoch++; observed = next; }
    return getSessionEpoch() + ':' + inferredEpoch;
  }
  function requireEpoch(expected) { if (epoch() !== expected) throw new ShopError('account_changed', 409); }
  function persistRefresh(value, expected) {
    requireEpoch(expected);
    setSession(value);
    observed = fingerprint(getSession()); // A verified refresh rotates tokens within the same account.
  }
  async function request(path, {method = 'GET', body, authenticated = false, retry = true, networkRetries = 1, sessionEpoch = epoch()} = {}) {
    requireEpoch(sessionEpoch);
    const session = getSession();
    if (authenticated && !session?.accessToken) throw new ShopError('login_required', 401);
    let response;
    try {
      response = await fetcher(API_BASE + path, {
        method, mode:'cors', credentials:'omit', cache:'no-store', referrerPolicy:'no-referrer',
        headers:{...(body ? {'Content-Type':'application/json'} : {}), ...(authenticated ? {Authorization:'Bearer ' + session.accessToken} : {})},
        ...(body ? {body:JSON.stringify(body)} : {}), signal:AbortSignal.timeout(25000)
      });
    } catch {
      requireEpoch(sessionEpoch);
      if (method === 'GET' && networkRetries > 0) return request(path, {method, body, authenticated, retry, networkRetries:networkRetries - 1, sessionEpoch});
      throw new ShopError(method === 'POST' && path.includes('/create') ? 'payment_uncertain' : 'network_error');
    }
    const data = await response.json().catch(() => ({}));
    requireEpoch(sessionEpoch);
    if (response.status === 401 && authenticated && retry && session.refreshToken) {
      if (getSession()?.accessToken !== session.accessToken) return request(path, {method, body, authenticated, retry:false, sessionEpoch});
      if (!refresh || refreshEpoch !== sessionEpoch) {
        const latest = getSession();
        const requestId = latest.refreshRequestId || crypto.randomUUID();
        persistRefresh({...latest, refreshRequestId:requestId}, sessionEpoch);
        refreshEpoch = sessionEpoch;
        const inFlight = request('/api/auth/refresh', {method:'POST', body:{refreshToken:latest.refreshToken, requestId, deviceId, deviceName:'Магазин · браузер'}, sessionEpoch})
          .then(value => {
            requireEpoch(sessionEpoch);
            if (!value?.accessToken || !value?.refreshToken) throw new ShopError('login_required', 401);
            if ((latest.userId && value.userId && latest.userId !== value.userId) ||
                (latest.email && value.email && latest.email !== value.email)) throw new ShopError('account_changed', 409);
            persistRefresh(value, sessionEpoch); return value;
          }).catch(error => {
            requireEpoch(sessionEpoch);
            if (error.status === 400 || error.status === 401) throw new ShopError('login_required', 401);
            throw error;
          }).finally(() => { if (refresh === inFlight) { refresh = null; refreshEpoch = null; } });
        refresh = inFlight;
      }
      await refresh;
      requireEpoch(sessionEpoch);
      return request(path, {method, body, authenticated, retry:false, sessionEpoch});
    }
    if (!response.ok) throw new ShopError(data.error || data.message || data.reason || 'http_' + response.status, response.status);
    return data;
  }
  return request;
}
