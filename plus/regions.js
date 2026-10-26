/* The region picker changes the shop view, never the account's billing region. */
(() => {
  'use strict';
  const root = document.documentElement;
  const panel = document.querySelector('[data-ru-region-panel]');
  if (!panel) return;
  const picker = document.querySelector('[data-commerce-region]');
  const pass = document.querySelector('.pass-section');
  const globalContent = [...document.querySelectorAll('#app-panel,#hanzi-content>.pass-section,#hanzi-content>.how-section,#hanzi-content>.faq-section')];
  const footer = [...document.querySelectorAll('.store-footer a[href]')].filter(a => /\/(offer|privacy)\//.test(a.getAttribute('href')));
  const originalFooter = new Map(footer.map(a => [a,a.getAttribute('href')]));
  let entrance;
  const region = () => new URLSearchParams(location.search).get('region') === 'ru' ? 'ru' : 'global';
  const app = () => ['keys','bloom'].includes(root.dataset.app) ? root.dataset.app : null;
  const language = () => new URLSearchParams(location.search).get('lang') || root.lang || 'en';
  function shopUrl(value) {
    const url = new URL(location.href);
    url.searchParams.set('region',value);
    url.searchParams.set('app',app() || 'bloom');
    url.searchParams.set('lang',language());
    url.hash = '';
    return url;
  }
  function checkout(plan) {
    const url = new URL('/apps/hanzi-bloom/plus/checkout/',location.href);
    url.searchParams.set('app',app() || 'bloom');
    url.searchParams.set('lang',language());
    if (plan) url.searchParams.set('plan',plan);
    return url.href;
  }
  function render() {
    const ru = region() === 'ru', hanzi = !!app();
    root.dataset.accountRegion = ru ? 'ru' : 'global';
    for (const link of picker.querySelectorAll('[data-russian-catalog],[data-international-catalog]')) {
      const value = link.hasAttribute('data-russian-catalog') ? 'ru' : 'global';
      link.href = shopUrl(value).href;
      if ((value === 'ru') === ru) link.setAttribute('aria-current','true');
      else link.removeAttribute('aria-current');
    }
    for (const node of globalContent) node.hidden = hanzi && ru;
    panel.hidden = !hanzi || !ru;
    // Only the current shop owns #plus, including after Back/Forward and app changes.
    pass.id = hanzi && !ru ? 'plus' : 'hanzi-plus';
    panel.id = hanzi && ru ? 'plus' : 'ru-pricing';
    if (hanzi) {
      document.querySelector('.skip-link').href = ru ? '#plus' : '#app-panel';
      for (const link of document.querySelectorAll('[data-checkout]')) {
        if (ru) link.href = checkout();
        else {
          const url = new URL('/en/apps/hanzi-bloom/plus/checkout/',location.href);
          url.searchParams.set('app',app());url.searchParams.set('lang',language());link.href=url.href;
        }
      }
    }
    for (const link of panel.querySelectorAll('[data-ru-web-plan]')) link.href = checkout(link.dataset.ruWebPlan);
    for (const link of footer) {
      const url = new URL(originalFooter.get(link),location.href);
      if (hanzi && ru) url.pathname = '/apps/hanzi-bloom/plus/checkout/' + (url.pathname.includes('/offer/')?'offer/':'privacy/');
      url.searchParams.set('lang',language());link.href = url.href;
    }
    for (const link of panel.querySelectorAll('[data-ru-document]')) {
      const url=new URL(link.href);url.searchParams.set('lang',language());link.href=url.href;
    }
  }
  picker.addEventListener('click',event => {
    const link=event.target.closest('[data-russian-catalog],[data-international-catalog]');
    if (!link || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const value=link.hasAttribute('data-russian-catalog')?'ru':'global';
    const changed=region()!==value;
    if (changed) history.pushState(null,'',shopUrl(value));
    render();
    entrance?.cancel();
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches || root.dataset.motion==='reduced';
    if (changed && !reduced) entrance=(value==='ru'?panel:document.querySelector('#app-panel')).animate([
      {opacity:.25,transform:'translateY(16px) scale(.985)'},{opacity:1,transform:'translateY(0) scale(1)'}
    ],{duration:420,easing:'cubic-bezier(.2,.8,.2,1)'});
  });
  addEventListener('raccoon:appchange',render);
  addEventListener('hanzi:languagechange',render);
  addEventListener('popstate',render);
  render();
})();
