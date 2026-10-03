(() => {
  'use strict';
  const en = document.documentElement.lang === 'en';
  const t = (ru, english) => en ? english : ru;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
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
  if ($('.bloom-lab')) {
    const lab = $('.bloom-lab');
    const whole = $('.whole-character'); whole.setAttribute('role', 'button'); whole.tabIndex = 0; whole.setAttribute('aria-label', t('Разложить 明 на части', 'Split 明 into components'));
    const split = () => { lab.classList.add('is-split'); $('[data-component-detail]').textContent = t('明 → 日 + 月. Это графическое разложение, а не объяснение происхождения знака.', '明 → 日 + 月. This is a visual breakdown, not a claim about its etymology.'); };
    whole.addEventListener('click', split); whole.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); split(); } });
    $$('[data-part]').forEach(b => b.addEventListener('click', () => { lab.classList.add('is-split'); $('[data-component-detail]').textContent = b.dataset.part === 'sun' ? t('日 · rì — солнце; день. Найдите эту часть в 明.', '日 · rì — sun; day. Spot this component in 明.') : t('月 · yuè — луна; месяц. В 明 эта часть находится справа.', '月 · yuè — moon; month. In 明 this component is on the right.'); }));
    $$('[data-part]').forEach(b => b.addEventListener('click', () => $$('[data-part]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)))));
    let flipped = false; $('[data-flip-card]').textContent=t('Как по-китайски «завтра»? Перевернуть карточку','How do you say tomorrow in Chinese? Flip card'); $('[data-flip-card]').addEventListener('click', e => { flipped = !flipped; e.currentTarget.textContent = flipped ? t('明天 · míngtiān · завтра — показать вопрос', '明天 · míngtiān · tomorrow — show question') : t('Как по-китайски «завтра»? Перевернуть карточку', 'How do you say tomorrow in Chinese? Flip card'); e.currentTarget.classList.toggle('is-flipped', flipped); });
  }
  if ($('.keys-lab')) {
    const questions = [ ['河','hé',t('река','river'),'氵',t('вода','water'),['氵','木','口']], ['林','lín',t('лес','woods'),'木',t('дерево','tree'),['口','木','日']], ['唱','chàng',t('петь','sing'),'口',t('рот','mouth'),['月','氵','口']] ];
    let index = 0;
    const answer = e => { const correct = e.currentTarget.dataset.answer === questions[index][3]; e.currentTarget.classList.toggle('is-correct', correct); $('[data-quiz-feedback]').textContent = correct ? t('Верно! Ключ помогает узнать и запомнить знак.', 'Correct! The radical gives you a memorable clue.') : t('Попробуйте ещё раз: ищите знакомую часть знака.', 'Try again: look for the familiar component.'); };
    $$('[data-answer]').forEach(b => b.addEventListener('click', answer));
    $('[data-next-question]').addEventListener('click', () => { index = (index + 1) % questions.length; const q = questions[index]; $('[data-quiz-count]').textContent = `${index + 1} / 3`; $('[data-quiz-question]').textContent = t(`Найдите ключ «${q[4]}» в иероглифе ${q[0]}`, `Find the ${q[4]} radical in ${q[0]}`); $('[data-quiz-character]').replaceChildren(document.createTextNode(q[0])); const small = document.createElement('small'); small.textContent = `${q[1]} · ${q[2]}`; $('[data-quiz-character]').append(small); const options = $('[data-quiz-options]'); options.replaceChildren(...q[5].map(c => { const b = document.createElement('button'); b.type = 'button'; b.className = 'radical-option'; b.dataset.answer = c; b.textContent = c; b.addEventListener('click', answer); return b; })); $('[data-quiz-feedback]').textContent = t('Нажмите на подходящую часть', 'Choose the matching part'); });
  }
  if ($('.story-book')) {
    const pages = en ? [['A light in the dark','The little dragon looked at the stars. “What if I could shine too?” he wondered, and breathed out a tiny warm spark.'],['A tiny brave step','A lost firefly saw the spark. “Will you help me find home?” Together they followed the silver path through the grass.'],['The brightest kind of magic','At the old oak, the firefly found its family. The dragon smiled: being kind had made the night brighter than any flame.']] : [['Огонёк в темноте','Маленький дракончик смотрел на звёзды. «А вдруг я тоже могу светить?» — подумал он. И осторожно выдохнул тёплую искорку.'],['Маленький смелый шаг','Заблудившийся светлячок увидел искру. «Поможешь найти дом?» Вместе они пошли по серебристой тропинке между травинками.'],['Самое яркое волшебство','У старого дуба светлячок нашёл свою семью. Дракончик улыбнулся: доброта сделала ночь светлее любого пламени.']];
    let index = 0, speaking = false;
    const stop = () => { if ('speechSynthesis' in window) speechSynthesis.cancel(); speaking = false; $('[data-story-listen]').textContent = t('Послушать', 'Listen'); };
    $('[data-story-next]').addEventListener('click', () => { stop(); index = (index + 1) % pages.length; $('[data-story-count]').textContent = `0${index + 1} / 03`; $('[data-story-title]').textContent = pages[index][0]; $('[data-story-text]').textContent = pages[index][1]; });
    $('[data-story-listen]').addEventListener('click', () => { if (!('speechSynthesis' in window)) { $('[data-story-status]').textContent = t('Браузер не поддерживает озвучку. Историю можно прочитать.', 'Your browser does not support speech. You can still read the story.'); return; } if (speaking) { stop(); return; } const utterance = new SpeechSynthesisUtterance(pages[index][1]); utterance.lang = en ? 'en-US' : 'ru-RU'; utterance.rate = .9; utterance.onend = utterance.onerror = stop; speaking = true; $('[data-story-listen]').textContent = t('Остановить', 'Stop'); $('[data-story-status]').textContent = t('Пример: системный голос браузера. В приложении можно записать свой.', 'Demo: your browser’s system voice. Record your own in the app.'); speechSynthesis.speak(utterance); });
    $('[data-story-next]').addEventListener('click',()=>{const page=$('.book-page');page.classList.remove('is-turning');void page.offsetWidth;page.classList.add('is-turning');});
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); }); window.addEventListener('pagehide', stop);
  }
  if ($('.city-lab')) {
    let tool = 'house'; const slots = $$('[data-city-slot]'); slots[1].disabled = true; slots[1].tabIndex = -1; slots[1].setAttribute('aria-hidden','true');
    $$('[data-city-tool]').forEach(b => b.addEventListener('click', () => { tool = b.dataset.cityTool; $$('[data-city-tool]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); }));
    slots.forEach(b => b.addEventListener('click', () => { const img = new Image(); img.src = `/assets/demo/${tool}.webp`; img.alt = t(tool === 'house' ? 'Домик' : 'Дерево', tool === 'house' ? 'House' : 'Tree'); b.replaceChildren(img); b.dataset.placed = tool; b.setAttribute('aria-label', t('Заменить объект', 'Replace object')); $('[data-city-status]').textContent = t(`Город растёт: размещено ${slots.filter(s => s.dataset.placed).length} объектов.`, `Your town is growing: ${slots.filter(s => s.dataset.placed).length} objects placed.`); }));
    $('[data-city-reset]').addEventListener('click', () => { slots.forEach((s,i) => { s.textContent = '+'; delete s.dataset.placed; s.setAttribute('aria-label', t(`Разместить объект на месте ${i+1}`, `Place an object in spot ${i+1}`)); }); $('[data-city-status]').textContent = t('Выберите место для первого домика', 'Choose a spot for your first house'); });
  }
  if ($('.meal-lab')) {
    const names = {eggs:t('Яйца','Eggs'),tomatoes:t('Помидоры','Tomatoes'),pasta:t('Паста','Pasta'),cucumber:t('Огурцы','Cucumbers')};
    const recipes = {omelet:{eggs:1,tomatoes:100},pasta:{pasta:80,tomatoes:100},salad:{eggs:1,tomatoes:100,cucumber:100}};
    $('[data-build-groceries]').addEventListener('click', () => { const total = {}; const servings = Number($('[data-servings]').value); $$('[data-meal-day]').forEach(s => { Object.entries(recipes[s.value] || {}).forEach(([k,v]) => total[k] = (total[k] || 0) + v * servings); }); const output = $('[data-grocery-preview]'); output.replaceChildren(); if (!Object.keys(total).length) { output.textContent = t('Сначала выберите хотя бы одно блюдо.', 'Choose at least one dish first.'); return; } const title = document.createElement('p'); title.textContent = t('Продукты объединены. Отметьте то, что уже есть дома:', 'Ingredients combined. Tick what you already have:'); output.append(title); Object.entries(total).forEach(([k,v]) => { const row = document.createElement('label'); row.className = 'grocery-item'; const check = document.createElement('input'); check.type = 'checkbox'; const text = document.createElement('span'); text.textContent = `${names[k]} — ${v} ${k === 'eggs' ? t('шт.','pcs') : t('г','g')}`; check.addEventListener('change', () => row.classList.toggle('is-owned',check.checked)); row.append(check,text); output.append(row); }); });
  }
  if ($('.supplies-lab')) {
    const states = [0,0,0], labels = [t('Есть дома','In stock'),t('Заканчивается','Running low'),t('Нужно купить','On shopping list')], actions = [t('Заканчивается','Running low'),t('В покупки','Add to shopping'),t('Куплено → домой','Bought → restock')];
    const render = () => { states.forEach((stage,i) => { $(`[data-supply-state="${i}"]`).textContent = labels[stage]; const b = $(`[data-supply-action="${i}"]`); b.textContent = actions[stage]; b.dataset.stage = stage; }); $('[data-shopping-count]').textContent = states.filter(s => s === 2).length; };
    $$('[data-supply-action]').forEach(b => b.addEventListener('click', () => { const i = Number(b.dataset.supplyAction); states[i] = (states[i] + 1) % 3; render(); $('[data-supply-feedback]').textContent = states[i] === 0 ? t('Покупка снова в запасах. Цикл завершён!', 'Back in your supplies. The cycle is complete!') : states[i] === 2 ? t('Товар в списке покупок. После покупки верните его домой.', 'Added to shopping. Restock it when you buy it.') : t('Запас заканчивается — отправьте его в покупки.', 'Running low — add it to your shopping list.'); }));
    $('[data-supply-reset]').addEventListener('click', () => { states.fill(0); render(); $('[data-supply-feedback]').textContent = t('Начните с кофе — нажмите «Заканчивается»', 'Start with coffee — tap Running low'); });
  }
  if ($('.neon-lab')) {
    const canvas = $('.neon-canvas'), ctx = canvas.getContext('2d'), sprite = new Image(); sprite.src = '/assets/demo/neon-player.png';
    let x = 48, y = 330, vx = 0, vy = 0, flying = false, holding = false, redirected = false, charge = 1, score = 0, frame = 0, last = 0;
    const draw = () => { ctx.fillStyle = '#0b1022'; ctx.fillRect(0,0,600,430); ctx.strokeStyle = '#172742'; for(let i=0;i<600;i+=40){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,430);ctx.stroke();} ctx.fillStyle = '#55e4e4'; ctx.fillRect(18,20,14,390); ctx.fillRect(568,20,14,390); ctx.fillStyle = '#9980ff'; ctx.fillRect(60,32,480*charge,5); ctx.fillStyle = '#ffffff'; if(sprite.complete && sprite.naturalWidth) ctx.drawImage(sprite,x-27,y-34,54,68); else ctx.fillRect(x-12,y-20,24,40); ctx.font='16px sans-serif';ctx.fillText(t('ЗАРЯД','CHARGE'),60,23); };
    const tick = now => { const dt = Math.min((now-last)/1000 || .016,.035); last = now; if (holding && charge > 0) { vy -= 650*dt; charge=Math.max(0,charge-dt*.6); } vy += 380*dt; x += vx*dt; y += vy*dt; if (y<70) {y=70;vy=Math.max(vy,0);} if(x<=48 || x>=552) { x=Math.max(48,Math.min(552,x)); flying=false;holding=false;charge=1;score+=8; $('[data-neon-score]').textContent=`${score} m`; $('[data-neon-status]').textContent=t('Стена поймана! Следующий тап — новый прыжок.','Wall caught! Tap for the next jump.'); } if(y>390) {y=330;x=vx>0?552:48;flying=false;holding=false;charge=1;} draw(); if(flying && !document.hidden) frame=requestAnimationFrame(tick); };
    const jump = () => { if (!flying) { vx=x<300?400:-400;vy=-230;flying=true;redirected=false;last=performance.now();cancelAnimationFrame(frame);frame=requestAnimationFrame(tick); } else if(!redirected){vx=-vx;vy=-180;redirected=true;} holding=true; };
    const button=$('[data-neon-jump]'); button.addEventListener('pointerdown',e=>{ e.preventDefault();button.setPointerCapture(e.pointerId);jump(); }); ['pointerup','pointercancel','lostpointercapture'].forEach(name=>button.addEventListener(name,()=>holding=false));
    [button,canvas].forEach(el=>{el.addEventListener('keydown',e=>{if((e.code==='Space'||e.code==='Enter')&&!e.repeat){e.preventDefault();jump();}});el.addEventListener('keyup',e=>{if(e.code==='Space'||e.code==='Enter')holding=false;});});
    $('[data-neon-reset]').addEventListener('click',()=>{cancelAnimationFrame(frame);x=48;y=330;vx=vy=score=0;charge=1;flying=holding=false;$('[data-neon-score]').textContent='0 m';draw();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);holding=false;}else if(flying){last=performance.now();frame=requestAnimationFrame(tick);}});
    const observer=new IntersectionObserver(entries=>{if(!entries[0].isIntersecting){cancelAnimationFrame(frame);holding=false;}else if(flying&&!document.hidden){cancelAnimationFrame(frame);last=performance.now();frame=requestAnimationFrame(tick);} });observer.observe(canvas);
    sprite.onload=draw;draw();window.addEventListener('pagehide',()=>cancelAnimationFrame(frame));
  }
})();
