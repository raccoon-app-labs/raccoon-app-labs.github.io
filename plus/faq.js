// Keep native details/summary semantics, including keyboard and no-JS fallback.
export function installFaqReveals({reducedMotion}) {
  const items = [...document.querySelectorAll('.faq-list details')].map(details => ({
    details, summary:details.querySelector('summary'), answer:details.querySelector('.faq-answer'),
    paper:details.querySelector('.faq-paper'), wanted:details.open, height:null, paperMotion:null
  })).filter(item => item.answer && item.paper);

  function settle(item) {
    const height = item.height, paper = item.paperMotion;
    item.height = item.paperMotion = null;
    height?.cancel(); paper?.cancel();
    item.details.open = item.wanted;
    item.details.dataset.faqExpanded = String(item.wanted);
    item.summary.setAttribute('aria-expanded', String(item.wanted));
    item.answer.style.removeProperty('height');
    item.answer.inert = false;
  }

  function toggle(item) {
    // Some engines still lay out a closed details subtree. Its measured box
    // is not visible, so a fresh opening must start at zero rather than that box.
    const start = item.details.open ? item.answer.getBoundingClientRect().height : 0;
    const livePaper = item.height ? getComputedStyle(item.paper) : null;
    const restart = livePaper ? {opacity:livePaper.opacity, transform:livePaper.transform, clipPath:livePaper.clipPath} : null;
    item.wanted = !item.wanted;
    item.height?.cancel(); item.paperMotion?.cancel();
    item.height = item.paperMotion = null;
    item.details.dataset.faqExpanded = String(item.wanted);
    item.summary.setAttribute('aria-expanded', String(item.wanted));
    if (reducedMotion()) { settle(item); return; }

    // Leave details open until the closing animation completes, so its content
    // can fold away. Inert keeps links out of the tab order while it closes.
    item.answer.style.height = start + 'px';
    item.details.open = true;
    item.answer.inert = !item.wanted;
    const end = item.wanted ? item.answer.scrollHeight : 0;
    const duration = item.wanted ? 540 : 300;
    const frames = item.wanted
      ? [{height:start + 'px'}, {height:end + 5 + 'px', offset:.78}, {height:end + 'px'}]
      : [{height:start + 'px'}, {height:'0px'}];
    const height = item.answer.animate(frames,
      {duration, easing:'cubic-bezier(.22,.75,.22,1)', fill:'both'});
    item.height = height;
    const unfolded = 'polygon(0 0,100% 0,100% 100%,75% 100%,50% 100%,25% 100%,0 100%)';
    const folded = 'polygon(0 0,100% 0,100% 0,75% 0,50% 0,25% 0,0 0)';
    item.paperMotion = item.paper.animate(item.wanted ? [
      restart || {opacity:.2, transform:'perspective(800px) rotateX(-14deg) translateY(-8px)', clipPath:folded},
      {opacity:1, transform:'perspective(800px) rotateX(3deg) translateY(0)',
        clipPath:'polygon(0 0,100% 0,100% 90%,75% 100%,50% 93%,25% 100%,0 90%)', offset:.65},
      {opacity:1, transform:'perspective(800px) rotateX(0deg) translateY(0)', clipPath:unfolded}
    ] : [
      restart || {opacity:1, transform:'translateY(0)', clipPath:unfolded},
      {opacity:0, transform:'translateY(-8px)', clipPath:folded}
    ], {duration, easing:'cubic-bezier(.22,.75,.22,1)', fill:'both'});
    height.finished.then(() => { if (item.height === height) settle(item); }, () => {});
  }

  for (const item of items) {
    item.summary.setAttribute('aria-expanded', String(item.wanted));
    item.summary.addEventListener('click', event => {
      // Enter and Space dispatch a native summary click along this same path.
      if (event.button > 0) return;
      event.preventDefault(); toggle(item);
    });
    item.details.addEventListener('toggle', () => {
      if (item.height) return;
      item.wanted = item.details.open;
      item.summary.setAttribute('aria-expanded', String(item.wanted));
      item.details.dataset.faqExpanded = String(item.wanted);
    });
  }
  const finishAll = () => items.forEach(settle);
  window.addEventListener('resize', finishAll, {passive:true});
  window.addEventListener('pagehide', finishAll);
  return {finishAll};
}
