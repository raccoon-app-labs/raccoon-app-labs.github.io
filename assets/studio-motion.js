(() => {
  'use strict';
  const root=document.documentElement;if(root.dataset.siteWorld!=='studio')return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),visual=document.querySelector('.visual'),core=visual?.querySelector('.core');
  const worlds=[['stories','magical-stories'],['keys','hanzi-keys'],['bloom','hanzi-bloom'],['muropolis','muropolis'],['neon','neon-cyber-wall-kicker'],['food','what-to-eat'],['dokupit','dokupit']];
  if(core){
    visual.removeAttribute('aria-hidden');
    const button=document.createElement('button');button.className='studio-orbit';button.type='button';button.dataset.noL10n='';
    while(core.firstChild)button.append(core.firstChild);core.append(button);
    const rings=document.createElement('div');rings.className='studio-rings';rings.setAttribute('aria-hidden','true');
    const pulse=document.createElement('i');pulse.className='studio-pulse';pulse.setAttribute('aria-hidden','true');
    const satellites=document.createElement('div');satellites.className='studio-satellites';
    worlds.forEach(([name,slug],i)=>{
      const carrier=document.createElement('div');carrier.className='studio-satellite';const angle=(i/worlds.length*Math.PI*2)-Math.PI/2;
      carrier.style.left=50+Math.cos(angle)*45+'%';carrier.style.top=50+Math.sin(angle)*45+'%';
      const link=document.createElement('a');link.href='/apps/'+slug+'/';
      link.setAttribute('aria-label',document.querySelector('.app-card.'+name+' h3')?.textContent || name);
      const icon=document.createElement('img');icon.src=({"neon":"/assets/display/apps/neon-icon.webp?v=99747775324b"})[name] || '/assets/apps/'+name+'-icon.webp';icon.width=31;icon.height=31;icon.alt='';link.append(icon);carrier.append(link);satellites.append(carrier);
    });
    visual.append(rings,satellites,pulse);
    let burstTimer;
    button.addEventListener('click',()=>{if(reduced.matches)return;visual.classList.remove('is-bursting');void pulse.offsetWidth;visual.classList.add('is-bursting');window.dispatchEvent(new Event('studio:burst'));clearTimeout(burstTimer);burstTimer=setTimeout(()=>visual.classList.remove('is-bursting'),1300);});
    const labels=()=>button.setAttribute('aria-label',root.lang==='ru'?'Зажечь созвездие приложений':'Light up the app constellation');labels();new MutationObserver(labels).observe(root,{attributes:true,attributeFilter:['lang']});
  }
  const sections=[...document.querySelectorAll('.showcase,.values,.project-pages')];sections.forEach(n=>n.classList.add('studio-section'));
  const reveal=new IntersectionObserver(entries=>{for(const entry of entries)entry.target.classList.toggle('is-awake',entry.isIntersecting);},{threshold:.12});sections.forEach(n=>reveal.observe(n));
})();
