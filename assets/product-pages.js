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
    let current = 0, frame = 0, positions = [];
    const counter = carousel.querySelector('[data-carousel-count]');
    const update = () => {
      frame = 0;
      const left = track.scrollLeft, atEnd = left + track.clientWidth >= track.scrollWidth - 2;
      current = positions.reduce((best, value, i) => Math.abs(value - left) < Math.abs(positions[best] - left) ? i : best, 0);
      const text = `${current + 1} / ${shots.length}`;
      if (counter.textContent !== text) counter.textContent = text;
      if (prev.disabled !== (left <= 2)) prev.disabled = left <= 2;
      if (next.disabled !== atEnd) next.disabled = atEnd;
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const measure = () => { const first = shots[0]?.offsetLeft || 0; positions = shots.map(shot => shot.offsetLeft - first); schedule(); };
    const move = delta => track.scrollTo({left: shots[Math.max(0, Math.min(shots.length - 1, current + delta))].offsetLeft - shots[0].offsetLeft, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
    prev.addEventListener('click', () => move(-1)); next.addEventListener('click', () => move(1));
    track.addEventListener('scroll', schedule, {passive: true});
    track.addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); move(e.key === 'ArrowRight' ? 1 : -1); } });
    new ResizeObserver(measure).observe(track); measure();
  });
})();
