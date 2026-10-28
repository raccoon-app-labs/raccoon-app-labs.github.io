/* Prepaint the requested view only; language never chooses the billing region. */
(() => {
  const params=new URLSearchParams(location.search),app=params.get('app');
  if(['bloom','keys','stories','neon'].includes(app))document.documentElement.dataset.app=app;
  document.documentElement.dataset.accountRegion=params.get('region')==='ru'?'ru':'global';
  // Start the visible cover before styles, localization and the shop modules finish.
  // The distinct inside scenes warm up at low priority, so opening the book needs no new download.
  if(app==='stories' && ['', '#stories-panel', '#app-panel', '#main'].includes(location.hash)){
    for(const page of [1,2,3,6,8,9]){
      const preload=document.createElement('link');preload.rel='preload';preload.as='image';
      preload.href='/assets/demo/bunny-page-'+page+'.webp';preload.fetchPriority=page===1?'high':'low';
      preload.dataset.storyPage=String(page);document.head.append(preload);
    }
  }
})();
