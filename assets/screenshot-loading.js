/* Real previews are in HTML. JS only warms galleries and recovers failed requests. */
(() => {
  'use strict';
  const root=document.documentElement;
  const retryWords={ru:'Не загрузилось · Повторить',en:'Retry image',es:'Reintentar imagen',pt:'Tentar novamente',fr:'Réessayer',de:'Bild erneut laden',ar:'إعادة تحميل الصورة',hi:'चित्र फिर लोड करें',id:'Coba lagi',ja:'画像を再読み込み',ko:'이미지 다시 불러오기',tr:'Yeniden dene'};
  for(const image of document.querySelectorAll('img[data-store-screen]')){
    const figure=image.closest('figure'),original={src:image.getAttribute('src'),srcset:image.getAttribute('srcset')};
    let fallback=false,retry;
    function loaded(){if(image.naturalWidth>0){image.dataset.imageState='ready';retry?.remove();retry=undefined;}}
    image.addEventListener('load',loaded);
    function failed(){
      if(!fallback && image.getAttribute('srcset') && image.dataset.screenFallback){
        fallback=true;image.dataset.imageState='fallback';image.removeAttribute('srcset');
        image.loading='eager';image.src=image.dataset.screenFallback;return;
      }
      image.dataset.imageState='error';
      if(!figure || retry)return;
      retry=document.createElement('button');retry.type='button';retry.className='screenshot-retry';
      retry.dataset.noL10n='';retry.textContent=retryWords[root.lang] || retryWords.en;
      retry.addEventListener('click',()=>{
        fallback=false;retry.remove();retry=undefined;image.dataset.imageState='loading';
        if(original.srcset)image.setAttribute('srcset',original.srcset);
        image.loading='eager';image.src=original.src;
      });figure.append(retry);
    }
    image.addEventListener('error',failed);
    image.dataset.imageState='loading';
    if(image.complete && !image.naturalWidth)failed();else loaded();
  }
  function warm(gallery){
    for(const image of gallery.querySelectorAll('img[data-store-screen]')){image.loading='eager';image.fetchPriority='auto';}
  }
  const galleries=document.querySelectorAll('[data-carousel]');
  if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>{
      for(const entry of entries)if(entry.isIntersecting){warm(entry.target);observer.unobserve(entry.target);}
    },{rootMargin:'1000px 0px'});galleries.forEach(g=>observer.observe(g));
  }else galleries.forEach(warm);
})();
