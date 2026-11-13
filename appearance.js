/* Global appearance switches. Independent of project-specific Snowy New Year effects. */
(() => {
  'use strict';
  const root=document.documentElement;
  const themeButton=document.getElementById('theme-toggle');
  const holidayButton=document.getElementById('holiday-toggle');
  if(!themeButton||!holidayButton)return;

  const THEME_KEY='portfolio-theme-v1';
  const HOLIDAY_KEY='portfolio-holiday-v1';
  const CAP_SELECTORS=[
    '.nav','.terminal-card','.stats','.featured-card','.project',
    '.modworks-entry-card','.cta','.support-card','.project-dialog',
    '.about-content'
  ].join(',');
  const GARLAND_SELECTORS=[
    '.nav','.stats','.modworks-entry-card','.cta',
    '.featured-section .section-heading','.projects-section .section-heading',
    '.support-card'
  ].join(',');
  const snowOverlay=document.createElement('div');
  snowOverlay.id='holiday-snow';
  snowOverlay.setAttribute('aria-hidden','true');
  snowOverlay.innerHTML='<span class="holiday-fall holiday-fall-near"></span><span class="holiday-fall holiday-fall-far"></span>';
  document.body.appendChild(snowOverlay);

  // Snow caps live in viewport overlays, not inside overflow:hidden cards.
  // This lets them rest ABOVE the top edge while preserving clipping and
  // scrolling in cards, galleries and the project dialog.
  const pageCaps=document.createElement('div');
  const dialogCaps=document.createElement('div');
  pageCaps.id='holiday-page-caps';
  dialogCaps.id='holiday-dialog-caps';
  pageCaps.setAttribute('aria-hidden','true');
  dialogCaps.setAttribute('aria-hidden','true');
  document.body.appendChild(pageCaps);
  document.body.appendChild(dialogCaps);
  const capItems=new Map();
  const SNOWY_SELECTORS='.project.snowy-theme,.featured-card.snowy-theme,.project-dialog.snowy-theme';
  let capFrame=0;
  let followUntil=0;
  const cachedPositions=new WeakMap();

  const capHeight=el=>el.matches('.nav')?23:
    el.matches('.terminal-card')?24:
    el.matches('.stats')?22:
    el.matches('.project,.featured-card')?27:
    el.matches('.project-dialog')?25:
    el.matches('.modworks-entry-card')?31:
    el.matches('.about-content')?23:35;

  // Follow transforms while they animate, not just at the instant of a
  // scroll/pointer event. Read all boxes first, then update GPU transforms
  // so layout changes do not cascade through individual cards.
  function updateCaps(now){
    capFrame=0;
    const active=[];
    const shouldShowHoliday=root.dataset.holiday==='on';
    const viewportWidth=document.documentElement.clientWidth;
    const viewportHeight=document.documentElement.clientHeight;
    for(const [host,cap] of capItems){
      const needed=shouldShowHoliday||host.matches(SNOWY_SELECTORS);
      if(!host.isConnected||!needed){
        cap.remove();
        capItems.delete(host);
        continue;
      }
      const rect=host.getBoundingClientRect();
      const visible=rect.width>0&&rect.height>0&&rect.bottom>0&&
        rect.top<viewportHeight&&rect.right>0&&rect.left<viewportWidth;
      if(!visible){
        if(!cap.hidden)cap.hidden=true;
        continue;
      }
      // The cap is inverted: its straight lower edge sits on the block.
      const height=capHeight(host);
      active.push({
        cap,
        x:rect.left,
        y:rect.top-height+2,
        width:rect.width,
        height
      });
    }
    for(const box of active){
      const cap=box.cap;
      if(cap.hidden)cap.hidden=false;
      const next=[box.x,box.y,box.width,box.height];
      const prev=cachedPositions.get(cap);
      if(prev&&prev.every((v,i)=>Math.abs(v-next[i])<0.06))continue;
      cachedPositions.set(cap,next);
      cap.style.width=box.width+'px';
      cap.style.height=box.height+'px';
      // Position via transform to track compositor-driven hover/scroll
      // motion without changing the document layout.
      cap.style.transform='translate3d('+box.x+'px,'+box.y+'px,0)';
    }
    if(capItems.size && !document.hidden && now<followUntil){
      capFrame=requestAnimationFrame(updateCaps);
    }
  }
  function scheduleCaps(){
    if(capFrame||document.hidden)return;
    capFrame=requestAnimationFrame(updateCaps);
  }
  function followCaps(duration=650){
    if(!capItems.size)return;
    followUntil=Math.max(followUntil,performance.now()+duration);
    scheduleCaps();
  }
  function capFor(host){
    if(capItems.has(host))return;
    const cap=document.createElement('span');
    cap.className='holiday-cap';
    cap.setAttribute('aria-hidden','true');
    (host.matches('.project-dialog')?dialogCaps:pageCaps).appendChild(cap);
    capItems.set(host,cap);
  }
  function syncCaps(scope=document){
    if(root.dataset.holiday==='on')select(CAP_SELECTORS,scope).forEach(capFor);
    select(SNOWY_SELECTORS,scope).forEach(capFor);
    followCaps(700);
  }

  const persist=(key,value)=>{try{localStorage.setItem(key,value)}catch{}};
  const select=(base,scope)=>{
    const found=[];
    if(scope.matches?.(base)) found.push(scope);
    scope.querySelectorAll?.(base).forEach(item=>found.push(item));
    return found;
  };
  function decorate(scope=document){
    // The light strings can stay in their hosts; caps cannot, because
    // several hosts must keep overflow:hidden for the image/gallery layout.
    if(root.dataset.holiday==='on'){
      const addGarland=element=>{
        if([...element.children].some(el=>el.classList.contains('holiday-garland')))return;
        element.classList.add('holiday-host');
        const garland=document.createElement('span');
        garland.className='holiday-garland';
        garland.setAttribute('aria-hidden','true');
        element.appendChild(garland);
      };
      select(GARLAND_SELECTORS,scope).forEach(addGarland);
    }
    syncCaps(scope);
  }
  function applyTheme(value){
    const light=value==='light';
    root.dataset.theme=light?'light':'dark';
    themeButton.setAttribute('aria-pressed',String(light));
    themeButton.setAttribute('aria-label',light?'Включить тёмную тему':'Включить светлую тему');
    themeButton.title=light?'Переключить на ночь':'Переключить на день';
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.setAttribute('content',light?'#f2f6f1':'#09090b');
    persist(THEME_KEY,root.dataset.theme);
  }
  function applyHoliday(enabled){
    root.dataset.holiday=enabled?'on':'off';
    holidayButton.setAttribute('aria-pressed',String(enabled));
    holidayButton.setAttribute('aria-label',enabled?'Выключить новогоднюю тему':'Включить новогоднюю тему');
    holidayButton.title=enabled?'Выключить снег и гирлянды':'Включить снег и гирлянды';
    snowOverlay.hidden=!enabled;
    if(enabled) decorate();
    else{
      document.querySelectorAll('.holiday-garland').forEach(el=>el.remove());
      document.querySelectorAll('.holiday-host').forEach(el=>el.classList.remove('holiday-host'));
      // Snowy New Year keeps its own cap even with the global theme off.
      syncCaps();
    }
    persist(HOLIDAY_KEY,enabled?'on':'off');
  }
  themeButton.addEventListener('click',()=>applyTheme(root.dataset.theme==='light'?'dark':'light'));
  holidayButton.addEventListener('click',()=>applyHoliday(root.dataset.holiday!=='on'));
  applyTheme(root.dataset.theme);
  applyHoliday(root.dataset.holiday==='on');

  // Portfolio cards are generated by GitHub data, search and release updates.
  // Observe only direct card-list changes to avoid a mutation feedback loop.
  const observer=new MutationObserver(records=>{
    for(const record of records){
      if(record.type==='attributes'){
        if(record.target.matches?.('.project-dialog'))decorate(record.target);
        continue;
      }
      for(const node of record.addedNodes){
        if(node.nodeType===1)decorate(node);
      }
    }
    followCaps(700);
  });
  ['projects-grid','featured-grid'].forEach(id=>{
    const grid=document.getElementById(id);
    if(grid)observer.observe(grid,{childList:true});
  });
  const projectModal=document.getElementById('project-modal');
  const dialog=projectModal?.querySelector('.project-dialog');
  if(projectModal)observer.observe(projectModal,{attributes:true,attributeFilter:['hidden','class']});
  if(dialog){
    observer.observe(dialog,{attributes:true,attributeFilter:['class']});
    dialog.addEventListener('transitionend',()=>followCaps(200));
  }
  // Capture scrolling inside the dialog, too. Continuous short-lived RAF
  // tracking is necessary for smooth scrolling and CSS hover transitions.
  const trackScroll=()=>followCaps(450);
  const trackPointer=()=>followCaps(450);
  const trackTransition=()=>followCaps(750);
  window.addEventListener('scroll',trackScroll,{passive:true,capture:true});
  window.addEventListener('resize',()=>followCaps(750),{passive:true});
  window.addEventListener('orientationchange',()=>followCaps(750),{passive:true});
  document.addEventListener('pointermove',trackPointer,{passive:true,capture:true});
  document.addEventListener('pointerover',trackTransition,{passive:true,capture:true});
  document.addEventListener('pointerout',trackTransition,{passive:true,capture:true});
  document.addEventListener('transitionrun',trackTransition,true);
  document.addEventListener('transitionend',()=>followCaps(220),true);
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden)followCaps(700);
  });
  // Elements also shift when fonts, images or gallery content finish loading.
  document.addEventListener('load',()=>followCaps(450),true);
  decorate();
})();
