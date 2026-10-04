/* Source-based browser ports. Native services, full catalogs and saves stay in the apps. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const en = document.documentElement.lang === 'en', t = (ru, english) => en ? english : ru;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const motion = (el, frames, duration, options = {}) => reduced.matches ? null : el.animate(frames, {duration, easing:'cubic-bezier(.2,0,0,1)', ...options});
  // Compose spring, unit mass: dampingRatio and stiffness from the native screen.
  function springFrames(from, to, damping = .68, stiffness = 1500) {
    const omega = Math.sqrt(stiffness), wd = omega * Math.sqrt(1 - damping * damping);
    return Array.from({length:61}, (_,i) => {
      const time = i / 60 * .6, decay = Math.exp(-damping * omega * time);
      const p = i === 60 ? 1 : 1 - decay * (Math.cos(wd*time) + damping*omega/wd * Math.sin(wd*time));
      return {transform:from(p, to), offset:i/60};
    });
  }
  // Android-style sheets, scoped dialogs: keyboard focus + Escape + outside dismiss.
  function openSheet(sheet) { sheet.showModal(); motion(sheet,[{opacity:0,transform:'translateY(40px)'},{opacity:1,transform:'translateY(0)'}],340); }
  function closeSheet(sheet) {
    if (!sheet.open || sheet.dataset.closing) return;
    sheet.dataset.closing='true';
    const a=motion(sheet,[{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(25px)'}],180);
    const finish=()=>{sheet.close();delete sheet.dataset.closing;}; if(a) a.onfinish=finish; else finish();
  }
  $$('.native-sheet').forEach(sheet=>{
    sheet.addEventListener('click', e=>{if(e.target!==sheet)return;const r=sheet.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeSheet(sheet);});
    sheet.addEventListener('cancel',e=>{e.preventDefault();closeSheet(sheet);});
    sheet.querySelector('form')?.addEventListener('submit',e=>{e.preventDefault();closeSheet(sheet);});
  });
  if ($('.keys-lab')) {
    const questions=[['河','hé',t('река','river'),'氵',t('вода','water'),['氵','木','口','日']],['林','lín',t('лес','woods'),'木',t('дерево','tree'),['口','木','日','月']],['唱','chàng',t('петь','sing'),'口',t('рот','mouth'),['月','氵','口','木']]];
    const meanings={'氵':t('вода','water'),'木':t('дерево','tree'),'口':t('рот','mouth'),'日':t('солнце','sun'),'月':t('луна','moon')};
    let index=0, solved=false;
    const glyph=$('[data-quiz-character]'), options=$('[data-quiz-options]'), done=$('[data-next-question]');
    function arrival(){motion(glyph,[{opacity:0,transform:'scale(.94)'},{opacity:1,transform:'scale(1)'}],500);$$('[data-answer]').forEach((b,i)=>motion(b,[{opacity:0,transform:`translateY(${12+i*8}px)`},{opacity:1,transform:'translateY(0)'}],500));}
    function answer(e){
      if(solved)return;const b=e.currentTarget, correct=b.dataset.answer===questions[index][3];
      $$('[data-answer]').forEach(x=>{x.classList.remove('is-correct','is-wrong');x.querySelector('.answer-state')?.remove();x.setAttribute('aria-pressed',String(x===b));});
      b.classList.add(correct?'is-correct':'is-wrong');const state=document.createElement('em');state.className='answer-state';state.textContent=correct?t('✓ Верно','✓ Correct'):t('Попробуй ещё','Try again');b.append(state);
      const frames=Array.from({length:41},(_,i)=>{const p=i/40;return{transform:correct?`scale(${1+Math.sin(p*Math.PI)*.035})`:`rotate(${Math.sin(p*Math.PI*6)*(1-p)*5}deg)`,offset:p};});motion(b,frames,650,{easing:'linear'});
      $('[data-quiz-feedback]').textContent=correct?`${questions[index][3]} — ${questions[index][4]}. ${t('Ключ найден!','Found!')}`:t('Попробуй ещё','Try again');
      if(correct){solved=true;done.hidden=false;motion(glyph,[{transform:'rotate(0deg)'},{transform:'rotate(5deg)'},{transform:'rotate(-5deg)'},{transform:'rotate(0deg)'}],650);glyph.classList.add('native-found');$$('[data-answer]').forEach(x=>x.disabled=true);const burst=document.createElement('span');burst.className='key-burst';burst.setAttribute('aria-hidden','true');for(let i=0;i<10;i++){const dot=document.createElement('i');const angle=i*Math.PI*2/10;dot.style.setProperty('--dx',`${Math.cos(angle)*100}px`);dot.style.setProperty('--dy',`${Math.sin(angle)*100}px`);burst.append(dot);}glyph.append(burst);}
    }
    function render(){solved=false;done.hidden=true;const q=questions[index];$('[data-quiz-count]').textContent=`${index+1} / 3`;glyph.replaceChildren(document.createTextNode(q[0]));const small=document.createElement('small');small.textContent=`${q[1]} · ${q[2]}`;glyph.append(small);glyph.classList.remove('native-found');options.replaceChildren();q[5].forEach(c=>{const b=document.createElement('button');b.type='button';b.className='radical-option';b.dataset.answer=c;const char=document.createElement('span');char.textContent=c;const meaning=document.createElement('small');meaning.textContent=meanings[c];b.append(char,meaning);b.addEventListener('click',answer);options.append(b);});$('[data-quiz-feedback]').textContent=t('Выберите словарный ключ','Choose the dictionary radical');arrival();}
    done.addEventListener('click',()=>{index=(index+1)%3;render();});render();
  }
  if ($('.bloom-lab')) {
    const lab=$('.bloom-lab'), panel=$('[data-structure-surface]'), parts=$$('[data-part]');let expanded=false;
    function unfold(value){panel.style.setProperty('--part-distance',`${panel.clientWidth<310?63:72}px`);expanded=value;lab.classList.toggle('is-split',value);$('.whole-character').setAttribute('aria-expanded',String(value));$('[data-fold-components]').textContent=value?t('Нажми на часть · фон собирает знак','Tap a part · background folds the sign'):t('Нажми на знак — части оживут','Tap the sign to bring its parts to life');parts.forEach((part,i)=>{const sign=i===0?-1:1;const distance=panel.clientWidth<310?63:72;const from=value?0:1,target=value?1:0;motion(part,springFrames(p=>{const s=from+(target-from)*p;return `translate(${sign*(18+(distance-18)*s)}px,0) rotate(${sign*3*s}deg) scale(${.42+.58*s})`; }),600,{easing:'linear'});part.tabIndex=value?0:-1;});}
    panel.addEventListener('click',e=>{if(!e.target.closest('[data-part]'))unfold(!expanded);});
    const detail=$('[data-component-detail]');detail.className='component-detail native-component-page';detail.hidden=true;
    const content=document.createElement('div'), back=document.createElement('button');back.type='button';back.className='demo-button';back.textContent=t('‹ Назад к 明','‹ Back to 明');detail.replaceChildren(back,content);
    back.addEventListener('click',()=>{detail.hidden=true;panel.hidden=false;parts.find(x=>x.dataset.part===detail.dataset.part)?.focus();});
    parts.forEach(b=>b.addEventListener('click',()=>{
      if(!expanded)return;parts.forEach(x=>x.style.opacity=x===b?'1':'.32');
      const sun=b.dataset.part==='sun';content.replaceChildren();const h=document.createElement('h3');h.textContent=sun?'日':'月';const p=document.createElement('p');p.textContent=sun?t('rì · солнце; день','rì · sun; day'):t('yuè · луна; месяц','yuè · moon; month');content.append(h,p);
      detail.dataset.part=b.dataset.part;
      setTimeout(()=>{detail.hidden=false;panel.hidden=true;parts.forEach(x=>x.style.opacity='');motion(detail,[{opacity:0,transform:'translateX(16px)'},{opacity:1,transform:'translateX(0)'}],420);back.focus();},reduced.matches?0:220);
    }));
    // The old invented flip button is outside this reproduced structure screen.
    $('[data-flip-card]').remove();$('.word-example').remove();unfold(false);
  }
  if ($('.story-book')) {
    const pages=en?[
      'In a mountain land lived a little dragon named Julia with emerald scales and funny little wings. All dragons could breathe fire — all except her.',
      '“Hey, Julia-no-fire! You’re not a real dragon!” the others laughed. Julia hid behind a rock and felt sad.',
      'One day Julia saw a frog stuck in a crack. She blew a stream of cold air — and the frog flew free.'
    ]:[
      'В горной стране жила дракончик Юля с изумрудной чешуёй и смешными крылышками. Все драконы умели дышать огнём — все, кроме неё.',
      '«Эй, Юля-без-огня! Ты не настоящий дракон!» — смеялись другие. Юля пряталась за камень и грустила.',
      'Однажды Юля увидела лягушку, застрявшую в расщелине. Она выдула струю холодного воздуха — и лягушка вылетела на свободу.'
    ];let index=0,speaking=false;
    const prev=$('[data-story-prev]'),next=$('[data-story-next]'),listen=$('[data-story-listen]'),text=$('[data-story-text]');
    const stop=()=>{if('speechSynthesis'in window)speechSynthesis.cancel();speaking=false;listen.textContent=t('▶ Послушать','▶ Listen');};
    function turn(dir){stop();index=Math.max(0,Math.min(pages.length-1,index+dir));text.textContent=pages[index];$('[data-story-count]').textContent=`${index+1} / 3`;$$('.reader-dots i').forEach((d,i)=>d.classList.toggle('active',i===index));prev.disabled=index===0;next.disabled=index===pages.length-1;motion($('.reader-title-bubble'),[{opacity:.9,transform:`translateX(${14*dir}px)`},{opacity:1,transform:'translateX(0)'}],280);motion(text,[{opacity:0,transform:`translate(${14*dir}px,6px)`},{opacity:1,transform:'translate(0,0)'}],300,{delay:70});}
    prev.addEventListener('click',()=>turn(-1));next.addEventListener('click',()=>turn(1));turn(0);
    $('[data-story-status]').textContent=t('Первые 3 страницы · иллюстрация обложки · голос браузера','First 3 pages · cover illustration · browser voice');
    $('[data-story-favorite]').addEventListener('click',e=>{const b=e.currentTarget,selected=b.getAttribute('aria-pressed')!=='true';b.setAttribute('aria-pressed',String(selected));b.textContent=selected?'★':'☆';motion(b,[{transform:'scale(1)'},{transform:'scale(1.08)'},{transform:'scale(1)'}],250);});
    listen.addEventListener('click',()=>{if(!('speechSynthesis'in window)){$('[data-story-status]').textContent=t('Озвучка недоступна в этом браузере','Speech is unavailable in this browser');return;}if(speaking){stop();return;}const voice=new SpeechSynthesisUtterance(pages[index]);voice.lang=en?'en-US':'ru-RU';voice.rate=.9;voice.onend=voice.onerror=stop;speaking=true;listen.textContent=t('■ Остановить','■ Stop');speechSynthesis.speak(voice);});
    const art=$('.reader-art');let start;art.addEventListener('pointerdown',e=>start=e.clientX);art.addEventListener('pointerup',e=>{if(start!==undefined&&Math.abs(e.clientX-start)>40)turn(e.clientX<start?1:-1);start=undefined;});art.addEventListener('pointercancel',()=>start=undefined);
    window.addEventListener('pagehide',stop);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  }
  if ($('.meal-lab')) {
    const sheet=$('.meal-picker'),slots=$$('[data-meal-slot]'), meals=new Map(),titles={omelet:t('Омлет с помидорами','Tomato omelet'),pasta:t('Паста с помидорами','Tomato pasta'),salad:t('Салат с яйцом','Egg salad')};
    const ingredients={omelet:{eggs:1,tomatoes:100},pasta:{pasta:80,tomatoes:100},salad:{eggs:1,tomatoes:100,cucumber:100}};
    const names={eggs:t('Яйца','Eggs'),tomatoes:t('Помидоры','Tomatoes'),pasta:t('Паста','Pasta'),cucumber:t('Огурцы','Cucumbers')};let active,portions=2;
    const savePortions=document.createElement('button');savePortions.type='button';savePortions.className='demo-button';savePortions.hidden=true;savePortions.textContent=t('Сохранить изменения','Save changes');$('.portion-control').after(savePortions);savePortions.addEventListener('click',()=>{const existing=meals.get(active);if(existing){meals.set(active,{...existing,portions});render();closeSheet(sheet);}});
    function render(){slots.forEach(b=>{const meal=meals.get(b.dataset.mealSlot);b.classList.toggle('has-meal',!!meal);b.querySelector('[data-meal-label]').textContent=meal?`${meal.custom||titles[meal.dish]} · ${meal.portions} ${t('порц.','servings')}`:t('＋ Добавить','＋ Add');const img=b.querySelector('img');if(meal?.dish)img.src=`/assets/demo/${meal.dish}.webp`;img.style.opacity=meal?.dish?'1':'.28';});$('[data-grocery-preview]').textContent=t('План изменён. Соберите продукты из меню.','Plan updated. Build groceries from your menu.');}
    function mode(value){$('[data-dish-mode]').hidden=value!=='dish';$('[data-text-mode]').hidden=value!=='text';$$('[data-meal-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mealMode===value)));}
    slots.forEach(b=>b.addEventListener('click',()=>{active=b.dataset.mealSlot;const meal=meals.get(active);portions=meal?.portions||2;setPortions(portions);$('#meal-picker-title').textContent=b.querySelector('small').textContent;$('[data-meal-date]').textContent=b.closest('.native-day-card').querySelector('strong').textContent;$('[data-custom-meal]').value=meal?.custom||'';$('[data-meal-search]').value='';$$('[data-pick-dish]').forEach(x=>x.hidden=false);$('[data-dish-empty]').hidden=true;$('.meal-existing').hidden=!meal;$('[data-repeat-meal]').disabled=active.startsWith('6-');mode(meal?.custom?'text':'dish');openSheet(sheet);}));
    $$('[data-meal-mode]').forEach(b=>b.addEventListener('click',()=>mode(b.dataset.mealMode)));
    function setPortions(value){portions=Math.max(1,Math.min(100,value));$('[data-portion-count]').textContent=portions;$('[data-portion-minus]').disabled=portions===1;$('[data-portion-plus]').disabled=portions===100;savePortions.hidden=!meals.has(active)||meals.get(active).portions===portions;}
    $('[data-portion-minus]').addEventListener('click',()=>setPortions(portions-1));$('[data-portion-plus]').addEventListener('click',()=>setPortions(portions+1));
    $$('[data-pick-dish]').forEach(b=>b.addEventListener('click',()=>{meals.set(active,{dish:b.dataset.pickDish,portions});render();closeSheet(sheet);}));
    $('[data-meal-search]').addEventListener('input',e=>{let count=0;$$('[data-pick-dish]').forEach(b=>{b.hidden=!titles[b.dataset.pickDish].toLowerCase().includes(e.target.value.toLowerCase());if(!b.hidden)count++;});$('[data-dish-empty]').hidden=count!==0;});
    $('[data-save-custom]').addEventListener('click',()=>{const custom=$('[data-custom-meal]').value.trim();if(!custom)return;meals.set(active,{custom,portions});render();closeSheet(sheet);});
    $('[data-remove-meal]').addEventListener('click',()=>{meals.delete(active);render();closeSheet(sheet);});
    $('[data-repeat-meal]').addEventListener('click',()=>{const [day,type]=active.split('-');const tomorrow=`${Number(day)+1}-${type}`;if(Number(day)<6&&(!meals.has(tomorrow)||confirm(t('Заменить блюдо на завтра?','Replace tomorrow’s meal?')))){meals.set(tomorrow,{...meals.get(active),portions});render();closeSheet(sheet);}});
    $('[data-build-groceries]').addEventListener('click',()=>{const total={};let customCount=0;meals.forEach(meal=>{if(meal.custom){customCount++;return;}Object.entries(ingredients[meal.dish]).forEach(([k,v])=>total[k]=(total[k]||0)+v*meal.portions);});const out=$('[data-grocery-preview]');out.replaceChildren();const caption=document.createElement('p');caption.textContent=t('Уберите продукты, которые уже есть дома.','Uncheck ingredients you already have at home.');out.append(caption);Object.entries(total).forEach(([k,v])=>{const row=document.createElement('label');row.className='grocery-item';const check=document.createElement('input');check.type='checkbox';check.checked=true;const span=document.createElement('span');span.textContent=`${names[k]} — ${v} ${k==='eggs'?t('шт.','pcs'):t('г','g')}`;check.addEventListener('change',()=>row.classList.toggle('is-owned',!check.checked));row.append(check,span);out.append(row);});if(!Object.keys(total).length)caption.textContent=t('Выберите блюдо с ингредиентами.','Choose a dish with ingredients.');if(customCount){const note=document.createElement('p');note.textContent=t('У своего текста нет ингредиентов — продукты не добавлены.','Custom text has no ingredient list; no groceries were added.');out.append(note);}motion(out,[{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],220);});render();
  }
  if ($('.supplies-lab')) {
    const items=[{name:t('Кофе','Coffee'),emoji:'☕'},{name:t('Корм для котика','Cat food'),emoji:'🐾'},{name:t('Шампунь','Shampoo'),emoji:'🧴'}];let shopping=false;const needed=new Set(),checked=new Set();
    function render(){
      $('[data-stock-count]').textContent=3-needed.size;$('[data-shopping-count]').textContent=needed.size-checked.size;
      $$('[data-supply-action]').forEach((b,i)=>{const needs=needed.has(i);b.disabled=needs;b.textContent=needs?'✓':'♧';b.dataset.stage=needs?'2':'0';$(`[data-supply-state="${i}"]`).textContent=needs?t('в покупках','on the list'):t('есть дома','at home');});
      $('[data-inventory-screen]').hidden=shopping;$('[data-shopping-screen]').hidden=!shopping;$$('[data-supply-tab]').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.supplyTab==='shopping')===shopping)));
      const rows=$('[data-shopping-rows]');rows.replaceChildren();needed.forEach(i=>{const row=document.createElement('label');row.className='native-shopping-row';const check=document.createElement('input');check.type='checkbox';check.checked=checked.has(i);const icon=document.createElement('span');icon.textContent=items[i].emoji;const title=document.createElement('strong');title.textContent=items[i].name;row.classList.toggle('checked',check.checked);check.addEventListener('change',()=>{check.checked?checked.add(i):checked.delete(i);render();$(`[data-shopping-item="${i}"]`)?.focus();});check.dataset.shoppingItem=i;row.append(check,icon,title);rows.append(row);});
      const progress=needed.size?checked.size/needed.size:0;$('[data-shopping-progress]').textContent=`${Math.round(progress*100)}%`;$('[data-shopping-left]').textContent=t(`${needed.size-checked.size} осталось · ${checked.size} готово`,`${needed.size-checked.size} left · ${checked.size} done`);$('progress').value=progress;$('[data-shopping-empty]').hidden=needed.size!==0;$('[data-finish-shopping]').hidden=checked.size===0;$('[data-finish-shopping]').textContent=t(`Куплено: ${checked.size} · завершить`,`Finish · ${checked.size} bought`);
    }
    $$('[data-supply-action]').forEach((b,i)=>b.addEventListener('click',()=>{needed.add(i);render();$('[data-supply-feedback]').textContent=t('Товар уже в покупках. Откройте «Купить».','Already on your list. Open Shopping.');}));
    $$('[data-supply-tab]').forEach(b=>b.addEventListener('click',()=>{shopping=b.dataset.supplyTab==='shopping';render();motion(shopping?$('[data-shopping-screen]'):$('[data-inventory-screen]'),[{opacity:0},{opacity:1}],180);}));
    $('[data-supply-search]').addEventListener('input',e=>$$('.native-room').forEach(room=>room.hidden=!room.textContent.toLowerCase().includes(e.target.value.trim().toLowerCase())));
    $('[data-finish-shopping]').addEventListener('click',()=>{checked.forEach(i=>needed.delete(i));checked.clear();render();$('[data-supply-feedback]').textContent=t('Купленные товары снова есть дома.','Purchased items are back at home.');const confetti=$('.native-celebration');confetti.replaceChildren();for(let i=0;i<18;i++){const dot=document.createElement('i');const angle=(205+(i*151%130))*Math.PI/180,speed=120+(i%5)*19;dot.style.setProperty('--x',`${Math.cos(angle)*speed}px`);dot.style.setProperty('--y',`${Math.sin(angle)*speed}px`);dot.style.setProperty('--color',['#c9473a','#1e7454','#ffbe65','#eba6bd'][i%4]);confetti.append(dot);}setTimeout(()=>confetti.replaceChildren(),950);});
    $('[data-supply-reset]').addEventListener('click',()=>{needed.clear();checked.clear();shopping=false;$('[data-supply-search]').value='';$$('.native-room').forEach(x=>x.hidden=false);render();});render();
  }
  if ($('.city-lab')) {
    const map=$('.city-map');$('.city-slots').remove();let tool='house', objects=[],drag=null,holdTimer;
    $('.native-city-quest small').textContent=t('Домик → место → готово','House → place → done');
    const action=document.createElement('button');action.type='button';action.className='demo-button city-confirm';action.textContent=t('✓ Поставить','✓ Place');action.hidden=true;map.after(action);
    function coords(e){const r=map.getBoundingClientRect();return{x:Math.max(28,Math.min(r.width-28,e.clientX-r.left)),y:Math.max(105,Math.min(r.height-18,e.clientY-r.top))};}
    function move(obj,p){obj.x=p.x;obj.y=p.y;obj.el.style.left=`${p.x/map.clientWidth*100}%`;obj.el.style.top=`${p.y/map.clientHeight*100}%`;}
    function create(p){const el=document.createElement('button');el.type='button';el.className='city-object';const img=new Image();img.src=`/assets/demo/${tool}.webp`;img.alt=t(tool==='house'?'Домик':'Дерево',tool==='house'?'House':'Tree');el.append(img);el.setAttribute('aria-label',t('Зажмите, чтобы передвинуть. Стрелки — точная позиция.','Hold to move. Arrow keys fine-tune the position.'));map.append(el);const obj={el,tool,x:0,y:0,placed:false};move(obj,p);objects.push(obj);
      el.addEventListener('pointerdown',e=>{e.stopPropagation();if(!obj.placed){drag=obj;el.setPointerCapture(e.pointerId);return;}holdTimer=setTimeout(()=>{drag=obj;obj.placed=false;el.classList.add('placing');el.setPointerCapture(e.pointerId);action.hidden=false;},760);});
      el.addEventListener('pointermove',e=>{if(drag===obj)move(obj,coords(e));});['pointerup','pointercancel'].forEach(n=>el.addEventListener(n,()=>{clearTimeout(holdTimer);drag=null;}));
      el.addEventListener('keydown',e=>{const dirs={ArrowLeft:[-5,0],ArrowRight:[5,0],ArrowUp:[0,-5],ArrowDown:[0,5]};if(dirs[e.key]){e.preventDefault();obj.placed=false;el.classList.add('placing');action.hidden=false;move(obj,{x:Math.max(28,Math.min(map.clientWidth-28,obj.x+dirs[e.key][0])),y:Math.max(105,Math.min(map.clientHeight-18,obj.y+dirs[e.key][1]))});}else if(e.key==='Enter'&&obj.placed){obj.placed=false;el.classList.add('placing');action.hidden=false;}});el.classList.add('placing');action.hidden=false;return obj;
    }
    map.addEventListener('click',e=>{if(e.target.closest('.city-object'))return;const pending=objects.find(x=>!x.placed);if(pending)move(pending,coords(e));else create(coords(e));$('[data-city-status]').textContent=t('Передвиньте объект и нажмите «Поставить».','Move the object, then tap Place.');});
    action.addEventListener('click',()=>{objects.filter(x=>!x.placed).forEach(x=>{x.placed=true;x.el.classList.remove('placing');motion(x.el,[{transform:'translate(-50%,-100%) scale(.93)'},{transform:'translate(-50%,-100%) scale(1)'}],220);});action.hidden=true;$('[data-city-status]').textContent=t('Поставлено. Для перемещения зажмите объект.','Placed. Hold an object to move it.');});
    $$('[data-city-tool]').forEach(b=>b.addEventListener('click',()=>{tool=b.dataset.cityTool;$$('[data-city-tool]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));}));$('[data-city-reset]').addEventListener('click',()=>{clearTimeout(holdTimer);objects.forEach(x=>x.el.remove());objects=[];drag=null;action.hidden=true;});
    window.addEventListener('pagehide',()=>clearTimeout(holdTimer));
  }
  if ($('.neon-lab')) {
    // player.gd constants scaled uniformly .45 to this 600px browser arena.
    const scale=.45,G=2100*scale,JX=900*scale,JY=-930*scale,THRUST=1400*scale,SLIDE=120*scale;
    const canvas=$('.neon-canvas'),ctx=canvas.getContext('2d'),bg=new Image(),wall=new Image();bg.src='/assets/demo/neon-background.png';wall.src='/assets/demo/neon-wall.png';
    let x=48,y=500,vx=0,vy=0,onWall=true,side=-1,launchSide=-1,holding=false,thrustTime=0,redirects=0,rotation=0,spin=0,camera=0,height=0,started=false,dead=false,last=0,frame=0,visible=true,trail=[];
    const status=$('[data-neon-status]');
    function draw(){ctx.clearRect(0,0,600,700);ctx.fillStyle='#080e22';ctx.fillRect(0,0,600,700);if(bg.naturalWidth){const s=Math.max(600/bg.naturalWidth,700/bg.naturalHeight);ctx.drawImage(bg,(600-bg.naturalWidth*s)/2,(700-bg.naturalHeight*s)/2,bg.naturalWidth*s,bg.naturalHeight*s);}if(wall.naturalWidth){ctx.drawImage(wall,14,80,18,620);ctx.drawImage(wall,568,80,18,620);}ctx.fillStyle='#9980ff';ctx.fillRect(60,95,480*Math.max(0,1-thrustTime),4);
      trail.forEach((p,i)=>{const a=(1-i/trail.length)*.55;ctx.fillStyle=`rgba(0,242,255,${a})`;ctx.beginPath();ctx.arc(p.x,p.y-camera,22*scale*(1-i/trail.length),0,Math.PI*2);ctx.fill();});
      ctx.save();ctx.translate(x,y-camera);ctx.rotate(rotation);const r=34*scale;
      const circle=(px,py,radius,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(px,py,radius,0,Math.PI*2);ctx.fill();};
      circle(0,0,r*1.24,'#00f2ff09');circle(0,0,r*1.075,'#004447f5');circle(0,0,r,'#00cbd6f5');circle(r*.16,r*.18,r*.72,'#0044471a');circle(-r*.30,-r*.34,r*.27,'#ffffff3b');ctx.strokeStyle='#38f5ffeb';ctx.lineWidth=Math.max(2,r*.07);ctx.beginPath();ctx.arc(0,0,r*1.015,.1,Math.PI*2-.1);ctx.stroke();const eye=r*.68;circle(eye,r*.28,r*.31,'#f5fcff');circle(eye+r*.075,r*.255,r*.115,'#02040a');circle(eye+r*.1,r*.215,r*.035,'#ffffffc2');ctx.restore();
      if(onWall){ctx.strokeStyle='#00f2ffcc';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y-camera,52*scale,-Math.PI/2-.6,-Math.PI/2+.6);ctx.stroke();}if(dead){ctx.fillStyle='#080e22bb';ctx.fillRect(0,0,600,700);ctx.fillStyle='#c9f9ff';ctx.font='bold 28px sans-serif';ctx.textAlign='center';ctx.fillText(t('ЗАБЕГ ЗАВЕРШЁН','RUN COMPLETE'),300,330);ctx.textAlign='start';}}
    function tick(now){const dt=Math.min((now-last)/1000||.016,.033);last=now;if(started&&!dead){if(onWall){vx=0;vy+=(SLIDE-vy)*Math.min(1,dt*12);}else{vy+=G*dt;if(holding&&thrustTime<1){vy-=THRUST*dt;thrustTime=Math.min(1,thrustTime+dt);spin+=(4-spin)*Math.min(1,dt*10);}x+=vx*dt;rotation+=spin*dt;trail.unshift({x,y});trail=trail.slice(0,18);}y+=vy*dt;
        if(!onWall&&(x<=48||x>=552)){side=x<=48?-1:1;x=side<0?48:552;onWall=true;vx=0;vy=Math.max(-180*scale,Math.min(SLIDE,vy*.45));thrustTime=0;redirects=0;trail=[];status.textContent=t('Стена поймана. Тап — оттолкнуться.','Wall caught. Tap to kick off.');}
        height=Math.max(height,500-y);camera=Math.min(camera,y-330);$('[data-neon-score]').textContent=`${Math.max(0,Math.floor(height/scale/100))} m`;if(y-camera>680){dead=true;holding=false;status.textContent=t('Падение. Нажмите ↺ для нового забега.','You fell. Tap ↺ for a new run.');}}
      draw();if(visible&&!document.hidden&&started&&!dead)frame=requestAnimationFrame(tick);}
    function jump(){if(dead)return;started=true;if(onWall){launchSide=side;vx=-side*JX;vy=JY;x+=-side*16*scale;onWall=false;redirects=1;thrustTime=0;spin=18*Math.sign(vx);}else if(redirects>0){vx=launchSide*JX;vy=JY;redirects=0;spin=12*Math.sign(vx);}holding=true;last=performance.now();cancelAnimationFrame(frame);frame=requestAnimationFrame(tick);}
    [canvas,$('[data-neon-jump]')].forEach(el=>{el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);jump();});['pointerup','pointercancel','lostpointercapture'].forEach(n=>el.addEventListener(n,()=>holding=false));el.addEventListener('keydown',e=>{if(['Space','Enter'].includes(e.code)&&!e.repeat){e.preventDefault();jump();}});el.addEventListener('keyup',e=>{if(['Space','Enter'].includes(e.code))holding=false;});});
    $('[data-neon-reset]').addEventListener('click',()=>{cancelAnimationFrame(frame);x=48;y=500;vx=vy=rotation=spin=camera=height=thrustTime=0;side=launchSide=-1;onWall=true;holding=started=dead=false;redirects=0;trail=[];$('[data-neon-score]').textContent='0 m';status.textContent=t('Тап — прыжок · удержание — тяга · второй тап — разворот','Tap to jump · hold for thrust · tap again to turn back');draw();});
    function resume(){cancelAnimationFrame(frame);holding=false;if(visible&&!document.hidden&&started&&!dead){last=performance.now();frame=requestAnimationFrame(tick);}}
    new IntersectionObserver(e=>{visible=e[0].isIntersecting;resume();}).observe(canvas);document.addEventListener('visibilitychange',resume);window.addEventListener('pagehide',()=>cancelAnimationFrame(frame));bg.onload=wall.onload=draw;draw();
  }
})();
