// Small, temporary flourishes. Native pointers, focus and navigation stay intact.
export function installStoreEffects({reducedMotion, finePointer}) {
  let canvas, context, frame = 0, pendingPointer, lastPoint, paletteApp, palette;
  let width = 0, height = 0, lastEmission = 0;
  const pieces = [], animations = new Set(), presses = new WeakMap();
  const controls = 'a[href], button, summary';

  function colors() {
    const app = document.documentElement.dataset.app;
    if (paletteApp !== app) {
      const style = getComputedStyle(document.documentElement);
      palette = ['--accent', '--mint', '--ink'].map(name => style.getPropertyValue(name).trim());
      paletteApp = app;
    }
    return palette;
  }

  function resize() {
    if (!canvas) return;
    width = innerWidth; height = innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, 2, Math.sqrt(4000000 / (width * height)));
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    lastPoint = undefined;
  }

  function prepare() {
    if (canvas) return true;
    canvas = document.createElement('canvas');
    context = canvas.getContext('2d');
    if (!context) { canvas = undefined; return false; }
    canvas.className = 'pointer-flourishes';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.append(canvas);
    resize();
    return true;
  }

  function wake() {
    if (!frame && !reducedMotion() && !document.hidden && prepare()) frame = requestAnimationFrame(draw);
  }

  function addPiece(x, y, {burst = false, angle = 0, index = 0} = {}) {
    if (pieces.length >= 72) pieces.shift();
    const speed = burst ? 22 + Math.random() * 30 : 7 + Math.random() * 12;
    pieces.push({x, y, start:performance.now(), duration:burst ? 620 : 760,
      vx:Math.cos(angle) * speed, vy:Math.sin(angle) * speed - (burst ? 13 : 8),
      size:burst ? 3 + Math.random() * 3 : 3 + Math.random() * 3,
      angle:angle + Math.PI / 4, spin:(Math.random() - .5) * 2,
      color:colors()[index % 3], shape:index % 3,
      keys:document.documentElement.dataset.app === 'keys'});
  }

  function draw(now) {
    frame = 0;
    if (reducedMotion() || document.hidden) { clear(); return; }
    if (pendingPointer) {
      const point = pendingPointer; pendingPointer = undefined;
      const distance = lastPoint ? Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) : 0;
      if (now - lastEmission > 24 && (!lastPoint || distance > 10)) {
        const count = lastPoint && distance < 120 ? Math.min(4, Math.ceil(distance / 18)) : 1;
        const angle = lastPoint ? Math.atan2(point.y - lastPoint.y, point.x - lastPoint.x) : 0;
        for (let i = 1; i <= count; i++) {
          const mix = i / count;
          addPiece(lastPoint && count > 1 ? lastPoint.x + (point.x - lastPoint.x) * mix : point.x,
            lastPoint && count > 1 ? lastPoint.y + (point.y - lastPoint.y) * mix : point.y,
            {angle:angle + Math.PI, index:Math.floor(now / 24) + i});
        }
        lastEmission = now; lastPoint = point;
      }
    }
    context.clearRect(0, 0, width, height);
    for (let i = pieces.length - 1; i >= 0; i--) {
      const p = pieces[i], progress = (now - p.start) / p.duration;
      if (progress >= 1) { pieces.splice(i, 1); continue; }
      const travel = 1 - (1 - progress) ** 3;
      context.save();
      context.translate(p.x + p.vx * travel, p.y + p.vy * travel + progress * progress * 12);
      context.rotate(p.angle + p.spin * progress);
      context.scale(1 - progress * .6, 1 - progress * .6);
      context.globalAlpha = Math.min(1, progress * 10) * (1 - progress) * .9;
      context.fillStyle = p.color;
      context.beginPath();
      if (p.shape === 0) {
        // Four-point glint, rather than a circular ripple.
        for (let j = 0; j < 8; j++) {
          const a = j * Math.PI / 4, r = p.size * (j % 2 ? .28 : 1.3);
          if (j) context.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          else context.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        context.closePath();
      } else if (p.keys) {
        context.rect(-p.size, -p.size / 3, p.size * 2, p.size * .66);
      } else {
        context.ellipse(0, 0, p.size, p.size * .48, 0, 0, Math.PI * 2);
      }
      context.fill(); context.restore();
    }
    if (pieces.length || pendingPointer) wake();
  }

  function track(animation) {
    animations.add(animation);
    animation.finished.then(() => animations.delete(animation), () => animations.delete(animation));
    return animation;
  }

  function controlFor(event) {
    const control = event.target instanceof Element ? event.target.closest(controls) : null;
    return control && !control.matches(':disabled, [aria-disabled="true"]') ? control : null;
  }

  document.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch' || !event.isPrimary || !finePointer.matches || reducedMotion()) return;
    pendingPointer = {x:event.clientX, y:event.clientY}; wake();
  }, {passive:true});
  document.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    const control = controlFor(event);
    if (!control) return;
    control.classList.add('fx-pressed');
    if (!reducedMotion()) {
      presses.get(control)?.cancel();
      presses.set(control, track(control.animate([{scale:'1'}, {scale:'.96'}],
        {duration:110, fill:'forwards', easing:'ease-out'})));
    }
  }, {passive:true});

  function release() {
    document.querySelectorAll('.fx-pressed').forEach(control => {
      control.classList.remove('fx-pressed');
      presses.get(control)?.cancel(); presses.delete(control);
    });
  }
  window.addEventListener('pointerup', release, {passive:true});
  window.addEventListener('pointercancel', release, {passive:true});
  window.addEventListener('blur', () => { release(); clear(); });
  document.addEventListener('click', event => {
    const control = controlFor(event);
    if (!control || reducedMotion()) return;
    track(control.animate([{scale:'.96', rotate:'0deg'}, {scale:'1.035', rotate:'-.8deg', offset:.4},
      {scale:'1', rotate:'0deg'}], {duration:380, easing:'cubic-bezier(.2,.8,.2,1)'}));
    const rect = control.getBoundingClientRect();
    const x = event.detail ? event.clientX : rect.left + rect.width / 2;
    const y = event.detail ? event.clientY : rect.top + rect.height / 2;
    for (let i = 0; i < 12; i++) addPiece(x, y, {burst:true, angle:i / 12 * Math.PI * 2, index:i});
    wake();
  }, {passive:true});

  function clear() {
    cancelAnimationFrame(frame); frame = 0;
    pieces.length = 0; pendingPointer = lastPoint = undefined;
    if (context) context.clearRect(0, 0, width, height);
    animations.forEach(animation => animation.cancel()); animations.clear();
    release();
  }
  window.addEventListener('resize', () => { clear(); resize(); }, {passive:true});
  document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); });
  window.addEventListener('pagehide', clear);
  document.documentElement.addEventListener('pointerleave', () => { lastPoint = pendingPointer = undefined; });
  return {clear};
}
