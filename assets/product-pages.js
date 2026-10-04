(() => {
  'use strict';
  const en = document.documentElement.lang === 'en';
  const t = (ru, english) => en ? english : ru;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  $$('.faq-list details').forEach(details => {
    const summary = details.querySelector('summary');
    const answer = document.createElement('div');
    answer.className = 'faq-answer';
    [...details.children].filter(child => child !== summary).forEach(child => answer.append(child));
    details.append(answer);
    let expanded = details.open, motion, textMotion;
    details.classList.toggle('is-expanded', expanded);
    summary.addEventListener('click', event => {
      event.preventDefault();
      const from = details.getBoundingClientRect().height;
      const opacity = getComputedStyle(answer).opacity;
      motion?.cancel(); textMotion?.cancel();
      expanded = !expanded;
      details.classList.toggle('is-expanded', expanded);
      if (matchMedia('(prefers-reduced-motion: reduce)').matches || !details.animate) {
        details.open = expanded; return;
      }
      details.open = true;
      const to = expanded ? details.getBoundingClientRect().height : summary.getBoundingClientRect().height;
      motion = details.animate([{height: `${from}px`}, {height: `${to}px`}], {duration: expanded ? 440 : 320, easing: 'cubic-bezier(.22,1,.36,1)'});
      textMotion = answer.animate([
        {opacity: expanded && from <= summary.offsetHeight + 1 ? 0 : opacity, transform: expanded ? 'translateY(-9px)' : 'translateY(0)'},
        {opacity: expanded ? 1 : 0, transform: expanded ? 'translateY(0)' : 'translateY(-6px)'}
      ], {duration: expanded ? 400 : 220, easing: 'ease-out'});
      motion.onfinish = () => { details.open = expanded; motion = null; textMotion = null; };
    });
  });
  try { localStorage.setItem('ral-language', en ? 'en' : 'ru'); } catch {}
  $$('[data-language]').forEach(a => a.addEventListener('click', () => { try { localStorage.setItem('ral-language', a.dataset.language); } catch {} }));
  $$('[data-carousel]').forEach(carousel => {
    const track = carousel.querySelector('[data-carousel-track]'), shots = [...track.children];
    const prev = carousel.querySelector('[data-carousel-prev]'), next = carousel.querySelector('[data-carousel-next]');
    let current = 0;
    const update = () => { current = shots.reduce((best, shot, i) => Math.abs(shot.offsetLeft - shots[0].offsetLeft - track.scrollLeft) < Math.abs(shots[best].offsetLeft - shots[0].offsetLeft - track.scrollLeft) ? i : best, 0); carousel.querySelector('[data-carousel-count]').textContent = `${current + 1} / ${shots.length}`; prev.disabled = track.scrollLeft <= 2; next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2; };
    const move = delta => track.scrollTo({left: shots[Math.max(0, Math.min(shots.length - 1, current + delta))].offsetLeft - shots[0].offsetLeft, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
    prev.addEventListener('click', () => move(-1)); next.addEventListener('click', () => move(1));
    track.addEventListener('scroll', update, {passive: true});
    track.addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); move(e.key === 'ArrowRight' ? 1 : -1); } });
    new ResizeObserver(update).observe(track); update();
  });
})();
