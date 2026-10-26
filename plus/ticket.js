// A decorative handoff to the existing checkout URL; no payment logic lives here.
export function installTicketTear({reducedMotion}) {
  const card = document.querySelector('.plus-pass');
  const stub = card.querySelector('.pass-checkout');
  const body = card.querySelector('.pass-body');
  const link = stub.querySelector('a[data-checkout]');
  let active = null;

  function reset({focus = false} = {}) {
    const session = active;
    if (!session) return;
    active = null;
    clearTimeout(session.timer); clearTimeout(session.restoreTimer);
    session.animations.forEach(animation => animation.cancel());
    session.decorations.forEach(node => node.remove());
    card.classList.remove('is-tearing'); card.removeAttribute('aria-busy');
    link.removeAttribute('aria-disabled');
    body.style.removeProperty('clip-path'); stub.style.removeProperty('clip-path');
    body.style.removeProperty('transform-origin'); stub.style.removeProperty('transform-origin');
    document.getElementById('app-announcement').textContent = session.announcement;
    if (focus) link.focus({preventScroll:true});
  }

  function finish() {
    const session = active;
    if (!session || session.navigating) return;
    session.navigating = true;
    clearTimeout(session.timer);
    // Restore if a browser's beforeunload prompt cancels this navigation.
    session.restoreTimer = setTimeout(() => reset(), 2200);
    try { location.assign(session.href); } catch { reset({focus:true}); }
  }

  function edge(length, depth, horizontal, reverse = false) {
    const count = Math.max(2, Math.ceil(length / 8));
    const points = Array.from({length:count + 1}, (_, i) => {
      const along = i / count * length;
      const notch = i % 2 ? 4 : 0;
      return horizontal ? [along, depth(notch)] : [depth(notch), along];
    });
    return reverse ? points.reverse() : points;
  }

  function tearEdges(horizontal) {
    const a = body.getBoundingClientRect(), b = stub.getBoundingClientRect();
    const left = horizontal
      ? [[0,0], [a.width,0], ...edge(a.width, n => a.height - n, true, true)]
      : [[0,0], ...edge(a.height, n => a.width - n, false), [0,a.height]];
    const right = horizontal
      ? [...edge(b.width, n => n, true), [b.width,b.height], [0,b.height]]
      : [[b.width,0], [b.width,b.height], ...edge(b.height, n => n, false, true)];
    const polygon = points => 'polygon(' + points.map(([x,y]) => `${x}px ${y}px`).join(',') + ')';
    body.style.clipPath = polygon(left); stub.style.clipPath = polygon(right);
  }

  link.addEventListener('click', event => {
    // Keep new-tab gestures and the native, immediate reduced-motion route.
    if (event.defaultPrevented || event.button > 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (active) { event.preventDefault(); return; }
    if (reducedMotion() || typeof stub.animate !== 'function') return;
    const destination = new URL(link.href, location.href);
    if (destination.origin !== location.origin || link.target === '_blank' || link.hasAttribute('download')) return;
    event.preventDefault();
    const session = {href:destination.href, animations:[], decorations:[], timer:0, restoreTimer:0, navigating:false,
      announcement:document.getElementById('app-announcement').textContent};
    active = session;
    try {
      // A fast click after scrolling should tear a fully visible ticket,
      // even if the section's entrance transition is still running.
      card.closest('.pass-section')?.classList.remove('will-reveal');
      const bounds = card.getBoundingClientRect(), stubBounds = stub.getBoundingClientRect();
      const horizontal = matchMedia('(max-width:520px)').matches;
      const seamX = horizontal ? 0 : stubBounds.left - bounds.left;
      const seamY = horizontal ? stubBounds.top - bounds.top : 0;
      const length = horizontal ? bounds.width : bounds.height;
      card.classList.add('is-tearing'); card.setAttribute('aria-busy', 'true');
      link.setAttribute('aria-disabled', 'true');
      document.getElementById('app-announcement').textContent = 'Opening checkout…';
      tearEdges(horizontal);
      body.style.transformOrigin = horizontal ? '50% 100%' : '100% 50%';
      stub.style.transformOrigin = horizontal ? '100% 0' : '0 100%';
      const animate = (node, frames, options) => {
        const animation = node.animate(frames, options);
        session.animations.push(animation);
        return animation;
      };
      animate(body, [{transform:'rotate(0)'}, {transform:`rotate(${horizontal ? '.5' : '-.5'}deg)`, offset:.38},
        {transform:'rotate(0)'}], {duration:650, easing:'ease-out'});
      const flight = animate(stub, horizontal ? [
        {transform:'translate(0,0) rotate(0deg)', opacity:1},
        {transform:'translate(0,5px) rotate(-2deg)', opacity:1, offset:.25},
        {transform:'translate(2px,24px) rotate(-5deg)', opacity:1, offset:.6},
        {transform:'translate(16px,82px) rotate(-10deg)', opacity:0}
      ] : [
        {transform:'translate(0,0) rotate(0deg)', opacity:1},
        {transform:'translate(3px,-1px) rotate(2deg)', opacity:1, offset:.25},
        {transform:'translate(22px,-5px) rotate(5deg)', opacity:1, offset:.6},
        {transform:'translate(92px,-18px) rotate(11deg)', opacity:0}
      ], {duration:760, easing:'cubic-bezier(.3,.1,.4,1)', fill:'forwards'});

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.classList.add('ticket-tear-seam'); svg.setAttribute('aria-hidden', 'true');
      const w = horizontal ? length : 16, h = horizontal ? 16 : length;
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      Object.assign(svg.style, {left:(seamX - (horizontal ? 0 : 8)) + 'px',
        top:(seamY - (horizontal ? 8 : 0)) + 'px', width:w + 'px', height:h + 'px'});
      const path = document.createElementNS(svg.namespaceURI, 'path');
      const points = edge(length, n => 8 + n * .65, horizontal);
      path.setAttribute('d', points.map(([x,y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' '));
      path.classList.add('ticket-cut'); svg.append(path); card.append(svg); session.decorations.push(svg);
      const distance = path.getTotalLength(); path.style.strokeDasharray = String(distance);
      animate(path, [{strokeDashoffset:distance}, {strokeDashoffset:0}], {duration:410, easing:'linear', fill:'both'});
      for (let i = 0; i < 11; i++) {
        const fiber = document.createElement('i');
        fiber.className = 'ticket-fiber'; fiber.setAttribute('aria-hidden', 'true');
        const along = length * (i + 1) / 12;
        Object.assign(fiber.style, {left:(horizontal ? along : seamX) + 'px', top:(horizontal ? seamY : along) + 'px'});
        card.append(fiber); session.decorations.push(fiber);
        animate(fiber, [{opacity:0, transform:'translate(0,0) rotate(0deg)'}, {opacity:1, offset:.15},
          {opacity:0, transform:`translate(${horizontal ? (i % 2 ? 12 : -9) : 12 + i % 3 * 5}px,${horizontal ? 17 + i % 3 * 5 : i % 2 ? 9 : -9}px) rotate(${i * 39}deg) scale(.3)`}],
          {duration:310, delay:i * 31, easing:'ease-out', fill:'both'});
      }
      session.timer = setTimeout(finish, 1050);
      flight.finished.then(() => { if (active === session) finish(); }, () => {
        if (active === session && !session.navigating) reset();
      });
    } catch { finish(); }
  });

  window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && active && !active.navigating) { event.preventDefault(); reset({focus:true}); }
  });
  window.addEventListener('resize', finish, {passive:true});
  document.addEventListener('visibilitychange', () => { if (document.hidden) finish(); });
  window.addEventListener('pagehide', () => reset());
  window.addEventListener('pageshow', event => { if (event.persisted) reset(); });
  return {finish, cancel:() => reset()};
}
