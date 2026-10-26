/* Set only the visible app before body paint. It never chooses a billing region. */
(() => {
  const app=new URLSearchParams(location.search).get('app');
  if(['bloom','keys','stories'].includes(app))document.documentElement.dataset.app=app;
})();
