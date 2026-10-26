/* One short-lived animation clock for hovered catalog covers and their return. */
export function installBookCoverTilt(dialog) {
  const root = document.documentElement;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const states = new Map();
  const properties = ['--book-tilt-x', '--book-tilt-y', '--book-lift', '--book-light', '--book-light-x', '--book-light-y'];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  let frame = 0, lastTime = 0, hovered = null, pointer = null;
  const enabled = () => dialog.open && !document.hidden && fine.matches && !motion.matches && root.dataset.motion !== 'reduced' && (!root.dataset.app || root.dataset.app === 'stories');
  function clear(state) {
    for (const property of properties) state.art.style.removeProperty(property);
    delete state.art.dataset.coverTilt;
    states.delete(state.book);
  }
  function reset() {
    cancelAnimationFrame(frame); frame = 0; lastTime = 0; hovered = null; pointer = null;
    for (const state of states.values()) clear(state);
  }
  function schedule() { if (!frame && states.size) frame = requestAnimationFrame(draw); }
  function release() { hovered = null; pointer = null; schedule(); }
  function draw(now) {
    frame = 0;
    if (!enabled()) { reset(); return; }
    const delta = lastTime ? clamp(now - lastTime, 1, 48) : 16.667;
    lastTime = now;
    let moving = false;
    for (const state of states.values()) {
      const {book, art} = state;
      if (!book.isConnected || book.hidden || book.disabled) { clear(state); continue; }
      const tracking = hovered === book && pointer;
      // The button is a stationary hit target; tilted cover bounds never feed back into angles.
      const bounds = book.getBoundingClientRect();
      const left = bounds.left + book.clientLeft + art.offsetLeft;
      const top = bounds.top + book.clientTop + art.offsetTop;
      const x = tracking ? clamp((pointer.x - left) / Math.max(1, art.offsetWidth), 0, 1) : .5;
      const y = tracking ? clamp((pointer.y - top) / Math.max(1, art.offsetHeight), 0, 1) : .5;
      const targets = {x:tracking ? -(y * 2 - 1) * 5 : 0, y:tracking ? (x * 2 - 1) * 7 : 0, lift:tracking ? -5 : 0, light:tracking ? 1 : 0, lightX:x * 100, lightY:y * 100};
      const ease = 1 - Math.exp(-delta / (tracking ? 110 : 220));
      let settled = true;
      for (const key of Object.keys(targets)) {
        const difference = targets[key] - state[key];
        if (Math.abs(difference) < .01) state[key] = targets[key];
        else { state[key] += difference * ease; settled = false; }
      }
      if (!tracking && settled) { clear(state); continue; }
      art.dataset.coverTilt = tracking ? 'active' : 'returning';
      for (const [property, value] of Object.entries({'--book-tilt-x':state.x.toFixed(3) + 'deg', '--book-tilt-y':state.y.toFixed(3) + 'deg', '--book-lift':state.lift.toFixed(3) + 'px', '--book-light':state.light.toFixed(3), '--book-light-x':state.lightX.toFixed(2) + '%', '--book-light-y':state.lightY.toFixed(2) + '%'})) art.style.setProperty(property, value);
      if (!settled) moving = true;
    }
    if (moving) schedule(); else lastTime = 0;
  }
  dialog.addEventListener('pointermove', event => {
    if (!enabled() || event.pointerType === 'touch') { reset(); return; }
    const book = event.target.closest('.magic-book');
    if (!book || !dialog.contains(book) || book.hidden || book.disabled) { release(); return; }
    const art = book.querySelector('.magic-book-art');
    if (!art) { release(); return; }
    if (!states.has(book)) states.set(book, {book, art, x:0, y:0, lift:0, light:0, lightX:50, lightY:50});
    hovered = book; pointer = {x:event.clientX, y:event.clientY}; schedule();
  }, {passive:true});
  dialog.addEventListener('pointerleave', release);
  dialog.addEventListener('pointercancel', reset);
  dialog.addEventListener('scroll', reset, {passive:true, capture:true});
  dialog.addEventListener('close', reset);
  addEventListener('blur', reset);
  addEventListener('resize', reset, {passive:true});
  addEventListener('pagehide', reset);
  document.addEventListener('visibilitychange', reset);
  motion.addEventListener('change', reset); fine.addEventListener('change', reset);
  new MutationObserver(reset).observe(root, {attributes:true, attributeFilter:['data-motion', 'data-app']});
  return {reset};
}
