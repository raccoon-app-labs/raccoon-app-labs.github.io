/* Old public bookmarks open the same Stories tab, preserving language/section. */
(() => {
  if(location.pathname!=='/apps/magical-stories/shop/' && location.pathname!=='/apps/magical-stories/shop/index.html')return;
  const target=new URL('/plus/',location.href);target.searchParams.set('app','stories');
  const language=new URLSearchParams(location.search).get('lang');if(language)target.searchParams.set('lang',language);
  target.hash=location.hash==='#offers'?'#plus':location.hash;
  location.replace(target.href);
})();
