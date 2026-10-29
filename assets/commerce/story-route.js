/* Old public bookmarks open the same Stories tab, preserving language/section. */
(() => {
  const neon=/^\/apps\/neon-cyber-wall-kicker\/shop\/(?:index\.html)?$/.test(location.pathname);
  if(!neon && location.pathname!=='/apps/magical-stories/shop/' && location.pathname!=='/apps/magical-stories/shop/index.html')return;
  const target=new URL('/plus/',location.href);target.searchParams.set('app',neon?'neon':'stories');
  const language=new URLSearchParams(location.search).get('lang');if(language)target.searchParams.set('lang',language);
  const region=new URLSearchParams(location.search).get('region');if(neon && ['ru','global'].includes(region))target.searchParams.set('region',region);
  target.hash=neon && location.hash && location.hash!=='#bundles'?'#neon-'+location.hash.slice(1):location.hash==='#offers'?'#plus':location.hash;
  location.replace(target.href);
})();
