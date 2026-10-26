// A short-lived, inked comic brush for the Neon shop. No replacement cursor.
export function installComicPointer({reducedMotion, finePointer}) {
  const root = document.documentElement;
  const panel = document.getElementById('neon-panel');
  const strokes = [], sparks = [], bursts = [];
  let canvas, ctx, frame = 0, width = 0, height = 0;
  let pending, previous, lastSpark = 0, lastBurst = -Infinity, serial = 0;
  let paletteKey, palette;
  const enabled = () => root.dataset.app === 'neon' && finePointer.matches && !reducedMotion() && !document.hidden;
  const ink = '#071426';
  const limit = (list, item, maximum) => { if (list.length >= maximum) list.shift(); list.push(item); };

  function colors() {
    if (!palette || paletteKey !== root.dataset.theme) {
      const style = getComputedStyle(panel);
      palette = ['--cyan', '--yellow', '--coral', '--ink'].map(name => style.getPropertyValue(name).trim());
      paletteKey = root.dataset.theme;
    }
    return palette;
  }

  function resize() {
    if (!canvas) return;
    width = innerWidth; height = innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, 2, Math.sqrt(3000000 / Math.max(1, width * height)));
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function wake() {
    if (frame || !enabled() || !panel) return;
    if (!canvas) {
      canvas = document.createElement('canvas');
      ctx = canvas.getContext('2d');
      if (!ctx) { canvas = undefined; return; }
      canvas.className = 'pointer-flourishes';
      canvas.dataset.comicPointer = '';
      canvas.setAttribute('aria-hidden', 'true');
      document.body.append(canvas);
      resize();
    }
    frame = requestAnimationFrame(draw);
  }

  function polygon(points, fill, outline = ink, lineWidth = 2) {
    ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    if (outline) { ctx.strokeStyle = outline; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }

  function star(radius, points = 4, inner = .26) {
    return Array.from({length:points * 2}, (_, i) => {
      const angle = i * Math.PI / points - Math.PI / 2;
      const r = radius * (i % 2 ? inner : 1);
      return [Math.cos(angle) * r, Math.sin(angle) * r];
    });
  }

  function emit(point, now) {
    if (!previous || now - previous.time > 110 || Math.hypot(point.x - previous.x, point.y - previous.y) > 240) {
      previous = {...point, time:now}; return;
    }
    const dx = point.x - previous.x, dy = point.y - previous.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 5) return;
    const angle = Math.atan2(dy, dx);
    // The tip stops just behind the native pointer; the ink follows its actual route.
    limit(strokes, {x:previous.x, y:previous.y, dx, dy, angle, distance, start:now,
      size:Math.min(9, 3 + distance * .09), color:colors()[0]}, 26);
    if (now - lastSpark > 38) {
      const side = serial % 2 ? 1 : -1, offset = 10 + Math.random() * 12;
      limit(sparks, {x:point.x - dx * .45 - Math.sin(angle) * offset * side,
        y:point.y - dy * .45 + Math.cos(angle) * offset * side,
        angle:angle + (serial % 3 === 0 ? Math.PI / 2 : 0), start:now,
        size:6 + Math.random() * 5, shape:serial % 4, side,
        color:colors()[(serial++ % 3)]}, 40);
      lastSpark = now;
    }
    previous = {...point, time:now};
  }

  function drawStroke(p, now) {
    const t = (now - p.start) / 290;
    if (t >= 1) return false;
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
    ctx.globalAlpha = (1 - t) ** 1.4;
    const s = p.size * (1 - t * .5), length = p.distance;
    // Hard offset print shadow, tapered cyan ink, and two satellite speed lines.
    polygon([[0, 3], [length, -s + 3], [length, s + 3]], ink, null);
    polygon([[0, 0], [length, -s * .7], [length, s * .7]], p.color, ink, 1.3);
    polygon([[length * .15, -s - 5], [length * .95, -s - 7], [length * .7, -s - 3]], colors()[1], null);
    polygon([[length * .3, s + 7], [length * .85, s + 4], [length * .65, s + 8]], colors()[2], null);
    ctx.restore(); return true;
  }

  function drawSpark(p, now) {
    const t = (now - p.start) / 520;
    if (t >= 1) return false;
    ctx.save();
    ctx.translate(p.x + Math.cos(p.angle + Math.PI / 2) * t * 10 * p.side,
      p.y + Math.sin(p.angle + Math.PI / 2) * t * 10 * p.side + t * t * 10);
    ctx.rotate(p.angle + p.side * t * .45);
    const scale = Math.min(1, (1 - t) * 2.3);
    ctx.scale(scale, scale); ctx.globalAlpha = Math.min(1, (1 - t) * 2);
    const s = p.size;
    ctx.lineJoin = 'miter';
    if (p.shape === 0) polygon(star(s * 1.35), p.color);
    else if (p.shape === 1) {
      polygon([[-s, -s * .25], [s * .1, -s * .3], [-s * .15, -s],
        [s, s * .15], [-s * .05, s * .1], [s * .25, s]], p.color);
    } else if (p.shape === 2) {
      polygon([[0, -s], [s * .6, 0], [0, s], [-s * .6, 0]], p.color);
      ctx.fillStyle = colors()[3]; ctx.fillRect(-1, -s * .5, 2, s * .45);
    } else {
      // Ben-Day dots are printed in a tiny triangular cluster, not a glow.
      ctx.fillStyle = p.color;
      for (let row = 0; row < 3; row++) for (let col = 0; col <= row; col++) {
        ctx.beginPath(); ctx.arc((col - row / 2) * 5, row * 5 - 5, 1.7 - row * .2, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore(); return true;
  }

  function drawBurst(p, now) {
    const t = (now - p.start) / 680;
    if (t >= 1) return false;
    ctx.save(); ctx.translate(p.x, p.y - 30 - t * 18); ctx.rotate(p.angle);
    const pop = t < .15 ? .45 + .65 * Math.sin(t / .15 * Math.PI / 2) : 1.1 - (t - .15) * .15;
    ctx.scale(pop, pop); ctx.globalAlpha = Math.min(1, (1 - t) * 3);
    const points = star(1, 11, .6).map(([x, y]) => [x * 57, y * 32]);
    ctx.save(); ctx.translate(4, 5); polygon(points, ink); ctx.restore();
    polygon(points, p.color, ink, 2.5);
    // Offset misregistration makes the caption look screen-printed.
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'italic 950 22px system-ui, sans-serif';
    ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = ink;
    ctx.strokeText(p.word, 0, 1); ctx.fillStyle = colors()[3]; ctx.fillText(p.word, 0, 1);
    ctx.fillStyle = ink; ctx.fillText(p.word, -1, -1);
    for (let i = 0; i < 7; i++) {
      const a = i * Math.PI * 2 / 7 + p.angle;
      ctx.save(); ctx.translate(Math.cos(a) * (68 + t * 22), Math.sin(a) * (45 + t * 18)); ctx.rotate(a);
      polygon([[0, -2], [11 * (1 - t), 0], [0, 2]], colors()[i % 3], null); ctx.restore();
    }
    ctx.restore(); return true;
  }

  function draw(now) {
    frame = 0;
    if (!enabled()) { clear(); return; }
    if (pending) { emit(pending, now); pending = undefined; }
    ctx.clearRect(0, 0, width, height);
    // Paint oldest to newest, so fresh ink always has a clean, bright edge.
    for (const [list, paint] of [[strokes, drawStroke], [sparks, drawSpark], [bursts, drawBurst]]) {
      for (let i = list.length - 1; i >= 0; i--) if (now - list[i].start > 700) list.splice(i, 1);
      for (let i = 0; i < list.length; i++) if (!paint(list[i], now)) { list.splice(i, 1); i--; }
    }
    if (strokes.length || sparks.length || bursts.length || pending) wake();
  }

  function clear() {
    cancelAnimationFrame(frame); frame = 0;
    strokes.length = sparks.length = bursts.length = 0;
    pending = previous = undefined;
    if (ctx) ctx.clearRect(0, 0, width, height);
  }

  document.addEventListener('pointermove', event => {
    if (!enabled() || !event.isPrimary || event.pointerType === 'touch') return;
    if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable="true"]')) {
      previous = pending = undefined; return;
    }
    pending = {x:event.clientX, y:event.clientY}; wake();
  }, {passive:true});
  document.addEventListener('click', event => {
    if (!enabled() || !event.detail || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    if (event.target instanceof Element && event.target.closest('input, textarea, select, label, [contenteditable="true"]')) return;
    const now = performance.now();
    if (now - lastBurst < 220) return;
    wake();
    if (!ctx) return;
    lastBurst = now;
    const words = root.lang.startsWith('ru') ? ['БАМ!', 'ВЖУХ!', 'ПАУ!'] : ['POW!', 'ZAP!', 'BAM!'];
    limit(bursts, {x:Math.max(70, Math.min(width - 70, event.clientX)),
      y:Math.max(78, Math.min(height - 35, event.clientY)), start:now,
      word:words[serial % words.length], color:colors()[1 + serial++ % 2], angle:(Math.random() - .5) * .28}, 3);
    for (let i = 0; i < 9; i++) {
      const a = i * Math.PI * 2 / 9;
      limit(sparks, {x:event.clientX + Math.cos(a) * 24, y:event.clientY + Math.sin(a) * 24,
        start:now, size:7 + Math.random() * 5, angle:a, side:i % 2 ? 1 : -1,
        shape:i % 3, color:colors()[i % 3]}, 40);
    }
    wake();
  }, {passive:true});
  window.addEventListener('raccoon:appchange', clear);
  window.addEventListener('blur', clear);
  window.addEventListener('pagehide', clear);
  window.addEventListener('scroll', clear, {passive:true});
  window.addEventListener('resize', () => { clear(); resize(); }, {passive:true});
  finePointer.addEventListener('change', clear);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); });
  root.addEventListener('pointerleave', () => { pending = previous = undefined; });
  return {clear};
}
