/* Prepaint the requested view only; language never chooses the billing region. */
(() => {
  const app=new URLSearchParams(location.search).get('app');
  if(['bloom','keys','stories','neon'].includes(app))document.documentElement.dataset.app=app;
  document.documentElement.dataset.accountRegion=new URLSearchParams(location.search).get('region')==='ru'?'ru':'global';
})();
