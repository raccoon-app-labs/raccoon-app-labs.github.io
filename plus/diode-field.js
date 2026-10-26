/* Electricity travels between the existing background dots, behind all content. */
(() => {
  'use strict';
  const root = document.documentElement;
  const panel = document.getElementById('neon-panel');
  const hero = panel?.querySelector('.hero');
  if (!hero || panel.querySelector('.diode-field')) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const compact = matchMedia('(max-width:600px)');
  const canvas = document.createElement('canvas');
  canvas.className = 'diode-field';
  canvas.setAttribute('aria-hidden', 'true'); canvas.setAttribute('inert', '');
  const ctx = canvas.getContext('2d', {alpha:true});
  if (!ctx) return;
  panel.prepend(canvas);
  const base = document.createElement('canvas'), baseCtx = base.getContext('2d');
  if (!baseCtx) { canvas.remove(); return; }
  const STEP = 14, OFFSET = 7, MAX_LIT = 650;
  const directions = [[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[-1,-1],[1,-1]];
  const lamps = new Map(), runners = [], waves = [], capacitors = [];
  let width = 0, height = 0, cols = 0, rows = 0, ratio = 1, bounds, copy;
  let frame = 0, lastPaint = 0, clock = 0, nextRunner = 0, nextCapacitor = 4.2, entries = 0;
  let visible = false, closed = false, dirty = true, initialized = false;
  let theme, palette = [], sprites = [], pointer, lastInduction = -10, lastClick = -10;
  const random = (min, max) => min + Math.random() * (max - min);
  const integer = (min, max) => Math.floor(random(min, max + 1));
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const reduced = () => motion.matches || root.dataset.motion === 'reduced' || navigator.connection?.saveData === true;
  const active = () => root.dataset.app === 'neon' && visible && !document.hidden && !closed;
  const xy = (col, row) => [OFFSET + col * STEP, OFFSET + row * STEP];

  function updateBounds() {
    bounds = panel.getBoundingClientRect();
    const rect = hero.querySelector('.hero-copy').getBoundingClientRect();
    copy = {left:rect.left - bounds.left - 12, right:rect.right - bounds.left + 12,
      top:rect.top - bounds.top - 12, bottom:rect.bottom - bounds.top + 12};
  }

  function rebuild() {
    width = panel.clientWidth;
    if (!width) return false;
    height = Math.min(1300, Math.max(700, hero.offsetHeight + 80));
    cols = Math.max(2, Math.ceil(width / STEP)); rows = Math.max(2, Math.ceil(height / STEP));
    ratio = Math.min(devicePixelRatio || 1, 2, Math.sqrt(2400000 / (width * height)));
    canvas.width = base.width = Math.round(width * ratio);
    canvas.height = base.height = Math.round(height * ratio);
    canvas.style.setProperty('--diode-height', height + 'px');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    baseCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
    theme = root.dataset.theme;
    const style = getComputedStyle(panel);
    palette = ['--cyan','--yellow','--coral'].map(name => style.getPropertyValue(name).trim());
    const daylight = theme === 'light';
    if (daylight) palette = [style.getPropertyValue('--theme-accent').trim() || '#196c83','#a37815','#b85053'];
    baseCtx.fillStyle = daylight ? '#436f8b38' : '#47718f55';
    baseCtx.beginPath();
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
      const [x,y] = xy(col,row); baseCtx.moveTo(x + 1,y); baseCtx.arc(x,y,1,0,Math.PI * 2);
    }
    baseCtx.fill();
    sprites = palette.map(color => {
      const sprite = document.createElement('canvas'); sprite.width = sprite.height = 48;
      const paint = sprite.getContext('2d');
      const glow = paint.createRadialGradient(24,24,0,24,24,23);
      glow.addColorStop(0,color); glow.addColorStop(.12,color);
      glow.addColorStop(1,'transparent');
      paint.fillStyle = glow; paint.globalAlpha = daylight ? .26 : .42;
      paint.fillRect(0,0,48,48); return sprite;
    });
    updateBounds(); dirty = false;
    lamps.clear(); runners.length = waves.length = capacitors.length = 0;
    initialized = false; pointer = undefined;
    panel.dataset.diodeReady = '';
    paintBase(); return true;
  }

  function paintBase() {
    ctx.clearRect(0,0,width,height);
    ctx.drawImage(base,0,0,width,height);
  }

  function light(col,row,power = 1,color = 0) {
    if (col < 0 || col >= cols || row < 0 || row >= rows) return;
    const key = row * cols + col, old = lamps.get(key);
    if (old) { if (power > old.power) { old.power = power; old.color = color; } }
    else if (lamps.size < MAX_LIT) lamps.set(key,{col,row,power,color});
  }

  function launch(col,row,direction,color = 0,life = 72,fork = true) {
    if (runners.length >= (compact.matches ? 5 : 8)) return;
    runners.push({col:clamp(col,0,cols - 1),row:clamp(row,0,rows - 1),direction,color,
      progress:0,life,fork,steps:0,speed:random(17,24),path:[],turn:integer(7,12),
      heading:direction % 4,bend:0});
  }

  function enter() {
    const fromLeft = Math.random() > .5, col = fromLeft ? 0 : cols - 1;
    // Alternate the open top rail with the rest of the matrix, around the artwork.
    const row = entries++ % 2 ? integer(2,6) : integer(7,Math.max(7,rows - 9));
    launch(col,row,fromLeft ? 0 : 2,integer(0,2));
  }

  function diamond(col,row,radius,color,power) {
    for (let dx = -radius; dx <= radius; dx++) {
      const dy = radius - Math.abs(dx);
      light(col + dx,row + dy,power,color);
      if (dy) light(col + dx,row - dy,power,color);
    }
  }

  function advance(runner) {
    light(runner.col,runner.row,1,runner.color);
    runner.path.push([runner.col,runner.row]);
    if (runner.path.length > 8) runner.path.shift();
    runner.steps++; runner.life--;
    if (runner.bend > 0 && --runner.bend === 0) runner.direction = runner.heading;
    if (runner.steps % runner.turn === 0) {
      if (runner.fork && runner.steps === runner.turn * 2) {
        launch(runner.col,runner.row,(runner.direction + 1) % 4,(runner.color + 1) % 3,14,false);
      }
      // Grid-aligned right angles and forty-five-degree jumps, like a circuit board.
      runner.direction = (runner.heading + (Math.random() > .5 ? 1 : 3)) % 4;
      runner.bend = integer(2,4);
      if (Math.random() > .7) runner.direction += 4;
    }
    const [dx,dy] = directions[runner.direction];
    let col = runner.col + dx, row = runner.row + dy;
    if (col < 0 || col >= cols || row < 0 || row >= rows - 2) {
      runner.direction = (runner.direction + 2) % 4;
      runner.heading = runner.direction; runner.bend = 0;
      const back = directions[runner.direction]; col = runner.col + back[0]; row = runner.row + back[1];
    }
    runner.col = clamp(col,0,cols - 1); runner.row = clamp(row,0,rows - 3);
  }

  function paintRunner(runner,dt) {
    runner.progress += dt * runner.speed;
    while (runner.progress >= 1 && runner.life > 0) { advance(runner); runner.progress--; }
    if (!runner.life) return false;
    const last = runner.path.at(-1) || [runner.col,runner.row];
    const [sx,sy] = xy(...last), [ex,ey] = xy(runner.col,runner.row);
    const x = sx + (ex - sx) * runner.progress, y = sy + (ey - sy) * runner.progress;
    ctx.strokeStyle = palette[runner.color]; ctx.lineWidth = .75; ctx.globalAlpha = .32;
    ctx.beginPath();
    runner.path.forEach(([col,row],i) => { const p = xy(col,row); if (i) ctx.lineTo(...p); else ctx.moveTo(...p); });
    ctx.lineTo(x,y); ctx.stroke();
    ctx.globalAlpha = .8; ctx.drawImage(sprites[runner.color],x - 11,y - 11,22,22);
    ctx.fillStyle = theme === 'light' ? palette[runner.color] : '#ecfffc';
    ctx.beginPath(); ctx.arc(x,y,1.65,0,Math.PI * 2); ctx.fill();
    return true;
  }

  function capacitor() {
    // An eight-diode junction charges in a pinwheel, then releases four couriers.
    capacitors.push({col:integer(3,Math.max(3,cols - 4)),row:integer(3,Math.max(3,rows - 12)),
      age:0,color:integer(0,2),fired:false});
  }

  function update(dt) {
    clock += dt;
    if (!initialized) {
      launch(0,4,0,0); launch(cols - 1,8,2,2);
      launch(Math.floor(cols * .48),Math.floor(rows * .23),1,1,42);
      initialized = true; nextRunner = clock + .9; nextCapacitor = clock + 3;
    }
    if (clock > nextRunner) { enter(); nextRunner = clock + random(1.25,2.1); }
    if (clock > nextCapacitor && capacitors.length < 2) { capacitor(); nextCapacitor = clock + random(5,7.5); }
    for (const [key,led] of lamps) {
      led.power *= Math.exp(-dt * 2.7);
      if (led.power < .035) lamps.delete(key);
    }
    if (pointer) {
      const {col,row,expires} = pointer;
      if (clock < expires) {
        light(col,row,.9,0);
        for (const [dx,dy] of directions.slice(0,4)) light(col + dx,row + dy,.32,0);
      } else pointer = undefined;
    }
    for (let i = capacitors.length - 1; i >= 0; i--) {
      const p = capacitors[i]; p.age += dt;
      const ring = Math.floor(p.age * 12);
      for (let j = 0; j < Math.min(8,ring + 1); j++) {
        const [dx,dy] = directions[(j + ring) % 8]; light(p.col + dx * 2,p.row + dy * 2,.55,p.color);
      }
      light(p.col,p.row,.55 + Math.sin(p.age * 5) * .2,p.color);
      if (p.age > 1.3 && !p.fired) {
        p.fired = true;
        for (let d = 0; d < 4; d++) launch(p.col,p.row,d,(p.color + d) % 3,integer(16,28),false);
        if (waves.length < 4) waves.push({col:p.col,row:p.row,age:0,radius:0,max:6,color:p.color});
      }
      if (p.age > 1.6) capacitors.splice(i,1);
    }
    for (let i = waves.length - 1; i >= 0; i--) {
      const wave = waves[i]; wave.age += dt;
      const radius = Math.floor(wave.age * 13);
      if (radius > wave.radius) {
        for (let r = wave.radius + 1; r <= Math.min(radius,wave.max); r++) {
          diamond(wave.col,wave.row,r,wave.color,.72 * (1 - r / (wave.max + 3)));
        }
        wave.radius = radius;
      }
      if (radius >= wave.max) waves.splice(i,1);
    }
  }

  function draw(now) {
    frame = 0;
    if (!active() || reduced()) { sync(); return; }
    const elapsed = now - lastPaint;
    if (elapsed < (compact.matches ? 1000 / 24 : 1000 / 30)) { schedule(); return; }
    const dt = Math.min(.075,elapsed / 1000); lastPaint = now;
    update(dt); paintBase();
    for (const led of lamps.values()) {
      const [x,y] = xy(led.col,led.row);
      // Leave a quiet reading area; most of the energy lives in the open spaces.
      const shelter = x > copy.left && x < copy.right && y > copy.top && y < copy.bottom ? .38 : 1;
      const power = led.power * shelter;
      ctx.globalAlpha = power; ctx.drawImage(sprites[led.color],x - 12,y - 12,24,24);
      ctx.fillStyle = palette[led.color];
      ctx.beginPath(); ctx.arc(x,y,1 + led.power * .8,0,Math.PI * 2); ctx.fill();
      if (led.power > .68) {
        ctx.globalAlpha = power * .8; ctx.fillStyle = theme === 'light' ? palette[led.color] : '#effffc';
        ctx.beginPath(); ctx.arc(x,y,.7,0,Math.PI * 2); ctx.fill();
      }
    }
    for (let i = runners.length - 1; i >= 0; i--) if (!paintRunner(runners[i],dt)) runners.splice(i,1);
    ctx.globalAlpha = 1;
    canvas.dataset.lit = String(lamps.size); schedule();
  }

  function schedule() { if (!frame && active() && !reduced()) frame = requestAnimationFrame(draw); }
  function stop() { cancelAnimationFrame(frame); frame = 0; lastPaint = 0; }
  function sync() {
    stop();
    if (!active()) { canvas.dataset.state = 'paused'; return; }
    if ((dirty || theme !== root.dataset.theme) && !rebuild()) return;
    if (reduced()) {
      lamps.clear(); runners.length = waves.length = capacitors.length = 0; initialized = false;
      pointer = undefined; canvas.dataset.lit = '0'; canvas.dataset.state = 'still'; paintBase(); return;
    }
    canvas.dataset.state = 'running'; lastPaint = performance.now(); schedule();
  }

  function point(event) {
    if (!bounds || event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.top + height) return;
    return {col:clamp(Math.round((event.clientX - bounds.left - OFFSET) / STEP),0,cols - 1),
      row:clamp(Math.round((event.clientY - bounds.top - OFFSET) / STEP),0,rows - 1)};
  }
  const isField = target => target instanceof Element && target.closest('input,textarea,select,[contenteditable="true"]');
  panel.addEventListener('pointermove',event => {
    if (!active() || reduced() || !fine.matches || !event.isPrimary || event.pointerType === 'touch' || isField(event.target)) return;
    const p = point(event); if (!p) return;
    pointer = {...p,expires:clock + .23};
    if (clock - lastInduction > .65) {
      lastInduction = clock;
      launch(p.col,p.row,integer(0,3),0,12,false);
    }
  },{passive:true});
  panel.addEventListener('pointerleave',() => { pointer = undefined; });
  panel.addEventListener('click',event => {
    if (!active() || reduced() || !event.detail || event.button !== 0 || isField(event.target) || clock - lastClick < .4) return;
    const p = point(event); if (!p) return;
    lastClick = clock;
    if (waves.length < 4) waves.push({...p,age:0,radius:0,max:compact.matches ? 7 : 11,color:1});
    for (let d = 0; d < 4; d++) launch(p.col,p.row,d,d % 3,18,false);
  },{passive:true});
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); },{rootMargin:'0px'}).observe(hero);
  new ResizeObserver(() => { dirty = true; sync(); }).observe(hero);
  new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:['data-app','data-motion','data-theme']});
  motion.addEventListener('change',sync);
  document.addEventListener('visibilitychange',sync);
  window.addEventListener('raccoon:appchange',() => { dirty = true; sync(); });
  window.addEventListener('scroll',() => { if (active()) updateBounds(); },{passive:true});
  window.addEventListener('resize',() => { dirty = true; sync(); },{passive:true});
  window.addEventListener('pagehide',() => { closed = true; stop(); });
  window.addEventListener('pageshow',() => { closed = false; sync(); });
})();
