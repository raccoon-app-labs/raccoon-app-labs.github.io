/* One short-lived animation clock for hovered catalog covers and their return. */
export function installBookCoverTilt(dialog) {
  const root = document.documentElement;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const states = new Map();
  const metrics = new WeakMap();
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  let frame = 0, lastTime = 0, hovered = null, pointer = null, epoch = 0, scrolling = false, scrollTimer = 0, grid = null;
  const enabled = () => dialog.open && !document.hidden && fine.matches && !motion.matches && root.dataset.motion !== 'reduced' && (!root.dataset.app || root.dataset.app === 'stories');
  function clear(state) {
    state.art.style.removeProperty('transform'); state.art.style.removeProperty('box-shadow');
    state.glare.style.removeProperty('opacity'); state.lightNode.style.removeProperty('transform');
    delete state.art.dataset.coverTilt;
    states.delete(state.book);
  }
  function reset() {
    cancelAnimationFrame(frame); clearTimeout(scrollTimer); frame = 0; lastTime = 0; hovered = null; pointer = null; scrolling = false; epoch++;
    for (const state of states.values()) clear(state);
  }
  function schedule() { if (!frame && states.size) frame = requestAnimationFrame(draw); }
  function release() { hovered = null; pointer = null; schedule(); }
  function invalidate() { epoch++; schedule(); }
  const resize = new ResizeObserver(invalidate);
  resize.observe(dialog);
  function refresh() {
    const next = dialog.querySelector('.magic-books');
    if (next !== grid) { if (grid) resize.unobserve(grid); grid = next; if (grid) resize.observe(grid); }
    invalidate();
  }
  function measure(book, art) {
    let item = metrics.get(book);
    if (!item || item.epoch !== epoch) {
      const bounds = book.getBoundingClientRect();
      item = {epoch, left:bounds.left + book.clientLeft + art.offsetLeft, top:bounds.top + book.clientTop + art.offsetTop, width:Math.max(1, art.offsetWidth), height:Math.max(1, art.offsetHeight)};
      metrics.set(book, item);
    }
    return item;
  }
  function write(state, key, node, property, value) {
    if (state.rendered[key] !== value) { node.style[property] = value; state.rendered[key] = value; }
  }
  function draw(now) {
    frame = 0;
    if (!enabled()) { reset(); return; }
    const delta = lastTime ? clamp(now - lastTime, 1, 48) : 16.667;
    lastTime = now;
    let moving = false; const plans = [];
    // Read changed geometry once, before writing any cover styles. Pointer movement alone
    // never invalidates these stationary hit boxes, including while another cover returns.
    for (const state of states.values()) {
      const {book, art} = state;
      if (!book.isConnected || book.hidden || book.disabled) { clear(state); continue; }
      const tracking = !scrolling && hovered === book && pointer;
      const bounds = tracking ? measure(book, art) : null;
      const x = tracking ? clamp((pointer.x - bounds.left) / bounds.width, 0, 1) : .5;
      const y = tracking ? clamp((pointer.y - bounds.top) / bounds.height, 0, 1) : .5;
      const targets = {x:tracking ? -(y * 2 - 1) * 5 : 0, y:tracking ? (x * 2 - 1) * 7 : 0, lift:tracking ? -5 : 0, light:tracking ? 1 : 0, lightX:x * 100, lightY:y * 100};
      plans.push({state, tracking, targets});
    }
    for (const {state, tracking, targets} of plans) {
      const {art, glare, lightNode} = state;
      const ease = 1 - Math.exp(-delta / (tracking ? 110 : 220));
      let settled = true;
      for (const key of Object.keys(targets)) {
        const difference = targets[key] - state[key];
        if (Math.abs(difference) < .01) state[key] = targets[key];
        else { state[key] += difference * ease; settled = false; }
      }
      if (!tracking && settled) { clear(state); continue; }
      const phase = tracking ? 'active' : 'returning';
      if (art.dataset.coverTilt !== phase) art.dataset.coverTilt = phase;
      write(state, 'tilt', art, 'transform', `perspective(850px) translateY(calc(${state.lift.toFixed(3)}px + var(--book-rest-lift,0px))) rotateX(${state.x.toFixed(3)}deg) rotateY(${state.y.toFixed(3)}deg)`);
      write(state, 'shadow', art, 'boxShadow', `3px 2px 0 #dfcfb8,5px 4px 0 #795c7f,7px ${(10 + state.light * 6).toFixed(3)}px 18px #07030f60,0 0 ${(state.light * 22).toFixed(3)}px #edc58324`);
      write(state, 'glare', glare, 'opacity', (state.light * .55).toFixed(4));
      // A farthest-corner ellipse is the same prepainted centered glow, translated and
      // scaled to the pointer. Compositing moves it without repainting the image or text.
      const scaleX = Math.max(state.lightX, 100 - state.lightX) / 50;
      const scaleY = Math.max(state.lightY, 100 - state.lightY) / 50;
      write(state, 'light', lightNode, 'transform', `translate3d(${(state.lightX - 50).toFixed(3)}%,${(state.lightY - 50).toFixed(3)}%,0) scale(${scaleX.toFixed(5)},${scaleY.toFixed(5)})`);
      if (!settled) moving = true;
    }
    if (moving) schedule(); else lastTime = 0;
  }
  dialog.addEventListener('pointermove', event => {
    if (!enabled() || event.pointerType === 'touch') { reset(); return; }
    if (scrolling) return;
    const book = event.target.closest('.magic-book');
    if (!book || !dialog.contains(book) || book.hidden || book.disabled) { release(); return; }
    const art = book.querySelector('.magic-book-art');
    if (!art) { release(); return; }
    if (!states.has(book)) {
      const glare = art.querySelector('.magic-book-glare'), lightNode = glare?.querySelector('.magic-book-light');
      if (!glare || !lightNode) return;
      states.set(book, {book, art, glare, lightNode, rendered:{}, x:0, y:0, lift:0, light:0, lightX:50, lightY:50});
    }
    hovered = book; pointer = {x:event.clientX, y:event.clientY}; schedule();
  }, {passive:true});
  dialog.addEventListener('pointerleave', release);
  dialog.addEventListener('pointercancel', reset);
  dialog.addEventListener('scroll', () => {
    // Return gracefully while scrolling; repeated wheel events don't tear down layers.
    scrolling = true; epoch++; release(); clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => { scrolling = false; }, 140);
  }, {passive:true, capture:true});
  dialog.addEventListener('scrollend', () => { clearTimeout(scrollTimer); scrolling = false; }, {passive:true});
  dialog.addEventListener('animationend', event => {
    if (event.animationName === 'magic-shelf-arrive') { metrics.delete(event.target); schedule(); }
  });
  dialog.addEventListener('close', reset);
  addEventListener('blur', reset);
  addEventListener('resize', reset, {passive:true});
  addEventListener('pagehide', reset);
  document.addEventListener('visibilitychange', reset);
  motion.addEventListener('change', reset); fine.addEventListener('change', reset);
  new MutationObserver(reset).observe(root, {attributes:true, attributeFilter:['data-motion', 'data-app']});
  document.fonts?.ready.then(invalidate);
  return {reset, refresh};
}
